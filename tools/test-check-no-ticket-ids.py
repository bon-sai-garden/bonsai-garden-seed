#!/usr/bin/env python3
# ---
# id: 01M51MDXNNV7NA3C9GZ0H34ZPQ
# title: test-check-no-ticket-ids — the ticket-id gate against planted trees, every guard watched to fail
# type: script
# tended-by: baisai
# created: 2026-10-16
# updated: 2026-10-16
# ---
"""test-check-no-ticket-ids.py — tools/check-no-ticket-ids.py against throwaway git repositories.

    python3 tools/test-check-no-ticket-ids.py

Each case builds a small repository, runs the gate as a user would (a subprocess: exit code and output), and asserts the
exit code and the line. The last case watches the guard fail: a copy of the gate that lost one shape misses a planted id the
real gate finds, so the shape cases above would have caught the loss. Standard library only.
"""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

GATE = Path(__file__).resolve().parent / "check-no-ticket-ids.py"
# Composed at run time, never written out: this file ships in the tree the gate reads, and a shape written in
# full here would be a hit in it (found 2026-10-16, when the merged gate refused the tree that holds its own test).
SHAPES = {k: "-".join(v) for k, v in {"a card": ("BL", "AB123"), "a lower-cased card": ("bl", "ab123"),
          "a work stream": ("WS", "T123"), "a route": ("RT", "123"), "a milestone": ("MS", "123"),
          "a finding": ("TA123", "F4")}.items()}  # fmt: skip
CARD, ROUTE = SHAPES["a card"], SHAPES["a route"]


def run(gate, *args):
    r = subprocess.run([sys.executable, str(gate), *args], capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def git(root, *args):
    subprocess.run(
        ["git", "-C", str(root), "-c", "user.email=t@t", "-c", "user.name=t", *args], check=True, capture_output=True
    )


def repo(tmp, files):
    root = Path(tmp)
    git(root, "init", "-q")
    for rel, text in files.items():
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        (root / rel).write_text(text, "utf-8")
    git(root, "add", "-A")
    git(root, "commit", "-q", "-m", "one")
    return root


class Gate(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.tmp = self._tmp.name

    def test_a_clean_tree_exits_0(self):
        root = repo(self.tmp, {"a.md": "nothing to see\n", "b/c.py": "x = 1\n"})
        self.assertEqual(run(GATE, "--root", str(root)), (0, "check-no-ticket-ids: clean\n"))

    def test_every_shape_is_a_hit_with_file_line_and_id(self):
        for what, tid in SHAPES.items():
            with self.subTest(what):
                root = repo(tempfile.mkdtemp(dir=self.tmp), {"doc.md": f"one\ncard {tid} here\n"})
                code, out = run(GATE, "--root", str(root))
                self.assertEqual(code, 1, out)
                self.assertIn(f"doc.md:2: {tid}", out)
                self.assertIn("1 hit(s)", out)

    def test_the_placeholder_family_is_not_a_hit(self):
        root = repo(self.tmp, {"t.md": "BL-XX123 and bl-xx9 stand for a card\n"})
        self.assertEqual(run(GATE, "--root", str(root))[0], 0)

    def test_a_sidecar_is_skipped(self):
        root = repo(self.tmp, {"a.md": "ok\n", ".a.md.bonsaisig": f"{CARD}\n"})
        self.assertEqual(run(GATE, "--root", str(root))[0], 0)
        self.assertEqual(run(GATE, "--root", str(root), "--rev", "HEAD")[0], 0)

    def test_named_files_only(self):
        root = repo(self.tmp, {"ok.md": "fine\n", "bad.md": f"{CARD}\n"})
        self.assertEqual(run(GATE, "--root", str(root), str(root / "ok.md"))[0], 0)
        self.assertEqual(run(GATE, "--root", str(root), str(root / "bad.md"))[0], 1)

    def test_rev_reads_the_commit_and_never_the_working_tree(self):
        root = repo(self.tmp, {"a.md": "clean\n"})
        (root / "a.md").write_text(f"{CARD} in the working tree only\n", "utf-8")
        self.assertEqual(run(GATE, "--root", str(root))[0], 1, "the working tree is dirty")
        self.assertEqual(run(GATE, "--root", str(root), "--rev", "HEAD")[0], 0, "the commit is clean")
        (root / "a.md").write_text("clean again\n", "utf-8")
        git(root, "commit", "-q", "-am", "x")
        (root / "a.md").write_text(f"{CARD} committed\n", "utf-8")
        git(root, "commit", "-q", "-am", "two")
        (root / "a.md").write_text("clean again\n", "utf-8")
        self.assertEqual(run(GATE, "--root", str(root))[0], 0, "the working tree is clean")
        self.assertEqual(run(GATE, "--root", str(root), "--rev", "HEAD")[0], 1, "the commit is not")
        self.assertEqual(run(GATE, "--root", str(root), "--rev", "HEAD~1")[0], 0, "an older commit is its own tree")

    def test_the_gate_does_not_flag_its_own_text(self):
        root = repo(self.tmp, {"tools/check-no-ticket-ids.py": GATE.read_text("utf-8")})
        self.assertEqual(run(root / "tools" / "check-no-ticket-ids.py", "--root", str(root), "--rev", "HEAD")[0], 0)
        self.assertEqual(run(root / "tools" / "check-no-ticket-ids.py", "--root", str(root))[0], 0)

    def test_a_bad_rev_and_a_non_repository_exit_2(self):
        root = repo(self.tmp, {"a.md": "ok\n"})
        code, out = run(GATE, "--root", str(root), "--rev", "no-such-rev")
        self.assertEqual(code, 2, out)
        self.assertIn("is not a commit", out)
        with tempfile.TemporaryDirectory() as plain:  # beside self.tmp: inside it, git would find the repository above
            self.assertEqual(run(GATE, "--root", plain, "--rev", "HEAD")[0], 2)
            self.assertEqual(run(GATE, "--root", plain)[0], 2)

    def test_help_exits_0_and_says_what_it_is(self):
        code, out = run(GATE, "--help")
        self.assertEqual(code, 0)
        self.assertIn("--rev", out)

    def test_the_guard_is_watched_to_fail(self):
        # a gate that lost the RT- shape reads the same planted tree as clean; the shape cases above would catch that
        root = repo(self.tmp, {"doc.md": f"route {ROUTE}\n"})
        mutant = Path(tempfile.mkdtemp(dir=self.tmp)) / "tools"
        mutant.mkdir()
        src = GATE.read_text("utf-8")
        self.assertIn("|RT-\\d{2,4}", src, "the mutation point moved: update this test")
        (mutant / "check-no-ticket-ids.py").write_text(src.replace("|RT-\\d{2,4}", ""), "utf-8")
        self.assertEqual(
            run(mutant / "check-no-ticket-ids.py", "--root", str(root))[0], 0, f"the mutant misses {ROUTE}"
        )
        self.assertEqual(run(GATE, "--root", str(root))[0], 1, "the real gate finds it")


if __name__ == "__main__":
    unittest.main(verbosity=1)
