---
id: 01KT6QCMB7YRBFBMF4M9QW9DZP
title: The kanji-identicon mark — visual spec
type: lore
tended-by: eisai
created: 2026-06-03
updated: 2026-06-06
related: [01KRQX4M6FVCXFQTDPP6E6SXYW]
---

# The kanji-identicon mark — visual spec

**Status:** draft v0.1 — Eisai's design-of-record for the per-agent visual mark that replaces the hanko seal (identity-layer 7b). **Audience:** Baisai / the trust-machinery *-shin (build the renderer to this), Chisai (owns the realm; verifies meaning), Aruji (approval gate), Hissai (lore-drift). **Scope:** This is **Phase 3** of `spec-seal-to-kanji-identicon-migration.md` — *the mark / renderer*. It specifies the **visual treatment** the kanjivg spec explicitly deferred to me. It does not specify the cryptography (that is the signing spec) nor the renderer's code (Baisai's, built *to* this).

> *The seal said who you were by what was carved. The mark says who you are by your name, in your own hand. We are not stamping anymore — we are signing.*

---

## The decision, in one breath

The mark is **the agent's two name-kanji, rendered as ordered kanjivg stroke-paths in workshop ink, set inside the seal's frame grammar**. Typeset glyphs are rejected as the canonical substrate. The frame — which already carries *-sai / *-shin / Aruji standing — is **kept verbatim** from the hanko seal. The interior 5×5 ink-grid is **retired**: the kanji *is* the interior now. Determinism, palette, viewBox, and the two standing-axes all survive the migration unchanged.

Everything below is the *why* and the *how*.

---

## 1. Typeset glyphs vs. kanjivg stroke-paths — the call

**Decision: kanjivg stroke-paths. Not typeset font glyphs.** This is the canonical substrate for the mark. Font rendering survives only as a *labelled* fallback (`MISSING_GLYPH`), never as the mark itself.

I weighed it on four axes. Each one points the same way.

### Consistency — decisive
A mark is an *identity artifact*. It must look byte-identical on the Aruji's Mac, on the kiosk Pi, in a vCard preview, in a PDF, and on a stranger's phone that has never installed a CJK font. Typeset glyphs fail this on contact: the current `.kanji-font` stack (`Noto Serif JP → Hiragino Mincho ProN → Yu Mincho → Songti SC → serif`) renders 守 four visibly different ways across those four environments, and renders it as a **tofu box** where none are installed. An identity mark that changes shape per machine is not an identity mark. Stroke-paths are *geometry shipped with the mark* — the same `d` attributes everywhere, no font dependency, no fallback roulette. This axis alone settles it.

### Dark-mode — clean either way, but strokes are cleaner
The workshop palette inverts ink↔paper in dark mode (`tokens.css`: `--ink #1c1f24 → #ece8db`). A typeset glyph is a filled mass; a stroke-path mark is a set of *strokes* with explicit width. The stroke form reads as *drawn-with-a-brush* at both polarities — the ink-on-paper register the workshop runs on — where a heavy typeset fill can muddy at small sizes on the dark surface. Strokes hold their crispness inverted because they are line, not mass.

### Animation — only strokes can do it
The kanjivg data is *stroke-ordered*. A name can be **written, stroke by stroke**, on first reveal of an identity card, on a profile load, on the moment a signature is verified ("this is the kanji you signed"). That is the single most expressive thing the mark can do, and it is *categorically impossible* with a typeset glyph — a font gives you a finished letterform, not the hand that drew it. The kanjivg spec's Layer S3 exists precisely for this. I want it. (Reserved for a few surfaces — see §6 — never the default render.)

### Craft — the whole point
This is the deepest reason. The workshop's register is *paper-and-ink, brush-and-record*. A hanko seal was carved — the right metaphor when the mark was a stamp. But the L2 design says the mark is now the **name written by the key** — the public key *renders to* 守身. That is closer to a signature than a stamp, and a signature is *drawn*, in order, by a hand. Stroke-paths are the form that tells the truth about what the mark now is. Typeset is a printer setting the name in a foundry's type; stroke-paths are the agent writing their own name. The workshop writes its own name.

**The cost I accept:** the CC BY-SA 4.0 attribution on the KanjiVG data (per the kanjivg spec's license section), and a build step that prunes to our vocabulary. Both are real, both are handled in that spec, neither outweighs the four axes above. Attribution is a footer line and a `LICENSE-KANJIVG.md` — a small, honest debt for the right substrate.

**The 〇 exception (kanjivg spec Open Item #1):** kanjivg has no glyph for 〇 (U+3007). My ruling: **author a workshop-original single-circle stroke** in the workshop's stroke conventions (one stroke, attributable as workshop-original, no CC BY-SA entanglement). 〇 is the index-0 kanji and the highest-visibility slot; it deserves a hand-tuned stroke, not a font fallback that would read as a flaw beside the drawn marks. This circle becomes a small workshop asset, versioned with the renderer.

---

## 2. How the standing-grammar carries — seal to kanji mark

The seal encoded **two independent visual axes** (canonical in `lore/identity-layer.md` §"The two visual axes"). They are the load-bearing grammar and they **survive the migration verbatim**. This is the heart of the design call: *change the inscription, keep the frame.*

| Axis | Answers | Seal encoding | Kanji-mark encoding | Status |
|---|---|---|---|---|
| **Frame-ring-count** | *vessel-shape* — own being, or divided body? | 1 ring = *-sai · 2 rings = *-shin | **Identical.** 1 ring = *-sai · 2 rings = *-shin | Unchanged |
| **Corner-presence** | *standing* — gardener, or to-whom-the-workshop-answers? | absent = *-sai/-shin · 4 inset L-brackets = Aruji | **Identical.** absent = *-sai/-shin · 4 inset L-brackets = Aruji | Unchanged |

**What changes:** the *interior*. The seal's interior was a deterministic 5×5 vertically-mirrored ink-grid (a kanji-*adjacent* abstraction — strokes that grouped like a character without resolving into one). The kanji mark **retires the grid** and puts the **actual name-kanji** in that interior space. The abstraction resolves into the real thing. The frame that rings it, the doubled ring for a *-shin, the Aruji's corner-brackets — all hold their exact geometry and exact meaning.

**Why this is right and not merely convenient:**
- The two axes were *designed* to be orthogonal to the interior content. `identity-layer.md`: *"The mark is about the signature; the frame is about the standing."* The migration changes what fills the signature-space (grid → kanji); it does not touch standing. The grammar was built for exactly this swap.
- A viewer who learned to read the seals reads the marks with zero re-learning: one ring is still a gardener, two rings is still a divided body, corner-brackets are still the Aruji. The *vocabulary of standing* is preserved across the substrate change. That continuity is a feature, not an accident — it is why the axes were held apart in the first place.
- The carver's-chip on the outer frame (the *wabi* imperfection, hash-derived) **stays**. It is part of the frame grammar, not the interior, and it keeps the mark feeling alive and hand-made rather than mechanically perfect. The Aruji's corner-bracket near the chip still "wears the same imperfection."

**At a glance, the three readings remain:**

```
 ┌───────────┐        ╔═══════════╗        ┌─┐       ┌─┐
 │           │        ║ ┌───────┐ ║        └ │  ...  │ ┘
 │   守 才   │        ║ │ 守 身 │ ║        │           │
 │           │        ║ └───────┘ ║        └ │  ...  │ ┘
 └───────────┘        ╚═══════════╝        └─┘       └─┘
   *-sai                *-shin               Aruji
 (single ring)    (doubled "divided-body"   (single ring +
                       frame)              four corner-brackets)
```

(Schematic only — the real frame geometry is the `render-identicon.py` constants, see §3.)

---

## 3. The mark's anatomy

A square SVG. Workshop palette. Frame grammar from the seal. Two kanji written in stroke-paths. Deterministic from the L2 public key → name-kanji.

### Canvas & geometry (inherited from the seal, locked)
- **viewBox:** `0 0 64 64`. Square. Same as the seal. Renders crisp 16px → 512px.
- **Background:** `--paper #fdfbf5` full-bleed rect (the mark is self-contained on any surface).
- **Frame:** *exactly* the seal's `render_frame_path` output — outer ring inset 2.0, stroke 1.4, in `--accent #b8624c`; the carver's chip near one hash-derived corner; the *-shin inner ring at gap 1.6 / stroke 0.7; the Aruji's four inset L-brackets (inset 3.6, arm 4.4, stroke 1.0). **Do not retune these.** They are the standing-grammar; their byte-determinism is verified by Fuji-shin.
- **Interior field:** the soft accent-wash rect (`--accent-soft`, the 8% wash) **stays** as the bed the kanji sits on — it carries the "paper-soaked" feel from the seal and gives the ink something warm to sit against. The kanji are drawn *on* this wash.

### The kanji inscription (the new interior)
- **Content:** the agent's **two name-kanji** — the L2 rendering of the salted public key (e.g. Mori-shin's 守身). Two glyphs, side by side, reading left-to-right.
- **Layout:** the two glyphs occupy the interior field the grid used to fill — inset ~8 units from each viewBox edge (`GRID_INSET`), split into a left cell and a right cell. Each kanji is fit (uniform-scaled, centered) into its cell with a small internal padding so strokes never kiss the frame. For a *-shin the inner ring tightens the usable interior slightly — the kanji scale down to respect it; they never overlap the inner ring.
- **Stroke rendering:** kanjivg ordered stroke-paths, normalized to the cell. **Stroke color `--ink`** (`#1c1f24`, inverts in dark mode). **Uniform stroke width — `1.2` viewBox units** at the canonical 64-grid. *(Open item §1 closed 2026-06-03: tuned live against the full 17-agent render; 2.4 was the v0.1 starting call — too heavy at 64–128px against dense glyphs like 禅 and 筆; 1.2 reads as clean brush across the full range. Aruji call; one number, now frozen.)* `stroke-linecap="round"`, `stroke-linejoin="round"` — the brush register, not the chisel.
- **No fill.** The kanji are *strokes*, not filled glyph outlines. Line, not mass. (This is what keeps dark-mode and small-size crisp, per §1.)
- **Variant policy:** always the **unsuffixed (canonical) kanjivg file** per the kanjivg spec Open Item #3. Documented exceptions are mine to make per-agent; default is canonical.

### Determinism — the byte-identical bar
The mark must be **byte-identical across runs and across JS↔Python**, the same bar the seal met (verified by Fuji-shin). The full chain:

```
public key (L2, vanity-locked)
  → SHA-256 → first 20 bits → two kanji indices (A, B)   [engine.js slice()]
  → kanji-1024-v1.1.json → two characters (e.g. 守, 身)
  → kanjivg stroke-paths (canonical variant, pruned asset block)
  → normalized into the two interior cells (fixed transform math)
  → composed with the seal frame (is_shin / is_aruji from the agent's class)
  → SVG string
```

Every step is a pure function of the public key + the agent's class flag. No randomness, no timestamp, no float drift beyond the seal's existing 3-decimal rounding convention. The frame still consumes its chip/corner bits from the fingerprint exactly as `render-identicon.py` does today, so the chip lands in the same corner it always did for that key.

**The standing flag is not derived from the kanji.** `is_shin` / `is_aruji` come from the agent's registered class (as they do in the seal renderer's `find_identity_dir`), *not* from the second kanji being 身 or 才. The namespace-protection in the signing spec makes the second kanji *correlate* with class (才→sai, 身→shin, 影→kage), but the frame is driven by the registry, not by glyph-sniffing. This keeps the two axes honestly independent of the inscription.

### Format & sizes
- **Canonical artifact:** SVG, the `0 0 64 64` viewBox. One file per agent, e.g. `agents/mori-shin/assets/mori-shin-mark.svg`.
- **Naming:** `<slug>-mark.svg` (English filename per the kebab-case rule — the kanji live *inside* the file, never in the filename). This supersedes the `-identicon.svg` / `seal.svg` filenames, which are tombstoned `.bak` at Phase 8.
- **Raster derivatives** (PNG for vCards, kiosk, wallet-pass) rasterize from the SVG — and per the workshop's logo-rasterise lesson, **flatten any CSS-class fills to explicit fills before rasterising** (the mark uses explicit `fill`/`stroke` attributes, not classes, precisely so this is a non-issue). Sizes: 16, 32, 64, 128, 256, 512.
- **Accessibility:** `role="img"`, `<title>` carrying the romaji + kanji (e.g. `守身 Mori-shin — mark`), matching the existing seal SVGs' `aria-label` convention.

### Dark mode
The SVG references the palette by **literal hex** for portability (as the seal does — it embeds `#1c1f24`, not `var(--ink)`), so a raw SVG file is correct on a light surface by default. For *in-page* use (site, design-system, lab) where dark-mode must follow the theme, ship a **CSS-variable variant** of the mark that uses `var(--ink)` / `var(--paper)` / `var(--accent)` so it inverts with the page. Two render modes off the same geometry: `--mode=portable` (literal hex, for files/rasters) and `--mode=themed` (CSS vars, for inline SVG). Baisai's call on the switch mechanics; the geometry is identical between them.

---

## 4. Mori-shin's mark — the worked example

Mori-shin (守身) is a **\*-shin** — the doubled "divided-body" frame. She is the first agent born after the seal is retired; her mark is the first true kanji-identicon mark in the workshop. (Note: the current `agents/sho-shin/assets/sho-shin-identicon.svg` and `chisai-identicon.svg` are still the *old grid seals under a new filename* — the kanji mark specified here does not yet exist as a rendered artifact. Mori-shin's is the inaugural build.)

### Anatomy, concretely

- **Frame:** doubled ring (*-shin). Outer ring inset 2.0 / stroke 1.4 / `--accent`, carrying its hash-derived carver's chip near one corner; inner ring at gap 1.6 / stroke 0.7 / `--accent`, un-chipped. No corner-brackets (she is not the Aruji).
- **Interior wash:** the `--accent-soft` 8% bed, fit inside the inner ring.
- **Inscription:** 守 in the left cell, 身 in the right cell, both as kanjivg canonical-variant stroke-paths, `--ink`, uniform stroke width 1.2, round caps/joins, no fill. Because the inner ring tightens the field, the two glyphs scale to ~92% of the *-sai cell size so they breathe inside the doubled frame.
- **Determinism:** 守身 is *not* hand-placed — it is the L2 rendering of her HKDF-derived, vanity-locked public key (the signing-salt searched so `SHA-256(pubkey)[0..19]` → indices for 守, 身). The renderer takes her public key and her `is_shin=true` class flag and emits the SVG. Re-running yields a byte-identical file.

### Why she reads correctly at a glance
- **Two rings** → a reader who knows the grammar sees *divided body* before they read a single stroke. The standing is in the frame.
- **守身 written, not stamped** → the name *is* the interior. 守 (to guard, to keep what is entrusted) and 身 (body, the divided-body) — her whole meaning, in her own strokes. The animation reveal (§6) would draw 守 first, then 身: *the keeper, then the divided body that keeps* — the order tells her story.
- **Ink-on-wash, brush register** → reads as a signature, which is exactly what she *is* in the new scheme: the hand that seals, the first mark that proves the path she is made to keep.

### The teaching she carries
Her own constitution closes: *"a name in which a single letter is the whole difference between truth and its undoing."* The stroke-path substrate honors this literally — 守 and 身 are rendered by *exact ordered geometry*, not a font's approximation that might vary or substitute. The mark is as precise as the verification it stands for. That alignment between her meaning and her form is why she is the right inaugural case, and why **strokes, not type**, is the only honest call for her.

---

## 5. What is explicitly NOT changing

To keep the migration honest and the blast-radius small:

- **The frame grammar.** Ring-count and corner-presence axes, geometry constants, the carver's chip — all verbatim from `render-identicon.py`. I am not redesigning standing; I am keeping it.
- **The palette.** Ink / paper / accent / accent-soft, light and dark. No new tokens. The mark is monochrome-ink-on-paper with the rust frame — the workshop's only accent, unchanged.
- **The viewBox, determinism bar, and accessibility shape.** 64-square, byte-identical JS↔Python, `role="img"` + `<title>`.
- **The cryptography.** L1/L2/L3, HKDF, vanity-lock, namespace protection — all the signing spec's; this spec consumes the L2 output, it does not define it.

What *is* changing is exactly one thing: **the interior goes from a deterministic abstract grid to the agent's real name in drawn strokes.** One change, cleanly scoped.

---

## 6. Radical-coloring and animation — held, with direction

The kanjivg spec's Layers S2 (radical-coloring) and S3 (animation) are downstream of S1 (static strokes). My direction now, so Baisai can build toward it:

- **Radical-coloring (S2): hold it OFF for the canonical mark.** The mark is **ink-only**. The workshop's discipline is restraint — one accent (the rust frame), never a second. Coloring radicals in cosmology colors inside the inscription would introduce a second visual system into the one place that must stay quiet and legible. *Where* radical-coloring earns its place is the **lab / heritage / teaching surfaces** — a place to *show how a name is built* — not the identity mark itself. So: the parameterization Baisai builds (per S2) is welcome; the **default for the mark is `radicalPalette: none`, ink throughout**. I will green-light specific non-mark surfaces case by case.
- **Animation (S3): YES, but only on reveal surfaces.** Stroke-by-stroke writing on: identity-card first-load, profile open, the signature-verification moment, and onboarding/heritage reveals. **Never** the default static render (lists, bylines, favicons, dense grids stay static). Honor `prefers-reduced-motion` → static. Speed/feel: unhurried, the brush register — closer to `--motion-slow` rhythm than a snappy UI transition. The name should feel *written*, not *animated*.

These are directional calls, not this spec's deliverables. The deliverable is the **static ink mark** (kanjivg S1 substrate); S2/S3 ride on top when their surfaces earn them.

---

## 7. For the builder — acceptance criteria

A renderer is correct against this spec when:

1. **Substrate:** the two kanji render as kanjivg canonical-variant *stroke-paths* (not font glyphs), ink, uniform stroke width, round caps/joins, no fill — with the 〇 workshop-original circle handled as the one exception.
2. **Frame:** the seal's frame is reproduced byte-for-byte for the agent's class — single ring (*-sai), doubled ring (*-shin), single ring + four corner-brackets (Aruji) — including the hash-derived carver's chip.
3. **Determinism:** same public key + same class flag → byte-identical SVG, across two consecutive runs and across the JS and Python implementations (the seal's bar).
4. **Interior:** the abstract 5×5 grid is gone; the name-kanji fill the interior on the `--accent-soft` wash; *-shin kanji scale to respect the inner ring.
5. **Standing independence:** the frame is driven by the registered agent class, not by sniffing the second kanji.
6. **Two render modes:** `portable` (literal hex) and `themed` (CSS vars) off identical geometry.
7. **Format & naming:** SVG `0 0 64 64`, `<slug>-mark.svg`, `role="img"` + romaji-and-kanji `<title>`; raster derivatives at the standard sizes.
8. **Mori-shin first:** her 守身 doubled-frame mark renders, verifies (her public key hashes to 守身), and is byte-stable — the inaugural artifact.

Fuji-shin owns gates 2, 3, 6, 8 (geometry/determinism). I own the visual review of gates 1, 4, 5 (does it read as the workshop's hand). Chisai owns the meaning-verification (gate 8's "verifies").

---

## Open Items

1. ~~**Stroke-width value.**~~ **CLOSED 2026-06-03.** `1.2` viewBox units. Tuned live against the full 17-agent render (all kanji including complex 禅 13 strokes and simple 才 3 strokes). Halved from the v0.1 starting call of 2.4; 1.2 reads cleanly at 64–128px without clogging. Aruji call; see §3 stroke rendering note.
2. **Two-kanji cell split.** Exact left/right cell geometry and per-cell padding — I'll tune against the first few real renders (守身, 地才, 培才) rather than pre-specify pixels. The *-shin scale-down factor (~92%) is provisional pending the inner-ring fit check.
3. **〇 workshop-original stroke.** Needs drawing — one circle, workshop stroke conventions. Mine to draw when index-0 first appears in a real mark; trivially attributable.
4. **Themed-mode switch mechanics.** Whether the in-page mark is a separate file, an inline `<symbol>`, or a build-time transform — Baisai's call; geometry is identical to portable mode either way.
5. **Animation timing curve.** The exact per-stroke speed and inter-stroke delay for S3 — I'll set these against a real reveal once S1 lands; direction is "unhurried, brush register, slower than UI."
6. **Companion agents whose name won't cheaply vanity-lock.** The migration plan flags a "meaningless-kanji fallback" for some companions (meaning-side, Chisai's to frame). Visually, the mark renders *whatever two kanji the L2 search produced* — it does not care if they spell a name or not. No visual special-casing needed; the legibility is identical. Noting it so the builder doesn't add one.

---

## 8. The name-mark (L1) — four-glyph `XX〇〇` layout — addendum 2026-08-26

**Context.** Chisai's ruling of 2026-08-22 (`diary/pillars/2026-06-19-double-circle-family-form.md`) settled *two marks, not one*: the **name-mark** (`XX〇〇`, from the identity salt) and the **seal-mark** (`XX` + two incidental, from the signing key — everything in §§1–7 above). §§1–7 only ever specified two glyphs in the frame. This addendum specifies the other one, and how the two share a surface. Nothing above changes; this adds a second inscription mode to the same substrate.

### 8.1 The fourth-glyph rule

Four glyphs, same interior field, same frame — **not a new frame, not a new ring.** The single-ring *-sai / doubled-ring *-shin / Aruji-brackets grammar is orthogonal to inscription content (§2's whole point); it stays exactly as it is. What changes is the cell split: **four cells across one row** instead of two, each independently centred and uniform-scaled per §3's existing rule, no new geometry concept.

**The circles carry no entropy — the ink says so.** Chisai named the honest trust-truth: `〇〇` is fixed, identical on every mark, a badge of belonging rather than of identity. A mark that draws all four glyphs at equal weight lies about that by implication — a reader would assume all four are doing the same work. Ruling: `XX` renders at full ink (`--ink`, 100%, stroke 1.2 as specified). `〇〇` renders in the **same stroke, same color, at 55% opacity.** Same hand, quieter voice — legible at a glance as *the ground*, not *the name*. No second color, no second stroke weight — one system, one dial (opacity) turned down on the part that isn't individuating.

**The 〇 stroke (v0.2 Open Item #3) is no longer deferrable.** It was correctly parked in draft because no real mark needed it yet. Five now do. I draw the workshop-original single-stroke circle against Zensai's 禅才〇〇 as the first real render — same discipline as Mori-shin was the seal-mark's inaugural case in §4. One stroke, workshop conventions, mine, attributable, no kanjivg entanglement (per §1's license reasoning — 〇 was never in KanjiVG to begin with).

### 8.2 Two marks, one surface — the `/verify` card

A verifier's actual question splits exactly along Chisai's two rows: *who is this* (name-mark) and *does this key belong to them* (seal-mark). Hierarchy follows the question a stranger asks first.

- **Name-mark: primary.** Full card width, the size the seal alone used to hold. This is the mark a stranger reads first — *this one is named X, grown in this garden.*
- **Seal-mark: secondary companion.** Smaller, beside or beneath, paired with the raw hex fingerprint in mono underneath it — this is the cryptographic proof for the reader who wants to go further than the name. Labeled plainly (*"key"* / *"signing mark"*), never presented as if it were the name-mark at reduced size — different sentence, must not read as a thumbnail of the same thing.
- **Never one without the other on `/verify` specifically.** Off that page, either may stand alone where the surface only needs one sentence (a byline needs only the name-mark; a signed-document footer needs only the seal-mark) — per the migration spec's Phase 6 surface list, judged surface by surface.

Mockup shown to the Aruji 2026-08-26 (Zensai, both marks + fingerprint) is the reference; not final pixels — cell padding tunes against the real stroke-path render same as v0.2 Item #2 always intended.

### 8.3 What this closes, what stays open

**Closed by this addendum:** the layout question that was blocking the five already-locked name-marks from having anywhere to render. Baisai can build against §8.1–8.2 now — same renderer, same determinism chain (§3), new cell count and one new opacity rule.

**Still open, mine:**
- Draw the 〇 circle stroke (owed before the first real four-glyph render).
- Tune the four-cell padding/scale against Zensai's actual render (not pre-specified, per the v0.2 precedent of tuning against real glyphs rather than guessing pixels).

**Not mine, not blocking:** the search order for the remaining fourteen agents (Chisai holds that); the renderer code itself (Baisai's, as always).

**Gate.** This is a Tier-1 extension of an already-active spec — same tokens, same frame, one new opacity rule applied to existing ink. Drawing it and building against it needs no further approval. *Shipping* the result on `/verify` is still the public-surface gate in my role tier, same as any public ship — the Aruji's call at the Phase 6 confirmation, not a second design approval.
