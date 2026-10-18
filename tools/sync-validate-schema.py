#!/usr/bin/env python3
# ---
# id: 01M4P8ARVXWEBRQS4582FFFAFT
# title: sync-validate-schema: the validator ships a generated copy of core's metadata schema, and a drift gate holds it
# type: script
# tended-by: baisai
# created: 2026-10-11
# updated: 2026-10-16
# ---
"""sync-validate-schema.py: the installed bonsai-garden-validate must run with no core checkout above it (Bonsai's pot session,
2026-10-11), so the skill ships a copy of core's metadata schema. A hand-kept copy is a second master (AGENTS.md: where a copy
must exist, generate it and gate on drift), so this writes it and checks it.

    python3 tools/sync-validate-schema.py --write     copy rituals/specs/metadata-schema.md to the skill's references/
    python3 tools/sync-validate-schema.py --check     exit 1 when the copy differs from the master (drift), 0 when identical
        [--bundled PATH]   the copy to read or write (default: skills/bonsai-garden-validate/references/metadata-schema.txt)

The copy is named .txt on purpose: a .md would carry the master's id a second time (two documents sharing one id is worse than a stale path). It carries a custodian seal by whoever wrote it (the master is Hissai's); a changed master is re-synced and re-sealed.
"""

import sys
from pathlib import Path

CORE = Path(__file__).resolve().parent.parent
MASTER = CORE / "rituals" / "specs" / "metadata-schema.md"
DEFAULT = (
    CORE / "skills" / "bonsai-garden-validate" / "references" / "metadata-schema.txt"
)  # .txt: a copy must not carry the master's id as a document


def main(argv):
    if "--help" in argv or "-h" in argv:
        print(__doc__.strip())
        return 0
    mode = "--write" if "--write" in argv else "--check" if "--check" in argv else None
    if mode is None:
        print(__doc__.strip())
        return 64  # no mode named: a usage error, not a request for the text
    bundled = Path(argv[argv.index("--bundled") + 1]) if "--bundled" in argv else DEFAULT
    if not MASTER.is_file():
        print(f"sync-validate-schema: the master is missing: {MASTER}", file=sys.stderr)
        return 2
    want = MASTER.read_bytes()
    if mode == "--write":
        bundled.parent.mkdir(parents=True, exist_ok=True)
        if bundled.is_file() and bundled.read_bytes() == want:
            print(f"in step: {bundled}")
            return 0
        bundled.write_bytes(want)
        print(f"written: {bundled}  ({len(want)} bytes from {MASTER.relative_to(CORE)}); re-seal it")
        return 0
    if not bundled.is_file():
        print(f"DRIFT: {bundled} is missing; run --write")
        return 1
    if bundled.read_bytes() != want:
        print(f"DRIFT: {bundled} differs from {MASTER.relative_to(CORE)}; run --write and re-seal")
        return 1
    print(f"in step: {bundled} is byte-identical to {MASTER.relative_to(CORE)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
