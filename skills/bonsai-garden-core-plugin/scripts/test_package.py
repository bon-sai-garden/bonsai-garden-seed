#!/usr/bin/env python3
# ---
# id: 01M39MJ8RDXS7SHS6CVPTZJMWG
# title: test_package.py — the one builder, watched to fail
# type: script
# tended-by: baisai
# created: 2026-09-24
# updated: 2026-10-21
# ---
"""Negative tests for package.py and verify-manifest.mjs, on planted fixtures only.

Every fixture is planted in a fresh temp directory (a throwaway garden with its own registry,
roll, salts and kin); no real file is touched. Keys are HKDF from this host's master salt and
fixture salts, so the fixture garden's keys exist nowhere else — which is why these tests use
`--keys garden` against the fixture root, plus one published-path case that must be refused.

  T0  control: a well-formed vessel packages; its own wake check says ok; both gates PASS
  T1  bytes differ from MANIFEST at wake (an edited file; an added file) → verify-manifest FAIL
  T2  a sidecar sealed by the wrong key (another kin's seal; a forged signer field; the manifest
      re-sealed by another kin) → refused
  T3  a list naming a kin with no vessel → refused, never skipped (roll member; --only name)
  T4  a seal that verifies only under a RETIRED key still on disk (modelled on Bonsai's
      09d7b894: the registry names the current key, identity/ holds the old one) → refused,
      under garden keys and under the published keys
  T5  a SKILL.md without the integrity line → the builder refuses; the skill gate FAILs
  T6  the stamp contract equals skill_install.py's (when $BONSAI_GARDEN names a garden checkout that holds it)
  T7  an untracked key beside a source is left out; a committed one is refused
  T8  Tasai's case, on a scratch clone of core: ignored *.key / private.* / *.pem planted in a real
      skill folder are left out; a tracked *.key, private*, *.p12 or PEM private-key block is refused
  T10 (the dot-prefixed sidecar change phase 1a) a sidecar under the hidden name `.X.bonsaisig` is read; both names → refused
  T11 (W, 2026-10-16, finding 1) `memory` linked to a live store wakes ok, named; a BROKEN link, a symlink
      anywhere else, and a tampered body behind a live link → FAIL
  T12 (finding 3) a body's scripts/ ships; a nested SKILL.md in it is left out and named
  T13 (finding 4) the package marker names where the files were sealed (`source-path`); the root-path seals
      (SKILL.md, MANIFEST.json) verify in place
  T14 (finding 5) the greeting kit and the kin's registry row ship; fill-greeting.py and text-card.py (with its
      colour gate) run in place; the generated every-kin page names them
  T15 (finding 2) a body whose SKILL.md prose names another build of its own version is refused on the stage
  T16 core alone (the gardener, 2026-10-17: "restore the core-alone build of Bonsai's plugin"), on a scratch clone of
      core with a planted registry and core-plugin.json: no list and no key in a stranger's seat → an UNSEALED LOCAL
      BUILD, said on the first line, whose manifests say so, carry no seal and answer UNSEALED (never ok); the skill
      gate passes it only with --unsealed. --salts through the signing gate → sealed by the owners, wakes ok. --salts
      with no gate → refused, never an unsealed fallback. Another name with no list → refused. M7: a verifier that
      waves an unsealed manifest through is refused by the builder's own wake check.
  T17 what a release leaves out (the gardener, 2026-10-16: those histories "stay in core and leave seed"; Bonsai's F6
      on the release 7a40497e), on T16's scratch clone, its leave-out list (--leave-out, 2.7.0) naming a planted file
      of the kin: the file a tree copy meets is left out of the package and named; a file the plugin names by itself
      is refused; a list that cannot answer (missing, empty, a path outside the checkout, a file it does not track)
      refuses the build; a checkout with no list and no release manifest at its root is refused; one that carries a
      release manifest builds with none; a manifest of another format is no release manifest. M8: a builder that does
      not read the list ships the planted file. M9: a builder that takes no list for nothing left out ships it too.
      M13: a builder that takes any root manifest for a release manifest builds where T17k refuses.
  T19 the app's install, replayed (W's F-1, dry run 3, 2026-10-18: the Claude app re-emits SKILL.md's frontmatter and
      single-quotes `version`, so the plugin's byte-exact manifest failed on a correct install). The packaged SKILL.md
      says version: 'M.m.p' and a YAML read gives that string; the replay changes no byte of the .skill (ok, no
      installer exception) nor of T16b's sealed plugin (the plugin-level check ok). M12: a builder that writes the
      version bare fails the plugin-level check on the replay.
  M*  mutation: each guard is removed from a copy of the code, and the matching test must then
      stop failing. A gate that cannot fail is not a gate.

  python3 test_package.py        exit 0 only when every expectation holds

On a host with no master salt in custody, or no installed signing gate (every seal here goes through it), the run
is a SKIP, said out loud, exit 0: nothing was checked, and the line says so (2026-10-16). It is not a pass.

Its premises come first (2026-10-18): every file it reads from the checkout it sits in, and that checkout a git one.
A premise that is not there is a FAIL, exit 1, before any SKIP: in a bare home the SKIP hid T16's traceback in the
seed (Fuji-shin, the round's first user). `--premises` checks them alone.

A build from a checkout that carries no release manifest names its leave-out list (package.py 2.7.0): every build here
from such a checkout names one, made by LEAVE below, true of the checkout and touching no fixture package.

The signing gate's test mode (2026-10-18): with BONSAI_GATE_TEST_MASTER_SALT (a throwaway) and BONSAI_GATE_BIN in
its environment, every seal goes through the gate under that salt, the fixture keys are derived from it here by a
public-key operation, and the master salt in custody is never read. A seat with no custody can then run it whole.

  python3 test_package.py --premises    exit 0 when every premise holds
"""

from __future__ import annotations

import contextlib
import hashlib
import importlib.util
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
# `--package PATH`: test a patched copy (a hidden one beside this script, so it finds core by marker)
PKG = Path(sys.argv[sys.argv.index("--package") + 1]).resolve() if "--package" in sys.argv else HERE / "package.py"
CORE = HERE.parents[2]
SIGN = CORE / "skills" / "bonsai-garden-sign" / "bin" / "sign.mjs"
SKILL_GATE = CORE / "tools" / "check-skill-conformance.py"
spec =importlib.util.spec_from_file_location("bonsai_package", PKG)
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)

RESULTS: list[tuple[str, bool, str]] = []

# What this suite reads from the checkout it sits in, before any test. Missing: a FAIL, never hidden by a SKIP.
PREMISES = {
    "package.py, the builder under test": PKG,
    "verify-manifest.mjs, the wake check it packages": HERE / "verify-manifest.mjs",
    "sign.mjs, through which every seal here goes": SIGN,
    "check-skill-conformance.py, the skill gate": SKILL_GATE,
    "a git checkout of core, which T8 and T16 clone": CORE / ".git",
}

# The leave-out list every build from the builder's own checkout names when that checkout carries no release manifest
# (package.py 2.7.0: a release makes the real one). Here it only has to be true: it names this suite, a tracked file of
# the checkout that no fixture package carries. Set by main(); empty in a release checkout, which needs none.
LEAVE: tuple[str, ...] = ()

# The signing gate's test mode: a throwaway master salt the gate is handed on stdin, and the gate named beside it.
TEST_SALT = os.environ.get("BONSAI_GATE_TEST_MASTER_SALT", "").strip()
TEST_GATE = os.environ.get("BONSAI_GATE_BIN", "").strip()
TEST_MODE = bool(TEST_SALT and TEST_GATE)


def premises() -> list[str]:
    """Each premise that does not hold, said with what reads it."""
    return [f"{what}: {p} is not there" for what, p in PREMISES.items() if not p.exists()]


def expect(name: str, cond: bool, evidence: str) -> None:
    RESULTS.append((name, cond, evidence))
    print(f"{'PASS' if cond else 'FAIL'}  {name}")
    lines = evidence.strip().splitlines()
    key = [
        line
        for line in lines
        if "✗" in line or line.lstrip().startswith(("FAIL", "ok ", "P4", "PASS  ", "integrity first"))
    ]
    for line in lines if not cond else (key or lines)[:6]:
        print(f"        {line.strip()[:240]}")


def run(
    cmd: list[str],
    env_garden: Path | None = None,
    cwd: Path | None = None,
    opt_out_gate: bool = False,
    home: Path | None = None,
) -> tuple[int, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith("BONSAI_")}
    if home is not None:  # a stranger's seat: an empty HOME holds no signing gate
        env["HOME"] = str(home)
    elif TEST_MODE:  # the gate's test mode reaches every seal but a stranger's, which must find no gate
        env["BONSAI_GATE_TEST_MASTER_SALT"] = TEST_SALT
        env["BONSAI_GATE_BIN"] = TEST_GATE
    if opt_out_gate:
        env["BONSAI_SIGN_VIA_GATE"] = "0"
    if env_garden:
        env["BONSAI_GARDEN"] = str(env_garden)
    r = subprocess.run(cmd, capture_output=True, text=True, env=env, cwd=str(cwd) if cwd else None, timeout=600)
    return r.returncode, (r.stdout + r.stderr)


def pubkey(salt: str, tmp: Path) -> bytes:
    if TEST_MODE:
        # the gate's test mode: the public key from the same throwaway master the gate is handed, by core's own
        # key provider; nothing reads the master salt in custody
        lib = SIGN.parent.parent / "lib" / "key-provider.mjs"
        probe = (
            f"import {{ mintKeyProvider }} from {json.dumps(str(lib))}; "
            "process.stdout.write(mintKeyProvider(process.env.ROUND_TEST_SALT, process.argv[1]).publicKeyHex())"
        )
        env = {k: v for k, v in os.environ.items() if not k.startswith("BONSAI_")}
        env["ROUND_TEST_SALT"] = TEST_SALT
        r = subprocess.run(["node", "--input-type=module", "-e", probe, salt], capture_output=True, text=True, env=env)
        assert r.returncode == 0, r.stderr
        return bytes.fromhex(r.stdout.strip())
    f = tmp / "probe.txt"
    f.write_text("probe\n")
    # `sign.mjs sign` hands back the public key, which the signing gate (default since phase 1b, the signing gate)
    # never does, and is no v2 payload, which the gate refuses: so this one probe opts out, explicitly and
    # logged. Open: after phase 1c this direct read prompts for the Keychain — give the gate a public-key
    # op, or core's custody a throwaway master salt for tests.
    rc, out = run(["node", str(SIGN), "sign", "--agent-salt", salt, "--file", str(f)], opt_out_gate=True)
    assert rc == 0, out
    out = "\n".join(line for line in out.splitlines() if not line.startswith("sign-service: BONSAI_SIGN_VIA_GATE=0"))
    return bytes.fromhex(json.loads(out)["public_key_hex"])


def custody_ready(tmp: Path) -> str | None:
    """Why these tests cannot run on this host, or None. Every seal below goes through the installed signing gate,
    and `pubkey` reads the master salt from custody directly: a clean seat has neither, and then the run skips,
    saying so, instead of failing for a reason that is not the builder's (2026-10-16). The gate's path is asked of
    sign-service.mjs, the one place that knows it."""
    service = SIGN.parent.parent / "sign-service.mjs"
    probe = (
        f"import {{ gateBin }} from {json.dumps(str(service))}; import fs from 'node:fs'; "
        "const b = gateBin(); if (!fs.existsSync(b)) { console.log(b); process.exit(3); }"
    )
    rc, out = run(["node", "--input-type=module", "-e", probe])
    if rc != 0:
        return f"the signing gate is not installed ({out.strip() or f'exit {rc}'}), and every seal here goes through it"
    if TEST_MODE:
        return None  # the throwaway salt stands in for custody, which is not read
    f = tmp / "custody-probe.txt"
    f.write_text("probe\n")
    rc, out = run(
        ["node", str(SIGN), "sign", "--agent-salt", "custody-probe#fixture", "--file", str(f)], opt_out_gate=True
    )
    if rc != 0:
        return f"the master salt cannot be read from custody ({(out.strip().splitlines() or [f'exit {rc}'])[-1]})"
    return None


def _load_ulid():
    root = next(
        d
        for d in Path(__file__).resolve().parents
        if (d / "tools" / "ulid.py").is_file() and (d / "agents" / "registry.json").is_file()
    )
    spec = importlib.util.spec_from_file_location("core_ulid", root / "tools" / "ulid.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ULID = _load_ulid()


def fp32(pub: bytes) -> str:
    return hashlib.sha256(pub).hexdigest()[:32]


# ── the planted garden ─────────────────────────────────────────────────────────────────────

# "<slug>-sign#" so the signing gate (the default since phase 1b) accepts each as that kin's key; the
# "fixture" suffix keeps them apart from every real salt, so the keys still exist nowhere else.
KIN = {
    "fixkin": "fixkin-sign#fixture-1",
    "fixother": "fixother-sign#fixture-1",
    "bonsai": "bonsai-sign#fixture-retired-1",
}  # bonsai's here is the RETIRED key's salt
CURRENT_BONSAI = "028019b7c448884c64b6332f5d7609c0"  # what a registry names today


def skill_md(slug: str, integrity: bool = True, prose: str = "") -> str:
    body = (P.INTEGRITY_LINE + "\n\n" if integrity else "") + f"# {slug}\n\nA planted fixture vessel.\n" + prose
    return (
        f"---\nname: {slug}\ndescription: \"Planted fixture {slug} for the builder's negative tests.\"\n"
        f"version: 3.0.0\n---\n{body}"
    )


def plant(tmp: Path) -> Path:
    g = tmp / "garden"
    keys = {s: pubkey(salt, tmp) for s, salt in KIN.items()}
    reg = []
    for s in ("fixkin", "fixother", "bonsai", "ghost"):
        fp = CURRENT_BONSAI if s == "bonsai" else (fp32(keys[s]) if s in keys else "ab" * 16)
        reg.append(
            {"slug": s, "status": "active", "shintai": "own", "path": f"agents/{s}", "fp8": fp[:8], "fingerprint": fp}
        )
    # what the greeting kit reads from a kin's row (T14: the kit runs where the body is installed)
    reg[0].update({"name": "Fixkin", "kanji": "盆栽", "accent-rgba": "rgba(10,20,30,0.35)"})
    (g / "agents").mkdir(parents=True)
    (g / "agents" / "registry.json").write_text(json.dumps({"agents": reg}, indent=2))
    (g / "salts.json").write_text(json.dumps({"agents": {s: {"signing_salt": v} for s, v in KIN.items()}}))
    (g / "roll.md").write_text("".join(f"| {a['slug']} | ✅ `{a['fp8']}` |\n" for a in reg if a["slug"] == "fixkin"))
    (g / "roll-with-ghost.md").write_text(
        "".join(f"| {a['slug']} | ✅ `{a['fp8']}` |\n" for a in reg if a["slug"] in ("fixkin", "ghost"))
    )
    d = g / "agents" / "fixother" / "identity"
    d.mkdir(parents=True)
    (d / "fixother-public-key.bin").write_bytes(keys["fixother"])
    (d / "fixother-fingerprint.txt").write_text(fp32(keys["fixother"]) + "\n")
    for s in ("fixkin", "bonsai"):
        d = g / "agents" / s
        for sub in ("references", "identity", "memory", "assets"):
            (d / sub).mkdir(parents=True)
        (d / "SKILL.md").write_text(skill_md(s))
        # seal v2: a document carries its own id, minted by core's ulid.py, or it is not sealed
        (d / "references" / "about-me.md").write_text(
            f"---\nid: {ULID.new_ulid()}\ntitle: {s}\ntended-by: {s}\nversion: 3.0.0\n---\n# About {s}\n"
        )
        # a seal has no default role (Tasai, 2026-09-24): the kin's files credit the kin, so a
        # role-less seal by that kin infers owner; a lean SKILL.md credits its identity document
        (d / "memory" / "identity.md").write_text(
            f"---\nid: {ULID.new_ulid()}\ntitle: {s} identity\ntended-by: {s}\n---\n"
        )
        (d / "identity" / f"{s}-public-key.bin").write_bytes(keys[s])
        (d / "identity" / f"{s}-fingerprint.txt").write_text(fp32(keys[s]) + "\n")
        (d / "assets" / f"{s}-mark.svg").write_text("<svg xmlns='http://www.w3.org/2000/svg'/>\n")
        # the greeting's inputs (T14): a thumb with its meta, and the intro line
        (d / "assets" / "portrait-thumb.b64").write_text("AAAA\n")
        (d / "assets" / "portrait-thumb.b64.meta").write_text(
            json.dumps({"bytes": 3, "checksum_fnv1a32": "811c9dc5", "mime": "image/jpeg"})
        )
        (d / "assets" / "intro.md").write_text(f'# {s}\n\n## The line\n\n> "A planted line, {s}."\n')
        (d / "memory" / "working-state.md").write_text("---\ntitle: ws\n---\n")
    run(["git", "init", "-q", str(g)])
    reseal(g, "fixkin")
    # bonsai (retired): sealed with the retired key; the registry names the current one. The seal
    # step itself refuses (the registry cross-check in sign-sidecar), so seal it with a registry
    # that does not list bonsai — exactly how a key forged outside the keyring would have sealed.
    saved = (g / "agents" / "registry.json").read_text()
    (g / "agents" / "registry.json").write_text(json.dumps({"agents": [a for a in reg if a["slug"] != "bonsai"]}))
    reseal(g, "bonsai")
    (g / "agents" / "registry.json").write_text(saved)
    commit(g)
    list_(g, "list.json", "roll.md", [{"name": "crew", "kind": "bodies", "roll": "crew", "root": "f"}])
    return g


def reseal(g: Path, slug: str, as_: str | None = None) -> str:
    d = g / "agents" / slug
    who = as_ or slug
    # another kin's key claiming the body is the forgery these tests exist to refuse: it must say
    # --role owner out loud (no default role would ever make that claim for it)
    role = ["--role", "owner"] if who != slug else []
    rc1, o1 = run(
        [
            "node",
            str(SIGN),
            "seal",
            "--agent-salt",
            KIN[who],
            "--file",
            str(d / "references" / "about-me.md"),
            "--as",
            who,
            *role,
        ],
        g,
    )
    rc2, o2 = run(
        [
            "node",
            str(SIGN),
            "sign-sidecar",
            "--agent-salt",
            KIN[who],
            "--file",
            str(d / "SKILL.md"),
            "--as",
            who,
            *role,
        ],
        g,
    )
    assert rc1 == 0 and rc2 == 0, o1 + o2
    return o2


def commit(g: Path) -> None:
    run(["git", "-C", str(g), "add", "-A"])
    run(
        [
            "git",
            "-C",
            str(g),
            "-c",
            "user.name=fixture",
            "-c",
            "user.email=f@x",
            "commit",
            "-qm",
            "fixture",
            "--allow-empty",
        ]
    )


def list_(g: Path, name: str, roll: str, packages: list[dict]) -> Path:
    p = g / name
    p.write_text(
        json.dumps(
            {
                "roots": {"f": "."},
                "registries": ["f"],
                "signing-salts": "f:salts.json",
                "rolls": {"crew": {"file": f"f:{roll}", "member": "✅\\s*`([0-9a-f]{8})`", "registry-key": "fp8"}},
                "out": "f:out",
                "packages": packages,
            },
            indent=2,
        )
    )
    return p


def build(g: Path, lst: str, *extra: str, pkg: Path = PKG) -> tuple[int, str]:
    return run([sys.executable, str(pkg), "--list", str(g / lst), "--keys", "garden", *LEAVE, *extra])


def wake(pkg_dir: Path, g: Path, script: Path | None = None) -> tuple[int, str]:
    s = script or pkg_dir / "scripts" / "integrity" / "verify-manifest.mjs"
    return run(["node", str(s), "--dir", str(pkg_dir), "--keys", "garden"], g)


def extract(zipf: Path, into: Path) -> Path:
    if into.exists():
        shutil.rmtree(into)
    zipfile.ZipFile(zipf).extractall(into)
    return into / zipf.stem


def mutant(src: Path, dst: Path, old: str, new: str) -> Path:
    t = src.read_text(encoding="utf-8")
    assert old in t, f"mutation anchor not found in {src.name}: {old!r}"
    dst.write_text(t.replace(old, new, 1), encoding="utf-8")
    return dst


def yaml_read(fm: str) -> dict:
    """The frontmatter as a YAML reader takes it: PyYAML where the host has it, else the one form T19 needs (a
    top-level `key: value`, a single-quoted value read by YAML's own rule, '' for a quote)."""
    try:
        import yaml  # optional on a host; the fallback below reads what T19 asks

        data = yaml.safe_load(fm)
        return data if isinstance(data, dict) else {}
    except ImportError:
        out: dict = {}
        for line in fm.splitlines():
            m = re.match(r"^([A-Za-z_][\w-]*):[ \t]*(.*?)[ \t]*$", line)
            if m:
                v = m.group(2)
                out[m.group(1)] = v[1:-1].replace("''", "'") if len(v) > 1 and v[0] == v[-1] == "'" else v
        return out


def app_rewrite(text: str) -> str:
    """SKILL.md as the Claude app writes it back on install (W's F-1, dry run 3 on the work Mac, 2026-10-18, core
    de06d79): it parses the frontmatter and re-emits it, and in all 12 bundled skills the one line it changed was
    `version`, single-quoted (`version: 3.1.4` -> `version: '3.1.4'`); name, description and the body byte-identical."""
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        return text
    v = yaml_read(m.group(1)).get("version")
    if v is None:
        return text
    line = "version: '" + str(v).replace("'", "''") + "'"
    fm = re.sub(r"^version:.*$", lambda _m: line, m.group(1), count=1, flags=re.M)
    return text[: m.start(1)] + fm + text[m.end(1) :]


def replay_install(root: Path) -> list[str]:
    """The app's rewrite on every SKILL.md under root, in place; the ones whose bytes it changed."""
    changed = []
    for s in sorted(root.rglob("SKILL.md")):
        before = s.read_bytes()
        s.write_bytes(app_rewrite(before.decode("utf-8")).encode("utf-8"))
        if s.read_bytes() != before:
            changed.append(s.relative_to(root).as_posix())
    return changed


# ── the tests ──────────────────────────────────────────────────────────────────────────────


def main() -> int:
    bad = premises()
    for b in bad:
        print(f"FAIL  premise: {b}")
    if "--premises" in sys.argv:
        print(
            f"premises: {len(PREMISES) - len(bad)}/{len(PREMISES)} hold"
            + ("" if not bad else ", and the suite cannot run")
        )
        return 1 if bad else 0
    if bad:
        print(
            f"FAIL  test_package.py: {len(bad)} of {len(PREMISES)} premises are not there; the suite cannot run in "
            "this checkout, with custody or without (not a skip)"
        )
        return 1
    if TEST_MODE:
        print("test mode: every seal through the signing gate under a throwaway master salt; custody is not read")
    with tempfile.TemporaryDirectory(prefix="bonsai-package-test-") as t:
        tmp = Path(t)
        why = custody_ready(tmp)
        if why:
            print(f"SKIP  test_package.py: {why}; nothing was checked (0 of 0 expectations hold: skipped, not passed)")
            return 0
        global LEAVE
        if not P.is_release(CORE):
            own = tmp / "leave-out-own.txt"
            own.write_text(Path(os.path.relpath(Path(__file__).resolve(), CORE)).as_posix() + "\n", encoding="utf-8")
            LEAVE = ("--leave-out", str(own))
        g = plant(tmp)

        # T0 control
        rc, out = build(g, "list.json")
        expect("T0 control: a well-formed vessel packages, gates PASS", rc == 0 and "gates PASS" in out, out)
        pkg = extract(g / "out" / "fixkin.zip", tmp / "x0")
        rc, out = wake(pkg, g)
        expect("T0 control: the package's own wake check says ok", rc == 0 and out.startswith("ok"), out)
        # T19a (W's F-1, 2026-10-18) the packaged SKILL.md carries its version single-quoted, as the app writes it back;
        # a YAML read gives the same string; the app's rewrite, replayed, leaves every byte as sealed, and the check says
        # ok with no installer exception (skill_body stays the backstop, unused here)
        fm19 = (P.FM_RE.match((pkg / "SKILL.md").read_text(encoding="utf-8")) or [None, ""])[1] or ""
        v19 = [ln for ln in fm19.splitlines() if ln.startswith("version:")]
        expect(
            "T19a the packaged SKILL.md says version: '3.0.0', single-quoted, and a YAML read gives the string '3.0.0'",
            v19 == ["version: '3.0.0'"] and yaml_read(fm19).get("version") == "3.0.0",
            f"{v19} -> {yaml_read(fm19).get('version')!r}",
        )
        x19 = tmp / "x19"
        shutil.copytree(pkg, x19)
        changed = replay_install(x19)
        rc, out = wake(x19, g)
        expect(
            "T19a the app's install rewrite, replayed on the .skill: no byte changes, and its check says ok with no "
            "installer exception",
            not changed and rc == 0 and out.startswith("ok") and "rewritten by the installer" not in out,
            f"changed by the replay: {changed} | {out}",
        )
        rc, out = run(
            [
                sys.executable,
                str(SKILL_GATE),
                "--packaged",
                str(g / "out" / "fixkin.zip"),
                "--keys",
                "garden",
                "--garden",
                str(g),
            ]
        )
        expect("T0 control: skill gate --packaged PASS on the archive", rc == 0, out)
        names = zipfile.ZipFile(g / "out" / "fixkin.zip").namelist()
        skills = [n for n in names if n.rsplit("/", 1)[-1] == "SKILL.md"]
        expect(
            "T0 exactly one SKILL.md in a package, at its root (Claude refuses nested skills)",
            skills == ["fixkin/SKILL.md"],
            str(skills),
        )
        # the sign skill's seal sits at the hidden name since core's phase-2 rename
        mpkg = mutant(
            PKG,
            PKG.with_name(f".mutant-nested-{os.getpid()}.py"),
            '"sign-service.mjs",\n',
            '"sign-service.mjs", "SKILL.md", ".SKILL.md.bonsaisig",\n',
        )
        try:
            rc, out = build(g, "list.json", pkg=mpkg)
        finally:
            mpkg.unlink()
        expect(
            "T0 a builder that vendors the verifier's SKILL.md is refused, not shipped",
            rc == 1 and "exactly one SKILL.md" in out,
            out,
        )
        rc, out = build(g, "list.json")  # the refused mutant left nothing behind; build it again
        expect("T0 rebuilt by the real builder after the mutant", rc == 0, out)

        # T10: both names beside one file is refused; either name alone is read. Since phase 1b
        # (2026-10-05) the writer seals under the hidden name, so the fixture's own seals are `.X.bonsaisig`
        # and the plants copy them back onto the old name.
        (tmp / "t10").mkdir()
        g10 = plant(tmp / "t10")
        AM = "agents/fixkin/references/about-me.md"
        HID_AM = "agents/fixkin/references/.about-me.md.bonsaisig"
        shutil.copy(g10 / HID_AM, g10 / (AM + ".bonsaisig"))
        commit(g10)
        rc, out = build(g10, "list.json")
        expect(
            "T10a both names beside about-me.md: refused, naming two sidecars", rc == 1 and "two sidecars" in out, out
        )
        run(["git", "-C", str(g10), "rm", "-q", "-f", AM + ".bonsaisig"])
        shutil.copy(g10 / "agents/fixkin/.SKILL.md.bonsaisig", g10 / "agents/fixkin/SKILL.md.bonsaisig")
        commit(g10)
        rc, out = build(g10, "list.json")
        expect("T10b both names beside SKILL.md: refused, naming two sidecars", rc == 1 and "two sidecars" in out, out)
        run(["git", "-C", str(g10), "rm", "-q", "-f", "agents/fixkin/SKILL.md.bonsaisig"])
        commit(g10)
        rc, out = build(g10, "list.json")
        expect(
            "T10c SKILL.md and about-me.md sealed under the hidden name only (the writer's own name since "
            "phase 1b): packages, gates PASS",
            rc == 0 and "gates PASS" in out,
            out,
        )
        if rc == 0:
            pkg10 = extract(g10 / "out" / "fixkin.zip", tmp / "x10")
            rc, out = wake(pkg10, g10)
            expect("T10c … and the package's own wake check says ok", rc == 0 and out.startswith("ok"), out)
            names10 = zipfile.ZipFile(g10 / "out" / "fixkin.zip").namelist()
            expect(
                "T10c … the hidden about-me seal ships under its hidden name, and only once",
                "fixkin/references/.about-me.md.bonsaisig" in names10
                and "fixkin/references/about-me.md.bonsaisig" not in names10,
                str([n for n in names10 if "about-me" in n]),
            )
            # T10f (the dot-prefixed sidecar change phase 3) the manifest's own seal moved to the old name: the wake check finds it
            # through the shipped finder and gives the shipped policy's verdict, never "not in the manifest"
            hid_m, old_m = pkg10 / ".MANIFEST.json.bonsaisig", pkg10 / "MANIFEST.json.bonsaisig"
            shipped = json.loads((pkg10 / "scripts/integrity/bonsai-garden-sign/seal-policy.json").read_text("utf-8"))
            hid_m.rename(old_m)
            rc, out = wake(pkg10, g10)
            if shipped.get("sidecar-name") == "warn":
                expect(
                    "T10f the manifest sealed at the old name, shipped policy warn: ok, with a warning naming the old name",
                    rc == 0 and out.startswith("ok") and "old name" in out and "not in the manifest" not in out,
                    out,
                )
            else:
                expect(
                    "T10f the manifest sealed at the old name, shipped policy refuse: refused as retired-sidecar-name",
                    rc == 1 and "retired-sidecar-name" in out and "not in the manifest" not in out,
                    out,
                )
            old_m.rename(hid_m)
        # T10d (the dot-prefixed sidecar change phase 3) about-me.md sealed under the old name only: core's seal-policy.json
        # "sidecar-name" decides. Read from a scratch copy of the real policy file, through a test copy
        # of the builder whose one override line names it; never core's own file.
        run(["git", "-C", str(g10), "mv", HID_AM, AM + ".bonsaisig"])
        commit(g10)
        real_policy = json.loads((P.SIGN_DIR / "seal-policy.json").read_text(encoding="utf-8"))
        for mode in ("warn", "refuse"):
            pol = tmp / f"t10d-policy-{mode}.json"
            pol.write_text(json.dumps({**real_policy, "sidecar-name": mode}), encoding="utf-8")
            try:
                mp = mutant(
                    PKG,
                    PKG.with_name(f".policy-{mode}-{os.getpid()}.py"),
                    "SEAL_POLICY_OVERRIDE: Path | None = None",
                    f"SEAL_POLICY_OVERRIDE: Path | None = Path({str(pol)!r})",
                )
            except AssertionError as exc:  # a builder with no policy hook: run it as it is, so the
                mp, note = None, f" [{exc}]"  # expectation fails on what it does, not on the anchor
            else:
                note = ""
            try:
                rc, out = build(g10, "list.json", pkg=mp or PKG)
            finally:
                if mp:
                    mp.unlink()
            out += note
            fix = "retired-sidecar-name" in out and "git mv" in out and ".about-me.md.bonsaisig" in out
            if mode == "warn" and real_policy.get("sidecar-name") == "warn":
                expect(
                    "T10d warn: the old name still packages, with a printed warning naming the fix",
                    rc == 0 and "gates PASS" in out and fix,
                    out,
                )
            elif mode == "warn":
                # The sunset set the real policy to refuse. A whole build also shells out to the Node
                # verifier, which reads the REAL policy and never an environment variable, so a scratch warn cannot
                # carry an old-name seal through it any more. The builder's own warn path stays tested where it
                # lives: _sidecar_of under a scratch policy, directly.
                old_dir = tmp / "t10d-unit"
                old_dir.mkdir(exist_ok=True)
                (old_dir / "x.md").write_text("fixture\n")
                (old_dir / "x.md.bonsaisig").write_text("{}\n")
                saved, buf = P.SEAL_POLICY_OVERRIDE, io.StringIO()
                P.SEAL_POLICY_OVERRIDE = pol
                P._WARNED.clear()
                try:
                    with contextlib.redirect_stderr(buf):
                        got = P._sidecar_of(old_dir / "x.md")
                finally:
                    P.SEAL_POLICY_OVERRIDE = saved
                expect(
                    "T10d warn (builder unit, the real policy is refuse): the old sidecar is carried, with a printed WARN naming the fix",
                    got == old_dir / "x.md.bonsaisig"
                    and "WARN" in buf.getvalue()
                    and "retired-sidecar-name" in buf.getvalue()
                    and "git mv" in buf.getvalue(),
                    buf.getvalue(),
                )
            else:
                expect(
                    "T10d refuse: the old name refuses the package, naming retired-sidecar-name and the fix",
                    rc == 1 and fix,
                    out,
                )

        # T10e (the dot-prefixed sidecar change phase 2) an `exclude` pattern leaves a file's sidecar out with it, under
        # either name: after core's rename `.test-x.mjs.bonsaisig` no longer matched `test-*` and
        # the core plugin shipped nine orphaned seals (2026-10-05). Exactly one dot comes off a hidden
        # stem: `..test-dot.bonsaisig` seals `.test-dot`, which `test-*` does not exclude.
        ex = getattr(P, "_excluded", None)
        expect(
            "T10e an excluded file's sidecar is excluded with it, old name and hidden name",
            ex is not None
            and ex("test-x.mjs", ["test-*"])
            and ex("test-x.mjs.bonsaisig", ["test-*"])
            and ex(".test-x.mjs.bonsaisig", ["test-*"])
            and not ex("..test-dot.bonsaisig", ["test-*"])
            and ex(".fixtures.bonsaisig", ["fixtures"])
            and not ex(".lib.mjs.bonsaisig", ["test-*"])
            and not ex("latest-x.mjs", ["test-*"]),
            "no _excluded in package.py" if ex is None else "",
        )

        # T1s the stamp and the manifest say what was built, never where from (2026-10-21: a shipped file says nothing of
        # where it was made): version first, as the conformance gate reads it
        sp = extract(g / "out" / "fixkin.zip", tmp / "xstamp")
        stamp = P.split_skill((sp / "SKILL.md").read_text(encoding="utf-8"))[1] or ""
        mdata = json.loads((sp / "MANIFEST.json").read_text(encoding="utf-8"))
        expect(
            "T1s the stamp is version and body only, and the manifest names no source",
            re.fullmatch(r"\d+\.\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+?)?-\d{8}T\d{4}Z · body [0-9a-f]{8}", stamp) is not None
            and "source" not in mdata
            and " from " not in stamp,
            f"stamp {stamp!r}; manifest keys {sorted(mdata)}",
        )

        # T1 tampered bytes at wake
        (pkg / "references" / "about-me.md").write_text((pkg / "references" / "about-me.md").read_text() + "x")
        rc, out = wake(pkg, g)
        expect("T1a an edited file is refused at wake", rc == 1 and "changed: references/about-me.md" in out, out)
        pkg = extract(g / "out" / "fixkin.zip", tmp / "x1")
        (pkg / "scripts" / "run-me.sh").write_text("echo hi\n")
        rc, out = wake(pkg, g)
        expect("T1b an added file is refused at wake", rc == 1 and "not in the manifest: scripts/run-me.sh" in out, out)
        pkg = extract(g / "out" / "fixkin.zip", tmp / "x1c")
        (pkg / "patterns.md").write_text("new\n") if not (pkg / "patterns.md").exists() else None
        (pkg / "memory" / "MEMORY.md").unlink()
        rc, out = wake(pkg, g)
        expect("T1c a removed file is refused at wake", rc == 1 and "missing: memory/MEMORY.md" in out, out)
        rc, out = run([sys.executable, str(SKILL_GATE), "--packaged", str(pkg), "--keys", "garden", "--garden", str(g)])
        expect("T1d the skill gate FAILs a tampered package (P4)", rc == 1 and "P4" in out, out)

        # T2 wrong key
        pkg = extract(g / "out" / "fixkin.zip", tmp / "x2")
        run(
            [
                "node",
                str(SIGN),
                "sign-sidecar",
                "--agent-salt",
                KIN["fixother"],
                "--file",
                str(pkg / "MANIFEST.json"),
                "--as",
                "fixother",
                "--role",
                "owner",
            ],
            g,
        )  # the forged owner claim, said out loud
        rc, out = wake(pkg, g)
        expect(
            "T2a a manifest re-sealed by another kin is refused at wake",
            rc == 1 and "manifest sealed by 'fixother', but its owner is 'fixkin'" in out,
            out,
        )
        reseal(g, "fixkin", as_="fixother")
        commit(g)
        rc, out = build(g, "list.json")
        expect(
            "T2b a source SKILL.md sealed by another kin's key is refused",
            rc == 1 and "sealed by 'fixother', not the owner 'fixkin'" in out,
            out,
        )
        side = g / "agents" / "fixkin" / ".SKILL.md.bonsaisig"  # the writer's name since phase 1b
        d = json.loads(side.read_text())
        d["signer"] = "fixkin"
        d["fingerprint"] = json.loads((g / "agents" / "registry.json").read_text())["agents"][0]["fingerprint"]
        side.write_text(json.dumps(d, indent=2) + "\n")
        commit(g)
        rc, out = build(g, "list.json")
        expect(
            "T2c a forged signer field over another kin's signature is refused", rc == 1 and "bad-signature" in out, out
        )
        reseal(g, "fixkin")
        commit(g)

        # T3 a kin with no vessel
        list_(
            g,
            "list-ghost.json",
            "roll-with-ghost.md",
            [{"name": "crew", "kind": "bodies", "roll": "crew", "root": "f"}],
        )
        rc, out = build(g, "list-ghost.json")
        expect(
            "T3a a roll member with no vessel is refused, never skipped",
            rc == 1 and "ghost: no vessel at" in out and "never skipped" in out and "fixkin" in out,
            out,
        )
        rc, out = build(g, "list.json", "--only", "nosuch")
        expect(
            "T3b --only a name the list does not hold is refused", rc == 1 and "the list does not name it" in out, out
        )
        list_(g, "list-body-ghost.json", "roll.md", [{"kind": "body", "slug": "ghost", "root": "f"}])
        rc, out = build(g, "list-body-ghost.json")
        expect("T3c a named body with no vessel is refused", rc == 1 and "ghost: no vessel at" in out, out)

        # T4 retired key on disk
        list_(g, "list-bonsai.json", "roll.md", [{"kind": "body", "slug": "bonsai", "root": "f"}])
        rc, out = build(g, "list-bonsai.json")
        # seal v2: the verifier itself now checks the key on disk against the registry,
        # so the refusal can come a layer earlier, as bad-signature — the same finding, sooner
        expect(
            "T4a a seal verifying only under a retired key on disk is refused (garden keys)",
            rc == 1
            and (
                ("a key the registry does not name for bonsai" in out and "028019b7" in out)
                or "SKILL.md [bad-signature]" in out
            ),
            out,
        )
        # T4b and T8a ask the PUBLISHED keys about v2 seals: they pass only once the v2 /verify
        # is deployed at bon-sai.garden (before it, the live site answers a v2 request 400, which
        # reads keys-unreachable — refused, but not for the reason T4b names)
        rc, out = run([sys.executable, str(PKG), "--list", str(g / "list-bonsai.json"), "--keys", "published", *LEAVE])
        expect(
            "T4b the same under the published keys is refused",
            rc == 1 and "REFUSED" in out and ("rejected" in out or "bad-signature" in out),
            out,
        )

        # T5 no integrity line
        (g / "agents" / "fixkin" / "SKILL.md").write_text(skill_md("fixkin", integrity=False))
        reseal(g, "fixkin")
        commit(g)
        rc, out = build(g, "list.json")
        expect(
            "T5a a SKILL.md without the integrity line is refused",
            rc == 1 and "first body line is not the integrity line" in out,
            out,
        )
        sk = tmp / "skills" / "fix-skill"
        (sk / "references").mkdir(parents=True)
        (sk / "SKILL.md").write_text(skill_md("fix-skill", integrity=False))
        rc, out = run([sys.executable, str(SKILL_GATE), str(tmp / "skills")])
        expect(
            "T5b the skill gate FAILs a source skill without the integrity line",
            rc == 1 and "integrity first" in out,
            out,
        )
        (g / "agents" / "fixkin" / "SKILL.md").write_text(skill_md("fixkin"))
        reseal(g, "fixkin")
        commit(g)

        # T7 what is not committed does not ship; key material is refused even when committed
        secret = g / "agents" / "fixkin" / "references" / "private.key"
        pem_head = "-----BEGIN " + "PRIVATE KEY-----"  # assembled, so this file holds no key header
        secret.write_text(pem_head + "\nplanted\n")
        (g / ".gitignore").write_text("agents/fixkin/references/private.key\n")
        commit(g)
        rc, out = build(g, "list.json")
        names = zipfile.ZipFile(g / "out" / "fixkin.zip").namelist() if rc == 0 else []
        expect(
            "T7a an untracked (ignored) key beside the source is left out of the archive",
            rc == 0 and "fixkin/references/private.key" not in names and "untracked file(s) left out" in out,
            out,
        )
        (g / ".gitignore").unlink()
        commit(g)
        rc, out = build(g, "list.json")
        expect("T7b a committed key file is refused", rc == 1 and "key material reached the stage" in out, out)
        secret.unlink()
        commit(g)

        # T8 Tasai's case: a scratch clone of core, key-shaped files planted in a real skill folder
        # the garden whose salts seal a real skill: the one $BONSAI_GARDEN names, never a checkout found by its name
        garden = Path(os.environ["BONSAI_GARDEN"]) if os.environ.get("BONSAI_GARDEN") else None
        if TEST_MODE:
            # T8 packages a real skill, sealed again as its real owner and read back from the published keys: a
            # throwaway salt is no owner's key, so in the gate's test mode it is not checked, and says so
            print("NOT CHECKED  T8 in the gate's test mode: it seals a real skill as its owner, which only custody can")
        elif garden is not None and (garden / "tools" / "keyring" / "locked-salts.json").is_file():
            clone = tmp / "core-clone"
            run(["git", "clone", "-q", "--local", str(CORE), str(clone)])
            ident = clone / "skills" / "bonsai-garden-portrait" / "identity" / "planted"
            ident.mkdir(parents=True)
            pem_head = "-----BEGIN " + "PRIVATE KEY-----"
            for n, body in (("planted.key", "x\n"), ("private.pem", pem_head + "\nplanted\n"), ("private.txt", "x\n")):
                (ident / n).write_text(body)
            (clone / ".git" / "info" / "exclude").write_text("skills/bonsai-garden-portrait/identity/planted/\n")
            lst = tmp / "clone-list.json"
            lst.write_text(
                json.dumps(
                    {
                        "roots": {"core": str(clone), "garden": str(garden)},
                        "registries": ["garden", "core"],
                        "signing-salts": "garden:tools/keyring/locked-salts.json",
                        "out": "core:../clone-out",
                        "packages": [
                            {
                                "kind": "skill",
                                "skill": "core:skills/bonsai-garden-portrait",
                                "name": "bonsai-garden-portrait",
                            }
                        ],
                    }
                )
            )
            rc, out = run([sys.executable, str(PKG), "--list", str(lst), *LEAVE])
            arch = tmp / "clone-out" / "bonsai-garden-portrait.zip"
            names = zipfile.ZipFile(arch).namelist() if rc == 0 and arch.exists() else []
            expect(
                "T8a ignored key-shaped files planted in a skill folder of a scratch clone are left out",
                rc == 0 and not any("planted" in n for n in names) and "untracked file(s) left out" in out,
                out + f"\narchive entries naming 'planted': {[n for n in names if 'planted' in n]}",
            )
            for label, name, body in (
                ("a tracked *.key", "tracked.key", "x\n"),
                ("a tracked file holding a PEM private-key block", "notes.txt", pem_head + "\nx\n"),
                ("a tracked private* file", "private-notes.md", "x\n"),
                ("a tracked *.p12", "bundle.p12", "x\n"),
            ):
                f = clone / "skills" / "bonsai-garden-portrait" / "references" / name
                f.write_text(body)
                run(["git", "-C", str(clone), "add", "-f", str(f)])
                run(
                    [
                        "git",
                        "-C",
                        str(clone),
                        "-c",
                        "user.name=fixture",
                        "-c",
                        "user.email=f@x",
                        "commit",
                        "-qm",
                        "plant",
                    ]
                )
                rc, out = run([sys.executable, str(PKG), "--list", str(lst), *LEAVE])
                expect(
                    f"T8 {label} is refused outright",
                    rc == 1 and "key material reached the stage" in out and f"references/{name}" in out,
                    out,
                )
                run(["git", "-C", str(clone), "reset", "-q", "--hard", "HEAD~1"])
        else:
            print("NOT CHECKED  T8 needs the salts of the garden $BONSAI_GARDEN names (the portrait skill is sealed by baisai)")

        # T6 stamp contract parity with skill_install.py
        si = garden / "tools" / "bonsai-mcp" / "skill_install.py" if garden is not None else None
        if si is not None and si.is_file():
            s2 = importlib.util.spec_from_file_location("skill_install_probe", si)
            SI = importlib.util.module_from_spec(s2)
            s2.loader.exec_module(SI)
            samples = [
                skill_md("a"),
                "no frontmatter\n",
                "---\nname: x\n---\n> Installed build: 1.0.0.1-x-20261021T0900Z · body 1234abcd\n\nbody\n",
                "---\nname: x\n---\n> Installed build: 1.0.0.1-x · from r@h · body 1\n\nbody\n",  # an older package's
                "---\nname: x\n---\n> Installed build: y\nno blank\n",
                "---\nname: x\n---\n",
            ]
            same = SI.STAMP_PREFIX == P.STAMP_PREFIX and all(
                SI.split_skill(s) == P.split_skill(s) and SI.body_hash(s) == P.body_hash(s) for s in samples
            )
            expect(
                "T6 the stamp contract equals skill_install.py's", same, f"{len(samples)} samples compared against {si}"
            )
        else:
            print("NOT CHECKED  T6 no garden named by $BONSAI_GARDEN holds skill_install.py; the parity was not compared")

        # T9 bundle: the shared documents every body carries for a session with no garden MCP
        shared = g / "shared"
        shared.mkdir()
        canon = shared / "codex.md"
        canon.write_text(f"---\nid: {ULID.new_ulid()}\ntitle: fixture codex\ntended-by: fixother\n---\n# Codex\n")
        rc, o = run(
            [
                "node",
                str(SIGN),
                "sign-sidecar",
                "--agent-salt",
                KIN["fixother"],
                "--file",
                str(canon),
                "--as",
                "fixother",
            ],
            g,
        )
        assert rc == 0, o
        commit(g)

        def bundle_list(name: str, files: dict) -> str:
            p = list_(g, name, "roll.md", [{"kind": "body", "slug": "fixkin", "root": "f"}])
            d = json.loads(p.read_text())
            d["bundle"] = {"files": files, "why": "fixture"}
            p.write_text(json.dumps(d, indent=2))
            return name

        lb = bundle_list("list-bundle.json", {"assets/codex.md": "f:shared/codex.md"})
        rc, out = build(g, lb)
        names = zipfile.ZipFile(g / "out" / "fixkin.zip").namelist() if rc == 0 else []
        pkg = extract(g / "out" / "fixkin.zip", tmp / "x9") if rc == 0 else None
        same = (
            bool(pkg)
            and (pkg / "assets" / "codex.md").read_bytes() == canon.read_bytes()
            and (pkg / "assets" / ".codex.md.bonsaisig").read_bytes() == (shared / ".codex.md.bonsaisig").read_bytes()
        )
        expect(
            "T9a a bundled document ships byte for byte, with its canonical seal",
            rc == 0 and "fixkin/assets/codex.md" in names and same,
            out,
        )
        rc, wout = wake(pkg, g) if pkg else (1, "no package")
        expect("T9a the package with a bundled document still wakes ok", rc == 0 and wout.startswith("ok"), wout)

        own = g / "agents" / "fixkin" / "assets" / "codex.md"
        own.write_text("# a hand-kept copy that drifted\n")
        commit(g)
        rc, out = build(g, lb)
        expect(
            "T9b a body's own file that is neither canonical nor a tombstone is refused, never overwritten",
            rc == 1 and "neither the canonical" in out and not (g / "out" / "fixkin.zip").exists(),
            out,
        )
        mpkg = mutant(
            PKG,
            PKG.with_name(f".mutant-own-{os.getpid()}.py"),
            "if own != bsrc.read_bytes() and not _is_tombstone(own):",
            "if False:",
        )
        try:
            rc, out = build(g, lb, pkg=mpkg)
        finally:
            mpkg.unlink()
        expect(
            "M-T9b without the refusal the body's own file would be silently replaced (so T9b is what catches it)",
            rc == 0,
            out,
        )
        pown = list_(
            g,
            "list-bundle-optout.json",
            "roll.md",
            [{"kind": "body", "slug": "fixkin", "root": "f", "bundle": {"files": {"assets/codex.md": None}}}],
        )
        d = json.loads(pown.read_text())
        d["bundle"] = {"files": {"assets/codex.md": "f:shared/codex.md"}, "why": "fixture"}
        pown.write_text(json.dumps(d, indent=2))
        rc, out = build(g, pown.name)
        pkg = extract(g / "out" / "fixkin.zip", tmp / "x9h") if rc == 0 else None
        expect(
            "T9h a body that opts out with null keeps its own document, untouched",
            rc == 0 and bool(pkg) and (pkg / "assets" / "codex.md").read_bytes() == own.read_bytes(),
            out,
        )
        own.write_text(
            f"---\nid: {ULID.new_ulid()}\ntitle: moved\nstatus: moved\nmoved-to: shared/codex.md\n---\nBundled from its home.\n"
        )
        commit(g)
        rc, out = build(g, lb)
        pkg = extract(g / "out" / "fixkin.zip", tmp / "x9i") if rc == 0 else None
        expect(
            "T9i a body's own tombstone at the path is replaced by the canonical copy, quietly",
            rc == 0
            and bool(pkg)
            and (pkg / "assets" / "codex.md").read_bytes() == canon.read_bytes()
            and "neither the canonical" not in out,
            out,
        )
        own.unlink()
        commit(g)

        tomb = shared / "moved.md"
        tomb.write_text(f"---\nid: {ULID.new_ulid()}\ntitle: moved\nstatus: moved\n---\nNow lives elsewhere.\n")
        commit(g)
        lt = bundle_list("list-bundle-tomb.json", {"assets/routines.md": "f:shared/moved.md"})
        rc, out = build(g, lt)
        expect(
            "T9c a tombstone is refused as a bundle source, never shipped as pointer text",
            rc == 1 and "is a tombstone" in out,
            out,
        )
        mpkg = mutant(
            PKG,
            PKG.with_name(f".mutant-tomb-{os.getpid()}.py"),
            'if m and re.search(r"^status:\\s*moved\\s*$"',
            'if False and re.search(r"^status:\\s*moved\\s*$"',
        )
        try:
            rc, out = build(g, lt, pkg=mpkg)
        finally:
            mpkg.unlink()
        expect(
            "M-T9c without the tombstone guard the pointer text would ship (so T9c is what catches it)", rc == 0, out
        )

        lty = bundle_list(
            "list-bundle-types.json", {"assets/sai-law.md": {"from": "f:shared/codex.md", "types": ["sai"]}}
        )
        rc, out = build(g, lty)
        names = zipfile.ZipFile(g / "out" / "fixkin.zip").namelist() if rc == 0 else []
        expect(
            "T9f a file limited to registry types does not ship to a body of another type",
            rc == 0 and "fixkin/assets/sai-law.md" not in names,
            out,
        )
        regp = g / "agents" / "registry.json"
        saved_reg = regp.read_text()
        r = json.loads(saved_reg)
        for a in r["agents"]:
            if a["slug"] == "fixkin":
                a["type"] = "sai"
        regp.write_text(json.dumps(r, indent=2))
        commit(g)
        rc, out = build(g, lty)
        names = zipfile.ZipFile(g / "out" / "fixkin.zip").namelist() if rc == 0 else []
        expect(
            "T9f ... and ships, with its seal, to a body the registry types as one",
            rc == 0 and "fixkin/assets/sai-law.md" in names and "fixkin/assets/.sai-law.md.bonsaisig" in names,
            out,
        )
        regp.write_text(saved_reg)
        commit(g)
        p = list_(
            g,
            "list-bundle-own.json",
            "roll.md",
            [
                {
                    "kind": "body",
                    "slug": "fixkin",
                    "root": "f",
                    "bundle": {"files": {"references/own.md": "f:shared/codex.md"}},
                }
            ],
        )
        rc, out = build(g, p.name)
        names = zipfile.ZipFile(g / "out" / "fixkin.zip").namelist() if rc == 0 else []
        expect(
            "T9g a body's own list entry bundles its own extra document",
            rc == 0 and "fixkin/references/own.md" in names,
            out,
        )

        canon.write_text(canon.read_text() + "uncommitted\n")
        rc, out = build(g, lb)
        expect(
            "T9d a bundle source with uncommitted changes is refused", rc == 1 and "has uncommitted changes" in out, out
        )
        run(["git", "-C", str(g), "checkout", "-q", "--", "shared/codex.md"])
        (shared / "loose.md").write_text("# never committed\n")
        rc, out = build(g, bundle_list("list-bundle-loose.json", {"assets/loose.md": "f:shared/loose.md"}))
        expect("T9e an untracked bundle source is refused", rc == 1 and "is not committed" in out, out)
        (shared / "loose.md").unlink()

        # ── W's six install findings, 2026-10-16 (3.0.0.7-rc on a standalone host) ───────────────
        rc, out = build(g, "list.json")
        assert rc == 0, out
        names = zipfile.ZipFile(g / "out" / "fixkin.zip").namelist()

        # T11 finding 1: the manifest sealed memory/, so a LIVE install (memory → a live store) failed integrity
        def relink(into: str, target: Path | None, dangling: str | None = None) -> Path:
            p = extract(g / "out" / "fixkin.zip", tmp / into)
            shutil.rmtree(p / "memory")
            os.symlink(str(target) if target is not None else dangling, p / "memory")
            return p

        live = tmp / "live-store"
        live.mkdir(exist_ok=True)
        (live / "working-state.md").write_text("---\ntitle: lived\n---\nopen: everything\n")
        p11 = relink("x11a", live)
        rc, out = wake(p11, g)
        expect(
            "T11a memory linked to a live store: the package wakes ok and says so (the seed is not checked)",
            rc == 0 and out.startswith("ok") and "memory: live store" in out and "not checked" in out,
            out,
        )
        (p11 / "references" / "about-me.md").write_text((p11 / "references" / "about-me.md").read_text() + "x")
        rc, out = wake(p11, g)
        expect(
            "T11b … and the body behind a live link is still exact: an edited file is refused",
            rc == 1 and "changed: references/about-me.md" in out,
            out,
        )
        rc, out = wake(relink("x11c", None, dangling=str(tmp / "gone")), g)
        expect("T11c a BROKEN memory link (dangling) is refused, named", rc == 1 and "BROKEN" in out, out)
        rc, out = wake(relink("x11d", live / "working-state.md"), g)
        expect("T11d a memory link that lands on a file is BROKEN too", rc == 1 and "BROKEN" in out, out)
        p11e = extract(g / "out" / "fixkin.zip", tmp / "x11e")
        shutil.rmtree(p11e / "references")
        os.symlink(str(live), p11e / "references")
        rc, out = wake(p11e, g)
        expect("T11e a symlink anywhere but memory is still refused", rc == 1 and "symlink: references" in out, out)
        # M-T11 the verifier without the live-store branch reads T11a as a symlink finding
        mv11 = mutant(
            p11 / "scripts" / "integrity" / "verify-manifest.mjs",
            tmp / "m11-vm.mjs",
            "if (rel === 'memory') {",
            "if (false) {",
        )
        shutil.copytree(
            p11 / "scripts" / "integrity" / "bonsai-garden-sign", tmp / "bonsai-garden-sign", dirs_exist_ok=True
        )
        (p11 / "references" / "about-me.md").write_text((p11 / "references" / "about-me.md").read_text()[:-1])
        rc_real, _o = wake(p11, g)
        rc_mut, out = wake(p11, g, mv11)
        expect(
            "M-T11 without the live-store branch a correct LIVE install fails as `symlink: memory` (so T11a is what holds it)",
            rc_real == 0 and rc_mut == 1 and "symlink: memory" in out,
            out,
        )

        # T12 finding 3: scripts/memory/link-memory.sh was listed in SKILL.md and not shipped
        sd = g / "agents" / "fixkin" / "scripts" / "tool"
        sd.mkdir(parents=True)
        (sd / "run.sh").write_text("#!/bin/sh\necho run\n")
        (sd / "SKILL.md").write_text("---\nname: fixkin-tool\n---\n# a nested group\n")
        commit(g)
        rc, out = build(g, "list.json")
        names = zipfile.ZipFile(g / "out" / "fixkin.zip").namelist() if rc == 0 else []
        expect(
            "T12a a body's scripts/ ships; its nested SKILL.md is left out and named (one SKILL.md per package)",
            rc == 0
            and "fixkin/scripts/tool/run.sh" in names
            and "fixkin/scripts/tool/SKILL.md" not in names
            and "scripts/tool/SKILL.md left out" in out,
            out + "\n" + "\n".join(n for n in names if "scripts/tool" in n),
        )
        p12 = extract(g / "out" / "fixkin.zip", tmp / "x12")
        rc, out = wake(p12, g)
        expect("T12b … and the package with its scripts wakes ok", rc == 0 and out.startswith("ok"), out)
        (sd / "run.sh").write_text("#!/bin/sh\necho changed, uncommitted\n")
        rc, out = build(g, "list.json")
        expect(
            "T12c an uncommitted change under scripts/ is refused like any other", rc == 1 and "uncommitted" in out, out
        )
        run(["git", "-C", str(g), "checkout", "-q", "--", "agents/fixkin/scripts/tool/run.sh"])

        # T13 finding 4: a shipped seal cannot be verified where the package is installed. The packager's half: the
        # root marker (so the root-path seals hold in place) now names where the files were sealed.
        marker = json.loads((p12 / "agents" / "registry.json").read_text())
        expect(
            "T13a the package marker is an empty roster naming source-path",
            marker.get("agents") == [] and marker.get("_meta", {}).get("source-path") == "agents/fixkin",
            json.dumps(marker)[:300],
        )
        rc1, o1 = run(["node", str(SIGN), "verify-sidecar", "--file", str(p12 / "SKILL.md"), "--keys", "garden"], g)
        rc2, o2 = run(
            ["node", str(SIGN), "verify-sidecar", "--file", str(p12 / "MANIFEST.json"), "--keys", "garden"], g
        )
        expect(
            "T13b SKILL.md and MANIFEST.json verify in place, by the package marker",
            rc1 == 0 and o1.startswith("ok") and rc2 == 0 and o2.startswith("ok"),
            o1 + "\n" + o2,
        )
        rc3, o3 = run(
            [
                "node",
                str(SIGN),
                "verify-sidecar",
                "--file",
                str(p12 / "references" / "about-me.md"),
                "--keys",
                "garden",
            ],
            g,
        )
        expect(
            "T13c a seal made at the source path reads ok in place and says where it was sealed (F-12, 2026-10-21: "
            "the address is provenance, never a verdict)",
            rc3 == 0
            and o3.startswith("ok")
            and o3.splitlines()[0].endswith("sealed at agents/fixkin/references/about-me.md")
            and "target-mismatch" not in o3,
            o3,
        )

        # T14 finding 5: the greeting template and fill script were not in the package
        kit = "fixkin/scripts/greeting/"
        expect(
            "T14a the greeting kit ships as core lays it out, with the kin's own registry row",
            all(
                n in names
                for n in (
                    kit + "bonsai-garden-portrait/scripts/fill-greeting.py",
                    kit + "bonsai-garden-portrait/scripts/text-card.py",
                    kit + "bonsai-garden-portrait/scripts/check-kanji-colours.py",
                    kit + "bonsai-garden-portrait/templates/greeting-v6-compact.html",
                    kit + "bonsai-garden-mark/fp-kanji.py",
                    kit + "bonsai-garden-mark/kanji-1024-v1.2.json",
                    "fixkin/identity/registry-entry.json",
                )
            ),
            "\n".join(n for n in names if "greeting" in n or "registry-entry" in n),
        )
        row = json.loads((p12 / "identity" / "registry-entry.json").read_text())
        expect(
            "T14b the row is the kin's own, and the root marker stays empty",
            [a.get("slug") for a in row.get("agents", [])] == ["fixkin"] and marker.get("agents") == [],
            json.dumps(row)[:300],
        )
        fill = p12 / "scripts" / "greeting" / "bonsai-garden-portrait" / "scripts" / "fill-greeting.py"
        out_html = tmp / "x12-greeting.html"
        rc, out = run(
            [
                sys.executable,
                str(fill),
                "--garden",
                str(p12),
                "--slug",
                "fixkin",
                "--subtitle",
                "a fixture",
                "--version",
                "3.0.0",
                *["--location", "-", "--at-local", "-", "--host", "-", "--harness", "-", "--model", "-", "--mcp", "-"],
                *["--skill", "-", "--permission", "default", "--out", str(out_html)],
            ]
        )
        expect(
            "T14c fill-greeting.py renders in place, from the package root and its own row",
            rc == 0
            and out_html.is_file()
            and "Fixkin" in out_html.read_text()
            and "A planted line" in out_html.read_text(),
            out,
        )
        card = p12 / "scripts" / "greeting" / "bonsai-garden-portrait" / "scripts" / "text-card.py"
        gate = card.with_name("check-kanji-colours.py")
        r = subprocess.run(
            [
                sys.executable,
                str(card),
                "--registry",
                str(p12 / "identity" / "registry-entry.json"),
                "--slug",
                "fixkin",
                *["--build", "3.0.0.1", "--subtitle", "a fixture", "--tz", "UTC"],
            ],
            capture_output=True,
            text=True,
        )
        gated = subprocess.run([sys.executable, str(gate), "10,20,30"], input=r.stdout, capture_output=True, text=True)
        expect(
            "T14d text-card.py draws in place from the row, and its colour gate passes the card",
            r.returncode == 0 and "Fixkin" in r.stdout and gated.returncode == 0,
            (r.stdout + r.stderr)[:400] + "\ngate: " + (gated.stdout + gated.stderr)[:200],
        )
        ek = shared / "every-kin.md"
        ek.write_text("---\ntitle: every kin\n---\n## Every kin\n\n- **Greet** with the shared card.\n")
        commit(g)
        pek = list_(g, "list-everykin.json", "roll.md", [{"kind": "body", "slug": "fixkin", "root": "f"}])
        dek = json.loads(pek.read_text())
        dek["every-kin"] = {"from": "f:shared/every-kin.md", "to": "references/agents.md"}
        pek.write_text(json.dumps(dek, indent=2))
        rc, out = build(g, pek.name)
        p14 = extract(g / "out" / "fixkin.zip", tmp / "x14") if rc == 0 else None
        page = (p14 / "references" / "agents.md").read_text() if p14 else ""
        expect(
            "T14e the generated every-kin page names the kit and the row in this package",
            rc == 0
            and "## In this package" in page
            and "scripts/greeting/" in page
            and "identity/registry-entry.json" in page,
            out + "\n" + page[-600:],
        )
        rc, out = wake(p14, g) if p14 else (1, "no package")
        expect("T14f … and that package wakes ok", rc == 0 and out.startswith("ok"), out)

        # T15 finding 2: three numbers in one body. The lock runs on the stage: a SKILL.md whose prose names another
        # build of its own version is refused, never shipped.
        (g / "agents" / "fixkin" / "SKILL.md").write_text(
            skill_md("fixkin", prose="\n**Constitution:** `references/about-me.md` — **version 3.0.0.999-stale**.\n")
        )
        reseal(g, "fixkin")
        commit(g)
        rc, out = build(g, "list.json")
        expect(
            "T15a a body whose SKILL.md prose names another build of its own version is refused on the stage",
            rc == 1 and "the version lock is broken" in out and "3.0.0.999-stale" in out,
            out,
        )
        m15 = mutant(
            PKG,
            HERE / ".mutant-package-lock.py",
            "lock = GATE_MOD.version_lock_problems(stage)",
            "lock = []",
        )
        try:
            rc, out = build(g, "list.json", pkg=m15)
        finally:
            m15.unlink()
        expect(
            "M-T15 without the lock on the stage, the stage no longer refuses the two-version body (so T15a is what "
            "catches it there); a second layer, the shintai gate's --packaged lock on the archive, still refuses: "
            "defence in depth, shown below",
            "the version lock is broken" not in out and rc == 1 and "version lock:" in out and "(packaged)" in out,
            out,
        )
        (g / "agents" / "fixkin" / "SKILL.md").write_text(skill_md("fixkin"))
        reseal(g, "fixkin")
        run(["git", "-C", str(g), "rm", "-q", "-r", "agents/fixkin/scripts"])
        commit(g)

        # T16 core alone: no list, core's own plugin from the checkout the builder sits in. A scratch clone of core,
        # the builder and verifier under test copied in, its registry and core-plugin.json planted with one fixture
        # kin (keys local, so --keys garden), committed.
        cc = tmp / "core-alone" / "fixcore"
        run(["git", "clone", "-q", "--local", str(CORE), str(cc)])
        (tmp / "t16").mkdir()
        g16 = plant(tmp / "t16")
        ccs = cc / "skills" / "bonsai-garden-core-plugin"
        shutil.copy2(PKG, ccs / "scripts" / "package.py")
        shutil.copy2(HERE / "verify-manifest.mjs", ccs / "scripts" / "verify-manifest.mjs")
        shutil.copy2(SKILL_GATE, cc / "tools" / "check-skill-conformance.py")
        shutil.copytree(g16 / "agents" / "fixkin", cc / "agents" / "fixkin")
        # T17's plant: a history of the kin's that the release leaves out, on the clone's leave-out list (a release
        # makes the real one; the builder reads a plain list and knows nothing of how it was made)
        (cc / "agents" / "fixkin" / "references" / "history.md").write_text("# a history that stays home\n")
        leave16 = tmp / "leave-out-t16.txt"
        leave16.write_text("agents/fixkin/references/history.md\n", encoding="utf-8")
        shutil.copy2(g16 / "agents" / "registry.json", cc / "agents" / "registry.json")
        shutil.copy2(g16 / "salts.json", cc / "salts.json")
        (cc / "fixcore-plugin.json").write_text(
            json.dumps({"name": "fixcore", "version": "0.0.1", "description": "planted core-alone fixture"})
        )
        (ccs / "assets" / "core-plugin.json").write_text(
            json.dumps(
                {
                    "name": "fixcore",
                    "owner": "fixkin",
                    "root": "core",
                    "plugin-json": "core:fixcore-plugin.json",
                    "bodies": [{"slug": "fixkin", "root": "core"}],
                    "skills": [],
                }
            )
        )
        commit(cc)
        stranger = tmp / "t16-home"
        stranger.mkdir()
        cc_pkg = ccs / "scripts" / "package.py"

        def core_alone(
            out: str, *extra: str, home: Path | None = None, leave_out: Path | None = leave16
        ) -> tuple[int, str]:
            lo = ("--leave-out", str(leave_out)) if leave_out is not None else ()
            return run([sys.executable, str(cc_pkg), "--keys", "garden", "--out", str(tmp / out), *lo, *extra], home=home)

        rc, out = core_alone("t16a", home=stranger)
        plug = tmp / "t16a" / "fixcore.plugin"
        expect(
            "T16a core alone, no key, a stranger's seat: an UNSEALED LOCAL BUILD, said on the first line; written",
            rc == 0 and out.startswith(P.UNSEALED_FIRST) and plug.is_file() and "UNSEALED (a local build)" in out,
            out,
        )
        x16 = tmp / "x16"
        if plug.is_file():
            zipfile.ZipFile(plug).extractall(x16)
        mans = [x16 / "MANIFEST.json", x16 / "skills" / "fixkin" / "MANIFEST.json"]
        seals = [p for p in x16.rglob("*.bonsaisig") if p.name in (".MANIFEST.json.bonsaisig", ".SKILL.md.bonsaisig")]
        expect(
            "T16a every manifest says unsealed, and no packaged SKILL.md or MANIFEST.json carries a seal",
            all(p.is_file() and json.loads(p.read_text()).get("unsealed") for p in mans) and not seals,
            "\n".join(str(p) for p in seals) or "no manifest" * (not all(p.is_file() for p in mans)),
        )
        rc, out = wake(x16 / "skills" / "fixkin", cc)
        expect(
            "T16a its own check answers UNSEALED, every file matching, exit 1: the integrity line stops on it",
            rc == 1 and out.startswith("UNSEALED") and "files match" in out.splitlines()[0],
            out,
        )
        probe = x16 / "skills" / "fixkin" / "scripts" / "integrity" / "verify-manifest.mjs"
        rc, out = run(["node", str(probe), "--dir", str(x16), "--keys", "garden"], cc)
        expect("T16a the plugin root's manifest answers UNSEALED too", rc == 1 and out.startswith("UNSEALED"), out)
        gate = [sys.executable, str(SKILL_GATE), "--packaged", str(plug), "--keys", "garden", "--garden", str(cc)]
        rc, out = run([*gate, "--unsealed"])
        expect("T16a the skill gate passes it with --unsealed, named", rc == 0 and "UNSEALED, as named" in out, out)
        rc, out = run(gate)
        expect("T16a … and FAILs it without --unsealed (no seal is no pass)", rc == 1 and "P2" in out, out)
        am = x16 / "skills" / "fixkin" / "references" / "about-me.md"
        if am.is_file():
            keep = am.read_bytes()
            am.write_bytes(keep + b"tampered\n")
            rc, out = wake(x16 / "skills" / "fixkin", cc)
            expect(
                "T16e an edited file in an unsealed package is a FAIL, not UNSEALED",
                rc == 1 and out.startswith("FAIL") and "changed: references/about-me.md" in out,
                out,
            )
            am.write_bytes(keep)
        fake = x16 / "skills" / "fixkin" / ".MANIFEST.json.bonsaisig"
        fake.write_text("{}\n")
        rc, out = wake(x16 / "skills" / "fixkin", cc)
        expect(
            "T16e a manifest that says unsealed while a seal sits beside it is a FAIL",
            rc == 1 and out.startswith("FAIL") and "one of the two is false" in out,
            out,
        )
        fake.unlink()

        # T16f one counter per garden: a build that names the garden's counter counts there, in whatever folder it
        # writes, and leaves no counter of its own beside its archive (the stranger-walk seat's open item, 2026-10-17)
        one = tmp / "t16f-garden-counter.json"
        rc1, _out1 = core_alone("t16f1", "--counter", str(one))
        rc2, out2 = core_alone("t16f2", "--counter", str(one))
        counted = json.loads(one.read_text()) if one.is_file() else {}
        expect(
            "T16f --counter: two builds in two folders count 1 then 2 on the one named file, and neither folder keeps a "
            "counter of its own",
            rc1 == 0
            and rc2 == 0
            and counted.get("fixkin", {}).get("3.0.0")
            == 2  # the kin's skill is the counted unit; the plugin is stamped by time
            and not (tmp / "t16f1" / "build-counter.json").exists()
            and not (tmp / "t16f2" / "build-counter.json").exists()
            and f"counter: {one.resolve()}" in out2,
            f"{counted} | {out2[:400]}",
        )
        expect(
            "T16f … and without --counter a build counts in its own folder, as before",
            (tmp / "t16a" / "build-counter.json").is_file(),
            str(sorted(x.name for x in (tmp / "t16a").iterdir())),
        )

        rc, out = core_alone("t16b", "--salts", str(cc / "salts.json"))
        plug_b = tmp / "t16b" / "fixcore.plugin"
        expect(
            "T16b core alone with --salts, through the signing gate: sealed by the owner, gates PASS",
            rc == 0 and not out.startswith(P.UNSEALED_FIRST) and "sealed by fixkin" in out and plug_b.is_file(),
            out,
        )
        xb = tmp / "x16b"
        if plug_b.is_file():
            zipfile.ZipFile(plug_b).extractall(xb)
        rc, out = wake(xb / "skills" / "fixkin", cc)
        expect("T16b … and its own check says ok", rc == 0 and out.startswith("ok"), out)

        # T19b (W's F-1) the plugin-level check, as build/README.md gives it (a bundled skill's verify-manifest.mjs,
        # --dir the plugin root): its manifest is byte-exact over every bundled SKILL.md, so the app's rewrite failed it
        # on a correct install (12 changed). Replayed here on the sealed plugin: no byte changes, ok.
        def plugin_check(root: Path) -> tuple[int, str]:
            vm = root / "skills" / "fixkin" / "scripts" / "integrity" / "verify-manifest.mjs"
            return run(["node", str(vm), "--dir", str(root), "--keys", "garden"], cc)

        x19b = tmp / "x19b"
        if plug_b.is_file():
            zipfile.ZipFile(plug_b).extractall(x19b)
        rc0, out0 = plugin_check(x19b)
        changed = replay_install(x19b)
        rc, out = plugin_check(x19b)
        expect(
            "T19b the sealed plugin, its SKILL.md files rewritten as the app does: byte-equal before and after, and the "
            "plugin-level check says ok, before and after",
            rc0 == 0 and out0.startswith("ok") and not changed and rc == 0 and out.startswith("ok"),
            f"before: {out0.splitlines()[:1]} | changed by the replay: {changed} | after: {out}",
        )
        # M12 a builder that writes the version bare again: the replay changes every bundled SKILL.md, and the
        # plugin-level check FAILs on them (the state W found), so T19b is what catches it
        anchor12 = "head.append(\"version: '\" + version.replace(\"'\", \"''\") + \"'\")"
        if anchor12 in cc_pkg.read_text(encoding="utf-8"):
            bare = 'head.append(f"version: {version}")'
            m12 = mutant(cc_pkg, cc_pkg.with_name(".mutant-version-bare.py"), anchor12, bare)
            salts = str(cc / "salts.json")
            try:
                rc, out = run(
                    [sys.executable, str(m12), "--keys", "garden", "--out", str(tmp / "t19m12"), "--salts", salts]
                    + ["--leave-out", str(leave16)]
                )
            finally:
                m12.unlink()
            x12 = tmp / "x19m12"
            if (tmp / "t19m12" / "fixcore.plugin").is_file():
                zipfile.ZipFile(tmp / "t19m12" / "fixcore.plugin").extractall(x12)
            changed = replay_install(x12) if x12.is_dir() else []
            rc, out = plugin_check(x12) if x12.is_dir() else (0, "no plugin was written")
            m12_ok = "skills/fixkin/SKILL.md" in changed and rc == 1 and "changed: skills/fixkin/SKILL.md" in out
            why12 = f"changed by the replay: {changed} | {out}"
        else:
            m12_ok, why12 = False, f"the mutation's anchor is not in the builder under test: {anchor12}"
        expect("M12 a builder that writes the version bare: the replayed install fails the plugin check", m12_ok, why12)

        rc, out = core_alone("t16c", "--salts", str(cc / "salts.json"), home=stranger)
        expect(
            "T16c --salts named and no signing gate (an empty HOME): refused, never an unsealed fallback",
            rc == 1
            and "REFUSED" in out
            and P.UNSEALED_FIRST not in out
            and not (tmp / "t16c" / "fixcore.plugin").exists(),
            out,
        )
        rc, out = run([sys.executable, str(cc_pkg), "--only", "fixkin"], home=stranger)
        expect(
            "T16d another name with no list is refused: a garden's list says what else to package",
            rc == 2 and "--list is required to package anything but core's own plugin" in out,
            out,
        )

        # T18 --units (W's A4, 2026-10-18: a sealed bonsai.skill must ship as the plugin carries it). Every skill the
        # plugin bundles is also written as its own <name>.skill from the plugin's own stage: the same bytes, no second
        # stamp. A unit that is not the plugin's to the byte is the failure this guards.
        def unit_files(z: Path, prefix: str) -> dict[str, bytes]:
            with zipfile.ZipFile(z) as zf:
                return {n[len(prefix) :]: zf.read(n) for n in zf.namelist() if n.startswith(prefix) and n[-1] != "/"}

        def units_same(out_dir: str) -> str:
            """'' when every <name>.skill beside the plugin is the plugin's skills/<name>/ to the byte, else why."""
            plug = tmp / out_dir / "fixcore.plugin"
            if not plug.is_file():
                return "no plugin was written"
            names = sorted(
                {
                    n.split("/")[1]
                    for n in zipfile.ZipFile(plug).namelist()
                    if n.startswith("skills/") and n.count("/") > 1
                }
            )
            why = []
            for n in names:
                sk = tmp / out_dir / f"{n}.skill"
                if not sk.is_file():
                    why.append(f"{n}.skill is missing")
                    continue
                a, b = unit_files(plug, f"skills/{n}/"), unit_files(sk, f"{n}/")
                diff = sorted(set(a) ^ set(b)) + sorted(k for k in set(a) & set(b) if a[k] != b[k])
                if diff:
                    why.append(f"{n}.skill differs from the plugin's unit: {', '.join(diff[:4])}")
            return "; ".join(why)

        rc, out = core_alone("t18", "--salts", str(cc / "salts.json"), "--units")
        why = units_same("t18")
        expect(
            "T18 --units, sealed: each skill the plugin bundles is written as its own .skill, the plugin's own unit "
            "to the byte (no second stamp)",
            rc == 0 and not why,
            why or out,
        )
        x18 = tmp / "x18"
        if (tmp / "t18" / "fixkin.skill").is_file():
            zipfile.ZipFile(tmp / "t18" / "fixkin.skill").extractall(x18)
        rc, out = wake(x18 / "fixkin", cc)
        expect("T18 … and the .skill checks itself ok", rc == 0 and out.startswith("ok"), out)
        rc, out = core_alone("t18u", "--units", home=stranger)
        why = units_same("t18u")
        expect("T18 --units, unsealed: the same, each unit the plugin's to the byte", rc == 0 and not why, why or out)
        # M11 a builder that stages the units a second time (a second stamp, second seals): T18's comparison bites
        anchor = '_zip(stage / "skills" / u.name, ua, u.name)'
        if anchor in cc_pkg.read_text(encoding="utf-8"):
            m11 = mutant(
                cc_pkg,
                cc_pkg.with_name(".mutant-units-restaged.py"),
                anchor,
                "_zip((lambda d: (stage_unit(u, d, pl, keys, review, counter_file(out)), d)[1])"
                '(_stage_base() / (u.name + "-again")), ua, u.name)',
            )
            try:
                rc, out = run(
                    [
                        *(sys.executable, str(m11), "--keys", "garden", "--out", str(tmp / "t18m11")),
                        *("--salts", str(cc / "salts.json"), "--units", "--leave-out", str(leave16)),
                    ]
                )
            finally:
                m11.unlink()
            why = units_same("t18m11")
            m11_ok = rc == 0 and "differs from the plugin's unit" in why
        else:
            m11_ok, why = False, f"the mutation's anchor is not in the builder under test: {anchor}"
        expect("M11 units staged a second time are caught: not the plugin's unit to the byte", m11_ok, why or out)

        # M7 a verifier that waves an unsealed manifest through (ok, exit 0): the builder's own wake check refuses it
        vm = ccs / "scripts" / "verify-manifest.mjs"
        saved_vm = vm.read_text(encoding="utf-8")
        m7 = mutant(vm, vm, "process.exit(1);\n  }\n  console.log(", "process.exit(0);\n  }\n  console.log(")
        mutant(m7, m7, "console.log(`UNSEALED integrity: ", "console.log(`ok       integrity: ")
        try:
            rc, out = core_alone("t16m7", home=stranger)
        finally:
            vm.write_text(saved_vm, encoding="utf-8")
        expect(
            "M7 a verifier that answers ok for an unsealed manifest is refused by the builder's own wake check",
            rc == 1 and "REFUSED" in out and "own integrity check says: ok" in out,
            out,
        )

        # T17 what a release leaves out: the clone's leave-out list names agents/fixkin/references/history.md
        history = "skills/fixkin/references/history.md"

        def names_of(out_dir: str) -> set[str]:
            f = tmp / out_dir / "fixcore.plugin"
            return set(zipfile.ZipFile(f).namelist()) if f.is_file() else set()

        rc, out = core_alone("t17a", home=stranger)
        names17 = names_of("t17a")
        expect(
            "T17a a file the leave-out list names is left out of the package, and the build names it",
            rc == 0
            and history not in names17
            and "skills/fixkin/references/about-me.md" in names17
            and "left out, as the leave-out list says: agents/fixkin/references/history.md" in out
            and f"leave-out: 1 file(s) of this checkout ({leave16})" in out,
            out,
        )
        m8 = mutant(cc_pkg, ccs / "scripts" / ".mutant-package-leave.py", "    if not LEAVE_OUT:\n", "    if True:\n")
        try:
            rc, out = run(
                [sys.executable, str(m8), "--keys", "garden", "--out", str(tmp / "t17m8"), "--leave-out", str(leave16)],
                home=stranger,
            )
        finally:
            m8.unlink()
        expect(
            "M8 a builder that does not read the list ships the planted history (so T17a is what catches it)",
            rc == 0 and history in names_of("t17m8"),
            out,
        )
        named = json.loads((ccs / "assets" / "core-plugin.json").read_text(encoding="utf-8"))
        cfg_keep = (ccs / "assets" / "core-plugin.json").read_text(encoding="utf-8")
        named["files"] = {"history.md": "core:agents/fixkin/references/history.md"}
        (ccs / "assets" / "core-plugin.json").write_text(json.dumps(named), encoding="utf-8")
        commit(cc)
        rc, out = core_alone("t17b", home=stranger)
        expect(
            "T17b a file the plugin names by itself, and the leave-out list names, refuses the plugin",
            rc == 1
            and "REFUSED" in out
            and "the leave-out list leaves it out" in out
            and not (tmp / "t17b" / "fixcore.plugin").exists(),
            out,
        )
        (ccs / "assets" / "core-plugin.json").write_text(cfg_keep, encoding="utf-8")
        commit(cc)
        # T17c a list that cannot answer refuses the build, nothing written: never built as though it said nothing
        for label, body, why in (
            ("is not there", None, "cannot be read"),
            ("is empty", "\n# nothing\n\n", "names no file"),
            ("names a path outside the checkout", "../elsewhere/history.md\n", "is not a path inside this checkout"),
            ("names an absolute path", "/etc/hosts\n", "is not a path inside this checkout"),
            ("names a file the checkout does not track", "agents/fixkin/references/nowhere.md\n", "does not track"),
        ):
            bad = tmp / f"t17c-{len(label)}.txt"
            if body is not None:
                bad.write_text(body, encoding="utf-8")
            rc, out = core_alone(f"t17c{len(label)}", home=stranger, leave_out=bad)
            expect(
                f"T17c a leave-out list that {label} refuses the build, nothing written",
                rc != 0 and why in out and not (tmp / f"t17c{len(label)}" / "fixcore.plugin").exists(),
                out,
            )
        # T17d no list, and no release manifest at the checkout's root: refused, never built with nothing left out
        for m in cc.glob("*-MANIFEST.json"):  # a clone of a release checkout carries one: the shape under test has none
            if json.loads(m.read_text(encoding="utf-8")).get("format") == P.RELEASE_MANIFEST_FORMAT:
                run(["git", "-C", str(cc), "rm", "-q", "-f", m.name])
        commit(cc)
        rc, out = core_alone("t17d", home=stranger, leave_out=None)
        expect(
            "T17d a checkout with no leave-out list and no release manifest at its root is refused",
            rc != 0
            and "names no leave-out list and carries no release manifest" in out
            and not (tmp / "t17d" / "fixcore.plugin").exists(),
            out,
        )
        m9 = mutant(cc_pkg, ccs / "scripts" / ".mutant-package-nolist.py", "        if is_release(CORE):\n", "        if True:\n")
        try:
            rc, out = run([sys.executable, str(m9), "--keys", "garden", "--out", str(tmp / "t17m9")], home=stranger)
        finally:
            m9.unlink()
        expect(
            "M9 a builder that takes no list for nothing left out builds core whole, the history shipped (so T17d is "
            "what catches it)",
            rc == 0 and history in names_of("t17m9"),
            out,
        )
        # T17k a root manifest of another format is no release manifest: still refused with no list
        (cc / "OTHER-MANIFEST.json").write_text(json.dumps({"format": "some-other-manifest/1", "files": []}) + "\n")
        commit(cc)
        rc, out = core_alone("t17k", home=stranger, leave_out=None)
        expect(
            "T17k a root manifest in another format is no release manifest: with no list, refused",
            rc != 0 and "carries no release manifest" in out and not (tmp / "t17k" / "fixcore.plugin").exists(),
            out,
        )
        m13 = mutant(
            cc_pkg,
            ccs / "scripts" / ".mutant-package-anymanifest.py",
            '.get("format") == RELEASE_MANIFEST_FORMAT',
            '.get("format") is not None',
        )
        try:
            rc, out = run([sys.executable, str(m13), "--keys", "garden", "--out", str(tmp / "t17m13")], home=stranger)
        finally:
            m13.unlink()
        expect(
            "M13 a builder that takes any root manifest for a release manifest builds there (so T17k is what catches it)",
            rc == 0 and (tmp / "t17m13" / "fixcore.plugin").is_file(),
            out,
        )
        run(["git", "-C", str(cc), "rm", "-q", "-f", "OTHER-MANIFEST.json"])
        # T17f a release checkout (a release manifest at its root, the shape a stranger's clone holds) builds with no list
        (cc / "SEED-MANIFEST.json").write_text(
            json.dumps(
                {
                    "format": "bonsai-garden-release-manifest/1",
                    "name": "fixseed",
                    "version": "0.0.1",
                    "held": [],
                    "files": [],
                }
            )
            + "\n"
        )
        commit(cc)
        rc, out = core_alone("t17f", home=stranger, leave_out=None)
        expect(
            "T17f a checkout that carries a release manifest at its root builds with no list, and says so",
            rc == 0 and (tmp / "t17f" / "fixcore.plugin").is_file() and "leave-out: none (a release checkout" in out,
            out,
        )

        # M — mutation: remove each guard, and its test must stop failing
        rc, out = build(g, "list.json")
        assert rc == 0, out
        # M1 verify-manifest without the hash comparison → T1a's tamper passes
        pkg = extract(g / "out" / "fixkin.zip", tmp / "m1")
        mv = mutant(
            pkg / "scripts" / "integrity" / "verify-manifest.mjs",
            pkg / "scripts" / "integrity" / "vm-mutant.mjs",
            "if (got !== want) problems.push",
            "if (false) problems.push",
        )
        # the mutant file is itself unlisted; run it from outside the package so the walk is fair
        mv2 = tmp / "m1-vm.mjs"
        shutil.copy2(mv, mv2)
        mv.unlink()
        shutil.copytree(
            pkg / "scripts" / "integrity" / "bonsai-garden-sign", tmp / "bonsai-garden-sign", dirs_exist_ok=True
        )
        (pkg / "references" / "about-me.md").write_text((pkg / "references" / "about-me.md").read_text() + "x")
        rc_real, _o = wake(pkg, g)
        rc_mut, out = wake(pkg, g, mv2)
        expect(
            "M1 without the hash comparison the tamper would pass (so T1a is what catches it)",
            rc_real == 1 and rc_mut == 0,
            out,
        )
        # M2 builder without the registry fingerprint check → T4a passes
        m2 = mutant(PKG, HERE / ".mutant-package-registry.py", "if fp not in known:", "if False:")
        try:
            rc, out = build(g, "list-bonsai.json", pkg=m2)
        finally:
            m2.unlink()
        expect(
            "M2 without the registry key check, T4a's finding disappears (a second layer, the signer's own "
            "registry cross-check, still refuses to seal: defence in depth, shown below)",
            "a key the registry does not name" not in out and rc == 1,
            out,
        )
        # M3 builder that skips a missing vessel → T3a exits 0
        # the old crew builder's own bug, restored: `if SKILL.md exists: append` — a silent skip
        m3 = mutant(
            PKG,
            HERE / ".mutant-package-skip.py",
            "                if s in shared:",
            "                if s in shared or not (pl.roots[p['root']] / 'agents' / s / 'SKILL.md').is_file():",
        )
        try:
            rc, out = build(g, "list-ghost.json", pkg=m3)
        finally:
            m3.unlink()
        expect(
            "M3 with the old skip restored, the ghost vanishes and the run exits 0 (so T3a is what catches it)",
            rc == 0 and not re.search(r"^\s+ghost\s", out, re.M),
            out,
        )
        # M4 builder without the owner check → T2b passes
        reseal(g, "fixkin", as_="fixother")
        commit(g)
        m4 = mutant(
            PKG, HERE / ".mutant-package-owner.py", "    if owner is not None and signer != owner:", "    if False:"
        )
        try:
            rc, out = build(g, "list.json", pkg=m4)
        finally:
            m4.unlink()
        expect(
            "M4 without the owner check a wrong-key SKILL seal is no longer refused as such (so T2b catches it)",
            "not the owner 'fixkin'" not in out,
            out,
        )
        reseal(g, "fixkin")
        commit(g)

        # M5 a builder that walks the folder instead of asking git: the planted, ignored keys now
        # reach the stage (only the key-shape backstop still stops the package)
        if (tmp / "clone-list.json").is_file():
            m5 = HERE / ".mutant-package-walk.py"
            t5 = PKG.read_text(encoding="utf-8")
            a1 = 'files = [top / x for x in out.split("\\0") if x]'
            a2 = "return os.path.relpath(p, top) in _TRACKED[top]"
            assert a1 in t5 and a2 in t5, "M5 anchors not found"
            m5.write_text(
                t5.replace(a1, "files = list(src.rglob('*'))", 1).replace(a2, "return True", 1), encoding="utf-8"
            )
            try:
                rc, out = run([sys.executable, str(m5), "--list", str(tmp / "clone-list.json"), *LEAVE])
            finally:
                m5.unlink()
            expect(
                "M5 a folder walk in place of git ls-files lets the ignored keys reach the stage (so T8a is what catches it)",
                rc == 1 and "key material reached the stage" in out and "planted" in out,
                out,
            )

        # T9 a plugin whose `files` names a directory: the tracked tree ships, an untracked file in it
        # does not, and key material anywhere under it refuses the plugin (2026-10-05, the runtime plugin
        # carrying the MCP server in whole)
        tree = g / "tree"
        (tree / "sub").mkdir(parents=True)
        (tree / "a.md").write_text("---\ntitle: a\n---\n# a\n")
        (tree / "sub" / "b.py").write_text("print('b')\n")
        (g / "plugin.json").write_text(
            json.dumps({"name": "fixplug", "version": "0.0.1", "description": "planted plugin fixture"})
        )
        commit(g)
        (tree / "untracked.txt").write_text("never committed\n")
        plug = [
            {
                "kind": "plugin",
                "name": "fixplug",
                "owner": "fixkin",
                "root": "f",
                "plugin-json": "f:plugin.json",
                "files": {"mcp": "f:tree"},
                "bodies": [{"slug": "fixkin", "root": "f"}],
            }
        ]
        list_(g, "list-plugin.json", "roll.md", plug)
        rc, out = build(g, "list-plugin.json")
        names = zipfile.ZipFile(g / "out" / "fixplug.zip").namelist() if rc == 0 else []
        expect(
            "T9a a directory under a plugin's files ships its tracked tree, untracked left out",
            rc == 0 and "mcp/a.md" in names and "mcp/sub/b.py" in names and "mcp/untracked.txt" not in names,
            out + "\n" + "\n".join(names),
        )
        (tree / "sub" / "private.key").write_text("not a key, but shaped like one\n")
        commit(g)
        rc, out = build(g, "list-plugin.json")
        expect(
            "T9b key-shaped bytes inside a plugin's directory refuse the plugin",
            rc == 1 and "key material reached the plugin stage" in out and "mcp/sub/private.key" in out,
            out,
        )
        # M6 a builder without the plugin-stage key scan ships the key (so T9b is what catches it)
        m6 = mutant(
            PKG,
            HERE / ".mutant-package-plugin-keys.py",
            "    if keyish:\n        raise Refused(f\"{name}: key material reached the plugin stage",
            "    if False:\n        raise Refused(f\"{name}: key material reached the plugin stage",
        )
        try:
            rc, out = build(g, "list-plugin.json", pkg=m6)
        finally:
            m6.unlink()
        expect(
            "M6 without the plugin-stage scan the key-shaped file is no longer refused there (so T9b catches it)",
            "key material reached the plugin stage" not in out,
            out,
        )
        run(["git", "-C", str(g), "rm", "-q", "tree/sub/private.key"])
        commit(g)

    bad = [n for n, ok, _ in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(bad)}/{len(RESULTS)} expectations hold")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
