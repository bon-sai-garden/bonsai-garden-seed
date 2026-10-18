#!/usr/bin/env python3
# ---
# id: 01M4P89DYNB7K36M07P4H8K722
# title: audit-filenames: the memory index and a translation's locale suffix are not violations
# type: script
# tended-by: baisai
# created: 2026-10-11
# updated: 2026-10-11
# ---
"""test-audit-filenames.py: Bonsai's pot session (a pot body's self-check, 2026-10-11). The audit flagged memory/MEMORY.md (uppercase)
and references/heritage_de.html (underscore). Her routines and SKILL.md prescribe those names and the garden MCP reads MEMORY.md: a
convention conflict, not a slip. One rule each: MEMORY.md is exempt as the memory index, in a directory named memory;
a two-letter locale suffix (_de, _fr) before the extension marks a translation and is not an underscore violation. Everything else
the audit flagged is still flagged.

    python3 skills/bonsai-garden-validate/test-audit-filenames.py
"""

import subprocess
import sys
import tempfile
from pathlib import Path

TOOL = Path(__file__).resolve().parent / "scripts" / "audit-filenames.py"
ok_all = True


def check(name, ok, detail=""):
    global ok_all
    ok_all &= bool(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


root = Path(tempfile.mkdtemp(prefix="audit-fn-"))
for rel in [
    "agents/x/memory/MEMORY.md",
    "agents/x/references/heritage_de.html",
    "agents/x/references/heritage-fr.html",
    "docs/MEMORY.md",
    "agents/x/references/heritage_deu.html",
    "agents/x/references/my_file.md",
    "agents/x/references/Big.md",
    "agents/x/references/good-name.md",
    "agents/x/references/some_thing_de.html",
]:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("x\n")
r = subprocess.run([sys.executable, str(TOOL), "--root", str(root)], capture_output=True, text=True)
flagged = [line.split()[0] for line in r.stdout.splitlines() if line.startswith("  ") and "[" in line]
check("MEMORY.md in a memory/ directory is exempt", "agents/x/memory/MEMORY.md" not in flagged, str(flagged))
check("a MEMORY.md anywhere else is still flagged", "docs/MEMORY.md" in flagged, str(flagged))
check(
    "heritage_de.html (a two-letter locale suffix) is not a violation",
    "agents/x/references/heritage_de.html" not in flagged,
    str(flagged),
)
check(
    "a three-letter suffix, an inner underscore and an uppercase name are still flagged",
    all(
        x in flagged
        for x in [
            "agents/x/references/heritage_deu.html",
            "agents/x/references/my_file.md",
            "agents/x/references/Big.md",
        ]
    ),
    str(flagged),
)
check(
    "an underscore elsewhere in a name with a locale suffix is still flagged",
    "agents/x/references/some_thing_de.html" in flagged,
    str(flagged),
)
check(
    "a kebab name is not flagged",
    "agents/x/references/good-name.md" not in flagged and "agents/x/references/heritage-fr.html" not in flagged,
    str(flagged),
)
print("\nall hold" if ok_all else "\nFAIL")
sys.exit(0 if ok_all else 1)
