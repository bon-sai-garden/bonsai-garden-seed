#!/usr/bin/env python3
# ---
# id: 01M51QPA4G2C1H9ATBXN2ZQWHC
# title: check-kanji-colours.py — the gate on a text card's kanji colours
# type: script
# tended-by: tasai
# created: 2026-10-16
# updated: 2026-10-16
# ---
"""check-kanji-colours.py: the gate on `text-card.py`.

Reads ANSI text on stdin. Every run of kanji must be drawn in white, black, the given canonical colour or garden amber,
and never dimmed (the gardener, 2026-10-16: "your kanji should be white, black or canonical color. maybe garden amber.
never anything else").

    python3 text-card.py ... | python3 check-kanji-colours.py 192,80,58        (the kin's accent, as R,G,B)

The colour in force is carried from one escape code to the next, the way a terminal does, and reset by `0` or `ESC[m`:
a kanji run is judged by the colour it is actually drawn in, however the codes were split. Text before the first
escape code is drawn in the terminal's own colour, which is none of the four. A 256-colour or basic-colour kanji is
refused, because only a 24-bit colour can be one of the four.

Exit: 0 every kanji run passes · 1 a kanji run is in another colour or dimmed · 2 nothing was checked: no kanji at
all, or no colour codes at all (a `--plain` card carries none), or a bad argument. A gate that checked nothing is
never a pass.
"""

import re
import sys

WHITE, BLACK, AMBER = (255, 255, 255), (0, 0, 0), (224, 160, 74)  # garden amber, #E0A04A
KANJI = re.compile(r"[\u3000-\u303f\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]")
SGR = re.compile(r"\x1b\[([0-9;]*)m")


def advance(params, fg, dim):
    """The foreground and dim state after one SGR escape code."""
    toks = params.split(";") if params else ["0"]
    i = 0
    while i < len(toks):
        t = toks[i] or "0"
        if t == "0":
            fg, dim = None, False
        elif t == "2":
            dim = True
        elif t == "22":
            dim = False
        elif t == "39":
            fg = None
        elif t in ("38", "48") and toks[i + 1 : i + 2] == ["2"]:
            if t == "38":
                rgb = toks[i + 2 : i + 5]
                fg = tuple(int(x) for x in rgb) if len(rgb) == 3 and all(x.isdigit() for x in rgb) else ("malformed",)
            i += 4
        elif t in ("38", "48") and toks[i + 1 : i + 2] == ["5"]:
            if t == "38":
                fg = ("256-colour", *toks[i + 2 : i + 3])
            i += 2
        elif t.isdigit() and (30 <= int(t) <= 37 or 90 <= int(t) <= 97):
            fg = ("basic-colour", t)
        i += 1
    return fg, dim


def runs(text):
    """(foreground, dim, text) for each stretch of text between escape codes."""
    out, fg, dim, pos = [], None, False, 0
    for m in SGR.finditer(text):
        if m.start() > pos:
            out.append((fg, dim, text[pos : m.start()]))
        fg, dim = advance(m.group(1), fg, dim)
        pos = m.end()
    if pos < len(text):
        out.append((fg, dim, text[pos:]))
    return out


def check(text, canon):
    """(verdict lines, bad count, kanji runs seen) for ANSI text, against the kin's canonical colour."""
    allowed = {WHITE, BLACK, AMBER, canon}
    lines, bad, seen = [], 0, 0
    for fg, dim, run in runs(text):
        if KANJI.search(run):
            seen += 1
            ok = fg in allowed and not dim
            bad += not ok
            lines.append(("ok  " if ok else "BAD ") + repr(run.strip()) + f" {fg}" + (" dim" if dim else ""))
    return lines, bad, seen


def main(argv):
    if argv in (["-h"], ["--help"]):
        print(__doc__)
        return 0
    parts = argv[0].split(",") if len(argv) == 1 else []
    if len(parts) != 3 or not all(p.strip().isdigit() and int(p) < 256 for p in parts):
        print("usage: check-kanji-colours.py R,G,B   (the kin's canonical colour; ANSI text on stdin)", file=sys.stderr)
        return 2
    text = sys.stdin.read()
    if not SGR.search(text):
        print("NO COLOUR CODES SEEN: nothing was checked, so nothing passes (plain text carries no colour)")
        return 2
    lines, bad, seen = check(text, tuple(int(p) for p in parts))
    print("\n".join(lines))
    if not seen:
        print("NO KANJI SEEN: nothing was checked, so nothing passes")
        return 2
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
