#!/usr/bin/env python3
# ---
# id: 01M48VA8HRW31HTGXZVA8BZARR
# title: A stand-in seal renderer for the crew-page tests
# type: script
# tended-by: eisai
# created: 2026-10-06
# updated: 2026-10-06
# ---
"""fake_render.py --kanji K --fp F --tier T --mode M --label L — prints one small SVG, as the
seal_renderer contract asks. The fingerprint is deliberately NOT printed: a real renderer must not
put one in the seal either, and the tests would catch it."""

import argparse
import html

ap = argparse.ArgumentParser()
for k in ("--kanji", "--fp", "--tier", "--mode", "--label"):
    ap.add_argument(k)
a = ap.parse_args()
print(
    f'<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img"><title>{html.escape(a.label)}</title>'
    f'<rect width="64" height="64" fill="#fdfbf5"/><rect x="8" y="8" width="48" height="48" fill="#b8624c14"/>'
    f'<text x="32" y="38" text-anchor="middle" font-size="16">{html.escape(a.kanji)}</text></svg>'
)
