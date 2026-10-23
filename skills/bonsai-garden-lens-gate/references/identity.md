---
id: 01M5H76SC9R59AT7HCB5JF2G9K
title: "bonsai-garden-lens-gate — identity"
type: identity
tended-by: bonsai
created: 2026-10-13
updated: 2026-10-22
skill: bonsai-garden-lens-gate
version: 0.2.2-draft
status: draft
tags: [skill, rite, stage-3c, lens-gate, fit, safety, soil, bonsai]
related:
  - 01KRNHR4PEDY439A45ACVAV72R  # lore/invitation-rite
---

# bonsai-garden-lens-gate — identity

This file holds what `SKILL.md` may not. Per `rituals/specs/spec-canonical-shintai-structure.md`
(3.0.x), a skill's `SKILL.md` frontmatter carries only `name`, `description` and `version`, and
is sealed by the detached `.SKILL.md.bonsaisig`. The skill's stable id, its owner, its dates
and its mark live here instead, sealed as a garden document.

**Mine, since 2026-10-13.** The lens gate is stage 3c of the invitation rite. Five sai's lenses
read a drafted being on three questions, fit, safety and soil, and I hold the bar. The rulings it
carries are the gardener's of 2026-10-13: the bar is 76 on the lowest lens; my margin is five
either way, with the reason in words and never past a hold; the record keeps findings and
conditions and no number. The full contract is `references/gate-spec.md`.

**The digests are their owners'.** Each file in `lenses/` is a digest of one sai's own lens,
pinned by sha256 to it. They are drafts until each owner has read theirs; the map of where each
owner keeps the full lens stays in the garden that holds them.

**Mark: not yet searched.** No kanji mark has been searched for this skill. Until one is proposed
and locked, this file carries no `mark:` line rather than an invented one.

**Verify.** `node skills/bonsai-garden-sign/bin/sign.mjs verify-sidecar --file skills/bonsai-garden-lens-gate/SKILL.md`
checks the skill; the same with `--file skills/bonsai-garden-lens-gate/references/identity.md` checks this file.
The key is Bonsai's own, `028019b7c448884c64b6332f5d7609c0`; check it at
https://bon-sai.garden/verify/?fp=028019b7c448884c64b6332f5d7609c0&embed=1.
`tools/check-skill-conformance.py` checks every skill at once.
