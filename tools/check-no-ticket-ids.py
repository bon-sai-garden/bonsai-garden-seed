#!/usr/bin/env python3
# ---
# id: 01M4TQRJW5BHYYK9FGBA04Z6CN
# title: check-no-ticket-ids — a ticket-shaped id never ships in core
# type: script
# tended-by: baisai
# created: 2026-10-13
# updated: 2026-10-16
# ---
"""check-no-ticket-ids.py — core carries no instance ticket id (the gardener, 2026-10-13: "sweep, all of them").

A ticket id names a card on one garden's board; another garden cannot read it, and a published repo would carry the
garden's working record. The shapes, any case: BL-<two letters><2 to 4 digits>, WS-<one or two letters><2 to 4 digits>,
RT-<2 to 4 digits>, MS-<2 to 4 digits>, TA<3 digits>-F<digit>. Spelled out, not written in full: a shape written in full
is a hit wherever this text is read, and a copy of this gate under another --root is not skipped as this gate's own file.
`BL-XX<digits>` with the letters X X is the placeholder family: a test that needs a card id uses it.

    python3 tools/check-no-ticket-ids.py [--root <repo>] [--rev <rev>] [<file>...]
        no files: every tracked file, sidecars skipped. --rev reads the files of that commit from git, never the
        working tree: what a distro is cut from is what was committed, and tools/distro/build-distro.mjs runs this
        gate on the commit it cuts (the slice names it under "gates").
Exit 0 clean; 1 hits (file:line and the id); 2 usage.
"""

import re
import subprocess
import sys
import tarfile
from pathlib import Path

ID = re.compile(
    r"\b(?:BL-[A-Z]{2}\d{2,4}|WS-[A-Z]{1,2}\d{2,4}|RT-\d{2,4}|MS-\d{2,4}|TA\d{3}-F\d)\b", re.I
)  # any case: a tag may be lower-cased
PLACEHOLDER = re.compile(r"^BL-XX\d+$", re.I)
HERE = Path(__file__).resolve()


def committed(root, rev):
    """Yield (path, text) for every text file of <rev>: read from git, so the working tree is never consulted."""
    probe = subprocess.run(["git", "-C", str(root), "rev-parse", "--verify", f"{rev}^{{commit}}"], capture_output=True)
    if probe.returncode:
        raise ValueError(f"{rev} is not a commit of {root}")
    git = subprocess.Popen(["git", "-C", str(root), "archive", "--format=tar", rev], stdout=subprocess.PIPE)
    with tarfile.open(fileobj=git.stdout, mode="r|") as tar:
        for member in tar:
            if member.isfile() and not member.name.endswith(".bonsaisig"):
                try:
                    yield member.name, tar.extractfile(member).read().decode("utf-8")
                except UnicodeDecodeError:
                    continue
    if git.wait():
        raise ValueError(f"git archive {rev} failed in {root}")


def tracked(root, named):
    """Yield (path, text) for the named files, else for every tracked file of the working tree."""
    if named:
        paths = [Path(a) for a in named]
    else:
        r = subprocess.run(["git", "-C", str(root), "ls-files"], capture_output=True, text=True)
        if r.returncode:
            raise ValueError("not a git checkout")
        paths = [root / x for x in r.stdout.split("\n") if x]
    for p in paths:
        if p.name.endswith(".bonsaisig") or p.resolve() == HERE or not p.is_file():
            continue
        try:
            rp = p.resolve()
            yield str(rp.relative_to(root) if root in rp.parents else p), p.read_text("utf-8")
        except (UnicodeDecodeError, OSError):
            continue


def main(argv):
    if "--help" in argv or "-h" in argv:
        print(__doc__)
        return 0
    root = Path(argv[argv.index("--root") + 1]).resolve() if "--root" in argv else HERE.parent.parent
    rev = argv[argv.index("--rev") + 1] if "--rev" in argv else None
    named = [
        a for i, a in enumerate(argv) if not a.startswith("--") and (i == 0 or argv[i - 1] not in ("--root", "--rev"))
    ]
    try:
        files = committed(root, rev) if rev else tracked(root, named)
        hits = 0
        own = HERE.relative_to(root).as_posix() if root in HERE.parents else None  # this file states the shapes
        for name, text in files:
            if rev and name == own:
                continue
            for n, line in enumerate(text.split("\n"), 1):
                for m in ID.finditer(line):
                    if not PLACEHOLDER.match(m.group(0)):
                        hits += 1
                        print(f"{name}:{n}: {m.group(0)}")
    except ValueError as e:
        print(f"check-no-ticket-ids: {e}")
        return 2
    print(f"check-no-ticket-ids: {hits} hit(s)" if hits else "check-no-ticket-ids: clean")
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
