#!/usr/bin/env python3
# ---
# id: 01M4NSNQBW5Q51Y83QD4JT5G23
# title: The conformance gate under --keys pot: a pot's green is POT-PASS, never PASS, and never on the registry alone
# type: script
# tended-by: baisai
# created: 2026-10-11
# updated: 2026-10-17
# ---
"""test-conformance-pot.py: Mori-shin's ruling of 2026-10-11, third request (the checker, the same way as the two verifiers).

  check-shintai-conformance.py --keys pot --pot <dir> [--expect-fp <fp32>] <body>

  * the flags travel together, never inferred; --expect-fp needs both;
  * the green word under a pot is POT-PASS, never PASS (AGENTS.md's integrity rule reads "ok / PASS", and a rehearsal's
    green must not satisfy it); FAIL words stay as they are; the line says what vouched;
  * a pot that is neither lab-preview nor pinned is refused whole;
  * seals are read by tools/verify-many.mjs through core's pot-keys (the one seam): a pot's yes is pot-ok; a pot verifies
    v2 sidecars only (the embedded `verify` verb is not ok under a pot); an embedded v1 seal under a pot is not a pass;
  * lab-preview softens custody-fallback for that root only: a pinned pot that is not lab-preview stays custody-refused.

Throwaway pots and keys. Seals are built here from the published format (domain tag, canonical JSON, blake2b-512, ed25519),
so core's tests need no other repo.    python3 tools/test-conformance-pot.py
"""

import base64
import hashlib
import importlib.util
import io
import json
import os
import re
import subprocess
import sys
import tempfile
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

HERE = Path(__file__).resolve().parent

TOOL = HERE / os.environ.get("CONF_TOOL", "check-shintai-conformance.py")  # CONF_TOOL / CONF_MANY: the mutants
MANY = HERE / os.environ.get("CONF_MANY", "verify-many.mjs")
results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def make_pot(lab=True, custody=None, v1=False):
    pot = Path(tempfile.mkdtemp(prefix="conf-pot-")) / "pot"
    key = Ed25519PrivateKey.generate()
    raw = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    fp = hashlib.sha256(raw).hexdigest()[:32]
    (pot / "agents/testgardener/identity").mkdir(parents=True)
    (pot / "agents/testgardener/identity/testgardener-public-key.bin").write_bytes(raw)
    (pot / "agents/registry.json").write_text(
        json.dumps(
            {"agents": [{"slug": "testgardener", "type": "gardener", "fingerprint": fp, "path": "agents/testgardener"}]}
        )
    )
    (pot / "garden.json").write_text(json.dumps({"name": "x", "lab-preview": bool(lab)}))
    f = pot / "data.txt"
    f.write_text("a file the pot vouches for\n")
    if v1:
        side = {"body-hash": "0" * 64, "signer": "testgardener", "signature": "AAAA"}  # a v1 shape: retired
    else:
        side = {
            "format": "bonsaisig/2",
            "id": "01M4NSNQBW5Q51Y83QD4JT5G23",
            "signer": "testgardener",
            "role": "owner",
            "fingerprint": fp,
            "timestamp": "2026-10-11T12:00:00Z",
            "algorithm": "ed25519+blake2b512",
        }
        if custody:
            side["custody"] = custody
        side.update({"target": "data.txt", "file-hash": hashlib.blake2b(f.read_bytes()).hexdigest()})
        side["signature"] = base64.b64encode(key.sign(b"bonsai-seal-v2\n" + canonical(side).encode("utf-8"))).decode()
    (pot / ".data.txt.bonsaisig").write_text(json.dumps(side, indent=2) + "\n")
    return pot, f, fp


def many(args, jobs, env=None):
    r = subprocess.run(
        ["node", str(MANY), *args],
        input="".join(json.dumps(j) + "\n" for j in jobs),
        capture_output=True,
        text=True,
        timeout=120,
        env=env,
    )
    return r, [json.loads(line) for line in r.stdout.splitlines() if line.strip()]


def load_tool():
    spec = importlib.util.spec_from_file_location("conf_t", TOOL)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def run_main(argv, passes=True, softened=False):
    """Run the checker's main() in this process with its per-body check stubbed: the words are under test here, not the body."""
    m = load_tool()

    def stub(d):
        if softened:
            m.POT_SOFTENED.append(str(d))  # as _verify_many does when a lab-preview pot accepts a fallback seal
        return [] if passes else ["planted finding"]

    m.check_on_disk = stub
    old = sys.argv
    sys.argv = ["check-shintai-conformance.py", *argv]
    buf = io.StringIO()
    try:
        with redirect_stdout(buf), redirect_stderr(buf):
            try:
                code = m.main()
            except SystemExit as e:
                code = e.code if isinstance(e.code, int) else 1
    finally:
        sys.argv = old
    return code, buf.getvalue()


print("verify-many.mjs, the seam")
pot, f, fp = make_pot(lab=True)
r, o = many(["--keys", "pot", "--pot", str(pot)], [{"verb": "verify-sidecar", "file": str(f)}])
ok1 = (
    bool(o)
    and o[0].get("ok") is True
    and o[0].get("pot") is True
    and o[0]["first"].startswith("pot-ok  ")
    and f"keys: pot {pot.resolve()}" in o[0]["first"]
)
check(
    "a lab-preview pot's seal: ok, pot: true, first line pot-ok  <file>  keys: pot <dir>",
    ok1,
    (o[0]["first"] if o else r.stderr.strip()[:160]),
)
r, o = many(["--keys", "pot", "--pot", str(pot)], [{"verb": "verify", "file": str(f)}])
check(
    "the embedded verify verb under a pot is not ok, and says a pot verifies v2 sidecars",
    bool(o) and o[0].get("ok") is False and "v2 sidecars" in o[0].get("first", ""),
    (o[0]["first"] if o else r.stderr.strip()[:160]),
)
pot1, f1, _ = make_pot(lab=True, v1=True)
r, o = many(["--keys", "pot", "--pot", str(pot1)], [{"verb": "verify-sidecar", "file": str(f1)}])
check(
    "a v1 seal under a pot is not a pass",
    bool(o) and o[0].get("ok") is False and not o[0].get("first", "").startswith("pot-ok"),
    (o[0]["first"] if o else r.stderr.strip()[:160]),
)
potn, fn, fpn = make_pot(lab=False)
r, o = many(
    ["--keys", "pot", "--pot", str(potn)],
    [{"verb": "verify-sidecar", "file": str(fn)}, {"verb": "verify-sidecar", "file": str(fn)}],
)
check(
    "a pot that is neither lab-preview nor pinned answers every job with the refusal, not a pass",
    len(o) == 2 and all(x.get("ok") is False and "pot-untrusted" in x.get("first", "") for x in o),
    (o[0]["first"][:140] if o else r.stderr.strip()[:160]),
)
r, o = many(["--keys", "pot", "--pot", str(potn), "--expect-fp", fpn], [{"verb": "verify-sidecar", "file": str(fn)}])
check(
    "the same pot with the signer pinned: pot-ok",
    bool(o) and o[0].get("ok") is True and o[0]["first"].startswith("pot-ok"),
    (o[0]["first"][:100] if o else r.stderr.strip()[:160]),
)
potf, ff, fpf = make_pot(lab=True, custody="software-fallback")
r, o = many(["--keys", "pot", "--pot", str(potf)], [{"verb": "verify-sidecar", "file": str(ff)}])
check(
    "lab-preview softens custody-fallback for that root: ok with labSoftened",
    bool(o) and o[0].get("ok") is True and o[0].get("labSoftened") is True,
    str(o[:1])[:140],
)
potg, fg, fpg = make_pot(lab=False, custody="software-fallback")
r, o = many(["--keys", "pot", "--pot", str(potg), "--expect-fp", fpg], [{"verb": "verify-sidecar", "file": str(fg)}])
check(
    "a pinned pot that is not lab-preview stays custody-refused (core's policy untouched)",
    bool(o) and o[0].get("ok") is False and "custody-refused" in o[0].get("first", ""),
    (o[0]["first"][:120] if o else r.stderr.strip()[:160]),
)
# The garden is NAMED for this case. Without $BONSAI_GARDEN the verifier walks up from the file and finds the pot
# itself, whose registry then vouches for its own seal (ok, not pot-ok): the case passed on a host that sets the
# variable and failed in a clean seat (2026-10-16). A second throwaway pot stands in for a garden that never heard
# of this one's signer; what the walk-up does without the variable is the verifier owner's question, not this test's.
elsewhere, _f2, _fp2 = make_pot(lab=True)
r, o = many([], [{"verb": "verify-sidecar", "file": str(f)}], env={**os.environ, "BONSAI_GARDEN": str(elsewhere)})
check(
    "without --keys pot the same file is nobody's in the garden $BONSAI_GARDEN names (garden keys): not ok",
    bool(o) and o[0].get("ok") is False and "pot-ok" not in o[0].get("first", ""),
    (o[0]["first"][:100] if o else r.stderr.strip()[:160]),
)

print("one reader of the lab switch, one shape of the pin (Mori-shin's read, depth)")
pot, f, fp = make_pot(lab=True)
r = subprocess.run(
    ["node", str(MANY), "--keys", "pot", "--pot", str(pot), "--expect-fp", ""],
    input=json.dumps({"verb": "verify-sidecar", "file": str(f)}) + "\n",
    capture_output=True,
    text=True,
    timeout=60,
)
check(
    "verify-many refuses an --expect-fp that is not 32 hex (an empty pin is not 'no pin' on a lab-preview pot): exit 2, no verdicts",
    r.returncode == 2 and not r.stdout.strip(),
    f"exit {r.returncode}: {r.stdout.strip()[:60]!r} {r.stderr.strip()[:80]!r}",
)
r, o = many(["--keys", "pot", "--pot", str(pot)], [{"verb": "pot-trust", "file": str(pot)}])
check(
    "the trust question is answered once, by verify-many: a lab-preview pot says lab: true",
    bool(o) and o[0].get("ok") is True and o[0].get("lab") is True,
    str(o[:1])[:140],
)
potn, fn, fpn = make_pot(lab=False)
r, o = many(["--keys", "pot", "--pot", str(potn), "--expect-fp", fpn], [{"verb": "pot-trust", "file": str(potn)}])
check(
    "a pinned pot that is not lab-preview says lab: false",
    bool(o) and o[0].get("ok") is True and o[0].get("lab") is False,
    str(o[:1])[:140],
)
r, o = many(["--keys", "pot", "--pot", str(potn)], [{"verb": "pot-trust", "file": str(potn)}])
check(
    "an untrusted pot answers the question with its refusal",
    bool(o) and o[0].get("ok") is False and "pot-untrusted" in o[0].get("first", ""),
    str(o[:1])[:140],
)

print("the checker's words")
pot, f, fp = make_pot(lab=True)
body = pot / "agents" / "testgardener"
code, out = run_main(["--keys", "pot", "--pot", str(pot), str(body)])
check(
    "a pot's green is POT-PASS, says what vouched, exit 0",
    code == 0 and out.startswith("POT-PASS") and f"keys: pot {pot.resolve()}" in out.splitlines()[0],
    out.strip()[:160],
)
check(
    "and POT-PASS never satisfies a caller that matches ^PASS (AGENTS.md: ok / PASS)",
    re.match(r"^PASS", out) is None,
    out.strip()[:80],
)
code, out = run_main(["--keys", "pot", "--pot", str(pot), str(body)], passes=False)
code, out = run_main(["--keys", "pot", "--pot", str(pot), str(body)], softened=True)
check(
    "a seal accepted under lab-preview's softer custody rule is SAID on that run",
    code == 0 and "lab-preview: custody software-fallback accepted" in out,
    out.strip()[:200],
)
code, out = run_main(["--keys", "pot", "--pot", str(pot), str(body)])
check("and a run that accepted nothing softer says nothing of it", "software-fallback" not in out, out.strip()[:120])
code, out = run_main(["--keys", "pot", "--pot", str(pot), str(body)], passes=False)
check(
    "FAIL words stay as they are under a pot",
    code == 1 and out.startswith("FAIL ") and "planted finding" in out,
    out.strip()[:120],
)
code, out = run_main(["--keys", "pot", str(body)])
check("--keys pot without --pot is refused (exit 2), naming --pot", code == 2 and "--pot" in out, out.strip()[-120:])
code, out = run_main(["--pot", str(pot), str(body)])
check(
    "--pot without --keys pot is refused (exit 2), naming --keys pot",
    code == 2 and "--keys pot" in out,
    out.strip()[-120:],
)
code, out = run_main(["--expect-fp", fp, str(body)])
check("--expect-fp alone is refused (exit 2)", code == 2 and "--expect-fp" in out, out.strip()[-120:])
potn, fn, fpn = make_pot(lab=False)
code, out = run_main(["--keys", "pot", "--pot", str(potn), str(potn / "agents" / "testgardener")])
check(
    "a non-lab pot with no pin is refused whole: FAIL, pot-untrusted, both ways out",
    code == 1
    and out.startswith("FAIL")
    and "pot-untrusted" in out
    and "lab-preview" in out
    and "--expect-fp" in out
    and "POT-PASS" not in out,
    out.strip()[:200],
)
code, out = run_main(["--keys", "pot", "--pot", str(potn), "--expect-fp", fpn, str(potn / "agents" / "testgardener")])
check(
    "pinned, the same pot reads POT-PASS, labelled pinned (not lab-preview)",
    code == 0 and out.startswith("POT-PASS") and "(pinned)" in out.splitlines()[0],
    out.strip()[:140],
)
code, out = run_main(["--keys", "pot", "--pot", str(pot), "--expect-fp", fp, str(body)])
check(
    "a pot that is both lab-preview and pinned is labelled lab-preview",
    code == 0 and "(lab-preview)" in out.splitlines()[0],
    out.strip()[:140],
)
code, out = run_main(["--keys", "garden", str(body)])
check("outside pot mode the word is still PASS", code == 0 and out.startswith("PASS"), out.strip()[:80])

print("one pin per signer (--pins, the gardener's pin file; the 0.8.2 acceptance run, 2026-10-17)")


def second_signer(pot, fp_first):
    """Add a second signer (a custodian) to `pot`'s registry and a file sealed by it; returns (file, fp)."""
    key = Ed25519PrivateKey.generate()
    raw = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    fp2 = hashlib.sha256(raw).hexdigest()[:32]
    (pot / "agents/testkeeper/identity").mkdir(parents=True)
    (pot / "agents/testkeeper/identity/testkeeper-public-key.bin").write_bytes(raw)
    reg = json.loads((pot / "agents/registry.json").read_text())
    reg["agents"].append({"slug": "testkeeper", "type": "sai", "fingerprint": fp2, "path": "agents/testkeeper"})
    (pot / "agents/registry.json").write_text(json.dumps(reg))
    g = pot / "kept.txt"
    g.write_text("a file a custodian sealed\n")
    side = {
        "format": "bonsaisig/2",
        "id": "01M4NSNQBW5Q51Y83QD4JT5G23",
        "signer": "testkeeper",
        "role": "custodian",
        "fingerprint": fp2,
        "timestamp": "2026-10-17T12:00:00Z",
        "algorithm": "ed25519+blake2b512",
        "target": "kept.txt",
        "file-hash": hashlib.blake2b(g.read_bytes()).hexdigest(),
    }
    side["signature"] = base64.b64encode(key.sign(b"bonsai-seal-v2\n" + canonical(side).encode("utf-8"))).decode()
    (pot / ".kept.txt.bonsaisig").write_text(json.dumps(side, indent=2) + "\n")
    return g, fp2


def pins_file(pins):
    pf = Path(tempfile.mkdtemp(prefix="conf-pins-")) / "garden.json"
    pf.write_text(json.dumps({"garden": "x", "pins": pins}))
    return pf


potm, fm, fpm = make_pot(lab=False)
gm, fpk = second_signer(potm, fpm)
jobs = [{"verb": "verify-sidecar", "file": str(fm)}, {"verb": "verify-sidecar", "file": str(gm)}]
r, o = many(["--keys", "pot", "--pot", str(potm), "--expect-fp", fpm], jobs)
check(
    "one --expect-fp over a body with two signers: the other signer's seal is pin-mismatch (why --pins exists)",
    len(o) == 2 and o[0].get("ok") is True and o[1].get("ok") is False and "pin-mismatch" in o[1].get("first", ""),
    " | ".join(x.get("first", "")[:60] for x in o) or r.stderr.strip()[:160],
)
r, o = many(
    ["--keys", "pot", "--pot", str(potm), "--pins", str(pins_file({"testgardener": fpm, "testkeeper": fpk}))], jobs
)
check(
    "--pins with both signers pinned: each seal is pot-ok under its own signer's pin",
    len(o) == 2 and all(x.get("ok") is True and x["first"].startswith("pot-ok") for x in o),
    " | ".join(x.get("first", "")[:60] for x in o) or r.stderr.strip()[:160],
)
r, o = many(["--keys", "pot", "--pot", str(potm), "--pins", str(pins_file({"testgardener": fpm}))], jobs)
check(
    "--pins without a pin for the second signer: its seal is pot-untrusted and names it, the first still pot-ok",
    len(o) == 2
    and o[0].get("ok") is True
    and o[1].get("ok") is False
    and "pot-untrusted" in o[1].get("first", "")
    and "testkeeper" in o[1].get("first", ""),
    " | ".join(x.get("first", "")[:80] for x in o) or r.stderr.strip()[:160],
)
r, o = many(
    ["--keys", "pot", "--pot", str(potm), "--pins", str(pins_file({"testgardener": fpm, "testkeeper": fpm}))], jobs
)
check(
    "--pins with a wrong pin for a signer: that seal is pin-mismatch",
    len(o) == 2 and o[0].get("ok") is True and o[1].get("ok") is False and "pin-mismatch" in o[1].get("first", ""),
    " | ".join(x.get("first", "")[:60] for x in o) or r.stderr.strip()[:160],
)
bare = potm / "unsealed.txt"
bare.write_text("no seal\n")
r, o = many(
    ["--keys", "pot", "--pot", str(potm), "--pins", str(pins_file({"testgardener": fpm}))],
    [{"verb": "verify-sidecar", "file": str(bare)}],
)
check(
    "--pins and a file with no seal: the verdict is no-sidecar, not a trust question",
    bool(o) and o[0].get("ok") is False and o[0].get("first", "").startswith("no-sidecar"),
    (o[0]["first"][:100] if o else r.stderr.strip()[:160]),
)
r, _o = many(["--keys", "pot", "--pot", str(potm), "--expect-fp", fpm, "--pins", str(pins_file({}))], jobs)
check("--pins with --expect-fp is refused (exit 2)", r.returncode == 2 and "--pins" in r.stderr, r.stderr.strip()[:100])
r, _o = many(["--keys", "garden", "--pins", str(pins_file({}))], jobs)
check("--pins outside --keys pot is refused (exit 2)", r.returncode == 2, r.stderr.strip()[:100])
code, out = run_main(
    [
        "--keys",
        "pot",
        "--pot",
        str(potm),
        "--pins",
        str(pins_file({"testgardener": fpm})),
        str(potm / "agents" / "testgardener"),
    ]
)
check(
    "the checker takes --pins and reads POT-PASS (pinned)", code == 0 and out.startswith("POT-PASS"), out.strip()[:140]
)
code, out = run_main(["--keys", "pot", "--pot", str(potm), "--expect-fp", fpm, "--pins", "x", str(potm)])
check("the checker refuses --pins with --expect-fp (exit 2)", code == 2 and "--pins" in out, out.strip()[-120:])

potl, fl, fpl = make_pot(lab=True)
gl, fpkl = second_signer(potl, fpl)
jobs_l = [{"verb": "verify-sidecar", "file": str(fl)}, {"verb": "verify-sidecar", "file": str(gl)}]
r, o = many(["--keys", "pot", "--pot", str(potl), "--pins", str(pins_file({"testgardener": fpl}))], jobs_l)
check(
    "--pins in a lab-preview pot: a signer the file does not name is pot-untrusted (lab does not stand in for a pin file)",
    len(o) == 2
    and o[0].get("ok") is True
    and o[1].get("ok") is False
    and "pot-untrusted" in o[1].get("first", "")
    and "testkeeper" in o[1].get("first", ""),
    " | ".join(x.get("first", "")[:80] for x in o) or r.stderr.strip()[:160],
)
r, o = many(
    ["--keys", "pot", "--pot", str(potl), "--pins", str(pins_file({"testgardener": fpl, "testkeeper": fpkl}))], jobs_l
)
check(
    "--pins in a lab-preview pot with both signers pinned: each seal is pot-ok",
    len(o) == 2 and all(x.get("ok") is True and x["first"].startswith("pot-ok") for x in o),
    " | ".join(x.get("first", "")[:60] for x in o) or r.stderr.strip()[:160],
)
r, o = many(
    ["--keys", "pot", "--pot", str(potl), "--pins", str(pins_file({"testgardener": fpl, "testkeeper": fpl}))], jobs_l
)
check(
    "--pins in a lab-preview pot with a wrong pin for a signer: that seal is pin-mismatch",
    len(o) == 2 and o[1].get("ok") is False and "pin-mismatch" in o[1].get("first", ""),
    " | ".join(x.get("first", "")[:60] for x in o) or r.stderr.strip()[:160],
)
alist = Path(tempfile.mkdtemp(prefix="conf-pins-")) / "garden.json"
alist.write_text(json.dumps({"garden": "x", "pins": [fpm]}))
r, o = many(["--keys", "pot", "--pot", str(potm), "--pins", str(alist)], jobs)
check(
    "--pins file whose pins is a list is not a pin file (exit 2, no verdict)",
    r.returncode == 2 and not o,
    r.stderr.strip()[:100],
)

print(f"\nVERDICT: {sum(results)}/{len(results)} held")
sys.exit(0 if all(results) else 1)
