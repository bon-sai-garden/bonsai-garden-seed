#!/usr/bin/env python3
# ---
# id: 01M4T6Q90PE74P82ZB4VCEZAMG
# title: Move a SKILL.md's version history to references/changelog.md
# type: script
# tended-by: baisai
# created: 2026-10-13
# updated: 2026-10-13
# ---
"""move-skill-history.py — move a SKILL.md's version history to references/changelog.md (Shintai 3.0.11).

SKILL.md loads at every activation; a history is read only when asked. This moves the section
`## Version` / `## Version history` / `## Changelog` (longer than 800 chars) verbatim into
<body>/references/changelog.md and leaves one pointer line. Mechanical, no semantics: the text is
moved, not edited. An existing changelog.md keeps its content; the moved section is appended under
a dated heading. Seals are NOT touched here (the caller reseals SKILL.md and changelog.md).

    python3 move-skill-history.py <body-dir>...          dry run: what would move, sizes
    python3 move-skill-history.py --apply <body-dir>...  write; prints one line per body
Exit 0; 2 on a body it cannot read.
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

HEAD = re.compile(r"^## (Version|Version history|Changelog)[ \t]*$", re.M)
ULID = Path(__file__).resolve().parent / "ulid.py"
LIMIT = 800


def section(text: str):
    """The largest history section (a body may carry a short `## Version` and a long `## Version history`)."""
    best = None
    for m in HEAD.finditer(text):
        nxt = re.search(r"^## ", text[m.end() :], re.M)
        end = m.end() + nxt.start() if nxt else len(text)
        if best is None or end - m.start() > best[1] - best[0]:
            best = (m.start(), end, text[m.start() : end])
    return best


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument(
        "--doc",
        default="SKILL.md",
        choices=("SKILL.md", "about-me.md"),
        help="which document: SKILL.md (body root) or the constitution references/about-me.md",
    )
    ap.add_argument(
        "--min", type=int, default=None, help="smallest section worth moving (default 800; 300 for about-me.md)"
    )
    ap.add_argument("bodies", nargs="+")
    a = ap.parse_args()
    rc = 0
    for b in a.bodies:
        body = Path(b)
        skill = body / ("SKILL.md" if a.doc == "SKILL.md" else "references/about-me.md")
        if not skill.is_file():
            print(f"SKIP {b}: no {a.doc}")
            rc = 2
            continue
        text = skill.read_text(encoding="utf-8")
        s = section(text)
        if not s or len(s[2]) <= (a.min if a.min is not None else (LIMIT if a.doc == "SKILL.md" else 300)):
            print(f"ok   {b}: nothing to move")
            continue
        start, end, sec = s
        slug = body.name
        ver = re.search(r"^version:\s*(\S+)", text, re.M)
        ver = ver.group(1) if ver else "see frontmatter"
        pointer = (
            f"## Version\n\n**{ver}** — the history of every build is in `references/changelog.md`; "
            f"read it only when asked.\n\n"
        )
        new = text[:start] + pointer + text[end:]
        new = (
            re.sub(
                r"(\| `references/about-me\.md`[^\n]*\n)",
                r"\1| `references/changelog.md` | This SKILL.md's version history (read only when asked) |\n",
                new,
                count=1,
            )
            if "references/changelog.md` |" not in new
            else new
        )
        ch = body / "references" / "changelog.md"
        moved = sec.rstrip("\n") + "\n"
        if ch.is_file():
            out = ch.read_text(encoding="utf-8").rstrip("\n") + (
                f"\n\n---\n\n## Moved from {a.doc}, 2026-10-13\n\n"
                "Verbatim, by the gardener's ruling (Shintai 3.0.11: no version history in SKILL.md).\n\n"
                + moved.replace("## Version", "### Version", 1)
            )
        else:
            uid = subprocess.check_output([sys.executable, str(ULID), "new"], text=True).strip()
            out = (
                f"---\nid: {uid}\ntitle: \"{slug} — SKILL.md version history\"\ntype: reference\n"
                f"tended-by: {slug}\ncreated: 2026-10-13\nupdated: 2026-10-13\n---\n\n"
                f"# {slug} — SKILL.md version history\n\nMoved out of `SKILL.md` on 2026-10-13, verbatim, by the "
                f"gardener's ruling (Shintai 3.0.11: version history lives in `references/changelog.md`, never in "
                f"SKILL.md).\n\n{moved}"
            )
        print(
            f"{'MOVE' if a.apply else 'would move'} {b}: {len(sec)} chars -> references/changelog.md"
            f" ({'append' if ch.is_file() else 'new'}); SKILL.md {len(text)} -> {len(new)}"
        )
        if a.apply:
            ch.parent.mkdir(exist_ok=True)
            ch.write_text(out, encoding="utf-8")
            skill.write_text(new, encoding="utf-8")
    return rc


if __name__ == "__main__":
    sys.exit(main())
