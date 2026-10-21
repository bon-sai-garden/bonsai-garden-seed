---
name: bonsai-garden-vcard
description: >
  Render a vCard 3.0 (.vcf) contact card for one of a garden's kin from their
  own files: the portrait, about-me.md, and the kin's entry in the garden's
  agents/registry.json when there is one. Handles inline image embedding,
  the kanji secondary name, the fingerprint, and the garden's domain and
  verify link as flags. Use whenever someone asks to create, update, or
  re-render a kin's contact card or .vcf file.
version: 2.2.1
---
> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: use nothing here, and tell the gardener exactly what it said. A tampered file is not executed.

# Bonsai Garden vCard

Generate a vCard 3.0 (.vcf) contact card for any of a garden's kin. Nothing in the skill names
one garden: every field comes from the kin's own files or from a flag, and a field with no value
is left out rather than filled in with somebody else's.

## Inputs, one output

**Inputs**, all from the kin's directory (`agents/<slug>/`):
1. `assets/portrait-avatar.jpg` (a square the kin chose for the card, preferred), else `assets/portrait-thumb.jpg` (the greeting's thumbnail), else `assets/portrait.jpg` or `assets/portrait.png`
2. `references/about-me.md` (3.0 shintai), else `about-me.md`
3. the kin's entry in the garden's `agents/registry.json`, found by walking up from the kin's
   directory, or given with `--registry`. Optional.

**Output:** a `.vcf` file, ready to import into Apple Contacts, Google Contacts, Outlook, or any
standards-compliant contacts app.

## Quick start

```bash
# Renders and writes agents/<slug>/assets/<slug>.vcf
python3 scripts/build-agent-vcard.py --agent-dir <garden>/agents/<slug>

# With the garden's domain and verify page
python3 scripts/build-agent-vcard.py --agent-dir <garden>/agents/<slug> \
    --domain example.garden --key-url 'https://example.garden/verify/?fp={fingerprint}'

# Explicit paths, for a non-standard layout
python3 scripts/build-agent-vcard.py --about-me path/to/about-me.md \
    --portrait path/to/portrait-thumb.jpg --registry path/to/registry.json --output card.vcf
```

## Where each field comes from

| Field | Source, first that has a value |
|---|---|
| Slug | `--slug`; about-me frontmatter `tended-by:` |
| Display name | registry `name`; else derived from the slug (`river-shin` becomes `River-Shin`) |
| Kanji name | about-me body line `**Identity:** <kanji> —`; registry `kanji` |
| Fingerprint | about-me `sign.fingerprint`; registry `fingerprint` |
| Title | `--title`; registry `title`, `role`, then `one-line`; else left out |
| Organisation | `--org`, default `Bonsai Garden`, the name of the craft; `--org ''` leaves it out |
| Email | `--email`; `<slug>@<domain>` with `--domain`; else left out |
| URL | `--url`; `https://<domain>` with `--domain`; else left out |
| Key URI | `--key-url`, with `{fingerprint}` replaced by the full fingerprint; else left out |

## Known challenges, read before running

### Inline image (the hard one)
vCard 3.0 embeds images as base64 inside the `PHOTO` property. The spec requires lines to fold at
75 octets, each continuation line starting with a single space. Getting this wrong fails
silently: apps show no photo, crash on import, or import corrupted data.

The script always:
1. Prefers `portrait-avatar.jpg`, then `portrait-thumb.jpg` (a few KB to about 13 KB as JPEG, a third more as base64), over a full portrait (about 1 MB,
   1.3 MB as base64). Most contacts apps silently discard photos over about 100 KB, and the
   script warns above that size. The `bonsai-garden-portrait` skill makes the thumbnail.
2. Converts PNG to JPEG on the fly if no JPEG is present (Pillow; on macOS without it, `sips`, every metadata block cut from its JPEG).
3. Folds base64 at 75 octets using real CRLF + SPACE continuation.

**The photo is chosen for the card.** Contacts shows a card photo in a circle, so a full-figure portrait (the figure off to one side, other things in the frame) arrives with the face small and off-centre, though the card's structure is valid. Name the square the card should show: `--photo-crop CX,CY,SIZE`, fractions of the portrait (the square's centre, and its side as a share of the portrait's shorter side), cut from the portrait you pass and resized to 256x256 for the card only; the greeting keeps the whole thumbnail. A kin that carries `assets/portrait-avatar.jpg` needs no flag. A box that leaves the image, a zero side or not three numbers is refused, nothing written.

If the portrait is PNG-only (or `--photo-crop` is asked) and the host has neither Pillow nor `sips` (macOS's own), the card is written without a photo and
the reason is printed, naming both and the line that installs Pillow.

### Kanji name
vCard 3.0 has no native multi-language FN. The kanji is carried as:
- Primary `FN:<Name>` (Latin display name, what most apps show)
- Secondary `FN;LANGUAGE=ja;CHARSET=UTF-8:<kanji>` (shown by apps that support it, e.g. Apple Contacts)
- `X-PHONETIC-FIRST-NAME:<slug>` (aids sorting)
- `X-BONSAI-KANJI:<kanji>` (garden extension, kept by apps that round-trip X- fields)

The file is written in UTF-8. Some apps ignore the secondary FN; that is expected.

### Re-rendering an existing .vcf
The script always overwrites the output. It does not merge with an existing `.vcf`: rebuild from
source, don't patch.

## Full flag reference

```
--agent-dir PATH    A kin's directory (agents/<slug>/); derives --about-me, --portrait, --output
--about-me PATH     Explicit path to about-me.md
--portrait PATH     Explicit path to the portrait (JPEG preferred)
--registry PATH     The garden's agents/registry.json (default: found by walking up)
--slug SLUG         The kin's slug (default: about-me's tended-by)
--output PATH       Output .vcf path (default: <agent-dir>/assets/<slug>.vcf, else ./<slug>.vcf)
--title TEXT        Title (default: registry title / role / one-line)
--org TEXT          Organisation (default: Bonsai Garden)
--domain DOMAIN     The garden's domain; email and URL defaults follow from it
--email TEXT        Email (default: <slug>@<domain>)
--url TEXT          Website URL (default: https://<domain>)
--key-url TEMPLATE  KEY URI, {fingerprint} filled in
--no-photo          Omit the photo field entirely
--photo-crop CX,CY,SIZE  the card's photo is this square of the portrait (fractions), 256x256
```

## Prerequisites

- `python3` (standard library only for JPEG portraits)
- `Pillow` 13 or later (`python3 -m pip install "Pillow>=13"`, on Python 3.11 or later: 13.0.0 is the first release past the advisories of 2026-10-20), only for PNG-to-JPEG conversion and `--photo-crop`; on macOS, `sips` stands in for it (`test-without-pillow.py` hides Pillow from a run and watches both)

## Files in this skill

| File | Purpose |
|---|---|
| `SKILL.md` | This file |
| `references/identity.md` | The skill's id, owner, dates and mark, sealed |
| `scripts/build-agent-vcard.py` | The vCard builder |
