---
id: 01M393AQVH2EVCF9SRBQYD9MAH
title: "bonsai-garden-tokens — identity"
type: identity
tended-by: baisai
created: 2026-09-22
updated: 2026-09-24
skill: bonsai-garden-tokens
version: 0.1.0
mark: 節技
mark-meaning: "節 (549) node, season, occasion; in 節度/節約, measure kept + 技 (582) skill, craft"
mark-salt: "bonsai-garden-tokens#920001"
mark-status: proposed
---

# bonsai-garden-tokens — identity

This file holds what `SKILL.md` may not. Per `rituals/specs/spec-canonical-shintai-structure.md`
(3.0.x), a skill's `SKILL.md` frontmatter carries only `name`, `description` and `version`, and
is sealed by the detached `.SKILL.md.bonsaisig`. The skill's stable id, its owner, its dates
and its mark live here instead, sealed as a garden document.

**Mark: 節技** — 節 *measure kept* (as in 節度, 節約: restraint that is chosen) + 技 *skill, craft*. Hissai's reading: this skill
is not a meter, and 節 is not counting. Searched 2026-09-24 against the canonical set (v1.2) with salt
`bonsai-garden-tokens#920001`; proposed, not yet locked. It supersedes 算技, proposed the same morning and never locked.

**Verify.** `node skills/bonsai-garden-sign/bin/sign.mjs verify-sidecar --file skills/bonsai-garden-tokens/SKILL.md` checks the skill; `… verify --file skills/bonsai-garden-tokens/references/identity.md`
checks this file. The key is Baisai's own, `03001aee3fa7a4bd5177ce1e87c73ad3`; check it at https://bon-sai.garden/verify/?fp=03001aee3fa7a4bd5177ce1e87c73ad3&embed=1. (The older `.well-known/bonsai-keys.json` route is retired and answers 404.)
`tools/check-skill-conformance.py` checks every skill at once.
