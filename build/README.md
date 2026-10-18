---
id: 01M57VZERDR35MGFA966FFJCS4
title: "build/ — core's sealed packages: Bonsai as a skill, the core plugin, and every skill it bundles"
type: readme
tended-by: tasai
created: 2026-10-18
updated: 2026-10-18
status: active
---

# build/

Core's sealed packages, ready to install. Built by core's one builder from core `713a9af`, sealed by each owner's key, every package checked from a clean folder before it was committed here.

| File | What it is |
|---|---|
| `bonsai.skill` | **Bonsai alone**, the guardian spirit who walks a new gardener in |
| `bonsai-garden-core.plugin` | Bonsai **and** every core skill, as one plugin (version 0.4.1) |
| `bonsai-garden-*.skill` | each core skill the plugin bundles, as its own package |

Each file has its `.sha256` beside it.

## Check before you install

1. `shasum -a 256 -c bonsai.skill.sha256` (the same for any other file) must answer `OK`.
2. Unzip it and run its own check. It must answer `ok`, name who sealed it, and say `keys published`. Anything else: stop, and use nothing in it.
   - **A `.skill`** unzips into a folder of its name: `unzip bonsai.skill && cd bonsai && node scripts/integrity/verify-manifest.mjs`
   - **The plugin** unzips into its root: `mkdir core-plugin && cd core-plugin && unzip ../bonsai-garden-core.plugin && node skills/bonsai/scripts/integrity/verify-manifest.mjs --dir .`

## Install

**In the Claude app, upload the `.zip`.** The app's upload takes a `.zip`, not a `.plugin` or `.skill`. Each `.zip` here is the same file, byte for byte, as its `.plugin` or `.skill` twin (same sha256).

- **The core plugin** (Bonsai and every core skill): upload `bonsai-garden-core.zip` where the app adds a plugin.
- **Bonsai alone**: upload `bonsai.zip` where the app adds a skill.

In Claude Code from a terminal, the `.plugin` installs through a plugin marketplace; the `.skill` unzips into your skills folder.

Bonsai checks himself again before anything else when he wakes.

## Why these, and not a build of your own

Only the garden's owners can seal these packages. A build from source without their keys is **unsealed**: its own check answers `UNSEALED`, and it never wakes. These files are the ones that do.
