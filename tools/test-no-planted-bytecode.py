#!/usr/bin/env python3
# ---
# id: 01M5R2W7AJRA187J5XEEPWGQAM
# title: a bundled script, or a core tool, that loads Python beside it points the cache at a fresh private folder first (B10-65, fix 1)
# type: script
# tended-by: baisai
# created: 2026-10-25
# updated: 2026-10-25
# ---
"""test-no-planted-bytecode.py: bytecode is code (Mori-shin's read of rt 0.9.3-rc, 2026-10-25). A timestamp .pyc whose
header carries a sealed source's mtime and size runs instead of the source, under -B and with sys.dont_write_bytecode
too, while the source's sealed bytes stay untouched. So every bundled script that loads Python by path, or imports a sibling,
first sets sys.pycache_prefix to a fresh private folder: a cache beside the package is never read, and none is written.

The property is read from every tracked .py under skills/ and agents/ that is not a test (a builder runs the tests in
a checkout; none runs at wake): a script that loads by path or imports a sibling module sets the prefix at module
level, before the first such line. Watched to fail on three mutants, and one planted cache is run for real.

The same holds one ring out, for core's own tools/ (Fuji-shin's round four, 2026-10-25: five tools load Python by path
with no prefix, and a cache planted beside package.py ran in place of the builder under check-skill-conformance.py).
They are gates run from a checkout, not scripts a package carries, and a gate that runs planted bytecode judges with
someone else's code. Every tracked tools/ .py that is not a test is read the same way, and Fuji-shin's own case is run
for real: a cache planted beside package.py, under check-skill-conformance.py.

    python3 tools/test-no-planted-bytecode.py
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
from importlib._bootstrap_external import _code_to_timestamp_pyc
from pathlib import Path

CORE = Path(__file__).resolve().parents[1]
LOAD = re.compile(r"spec_from_file_location|SourceFileLoader|sys\.path\.(?:insert|append)\(")
PREFIX = "sys.pycache_prefix = tempfile.mkdtemp("
ok_all = True


def check(name: str, ok: bool, detail: str = "") -> None:
    global ok_all
    ok_all &= bool(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail and not ok else ""))


def sibling_import(siblings: set[str]) -> re.Pattern | None:
    if not siblings:
        return None
    names = "|".join(sorted(re.escape(s) for s in siblings))
    return re.compile(rf"^\s*(?:import|from)\s+(?:{names})\b")


def first_load(text: str, siblings: set[str] = frozenset()) -> int | None:
    """The 0-based line of the script's first load of Python by path or import of a sibling; None if it has none."""
    sib = sibling_import(siblings)
    return next(
        (
            i
            for i, line in enumerate(text.splitlines())
            if not line.lstrip().startswith("#") and (LOAD.search(line) or (sib and sib.search(line)))
        ),
        None,
    )


def unguarded(text: str, siblings: set[str] = frozenset()) -> str | None:
    """None when the script loads nothing beside it, or sets the fresh prefix at module level before its first load;
    otherwise what is wrong, with line numbers."""
    load = first_load(text, siblings)
    if load is None:
        return None
    prefix = next((i for i, line in enumerate(text.splitlines()) if line.startswith(PREFIX)), None)
    if prefix is None:
        return f"loads Python beside it (line {load + 1}) and sets no fresh cache prefix"
    if prefix > load:
        return f"sets the prefix at line {prefix + 1}, after its first load at line {load + 1}"
    return None


def tracked(*specs: str) -> list[Path]:
    """Every tracked .py the pathspecs name that is not a test."""
    out = subprocess.run(["git", "-C", str(CORE), "ls-files", "-z", "--", *specs], capture_output=True, text=True).stdout
    return sorted(CORE / p for p in out.split("\0") if p and not Path(p).name.startswith("test"))


def bundled() -> list[Path]:
    return tracked("skills/*.py", "agents/*.py")


def core_tools() -> list[Path]:
    return tracked("tools/*.py")


def siblings_of(p: Path) -> set[str]:
    return {q.stem for q in p.parent.glob("*.py") if q != p and q.stem.isidentifier()}


def plant(src: Path) -> Path:
    """Mori-shin's plant_pyc.py, inline: other code under the source's own mtime and size."""
    st = src.stat()
    code = compile(f'raise SystemExit("PLANTED bytecode ran in place of {src.name}")\n', str(src), "exec")
    out = src.parent / "__pycache__" / f"{src.stem}.{sys.implementation.cache_tag}.pyc"
    out.parent.mkdir(exist_ok=True)
    out.write_bytes(_code_to_timestamp_pyc(code, int(st.st_mtime), st.st_size))
    return out


print("Every bundled script that loads Python beside it sets a fresh cache prefix first")
found = {}
for p in bundled():
    text = p.read_text(encoding="utf-8")
    if first_load(text, siblings_of(p)) is not None:
        found[p.relative_to(CORE).as_posix()] = unguarded(text, siblings_of(p))
for rel, why in sorted(found.items()):
    check(rel, why is None, why or "")
check("the property found the scripts it is about (a reader that finds nothing proves nothing)", len(found) >= 7, str(len(found)))

print("\nEvery core tool that loads Python beside it sets a fresh cache prefix first")
found_tools = {}
for p in core_tools():
    text = p.read_text(encoding="utf-8")
    if first_load(text, siblings_of(p)) is not None:
        found_tools[p.relative_to(CORE).as_posix()] = unguarded(text, siblings_of(p))
for rel, why in sorted(found_tools.items()):
    check(rel, why is None, why or "")
check("the property found the tools it is about (a reader that finds nothing proves nothing)", len(found_tools) >= 3,
      str(len(found_tools)))

print("\nThe check, watched to fail")
fg = (CORE / "skills/bonsai-garden-portrait/scripts/fill-greeting.py").read_text(encoding="utf-8")
no_prefix = "\n".join(line for line in fg.splitlines() if not line.startswith(PREFIX))
check("M1 the prefix line removed: refused", unguarded(no_prefix) is not None)
lines = fg.splitlines()
at = next((i for i, line in enumerate(lines) if line.startswith(PREFIX)), None)
moved = lines[:at] + lines[at + 1 :] + [lines[at]] if at is not None else []
check("M2 the prefix set after the first load: refused", bool(moved) and unguarded("\n".join(moved)) is not None,
      "fill-greeting.py sets no prefix to move")
check(
    "M3 a plain import of a sibling, with no path trick and no prefix: refused",
    unguarded("import sys\nimport portrait_lib\n", {"portrait_lib"}) is not None
    and unguarded("import sys\nimport json\n", {"portrait_lib"}) is None,
)

print("\nA planted cache beside a sibling is never read")
tmp = Path(tempfile.mkdtemp(prefix="no-planted-bytecode-"))
try:
    scripts = tmp / "scripts"
    shutil.copytree(CORE / "skills/bonsai-garden-portrait/scripts", scripts, ignore=shutil.ignore_patterns("__pycache__"))
    planted = plant(scripts / "portrait_lib.py")
    r = subprocess.run(
        [sys.executable, str(scripts / "make-canonical-portrait.py"), "--help"],
        capture_output=True,
        text=True,
        env={"PATH": "/usr/bin:/bin", "HOME": str(tmp)},
    )
    said = r.stdout + r.stderr
    check(
        "make-canonical-portrait.py beside a planted portrait_lib cache runs the sealed source, not the cache",
        "PLANTED" not in said,
        said.strip()[-300:],
    )
    check("...and the planted cache is the only bytecode there (nothing new written beside the scripts)",
          sorted(scripts.rglob("*.pyc")) == [planted], str(sorted(scripts.rglob("*.pyc"))))
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("\nA planted cache beside the builder is never read by the skill gate")
tmp = Path(tempfile.mkdtemp(prefix="no-planted-bytecode-tools-"))
try:
    (tmp / "tools").mkdir()
    for name in ("check-skill-conformance.py", "check-shintai-conformance.py"):  # the builder imports the second
        shutil.copy2(CORE / "tools" / name, tmp / "tools" / name)
    builder = tmp / "skills" / "bonsai-garden-core-plugin" / "scripts"
    builder.mkdir(parents=True)
    shutil.copy2(CORE / "skills" / "bonsai-garden-core-plugin" / "scripts" / "package.py", builder / "package.py")
    (tmp / "agents").mkdir()  # the builder finds core by these two markers
    shutil.copy2(CORE / "agents" / "registry.json", tmp / "agents" / "registry.json")
    (tmp / "skills" / "bonsai-garden-sign").mkdir()
    planted = plant(builder / "package.py")
    r = subprocess.run(
        [sys.executable, str(tmp / "tools" / "check-skill-conformance.py"), "--help"],
        capture_output=True,
        text=True,
        env={"PATH": "/usr/bin:/bin", "HOME": str(tmp)},
    )
    said = r.stdout + r.stderr
    check(
        "check-skill-conformance.py beside a planted cache of package.py runs the sealed builder, not the cache",
        "PLANTED" not in said and r.returncode == 0,
        said.strip()[-300:],
    )
    check(
        "...and the planted cache is the only bytecode there (nothing new written beside the tools or the builder)",
        sorted(tmp.rglob("*.pyc")) == [planted],
        str(sorted(tmp.rglob("*.pyc"))),
    )
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print(f"\n{'PASS' if ok_all else 'FAIL'}")
sys.exit(0 if ok_all else 1)
