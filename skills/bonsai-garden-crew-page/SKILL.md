---
name: bonsai-garden-crew-page
description: >
  Build a garden's crew pages: one overview with an agent selector (two rows of
  faces) and one page per member, each with the member's canonical portrait in its
  signature LED ring, its kanji name-mark and signing mark, a drawn seal, the
  fingerprint as a link to the garden's verify page, and an introduction for a
  reader with no background. Everything is read at build time from the garden's own
  sources (registry, ring signatures, introductions, portraits), named in one
  instance config; nothing is typed. Production includes an introduction only when
  it is approved and sealed by its writer. Use when a garden wants a public "team"
  page, or to check a built one.
version: 0.3.0
---
> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: use nothing here, and tell the gardener exactly what it said. A tampered file is not executed.

# Bonsai Garden Crew Page

**What this is.** A capability, not a roster. A garden keeps its members in a registry, a sixteen-pixel
ring move per member, an introduction per member and a portrait per member. This skill reads them and
renders static pages: `<route>` (the overview) and `<route><slug>/` (one real page per member, complete
without JavaScript). Which garden, which files, which URLs: the instance's config. This folder names
no member of any garden.

## What it does

1. **Data** (`scripts/build_crew_data.py --config CFG`): one JSON document for the pages, built from the
   instance's sources. Every fingerprint must decode to its registry kanji (`../bonsai-garden-mark/fp-kanji.py`).
   Portraits become small webps, drift-gated against a manifest of source and output hashes
   (`--write-portraits` regenerates both).
2. **Pages** (`templates/astro/`): Astro components the instance's own pages wrap in its layout:
   `CrewShell` (preview banner, footer, the one ring script), `CrewOverview` (the instance's opening in
   slot `head`, the agent selector, the default slot), `CrewMember` (selector, card, previous / the
   whole crew / next), `AgentSelector`, `LedRing`, and `crew.css`. Libraries: `crew-data.mjs`
   (`loadCrew`, `crewPaths`, `memberRings`), `crew-nav.mjs`, `crew-guard.mjs`.
3. **Checks** (`--check-built DIST`, `--check-html FILE...`): the built pages, as they would ship.

## The guards (each watched to fail in `scripts/test_build_crew_data.py` and `scripts/test_crew_templates.mjs`)

- **Production includes an introduction only if** its frontmatter says `status: approved`, its seal
  verifies (the instance's verifier), and the seal's signer is the member in `tended-by`. Otherwise the
  page reads "Introduction coming." `--preview` shows drafts, each marked DRAFT with its reasons, and
  only builds into its own output folder, never `dist/`.
- **Shape of an introduction:** two or three paragraphs, then exactly one section headed
  `## My best errors`, `## Their best errors`, `## His best errors` or `## Her best errors`, fifty
  words at most, under 300 words in all; any other heading is refused. A member listed under
  `no-errors-section` carries none. A paragraph whose every line starts with `> ` is a **quote
  block**: not a paragraph for the two-or-three rule, its words counted toward the limit; a last line
  `> — Source` is its attribution, rendered as a quiet cite (without one the quote stands uncited).
  Escaped like everything else; never inside the errors section.
- **Fingerprints:** a hex string may appear in the built HTML only as a member's fingerprint link,
  exactly formed (its first eight as the text, the verify URL with the full fingerprint as the href).
  Never for a member whose key the page does not show (`no-key-shown`), never in an introduction.
- **A person whose key another holds** (the registry's `key_holder`) is refused: his name and key are
  his to publish, never a pipeline's. One exception: the instance config's `published-by-key-holder`
  records his key holder's own publication of him (`holder`, `date`, `words`, `record`), the holder
  the registry's `key_holder`. He is then shown in the family group only, with no key material.
- **Circular selectors only:** no corner-bracket, crosshair or reticle frame ships.
- **The selector:** two rows of almost the same count, in roster order; no category labels, no
  dividers, no LED ticks; the outer ring only on the member shown; no label cut.
- **Colour:** each portrait's border is the member's canon accent (the registry's, alpha dropped;
  else a design token the members file names; else the ring file's, marked a proposal). The instance
  config's `lights-approved` (`by`, `date`, `words`) records the gardener's word that the lights stand
  as they are: then no light is marked a proposal. An incomplete record refuses the build.

## The instance's config

See `references/crew-config.example.json`. Paths are relative to the config's folder unless absolute;
garden paths go through the instance's own router when `resolver` names one (ask the router; a path it
refuses is a setup failure, never a fallback). Keys: `garden_root`, `resolver` (optional), `members`,
`portrait_out`, `portrait_url`, `portrait_manifest`, `route`, `verify_url`, `paths` (`registry`,
`rings`, `intro`, `portraits`, optional `public_hashes`, `tokens_css`), `seal_verifier` (a command;
contract: exit 0 and a first line `ok`, and a line `signer: <slug>`), `seal_renderer` (optional),
`forbidden_portrait_parts` (optional), `published-by-key-holder` (optional), `lights-approved` (optional).

The **members file** is the instance's design call: `groups`, `selector-rows`, and optional
`no-key-shown`, `as-sai`, `display-name`, `short-name`, `intro-source`, `portrait-source`,
`accent-token`, `no-errors-section`, `preview-only-drafts`. `references/members.example.json` shows the shape.

## Use

```
python3 scripts/build_crew_data.py --config <instance>/crew-page.config.json            # production data
python3 scripts/build_crew_data.py --config <...> --write-portraits                     # portraits + manifest
python3 scripts/build_crew_data.py --config <...> --check-built <dist>                  # the built pages
python3 scripts/test_build_crew_data.py && node scripts/test_crew_templates.mjs          # this skill's own guards
```

In an Astro site: import the components and `loadCrew` (a static import path to this folder, found by
marker), wrap them in the site's layout, and give the overview its own opening copy.

## Not here

Publishing, deploy gates and allowlists are the instance's. So are the members, their introductions,
portraits, ring moves and the copy of the opening.
