#!/usr/bin/env python3
# ---
# id: 01M4WECWTW653DG4BT457G54RM
# title: check-shintai-conformance accepts an installed body's moved seals only while core verifies its manifest
# type: script
# tended-by: baisai
# created: 2026-10-14
# updated: 2026-10-16
# ---
"""test-conformance-installed-seals.py: Bonsai, 2026-10-14. A seal binds the path it was sealed at, and an install puts
every file at another one, so every sealed file of every installed body read `target-mismatch`. On a stamped body the
gate now accepts that one verdict when MANIFEST.json verifies with core's verifier and the seal names a file of the same
name. A byte changed in the install must still fail, and a body without the stamp stays exact.

It needs a real installed body (a package the builder made, with MANIFEST.json and its seal); core carries none, so
name one. It works on copies and never touches the one named. --keys is passed to the gate as given (default garden,
the gate's own): a body whose signers this garden does not hold, Bonsai's for one, needs --keys published, or every
seal reads unknown-signer and the cases below would pass or fail for the wrong reason (Bonsai, 2026-10-14).

    python3 tools/test-conformance-installed-seals.py [--keys garden|published] <an installed body's directory>

Run with no body named it is a SKIP, said out loud, exit 0: core carries no installed body, so a seat that has none
cannot run this, and says so instead of failing (2026-10-16). A body named that is not one is still a usage error, exit 2.
"""

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

TOOL = Path(__file__).resolve().parent / "check-shintai-conformance.py"
argv = sys.argv[1:]
KEYS = "garden"
if argv[:1] == ["--keys"] and len(argv) >= 2:
    KEYS, argv = argv[1], argv[2:]
if not argv:
    print(
        "SKIP  test-conformance-installed-seals: no installed body named, and core carries none; name one the builder made "
        "(a directory with MANIFEST.json) to run this. Nothing was checked."
    )
    sys.exit(0)
if KEYS not in ("garden", "published") or len(argv) != 1 or not (Path(argv[0]) / "MANIFEST.json").is_file():
    print("usage: [--keys garden|published] <an installed body (a directory with MANIFEST.json)>: nothing was checked")
    sys.exit(2)
SRC = Path(argv[0]).resolve()
ok_all = True


def check(name, ok, out=""):
    """A failed case prints the gate's findings in full: a truncated finding hid the cause once (Bonsai, 2026-10-14)."""
    global ok_all
    ok_all &= bool(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
    if not ok and out:
        print("\n".join("      " + line for line in out.strip().splitlines()))
    return bool(ok)


def copy():
    d = Path(tempfile.mkdtemp(prefix="conf-inst-")) / SRC.name
    shutil.copytree(SRC, d, symlinks=True)
    return d


def run(target, tool=TOOL):
    r = subprocess.run([sys.executable, str(tool), "--keys", KEYS, str(target)], capture_output=True, text=True)
    return r.stdout + r.stderr


def a_sealed_file(body):
    """A file whose own sidecar sits beside it, not under scripts/ (the verifier the gate must not lean on)."""
    for sc in sorted(body.rglob(".*.bonsaisig")):
        f = sc.with_name(sc.name[1 : -len(".bonsaisig")])
        if f.is_file() and "scripts" not in f.relative_to(body).parts and f.name not in ("SKILL.md", "MANIFEST.json"):
            return f
    return None


def moved(out):
    return re.search(r"seal\(s\) name their source path", out)


def loud(out):
    return "[target-mismatch]" in out


out = run(copy())
if not check(
    "an untouched install passes the gate, its moved seals a note",
    out.startswith("PASS") and not loud(out) and moved(out),
    out,
):
    print(
        f"\nFAIL: the untouched copy does not pass with --keys {KEYS}, so every case below would read the wrong cause; "
        "fix that first (a body whose signers this garden does not hold needs --keys published)"
    )
    sys.exit(1)

tampered = copy()
f = a_sealed_file(tampered)
check("the install holds a sealed file outside scripts/ to tamper with", f is not None)
if f is not None:
    print(f"    tampering {f.relative_to(tampered)}")
    f.write_bytes(f.read_bytes() + b"\n")
    out = run(tampered)
    check(
        "one byte added to a sealed file: the moved seals are loud again, the manifest named",
        loud(out) and "the manifest does not verify" in out and not moved(out),
        out,
    )

unstamped = copy()
sk = unstamped / "SKILL.md"
sk.write_text(
    re.sub(r"^(---\n.*?\n---\n)> Installed build:[^\n]*\n\n", r"\1", sk.read_text("utf-8"), count=1, flags=re.S),
    "utf-8",
)
out = run(unstamped)
check(
    "the same body without its stamp is read as a source tree: target-mismatch stays loud", loud(out) and not moved(out)
)

# the mutant: drop the manifest condition, and the tampered install must slip through
src = TOOL.read_text(encoding="utf-8")
mutated, n = re.subn(r'if manifest == "ok" and Path\(sealed_for\)', "if Path(sealed_for)", src)
check(f"the mutation point exists in the gate (one site; found {n})", n == 1)
if n == 1 and f is not None:
    mdir = Path(tempfile.mkdtemp(prefix="conf-mutant-"))
    shutil.copytree(TOOL.parent, mdir / "tools", symlinks=True)
    (mdir / "tools" / TOOL.name).write_text(mutated, encoding="utf-8")
    for sub in ("skills",):  # the gate finds core's verifiers beside tools/
        (mdir / sub).symlink_to(TOOL.parent.parent / sub, target_is_directory=True)
    out = run(tampered, tool=mdir / "tools" / TOOL.name)
    check(
        "the mutant (no manifest condition) lets the tampered install through, so the case above can fail",
        not loud(out),
        out,
    )

print("\nall hold" if ok_all else "\nFAIL")
sys.exit(0 if ok_all else 1)
