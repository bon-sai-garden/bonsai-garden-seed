#!/usr/bin/env python3
# ---
# id: 01M3ABZGRZYWAAR3694FJPH95X
# title: credit parity — tools/credit.py and the sign skill's lib/credit.mjs answer alike
# type: script
# tended-by: baisai
# created: 2026-09-24
# updated: 2026-09-24
# ---
"""test-credit.py — credit.py's rule on named cases, and its Node twin on the same cases and on a
corpus (every tracked header-bearing file in the given repos). Exit 0 = all passed.

    python3 tools/test-credit.py [--corpus REPO ...]
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument("--corpus", nargs="*", default=[])
A = ap.parse_args()
spec = importlib.util.spec_from_file_location("credit", HERE / "credit.py")
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)
NODE = HERE.parent / "skills" / "bonsai-garden-sign" / "lib" / "credit.mjs"
results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}{(' — ' + detail) if detail else ''}")


CASES = {  # rel path -> (text, expected credit)
    "a.md": ("---\nid: x\ntended-by: aruji\n---\nbody tended-by: tasai\n", ["aruji"]),
    "b.md": ('---\ntended-by: "Hissai"\n---\n', ["hissai"]),
    "c.md": ("---\ntended-by: [baisai, tasai]\n---\n", ["baisai", "tasai"]),
    "d.md": ("---\ntended-by:\n  - fuji-shin\n  - mori-shin  # a note\ntags: [x]\n---\n", ["fuji-shin", "mori-shin"]),
    "e.py": ("#!/usr/bin/env python3\n# ---\n# id: x\n# tended-by: baisai\n# ---\nprint(1)\n", ["baisai"]),
    "f.mjs": ("// ---\n// tended-by: mori-shin\n// ---\n", ["mori-shin"]),
    "g.md": (
        "---\ntype: letter\nfrom: tasai\nto: hissai\ntended-by: baisai\n---\n",
        ["hissai"],
    ),  # the receiver: not the sender, not tended-by
    "home/x/inbox/h.md": (
        "---\nfrom: hissai\nto: [zensai, eisai]\ncc: jisai\n---\n",
        ["x"],
    ),  # in an inbox: the inbox names the receiver
    "home/eisai/inbox/h3.md": ("---\nfrom: hissai\ncc: [jisai, tasai]\n---\ncc: alone credits no one\n", ["eisai"]),
    "home/tasai/inbox/h2.md": (
        "---\nfrom: hissai\ntended-by: hissai\n---\nno to: at all, in tasai's inbox\n",
        ["tasai"],
    ),
    "home/eisai/inbox/cc.md": (
        "---\nfrom: tasai\nto: hissai\ncc: eisai\n---\na cc copy: its to: names someone else\n",
        ["eisai"],
    ),
    "home/tasai/outbox/ad.md": (
        "---\ntype: letter\nfrom: tasai\naddressed-to: zensai\n---\nthe older spelling\n",
        ["zensai"],
    ),
    "home/tasai/outbox/all.md": (
        "---\ntype: letter\nfrom: tasai\nto: [eisai, hissai, baisai]\n---\nan original to many\n",
        ["baisai", "eisai", "hissai"],
    ),
    "home/Hissai/inbox/case.md": ("---\nfrom: tasai\n---\na mixed-case inbox directory\n", ["hissai"]),
    "home/gardener/inbox/.gitkeep.md": ("", ["gardener"]),  # header-less, in an inbox
    "home/eisai/inbox/page.md": ("<html>no frontmatter</html>\n", ["eisai"]),
    "rituals/tasks/kanban-source/todo/BL-XX981.md": (
        "---\nid: BL-XX981\ntitle: t\nassignee: baisai\ntended-by: tasai\n---\n",
        ["baisai"],
    ),  # the assignee, not the keeper
    "rituals/tasks/kanban-source/done/BL-XX985.md": ('---\nid: "BL-XX985"\nassignee: null\n---\n', []),  # null: no one
    "rituals/tasks/kanban-source/notalane/BL-XX982.md": (
        "---\nid: BL-XX982\nassignee: baisai\ntended-by: tasai\n---\n",
        ["tasai"],
    ),  # not the schema: tended-by
    "doc/author.md": ("---\nauthor: chisai\n---\n", ["chisai"]),  # authorship, no tended-by
    "doc/authors.md": ("---\nauthors: [eisai, hissai]\n---\n", ["eisai", "hissai"]),  # a list
    "doc/written.md": ("---\nwritten-by: eisai\n---\n", ["eisai"]),
    "doc/handover.md": ("---\nfrom: eisai\ntype: handover\n---\n", ["eisai"]),  # a non-letter's from: is its writer
    "doc/agree.md": (
        "---\ntended-by: eisai\nauthors: [eisai, hissai]\n---\n",
        ["eisai", "hissai"],
    ),  # share a kin: both, no conflict
    "doc/disagree.md": (
        "---\ntended-by: koe-shin\nauthor: chisai\n---\n",
        ["chisai", "koe-shin"],
        True,
    ),  # share none: conflict
    "doc/tb-wins-from.md": ("---\ntended-by: tasai\nfrom: eisai\n---\n", ["tasai"]),  # from: is only the last resort
    "rituals/tasks/kanban-source/backlog/BL-XX983.md": (
        "---\nid: BL-XX983\nlead: baisai\ntended-by: tasai\n---\n",
        ["baisai"],
    ),  # no assignee: lead
    "home/tasai/outbox/brief.md": (
        "---\ntype: brief\nfrom: tasai\nto: hissai\ntended-by: tasai\n---\n",
        ["hissai"],
    ),  # an outbox brief is a letter: its receiver
    "home/tasai/outbox/note.md": (
        "---\ntype: inbox-note\nfrom: tasai\n---\n",
        [],
    ),  # no receiver: no one (held), never the sender
    "home/tasai/outbox/bare.txt": ("no header\n", []),
    "home/tasai/outbox/cc2.md": (
        "---\ntype: letter\nfrom: tasai\ncc: eisai\n---\noutside an inbox, cc: alone is no credit\n",
        [],
    ),
    "i.md": (
        "---\nfrom: hissai\nto: tasai\n---\nnot a letter: to: is no credit; its from: is its writer (Tasai)\n",
        ["hissai"],
    ),
    "j.txt": ("tended-by: tasai\n", []),
    "k.md": ("no frontmatter\n---\ntended-by: tasai\n---\n", []),
    "l.md": ("﻿---\r\ntended-by: zensai\r\n---\r\n", ["zensai"]),
    "m.md": ("---\ntended-by: workshop\n---\n", ["workshop"]),
    "n.md": ("---\ntended-by:\n---\n", []),
    "sk/references/identity.md": ("---\ntended-by: mori-shin\n---\n", ["mori-shin"]),
    "sk/SKILL.md": ("---\nname: x\ndescription: y\n---\n", ["mori-shin"]),  # through its identity
    "kin/memory/identity.md": ("---\ntended-by: bonsai\n---\n", ["bonsai"]),
    "kin/SKILL.md": ("---\nname: bonsai\ntended-by: tasai\n---\n", ["bonsai"]),  # identity wins over its own
    "lone/SKILL.md": ("---\nname: x\ntended-by: tasai\n---\n", []),  # no identity beside: no credit
}
T = Path(tempfile.mkdtemp(prefix="credit-"))
files = []
for rel, (text, _, *_c) in CASES.items():
    p = T / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(text.encode("utf-8"))
    files.append(p)


def node(paths):
    out = {}
    for i in range(0, len(paths), 400):
        r = subprocess.run(["node", str(NODE), *map(str, paths[i : i + 400])], capture_output=True, text=True)
        for line in r.stdout.splitlines():
            d = json.loads(line)
            out[d["file"]] = (d["credit"], d.get("conflict", False))
    return out


print("named cases (credit.py):")
for rel, (text, want, *_c) in CASES.items():
    want_c = CASES[rel][2] if len(CASES[rel]) > 2 else False
    gw, gc = C.credit_info(text, str(T / rel))
    check(
        f"{rel}: {want}" + (" (conflict)" if want_c else ""),
        sorted(gw) == want and gc == want_c,
        f"got {sorted(gw)} conflict={gc}",
    )
print("seal_role:")
check(
    "a letter naming no receiver: custodian for anyone",
    C.seal_role("---\ntype: letter\nfrom: bonsai\n---\nx\n", "out/a.md", "tasai") == "custodian",
)
check(
    "a header-less file in an inbox: custodian for a stranger, owner for the inbox's kin",
    C.seal_role("", "home/gardener/inbox/.gitkeep", "tasai") == "custodian"
    and C.seal_role("", "home/gardener/inbox/.gitkeep", "gardener") == "owner",
)
check(
    "a plain document with no credit: owner only if created here, else custodian",
    C.seal_role("no header\n", "notes.md", "tasai", created=True) == "owner"
    and C.seal_role("no header\n", "notes.md", "tasai") == "custodian",
)
print("seal_role — three outcomes, Python and Node alike (Tasai, 2026-09-25):")
ROLE_CASES = [  # (rel, text, signer, created, want)
    ("r/a.md", "---\ntended-by: tasai\n---\n", "tasai", False, "owner"),  # credited to the signer
    ("r/b.md", "---\ntended-by: hissai\n---\n", "tasai", True, "custodian"),  # credited elsewhere, even if created
    ("r/c.txt", "loose\n", "tasai", True, "owner"),  # uncredited, created here
    ("r/d.txt", "loose\n", "tasai", False, "custodian"),  # uncredited, an edit: never a claim
    (
        "r/e.md",
        "---\ntype: letter\nfrom: tasai\n---\n",
        "tasai",
        True,
        "custodian",
    ),  # a letter naming no receiver: held
    ("home/hissai/inbox/f.md", "---\nfrom: tasai\n---\n", "hissai", False, "owner"),  # the receiver
    (
        "rituals/tasks/kanban-source/todo/BL-XX981.md",
        "---\nid: BL-XX981\nassignee: baisai\n---\n",
        "tasai",
        False,
        "custodian",
    ),  # the keeper
    (
        "home/tasai/outbox/brief2.md",
        "---\ntype: brief\nfrom: tasai\nto: [eisai, hissai]\n---\n",
        "tasai",
        True,
        "custodian",
    ),  # the sender, even creating it
    (
        "home/tasai/outbox/note2.md",
        "---\ntype: inbox-note\nfrom: tasai\n---\n",
        "tasai",
        True,
        "custodian",
    ),  # no receiver: held
    (
        "rituals/tasks/kanban-source/todo/BL-XX984.md",
        "---\nid: BL-XX984\nassignee: baisai\n---\n",
        "baisai",
        False,
        "owner",
    ),  # the assignee
    (
        "doc/d1.md",
        "---\ntended-by: koe-shin\nauthor: chisai\n---\n",
        "koe-shin",
        False,
        "custodian",
    ),  # disagreement: held, even by a named kin
    ("doc/d2.md", "---\ntended-by: koe-shin\nauthor: chisai\n---\n", "chisai", True, "custodian"),
    ("doc/a1.md", "---\nauthors: [eisai, hissai]\n---\n", "hissai", False, "owner"),  # the signer in authors:
    ("doc/a2.md", "---\nauthors: [eisai, hissai]\n---\n", "tasai", False, "custodian"),
]
RT = Path(tempfile.mkdtemp(prefix="role-"))
for rel, text, signer, created, want in ROLE_CASES:
    fp = RT / rel
    fp.parent.mkdir(parents=True, exist_ok=True)
    fp.write_text(text)
    py = C.seal_role(text, str(fp), signer, created=created)
    js = subprocess.run(
        [
            "node",
            "--input-type=module",
            "-e",
            f"import {{ sealRole }} from {json.dumps(str(NODE))}; import fs from 'node:fs';"
            f"console.log(sealRole(fs.readFileSync({json.dumps(str(fp))}, 'utf8'), {json.dumps(str(fp))}, {json.dumps(signer)}, {str(created).lower()}))",
        ],
        capture_output=True,
        text=True,
    ).stdout.strip()
    check(f"{rel} {signer} created={created}: {want}", py == want and js == want, f"py {py} node {js}")
print("named cases (credit.mjs agrees):")
N = node(files)
for p in files:
    rel = str(p.relative_to(T))
    want = (CASES[rel][1], CASES[rel][2] if len(CASES[rel]) > 2 else False)
    check(f"{rel} node", N.get(str(p)) == want, f"got {N.get(str(p))}")

for repo in A.corpus:
    rp = Path(repo).resolve()
    rels = (
        subprocess.run(["git", "-C", str(rp), "ls-files", "-z"], capture_output=True)
        .stdout.decode("utf-8", "replace")
        .split("\0")
    )
    paths = [rp / r for r in rels if r and r.lower().endswith(C.MD_EXT + C.SCRIPT_EXT) and (rp / r).is_file()]
    N = node(paths)
    diff = []
    for p in paths:
        try:
            text = p.read_bytes().decode("utf-8")
        except (OSError, UnicodeDecodeError):
            text = ""
        pw, pc = C.credit_info(text, str(p))
        py = (sorted(pw), pc)
        if N.get(str(p)) != py:
            diff.append(f"{p.relative_to(rp)}: py {py} node {N.get(str(p))}")
    check(f"corpus {rp.name}: {len(paths)} files, Python and Node agree", not diff, "; ".join(diff[:5]))

print(f"\n{sum(results)}/{len(results)} pass")
sys.exit(0 if all(results) else 1)
