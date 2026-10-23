#!/usr/bin/env python3
# ---
# id: 01M3953HDRJS6VR76NV0B0087Q
# title: audit-filenames.py — every file name is English and kebab-case
# type: script
# tended-by: baisai
# created: 2026-09-24
# updated: 2026-10-22
# ---
"""
audit-filenames.py — the file-name convention scanner.

Core's convention (AGENTS.md -> Conventions): file and folder names are English
and kebab-case; Japanese terms live inside files, never in names. This walks a
repo and reports every file name that breaks it:

  - non-ascii   a character outside basic Latin (cannot be fixed automatically)
  - uppercase   an upper-case letter
  - underscore  an underscore

Exempt: the conventional upper-case documents (CLAUDE.md, SKILL.md, README.md,
AGENTS.md, CHANGELOG.md, LICENSE) anywhere, an ALL-CAPS .md at the repo root (the
repo's contract documents), the .bonsaisig sidecar of any exempt file (which file a
sidecar seals is asked of core's one Node finder, lib/sidecar-format.mjs, never
worked out here: `.SKILL.md.bonsaisig` seals SKILL.md, the dot-prefixed sidecar change), *.bak
tombstones, .DS_Store, generated directories (node_modules, __pycache__, dist,
.build) and, unless --include-hidden, every hidden directory (.git, editor and
harness state). --allow NAME exempts one more file name (repeatable).

A Python port of the earlier audit-filenames.sh, so it runs wherever core does.
It writes nothing unless asked: --tsv writes the report as a table.

Usage:
    python3 audit-filenames.py [--root PATH] [--tsv FILE] [--refs] [--fix-dry-run]
                               [--include-hidden]

  --root            repo to audit (default: the git checkout around the current directory)
  --tsv FILE        also write path / issue / suggested-fix / ref-count as TSV
  --refs            count the text files that mention each offending name (slower)
  --fix-dry-run     print the git mv command for each fixable name; renames nothing

Exit codes: 0 no violations, 1 violations found, 2 tool failure.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

EXEMPT_NAMES = {"CLAUDE.md", "SKILL.md", "README.md", "AGENTS.md", "CHANGELOG.md", "LICENSE", ".DS_Store"}
ROOT_CONTRACT = re.compile(r"^[A-Z][A-Z0-9-]*\.md$")
LOCALE_SUFFIX = re.compile(r"_[a-z]{2}(?=\.[A-Za-z0-9]+$)")
EXEMPT_DIRS = {"node_modules", "__pycache__", ".git", "dist", ".build"}
REF_SUFFIXES = {".md", ".sh", ".js", ".mjs", ".py", ".ts", ".json", ".toml"}


def default_root() -> Path:
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
        if out.returncode == 0 and out.stdout.strip():
            return Path(out.stdout.strip())
    except OSError:
        pass
    return Path.cwd()


def issues_of(name: str) -> tuple[list[str], str]:
    """(issues, suggested name). The suggestion is [MANUAL-FIX] when it cannot be derived."""
    issues: list[str] = []
    fixed = name
    if any(ord(c) > 0x7F for c in name):
        issues.append("non-ascii")
        fixed = "[MANUAL-FIX]"
    if any("A" <= c <= "Z" for c in name):
        issues.append("uppercase")
        if fixed != "[MANUAL-FIX]":
            fixed = fixed.lower()
    # a two-letter locale suffix before the extension (heritage_de.html) marks a translation, one rule for every kin
    # (Bonsai's pot session, 2026-10-11); any other underscore is still a violation
    if "_" in LOCALE_SUFFIX.sub("", name):
        issues.append("underscore")
        if fixed != "[MANUAL-FIX]":
            fixed = fixed.replace("_", "-")
    return issues, fixed


def exempt(fn: str, at_root: bool, allow: set[str], parent: str = "") -> bool:
    # MEMORY.md is the memory index: the routines prescribe it and the garden MCP reads it by that name, in a memory/ directory
    return (
        fn in EXEMPT_NAMES
        or fn in allow
        or fn.endswith(".bak")
        or (fn == "MEMORY.md" and parent == "memory")
        or (at_root and ROOT_CONTRACT.match(fn) is not None)
    )


# The finder, asked rather than copied (the dot-prefixed sidecar change, Mori-shin's ruling: no fourth copy of the sidecar
# rule). The library's own tree holds it at skills/bonsai-garden-sign/lib/; an installed package carries the
# same file at scripts/integrity/bonsai-garden-sign/lib/. Found by walking up from here, by marker.
FINDER_REL = (
    Path("skills/bonsai-garden-sign/lib/sidecar-format.mjs"),
    Path("scripts/integrity/bonsai-garden-sign/lib/sidecar-format.mjs"),
)
TARGETS_JS = (
    "import fs from 'node:fs';\n"
    "const F = await import(process.argv[1]); const out = [];\n"
    "for (const p of JSON.parse(fs.readFileSync(0, 'utf8'))) {\n"
    "  try { out.push(F.targetPathFor(p)); } catch { out.push(null); }\n"
    "}\n"
    "console.log(JSON.stringify(out));\n"
)


def sidecar_finder() -> Path | None:
    for d in Path(__file__).resolve().parents:
        for rel in FINDER_REL:
            if (d / rel).is_file():
                return d / rel
    return None


def targets_of(sidecars: list[Path]) -> list[Path | None]:
    """The file each sidecar seals, by the Node finder's targetPathFor (None: not a sidecar, or a
    name it refuses to decide). Raises when the finder cannot be asked: a tool failure, never a guess."""
    if not sidecars:
        return []
    lib = sidecar_finder()
    if lib is None or shutil.which("node") is None:
        raise RuntimeError(
            "cannot tell which file a .bonsaisig seals: "
            + ("node not found" if lib else "core's lib/sidecar-format.mjs not found above this script")
        )
    r = subprocess.run(
        ["node", "--input-type=module", "-e", TARGETS_JS, lib.as_uri()],
        input=json.dumps([str(p) for p in sidecars]),
        capture_output=True,
        text=True,
        timeout=300,
    )
    if r.returncode:
        raise RuntimeError(f"the sidecar finder failed: {(r.stderr.strip().splitlines() or ['?'])[-1]}")
    return [Path(t) if t else None for t in json.loads(r.stdout)]


def walk(root: Path, include_hidden: bool, allow: set[str] = frozenset()) -> list[Path]:
    """Every file whose name is to be checked. A sidecar is exempt with the file it seals."""
    out: list[Path] = []
    sidecars: list[tuple[Path, bool]] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in EXEMPT_DIRS and (include_hidden or not d.startswith(".")))
        at_root = Path(dirpath) == root
        for fn in sorted(filenames):
            if fn.endswith(".bonsaisig") and fn != ".bonsaisig":
                sidecars.append((Path(dirpath) / fn, at_root))
            elif not exempt(fn, at_root, allow, Path(dirpath).name):
                out.append(Path(dirpath) / fn)
    for (sc, at_root), target in zip(sidecars, targets_of([p for p, _ in sidecars])):
        if target is None or not exempt(target.name, at_root, allow, target.parent.name):
            out.append(sc)
    return sorted(out)


def ref_count(name: str, texts: list[Path]) -> int:
    n = 0
    for t in texts:
        try:
            if name in t.read_text(encoding="utf-8", errors="ignore"):
                n += 1
        except OSError:
            pass
    return n


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        prog="audit-filenames.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--root", default=None)
    ap.add_argument("--tsv", default=None)
    ap.add_argument("--refs", action="store_true")
    ap.add_argument("--fix-dry-run", action="store_true")
    ap.add_argument("--include-hidden", action="store_true")
    ap.add_argument("--allow", action="append", default=[])
    a = ap.parse_args(argv)

    root = Path(a.root).resolve() if a.root else default_root().resolve()
    if not root.is_dir():
        print(f"audit-filenames: root is not a directory: {root}", file=sys.stderr)
        return 2
    files = walk(root, a.include_hidden, set(a.allow))
    texts = [f for f in files if f.suffix.lower() in REF_SUFFIXES] if a.refs else []

    rows: list[tuple[str, str, str, str]] = []
    for f in files:
        issues, fixed = issues_of(f.name)
        if not issues:
            continue
        rel = f.relative_to(root).as_posix()
        fixed_rel = (f.parent / fixed).relative_to(root).as_posix() if fixed != "[MANUAL-FIX]" else fixed
        refs = str(ref_count(f.name, texts)) if a.refs else "-"
        rows.append((rel, ",".join(issues), fixed_rel, refs))
        if a.fix_dry_run and fixed != "[MANUAL-FIX]":
            print(f"# git mv '{rel}' '{fixed_rel}'")

    if a.tsv:
        lines = ["path\tissue\tsuggested-fix\tref-count"] + ["\t".join(r) for r in rows]
        Path(a.tsv).write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"audit-filenames — {root}")
    print(f"files checked:    {len(files)}")
    print(f"violations found: {len(rows)}")
    for rel, issue, fixed_rel, refs in rows:
        print(f"  {rel}  [{issue}]  -> {fixed_rel}" + (f"  (refs: {refs})" if a.refs else ""))
    if a.tsv:
        print(f"report: {a.tsv}")
    return 1 if rows else 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as exc:  # a crash is a failure, never a pass
        print(f"audit-filenames crashed: {exc!r}", file=sys.stderr)
        sys.exit(2)
