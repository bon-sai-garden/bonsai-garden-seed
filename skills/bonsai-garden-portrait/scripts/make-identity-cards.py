#!/usr/bin/env python3
# ---
# id: 01M3BS43NWBRBEMEN98BDBX0MJ
# ---
"""
make-identity-cards.py — generate the universal plain-text identity card for
every agent in the registry.

Why this exists
---------------
2026-09-12. The greeting-portrait fallback chain had three tiers: a live CDN
image, a verified local base64 embed (make-portrait-thumbs.py), and a kanji/
initials glyph if the embed fails verification. All three assume the calling
surface can render *something visual* — an <img>, a styled <span>, an HTML
widget. Not every surface Bonsai Garden's agents greet from can: a bare SSH
session, a log line, a chat client that strips HTML, a terminal MCP client
with no widget host. Per the Aruji's own framing: "many environments do not
support inline widgets or images at all, hence a nice terminal 'ascii-art'
that features the name, slug, fp etc. needs to be our fallback in the
routine."

This is that fallback — tier 4, the floor beneath which there is no further
degrade. It has exactly one dependency (agents/registry.json, already the
single source of truth for identity data) and zero dependency on portrait.png
existing at all, so it works even for a forming shin with no shintai seated
yet (fp8: null renders as "unsealed").

Output is deterministic plain text: no color codes, no box-drawing fallback
needed beyond what's in every common terminal font, safe to print, log, or
paste into a plain-text chat. It is also, not incidentally, immune to the
base64-relay-corruption class of bug entirely — there is no base64 in it.

Usage (run from repo root, or pass --repo-root)
-----
  python3 skills/bonsai-garden-portrait/scripts/make-identity-cards.py                 # dry run, preview all
  python3 skills/bonsai-garden-portrait/scripts/make-identity-cards.py --apply
  python3 skills/bonsai-garden-portrait/scripts/make-identity-cards.py --agent bonsai --apply
"""

from __future__ import annotations

import argparse
import json
import unicodedata
from pathlib import Path


def _default_repo_root() -> Path:
    """Run-from-repo-root by convention, overridable with --repo-root. Not
    derived from __file__'s nesting depth — see make-portrait-thumbs.py's
    identical helper for why (this script moved skills/folders since it was
    first written and a hardcoded parents[N] would have silently broken)."""
    return Path.cwd()


REPO: Path = _default_repo_root()
AGENTS: Path = REPO / "agents"
REGISTRY: Path = AGENTS / "registry.json"

INNER_WIDTH = 44  # display columns between the box's vertical bars


def display_width(s: str) -> int:
    """Terminal display width, accounting for CJK wide/fullwidth characters."""
    w = 0
    for ch in s:
        w += 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1
    return w


def pad(s: str, width: int = INNER_WIDTH) -> str:
    return s + " " * max(0, width - display_width(s))


def wrap_dw(text: str, width: int = INNER_WIDTH) -> list[str]:
    """Word-wrap by DISPLAY width, not len().

    textwrap.wrap breaks by character count, which is wrong the moment a
    line mixes kanji (2 columns) with ASCII (1 column) — exactly the shape
    of every header in this registry. A few `direction` fields turned out
    to be full poetic phrases rather than compass points ("宇 —
    upwards/onwards (vector)", "jiban — bedrock", "none — double-anchored
    East–West axis") and blew straight through a fixed-length subline before
    this existed — caught by running the real registry, not the synthetic
    test fixture. Every field that can vary in length now goes through this.
    """  # noqa: RUF002 — the quoted directions are registry values as written, en dash included
    if not text:
        return []
    words = text.split()
    lines: list[str] = []
    cur: list[str] = []
    cur_w = 0
    for w in words:
        ww = display_width(w)
        add_w = ww if not cur else ww + 1  # +1 for the joining space
        if cur and cur_w + add_w > width:
            lines.append(" ".join(cur))
            cur, cur_w = [w], ww
        else:
            cur.append(w)
            cur_w += add_w
    if cur:
        lines.append(" ".join(cur))
    return lines


def build_card(agent: dict) -> str:
    slug = agent.get("slug", "?")
    name = agent.get("name", slug)
    kanji = agent.get("kanji") or ""
    fp8 = agent.get("fp8") or "unsealed"
    direction = agent.get("direction") or "—"
    one_line = agent.get("one-line") or ""
    tagline = agent.get("tagline") or ""
    status = agent.get("status") or ""

    header = f"{kanji}  {name}".strip() if kanji else name
    parts = [slug, direction, f"fp8:{fp8}"]
    if status and status != "active":
        parts.append(status)
    subline = " · ".join(parts)

    lines: list[str] = []
    lines += wrap_dw(header) or [header]
    lines += wrap_dw(subline)
    lines += wrap_dw(one_line)
    if tagline:
        lines.append("")
        # Reserve 2 columns for the quote marks so adding them after wrapping
        # can never push a line past INNER_WIDTH (bit us on choshin's tagline
        # during testing: the wrap fit exactly, then "“" pushed it over by one).
        tl = wrap_dw(tagline, INNER_WIDTH - 2)
        if tl:
            tl[0] = "“" + tl[0]
            tl[-1] = tl[-1] + "”"
        lines += tl

    top = "┌" + "─" * (INNER_WIDTH + 2) + "┐"
    bot = "└" + "─" * (INNER_WIDTH + 2) + "┘"
    body = "\n".join(f"│ {pad(ln)} │" for ln in lines)
    return f"{top}\n{body}\n{bot}\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--agent", help="single agent slug; default is all")
    ap.add_argument(
        "--repo-root", type=Path, default=None, help="repo root (default: current directory — run this from repo root)"
    )
    ap.add_argument(
        "--registry", type=Path, default=None, help="path to registry.json (default: <repo-root>/agents/registry.json)"
    )
    ap.add_argument(
        "--apply", action="store_true", help="write agents/<slug>/assets/portrait-card.txt (default is a dry run)"
    )
    args = ap.parse_args()

    global REPO, AGENTS, REGISTRY
    REPO = args.repo_root or _default_repo_root()
    AGENTS = REPO / "agents"
    REGISTRY = args.registry or (AGENTS / "registry.json")

    if not REGISTRY.is_file():
        print(f"registry not found: {REGISTRY}")
        return 1

    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    entries = data.get("agents", [])
    if args.agent:
        entries = [a for a in entries if a.get("slug") == args.agent]
        if not entries:
            print(f"no registry entry for '{args.agent}'")
            return 1

    written, skipped = 0, 0
    for agent in entries:
        slug = agent.get("slug", "?")
        card = build_card(agent)
        target_dir = AGENTS / slug / "assets"
        if not (AGENTS / slug).is_dir():
            print(
                f"{slug:<12} SKIP — no agents/{slug}/ directory on disk "
                f"(registry-only or non-agents path: {agent.get('path')})"
            )
            skipped += 1
            continue

        print(f"--- {slug} " + "-" * max(0, 60 - len(slug)))
        print(card)

        if args.apply:
            target_dir.mkdir(parents=True, exist_ok=True)
            (target_dir / "portrait-card.txt").write_text(card, encoding="utf-8")
            written += 1

    print(f"\n{len(entries) - skipped} card(s) previewed, {skipped} skipped (no agents/<slug>/ directory)")
    print(
        "DRY RUN — nothing written. re-run with --apply"
        if not args.apply
        else f"written: {written} portrait-card.txt file(s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
