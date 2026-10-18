#!/usr/bin/env python3
# ---
# id: 01M3953HB0Z4VVTD0YMRM72Y4N
# title: check-path-references.py — the path-breakage net
# type: script
# tended-by: baisai
# created: 2026-07-20
# updated: 2026-09-24
# ---
"""
check-path-references.py — the path-breakage net.

The metadata validator (`validate-metadata.py`, beside this script) checks the cross-reference
class that *survives* file moves: `related:` / `supersedes` / `superseded-by`
encode ULIDs, not paths. This tool checks the OTHER class — the one that
*breaks* when a file moves: hardcoded path references in prose, activation
pointers, and code imports.

It exists for refactor days. Run it once before a structural pass to capture a
clean baseline, then re-run after each move; any NEW dangling reference is the
breakage that move just produced.

Three reference classes are extracted and resolved against the filesystem:

  1. Markdown links   `[text](relative/or/repo/path.ext)`     — in .md files
  2. Backtick paths   `` `agents/<slug>/about-me.md` ``         — in .md files
                       (the activation-pointer + "see X" idiom; only tokens that
                        carry a real file extension and no placeholder chars)
  3. JS/TS imports    `import ... from './rel'` / `require(...)` — .mjs/.js/.astro
                       (relative specifiers only; bare + aliased are out of scope)

A reference is "dangling" when its target resolves to no file (and, for a
directory-looking target, no directory) under the repo root.

Baseline workflow (the monitoring use-case):
    # before the refactor — record what is already dangling:
    python3 check-path-references.py --write-baseline .path-ref-baseline.json
    # during/after the refactor — only NEW dangling refs fail:
    python3 check-path-references.py --baseline .path-ref-baseline.json

Usage:
    python3 check-path-references.py [--root PATH] [--json]
        [--baseline FILE] [--write-baseline FILE] [--include-history]
        [--history-prefix PREFIX ...]

--root defaults to the git checkout around the current directory (the repo being
checked, never this script's own).

Exit codes:
    0  no dangling references beyond the baseline
    1  dangling references found beyond the baseline
    2  tool failure
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

# --- Paths -----------------------------------------------------------------


def default_root() -> Path:
    import subprocess

    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
        if out.returncode == 0 and out.stdout.strip():
            return Path(out.stdout.strip())
    except OSError:
        pass
    return Path.cwd()


SCAN_SUFFIXES = (".md", ".mjs", ".js", ".astro")

# Episodic history — append-only, point-in-time records. They legitimately
# reference paths as they were at the time of writing; a later move does not
# make them "wrong". Excluded by default so the breakage signal stays on
# load-bearing docs. Override with --include-history. A garden adds its own
# history folders with --history-prefix.
HISTORY_MARKERS = ("/memory/journal/", "diary/logs/", "diary/observations/", "/snapshots/")
HISTORY_PREFIXES: tuple[str, ...] = ()


def _is_history(rel: str, prefixes: tuple[str, ...] = ()) -> bool:
    return any(m in rel for m in HISTORY_MARKERS) or any(rel.startswith(pre) for pre in (*HISTORY_PREFIXES, *prefixes))


# File extensions we are confident name a real on-disk artifact. A backtick or
# markdown-link token must end in one of these to be treated as a path claim;
# this is the main false-positive guard for the fuzzy backtick class.
PATH_EXTS = (
    ".md",
    ".mjs",
    ".js",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".astro",
    ".py",
    ".json",
    ".css",
    ".html",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".txt",
    ".sh",
    ".yaml",
    ".yml",
    ".toml",
    ".stl",
    ".scad",
    ".pdf",
    ".vcf",
    ".mjs",
    ".plugin",
)

# Tokens containing any of these are placeholders / templates / globs / vars —
# never a concrete path, so we never flag them as dangling.
PLACEHOLDER_CHARS = set("<>*{}$ \t\n")


def _is_external(target: str) -> bool:
    t = target.strip()
    return (
        t.startswith(("http://", "https://", "mailto:", "tel:", "data:", "#", "//"))
        or ":" in t.split("/")[0]  # scheme-like prefix
    )


def _looks_like_path_token(token: str) -> bool:
    """True for backtick tokens that make a concrete repo-path claim."""
    t = token.strip()
    if not t or "/" not in t:
        return False
    if any(c in PLACEHOLDER_CHARS for c in t):
        return False
    if _is_external(t):
        return False
    # Must carry a known file extension to count as a path claim.
    return any(t.lower().endswith(ext) for ext in PATH_EXTS)


# --- Reference extraction --------------------------------------------------

MD_LINK_RE = re.compile(r"\[(?P<text>[^\]]*)\]\((?P<target>[^)\s]+)(?:\s+\"[^\"]*\")?\)")
BACKTICK_RE = re.compile(r"`([^`\n]+)`")
IMPORT_FROM_RE = re.compile(r"""(?:import|export)\b[^;\n]*?\bfrom\s*['"]([^'"]+)['"]""")
IMPORT_BARE_RE = re.compile(r"""\bimport\s*['"]([^'"]+)['"]""")
REQUIRE_RE = re.compile(r"""\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)""")
DYN_IMPORT_RE = re.compile(r"""\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)""")


@dataclass(frozen=True)
class Ref:
    src: str  # repo-relative source file
    line: int  # 1-based line number
    kind: str  # "md-link" | "backtick" | "import"
    target: str  # the raw reference token


def _line_of(text: str, idx: int) -> int:
    return text.count("\n", 0, idx) + 1


def extract_refs(rel_path: str, text: str) -> list[Ref]:
    refs: list[Ref] = []
    suffix = Path(rel_path).suffix.lower()

    if suffix == ".md":
        for m in MD_LINK_RE.finditer(text):
            target = m.group("target")
            if _is_external(target):
                continue
            if any(c in PLACEHOLDER_CHARS for c in target):
                continue
            refs.append(Ref(rel_path, _line_of(text, m.start()), "md-link", target))
        for m in BACKTICK_RE.finditer(text):
            token = m.group(1)
            if _looks_like_path_token(token):
                refs.append(Ref(rel_path, _line_of(text, m.start()), "backtick", token))

    if suffix in (".mjs", ".js", ".astro"):
        for rx in (IMPORT_FROM_RE, IMPORT_BARE_RE, REQUIRE_RE, DYN_IMPORT_RE):
            for m in rx.finditer(text):
                spec = m.group(1)
                # Only relative specifiers point at repo files; bare ("jszip",
                # "node:fs") and aliased ("@/lib/x") are out of scope.
                if spec.startswith("."):
                    refs.append(Ref(rel_path, _line_of(text, m.start()), "import", spec))

    return refs


# --- Resolution ------------------------------------------------------------

IMPORT_RESOLUTIONS = ("", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", "/index.js", "/index.mjs", "/index.ts")


def _strip_fragment(target: str) -> str:
    return target.split("#", 1)[0].split("?", 1)[0]


def resolves(ref: Ref, root: Path) -> bool:
    raw = _strip_fragment(ref.target).strip()
    if not raw:
        return True  # pure anchor / query — not a path claim

    src_dir = (root / ref.src).resolve().parent

    if ref.kind == "import":
        bases = [src_dir]
        candidates = bases
        for base in candidates:
            for ext in IMPORT_RESOLUTIONS:
                p = (
                    (base / (raw + ext))
                    if ext and not ext.startswith("/")
                    else (base / (raw.rstrip("/") + ext))
                    if ext
                    else (base / raw)
                )
                try:
                    if p.exists():
                        return True
                except OSError:
                    pass
        return False

    # md-link + backtick: try repo-root-relative first (the garden idiom),
    # then file-relative. A trailing-slash dir target resolves if the dir exists.
    candidates = [root / raw, src_dir / raw]
    for p in candidates:
        try:
            if p.exists():
                return True
        except OSError:
            pass
    return False


# --- Discovery -------------------------------------------------------------

_PRUNE_DIRS = {"node_modules", ".git", ".astro", ".obsidian", "dist", "__pycache__"}


def discover(root: Path, include_history: bool = False, history_prefixes: tuple[str, ...] = ()) -> list[Path]:
    import os

    out: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root, onerror=lambda e: None):
        # Prune heavy / hidden dirs in place so os.walk never descends them.
        dirnames[:] = [d for d in dirnames if d not in _PRUNE_DIRS and not d.startswith(".")]
        for fn in filenames:
            if fn.endswith(".md.bak"):
                continue
            if Path(fn).suffix.lower() not in SCAN_SUFFIXES:
                continue
            fp = Path(dirpath) / fn
            try:
                if fp.is_symlink() or not fp.is_file():
                    continue
            except OSError:
                continue
            rel = fp.relative_to(root).as_posix()
            if not include_history and _is_history(rel, history_prefixes):
                continue
            out.append(fp)
    return sorted(out)


# --- Main ------------------------------------------------------------------


def _baseline_key(d: dict) -> tuple:
    return (d["src"], d["kind"], d["target"])


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="check-path-references.py")
    ap.add_argument("--root", default=None, help="repo to check (default: the git checkout around cwd)")
    ap.add_argument(
        "--history-prefix",
        action="append",
        default=[],
        help="a path prefix holding point-in-time records, excluded like journals (repeatable)",
    )
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--baseline", help="JSON file of known-dangling refs to ignore")
    ap.add_argument("--write-baseline", help="write all current dangling refs here and exit 0")
    ap.add_argument(
        "--include-history", action="store_true", help="also scan journals / logs / TODO history (excluded by default)"
    )
    args = ap.parse_args(argv)

    root = Path(args.root).resolve() if args.root else default_root().resolve()
    if not root.is_dir():
        print(f"check-path-references: root not a directory: {root}", file=sys.stderr)
        return 2

    files = discover(root, include_history=args.include_history, history_prefixes=tuple(args.history_prefix))
    all_refs = 0
    dangling: list[Ref] = []
    for path in files:
        rel = path.relative_to(root).as_posix()
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for ref in extract_refs(rel, text):
            all_refs += 1
            if not resolves(ref, root):
                dangling.append(ref)

    dangling_dicts = [asdict(r) for r in dangling]

    if args.write_baseline:
        Path(args.write_baseline).write_text(
            json.dumps(sorted(dangling_dicts, key=_baseline_key), indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"baseline written: {len(dangling_dicts)} dangling ref(s) → {args.write_baseline}")
        return 0

    baseline_keys: set[tuple] = set()
    if args.baseline:
        try:
            data = json.loads(Path(args.baseline).read_text(encoding="utf-8"))
            baseline_keys = {_baseline_key(d) for d in data}
        except (OSError, json.JSONDecodeError, KeyError) as exc:
            print(f"check-path-references: could not read baseline: {exc}", file=sys.stderr)
            return 2

    new_dangling = [d for d in dangling_dicts if _baseline_key(d) not in baseline_keys]

    if args.json:
        print(
            json.dumps(
                {
                    "files_scanned": len(files),
                    "references_checked": all_refs,
                    "dangling_total": len(dangling_dicts),
                    "baseline_ignored": len(dangling_dicts) - len(new_dangling),
                    "dangling_new": new_dangling,
                },
                indent=2,
            )
        )
        return 1 if new_dangling else 0

    print("check-path-references — the path-breakage net")
    print(f"root:               {root}")
    print(f"files scanned:      {len(files)}")
    print(f"references checked: {all_refs}")
    print(f"dangling (total):   {len(dangling_dicts)}")
    if baseline_keys:
        print(f"baseline ignored:   {len(dangling_dicts) - len(new_dangling)}")
    print(f"dangling (new):     {len(new_dangling)}")
    print()
    if new_dangling:
        by_kind: dict[str, int] = {}
        for d in new_dangling:
            by_kind[d["kind"]] = by_kind.get(d["kind"], 0) + 1
        print("new dangling by kind:", ", ".join(f"{k}={v}" for k, v in sorted(by_kind.items())))
        print()
        for d in sorted(new_dangling, key=_baseline_key):
            print(f"  {d['src']}:{d['line']}  [{d['kind']}]  →  {d['target']}")
        print()
        print(f"✗ {len(new_dangling)} new dangling path reference(s)")
        return 1
    print("✓ no new dangling path references")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as exc:  # top-level safety net
        print(f"check-path-references crashed: {exc!r}", file=sys.stderr)
        sys.exit(2)
