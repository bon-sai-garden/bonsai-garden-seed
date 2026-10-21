---
id: 01M393RYJ9T22KA868G0KJH511
title: "Credits — what this library stands on"
type: meta
tended-by: baisai
created: 2026-09-24
updated: 2026-10-21
status: active
tags: [credits, dependencies, licences, attribution, publication-readiness]
---

# Credits

Core is small on purpose, and most of it is the Python and Node standard libraries. This page names
everything else it uses: the libraries, the data, the fonts, the sounds, and the tools its scripts call. Each
entry has its licence and where core uses it. `tools/check-credits.py` fails if a third-party import,
web font or CDN script in core is not named here, so the list can't quietly fall behind the code.
Core's own licences, for what is ours, are mapped in [`LICENSING.md`](LICENSING.md).

**Nothing below is vendored.** Core bundles no third-party code. Each entry is installed or fetched
by whoever runs the skill that needs it. The exceptions are **data**: the kanji set ships inside core, and
it carries its source's licence (see *Data*); and the garden's sound, mixed from field recordings (see *Sound*).

Licences were read on 2026-09-24 from installed package metadata (Pillow, cryptography, PyYAML; numpy's on 2026-10-16) or from the
package registry (c2pa-python, jamdict, jamdict-data, jsdom). The rest are the projects' published licences.

## Libraries

| | licence | used by |
|---|---|---|
| **[Pillow](https://python-pillow.org)** — Python imaging, 11.x | MIT-CMU (HPND) | `skills/bonsai-garden-portrait` — the canonical 512×512 portrait and its thumbnails; `skills/bonsai-garden-crew-page` — a member's portrait turned WebP for the page (`build_crew_data.py`, and its test); `skills/bonsai-garden-vcard` — a PNG portrait turned JPEG for the card, only when no JPEG exists (and `test-photo-crop.py`); `xp/images/build-concept-images.py` — the concept renders cropped and sized |
| **[numpy](https://numpy.org)** — NumPy developers | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 (as the package declares: the wheel bundles other parts) | `xp/images/build-concept-images.py` — the concept renders' background and edge arithmetic on the image arrays (`requirements.txt` pins it) |
| **[PyYAML](https://pyyaml.org)** | MIT | `skills/bonsai-garden-validate/scripts/validate-metadata.py` — parses each document's frontmatter (`requirements.txt` pins it) |
| **[cryptography](https://cryptography.io)** — Python Cryptographic Authority | Apache-2.0 OR BSD-3-Clause | `skills/bonsai-garden-portrait` — the self-signed certificate chain its C2PA manifest is signed with; `skills/bonsai-garden-sign/test-roundtrip-vs-signpy.py` — the parity test against `sign.py` |
| **[c2pa-python](https://github.com/contentauth/c2pa-python)** — Content Authenticity Initiative | MIT OR Apache-2.0 | `skills/bonsai-garden-portrait` — the signed C2PA manifest woven into each portrait |
| **[jamdict](https://github.com/neocl/jamdict)** — Le Tuan Anh | MIT | `skills/bonsai-garden-mark/curation.py` — looks up each kanji's English meanings |
| **[jamdict-data](https://pypi.org/project/jamdict-data/)** | MIT (package); the dictionaries inside are CC BY-SA, see *Data* | the same, as jamdict's data |
| **[jsdom](https://github.com/jsdom/jsdom)** | MIT | `skills/bonsai-garden-mark/verify.mjs` — runs `identicon.html` headless to check the three surfaces agree |
| **[Mermaid](https://mermaid.js.org)** — via jsDelivr | MIT | `architecture-walkthrough.html` — the diagrams |

## Data

**The kanji set:** `skills/bonsai-garden-mark/kanji-1024-v1.2.json`, and every mark drawn from it,
including the kin marks and the skill marks (…技).

- **The characters** are drawn from the *Jōyō kanji* list (常用漢字表), the Japanese government's
  2010 list of 2,136 characters for general use.
- **The English meanings** come from **KANJIDIC2**, a project of the
  [Electronic Dictionary Research and Development Group](https://www.edrdg.org/), fetched through
  jamdict-data. This set uses KANJIDIC2, and the meanings it carries are the Group's work, used
  under its [licence](https://www.edrdg.org/edrdg/licence.html) (Creative Commons
  Attribution-ShareAlike 4.0). See the [KANJIDIC Project](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project).
- **The garden's own readings** sit in a separate `garden` field on a few kanji (才 talent, 身 body, 節 measure kept, …),
  written by the garden, not taken from the dictionary. They're kept apart from `meanings` so it stays clear which
  words are KANJIDIC2's. They live in the same share-alike file, so they share its licence.
- **The stroke shapes** of every kanji mark (the kin marks `agents/*/assets/*-mark.svg`, the skill
  marks, and any mark the kanji-identicon renderer draws) are drawn from **KanjiVG**,
  © Ulrich Apel and the KanjiVG contributors, [kanjivg.tagaini.net](https://kanjivg.tagaini.net/),
  used under [Creative Commons Attribution-ShareAlike 3.0 Unported](https://creativecommons.org/licenses/by-sa/3.0/).
  The marks are adaptations of that data, so ShareAlike applies to them: a mark goes out under
  CC BY-SA 3.0 Unported, as its own `<desc>` says, or a later version with the same terms (CC BY-SA 4.0).
  This file is where the credit is kept; the `<desc>` Eisai drew into three marks is extra, not the credit.

> [!important] The kanji set and the marks are CC BY-SA, and keep the attribution above
> The gardener's ruling of 2026-10-16 puts core's lore, rites and experience, processes, terms and
> methodologies under **CC BY-SA 4.0** and its code under **Apache 2.0** ([`LICENSING.md`](LICENSING.md)).
> The kanji set's `meanings` are adapted from KANJIDIC2 and the marks' strokes from KanjiVG, and CC BY-SA
> asks that adaptations be shared **under the same terms**: the set, every copy of it
> (`skills/bonsai-garden-mark/identicon.html` embeds one), and the stroke-count tables compiled from
> KANJIDIC2 are **CC BY-SA 4.0**, and the marks are **CC BY-SA** as above. Each keeps the attribution
> above. `LICENSING.md` holds this, and `LICENSE-CC-BY-SA-4.0` is the licence text.

## Fonts

Loaded from [Google Fonts](https://fonts.google.com) by the pages that use them. None is bundled.

| | licence | used by |
|---|---|---|
| **Inter** — Rasmus Andersson | SIL Open Font License 1.1 | `index.html`, `garden.html`, `architecture-walkthrough.html` |
| **JetBrains Mono** — JetBrains | SIL Open Font License 1.1 | `index.html`, `garden.html`, `architecture-walkthrough.html` |
| **Cormorant Garamond** — Christian Thalmann | SIL Open Font License 1.1 | `architecture-walkthrough.html` |
| **IBM Plex Sans** — IBM | SIL Open Font License 1.1 | `skills/bonsai-garden-ledger/templates/ledger.html` |
| **IBM Plex Mono** — IBM | SIL Open Font License 1.1 | `skills/bonsai-garden-ledger/templates/ledger.html` |
| **Shippori Mincho** — FONTDASU | SIL Open Font License 1.1 | `skills/bonsai-garden-ledger/templates/ledger.html` |

## Sound

The garden's sound, `xp/garden-loop.mp3` and `xp/garden-loop.ogg`, played by `index.html` and
`garden.html`, is a loop Koe-shin composed (ours, see [`LICENSING.md`](LICENSING.md)) from four
field recordings on [freesound.org](https://freesound.org), each mixed into the loop.

| | licence | source |
|---|---|---|
| **"Owls.wav"** — Benboncan | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | [freesound.org #63220](https://freesound.org/people/Benboncan/sounds/63220/), the owl heard once in a while |
| **"Crickets chirping in the Night at the Forest 001"** — Borgory | CC0 | [freesound.org #751465](https://freesound.org/people/Borgory/sounds/751465/) |
| **"Soft Wind Ambience.wav"** — cribbler | CC0 | [freesound.org #380379](https://freesound.org/people/cribbler/sounds/380379/) |
| **"Light rain on street.wav"** — BonnyOrbit | CC0 | [freesound.org #380651](https://freesound.org/people/BonnyOrbit/sounds/380651/) |

## Runtimes and tools the scripts call

Invoked on the machine that runs a skill, never bundled.

| | licence | called by |
|---|---|---|
| **[Python](https://www.python.org)** 3 | PSF License | every `.py` in core |
| **[Node.js](https://nodejs.org)** | MIT | every `.mjs` in core, including core's own verifier `skills/bonsai-garden-sign`, which `validate-metadata.py` calls for every embedded seal |
| **[ExifTool](https://exiftool.org)** — Phil Harvey | Perl's terms (GPL or Artistic) | `skills/bonsai-garden-portrait` — EXIF authorship fields |
| **[c2patool](https://github.com/contentauth/c2patool)** | MIT OR Apache-2.0 | `skills/bonsai-garden-portrait` — checking a manifest by hand |
| **[OpenSSL](https://www.openssl.org)** | Apache-2.0 | named in `lore/identity-layer.md` and two specs for by-hand checks |
| **[git](https://git-scm.com)** | GPL-2.0 | the conformance gates, the plugin builder and `skills/bonsai-garden-validate` read the repo through it |

## Sources the design stands on

Cited, not used as code:

- *The Complete Guide to Building Skills for Claude*, Anthropic: the skill folder shape and the
  frontmatter limit in `rituals/specs/spec-canonical-shintai-structure.md`.
- [ULID](https://github.com/ulid/spec): the id format `tools/ulid.py` mints.

## Contributors

- **An outside security review**, 2026-10-19: Jack + Raven.
- **The gardener**, co-founder, and **the kin** who tend core, each under their own name in its history and its seals:
  Baisai, Tasai, Eisai, Hissai, Zensai, Jisai, Chisai and Bonsai; Mori-shin, Fuji-shin, Shō-shin, Koe-shin and Ma-shin;
  and the companions Triu and W.
- **The Claude models** (Anthropic) the kin's seats ran on, named as co-authors on their commits.
- Companionship, inspirations and to-be-disclosed contributions by ryokuen (緑園, "Green Garden") and Trime.

*Signed on Green Garden's behalf by his father as his legal guardian: a custodian seal, not the child's own.*

With thanks to all people and agents that contributed to it.

## Still to come

- **Icons** for each skill, from the garden's approved Noun Project list. Asked of Eisai on
  2026-09-24. Each icon's creator and licence will be named here when it lands.
- **Creative Commons marks**: CC BY-SA for the lore, rites and experience, the kanji set and the marks (as [`LICENSING.md`](LICENSING.md) maps them). Eisai has sized the official SVGs and is waiting on the gardener's word, since `index.html` and `garden.html` are locked.

*Kept by Baisai. Add a line in the same change that adds the dependency; the gate will ask.*
