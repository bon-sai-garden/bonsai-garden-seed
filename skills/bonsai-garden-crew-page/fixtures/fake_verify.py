#!/usr/bin/env python3
# ---
# id: 01M48VA8FBF8XHRD7J5E6F6QKH
# title: A stand-in seal verifier for the crew-page tests (never a real one)
# type: script
# tended-by: eisai
# created: 2026-10-06
# updated: 2026-10-06
# ---
"""fake_verify.py <file> — the seal_verifier contract, with no keys: a sidecar <file>.fakeseal holds
{"signer": ..., "sha256": ...}. Prints 'ok <file>' and 'signer: <slug>' and exits 0 when the bytes
match; 'tampered' or 'no-sidecar' and exit 1 otherwise. For tests only: it proves nothing about anyone."""

import hashlib
import json
import sys
from pathlib import Path

p = Path(sys.argv[1])
side = p.with_name(p.name + ".fakeseal")
if not side.exists():
    print(f"no-sidecar {p}")
    sys.exit(1)
s = json.loads(side.read_text())
if s.get("sha256") != hashlib.sha256(p.read_bytes()).hexdigest():
    print(f"tampered {p}\n  signer:      {s.get('signer')}")
    sys.exit(1)
print(f"ok       {p}\n  signer:      {s.get('signer')}")
