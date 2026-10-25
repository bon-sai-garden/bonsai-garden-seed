#!/usr/bin/env python3
# ---
# id: 01M5N3SVRQ4W3E94YW18HTPSQT
# title: check-prerequisite-versions — the README's curl lines name the newest Node.js, Python, Git for Windows and uv, and every link answers
# type: script
# tended-by: baisai
# created: 2026-10-23
# updated: 2026-10-25
# ---
"""check-prerequisite-versions.py — at each release, the versions README.md tells a stranger to fetch are today's newest.

The gardener, 2026-10-23: "check that everytime we push a new version". README's *Start here* fetches
the programs a planting needs by curl (it names five), four at exact versions (Node.js, Python, Git for
Windows, uv); a version that was newest when the line was written goes stale while the release waits. This gate asks,
at the moment of the release:

  - Node.js: the newest release in https://nodejs.org/dist/index.json (the highest version; the index holds no pre-release);
  - Python: the newest final release under https://www.python.org/ftp/python/ that a stranger can install: the highest
    X.Y.Z directory that holds its final source archive, Python-X.Y.Z.tgz (a directory that holds only alphas, betas or
    release candidates is not one), and every installer README's curl lines fetch from python.org, by README's own file
    names with X.Y.Z in place of the version README names (the macOS .pkg and the Windows .exe today). A final release
    whose installer for one of those platforms is not up yet is not yet installable, and the release before is the newest
    (Tasai's call, 2026-10-25, the gardener's veto open: 3.15.2 went up as source and mobile only, while the macOS .pkg
    and the Windows .exe answered 404, and no README could pass);
  - Git for Windows: its latest release on GitHub (https://api.github.com/repos/git-for-windows/git/releases/latest,
    which counts no pre-release and no draft), the tag as vX.Y.Z.windows.N;
  - uv: its latest release on GitHub (https://api.github.com/repos/astral-sh/uv/releases/latest, the same rule), the
    tag as X.Y.Z, against the astral.sh/uv/<version>/install.sh and install.ps1 lines;
  - Claude Code: its installer (claude.ai/install.sh, install.cmd) is unversioned by design, always the newest, so it is
    asked only that it answers 200, and nothing else.

and FAILS when a README line that runs curl names an older version of one of them than that, or names none of one of
them, or when any http(s) link anywhere in README does not answer 200 (HEAD, redirects followed; a server that refuses
HEAD is asked by GET, one byte read). It reads README and nothing else, and never edits it.

    python3 tools/check-prerequisite-versions.py --root <repo> --rev <commit>
        README.md as that commit holds it, read from git, never the working tree: the form a release's gates run in
    python3 tools/check-prerequisite-versions.py --readme <file>
        a README on disk (a scratch copy, to watch it fail)

Exit 0: every source answered, every curl line names the newest, every link answered 200. 1: findings, each named (the
version README names, the newest, the line; or the link and what it answered). 2: could not check (a source that did not
answer or could not be read, no README): no answer is never a pass.
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

NODE_INDEX = "https://nodejs.org/dist/index.json"
PYTHON_FTP = "https://www.python.org/ftp/python/"
GIT_LATEST = "https://api.github.com/repos/git-for-windows/git/releases/latest"
UV_LATEST = "https://api.github.com/repos/astral-sh/uv/releases/latest"
TIMEOUT = 30
PY_TRIES = 8  # the newest directories looked into for a final archive, newest first
UA = {"User-Agent": "bonsai-garden-release-gate (check-prerequisite-versions.py)"}

# what a curl line names, per program: the version as it sits in the URL
NAMED = {
    "Node.js": re.compile(r"nodejs\.org/dist/v(\d+\.\d+\.\d+)/"),
    "Python": re.compile(r"python\.org/ftp/python/(\d+\.\d+\.\d+)/"),
    "Git for Windows": re.compile(r"git-for-windows/git/releases/download/v(\d+\.\d+\.\d+\.windows\.\d+)/"),
    "uv": re.compile(r"astral\.sh/uv/(\d+\.\d+\.\d+)/install\.(?:sh|ps1)\b"),
}
# unversioned by design: the installer at this address is always the newest, so it is asked to answer 200 and nothing else
UNVERSIONED = {"Claude Code": re.compile(r"claude\.ai/install\.(?:sh|cmd)\b")}
LINK = re.compile(r"https?://[^\s)\]>\"'`<]+")
# a file README fetches from python.org's release folder: the version, and the file's name
PY_FILE = re.compile(r"python\.org/ftp/python/(\d+\.\d+\.\d+)/([^\s)\]>\"'`<]+)")
NOTES: list[str] = []  # said beside the verdict: a final release passed over as not yet installable


class Refuse(Exception):
    """Could not check: exit 2, said."""


def vkey(v: str) -> tuple:
    """2.56.0.windows.3 → (2, 56, 0, 3); 26.12.1 → (26, 12, 1)."""
    return tuple(int(x) for x in re.findall(r"\d+", v))


class _Redirect(urllib.request.HTTPRedirectHandler):
    """Python 3.9's handler follows 301, 302, 303 and 307; a link that answers 308 is followed too."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if code == 308:
            code = 307
        return super().redirect_request(req, fp, code, msg, headers, newurl)

    def http_error_308(self, req, fp, code, msg, headers):
        return self.http_error_302(req, fp, code, msg, headers)


OPEN = urllib.request.build_opener(_Redirect)


def fetch(url: str, what: str) -> bytes:
    """A source's answer, 200 only; anything else refuses (exit 2)."""
    if not url.startswith(("https://", "http://127.0.0.1:", "http://localhost:")):
        raise Refuse(f"{what} is asked over https (plain http only on loopback, a test's stub): {url}")
    try:
        with OPEN.open(urllib.request.Request(url, headers=UA), timeout=TIMEOUT) as r:  # noqa: S310 (scheme held above)
            if r.status != 200:
                raise Refuse(f"{what} answered HTTP {r.status} ({url})")
            return r.read()
    except Refuse:
        raise
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise Refuse(f"{what} did not answer ({url}): {e}") from e


def newest_node(index: str) -> str:
    try:
        rows = json.loads(fetch(index, "nodejs.org's release index"))
        versions = [r["version"].lstrip("v") for r in rows if re.fullmatch(r"v\d+\.\d+\.\d+", r.get("version", ""))]
    except (ValueError, TypeError, AttributeError, KeyError) as e:
        raise Refuse(f"nodejs.org's release index cannot be read ({index}): {e}") from e
    if not versions:
        raise Refuse(f"nodejs.org's release index names no release ({index})")
    return max(versions, key=vkey)


def curl_lines(readme: str) -> list[tuple[int, str]]:
    return [(i, ln) for i, ln in enumerate(readme.splitlines(), 1) if re.search(r"(^|[\s`$(])curl\s", ln)]


def python_installers(readme: str) -> list[str]:
    """Each installer README's curl lines fetch from python.org, its version replaced by {v}: one per platform a
    stranger installs Python on (python-{v}-macos11.pkg and python-{v}-amd64.exe today)."""
    out = []
    for _i, ln in curl_lines(readme):
        for v, name in PY_FILE.findall(ln):
            t = name.replace(v, "{v}")
            if t not in out:
                out.append(t)
    return out


def newest_python(ftp: str, installers: list[str] = ()) -> str:
    """The highest final release whose folder holds every installer in `installers`: what a stranger can install."""
    ftp = ftp.rstrip("/") + "/"
    listing = fetch(ftp, "python.org's release folder").decode("utf-8", "replace")
    dirs = sorted(set(re.findall(r'href="(\d+\.\d+\.\d+)/"', listing)), key=vkey, reverse=True)
    if not dirs:
        raise Refuse(f"python.org's release folder lists no X.Y.Z folder ({ftp})")
    for v in dirs[:PY_TRIES]:
        inner = fetch(f"{ftp}{v}/", f"python.org's folder {v}").decode("utf-8", "replace")
        if not re.search(rf'href="Python-{re.escape(v)}\.tgz"', inner):
            continue
        missing = [n for n in (t.replace("{v}", v) for t in installers if t) if f'href="{n}"' not in inner]
        if missing:
            NOTES.append(f"Python {v} is final but not yet installable: no {', '.join(missing)} in its folder")
            continue
        return v
    raise Refuse(
        f"none of python.org's newest {PY_TRIES} folders ({', '.join(dirs[:PY_TRIES])}) holds a final release with "
        f"every installer README fetches ({', '.join(installers) or 'none named'})"
    )


def newest_git(latest: str) -> str:
    try:
        tag = json.loads(fetch(latest, "GitHub's latest Git for Windows release"))["tag_name"]
    except (ValueError, TypeError, KeyError) as e:
        raise Refuse(f"GitHub's latest Git for Windows release cannot be read ({latest}): {e}") from e
    m = re.fullmatch(r"v(\d+\.\d+\.\d+\.windows\.\d+)", tag or "")
    if not m:
        raise Refuse(f"GitHub's latest Git for Windows release is tagged {tag!r}, not vX.Y.Z.windows.N")
    return m.group(1)


def newest_uv(latest: str) -> str:
    try:
        tag = json.loads(fetch(latest, "GitHub's latest uv release"))["tag_name"]
    except (ValueError, TypeError, KeyError) as e:
        raise Refuse(f"GitHub's latest uv release cannot be read ({latest}): {e}") from e
    m = re.fullmatch(r"v?(\d+\.\d+\.\d+)", tag or "") if isinstance(tag, str) else None
    if not m:
        raise Refuse(f"GitHub's latest uv release is tagged {tag!r}, not X.Y.Z")
    return m.group(1)


def answers(url: str) -> str | None:
    """None when the link answers 200; else what it answered."""
    for method in ("HEAD", "GET"):
        try:
            with OPEN.open(urllib.request.Request(url, headers=UA, method=method), timeout=TIMEOUT) as r:  # noqa: S310
                if method == "GET":
                    r.read(1)
                if r.status == 200:
                    return None
                return f"HTTP {r.status}"
        except urllib.error.HTTPError as e:
            if method == "HEAD" and e.code in (403, 405, 501):
                continue  # a server that refuses HEAD is asked once by GET
            return f"HTTP {e.code}"
        except (urllib.error.URLError, OSError, ValueError) as e:
            return f"no answer ({getattr(e, 'reason', e)})"
    return "no answer"


def check(readme: str, newest: dict, ask=answers) -> list[str]:
    """Every finding, in README's order: an older version on a curl line, a program no curl line names, an unversioned
    installer that does not answer, a dead link."""
    out = []
    curl = curl_lines(readme)
    for prog, pat in NAMED.items():
        named = [(i, v) for i, ln in curl for v in pat.findall(ln)]
        if not named:
            out.append(f"{prog}: no curl line in README names a version of it (newest {newest[prog]})")
        for i, v in named:
            if vkey(v) < vkey(newest[prog]):
                out.append(f"{prog}: README line {i} names {v}; the newest is {newest[prog]}")
    links = list(dict.fromkeys(u.rstrip(".,;:") for u in LINK.findall(readme)))
    asked = set()
    for prog, pat in UNVERSIONED.items():
        for url in (u for u in links if pat.search(u)):
            asked.add(url)
            said = ask(url)
            if said:
                out.append(f"{prog}: its installer {url}: {said}, not 200 (unversioned by design: asked only that it answers)")
    for url in (u for u in links if u not in asked):
        said = ask(url)
        if said:
            out.append(f"link {url}: {said}, not 200")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=".", type=Path)
    ap.add_argument("--rev")
    ap.add_argument("--readme", type=Path)
    ap.add_argument("--node-index", default=NODE_INDEX, help=argparse.SUPPRESS)  # a test's stub; a release never passes them
    ap.add_argument("--python-ftp", default=PYTHON_FTP, help=argparse.SUPPRESS)
    ap.add_argument("--git-latest", default=GIT_LATEST, help=argparse.SUPPRESS)
    ap.add_argument("--uv-latest", default=UV_LATEST, help=argparse.SUPPRESS)
    a = ap.parse_args()
    try:
        if a.readme and a.rev:
            raise Refuse("--readme reads a file on disk; --rev reads a commit's README: name one")
        if a.rev:
            root = a.root.resolve()
            r = subprocess.run(["git", "-C", str(root), "show", f"{a.rev}:README.md"], capture_output=True)
            if r.returncode:
                raise Refuse(f"README.md at {a.rev} in {root}: {r.stderr.decode(errors='replace').strip()}")
            readme, where = r.stdout.decode("utf-8"), f"README.md at {root.name} {a.rev[:12]}"
        else:
            p = a.readme or (a.root / "README.md")
            try:
                readme, where = p.read_text(encoding="utf-8"), str(p)
            except OSError as e:
                raise Refuse(f"{p}: cannot be read ({e.strerror})") from e
        installers = python_installers(readme)
        newest = {
            "Node.js": newest_node(a.node_index),
            "Python": newest_python(a.python_ftp, installers),
            "Git for Windows": newest_git(a.git_latest),
            "uv": newest_uv(a.uv_latest),
        }
        found = check(readme, newest)
    except Refuse as e:
        print(f"check-prerequisite-versions: REFUSED, not checked: {e}. No answer is never a pass.", file=sys.stderr)
        return 2
    today = ", ".join(f"{k} {v}" for k, v in newest.items())
    for n in NOTES:
        print(f"check-prerequisite-versions: {n}")
    if found:
        print(f"check-prerequisite-versions: {where}: FAIL, {len(found)} finding(s); newest today: {today}")
        for f in found:
            print(f"  ✗ {f}")
        return 1
    print(f"check-prerequisite-versions: {where}: ok, its curl lines name the newest ({today}); every link answered 200")
    return 0


if __name__ == "__main__":
    sys.exit(main())
