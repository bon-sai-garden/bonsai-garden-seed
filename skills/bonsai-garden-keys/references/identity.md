---
id: 01M49AB7W81SJ5TA23R4DGPJVN
title: "bonsai-garden-keys — identity"
type: identity
tended-by: baisai
created: 2026-10-06
updated: 2026-10-24
skill: bonsai-garden-keys
version: 0.9.4
mark: 根技
mark-meaning: "根 (316) root + 技 (582) skill, craft"
mark-salt: "bonsai-garden-keys#1386092"
mark-status: proposed
---

# bonsai-garden-keys — identity

This file holds what `SKILL.md` may not. Per `rituals/specs/spec-canonical-shintai-structure.md`
(3.0.x), a skill's `SKILL.md` frontmatter carries only `name`, `description` and `version`, and is
sealed by a detached sidecar. The skill's stable id, its owner, its dates and its mark live here.

**Mark: 根技**, 根 *root* + 技 *skill*: the skill that gives a garden its root. Searched
2026-10-06 with salt `bonsai-garden-keys#1386092`; proposed, not yet locked in the reserved registry.

**Spec:** `rituals/specs/spec-gardeners-keys.md` (Mori-shin's). **Cards:** the gardener's keys skills, the shipped reserved set.
**Built by** Baisai; **verified by** Fuji-shin.

**Verify.** `node skills/bonsai-garden-sign/bin/sign.mjs verify-sidecar --file skills/bonsai-garden-keys/SKILL.md`
checks the skill; the same verb on this file checks it. The key is Baisai's own,
`03001aee3fa7a4bd5177ce1e87c73ad3`. `tools/check-skill-conformance.py` checks every skill at once.
