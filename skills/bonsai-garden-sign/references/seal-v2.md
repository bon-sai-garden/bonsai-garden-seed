---
id: 01M39XB31DS7EM4X24BPWEVPKN
title: "Seal v2 — a detached seal for every file, signed over its bytes and every field of its own"
type: spec
tended-by: baisai
created: 2026-09-24
updated: 2026-09-24
status: draft
related:
  - "references/trust-anchor.md"
  - "lib/seal-v2.mjs · lib/ulid-rule.mjs · lib/verify.mjs · lib/published-keys.mjs"
  - "bonsai-garden tools/sign.py (the Python twin)"
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
| `target` | the file's path relative to its **seal root**: the nearest directory above it, with symlinks resolved, that holds `.git` or `agents/registry.json`. It is found by marker, never by counting levels. If there is no root, nothing is sealed, and a basename is never used instead |
| `file-hash` | blake2b-512 of the file's exact bytes |
| `open` | optional; see seal-open below |
| `signature` | ed25519, base64, over the payload |

**Payload** = `"bonsai-seal-v2\n"` followed by the canonical JSON of every field except `signature`. Canonical means keys sorted at every level, no whitespace, strings only, and UTF-8 kept as UTF-8. In Python that is `json.dumps(…, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`. The domain tag means a v1 signature, which covers 64 raw hash bytes, can never pass as a v2 one. After v2, **any** frontmatter edit breaks the seal by design, and that includes a ULID remap.

## Verification, in order (the contract)

The checks run in this order: schema → the signer's key → fingerprint (first the key's, then the registry's) → the signature over the payload → target → id → bytes. The fingerprint is checked before the hash, as in v1, and the planted wrong-signer fixture holds that order.

Verdicts: `ok` · `hash-mismatch` · `bad-signature` · `unknown-signer` · `target-mismatch` (the seal names another address: moved, renamed, or copied onto another file) · `id-mismatch` · `bad-sidecar (<why>)` · `no-sidecar` · `open` · `open-drift` · `open-expired` · `open-malformed` · `two-sidecars` · **`retired-v1`** · **`retired-sidecar-name`**.

Published path: the client sends `{format, signer, payload, signature}`. The site verifies the signature over those exact bytes against the published key, then checks that the payload's fingerprint is that key's. Its answer is signed with `response_sig` and names `format`, `role`, and the payload's `sha256`, so an answer replayed from another seal by the same signer does not match. Target, id and bytes are checked by the client, because only the client holds the file.

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

A built package carries `agents/registry.json` at its root, so the targets of its own seals (`SKILL.md`, `MANIFEST.json`) are package-relative wherever the package is unpacked. The builder no longer rewrites `target` after sealing: v1 allowed that only because v1 left `target` unsigned. A seal copied into a package from its source does not hold at the package address, by design. The builder verifies each copied seal **at its source**, and checks that the staged bytes match the source.

## Generated files: a proposal, not built

The batch seals the **source** of a generated file (AGENTS.md composed into six repos, the site's `keys.js`, greeting fills, rosters) and gates the output on drift; it does not seal each copy. The minimal form proposed:

- a committed list at each repo's seal root, `generated.json`, with one entry per output: `{path, source: "<repo>:<path>", generator: "<repo>:<path>", drift: "<the generator's --check command>"}`;
- the list is itself sealed v2, like any JSON file, with its id in its seal, so nobody can exempt a file by adding an entry without a signer;
- the verifier reports a listed output that has no sidecar as `generated`, which is a distinct non-`ok` verdict, never a pass. A gate accepts `generated` only when the source's seal holds **and** the drift command is clean.

## Tests

`test-seal-v2.mjs` asserts every case in both tools: the demonstration's frontmatter edits, the seal's own fields, where the seal sits, crafted-but-signed guards, sealing refusals, seal-open, v1 warn and refuse (with a flipped copy of the policy), and parity over the corpus. `test-seal-v2-mutations.mjs` removes each guard, in a copy, and requires the matching test to stop passing. The site's `worker/test-verify-v2.mjs` covers `/verify` and the published client end to end.

## Open

- **Uniqueness of ids** is not checked at seal time, because it is a whole-repo question. `ulid.py check --staged` is that gate. A seal copied to a new address never lends its id to the copy.
- **The v1 branch of the live `/verify`** stays until the cutover, then comes out in a deploy. The site's `/verify` page shows v1 answers as it always did. Teaching it to show `role` is still owed.
- **PNG**: `sign` removes a retired BonsaiSign chunk and seals the PNG v2 like any file. Core still reads no chunk, and does not need to.
