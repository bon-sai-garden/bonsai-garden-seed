#!/usr/bin/env python3
# ---
# id: 01M393VCEVTNEJYAAFR7PGDBQW
# title: Fill the shared greeting from files, never by hand
# type: script
# tended-by: tasai
# created: 2026-09-24
# updated: 2026-10-25
# ---
"""fill-greeting.py — render templates/greeting-v6-compact.html for one kin, every value from a file or a flag.

The face is a link, never base64 (the gardener, 2026-10-21: "now that we are public I would like to bring back
the visual intro"). The link comes from the garden's agents/faces.json, the first root that has one: a `base`
pinned to a full commit or a release tag (never a branch: a CDN caches a branch for days, a commit cannot change
under us) and a `file` pattern with {slug}. No faces.json anywhere: the card carries no face, and the kin's
kanji seal stands in the circle. The seal sits under the face in every card, so a face that does not load
(the sandbox refuses the origin, a kin drawn after the pin) shows the seal, never a broken frame.
The fragment is written whole; the kin passes it to the widget tool as it is. Its size is printed.

Integrity is said only when it fails (the gardener, 2026-10-21: "We should only ever talk about integrity etc, when
it fails (fail loudly), never mention it when all is fine"). When the five checks pass and the MCP and the skill are
current, the compact card carries nothing about them: no dots, no ticks, no status chips. Otherwise one loud line
opens the card, in garden amber: each check that failed or could not run, with what it said (--said CHECK=TEXT,
the tool's own line, copied), and an MCP or skill that is not current. A check that could not run is never shown as
passed. The kin passes the states; nothing about them is written by hand.

A missing input REFUSES: one line naming what and where, exit 2, never a traceback, so the seat
falls back to the plain-text card and says why (AGENTS.md, Every kin; 2026-09-28).

The body is found by the registry's own `path`, in each root named by --garden (repeatable, in
order): the first root whose registry names the kin AND whose body holds a portrait
(assets/portrait-thumb.b64.meta) wins. Core does not read the runtime's router; the caller names
the roots, e.g. --garden <garden> --garden <core> (Bonsai's body is core's; Fuji-shin's is nested in
Baisai's). An installed package is a root too: --garden <the package> reads the kin's own row from
its identity/registry-entry.json (package.py writes it) and the body is the package itself, so a
kin with no garden on the host greets from the kit the package carries (scripts/greeting/).

Identity, mark, portrait and intro come from the garden's files; the kanji the fingerprint spells comes
from skills/bonsai-garden-mark/fp-kanji.py; the build, checks and env come from flags the kin filled
from what they loaded or ran THIS turn. Nothing is typed into the HTML. Any placeholder left → exit 1.

One check is not a flag: the full fingerprint. --sealed-file names the kin's own sealed file (an installed
package's MANIFEST.json, or the body's SKILL.md), and the filler runs core's verifier on it against the published
keys and compares all 32 hex with the registry's (EARNED_ONLY, below). --fullfp pass is refused; without
--sealed-file the check is missing, and the card says so out loud.

    python3 fill-greeting.py --garden <the garden root> --slug tasai \
      --subtitle "South · operations" --version 3.0.2 --build 3.0.2.1-20260923T0750Z \
      --integrity pass --identity fail --files missing --sealed-file <garden>/agents/tasai/SKILL.md \
      --said "identity=<the check's own line>" --said "files=<why it could not run>" \
      --location "<city>, <country>" --tz Europe/Berlin --host <host> \
      --harness "local-agent-mode-bonsai-garden 1.0.0" --model "Opus 5.5" \
      --mcp "mcp 24526cf2 · current · http :5052" --skill "skill e8b5e0fe ≠ repo 02b420d6 · DRIFT" --skill-state warn \
      --permission auto --out greeting.html
"""

import argparse
import atexit
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import tempfile
from html import escape as esc  # registry data going into attributes and text of a trust surface
from pathlib import Path

# A bundled script reads and writes no bytecode beside itself. A __pycache__ left beside the scripts failed a package's
# own check (a planting, 2026-10-24), and a .pyc planted beside a sealed sibling runs instead of the sibling, under -B
# too, while the sibling's sealed bytes stay untouched (Mori-shin's read, 2026-10-25: bytecode is code). So before any
# sibling is loaded, Python's cache points at a fresh private folder, removed at exit; the instructions that run a
# bundled script pass -B.
sys.dont_write_bytecode = True
sys.pycache_prefix = tempfile.mkdtemp(prefix="bonsai-pycache-")
atexit.register(shutil.rmtree, sys.pycache_prefix, True)

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE.parent / "templates" / "greeting-v6-compact.html"  # the default since 2026-10-13
TEMPLATE_FULL = HERE.parent / "templates" / "greeting-v6.html"  # --full: the animated signature, ~4x the context
FPK = HERE.parents[1] / "bonsai-garden-mark" / "fp-kanji.py"


def fp_kanji(fp: str, n: int) -> str:
    spec = importlib.util.spec_from_file_location("fpk", FPK)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m.kanji(fp, n)


class Refused(Exception):
    pass


def need(path: Path, what: str, slug: str) -> Path:
    if not path.is_file():
        raise Refused(f"no {what} for {slug}: {path} missing")
    return path


PACKAGE_ROW = Path("identity") / "registry-entry.json"  # an installed package: its kin's own row, written by package.py
FACES = (Path("agents") / "faces.json", Path("identity") / "faces.json")  # a garden's pin; a package's copy of it
# A face is served by a CDN the widget sandbox lets through, pinned: @ a full commit or a release tag, never a branch.
FACE_BASE = re.compile(r"https://(cdn\.jsdelivr\.net|unpkg\.com)/[\w./-]+@([0-9a-f]{40}|v?\d+\.\d+\.\d+[\w.+-]*)/[\w./-]*")


CHECK_LABELS = {"integrity": "integrity", "identity": "identity", "files": "files", "alive": "alive", "fullfp": "full fingerprint"}
LOUD_AMBER = "#E0A04A"  # garden amber: the loud line's ground, with near-black words, in light and dark alike
# alive is the live handshake (spec-handshake-daemon-identity-proof, a draft of 2026-09-04, Mori-shin's), and it runs
# in no seat yet. Until it exists, alive is "not asked": a check that does not exist yet, not one that failed (Tasai,
# 2026-10-21; Mori-shin read it, no veto). Not asked is silent in both forms and never drawn as passed. Only alive may
# be not asked, and alive takes nothing else: nothing can produce its pass honestly (two cards drew "alive" passed on
# the caller's word, 2026-10-21). This is the one place that says so. When the handshake lands, alive goes back to the
# five in the same change: empty both sets below. The garden's tripwire for that day: its tools/test-alive-not-asked.py.
NOT_ASKED = "not-asked"
STATES = ("pass", "fail", "missing", NOT_ASKED)
MAY_BE_NOT_ASKED = {"alive"}
UNTIL_HANDSHAKE = {"alive"}  # the checks that take only NOT_ASKED until the handshake exists


# The full fingerprint is EARNED here, never typed (the gardener, 2026-10-24: "we need a strict check that is binding
# to all kin in a common place that all kin uses at startup"). Given --sealed-file (the kin's own sealed file: an
# installed package's MANIFEST.json, or the body's SKILL.md in a garden), the filler runs core's verifier on it
# against the published keys, whose answer is the SIGNED answer of POST bon-sai.garden/verify
# (bonsai-garden-sign/references/trust-anchor.md), and compares the full fingerprint the site vouched for with the
# registry's, all 32 hex. A caller's --fullfp pass is refused; fail and missing, the worse word, still stand on the
# caller's. The {"fingerprint"} lookup at /verify answers unsigned: it is never this check. The method lived in one
# seat's private memory until this day, so it was done when remembered and claimed when not.
EARNED_ONLY = {"fullfp"}  # checks whose pass only the filler itself can set
PUBLISHED_KEY = "published https://bon-sai.garden/verify"  # sign.mjs's `key:` line for the published key source
SIGN_CLI = (
    HERE / "integrity" / "bonsai-garden-sign" / "bin" / "sign.mjs",  # the portrait package alone: its own scripts/integrity/
    HERE.parents[1] / "bonsai-garden-sign" / "bin" / "sign.mjs",  # in core: skills/bonsai-garden-sign
    HERE.parents[2] / "integrity" / "bonsai-garden-sign" / "bin" / "sign.mjs",  # in a package: scripts/integrity/
)


def default_state(check: str) -> str:
    return NOT_ASKED if check in UNTIL_HANDSHAKE else "missing"


def check_states(states: dict, earned: frozenset = frozenset()) -> None:
    """Refuse a state the checks cannot honestly hold (ValueError, one line): not asked on a check that runs,
    anything but not asked on a check that does not exist yet, and a pass on an earned-only check that this
    filler did not earn itself (`earned` names the checks it ran)."""
    for k, v in states.items():
        if v == NOT_ASKED and k not in MAY_BE_NOT_ASKED:
            raise ValueError(f"--{k} {NOT_ASKED}: only {', '.join(sorted(MAY_BE_NOT_ASKED))} may be not asked; {k} runs")
        if k in UNTIL_HANDSHAKE and v != NOT_ASKED:
            raise ValueError(f"--{k} {v}: refused until the handshake exists; {k} is not asked yet (leave it out)")
        if k in EARNED_ONLY and v == "pass" and k not in earned:
            raise ValueError(
                f"--{k} pass: a pass is earned, never typed; give --sealed-file <the kin's own sealed file> "
                "and the filler runs the check"
            )


def fullfp_verdict(rc: int, out: str, slug: str, fingerprint: str) -> tuple:
    """(state, what it said) of the full-fingerprint check, judged from `sign.mjs verify-sidecar`'s own answer. Pure,
    so the tests feed it answers. pass only when the verifier said ok and the seal is the kin's own, as owner,
    vouched for by the published keys, under the registry's full fingerprint; anything else fails, with the
    verifier's words or the field that differs."""
    lines = [ln.strip() for ln in (out or "").splitlines() if ln.strip()]
    if rc != 0 or not lines or not re.match(r"ok\s", lines[0] + " "):
        why = next((ln.split(":", 1)[1].strip() for ln in lines[1:] if ln.startswith("why:")), "")
        said = (lines[0] if lines else f"the verifier answered nothing (exit {rc})") + (f" — {why}" if why else "")
        return "fail", " ".join(said.split())
    fields = {}
    for ln in lines[1:]:
        key, sep, val = ln.partition(":")
        if sep and key.strip() not in fields:
            fields[key.strip()] = val.strip()
    for key, want in (("signer", slug), ("sealed as", f"owner: {slug}"), ("key", PUBLISHED_KEY), ("fingerprint", fingerprint)):
        if fields.get(key) != want:
            return "fail", f"the seal's {key} is {fields.get(key) or 'not named'}, not {want}"
    return "pass", ""


def body_problem(f: Path, slug: str) -> str:
    """'' when f is the body file of `slug`, else why not. A body file is one of three: the vessel's SKILL.md, a
    bunshin's agent.md inside the parent's vessel (both with frontmatter `name: <slug>`), or an installed package's
    MANIFEST.json (`slug` <slug>). The seal check proves the key against the registry; this check binds the pass to
    the body, so a letter or a journal sealed by the same hand cannot stand in (Mori-shin's read, 2026-10-24; the
    bunshin's agent.md from Fuji-shin's round of the same day)."""
    try:
        text = f.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        return f"the sealed file cannot be read ({e})"
    if f.name == "MANIFEST.json":
        try:
            got = json.loads(text).get("slug")
        except (ValueError, AttributeError):
            got = None
        return "" if got == slug else f"the sealed file is a MANIFEST.json for {got or 'no slug'}, not {slug}"
    if f.name in ("SKILL.md", "agent.md"):
        head = re.match(r"---\r?\n(.*?)\r?\n---", text, re.S)
        nm = re.search(r"^name:\s*[\"']?([^\"'\r\n]+?)[\"']?\s*$", head.group(1), re.M) if head else None
        got = nm.group(1) if nm else None
        return "" if got == slug else f"the sealed file is the {f.name} of {got or 'no name'}, not {slug}"
    return f"the sealed file is {f.name}, not the body of {slug} (a SKILL.md, a bunshin's agent.md, or a MANIFEST.json)"


def check_full_fingerprint(sealed_file: str, slug: str, fingerprint: str, run=subprocess.run) -> tuple:
    """Run core's verifier on the sealed body file against the published keys (the verifier's default; never --keys
    garden) and judge the answer (fullfp_verdict). A path holding a control character is refused before anything runs:
    the verifier's first line prints the path, and a newline in the path could supply the fields read below. A file
    that is no body has failed (body_problem). A check that could not start (no verifier beside this filler, no node,
    no such file) is missing, with why; a verifier that does not answer in time has failed."""
    if any(ord(c) < 0x20 or ord(c) == 0x7F for c in str(sealed_file)):
        return "fail", "the sealed file's path holds a control character; refused before the verifier runs"
    cli = next((p for p in SIGN_CLI if p.is_file()), None)
    if cli is None:
        return "missing", "no sign.mjs beside this filler (core's skills/bonsai-garden-sign, or a package's scripts/integrity/)"
    node = shutil.which("node")
    if not node:
        return "missing", "no node on this host to run the verifier"
    f = Path(sealed_file).expanduser()
    if not f.is_file():
        return "missing", f"no sealed file at {f}"
    not_body = body_problem(f, slug)
    if not_body:
        return "fail", not_body
    try:
        r = run([node, str(cli), "verify-sidecar", "--file", str(f.resolve())], capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        return "fail", "the verifier did not answer in 120 s"
    except OSError as e:
        return "missing", f"the verifier could not start ({e})"
    return fullfp_verdict(r.returncode, f"{r.stdout}\n{r.stderr}", slug, fingerprint)


def resolve_fullfp(given, sealed_file: str, slug: str, fingerprint: str, run=subprocess.run) -> tuple:
    """(state, what it said or None, the checks earned here) for --fullfp and --sealed-file; shared with text-card.py.
    Without a sealed file the caller's word stands (check_states refuses its pass); with one the filler runs the check,
    and a --fullfp beside it is refused, so the card has one source. None for what it said: the caller's --said stands."""
    if not sealed_file:
        return given or default_state("fullfp"), None, frozenset()
    if given is not None:
        raise ValueError("--fullfp with --sealed-file: the filler runs the check on the sealed file; leave --fullfp out")
    if not fingerprint:
        raise ValueError(f"no fingerprint for {slug} in the registry entry to compare the seal with")
    state, said = check_full_fingerprint(sealed_file, slug, fingerprint, run)
    return state, said, frozenset({"fullfp"})


def now_local(tz=None) -> str:
    """The clock as the card shows it, read here so no kin types a time: 2026-10-21 17:19 CEST."""
    from datetime import datetime
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    try:
        now = datetime.now(ZoneInfo(tz)) if tz else datetime.now().astimezone()
    except (ZoneInfoNotFoundError, ValueError, OSError) as e:
        raise Refused(f"no time zone {tz!r}") from e
    return now.strftime("%Y-%m-%d %H:%M ") + (now.strftime("%Z") or now.strftime("UTC%z"))


def parse_said(pairs: list) -> dict:
    """--said CHECK=TEXT, repeated, as {check: text}. A check name that is not one of the five is refused."""
    said = {}
    for p in pairs:
        name, sep, text = p.partition("=")
        if not sep or name not in CHECK_LABELS:
            raise ValueError(f"--said {p!r}: write CHECK=TEXT, CHECK one of {', '.join(CHECK_LABELS)}")
        said[name] = text.strip()
    return said


def loud_items(states: dict, said: dict, mcp: str = "", mcp_state: str = "ok", skill: str = "", skill_state: str = "ok"):
    """What the greeting must say out loud, in order; empty when all is fine. Shared with text-card.py (one master).

    A check is said when it failed or could not run ("missing": never shown as passed), with what it said. An MCP or
    a skill is said when its state is warn, or its own line reads STALE or DRIFT (as the env block prints them)."""
    items = []
    for k, label in CHECK_LABELS.items():
        state = states.get(k, default_state(k))
        if state not in ("pass", NOT_ASKED):  # not asked is silent: a check that does not exist yet
            items.append(f"{label} {'failed' if state == 'fail' else 'could not run'}" + (f": {said[k]}" if said.get(k) else ""))
    if mcp_state == "warn" or re.search(r"\bSTALE\b", mcp or ""):
        items.append(f"mcp: {mcp}")
    if skill_state == "warn" or re.search(r"\bDRIFT\b", skill or ""):
        items.append(f"skill: {skill}")
    return items


def find_face(gardens: list, slug: str):
    """(the face's URL or "", the file it came from or a note) — from the first root holding a faces file."""
    for g in gardens:
        for rel in FACES:
            fp = g / rel
            if not fp.is_file():
                continue
            try:
                faces = json.loads(fp.read_text(encoding="utf-8"))
                base, pattern = faces["base"], faces["file"]
            except (ValueError, KeyError, TypeError) as e:
                raise Refused(f"{fp} is unreadable: {e}") from e
            if not (isinstance(base, str) and FACE_BASE.fullmatch(base) and base.endswith("/")):
                raise Refused(f"face base in {fp} is not a pinned CDN path ending in '/' (a full commit or a tag): {base!r}")
            if not (isinstance(pattern, str) and "{slug}" in pattern and re.fullmatch(r"[\w{}.-]+", pattern)):
                raise Refused(f"face file pattern in {fp} must name {{slug}}: {pattern!r}")
            return base + pattern.replace("{slug}", slug), str(fp)
    return "", "no faces.json in " + ", ".join(str(g) for g in gardens) + "; the seal stands in"


def find_body(gardens: list, slug: str):
    """(registry entry, body dir) — the first root naming the kin whose body holds a portrait.

    A root may also be an INSTALLED PACKAGE (W, 2026-10-16): its agents/registry.json is the package marker, an
    empty roster on purpose, and the kin's own row travels at identity/registry-entry.json, written by package.py
    at build; the body is the package root itself. Read only when the root's registry does not name the kin, so a
    garden checkout is never shadowed by a row inside it."""
    tried, reg0 = [], None
    for g in gardens:
        rp = g / "agents" / "registry.json"
        if not rp.is_file():
            tried.append(f"{g} (no agents/registry.json)")
            continue
        try:
            agents = json.loads(rp.read_text(encoding="utf-8"))["agents"]
        except (ValueError, KeyError) as e:
            raise Refused(f"{rp} is unreadable: {e}") from e
        agents = agents if isinstance(agents, list) else list(agents.values())
        reg = next((x for x in agents if x.get("slug") == slug), None)
        body = None
        if reg:
            body = g / (reg.get("path") or f"agents/{slug}")
        elif (g / PACKAGE_ROW).is_file():
            try:
                rows = json.loads((g / PACKAGE_ROW).read_text(encoding="utf-8"))["agents"]
            except (ValueError, KeyError) as e:
                raise Refused(f"{g / PACKAGE_ROW} is unreadable: {e}") from e
            reg = next((x for x in rows if x.get("slug") == slug), None)
            if reg:
                body = g  # the package root is the body
            else:
                tried.append(f"{g} ({PACKAGE_ROW} does not name {slug})")
                continue
        else:
            tried.append(f"{g} (registry does not name {slug})")
            continue
        reg0 = reg0 or reg
        if (body / "assets" / "portrait-thumb.b64.meta").is_file():
            return reg, body
        tried.append(f"{body} (no assets/portrait-thumb.b64.meta)")
    if reg0 is None:
        raise Refused(f"{slug} is in no registry: " + "; ".join(tried))
    raise Refused(f"no portrait for {slug}: " + "; ".join(tried))


def main():
    ap = argparse.ArgumentParser()
    for a in (
        "slug",
        "subtitle",
        "version",
        "location",
        "host",
        "harness",
        "model",
        "mcp",
        "skill",
        "permission",
        "out",
    ):
        ap.add_argument("--" + a.replace("_", "-"), required=True)
    ap.add_argument("--garden", action="append", required=True, help="a garden root; repeat, in order")
    ap.add_argument("--at-local", default="", help="the time as shown; omitted, the machine's clock (never typed by hand)")
    ap.add_argument("--tz", help="an IANA zone for the clock; omitted, the machine's local zone")
    ap.add_argument("--build", default="")
    for a in ("integrity", "identity", "files", "alive"):
        ap.add_argument("--" + a, choices=STATES, default=default_state(a))
    ap.add_argument("--fullfp", choices=STATES, default=None, help="fail or missing on the caller's word; a pass is earned by --sealed-file")
    ap.add_argument(
        "--sealed-file",
        default="",
        help="the kin's own sealed file (an installed package's MANIFEST.json, or the body's SKILL.md): the filler runs "
        "core's verifier on it against the published keys and compares the full fingerprint with the registry's",
    )
    ap.add_argument("--mcp-state", choices=("ok", "warn"), default="ok")
    ap.add_argument("--skill-state", choices=("ok", "warn"), default="ok")
    ap.add_argument(
        "--said",
        action="append",
        default=[],
        metavar="CHECK=TEXT",
        help="what a check that did not pass said, its own line; repeat per check (integrity, identity, files, alive, fullfp)",
    )
    ap.add_argument(
        "--full", action="store_true", help="the animated v6 card (about 12 KB) instead of the compact one (about 3 KB)"
    )
    a = ap.parse_args()
    try:  # the caller's words first, before any file is read: a typed fullfp pass stops here
        check_states(
            {"integrity": a.integrity, "identity": a.identity, "files": a.files, "alive": a.alive, "fullfp": a.fullfp or default_state("fullfp")}
        )
    except ValueError as e:
        raise Refused(str(e)) from e

    reg, body = find_body([Path(x).expanduser() for x in a.garden], a.slug)
    assets = body / "assets"
    fp, kanji = reg.get("fingerprint"), reg.get("kanji")
    if not fp or not kanji:
        raise Refused(f"no fingerprint or kanji for {a.slug} in the registry entry")
    try:
        a.fullfp, fullfp_said, earned = resolve_fullfp(a.fullfp, a.sealed_file, a.slug, fp)
    except ValueError as e:
        raise Refused(str(e)) from e
    chars = list(reg.get("kanji-chars") or kanji)
    if "".join(chars) != kanji:
        raise Refused(f"kanji-chars {chars} do not spell kanji {kanji} for {a.slug}")
    # The fingerprint attests exactly the characters its vanity search forced, and no more
    # (Mori-shin, 2026-10-06). `fp-attests` names how many; absent, the whole name is owed, so
    # a long name without the field still fails rather than passing on a guessed prefix. Bits
    # past n were never chosen: they are not decoded, shown or compared.
    n = reg.get("fp-attests", len(chars))
    if not isinstance(n, int) or isinstance(n, bool) or not 2 <= n <= len(chars):
        raise Refused(f"fp-attests {n!r} for {a.slug} is not a whole number from 2 to {len(chars)}")
    attested, name_only = "".join(chars[:n]), "".join(chars[n:])
    owed = "fp-attests" not in reg and len(chars) > 2
    # A name longer than two characters with no `fp-attests` fails closed, and it must not decode past
    # the two characters every vanity search forces: the rest were never chosen, so they are never shown.
    spelled = fp_kanji(fp, 2) if owed else fp_kanji(fp, n)
    meta = json.loads(need(assets / "portrait-thumb.b64.meta", "portrait meta", a.slug).read_text())
    # base64 travels only in the animated --full card; the compact card links the face (find_face)
    thumb = need(assets / "portrait-thumb.b64", "portrait thumb", a.slug).read_text().strip() if a.full else ""
    intro_md = need(assets / "intro.md", "intro line", a.slug).read_text()
    intro = re.search(r'## The line\s*\n+>\s*"([^"]+)"', intro_md)
    if not intro:
        raise Refused(f"no intro line for {a.slug}: {assets / 'intro.md'} has no '## The line' quote")
    svg = need(assets / f"{a.slug}-mark.svg", "mark", a.slug).read_text()
    if "<svg" not in svg:
        raise Refused(f"no mark for {a.slug}: {assets / (a.slug + '-mark.svg')} holds no <svg>")
    svg = svg[svg.index("<svg") :]
    root_end = svg.index(">")
    root = re.sub(r'\s(width|height)="[^"]*"', "", svg[:root_end])
    svg = root.replace("<svg", '<svg width="32" height="32"', 1) + svg[root_end:]
    for k in ("bytes", "checksum_fnv1a32", "mime"):
        if k not in meta:
            raise Refused(f"no {k} in {assets / 'portrait-thumb.b64.meta'} for {a.slug}")

    checks = {"integrity": a.integrity, "identity": a.identity, "files": a.files, "alive": a.alive, "fullfp": a.fullfp}
    try:
        check_states(checks, earned)  # the one place: alive alone not asked; fullfp passes only when earned above
    except ValueError as e:
        raise Refused(str(e)) from e
    names = {
        "integrity": "SKILL.md is the sealed body",
        "identity": "sealing key published and known",
        "files": "every file matches the manifest",
        "alive": "live handshake",
        "fullfp": "full fingerprint compared",
    }
    of = f" of {kanji}" if name_only else ""
    if owed:
        state, title = (
            "failed",
            (
                f"the name has {len(chars)} characters and the registry does not say how many the "
                f"fingerprint attests (fp-attests); nothing past the first two is decoded"
            ),
        )
    elif spelled != attested:
        state, title = (
            "failed",
            f"fingerprint spells {spelled}, name begins {attested}{of}"
            if name_only
            else f"fingerprint spells {spelled}, name is {kanji}",
        )
    elif all(v == "pass" for v in checks.values()):
        # the extra phrase only where there is something to distinguish, so a two-character card is unchanged
        state, title = (
            "verified",
            "all checks passed; full fingerprint compared"
            + (f"; fingerprint attests {attested}{of}" if name_only else ""),
        )
    elif "fail" in checks.values():
        state = "failed"
        title = " · ".join(f"{names[k]}: {v}" for k, v in checks.items())
    else:
        state = "unchecked"
        title = " · ".join(f"{names[k]}: {v}" for k, v in checks.items())

    # The name-only characters sit on their own line under the fingerprint line, outside the verify link:
    # secondary ink at full strength (never the faint "strokes still owed" look, which means a check failed),
    # no tick, no link, and the word "name". Empty for a kin whose whole name the fingerprint spells.
    if name_only:
        tip = esc(f"{name_only}: part of the name, not spelled by the key", quote=True)
        name_only_row = (
            f'<span class="fp-name-only" title="{tip}" aria-label="{tip}" style="display:flex;align-items:baseline;gap:5px;">'
            f'<span style="font-family:var(--font-sans);font-size:13px;color:var(--text-primary);">{esc(name_only, quote=True)}</span>'
            f'<span style="font-size:11px;font-family:var(--font-mono);color:var(--text-muted);">name</span></span>'
        )
    else:
        name_only_row = ""
    for k in ("name", "accent-rgba", "fp8"):
        if not reg.get(k):
            raise Refused(f"no {k} for {a.slug} in the registry entry")
    # The canonical colour, solid: the ring and the seal's ground. Kanji are white, black, canonical or amber, never grey.
    rgb = re.match(r"rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})", reg["accent-rgba"])
    if not rgb:
        raise Refused(f"accent-rgba {reg['accent-rgba']!r} for {a.slug} is not an rgb(a) colour")
    # The seal: the kanji in columns of two, read right to left, as a hanko is.
    seal = "<br>".join(esc("".join(chars[i : i + 2])) for i in range(0, len(chars), 2))
    face_url, face_from = find_face([Path(x).expanduser() for x in a.garden], a.slug)
    try:
        said = parse_said(a.said)
    except ValueError as e:
        raise Refused(str(e)) from e
    if fullfp_said is not None:  # the filler ran the check: its verifier's words, never the caller's
        said.pop("fullfp", None)
        if fullfp_said:
            said["fullfp"] = fullfp_said
    loud = loud_items(checks, said, a.mcp, a.mcp_state, a.skill, a.skill_state)
    loud_html = (
        f'<div style="padding:5px 10px;border-radius:var(--radius);background:{LOUD_AMBER};color:#1c1a17;'
        f'font-size:12px;font-weight:500">&#9650; {esc(" · ".join(loud))}</div>'
        if loud
        else ""
    )
    v = {
        "ID": f"p-{a.slug}",
        "NAME": reg["name"],
        "SUBTITLE": a.subtitle,
        "INTRO_LINE": intro.group(1),
        "ACCENT_RGBA": reg["accent-rgba"],
        "CANON": "rgb({},{},{})".format(*rgb.groups()),
        "SEAL": seal,
        "LOUD": loud_html,
        # a background, not an <img>: a face that fails paints nothing, where Chromium draws a broken-image glyph
        "FACE": f'<span style="background:url({esc(face_url, quote=True)}) 50%/cover"></span>' if face_url else "",
        "KANJI": kanji,
        "FP8": reg["fp8"],
        "FINGERPRINT": fp,
        "FP_KANJI": spelled,
        "MARK_SVG": svg,
        "KANJI_ATTESTED": attested,
        "KANJI_NAME_ONLY": name_only,
        "FP_ATTESTS": str(n),
        "NAME_ONLY_ROW": name_only_row,
        "THUMB_B64": thumb,
        "EXPECTED_BYTES": str(meta["bytes"]),
        "EXPECTED_CHECKSUM": meta["checksum_fnv1a32"],
        "MIME": meta["mime"],
        "VERSION": a.version,
        "BUILD": a.build or "build unstamped",
        "BUILD_STATE": "ok" if a.build else "warn",
        "CHECK_INTEGRITY": a.integrity,
        "CHECK_IDENTITY": a.identity,
        "CHECK_FILES": a.files,
        "CHECK_ALIVE": a.alive,
        "CHECK_FULLFP": a.fullfp,
        "TRUST_STATE": state,
        "TRUST_MARK": "✓" if state == "verified" else "",
        "TRUST_TITLE": title,
        "LOCATION": a.location,
        "AT_LOCAL": a.at_local or now_local(a.tz),
        "HOST": a.host,
        "HARNESS": a.harness,
        "MODEL": a.model,
        "MCP": a.mcp,
        "MCP_STATE": a.mcp_state,
        "SKILL": a.skill,
        "SKILL_STATE": a.skill_state,
        "PERMISSION": a.permission,
        "PERMISSION_STATE": "warn" if a.permission in ("bypassPermissions", "mode unknown") else "ok",
    }
    t = (TEMPLATE_FULL if a.full else TEMPLATE).read_text()
    t = t[t.index("-->") + 3 :].lstrip()
    for k, val in v.items():
        t = t.replace(f"__{k}__", val)
    left = sorted(set(re.findall(r"__[A-Z0-9_]+__", t)))
    if left:
        raise Refused(f"unfilled placeholders for {a.slug}: {left}")
    Path(a.out).write_text(t)
    print(
        f"wrote {a.out} · {len(t.encode())} bytes · trust {state} · fingerprint spells {spelled}"
        + (f" (attests {n} of {len(chars)}; {name_only} name-only)" if name_only else "")
        + (f" · full fingerprint {a.fullfp}, from the verifier on {a.sealed_file}" if a.sealed_file else "")
        + ("" if a.full else f" · face {face_url or face_from}")
        + ("" if a.full else (f" · LOUD: {' · '.join(loud)}" if loud else " · silent: every check that ran passed" + ("; alive not asked" if a.alive == NOT_ASKED else "")))
    )


if __name__ == "__main__":
    try:
        main()
    except Refused as e:
        print(f"fill-greeting: REFUSED — {e}", file=sys.stderr)
        sys.exit(2)
    except Exception as e:  # never a traceback: name it and stop
        print(f"fill-greeting: REFUSED — unexpected {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(2)
