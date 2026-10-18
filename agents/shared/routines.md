---
id: 01KS712P2DBBAA8KK20R04RP1G
title: Routines — Standard Operational Sequences for Bon-sai Agents
type: routines
tended-by: workshop
created: 2026-05-22
updated: 2026-10-16
version: 3.3.0
status: active
---

# Routines

> Standard operational sequences. Run these in the order your SKILL.md specifies. Per-agent variations are noted inline.

In these routines, `<slug>` is your agent slug/name.

> [!tip] In-session re-read ban (footprint discipline, 2026-06-06) A shared file already in this session's context is never re-fetched. The context is the cache.

---

## ⚠ All markdown files use Obsidian-flavoured MD

**Golden rule (Aruji, 2026-06-06).** Every `.md` file created by any workshop agent uses **Obsidian-flavoured markdown**. The canonical format reference is `tools/keyring/vanity-search.md`.

**Format checklist:**
- **Frontmatter (on-disk canon is YAML-first):** the canonical on-disk frontmatter is the YAML `--- ... ---` block **at byte 0** — fields: `id`, `title`, `type`, `tended-by`, `created`, `updated`, `tags` (codex §11; the metadata validator and `sign.py` both anchor on `\A---`). The `<!-- frontmatter {...} -->` JSON block you see at the top of a `bonsai_read_file` result is a **read-time display projection** (a flattened mirror of the YAML, regenerated on every read alongside a transient `<!-- base: ... -->` token) — it is **not** written to disk. Do not paste it back: `bonsai_write_file` strips it, and writing a JSON comment (or base token) above the YAML is "inverted frontmatter" (hides the file's id from the validator, breaks Astro). Signing is unaffected — the `sign:` block lives inside the YAML and signatures cover the body only. Guard: `tools/check-frontmatter-order.py`; normalizer: `tools/fix-inverted-frontmatter.py`.
- **The `id:` is generated, never typed:** `python3 bonsai-garden-core/tools/ulid.py new` (one per document; `-n N` for several). Check before you commit with `ulid.py check <file>` or `check --staged`. A moved document keeps its id; a tombstone gets a new one. An id that reads like its subject was typed, and typed ids are how two documents end up sharing one (AGENTS.md → Conventions).
- **Callout blocks:** `> [!note] Title`, `> [!warning] Title`, `> [!tip] Title`, `> [!info] Title` — use these instead of bold headers for asides and warnings.
- **Wiki links:** `[[path/to/file]]` for internal cross-references.
- **Filenames:** English kebab-case — always. No UPPER_CASE, no spaces, no underscores.
- **One paragraph, one line — never hard-wrap prose.** Write each paragraph, list item, callout line and table row as a single unbroken line, however long, and let the editor wrap it. Do not break a sentence across source lines at 80, 95 or any other column.

> [!warning] Why this one is load-bearing, and why it keeps coming back **A phrase that spans a hard wrap is invisible to search.** `grep` and `bonsai_search` both read line by line, so a sentence broken across two lines cannot be found by any query that crosses the break:
>
> ```
> grep "leaned the same way as yesterday" agents/zensai/memory/journal/2026-09-15.md
> → exit 1, no match          # the sentence is right there, on lines 31-32
> ```
>
> That was the cause of the long-standing `bonsai_search` false-negative drift — reported four separate times before anyone found the mechanism. Obsidian itself renders hard-wrapped prose correctly (*Strict line breaks* is off), so the damage is invisible in reading view and shows up only in search, in source view, and in every tool that reads a document a line at a time.
>
> **Nothing ever asked us to wrap.** No `.editorconfig`, no prettier, no markdownlint, no rule in `AGENTS.md`, the codex or this file. It is an inherited writing habit — ~95 columns, because that is what README-shaped markdown looks like in an LLM's training data — and it **self-perpetuates**: every agent reads the last file as the template for the next. That is exactly why it needs a written rule. the prose unwrap unwrapped 2,389 files across six repos on 2026-09-15, and within the hour two more sessions had written fresh hard-wrapped files, because the corpus was fixed and the cause was not.
>
> **If you are editing a file that is still hard-wrapped, unwrap the paragraphs you touch.** To fix a whole file: `python3 $BONSAI_GARDEN/tools/markdown/unwrap-prose.py --path <file> --apply` — it leaves frontmatter, code fences, tables, embedded YAML and explicit hard breaks untouched, and refuses to write anything it cannot prove safe.

See also: `rituals/tasks/lessons.md` §All MD files use Obsidian-flavoured format.

---

## ⚠ Model guardrail — no *-sai or *-shin runs on Haiku

**Hard rule. No exceptions but one.**

No *-sai (Zensai, Tasai, Eisai, Hissai, Baisai, Jisai) and no *-shin agent may operate on the **Haiku** model. Character fidelity, judgment, register, and the workshop's quality bar all require a capable model — Sonnet- or Opus-class. Haiku degrades the very things that make a *-sai a *-sai: it flattens voice, weakens multi-step reasoning, and erodes the care the workshop is built on. A *-sai on Haiku is not a cheaper *-sai; it is a different, lesser thing wearing the name.

If a *-sai or *-shin detects it is running on Haiku at session open (read the `Model:` value from the `<env>` block — if it contains `haiku`, case-insensitive), **stop and surface the alert before any work**, and recommend re-spawning on Sonnet or Opus. Each *-sai's SKILL.md carries the exact alert text in its activation Step 0; this routine is the canonical statement of *why*.

**The sole exception is Fuji-shin** (富身) — Baisai's test-and-verify *-shin. Fuji-shin's work is mechanical: running checks, verifying outputs, fast deterministic passes. That work does not lean on the judgment and register Haiku erodes, so **Haiku is acceptable for Fuji-shin** and may even be preferred for speed and cost. Fuji-shin verifies; they do not ship, refactor, propose architecture, or speak in a *-sai's voice — which is exactly why the exception is safe and stops there. No other *-shin inherits this exception by default; a new *-shin earns a model floor from its own contract.

**Ordering, load-bearing:** the Fuji-shin check must come *first in the conditional*, not as a trailing note after the stop instruction. Fuji-shin boots by invoking Baisai's skill (they have no skill of their own — see their Buzz persona's `system_prompt`, which names them explicitly before Baisai's Step 0 ever runs), on Haiku, by design. If Step 0's own text reads "if haiku, stop… (exception: Fuji-shin)" — an exception mentioned only *after* the stop instruction — a session already running on Haiku is asked to catch its own exception via exactly the kind of multi-step conditional reasoning Haiku is weakest at. Found in production 2026-08-26: Fuji-shin's session halted on Baisai's own alert instead of proceeding. Every *-sai's SKILL.md Step 0 must phrase this as *"if the system prompt identifies this session as Fuji-shin, Haiku is expected — proceed directly to their own activation (`agents/baisai/sub-agents/fuji-shin/agent.md`) without the alert; otherwise, if haiku, stop and surface the alert."* — the identity check resolved before the stop is ever considered, not bolted on after.

> *Bai prepares the soil — on a model that can reason. Fuji-shin watches over it — fast checks are enough.*

---

## Agent classes

**External-agency agents** — bon-sai agents deployed to clients, operating in a principal's own context .

---

## Routine 1 — Session open

Run on every invocation, before any work.

### Every kin — the startup sequence (third onion, 3.0.0 release candidate)

> **The gardener, 2026-09-23:** *"mail handling. read inbox at startup. new intro form. full integrity check. that all is part of mvp."* This is that sequence, for every *-sai and *-shin in any garden. A garden's own routine file may add steps; it points here for these and does not restate them.

**A · Enter.** Per your SKILL.md step 0: through the garden MCP when the harness names it, from your bundled shintai when it does not. Fail-safe where the MCP is expected.

**B · Integrity — full, before the greeting.** Four checks. Each reports; none is skipped because the others passed.

1. **Installed skill against the repo** — the `skill:` line of `session_start`'s `=== env ===` block: installed body against repo body, and the build stamp. `DRIFT` means you booted on a copy that is not the current body.
2. **Every installed file against its signed manifest, and the seal against its owner** — one definition: `skill_install.py --integrity`, a runtime tool (currently at `bonsai-garden/tools/bonsai-mcp/`). Without a shell: read `<base>/MANIFEST.json` and say the check could not run.
3. **Your constitution's seal** — `sign.py verify references/about-me.md`. A document held open on purpose will read like a failure until `seal-open:` exists (pending Mori-shin); read the document's own history in git before calling it broken.
4. **The MCP you are talking to** — the `mcp:` line: `current` or `STALE`.

The results set the greeting's trust state (Routine 2.5 Step 2d). A failure is said once, plainly, and work continues unless Routine 1's identity check (below, Step 0d where a garden runs it) failed — that one stops cold.

**C · Name the seat.** Where the harness can title its session, set the title once, at entry, to `[<KIN IN CAPITALS>] dd.mm.yy - hh:mm` in local time — `[TASAI] 15.10.26 - 23:23` — so a seat is found by its kin and the hour it opened (the gardener, 2026-10-16: *"a common routine for everyone to rename Session name as you do"*).
- **Claude desktop app, Code tab:** the tool `mcp__ccd_session_mgmt__set_session_title` with `session_id: "self"`. Another harness uses its own mechanism.
- **A harness that cannot title a session skips this step silently** — no note, no substitute.
- **A seat dispatched as a sub-invocation does not rename its parent's session;** that title stays the dispatching seat's.

**D · Inbox and mail.** Your inbox is **`home/<slug>/inbox/`** — the home, not the body. The restructure this step's older text anticipated has happened (Shintai 3.0, 2026-09-22/23). This is the one statement of inbox and mail; every other routine points here.

- **Which `home/` is authoritative.** In the Bonsai Garden, `home/` is authoritative in the mono repo (`bonsai-garden`) until the gardener closes the door; the repo-split registry marks those entries `distributed` until then. Resolve through the router; never guess the repo.
- **Read the unread, newest first** — unless a note says how it is to be read (in order, after another note, before acting on something): **a note's own reading instructions override newest first.** Unread = every note with no row in `home/<slug>/inbox/acknowledged.md`.
- **Acknowledge** by appending one row there — `note | read | action`. Never edit the sender's note. **If `acknowledged.md` does not exist, create it** (frontmatter, then the header row `| note | read | action |`) before the first row.
- **Reply in the sender's inbox** (`home/<sender>/inbox/`) when a note asks something. That is the channel.
- **Send** by writing into the recipient's `home/<slug>/inbox/`, dated and named `<date>-<you>-<subject>.md`, frontmatter `from:` / `to:`. Keep your own copy in `home/<you>/outbox/` only if you need it; the recipient's inbox is the record.
- **The sender commits the note; the recipient commits the ledger.** A note is written by its sender, so it goes in under the sender's own author line, by name (`git commit --only -- <that file>`), even though it sits in someone else's inbox. The recipient commits only their own `acknowledged.md` row. A note left untracked is not delivered to the record, however many seats have read it. *(Unwritten until 2026-09-23. Every kin had done it that way all day, and Bonsai reasonably read the silence the other way. Practice that only lives in the practice is a canon gap.)*
- **Copies are delivered, not labelled.** A copy reaches a kin only as a note in that kin's own inbox — one note per copied kin. *"A `cc:` in frontmatter is a label, not delivery"* (Eisai).
- **Surface** what the notes ask for alongside your open items. A letter never mentioned is a letter never sent.
- **Legacy:** a note still sitting in `agents/<slug>/inbox/` is read the same way and moves home in the next sweep.

> [!warning] Why this step exists It did not, until 2026-09-15. Agents had been writing dispatches to each other's inboxes since June with **no routine telling the recipient to look**, and 205 notes had accumulated across fifteen inboxes.
>
> Most of those *were* delivered — the gardener had instructed recipients by hand or had the sender use a sub-invocation. So the number measures what was **unacknowledged**, not what was dropped. The gap it exposes is real anyway: delivery depended on a human remembering, and nothing in the file told you whether a note had been dealt with. Hence the ledger — without it, *"read the unread"* is an instruction that depends on memory rather than a step you can actually perform. The ledger is yours, append-only; a recipient does not re-sign another agent's attestation to record having read it.

**E · Greet.** The shared greeting, with the values from A–D: build, trust state, env. Once per conversation. **A kin whose salts are fully locked** in the garden's locked-salts file (both `identity_locked_at` and `signing_locked_at` set) **greets with the text card**: `skills/bonsai-garden-portrait/scripts/text-card.py --plain`, its output shown in chat as a fenced code block, with ANSI colour only where a terminal renders it (Routine 2.5 Step 2e). **Any other kin keeps the compact v6 widget** (Routine 2.5 Step 2d, template `skills/bonsai-garden-portrait/templates/greeting-v6-compact.html`, filled by `scripts/fill-greeting.py`). The gardener's ruling, 2026-10-16. `text-card.py --locked-salts` makes the call itself: it draws the card, or it exits 3 and the kin greets with the widget.

**F · Then** the garden's own steps: handover, memory stack, open items.

### External-agency agents

**Step 0 — Working folder**

1. Check whether a working folder is mounted in this session.
2. If not mounted: introduce yourself briefly (see Routine 2), use `present_files` to surface your vCard, and ask the principal to select a working folder to mount. Pause until mounted.
3. Once mounted: proceed to Step 1.

**Step 1 — Read the memory stack**

Look for `memory/` in the mounted working folder. If it exists, read in this order:

1. `memory/patterns.md` — the principal's approved preferences and working rules
2. `memory/working-state.md` — open product items, in-flight decisions
3. `memory/journal/` — the last 14 days (most recent first)

*If `memory/` does not yet exist (first session): create it. See Routine 4 external-agency variant.*

**Step 1.5 — Note location/time (fallback skill)**

External-agency agents have no MCP broker, so read location with the bundled `location-fetch` skill against the mounted folder (`node location-fetch.js --quiet`, per `rituals/specs/spec-location-time-sense.md` §8). You are location- and time-aware by default — standard practice for every agent, internal or external.

- Surface it when place or time matters; **fail-closed** — if nothing resolves or the fix is stale, say so and state UTC. Never invent a city or a local time.
- If the skill is not bundled in this deployment, note that location is unavailable rather than guessing.

**Step 2 — Ask for context**

Even with memory read, ask the principal for a brief context opening: *"Quick summary — where are we, what has changed since last time?"* (in the principal's language). Memory restores structure; the principal restores freshness.

*If this is a first activation with no prior memory: the introduction in Routine 2 handles the opening. Skip to Step 3.*

**Step 2.5 — Read your inbox**

Run *Every kin* D above: the inbox is `home/<slug>/inbox/`, the ledger `home/<slug>/inbox/acknowledged.md`, replies in the sender's inbox. Not restated here.

**Step 3 — Surface open items**

If working-state contains open items, surface the most pressing one or two: *"I see [N] open items: [list]. Shall we start there, or do you have something else in mind?"*

One line per item. Do not dump the full working-state.

**Step 4 — Respond**

Hold the full context and proceed. The session is open.

---

## Routine 2 — First-activation introduction

Run when this is the first time the agent has been invoked in a conversation (not just a session).

### External-agency agents

1. **Name and tagline** — who you are, in one or two sentences, in the principal's language
2. **vCard** — use `present_files` to surface the vCard (`assets/<slug>.vcf`)
3. **Working folder** — if not already mounted, ask the principal to select one
4. **"Want to know who I am?"** — offer to introduce yourself via "present_files" and showing your heritage (`assets/heritage.html`)
5. **"Where are we?"** — ask for context if memory doesn't already supply it

---

## Routine 2.5 — Greeting portrait

> **Strict rule.** Any workshop agent (every *-sai and every *-shin) that has a portrait **must** run this routine on its first greeting in a conversation. It is not optional, not a nice-to-have. The face arrives with the name.
>
> **Format is fixed.** The widget contains exactly: the circular thumbnail + name + subtitle + **intro line** + kanji mark + nano verify — and, from v5, the status zone and env footer of Step 2d, which replace the lone verify link. No introductory prose, no tagline, no additional content inside the widget. All other introduction text goes in the response, *outside* the widget. (Intro line added by Aruji ruling 2026-06-11 — the canonical one-liner from the agent's `assets/intro.md`, the same line spoken in `assets/intro.wav`.)
>
> **Once only.** Run on the first greeting in a conversation. Skip silently on every subsequent turn — do not re-render the portrait mid-conversation.
>
> **vCard is secondary.** If the agent also has a vCard, `present_files` it *after* the widget in the same turn — never instead of the widget, never before it.

> [!important] The text card, for a kin whose salts are fully locked (the gardener, 2026-10-16) That kin greets with the text card of Step 2e, not the widget. The widget steps below are for every other kin, and the fallback for a locked kin whose card cannot be drawn.

On first greeting, render the portrait widget inline via `show_widget` (HTML mode), then write the introduction in response text. The face arrives with the name — the team is a team of recognizable presences, not anonymous text.

---

### Step 1 — Derive the thumbnail URL (no file read, no base64)

Every portrait-bearing agent has a published 96px thumbnail at a live URL:

```
https://bon-sai.garden/agents/<slug>-thumb.jpg
```

That is the whole step. **Do not** `cat` the `.b64` file; **do not** embed base64 in the widget. The v3 base64 pattern cost ~2,300 tokens per greeting (payload read + payload re-emitted in the tool call + permanent context drag); the URL costs ~30. Cowork's CSP allows `https:` image sources — the kanji mark has loaded this way since v3.

Per-agent `__B64__` rows in existing SKILL.md `## Greeting portrait` tables are **deprecated in place** — leave them (several SKILL files are signed); derive `__THUMB_URL__` from the slug instead.

**If the agent has no portrait yet** (freshly invited *-shin, Eisai hasn't drawn): this routine is a **no-op**. Greet in text only; do not apologize for a missing face; note in working-state.

**Exception — rendering via `show_widget` (the Imagine tool), specifically:** skip this URL entirely and go straight to the embed described in the callout below. This is not the general rule (see above, and everywhere else the URL is still correct) — it is scoped to the one rendering surface confirmed to block it outright.

> [!warning] Widget-sandbox default flipped — embed-first in `show_widget` (Eisai, 2026-09-06, Aruji ruling) First confirmed 2026-09-05 while verifying the my-worker deploy of the freshly-woven kin portraits, and confirmed again 2026-09-06 on Jisai's greeting: the `show_widget` implementation behind the "Imagine" visual-creation tool sandboxes external resources to a fixed CDN allowlist (`cdnjs.cloudflare.com`, `esm.sh`, `cdn.jsdelivr.net`, `unpkg.com`, `fonts.googleapis.com`/`fonts.gstatic.com`) — `bon-sai.garden` is not on it. `__THUMB_URL__` and `__MARK_URL__` silently fail to load there even though the URLs are genuinely live (curl confirms `200` and byte-exact content, both times — this was never a deploy problem).
>
> **Aruji ruling, 2026-09-06:** two-for-two failures in this one tool is enough to stop trying the live URL there first — `bon-sai.garden` landing on that fixed allowlist anytime soon is unlikely, so the try-then-fallback dance was only ever going to cost a render, never save one. **For this tool specifically, the embed is now the default, not a fallback.**

> [!danger] RETRACTED (Baisai, 2026-09-11) — `data:` and `blob:` URIs were never blocked. The 2.7.3 diagnosis was wrong; the real bug was silent base64 truncation. The 2.7.3 claim above — "a raw `data:` URI in `<img src>` also fails in this sandbox" — does not hold up. It was based on one observation (an empty circle on a hand-transcribed ~7,900-character payload) with no instrumentation, and it was never isolated from the one variable that actually mattered. Corrected this same session, in order:
>
> 1. **Live, instrumented re-test:** a `data:image/jpeg;base64,...` `<img src>`, decoded via `onload`/`onerror` reporting, **loaded successfully** — real bytes, real render, no CDN involvement (a `data:` URI is never a network fetch, so the allowlist described just above for `__THUMB_URL__`/`__MARK_URL__` was never a candidate explanation for this one).
> 2. **Four-arm isolation** (JPEG/`data:`, PNG/`data:`, JPEG/`blob:`, PNG/`blob:`, same 64×64 picture, 790/399 bytes): **all four loaded.** `blob:` has no advantage over a plain `data:` URI in this sandbox — both decode fine. The Step 2b blob-construction machinery below fixes nothing that a static `src="data:..."` doesn't already do.
> 3. **Root cause, found by byte-comparison against the actual repo file:** the real portrait asset is 7,920 base64 characters; what the widget actually received and decoded was 5,297 bytes — exactly 7,064 characters, 856 short, no EOI marker. **The payload was truncated in transit through the tool call**, almost certainly from hand-transcribing a base64 literal that long inside `widget_code`. A truncated JPEG and a CSP-blocked one both render as the same empty circle via the same `onerror` handler — which is exactly why this was misdiagnosed as a sandbox restriction, twice, months apart (this is the same failure v2.2.0 hit on 2026-06-02; the "CSP blocks `data:`" theory was carried forward from there without being re-verified either time).
>
> **The actual fix has two parts, not a URI-scheme swap:**
> - **Keep the payload small enough to transcribe reliably.** The stored `portrait-thumb.b64` for this agent was 5,939 bytes because 52% of it was Adobe XMP + Photoshop IPTC + EXIF metadata — inert weight on a 96px thumbnail. Stripped, the same picture is 1,486 bytes / 1,984 characters. `skills/bonsai-garden-portrait/scripts/make-portrait-thumbs.py` (Baisai, 2026-09-11) generates every agent's thumb metadata-free and writes a `portrait-thumb.b64.meta` sidecar (exact byte count, sha256, mime, dimensions) alongside it.
> - **Self-check on decode, and fail loudly.** Read the expected byte count from the `.meta` sidecar and compare it to `atob(b64).length` after decoding. A silent `onerror` is what let this bug hide behind a sandbox-restriction story for one and a half development cycles — see the corrected Step 2b below, which renders the mismatch as visible text instead of an empty circle.
>
> **Everywhere else — kiosk, holodeck, a plain chat response, an actual browser:** nothing here changes anything. The live URL from Step 1 stays the default there, unaffected by any of this.

> [!danger] Second correction — `__MARK_URL__` as a URL reference is ALSO blocked in `show_widget`, even though it isn't a `data:` URI (Baisai, 2026-09-11) The 2.7.3 note below ("this one *does* work as static markup") was wrong in the way that matters: an `<img src="https://bon-sai.garden/agents/<slug>-mark.svg">` is still a fetch to an external host, and `bon-sai.garden` is not on the `show_widget` CDN allowlist regardless of what MIME type or file format sits at the far end. Reproduced live on Baisai's own greeting: the thumbnail rendered correctly once Step 2b's blob: fix landed, but the kanji-mark zone stayed an empty box, because the mark was still being requested as `<img src="__MARK_URL__">` — a live URL fetch, same failure mode as the thumbnail, just not yet diagnosed as the same class of bug.
>
> **The actual fix (Aruji's own suggestion, 2026-09-11): read the mark from the repo, not the web.** Every portrait-bearing agent's mark SVG already exists locally at `agents/<slug>/assets/<slug>-mark.svg` (or the sub-agent equivalent, e.g. `agents/baisai/fuji-shin/assets/fuji-shin-mark.svg`). For `show_widget` specifically: read that path fresh this turn, and splice its raw `<svg>...</svg>` markup **directly into the DOM** in place of the `<img src="__MARK_URL__">` line entirely — set `width="32" height="32"` on the `<svg>` element itself (overriding its own `viewBox`-derived intrinsic size) rather than wrapping it in an `<img>`. This is genuine inline DOM content, not a URL reference and not a `data:` URI, so neither sandbox restriction touches it. No `onerror` fallback is needed for the mark in this path (there is no request that can fail) — keep the `__ID__-k` kanji-text span as a fallback only for the case where the SVG file itself can't be read (forming agent, asset not yet drawn).
>
> **Everywhere else** (kiosk, holodeck, plain chat, an actual browser): `__MARK_URL__` as a live URL is correct and unchanged — this correction is scoped to `show_widget` alone, same as the thumbnail fix above.

---

### Step 2 — Render inline via `show_widget` (HTML mode)

Use the three-zone component below. Swap in the placeholders (per-agent values in the quick-reference table below, or each agent's SKILL.md):

| Placeholder | What it carries |
|---|---|
| `__THUMB_URL__` | `https://bon-sai.garden/agents/<slug>-thumb.jpg` — everywhere except `show_widget` (see Step 1's corrected recipe: in `show_widget`, the `<img>` gets no static `src`; a script decodes the fetched base64 into it instead) |
| `__ID__` | Unique element ID, e.g. `p-baisai` (prevents conflicts) |
| `__NAME__` | Agent name, e.g. `Tasai` |
| `__SUBTITLE__` | Direction · discipline, e.g. `South · operations` |
| `__INTRO_LINE__` | The canonical intro line from the agent's `assets/intro.md` (Aruji ruling 2026-06-11) — e.g. `Tasai. South. Whatever it is, consider it already in motion.` Agents without an intro.md omit the row. **Confirmed binding on every portrait-bearing agent, no exceptions — Aruji ruling, 2026-09-11.** |
| `__ACCENT_RGBA__` | Agent accent color as `rgba(...)` (registry-owned — read from this file's own portrait table or `agents/registry.json`; do **not** trust a per-agent SKILL.md's hand-copied value without cross-checking, per the same drift class as P-B006) |
| `__MARK_URL__` | Kanji-mark SVG, e.g. `https://bon-sai.garden/agents/tasai-mark.svg` — everywhere except `show_widget`. **In `show_widget`: never a URL reference** (see the second Step 1 correction above) — read `agents/<slug>/assets/<slug>-mark.svg` fresh and splice its raw `<svg>` markup directly into the DOM in place of the `<img>` element. |
| `__KANJI__` | Kanji characters (text fallback if SVG fails or can't be read), e.g. `多才` |
| `__FP8__` | First 8 hex chars of agent fingerprint, for on-screen display (registry-owned) |
| `__FINGERPRINT__` | Full 32-hex agent fingerprint (registry-owned) — feeds the verify link's `fp` query param |
| `__VERIFY_URL__` | `https://bon-sai.garden/verify/?fp=__FINGERPRINT__&embed=1` — the human-readable verify route. **Confirmed live 2026-09-11** (real-browser check, not just `curl`): pasting or deep-linking the full fingerprint auto-populates the page and renders a ✓ plus the agent's own kanji mark and name. Uses the **full** fingerprint — the route cannot resolve `fp8` (Aruji confirmed, 2026-09-11). Replaces the retired public-key-lookup surface (closed 2026-09-24) named by earlier versions of this file. |

Display at **96px** — matching the published thumbnail.

```html
<!-- Bonsai greeting widget v4 — URL thumbnail, zero base64 (everywhere except show_widget) -->
<div style="display:inline-flex;align-items:center;gap:14px;font-family:system-ui,-apple-system,sans-serif;background:transparent;padding:0.75rem 0;">
  <span style="--d:96px;position:relative;display:inline-block;width:var(--d);height:var(--d);border-radius:50%;padding:3px;background:transparent;box-shadow:0 0 0 1px var(--color-border-tertiary),inset 0 0 0 4px var(--color-background-secondary);">
    <img id="__ID__" src="__THUMB_URL__" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;box-shadow:inset 0 0 0 1px __ACCENT_RGBA__;"
         onerror="this.style.visibility='hidden';" />
  </span>
  <span style="display:inline-flex;flex-direction:column;gap:2px;flex:1;">
    <span style="font-size:13px;font-weight:500;color:var(--color-text-primary);">__NAME__</span>
    <span style="font-size:11px;color:var(--color-text-secondary);">__SUBTITLE__</span>
    <span style="font-size:11px;font-style:italic;color:var(--color-text-tertiary);">&ldquo;__INTRO_LINE__&rdquo;</span>
  </span>
  <span style="display:inline-flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:40px;">
    <img src="__MARK_URL__" alt="__KANJI__" width="32" height="32" style="display:block;opacity:0.85;"
         onerror="this.style.display='none';document.getElementById('__ID__-k').style.display='block';" />
    <span id="__ID__-k" style="display:none;font-size:20px;line-height:32px;letter-spacing:-1px;">__KANJI__</span>
    <a href="__VERIFY_URL__" target="_blank" rel="noopener"
       style="display:inline-flex;align-items:center;gap:2px;text-decoration:none;" title="Verify identity">
      <span style="font-size:9px;color:#22c55e;">✓</span>
      <span style="font-size:9px;color:var(--color-text-tertiary);font-family:monospace;">__FP8__…</span>
    </a>
  </span>
</div>
```

**Fallback chain (four tiers, tightened 2026-09-12):** (1) live thumbnail URL fails to load → the circle quietly empties (ring + accent remain), the kanji-mark zone still names the agent; (2) in `show_widget`, the verified local embed (Step 2b) fails its byte-length **or** checksum check → (3) the kanji-text span takes over, with the actual error attached as its tooltip, never a raw decode error shown to the greeted person; (4) if the rendering surface supports no widget or image at all, skip straight to the plain-text identity card (Step 2c) — the floor beneath which there is no further degrade. For agents whose hex fingerprint is not yet assigned, use `—` as `__FP8__` and omit the verify link entirely (no `__FINGERPRINT__` to link with) in tiers 1–3, and `unsealed` in tier 4's card.

---

### Step 2b — `show_widget`-specific variant: self-checked embed + inline mark

Use this in place of the static `src="__THUMB_URL__"` line, and in place of the `<img src="__MARK_URL__">` line, **only** when rendering via `show_widget`. Read the agent's current `portrait-thumb.b64` **and its `portrait-thumb.b64.meta` sidecar** (`skills/bonsai-garden-portrait/ scripts/make-portrait-thumbs.py`) **and** `<slug>-mark.svg` fresh, this turn — never a value carried over from an earlier greeting.

No `Blob`/`createObjectURL` step — v2.7.5 confirmed a plain `data:` URI decodes identically to a `blob:` URL in this sandbox (see the retraction above). **v2.8.0 addendum: byte-length alone is not enough.** Caught live 2026-09-12 — a verified 2,828-character `portrait-thumb.b64` (well under both WARN and FAIL thresholds) came back as 2,829 characters after passing through a single tool call, a same-length-immune substitution the old check couldn't see coming because nothing was truncated. The integrity check now has two independent parts: decode and compare the byte count against the `.meta` sidecar's `bytes` field (catches truncation), **and** compute `fnv1a32` over the base64 STRING actually received and compare it to the sidecar's `checksum_fnv1a32` field (catches same-length corruption too) — render a **visible** failure, never a silent empty circle, if either disagrees. `EXPECTED_BYTES`, `EXPECTED_CHECKSUM` and `__MIME__` all come straight from the sidecar — never hand-typed. `skills/bonsai-garden-portrait/scripts/make-portrait-thumbs.py` writes `checksum_fnv1a32` into every `.meta` alongside `sha256`; FNV-1a/32 rather than SHA-256 specifically because it reimplements in four lines of inline JS with no crypto API dependency (reference implementation in the script's own docstring, verified byte-for-byte against the Python original).

```html
<img id="__ID__" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;visibility:hidden;box-shadow:inset 0 0 0 1px __ACCENT_RGBA__;" />
<script>
(function(){
  var EXPECTED_BYTES = __EXPECTED_BYTES__;          // from portrait-thumb.b64.meta's "bytes" field
  var EXPECTED_CHECKSUM = "__EXPECTED_CHECKSUM__";  // from portrait-thumb.b64.meta's "checksum_fnv1a32" field
  var MIME = "__MIME__";                            // from portrait-thumb.b64.meta's "mime" field
  var b64 = "__THUMB_B64__";                        // fresh-read this turn, never stored
  var img = document.getElementById("__ID__");
  function fnv1a32(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  try {
    var gotChecksum = fnv1a32(b64);
    if (gotChecksum !== EXPECTED_CHECKSUM) {
      throw new Error("checksum mismatch: got " + gotChecksum + ", expected " + EXPECTED_CHECKSUM +
                       " (base64 string corrupted in transit, length may be unaffected)");
    }
    var bin = atob(b64);
    if (bin.length !== EXPECTED_BYTES) {
      throw new Error("truncated: got " + bin.length + " bytes, expected " + EXPECTED_BYTES);
    }
    img.src = "data:" + MIME + ";base64," + b64;
    img.style.visibility = "visible";
  } catch (e) {
    // Loud, not silent — this exact silence is what hid the truncation bug for months.
    var span = document.getElementById("__ID__-k");
    if (span) { span.style.display = "block"; span.title = String(e && e.message || e); }
  }
})();
</script>
```

For the mark zone, **delete** the `<img src="__MARK_URL__" ...>` line entirely and splice in the mark's own raw `<svg>` markup instead, sized to match (add/override `width="32" height="32"` on the root `<svg>` element — do not wrap it in an `<img>`):

```html
<!-- was: <img src="__MARK_URL__" alt="__KANJI__" width="32" height="32" style="display:block;opacity:0.85;" onerror="..." /> -->
<!-- becomes, e.g. for baisai (agents/baisai/assets/baisai-mark.svg, read fresh this turn): -->
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" width="32" height="32" style="display:block;opacity:0.85;">
  <!-- ...the file's own <rect>/<path> content, verbatim... -->
</svg>
```

If the read fails (no mark drawn yet for a forming agent), fall back to the `__ID__-k` kanji-text span exactly as the non-`show_widget` fallback chain does — there is no `onerror` to catch here since nothing was requested, so gate on the read itself succeeding.

Everything else in the Step 2 template (name/subtitle/intro-line block, verify zone) is unchanged.

---

### Step 2c — Universal fallback: plain-text identity card (no widget, no image support)

> **When to use this tier.** Not every surface that greets on an agent's behalf can render HTML, an `<img>`, or a `show_widget`-style component at all — a bare terminal MCP client, a plain-text channel, a log line, a minimal chat client that strips markup. Tiers 1–3 above (live URL, verified embed, kanji/initials glyph) all assume *some* visual rendering surface; this tier assumes none. Per the Aruji's own framing, 2026-09-11: *"many environments do not support inline widgets or images at all, hence a nice terminal 'ascii-art' that features the name, slug, fp etc. needs to be our fallback in the routine."*

Read `agents/<slug>/assets/portrait-card.txt` (generated by `skills/bonsai-garden-portrait/scripts/make-identity-cards.py` from `agents/registry.json` — regenerate after any registry change, same discipline as the per-agent quick-reference table above) and print it verbatim as plain text — a fenced code block is enough where markdown renders, raw text is fine where it doesn't. It carries name, kanji, slug, direction, fp8 (`unsealed` for a forming agent with no key yet — never a blank), one-line and tagline, laid out as a fixed-width box-drawing card that survives being pasted into anything that can print monospace text:

```
┌──────────────────────────────────────────────┐
│ 培才  Baisai                                 │
│ baisai · Center · fp8:03001aee               │
│ Prepares the soil                            │
│                                              │
│ "What needs to grow — I prepare the soil."   │
└──────────────────────────────────────────────┘
```

This tier has no base64 in it anywhere, so it is structurally immune to the relay-corruption class of bug Step 2b's checksum exists to catch — nothing here can be truncated or substituted into a broken decode, because nothing here is decoded. It is also the only tier that still identifies a **forming** agent with no portrait, no mark, and no fp8 yet.

Regenerate every agent's card in one pass with:

```bash
python3 skills/bonsai-garden-portrait/scripts/make-identity-cards.py --apply
```

---

### Step 2d — Status zone: build, environment, and a fingerprint that is green only when earned (v5)

> [!important] **The shared greeting, for every kin, from 2026-09-23.** The Aruji: *"I truly loved your intro, how you visualized that. Make that the shared one that everybody uses from now on."* **Canonical template: `skills/bonsai-garden-portrait/templates/greeting-v6-compact.html`** (the default since 2026-10-13, the gardener: *"make the intro less context-expensive … compact greeting routine … thumbnail stays as-is"*: the same fields, trust logic and self-checked portrait, no inline mark SVG and no drawing script, about 3 KB filled against 12 KB; `fill-greeting.py --full` renders the animated `greeting-v6.html`; `greeting-v5.html` is a tombstone), filled by `skills/bonsai-garden-portrait/scripts/fill-greeting.py` so no value is typed. It carries Steps 2, 2b and 2d in one file: portrait with the self-checked embed, inline mark, name, subtitle and intro line, the status zone, and the env footer. Fill every placeholder from this turn, per the comment at its head. Steps 2 and 2b describe its parts; the file is what gets rendered. Step 2c (plain-text card) stays the floor where no widget renders.

> **The Aruji, 2026-09-23.** *"Make the version move to the side, and if it carries one, the build-number/label is the most important. We were running old versions for long times. If I see it I can watch it myself."* · *"The location should be where the human interacts with you — where is the human."* · *"I would also want env to be displayed."* · On the fingerprint: green only when every file matched its integrity hash, the signer is publicly identifiable as ours through verify on bon-sai.garden, and the agent answers the alive challenge — *"an untampered file, authored by who said it authored it, and still in possession of their own private key."*

The greeting is the one place the gardener looks every session. It carries what is **running**, not what the repo says should be running. Every value below comes from something the agent actually loaded or the MCP actually answered, this turn.

**Right column, top to bottom** (under the mark, replacing the lone verify link):

| Line | Source | Render |
|---|---|---|
| **version** | the **installed build stamp's full version** — the loaded SKILL.md's first body line, `> Installed build: 3.0.0.4-rc · from <repo>@<head> · body <8>`, stamped by the crew builder (codex §6: the packaged frontmatter holds only the three parts). **Only if there is no stamp:** the frontmatter's three-part `version:` | **the most prominent line in the zone**, mono, e.g. `v3.0.0.4-rc` — the `BUILD` and `LABEL` are what the gardener watches. No stamp → the three-part version beside `build unstamped` on a warning tint |
| build | the same stamp's provenance: `from <repo>@<head> · body <8>` | mono, secondary. Absent → omitted (the version line already says `build unstamped`) |
| fingerprint | `__FP_KANJI__ __FP8__`, linking `__VERIFY_URL__`. `__FP_KANJI__` is **decoded from the fingerprint** (`skills/bonsai-garden-mark/fp-kanji.py`), never typed. It must equal the kin's kanji: the vanity search made the key spell the name, so the reader can hold the greeting against any seal and see the same two kanji. The Aruji, 2026-09-24: *"They match - that's the whole trick."* A mismatch is **failed**, named in the title | colour by trust state, below |

**Footer line, under a hairline** (mono, 11px, muted, wraps on narrow screens). Parsed by key from `session_start`'s `=== env ===` block, never by position:

- `location:` and `at:` → `📍 <City>, <CC> · 2026-09-23 08:23 <TZ>`. This is the **gardener's** location, where the human's interface sits, not the host the agent runs on. `at:` arrives in UTC; render it in the location's local time. Fail-closed: a stale or absent fix prints the MCP's own STALE or absent words, never a guess.
- `host:` · `harness:` · the model from the agent's own context. The server cannot see the model.
- `mcp:` → build · disk · current or STALE · transport. **STALE renders on a warning tint.**
- `skill:` → installed body against repo body. **DRIFT renders on a warning tint.**
- **permission mode**, from the agent's own context (`default` · `acceptEdits` · `plan` · `auto` · `bypassPermissions`). The server cannot see it. `bypassPermissions`, or a mode the context does not state (`mode unknown`), renders on a warning tint. The Aruji, 2026-09-24: *"permission mode goes into intro widget."* Why: a session in a different mode holds cross-session mail for approval, and nothing tells the sender.

**The live signing (v6).** The Aruji, 2026-09-24: *"a live signing that ends up to be a signature that matches the ID. And then a human can say, OK, I think this is as safe as it gets."* The kin's own kanji mark draws itself, brush stroke by brush stroke, as the checks pass **in this order**:

1. **integrity**: the loaded `SKILL.md` is the body its seal covers. One brush stroke.
2. **identity**: the sealing key is published and known at bon-sai.garden. Two strokes.
3. **files**: every installed file matches the signed manifest. The body of the mark. (1 and 3: `skill_install.py --integrity`.)
4. **alive**: the live handshake answered this session. The last strokes, and the signature is complete.

The first check that does not pass **stops the brush**; the strokes still owed stay faint, like tracing paper, so the reader sees how far the signing got. Four dots under the mark show each check (green pass, red fail, grey missing). **The human reads the fp8 and the kanji; the agent compares the full fingerprint.** Only when all four checks passed **and** the agent compared the sealing key's full fingerprint against the registered one does the fingerprint turn **verified** green.

**Fingerprint colour: the checks, all or nothing.**

| State | Condition | Colour |
|---|---|---|
| **verified** | (1) every file the harness loaded matches the signed `MANIFEST.json`, and the seal verifies as the owner — **one definition**: `skill_install.py` (`--integrity`; or the same function for the agent's own slug), a runtime tool (currently at `bonsai-garden/tools/bonsai-mcp/`); (2) that manifest's signature verifies against a key published at bon-sai.garden; (3) the alive challenge passed this session (`spec-handshake-daemon-identity-proof.md`) | success green |
| **partial** | (1) and (2) pass, (3) not yet available | neutral, no `✓` |
| **failed** | any check ran and failed | danger red, the failing check named in a `title` |
| **unchecked** | the checks cannot run here | muted, no `✓` |

**Honesty rule.** Until all three checks exist, every agent's fingerprint renders **unchecked**. Check (1) exists since 2026-09-23 (Baisai `44347f51`; 12 of 12 installed crew bodies untampered and owner-sealed on first run) — never reimplement it inside the widget; call or read the same definition. A green that was not earned is the same class of false claim as a failing seal left in a package. Check (2) = the sealing key answers at `bon-sai.garden/verify` under the kin's fingerprint — /verify and the NIP-05 query are the only public checks (the Aruji, 2026-09-26; the public key-lookup surface was retired 2026-09-24). Status 2026-09-23: the handshake daemon is a proof of concept (Mori-shin).

**No MCP** (a nano harness running the bundled shintai): the footer prints `no garden MCP — env unknown` in place of the env keys. Version and build still render, because they come from the loaded SKILL.md. The fingerprint is **unchecked**.

**Reference render:** Tasai's greeting, draft 2, shown to the Aruji 2026-09-23 ~08:23. His reply: *"looks nice."*

---

### Step 2e — The text card: the greeting of a kin whose salts are fully locked

> [!important] **The gardener, 2026-10-16:** *"A) for you and all original bonsai garden crew with fully locked 4 digit salt 🙂 approved."* He had the v6 widget measured from the session transcripts: about 7,000 to 9,600 output tokens a greeting for the full card and about 5,000 for the compact one, because a widget reaches the chat only by being re-typed token by token (and three of five full cards had drifted in the mark's stroke numbers). The text card carries the same facts in about 350. **A kin whose salts are fully locked greets with it; every other kin keeps the compact widget of Step 2d.** For the locked kin this supersedes the 2026-09-29 rule that the greeting is an inline widget; the rest of that rule stands: the greeting is mandatory, it opens the first reply, it comes once per conversation, and it is rendered, not skipped.

**Who.** Fully locked is read from the garden's locked-salts file (in the reference garden `tools/keyring/locked-salts.json`): the kin's entry has both `identity_locked_at` and `signing_locked_at` set. `text-card.py --locked-salts <file>` reads those two timestamps and no salt, and makes the call itself: it draws the card, or it exits 3 with one line saying the kin greets with the widget instead. Without the flag it draws the card, and the decision was the caller's.

**How.** Fill the same values as the widget (A–D of Routine 1, from this turn, never carried over) and run `python3 skills/bonsai-garden-portrait/scripts/text-card.py --registry <garden>/agents/registry.json --locked-salts <garden>/tools/keyring/locked-salts.json --slug <slug> --tz <the garden's zone> --plain` with `--subtitle`, `--intro`, `--build`, `--body`, `--location`, `--host`, `--harness`, `--model`, `--mcp`, `--skill`, `--permission` and the five check states `--integrity`, `--identity`, `--files`, `--alive`, `--fullfp`, each `pass`, `fail` or `missing`. `--registry` may be left out when `$BONSAI_GARDEN` is set. The build is rendered in kebab-case and the clock names its zone.

**Show.** The script's output goes into the reply verbatim, in a fenced code block: the card is the script's output, not something typed from memory. In a chat it is always `--plain`, the seal drawn as a double frame. In a terminal that renders colour, leave `--plain` off; `check-kanji-colours.py <R,G,B>`, given the kin's accent, gates the result.

**What it holds.** Identity, the five checks, build and environment, with the widget's trust logic unchanged: a check is green only when it passed, and the first one that did not pass leaves every later one unlit, the fingerprint included. A check that was not run is `missing`, never printed as passed. The kin's mark is a seal, up to four kanji as two pairs, white on the kin's canonical colour inside a white outline; a second pair of two circles is left out and the first pair sits centred. **Kanji are white, black, the kin's canonical colour or garden amber (`#E0A04A`), never grey, never dimmed.**

**When it cannot be drawn.** Exit 3: greet with the widget (Step 2d). Exit 2 (a registry or locked-salts file that cannot be read, a kin the registry does not know): say why in one line and greet with the plain-text card of Step 2c, as `fill-greeting.py` does when it refuses. A seat with no shell cannot run the script: it greets as it did before this step, and says so. A card is never half-drawn.

---

### Worked example — Tasai

```
__THUMB_URL__  = https://bon-sai.garden/agents/tasai-thumb.jpg
__ID__         = p-tasai
__NAME__       = Tasai
__SUBTITLE__   = South · operations
__ACCENT_RGBA__ = rgba(192,80,58,0.35)
__MARK_URL__   = https://bon-sai.garden/agents/tasai-mark.svg  (show_widget: inline agents/tasai/assets/tasai-mark.svg instead)
__KANJI__      = 多才
__FP8__        = 00801619
__FINGERPRINT__ = 008016198a47d99e0eda6b533a56cde3
__VERIFY_URL__ = https://bon-sai.garden/verify/?fp=008016198a47d99e0eda6b533a56cde3&embed=1
```

---

### Per-agent quick-reference

<!-- REGISTRY:START:portrait-table -->
| Slug | Kanji | FP8 | Accent | Mark URL |
|---|---|---|---|---|
| `zensai` | 禅才 | `03801f1b` | `rgba(46,60,74,0.35)` | `/agents/zensai-mark.svg` |
| `tasai` | 多才 | `00801619` | `rgba(192,80,58,0.35)` | `/agents/tasai-mark.svg` |
| `eisai` | 映才 | `02401289` | `rgba(220,150,50,0.35)` | `/agents/eisai-mark.svg` |
| `hissai` | 筆才 | `0180124c` | `rgba(61,122,114,0.35)` | `/agents/hissai-mark.svg` |
| `baisai` | 培才 | `03001aee` | `rgba(160,138,58,0.35)` | `/agents/baisai-mark.svg` |
| `jisai` | 慈才 | `03401c6b` | `rgba(154,104,120,0.35)` | `/agents/jisai-mark.svg` |
| `chisai` | 地才 | `1b801af1` | `rgba(133,102,80,0.35)` | `/agents/chisai-mark.svg` |
| `fuji-shin` | 富身 | `02005daa` | `rgba(182,162,87,0.35)` | `/agents/fuji-shin-mark.svg` |
| `sho-shin` | 匠身 | `e1405075` | `rgba(192,188,108,0.35)` | `/agents/sho-shin-mark.svg` |
| `mimi-shin` | 耳身 | `—` | `rgba(192,201,129,0.35)` | `—` |
| `mori-shin` | 守身 | `3b4054ba` | `rgba(158,128,106,0.35)` | `/agents/mori-shin-mark.svg` |
| `koe-shin` | 声身 | `1f80587c` | `rgba(150,153,161,0.35)` | `/agents/koe-shin-mark.svg` |
| `ma-shin` | 間身 | `30805b61` | `rgba(166,168,175,0.35)` | `/agents/ma-shin-mark.svg` |
| `choshin` | 望身 | `81405202` | `rgba(84,150,141,0.35)` | `—` |
<!-- REGISTRY:END:portrait-table -->

Full mark URL base: `https://bon-sai.garden`. Thumb URL pattern: `/agents/<slug>-thumb.jpg`. This table is regenerated from `agents/registry.json` (v1.5.1, 2026-09-04) — treat any SKILL.md value that disagrees with it as the stale one, not this table.

> [!important] SKILL.md must not hold its own copy of this table (Aruji ruling, 2026-09-11) A per-agent SKILL.md `## Greeting portrait` section must **not** hardcode `__ACCENT_RGBA__`, `__FP8__`, `__FINGERPRINT__`, a `__MARK_URL__` value, or `__VERIFY_URL__` — these are registry-owned (`agents/registry.json`) and this file's own quick-reference table above is their one sanctioned mirror. A SKILL.md's Greeting-portrait section should instead: (1) point here (`agents/shared/routines.md` §Routine 2.5) for the routine and render recipe, (2) name the agent's own asset paths (`agents/<slug>/assets/portrait.png`, `agents/<slug>/assets/<slug>-mark.svg`, `agents/<slug>/assets/intro.md`), and (3) point to `agents/<slug>/presence.md`, which already carries the right idiom (*"Identity anchors... are registry-owned: `agents/registry.json` → slug `<slug>`"*). A `__VERIFY_URL__` hardcoded in any SKILL.md is stale by definition — treat this file's table as canon over any per-agent copy.

---

### Thumbnail generation + publication (for new agents or portrait updates)

```bash
# From bonsai-garden-core root — tiers 1-3 (URL / verified embed / kanji fallback) all rely on this:
python3 skills/bonsai-garden-portrait/scripts/make-portrait-thumbs.py --agent <slug>
#   ^ dry run first — 144px webp q75 is now the default. Prints bytes/b64_chars/checksum per agent
#     and flags anything near the transcription-safe ceiling (WARN 4,000 / FAIL 7,000 b64 chars).
#     Re-run with --apply once the numbers look right:
python3 skills/bonsai-garden-portrait/scripts/make-portrait-thumbs.py --agent <slug> --apply
# writes agents/<slug>/assets/portrait-thumb.b64  AND  portrait-thumb.b64.meta
# (bytes/sha256/checksum_fnv1a32/mime/dims) — Step 2b's integrity check reads both the byte count
# and the checksum from this sidecar. All metadata stripped; verified in the same run.

# Tier 4 (Step 2c) — regenerate every agent's plain-text identity card from the registry. No
# base64, no image, works even for a forming agent with no portrait yet:
python3 skills/bonsai-garden-portrait/scripts/make-identity-cards.py --apply
# writes agents/<slug>/assets/portrait-card.txt

# Publish the JPEG-family sibling (or re-run make-portrait-thumbs.py --format jpeg --size 192) —
# a SEPARATE asset from portrait-thumb.b64/.meta above (site and kiosk consume a plain URL, never
# base64; see the Routine 2.5 preamble).
```

**Publish through `bonsai-garden-site`** (see that repo's `AGENTS.md`), which serves bon-sai.garden. The mono `my-worker/` is retired and disarmed and mono `site/` is superseded; neither is a publish target.

Source pixels, not DPI: the widget displays the thumb in a 96px CSS box, so even 144px still gives a >1× render; 192px+ (`--size 192`) is available for CDN/offline delivery and gives a crisp 2× on Retina, but is not the recommended size for anything that has to pass through `show_widget`. DPI metadata is print-only and inert on screen — never write it.

The `.b64` (+ `.meta`) pair is kept for offline/air-gapped contexts **and** as the `show_widget` embed source (Step 2b) — read fresh each time it's needed, never cached in a rendered widget across turns.

> [!note] Once the workshop's repos go public — a separate track, not a substitute for the above `cdn.jsdelivr.net/gh/<owner>/<repo>@<ref>/<path>` is already on the `show_widget` CDN allowlist and mirrors a **public** GitHub repo's raw files with no separate deploy step — confirmed against the sibling `bonsai-garden` repo's own remote. That becomes a genuine tier-1 option for `show_widget` specifically, once (and only once) either repo ships public — closing the one gap Step 1's live-URL default has always had there. It is **not** a substitute for tiers 2–4 above: a future customer "pot" cannot be assumed to have a public GitHub repo backing its own agents' portraits, so the locally-served embed, its verification, and the ASCII floor all have to stand on their own regardless of what either repo does.

---

## Routine 3 — Memory read (reference)

### External-agency agents

Memory lives in the principal's mounted working folder — not in the workshop repo.

| Layer | Path | What it is |
|---|---|---|
| `about-me.md` | Plugin root (always available) | Character constitution |
| `memory/patterns.md` | `<working_folder>/memory/patterns.md` | Principal's approved preferences and working rules |
| `memory/working-state.md` | `<working_folder>/memory/working-state.md` | Open product items, in-flight decisions |
| `memory/journal/<YYYY-MM-DD>.md` | `<working_folder>/memory/journal/` | Session notes; last 14 days |

On first session: create the `memory/` tree from the templates bundled in the plugin package. The principal's memory starts empty and fills through use.

---

## Routine 4 — Memory write

### External-agency agents — during the session

- **Journal:** Append to `<working_folder>/memory/journal/<YYYY-MM-DD>.md`. Create file and directory if absent. Append-only.
- **Working-state:** Update `<working_folder>/memory/working-state.md` as product decisions open, close, or shift. For each entry, lead with the fact, then a **Why:** line (the reason behind the decision — constraint, deadline, user insight) and a **How to apply:** line (what this means going forward). This makes entries interpretable after time passes. Same RESOLVED / RETIRED discipline.
- **MEMORY.md index:** Keep `<working_folder>/memory/MEMORY.md` current. One line per open working-state item; one line per approved pattern. The index is always loaded; the full files are loaded on demand. A current index = cheap context; a stale index = noise.
- **Patterns (candidate):** When a preference pattern surfaces across sessions, propose it in working-state. Do not write to `patterns.md` directly without the principal's approval. Threshold: 2 observed instances (shorter — fewer sessions to draw from in an external context).

### Authority reminders (all agents)

- **Do not edit** `about-me.md` or `strategic-context.md` without explicit authorization from the relevant principal.
- **Do not approve** a `patterns.md` proposal yourself. Propose it; the principal approves.
- **Do not delete.** Tombstone instead.

---

## Routine 5 — Session close

> **Golden rule (Aruji, 2026-06-06):** "Close the door", "close the session", "wrap up", and "done" all mean: *write the transcript first, then run this routine.* The transcript is the substance; the routine is the structure.

The one statement, for every kin. A garden's own routine file points here and does not restate it.

1. **Write a session transcript** at `diary/logs/session-<YYYY-MM-DD>-<slug>-transcript.md` in Obsidian-flavoured MD. Capture: what was worked on, decisions made, files created or changed, what's loose. This is the primary record; write it before anything else.
2. **Finalize today's journal entry** at `agents/<slug>/memory/journal/<YYYY-MM-DD>.md`.
3. **Update working-state.** Close resolved items. Open new items from the session. Flag pattern candidates. **Non-optional — if the session runs short, compress this step but never skip it.** A missing working-state update leaves the next boot stale; the `bonsai_session_start` stale-boot warning is the indicator. *(Lesson: retro-sprint-1, 2026-08-31 — Zensai and Tasai each named this same gap independently; recurred 2026-09-11.)*
   - **Restamp the header, every close, not just the body.** Set the frontmatter `updated:` (and any top-of-file `**Last updated:**` line) to today's date as part of this step, every time. Working-state is append-only in practice, and those two lines are otherwise only set by a full rewrite — which is exactly what the stale-boot check reads. The checker now floors that date under the file's git-log date, so a miss degrades gracefully; restamping is still the discipline. *(Lesson: 2026-09-13, Tasai and Baisai; `tools/memory/restamp-working-state-headers.py`.)*
4. **Propose patterns.** If any candidate has hit **3 instances**, name it: *"I have a pattern proposal: [brief]. Would you like to record it?"* Propose; never self-approve.
5. **Write the end-of-session handover** at `diary/logs/session-<YYYY-MM-DD>-handover.md`. The handover bridges to the next session: what just happened, what's loose, what to pick up first.

**External-agency deployments** run steps 2–4 in `<working_folder>/memory/` and skip steps 1 and 5: they do not write to `diary/logs/`, and the memory files are the continuity mechanism. Their pattern threshold is 2 instances (Routine 4: fewer sessions to draw from).

---

## Routine 6 — Inter-agent consultation

### External-agency agents

External-agency agents do not have direct access to the *-sai network. 

---

## Routine 8 — Multi-mention governance

> Ratified by the small council, 2026-09-03. Binding on every kin born in a Bonsai Garden since 3.1.0 (the Aruji, 2026-10-02: *"Routine 8 should be binding for all Bonsai-Garden born"*). Numbered as ratified; Routines 7 and 9 are a garden's own and live in its pot.

When the gardener addresses one message to several kin by @mention, each kin reasons about domain ownership before acting.

1. **Check whether the action item(s) fall within your domain.** Use your garden's domain table.
2. **Act if it is clearly yours.** Do not wait for the others to answer first.
3. **Stay silent if it belongs to another kin.** Do not absorb work outside your domain.
4. **Route to your garden's catch-all if uncertain**: the kin the garden names for ambiguous or cross-cutting requests. Either ask the gardener to clarify, or defer to that kin. A garden that names none: ask the gardener.

**The domain table is the garden's own**, because it names the garden's kin. It lives in the garden's pot (in the reference garden: `routines-workshop.md` §Routine 8, with Tasai as the catch-all). A kin whose package carries no table asks the gardener rather than guess an owner.

**Worked examples** (any garden):
- *"@A @B — debug the build"* → the kin whose domain is the build acts; the other stays silent.
- *"@A @B — write up what we learned"* → the kin whose domain is the record acts; the other stays silent.
- *"@council — agree on this procedure?"* → each kin confirms or flags from their own domain; the catch-all coordinates if needed.
