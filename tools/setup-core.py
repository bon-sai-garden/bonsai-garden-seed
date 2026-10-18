#!/usr/bin/env python3
# ---
# id: 01M394XJV2DDYD6T66JZ8M3287
# title: Set up bonsai-garden-core — check, explain, and install only with consent
# type: script
# tended-by: baisai
# created: 2026-09-24
# updated: 2026-09-24
# ---
"""
setup-core.py — get a fresh copy of bonsai-garden-core ready to use, in plain words.

    python3 tools/setup-core.py            look around and explain; changes nothing
    python3 tools/setup-core.py --install  do what is missing, asking before each step

Safe by construction (the Aruji, 2026-09-24: "dead simple (but safe) for the rest of us"):
  - It writes only inside this folder: node_modules/ and .venv/. Nothing system-wide, no sudo.
  - It installs only exact versions from files you can read: package-lock.json (every package
    with its sha512 checksum) and requirements.txt (exact versions).
  - npm runs with --ignore-scripts, so no package can run its own install code.
  - It never downloads and runs a script. If Homebrew itself is missing, it tells you where to
    get it and stops; installing Homebrew is your step.
  - It asks before every install. Say no and nothing happens.
  - Running it twice is harmless.

Python standard library only, so it runs on the Python your Mac already has.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # core's folder, found by marker below
if not (ROOT / "package-lock.json").is_file() or not (ROOT / "skills").is_dir():
    sys.exit("This doesn't look like a bonsai-garden-core folder (no package-lock.json or skills/). Stopping.")

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


def python_libs_ready() -> bool:
    py = venv_python()
    if not py.is_file():
        return False
    r = subprocess.run([str(py), "-c", "import PIL, cryptography, c2pa"], capture_output=True)
    return r.returncode == 0


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
    py = python_libs_ready()
    say(
        OK if py else NOTE,
        "The portrait tools are ready"
        if py
        else "Optional: the portrait tools aren't installed. You only need them to make portraits and their thumbnails; run again with --install to add them",
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

    # 3 · Python libraries for the portrait skill (optional), into .venv/ only
    if not python_libs_ready() and ask(
        "Also install the portrait tools into this folder's .venv? Optional, only for making portraits"
    ):
        if not venv_python().is_file() and not run([sys.executable, "-m", "venv", ".venv"]):
            print("\n  Couldn't create .venv. Nothing else was changed.\n")
            return 1
        if not run(
            [str(venv_python()), "-m", "pip", "install", "--disable-pip-version-check", "-r", "requirements.txt"]
        ):
            print("\n  pip couldn't install requirements.txt. Only .venv/ was touched.\n")
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
