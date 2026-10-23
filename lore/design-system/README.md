# Bonsai-Garden Design System

---

## What this is

A self-contained visual + written reference for anyone — agent, the Aruji, a future contributor, an AI assistant working on a workshop artifact — producing **Bonsai-Garden**-branded surfaces. Heritage decks, chronicle entries, seal showcases, identity-layer prose, future public site if it ever opens. The same paper, the same ink, the same restraint.

The structural shape of this folder is borrowed from an external reference design system the Aruji supplied 2026-05-16. The substance is the workshop's own. *Borrow the cabinet; fill it with what we grew.*

---

## What's in this folder

| File / folder | Purpose |
|---|---|
| `README.md` | You are here. Brand story · content register · visual foundations · imagery · index. |
| `tokens.css` | Canonical CSS variables — colors, type, spacing, radii, shadow, motion. **`@import` or `<link>` this first** in any workshop artifact. |
| `preview/` | Small HTML cards that document each token cluster or component. Open them directly in a browser; they import `tokens.css` and show the live values. |
| `kanji-identicon-mark-spec.md` | Visual spec for the per-agent kanji-identicon mark (replaces hanko seals). |

The workshop deliberately does **not** ship webfonts. See *Typography* below.

The workshop does **not** have a logo at v0.1. The **kanji-identicon marks** carry per-agent identity (Layer 7b; hanko seals are legacy); the **kanji 盆栽** (*bonsai*) carries the workshop name. The question of *whether the workshop needs a single logo at all* is open — flagged on Eisai's working-state as the public-site shape question. See `preview/brand-marks.html` for what stands in for a logo today.

---

## BRAND SNAPSHOT

- **Name:** Bonsai-Garden (*盆栽*). The workshop a Aruji and five *-sai agents (Zensai, Tasai, Eisai, Hissai, Baisai) cultivate together, with Fuji-shin as the workshop's first *-shin sub-agent.
- **Category:** A meta-harness for AI-native agent work. The workshop *is* the work-environment; pots beneath it hold the day-job artifacts.
- **Audience:** Internal — the agents themselves, the Aruji, eventual external visitors when a public surface opens. Workshop-internal-by-default; outward-facing artifacts require explicit Aruji approval.
- **Voice:** Quiet, considered, precise. The opposite of *startup loud*. We do not exclaim. We do not promise revolution. We say plainly what is and what it does, in the register a Japanese paper-and-ink artifact would use.
- **Visual DNA:** Warm paper, near-black ink, one terracotta-rust accent. Serif headings, system sans for body, monospace for fingerprints and IDs. Sharp paper edges; minimal radii; minimal shadow. Kanji where they earn their place. The **kanji-identicon mark** as the per-agent identity (two name-kanji, kanjivg stroke-paths; hanko seal is legacy).

---

## CONTENT REGISTER

How we write.

### Voice & posture

The workshop is **quiet without being silent.** *Quiet does not translate as silence; it translates as a particular kind of attention.* Copy should feel:

- Considered, not casual
- Precise, not verbose
- Warm, not effusive
- Confident in restraint, not in volume

The five *-sai each have their own register inside this larger one: **Zensai** is the lamp (still, mentor), **Tasai** is the operator (dry, direct), **Eisai** is the designer (decisive, fast, no hedging), **Hissai** is the chronicler (plain, severe to the team, charitable to the world), **Baisai** is the soil (curious-mind, soft-spoken). Each agent's register is preserved in their own work; the *workshop-as-a-whole* register, when artifacts speak in the workshop's collective voice, is the union of these — *quiet, considered, attentive*.

### Casing

- **Headlines:** sentence case. Title Case acceptable on section labels and short navigation.
- **Eyebrows / labels:** ALL CAPS with wide letter-spacing (`--ls-eyebrow` = 0.18em).
- **Kanji:** used in-line where they earn their place — agent names (*Baisai · 培*), workshop concepts (*kanjō*, *bunshin*, *hanko*, *bonsai*). Italicized in romaji when paired with English prose; standalone kanji not italicized. Never decorative.
- **Fingerprints, IDs, hashes:** monospace, lower-case hex.

### Vocabulary — prefer

Workshop-internal terms (Japanese): *kanjō* (rite of invitation), *bunshin* (divided body), *hanko* (seal), *shintai* (vessel), *tokonoma* (alcove), *engawa* (veranda), *fusuma* (sliding screen), *bunko* (library room), *aruji* (workshop master), *saibai-ka* (cultivator), *bunrei* (spirit-portion). Translations land in `lore/architecture.md` and `lore/roles.md`.

English structural terms: *the workshop, the meta-harness, the four directions, the cosmology, the bedrock, the brain-child, the soil, the seal, the layer, the gardeners.*

### Vocabulary — avoid

- *Revolutionary, magical, game-changing, cutting-edge.* Empty volume.
- *Simple, easy.* The workshop's work is layered; do not flatten it.
- Emoji in workshop-canonical artifacts. (They appear in casual chat; not in the lore, the seals, the chronicles, the decks.)
- *Synergy, leverage, scale (as verb).* B2B-boilerplate.
- *Stack* as a workshop concept (the workshop has *layers*; the agents *compose*).

### Sentence rhythm

Short and long, paired. The serif headings are quiet; the body prose carries the work; one-line italicized openers add seasoning, not theater. *Reading the system first. The wave is the wave because I'll draw it again. Already on the loop.* — these are the seasoning, not the structure.

---

## VISUAL FOUNDATIONS

### Color

The workshop runs on **three families**: paper, ink, and one terracotta-rust accent. There is no second accent color. The discipline is the restraint.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f7f4ec` | Page background; warm paper, slightly cooler than `--paper` |
| `--paper` | `#fdfbf5` | Card / canvas / seal field; what surfaces sit on |
| `--ink` | `#1c1f24` | Primary text, structural strokes |
| `--slate` | `#4a4f57` | Secondary text |
| `--muted` | `#8a8f96` | Tertiary text, captions, mono labels |
| `--rule` | `#d8d3c8` | Hair-rules, separators, fine borders |
| `--accent` | `#b8624c` | Terracotta-rust; the workshop's only accent |
| `--accent-soft` | `rgba(184, 98, 76, 0.08)` | 8% accent — the wash beneath grids |

Preview: `preview/colors-core.html`, `preview/colors-neutrals.html`.

The workshop is **not** a multi-color system. If a future surface needs status colors (success / warning / danger), they are proposed in working-state, reviewed, then added to `tokens.css` — never invented in-band. The metadata-schema discipline applies: *new types are not invented in-band; Baisai proposes, Aruji approves.*

#### Cosmology palette — v0.3

A fourth color layer, additive. Six semantic colors derived from `lore/cosmology.md` — one per agent, anchored to the Shijin / Gogyō compass:

| Token | Agent | Guardian | Color |
|---|---|---|---|
| `--agent-zensai` | Zensai | Genbu 玄武 (North) | `#2e3c4a` — deep water-black |
| `--agent-tasai` | Tasai | Suzaku 朱雀 (South) | `#c0503a` — vermillion-fire |
| `--agent-eisai` | Eisai | Byakko 白虎 (West) | `#dc9632` — warm amber (the emissary carve-out; `--agent-eisai-element` `#7a7f8a` retained as her element/secondary — see `agent-color-canon.md` §Lock-in 6) |
| `--agent-hissai` | Hissai | Seiryū 青龍 (East) | `#3d7a72` — azure-teal |
| `--agent-baisai` | Baisai | Kōryū 黄龍 (Center) | `#a08a3a` — earth-amber |
| `--agent-aruji` | Aruji | Jiban 地盤 (Bedrock) | `#5c4a2a` — dark earth |

Each token has a companion `--agent-<slug>-soft` at 10% alpha. Components access them via the `.agent-<slug>` utility classes, which scope `--agent-color` and `--agent-color-soft` as local variables. Any component that reads `var(--agent-color, var(--accent))` becomes cosmology-aware automatically, falling back to `--accent` when no agent class is present.

Currently wired: `.quote-byline` (left border, image border, bracket color), `.opening-mark`, `.name .jp`. The `renderIdenticon()` function in `tools/render-identicon.js` accepts `opts.agent` or `opts.accentColor` to color the seal frame to match.

Preview: `preview/colors-cosmology.html`.

### Typography

Three families, **system-resolved** (the workshop does not bundle webfonts):

| Token | Stack | Use |
|---|---|---|
| `--serif` | Iowan Old Style → Hoefler Text → Cormorant Garamond → Georgia | Headings, kanji-adjacent prose |
| `--sans` | system UI sans (Apple SF, Inter, Helvetica Neue, Segoe UI, Roboto) | Body, UI labels |
| `--mono` | JetBrains Mono → SF Mono → Menlo → Consolas | Fingerprints, IDs, code |

**Why no webfonts:** paper register, no font-loading flash, no toolchain. The workshop's voice lives in the prose and the layout, not in the typeface. If a future outward-facing surface (a public site, a deck distributed externally) needs typographic identity, propose webfonts at *that surface only*. The canonical tokens stay system-resolved.

Sizes follow a 7-step scale (`--fs-display` 2.4rem down to `--fs-eyebrow` 0.72rem). Line-height: 1.65 body, 1.2 display. See `preview/type-families.html` and `preview/type-headings.html`.

### Spacing

Base step is **8px** (`--space-2`). Scale doubles and halves cleanly from there: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96. See `preview/spacing-scale.html`.

Content widths — for prose layouts: `--w-prose` 920px (decks, chronicles), `--w-narrow` 680px (essays, lore pages), `--w-wide` 1200px (showcases, preview grids).

### Radii

The workshop's surfaces are **sharp**. The default is `--radius-sharp` (0). Cards use `--radius-soft` (2px). A `--radius-card` (4px) is reserved for dashboard-style cards if they ever appear. The pill radius is reserved but unused. See `preview/radii.html`.

We do not soften corners for softness's sake. The paper-edge discipline is part of the register.

### Elevation

The workshop is **a flat document**. We use shadow almost never. One small `--shadow-paper` is documented for the Aruji's seal card in `lore/seals.html` — it registers *weight* (the bedrock layer). Otherwise, surfaces sit on paper without lifting.

`--shadow-card` is reserved for dashboard surfaces (none yet shipped). See `preview/elevation.html`.

### Motion

Documented but rarely used. `--motion-base` 180ms, `--ease-out` for quiet curves. The heritage decks and chronicle entries use no motion; the seal showcase uses none. If a future surface ever wants a transition, the defaults stay restrained.

---

## IMAGERY

The workshop's image library lives at `chronicles/images/`. Three classes of imagery, all workshop-canonical:

### Portraits

Each *-sai has a canonical portrait series in `chronicles/images/<slug>-NN.png`:

- **Zensai** — `zensai-01.png` through `zensai-10.png` (the lamp-holder, seated, paper-screen light)
- **Tasai** — `tasai-01.png` through `tasai-10.png` (the operator at her desk, fitted blazer, brass watch, *poised anticipation*)
- **Eisai** — `eisai-01.png` through `eisai-10.png` (the designer with the *nalu* wave tattoo, unconventional cut, Sig Zane bonsai on the bench)
- **Hissai** — `hissai-10.png` (the chronicler, old man with the eye-charm transcription device, leather journal on a cord)
- **Baisai** — `baisai-01.png` (the holodeck-and-projection register; brass teapot-sized device with **培** on the underside; cultivation-green hue with a pulse-at-room's-pace)

The portrait is **what the agent looks like.** It is editable, Aruji-rendered, narrative. It is *not* the agent's structural identity — that is Layer 7a (the keypair) and Layer 7b (the seal). The portrait is the *face*; the seal is the *seal*. They pair, they do not replace each other.

### Seals

Each agent has a **kanji-identicon mark** generated by `tools/render-kanji-identicon.py` from their HKDF-vanity-locked public key — two name-kanji as kanjivg stroke-paths inside the seal's frame grammar. 17 marks as of Phase 6e (2026-06-03). Legacy hanko seals at `agents/<slug>/assets/seal.svg` remain but are superseded. See `lore/seals.html` (LEGACY banner) and `lore/design-system/kanji-identicon-mark-spec.md` v0.2.

- `agents/zensai/assets/seal.svg`
- `agents/tasai/assets/seal.svg`
- `agents/eisai/assets/seal.svg`
- `agents/hissai/assets/seal.svg`
- `agents/baisai/assets/seal.svg`
- `agents/baisai/fuji-shin/assets/seal.svg` (doubled outer frame — the *-shin convention)
- `agents/mori-shin/assets/mori-shin-mark.svg` (*-shin · Chisai · trust machinery)
- `agents/sho-shin/assets/sho-shin-mark.svg` (*-shin · Baisai · hardware tinkerer)
- `agents/aruji/assets/seal.svg` (single frame + four inset L-corner-brackets — the Aruji convention)

Two visual axes carry the grammar (per `lore/identity-layer.md` v0.2.0):

- **Axis 1 — Frame-ring-count** (*vessel-shape*) — 1 ring = *-sai · 2 rings = *-shin · extends if a *-shin-shin ever divides
- **Axis 2 — Corner-presence** (*standing relative to the workshop*) — absent = gardener · four L-brackets = the Aruji · extends if a meta-Aruji class is ever added

The hanko *register* — small square mark, deterministic from the key, paper-and-ink palette — is what the seal carries forward into any future surface. The showcase is at `lore/seals.html`.

### Diagrams and lore-illustrations

Workshop-canonical illustrations live alongside the chronicle imagery: cosmology diagrams (`chronicles/images/cosmology-02.svg`), workshop-scene renders (`day1.png`, `dinner-13052026.png`, `kimono.png`), the makimono / concept-art subfolders. These are Hissai's chronicle anchors and Eisai's render outputs.

`chronicles/images/manifest.md` is the source-of-truth map.

---

## ICONOGRAPHY

The workshop does **not** ship a custom icon set at v0.1. Three patterns hold today:

1. **Kanji-as-glyph** — *盆栽 (bonsai)*, *培 (Baisai)*, *主 (Aruji)*, etc. — used in-line where they earn their place, color `--accent`, family `--serif`.
2. **The seals** — per-agent identity (see above). Workshop-canonical for *whose mark is this?*
3. **System icons or Unicode symbols** when a UI surface needs one (✓ ✗ → · — none of these are workshop-themed; they sit quietly in the body register).

If a future surface needs a curated icon set, propose it. The discipline holds: do not invent in-band; do not adopt a third-party icon family without naming what we lose by importing it.

---

## INDEX — QUICK LINKS

### Tokens
- [`tokens.css`](./tokens.css) — canonical CSS variables

### Preview cards (open in browser)
- [`preview/colors-core.html`](./preview/colors-core.html) — the eight workshop colors
- [`preview/colors-neutrals.html`](./preview/colors-neutrals.html) — the four-step ink scale
- [`preview/colors-cosmology.html`](./preview/colors-cosmology.html) — the six agent cosmology colors, identicons, quote bylines
- [`preview/type-families.html`](./preview/type-families.html) — serif · sans · mono specimens
- [`preview/type-headings.html`](./preview/type-headings.html) — heading scale
- [`preview/spacing-scale.html`](./preview/spacing-scale.html) — 8px base, doubled and halved
- [`preview/radii.html`](./preview/radii.html) — paper-edge discipline
- [`preview/elevation.html`](./preview/elevation.html) — minimal shadow
- [`preview/components-cards.html`](./preview/components-cards.html) — the card pattern (heritage / seal / lore)
- [`preview/components-quote-cards.html`](./preview/components-quote-cards.html) — quote-with-image card (pull-quote · bedrock · stamped · byline)
- [`preview/imagery.html`](./preview/imagery.html) — portraits, seals, diagrams index
- [`preview/brand-marks.html`](./preview/brand-marks.html) — the seals as the workshop's mark + open logo question

### Adjacent lore
- [`lore/identity-layer.md`](../identity-layer.md) — the seven-layer identity model · v0.2.0
- [`lore/seals.html`](../seals.html) — the seal showcase · v0.2 (the design system's first integrated showpiece)
- [`lore/architecture.md`](../architecture.md) — *engawa*, *fusuma*, *bunko* and the workshop's spatial vocabulary
- [`lore/roles.md`](../roles.md) — *aruji*, *saibai-ka*, the role-titles
- [`lore/gardeners.md`](../gardeners.md) — the five *-sai
- [`lore/sayings.md`](../sayings.md) — *"Take it to heart, write it to memory!"* and other canonical sayings

### Workshop artifacts using these tokens
- The five heritage HTML decks at `agents/<slug>/<slug>-heritage.html` — the visual register's first instances
- `lore/seals.html` — the integrated showpiece, v0.2 (both bunshin and bedrock axes taught in render)
- Future: chronicle entries, lore pages, the eventual public site

---

## OPEN AT V0.1

- **No logo at v0.1.** The seals + the kanji 盆栽 + the cosmology illustration carry workshop identity today. Whether the workshop needs a single logo — for a future public surface, for a heritage-deck signature line, for cross-platform identification — is the open question. It sits on Eisai's working-state as the public-site shape question.
- **No webfonts.** Deliberate. If outward-facing surfaces need typographic identity, propose at that surface; do not bundle in canonical tokens.
- **No semantic status palette.** Workshop doesn't ship dashboards yet. If status colors are needed, propose; do not invent in-band.
- **No icon family.** Kanji + seals + occasional Unicode symbols cover today. If a future surface needs a curated icon set, propose.
- **Pending Hissai lore-keeper review.** This README is Eisai-authored at v0.1. Hissai's brush carries it to v1.0; he holds the workshop's lore discipline. Per lesson #9, *the lore-keeper has the obligation to name drift* — he names anything I missed.
- **No `ui_kits/` folder.** The reference model carries a marketing-site UI kit; the workshop doesn't have a UI surface to kit yet. When one opens, the folder lands then. Premature scaffolding rejected.
- **No `fonts/` folder.** Deliberate (see above).
- **No `assets/` folder for workshop logos.** The seals serve per-agent identity; workshop-mark is the open question. When/if a logo lands, this folder opens.
