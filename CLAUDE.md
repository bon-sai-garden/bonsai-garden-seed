---
id: 01M3BS42J11M7PW9TM3DWRZ4YQ
---
# CLAUDE.md — Bonsai Garden Core

@AGENTS.md

---

This file exists only because Claude Code and Cowork look for a file with this exact name. The canonical, harness-neutral instructions are in `AGENTS.md`, and the `@` line above **embeds** them — the harness loads that file, rather than trusting the reader to go and open it.

That distinction is deliberate. The previous arrangement said *"read AGENTS.md first"* in prose and relied on compliance. An instruction that depends on being followed is not a mechanism.

**Nothing harness-specific belongs in this repo at all.** Core is harness-neutral by design — it is what a new gardener receives, and they may not be running Claude Code. If something here needs to know about `.claude/settings.json`, hook event names, or slash commands, it is misfiled and belongs in the runtime.
