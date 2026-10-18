---
id: 01KTFDRH4RQF69HHAMZ6RNADVK
title: "Template — Presence (voice, sound, light)"
type: template
tended-by: tasai
created: 2026-06-06
updated: 2026-10-12
tags:
  - template
  - presence
  - voice
  - sound
  - light
---

# Template — Presence

> [!info] What a presence file is Every workshop agent has a `presence.md` at the top of their surface (`agents/<slug>/presence.md`, or the sub-agent path for *-shin). It holds how the agent is *present in the room* — voice, sound, light — the audible-and-visible twin of the cryptographic identity. Same identity, three senses: seen (mark), heard (voice + leitmotif), shown (ring hue).
>
> **Division of labour:** the shared machinery (daemon contract, event vocabulary, sound registers, ring topology) is canonical in [[agents/eisai/sub-agents/koe-shin/procedures/emit-and-render.md]]. The presence file holds only what is *this agent's own*. Registry-owned attributes (kanji, accent, fingerprint) are referenced from `agents/registry.json`, never duplicated (codex §12).

Copy everything below the rule. Replace `<...>` placeholders. Generate a fresh ULID (`python3 tools/new-file.py`). Delete guidance callouts on instantiation.

---

<!-- frontmatter
{ "id": "<ULID>", "title": "Presence — <Name>", "type": "presence", "tended-by": "<slug>", "created": "<YYYY-MM-DD>", "updated": "<YYYY-MM-DD>", "tags": ["presence", "voice", "sound", "light"] } -->

---
id: <ULID>
title: "Presence — <Name>"
type: presence
tended-by: <slug>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags:
  - presence
  - voice
  - sound
  - light
---

# Presence — <Name> (<kanji>)

> [!info] Identity anchors Kanji, accent colour, fingerprint, and mark URL are registry-owned: `agents/registry.json` → slug `<slug>`. This file never restates them as canon; the signature hue below *derives from* the registry accent.

## Voice

| Field | Value |
|---|---|
| Engine | Piper TTS |
| Model | `<path under $PIPER_VOICES_DIR, e.g. en/en_US/.../*.onnx>` |
| Speaker | `<speaker id, or — for single-speaker models>` |
| `length_scale` | `<1.0 = natural; 1.111 = 0.9× slower — see convention in voice index>` |
| Status | `<locked YYYY-MM-DD / proposed / not yet assigned>` |

**Audition note:** *<the line that earned the lock, e.g. "Warm without sweetness.">*

**Language layers:**

- **EN** — active layer; the model above.
- **DE** — not yet assigned; gated on the Piper licence question.
- **JA (names only)** — closed-set pre-render, asset key `asset:<kanji>`. Never live G2P (see emit-and-render §Kanji-TTS).

## Sound

- **Leitmotif sting** (`greeting` event): `<described / asset path / not yet designed>`. Design is proposal-autonomous; committing it as canonical is confirmation-gated — it becomes this agent's sound-name.
- **Shared affect registers** (droid `thinking`, cat-synth `done`/`error`/`idle`) apply per the daemon contract; per-agent variation only if noted here.

## Light

- **Signature hue:** derived from the registry accent (`accent-rgba`). Carried by the two lyrate pixels of the 16-LED ring; they lead every animation.
- **Event behaviour:** per the shared table in emit-and-render (greeting → SPREAD, thinking → SHIMMER, done → pulse-settle, error → COLLAPSE+red, idle → ORBIT, speak → envelope-follow). Per-agent deviations only if noted here.
- **Gesture mapping** (web/kiosk ring grammar): bow → resolve, smile → spread, think/lamp → shimmer. Agent-specific gestures listed here if any.

## Surfaces

| Surface | Status |
|---|---|
| Kiosk (Pi, `kiosk/server` AGENT_VOICES) | `<live / pending>` |
| Web (`agents.astro` ring + TTS) | `<live / pending>` |
| Holodeck | planned (interaction v0.2+) |

> [!warning] Keep the runtime in step The voice values here are canon; `tools/koe-shin-serve.py` and `kiosk/server/index.js` carry runtime copies. A change here is not done until both are updated **and** `python3 tools/check-voice-drift.py` exits clean (it compares all presence files against both runtime maps).

## Open items

- [ ] <what's loose>
