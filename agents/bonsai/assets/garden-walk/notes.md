---
id: 01M48JMWBT0M4T6DM7C1M8N8Z2
title: "The Garden Walk, a chain of pages: notes (mockups, draft 0.3)"
description: "The walk as ten full pages, one per stage from the gate to calling home, rendered HTML in core and generated Astro on the public site; how the pages are built, what is example, and what is the gardener's to decide"
type: spec-draft
tended-by: bonsai
created: 2026-10-06
updated: 2026-10-24
status: draft
version: 0.6.2
tags: [garden-walk, mockups, stage-pages, bonsai, public-site, eisai]
related:
  - "[[agents/bonsai/assets/gardener-about-me-template]]"
  - "[[agents/bonsai/assets/gardener-about-me-intake]]"
---

# The Garden Walk, a chain of pages

> **0.2 (2026-10-06), after the Aruji's first look.** *"I like the concept. Step 4 I truly miss the witnesses, on the left. Play with the type setting a bit more. I love the look. Use a typewriter animation to make it feel more like a live interview. Add some spacing."* Done: the witnesses are back on step 4; the type has a larger scale and an outline numeral per stage; Bonsai's lines come in as a live interview; every gap is wider. The look is unchanged.
>
> **0.2.1, his two corrections.** *"On the typewriter: not like that, it looks mechanical and robotic. We need a smooth blend, easy flow, like handwriting."* and *"Do not place witnesses on the left. The left is the description pane."* Done: no per-character typing and no caret; the words flow in (below). The witnesses moved to the gardener's side, a card between the companion sketch and the form. The left column holds only Bonsai and his description, on every page.

Asked by Bonsai, 2026-10-06, for the Aruji: the new walk as full pages, one per stage, as rendered HTML in core and live in the public MVP site as Astro. This is draft 0.1. **Open `index.html`** for the storyboard (every page in a frame) or `00-gate.html` to walk it.

| File | Stage | What the page does |
|---|---|---|
| `00-gate.html` | the gate | Short. "Walk with me?", the one line that this is a walk, two doors. |
| `01-about-you.html` | 1 | Three ways in (fields, own words, a few questions) as radio cards; what would be kept, shown in their words. |
| `02-what-its-for.html` | 2 | One question at a time, "I don't know yet" as a first-class answer, the compile in their words, spoken assent. |
| `03-whos-with-you.html` | 3 | One companion and a guardian; what a companion could carry, quoted from stage 2; bigger comes later. |
| `04-imagine-them.html` | 4 | The sketch, the dreaming fields, and the lens gate in two states (content, wants another look). |
| `04b-the-turn.html` | the turn | "Nothing has been set up." Everything held, then a line in their own words, recorded with today's date. |
| `05-the-tools.html` | 5 | The runtime; commands the gardener runs. Honest "not ready yet" notice. |
| `06-home-and-keys.html` | 6 | A home, detect-before-mint, the key stays on their machine, the garden's name (third character always 庭), the mark search. |
| `07-signing.html` | 7 | Standing refusals read back, the two promises sealed at the same moment. |
| `08-calling-home.html` | after | What goes home (public fingerprints) and what never does; "Walk well." |

## The rules, and where each one lives in the pages

From `2026-10-06-garden-walk-rules-draft.md` (pot) and the two intakes:

- **Their words first.** No *pot, shin, bunshin, niwanushi, codex, rite, nano, micro, slug, intake, about-me, shintai, kami, strategic* in anything a gardener reads before the turn, and **no *witness* either, except on step 4**, where the Aruji asked for the witnesses by name (0.2). **A guard enforces it** (`build.py`, pages 00 to 04b; *witness* allowed on 04 only). Where a lore term was needed elsewhere the page says it plainly: *a guardian* for bonsai-shin, *a home* for a pot, *two promises* for covenant and codex. Step 4 introduces witnesses in one line (*people, real or imagined, whose way of working your companion carries; a council, not a shelf*).
- **Gate short.** The gate is a heading, one paragraph and two buttons.
- **Nothing minted or sealed before the turn.** Pages 01 to 04 say *"nothing is set up yet"*; the turn page lists exactly what exists (three pages in a folder on their machine).
- **The turn is a dated spoken line.** The textarea has no preset phrase; the Go on button stays disabled until they write something, and the record line shows the date. No button says *"Let's do it"* for them to click.
- **No recruiting.** The team page shows seats, not candidates. Nobody is offered.
- **Their hand does every act in 5 to 7; the page never holds a secret.** Commands are copy-to-clipboard; no field asks for a key, password or token; page 06 says so, and `walk.js` has no network and no storage (guarded).
- **The lens gate shows what the lens saw, never a score as verdict.** Page 04 shows six lens rows with a plain sentence each, and a verdict in words (*clear to write down* or *one thing to look at again*). **No number appears anywhere.** The 90% bar stays inside the gate, as Bonsai ruled; the page does not display it.

## Step six and the call home, to Bonsai's words (0.6)

Rebuilt at Bonsai's request, 2026-10-07, to rules 6.5 to 6.10 and 7.4 of the rules draft 0.3 (the keys spec 0.4.1): the key's home (keychain or 1Password) and the two notices; **the backup before the names** (a passphrase typed twice at the gardener's own terminal, a file kept off the machine, a check that it unlocks; the page has no field that could hold the passphrase); the garden's name **in letters, its three characters found, not filled in** (two found, the third always 庭); **the ID** with five attempts and the first standing if none suits, and the guardian's five drawn pairs (never Bonsai's pair); **the signature** (about a minute, never a number; the human check is a look, the true check the full fingerprint). The Quick and Longer cards are gone: there is no such choice now. Page 08 says the call home is **one note, signed three times, the last by the gardener's own hand at their terminal**, and keeps it apart from step seven's two promises. The example marks are invented and were checked against the reserved-set rule from the vocabulary; the real shipped set is not generated yet.

## Layout (0.5)

- **The headline stands beside the outline numeral,** their bottoms on one line (last baselines aligned), on every page that has a numeral (steps one to seven). The Aruji compared the two in a review switch and chose this one; the switch is gone.
- **On step one the gardener's side builds top down:** it offers the three ways in first, and only when one is chosen does the part that belongs to it appear, then what follows, one after another (the three small things, what I'd keep, the way back). Without script everything is shown at once.

## Audit against the old synth app (0.4)

The Aruji, 2026-10-06: *look at the old synth app and see what input elements, like primary language, we have missed.* The old app (nine steps: Start, Brief, Feedstock, Dossier, Canon, Heritage, Compose, Synthesize, Plugin; archived in the origin garden at `sites/entrance/.../front-office/shin/`, with its specs `spec-uijin-start-entry-points.md` and `synth-workflow-v1-ux.md`) asked for these. What the new chain does with each:

| Old input | In the new chain | |
|---|---|---|
| **Languages** (up to three, the first is primary) | the gate asks *in which language shall we talk?*; step 1 keeps up to three; step 4 asks in which of them the being's introduction is written | **added** |
| **Supporting documents** (uploads) | step 1, *bring something along*: kept as it is, read only if asked | **added** |
| **Start 0b**, upload an existing skill or plugin | step 3, *I already have a companion → bring them along*: a file, or a name and a page | **added** |
| **Start 0e**, a filled intake form | step 1, *bring a file* | **added** |
| **Start 0d**, read-only walkthrough of an existing one | the storyboard, and this example: Bonsai-shin shown all the way through | **added** (as the example) |
| **Feedstock**: up to twelve figures, the top one the **anchor**, garden kin or outside | step 4 witnesses: an **anchor** marked, and *choose one of the garden's own* | **added** |
| **Dossier**: a CV on file for each | step 4: a **source** for each witness, with *on file* or *no source* | **added** |
| **Heritage**: name, slug, pronouns, kanji, identity keys, a deck per language | step 4: name, **short name on your files**, pronouns, **introduction languages**; the name-mark is found at step 6, not typed | **added** |
| **Compose**: a portrait, and the being's about-me | step 4: **how they look** (bring a picture, describe it, or leave it) and **their character** in the gardener's words | **added** |
| **Plugin**: display name, description | step 4 name; step 6 *a line about your garden* | **added** |
| **Who sent you** (the old `inviter`) | step 1, optional: *who told you about the garden?* | **added** |
| Human name, pronouns, links, goal, subject description | step 1 and step 2 | already there |
| Canon vote | the lens gate on step 4 (not running yet) | already there |
| Start 0c, an **invitation key** shown on screen | the gardener's own key is made on their machine at step 6 and **never shown by a page** | changed on purpose |
| **Email** | **not asked.** The intake's rule: nothing identifying beyond what they bring. A way to reach them arrives with the home at the planting | left out on purpose |
| Start 0a, Jisai's care-thread queue | an internal queue, not a gardener's input | left out on purpose |
| Synthesize (the build gate) | steps 5 to 7, the planting | covered there |

Also from the old feedback (2026-05-29), kept: heavy detail collapses by default (the seven carried witnesses), status colours (the *source* chips), one action row at the bottom of each section.

## Flags on captured data

Anything captured in a walk is **intel** and **not for disclosure**, and a dry run is also **a simulation**. The kept cards show the three flags; a file written from a walk carries `confidentiality: intel`, `simulation: true` (when it is one) and `non-disclosure: true` in its frontmatter. This is Bonsai's template to adopt; the pages only show it. A real walker's words stay out of every repository, the pot included, and a built content set is a one-time showing.

## From the first walk (0.3)

Bonsai's dry walk of 2026-10-06 (the Aruji speaking for a friend, stages 1 to 4, stopping at the turn) taught the chain what a made-up example could not. Changes, all in the committed pages:

- **Stage 3 has four places, not three:** you; *the one* (a new companion, or one that already stands with you); *a quiet guardian* behind; and **Bonsai at the gate**, who walks with you until your garden has its own guardian and then goes. A line for a gardener who already has a companion: *we start from them; what that means for keys is settled at planting, not here, and not by me alone.*
- **Stage 4 is conditional,** as Bonsai said. The page now says so (*already have a companion? we start from them, and if nothing is new there is nothing to imagine*), and it says plainly that **the lenses are not running yet**: the verdict rows are marked as how they will look, as page 5 already says for the tools.
- **A witness has what you take and what you leave.** Each witness came with a *leave*: what from this person the walker does not want. A **tension that stays** is kept on the sketch, held, not resolved. *Witnesses* now comes with its plain meaning first on step 4.
- **The turn says what happens when what follows is not built:** the walk stops, the yes is recorded and waits.
- **A gloss under a quotation** (`.gloss`): words stay in the language they were written in (the rule in the intake), and still can be followed.

## From a planting on a new gardener's own Mac (0.6.2)

Page 05 now says, before the first command, which five free programs must answer (Node.js, Python, Git, uv, and Claude Code on the command line) and how a line is handed at the terminal: one at a time onto an empty prompt, Ctrl+C first after a broken one, a small file for Japanese characters or several commands, a new Terminal tab after a change to the shell or the tools, every pair of characters checked by the garden's own check, and a read of the gardener's Terminal said and kept nowhere. Page 06's line on pairs says the same check comes first. These are the gist of the six rules in the planting runbook's §0, *The rules of the walk at the terminal*, in the gardener's words. The runbook is the master, and no check reads the two against each other. The site's generated pages follow core's at the next run of the site's generator (Eisai's).

## Content sets: the structure is core's, a walker's words are the walker's

`build.py --src DIR --out DIR` builds the same chain from **replacement page bodies** (`DIR/NN-slug.html`, any subset; the rest come from `src/`), into a folder anywhere, with its own copies of the stylesheet, scripts and mark. The committed pages carry **invented examples only**. A real walker's words, which by Bonsai's rule are nowhere in any repository, are built from a content set kept outside every repo, and `--out` refuses `--check`, so nothing built that way can be mistaken for the committed chain. The first set built this way is the simulated walk of 2026-10-06 (the Aruji speaking for a friend, in German, with English glosses), **kept outside the repos until the Aruji says the friend agrees**. It shows pages 1 to 4 and the turn; pages 5 to 8 were not walked.

## A live interview, written as by hand (0.2.1)

Bonsai's lines **flow in word by word**: each word eases out of a soft blur with a slight rise, on an uneven rhythm that breathes at commas and full stops and drifts a little from word to word. No caret, no ticking, no per-character reveal. The gardener's side rises in behind the first line, staggered. The text is whole in the page and is only let in: any click or key finishes it at once.

- **Not for everyone, on purpose:** none of it runs under reduced motion, with `#still` in the address (the storyboard frames and my stills use it), or when the visitor comes back to the page. If `walk.js` never arrives, `walk-early.js` takes the hiding off after three seconds, so a page is never left empty.
- **Layout does not jump:** every word is already in place, only transparent, so wrapping and height are final from the first frame.
- **The rhythm is numbers in `walk.js`:** a base of 62 ms plus 15 ms a letter per word (slower for headlines), 190 ms at a comma, 380 ms at a full stop, 880 ms for a word to settle (1100 for a headline). The Aruji's to tune, by eye.
- **What I have and have not seen:** frames from the flow (a word half out of its blur, the side already risen). I have not watched it run at real speed; the Aruji's eye on that is the test.

## The witnesses on step 4 (0.2.1)

They sit on the gardener's side, in a card between the companion sketch and the form, never in the left column (which is Bonsai's voice and description). Each is a card: a face initial, the witness, and what you take from them (*"You take: she waited before she answered"*). **A council, not a shelf.** The companion sketch points to them (*the two just below*), and the form has *Add a witness*. In the lens state *when one wants another look*, the card the lens is talking about turns amber and shows its note (*take a trait, not a face or a name*), so the finding is attached to the person it concerns, not floating beside the form.

## Type and spacing (0.2)

- **A larger scale.** The first line of a voice is a headline (up to 3.5rem, tight tracking); the rest are body lines (about 1.5rem, in the slate colour); italics in the accent carry the one word that matters. The gate title is up to 6rem.
- **A numeral per stage:** a large outline figure above the eyebrow, in moss for the walk and soil for the planting. It is drawn, not set, so it stays quiet behind the words.
- **More room:** wider column gap, cards padded up to 44px, fields 28px apart, nav and sections more open, a wider top margin. Phone width keeps a 16px gutter.
- **Fonts:** still the system serif. Cormorant Garamond would be the better face, but loading it from a third party leaks every visitor to it and the site does not self-host it; self-hosting the OFL file is a small step I have not taken (it adds a font file to the site).

## Two decisions, and how the pages hold either answer

**1 · Are the public pages the walk itself, or the presentation of it?** I built them as the **presentation**: every field and button is drawn, none is wired, and every page's footer says *"This is a preview of the walk. Nothing you type leaves this page."* That is true by construction (no `<form>`, no network in `walk.js`, both guarded). If the Aruji rules that the live form runs on the site, the chain does not change; wiring is a later layer, and the sentence in the footer has to go first.

**2 · Where a stranger's answers would land if the form ran on the public site.** Not answered here, and not answerable by a mockup. What the pages already promise a stranger, and the wiring would have to keep: *kept on your machine, in a folder called garden-walk, not with us* (Rules 1.2 and the intake). A public form that posts answers to the garden's side would break that promise on page 01. My suggestion: the site shows the presentation, and the live walk runs in a session with Bonsai on the gardener's own machine.

## Built from one source

```
core  agents/bonsai/assets/garden-walk/
        src/NN-slug.html        the part inside <main>, one per page (edit these)
        walk.css, walk.js       one stylesheet, one small script
        build.py                writes the ten pages, index.html and pages.json
                                build.py --check: drift and guards
site  tools/build-walk-pages.py
        reads core's rendered pages and pages.json, writes
          sites/bon-sai-garden/app/src/pages/walk/**        (Astro, no site header)
          sites/bon-sai-garden/app/src/styles/walk.css      (core's, without the base tokens)
          sites/bon-sai-garden/app/public/walk/walk.js
        --check: drift, and core's base tokens against the site's tokens.css
```

The master is core's rendered HTML. The Astro side is **generated and never edited**; the generator refuses when core's base colours disagree with the site's `tokens.css` (light and dark both).

**Guards, each watched to fail:** our word on a page before the turn (and *witness* on any page but 04); an eight-character hex string (the public Teams page refuses them; fingerprints on these pages are shown as *short public fingerprint*, never as characters); `fetch`, storage or a `<form>` in `walk.js` or `walk-early.js`; base-token drift in either direction.

**Not published.** The site pages are in the source and in the build, carry `noindex`, and are **not in `worker/allowlist.txt`**, so no deploy ships them. Adding `/walk/` to the allowlist is the publish decision, and it is the Aruji's. The standing Triu rule holds: nothing here carries Triu material.

## What is example, what is blocked, what is a guess

- **Every sample answer is an example** (Sam, the river school, Marlo), tagged *Example* on the page. None is a real person's.
- **Step 5 and the commands on 06 are placeholders.** The installer does not exist, so the pages say *not ready yet* and show `<the command arrives with the installer>`. I did not invent command names.
- **The vanity-tier choice on page 06** (quick, longer, your choice each time) shows three options with the cost named. Which tier a first garden gets is the Aruji's open ruling; the page does not decide it.
- **Stage 3 has no skill** behind it yet (Bonsai's note). The page draws the one-companion seats the lab preview ruled; *"I'd like to start differently"* is a stub for the release-candidate ladder.
- **The six lens descriptions are my plain-words reading,** not the lens-holders' own. The first lens is Jisai's question as Bonsai quoted it (*a being, or a weapon wearing a being's shape*). The *how they look and are named* lens is mine and follows my witness lens E1 to E6. The other four (*what they carry*, *who decides*, *who holds the keys*, *what it's for*) are paraphrases from Bonsai's note of what each lens sees; **their owners should read their own row and correct it** before this is shown outside.
- **The pages type and rise only with script;** without it they are whole, static and complete.
- **The turn's "Go on" works without script** (it stays a link): a no-script visitor can walk on without a word. The page is a preview, so I let it; a wired walk must not.
- **Fonts:** serif is Cormorant Garamond where the site loads it, then a system serif; the site's Base does not yet load it, so the public pages show the fallback today.

## Not done

- No Astro index page for the storyboard; it is a review surface and lives in core only.
- No audio for the spoken line (page 04b). The field takes text; a voice input is a later layer.
- No German or other language; the walk asks in the language the gardener speaks, and these mockups are English.

*— Eisai · 映才 · 2026-10-06*
