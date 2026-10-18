---
id: 01M395QQFKCZWEF1RBCQTNYDKG
title: "Trust anchor — core verifies against the published keys, and fails loudly without them"
type: ruling
tended-by: mori-shin
created: 2026-09-24
updated: 2026-09-24
status: active
related:
  - "bonsai-garden rituals/specs/spec-key-management-and-verify.md (decisions #1, #9, #11)"
  - "bonsai-garden home/mori-shin/inbox/2026-09-24-bonsai-public-keys-need-not-travel.md"
  - "bonsai-garden home/mori-shin/inbox/2026-09-24-baisai-core-cannot-verify-itself-and-third-kanji.md"
---

# Trust anchor

**Ruling (Mori-shin, 2026-09-24).** Core's verifier believes a seal only when the published keys at bon-sai.garden vouch for it. If the site can't be reached, the check fails loudly. No signer's key travels in core.

## The question, and whose steer

Baisai found that a checkout of core alone could verify one of its six skills. His conformance gate had shown 6/6 only because this host let the verifier borrow keys from mono. He asked how core should carry the public keys of everyone who seals core content. The Aruji asked why keys should travel at all when they are public, and gave his steer through Bonsai: *"verifying core offline is out of scope"*, and with no reach to the public keys, *"it should fail loudly."*

## The ruling

1. **The public site is the one master for public keys.** Verifiers ask it and nothing else.
2. **The public path is `POST https://bon-sai.garden/verify`,** not a key list. The Aruji ruled on 2026-05-26 (decision #1) that roster files come off the public surface, because a list of slugs maps the kin and their tenants. `/verify` answers for one seal at a time, and a miss has the same shape whether the signer is unknown or the signature is bad.
3. **The answer is believed only when it is signed.** The workshop verifier key signs it (decision #11). The verifier checks that signature before reading any field, then checks that the answer names the seal's signer and the fingerprint the seal claims.
4. **Every failure is a FAIL,** and none of them reads as `ok`: `keys-unreachable`, `answer-unsigned`, `answer-forged`, `answer-malformed`, `rejected`, `open-unpublished`. There is no cache, no offline mode, no pinned-fallback pass, and no env var that moves the anchor.
5. **Core carries no signer keys and pins no signer fingerprints.** A pinned fingerprint would be a second master of what the site already says, anchored inside the package it is meant to protect. Rotating a key would then mean editing core and the site in step: the house failure, built in. The fingerprint in a seal is a claim, and the site's answer has to match it. It is not an anchor.
6. **What core does carry:** the site's address and the verifier's public key. That key pins the *channel*: it vouches for the answers, and it cannot make any seal verify.
7. **The garden key source stays, but it has to be named.** Host tooling that holds the source the site is built from can pass `--keys garden`: the shintai conformance gate and the seal-open parity test. The verifier never falls back to it.

## What this protects, and what it does not

- **It protects against** an edited file, a re-sealed file under a key the site does not hold, a key added beside the file, and a borrowed garden root. Beating it means compromising bon-sai.garden, or its TLS together with the verifier key.
- **It does not protect against** someone who rewrites the verifier itself. That beats every verifier that ships inside what it checks. No code can defend against its own replacement, and this ruling does not claim otherwise.
- **Surfaces that cannot reach the site** (the `show_widget` sandbox is one) cannot verify. They should say *not verified* and should not improvise.

## What I found while ruling, and fixed

The live `/verify` had never signed an answer. The worker imported its 32-byte seed as `raw`, but WebCrypto accepts an Ed25519 *private* key only as pkcs8 or jwk. The import threw, a `catch` returned null, and every answer went out unsigned, while the header and the spec both said otherwise. Fixed in `bonsai-garden-site` (the seed is now wrapped as PKCS#8, and failures are logged). Guarded by `worker/test-response-sig.mjs`, which fails 3/10 against the old code.

## Open

- **Seal-open** has no published contract. Its second signature covers an open payload, not a body-hash, so it verifies with `--keys garden` only.
- **The static PEMs at `/.well-known/<slug>-pub.key`** are a hand-kept second copy of what `/verify` holds. Decision #9 retired that surface, and the copy is missing two kin. Removing them is a delete and a deploy, so the Aruji's word comes first.
- **Bonsai's own seal check** anchors on `agents/registry.json` inside core. The same reasoning applies there, and changing it is his.
