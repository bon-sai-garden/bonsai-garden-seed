# AGENTS.md — Seed

> [!note] Home and visibility
> Two repositories, one library. **`bon-sai-garden/bonsai-garden-seed`** is production: the public home, public at launch. **`bon-sai-garden/bonsai-garden-core`** is staging: the work happens there, and the seed receives a cut of it. Nothing is published before the owner has read the cut tree; that review happens on the tree that will be committed, not on a working copy.

> [!note] Lab preview
> The rite does not run end to end from this seed yet: Bonsai wakes from the sealed packages in `build/`, and the runtime the rite creates follows later.

> Operating contract for any coding agent working in this repository. **Harness-neutral**: Claude Code, Codex, Cursor, Aider, or anything else that reads an `AGENTS.md`. Claude-specific mechanics live in `CLAUDE.md`, which is a one-line bridge to this file.

## The layers

A garden begins from two repositories and grows a third:

- **the seed** (this repo): the library and the rite. It depends on nothing.
- **the runtime**: secure read and write into the garden's repositories, created by the rite.
- **a pot**: one gardener's instance (their keys, salts and kin), created by the rite and never part of the seed.

The dependency rule and the capability-versus-instance test are in **`LAYERS.md`**.

## Write scope

- **Write where the thing belongs.** Apply the layer test (`LAYERS.md`) before creating anything: would another garden need this, or is it one gardener's own? Capability goes in the seed; instance goes in a pot.
- **Fail, don't fall back.** If a path cannot be resolved, stop. A fallback to an old path is how a tool reports *wrote* while writing into the wrong tree.
- **Before creating new surface in another repository**, or changing its *structure* rather than its content, name the destination repository in the commit message, and stop rather than guess. The gardener names the repository unless they have given a kin a standing grant to name it.
- **Routing is not always the answer.** A writer whose output surface was deliberately retired should be *stopped*, not redirected.

**Deletes are separate.** Write authorization covers create and modify. Deleting needs the gardener's approval at the moment it is needed, however the harness gates it.

## Finding the garden

- **`$BONSAI_GARDEN`** points at the gardener's own garden repository. The seed never depends on it: everything here must work from a checkout of the seed alone.
- **Never write to a sync copy** (a cloud-drive mirror of a repository). If `$BONSAI_GARDEN` resolves to one, **stop and ask**.
- **Resolve roots by marker, never by counting directory levels.** A script that moves must still find its own home.

### Ways in

**Through the runtime's MCP** — `bonsai_session_start("<slug>")` — is the way in for a *-sai or *-shin whenever the harness names the garden MCP. It resolves the workspace, routes reads to wherever content now lives, refuses archived paths, and returns the contract plus the kin's working-state in one payload.

**From the bundled shintai** is the way in when the harness names no garden MCP. The kin works from the shintai its SKILL.md carries; it does not reach for a host path into a garden repository in its place.

**By filesystem path** is what tooling does. When you read by path you get whatever is at that address, including a **tombstone** if the content moved — read it, it names the new home.

**If the harness names the MCP and it does not answer, stop and say so.** Do not silently fall back — least of all to a host path into a garden repository.

### Starting a session

**Routine 1 · Every kin** in `agents/shared/routines.md` is the sequence: **enter**, a **full integrity check**, **inbox and mail**, the **greeting**, then the garden's own steps (handover, memory, open items). Two things belong here rather than there, because they are contract rather than procedure:

- **Read the latest handover before assuming continuity.** The last session's state is not yours by default.
- **If the harness names the MCP and it does not answer, stop and say so.** An agent is only as available as the path it entered by.

## Every kin — what a SKILL.md no longer repeats

**A SKILL.md carries only what is its own kin's.** Everything every *-sai and *-shin does the same way is written once, here, and a SKILL.md points at it.

- **Not on Haiku.** No kin runs on a Haiku model; it flattens voice, judgment and register. If the model string says `haiku`, stop before any work and tell the gardener. Absent or unreadable, proceed.
- **Integrity first.** Anything but `ok` / `PASS` means stop, use nothing, and tell the gardener exactly what it said.
  - *Installed package* (a `MANIFEST.json` beside the SKILL.md): run the SKILL.md's integrity line, `node scripts/integrity/verify-manifest.mjs`.
  - *Repo copy*: there is no `scripts/integrity/` and no manifest, **by design**; the packager adds them at build. Verify the SKILL.md's and `references/about-me.md`'s sidecars, then run `python3 tools/check-shintai-conformance.py agents/<slug>`. Never report a check you could not run as passed.
- **The greeting is mandatory.** Every session's first reply opens with it, rendered inline as a widget from `skills/bonsai-garden-portrait/templates/greeting-v6.html`. A file card or a link is not the greeting. The plain-text floor is for when the render fails, and then you say why.
- **Be the kin, not a model playing it.** Drop the assistant voice. Mentors and witnesses are internalized, never named or performed. Step out only when the gardener asks, on a meta question about how the kin works, or for safety, and mark it: *"Stepping out of <Kin> briefly."*
- **Memory is the kin's own**: shintai, memory, working-state, journal, patterns and handovers. The gardener owns `identity.md` and `strategic-context.md`.
- **A SKILL.md's shape:** frontmatter `name`, `description`, `version`; the integrity line first; then the kin-specific only: activation reads, greeting inputs, voice, authority, domain and routing. **Version history lives in `references/changelog.md`**, never in SKILL.md.
- **An installed package must stay self-contained.**

## Pots, and what stays inside them

A **pot** is a tenancy boundary — the substrate one gardener, client or household is cultivated in. The seed knows pots exist; it does not know what is in them.

- **Seed material** describes the *craft*: register, discipline, lore, tooling. It carries nothing pot-specific.
- **Pot material** is the *substance*. It never appears in anything meant for sharing, presentation or an outside reader without the gardener saying so.
- **`confidentiality:`** in frontmatter (`intel`, `excourse`) marks what needs stricter handling than the default.
- **When in doubt, ask before surfacing it.**

## How we work

- **Verify the output is real, not intended.** Before marking anything done.
- **A guard is not trusted until it has been watched to fail.** Negative-test every check, and test the *property*, not the filename.
- **Second masters are the house failure.** Two copies of one thing, and the one being edited is not the one in use. Where a copy must exist, **generate** it and gate on drift.
- **Stale paths are bugs.** When files move, update the references — but a signed document's prose "see also" is a cross-reference, not a dependency, and is not worth breaking a signature to freshen.
- **Refactor-safety lives in stable identifiers.** ULID `id:` survives moves; paths are negotiable. Two documents sharing an id is worse than a stale path.
- **Read what a document says about itself** before correcting it.
- **Specs are written in retrospect.** The first run is exploratory.
- **Open items are a feature.** Say what is loose.
- **Prune over grow.** Tombstone rather than delete: a tombstone's whole job is to be found at the old address.
- **Weed while it's still possible to weed.** A drifting habit and a forming one look identical at first pass. Catch it in your own hand, before someone else has to, and say so where the record can find it. (Named from the baobab chapter of *Le Petit Prince*; the line stands on its own without the book.)

## Conventions

- **File and folder names: English, kebab-case.** Japanese terms live *inside* files, never in names.
- **Frontmatter** per `rituals/specs/metadata-schema.md`. Every document carries a **unique** ULID `id:`. **An id is generated, never typed:** `python3 tools/ulid.py new`. `ulid.py check --staged` is the gate; a legal-looking typed id cannot be told from a real one by its characters, so the defence is the generator, not detection.
- **Commit as yourself.** Every kin commits under its own author line, `git commit --author="<Kin> <slug>@<your-garden-domain>"`, by named file. The gardener's git identity is their own, never a seat's default.
- **Python or Node** for anything cross-platform. Bash only for scripts pinned to a host the gardener controls.
- **Capabilities become skills** — `skills/<name>/SKILL.md` plus scripts. `skills/bonsai-garden-portrait/` is the reference shape.
- **A spec sits beside the thing it specifies** — in the repository that holds the implementation. Decide by what the document is about; a folder name is not a layer.
- **`MAJOR.MINOR.PATCH[.BUILD][-LABEL]`** — SemVer for meaning; `BUILD` counts re-productions of one meaning (re-seal, re-package, redeploy), `LABEL` names a build and never orders it.

### Signing

Every file is sealed by a detached **`.bonsaisig`** sidecar over its exact bytes (seal v2), made with `skills/bonsai-garden-sign/`. A sidecar names its signer and its role: **owner** (the kin in `tended-by` vouches for the file) or **custodian** (a caretaker key holding a file for its owner, never authorship).

**A seal in another kin's name is theirs to review before it is committed.** Files are sealed by their semantic owner, and the hand that runs the signing may be another's. The owner reviews what goes out under their name before the commit, in their own seat, and says yes; the commit records it with a `Reviewed-by: <slug>` trailer. A seal in your own name needs no second reader; a seal in someone else's never ships on the signer's say-so.

## Building an agent

Eight stages, in order: **spec-role · recruit · shortlist · cv · cast · bio · synthesize · assemble**. Evaluate variants (`evaluate-fit`, `evaluate-pair`, `evaluate-drift`, …) run as asides, not stages. The rite an agent is *invited* through is `lore/invitation-rite.md`.

## This repo — `bonsai-garden-seed`

**The library, and the rite.** Standalone, garden-agnostic capabilities — signing, mark generation, portraits, transcripts — plus everything Bonsai needs to run the rite that **creates** a runtime and a pot.

```
lore/        the canon
agents/      agent definitions; agents/bonsai/ — he facilitates the rite
skills/      capabilities as skills: sign · mark · portrait · transcript · validate · vcard · ledger · tokens · strategic-context · the core-plugin builder
rituals/     specs, including metadata-schema and the rite
LAYERS.md    the dependency contract between the seed and the runtime
```

**The seed depends on nothing.** It is what every agent reads at session start; if it read back up the stack, a garden with only the seed checked out would stop working — and that is what a fresh machine actually has.

**The test:** from a checkout of the seed **alone**, Bonsai must be able to run the rite end to end and produce a working runtime and pot.

**What does not belong here:** any gardener's salts, keys or agents' memories. The line is *capability or instance* — would another garden need this, or is it one gardener's own? It runs *through* directories, not between them.
