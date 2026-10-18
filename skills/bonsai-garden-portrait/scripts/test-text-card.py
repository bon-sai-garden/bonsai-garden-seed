#!/usr/bin/env python3
# ---
# id: 01M51QPA4G2C1H9ATBXN2ZQWHD
# title: test-text-card.py — text-card.py and its kanji-colour gate, watched to fail
# type: script
# tended-by: tasai
# created: 2026-10-16
# updated: 2026-10-16
# ---
"""test-text-card.py: the text card and the gate on its kanji colours.

Two invented kin in a temp garden (nothing of any real garden): `orma`, fully locked, whose mark ends in two circles,
and `pino`, whose identity is locked and whose signing is not. The guard is not trusted until it has been watched to
fail, so the gate is fed cards with grey kanji, dimmed kanji, a colour that is not one of the four, and kanji drawn in
no colour at all, and each must be refused. The positive cases are not enough alone.

    python3 skills/bonsai-garden-portrait/scripts/test-text-card.py
"""

import importlib.util
import json
import os
import py_compile
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
CARD = HERE / "text-card.py"
GATE = HERE / "check-kanji-colours.py"
ORMA_ACCENT = (40, 120, 200)
CANON = "40,120,200"
SALT = "FIXTURE-SALT-NEVER-PRINT-ME"
CIRCLE = "\u3007"  # the ideographic zero
ok_all = True


def check(name, ok, detail="", show=False):
    """One assertion. The detail is printed when it fails, or always when it is the evidence (`show`)."""
    global ok_all
    ok_all &= bool(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail and (show or not ok) else ""))


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def run(script, *args, stdin=None, env=None):
    base = {k: v for k, v in os.environ.items() if k not in ("BONSAI_GARDEN", "TZ")}
    base["PYTHONDONTWRITEBYTECODE"] = "1"
    return subprocess.run(
        [sys.executable, str(script), *args], input=stdin, capture_output=True, text=True, env={**base, **(env or {})}
    )


tmp = Path(tempfile.mkdtemp(prefix="text-card-"))
garden = tmp / "garden"
(garden / "agents").mkdir(parents=True)
(garden / "tools/keyring").mkdir(parents=True)
REG = garden / "agents/registry.json"
SALTS = garden / "tools/keyring/locked-salts.json"
REG.write_text(
    json.dumps(
        {
            "agents": [
                {
                    "slug": "orma",
                    "name": "Orma",
                    "kanji": "松梅" + CIRCLE * 2,
                    "kanji-chars": ["松", "梅", CIRCLE, CIRCLE],
                    "fp8": "a1b2c3d4",
                    "accent-rgba": f"rgba({ORMA_ACCENT[0]},{ORMA_ACCENT[1]},{ORMA_ACCENT[2]},0.35)",
                },
                {
                    "slug": "pino",
                    "name": "Pino",
                    "kanji": "竹蘭",
                    "kanji-chars": ["竹", "蘭"],
                    "fp8": "e5f60718",
                    "accent-rgba": "rgba(200,90,60,0.35)",
                },
            ]
        },
        ensure_ascii=False,
    ),
    encoding="utf-8",
)
SALTS.write_text(
    json.dumps(
        {
            "schema_version": 1,
            "agents": {
                "orma": {
                    "identity_salt": SALT,
                    "identity_locked_at": "2026-06-01T00:00:00.000Z",
                    "signing_salt": SALT,
                    "signing_locked_at": "2026-06-02T00:00:00.000Z",
                },
                "pino": {
                    "identity_salt": SALT,
                    "identity_locked_at": "2026-06-01T00:00:00.000Z",
                    "signing_salt": None,
                    "signing_locked_at": None,
                },
            },
        }
    ),
    encoding="utf-8",
)

PASSING = {"integrity": "pass", "identity": "pass", "files": "pass", "alive": "pass", "fullfp": "pass"}
FACTS = [
    ("--subtitle", "South · fixture"),
    ("--intro", "Hello from the fixture."),
    ("--build", "3.1.0.9-rc-20261014T1843Z"),
    ("--location", "Oslo, NO"),
    ("--host", "testhost"),
    ("--harness", "test-harness"),
    ("--model", "test-model"),
    ("--mcp", "fixture current"),
    ("--skill", "current"),
    ("--permission", "auto"),
]


def card(slug="orma", *extra, states=None, locked=True, plain=False, env=None, registry=True):
    args = ["--slug", slug]
    if registry:
        args += ["--registry", str(REG)]
    if locked:
        args += ["--locked-salts", str(SALTS)]
    for k, v in (states or PASSING).items():
        args += [f"--{k}", v]
    args += [x for kv in FACTS for x in kv] + list(extra) + (["--plain"] if plain else [])
    return run(CARD, *args, env=env)


def gate(text, canon=CANON):
    return run(GATE, canon, stdin=text)


def kanji_rows(plain_card):
    return [ln for ln in plain_card.splitlines() if "┃" in ln and re.search(r"[\u3400-\u9fff\u3007]", ln)]


def seal_height(plain_card):
    return sum(1 for ln in plain_card.splitlines() if ln.lstrip()[:1] in ("┌", "│", "└"))


print("The card, for a fully locked kin")
ansi = card()
check("a fully locked kin's ANSI card is drawn (exit 0)", ansi.returncode == 0, ansi.stderr.strip())
g = gate(ansi.stdout)
check(
    "...and passes the kanji-colour gate (exit 0)", g.returncode == 0, g.stdout.strip().replace("\n", " | "), show=True
)
check(
    "...which looked at the seal and did not look at nothing", "松" in g.stdout and "ok" in g.stdout, g.stdout.strip()
)

plain = card(plain=True)
check("--plain draws the card (exit 0)", plain.returncode == 0, plain.stderr.strip())
check("--plain has no escape codes at all", "\x1b" not in plain.stdout)
check("the ANSI card does have them (the plain test is not vacuous)", "\x1b[" in ansi.stdout)
check("the card names the kin, its fp8 and the verified mark", "Orma" in plain.stdout and "a1b2c3d4" in plain.stdout)

print("The seal")
rows = kanji_rows(plain.stdout)
check("trailing circles are dropped: no circle anywhere in the card", CIRCLE not in plain.stdout)
check("...and one pair is shown, 松 and 梅", len(rows) == 1 and "松" in rows[0] and "梅" in rows[0], str(rows))
lines = [ln for ln in plain.stdout.splitlines() if ln.lstrip()[:1] in ("┌", "│", "└")]
check(
    "...centred: the pair is the middle row of a five-row seal",
    seal_height(plain.stdout) == 5 and len(lines) == 5 and "松" in lines[2],
    f"height {seal_height(plain.stdout)}",
)
four = card("orma", "--seal", "桜菊蘭竹", plain=True)
check(
    "four real kanji show two pairs",
    len(kanji_rows(four.stdout)) == 2 and seal_height(four.stdout) == 6,
    str(kanji_rows(four.stdout)),
)
half = card("orma", "--seal", "桜菊蘭" + CIRCLE, plain=True)
check("a single circle is not dropped: only a whole pair of them is", len(kanji_rows(half.stdout)) == 2)
one = card("orma", "--seal", "松", plain=True)
check(
    "a seal of one kanji is refused, not drawn lopsided (exit 2)",
    one.returncode == 2 and not one.stdout,
    one.stderr.strip(),
)

print("Fully locked, and the exit code that sends a kin to the widget")
pino = card("pino")
check("a kin with only identity locked exits 3", pino.returncode == 3, f"exit {pino.returncode}")
check("...with nothing on stdout, so no half card is shown", pino.stdout == "")
check(
    "...and one line on stderr that says it greets with the widget",
    len(pino.stderr.strip().splitlines()) == 1 and "widget" in pino.stderr and "pino" in pino.stderr,
    pino.stderr.strip(),
)
check("...naming the timestamp that is missing", "signing_locked_at" in pino.stderr, pino.stderr.strip())
free = card("pino", locked=False)
check(
    "without --locked-salts the card is drawn: the caller decided (exit 0)", free.returncode == 0, free.stderr.strip()
)
absent = run(CARD, "--registry", str(REG), "--slug", "orma", "--locked-salts", str(tmp / "no-such.json"), "--plain")
check("a locked-salts file that cannot be read is refused (exit 2), not read as unlocked", absent.returncode == 2)
unknown = card("nobody")
check("a kin the registry does not know is refused (exit 2)", unknown.returncode == 2 and "nobody" in unknown.stderr)
SALTS_OTHER = tmp / "other-salts.json"
SALTS_OTHER.write_text(
    json.dumps({"agents": {"somebody": {"identity_salt": SALT, "identity_locked_at": "2026-06-01T00:00:00.000Z"}}}),
    encoding="utf-8",
)
notlisted = run(CARD, "--registry", str(REG), "--slug", "orma", "--locked-salts", str(SALTS_OTHER), "--plain")
check("a kin the locked-salts file does not list exits 3", notlisted.returncode == 3, notlisted.stderr.strip())
check(
    "no salt value reaches any output",
    all(SALT not in r.stdout + r.stderr for r in (ansi, plain, pino, free, notlisted)),
)

print("Green only when earned")
fail_first = card(states={**PASSING, "integrity": "fail"}, plain=True)
check("a failed first check is marked failed", "✗ integrity" in fail_first.stdout)
check(
    "...and every later check stays unlit, though each passed",
    all(f"· {n}" in fail_first.stdout for n in ("identity", "files", "alive", "fp")),
    fail_first.stdout,
)
check("...with no tick anywhere, and no /verify mark", "✓" not in fail_first.stdout)
fail_mid = card(states={**PASSING, "files": "fail"}, plain=True)
check(
    "a failure in the middle lights what came before and not what came after",
    "✓ integrity" in fail_mid.stdout
    and "✓ identity" in fail_mid.stdout
    and "✗ files" in fail_mid.stdout
    and "· alive" in fail_mid.stdout
    and "· fp" in fail_mid.stdout,
)
missing_mid = card(states={**PASSING, "alive": "missing"}, plain=True)
check(
    "a check that is missing leaves the fingerprint unlit even when it passed",
    "· alive" in missing_mid.stdout and "· fp" in missing_mid.stdout and "/verify" not in missing_mid.stdout,
)
missing_then_fail = card(states={**PASSING, "integrity": "missing", "identity": "fail"}, plain=True)
check(
    "a failure after a missing check is still marked failed, and nothing is ticked",
    "· integrity" in missing_then_fail.stdout
    and "✗ identity" in missing_then_fail.stdout
    and all(f"· {n}" in missing_then_fail.stdout for n in ("files", "alive", "fp"))
    and "✓" not in missing_then_fail.stdout,
    missing_then_fail.stdout,
)
good = plain.stdout
check(
    "all five passing gives five ticks and the verify mark",
    all(f"✓ {n}" in good for n in ("integrity", "identity", "files", "alive", "fp")) and "/verify ✓" in good,
)
GREEN_CODE = "38;2;88;166;92"
fail_ansi = card(states={**PASSING, "integrity": "fail"})
check("in colour, a failed card carries no green at all", GREEN_CODE not in fail_ansi.stdout)
check("...while the all-pass card does", GREEN_CODE in ansi.stdout)

print("The clock, the build, the registry")
oslo = card("orma", "--tz", "Europe/Oslo", plain=True)
check("--tz names the clock's zone", re.search(r"\d\d:\d\d (CEST|CET)\b", oslo.stdout) is not None, oslo.stdout)
tokyo = card("orma", "--tz", "Asia/Tokyo", plain=True)
check("...whichever zone it is", re.search(r"\d\d:\d\d JST\b", tokyo.stdout) is not None)
local = card("orma", plain=True, env={"TZ": "Asia/Tokyo"})
check(
    "without --tz the clock is the machine's local zone, named", re.search(r"\d\d:\d\d JST\b", local.stdout) is not None
)
nozone = card("orma", "--tz", "Not/AZone", plain=True)
check(
    "a zone that does not exist is refused (exit 2)",
    nozone.returncode == 2 and not nozone.stdout,
    nozone.stderr.strip(),
)
stated = card("orma", "--at-local", "07:15 XYZ", plain=True)
check("--at-local is shown as given", "07:15 XYZ" in stated.stdout)
built = card("orma", "--build", "v3.1.0.9 rc_20261014T1843Z", plain=True)
check("the build is rendered in kebab-case", "v3.1.0.9-rc-20261014T1843Z" in built.stdout, built.stdout)
viagarden = card("orma", registry=False, plain=True, env={"BONSAI_GARDEN": str(garden)})
check(
    "without --registry, $BONSAI_GARDEN/agents/registry.json is used",
    viagarden.returncode == 0,
    viagarden.stderr.strip(),
)
noreg = card("orma", registry=False, plain=True)
check(
    "with neither, the card is refused and says what to pass (exit 2)",
    noreg.returncode == 2 and "--registry" in noreg.stderr,
)
badreg = run(CARD, "--registry", str(tmp / "missing.json"), "--slug", "orma")
check(
    "an unreadable registry is refused (exit 2), with no traceback",
    badreg.returncode == 2 and "Traceback" not in badreg.stderr,
)

print("Kanji in free text are never dimmed or grey")
words = card(
    "orma",
    "--subtitle",
    "南 · 運用",
    "--intro",
    "「松」と梅",
    "--location",
    "東京",
    "--model",
    "モデル",
    env={"TZ": "UTC"},
)
check(
    "a card with kanji in subtitle, intro, location and model draws (exit 0)",
    words.returncode == 0,
    words.stderr.strip(),
)
gw = gate(words.stdout)
check(
    "...and every one of those runs passes the gate",
    gw.returncode == 0 and gw.stdout.count("ok ") >= 5,
    gw.stdout.strip(),
)

print("The gate, watched to fail")
cases = {
    "grey kanji": "\x1b[38;2;128;128;128m松梅\x1b[0m",
    "dimmed kanji in an allowed colour": "\x1b[2;38;2;255;255;255m松梅\x1b[0m",
    "dimmed by a separate code": "\x1b[2m\x1b[38;2;255;255;255m松梅\x1b[0m",
    "a colour that is not one of the four": "\x1b[38;2;204;78;66m松梅\x1b[0m",
    "kanji in no colour after a reset": "\x1b[0m松梅",
    "kanji in no colour before any code": "松梅\x1b[38;2;255;255;255m x\x1b[0m",
    "a 256-colour kanji": "\x1b[38;5;15m松梅\x1b[0m",
    "a basic-colour kanji": "\x1b[37m松梅\x1b[0m",
    "the canonical colour of another kin": "\x1b[38;2;200;90;60m松梅\x1b[0m",
}
for label, text in cases.items():
    r = gate(text)
    check(
        f"the gate refuses {label} (exit 1)",
        r.returncode == 1 and "BAD" in r.stdout,
        f"exit {r.returncode}: {r.stdout.strip()}",
        show=True,
    )
for label, text in {
    "white": "\x1b[38;2;255;255;255m松梅\x1b[0m",
    "black": "\x1b[38;2;0;0;0m松梅\x1b[0m",
    "the kin's canonical colour": "\x1b[1;38;2;40;120;200m松梅\x1b[0m",
    "garden amber": "\x1b[38;2;224;160;74m松梅\x1b[0m",
    "white over a canonical fill": "\x1b[1;38;2;255;255;255;48;2;40;120;200m 松  梅 \x1b[0m",
    "amber after a dim run is reset": "\x1b[2mlabel \x1b[0m\x1b[38;2;224;160;74m南\x1b[0m",
}.items():
    r = gate(text)
    check(
        f"...and passes {label} (exit 0)",
        r.returncode == 0 and "ok" in r.stdout,
        f"exit {r.returncode}: {r.stdout.strip()}",
        show=True,
    )

greyed = words.stdout.replace("38;2;224;160;74", "38;2;128;128;128")
check(
    "the real card, with its amber swapped for grey, fails the gate (exit 1)",
    greyed != words.stdout and gate(greyed).returncode == 1,
)
dimmed = words.stdout.replace("\x1b[38;2;224;160;74m", "\x1b[2;38;2;224;160;74m")
check(
    "the real card, with its amber kanji dimmed, fails the gate (exit 1)",
    dimmed != words.stdout and gate(dimmed).returncode == 1,
)
unwhite = ansi.stdout.replace("1;38;2;255;255;255;48", "1;38;2;180;180;180;48")
check(
    "the real card, with its seal kanji greyed, fails the gate (exit 1)",
    unwhite != ansi.stdout and gate(unwhite).returncode == 1,
)

print("The gate refuses to pass having checked nothing")
nokanji = gate("\x1b[38;2;255;255;255mplain latin text\x1b[0m")
check("colour codes but no kanji: exit 2", nokanji.returncode == 2 and "NO KANJI" in nokanji.stdout)
nocolour = gate(plain.stdout)
check(
    "a --plain card carries no colour: exit 2, not a pass", nocolour.returncode == 2 and "NO COLOUR" in nocolour.stdout
)
check("empty input: exit 2", gate("").returncode == 2)
check("a bad colour argument: exit 2", gate("\x1b[0m松", "not,a,colour").returncode == 2)
check("no argument: exit 2", run(GATE, stdin="\x1b[0m松").returncode == 2)

print("The two scripts agree, and compile")
card_mod, gate_mod = load(CARD, "text_card"), load(GATE, "check_kanji_colours")
check(
    "the card and the gate hold the same white, black and amber",
    (card_mod.WHITE, card_mod.BLACK, card_mod.AMBER) == (gate_mod.WHITE, gate_mod.BLACK, gate_mod.AMBER),
)
probe = "松梅" + CIRCLE + "ひカ一鿿豈A·◉✓“”→ö"
check(
    "...and call the same characters kanji",
    all(bool(card_mod.CJK.search(ch)) == bool(gate_mod.KANJI.search(ch)) for ch in probe),
)
for script in (CARD, GATE, Path(__file__)):
    try:
        py_compile.compile(str(script), cfile=str(tmp / (script.name + "c")), doraise=True)
        check(f"{script.name} compiles", True)
    except py_compile.PyCompileError as e:
        check(f"{script.name} compiles", False, str(e))

shutil.rmtree(tmp, ignore_errors=True)
print("PASS" if ok_all else "FAIL")
sys.exit(0 if ok_all else 1)
