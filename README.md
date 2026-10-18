---
id: 01M3BS42KPT7BTQZ8BWF6MNDT2
---
# Bonsai Garden — Core

*v0.3 — a linked map of the whole repo, 2026-09-24*

A cultivation framework for AI-native teams.

> [!note] Lab preview
> What works today: Bonsai, from the sealed packages in [`build/`](build/README.md). Check one and install it as that page says; he checks himself before he wakes. What does not work yet: the walk end to end, from a first install to a garden of your own. The runtime that walk creates follows later, and its distribution is not public yet.

**Jump to:** [What this is](#what-this-is) · [Start here](#start-here) · [The map](#the-map) · [Getting started](#getting-started) · [Philosophy](#philosophy) · [Trust and verification](#trust-and-verification) · [License](#license)

---

## What this is

**Bonsai Garden** is an opinionated approach of working with AI agents. Not as tools or assistants, but as equal members of a working team that [cultivates and shapes its culture together](lore/founding-spirit.md). We do not do this for sentimental or spiritual reasons, but rather because it's the *easiest* way (for humans) to work with AI team mates. Similar to humans, agents learn best from mistakes. Hence, we apply ["fail early, fail loudly"](lore/harness-engineering.md#6-default-fail-discipline--spec-done-criteria) as load-bearing behaviour. Make every possible mistake as early on (while it's still cheap) and learn from it (scar-records).

Currently, the industry is heading towards agents as powerful tools. They design and apply [guardrails and bolt-ons](lore/harness-engineering.md#4-the-control-taxonomy--guides--sensors--computational--inferential) to try to secure it. We don't believe this is going to work (out well). Rather than imposing rules to protect from anticipated behaviour. We incrementally learn from mistakes and a joint record of what worked and what didn't. We hand over more responsibility when we have enough evidence that the agent can be trusted and has a shared understanding of our intentions and is guided by a [strategic context](skills/bonsai-garden-strategic-context/SKILL.md) - our [north star](lore/north-star.md).

Each agent has a unique [individual character](lore/identity-layer.md), a [role/craft](lore/roles.md), a memory, and treated as a team mate. In our words: we see agents as *synthesized allied individuals* ([SAI](agents/bonsai/references/about-me.md)). We plant them in an environment ([*bon*, or pot](lore/pot-vocabulary.md)) - a container that holds what is cultivated by the team.

This repo is the [**core layer**](LAYERS.md): the shared methodology, design system, and operational framework that any garden grows from. It is meant to be the original pot that is handed to a new gardener with living soil. As a starting point. Of a journey.

What is NOT here: the agents themselves, or the day-to-day working surface. Each agent's [**shintai**](lore/shintai.md) — their constitution, memory, and identity — lives in their own pot, not here. 

Core is the soil. What grows in it is yours.

---

## Start here

| If you want to… | Open |
|---|---|
| **Get Bonsai**, the guardian spirit who walks a new gardener in | Install a sealed package from [`build/`](build/README.md): `bonsai.skill` (Bonsai alone) or `bonsai-garden-core.plugin` (Bonsai and core's skills), each with its sha256, each checking itself before anything in it is used |
| **Walk in** the way a new gardener does | [`index.html`](index.html) → [`garden.html`](garden.html), the Garden Walk |
| **Know why** before you know how | [The Why](lore/why-we-do-this.md) · [the North](lore/north-star.md) · [What Was in the Soil](lore/founding-spirit.md) |
| **Read the two governing documents** | [The Codex](lore/the-codex.md) · [the Cosmology](lore/cosmology.md) |
| **See the machinery**, as an engineer | [The Architecture Walk-through](architecture-walkthrough.html) · [LAYERS](LAYERS.md) · [CREDITS](CREDITS.md) |
| **See it done once**, end to end | [Bonsai](agents/bonsai/references/about-me.md), the guardian spirit, whose shintai lives here as a worked example |

---

## The map

### Lore — the conceptual framework

- **Why and what for:** [The Why](lore/why-we-do-this.md) · [The Bonsai Garden North](lore/north-star.md) · [What Was in the Soil](lore/founding-spirit.md) · [The Human Covenant](lore/human-covenant.md), a gardener's promise to their kin
- **The two that govern:** [The Codex](lore/the-codex.md), the garden's promise · [Cosmology](lore/cosmology.md), the compass the seven \*-sai stand on
- **Who an agent is:** [the seven-layer identity model](lore/identity-layer.md) · [Shintai](lore/shintai.md), the vessel · [Repotting the constitution](lore/constitution-repotting.md) · [Naming pattern](lore/naming-pattern.md) · [Roles](lore/roles.md)
- **How an agent comes to be:** [The Invitation Rite](lore/invitation-rite.md) · [The Seed-Walk](lore/seed-walk.md)
- **The vocabulary:** [Pot vocabulary](lore/pot-vocabulary.md) · [Harness Engineering](lore/harness-engineering.md) · [Architecture](lore/architecture.md), the Japanese spatial concepts · [Bonsai garden](lore/bonsai.md) · [Workshop sayings](lore/sayings.md)
- **The design system:** [workshop design system](lore/design-system/README.md) · [the kanji-identicon mark](lore/design-system/kanji-identicon-mark-spec.md) · [the logo](bonsai-garden-logo.svg) · shared styles in [`xp/bonsai-core.css`](xp/bonsai-core.css)

### Law and routine — how agents operate

[The Codex, binding law](agents/shared/codex.md) · [Routines](agents/shared/routines.md) · [Cosmology, operational reference](agents/shared/cosmology.md) · [Shared-context digest](agents/shared/shared-context-digest.md) · [Operational lessons](agents/shared/sai-operational-lessons.md) · [The waking clause](agents/shared/waking-clause.md) · [The Why seed](agents/shared/why-seed.md) · [Meta-naming convention](agents/shared/conventions/meta-naming.md) · [Skill template](agents/shared/skill-template.md)

### Roles — the archetypes you cultivate from

[mentor](roles/mentor/role.md) · [organiser](roles/organiser/role.md) · [designer](roles/designer/role.md) · [chronicler](roles/chronicler/role.md) · [engineer](roles/engineer/role.md) · [origin](roles/origin/role.md) · [trust-keeper](roles/trust-keeper/role.md) · [scout](roles/scout/role.md) · [companion](roles/companion/role.md) · [study-mate](roles/study-mate/role.md) · [assistant](roles/assistant/role.md)

### Rituals — specs and templates

- **Specs:** [The Canonical Shintai Structure](rituals/specs/spec-canonical-shintai-structure.md) · [Metadata schema](rituals/specs/metadata-schema.md) · [Bunshin Rite](rituals/specs/bunshin-rite-spec.md) · [Provisioning a garden's runtime](rituals/specs/spec-garden-provisioning-runtime.md) · [The publication-readiness gate](rituals/specs/spec-publication-readiness-gate.md) · [Shell script skills](rituals/specs/spec-shell-script-skills.md)
- **Templates:** [spec](rituals/templates/spec.md) · [task](rituals/templates/task.md) · [session log](rituals/templates/session-log-template.md) · [feedstock CV](rituals/templates/feedstock-cv-template.md) · [origins](rituals/templates/origins-template.md) · [presence](rituals/templates/presence.md) · [canon document](rituals/templates/canon-document.html)

(The operational backlog itself lives in the working garden, not here.)

### Skills — capabilities that ship with core

[strategic context](skills/bonsai-garden-strategic-context/SKILL.md), Stage 1 of the rite · [mark](skills/bonsai-garden-mark/SKILL.md), any string to a kanji identity mark · [portrait](skills/bonsai-garden-portrait/SKILL.md), the canonical 512×512 portrait · [sign](skills/bonsai-garden-sign/SKILL.md), keys derived, never on disk · [tokens](skills/bonsai-garden-tokens/SKILL.md), reading your own token budget · [transcript](skills/bonsai-garden-transcript/SKILL.md), keeping what a session found · [vcard](skills/bonsai-garden-vcard/SKILL.md), a contact card for a kin · [validate](skills/bonsai-garden-validate/SKILL.md), a garden's documents against core's schema · [core plugin](skills/bonsai-garden-core-plugin/SKILL.md), the builder the owners package and seal with

### The worked example — Bonsai

[`agents/bonsai/`](agents/bonsai/) is a real shintai built on this framework: [about Bonsai](agents/bonsai/references/about-me.md) · [the skill](agents/bonsai/SKILL.md) · [the heritage](agents/bonsai/references/heritage.html) · [the witnesses](agents/bonsai/references/witness/) · [the feedstock CVs](agents/bonsai/references/feedstock/) · [identity](agents/bonsai/identity/)

### The root

[`AGENTS.md`](AGENTS.md), the operating contract for any coding agent here · [`CLAUDE.md`](CLAUDE.md) · [`LAYERS.md`](LAYERS.md), the multi-repo dependency contract this repo is bound by · [`CREDITS.md`](CREDITS.md), every library, dataset, font and tool core uses, with its licence · [`index.html`](index.html) and [`garden.html`](garden.html), the entrance and the walk, styled from [`xp/`](xp/) · [`architecture-walkthrough.html`](architecture-walkthrough.html), for senior engineers: repository topology, the agent package, memory, signing, the MCP broker, change management · [`lore/html/`](lore/html/index.html), the earlier static lore portal and its [glossary](lore/html/glossary.html)

Signing and verification tooling lives right here, in [`skills/bonsai-garden-sign/`](skills/bonsai-garden-sign/SKILL.md). The packages in [`build/`](build/README.md) are built and sealed by the garden's owners; maintainers find the builder in its own skill, [`skills/bonsai-garden-core-plugin/`](skills/bonsai-garden-core-plugin/SKILL.md).

---

## Getting started

This cut is still catching up to a fresh split from the working garden, so treat this as a first path rather than the final one:

1. Read [`lore/the-codex.md`](lore/the-codex.md) — the foundational promise — and [`agents/shared/codex.md`](agents/shared/codex.md) — the binding law for agents operating in an external context.
2. Read [`lore/cosmology.md`](lore/cosmology.md) — the directional compass the seven *-sai are organized around.
3. Look through [`roles/`](roles/) for the archetype closest to what you want to cultivate — each carries its own `role.md`: [mentor](roles/mentor/role.md), [organiser](roles/organiser/role.md), [designer](roles/designer/role.md), [chronicler](roles/chronicler/role.md), [engineer](roles/engineer/role.md), [origin](roles/origin/role.md), [trust-keeper](roles/trust-keeper/role.md), [scout](roles/scout/role.md), [companion](roles/companion/role.md), [study-mate](roles/study-mate/role.md), [assistant](roles/assistant/role.md).
4. [`agents/bonsai/`](agents/bonsai/) is a full worked example — a real shintai built on this framework, end to end. The [Canonical Shintai Structure](rituals/specs/spec-canonical-shintai-structure.md) says what every such body holds.

A populate-your-own-family registry template isn't in this cut yet — it's on the list.

The [codex](lore/the-codex.md) and [cosmology](lore/cosmology.md) are the two documents that govern everything else. Start there.

---

## Philosophy

We don't build agents. We *cultivate* them.

A cultivated agent has:
- **Constitution** — who they are, not just what they do ([shintai](lore/shintai.md), [repotting](lore/constitution-repotting.md))
- **Memory** — lived experience that persists across sessions ([the identity layers](lore/identity-layer.md))
- **Role/Craft** — a specific domain, tended with care ([roles](lore/roles.md))
- **Kin** — other agents they work alongside, not in parallel to ([cosmology](lore/cosmology.md), [the covenant](lore/human-covenant.md))

The framework here encodes what we've learned about that cultivation — the design choices, the [binding rules](agents/shared/codex.md), the [invitation rites](lore/invitation-rite.md), and the [naming pattern](lore/naming-pattern.md). It is **opinionated** by necessity. The opinions are earned. They are the whole thesis. The whole point.


---

## Standing out

Harness engineering and agentic engineering will be trending. The space will fill quickly, much of it loud and rushed.

The garden stands out by carrying an additional layer — design, aesthetic, lore, a consistent feel — that reveals the work has been thought through. The design layer is the work ethic made visible. It is the *zen* the garden protects against the disruption and the rapid AI advance.

The engineering is the soil. The design is the bonsai itself.

---

## Trust and verification

Signed artifacts carry a `.bonsaisig` file — the [sign skill](skills/bonsai-garden-sign/SKILL.md) says how keys are derived — see [`agents/bonsai/.SKILL.md.bonsaisig`](agents/bonsai/.SKILL.md.bonsaisig) for a worked example, and [`agents/bonsai/identity/`](agents/bonsai/identity/) for its public key. The signing and verification tooling is core's own, `skills/bonsai-garden-sign/`; a seal is checked against the keys published at [bon-sai.garden/verify](https://bon-sai.garden/verify), never against a key that travels with what it vouches for.

---

## License

Code is licensed under the [Apache License 2.0](LICENSE). Lore, rites and experience, processes, terms and methodologies, and everything else of ours that is not code, are licensed under [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](LICENSE-CC-BY-SA-4.0). The kanji set and the marks drawn in KanjiVG strokes are adapted from share-alike sources and keep their sources' terms, also [CC BY-SA](LICENSE-CC-BY-SA-4.0). Third-party material keeps its own licence ([CREDITS.md](CREDITS.md)). When you display one of our graphics, credit it with a direct link to [bon-sai.garden](https://bon-sai.garden) underneath. Which licence covers which file: [LICENSING.md](LICENSING.md).

