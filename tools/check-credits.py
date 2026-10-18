#!/usr/bin/env python3
# ---
# id: 01M393RYNKFKMJ2YR2TB51NCTZ
# title: Credits gate — every third-party thing core uses is named in CREDITS.md
# type: script
# tended-by: baisai
# created: 2026-09-24
# updated: 2026-10-16
# ---
"""
check-credits.py — fail when core uses something CREDITS.md does not name.

Scans the committed tree (git ls-files) for:
  - Python imports that are not in the standard library (needs Python >= 3.10 for
    sys.stdlib_module_names; an older interpreter is a FAIL, never a guess)
  - Node imports that are bare package names (not node:*, not builtins, not relative)
  - Google Fonts families (family=…) and CDN scripts (jsDelivr, cdnjs, unpkg)
and checks each appears in CREDITS.md under a known alias. Exit 0 only when all are named.

  python3.12 tools/check-credits.py [repo-root [credits-file]]
  python3 tools/check-credits.py --help        this text, on any Python, exit 0
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

# import name → the name CREDITS.md uses for it
ALIAS = {
    "PIL": "Pillow",
    "c2pa": "c2pa-python",
    "yaml": "PyYAML",
    "cryptography": "cryptography",
    "jamdict": "jamdict",
    "jsdom": "jsdom",
    "mermaid": "Mermaid",
}
NODE_BUILTINS = {
    "fs",
    "path",
    "url",
    "crypto",
    "os",
    "child_process",
    "worker_threads",
    "util",
    "stream",
    "events",
    "http",
    "https",
    "zlib",
    "assert",
    "buffer",
    "readline",
    "process",
}
REQUIRED_DATA = {
    "KanjiVG": ["KanjiVG", "Ulrich Apel", "creativecommons.org/licenses/by-sa/3.0"],
    "KANJIDIC2": ["KANJIDIC2", "edrdg.org/edrdg/licence.html"],
}
PY_IMPORT = re.compile(r"^\s*(?:from|import)\s+([A-Za-z_][\w]*)", re.M)
JS_IMPORT = re.compile(r"""(?:from\s+|require\(\s*|import\(\s*)['"]([^'"]+)['"]""")
FONT_URL = re.compile(r"fonts\.googleapis\.com/css2?\?[^\"'\s>]+")
FAMILY = re.compile(r"family=([A-Za-z+]+)")
CDN = re.compile(r"https://(?:cdn\.jsdelivr\.net/npm|unpkg\.com|cdnjs\.cloudflare\.com/ajax/libs)/(@?[\w.-]+)")


def local_modules(root: Path, files: list[str]) -> set[str]:
    """A module that is a .py file or a package directory in the tree is not a dependency."""
    mods = {Path(f).stem for f in files if f.endswith(".py")}
    mods |= {Path(f).parent.name for f in files if f.endswith("__init__.py")}
    return mods


def main() -> int:
    if "--help" in sys.argv[1:] or "-h" in sys.argv[1:]:
        print(__doc__.strip())  # before the version gate: what this is can be asked of any Python
        return 0
    if sys.version_info < (3, 10):
        print("FAIL  needs Python >= 3.10 (sys.stdlib_module_names); run with python3.12")
        return 2
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
    files = subprocess.run(
        ["git", "-C", str(root), "ls-files"], capture_output=True, text=True, check=True
    ).stdout.split()
    cpath = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "CREDITS.md"  # 2nd arg: tests only
    credits = cpath.read_text(encoding="utf-8") if cpath.is_file() else ""
    if not credits:
        print("FAIL  CREDITS.md missing")
        return 1
    # Data credits a scan cannot find (no import names them): each must stay in CREDITS.md,
    # with its licence URL (the one identicon renderer, 2026-09-28: KanjiVG, the marks' stroke data).
    for name, must in REQUIRED_DATA.items():
        lost = [m for m in must if m not in credits]
        if lost:
            print(f"FAIL  CREDITS.md drops the {name} credit (missing: {', '.join(lost)})")
            return 1
    local = local_modules(root, files)
    found: dict[str, set[str]] = {}

    def need(name: str, where: str) -> None:
        found.setdefault(ALIAS.get(name, name), set()).add(where)

    for f in files:
        p = root / f
        if not p.is_file() or "node_modules" in f:
            continue
        if f.endswith(".py"):
            text = p.read_text(encoding="utf-8", errors="replace")
            # only real import statements: skip docstring lines that start with "from"
            for m in PY_IMPORT.finditer(text):
                mod = m.group(1)
                line = text[text.rfind("\n", 0, m.start()) + 1 : text.find("\n", m.end())]
                if not re.match(r"^\s*(from\s+\w[\w.]*\s+import\s|import\s+\w)", line):
                    continue
                if mod in sys.stdlib_module_names or mod in local or mod == "__future__":
                    continue
                need(mod, f)
        elif f.endswith((".mjs", ".js", ".cjs")):
            for m in JS_IMPORT.finditer(p.read_text(encoding="utf-8", errors="replace")):
                spec = m.group(1)
                if spec.startswith((".", "/", "node:", "http")):
                    continue
                base = spec.split("/")[0] if not spec.startswith("@") else "/".join(spec.split("/")[:2])
                if base in NODE_BUILTINS:
                    continue
                need(base, f)
        if f.endswith((".html", ".htm", ".css", ".md", ".mjs", ".js")):
            text = p.read_text(encoding="utf-8", errors="replace")
            for u in FONT_URL.finditer(text):  # every family in the URL, not the first
                for fam in FAMILY.findall(u.group(0)):
                    need(fam.replace("+", " "), f)
            for m in CDN.finditer(text):
                need(m.group(1).split("@")[0] if not m.group(1).startswith("@") else m.group(1), f)

    missing = {k: v for k, v in found.items() if not re.search(rf"(?i)\b{re.escape(k)}\b", credits)}
    for k in sorted(found):
        print(f"{'ok  ' if k not in missing else 'MISS'}  {k:22} {', '.join(sorted(found[k]))[:110]}")
    print(f"\n{len(found) - len(missing)}/{len(found)} named in CREDITS.md")
    return 0 if not missing else 1


if __name__ == "__main__":
    sys.exit(main())
