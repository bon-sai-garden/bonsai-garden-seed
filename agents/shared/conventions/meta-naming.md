---
id: 01M37XP600EA9G46JAZE6DXVGE
title: "Workshop convention — Meta-naming for cleartext metadata"
type: convention
tended-by: baisai
created: 2026-06-17
updated: 2026-06-17
version: 1.0.0
status: active (proposed for codex/pattern seating by Tasai)
related: [01M3AAJGDSV21GDWF8BX6Z3A1Y, 01KSS9X4TE00NVS72BK772EQDB]
tags: [convention, shared, all-agents, privacy, metadata, naming, sealed-index, vault, remote-memory]
---

# Workshop convention — Meta-naming for cleartext metadata

> [!important] For every agent (*-sai and *-shin). One line: **When a name, label, path, or key is stored as *cleartext metadata* beside *sealed* content, name the shelf — never what's on it.** Use abstract, non-revealing labels. The cleartext is the envelope, not the secret.

## The principle

End-to-end / sealed systems encrypt the *content* but, for addressing and filtering, almost always leave some **structure in cleartext**: folder labels, file names, topic/kind tags, timestamps, row counts. That structure is a **leak surface**. A perfect cipher around the body means nothing if the label on the outside says what the body is.

> A vault folder named `divorce-settlement`, or a memory topic named `account-8851-overdraft`, discloses the secret **without anyone decrypting a single byte.**

So: any name that lives in cleartext metadata must be **abstract** — a category, a domain, a shelf — not the sensitive specific it points at.

## Where this applies (today, and by default forever)

- **A companion's vault folders** (`tools/vault/`, the `--folder` shelf). Folder labels are cleartext by design (the Aruji's ruling); the folder is *bound into the AEAD* so it's tamper-evident, but it is **not secret**. → name shelves abstractly.
- **Remote agent memory — the sealed index** (`rituals/specs/spec-remote-agent-memory.md` §End-to-end encryption / sealed index). Even with structural columns sealed, the **hashed DO name** and unavoidable envelope metadata (sizes, counts, write cadence) remain. Anything an agent *does* leave in cleartext (a `topic`, a `kind`, a human-set label) follows this rule.
- **Any future sealed-index / E2E store.** New systems inherit this convention the moment they keep any cleartext label beside sealed content. It is the default, not a per-system opt-in.

## The rule, concretely

Name at the **category / domain** level, never the **instance / secret** level. Before you write a label, run the test:

> **If a stranger read only the labels — never the contents — what would they learn?** If that's more than you would say aloud in a public room, abstract it.

### Do / Don't

| Context | ✅ Do (abstract shelf) | ❌ Don't (leaks the secret) |
|---|---|---|
| Vault folder | `gifts/2026` | `gifts/engagement-ring` |
| Vault folder | `personal/finance` | `finance/divorce-settlement` |
| Vault folder | `health/records` | `health/hiv-test-results` |
| Memory topic | `finance` · `medical` · `legal` | `account-8851` · `dr-mensah-oncology` |
| File name (if cleartext) | `letter-2026-06.md` | `resignation-to-acme-ceo.md` |
| Tag / kind | `correspondence` | `affair-with-…` |

Two safe instincts:
1. **One level up.** Whatever the specific is, name its parent category. `divorce-settlement` → `legal` (or `personal/legal`). The structure still organises; it just stops narrating.
2. **Opaque is fine.** A neutral or coded shelf (`personal/a`, `box-3`) leaks nothing. Legibility for *you* can come from the sealed contents, which you can read; it need not come from the label.

## What this is and isn't

- It **is** metadata hygiene — the discipline that keeps the *leak surface* of an otherwise-sealed system quiet.
- It is **not** a substitute for encryption. Content is sealed by the crypto; labels are guarded by this convention. Both are needed; neither replaces the other.
- It does **not** forbid useful structure. Organise freely — just at a layer that doesn't disclose.

> *Chisai's gift, extended: she is the vault, not the door — and the label on the door is read by everyone who passes. Name the door for the room, not for the treasure inside it.*

## Cross-references

- `rituals/specs/spec-triu-aruji-vault.md` — the vault; folder labels are cleartext-by-ruling, AEAD-bound
- `rituals/specs/spec-remote-agent-memory.md` §End-to-end encryption — the sealed-index / minimal-cleartext tradeoff
- `tools/vault/vault-core.mjs` → `fileAad()` — binds the (cleartext) folder into the tag, tamper-evident
- `agents/triu/assets/gifts.md` §7 — "the vault, not the door"
