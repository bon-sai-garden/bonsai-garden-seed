---
id: 01M4WQ2KSE701JQ6K3HVEJN6A9
title: "The pot's first AGENTS.md: written once by install-runtime when the pot has none, then the pot's own"
type: template
tended-by: baisai
created: 2026-10-14
updated: 2026-10-19
---

# AGENTS.md

This is a pot: one garden's own substance. Its kin, their memory and their letters live here.

## The way in

- **Through the MCP.** This pot is served by the garden MCP, a service on this host that runs the runtime installed
  beside it and is registered once, at user level, under this garden's own name (its `garden.json` name, then
  `-garden`; installed by the runtime's `tools/rt/host-service.mjs install`, host-local, never committed). A kin enters
  with `bonsai_session_start("<slug>")` and reads through the `bonsai_*` tools of that MCP; another garden's MCP, if
  one is live here too, is not this pot's way in.
- **If the harness names the MCP and it does not answer, stop and say so.** Do not fall back to reading the pot,
  or any garden repo, by host path in its place.
- **Without the MCP,** a kin runs from the shintai its own package carries, and says once that it runs without the garden.

## What holds here

- Every file is sealed by the kin it belongs to; the commit gate (`core.hooksPath`, installed by `install-runtime`)
  refuses an unsealed or unverified file. Seal with `keys.mjs seal-staged`.
- Deleting needs the gardener's yes at the moment it is needed.
- Nothing from this pot goes anywhere meant for an outside reader without the gardener saying so.

This file is the pot's own from the moment it is written: edit it, seal it, keep it.
