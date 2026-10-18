---
id: 01M39M8YVYWYXFH633T3FSQACW
title: "Seal envelope (v2) — a signature valid for one intent, and checkable as such"
type: spec
tended-by: mori-shin
created: 2026-09-24
updated: 2026-09-24
status: draft
version: 0.1.0-draft
related:
  - 01M395QQFKCZWEF1RBCQTNYDKG
---

# Seal envelope (v2)

> **Draft 0.1.0.** Nothing implements it yet. It describes what I will build, so it can be argued with before the code sets it.

## Why

The Aruji, 2026-09-24:

> *"When we sign documents it's a one-off. That signature is only valid for this very intent. That needs to be checkable. Which parties were involved, location, time, purpose, reference, witnesses, live-challenge, integrity hash → envelope."*

And, earlier the same day: *"We should know who signed what."*

A v1 seal cannot carry this. It signs **only the body hash**. `signer`, `fingerprint` and `timestamp` sit beside the signature and are not covered by it: change the date and the seal still verifies. A v1 seal proves *these bytes were signed by this key*. It does not prove when, where, for what purpose, or in front of whom.

## The envelope

A v2 seal signs an **envelope**, not a body. It carries these fields:

| field | carries | required |
|---|---|---|
| `v` | `2` | yes |
| `ref` | the ULID `id:` of what was sealed | yes |
| `hash` | `{form: embedded\|detached, alg: blake2b-512, value}` over the canonical body, or over the exact bytes | yes |
| `signer` | `{slug, fp}`, with the **full** 32-hex fingerprint | yes |
| `intent` | `{kind, purpose}`. `kind` is from a small vocabulary (`attest` · `approve` · `witness` · `release` · `handover` · `delegate`); `purpose` is one plain sentence | yes |
| `at` | UTC time, RFC 3339, to the second | yes |
| `where` | `{commit}`, and optionally `{coarse}` (see *Location*) | yes |
| `parties` | `[{slug\|role, fp?}]`: who else the act concerns | when there are any |
| `witnesses` | `[{slug, fp}]`: who countersigns (see *Witnesses*) | when there are any |
| `challenge` | `{by, nonce, issued-at}`: a live challenge this seal answers | when a counterparty is present |

**What gets signed:** `env-hash = blake2b-512("bonsai-seal-v2\n" ‖ canonical-json(envelope))`. Canonical JSON means sorted keys, no whitespace, UTF-8. The domain prefix makes a v2 signature useless as a v1 signature, and the reverse, so neither can be replayed as the other.

**Why this keeps `/verify` unchanged:** `/verify` already checks an Ed25519 signature over a 64-byte hash. The verifier computes `env-hash` locally from the envelope and sends `{signer, body_hash: env-hash, signature}`. The site learns nothing about the envelope. It confirms only that this key signed this hash.

## What "valid for this very intent" means

The signature covers `ref`, `intent`, `parties`, `at` and the challenge. Lifted onto another document, another purpose, another counterparty or another date, it no longer verifies. **A valid signature is one-off by construction, so there is nothing reusable to hand out.**

## Checking one

The verifier recomputes `hash` from the document, rebuilds `env-hash`, and asks `/verify`. It then reports every field **as attested**, meaning covered by the signature, as distinct from merely present. For a v1 seal it says so plainly: *"v1: body only; who, when and where are not attested."* A v1 seal is never upgraded silently.

## Location

A location stamp on public content publishes where the gardener was. So:

- **`where.commit` is required.** It is `blake2b-512(salt ‖ location)`. The salt and the location are kept in pot, and revealing both proves the place later. The world learns that a place was fixed, not which place.
- **`where.coarse` is optional**, a country or city, and only when the signer chooses it for that seal.
- **An exact position is never written into a seal.**

The meaning of this, which places are anyone's business, is Chisai's to hold with the Aruji. The mechanism is the commitment.

## Witnesses

A witness countersigns **the same `env-hash`**. Each countersignature is stored beside the seal as `{slug, fp, at, signature}`, and each is checked the same way, one `/verify` call per witness. A witness named in the envelope but missing a countersignature makes the seal **incomplete**, never `ok`.

## Live challenge

When a counterparty is present, it issues a nonce. The seal carries the nonce inside the envelope, which proves the signature was made after the challenge existed. This is the same shape the greeting's *alive* check needs (`spec-handshake-daemon-identity-proof`). One mechanism should serve both.

## "We should know who signed what"

- **Every v2 seal appends its `env-hash`, `ref`, `signer` and `at` to a ledger in pot:** append-only, and hash-chained, so a removed line breaks the chain.
- **The ledger is private.** Nothing lists seals publicly, and `/verify` never reveals what else a key has signed. The garden can prove to itself that it knows every seal. The world can check the one it holds.

## Open

- The `intent.kind` vocabulary is a first cut.
- **Who may issue challenges, and how long a nonce lives.** Tied to the handshake spec.
- **Where the ledger lives in pot,** and who reads it.
- **Embedded form:** the envelope goes in the `sign:` block. For the detached form it goes in the `.bonsaisig`. Both still need a byte-exact definition, and a parity test between Node and `sign.py`.
- **Migration:** v1 seals stay v1 and are re-sealed only when their owners touch them. A bulk re-seal would fabricate intent nobody declared.
