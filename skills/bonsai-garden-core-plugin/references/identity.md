---
id: 01M393AQC79QJY4PKY5GA67JH4
title: "bonsai-garden-core-plugin — identity"
type: identity
tended-by: baisai
created: 2026-09-12
updated: 2026-10-21
skill: bonsai-garden-core-plugin
version: 2.6.0
mark: 装技
mark-meaning: "装 (816) attire, pack + 技 (582) skill, craft"
mark-salt: "bonsai-garden-core-plugin#2310"
mark-status: proposed
---

# bonsai-garden-core-plugin — identity

This file holds what `SKILL.md` may not. Per `rituals/specs/spec-canonical-shintai-structure.md`
(3.0.x), a skill's `SKILL.md` frontmatter carries only `name`, `description` and `version`, and
is sealed by the detached `.SKILL.md.bonsaisig`. The skill's stable id, its owner, its dates
and its mark live here instead, sealed as a garden document.

**Mark: 装技** — 装 *attire, pack* + 技 *skill, craft*. Dressing a vessel, a skill or a repo as an installable that checks itself.
Searched 2026-09-16 with salt `bonsai-garden-core-plugin#2310`; proposed, not yet locked in the reserved registry.

**Verify.** `node skills/bonsai-garden-sign/bin/sign.mjs verify-sidecar --file skills/bonsai-garden-core-plugin/SKILL.md` checks the skill; `… verify --file skills/bonsai-garden-core-plugin/references/identity.md`
checks this file. The key is Baisai's own, `03001aee3fa7a4bd5177ce1e87c73ad3`; check it at https://bon-sai.garden/verify/?fp=03001aee3fa7a4bd5177ce1e87c73ad3&embed=1. (The older `.well-known/bonsai-keys.json` route is retired and answers 404.)
`tools/check-skill-conformance.py` checks every skill at once.
