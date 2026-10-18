---
id: 01KT6QCNAMYVCFXJJ5SPV8M3HP
title: Kanji Identicons
type: readme
tended-by: baisai
created: 2026-05-26
updated: 2026-10-17
---
# Kanji Identicons

A visual-fingerprint system that maps any 256-bit value — a SHA-256 hash, a public key, an Ethereum address — to a pair of Japanese kanji characters.

Same input always produces the same kanji pair. Different inputs produce visibly different pairs. The result is small, distinctive, and recognizable at a glance.

---

## The canonical vocabulary — read this before loading a set

> **`kanji-1024-v1.2.json` is the canonical 1,024-kanji set.** Ratified by the gardener
> 2026-09-16 (*"v1.2 is the only one we should use — canonical"*); live since 2026-09-12.
>
> **This directory is its single home.** The runtime and a garden's pot resolve the set
> out of here through their own `core-path.mjs` — neither keeps a copy. That is an
> L2/L3 → L1 edge, which `LAYERS.md` permits. The set is *capability* (garden-agnostic
> vocabulary); the salts and reserved hashes rendered against it are *instance*, and live
> in each garden's pot.
>
> **Why it is one file and not four.** Until 2026-09-16 core, runtime and a garden's own
> working repo each carried their own copies. v1.2 was curated in that working repo and
> never propagated, so core and runtime sat on v1.1 — and v1.1 and v1.2 differ at **106 of
> 1,024 slots**. Under v1.1, eight four-kanji L2 marks rendered differently from the signed
> registry that named them (one mark's last kanji read 冗 where the registry said 簡). Nothing
> was wrong with the marks; the vocabulary underneath them disagreed with itself depending on
> which repo you opened. Copies are how that happens.
>
> **v1.0 and v1.1 survive only as `kanji-1024-v1.*.json.bak` tombstones.** Archived, not
> deleted — scripts that reproduce a v1.0- or v1.1-era search still point at them, by name,
> visibly. The renaming is the guard: no file called `kanji-1024-v1.1.json` exists in any
> repo any more, so a tool that asks for one **fails loudly** instead of silently rendering a
> stale vocabulary. That was the actual risk — not a broken mark, but a salt that renders
> differently depending on who reads it.
>
> **Index order is unchanged across v1.1 → v1.2** (`reindex: false` in
> `v1.2-swap-table-PROPOSED.json`). A salt's indices are set-independent; only the character
> at a swapped index differs. Every mark locked at the time — 99 of them: each kin's L1 and
> L2 marks, Bonsai's, and the skill marks — was re-derived from its salt and confirmed to
> render exactly as recorded under v1.2 (Mori-shin, 2026-09-16).
>
> `identicon.html` in this directory is an **archived v1.0 lab page** and is bannered as
> such. Do not read glyphs off it.

---

---

## What an identicon is

An identicon is a small image deterministically derived from data. The point is recognition: when you see an account's identicon on Monday and again on Friday, you can tell at a glance that it's the same account — without comparing long strings of hex.

GitHub uses 5×5 pixel grids. SSH uses ASCII "randomart" pictures. Ethereum wallets use colored circles. This project uses **kanji pairs**.

## Why kanji

Kanji evolved over centuries to be visually distinguishable at small sizes. A reader can tell 春 from 着 instantly — a level of optical distinctness that procedural pixel patterns struggle to match. Using real kanji as identicons means inheriting that work, rather than re-deriving distinctness from scratch.

Two kanji side-by-side carry more meaning than a single character. A single kanji invites the question *"what does my account mean?"*; a pair reads more like a compound or a name — abstract enough to be a fingerprint, varied enough to feel chosen rather than assigned.

## How it works

```
Input  ─►  SHA-256  ─►  30 bits  ─►  (A, B, C)  ─►  kanji pair
                       (split 10/10/10)            [A][B]
```

1. The input is hashed with SHA-256.
2. Thirty bits of the hash are sliced into three 10-bit indices.
3. Each index looks up a kanji in a curated set of 1,024 characters.
4. The first two kanji are displayed.

Why 1,024? It is exactly 2¹⁰ — ten bits per kanji. Two kanji carry twenty bits, giving 1,048,576 possible pairs. No skew, no wasted bits, no truncation.

## The curated 1,024-character set

The full Jōyō kanji list (2,136 characters taught in regulated Japanese-language education) is filtered down to exactly 1,024 by these rules:

1. **Stroke window** — keep 4–14 strokes. Too few strokes makes a kanji visually trivial (一); too many makes it visually noisy at small sizes (鬱).
2. **Meaning filter** — strict scrutiny. Anything related to death, violence, illness, body parts, taboo, or negative emotion is excluded. The set should never produce an identicon a user finds upsetting.
3. **Visual confusables** — pairs that differ by a single stroke or detail (土/士, 末/未, 干/千, 大/太/犬) are reduced to a single representative.
4. **Variant forms** — kanji with multiple accepted glyphs are normalized to one.
5. **Familiarity bias** — characters from lower school grades are preferred. The output set leans toward kanji a casual reader would recognize.

The resulting list is **frozen as v1**. Adding or reordering kanji would change every existing identicon, so the set is a one-time, deliberate commitment.

## Forward compatibility — the third kanji

The system derives **thirty bits** of identicon state even though only twenty are displayed by default. The third 10-bit index is computed and storable; rendering simply ignores it for now.

This means a future "3-kanji mode" can be enabled without changing anyone's first two kanji. The third character is purely additive — it never replaces, only extends.

```
Today:    ▣ ▣            (20 bits, kanji A + B)
Tomorrow: ▣ ▣ ▣          (30 bits, kanji A + B + C — same A, same B)
```

A 3-kanji mode would lift the pair-space from ~1M to ~1B — enough to delay birthday-paradox collisions from "appearing in dozens of keys" to "appearing in tens of thousands."

## Three surfaces

The project ships as a single HTML page with three tools:

- **Forward** — paste any text, hex string, or public key. See the resulting kanji pair.
- **Vanity search** — pick the kanji pair you want. The tool brute-forces a salt that hashes to it (~1M attempts, milliseconds on a modern machine). The output is a real cryptographic input — a 256-bit value whose SHA-256 produces your chosen pair.
- **Set browser** — scroll the full curated 1,024-character list. Each kanji shows its index (0–1023), stroke count, and meaning.

## Collision math, honestly

A single kanji pair has a 1-in-1,048,576 chance of matching any other given pair. That is the right number when the question is *"is this my key?"*

But when many keys are in play — a contact list, a directory, a wallet's address history — the birthday paradox applies. With **N = 2²⁰** possible pairs, collision probabilities are:

| Keys in set | Chance of some collision |
| --- | --- |
| 46 | 0.1% |
| 145 | 1% |
| 460 | 10% |
| 1,200 | 50% |
| 2,500 | 95% |

Kanji-pair identicons are excellent for **recognition** (is this mine?). They are less suited to **uniqueness within a population** (no two of these are the same). The third kanji raises the ceiling considerably; it can be turned on per use case.

## Use cases

- SSH key fingerprints, rendered as kanji rather than randomart
- Public-key visualization for messaging or signing tools
- Wallet-address recognition (faster human verification than truncated hex)
- Account avatars where users want a stable visual mark without uploading an image
- Any place where two long hashes need to be compared at human speed

## What this project isn't

- **Not a security primitive.** The identicon is a recognition aid, not a cryptographic identifier. The underlying hash is still the source of truth.
- **Not a username.** Two users can theoretically receive the same kanji pair; the pair should appear alongside the canonical identifier, not replace it.
- **Not a translation.** The kanji are visual elements, not meaning-bearing labels. A user receiving 春風 has not been assigned "spring wind" — they have been assigned the 593rd kanji and the 211th kanji, which happen to spell something pretty.

## Project layout

```
kanji-identicon/
├── references/kanji-identicons.md      ← this file (was README.md)
├── references/kanji-identicons-v1.1.md ← v1.1 spec (self-contained; was README-v1.1.md)
├── MIGRATION-v1.0-to-v1.1.md← version history
├── kanji-1024-v1.1.json     ← the curated set, current (frozen v1.1)
├── kanji-1024-v1.0.json     ← prior set (frozen v1.0, archived)
├── curation.py              ← the script that produced kanji-1024-v1.0.json (v1.1 was hand-extended)
├── identicon.html           ← the three-surface artifact
├── engine.js                ← hash + slicing + lookup (pure function)
├── reserved-hashes-v1.1.md  ← human register of locked identities (current)
├── reserved-hashes-v1.1.json← machine register (current)
├── reserved-hashes-v1.0.md  ← archive of v1.0 register
├── vanity-batch-v1.1.mjs    ← 2-kanji vanity-search batch for v1.1
└── vanity-three-v1.1.mjs    ← 3-kanji vanity-search (Fuji-shin) for v1.1
```

**File-naming convention:** Kanji set files and reserved-hashes files are **version-pinned**. Consumers should reference `kanji-1024-v1.1.json` (or another specific version) explicitly. There is no unversioned default — this guards against silent breakage when a new version lands.

## License

TBD — open question for the maintainer.
