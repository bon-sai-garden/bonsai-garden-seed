---
id: 01M48BAJVWBDG0Y1ZPDSMPTFGF
title: "The gardener's about-me — template, draft 0.1"
type: template
tended-by: bonsai
author: bonsai
created: 2026-10-06
updated: 2026-10-06
version: 0.1.1-draft
status: draft
tags: [bonsai, garden-walk, stage-1, about-me, template, lab-preview]
---

# The gardener's about-me — template

> **Draft 0.1, for the Aruji's review.** Rule 1.2 of the Garden Walk rules (pot `home/bonsai/working/2026-10-06-garden-walk-rules-draft.md`): Stage 1, *who are you*, produces one file, `about-me.md`, in the gardener's words. This is the shape it lands in, whichever of the three ways in they chose. How I run the stage is its companion, `gardener-about-me-intake.md`.

> **Home:** `agents/bonsai/assets/`, in core, beside my body. Named by the Aruji, 2026-10-06: *"put the template and intake under agents/bonsai/assets/ in core."*

## How to read it

- **The frontmatter is ours; the body is theirs.** What the rite needs in our vocabulary (`intake:`, `status:`, `tended-by:`) sits in the frontmatter, the way the strategic context keeps `shape:` there. The gardener sees the body, and nothing in the body is written by me.
- **Only `call-me` is needed.** Every other field may stay empty, and an empty field is left out of what they see, not shown as a blank they owe.
- **Short on purpose.** A stranger fills it without help. If it grows past one screen, it has stopped being this template.
- **Their words, as given.** No field is tidied, translated, or completed by me. If they wrote it in their language, it stays in their language.
- **Three flags, always.** `confidentiality: intel`, `non-disclosure: true`, and on a dry run `simulation: true`. The Aruji, 2026-10-06, after the first dry walk: the walker had not consented to anything beyond the walk, and a captured file must say so of itself. The flags travel with the file into the pot; a reader who finds the file without them is reading a copy that should not exist.

## The file

```markdown
---
id: <generated at planting with ulid.py new, never typed; empty during the walk>
type: about-me
tended-by: <the gardener's slug>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
confidentiality: intel      # a person's own words: never surfaced, quoted or compared without their yes
simulation: <true only on a dry run, when the one walking is not the person described; absent otherwise>
non-disclosure: true        # goes no further than this folder, and the pot it moves into at the planting
name: <their name, as they wrote it; optional>
call-me: <what to call them; the one thing needed>
pronouns: <as they wrote them; optional; never inferred>
links:                      # optional; only what they chose to point to
  - <url>
intake: <fields | own-words | questions>
asked:                      # questions path only: the questions, in order, as I asked them
  - <question>
own-words-file: <filename beside this one, if they uploaded a file; optional>
assented: <YYYY-MM-DD, by the gardener, in their words>
status: draft               # draft until sealed at the sealing stage, then sealed
---

# <call-me>

<name, if given> · <pronouns, if given>

## In my own words

<own-words path: their description, exactly as given.>
<questions path: each answer, exactly as given, one paragraph per answer, in the order of `asked:`.>
<fields path: left out, unless they add a line of their own.>

## Where to find me

<their links, one per line, with their note beside one if they gave it.>

## Anything else

<anything they want kept that fits nowhere above, in their words; left out if empty.>
```

## Per way in

- **Fields.** The frontmatter carries the four fields; the body is the heading and the line under it, plus *Where to find me* if they gave links. That is a whole about-me.
- **Their own words.** *In my own words* holds their text exactly, typos and all. An uploaded file is kept as-is beside `about-me.md` and named in `own-words-file:`; if it is text, its words are also copied, unedited, into the body.
- **A few questions.** *In my own words* holds each answer verbatim; the questions stay in `asked:`, so the body has none of my words in it and the pairing can still be read.

## Open

- **The slug.** `tended-by:` needs a short name for their files, and slug is our word. I propose one from `call-me`, say it back in plain words (*"I'll use 'sam' as the short name on your files, is that right?"*), and they may change it. Whether that is right, or whether it waits for the planting, is open.
- **Whether answers stand without their questions.** Keeping questions out of the body keeps it theirs; a gardener may prefer to see what they were answering. First walks will say.
- **Where it lives after the turn.** Rule 6.4 moves it from `garden-walk/` into the new pot, sealed at stage 7; the path inside the pot waits on the pot's definition (provisioning spec §6). In this garden the Aruji's sits at `agents/aruji/about-me.md`, typed `constitution`; whether a new gardener's takes that type at sealing is open.
- **`assented:` on a fields-only file.** Four fields they typed themselves may not need a separate yes; I keep it for now so all three ways end the same.

*— Bonsai · 盆才守神 · 028019b7 · 盆才求信 — draft, for the Aruji's review.*
