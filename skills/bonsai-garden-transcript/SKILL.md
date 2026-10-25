---
name: bonsai-garden-transcript
description: >
  Capture and format a session transcript for a Bonsai Garden encounter, two
  ways: shape a harness's verbatim session record (a Claude Code JSONL) into a
  readable Markdown transcript that summarises nothing, or render a keepable
  record from a JSON session summary (participants, highlights, agreements,
  Bonsai's closing seal). Runs from core alone: no MCP, no hooks, no other
  repo. Use whenever a gardener asks to record, export, summarise, or archive
  a session, or to keep what a session found so the knowledge base compounds.
version: 1.1.4
---
> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: use nothing here, and tell the gardener exactly what it said. A tampered file is not executed.

# Bonsai Garden — Session Transcript

A garden grows by keeping what its sessions found. In a harness with no MCP and no hooks, a
nano harness or Cowork, transcripting by hand is how a new gardener starts the knowledge base
that compounds. This skill is the whole of that capability, and it needs nothing but a checkout
of core.

It makes two kinds of record:

- **Shaped from the verbatim record.** `scripts/shape-jsonl.py` turns a session JSONL into
  Markdown: user and assistant text in order, one line per tool call, tool-result bodies and
  thinking left out and counted, compaction points marked. It summarises nothing. Keep the
  verbatim file beside it: the verbatim record is the proof, the shaped one is for reading.
- **Rendered from a summary.** `scripts/render-transcript.py` turns a JSON session summary into a
  gardener-readable account: what happened, what was agreed, what comes next.

## From a verbatim session record

**Your own session**, in Claude Code (it names the session in `$CLAUDE_CODE_SESSION_ID`):

```bash
python3 -B scripts/shape-jsonl.py --own --output my-session.md --slug <slug>
```

Don't find "your" session by picking the newest `.jsonl` in `~/.claude/projects/`. Whenever
several sessions run, the newest file is someone else's. The script notes it when you shape a session
that isn't yours. The id and the title are read from the session's own records when you don't pass them.

**Any other session**, named explicitly:

```bash
python3 -B scripts/shape-jsonl.py --input session.jsonl --output session.md \
    --slug <slug> --title "<slug> - <topic>" [--session-id ID] [--agent-id ID]
```

The shaped file gets a generated ULID `id:` (from core's `tools/ulid.py`, found by marker) and
the verbatim file's sha256. Re-shaping over an existing output keeps its `id:`, so one session
stays one document however often it is re-rendered. The output is `confidentiality: intel`:
a transcript is private until its gardener says otherwise.

Where a garden runs a runtime layer with harness hooks, a capture hook can call this script at
session end and before compaction. The script does not depend on that hook; the hook depends on
the script.

## From a JSON session summary

```bash
python3 -B scripts/render-transcript.py --session session.json --output transcript.md
echo '{"gardener":"Alex","date":"2026-09-03","highlights":["First steps"]}' \
  | python3 -B scripts/render-transcript.py --output out.md
```

| Flag | Default | |
|---|---|---|
| `--domain DOMAIN` | none | the garden's domain, shown in the closing seal |
| `--signer SLUG` | `bonsai` | who tends the transcript and will seal it |

### Session JSON shape

```json
{
  "gardener":   "Alex",
  "date":       "2026-09-03",
  "duration":   "45 min",
  "purpose":    "First session — arrival and orientation",
  "highlights": ["Gardener arrived; walked the North-South axis with Bonsai."],
  "agreements": ["Return next week to begin the invitation rite."],
  "next_steps": "Schedule the invitation rite.",
  "notes":      "Optional free text."
}
```

All fields except `gardener` and `date` are optional; the script renders with whatever it is
given. The output carries a header (Bonsai's kanji, the date, the gardener), the purpose and
duration, the highlights, the agreements and next steps, Bonsai's closing seal (盆才守神, with
the domain if one was given), and an unsigned `sign:` placeholder. The placeholder names the
signer and no fingerprint: the signing tool writes the signer's own.

## Signing the transcript

Review the rendered file first. A transcript is a Markdown document, so it takes an embedded
`sign:` block, which core's Node signer does not yet write (the embedded-seal question, open). Seal it with the
garden's document signer:

```bash
python3 <garden>/tools/sign.py sign <transcript>.md --as <signer>
```

## Files in this skill

| File | Purpose |
|---|---|
| `SKILL.md` | This file |
| `references/identity.md` | The skill's id, owner, dates and mark, sealed |
| `scripts/shape-jsonl.py` | Shaped transcript from a session JSONL |
| `scripts/render-transcript.py` | Transcript from a JSON session summary |
