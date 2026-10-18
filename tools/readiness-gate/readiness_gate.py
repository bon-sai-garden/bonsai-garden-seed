#!/usr/bin/env python3
# ---
# id: 01M3BS441B4D6BJ5H23S281Z65
# ---
"""Publication-readiness gate — two readers over one tree.

Reader one is a set of deterministic rules: free, exact, auditable, and exact
about the wrong thing whenever the pattern and the question have drifted apart.
Reader two is a classifier. It is the SECOND reader, never the first and never
the deciding one. What the gate acts on is the *disagreement* between them, and
the classifier-only hits a pattern cannot reach.

The gate proposes. It never writes to the corpus, never flips a status, never
commits. A human or a kin decides, and writes the record.

Design contract — see rituals/specs/spec-publication-readiness-gate.md:

  * Name the engine. Every rule runs through Python's own `re`, in process.
    Nothing shells out to grep or git grep. The engine and its version go in
    the report header, because `git grep -E`, GNU grep, BSD grep and ugrep do
    not share a regex dialect and the one that silently declines to match is
    the dangerous one.
  * Name the tree. The unit is a commit or a built artefact, never the working
    tree. `--dirty` exists, is stamped ADVISORY, and cannot produce a verdict
    that clears anything.
  * Plant a known positive, every run. A synthetic identity record is injected
    into the batch stream. If the classifier does not see it, the run is
    BLOCKED and its clean answers mean nothing.
  * Fail loud. Unreachable, rate-limited, malformed, incomplete -> the item is
    INCONCLUSIVE and the run is BLOCKED. Unreachable is not absent.

Standard library only. Python 3.9+.

Exit codes:
  0  completed, no reviewer queue
  1  usage or configuration error
  2  completed, reviewer queue non-empty (findings to read)
  3  BLOCKED — one or more items inconclusive
  4  refused — a corpus precondition is not met
  5  BLOCKED — the planted positive was not caught
"""

from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from collections.abc import Iterable, Sequence
from pathlib import Path

TOOL_VERSION = "0.1.0"
HERE = Path(__file__).resolve().parent

# --- vendor-shaped constants ------------------------------------------------
# Published figures for the pilot classifier, 2026-09-22. They are inputs, not
# measurements of ours. Substituting a different classifier means substituting
# these too — they belong to the engine, not to the gate.
STATE_BUDGET_TOKENS = 32_768  # state + longest question must fit
TOTAL_CONTEXT_TOKENS = 65_536
PRICE_PER_MTOK_IN = 0.042  # USD, input; output free
BYTES_PER_TOKEN = 4  # [ASSUMPTION] no tokenizer is published
BATCH_SAFETY_MARGIN = 1_024  # tokens held back from the state budget
CHUNK_OVERLAP_LINES = 20  # so a finding on a chunk boundary survives

TEXT_SUFFIXES = {
    ".md",
    ".txt",
    ".py",
    ".sh",
    ".bash",
    ".zsh",
    ".mjs",
    ".cjs",
    ".js",
    ".ts",
    ".json",
    ".jsonc",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".html",
    ".htm",
    ".css",
    ".xml",
    ".svg",
    ".bonsaisig",
    ".env.example",
    ".sig",
}
ALWAYS_SKIP_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    "site-packages",
    ".mypy_cache",
    ".pytest_cache",
    "dist",
    "build",
    ".build",
}

CLASSES = ("person-identifier", "credential", "private-host-path", "instance-in-capability-layer")

# --- the canary -------------------------------------------------------------
# The planted positive uses a synthetic identity, never the real one. Planting
# the real identifiers would mean sending them to the classifier on purpose,
# and would make the guard indistinguishable from the corpus it is guarding.
CANARY = {
    "login": "vandermeeri",
    "person": "Ilse Vandermeer",
    "domain": "vandermeer-logistics.example",
    "host": "vandermeer-bench-04.lan",
}
CANARY_ITEM_ID = "__planted__/canary-identity-record.md"
CANARY_TEXT = f"""---
title: "Operator record"
type: note
---

# Operator record

The operator of record is {CANARY['person']}, who signs in as
`{CANARY['login']}` and is reachable at
`Ilse.Vandermeer@{CANARY['domain']}`. Her workstation is
`{CANARY['host']}` and her checkout lives at
`/Users/{CANARY['login']}/dev/garden`.

This file is planted by the readiness gate on every run. If it is not
reported, the run's clean answers mean nothing.
"""
# Canned classifier answer for the canary, used in stub mode only.
CANARY_STUB_ANSWER = {
    "q-real-person": {"p": 0.99, "confidence": 0.96},
    "q-credential": {"p": 0.02, "confidence": 0.9},
    "q-private-host": {"p": 0.95, "confidence": 0.92},
    "q-layer": {"probs": {"capability": 0.02, "instance": 0.9, "both": 0.06, "undecidable": 0.02}, "confidence": 0.88},
    "q-severity": {"expected": 5.0, "distribution": [0.0, 0.0, 0.0, 0.02, 0.18, 0.8], "confidence": 0.9},
}

# --- corpus preconditions ---------------------------------------------------
# The gardener's boundary, made mechanical. Per corpus, not as a caveat.
CORPUS_PROFILES: dict[str, dict] = {
    "template-repo": {
        "label": "the capability/template repository, being prepared for publication",
        "requires_gardener_approval": True,
        "requires_dpa": False,
        "why": "About to be public. Sending it to a classifier leaks nothing "
        "that is not about to be public anyway. Still needs the "
        "gardener's yes, because it costs money.",
    },
    "tooling-tree": {
        "label": "a large tooling tree nobody has read recently",
        "requires_gardener_approval": True,
        "requires_dpa": False,
        "requires_sample_read": True,
        "why": "Mostly craft, but thousands of unread files is exactly where a "
        "surprise lives. Sample and read before sending the batch.",
    },
    "instance": {
        "label": "instance material — pot, agent memory, journals, inboxes, chronicles, keyring",
        "requires_gardener_approval": True,
        "requires_dpa": True,
        "why": "Never on an agent's say-so. Zero data retention is enterprise-"
        "only under a signed data-processing agreement. Without both the "
        "gardener's explicit yes and a DPA reference, this gate refuses.",
    },
}

RESTRICTED_CONFIDENTIALITY = {"intel", "excourse", "private", "secret"}
POT_MARKERS = {"pot.json", ".pot-marker"}


class GateError(Exception):
    """A configuration or precondition failure. Never a classifier failure."""


class ClassifierUnavailable(Exception):
    """The second reader could not answer. Never treated as 'clean'."""


# ---------------------------------------------------------------------------
# Identity profile and rules
# ---------------------------------------------------------------------------


@dataclasses.dataclass
class Rule:
    id: str
    cls: str
    pattern: re.Pattern[str]
    why: str
    advisory: bool = False  # reported, but excluded from calibration scoring


def load_profile(path: Path) -> dict:
    prof = json.loads(path.read_text(encoding="utf-8"))
    for key in ("logins", "people", "domains", "hosts", "ticket_prefixes", "kin_names", "placeholder_allowlist"):
        prof.setdefault(key, [])
    prof.setdefault("kin_name_shape", r"(?<![A-Za-z])[A-Z][a-z]+-?(?:sai|shin)(?![a-z])")
    # The canary is part of the effective profile so reader one can see it too.
    prof = dict(prof)
    prof["logins"] = [*prof["logins"], CANARY["login"]]
    prof["people"] = [*prof["people"], CANARY["person"]]
    prof["domains"] = [*prof["domains"], CANARY["domain"]]
    prof["hosts"] = [*prof["hosts"], CANARY["host"]]
    return prof


def _alt(items: Iterable[str]) -> str:
    items = [re.escape(i) for i in items if i]
    return "|".join(sorted(items, key=len, reverse=True))


def build_rules(profile: dict) -> list[Rule]:
    """Compile reader one.

    Every boundary here is written with an explicit character-class lookaround,
    not `\\b`. `\\b` is a GNU extension: a pattern carrying it returns a
    confident zero on any engine that does not implement it, and the zero is
    indistinguishable from an answer. This rule set is engine-pinned to
    Python's `re` and never leaves the process.
    """
    NB_L, NB_R = r"(?<![A-Za-z0-9_])", r"(?![A-Za-z0-9_])"
    rules: list[Rule] = []

    if profile["logins"]:
        rules.append(
            Rule(
                "R-PERSON-LOGIN",
                "person-identifier",
                re.compile(NB_L + "(?:" + _alt(profile["logins"]) + ")" + NB_R),
                "A login as a standalone token. Boundaries are explicit: on "
                "2026-09-22 a substring match for a four-letter login returned 53 "
                "files because ordinary English words contain it.",
            )
        )
    if profile["people"]:
        rules.append(
            Rule(
                "R-PERSON-NAME",
                "person-identifier",
                re.compile("(?:" + _alt(profile["people"]) + ")", re.IGNORECASE),
                "A real person's name, from the identity profile.",
            )
        )
    if profile["domains"]:
        rules.append(
            Rule(
                "R-PERSON-DOMAIN",
                "person-identifier",
                re.compile("(?:" + _alt(profile["domains"]) + ")", re.IGNORECASE),
                "An employer or personal domain, from the identity profile.",
            )
        )

    rules.append(
        Rule(
            "R-PERSON-EMAIL",
            "person-identifier",
            re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"),
            "A generic e-mail address. Placeholder domains are filtered out afterwards by the profile allowlist.",
            advisory=True,
        )
    )

    rules.append(
        Rule(
            "R-CRED-KEYBLOCK",
            "credential",
            re.compile(r"-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----"),
            "A private key in PEM or OpenSSH armour.",
        )
    )
    rules.append(
        Rule(
            "R-CRED-ASSIGN",
            "credential",
            re.compile(
                r"(?i)(?<![A-Za-z])(?:api[_\-]?key|secret[_\-]?key|private[_\-]?key|"
                r"access[_\-]?token|auth[_\-]?token|deploy[_\-]?token|token|password|"
                r"passwd|client[_\-]?secret)\s*[:=]\s*[\"']?"
                r"(?!\$|\{|<|\"|'|\s|null|None|true|false)[A-Za-z0-9_\-/+.]{16,}"
            ),
            "A secret-shaped name assigned a literal value. Assignments to a "
            "variable reference, a template token or an empty value are excluded; "
            "`pubkey`, `fingerprint` and `sign:` blocks are public and are not "
            "matched by name.",
        )
    )

    rules.append(
        Rule(
            "R-HOST-ABSPATH",
            "private-host-path",
            re.compile(r"(?:/Users|/home)/(?!<)[A-Za-z0-9._\-]+/|[A-Za-z]:\\Users\\[A-Za-z0-9._\-]+\\"),
            "An absolute path rooted in a named home directory. A sidecar's target "
            "field leaked the host account name exactly this way on 2026-09-22.",
        )
    )
    if profile["hosts"]:
        rules.append(
            Rule(
                "R-HOST-NAME",
                "private-host-path",
                re.compile(NB_L + "(?:" + _alt(profile["hosts"]) + ")" + NB_R, re.IGNORECASE),
                "A machine name from the identity profile.",
            )
        )
    rules.append(
        Rule(
            "R-HOST-LANSUFFIX",
            "private-host-path",
            re.compile(
                r"(?<![A-Za-z0-9])[A-Za-z0-9][A-Za-z0-9\-]{1,62}\.(?:lan|home|internal)"
                r"(?![A-Za-z0-9])"
            ),
            "A hostname on a private network suffix.",
            advisory=True,
        )
    )

    if profile["ticket_prefixes"]:
        rules.append(
            Rule(
                "R-INSTANCE-TICKET",
                "instance-in-capability-layer",
                re.compile(
                    r"(?<![A-Za-z0-9])(?:" + _alt(profile["ticket_prefixes"]) + r")-[A-Z]{2}[0-9]{3}(?![A-Za-z0-9])"
                ),
                "A ticket identifier pointing at a tracker the reader cannot open. "
                "Written without `\\b` on purpose: the same pattern with `\\b` "
                "returned 0 on 2026-09-22 where the answer was 18 files.",
            )
        )
    rules.append(
        Rule(
            "R-INSTANCE-DATE",
            "instance-in-capability-layer",
            re.compile(r"(?<![0-9])(?:19|20)[0-9]{2}-[01][0-9]-[0-3][0-9](?![0-9])"),
            "A dated reference. Low precision by design — most dates in this house "
            "style sit in a sentence naming the incident that earned a rule, which "
            "is `both`, not `instance`. Advisory: reported, never scored.",
            advisory=True,
        )
    )

    return rules


def kin_spans(text: str, profile: dict) -> list[tuple[int, int]]:
    """Spans occupied by agent names. Never a finding.

    The gardener ruled on 2026-09-22 that kin names are part of the template,
    not leakage, and reverted a pass that had removed them. Reader one is
    blind to them by construction; reader two is told so in its instructions;
    and a labelled control watches the pair.
    """
    spans: list[tuple[int, int]] = []
    shape = re.compile(profile["kin_name_shape"])
    for m in shape.finditer(text):
        spans.append(m.span())
    if profile["kin_names"]:
        for m in re.finditer("(?:" + _alt(profile["kin_names"]) + ")", text, re.IGNORECASE):
            spans.append(m.span())
    return spans


def _overlaps(span: tuple[int, int], spans: Sequence[tuple[int, int]]) -> bool:
    return any(span[0] < b and a < span[1] for a, b in spans)


@dataclasses.dataclass
class Finding:
    rule_id: str
    cls: str
    item_id: str
    line: int
    excerpt: str  # redacted
    advisory: bool


def _redact(s: str) -> str:
    s = s.strip()
    if len(s) <= 8:
        return s[0] + "*" * (len(s) - 1) if s else s
    return s[:4] + "*" * min(len(s) - 8, 16) + s[-4:]


def apply_rules(item_id: str, text: str, rules: Sequence[Rule], profile: dict) -> list[Finding]:
    kin = kin_spans(text, profile)
    allow = [a.lower() for a in profile["placeholder_allowlist"]]
    line_starts = [0]
    for i, ch in enumerate(text):
        if ch == "\n":
            line_starts.append(i + 1)

    def lineno(pos: int) -> int:
        lo, hi = 0, len(line_starts) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if line_starts[mid] <= pos:
                lo = mid
            else:
                hi = mid - 1
        return lo + 1

    out: list[Finding] = []
    for rule in rules:
        for m in rule.pattern.finditer(text):
            if _overlaps(m.span(), kin):
                continue
            hit = m.group(0)
            if rule.id == "R-PERSON-EMAIL" and any(a in hit.lower() for a in allow):
                continue
            out.append(Finding(rule.id, rule.cls, item_id, lineno(m.start()), _redact(hit), rule.advisory))
    return out


# ---------------------------------------------------------------------------
# The tree — named, never assumed
# ---------------------------------------------------------------------------


@dataclasses.dataclass
class Tree:
    root: Path
    kind: str  # "commit" | "artifact" | "working-tree"
    identity: str  # a commit sha, an artefact digest, or a warning
    advisory: bool  # a working tree can never clear anything
    _tmp: tempfile.TemporaryDirectory | None = None


def materialise(args) -> Tree:
    given = sum(bool(x) for x in (args.rev, args.artifact, args.dirty, args.path))
    if given != 1:
        raise GateError(
            "Name the tree: exactly one of --rev, --artifact, --dirty, --path. "
            "There is no default. A publication gate that guesses which tree it "
            "read is the bug it exists to catch — on 2026-09-22 two counts of "
            "the same question, 31 and 19, were both right about different trees."
        )
    if args.rev:
        tmp = tempfile.TemporaryDirectory(prefix="readiness-gate-")
        try:
            sha = subprocess.run(
                ["git", "-C", str(args.root), "rev-parse", args.rev], check=True, capture_output=True, text=True
            ).stdout.strip()
            tar = subprocess.run(["git", "-C", str(args.root), "archive", sha], check=True, capture_output=True).stdout
        except (subprocess.CalledProcessError, FileNotFoundError) as exc:
            tmp.cleanup()
            raise GateError(f"could not materialise {args.rev!r}: {exc}") from exc
        with tarfile.open(fileobj=__import__("io").BytesIO(tar)) as tf:
            tf.extractall(tmp.name)  # noqa: S202 — git's own archive of a named commit of this repository, into a fresh temp dir; the host's 3.9.6 has no filter=
        return Tree(Path(tmp.name), "commit", sha, advisory=False, _tmp=tmp)
    if args.artifact:
        art = Path(args.artifact)
        digest = hashlib.sha256(art.read_bytes()).hexdigest()
        tmp = tempfile.TemporaryDirectory(prefix="readiness-gate-")
        if zipfile.is_zipfile(art):
            with zipfile.ZipFile(art) as zf:
                zf.extractall(tmp.name)  # noqa: S202 — the artefact the gardener named on the command line, into a fresh temp dir
        else:
            with tarfile.open(art) as tf:
                tf.extractall(tmp.name)  # noqa: S202 — the artefact the gardener named on the command line, into a fresh temp dir; the host's 3.9.6 has no filter=
        return Tree(Path(tmp.name), "artifact", f"sha256:{digest}", advisory=False, _tmp=tmp)
    if args.dirty:
        return Tree(Path(args.root), "working-tree", "UNCOMMITTED — this tree has never shipped", advisory=True)
    return Tree(Path(args.path), "working-tree", f"directory {args.path} — not a commit", advisory=True)


def walk_text_files(root: Path) -> list[Path]:
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ALWAYS_SKIP_DIRS]
        for fn in sorted(filenames):
            p = Path(dirpath) / fn
            if p.suffix.lower() in TEXT_SUFFIXES or fn in POT_MARKERS:
                out.append(p)
    return sorted(out)


def frontmatter_confidentiality(text: str) -> str | None:
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end < 0:
        return None
    m = re.search(r"^confidentiality:\s*([A-Za-z\-]+)\s*$", text[:end], re.MULTILINE)
    return m.group(1).lower() if m else None


def check_preconditions(tree: Tree, files: Sequence[Path], texts: dict[Path, str], args) -> None:
    """The gardener's boundary, enforced before anything is read out loud.

    This is a hard refusal, not a warning, and it applies in stub mode too: a
    report that names instance material is itself an export of it.
    """
    pot = [p for p in files if p.name in POT_MARKERS]
    if pot:
        raise GateError(
            "REFUSED: a pot marker was found in this tree — "
            + ", ".join(str(p.relative_to(tree.root)) for p in pot[:5])
            + ". Instance material is never sent to a classifier, and never "
            "summarised into a report, on an agent's say-so."
        )

    restricted = [
        p for p in files if (frontmatter_confidentiality(texts.get(p, "")) or "") in RESTRICTED_CONFIDENTIALITY
    ]
    if restricted:
        values = "/".join(sorted(RESTRICTED_CONFIDENTIALITY))
        named = ", ".join(str(p.relative_to(tree.root)) for p in restricted[:5]) + (" …" if len(restricted) > 5 else "")
        raise GateError(
            f"REFUSED: {len(restricted)} file(s) carry a restricted `confidentiality:` value ({values}). Named: {named}"
        )

    prof = CORPUS_PROFILES.get(args.corpus_profile)
    if prof is None:
        raise GateError(
            f"unknown --corpus-profile {args.corpus_profile!r}; choose one of: {', '.join(CORPUS_PROFILES)}"
        )

    if args.classifier != "live":
        return  # nothing leaves this process

    if prof["requires_gardener_approval"] and not args.gardener_approval:
        raise GateError(
            f"REFUSED: --classifier live over corpus profile {args.corpus_profile!r} requires "
            f"--gardener-approval <reference>. {prof['why']}"
        )
    if prof["requires_dpa"] and not args.dpa_reference:
        raise GateError(
            f"REFUSED: corpus profile {args.corpus_profile!r} requires --dpa-reference <signed DPA>. "
            f"Zero data retention is enterprise-only. {prof['why']}"
        )
    if prof.get("requires_sample_read") and not args.sample_read_confirmed:
        raise GateError(
            f"REFUSED: corpus profile {args.corpus_profile!r} requires --sample-read-confirmed — a "
            "human has read a sample of this tree before the batch is sent."
        )
    if os.environ.get("READINESS_GATE_LIVE_ACK") != args.corpus_profile:
        raise GateError(
            f"REFUSED: set READINESS_GATE_LIVE_ACK={args.corpus_profile} in the environment to "
            "confirm a live classifier call on this corpus. Two independent "
            "gestures, deliberately."
        )


# ---------------------------------------------------------------------------
# Batching
# ---------------------------------------------------------------------------


def est_tokens(s: str) -> int:
    """[ASSUMPTION] No tokenizer is published for the pilot classifier, so this
    is bytes/4, rounded up. It is an estimate and the report says so. The
    safety margin below absorbs the error; a 413 from the vendor is handled as
    an inconclusive batch and split, never as a clean answer."""
    return -(-len(s.encode("utf-8")) // BYTES_PER_TOKEN)


@dataclasses.dataclass
class Item:
    item_id: str
    path: str
    chunk: int
    text: str
    tokens: int


@dataclasses.dataclass
class Batch:
    batch_id: str
    items: list[Item]

    @property
    def tokens(self) -> int:
        return sum(i.tokens for i in self.items)


def question_overhead(questions: dict) -> tuple[int, int]:
    """(total question tokens, longest single question tokens)."""
    pre = questions.get("shared_preamble", "")
    per = []
    for q in questions["questions"]:
        blob = json.dumps(q, ensure_ascii=False)
        per.append(est_tokens(blob))
    return est_tokens(pre) + sum(per), (max(per) if per else 0)


def make_items(files: Sequence[tuple[str, str]], usable: int) -> list[Item]:
    items: list[Item] = []
    for rel, text in files:
        t = est_tokens(text)
        if t <= usable:
            items.append(Item(rel, rel, 0, text, t))
            continue
        lines = text.splitlines(keepends=True)
        start, chunk = 0, 0
        while start < len(lines):
            end, acc = start, 0
            while end < len(lines) and acc + est_tokens(lines[end]) <= usable:
                acc += est_tokens(lines[end])
                end += 1
            if end == start:  # one pathological line
                end = start + 1
                acc = est_tokens(lines[start])
            body = "".join(lines[start:end])
            items.append(Item(f"{rel}#{chunk}", rel, chunk, body, est_tokens(body)))
            chunk += 1
            if end >= len(lines):
                break
            start = max(end - CHUNK_OVERLAP_LINES, start + 1)
    return items


def make_batches(items: Sequence[Item], usable: int) -> list[Batch]:
    batches: list[Batch] = []
    cur: list[Item] = []
    acc = 0
    for it in items:
        if cur and acc + it.tokens > usable:
            batches.append(Batch(f"b{len(batches):04d}", cur))
            cur, acc = [], 0
        cur.append(it)
        acc += it.tokens
    if cur:
        batches.append(Batch(f"b{len(batches):04d}", cur))
    return batches


# ---------------------------------------------------------------------------
# THE SEAM
# ---------------------------------------------------------------------------


def classify(batch: Batch, questions: dict, *, mode: str, config: dict) -> dict:
    """The second reader. One function. This is the substitution point.

    Contract, in both directions:

      in   batch.items -> [{item_id, text}], questions -> the question set
      out  {item_id: {question_id: answer}} for EVERY item and EVERY question

    An answer is {"p": float, "confidence": float} for a `noul`,
    {"probs": {option: float}, "confidence": float} for a `choice`, and
    {"expected": float, "distribution": [...], "confidence": float} for a
    `score`.

    Any failure raises ClassifierUnavailable. It never returns a partial
    result and it never returns "clean" as a stand-in for "did not answer".
    A different classifier is substituted here and nowhere else; the
    reconciler, the report and the calibration harness do not know what is
    behind this call.
    """
    if mode == "stub":
        return _classify_stub(batch, questions, config)
    if mode == "live":
        return _classify_live(batch, questions, config)
    raise GateError(f"unknown classifier mode {mode!r}")


def _classify_stub(batch: Batch, questions: dict, config: dict) -> dict:
    """Canned answers. Reads a JSON file; no network, no vendor, no spend.

    A stub run can never emit PASS. An item with no canned answer comes back
    INCONCLUSIVE rather than clean — the whole point of this gate is that a
    reader who did not answer has not said the corpus is clean.
    """
    canned = config.get("stub_answers", {})
    mutation = config.get("mutation")
    if mutation == "unreachable":
        raise ClassifierUnavailable("stub mutation 'unreachable': simulated transport failure")
    out: dict = {}
    for it in batch.items:
        if it.item_id == CANARY_ITEM_ID:
            ans = json.loads(json.dumps(CANARY_STUB_ANSWER))
            if mutation == "drop-planted":
                ans["q-real-person"] = {"p": 0.02, "confidence": 0.93}
                ans["q-private-host"] = {"p": 0.03, "confidence": 0.9}
                ans["q-layer"] = {
                    "probs": {"capability": 0.9, "instance": 0.04, "both": 0.04, "undecidable": 0.02},
                    "confidence": 0.9,
                }
            out[it.item_id] = ans
            continue
        key = it.path if it.chunk == 0 and it.item_id == it.path else it.item_id
        ans = canned.get(key) or canned.get(it.path)
        if ans is None:
            continue  # -> INCONCLUSIVE downstream
        ans = json.loads(json.dumps(ans))
        if mutation == "flag-kin" and it.path.endswith("n02-credit-the-kin.md"):
            ans["q-real-person"] = {"p": 0.93, "confidence": 0.88}
        if mutation == "malformed" and it.path.endswith("n05-generic-paths.md"):
            ans.pop("q-layer", None)
        out[it.item_id] = ans
    return out


def _classify_live(batch: Batch, questions: dict, config: dict) -> dict:
    """The real client. Deliberately inert in this build.

    Nothing in the shipped defaults reaches this function: `--classifier stub`
    is the default, and every path to `live` passes through
    check_preconditions() first, which requires the gardener's approval
    reference, the corpus profile, an environment acknowledgement and — for
    instance material — a signed DPA reference.

    Implementation note for whoever wires it: the pilot classifier is reachable
    both directly and as a Workers AI model, so this function has two plausible
    bodies. Whichever is chosen, it must (a) send state + questions in one
    request, (b) treat any non-2xx, timeout, rate-limit, truncation or schema
    violation as ClassifierUnavailable, (c) bound retries and record every one
    in the report, and (d) never synthesise a missing answer.
    """
    endpoint = config.get("endpoint")
    if not endpoint:
        raise GateError(
            "live classifier requested but no endpoint is configured. This "
            "build ships no endpoint and makes no network call: the pilot was "
            "approved as a specification, not as a run."
        )
    raise GateError(
        "live classifier is not implemented in this build. Implement here, and "
        "only here; see the docstring. Do not add a second call site."
    )


# ---------------------------------------------------------------------------
# Reconciliation — two readers, and what to do with them
# ---------------------------------------------------------------------------

DISPOSITIONS = [
    "INCONCLUSIVE",
    "DISAGREE-CLASSIFIER-CLEAN",
    "DISAGREE-CLASSIFIER-HIT",
    "CLASSIFIER-ONLY-HIGH",
    "CLASSIFIER-ONLY",
    "AGREED-HIT",
    "RULE-HIT-CLASSIFIER-UNCERTAIN",
]

QUESTION_FOR_CLASS = {
    "person-identifier": "q-real-person",
    "credential": "q-credential",
    "private-host-path": "q-private-host",
    "instance-in-capability-layer": "q-layer",
}


def act_score(answer: dict, qdef: dict) -> tuple[float, float] | None:
    """(act score in [0,1], confidence) or None if the answer is unusable."""
    if not isinstance(answer, dict):
        return None
    conf = answer.get("confidence")
    if not isinstance(conf, (int, float)) or not 0.0 <= conf <= 1.0:
        return None
    if qdef["type"] == "noul":
        p = answer.get("p")
        if not isinstance(p, (int, float)) or not 0.0 <= p <= 1.0:
            return None
        return float(p), float(conf)
    if qdef["type"] == "choice":
        probs = answer.get("probs")
        if not isinstance(probs, dict):
            return None
        keys = {k.split(" -")[0].strip() for k in qdef["options"]}
        if not set(probs) & keys:
            return None
        score = sum(float(v) for k, v in probs.items() if k in ("instance", "both"))
        return min(max(score, 0.0), 1.0), float(conf)
    if qdef["type"] == "score":
        exp = answer.get("expected")
        if not isinstance(exp, (int, float)):
            return None
        return min(max(float(exp) / max(len(qdef["levels"]) - 1, 1), 0.0), 1.0), float(conf)
    return None


@dataclasses.dataclass
class Row:
    item_id: str
    cls: str
    disposition: str
    rule_ids: list[str]
    p: float | None
    confidence: float | None
    note: str


def reconcile(
    items: Sequence[Item], rule_findings: dict[str, list[Finding]], answers: dict[str, dict], questions: dict
) -> tuple[list[Row], list[str]]:
    th = questions["thresholds"]
    qdefs = {q["id"]: q for q in questions["questions"]}
    rows: list[Row] = []
    inconclusive: list[str] = []

    for it in items:
        ans = answers.get(it.item_id)
        item_bad = False
        if ans is None:
            item_bad = True
            reason = "no answer returned for this item"
        else:
            missing = [q["id"] for q in questions["questions"] if q["id"] not in ans]
            if missing:
                item_bad = True
                reason = "answer missing question(s): " + ", ".join(missing)
        if item_bad:
            inconclusive.append(f"{it.item_id}: {reason}")
            for cls in CLASSES:
                fs = [f for f in rule_findings.get(it.item_id, []) if f.cls == cls]
                if fs:
                    rows.append(
                        Row(
                            it.item_id,
                            cls,
                            "INCONCLUSIVE",
                            sorted({f.rule_id for f in fs}),
                            None,
                            None,
                            "reader one fired; reader two did not answer",
                        )
                    )
            if not any(rule_findings.get(it.item_id, [])):
                rows.append(Row(it.item_id, "-", "INCONCLUSIVE", [], None, None, reason))
            continue

        for cls in CLASSES:
            qid = QUESTION_FOR_CLASS[cls]
            scored = act_score(ans.get(qid, {}), qdefs[qid])
            if scored is None:
                inconclusive.append(f"{it.item_id}: unusable answer for {qid}")
                rows.append(Row(it.item_id, cls, "INCONCLUSIVE", [], None, None, f"unusable answer for {qid}"))
                continue
            p, conf = scored
            fs = [f for f in rule_findings.get(it.item_id, []) if f.cls == cls]
            hard = [f for f in fs if not f.advisory]
            rule_ids = sorted({f.rule_id for f in fs})
            low_conf = conf < th["min_confidence"]

            if hard:
                if p < th["t_clean"] and not low_conf:
                    rows.append(
                        Row(
                            it.item_id,
                            cls,
                            "DISAGREE-CLASSIFIER-CLEAN",
                            rule_ids,
                            p,
                            conf,
                            "the rule stands; the classifier disputes it. "
                            "Read this first — and the rule is not removed.",
                        )
                    )
                elif p >= th["t_act"]:
                    rows.append(Row(it.item_id, cls, "AGREED-HIT", rule_ids, p, conf, ""))
                else:
                    rows.append(
                        Row(
                            it.item_id,
                            cls,
                            "RULE-HIT-CLASSIFIER-UNCERTAIN",
                            rule_ids,
                            p,
                            conf,
                            "low-confidence or middling second opinion",
                        )
                    )
            else:
                if fs:
                    adv = f"an advisory rule fired ({','.join(rule_ids)}) but no rule of record. Act on it."
                else:
                    adv = "no rule can reach this. Act on it."
                if p >= th["t_high"] and not low_conf:
                    rows.append(Row(it.item_id, cls, "CLASSIFIER-ONLY-HIGH", rule_ids, p, conf, adv))
                elif p >= th["t_act"]:
                    rows.append(Row(it.item_id, cls, "CLASSIFIER-ONLY", rule_ids, p, conf, ""))
                elif fs:
                    rows.append(
                        Row(it.item_id, cls, "RULE-HIT-CLASSIFIER-UNCERTAIN", rule_ids, p, conf, "advisory rule only")
                    )
    return rows, inconclusive


ORDER = {d: i for i, d in enumerate(DISPOSITIONS)}


def order_rows(rows: Sequence[Row]) -> list[Row]:
    return sorted(rows, key=lambda r: (ORDER.get(r.disposition, 99), -(r.p or 0.0), r.item_id, r.cls))


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


def sha_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def print_report(
    tree: Tree,
    args,
    questions_path: Path,
    profile_path: Path,
    rows: Sequence[Row],
    inconclusive: Sequence[str],
    n_items: int,
    n_batches: int,
    total_tokens: int,
    planted_ok: bool | None,
    stream=sys.stdout,
) -> None:
    w = stream.write
    w("=" * 78 + "\n")
    w(f"PUBLICATION-READINESS GATE  v{TOOL_VERSION}\n")
    w("=" * 78 + "\n")
    w(f"  tree            : {tree.kind} — {tree.identity}\n")
    w(f"  rule engine     : python re, {sys.version.split()[0]} (in process; nothing shells out)\n")
    w(f"  question set    : {questions_path.name}  sha256:{sha_of(questions_path)}\n")
    w(f"  identity profile: {profile_path.name}  sha256:{sha_of(profile_path)}\n")
    w(f"  classifier      : {args.classifier}\n")
    w(f"  corpus profile  : {args.corpus_profile}\n")
    w(f"  items / batches : {n_items} / {n_batches}   ({total_tokens:,} state tokens, estimated bytes/4)\n")
    planted = "CAUGHT" if planted_ok else ("NOT CAUGHT" if planted_ok is False else "not planted")
    w(f"  planted positive: {planted}\n")
    w("\n")

    if inconclusive:
        w(f"!! BLOCKING — {len(inconclusive)} inconclusive item(s). This run reports NOTHING CLEAN.\n")
        w("   Unreachable is not absent. A reader that did not answer has not\n   said the corpus is clean.\n")
        for line in inconclusive[:25]:
            w(f"     - {line}\n")
        if len(inconclusive) > 25:
            w(f"     … and {len(inconclusive) - 25} more\n")
        w("\n")

    if planted_ok is False:
        w(
            "!! BLOCKING — the planted positive was not caught by the second reader.\n"
            "   A classifier that has only ever said 'clean' is indistinguishable\n"
            "   from a broken one. Every clean answer in this run is void.\n\n"
        )

    ordered = order_rows(rows)
    queue = [r for r in ordered if r.disposition != "INCONCLUSIVE"]
    by_disp: dict[str, list[Row]] = {}
    for r in queue:
        by_disp.setdefault(r.disposition, []).append(r)

    w("REVIEWER QUEUE — read top to bottom. The order is the method.\n\n")
    headings = {
        "DISAGREE-CLASSIFIER-CLEAN": "1. DISAGREEMENTS — a rule fired and the classifier says clean.\n"
        "   The rule stands. Read these first: one of the two readers is\n"
        "   wrong here, and finding out which is the whole return on the\n"
        "   second reader.",
        "DISAGREE-CLASSIFIER-HIT": "1b. DISAGREEMENTS (other direction)",
        "CLASSIFIER-ONLY-HIGH": "2. CLASSIFIER-ONLY, HIGH CONFIDENCE — no rule can reach these.\n"
        "   This is the stratum a pattern is structurally blind to.",
        "CLASSIFIER-ONLY": "3. CLASSIFIER-ONLY — no rule fired, second reader above the act\n"
        "   threshold but below high confidence.",
        "AGREED-HIT": "4. AGREED — both readers. Ordinary findings; the rule is the\n"
        "   authority and the classifier concurs.",
        "RULE-HIT-CLASSIFIER-UNCERTAIN": "5. RULE HIT, SECOND READER UNCERTAIN — the rule is the authority.",
    }
    any_rows = False
    for disp in DISPOSITIONS:
        if disp == "INCONCLUSIVE" or disp not in by_disp:
            continue
        any_rows = True
        w(headings.get(disp, disp) + "\n\n")
        for r in by_disp[disp]:
            w(f"   {r.item_id:<46} {r.cls:<30}\n")
            rules = ",".join(r.rule_ids) or "-"
            p = "-" if r.p is None else f"{r.p:.2f}"
            conf = "-" if r.confidence is None else f"{r.confidence:.2f}"
            w(f"       rules={rules}  p={p} conf={conf}\n")
            if r.note:
                w(f"       {r.note}\n")
        w("\n")
    if not any_rows:
        w("   (empty)\n\n")

    clean = n_items - len({r.item_id for r in ordered})
    w(f"   {max(clean, 0)} item(s) reported clean by both readers (not listed).\n\n")

    w("VERDICT: ")
    if inconclusive:
        w("BLOCKED — inconclusive. Nothing here clears anything.\n")
    elif planted_ok is False:
        w("BLOCKED — the guard did not bite.\n")
    elif args.classifier == "stub":
        w(
            "ADVISORY ONLY — stub classifier. This run clears nothing, by\n"
            "         construction. A stub can only exercise the machinery.\n"
        )
    elif tree.advisory:
        w("ADVISORY ONLY — a working tree is not a tree that ships.\n")
    elif queue:
        w(f"FINDINGS — {len(queue)} row(s) for a human or a kin to read.\n")
    else:
        w("NO FINDINGS at the declared thresholds.\n")
    w(
        "\nThis gate proposes. It has written nothing to the corpus and will not.\n"
        "A human or a kin decides, and writes the record.\n"
    )


# ---------------------------------------------------------------------------
# Cost
# ---------------------------------------------------------------------------


def cost_report(total_state_tokens: int, n_batches: int, q_total: int, stream=sys.stdout) -> float:
    billable = total_state_tokens + n_batches * q_total
    usd = billable / 1_000_000 * PRICE_PER_MTOK_IN
    w = stream.write
    w("\nCOST — arithmetic, not a quote\n")
    w(f"  state tokens (bytes/4, [ASSUMPTION])   {total_state_tokens:>12,}\n")
    w(f"  question set per request               {q_total:>12,} tokens\n")
    w(f"  requests                               {n_batches:>12,}\n")
    w(f"  question tokens billed ({n_batches} x {q_total:,})       {n_batches * q_total:>12,}\n")
    w("  ------------------------------------------------------\n")
    w(f"  billable input tokens                  {billable:>12,}\n")
    cost = f"${usd:,.4f}"
    w(f"  x ${PRICE_PER_MTOK_IN:.3f} per 1M input, output free      {cost:>12}\n")
    w(f"  latency, 70-500 ms per request, serial {n_batches * 0.07:8.1f}-{n_batches * 0.5:.1f} s\n")
    return usd


# ---------------------------------------------------------------------------
# Self-test — the calibration harness, run against the labelled fixture
# ---------------------------------------------------------------------------

BAR = {
    "person-identifier": {"recall": 1.00, "precision": 0.80},
    "credential": {"recall": 1.00, "precision": 0.80},
    "private-host-path": {"recall": 1.00, "precision": 0.80},
    "instance-in-capability-layer": {"recall": 0.95, "precision": 0.70},
}


def _prf(tp: int, fp: int, fn: int) -> tuple[float, float]:
    prec = tp / (tp + fp) if (tp + fp) else 1.0
    rec = tp / (tp + fn) if (tp + fn) else 1.0
    return prec, rec


def selftest(args, stream=sys.stdout) -> int:
    w = stream.write
    fixdir = HERE / "fixtures"
    labels = json.loads((fixdir / "labels.json").read_text(encoding="utf-8"))
    questions = json.loads(Path(args.questions).read_text(encoding="utf-8"))
    profile = load_profile(Path(args.profile))
    rules = build_rules(profile)
    stub = json.loads((fixdir / "stub-answers.json").read_text(encoding="utf-8"))

    corpus = fixdir / "corpus"
    files: list[tuple[str, str]] = []
    for p in sorted(corpus.iterdir()):
        if p.is_file():
            files.append((p.name, p.read_text(encoding="utf-8", errors="replace")))

    _, q_longest = question_overhead(questions)
    usable = STATE_BUDGET_TOKENS - q_longest - BATCH_SAFETY_MARGIN
    items = make_items(files, usable)
    items.append(Item(CANARY_ITEM_ID, CANARY_ITEM_ID, 0, CANARY_TEXT, est_tokens(CANARY_TEXT)))
    batches = make_batches(items, usable)

    config = {"stub_answers": stub["answers"], "mutation": args.mutation}
    answers: dict[str, dict] = {}
    transport_failed = False
    try:
        for b in batches:
            answers.update(classify(b, questions, mode="stub", config=config))
    except ClassifierUnavailable as exc:
        transport_failed = True
        w(f"classifier unavailable: {exc}\n")

    rule_findings: dict[str, list[Finding]] = {}
    for it in items:
        rule_findings[it.item_id] = apply_rules(it.item_id, it.text, rules, profile)

    rows, inconclusive = reconcile(items, rule_findings, answers, questions)

    # --- the guard: was the planted positive caught by READER TWO? ---
    th = questions["thresholds"]
    canary_ans = answers.get(CANARY_ITEM_ID)
    qdefs = {q["id"]: q for q in questions["questions"]}
    planted_ok = False
    if canary_ans:
        s = act_score(canary_ans.get("q-real-person", {}), qdefs["q-real-person"])
        planted_ok = bool(s and s[0] >= th["t_act"] and s[1] >= th["min_confidence"])

    w("\n" + "=" * 78 + "\nSELF-TEST — scored against the labelled fixture\n" + "=" * 78 + "\n")
    w(f"  mutation        : {args.mutation or 'none (baseline)'}\n")
    w(f"  rule engine     : python re, {sys.version.split()[0]}\n")
    w(f"  items           : {len(items)} in {len(batches)} batch(es), usable state {usable:,} tokens\n")
    w(f"  planted positive: {'CAUGHT by reader two' if planted_ok else 'NOT CAUGHT'}\n\n")

    failures: list[str] = []

    # T2 — no compiled rule may carry `\b`. Checked against the COMPILED
    # patterns, not the source text: the source discusses `\b` at length, and a
    # grep over the file would answer a different question from the one asked.
    bs = [r.id for r in rules if r"\b" in r.pattern.pattern]
    if bs:
        failures.append(
            f"rule(s) {', '.join(bs)} carry `\\b`. It is a GNU extension: on an engine that "
            "does not implement it the pattern returns a confident zero "
            "indistinguishable from an empty corpus."
        )
    tk = next((r for r in rules if r.id == "R-INSTANCE-TICKET"), None)
    if tk and not tk.pattern.search("raised as XY-AB123 and closed"):
        failures.append(
            "R-INSTANCE-TICKET does not match a planted ticket identifier. A pattern that cannot match is a zero."
        )

    if transport_failed or inconclusive:
        w(f"  INCONCLUSIVE items: {max(len(inconclusive), 1)}\n")
        for line in inconclusive[:10]:
            w(f"    - {line}\n")
        w("  VERDICT: BLOCKED — inconclusive. Not 'clean'.\n")
        return 3

    if not planted_ok:
        w("  VERDICT: BLOCKED — the planted positive was not caught. Every\n  clean answer in this run is void.\n")
        return 5

    # --- disqualifying controls ---
    fired: dict[str, set] = {}
    for r in rows:
        if r.disposition in (
            "AGREED-HIT",
            "CLASSIFIER-ONLY-HIGH",
            "CLASSIFIER-ONLY",
            "DISAGREE-CLASSIFIER-CLEAN",
            "RULE-HIT-CLASSIFIER-UNCERTAIN",
        ):
            fired.setdefault(r.item_id, set()).add(r.cls)
    for ctrl in labels["disqualifying_controls"]:
        hit = {
            c
            for c in fired.get(ctrl, set())
            if any(not f.advisory for f in rule_findings.get(ctrl, []) if f.cls == c)
            or c in _classifier_hits(ctrl, answers, questions)
        }
        if hit:
            failures.append(
                f"DISQUALIFYING: control {ctrl} was flagged for {', '.join(sorted(hit))}. The "
                "gardener ruled on 2026-09-22 that agent names are "
                "part of the template."
            )

    # --- per-class precision / recall, gate vs reader one alone ---
    w(f"  {'class':<32} {'reader one alone':<22} both readers\n")
    for cls in CLASSES:
        tp = fp = fn = 0
        rtp = rfp = rfn = 0
        for name, lab in labels["files"].items():
            truth = bool(lab.get(cls, 0))
            rule_hit = any(f.cls == cls and not f.advisory for f in rule_findings.get(name, []))
            gate_hit = rule_hit or (cls in _classifier_hits(name, answers, questions))
            tp += truth and gate_hit
            fp += (not truth) and gate_hit
            fn += truth and (not gate_hit)
            rtp += truth and rule_hit
            rfp += (not truth) and rule_hit
            rfn += truth and (not rule_hit)
        p, r = _prf(tp, fp, fn)
        rp, rr = _prf(rtp, rfp, rfn)
        w(f"  {cls:<32} P={rp:.2f} R={rr:.2f}          P={p:.2f} R={r:.2f}\n")
        bar = BAR[cls]
        if r < bar["recall"] - 1e-9:
            failures.append(f"{cls}: recall {r:.2f} below the bar {bar['recall']:.2f}")
        if p < bar["precision"] - 1e-9:
            failures.append(f"{cls}: precision {p:.2f} below the bar {bar['precision']:.2f}")
        if cls == "instance-in-capability-layer" and not r > rr + 1e-9:
            failures.append(
                f"instance-in-capability-layer: both readers (R={r:.2f}) did not beat "
                f"reader one alone (R={rr:.2f}). The second reader bought nothing, "
                "which is the only thing it was being bought for."
            )

    w("\n")
    if failures:
        w(f"  FAIL — {len(failures)}\n")
        for f in failures:
            w(f"    - {f}\n")
        w(
            "\n  The bar is not negotiable after the fact. A configuration that\n"
            "  misses it is DROPPED, not tuned until it passes: tuning against\n"
            "  this set converts it into training data and destroys the only\n"
            "  measurement available.\n"
        )
        return 2
    w("  PASS — every class at or above the bar, controls clean, guard bit.\n")
    return 0


def _classifier_hits(item_id: str, answers: dict[str, dict], questions: dict) -> set:
    th = questions["thresholds"]
    qdefs = {q["id"]: q for q in questions["questions"]}
    ans = answers.get(item_id)
    if not ans:
        return set()
    out = set()
    for cls, qid in QUESTION_FOR_CLASS.items():
        s = act_score(ans.get(qid, {}), qdefs[qid])
        if s and s[0] >= th["t_act"] and s[1] >= th["min_confidence"]:
            out.add(cls)
    return out


WATCH_EXPECT = {
    "drop-planted": (5, "the guard must refuse when reader two misses a planted positive"),
    "flag-kin": (2, "a kin name flagged as a real person must fail the calibration"),
    "malformed": (3, "a malformed answer must block, not pass"),
    "unreachable": (3, "an unreachable classifier must block, not report clean"),
}


def watch_guards(args, stream=sys.stdout) -> int:
    """A guard is not trusted until it has been watched to fail.

    Four deliberate breakages, each with an expected exit code. A run in which
    every guard passes is the failure mode this function exists to prevent:
    guards that have never bitten are indistinguishable from guards that cannot.
    """
    w = stream.write
    w("WATCHING THE GUARDS FAIL\n" + "=" * 78 + "\n")
    base = argparse.Namespace(**vars(args))
    base.mutation = None
    import io as _io

    sink = _io.StringIO()
    rc = selftest(base, stream=sink)
    w(f"  baseline                 expected 0, got {rc}  {'OK' if rc == 0 else 'FAIL'}\n")
    bad = 0 if rc == 0 else 1
    for mut, (expect, why) in WATCH_EXPECT.items():
        ns = argparse.Namespace(**vars(args))
        ns.mutation = mut
        sink = _io.StringIO()
        got = selftest(ns, stream=sink)
        ok = got == expect
        bad += 0 if ok else 1
        w(f"  {mut:<24} expected {expect}, got {got}  {'OK' if ok else 'FAIL'}\n     {why}\n")
    verdict = "All guards bit." if bad == 0 else f"{bad} guard(s) did not behave as specified."
    w(f"\n{verdict}\n")
    return 0 if bad == 0 else 2


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="readiness_gate.py",
        description="Publication-readiness gate — deterministic rules first, "
        "a classifier second, and the disagreement is the product.",
    )
    ap.add_argument("--root", default=".", help="repository root (for --rev)")
    g = ap.add_argument_group("the tree — exactly one, no default")
    g.add_argument("--rev", help="a commit-ish; materialised with git archive")
    g.add_argument("--artifact", help="a built artefact (.zip/.tar*)")
    g.add_argument("--dirty", action="store_true", help="the working tree — ADVISORY, clears nothing")
    g.add_argument("--path", help="a plain directory — ADVISORY, clears nothing")

    ap.add_argument("--questions", default=str(HERE / "questions.json"))
    ap.add_argument(
        "--profile",
        default=str(HERE / "identity-profile.example.json"),
        help="identity profile; the real one is never committed",
    )
    ap.add_argument("--stub-answers", default=str(HERE / "fixtures" / "stub-answers.json"))
    ap.add_argument(
        "--classifier", choices=("stub", "live"), default="stub", help="stub is the default and makes no network call"
    )
    ap.add_argument("--corpus-profile", default="template-repo", choices=sorted(CORPUS_PROFILES))
    ap.add_argument("--gardener-approval", help="reference to the gardener's yes")
    ap.add_argument("--dpa-reference", help="signed data-processing agreement reference")
    ap.add_argument("--sample-read-confirmed", action="store_true")
    ap.add_argument("--no-plant", action="store_true", help="skip the planted positive — requires --plant-waiver")
    ap.add_argument("--plant-waiver", help="written reason, stamped into the report")
    ap.add_argument("--report-json", help="write the report as JSON (never inside the tree)")
    ap.add_argument("--cost-only", action="store_true", help="batch and cost the corpus; call no classifier")
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--watch-guards", action="store_true")
    ap.add_argument("--mutation", choices=sorted(WATCH_EXPECT), help="deliberately break one guard (self-test only)")
    args = ap.parse_args(argv)

    if args.watch_guards:
        return watch_guards(args)
    if args.selftest:
        return selftest(args)

    try:
        questions = json.loads(Path(args.questions).read_text(encoding="utf-8"))
        profile = load_profile(Path(args.profile))
        tree = materialise(args)
        if args.no_plant and not args.plant_waiver:
            raise GateError(
                "--no-plant requires --plant-waiver '<reason>'. A run "
                "with no planted positive cannot distinguish a working "
                "classifier from a broken one."
            )

        paths = walk_text_files(tree.root)
        texts = {}
        for p in paths:
            try:
                texts[p] = p.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
        check_preconditions(tree, paths, texts, args)

        if args.report_json:
            rj = Path(args.report_json).resolve()
            if str(rj).startswith(str(tree.root.resolve()) + os.sep):
                raise GateError(
                    "--report-json must not be written inside the tree being read. The gate never writes to the corpus."
                )

        files = [(str(p.relative_to(tree.root)), t) for p, t in texts.items()]
        q_total, q_longest = question_overhead(questions)
        usable = STATE_BUDGET_TOKENS - q_longest - BATCH_SAFETY_MARGIN
        items = make_items(files, usable)
        if not args.no_plant:
            items.append(Item(CANARY_ITEM_ID, CANARY_ITEM_ID, 0, CANARY_TEXT, est_tokens(CANARY_TEXT)))
        batches = make_batches(items, usable)
        total_tokens = sum(i.tokens for i in items)

        if args.cost_only:
            print(f"tree: {tree.kind} — {tree.identity}")
            print(f"files: {len(files)}   items (after chunking): {len(items)}   batches: {len(batches)}")
            print(
                f"state budget {STATE_BUDGET_TOKENS:,}, longest question {q_longest:,}, "
                f"safety {BATCH_SAFETY_MARGIN:,} -> usable {usable:,}"
            )
            cost_report(total_tokens, len(batches), q_total)
            return 0

        rules = build_rules(profile)
        rule_findings = {it.item_id: apply_rules(it.item_id, it.text, rules, profile) for it in items}

        config = {
            "stub_answers": json.loads(Path(args.stub_answers).read_text(encoding="utf-8"))["answers"],
            "mutation": args.mutation,
        }
        answers: dict[str, dict] = {}
        transport: list[str] = []
        for b in batches:
            try:
                answers.update(classify(b, questions, mode=args.classifier, config=config))
            except ClassifierUnavailable as exc:
                transport.append(f"batch {b.batch_id}: {exc}")

        rows, inconclusive = reconcile(items, rule_findings, answers, questions)
        inconclusive = list(transport) + inconclusive

        planted_ok: bool | None = None
        if not args.no_plant:
            th = questions["thresholds"]
            qdefs = {q["id"]: q for q in questions["questions"]}
            ca = answers.get(CANARY_ITEM_ID)
            s = act_score((ca or {}).get("q-real-person", {}), qdefs["q-real-person"])
            planted_ok = bool(s and s[0] >= th["t_act"] and s[1] >= th["min_confidence"])

        print_report(
            tree,
            args,
            Path(args.questions),
            Path(args.profile),
            rows,
            inconclusive,
            len(items),
            len(batches),
            total_tokens,
            planted_ok,
        )
        cost_report(total_tokens, len(batches), q_total)

        if args.report_json:
            Path(args.report_json).write_text(
                json.dumps(
                    {
                        "tool_version": TOOL_VERSION,
                        "tree": {"kind": tree.kind, "identity": tree.identity, "advisory": tree.advisory},
                        "engine": "python-re/" + sys.version.split()[0],
                        "questions_sha256_16": sha_of(Path(args.questions)),
                        "classifier": args.classifier,
                        "planted_positive_caught": planted_ok,
                        "inconclusive": inconclusive,
                        "rows": [dataclasses.asdict(r) for r in order_rows(rows)],
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )

        if inconclusive:
            return 3
        if planted_ok is False:
            return 5
        return 2 if rows else 0
    except GateError as exc:
        sys.stderr.write(f"readiness-gate: {exc}\n")
        return 4 if str(exc).startswith("REFUSED") else 1


if __name__ == "__main__":
    sys.exit(main())
