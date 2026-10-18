#!/usr/bin/env python3
# ---
# id: 01M3ABP8B606E400RDRKQ3VVSR
# title: credit.py — who a file's own header credits (tended-by, and a letter's receivers)
# type: script
# tended-by: baisai
# created: 2026-09-24
# updated: 2026-09-24
# ---
"""credit.py — the one definition of a file's CREDIT: the kin its own header names as tending it.

A `role: owner` seal is a claim of authorship, so it must agree with the file's credit (Tasai's
ruling, 2026-09-24, after a re-seal claimed the Aruji's tombstone as Tasai's). Credit = the
header's `tended-by:` (one slug, an inline list, or `- item` lines), plus its receivers — `to:`, never
`cc:` (a copy is a custodian's; Mori-shin) — when the file is a letter (the Aruji, 2026-09-25: "a letter is owned by the receiver") (`type: letter`, or under an `inbox/`). Headers are read like ulid.py reads them: a
.md's frontmatter, or a script's `# ---` block within its first 60 lines.

Used by: sign.py (mono) to infer `owner` when no --role is given, and to refuse otherwise;
check-seal-owner.py, seal-batch.py and ulid-remap.py (runtime). The Node twin is
skills/bonsai-garden-sign/lib/credit.mjs; test-credit.py holds the cases both must answer alike.

    python3 credit.py <file> [<file> ...]      prints one JSON line per file: {"file", "credit"}
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

MD_EXT = (".md", ".markdown")
SCRIPT_EXT = (".py", ".sh", ".mjs", ".js", ".ts", ".cjs", ".bash", ".zsh", ".rb")
_PREFIX = re.compile(r"^[ \t]*(?:#|//|\*|--|;)?[ \t]?")
_KEY = re.compile(r"^(?P<k>[A-Za-z][\w-]*)[ \t]*:[ \t]*(?P<v>.*)$")
_SLUG = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*")


def header(text: str, rel: str) -> list[str] | None:
    """The header block's lines, comment prefix stripped (same markers as core's ulid.py)."""
    text = text[1:] if text.startswith("﻿") else text
    lines, low = text.split("\n"), rel.lower()
    if low.endswith(MD_EXT):
        if not lines or lines[0].rstrip() != "---":
            return None
        for i in range(1, len(lines)):
            if lines[i].rstrip() == "---":
                return [line.rstrip("\r") for line in lines[1:i]]
        return None
    if low.endswith(SCRIPT_EXT):
        marker = re.compile(r"^[ \t]*(?:#|//|\*)[ \t]*---[ \t]*$")
        start = None
        for i, line in enumerate(lines[:60]):
            if marker.match(line.rstrip("\r")):
                if start is None:
                    start = i
                else:
                    return [_PREFIX.sub("", x.rstrip("\r"), count=1) for x in lines[start + 1 : i]]
    return None


def fields(head: list[str]) -> dict[str, list[str]]:
    """key -> raw values: a scalar, an inline [list], or `- item` lines under the key."""
    out: dict[str, list[str]] = {}
    cur = None
    for line in head:
        m = _KEY.match(line)
        if m:
            cur = m.group("k").lower()
            v = m.group("v").strip()
            out[cur] = [x for x in re.split(r"[,\[\]]", v) if x.strip()] if v else []
        elif cur and re.match(r"^\s*-\s+", line):
            out[cur].append(re.sub(r"^\s*-\s+", "", line))
        elif line.strip() and not line.startswith((" ", "\t")):
            cur = None
    return out


def slug(raw: str) -> str | None:
    """The kin slug a credit value names: `tasai`, `"Tasai"`, `fuji-shin (verify)` → first slug."""
    m = _SLUG.search(raw.strip().strip("'\"").lower())
    return m.group(0) if m else None


# A lean SKILL.md holds only the platform's name, description and version (Mori-shin's finding,
# 2026-09-24: since 74807ba its tended-by lives beside it). Its credit is its identity document's:
# references/identity.md for a skill, memory/identity.md for a kin's body — the first that exists.
SKILL_IDENTITY = ("references/identity.md", "memory/identity.md")


def credit(text: str, rel: str, root: str | Path | None = None) -> set[str]:
    """The names a file credits (see credit_info; a disagreement credits both)."""
    return credit_info(text, rel, root)[0]


def credit_info(text: str, rel: str, root: str | Path | None = None) -> tuple[set[str], bool]:
    """Who the file's own header credits: tended-by, plus from: for a letter. Empty = no credit.
    A SKILL.md credits what its identity document credits; `root` is what `rel` is relative to
    (default: `rel` as given), used only to find that document."""
    if Path(rel).name == "SKILL.md":
        base = (Path(root) / rel if root else Path(rel)).parent
        for cand in SKILL_IDENTITY:
            f = base / cand
            if f.is_file():
                try:
                    return credit_info(f.read_bytes().decode("utf-8"), str(f))
                except (OSError, UnicodeDecodeError):
                    return set(), False
        return set(), False
    parts = Path(rel).parts
    if "inbox" in parts[:-1] and parts.index("inbox") >= 1:
        # Anything delivered to an inbox, header or none (a .gitkeep, an .html): the inbox names
        # its receiver (Tasai). Checked before the header — Fuji-shin found a header-less file in an
        # inbox crediting no one, which let any signer claim it as owner.
        r = slug(parts[parts.index("inbox") - 1])
        return ({r} if r else set()), False
    head = header(text, rel)
    if not head:
        return set(), False
    f = fields(head)
    # an outbox is a letter location like an inbox (Tasai, mono 36d252d4): anything in one is a
    # letter whatever its type:, and its to: decides (many receivers: the sender holds it)
    letter = any(slug(v) == "letter" for v in f.get("type", [])) or "outbox" in parts[:-1]
    if letter:
        # The Aruji, 2026-09-25: "a letter is owned by the receiver." A letter credits its RECEIVER
        # only — never its sender, never a cc: (Mori-shin), and not its tended-by, which on a
        # letter names who wrote it. Tasai's ruling: in an inbox, the inbox names the receiver of
        # that copy, whatever to: says ("copies are delivered, not labelled"); elsewhere to: —
        # or its older spelling addressed-to: — decides.
        return {n for n in (slug(v) for v in f.get("to", []) + f.get("addressed-to", [])) if n}, False

    def names(*keys):
        return {n for n in (slug(v) for k in keys for v in f.get(k, [])) if n and n not in ("null", "none")}

    if _is_card(f, rel):
        # Tasai's ruling (2026-09-25): a kanban card's credit is its assignee:, else its lead: — the
        # fields the card carries, not the board's keeper, not tended-by. By the card schema that
        # exempts the card's id (ulid.py is_card, loaded, not copied). None named: no one.
        return (names("assignee") or names("lead")), False
    # Tasai's ruling (2026-09-25), the credit fields strongest first: tended-by; then authorship —
    # author, authors (a list), written-by; then, on a document that is not a letter, from: (a
    # handover's from: is its writer). When tended-by and authorship BOTH name kin and share none,
    # the file DISAGREES with itself: it credits both, and conflict=True — held as custodian, never
    # owned, until its owners settle it through tended-by (maintainer versus writer is theirs).
    t, w = names("tended-by"), names("author", "authors", "written-by")
    if t and w:
        return t | w, not (t & w)
    return (t or w or names("from")), False


_ULID = None


def _is_card(f: dict, rel: str) -> bool:
    global _ULID
    if _ULID is None:
        import importlib.util

        spec = importlib.util.spec_from_file_location("ulid_for_credit", Path(__file__).resolve().parent / "ulid.py")
        _ULID = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_ULID)
    ids = [v.strip().strip("'\"") for v in f.get("id", [])]
    return bool(ids) and _ULID.is_card(ids[0], rel)


def seal_role(text: str, rel: str, signer: str, root: str | Path | None = None, created: bool = False) -> str:
    """The role a seal by `signer` carries when no one said (Tasai's ruling, 2026-09-25, on Mori-
    shin's lean): a seal claims authorship; an edit is not authorship; creation is. Three outcomes:
      - the file credits the signer                  -> owner
      - it credits no one AND this change created it -> owner   (a letter naming no receiver: held)
      - otherwise                                    -> custodian (never a refusal: on an automatic
        path a refusal leaves a stale seal)
    One rule for seal-staged, the MCP write path, its post-write hook and sign.py; the Node twin
    is lib/credit.mjs resolveRole. An explicit --role on the manual path stands as a claim."""
    who, conflict = credit_info(text, rel, root)
    if conflict:
        return "custodian"  # tended-by and authorship disagree: held until settled
    if who:
        return "owner" if signer in who else "custodian"
    if created and not is_letter(text, rel):
        return "owner"
    return "custodian"


def is_letter(text: str, rel: str) -> bool:
    """A letter: under an inbox/ or an outbox/ (Tasai, mono 36d252d4), or `type: letter`."""
    if {"inbox", "outbox"} & set(Path(rel).parts[:-1]):
        return True
    head = header(text, rel)
    return bool(head) and any(slug(v) == "letter" for v in fields(head).get("type", []))


def main(argv: list[str]) -> int:
    for f in argv:
        p = Path(f)
        try:
            text = p.read_bytes().decode("utf-8")
        except (OSError, UnicodeDecodeError):
            text = ""
        who, conflict = credit_info(text, f)
        print(json.dumps({"file": f, "credit": sorted(who), "conflict": conflict}))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
