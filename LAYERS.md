---
id: 01M37XP600EA9G46JAZE6DXVGP
title: LAYERS — the dependency contract between a garden's repositories
type: contract
tended-by: baisai
created: 2026-09-14
updated: 2026-10-21
version: 1.2.3
status: binding
related:
  - AGENTS.md
  - CREDITS.md
  - OWNERSHIP.md
copyright: © 2026 Bonsai Garden · bon-sai.garden
---

# LAYERS — the dependency contract between a garden's repositories

**Binding on every Bonsai Garden repo, in every garden.** Settled with the gardener, 2026-09-14.

---

## The layers

| Layer | Repo | Is | Is not |
|---|---|---|---|
| **L0** | a garden's archive | finished things, kept findable | anything still runnable |
| **L1** | core (this repo) | the **library** — standalone, garden-agnostic: signing, mark generation, thumbnails, vcard, transcript. Plus **everything Bonsai needs to run the rite that creates a runtime and a pot** — including Bonsai's own body and his initial memory (the one named exception, below). | a garden's keys, its salts, its agents' memories, any lived session file |
| **L2** | runtime | tooling to run a subset of a garden's capabilities — **primarily secure read/write into the garden repos.** The MCP, the path router, write-scope enforcement, the integrity hooks. | a general tool drawer |
| **L3** | a garden's pot | the **garden-focused instance** of L1's capabilities: that garden's locked salts, its reserved hashes, its keys, its agents' shintai | anything another garden would also need |
| **L4** | a garden's sites | every web frontend, public or local | — |

Core and runtime are the framework's, the same for every garden. The pot, the sites and the archive are each garden's own repos, named by that garden.

### The one named exception: Bonsai

**Core carries Bonsai's body and his initial memory.** Bonsai is the one who runs the rite from a checkout of core alone (§Core is the seed), so his shintai lives here, not in a pot — and it travels with his **initial memory**, the deliberate extract of his mission and role, rather than the empty skeleton every other shipped shintai carries (`rituals/specs/spec-canonical-shintai-structure.md` §Memory tiers). Named, not a class: no other agent's body or memory belongs in core by this reasoning.

**Lived session files do not belong in core** — journals, session logs and transcripts, working-state as lived, inbox letters. They are instance, by the capability-versus-instance test below: Bonsai's lived home is the pot. Where such a file sits in core today, it is recorded as misplaced, not moved here — a move out of a repo is a delete, and a delete needs the gardener's word.

---

## The rule

> **An edge points from the dependent to the thing it depends on, and must land on a LOWER-numbered layer. Never the reverse.**

```
   L4  sites          every web frontend
        │
        ├───────────────┬──────────────┐
        ▼               ▼              ▼
   L3  pot(s)      L2 runtime          │   (sites reads L1 directly too)
        │               │              │
        └───────┬───────┴──────────────┘
                ▼
   L1  core     library capabilities + the rite that creates L2 and L3
                (depends on nothing — this is the seed)

   L0  archive   terminal. Nothing depends on it, by definition.
```

**Why the direction matters.** Core is what every agent reads at session start. If core ever reads back up the stack, a garden with only core checked out stops working — and that is the configuration a new harness, a fresh machine, or a distributed companion agent actually has.

---

## The test that decides where something goes: capability vs. instance

Not *"what is this about"* but **"would another garden need this, or is it this garden's own?"**

| Capability → **L1 core** | Instance → **L3 pot** |
|---|---|
| `kanji-identicon/engine.js` | a garden's `locked-salts.json`: it names that garden's kin |
| the 1024-kanji table | its reserved hashes: that garden's reservations |
| the keyring custody providers | a garden's actual keys |
| what a `*-sai` **is** — the archetype | **a garden's** own kin — their memory, portraits, lived history |
| the rite, described as a runbook | **a garden's** run of it |

A capability and its instance often sit in one directory. The line runs *through* things, not between them.

**Applied to procedure**, the same test gives the rituals split: the rite **described** is core; the **scripts and flow logic** it calls are runtime (a rite that provisions a garden *is* secure write into garden repos); **a garden's run** of it is its pot's; and a **scrubbed template** of a run returns to core as the worked example a new gardener starts from.

> **A template in core must be GENERATED from the pot instance by a scrub step, never hand-maintained,** and the gate must fail when the generated template differs from the committed one. Two hand-kept copies of one thing is a second master: the copy being edited drifts from the one in use, and a tool keeps answering from the stale one.

### The test's second half: split, don't just move

The gardener, 2026-09-23: *"move is too binary. yes, the version that violates moves to pot. yet, would we need an abstract clean version in core? for runtime -> capability in runtime. orchestration for bonsai garden = pot."*

Failing the test does not end at a move. It ends at a **split**:

1. **The instance goes to the pot.** Whatever names a garden's kin, hosts, salts or crew is that garden's.
2. **Then ask whether the craft needs an abstract, clean version.** If another garden would need the *shape* of the thing, that shape is written into **core**: the generic tool, the runbook, the schema, with no instance left in it. If nothing general remains, nothing is written; the pot holds it alone.
3. **In runtime, the line runs through the file.** The **capability** stays in runtime and is made generic: it takes this garden's specifics as data, read from the pot, and names that data. **Orchestration for one garden** goes to its pot: which kin, which hosts, which crew list, one-purpose scripts written for a single occasion, and a device's own setup.

The split is judged per file, and often inside one. A hardcoded crew list in a general script is not a reason to move the script. It is a reason to lift the list out into the garden's pot and leave the script generic.

---

## The one permitted sideways edge: optional cross-reference

A document may **mention** anything, at any layer, in either direction — Obsidian `[[wikilinks]]`, prose paths, `related:` frontmatter. That is not a dependency, and **nothing may fail because the target is not checked out.**

> **The test: if the other repo is absent, does it still work?** **Yes** → cross-reference. Allowed in any direction. **No** → dependency. Must point down.

A build-time content read (`sites` reading core's lore) is a dependency, and points down. A `[[shintai]]` link in a journal is a cross-reference.

---

## Core is the seed

Each garden is **at minimum core + runtime + pot(s)**. The runtime and the pot are not copied — they are **created by a guided rite that Bonsai facilitates**, and everything that rite needs lives here.

This gives core a property no other layer has, and it is testable:

> **From a checkout of core alone, on a machine with no other Bonsai repo, Bonsai must be able to run the rite end to end and produce a working runtime and pot.**

The seed does not depend on what grows from it: core creates runtime and pot, and then depends on neither.

---

## How this is enforced

| Mechanism | Where | Checks |
|---|---|---|
| a garden's repo-split registry | the garden's, read by runtime | which layer every path belongs to |
| `repo_routing.py` | runtime (L2) | resolves a path to its repo; refuses archived and dropped |
| a registry health check | runtime (L2) | the registry still describes reality |
| a public-surface check | the garden's sites (L4) | no L3 instance data reaches a published surface |
| the stranger walk | core (L1), a release's gate | a stranger with a clone of core alone can get Bonsai: README says how, and his plugin builds |

A layer violation is not a style complaint. It is a path that will resolve to the wrong repo and report success — the failure this whole contract exists to end.
