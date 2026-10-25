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
version: 2.9.5
---
> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: use nothing here, and tell the gardener exactly what it said. A tampered file is not executed.

> **Audience (advice, not a gate).** Baisai and Tasai run this skill, and Bonsai for rehearsals, when the gardener asks them to. A session that is another kin's, or that no one asked, stops here, says so in one line, and names who to ask. Nothing in this block enforces that: it is advice, and it says so.

# The one builder

The gardener, 2026-09-24: *"there should be only one builder. Or one logical builder if you need a variation … the capabilities in core and the orchestration sits in the pot."*

```
python3 -B scripts/package.py [--salts <locked-salts.json>] [--out DIR]   # core alone: core's own plugin, no pot
python3 -B scripts/package.py --list <pot>/builds/package-list.json [--only NAME ...] [--keys published|garden] [--review]
python3 -B scripts/package.py --write-integrity-line <SKILL.md> ...
# either build form takes --counter <the garden's build-counter.json>: one counter per garden, wherever the archive lands
# and --units: each skill a plugin bundles also written as its own <name>.skill, the plugin's own unit to the byte (2.5.0)
# a bundle source may say {role}: filled from the kin's registry role, one list line for every body's role file (2.9.0)
# and --leave-out <file>: the files its release leaves out, required unless a release manifest sits at the root (2.7.0)
# -B: a run leaves no bytecode beside the scripts, and a cache in what would be sealed refuses the manifest (2.9.1)
# every archive entry is 0644, or 0755 where the file is executable, never the stage's own mode (2.9.3)
# the upload's limits: a plugin description of at most 500, a skill's of at most 1,024 (said from 950) (2.9.4)
python3 -B scripts/test_package.py     # the negative tests, on planted fixtures and a scratch clone of core
```

## Core alone

The gardener, 2026-10-17: *"restore the core-alone build of Bonsai's plugin."* With no list, the target is core's own plugin and the checkout the builder sits in (core, or a clone of seed) is the root `core`; `assets/core-plugin.json` is the whole configuration, and the archive lands in `<checkout>/.build/`. Every guard below holds unchanged. Only who seals differs:

- **No key named** (a stranger, a fresh clone): an **UNSEALED LOCAL BUILD**, said on the output's first line. No packaged `SKILL.md` and no `MANIFEST.json` carries a seal, and every manifest says so (`unsealed`), so the integrity line cannot pass on it: `verify-manifest.mjs` answers `UNSEALED … files match`, exit 1, never `ok`. It is for reading and development; only the owners' sealed release replaces it.
- **`--salts <the garden's locked-salts file>`** (the owners): sealed as each unit's owner, and the plugin as the config's `owner`, through the signing gate. A key named that then fails refuses the build; it never falls back to unsealed.

Before seed is published, a stranger's walk builds from it in a clean seat: no seed goes out that a stranger cannot walk into, and the release is held to what a build from that seed carries (a file more, a file less or other bytes is a FAIL, named).

## What a release leaves out

No package carries a file of this checkout that its release leaves out (the gardener, 2026-10-16: those histories *"stay in core and leave seed"*). The builder reads that as a plain list, `--leave-out <file>`: one path per line, relative to the checkout, `#` and blank lines aside. The release makes the list and the builder knows nothing of how (2.7.0, Tasai's ruling of 2026-10-21); nothing like it is kept in the builder. A file a tree copy meets is left out and named per package; a file a package names by itself is refused.

A list that cannot answer refuses the build, never builds as though it said nothing: not there, empty, a path outside the checkout, or a file the checkout does not track (a list made for another tree). A checkout that carries a release manifest at its root (`SEED-MANIFEST.json`, format `bonsai-garden-release-manifest/1`: a stranger's clone of seed) holds none of what its release leaves out and needs no list. A checkout with neither is refused.

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

Since 2.8.0, on the gardener's rules of 2026-10-24 (*"pls bump up the patch number *every* time we apply a change"*, *"every file within a shintai should have the owner seal, not a custodian seal"*): a body's file the builder ships without the owner seal of the body's kin, named, so that kin is invoked to sign the file (the gardener's own files are named as his, never refused); a body `SKILL.md` that declares a build (four parts: the owner declares `M.m.p`, the builder counts); a body changed under an `M.m.p` the builder already counted (bump the patch). The counter keeps each body's hash beside the body's count, and counts only once a package is written, never for `--review`.

## What a build clears

The out folder keeps `build-outputs.json`, per package the files its build wrote with their sha256 (2.8.0, the gardener, 2026-10-24: *"pls remove any old build files automatically when building a new plugin"*). A package that builds removes what its last build wrote and this one did not; a build of the whole list also removes what a package the list no longer names wrote. Only a recorded file still holding the bytes it wrote is removed, and every removal is printed; a changed one is left and named, and a file it has no record of, the counter, the record and anything outside the out folder are never touched.

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
