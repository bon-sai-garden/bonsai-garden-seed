#!/usr/bin/env python3
# ---
# id: 01M5DP676H6S00BYT1B063M534
# title: test-setup-core — the portrait tools go in only at requirements.txt's pins, from the hashed lock, on Python 3.11 or newer, never an older Pillow
# type: script
# tended-by: baisai
# created: 2026-10-21
# updated: 2026-10-21
# ---
"""test-setup-core.py: tools/setup-core.py's portrait step, each case planted in a scratch folder and watched.

Pillow 13.0.0, the first release past the nine advisories published against 12.3.0 on 2026-10-20, installs on Python
3.11 or newer only. The property under test: setup-core installs the portrait tools only at requirements.txt's pins
and only on such a Python (this one, or one already on PATH, named before the yes); with none it installs nothing and
says what still runs; a .venv off the pins is named, and one on an older Python is never upgraded or removed.

    python3 tools/test-setup-core.py [--setup <setup-core.py>]

--setup tests another file (the one before a change, to watch the cases fail). Every case runs in its own scratch
copy (setup-core.py, requirements.txt, package-lock.json, a stub of the kanji check), with PATH holding only node and
the planted Pythons. A planted Python is a small script that answers setup-core's probe from a JSON file beside it and
logs every call; its `-m pip install -r` records the pins as installed, as pip would leave them. Nothing is
downloaded: PIP_NO_INDEX is set, so a real pip that an older setup-core reaches fails at once. Two cases use real
interpreters: a Python older than 3.11 (to run setup-core as a stock Mac's would) and one at 3.11 or newer; a case
whose interpreter this host does not have is skipped and said.
Exit 0 all held, 1 a case failed.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve()
CORE = HERE.parent.parent
SETUP = (
    Path(sys.argv[sys.argv.index("--setup") + 1]).resolve() if "--setup" in sys.argv else HERE.parent / "setup-core.py"
)
NODE = shutil.which("node")
if not NODE:
    sys.exit("test-setup-core: node is needed (setup-core checks it first)")
REQ = (CORE / "requirements.txt").read_text()
PINS = {m.group(1): m.group(2) for m in re.finditer(r"(?m)^([A-Za-z0-9][A-Za-z0-9_.\-]*)==([^\s;#]+)", REQ)}
PILLOW = PINS.get("Pillow")
TMP = Path(tempfile.mkdtemp(prefix="setup-core-test-", dir=os.environ.get("KEYS_TEST_TMP") or None))

FAKE = """#!{py}
import json, os, re, sys
from pathlib import Path
HERE = Path(__file__)
STATE = HERE.parent / (HERE.name + ".json")
st = json.loads(STATE.read_text())
a = sys.argv[1:]
with open(os.environ["FAKE_LOG"], "a") as f:
    f.write(json.dumps({{"exe": str(HERE), "argv": a}}) + "\\n")
def norm(n):  # pip and importlib.metadata match a distribution's name case- and separator-blind
    return re.sub(r"[-_.]+", "-", n).lower()
if a[:1] == ["-c"]:
    have = {{norm(k): v for k, v in st["dists"].items()}}
    print(json.dumps({{"python": st["python"], "dists": {{n: have.get(norm(n)) for n in a[2:]}}}}))
elif a[:2] == ["-m", "venv"]:
    b = Path(a[2]) / "bin"
    b.mkdir(parents=True, exist_ok=True)
    (b / "python3").write_text(HERE.read_text())
    (b / "python3").chmod(0o755)
    (b / "python3.json").write_text(json.dumps({{"python": st["python"], "dists": {{}}}}))
elif a[:3] == ["-m", "pip", "install"]:
    req = Path(a[a.index("-r") + 1]).read_text()
    for n, v in re.findall(r"(?m)^([A-Za-z0-9][A-Za-z0-9_.\\-]*)==([^\\s;#]+)", req):
        for k in [k for k in st["dists"] if norm(k) == norm(n)]:
            del st["dists"][k]
        st["dists"][n] = v
    STATE.write_text(json.dumps(st))
else:
    sys.exit("planted python: not a call setup-core makes: " + " ".join(a))
"""

passed = failed = skipped = 0


def check(name: str, ok: bool, why: str = "") -> None:
    global passed, failed
    passed, failed = passed + ok, failed + (not ok)
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + ("" if ok or not why else f"\n      {why[-700:]}"))


def skip(name: str, why: str) -> None:
    global skipped
    skipped += 1
    print(f"SKIP  {name}  ({why})")


def real_python(test) -> tuple[str, tuple[int, int]] | None:
    """A real interpreter on this host whose version passes `test`."""
    for c in ["/usr/bin/python3", sys.executable, *(shutil.which(f"python3.{m}") for m in range(9, 21))]:
        if not c or not Path(c).is_file():
            continue
        r = subprocess.run([c, "-c", "import sys; print(*sys.version_info[:2])"], capture_output=True, text=True)
        if r.returncode == 0:
            v = tuple(int(x) for x in r.stdout.split())
            if test(v):
                return c, v
    return None


OLD = real_python(lambda v: (3, 9) <= v < (3, 11))
NEW = real_python(lambda v: v >= (3, 11))


def plant(w: Path, rel: str, python: tuple[int, int], dists: dict | None = None) -> Path:
    p = w / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(FAKE.format(py=sys.executable))
    p.chmod(0o755)
    Path(f"{p}.json").write_text(json.dumps({"python": list(python), "dists": dists or {}}))
    return p


def folder(name: str) -> Path:
    w = TMP / name
    (w / "tools").mkdir(parents=True)
    shutil.copy2(SETUP, w / "tools" / "setup-core.py")
    for f in ("requirements.txt", "requirements-lock.txt", "package-lock.json"):
        if (CORE / f).is_file():  # the lock's absence is a case of its own, below, not a copy that fails here
            shutil.copy2(CORE / f, w / f)
    mark = w / "skills" / "bonsai-garden-mark"
    mark.mkdir(parents=True)
    (mark / "check-set.mjs").write_text("process.exit(0);\n")  # the kanji check is not under test here
    (w / "bin").mkdir()
    (w / "bin" / "node").symlink_to(NODE)
    return w


def setup(w: Path, runner: str, *args: str, answers: str = "") -> tuple[int, str, list]:
    log = w / "calls.jsonl"
    env = {
        "PATH": str(w / "bin"),
        "HOME": str(w),
        "FAKE_LOG": str(log),
        "PIP_NO_INDEX": "1",
        "PIP_CONFIG_FILE": os.devnull,
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    r = subprocess.run(
        [runner, str(w / "tools" / "setup-core.py"), *args], input=answers, capture_output=True, text=True, env=env
    )
    calls = [json.loads(x) for x in log.read_text().splitlines()] if log.is_file() else []
    return r.returncode, r.stdout + r.stderr, calls


def pip_calls(calls: list) -> list:
    return [c for c in calls if c["argv"][:3] == ["-m", "pip", "install"]]


def vdist(w: Path, name: str) -> str | None:
    """The version .venv holds of `name`, its spelling aside (as pip reads it)."""
    n = re.sub(r"[-_.]+", "-", name).lower()
    return next((v for k, v in venv_state(w).get("dists", {}).items() if re.sub(r"[-_.]+", "-", k).lower() == n), None)


def venv_state(w: Path) -> dict:
    p = w / ".venv" / "bin" / "python3.json"
    return json.loads(p.read_text()) if p.is_file() else {}


print(f"setup-core under test: {SETUP}\nrequirements.txt pins Pillow {PILLOW}; older Python {OLD}; newer {NEW}\n")

# 1. a Python older than 3.11, none newer on PATH: nothing installed, said plainly
if OLD:
    w = folder("old-alone")
    code, out, calls = setup(w, OLD[0])
    check(
        "an older Python, none newer: the status line says the portrait tools need 3.11 or newer",
        "need Python 3.11 or newer" in out,
        out,
    )
    code, out, calls = setup(w, OLD[0], "--install", answers="n\ny\ny\n")
    check(
        "  and --install installs nothing, no .venv, no pip; it says no older Pillow and what still runs (sips)",
        not (w / ".venv").exists()
        and not pip_calls(calls)
        and "no older Pillow" in out
        and "sips" in out
        and code == 0,
        f"exit {code}, .venv {(w / '.venv').exists()}: {out}",
    )
else:
    skip("an older Python, none newer", "no Python 3.9 or 3.10 on this host")

# 2. an older Python runs it, a newer one is on PATH: .venv is made with that one, named before the yes; pip gets the pins
if OLD:
    w = folder("old-with-newer")
    newer = plant(w, "bin/python3.12", (3, 12))
    code, out, calls = setup(w, OLD[0], "--install", answers="n\ny\n")
    made = [c for c in calls if c["argv"][:2] == ["-m", "venv"]]
    check(
        "an older Python with python3.12 on PATH: the ask names Python 3.12 and its path before the yes",
        f"with Python 3.12 ({newer})" in out,
        out,
    )
    check(
        "  .venv is made by python3.12, never by the older Python",
        len(made) == 1 and made[0]["exe"] == str(newer),
        json.dumps(calls),
    )
    check(
        f"  pip installs --require-hashes -r requirements-lock.txt in that .venv, and it ends at the pins (Pillow {PILLOW})",
        len(pip_calls(calls)) == 1
        and pip_calls(calls)[0]["exe"].endswith(".venv/bin/python3")
        and "--require-hashes" in pip_calls(calls)[0]["argv"]
        and "requirements-lock.txt" in " ".join(pip_calls(calls)[0]["argv"])
        and vdist(w, "Pillow") == PILLOW
        and "To use them" in out,
        out + json.dumps(calls),
    )
else:
    skip("an older Python with a newer one on PATH", "no Python 3.9 or 3.10 on this host")

runner = (NEW or OLD or (sys.executable,))[0]

# 3. a .venv at an older Pillow on Python 3.12: named as off the pins; --install brings it to them
w = folder("venv-old-pillow")
plant(w, ".venv/bin/python3", (3, 12), {**PINS, "Pillow": "12.3.0"})
code, out, calls = setup(w, runner)
check(
    f"a .venv with Pillow 12.3.0 on 3.12: the status line names it off the pins (pinned {PILLOW}), not ready",
    f"Pillow 12.3.0 (pinned {PILLOW})" in out and "are ready" not in out,
    out,
)
code, out, calls = setup(w, runner, "--install", answers="n\ny\n")
check(
    "  --install asks, then pip installs --require-hashes -r requirements-lock.txt into it, and it ends at the pins",
    "Bring the portrait tools in .venv to requirements.txt's pins" in out
    and len(pip_calls(calls)) == 1
    and "--require-hashes" in pip_calls(calls)[0]["argv"]
    and pip_calls(calls)[0]["argv"][pip_calls(calls)[0]["argv"].index("-r") + 1].endswith("requirements-lock.txt")
    and vdist(w, "Pillow") == PILLOW,
    out + json.dumps(calls),
)

# 4. a .venv on Python 3.10 (no pinned Pillow installs there): never upgraded, never removed, no pip
w = folder("venv-py310")
plant(w, ".venv/bin/python3", (3, 10), {"Pillow": "12.3.0"})
code, out, calls = setup(w, runner)
check(
    "a .venv on Python 3.10 with Pillow 12.3.0: the status line says 3.10 cannot take the pins and names its Pillow",
    "runs Python 3.10" in out and "Pillow 12.3.0 is not the pinned one" in out and "are ready" not in out,
    out,
)
code, out, calls = setup(w, runner, "--install", answers="n\ny\ny\n")
check(
    "  --install runs no pip in it and leaves it in place, saying no older Pillow was installed",
    not pip_calls(calls)
    and (w / ".venv" / "bin" / "python3").is_file()
    and venv_state(w)["dists"] == {"Pillow": "12.3.0"}
    and "no older Pillow" in out,
    out + json.dumps(calls),
)

# 5. a .venv at the pins on 3.12: ready, and --install leaves it alone
w = folder("venv-at-pins")
plant(w, ".venv/bin/python3", (3, 12), dict(PINS))
code, out, calls = setup(w, runner, "--install", answers="n\ny\n")
check(
    f"a .venv at the pins: ready (Pillow {PILLOW}, on Python 3.12), and --install runs no pip",
    f"are ready (Pillow {PILLOW}, on Python 3.12)" in out and not pip_calls(calls),
    out + json.dumps(calls),
)

# 6. a newer Python runs it: the ask names this Python; a no installs nothing
if NEW:
    w = folder("new-runner")
    code, out, calls = setup(w, NEW[0], "--install", answers="n\nn\n")
    named = re.search(rf"with Python {NEW[1][0]}\.{NEW[1][1]} \((/[^)]+)\)", out)
    check(
        f"Python {NEW[1][0]}.{NEW[1][1]} runs it: the ask names that Python and its path; a no makes no .venv",
        bool(named) and Path(named.group(1)).resolve() == Path(NEW[0]).resolve() and not (w / ".venv").exists(),
        out,
    )
else:
    skip("a newer Python runs it", "no Python 3.11 or newer on this host")

# 7. the probe against real interpreters: an empty real venv is off the pins (Pillow missing); a real old one is blocked
if NEW:
    w = folder("real-empty-venv")
    subprocess.run([NEW[0], "-m", "venv", "--without-pip", str(w / ".venv")], check=True)
    code, out, calls = setup(w, NEW[0])
    check(
        f"a real, empty venv on {NEW[1][0]}.{NEW[1][1]}: the probe reads it, Pillow missing (pinned {PILLOW})",
        f"Pillow missing (pinned {PILLOW})" in out,
        out,
    )
else:
    skip("a real, empty venv", "no Python 3.11 or newer on this host")
if OLD:
    w = folder("real-old-venv")
    subprocess.run([OLD[0], "-m", "venv", "--without-pip", str(w / ".venv")], check=True)
    code, out, calls = setup(w, runner)
    check(
        f"a real venv on {OLD[1][0]}.{OLD[1][1]}: the probe reads its version, and it is blocked, never synced",
        f"runs Python {OLD[1][0]}.{OLD[1][1]}" in out,
        out,
    )
else:
    skip("a real old venv", "no Python 3.9 or 3.10 on this host")

# 9. the hashed lock (Mori-shin's read, 2026-10-21, B10-25): every transitive dependency pinned and hashed, generated
# from requirements.txt, and gated here on drift: the lock holds every pin of requirements.txt at its version
LOCK = CORE / "requirements-lock.txt"
CURATION = CORE / "skills" / "bonsai-garden-mark" / "requirements-curation.txt"


def lock_entries(text: str) -> dict:
    """{name: (version, hashes)} of a pip --require-hashes file (a backslash continues a line)."""
    out = {}
    for line in re.sub(r"\\\r?\n", " ", text).splitlines():
        line = re.sub(r"(^|\s)#.*$", "", line).strip()
        m = re.match(r"([A-Za-z0-9][A-Za-z0-9._\-]*)==([^\s;]+)", line)
        if m:
            out[m.group(1).lower().replace("_", "-")] = (m.group(2), re.findall(r"--hash[=\s](sha256:[0-9a-f]{64})", line))
    return out


locked = lock_entries(LOCK.read_text()) if LOCK.is_file() else {}
want = {n.lower().replace("_", "-"): v for n, v in PINS.items()}
check(
    "requirements-lock.txt is there and holds every pin of requirements.txt at the same version (no drift)",
    bool(locked) and all(locked.get(n, ("",))[0] == v for n, v in want.items()),
    f"lock: {len(locked)} entries; off: {[n for n, v in want.items() if locked.get(n, ('',))[0] != v]}",
)
check(
    "  every entry of the lock carries a sha256 hash, and it holds more than the top-level pins (the transitives)",
    bool(locked) and all(h for _v, h in locked.values()) and len(locked) > len(want),
    f"unhashed: {[n for n, (_v, h) in locked.items() if not h]}; {len(locked)} entries, {len(want)} pins",
)
check(
    "jamdict and jamdict-data are in neither requirements.txt nor the lock",
    not any(n.startswith("jamdict") for n in list(want) + list(locked)),
    f"pins: {sorted(want)}; lock: {sorted(locked)}",
)
cur = lock_entries(CURATION.read_text()) if CURATION.is_file() else {}
check(
    "  the mark skill's requirements-curation.txt pins both, hashed, asked for only when curating marks",
    set(cur) >= {"jamdict", "jamdict-data"} and all(h for _v, h in cur.values()),
    f"{CURATION}: {cur}",
)

# 10. no lock beside requirements.txt: --install installs nothing, and says the lock is missing (never unhashed pins)
w = folder("no-lock")
(w / "requirements-lock.txt").unlink(missing_ok=True)
code, out, calls = setup(w, runner, "--install", answers="n\ny\n")
check(
    "no requirements-lock.txt: --install runs no pip and makes no .venv, and names the missing lock",
    not pip_calls(calls) and not (w / ".venv").exists() and "requirements-lock.txt" in out,
    out + json.dumps(calls),
)

shutil.rmtree(TMP, ignore_errors=True)
print(f"\n{passed} held, {failed} failed, {skipped} skipped")
sys.exit(1 if failed else 0)
