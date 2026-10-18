#!/usr/bin/env python3
# ---
# id: 01M4P8AE5RT35T6NXS67BRTPQ4
# title: validate-metadata runs without a core checkout: the schema it validates against ships with it
# type: script
# tended-by: baisai
# created: 2026-10-11
# updated: 2026-10-11
# ---
"""test-schema-bundled.py: Bonsai's pot session (a pot body's self-check, 2026-10-11): the installed bonsai-garden-validate failed with
"core's metadata schema not found above this script", because the plugin does not carry rituals/specs/metadata-schema.md, so a
stranger's garden hits the same wall. The schema is core's (Hissai tends it); the skill ships a GENERATED copy of it at
references/metadata-schema.txt (tools/sync-validate-schema.py writes it and gates on drift: one master, no hand copy), and the
validator falls back to that copy when no core checkout is above it.

    python3 skills/bonsai-garden-validate/test-schema-bundled.py
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SKILL = Path(__file__).resolve().parent
CORE = SKILL.parent.parent
ok_all = True


def check(name, ok, detail=""):
    global ok_all
    ok_all &= bool(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


# the skill as an INSTALLED package has it: its own folder, no core above it
inst = Path(tempfile.mkdtemp(prefix="validate-installed-")) / "bonsai-garden-validate"
shutil.copytree(SKILL, inst, ignore=shutil.ignore_patterns("test-*.py", "__pycache__"))
garden = Path(tempfile.mkdtemp(prefix="validate-garden-"))
(garden / "a.md").write_text(
    "---\nid: 01M4NSMANW7JB806YJGK8MMYHV\ntitle: x\ntype: reference\ntended-by: baisai\ncreated: 2026-10-11\nupdated: 2026-10-11\n---\n# x\n"
)
r = subprocess.run(
    [sys.executable, str(inst / "scripts" / "validate-metadata.py"), "--root", str(garden)],
    capture_output=True,
    text=True,
)
out = r.stdout + r.stderr
check(
    "an installed validator with no core above it finds a schema and runs",
    "metadata schema not found" not in out and r.returncode in (0, 1),
    out.strip()[:200],
)

bundled = SKILL / "references" / "metadata-schema.txt"
master = CORE / "rituals" / "specs" / "metadata-schema.md"
check(
    "the bundled schema is byte-identical to core's master (one master, generated)",
    bundled.is_file() and master.is_file() and bundled.read_bytes() == master.read_bytes(),
    "bundled missing" if not bundled.is_file() else "bytes differ",
)
sync = CORE / "tools" / "sync-validate-schema.py"
if sync.is_file():
    c = subprocess.run([sys.executable, str(sync), "--check"], capture_output=True, text=True)
    check("the drift gate passes on the committed copy", c.returncode == 0, (c.stdout + c.stderr).strip()[:160])
    tmp = Path(tempfile.mkdtemp(prefix="sync-"))
    fake = tmp / "metadata-schema.md"
    fake.write_bytes(master.read_bytes() + b"\nhand edit\n")
    c2 = subprocess.run([sys.executable, str(sync), "--check", "--bundled", str(fake)], capture_output=True, text=True)
    check(
        "and fails on a hand-edited copy, naming it",
        c2.returncode == 1 and "drift" in (c2.stdout + c2.stderr).lower(),
        (c2.stdout + c2.stderr).strip()[:160],
    )
else:
    check("the drift gate exists (tools/sync-validate-schema.py)", False, "missing")
print("\nall hold" if ok_all else "\nFAIL")
sys.exit(0 if ok_all else 1)
