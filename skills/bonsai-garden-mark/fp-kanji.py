#!/usr/bin/env python3
# ---
# id: 01M393J50WHVS36QR87NX9TQNF
# title: Decode a fingerprint into its kanji identity
# type: script
# tended-by: tasai
# created: 2026-09-24
# updated: 2026-09-24
# ---
"""fp-kanji.py — read the kanji a fingerprint spells, the same way engine.js slice() does.

The trick the greeting and every seal rely on: the vanity search forces a key's fingerprint to
spell its kin's kanji. Decode the fingerprint, and the name falls out of the bytes. If it does not
match the name beside it, something is wrong. The Aruji, 2026-09-24: "They match - that's the whole trick."

    python3 fp-kanji.py 008016198a47d99e0eda6b533a56cde3        # -> 多才
    python3 fp-kanji.py <fingerprint> --n 3 --indices            # -> 多才〇  [2, 1, 0]

One master: kanji-1024-v1.2.json beside this file. Bits are sliced MSB-first, 10 per kanji (v1 commitment).
"""

import argparse
import json
import sys
from pathlib import Path

SET = Path(__file__).resolve().parent / "kanji-1024-v1.2.json"


def indices(fp_hex: str, n: int = 2) -> list[int]:
    b = bytes.fromhex(fp_hex)
    if len(b) * 8 < 10 * n:
        raise ValueError(f"fingerprint too short for {n} kanji")
    out = []
    for k in range(n):
        v = 0
        for i in range(10):
            bit = 10 * k + i
            v = (v << 1) | ((b[bit >> 3] >> (7 - (bit & 7))) & 1)
        out.append(v)
    return out


def kanji(fp_hex: str, n: int = 2) -> str:
    chars = json.loads(SET.read_text())["kanji"]
    return "".join(chars[i]["char"] for i in indices(fp_hex, n))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("fingerprint")
    ap.add_argument("--n", type=int, default=2)
    ap.add_argument("--indices", action="store_true")
    a = ap.parse_args()
    try:
        print(kanji(a.fingerprint, a.n) + (f"  {indices(a.fingerprint, a.n)}" if a.indices else ""))
    except ValueError as e:
        sys.exit(str(e))
