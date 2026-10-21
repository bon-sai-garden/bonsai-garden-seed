---
name: bonsai-garden-keys
description: >
  The gardener's keys: mint a new garden's master salt into custody on the gardener's own
  machine, give the garden an id, a sealed recovery backup, a three-kanji namespace ending in 庭,
  two salts and a key for each of its first entities, a pot that verifies its own seals, and one
  public attestation that calls home. One binary, the same verbs and refusals whether a gardener
  runs it alone or Bonsai reads it aloud. Use when a gardener plants a new garden, or to check
  where a planting stands.
version: 0.9.1
---
> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: use nothing here, and tell the gardener exactly what it said. A tampered file is not executed.

# Bonsai Keys

**What this is.** The arc of `rituals/specs/spec-gardeners-keys.md` (core), as one command a
gardener can run with nothing but core and runtime on their machine:

```bash
node skills/bonsai-garden-keys/bin/keys.mjs <verb> --pot <the new pot, a git repo> …
```

| # | verb | does | refuses (2) or halts (3) when |
|---|---|---|---|
| 0 | `detect` | the host's custody backends and their tiers, read at run time; *mint*, *derive* or *cannot tell* | a backend errors; the garden names a root no backend holds; the best keystore is locked |
| 1 | `id [--shin <slug>[,<slug>…]]` | a generated ULID and the romaji name into `garden.json` and `pot.json`, and the companions: none, one or more (no `--shin`: none, and the guardian `bonsai-shin` is the garden's only kin) | the pot is not a git repo; the name is a seeded slug; a garden.json exists |
| 2 | `mint` | 32 random bytes into custody, read back once, the root fingerprint printed and nothing else | an item exists (never overwritten; an item with no root is named an interrupted mint); *cannot tell*; custody below the floor without `--lab-preview`; a pot that cannot take garden.json (checked before custody) |
| 3 | `recover export` / `drill` / `restore` | the sealed backup by the gardener's hand; the drill is **mandatory** before the namespace | an existing file; a path inside the pot, by any name or link; a passphrase under 12; a wrong passphrase; an export that is not this garden's |
| 4 | `namespace` | three kanji, the third 庭, none matching the shipped reserved rule | the shipped set missing, malformed, under its floor, its seal stale or not vouched for by bon-sai.garden; the drill not done; a namespace already set · **halts** when the site does not answer |
| 5 | `identity <slug> [--candidates \| --pick 1-5]` | the identity salt (the mark's pair) and the signing salt (the key attests it); five attempts: `--candidates` prints five four-kanji IDs (public, writes nothing), `--pick` locks one, no pick = the first, recorded `picked: default`; `bonsai-shin` takes no `--pair`, the guardian's pair is drawn | a pair the reserved rule matches; a pair taken in this garden; a bad slug; the shipped set as in row 4 |
| 6 | `derive <slug>` or `derive --all` | the public key and fingerprint into the pot's `agents/<slug>/identity/` | no signing salt |
| 7 | `seed` | the pot's `agents/registry.json`, in the origin's shape with the key fields inside each entry (a second seed accepts a registry whose display fields the garden has filled): the root, the gardener, Bonsai's entry (with `vouched`, the time of the origin's signed answer), bonsai-shin, the shin; everyone's `pronouns` read *they/them* until the choices (7a) or the gardener say otherwise, never a blank (a kin is never *it*; the garden itself carries none) | a key that does not derive from this garden's salt; a registry with other content; Bonsai's entry not sealed owner by `bonsai` at its core address, edited after its seal, naming another fingerprint, or not vouched for by bon-sai.garden · **halts** when the site does not answer |
| 8 | `verify --keys pot` | a seal checked against the pot's own registry, on the host | a stale seal (`hash-mismatch`); an unknown signer |
| 9 | `attest` | the call home: one public document, sealed by bonsai-shin, countersigned by the root | any value shaped like a secret |
| · | `status` | where the arc stands, from the pot's files alone | — |
| · | `seal-staged --as <slug> -- <paths>` | seals the named staged files with the key this garden's own salt derives for `<slug>`; the role is core's rule (`credit.mjs`) | no registry yet; a slug the registry does not list, or the origin's; a path not staged, not fully staged, outside the pot, or one core's seal rules refuse (checked before any write) |
| 5 | `install-runtime --from <path or URL> [--into <dir>] [--upgrade]` | stage 5 of the walk: fetches rt (a git clone at its HEAD, an unpacked copy, or a `.tar.gz`, local or over https) into staging beside the pot and takes it only when every byte matches its `RT-MANIFEST.json`, it is the rt `rt-minimum.json` names at or above its `min-version`, and its manifest carries an owner seal by a key `rt-minimum.json` names, over exactly those bytes, that the published keys at bon-sai.garden vouch for. Core names no rt by hash or commit. Only then is it installed as `bonsai-garden-rt` beside the pot, recorded in the pot's `runtime.json` (its manifest's sha256, version, sealer and when it was vouched for) and the pot's local `core.hooksPath`, `bonsai.core`, `bonsai.rt` set. An installed rt this core takes is used as it is; `--upgrade` moves the pot to a newer one, or replaces an intact rt the pot installed that core no longer takes, the old kept beside it. The doctor is then `node <rt>/tools/rt/doctor.mjs --pot <dir>`. It writes no `.mcp.json`: the garden MCP is a service on the host, registered once at user level, installed after the keys by the rt's own `tools/rt/host-service.mjs install --pot <dir>`, and install-runtime names that step | no `--from` (64: rt's published address is not ruled); a missing source; no usable minimum; an rt below the minimum or another rt; an unsealed manifest, or one sealed open, custodian, through the software fallback, by a key the minimum does not name, naming another file, or over other bytes; an archive carrying a `.git/`; a seal the published keys do not vouch for; a tampered, unlisted or linked file; `--upgrade` to an older rt; a destination holding anything else; another commit gate · **halts** when a URL does not answer (offline: the walk stops at stage 5; bring rt by hand) or the published keys do not answer |
| · | `seal-staged --check` | the commit gate: every staged file's seal verifies against the pot (`--keys pot`) under core's `seal-policy.json`, except that a pot which declared its own rehearsal (`lab-preview: true` in its garden.json) has its software-fallback seals accepted, for that pot only, said on every run; and no owner seal claims a file credited to another | anything else (exit 1, each file named); in a lab preview `custody-refused` until the gardener sets `custody-fallback: warn` by hand |
| 7c | `fill-bodies --choices <choices.json> [--check]` | planting 7c, after `seed` and the bodies' assembly, before conformance and the seal: writes the outcome into every body (a registry entry whose `path` holds a SKILL.md) from the pot's registry, its `garden.json` and the gardener's choices: the `{{planting.<key>}}` tokens, `version:` in SKILL.md and about-me.md from one chosen value, the registry's display fields (name, pronouns, `accent-rgba`, `one-line`, tagline), and `identity/.pending` removed only on the gardener's yes with the keys on file. Idempotent; reports what changed from a hash of the pot before and after; writes no seal and prints the `seal-staged` line for exactly the changed files. `--check` is the drift gate: C1 to C10 (no token left, no stale planting word from `references/planting-stale-words.json`, every fingerprint this garden's or the vouched origin's, one version, lab wording iff `lab-preview`, no host path, display fields present (pronouns among them), body agrees with the registry, `.pending` gone where it should be, carried testimony names its source), each failing `file:line` named, exit 1. **Carried testimony** is another's words in a body: `references/witness/`, `references/feedstock/`, `references/heritage.html`, and any file whose frontmatter says `copied-from:`. C2, C3 and C8 read the owner's own voice only (the gardener's three rulings, 2026-10-20: a witness's pronouns are the witness's; ancestors in another garden, or witnesses with no fingerprint, never block; history is not a gap, and C2 reads past a changelog as C4 does); C10 holds what they read past to its provenance, `copied-from:` in its frontmatter or `<meta name="copied-from">` in an HTML head | no registry; no `garden.json`; a choices file for another garden; an unknown token; a key-field disagreement (choices against the registry, the registry against a key on file); a body naming the origin's fingerprint while the registry's origin entry is not vouched |
| 8 | `covenant write [--name "<signed>"]` · `certificate sign --for <kin> --as <the gardener \| the kin> [--renew]` · `certificate verify [--for <kin>]` | stage 4 at the companion's first waking. `covenant write`: the garden's own law on record, `lore/covenant.md` (core's human covenant, signature block and witness roster filled from the registry, naming only the kin with a shintai in this pot, never every key: a kin minted ahead of the move is named when they move in) and `lore/codex.md` (core's codex, word for word), never overwritten. `certificate sign`: the kin's certificate in their `identity/passport.json` (the gardener's word, 2026-10-15): one canonical statement naming the garden, the **sponsor** (the gardener) and the **agentic-teammate** (the kin) by slug, kanji ID and fingerprint, the covenant and the codex by id and sha256, and the date, signed by both over the same bytes; either side first, pending until both. `--renew` starts a new one when a text moved on; the old stays as history. `verify`: passport, pending, registry, key, signature, text, exit 1 | a signer who is neither the gardener nor that kin; a kin without a shintai of their own in this pot; the origin's key; a slug listed twice or not at all; a key that is not the registry's — each before custody is opened; a text changed since the first signature (without `--renew`) |
| · | `node bin/ulid.mjs new [-n N]` · `node bin/ulid.mjs check <path>…` | a document id, generated and never typed, from an install alone (O-5 of dry run #4): the core plugin carries `tools/ulid.py` at its root, two folders above any skill, a planted pot carries no core, and not every host has Python; node is on every host an integrity line runs on. Not a second master: the command line of `bonsai-garden-sign/lib/ulid-rule.mjs`, the port of `ulid.py`'s rule that every verifier carries; `check` gives `ulid.py check`'s verdict file for file | `new -n` outside 1 to 1000 (64); `check`: a bad id (shape, time, entropy, structure) or a path that cannot be read (1) |
| 6 | `seed` (also) | writes `home/<slug>/inbox/acknowledged.md` for every key-holder but the origin and the garden, and `home/<slug>/memory/working-state.md` for each kin with a body (the runtime's `session_start` reads it first); never overwritten, each its owner's to seal | — |

**Whose word is `ok`.** `verify --keys pot` and `seal-staged --check` are the POT OWNER'S OWN verifier: they run in that garden, with its custody, and ask whether a file is sealed by a key registered in that pot, so their word is `ok` (a pot's own tool, as `--keys garden` is ours). Anything that verifies a pot FROM OUTSIDE uses `--keys pot --pot <dir>` on `sign.mjs`, `sign.py` or the conformance gate and reads `pot-ok` / `POT-PASS`, never `ok` / `PASS` (Mori-shin's ruling, 2026-10-11).

Exit codes: `0` done · `1` drift (`fill-bodies --check`, `seal-staged --check`, `verify`), each file named · `2` refused, one line saying why and what to do · `3` halt, the state cannot
be determined · `64` usage. A refusal never writes.

**Custody** (`lib/custody.mjs`). One item per garden per host: service `bon-sai.garden`, account
`<garden-ulid>/master-salt`. Backends: the macOS Keychain and the Linux Secret Service
(`os-protected`), 1Password over `op` (`vault-cli`), and a passphrase-wrapped file (`software-fallback`).
The floor for a stranger is `vault-cli` (the Aruji, 2026-10-06: *"good for now"*). The fallback is
allowed only with `--lab-preview`, a flag read from the command line and nowhere else, and the tier
is written into `garden.json`, every registry entry, the attestation and every seal.

**The secret.** The master salt is never printed, logged, put on a command line, or written
anywhere but custody and the sealed export. `test-keys.mjs` runs the whole arc and greps every byte
any step printed or wrote for the salt, its first eight characters, its base64 and its raw bytes.

**Inputs this skill does not invent, and the two it asks the origin about.** The reserved set is
core's shipped `skills/bonsai-garden-mark/reserved-marks.json` and no other file: there is no flag
that names one (`--exclude` left in 0.2.0; it is usage, 64). The reader checks the file's seal over
its exact bytes, holds it to the floor (〇 in the wildcard, set B's six, 33 or more in A, a constant
in the reader), and believes it only on bon-sai.garden's signed answer (spec §6.4). Bonsai's seed
entry (`--bonsai-entry`) is the origin's published key; `seed` checks its owner seal by `bonsai`
offline and then asks the site the same way (§8.1). Both questions go through
`bonsai-garden-mark/origin.mjs`; no answer halts (3), with no cache, no offline mode and no
`--trust-file`. The call-home transport is open (`lib/call-home.mjs` sends nothing and says so).

## Tests

```
node test-keys.mjs                         every §13 refusal planted, and the arc end to end
node test-keys.mjs --keychain-file-test    adds a real round trip through a SCRATCH keychain file (opt-in)
node test-keys-mutants.mjs                 each guard broken on purpose, in a scratch copy: the case must go red
node test-seal-staged.mjs                  a seeded lab-preview pot seals and checks its commits with mono unreachable
node test-install-runtime.mjs              every source kind and every refusal of stage 5, planted against a fixture rt
node test-fill-bodies.mjs                  one fixture pot per check C1–C10, a clean pot that passes, every refusal of 7c, and kobun's fourteen carried-testimony findings reading clean
node test-fill-bodies.mjs --mutants        each check broken in a scratch copy, beside an unbroken control: its case must go red
node test-covenant.mjs                      stage 4's certificates: every refusal and every verify check, each by name (COVENANT_LIB= for a mutant)
node test-homes.mjs                         a home for every key-holder, never the origin's (HOMES_LIB= for a mutant)
node test-ulid.mjs                          bin/ulid.mjs mints ids the rule takes and checks a file's id as ulid.py does (ULID_BIN= for a mutant)
node test-planting-e2e.mjs                  homes at seed and stage 4 through the binary; every file they write passes the pot's gate
```

The tests never touch the gardener's real Keychain, 1Password or master salt: a fake `secret-tool`
and a fake `op` on PATH, a stub `security`, a throwaway HOME. Nor the network: the binary runs from
a scratch copy of core with a planted reserved set sealed by a throwaway key, through an entry that
hands `cli()` a fake bon-sai.garden (`../bonsai-garden-mark/test-fake-origin.mjs`); the global fetch
there logs and throws, and a case that reaches it fails. The opt-in keychain case uses a scratch
keychain file with a throwaway password on the command line, never locked and never on the search list.

Identity, owner and mark: `references/identity.md`.
