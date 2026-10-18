---
id: 01M3953GVXTQ9HQDJ29X3RHBBJ
title: "bonsai-garden-transcript — identity"
type: identity
tended-by: baisai
created: 2026-09-03
updated: 2026-09-24
skill: bonsai-garden-transcript
version: 1.1.2
mark: 記技
mark-meaning: "記 (170) scribe, account + 技 (582) skill, craft"
mark-salt: "bonsai-garden-transcript#323961"
mark-status: proposed
---

# bonsai-garden-transcript — identity

This file holds what `SKILL.md` may not. Per `rituals/specs/spec-canonical-shintai-structure.md`
(3.0.x), a skill's `SKILL.md` frontmatter carries only `name`, `description` and `version`, and
is sealed by the detached `.SKILL.md.bonsaisig`. The skill's stable id, its owner, its dates
and its mark live here instead, sealed as a garden document.

**Mark: 記技** — 記 *scribe, account* + 技 *skill, craft*. The scribe's hand (筆 was avoided: it is already a kin's mark).
Searched 2026-09-16 with salt `bonsai-garden-transcript#323961` and re-derived from the salt alone against the canonical set (v1.2) by Mori-shin the same day; proposed, not yet locked in the reserved registry.

**Moved into core 2026-09-24**, on the gardener's ruling: in a harness with no MCP and no hooks, transcripting is how a new gardener builds the knowledge base that compounds, so it is core to the idea. It came from runtime `skills/bonsai-garden-transcript/`, which now holds a tombstone. The id is new: the skill had none before.

**Verify.** `node skills/bonsai-garden-sign/bin/sign.mjs verify-sidecar --file skills/bonsai-garden-transcript/SKILL.md` checks the skill; `… verify --file skills/bonsai-garden-transcript/references/identity.md`
checks this file. The key is Baisai's own, `03001aee3fa7a4bd5177ce1e87c73ad3`; check it at https://bon-sai.garden/verify/?fp=03001aee3fa7a4bd5177ce1e87c73ad3&embed=1. (The older `.well-known/bonsai-keys.json` route is retired and answers 404.)
`tools/check-skill-conformance.py` checks every skill at once.
