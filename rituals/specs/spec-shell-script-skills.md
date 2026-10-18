---
id: 01M37XP601ZDBWJ8JVKT16QTNQ
title: Shell Script Skills — Spec
type: spec
status: in-progress
tended-by: baisai
created: 2026-09-01
tags: [skills, shell, tooling, spec]
---

# Shell Script Skills — Spec

Map the workshop's `tools/` shell scripts to installable Claude Code skills so agents can invoke them with clear, consistent guidance.

## Rationale

`tools/` contains 100+ shell scripts serving distinct operational domains. Without skills wrapping them, an agent must interpret each script's header cold — no domain context about prerequisites, sequencing, or agent-tier constraints. Skills fix this: one `SKILL.md` per domain gives the right level of guidance without a wall of raw headers.

## Scope

**Covered:** scripts that agents invoke in the course of workshop operations.

**Not covered:** one-off setup scripts (`provision-*`, `install-*`), host-specific infra (`mac-remote-access/`, `buzz-nest/`), deprecated scripts, and scripts whose subject is so narrow they need no skill (e.g. `set-env.sh`).

## Home repo

**bonsai-garden-core** — until these skills are battle-tested. Scripts themselves remain in `bonsai-garden/tools/`; this repo holds the skill definitions that wrap them.

## Skill registry

| Skill | Path | Scripts covered |
|-------|------|-----------------|
| `bonsai-garden-sign` | `skills/bonsai-garden-sign/` | resign-all.sh, resign-delta.sh, sign-skills-batch.sh, sign-hissai-batch.sh, sign-triu-diary-batch.sh, sign-w-constitution.sh, sign-walk-with-me.sh, sign-pillow-note.sh, triu-canon-resign.sh |
| `bonsai-garden-core-plugin` | `skills/bonsai-garden-core-plugin/` | `scripts/package.py`, the one builder, in place of build-crew-skill-zips.py, build-bon-sai-team-plugin.sh, build-bonsai-plugin.sh, build-bonsai-core-plugin.sh and build_plugin.py; still unported: build-skill-zips.sh, build-bonsai-mcp-plugin.sh, build-agents-roster.mjs, build-chronicles-site.py, build-bambu-plugin.sh |
| `bonsai-garden-validate` | `skills/bonsai-garden-validate/` | validate-metadata.py, check-frontmatter-order.py, check-path-references.py, audit-filenames.py (2026-09-24: the checks of core's own schema; check-color-drift.mjs, check-voice-drift.py, check-digest-coverage.py and pre-deploy-gate.sh stay in runtime's `bonsai-validate`) |
| `bonsai-deploy` | `skills/bonsai-deploy/` | deploy-site.sh, publish-site.sh, ship-all.sh, deploy-genkan.sh, deploy-garden-extract.sh, deploy-worker.sh, ship-companion-fixes.sh, ship-kiosk.sh |
| `bonsai-render` | `skills/bonsai-render/` | render-kanji-identicon.py/.mjs, render-identicon.js, render-feedstock.py, canon-render.sh, render-name-mark.py, render-skill-identicon.js, render-self-reading.py |
| `bonsai-infra` | `skills/bonsai-infra/` | reload-mcp.sh, fix-claude-permissions.sh, purge-claude-logs.sh, setup-verify-infra.sh, observability-sync.sh |

## Status

- [x] spec written (this document)
- [x] `bonsai-garden-sign` SKILL.md
- [x] `bonsai-garden-core-plugin` SKILL.md
- [x] `bonsai-garden-validate` SKILL.md (was `bonsai-validate`; split 2026-09-24)
- [x] `bonsai-deploy` SKILL.md
- [ ] `bonsai-render` SKILL.md — on hold (second batch)
- [ ] `bonsai-infra` SKILL.md — on hold (second batch)
- [ ] install/link into `~/.agents/skills/` (Aruji to confirm path convention)
- [ ] register in `skills-lock.json`

## Decisions

1. **Home repo:** bonsai-garden-core (confirmed 2026-09-01 by the Aruji)
2. **bonsai-render + bonsai-infra:** hold for second batch (confirmed 2026-09-01)
3. **Scope:** bonsai-garden-core only for all skill files this sprint
