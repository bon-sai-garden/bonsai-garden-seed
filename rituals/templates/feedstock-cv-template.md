---
id: 01M37XP5ZZATK45GEN4R7K59JS
title: Feedstock CV — Template
type: template
tended-by: workshop
created: 2026-05-27
updated: 2026-05-27
status: draft (awaiting Aruji review)
---

# Feedstock CV — Template

**For:** authoring new feedstock CVs and normalising existing ones. Workshop-canonical structural shape for the figures that feedstock a *-sai or *-shin synthesis. Lifted from the survey of ~60 existing CVs across `knowledge-base/team-builder/feedstock/*/`.

**Discipline:** content stays untouched in any rewrite that uses this template — only structure (frontmatter presence, section names, section order) normalises. Existing prose, bullet wording, and substantive material remain as authored. *Structurally only.*

---

## Three CV families — distinguished, not unified

The CV pool splits into three structural families. Only one of them is governed by this template.

| Family | Example | Document type | Governed by this template? |
|---|---|---|---|
| **A — Feedstock CV** (figure → -sai/-shin) | `cv-tachikoma.md`, `cv-chiune-sugihara.md`, `cv-pepper-potts.md` | Detailed research dossier on a fictional or historical figure who contributes to a synthesis | **Yes** |
| **B — Workshop -sai profile** | `feedstock/sai/cv-jisai.md`, `feedstock/sai/cv-baisai.md` | Short canonical profile of one of the six workshop -sai (the agents themselves). *Role / Pronouns / Synthesized-from / Operating register / Core facets* | **No — distinct document type** (see §Family B notes) |
| **C — legacy dossier** (old shape) | `legacy/cv-baymax.md`, `legacy/cv-dr-watson.md` | Earlier dossier shape, predates the workshop's frontmatter discipline. No frontmatter; *"CV Dossier: …"* title; *Who They Are / Productive Contradictions / Known Limitations* | **Migrates into Family A** via §Migration recipe |

The rewrite pass governed by this template **upgrades Family C into Family A** and **leaves Family B alone** (it is recognised as a distinct lighter shape, governed by its own separate guidance — to be written when needed).

---

## Family A — Canonical structure

Section order is load-bearing. The order surfaces *who-and-what* before *how-and-why* before *what-to-do-with-it*.

### 1 — Frontmatter (YAML, required)

```yaml
---
id: <ULID — generate with `tools/new-file.py`>
title: CV — <Name>
type: feedstock-cv
tended-by: workshop
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---
```

### 2 — Title (required)

```markdown
# CV — <Name>
```

For figures who feedstock multiple agents the disambiguator goes in parentheses: `# CV — Hayao Miyazaki (Eisai facet)`.

### 3 — Header metadata block (required, fixed key set)

A small block of bold-key lines, before the first `##` section. Required keys, in order:

```markdown
**Source:** <one-line summary; bibliography goes in §Source section>
**Character classification:** <fictional figures>  *— OR —*  **Era / nationality:** <historical figures>
**Status:** CV v<n> — <short descriptor>, <YYYY-MM> or <YYYY-MM-DD>
**For:** Feedstock for **<Sai>** (<short role title>). [**Anchor.** *if applicable*]
**Facet contribution:** *<one-line description of what this figure contributes>*
```

Optional but recommended for major figures:

```markdown
**Scope note:** <which slice of the figure is in scope; what is explicitly out of scope>
```

### 4 — Sections, in canonical order

| # | Section heading | Required? | Notes |
|---|---|---|---|
| 1 | `## Source` | required | Bibliography. Single canonical name across all figures (fictional and historical) — resolved 2026-05-27 per Aruji review. |
| 2 | `## Identity` | required | Names, dates, nature, role, pre-canon backstory. Plain facts. |
| 3 | `## Core thesis` | optional | One paragraph distilling what this figure means for the target -sai. Recommended for anchors. |
| 4 | `## Career arc` | required | Chronological narrative. For fictional figures the canonical variant is `## Career arc within canon`. |
| 5 | `## Operating philosophy` | required | Numbered list of principles. Each item: bolded one-line claim + 1–3 sentences elaboration. Anchors typically have 6–7 items; supporting figures 3–5. |
| 6 | `## Key episodes / signature moments` | required | Bulleted vignettes. Each item: bold lede + one sentence. |
| 7 | `## Voice and register` | required | How the figure speaks. Includes signature cadences and (where available) direct quotes. |
| 8 | `## Productive contradictions` | optional | Single paragraph naming the figure's load-bearing internal tensions. Distinguishes anchor-class figures from minor witnesses. |
| 9 | `## Relationships and dynamics` | optional | Bulleted relationships with the figure's principal counterparties. Most useful for major figures with a defined cast. |
| 10 | `## Known limitations` | optional | Bulleted weaknesses inherent to the figure (distinct from §Open items / gaps which is research-side). Common in legacy-shape dossiers. |
| 11 | `## Facet contribution to <Sai>` | required | The contract: what this figure transfers to the target agent and how. Prose + bulleted "specifically contributed" list. |
| 12 | `## What to take, what to leave` | required | Two-list contract. **Take** = the transferable register / discipline / posture. **Leave** = the canon-specific costume / period detail / trauma load / theatrics that is *not* transferred. Both lists are required; both serve the synthesis stage as an explicit non-aspiration list. |
| 13 | `## Sources` | required | Bibliography. Primary / secondary / documentary categorisation recommended for major figures. |
| 14 | `## Open items / gaps` | optional | Research-side gaps and open questions. Honest where the canon is sparse or contested. |
| 15 | `## Version` | required | Semver footer. `- **1.0** (YYYY-MM-DD) — Initial CV …`. |

**Ordering invariant:** §Facet contribution and §What to take, what to leave always sit together, in that order, near the end of the document. They are the contract; everything before is the evidence.

---

## Migration recipe — Family C → Family A

For the legacy dossier shape (e.g. `cv-baymax.md`, `cv-dr-watson.md`):

| Family C heading | Family A heading | Action |
|---|---|---|
| *(no frontmatter)* | required YAML frontmatter | **Add** with `id` (new ULID), `type: feedstock-cv`, `tended-by: workshop`, `created` (best-guess from git log), `updated` (rewrite date). |
| `# CV Dossier: <Name>` | `# CV — <Name>` | **Rename** title. |
| *(no header meta block)* | required header meta block | **Add** — `Source canon`, `Character classification`, `Status`, `For`, `Facet contribution`. Source values from research where present; mark `<unknown — needs Aruji review>` otherwise. |
| `## Who They Are` | `## Identity` | **Rename**, keep content. |
| `## Career Arc / Origin Story` | `## Career arc` | **Rename**, keep content. |
| `## Major Works & Decisions` | `## Key episodes / signature moments` | **Rename**, keep content. |
| `## Operating Principles` | `## Operating philosophy` | **Rename**, keep content. |
| `## Productive Contradictions` | `## Productive contradictions` | **Lowercase only.** Section stays. |
| `## Known Limitations` | `## Known limitations` | **Lowercase only.** Section stays. |
| *(missing)* | `## Facet contribution to <Sai>` | **Add stub** if missing — fill from context or mark `<TBD — needs synthesis-stage authoring>`. |
| *(missing)* | `## What to take, what to leave` | **Add stub** if missing — fill from context or mark `<TBD>`. |
| *(missing)* | `## Sources` | **Add** with best-effort bibliography from prose mentions. |
| *(missing)* | `## Version` | **Add** with `- **1.0** (YYYY-MM-DD) — Migrated from the legacy dossier shape per feedstock-cv-template.md.` |

**Discipline:** all bullet / paragraph text is preserved verbatim. Headings rename; sections reorder; missing required sections become stubs marked `<TBD>` rather than being invented. *Structurally only.*

---

## Family B — Workshop -sai profile (distinct document type)

Files at `knowledge-base/team-builder/feedstock/sai/cv-*.md` (one per workshop -sai) are **not** Family A. They serve a different function: they are the canonical *short profile* of an existing workshop agent, used as feedstock when a *-shin synthesis wants to anchor on a workshop -sai rather than on an external figure.

Their shape is:

```markdown
---
id: …
title: CV — <Sai>
type: feedstock-cv          # ← shared type-tag with Family A
tended-by: workshop
created: …
updated: …
---

# CV — <Sai>

**Role:** <role line> · <direction> · <kanji>
**Pronouns:** <pronouns>
**Synthesized from:** <comma-separated feedstock list>
**Direction:** <directional metaphor>

## Operating register

<one paragraph>

## Core facets

- bulleted facet list

## What <Sai> does not do

- bulleted non-do list

## Synthesis notes

<one paragraph naming the anchor and the contributing witnesses>
```

**Recommendation:** leave Family B as-is. It is short by design and serves its purpose well. The `type: feedstock-cv` tag is shared with Family A but the *role* of the document is different.

**If the Aruji wants** Family B brought under a template too, that is a separate workstream — a *workshop -sai profile template* — and worth its own review pass.

---

## Aruji review — resolved 2026-05-27

Two structural calls answered in review:

1. **Productive contradictions / Known limitations** → **keep as optional sections** (current draft retained). Folding would have forced prose to move; sections-preserved keeps the rewrite content-clean.
2. **Source canon vs Source record** → **use `Source`** as the single canonical name. Header meta line: `**Source:**`. Section heading: `## Source`. Both fictional and historical figures use the same name.

---

## Migration table — updated for `Source` canonical

| Variant in existing CVs | Canonical | Action |
|---|---|---|
| Header line `**Source canon:** …` | `**Source:** …` | Rename key |
| Header line `**Source record:** …` | `**Source:** …` | Rename key |
| Header line `**Source type:** …` (legacy variant) | `**Source:** …` | Rename key |
| Section `## Source canon` | `## Source` | Rename heading |
| Section `## Source record` | `## Source` | Rename heading |
