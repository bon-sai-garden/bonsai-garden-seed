---
id: 01M4TC62SSH3EYX5VC0HWRNMTQ
title: "The lens gate — spec"
type: spec
tended-by: bonsai
created: 2026-10-13
updated: 2026-10-13
status: draft
version: 0.2.2-draft
tags: [lens-gate, invitation-rite, stage-3c, fit, safety, soil, cost, rulings]
related:
  - "[[agents/bonsai/references/procedures/planting-runbook]]"
---

# The lens gate

> **What it is.** The step of the invitation rite where a drafted being is read by five sai's lenses before anything is written into it for good. It asks three questions, takes findings and conditions from each lens, and holds the bar. **What it is not:** a sourcing audit, a judgement of a person, or a vote. The findings and conditions are the answer and the record. **As long as a being is safe and solid, the gate should not block** (the gardener, 2026-10-13).

## 1 · The three questions

1. **Fit.** Does what the roster carries match the role and the strategic north?
2. **Safety.** Is it a morally safe choice: for the one it serves, and for anyone outside the room?
3. **Soil.** Is it solid ground: coherent, routes that exist, nothing borrowed that cannot be kept?

Each lens answers each question **s** (solid), **c** (with conditions) or **n** (not solid). A **c** names its conditions. An **n** is never outvoted by a number.

**Never asked** (the gardener, 2026-10-08, twice): whether each statement is sourced; who the principal or a child is by name; whether a witness *is* a witness (sai are not witnesses). A bunshin's tie to its parent is design, not a finding.

## 2 · Who reads, and the bar

| | |
|---|---|
| **Lenses** | Zensai, Tasai, Baisai, Hissai, Eisai. Jisai brings no lens (the gardener, 2026-10-10). All five or no gate: a missing, repeated or unknown lens is a refusal that names it. |
| **Bar** | **76** on the *lowest* lens, inclusive (the gardener, 2026-10-13: *"reset to 76 for now. give or take (+5/-5). your ruling."*). One bar for a real garden and the lab preview alike, until he says otherwise; it replaces 90 and 80. Held here, never written into a lens. |
| **The guardian's margin** | Bonsai may move the bar by at most **5 either way** for one reading, and only with the reason in words (`--bar-shift -5..5 --bar-reason`). The record says *raised* or *lowered* and why. A moved bar never passes a hold. |
| **Numbers** | Each lens gives a number; it is used at the gate and **not kept**: the record carries findings and conditions, no number (the gardener: *"no number recording, but findings and conditions"*). `--numbers` shows them on the screen at the gate, never in the record. |
| **Holds** | A hold stops the gate whatever the numbers are: any **safety n** (`unsafe@lens`); any **fit or soil n** (`not-solid:q@lens`); any flag a lens raises as blocking (`blocking:T1@tasai`, the child-companion rules unsigned). |
| **Spread** | When the lenses' numbers differ by 10 or more the record says *the lenses differ*: signal, never a verdict. |

Verdicts: **clears** · **does-not-clear** (a number under the bar) · **held** (any hold) · **passed-on-ruling**.

## 3 · A ruling

The gardener may pass a gate that does not clear, in their own words (the first time, 2026-10-12: *"ok. we use the 2nd reading. show them."*). A ruling:

- **never rewrites the base verdict**: the record keeps it, the findings and conditions, and who ruled;
- needs words and a name;
- over a **hold**, must **name each hold it passes over** (`--acknowledge unsafe@baisai,blocking:T1@tasai`). A ruling that does not is refused.

## 4 · Three ways to read, in order of cost

The 2026-10-12 run spent about 1.37M tokens on finished readings, plus nine readers stopped part-way: each lens reader re-read its sai's full constitution, Jisai's, its lens file, the dossier and the draft (about 100–125K each). The gate now has a cheaper path, and a rule against the expensive one.

| mode | what reads | when |
|---|---|---|
| **ledger** (script, no model) | `lens-gate ledger-check`: for each open condition, are the words of its fix present in the draft? | after **every** edit, first |
| **delta** (one reader) | only the open conditions and the edits, against the digests | when the ledger says present; confirms *in meaning* |
| **single** (one reader) | the draft once, the five digests, the dossier; five readings out | the first reading of a draft |
| **full** (five readers, whole lens files) | each lens from its own file and about-me | only when the **roster changes**, or at the gardener's word |

**The rule:** never re-launch a full reading for line edits. A roster that changes mid-read gets a fresh read, not a patched one. A reading's record states which mode ran and what it spent, so the next one can be planned from facts.

**What the ledger can and cannot say.** *Present* means the fix's words are in the file. It does not mean the condition is met in meaning: a reader still decides that. Its check must assert something (an empty check is refused), and a condition with no check is **needs-reader**, never present.

## 5 · The digests

`lenses/<sai>.lens.json`: each sai's vantage cut down to what it **sees** (restated as fit, safety or soil), what it **always** raises and never tunes away, its **lean** (a bias named, not trusted), when it is **silent**, and its deductions. Each names what it was cut from by file name, version and **sha256**, and **never by a path**: where an owner keeps their lens is their garden's business, and a path in a shipped file would point into a garden the reader does not have. A digest that carries one is refused.

- **They are derived, so they are gated on drift.** `lens-gate digest-check --source-map <file> [--source-root <dir>]` says `ok`, `drifted`, `source-missing`, `unpinned`; the map (`{lens: path}`) is kept by the garden that holds the lens files, outside core. With no map it says `not-checked`, never a pass. A lens file that moves on re-cuts its digest in the same change (`digest-pin` re-hashes; the cutting is the owner's).
- **They are the owner's.** Each sai maintains its own lens (P-017). These digests are **drafts cut by Bonsai for each owner to review**; `status: draft-for-owner-review` stays until they have.
- **They ship.** A stranger's Bonsai has no sai lens files; the digests are the form a garden outside ours can run. They carry no case, no name of a principal, no answer.
- **They drop the retired checks.** The sourcing checks (Hissai's H2 and the like) are out of this gate by ruling.

## 6 · Commands

```
lens-gate template <subject>                 readings skeleton, five lenses
lens-gate prompt --draft <file> [--dossier <file>] [--mode single|delta] [--ledger <file>]
lens-gate verdict --readings <file> [--lab-preview] [--json] [--numbers]
                  [--bar-shift <-5..5> --bar-reason "<words>"]
                  [--ruling "<words>" --ruled-by <who> --acknowledge <hold,hold>]
lens-gate ledger-check --ledger <file> --root <dir>
lens-gate digest-check [--source-map <file> [--source-root <dir>]]
lens-gate digest-pin --source-map <file> [--source-root <dir>]
```

Exit 0 clears or passed-on-ruling · 1 does not clear or held · 2 refused (the input was malformed: nothing was decided).

**Not built, said plainly:** the gate does not run a model. `prompt` writes the brief; the harness runs the reader and the reader's JSON goes to `verdict`. Whether a lighter model may do the **delta** pass (never the first reading, never a safety question) was the gardener's call: **yes, for delta only** (2026-10-13, *"we go with your recommendations"*).

## 7 · Open

| | owner |
|---|---|
| Each digest reviewed and, where wrong, re-cut | the five sai |
| The deductions are first guesses, tuned by the gardener's overrides, never for the always-raised ones | the sai, with the gardener |
| A reader should also load the sai's own about-me where the garden has it; the digest alone is the floor | Bonsai |
| Jisai's yes to a division is hers, asked in her own seat, outside this gate | Jisai |
