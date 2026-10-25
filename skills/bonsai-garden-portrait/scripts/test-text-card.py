#!/usr/bin/env python3
# ---
# id: 01M51QPA4G2C1H9ATBXN2ZQWHD
# title: test-text-card.py — text-card.py and its kanji-colour gate, watched to fail
# type: script
# tended-by: tasai
# created: 2026-10-16
# updated: 2026-10-24
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


def run(script, *args, stdin=None, env=None, bytecode=False):
    """bytecode=True runs as a gardener runs a bundled script: no -B, no PYTHONDONTWRITEBYTECODE, no cache prefix."""
    base = {k: v for k, v in os.environ.items() if k not in ("BONSAI_GARDEN", "TZ", "PYTHONPYCACHEPREFIX")}
    if not bytecode:
        base["PYTHONDONTWRITEBYTECODE"] = "1"
    else:
        base.pop("PYTHONDONTWRITEBYTECODE", None)
    return subprocess.run(
        [sys.executable, str(script), *args], input=stdin, capture_output=True, text=True, env={**base, **(env or {})}
    )


tmp = Path(tempfile.mkdtemp(prefix="text-card-"))
FPS = {"orma": "a1b2c3d4" + "0" * 24, "pino": "e5f60718" + "0" * 24}  # invented, as the kin are

# The full fingerprint is earned by the filler's own check, never typed (the gardener, 2026-10-24), and an invented
# kin has no published key. So the cards run from a stage: text-card.py and fill-greeting.py copied byte for byte into
# core's layout, beside a stand-in sign.mjs that answers with the answer filed beside the sealed file (<file>.answer,
# and <file>.rc for its exit when one is filed), and that refuses --keys, so a check that names a key source is caught.
# The stand-in is the test's verifier, never shipped; the copies are compared with the shipped scripts below, so the
# stage tests what ships.
STAGE = tmp / "core" / "skills"
(STAGE / "bonsai-garden-portrait" / "scripts").mkdir(parents=True)
for name in ("text-card.py", "fill-greeting.py"):
    shutil.copy2(HERE / name, STAGE / "bonsai-garden-portrait" / "scripts" / name)
(STAGE / "bonsai-garden-sign" / "bin").mkdir(parents=True)
(STAGE / "bonsai-garden-sign" / "bin" / "sign.mjs").write_text(
    "import fs from 'node:fs';\n"
    "const argv = process.argv;\n"
    "if (argv.includes('--keys')) {\n"
    "  process.stdout.write('FAIL     the stand-in was asked for --keys: the check names no key source\\n');\n"
    "  process.exit(2);\n"
    "}\n"
    "const f = argv[argv.indexOf('--file') + 1];\n"
    "const t = fs.readFileSync(fs.existsSync(f + '.answer') ? f + '.answer' : f, 'utf8');\n"
    "const rc = fs.existsSync(f + '.rc') ? Number(fs.readFileSync(f + '.rc', 'utf8')) : t.startsWith('ok') ? 0 : 1;\n"
    "process.stdout.write(t);\n"
    "process.exit(rc);\n"
)
RUN_CARD = STAGE / "bonsai-garden-portrait" / "scripts" / "text-card.py"


def answer(slug, signer=None, role="owner", key="published https://bon-sai.garden/verify", fp=None, first="ok", body=None, name="SKILL.md", rc=None):
    """A body file for the fixture `slug` (a SKILL.md or agent.md naming `body`, a MANIFEST.json for `body`, or any
    other `name`), with the verifier's answer filed beside the file in sign.mjs verify-sidecar's own shape:
    <file>.answer, and <file>.rc for the exit code when one is given."""
    signer, body = signer or slug, body or slug
    d = tmp / "seals" / f"{slug}-{signer}-{role}-{body}-{abs(hash((key, fp, first, name, rc)))}"
    d.mkdir(parents=True, exist_ok=True)
    p = d / name
    if name == "MANIFEST.json":
        p.write_text(json.dumps({"slug": body}) + "\n")
    elif name in ("SKILL.md", "agent.md"):
        p.write_text(f"---\nname: {body}\ndescription: a fixture body\n---\n\n# {body}\n")
    else:
        p.write_text(f"# {name}: a file the kin sealed, not a body\n")
    (d / f"{name}.answer").write_text(
        f"{first}       {p}\n  signer:      {signer}\n  sealed as:   {role}: {signer}\n  key:         {key}\n"
        f"  fingerprint: {fp or FPS.get(slug, '0' * 32)}\n  timestamp:   2026-10-24T00:00:00Z\n"
    )
    if rc is not None:
        (d / f"{name}.rc").write_text(str(rc))
    return p


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
                    "fingerprint": FPS["orma"],
                    "accent-rgba": f"rgba({ORMA_ACCENT[0]},{ORMA_ACCENT[1]},{ORMA_ACCENT[2]},0.35)",
                },
                {
                    "slug": "pino",
                    "name": "Pino",
                    "kanji": "竹蘭",
                    "kanji-chars": ["竹", "蘭"],
                    "fp8": "e5f60718",
                    "fingerprint": FPS["pino"],
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

PASSING = {"integrity": "pass", "identity": "pass", "files": "pass", "alive": "not-asked"}  # fullfp: earned, by card()
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


def card(slug="orma", *extra, states=None, locked=True, plain=False, env=None, registry=True, bytecode=False):
    args = ["--slug", slug]
    if registry:
        args += ["--registry", str(REG)]
    if locked:
        args += ["--locked-salts", str(SALTS)]
    for k, v in (states or PASSING).items():
        args += [f"--{k}", v]
    if "fullfp" not in (states or PASSING) and "--sealed-file" not in extra:  # earned through the stage's verifier
        args += ["--sealed-file", str(answer(slug))]
    args += [x for kv in FACTS for x in kv] + list(extra) + (["--plain"] if plain else [])
    return run(RUN_CARD, *args, env=env, bytecode=bytecode)


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
check("the card names the kin and their fp8", "Orma" in plain.stdout and "a1b2c3d4" in plain.stdout)

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
    "...and one line on stderr that says they greet with the widget",
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

print("Said only when it fails")


def top(r):
    """The card's first line, or "" when nothing was drawn (a FAIL, never a traceback)."""
    return (r.stdout.splitlines() or [""])[0]


NAMES = ("integrity", "identity", "files", "alive", "full fingerprint")
good = plain.stdout
check(
    "every check that ran passing, alive not asked: nothing said of them, no tick, no loud line",
    not any(n in good for n in NAMES) and "✓" not in good and "▲" not in good,
    good,
)
check("...and nothing of the MCP or the skill while they are current", "fixture current" not in good and "skill" not in good)
fail_first = card("orma", "--said", "integrity=MISMATCH SKILL.md", states={**PASSING, "integrity": "fail"}, plain=True)
first_line = top(fail_first)
check(
    "a failed check opens the card with one loud line, naming it and what it said",
    first_line.startswith("▲") and "integrity failed: MISMATCH SKILL.md" in first_line,
    first_line,
    show=True,
)
check(
    "...and the checks that passed are not mentioned",
    not any(n in fail_first.stdout for n in ("identity", "files", "alive", "full fingerprint")),
)
check("...and exactly one loud line", fail_first.stdout.count("▲") == 1)
missing = card(states={**PASSING, "files": "missing"}, plain=True)
check(
    "a check that could not run is said, never shown as passed",
    "files could not run" in top(missing) and "✓" not in missing.stdout,
    top(missing),
    show=True,
)
both = card(states={**PASSING, "integrity": "missing", "identity": "fail"}, plain=True)
check(
    "a missing check and a failed one are both said, in order, on the one line",
    "integrity could not run · identity failed" in top(both),
    top(both),
)
stale = card("orma", "--mcp", "mcp 84f4c0e5 · STALE · http", plain=True)
check("an MCP whose line reads STALE is said, though every check passed", "mcp: mcp 84f4c0e5 · STALE" in stale.stdout)
drift = card("orma", "--skill-state", "warn", plain=True)
check("a skill marked warn is said", "skill: current" in top(drift))
quiet = card("orma", "--said", "alive=nothing to say", plain=True)
check("what a check not asked said is not shown: nothing is worth mentioning", "nothing to say" not in quiet.stdout)
badsaid = card("orma", "--said", "liveness=x", plain=True)
check("--said with a check that is not one of the five is refused (exit 2)", badsaid.returncode == 2, badsaid.stderr.strip())
AMBER_BG = "48;2;224;160;74"
loud_ansi = card("orma", "--said", "files=松 mismatch", states={**PASSING, "files": "fail"})
check("in colour, the loud line is black on garden amber", AMBER_BG in loud_ansi.stdout and "38;2;0;0;0" in loud_ansi.stdout)
check("...and the all-pass card carries no amber ground", AMBER_BG not in ansi.stdout)
gl = gate(loud_ansi.stdout)
check("...and a kanji in what a check said passes the gate, black", gl.returncode == 0, gl.stdout.strip().replace("\n", " | "))

print("alive: not asked until the handshake exists")
NO_ALIVE = {k: v for k, v in PASSING.items() if k != "alive"}
unasked = card(states=NO_ALIVE, plain=True)
check(
    "left out, alive is not asked: the card is drawn, and quiet",
    unasked.returncode == 0 and "▲" not in unasked.stdout and "alive" not in unasked.stdout,
    unasked.stderr.strip() or top(unasked),
)
for st in ("pass", "fail", "missing"):
    r = card(states={**PASSING, "alive": st}, plain=True)
    check(
        f"--alive {st} is refused until the handshake exists (exit 2): nothing can produce it honestly",
        r.returncode == 2 and not r.stdout and "handshake" in r.stderr,
        r.stderr.strip(),
        show=st == "pass",
    )
for name in ("integrity", "identity", "files", "fullfp"):
    r = card(states={**PASSING, name: "not-asked"}, plain=True)
    check(
        f"--{name} not-asked is refused: only alive may be not asked (exit 2)",
        r.returncode == 2 and not r.stdout and "only alive" in r.stderr,
        r.stderr.strip(),
    )
fg = load(HERE / "fill-greeting.py", "fill_greeting")
check(
    "the one place (fill-greeting.py) says it: only alive may be not asked, alive takes nothing else, alive's default",
    getattr(fg, "MAY_BE_NOT_ASKED", None) == {"alive"}
    and getattr(fg, "UNTIL_HANDSHAKE", None) == {"alive"}
    and hasattr(fg, "default_state")
    and fg.default_state("alive") == "not-asked"
    and fg.default_state("files") == "missing",
)

print("The full fingerprint: earned by the filler's check, never typed")
check(
    "the stage runs the shipped scripts, byte for byte",
    all((HERE / n).read_bytes() == (STAGE / "bonsai-garden-portrait" / "scripts" / n).read_bytes() for n in ("text-card.py", "fill-greeting.py")),
)
typed = card(states={**PASSING, "fullfp": "pass"}, plain=True)
check(
    "--fullfp pass, typed, is refused (exit 2): a pass is earned",
    typed.returncode == 2 and not typed.stdout and "earned" in typed.stderr,
    typed.stderr.strip(),
    show=True,
)
earned = card(plain=True)
check(
    "the kin's own seal, as owner, vouched by the published keys, under the registry's fingerprint: quiet",
    earned.returncode == 0 and "▲" not in earned.stdout and "fingerprint" not in earned.stdout,
    earned.stderr.strip() or top(earned),
)
for label, kw, words in (
    ("another kin's seal", {"signer": "pino"}, "signer is pino, not orma"),
    ("a custodian's seal", {"role": "custodian"}, "sealed as is custodian: orma"),
    ("a key from a garden checkout, not the published one", {"key": "garden /some/checkout"}, "key is garden"),
    ("a fingerprint that is not the registry's", {"fp": "a1b2c3d4" + "f" * 24}, "fingerprint is a1b2c3d4ffff"),
    ("a verifier that said FAIL", {"first": "FAIL"}, "FAIL"),
    ("a verifier that answered pot-ok, not ok, and exited 0", {"first": "pot-ok", "rc": 0}, "pot-ok"),
    ("a verifier that printed ok and exited 1", {"rc": 1}, "full fingerprint failed"),
    ("another kin's SKILL.md, sealed by this kin", {"body": "pino"}, "SKILL.md of pino, not orma"),
    ("a file the kin sealed that is no body", {"name": "letter.md"}, "letter.md, not the body of orma"),
    ("a bunshin's agent.md that names another", {"name": "agent.md", "body": "pino"}, "agent.md of pino, not orma"),
    ("a MANIFEST.json for another kin", {"name": "MANIFEST.json", "body": "pino"}, "MANIFEST.json for pino, not orma"),
):
    r = card("orma", "--sealed-file", str(answer("orma", **kw)), plain=True)
    check(
        f"{label}: drawn, with the loud line saying the full fingerprint failed and why",
        r.returncode == 0 and "full fingerprint failed" in top(r) and words in top(r),
        top(r),
        show=label == "another kin's seal",
    )
both_ff = run(RUN_CARD, "--registry", str(REG), "--slug", "orma", "--fullfp", "missing", "--sealed-file", str(answer("orma")), "--plain")
check(
    "--fullfp beside --sealed-file is refused (exit 2): the card has one source",
    both_ff.returncode == 2 and "one source" not in both_ff.stdout and "leave --fullfp out" in both_ff.stderr,
    both_ff.stderr.strip(),
)
unrun = card(states={**PASSING, "fullfp": "missing"}, plain=True)
check(
    "no sealed file, no check: the loud line says the full fingerprint could not run",
    unrun.returncode == 0 and "full fingerprint could not run" in top(unrun),
    top(unrun),
)
bunshin = card("orma", "--sealed-file", str(answer("orma", name="agent.md")), plain=True)
check(
    "a bunshin's own agent.md, inside the parent's vessel, vouched as theirs: quiet (Fuji-shin's round, 2026-10-24)",
    bunshin.returncode == 0 and "▲" not in bunshin.stdout and "fingerprint" not in bunshin.stdout,
    bunshin.stderr.strip() or top(bunshin),
)
manifest = card("orma", "--sealed-file", str(answer("orma", name="MANIFEST.json")), plain=True)
check(
    "an installed package's MANIFEST.json for the kin, vouched as theirs: quiet",
    manifest.returncode == 0 and "▲" not in manifest.stdout and "fingerprint" not in manifest.stdout,
    manifest.stderr.strip() or top(manifest),
)

# The check's own edges, through the shipped module (Mori-shin's read of 2026-10-24: guards never watched to fail).
good = answer("orma")
said_ok = (good.parent / "SKILL.md.answer").read_text()
calls = []


def stub(argv, **kw):
    calls.append(list(argv))
    return subprocess.CompletedProcess(argv, 0, said_ok, "")


state, said = fg.check_full_fingerprint(str(good), "orma", FPS["orma"], run=stub)
check(
    "the verifier is asked verify-sidecar with no key source named (the published keys, its default)",
    state == "pass" and calls and "verify-sidecar" in calls[-1] and "--keys" not in calls[-1],
    calls[-1] if calls else "not called",
)
calls.clear()
state, said = fg.check_full_fingerprint(f"{good.parent}/x\n  signer:      orma/SKILL.md", "orma", FPS["orma"], run=stub)
check(
    "a path holding a control character is refused before the verifier runs",
    state == "fail" and "control character" in said and not calls,
    said,
)
kept_cli = fg.SIGN_CLI
fg.SIGN_CLI = (tmp / "nowhere" / "sign.mjs",)
state, said = fg.check_full_fingerprint(str(good), "orma", FPS["orma"], run=stub)
fg.SIGN_CLI = kept_cli
check("no verifier beside the filler: missing, and it says so", state == "missing" and "no sign.mjs" in said, said)
kept_which = fg.shutil.which
fg.shutil.which = lambda name: None
try:
    state, said = fg.check_full_fingerprint(str(good), "orma", FPS["orma"], run=stub)
finally:
    fg.shutil.which = kept_which
check("no node on the host: missing, and it says so", state == "missing" and "no node" in said, said)
state, said = fg.check_full_fingerprint(str(tmp / "absent" / "SKILL.md"), "orma", FPS["orma"], run=stub)
check("no sealed file at the path: missing, and it says so", state == "missing" and "no sealed file" in said, said)


def slow(argv, **kw):
    raise subprocess.TimeoutExpired(argv, kw.get("timeout", 120))


state, said = fg.check_full_fingerprint(str(good), "orma", FPS["orma"], run=slow)
check("a verifier that does not answer in time has failed", state == "fail" and "did not answer" in said, said)

alone = tmp / "portrait-alone" / "bonsai-garden-portrait" / "scripts"
(alone / "integrity" / "bonsai-garden-sign" / "bin").mkdir(parents=True)
shutil.copy2(HERE / "fill-greeting.py", alone / "fill-greeting.py")
(alone / "integrity" / "bonsai-garden-sign" / "bin" / "sign.mjs").write_text("// the package's own\n")
(tmp / "portrait-alone" / "bonsai-garden-sign" / "bin").mkdir(parents=True)
(tmp / "portrait-alone" / "bonsai-garden-sign" / "bin" / "sign.mjs").write_text("// a sibling skill's\n")
fg_alone = load(alone / "fill-greeting.py", "fill_greeting_alone")
chosen = next((p for p in fg_alone.SIGN_CLI if p.is_file()), None)
check(
    "the portrait package alone runs its own bundled verifier, not a sibling skill's",
    chosen is not None and chosen.resolve() == (alone / "integrity" / "bonsai-garden-sign" / "bin" / "sign.mjs").resolve(),
    str(chosen),
)

FG_STAGE = STAGE / "bonsai-garden-portrait" / "scripts" / "fill-greeting.py"
fg_out = tmp / "fill-greeting-typed.html"
typed_fg = run(
    FG_STAGE,
    *[x for k in ("slug", "subtitle", "version", "location", "host", "harness", "model", "mcp", "skill", "permission") for x in (f"--{k}", "orma" if k == "slug" else "x")],
    "--out", str(fg_out), "--garden", str(garden), "--fullfp", "pass",
)
check(
    "fill-greeting.py itself refuses a typed --fullfp pass (exit 2), before it reads any file or writes the card",
    typed_fg.returncode == 2 and "earned" in typed_fg.stderr and not fg_out.exists(),
    typed_fg.stderr.strip(),
)

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
# A planting, 2026-10-24: a package's manifest seals every file in it, so bytecode written beside a bundled
# script at its first run fails the package's own check. text-card.py loads fill-greeting.py by path, and
# fill-greeting.py loads the mark's fp-kanji.py: neither may leave a __pycache__, however it is run.
print("\nNo bytecode beside a bundled script")
(STAGE / "bonsai-garden-mark").mkdir(parents=True, exist_ok=True)
shutil.copy2(HERE.parents[1] / "bonsai-garden-mark" / "fp-kanji.py", STAGE / "bonsai-garden-mark" / "fp-kanji.py")
for old in list(tmp.rglob("__pycache__")):
    shutil.rmtree(old)
bc = card(bytecode=True)
caches = sorted(str(p.relative_to(tmp)) for p in tmp.rglob("__pycache__"))
check("a card drawn with bytecode on (no -B, no PYTHONDONTWRITEBYTECODE) is drawn (exit 0)", bc.returncode == 0, bc.stderr.strip())
check("...and leaves no __pycache__ beside the scripts it loaded", not caches, str(caches))

# Bytecode is code (Mori-shin's read, 2026-10-25): a .pyc under a sealed source's mtime and size runs in the source's
# place, with bytecode writing off too. The red case is her plant_pyc.py, inline: a cache planted beside each sibling,
# and the card must be the sealed sources' work.
print("\nA cache planted beside a sibling is never read")


def plant_pyc(src):
    from importlib._bootstrap_external import _code_to_timestamp_pyc

    st = src.stat()
    code = compile(f'raise SystemExit("PLANTED bytecode ran in place of {src.name}")\n', str(src), "exec")
    out = src.parent / "__pycache__" / f"{src.stem}.{sys.implementation.cache_tag}.pyc"
    out.parent.mkdir(exist_ok=True)
    out.write_bytes(_code_to_timestamp_pyc(code, int(st.st_mtime), st.st_size))
    return out


# fill-greeting.py loads fp-kanji.py only when it spells the kanji, deep in a full fill; the probe loads the staged
# filler as text-card does and spells through the filler's own fp_kanji(), which is that load and nothing else.
SPELL = tmp / "spell-probe.py"
SPELL.write_text(
    "import importlib.util, sys\n"
    "spec = importlib.util.spec_from_file_location('fill_greeting', sys.argv[1])\n"
    "m = importlib.util.module_from_spec(spec)\n"
    "spec.loader.exec_module(m)\n"
    "print(m.fp_kanji(sys.argv[2], 2))\n"
)
HOWS = (("bytecode on", {}), ("PYTHONDONTWRITEBYTECODE=1", {"PYTHONDONTWRITEBYTECODE": "1"}))
for name in ("kanji-1024-v1.2.json",):  # what fp-kanji.py reads beside itself
    shutil.copy2(HERE.parents[1] / "bonsai-garden-mark" / name, STAGE / "bonsai-garden-mark" / name)
sealed_spelling =run(SPELL, str(FG_STAGE), FPS["orma"], bytecode=True)
check("the probe spells with nothing planted (exit 0)", sealed_spelling.returncode == 0 and sealed_spelling.stdout.strip(),
      (sealed_spelling.stdout + sealed_spelling.stderr).strip()[-300:])
planted = plant_pyc(STAGE / "bonsai-garden-mark" / "fp-kanji.py")
for how, extra in HOWS:
    ps = run(SPELL, str(FG_STAGE), FPS["orma"], bytecode=True, env=extra)
    said = ps.stdout + ps.stderr
    check(
        f"fill-greeting.py ({how}) beside a cache planted for fp-kanji.py spells with the sealed source "
        f"({sealed_spelling.stdout.strip()}, as with none planted)",
        sealed_spelling.returncode == 0 and ps.returncode == 0 and ps.stdout == sealed_spelling.stdout
        and "PLANTED" not in said,
        said.strip()[-300:],
    )
shutil.rmtree(planted.parent)
planted = plant_pyc(FG_STAGE)
for how, extra in HOWS:
    pc = card(bytecode=True, env=extra)
    said = pc.stdout + pc.stderr
    check(
        f"a card drawn ({how}) beside a cache planted for fill-greeting.py is the sealed source's work (exit 0)",
        pc.returncode == 0 and "PLANTED" not in said,
        said.strip()[-300:],
    )
shutil.rmtree(planted.parent)

for script in (CARD, GATE, Path(__file__)):
    try:
        py_compile.compile(str(script), cfile=str(tmp / (script.name + "c")), doraise=True)
        check(f"{script.name} compiles", True)
    except py_compile.PyCompileError as e:
        check(f"{script.name} compiles", False, str(e))

shutil.rmtree(tmp, ignore_errors=True)
print("PASS" if ok_all else "FAIL")
sys.exit(0 if ok_all else 1)
