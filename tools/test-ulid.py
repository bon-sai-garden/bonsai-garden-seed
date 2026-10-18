#!/usr/bin/env python3
# ---
# id: 01M37WR2N7CWBRECK09QC6C34G
# title: ulid.py acceptance — every finding of Fuji-shin's pass, as a case
# type: script
# tended-by: baisai
# created: 2026-09-23
# updated: 2026-10-15
# copyright: © 2026 Bonsai Garden · bon-sai.garden
# ---
"""test-ulid.py — drives tools/ulid.py (or another copy via --ulid) through throwaway
files and git repos. Every case names the finding it closes. Exit 0 = all passed.

    python3 tools/test-ulid.py [--ulid PATH]
"""

from __future__ import annotations

import argparse
import ast
import importlib.util
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--ulid", default=str(Path(__file__).resolve().parent / "ulid.py"))
A = ap.parse_args()
ULID = str(Path(A.ulid).resolve())
spec = importlib.util.spec_from_file_location("ulid_under_test", ULID)
U = importlib.util.module_from_spec(spec)
spec.loader.exec_module(U)

T = Path(tempfile.mkdtemp(prefix="ulid-test-"))
results: list[bool] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}{(' — ' + detail) if detail else ''}")


def run(*args: str, cwd: Path | None = None) -> tuple[int, str]:
    r = subprocess.run([sys.executable, ULID, *args], capture_output=True, text=True, cwd=cwd)
    return r.returncode, (r.stdout + r.stderr).strip()


def md(name: str, idline: str, body: str = "\nbody\n", pre: str = "") -> Path:
    p = T / name
    p.write_bytes((pre + f"---\n{idline}\ntitle: t\n---\n{body}").encode("utf-8"))
    return p


def fresh() -> str:
    return run("new")[1].splitlines()[0]


# ── generator ────────────────────────────────────────────────────────────────
rc, out = run("new", "-n", "5000")
ids = out.splitlines()
check(
    "5000 generated ids: all valid, unique, strictly ordered",
    len(ids) == 5000 and len(set(ids)) == 5000 and ids == sorted(ids) and all(U.why_bad(i) is None for i in ids),
    f"{len(ids)} ids",
)
U._last_ms = int(time.time() * 1000) + 10**9  # force "same millisecond" on the next call
U._last_rand = (1 << 80) - 1
real_time = U.time.time
U.time.time = lambda: U._last_ms / 1000
try:
    U.new_ulid()
    check("counter overflow within one ms raises, never wraps", False, "no error raised")
except Exception as e:
    check("counter overflow within one ms raises, never wraps", True, type(e).__name__)
finally:
    U.time.time = real_time

# ── check: shapes and the typed-id forms that must be caught ─────────────────
typed = {
    "01M37CSEALOPENTESTBAISAI001": "shape",
    "01M37TESTEMITVERIFYKEYS001": "shape",
    "01M37SOLIDSTATEBAISAI0923A": "shape",
    "01M2FRLAYERSCONTRACT00001": "shape",
    "01NT0BONSAI20260903CODEX001": "shape",
}
real = fresh()
typed[real[:20] + "000000"] = "entropy"  # Fuji-shin c6: padded tail on a real prefix
typed[real.lower()] = "lower case"
for i, (v, why) in enumerate(typed.items()):
    p = md(f"t{i}.md", f"id: {v}")
    rc, out = run("check", str(p))
    check(f"typed id {v[:26]!r} is BAD ({why})", rc == 1 and why in out, out[-70:])
fut = U.CROCKFORD[0]
for label, ms in (("future", int(time.time() * 1000) + 3 * U.DAY_MS), ("pre-2024", 1672531200000)):
    n = (ms << 80) | int.from_bytes(os.urandom(10), "big")
    v = "".join(U.CROCKFORD[(n >> (5 * i)) & 31] for i in reversed(range(26)))
    rc, out = run("check", str(md(f"time-{label}.md", f"id: {v}")))
    check(f"{label} timestamp is BAD", rc == 1 and "time:" in out, out[-60:])
paths = [str(md(f"ok{i}.md", f"id: {fresh()}")) for i in range(20)]
rc, out = run("check", *paths)
check("20 fresh ids pass", rc == 0 and out == "", out[-60:])

# ── fail-open closed (Tasai: fix first) ─────────────────────────────────────
rc, out = run("check", str(T / "does-not-exist.md"))
check("a missing path exits 2, not 0", rc == 2, out[-60:])
rc, out = run("check", str(T))
check("a directory exits 2, not 0", rc == 2, out[-60:])
rc, out = run("check", str(md("bom.md", "id: 01NT0BONSAI20260903CODEX001", pre="﻿")))
check("a BOM-prefixed .md is read, typed id BAD (not skipped)", rc == 1, out[-60:])
p = T / "UPPER.MD"
p.write_text("---\nid: 01NT0BONSAI20260903CODEX001\n---\nx\n")
rc, out = run("check", str(p))
check("an upper-case .MD is read, typed id BAD (not skipped)", rc == 1, out[-60:])
p = T / "bin.md"
p.write_bytes(b"---\nid: \xff\xfe\n---\n")
rc, out = run("check", str(p))
check("a non-UTF-8 file is BAD 'unreadable', no traceback", rc == 1 and "Traceback" not in out, out[-60:])

# ── header parsing ──────────────────────────────────────────────────────────
p = T / "j.mjs"
p.write_text("/**\n * ---\n * id: 01NT0BONSAI20260903CODEX001\n * title: x\n * ---\n */\nexport{}\n")
rc, out = run("check", str(p))
check("a JSDoc header's typed id is read and BAD", rc == 1, out[-60:])
p = T / "j2.mjs"
p.write_text(f"/**\n * ---\n * id: {fresh()}\n * ---\n */\n")
check("a JSDoc header's real id passes", run("check", str(p))[0] == 0)
rc, out = run("check", str(md("dup.md", f"id: {fresh()}\nid: 01NT0BONSAI20260903CODEX007")))
check("two id: keys in one header are BAD (structure)", rc == 1 and "structure" in out, out[-60:])
rc, out = run("check", str(md("empty.md", "id:")))
check(
    "an empty id: is 'empty id:', not the next line borrowed",
    rc == 1 and "empty id" in out and "title" not in out,
    out[-60:],
)
p = T / "below.py"
p.write_text(f"#!/usr/bin/env python3\n# ---\n# title: x\n# ---\nimport os\n# id: {fresh()}\n")
rc, out = run("check", str(p))
check("a .py id below the header is not read (header has none → 'no id:')", rc == 1 and "no id" in out, out[-60:])
rc, out = run("check", str(md("nested.md", f"id: {fresh()}\nsign:\n  id: 01NT0BONSAI20260903CODEX001")))
check("a nested '  id:' is not mistaken for a second id key", rc == 0, out[-60:])

# ── staged ratchet, in a throwaway repo ─────────────────────────────────────
R = T / "repo"
R.mkdir()


def g(*a: str) -> str:
    return subprocess.run(["git", "-C", str(R), *a], capture_output=True, text=True).stdout


g("init", "-q")
g("config", "user.email", "t@t")
g("config", "user.name", "t")
g("config", "core.hooksPath", "/dev/null")
src_id = fresh()
(R / "src.md").write_text(f"---\nid: {src_id}\ntitle: s\n---\nsource body\n")
(R / "legacy.md").write_text("---\nid: 01NT0BONSAI20260903CODEX001\ntitle: l\n---\nold\n")
g("add", "-A")
g("commit", "-qm", "base")


def staged(setup, name, expect_rc, needle=""):
    g("reset", "-q", "--hard")
    g("clean", "-qfd")
    setup()
    g("add", "-A")
    rc, out = run("check", "--staged", "--repo", str(R))
    check(f"staged: {name}", rc == expect_rc and needle in out, f"rc={rc} {out[-80:]}")


staged(
    lambda: (R / "a.md").write_text("---\nid: 01NT0BONSAI20260903CODEX002\n---\nx\n"), "new file, typed id → blocked", 1
)
staged(lambda: (R / "b.md").write_text(f"---\nid: {fresh()}\n---\nx\n"), "new file, real id → passes", 0)
staged(
    lambda: (R / "legacy.md").write_text("---\nid: 01NT0BONSAI20260903CODEX001\ntitle: l\n---\nedited\n"),
    "legacy typed id left alone → passes with a note",
    0,
    "note",
)
staged(
    lambda: (R / "src.md").write_text("---\nid: 01NT0BONSAI20260903CODEX009\n---\nx\n"),
    "id changed to typed → blocked",
    1,
)
staged(
    lambda: (R / "e.md").write_text(f"---\nid: {src_id}\n---\ndifferent body\n"),
    "new file reusing a tracked id → blocked, says 'already used'",
    1,
    "already used",
)
staged(
    lambda: (R / "copy.md").write_bytes((R / "src.md").read_bytes()),
    "byte-identical distributed copy → passes (the 09-14 ruling)",
    0,
)


def two_new():
    same = fresh()
    (R / "n1.md").write_text(f"---\nid: {same}\n---\none\n")
    (R / "n2.md").write_text(f"---\nid: {same}\n---\ntwo\n")


staged(two_new, "two new files with the same fresh id → blocked (Fuji-shin h)", 1, "already used")


def takes_modified():
    (R / "src.md").write_text(f"---\nid: {src_id}\ntitle: s\n---\nsource body, edited\n")
    (R / "i.md").write_text(f"---\nid: {src_id}\n---\nother\n")


staged(takes_modified, "new file takes the id of a file modified in the same commit → blocked (Fuji-shin i)", 1)


def copy_of_modified():
    (R / "src.md").write_text(f"---\nid: {src_id}\ntitle: s\n---\nsource body, edited\n")
    (R / "copy.md").write_bytes((R / "src.md").read_bytes())


staged(copy_of_modified, "copy identical to the staged source → passes, same as unstaged case (Fuji-shin f4)", 0)
staged(lambda: (g("mv", "src.md", "moved.md"),), "rename keeping its id → passes", 0)


# ── round two (Fuji-shin, 2026-09-23): the gate reads the index, not the working tree ──
def b5():  # copy of src made from an UNSTAGED edit → staged copy differs from staged src
    (R / "src.md").write_text(f"---\nid: {src_id}\ntitle: s\n---\nunstaged edit\n")
    (R / "copy.md").write_bytes((R / "src.md").read_bytes())
    g("add", "copy.md")


def b6():  # src's id changed only in the working tree; a new file takes the old id
    (R / "src.md").write_text(f"---\nid: {fresh()}\ntitle: s\n---\nsource body\n")
    (R / "n.md").write_text(f"---\nid: {src_id}\n---\nnew doc\n")
    g("add", "n.md")


def b4():  # a true copy of the STAGED src, while src has an unstaged edit
    (R / "copy.md").write_bytes((R / "src.md").read_bytes())
    g("add", "copy.md")
    (R / "src.md").write_text(f"---\nid: {src_id}\ntitle: s\n---\nunstaged edit\n")


def staged_raw(setup, name, expect_rc, needle=""):
    g("reset", "-q", "--hard")
    g("clean", "-qfd")
    setup()
    rc, out = run("check", "--staged", "--repo", str(R))
    check(f"staged: {name}", rc == expect_rc and needle in out, f"rc={rc} {out[-80:]}")


staged_raw(b5, "copy of an unstaged edit → blocked, two documents would share one id (b5)", 1, "already used")
staged_raw(b6, "old id reused while its change is only unstaged → blocked (b6)", 1, "already used")
staged_raw(b4, "true copy of the staged source, source edited but unstaged → passes (b4)", 0)


def b7():  # two tracked, differing files already share a real id; edit one, id untouched
    sid = fresh()
    (R / "sh-a.md").write_text(f"---\nid: {sid}\n---\na\n")
    (R / "sh-b.md").write_text(f"---\nid: {sid}\n---\nb\n")
    g("add", "-A")
    g("commit", "-qm", "legacy share", "--no-verify")
    (R / "sh-a.md").write_text(f"---\nid: {sid}\n---\na, edited\n")
    g("add", "sh-a.md")


staged_raw(b7, "an id left alone passes even if already shared, with a note (b7)", 0, "note")
g("reset", "-q", "--hard", "HEAD~1")


def crlf():  # autocrlf: identical staged blobs, CRLF working tree
    g("config", "core.autocrlf", "true")
    (R / "copy.md").write_bytes((R / "src.md").read_bytes().replace(b"\n", b"\r\n"))
    g("add", "copy.md")


staged_raw(crlf, "autocrlf copy with an identical staged blob → passes (b10)", 0)
g("config", "--unset", "core.autocrlf")
p = T / "trail.md"
p.write_text("--- \nid: 01NT0BONSAI20260903CODEX001\n---\nx\n")
rc, out = run("check", str(p))
check("a '--- ' opener with trailing space is a header; typed id BAD", rc == 1, out[-60:])
p = T / "latin.js"
p.write_bytes(b"var s = '\xe9';\n")
rc, out = run("check", str(p))
check("a non-UTF-8 script with no header is skipped, not blocked", rc == 0, out[-60:])


# ── round three (Fuji-shin, 2026-09-23) ──
def m1():  # a modified file keeps its first id and gains a second, typed one (YAML reads the last)
    (R / "src.md").write_text(f"---\nid: {src_id}\nid: 01NT0BONSAI20260903CODEX005\ntitle: s\n---\nsource body\n")


staged(m1, "a second id: key added under an unchanged id → blocked (m1)", 1, "structure")


def m1_legacy():  # the structure fault is already at HEAD; edit the body, leave the header
    (R / "two.md").write_text(f"---\nid: {src_id[:-1]}Z\nid: 01NT0BONSAI20260903CODEX006\n---\nx\n")
    g("add", "-A")
    g("commit", "-qm", "legacy two keys", "--no-verify")
    (R / "two.md").write_text(f"---\nid: {src_id[:-1]}Z\nid: 01NT0BONSAI20260903CODEX006\n---\nx, edited\n")


staged(m1_legacy, "a structure fault already at HEAD, header untouched → passes with a note", 0, "note")
g("reset", "-q", "--hard", "HEAD~1")


def m8():  # a gitlink whose path ends in .md, pointing at a commit this repo does not hold
    g("update-index", "--add", "--cacheinfo", f"160000,{'5' * 40},sub.md")


staged_raw(m8, "a gitlink named *.md → no traceback, passes (m8)", 0)
g("rm", "-q", "--cached", "sub.md")

B10 = T / "b10"
B10.mkdir()


def gb(*a):
    return subprocess.run(["git", "-C", str(B10), *a], capture_output=True, text=True).stdout


gb("init", "-q")
gb("config", "user.email", "t@t")
gb("config", "user.name", "t")
gb("config", "core.autocrlf", "true")
(B10 / "src.md").write_bytes(f"---\nid: {fresh()}\ntitle: src\n---\n\nbody\n".replace("\n", "\r\n").encode())
gb("add", "-A")
gb("commit", "-qm", "base")  # index LF, working tree CRLF
(B10 / "copy.md").write_bytes((B10 / "src.md").read_bytes())
gb("add", "copy.md")
rc, out = run("check", "--staged", "--repo", str(B10))
check("staged: autocrlf, CRLF working tree, same staged blob → passes (b10, Fuji-shin's repro)", rc == 0, out[-80:])

rc, out = run("check", "--staged", "--repo", str(T / "nowhere"))
check("outside a git repo → exit 2 (git failure), not 1", rc == 2, out[-60:])

# ── templates and cards: exempt by property (Tasai, 2026-09-24) ──────────────
TD = T / "exempt"
(TD / "tasks" / "todo").mkdir(parents=True)
(TD / "tasks" / "bounced").mkdir()


def tf(name: str, text: str) -> Path:
    p = TD / name
    p.write_text(text)
    return p


def TPL(idv, extra="template: true\n"):
    return f"---\nid: {idv}\ntype: about-me\n{extra}---\n\nfill me\n"


for ph in ("<ULID>", "TODO-generate-ulid"):
    rc, out = run("check", str(tf(f"t-{len(ph)}.md", TPL(ph))))
    check(f"a template (`template: true`) with id {ph} passes check", rc == 0, out[-80:])
    rc, out = run("check", str(tf(f"c-{len(ph)}.md", TPL(ph, ""))))
    check(f"the same placeholder WITHOUT `template: true` fails check ({ph})", rc == 1 and "BAD" in out, out[-80:])
rc, out = run("check", str(tf("t-typed.md", TPL("01NT0TEMPLATE00000000000A"))))
check("a template whose id is typed, not a placeholder, fails check", rc == 1, out[-80:])
rc, out = run("check", str(tf("t-false.md", TPL("<ULID>", "template: false\n"))))
check("`template: false` with a placeholder fails check", rc == 1, out[-80:])
rc, out = run("check", str(tf("t-two.md", TPL("<ULID>", "template: true\ntemplate: false\n"))))
check("two `template:` keys (YAML reads the last) with a placeholder fail check", rc == 1, out[-80:])
rc, out = run("check", str(tf("t-quoted.md", TPL("<ULID>", 'template: "true"\n'))))
check('a quoted `template: "true"` (a string, not the boolean) is not the flag', rc == 1, out[-80:])
rc, out = run("check", str(tf("t-nested.md", TPL("<ULID>", "meta:\n  template: true\n"))))
check("a nested `template: true` is not the flag", rc == 1, out[-80:])
rc, out = run("check", str(tf("t-near.md", TPL("<ulid>"))))
check("a near-placeholder (`<ulid>`) is not exempt", rc == 1, out[-80:])


def CARD(cid):
    return f"---\nid: {cid}\ntitle: a card\nstatus: todo\n---\nbody\n"


rc, out = run("check", str(tf("tasks/todo/BL-XX999.md", CARD("BL-XX999"))))
check("a kanban card (<lane>/BL-XX###.md, id = stem) passes check", rc == 0, out[-80:])
rc, out = run("check", str(tf("tasks/todo/BL-XX998.md", CARD("BL-XX997"))))
check("a card whose id is not its filename's stem fails check", rc == 1, out[-80:])
rc, out = run("check", str(tf("tasks/bounced/BL-XX996.md", CARD("BL-XX996"))))
check("a ticket id in a lane the card schema does not name fails check", rc == 1, out[-80:])
rc, out = run("check", str(tf("BL-XX995.md", CARD("BL-XX995"))))
check("a ticket id outside any lane fails check", rc == 1, out[-80:])

CR = T / "census-exempt"
CR.mkdir()
subprocess.run(["git", "init", "-q", str(CR)], check=True)
(CR / "a.md").write_text(TPL("<ULID>"))
(CR / "b.md").write_text(TPL("<ULID>").replace("fill me", "another"))
(CR / "todo").mkdir()
(CR / "todo" / "BL-XX999.md").write_text(CARD("BL-XX999"))
(CR / "real.md").write_text(f"---\nid: {fresh()}\n---\n")
subprocess.run(["git", "-C", str(CR), "add", "-A"], check=True)
rc, out = run("census", "--repo", str(CR))
check(
    "census: templates and cards are not typed, not shared, and listed apart",
    rc == 0 and "0 typed" in out and "0 shared" in out and "1 card name-id(s), 2 template(s)" in out,
    out[-160:],
)
rc, out = run("census", "--repo", str(CR), "--names")
check(
    "census --names lists each exempt id",
    "card     BL-XX999  todo/BL-XX999.md" in out and out.count("template <ULID>") == 2,
    out[-200:],
)
(CR / "copy.md").write_text(TPL("<ULID>", ""))
subprocess.run(["git", "-C", str(CR), "add", "-A"], check=True)
rc, out = run("census", "--repo", str(CR))
check("census: an unminted copy (placeholder, no flag) counts as typed", rc == 1 and "1 typed" in out, out[-160:])
rc, out = run("check", "--staged", "--repo", str(CR))
check(
    "staged: the unminted copy is blocked; the templates and the card pass",
    rc == 1 and "copy.md" in out and "a.md" not in out.replace("copy.md", "") and "BL-XX999" not in out,
    out[-200:],
)

# the card schema here is a COPY of the validator's; any drift fails
VAL = Path(A.ulid).resolve().parent.parent / "skills" / "bonsai-garden-validate" / "scripts" / "validate-metadata.py"
vsrc = VAL.read_text() if VAL.is_file() else ""
m_re = re.search(r'CARD_ID_RE = re\.compile\(r"([^"]+)"\)', vsrc)
m_ln = re.search(r"CARD_LANES = (\([^)]*\))", vsrc)
check(
    "the card schema matches the validator's (CARD_ID_RE and CARD_LANES)",
    bool(m_re and m_ln) and m_re.group(1) == U.CARD_ID_RE.pattern and ast.literal_eval(m_ln.group(1)) == U.CARD_LANES,
    f"validator {m_re and m_re.group(1)} {m_ln and m_ln.group(1)}",
)

# the ULID shape: the generator's ULID_RE is the master (Crockford base-32, no I, L, O or U); the validator keeps a
# COPY, because a skill runs from its own folder. The copy once admitted L (J-N), found by the quality pass, 2026-10-15.
m_ul = re.search(r'^ULID_RE = re\.compile\(r"([^"]+)"\)', vsrc, re.M)
check(
    "the validator's ULID shape is the generator's (no I, L, O or U)",
    bool(m_ul) and m_ul.group(1) == U.ULID_RE.pattern,
    f"validator {m_ul and m_ul.group(1)}, generator {U.ULID_RE.pattern}",
)

print(f"\n{sum(results)}/{len(results)} pass")
sys.exit(0 if all(results) else 1)
