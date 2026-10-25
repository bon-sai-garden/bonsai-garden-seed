#!/usr/bin/env python3
# ---
# id: 01M5N3SVWT9KC2JCJJ919PC7Z6
# title: test-check-prerequisite-versions — the release gate for the prerequisites' versions, against a planted world
# type: script
# tended-by: baisai
# created: 2026-10-23
# updated: 2026-10-25
# ---
"""test-check-prerequisite-versions.py — tools/check-prerequisite-versions.py (2026-10-23), offline.

A stub on loopback plays nodejs.org's index, python.org's release folders, GitHub's latest Git for Windows and uv
releases, and every link a planted README names (Claude Code's unversioned installer among them); each case plants one world and reads the gate's exit code and words. The gate's own
sources are pointed at the stub by its hidden flags; nothing leaves the machine. The live run, against the real sources
and README, is the release's own: the gate runs among its gates.

    python3 tools/test-check-prerequisite-versions.py            every case
    python3 tools/test-check-prerequisite-versions.py --gate <a copy of the gate>   the cases against another copy
"""

from __future__ import annotations

import http.server
import json
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
GATE = Path(sys.argv[sys.argv.index("--gate") + 1]).resolve() if "--gate" in sys.argv else HERE / "check-prerequisite-versions.py"

WORLD: dict = {}  # path -> (status, body, headers); the case sets it


class Stub(http.server.BaseHTTPRequestHandler):
    def _answer(self, body_too: bool):
        status, body, headers = WORLD.get(self.path, (404, b"not here", {}))
        if self.command == "HEAD" and WORLD.get("__refuse_head__") and self.path in WORLD["__refuse_head__"]:
            status, body, headers = 405, b"", {}
        self.send_response(status)
        for k, v in headers.items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body_too:
            self.wfile.write(body)

    def do_GET(self):
        self._answer(True)

    def do_HEAD(self):
        self._answer(False)

    def log_message(self, *a):
        pass


srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Stub)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}"


def listing(*names: str) -> bytes:
    return ("<html><body>" + "".join(f'<a href="{n}">{n}</a>\n' for n in names) + "</body></html>").encode()


def world(node="26.12.1", py="3.15.1", py_pre="3.16.0", git="2.56.0.windows.3", uv="0.13.5"):
    """Today's sources as the stub plays them (the links a README names are added by links_for)."""
    w = {
        "/node/index.json": (200, json.dumps([{"version": f"v{node}"}, {"version": "v24.9.0"}, {"version": "v26.1.0"}]).encode(), {}),
        "/py/": (200, listing("3.14.9/", f"{py}/", f"{py_pre}/", "2.7.18/"), {}),
        f"/py/{py}/": (200, listing(f"Python-{py}.tgz", f"python-{py}-macos11.pkg"), {}),
        f"/py/{py_pre}/": (200, listing(f"Python-{py_pre}a1.tgz"), {}),
        "/git/latest": (200, json.dumps({"tag_name": f"v{git}", "prerelease": False}).encode(), {}),
        "/uv/latest": (200, json.dumps({"tag_name": uv, "prerelease": False}).encode(), {}),
    }
    return w


def readme(node="26.12.1", py="3.15.1", git="2.56.0.windows.3", uv="0.13.5", extra="") -> str:
    # the shapes README uses: the host part is the stub's, the path keeps the real hosts' names the gate reads
    return (
        "# Start here\n\n```\n"
        f"curl -O {BASE}/nodejs.org/dist/v{node}/node-v{node}.pkg\n"
        f"curl -O {BASE}/www.python.org/ftp/python/{py}/python-{py}-macos11.pkg\n"
        f"curl -LO {BASE}/github.com/git-for-windows/git/releases/download/v{git}/Git-{git.replace('.windows.', '.')}-64-bit.exe\n"
        f"curl -LsSf {BASE}/astral.sh/uv/{uv}/install.sh -o uv-install.sh\n"
        f"curl -LsSf {BASE}/astral.sh/uv/{uv}/install.ps1 -o uv-install.ps1\n"
        f"curl -fsSL {BASE}/claude.ai/install.sh -o claude-install.sh\n"
        f"curl -fsSL {BASE}/claude.ai/install.cmd -o claude-install.cmd\n"
        "```\n\nCheck a seal at [the verify page](" + BASE + "/verify).\n" + extra
    )


def links_for(text: str) -> None:
    """Every link the planted README names answers 200 unless the case says otherwise."""
    import re

    for u in re.findall(r"https?://[^\s)\]>\"'`<]+", text):
        p = u[len(BASE) :]
        WORLD.setdefault(p, (200, b"x", {}))


def run(text: str) -> tuple[int, str]:
    with tempfile.TemporaryDirectory() as t:
        f = Path(t) / "README.md"
        f.write_text(text, encoding="utf-8")
        r = subprocess.run(
            [sys.executable, str(GATE), "--readme", str(f), "--node-index", f"{BASE}/node/index.json"]
            + ["--python-ftp", f"{BASE}/py/", "--git-latest", f"{BASE}/git/latest", "--uv-latest", f"{BASE}/uv/latest"],
            capture_output=True,
            text=True,
            timeout=120,
        )
        return r.returncode, r.stdout + r.stderr


CASES = []


def case(fn):
    CASES.append(fn)
    return fn


@case
def the_newest_everywhere_and_every_link_answering_passes():
    WORLD.clear(), WORLD.update(world())
    t = readme()
    links_for(t)
    rc, out = run(t)
    return (
        rc == 0
        and "ok, its curl lines name the newest (Node.js 26.12.1, Python 3.15.1, Git for Windows 2.56.0.windows.3, uv 0.13.5)"
        in out,
        out,
    )


@case
def an_older_node_python_or_git_on_a_curl_line_fails_each_named():
    WORLD.clear(), WORLD.update(world(node="26.13.0", py="3.15.2", git="2.57.0.windows.1"))
    WORLD.update({"/py/3.15.2/": (200, listing("Python-3.15.2.tgz", "python-3.15.2-macos11.pkg"), {})})
    WORLD["/py/"] = (200, listing("3.15.1/", "3.15.2/", "3.16.0/"), {})
    t = readme()
    links_for(t)
    rc, out = run(t)
    return (
        rc == 1
        and "Node.js: README line 4 names 26.12.1; the newest is 26.13.0" in out
        and "Python: README line 5 names 3.15.1; the newest is 3.15.2" in out
        and "Git for Windows: README line 6 names 2.56.0.windows.3; the newest is 2.57.0.windows.1" in out,
        out,
    )


@case
def a_python_folder_of_pre_releases_only_is_not_the_newest():
    WORLD.clear(), WORLD.update(world(py_pre="3.16.0"))
    t = readme()
    links_for(t)
    rc, out = run(t)
    return rc == 0 and "Python 3.15.1" in out and "3.16.0" not in out, out


@case
def a_newer_version_on_a_curl_line_is_not_a_finding_but_its_dead_link_is():
    WORLD.clear(), WORLD.update(world())
    t = readme(node="26.12.2")
    links_for(t)
    WORLD[f"/nodejs.org/dist/v26.12.2/node-v26.12.2.pkg"] = (404, b"", {})
    rc, out = run(t)
    return rc == 1 and "Node.js: README" not in out and "node-v26.12.2.pkg: HTTP 404, not 200" in out, out


@case
def a_program_no_curl_line_names_fails():
    WORLD.clear(), WORLD.update(world())
    t = "\n".join(ln for ln in readme().splitlines() if "git-for-windows" not in ln) + "\n"
    links_for(t)
    rc, out = run(t)
    return rc == 1 and "Git for Windows: no curl line in README names a version of it" in out, out


@case
def a_version_named_outside_a_curl_line_does_not_count():
    WORLD.clear(), WORLD.update(world())
    t = readme(extra=f"\nOlder notes: {BASE}/nodejs.org/dist/v20.0.0/ is gone.\n")
    links_for(t)
    rc, out = run(t)
    return rc == 0 and "Node.js: README" not in out, out


@case
def any_link_not_answering_200_fails_a_redirect_followed_and_a_head_refusal_asked_by_get():
    WORLD.clear(), WORLD.update(world())
    t = readme(extra=f"\nSee [moved]({BASE}/moved), [get-only]({BASE}/get-only) and [gone]({BASE}/gone).\n")
    links_for(t)
    WORLD["/moved"] = (308, b"", {"Location": f"{BASE}/verify"})
    WORLD["/get-only"] = (200, b"x", {})
    WORLD["__refuse_head__"] = ["/get-only"]
    WORLD["/gone"] = (410, b"", {})
    rc, out = run(t)
    return rc == 1 and "/gone: HTTP 410, not 200" in out and "/moved" not in out and "/get-only" not in out, out


@case
def a_source_that_does_not_answer_is_never_a_pass():
    results = []
    for path, what in (
        ("/node/index.json", "release index"),
        ("/py/", "release folder"),
        ("/git/latest", "Git for Windows"),
        ("/uv/latest", "uv release"),
    ):
        WORLD.clear(), WORLD.update(world())
        t = readme()
        links_for(t)
        WORLD[path] = (503, b"busy", {})
        rc, out = run(t)
        results.append((rc == 2 and "No answer is never a pass" in out and what in out, f"{path}: {rc} {out.strip()}"))
    return all(r[0] for r in results), "\n".join(r[1] for r in results)


@case
def a_source_that_answers_nonsense_is_never_a_pass():
    WORLD.clear(), WORLD.update(world())
    t = readme()
    links_for(t)
    WORLD["/git/latest"] = (200, json.dumps({"tag_name": "nightly"}).encode(), {})
    rc, out = run(t)
    return rc == 2 and "not vX.Y.Z.windows.N" in out, out


@case
def an_older_uv_on_either_installer_line_fails_each_named():
    WORLD.clear(), WORLD.update(world(uv="0.13.6"))
    t = readme(uv="0.13.5")
    links_for(t)
    rc, out = run(t)
    return (
        rc == 1
        and "uv: README line 7 names 0.13.5; the newest is 0.13.6" in out
        and "uv: README line 8 names 0.13.5; the newest is 0.13.6" in out,
        out,
    )


@case
def an_older_uv_on_one_line_only_fails_that_line():
    WORLD.clear(), WORLD.update(world())
    t = readme().replace("/uv/0.13.5/install.ps1", "/uv/0.13.4/install.ps1")
    links_for(t)
    rc, out = run(t)
    return rc == 1 and "uv: README line 8 names 0.13.4" in out and "line 7" not in out, out


@case
def a_readme_naming_no_uv_fails():
    WORLD.clear(), WORLD.update(world())
    t = "\n".join(ln for ln in readme().splitlines() if "astral.sh" not in ln) + "\n"
    links_for(t)
    rc, out = run(t)
    return rc == 1 and "uv: no curl line in README names a version of it (newest 0.13.5)" in out, out


@case
def a_uv_tag_with_a_leading_v_reads_as_its_version():
    WORLD.clear(), WORLD.update(world())
    WORLD["/uv/latest"] = (200, json.dumps({"tag_name": "v0.13.5"}).encode(), {})
    t = readme()
    links_for(t)
    rc, out = run(t)
    return rc == 0 and "uv 0.13.5" in out, out


@case
def a_uv_source_that_answers_nonsense_is_never_a_pass():
    WORLD.clear(), WORLD.update(world())
    t = readme()
    links_for(t)
    WORLD["/uv/latest"] = (200, json.dumps({"tag_name": "0.14"}).encode(), {})
    rc, out = run(t)
    return rc == 2 and "uv release is tagged '0.14', not X.Y.Z" in out, out


@case
def claude_codes_installer_is_asked_only_that_it_answers():
    WORLD.clear(), WORLD.update(world())
    t = readme()
    links_for(t)
    WORLD["/claude.ai/install.cmd"] = (404, b"", {})
    rc, out = run(t)
    return (
        rc == 1
        and "Claude Code: its installer " + BASE + "/claude.ai/install.cmd: HTTP 404, not 200" in out
        and "link " + BASE + "/claude.ai/install.cmd" not in out  # said once, by its name
        and "install.sh" not in out
        and "Claude Code: no curl line" not in out,
        out,
    )


@case
def claude_codes_installer_carries_no_version_and_is_not_required_one():
    WORLD.clear(), WORLD.update(world())
    t = "\n".join(ln for ln in readme().splitlines() if "claude.ai" not in ln) + "\n"
    links_for(t)
    rc, out = run(t)
    return rc == 0 and "Claude Code" not in out, out


# Python's newest is the newest a stranger can install (Tasai's call, 2026-10-25, his veto open: 3.15.2 went up as source
# and mobile only, while the macOS .pkg and the Windows .exe answered 404). A final release whose folder lacks an
# installer that README's curl lines fetch, for any platform, is not yet installable; the gate takes the release before.
WIN = "python-{v}-amd64.exe"


def both_platforms(py="3.15.1") -> str:
    """A README that fetches Python for a Mac and for Windows, as the real one does: the macOS line of readme() and an
    extra curl line for the Windows installer."""
    return readme(py=py, extra=f"\n```\ncurl -O {BASE}/www.python.org/ftp/python/{py}/{WIN.replace('{v}', py)}\n```\n")


def py_world(folders: dict) -> None:
    """Python's release folder as the case plays it: {version: [file names in it]}, newest last."""
    WORLD["/py/"] = (200, listing(*[f"{v}/" for v in folders]), {})
    for v, names in folders.items():
        WORLD[f"/py/{v}/"] = (200, listing(*names), {})


def full(v: str) -> list[str]:
    return [f"Python-{v}.tgz", f"python-{v}-macos11.pkg", WIN.replace("{v}", v)]


@case
def a_source_only_newest_release_is_not_yet_installable_and_the_one_before_it_is_the_newest():
    WORLD.clear(), WORLD.update(world())
    py_world({"3.15.1": full("3.15.1"), "3.15.2": ["Python-3.15.2.tgz", "Python-3.15.2.tar.xz"]})
    t = both_platforms()
    links_for(t)
    rc, out = run(t)
    return rc == 0 and "Python 3.15.1" in out and "the newest is 3.15.2" not in out, out


@case
def a_readme_older_than_the_newest_installable_still_fails():
    WORLD.clear(), WORLD.update(world())
    py_world({"3.15.1": full("3.15.1"), "3.15.2": full("3.15.2"), "3.15.3": ["Python-3.15.3.tgz"]})
    t = both_platforms()
    links_for(t)
    rc, out = run(t)
    return (
        rc == 1
        and "Python: README line 5 names 3.15.1; the newest is 3.15.2" in out
        and "Python: README line 16 names 3.15.1; the newest is 3.15.2" in out
        and "3.15.3" not in out.split("newest today:")[-1].split("\n")[0],
        out,
    )


@case
def a_newest_release_with_one_platforms_installer_only_is_not_yet_installable():
    WORLD.clear(), WORLD.update(world())
    py_world({"3.15.1": full("3.15.1"), "3.15.2": ["Python-3.15.2.tgz", "python-3.15.2-macos11.pkg"]})
    t = both_platforms()
    links_for(t)
    rc, out = run(t)
    return rc == 0 and "Python 3.15.1" in out, out


@case
def what_counts_as_installable_follows_the_installers_readme_fetches():
    # a README that fetches only the macOS installer needs only that one: the Windows .exe missing is not a finding
    WORLD.clear(), WORLD.update(world())
    py_world({"3.15.1": full("3.15.1"), "3.15.2": ["Python-3.15.2.tgz", "python-3.15.2-macos11.pkg"]})
    t = readme(py="3.15.1")
    links_for(t)
    rc, out = run(t)
    return rc == 1 and "Python: README line 5 names 3.15.1; the newest is 3.15.2" in out, out


def mutants() -> list[tuple[str, bool, str]]:
    """The installer rule, each guard removed from a copy of the gate: the cases above must then fail."""
    global GATE
    src = GATE.read_text(encoding="utf-8")
    out = []
    for name, anchor, repl, case_fn in (
        ("M1 the installers not asked at all", "        if missing:\n", "        if False:\n",
         a_source_only_newest_release_is_not_yet_installable_and_the_one_before_it_is_the_newest),
        ("M2 the first installer only", "for t in installers if", "for t in installers[:1] if",
         a_newest_release_with_one_platforms_installer_only_is_not_yet_installable),
        ("M3 the installers taken from no README", "    installers = python_installers(readme)\n",
         "    installers = []\n", a_newest_release_with_one_platforms_installer_only_is_not_yet_installable),
    ):
        if src.count(anchor) != 1:
            out.append((name, False, f"the anchor is not in the gate once: {anchor!r}"))
            continue
        with tempfile.TemporaryDirectory() as d:
            m = Path(d) / "check-prerequisite-versions.py"
            m.write_text(src.replace(anchor, repl), encoding="utf-8")
            keep, GATE = GATE, m
            try:
                ok, ev = case_fn()
            finally:
                GATE = keep
        out.append((f"{name}: {case_fn.__name__} fails on the mutant", not ok, ev))
    return out


def main() -> int:
    failed = 0
    for fn in CASES:
        try:
            ok, ev = fn()
        except Exception as e:  # a case that cannot run is a failed case
            ok, ev = False, repr(e)
        failed += not ok
        print(f"{'PASS' if ok else 'FAIL'}  {fn.__name__}")
        if not ok:
            for ln in str(ev).strip().splitlines()[:12]:
                print(f"        {ln}")
    n = len(CASES)
    for name, ok, ev in mutants():
        n += 1
        failed += not ok
        print(f"{'PASS' if ok else 'FAIL'}  {name}")
        if not ok:
            for ln in str(ev).strip().splitlines()[:6]:
                print(f"        {ln}")
    print(f"\n{n - failed}/{n} passed")
    srv.shutdown()
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
