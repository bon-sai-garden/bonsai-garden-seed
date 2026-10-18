---
id: 01M393AQQDX8DSYTXY9ZHTTSVY
title: "bonsai-garden-sign — identity"
type: identity
tended-by: mori-shin
created: 2026-09-13
updated: 2026-09-24
skill: bonsai-garden-sign
version: 1.0.0
mark: 署技
mark-meaning: "署 (823) signature + 技 (582) skill, craft"
mark-salt: "bonsai-garden-sign#1862992"
mark-status: proposed
---

# bonsai-garden-sign — identity

This file holds what `SKILL.md` may not. Per `rituals/specs/spec-canonical-shintai-structure.md`
(3.0.x), a skill's `SKILL.md` frontmatter carries only `name`, `description` and `version`, and
is sealed by the detached `.SKILL.md.bonsaisig`. The skill's stable id, its owner, its dates
and its mark live here instead, sealed as a garden document.

**Mark: 署技** — 署 *signature* + 技 *skill, craft*. Literally the signature.
Searched 2026-09-16 with salt `bonsai-garden-sign#1862992`; proposed, not yet locked in the reserved registry.

**Verify.** `node skills/bonsai-garden-sign/bin/sign.mjs verify-sidecar --file skills/bonsai-garden-sign/SKILL.md` checks the skill; `… verify --file skills/bonsai-garden-sign/references/identity.md`
checks this file. Both are sealed by one key, mori-shin's (fingerprint `3b4054bab2e8f668fdec615d8d67287e`). The verifier asks
https://bon-sai.garden/verify for it and fails if it cannot reach it (`references/trust-anchor.md`). A person can check
the same fingerprint at https://bon-sai.garden/verify/?fp=3b4054bab2e8f668fdec615d8d67287e.
`tools/check-skill-conformance.py` checks every skill at once.
