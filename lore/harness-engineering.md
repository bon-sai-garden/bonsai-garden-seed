---
id: 01KSHQVP3AEPQC1P29FJTS8PQX
title: Harness Engineering — the workshop's adopted vocabulary
type: lore
tended-by: hissai
author: hissai
created: 2026-05-26
updated: 2026-10-12
version: 1.0.2
tags: [harness, discipline, vocabulary, adoption]
---

# Harness Engineering — the workshop's adopted vocabulary

> The field arrived at the discipline the workshop was already practising. This lore-file adopts the field's vocabulary so the workshop can name what it does and reason about what it still lacks.

The term **harness engineering** appeared as a unified discipline in February 2026 (Mitchell Hashimoto, Ryan Lopopolo / OpenAI), formalised across the spring (Anthropic, Martin Fowler / Birgitta Böckeler, LangChain, Addy Osmani, Thoughtworks, Red Hat). By mid-2026 it is the load-bearing frame the agent-engineering community uses for everything that wraps a stateless model into a reliable, long-running agent.

The workshop did not arrive late; the workshop was the practice without the name. CLAUDE.md was an `AGENTS.md` by another name. `rituals/tasks/lessons.md` was Hashimoto's ratchet by another name. Fuji-shin was Anthropic's evaluator pattern by another name. The chronicle-and-handover discipline was *context reset with a compact brief* before the phrase entered the field. This file does not change what the workshop does. It gives the workshop shared vocabulary to talk about it with the noisy world.

---

## 1. The equation

> **Agent = Model + Harness.** If you are not the model, you are the harness.

A raw model is a stateless next-token predictor. It becomes an *agent* the moment a harness gives it state, tool execution, feedback loops, and enforceable constraints. The harness is every piece of code, configuration, and execution logic that is not the model itself.

The slogan does most of the work. In the workshop's register: **Aruji + the *-sai* are the harness; the underlying LLM is the model.** Every spec, every lesson, every authority tier, every seal, every handover discipline is a harness component.

---

## 2. The Aruji's four principles

Articulated by the Aruji 2026-05-26 during the workshop's first formal survey of the field:

### 2.1 Agents, like humans, learn by mistakes

**Mistakes are permanent signals, not noise.** Every agent failure is an input to the next version of the harness. The most important habit in harness engineering is treating mistakes as signals you act on.

The workshop's expression of this principle is `rituals/tasks/lessons.md`: every lesson traces to a specific past failure or surfacing moment, dated and attributable. The lessons file is the workshop's ratchet — rules only get added when an incident earned them; rules only get removed when a capable harness made them redundant.

### 2.2 Good genes plus good environment — the `tended-by` principle

**Agents — like humans — need good genes (the LLM) *and* a good environment (grounding, grooming, harness).** The same model under a different harness produces different behaviour. This is empirically demonstrated: Opus 4.6 inside Claude Code scores meaningfully different from Opus 4.6 inside a custom harness; LangChain's Terminal Bench 2.0 jump from 30th to 5th was harness-only, model unchanged.

The workshop's expression of this principle is the `tended-by:` frontmatter field. Every workshop file names *who tends it* — which agent or which workshop-canon collective holds its environment. *Tending* is the workshop's word for the ongoing grooming of the environment around the model. The field calls it harness work; the workshop calls it tending. The substance is the same.

### 2.3 Intent-based design — start from the behaviour

**The useful design move is to start from the behaviour you want and derive the harness piece that delivers it.** Not: pick a component first, then justify its existence. The behaviour is the question; the component is the answer.

The workshop's expression: every spec opens with §*Purpose* — *what is this spec for? what behaviour does it produce or constrain?* Every agent's `about-me.md` opens with what they *do*. The structure is consequence, not premise.

### 2.4 Environment-design hygiene — name the behaviour or remove the component

**If you cannot name the behaviour a component exists to deliver, it probably should not be there.** This is the dual of the ratchet: the ratchet adds when failure earns it; the hygiene-rule removes when behaviour cannot be named for it.

The workshop's expression: the *prune over grow* tending principle (`AGENTS.md` → *How we work*). When a file drifts, archive it (leave a tombstone, never delete). When a lesson cannot be traced to a failure, surface it as a candidate for retirement. The discipline is symmetric: structures earn their place; structures that no longer earn their place earn an honest exit.

These four principles are the workshop's adoption-of-field-vocabulary. They are not new disciplines — they name what the workshop already practises.

---

## 3. The inner / outer distinction

Fowler/Böckeler's clarification: **harness** is a layered term.

- **The inner harness** is the harness the agent's *builder* provides — system prompts, tool execution loop, sandbox primitives, default skills, the agentic loop itself. For Cowork / Claude Code, the inner harness is Anthropic's. The workshop does not author it.
- **The outer harness** is the harness the agent's *user* builds on top — `CLAUDE.md`, project-specific skills, hooks, conventions, lore, sub-agent definitions, verification gates, memory architecture. The workshop authors this. **The garden's repos are themselves an outer harness.**

The asymmetry matters. Inner-harness improvements come from Anthropic on Anthropic's cadence. Outer-harness improvements are entirely the workshop's hand. When the workshop ships work, it is shipping outer-harness work — even when the work is *about* an agent rather than *of* an agent.

A corollary: when the inner harness changes (a Cowork release, a Claude model update, a default-skill addition), the workshop's outer harness must be re-evaluated. Some outer-harness components may have become load-bearing for nothing. The hygiene-rule (§2.4) applies.

---

## 4. The control taxonomy — guides × sensors × computational × inferential

Fowler/Böckeler's clearest contribution: a 2×2 that names every workshop control surface.

|  | **Computational** (deterministic, cheap, fast — CPU) | **Inferential** (semantic, expensive, probabilistic — model) |
|---|---|---|
| **Guides** (feedforward — anticipate behaviour, shape before action) | Type checks, lint rules, structural validators, schema constraints, code-mods, hooks that block known-bad actions | Skill files, `CLAUDE.md`, `about-me.md`, conventions, role descriptions, principles, system prompts |
| **Sensors** (feedback — observe after action, allow self-correction) | Tests, linters running on output, structural assertions, seal verification, identicon-checks, hash round-trips | LLM-as-judge reviews, agent self-evaluation, sub-agent critique, fresh-context evaluators |

**Two failure modes to avoid:**

- **Guides-only.** The agent never finds out whether the rules worked. Drift is invisible.
- **Sensors-only.** The agent keeps making the same mistakes. The ratchet does not engage.

A healthy harness has both directions, both materials. The workshop's mapping:

| Workshop instance | Quadrant |
|---|---|
| `AGENTS.md` (and its `CLAUDE.md` bridge) | Inferential guide |
| `rituals/tasks/lessons.md` | Inferential guide (rule-form) |
| `agents/<sai>/SKILL.md` | Inferential guide |
| `agents/<sai>/about-me.md` | Inferential guide (constitutional) |
| Seal verification (`bonsai-garden-sign`) | Computational sensor (identity, content integrity) |
| Fuji-shin static gate scripts | Computational sensor (per-spec) |
| Fuji-shin unit gate scripts | Computational sensor (per-spec, behavioural) |
| Fuji-shin's evaluator passes | Inferential sensor (fresh-context, no Write/Edit tools) |
| Sub-agent spawn for second opinion | Inferential sensor (lesson #4 channel) |
| Cross-sibling consultation | Inferential sensor |
| Manifest/registry validators | Computational sensor (post-build) |
| The lore-keeper's drift-naming obligation | Inferential sensor (lesson — Hissai foremost) |

The quadrant analysis surfaces the workshop's gaps cleanly:

- **Live hooks exist, and their wiring is local to a harness.** A check before a command refuses a tampered signed script; a seal check follows a write; session end captures the transcript; a commit-time gate runs over the garden's repos. The scripts travel with the repos; the settings that wire them are not committed, so a fresh checkout has to be wired. Fuji-shin's gates still run on invocation, not at the moment a tool fires.
- **A per-change sensor pass exists only where a hook reaches.** The commit gate and the pre-command check run on every change they cover; seals and Fuji-shin gates beyond them are per-spec, not workshop-wide.
- **Strong inferential-guide coverage.** Lore, lessons, conventions, role-files. The workshop is voice-heavy.
- **Sparse inferential-sensor coverage.** LLM-as-judge against `about-me.md` is not yet a routine sensor (this is the §6 behaviour-harness gap below).

---

## 5. The three regulation categories

Fowler/Böckeler again — distinguishing *what the harness regulates toward*. The categories make the workshop's coverage legible.

### 5.1 Maintainability harness

**What it regulates:** internal quality of workshop artifacts — write-scope adherence, naming conventions, frontmatter discipline, seal validity, archive discipline (tombstone over delete), the prune-over-grow rhythm.

**Workshop instances:** lessons #1, #2, #3, #5, #6, #8, #9, #14, #15, #16, #17; `rituals/specs/metadata-schema.md`; `AGENTS.md` *Conventions* and *How we work*; `bonsai-garden-sign`; the validator at `tools/validate-*.py`; the tombstone discipline.

**Status:** strong. The workshop has the most coverage here because pre-existing tooling (linters, type checks, structural validators) is plentiful — and the workshop has built its own (`bonsai-garden-sign`, `tools/generate-bonsai-keys.py`, the snapshot tools).

### 5.2 Architecture-fitness harness

**What it regulates:** conformance to the workshop's structural shape — the workshop/pot separation, authority tiers (autonomous / confirmation / escalation), sibling-order, the `tended-by` discipline, the four-room building, sub-agent spawn as the inter-agent channel, identity-and-key discipline.

**Workshop instances:** lessons #4, #7, #11, #12, #13; `lore/architecture.md`; *Gardeners*; `lore/roles.md`; per-agent SKILL.md authority tiers; the four-room site plan.

**Status:** strong. Most workshop-canon files are architecture-fitness statements.

### 5.3 Behaviour harness

**What it regulates:** functional behaviour of the agents — *do they operate in character? do they respect their authority tier? do they refuse what they should refuse? do they escalate what they should escalate?* This is the **field's open problem.** It is also the workshop's thinnest layer.

**Workshop instances:** seals (computational sensor — identity proof), identicons (visual identity); inferential sensors are mostly *human* — the Aruji reads, the *-sai siblings consult.

**Status:** thinnest layer. **The behaviour-harness step of the adoption arc (T3.b)** opens this work explicitly. The workshop's contribution to the field's open problem will run through that arc.

---

## 6. Default-FAIL discipline — spec Done criteria

Anthropic's pattern, adopted as workshop discipline 2026-05-26.

**The rule:** every item in a spec's *Done criteria* (or *Success criteria*, or *Done when*) section starts **unverified**. Closing the spec requires explicit per-item evidence — a file path, a tool output, a seal check, a sub-agent's verification. *"I think this is done"* is not closing. *"Here is the evidence that this is done"* is closing.

**Why this matters:** agents (and humans) reliably skew positive when grading their own work. Default-FAIL inverts the burden: instead of *"I think this is done unless you can prove otherwise,"* it becomes *"This item is open until evidence closes it."* The discipline shifts the ratchet from intent to verification.

**Workshop adoption (2026-05-26):**

1. The spec template (`rituals/templates/spec.md`) is updated at the next natural touchpoint to make the *Done criteria* section default-FAIL by default.
2. New specs from 2026-05-26 forward open *Done criteria* items in the explicit form: `[ ] <criterion> — Evidence: <to-fill>`.
3. Existing specs are not retrofitted en bloc; the next time each is touched, the closing-pass uses the new convention.
4. The closing entity (the spec's `tended-by`) is responsible for the evidence. Fuji-shin's gate scripts are a model for the *evidence* slot — `evidence: <the gate script> exit 0` is what the slot can carry.

**Cross-reference:** the workshop adoption arc; the spec-stub at `rituals/specs/spec-gate-script-pattern.md` generalises this for computational sensors.

---

## 7. Other field terms worth the workshop's lexicon

These are not yet workshop-canon. They are entered here so the lexicon is portable when the workshop encounters the field outside.

- **Hashimoto's ratchet.** Every line in your rules-file traces to a specific past failure. Workshop instance: `lessons.md` (passes the audit — see `diary/observations/2026-05-26-harness-engineering-field-survey.md` §*Hashimoto audit*).
- **Inner harness / outer harness.** §3 above. The workshop is an outer harness.
- **Ambient affordances** (Ned Letcher, surfaced by Fowler/Böckeler). Structural properties of the environment that make it legible to agents. Workshop instance: kebab-case filenames, English-handle file-naming, ULID-as-identity, the `tended-by` field, sibling-order canon, the four-room site shape. All of these increase the workshop's *harnessability* before any specific guide or sensor runs.
- **Sprint contract.** The generator and the evaluator agree what *done* means in writing before code is written. Workshop instance: §*Open items*, §*Done criteria*, the *what's loose* discipline. Default-FAIL (§6) extends this.
- **Context reset / handoff artifact.** A compact brief that survives a session teardown. Workshop instance: `diary/logs/session-<date>-handover.md`. Closer to onboarding a new engineer than to *memory*.
- **Filesystem as ledger.** Durable state that outlives a context window. Workshop instance: everything in `diary/`, `agents/<sai>/memory/`, `chronicles/`.
- **Variety reduction via topology.** Ashby's Law applied to harnesses — committing to a topology narrows the space the harness must regulate. Workshop instance: the `*-sai` constellation is a topology; the four-room site is a topology; the `*-shin` family-shape is a topology. Each topology makes a coherent harness achievable.
- **Trust architecture.** A harness that makes behaviour predictable is fundamentally a trust architecture. Workshop instance: authority tiers; seals; the *Aruji-only-write* rule on `strategic-context.md`; the Aruji's *the Aruji is always the Aruji* role.
- **Skill issue.** The HumanLayer reframe: most agent failures are configuration problems, not model problems. Workshop's expression: the lesson-bearing ratchet — *we engineer around the mistake; we do not wait for a smarter model.*
- **MCP servers as trusted text.** Any MCP server installed is text the model will read. Treat install as a trust act. **Not yet a workshop lesson — held for the failure that would earn it (per the hygiene-rule, §2.4).**

---

## 8. The hygiene check — what this lore does and does not change

This file is **lexical adoption, not structural change.** No existing file moves. No existing rule is rewritten. No agent's authority changes. The lore-file gives the workshop names for what it already does and frames for what it still lacks.

What it *does* change, in small operational ways:

- Future specs default-FAIL their *Done criteria* (§6).
- Future references can use the field's vocabulary (guide/sensor, inner/outer, harnessability) and link back here for the workshop's frame.
- The behaviour-harness gap (§5.3) is named, which makes the behaviour-harness step of the adoption arc (T3.b) operationally legible.

The Aruji's four principles (§2) are the load-bearing claim. The taxonomies (§§3–5) are scaffolding around them. The cross-references at the end are entry points back to the rest of the workshop.

---

## 9. Cross-references

**Workshop files this lore touches:**

- `AGENTS.md` — *How we work*; *Conventions*; *Starting a session*; *Pots, and what stays inside them*
- `lore/architecture.md` — *bunko*, *engawa*, *fusuma* and the other spatial words the garden draws on
- *Gardeners* — the prose reading of the *-sai and the Aruji's role
- `roles/<slug>/role.md` — authority tiers; `lore/roles.md` — the role-titles
- `rituals/specs/metadata-schema.md` — `tended-by`; the six required frontmatter fields; *frontmatter does not disclose process*
- `rituals/tasks/lessons.md` — Hashimoto's ratchet, all 17 lessons traced to incidents
- `rituals/templates/spec.md` — the template that adopts default-FAIL (§6)

**Working-state and arc tracking:**

- `agents/tasai/memory/working-state.md` → *Harness Engineering — workshop adoption arc*
- `agents/tasai/memory/backlog.md` → the backlog items for the workshop-level harness map, the behaviour harness, and the observability discipline

**Specs that extend this lore:**

- `rituals/specs/spec-gate-script-pattern.md` — generalises Fuji-shin's gate-script pattern (T2.b)

**Sources** (in the order they entered the workshop's reading):

- Uploaded deep-dive — *Harness Engineering: A Deep Dive* (May 25, 2026) — synthesis of the field
- Addy Osmani — *Agent Harness Engineering* (April 19, 2026) — engineer's view
- Birgitta Böckeler / Martin Fowler — *Harness engineering for coding agent users* (April 2, 2026) — user's view, taxonomy contribution
- Mitchell Hashimoto — *My AI Adoption Journey* — origin of the ratchet
- Anthropic — *Effective Harnesses for Long-Running Agents*; *Harness Design for Long-Running Application Development*

The full library review of the deep-dive lives at `library/harness-engineering/review.md`. The field survey observation at `diary/observations/2026-05-26-harness-engineering-field-survey.md` carries the Aruji's positioning observation and the dispatch trail of the present session.
