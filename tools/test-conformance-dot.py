#!/usr/bin/env python3
# ---
# id: 01M4NSMANW7JB806YJGK8MMYHV
# title: check-shintai-conformance given a bare dot names the kin, not nothing
# type: script
# tended-by: baisai
# created: 2026-10-11
# updated: 2026-10-11
# ---
"""test-conformance-dot.py: Bonsai's rehearsal, item 6. `check-shintai-conformance.py .` (run from inside a body) took
Path('.').name, which is the empty string, as the kin's slug, so the greeting step looked up "" in the registry:
"is in no registry (registry does not name )". The slug is the body's directory name, wherever the tool is run from
and however the path is spelled.

    python3 tools/test-conformance-dot.py
"""

import json
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


pot = Path(tempfile.mkdtemp(prefix="conf-dot-")) / "pot"
body = pot / "agents" / "orma"
(body / "references").mkdir(parents=True)
(pot / "agents/registry.json").write_text(
    json.dumps(
        {
            "agents": [
                {"slug": "orma", "type": "shin", "fingerprint": "0" * 31 + "1", "path": "agents/orma", "name": "orma"}
            ]
        }
    )
)
(body / "SKILL.md").write_text("---\nname: orma\nversion: 3.1.0\n---\n# orma\n")


def run(target, cwd):
    r = subprocess.run(
        [sys.executable, str(TOOL), "--keys", "garden", target], capture_output=True, text=True, cwd=str(cwd)
    )
    return r.stdout + r.stderr


dot = run(".", body)
absolute = run(str(body), body.parent)
check(
    "from inside the body, a bare '.' names the kin 'orma' in the greeting step, never an empty slug",
    "registry does not name )" not in dot
    and "is in no registry" not in dot.split("greeting")[-1][:60]
    and "orma" in dot,
    dot.strip()[:240],
)
check(
    "the same kin spelled as an absolute path reads the same greeting finding",
    [line for line in dot.splitlines() if "greeting" in line][:1]
    and [line.split("greeting")[1][:40] for line in dot.splitlines() if "greeting" in line][:1]
    == [line.split("greeting")[1][:40] for line in absolute.splitlines() if "greeting" in line][:1],
    f"dot: {dot.strip()[:120]!r} | abs: {absolute.strip()[:120]!r}",
)
print("\nall hold" if ok_all else "\nFAIL")
sys.exit(0 if ok_all else 1)
