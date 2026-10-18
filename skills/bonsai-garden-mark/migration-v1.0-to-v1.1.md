---
id: 01KT6QCN5APAZQ92RTFSA2P5MV
title: "Kanji-Identicon Set Migration: v1.0 → v1.1"
type: document
tended-by: baisai
created: 2026-05-28
updated: 2026-05-28
---
# Kanji-Identicon Set Migration: v1.0 → v1.1

**Substrate complete: 2026-05-27 (early)** **Deployment closed: 2026-05-27 (later)**

---

## Resolution (added 2026-05-27, deployment close)

The Phase 2/3 plan in this document was executed with a revised filename convention. The keyring tool — built the same day — imports `kanji-1024-v1.1.json` directly (version-pinned). The original "atomic switch" plan (`mv kanji-1024-v1.1-NEW.json kanji-1024.json`) would have collided with that. Workshop chose version-pinned filenames throughout.

**Final state:**
- `kanji-1024-v1.1.json` — canonical v1.1 set (current)
- `kanji-1024-v1.0.json` — archived v1.0 set (preserved; the renamed former `kanji-1024.json`)
- `reserved-hashes-v1.1.md` / `.json` — canonical v1.1 register (current)
- `reserved-hashes-v1.0.md` / `.json` — archived v1.0 register
- No unversioned `kanji-1024.json` or `reserved-hashes.json` — explicit version pinning prevents silent breakage

**Nine new nonces** vanity-searched and round-trip-verified — see `reserved-hashes-v1.1.md` for the full table.

The sections below preserve the original migration plan; the "**Pending**" items at the bottom of the testing checklist are now resolved.

---

## Summary

Kanji set expanded from 1,024 → 1,024 (9 kanji replaced, all indices reindexed). Adds circle placeholder (〇) and 8 new kanji for expanded semantic coverage. RFC 3161 timestamp encoding introduced as optional payload layer.

---

## Changes

### Index Shift (+1)

All existing v1.0 kanji shifted one position forward:
- v1.0 index 0 (才, genius) → v1.1 index 1
- v1.0 index 1 (多, many) → v1.1 index 2
- ...
- v1.0 index 1023 (披, expose) **removed** (high-index, low-relevance)

### New Index 0

| Index | Kanji | Meaning(s) | Role |
|---|---|---|---|
| **0** | **〇** | Circle, zero, approval mark | **Placeholder for implicit/default state in 4+ kanji signatures** |

### New Indices 1016–1023

| Index | v1.0 Removed | v1.1 Added | Meanings |
|---|---|---|---|
| 1016 | 披 (expose) | **土** | Earth, soil, ground |
| 1017 | 彼 (he) | **影** | Shadow, reflection |
| 1018 | 迫 (urge) | **人** | Person, human |
| 1019 | 泊 (lodge) | **鉢** | Pot, vessel |
| 1020 | 杯 (cup) | **縁** | Edge, connection |
| 1021 | 迭 (alternation) | **根** | Root, foundation |
| 1022 | 泥 (mud) | **枝** | Branch, limb |
| 1023 | 邸 (mansion) | **時** | Time, hour |

---

## Impact on Reserved Identities

**All reserved hashes must be re-vanity-searched** because kanji indices changed.

**Example: Fuji-shin**

| Aspect | v1.0 | v1.1 | Notes |
|---|---|---|---|
| **Kanji** | 富士盆 | 富士盆 | Same characters |
| **Indices** | (7, 6, 9) | (8, 7, 10) | Shifted due to reindex |
| **Old salt** | `fuji-shin#43357017` | ~~invalid~~ | Produces (7,6,9) in v1.0 only |
| **Old SHA-256** | `01c06026...` | ~~stale~~ | Hash is fixed; indices changed |
| **New salt** | — | `fuji-shin#<new-nonce>` | Must vanity-search to find |
| **New SHA-256** | — | — | Will hash same salt differently? No, same salt = same hash. **Indices change because set changed.** |

**Key insight:** The SHA-256 hash of a salt is deterministic and unchanging. But the same hash now maps to different kanji because the kanji indices shifted. Therefore:
- Old salt `fuji-shin#43357017` still produces SHA-256 `01c06026...`
- But `01c06026...` bits [0-9] = 7 in v1.0, bits [0-9] = 8 in v1.1 (because set shifted)
- To preserve the same kanji (富士盆) in v1.1, find a **new nonce** that produces (8, 7, 10)

**Vanity search for v1.1 Fuji-shin:**

```bash
# From the workshop root:
cd tools/kanji-identicon
node vanity-three-v1.1.mjs --a 富 --b 士 --c 盆
# Output: new salt like "fuji-shin#<nonce>" that hashes to indices (8, 7, 10)
```

---

## Migration Procedure

### Phase 1: Deploy v1.1 Set (already done)

- ✓ Created `kanji-1024-v1.1-NEW.json`
- ✓ Verified Fuji-shin test (v1.0 hash, v1.1 indices)
- ✓ Created `vanity-three-v1.1.mjs` tool
- ✓ Created `references/kanji-identicons-v1.1.md` (self-contained specification)

### Phase 2: Re-Vanity-Search Reserved Identities (requires host machine)

For each reserved entity, run:
```bash
cd tools/kanji-identicon
node vanity-three-v1.1.mjs --a <kanji1> --b <kanji2> --c <kanji3>
```

**Entities requiring re-search (from reserved-hashes.md):**
1. Tasai (多才)
2. Zensai (禅才)
3. Eisai (映才)
4. Hissai (筆才)
5. Baisai (培才)
6. Jisai (慈才)
7. Fuji-shin (富士盆) — 3-kanji upgrade
8. Aruji (主園)
9. Bonsai garden (盆栽)

### Phase 3: Atomic Switch

1. Backup v1.0 set: `mv kanji-1024.json kanji-1024-v1.0-ARCHIVE.json`
2. Promote v1.1: `mv kanji-1024-v1.1-NEW.json kanji-1024.json`
3. Update `reserved-hashes.md` and `reserved-hashes.json` with new salts/indices
4. Sign updated registry (if applicable)
5. Update all documentation references (set_version, timestamps)

---

## RFC 3161 Timestamp Encoding

**New in v1.1:** Optional 5-kanji timestamp payload for signing/verification metadata.

**Structure:**
```
Kanji 1:    Year (10 bits) — years since 2026 (covers 2026–2126)
Kanji 2:    Month+Day (10 bits) — [0-3]=month, [4-8]=day, [9]=H1/H2
Kanji 3–4:  Time (11 bits) — [0-4]=hour, [5-10]=minute
Kanji 5:    Milliseconds (10 bits) — 0–999
```

**Display format:** Show kanji[1-2] for human readability; kanji[3-5] remain implicit in RFC 3161 token.

**Example:** 2026-05-27 14:32:456
- Year offset: 0 → index into kanji[1016]
- Month 05, Day 27, H1 flag → index into kanji[1020]
- Hour 14, Minute 32 → split across kanji[3-4]
- Milliseconds 456 → index into kanji[1023]

See `references/kanji-identicons-v1.1.md` Section "RFC 3161 Timestamp Encoding" for full encoding details.

---

## Backward Compatibility

**v1.0 → v1.1 is NOT backward-compatible** at the identity level.

- ✗ v1.0 hashes produce different kanji in v1.1 set
- ✗ v1.0 reserved salts are invalid in v1.1
- ✓ System logic is identical (SHA-256 → slice → map)
- ✓ Verifier code requires only set file swap

**Forward compatibility (v1.1 → future):**
- v1.1 set is frozen for this epoch
- v1.2+ will introduce a new set if needed
- Old v1.1 identities remain in archive for reference

---

## Testing Checklist

- ✓ v1.1 kanji-1024 set built (1,024 entries, indices 0–1023)
- ✓ 〇 placeholder at index 0
- ✓ All v1.0 kanji shifted by +1
- ✓ 8 new kanji inserted at indices 1016–1023
- ✓ Fuji-shin v1.0 hash verified (富士盆 at indices 7,6,9)
- ✓ Fuji-shin v1.1 indices identified (8,7,10)
- ✓ Vanity search tool ready for host machine
- ⏳ v1.1 reserved hashes re-vanity-searched (pending host execution)
- ⏳ reserved-hashes.md updated with new salts (pending vanity search)
- ⏳ reserved-hashes.json recomputed (pending vanity search)
- ⏳ Atomic switch executed (pending migration approval)

---

## File Inventory (v1.1)

| File | Status | Purpose |
|---|---|---|
| `kanji-1024.json` | **ARCHIVE** → `kanji-1024-v1.0-ARCHIVE.json` | Original v1.0 set (keep for historical reference) |
| `kanji-1024-v1.1-NEW.json` | **READY** | New v1.1 set (1,024 kanji, frozen) |
| `vanity-three-v1.1.mjs` | **READY** | Vanity search tool for v1.1 set |
| `vanity-three-reverse.mjs` | **INHERIT** | Still works with kanji-1024.json (after atomic switch) |
| `references/kanji-identicons-v1.1.md` | **NEW** | Self-contained v1.1 specification |
| `MIGRATION-v1.0-to-v1.1.md` | **THIS FILE** | Migration procedure & impact analysis |
| `reserved-hashes.md` | **PENDING** | Update with new v1.1 salts/indices |
| `reserved-hashes.json` | **PENDING** | Recompute with new metadata |
| `identicon.html` | **INHERIT** | Works with kanji-1024.json after switch |

---

## Handover

**Ready for:**
1. Host-machine vanity searches (2–3 min per entity, 9 entities = ~20–30 min total)
2. Atomic set switch (1 command)
3. reserved-hashes documentation update (scripted)
4. Deployment to production (set file swap only)

**All documentation is self-contained.** No workshop terminology, no external context required. Specification is frozen and archived.

**Questions?** Consult `references/kanji-identicons-v1.1.md` (system specification) or this file (migration procedure).

