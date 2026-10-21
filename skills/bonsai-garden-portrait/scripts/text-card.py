#!/usr/bin/env python3
# ---
# id: 01M51QPA4G2C1H9ATBXN2ZQWHB
# title: text-card.py — a kin's greeting as a text card
# type: script
# tended-by: tasai
# created: 2026-10-16
# updated: 2026-10-16
# ---
"""text-card.py: a kin's greeting as a text card.

The same facts as the v6 widget (identity, the five checks, build, environment) in a few hundred characters instead of
eleven thousand: the widget reaches a chat only by being re-typed token by token (measured at 7,000 to 10,000 output
tokens a greeting); this card is about 350. It is the greeting of a kin whose salts are fully locked, on the
gardener's word of 2026-10-16: "A) for you and all original bonsai garden crew with fully locked 4 digit salt,
approved." Any other kin keeps the widget (`fill-greeting.py`).

The kin's mark is a seal: up to four kanji as two pairs, white on the kin's canonical accent (the registry's
`accent-rgba`), inside a white outline. When the second pair is two circles (U+3007 twice) they are left out and the first pair
sits centred. Green only when earned: a check is ticked only while it and every check before it passed; a check that
failed is red wherever it stands; every other check stays unlit, so after the first check that did not pass nothing is
ticked again. Kanji take only white, black, the kin's canonical colour or garden amber, never another colour
and never dimmed (the gardener, 2026-10-16): free text goes through `k()`, which sets every kanji run in amber on its
own, and `check-kanji-colours.py` is the gate. `--plain` drops every escape code (for a chat, where a terminal colour
cannot show) and draws the seal as a double frame. The text column is open on the right on purpose: a kanji is two
columns wide in a terminal but not always in a chat font, so a right-hand border would wobble wherever one sits.

    python3 text-card.py --registry <garden>/agents/registry.json --slug <slug> \\
      --locked-salts <the garden's locked-salts file> --tz <zone> \\
      --subtitle "South · operations" --intro "<the kin's intro line>" --build 3.1.0.9-rc-20261014T1843Z \\
      --integrity pass --identity pass --files pass --alive pass --fullfp pass \\
      --location "<city>, <country>" --host <host> --harness "<harness>" --model "<model>" \\
      --mcp "<mcp state>" --skill "<skill state>" --permission auto --plain

Every value is a flag the kin's seat filled from what they loaded or ran this turn; nothing here is looked up but the kin's own
name, kanji, fingerprint and accent.

  --registry      the garden's agents/registry.json; omitted, `$BONSAI_GARDEN/agents/registry.json`.
  --locked-salts  the garden's locked-salts file (JSON, `agents.<slug>`). The whole file is parsed; only the two
                  timestamps are used (`identity_locked_at` and `signing_locked_at`), and no salt reaches any output.
                  A kin with both is fully locked. Without the flag the card is drawn: the caller decided.
  --tz            an IANA zone for the clock; omitted, the machine's local zone. The clock names its zone either way.

Exit: 0 the card drawn · 2 refused (a registry or locked-salts file that cannot be read, a kin the registry does not
know, no seal to draw, a zone that does not exist) · 3 the kin is not fully locked: one line on stderr, and the kin
greets with the widget instead.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# Kanji take only these colours (the gardener, 2026-10-16): white, black, the kin's canonical colour, or garden amber.
WHITE, BLACK = (255, 255, 255), (0, 0, 0)
AMBER = (224, 160, 74)  # garden amber, #E0A04A: the site's amber stage accent
CJK = re.compile(r"([\u3000-\u303f\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]+)")
GREEN, RED, DIM = (88, 166, 92), (204, 78, 66), (128, 128, 128)
SEAL_W = 10  # the seal's width in terminal columns, outline included
CIRCLE = "\u3007"  # the ideographic zero: a mark with nothing in a place
LOCK_KEYS = ("identity_locked_at", "signing_locked_at")  # both present: the kin is fully locked
CHECKS = ("integrity", "identity", "files", "alive", "fp")


def refuse(message, code=2):
    print(f"text-card: {message}", file=sys.stderr)
    sys.exit(code)


def seal_pairs(chars):
    """Four kanji as two pairs; a second pair of two circles is left out, so the first pair sits alone."""
    chars = [ch for ch in chars if ch.strip()][:4]
    first, second = chars[:2], chars[2:4]
    return [first, second] if len(second) == 2 and second != [CIRCLE, CIRCLE] else [first]


def seal_rows(chars, plain, c, accent):
    """The seal, row by row. Terminal: white kanji on the canonical colour, a white outline around it.
    Plain: a heavy inner frame inside a light outline. One kanji pair per row, so a chat font that does not draw a
    kanji at exactly two columns shifts every kanji row alike."""
    pairs = seal_pairs(chars)
    if plain:
        return ["┌────────┐", "│┏━━━━━━┓│"] + [f"│┃{p[0]}  {p[1]}┃│" for p in pairs] + ["│┗━━━━━━┛│", "└────────┘"]

    def edge(s):
        return c(s, WHITE)

    def fill(s, **kw):
        return c(s, bg=accent, **kw)

    rows = [edge("┌────────┐"), edge("│") + fill("        ") + edge("│")]
    rows += [edge("│") + fill(f" {p[0]}  {p[1]} ", rgb=WHITE, bold=True) + edge("│") for p in pairs]
    rows += [edge("│") + fill("        ") + edge("│"), edge("└────────┘")]
    return rows


def rgb_of(accent):
    m = re.match(r"rgba?\((\d+),\s*(\d+),\s*(\d+)", accent or "")
    return tuple(int(x) for x in m.groups()) if m else (160, 160, 160)


def registry_path(arg):
    if arg:
        return Path(arg)
    garden = os.environ.get("BONSAI_GARDEN")
    if garden:
        return Path(garden) / "agents" / "registry.json"
    return refuse("no registry: pass --registry, or set $BONSAI_GARDEN")


def read_json(path, what):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        return refuse(f"cannot read the {what} {path}: {e}")


def find_kin(path, slug):
    reg = read_json(path, "registry")
    agents = reg.get("agents") or reg.get("members") if isinstance(reg, dict) else reg
    agents = list(agents.values()) if isinstance(agents, dict) else agents
    if not isinstance(agents, list):
        refuse(f"{path} holds no list of agents")
    kin = next((x for x in agents if isinstance(x, dict) and x.get("slug") == slug), None)
    return kin or refuse(f"no {slug!r} in the registry {path}: refusing to draw a card for a kin it does not know")


def unlocked(path, slug):
    """The reason a kin is not fully locked, or None when both timestamps are set. Reads only those two keys."""
    data = read_json(path, "locked-salts file")
    table = data.get("agents", data) if isinstance(data, dict) else None
    if not isinstance(table, dict):
        refuse(f"{path} is not a table of kin")
    entry = table.get(slug)
    if not isinstance(entry, dict):
        return f"not in {Path(path).name}"
    missing = [k for k in LOCK_KEYS if not (isinstance(entry.get(k), str) and entry[k].strip())]
    return f"{' and '.join(missing)} not set" if missing else None


def clock(tz):
    """HH:MM and the zone's own name (CEST in summer, CET in winter), in --tz or the machine's local zone."""
    try:
        now = datetime.now(ZoneInfo(tz)) if tz else datetime.now().astimezone()
    except (ZoneInfoNotFoundError, ValueError, OSError):
        return refuse(f"no time zone {tz!r}")
    return now.strftime("%H:%M ") + (now.strftime("%Z") or now.strftime("UTC%z"))


def main():
    ap = argparse.ArgumentParser(description="A kin's greeting as a text card. See the module docstring.")
    ap.add_argument(
        "--registry", help="the garden's agents/registry.json; omitted, $BONSAI_GARDEN/agents/registry.json"
    )
    ap.add_argument("--slug", required=True)
    ap.add_argument("--locked-salts", help="the garden's locked-salts file: a kin not fully locked exits 3")
    ap.add_argument("--seal", default="", help="the four kanji of the seal; default the registry's kanji")
    ap.add_argument("--tz", help="an IANA zone for the clock; default the machine's local zone")
    for k in ("subtitle", "intro", "build", "body", "location", "at-local", "host", "harness", "model", "mcp", "skill"):
        ap.add_argument(f"--{k}", default="")
    ap.add_argument("--permission", default="")
    for k in ("integrity", "identity", "files", "alive", "fullfp"):
        ap.add_argument(f"--{k}", choices=["pass", "fail", "missing"], default="missing")
    ap.add_argument("--plain", action="store_true")
    a = ap.parse_args()

    kin = find_kin(registry_path(a.registry), a.slug)
    if a.locked_salts:
        why = unlocked(a.locked_salts, a.slug)
        if why:
            refuse(f"{a.slug} is not fully locked ({why}): they greet with the widget instead", code=3)
    accent = rgb_of(kin.get("accent-rgba"))
    seal_chars = list(a.seal) if a.seal else (kin.get("kanji-chars") or list(kin.get("kanji", "")))
    if len([ch for ch in seal_chars if ch.strip()]) < 2:
        refuse(f"no seal for {a.slug}: a seal needs at least two kanji (--seal, or the registry's kanji)")

    def c(text, rgb=None, bold=False, dim=False, bg=None):
        codes = (
            (["1"] if bold else [])
            + (["2"] if dim else [])
            + ([f"38;2;{rgb[0]};{rgb[1]};{rgb[2]}"] if rgb else [])
            + ([f"48;2;{bg[0]};{bg[1]};{bg[2]}"] if bg else [])
        )
        return text if a.plain or not text or not codes else f"\x1b[{';'.join(codes)}m{text}\x1b[0m"

    def k(text, **style):
        """Text whose kanji runs are set apart in garden amber, never in the surrounding style (no grey or dimmed kanji)."""
        return "".join(c(part, AMBER) if CJK.fullmatch(part) else c(part, **style) for part in CJK.split(text) if part)

    # green only when earned: ticked while every check so far passed; a failure is red wherever it stands; the rest unlit
    checks, lit = [], True
    for name, state in zip(CHECKS, (a.integrity, a.identity, a.files, a.alive, a.fullfp)):
        if state == "pass" and lit:
            checks.append(c("✓ " + name, GREEN))
        elif state == "fail":
            checks.append(c("✗ " + name, RED, bold=True))
            lit = False
        else:
            checks.append(c("· " + name, DIM))
            lit = False
    verified = lit

    right = [
        "",
        c(kin.get("name", a.slug), accent, bold=True),
        k(a.subtitle, dim=True),
        k(f"“{a.intro}”") if a.intro else "",
        "  ".join(checks[:4]),
        checks[4]
        + "  "
        + c(kin.get("fp8", ""), accent if verified else DIM)
        + ("  " + c("/verify ✓", GREEN) if verified else ""),
    ]
    seal = seal_rows(seal_chars, a.plain, c, accent)
    rows = max(len(seal), len(right))
    seal += [" " * SEAL_W] * (rows - len(seal))
    right += [""] * (rows - len(right))
    out = [" " + s_ + "   " + r for s_, r in zip(seal, right)]

    when = a.at_local or clock(a.tz)
    env = " · ".join(x for x in (a.host, a.harness, a.model) if x)
    setup = " · ".join(
        x for x in (f"mcp {a.mcp}" if a.mcp else "", f"skill {a.skill}" if a.skill else "", a.permission) if x
    )
    out.append(c("─" * 48, accent, dim=True))
    build = re.sub(r"[\s_]+", "-", a.build.strip()).removeprefix("v")  # kebab-case, whatever the caller typed
    out.append(
        c(f" v{build}" if build else " build unstamped", accent, bold=True)
        + (c("  · body " + a.body, dim=True) if a.body else "")
    )
    out.append(k(f" ◉ {' · '.join(x for x in (a.location, when) if x)}" + (f"   ▣ {env}" if env else ""), dim=True))
    if setup:
        out.append(k(f" ⚙ {setup}", dim=True))
    print("\n".join(line.rstrip() for line in out))


if __name__ == "__main__":
    main()
