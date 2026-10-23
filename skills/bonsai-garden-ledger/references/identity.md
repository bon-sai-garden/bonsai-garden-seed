---
id: 01M3FRFGJGD4RJK8JTJVZDKX6S
title: "bonsai-garden-ledger — identity"
type: identity
tended-by: tasai
created: 2026-09-26
updated: 2026-10-21
skill: bonsai-garden-ledger
version: 0.2.2
---

# bonsai-garden-ledger — identity

This file holds what `SKILL.md` may not. Per `rituals/specs/spec-canonical-shintai-structure.md`
(3.0.x), a skill's `SKILL.md` frontmatter carries only `name`, `description` and `version`, and
is sealed by the detached `.SKILL.md.bonsaisig`. The skill's stable id, its owner, its dates and
its mark live here instead, sealed as a garden document.

**New in core, 2026-09-26**, on the gardener's ruling (Tasai, 2026-09-25): the Token
Ledger becomes a sibling core skill to `bonsai-garden-tokens`, capability only — fetch, data,
render, with publish left to the instance. Ported from the working instance reader at
the origin garden's `rituals/ledger/read-transcript-usage.py`, generalised: no garden slugs,
no hardcoded prices, seat attribution behind a pluggable rule.

**Mark: not yet searched.** Open item — a kanji mark (Mori-shin's identicon search, a salt, a
proposal) has not been run for this skill. Until one is proposed and locked, this skill carries
no `mark:` line rather than an invented one.

**Verify.** `node skills/bonsai-garden-sign/bin/sign.mjs verify-sidecar --file skills/bonsai-garden-ledger/SKILL.md` checks the skill; `… verify --file skills/bonsai-garden-ledger/references/identity.md`
checks this file. `tools/check-skill-conformance.py` checks every skill at once.
