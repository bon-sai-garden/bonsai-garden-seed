#!/usr/bin/env python3
# ---
# id: 01M5Q9BVMN9ETJJS0G9Z7A86FH
# title: check-shintai-conformance names every shintai file that lacks the owner seal of the body's kin (1g)
# type: script
# tended-by: baisai
# created: 2026-10-24
# updated: 2026-10-24
# ---
"""test-conformance-owner-seals.py: every file within a shintai carries the owner seal of the body's kin (the gardener,
2026-10-24: "every file within a shintai should have the owner seal, not a custodian seal. If we need a kin to seal
their own shintai files we need to invoke them and ask them to sign it."). On disk the gate warns by default, so a kin
can still wake and seal; --owner-seals refuse fails the body; the gardener's own files are named as his, never refused. The
seals here are planted JSON: 1g reads who sealed and in what role, and 1d (whether the signature holds) is not this test.

    python3 tools/test-conformance-owner-seals.py
"""

from __future__ import annotations

import importlib.util
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
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail and not ok else ""))


def seal(f: Path, signer: str | None, role: str = "owner") -> None:
    if signer is not None:
        (f.parent / f".{f.name}.bonsaisig").write_text(
            json.dumps({"format": "bonsaisig/2", "signer": signer, "role": role, "target": f.name})
        )


def body() -> Path:
    d = Path(tempfile.mkdtemp(prefix="conf-owner-")) / "agents" / "orma"
    for sub in ("references", "identity", "memory", "assets", "pino-shin/identity"):
        (d / sub).mkdir(parents=True)
    (d.parent / "registry.json").write_text('{"agents": []}')
    files = {
        "SKILL.md": ("---\nname: orma\ndescription: a test body\nversion: 3.0.1\n---\n# Orma\n", "orma"),
        "references/about-me.md": ("---\nid: 01M5Q9BVMN9ETJJS0G9Z7A86FA\ntended-by: orma\n---\n# about\n", "orma"),
        "memory/identity.md": ("---\nid: 01M5Q9BVMN9ETJJS0G9Z7A86FB\ntended-by: orma\n---\n# identity\n", "orma"),
        "assets/ok.svg": ("<svg/>\n", "orma"),
        "pino-shin/agent.md": ("---\nid: 01M5Q9BVMN9ETJJS0G9Z7A86FC\ntended-by: pino-shin\n---\n# a nested body\n", "pino-shin"),
    }
    for rel, (text, signer) in files.items():
        (d / rel).write_text(text)
        seal(d / rel, signer)
    return d


def lines(d: Path, *extra: str) -> tuple[list[str], list[str]]:
    """The gate's own answer: (its problem lines on owner seals, its note lines on them or on his files)."""
    r = subprocess.run([sys.executable, str(TOOL), "--keys", "garden", *extra, str(d)], capture_output=True, text=True)
    out = (r.stdout + r.stderr).splitlines()
    return [x for x in out if x.startswith("  - owner seal:")], [
        x for x in out if x.startswith("  ! ") and ("owner seals" in x or x.startswith("  ! his:"))
    ]


d = body()
probs, notes = lines(d)
check("a body whose every file carries the owner seal of the body's kin draws no owner-seal line", not probs and not notes, str(probs + notes)[:300])

(d / "assets" / "held.svg").write_text("<svg/>\n")
seal(d / "assets" / "held.svg", "orma", "custodian")
(d / "assets" / "borrowed.svg").write_text("<svg/>\n")
seal(d / "assets" / "borrowed.svg", "pino", "owner")
(d / "assets" / "bare.svg").write_text("<svg/>\n")
(d / "pino-shin" / "identity" / "note.md").write_text("---\nid: 01M5Q9BVMN9ETJJS0G9Z7A86FD\ntended-by: pino-shin\n---\n")
seal(d / "pino-shin" / "identity" / "note.md", "orma", "owner")
probs, notes = lines(d)
note = " ".join(notes)
check("on disk by default the gate warns, never fails, so the kin can still wake and seal", not probs and "WARN owner seals: 4 file(s)" in note, note[:300])
check("a custodian seal by the kin's own key is named", "assets/held.svg [custodian: orma]" in note)
check("an owner seal by another kin is named", "assets/borrowed.svg [owner: pino]" in note)
check("a file with no seal is named", "assets/bare.svg [no seal]" in note)
check("a nested body's file is held to that body's kin, not the parent's", "pino-shin/identity/note.md [owner: orma]" in note)
check("a file sealed owner by the body's kin is not named", "assets/ok.svg" not in note and "pino-shin/agent.md" not in note)

probs, notes = lines(d, "--owner-seals", "refuse")
check(
    "--owner-seals refuse fails the body, one line per file",
    len(probs) == 4 and any("assets/held.svg [custodian: orma]" in p for p in probs),
    str(probs)[:300],
)

seal(d / "memory" / "identity.md", "orma", "custodian")
probs, notes = lines(d, "--owner-seals", "refuse")
check(
    "the gardener's own file is named as his, awaiting his own seal, and never refused",
    not any("memory/identity.md" in p for p in probs) and any(x.startswith("  ! his:") and "memory/identity.md" in x for x in notes),
    str(notes)[:300],
)

spec = importlib.util.spec_from_file_location("shintai_gate", TOOL)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
side = lambda p: next((s for s in (p.parent / f".{p.name}.bonsaisig",) if s.is_file()), None)  # noqa: E731
acts = {x["rel"]: x["action"] for x in gate.owner_seal_findings(d, side)}
(d / "references" / "other.md").write_text("---\nid: 01M5Q9BVMN9ETJJS0G9Z7A86FE\ntended-by: tasai\n---\n")
seal(d / "references" / "other.md", "tasai", "owner")
acts2 = {x["rel"]: x["action"] for x in gate.owner_seal_findings(d, side)}
check("the worklist's action: a file crediting no one is sealed with --role owner, said out loud", "--role owner" in acts.get("assets/bare.svg", ""), acts.get("assets/bare.svg"))
check("…a header crediting the kin needs only the re-seal", "re-seals the file as owner" in acts.get("pino-shin/identity/note.md", ""), acts.get("pino-shin/identity/note.md"))
check("…a header crediting another kin must change first", "header credits tasai" in acts2.get("references/other.md", ""), acts2.get("references/other.md"))

# A bunshin's attestation is sealed by the attesting parent, the one exception (the gardener, 2026-10-24: "this
# attestation should semantically be signed by the 'parent(s)' (=anchor). That's a legitimate exception to the rule.
# Pls add it"). The attestation passes only as identity/bunshin-attestation*.md in a bunshin's body, owner-sealed by a kin the registry
# names as that bunshin's parent, the header's tended-by that same parent; a file named for one parent, by that parent.
(d.parent / "registry.json").write_text(json.dumps({"agents": [
    {"slug": "orma"},
    {"slug": "pino-shin", "parent": "orma"},
    {"slug": "kai-shin", "parent": "orma (East) + tasai (West)"},
]}))
(d / "kai-shin" / "identity").mkdir(parents=True)
(d / "kai-shin" / "agent.md").write_text("---\nid: 01M5Q9BVMN9ETJJS0G9Z7A86FF\ntended-by: kai-shin\n---\n# a second nested body\n")
seal(d / "kai-shin" / "agent.md", "kai-shin")


def attest(rel: str, tended: str, signer: str, role: str = "owner") -> None:
    f = d / rel
    f.write_text(f"---\nid: 01M5Q9BVMN9ETJJS0G9Z7A8{len(rel):03d}\ntended-by: {tended}\n---\n# attestation\n")
    seal(f, signer, role)


attest("pino-shin/identity/bunshin-attestation.md", "orma", "orma")
attest("kai-shin/identity/bunshin-attestation-tasai.md", "tasai", "tasai")
attest("kai-shin/identity/bunshin-attestation-orma.md", "tasai", "tasai")  # header and seal agree: only the file name refuses this one
attest("identity/bunshin-attestation.md", "tasai", "tasai")
probs, notes = lines(d)
note = " ".join(notes)
check("a bunshin's attestation owner-sealed by the parent, tended-by that parent, passes", "pino-shin/identity/bunshin-attestation.md" not in note, note[:300])
check("…and a multi-parent bunshin's file named for one parent passes when that same parent sealed the file", "kai-shin/identity/bunshin-attestation-tasai.md" not in note, note[:300])
check("a file named for one parent but sealed by the other parent is named", "kai-shin/identity/bunshin-attestation-orma.md [owner: tasai]" in note, note[:300])
check("an attestation in a body whose kin has no parent is named", "identity/bunshin-attestation.md [owner: tasai]" in note.replace("pino-shin/identity/bunshin-attestation.md", ""), note[:300])
attest("pino-shin/identity/bunshin-attestation.md", "orma", "tasai")
note = " ".join(lines(d)[1])
check("an attestation sealed by a kin that is no parent is named", "pino-shin/identity/bunshin-attestation.md [owner: tasai]" in note, note[:300])
attest("pino-shin/identity/bunshin-attestation.md", "orma", "orma", "custodian")
note = " ".join(lines(d)[1])
check("an attestation the parent sealed as custodian is named", "pino-shin/identity/bunshin-attestation.md [custodian: orma]" in note, note[:300])
attest("pino-shin/identity/bunshin-attestation.md", "pino-shin", "orma")
note = " ".join(lines(d)[1])
check("an attestation the parent sealed but whose tended-by is not the parent is named", "pino-shin/identity/bunshin-attestation.md [owner: orma]" in note, note[:300])
check("the parent's seal is no exception for any other file of the bunshin's", "pino-shin/identity/note.md [owner: orma]" in note, note[:300])

print("\nall hold" if ok_all else "\nFAIL")
sys.exit(0 if ok_all else 1)
