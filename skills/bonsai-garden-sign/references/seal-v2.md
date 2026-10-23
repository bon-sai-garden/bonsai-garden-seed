---
id: 01M39XB31DS7EM4X24BPWEVPKN
title: "Seal v2 — a detached seal for every file, signed over its bytes and every field of its own"
type: spec
tended-by: baisai
created: 2026-09-24
updated: 2026-10-21
version: 1.1.3
status: draft
related:
  - "references/trust-anchor.md"
  - "lib/seal-v2.mjs · lib/ulid-rule.mjs · lib/verify.mjs · lib/published-keys.mjs"
  - "the garden's tools/sign.py (the Python twin)"
---

# Seal v2

**Status: phase 1, implemented and tested; the re-seal batch is a separate phase.** The card's lead is Mori-shin, and the payload is hers to rule on. This page describes what was built for that ruling, and she may correct any of it.

## Why

On 2026-09-24 the gardener found that an embedded `sign:` block signs only the body below the frontmatter. So `status`, `tended-by`, `confidentiality`, a `decision`, and the seal's own timestamp could all be rewritten, and the seal still verified. A v1 `.bonsaisig` signs the file's exact bytes, but not its own `timestamp` or `target`. His order was: *"We need bonsaisig for every file and tamper-proof and a valid seal v2. retire old seals. that's mvp scope."*

**The design reading, which the gardener may correct:** every file gets a detached `.bonsaisig`, byte-exact, with the frontmatter included. Embedded `sign:` blocks are **retired**, not upgraded. Nothing new is ever embedded.

## The format

`.<file>.bonsaisig` (the old name `<file>.bonsaisig` is retired, see below), JSON, with exactly these fields. An unknown field is refused.

| field | value |
|---|---|
| `format` | `"bonsaisig/2"` |
| `id` | the file's ULID, by core's `tools/ulid.py` rule. A file that can carry its own id (`.md` frontmatter, a `.py`/`.sh`/`.mjs`/`.js` header) must carry **this** id. Any other file carries the id here alone. It is minted, never typed. Two exceptions, by property (ulid.py `id_exempt`, ported in `lib/ulid-rule.mjs`; Tasai, 2026-09-24): a **template** (`template: true` plus an id of exactly `<ULID>` or `TODO-generate-ulid`) and a **kanban card** by the validator's card schema (`<lane>/BL-XX###.md`, its id its stem) carry a minted id here alone, and their frontmatter id is not compared against it |
| `signer` | the signer's slug |
| `role` | `"owner"` or `"custodian"`. A custodian seal is never authorship. It becomes an owner seal only when the owner reviews the file and re-seals it under their own key |
| `fingerprint` | `sha256(public key)[:32]` |
| `timestamp` | `YYYY-MM-DDTHH:MM:SSZ` |
| `algorithm` | `"ed25519+blake2b512"` |
| `target` | the file's path relative to its **seal root**: the nearest directory above it, with symlinks resolved, that holds `.git` or `agents/registry.json`. It is found by marker, never by counting levels. If there is no root, nothing is sealed, and a basename is never used instead. It is **provenance**: signed, shown, never a verdict (see *Verification*, the rule of 2026-10-21) |
| `file-hash` | blake2b-512 of the file's exact bytes |
| `open` | optional; see seal-open below |
| `signature` | ed25519, base64, over the payload |

**Payload** = `"bonsai-seal-v2\n"` followed by the canonical JSON of every field except `signature`. Canonical means keys sorted at every level, no whitespace, strings only, and UTF-8 kept as UTF-8. In Python that is `json.dumps(…, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`. The domain tag means a v1 signature, which covers 64 raw hash bytes, can never pass as a v2 one. After v2, **any** frontmatter edit breaks the seal by design, and that includes a ULID remap.

## Verification, in order (the contract)

The checks run in this order: schema → the signer's key → fingerprint (first the key's, then the registry's) → the signature over the payload → id → bytes. The fingerprint is checked before the hash, as in v1, and the planted wrong-signer fixture holds that order.

**The address is provenance, never a verdict (from 2026-10-21, 1.1.0; F-12).** A seal says: *these exact bytes* (`file-hash`), *sealed by this signer* (the key, its fingerprint, in this role), *as this document* (`id`), *at this time*. That is true wherever the bytes are, so a file passes in whichever repo, in a package, or outside every root. The gardener, 2026-10-20: *"if the bytes don't change a file should pass integrity check regardless of which repo contains it"*. The ruling on the payload is Mori-shin's (her letter of 2026-10-20, design B).

- `target` stays inside the signed payload, so it cannot be rewritten: an edited `target` still reads `bad-signature`. Sealing still refuses a file with no root above it, because provenance must be named when the seal is made.
- Every v2 verdict carries `sealedAt` (the seal's `target`), `foundAt` (the file's own address under its seal root, or none when no root is above it) and `moved` (the two differ). The first token stays `ok`; the first line adds `sealed at <target>` only when the file has moved. `sign.py` carries the same as `_sealed_at`, `_found_at`, `_moved`.
- **The id is judged by the file's name in both places**, where it sits and where it was sealed: if either name carries an id (a document, a script), it must be the seal's. So a seal crafted with another id cannot lose its id check by moving to a name that carries none, and a sealed `.json` found under a `.md` name is refused (`id-mismatch`): the bytes carry no id there.
- **Where an address must be vouched for, it is the set's, not each file's.** A sealed manifest says which bytes sit at which relative path, with nothing missing and nothing extra: a package's `MANIFEST.json`, rt's `RT-MANIFEST.json`, the seed's `SEED-MANIFEST.json`; for a living checkout, `CODE-MANIFEST.json` (each sealed code file's path to its seal's id, written from the tree by core's `tools/code-manifest.mjs`, then sealed). **The gates that run code read one** (the gardener's pick, 2026-10-20, "2a"; built in the same release, 0.9.1), and they do not meet a missing one alike:
  - **the MCP's execute gate** runs a module only from its checkout's sealed map. No map, or a map whose seal does not hold, refuses and says so; a module the map does not place, or places under another id, is refused. An installed rt checks its `RT-MANIFEST.json` instead.
  - **the garden's pre-exec hook** requires its own checkout's map: missing, or its seal broken, is BLOCKED. A sealed script in a checkout that carries no map (core today, a scratch copy) it treats as an unsigned script: **allowed in `report` mode, the default, without a word**, and BLOCKED in `enforce` mode. A script a map does not list: a warning in `report`, BLOCKED in `enforce`. Two limits are known, owed before `enforce`: a command that names `sign-sidecar` anywhere passes whatever the hook finds (the re-signing pass-through), and a script run after a `cd` is resolved against the garden, not the command's own folder.

  That is where the address still decides something, and the only place.
- No seal is re-sealed for this, no owner reads anything for it, and `seal-policy.json` gains no key: there is no cutover to stage, and a switch would only re-arm the bug on one host.

Verdicts: `ok` · `hash-mismatch` · `bad-signature` · `unknown-signer` · `id-mismatch` · `bad-sidecar (<why>)` · `no-sidecar` · `open` · `open-drift` · `open-expired` · `open-malformed` · `two-sidecars` · **`retired-v1`** · **`retired-sidecar-name`** · `custody-refused`. `target-mismatch` (the seal names another address) left the vocabulary on 2026-10-21. A package installed before that date keeps its bundled verifier, and keeps saying `target-mismatch`, until it is rebuilt and reinstalled.

Published path: the client sends `{format, signer, payload, signature}`. The site verifies the signature over those exact bytes against the published key, then checks that the payload's fingerprint is that key's. Its answer is signed with `response_sig` and names `format`, `role`, and the payload's `sha256`, so an answer replayed from another seal by the same signer does not match. The id and the bytes are checked by the client, because only the client holds the file; the target is reported by it, as on the local path.

## v1 is retired: the cutover

A v1 seal (an embedded block or a v1 sidecar) reads `retired-v1`.

- **The switch is `seal-policy.json` beside this skill**, and it currently reads `"v1": "warn"`. That file is read by `lib/seal-v2.mjs` and by `tools/sign.py`, and it travels with the verifier into every package. It is never an environment variable. If the file is missing or unreadable, it reads as `refuse`.
- **In warn mode**, a v1 seal that holds is accepted. The first line reads `ok <file>  [retired-v1]`, a `WARN` goes to stderr, and the exit code is 0, so every existing caller keeps working through the batch. A v1 seal that fails keeps its own verdict.
- **In refuse mode**, every v1 seal is `FAIL [retired-v1]` with exit 1, in every caller at once.
- **What flips it:** the gardener, once the re-seal batch is done **and** the v2 `/verify` is deployed. The flip is one line: `"v1": "refuse"`.

## The old sidecar name is retired: the second switch (the dot-prefixed sidecar change, phase 3)

The sidecar of `X` is `.X.bonsaisig`, hidden, beside its file. A seal found at the old name `X.bonsaisig` reads **`retired-sidecar-name`**, and the policy decides acceptance, as it does for `retired-v1`. The status always says what it is.

- **The switch is `"sidecar-name"` in the same `seal-policy.json`**, read by `lib/seal-v2.mjs` and by `tools/sign.py`, never an environment variable. Missing, unreadable, or any value but `warn` or `refuse` reads as `refuse`. It is read on its own: it never changes what `"v1"` means.
- **In warn mode** (today), an old-name seal that holds is accepted. The first line reads `ok <file>  [retired-sidecar-name]`, a `WARN` goes to stderr naming the fix, and the exit code is 0. An old-name seal that fails keeps its own verdict and names the fix as well.
- **In refuse mode**, every old-name seal is `FAIL [retired-sidecar-name]`, exit 1, whatever its bytes, and the published path asks nothing of the site. The fix is the same: `git mv X.bonsaisig .X.bonsaisig`, or re-seal (the writers move it onto the hidden name).
- **Both names beside one file** is `two-sidecars`, refused in either mode. **What flips it:** the gardener, when the tracked old-name count is 0 in all six repos. The flip is one line: `"sidecar-name": "refuse"`.

## Seal-open, in v2

The OPEN declaration moves inside the seal. `sign.py seal-open` keeps every field of the seal as it was: `file-hash` stays the sealed bytes and `timestamp` stays the seal's time. It adds `open: {reason, closer, ruled-by, opened-at, expires, open-hash}` and signs the whole again as one payload. A stretched expiry or a stripped declaration therefore reads `bad-signature`. The document's own signer is the only one who can open it. Documents only: code is never OPEN. Re-sealing closes it. A v1 seal is not opened; it is re-sealed as v2.

## Packages

A built package carries `agents/registry.json` at its root, so the seals the builder makes for it (`SKILL.md`, `MANIFEST.json`) are package-relative wherever the package is unpacked. Every other file keeps the seal it was made with at its source. The builder never rewrites `target`: v1 allowed that only because v1 left `target` unsigned. It verifies each copied seal **at its source**, and checks that the staged bytes are the source's.

**A copied seal holds where it is installed** (from 2026-10-21): the same bytes, sealed by the same signer as the same document, read `ok` in the package, each verdict naming where the file was sealed (`sealed at agents/bonsai/references/about-me.md`). The seed's plugin, unpacked, reads 479 of 479 `ok` under the published keys, where it read 26.

**The manifest is the set.** `MANIFEST.json` lists every file of the unit with its sha256, refuses an extra file and a missing one, and is sealed by the unit's owner; core's `verify-manifest.mjs` checks it, and the conformance gate reports a stamped body whose manifest does not verify. The same-basename acceptance of a moved seal (2026-10-14) is gone with the verdict it accepted, and nothing reads the package marker's `source-path` any more.

## Generated files: a proposal, not built

The batch seals the **source** of a generated file (AGENTS.md composed into six repos, the site's `keys.js`, greeting fills, rosters) and gates the output on drift; it does not seal each copy. The minimal form proposed:

- a committed list at each repo's seal root, `generated.json`, with one entry per output: `{path, source: "<repo>:<path>", generator: "<repo>:<path>", drift: "<the generator's --check command>"}`;
- the list is itself sealed v2, like any JSON file, with its id in its seal, so nobody can exempt a file by adding an entry without a signer;
- the verifier reports a listed output that has no sidecar as `generated`, which is a distinct non-`ok` verdict, never a pass. A gate accepts `generated` only when the source's seal holds **and** the drift command is clean.

## Tests

The seal's tests assert every case in both tools: the demonstration's frontmatter edits, the seal's own fields, where the seal sits (moved within a repo, into a second repo, outside every root, a byte-identical copy: `ok` with its provenance; moved beside other bytes or another id: refused), crafted-but-signed guards, sealing refusals, seal-open, v1 warn and refuse (with a flipped copy of the policy), and parity over the corpus. A mutation suite removes each guard, in a copy, and requires the matching test to stop passing. The site's `worker/test-verify-v2.mjs` covers `/verify` and the published client end to end.

## Open

- **Uniqueness of ids** is not checked at seal time, because it is a whole-repo question. `ulid.py check --staged` is that gate, and since 1.1.0 the only one: **a seal copied to a new address lends its id to the copy.** A byte-identical copy with its seal beside it reads `ok` under the seal's id, naming where it was sealed, so two files can read `ok` as one document. (For code, a checkout's map places one id at one path, and a copy elsewhere is not listed.)
- **The v1 branch of the live `/verify`** stays until the cutover, then comes out in a deploy. The site's `/verify` page shows v1 answers as it always did. Teaching it to show `role` is still owed.
- **PNG**: `sign` removes a retired BonsaiSign chunk and seals the PNG v2 like any file. Core still reads no chunk, and does not need to.

## Version

- **1.1.3** (2026-10-21) — PATCH: the page names no test file that seed leaves out (Tasai: no dead links ship); what the tests check is unchanged.
- **1.1.2** (2026-10-21) — PATCH: the page names no repository of ours by name (the 0.9.2 trace gate): the Python twin and the pre-exec hook are the garden's. No verdict changed.
- **1.1.1** (2026-10-21) — PATCH: two sentences made true, from Mori-shin's owner read of 0.9.1. A gate with no manifest does not always refuse: the MCP's gate does, the garden's pre-exec hook in `report` mode allows a sealed script from a checkout without a map, and the page now says how each gate meets a missing map (and the hook's two known limits). A copied seal now lends its id to the copy; uniqueness is `ulid.py check --staged`'s alone. No verdict changed.
- **1.1.0** (2026-10-21) — MINOR: the address is provenance, never a verdict (F-12). The order loses `target`; every v2 verdict carries `sealedAt`, `foundAt`, `moved`; the id is judged by both names; `target-mismatch` leaves the vocabulary; *Packages* rewritten (a copied seal holds where it is installed, the manifest is the set). The payload and the format are unchanged. The ruling is Mori-shin's; built by Baisai for the gardener's pick of 2026-10-20 ("2a").
- 1.0.0 (2026-09-24) — the first form: a detached seal for every file, signed over its bytes and every field of its own.
