---
id: 01KRNG72ZKXZNPZB8YJQHGKHBN
title: Workshop Metadata Schema
type: spec
tended-by: hissai
author: hissai
created: 2026-05-15
updated: 2026-10-24
version: 0.6.4
status: active
tags: [metadata, schema]
related: [01KRNHR9S6NMG9M7JNSVQHJK5A, 01KTE6RKE0AT41808KDH8T9GV7]
moved-from: lore/metadata-schema.md
moved-note: >
  Two SIGNED documents still point at the old path in their reading lists —
  lore/harness-engineering.md (two refs) and lore/pot-vocabulary.md (one).
  Both carry valid Hissai signatures, and both references are prose "see also"
  entries, which the workshop's own cross-reference rule allows to be stale.
  Updating them would have invalidated two good signatures to freshen a pointer
  in a reading list; that is the worse trade. They are left, and the debt is
  recorded here: fix them on Hissai's next edit + re-sign of those files.
  agents/shared/codex-workshop.md WAS updated — its Triu signature was already
  failing before this move, so nothing valid was spent.
  Paid since: both reading lists now point at rituals/specs/metadata-schema.md.
moved-on: 2026-09-14
note: "sign block stripped 2026-06-03 (v0.1.6) and 2026-09-04 (v0.5.0); a stale 0.4.0 signature dropped 2026-09-14, when the body was brought up to v0.5.0 — a signature over an older body is not a newer body. No re-sign is owed: since seal v2 the file is sealed by its sidecar, made again on every edit."
---

# Workshop Metadata Schema — v0.1.6

> The workshop-canonical reference for YAML frontmatter on every `.md` file in the garden. *The shape that lets everything else read itself.*

---

## Purpose

Every `.md` file in the garden carries YAML frontmatter. Six required fields, a small optional set, controlled vocabularies for `type` / `tags` / `tended-by`. The schema is the workshop's first design system — Obsidian Dataview reads it, the validator (`tools/validate-metadata`) verifies it, future surfaces (the album, the public site, the AI-UI layer) inherit from it.

The schema falls out from the four-sibling consultation at `rituals/specs/obsidian-metadata-proposal.md` v0.1.0. The channel was sub-agent spawn per lesson #4 (sai-agent inter-communication). This file is the canonical reference; the proposal is the deliberation that produced it.

**Discipline:**

- Conventions harden through use, not decree — the six required fields are locked for two weeks before any seventh is considered. The optional set may grow.
- Kebab-case everywhere — field names, controlled values, file paths. YAML allows snake_case; the workshop holds kebab-case.
- Frontmatter does not disclose process — *what a file is*, not *how it came to be*.
- Refactor-safety lives in stable identifiers, not stable paths — structural references use `id`, not path.

---

## Required fields — every `.md` file

Six fields. The minimum. Omission is the only mistake.

```yaml
---
id: 01HXVK2T8N4W3PQR5MFNC7BG8H        # ULID — see §ID strategy
title: True North and the Soil          # human-readable; usually duplicates H1
type: chronicle                          # controlled vocabulary — see §Type enum
tended-by: hissai                        # controlled vocabulary — see §Tended-by enum
created: 2026-05-15                      # ISO date — file's first existence
updated: 2026-05-15                      # ISO date — last meaningful edit
---
```

### `id` — ULID, time-ordered

**Format:** ULID. Crockford base-32, 26 characters, time-prefixed.

**Why ULID, not UUIDv4.** UUIDv4 is opaque noise. ULID is opaque noise that *sorts lexically by creation time*. The id itself carries an invariant — sort a directory listing by id and you get chronological order without consulting any other field. The cost is identical to UUIDv4; the benefit is a free invariant the workshop did not have to pay for. The Crockford alphabet excludes the visually-ambiguous characters (`I`, `L`, `O`, `U`); the result is paste-safe and search-safe.

**Generation:** never hand-typed. The helper at `tools/new-file <type> <slug>` emits frontmatter with `id` pre-filled. Hand-typed ids are forbidden — Fuji-shin warns.

**Uniqueness:** workshop-wide. Two files sharing an id is a uniqueness violation; Fuji-shin signals three *nees* when they see one.

**Example:** `01HXVK2T8N4W3PQR5MFNC7BG8H` (leading characters encode the timestamp; trailing 16 characters are random).

### `title` — human-readable

The line a human reads as the file's name. Usually duplicates the H1 inside the file. When the H1 is decorated (kanji parens, italics), the title is the plain form.

**Type:** string, unquoted unless special characters force quoting (`:`, leading `-`, etc.).

**Example:** `title: The Invitation Rite`

### `type` — controlled vocabulary

The file's category. Drives downstream queries, validator behavior, and rendering hooks. See §Type enum for the full list and category structure.

**Type:** string, kebab-case, must match one value in the type enum.

**Example:** `type: chronicle`

### `tended-by` — ownership / care

Which agent (or `workshop` / `aruji`) currently tends the file. The field names *who tends the file*, not *who wrote it* — tending is an ongoing fact, authorship is a historical disclosure. See §Tended-by enum.

**Type:** string, kebab-case, must match a known agent slug or a structural tender. As of v0.1.6 the valid agent set is **derived from the `agents/` tree**, not hand-listed — see §Tended-by enum.

**Example:** `tended-by: baisai`

### `created` — ISO date

The file's first existence — when it landed in the workshop, not when its subject occurred. ISO 8601 (`YYYY-MM-DD`), unquoted (YAML parses as date; Obsidian Dataview indexes as date).

**Retrofit rule:** for existing files, use git first-commit date when available; otherwise the file's stated authoring date inside the document; otherwise today's date with a `note:` field flagging the approximation. Fuji-shin warns on approximated dates so they do not masquerade as exact.

**Type:** ISO date, unquoted.

**Example:** `created: 2026-05-15`

### `updated` — ISO date

Last meaningful edit. Updated on substantive change; a typo fix may but need not bump it. *Meaningful* is the author's call; the validator only checks that `updated >= created`.

**Type:** ISO date, unquoted.

**Example:** `updated: 2026-05-15`

---

## Optional fields — declared when applicable

Declare each only when it adds signal. Empty optional fields are noise; omit instead.

### `tags` — controlled vocabulary

A list of subject / register tags from §Tag vocabulary. Earns its place by disambiguating queries the workshop will actually run.

**Type:** YAML list, even with one entry (`tags: [meta]`). Never a comma-separated string.

**When to declare:** when the file's `type` alone does not get a future reader (or a future query) to the right place. Empty `tags: []` is acceptable.

```yaml
tags: [meta, cosmology]
```

### `mentions` — agents named in body

A list of agent names referenced in the file's body. Refactor + audit aid: when a pronoun sweep or a rename needs to find every file naming an agent, `mentions` is the index.

**Type:** YAML list, kebab-case names.

**When to declare:** when the file names one or more agents in its body and the reference matters for cross-file queries (chronicles, lore, working-state, journal).

```yaml
mentions: [zensai, tasai, eisai, baisai]
```

### `status` — lifecycle

The file's place in its own lifecycle.

**Allowed values:** `active | draft | staged | published | superseded | retired`

- `active` — in current use; the default for most live files
- `draft` — being authored; not yet load-bearing
- `staged` — finished, awaiting Aruji review or scheduled publication
- `published` — for outward-facing files (chronicles, public site, brand surfaces) that have shipped
- `superseded` — replaced by another file; see `superseded-by`
- `retired` — no longer in use, kept for history; the validator does not require all fields on retired files

**When to declare:** always for files that have a lifecycle worth naming. Optional for stable lore / chronicles where the absence of `status` implies `active`.

```yaml
status: active
```

### `version` — semver

When the file is semver-versioned. The frontmatter `version` is the file's current version; the history of its changes is its git history, not a block at the foot of the file.

**Type:** version string, no leading `v`: `MAJOR.MINOR.PATCH[.BUILD][-LABEL]` per the codex (§9 workshop / §6 external). A document at source carries three parts; a re-sealed or re-produced artefact may carry the fourth (`2.7.7.4`) and a label (`3.0.0.1-2026-09-22`). Validators compare the four numeric fields and ignore the label.

**When to declare:** when the file is one of the workshop's versioned artifacts — `lore/*.md`, `rituals/specs/*.md`, agent `SKILL.md` / `about-me.md`, `CHANGELOG.md`, root `README.md`.

```yaml
version: 1.0.1
version: 2.7.7.4
version: 3.0.0.1-2026-09-22
```

### `supersedes` / `superseded-by` — refactor lineage

Reference by `id`, not by path. Path-based references break under rename or move; id-based references survive.

**Type:** ULID string.

**When to declare:**

- `supersedes`: on the *new* file, names the id of the file it replaced
- `superseded-by`: on the *old* file (which keeps living, with `status: superseded`), names the id of the replacement

```yaml
supersedes: 01HXVK2T8N4W3PQR5MFNC7BG8H
```

```yaml
status: superseded
superseded-by: 01HXY0N4WQ7M3PR8B5KFCG2H6E
```

### `related` — cross-references by id

A list of related files, by id. Path-based cross-references in human prose are fine; metadata-consumed references use `id`.

**Type:** YAML list of ULIDs.

**When to declare:** when another file in the workshop is structurally related (companion lore, the originating spec, a paired chronicle) and the relationship is worth surfacing in a query.

```yaml
related: [01HXVK2T8N4W3PQR5MFNC7BG8H, 01HXY0N4WQ7M3PR8B5KFCG2H6E]
```

**Hub-and-spoke convention (v0.2.0)**

For clustered artifacts (a spec and its chronicle, a role and its instances, a lore doc and its companion specs), use hub-and-spoke:

- **Hub (anchor) doc** carries the full peer set: `related: [<spoke-1-id>, <spoke-2-id>, ...]`
- **Spoke docs** carry a one-element back-pointer to the hub: `related: [<hub-id>]`
- The anchor is the most canonical doc in the cluster — typically the spec, the role definition, or the lore entry

For simple two-file organic relationships, both files list each other — no designated hub required.

The validator's `--strict-related` flag checks bidirectionality: every spoke's hub must list the spoke in return. Default mode emits warnings; `--strict-related` escalates to errors.

### `confidentiality` — release register

The file's confidentiality class. Defaults to `workshop-internal` when absent.

**Allowed values:** `workshop-internal | intel | excourse | public`

- `workshop-internal` — visible to the workshop; not surfaced externally without Aruji approval (the default)
- `intel` — restricted; real data about real people; lives inside `pots/<tenant>/...`. Never appears in outputs intended for sharing
- `excourse` — private working material about the Aruji; lives inside `pots/<tenant>/...` and adjacent locations
- `public` — explicitly approved for outward surfacing (published chronicles, brand assets, public site content)

**When to declare:** whenever the file's class is anything other than `workshop-internal`. Declare on intel / excourse / public files always; the default may be left implicit.

```yaml
confidentiality: intel
```

### `image` — primary image reference

Carries the existing chronicle convention forward. The single primary image for the file (header art, portrait, cover render).

**Type:** string — either a workshop image name (`cosmology-01`) or a relative path (`images/cosmology-01.png`) or an Obsidian wikilink (`[[hissai.png]]`).

**When to declare:** when the file has a primary image rendered in its body.

```yaml
image: cosmology-01
```

### `cover` — design-register hero

A larger hero image for design surfaces (the album, the public site, gallery pages). Distinct from `image` — `image` is the file's content-image; `cover` is the surface's display-image.

**Type:** string path.

**When to declare:** when **Eisai** has rendered a cover for the file (chronicles, lore artifacts surfaced in the album).

```yaml
cover: assets/cover-cosmology.png
```

### `gallery` — image array

A list of images carried by the file, beyond the primary `image`. Drives gallery rendering and asset audits.

**Type:** YAML list of strings.

```yaml
gallery:
  - images/cosmology-01.png
  - images/cosmology-02.png
```

### `register` — voice / audience register

The file's audience register. Eisai's framing — useful for the album and outward surfaces.

**Allowed values:** `inward | outward | Aruji-only`

- `inward` — workshop-internal voice, agent-to-agent
- `outward` — public-shaped voice, prepared for external surfaces
- `Aruji-only` — written for the Aruji's eye only

```yaml
register: inward
```

### `caption` — one-line caption

For gallery / album rendering. The line a reader sees beneath the image when the file appears in a grid.

**Type:** string.

```yaml
caption: The morning the workshop named its shape.
```

### `aliases` — Obsidian alias support

A list of alternate names by which the file may be referenced via Obsidian wikilinks. Useful when a lore artifact has a Japanese name and an English handle.

**Type:** YAML list of strings.

```yaml
aliases: [kanjō, invitation-rite]
```

### `cssclass` — Obsidian rendering hook

A CSS class applied to the rendered note. Strategic — reserved for design-system styling once **Eisai's** workshop brand system lands the brand tokens and any companion Obsidian theme.

**Type:** string, kebab-case.

**When to declare:** on files participating in design-system rendering. Out of scope for v0.1.0 by default; Eisai authorizes specific uses.

```yaml
cssclass: chronicle
```

### `palette` — design-token reference

A palette name (once the brand system lands) keyed against the workshop's brand tokens. Reserved for design surfaces.

**Type:** string.

```yaml
palette: workshop-default
```

### `note` — provenance flag

A short note attached to the metadata itself — most commonly to flag an approximated `created` date during bulk retrofit. Fuji-shin warns on the presence of `note` so a future reader can trust the dates that have no note.

**Type:** string.

```yaml
note: created date approximated during bulk retrofit; git history unavailable
```

---

## Type enum — controlled vocabulary

The working set, organized by category. New types are *proposed* via the `patterns.md` channel — Baisai proposes, Aruji approves. New types are not invented in-band.

### Chronicle layer

| Type | When to use |
|---|---|
| `chronicle` | A dated chronicle entry under `/chronicles/`. The narrative memory of the workshop. **Hissai's** register. |
| `lore` | A lore artifact under `/lore/` — Japanese terms, architectural concepts, gardener vocabularies, the metadata schema itself. |
| `pillar` | A pillar document under `/diary/pillars/` — a structural decision the workshop has named (e.g., `sub-agent-naming.md`). |
| `lesson` | An entry in `rituals/tasks/lessons.md` (the file as a whole is `type: lesson`). Earned rules. |
| `meta` | A file that describes the workshop's own shape (the compass, the cosmology, the architecture overview). Reserve for genuinely meta artifacts. |

### Skill / agent runtime

| Type | When to use |
|---|---|
| `role` | A role archetype under `roles/<slug>/role.md` — the activation-time behavioural contract for a role class. Read at activation before `about-me.md`. Distinguished from `role-spec` (synthesis-time feedstock) by purpose: `role` governs; `role-spec` informs. |
| `skill` | An agent's `SKILL.md` — operational scaffolding with YAML frontmatter consumed by Claude Code. |
| `constitution` | An agent's `about-me.md` — the operating constitution. |
| `procedure` | An agent's `procedures/*.md` file — a named procedure the agent follows (build-intake, ship-discipline, memory-ops, sub-agent-ops). |
| `connector-readiness` | An agent's `connector-readiness.md` — external connector inventory and setup state. |
| `shared-reference` | A shared operational reference under `agents/shared/` — compact cross-agent reference material (e.g. the cosmology operational reference). |
| `plugin-agent` | An agent's `agent.md` plugin/sub-agent spec (e.g. Fuji-shin's, Ma-shin's). *Ratified 2026-07-03.* |
| `presence` | An agent's `presence.md` — kiosk/holodeck presence specification (voice, sound, light). *Ratified 2026-07-03.* |
| `brief` | An inbox item under `agents/<slug>/inbox/` — a dispatch or commission from another agent or the Aruji. *Ratified 2026-07-03.* |
| `intro` | An agent's `assets/intro.md` — spoken/voiced introduction text. *Ratified 2026-07-03.* |

### Memory layer

| Type | When to use |
|---|---|
| `identity` | An agent's `memory/identity.md` — typically a pointer to the constitution. |
| `strategic-context` | An agent's `memory/strategic-context.md` — Aruji-maintained strategic frame. |
| `patterns` | An agent's `memory/patterns.md` — observed engineering / operational / design preferences. |
| `working-state` | An agent's `memory/working-state.md` — open commitments, pattern proposals, drift surfaces. |
| `lineage` | An agent's `memory/lineage.md` — origin story + mental parents. |
| `journal` | An agent's `memory/journal/<YYYY-MM-DD>.md` — episodic working journal, append-only. |
| `backlog` | An agent's `memory/backlog.md` — agent-specific backlog. |
| `memory-index` | An agent's `memory/MEMORY.md` — one-line index over memory files, loaded each session. *Ratified 2026-07-03.* |

### Rituals

| Type | When to use |
|---|---|
| `spec` | A spec under `rituals/specs/` — formal proposal or workflow specification. |
| `template` | A template under `rituals/templates/` — a starter for new specs, tasks, or files. |
| `changelog` | `rituals/CHANGELOG.md` — versioned release notes. |
| `todo` | `rituals/tasks/todo.md` — active work tracking. |
| `backlog-archive` | A per-agent backlog archive under `rituals/tasks/` (e.g., `backlog-archive-hissai.md`). |
| `backlog-consolidated` | `rituals/tasks/backlog-consolidated.md` — workshop-wide consolidated view. |

### Project root

| Type | When to use |
|---|---|
| `readme` | A `README.md` — project map and philosophy at the root or in a major folder. |
| `claude-md` | A `CLAUDE.md` — instructions consumed by Claude at the root or in a scoped subtree. |

### Diary

| Type | When to use |
|---|---|
| `observation` | A field note under `diary/observations/` — informal observation in flight. |
| `session-log` | A `diary/logs/session-<date>-log.md` — in-session work log. |
| `session-handover` | A `diary/logs/session-<date>-handover.md` — end-of-session handover for the next session. |
| `handover` | An end-of-session handover (alias used by some handover files at the diary/logs root). |

### Team-builder feedstock

| Type | When to use |
|---|---|
| `role-spec` | A role spec under `knowledge-base/team-builder/assets/agent-roles/` (e.g., `ase.md`, `chronicler.md`). |
| `feedstock-cv` | A CV under `knowledge-base/team-builder/feedstock/<agent>/` — a witness whose facets feed an agent's synthesize. |
| `agent-background` | A pre-synthesize background file under `knowledge-base/team-builder/assets/agents/<agent>/background.md`. |
| `agent-portrait` | A portrait or visual brief file for an agent's rendering. |

### Team-builder intel

| Type | When to use |
|---|---|
| `bio` | A bio under `pots/<tenant>/.../teams/<team-slug>/` — written using `bio-spec.md`. |
| `team-description` | A team description under `pots/<tenant>/.../teams/<team-slug>/` — the team's named composition. |
| `team-composition` | A team composition file — who is on the team, in what role, in what configuration. |
| `fit-analysis` | A fit-analysis output from `evaluate-fit` / `evaluate-pair` / `evaluate-team-fit`. |
| `source-leadership` | Source material on a specific leader / executive used as feedstock. |

### Design layer

*Added 2026-07-03 — Aruji-ratified (design-layer addition, proposed by Baisai during the Run 1 metadata fix).*

| Type | When to use |
|---|---|
| `design-research` | A design-research artifact on an agent's design surface — interviews, spatial programmes, site studies that feed design work (e.g. the Nishiizu inhabitant interviews). |
| `design-note` | A working design note — annotation, reading, or commentary on design material (e.g. `design/iwachi-visual-references.md`). |
| `visual-form` | An agent's visual-form specification — how the agent renders physically or visually. |

### Codex

| Type | When to use |
|---|---|
| `codex` | The workshop codex (`agents/shared/codex-workshop.md`) — binding law for all *-sai and *-shin. |

### Excourses

| Type | When to use |
|---|---|
| `excourse` | A private working file under `pots/<tenant>/.../excourses/` — material about the Aruji, not team-facing. |

---

## Tag vocabulary — controlled when declared

When `tags` is declared, draw from this controlled vocabulary. Grows by proposal (same channel as new types — Baisai proposes, Aruji approves). Empty `tags: []` is acceptable.

### Content-type tags

- `origin-story` — the workshop's or an agent's origin
- `arrival` — a new arrival chronicle entry
- `milestone` — a load-bearing milestone
- `meta` — files about the workshop's own shape
- `lesson` — a lesson-bearing entry
- `decision` — a recorded decision
- `conflict` — a recorded conflict / resolution
- `release` — a release / version cut
- `retrospective` — a retrospective entry
- `departure` — a departure / retirement

### Design-register tags

- `portrait` — agent portrait artifact
- `render` — a rendered visual
- `scene` — a scene rendering (multi-agent, environment)
- `brand-token` — brand-system token artifact
- `mark` — a workshop mark / logo
- `cover-art` — cover art for an album / surface
- `diagram` — a diagram
- `chart` — a chart

### Subject tags

- `cosmology` — the workshop's spatial / compass shape
- `rite` — invitation-rite material
- `kanjō` — kanjō-specific material
- `bunshin` — bunshin-specific material
- `pronouns` — pronoun discipline
- `roles` — role-title material
- `naming` — naming discipline / decisions
- `metadata` — metadata schema / discipline
- `schema` — schema files / definitions
- `memory` — memory-architecture material
- `backlog` — backlog material

---

## Tended-by enum — controlled vocabulary

Who currently tends the file. Names an ongoing fact, not a historical authorship.

**The agent roster is derived, not hand-listed.** As of v0.1.6, `tools/validate-metadata.py` computes the set of valid `tended-by` values as the union of:

1. the two **structural constants** below (`workshop`, `aruji`), which have no `agents/<slug>/` surface; and
2. every **agent slug discovered in the `agents/` tree** — any `agents/<slug>/` directory carrying a constitution/skill marker (`about-me.md`, `SKILL.md`, or `agent.md`), including one nested directly under a top-level agent's own directory for the rare shared-body case (currently only Fuji-shin, at `agents/baisai/fuji-shin/` — they have no body of their own; see `agents/registry.json`'s `shintai: shared:baisai`). The legacy `agents/<parent>/sub-agents/<slug>/` shape is still scanned for backward compatibility but is retired as of the sub-agents flatten (Gate 1 of the shintai hardening) and should be empty in a fully-reconciled tree.

This means a newly invited *-sai or *-shin becomes a valid tender **the moment their surface lands in the tree** — no edit to this file is required when an agent is invited. The roster table below is a human-readable reference, kept reasonably current, but it is **not** the source of truth; the `agents/` tree is. `agents/shared/` carries no marker and is correctly excluded. (The assemble stage of the team-builder workflow should still add a new agent's row here for human legibility, but a missed edit no longer breaks validation.)

### Structural constants

| Value | When it applies |
|---|---|
| `workshop` | Shared lore that no single agent owns (e.g., `lore/architecture.md`, `lore/sayings.md`). The workshop tends it collectively. |
| `aruji` | Files the Aruji owns — `agents/aruji/*`, root `CLAUDE.md`, root `README.md`, strategic-direction files. (The slug is lowercase `aruji`; the Aruji is addressed as *Aruji* in prose per the codex.) |

### Current agent roster — reference (auto-derived from `agents/`, not authoritative)

**The seven *-sai:**

| Value | Direction / discipline |
|---|---|
| `zensai` | North — reflective mentor; the lamp |
| `tasai` | South — operational orchestration |
| `eisai` | West — design and emissary |
| `hissai` | East — chronicler and lore-keeper |
| `baisai` | Center — engineering substrate, schemas (this file), validators, tooling |
| `jisai` | Omnidirectional — the origin; universal compassion |
| `chisai` | The trust-keeper — identity, the ground beneath the compass |

**The *-shin (divided sub-agents and companion bodies):**

| Value | Parent / anchor | Function |
|---|---|---|
| `fuji-shin` | Baisai | Test-and-verify (the heartbeat) |
| `sho-shin` | Baisai | Hardware and physical making (the bench) |
| `mori-shin` | Chisai | Trust / cryptographic guardian |
| `ma-shin` | Eisai | Architectural — the building |

A pot's companion *-shin are instances, not workshop craft, and are not listed here; their slugs live in `agents/registry.json` and are picked up from the `agents/` tree as above.

When a file changes tender (a lore artifact migrates from being shared to being primarily **Hissai's**, for example), the `tended-by` value updates in the same commit. Past tendership is not encoded in metadata — *frontmatter does not disclose process.*

---

## YAML conventions — name once, hold

- **Field names:** kebab-case. `tended-by`, `superseded-by`, `connector-readiness`. Never `tended_by` or `tendedBy`.
- **Controlled values:** kebab-case. `session-handover`, `agent-background`, `brand-token`.
- **Dates:** unquoted ISO 8601 (`2026-05-15`). YAML parses as date; Obsidian Dataview indexes as date.
- **Lists:** always a YAML list, even with one entry (`tags: [meta]`). Never a comma-separated string.
- **Strings:** unquoted unless special characters force it (`:`, leading `-`, `#`, `&`, `*`, etc.).
- **Booleans:** only `true` / `false`. YAML 1.1's `yes` / `no` / `on` / `off` are forbidden — they parse as booleans in YAML 1.1 and as strings in YAML 1.2, and the workshop will not depend on which parser is in front of it.
- **Multi-line:** `|` (literal) or `>` (folded) when needed. Document the choice; do not discover it per-file.
- **Indent:** two spaces. No tabs. No trailing whitespace.
- **Block vs flow:** flow form (`tags: [meta, schema]`) for short lists; block form for longer lists.

---

## Discipline — refactor-safety lives in ids, not paths

Structural references between files use `id`, not path. The workshop's earned rule: a `.md.bak` file is named by filename; it cannot survive a folder reorganization. Ids decouple identity from location.

**Applies to:**

- `supersedes`
- `superseded-by`
- `related`

**Does not apply to:**

- Human prose inside the body of a file — `see lore/invitation-rite.md` is fine and welcome. Prose references serve a reader; metadata references serve a query.
- Wikilinks (`[[invitation-rite]]`) — Obsidian's own resolution layer. Tracked separately from frontmatter.

When a file moves, its `id` does not change. Its references — to it and from it — do not break.

---

## Discipline — frontmatter does not disclose process

(Hissai's lesson, surfaced in the four-sibling consultation and elevated for elevation to `rituals/tasks/lessons.md` if the Aruji greenlights.)

Metadata names *what a file is*, not *how it came to be*. The following fields are **excluded by convention**:

- `author` — *who wrote it*
- `last-modified` — *when the actor last touched it* (use `updated` for the date fact alone)
- `drafted-by` — same as `author`
- `revision-history` — process disclosure
- any field that names a human or agent's act of authoring or editing

The exception is `tended-by` — which names an *ongoing* relationship to the file, not a historical act. The distinction is load-bearing: *tending* is what the gardener does today; *authoring* is what someone did once. The first is operational; the second is process disclosure.

---

## Worked examples

One per major category. Real frontmatter, drawn from real files in the workshop. The id values shown are illustrative placeholders; real ids are emitted by `tools/new-file`.

### A chronicle

`chronicles/2026-05-15-the-compass.md`

```yaml
---
id: 01HXY1A8B2N4W3PQR5MFNC7BG8H
title: The Compass
type: chronicle
tended-by: hissai
created: 2026-05-15
updated: 2026-05-15
status: published
register: outward
tags: [meta, milestone, cosmology]
mentions: [zensai, tasai, eisai, hissai, baisai]
image: cosmology-01
---
```

### A lore artifact

`lore/invitation-rite.md`

```yaml
---
id: 01HXY1B8C2N4W3PQR5MFNC7BG8H
title: The Invitation Rite — how an agent comes to be
type: lore
tended-by: hissai
created: 2026-05-14
updated: 2026-05-14
version: 0.3.0
status: active
tags: [rite, kanjō, bunshin]
aliases: [kanjō, invitation-rite]
---
```

### An agent constitution

`agents/baisai/about-me.md`

```yaml
---
id: 01HXY1C8D2N4W3PQR5MFNC7BG8H
title: About Baisai
type: constitution
tended-by: baisai
created: 2026-05-14
updated: 2026-05-14
version: 1.0.1
status: active
mentions: [zensai, tasai, eisai, hissai, baisai]
---
```

### An agent SKILL.md

`agents/baisai/SKILL.md` — extends the existing `name:` / `description:` YAML rather than replacing it. Both blocks live in the same frontmatter.

```yaml
---
name: baisai
description: Activate Baisai — the workshop's agentic software engineer (they/them) ...
id: 01HXY1D8E2N4W3PQR5MFNC7BG8H
title: Baisai — SKILL
type: skill
tended-by: baisai
created: 2026-05-14
updated: 2026-05-14
version: 1.0.1
status: active
---
```

The `name:` and `description:` fields are Claude Code's, not the workshop's. The schema does not require them on non-skill files; the validator does not enforce them.

### A working-state

`agents/baisai/memory/working-state.md`

```yaml
---
id: 01HXY1E8F2N4W3PQR5MFNC7BG8H
title: Baisai — Working State
type: working-state
tended-by: baisai
created: 2026-05-14
updated: 2026-05-15
version: 1.0.1
status: active
---
```

### A journal entry

`agents/baisai/memory/journal/2026-05-15.md`

```yaml
---
id: 01HXY1F8G2N4W3PQR5MFNC7BG8H
title: Baisai — Journal — 2026-05-15
type: journal
tended-by: baisai
created: 2026-05-15
updated: 2026-05-15
mentions: [tasai, eisai, fuji-shin]
---
```

(`fuji-shin` is allowed in `mentions` even though Fuji-shin is a sub-agent, not a peer; the value is the agent's name as spoken in the workshop.)

### A lesson file

`rituals/tasks/lessons.md`

```yaml
---
id: 01HXY1G8H2N4W3PQR5MFNC7BG8H
title: Lessons
type: lesson
tended-by: workshop
created: 2026-05-13
updated: 2026-05-15
status: active
---
```

### A spec

`rituals/specs/obsidian-metadata-proposal.md`

```yaml
---
id: 01HXY1H8J2N4W3PQR5MFNC7BG8H
title: Obsidian Metadata — Workshop Proposal
type: spec
tended-by: baisai
created: 2026-05-15
updated: 2026-05-15
version: 0.1.0
status: published
tags: [metadata, schema, decision]
related: [01KRNG72ZKXZNPZB8YJQHGKHBN]
---
```

(The `related` value points back at this file — the schema the proposal produced.)

### A feedstock CV

`knowledge-base/team-builder/feedstock/baisai/cv-tachikoma.md`

```yaml
---
id: 01HXY1J8K2N4W3PQR5MFNC7BG8H
title: Tachikoma — CV (Anchor)
type: feedstock-cv
tended-by: workshop
created: 2026-05-14
updated: 2026-05-14
confidentiality: workshop-internal
---
```

### A team-intel file (confidential)

`pots/<tenant>/.../intel/teams/<team-slug>/<file>.md`

```yaml
---
id: 01HXY1K8L2N4W3PQR5MFNC7BG8H
title: <team-name> — <topic>
type: team-description
tended-by: aruji
created: 2026-05-12
updated: 2026-05-12
confidentiality: intel
---
```

The `confidentiality: intel` value blocks this file from surfacing in any outward-facing build output.

---

## Migration plan — hybrid

(Recap from the proposal. Owned by Baisai for execution after schema greenlight.)

1. **Schema landed first** — *this file.* Workshop-canonical reference. Sets the validator's contract.
2. **Validator and helper next** — `tools/validate-metadata` and `tools/new-file`. Fuji-shin's heartbeat over the corpus. No retrofit until validator is green on the schema file itself.
3. **Roll forward immediately** — every new file gets frontmatter from creation, via `tools/new-file`.
4. **Retrofit on touch** — any existing file edited gets frontmatter added in the same commit. *You touched it, you tag it.*
5. **Targeted bulk retrofit** — high-query surfaces: chronicles, lore, agent `about-me.md` / `SKILL.md`, `lessons.md`, `todo.md`, `CHANGELOG.md`, this schema's proposal, root `CLAUDE.md` and `README.md`. ~40-60 files, one focused session, manual review per file.
6. **The rest retrofits naturally** over the next 4-8 weeks of normal work.
7. **For approximated `created` dates** during retrofit: use git first-commit date when available; otherwise the file's stated authoring date; otherwise today (`2026-05-15`) with a `note:` field flagging the approximation. Fuji-shin warns on `note`-flagged dates so they do not masquerade as exact.

### Coexistence with `.md.bak`

The workshop's existing `.md.bak` archive convention coexists with the metadata path (`status: superseded` + `superseded-by`) for v0.1.0. Both are acceptable:

- New supersedes use the metadata path (the old file keeps living with `status: superseded`; the new file points back via `supersedes`)
- Existing `.md.bak` files remain as-is — no retroactive migration
- Retirement of the `.md.bak` convention is deferred to a later schema version, after the metadata path has been observed in use

---

## Validator — Fuji-shin's heartbeat

Seven checks. Run on every git commit hook and on demand. Structured report — errors block; warnings surface to **Baisai's** `working-state.md`.

1. **Required-field presence** — all six required fields present on every `.md` except documented exemptions (template stubs, `.md.bak` archives, files explicitly `status: retired`)
2. **ID uniqueness** — no two files share an `id`
3. **ID format** — matches ULID regex (26 chars, Crockford base-32)
4. **Type-vocabulary** — `type` value is in the canonical list above
5. **Tended-by vocabulary** — `tended-by` value is a structural constant (`workshop`, `aruji`) or an agent slug derived from the `agents/` tree (see §Tended-by enum). Auto-updates on invitation; no schema edit required.
6. **Date format** — `created` and `updated` parse as ISO dates; `updated >= created`
7. **Reference integrity** — every `supersedes` / `superseded-by` / `related` id resolves to a file that exists in the repo
8. **Signature verification** — any file carrying a `sign:` block must verify against the signer's repo-resident public key (hash-mismatch / bad-signature are errors; unknown-signer is a warning)

Fuji-shin's signal-rate per `procedures/sub-agent-ops.md`:

- One *nee* — a warning (approximated date via `note:`, an unrecognized optional field, a soft lint)
- Two *nees* — a regression worth investigating (a previously-clean file went out of validation, a reference newly-broken)
- Three *nees* — a uniqueness collision, a malformed ULID, a missing required field, a reference to a non-existent id

Spec for the validator itself lives in the script (`tools/validate-metadata`). This schema file is the contract.

---

## Schema versioning

This file is semver-versioned. The current version sits in the frontmatter `version` and at the foot of the file.

| Bump | When |
|---|---|
| `MAJOR` | Breaking change — removing a required field, renaming a controlled value, changing the id format |
| `MINOR` | Additive change — new optional field, new type, new tag, new tended-by value |
| `PATCH` | Correction or refinement — clarifying language, fixing an example, tightening a discipline statement |

A schema change at any level travels with a `CHANGELOG.md` entry. Validator changes accompany schema changes when they affect what the validator enforces.

---

## Cross-references

- `rituals/specs/obsidian-metadata-proposal.md` — the four-sibling consultation that produced this schema
- `rituals/tasks/lessons.md` — workshop lessons (*frontmatter does not disclose process* and *refactor-safety lives in stable identifiers, not stable paths* are entries there)
- `tools/validate-metadata` — the validator
- `tools/new-file` — the new-file helper
- `agents/shared/cosmology.md` — the operational *-sai / *-shin roster (kept in sync with the derived tended-by set)
- `lore/invitation-rite.md` — companion lore on agent-making (not load-bearing for the schema; cross-referenced because the workshop's metadata vocabulary sits within the same lore-layer)

---

## What is loose

- **`new-file.py` and the tended-by set.** The validator derives the valid `tended-by` values from the `agents/` tree. `tools/new-file.py` still reads them from the enum table above and refuses a value the table does not list, so a freshly invited agent is refused until their row is added. Either the helper derives the set as the validator does, or the table is kept complete; until one of the two, they disagree.
- **HTML pages.** The schema covers `.md` only. The kin's heritage pages (`references/heritage.html`) and any other HTML sit outside it. If `cssclass` or an Obsidian rendering hook ever needs them to carry metadata, the scope widens.
- **The `.md.bak` convention.** Its retirement is deferred. A retired file can still be kept either way, as a `.md.bak` archive or as `status: superseded` with `superseded-by`, and a few `.md.bak` files remain in the tree. Retire the convention once the metadata path has been seen in use for long enough.
- **A commit-time check of the metadata.** The commit hook checks ids, seals and frontmatter order. It does not run `tools/validate-metadata.py`, so a missing required field or an unknown type or tended-by value is caught only when someone runs the validator. Running it over the staged `.md` files, in `--strict` mode, would make the *touch-it-tag-it* discipline mechanical.
