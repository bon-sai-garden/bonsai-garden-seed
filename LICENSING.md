---
id: 01M4KWNH3GFSA3XD7PR0DWKEPV
title: "Licensing: code is Apache 2.0; lore, rites, experience, processes, terms and methodologies are CC BY-SA 4.0"
type: reference
tended-by: baisai
created: 2026-10-10
updated: 2026-10-21
version: 3.0.4
status: active
tags: [licence, apache, cc-by-sa, attribution, publication-readiness]
---

# Licensing

The gardener's ruling, 2026-10-16: *"no, SA is what we agreed on. NC (= no commercial) was the original idea. change to SA"*. So the split is: **code under the Apache License 2.0; lore, rites and experience, processes, terms and methodologies under Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0).** How a graphic is credited is his ruling of 2026-10-12, unchanged: *"Display of graphics needs a direct link to bon-sai.garden underneath."* This page is the file map: which licence covers which path in core, and why. What is not ours is in [`CREDITS.md`](CREDITS.md).

| | licence | file |
|---|---|---|
| **Our code** | Apache License 2.0 | [`LICENSE`](LICENSE) |
| **Our lore, rites and experience, processes, terms and methodologies**, and every other work of ours that is not code | Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0) | [`LICENSE-CC-BY-SA-4.0`](LICENSE-CC-BY-SA-4.0) |
| **What is adapted from share-alike sources**: the kanji set's meanings (KANJIDIC2) and the marks' stroke shapes (KanjiVG) | Creative Commons Attribution-ShareAlike (4.0 for the kanji set; 3.0 Unported, or a later version, for the marks) | [`LICENSE-CC-BY-SA-4.0`](LICENSE-CC-BY-SA-4.0) |
| **Third-party material** | its own licence | [`CREDITS.md`](CREDITS.md) |

## The map

### Apache License 2.0: our code, wherever it sits

- **`tools/`**, all of it: the gates, scripts and tests, and their fixtures and example configs, including fixtures written as documents.
- **`skills/*/`**: every script, module and library (`.py`, `.mjs`, `.js`, `.sh`), the test vectors and fixtures, the page and component templates a script fills (`skills/bonsai-garden-portrait/templates/`, `skills/bonsai-garden-ledger/templates/`, `skills/bonsai-garden-crew-page/templates/`), the stylesheets, and the data a script reads (`*.json` policies, reserved lists, package configurations). `skills/bonsai-garden-mark/identicon.html` is a tool and is code; the kanji set it embeds is not (see *CC BY-SA, by the source*).
- **The scripts and styles of the pages**: `agents/bonsai/assets/garden-walk/build.py`, `walk.js`, `walk-early.js`, `walk.css`; `xp/bonsai-core.css`; `xp/images/build-concept-images.py`.
- **Manifests and configuration**: `package.json`, `package-lock.json`, `requirements.txt`, `requirements-lock.txt`, `skills/bonsai-garden-mark/requirements-curation.txt`, `.gitignore`, and `agents/registry.json` (the roster a script reads).
- **Seals and identity data**: every `.bonsaisig`, and the public keys, fingerprints and seed entries under `agents/*/identity/`. They are published so that anyone can check a signature.

### CC BY-SA 4.0: our lore, rites, experience, processes, terms and methodologies, and the rest that is not code

- **Lore**: `lore/`, its documents, their HTML renderings and its images.
- **Rites**: the kin and what a kin is cultivated from (`agents/`, apart from the code and identity data above: `SKILL.md`, `references/`, `memory/`, `patterns.md`, the codex and routines in `assets/`, `agents/shared/`), `roles/`, `team/`.
- **Processes, terms and methodologies**: `rituals/` (the specifications, the templates, the records, and the vocabularies and schemas that name things), and the methods the skills describe in their documents.
- **Experience**: the Garden Walk's pages (`agents/bonsai/assets/garden-walk/*.html`, `src/`, `pages.json`, `notes.md`); the pages `index.html`, `garden.html` and `architecture-walkthrough.html`; the garden's sound, `xp/garden-loop.mp3` and `xp/garden-loop.ogg`, composed by Koe-shin from field recordings credited in [`CREDITS.md`](CREDITS.md).
- **Our graphics** that are not drawn in KanjiVG strokes: the portraits and their thumbnails and cards (`agents/*/assets/`), `bonsai-garden-logo.svg` and `bonsai-garden-logo-256.png`, `xp/images/concept/`, the images in `lore/`.
- **Every other document**: `README.md`, `AGENTS.md`, `CLAUDE.md`, `LAYERS.md`, `CREDITS.md`, this page, and each skill's `SKILL.md` and reference documents.

ShareAlike asks that an adaptation of these go out under the same licence, or one the licence names as compatible.

### CC BY-SA, by the source: what is adapted from KanjiVG and KANJIDIC2

These carry their sources' share-alike terms, which is not a choice of ours; the rest of the garden's non-code work is CC BY-SA 4.0 as well.

- **The kanji set**, `skills/bonsai-garden-mark/kanji-1024-v1.2.json`: its meanings are adapted from KANJIDIC2 (CC BY-SA 4.0), and the garden's own readings sit in the same file. **CC BY-SA 4.0**, and so is every copy of the set, including the one embedded in `skills/bonsai-garden-mark/identicon.html` (the tool around it stays Apache 2.0).
- **The stroke-count tables**, `skills/bonsai-garden-mark/references/kanji-to-number.md` and `number-to-kanji.md`: compiled from KANJIDIC2. **CC BY-SA 4.0.**
- **Every mark drawn in KanjiVG strokes**: `agents/bonsai/assets/bonsai-mark.svg`, and any kin mark, skill mark, seal or identicon drawn in those strokes. KanjiVG is CC BY-SA 3.0 Unported, and each mark is an adaptation of it: **CC BY-SA 3.0 Unported**, as the mark's own `<desc>` says, or a later version with the same terms, which BY-SA 3.0 allows for adaptations; `LICENSE-CC-BY-SA-4.0` is that version.

Nothing here carries KanjiVG's stroke data as data: what is drawn in its strokes ships drawn, in the marks above, and each says its licence in its own `<desc>`.

### Third-party material

It keeps its own licence, and [`CREDITS.md`](CREDITS.md) names each with where core uses it: the libraries core imports (none vendored), the fonts loaded from Google Fonts (SIL Open Font License 1.1, none bundled), the four field recordings in the garden's sound (three CC0, one CC BY 4.0), and the KanjiVG and KANJIDIC2 data above. This page relicenses none of it.

## Displaying our graphics

When you display a graphic of ours (a portrait, a mark, the logo, an illustration, a page's imagery), the attribution we ask for is **a direct link to [bon-sai.garden](https://bon-sai.garden), placed directly underneath the graphic**, for example:

> Bonsai Garden · [bon-sai.garden](https://bon-sai.garden)

Where the medium cannot carry a link (print, a frame of video), the address written out underneath serves. For a mark drawn in KanjiVG strokes, the KanjiVG credit in `CREDITS.md` goes with it. This is the manner of credit we request as the licensor, under the attribution clause of each licence (section 3(a)(1) of CC BY-SA 4.0, section 4(c) of CC BY-SA 3.0); it is written as that request, not as a term added to a licence.

## Where a file is mixed

**The file's own use decides, and a document that quotes code stays a document.** A script embedded in a page does not change the page's licence; a skill's `SKILL.md` is a document and its scripts are code. A code file that embeds share-alike data is Apache 2.0 for the code, and the data keeps its source's licence. If a file cannot be placed by this page, that is a bug in this page: say so, and the file gets a header that names its licence.

## What a licence does not give

- **A licence to a file is not a licence to its signature.** The kin's keys, seals and fingerprints say who wrote or vouched for a thing; a copy of a document does not carry its seal, and a changed copy is not sealed by its original's signer.
- **Names are credited, not granted.** Bonsai Garden and the kin's names are not licensed by any of these licences.

## Why

Code is meant to be taken, changed and built on with few strings: Apache 2.0 gives that, with its patent grant, and asks only for the notice. The lore, the rites, the experience, the processes, the terms and the methodologies are the culture of a garden: they may be shared and adapted, with credit, on the same terms, so that what grows from them stays as open as they are. What is built from KanjiVG and KANJIDIC2 stays as open as its sources were, because their ShareAlike leaves no other choice. (OATHS, the specification, ships under Apache 2.0 in its own repository; this page does not touch it.)

## Open

- **The gardener reads this map before it is published:** it is a public claim.
- **Specifications and skill documents** are processes and methodologies, so they sit with the lore under CC BY-SA 4.0. If they should travel with the code under Apache 2.0, as OATHS does, it is one line here. The narrower licence holds until then, because a grant can be widened later and not taken back.
