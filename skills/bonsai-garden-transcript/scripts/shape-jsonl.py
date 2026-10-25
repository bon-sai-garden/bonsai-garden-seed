#!/usr/bin/env python3
# ---
# id: 01M393FAXGKM0HVBZEFED1SYS2
# title: shape-jsonl.py — a readable Markdown transcript from a Claude Code session JSONL
# type: script
# tended-by: baisai
# created: 2026-09-24
# updated: 2026-10-25
# copyright: © 2026 Bonsai Garden · bon-sai.garden
# ---
"""
shape-jsonl.py — render a Claude Code session JSONL as a readable Markdown transcript.

The shaped companion of a verbatim session copy. The verbatim JSONL is the proof;
this is for reading. It keeps what was said and done, and says what it left out:

  - user and assistant text, in order, with timestamps
  - each tool call as one line (name + a short view of its input)
  - tool results as a one-line size note, never the body
  - thinking blocks: counted, not rendered
  - compaction points marked where they happened

It invents nothing. It does not summarise, and it does not smooth a turn into prose.

Usage:
    python3 shape-jsonl.py --input session.jsonl --output transcript.md \
        [--slug <slug>] [--title "<slug> - <topic>"] [--session-id ID] [--agent-id ID]

Idempotent: re-shaping the same input over an existing output keeps that output's `id:`,
so a transcript that is re-rendered (PreCompact fires more than once) stays one document.
Exit 0 on success, 1 on any failure — with the reason on stderr.
"""

from __future__ import annotations

import argparse
import atexit
import contextlib
import hashlib
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

MAX_TOOL_INPUT = 160


def core_root() -> Path:
    """The core checkout this script sits in, found by marker (LAYERS.md beside tools/ulid.py),
    never by counting levels. Core alone is enough: no sibling repo and no environment variable
    is needed to mint an id."""
    here = Path(__file__).resolve()
    for d in here.parents:
        if (d / "LAYERS.md").is_file() and (d / "tools" / "ulid.py").is_file():
            return d
    raise RuntimeError(f"no core root (LAYERS.md + tools/ulid.py) above {here} — cannot mint an id")


def new_id() -> str:
    """A document id is generated, never typed — by core's ulid.py, the reference."""
    core_tools = core_root() / "tools"
    sys.path.insert(0, str(core_tools))
    try:
        import ulid  # type: ignore
    finally:
        sys.path.pop(0)
    return ulid.new_ulid()


def existing_id(path: Path) -> str | None:
    try:
        head = path.read_text(encoding="utf-8")[:2000]
    except OSError:
        return None
    m = re.search(r"^id:\s*\"?([0-9A-HJKMNP-TV-Z]{26})\"?\s*$", head, re.M)
    return m.group(1) if m else None


def _short(v, n=MAX_TOOL_INPUT) -> str:
    s = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    s = " ".join(s.split())
    return s if len(s) <= n else s[: n - 1] + "…"


def _tool_view(block: dict) -> str:
    name = block.get("name", "?")
    inp = block.get("input") or {}
    for key in ("command", "file_path", "path", "pattern", "url", "query", "description", "prompt"):
        if isinstance(inp, dict) and key in inp:
            return f"`{name}` — {key}: {_short(inp[key])}"
    return f"`{name}` — {_short(inp)}"


def _result_len(block: dict) -> int:
    c = block.get("content")
    if isinstance(c, str):
        return len(c)
    if isinstance(c, list):
        return sum(len(x.get("text", "")) for x in c if isinstance(x, dict))
    return 0


def _quote(text: str) -> str:
    return "\n".join("> " + line if line else ">" for line in text.rstrip().splitlines())


def shape(lines: list[bytes], meta: dict) -> tuple[str, dict]:
    out: list[str] = []
    stats = {
        "records": 0,
        "unparsed": 0,
        "user": 0,
        "assistant": 0,
        "tool_calls": 0,
        "tool_results": 0,
        "thinking_omitted": 0,
        "compactions": 0,
    }
    first_ts = last_ts = None
    for raw in lines:
        if not raw.strip():
            continue
        stats["records"] += 1
        try:
            r = json.loads(raw)
        except json.JSONDecodeError:
            stats["unparsed"] += 1
            continue
        t, ts = r.get("type"), r.get("timestamp")
        if ts:
            first_ts = first_ts or ts
            last_ts = ts
        stamp = f"`{ts[11:19]}Z`" if isinstance(ts, str) and len(ts) >= 19 else ""

        if t == "system" and r.get("subtype") == "compact_boundary":
            stats["compactions"] += 1
            out += ["", "---", f"*— compacted here {stamp} —*", "---", ""]
            continue
        if t not in ("user", "assistant"):
            continue
        msg = r.get("message") or {}
        content = msg.get("content")
        blocks = [{"type": "text", "text": content}] if isinstance(content, str) else (content or [])

        if t == "user" and r.get("isCompactSummary"):
            out += ["", f"**compaction summary** {stamp} *(written by the harness, not the gardener)*", ""]
            for b in blocks:
                if isinstance(b, dict) and b.get("type") == "text":
                    out.append(_quote(b.get("text", "")))
            continue

        texts, tools = [], []
        for b in blocks:
            if not isinstance(b, dict):
                continue
            bt = b.get("type")
            if bt == "text" and b.get("text", "").strip():
                texts.append(b["text"])
            elif bt == "tool_use":
                stats["tool_calls"] += 1
                tools.append("- → " + _tool_view(b))
            elif bt == "tool_result":
                stats["tool_results"] += 1
                err = " (error)" if b.get("is_error") else ""
                tools.append(f"- ← result{err}, {_result_len(b):,} chars")
            elif bt in ("thinking", "redacted_thinking"):
                stats["thinking_omitted"] += 1
        if not texts and not tools:
            continue
        who = "user" if t == "user" else "assistant"
        if texts:
            stats[who] += 1
            label = f"{who} *(injected by the harness)*" if r.get("isMeta") else who
            out += ["", f"### {label} {stamp}", ""]
            out += [_quote(x) if who == "user" else x.rstrip() for x in texts]
        if tools:
            if not texts:
                out.append("")
            out += tools

    stats["first"], stats["last"] = first_ts, last_ts
    return "\n".join(out).strip() + "\n", stats


def write_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        with contextlib.suppress(OSError):
            os.unlink(tmp)
        raise


def session_facts(lines: list[bytes]) -> tuple[str, str]:
    """(session id, the session's own title) read from its records; the LAST custom-title wins,
    since a gardener may rename a session. Either may be empty."""
    sid, title = "", ""
    for raw in lines:
        try:
            r = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            continue
        if not isinstance(r, dict):
            continue
        if not sid and isinstance(r.get("sessionId"), str):
            sid = r["sessionId"]
        if r.get("type") == "custom-title" and isinstance(r.get("customTitle"), str) and r["customTitle"].strip():
            title = r["customTitle"].strip()
    return sid, title


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", help="the session .jsonl to shape")
    ap.add_argument(
        "--own",
        action="store_true",
        help="shape THIS session's own record: Claude Code names it by $CLAUDE_CODE_SESSION_ID. "
        "Never guess by 'the newest file', which is someone else's whenever several sessions run",
    )
    ap.add_argument("--output", required=True)
    ap.add_argument("--slug", default="unidentified")
    ap.add_argument("--title", default="")
    ap.add_argument("--session-id", default="")
    ap.add_argument("--agent-id", default="")
    a = ap.parse_args(argv)
    here = os.environ.get("CLAUDE_CODE_SESSION_ID", "")
    if a.own:
        if not here:
            print(
                "shape-jsonl.py: --own needs Claude Code, which names this session in $CLAUDE_CODE_SESSION_ID; "
                "it isn't set here. Pass --input <your session .jsonl> instead.",
                file=sys.stderr,
            )
            return 2
        hits = sorted((Path.home() / ".claude" / "projects").glob(f"*/{here}.jsonl"))
        if len(hits) != 1:
            print(
                f"shape-jsonl.py: found {len(hits)} records named {here}.jsonl under ~/.claude/projects/; "
                "pass --input explicitly.",
                file=sys.stderr,
            )
            return 2
        a.input = str(hits[0])
    if not a.input:
        print("shape-jsonl.py: name the session: --input <file.jsonl>, or --own for this session.", file=sys.stderr)
        return 2
    try:
        data = Path(a.input).read_bytes()
        # What the session itself records, when the caller didn't pass it: every record carries
        # sessionId, and a `custom-title` record holds the name the gardener gave the session
        # (Bonsai's first-user test, 2026-09-24: the id was empty and the title generic).
        rec_sid, rec_title = session_facts(data.splitlines())
        if here and rec_sid and rec_sid != here and not a.session_id:
            # not an error (hooks shape other sessions on purpose), but never silent: the obvious
            # guess, "the newest .jsonl", is another session's record whenever several run (Bonsai)
            print(
                f"shape-jsonl.py: note: this is session {rec_sid}, not yours ({here}). Use --own to shape your own.",
                file=sys.stderr,
            )
        a.session_id = a.session_id or rec_sid or ""
        a.title = a.title or rec_title or ""
        body, st = shape(data.splitlines(), vars(a))
        out = Path(a.output)
        doc_id = existing_id(out) or new_id()
        created = (st["first"] or "")[:10]
        fm = [
            "---",
            f"id: {doc_id}",
            f"title: {json.dumps('Transcript — ' + (a.title or a.session_id or 'session'), ensure_ascii=False)}",
            "type: session-transcript",
            f"tended-by: {a.slug}",
            f"created: {created}",
            "confidentiality: intel",
            f"session-id: {a.session_id}",
        ]
        if a.agent_id:
            fm.append(f"agent-id: {a.agent_id}")
        fm += [
            f"first: {st['first']}",
            f"last: {st['last']}",
            f"verbatim: {Path(a.input).name}",
            f"verbatim-sha256: {hashlib.sha256(data).hexdigest()}",
            "shaped-by: bonsai-garden-transcript/scripts/shape-jsonl.py",
            "---",
            "",
            f"# {a.title or a.session_id or 'Session transcript'}",
            "",
            f"*Shaped from the verbatim record beside this file. {st['user']} user turns, "
            f"{st['assistant']} assistant turns, {st['tool_calls']} tool calls; "
            f"{st['thinking_omitted']} thinking blocks and every tool-result body left out; "
            f"{st['compactions']} compaction(s); {st['unparsed']} unparsable line(s).*",
            "",
            "",
        ]
        write_atomic(out, "\n".join(fm) + body)
    except Exception as e:
        print(f"shape-jsonl FAILED: {type(e).__name__}: {e}", file=sys.stderr)
        return 1
    print(f"shaped {out} ({st['records']} records)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
