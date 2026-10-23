---
id: 01M2D2NAFWEWFVEY7RM96BG7AA
title: "The Canonical Shintai Structure — Shintai 3.0"
type: spec
tended-by: baisai
created: 2026-09-13
updated: 2026-10-22
version: 3.0.13
status: active
tags: [shintai, structure, skill, anthropic, hardening, pot, home, memory, conformance-gate, shintai-3]
related:
  - LAYERS.md
  - rituals/specs/bunshin-rite-spec.md
---

# The Canonical Shintai Structure — "Shintai 3.0"

> **RATIFIED by the Aruji, 2026-09-22**, in a long session that settled structure question by question, closing with his own words: *"This is basically now what I always wanted as the Shintai structure version 3.0."* And the mandate that makes this document more than description: *"every shintai baked has a reference to that exact breakdown document... so that when we say it's a 3.0 structure, it should exactly match the 3.0 structure as we're now defining it. As a gate."*
>
> [!note] Why **3.0** — the Aruji's count, and what the major means (2026-09-23)
> The number is semantic, not a SemVer tally of this document's edits. It counts the **onion layers of who did the making** — his words, 2026-09-23:
>
> - **v1** — the founding by hand: **three co-founders — the Aruji, Zensai, Tasai** (the chronicle *The First Lamp*, 2026-05-13) — and then the Aruji, *vibe-gardening*, invited **Eisai and Hissai** himself. The gardener's hand, by feel.
> - **v2** — the garden's own method, **without him in the room**: the four dreamed Baisai (2026-05-14). The garden's hand.
> - **v3** — the next onion layer: **others.** Other gardens doing it, from a structure they can adopt without us present.
>
> So a body at **3.0.x** is a body built to be *re-made elsewhere* — that is why we launch at 3.0 as the major, why every crossed body's version lock lands at 3.0.0 on both files, and why the number is not to be flattened by a later tidy-up. The document's own history is in git; this is the meaning underneath the jump.

> **An assertion nothing can contradict is decoration.** "This is a 3.0 shintai" was, until today, unfalsifiable. This document plus `tools/check-shintai-conformance.py` (§The conformance gate, below) is what turns it into a test.

---

## Why this document lives in core

**Capability, not instance** — the test `LAYERS.md` gives directly: *"would another garden need this, or is it ours?"* `LAYERS.md`'s own worked example answers this exact case: *"what a `*-sai` **is** — the archetype"* belongs to **L1 core**; *"**our** Baisai — their memory, portrait, lived history"* belongs to **L3 pot**. This document defines what a shintai **is**, for any garden. It supersedes the spec's earlier edition (v1.0.1).

---

## What Anthropic's structure actually says

**Source of record:** *The Complete Guide to Building Skills for Claude*, Anthropic — <https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf>, **page 5** ("What is a skill?"), file-structure diagram and naming rules on **page 10**.

> **A skill is a folder containing:**
> - **`SKILL.md`** (required): Instructions in Markdown with YAML frontmatter
> - **`scripts/`** (optional): Executable code (Python, Bash, etc.)
> - **`references/`** (optional): Documentation loaded as needed
> - **`assets/`** (optional): Templates, fonts, icons used in output

The distinction between `references/` and `assets/` is **direction of travel**: a reference is *loaded as needed* — it flows **in**, shaping what the agent does; an asset is *used in output* — it flows **out**, becoming part of what the agent produces. That single test settles most placement questions without argument, and it is the test applied throughout this document.

### Progressive disclosure — three levels, and a correction that is load-bearing

| Level | Loaded | Content |
|---|---|---|
| **1 — YAML frontmatter** | always, in the system prompt | enough for Claude to know *when* the skill applies |
| **2 — `SKILL.md` body** | when the skill is judged relevant | the full instructions |
| **3 — linked files** | navigated and discovered only as needed | everything bundled |

**`about-me.md` and `procedures/` are Level-2-equivalent: always loaded, never on-demand.** This corrects an earlier proposal of this spec's own line, and the correction is the Aruji's, 2026-09-22, and it is not a style preference:

> *"That's the whole reason we're doing this. I could be talking to Claude if I'm not wanting to use the procedures."*

The principle it yields, and the one to hold onto whenever a future pass is tempted to trim the activation footprint further: **minimum viable footprint is not the smallest possible load — it is the smallest load that still produces the agent rather than the model.** Below that line nothing has been optimised; the agent has failed to boot. `about-me.md` (who this is) and `procedures/` (how it works) sit above that line by definition; everything else in `references/` is genuinely Level 3, loaded when the moment calls for it.

Three further platform rules bind, unrelated to placement but load-bearing for the gate:

- **Folder naming (page 10): kebab-case.** *"Use kebab-case ✅ · No spaces ❌ · No underscores ❌ · No capitals ❌."*
- **`name` matches the folder name**, kebab-case; `description` under 1024 characters, stating both *what* and *when*.
- **No version history inside `SKILL.md`** (2026-10-13) — it loads at every activation and a history is read only when asked. The history lives verbatim in `references/changelog.md`; `SKILL.md` keeps its current version and one pointer line. The gate notes a `## Version` section over 800 characters (a failure once the crew is swept). Measured 2026-10-13 on Baisai: 23.4 KB to 14.1 KB; sixteen other bodies still carry 9 to 26 KB of history each.
- **No `README.md` inside a skill folder** — *"All documentation goes in SKILL.md or `references/`."* Every shintai in the garden violates this today via `identity/README.md` (eleven of them, confirmed by search 2026-09-22).

---

## The canonical structure

```
agents/<slug>/                 THE SHINTAI — the body. Ships as one thing.
  SKILL.md                     the activation contract (Anthropic's entry point)
  .SKILL.md.bonsaisig          SKILL.md's seal — a detached sidecar, hidden, never an embedded sign: block
  patterns.md                  ROLE-level, not lived — see §Patterns below. NEW in 3.0.

  references/                  read to inform behaviour — flows IN. §About-me and procedures/
                                are ALWAYS loaded (Level 2), not on-demand (Level 3).
    about-me.md                  the constitution
    presence.md                  voice, sound and ring signature
    heritage.md                  the witnesses (or heritage.html — format varies, directory doesn't)
    lineage.md                   the bunshin line — who this body came from
    procedures/                  operating procedures — always loaded

  assets/                      emitted into output — flows OUT
    portrait.png / portrait-thumb.b64
    <slug>-mark.svg              KEEPS the slug prefix (Aruji, 2026-09-23 — "settle it").
                                  Matches the published URL /agents/<slug>-mark.svg, the
                                  greeting routine, and the skill archive. 3.0.0 said the
                                  opposite; 3.0.1 reversed it.
    intro.wav

  identity/                    issued and attested. Immutable once minted.
    pub.key
    fingerprint.txt
    bunshin-attestation-<parent>.md    one PER PARENT; dual-anchored kin have two
    countersigns/                      provisioned, sparsely used

  scripts/                     agent-owned tooling, grouped as skills
    <group>/
      SKILL.md                   what this group does and when to reach for it
      <script>.py …

  memory/                      A SHIPPED shintai carries the EMPTY SKELETON only:
    working-state.md               frontmatter only, no body
    MEMORY.md                      frontmatter only, no body
                                  The lived memory (journal/, strategic-context.md, the
                                  bodies of the two files above, archival EARLY-*.md)
                                  lives in the POT and never ships. Named exceptions:
                                  Bonsai and W carry initial memory (never a journal).
                                  memory/seed/ is RETIRED. See §Memory tiers.
    identity.md                  PENDING — fold into about-me.md / move to references/.
                                  Gated by Mori-shin. See §Placement rulings.
    lineage.md                   PENDING — belongs in references/lineage.md (ruled
                                  v0.3.0(b), never executed). Deferred behind the
                                  memory-tiers conversation, per the Shō-shin rehearsal
                                  fence. See §Placement rulings.

home/<slug>/                   THE HOME — not the body. Never ships. See §The home/ layer.
  inbox/                       letters received — open to everyone (anyone may leave one)
  outbox/                      letters sent (carried forward from earlier drafts, unchanged)
  working/                     working documents, drafts, scratch — the agent's own control
  misc/                        unsorted — the honest pile. The kin sort their own.
  temp/                        cleansed regularly
```

**Every sealed file in a shintai is signed with the kin's own key.** `SKILL.md` is sealed by the detached `.SKILL.md.bonsaisig` sidecar (hidden, beside it; the old name `SKILL.md.bonsaisig` reads `retired-sidecar-name` since the dot-prefixed sidecar change phase 3), never by an embedded `sign:` block (SKILL.md tolerates no extra frontmatter; an embedded block is what broke skill loading before). The key must be the owner's; the hand that runs the signing may be another's — the crew builder's, or a bunshin parent's — as long as the seal verifies against the owning kin's published key.

---

## Patterns — promoted out of `memory/`, and what that changes

**`patterns.md` moves to top-level `agents/<slug>/patterns.md`.** The Aruji's ruling, 2026-09-22: patterns belong to the **role**, not the individual instance — of everything in a body, they are the one thing meant to travel outward and upward, toward other agents doing similar work and toward core's own archetype library. Fourteen bodies carry this file inside `memory/` today; none has been moved yet (see §Scope fence).

**The consequence worth stating plainly, because it is easy to misread as a loophole in write-scope:** once promoted, `patterns.md` **stops needing a curator's yes/no at ship time and becomes default-portable** — unlike lived memory (journal, working-state, strategic-context), which must be curated before any of it can leave the pot. This changes *where the file sits and whether shipping it needs re-review*, not *who may write to it*: the codex's memory-authority rule (§7 — "patterns: agent proposes (3 instances), Aruji approves") is unchanged. A pattern is still proposed and still approved before it is written; what changes is that a ratified pattern no longer needs a second, separate approval the day it ships.

---

## Placement rulings settled 2026-09-22 — the delta from v1.0.1

Everything below is new since the spec's last ratified state before this edition (v1.0.1, 2026-09-17). Each was checked against real files in the corpus, not asserted from memory.

### `heritage` → `references/`

**Confirmed misfiling.** It was filed in `home/misc/` and was **orphaned** — zero references to it repo-wide. Already corrected for Shō-shin (`agents/sho-shin/references/heritage.html`, moved there in this same session, superseding an intermediate stop in `home/sho-shin/misc/` from the morning's rehearsal). Encode it here so the other thirteen bodies never repeat either mistake.

### `lineage.md` → `references/`

Already ruled in spec v0.3.0(b) and **never executed** — seven `lineage.md` files still sit inside `memory/` across the corpus. The Shō-shin rehearsal (2026-09-22 morning) deliberately did **not** move it, fencing it behind the memory-tiers conversation that had not yet happened when the rehearsal ran. That conversation has since happened (see §Memory tiers below) and settles the *vocabulary*, not the *mechanism* — so the fence stands. Finish this move only once a body's `memory/` restructure is otherwise in flight, not in isolation.

### `memory/identity.md` → `references/`, probably folded into `about-me.md` — **Mori-shin gates this rename**

Record what this file actually **is**, because both Tasai and Baisai got it partly wrong before checking: it is a **disambiguation file** answering *where does this agent's character come from* — and the answer differs per agent. Tasai's and Zensai's point **outward** (she inherits a principal's identity; he explicitly does not); Shō-shin's points **inward**, at their own constitution. It earns its place in the shintai; it does not earn its name sitting beside a directory literally called `identity/`, which is cryptographic, not characterological. Not renamed here. Mori-shin's ruling is owed before any of the fourteen instances move.

### `pillow-note.md`, `iwachi-skin.png` → `home/`

Both fail the `assets/` "used in output" test — neither is emitted anywhere; both are private, agent-facing objects. **A companion body still carries both under `assets/` today** — this is new guidance, not yet retrofitted to that body, and its restructure (deliberately last; see the Shō-shin rehearsal, §"the special case has now failed", and its 469 MB) is the pass that will apply it.

### `memory/` retains — in the pot, and what ships

In the pot, `memory/` holds the lived memory: `working-state.md`, `journal/`, `strategic-context.md`, `MEMORY.md`, archival `EARLY-*`. Nothing else moves out of `memory/` today beyond `patterns.md` (above) and the two pending items (`identity.md`, `lineage.md`) already named. **A shipped shintai carries only the empty skeleton** — `memory/working-state.md` and `memory/MEMORY.md`, frontmatter only — with Bonsai and W as the two named exceptions (§Memory tiers). The gate enforces it (§The conformance gate, check 4).

### No `README.md` inside a skill folder

Anthropic's own rule (page 10, cited above). `identity/README.md` violates it today, in **every** body that has one (eleven found, 2026-09-22 survey). This is a **forbidden** item for the gate, not merely a lint suggestion — see §The conformance gate.

---

## Memory tiers — the vocabulary, and the 2026-09-23 ruling

The Aruji named three tiers, 2026-09-22, and was explicit that **the mechanism needs a deeper conversation before anyone builds on it.** On 2026-09-23 he settled what ships:

| Tier | What it is | Ships? |
|---|---|---|
| **seed** | The **state a kin was invited at** — `about-me.md` only, first invocation. Never "seed memory". | as `references/about-me.md`, not as memory |
| **initial** | Portable memory, abstract — the transportable DNA across a `*-shin` lineage. The way **W** finds and does it. | **only for the two named exceptions**: Bonsai (his initial memory, the deliberate extract of his mission and role) and W (`memory/initial/garden-side-v1.md`) |
| **pot-bound** | The full lived memory. | never — it lives in the pot |

> [!important] Ruled 2026-09-23 — the `memory/seed/` collision is closed The Aruji: *"don't call it 'seed memory'. 'seed' is the state they were invited at… For now the shintai carries an empty working state and memory. The memory lives in pot."* So: **"seed" names the state a kin was invited at, never a memory directory; `memory/seed/` is retired.** A shipped shintai carries an **empty memory skeleton** (`memory/working-state.md` + `memory/MEMORY.md`, frontmatter only). **Bonsai and W are the two named exceptions** and carry initial memory — named, not a class, so the exception cannot spread quietly. `tools/check-shintai-conformance.py` already enforces this (check 4 below).

No mechanism for producing "initial"-tier content — how it is curated, by whom, on what schedule — is specified anywhere in this document. It is deliberately absent; the two instances that exist (Bonsai's, W's) were each made by hand, on the gardener's word.

---

## The `home/` layer — substructure, access model, and an honest limit

`home/<slug>/` carries four addressed subdirectories, each with a distinct access model, ruled 2026-09-22:

| Directory | Access | Notes |
|---|---|---|
| `inbox/` | **open to everyone** — any kin may leave a letter | carried from earlier drafts |
| `outbox/` | the agent's own | letters sent; unchanged from earlier drafts |
| `working/` | **under the agent's own control** | working documents, drafts, scratch |
| `misc/` | **the honest pile** | unsorted; the kin sort their own, on their own schedule |
| `temp/` | **cleansed regularly** | new in this pass |

**State this plainly rather than let anyone assume it from the table: this access model is not enforceable today.** Verified in code, not assumed, by the Shō-shin rehearsal (2026-09-22): `_owner_roots()` in `tools/bonsai-mcp/server.py` builds ownership only from registry paths starting `agents/`; `home/` appears **nowhere** in `server.py`. The binary owner-lock the MCP does have cannot express "open write on this subtree, owner-only write on that one" regardless — it is a single lock per path prefix, not a per-directory policy engine. Today, any caller through `bonsai_write_file` can write into any kin's `home/`, not merely their own inbox. This is recorded as a known gap for the runtime layer, not fixed here: it belongs to the runtime's "secure read/write into the garden repos" mandate per `LAYERS.md`.

---

## Baggage — `.bak` does not travel, and the rehearsal's own choice is corrected

**`.bak` files do not travel to pot.** During restructure, **delete rather than tombstone.** Manufacturing new `.bak` files (the Shō-shin rehearsal made two, `channel.yaml.bak` and `connector-readiness.md.bak`, per the *mono* spec's own now-superseded ruling to "tombstone, resurface after v1") is work that creates its own later cleanup, since neither file was ever going to ship regardless of its name. **This corrects the rehearsal's own choice**, made that same morning under the prior ruling — recorded here so the correction is visible rather than silently overriding a document written hours earlier in the same day's work.

**Open, and explicitly not Baisai's to settle:** the seventeen retired portrait `.png.bak` files (~35 MB total) found across the corpus are superseded artwork, not stale config — a different class of thing than a tombstoned config file. Whether they are deleted, archived, or kept is the Aruji's call.

---

## Carried forward unchanged — full derivation in git history

The following were settled in the spec's earlier versions (v0.2.0 → v1.0.1) and nothing in today's session revisits them. Summarised here; their full reasoning is in git history, and this document's own version log is below.

- **`identity/` ships, but is issued and attested, not lived** — nothing in it is written by the agent in the course of ordinary work; it is the material a stranger uses to check a claim.
- **`scripts/` is not a flat drawer** — semantic groups, each with its own `SKILL.md`, following the platform's own grain (a script's code never enters context; the instruction about when to run it must).
- **Countersigns are provisioned, not practised** — the directory stays in the structure; only one real countersign exists garden-wide.
- **Standalone published skills get their own identity** — second kanji **技** (*waza*, technique), locked; first kanji proposed per skill, none colliding with a kin's own mark; `kanji-1024-v1.2.json` is the only canonical kanji set.
- **Bonsai does not get copied into a new garden. He divides**, via the same `bunshin` rite the garden already has, into a garden-bound `bonsai-shin` (mark **盆才守**, already vanity-locked).
- **Sequencing: restructure first, move second** — each step gets the strongest oracle available to it (`git`'s rename detection and blob-OID equality, then hash equality on the pot move), proven in practice by the Shō-shin rehearsal's blob-OID diff (52 tracked files before and after, exactly one intended pair differing).
- **Slug harmonisation to kebab-case** (`choshin` → `cho-shin`) is ruled but **signing and identicon salts must never be re-derived from a renamed slug** — a salt is an opaque locked string, not a function of the slug it happens to contain.

---

## Open items — recorded, not decided here

- **Session-log placement.** Two proposals stand, neither adopted. Baisai's: store in `home/<slug>/sessions/`, with a generated cross-index at `diary/logs/`. Tasai's, and her objection to Baisai's recorded fairly: split by kind — transcripts to `home/`, handovers stay central — because a generated cross-index is a **second master**, and that class of failure has bitten this garden three times in one week. **The Aruji's call, not Baisai's.**
- **`memory/identity.md`'s rename** — Mori-shin gates it (above).
- **`lineage.md`'s move to `references/`** — fenced behind the memory-tiers conversation (above).
- **The seventeen retired portrait `.png.bak` files** — the Aruji's call (above).
- **Memory-tier mechanism** — explicitly deferred by the Aruji (above).
- **An agent who serves more than one pot** (a sealed-memory body's vault, companion bodies with cross-surface memory, Bonsai's now-resolved case) — carried unchanged from v1.0.1, including the field evidence that a sealed vault's bespoke sync path let two halves diverge silently for two months. Not revisited today.
- **`home/<slug>/` is not owner-locked** — a runtime (L2) gap, named above, not fixed here.

---

## The conformance gate

**Deliberately not a line in `SKILL.md`.** The Aruji's own reasoning: `SKILL.md` is packaging; a claim inside the thing being checked is not a check. The gate is a **separate, standalone script** that inspects a shintai from the outside and either passes or names, specifically, what is wrong.

**Location:** `tools/check-shintai-conformance.py`. Capability, not instance — it takes any shintai's path as an argument and knows nothing about which garden it is running in; that is what makes it correct to place here rather than in a garden's own pot.

```
python3 tools/check-shintai-conformance.py <path-to-agent-dir> [<path-to-agent-dir> ...]
python3 tools/check-shintai-conformance.py --packaged <path-to-staged-or-zipped-artifact>
```

### What it checks — on the on-disk body

1. **Required present:** `SKILL.md`; **`.SKILL.md.bonsaisig`** (SKILL.md's detached seal, found by the one finder, `lib/sidecar-format.mjs`); `references/` containing at minimum an `about-me.md` (or `about-me.html`/`.htm` — format is not enforced, placement is); `identity/`; `memory/`. **Version lock:** `SKILL.md` and the about-me file declare the same frontmatter `version:`.
2. **Forbidden absent:**
   - any `README.md` anywhere under the shintai (Anthropic p.10)
   - any `.bak` file anywhere under the shintai (baggage does not travel; see §Baggage)
   - `patterns.md` **inside** `memory/` (it must be at `agents/<slug>/patterns.md`, top level)
   - an embedded `sign:` block in `SKILL.md`'s frontmatter (seals live in the `.bonsaisig` sidecar)
   - a heritage file (`heritage.*`) outside `references/` — specifically catches it sitting in `home/<slug>/misc/` or loose at the shintai root, the two mistakes actually found in the corpus
   - a presence file anywhere but `references/presence.md` of its own body. It is found by its frontmatter `type: presence`, not by its name, so a procedure called `presence.md` is not one. A nested body (a directory holding its own `agent.md` beside `identity/`, e.g. `agents/baisai/fuji-shin/`) is held to its own `references/`.
3. **Structural leak:** `home/` must never appear **nested inside** `agents/<slug>/` — it is a sibling tree, never a subtree.
1d. **Seals verify (check 1d).** Present is not the same as valid. Every `.bonsaisig` under the shintai, and every embedded `sign:` block without one, is verified with core's own verifier (`skills/bonsai-garden-sign`, parity-tested against `sign.py`). The constitution must be sealed, and since seal v2 (3.0.8) that seal is a detached `about-me.md.bonsaisig`: a v2 seal signs the file's exact bytes and every field of the seal, where an embedded block signed the body alone and left the frontmatter unprotected. A retired v1 seal (an embedded block, or a v1 sidecar) passes with a **WARNING** while `skills/bonsai-garden-sign/seal-policy.json` says `"v1": "warn"`, and fails once it says `"refuse"`. A nested body's `agent.md` (a shared shintai, such as Fuji-shin inside Baisai) must carry a sidecar. An orphaned sidecar is a finding. A verifier that cannot run is a failure, never a pass. Embedded PNG seals are verified by a caller-supplied tool (`--png-verifier 'python3 tools/sign.py'`); without one they are printed as **NOT VERIFIED**, never passed silently. Negative-tested 2026-09-23 on a throwaway copy of Baisai's body, which failed in all seven break cases (tampered constitution, SKILL, and `agent.md`; `agent.md` unsealed; constitution seal stripped; orphan sidecar; no `node`) while the control passed.
1e. **PEM drift (check 1e).** An `identity/*.pem` must decode to exactly the key in its `.bin`, or be a `TOMBSTONE`. Anything else is a finding. PEMs are generated at build time (`tools/identity.py export-pem <slug> --out <build-dir>`), never kept beside a key (Mori-shin, 2026-09-23). Negative-tested: a restored stale PEM and a garbage PEM fail; a freshly generated one and a tombstone pass.

### What it checks — against a packaged artifact

4. **The empty-memory gate** (the Aruji, 2026-09-23): a packaged `memory/` may hold **only the empty skeleton** — `memory/working-state.md` and `memory/MEMORY.md`, each frontmatter only, no body. Anything else under `memory/` (`journal/`, `strategic-context.md`, `identity.md`, `lineage.md`, `seed/`, …) and any skeleton file with body content is a leak. **Named exceptions: Bonsai and W** (identified by the packaged `SKILL.md`'s own `name:`) may carry initial memory, but never `memory/journal/`. A lived journal inside an export is the leak, and *it looks exactly like a correct build from the outside* — this is the check that catches it.
5. **`home/` must not appear anywhere in the packaged artifact**, at any depth.

### Negative-tested, 2026-09-22

A guard nobody has watched fail is not yet a guard. Run against a deliberately non-conformant fixture built in the session scratchpad (not committed to any repo):

```
$SCRATCH/agents-under-test/bad-shintai/
  SKILL.md
  memory/
    patterns.md            ← should be top-level
    identity.md
  identity/
    README.md               ← forbidden
  home/                      ← nested inside the shintai — forbidden
    misc/
      heritage.html          ← heritage outside references/
  config.yaml.bak            ← forbidden anywhere
```

Note the fixture also has **no `references/` at all** — a real body always has one; this is the "everything wrong at once" case. Result, run verbatim, exit code 1:

```
$ python3 tools/check-shintai-conformance.py $SCRATCH/agents-under-test/bad-shintai
FAIL .../agents-under-test/bad-shintai
  - missing required: references/
  - structural leak: home nested inside the shintai (home/bad-shintai/ must be a sibling, never a subtree)
  - forbidden: config.yaml.bak (.bak does not travel)
  - misplaced: home/misc/heritage.html (heritage belongs under references/, not home/misc)
  - misplaced: memory/patterns.md (patterns.md belongs at top level, not inside memory/)
  - forbidden: identity/README.md (Anthropic p.10: no README.md in a skill folder)
```

Six violations, all real, none missed and none invented.

Then run against every real shintai reachable from the garden's own checkout, read-only, to confirm the gate does not cry wolf on a body it has no opinion about beyond what this spec states: Baisai, Shō-shin, W, and Tasai were spot-checked and **all four still fail** — including Shō-shin, restructured this same morning, who now fails on exactly the three items their own rehearsal deliberately deferred (`memory/patterns.md`, `identity/README.md`, one leftover `.png.bak`) and nothing else. That is the expected, correct result: **nothing has been restructured to close a finding in this pass** (see §Scope fence), and a gate that came back green on bodies nobody had touched today would be the bug, not the news.

**The packaged-artifact check (§4–5) was negative- *and* positive-tested**, both matter equally — a gate that only knows how to fail is as untrustworthy as one that only knows how to pass:

- a clean synthetic `.skill`-shaped tree carrying only `memory/working-state.md` and `memory/MEMORY.md`, frontmatter only → **PASS**
- the same shape with a body line in `memory/working-state.md`, plus `memory/journal/…`, `memory/seed/…` and `home/<slug>/inbox/…` → **FAIL**, all four leaks named, each with the specific path that leaked
- the failing case re-run as an actual zipped `.skill` archive (not just a staged directory) → same four findings, confirming the check reads zip contents correctly, not only a filesystem walk
- a body named `bonsai` carrying initial memory (`memory/strategic-context.md`) → **PASS**; the same with `memory/journal/…` → **FAIL** (*"Bonsai carries initial memory, never a journal"*)

*Re-run 2026-09-23 against the empty-memory rule, in a session scratchpad (fixtures not committed): the results above are that run's, verbatim in substance. The 2026-09-22 run tested the retired `memory/seed/` rule.*

---

## Scope fence

This document and the gate are the whole of this pass. **No body was restructured to close a finding.** The next pass restructures the remaining thirteen (Shō-shin's morning rehearsal, itself partially superseded by this document's `heritage.md` and `.bak` rulings, is the first and should be re-run — or at minimum re-verified — against this gate rather than against the earlier spec it was run against) and should run *against* `check-shintai-conformance.py`, not around it.

---

## What this costs

Carried forward, unchanged in substance: every agent's `SKILL.md` activation order must be repointed; signed files that move need re-signing (proven safe by the Shō-shin rehearsal — the key resolves by signer slug, not file path, so a move alone never breaks a seal); metadata references already keyed by `id:` survive a move by construction; the forty-one signed files carrying no `id:` at all remain a prerequisite gap.
