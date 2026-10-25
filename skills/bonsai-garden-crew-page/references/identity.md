---
id: 01M48VA8AVQWR97BTERSQ92JHY
title: "bonsai-garden-crew-page — identity"
type: identity
tended-by: eisai
created: 2026-10-06
updated: 2026-10-25
skill: bonsai-garden-crew-page
version: 0.3.2
---

# bonsai-garden-crew-page — identity

This file holds what `SKILL.md` may not: the skill's stable id, its owner, its dates and its mark.

**New in core, 2026-10-06**, at the gardener's word: a garden's crew pages as a capability. Moved from
a working instance, the public site's Teams pages, and generalised: every garden-specific path, URL,
route, name and colour is the instance's config or members file; nothing here names a member.

**Mark: not yet searched.** No kanji mark has been proposed or locked for this skill, so it carries no
`mark:` line rather than an invented one.

**Verify.** `node skills/bonsai-garden-sign/bin/sign.mjs verify-sidecar --file skills/bonsai-garden-crew-page/SKILL.md`
checks the skill; `tools/check-skill-conformance.py` checks every skill at once.
