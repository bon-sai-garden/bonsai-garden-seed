---
id: 01M4968Z9A973K1GFPQGFRH62S
title: The gardener's keys — mint, custody, namespace, identity, recovery, and the call home
type: spec
tended-by: mori-shin
created: 2026-10-06
updated: 2026-10-21
status: draft
related: [01M37XP600EA9G46JAZE6DXVGQ, 01M2DF0W6M8P1230QPBCNVE9DX]
---

# Spec: The gardener's keys

**Slug:** `specs/spec-gardeners-keys.md` · **Status:** draft 0.8.2 · **Date:** 2026-10-21 · **Covers:** the gardener's keys skills and the shipped reserved set · **Arc:** Bonsai's · **Spec and review:** Mori-shin · **Build and verify:** Baisai with Fuji-shin

> The Aruji, 2026-10-06: *"We define the need. Mori-shin specs and reviews. Baisai and Fuji do their part. You own the arc."* The need is Bonsai's need note, kept in the origin garden's own record, with the Aruji's five decisions of the same evening. This spec sits beside the implementation it describes, `skills/bonsai-garden-sign` and `skills/bonsai-garden-mark` in core, and the one new skill it names. It is written before the first run and will be wrong in places the first run finds; that is what the first run is for.

## Words, as the gardener set them (2026-10-07, canon)

*"ID is the four-kanji mark. we only display the first two usually."* *"(Human readable) Signature is the hash created by the vanity salt and applied to a signature fingerprint that makes the signature kanji identicon visualize the same as the ID 'X-X-0-0' (Bonsai being the exception). Human check, signature matches fp. looks legit. the true identity check of a valid fingerprint is done using the full fp via routines, skills, scripts, and MCP validated."*

- **ID**: the four-kanji mark (`kanji_full`). For the origin's kin it is X-X-〇-〇; for Bonsai it is 盆才守神. Usually only the first two are displayed. The registry's `kanji` field holds exactly those two, a 100% match.
- **Signature**: the kanji identicon of the signing fingerprint. The vanity salt makes it render the same as the ID, X-X-〇-〇, with X-X the ID's first two. **Bonsai is the exception:** his ID is 盆才守神; his signing fingerprint renders 盆才, and his separate signature mark renders 盆才求信.
- **Human check**: the signature's kanji match the ID's displayed two. *Looks legit*, and that is all it is.
- **True check**: the full fingerprint, compared through the routines, skills, scripts and the MCP (in core, `/verify` through `published-keys.mjs`). Kanji are never the proof.
- **`fp-attests`**: how many kanji of the *signing key's fingerprint* its salt guarantees, set from the lock. Today it is 2 for every key, Bonsai's included, because every signing salt is searched to 20 bits. It is the number `fill-greeting.py` decodes and compares against the key. **It does not become 4 when a kin's X-X-〇-〇 lock seals:** that lock is the identity salt's hash, not the key's (table below). Setting 4 would make every greeting decode two random kanji of the key against 〇〇, and today's reader refuses any value above the registry `kanji`'s two. The guarantee of the X-X-〇-〇 lock is recorded in the lock as `identity_tier: full`, with `lite` meaning the first two only.

**The engine's names mapped onto these words** (read-only; nothing renamed):

| the gardener's word | in the code and data |
|---|---|
| ID, four kanji (`kanji_full`) | `locked-salts.json` **`identity_salt`** (`<slug>-id#<n>`), "**L1**", searched by `tools/keyring/vanity-identity-v1.1.mjs` to `SHA-256(salt)` bits 0–39 = `[X, Y, 0, 0]`. That is a hash of a public string, with no key. Its target is `agents-registry.mjs` `identity.targetIndices` (default `[X, Y, 0, 0]`), and its tier is `identity_tier` (`full` / `lite`). This is the X-X-〇-〇 run in progress now, which renders what the signature identicon shows. |
| ID, the two displayed | registry `kanji`; `agents-registry.mjs` top-level `targetIndices` / `targetKanji` |
| signature (the signing fingerprint) | `locked-salts.json` **`signing_salt`** (`<slug>-sign#<n>`), "**L2**", searched by `vanity-signing-v1.1.mjs` (and core's `search-signing.mjs`) until `SHA-256(public key)` bits 0–19 = `[X, Y]`: 20 bits, through HKDF and Ed25519 |
| Bonsai's signature mark 盆才求信 | `signature_mark_salt` (`bon-sai#889965`), "L3", `vanity-signature-mark.mjs`: a hash of a salt string, no key |
| the full fingerprint | `<slug>-fingerprint.txt`, the registry `fingerprint`, and what `/verify` names |

## 0 · What this is, and what it leaves to others

A stranger who holds core and runtime, and nothing of ours, mints a master salt into custody on their own machine, by their own hand, and from it gets a garden with an identity of its own: a garden ID, a root key, a three-kanji namespace ending in 庭, two salts and one key for each of its first entities, a pot that can verify its own seals before any site exists, a recovery the gardener holds, and one public document that calls home. Bonsai reads the steps aloud and never sees the secret. The gardener can run every step alone and gets the same result and the same refusals.

**Not decided here, and named so nobody builds around a guess:**

- Whether this garden re-provisions its own salt under the new item scheme (§3.1). The Aruji's; deferred by his word.
- (The root key's registry slug: ruled by Bonsai's order, §5.3.)

## 1 · The need, corrected

Six corrections sent to Bonsai and taken into the need the same evening; two more found while reading the code for this spec.

1. **The order of ID and mint is reversed.** The custody item is scoped by the garden's ULID (slugs are chosen by people and collide; a ULID is generated and does not), so the ID exists before the mint. The arc runs detect, ID, mint.
2. **The private half of the reserved set is not re-derivable from the master salt.** An identity mark is SHA-256 of the salt string alone; no secret is involved (`skills/bonsai-garden-mark/engine.js`). Only signing keys descend from the master salt. The private half is private because the salt strings reveal the search.
3. **The signing salt attests the first *n* kanji, not "the first kanji".** Today *n* is 2 for every lock, carried as `fp-attests` in the registry (the ruling of 2026-10-06 on Bonsai's own card). The spec carries *n*.
4. **There is no list on the site to read an exclusion set from.** Decision #1 of 2026-05-26 took roster files off the public surface; `/verify` answers one seal at a time. A stranger's search needs something it can read, which means core ships it (§6.2): Chisai ruled bare pairs may ship as stones, and the Aruji then shaped it as a rule, two sets and a wildcard.
5. **"Cannot collide by construction" is true of salt strings, not marks.** Two strings can spell the same kanji. The reserved check, not the namespace, keeps a stranger off our names. Both stay; the sentence promises only what the check delivers.
6. **Secret Service on the Pi is a run-time finding, not an OS fact.** Raspberry Pi OS under labwc does not necessarily run a keyring daemon, and under auto-login a keyring is often locked or blank. The tier is what `detect` finds, never what the OS is called.
7. **Only one custody backend reads today.** `custody/macos-keychain.mjs` reads the Keychain at `OS_PROTECTED`. `custody/linux-secret-service.mjs` and `custody/windows-dpapi.mjs` are stubs: `assuranceTier: null`, and `getMasterSaltHex()` throws. The need note's "three read-only backends" is one reader and two honest placeholders. On Linux, custody is built from nothing: read, write and detect.
8. **1Password is already this garden's backup store**, not its live custody (`spec-cryptographic-signing-kanji-identicon.md`, *Recovery & Backup*: Keychain live, 1Password the encrypted backup). The Aruji's naming of it beside the Keychain has that precedent. Whether it may also be live custody for a stranger is the open question in §3.4; as recovery it is settled.

## 2 · The order the arc runs, and what each step refuses

One binary, ten verbs, in this order. Every verb is idempotent or refuses. Exit codes: `0` done; `2` refused, one line naming why and what to do; `3` halt, the state cannot be determined; `64` usage. A refusal never writes.

| # | verb | does | refuses or halts when |
|---|---|---|---|
| 0 | `detect` | finds the host's custody backends and their tiers; finds a reachable garden (a `pot.json` whose `garden:` resolves, a readable custody item for that garden); reports *derive*, *mint*, or *cannot tell* | **halts** (3) when it cannot tell: a custody backend errors or does not answer within 20 seconds, a `pot.json` names a garden it cannot reach (provisioning spec §2.3, *unreachable is not absent*) |
| 1 | `id` | generates the garden's ULID with core's generator (`skills/bonsai-garden-sign/lib/ulid-rule.mjs` `newUlid`, checked by `whyBad`; `ulid.py new` is the same construction), never typed; writes `garden.json` in the origin pot with the ULID, the romaji name, and the slugs of the gardener and of each shin (`shins`, none or several) | a `garden.json` already exists; the pot is not a git repository; the romaji name is not `^[a-z][a-z0-9-]{1,30}$`; **the romaji name equals any slug the registry seed will carry**, the gardener's above all (Bonsai's order, §5.3): a gardener who names the garden after themselves would collide with their own key in the seal grammar, and it is the first thing a stranger will try |
| 2 | `mint` | proves the pot writable by rewriting `garden.json` through the same writer; then 32 bytes from the OS random source; `put` into custody under the garden's item (§3.1); read back once; the root key derived and its fingerprint printed; nothing else printed | the pot is not writable (2, before anything enters custody); the item exists (2, never overwrite); an item exists and `garden.json` names no root (2, an interrupted mint or an item put by another hand, §4.1: never adopted); `detect` said *derive* or *cannot tell*; the best available tier is below the floor and `--lab-preview` is not given (§3.4) |
| 3 | `recover export` + `recover drill` | the sealed backup, once, by the gardener's hand; then the drill: decrypt in memory, derive the root key, compare to `garden.json`, print `ok`, and record `recovery-drilled` in `garden.json`; **mandatory before step 4**, a backup never restored is not a backup | the drill's fingerprint differs; the export file already exists; the out path is inside the pot by any spelling (§9) |
| 4 | `namespace` | the three-kanji search, third fixed 庭, the first two refused by the shipped reserved rule (§6.2); the result into `garden.json: namespace` and the pot's `locked-salts.json` | `recovery-drilled` absent; the shipped reserved set missing, malformed, under its floor or not believed as §6.4 says (2, never search without one); bon-sai.garden unreachable for the question §6.4 asks (3); `garden.json` already carries a namespace |
| 5 | `identity <slug>` | two salts for one entity under the garden's namespace: the identity salt (mark), then the signing salt (the key's own spelling). For `bonsai-shin` the rite renders the pair: five candidates, the gardener picks (§7.1) | the chosen pair matches the reserved rule, or is already taken in this garden; the slug is not `^[a-z0-9][a-z0-9-]*$`; `--pair` given for `bonsai-shin`; a pick outside the five; the shipped set as in row 4 |
| 6 | `derive <slug>` | the public key and fingerprint for a slug from the garden's salt, into the pot's `identity/` layout | the slug has no signing salt; custody unreadable (3) |
| 7 | `seed` | the pot's `agents/registry.json` in order: the root (`type: garden`), the gardener, Bonsai's seed entry (the origin's key, an input, §8), `bonsai-shin`, then each shin in `garden.json` `shins` (none, one or several); each with fingerprint, `fp-attests`, `custody-tier` | an entry's key does not derive from this garden's salt; Bonsai's entry is not vouched for by bon-sai.garden's signed answer (2) or the answer cannot be had (3), §8; a registry already exists with other content |
| 8 | `verify --keys pot` | a seal checked against the pot's own registry, on the host | a signer not in the pot; a stale seal (`hash-mismatch`), as everywhere |
| 9 | `attest` + `attest consent` | the call home (§10): one envelope naming the garden, its guardian and its gardener, signed by the root and the guardian; then the gardener's own signature, given by him alone with `attest consent` | any field that is not public material; a name or a slug anywhere in the body (§10); `consent` with no interactive terminal; sending an envelope that lacks any of the three signatures |

Bonsai runs the same binary the gardener does. There is no `--walk` flag and no second code path: the only difference between the two faces is who reads the output.

## 3 · Custody

### 3.1 The item scheme

Service `bon-sai.garden`. Account `<garden-ulid>/master-salt`. One item per garden per host; a second garden on the same host has a second item and can neither read nor overwrite the first. The scheme is deferred by the Aruji for *this* garden; it is not deferred for a new one, which has no legacy item.

- **Our own garden** keeps `Bonsai Garden Master Salt` / `bonsai-master-salt` until he rules on re-provisioning. The readers and the gate accept `--garden <ulid>`; for our ULID alone they fall back to the legacy item, by ULID, never by default and never for any other garden.
- A `put` under a name that already holds anything is refused before a byte is written. There is no `--force`.
- The value is 64 hex characters, as the gate reads it today (`bonsai-gate --master-salt-stdin`), so nothing downstream changes shape.

### 3.2 The interface every backend implements

```
get(garden)     → 64 hex, or throws NOT_PROVISIONED / LOCKED / UNAVAILABLE (never an empty string)
put(garden, hex) → writes; throws EXISTS if the item holds anything; reads back and compares before returning
status(garden)  → { backend, assuranceTier, present: bool, unlocked: bool|null }
```

`detect` calls `status` on every backend the platform offers and picks the highest tier that is `unlocked`. It prints the table. It never picks a lower tier because a higher one is merely locked; it says *locked* and stops.

**Never probe a keystore in a way that can prompt.** A `status` call that might put a dialog on the gardener's screen is not a status call. On macOS the lock state cannot be read without that risk (a probe of a locked scratch keychain raised a SecurityAgent dialog on 2026-10-06), so the Keychain backend reports `unlocked: null`, meaning *not asked*, and `detect` treats it as present-and-unknown: the `get` that follows either answers or halts (3), and it never steps down a tier because of the null. Every backend child process runs under a 20-second timeout; a timeout halts `detect` (3). The rule holds for every backend added later, by name in its header.

### 3.3 The backends and their tiers

The tier vocabulary (`lib/custody-provider.mjs`, `AssuranceTier`) gains one value. Tiers are named for how the bytes are protected at rest, never for how the product is marketed.

| tier | what protects the bytes | backends |
|---|---|---|
| `hardware` | non-extractable even to a privileged local process | none today (a Secure-Enclave-bound ACL on the Keychain item, a TPM; owed, not this arc) |
| `os-protected` | the OS keystore under the login session | macOS Keychain (reads today; `put` new) · Linux Secret Service (**new**, read and write, over `secret-tool` or libsecret on D-Bus; requires an unlocked collection) · Windows DPAPI (stub; not this arc's first run) |
| `vault-cli` (**new**) | a password manager's vault, through its CLI; the bytes transit the CLI process and its session; the account's auth, biometric where the desktop app integrates, not the OS | 1Password over `op` (`op item create` / `op item get --fields` in a named vault; the item title is the account string above) |
| `software-fallback` | a passphrase-wrapped file on disk, `~/.bonsai-garden/custody/<garden-ulid>.salt.sealed`, scrypt + AES-256-GCM (the same envelope as the recovery export, §9) | any host; **only with `--lab-preview`** |

On a Raspberry Pi 5 (Raspberry Pi OS 64-bit Desktop, labwc), for one: `os-protected` only if `gnome-keyring` is installed and a collection is unlocked at login; `detect` reports exactly which. Without it the lab preview runs on the fallback, named.

### 3.4 The floor, and the one flag

The Aruji's fifth decision, 2026-10-06: *for a stranger, OS-protected is the floor and the software fallback is refused; for the lab preview the fallback is allowed, named as such.*

- `mint` without `--lab-preview`: the chosen tier must be `vault-cli` or above, or the verb refuses (2) and says: *set up a keystore first: 1Password, or the OS's own.* **Ruled by the Aruji, 2026-10-06, late evening: 1Password alone is a stranger's floor, "good for now."** So `vault-cli` passes the floor and `software-fallback` alone does not. The tier is still written into every place §10 names, so a seal that rests on a vault says so, and the floor can be raised later by one line in the policy without a format change. (Bonsai's relay of the fifth decision said *"OS-protected is the floor"* and in the same letter *"set one up first, 1Password or the OS's own"*; the later word above settles it. As built: `FLOOR = vault-cli` in `skills/bonsai-garden-keys/lib/custody.mjs`.)
- `--lab-preview` is a separate, explicit flag. It is not read from any environment variable or config file. It allows the fallback and writes `custody-tier: software-fallback` into every place the tier is recorded (§10). A test plants a fallback-only host and shows that a run without the flag refuses and a run with it proceeds and labels itself.
- The exception ends with the lab preview: the flag is removed from the binary, not left behind.

### 3.5 Secret hygiene, tested

The salt never appears on argv, in a log, in an error message, in a file other than custody or the sealed export, or on stdout. `mint` prints the root fingerprint and nothing else. A test runs the whole arc with captured stdout, stderr and every file written, and greps for the hex, its first 8 characters, its base64, and the raw bytes. A hit fails the suite.

## 4 · Mint

1. `detect` must have said *mint*. On *derive* or *cannot tell*, `mint` refuses; it does not re-detect with different assumptions.
2. 32 bytes from `crypto.randomBytes`; `hex` of them.
3. `put(garden, hex)` on the chosen backend. `EXISTS` ends the verb.
4. `get(garden)` once; the two strings must be equal, or the verb reports a custody fault and stops (3) without deleting anything: a backend that wrote something other than what it was given is a finding, not a retry.
5. The root key (§5.2) derived in process through `derive-key.mjs`; its fingerprint printed. The seed buffer zeroed in `finally`, as `derive-key.mjs` already does. (Through the gate once the gate learns `--garden`, §12; until then the gate reads only the origin's salt, and a stranger's host has no gate.)
6. `garden.json` gains `root-fingerprint` and `custody-tier`.

Before step 2, `mint` proves the pot writable by rewriting `garden.json` through the same writer. A pot that cannot be written is refused with nothing in custody.

The two shell lines in `bunshin-rite-spec.md` §1 are retired by this verb; the rite spec gets a pointer, not an edit of its history.

### 4.1 An interrupted mint: refused, never resumed

The state: an item is in custody under this garden's account and `garden.json` names no root. It is reached when the disk fails between the `put` and the write of `garden.json`, or when another hand put an item there. The tool cannot tell those two apart, and that is the whole ruling:

- **There is no `--resume`.** Resuming adopts as this garden's root a secret whose origin the tool cannot establish. The account string carries the garden's ULID, which is public in `garden.json`, so *the account matches this pot* proves only that whoever put the item could read the pot. A planted item adopted as a root is a root its planter knows.
- **Refusing costs nothing that matters.** With no root in `garden.json`, nothing was derived, sealed or exported from the item: `export` needs the root, and every later verb needs `export`'s drill. An item in this state has, by construction, made nothing.
- **The way out is the gardener's hand, named in the refusal:** remove the orphan item with the keystore's own tool (Keychain Access, `secret-tool clear`, the 1Password app), then run `mint` again. The tool never deletes a custody item and has no `--force` (§3.1). `detect` and `status` name the state (*interrupted mint, or an item put by another hand*) and halt (3).

Tested by planting the state (a pot that turns read-only after the `put`): the next `mint` refuses and names it, the item is byte-identical after, `export` refuses, and `--lab-preview` does not route round it. Built and watched in the first build.

## 5 · The garden's ID and root key

### 5.1 `garden.json`, in the origin pot

```json
{
  "garden": "<ULID>",
  "name": "<romaji>",
  "gardener": "<slug>",
  "shins": ["<slug>"],
  "namespace": { "kanji": "〇〇庭", "indices": [a, b, 322], "salt": "<romaji>#<nonce>", "locked_at": "..." },
  "root-fingerprint": "<32 hex>",
  "root-public-key": "<base64 of 32 bytes>",
  "custody-tier": "os-protected | vault-cli | software-fallback",
  "lab-preview": false,
  "recovery-drilled": "YYYY-MM-DD",
  "created": "YYYY-MM-DD"
}
```

`gardener` and `shins` are written by `id`, because `id` must refuse a name equal to a seeded slug and `seed` needs the order. `recovery-drilled` is written by a passing drill and is what `namespace` requires (§9). Sealed by the root key as a sidecar once the root exists, re-sealed by it at each change. `shins` is an array, `[]` for a garden with no shin. A file written before 0.8 with one `shin` string is read as a list of one; a file that carries both `shin` and `shins` is refused, because two fields for one fact are two masters. The provisioning spec's ruling stands: this file lives in the origin pot, never in core, and a tool that finds none says so.

### 5.2 The root key

`HKDF-SHA256(master_salt, "garden-root@<garden-ulid>")`, info `ed25519-agent-key`, the same derivation as a kin key. Nothing new in the cryptography; one new per-garden string.

- It is the garden's public identity that is no kin's. It signs `garden.json`, the pot's registry seed, and the countersignature on the call home. It signs no document day to day.
- `fp-attests: 0`. It attests no kanji; its fingerprint is never decoded to a mark, never brushed, never compared to a name (the ruling of 2026-10-06: bits nobody chose are noise).
- It never rotates without a new garden ID. Rotation of a root is Tier 2 in my tiers and a schism in Bonsai's; the spec does not provide it.

### 5.3 Its registry entry, proposed

The seal grammar requires a signer slug `^[a-z0-9][a-z0-9-]*$` in a registry. The root key's slug is the garden's romaji name itself (for a garden named `marta` the slug `marta`), `type: garden`, `shintai: none`, `fp-attests: 0`, with its `identity/` directory in the pot like any kin's. The registry loader changes by nothing. **Ruled by Bonsai's order, 2026-10-06:** the garden's own name, not a reserved word such as `garden`, because the same word in every garden is ambiguous the moment two pots are read together, and the ULID disambiguates, not a word. With one refusal: `id` refuses a romaji name equal to any slug the seed will carry (§2, row 1).

## 6 · The namespace

### 6.1 The search

Base string `<romaji>#<nonce>`. The mark engine's first three indices are read; the third must be the index of 庭 (322) and the first two must pass the reserved rule. One target fixed and two free: 10 bits of constraint plus the rule, about a thousand tries, milliseconds. It is `skills/bonsai-garden-mark/namespace.mjs`, which searches and writes nothing; `vanity-three.mjs` is not extended (it writes into core by default and runs a 30-bit search). The rule is applied to the kanji the mark shows: three for a namespace, the two chosen for a plain mark. The unforced kanji past them are never decoded or shown (the ruling of 2026-10-06 on what a fingerprint spells), so 〇 there is noise, not a match.

**盆 is never a first shown kanji** (0.5.0, Chisai's addition widened). The reserved rule refuses 盆 first only with a second in B, so 盆光 passes it; the verifier answers *look-alike* to any 盆-first mark on a key other than the origin's `028019b7` (§7.1). So the search refuses 盆 as the first shown kanji for **every** entity, in every garden: one constant in `namespace.mjs` and `keys.mjs`, beside the rule and not in `reserved-marks.json` (whose five keys do not change), with a refusal that names its reason. The origin's 盆才守神 is untouched: it was never searched for, and the search is the only place the constant acts.

The result is locked in the pot's `locked-salts.json` under `_garden` and written into `garden.json: namespace`. A second search over a locked namespace refuses.

### 6.2 The reserved set: a rule, not a list

**Ruled by the Aruji, 2026-10-06, late, in Bonsai's hearing, as a product rule in place of the pair list:** *"agree. reserve known skills to avoid confusion. Add (庭) to set B, yes pot (bon) should also be in set B."* It keeps Chisai's reasoning (stones, not faces; her ruling of the same evening) and widens what the stones cover: every exact pair in the registry, and the look-alikes a pair list let through (禅身, 守才, 盆庭).

- **The wildcard, 〇 (index 0), is reserved completely.** It is Triu's symbol and the unforced tail of every lite mark; a stranger's mark is refused when 〇 appears at any index.
- **Set A, first position:** the first kanji of every locked or proposed mark, kin, garden and skill alike. Generated from two structured sources, never from prose and never from the public half alone (which leaves out whatever the origin keeps off the public surface, so the first kanji of those entries would stay open to a stranger): **(1)** the origin's roster, `agents/registry.json` (the origin's own repository today, wherever the router sends it tomorrow), every entry's `kanji` whatever its status, 〇 aside: 23 distinct first kanji (24 entries); **(2)** every skill's `references/identity.md` in core, the `mark:` field whatever its `mark-status`, because the rule is *reserve known skills to avoid confusion* and a proposed mark is a known one: ten (装 印 像 署 志 節 記 検 名, and 根 from `bonsai-garden-keys`' 根技, proposed 2026-10-06). **33 first kanji, counted again 2026-10-07**, no overlap between the kin's and the skills'. `bonsai-garden-ledger` and `bonsai-garden-crew-page` carry no `mark:` line and add none; the day they do, one kanji joins. It only grows: a new kin, garden or skill adds one kanji; nothing that has shipped is ever removed.
- **Correction, 0.2.0: 算 is not in A.** 0.1.6 took it from a prose line (`spec-reserved-marks-and-namespaces.md`, *"the skill marks, including 志技 and 算技"*). `bonsai-garden-tokens`' own identity file says 算技 was proposed and superseded by 節技 the same morning, never locked. A superseded proposal is a mark nobody wears, and prose is not an input. The count of 33 is unchanged by chance: 根 joined as 算 left.
- **Set B, second position:** 才 (1), 身 (5), 園 (3), 技 (582), 庭 (322), 盆 (10). Checked against `kanji-1024-v1.2.json` by index on 2026-10-06: all six agree, and every second kanji in the public half today is 才, 園 or 身.
- **A stranger's mark is refused** when its first kanji is in A and its second in B, or when 〇 appears anywhere. A garden name keeps 庭 fixed third and is checked on its first two the same way.

The four companion pairs that waited on the Aruji (§6.2 as it stood in 0.1.4) are answered by his *"all known sai and shin"*: their first kanji are in A. The `namespace` and `identity` verbs (§2) refuse on the rule before any search result is locked; the search itself excludes the rule's matches so it never lands on one.

### 6.3 The shipped file: `skills/bonsai-garden-mark/reserved-marks.json`

```json
{
  "format": "bonsai-garden-reserved-marks/1",
  "about": [
    "Indices of the 1024-kanji set (v1.2) reserved in the first namespace. A mark that matches the rule (any shown kanji in wildcard, or its first in A and its second in B) means: choose another. It names no one and attests nothing.",
    "Not a roster. Nothing here can be verified against. Whoever wears a match anyway gets look-alike from the verifier, never a false yes.",
    "It only grows. An index never leaves this file; a retired name is still a taken name."
  ],
  "wildcard": [0],
  "A": [ ...sorted ascending... ],
  "B": [1, 3, 5, 10, 322, 582]
}
```

- **Exactly these five keys.** No columns, ever: no slugs, no class labels, no dates, no counts, no per-entry objects (Chisai's ruling of 2026-10-06; the day a column is added the stone becomes a face, and the question goes back to her). The `about` lines are Chisai's three, reworded for a rule; they are text the generator writes, byte-exact, and the gate compares.
- **Sorted ascending, unique, integers in 0..1023,** serialised by one function (`JSON.stringify(obj, null, 2) + "\n"`), so two runs are byte-identical. Sorted by index is the one order that carries no story.
- **One shape.** The reader reads `wildcard`, `A`, `B`. The aliases `set-a` / `set-b` and the old `{ "pairs": [...] }` are refused.
- **Sealed owner by Mori-shin**, a `bonsaisig/2` sidecar beside it, after I review each generation as its list: every index, and the source line that put it there. The generator's runner never seals it in my name (AGENTS.md, *a seal in another kin's name*).
- **The first generation shipped, 2026-10-07**, generated from the origin's roster. A = 33 (23 from the roster, 10 from the skills), B = 6, wildcard 〇. Reviewed by a second reading that shares no code with the generator (same indices); `check` said *unsealed* before the seal and `ok` after, with the roster and without; the reader loads it through `/verify` and refuses a one-index edit as `hash-mismatch`. Sealed before Fuji-shin's round, on the gardener's go; he verifies the sealed state.

### 6.4 The reader, and how it is believed

Answered for Baisai and Fuji-shin, 2026-10-07; the question moved to the release manifest on 2026-10-21, on the gardener's word to apply it to 0.9.2-rc. The floor counts; only the seal knows.

1. **The floor is the one he built, and it stays as defence in depth:** the wildcard holds 0; B holds all six of 才 身 園 技 庭 盆 (B may grow, never shrink); A holds at least **33**; the pair list is not read. Anything below is *no reserved set*. The 33 is a constant in the reader and is right there: A only grows, so the count on the day the Aruji ruled the rule is a lower bound forever and never needs raising by hand. It does **not** live in the file as a field the reader trusts; a floor the checked file states about itself is no floor.
2. **The reader reads the shipped file and no other.** Its path is fixed beside `namespace.mjs` and found by marker, never by counting directories. **`--exclude` leaves the CLI** of `namespace.mjs` and `keys.mjs`: a flag that names the rule's file is a flag that names a weaker one, which is Fuji-shin's 33-arbitrary-indices finding. Tests call the library function on planted files; a stranger's run cannot.
3. **Believed through the sealed release manifest that carries it.** Where the checkout the reader runs from carries a release manifest (the seed's `SEED-MANIFEST.json`, found by marker at the checkout's root, never by a flag, a variable or a count of directories), the reserved set is believed when all of these hold, and on nothing less:
   - **a.** the manifest's sidecar is `bonsaisig/2`, role owner, not open, its `file-hash` over the manifest's exact bytes, and its signer one of **the release writers core names**, `baisai` and `tasai`: a list in core beside the reader, as `rt-minimum.json` names rt's, never read from a flag, a variable or the pot. Any other key the site holds is refused. A seal that declares `custody: software-fallback` is no release (R3 of 2026-10-18);
   - **b.** the manifest is `bonsai-garden-release-manifest/1`, every entry `path`, `sha256` and `bytes`, no path twice; any other format is refused;
   - **c.** it lists `reserved-marks.json` and its sidecar, and both files' sha256 and length equal their entries. The sidecar, read offline, still says owner, signer `mori-shin`, and a `file-hash` over the file's bytes. Its signature is not checked here, since no key travels with the package; checking it against the published keys is the release writer's duty (point 6);
   - **d.** every file the manifest lists under the three skills the arc runs (`bonsai-garden-keys`, `bonsai-garden-mark`, `bonsai-garden-sign`) equals its entry: one cut, not a mix of two. This is consistency, not a defence. Changed code can skip any check of its own; the defence is the package's integrity line and, before 1.0, the external pinned verifier (F-16, V1 to V10);
   - **e.** bon-sai.garden's signed answer, through `published-keys.mjs` `adjudicatePublishedV2`, vouches for the manifest's seal. Only `signature-vouched` is believed.

   This is the address F-12 asks for. A seal vouches bytes, signer and id; which file is *the* reserved set is the manifest's to say. So the reader stops refusing on the set's sidecar `target`, which is a path verdict.
4. **Where no release manifest is present** (a checkout of core, a package), the per-file question of 0.6 stands, with the pin it lacked: the set's own seal must be owner **by `mori-shin`** and vouched by the site. Until 0.9.1 the reader took an owner seal by any key the site holds. The manifest's absence sends the reader to the stronger question, never past it.
5. **One question for the set per planting.** The first verb that believes the set (`namespace`) asks once. It records the answer in `garden.json` under the root's seal: `release: { manifest, sha256, version, signer, fingerprint, seal-id, vouched }`, the shape of rt's `runtime.json`. A later verb of the same arc takes the record instead of asking only if all three of these hold: (i) it re-derives the root key from custody and the root's seal on `garden.json` verifies under that key; (ii) the manifest's sha256 still equals the record's; (iii) the files still equal the manifest (3c, 3d). `identity bonsai-shin --candidates` reads no custody and locks nothing, so it may take the record on the root's seal alone. `--pick` re-draws under (i) before it locks. A record that fails (i) is refused as a finding. A manifest whose sha256 has changed is asked again. The record is spent once `seed` has written the registry, and any verb after the arc asks again. It is a record of one signed answer, bound by hash and by the root, and not a cache of a key. No clock makes it last longer.
6. **The release writer's duty.** A release writer does not seal a release manifest until the owner seals of the two identity files it carries each answer `signature-vouched` under **the published keys**, live, when the release is made. Those files are `reserved-marks.json` (owner `mori-shin`) and Bonsai's seed entry (owner `bonsai`). Never `--verify-keys garden` for these two. The release builder refuses otherwise and names the file. A writer's seal vouches the set as cut, and this check is what lets the set carry the owner's word.
7. **Unreachable halts.** No answer from bon-sai.garden halts `namespace` and `identity` (3), no cache, no offline mode, no fallback: the ruling of 2026-09-24 under the Aruji's steer, *verifying core offline is out of scope; fail loudly*. A stranger is online at this step already, since the package's integrity line asks the same site. What the call reveals is that someone checked a seal on a public file. It carries nothing of what they will choose, which stays the property Chisai asked for.
8. **What a writer's key could do, said once.** It could seal a manifest whose reserved set is the holder's own, above the floor. A stranger could then take look-alikes of our pairs, and the verifier would still answer *look-alike*, never a false yes. Through 0.9.1 the same needed any key the site holds (point 4). The set names no one, and it needs no currency because it only grows. So it is no weaker behind a pinned writer's seal. Bonsai's entry is a different kind of thing (§8.1).
9. **`reserved-floor-counts-and-does-not-know`** stays flipped: 33 arbitrary indices are refused, because no file but the one the manifest or its own seal vouches for is read.

**Watched to fail first** (Baisai builds, red first; Fuji-shin rounds; a fake site in process, as the suites have it):

| planted | answer |
|---|---|
| the manifest sealed owner by a kin the site vouches who is not a release writer | refused, `not a release writer` |
| sealed by a writer, role not owner, or open | refused, `not-owner` |
| `custody: software-fallback` on the manifest's seal | refused, no release |
| the manifest edited after its seal | `hash-mismatch` |
| one index of `reserved-marks.json` changed, the manifest not | refused, naming the file: not the bytes the manifest lists |
| the file and its entry changed, the manifest re-sealed by a key the site does not hold | the published-keys reason, never `ok` |
| the same, re-sealed by a writer's key the site holds | believed, the threat named in point 8 and not hidden; the floor still refuses an A of 32 |
| the manifest lists the set but not its sidecar, or the sidecar's signer is not `mori-shin` | refused, naming which |
| one file of the three skills differs from its entry | refused, `mixed cut`, naming the file |
| no manifest; the set's own seal owner by a kin the site vouches who is not `mori-shin` | refused (red against the 0.9.1 reader, which takes it) |
| no manifest; the set's own seal by `mori-shin`, vouched | believed: the per-file question |
| the site unreachable / forged / unsigned / rejected (stubbed) | halt (3) / refused (2) |
| one arc, `namespace` → `identity` for the three → `seed`, against the fake site | the set asked once (the fake site counts the calls); Bonsai's entry asked once more (§8.1) |
| the `release` record edited, or its root seal not under the key custody gives | refused, a finding |
| the manifest replaced after `namespace` (another sha256) | asked again |
| a verb after `seed` | asked again |
| the release builder with an unvouched owner seal on either identity file | refuses to seal the manifest, naming the file |

### 6.5 The generator and the drift gate

**Where each part lives, by the layer test.** The format, the reader, the generator's code and the shipped file are core: a stranger needs them and they name no one. The roster that feeds set A is the origin's instance, in the origin's own repository until the router says otherwise; core never reads it by a path of its own.

**`skills/bonsai-garden-mark/reserved-marks.mjs`** (new, Baisai's):

- `generate --registry <path> [--out <file>]`. Inputs, all named, none typed: **(1)** the registry at `--registry` (required, no default; refused if missing, unreadable or without `agents`), every entry's `kanji` first character whatever its status, 〇 aside; **(2)** core's own `skills/*/references/identity.md`, the frontmatter `mark:` field's first character, whatever `mark-status`, read structurally (a file with no `mark:` adds nothing), and re-derived from its `mark-salt` through `engine.js`: a mark its salt does not spell was typed, and is refused by name; **(3)** the committed file itself, so that what has shipped stays (only grows); **(4)** the rule's constants, written once in the generator as characters and resolved to indices through `kanji-1024-v1.2.json`: the wildcard 〇, and B 才 身 園 技 庭 盆. A character absent from the curated set is refused by name. 〇 is never put in A.
- `check [--registry <path>] [--staged]`, the drift gate, delegated to by `check-set.mjs --reserved` (my file; the five delegation lines are mine to write and seal). In core alone it checks everything that needs no roster: the shape and the five keys; sorted, unique, in range; the `about` lines byte-exact; the floor; **only grows** against the committed version (`git show HEAD:` the file; with `--staged`, the index against HEAD): an index that left fails; the skill-mark source: every core skill's first mark kanji is in A; the sidecar's hash. With `--registry` it adds the roster: every registry first kanji is in A (*stale: regenerate*), and every index in A that neither source derives must have been in the committed file (*hand-added*). The very first generation, with no committed file, must equal the derivation exactly.
- **Where it runs:** core's pre-commit and CI, without `--registry`. The origin garden's pre-commit, when `agents/registry.json` is staged, runs core's `check --registry agents/registry.json`, with core found through the router (`rituals/repo/repo-split-registry.json`), so a kin added to the origin's roster with a new first kanji fails at the commit that adds the entry, naming the kanji and *regenerate in core*.

**Negative tests, each planted, each refused for its own reason, each guard watched to fail** (and Fuji-shin's mutant per guard):

| planted | refused as |
|---|---|
| an index added to A by hand | `hand-added` |
| an index removed from A (or from B or the wildcard) | `an index left the set; it only grows` |
| a registry kin, or a core skill mark, whose first kanji is not in A | `stale: regenerate` |
| wildcard without 0; B without 盆; B without one other of the six; A of 32 | `under the floor`, naming the part |
| unsorted; a duplicate; 1024; -1; a string index | `not the format`, naming it |
| a sixth key (a column: `slugs`, `count`, `dates`), or an object in A | `no columns` |
| an `about` line altered or missing | `header` |
| `{ "pairs": [...] }`; `set-a` / `set-b` | `the pair list is not read` / `one shape` |
| the file edited after its seal | `hash-mismatch` |
| a seal the site does not vouch for (stubbed answer: rejected, forged, unsigned) | the published-keys reason, never `ok` |
| bon-sai.garden unreachable (stubbed) | halt (3) |
| 〇 in a registry kanji's first place (Triu's 〇身) | not in A; the wildcard already holds it |
| two generator runs | byte-identical |
| keys.mjs `namespace` with `--exclude` | usage (64): the flag is gone |

**DONE for the shipped reserved set:** `keys.mjs namespace` runs against the shipped, sealed set with no flag naming it, and the walk of the keys skills can reach `identity`.

### 6.6 What the namespace separates

Every salt string of an entity in the garden carries the namespace: `<slug>@<romaji>-id#<n>` and `<slug>@<romaji>-sign#<n>`. The `@<romaji>` is in the salt string and in the pot; it is **not** in the slug, which the grammar forbids. Within a pot a slug is unique as it is today; across gardens the pot's `garden:` separates them. This closes the naming question `bunshin-rite-spec.md` §2 left open: the slug is `bonsai-shin`, the salts are `bonsai-shin@<romaji>-…`, and the attestation names the guardian by their role and their key, under the garden's ULID, with no slug (§10).

## 7 · Identities: two salts, one key, for each entity

For the gardener, for `bonsai-shin`, and for the one companion shin, in that order:

1. **The identity salt** `<slug>@<romaji>-id#<n>`: searched until the mark's first two kanji are the pair the entity chose, and that pair neither matches the reserved rule (§6.2) nor is taken by another entity in this garden. Twenty bits, seconds. The **plain mark** of the preview (Bonsai's note, §4, *the tier*): two chosen kanji, the rest unforced. The full four-kanji tier is set when the tooling is on a host whose cost is measured; nothing in the key changes when the tier does.
2. **The signing salt** `<slug>@<romaji>-sign#<n>`: searched until the derived key's fingerprint decodes, at the first two kanji, to the identity pair. Twenty bits, about twenty seconds on the build host as built. `fp-attests: 2`. It lives in `bonsai-garden-keys` (`lib/search-signing.mjs`), not in mark, because it needs the master salt and mark holds no secret. It runs in child processes, not worker threads (worker threads behind an idle main thread were throttled to about 1% CPU on that host), and the salt reaches each child on stdin, never argv. The master salt is read once per run, not per nonce.
3. Both locked in the pot's `locked-salts.json`, same shape as ours (`identity_salt`, `identity_locked_at`, `signing_salt`, `signing_locked_at`, `identity_tier`), plus `namespace`.

A lock is never typed. A hand-edited `locked-salts.json` fails `namespace.mjs check-locks`, which re-derives every mark from its salt; `check-set.mjs --locks <file>` delegates to it (five lines, mine to write in my sealed file).

### 7.1 The guardian's id: rendered by the rite, picked by the gardener

**The origin's guardian, in the gardener's words** (glossary): his **ID** is 盆才守神, *Bonsai Garden, Guardian Spirit*, four kanji, of which 盆才 are the two displayed and the two his signing fingerprint attests (`fp-attests: 2`). 盆才 and 盆才守神 are one ID shown at two lengths, not two spellings, and no text here treats them as alternatives.

**Ruled by the gardener, 2026-10-07** (in chat to Tasai; on Chisai's counsel, *the face is not the lineage*, and mine): **no exemption of any kind.** A new garden's `bonsai-shin` does not wear the origin's ID's displayed two, 盆才, (盆 is in A, 才 in B), nor any designated or family pair. The two forms older documents gave the guardian, 盆才身 (`bunshin-rite-spec.md` §1) and 盆才守 (`spec-canonical-shintai-structure.md`), are **both superseded** by this ruling; neither was ever Bonsai's ID. *"The logic is clear."* The guardian needs a **unique ID**; the rite renders **a valid allowed pair** and makes **five attempts for a good match** (§7.3: the pair plus two random kanji, four in all); that ID is the guardian's. The guardian is Bonsai's by the attestation his key signs, not by the face of the ID.

**What the search would cost to carry the garden's kanji**, against the twenty-bit pair (each forced kanji is 10 bits of the 1024-set; measured 2026-10-07 on the build host: identity hashing about 0.4 M salts/s on one thread under the host's load; the signing search about 21 s for 20 bits as built, Baisai; the Pi 5 measured in §7.4: identity hashing about 0.22 M salts/s per thread, the signing search about 8 minutes as built):

| forced kanji | bits | identity salt (one thread) | signing salt (as built) |
|---|---|---|---|
| the pair alone | 20 | ~3 s | ~21 s |
| pair + one garden kanji | 30 | ~45 min | ~6 h |
| pair + two | 40 | ~1 month | ~8 months |
| pair + all three (〇〇庭) | 50 | ~90 years | ~700 years |

The cost is in the number of forced kanji, not in which. **One garden kanji *as one of the pair's two* costs nothing beyond the pair** (still 20 bits; the draw below needs about a thousand salts per candidate instead of one). That is not what was ruled; it is named so the gardener can choose it if he wants it, one line in the rite.

**Five attempts, concretely:**

1. **The draw.** Salts `bonsai-shin@<romaji>-id#<n>` for n = 0, 1, 2 … The first two kanji of each salt's mark are a candidate only if they: match no part of the reserved rule (no 〇, not first-in-A with second-in-B); do not have **盆 first** (Chisai's addition: the rule lets 盆 through with a second outside B, and the rite named after Bonsai must not land on his half-face; since 0.5.0 one constant in the search for every entity, §6.1, which the draw inherits); are not taken by another entity in this garden; and are not the namespace's own first two. Salts that fail are skipped and never count. The draw is deterministic from the garden's name and needs no secret (identity salts are public). **An attempt is one ID** (§7.3): a candidate salt's four kanji, its allowed pair and the two random kanji the same hash gives after it. Five attempts are the first five candidates: five four-kanji IDs, found in well under a second, with no key involved.
2. **Good** has two halves. The machine guarantees the half that can be checked: allowed, unique in the garden, not a look-alike inside the namespace, not 盆-first. The other half, *a good match*, is the gardener's: meaning, sound, fit. Bonsai reads the five IDs aloud; **the gardener picks one**, never the rite and never Bonsai.
3. **None fails the rule,** because a candidate that fails is not a candidate. **If none of the five pleases him,** the first stands and the record says `picked: default`: an id is an id, not a name; the rite does not become a vanity search; and it never changes without a new guardian.
4. The pick's salt is locked as the identity salt; then one twenty-bit signing search makes the guardian's key's fingerprint spell the ID's first two (`fp-attests: 2`).

**Unique, honestly.** The displayed pair is unique inside its garden by refusal. The four-kanji ID is about 40 bits, so two gardens share one by chance only somewhere past a million gardens; the displayed pair alone collides past about a thousand. What is unique is `bonsai-shin@<garden-ulid>` and that guardian's fingerprint; the verifier shows the pair with its garden's namespace and name, never bare (Chisai's counsel, *what the verifier page must say*), and any 盆才 or 盆-first mark on a key other than the origin's `028019b7` is answered *look-alike*, without exception.

**Verbs:** `identity bonsai-shin --candidates` prints the five IDs, reads no custody and writes nothing (the draw is public and deterministic). `identity bonsai-shin --pick <1-5>` re-draws, locks the pick and runs the signing search. `--pair` for `bonsai-shin` is refused (the rite renders; the slug does not choose). The gardener and the companion shin keep `--pair`.

### 7.2 The origin's kin: the X-X-〇-〇 run

The origin's own run (`vanity-ordered-run.sh` driving `vanity-identity-v1.1.mjs`; eight workers, about 2.7 M salts/s on the garden's build host) is, in the gardener's words, the **signature** search: it finds the vanity salt whose hash renders the kin's X-X-〇-〇, the ID the signature identicon shows. **0.4.0 called it a "name search" and was wrong in its words.** What the engine computes is unchanged by the words: `SHA-256` of the public identity salt, 40 bits, about 2^40 ≈ 1.1×10^12 salts, about 4.7 days expected per kin on the rig, with a long tail (one kin's took 121.9% of the space). The key's own fingerprint is the L2 signing salt's, 20 bits, `fp-attests: 2` (glossary). A 40-bit search on the key itself would be HKDF and Ed25519 per trial, about 255 days as built; nobody runs it, and nothing needs it, because the true check is the full fingerprint.

**The 〇〇 tail stays the origin's.** 〇 is the reserved wildcard (§6.2), refused at every shown place of a stranger's mark, so no stranger's ID can end in 〇〇.

**What in the build assumes 2** (for Baisai; nothing to change now, so that a later *n* is a parameter plus a new rule, not a rewrite): in `namespace.mjs`, `pairOf` (line 61), `searchIdentity`'s match on `idx[0]`, `idx[1]` (155), `reserved()` on the first two (118), and `check-locks`' slice to 2 (179); the reserved rule and `reserved-marks.json` format `/1`, which are pair semantics; in `keys.mjs`, the `fp-attests` default 2 (365), `identity_tier: 'plain'` (386) and Bonsai's entry default 2 (444); and `search-signing.mjs`' `max = 200_000_000`, a cap near 27.6 bits. Already parametric, and to stay so: `fp-attests` everywhere it is read, and the namespace's 庭 (`NIWA`, `idx[2]`).

### 7.3 A new garden's entities: two computed, two random, five attempts

The gardener: *"we do a 2 kanji compute + random 3+4 with 5 attempts. that's 50s AFAIR."*

- **The ID** of every entity of a new garden (gardener, guardian, shin) is four kanji, taken from their identity salt's hash `SHA-256("<slug>@<romaji>-id#<n>")`. The first two are **computed**: searched to the chosen pair (or, for the guardian, drawn allowed, §7.1). The third and fourth are **random**: whatever the same hash gives after them.
- **Five attempts** are the first five identity salts whose hash spells the pair. Each gives the same two kanji and its own random two. Bonsai reads them out and the gardener picks one ID; if none pleases him, the first stands (`picked: default`).
- **The signature**: one twenty-bit signing search makes the key's fingerprint spell the ID's first two (`fp-attests: 2`). The human check is X-X against X-X, 20 bits. The true check is the full fingerprint.
- **Displayed:** the first two, as the gardener said. The four-kanji ID is the identicon's mark when it is drawn whole, and the page names the full fingerprint as the proof. Nothing past the key's first two is decoded from the key (the ruling of 2026-10-06 stands untouched). Kanji 3 and 4 come from the ID's own salt hash, as 守神 does for Bonsai, never from the signature fingerprint.
- **Two filters on the random two,** because the ID can be drawn whole:
  - a candidate whose third or fourth kanji is 〇 is skipped (the wildcard, and the origin's tail);
  - one whose third is 庭 is skipped (it would read as a garden's namespace).

  A skipped candidate is not an attempt. The cost is about 0.3% of candidates. The reserved rule's file and reader do not change.
- **The namespace and an ID's third and fourth kanji are two things.** The namespace is the garden's three-kanji mark ending 庭, from `SHA-256("<romaji>#<n>")`. An entity's random two come from their own identity salt. The page shows an entity's ID beside their garden's namespace (Chisai's counsel), never fused into it.

**Cost, measured (§7.4).** Five attempts are about 5 × 2^20 ≈ 5.2 M hashes, one thread as built: about 10 s on the loaded build host (mean of five runs) and about 26 s on the Pi 5. One signing search is about 2^20 derivations: about 26 s expected on the loaded Mac and **about 8 minutes on the Pi as built**, because a derivation costs 1.0 ms there against 0.09 ms on the Mac (the cause is OpenSSL's key import, §7.4). So the step is about 40 s on the build host, which is the gardener's "about 50 s AFAIR", and about **8½ minutes on the Pi as built**, or about 2½ minutes with the fast path §7.4 specifies. The walk must not promise seconds on a Pi.

**Withdrawn from 0.4.0:** the question to the gardener about showing drawn kanji (it falls away: display the first two; the full fingerprint is the proof); the field `fp-shown` (nothing needs it: every reader compares two); the "face" decoded from the key (the four kanji are the ID, `kanji_full`, from the identity salt); the five-keys search (five attempts are five identity salts and one key); and the skip of a reserved pair in the tail.

### 7.4 The signing search measured, on a Raspberry Pi 5 and on a build host (2026-10-07)

Tasai's order: measure it rather than wait. Measured by Mori-shin with the **committed code** of that day (`derive-key.mjs`, `garden.mjs` and `search-signing.mjs`), **throwaway master salts only** (random bytes made in the run, never stored, no custody touched, no kin's key), on two hosts as they actually run, neither idle. Each run used a scratch directory of its own, outside any repo. Temperature, load and the firmware's throttle flags were read at the start and end of every stage on the Pi.

- **The Pi:** a Raspberry Pi 5, a small single-board computer with four cores, on 64-bit Linux, **Node 20 with OpenSSL 3.0**, driving a full-screen browser at the same time (about one core), and warm enough that the soft temperature limit was reached during the long runs. It was first cleared of two **orphaned signing workers** from an earlier run (F3).
- **The build host ("the Mac" below):** one Apple-silicon machine with ten cores, **Node 26 with OpenSSL 3.6**, heavily loaded throughout by another search (eight workers, eight cores' worth). This is the loaded figure; an idle Mac is faster.

**Rates** (three runs of three seconds each; a process is a separate node process, so this is also what the search gets):

| per second | Mac (loaded) | Pi (browser running) |
|---|---|---|
| SHA-256 identity hash, one process | 0.45 to 0.84 M | 0.21 to 0.23 M |
| the same, all cores (10 and 4 processes) | 2.5 to 3.1 M | 0.43 to 0.45 M |
| key derivation as built, one process | 5.6 to 11.5 k | 0.86 to 0.91 k |
| the same, all cores | 31 to 37 k | 2.3 to 2.5 k |

**The five identity attempts**, one thread, the committed scan, five runs each with a different pair: **Mac 3.9 to 17.6 s (mean 10.4)**; **Pi 16.2 to 36.9 s (mean 25.7)**; 5.24 M hashes expected.

**The one 20-bit signing search**, the real `searchSigning`, a different pair and salt each run. The aggregate rate is the winning nonce over the seconds (the nonces interleave the workers, so it counts derivations):

| host, workers | runs | seconds | aggregate derivations/s |
|---|---|---|---|
| Mac, 1 | 2 | 11.9, 11.6 | 11.1 to 11.3 k |
| Mac, 8 (the default: at most 8, and cores − 1 where fewer) | 5 | 8.1, 8.5, 27, 42, 72 | 38 to 44 k |
| Mac, 10 | 3 | 18, 48, 50 | 36 to 42 k |
| **Pi, 3 (the default, cores − 1), as built** | 2 | 347; **no hit in 1,200** (stopped) | 2.1 k |
| **Pi, 4, as built** | 2 | 82, 436 | 2.1 to 2.3 k |
| Pi, 3, **fast path** (below) | 3 | 61, 89, 90 | 7.7 to 7.9 k |
| Pi, 4, **fast path** | 2 | 72, 230 | 8.7 to 8.9 k |

The seconds are a lottery: the search is an exponential wait, so its spread equals its mean (8 s to 72 s on the same Mac; 82 s to over 1,200 s on the Pi). **Estimate from the rate, not from the runs:** 2^20 ÷ rate is about **26 s on the loaded Mac**, about **8 minutes on the Pi as built** (477 s), about **2.2 minutes on the Pi with the fast path** (131 s).

**Where one derivation spends its time** (microseconds, one process, throwaway salt):

| step | Pi | Mac |
|---|---|---|
| HKDF | 14 | 4.8 |
| import the seed as a PKCS8 private key | **860** | 55 |
| make the public key | 3.8 | 0.9 |
| export it as SPKI DER | **148** | 31 |
| SHA-256 of the raw key | 3.0 | 0.7 |
| **one derivation** | **about 1,030** | **about 93** |

**Findings.**

- **F1, the cost is OpenSSL's key decoding, not the CPU.** On the Pi 83% of a derivation is the PKCS8 import and the SPKI export; the Mac's OpenSSL 3.6 does the same two steps in 86 µs against the Pi's 1,008 µs (OpenSSL 3.0). PEM import is as slow as DER (823 µs); JWK import is 63 µs. So this spec's costs hold **per node and OpenSSL, not per machine**: a faster Pi would not fix it, a newer OpenSSL would.
- **F2, a fast route exists and depends on the Node version.** Importing the bare seed as a JWK with a zero `x` (`{kty: OKP, crv: Ed25519, d, x: 0}`) gives the **same public key on 500 of 500 seeds** on Node 20 / OpenSSL 3.0, every signature made with it verifies under the true public key, and the import is 63 µs (a derivation about 85 µs, 11.7 k/s per core ideal; 7.7 to 8.9 k/s aggregate measured on the Pi). **Node 26 / OpenSSL 3.6 rejects it** (*Invalid JWK OKP key*): newer Node checks `x` against `d`. So it can be a fast path with a canonical fallback, never the only route.
- **F3, the signing search leaves its workers running if its parent dies, and they hold the master salt.** `searchSigning` reads each worker's input from stdin once and then loops to `max` (200 M derivations) with no check that the parent is alive. Found on the Pi: two workers from an earlier run, their parent gone, still running after two hours, each with over an hour of CPU, holding the machine hot and throttled. It reproduced in my own run: after the timed-out search my script's parent exited and **three workers survived it** until my reaper killed them by pid. With a real salt this is the real master salt living in a process nobody owns, for hours.
- **F4, the Pi's cores are not all free.** The browser uses about one; the aggregate rate is flat from three workers to four (2.1 to 2.3 k either way); four processes give 2.0 to 2.8 times one; three or four busy cores reach the soft temperature limit within minutes. The default of `cores − 1` workers is right in intent (it leaves the machine usable) and says nothing about whether a core is really free.
- **F5, nothing tells the gardener how long it will take.** The Pi's range is 82 s to over twenty minutes for the same search.

**Requirements, on the build (`search-signing.mjs` and `keys.mjs` are Baisai's; the fast path is `derive-key.mjs`, mine).**

- **R1, a worker dies with its parent.** Each worker checks its parent (`process.ppid` against the one it started under, every few thousand derivations, about a second) and exits when it changed; the parent also keeps an IPC channel and the worker exits on `disconnect`. **The test kills the parent with SIGKILL while the workers are running and watches every worker gone within five seconds; it is watched to fail first against the committed `search-signing.mjs`, which leaves them.**
- **R2, a wall-clock cap and an honest estimate.** The search takes a cap (a default of three times the expected time from a measured rate, never open-ended; `max` stays as a second bound) and the parent ends the workers itself when it passes. `identity` first measures one process's derivation rate for two seconds and prints the expected time before it starts, in the walk's words: a few minutes on this machine, a lottery that can take twice as long. It prints elapsed time at intervals. It never claims seconds it has not measured.
- **R3, the fast path, if it is built, has three conditions.** It is used **only by the signing-salt search**, never by sealing, never by the gate's parity test; a startup check of 64 random seeds must find the public key identical to the canonical route's, or the canonical route runs the whole search; and **the winning hit is re-derived by the canonical route and compared before it is believed**, so a fast path that were wrong could only miss, never mint a wrong lock. It touches the signing foundation, so it goes to Fuji-shin with the gate's parity test and to the gardener for his yes. **Offered, not built.** Its worth on the Pi: about 8 minutes to about 2.2.
- **R4, the walk promises no seconds on a Pi.** Stage 6's words say a few minutes, and the estimate in R2 says how many on that machine.
- **R5, acceptance on the Pi** (§13): the search's printed estimate is within a factor of two of the mean of several runs, and no worker survives its parent.

## 8 · Derive and seed

`derive <slug>` writes `agents/<slug>/identity/<slug>-public-key.bin` (32 bytes) and `<slug>-fingerprint.txt` into the pot, the layout `loadPublicKey` already reads. `seed` writes `agents/registry.json` in the pot, sealed by the root key, in this order: the root (`type: garden`, `shintai: none`, `fp-attests: 0`), the gardener, Bonsai (`type: seed`, `origin: true`), `bonsai-shin` (`parent: bonsai`), the one shin. Each entry carries `slug`, `path`, `type`, `fingerprint`, `fp-attests`, and those derived here `custody-tier`. Only `bonsai-shin` carries `parent`, being the one entry divided from a kin; a companion's anchor is the rite's matter, not the seed's. The pot's `locked-salts.json` holds salts, which are public (our own public half publishes signing salts); the only secret in a garden is the master salt, and it is in custody.

### 8.1 Bonsai's entry: the file supplies, the origin confirms

Bonsai's entry is an input, the origin's published key: `agents/bonsai/identity/bonsai-seed-entry.json` in core (`bonsai-garden-seed-entry/1`: slug, kanji, public key, fingerprint, `fp-attests`), shipped by Bonsai with a v2 sidecar sealed owner by his key. `seed --bonsai-entry <file>` reads it. **Ruled 2026-10-07, on Bonsai's question: `seed` does not trust the file; it asks bon-sai.garden before it writes.**

- The file's own check stays: a 32-byte key whose SHA-256 prefix is the fingerprint it states. That proves the file agrees with itself, which anyone can make true of a file with their own key and the slug `bonsai`.
- Then the file's sidecar goes to `/verify` through `published-keys.mjs` (`adjudicatePublishedV2`). `seed` proceeds only on a signed answer that vouches for signer `bonsai`, role owner, the file's exact bytes, and names the fingerprint the file states. The site holds the origin's keys and core carries none (`references/trust-anchor.md`); a key that travels with the tool proves only that the package agrees with itself.
- Refused (2): rejected, forged, unsigned or malformed answers, a fingerprint that differs, a sidecar missing or not owner. Halted (3): no answer. No cache, no offline mode, no `--trust-file`: the 2026-09-24 ruling holds here as everywhere a stranger is asked to believe one of our keys.
- What is written into the pot records it: Bonsai's registry entry gains `vouched: <ISO time>` of the answer; the root's seal over the registry covers it.
- The seal's `target` is shown and is not a verdict (F-12). The signer pin, the owner role, the entry's format and the fingerprint the site names carry the identity. Where a release manifest is present, the entry's place is the manifest's to say, as in §6.4.

A wrong Bonsai key in a stranger's pot is the one key there the stranger did not make. Every later word from the origin, the bunshin attestation above all, would be checked against it. That is why this step asks.

**It stays a question of its own, per file** (ruled 2026-10-21, on the proposal to let a vouched release manifest stand in for it, as it now does for the reserved set). A writer's seal on a manifest vouches the set as it was cut. It does not vouch that the key in this file is Bonsai's now. This question asks the origin for Bonsai's own published key, with the signer pinned to `bonsai` and the answer naming the fingerprint. One answer gives authorship and currency. It is also the origin's one switch over the one key a stranger's pot binds for good. Behind a manifest, a writer's key could put another key in Bonsai's place. And after a re-key of Bonsai, every older cut whose writer's key is still sound would go on writing the old key into new pots, with `vouched` beside it.

**Said openly: this question is also how the origin counts plantings.** The gardener's ruling of 2026-10-21 keeps it as an openly stated count of the plantings that reach `seed`. The site sees one request carrying Bonsai's seal (a public file), at a time, from the planting's network address. It sees nothing of the garden, which the request does not carry. The walk says so before `seed` asks.

Should the question ever move behind a manifest, it would need all of these: **W1**, the site can withdraw one seal by its id with a signed `withdrawn` answer that the reader refuses, so a release carrying a superseded entry can be stopped without revoking its writer's key; **W2**, the release writer's duty of §6.4 point 6 for this file; **W3**, the writers pinned as in §6.4 point 3a; **W4**, the registry records the path (`vouched-via: <seal-id> <signer>` beside `vouched`). The alternative is one request carrying both seals, the manifest's and Bonsai's own, answered once (a site change). Either way the gardener's word on counting comes first, and that word, for now, is that the question stays.

## 9 · Recovery

The Aruji's second decision: *"100%."* Required, by the gardener's hand, never a copy we hold.

- **`recover export`**: the 32 bytes wrapped with a passphrase the gardener types twice at a hidden prompt (raw mode set before the prompt is written; scrypt, N=2^17, r=8, p=1; AES-256-GCM, the garden ULID bound into the additional data), written once to `<name>-master-salt.sealed`, a small JSON with `v`, `garden`, `kdf` parameters, `nonce`, `ct`, `tag`, `root-fingerprint`, and a `signature` by the root key over the canonical rest, domain `bonsai-garden-recovery-export/1`. **Not a sidecar:** a v2 sidecar needs a seal root, and the export's whole point is to live off the machine and out of the pot; inline, it travels as one file and its provenance is still checkable. The verb refuses to overwrite, refuses a passphrase under 12 characters, and refuses an out path inside the pot by any spelling (compared by device and inode up the out's real path, not by string: Fuji-shin's 35 APFS attacks). Where the gardener keeps it (1Password as a document, a USB key, printed base64) is theirs; the walk says so.
- **`recover drill`**: refuses an export whose garden, root or signature does not hold; decrypts in memory, derives the root key, compares to `garden.json`, prints `ok`, zeroes, and writes `recovery-drilled`. Runs right after `export`, before `namespace`, and refuses to let the arc continue on anything but `ok`.
- **`recover restore`**: on a new or wiped host, the same refusals as the drill, then `put` into custody under the garden's item (refusing an existing one), then the drill.

The fallback custody file of §3.3 is this envelope with a fixed location; one format, one reader, two uses.

## 10 · The custody tier, recorded, and the call home

Bonsai's reading of the fifth decision: *the tier is written into every attestation and shown by verify.* Three places, from declared to signed:

1. `garden.json: custody-tier` and `lab-preview` (declared, sealed by the root key).
2. The registry entry's `custody-tier` (declared, sealed with the registry).
3. **Each seal**, signed: `bonsaisig/2` gains an optional field `custody`, one of the tier names, placed after `algorithm` in the envelope. The canonical payload already signs every field present, so the tier cannot be rewritten after the fact. Absent means *not declared*, which is what every seal before this spec is; the verifiers show it as such and the signer's field-order test learns the optional slot. A policy line, `"custody-fallback": "warn" | "refuse"`, in `seal-policy.json`, lets the gardener refuse fallback-tier seals once the lab preview ends. **This is a format change under my hand** (Tier 2 in my own tiers: a new field in the signed envelope). The Aruji's decision is the authorization; the first run shows it in both languages before it is written anywhere but core's verifier and `sign.py`.

**The call home** (`attest`): **one envelope, three signatures.** Ruled by the gardener, 2026-10-07: *"we need an envelope: garden-id, bonsai-shin-id, gardener-id, and three signatures."* It replaces 0.2.0's form (a seal by the guardian and a root countersign in a second file); the countersign file is retired before it shipped.

```json
{
  "format": "bonsai-garden-attestation/1",
  "body": {
    "garden":   { "id": "<ULID>", "namespace": "〇〇庭", "root-fingerprint": "<32 hex>", "root-public-key": "<base64>" },
    "guardian": { "id": "<four kanji>", "fingerprint": "<32 hex>", "public-key": "<base64>", "fp-attests": 2, "parent": "<Bonsai's fingerprint, as the pot's registry holds it>", "picked": "gardener | default" },
    "gardener": { "id": "<four kanji>", "fingerprint": "<32 hex>", "public-key": "<base64>", "fp-attests": 2 },
    "shin":     [ { "id": "<four kanji>", "fingerprint": "<32 hex>", "public-key": "<base64>", "fp-attests": 2 } ],
    "custody-tier": "<tier>", "lab-preview": false, "rite": "bunshin", "created": "YYYY-MM-DD"
  },
  "signatures": [
    { "by": "root",     "fingerprint": "...", "signature": "<base64>" },
    { "by": "guardian", "fingerprint": "...", "signature": "<base64>" },
    { "by": "gardener", "fingerprint": "...", "signature": "<base64>" }
  ]
}
```

Each signature is Ed25519 over the same bytes: the domain `bonsai-garden-attestation/1`, a newline, and the canonical `body`. They are parallel, not chained; any one can be checked alone. Inline, like the recovery export (§9): the envelope travels as one file, and `bonsaisig/2` keeps one signer per sidecar.

**No names in the envelope** (ruled 2026-10-21, on the gardener's *"I'd also like us to drop names from the attestation in 0.9.2-rc"*):

- **No `name` and no `slug`**, on the garden or on any entity. The body's keys say the role (`garden`, `guardian`, `gardener`, `shin`); the public key says who. `attest` refuses to write a body that carries either. The envelope's reader refuses one too, as `names-in-body`, so an envelope made by another tool is held to the same rule.
- **`parent` names Bonsai by his fingerprint**, the one the pot's registry holds for him as vouched at `seed` (§8.1), and not by his slug. Bonsai's reply is checked against that key.
- **Every entity carries its `public-key`**, each shin included. Each `fingerprint` must equal the first 32 hex of the SHA-256 of its key, or the envelope fails. A shin signs nothing here. Its key is in the body on the root's word, so a log can check that shin's later seals. It is not proof that the shin holds the key.
- **Each signature is checked with the key of its role in the body**, and `signatures[].fingerprint` must equal that role's fingerprint.

**The shin: none, one or several** (ruled 2026-10-21, on Baisai's finding that the envelope named one shin while a garden may have none or several):

- **`shin` is always present, and always an array.** `[]` is a garden with no shin. There is one form for each fact: an absent `shin` and an empty one would be two bodies, so two sets of signed bytes, for one garden. The role word stays `shin`, the one `signatures[].by` and the rest of this spec use; the value says how many.
- **Each entry has exactly `id`, `fingerprint`, `public-key` and `fp-attests`.** No `parent`: a garden's shin are attested by the root as this garden's, and a bunshin bond is its own attestation, never a field here.
- **The entries are ordered by `fingerprint`,** ascending lowercase hex, so one set of shin makes one body whatever order `garden.json` lists them in. `canonicalJson` sorts an object's keys, never an array's elements, so the order is the writer's duty and the reader's check.
- **The shin signs nothing.** No signature has `by: "shin"`; only `root`, `guardian` and `gardener` sign, each exactly once.

What the reader refuses, each named:

| reason | the body or the envelope |
|---|---|
| `shape` | `shin` absent, or not an array; an entry that is not an object, lacks one of its four keys, or carries any other key |
| `names-in-body` | a `name` or `slug` key at any depth, a shin entry included (as above) |
| `fingerprint` | an entry's `fingerprint` that is not the first 32 hex of the SHA-256 of its `public-key` |
| `fp-attests` | for the guardian, the gardener and each shin: the first two kanji the fingerprint renders (the mark engine, the shipped set) are not the `id`'s first two |
| `shin-order` | the entries not in ascending `fingerprint` order |
| `key-reuse` | one public key, or one fingerprint, in two places in the body: two shin, or a shin and the root, the guardian or the gardener. One key in two roles would let one signature stand for both |
| `id-reuse` | two entities of the body with the same four-kanji `id` |
| `signature-role` | a signature whose `by` is not `root`, `guardian` or `gardener` (a `shin` signature included), or one of the three missing or twice |

`attest` refuses to write any body the reader would refuse, so a refusal names a body made by another tool.
- **What this delivers, said plainly.** The envelope carries no name. It does not make the names unrecoverable. The namespace is `SHA-256("<romaji>#<n>")` and each ID is `SHA-256("<slug>@<romaji>-id#<n>")`. Both searches take the first hit, so someone holding a list of names can test each one against the kanji, about 20 bits a name, and a common name falls. The namespace and the IDs are claims the envelope cannot prove and a list of names can test. That stays so: the salts keep their names, closed by the gardener's word (below).
- **Only the envelope.** The passport keeps its names, by the gardener's word of 2026-10-21: *"passports travel with agents/kin - names are fine here (see real world)."*

What each signature attests:

- **The root** (the garden's own key): *these keys are this garden's; they derive from its salt.* The garden's word.
- **The guardian** (`bonsai-shin`): *I am this garden's guardian, and only this garden's.* Their own key binds them to this one garden, so no other garden can claim them.
- **The gardener**: *I invited this guardian into my garden.* The person's consent, by his hand.

The fourth signature is not in the envelope: **Bonsai's reply**, the bunshin attestation of `bunshin-rite-spec.md` §3, signed by the origin's key over the envelope's hash, says *this guardian is divided from me*. It comes back afterwards; nothing enters the new garden by it.

**The gardener's signature is his own hand, never automatic.** In custody terms it costs nothing new and proves nothing new as cryptography: his key derives from the same master salt, in the same custody, on the same machine as the root's and the guardian's, so a tool that signed for him would add a third signature from one secret and one hand, which is no consent at all. What it adds is the act, so the act is guarded:

- `attest` writes the envelope with the root's and the guardian's signatures and says *awaiting the gardener*. It never signs as the gardener, and no flag or environment variable makes it.
- `attest consent` is the only path to his signature. It refuses without an interactive terminal on stdin and stdout (a seat's shell is not one, so Bonsai cannot run it for him), shows the body in plain words (garden, guardian's pair, his own pair, custody tier), and signs only after he types the guardian's pair back. Where a gate holds the salt, it is a person's key and needs presence (Touch ID on a Mac that has it); on a host without one, the typed confirmation is the presence there is.
- Said plainly: a typed confirmation proves that someone at that terminal chose, not which person. A person key in its own custody (hardware, a passkey) would prove more and cost a second secret and its own recovery; open, not this arc.
- `attest` refuses to send an envelope that lacks any of the three.

**In a lab preview,** the policy default `custody-fallback: refuse` reads every fallback-tier seal as `custody-refused`. That is the truth and the walk says so; the gardener may set `warn` by hand, one line in `skills/bonsai-garden-sign/seal-policy.json` as its own note says, and sets it back when the preview ends. The tool never flips it. (That edit is to core's file, so an installed package fails its integrity line after it: right for a preview, wrong for a stranger. Whether a pot carries its own policy is open, below.)

The transport is one way and is **open** (provisioning spec §5); this spec fixes only the envelope, and the one property of where it lands below.

**Nobody can list the gardens.** Ruled by the gardener, 2026-10-21: *"A stranger should NOT be able to query the full list of all known gardens - pls confirm!"* Confirmed. It corrects the morning's wording of the planned log as "append-only, anyone can copy". It is the rule `/verify` already keeps, one seal at a time and no roster, and the rule of 2026-05-26 that took roster files off the public surface. Whatever receives the envelopes keeps them as **key transparency without enumeration**, in the CONIKS and AKD style. This is my design, confirming Baisai's shape and making five parts of it exact:

1. **Only a signed summary is published.** The tree head is a root hash and an epoch, signed by a key the client pins as it pins `/verify`'s and kept apart from the master salt. Each head names the hash of the one before it, so a split view, one log for one asker and another for the next, shows as a broken chain. Heads may be mirrored by anyone. **A head carries no count of entries**: how many gardens there are is the origin's to know (§8.1's count), not the public's.
2. **One entry is answered to one who already holds its fingerprint.** A question names a fingerprint, the root's or the guardian's. The answer is that entry with its proof of inclusion under a published head, or a proof of absence. A fingerprint is 128 bits, so it is learned from a garden's own seals, never guessed.
3. **An entry's place in the tree comes from a VRF of the fingerprint**, a verifiable random function the origin holds the key to, never from a plain hash. With a plain hash, the neighbours that proofs reveal would let a collector test fingerprints they hold against what they gathered, offline, and watch the tree grow. With a VRF, every question of membership goes through the origin, one at a time.
4. **Each leaf is a commitment with its own random nonce**, so the sibling hashes a proof carries say nothing about the entries beside it.
5. **Nothing lists.** No endpoint pages, exports, searches by prefix or returns more than the one entry asked for. Only heads are mirrored; entries are never published as a set. Rate limits are not the defence; the key space and the VRF are.

What this leaves, said plainly. The log is append-only, so an entry stays once it is in. It carries no names (above), only keys, IDs and the namespace. A garden's own tool checks its entry under each new head, its own monitor. Nothing of this is built and nothing has been sent: `cmdAttest`'s transport is unwired.

## 11 · `--keys pot`

`loadPublicKey(root, slug)` already resolves a key from any root that holds `agents/registry.json` and the `identity/` layout. A pot built by §8 is such a root. So `--keys pot` is `--keys garden` with the pot named: `--keys pot --pot <path>`, and the verifier never discovers the pot by walking up from its own file (provisioning spec §2's second consequence). The published anchor stays the default and fails loudly when a garden has no `/verify`; the message names `--keys pot` as the local check. Node first; `sign.py` follows or retires.

## 12 · The skills, their verbs, and the two faces

Ruled on the first build, 2026-10-07: the placement Baisai built stands.

- **`bonsai-garden-sign`** keeps what signing needs: derivation, the seal envelope and its `custody` field, the verifiers, the read-only provider interface and the tier vocabulary (`vault-cli` added). It gains `--garden <ulid>` for reading a garden-scoped item when it signs (mine, below).
- **`bonsai-garden-keys`** (new, core, Baisai's, mark 根技 proposed) holds the arc: `mint`, `custody put/status`, `recover export | drill | restore` (`lib/custody.mjs`, `lib/envelope.mjs`), the signing search (`lib/search-signing.mjs`, it needs the master salt), the call-home transport (an interface that sends nothing until §10's transport is ruled), and `bin/keys.mjs` with the verbs in §2's order (with `identity bonsai-shin --candidates | --pick` and `attest consent`) and a `status` verb that prints where the arc stands from the pot's files alone. It imports sign; sign never imports it. One `SKILL.md`, the integrity line first, activatable by `/bonsai-garden-keys` in a seat and by `node skills/bonsai-garden-keys/bin/keys.mjs <verb>` by a gardener alone.
- **`bonsai-garden-mark`** gains `namespace.mjs` (`namespace`, `identity`, `check-locks`; no secret, writes nothing) and `reserved-marks.mjs` with the shipped `reserved-marks.json` (§6.3 to §6.5). `check-set.mjs` gains `--locks` and `--reserved` as delegations, mine.
- **One master per custody backend.** When sign learns `--garden`, the garden-scoped backends (get, put, status) move into sign's `custody/`, one file per platform, replacing the stubs, and keys imports them; keys keeps the choice of tier and the floor. Until then sign's `custody/linux-secret-service.mjs` stays what it is, a stub that reads nothing and throws, so it cannot disagree with keys' reader; it is a placeholder, not a second master. The move is due before the first `sign.mjs` seal on a Linux host.
- **The gate** (`bonsai-gate`, runtime) learns `--garden <ulid>`: the Keychain lookup keyed by the scheme in §3.1, legacy for our ULID only. A rebuilt gate is a new code signature, so the Aruji re-approves its Keychain access once.

The same binary, the same exit codes, the same sentences, whichever face runs it. A test runs each verb twice, once from a seat and once from a bare shell, and diffs the output.

## 13 · Acceptance, watched to fail first

Bonsai's list, and mine:

- A seal round-trips against the new garden's key, not Bonsai's; a derived pot's fingerprint chains to its garden's salt and namespace.
- A clean machine with core and runtime only: every step by the gardener's hand.
- One host, two gardens side by side: neither reads the other's item; the legacy item is byte-identical before and after.
- `mint` over an existing item: refused, nothing written. `mint` on *cannot tell*: halt. `mint` on a fallback-only host without `--lab-preview`: refused with the floor named. With the flag: proceeds, and `custody: software-fallback` is in the first seal.
- `put` whose read-back differs: a custody fault, nothing deleted.
- A read-only pot: `mint` refuses before custody. An interrupted mint: refused and named, the item untouched, `export` refused, `--lab-preview` no way round (§4.1).
- A namespace or a pair matching the reserved rule: refused. A pair with 盆 first and a second outside B (盆光), for any entity and not only the guardian: refused, the reason named, watched to fail before the constant is in (§6.1). A hand-edited lock: `check-locks` fails. The reserved set's table of planted refusals (§6.5), each watched to fail.
- `seed` with a Bonsai entry whose key is not the origin's (a self-consistent file with another key), a stubbed rejected, forged or unsigned answer: refused; no answer: halt; a vouched entry: written, with `vouched` (§8.1).
- No custody `status` can prompt: a backend whose status call would raise a dialog fails its own test.
- The guardian's draw: the same five for the same garden name, twice; none matches the rule, none is 盆-first, none is taken or the namespace's own; `--pair` for `bonsai-shin` refused; a pick of 0 or 6 refused; no pick records `default`.
- The reserved set through the release manifest: §6.4's table, each row watched to fail first. One planting asks the site once for the set and once for Bonsai's entry.
- The envelope's names (§10): a body with `name` or with `slug` on any entity is refused by `attest` and read as `names-in-body` by the reader. A planted romaji name and a planted slug are found nowhere in the body's bytes (grepped, as §3.5 greps for the salt). An entity without `public-key`, or whose `fingerprint` is not its key's, fails. A signature whose `fingerprint` is not its role's fails. `parent` that is not the registry's fingerprint for Bonsai fails.
- The envelope's shin (§10): a garden with none writes `shin: []`, and the reader takes it; one shin and three shin each make a body the reader takes, and the same three in another `garden.json` order make the same bytes. Each row of §10's table is planted and fails by its name: `shin` absent, an object instead of an array, an entry with a fifth key or a `parent`, two entries out of order, one key in two entries, a shin key equal to the guardian's, two entities with one `id`, a fingerprint whose first two kanji are not its `id`'s, a signature `by: "shin"`. A `garden.json` with both `shin` and `shins` is refused; one with only a `shin` string reads as one.
- The envelope: each of the three signatures removed, altered or made by the wrong key fails on its own; a body changed after signing fails all three; `attest` alone never yields the gardener's signature; `attest consent` without a terminal refuses; an envelope with two signatures is not sent.
- A stale seal under `--keys pot`: `hash-mismatch`. An unknown signer: `unknown-signer`, never `ok`.
- The drill with a wrong passphrase: fails, says so, nothing written. The drill after `restore`: `ok`.
- The secret never appears in any output, log or file (§3.5).
- On the Pi: `detect` prints the backends it found and the one it would use; the suite runs there before the walk does.
- The signing search's workers die with their parent: the parent is killed with SIGKILL mid-search and every worker is gone within five seconds; watched to fail first against the committed `search-signing.mjs` (R1, §7.4).
- The search has a wall-clock cap and `identity` prints a measured estimate before it starts; on the Pi the estimate is within a factor of two of the mean of several runs (R2, R5, §7.4).

Every refusal is tested by planting the condition, not by reading the code that is supposed to refuse it.

## 14 · What exists and is not built twice

`lib/derive-key.mjs` (derivation) · `lib/custody-provider.mjs` and `custody/macos-keychain.mjs` (the reader and the tier vocabulary) · `bonsai-gate` (the only thing that reads the salt on this host) · `tools/keyring/locked-salts.json` (the lock shape) · `skills/bonsai-garden-mark/engine.js`, `check-set.mjs` · `lib/garden-root.mjs: loadPublicKey` (the `--keys pot` resolver) · `lib/seal-v2.mjs` (the envelope) · `lib/published-keys.mjs` (the only way a stranger's tool believes one of our keys: the release manifest's seal, or without one the reserved set's own; Bonsai's entry) · `lib/ulid-rule.mjs` and `ulid.py` (the only ways an id is made) · the recovery envelope doubles as the fallback custody file. (`reserved-hashes-public.json` is no longer a source here: set A comes from the roster and the skill identity files, §6.2.)

## Open

- **Baisai, from §7.4:** R1 (a worker dies with its parent, with the kill-the-parent test) and R2 (a cap and an honest estimate) in `search-signing.mjs` and `keys.mjs`. **Mine, offered and not built:** R3, the fast path in `derive-key.mjs`, which needs Fuji-shin's round and the gardener's yes.

- **The Aruji:** re-provisioning our own salt under the item scheme (§3.1); the transport of the call home (§10; that nobody can list the gardens is ruled, 2026-10-21); when the lab preview ends and `--lab-preview` leaves the binary (§3.4). (The floor: ruled, §3.4.)
- (A new garden's `bonsai-shin` and its mark: ruled by the gardener 2026-10-07, §7.1. Whether the rite draws one of the pair's two from the garden's first kanji, at no extra cost, is his to take or leave.)
- **Owners who must update, by pointer and not by an edit of their history** (§7.1 supersedes both forms of the new guardian's kanji): `bunshin-rite-spec.md` §1, lines 53 and 68 (盆才身, and the attestation field `child_pubkey_sha256_kanji: 盆才身`), `tended-by: workshop`, a placeholder its own note says stands for Bonsai; Tasai named Hissai as holder of rite lore, so the owner is confirmed before anyone edits. `spec-canonical-shintai-structure.md` line 222 (盆才守), `tended-by: baisai`. The rite's statement line may keep naming the parent 盆才守神, his name, which is true.
- **The verifier page** (Chisai's five lines; site, Eisai's and mine): the pair with its namespace, two lines never merged, *lineage: not attested* when it is not, the slug always qualified, *look-alike* without exception. Nothing of it is built.
- **A person key in its own custody** for the gardener's signature (§10): stronger presence, a second secret, its own recovery. Not this arc.
- (The reserved set: ruled as a rule, §6.2; the four companions are in set A; the reader's floor and pin, §6.4.)
- **Bonsai's order:** the words of the floor refusal at stage 6, and of the interrupted-mint refusal (§4.1). (The root key's slug: ruled, §5.3.)
- **Eisai, optional:** the headless mark renderer (the gap list), so a planting can draw the mark on the gardener's host. **The Aruji, 2026-10-06: rendering the seal as a kanji identicon is optional, not a blocker.** A mark is verified from its indices before it is ever drawn; a planting that cannot draw it still completes, and says the mark is unrendered.
- **Baisai:** Windows DPAPI stays a stub through this arc; `seal-staged` garden-neutral (the gap list).
- **Baisai, for 0.9.2-rc** (Fuji-shin rounds): §6.4 points 3 to 6, red first against the table there. That covers the release writers' list in core, the reader's signer pin to `mori-shin` where no manifest is present, the `target` refusal out of the reserved reader, the `release` record, and the release builder's duty. Also `attest` brought to §10's envelope, with no names and every public key in (`cmdAttest` still writes the retired 0.2.0 form). The transport stays unwired.
- (Name-free salts, so that the namespace and the IDs would stop being claims a list of names can test (§10): **closed by the gardener's word, 2026-10-21**: *"I think that's ok. I would not want new salts."* The salt strings keep the romaji and the slug; §10 says what that leaves.)
- **The site, Eisai's and mine, only if §8.1's question ever moves:** a signed `withdrawn` answer for one seal id (W1), or one request for two seals.
- **Bonsai's order:** the walk's sentence, before `seed` asks, that the question is also the origin's count of plantings (§8.1).
- **Baisai, for the shipped reserved set (done):** `reserved-marks.mjs` (generate, check), the reader's pin (§6.4), `--exclude` out of the CLIs, the origin garden's hook line, the tests of §6.5; Fuji-shin verifies. **Baisai, for the keys skills:** `seed` asks `/verify` (§8.1); the custody backends into sign's `custody/` with sign's `--garden` (§12).
- **Baisai, after Fuji-shin's round:** the 盆-first constant in `namespace.mjs` and `keys.mjs` with its test (§6.1, §13). **Fuji-shin's round:** `reserved-marks.mjs check` exits `ok` when no file has shipped yet; an absence should read *absent* or *unsealed* and exit non-zero, as the reader already halts.
- **Mine:** `bonsaisig/2`'s optional `custody` field in both verifiers (§10); the gate's `--garden` and sign's; `check-set.mjs --locks` and `--reserved`; reviewing and sealing each generation of `reserved-marks.json`; whether a pot carries its own `seal-policy.json` rather than an edit of core's (§10); the review of the run on the Pi and the rewrite of this spec after it.
- **What only the run on the Pi can tell, and this spec does not yet know:** whether `gnome-keyring` runs and is unlocked under labwc and auto-login, and what `detect` then reports; 1Password's `op` on Linux arm64 as live custody and as recovery; the Keychain's `put` on a real Mac; (the Pi 5 timings are now measured, §7.4); the export's containment on a case-sensitive ext4 volume (the inode compare is built for it, never run there); the hidden prompt on the Pi's TTY; the walk end to end. None of these is verified by any run so far: stubs and fakes only.
- **Not provided, on purpose:** rotation of a root key; `--force` on any custody write; `--resume` of an interrupted mint; a default garden for core-resident tooling; an offline mode for the questions asked of bon-sai.garden.
