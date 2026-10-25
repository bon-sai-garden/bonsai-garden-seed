#!/usr/bin/env python3
# ---
# id: 01M5PD1M4XND029WXN3JFRP995
# title: check-shintai-conformance notices a SKILL.md that carries a frontmatter id
# type: script
# tended-by: baisai
# created: 2026-10-24
# updated: 2026-10-24
# ---
"""test-conformance-skill-id.py: a SKILL.md carries no frontmatter id; the id is the seal's (AGENTS.md, *Every kin*,
"A SKILL.md's shape"; the gardener's yes, 2026-10-24). Every other rule in core already said so, and this gate passed
19 kin bodies whose SKILL.md carried one, each different from the seal's id. Now the gate fails them, by name.

    python3 tools/test-conformance-skill-id.py
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


def body(fm_extra="", body_extra=""):
    d = Path(tempfile.mkdtemp(prefix="conf-id-")) / "agents" / "orma"
    (d / "references").mkdir(parents=True)
    (d.parent / "registry.json").write_text('{"agents": []}')
    (d / "SKILL.md").write_text(
        "---\nname: orma\ndescription: a test body\nversion: 3.0.1\n"
        + fm_extra
        + "---\n> **Integrity first.** run the check.\n\n# Orma\n"
        + body_extra
    )
    return d


def findings(d):
    """The gate's own answer: (the problem lines naming a frontmatter id, its note lines naming one)."""
    r = subprocess.run([sys.executable, str(TOOL), "--keys", "garden", str(d)], capture_output=True, text=True)
    out = (r.stdout + r.stderr).splitlines()
    return [x for x in out if x.startswith("  - ") and "frontmatter id" in x], [
        x for x in out if x.startswith("  ! ") and "frontmatter id" in x
    ]


ID = "01M2D3H8T9FF8A4JBXRAESF2BE"
probs, notes = findings(body(f"id: {ID}\n"))
check("a planted frontmatter id fails the body, never a note", bool(probs) and not notes, str(probs or notes)[:200])
check("it names the id it found and where the id belongs", bool(probs) and ID in probs[0] and "seal" in probs[0])
probs, notes = findings(body(f"metadata:\n  id: {ID}\n"))
check("an id parked one level down (metadata.id) fails too", bool(probs), str(probs)[:160])
probs, notes = findings(body(f"id: '{ID}'\n"))
check("a quoted id is one too, named without its quotes", bool(probs) and f"({ID})" in probs[0], str(probs)[:160])
probs, notes = findings(body())
check("a SKILL.md without one draws no such line", not probs and not notes)
probs, notes = findings(body(body_extra=f"\n```yaml\nid: {ID}\n```\n"))
check("an id: in the body, not the frontmatter, is not this finding", not probs and not notes)
probs, notes = findings(body(fm_extra="ids-note: none\n"))
check("a key that only begins with id is not one", not probs and not notes)

print("\nall hold" if ok_all else "\nFAIL")
sys.exit(0 if ok_all else 1)
