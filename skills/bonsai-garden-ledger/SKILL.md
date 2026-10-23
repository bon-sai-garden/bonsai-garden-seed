---
name: bonsai-garden-ledger
description: >
  Read what a seat of work actually spent, from the record a harness already
  keeps. Four stages: fetch a harness's own session transcripts (Claude Code
  first: the JSONL files under ~/.claude/projects/, one folder per working directory), deduplicated by message id;
  assemble one documented JSON schema (totals, per day, per model, per seat,
  calls, fresh vs. cache-read tokens, an optional list-price equivalent from a
  caller-supplied price table, optional km/CO2 factors); render an HTML page
  from one static template. Publishing the page (where, how often) is left to
  the instance. Use whenever a gardener or agent wants to know what a stretch
  of work cost, in tokens, money or another unit — without hand-parsing
  transcripts or hardcoding a garden's own prices or slugs into the answer.
version: 0.2.2
---
> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: use nothing here, and tell the gardener exactly what it said. A tampered file is not executed.

# Bonsai Garden Ledger

**What this is.** A harness already keeps a record of every model call it makes. This skill
reads that record, adds it up without double-counting, and turns the total into a page anyone
can look at — nothing more. It is not a metering system, not a budget enforcer, not a billing
system: the number it produces is a **list-price equivalent**, what the same usage would cost
at published rates, never a bill (a plan's real cost or overage comes from the harness's own
usage API, not from here).

## Why this is a core skill, not a one-off script

The test is the one `LAYERS.md` applies everywhere: *would another garden
need this, or is it ours?* Every garden that runs on a token-metered harness needs a way to add
up what it spent, per day, per model, per seat of work. Nothing about that need is specific to
one garden — the model names, the prices, the seats, and where the finished page ends up are
all instance data, and none of it lives here. This skill carries no garden's slugs, no garden's
URLs, and no garden's prices: every one of those is a parameter the caller supplies.

This skill's older sibling, `bonsai-garden-tokens`, teaches an agent to *read its own budget
mid-session* — a one-page contract for "where am I, should this work run here or in a
sub-agent." This skill is a different capability: producing a **standing record** of usage over
a stretch of time, for a human or a dashboard to look at afterward. `bonsai-garden-tokens` does
not yet point here; that's an open item for its own owner (see below).

## The four stages

1. **fetch** — read a harness's own session transcripts through a harness seam. Claude Code is
   implemented today (`~/.claude/projects/<cwd-key>/*.jsonl`, subagent transcripts included);
   another harness plugs in behind the same interface (`HARNESSES` dict in `scripts/ledger.py`)
   without touching the rest of the pipeline. Every model call's `usage` block is counted
   **once**, deduplicated by `(message id, request id)` — a resumed or re-synced session
   re-writing earlier lines must not double the total.
2. **data** — the fetch stage's own output: one JSON document, schema below. Nothing is
   guessed: a session with no matching seat rule is `"unattributed"`; a stretch with no price
   table given carries `price_list_equivalent_usd: null`, not a zero that looks like an answer.
3. **render** — fill `templates/ledger.html` (or any template with the same `{{ dotted.path }}`
   slots) with a fetched `data.json`. The shipped template carries the garden's design system
   (colour tokens with light and dark, the type pairing) and builds its day, seat and model tables
   client-side from the embedded data. Money, footprint and distance read **"not calculated"**
   when their inputs were not supplied, never a fake zero. The design has its own owner; this
   skill's job is the data, not the look.
4. **publish** — **out of scope for core.** Where the rendered page goes — an Artifact, a URL,
   a file committed somewhere, a cadence — is the instance's call, made in the pot, not here.

## Commands

```bash
# Stage 1+2: fetch this project's Claude Code transcripts since a date, write one JSON document
python3 scripts/ledger.py fetch --harness claude-code --since 2026-09-21 --out data.json

# Same, but point at a specific project folder (or a parent holding several) instead of the
# default (this cwd's own ~/.claude/projects/<cwd-key> folder)
python3 scripts/ledger.py fetch --harness claude-code --since 2026-09-21 \
    --root ~/.claude/projects/-some-project-path --out data.json

# Add a list-price equivalent (a price table the CALLER supplies — see schema below)
python3 scripts/ledger.py fetch --harness claude-code --since 2026-09-21 \
    --price-table prices.json --out data.json

# Add distance / CO2 factors, applied to fresh tokens only (cache reads are left out, so any
# resulting figure is a floor, not a bill)
python3 scripts/ledger.py fetch --harness claude-code --since 2026-09-21 \
    --km-per-m-fresh 0.33,0.70,1.07 --co2-per-m-fresh 0.5 --out data.json

# Attribute usage to a seat of work — a rule YOU supply (default: everything "unattributed")
python3 scripts/ledger.py fetch --harness claude-code --since 2026-09-21 \
    --seat-rule my-garden/seat-rule.py:seat_of_session --out data.json

# Stage 3: render the page from a fetched data.json
python3 scripts/ledger.py render --data data.json --template templates/ledger.html --out ledger.html
```

## The seat rule — pluggable, never baked in

A session's tokens can be attributed to whoever the session was working as (a kin, a role, a
project) — but this skill names no garden's roster. `--seat-rule path/to/rule.py:function_name`
points at a Python function of shape `(title: str, opened: str) -> str | None`, where `title`
is the session's own custom title (if any) and `opened` is the slug of whatever skill/command
the session opened with. The function answers a seat name, or `None`/falsy to leave it
unattributed. Without `--seat-rule`, every session is bucketed `"unattributed"` — nothing is
guessed on this skill's own authority.

## The data schema (fetch's output)

```json
{
  "schema_version": "1",
  "harness": "claude-code",
  "since": "2026-09-21",
  "generated_at": "2026-09-26T12:00:00+00:00",
  "root": "/absolute/path/scanned",
  "transcripts": 42,
  "skipped": 0,
  "totals":       { "calls": 0, "input": 0, "cache_write": 0, "cache_read": 0, "output": 0, "fresh": 0 },
  "day":   { "YYYY-MM-DD": { "...same six fields..." } },
  "model": { "<model-name>":  { "...same six fields..." } },
  "seat":  { "<seat-name>":   { "...same six fields..." } },
  "price_list_equivalent_usd": null,
  "distance_km_fresh": null,
  "co2_kg_fresh": null
}
```

- **`fresh`** = `input + cache_write + output` — the work that was newly computed.
- **`cache_read`** is kept separate — context re-read from the prompt cache, much cheaper per
  token, and never folded into `fresh`.
- **`calls`** counts deduplicated model calls, not transcript lines.
- **`skipped`** counts lines that named a `usage` key but failed to parse as JSON (a malformed
  or truncated line) — never lines that parsed fine but simply carried no usage block; those
  are silently not counted, because they aren't model calls.
- **`price_list_equivalent_usd`** is `null` unless `--price-table` was given. The table is a
  JSON file `{"<model-name-prefix>": [usd_per_million_input, usd_per_million_output]}`; cache
  writes are costed at 1.25x the input rate and cache reads at 0.1x — Anthropic's own published
  cache-pricing multipliers, the one thing about money this skill does hardcode, because it is
  a documented mechanism, not this garden's data. No model name or price appears in this skill
  unless the caller's own table names it.
- **`distance_km_fresh`** / **`co2_kg_fresh`** are `null` unless the matching `--km-per-m-fresh`
  / `--co2-per-m-fresh` flags were given; both are applied to `fresh` tokens only.

## Files in this skill

| File | Purpose |
|---|---|
| `SKILL.md` | This file |
| `references/identity.md` | The skill's id, owner, dates and mark, sealed |
| `scripts/ledger.py` | `fetch` and `render` — the whole pipeline, stdlib only |
| `scripts/test_ledger.py` | Planted-fixture tests over `ledger.py` |
| `templates/ledger.html` | The render template: the design system, client-side tables, honest empty states |

## Open items

- **Icons** for the four measures are placeholders in the template (`.m-ic`), swappable without touching `ledger.py`.
- **`bonsai-garden-tokens` does not yet point here.** It keeps its own "not a dashboard" line
  (it teaches reading a live budget mid-session, a different job from this skill's standing
  record) — a pointer from it to this skill, so a reader who lands there first finds this one
  too, is an open item for its owner, not made here.
- **A kanji mark has not been searched** for this skill yet (see `references/identity.md`).
- **This skill's own retirement candidate**: the working instance reader in the origin garden's
  `rituals/ledger/read-transcript-usage.py` duplicates this skill's fetch stage, scoped
  to one garden's own slugs and prices. It was left running, untouched, while this skill was
  built from it; retiring it onto this skill (an instance-side seat rule + price table,
  publishing wherever the pot already publishes to) is a follow-up, not done here.
- **Other harnesses** plug into the same `HARNESSES` seam in `scripts/ledger.py`; only
  Claude Code is implemented today.
