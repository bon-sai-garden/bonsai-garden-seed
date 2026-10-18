#!/usr/bin/env python3
# ---
# id: 01M3953H5BX0JKP8SEPBTCW9BV
# title: validate-metadata.py — every document's frontmatter against core's metadata schema
# type: script
# tended-by: baisai
# created: 2026-09-04
# updated: 2026-10-15
# ---
"""
validate-metadata.py — the frontmatter heartbeat.

Walk a garden, parse YAML frontmatter on every .md file, run the checks
defined in core's rituals/specs/metadata-schema.md, surface errors and warnings.

Checks performed:
  1. Required fields present (id, title, type, tended-by, created, updated);
     a SKILL.md is held to the skill contract instead (name, description, and
     nothing but version beside them), a kanban card to the card schema
  2. ID format (valid ULID) and uniqueness across the repo
  3. Type vocabulary (against lore/metadata-schema.md enum)
  4. Tended-by vocabulary — the union of the schema's structural constants
     (its `### Structural constants` table) and the agent slugs DERIVED from
     the garden's agents/ tree.
     Derivation means a newly invited *-sai or *-shin is a valid tender the
     moment its surface lands in the tree — no schema edit required.
  5. Date format and order (updated >= created)
  6. Path/type and path/tended-by cross-checks (warnings)
  7. Signature verification — any file with a sign: block must have a valid
     embedded ed25519 signature (hash-mismatch, bad-signature and a refusal by
     the published keys are errors; unknown-signer and a seal that could not be
     checked are warnings). Verified by core's own verifier,
     skills/bonsai-garden-sign, with --keys published (default) or garden;
     public keys only, no private key required.
  7b. Sign-block presence — files whose type is trust-bearing (e.g. constitution,
     codex, chronicle, lore, specification, working-state, handover, journal)
     should carry a non-empty sign: block. Emits a warning until the mass-
     signing pass is complete.

Usage:
    python3 validate-metadata.py [--root <path>] [--garden <path>] [--schema <path>]
                                 [--strict] [--strict-related] [--json]

  --root    what to scan (default: the git checkout around the current directory)
  --garden  where the agents/ tree is read from (default: the nearest directory at
            or above --root that has one), so a scan of a subtree still knows the roster
  --schema  the metadata schema (default: core's own, found beside this skill)

Exit codes:
    0  clean (warnings ok)
    1  errors present
    2  validator itself failed (e.g., schema file missing)

Reference: core rituals/specs/metadata-schema.md v0.1.6+. Needs PyYAML.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # a missing dependency is a validator failure (exit 2), never a pass
    print("validator failed: PyYAML is not installed (pip install PyYAML)", file=sys.stderr)
    sys.exit(2)

# --- Paths -----------------------------------------------------------------
# Found by marker, never by counting directory levels: this script lives in core at
# skills/bonsai-garden-validate/scripts/, and it validates a garden that is not core.

HERE = Path(__file__).resolve().parent


def _core_root() -> Path | None:
    for d in (HERE, *HERE.parents):
        if (d / "LAYERS.md").is_file() and (d / "rituals" / "specs" / "metadata-schema.md").is_file():
            return d
    return None


CORE_ROOT = _core_root()
# core's own file when a core checkout is above; else the GENERATED copy the skill ships (tools/sync-validate-schema.py holds it
# byte-identical to the master), so an installed validator runs in a garden that has no core beside it
_BUNDLED_SCHEMA = HERE.parent / "references" / "metadata-schema.txt"
SCHEMA_PATH_DEFAULT = (
    CORE_ROOT / "rituals" / "specs" / "metadata-schema.md"
    if CORE_ROOT
    else _BUNDLED_SCHEMA
    if _BUNDLED_SCHEMA.is_file()
    else None
)
SIGN_CLI = CORE_ROOT / "skills" / "bonsai-garden-sign" / "bin" / "sign.mjs" if CORE_ROOT else None


def default_scan_root() -> Path:
    """The git checkout around the current directory, else the current directory."""
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, timeout=15)
        if out.returncode == 0 and out.stdout.strip():
            return Path(out.stdout.strip())
    except (OSError, subprocess.SubprocessError):
        pass
    return Path.cwd()


def default_garden_root(root: Path) -> Path:
    """The nearest directory at or above the scan root that carries an agents/ tree."""
    for d in (root, *root.parents):
        if (d / "agents").is_dir():
            return d
    return root


# A directory under agents/ (or agents/<parent>/sub-agents/) is an agent
# surface — and therefore a valid tender — when it carries one of these
# constitution/skill marker files. agents/shared/ carries none and is skipped.
AGENT_SURFACE_MARKERS = ("about-me.md", "SKILL.md", "agent.md")

# Files excluded from validation by convention.
EXEMPT_GLOBS = (
    "**/*.md.bak",  # archive convention
    "**/node_modules/**",
    "**/dist/**",  # built output — copies of source files, not canonical
)

# Trust-bearing types that should carry a non-empty sign: block.
# Emits a warning (not an error) for types in this set.
# Emits an error for types promoted to MUST_SIGN_TYPES_ERROR (initially empty).
# The promotion path is a garden's own policy.
MUST_SIGN_TYPES = {
    "constitution",  # about-me.md files
    "codex",  # binding law documents
    "chronicle",  # authored chronicle records
    "brief",  # chronicle briefs
    "spec",  # formal specs (canonical type; was "specification" — fixed 2026-06-06)
    "role",  # role archetype documents
    "lore",  # canonical workshop lore
    "working-state",  # agent working state
    "handover",  # session handovers (record of what happened)
    "session-handover",  # alias used by some handover files
    "journal",  # episodic agent journals
    "pillar",  # structural workshop decisions
    "procedure",  # named agent procedures
}

# Types promoted to error-level enforcement (the gardener's call; initially empty).
# When a type moves here, missing sign blocks fail validation (exit 1).
# The promotion criteria are a garden's own policy.
MUST_SIGN_TYPES_ERROR: set[str] = set()


# --- Schema parsing (same shape as new-file.py) ----------------------------


def parse_type_enum(schema_path: Path) -> list[str]:
    text = schema_path.read_text(encoding="utf-8")
    type_section_re = re.compile(r"##\s+Type enum.*?(?=^##\s+)", re.DOTALL | re.MULTILINE)
    m = type_section_re.search(text)
    if not m:
        raise SchemaError(f"could not locate `## Type enum` section in {schema_path}")
    section = m.group(0)
    row_re = re.compile(r"^\|\s*`([a-z][a-z0-9-]*)`\s*\|", re.MULTILINE)
    types = sorted(set(row_re.findall(section)))
    if not types:
        raise SchemaError(f"no type entries parsed from `## Type enum` in {schema_path}")
    return types


def parse_tended_by_enum(schema_path: Path) -> list[str]:
    """Parse the structural tended-by constants from the schema.

    The schema names them in its `### Structural constants` table: tenders that
    carry no agents/<slug>/ surface to derive from. Its roster table is a
    human-readable reference and, as the schema itself says, not the source of
    truth, so it is not read: the agents are derived from the garden's own tree
    (see derive_agent_tenders). A schema without the subsection falls back to
    every row of the section.
    """
    text = schema_path.read_text(encoding="utf-8")
    section_re = re.compile(r"##\s+Tended-by enum.*?(?=^##\s+)", re.DOTALL | re.MULTILINE)
    m = section_re.search(text)
    if not m:
        raise SchemaError(f"could not locate `## Tended-by enum` section in {schema_path}")
    section = m.group(0)
    sub = re.search(r"^###\s+Structural constants.*?(?=^###\s+|\Z)", section, re.DOTALL | re.MULTILINE)
    if sub:
        section = sub.group(0)
    row_re = re.compile(r"^\|\s*`([a-z][a-z0-9-]*)`\s*\|", re.MULTILINE)
    values = sorted(set(row_re.findall(section)))
    if not values:
        raise SchemaError(f"no tended-by entries parsed in {schema_path}")
    return values


def _is_agent_surface(d: Path) -> bool:
    return any((d / marker).is_file() for marker in AGENT_SURFACE_MARKERS)


def derive_agent_tenders(repo_root: Path) -> set[str]:
    """Derive valid agent tender-slugs from the agents/ tree.

    An agent is any directory carrying a surface marker (a constitution / skill
    / agent file):
      - agents/<slug>/                      → top-level *-sai and *-shin
      - agents/<parent>/<slug>/             → a shared-body *-shin, nested in its
                                              parent's directory with no body of its own
      - agents/<parent>/sub-agents/<slug>/  → divided *-shin (legacy layout)

    This makes invitation automatic: the moment a new agent's surface lands in
    the tree, it becomes a valid tended-by value — no schema edit required.
    Non-agent directories (e.g. agents/shared/) carry no surface marker and are
    skipped.
    """
    agents_dir = repo_root / "agents"
    found: set[str] = set()
    if not agents_dir.is_dir():
        return found
    for child in sorted(agents_dir.iterdir()):
        if not child.is_dir():
            continue
        if _is_agent_surface(child):
            found.add(child.name)
        for grandchild in sorted(child.iterdir()):
            if grandchild.is_dir() and grandchild.name != "sub-agents" and _is_agent_surface(grandchild):
                found.add(grandchild.name)
                NESTED_AGENTS.add(grandchild.name)
        sub = child / "sub-agents"
        if sub.is_dir():
            for grandchild in sorted(sub.iterdir()):
                if grandchild.is_dir() and _is_agent_surface(grandchild):
                    found.add(grandchild.name)
    return found


class SchemaError(RuntimeError):
    pass


# Shared-body *-shin found nested under a parent's directory (filled by derive_agent_tenders).
NESTED_AGENTS: set[str] = set()


# --- Frontmatter extraction ------------------------------------------------

FRONT_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*(?:\n|\Z)", re.DOTALL)
# Crockford base-32: no I, L, O or U. A copy of core's tools/ulid.py ULID_RE (the generator is the master; a skill
# runs from its own folder, so it cannot import it); tools/test-ulid.py fails on any drift. Was J-N, admitting L.
ULID_RE = re.compile(r"^[0-9A-HJKMNP-TV-Z]{26}$")

# --- Kanban cards -----------------------------------------------------------
# Cards on a kanban board (a <lane>/BL-XX###.md file) are a distinct document class:
# they are board items, not garden documents, and carry their own frontmatter
# schema (BL-XX### ids, status/lane, dod, assignee) rather than the ULID +
# type + tended-by shape every other .md file uses. Validated against the
# document schema they produced five spurious errors per card, so they are
# checked against the card schema instead of exempted: the board keeps coverage.
CARD_ID_RE = re.compile(r"^BL-[A-Z]{2}\d{3}$")
CARD_REQUIRED_FIELDS = ("id", "title", "status", "created", "modified", "assignee", "dod")
CARD_LANES = ("backlog", "todo", "in-progress", "review", "done")


def _card_lane(rel_path: str) -> str | None:
    """Return the lane a kanban card sits in, or None if not a card.

    Detected structurally — parent directory is a lane and the filename is a
    card id — so it holds whether the walk root is the repo or the board itself
    (a --root at the board yields rel_paths like 'todo/BL-XX032.md').
    """
    parts = rel_path.split("/")
    if len(parts) < 2:
        return None
    lane, stem = parts[-2], Path(parts[-1]).stem
    if lane in CARD_LANES and CARD_ID_RE.match(stem):
        return lane
    return None


REQUIRED_FIELDS = ("id", "title", "type", "tended-by", "created", "updated")

# A SKILL.md is its harness's activation contract, not a garden document: core's
# spec-canonical-shintai-structure.md (3.0.x) allows it only name, description and
# version, and keeps the skill's id, owner and dates in references/identity.md.
# Checked against that contract instead of the document schema.
SKILL_REQUIRED_FIELDS = ("name", "description")
SKILL_ALLOWED_FIELDS = ("name", "description", "version")


@dataclass
class Issue:
    severity: str  # "error" or "warning"
    path: str
    line: int | None
    code: str
    message: str


@dataclass
class FileResult:
    path: str
    has_frontmatter: bool = False
    frontmatter: dict[str, Any] = field(default_factory=dict)
    issues: list[Issue] = field(default_factory=list)
    skipped_symlink: bool = False


# --- Path-based inference helpers -----------------------------------------

# PATH_TYPE_HINTS — path-to-type inference table, for the garden layout core
# describes (rituals/specs/spec-canonical-shintai-structure.md). The first matching
# pattern wins. A mismatch is a warning, never an error.
PATH_TYPE_HINTS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^chronicles/.+\.md$"), "chronicle"),
    (re.compile(r"^lore/.+\.md$"), "lore"),
    (re.compile(r"^diary/pillars/.+\.md$"), "pillar"),
    (re.compile(r"^diary/observations/.+\.md$"), "observation"),
    (re.compile(r"^diary/logs/session-\d{4}-\d{2}-\d{2}-log\.md$"), "session-log"),
    (re.compile(r"^diary/logs/session-\d{4}-\d{2}-\d{2}-handover\.md$"), "session-handover"),
    (re.compile(r"^rituals/specs/.+\.md$"), "spec"),
    (re.compile(r"^rituals/templates/.+\.md$"), "template"),
    (re.compile(r"^rituals/repo/snapshots/snapshot-.+\.md$"), "meta"),
    # Kin — agents/<slug>/...
    (re.compile(r"^agents/[^/]+/SKILL\.md$"), "skill"),
    (re.compile(r"^agents/[^/]+/(references/)?about-me\.md$"), "constitution"),
    (re.compile(r"^agents/[^/]+/(references/)?procedures/.+\.md$"), "procedure"),
    (re.compile(r"^agents/[^/]+/connector-readiness\.md$"), "connector-readiness"),
    (re.compile(r"^agents/[^/]+/memory/identity\.md$"), "identity"),
    (re.compile(r"^agents/[^/]+/memory/strategic-context\.md$"), "strategic-context"),
    (re.compile(r"^agents/[^/]+/memory/patterns\.md$"), "patterns"),
    (re.compile(r"^agents/[^/]+/memory/working-state\.md$"), "working-state"),
    (re.compile(r"^agents/[^/]+/memory/lineage\.md$"), "lineage"),
    (re.compile(r"^agents/[^/]+/memory/backlog\.md$"), "backlog"),
    (re.compile(r"^agents/[^/]+/memory/journal/\d{4}-\d{2}-\d{2}\.md$"), "journal"),
    # Standalone skills — skills/<name>/references/identity.md
    (re.compile(r"^skills/[^/]+/references/identity\.md$"), "identity"),
    # Pot-side excourses — pots/<tenant>/.../excourses/...
    (re.compile(r"^pots/[^/]+/(.+/)?excourses/.+\.md$"), "excourse"),
]


def infer_type_from_path(rel_path: str) -> str | None:
    for pat, hint in PATH_TYPE_HINTS:
        if pat.match(rel_path):
            return hint
    return None


def infer_tended_by_from_path(rel_path: str, tended_by_enum: list[str]) -> str | None:
    # Kin live at agents/<slug>/... . Legacy skills/<slug>/ is retained so older
    # retained paths still infer. A divided *-shin at agents/<parent>/sub-agents/<slug>/
    # or a shared-body *-shin nested at agents/<parent>/<slug>/ tends those files,
    # not its parent, so the *-shin's slug is preferred when the path names it.
    parts = rel_path.split("/")
    if len(parts) >= 2 and parts[0] in ("agents", "skills"):
        if "sub-agents" in parts:
            i = parts.index("sub-agents")
            if i + 1 < len(parts):
                shin = parts[i + 1]
                if shin in tended_by_enum:
                    return shin
        if len(parts) >= 3 and parts[2] in NESTED_AGENTS and parts[2] in tended_by_enum:
            return parts[2]
        agent = parts[1]
        if agent in tended_by_enum:
            return agent
    return None


# --- File discovery --------------------------------------------------------


def discover_md_files(root: Path) -> list[Path]:
    out: list[Path] = []
    for path in root.rglob("*.md"):
        rel = path.relative_to(root).as_posix()
        # Skip exempts.
        if rel.endswith(".md.bak"):
            continue
        if "/node_modules/" in "/" + rel + "/":
            continue
        # Skip hidden dirs (e.g., .git, .obsidian).
        if any(part.startswith(".") and part not in (".", "..") for part in rel.split("/")[:-1]):
            continue
        out.append(path)
    return sorted(out)


# --- Frontmatter parse -----------------------------------------------------


def extract_frontmatter(text: str) -> tuple[dict[str, Any] | None, str | None]:
    """Return (frontmatter_dict, error_message). dict may be empty if frontmatter
    is empty. None means no frontmatter block present."""
    m = FRONT_RE.match(text)
    if not m:
        return None, None
    raw = m.group(1)
    try:
        data = yaml.safe_load(raw)
    except yaml.YAMLError as exc:
        return None, f"YAML parse error: {exc}"
    if data is None:
        return {}, None
    if not isinstance(data, dict):
        return None, f"frontmatter is not a YAML mapping (got {type(data).__name__})"
    return data, None


def raw_frontmatter_block(text: str) -> str | None:
    m = FRONT_RE.match(text)
    if not m:
        return None
    return m.group(1)


# --- Validation per file ---------------------------------------------------

# Verdicts core's verifier prints as `FAIL <file> [<status>]` → (severity, code, message)
_SIGN_RESULTS: dict[str, tuple[str, str, str]] = {
    "hash-mismatch": (
        "error",
        "sign-hash-mismatch",
        "signature present but file content has changed since signing",
    ),
    "bad-signature": (
        "error",
        "sign-bad-signature",
        "signature does not verify — key mismatch or tampering",
    ),
    "unknown-signer": (
        "warning",
        "sign-unknown-signer",
        "signer's public key not found in this garden — cannot verify",
    ),
    "no-signature": (
        "warning",
        "sign-block-but-no-sig",
        "sign: block present in frontmatter but no embedded signature found",
    ),
    # --keys published (the verifier's default): the published keys answer for the seal
    "rejected": (
        "error",
        "sign-rejected",
        "the published keys do not vouch for this seal (unknown signer or bad signature)",
    ),
    "answer-forged": (
        "error",
        "sign-answer-forged",
        "the published keys' answer does not verify under the pinned verifier key",
    ),
    "answer-malformed": (
        "error",
        "sign-answer-malformed",
        "the published keys' answer is not the /verify contract",
    ),
    "answer-unsigned": (
        "warning",
        "sign-unverified",
        "not verified: the published keys answered without a signed answer",
    ),
    "keys-unreachable": (
        "warning",
        "sign-unverified",
        "not verified: the published keys could not be reached",
    ),
    "open-unpublished": (
        "warning",
        "sign-open-unpublished",
        "seal is OPEN and not yet published",
    ),
    "open-expired": (
        "error",
        "sign-open-expired",
        "seal was OPEN and has expired",
    ),
}


def _check_signature(path: Path, rel_path: str, result: FileResult, garden: Path, keys: str = "published") -> None:
    """Verify *path*'s embedded seal with core's own verifier (skills/bonsai-garden-sign).

    Only called when the file's frontmatter contains a ``sign:`` key. Public keys
    only — no private key required. A verifier that cannot run is reported, never
    counted as a pass. `keys` is passed through as the verifier's --keys: `published`
    (its default: the published keys answer for the seal) or `garden` (the signer's
    key from the garden checkout on this host; must be asked for by name).
    """
    import shutil

    if SIGN_CLI is None or not SIGN_CLI.is_file() or shutil.which("node") is None:
        why = "node not found" if shutil.which("node") is None else f"core's verifier not found ({SIGN_CLI})"
        result.issues.append(
            Issue(
                "warning",
                rel_path,
                None,
                "sign-tool-missing",
                f"sign: block present but {why} — signature not verified",
            )
        )
        return

    try:
        proc = subprocess.run(
            ["node", str(SIGN_CLI), "verify", "--keys", keys, "--file", str(path)],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(garden),
        )
    except Exception as exc:
        result.issues.append(
            Issue("warning", rel_path, None, "sign-verify-error", f"the verifier raised an exception: {exc}")
        )
        return

    output = (proc.stdout + proc.stderr).strip()
    first = output.splitlines()[0] if output else ""
    if proc.returncode == 0 and first.startswith("ok"):
        return
    if first.startswith("OPEN"):
        result.issues.append(Issue("warning", rel_path, None, "sign-open", "seal is OPEN — awaiting its closer"))
        return
    status = "no-signature" if first.startswith("unsigned") else None
    m = re.search(r"\[([a-z-]+)\]", first)
    if m:
        status = m.group(1)
    if status in _SIGN_RESULTS:
        severity, code, message = _SIGN_RESULTS[status]
        result.issues.append(Issue(severity, rel_path, None, code, message))
        return

    # Unknown failure mode — surface the verifier's own words as an error.
    short = " ".join(output.split())[:160]
    result.issues.append(
        Issue("error", rel_path, None, "sign-verify-failed", f"signature verification failed: {short}")
    )


def validate_file(
    path: Path,
    rel_path: str,
    *,
    type_enum: list[str],
    tended_by_enum: list[str],
    all_ids: dict[str, list[str]],
    garden: Path,
    keys: str = "published",
) -> FileResult:
    result = FileResult(path=rel_path)
    # Symlink-skip — symlinks (and macOS Finder aliases, which carry the `book...mark`
    # bookmark-blob header) are intentional aliases. The target is validated separately
    # if it falls under the scan root. Informational only.
    if os.path.islink(path):
        result.skipped_symlink = True
        result.issues.append(
            Issue(
                "info",
                rel_path,
                None,
                "symlink-skipped",
                "is a symlink, skipping (target validated separately if in-scope)",
            )
        )
        return result
    try:
        with open(path, "rb") as fh:
            head = fh.read(8)
    except OSError as exc:
        result.issues.append(Issue("error", rel_path, None, "read-failed", f"could not read: {exc}"))
        return result
    if head[:4] == b"book" and head[4:8] == b"\x00\x00\x00\x00":
        # macOS bookmark / alias file — semantic symlink. Treat as such.
        result.skipped_symlink = True
        result.issues.append(
            Issue(
                "info",
                rel_path,
                None,
                "symlink-skipped",
                "is a macOS Finder alias, skipping (target validated separately if in-scope)",
            )
        )
        return result
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        result.issues.append(Issue("error", rel_path, None, "read-failed", f"could not read: {exc}"))
        return result

    fm, fm_error = extract_frontmatter(text)
    if fm_error:
        result.issues.append(Issue("error", rel_path, 1, "frontmatter-parse", fm_error))
        return result
    if fm is None:
        result.issues.append(Issue("error", rel_path, 1, "no-frontmatter", "missing YAML frontmatter block"))
        return result

    result.has_frontmatter = True
    result.frontmatter = fm

    # 1a. A SKILL.md uses the skill contract, not the document schema.
    if Path(rel_path).name == "SKILL.md":
        for fname in SKILL_REQUIRED_FIELDS:
            if fname not in fm:
                result.issues.append(
                    Issue("error", rel_path, None, "skill-missing-field", f"SKILL.md field missing: {fname}")
                )
        extra = sorted(k for k in fm if k not in SKILL_ALLOWED_FIELDS)
        if extra:
            result.issues.append(
                Issue(
                    "warning",
                    rel_path,
                    None,
                    "skill-extra-field",
                    f"SKILL.md carries {', '.join(extra)}: the 3.0 contract allows only "
                    "name, description, version (identity belongs in references/identity.md)",
                )
            )
        return result

    # 1b. Kanban cards use the card schema, not the document schema.
    lane = _card_lane(rel_path)
    if lane is not None:
        for fname in CARD_REQUIRED_FIELDS:
            if fname not in fm:
                result.issues.append(
                    Issue("error", rel_path, None, "card-missing-field", f"card field missing: {fname}")
                )
        card_id = fm.get("id")
        if card_id is not None:
            if not isinstance(card_id, str) or not CARD_ID_RE.match(card_id):
                result.issues.append(
                    Issue("error", rel_path, None, "card-id-format", f"card id is not BL-XX### form: {card_id!r}")
                )
            else:
                all_ids.setdefault(card_id, []).append(rel_path)
                stem = Path(rel_path).stem
                if stem != card_id:
                    result.issues.append(
                        Issue(
                            "error",
                            rel_path,
                            None,
                            "card-id-filename",
                            f"card id {card_id!r} does not match filename {stem!r}",
                        )
                    )
        status = fm.get("status")
        if status is not None and status not in CARD_LANES:
            result.issues.append(
                Issue("error", rel_path, None, "card-status", f"status {status!r} is not one of {list(CARD_LANES)}")
            )
        elif status is not None and status != lane:
            result.issues.append(
                Issue(
                    "error",
                    rel_path,
                    None,
                    "card-status-lane",
                    f"status {status!r} disagrees with lane directory {lane!r}",
                )
            )
        dod = fm.get("dod")
        if dod is not None and (not isinstance(dod, list) or not dod):
            result.issues.append(
                Issue("error", rel_path, None, "card-dod", "dod must be a non-empty list of definition-of-done lines")
            )
        return result

    # 1. Required-field presence.
    for fname in REQUIRED_FIELDS:
        if fname not in fm:
            result.issues.append(Issue("error", rel_path, None, "missing-field", f"required field missing: {fname}"))

    # 3. ID format. (uniqueness done after the walk)
    file_id = fm.get("id")
    if file_id is not None:
        if not isinstance(file_id, str) or not ULID_RE.match(file_id):
            result.issues.append(
                Issue(
                    "error",
                    rel_path,
                    None,
                    "id-format",
                    f"id is not a valid ULID (Crockford base-32, 26 chars): {file_id!r}",
                )
            )
        else:
            all_ids.setdefault(file_id, []).append(rel_path)

    # 4. Type vocabulary.
    type_value = fm.get("type")
    if type_value is not None:
        if not isinstance(type_value, str):
            result.issues.append(Issue("error", rel_path, None, "type-format", f"type is not a string: {type_value!r}"))
        elif type_value not in type_enum:
            result.issues.append(
                Issue(
                    "error",
                    rel_path,
                    None,
                    "type-unknown",
                    f"type {type_value!r} is not in the canonical enum",
                )
            )
        else:
            # Path/type cross-check (warning).
            implied = infer_type_from_path(rel_path)
            if implied is not None and implied != type_value:
                result.issues.append(
                    Issue(
                        "warning",
                        rel_path,
                        None,
                        "type-path-mismatch",
                        f"path implies type {implied!r} but frontmatter has {type_value!r}",
                    )
                )

    # tended-by check.
    tended_by = fm.get("tended-by")
    if tended_by is not None:
        if not isinstance(tended_by, str):
            result.issues.append(
                Issue("error", rel_path, None, "tended-by-format", f"tended-by is not a string: {tended_by!r}")
            )
        elif tended_by not in tended_by_enum:
            result.issues.append(
                Issue(
                    "error",
                    rel_path,
                    None,
                    "tended-by-unknown",
                    f"tended-by {tended_by!r} is not a known agent or structural tender",
                )
            )
        else:
            implied_agent = infer_tended_by_from_path(rel_path, tended_by_enum)
            if implied_agent is not None and implied_agent != tended_by:
                result.issues.append(
                    Issue(
                        "warning",
                        rel_path,
                        None,
                        "tended-by-path-mismatch",
                        f"path implies tended-by {implied_agent!r} but frontmatter has {tended_by!r}",
                    )
                )

    # 5. Date format.
    created_val = fm.get("created")
    updated_val = fm.get("updated")
    raw_block = raw_frontmatter_block(text) or ""
    created_parsed = _parse_date(created_val, "created", rel_path, result, raw_block)
    updated_parsed = _parse_date(updated_val, "updated", rel_path, result, raw_block)
    if created_parsed and updated_parsed and updated_parsed < created_parsed:
        result.issues.append(
            Issue(
                "error",
                rel_path,
                None,
                "date-order",
                f"updated ({updated_val}) is earlier than created ({created_val})",
            )
        )

    # note: warning when present alongside created.
    if "note" in fm and "created" in fm:
        result.issues.append(
            Issue(
                "warning",
                rel_path,
                None,
                "note-present",
                "note: present alongside created — signals an approximated date during retrofit",
            )
        )

    # 7. Signature verification.
    # Any file carrying a sign: block must have a valid embedded signature.
    if "sign" in fm:
        _check_signature(path, rel_path, result, garden, keys)

    # 7b. Sign-block presence for trust-bearing types.
    # Files may declare `sign-exempt: true` to skip this check (emits a
    # softer warning so exempt files stay visible in reports).
    # The promotion path is a garden's own policy.
    if type_value and (type_value in MUST_SIGN_TYPES or type_value in MUST_SIGN_TYPES_ERROR):
        sign_block = fm.get("sign")
        has_sig = (
            isinstance(sign_block, dict)
            and isinstance(sign_block.get("signature"), str)
            and len(sign_block.get("signature", "")) > 10
        )
        if not has_sig:
            if fm.get("sign-exempt") is True:
                result.issues.append(
                    Issue(
                        "warning",
                        rel_path,
                        None,
                        "sign-exempt-declared",
                        f"type {type_value!r} declares sign-exempt: true — skipping sign-block check",
                    )
                )
            elif type_value in MUST_SIGN_TYPES_ERROR:
                result.issues.append(
                    Issue(
                        "error",
                        rel_path,
                        None,
                        "sign-block-missing",
                        f"type {type_value!r} must carry a non-empty sign: block (enforcement active)",
                    )
                )
            else:
                result.issues.append(
                    Issue(
                        "warning",
                        rel_path,
                        None,
                        "sign-block-missing",
                        f"type {type_value!r} should carry a non-empty sign: block (trust-bearing type)",
                    )
                )

    return result


def _parse_date(
    value: Any,
    field_name: str,
    rel_path: str,
    result: FileResult,
    raw_block: str,
) -> datetime.date | None:
    if value is None:
        return None
    if isinstance(value, datetime.date) and not isinstance(value, datetime.datetime):
        # Unquoted ISO date — the canonical form.
        return value
    if isinstance(value, datetime.datetime):
        # Datetime value — accept but warn (we want bare dates).
        result.issues.append(
            Issue(
                "warning",
                rel_path,
                None,
                "date-datetime",
                f"{field_name} parsed as datetime; the schema wants an ISO date (YYYY-MM-DD)",
            )
        )
        return value.date()
    if isinstance(value, str):
        # Quoted date — warn (schema says unquoted), then try to parse.
        if re.search(rf"^{field_name}:\s*['\"]", raw_block, re.MULTILINE):
            result.issues.append(
                Issue(
                    "warning",
                    rel_path,
                    None,
                    "date-quoted",
                    f"{field_name} is YAML-quoted; the schema wants an unquoted ISO date",
                )
            )
        try:
            return datetime.date.fromisoformat(value)
        except ValueError:
            result.issues.append(
                Issue(
                    "error",
                    rel_path,
                    None,
                    "date-format",
                    f"{field_name} does not parse as ISO date: {value!r}",
                )
            )
            return None
    result.issues.append(
        Issue(
            "error",
            rel_path,
            None,
            "date-type",
            f"{field_name} has unexpected type {type(value).__name__}",
        )
    )
    return None


# --- Cross-file checks -----------------------------------------------------


def cross_file_checks(
    results: list[FileResult],
    all_ids: dict[str, list[str]],
    strict_related: bool = False,
) -> None:
    # 2. ID uniqueness.
    by_path = {r.path: r for r in results}
    for ulid, paths in all_ids.items():
        if len(paths) > 1:
            for p in paths:
                by_path[p].issues.append(
                    Issue(
                        "error",
                        p,
                        None,
                        "id-collision",
                        f"id {ulid} also appears in: {', '.join(other for other in paths if other != p)}",
                    )
                )

    # 2b. Constitution uniqueness per agent slug.
    #
    # A slug may have at most ONE canonical signed constitution body. Two signed
    # bodies each verify `ok`, and nothing on disk says which one is current — a
    # signature attests *who signed these bytes*, never *whether these bytes are
    # current*. Validity is not canonicity; this check supplies the part a
    # signature cannot.
    #
    # Found 2026-08-19: a kin's retired constitution stayed sealed and live at a
    # second path for five weeks after a new build superseded it. Both verified
    # `ok`; the re-sign sweeps kept re-sealing the orphan; the shipped skill was
    # built from it, so the kin woke into a self it had already retired.
    #
    # Exempt, because they do not claim to be canon: inbox deliveries and
    # release candidates (`/inbox/`), tombstones (`.bak` or `status: retired`),
    # and any body declaring `canon-exempt: true`.
    def _slug_from_path(p: str) -> str | None:
        parts = p.split("/")
        idx = None
        for i, seg in enumerate(parts):
            if seg in ("agents", "sub-agents"):
                idx = i
        if idx is None or idx + 1 >= len(parts):
            return None
        # A shared-body *-shin nested in its parent's directory keeps its own slug.
        if idx + 2 < len(parts) and parts[idx + 2] in NESTED_AGENTS:
            return parts[idx + 2]
        return parts[idx + 1]

    # Selected by FILENAME, not by `type`. The type vocabulary for constitution
    # bodies was found split three ways (2026-08-19) — `constitution`, `about-me`
    # (not even in the canonical enum), and no type field at all (the retired
    # body). A type-keyed rule is blind exactly where the drift is worst, which is
    # exactly where the duplicate lived.
    def _is_constitution_body(r: FileResult) -> bool:
        base = r.path.rsplit("/", 1)[-1]
        if base.startswith("about-me") and base.endswith(".md"):
            return True
        return r.frontmatter.get("type") in ("constitution", "about-me")

    constitutions: dict[str, list[str]] = {}
    for r in results:
        if not _is_constitution_body(r):
            continue
        if "/inbox/" in r.path or r.path.endswith(".bak"):
            continue
        if r.frontmatter.get("status") == "retired":
            continue
        if r.frontmatter.get("canon-exempt") is True:
            continue
        sign_block = r.frontmatter.get("sign")
        has_sig = (
            isinstance(sign_block, dict)
            and isinstance(sign_block.get("signature"), str)
            and len(sign_block.get("signature", "")) > 10
        )
        if not has_sig:
            continue
        slug = _slug_from_path(r.path)
        if slug is not None:
            constitutions.setdefault(slug, []).append(r.path)

    for slug, paths in constitutions.items():
        if len(paths) > 1:
            listed = ", ".join(sorted(paths))
            for p in sorted(paths):
                by_path[p].issues.append(
                    Issue(
                        "error",
                        p,
                        None,
                        "constitution-not-unique",
                        f"slug {slug!r} has {len(paths)} signed constitution bodies: {listed}"
                        " — exactly one may be canonical. Tombstone the superseded body"
                        " (.bak or status: retired), or declare canon-exempt: true.",
                    )
                )

    # 6. Reference integrity.
    known_ids = set(all_ids.keys())
    for r in results:
        for field_name in ("supersedes", "superseded-by"):
            val = r.frontmatter.get(field_name)
            _check_reference_value(r, field_name, val, known_ids)
        related = r.frontmatter.get("related")
        if related is not None:
            if not isinstance(related, list):
                r.issues.append(
                    Issue(
                        "error",
                        r.path,
                        None,
                        "related-format",
                        f"related must be a YAML list of ULIDs; got {type(related).__name__}",
                    )
                )
            else:
                for entry in related:
                    _check_reference_value(r, "related", entry, known_ids)

        # Self-reference warning.
        my_id = r.frontmatter.get("id")
        if my_id and isinstance(my_id, str):
            for field_name in ("supersedes", "superseded-by"):
                val = r.frontmatter.get(field_name)
                if val == my_id:
                    r.issues.append(
                        Issue("warning", r.path, None, "self-reference", f"{field_name} references this file's own id")
                    )
            if isinstance(related, list) and my_id in related:
                r.issues.append(
                    Issue("warning", r.path, None, "self-reference", "related references this file's own id")
                )

    # 7. Bidirectional consistency (hub-and-spoke).
    # For every A → B in related, check that B → A in return.
    # Asymmetric refs emit a warning by default; --strict-related escalates to error.
    # Only checked when both IDs are known (broken refs are already caught above).
    severity = "error" if strict_related else "warning"
    # Build: id → FileResult for O(1) lookup
    id_to_result: dict[str, FileResult] = {}
    for r in results:
        my_id = r.frontmatter.get("id")
        if my_id and isinstance(my_id, str) and my_id in all_ids:
            id_to_result[my_id] = r

    for r in results:
        my_id = r.frontmatter.get("id")
        if not my_id or not isinstance(my_id, str):
            continue
        related = r.frontmatter.get("related")
        if not isinstance(related, list):
            continue
        for target_id in related:
            if not isinstance(target_id, str) or target_id not in id_to_result:
                continue  # broken refs already flagged; skip
            target_r = id_to_result[target_id]
            target_related = target_r.frontmatter.get("related")
            if not isinstance(target_related, list) or my_id not in target_related:
                r.issues.append(
                    Issue(
                        severity,
                        r.path,
                        None,
                        "related-asymmetric",
                        f"related references {target_id} ({target_r.path}) but that file does not list this file's id in return",
                    )
                )


def _check_reference_value(
    result: FileResult,
    field_name: str,
    val: Any,
    known_ids: set[str],
) -> None:
    if val is None:
        return
    if not isinstance(val, str):
        result.issues.append(
            Issue(
                "error",
                result.path,
                None,
                "reference-format",
                f"{field_name} entry is not a string: {val!r}",
            )
        )
        return
    if not ULID_RE.match(val):
        result.issues.append(
            Issue(
                "error",
                result.path,
                None,
                "reference-format",
                f"{field_name} entry is not a valid ULID: {val!r}",
            )
        )
        return
    if val not in known_ids:
        result.issues.append(
            Issue(
                "error",
                result.path,
                None,
                "reference-broken",
                f"{field_name} references id {val} which does not exist in the repo",
            )
        )


# --- Reporting -------------------------------------------------------------


def render_human(
    results: list[FileResult],
    *,
    strict: bool,
    schema_path: Path,
) -> tuple[str, int]:
    """Return (text, exit_code)."""
    lines: list[str] = []
    n_files = len(results)
    n_symlinks = sum(1 for r in results if r.skipped_symlink)
    n_with_fm = sum(1 for r in results if r.has_frontmatter)
    n_no_fm = n_files - n_with_fm - n_symlinks

    errors_per_file = {r.path: [i for i in r.issues if i.severity == "error"] for r in results}
    warnings_per_file = {r.path: [i for i in r.issues if i.severity == "warning"] for r in results}
    info_per_file = {r.path: [i for i in r.issues if i.severity == "info"] for r in results}
    n_err_files = sum(1 for v in errors_per_file.values() if v)
    n_warn_files = sum(1 for v in warnings_per_file.values() if v)
    # passing = not an error file and not a skipped symlink
    n_clean = sum(1 for r in results if not r.skipped_symlink and not errors_per_file[r.path])
    total_errors = sum(len(v) for v in errors_per_file.values())
    total_warnings = sum(len(v) for v in warnings_per_file.values())
    total_info = sum(len(v) for v in info_per_file.values())

    # Code-level counts.
    code_counts: dict[str, int] = {}
    for r in results:
        for i in r.issues:
            code_counts[i.code] = code_counts.get(i.code, 0) + 1

    lines.append("validate-metadata — the frontmatter heartbeat")
    lines.append(f"schema: {schema_path}")
    lines.append("")
    lines.append(f"files checked:        {n_files}")
    lines.append(f"  with frontmatter:   {n_with_fm}")
    lines.append(f"  no frontmatter:     {n_no_fm}")
    lines.append(f"  symlinks (skipped): {n_symlinks}")
    lines.append(f"files passing:        {n_clean}")
    lines.append(f"files with errors:    {n_err_files}")
    lines.append(f"files with warnings:  {n_warn_files}")
    lines.append(f"total errors:         {total_errors}")
    lines.append(f"total warnings:       {total_warnings}")
    lines.append(f"total info:           {total_info}")
    lines.append("")

    if code_counts:
        lines.append("issues by code:")
        for code in sorted(code_counts.keys()):
            lines.append(f"  {code:<28s} {code_counts[code]}")
        lines.append("")

    # Per-file detail (errors first, then warnings, then info). Limit large dumps but show all.
    for r in results:
        if not r.issues:
            continue
        lines.append(f"== {r.path}")
        for issue in r.issues:
            if issue.severity == "error":
                tag = "ERROR  "
            elif issue.severity == "warning":
                tag = "warning"
            else:
                tag = "info   "
            loc = f":{issue.line}" if issue.line else ""
            lines.append(f"  {tag} [{issue.code}]{loc} {issue.message}")
        lines.append("")

    exit_code = 1 if total_errors or (strict and total_warnings) else 0
    return "\n".join(lines), exit_code


def render_json(results: list[FileResult], *, strict: bool) -> tuple[str, int]:
    total_errors = sum(1 for r in results for i in r.issues if i.severity == "error")
    total_warnings = sum(1 for r in results for i in r.issues if i.severity == "warning")
    payload = {
        "summary": {
            "files_checked": len(results),
            "files_with_frontmatter": sum(1 for r in results if r.has_frontmatter),
            "total_errors": total_errors,
            "total_warnings": total_warnings,
        },
        "files": [
            {
                "path": r.path,
                "has_frontmatter": r.has_frontmatter,
                "frontmatter_keys": sorted(r.frontmatter.keys()),
                "issues": [
                    {
                        "severity": i.severity,
                        "code": i.code,
                        "line": i.line,
                        "message": i.message,
                    }
                    for i in r.issues
                ],
            }
            for r in results
        ],
    }
    exit_code = 1 if total_errors or (strict and total_warnings) else 0
    return json.dumps(payload, indent=2), exit_code


# --- CLI -------------------------------------------------------------------


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="validate-metadata.py",
        description="Walk a garden and validate YAML frontmatter on .md files.",
    )
    parser.add_argument(
        "--root", default=None, help="what to scan (default: the git checkout around the current directory)"
    )
    parser.add_argument(
        "--garden", default=None, help="where the agents/ tree is read from (default: nearest at or above --root)"
    )
    parser.add_argument(
        "--schema", default=None, help="the metadata schema (default: core's rituals/specs/metadata-schema.md)"
    )
    parser.add_argument(
        "--keys",
        choices=("published", "garden"),
        default="published",
        help="where the seal verifier takes keys from: published (default) or garden "
        "(the garden checkout on this host)",
    )
    parser.add_argument("--strict", action="store_true", help="warnings become errors")
    parser.add_argument(
        "--strict-related", action="store_true", help="asymmetric related: references become errors (default: warnings)"
    )
    parser.add_argument("--json", action="store_true", help="emit structured JSON")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve() if args.root else default_scan_root().resolve()
    garden = Path(args.garden).resolve() if args.garden else default_garden_root(root)
    if args.schema:
        schema_path = Path(args.schema).resolve()
    elif SCHEMA_PATH_DEFAULT is not None:
        schema_path = SCHEMA_PATH_DEFAULT
    else:
        print("validator failed: core's metadata schema not found above this script; pass --schema", file=sys.stderr)
        return 2

    try:
        type_enum = parse_type_enum(schema_path)
        schema_tenders = set(parse_tended_by_enum(schema_path))
    except SchemaError as exc:
        print(f"validator failed: {exc}", file=sys.stderr)
        return 2
    except OSError as exc:
        print(f"validator failed: schema not readable: {exc}", file=sys.stderr)
        return 2

    # Effective tended-by enum = the schema's structural constants
    # | agent slugs derived from the garden's agents/ tree (auto-updates on invitation).
    #
    # Derivation reads the GARDEN's tree, not the scan `root`: a scan scoped to a
    # subdirectory must still know the full roster, otherwise every tended-by value
    # would spuriously fail there.
    tended_by_enum = sorted(schema_tenders | derive_agent_tenders(garden))

    md_files = discover_md_files(root)
    all_ids: dict[str, list[str]] = {}
    results: list[FileResult] = []
    for path in md_files:
        rel = path.relative_to(root).as_posix()
        r = validate_file(
            path,
            rel,
            type_enum=type_enum,
            tended_by_enum=tended_by_enum,
            all_ids=all_ids,
            garden=garden,
            keys=args.keys,
        )
        results.append(r)
    cross_file_checks(results, all_ids, strict_related=args.strict_related)

    if args.json:
        text, code = render_json(results, strict=args.strict)
    else:
        text, code = render_human(results, strict=args.strict, schema_path=schema_path)
    print(text)
    return code


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as exc:  # top-level safety net
        print(f"validator crashed: {exc!r}", file=sys.stderr)
        sys.exit(2)
