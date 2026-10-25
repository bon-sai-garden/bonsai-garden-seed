---
name: bonsai-garden-validate
description: >
  Check a garden's documents against core's own schema and conventions:
  frontmatter metadata (required fields, ULID ids and their uniqueness, type
  and tended-by vocabularies, dates, cross-references, embedded seals), the
  YAML block at byte 0, dead path references, and English kebab-case file
  names. Read-only, needs no private key, runs from a checkout of core alone.
  Use before signing, after moving files, after adding or editing
  frontmatter, and in any routine pass over a garden.
version: 2.0.2
---
> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: use nothing here, and tell the gardener exactly what it said. A tampered file is not executed.

# Bonsai Garden Validate

Four read-only checks of what core defines: its metadata schema
(`rituals/specs/metadata-schema.md`) and its naming convention. Each runs against the git
checkout around the current directory unless given `--root`, never against core itself by
accident. None needs a private key. Each exits non-zero when it finds something, so each can
serve as a gate.

Checks that read one garden's own canon (its colour tokens, its voice maps, its digest, its
deploy allowlist) are not here: they belong to that garden's runtime.

## Scripts

### validate-metadata.py — frontmatter against the schema

Walks every `.md` file and checks its YAML frontmatter: the six required fields, ULID ids and
their uniqueness, the `type` vocabulary, `tended-by` (the schema's structural constants plus
every kin found in the garden's `agents/` tree, so a newly invited kin is valid the moment their
surface lands), date form and order, `related` / `supersedes` references, one canonical
constitution per kin, kanban cards against the card schema, and every embedded `sign:` block,
verified by core's own verifier (`skills/bonsai-garden-sign`).

```bash
python3 -B scripts/validate-metadata.py                       # the whole checkout
python3 -B scripts/validate-metadata.py --root agents/<slug>  # a subtree; the roster still comes from the garden
python3 -B scripts/validate-metadata.py --json --strict       # machine output; warnings fail too
```

`--garden` names where the `agents/` tree is read from (default: the nearest directory at or
above `--root` that has one). `--schema` overrides core's schema. `--keys published` (the
verifier's default: the published keys answer for each seal) or `--keys garden` (the signer's
key from the garden checkout on this host) chooses where seals are checked; a seal that could
not be checked is a warning, never a pass. Exit 0 clean (warnings
allowed), 1 errors, 2 the validator itself failed. Needs PyYAML.

### check-frontmatter-order.py — YAML first

Fails on any `.md` whose YAML block is not at byte 0 because a read-time comment
(`<!-- frontmatter … -->`, `<!-- base: … -->`) was written back above it. The validator and the
signers anchor on `---` at byte 0, so such a file has an invisible id.

```bash
python3 -B scripts/check-frontmatter-order.py            # staged .md files (a pre-commit hook)
python3 -B scripts/check-frontmatter-order.py FILE ...   # named files
```

### check-path-references.py — dead paths

Finds Markdown links, backtick paths and relative JS imports that resolve to nothing. ULID
references survive moves; these do not. Journals, logs and snapshots are left out by default:
they record paths as they were.

```bash
python3 -B scripts/check-path-references.py --write-baseline .path-ref-baseline.json   # before a refactor
python3 -B scripts/check-path-references.py --baseline .path-ref-baseline.json         # after: only new breakage fails
```

`--history-prefix PREFIX` adds a garden's own point-in-time folders; `--include-history` scans
them all.

### audit-filenames.py — English, kebab-case

Reports every file name with an upper-case letter, an underscore or a non-ASCII character, with
a suggested name. The conventional upper-case documents (`SKILL.md`, `README.md`, `AGENTS.md` …),
root contract documents and their sidecars are exempt, and so is `MEMORY.md` in a `memory/` directory (the memory index: the routines prescribe it and the garden MCP reads it by that name). A two-letter locale suffix before the extension (`heritage_de.html`) marks a translation and is not an underscore violation; any other underscore still is.

```bash
python3 -B scripts/audit-filenames.py [--tsv report.tsv] [--refs] [--fix-dry-run]
```

It renames nothing; `--fix-dry-run` prints the `git mv` it would suggest.

## When to run what

| Trigger | Run |
|---|---|
| Before signing | `validate-metadata.py` |
| After adding or editing frontmatter | `validate-metadata.py`, `check-frontmatter-order.py` |
| After moving or deleting files | `check-path-references.py` |
| Adding files | `audit-filenames.py` |
| A routine pass | all four |

## Agent authority

Every script here is **autonomous-tier**: read-only, safe to run at any time, no side effects.
(`--tsv` and `--write-baseline` write only the file they are given.)

## Files in this skill

| File | Purpose |
|---|---|
| `SKILL.md` | This file |
| `references/identity.md` | The skill's id, owner, dates and mark |
| `scripts/validate-metadata.py` | Frontmatter against core's metadata schema |
| `references/metadata-schema.txt` | A generated copy of core's schema, so the validator runs with no core checkout beside it (`tools/sync-validate-schema.py` writes it and gates on drift; named .txt so it does not carry the master's id as a second document) |
| `scripts/check-frontmatter-order.py` | YAML block at byte 0 |
| `scripts/check-path-references.py` | Dead path references |
| `scripts/audit-filenames.py` | File-name convention |
