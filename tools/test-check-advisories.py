#!/usr/bin/env python3
# ---
# id: 01M5DP67AS6VVCX371JDTXPF96
# title: test-check-advisories — the advisory gate against a stub of the service, every refusal planted and watched
# type: script
# tended-by: baisai
# created: 2026-10-21
# updated: 2026-10-21
# ---
"""test-check-advisories.py: tools/check-advisories.py against a stub of OSV's API on loopback, never the real one.

Each case plants a pin file (or a commit) and a behaviour of the service, and reads the gate's exit and words: an
advisory refuses (1), a clean set passes (0), and every way of not knowing refuses (2): no answer, an error, an answer
that cannot be read or does not fit the question, a pin that is not exact, a lock entry that cannot be asked about by
version. A pass needs an answer.

    python3 tools/test-check-advisories.py [--gate <check-advisories.py>]

--gate tests another file (a mutant, or the one before a change, to watch the cases fail). Exit 0 all held, 1 not.
"""

from __future__ import annotations

import http.server
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

HERE = Path(__file__).resolve()
GATE = (
    Path(sys.argv[sys.argv.index("--gate") + 1]).resolve()
    if "--gate" in sys.argv
    else HERE.parent / "check-advisories.py"
)
TMP = Path(tempfile.mkdtemp(prefix="advisories-test-", dir=os.environ.get("KEYS_TEST_TMP") or None))

# the stub's state: what it says, and what it was asked
STUB = {"mode": "ok", "affected": {}, "details": {}, "asked": []}


class Stub(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, code, body):
        b = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        q = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        STUB["asked"].append(q)
        m = STUB["mode"]
        if m == "500":
            return self.reply(500, {"error": "down"})
        if m == "garbage":
            return self.reply(200, b"<html>not json")
        res = [
            {
                "vulns": [
                    {"id": i}
                    for i in STUB["affected"].get((x["package"]["ecosystem"], x["package"]["name"], x["version"]), [])
                ]
            }
            for x in q["queries"]
        ]
        if m == "short":
            res = res[:-1]
        return self.reply(200, {"results": res})

    def do_GET(self):
        vid = self.path.rsplit("/", 1)[-1]
        d = STUB["details"].get(vid)
        return self.reply(200, d) if d else self.reply(404, {"code": 5})


srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Stub)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{srv.server_address[1]}/v1"
with socket.socket() as s:  # a port nothing listens on: the service that does not answer
    s.bind(("127.0.0.1", 0))
    DEAD = f"http://127.0.0.1:{s.getsockname()[1]}/v1"

passed = failed = 0


def check(name, ok, why=""):
    global passed, failed
    passed, failed = passed + bool(ok), failed + (not ok)
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + ("" if ok or not why else f"\n      {str(why)[-600:]}"))


def stub(mode="ok", affected=None, details=None):
    STUB.update(mode=mode, affected=affected or {}, details=details or {}, asked=[])


def gate(root, *args, url=URL):
    r = subprocess.run(
        [sys.executable, str(GATE), "--osv-url", url, "--root", str(root), *args], capture_output=True, text=True
    )
    return r.returncode, r.stdout + r.stderr


def folder(name, files):
    d = TMP / name
    d.mkdir(parents=True)
    for rel, text in files.items():
        (d / rel).parent.mkdir(parents=True, exist_ok=True)
        (d / rel).write_text(text)
    return d


def asked():
    return sorted(
        (x["package"]["ecosystem"], x["package"]["name"], x["version"])
        for q in STUB["asked"]
        for x in q.get("queries", [])
    )


REQ = "# a comment\nPillow==12.3.0\ncryptography==50.0.0 ; python_version >= '3.9'  # with a marker\n"
CERTIFI = "GHSA-6q48-6c7w-9gw2"
UVLOCK = """version = 1
revision = 3
requires-python = ">=3.10"
resolution-markers = [
    "python_full_version >= '3.11'",
    "python_full_version < '3.11'",
]

[[package]]
name = "certifi"
version = "2026.5.20"
source = { registry = "https://pypi.org/simple" }
sdist = { url = "https://example.invalid/certifi.tar.gz", hash = "sha256:00", size = 1 }

[[package]]
name = "starlette"
version = "1.7.0"
source = { registry = "https://pypi.org/simple" }
resolution-markers = [
    "python_full_version < '3.11'",
]
dependencies = [
    { name = "anyio" },
]

[[package]]
name = "starlette"
version = "1.9.0"
source = { registry = "https://pypi.org/simple" }
resolution-markers = [
    "python_full_version >= '3.11'",
]

[[package]]
name = "the-project"
version = "1.2.1"
source = { editable = "." }
dependencies = [
    { name = "certifi" },
]

[package.metadata]
requires-dist = [{ name = "certifi" }]
"""
NPM = json.dumps(
    {
        "name": "x",
        "lockfileVersion": 3,
        "packages": {
            "": {"name": "x", "version": "1.0.0"},
            "node_modules/jsdom": {"version": "30.1.1"},
            "node_modules/@scope/pkg": {"version": "2.0.0"},
            "packages/local": {"link": True, "resolved": "packages/local"},
        },
    }
)

print(f"gate under test: {GATE}\n")

# 1. an advisory refuses, named, with the fixed version where the advisory says it
stub(
    affected={("PyPI", "Pillow", "12.3.0"): ["GHSA-aaaa-bbbb-cccc"]},
    details={
        "GHSA-aaaa-bbbb-cccc": {
            "id": "GHSA-aaaa-bbbb-cccc",
            "database_specific": {"severity": "CRITICAL"},
            "affected": [
                {"package": {"name": "pillow"}, "ranges": [{"events": [{"introduced": "0"}, {"fixed": "13.0.0"}]}]}
            ],
        }
    },
)
d = folder("req-hit", {"requirements.txt": REQ})
code, out = gate(d, "requirements.txt")
check(
    "a pinned version with an advisory refuses (exit 1), naming the package, the id, its severity and the fixed version",
    code == 1 and "Pillow 12.3.0: GHSA-aaaa-bbbb-cccc (critical, fixed in 13.0.0)" in out,
    out,
)
check(
    "  the service is asked only each package's ecosystem, name and version, and a marker does not hide a pin",
    asked() == [("PyPI", "Pillow", "12.3.0"), ("PyPI", "cryptography", "50.0.0")]
    and all(
        set(x) == {"package", "version"} and set(x["package"]) == {"ecosystem", "name"}
        for x in STUB["asked"][0]["queries"]
    ),
    STUB["asked"],
)

# 2. a clean set passes, counted
stub()
code, out = gate(d, "requirements.txt")
check("the same file with no advisory passes (exit 0), counted", code == 0 and "2 pinned versions, 0 with" in out, out)

# 3-6. every way of not knowing refuses
code, out = gate(d, "requirements.txt", url=DEAD)
check(
    "no answer from the service refuses (exit 2), never a pass, and says so", code == 2 and "never a pass" in out, out
)
stub("500")
code, out = gate(d, "requirements.txt")
check("an error from the service (HTTP 500) refuses (exit 2)", code == 2 and "REFUSED" in out, out)
stub("garbage")
code, out = gate(d, "requirements.txt")
check("an answer that is not JSON refuses (exit 2)", code == 2 and "REFUSED" in out, out)
stub("short")
code, out = gate(d, "requirements.txt")
check("an answer with fewer results than questions refuses (exit 2)", code == 2 and "results for" in out, out)
stub()
code, out = gate(d, "requirements.txt", url="file:///etc/hosts")
check("a service named by a file: URL is never read (exit 2)", code == 2 and "https" in out, out)

# 7-8. a pin that is not exact cannot be checked by version
for name, text in (
    ("a range", "mcp[cli]>=1.30.0,<2.0.0\n"),
    ("a -r include", "-r other.txt\nPillow==13.0.0\n"),
    ("a wildcard", "Pillow==13.*\n"),
):
    stub()
    d2 = folder(f"req-{name.split()[-1]}", {"requirements.txt": text})
    code, out = gate(d2, "requirements.txt")
    check(
        f"{name} in a requirements file refuses (exit 2) before the service is asked",
        code == 2 and not STUB["asked"],
        out,
    )
stub(affected={("PyPI", "Pillow", "13.0.0"): ["GHSA-zzzz"]})
d2 = folder("req-hash", {"requirements.txt": "Pillow==13.0.0 \\\n    --hash=sha256:00ff\n"})
code, out = gate(d2, "requirements.txt")
check("a --hash continuation is read through, and the pin is still asked", code == 1 and "Pillow 13.0.0" in out, out)

# 9. uv.lock: every fork asked, the project itself not, a source that is not the registry refuses
stub(affected={("PyPI", "certifi", "2026.5.20"): [CERTIFI]})
d = folder("uv", {"tools/m/uv.lock": UVLOCK})
code, out = gate(d, "tools/m/uv.lock")
check(
    "a uv.lock: every fork's version is asked (starlette 1.7.0 and 1.9.0), the editable project is not",
    asked() == [("PyPI", "certifi", "2026.5.20"), ("PyPI", "starlette", "1.7.0"), ("PyPI", "starlette", "1.9.0")],
    asked(),
)
check("  and its advisory refuses (exit 1)", code == 1 and f"certifi 2026.5.20: {CERTIFI}" in out, out)
for src in ('{ git = "https://example.invalid/x.git?rev=1#00" }', '{ path = "wheels/x.whl" }'):
    stub()
    d2 = folder(f"uv-{src[2:5]}", {"uv.lock": UVLOCK.replace('source = { editable = "." }', f"source = {src}")})
    code, out = gate(d2, "uv.lock")
    check(
        f"a uv.lock entry from {src[2:].split(' ')[0]} refuses (exit 2), saying it cannot be checked by version",
        code == 2 and not STUB["asked"] and f"from a {src[2:].split(' ')[0]} source" in out,
        out,
    )
stub()
d2 = folder("uv-noversion", {"uv.lock": UVLOCK.replace('version = "1.9.0"\n', "")})
code, out = gate(d2, "uv.lock")
check("a registry entry with no version refuses (exit 2)", code == 2, out)

# 10. package-lock.json: the root and links are not asked; scoped names are; a v1 lock refuses
stub()
d = folder("npm", {"package-lock.json": NPM})
code, out = gate(d, "package-lock.json")
check(
    "a package-lock.json: every installed package asked, scoped names whole, the root and a link not",
    code == 0 and asked() == [("npm", "@scope/pkg", "2.0.0"), ("npm", "jsdom", "30.1.1")],
    out + str(asked()),
)
stub()
d2 = folder(
    "npm-v1", {"package-lock.json": json.dumps({"lockfileVersion": 1, "dependencies": {"a": {"version": "1"}}})}
)
code, out = gate(d2, "package-lock.json")
check('a lock with no "packages" (lockfileVersion 1) refuses (exit 2)', code == 2 and not STUB["asked"], out)

# 11. a withdrawn advisory is not one
stub(
    affected={("PyPI", "Pillow", "12.3.0"): ["GHSA-gone"]},
    details={"GHSA-gone": {"id": "GHSA-gone", "withdrawn": "2026-10-20T00:00:00Z", "affected": []}},
)
d = folder("withdrawn", {"requirements.txt": "Pillow==12.3.0\n"})
code, out = gate(d, "requirements.txt")
check("an advisory the database marks withdrawn does not refuse", code == 0, out)
stub(affected={("PyPI", "Pillow", "12.3.0"): ["GHSA-nodetail"]})
code, out = gate(d, "requirements.txt")
check("  an advisory whose detail cannot be read still refuses (exit 1)", code == 1 and "GHSA-nodetail" in out, out)

# 12. --rev reads the commit, never the working tree; with no files it finds every pin file
repo = TMP / "repo"
repo.mkdir()
git = ["git", "-C", str(repo), "-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false"]
(repo / "requirements.txt").write_text("Pillow==12.3.0\n")
(repo / "sub").mkdir()
(repo / "sub" / "requirements-dev.txt").write_text("cryptography==50.0.0\n")
(repo / "notes.txt").write_text("Pillow==1.0.0 is not a pin file\n")
subprocess.run(["git", "init", "-q", str(repo)], check=True)
subprocess.run([*git, "add", "-A"], check=True)
subprocess.run([*git, "commit", "-q", "--no-verify", "-m", "one"], check=True)
(repo / "requirements.txt").write_text("Pillow==13.0.0\n")  # the working tree is clean, the commit is not
stub(affected={("PyPI", "Pillow", "12.3.0"): ["GHSA-rev"]})
code, out = gate(repo, "--rev", "HEAD")
check(
    "--rev HEAD reads the commit (Pillow 12.3.0 refuses) though the working tree says 13.0.0",
    code == 1
    and "Pillow 12.3.0" in out
    and asked() == [("PyPI", "Pillow", "12.3.0"), ("PyPI", "cryptography", "50.0.0")],
    out + str(asked()),
)
check("  and it found every pin file by name, in a subfolder too, and nothing else", "2 pin file(s)" in out, out)
code, out = gate(repo, "--rev", "no-such-rev")
check("--rev of a commit that is not there refuses (exit 2)", code == 2, out)

shutil.rmtree(TMP, ignore_errors=True)
srv.shutdown()
print(f"\n{passed} held, {failed} failed")
sys.exit(1 if failed else 0)
