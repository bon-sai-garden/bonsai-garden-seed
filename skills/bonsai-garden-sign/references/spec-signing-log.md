---
id: 01M39P4Y54M5HKXXYD7EG8KS6G
title: "Signing log — who signed what, kept privately, provable to ourselves"
type: spec
tended-by: mori-shin
created: 2026-09-24
updated: 2026-10-13
status: draft
version: 0.1.1-draft
related:
  - 01M39M8YVYWYXFH633T3FSQACW
  - 01M395QQFKCZWEF1RBCQTNYDKG
---

# Signing log

> **Draft.** This is thinking, as asked. Nothing is built yet, and each phase below is small enough to ship and check on its own.

## Why

The gardener, 2026-09-24: *"We should know who signed what"*, and *"the signing log is something I would like to start seeing again."*

The only log today is the site's own: its signing endpoint records what field agents sign **through the site**, and shows it in an admin view. Every seal made on a host (`sign.py`, `sign.mjs`, `seal-envelope.py`) leaves no trace but itself. The garden cannot answer *"what has Tasai sealed this week?"* without walking every repo.

## What it is

- **Every sealing act appends one entry to a ledger.** Append-only, and hash-chained, so a removed or edited line breaks the chain.
- **It is private.** It lives in the garden's pot and is never published. The world can check the one seal it holds (`/verify`). Only the garden sees the list. This is the gardener's rule: *"we do not show the world pro-actively which signatures belong to whom."*

## An entry

```json
{"seq": 42, "prev": "<entry-hash of 41>", "at": "2026-09-24T14:02:11Z",
 "signer": "mori-shin", "fp": "<the signer's fingerprint, 32 hex>",
 "form": "embedded|sidecar|envelope-v2|do-sign|seal-open",
 "ref": "<ULID of what was sealed, else repo:path>", "hash": "<body or file hash>",
 "env-hash": "<v2 only>", "intent": "<v2 only: kind>",
 "tool": "sign.py|sign.mjs|seal-envelope.py|/sign", "host": "<build host>", "backfilled": false}
```

`entry-hash = blake2b-512("bonsai-sign-log-v1\n" ‖ prev ‖ canonical-json(entry))`. The chain starts at `prev = "0"×128`.

## Where, by layer

- **Core holds the capability:** the entry format, `append(ledger, entry)` under a file lock, and `verify-chain(ledger)`. Core never names where the ledger is.
- **Pot holds the instance:** `identity/ledger/seals.jsonl`. Tools find it through the garden's config or router, not a hardcoded path. With no ledger configured, core alone signs and prints `unlogged` loudly.
- **In the garden, a seal that cannot be logged is refused.** An unlogged seal is exactly the "who signed what" gap this exists to close. So the ledger append comes first, and if the seal then fails, the entry is marked `aborted`, never deleted.

## Seeing it again

- **CLI:**
  - `sign-log.py tail` shows the latest entries;
  - `who <slug>` shows everything one signer sealed;
  - `what <ref>` shows every seal on one document;
  - `verify` checks the chain end to end.
- **A page:** a `sign-log` room in the workshop site. It is localhost-only by that site's own rule, so it is never deployed, and it reads the ledger. The site's admin view of its own log stays for field signing, and its entries are imported into the same ledger (below), so there is one place to look.

## Phases, each shippable alone

1. **Backfill and read (safe, read-only).** Scan every repo for `sign:` blocks and `.bonsaisig` sidecars, and write one entry per seal, in `timestamp` order, marked `backfilled: true`. A v1 timestamp is the signer's claim and not attested, and the entry says so. This alone gives the gardener the history back. Add the CLI and `verify-chain`.
2. **Writers append.**
   - `sign.mjs` (mine) and `seal-envelope.py` (mine) come first.
   - `sign.py` is under Baisai's seal: their review, their re-seal.
   - The pre-exec guard needs no change.
3. **The page.**
4. **Site import.** Pull the site log's entries into the ledger as `form: do-sign`, deduplicated by signature.
5. **Checkpoints.** Mori-shin seals the chain head daily (seq, entry-hash, count). A rewrite after a checkpoint then breaks a seal, not just a chain.

## The first entry

A garden may have one seal it means to be the log's first: the gardener's own, by his own hand. Backfill runs before it, so its `seq` is not 1. It is still the first entry the garden *meant*, and the log records that in its `intent`.

## Open

- Whether a checkpoint's head hash is ever published. It would let a stranger see that the log was not rewritten, without seeing any entry. My lean is no, until the gardener asks: it is still a proactive signal.
- Concurrency across many sessions: a lock is enough on one host. Several hosts need a single writer (one named host?) or a merge rule.
- What the ledger does with a key's retirement. Entries under a retired key stay, and are marked on read.
