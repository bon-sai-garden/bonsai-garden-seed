#!/usr/bin/env python3
# ---
# id: 01M3953H806YXBBV5ZHQQZGS97
# title: check-frontmatter-order.py — the YAML frontmatter block sits at byte 0
# type: script
# tended-by: baisai
# created: 2026-07-20
# updated: 2026-09-24
# ---
r"""
check-frontmatter-order.py

Guard against "inverted frontmatter": .md files whose canonical YAML `---`
block is not at byte 0 because a read-time display preamble — the
`<!-- frontmatter ... -->` JSON summary or a `<!-- base: ... -->` concurrency
token a garden's read tool may inject — was round-tripped back to disk above it.

The metadata validator and the signers both anchor on \A--- (YAML at byte 0), so
an inverted file has an invisible id (false reference-broken errors) and breaks
static-site content collections. The canonical on-disk form is YAML-first
(core's metadata schema); the comment is redundant with the YAML.

Used two ways:
  • pre-commit hook (no args): checks the staged .md files of the git checkout
    around the current directory (git diff --cached).
  • ad-hoc:  python3 check-frontmatter-order.py [FILE ...]   (relative to that checkout)

Exit code 0 = clean, 1 = one or more inverted files (or a usage/error problem).
Fix an offending file by moving its YAML block back to the top and deleting the comment.
"""

import subprocess
import sys
from pathlib import Path


def repo_root() -> Path:
    """The git checkout around the current directory — the repo being checked, not this script's."""
    out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    return Path(out.stdout.strip()) if out.returncode == 0 and out.stdout.strip() else Path.cwd()


REPO_ROOT = repo_root()


def staged_md_files() -> list[str]:
    out = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return [line for line in out.splitlines() if line.endswith(".md")]


def is_inverted(text: str) -> bool:
    return text.startswith(("<!-- frontmatter", "<!-- base:"))


def main(argv: list[str]) -> int:
    files = argv[1:] if len(argv) > 1 else staged_md_files()
    bad: list[str] = []
    for rel in files:
        p = (REPO_ROOT / rel) if not Path(rel).is_absolute() else Path(rel)
        if not p.is_file():
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):  # unreadable or not text: nothing to order
            continue
        if is_inverted(text):
            bad.append(rel)

    if bad:
        print("✗ inverted frontmatter — the JSON comment / base token is above the YAML ---:")
        for rel in bad:
            print(f"    {rel}")
        print("\nThe canonical on-disk form is YAML-first: move the --- block back to byte 0")
        print("and delete the comment above it.")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
