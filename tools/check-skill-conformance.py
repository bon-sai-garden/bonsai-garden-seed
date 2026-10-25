#!/usr/bin/env python3
# ---
# id: 01M3938G6YG175K7C6349X2ETM
# title: Standalone-skill conformance gate
# type: script
# tended-by: baisai
# created: 2026-09-24
# updated: 2026-10-25
# ---
"""
check-skill-conformance.py — does every standalone skill in this repo meet the spec? And does
every packaged skill carry the means to check itself?

Spec: rituals/specs/spec-canonical-shintai-structure.md (3.0.x) — SKILL.md tolerates no extra
frontmatter and is sealed by a detached sidecar (.SKILL.md.bonsaisig; a seal at the old name SKILL.md.bonsaisig reads retired-sidecar-name, the dot-prefixed sidecar change phase 3), never an embedded sign: block; no
README.md inside a skill folder; standalone skills carry their own identity and mark (…技).
A skill's identity (ULID, owner, dates, mark) therefore lives beside it, in
references/identity.md, sealed like any other garden document.

Per skill folder under skills/:
  1  SKILL.md present; frontmatter keys only name, description, version; no sign: block
  2  the SKILL.md sidecar present (either name, the Node finder's answer) and verifies with core's own verifier (skills/bonsai-garden-sign)
  3  references/identity.md present: type identity, skill == SKILL.md name, a valid unique
     ULID id, tended-by set, version (if any) equal to SKILL.md's, a seal that verifies: a v2
     .bonsaisig (seal v2, seal v2); a retired v1 embedded seal passes with a WARNING until
     skills/bonsai-garden-sign/seal-policy.json flips v1 to refuse, and fails after
  4  no README.md anywhere in the skill folder
  5  no orphaned .bonsaisig (a sidecar whose target is gone)
  6  integrity first: the first body line of SKILL.md is the builder's INTEGRITY_LINE
     (skills/bonsai-garden-core-plugin/scripts/package.py — the one definition, read from there)
  7  every tracked file in the skill folder carries a seal, or is named in tools/unsealed-by-design.json
     with its reason (a fixture a seal would defeat); a listed file that is sealed, or is gone, is a
     finding too, so the list cannot go stale

--packaged <dir|zip> ... — every skill folder in a built package (a staged folder, a wrapped
.zip/.skill, or a .plugin's skills/*/), the one builder, the gardener 2026-09-24: "if that file is
tampered with, we're not executing it. End stop."
  P1  SKILL.md frontmatter only name, description, version; the first body line is the stamp
      (> Installed build: …), and the first line after it is the integrity line
  P2  MANIFEST.json present, with a sidecar beside it and beside SKILL.md (either name)
  P3  what the check needs travels inside: scripts/integrity/verify-manifest.mjs, core's verifier
      (scripts/integrity/bonsai-garden-sign/lib/verify.mjs), and the marker agents/registry.json
      listing no agent (a package carries no key and no fingerprint)
  P4  the package's own check answers ok: verify-manifest.mjs, the very script the SKILL.md line
      names, by the published keys unless --keys garden --garden <root> is named
  P5  the SKILL.md sidecar verifies over the packaged SKILL.md, sealed by the manifest's owner
      in the owner role (a custodian seal is never authorship)
  P6  no README.md in the folder
  --unsealed (only package.py names it, for its core-alone build with no owner's key): P2 holds that
      MANIFEST.json says `unsealed` with a reason and that NO seal sits beside it or SKILL.md; P4 that
      verify-manifest.mjs answers UNSEALED with every file matching, exit 1; P5 does not apply. Without
      the flag an unsealed package FAILs P2, as any package without a seal does.

A verifier that cannot run is a FAIL, never a pass. Exit 0 only when every skill passes.

  python3 tools/check-skill-conformance.py [skills-dir]
  python3 tools/check-skill-conformance.py --packaged <dir|zip> [...] [--keys garden --garden <root>] [--unsealed]
  python3 tools/check-skill-conformance.py --help
"""

from __future__ import annotations

import atexit
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

# A gate loads no bytecode from beside the Python it loads by path. In Fuji-shin's round four (2026-10-25) a .pyc
# planted beside package.py ran in place of the builder under check-skill-conformance.py, under -B too, while the
# builder's sealed bytes stayed untouched: bytecode is code. So before any sibling is loaded, Python's cache points at
# a fresh private folder, removed at exit.
sys.dont_write_bytecode = True
sys.pycache_prefix = tempfile.mkdtemp(prefix="bonsai-pycache-")
atexit.register(shutil.rmtree, sys.pycache_prefix, True)

ROOT = Path(__file__).resolve().parent.parent
SIGN_CLI = ROOT / "skills" / "bonsai-garden-sign" / "bin" / "sign.mjs"
MANY = ROOT / "tools" / "verify-many.mjs"
FM_RE = re.compile(r"^---\n(.*?)\n---\n", re.S)
KEY_RE = re.compile(r"^([A-Za-z][\w-]*):", re.M)
ULID_RE = re.compile(r"^[0-9A-HJKMNP-TV-Z]{26}$")
ALLOWED = {"name", "description", "version"}
BUILDER = ROOT / "skills" / "bonsai-garden-core-plugin" / "scripts" / "package.py"


def _builder():
    """The integrity line and the stamp contract have one definition: the builder's."""
    spec = importlib.util.spec_from_file_location("bonsai_package", BUILDER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


PKG = _builder()


def frontmatter(p: Path) -> tuple[str | None, list[str]]:
    m = FM_RE.match(p.read_text(encoding="utf-8", errors="replace"))
    if not m:
        return None, []
    return m.group(1), KEY_RE.findall(m.group(1))


def field(fm: str, key: str) -> str:
    m = re.search(rf"^{re.escape(key)}:\s*\"?([^\"\n]*)\"?\s*$", fm, re.M)
    return m.group(1).strip() if m else ""


def verify(verb: str, path: Path) -> str:
    if shutil.which("node") is None:
        return "cannot verify: node not found"
    if not SIGN_CLI.is_file():
        return f"cannot verify: {SIGN_CLI} missing"
    # Core alone must be enough: strip every BONSAI_* variable so the verifier cannot borrow keys
    # or a garden root from another checkout. The first version inherited $BONSAI_GARDEN and passed
    # 6/6 on keys that live in the origin's garden; in a clean clone the truth was 1/6 (2026-09-24).
    env = {k: v for k, v in os.environ.items() if not k.startswith("BONSAI_")}
    r = subprocess.run(
        ["node", str(SIGN_CLI), verb, "--file", str(path)],
        capture_output=True,
        text=True,
        timeout=60,
        cwd=str(ROOT),
        env=env,
    )
    first = (r.stdout.strip().splitlines() or r.stderr.strip().splitlines() or ["no output"])[0]
    if r.returncode == 0 and first.startswith("ok"):
        if "[retired-v1]" in first:
            # accepted only while the cutover is warn; the verifier itself refuses after it
            WARNINGS.append(
                f"retired-v1: {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path} "
                f"— a v1 seal (metadata unsigned); re-seal as v2"
            )
        if "[retired-sidecar-name]" in first:
            # the dot-prefixed sidecar change phase 3: accepted only while "sidecar-name" is warn; refused after the flip
            WARNINGS.append(
                f"retired-sidecar-name: {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path} "
                f"— its seal sits at the old name X.bonsaisig; git mv it to .X.bonsaisig, or re-seal"
            )
        return "ok"
    return " ".join(first.split())


WARNINGS: list[str] = []


def finder(jobs: list[tuple[str, Path]]) -> tuple[dict[tuple[str, str], dict], str | None]:
    """Where a seal sits, from the one Node finder (skills/bonsai-garden-sign/lib/sidecar-format.mjs)
    through tools/verify-many.mjs, one process: 'find-sidecar' on a target answers ok | two-sidecars |
    no-sidecar and the path; 'target-of' on a sidecar answers the file it seals and whether it exists.
    This gate builds no sidecar name of its own (the dot-prefixed sidecar change: `.X.bonsaisig` since phase 1b; `X.bonsaisig`
    found, its verdict retired-sidecar-name since phase 3). Returns (answers by (verb, file), why it could not run at all)."""
    if not jobs:
        return {}, None
    if shutil.which("node") is None:
        return {}, "cannot resolve seals: node not found"
    if not MANY.is_file():
        return {}, f"cannot resolve seals: {MANY} missing"
    env = {k: v for k, v in os.environ.items() if not k.startswith("BONSAI_")}
    stdin = "".join(json.dumps({"verb": v, "file": str(p)}) + "\n" for v, p in jobs)
    r = subprocess.run(
        ["node", str(MANY)], input=stdin, capture_output=True, text=True, timeout=120, cwd=str(ROOT), env=env
    )
    out: dict[tuple[str, str], dict] = {}
    for line in r.stdout.splitlines():
        try:
            d = json.loads(line)
            out[(d["verb"], d["file"])] = d
        except (ValueError, KeyError, TypeError):
            continue
    tail = (r.stderr.strip().splitlines() or [f"exit {r.returncode}"])[-1]
    return out, None if out else f"cannot resolve seals: no answer from verify-many.mjs ({tail})"


def check(skill: Path, seen_ids: dict[str, str]) -> list[str]:
    f: list[str] = []
    sk = skill / "SKILL.md"
    if not sk.is_file():
        return ["SKILL.md missing"]
    fm, keys = frontmatter(sk)
    if fm is None:
        f.append("SKILL.md has no frontmatter")
        name = ""
    else:
        name = field(fm, "name")
        extra = [k for k in keys if k not in ALLOWED]
        if extra:
            f.append(f"SKILL.md frontmatter carries {', '.join(extra)} (only name, description, version)")
        if "sign" in keys:
            f.append("SKILL.md carries an embedded sign: block (seal by sidecar)")
    ans, why = finder([("find-sidecar", sk)])
    st = (ans.get(("find-sidecar", str(sk))) or {}).get("status")
    if why:
        f.append(f"SKILL.md seal: {why}")
    elif st == "two-sidecars":
        f.append("SKILL.md: a seal at both names (.SKILL.md.bonsaisig and SKILL.md.bonsaisig); keep one")
    elif st != "ok":
        f.append("SKILL.md seal missing (.SKILL.md.bonsaisig beside it)")
    else:
        v = verify("verify-sidecar", sk)
        if v != "ok":
            f.append(f"SKILL.md seal: {v}")
    ident = skill / "references" / "identity.md"
    if not ident.is_file():
        f.append("references/identity.md missing")
    else:
        ifm, _ = frontmatter(ident)
        if ifm is None:
            f.append("identity.md has no frontmatter")
        else:
            uid = field(ifm, "id")
            if not ULID_RE.match(uid):
                f.append(f"identity.md id is not a ULID: {uid!r}")
            elif uid in seen_ids:
                f.append(f"identity.md id {uid} is also {seen_ids[uid]}'s")
            else:
                seen_ids[uid] = skill.name
            if field(ifm, "type") != "identity":
                f.append("identity.md type is not identity")
            if field(ifm, "skill") != name:
                f.append(f"identity.md skill {field(ifm, 'skill')!r} != SKILL.md name {name!r}")
            if not field(ifm, "tended-by"):
                f.append("identity.md has no tended-by")
            # version lives in SKILL.md (the platform reads it there); a copy here is allowed
            # only while it is the same number — otherwise it is a second master (Bonsai, 09-24)
            iv, sv = field(ifm, "version"), field(fm or "", "version")
            if iv and iv != sv:
                f.append(f"identity.md version {iv!r} != SKILL.md version {sv!r}")
            v = verify("verify", ident)
            if v != "ok":
                f.append(f"identity.md seal: {v}")
    for r in skill.rglob("README.md"):
        if "node_modules" not in r.parts:
            f.append(f"README.md inside the skill folder: {r.relative_to(skill)}")
    sidecars = sorted(skill.rglob("*.bonsaisig"))
    ans, why = finder([("target-of", s) for s in sidecars])
    if why and sidecars:
        f.append(why)
    for s in sidecars:
        d = ans.get(("target-of", str(s))) or {}
        if not why and (d.get("status") != "ok" or not d.get("exists")):
            f.append(f"orphaned sidecar: {s.relative_to(skill)}")
    if PKG.first_body_line(sk.read_text(encoding="utf-8")) != PKG.INTEGRITY_LINE:
        f.append(
            "integrity first: SKILL.md's first body line is not the integrity line "
            "(package.py --write-integrity-line, then the owner re-seals)"
        )
    # 7  every file of the skill is sealed, or is named in tools/unsealed-by-design.json with its reason (2026-10-16:
    #    two crew-page fixtures were unsealed on purpose, and nothing said so; a fixture that gains a seal by accident
    #    stops being the fixture it was, so a listed file that is sealed is a finding too)
    listed = unsealed_by_design()
    targets = [p for p in skill_files(skill) if p != sk]  # SKILL.md's seal is check 2
    ans, why = finder([("find-sidecar", t) for t in targets])
    if why and targets:
        f.append(why)
    elif targets:
        for t in targets:
            rel = t.relative_to(ROOT).as_posix() if t.is_relative_to(ROOT) else None
            st = (ans.get(("find-sidecar", str(t))) or {}).get("status")
            if st == "no-sidecar" and rel not in listed:
                f.append(
                    f"unsealed: {t.relative_to(skill)} (seal it, or name it in {UNSEALED_LIST.relative_to(ROOT)} with its reason)"
                )
            elif st == "ok" and rel in listed:
                f.append(f"listed as unsealed by design, but sealed: {t.relative_to(skill)} (drop it from the list)")
    return f


UNSEALED_LIST = ROOT / "tools" / "unsealed-by-design.json"


def unsealed_by_design() -> dict[str, str]:
    """{repo-relative path: its reason} from tools/unsealed-by-design.json. A list that cannot be read is empty, so
    every unsealed file then counts: a missing list never widens what passes."""
    try:
        return dict(json.loads(UNSEALED_LIST.read_text("utf-8")).get("files") or {})
    except (OSError, ValueError, AttributeError):
        return {}


def skill_files(skill: Path) -> list[Path]:
    """The skill's files without their sidecars: what git tracks there, so an untracked scratch file is not a
    finding; outside a checkout (a planted tree), every file under it but caches and node_modules."""
    r = subprocess.run(["git", "-C", str(skill), "ls-files", "-z", "--", "."], capture_output=True, text=True)
    if r.returncode == 0:
        files = [skill / x for x in r.stdout.split("\0") if x]
    else:
        files = [p for p in skill.rglob("*") if not {"node_modules", "__pycache__"} & set(p.parts)]
    return sorted(p for p in files if p.is_file() and not p.name.endswith(".bonsaisig"))


def _packaged_folders(root: Path) -> list[Path]:
    if (root / "SKILL.md").is_file():
        return [root]
    if (root / ".claude-plugin").is_dir() or (root / "skills").is_dir():
        return sorted(p for p in (root / "skills").iterdir() if (p / "SKILL.md").is_file())
    kids = [p for p in root.iterdir() if p.is_dir() and (p / "SKILL.md").is_file()]
    return kids


def check_packaged(folder: Path, keys: str, garden: str | None, unsealed: bool = False) -> list[str]:
    f: list[str] = []
    sk = folder / "SKILL.md"
    text = sk.read_text(encoding="utf-8")
    fm = FM_RE.match(text)
    keys_in = KEY_RE.findall(fm.group(1)) if fm else []
    extra = [k for k in keys_in if k not in ALLOWED]
    if fm is None or extra:
        f.append(f"P1 SKILL.md frontmatter carries {', '.join(extra) or 'nothing'} (only name, description, version)")
    body, stamp = PKG.split_skill(text)
    if stamp is None:
        f.append("P1 no build stamp as the first body line")
    if body.partition("\n")[0] != PKG.INTEGRITY_LINE:
        f.append("P1 the first line after the stamp is not the integrity line")
    if not (folder / "MANIFEST.json").is_file():
        f.append("P2 MANIFEST.json missing")
    present = [n for n in ("MANIFEST.json", "SKILL.md") if (folder / n).is_file()]
    ans, why = finder([("find-sidecar", folder / n) for n in present])
    if why:
        f.append(f"P2 {why}")
    for n in present:
        st = (ans.get(("find-sidecar", str(folder / n))) or {}).get("status")
        if unsealed and not why and st != "no-sidecar":
            f.append(f"P2 an unsealed build carries a seal beside {n} ({st}): an unsealed build seals nothing")
        elif not unsealed and not why and st != "ok":
            f.append(f"P2 the seal beside {n} is {st or 'missing'} (.{n}.bonsaisig)")
    if unsealed and (folder / "MANIFEST.json").is_file():
        try:
            reason = json.loads((folder / "MANIFEST.json").read_text("utf-8")).get("unsealed")
        except ValueError:
            reason = None
        if not (isinstance(reason, str) and reason.strip()):
            f.append("P2 --unsealed, and MANIFEST.json does not say `unsealed` with a reason")
    idir = folder / PKG.INTEGRITY_DIR
    for n in ("verify-manifest.mjs", "bonsai-garden-sign/lib/verify.mjs", "bonsai-garden-sign/bin/sign.mjs"):
        if not (idir / n).is_file():
            f.append(f"P3 {PKG.INTEGRITY_DIR}/{n} missing")
    marker = folder / "agents" / "registry.json"
    try:
        if json.loads(marker.read_text("utf-8")).get("agents"):
            f.append("P3 the package marker lists agents (a package carries no key and no fingerprint)")
    except Exception:
        f.append("P3 the marker agents/registry.json is missing or unreadable")
    if not f:
        env = {k: v for k, v in os.environ.items() if not k.startswith("BONSAI_")}
        if keys == "garden":
            env["BONSAI_GARDEN"] = garden or ""
        if shutil.which("node") is None:
            f.append("P4 cannot verify: node not found")
        else:
            r = subprocess.run(
                ["node", str(idir / "verify-manifest.mjs"), "--dir", str(folder), "--keys", keys],
                capture_output=True,
                text=True,
                timeout=180,
                env=env,
            )
            line = (r.stdout.strip().splitlines() or r.stderr.strip().splitlines() or ["no output"])[0]
            if unsealed:
                if r.returncode != 1 or not line.startswith("UNSEALED") or "files match" not in line:
                    f.append(f"P4 an unsealed build's own check must answer UNSEALED, every file matching: {line}")
                return f + [
                    f"P6 README.md inside the skill folder: {x.relative_to(folder)}" for x in folder.rglob("README.md")
                ]
            if r.returncode != 0 or not line.startswith("ok"):
                f.append(f"P4 the package's own check: {' '.join(line.split())}")
            r = subprocess.run(
                ["node", str(SIGN_CLI), "verify-sidecar", "--file", str(sk), "--keys", keys],
                capture_output=True,
                text=True,
                timeout=60,
                env=env,
                cwd=str(ROOT),
            )
            out = r.stdout + r.stderr
            first = (out.strip().splitlines() or ["no output"])[0]
            owner = json.loads((folder / "MANIFEST.json").read_text("utf-8")).get("owner")
            if r.returncode != 0 or not first.startswith("ok"):
                f.append(f"P5 SKILL.md seal: {' '.join(first.split())}")
            elif not re.search(rf"^\s*signer:\s*{re.escape(str(owner))}\s*$", out, re.M):
                f.append(f"P5 SKILL.md is not sealed by the owner {owner!r}")
            elif "[retired-v1]" in first:
                WARNINGS.append(
                    f"retired-v1: {folder.name}/SKILL.md — a v1 seal (no role, metadata unsigned); repackage"
                )
            elif not re.search(rf"^\s*sealed as:\s*owner:\s*{re.escape(str(owner))}\s*$", out, re.M):
                f.append("P5 SKILL.md is not a v2 seal in the owner role (a custodian seal is not authorship)")
    for r_ in folder.rglob("README.md"):
        f.append(f"P6 README.md inside the skill folder: {r_.relative_to(folder)}")
    return f


def main_packaged(argv: list[str]) -> int:
    keys, garden, targets, unsealed = "published", None, [], False
    it = iter(argv)
    for x in it:
        if x == "--keys":
            keys = next(it)
        elif x == "--garden":
            garden = next(it)
        elif x == "--unsealed":
            unsealed = True
        else:
            targets.append(Path(x))
    if keys not in ("published", "garden") or (keys == "garden" and not garden):
        print("FAIL  --keys takes published or garden; garden needs --garden <root>")
        return 2
    bad = total = 0
    for t in targets:
        with tempfile.TemporaryDirectory() as tmp:
            root = t
            if t.is_file() and zipfile.is_zipfile(t):
                zipfile.ZipFile(t).extractall(tmp)
                root = Path(tmp)
            elif not t.is_dir():
                print(f"FAIL  {t}: not a directory or a zip")
                bad += 1
                continue
            folders = _packaged_folders(root)
            if not folders:
                print(f"FAIL  {t}: no skill folder in it")
                bad += 1
                continue
            for folder in folders:
                total += 1
                found = check_packaged(folder, keys, garden, unsealed)
                print(
                    f"{'PASS' if not found else 'FAIL'}  {t.name}:{folder.name}{'  (UNSEALED, as named)' if unsealed and not found else ''}"
                )
                for x in found:
                    print(f"        {x}")
                bad += bool(found)
    for w in WARNINGS:
        print(f"WARN  {w}")
    print(f"\n{total - bad}/{total} packaged skill folder(s) conform")
    return 0 if total and not bad else 1


def main() -> int:
    if sys.argv[1:2] in (["--help"], ["-h"]):
        print(__doc__.strip())
        return 0
    if len(sys.argv) > 1 and sys.argv[1] == "--packaged":
        return main_packaged(sys.argv[2:])
    base = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "skills"
    skills = sorted(p for p in base.iterdir() if p.is_dir() and not p.name.startswith("."))
    seen: dict[str, str] = {}
    bad = 0
    # 7, the list's own honesty: a listed file that is gone is a finding, so the list cannot outlive what it names
    for rel in unsealed_by_design():
        if not (ROOT / rel).is_file():
            print(f"FAIL  {UNSEALED_LIST.relative_to(ROOT)} names a file that is not there: {rel}")
            bad += 1
    for s in skills:
        found = check(s, seen)
        print(f"{'PASS' if not found else 'FAIL'}  {s.name}")
        for x in found:
            print(f"        {x}")
        bad += bool(found)
    for w in WARNINGS:
        print(f"WARN  {w}")
    print(f"\n{len(skills) - bad}/{len(skills)} skills conform")
    return 0 if skills and not bad else 1


if __name__ == "__main__":
    sys.exit(main())
