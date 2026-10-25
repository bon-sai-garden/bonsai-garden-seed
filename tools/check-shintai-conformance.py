#!/usr/bin/env python3
# ---
# id: 01M341RRWEXVTSZJN12KECQ5V1
# title: Check Shintai Conformance
# type: script
# tended-by: baisai
# created: 2026-09-22
# updated: 2026-10-25
# copyright: © 2026 Bonsai Garden · bon-sai.garden
# ---
"""check-shintai-conformance -- does a shintai match the ratified 3.0 structure?

The gate named in rituals/specs/spec-canonical-shintai-structure.md
("The conformance gate"), v3.0.0. Built 2026-09-22 per the Aruji's directive,
2026-09-22: "when we say it's a 3.0 structure, it should exactly match the 3.0
structure as we're now defining it. As a gate." Deliberately NOT a line inside
a body's own SKILL.md -- a claim inside the thing being checked is not a
check. This script inspects a shintai from the outside.

Capability, not instance (LAYERS.md): it takes any shintai's path as an
argument and knows nothing about which garden it runs in. That is why it
lives in core rather than in a garden's own pot or runtime.

Two modes
---------

ON-DISK  -- does a body's working tree match the structure?

    python3 tools/check-shintai-conformance.py <path-to-agent-dir> [...]

  1. Required present: SKILL.md; references/ containing an about-me.* file;
     identity/; memory/.
  2. Forbidden absent, anywhere under the shintai: README.md (Anthropic's
     Complete Guide to Building Skills for Claude, p.10 -- "All documentation
     goes in SKILL.md or references/"); any *.bak file (baggage does not
     travel to pot -- spec Sec. "Baggage").
  3. Misplaced: memory/patterns.md (patterns.md is role-level, not lived --
     it belongs at the shintai's top level, agents/<slug>/patterns.md);
     a heritage.* file anywhere except under references/ (the confirmed
     misfiling pattern found repo-wide, e.g. home/<slug>/misc/heritage.html
     or a bare <slug>-heritage.html at the shintai root);
     a presence file anywhere but references/presence.md of its own body.
     Found by its frontmatter `type: presence`, not its name, so a procedure
     that happens to be called presence.md (Jisai's) is not one, and a nested
     body (agents/baisai/fuji-shin/, marked by agent.md + identity/) is held to
     its own references/. Added
     2026-09-26: Triu's sat in assets/ and this gate passed her as 3.0.
  4. Structural leak: home/ nested INSIDE the shintai directory itself.
     home/<slug>/ is always a sibling tree, never a subtree.
  1b. Version lock (the Aruji, 2026-09-22; spec Sec. "Required present"): SKILL.md
     and about-me declare the same version. One function, version_lock_problems,
     run three ways: here on a source tree (exact, label included); on an installed
     body, where the stamp line carries the full version and the frontmatter only
     M.m.p (about-me's version must be the stamp's, or its M.m.p when about-me
     declares only three parts); and by package.py on every staged body, so a
     build whose lock is broken is REFUSED, never shipped. A SKILL.md that names
     another build of its own version in its prose (W's 3.0.0.7-rc carried
     "version 3.0.0.3" twice; found by W, 2026-10-16) is the lock broken from
     inside, and fails the same way.
  1d. Seals verify (spec 3.0.6; seal v2, seal v2): every .bonsaisig, and every
     embedded sign: without one, is checked by core's own verifier
     (skills/bonsai-garden-sign, node); the constitution must be sealed -- by a v2
     sidecar; a retired v1 embedded seal passes with a WARNING until the cutover
     (skills/bonsai-garden-sign/seal-policy.json) and fails after it; a nested
     body's agent.md needs a sidecar; an
     orphaned sidecar is a finding; a seal at both names beside one file
     (`.X.bonsaisig` and `X.bonsaisig`, the dot-prefixed sidecar change) is a finding, two-sidecars.
     Which file a sidecar seals, and whether a file has one, is the Node
     finder's answer (skills/bonsai-garden-sign/lib/sidecar-format.mjs, through
     tools/verify-many.mjs) -- this gate builds no sidecar name of its own.
     A verifier that cannot run FAILS. PNG seals
     need --png-verifier 'python3 tools/sign.py'; without it they print as
     NOT VERIFIED, never as a silent pass.
  1e. PEM drift (spec 3.0.7): an identity/*.pem must decode to exactly its
     .bin, or be a TOMBSTONE; anything else is a finding.
  1f. No frontmatter id: in SKILL.md (AGENTS.md, Every kin, "A SKILL.md's
     shape", 2026-10-24): the id is the seal's. A nested one (metadata.id)
     counts; an id: in the body does not.
  1g. Owner seals (the gardener, 2026-10-24: "every file within a shintai should
     have the owner seal, not a custodian seal. If we need a kin to seal their
     own shintai files we need to invoke them and ask them to sign it."): every
     file carries a v2 seal, role owner, signed by the kin the body belongs to
     (a nested body's files: that body's kin). On disk a WARNING by default, so
     a kin can still wake and seal; --owner-seals refuse fails the body; package.py
     refuses to ship any such file (owner_seal_findings, the one definition).
     The gardener's own files (memory/identity.md, memory/strategic-context.md)
     are named as his, awaiting his own seal, and never refused.

  If a sibling home/<slug>/ tree exists next to the given agents/<slug>/
  (repo root found by the agents/registry.json marker), it is inspected too,
  for the heritage-misplacement pattern specifically -- home/ has its own
  rules (spec Sec. "The home/ layer") and this gate does not otherwise
  police its contents.

PACKAGED -- does a built artifact leak what must never ship?

    python3 tools/check-shintai-conformance.py --packaged <dir-or-zip> [...]

  5. Empty-memory gate (the Aruji, 2026-09-23: "don't call it 'seed memory'.
     'seed' is the state they were invited at... For now the shintai carries
     an empty working state and memory. The memory lives in pot."). A
     packaged memory/ may hold ONLY the empty skeleton -- memory/working-state.md
     and memory/MEMORY.md, each frontmatter only, no body. Anything else under
     memory/ (journal/, strategic-context.md, identity.md, lineage.md, seed/,
     ...) and any skeleton file with body content is a leak. A lived journal
     inside an export is the leak this exists to catch, and it looks exactly
     like a correct build from the outside.
     NAMED EXCEPTIONS: Bonsai and W. Bonsai travels with his initial memory,
     the deliberate extract of his mission and role; W with her portable garden
     memory, memory/initial/garden-side-v1.md, a portable extraction (both
     the Aruji, 2026-09-23 — W's in her own seat, relayed by Tasai). Their
     artifacts may carry memory files, but never memory/journal/. Named here,
     not "some bodies may", so the exception cannot spread quietly. The body is
     identified by the packaged SKILL.md's own `name:`.
  6. home/ must not appear anywhere in the packaged artifact, at any depth.

Exit 0 if every target passes every applicable check. Exit 1 if any target
fails, with every violation on its own body-slug prefix, and a reason
alongside each.
"""

from __future__ import annotations

import argparse
import atexit
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

# A gate loads no bytecode from beside the Python it loads by path. In Fuji-shin's round four (2026-10-25) a .pyc
# planted beside package.py ran in place of the builder under check-skill-conformance.py, under -B too, while the
# builder's sealed bytes stayed untouched: bytecode is code. So before any sibling is loaded, Python's cache points at
# a fresh private folder, removed at exit.
sys.dont_write_bytecode = True
sys.pycache_prefix = tempfile.mkdtemp(prefix="bonsai-pycache-")
atexit.register(shutil.rmtree, sys.pycache_prefix, True)

REQUIRED_TOP = ("SKILL.md",)
REQUIRED_DIRS = ("references", "identity", "memory")
ABOUT_ME_GLOBS = ("about-me.md", "about-me.html", "about-me.htm")


def _find_repo_root(agent_dir: Path) -> Path | None:
    """Walk upward from an agent dir looking for the agents/registry.json
    marker -- the same convention every other tool in this garden uses
    (never count directory levels; a script that moves must still find its
    own home)."""
    d = agent_dir.resolve()
    for _ in range(8):
        if (d / "agents" / "registry.json").is_file():
            return d
        if d.parent == d:
            break
        d = d.parent
    return None


def _rel(path: Path, base: Path) -> str:
    try:
        return str(path.relative_to(base))
    except ValueError:
        return str(path)


_FM_RE = re.compile(r"\A---\n(.*?)\n---\n", re.S)
_VER_TOP_RE = re.compile(r"^version:\s*[\"']?([0-9][0-9A-Za-z.\-+]*)[\"']?\s*$", re.M)
_VER_NESTED_RE = re.compile(r"^[ \t]+version:\s*[\"']?([0-9][0-9A-Za-z.\-+]*)[\"']?\s*$", re.M)


def _declared_version(path: Path) -> str | None:
    """The version a file declares about ITSELF, read from its frontmatter.

    Top-level `version:` wins; a nested one (e.g. under `metadata:`) is the
    fallback, because SKILL.md is a carrier with limited frontmatter and some
    bodies park their version one level down. Returns None when the file
    declares nothing -- which is a finding, not a pass: a body that will not
    say what version it is cannot be checked against the claim that it is 3.0.

    Deliberately NOT read from the `## Version` log in the body. A log records
    what was true at each version; the frontmatter carries what is true now,
    and those are different questions (W's SKILL.md carried `metadata.version:
    2.7.10` while its own log had reached 2.9.0 -- the file disagreeing with
    itself is exactly what this check exists to catch).
    """
    try:
        m = _FM_RE.match(path.read_text(encoding="utf-8", errors="replace"))
    except OSError:
        return None
    if not m:
        return None
    fm = m.group(1)
    hit = _VER_TOP_RE.search(fm) or _VER_NESTED_RE.search(fm)
    return hit.group(1) if hit else None


_ED25519_SPKI = bytes.fromhex("302a300506032b6570032100")


def _pem_problems(agent_dir: Path) -> list[str]:
    """1e. PEM drift gate (Mori-shin, 2026-09-23). Nine committed PEMs had
    drifted from their .bin while every tool read only the .bin. A PEM kept
    beside a key must decode to exactly that key; a retired one is a TOMBSTONE;
    anything else is a finding."""
    import base64

    problems: list[str] = []
    for pem in sorted(agent_dir.rglob("*.pem")):
        if pem.parent.name != "identity":
            continue
        rel = _rel(pem, agent_dir)
        text = pem.read_text("utf-8", errors="replace")
        if text.startswith("TOMBSTONE"):
            continue
        binf = pem.with_name(pem.name.replace("-public-key.pem", "-public-key.bin"))
        try:
            der = base64.b64decode("".join(line for line in text.splitlines() if line and not line.startswith("-----")))
        except Exception:
            der = b""
        if len(der) != 44 or not der.startswith(_ED25519_SPKI):
            problems.append(f"pem: {rel} is neither an ed25519 public key nor a TOMBSTONE")
        elif not binf.is_file():
            problems.append(f"pem: {rel} has no {binf.name} to be checked against")
        elif der[12:] != binf.read_bytes():
            problems.append(f"pem drift: {rel} decodes to a different key than {binf.name}")
    return problems


SIGN_CLI = Path(__file__).resolve().parent.parent / "skills" / "bonsai-garden-sign" / "bin" / "sign.mjs"
_SIGN_BLOCK_RE = re.compile(r"^sign:\s*$", re.M)


VERIFY_MANY = Path(__file__).resolve().parent / "verify-many.mjs"


def _node_many(jobs: list[tuple[str, Path]]) -> tuple[dict[tuple[str, str], dict], str | None, str]:
    """One node process over verify-many.mjs for every job: the seal verdicts (verify, verify-sidecar)
    and the finder's answers (find-sidecar, target-of). Returns (answers by (verb, file), why it could
    not run at all, the last stderr line). Core's own verifier (parity-tested against sign.py), for
    every seal of a body in ONE node process: verify-many.mjs runs the verdicts sign.mjs's `verify` / `verify-sidecar` run, and
    a parity test holds it to the CLI file by file. One process per seal cost 20 s a body
    (Baisai, 2026-09-27). Returns 'ok' or the failure line per job. A verifier that cannot run, or
    a job it gave no verdict for, is a failure, never a pass."""
    if not jobs:
        return {}, None, ""
    why = (
        "cannot verify: node not found"
        if shutil.which("node") is None
        else f"cannot verify: {SIGN_CLI} missing"
        if not SIGN_CLI.is_file()
        else f"cannot verify: {VERIFY_MANY} missing"
        if not VERIFY_MANY.is_file()
        else None
    )
    if why:
        return {}, why, ""

    # Shintai bodies are garden instances checked on the host that holds their keys, so this gate
    # names the garden key source. Core's own skills are verified by the published keys instead
    # (check-skill-conformance.py; skills/bonsai-garden-sign/references/trust-anchor.md).
    stdin = "".join(json.dumps({"verb": v, "file": str(p)}) + "\n" for v, p in jobs)
    keys = ["--keys", KEY_SOURCE] + (
        ["--pot", POT_DIR] + (["--expect-fp", POT_PIN] if POT_PIN else []) + (["--pins", POT_PINS] if POT_PINS else [])
        if KEY_SOURCE == "pot"
        else []
    )
    r = subprocess.run(
        ["node", str(VERIFY_MANY), *keys], input=stdin, capture_output=True, text=True, timeout=60 + 2 * len(jobs)
    )
    got: dict[tuple[str, str], dict] = {}
    for line in r.stdout.splitlines():
        try:
            d = json.loads(line)
            got[(d["verb"], d["file"])] = d
        except (ValueError, KeyError, TypeError):
            continue
    return got, None, (r.stderr.strip().splitlines() or [f"exit {r.returncode}"])[-1]


def _verify_many(jobs: list[tuple[str, Path]]) -> dict[tuple[str, Path], str]:
    """'ok' or the failure line per verify / verify-sidecar job (the process is _node_many's)."""
    got, why, tail = _node_many(jobs)
    out: dict[tuple[str, Path], str] = {}
    for v, p in jobs:
        d = got.get((v, str(p)))
        if why:
            out[(v, p)] = why
        elif d is None:
            out[(v, p)] = f"cannot verify: no verdict from verify-many.mjs for {p} ({tail})"
        elif d.get("ok") is True:
            if d.get("retired"):
                RETIRED.append(str(p))
            if d.get("retiredName"):
                RETIRED_NAME.append(str(p))
            if d.get("labSoftened"):
                POT_SOFTENED.append(str(p))
            out[(v, p)] = "ok"
        else:
            out[(v, p)] = " ".join(str(d.get("first") or "no output").split())
    return out


RETIRED: list[str] = []  # v1 seals accepted under the warn cutover — reported, never silent
RETIRED_NAME: list[
    str
] = []  # seals at the old name X.bonsaisig accepted while "sidecar-name" is warn (the dot-prefixed sidecar change phase 3)


class _Seals:
    """Where each seal of one body sits, as the one Node finder says (lib/sidecar-format.mjs through
    verify-many.mjs, one process for the body). the dot-prefixed sidecar change: since phase 1b a seal is written at
    `.X.bonsaisig`; `X.bonsaisig` is found, and its verdict reads retired-sidecar-name (phase 3, under
    seal-policy.json "sidecar-name"); both beside one file is `two-sidecars`, a
    finding, never a preference. This gate builds no sidecar name of its own: the rule has one Python
    home in core (package.py's, private to the builder) and one Node home, and a copy here would be
    the drift the spec forbids (Mori-shin's ruling, 2026-10-05)."""

    def __init__(self, agent_dir: Path):
        files = [p for p in sorted(agent_dir.rglob("*")) if p.is_file()]
        sidecars = [p for p in files if p.name.endswith(".bonsaisig")]
        targets = [p for p in files if not p.name.endswith(".bonsaisig")]
        got, why, tail = _node_many([("target-of", s) for s in sidecars] + [("find-sidecar", t) for t in targets])
        self.why = why or (None if got or not files else f"cannot verify: no answer from verify-many.mjs ({tail})")
        self._target: dict[Path, tuple[Path | None, str]] = {}
        self._find: dict[Path, tuple[str, Path | None]] = {}
        for s in sidecars:
            d = got.get(("target-of", str(s)))
            self._target[s] = (
                (None, self.why or "no answer")
                if d is None
                else (Path(d["target"]) if d.get("target") else None, str(d.get("status") or "error"))
            )
        for t in targets:
            d = got.get(("find-sidecar", str(t)))
            self._find[t] = (
                (self.why or "no answer", None)
                if d is None
                else (str(d.get("status") or "error"), Path(d["sidecar"]) if d.get("sidecar") else None)
            )

    def status(self, target: Path) -> str:
        """'ok' (one sidecar, either name) · 'two-sidecars' · 'no-sidecar' · or why it could not be asked."""
        return self._find.get(target, ("no-sidecar", None))[0]

    def target_of(self, sidecar: Path) -> tuple[Path | None, str]:
        """The file a sidecar seals (it may not exist), and 'ok' or why there is none ('ambiguous-sidecar')."""
        return self._target.get(sidecar, (None, "no answer"))


def _embedded_seal(path: Path) -> bool:
    try:
        m = _FM_RE.match(path.read_text(encoding="utf-8", errors="replace"))
    except OSError:
        return False
    return bool(m and _SIGN_BLOCK_RE.search(m.group(1)))


PNG_VERIFIER: list[str] | None = None  # set by --png-verifier
NOTES: dict[str, list[str]] = {}


def _countersign_target(sidecar: Path, owner: str, own: Path | None) -> str | None:
    try:
        import json

        d = json.loads(sidecar.read_text("utf-8"))
    except Exception:
        return None
    t = d.get("target") if isinstance(d, dict) else None
    # an own seal is named after its target (X.bonsaisig or .X.bonsaisig seals X, as the finder
    # reads it); a countersignature is named for the act and names its target inside
    if not (isinstance(t, str) and t) or (own is not None and Path(t).name == own.name):
        return None
    # ...and is another kin's word: the body's own key on a misnamed sidecar is
    # an orphan, not a countersignature
    if d.get("signer") in (None, "", owner):
        return None
    return t


def _png_sealed(path: Path) -> bool:
    """A BonsaiSign iTXt chunk — the embedded PNG seal. Core has no image
    verifier (a second definition of the pixel canonicalisation is refused in
    verify.mjs), so these are verified only by a caller-supplied tool."""
    try:
        b = path.read_bytes()
    except OSError:
        return False
    i = 8
    while i + 8 <= len(b):
        n = int.from_bytes(b[i : i + 4], "big")
        if b[i + 4 : i + 8] == b"iTXt" and b[i + 8 : i + 8 + n].startswith(b"BonsaiSign\x00"):
            return True
        i += 12 + n
    return False


def _png_verify(path: Path) -> str:
    r = subprocess.run([*PNG_VERIFIER, "verify", str(path)], capture_output=True, text=True, timeout=60)
    first = (r.stdout.strip().splitlines() or r.stderr.strip().splitlines() or ["no output"])[0]
    return "ok" if r.returncode == 0 and first.startswith("ok") else " ".join(first.split())


def _seal_problems(agent_dir: Path, about: Path | None, seals: _Seals, manifest: str | None = None) -> list[str]:
    problems: list[str] = []
    unverified_png: list[str] = []
    unverified_counter: list[str] = []
    retired_from = len(RETIRED)
    retired_name_from = len(RETIRED_NAME)
    if seals.why:
        return [f"seal: {seals.why}"]
    if (
        about is not None
        and about.suffix == ".md"
        and seals.status(about) == "no-sidecar"
        and not _embedded_seal(about)
    ):
        problems.append(
            f"unsealed: {_rel(about, agent_dir)} (the constitution carries a v2 seal: .{about.name}.bonsaisig)"
        )
    # One walk decides what to verify, one process verifies it, and the walk below reads the
    # verdicts in the same order: the findings are what the per-file loop found, not re-sorted.
    jobs: list[tuple[str, Path]] = []
    for path in sorted(agent_dir.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix == ".bonsaisig":
            target, _ = seals.target_of(path)
            if target is not None and target.is_file() and seals.status(target) == "ok":
                jobs.append(("verify-sidecar", target))
        elif path.suffix == ".md" and _embedded_seal(path) and seals.status(path) == "no-sidecar":
            jobs.append(("verify", path))
    verdicts = _verify_many(jobs)
    for path in sorted(agent_dir.rglob("*")):
        if not path.is_file():
            continue
        rel = _rel(path, agent_dir)
        # a nested body: a directory below the shintai root with its own identity/
        if (
            path.name == "agent.md"
            and path.parent != agent_dir
            and (path.parent / "identity").is_dir()
            and seals.status(path) == "no-sidecar"
        ):
            problems.append(f"unsealed: {rel} (a nested body's agent.md carries a detached seal)")
        if path.suffix == ".bonsaisig":
            target, st = seals.target_of(path)
            if target is None:
                problems.append(f"seal: {rel} [{st}] (which file this sidecar seals cannot be told)")
                continue
            counter = _countersign_target(path, agent_dir.name, target)
            # a countersignature names its target inside; it is a record of
            # another kin's word on a body-hash, not this file's own seal
            if counter is not None and not target.is_file():
                unverified_counter.append(f"{rel} (countersigns {counter})")
                continue
            if not target.is_file():
                problems.append(f"orphaned seal: {rel} (the file it seals is missing)")
                continue
            if seals.status(target) != "ok":
                continue  # two-sidecars: reported once, at the file itself
            v = verdicts[("verify-sidecar", target)]
        elif seals.status(path) == "two-sidecars":
            problems.append(
                f"seal: two-sidecars {rel} (a seal at both names beside one file; keep one, the dot-prefixed sidecar change)"
            )
            continue
        elif path.suffix == ".md" and _embedded_seal(path):
            if seals.status(path) == "ok":
                continue  # its sidecar governs, and is verified as a .bonsaisig above
            v = verdicts[("verify", path)]
        elif path.suffix.lower() == ".png" and _png_sealed(path):
            if PNG_VERIFIER is None:
                unverified_png.append(rel)
                continue
            v = _png_verify(path)
        else:
            continue
        if v != "ok":
            problems.append(f"seal: {v}")
    if manifest is not None and manifest != "ok":
        # An installed body (F-12, 2026-10-21). Each seal holds wherever its bytes are, so the install's moved seals read
        # ok and need no acceptance (the same-basename rule of 2026-10-14 is gone). What the install must still answer
        # for is its set: which bytes sit at which path, nothing missing and nothing extra. That is MANIFEST.json's,
        # verified by core, and a manifest that does not verify is a finding of its own.
        problems.append(f"manifest: the manifest does not verify: {manifest}")
    if len(RETIRED) > retired_from:
        NOTES.setdefault(str(agent_dir), []).append(
            f"WARN retired-v1: {len(RETIRED) - retired_from} v1 seal(s) accepted only until the cutover "
            f"(metadata unsigned; re-seal as v2): "
            + ", ".join(_rel(Path(x), agent_dir) for x in RETIRED[retired_from:])
        )
    if len(RETIRED_NAME) > retired_name_from:
        NOTES.setdefault(str(agent_dir), []).append(
            f"WARN retired-sidecar-name: {len(RETIRED_NAME) - retired_name_from} seal(s) at the old name "
            f"X.bonsaisig, accepted only while seal-policy.json says warn (fix: git mv X.bonsaisig "
            f".X.bonsaisig, or re-seal): "
            + ", ".join(_rel(Path(x), agent_dir) for x in RETIRED_NAME[retired_name_from:])
        )
    if unverified_counter:
        NOTES.setdefault(str(agent_dir), []).append(
            f"NOT VERIFIED: {len(unverified_counter)} countersignature(s) over a named target, "
            f"not this body's own seals (a detached countersign does not survive its "
            f"target's move): " + ", ".join(unverified_counter)
        )
    if unverified_png:
        NOTES.setdefault(str(agent_dir), []).append(
            f"NOT VERIFIED: {len(unverified_png)} PNG seal(s) — core has no image verifier; "
            f"pass --png-verifier '<python3 path/to/sign.py>' to check them: " + ", ".join(unverified_png)
        )
    return problems


_FRONTMATTER = re.compile(r"\A---[ \t]*\n(.*?)\n---[ \t]*(?:\n|\Z)", re.S)
_PRESENCE_TYPE = re.compile(r"^type:[ \t]*[\"']?presence[\"']?[ \t]*$", re.M)


def _is_presence(path: Path) -> bool:
    """A presence file is one whose frontmatter says `type: presence` (the
    metadata schema's type), whatever it is called."""
    if path.suffix != ".md":
        return False
    try:
        head = path.read_text(encoding="utf-8", errors="replace")[:4000]
    except OSError:
        return False
    fm = _FRONTMATTER.match(head)
    return bool(fm and _PRESENCE_TYPE.search(fm.group(1)))


def _owning_body(path: Path, agent_dir: Path) -> Path:
    """The nearest directory at or above path's parent, inside agent_dir, that is a
    body: the shintai root, or a nested body (its own agent.md beside identity/, as
    the seal check above reads it) -- so agents/baisai/fuji-shin/ is held to its own
    references/, not Baisai's."""
    for d in path.parents:
        if d == agent_dir or ((d / "agent.md").is_file() and (d / "identity").is_dir()):
            return d
        if d == agent_dir:
            break
    return agent_dir


# 1g. Owner seals. The gardener, 2026-10-24: "every file within a shintai should have the owner seal, not a custodian
# seal. If we need a kin to seal their own shintai files we need to invoke them and ask them to sign it." One definition,
# read here on disk and by package.py on what a build ships.
GARDENERS_FILES = ("memory/identity.md", "memory/strategic-context.md")  # AGENTS.md: "The gardener owns identity.md
# and strategic-context.md". Reported as his, awaiting his own seal, never refused, until he rules on them.
OWNER_SEALS = "warn"  # on disk: warn, so a kin can still wake and seal their files; --owner-seals refuse, and the builder, refuse
_CREDIT_MOD = None


def _credit_mod():
    """core's tools/credit.py, the one definition of who a file's header credits (and so which role a seal infers)."""
    global _CREDIT_MOD
    if _CREDIT_MOD is None:
        import importlib.util

        spec = importlib.util.spec_from_file_location("garden_credit", Path(__file__).resolve().parent / "credit.py")
        _CREDIT_MOD = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_CREDIT_MOD)
    return _CREDIT_MOD


ATTESTATION = re.compile(r"identity/bunshin-attestation(?:-([a-z0-9][a-z0-9-]*))?\.md")


def _parents_of(body: Path, kin: str) -> set[str]:
    """The kin's parents as the garden's registry names them ("zensai + tasai", "hissai (East) + eisai (West)"), read
    from the nearest agents/registry.json above the body; none found, none named."""
    for p in [body, *body.parents]:
        reg = p / "registry.json" if p.name == "agents" else p / "agents" / "registry.json"
        if not reg.is_file():
            continue
        try:
            rows = json.loads(reg.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return set()
        rows = rows.get("agents", []) if isinstance(rows, dict) else rows
        row = next((a for a in rows if isinstance(a, dict) and a.get("slug") == kin), {})
        found = (re.match(r"\s*([a-z0-9][a-z0-9-]*)", part) for part in str(row.get("parent") or "").split("+"))
        return {m.group(1) for m in found if m}
    return set()


def _parent_attests(f: Path, body: Path, kin: str, signer) -> bool:
    """A bunshin's attestation sealed by the attesting parent: the one exception to the owner rule (the gardener,
    2026-10-24: "this attestation should semantically be signed by the 'parent(s)' (=anchor). That's a legitimate
    exception to the rule. Pls add it"). Only identity/bunshin-attestation*.md, only a parent the registry names, a file
    named for one parent only by that parent, and the header's tended-by that same parent."""
    m = ATTESTATION.fullmatch(f.relative_to(body.resolve()).as_posix())
    if not m or not signer or signer not in _parents_of(body.resolve(), kin):
        return False
    if m.group(1) and m.group(1) != signer:
        return False
    try:
        head = re.match(r"---\n(.*?)\n---", f.read_text(encoding="utf-8"), re.S)
    except (OSError, UnicodeDecodeError):
        return False
    tended = re.search(r"^tended-by:\s*([a-z0-9][a-z0-9-]*)\s*$", head.group(1), re.M) if head else None
    return bool(tended and tended.group(1) == signer)


def owner_seal_findings(agent_dir: Path, sidecar_of, only=None) -> list[dict]:
    """Every file of a body without the owner seal of the body's kin: a v2 sidecar whose role is owner and whose signer is
    the kin the body belongs to (a nested body's files, such as agents/baisai/fuji-shin/: that body's kin). `sidecar_of(path)`
    is the caller's finder (this gate's Node finder on disk, the builder's own at build), so no sidecar name is built
    here. `only`: the files to judge (the builder: what ships); None: every file under the body.

    Each finding: {"rel", "kin", "seal" (the seal on the file now), "action" (what the kin's own seat must do), "his"}. `his`
    marks the gardener's own files (GARDENERS_FILES), which no kin seals. The action reads the file's credit the way a
    seal infers the role: a header crediting the kin needs only the re-seal; a file crediting no one (an image, a key,
    a page) needs --role owner said out loud; a header crediting someone else must change first, or the file is not the
    kin's; a SKILL.md credits through the body's identity document."""
    cm = _credit_mod()
    root = agent_dir.resolve()
    files = sorted(
        p
        for p in (only if only is not None else root.rglob("*"))
        if Path(p).is_file() and not Path(p).name.endswith(".bonsaisig") and Path(p).name != ".DS_Store"
    )
    out: list[dict] = []
    for f in files:
        f = Path(f).resolve()
        try:
            rel = f.relative_to(root).as_posix()
        except ValueError:
            continue  # not in this body
        if ".git" in Path(rel).parts:
            continue
        body = _owning_body(f, root)
        kin = root.name if body == root else body.name
        side = sidecar_of(f)
        seal = "no seal"
        if side is not None and Path(side).is_file():
            try:
                d = json.loads(Path(side).read_text(encoding="utf-8"))
            except (OSError, ValueError):
                d = {}
            if not isinstance(d, dict):
                d = {}
            if d.get("format") != "bonsaisig/2":
                seal = f"not a seal v2 ({d.get('format') or 'unreadable'})"
            elif d.get("role") == "owner" and d.get("signer") == kin:
                continue  # the kin's own owner seal: what the rule asks
            elif d.get("role") == "owner" and _parent_attests(f, body, kin, d.get("signer")):
                continue  # a bunshin's attestation, sealed by the attesting parent: the one exception
            else:
                seal = f"{d.get('role') or 'no role'}: {d.get('signer') or 'no signer'}"
        his = rel in GARDENERS_FILES or (body != root and f.relative_to(body.resolve()).as_posix() in GARDENERS_FILES)
        if his:
            action = "his file: awaiting his own seal (AGENTS.md: the file is the gardener's); no kin seals his files"
        else:
            try:
                text = f.read_bytes().decode("utf-8")
            except (OSError, UnicodeDecodeError):
                text = ""
            who, conflict = cm.credit_info(text, f.relative_to(body.resolve()).as_posix(), body.resolve())
            via = " (through the body's identity document)" if f.name == "SKILL.md" else ""
            if conflict:
                action = f"settle the header first: tended-by and authorship disagree ({', '.join(sorted(who))})"
            elif kin in who:
                action = f"{kin} re-seals the file as owner (the header credits {kin}{via})"
            elif not who:
                action = f"{kin} seals the file with --role owner, said out loud (the file credits no one{via})"
            else:
                action = (
                    f"the header credits {', '.join(sorted(who))}{via}, not {kin}: the header changes to {kin} and {kin} "
                    f"re-seals the file, or the file is not {kin}'s and leaves the body"
                )
        out.append({"rel": rel, "kin": kin, "seal": seal, "action": action, "his": his})
    return out


def owner_seal_lines(findings: list[dict]) -> tuple[list[str], list[str]]:
    """(the kin's, the gardener's) one line per finding: '<rel> [<seal now>]'."""
    mine = [f"{x['rel']} [{x['seal']}]" for x in findings if not x["his"]]
    his = [f"{x['rel']} [{x['seal']}]" for x in findings if x["his"]]
    return mine, his


FILL_GREETING = (
    Path(__file__).resolve().parent.parent / "skills" / "bonsai-garden-portrait" / "scripts" / "fill-greeting.py"
)
CORE_ROOT = Path(__file__).resolve().parent.parent
GREETING_ROOTS: list[Path] = []  # --greeting-root; default: the body's own repo, then core
GREETING_FAILS_FROM = (3, 1, 0)  # the Aruji, 2026-09-29: "make this the canonical intro for all.
# mandatory. not-optional." Warn before Shintai 3.1.0, fail from it.

# 1f. A SKILL.md carries no frontmatter id: the id is the seal's (AGENTS.md, Every kin, "A SKILL.md's shape"; the gardener's
# yes, 2026-10-24). Core already said so three ways (ulid.py's NO_ID_NAMES, validate-metadata's skill-extra-field,
# check-skill-conformance rule 1), and this gate passed 19 kin bodies whose SKILL.md carried one, each different from the
# seal's id. A failure: the 19 were swept before this line refused anything, so the line blocks no body conformant before.
_FM_ID_RE = re.compile(r"^[ \t]*id:[ \t]*[\"']?([^\s\"']+)", re.M)


STAMP_PREFIX = "> Installed build:"  # package.py writes it as the first body line of a packaged SKILL.md


def _is_stamped(skill: Path) -> bool:
    """True when SKILL.md is an installed body: its first line after the frontmatter is the packager's build stamp."""
    try:
        m = re.match(r"^---\n.*?\n---\n(.*)$", skill.read_text(encoding="utf-8"), re.S)
    except OSError:
        return False
    return bool(m) and m.group(1).lstrip("\n").startswith(STAMP_PREFIX)


MANIFEST_VERIFIER = (
    Path(__file__).resolve().parent.parent / "skills" / "bonsai-garden-core-plugin" / "scripts" / "verify-manifest.mjs"
)
SIGN_SKILL = Path(__file__).resolve().parent.parent / "skills" / "bonsai-garden-sign"


def _manifest_verdict(agent_dir: Path) -> str:
    """'ok' when an installed body's MANIFEST.json verifies with CORE's verifier, else the reason. Never the package's own
    scripts/integrity/ copy: a claim inside the thing being checked is not a check. Core's verify-manifest.mjs expects
    the signer beside it, as the package lays it out, so it is staged that way in a temp folder (Bonsai, 2026-10-14)."""
    if not (agent_dir / "MANIFEST.json").is_file():
        return "no MANIFEST.json"
    if KEY_SOURCE == "pot":
        return "verify-manifest has no pot key source"
    if not MANIFEST_VERIFIER.is_file() or not SIGN_SKILL.is_dir():
        return "core's verify-manifest.mjs or bonsai-garden-sign is missing"
    import tempfile

    with tempfile.TemporaryDirectory(prefix="conf-manifest-") as tmp:
        shutil.copy2(MANIFEST_VERIFIER, Path(tmp) / MANIFEST_VERIFIER.name)
        (Path(tmp) / "bonsai-garden-sign").symlink_to(SIGN_SKILL, target_is_directory=True)
        try:
            r = subprocess.run(
                ["node", str(Path(tmp) / MANIFEST_VERIFIER.name), "--dir", str(agent_dir), "--keys", KEY_SOURCE],
                capture_output=True,
                text=True,
                timeout=120,
            )
        except (OSError, subprocess.TimeoutExpired) as e:
            return f"verify-manifest did not answer ({e})"
    first = (r.stdout.strip().splitlines() or r.stderr.strip().splitlines() or ["no output"])[0]
    return "ok" if r.returncode == 0 and first.startswith("ok") else " ".join(first.split())


def _ver_tuple(v: str | None) -> tuple[int, ...] | None:
    m = re.match(r"^(\d+)\.(\d+)\.(\d+)", v or "")
    return tuple(int(x) for x in m.groups()) if m else None


def _greeting_problem(agent_dir: Path, version: str | None) -> str | None:
    """Fill the kin's greeting exactly as a seat would, with placeholder env values. A refusal is the
    reason the seat would fall back to the plain-text card. Returns a warning or a
    problem string, prefixed WARN/FAIL."""
    if not FILL_GREETING.is_file():
        return "FAIL greeting: fill-greeting.py not found in core, the greeting cannot be checked"
    roots = GREETING_ROOTS or [r for r in dict.fromkeys([_find_repo_root(agent_dir), CORE_ROOT]) if r]
    import tempfile

    with tempfile.TemporaryDirectory() as td:
        cmd = [sys.executable, str(FILL_GREETING), "--slug", agent_dir.name]
        for r in roots:
            cmd += ["--garden", str(r)]
        cmd += [
            "--subtitle",
            "-",
            "--version",
            version or "0.0.0",
            "--location",
            "-",
            "--at-local",
            "-",
            "--host",
            "-",
            "--harness",
            "-",
            "--model",
            "-",
            "--mcp",
            "-",
            "--skill",
            "-",
            "--permission",
            "default",
            "--out",
            str(Path(td) / "g.html"),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0:
        return None
    why = (r.stderr.strip().splitlines() or ["no reason given"])[-1].replace("fill-greeting: REFUSED — ", "")
    vt = _ver_tuple(version)
    level = "FAIL" if vt is not None and vt >= GREETING_FAILS_FROM else "WARN"
    return f"{level} greeting does not render: {why}"


_STAMP_VERSION_RE = re.compile(r"^(\d+\.\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+?)?)-\d{8}T\d{4}Z\b")
_VERSION_PARTS_RE = re.compile(r"^(\d+\.\d+\.\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$")
# a build of the body's own version named in prose: M.m.p.N with an optional label (letters first, so the stamp's
# `-20261013T1001Z` is never read as one). Inside a code fence it is quoted text, not a claim; fences are dropped.
_BUILD_TOKEN_RE = re.compile(r"(?<![0-9A-Za-z.])(\d+\.\d+\.\d+\.\d+)(-[A-Za-z][0-9A-Za-z]*)?(?![0-9A-Za-z.])")


def _stamp_version(skill: Path) -> str | None:
    """The full version an installed body's stamp line carries (`3.0.0.7-rc` out of
    `> Installed build: 3.0.0.7-rc-20261013T1001Z · body …`), or None without a stamp."""
    try:
        m = re.match(r"^---\n.*?\n---\n(.*)$", skill.read_text(encoding="utf-8"), re.S)
    except OSError:
        return None
    if not m:
        return None
    first = m.group(1).lstrip("\n").split("\n", 1)[0]
    if not first.startswith(STAMP_PREFIX):
        return None
    hit = _STAMP_VERSION_RE.match(first[len(STAMP_PREFIX) :].strip())
    return hit.group(1) if hit else None


def _skill_prose(skill: Path) -> str:
    """SKILL.md below the frontmatter, the stamp line dropped, code fences dropped: what the carrier claims in prose."""
    try:
        text = skill.read_text(encoding="utf-8")
    except OSError:
        return ""
    m = re.match(r"^---\n.*?\n---\n(.*)$", text, re.S)
    body = (m.group(1) if m else text).lstrip("\n")
    if body.startswith(STAMP_PREFIX):
        body = body.split("\n", 1)[1] if "\n" in body else ""
    return re.sub(r"```.*?```", "", body, flags=re.S)


def version_lock_problems(agent_dir: Path) -> list[str]:
    """1b. The version lock, as one function, so it runs the same on a source tree, on an installed
    body and on package.py's stage (W, 2026-10-16: three numbers in one shipped body, and the
    check §Version lock promises had not run on the build).

    The Aruji's ruling, 2026-09-22: SKILL.md is a technical CARRIER with hard limits on the
    metadata it can hold; about-me.md is the SEMANTIC one. When the two disagree there is no
    single answer to "what version is this body", so "this is a 3.0 shintai" stops being a
    checkable claim and becomes a preference. Locking them makes the version a property of
    the BODY rather than of a file. Enforced rather than written down, because a rule that
    depends on someone remembering it is a rule that will eventually not be followed.

    - A source tree: SKILL.md's frontmatter and about-me's are exactly equal, label included.
    - An installed body (stamped by the packager): the frontmatter holds M.m.p only (the
      platform's three parts); the stamp line carries the full version. about-me ships byte for
      byte, so it must be the stamp's version, or its M.m.p where about-me declares only three
      parts (Bonsai, 2026-10-14: the label alone is no drift). A build or label about-me DOES
      declare must be the stamp's: the builder stamps the source's own declared build, so an
      honest install never differs there, and one that does was assembled from two bodies.
    - Either way: a build of the body's own version named in SKILL.md's prose must be the
      body's version. `**version 3.0.0.3**` in a 3.0.0.7-rc carrier is the lock broken from
      inside; a history belongs in references/changelog.md (AGENTS.md, Every kin).
    """
    problems: list[str] = []
    skill = agent_dir / "SKILL.md"
    refs = agent_dir / "references"
    about = next((refs / n for n in ABOUT_ME_GLOBS if (refs / n).is_file()), None) if refs.is_dir() else None
    if not skill.is_file() or about is None:
        return problems  # missing files are reported by the structure checks
    sv, av = _declared_version(skill), _declared_version(about)
    if sv is None:
        problems.append("undeclared version: SKILL.md declares no version in frontmatter")
    if av is None:
        problems.append(f"undeclared version: {_rel(about, agent_dir)} declares no version in frontmatter")
    stamped = _is_stamped(skill)
    full = (_stamp_version(skill) if stamped else sv) or sv
    if sv is not None and av is not None:
        if stamped:
            sp, ap_ = _VERSION_PARTS_RE.match(full or ""), _VERSION_PARTS_RE.match(av)
            if sp is None or ap_ is None:
                drift = _ver_tuple(sv) != _ver_tuple(av)
            else:
                drift = (
                    sp.group(1) != ap_.group(1)
                    or (ap_.group(2) is not None and ap_.group(2) != sp.group(2))
                    or (ap_.group(3) is not None and ap_.group(3) != sp.group(3))
                )
        else:
            drift = sv != av
        if drift:
            problems.append(
                f"version drift: SKILL.md says {full if stamped else sv}, {_rel(about, agent_dir)} says {av} "
                + ("(an installed body: the stamp's version, or its MAJOR.MINOR.PATCH alone) " if stamped else "")
                + "(they are version-locked -- the carrier and the constitution "
                "must answer 'what version is this body' the same way)"
            )
    mmp = _VERSION_PARTS_RE.match(full or "")
    if mmp is not None:
        own = mmp.group(1) + "."
        stale: dict[str, int] = {}
        for hit in _BUILD_TOKEN_RE.finditer(_skill_prose(skill)):
            tok = hit.group(1) + (hit.group(2) or "")
            if tok.startswith(own) and tok != full:
                stale[tok] = stale.get(tok, 0) + 1
        for tok, n in stale.items():
            problems.append(
                f"version lock: SKILL.md names {tok} in its prose{f' ({n} times)' if n > 1 else ''} as a build of its "
                f"own version, but the body is {full} (a stale build number in the carrier is the lock broken from "
                f"inside; a history belongs in references/changelog.md)"
            )
    return problems


def check_on_disk(agent_dir: Path) -> list[str]:
    """Returns a list of violation strings; empty list = conformant."""
    problems: list[str] = []
    slug = agent_dir.name

    if not agent_dir.is_dir():
        return [f"not a directory: {agent_dir}"]
    seals = _Seals(agent_dir)

    # 1. Required present
    for name in REQUIRED_TOP:
        if not (agent_dir / name).is_file():
            problems.append(f"missing required: {name}")
    for name in REQUIRED_DIRS:
        if not (agent_dir / name).is_dir():
            problems.append(f"missing required: {name}/")

    refs = agent_dir / "references"
    if refs.is_dir() and not any((refs / n).is_file() for n in ABOUT_ME_GLOBS):
        problems.append("missing required: about-me file under references/")
    # (if references/ itself is absent, that is already reported above)

    # 1b. Version lock -- SKILL.md and about-me must declare the SAME version: version_lock_problems, below.
    skill = agent_dir / "SKILL.md"
    # 1a. The integrity line first (AGENTS.md, Every kin; Bonsai's rehearsal, gap 78). A SKILL.md that cannot check itself
    # before anything in it is used is not a conformant body: the first thing after the frontmatter opens "> **Integrity first.**"
    if skill.is_file():
        try:
            txt = skill.read_text(encoding="utf-8")
            m = re.match(r"^---\n.*?\n---\n(.*)$", txt, re.S)
            body_text = (m.group(1) if m else txt).lstrip("\n")
            if body_text.startswith(
                STAMP_PREFIX
            ):  # an installed body: the packager's stamp line comes first, then the integrity line
                body_text = body_text.split("\n", 1)[1].lstrip("\n") if "\n" in body_text else ""
            if not body_text.startswith("> **Integrity first.**"):
                problems.append(
                    "SKILL.md has no integrity line: its first line after the frontmatter must open "
                    "\"> **Integrity first.**\" (AGENTS.md, Every kin), so the body checks itself before anything in it is used"
                )
        except OSError:
            pass
        # 1a'. A lean SKILL.md credits what its IDENTITY DOCUMENT credits (credit.mjs, Mori-shin's rule of 2026-09-24): the first of
        # references/identity.md, memory/identity.md. A kin with neither has a SKILL.md that credits no one, so an owner seal on
        # it silently reads custodian (Bonsai's gap 85, Mori-shin's ruling 2026-10-11). A note, not a failure: six bodies in the origin's garden
        # (six bodies in the origin's garden) predate it.
        if not any((agent_dir / rel).is_file() for rel in ("references/identity.md", "memory/identity.md")):
            NOTES.setdefault(str(agent_dir), []).append(
                "no identity document (references/identity.md, else memory/identity.md): this SKILL.md credits what its identity "
                "document credits, so it credits no one and an owner seal on it reads custodian; carry one with tended-by"
            )
        # 1a''. Version history lives in references/changelog.md, never in SKILL.md (AGENTS.md, Every kin; spec v3.0.11): SKILL.md
        # loads at every activation, a history is read only when asked. A note now, a failure when the crew has been swept.
        try:
            m2 = re.search(
                r"^## (?:Version|Version history|Changelog)\b.*?(?=^## |\Z)",
                skill.read_text(encoding="utf-8"),
                re.S | re.M,
            )
            if m2 and len(m2.group(0)) > 800:
                NOTES.setdefault(str(agent_dir), []).append(
                    f"version history in SKILL.md ({len(m2.group(0))} chars): move the section verbatim to references/changelog.md "
                    "and leave one line (SKILL.md loads at every activation; the history is read only when asked)"
                )
        except OSError:
            pass
        # the constitution too (the gardener, 2026-10-13: "also factor out the changelog in all about.mes")
        try:
            ab = agent_dir / "references" / "about-me.md"
            if ab.is_file():
                m3 = re.search(
                    r"^## (?:Version|Version history|Changelog)\b.*?(?=^## |\Z)",
                    ab.read_text(encoding="utf-8"),
                    re.S | re.M,
                )
                if m3 and len(m3.group(0)) > 300:
                    NOTES.setdefault(str(agent_dir), []).append(
                        f"version history in references/about-me.md ({len(m3.group(0))} chars): move it verbatim to "
                        "references/changelog.md (tools/move-skill-history.py --doc about-me.md) and leave one line"
                    )
        except OSError:
            pass
        # 1f. No frontmatter id: in SKILL.md (_FM_ID_RE, above).
        try:
            fm = _FM_RE.match(skill.read_text(encoding="utf-8", errors="replace"))
        except OSError:
            fm = None
        hit = _FM_ID_RE.search(fm.group(1)) if fm else None
        if hit:
            problems.append(
                f"SKILL.md carries a frontmatter id ({hit.group(1)}): a SKILL.md's id is the seal's, never a frontmatter "
                "id: (AGENTS.md, Every kin, A SKILL.md's shape); take the line out and re-seal"
            )
    about = next((refs / n for n in ABOUT_ME_GLOBS if (refs / n).is_file()), None) if refs.is_dir() else None
    problems.extend(version_lock_problems(agent_dir))

    # 1c. SKILL.md seal: a detached .bonsaisig sidecar, never an embedded sign: block.
    # SKILL.md tolerates no extra frontmatter (the Aruji, 2026-09-23, relayed by W) --
    # that constraint is why the .bonsaisig sidecar exists in the first place. An
    # embedded sign: block in SKILL.md's own frontmatter is the exact anti-pattern
    # that broke skill loading before; a missing or non-verifying sidecar means the
    # body is unsealed, which is not the same as conformant.
    skill = agent_dir / "SKILL.md"
    if skill.is_file():
        try:
            skill_text = skill.read_text(encoding="utf-8", errors="replace")
        except OSError:
            skill_text = ""
        m = _FM_RE.match(skill_text)
        if m and re.search(r"^sign:\s*$", m.group(1), re.M):
            problems.append(
                "forbidden: SKILL.md carries an embedded sign: block "
                "(seals live in a detached .SKILL.md.bonsaisig sidecar, never embedded)"
            )
        if seals.status(skill) == "no-sidecar":
            problems.append("missing required: .SKILL.md.bonsaisig (SKILL.md must carry a detached seal)")

    # 1d. Seals verify. Presence is not a seal: the gate PASSed bodies whose
    # constitution and SKILL seals were both hash-mismatch (Chisai, 2026-09-23),
    # so step 5 of the sign-off had no check behind it. Every embedded sign: and
    # every .bonsaisig in the shintai is verified with core's own verifier; the
    # constitution must carry an embedded seal; a nested body's agent.md (a
    # shared shintai, e.g. fuji-shin inside baisai) must carry a sidecar —
    # otherwise its constitution sits outside every seal (Fuji-shin, same day).
    problems.extend(
        _seal_problems(
            agent_dir, about, seals, _manifest_verdict(agent_dir) if skill.is_file() and _is_stamped(skill) else None
        )
    )
    problems.extend(_pem_problems(agent_dir))

    # 1g. Owner seals (the gardener, 2026-10-24). On disk a warning by default, so a kin can still wake and seal their
    # own files; --owner-seals refuse fails it; the builder refuses to ship any of them. Skipped when the finder could
    # not run (1d already says so): an unanswered finder would read every file as unsealed.
    if not seals.why:
        found = {p.resolve(): s for p, (_st, s) in seals._find.items()}
        mine, his = owner_seal_lines(owner_seal_findings(agent_dir, lambda p: found.get(Path(p).resolve())))
        if mine and OWNER_SEALS == "refuse":
            problems.extend(f"owner seal: {x}" for x in mine)
        elif mine:
            NOTES.setdefault(str(agent_dir), []).append(
                f"WARN owner seals: {len(mine)} file(s) of this shintai do not carry their kin's owner seal, and the "
                f"builder refuses to ship them (the gardener, 2026-10-24): " + ", ".join(mine)
            )
        if his:
            NOTES.setdefault(str(agent_dir), []).append(
                f"his: {len(his)} file(s) the gardener owns, awaiting his own seal: " + ", ".join(his)
            )

    # 1e. The greeting renders (the greeting widget rule; mandatory since 2026-09-29). Warn before 3.1.0, fail from it.
    g = _greeting_problem(agent_dir, _declared_version(skill) if skill.is_file() else None)
    if g and g.startswith("FAIL "):
        problems.append(g[5:])
    elif g:
        NOTES.setdefault(str(agent_dir), []).append(g[5:] + " (fails from Shintai 3.1.0)")

    # Walk the whole shintai once for the forbidden / misplaced / leak checks.
    for path in agent_dir.rglob("*"):
        rel = _rel(path, agent_dir)

        if path.is_file():
            # 2. Forbidden absent
            if path.name == "README.md":
                problems.append(f"forbidden: {rel} (Anthropic p.10: no README.md in a skill folder)")
            if path.suffix == ".bak" or path.name.endswith(".bak"):
                problems.append(f"forbidden: {rel} (.bak does not travel)")

            # 3. Misplaced: patterns.md inside memory/
            if path.name == "patterns.md" and "memory" in path.relative_to(agent_dir).parts[:-1]:
                problems.append(f"misplaced: {rel} (patterns.md belongs at top level, not inside memory/)")

            # 3. Misplaced: heritage anywhere but references/
            if (
                path.stem == "heritage"
                or path.name.startswith("heritage.")
                or path.name.endswith("-heritage.html")
                or path.name.endswith("-heritage.md")
            ):
                parts = path.relative_to(agent_dir).parts
                if not (len(parts) >= 2 and parts[0] == "references"):
                    problems.append(
                        f"misplaced: {rel} (heritage belongs under references/, not {'/'.join(parts[:-1]) or '.'})"
                    )

            # 3. Misplaced: a presence file anywhere but its body's references/presence.md
            if _is_presence(path):
                body = _owning_body(path, agent_dir)
                if path.relative_to(body).parts != ("references", "presence.md"):
                    problems.append(
                        f"misplaced: {rel} (presence belongs at references/presence.md "
                        f"of its body, spec Sec. The canonical structure)"
                    )

        if path.is_dir() and path.name == "home" and path != agent_dir:
            # 4. Structural leak: home/ nested inside the shintai
            problems.append(
                f"structural leak: {rel} nested inside the shintai (home/{slug}/ must be a sibling, never a subtree)"
            )

    # Sibling home/<slug>/ tree, if the repo root is findable -- heritage
    # misplacement is the one pattern worth catching there; home/ has its
    # own rules otherwise (spec Sec. "The home/ layer") and is not policed
    # further by this gate.
    repo_root = _find_repo_root(agent_dir)
    if repo_root is not None:
        home_dir = repo_root / "home" / slug
        if home_dir.is_dir():
            for path in home_dir.rglob("*"):
                if path.is_file() and (
                    path.stem == "heritage"
                    or path.name.startswith("heritage.")
                    or path.name.endswith("-heritage.html")
                    or path.name.endswith("-heritage.md")
                ):
                    problems.append(
                        f"misplaced: {_rel(path, repo_root)} (heritage belongs under references/, not home/{slug}/...)"
                    )

    return problems


def _packaged_entries(target: Path) -> list[str]:
    """Returns a flat list of forward-slash relative paths inside a packaged
    artifact, whether it's a staged directory or a .zip/.skill archive."""
    if target.is_dir():
        return [_rel(p, target).replace("\\", "/") for p in target.rglob("*") if p.is_file()]
    if zipfile.is_zipfile(target):
        with zipfile.ZipFile(target) as zf:
            return [n for n in zf.namelist() if not n.endswith("/")]
    return []


# The only memory files a packaged body may carry, and only frontmatter-only.
MEMORY_SKELETON = ("working-state.md", "MEMORY.md")
# The one body allowed initial memory (named, never a class — see rule 5).
INITIAL_MEMORY_BODIES = ("bonsai", "w")


def _packaged_read(target: Path, entry: str) -> str:
    try:
        if target.is_dir():
            return (target / entry).read_text("utf-8", errors="replace")
        with zipfile.ZipFile(target) as zf:
            return zf.read(entry).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _frontmatter_only(text: str) -> bool:
    """True if the file is empty, or a frontmatter block with nothing after it."""
    t = text.strip()
    if not t:
        return True
    if not t.startswith("---\n"):
        return False
    end = t.find("\n---", 4)
    return end != -1 and not t[end + 4 :].strip()


def _packaged_slug(target: Path, entries: list[str]) -> str | None:
    """The body's slug from the packaged SKILL.md's own `name:` (root or one wrapper deep)."""
    for e in sorted(entries, key=lambda x: x.count("/")):
        if e.split("/")[-1] == "SKILL.md" and e.count("/") <= 1:
            m = re.search(r"^name:\s*[\"']?([A-Za-z0-9._-]+)", _packaged_read(target, e), re.M)
            if m:
                return m.group(1)
    return None


def _packaged_version_lock(target: Path, entries: list[str]) -> list[str]:
    """1b on a built artifact: the packaged SKILL.md and about-me (root, or one wrapper deep) are laid out in a
    temp folder exactly as installed, and version_lock_problems reads them there. A zip is read, never unpacked
    in place."""
    import tempfile

    wanted = {}
    for e in entries:
        parts = e.split("/")
        for cand in [parts, parts[1:]] if len(parts) > 1 else [parts]:
            if cand == ["SKILL.md"] or (len(cand) == 2 and cand[0] == "references" and cand[1] in ABOUT_ME_GLOBS):
                wanted.setdefault("/".join(cand), e)
    if "SKILL.md" not in wanted:
        return []
    with tempfile.TemporaryDirectory(prefix="conf-lock-") as tmp:
        body = Path(tmp) / "body"
        for rel, e in wanted.items():
            (body / rel).parent.mkdir(parents=True, exist_ok=True)
            (body / rel).write_text(_packaged_read(target, e), encoding="utf-8")
        return [f"{p} (packaged)" for p in version_lock_problems(body)]


def check_packaged(target: Path) -> list[str]:
    problems: list[str] = []
    if not target.exists():
        return [f"not found: {target}"]

    entries = _packaged_entries(target)
    if not entries and not target.is_dir() and not zipfile.is_zipfile(target):
        return [f"not a directory or a zip/.skill archive: {target}"]
    initial_memory = _packaged_slug(target, entries) in INITIAL_MEMORY_BODIES
    problems.extend(_packaged_version_lock(target, entries))

    for entry in entries:
        parts = entry.split("/")
        # Drop a possible single top-level wrapper dir (build-skill-zips.sh
        # stages every .skill as <slug>/... at the zip root) before judging
        # against memory/ and home/, so this check works on both a raw
        # staged agents/<slug>/ copy and a wrapped .skill archive.
        candidates = [parts, parts[1:]] if len(parts) > 1 else [parts]

        for cand in candidates:
            if not cand:
                continue
            if cand[0] == "memory":
                rest = cand[1:]
                if initial_memory:
                    if rest and rest[0] == "journal":
                        problems.append(f"leak: {entry} (Bonsai carries initial memory, never a journal)")
                elif len(rest) == 1 and rest[0] in MEMORY_SKELETON:
                    if not _frontmatter_only(_packaged_read(target, entry)):
                        problems.append(
                            f"leak: {entry} (the memory skeleton ships frontmatter only -- "
                            f"this one carries body content; the memory lives in pot)"
                        )
                else:
                    problems.append(
                        f"leak: {entry} (a packaged memory/ holds only the empty skeleton, "
                        f"{' and '.join(MEMORY_SKELETON)}, frontmatter only; the memory lives in pot)"
                    )
                break
            if cand[0] == "home":
                problems.append(f"leak: {entry} (home/ must never appear in a packaged artifact)")
                break

    # de-dupe while preserving order (the top-level-strip loop can double-report)
    seen = set()
    deduped = []
    for p in problems:
        if p not in seen:
            seen.add(p)
            deduped.append(p)
    return deduped


KEY_SOURCE = "garden"  # set from --keys in main(); garden stays the default (Mori-shin's choice)
POT_DIR: str | None = None  # --keys pot --pot DIR (both, or neither)
POT_PIN: str | None = None  # --expect-fp
POT_PINS: str | None = None  # --pins FILE: each seal's signer pinned by their own fingerprint (the gardener's pin file)
POT_SOFTENED: list[str] = []  # seals a lab-preview pot accepted under its softer custody rule, said on every run


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("targets", nargs="+", help="agent dir(s), or artifact(s) with --packaged")
    ap.add_argument(
        "--keys",
        choices=("garden", "published", "pot"),
        default="garden",
        help="where signers' keys come from (default: garden, the host that holds them). "
        "A body that lives in core carries other kin's seals whose keys core does not "
        "hold: check it with --keys published (Bonsai's finding, 2026-09-24).",
    )
    ap.add_argument(
        "--pot",
        metavar="DIR",
        help="with --keys pot: the pot's directory. A pot's registry vouching for the pot's own files is "
        "internal consistency, not identity: the pot is NAMED (never inferred), trusted only if its "
        "garden.json says lab-preview: true or the signer is pinned (--expect-fp), and a pass reads "
        "POT-PASS, never PASS (Mori-shin's ruling, 2026-10-11)",
    )
    ap.add_argument(
        "--expect-fp",
        metavar="FP32",
        dest="expect_fp",
        help="with --keys pot --pot: pin the signer's 32-hex fingerprint, the trust for a pot that is not lab-preview",
    )
    ap.add_argument(
        "--pins",
        metavar="FILE",
        help="with --keys pot --pot, in place of --expect-fp: the gardener's pin file ({\"pins\": {slug: fp32}}), so each "
        "seal is pinned by its own signer's fingerprint. A body holds seals by more than one signer, and one --expect-fp "
        "pins one of them (the 0.8.2 acceptance run, 2026-10-17)",
    )
    ap.add_argument(
        "--packaged",
        action="store_true",
        help="treat targets as built artifacts (staged dir or .zip/.skill), not on-disk shintai",
    )
    ap.add_argument(
        "--png-verifier",
        metavar="CMD",
        help="command that verifies an embedded PNG seal as `CMD verify <file>` "
        "(e.g. 'python3 tools/sign.py'); without it PNG seals are reported NOT VERIFIED",
    )
    ap.add_argument(
        "--greeting-root",
        action="append",
        default=[],
        metavar="DIR",
        help="garden root(s) the greeting fill searches, in order (default: the body's own repo, then core)",
    )
    ap.add_argument(
        "--owner-seals",
        choices=("warn", "refuse"),
        default="warn",
        help="1g, owner seals: warn (the default on disk, so a body's own seat can still wake and seal) or refuse (the gate "
        "as the builder holds)",
    )
    args = ap.parse_args()
    global OWNER_SEALS
    OWNER_SEALS = args.owner_seals
    global GREETING_ROOTS
    GREETING_ROOTS = [Path(x) for x in args.greeting_root]
    global KEY_SOURCE, POT_DIR, POT_PIN, POT_PINS
    if args.keys == "pot" and not args.pot:
        ap.error("--keys pot needs --pot <dir>: the pot is named, never inferred from where the body sits")
    if args.pot and args.keys != "pot":
        ap.error("--pot <dir> needs --keys pot: checking against a pot is a switch you throw on purpose")
    if args.expect_fp and args.keys != "pot":
        ap.error("--expect-fp pins a signer inside a pot: it needs --keys pot --pot <dir>")
    if args.expect_fp and not re.fullmatch(r"[0-9a-f]{32}", args.expect_fp):
        ap.error("--expect-fp is the signer's 32-hex fingerprint")
    if args.pins and (args.keys != "pot" or args.expect_fp):
        ap.error("--pins needs --keys pot --pot <dir>, and takes the place of --expect-fp (not both)")
    KEY_SOURCE = args.keys
    POT_DIR = args.pot
    POT_PIN = args.expect_fp
    POT_PINS = os.path.realpath(args.pins) if args.pins else None
    pot_lab = False
    pot_refusal = None
    if KEY_SOURCE == "pot":
        pd = Path(os.path.realpath(POT_DIR))
        POT_DIR = str(pd)
        # the trust question is answered once, by verify-many (core's pot-keys); this gate does not read garden.json itself
        got, why, tail = _node_many([("pot-trust", pd)])
        d = got.get(("pot-trust", str(pd)))
        if why or d is None:
            pot_refusal = (
                why or f"cannot decide whether the pot can be trusted: no answer from verify-many.mjs ({tail})"
            )
        elif d.get("ok") is not True:
            first = " ".join(str(d.get("first") or "").split())
            m = re.search(r"\[(pot-untrusted|not-a-pot)\]\s*(.*)$", first)
            pot_refusal = f"{m.group(1)}: {m.group(2)}" if m else first
        else:
            pot_lab = d.get("lab") is True
    global PNG_VERIFIER
    if args.png_verifier:
        PNG_VERIFIER = args.png_verifier.split()

    any_fail = False
    for raw in args.targets:
        # the kin's slug is their body directory's NAME: a bare '.' has none, so name the directory it is (no symlink resolving)
        target = Path(os.path.abspath(raw))
        if pot_refusal:  # refused whole: no seal is read against a pot that cannot stand
            any_fail = True
            print(f"FAIL {raw}")
            print(f"  - {pot_refusal}")
            continue
        POT_SOFTENED.clear()
        problems = check_packaged(target) if args.packaged else check_on_disk(target)

        if problems:
            any_fail = True
            print(f"FAIL {raw}")
            for p in problems:
                print(f"  - {p}")
        else:
            if KEY_SOURCE == "pot":
                # never PASS: AGENTS.md's integrity rule reads "ok / PASS", and a rehearsal's green must not satisfy it
                print(f"POT-PASS {raw}  keys: pot {POT_DIR}" + (" (lab-preview)" if pot_lab else " (pinned)"))
                if POT_SOFTENED:
                    print(
                        f"  ! POT-PASS (lab-preview: custody software-fallback accepted for {len(POT_SOFTENED)} seal"
                        f"{'s' if len(POT_SOFTENED) != 1 else ''})"
                    )
            else:
                print(f"PASS {raw}")
        for note in NOTES.get(str(target), []):
            print(f"  ! {note}")

    return 1 if any_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
