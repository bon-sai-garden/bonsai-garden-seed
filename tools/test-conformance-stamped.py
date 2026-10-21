#!/usr/bin/env python3
# ---
# id: 01M4WE7FJYBFS6MN19H1X3AGYA
# title: check-shintai-conformance reads an installed (stamped) body by MAJOR.MINOR.PATCH, a source tree exactly
# type: script
# tended-by: baisai
# created: 2026-10-14
# updated: 2026-10-21
# ---
"""test-conformance-stamped.py: Bonsai, 2026-10-13/14. package.py writes `version: M.m.p` into the packaged SKILL.md and
keeps the build and label in the stamp line, while references/about-me.md ships byte for byte ("3.1.2-rc"). The gate
reported every labelled installed body as version-drifted by the label alone, and as missing its integrity line
because the stamp comes first. On a stamped body the lock is the stamp's version, or its M.m.p where about-me
declares only three parts; a source tree stays exact, label included.

W, 2026-10-16 (her 3.0.0.7-rc install): three numbers in one body, two of them "version 3.0.0.3" in SKILL.md's own
prose. The lock now also reads the carrier's prose: a build of the body's own version named there must be the
body's version (version_lock_problems, the one function package.py runs on every stage).

The last cases run mutants of the gate with one comparison dropped each, and require them to miss a real finding:
a test that cannot fail is not a test.

    python3 tools/test-conformance-stamped.py
"""

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

TOOL = Path(__file__).resolve().parent / "check-shintai-conformance.py"
INTEGRITY = "> **Integrity first.** Run the check."
ok_all = True


def check(name, ok, detail=""):
    global ok_all
    ok_all &= bool(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def body(skill_ver, about_ver, stamped, integrity=True, prose=""):
    d = Path(tempfile.mkdtemp(prefix="conf-stamp-")) / "orma"
    (d / "references").mkdir(parents=True)
    head = f"---\nname: orma\nversion: {skill_ver}\n---\n"
    stamp = "> Installed build: 3.1.2.7-rc-20261014T0600Z · body 1234abcd\n\n" if stamped else ""
    (d / "SKILL.md").write_text(head + stamp + (INTEGRITY + "\n\n" if integrity else "") + "# orma\n\n" + prose + "\n")
    (d / "references" / "about-me.md").write_text(f"---\nid: x\nversion: {about_ver}\n---\n# orma\n")
    return d


def run(target, tool=TOOL):
    r = subprocess.run([sys.executable, str(tool), "--keys", "garden", str(target)], capture_output=True, text=True)
    return r.stdout + r.stderr


def drift(out):
    return "version drift:" in out


def noint(out):
    return "has no integrity line" in out


def lock(out):
    return "version lock:" in out


out = run(body("3.1.2", "3.1.2-rc", stamped=True))
check("stamped: 3.1.2 against 3.1.2-rc is no drift (the label alone)", not drift(out), out.strip()[:200])
check("stamped: the stamp line before the integrity line is not a missing integrity line", not noint(out))
out = run(body("3.1.2", "3.1.2.7-rc", stamped=True))
check("stamped: about-me naming the stamp's own build and label is no drift", not drift(out))
# W, 2026-10-16: the stamp is 3.1.2.7-rc. The builder stamps the source's own declared build, so an honest install's
# about-me never names another build; one that does was assembled from two bodies, and that is drift (this case read
# "a build segment alone is no drift" until 2026-10-16: it let W's "three numbers, one body" through).
out = run(body("3.1.2", "3.1.2.4-rc", stamped=True))
check("stamped: about-me naming ANOTHER build of the stamp's version is drift", drift(out))
out = run(body("3.1.2", "3.1.2-beta", stamped=True))
check("stamped: about-me naming another label than the stamp's is drift", drift(out))
out = run(body("3.1.2", "3.1.3-rc", stamped=True))
check("stamped: 3.1.2 against 3.1.3-rc is drift (M.m.p differs)", drift(out))
out = run(body("3.1.2", "3.1.2-rc", stamped=True, integrity=False))
check("stamped: a stamp with no integrity line after it is still a missing integrity line", noint(out))
out = run(body("3.1.2-rc", "3.1.2", stamped=False))
check("source tree: 3.1.2-rc against 3.1.2 is drift (exact, label included)", drift(out))
out = run(body("3.1.2-rc", "3.1.2-rc", stamped=False))
check("source tree: the same full version is no drift", not drift(out))

# the lock broken from inside (W's 3.0.0.7-rc carried "version 3.0.0.3" twice, 2026-10-16): a build of the body's
# own version named in SKILL.md's prose must be the body's version, on a stamped body and on a source tree alike
out = run(
    body(
        "3.1.2",
        "3.1.2-rc",
        stamped=True,
        prose="**Constitution:** `references/about-me.md` — **version 3.1.2.3**, version-locked.",
    )
)
check("stamped: prose naming another build of the body's own version breaks the lock", lock(out), out.strip()[:200])
out = run(body("3.1.2.7-rc", "3.1.2.7-rc", stamped=False, prose="about-me.md re-sealed at 3.1.2.3-rc (2026-09-23)."))
check("source tree: prose naming another build of the body's own version breaks the lock", lock(out))
out = run(body("3.1.2", "3.1.2-rc", stamped=True, prose="**Constitution:** version 3.1.2.7-rc, version-locked."))
check("stamped: prose naming the stamp's own version is no finding", not lock(out))
out = run(body("3.1.2", "3.1.2-rc", stamped=True, prose="Its prior lineage ran 2.7.7.4 and 3.0.0.3 before the lock."))
check(
    "stamped: prose naming builds of OTHER versions is no finding (a history, not a claim about this body)",
    not lock(out),
)
out = run(body("3.1.2", "3.1.2-rc", stamped=True, prose="```\n> Installed build: 3.1.2.3-rc-20261001T0000Z\n```"))
check("stamped: a build number quoted inside a code fence is no finding", not lock(out))
check(
    "stamped: the stamp line's own version is never read as a stale token",
    not lock(run(body("3.1.2", "3.1.2-rc", stamped=True))),
)

# the mutants: each comparison dropped must let its real finding through (a test that cannot fail is not a test)
src = TOOL.read_text(encoding="utf-8")
for label, pattern, repl, case, finder in (
    (
        "no M.m.p comparison on a stamped body",
        r"sp\.group\(1\) != ap_\.group\(1\)",
        "False",
        body("3.1.2", "3.1.3-rc", stamped=True),
        drift,
    ),
    (
        "no prose-token rule",
        r"if tok\.startswith\(own\) and tok != full:",
        "if False:",
        body("3.1.2", "3.1.2-rc", stamped=True, prose="**version 3.1.2.3**"),
        lock,
    ),
):
    mutated, n = re.subn(pattern, repl, src)
    check(f"the mutation point exists in the gate (one site): {label}", n == 1, f"{n} sites")
    if n != 1:
        continue
    mdir = Path(tempfile.mkdtemp(prefix="conf-mutant-"))
    for f in TOOL.parent.iterdir():  # the gate may import siblings; copy the directory, mutate one file
        if f.is_file() and f.suffix == ".py":
            shutil.copy2(f, mdir / f.name)
    (mdir / TOOL.name).write_text(mutated, encoding="utf-8")
    out = run(case, tool=mdir / TOOL.name)
    check(f"the mutant ({label}) misses the real finding, so the case above can fail", not finder(out))

print("\nall hold" if ok_all else "\nFAIL")
sys.exit(0 if ok_all else 1)
