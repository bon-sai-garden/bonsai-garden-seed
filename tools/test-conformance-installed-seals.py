#!/usr/bin/env python3
# ---
# id: 01M4WECWTW653DG4BT457G54RM
# title: check-shintai-conformance holds an installed body's set to its manifest, and its moved seals hold where they are
# type: script
# tended-by: baisai
# created: 2026-10-14
# updated: 2026-10-21
# ---
"""test-conformance-installed-seals.py. An install puts every file at another path than the one it was sealed at. Until
2026-10-21 every such seal read `target-mismatch`, and the gate accepted that one verdict on a stamped body when
MANIFEST.json verified (Bonsai, 2026-10-14). Since F-12 (the gardener, 2026-10-20: "if the bytes don't change a file
should pass integrity check regardless of which repo contains it"; Mori-shin's design B) a seal's address is provenance,
never a verdict: every moved seal reads ok, and the acceptance is gone. What an install must still answer for is its SET,
which bytes sit at which path with nothing missing and nothing extra. That is MANIFEST.json's, verified by core, and the
gate reports a manifest that does not verify on any stamped body. A byte changed is loud twice (its own seal and the
manifest); a sealed file removed with its sidecar is loud once, by the manifest alone, and that is the case the mutant
watches. A body without the stamp is a source tree: no manifest is asked.

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


def noted(out):
    """The old acceptance's note: gone with the acceptance."""
    return re.search(r"seal\(s\) name their source path", out)


def loud(out):
    return "[target-mismatch]" in out


def manifest_named(out):
    return "the manifest does not verify" in out


out = run(copy())
if not check(
    "an untouched install passes the gate: every moved seal holds where it is, no acceptance and no note",
    out.startswith("PASS") and not loud(out) and not noted(out),
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
        "one byte added to a sealed file: its own seal reads hash-mismatch, and the manifest is named",
        "[hash-mismatch]" in out and manifest_named(out) and not loud(out),
        out,
    )

removed = copy()
g = a_sealed_file(removed)
if g is not None:
    sc = g.with_name("." + g.name + ".bonsaisig")
    print(f"    removing {g.relative_to(removed)} and its seal")
    g.unlink()
    if sc.is_file():
        sc.unlink()
    out = run(removed)
    check(
        "a sealed file removed with its seal: every seal left holds, and only the manifest sees it, by name",
        out.startswith("FAIL") and manifest_named(out) and not loud(out) and "[hash-mismatch]" not in out,
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
    "the same body without its stamp is read as a source tree: no manifest asked, its moved seals hold where they are",
    not manifest_named(out) and not loud(out) and not noted(out),
    out,
)

# the mutant: drop the manifest finding, and the removed file must slip through
src = TOOL.read_text(encoding="utf-8")
anchor = "        problems.append(f\"manifest: the manifest does not verify: {manifest}\")"
mutated, n = src.replace(anchor, "        pass"), src.count(anchor)
check(f"the mutation point exists in the gate (one site; found {n})", n == 1)
if n == 1 and g is not None:
    mdir = Path(tempfile.mkdtemp(prefix="conf-mutant-"))
    shutil.copytree(TOOL.parent, mdir / "tools", symlinks=True)
    (mdir / "tools" / TOOL.name).write_text(mutated, encoding="utf-8")
    for sub in ("skills",):  # the gate finds core's verifiers beside tools/
        (mdir / sub).symlink_to(TOOL.parent.parent / sub, target_is_directory=True)
    out = run(removed, tool=mdir / "tools" / TOOL.name)
    check(
        "the mutant (no manifest finding) lets the removed file through, so the case above can fail",
        out.startswith("PASS") and not manifest_named(out),
        out,
    )

print("\nall hold" if ok_all else "\nFAIL")
sys.exit(0 if ok_all else 1)
