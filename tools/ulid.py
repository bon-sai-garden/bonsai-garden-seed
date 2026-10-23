#!/usr/bin/env python3
# ---
# id: 01M37VT9ZCPJX1D0H5SJYDAX2Q
# title: ulid.py — generate and check document ids
# type: script
# tended-by: baisai
# created: 2026-09-23
# updated: 2026-10-21
# copyright: © 2026 Bonsai Garden · bon-sai.garden
# ---
"""
ulid.py — a document id is generated, never typed. The garden's ULID reference.

A ULID is 26 Crockford base-32 characters: 10 of millisecond timestamp, 16 of
randomness (https://github.com/ulid/spec). Drafted by Tasai, 2026-09-23; adopted as
the intended single master after two adversarial passes by Fuji-shin. NOT YET TRUE:
new-file.py, validate-metadata.py, snapshot-metadata.py and sync-remote-memory.mjs (elsewhere
in the origin's garden) still carry their own regex, which admits L; rewiring them to import this is
owed, and until then this file is the reference, not the only copy.

    ulid.py new [-n N]              print N fresh ULIDs (monotonic within a ms)
    ulid.py check PATH...           check the id: of each file; exit 1 on any bad one
    ulid.py check --staged [--repo] the pre-commit gate over staged files
    ulid.py census [--repo DIR] [--names]  count real, bad and shared ids; list the exempt

What "bad" means:
  shape      not 26 chars of 0-9 A-H J K M N P-T V-Z (upper case; no I, L, O, U)
  time       the timestamp decodes to before 2024-01-01 or after tomorrow
  entropy    the random half has 6 or fewer distinct characters, or a run of 6+ of
             one character — a real ULID trips one of these about once in 510,000
  structure  two id: keys in one header, or an empty id:

One exemption, by property: a TEMPLATE (its header holds exactly one `template: true`)
whose id is exactly `<ULID>` or `TODO-generate-ulid` passes check and is left out of the
census and the staged gate's id map. The same placeholder in a file without the flag is
bad (shape), so a copy made from a template cannot ship until it drops the flag and mints
its id. Seal v2 carries a template's minted id in its sidecar alone (sign.py, ulid-rule.mjs).
A kanban CARD by the validator's card schema (`<lane>/BL-XX###.md`, its id its stem) is a
name, not a ULID, and exempt the same way; census lists cards and templates apart.

WHAT THIS CANNOT DO. A typed id written in legal Crockford, 26 long, with a varied
tail (01M37VWSAMZENSA1KANBAN0001) cannot be told from a generated one by its
characters. The defence is not detection: it is `ulid.py new`, the staged gate that
makes every new or changed id pass these checks, and the rule that ids are generated.
(An earlier draft claimed a typed 000001 tail trips the entropy rule every time; it
does not, and the claim is withdrawn.)

--staged is a ratchet, not a purge. It reads every tracked file from the INDEX — what
the commit will contain — never the working tree. A new file must carry a good id, and
so must a file whose id changed. A file whose id was left alone passes with a note, even
if that id is already shared. An id may sit on two files only when their staged blobs are
identical — a distributed copy of one document (the 2026-09-14 ruling: a ULID names the
document, not the file). The gate does NOT make copies move together: edit one copy and
leave the others, and the id left alone passes with a note. Keeping copies in step is the
generator's job, not this check's. A structure fault that is new in this commit blocks,
even when the id itself was left alone: YAML reads the LAST id: key, so a second key
would be a way to slip a typed id in.

Files read: .md (YAML frontmatter at byte 0, BOM and a trailing-space `--- ` tolerated) and
scripts whose header is a `# ---` or JSDoc `* ---` block. A path that cannot be read is an
error, never a silent pass; a file with a header that is not UTF-8 is BAD; one with no
header carries no id and is skipped.

Exit: 0 clean · 1 bad ids · 2 usage, unreadable path, or git failure.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import time
from collections import defaultdict

CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
ULID_RE = re.compile(r"^[0-9A-HJKMNP-TV-Z]{26}$")
EPOCH_FLOOR_MS = 1704067200000  # 2024-01-01T00:00:00Z — the garden is younger
DAY_MS = 86_400_000
MIN_DISTINCT_RANDOM = 7
MAX_RUN = 5
MD_EXT = (".md",)
SCRIPT_EXT = (".py", ".sh", ".mjs", ".js")

_last_ms = -1
_last_rand = 0


class UlidError(Exception):
    pass


def new_ulid() -> str:
    """A fresh ULID; strictly increasing within one process. Raises on counter overflow
    within one millisecond, as the spec requires, rather than wrapping."""
    global _last_ms, _last_rand
    ms = int(time.time() * 1000)
    if ms == _last_ms:
        rand = _last_rand + 1
        if rand >= 1 << 80:
            raise UlidError("random counter overflow within one millisecond")
    else:
        rand = int.from_bytes(os.urandom(10), "big")
    _last_ms, _last_rand = ms, rand
    n = (ms << 80) | rand
    return "".join(CROCKFORD[(n >> (5 * i)) & 31] for i in reversed(range(26)))


def decode_ms(u: str) -> int:
    n = 0
    for ch in u[:10]:
        n = n * 32 + CROCKFORD.index(ch)
    return n


def _max_run(s: str) -> int:
    best = run = 0
    prev = None
    for ch in s:
        run = run + 1 if ch == prev else 1
        prev = ch
        best = max(best, run)
    return best


def why_bad(value: str | None, now_ms: int | None = None) -> str | None:
    """None if value is a real ULID, else the reason it is not."""
    if value is None:
        return "no id:"
    if value == "":
        return "empty id:"
    if not ULID_RE.match(value):
        if len(value) != 26:
            return f"shape: {len(value)} chars, a ULID has 26"
        if value != value.upper() and ULID_RE.match(value.upper()):
            return "shape: lower case — a ULID is upper-case Crockford"
        stray = sorted({c for c in value if c not in CROCKFORD})
        return f"shape: not Crockford base-32 (has {''.join(stray)})"
    now_ms = now_ms if now_ms is not None else int(time.time() * 1000)
    ms = decode_ms(value)
    if ms < EPOCH_FLOOR_MS or ms > now_ms + DAY_MS:
        stamp = time.strftime("%Y-%m-%d", time.gmtime(ms / 1000)) if ms < 2**42 else "far future"
        return f"time: timestamp decodes to {stamp}"
    rnd = value[10:]
    if len(set(rnd)) < MIN_DISTINCT_RANDOM:
        return f"entropy: random half has {len(set(rnd))} distinct chars — looks typed"
    if _max_run(value) > MAX_RUN:
        return f"entropy: a run of {_max_run(value)} identical chars — looks typed"
    return None


_ID_LINE = re.compile(r"^(?P<lead>[ \t]*(?:#|//|\*)?[ \t]*)id:[ \t]*(?P<v>.*?)[ \t]*$")


def _clean(v: str) -> str:
    v = v.split(" #", 1)[0].strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
        v = v[1:-1]
    return v


def header_lines(text: str, path: str) -> list[str] | None:
    """The header block's lines, or None if the file carries no header."""
    if text.startswith("﻿"):
        text = text[1:]
    low = path.lower()
    lines = text.split("\n")
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
                    return [x.rstrip("\r") for x in lines[start + 1 : i]]
        return None
    return None


def read_id(text: str, path: str) -> tuple[bool, str | None, str | None]:
    """(has_header, id, structural_problem). Only the header block is read."""
    head = header_lines(text, path)
    if head is None:
        return False, None, None
    is_md = path.lower().endswith(MD_EXT)
    found = []
    for line in head:
        m = _ID_LINE.match(line)
        if not m:
            continue
        lead = m.group("lead")
        # markdown: a top-level key only (never a nested `  id:`); scripts: a comment line
        if (is_md and lead == "") or (not is_md and re.search(r"[#*/]", lead)):
            found.append(_clean(m.group("v")))
    if len(found) > 1:
        return True, found[0], f"structure: {len(found)} id: keys in one header"
    return True, (found[0] if found else None), None


# A TEMPLATE carries a literal placeholder where each copy made from it will carry a
# minted id (Tasai's ruling, 2026-09-24). It is a template BY PROPERTY, never by path:
# its header holds exactly one top-level `template: true`. A copy drops that flag (keeping
# every other key, `type:` included) and mints its own id, and a copy never inherits the
# template's seal. The exemption holds only for the pair: the flag AND an id that is exactly
# one of these placeholders. A placeholder without the flag is a typed id like any other
# (check fails, census counts it typed), so an unminted copy cannot ship; a template whose
# id is anything else is checked by the ordinary rule.
TEMPLATE_PLACEHOLDERS = ("<ULID>", "TODO-generate-ulid")
_TEMPLATE_LINE = re.compile(r"^(?P<lead>[ \t]*(?:#|//|\*)?[ \t]*)template:[ \t]*(?P<v>.*?)[ \t]*$")


def is_template(text: str, path: str) -> bool:
    """True when the header holds exactly one top-level `template:` key, valued `true`."""
    head = header_lines(text, path)
    if head is None:
        return False
    is_md = path.lower().endswith(MD_EXT)
    found = []
    for line in head:
        m = _TEMPLATE_LINE.match(line)
        if m and ((is_md and m.group("lead") == "") or (not is_md and re.search(r"[#*/]", m.group("lead")))):
            found.append(m.group("v").split(" #", 1)[0].strip())  # the bare YAML boolean; "true" quoted is a string
    return found == ["true"]


def template_exempt(text: str, path: str) -> bool:
    """True for a template holding a placeholder id: exempt from the id rule, skipped by
    the remap, and sealed with a minted id that lives in its sidecar alone."""
    if not is_template(text, path):
        return False
    has, value, structural = read_id(text, path)
    return has and structural is None and value in TEMPLATE_PLACEHOLDERS


# A NAME BY SCHEMA: a kanban card's id is its ticket number, cited by number in
# every repo (Tasai's ruling, 2026-09-24). Exempt like a template, by the card schema, not
# by a path prefix. The MASTER is core's skills/bonsai-garden-validate/scripts/
# validate-metadata.py (CARD_ID_RE, CARD_LANES, _card_lane, and its card-id-filename rule:
# the id is the filename's stem); these are copies, and test-ulid.py fails on any drift.
# A ticket-shaped id outside the schema (a lane the schema does not name) is NOT exempt.
CARD_ID_RE = re.compile(r"^BL-[A-Z]{2}\d{3}$")
CARD_LANES = ("backlog", "todo", "in-progress", "review", "done")


def is_card(value: str | None, path: str) -> bool:
    """A kanban card by the validator's schema: `<lane>/BL-XX###.md`, its id its stem."""
    parts = path.replace("\\", "/").split("/")
    if len(parts) < 2 or not path.lower().endswith(MD_EXT):
        return False
    stem = os.path.splitext(parts[-1])[0]
    return parts[-2] in CARD_LANES and bool(CARD_ID_RE.match(stem)) and value == stem


def id_exempt(text: str, path: str) -> str | None:
    """'template' or 'card' when the file's own id is exempt from the ULID rule, else None.
    An exempt file's id is left alone by the remap, left out of the census and the staged
    gate's id map, and in seal v2 its minted id lives in its sidecar alone."""
    if template_exempt(text, path):
        return "template"
    has, value, structural = read_id(text, path)
    if has and structural is None and is_card(value, path):
        return "card"
    return None


# SKILL.md's frontmatter is the platform's, and holds only name, description and version
# (spec-canonical-shintai-structure; check-skill-conformance rule 1): it can never carry an
# id. Its id lives in its seal v2 sidecar instead, as any file's does that cannot carry one
# (seal v2, 2026-09-24). Before this, every SKILL.md read BAD "no id:" here.
# A README.md is the forge's: GitHub renders a frontmatter block at its top as a table, on the
# page a stranger reads first, so a README carries none (the gardener, 2026-10-21). A
# README.<name>.md is a README kept under another name and published as README.md. Their ids
# live in their seals, as SKILL.md's does. The validator keeps a copy of both; test-ulid.py
# fails on drift.
NO_ID_NAMES = ("SKILL.md", "README.md")
NO_ID_NAME_RE = re.compile(r"README\.[a-z0-9-]+\.md")


def _carries_id(path: str) -> bool:
    base = os.path.basename(path)
    if base in NO_ID_NAMES or NO_ID_NAME_RE.fullmatch(base):
        return False
    return path.lower().endswith(MD_EXT + SCRIPT_EXT)


class GitError(Exception):
    pass


def git(repo: str, *args: str, binary: bool = False):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=not binary)
    if r.returncode != 0:
        err = r.stderr if not binary else r.stderr.decode("utf-8", "replace")
        raise GitError(f"git {' '.join(args)} failed: {err.strip()}")
    return r.stdout


def _decode(data: bytes, path: str) -> str | None:
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return None


def check_bytes(data: bytes, path: str) -> tuple[bool, str | None, str | None]:
    """check_text over raw bytes: a header that is not UTF-8 is BAD; no header is a skip."""
    text = _decode(data, path)
    if text is None and header_lines(data.decode("utf-8", "replace"), path) is None:
        return False, None, None
    return check_text(text, path)


def check_text(text: str | None, path: str) -> tuple[bool, str | None, str | None]:
    """(has_header, id, reason-or-None). Undecodable text is a reason, not a skip."""
    if text is None:
        return True, None, "unreadable: not UTF-8"
    has, value, structural = read_id(text, path)
    if not has:
        return False, None, None
    if id_exempt(text, path):
        return True, value, None
    return True, value, structural or why_bad(value)


def tracked_ids(
    repo: str, overrides: dict[str, bytes | None] | None = None, exempt: list[tuple[str, str, str]] | None = None
) -> dict[str, list[str]]:
    """id -> [paths] over tracked files. `overrides` maps a path to its staged bytes
    (None = deleted), so the map reflects what the commit would contain. Exempt ids
    (templates, cards) are left out; pass `exempt` to collect them as (kind, id, path)."""
    overrides = overrides or {}
    ids: dict[str, list[str]] = defaultdict(list)
    paths = {p for p in git(repo, "ls-files", "-z").split("\0") if p} | set(overrides)
    for rel in sorted(paths):
        if not _carries_id(rel):
            continue
        if rel in overrides:
            data = overrides[rel]
            if data is None:
                continue
        else:
            try:
                with open(os.path.join(repo, rel), "rb") as fh:
                    data = fh.read()
            except OSError:
                continue
        text = _decode(data, rel)
        if text is None:
            continue
        kind = id_exempt(text, rel)
        if kind:
            if exempt is not None:
                exempt.append((kind, read_id(text, rel)[1], rel))
            continue
        has, value, _ = read_id(text, rel)
        if has and value:
            ids[value].append(rel)
    return ids


def _file_bytes(repo: str, rel: str, overrides: dict[str, bytes | None]) -> bytes | None:
    if rel in overrides:
        return overrides[rel]
    try:
        with open(os.path.join(repo, rel), "rb") as fh:
            return fh.read()
    except OSError:
        return None


def cmd_new(n: int) -> int:
    for _ in range(n):
        print(new_ulid())
    return 0


def cmd_check(paths: list[str]) -> int:
    bad = err = 0
    for p in paths:
        if os.path.isdir(p):
            print(f"ERROR {p}: is a directory — name files", file=sys.stderr)
            err += 1
            continue
        if not os.path.isfile(p):
            print(f"ERROR {p}: not found", file=sys.stderr)
            err += 1
            continue
        if not _carries_id(p):
            continue
        with open(p, "rb") as fh:
            has, value, reason = check_bytes(fh.read(), p)
        if has and reason:
            bad += 1
            print(f"BAD   {p}: {value!r} — {reason}")
    return 2 if err else (1 if bad else 0)


def index_blobs(top: str) -> dict[str, str]:
    """path -> staged blob sha, for every id-carrying path in the index."""
    out = {}
    for row in git(top, "ls-files", "-s", "-z").split("\0"):
        if not row:
            continue
        meta, path = row.split("\t", 1)
        mode, sha = meta.split()[:2]
        if mode == "160000":  # gitlink: a commit in another repo, no blob
            continue
        if _carries_id(path):
            out[path] = sha
    return out


def read_blobs(top: str, shas: list[str]) -> dict[str, bytes]:
    """sha -> bytes via one `git cat-file --batch`."""
    if not shas:
        return {}
    r = subprocess.run(
        ["git", "-C", top, "cat-file", "--batch"], input="\n".join(shas).encode() + b"\n", capture_output=True
    )
    if r.returncode != 0:
        raise GitError(f"git cat-file failed: {r.stderr.decode('utf-8', 'replace').strip()}")
    data, out, i = r.stdout, {}, 0
    for sha in shas:
        nl = data.index(b"\n", i)
        head = data[i:nl].split()
        if len(head) != 3:
            raise GitError(f"git cat-file: no blob for {sha} ({data[i:nl].decode('utf-8', 'replace')})")
        size = int(head[2])
        out[sha] = data[nl + 1 : nl + 1 + size]
        i = nl + 1 + size + 1
    return out


def cmd_staged(repo: str) -> int:
    top = git(repo, "rev-parse", "--show-toplevel").strip()
    rows = git(top, "diff", "--cached", "--name-status", "-z", "-M", "--diff-filter=ACMR").split("\0")
    staged: list[tuple[str, str, str]] = []
    i = 0
    while i < len(rows) and rows[i]:
        st = rows[i]
        if st[0] in "RC":
            staged.append((st[0], rows[i + 2], rows[i + 1]))
            i += 3
        else:
            staged.append((st[0], rows[i + 1], rows[i + 1]))
            i += 2
    todo = [(st, p, o) for st, p, o in staged if _carries_id(p)]
    if not todo:
        return 0
    blob_of = index_blobs(top)  # the commit's view of every file
    blobs = read_blobs(top, sorted(set(blob_of.values())))
    ids: dict[str, list[str]] = defaultdict(list)
    for path, sha in blob_of.items():
        text = _decode(blobs[sha], path)
        if text is None or id_exempt(text, path):
            continue
        has, value, _ = read_id(text, path)
        if has and value:
            ids[value].append(path)
    bad, notes = [], []
    for st, path, old in todo:
        if path not in blob_of:  # a gitlink named *.md carries no document
            continue
        has, value, reason = check_bytes(blobs[blob_of[path]], path)
        if not has:
            continue
        text = _decode(blobs[blob_of[path]], path)
        if text is not None and id_exempt(text, path):
            continue  # a template or a card: its id is not a ULID, nor unique by this gate
        old_value, old_structural = None, None
        if st in "MR":
            try:
                prev = git(top, "show", f"HEAD:{old}", binary=True)
                _, old_value, old_structural = read_id(_decode(prev, old) or "", old)
            except GitError:
                old_value = None
        if st in "MR" and value == old_value and reason and reason.startswith("structure") and not old_structural:
            bad.append(f"BAD   {path}: {value!r} — {reason} (new in this commit)")
            continue
        if st in "MR" and value == old_value:
            shared = [p for p in ids.get(value, []) if p != path and blob_of[p] != blob_of[path]] if value else []
            if reason or shared:
                why = reason or f"already shared with {', '.join(shared)}"
                notes.append(f"note  {path}: id {value!r} left as it was ({why})")
            continue
        if reason:
            bad.append(f"BAD   {path}: {value!r} — {reason}")
            continue
        clash = [p for p in ids.get(value, []) if p != path and blob_of[p] != blob_of[path]]
        if clash:
            bad.append(
                f"BAD   {path}: id {value} is already used by {', '.join(clash)} "
                f"(only a byte-identical copy of the same document may share an id)"
            )
    for line in notes + bad:
        print(line)
    if bad:
        print(f"\nulid.py: {len(bad)} staged file(s) carry an id that is bad or already used.")
        print("Generate one:  python3 <core>/tools/ulid.py new")
        return 1
    return 0


def cmd_census(repo: str, names: bool = False) -> int:
    exempt: list[tuple[str, str, str]] = []
    ids = tracked_ids(repo, exempt=exempt)
    real = sum(len(v) for k, v in ids.items() if not why_bad(k))
    typed = sum(len(v) for k, v in ids.items() if why_bad(k))
    shared = {k: v for k, v in ids.items() if len(v) > 1}
    cards = sum(1 for k, _, _ in exempt if k == "card")
    templates = sum(1 for k, _, _ in exempt if k == "template")
    print(
        f"{os.path.basename(os.path.abspath(repo))}: {real + typed} ids · {real} real · {typed} typed · {len(shared)} shared by 2+ files"
        f" · exempt, listed apart: {cards} card name-id(s), {templates} template(s)"
    )
    if names:
        for kind, value, rel in sorted(exempt):
            print(f"  {kind:8s} {value}  {rel}")
    return 1 if typed or shared else 0


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Generate and check ULID document ids.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("new")
    a.add_argument("-n", type=int, default=1)
    c = sub.add_parser("check")
    c.add_argument("paths", nargs="*")
    c.add_argument("--staged", action="store_true")
    c.add_argument("--repo", default=".")
    s = sub.add_parser("census")
    s.add_argument("--repo", default=".")
    s.add_argument("--names", action="store_true", help="list the exempt ids (cards, templates)")
    args = ap.parse_args(argv)
    try:
        if args.cmd == "new":
            return cmd_new(max(1, args.n))
        if args.cmd == "check":
            if args.staged:
                return cmd_staged(args.repo)
            if not args.paths:
                ap.error("check needs PATH... or --staged")
            return cmd_check(args.paths)
        return cmd_census(args.repo, args.names)
    except (GitError, UlidError) as e:
        print(f"ulid.py: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
