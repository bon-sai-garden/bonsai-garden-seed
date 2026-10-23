#!/usr/bin/env python3
# ---
# id: 01M39MJ8PKW9QPQRPAXQE3F9PH
# title: package.py — the one builder, for every body, skill and plugin
# type: script
# tended-by: baisai
# created: 2026-09-24
# updated: 2026-10-21
# ---
"""package.py — one logical builder. Core holds the capability; the pot says what to package.

The gardener, 2026-09-24: "there should be only one builder. Or one logical builder if you
need a variation … the capabilities in core and the orchestration sits in the pot."

WHAT IT TAKES
  A package list (JSON), written by a garden and kept in its pot. The list names the roots it
  reads (repo checkouts, relative to the list), the file holding the owners' signing salts, any
  rolls (a document plus the pattern that picks a member out of it), and the packages: kin
  vessels ("body"), every vessel on a roll ("bodies"), standalone skills ("skill") and plugins
  ("plugin", a configuration of the other three). This script knows nothing about any garden;
  everything garden-specific arrives in that list.

WHAT EVERY PACKAGED SKILL FOLDER GETS — the same logic for all four kinds, written once
  SKILL.md    frontmatter translated to name / description / version (three parts, single-quoted
              as the Claude app writes it back on install), then the stamp as the first body line, one blank line, then the source body unchanged. The
              stamp is `> Installed build: M.m.p.N[-LABEL]-<UTC>Z · body <8>`, version first and no
              provenance (where it was built from is the release's commit message, never a shipped
              file: the gardener, 2026-10-21) — the contract the garden MCP's skill_install.py reads at every
              boot (split_skill / body_hash below keep to it; test_package.py holds them to it
              whenever that file is checked out).
  integrity   the source body's FIRST line must be INTEGRITY_LINE (below): verify the sealed
              manifest before anything else; anything but ok means stop. The builder refuses a
              source without it; `--write-integrity-line` writes it into a source for its owner
              to review and re-seal. The package carries what the check needs:
              scripts/integrity/verify-manifest.mjs, a copy of core's verifier
              (scripts/integrity/bonsai-garden-sign/), and the marker agents/registry.json — an
              empty roster, so a root search stops at the package and can never borrow keys from
              whatever garden sits above it. No signer key travels. The marker's `_meta.source-path`
              names where the files were sealed (`agents/w`), the packager's half of verifying a
              shipped seal in place (W, 2026-10-16, finding 4; the mapping is the verifier's).
  greeting    a kin vessel carries what *Every kin* points at for the greeting, so an installed kin
              can greet without a garden (W, 2026-10-16, finding 5): core's fill-greeting.py and its
              v6 templates, text-card.py with its colour gate, and fp-kanji.py with its set, copied
              byte for byte with their seals under scripts/greeting/ as core lays them out; and the
              kin's own registry row at identity/registry-entry.json, the greeting's input and never a
              key source. The generated references/agents.md names both.
  scripts     a kin vessel's scripts/ ships (the tracked tree), so what its SKILL.md tells an installed
              kin to run is there (W's link-memory.sh was listed and not shipped; finding 3). A nested
              SKILL.md inside it cannot travel (the uploader refuses a nested skill): left out with its
              sidecar, and named.
  lock        the version lock (check-shintai-conformance.py's version_lock_problems) runs on every
              staged body, so a body carrying two versions is refused, not shipped (finding 2).
  seals       every seal the source carries must verify under the named key source (default:
              the published keys) AND at the fingerprint the list's registries name for that
              signer. A seal that verifies only under some other key — a retired one still on
              disk somewhere — is refused. The source SKILL.md.bonsaisig must be the OWNER's.
              The packaged SKILL.md is then sealed afresh by the owner (it is not the source's
              bytes), and so is MANIFEST.json.
  MANIFEST    MANIFEST.json: sha256 of every shipped byte, stamp included; sealed by the owner
              (core's sign.mjs sign-sidecar, HKDF from the master salt in OS custody + the
              owner's signing salt from the list's salts file). Then verify-manifest.mjs — the
              very script the package runs at wake — must answer ok on the stage.
  every-kin   if the list names one, a kin vessel carries the garden's crew-wide section, generated
              from the committed fragment into references/agents.md; a body keeping its own copy is
              refused, and the staged copy must equal a fresh generation before the manifest is sealed.
  bundle      if the list names one, every kin vessel carries the shared documents it reads when no
              garden MCP answers (the codex, the routines), copied byte for byte from their committed
              canonical home WITH that home's own seal, so the copy proves it is the original. A
              tombstone, an uncommitted or a dirty source is refused. A body's own file at the same
              path is replaced only when it is a tombstone or byte-identical; anything else REFUSES
              (a stale copy is a second master to tombstone, and a body's own document must never be
              overwritten). A file may be limited to registry types; a body's own entry may bundle
              more, or opt out of one with null (Bonsai's own Guardian codex and routines).
  gates      check-skill-conformance.py --packaged on every skill folder; for a kin vessel also
              check-shintai-conformance.py --packaged (the empty-memory rule).
  archive     <name>.zip + <name>.skill (identical bytes) for a vessel or a skill;
              <name>.plugin for a plugin. A refused package leaves nothing behind.

REFUSES (lifted from the crew builder, plus the integrity rules)
  uncommitted changes in what ships (the stamp would name a source it was not built from) —
  unless --review, which stamps `@<head>+uncommitted` and is for an owner's review, never upload;
  a roll member or named slug with no vessel (never skipped); a vessel without a version, a
  constitution, or a mark (unless the list declares it markless, with a reason, printed); a .pem
  on the stage; a shipped seal that does not verify, or verifies at a key the registry does not
  name; a SKILL.md without the integrity line; an archive over its ceiling; a skill folder over MAX_UNIT_FILES files,
  each unit of a plugin too (the Claude app refuses a skill of more than 200); a gate FAIL.

WHAT A RELEASE LEAVES OUT (the gardener, 2026-10-16: those histories "stay in core and leave seed")
  No package carries a file of this checkout that its release leaves out. The builder reads that as a plain list,
  --leave-out <file>: one path per line, relative to this checkout ('#' and blank lines aside), made by the release
  and never kept here (Bonsai's owner read of the release 7a40497e, F6, 2026-10-17: three histories shipped). It
  knows nothing of how the list was made (Tasai's ruling, 2026-10-21: the builder names no other tool). Read once,
  before anything is staged. A file a tree copy meets is left out, and named per package; a file a package names by
  itself (a plugin's `files`, initial memory, a bundle, the greeting kit) is refused. A list that cannot answer (not
  there, empty, a path outside this checkout, a file this checkout does not track) refuses the build, never builds as
  though it said nothing. A checkout that carries a release manifest at its root (`<NAME>-MANIFEST.json`, format
  bonsai-garden-release-manifest/1: a stranger's clone of seed) holds none of what its release leaves out and needs
  no list. A checkout with neither is refused: nothing could say what its release leaves out.

CORE ALONE (the gardener, 2026-10-17: "restore the core-alone build of Bonsai's plugin")
  With no list, the target is core's own plugin and the checkout this script sits in (core, or a seed
  cut of it) is the root `core`: assets/core-plugin.json is the whole configuration, the out is
  <checkout>/.build/. Every guard below holds unchanged; only who seals differs.
  - no key named (a stranger, a fresh clone): an UNSEALED LOCAL BUILD, said on the first line of
    the output. The packaged SKILL.md files and the MANIFEST.json files carry no seal, and every
    manifest says so (`unsealed`), so the integrity line cannot pass on it: verify-manifest.mjs
    answers UNSEALED, never ok. For reading and development; only the owners' sealed release
    replaces it. Never a fallback: naming a key that then fails refuses the build.
  - --salts <the garden's locked-salts file> (the owners): sealed as each unit's owner and the
    plugin as the config's owner, through the signing gate, exactly as a list's build seals.

USAGE
  python3 package.py --list <package-list.json> [--only NAME ...] [--keys published|garden]
                     [--out DIR] [--review] [--counter FILE] [--leave-out FILE]
  python3 package.py [--only bonsai-garden-core] [--salts <locked-salts.json>] [--out DIR] [--review]
                     [--counter FILE] [--leave-out FILE]
                     core alone: core's own plugin from this checkout, with no pot
  python3 package.py --write-integrity-line <SKILL.md> [...]

--counter names the garden's one build counter (the N of M.m.p.N); without it a build counts in
build-counter.json in its output folder, so a release built in its own folder names the garden's.

--keys garden is host tooling's named choice (trust-anchor.md, ruling 7): the signer keys are read
from each source root. It is never a fallback.

Lifted, not rewritten: translate, _manifest, _seal_as_owner, _skeleton, _next_build, the stage
filters and the refusals come from the crew's earlier skill builder,
build-crew-skill-zips.py (now a tombstone). What changed is only where the input comes from and
which verifier and signer are called: core's own, so a checkout of core packages Bonsai alone.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL_DIR = HERE.parent


def _core_root() -> Path:
    """Core's root, by its marker (agents/registry.json beside skills/bonsai-garden-sign)."""
    d = HERE
    while d != d.parent:
        if (d / "agents" / "registry.json").is_file() and (d / "skills" / "bonsai-garden-sign").is_dir():
            return d
        d = d.parent
    sys.exit("package.py: cannot find core (agents/registry.json + skills/bonsai-garden-sign) above this script")


CORE = _core_root()
SIGN_DIR = CORE / "skills" / "bonsai-garden-sign"
SIGN_CLI = SIGN_DIR / "bin" / "sign.mjs"
VERIFY_MANIFEST = HERE / "verify-manifest.mjs"
SHINTAI_GATE = CORE / "tools" / "check-shintai-conformance.py"
SKILL_GATE = CORE / "tools" / "check-skill-conformance.py"
# a release checkout carries one at its root (seed's SEED-MANIFEST.json, since 0.9.1-rc): it needs no leave-out list
RELEASE_MANIFEST_FORMAT = "bonsai-garden-release-manifest/1"

CORE_PLUGIN_CONFIG = SKILL_DIR / "assets" / "core-plugin.json"  # core's own plugin: the core-alone build's whole config
UNSEALED_FIRST = "UNSEALED LOCAL BUILD"  # the output's first line, and the stranger walk reads it
UNSEALED_WHY = (
    "an unsealed local build: no owner's key was named, so no published key vouches for it; "
    "for reading and development, never for waking; only the owners' sealed release replaces it"
)
STAMP_PREFIX = "> Installed build:"
INTEGRITY_LINE = (
    "> **Integrity first.** Before you read or run anything else in this package, run "
    "`node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every "
    "file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal "
    "that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: "
    "use nothing here, and tell the gardener exactly what it said. A tampered file is not executed."
)
INTEGRITY_DIR = "scripts/integrity"
MARKER = {
    "_meta": {
        "marker": "bonsai-package",
        "note": "Marks this package's root, so a garden-root search stops here. An empty "
        "roster on purpose: no key and no fingerprint travels in a package; the "
        "published keys decide (scripts/integrity/bonsai-garden-sign/references/"
        "trust-anchor.md).",
    },
    "agents": [],
}
# What *Every kin* points at for the greeting (core agents/shared/routines.md, Routine 1 E and Routine 2.5 Steps 2d
# and 2e), copied from core's skills/ as core lays them out, so fill-greeting.py finds its templates and fp-kanji.py
# by its own relative paths. Each file travels with its own seal; the copies are checked byte for byte against core.
GREETING_DIR = "scripts/greeting"
GREETING_KIT = (
    "bonsai-garden-portrait/scripts/fill-greeting.py",
    "bonsai-garden-portrait/scripts/text-card.py",
    "bonsai-garden-portrait/scripts/check-kanji-colours.py",
    "bonsai-garden-portrait/templates/greeting-v6-compact.html",
    "bonsai-garden-portrait/templates/greeting-v6.html",
    "bonsai-garden-mark/fp-kanji.py",
    "bonsai-garden-mark/kanji-1024-v1.2.json",
)
REGISTRY_ROW = "identity/registry-entry.json"  # the kin's own row, as the list's registry had it at build
EVERY_KIN_TRAILER = """
## In this package

What *Every kin* names by its garden path sits here, so an installed body is self-contained:

- **The greeting kit**, core's own files as core lays them out, under `scripts/greeting/`: \
`bonsai-garden-portrait/scripts/fill-greeting.py` (its templates beside it; `greeting-v6-compact.html` is the \
default), `bonsai-garden-portrait/scripts/text-card.py` with its gate `check-kanji-colours.py`, and \
`bonsai-garden-mark/fp-kanji.py` with its set.
- **This kin's own registry row**, `identity/registry-entry.json`: pass this package's root as `--garden` to \
`fill-greeting.py`, or the file as `--registry` to `text-card.py`. `agents/registry.json` at the root is the \
package marker and stays an empty roster: no key and no fingerprint travels as canon; the published keys decide.
"""


def _marker(source_path: str | None) -> str:
    """The package-root marker as written: the empty roster, plus `_meta.source-path`, the path the unit's files were
    sealed at in their source root (`agents/w`, `skills/bonsai-garden-mark`). Written for W's finding 4 (2026-10-16),
    when a shipped seal read target-mismatch where it was installed. Since F-12 (bonsai-garden-sign 1.1.0, 2026-10-21)
    a seal's address is provenance, never a verdict: a shipped seal reads ok in place and names where it was sealed,
    and no verifier reads `source-path`. It stays a declaration until a packager change retires it. A plugin root
    names none: each skill folder in it has its own."""
    meta = dict(MARKER["_meta"])
    if source_path:
        meta["source-path"] = source_path
    return json.dumps({"_meta": meta, "agents": []}, indent=2) + "\n"


# The verifier's code travels; its SKILL.md does not. A package may hold exactly one SKILL.md, at
# its root: Claude's uploader refuses a nested one ("nested skills"), found installing Trime 2026-09-26.
SIGN_SHIP = (
    "bin",
    "lib",
    "custody",
    "sign-service.mjs",
    "references",
    "seal-policy.json",
)  # the v1 cutover travels with the verifier
MARK_NAMES = ("mark.svg", "{slug}-mark.svg")  # 3.0 body first, pre-crossing second
MAX_ARCHIVE_BYTES = 7 * 1024 * 1024
# The Claude app refuses a skill of more than 200 files (the gardener, 2026-10-18 ~18:50: "the bonsai skill contains
# too many files (200 is the limit)"; Bonsai's unit then held 210, 99 of them seals). Counted in each
# skill folder as it is zipped, every seal and MANIFEST.json included: a .skill, and every skills/<name>/ of a plugin.
MAX_UNIT_FILES = 200
# The upload refuses any archive path outside these characters ("invalid characters"; W's
# portrait-work-thumb@2x.jpg, 2026-09-27, found by Jisai). Refused here, before it is packaged.
UPLOAD_PATH_OK = re.compile(r"^[A-Za-z0-9._/-]+$")
# plugin.json keys the Claude plugin schema knows (`claude plugin validate`, 2026-09-27). Any other
# key made the manifest invalid: icon, _bonsai, x-agents, x-mcp-dependencies. Those travel in
# bonsai-plugin.json at the plugin root instead, never dropped in silence.
PLUGIN_JSON_KEYS = {
    "name",
    "version",
    "description",
    "author",
    "homepage",
    "repository",
    "license",
    "keywords",
    "displayName",
    "commands",
    "agents",
    "skills",
    "hooks",
    "mcpServers",
    "outputStyles",
    "lspServers",
    "dependencies",
}
ASSET_SKIP_SUFFIX = (".wav", ".mp3", ".mp4", ".mov", ".m4a", ".aiff")
SLIM_ASSETS = ("portrait-thumb.b64", "portrait-thumb.b64.meta", "intro.md", "portrait-card.txt")
IDENTITY_KEEP = ("{slug}-public-key.bin", "{slug}-fingerprint.txt", "tier.txt")
IDENTITY_KEEP_GLOB = "bunshin-attestation*.md"
SKIP_NAMES = {".DS_Store", "__pycache__", "node_modules", ".git"}
SKIP_SUFFIX = (".pyc", ".bak")
FM_RE = re.compile(r"^---\n(.*?)\n---\n(.*)$", re.S)


STAGE_BASE: Path | None = None  # a temp dir per run: never inside a garden root, never the out dir


def _stage_base() -> Path:
    global STAGE_BASE
    if STAGE_BASE is None:
        STAGE_BASE = Path(tempfile.mkdtemp(prefix="bonsai-package-"))
    return STAGE_BASE


class Refused(Exception):
    """One package refused; the others still run. Named in the summary, exit 1."""


# ── the stamp contract (skill_install.py's; test_package.py checks the two agree) ──────────


def split_skill(text: str) -> tuple[str, str | None]:
    """(body without stamp, stamp-or-None): body = after the leading frontmatter; the stamp is an
    optional first body line starting with STAMP_PREFIX, followed by exactly one blank line."""
    body = text
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            body = text[end + len("\n---\n") :]
    stamp = None
    first, _sep, rest = body.partition("\n")
    if first.startswith(STAMP_PREFIX):
        stamp = first[len(STAMP_PREFIX) :].strip()
        body = rest[1:] if rest.startswith("\n") else rest
    return body, stamp


def body_hash(text: str) -> str:
    return hashlib.sha256(split_skill(text)[0].encode("utf-8")).hexdigest()


def first_body_line(text: str) -> str:
    return split_skill(text)[0].partition("\n")[0]


# ── helpers ────────────────────────────────────────────────────────────────────────────────


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


GATE_MOD = _load("shintai_gate", SHINTAI_GATE)  # the body's version and the named memory bodies


def _git(root: Path, *a: str) -> str:
    return subprocess.run(["git", "-C", str(root), *a], capture_output=True, text=True).stdout.strip()


def _repo_top(p: Path) -> Path:
    top = _git(p if p.is_dir() else p.parent, "rev-parse", "--show-toplevel")
    return Path(top) if top else p


def translate(path: Path, version: str | None = None) -> str:
    """Workshop frontmatter -> Anthropic's (name, description, version). Body untouched. Lifted."""
    text = path.read_text(encoding="utf-8")
    m = FM_RE.match(text)
    if not m:
        raise Refused(f"{path}: SKILL.md has no frontmatter")
    fm, body = m.group(1), m.group(2)

    def field(n: str) -> str | None:
        mm = re.search(rf"^{n}:\s*[>|]-?\s*\n((?:[ \t]+\S.*\n?)+)", fm, re.M)
        if mm:
            return " ".join(mm.group(1).split())
        mm = re.search(rf"^{n}:[ \t]*(.+)$", fm, re.M)
        return mm.group(1).strip().strip("\"'") if mm else None

    name, desc = field("name"), field("description")
    version = version or field("version")
    if not name or not desc:
        raise Refused(f"{path}: SKILL.md needs both name and description")
    if len(desc) > 1024:
        raise Refused(f"{path}: description is {len(desc)} chars, over the 1024 limit")
    q = '"' + desc.replace("\\", "\\\\").replace('"', '\\"') + '"'
    head = ["---", f"name: {name}", f"description: {q}"]
    if version:
        # single-quoted, as the Claude app writes it back on install (W's F-1, 2026-10-18: `version: 3.1.4` came back
        # `version: '3.1.4'` in all 12 skills, and the plugin's byte-exact manifest failed on a correct install). The
        # installed bytes are then the sealed ones. A quote inside is doubled, YAML's own escape.
        head.append("version: '" + version.replace("'", "''") + "'")
    return "\n".join([*head, "---", ""]) + body


def _skeleton(slug: str, kind: str) -> str:
    title = {"working-state.md": "working state", "MEMORY.md": "memory index"}[kind]
    return (
        "---\n"
        f"title: \"{slug} — {title} (empty in the shintai; the memory lives in pot)\"\n"
        f"type: {'working-state' if kind == 'working-state.md' else 'memory-index'}\n"
        f"tended-by: {slug}\n"
        "---\n"
    )


_TRACKED: dict[Path, set[str]] = {}
LEFT_OUT: list[str] = []
# This checkout's files that its release leaves out (relative to it), read once by main() from --leave-out before
# anything is staged (WHAT A RELEASE LEAVES OUT, above). Empty in a release checkout, and when main() has not run.
LEAVE_OUT: set[str] = set()
LEAVE_OUT_LIST: Path | None = None
LIST_LEFT_OUT: list[str] = []
# Tasai's hard requirement, 2026-09-24: anything key-shaped reaching an archive is refused outright,
# tracked or not — *.key, private*, *.pem, *.p12/*.pfx, and any file holding a PEM private-key block.
KEY_NAME = re.compile(r"\.key$|^private|private[-_.]?key|chain[-_]code|\.pem$|\.p12$|\.pfx$", re.I)
KEY_BLOCK = re.compile(rb"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----")


def _git_top(p: Path) -> Path:
    top = _repo_top(p)
    if not (top / ".git").exists():
        raise Refused(f"{p} is not in a git checkout — the stamp could not name its source")
    return top


def _tracked(p: Path) -> bool:
    """Only what git tracks ships: the stamp names a commit, and an untracked or ignored file
    (a private key kept beside a skill, say) is not in it. Asked of `git ls-files`, never of the
    directory: nothing untracked is even listed, let alone opened."""
    p = p.resolve()
    top = _git_top(p)
    if top not in _TRACKED:
        out = subprocess.run(["git", "-C", str(top), "ls-files", "-z"], capture_output=True, text=True).stdout
        _TRACKED[top] = {x for x in out.split("\0") if x}
    return os.path.relpath(p, top) in _TRACKED[top]


def is_release(root: Path) -> bool:
    """A release checkout: it carries a release manifest at its root (`<NAME>-MANIFEST.json`, RELEASE_MANIFEST_FORMAT)."""
    for m in root.glob("*-MANIFEST.json"):
        try:
            if json.loads(m.read_text(encoding="utf-8")).get("format") == RELEASE_MANIFEST_FORMAT:
                return True
        except (OSError, ValueError, AttributeError):
            continue
    return False


def load_leave_out(named: Path | None) -> str:
    """Read, once, the files of this checkout its release leaves out: the plain list --leave-out names. Returns the line
    the build prints. A release checkout needs none; any other checkout without one is refused, and a list that cannot
    answer refuses the build: a build never runs as though the list said nothing (fail, don't fall back)."""
    global LEAVE_OUT, LEAVE_OUT_LIST
    if named is None:
        if is_release(CORE):
            LEAVE_OUT = set()
            return "  leave-out: none (a release checkout: what its release leaves out is not in it)"
        raise SystemExit(
            f"package.py: this checkout ({CORE}) names no leave-out list and carries no release manifest at its root, "
            "so nothing can say what its release leaves out; refusing to build: name the list with --leave-out <file>"
        )
    try:
        lines = named.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError) as e:
        raise SystemExit(f"package.py: the leave-out list {named} cannot be read ({e}); refusing to build") from None
    entries = [x.strip() for x in lines if x.strip() and not x.strip().startswith("#")]
    if not entries:
        raise SystemExit(
            f"package.py: the leave-out list {named} names no file: an empty list is likelier a step that failed than "
            "a release that leaves nothing out; refusing to build"
        )
    tracked = subprocess.run(["git", "-C", str(CORE), "ls-files", "-z"], capture_output=True, text=True).stdout
    tracked_set = {x for x in tracked.split("\0") if x}
    for e in entries:
        pe = Path(e)
        if pe.is_absolute() or ".." in pe.parts or e.startswith("~"):
            raise SystemExit(f"package.py: the leave-out list {named}: {e!r} is not a path inside this checkout; refusing")
        if pe.as_posix() not in tracked_set:
            raise SystemExit(
                f"package.py: the leave-out list {named}: {e!r} is a file this checkout ({CORE}) does not track: a list "
                "made for another tree or another commit; refusing to build"
            )
    LEAVE_OUT = {Path(e).as_posix() for e in entries}
    LEAVE_OUT_LIST = named
    return f"  leave-out: {len(LEAVE_OUT)} file(s) of this checkout ({named})"


def _left_out(p: Path) -> bool:
    """A file of this checkout that the leave-out list names."""
    if not LEAVE_OUT:
        return False
    rel = os.path.relpath(p.resolve(), CORE)
    return not rel.startswith("..") and Path(rel).as_posix() in LEAVE_OUT


def _tracked_under(src: Path) -> list[Path]:
    """Every tracked file under `src`, from git's index — the only enumeration the builder uses. A file the leave-out
    list names is left out here, and named per package (WHAT A RELEASE LEAVES OUT)."""
    src = src.resolve()
    top = _git_top(src)
    rel = os.path.relpath(src, top)
    out = subprocess.run(["git", "-C", str(top), "ls-files", "-z", "--", rel], capture_output=True, text=True).stdout
    files = [top / x for x in out.split("\0") if x]
    other = subprocess.run(
        ["git", "-C", str(top), "ls-files", "-z", "--others", "--", rel], capture_output=True, text=True
    ).stdout
    LEFT_OUT.extend(str(top / x) for x in other.split("\0") if x)
    kept = []
    for f in sorted(f for f in files if f.is_file()):
        if _left_out(f):
            if str(f) not in LIST_LEFT_OUT:
                LIST_LEFT_OUT.append(str(f))
            continue
        kept.append(f)
    return kept


# staged path → the tracked file it was copied from. A v2 seal names its file's address
# (`target`, inside its signed payload), so a seal copied into a package does not hold at
# the package address — by design. The shipped-seal check verifies each copied seal at its
# SOURCE, where it was made, and that the staged bytes are the source's.
SOURCE_OF: dict[str, Path] = {}


def _cp(src: Path, dst: Path) -> bool:
    if not _tracked(src):
        if str(src) not in LEFT_OUT:
            LEFT_OUT.append(str(src))
        return False
    if _left_out(src):  # a tree copy never gets here (_tracked_under leaves it out): this source was named
        raise Refused(
            f"{os.path.relpath(src, CORE)}: the leave-out list leaves it out ({LEAVE_OUT_LIST}), so no package carries "
            "it; name it in no package, or take it off the release's list"
        )
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    SOURCE_OF[str(dst.resolve())] = src
    return True


_SIG = ".bonsaisig"


# ── where a sidecar lives (the dot-prefixed sidecar change: phase 1a read both names; phase 3 names the old one) ───────
# `X.bonsaisig` (the name until 2026-10-05) or `.X.bonsaisig` (hidden; the Aruji, 2026-10-05). Both
# present is refused, never preferred. This is core's Python copy of the rule the garden's sign.py and
# sidecar-format.mjs (core, Node) hold: a checkout of core alone must build, so it cannot import
# a sign.py it does not carry, and the Node finder is not called once per file. Named in the spec as the third
# finder until the sign.py retirement retires sign.py.

# Phase 3 (the Aruji, 2026-10-05: "proceed with phase 3 after the site lands"): the old name is read
# and named `retired-sidecar-name`, never silently. Whether a package may carry it is core's
# skills/bonsai-garden-sign/seal-policy.json "sidecar-name", read the way "v1" is: warn ships it with
# a printed warning, refuse refuses the package. Missing or unreadable reads as refuse.
RETIRED_SIDECAR_NAME = "retired-sidecar-name"
SEAL_POLICY_OVERRIDE: Path | None = None  # tests point this at a copy, in process
_WARNED: set[str] = set()


class RetiredSidecarName(Refused):
    """An old-name sidecar under "sidecar-name": "refuse". `.sidecar` is the path found."""

    def __init__(self, msg: str, sidecar: Path):
        super().__init__(msg)
        self.sidecar = sidecar


def _sidecar_name_mode() -> tuple[str, str | None]:
    p = SEAL_POLICY_OVERRIDE or (SIGN_DIR / "seal-policy.json")
    try:
        data = json.loads(Path(p).read_text(encoding="utf-8"))
    except Exception as exc:
        return "refuse", f"seal policy unreadable at {p} ({type(exc).__name__}); sidecar-name refused"
    if isinstance(data, dict) and data.get("sidecar-name") in ("warn", "refuse"):
        return data["sidecar-name"], None
    return "refuse", f"seal policy at {p} names no sidecar-name mode (warn|refuse); sidecar-name refused"


def _retired_name(target: Path, old: Path) -> None:
    """The verdict on an old-name sidecar `old` of `target`: warn prints the fix (once per sidecar)
    and returns; refuse raises RetiredSidecarName with the same fix."""
    hid = target.parent / ("." + target.name + _SIG)
    fix = (
        f"[{RETIRED_SIDECAR_NAME}] the seal sits at the retired sidecar name {old.name}; a sidecar is now "
        f"{hid.name}, hidden, beside its file. Fix: git mv {old} {hid}, or re-seal (the "
        f"writers move it)"
    )  # core's words: seal-v2.mjs retiredSidecarNameReason
    mode, why = _sidecar_name_mode()
    if mode != "warn":
        raise RetiredSidecarName(fix + (f" ({why})" if why else ""), old)
    key = str(Path(old).resolve())
    if key not in _WARNED:
        _WARNED.add(key)
        print(f"  WARN  {fix}", file=sys.stderr)


def _sidecar_of(path: Path) -> Path | None:
    old, hid = path.parent / (path.name + _SIG), path.parent / ("." + path.name + _SIG)
    if old.is_file() and hid.is_file():
        raise Refused(f"{path}: two sidecars ({old.name} and {hid.name}) — keep one, remove the other")
    if hid.is_file():
        return hid
    if old.is_file():
        _retired_name(path, old)  # warn: carried, with the fix printed; refuse: raised
        return old
    return None


def _target_of(sidecar: Path) -> Path | None:
    """`X.bonsaisig` → X; `.X.bonsaisig` → X, exactly one dot off (`..gitignore.bonsaisig` →
    `.gitignore`). A dotted stem is ambiguous in the transition: the file that exists wins; both
    existing is refused."""
    name = sidecar.name
    if not name.endswith(_SIG) or name == _SIG:
        return None
    stem = name[: -len(_SIG)]
    if not stem.startswith(".") or stem == ".":
        return sidecar.parent / stem
    as_old, as_hid = sidecar.parent / stem, sidecar.parent / stem[1:]
    if as_old.is_file() and as_hid.is_file():
        raise Refused(
            f"{sidecar}: both {as_old.name} and {as_hid.name} exist beside it — which one it seals "
            f"cannot be told by name"
        )
    return as_old if as_old.is_file() else as_hid


def _sidecar_names(name: str) -> tuple[str, str]:
    return name + _SIG, "." + name + _SIG


def _names_of(name: str) -> set[str]:
    """The name, and for a sidecar the name(s) of the file it may seal: its stem, and a hidden
    sidecar's stem read both ways (`..DS_Store` → `.DS_Store`; `.x.mjs` → `x.mjs`). So a rule that
    leaves a file out leaves its seal out with it, under either name."""
    names = {name}
    if name.endswith(_SIG):
        stem = name[: -len(_SIG)]
        names |= {stem} | ({stem[1:]} if stem.startswith(".") and len(stem) > 1 else set())
    return names


def _excluded(top_name: str, exclude: list[str]) -> bool:
    """A list entry's `exclude` patterns leave a top-level file out, and its sidecar with it: until
    core's phase-2 rename `test-x.mjs.bonsaisig` matched `test-*` by its prefix, but
    `.test-x.mjs.bonsaisig` does not, and shipped as an orphaned seal (the core plugin, 2026-10-05)."""
    import fnmatch

    return any(fnmatch.fnmatch(n, x) for n in _names_of(top_name) for x in exclude)


def _skipped(rel: Path) -> bool:
    """A path the builder never ships. A skipped file's sidecar is skipped with it: x.json.bak stays
    home, so x.json.bak.bonsaisig must too, or it ships as an orphaned seal and the package is
    refused (bonsai-garden-mark, 2026-09-27; the same class as the assets fix for Trime, 09-26).
    A hidden sidecar's stem is read both ways (`..DS_Store` and `.DS_Store`)."""
    parts = list(rel.parts)
    names = _names_of(parts[-1])
    return any(part in SKIP_NAMES or part.endswith(SKIP_SUFFIX) for part in parts[:-1]) or any(
        n in SKIP_NAMES or n.endswith(SKIP_SUFFIX) for n in names
    )


def _copytree(src: Path, dst: Path) -> None:
    for f in _tracked_under(src):
        rel = f.relative_to(src.resolve())
        if _skipped(rel):
            continue
        _cp(f, dst / rel)


def _tracked_glob(d: Path, pattern: str = "*") -> list[Path]:
    """Tracked files directly in `d` matching `pattern` — from git's index, not the directory."""
    import fnmatch

    if not d.is_dir():
        return []
    d = d.resolve()
    return [f for f in _tracked_under(d) if f.parent == d and fnmatch.fnmatch(f.name, pattern)]


def _asset_files(adir: Path, slim: bool) -> list[Path]:
    if not adir.is_dir():
        return []
    # a skipped medium's sidecar is skipped with it: intro.wav stays home, so intro.wav.bonsaisig
    # must too, or it ships as an orphaned seal and the package is refused (Trime, 2026-09-26)
    out = sorted(
        f
        for f in _tracked_glob(adir)
        if Path(f.name.removesuffix(".bonsaisig")).suffix.lower() not in ASSET_SKIP_SUFFIX
        and not f.name.endswith(".bak")
        and f.name not in (".DS_Store", "mark.svg")
    )
    return [f for f in out if f.name in SLIM_ASSETS] if slim else out


# ── the list ───────────────────────────────────────────────────────────────────────────────


class PackageList:
    def __init__(self, path: Path):
        self.path = path.resolve()
        try:
            self.data = json.loads(self.path.read_text(encoding="utf-8"))
        except Exception as e:
            raise SystemExit(f"cannot read the package list {path}: {e}") from e
        base = self.path.parent
        self.roots = {k: (base / v).resolve() for k, v in (self.data.get("roots") or {}).items()}
        for k, v in self.roots.items():
            if not v.is_dir():
                raise SystemExit(f"package list: root {k!r} is {v}, which is not a directory")
        self._fps: dict[str, set[str]] | None = None
        self.salts_file: Path | None = None  # the core-alone build's --salts; a list names its own
        self.unsealed = False  # only the core-alone build with no key named; a list always seals

    @classmethod
    def core_alone(cls, salts: Path | None) -> PackageList:
        """No list: core's own plugin, from the checkout this script sits in. The checkout is the root `core` and its
        registry the only one; the config is assets/core-plugin.json. With no --salts the build is UNSEALED, said."""
        self = cls.__new__(cls)
        self.path = CORE_PLUGIN_CONFIG
        rel = CORE_PLUGIN_CONFIG.relative_to(CORE).as_posix()
        self.data = {
            "roots": {"core": str(CORE)},
            "registries": ["core"],
            "out": "core:.build",
            "packages": [{"kind": "plugin", "config": f"core:{rel}"}],
        }
        self.roots = {"core": CORE}
        self._fps = None
        self.salts_file = salts.resolve() if salts else None
        if self.salts_file is not None and not self.salts_file.is_file():
            raise SystemExit(f"--salts {salts}: not a file")
        self.unsealed = salts is None
        return self

    def ref(self, s: str) -> Path:
        """'<root>:<relpath>' → an absolute path."""
        if ":" not in s:
            raise SystemExit(f"package list: {s!r} names no root (write it as <root>:<path>)")
        r, rel = s.split(":", 1)
        if r not in self.roots:
            raise SystemExit(f"package list: unknown root {r!r} in {s!r}")
        return self.roots[r] / rel

    def registry(self, root: str) -> list[dict]:
        p = self.roots[root] / "agents" / "registry.json"
        if not p.is_file():
            raise Refused(f"root {root!r} has no agents/registry.json")
        reg = json.loads(p.read_text(encoding="utf-8"))["agents"]
        return list(reg.values()) if isinstance(reg, dict) else reg

    def fingerprints(self) -> dict[str, set[str]]:
        """signer → every fingerprint any named registry records for it. Two different ones for
        one signer are refused where they are used."""
        if self._fps is None:
            fps: dict[str, set[str]] = {}
            for r in self.data.get("registries") or list(self.roots):
                p = self.roots[r] / "agents" / "registry.json"
                if not p.is_file():
                    continue
                reg = json.loads(p.read_text(encoding="utf-8"))["agents"]
                for a in reg.values() if isinstance(reg, dict) else reg:
                    if a.get("slug") and a.get("fingerprint"):
                        fps.setdefault(a["slug"], set()).add(a["fingerprint"])
            self._fps = fps
        return self._fps

    def salt(self, slug: str) -> str:
        if self.unsealed:  # an unsealed build seals nothing; asking for a salt here is a builder bug, never a fallback
            raise Refused(f"an unsealed local build asked for {slug!r}'s salt: it seals nothing")
        spec = self.data.get("signing-salts")
        if self.salts_file is not None:
            spec, data = str(self.salts_file), json.loads(self.salts_file.read_text(encoding="utf-8"))
        elif not spec:
            raise Refused("the package list names no signing-salts file")
        else:
            data = json.loads(self.ref(spec).read_text(encoding="utf-8"))
        a = (data.get("agents") or {}).get(slug) or {}
        s = a.get("signing_salt")
        if not s:
            raise Refused(f"no locked signing salt for {slug!r} in {spec} — cannot seal as the owner")
        return s

    def roll(self, name: str, root: str) -> list[str]:
        """The slugs a roll names: its pattern picks each member's key out of the document; the
        key is joined to the root's registry. Every member must resolve — never skipped."""
        spec = (self.data.get("rolls") or {}).get(name)
        if not spec:
            raise Refused(f"the list names no roll {name!r}")
        f = self.ref(spec["file"])
        if not f.is_file():
            raise Refused(f"roll {name!r}: {spec['file']} is not there ({f})")
        text = f.read_text(encoding="utf-8")
        keys = re.findall(spec["member"], text)
        if not keys:
            raise Refused(f"roll {name!r}: the pattern found no member in {spec['file']}")
        by = {a.get(spec.get("registry-key", "fp8")): a for a in self.registry(root)}
        out = []
        for k in keys:
            a = by.get(k)
            if a is None:
                raise Refused(f"roll {name!r}: member {k} has no entry in {root}'s registry")
            out.append(a["slug"])
        return out


# ── seals ──────────────────────────────────────────────────────────────────────────────────


# The signing gate's test mode reaches the sealer: a throwaway master salt and the gate named beside it, both or
# neither (2026-10-18, so the builder's own suite runs whole in a seat with no custody). The sealer honours the gate
# path only beside a test salt; without the pair, every seal goes to the gate the gardener trusted, as before.
GATE_TEST_MODE = ("BONSAI_GATE_TEST_MASTER_SALT", "BONSAI_GATE_BIN")


def _node(args: list[str], env_root: Path | None, cwd: Path | None = None) -> tuple[int, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith("BONSAI_")}
    if all(os.environ.get(k) for k in GATE_TEST_MODE):
        env.update({k: os.environ[k] for k in GATE_TEST_MODE})
    if env_root is not None:
        env["BONSAI_GARDEN"] = str(env_root)
    if shutil.which("node") is None:
        return 127, "node not found"
    r = subprocess.run(
        ["node", *args], capture_output=True, text=True, env=env, timeout=120, cwd=str(cwd) if cwd else None
    )
    return r.returncode, (r.stdout + r.stderr).strip()


def verify_seal(path: Path, form: str, keys: str, root: Path, pl: PackageList, owner: str | None = None) -> str:
    """Core's verifier, then the registry: 'ok' or the reason. `form` is 'sidecar' or 'embedded'.
    In garden mode the signer's key comes from `root`; in published mode the site answers."""
    verb = "verify-sidecar" if form == "sidecar" else "verify"
    rc, out = _node([str(SIGN_CLI), verb, "--file", str(path), "--keys", keys], root if keys == "garden" else None)
    first = out.splitlines()[0] if out else "no output"
    if rc != 0 or not first.startswith("ok"):
        return " ".join(first.split())
    signer = re.search(r"^\s*signer:\s*(\S+)", out, re.M)
    fp = re.search(r"^\s*fingerprint:\s*([0-9a-f]+)", out, re.M)
    signer, fp = (signer.group(1) if signer else ""), (fp.group(1) if fp else "")
    if owner is not None and signer != owner:
        return f"sealed by {signer!r}, not the owner {owner!r}"
    known = pl.fingerprints().get(signer)
    if known is not None:
        if len(known) > 1:
            return f"the list's registries disagree on {signer}'s key ({', '.join(sorted(known))})"
        if fp not in known:
            return (
                f"verifies only under {fp[:8]}, a key the registry does not name for {signer} "
                f"(it names {next(iter(known))[:8]}) — a retired key still on disk is not a pass"
            )
    elif keys == "garden":
        return f"{signer} is in no registry the list names; garden keys cannot vouch for it"
    return "ok"


def seal_as_owner(
    path: Path, owner: str, pl: PackageList, sign_root: Path, target: str, keys: str, verify_root: Path
) -> str:
    """Seal v2 with the owner's own key, as owner (core's sign-sidecar, HKDF), then watch it
    verify as the owner. The seal's `target` is the path inside the package: the stage carries
    agents/registry.json at its root, and a seal root is found by that marker, so the target is
    right wherever the package is unpacked. It is signed, so it is never rewritten after sealing
    (the v1 builder rewrote it — possible only because v1 left it unsigned)."""
    rc, out = _node(
        [
            str(SIGN_CLI),
            "sign-sidecar",
            "--agent-salt",
            pl.salt(owner),
            "--file",
            str(path),
            "--as",
            owner,
            "--role",
            "owner",
        ],
        sign_root,
    )
    if rc != 0:
        raise Refused(f"sealing {path.name} as {owner} failed: {' '.join(out.split())[:300]}")
    side = _sidecar_of(path)
    if side is None:
        raise Refused(f"{target}: sealing as {owner} wrote no sidecar beside {path.name}")
    data = json.loads(side.read_text())
    want = target.split("/", 1)[1] if "/" in target else target
    if data.get("format") != "bonsaisig/2" or data.get("target") != want or data.get("role") != "owner":
        raise Refused(
            f"{target}: the seal is not a v2 owner seal at {want!r} "
            f"({data.get('format')}, target {data.get('target')!r}, role {data.get('role')!r})"
        )
    v = verify_seal(path, "sidecar", keys, verify_root, pl, owner=owner)
    if v != "ok":
        raise Refused(f"{target}: the owner's seal does not verify ({v})")
    return data["fingerprint"]


# ── one skill folder: the logic every kind shares ──────────────────────────────────────────


class Unit:
    """One skill folder inside a package: a kin vessel or a standalone skill."""

    def __init__(self, name: str, owner: str, src: Path, root_name: str, root: Path, kind: str, spec: dict):
        self.name, self.owner, self.src = name, owner, src
        self.root_name, self.root, self.kind, self.spec = root_name, root, kind, spec


def _shared_bodies(pl: PackageList, root: str, slug: str) -> list[tuple[str, Path]]:
    """Nested bodies that share this vessel (registry `shintai: shared:<slug>`). Lifted."""
    out = []
    for a in pl.registry(root):
        if a.get("shintai") == f"shared:{slug}" and a.get("path", "").startswith(f"agents/{slug}/"):
            out.append((a["slug"], pl.roots[root] / a["path"]))
    return out


def _copy_body_part(src: Path, dst: Path, slug: str) -> None:
    """A nested body: top-level .md, references/, small assets, public identity. Lifted."""
    dst.mkdir(parents=True)
    for f in _tracked_glob(src, "*.md") + _tracked_glob(src, "*.md.bonsaisig"):
        _cp(f, dst / f.name)
    if (src / "references").is_dir():
        _copytree(src / "references", dst / "references")
    for f in _asset_files(src / "assets", False):
        _cp(f, dst / "assets" / f.name)
    ident = src / "identity"
    if ident.is_dir():
        keep = [ident / n.format(slug=slug) for n in IDENTITY_KEEP] + _tracked_glob(ident, IDENTITY_KEEP_GLOB)
        for f in keep:
            if f.is_file():
                _cp(f, dst / "identity" / f.name)


def resolve_body(pl: PackageList, root: str, slug: str, spec: dict) -> Unit:
    for a in pl.registry(root):
        if a.get("slug") == slug:
            break
    else:
        raise Refused(f"{slug}: not in {root}'s registry — the list names a kin whose vessel cannot be found")
    if str(a.get("shintai", "")).startswith("shared:"):
        raise Refused(f"{slug}: their vessel is shared ({a['shintai']}); it travels inside that archive")
    src = pl.roots[root] / (a.get("path") or f"agents/{slug}")
    if not (src / "SKILL.md").is_file():
        raise Refused(f"{slug}: no vessel at {src} (no SKILL.md) — refused, never skipped")
    return Unit(slug, slug, src, root, pl.roots[root], "body", spec)


def resolve_skill(pl: PackageList, ref: str, spec: dict) -> Unit:
    src = pl.ref(ref)
    root_name = ref.split(":", 1)[0]
    if not (src / "SKILL.md").is_file():
        raise Refused(f"{ref}: no SKILL.md — refused, never skipped")
    ident = src / "references" / "identity.md"
    if not ident.is_file():
        raise Refused(f"{ref}: no references/identity.md — the skill names no owner")
    m = re.search(r"^tended-by:\s*\"?([\w-]+)", ident.read_text(encoding="utf-8"), re.M)
    if not m:
        raise Refused(f"{ref}: identity.md names no tended-by")
    fm = FM_RE.match((src / "SKILL.md").read_text(encoding="utf-8"))
    nm = re.search(r"^name:\s*\"?([\w.-]+)", fm.group(1) if fm else "", re.M)
    if not nm:
        raise Refused(f"{ref}: SKILL.md has no name")
    return Unit(nm.group(1), m.group(1), src, root_name, pl.roots[root_name], "skill", spec)


def _include_pairs(spec: dict) -> list:
    """(dest, ref) for every `include` entry. A destination may name several refs (a list), so one directory can be
    built from a few globs without shipping the sources and notes beside it."""
    out = []
    for dest, ref in (spec.get("include") or {}).items():
        for r in ref if isinstance(ref, list) else [ref]:
            out.append((dest, r))
    return out


def _shipped_paths(u: Unit, pl: PackageList) -> list[str]:
    inc = []
    for _dest, ref in _include_pairs(u.spec):
        p = pl.ref(ref)
        inc.append(str(p.parent if "*" in p.name else p))
    if u.kind == "skill":
        return [str(u.src), *inc]
    paths = [
        str(u.src / p)
        for p in (
            "SKILL.md",
            "SKILL.md.bonsaisig",
            ".SKILL.md.bonsaisig",
            "references",
            "patterns.md",
            "channel.yaml",
            "assets",
            "identity",
            "scripts",
            "memory/initial",
        )
    ]
    paths += [str(sub) for _s, sub in _shared_bodies(pl, u.root_name, u.name)]
    for m in u.spec.get("initial-memory", []):
        paths.append(str(u.src / m))
    return paths + inc


def _dirty(u: Unit, pl: PackageList) -> str:
    """Uncommitted changes in anything that ships, in whichever repo it sits."""
    out = []
    for p in _shipped_paths(u, pl):
        if Path(p).exists():
            top = _repo_top(Path(p))
            r = _git(top, "status", "--porcelain", "--", os.path.relpath(p, top))
            if r:
                out.append(r)
    return "\n".join(out)


def stage_unit(u: Unit, stage: Path, pl: PackageList, keys: str, review: bool, counter: Path) -> dict:
    """Stage one skill folder, stamp it, carry the check, seal it. Returns its summary."""
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)
    src = u.src
    dirty = _dirty(u, pl)
    if dirty and not review:
        raise Refused(
            f"{u.name}: uncommitted changes in what ships — the stamp would name a source "
            f"it was not packaged from; commit first (or --review for the owner's look):\n{dirty}"
        )

    # the source SKILL.md: sealed by its owner, with the integrity line first
    repo_skill = (src / "SKILL.md").read_text(encoding="utf-8")
    if first_body_line(repo_skill) != INTEGRITY_LINE:
        raise Refused(
            f"{u.name}: SKILL.md's first body line is not the integrity line — "
            f"`package.py --write-integrity-line {src / 'SKILL.md'}`, then the owner "
            f"({u.owner}) reviews and re-seals"
        )
    if _sidecar_of(src / "SKILL.md") is None:
        raise Refused(f"{u.name}: SKILL.md.bonsaisig missing — the source is not sealed by its owner")
    v = verify_seal(src / "SKILL.md", "sidecar", keys, u.root, pl, owner=u.owner)
    if v != "ok":
        raise Refused(f"{u.name}: the source SKILL.md seal is refused: {v}")

    if u.kind == "body" and not (src / "references" / "about-me.md").is_file():
        raise Refused(f"{u.name}: no references/about-me.md — the vessel has not crossed to 3.0")
    declared = GATE_MOD._declared_version(src / "SKILL.md") or ""
    vm = re.fullmatch(r"([0-9]+\.[0-9]+\.[0-9]+)(\.[0-9]+)?(-[0-9A-Za-z.-]+)?", declared)
    if not vm:
        raise Refused(
            f"{u.name}: SKILL.md declares no MAJOR.MINOR.PATCH version "
            f"(the gate reads {declared or 'none'!r}) — nothing to stamp"
        )
    version, repo_build, label = vm.group(1), vm.group(2), vm.group(3) or ""
    build_num = repo_build.lstrip(".") if repo_build else str(_next_build(counter, u.name, version))
    top = _repo_top(src)
    head = _git(top, "rev-parse", "--short", "HEAD")
    source = f"{top.name}@{head}" + ("+uncommitted" if dirty else "")
    build_id = f"{version}.{build_num}{label}-{_dt.datetime.now(_dt.timezone.utc).strftime('%Y%m%dT%H%MZ')}"
    body8 = body_hash(repo_skill)[:8]
    tfm = re.match(r"^(---\n.*?\n---\n)(.*)$", translate(src / "SKILL.md", version), re.S)
    stamped = tfm.group(1) + f"{STAMP_PREFIX} {build_id} · body {body8}\n\n" + tfm.group(2)
    if body_hash(stamped) != body_hash(repo_skill):
        raise Refused(f"{u.name}: packaged SKILL.md body differs from the source's")
    if first_body_line(stamped) != INTEGRITY_LINE:
        raise Refused(f"{u.name}: the stamped SKILL.md lost its integrity line")
    (stage / "SKILL.md").write_text(stamped, encoding="utf-8")

    every = _every_kin(pl, review) if u.kind == "body" else None
    bundle = _bundle(pl, u, review) if u.kind == "body" else []
    if u.kind == "body":
        _stage_body(u, stage, pl)
        _stage_greeting_kit(u, stage, pl)
        if every:
            if (stage / every[0]).exists():
                raise Refused(
                    f"{u.name}: the body carries its own {every[0]}; the builder generates it "
                    f"from the garden's fragment — a hand-kept copy is a second master"
                )
            (stage / every[0]).parent.mkdir(parents=True, exist_ok=True)
            (stage / every[0]).write_text(every[1], encoding="utf-8")
        for dest, bsrc in bundle:
            d = stage / dest
            if d.exists():
                own = d.read_bytes()
                if own != bsrc.read_bytes() and not _is_tombstone(own):
                    raise Refused(
                        f"{u.name}: its own {dest} is neither the canonical {bsrc.name} nor a "
                        f"tombstone. A stale copy: tombstone it. The body's own document: opt out "
                        f'with "bundle": {{"files": {{"{dest}": null}}}} in its list entry'
                    )
                d.unlink()
            for n in _sidecar_names(d.name):
                (d.parent / n).unlink(missing_ok=True)
            _cp(bsrc, d)
            side = _sidecar_of(bsrc)
            if side is not None:  # the sidecar keeps the name form it has at home
                _cp(side, d.parent / (("." if side.name.startswith(".") else "") + d.name + _SIG))
    else:
        exclude = list(u.spec.get("exclude") or [])
        for f in _tracked_under(src):
            rel = f.relative_to(src.resolve())
            top_name = rel.parts[0]
            if (
                top_name in ("SKILL.md", "SKILL.md.bonsaisig", ".SKILL.md.bonsaisig")
                or _skipped(rel)
                or _excluded(top_name, exclude)
            ):
                continue
            _cp(f, stage / rel)
    for dest, ref in _include_pairs(u.spec):
        p = pl.ref(ref)
        if "*" in p.name:
            hits = sorted(_tracked_glob(p.parent, p.name))
            if not hits:
                raise Refused(f"{u.name}: include {ref} matches nothing")
            (stage / dest).mkdir(parents=True, exist_ok=True)
            for x in hits:
                _cp(x, stage / dest / x.name)
                side = _sidecar_of(x)
                if side is not None:
                    _cp(side, stage / dest / side.name)
        elif p.is_dir():
            _copytree(p, stage / dest)
        elif p.is_file():  # a single file lands at `dest`, its seal beside it, as a glob's hits do
            if not _cp(p, stage / dest):
                raise Refused(f"{u.name}: include {ref} is not committed")
            side = _sidecar_of(p)
            if side is not None:
                _cp(side, (stage / dest).parent / side.name)
        else:
            raise Refused(f"{u.name}: include {ref} is not there")

    # what the package needs to check itself
    if (stage / INTEGRITY_DIR).exists() or (stage / "agents" / "registry.json").exists():
        raise Refused(
            f"{u.name}: the source already has {INTEGRITY_DIR}/ or agents/registry.json; "
            f"the builder will not overwrite either"
        )
    idir = stage / INTEGRITY_DIR
    (idir / "bonsai-garden-sign").mkdir(parents=True)
    if not _cp(VERIFY_MANIFEST, idir / VERIFY_MANIFEST.name):
        raise Refused(f"{VERIFY_MANIFEST} is not committed in core — the check cannot travel")
    for n in SIGN_SHIP:
        s = SIGN_DIR / n
        if s.is_dir():
            _copytree(s, idir / "bonsai-garden-sign" / n)
        elif not (s.is_file() and _cp(s, idir / "bonsai-garden-sign" / n)):
            raise Refused(f"core's verifier is incomplete: {s} missing or not committed")
    (stage / "agents").mkdir()
    (stage / "agents" / "registry.json").write_text(_marker(os.path.relpath(u.src.resolve(), u.root.resolve())))
    nested = sorted(p.relative_to(stage).as_posix() for p in stage.rglob("SKILL.md") if p.parent != stage)
    if nested:
        raise Refused(f"{u.name}: a package holds exactly one SKILL.md, at its root; nested: {', '.join(nested)}")

    for f in (idir / "bonsai-garden-sign").rglob("*"):
        if f.is_file() and f.read_bytes() != (SIGN_DIR / f.relative_to(idir / "bonsai-garden-sign")).read_bytes():
            raise Refused(f"{u.name}: the verifier copy differs from core's own ({f.name})")
    for f in (stage / GREETING_DIR).rglob("*") if (stage / GREETING_DIR).is_dir() else ():
        if f.is_file() and f.read_bytes() != (CORE / "skills" / f.relative_to(stage / GREETING_DIR)).read_bytes():
            raise Refused(f"{u.name}: the greeting kit copy differs from core's own ({f.name})")
    if u.kind == "body":
        # the version lock, on the stage exactly as it is installed (stamped): a body carrying two versions is
        # refused here, never shipped (W, 2026-10-16: three numbers in one shipped body)
        lock = GATE_MOD.version_lock_problems(stage)
        if lock:
            raise Refused(f"{u.name}: the version lock is broken — " + "; ".join(lock))
    # (a .pem is key-shaped too: PEMs are generated at build time, never shipped — Mori-shin, 09-23)
    keyish = [
        p.relative_to(stage).as_posix()
        for p in stage.rglob("*")
        if p.is_file() and (KEY_NAME.search(p.name) or KEY_BLOCK.search(p.read_bytes()))
    ]
    if keyish:
        raise Refused(f"{u.name}: key material reached the stage — refused: {', '.join(keyish)}")

    # every seal that ships must still hold, at the registry's key
    broken = []
    for f in sorted(stage.rglob("*")):
        if not f.is_file():
            continue
        rel = f.relative_to(stage).as_posix()
        if rel.startswith((INTEGRITY_DIR + "/", GREETING_DIR + "/")):
            continue  # core's verifier and greeting kit, copied byte for byte (checked above); their seals are their owners'
        if f.name.endswith(_SIG):
            if rel in ("SKILL.md.bonsaisig", ".SKILL.md.bonsaisig"):
                continue
            try:
                target = _target_of(f)
            except Refused as ex:
                broken.append(str(ex))
                continue
            if target is None or not target.is_file():
                broken.append(f"{rel}: orphaned seal")
                continue
            other = target.parent / (_sidecar_names(target.name)[1 if f.name == target.name + _SIG else 0])
            if other.is_file():
                broken.append(
                    f"{rel}: two sidecars for {target.name} ({f.name} and {other.name}) — refused, never preferred"
                )
                continue
            # a seal copied into the package is verified where it was made (a v2 seal names
            # its address), and the staged bytes must be exactly the sealed source's
            src_file = SOURCE_OF.get(str(target.resolve()))
            src_side = SOURCE_OF.get(str(f.resolve()))
            if src_file is None or src_side is None:
                broken.append(f"{rel}: no source recorded for this seal — it was not copied from a tracked file")
                continue
            if f.name == target.name + _SIG:  # the old name: the policy's verdict (phase 3)
                try:
                    _retired_name(src_file, src_side)
                except RetiredSidecarName as ex:
                    broken.append(f"{rel}: {ex}")
                    continue
            if src_file.read_bytes() != target.read_bytes() or src_side.read_bytes() != f.read_bytes():
                broken.append(f"{rel}: the staged copy differs from its sealed source")
                continue
            v = verify_seal(src_file, "sidecar", keys, u.root, pl)
        elif (
            f.suffix == ".md"
            and rel != "SKILL.md"
            and re.search(
                r"^sign:\s*$", (FM_RE.match(f.read_text("utf-8", errors="replace")) or [None, ""])[1] or "", re.M
            )
        ):
            v = verify_seal(f, "embedded", keys, u.root, pl)
        else:
            continue
        if v != "ok":
            broken.append(f"{rel}: {v}")
    if broken:
        raise Refused(f"{u.name}: shipped seal(s) refused — re-seal by the owner first: " + "; ".join(broken))

    if every and (not (stage / every[0]).is_file() or (stage / every[0]).read_text(encoding="utf-8") != every[1]):
        raise Refused(f"{u.name}: {every[0]} is missing or differs from the garden's fragment")
    for dest, bsrc in bundle:
        if not (stage / dest).is_file() or (stage / dest).read_bytes() != bsrc.read_bytes():
            raise Refused(f"{u.name}: bundled {dest} is missing or differs from its canonical home")

    sign_root = u.root
    if pl.unsealed:  # the core-alone build with no key named: nothing sealed, and the manifest says so
        fp = "unsealed"
        manifest = _manifest(stage, u.name, u.owner, version, build_id, u.kind, unsealed=UNSEALED_WHY)
    else:
        fp = seal_as_owner(stage / "SKILL.md", u.owner, pl, sign_root, f"{u.name}/SKILL.md", keys, u.root)
        manifest = _manifest(stage, u.name, u.owner, version, build_id, u.kind)
        seal_as_owner(manifest, u.owner, pl, sign_root, f"{u.name}/MANIFEST.json", keys, u.root)

    # the package's own check, run on the stage exactly as it runs at wake: ok, or (unsealed) UNSEALED, every file matching
    r = _wake_check(stage, keys, u.root, unsealed=pl.unsealed)
    if r is not None:
        raise Refused(f"{u.name}: the package's own integrity check says: {r}")
    return {
        "name": u.name,
        "owner": u.owner,
        "build": build_id,
        "source": source,
        "body": body8,
        "sealed_by": fp[:8],
        "manifest": hashlib.sha256(manifest.read_bytes()).hexdigest()[:8],
    }


def _every_kin(pl: PackageList, review: bool) -> tuple[str, str] | None:
    """(dest, text) for the crew-wide section a garden asks every body to carry, or None.

    A slim SKILL.md points at the garden's AGENTS.md for what every kin does alike; an installed
    package has no AGENTS.md beside it, so the rule that a package is self-contained breaks unless
    the section travels (Tasai, 2026-09-27). The list names the fragment:
        "every-kin": {"from": "<root>:<path to the fragment .md>", "to": "references/agents.md"}
    The copy is GENERATED here from the committed fragment, never kept by hand in a body."""
    spec = pl.data.get("every-kin")
    if not spec:
        return None
    src = pl.ref(spec["from"])
    dest = spec.get("to", "references/agents.md")
    if not src.is_file():
        raise Refused(f"every-kin: {spec['from']} is not there ({src})")
    if not _tracked(src):
        raise Refused(f"every-kin: {spec['from']} is not committed")
    top = _repo_top(src)
    if (
        not review
        and subprocess.run(
            ["git", "-C", str(top), "diff", "--quiet", "HEAD", "--", os.path.relpath(src, top)]
        ).returncode
    ):
        raise Refused(f"every-kin: {spec['from']} has uncommitted changes — commit first (or --review)")
    text = src.read_text(encoding="utf-8")
    m = FM_RE.match(text)
    body = (m.group(2) if m else text).lstrip("\n")
    return dest, (
        "<!-- GENERATED by package.py from the garden's every-kin fragment. Do not edit: edit the fragment. -->"
        f"\n\n{body.rstrip()}\n{EVERY_KIN_TRAILER}"
    )


def _is_tombstone(raw: bytes) -> bool:
    m = FM_RE.match(raw.decode("utf-8", "replace"))
    return bool(m and re.search(r"^status:\s*moved\s*$", m.group(1), re.M))


def _bundle(pl: PackageList, u: Unit, review: bool) -> list[tuple[str, Path]]:
    """(dest, source) for the shared documents a body carries, verbatim.

    A body that runs without the garden MCP cannot reach the codex or the routines at their
    canonical home, so they travel inside the package (the Aruji, 2026-10-01: everybody's shintai
    has that bundled in for stand-alone scenarios). The list names them, for every body, and a
    body's own entry may name more:
        "bundle": {"files": {"assets/codex.md": "<root>:<path>",
                             "assets/x.md": {"from": "<root>:<path>", "types": ["sai", "shin"]}}}
    and a body's own entry opts out of a list-wide file with null ("assets/codex.md": null), for a
    body whose file at that path is its own document, not a copy (Bonsai, 2026-10-02).
    `types` limits a file to bodies whose registry `type` is listed — the registry says who a
    document binds, never a slug list kept here. Copied byte for byte with the source's own
    sidecar, so the canonical seal travels: the package proves its copy is the original."""
    files: dict = {}
    for spec in (pl.data.get("bundle"), u.spec.get("bundle")):
        files.update((spec or {}).get("files") or {})
    if not files:
        return []
    kin_type = next((a.get("type") for a in pl.registry(u.root_name) if a.get("slug") == u.name), None)
    out = []
    for dest, ref in files.items():
        if ref is None:  # a body's own entry opts out of a list-wide file
            continue
        if isinstance(ref, dict):
            if "types" in ref and kin_type not in ref["types"]:
                continue
            ref = ref["from"]
        src = pl.ref(ref)
        if not src.is_file():
            raise Refused(f"bundle: {ref} is not there ({src})")
        m = FM_RE.match(src.read_text(encoding="utf-8"))
        if m and re.search(r"^status:\s*moved\s*$", m.group(1), re.M):
            raise Refused(f"bundle: {ref} is a tombstone (status: moved); name its new home in the list")
        side = _sidecar_of(src)
        top = _repo_top(src)
        for p in [src] + ([side] if side is not None else []):
            if not _tracked(p):
                raise Refused(f"bundle: {os.path.relpath(p, top)} is not committed")
            if (
                not review
                and subprocess.run(
                    ["git", "-C", str(top), "diff", "--quiet", "HEAD", "--", os.path.relpath(p, top)]
                ).returncode
            ):
                raise Refused(f"bundle: {os.path.relpath(p, top)} has uncommitted changes — commit first (or --review)")
        out.append((dest, src))
    return out


def _stage_body(u: Unit, stage: Path, pl: PackageList) -> None:
    """A kin vessel's files. Lifted from the crew builder."""
    src, slug = u.src, u.name
    slim = u.spec.get("assets") == "slim"
    (stage / "assets").mkdir()
    for f in _asset_files(src / "assets", slim):
        _cp(f, stage / "assets" / f.name)
    if (src / "references").is_dir():
        _copytree(src / "references", stage / "references")
    for f in ("patterns.md", "channel.yaml"):
        if (src / f).is_file():
            _cp(src / f, stage / f)
    ident = src / "identity"
    if ident.is_dir():
        keep = [ident / n.format(slug=slug) for n in IDENTITY_KEEP] + _tracked_glob(ident, IDENTITY_KEEP_GLOB)
        for f in keep:
            if f.is_file():
                _cp(f, stage / "identity" / f.name)
    for sub_slug, sub_src in _shared_bodies(pl, u.root_name, slug):
        _copy_body_part(sub_src, stage / sub_src.relative_to(src), sub_slug)
    # agent-owned tooling (spec §scripts/): the tracked tree ships, so what SKILL.md tells an installed kin to run is
    # there (W's scripts/memory/link-memory.sh was listed, instructed, and not shipped; W, 2026-10-16). A nested
    # SKILL.md inside it (the spec's "semantic groups, each with its own SKILL.md") cannot travel: the uploader refuses
    # a nested skill (Trime, 2026-09-26), so it is left out WITH its sidecar, and named, never silently.
    sdir = src / "scripts"
    if sdir.is_dir():
        for f in _tracked_under(sdir):
            rel = f.relative_to(sdir.resolve())
            if _skipped(rel):
                continue
            if rel.name in ("SKILL.md", "SKILL.md.bonsaisig", ".SKILL.md.bonsaisig"):
                print(
                    f"  ! {slug}: scripts/{rel.as_posix()} left out: a package holds one SKILL.md, at its root (the "
                    f"uploader refuses a nested skill); the instruction belongs in the body's own SKILL.md"
                )
                continue
            _cp(f, stage / "scripts" / rel)
    (stage / "memory").mkdir()
    for kind in ("working-state.md", "MEMORY.md"):
        (stage / "memory" / kind).write_text(_skeleton(slug, kind), encoding="utf-8")
    # A body the gate NAMES may carry initial memory; the list says which files. Never a journal.
    initial = list(u.spec.get("initial-memory") or [])
    if (src / "memory" / "initial").is_dir() and "memory/initial" not in initial:
        initial.append("memory/initial")
    if initial:
        if slug not in getattr(GATE_MOD, "INITIAL_MEMORY_BODIES", ()):
            raise Refused(
                f"{slug}: the list gives it initial memory, but the gate names only "
                f"{', '.join(GATE_MOD.INITIAL_MEMORY_BODIES)}"
            )
        for rel in initial:
            p = src / rel
            if "journal" in Path(rel).parts:
                raise Refused(f"{slug}: initial memory never includes a journal ({rel})")
            if p.is_dir():
                _copytree(p, stage / rel)
            elif p.is_file():
                if not _cp(p, stage / rel):
                    raise Refused(f"{slug}: initial memory {rel} is not committed")
            else:
                raise Refused(f"{slug}: initial memory {rel} is not there")
    mark = next(
        (
            src / "assets" / n.format(slug=slug)
            for n in MARK_NAMES
            if (src / "assets" / n.format(slug=slug)).exists() and _tracked(src / "assets" / n.format(slug=slug))
        ),
        None,
    )
    if mark is not None:
        _cp(mark, stage / "assets" / f"{slug}-mark.svg")  # published name, always
    elif u.spec.get("markless"):
        print(f"  ! {slug}: packaged WITHOUT a mark, as the list declares: {u.spec['markless']}")
    else:
        raise Refused(
            f"{slug}: no mark — neither assets/mark.svg nor assets/{slug}-mark.svg; "
            f"refusing to ship a markless vessel (a list may declare `markless` with a reason)"
        )
    if (stage / "assets").is_dir() and not any((stage / "assets").iterdir()):
        (stage / "assets").rmdir()


def _stage_greeting_kit(u: Unit, stage: Path, pl: PackageList) -> None:
    """A kin vessel carries the greeting kit *Every kin* points at, and its own registry row, so fill-greeting.py and
    text-card.py run where the body is installed (W, 2026-10-16: neither template nor fill script was in the
    package, so a standalone W could only reach the plain-text floor). The kit is core's, copied byte for byte with
    each file's own seal, laid out as core lays it out under scripts/greeting/. The row is the greeting's input and
    never a key source: agents/registry.json at the root stays the empty marker, and the verifier reads only that."""
    for rel in GREETING_KIT:
        src = CORE / "skills" / rel
        dst = stage / GREETING_DIR / rel
        if not _cp(src, dst):
            raise Refused(f"{u.name}: core's greeting kit is incomplete: {src} missing or not committed")
        side = _sidecar_of(src)
        if side is not None:
            _cp(side, dst.parent / side.name)
    row = next((a for a in pl.registry(u.root_name) if a.get("slug") == u.name), None)
    if row is None:
        raise Refused(f"{u.name}: not in {u.root_name}'s registry — no row for the greeting")
    if (stage / REGISTRY_ROW).exists():
        raise Refused(f"{u.name}: the source already has {REGISTRY_ROW}; the builder will not overwrite it")
    (stage / REGISTRY_ROW).parent.mkdir(parents=True, exist_ok=True)
    (stage / REGISTRY_ROW).write_text(
        json.dumps(
            {
                "_meta": {
                    "marker": "bonsai-registry-entry",
                    "note": f"{u.name}'s own row from {u.root_name}'s agents/registry.json at build, the input of the "
                    "greeting kit under scripts/greeting/ (fill-greeting.py --garden <this package>, text-card.py "
                    "--registry <this file>). Never a key source: the verifier reads agents/registry.json at the "
                    "root, the empty package marker, and the published keys decide.",
                },
                "agents": [row],
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


COUNTER: Path | None = None  # --counter: the garden's one build counter, when the build names it


def counter_file(out: Path) -> Path:
    """Where this build counts: the counter the build names (one per garden), else build-counter.json in its out."""
    return COUNTER or out / "build-counter.json"


def _next_build(counter: Path, name: str, version: str) -> int:
    try:
        data = json.loads(counter.read_text())
    except Exception:
        data = {}
    n = int(data.get(name, {}).get(version, 0)) + 1
    data[name] = {version: n}  # a new M.m.p resets the count (codex §9)
    counter.parent.mkdir(parents=True, exist_ok=True)
    counter.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")
    return n


def _manifest(
    stage: Path, slug: str, owner: str, version: str, build_id: str, kind: str, unsealed: str | None = None
) -> Path:
    """sha256 of every shipped byte. Lifted; `owner` and `kind` added so a standalone skill and a
    plugin can name whose seal the manifest carries. `unsealed` (the core-alone build with no key): the
    reason, written into the manifest, so its own check answers UNSEALED and never ok. It names no source:
    where a package was built from is the release's commit message, never a shipped file (2026-10-21)."""
    files = {}
    for f in sorted(stage.rglob("*")):
        if f.is_file() and f.relative_to(stage).as_posix() not in (
            "MANIFEST.json",
            "MANIFEST.json.bonsaisig",
            ".MANIFEST.json.bonsaisig",
        ):
            files[f"{slug}/{f.relative_to(stage).as_posix()}"] = hashlib.sha256(f.read_bytes()).hexdigest()
    m = stage / "MANIFEST.json"
    data = {
        "slug": slug,
        "owner": owner,
        "kind": kind,
        "version": version,
        "build": build_id,
        "algorithm": "sha256",
        "files": files,
    }
    if (stage / "SKILL.md").is_file():
        data["skill_body"] = skill_body_hash((stage / "SKILL.md").read_text(encoding="utf-8"))
    if unsealed:
        data["unsealed"] = unsealed
    m.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")
    return m


def skill_body_hash(text: str) -> str:
    """sha256 of SKILL.md below its frontmatter: CRLF read as LF, outer whitespace trimmed.

    Claude's skill upload rewrites SKILL.md's frontmatter on install (found 2026-10-02: two companion bodies and
    Trime 3.x installed, every file matched but SKILL.md). The harness owns that block; the body is
    what the kin reads and what must match. verify-manifest.mjs computes the same, byte for byte."""
    t = text.replace("\r\n", "\n")
    if t.startswith("---\n"):
        i = t.find("\n---\n", 3)
        if i >= 0:
            t = t[i + 5 :]
    return hashlib.sha256(t.strip(" \t\r\n").encode("utf-8")).hexdigest()


def _wake_check(stage: Path, keys: str, root: Path, script: Path | None = None, unsealed: bool = False) -> str | None:
    """None when the package's own check answers as it must, else what it said. Sealed: ok. Unsealed: UNSEALED with
    every file matching, exit 1 (the integrity line stops on it); an ok there would mean an unsealed package passes."""
    script = script or stage / INTEGRITY_DIR / VERIFY_MANIFEST.name
    rc, out = _node([str(script), "--dir", str(stage), "--keys", keys], root if keys == "garden" else None)
    first = (out.splitlines() or ["no output"])[0]
    if unsealed:
        good = rc == 1 and first.startswith("UNSEALED") and "files match" in first
    else:
        good = rc == 0 and first.startswith("ok")
    return None if good else " ".join(out.split())


def _gate(args: list[str]) -> tuple[bool, str]:
    r = subprocess.run([sys.executable, *args], capture_output=True, text=True)
    return r.returncode == 0, (r.stdout + r.stderr).rstrip()


def _zip(stage: Path, archive: Path, wrapper: str | None) -> None:
    bad = sorted(
        f.relative_to(stage).as_posix()
        for f in stage.rglob("*")
        if f.is_file()
        and not UPLOAD_PATH_OK.match(
            f"{wrapper}/{f.relative_to(stage).as_posix()}" if wrapper else f.relative_to(stage).as_posix()
        )
    )
    if bad:
        raise Refused(
            f"{archive.stem}: the upload refuses these paths (only A-Z a-z 0-9 . - _ /): "
            + ", ".join(bad[:8])
            + (" …" if len(bad) > 8 else "")
        )
    if archive.exists():
        archive.unlink()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(stage.rglob("*")):
            if f.is_file():
                rel = f.relative_to(stage).as_posix()
                z.write(f, f"{wrapper}/{rel}" if wrapper else rel)


def _within_file_ceiling(where: str, folder: Path) -> None:
    """Refuse a skill folder of more files than the app takes, before anything is zipped."""
    n = sum(1 for f in folder.rglob("*") if f.is_file())
    if n > MAX_UNIT_FILES:
        seals = sum(1 for f in folder.rglob("*.bonsaisig") if f.is_file())
        raise Refused(
            f"{where}: {n} files ({seals} of them seals), over the {MAX_UNIT_FILES} a skill may hold: the Claude app "
            "refuses it"
        )


# ── the four kinds ─────────────────────────────────────────────────────────────────────────


def package_unit(u: Unit, out: Path, pl: PackageList, keys: str, review: bool) -> dict:
    stage = _stage_base() / u.name
    s = stage_unit(u, stage, pl, keys, review, counter_file(out))
    ok, msg = _gate(
        [str(SKILL_GATE), "--packaged", str(stage), "--keys", keys]
        + (["--garden", str(u.root)] if keys == "garden" else [])
        + (["--unsealed"] if pl.unsealed else [])
    )
    if not ok:
        raise Refused(f"{u.name}: skill gate FAIL\n{msg}")
    _within_file_ceiling(u.name, stage)
    archive = out / f"{u.name}.zip"
    _zip(stage, archive, u.name)
    if u.kind == "body":
        ok, msg = _gate([str(SHINTAI_GATE), "--packaged", str(archive)])
        if not ok:
            archive.unlink(missing_ok=True)
            raise Refused(f"{u.name}: shintai gate FAIL\n{msg}")
    ceiling = int(u.spec.get("max-bytes", MAX_ARCHIVE_BYTES))
    if archive.stat().st_size > ceiling:
        size = archive.stat().st_size
        archive.unlink(missing_ok=True)
        raise Refused(f"{u.name}: archive is {size:,} B, over the {ceiling:,} B ceiling")
    shutil.copy2(archive, out / f"{u.name}.skill")
    s.update(archive=str(archive), bytes=archive.stat().st_size, files=len(zipfile.ZipFile(archive).namelist()))
    return s


def package_plugin(spec: dict, out: Path, pl: PackageList, keys: str, review: bool, write_units: bool = False) -> dict:
    """A plugin is configuration over the same units: skills/<name>/ each staged by stage_unit,
    plus plugin.json and named files, plus a root MANIFEST.json sealed by the plugin's owner."""
    cfg = spec
    if "config" in spec:
        cfg = {**json.loads(pl.ref(spec["config"]).read_text(encoding="utf-8")), **spec}
    name, owner = cfg["name"], cfg["owner"]
    stage = _stage_base() / f"{name}.plugin"
    if stage.exists():
        shutil.rmtree(stage)
    (stage / ".claude-plugin").mkdir(parents=True)
    src_pj = json.loads(pl.ref(cfg["plugin-json"]).read_text(encoding="utf-8"))
    pj = {k: v for k, v in src_pj.items() if k in PLUGIN_JSON_KEYS}
    extra = {k: v for k, v in src_pj.items() if k not in PLUGIN_JSON_KEYS}
    if isinstance(pj.get("repository"), dict):  # the schema wants a string
        extra["repository"] = pj["repository"]
        pj["repository"] = pj["repository"].get("url") or ""
        if not pj["repository"]:
            del pj["repository"]
    (stage / ".claude-plugin" / "plugin.json").write_text(json.dumps(pj, indent=2, ensure_ascii=False) + "\n")
    if extra:
        (stage / "bonsai-plugin.json").write_text(json.dumps(extra, indent=2, ensure_ascii=False) + "\n")
        print(
            f"  ! {name}: plugin.json keys outside the schema moved to bonsai-plugin.json: {', '.join(sorted(extra))}"
        )
    for dest, ref in (cfg.get("files") or {}).items():
        p = pl.ref(ref)
        if p.is_dir():
            # a whole tracked tree (the MCP server, 2026-10-05): only what git tracks, nothing
            # skipped by name, and a tombstone anywhere in it is refused like a named one
            srcs = [f for f in _tracked_under(p) if not _skipped(f.relative_to(p.resolve()))]
            if not srcs:
                raise Refused(f"{name}: {ref} is a directory with no tracked file — nothing to ship")
            for f in srcs:
                if f.suffix == ".md" and re.search(r"^status:\s*moved", f.read_text("utf-8", errors="replace"), re.M):
                    raise Refused(
                        f"{name}: {ref}/{f.relative_to(p.resolve())} is a tombstone (status: moved) "
                        f"— refusing to ship a redirect stub"
                    )
                _cp(f, stage / dest / f.relative_to(p.resolve()))
            continue
        if not p.is_file():
            raise Refused(f"{name}: {ref} is not there")
        if re.search(r"^status:\s*moved", p.read_text("utf-8", errors="replace"), re.M):
            raise Refused(f"{name}: {ref} is a tombstone (status: moved) — refusing to ship a redirect stub")
        if not _cp(p, stage / dest):
            raise Refused(f"{name}: {ref} is not committed — a plugin ships only tracked files")
    # the same refusal every body stage gets (Tasai's hard requirement, 2026-09-24), over the plugin's
    # own files too: a tree copied in whole could carry a key a named file never would
    keyish = [
        q.relative_to(stage).as_posix()
        for q in stage.rglob("*")
        if q.is_file() and (KEY_NAME.search(q.name) or KEY_BLOCK.search(q.read_bytes()))
    ]
    if keyish:
        raise Refused(f"{name}: key material reached the plugin stage — refused: {', '.join(keyish)}")
    units: list[Unit] = []
    for b in cfg.get("bodies") or []:
        root = b.get("root") or cfg.get("root")
        slugs = pl.roll(b["roll"], root) if "roll" in b else [b["slug"]]
        skip = b.get("skip") or {}  # {slug: reason}: a roll member carried elsewhere
        for slug in slugs:
            if slug in skip:
                print(f"  · {name}: {slug} left out of the {b.get('roll', 'list')} roll: {skip[slug]}")
                continue
            a = next((x for x in pl.registry(root) if x.get("slug") == slug), {})
            if str(a.get("shintai", "")).startswith("shared:"):
                continue  # travels inside its parent's vessel (registry shintai: shared:<parent>)
            units.append(resolve_body(pl, root, slug, {**cfg.get("body-defaults", {}), **b}))
    for sref in cfg.get("skills") or []:
        sspec = sref if isinstance(sref, dict) else {"skill": sref}
        units.append(resolve_skill(pl, sspec["skill"], sspec))
    summaries = []
    for u in units:
        s = stage_unit(u, stage / "skills" / u.name, pl, keys, review, counter_file(out))
        ok, msg = _gate(
            [str(SKILL_GATE), "--packaged", str(stage / "skills" / u.name), "--keys", keys]
            + (["--garden", str(u.root)] if keys == "garden" else [])
            + (["--unsealed"] if pl.unsealed else [])
        )
        if not ok:
            raise Refused(f"{name}: skills/{u.name}: skill gate FAIL\n{msg}")
        if u.kind == "body":
            ok, msg = _gate([str(SHINTAI_GATE), "--packaged", str(stage / "skills" / u.name)])
            if not ok:
                raise Refused(f"{name}: skills/{u.name}: shintai gate FAIL\n{msg}")
        _within_file_ceiling(f"{name}: skills/{u.name}", stage / "skills" / u.name)
        summaries.append(s)
    head_root = pl.roots[cfg.get("root") or next(iter(pl.roots))]
    top = _repo_top(head_root)
    build_id = f"{pj.get('version', '0.0.0')}-{_dt.datetime.now(_dt.timezone.utc).strftime('%Y%m%dT%H%MZ')}"
    source = f"{top.name}@{_git(top, 'rev-parse', '--short', 'HEAD')}" + (
        "+uncommitted" if any(s["source"].endswith("+uncommitted") for s in summaries) else ""
    )
    # the root marker, as every skill folder gets: a v2 seal names its file's address from the
    # nearest agents/registry.json, and a plugin staged in a temp dir had none, so its MANIFEST
    # could not be sealed at all (NO_SEAL_ROOT, masked by the signing gate as "not a seal v2
    # payload"; found 2026-09-27 by the Bonsai discussion seat). It also stops a root search at
    # the plugin, so the wake check can never borrow keys from a garden above it.
    if (stage / "agents").exists():
        raise Refused(f"{name}: the plugin stage already has agents/; the builder will not overwrite it")
    (stage / "agents").mkdir()
    (stage / "agents" / "registry.json").write_text(_marker(None))
    if pl.unsealed:
        manifest = _manifest(stage, name, owner, pj.get("version", "0.0.0"), build_id, "plugin", unsealed=UNSEALED_WHY)
        fp = "unsealed"
    else:
        manifest = _manifest(stage, name, owner, pj.get("version", "0.0.0"), build_id, "plugin")
        fp = seal_as_owner(manifest, owner, pl, head_root, f"{name}/MANIFEST.json", keys, head_root)
    probe = next((stage / "skills" / s["name"] / INTEGRITY_DIR / VERIFY_MANIFEST.name for s in summaries), None)
    if probe is None:
        raise Refused(f"{name}: a plugin with no skill has nothing to check itself with")
    r = _wake_check(stage, keys, head_root, probe, unsealed=pl.unsealed)
    if r is not None:
        raise Refused(f"{name}: the plugin's own integrity check says: {r}")
    claude = shutil.which("claude")
    if claude:
        r = subprocess.run([claude, "plugin", "validate", str(stage)], capture_output=True, text=True)
        if r.returncode != 0 or "Validation passed" not in r.stdout + r.stderr:
            raise Refused(
                f"{name}: `claude plugin validate` fails the staged plugin: "
                + " ".join((r.stdout + r.stderr).split())[-400:]
            )
    else:
        print(f"  ! {name}: NOT validated — no `claude` CLI on PATH to run `claude plugin validate`")
    archive = out / f"{name}.plugin"
    _zip(stage, archive, None)
    ceiling = int(cfg.get("max-bytes", 40 * 1024 * 1024))
    if archive.stat().st_size > ceiling:
        size = archive.stat().st_size
        archive.unlink(missing_ok=True)
        raise Refused(f"{name}: plugin is {size:,} B, over the {ceiling:,} B ceiling")
    shutil.copy2(archive, out / f"{name}.zip")  # the upload takes .zip only; same bytes
    # --units (W's A4, 2026-10-18: a sealed bonsai.skill ships as the plugin carries it): each skill the plugin bundles,
    # written as its own <name>.skill from the plugin's own stage, after the plugin passed every gate. The same bytes,
    # the same seals: no second stamp, no second build of one unit to drift from the first.
    unit_archives = []
    if write_units:
        for u in units:
            ua = out / f"{u.name}.skill"
            _zip(stage / "skills" / u.name, ua, u.name)
            unit_archives.append(ua.name)
    return {
        "name": name,
        "owner": owner,
        "build": build_id,
        "source": source,
        "sealed_by": fp[:8],
        "archive": str(archive),
        "bytes": archive.stat().st_size,
        "files": len(zipfile.ZipFile(archive).namelist()),
        "skills": [s["name"] for s in summaries],
        "units": unit_archives,
    }


def expand(pl: PackageList, only: set[str] | None) -> list[tuple[str, dict]]:
    """→ [(kind, spec)] with every roll expanded; refusal of a missing vessel happens at resolve."""
    jobs = []
    # a roll member the list ALSO names as its own body is packaged once, from that explicit entry
    # (Bonsai, on the crew roll, lives in core; the roll resolved him in another root and refused;
    # Jisai, 2026-09-27)
    explicit = {p.get("slug") for p in pl.data.get("packages") or [] if p.get("kind") == "body"}
    for p in pl.data.get("packages") or []:
        kind = p.get("kind")
        if kind == "bodies":
            try:
                slugs = pl.roll(p["roll"], p["root"])
            except Refused as e:
                jobs.append(("refused", {"name": p.get("name", p["roll"]), "why": str(e)}))
                continue
            shared = {a["slug"] for a in pl.registry(p["root"]) if str(a.get("shintai", "")).startswith("shared:")}
            for s in slugs:
                if s in shared:
                    continue  # travels inside its parent's vessel
                if s in explicit:
                    print(f"  · {s}: on the {p['roll']} roll and named as its own body; packaged once, from that entry")
                    continue
                # a roll-wide spec, with the list's per-slug overrides on top (e.g. one body's max-bytes)
                over = (p.get("overrides") or {}).get(s) or {}
                jobs.append(
                    ("body", {**{k: v for k, v in p.items() if k != "overrides"}, **over, "slug": s, "name": s})
                )
        elif kind in ("body", "skill", "plugin"):
            if kind == "body" and "spec-from" in p:
                # one spec for a vessel that is packaged both alone and inside a plugin
                cfg = json.loads(pl.ref(p["spec-from"]).read_text(encoding="utf-8"))
                found = [b for b in cfg.get("bodies") or [] if b.get("slug") == p.get("slug")]
                if len(found) != 1:
                    jobs.append(
                        (
                            "refused",
                            {
                                "name": p.get("slug"),
                                "why": f"{p.get('slug')}: spec-from {p['spec-from']} holds {len(found)} spec(s) for it, not one",
                            },
                        )
                    )
                    continue
                p = {**found[0], **p}
            if kind == "plugin" and "config" in p and not p.get("name"):
                p = {**p, "name": json.loads(pl.ref(p["config"]).read_text(encoding="utf-8")).get("name")}
            jobs.append((kind, {**p, "name": p.get("name") or p.get("slug") or p.get("skill")}))
        else:
            jobs.append(("refused", {"name": str(p), "why": f"unknown package kind {kind!r}"}))
    if only:
        jobs = [j for j in jobs if j[1]["name"] in only]
        missing = only - {j[1]["name"] for j in jobs}
        for m in sorted(missing):
            jobs.append(("refused", {"name": m, "why": f"{m}: the list does not name it"}))
    return jobs


def write_integrity_line(path: Path) -> str:
    """Insert (or keep) INTEGRITY_LINE as the first body line of a SOURCE SKILL.md. The owner
    reviews and re-seals; this never seals anything itself."""
    text = path.read_text(encoding="utf-8")
    m = FM_RE.match(text)
    if not m:
        raise SystemExit(f"{path}: no frontmatter")
    body = m.group(2)
    if body.partition("\n")[0] == INTEGRITY_LINE:
        return "already first"
    new = text[: len(text) - len(body)] + INTEGRITY_LINE + "\n\n" + body.lstrip("\n")
    path.write_text(new, encoding="utf-8")
    return "written"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--list", type=Path, help="the package list (the pot's); none: core's own plugin, core alone")
    ap.add_argument(
        "--salts",
        type=Path,
        help="core alone: the garden's locked-salts file, to seal as each owner through the signing gate; "
        "none: an UNSEALED LOCAL BUILD, said",
    )
    ap.add_argument("--only", nargs="+", help="package only these names from the list")
    ap.add_argument(
        "--keys",
        choices=("published", "garden"),
        default="published",
        help="who vouches for seals: the published keys (default) or each source root, named",
    )
    ap.add_argument("--out", type=Path, help="output directory (default: the list's `out`)")
    ap.add_argument(
        "--review",
        action="store_true",
        help="allow uncommitted sources; stamps +uncommitted; for an owner's review, never upload",
    )
    ap.add_argument(
        "--counter",
        type=Path,
        help="the garden's one build counter (default: build-counter.json in the output directory); name it so every "
        "build of one garden, a release in its own folder too, counts on one file",
    )
    ap.add_argument(
        "--leave-out",
        type=Path,
        help="a plain list of this checkout's files its release leaves out, one path per line; required unless the "
        "checkout carries a release manifest at its root",
    )
    ap.add_argument(
        "--units",
        action="store_true",
        help="with a plugin: also write each skill it bundles as its own <name>.skill, from the plugin's own stage "
        "(the plugin's unit to the byte, no second stamp)",
    )
    ap.add_argument("--write-integrity-line", nargs="+", type=Path, metavar="SKILL.md")
    a = ap.parse_args()
    global COUNTER
    COUNTER = a.counter.resolve() if a.counter else None

    if a.write_integrity_line:
        for p in a.write_integrity_line:
            print(f"  {write_integrity_line(p):<14} {p}   (the owner re-seals: SKILL.md.bonsaisig)")
        return 0
    if a.list:
        if a.salts:
            ap.error("--salts is for the core-alone build; a package list names its own signing-salts")
        pl = PackageList(a.list)
    else:
        # core alone: core's own plugin from this checkout; anything else is a garden's, and its list says so
        core_name = json.loads(CORE_PLUGIN_CONFIG.read_text(encoding="utf-8"))["name"]
        if a.only and set(a.only) != {core_name}:
            ap.error(
                f"--list is required to package anything but core's own plugin ({core_name}): "
                f"{', '.join(sorted(set(a.only) - {core_name}))} belongs to a garden's package list"
            )
        pl = PackageList.core_alone(a.salts)
    out = (a.out or pl.ref(pl.data.get("out") or "")).resolve()
    out.mkdir(parents=True, exist_ok=True)
    if pl.unsealed:  # the first line, so neither a reader nor the stranger walk can miss it
        print(
            f"{UNSEALED_FIRST}: no owner's key named (core alone, no --salts), so no packaged SKILL.md and no "
            "MANIFEST.json is sealed. The integrity line in each SKILL.md stops on it, by design; only the owners' "
            "sealed release replaces it (README, Start here)."
        )
    leave_line = load_leave_out(a.leave_out)  # before anything is staged; exits if no list can answer
    print(
        f"Packages -> {out}\n  list: {pl.path}{'  (core alone: no package list)' if not a.list else ''}\n"
        f"  keys: {a.keys}{'  · REVIEW (uncommitted allowed)' if a.review else ''}"
        f"{'  · UNSEALED' if pl.unsealed else ''}\n  counter: {counter_file(out)}\n{leave_line}\n"
    )
    refused, done = [], []
    for kind, spec in expand(pl, set(a.only) if a.only else None):
        name = spec["name"]
        try:
            if kind == "refused":
                raise Refused(spec["why"])
            if kind == "body":
                s = package_unit(resolve_body(pl, spec["root"], spec["slug"], spec), out, pl, a.keys, a.review)
            elif kind == "skill":
                s = package_unit(resolve_skill(pl, spec["skill"], spec), out, pl, a.keys, a.review)
            else:
                s = package_plugin(spec, out, pl, a.keys, a.review, write_units=a.units)
        except Refused as e:
            refused.append(str(e))
            for ext in (".zip", ".skill", ".plugin"):
                (out / f"{name}{ext}").unlink(missing_ok=True)
            print(f"  {name:<26} REFUSED (nothing left for it)")
            LIST_LEFT_OUT.clear()
            continue
        done.append(s)
        if LIST_LEFT_OUT:
            print(
                f"  · {name}: {len(LIST_LEFT_OUT)} file(s) left out, as the leave-out list says: "
                + ", ".join(os.path.relpath(x, CORE) for x in LIST_LEFT_OUT)
            )
            LIST_LEFT_OUT.clear()
        if LEFT_OUT:
            print(
                f"  ! {name}: {len(LEFT_OUT)} untracked file(s) left out (only committed files ship): "
                + ", ".join(os.path.relpath(x) for x in LEFT_OUT[:6])
                + (" …" if len(LEFT_OUT) > 6 else "")
            )
            LEFT_OUT.clear()
        seal = "UNSEALED (a local build)" if pl.unsealed else f"sealed by {s['owner']} {s['sealed_by']}"
        print(
            f"  {s['name']:<26} {s['build']:<30} {s['bytes']:>10,} B {s['files']:>4} files  "
            f"{seal}  from {s['source']}  gates PASS"
        )
    if STAGE_BASE is not None:
        shutil.rmtree(STAGE_BASE, ignore_errors=True)
    print(
        f"\n  {len(done)} package(s){f' · {len(refused)} REFUSED' if refused else ''}"
        f"{' · UNSEALED: for reading, never for waking' if pl.unsealed and done else ''}"
    )
    for msg in refused:
        print(f"\n  ✗ {msg}", file=sys.stderr)
    return 1 if refused else 0


if __name__ == "__main__":
    sys.exit(main())
