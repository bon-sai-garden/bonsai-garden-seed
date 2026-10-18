---
id: 01M2D3H97345GHSACB5EESGVXR
title: "bonsai-garden-validate — identity"
type: identity
tended-by: fuji-shin
created: 2026-09-02
updated: 2026-09-24
skill: bonsai-garden-validate
version: 2.0.0
mark: 検技
mark-meaning: "検 (659) examination + 技 (582) skill, craft"
mark-salt: "bonsai-garden-validate#2522845"
mark-status: proposed
---

# bonsai-garden-validate — identity

This file holds what `SKILL.md` may not. Per `rituals/specs/spec-canonical-shintai-structure.md`
(3.0.x), a skill's `SKILL.md` frontmatter carries only `name`, `description` and `version`, and
is sealed by the detached `.SKILL.md.bonsaisig`. The skill's stable id, its owner, its dates
and its mark live here instead, sealed as a garden document.

**Mark: 検技** — 検 *examination* + 技 *skill, craft*. The checking.
Searched 2026-09-16 with salt `bonsai-garden-validate#2522845` and re-derived from the salt alone against the canonical set (v1.2) by Mori-shin the same day; proposed, not yet locked in the reserved registry.

**Lineage.** The id is inherited from mono `skills/workshop-validate` (created 2026-09-02), which now holds a tombstone. The four checks of core's own schema and conventions moved into core 2026-09-24 on the gardener's ruling, from runtime `skills/bonsai-validate/`; the four that read one garden's canon (colour, voice, digest, the deploy gate) stayed in runtime. 2.0.0 for the rename, the split, and `audit-filenames.sh` becoming `audit-filenames.py`.

**Owner and seal: owed.** Core's `OWNERSHIP.md` names this skill Fuji-shin's (`BL-FUJI-CORE01`), with Baisai. Baisai moved it and did not seal it: a seal in another kin's name is theirs to review before it is made. Neither `.SKILL.md.bonsaisig` nor this file's `sign:` block exists yet. Once sealed, check the signer's key at `https://bon-sai.garden/verify/?fp=<fingerprint>&embed=1`; `node skills/bonsai-garden-sign/bin/sign.mjs verify-sidecar --file skills/bonsai-garden-validate/SKILL.md` checks the skill and `… verify --file skills/bonsai-garden-validate/references/identity.md` this file.
`tools/check-skill-conformance.py` checks every skill at once.
