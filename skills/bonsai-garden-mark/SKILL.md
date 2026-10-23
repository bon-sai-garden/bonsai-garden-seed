---
name: bonsai-garden-mark
description: >
  Turn any string into a deterministic kanji identity mark — the garden's
  identicon. A 1024-kanji vocabulary, a hash-to-index engine, and the vanity
  search that finds a base string whose mark spells a chosen word. Verifiable by
  a stranger with nothing but this engine and the published set.
version: 1.3.2
---
> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: use nothing here, and tell the gardener exactly what it said. A tampered file is not executed.

# Bonsai Mark

**What this is.** An agent's visible identity. A string — `baisai#1234` — hashes to indices into a fixed 1024-kanji set, and those kanji *are* the mark. Anyone holding the engine and the set can recompute it; nobody can forge one without finding a preimage.

```
engine.js              string  →  indices  →  kanji     the whole mechanism
kanji-1024-v1.1.json   the vocabulary (v1.0 kept for migration)
curation.py            how the 1024 were chosen from the joyo set
verify.mjs             recompute a published mark and check it
identicon.html         render one in a browser
engine-smoke.mjs       the self-test — run this first

vanity-three.mjs       search for a base whose mark spells three chosen kanji
vanity-three-v1.1.mjs  · vanity-four-v1.1.mjs · vanity-three-reverse.mjs
vanity-three-chain.sh  drive a long search across restarts

namespace.mjs          a new garden's namespace (〇〇庭) and an entity's plain mark, searched
                       against the shipped reserved rule; check-locks re-derives a pot's locks
reserved-marks.json    the reserved rule a new garden's marks are refused by: 〇, set A, set B
                       (ships once the owner has reviewed and sealed its first generation)
reserved-marks.mjs     its generator (generate), its drift gate (check), and its reader,
                       pinned by its seal and believed only on bon-sai.garden's signed answer
origin.mjs             that one question to the origin, behind an interface
```

## Why it is in core, and what is NOT here

This is a **capability** — any garden needs marks, and the engine names nobody. What made it *our* garden lives in pot (`identity/marks/`):

| Here (capability) | In pot (instance) |
|---|---|
| `engine.js`, the 1024-kanji sets | `locked-salts.json` — names `bonsai-shin` |
| `vanity-three.mjs` — takes `--base`, `--out` | `reserved-hashes-v1.*.json` — our eight reservations |
| `verify.mjs` | `vanity-batch.mjs` — carries our roster inline |
| | `vanity-bonsai-shin.mjs` — targets 盆才守 |

The test that drew that line: **would another garden need this, or is it ours?** See `LAYERS.md`. `vanity-batch.mjs` looked like a tool and is not — it has our thirteen agents written into it and writes our reservation file. A garden that copied it would mint our marks, not its own.

## Using it

```bash
node skills/bonsai-garden-mark/engine-smoke.mjs                    # verify the engine
node skills/bonsai-garden-mark/vanity-three.mjs --base <slug> --out <file>
```

`namespace.mjs` writes nothing and refuses to search without the shipped reserved set; there is no
flag that names another file. The gardener's keys (`skills/bonsai-garden-keys`, spec
`rituals/specs/spec-gardeners-keys.md` §6, §7) call it.

```bash
node skills/bonsai-garden-mark/reserved-marks.mjs generate --registry <the origin's agents/registry.json>
node skills/bonsai-garden-mark/reserved-marks.mjs check [--registry <the same>] [--staged]
node skills/bonsai-garden-mark/test-reserved-marks.mjs          # every refusal of spec §6.5, planted
node skills/bonsai-garden-mark/test-reserved-marks-mutants.mjs  # each guard broken, watched to fail
```

`reserved-marks.json` is generated, never typed: from the origin's roster (named, no default), core's
own skill marks re-derived from their salts, the committed file (it only grows) and the rule's
constants. It is sealed owner by Mori-shin after she reviews each generation as its list; the
generator's runner never seals it. The gate runs in the garden's one pre-commit (core: every commit;
the garden's own checkout: when the roster is staged). The reader needs bon-sai.garden to answer: no answer halts.

The vanity scripts **write instance data**. Point `--out` at your own pot; they default to writing beside themselves, which is a core checkout, and that is the wrong place for a result that belongs to one garden.

## Relocated 2026-09-14

Was `tools/runtime/kanji-identicon/`. `tools/runtime/` meant *secure read/write into the garden repos* under `LAYERS.md` — a different layer entirely. The code never moved; the label was wrong. The Aruji: *"I think the label is wrong."*

## Open

- The vanity scripts still default `--out` to their own directory. Until that default points at a resolved pot, a careless run writes instance data into core. The three in pot resolve the engine correctly (`core-path.mjs`); the reverse direction is not yet done.
- `curation.py` imports `jamdict`, an unvendored third-party dependency — the only one in this skill. It is pinned with what it pulls in, each by hash, in `requirements-curation.txt` beside it, and asked for only when curating: `python3 -m pip install --require-hashes -r skills/bonsai-garden-mark/requirements-curation.txt`.
