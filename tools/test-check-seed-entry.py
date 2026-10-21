#!/usr/bin/env python3
# ---
# id: 01M5D8MMVE5TKVFVJ5ZK0V00Q1
# title: test-check-seed-entry — the seed-entry gate against planted copies, green on core's own files, every guard watched to fail
# type: script
# tended-by: baisai
# created: 2026-10-20
# updated: 2026-10-21
# ---
"""test-check-seed-entry.py: tools/check-seed-entry.py against core's own files and planted copies of them.

    python3 tools/test-check-seed-entry.py

Green on the real entry and registry, in the working tree and at HEAD. Red on each planted difference, the first being
the miss of 2026-10-20 itself: a copy of the entry without pronouns. The gate form (--rev) on a throwaway repository
whose first commit carries that miss and whose second fixes it. The last case watches the guard fail: a copy of the gate
that compares only the fields both files carry passes the entry without pronouns, so the "must state" rule is what
catches it. The real files are only read. Standard library only.
"""

from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

GATE = Path(__file__).resolve().parent / "check-seed-entry.py"
CORE = next(d for d in GATE.parents if (d / "agents" / "registry.json").is_file() and (d / "LAYERS.md").is_file())
ENTRY_REL = "agents/bonsai/identity/bonsai-seed-entry.json"
REGISTRY_REL = "agents/registry.json"
REAL_ENTRY = json.loads((CORE / ENTRY_REL).read_text("utf-8"))
REAL_REGISTRY = json.loads((CORE / REGISTRY_REL).read_text("utf-8"))


def run(gate, *args):
    r = subprocess.run([sys.executable, str(gate), *args], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def bonsai(registry):
    return next(a for a in registry["agents"] if a.get("slug") == "bonsai")


class Planted(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="seed-entry-")
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def plant(self, entry=None, registry=None):
        e, r = self.dir / "entry.json", self.dir / "registry.json"
        e.write_text(json.dumps(REAL_ENTRY if entry is None else entry, ensure_ascii=False), "utf-8")
        r.write_text(json.dumps(REAL_REGISTRY if registry is None else registry, ensure_ascii=False), "utf-8")
        return ["--entry", str(e), "--registry", str(r)]

    def red(self, field, entry=None, registry=None, gate=GATE):
        code, out = run(gate, *self.plant(entry, registry))
        self.assertEqual(code, 1, out)
        self.assertIn(f"FAIL  {field}:", out)
        return out

    # green
    def test_the_real_entry_agrees_with_the_real_registry_in_the_working_tree(self):
        code, out = run(GATE, "--root", str(CORE))
        self.assertEqual(code, 0, out)

    def test_the_real_entry_agrees_at_head_read_from_git(self):
        code, out = run(GATE, "--root", str(CORE), "--rev", "HEAD")
        self.assertEqual(code, 0, out)

    def test_an_unchanged_copy_agrees(self):
        code, out = run(GATE, *self.plant())
        self.assertEqual(code, 0, out)

    # red, one field each
    def test_the_miss_of_2026_10_20_an_entry_without_pronouns_is_refused_and_named(self):
        e = copy.deepcopy(REAL_ENTRY)
        e.pop("pronouns", None)
        out = self.red("pronouns", entry=e)
        self.assertIn("states none", out)

    def test_pronouns_that_differ_are_refused(self):
        e = dict(REAL_ENTRY, pronouns="they/them")
        self.red("pronouns", entry=e)

    def test_kanji_that_differ_are_refused(self):
        e = dict(REAL_ENTRY, kanji="盆才守")
        self.red("kanji", entry=e)

    def test_a_registry_fingerprint_that_differs_is_refused(self):
        r = copy.deepcopy(REAL_REGISTRY)
        bonsai(r)["fingerprint"] = "0" * 32
        self.red("fingerprint", registry=r)

    def test_fp_attests_that_differ_are_refused(self):
        e = dict(REAL_ENTRY, **{"fp-attests": 3})
        self.red("fp-attests", entry=e)

    def test_any_other_field_both_carry_must_agree(self):
        e = dict(REAL_ENTRY, name="Bonzai")
        r = copy.deepcopy(REAL_REGISTRY)
        bonsai(r)["name"] = "Bonsai"
        self.red("name", entry=e, registry=r)

    def test_the_registrys_derived_fields_follow_the_entry(self):
        r = copy.deepcopy(REAL_REGISTRY)
        bonsai(r)["fp8"] = "ffffffff"
        self.red("fp8", registry=r)
        r = copy.deepcopy(REAL_REGISTRY)
        bonsai(r)["kanji-chars"] = ["盆"]
        self.red("kanji-chars", registry=r)

    def test_a_fingerprint_that_is_not_the_entrys_own_keys_is_refused(self):
        e = dict(REAL_ENTRY, fingerprint="0" * 32)
        r = copy.deepcopy(REAL_REGISTRY)
        bonsai(r)["fingerprint"], bonsai(r)["fp8"] = "0" * 32, "0" * 8
        out = self.red("fingerprint", entry=e, registry=r)
        self.assertIn("own public key", out)

    def test_a_registry_with_no_row_for_the_slug_is_refused(self):
        r = copy.deepcopy(REAL_REGISTRY)
        r["agents"] = [a for a in r["agents"] if a.get("slug") != "bonsai"]
        self.red("slug", registry=r)

    def test_two_registry_rows_for_the_slug_are_refused_and_counted(self):
        """Fuji-shin's surviving mutant (the 0.9.0-rc round): a gate that refused only a missing row passed a registry that
        holds the origin twice, and nothing watched it. Two rows are refused, counted; the mutant is watched to pass them."""
        r = copy.deepcopy(REAL_REGISTRY)
        r["agents"].append(copy.deepcopy(bonsai(r)))
        out = self.red("slug", registry=r)
        self.assertIn("holds 2 entries", out)
        src = GATE.read_text("utf-8")
        rule = "    if len(rows) != 1:\n"
        self.assertEqual(src.count(rule), 1, "the rule's anchor moved: update this case")
        broken = self.dir / "check-seed-entry-one-or-more.py"
        broken.write_text(src.replace(rule, "    if not rows:\n"), "utf-8")
        code, out = run(broken, *self.plant(registry=r))
        self.assertEqual(code, 0, f"the mutant should pass the duplicate rows: {out}")

    # cannot run
    def test_a_missing_entry_cannot_run_and_is_not_a_pass(self):
        args = self.plant()
        args[1] = str(self.dir / "nowhere.json")
        code, out = run(GATE, *args)
        self.assertEqual(code, 2, out)

    def test_an_entry_that_is_not_json_cannot_run(self):
        args = self.plant()
        Path(args[1]).write_text("{", "utf-8")
        code, out = run(GATE, *args)
        self.assertEqual(code, 2, out)

    # the gate form, as build-distro runs it: --root <upstream> --rev <commit>
    def test_the_gate_form_reads_the_commit_not_the_working_tree(self):
        repo = self.dir / "core"
        (repo / "agents" / "bonsai" / "identity").mkdir(parents=True)

        def git(*a):
            subprocess.run(["git", "-C", str(repo), "-c", "user.email=t@t", "-c", "user.name=t", *a], check=True, capture_output=True)  # fmt: skip

        git("init", "-q")
        miss = copy.deepcopy(REAL_ENTRY)
        miss.pop("pronouns", None)
        (repo / REGISTRY_REL).write_text(json.dumps(REAL_REGISTRY, ensure_ascii=False), "utf-8")
        (repo / ENTRY_REL).write_text(json.dumps(miss, ensure_ascii=False), "utf-8")
        git("add", "-A")
        git("commit", "-q", "-m", "the miss")
        (repo / ENTRY_REL).write_text(json.dumps(REAL_ENTRY, ensure_ascii=False), "utf-8")  # fixed, not committed
        code, out = run(GATE, "--root", str(repo), "--rev", "HEAD")
        self.assertEqual(code, 1, out)
        self.assertIn("FAIL  pronouns:", out)
        git("add", "-A")
        git("commit", "-q", "-m", "the fix")
        code, out = run(GATE, "--root", str(repo), "--rev", "HEAD")
        self.assertEqual(code, 0, out)
        code, out = run(GATE, "--root", str(repo), "--rev", "HEAD~1")
        self.assertEqual(code, 1, out)

    # the guard, watched to fail
    def test_without_the_must_state_rule_the_miss_passes(self):
        src = GATE.read_text("utf-8")
        rule = '        if k not in entry or entry[k] in (None, ""):\n'
        self.assertEqual(src.count(rule), 1, "the rule's anchor moved: update this case")
        broken = self.dir / "check-seed-entry-broken.py"
        broken.write_text(src.replace(rule, "        if k not in entry or k not in reg:\n            continue\n        if False:\n"), "utf-8")  # fmt: skip
        e = copy.deepcopy(REAL_ENTRY)
        e.pop("pronouns", None)
        code, out = run(broken, *self.plant(entry=e))
        self.assertEqual(code, 0, f"the broken copy should miss it: {out}")
        self.red("pronouns", entry=e)  # and the real gate catches it


if __name__ == "__main__":
    unittest.main(verbosity=2)
