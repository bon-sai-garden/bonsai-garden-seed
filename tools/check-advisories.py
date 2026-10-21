#!/usr/bin/env python3
# ---
# id: 01M5DP678K27RXK60FNCPXFJR7
# title: check-advisories — no pinned version a cut ships has a published advisory, and no answer is never a pass
# type: script
# tended-by: baisai
# created: 2026-10-21
# updated: 2026-10-21
# ---
"""check-advisories.py — every version a pin file holds, asked of the OSV advisory database (osv.dev) today.

A cut is checked when it is made, and the world moves while it waits: on 2026-10-20 ten advisories were published
between an audit in the morning and the cuts in the evening (Pillow 12.3.0 in a requirements.txt, certifi 2026.5.20 in
a uv.lock). This gate asks at the moment of the cut. What goes out is each package's name, ecosystem and version (public
data, nothing else); what comes back is the ids of the advisories that affect that version.

    python3 tools/check-advisories.py [--root <repo>] [--rev <rev>] [<file>...]
        no files: every tracked pin file. --rev reads that commit's files from git, never the working tree:
        tools/distro/build-distro.mjs runs a slice's gates as `--root <upstream> --rev <commit>`. Named files (relative
        to --root) are checked as they are on disk: runtime's build-rt.mjs writes the files a cut ships to a scratch and
        names them, and a named file that is not a pin file is passed over.

A pin file, by name: requirements*.txt, uv.lock (every fork: each version the lock holds is asked), package-lock.json
and npm-shrinkwrap.json. Each must be readable as exact versions: a requirement that is a range, an option line other
than --hash (a -r include, -e, an index), a lock entry from a source other than the registry (git, url, path), or an
npm lock without "packages" cannot be checked by version and refuses. A uv.lock is read by its own shape (a [[package]]
table opens with name, version and source); on Python 3.11 or newer the same file is also read with tomllib, and two
readings that differ refuse.

Exit 0: the service answered, and no pinned version has a published advisory. 1: advisories (each name, version and
ids, with the fixed version where the advisory names one). 2: could not check: no answer from the service (a timeout,
an error, an answer that cannot be read), an unreadable pin file, a pin that is not exact. Never 0 without an answer.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

OSV = "https://api.osv.dev/v1"
BATCH = 500  # OSV's querybatch takes up to 1000 queries
TIMEOUT = 30
DETAILS = 60  # advisories read in full for the report (fixed version, severity); every hit refuses either way


class Refuse(Exception):
    """Cannot check: exit 2, said."""


def is_pin_file(rel: str) -> bool:
    name = rel.rsplit("/", 1)[-1]
    return name in ("uv.lock", "package-lock.json", "npm-shrinkwrap.json") or bool(
        re.fullmatch(r"requirements[^/]*\.txt", name)
    )


def git(root: Path, *args: str) -> bytes:
    r = subprocess.run(["git", "-C", str(root), *args], capture_output=True)
    if r.returncode:
        raise Refuse(f"git {' '.join(args[:2])} failed in {root}: {r.stderr.decode(errors='replace').strip()}")
    return r.stdout


# ── readers: each returns [(ecosystem, name, version)] ──────────────────────────────────────────────────────────────


def read_requirements(rel: str, text: str) -> list:
    out = []
    joined = re.sub(r"\\\r?\n", " ", text)  # a backslash continues a line (the --hash form)
    for n, raw in enumerate(joined.splitlines(), 1):
        line = re.sub(r"(^|\s)#.*$", "", raw).strip()
        if not line:
            continue
        line = re.sub(r"\s--hash[=\s]\S+", "", " " + line).strip()  # a hash pins the bytes; the version is checked
        m = re.fullmatch(r"([A-Za-z0-9][A-Za-z0-9._\-]*)(\[[^\]]*\])?\s*==\s*([0-9][^\s;,]*)\s*(;.*)?", line)
        if not m or "*" in m.group(3):
            raise Refuse(f"{rel}:{n}: not an exact pin, so it cannot be checked by version: {raw.strip()}")
        out.append(("PyPI", m.group(1), m.group(3)))
    return out


HEAD = re.compile(r'^(name|version) = "([^"]*)"$')
SOURCE = re.compile(r'^source = \{ (\w+) = "[^"]*"')


def read_uv_lock(rel: str, text: str) -> list:
    """uv.lock by its own shape: a [[package]] table opens with `name`, `version` and `source` at the start of a line;
    any other table header ends that head. Only registry packages are asked; the project's own (virtual, editable) are
    the code itself; any other source cannot be checked by version."""
    pkgs, cur = [], None
    for line in text.splitlines():
        if line == "[[package]]":
            cur = {}
            pkgs.append(cur)
        elif line.startswith("["):
            cur = None
        elif cur is not None:
            m = HEAD.match(line) or SOURCE.match(line)
            if m:
                key = m.group(1) if m.re is HEAD else "source"
                if key in cur:
                    raise Refuse(f"{rel}: a [[package]] table names {key} twice")
                cur[key] = m.group(2) if m.re is HEAD else m.group(1)
    out = []
    for p in pkgs:
        if "name" not in p or "source" not in p:
            raise Refuse(f"{rel}: a [[package]] table without a name or a source: {p}")
        if p["source"] in ("virtual", "editable"):
            continue
        if p["source"] != "registry":
            raise Refuse(f"{rel}: {p['name']} comes from a {p['source']} source and cannot be checked by version")
        if "version" not in p:
            raise Refuse(f"{rel}: {p['name']} has no version")
        out.append(("PyPI", p["name"], p["version"]))
    if not pkgs:
        raise Refuse(f"{rel}: no [[package]] table: not a uv.lock this gate can read")
    try:
        import tomllib  # Python 3.11 or newer: the same file read a second way, and the two must agree
    except ImportError:
        return out
    try:
        doc = tomllib.loads(text)
    except tomllib.TOMLDecodeError as e:
        raise Refuse(f"{rel}: not TOML: {e}") from e
    second = sorted(
        ("PyPI", p["name"], p.get("version"))
        for p in doc.get("package", [])
        if next(iter(p.get("source", {})), None) not in ("virtual", "editable")
    )
    if second != sorted(out):
        raise Refuse(f"{rel}: read two ways, the lock differs ({len(out)} and {len(second)} entries): refusing")
    return out


def read_npm_lock(rel: str, text: str) -> list:
    try:
        doc = json.loads(text)
    except ValueError as e:
        raise Refuse(f"{rel}: not JSON: {e}") from e
    pk = doc.get("packages")
    if not isinstance(pk, dict):
        raise Refuse(f'{rel}: no "packages" (lockfileVersion {doc.get("lockfileVersion")}): cannot be read by version')
    out = []
    for key, v in pk.items():
        if not key or v.get("link"):
            continue  # the project itself, or a link to a folder in it
        if not v.get("version"):
            raise Refuse(f"{rel}: {key} has no version")
        out.append(("npm", v.get("name") or key.rsplit("node_modules/", 1)[-1], v["version"]))
    return out


def pins_of(rel: str, data: bytes) -> list:
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as e:
        raise Refuse(f"{rel}: not UTF-8 text") from e
    name = rel.rsplit("/", 1)[-1]
    if name == "uv.lock":
        return read_uv_lock(rel, text)
    if name in ("package-lock.json", "npm-shrinkwrap.json"):
        return read_npm_lock(rel, text)
    return read_requirements(rel, text)


# ── the service ─────────────────────────────────────────────────────────────────────────────────────────────────────


def ask(url: str, body: dict | None = None) -> dict:
    if not url.startswith(("https://", "http://127.0.0.1:", "http://localhost:")):
        raise Refuse(f"the advisory service is asked over https (plain http only on loopback, a test's stub): {url}")
    data = json.dumps(body).encode() if body is not None else None
    # S310: the scheme is held two lines above, https or a loopback stub, never file: or another
    req = urllib.request.Request(url, data, {"Content-Type": "application/json"} if data else {})  # noqa: S310
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:  # noqa: S310
            if r.status != 200:
                raise Refuse(f"the advisory service answered HTTP {r.status} ({url})")
            return json.loads(r.read())
    except Refuse:
        raise
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise Refuse(f"the advisory service did not answer ({url}): {e}") from e


def advisories(pins: list, base: str) -> dict:
    """{(eco, name, version): [ids]} for every pinned version an advisory affects."""
    hits = {}
    for i in range(0, len(pins), BATCH):
        chunk = pins[i : i + BATCH]
        q = [{"package": {"ecosystem": e, "name": n}, "version": v} for e, n, v in chunk]
        res = ask(f"{base}/querybatch", {"queries": q}).get("results")
        if not isinstance(res, list) or len(res) != len(chunk):
            raise Refuse(f"the advisory service answered {len(res or [])} results for {len(chunk)} questions")
        for pin, r in zip(chunk, res):
            ids = [x["id"] for x in (r or {}).get("vulns", [])]
            if ids:
                hits[pin] = ids
    return hits


def detail(base: str, vid: str, name: str) -> tuple[bool, str]:
    """(withdrawn, a short note: severity and the fixed version) for one advisory; (False, "") when it cannot be read."""
    try:
        d = ask(f"{base}/vulns/{vid}")
    except Refuse:
        return False, ""
    sev = (d.get("database_specific") or {}).get("severity") or ""
    fixed = sorted(
        {
            ev["fixed"]
            for a in d.get("affected", [])
            if (a.get("package") or {}).get("name", "").lower() == name.lower()
            for rg in a.get("ranges", [])
            for ev in rg.get("events", [])
            if "fixed" in ev
        }
    )
    note = ", ".join(x for x in (sev.lower(), f"fixed in {' / '.join(fixed)}" if fixed else "") if x)
    return bool(d.get("withdrawn")), note


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=".", type=Path)
    ap.add_argument("--rev")
    ap.add_argument("--osv-url", default=OSV, help=argparse.SUPPRESS)  # a test's stub; the cut never passes it
    ap.add_argument("files", nargs="*")
    a = ap.parse_args()
    root = a.root.resolve()
    try:
        if a.rev:
            if a.files:
                raise Refuse("--rev reads the commit's own pin files: name no files with it")
            commit = git(root, "rev-parse", "--verify", f"{a.rev}^{{commit}}").decode().strip()
            rels = [
                r for r in git(root, "ls-tree", "-r", "--name-only", commit).decode().splitlines() if is_pin_file(r)
            ]
            where = f"{root.name} {commit[:12]}"
            files = {r: git(root, "show", f"{commit}:{r}") for r in rels}
        else:
            rels = (
                [r for r in a.files if is_pin_file(r)]
                if a.files
                else [r for r in git(root, "ls-files").decode().splitlines() if is_pin_file(r)]
            )
            where = str(root)
            files = {}
            for r in rels:
                try:
                    files[r] = (root / r).read_bytes()
                except OSError as e:
                    raise Refuse(f"{r}: cannot be read ({e.strerror})") from e
        pins = sorted({p for r in rels for p in pins_of(r, files[r])})
        if not pins:
            print(f"check-advisories: {where}: {len(rels)} pin file(s), no pinned version to ask about")
            return 0
        hits = advisories(pins, a.osv_url.rstrip("/"))
    except Refuse as e:
        print(f"check-advisories: REFUSED, not checked: {e}. No answer is never a pass.", file=sys.stderr)
        return 2
    notes, shown = {}, 0
    for (_, n, _), ids in sorted(hits.items()):
        for vid in ids:
            if shown < DETAILS:
                notes[(n, vid)] = detail(a.osv_url.rstrip("/"), vid, n)
                shown += 1
    live = {}
    for pin, ids in hits.items():
        keep = [i for i in ids if not notes.get((pin[1], i), (False, ""))[0]]  # a withdrawn advisory is not one
        if keep:
            live[pin] = keep
    print(
        f"check-advisories: {where}: {len(rels)} pin file(s) ({', '.join(rels)}), {len(pins)} pinned versions, "
        f"{len(live)} with a published advisory (osv.dev)"
    )
    for (eco, n, v), ids in sorted(live.items()):
        print(
            f"  {eco} {n} {v}: "
            + "; ".join(f"{i}" + (f" ({notes[(n, i)][1]})" if notes.get((n, i), (0, ""))[1] else "") for i in ids)
        )
    return 1 if live else 0


if __name__ == "__main__":
    sys.exit(main())
