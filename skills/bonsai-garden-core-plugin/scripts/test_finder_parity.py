#!/usr/bin/env python3
# ---
# id: 01M46052KWK8PY6KMJVRYZY436
# title: test_finder_parity.py — the two Python copies of the sidecar rule, held to one answer
# type: script
# tended-by: baisai
# created: 2026-10-05
# updated: 2026-10-05
# ---
"""Drift gate for the copies of the sidecar rule (the dot-prefixed sidecar change; Mori-shin's ruling,
spec-sidecar-dot-prefix.md, *The third finder*: "the gate for two copies is drift, not count").

Plants each layout once, in a fresh temp directory, and asks both copies:

  garden tools/sign.py                find_sidecar(target)   target_of_sidecar(sidecar)
  core  .../scripts/package.py        _sidecar_of(target)    _target_of(sidecar)

Each answer is normalised to a verdict ((status, name)) and held to an EXPECTED value, not only to
the other copy: two copies that are wrong the same way would agree.

  F1 old-only     X.bonsaisig              → ok, X.bonsaisig (found: the finder is a locator; the policy is P*'s)
  F2 hidden-only  .X.bonsaisig             → ok, .X.bonsaisig
  F3 both                                  → two-sidecars (refused, never preferred)
  F4 neither                               → no-sidecar
  F5 a hidden target, its hidden sidecar   ..gitignore.bonsaisig → ok
  F6 a hidden target, its old sidecar      .gitignore.bonsaisig  → ok
  T1 X.bonsaisig                           → X
  T2 .X.bonsaisig, X exists                → X
  T3 ..gitignore.bonsaisig, .gitignore exists → .gitignore (exactly one dot off)
  T4 ..gitignore.bonsaisig, nothing beside it → .gitignore (falls to the hidden reading)
  T5 .X.bonsaisig, only .X exists          → .X (the old name of a hidden file)
  T6 .X.bonsaisig, both .X and X exist     → refused (cannot be told by name)
  T7 X.bonsaisig, X absent                 → X (an orphan still names its target)
  T8 .bonsaisig, notes.txt                 → not a sidecar
  T9 .X.bonsaisig, .X a directory, X a file → X  (a directory is never a sealed target)
  T10 .X.bonsaisig, .X a file, X a directory → .X
  P* the old name under core's seal-policy.json "sidecar-name" (the dot-prefixed sidecar change phase 3), a scratch copy
     of the real policy file per mode, never the file itself: F1 and F6 asked again, and each copy
     answers (status, name, accepted) — where the seal is, and whether a seal at that name may pass.
     warn → accepted (package.py prints the fix); refuse, a policy with no sidecar-name key, and a
     missing policy file → refused. When core's Node lib is beside this script, its `findSidecar`
     (name 'legacy') and `sealAccepted('retired-sidecar-name', readSealPolicy(<copy>))` are asked
     the same. Both finders stay locators (Mori-shin, sidecar-format.mjs): the verdict applies the
     policy, so the writers' move, the fix, works under either mode.
  M* mutation: each copy, mutated in memory (both-present preferred; two dots off; the old name
     read as ok; the policy ignored), must then disagree on the plant that catches it. A gate that
     cannot fail is not a gate.

The garden's sign.py is found where $BONSAI_GARDEN points (`$BONSAI_GARDEN/tools/sign.py`), or named by
--signpy; never by a checkout's name beside core. A checkout of core alone has no second copy to compare: the test says so and exits 0 (SKIPPED), never PASS.

  python3 test_finder_parity.py [--package PATH] [--signpy PATH]
                                       exit 0 when every expectation holds (or SKIPPED); 1 otherwise
"""

from __future__ import annotations

import contextlib
import importlib.util
import inspect
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

HERE = Path(__file__).resolve().parent
CORE = HERE.parents[2]


def _arg(flag: str, default: Path) -> Path:
    """`--package PATH` / `--signpy PATH`: ask a patched copy (a hidden one inside the tree) instead."""
    return Path(sys.argv[sys.argv.index(flag) + 1]).resolve() if flag in sys.argv else default


PKG = _arg("--package", HERE / "package.py")
_GARDEN = os.environ.get("BONSAI_GARDEN", "").strip()
GARDEN_SIGN = _arg("--signpy", Path(_GARDEN) / "tools" / "sign.py" if _GARDEN else HERE / ".no-garden-named")
SIGN_LIB = CORE / "skills" / "bonsai-garden-sign" / "lib"
POLICY = CORE / "skills" / "bonsai-garden-sign" / "seal-policy.json"
RSN = "retired-sidecar-name"

RESULTS: list[tuple[str, bool, str]] = []


def expect(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append((name, ok, detail))


def load(path: Path, as_name: str):
    spec = importlib.util.spec_from_file_location(as_name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def mutate(mod, func: str, old: str, new: str):
    """Rewrite one function of an already-loaded module, in memory. The file on disk is untouched."""
    src = textwrap.dedent(inspect.getsource(getattr(mod, func)))
    assert old in src, f"mutation anchor not found in {func}: {old!r}"
    exec(compile(src.replace(old, new), f"<mutant {func}>", "exec"), mod.__dict__)  # noqa: S102 — the mutant is the function's own source with one anchor swapped, run in memory; that is this harness's whole job
    return mod


# ── the two copies, behind one shape ────────────────────────────────────────────────────────────


class SignCopy:
    label = "sign.py"

    def __init__(self, mod):
        self.m = mod

    def sidecar_of(self, target: Path):
        p, st = self.m.find_sidecar(target)
        return (st, p.name if p else None)

    def policed(self, target: Path):
        p, st = self.m.find_sidecar(target)
        if p is None:
            return (st, None, False)
        old = getattr(self.m, "is_retired_sidecar_name", lambda *a: False)(target, p)
        return (st, p.name, bool(self.m.seal_accepted(getattr(self.m, "RETIRED_SIDECAR_NAME", "?"))) if old else True)

    def target_of(self, sidecar: Path):
        try:
            t = self.m.target_of_sidecar(sidecar)
        except ValueError:
            return ("refused", None)
        return ("not-a-sidecar", None) if t is None else ("ok", t.name)


class PackageCopy:
    label = "package.py"

    def __init__(self, mod):
        self.m = mod

    def sidecar_of(self, target: Path):
        return self.policed(target)[:2]

    def policed(self, target: Path):
        """(status, name, accepted). package.py has no status word: an old name returned is a
        warn-mode pass, RetiredSidecarName raised is a refusal; the name is the file's either way."""
        retired = getattr(self.m, "RetiredSidecarName", ())
        try:
            with contextlib.redirect_stderr(io.StringIO()) as err:
                p = self.m._sidecar_of(target)
        except retired as exc:
            return ("ok", exc.sidecar.name, False)  # found, and refused by the policy
        except self.m.Refused:
            return ("two-sidecars", None, False)
        if p is None:
            return ("no-sidecar", None, False)
        if p.name == target.name + S:  # the old name carried: only with the fix printed
            warned = RSN in err.getvalue() and "git mv" in err.getvalue()
            return ("ok", p.name, True) if warned else ("ok", p.name, "carried silently")
        return ("ok", p.name, True)

    def target_of(self, sidecar: Path):
        try:
            t = self.m._target_of(sidecar)
        except self.m.Refused:
            return ("refused", None)
        return ("not-a-sidecar", None) if t is None else ("ok", t.name)


# ── the plants ──────────────────────────────────────────────────────────────────────────────────
# (case, kind, files planted, the path asked about, expected verdict)

S = ".bonsaisig"
PLANTS = [
    ("F1 old-only", "sidecar", ["X", "X" + S], "X", ("ok", "X" + S)),
    ("F2 hidden-only", "sidecar", ["X", ".X" + S], "X", ("ok", ".X" + S)),
    ("F3 both names", "sidecar", ["X", "X" + S, ".X" + S], "X", ("two-sidecars", None)),
    ("F4 neither", "sidecar", ["X"], "X", ("no-sidecar", None)),
    (
        "F5 hidden target, hidden sidecar",
        "sidecar",
        [".gitignore", "..gitignore" + S],
        ".gitignore",
        ("ok", "..gitignore" + S),
    ),
    (
        "F6 hidden target, old sidecar",
        "sidecar",
        [".gitignore", ".gitignore" + S],
        ".gitignore",
        ("ok", ".gitignore" + S),
    ),
    ("T1 X.bonsaisig", "target", ["X", "X" + S], "X" + S, ("ok", "X")),
    ("T2 .X.bonsaisig, X exists", "target", ["X", ".X" + S], ".X" + S, ("ok", "X")),
    (
        "T3 one dot off: ..gitignore.bonsaisig",
        "target",
        [".gitignore", "..gitignore" + S],
        "..gitignore" + S,
        ("ok", ".gitignore"),
    ),
    (
        "T4 ..gitignore.bonsaisig, nothing beside it",
        "target",
        ["..gitignore" + S],
        "..gitignore" + S,
        ("ok", ".gitignore"),
    ),
    ("T5 .X.bonsaisig, only .X exists", "target", [".X", ".X" + S], ".X" + S, ("ok", ".X")),
    ("T6 .X.bonsaisig, both .X and X exist", "target", [".X", "X", ".X" + S], ".X" + S, ("refused", None)),
    ("T7 orphan X.bonsaisig", "target", ["X" + S], "X" + S, ("ok", "X")),
    ("T8a the bare suffix", "target", [S], S, ("not-a-sidecar", None)),
    ("T8b not a sidecar", "target", ["notes.txt"], "notes.txt", ("not-a-sidecar", None)),
    ("T9 .X.bonsaisig, .X a directory, X a file", "target", [".X/", "X", ".X" + S], ".X" + S, ("ok", "X")),
    ("T10 .X.bonsaisig, .X a file, X a directory", "target", [".X", "X/", ".X" + S], ".X" + S, ("ok", ".X")),
]


def ask_all(copies, root: Path) -> dict[str, dict[str, tuple]]:
    """Plant each layout once in its own directory, ask every copy; {case: {label: verdict}}."""
    out: dict[str, dict[str, tuple]] = {}
    for i, (case, kind, files, asked, _exp) in enumerate(PLANTS):
        d = root / f"p{i:02d}"
        d.mkdir()
        for f in files:
            if f.endswith("/"):
                (d / f.rstrip("/")).mkdir()
            else:
                (d / f).write_text(f"planted {f}\n", encoding="utf-8")
        out[case] = {
            c.label: (c.sidecar_of(d / asked) if kind == "sidecar" else c.target_of(d / asked)) for c in copies
        }
    return out


def disagreements(answers, copies) -> list[str]:
    bad = []
    for case, _kind, _files, _asked, exp in PLANTS:
        got = answers[case]
        for c in copies:
            if got[c.label] != exp:
                bad.append(f"{case}: {c.label} said {got[c.label]}, expected {exp}")
    return bad


class NodeCopy:
    """core's Node finder, asked once per plant through `node`: findSidecar, and sealAccepted under
    readSealPolicy(<the scratch policy>)."""

    label = "sidecar-format.mjs"
    PROBE = (
        "const [lib, target, policy] = process.argv.slice(1);\n"
        "const F = await import(lib + '/sidecar-format.mjs'); const V = await import(lib + '/seal-v2.mjs');\n"
        "const r = F.findSidecar(target); const pol = V.readSealPolicy(policy);\n"
        "const name = r.path ? r.path.split('/').pop() : null;\n"
        "const ok = r.status !== 'ok' ? false : r.name === 'legacy' ? !!V.sealAccepted(V.RETIRED_SIDECAR_NAME, pol) : true;\n"
        "console.log(JSON.stringify([r.status, name, ok]));\n"
    )

    def __init__(self):
        self.policy = None

    def policed(self, target: Path):
        r = subprocess.run(
            ["node", "--input-type=module", "-e", self.PROBE, str(SIGN_LIB), str(target), str(self.policy or POLICY)],
            capture_output=True,
            text=True,
        )
        if r.returncode:
            return ("node-error", (r.stderr.strip().splitlines() or ["?"])[-1][:120], None)
        return tuple(json.loads(r.stdout))


# (case, the plant from PLANTS it re-asks, the policy file's sidecar-name (None: key absent;
#  "MISSING": no file at all), the expected (status, name, accepted))
POLICED = [
    ("P1 old-only, warn", "F1 old-only", "warn", ("ok", "X" + S, True)),
    ("P2 old-only, refuse", "F1 old-only", "refuse", ("ok", "X" + S, False)),
    ("P3 hidden target's old sidecar, warn", "F6 hidden target, old sidecar", "warn", ("ok", ".gitignore" + S, True)),
    (
        "P4 hidden target's old sidecar, refuse",
        "F6 hidden target, old sidecar",
        "refuse",
        ("ok", ".gitignore" + S, False),
    ),
    ("P5 old-only, a policy with no sidecar-name key", "F1 old-only", None, ("ok", "X" + S, False)),
    ("P6 old-only, no policy file", "F1 old-only", "MISSING", ("ok", "X" + S, False)),
    (
        "P7 hidden-only, refuse: the switch touches only the old name",
        "F2 hidden-only",
        "refuse",
        ("ok", ".X" + S, True),
    ),
]


def policy_file(root: Path, mode) -> Path:
    """A scratch copy of core's real policy with sidecar-name set (or removed); never the file."""
    if mode == "MISSING":
        return root / "no-such-policy.json"
    data = json.loads(POLICY.read_text(encoding="utf-8"))
    data.pop("sidecar-name", None)
    if mode is not None:
        data["sidecar-name"] = mode
    f = root / f"policy-{mode}.json"
    f.write_text(json.dumps(data), encoding="utf-8")
    return f


def ask_policed(copies, root: Path) -> dict[str, dict[str, tuple]]:
    out: dict[str, dict[str, tuple]] = {}
    plants = {c[0]: c for c in PLANTS}
    for i, (case, plant, mode, _exp) in enumerate(POLICED):
        _c, _k, files, asked, _e = plants[plant]
        d = root / f"q{i:02d}"
        d.mkdir()
        for f in files:
            (d / f).write_text(f"planted {f}\n", encoding="utf-8")
        pol = policy_file(root, mode)
        got = {}
        for c in copies:
            if isinstance(c, NodeCopy):
                c.policy = pol
            else:
                c.m.SEAL_POLICY_OVERRIDE = pol
            try:
                got[c.label] = c.policed(d / asked)
            finally:
                if isinstance(c, NodeCopy):
                    c.policy = None
                else:
                    c.m.SEAL_POLICY_OVERRIDE = None
        out[case] = got
    return out


def policed_disagreements(answers, copies) -> list[str]:
    return [
        f"{case}: {c.label} said {answers[case][c.label]}, expected {exp}"
        for case, _p, _m, exp in POLICED
        for c in copies
        if answers[case][c.label] != exp
    ]


def main() -> int:
    if not GARDEN_SIGN.is_file():
        print(
            f"SKIPPED  no garden sign.py ({GARDEN_SIGN} absent; set $BONSAI_GARDEN or --signpy): there is no second "
            f"Python copy of the sidecar rule to compare. Not a pass; run with the garden named."
        )
        return 0

    def fresh():
        return SignCopy(load(GARDEN_SIGN, "parity_sign")), PackageCopy(load(PKG, "parity_package"))

    with tempfile.TemporaryDirectory(prefix="bonsai-finder-parity-") as t:
        root = Path(t)

        # the real copies: every plant, both copies, the expected answer
        copies = fresh()
        (root / "real").mkdir()
        answers = ask_all(copies, root / "real")
        for case, _kind, _files, _asked, exp in PLANTS:
            got = answers[case]
            expect(
                f"{case}: both copies say {exp}",
                all(got[c.label] == exp for c in copies),
                "; ".join(f"{c.label}={got[c.label]}" for c in copies),
            )

        # the old name under the policy switch (phase 3): both Python copies, and Node when present
        node = [NodeCopy()] if (SIGN_LIB / "sidecar-format.mjs").is_file() and shutil.which("node") else []
        pcopies = list(copies) + node
        (root / "policed").mkdir()
        pans = ask_policed(pcopies, root / "policed")
        for case, _p, _m, exp in POLICED:
            got = pans[case]
            expect(
                f"{case}: {', '.join(c.label for c in pcopies)} say {exp}",
                all(got[c.label] == exp for c in pcopies),
                "; ".join(f"{c.label}={got[c.label]}" for c in pcopies),
            )
        if not node:
            print("NOTE  core's Node lib or node is absent: the P* plants asked the two Python copies only")

        # the mutants: one copy mutated in memory, the other real; the named plant must now disagree
        mutants = [
            (
                "M1 package.py prefers the old name when both exist",
                1,
                "_sidecar_of",
                "if old.is_file() and hid.is_file():",
                "if False:",
                "F3 both names",
            ),
            (
                "M2 package.py strips every leading dot",
                1,
                "_target_of",
                "stem[1:]",
                'stem.lstrip(".")',
                "T3 one dot off: ..gitignore.bonsaisig",
            ),
            (
                "M3 sign.py prefers one sidecar when both exist",
                0,
                "find_sidecar",
                "if len(have) == 2:",
                "if False:",
                "F3 both names",
            ),
            (
                "M4 sign.py strips every leading dot",
                0,
                "target_of_sidecar",
                "stem[1:]",
                'stem.lstrip(".")',
                "T3 one dot off: ..gitignore.bonsaisig",
            ),
            (
                "M5 sign.py cannot tell the old name from the hidden one",
                0,
                "is_retired_sidecar_name",
                "sidecar == sidecar_candidates(path)[0]",
                "False",
                "P2 old-only, refuse",
            ),
            (
                "M6 package.py ignores the policy (always warn)",
                1,
                "_retired_name",
                'if mode != "warn":',
                "if False:",
                "P2 old-only, refuse",
            ),
            (
                "M7 sign.py ignores the policy (always warn)",
                0,
                "seal_accepted",
                'return read_seal_policy(_POLICY_KEY[status])[0] == "warn"',
                "return True",
                "P2 old-only, refuse",
            ),
        ]
        for i, (name, which, func, old, new, catches) in enumerate(mutants):
            pair = list(fresh())
            try:
                mutate(pair[which].m, func, old, new)
            except (AssertionError, AttributeError) as exc:
                expect(f"{name} → caught at {catches}", False, f"{exc}: the code moved; re-anchor the mutant")
                continue
            d = root / f"m{i}"
            d.mkdir()
            if catches.startswith("P"):
                (d / "q").mkdir()
                bad = policed_disagreements(ask_policed(pair, d / "q"), pair)
            else:
                bad = disagreements(ask_all(pair, d), pair)
            expect(
                f"{name} → caught at {catches}",
                any(b.startswith(catches + ":") and pair[which].label in b for b in bad),
                "; ".join(bad) or "the mutant agreed everywhere: this gate could not fail",
            )

    failed = [r for r in RESULTS if not r[1]]
    for name, ok, detail in RESULTS:
        print(f"{'PASS' if ok else 'FAIL'}  {name}" + ("" if ok else f"\n      {detail}"))
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} hold (sign.py: {GARDEN_SIGN}; package.py: {PKG})")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
