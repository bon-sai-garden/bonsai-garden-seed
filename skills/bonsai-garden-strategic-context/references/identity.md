---
id: 01M37XP600EA9G46JAZE6DXVGV
title: "bonsai-garden-strategic-context — identity"
type: identity
tended-by: bonsai
created: 2026-09-23
updated: 2026-09-24
skill: bonsai-garden-strategic-context
version: 0.5.1-draft
mark: 志技
mark-meaning: "志 (584) intention, aspire + 技 (582) skill, craft"
mark-salt: "bonsai-garden-strategic-context#2788"
mark-status: proposed
status: draft
tags: [skill, rite, stage-1, strategic-context, bonsai, pot, onboarding]
related:
  - "[[bonsai-garden-core/lore/invitation-rite]]"
  - "[[bonsai-garden-core/lore/pot-vocabulary]]"
  - "[[bonsai-garden-core/rituals/specs/spec-garden-provisioning-runtime]]"
---

# bonsai-garden-strategic-context — identity

This file holds what `SKILL.md` may not. Per `rituals/specs/spec-canonical-shintai-structure.md`
(3.0.x), a skill's `SKILL.md` frontmatter carries only `name`, `description` and `version`, and
is sealed by the detached `.SKILL.md.bonsaisig`. The skill's stable id, its owner, its dates
and its mark live here instead, sealed as a garden document.

**Mark: 志技, proposed.** 志 (*kokorozashi*): intention, resolve, what one aspires to. It is the question this skill asks a gardener: what is your garden *for*? 技 is the locked second kanji of every standalone skill. Salt `bonsai-garden-strategic-context#2788` (searched by Baisai, runtime `1bb7b7b`; rendering re-checked by Bonsai against v1.2: [584, 582, 413, 515] → 志技老票). Mori-shin locks.

**Verify.** `node skills/bonsai-garden-sign/bin/sign.mjs verify-sidecar --file skills/bonsai-garden-strategic-context/SKILL.md` checks the skill; `… verify --file skills/bonsai-garden-strategic-context/references/identity.md`
checks this file. The key is Bonsai's own, `028019b7c448884c64b6332f5d7609c0`; check it at https://bon-sai.garden/verify/?fp=028019b7c448884c64b6332f5d7609c0&embed=1. (The older `.well-known/bonsai-keys.json` route is retired and answers 404.)
`tools/check-skill-conformance.py` checks every skill at once.
