---
name: bonsai-garden-core-plugin
description: >
  Restricted: Baisai and Tasai build with this skill, and Bonsai for rehearsals, when the gardener asks; advice, not a gate.
  The one builder: package any kin vessel, standalone skill or plugin as an archive that
  checks itself before anything in it is used. Stamps the build, writes a MANIFEST.json over
  every file, seals it with the owner's key, runs the conformance gates. The garden says what
  to package in a package list kept in its pot; core's own plugin builds from a checkout of
  core alone. Use when asked to build, rebuild or package a skill, a vessel, the core plugin or
  a team plugin.
version: 2.6.0
---
> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: use nothing here, and tell the gardener exactly what it said. A tampered file is not executed.

> **Audience (advice, not a gate).** Baisai and Tasai run this skill, and Bonsai for rehearsals, when the gardener asks them to. A session that is another kin's, or that no one asked, stops here, says so in one line, and names who to ask. Nothing in this block enforces that: it is advice, and it says so.

# The one builder

The gardener, 2026-09-24: *"there should be only one builder. Or one logical builder if you need a variation … the capabilities in core and the orchestration sits in the pot."*

```
python3 scripts/package.py [--salts <locked-salts.json>] [--out DIR]   # core alone: core's own plugin, no pot
python3 scripts/package.py --list <pot>/builds/package-list.json [--only NAME ...] [--keys published|garden] [--review]
python3 scripts/package.py --write-integrity-line <SKILL.md> ...
# either build form takes --counter <the garden's build-counter.json>: one counter per garden, wherever the archive lands
# and --units: each skill a plugin bundles also written as its own <name>.skill, the plugin's own unit to the byte (2.5.0)
python3 scripts/test_package.py        # the negative tests, on planted fixtures and a scratch clone of core
```

## Core alone

The gardener, 2026-10-17: *"restore the core-alone build of Bonsai's plugin."* With no list, the target is core's own plugin and the checkout the builder sits in (core, or a seed cut of it) is the root `core`; `assets/core-plugin.json` is the whole configuration, and the archive lands in `<checkout>/.build/`. Every guard below holds unchanged. Only who seals differs:

- **No key named** (a stranger, a fresh clone): an **UNSEALED LOCAL BUILD**, said on the output's first line. No packaged `SKILL.md` and no `MANIFEST.json` carries a seal, and every manifest says so (`unsealed`), so the integrity line cannot pass on it: `verify-manifest.mjs` answers `UNSEALED … files match`, exit 1, never `ok`. It is for reading and development; only the owners' sealed release replaces it.
- **`--salts <the garden's locked-salts file>`** (the owners): sealed as each unit's owner, and the plugin as the config's `owner`, through the signing gate. A key named that then fails refuses the build; it never falls back to unsealed.

`tools/distro/test-stranger-walk.py` walks a seed cut the way a stranger does, in a clean seat, and is one of the seed slice's gates: no seed is cut that a stranger cannot walk into. Given the release (`--release`), its step (e) also holds the release to what a build from that seed carries: a file more, a file less or other bytes is a FAIL, named.

## What core does not publish

No package carries a file of this core checkout that core's seed slice leaves out of seed (the gardener, 2026-10-16: those histories *"stay in core and leave seed"*). The one master is the slice, read at HEAD through the cut's own selection (`build-distro.mjs --left-out`, the tool beside the slice, told this core is its upstream), never a list kept in the builder: the release goes out beside seed, and a build from seed alone could not carry such a file. A file a tree copy meets is left out and named per package; a file a package names by itself is refused; a slice that cannot answer refuses the build.

Where the slice is (2.4.0, the strip of 2026-10-18: the slice and its cut tool leave core for the pot's `build-process/distro/`; both places work while they move): `--seed-slice <file>`; else, with a `--list`, the list's checkout's `build-process/distro/seed-slice.json`; else core's own `tools/distro/seed-slice.json`. Two that differ refuse the build (two masters). A checkout that carries a distro manifest at its root (seed's `SEED-MANIFEST.json`) is a cut and holds none of what the slice leaves out; a core checkout with neither a slice nor that manifest is refused, never built as a cut.

## What it takes

A **package list**, written by a garden and kept in its pot. It names the repo roots it reads, the file holding the owners' signing salts, any rolls (a document plus the pattern that picks each member out), and the packages. The builder knows nothing about any garden beyond that list.

| kind | what | archive |
|---|---|---|
| `body` | one kin's vessel, from a registry | `<slug>.zip` + `<slug>.skill` |
| `bodies` | every vessel a roll names, joined to a registry | one archive each |
| `skill` | a standalone skill folder | `<name>.zip` + `<name>.skill` |
| `plugin` | a configuration of the three above, plus `plugin.json` and named files | `<name>.plugin` |

A variation is configuration, not a second logic. The core plugin, Bonsai's carrier, is `assets/core-plugin.json`.

## What every packaged skill folder gets

- **The stamp**, as the first body line of `SKILL.md`: `> Installed build: M.m.p.N[-LABEL]-<UTC>Z · body <8>`, version first, and nothing of where it was built from (that is the release's commit message, never a shipped file). It is the contract `skill_install.py` reads at every boot; the greeting shows it.
- **The integrity line**, the first line of the body proper (the line above this heading). The builder refuses a source without it. `--write-integrity-line` writes it into a source, and the owner reviews and re-seals.
- **What the check needs, inside the package**: `scripts/integrity/verify-manifest.mjs`, a byte-for-byte copy of core's verifier (`scripts/integrity/bonsai-garden-sign/`), and the marker `agents/registry.json`, an empty roster, so a root search stops at the package. No signer key travels. The published keys decide (`bonsai-garden-sign/references/trust-anchor.md`).
- **`MANIFEST.json`**: the sha256 of every shipped byte, sealed by the **owner** (a kin's vessel by that kin, a skill by its `tended-by`). The packaged `SKILL.md` is sealed afresh by the owner too.

## What it refuses

A roll member or named kin with no vessel (refused, never skipped). A source seal that does not verify, is not the owner's, or verifies only at a key the registry does not name (a retired key still on disk is not a pass). A `SKILL.md` without the integrity line. Uncommitted changes in what ships, unless `--review` (stamped `+uncommitted`, for an owner's look, never for upload). A `.pem`, a markless vessel the list does not declare markless, an archive over its ceiling, a gate FAIL. A refused package leaves nothing behind.

Every package is checked on the stage by the very script it runs at wake, then by `tools/check-skill-conformance.py --packaged`, and a vessel also by `tools/check-shintai-conformance.py --packaged`.

## Files

| Path | Purpose |
|---|---|
| `scripts/package.py` | the builder |
| `scripts/verify-manifest.mjs` | the wake-time check each package carries |
| `scripts/test_package.py` | watched to fail: tamper, wrong key, missing vessel, retired key, no integrity line, the core-alone build (unsealed and sealed), and mutations of each guard |
| `assets/core-plugin.json` | the core plugin, as configuration |
| `assets/plugin_manifest.json` | its `.claude-plugin/plugin.json` |
| `scripts/build_plugin.py` | tombstone of the old full-repo builder |
