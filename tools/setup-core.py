#!/usr/bin/env python3
# ---
# id: 01M394XJV2DDYD6T66JZ8M3287
# title: Set up the seed — check, explain, and install only with consent
# type: script
# tended-by: baisai
# created: 2026-09-24
# updated: 2026-10-21
# ---
"""
setup-core.py — get a fresh copy of the seed ready to use, in plain words.

    python3 tools/setup-core.py            look around and explain; changes nothing
    python3 tools/setup-core.py --install  do what is missing, asking before each step

Safe by construction (the Aruji, 2026-09-24: "dead simple (but safe) for the rest of us"):
  - It writes only inside this folder: node_modules/ and .venv/. Nothing system-wide, no sudo.
  - It installs only exact versions from files you can read: package-lock.json (every package
    with its sha512 checksum) and requirements-lock.txt (every Python package requirements.txt
    pulls in, each by its sha256: pip --require-hashes). No lock, no Python install.
  - npm runs with --ignore-scripts, so no package can run its own install code.
  - It never downloads and runs a script. If Homebrew itself is missing, it tells you where to
    get it and stops; installing Homebrew is your step.
  - It asks before every install. Say no and nothing happens.
  - Running it twice is harmless.
  - It never installs a Pillow other than the one requirements.txt pins. That Pillow (13.0.0, the
    first release past the advisories published against 12.3.0 on 2026-10-20) and numpy need
    Python 3.11 or newer, so the portrait tools go into .venv/ only with such a Python: this one,
    or one already on this machine (python3.11 or later on PATH), named before you say yes. With
    none, nothing is installed, and no older Pillow in its place. A .venv/ that is not at the pins
    is named as such; one on an older Python is left as it is (removing it is your step).

Python standard library only, so it runs on the Python your Mac already has.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # core's folder, found by marker below
if not (ROOT / "package-lock.json").is_file() or not (ROOT / "skills").is_dir():
    sys.exit("This doesn't look like a copy of the seed (no package-lock.json or skills/). Stopping.")

OK, NO, NOTE = "  ✓", "  ✗", "  ·"


def say(mark: str, text: str) -> None:
    print(f"{mark} {text}")


def ask(question: str) -> bool:
    try:
        return input(f"\n  {question} [y/N] ").strip().lower() in ("y", "yes")
    except EOFError:
        return False


def run(cmd: list[str], **kw) -> bool:
    print(f"    → {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=ROOT, **kw).returncode == 0


def node_major() -> int | None:
    node = shutil.which("node")
    if not node:
        return None
    out = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip().lstrip("v")
    try:
        return int(out.split(".")[0])
    except ValueError:
        return None


def jsdom_ready() -> bool:
    if not shutil.which("node"):
        return False
    r = subprocess.run(
        ["node", "--input-type=module", "-e", "await import('jsdom')"], cwd=ROOT, capture_output=True, text=True
    )
    return r.returncode == 0


def venv_python() -> Path:
    return ROOT / ".venv" / "bin" / "python3"


# Pillow 13.0.0 and numpy 2.4.6 need Python 3.11 or newer: requirements.txt as a whole installs only there.
PY_FLOOR = (3, 11)

# What a Python says about itself: its version, and the version of each named distribution it has (None if not).
PROBE = """
import json, sys
from importlib import metadata
have = {}
for name in sys.argv[1:]:
    v = None
    for n in (name, name.lower(), name.replace("-", "_")):
        try:
            v = metadata.version(n)
            break
        except metadata.PackageNotFoundError:
            pass
    have[name] = v
print(json.dumps({"python": list(sys.version_info[:2]), "dists": have}))
"""


def probe(py: str | Path, names: list[str] | None = None) -> dict | None:
    try:
        r = subprocess.run([str(py), "-c", PROBE, *(names or [])], capture_output=True, text=True, timeout=60)
        return json.loads(r.stdout) if r.returncode == 0 else None
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return None


def pins() -> dict[str, str]:
    """requirements.txt's exact pins, {name: version}, in the file's own spelling."""
    out = {}
    for line in (ROOT / "requirements.txt").read_text().splitlines():
        m = re.match(r"^([A-Za-z0-9][A-Za-z0-9_.\-]*)==([^\s;#]+)", line.strip())
        if m:
            out[m.group(1)] = m.group(2)
    return out


def ver(t) -> str:
    return ".".join(map(str, t))


def newer_python() -> tuple[str, tuple[int, int]] | None:
    """A Python at PY_FLOOR or newer already on this machine (python3.11 or later on PATH), newest first."""
    for minor in range(20, PY_FLOOR[1] - 1, -1):
        p = shutil.which(f"python3.{minor}")
        st = probe(p) if p else None
        if st and tuple(st["python"]) >= PY_FLOOR:
            return p, tuple(st["python"])
    return None


def portrait_state() -> dict:
    """The portrait tools in .venv/: needs is None (at the pins), "create" (no .venv), "sync" (a pin differs) or
    "blocked" (.venv's Python is older than PY_FLOOR: no pinned Pillow installs there)."""
    want = pins()
    py = venv_python()
    if not py.is_file():
        return {"needs": "create"}
    st = probe(py, list(want))
    if not st:
        return {"needs": "blocked", "why": f"{py.relative_to(ROOT)} does not run"}
    pyv = tuple(st["python"])
    off = {n: (st["dists"].get(n), v) for n, v in want.items() if st["dists"].get(n) != v}
    pil = next((st["dists"].get(n) for n in want if n.lower() == "pillow"), None)
    if pyv < PY_FLOOR:
        return {"needs": "blocked", "python": pyv, "pillow": pil}
    return {"needs": "sync" if off else None, "python": pyv, "off": off, "pillow": pil}


def off_text(off: dict) -> str:
    return ", ".join(f"{n} {have or 'missing'} (pinned {want})" for n, (have, want) in off.items())


def floor_text() -> str:
    pv = ver(sys.version_info[:2])
    return (
        f"The portrait tools need Python {ver(PY_FLOOR)} or newer: Pillow {pins().get('Pillow', '?')}, the first release "
        f"past its published advisories, and numpy need it. This is Python {pv}, and no newer Python was found "
        f"(python{ver(PY_FLOOR)} or later on PATH). Nothing was installed, and no older Pillow in its place.\n"
        "  Without them: the greeting thumb and a vCard's photo are made on macOS by its own sips (as JPEG); the\n"
        "  canonical portrait and the concept images say in one line that Pillow is missing and write nothing; the\n"
        "  crew page needs it too. To add them later, install a newer Python yourself (with Homebrew:\n"
        "  brew install python@3.12) and run this again."
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--install", action="store_true", help="install what is missing, asking first")
    a = ap.parse_args()

    print(f"\nbonsai-garden-core at {ROOT}\n")
    brew = shutil.which("brew")
    major = node_major()
    say(
        OK if brew else NOTE,
        "Homebrew is installed (the Mac's app installer for tools like Node)"
        if brew
        else "Homebrew isn't installed. You only need it if Node is missing",
    )
    say(
        OK if major and major >= 20 else NO,
        f"Node {major} is installed (the program core's tools run on)"
        if major
        else "Node isn't installed. It's the program core's tools run on; checking signatures and kanji marks needs it",
    )
    js = jsdom_ready()
    say(
        OK if js else NO,
        "The archived lab page's checker is ready (jsdom)"
        if js
        else "Optional: the archived lab page's checker isn't installed (jsdom). Kanji marks are checked without it",
    )
    ps = portrait_state()
    if ps["needs"] is None:
        say(OK, f"The portrait tools are ready (Pillow {ps['pillow']}, on Python {ver(ps['python'])})")
    elif ps["needs"] == "sync":
        say(
            NO,
            f"The portrait tools in .venv are not at requirements.txt's pins: {off_text(ps['off'])}. "
            "Run again with --install to bring them to the pins",
        )
    elif ps["needs"] == "blocked":
        say(
            NO,
            (
                f".venv runs Python {ver(ps['python'])}, and requirements.txt needs {ver(PY_FLOOR)} or newer "
                f"(Pillow {pins().get('Pillow', '?')}, the first release past its published advisories)"
                + (f". Its Pillow {ps['pillow']} is not the pinned one" if ps.get("pillow") else "")
                if "python" in ps
                else ps["why"]
            )
            + ". Nothing here upgrades or removes it: remove .venv yourself, then run again with --install",
        )
    else:
        base = sys.version_info[:2] >= PY_FLOOR or newer_python()
        say(
            NOTE,
            "Optional: the portrait tools aren't installed. You only need them to make portraits and their thumbnails; run again with --install to add them"
            + (
                ""
                if base
                else f" (they need Python {ver(PY_FLOOR)} or newer: this is {ver(sys.version_info[:2])}, and none newer is on PATH)"
            ),
        )

    if not a.install:
        if not (major and major >= 20):
            print(
                "\nNothing was changed. To set up what's missing, run:\n\n    python3 tools/setup-core.py --install\n"
            )
        else:
            print("\nEverything core needs is here. Nothing was changed.\n")
        return 0

    # 1 · Node
    if not (major and major >= 20):
        if not brew:
            print(
                "\n  Node is needed, and the simplest way to get it on a Mac is Homebrew.\n"
                "  Homebrew isn't installed. Install it yourself from https://brew.sh (its page shows\n"
                "  one command to paste into Terminal), then run this again. I won't run that for you.\n"
            )
            return 1
        if not ask("Install Node with Homebrew (brew install node)?"):
            print("\n  Skipped. Nothing was changed.\n")
            return 1
        if not run(["brew", "install", "node"]):
            print("\n  Homebrew couldn't install Node. Nothing else was changed.\n")
            return 1

    # 2 · jsdom, from the lockfile, with install scripts switched off
    if not jsdom_ready():
        if ask(
            "Also install the archived lab page's checker (jsdom) into this folder, exactly as package-lock.json lists it? Optional"
        ):
            if not run(["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"]):
                print("\n  npm couldn't install from the lockfile. Nothing outside this folder was touched.\n")
                return 1
        else:
            print("  Skipped jsdom. Kanji marks are still checked; only the archived lab page is not.")

    # 3 · Python libraries for the portrait skill (optional), into .venv/ only, and only on a Python the pins install on:
    # never an older Pillow in the pinned one's place (the advisories of 2026-10-20 are fixed only in Pillow 13.0.0)
    ps = portrait_state()
    # the hashed lock, generated from requirements.txt: every transitive package by its sha256 (Mori-shin's read, B10-25)
    lock = ROOT / "requirements-lock.txt"
    pip = [str(venv_python()), "-m", "pip", "install", "--disable-pip-version-check", "--require-hashes"]
    pip += ["-r", "requirements-lock.txt"]
    go = False
    if ps["needs"] in ("sync", "create") and not lock.is_file():
        print(
            "\n  The portrait tools are skipped: requirements-lock.txt is not beside requirements.txt, and only the\n"
            "  hashed lock is installed, never the pins without their hashes. Nothing was installed."
        )
    elif ps["needs"] == "blocked":
        print(
            "\n  The portrait tools are skipped: .venv cannot take requirements.txt's pins (see above). Nothing was\n"
            "  installed, and no older Pillow in their place. Remove .venv yourself, then run this again."
        )
    elif ps["needs"] == "sync":
        go = ask(f"Bring the portrait tools in .venv to requirements.txt's pins ({off_text(ps['off'])})?")
    elif ps["needs"] == "create":
        base = (sys.executable, sys.version_info[:2]) if sys.version_info[:2] >= PY_FLOOR else newer_python()
        if not base:
            print("\n  " + floor_text())
        elif ask(
            f"Also install the portrait tools into this folder's .venv, with Python {ver(base[1])} ({base[0]})? "
            "Optional, only for making portraits"
        ):
            if not run([base[0], "-m", "venv", ".venv"]):
                print("\n  Couldn't create .venv. Nothing else was changed.\n")
                return 1
            go = True
    if go:
        if not run(pip):
            print("\n  pip couldn't install requirements-lock.txt. Only .venv/ was touched.\n")
            return 1
        ps = portrait_state()
        if ps["needs"] is not None:
            print(f"\n  .venv is still not at requirements.txt's pins: {off_text(ps.get('off', {})) or ps['needs']}.\n")
            return 1
        print(f"\n  To use them, run the portrait scripts with {venv_python().relative_to(ROOT)}.")

    # Proof, not a promise: check the canonical kanji set the garden's marks come from.
    # (Until 2026-09-24 this ran verify.mjs, which checks an archived page's retired v1.0 set;
    # its "passed" said nothing about today's marks.)
    print()
    ok = run(["node", "skills/bonsai-garden-mark/check-set.mjs"], stdout=subprocess.DEVNULL)
    say(
        OK if ok else NO,
        "The kanji set the garden's marks come from checks out"
        if ok
        else "The kanji set check FAILED. Run  node skills/bonsai-garden-mark/check-set.mjs  to see why",
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
