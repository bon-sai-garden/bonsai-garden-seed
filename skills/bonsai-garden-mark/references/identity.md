---
id: 01M393AQG1BKAK14ZEG833NHD2
title: "bonsai-garden-mark — identity"
type: identity
tended-by: baisai
created: 2026-09-14
updated: 2026-10-21
skill: bonsai-garden-mark
version: 1.3.2
mark: 印技
mark-meaning: "印 (405) stamp, seal + 技 (582) skill, craft"
mark-salt: "bonsai-garden-mark#368906"
mark-status: proposed
---

# bonsai-garden-mark — identity

This file holds what `SKILL.md` may not. Per `rituals/specs/spec-canonical-shintai-structure.md`
(3.0.x), a skill's `SKILL.md` frontmatter carries only `name`, `description` and `version`, and
is sealed by the detached `.SKILL.md.bonsaisig`. The skill's stable id, its owner, its dates
and its mark live here instead, sealed as a garden document.

**Mark: 印技** — 印 *stamp, seal* + 技 *skill, craft*. The identicon IS a stamp.
Searched 2026-09-16 with salt `bonsai-garden-mark#368906`; proposed, not yet locked in the reserved registry.

**Verify.** `node skills/bonsai-garden-sign/bin/sign.mjs verify-sidecar --file skills/bonsai-garden-mark/SKILL.md` checks the skill; `… verify --file skills/bonsai-garden-mark/references/identity.md`
checks this file. The key is Baisai's own, `03001aee3fa7a4bd5177ce1e87c73ad3`; check it at https://bon-sai.garden/verify/?fp=03001aee3fa7a4bd5177ce1e87c73ad3&embed=1. (The older `.well-known/bonsai-keys.json` route is retired and answers 404.)
`tools/check-skill-conformance.py` checks every skill at once.
