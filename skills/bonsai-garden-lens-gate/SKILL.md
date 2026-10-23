---
name: bonsai-garden-lens-gate
description: >
  Restricted: Bonsai's. The lens gate of the invitation rite: five sai's lenses read a drafted being on three
  questions (fit, safety, soil), and the gate holds the bar (76 on the lowest lens, with a guardian's margin of five either way). Builds the
  single-reader brief from compact lens digests, checks a conditions ledger by script after every edit so line edits
  never cost a full reading, computes the verdict from the readings, and records a gardener's ruling without
  rewriting a number. Use at stage 3c of a planting, after a draft body exists. Not a sourcing audit.
version: 0.2.2-draft
---
> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: use nothing here, and tell the gardener exactly what it said. A tampered file is not executed.

> **Audience (advice, not a gate).** Bonsai runs this in a planting. Another kin's session stops here, says so in one line, and names who to ask.

# bonsai-garden-lens-gate

The full contract is `references/gate-spec.md`. The short of it:

1. **Brief.** `node bin/lens-gate.mjs prompt --draft <body>/references/about-me.md [--dossier <file>]` writes one brief for one reader: three questions, five digests, the draft once. The reader answers in the JSON of `lens-gate template`.
2. **Verdict.** `lens-gate verdict --readings <file>`. The bar is 76; Bonsai may move it up to five either way with a reason (`--bar-shift`, `--bar-reason`), never past a hold. The record carries findings and conditions and no number. Exit 0 clears, 1 does not clear or is held, 2 refuses (a lens missing, a number out of range, a verdict letter that is not s, c or n).
3. **Edits.** Keep the conditions in a ledger (`{conditions: [{id, lens, text, check: {file, contains, notContains}}]}`). After every edit, `lens-gate ledger-check --ledger <file> --root <dir>` first. Only when it says present does a reader (delta mode) confirm in meaning. **Never re-launch a full five-reader reading for line edits.**
4. **Ruling.** The gardener's word passes a gate that does not clear: `--ruling "<his words>" --ruled-by <name>`, and over a hold, `--acknowledge` naming each hold. The base verdict stays in the record.

Each lens is a digest in `lenses/`, pinned by sha256 to the sai's own lens file. `lens-gate digest-check --source-map <file>` is the drift gate; the map of where each owner keeps their lens stays in the garden that holds them. The digests are drafts for each owner to review.

Tests: `node --test test/lens-gate.test.mjs`.
