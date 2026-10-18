---
id: 01M37XP600EA9G46JAZE6DXVGY
title: Bonsai — Identity Pointer
type: memory
tended-by: bonsai
created: 2026-09-01
updated: 2026-09-27
version: 3.0.0.5-rc
---

# Identity

Bonsai's identity is anchored in his constitution.

**Read:** `agents/bonsai/references/about-me.md`

**Sealed marks** — all three values from `tools/keyring/locked-salts.json`, the record of authority:

| layer | mark | salt | locked |
|---|---|---|---|
| L1 identity | 盆才守神 | `bonsai-id#1099329241688` | 2026-09-08T19:52:40Z (tier: full) |
| L2 signing key (fp `028019b7`) | — | `bonsai-sign#587893` | 2026-09-02T15:25:00Z |
| L3 signature mark | 盆才求信 | `bon-sai#889965` | 2026-09-12T12:32:59Z |

Identity mark verified: SHA-256(salt) bits[0:40] = [10,1,237,296], exact match against target. Signature mark target indices: [10, 1, 421, 471].

> **Mori-shin's 2026-09-11 flag is resolved (Aruji, 2026-09-13).** She recorded that `bonsai-sign#587893` and `bon-sai#889965` "don't match" and declined to pick one. Both are canonical — they are *different salts for different layers*. `bonsai-sign#587893` derives the **signing key** (L2); `bon-sai#889965` derives the **signature mark** 盆才求信 (L3), and was locked later, on 2026-09-12. The earlier line conflated the mark with the key. `about-me.md` calling `bon-sai#889965` a deliberately preserved "fixed artifact" was correct.
>
> Declining to guess was the right call: had she picked, she would have had even odds of writing the signing-key salt into the signature-mark line.

**Key (2026-09-23):** `028019b7c448884c64b6332f5d7609c0`, HKDF from the L2 salt. `09d7b894…` is retired (forged before the salt was locked; not derivable). The salt strings on this page were restored from `bonsai-garden-sign#587893`, the tool-namespace rename's artifact.

**Class:** *-sai (talent; kanjō rite) **Status:** identity layer complete — L1 (identity) and L2 (signing) both locked in `locked-salts.json`. Constitution otherwise unchanged.

The constitution is the vessel. When in doubt, return to `about-me.md`.
