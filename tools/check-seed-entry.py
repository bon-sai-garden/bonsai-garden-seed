#!/usr/bin/env python3
# ---
# id: 01M5D8MMRME7NHWH6ETCJJ8879
# title: check-seed-entry — Bonsai's seed entry says what core's registry says of him, field for field
# type: script
# tended-by: baisai
# created: 2026-10-20
# updated: 2026-10-20
# ---
"""check-seed-entry.py: the origin's seed entry agrees with core's registry, every field they share.

`agents/bonsai/identity/bonsai-seed-entry.json` is the input `keys seed --bonsai-entry` plants a new garden's origin
from: a second copy of fields `agents/registry.json` also states. Nothing held the two together, and the entry went
without pronouns while every registry said he/him (the gardener, 2026-10-20: "Bonsai has always been „he/him" - from
day 1 - so that is a house-keeping miss, let's fix it for good pls"). This gate fails on any difference and names it:

  - the fields the entry must state, each equal to the registry's: slug, kanji, pronouns, fingerprint, fp-attests
    (a field the entry leaves out is a difference, never a pass);
  - any other field both carry, equal;
  - the registry's derived fields agree with the entry: fp8 is the fingerprint's first eight, kanji-chars its kanji;
  - the entry's fingerprint is its own public key's (sha256, the first 32 hex), as `seed` checks it.

The entry is Bonsai's, under his owner seal (`seed` takes it on no other), so this gate never writes it: a difference
is fixed in his seat, or in the registry if the registry is what is wrong.

    python3 tools/check-seed-entry.py [--root <core>] [--rev <rev>] [--entry <file>] [--registry <file>]
        --rev reads both files of that commit from git, never the working tree: tools/distro/build-distro.mjs runs
        this gate on the commit it cuts (the slice names it under "gates"). --entry and --registry read those files
        instead (a planted copy, for the gate's own test). --root defaults to the core this file sits in.
Exit 0 agree; 1 a difference (each field named); 2 cannot run (a check that cannot run is not a pass).
"""

from __future__ import annotations

import base64
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ENTRY = "agents/bonsai/identity/bonsai-seed-entry.json"
REGISTRY = "agents/registry.json"
MUST = ("slug", "kanji", "pronouns", "fingerprint", "fp-attests")  # the fields a planting reads from the entry
OWN = {"format", "public-key", "source"}  # the entry's alone: no registry field to agree with
HERE = Path(__file__).resolve()


class CannotRun(Exception):
    pass


def core_of(start: Path) -> Path | None:
    """The core this file sits in, by marker (its registry and LAYERS.md), never by counting levels."""
    for d in start.parents:
        if (d / REGISTRY).is_file() and (d / "LAYERS.md").is_file():
            return d
    return None


def load(root: Path | None, rev: str | None, rel: str, given: str | None) -> dict:
    """One JSON file: a named file, else `rel` at `rev` from git, else `rel` in the working tree of `root`."""
    where = given or (f"{rev}:{rel}" if rev else str((root or Path(".")) / rel))
    try:
        if given:
            raw = Path(given).read_bytes()
        elif rev:
            r = subprocess.run(["git", "-C", str(root), "show", f"{rev}:{rel}"], capture_output=True)
            if r.returncode:
                raise CannotRun(f"{rel} is not in {rev} of {root}")
            raw = r.stdout
        else:
            raw = (root / rel).read_bytes()
        return json.loads(raw.decode("utf-8"))
    except FileNotFoundError:
        raise CannotRun(f"{where}: not found") from None
    except (UnicodeDecodeError, ValueError):
        raise CannotRun(f"{where}: not JSON") from None


def differences(entry: dict, registry: dict) -> list[str]:
    """Every way the entry and the registry's row for its slug part, one line each; [] when they agree."""
    slug = entry.get("slug")
    rows = [a for a in registry.get("agents") or [] if isinstance(a, dict) and a.get("slug") == slug]
    if len(rows) != 1:
        return [f"slug: the registry holds {len(rows)} entries for {slug!r}, not one"]
    reg = rows[0]
    out = []
    for k in MUST:
        if k not in entry or entry[k] in (None, ""):
            out.append(f"{k}: the seed entry states none; the registry says {reg.get(k)!r}")
        elif k not in reg:
            out.append(f"{k}: the registry states none; the seed entry says {entry[k]!r}")
        elif entry[k] != reg[k]:
            out.append(f"{k}: the seed entry says {entry[k]!r}; the registry says {reg[k]!r}")
    for k in sorted((set(entry) & set(reg)) - set(MUST) - OWN):
        if entry[k] != reg[k]:
            out.append(f"{k}: the seed entry says {entry[k]!r}; the registry says {reg[k]!r}")
    fp, kanji = entry.get("fingerprint"), entry.get("kanji")
    if isinstance(fp, str) and "fp8" in reg and reg["fp8"] != fp[:8]:
        out.append(f"fp8: the registry says {reg['fp8']!r}; the seed entry's fingerprint begins {fp[:8]!r}")
    if isinstance(kanji, str) and "kanji-chars" in reg and reg["kanji-chars"] != list(kanji):
        out.append(f"kanji-chars: the registry says {reg['kanji-chars']!r}; the seed entry's kanji are {list(kanji)!r}")
    try:
        key = base64.b64decode(entry.get("public-key") or "", validate=True)
    except ValueError:
        key = b""
    if len(key) != 32:
        out.append("public-key: the seed entry carries no 32-byte public key")
    elif isinstance(fp, str) and hashlib.sha256(key).hexdigest()[:32] != fp:
        out.append(f"fingerprint: {fp!r} is not the seed entry's own public key's")
    return out


def opt(argv: list[str], name: str) -> str | None:
    if name not in argv:
        return None
    i = argv.index(name)
    if i + 1 >= len(argv):
        raise CannotRun(f"{name} needs a value")
    return argv[i + 1]


def main(argv: list[str]) -> int:
    if "--help" in argv or "-h" in argv:
        print(__doc__)
        return 0
    try:
        root_arg, rev = opt(argv, "--root"), opt(argv, "--rev")
        entry_f, reg_f = opt(argv, "--entry"), opt(argv, "--registry")
        root = Path(root_arg).resolve() if root_arg else core_of(HERE)
        if root is None and not (entry_f and reg_f):
            raise CannotRun("no core around this file: name it with --root")
        entry = load(root, rev, ENTRY, entry_f)
        registry = load(root, rev, REGISTRY, reg_f)
        bad = differences(entry, registry)
    except CannotRun as e:
        print(f"check-seed-entry: cannot run: {e}")
        return 2
    for line in bad:
        print(f"FAIL  {line}")
    if bad:
        print(f"check-seed-entry: the seed entry and the registry part on {len(bad)} field(s); the entry is Bonsai's")
        return 1
    print(f"check-seed-entry: ok, the seed entry agrees with the registry ({', '.join(MUST)}; fp8, kanji-chars; key)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
