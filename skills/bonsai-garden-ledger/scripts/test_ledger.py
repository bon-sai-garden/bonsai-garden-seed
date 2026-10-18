#!/usr/bin/env python3
# ---
# id: 01M3FRFGGNZD4PFZ6AXRVBEQT2
# title: test_ledger.py — planted-fixture tests for the ledger's fetch, seat and render stages
# type: script
# tended-by: tasai
# created: 2026-09-26
# updated: 2026-09-26
# copyright: © 2026 Bonsai Garden · bon-sai.garden
# ---
"""
test_ledger.py — stdlib-only unittest over ledger.py, run against planted JSONL fixtures rather
than real transcripts (no real usage data belongs in this repo).

    python3 test_ledger.py
    python3 -m unittest test_ledger -v

Each fixture plants one property the fetch stage must hold:
  - a duplicated message id (same id + requestId, written twice) is counted ONCE
  - a line whose message carries no usage block is skipped silently (not an error, not "skipped")
  - a malformed line (invalid JSON, but naming "usage" so it reaches the parser) is skipped AND
    counted in the "skipped" field
  - two distinct models and two distinct days both bucket correctly
  - the seat rule is genuinely pluggable: no rule -> everything "unattributed"; a rule supplied
    from a separate file -> its answer is used
"""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("ledger", HERE / "ledger.py")
ledger = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ledger)  # type: ignore[union-attr]


def usage_line(mid, req_id, ts, model, input_tokens=0, output_tokens=0, cache_write=0, cache_read=0):
    return json.dumps(
        {
            "type": "assistant",
            "timestamp": ts,
            "requestId": req_id,
            "message": {
                "id": mid,
                "model": model,
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cache_creation_input_tokens": cache_write,
                    "cache_read_input_tokens": cache_read,
                },
            },
        }
    )


def title_line(title):
    return json.dumps({"type": "custom-title", "customTitle": title})


class FetchTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write_session(self, name, lines):
        f = self.root / f"{name}.jsonl"
        f.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return f

    def test_duplicate_message_id_counted_once(self):
        dup = usage_line(
            "msg_1", "req_1", "2026-09-21T10:00:00Z", "claude-sonnet-5", input_tokens=100, output_tokens=50
        )
        self.write_session("sessA", [title_line("BAI - test"), dup, dup])
        day, _model, _seat, _transcripts, _skipped = ledger.fetch_claude_code(str(self.root), "2026-09-21", None)
        total = ledger.empty_counter()
        for c in day.values():
            total.update(c)
        self.assertEqual(total["calls"], 1)
        self.assertEqual(total["input"], 100)
        self.assertEqual(total["output"], 50)

    def test_missing_usage_block_not_counted_not_an_error(self):
        no_usage = json.dumps(
            {
                "type": "assistant",
                "timestamp": "2026-09-21T10:05:00Z",
                "requestId": "req_2",
                "message": {"id": "msg_2", "model": "claude-sonnet-5"},
            }
        )
        real = usage_line("msg_3", "req_3", "2026-09-21T10:06:00Z", "claude-sonnet-5", input_tokens=10, output_tokens=5)
        self.write_session("sessA", [no_usage, real])
        day, _model, _seat, _transcripts, skipped = ledger.fetch_claude_code(str(self.root), "2026-09-21", None)
        total = ledger.empty_counter()
        for c in day.values():
            total.update(c)
        self.assertEqual(total["calls"], 1)  # only the real usage line
        self.assertEqual(skipped, 0)  # a missing usage block is not a parse failure

    def test_malformed_line_skipped_and_counted(self):
        malformed = '{"message": {"usage": '  # names "usage" but is not valid JSON
        real = usage_line("msg_4", "req_4", "2026-09-21T10:07:00Z", "claude-sonnet-5", input_tokens=1, output_tokens=1)
        self.write_session("sessA", [malformed, real])
        day, _model, _seat, _transcripts, skipped = ledger.fetch_claude_code(str(self.root), "2026-09-21", None)
        self.assertEqual(skipped, 1)
        total = ledger.empty_counter()
        for c in day.values():
            total.update(c)
        self.assertEqual(total["calls"], 1)  # the malformed line contributed nothing

    def test_two_models_bucket_separately(self):
        a = usage_line("msg_5", "req_5", "2026-09-21T10:00:00Z", "claude-sonnet-5", input_tokens=100, output_tokens=10)
        b = usage_line("msg_6", "req_6", "2026-09-21T10:01:00Z", "claude-opus-5-5", input_tokens=200, output_tokens=20)
        self.write_session("sessA", [a, b])
        _day, model, _seat, _transcripts, _skipped = ledger.fetch_claude_code(str(self.root), "2026-09-21", None)
        self.assertEqual(set(model.keys()), {"claude-sonnet-5", "claude-opus-5-5"})
        self.assertEqual(model["claude-sonnet-5"]["input"], 100)
        self.assertEqual(model["claude-opus-5-5"]["input"], 200)

    def test_two_days_bucket_separately(self):
        d1 = usage_line("msg_7", "req_7", "2026-09-21T23:59:00Z", "claude-sonnet-5", input_tokens=1, output_tokens=1)
        d2 = usage_line("msg_8", "req_8", "2026-09-22T00:01:00Z", "claude-sonnet-5", input_tokens=2, output_tokens=2)
        self.write_session("sessA", [d1, d2])
        day, _model, _seat, _transcripts, _skipped = ledger.fetch_claude_code(str(self.root), "2026-09-21", None)
        self.assertEqual(set(day.keys()), {"2026-09-21", "2026-09-22"})
        self.assertEqual(day["2026-09-21"]["input"], 1)
        self.assertEqual(day["2026-09-22"]["input"], 2)

    def test_since_filters_earlier_days(self):
        early = usage_line("msg_9", "req_9", "2026-09-19T00:00:00Z", "claude-sonnet-5", input_tokens=9, output_tokens=9)
        late = usage_line(
            "msg_10", "req_10", "2026-09-21T00:00:00Z", "claude-sonnet-5", input_tokens=1, output_tokens=1
        )
        self.write_session("sessA", [early, late])
        day, _model, _seat, _transcripts, _skipped = ledger.fetch_claude_code(str(self.root), "2026-09-21", None)
        self.assertNotIn("2026-09-19", day)
        self.assertIn("2026-09-21", day)

    def test_no_seat_rule_is_unattributed(self):
        line = usage_line(
            "msg_11", "req_11", "2026-09-21T00:00:00Z", "claude-sonnet-5", input_tokens=1, output_tokens=1
        )
        self.write_session("sessA", [title_line("whoever"), line])
        _day, _model, seat, _transcripts, _skipped = ledger.fetch_claude_code(str(self.root), "2026-09-21", None)
        self.assertEqual(set(seat.keys()), {"unattributed"})

    def test_pluggable_seat_rule_is_used(self):
        rule_file = self.root / "rule.py"
        rule_file.write_text(
            "def by_title(title, opened):\n    return 'kin-x' if 'kin-x' in (title or '') else None\n",
            encoding="utf-8",
        )
        rule = ledger.load_seat_rule(f"{rule_file}:by_title")
        line = usage_line(
            "msg_12", "req_12", "2026-09-21T00:00:00Z", "claude-sonnet-5", input_tokens=1, output_tokens=1
        )
        self.write_session("sessA", [title_line("kin-x - working"), line])
        _day, _model, seat, _transcripts, _skipped = ledger.fetch_claude_code(str(self.root), "2026-09-21", rule)
        self.assertEqual(set(seat.keys()), {"kin-x"})

    def test_transcripts_count_reflects_file_count(self):
        self.write_session("sessA", [usage_line("m", "r", "2026-09-21T00:00:00Z", "claude-sonnet-5")])
        self.write_session("sessB", [usage_line("m2", "r2", "2026-09-21T00:00:00Z", "claude-sonnet-5")])
        _day, _model, _seat, transcripts, _skipped = ledger.fetch_claude_code(str(self.root), "2026-09-21", None)
        self.assertEqual(transcripts, 2)


class MoneyAndDistanceTests(unittest.TestCase):
    def test_price_table_applied_only_when_supplied(self):
        model_totals = {"claude-sonnet-5": {"input": 1_000_000, "output": 1_000_000, "cache_write": 0, "cache_read": 0}}
        self.assertIsNone(ledger.list_price_equivalent(model_totals, None))
        price_table = {"claude-sonnet-5": [2, 10]}
        got = ledger.list_price_equivalent(model_totals, price_table)
        self.assertEqual(got, 12.0)  # 1M in @ $2/M + 1M out @ $10/M

    def test_cache_multipliers(self):
        model_totals = {"claude-sonnet-5": {"input": 0, "output": 0, "cache_write": 1_000_000, "cache_read": 1_000_000}}
        price_table = {"claude-sonnet-5": [2, 10]}
        got = ledger.list_price_equivalent(model_totals, price_table)
        self.assertEqual(got, round(2 * 1.25 + 2 * 0.1, 2))


class RenderTests(unittest.TestCase):
    def test_slots_filled_from_data(self):
        template = "<p>Since {{ since }} — fresh: {{ totals.fresh }}</p>"
        data = {"since": "2026-09-21", "totals": {"fresh": 42}}
        out = ledger.render_template(template, data)
        self.assertEqual(out, "<p>Since 2026-09-21 — fresh: 42</p>")

    def test_missing_slot_renders_empty(self):
        out = ledger.render_template("[{{ nope.at.all }}]", {})
        self.assertEqual(out, "[]")


if __name__ == "__main__":
    sys.exit(unittest.main())
