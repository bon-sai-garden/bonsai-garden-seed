#!/usr/bin/env python3
# ---
# id: 01M3FRFGEY8CTR363CMYY9AFN6
# title: ledger.py — the token ledger's fetch, data and render stages, harness-agnostic
# type: script
# tended-by: tasai
# created: 2026-09-26
# updated: 2026-10-25
# copyright: © 2026 Bonsai Garden · bon-sai.garden
# ---
"""
ledger.py — what a seat of work actually spent, read from the record a harness already keeps.

Part of the bonsai-garden-ledger skill. Three of its four stages live here:

  1. fetch    read a harness's own session record, dedup by message id, bucket by day/model/seat
  2. data     the fetch subcommand's own output: one documented JSON schema (see SKILL.md)
  3. render   fill templates/ledger.html with a fetched data.json
  4. publish  out of scope for core — where the rendered page goes is the instance's call

No garden name, slug, URL or price is hardcoded anywhere in this file. Three things a caller
supplies instead:

  - a PRICE TABLE (--price-table FILE.json): {"<model-prefix>": [usd_per_M_in, usd_per_M_out]}.
    Cache writes are costed at 1.25x the input rate and cache reads at 0.1x — Anthropic's own
    published cache-pricing multipliers, not this garden's data, so those two constants are the
    one thing about money this file does hardcode.
  - DISTANCE/CO2 FACTORS (--km-per-m-fresh LOW,MID,HIGH and/or --co2-per-m-fresh KG): applied to
    FRESH tokens only (cache reads are left out, so any resulting figure is a floor, not a bill).
  - a SEAT RULE (--seat-rule path/to/rule.py:function_name): a function (title: str, opened: str)
    -> str | None, consulted per session to name whose seat the tokens count against. Omit it and
    every session is bucketed "unattributed" — nothing is guessed.

Usage:
  python3 ledger.py fetch --harness claude-code --since 2026-09-21 --out data.json
  python3 ledger.py render --data data.json --template templates/ledger.html --out ledger.html

fetch's --root defaults to this machine's Claude Code project directory for the CURRENT working
directory (the same "<cwd-with-slashes-as-dashes>" folder Claude Code itself creates under
~/.claude/projects). Point --root at a different folder — a single project, or a parent holding
several — to read anyone else's. A parent is scanned recursively for every "*.jsonl" beneath it,
subagent transcripts included; a subagent transcript's tokens count toward the session that
dispatched it, never toward a session of their own.
"""

from __future__ import annotations

import argparse
import atexit
import collections
import contextlib
import datetime
import glob
import importlib.util
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

# A bundled script reads and writes no bytecode beside itself. A __pycache__ left beside the scripts failed a package's
# own check (a planting, 2026-10-24), and a .pyc planted beside a sealed sibling runs instead of the sibling, under -B
# too, while the sibling's sealed bytes stay untouched (Mori-shin's read, 2026-10-25: bytecode is code). So before any
# sibling is loaded, Python's cache points at a fresh private folder, removed at exit; the instructions that run a
# bundled script pass -B.
sys.dont_write_bytecode = True
sys.pycache_prefix = tempfile.mkdtemp(prefix="bonsai-pycache-")
atexit.register(shutil.rmtree, sys.pycache_prefix, True)

FIELDS = ("calls", "input", "cache_write", "cache_read", "output")


def empty_counter() -> collections.Counter:
    return collections.Counter(dict.fromkeys(FIELDS, 0))


def with_fresh(c: collections.Counter) -> dict:
    d = dict(c)
    d["fresh"] = d.get("input", 0) + d.get("cache_write", 0) + d.get("output", 0)
    return d


def _readable(path: str):
    """open() for reading, or None when the file cannot be opened: a transcript gone mid-scan is skipped, not fatal."""
    try:
        return open(path, encoding="utf-8", errors="replace")
    except OSError:
        return None


# ---------------------------------------------------------------------------
# Seat attribution — pluggable, never baked in
# ---------------------------------------------------------------------------


def load_seat_rule(spec: str | None):
    """spec is 'path/to/file.py:function_name'. Returns a callable(title, opened) -> str | None,
    or None (default rule: everyone is unattributed) when spec is not given."""
    if not spec:
        return None
    if ":" not in spec:
        sys.exit(f"ledger.py: --seat-rule must be 'path/to/file.py:function_name', got {spec!r}")
    path_str, func_name = spec.rsplit(":", 1)
    path = Path(path_str).expanduser().resolve()
    if not path.is_file():
        sys.exit(f"ledger.py: seat rule file not found: {path}")
    modspec = importlib.util.spec_from_file_location("ledger_seat_rule", path)
    mod = importlib.util.module_from_spec(modspec)
    modspec.loader.exec_module(mod)  # type: ignore[union-attr]
    fn = getattr(mod, func_name, None)
    if fn is None:
        sys.exit(f"ledger.py: {path} defines no function named {func_name!r}")
    return fn


def seat_of(title: str, opened: str, rule) -> str:
    """rule(title, opened) -> str | None. No rule, or a rule that answers None, means
    'unattributed' — nothing here guesses a seat on its own."""
    if rule is None:
        return "unattributed"
    result = rule(title, opened)
    return result or "unattributed"


# ---------------------------------------------------------------------------
# Harness seam — Claude Code today, others plug in behind the same interface
# ---------------------------------------------------------------------------

SKILL_RE = re.compile(r"<command-name>/?(?:[a-z0-9_-]+:)?([a-z][a-z-]*)</command-name>")


def cwd_project_key(cwd: str | None = None) -> str:
    """Claude Code's own naming: the absolute cwd with '/' replaced by '-'."""
    cwd = cwd or os.getcwd()
    return re.sub(r"[/\\]", "-", os.path.abspath(cwd))


def fetch_claude_code(root: str, since: str, seat_rule):
    """Read every *.jsonl under root (recursively — a single project dir or a parent holding
    several), dedup usage records by (message id, request id), bucket by day/model/seat.

    Returns (day, model, seat, transcripts_count, skipped_count) — each of day/model/seat is a
    dict of bucket-key -> collections.Counter over FIELDS.
    """
    files = sorted(glob.glob(os.path.join(root, "**", "*.jsonl"), recursive=True))
    titles: dict[str, str] = {}
    opened: dict[str, str] = {}
    for f in files:
        if os.sep + "subagents" + os.sep in f:
            continue
        sid = os.path.basename(f)[:-6]
        fh = _readable(f)
        if fh is None:
            continue
        with fh:
            for line in fh:
                if '"custom-title"' in line:
                    with contextlib.suppress(ValueError):
                        titles[sid] = json.loads(line).get("customTitle") or titles.get(sid, "")
                elif sid not in opened and "<command-name>" in line:
                    m = SKILL_RE.search(line)
                    if m:
                        opened[sid] = m.group(1)

    seen: set[tuple] = set()
    day: dict[str, collections.Counter] = collections.defaultdict(empty_counter)
    model: dict[str, collections.Counter] = collections.defaultdict(empty_counter)
    seat: dict[str, collections.Counter] = collections.defaultdict(empty_counter)
    skipped = 0

    for f in files:
        parts = f.split(os.sep)
        sid = parts[parts.index("subagents") - 1] if "subagents" in parts else os.path.basename(f)[:-6]
        who = seat_of(titles.get(sid, ""), opened.get(sid, ""), seat_rule)
        fh = _readable(f)
        if fh is None:
            continue
        with fh:
            for line in fh:
                line = line.strip()
                if not line or '"usage"' not in line:
                    continue
                try:
                    d = json.loads(line)
                except ValueError:
                    skipped += 1
                    continue
                m = d.get("message")
                if not isinstance(m, dict):
                    continue
                u = m.get("usage")
                mid = m.get("id")
                ts = d.get("timestamp", "")
                if not u or not mid or not isinstance(u, dict):
                    continue
                if ts[:10] < since:
                    continue
                key = (mid, d.get("requestId"))
                if key in seen:
                    continue
                seen.add(key)
                c = collections.Counter(
                    calls=1,
                    input=u.get("input_tokens") or 0,
                    cache_write=u.get("cache_creation_input_tokens") or 0,
                    cache_read=u.get("cache_read_input_tokens") or 0,
                    output=u.get("output_tokens") or 0,
                )
                day[ts[:10]].update(c)
                model[m.get("model", "?")].update(c)
                seat[who].update(c)

    return day, model, seat, len(files), skipped


HARNESSES = {"claude-code": fetch_claude_code}


# ---------------------------------------------------------------------------
# Money and distance — both optional, both supplied by the caller
# ---------------------------------------------------------------------------


def price_of(price_table: dict, model_name: str):
    for prefix, pair in price_table.items():
        if model_name.startswith(prefix):
            return pair
    return None


def list_price_equivalent(model_totals: dict, price_table: dict | None) -> float | None:
    if not price_table:
        return None
    usd = 0.0
    for mname, c in model_totals.items():
        p = price_of(price_table, mname)
        if not p:
            continue
        p_in, p_out = p
        usd += (
            c.get("input", 0) * p_in
            + c.get("cache_write", 0) * p_in * 1.25
            + c.get("cache_read", 0) * p_in * 0.1
            + c.get("output", 0) * p_out
        ) / 1e6
    return round(usd, 2)


# ---------------------------------------------------------------------------
# fetch subcommand
# ---------------------------------------------------------------------------


def cmd_fetch(a: argparse.Namespace) -> int:
    fetcher = HARNESSES.get(a.harness)
    if fetcher is None:
        sys.exit(f"ledger.py: unknown --harness {a.harness!r} (known: {', '.join(HARNESSES)})")
    root = a.root or os.path.join(os.path.expanduser("~/.claude/projects"), cwd_project_key())
    seat_rule = load_seat_rule(a.seat_rule)
    day, model, seat, transcripts, skipped = fetcher(root, a.since, seat_rule)

    price_table = None
    if a.price_table:
        price_table = json.loads(Path(a.price_table).read_text("utf-8"))

    km_per_m = None
    if a.km_per_m_fresh:
        parts = [float(x) for x in a.km_per_m_fresh.split(",")]
        if len(parts) != 3:
            sys.exit("ledger.py: --km-per-m-fresh needs exactly LOW,MID,HIGH")
        km_per_m = parts

    total = empty_counter()
    for c in day.values():
        total.update(c)

    fresh_total = total["input"] + total["cache_write"] + total["output"]

    out = {
        "schema_version": "1",
        "harness": a.harness,
        "since": a.since,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "root": root,
        "transcripts": transcripts,
        "skipped": skipped,
        "totals": with_fresh(total),
        "day": {k: with_fresh(v) for k, v in sorted(day.items())},
        "model": {k: with_fresh(v) for k, v in sorted(model.items(), key=lambda x: -with_fresh(x[1])["fresh"])},
        "seat": {k: with_fresh(v) for k, v in sorted(seat.items(), key=lambda x: -with_fresh(x[1])["fresh"])},
        "price_list_equivalent_usd": list_price_equivalent(model, price_table),
        "distance_km_fresh": [round(fresh_total / 1e6 * f, 2) for f in km_per_m] if km_per_m else None,
        "co2_kg_fresh": round(fresh_total / 1e6 * a.co2_per_m_fresh, 2) if a.co2_per_m_fresh is not None else None,
    }
    text = json.dumps(out, indent=1)
    if a.out:
        Path(a.out).write_text(text + "\n", encoding="utf-8")
    else:
        print(text)
    return 0


# ---------------------------------------------------------------------------
# render subcommand
# ---------------------------------------------------------------------------

SLOT_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}")


def render_template(template_text: str, data: dict) -> str:
    def resolve(path: str):
        cur = data
        for part in path.split("."):
            if isinstance(cur, dict) and part in cur:
                cur = cur[part]
            else:
                return ""
        if cur is None:
            return ""
        return cur

    def repl(m: re.Match[str]) -> str:
        v = resolve(m.group(1))
        if isinstance(v, (dict, list)):
            return json.dumps(v)
        return str(v)

    return SLOT_RE.sub(repl, template_text)


def cmd_render(a: argparse.Namespace) -> int:
    data = json.loads(Path(a.data).read_text("utf-8"))
    template_text = Path(a.template).read_text("utf-8")
    html = render_template(template_text, data)
    if a.out:
        Path(a.out).write_text(html, encoding="utf-8")
    else:
        print(html)
    return 0


# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="ledger.py")
    sub = ap.add_subparsers(dest="command", required=True)

    fp = sub.add_parser("fetch", help="read a harness's transcripts into one data.json")
    fp.add_argument("--harness", default="claude-code", choices=sorted(HARNESSES))
    fp.add_argument("--since", required=True, help="YYYY-MM-DD, inclusive")
    fp.add_argument("--root", help="defaults to this cwd's own Claude Code project folder")
    fp.add_argument("--out", help="write JSON here instead of stdout")
    fp.add_argument("--seat-rule", help="path/to/rule.py:function_name; default: unattributed")
    fp.add_argument("--price-table", help="JSON file: {model-prefix: [usd_per_M_in, usd_per_M_out]}")
    fp.add_argument("--km-per-m-fresh", help="LOW,MID,HIGH km per million fresh tokens")
    fp.add_argument("--co2-per-m-fresh", type=float, help="kg CO2 per million fresh tokens")
    fp.set_defaults(func=cmd_fetch)

    rp = sub.add_parser("render", help="fill a template with a fetched data.json")
    rp.add_argument("--data", required=True)
    rp.add_argument("--template", required=True)
    rp.add_argument("--out", help="write HTML here instead of stdout")
    rp.set_defaults(func=cmd_render)

    return ap


def main(argv: list[str]) -> int:
    a = build_parser().parse_args(argv)
    return a.func(a)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
