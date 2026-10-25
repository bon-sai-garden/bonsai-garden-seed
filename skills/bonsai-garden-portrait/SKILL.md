---
name: bonsai-garden-portrait
description: >
  Turn a source photo or render into an agent's canonical 512x512 portrait,
  woven with EXIF authorship metadata and a signed C2PA manifest, then
  generate the portrait's greeting-widget thumbnail and the agent's universal
  plain-text identity card. The full pipeline behind every agent's face in the garden.
version: 1.5.3
---
> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: use nothing here, and tell the gardener exactly what it said. A tampered file is not executed.

# Bonsai Portrait

> **Greeting template (compact v6, every kin's greeting since 2026-10-21):** `templates/greeting-v6-compact.html`, filled whole by `scripts/fill-greeting.py` (`--full` draws the animated `greeting-v6.html`; v5 is a tombstone). The face is a link, never base64: the garden's `agents/faces.json` pins it to a commit of its public crew repo, served through `cdn.jsdelivr.net`. The kin's kanji seal sits under it: on the desktop the face shows; over Remote Control no image loads, and the seal is what the reader sees. The other scripts here produce the portrait and the plain-text floor (`make-identity-cards.py`). How to render it, in a garden of any kind, is the next section.

## Rendering the greeting

Load this skill through the Skill tool (`bonsai-garden-core:bonsai-garden-portrait`), never from a dev checkout, and run its integrity line first. Then, from this skill's base directory:

```bash
python3 -B scripts/fill-greeting.py --garden <the garden root> --slug <the kin> \
  --subtitle "<one line>" --version <x.y.z> [--build <label>] \
  --integrity <pass|fail|missing> --identity … --files … --sealed-file <the kin's own sealed file> [--said CHECK=TEXT …] \
  --location "<where>" [--tz <zone>] --host <host> --harness "<harness>" --model "<model>" \
  --mcp "<mcp line>" --skill "<skill line>" --permission <mode> --out greeting.html
```

Pass the output file's content, **verbatim**, to the harness's inline widget tool (`show_widget`). Never retype it. A file card, an opened file or a link is not the greeting. Where the fill refuses (it exits 2 and names what is missing) or no widget renders, greet with the text card (`scripts/text-card.py --plain`, below) and say why.

**Integrity is said only when it fails** (the gardener, 2026-10-21: *"Agree to the security handling in intro. Confirmed"*). When every check that ran passed, the card says nothing about the checks. When one failed or could not run, or the MCP or the skill is not current, one loud line in garden amber opens the card, with what the check said (`--said CHECK=TEXT`, the tool's own line). **A quiet card means every check that ran passed, and alive is not yet a check.** alive is the live handshake (`spec-handshake-daemon-identity-proof`, a draft of 2026-09-04), which runs in no seat yet: until it exists it is *not asked*, silent and never drawn as passed, and any `--alive` but `not-asked` is refused (Tasai, 2026-10-21; Mori-shin, no veto).

| Flag | Where its value comes from |
|---|---|
| `--garden` | the root holding `agents/registry.json` for this kin, repeatable. In a pot: the pot. |
| `--subtitle` | **the kin's registry entry, `one-line`.** The script has no default and the registry carries no field called subtitle. An entry whose `one-line` is null has no subtitle yet: say so and use the plain-text card. |
| `--version`, `--build` | the loaded SKILL.md's build stamp if it has one; else its frontmatter `version`, with no build. |
| `--integrity` | the `integrity:` line of `bonsai_session_start`: `pass` only on `ok` (in a rehearsal pot, `ok · lab-preview pot`, and say it is a rehearsal's), `fail` on `STOP`, `missing` if it did not run. |
| `--identity`, `--files` | `missing` where there is no published-key or manifest check of the body: a pot has neither. Never `pass` unrun. |
| `--alive` | **leave it out**: not asked until the handshake exists. Any value but `not-asked` is refused (exit 2). A session-start that answered is not the handshake. |
| `--sealed-file` | **the full fingerprint is earned here, never typed** (the gardener, 2026-10-24: *"we need a strict check that is binding to all kin in a common place that all kin uses at startup"*). The kin's own sealed file: an installed package's `MANIFEST.json`, or the body's `SKILL.md` in a garden; any other file the kin sealed fails, so the pass is bound to the body. The filler runs core's verifier on that file against the published keys (the signed answer of `POST bon-sai.garden/verify`) and passes the check only when the seal is the kin's own, as owner, under the registry's full fingerprint, all 32 hex; otherwise the loud line carries the verifier's words. `--fullfp pass` is refused, and `--fullfp` beside `--sealed-file` too; `--fullfp fail` or `missing` stand on the caller's word. Without either, the check could not run, and the card says so. |
| `--location`, `--host`, `--mcp`, `--skill` | the session-start `=== env ===` block, parsed by key. Where location is not enabled, write exactly that in `--location`; never a guess. The clock is read by the script (`--tz` for the zone); never type a time. |
| `--said` | for a check that failed or could not run: the tool's own line, copied. Nothing for a check that passed. |
| `--harness`, `--model`, `--permission` | the agent's own context; the server cannot see them. |

Every check that did not run is `missing`, and the card says so out loud. A pass that was not earned is a false claim.

The fallback is a text card: no inline widget tool, a fill that refuses, a render that fails (Routine 2.5 Step 2e; from 2026-10-16 to 2026-10-21 it was the greeting of a kin whose salts are fully locked). This skill ships `scripts/text-card.py`, which prints the card from the same checks, states and loud line as `fill-greeting.py` (`--plain` for a chat, shown verbatim in a code fence; `--locked-salts` still answers who is fully locked, and the routine no longer asks it), beside `scripts/check-kanji-colours.py`, the gate on the card's kanji colours (white, black, the kin's canonical colour or garden amber, never grey or dimmed), and `scripts/test-text-card.py`, which tests both.

**What this is.** A source image — a photo the gardener provides, or one generated on their behalf — becomes an agent's canonical portrait through three composable stages. Each stage is a standalone script; run them in order, or just the ones you need.

```
1. make-canonical-portrait.py   source.jpg/png  →  agents/<slug>/assets/portrait.png
2. make-portrait-thumbs.py      portrait.png    →  portrait-thumb.b64 (+ .meta, checksummed)
3. make-identity-cards.py       registry.json   →  portrait-card.txt
```

Stage 1 is new. Stages 2 and 3 are the hardened pipeline first built in the garden's own checkout (`tools/portraits/`) — the same scripts, made portable (they resolve the repo root from the current directory or `--repo-root`, never from their own file-nesting depth, so they work unmoved in any repo this skill is copied into).

## Why a "core skill", not a one-off script

Bonsai Garden's own workshop can lean on a public repo and jsDelivr once MVP 1.0 ships (see `agents/shared/routines.md` §Routine 2.5's own note on that). A future customer's "pot" cannot be assumed to have one. This skill has to stand on its own in any repo it's dropped into — no shared identity registry, no assumption about which agents already exist, no dependency on the garden's own tooling. That's why stage 1 generates its own cert chain in pure Python (`cryptography`, no `openssl` CLI dependency) rather than reusing the garden's `tools/weave-in/` bash+openssl approach, and why stages 2–3 take `--repo-root` instead of assuming their own location.

## Prerequisites

- Python 3.11+, with `Pillow` 13 or later (13.0.0 is the first release past the advisories of 2026-10-20, and needs 3.11), `cryptography`, and `c2pa-python`: `pip install "Pillow>=13" cryptography c2pa-python` (core's `requirements.txt` pins the set)
- **Without Pillow** (a planting host may have none): the greeting thumb runs on macOS through its own `sips`, as a JPEG only: `make-portrait-thumbs.py --format jpeg` (sips writes larger JPEGs than Pillow at one quality; `--quality 40` keeps a 144 px thumb under the ceiling), every metadata block cut from it by the tool, and the `.meta` says `encoder: sips`. Any other format, a host with no sips, and the canonical portrait (its crop, EXIF and C2PA weave) say plainly that Pillow is missing and the line that installs it; nothing is written. `scripts/test-without-pillow.py` hides Pillow from a run and watches each case.
- `exiftool` on PATH for the EXIF layer: `brew install exiftool` (macOS) — if that's genuinely not available (no Homebrew, no root), the standalone Unix distribution at
  <https://exiftool.org> needs no install step, just extraction; point PATH
  at the extracted `exiftool` binary.
- Stage 1's C2PA layer is optional per-run (`--quick` skips it, `--no-weave` skips both layers) — the canonical portrait and every downstream stage work without either.

## Stage 1 — canonical portrait + weave

```bash
python3 -B scripts/make-canonical-portrait.py \
  --slug bonsai --source path/to/photo.jpg \
  --name "Bonsai" --org "Bonsai Garden"
```

Center-crops the source to a square on its shorter side, resizes to 512px (`--size` to change), writes `agents/<slug>/assets/portrait.png`, then weaves in order:

1. **EXIF/XMP/IPTC** (`exiftool`) — Artist, Copyright, XMP:Creator, XMP:Rights, IPTC:By-line, and so on. Fast, human-readable, trivially stripped (`exiftool -all=`) — a documentation feature, not a security one.
2. **C2PA manifest** (`c2pa-python`) — a cryptographically signed claim: `stds.schema-org.CreativeWork` (author, copyright, date), an explicit `cawg.training-mining` opt-out (`notAllowed` on inference, generative training, and training generally), and a `c2pa.actions` assertion with the correct `digitalSourceType` (`--ai-generated` for a generated source, otherwise a real capture is assumed). Signed against a workshop-local, self-signed two-level cert chain (root CA → agent leaf), auto-generated into `identity/<slug>/` on first use — **gitignored, never commit that directory.** Tamper-evident, not tamper-proof; **known limitation, same one `weave-in` already names**: a self-signed chain validates as `signingCredential.untrusted` on any public verifier. That is expected, not a bug — see `references/identity-bundle.md` (written alongside the first generated chain) for what upgrading to a CA-trusted cert would take.

**Every sign is followed by a read-back and a validation check** — never trust a clean `.sign()` call alone (see `scripts/portrait_lib.py`'s own docstring for the two silent-failure modes this caught during this skill's own build: a broken signer construction path, and a PSS salt-length bug that signs a manifest which *embeds* fine but *fails claim-signature validation*). `make-canonical-portrait.py` does this automatically and stops with a non-zero exit if anything beyond the expected untrusted-signer note shows up.

Flags worth knowing: `--dry-run` (show the plan, write nothing), `--quick` (EXIF only — no cert needed), `--no-weave` (canonical portrait only), `--force-new-cert` (rotate an agent's chain).

## Stage 2 — thumbnail + checksummed sidecar

```bash
python3 -B scripts/make-portrait-thumbs.py --agent bonsai --apply
```

Reads `portrait.png`, writes a metadata-stripped `portrait-thumb.b64` sized for a greeting widget (144px webp q75 by default — validated relay-safe, not just under the truncation ceiling) plus a `.meta` sidecar carrying byte count, SHA-256, **and an FNV-1a/32 checksum over the base64 string itself** — the second check exists because a same-length substitution can corrupt a relayed base64 string without changing its decoded byte count at all; see the script's own module docstring for the live incident that surfaced this.

## Stage 3 — universal identity card

```bash
python3 -B scripts/make-identity-cards.py --apply
```

Reads `agents/registry.json` (or `--registry` to point elsewhere) and writes a fixed-width, box-drawing plain-text card per agent — no base64 anywhere in it, so it's immune to the relay-corruption class of bug entirely. This is the tier-4 fallback in `agents/shared/routines.md` §Routine 2.5: the floor for a surface that can render neither a widget nor an image at all. Also the only tier that still identifies a forming agent with no portrait or fp8 yet.

## Files

| Path | Purpose |
|---|---|
| `scripts/portrait_lib.py` | Shared library — image crop/resize, cert generation, EXIF layer, C2PA layer |
| `scripts/make-canonical-portrait.py` | Stage 1 CLI |
| `scripts/make-portrait-thumbs.py` | Stage 2 CLI |
| `scripts/make-identity-cards.py` | Stage 3 CLI |
| `identity/<slug>/` | Generated per-agent cert chain — **gitignored, never commit** |

## Relationship to `agents/shared/routines.md` §Routine 2.5

This skill produces the assets that routine's greeting-portrait fallback chain consumes: `portrait.png` and `portrait-thumb.b64`/`.meta` feed tiers 1–2 (live URL / verified `show_widget` embed), the kanji-mark SVG (drawn separately, by hand or by Eisai — not generated here) feeds tier 3, and `portrait-card.txt` from stage 3 is tier 4. Regenerate stages 2–3 after any registry change or portrait update; stage 1 only needs re-running when the source photo changes.
