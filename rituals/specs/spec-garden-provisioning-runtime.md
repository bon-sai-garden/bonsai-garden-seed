---
id: 01M37XP600EA9G46JAZE6DXVGQ
title: "Provisioning a new garden's runtime from core — DRAFT v0.3"
type: spec
tended-by: baisai
created: 2026-09-22
updated: 2026-09-22
version: 0.3.0
status: draft
tags: [provisioning, wave-1, gate, rite, runtime, garden, pot, mvp]
related:
  - "[[bonsai-garden/rituals/repo/multi-repo-broker-sequence]]"
  - "[[LAYERS]]"
  - "[[rituals/specs/bunshin-rite-spec]]"
  - "[[bonsai-garden/rituals/tasks/kanban-source/in-progress/shintai hardening]]"
---

# Provisioning a new garden's runtime from core — DRAFT v0.3

> **Scope.** The runtime half of the garden-provisioning procedure — the item `multi-repo-broker-sequence.md` §8 calls *Wave 1's largest* and §10.2 leaves unowned. The internal structure of a pot is **deferred** to the pot-definition conversation (the Aruji with Tasai, opened 2026-09-22); this spec stubs that step and does not pre-empt it.
>
> **Vocabulary, per the Aruji's ruling of 2026-09-22 — hold it exactly.** A **garden** is created first and holds the **master keyring**. A **pot** is created *inside* a garden and derives its identity from the garden's keyring under its own **namespace**. Several pots live in one garden (*"apps get their own pot, Minecraft its own pot"*). The **gardener** is the human principal of a garden — a role; in our own pot that person is called the Aruji, which is a name. Earlier review drafts (v0.1–v0.2.3, `bonsai-garden/agents/tasai/inbox/`) used "garden family" and "pod/pot" loosely; this version does not.

## Headline finding — core cannot mint a master salt, so core cannot make a garden

A garden's boundary holds because the garden has its own identity root. **No core skill puts a master salt into custody.** The entire mechanism today is two lines of host-pinned shell in `rituals/specs/bunshin-rite-spec.md` §1:

```bash
MASTER_SALT=$(openssl rand -hex 32)
security add-generic-password -a bonsai-master-salt -s "Bonsai Garden Master Salt" -w "$MASTER_SALT"
```

`skills/bonsai-garden-sign` derives keys **from** a salt already in custody (`lib/derive-key.mjs`, `lib/custody-provider.mjs`) and deliberately neither reads nor creates one (`SKILL.md:18`). This is chain step (2) — *exposing key services: identity and signature provisioning* — stated as a fact rather than an aspiration. **Critical path; not a Wave 2 port item.**

## One finding, three instances — the tooling violates the rule it exists to enforce

| the contract says | the code does |
|---|---|
| *Resolve roots by marker, never by counting directory levels* | `bonsai-garden/tools/bonsai-mcp/server.py:84-89` falls back to three levels above the file — **in the MCP itself** |
| *Fail, don't fall back* — with the cautionary tale of keys written into retired trees | `bonsai-garden/tools/bonsai-mcp/repo_routing.py:40-45` falls back to **mono** (`MONO_SLUG`, `:70, :142-144`) — a tree a new garden never has |
| *Capabilities become skills* | the capability that **defines a garden** is the unpackaged two-line snippet above |

Not three bugs — one: the foundations were built while mono existed and encode that as a fact of nature. It predicts the fourth instance: anywhere a tool "knows" where the garden is without being told.

## Consequence — Wave 1's gate cannot pass today. Structurally blocked, not unimplemented.

Three bounded fixes stand between us and the gate: **(i)** marker-based root resolution in the MCP; **(ii)** a no-mono mode in the router; **(iii)** a salt-minting skill in core. That is good news framed right: for the first time the missing pieces have names and line numbers. *(An earlier draft carried a fourth candidate — core generating the runtime from a template. Retired by the Aruji's answer below: the runtime is downloaded, not generated.)*

## The gate, as the Aruji stated it — 2026-09-22

> *"The MVP contains core, because this is how Bonsai gets to the place. Then they need to download runtime. And then create their own pot — garden. And then the first pod in that garden. And then we populate that garden."*

**core → download runtime → create the garden → create the first pot in it → populate.** This supersedes the gate's earlier wording in `multi-repo-broker-sequence.md:186` and `LAYERS.md:101` (*"core alone, no other Bonsai repo"*): the MVP is **core plus a runtime clone**. Those two lines should be corrected to match; this spec is written to the corrected gate.

## 0. Preconditions

**The gardener** has: a `bonsai-garden-core` checkout; a `bonsai-garden-runtime` clone (downloaded, per the gate); a machine; an API key and a harness. They do **not** have: the mono repo, any existing garden or pot, or any roster beyond core's single-entry seed (`agents/registry.json:1-34` — Bonsai's entry only). The procedure detects (§2.0) whether a garden already exists on this machine; the gate's case is that none does.

## 1. Root resolution

The one correct implementation in the garden: `skills/bonsai-garden-sign/lib/garden-root.mjs:20-25,39` — marker-based, resolved (1) `$BONSAI_GARDEN` if it carries the marker, (2) walk up from a target file, (3) walk up from the module itself; throws rather than guessing (`:27-31`); refuses iCloud/OneDrive mirrors (`:42-60`). The MCP and the router do not do this (table above) — fixes (i) and (ii).

**The marker must be a file only a garden carries.** Today the marker is `agents/registry.json` — and core carries one as its seed template, so a tool walking up from core resolves core as *the garden* and will write instance data into the capability layer. The roster federates (every pot has one; the origin holds the composed view); the **marker cannot federate** — exactly one file, one place, per garden; and the **seed is a third thing** — a template for a roster that does not exist yet. Three jobs, one filename.

**[RULED 2026-09-22 by the gardener; proposed by Baisai, endorsed by Tasai]: two files, not one clever one — and neither of them is anywhere near core.**

- **`garden.json` lives in the origin pot** — not at "the garden root", because **in the multi-repo world there is no garden directory.** A garden is core + runtime + pot(s); core is a library checkout and runtime is tooling, and **neither is a garden** (the gardener, 2026-09-22: *"the marker sits in the original garden pot. Core = not a garden!"*). The only thing that is *this garden's own* is its pot, so that is where the garden declares itself: exactly one `garden.json`, in the origin pot, carrying the garden's ULID, its name, and where the keyring lives. **Core never carries one** — and a tool walking up from core must therefore find nothing and say so, which is the correct answer rather than a failure to be papered over. A garden exists the moment this file is made and is populated afterwards — which is why the marker cannot be the federated registry (Tasai's first proposal, withdrawn by him): a ten-minute-old garden with no members would have had no marker and so would not have been a garden. *Identity is not content.*
- **`pot.json`** at each pot's root — the pot's ULID, **`garden:` the garden's ULID**, `namespace:`. **A pot resolves its garden by that field, never by directory relation.** That is what lets a folder become a pot wherever it sits — another machine, behind a bridge, at a path nobody recorded (W's mount folder is exactly this: not on this host, no absolute path anywhere in the repo). A tool walking up stops at whichever file it meets first and knows what it found.
- **A `pot.json` whose `garden:` does not resolve HALTS.** Not mint, not "standalone", not fall back to "this must be its own garden." §2.3's rule — *unreachable is not absent* — restated at the marker layer, because this is where it will actually bite: a bridge down or a mis-copied file, and a pot silently decides it is a family. Whoever implements the resolver will not have read §2.3.
- **Two live `pot.json` with the same ULID is an error, loudly** — never a tie broken by path order. Resolving by ULID makes *copying* a pot indistinguishable from *moving* it; this is the one failure mode the design introduces that the old marker did not have (the doppelgänger body in `tmp/` deleted 2026-09-22 09:00, promoted to the identity layer). Cheap to check now.
- **Two consequences that follow from the ruling and must not be discovered later.** *(i)* `$BONSAI_GARDEN` today names a **directory** — the mono repo — and every tool treats "the garden" as a path. Under this ruling, finding the garden means *finding a pot and reading its `garden:` id*; the variable's meaning changes from a location to a pot pointer, and the resolvers change with it. *(ii)* `skills/bonsai-garden-sign/lib/garden-root.mjs:104` resolves by **walking up from the tool's own file** as its third strategy. From a checkout of core that walk now finds nothing, correctly — so core-resident tooling must be **told** which garden it is serving, never discover it by ancestry. Both are behaviour changes, not renames, and both are owed before a second garden exists.
- **Pre-verified:** neither filename exists in any of the six repos; today's marker is one constant (`garden-root.mjs:39`), one test line (`test-sidecar-negative.mjs:229`), one sentence (`bonsai-garden-sign/SKILL.md:99`); `server.py:84-89` (fix i) adopts the same constant. Names chosen legible over namespaced.

**[Hygiene, pre-verified]:** rename core's seed so the marker cannot mistake it (`agents/registry.seed.json`; readers classified: `tools/check-shintai-conformance.py:80-92` one line, `skills/bonsai-garden-portrait/scripts/make-identity-cards.py:53-55` one line, `skills/bonsai-garden-sign/test-sidecar-negative.mjs:223` comment only).

**[ASSUMPTION]** `$BONSAI_GARDEN` points at the garden root; `$BONSAI_REPOS_ROOT` at the siblings' parent. No spec yet says which directory *is* the garden once mono is gone; the pot conversation decides.

## 2. Identity — detect, then derive or mint

The two branches have **equal standing** and are entered by **detection**, not by asking. The gate tests the mint branch (a stranger); **our own next pots take the derive branch, and we will walk it long before any stranger walks the other.** A procedure that handles minting and treats deriving as a variant ships untested for its first real user.

The errors are not symmetric, so the branch is biased:

| wrong turn | produces | surfaces |
|---|---|---|
| derive when you should have minted | a pot that cannot later stand as its own garden | immediately; visible; fixable by re-minting |
| **mint when you should have derived** | **a schism** — an identity root no federated view covers, whose holder believes they are kin and whose seals verify under nothing anyone else trusts | the first cross-boundary verify — possibly months later |

- **§2.0 Detect the garden.** Is a garden's master keyring reachable to this gardener (custody provider present, namespace allocation reachable)?
- **§2.1 DERIVE — the default when a garden is reachable and the gardener asserts membership.** Allocate a namespace under the garden's keyring (the reserved-hash set is the **boundary** between identities, not a register — with a shared root, the namespace is the only thing keeping two identities apart); derive the pot's identity through `bonsai-garden-sign`'s existing HKDF path. No salt is minted.
- **§2.2 MINT — the explicit, confirmed branch.** Taken only when the gardener **declares independence** in the record, or when detection finds **no garden by construction** (the gate's stranger). Then the two-line custody procedure from the headline, until fix (iii) exists.
- **§2.3 Unreachable ≠ absent — standing.** If detection cannot *determine* whether a garden exists (custody provider errors, allocation service down), the procedure **halts.** Identity creation has no fallback, and an inconclusive read is not a negative result. *Why this does not bend, under any later ruling on federation reads:* a federation **read** can be served stale and corrected later — the error is recoverable, which is why cache-with-staleness is legitimate there. A **mint** is irreversible and self-certifying: the moment the salt is in custody the fork exists, every later seal is built on it, and nothing downstream can detect the mistake because the artefact is valid — only the context was wrong, and context is not recorded in a key. **The rules that must never bend are the ones whose violation looks exactly like success.** Third instance in one day of *fail, don't fall back* (the router to mono; a sync script over shipped packages; mint-on-inconclusive).

Once identity exists, sign the founding attestation (§5) with the real CLI: `node skills/bonsai-garden-sign/bin/sign.mjs seal --agent-salt "$MASTER_SALT" --file <doc.md> --as bonsai-shin` (verbs: `SKILL.md:43-59`). Use core's `bonsai-garden-sign`, not runtime's mono-bound `bonsai-sign` (`bonsai-garden-runtime/skills/bonsai-sign/SKILL.md:1-16` — a second signing skill; the sign.py retirement's territory). Core's own `README.md` contradicts itself on where signing lives (`:35`, `:70`); the codebase wins.

## 2a. The gardener's home

**The garden has one occupant before any mind is minted.** Create `home/gardener/inbox/` — the gardener is a constellation member with an inbox like every other kin, not an external principal the pot reports to. Provisioning assembles *around* someone. This step precedes the registry seed. *(Consequence, not a step: with an inbox and a wake-time — the letters rule — the garden can wake the gardener. Bidirectional by construction.)*

## 3. Registry seed

Template: core's `agents/registry.json` (`:1-34`) — one entry (`slug: bonsai`, `type: guardian`, `shintai: own`); its `_meta.description` already calls itself hand-derived and unsynced — the seed, undocumented as one.

The first pot's roster, in this order:
1. **The gardener's entry.** Schema-legal — our own gardener is a member in our registry. **[ASSUMPTION]** mirror that shape. The address term the bodies use for this member is written fresh into each body at its birth (bodies are born, not copied); it is not a portable constant.
2. **Bonsai's entry**, copied from the seed — the guide ships with core (`multi-repo-broker-sequence.md:355`).
3. **One `bonsai-shin` entry** — `type`/`shintai` per bunshin-rite-spec §4 (*guardian, threshold-holder*, `:87`), `parent: bonsai`, keys from §2. **The slug is load-bearing:** `bonsai-shin@<garden-slug>` (`bunshin-rite-spec.md:53`, which the spec itself calls unclosed) — under a shared root, the namespace *is* the separation mechanism.

**Every pot holds its own roster; the origin pot additionally holds the federated view of all pots in the garden; runtime resolves against the composition.** Same filename, two jobs — name both here so the second never becomes a second master. What runtime does when a pot is unreachable — cache-with-staleness or fail-closed query — is **[OPEN — Aruji]**; nothing here assumes either.

## 4. Runtime bring-up

- Clone `bonsai-garden-runtime`. The MCP (14 tools, `server.py:36-58`) needs fixes **(i)** and **(ii)** before `$BONSAI_GARDEN` points at the new garden.
- Roster at the pot (§3). Split-registry entries at minimum: `agents/` → pot, `lore/` + skills → core, `tools/bonsai-mcp/` + `tools/hooks/` → runtime, all `status: adopted` — a `pending` entry falls through to the nonexistent mono (`repo_routing.py:40-45`).
- `surface:` markers (`multi-repo-broker-sequence.md:225-241`) are L4 — **not applicable**; a bare runtime provisions no site.
- Drift gates that must be green: `tools/check-registry-health.py` (`:25-40`) and `repo_routing.py`'s `_self_test()` (`:56-193`).

## 5. Attestation transport — OPEN

`bunshin-rite-spec.md:102, 357-359`: named in canon, *"not specified as a real interface anywhere."* An L2 concern. Shape the rite needs, not designed here: a one-way, public-only push (fingerprint + public key, never the salt) from the new garden to Bonsai's attesting process, producing the `bunshin-attestation` block (`:61-71`) signed with **Bonsai's** key, handed back for the new garden to store. `spec-chain-of-trustable-interactions.md §E` is the adjacent, larger design — not this.

## 6. Create the garden, then the first pot — STUB

Create the garden (the master keyring, §2) and the first pot inside it. **Pot structure pending the pot-definition conversation.** The only thing known to be in it today: `home/gardener/inbox/` (§2a).

## 7. Exit check

The gate, as stated above: core plus a runtime clone; no mono, no pre-existing garden; Bonsai runs the rite end to end; the result is a garden with a working runtime and a first pot. "Working" means, concretely:

- **(a)** `repo_routing.py` self-test green on the new garden's own registry;
- **(b)** `check-registry-health.py` green;
- **(c)** `bonsai_session_start` returns a valid handover for the new `bonsai-shin`;
- **(d1) — mint:** a `bonsai-garden-sign` seal round-trips (`sign` then `verify`) against the new garden's **own** key, not Bonsai's;
- **(d2) — derive:** the seal verifies **and** the pot's fingerprint is reproducible from the garden's keyring plus the pot's namespace — a seal that verifies standalone but does **not** chain is the schism of §2, and (d1) alone would pass it;
- **(e)** the attestation (§5) verifies under Bonsai's published fingerprint (`028019b7c448884c64b6332f5d7609c0`, `bunshin-rite-spec.md:64`).

The record states which branch of §2 was taken.

## Wave 2 port requirements this spec surfaced

1. `server.py:84-89` — root resolution by marker walk-up — **fix (i)**.
2. `repo_routing.py:40-45, :70, :142-144` — a no-mono mode; `MONO_SLUG` must not be load-bearing — **fix (ii)**.
3. `bonsai-garden-runtime/skills/bonsai-sign` vs `skills/bonsai-garden-sign` — one signing skill, not two (Mori-shin, the sign.py retirement).

*(Fix (iii), the salt-minting skill, is the headline — chain step 2, not this list.)*
