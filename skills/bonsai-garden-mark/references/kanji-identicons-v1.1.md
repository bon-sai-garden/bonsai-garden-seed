---
id: 01KT6QCN812H8GEMDRD6Z92YH9
title: Kanji-Identicon System v1.1
type: document
tended-by: baisai
created: 2026-05-28
updated: 2026-10-21
---
# Kanji-Identicon System v1.1

**Self-contained specification. No prior knowledge required.**

---

## Overview

A deterministic identity system that represents any named entity as a visual glyph-sequence derived from cryptographic hashing. Convert human-readable names into fixed-point kanji (Japanese characters) that survive across systems without central registry.

**v1.1 expands v1.0** with 9 additional kanji and introduces RFC 3161 timestamp encoding alongside identity fingerprints.

---

## System Design

### Core Principle

1. **Input:** A text string (name/identifier + optional nonce)
2. **Hash:** SHA-256 digest
3. **Extract:** 10-bit groups from the digest
4. **Map:** Each 10-bit slice → index into a 1,024-character frozen kanji set
5. **Output:** Visual kanji sequence

**Example:** `salt = "agent-alpha#5837"` → SHA-256 → bits [0-9]=356, [10-19]=42, [20-29]=891 → kanji[356], kanji[42], kanji[891]

### v1.1 Kanji Set

**Size:** 1,024 characters (indices 0–1023)

**Structure:**
- **Index 0:** 〇 (circle / zero / approval mark) — **new in v1.1**
- **Indices 1–1015:** Original v1.0 set, shifted by +1
- **Indices 1016–1023:** Eight new kanji (v1.1 expansion)

**Frozen v1.0→v1.1 Removed:** 披, 彼, 迫, 泊, 杯, 迭, 泥, 邸, 抵 (high-index, low-relevance jōyō kanji)

**Frozen v1.1 Added:**
| Index | Kanji | Meanings | Use case |
|---|---|---|---|
| 0 | **〇** | Circle, zero, approval | Placeholder for implicit/default state |
| 1016 | **土** | Earth, soil, ground | Substrate, foundation, cultivation |
| 1017 | **影** | Shadow, reflection, silhouette | Observation, the unseen, witness |
| 1018 | **人** | Person, human, people | Human-centered work, agent's subject |
| 1019 | **鉢** | Pot, vessel, basin | Container, boundary, form |
| 1020 | **縁** | Edge, connection, relationship, fate | Links, boundaries, causality |
| 1021 | **根** | Root, basis, foundation | Depth, origin, substrate |
| 1022 | **枝** | Branch, limb, twig | Structure, differentiation, growth |
| 1023 | **時** | Time, hour, period | Temporal witness, history |

---

## Bit Slicing

Given a SHA-256 digest as bytes `d[0..31]`:

```javascript
function slice10(byte_offset, start_bit) {
  // Extract 10 bits starting at bit position (byte_offset*8 + start_bit)
  const byte_a = d[byte_offset];
  const byte_b = d[byte_offset + 1];
  return (((byte_a << (start_bit % 8)) | (byte_b >> (8 - (start_bit % 8)))) & 0x3ff);
}
```

**For 3-kanji identicon (30 bits):**
```
A (10 bits): bits [0–9]
B (10 bits): bits [10–19]  
C (10 bits): bits [20–29]
```

**For RFC 3161 timestamp (40 bits + 5 bits TSA = 45 bits total):**
```
Kanji 1 (year):        bits [0–9]   (10 bits)
Kanji 2 (month+day):   bits [10–19] (10 bits)
Kanji 3–4 (hour:min):  bits [20–30] (11 bits)
Kanji 5 (milliseconds):bits [31–40] (10 bits)
```

---

## Vanity Search: Locking an Identity

**Problem:** Given a target 3-kanji sequence, find the salt that produces it.

**Approach:** Brute-force nonce search across the 2^30 space (~1 billion hashes).

```bash
node vanity-three-v1.1.mjs \
  --base "entity-name" \
  --a "kanji1" \
  --b "kanji2" \
  --c "kanji3"
```

**Output:** The first (nonce, salt, SHA-256) tuple that produces the target indices.

**Verification:** Any verifier can reproduce the result:
```bash
echo -n "entity-name#<nonce>" | sha256sum
# Extract bits [0-9], [10-19], [20-29]
# → verify against target indices
```

---

## RFC 3161 Timestamp Encoding (v1.1 Addition)

**Use case:** Sign/verify documents with both identity and timestamp in a compact kanji representation.

### Timestamp Structure (5 kanji)

**Kanji allocation:**
1. **Kanji 1 (year, 10 bits):** Year offset from 2026 (covers 2026–2126)
2. **Kanji 2 (month+day, 10 bits):** Bits [0-3]=month(1-12), [4-8]=day(1-31), [9]=H1/H2 flag
3. **Kanji 3–4 (time, 11 bits):** Bits [0-4]=hour(0-23), [5-10]=minute(0-59)
4. **Kanji 5 (milliseconds, 10 bits):** 0–999

**Example encoding for 2026-05-27 14:32:456:**
- Year offset: 0 → Kanji 1 index
- Month 05 + Day 27 → Kanji 2 index
- Hour 14 + Minute 32 → Kanji 3–4 indices
- Milliseconds 456 → Kanji 5 index

**Compact display:** Show first kanji (year) + Kanji 2 (month-day) for human recognition. Kanji 3-5 remain implicit in the full RFC 3161 token.

**Full token structure:** Carry the complete RFC 3161 TimeStampToken (ASN.1) separately; the kanji is a human-readable digest only.

---

## Reserved Identities (v1.1)

Entities with locked vanity-searched hashes:

| Entity | 3-Kanji | Salt | Indices (v1.1) | Nonce |
|---|---|---|---|---|
| Example-A | 〇〇〇 | `example-a#123456` | (0, 0, 0) | 123456 |
| Example-B | 土人根 | `example-b#654321` | (1016, 1018, 1021) | 654321 |

*Note: Reserved entities are updated when kanji set is reindexed. Salt format is fixed; nonce is recomputed for new indices.*

---

## Verifier Protocol

To verify a signature with timestamp:

1. **Extract kanji sequence** from the message (e.g., first 3 glyphs for identity; next 5 for timestamp)
2. **Convert to indices** using frozen kanji-1024-v1.1 set
3. **Retrieve RFC 3161 token** (carried separately in metadata)
4. **Verify RFC 3161 token signature** using the timestamp authority's public key
5. **Extract timestamp from token** (in ASN.1 GeneralizedTime format)
6. **Decode kanji timestamp** (optional): convert indices [10-40] back to yyyy-mm-dd:hh:mm:ss.fff
7. **Compare:** Verify kanji-decoded timestamp matches token's official timestamp (within tolerance)

---

## File Inventory

| File | Purpose |
|---|---|
| **kanji-1024-v1.1.json** | Frozen kanji set (1,024 characters, indices 0–1023) |
| **vanity-three-v1.1.mjs** | Vanity-search tool (3-kanji constrained, used for Fuji-shin) |
| **vanity-batch-v1.1.mjs** | Batch vanity-search tool (2-kanji, all workshop *-sai + Aruji + Bonsai garden) |
| **identicon.html** | Interactive verifier (forward hash, browse set, test vanity) |
| **reserved-hashes-v1.1.md** | Human-readable registry of locked identities (v1.1) |
| **reserved-hashes-v1.1.json** | Machine-readable registry of locked identities (v1.1) |
| **reserved-hashes-v1.0.md / .json** | Archived v1.0 registers (kept for historical reference) |
| **kanji-1024-v1.0.json** | Archived v1.0 set (preserved so v1.0 reservations remain reproducible) |

---

## Implementation Notes

- **Deterministic:** Same salt always produces the same kanji sequence
- **Collision-resistant:** 30-bit space (2^30 ≈ 1B combinations); ~2^30 hashes needed to find collision (by birthday paradox)
- **Backward-compatible within epoch:** v1.1 set is frozen; future versions will introduce v2.0 with new set if kanji need to change
- **No central registry required:** Verifier can work offline with only the frozen kanji set file
- **Vanity-locking is optional:** Any string can be hashed immediately; vanity search is for human-memorable kanji sequences

---

## Testing

**Test v1.1 round-trip:**

```javascript
const crypto = require('crypto');
const set = require('./kanji-1024-v1.1.json');

function test_hash(salt) {
  const digest = crypto.createHash('sha256').update(salt).digest();
  const a = ((digest[0] << 2) | (digest[1] >> 6)) & 0x3ff;
  const b = ((digest[1] << 4) | (digest[2] >> 4)) & 0x3ff;
  const c = ((digest[2] << 6) | (digest[3] >> 2)) & 0x3ff;
  
  return {
    salt,
    digest: digest.toString('hex'),
    kanji: [set.kanji[a].char, set.kanji[b].char, set.kanji[c].char],
    indices: [a, b, c],
  };
}

// Test
const result = test_hash('test-entity#12345');
console.log(result);
// → { salt: '...', digest: '...', kanji: ['〇', '土', ...], indices: [0, 1016, ...] }
```

---

## References

- KANJIDIC2 / Jōyō 2010 (via jamdict-data) — kanji source
- RFC 3161 Time-Stamp Protocol — official timestamp format
- SHA-256 (NIST FIPS 180-4) — cryptographic hash
- UTF-8 encoding — salt representation
