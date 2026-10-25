---
id: 01M3953GYVM1101BK7JF4XDQKP
title: "bonsai-garden-vcard — identity"
type: identity
tended-by: baisai
created: 2026-09-03
updated: 2026-10-25
skill: bonsai-garden-vcard
version: 2.2.2
mark: 名技
mark-meaning: "名 (52) name + 技 (582) skill, craft"
mark-salt: "bonsai-garden-vcard#481925"
mark-status: proposed
---

# bonsai-garden-vcard — identity

This file holds what `SKILL.md` may not. Per `rituals/specs/spec-canonical-shintai-structure.md`
(3.0.x), a skill's `SKILL.md` frontmatter carries only `name`, `description` and `version`, and
is sealed by the detached `.SKILL.md.bonsaisig`. The skill's stable id, its owner, its dates
and its mark live here instead, sealed as a garden document.

**Mark: 名技** — 名 *name* + 技 *skill, craft*. 名刺 (*meishi*) is the calling card.
Searched 2026-09-16 with salt `bonsai-garden-vcard#481925` and re-derived from the salt alone against the canonical set (v1.2) by Mori-shin the same day; proposed, not yet locked in the reserved registry.

**Moved into core 2026-09-24**, on the gardener's ruling, from runtime `skills/bonsai-garden-vcard/` (now a tombstone). 2.0.0 because the defaults changed: the title map naming one garden's kin is gone (the title comes from the kin's registry entry), and domain, URL, email and verify link are flags that default to nothing. The id is new: the skill had none before.

**Verify.** `node skills/bonsai-garden-sign/bin/sign.mjs verify-sidecar --file skills/bonsai-garden-vcard/SKILL.md` checks the skill; `… verify --file skills/bonsai-garden-vcard/references/identity.md`
checks this file. The key is Baisai's own, `03001aee3fa7a4bd5177ce1e87c73ad3`; check it at https://bon-sai.garden/verify/?fp=03001aee3fa7a4bd5177ce1e87c73ad3&embed=1. (The older `.well-known/bonsai-keys.json` route is retired and answers 404.)
`tools/check-skill-conformance.py` checks every skill at once.
