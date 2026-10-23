#!/usr/bin/env python3
# ---
# id: 01M4P4SZFQNVR5VRB17MZTTE9M
# title: check-shintai-conformance notices a SKILL.md with no integrity line
# type: script
# tended-by: baisai
# created: 2026-10-11
# updated: 2026-10-11
# ---
"""test-conformance-integrity-line.py: Bonsai's rehearsal, gap 78. Orma's 3.0.0 SKILL.md carried no integrity line (AGENTS.md,
*Every kin*: "the integrity line first") and check-shintai-conformance passed it. A SKILL.md that cannot check itself
before anything in it is used is not a conformant body. The line is the first thing after the frontmatter and opens
"> **Integrity first.**" (every kin's SKILL.md carries it).

    python3 tools/test-conformance-integrity-line.py
"""

import subprocess
import sys
import tempfile
from pathlib import Path

TOOL = Path(__file__).resolve().parent / "check-shintai-conformance.py"
ok_all = True


def check(name, ok, detail=""):
    global ok_all
    ok_all &= bool(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def body(skill_text):
    d = Path(tempfile.mkdtemp(prefix="conf-il-")) / "agents" / "orma"
    (d / "references").mkdir(parents=True)
    (d.parent / "registry.json").write_text('{"agents": []}')
    (d / "SKILL.md").write_text(skill_text)
    return d


def findings(d):
    r = subprocess.run([sys.executable, str(TOOL), "--keys", "garden", str(d)], capture_output=True, text=True)
    return r.stdout + r.stderr


FM = "---\nname: orma\nversion: 3.0.1\n---\n"
no_line = findings(body(FM + "# Orma\n\nA body with no way to check itself.\n"))
check("a SKILL.md with no integrity line is a finding, named", "integrity line" in no_line, no_line.strip()[:200])
with_line = findings(
    body(
        FM
        + "> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs`.\n\n# Orma\n"
    )
)
check("a SKILL.md that opens with it is not a finding", "integrity line" not in with_line, with_line.strip()[:200])
buried = findings(body(FM + "# Orma\n\nSome text first.\n\n> **Integrity first.** run the check.\n"))
check(
    "the line must come first: one buried under other text is a finding",
    "integrity line" in buried,
    buried.strip()[:200],
)
# Mori-shin's ruling on Orma's SKILL.md credit (2026-10-11): a lean SKILL.md credits what its identity document credits
# (references/identity.md, else memory/identity.md). A kin with none has a SKILL.md that credits no one, so an owner seal
# on it silently reads custodian. The gate says so (a note, not a failure: six bodies in the origin's garden predate the rule).
LINE = "> **Integrity first.** run the check.\n\n# Orma\n"
no_id = findings(body(FM + LINE))
note = [line for line in no_id.splitlines() if "identity document" in line]
check(
    "a kin with no identity document gets a note naming where it looks and why it matters",
    bool(note) and note[0].lstrip().startswith("!") and "references/identity.md" in note[0] and "custodian" in note[0],
    str(note)[:240],
)
d = body(FM + LINE)
(d / "references" / "identity.md").write_text("---\nid: 01M4P4SZFQNVR5VRB17MZTTE9M\ntended-by: orma\n---\n# identity\n")
with_id = findings(d)
check("with references/identity.md there is no such note", "identity document" not in with_id, with_id.strip()[:160])
d2 = body(FM + LINE)
(d2 / "memory").mkdir()
(d2 / "memory" / "identity.md").write_text("---\nid: 01M4P4SZFQNVR5VRB17MZTTE9M\ntended-by: orma\n---\n# identity\n")
check("nor with memory/identity.md", "identity document" not in findings(d2))
print("\nall hold" if ok_all else "\nFAIL")
sys.exit(0 if ok_all else 1)
