#!/usr/bin/env python3
# ---
# id: 01M3953H11AZ4RKMT4RZHP8XDF
# title: render-transcript.py — a keepable Markdown record of a session, from a JSON summary
# type: script
# tended-by: baisai
# created: 2026-09-03
# updated: 2026-09-24
# ---
"""
render-transcript.py — Render a Bonsai Garden session transcript.

Takes a JSON session summary and produces a styled Markdown transcript
the gardener can keep, print, or sign.

Usage:
    python3 render-transcript.py --session session.json --output out.md
    cat session.json | python3 render-transcript.py --output out.md
    python3 render-transcript.py --session session.json   # prints to stdout
    python3 render-transcript.py --session session.json --domain example.garden

Nothing in this script names one garden. The closing seal carries the garden's
domain only when --domain gives one, and the sign: placeholder names a signer
(--signer, default bonsai) but no fingerprint: the signing tool fills that in
from the signer's own key, so a placeholder cannot carry another garden's.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BONSAI_KANJI = "盆才守神"  # Bonsai, the one kin core carries (LAYERS.md, the named exception)


def seal(domain: str | None) -> str:
    tail = f" · {domain}" if domain else ""
    return f"""---

{BONSAI_KANJI}{tail}
"""


def sign_placeholder(signer: str) -> str:
    # No fingerprint here: sign.py writes the signer's own when it seals the file.
    return f"""
---
sign:
  signer: {signer}
  fingerprint: SIGN-OWED
  timestamp: SIGN-OWED
  algorithm: ed25519+blake2b512
  body-hash: SIGN-OWED
  signature: SIGN-OWED
"""


def _fmt_date(raw: str) -> str:
    """Try to pretty-print a date string; fall back to raw if unparseable."""
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y%m%d"):
        try:
            return datetime.strptime(raw, fmt).strftime("%d %B %Y")
        except ValueError:
            continue
    return raw


def render(session: dict, domain: str | None = None, signer: str = "bonsai") -> str:
    gardener = session.get("gardener", "Unknown Gardener")
    raw_date = session.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    date_str = _fmt_date(raw_date)
    duration = session.get("duration", "")
    purpose = session.get("purpose", "")
    highlights = session.get("highlights", [])
    agreements = session.get("agreements", [])
    next_steps = session.get("next_steps", "")
    notes = session.get("notes", "")

    # ── Frontmatter ───────────────────────────────────────────────────────
    fm_lines = [
        "---",
        "type: session-transcript",
        f"gardener: {gardener}",
        f"date: {raw_date}",
        f"tended-by: {signer}",
        "---",
    ]
    frontmatter = "\n".join(fm_lines)

    # ── Body ──────────────────────────────────────────────────────────────
    lines: list[str] = [
        frontmatter,
        "",
        f"# {BONSAI_KANJI} — Session Transcript",
        "",
        f"**Gardener:** {gardener}  ",
        f"**Date:** {date_str}  ",
    ]

    if duration:
        lines.append(f"**Duration:** {duration}  ")
    lines.append("")

    if purpose:
        lines += ["---", "", f"*{purpose}*", ""]

    lines += ["---", ""]

    if highlights:
        lines += ["## What happened", ""]
        for h in highlights:
            lines.append(f"- {h}")
        lines.append("")

    if agreements:
        lines += ["## Agreements", ""]
        for a in agreements:
            lines.append(f"- {a}")
        lines.append("")

    if next_steps:
        lines += ["## What comes next", "", next_steps, ""]

    if notes:
        lines += ["## Notes", "", notes, ""]

    lines += [seal(domain), sign_placeholder(signer)]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render a Bonsai Garden session transcript from a JSON summary.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--session", metavar="PATH", help="Path to session JSON file (omit to read from stdin)")
    parser.add_argument("--output", metavar="PATH", help="Output Markdown path (omit to print to stdout)")
    parser.add_argument(
        "--domain",
        metavar="DOMAIN",
        default=None,
        help="The garden's domain, shown in the closing seal (default: none)",
    )
    parser.add_argument(
        "--signer", metavar="SLUG", default="bonsai", help="Who tends and will seal the transcript (default: bonsai)"
    )
    args = parser.parse_args()

    if args.session:
        session_path = Path(args.session).expanduser().resolve()
        if not session_path.exists():
            print(f"error: session file not found: {session_path}", file=sys.stderr)
            sys.exit(1)
        with session_path.open(encoding="utf-8") as f:
            session = json.load(f)
    else:
        raw = sys.stdin.read()
        if not raw.strip():
            print("error: no session data on stdin and no --session file given", file=sys.stderr)
            sys.exit(1)
        session = json.loads(raw)

    transcript = render(session, domain=args.domain, signer=args.signer)

    if args.output:
        out_path = Path(args.output).expanduser().resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(transcript, encoding="utf-8")
        print(f"written: {out_path}  ({len(transcript):,} bytes)")
    else:
        print(transcript)


if __name__ == "__main__":
    main()
