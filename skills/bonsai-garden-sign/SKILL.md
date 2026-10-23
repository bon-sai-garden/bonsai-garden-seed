---
name: bonsai-garden-sign
description: >
  Derive an agent's signing key from a master salt and sign with it, without the
  private key ever touching disk. HKDF-SHA256 (info "ed25519-agent-key") → Ed25519, with OS-native custody
  (macOS Keychain, Linux Secret Service, Windows DPAPI) behind one interface.
  The signing half of the garden's identity layer — mechanism only, no roster.
version: 1.1.1
---
> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: use nothing here, and tell the gardener exactly what it said. A tampered file is not executed.

# Bonsai Sign

**What this is.** The capability behind every signature in a garden: take a master salt held in OS-native custody, derive a per-agent key from it, and sign. The private key is derived on use and never written down.

**Why it is in core.** It is a *capability*, not an instance — any garden needs to sign, and nothing here names an agent, reads a registry, or knows a roster. `bin/sign.mjs` says so of itself: *"Deliberately does NOT read any registry or locked-salts file on its own."* The salts and keys that make it **our** garden's signatures live in pot. See `LAYERS.md` → *capability vs. instance*.

```
lib/derive-key.mjs       master salt + agent id  →  Ed25519 keypair (HKDF-SHA256)
lib/custody-provider.mjs one interface over the three OS key stores
lib/key-provider.mjs     resolve which key to use, without a registry
custody/macos-keychain.mjs
custody/linux-secret-service.mjs
custody/windows-dpapi.mjs
bin/sign.mjs             the CLI entry point
sign-service.mjs         the long-running service form
```

## Using it

```bash
node skills/bonsai-garden-sign/bin/sign.mjs --help
```

The caller supplies the agent id and the material to sign. Where the master salt lives is the custody provider's business; where the agent ids come from is the caller's. This skill answers one question — *what is the signature?* — and deliberately knows nothing else.

## Relocated 2026-09-14

Was `tools/runtime/kanji-identicon`'s sibling at `tools/runtime/keyring/`. That directory name said *runtime*, which under `LAYERS.md` means *secure read/write into the garden repos* — a different layer. The code never moved; the label was wrong. The Aruji, 2026-09-14: *"I think the label is wrong."*

## Two forms, and the verbs that write and read each

| verb | form | covers | lands |
|---|---|---|---|
| `seal` | **embedded** | `body-hash` over the canonical body, frontmatter excluded | **into** the document's frontmatter |
| `verify` | **embedded** | the same, recomputed | a verdict |
| `sign-verify` | **embedded** | `seal`, then `verify` what was written | both |
| `sign-sidecar` | **detached** | `body-hash` over the file's **exact bytes** | a `.bonsaisig` beside it |
| `verify-sidecar` | **detached** | the same, recomputed | a verdict |
| `sign` | **detached** | the same | an envelope on **stdout**; writes nothing |

```bash
node bin/sign.mjs seal           --agent-salt <salt> --file <doc.md>    --as <slug>
node bin/sign.mjs verify         --file <doc.md>    [--keys published|garden]
node bin/sign.mjs sign-sidecar   --agent-salt <salt> --file <any-file>  --as <slug>
node bin/sign.mjs verify-sidecar --file <any-file>  [--keys published|garden]
```

**Whose keys a verdict trusts** (`references/trust-anchor.md`). By default, the published keys: the seal goes to `https://bon-sai.garden/verify`, and the answer is believed only when the workshop verifier key has signed it. If the site cannot be reached, the verdict is `keys-unreachable`, which is a FAIL. There is no offline pass and no fallback. `--keys garden` reads the signer's key from a garden checkout instead. It is for host tooling that holds the source the site is built from, and it has to be named.

**`verify-sidecar` is the one that earns its keep.** It is the only thing in the garden that detects a *stale detached seal* — a file edited after its `.bonsaisig` was written. It is what found the garden's stale seals, which were then repaired. Run it before trusting any `.bonsaisig`, including this skill's own.

The verdicts are a fixed vocabulary, because callers branch on them: `ok` · `hash-mismatch` · `bad-signature` · `unknown-signer` · `no-sidecar` / `no-signature` · `bad-sidecar (…)`. On the published path, `unknown-signer` gives way to `rejected`, and five more refusals join it: `keys-unreachable` · `answer-unsigned` · `answer-forged` · `answer-malformed` · `open-unpublished`. Order matters as much as the values: a **fingerprint** that the signer's key does not derive is reported as `bad-signature` *before* the hash is looked at, so a wrong-key seal is never mistaken for a merely stale one.

**Not ported from `tools/sign.py`, deliberately** (decided on the caller evidence, when `sign.py`'s retirement was planned): `unsign`, `info` and `verify-response` — no live caller for any of the three. PNG seals are also not ported: they need Pillow, and `verify` **refuses** a `.png` loudly rather than returning a verdict it cannot compute.

`seal` is the Node port of sign.py, and exists because of the gardener's ruling of 2026-09-15: *"signing is a core concept for the garden. being able to sign md files is a necessity for core."* Under `LAYERS.md` core is the seed — a garden that cannot seal its own constitutions from core alone is not one the rite can deliver.

**It is byte-identical to `python3 tools/sign.py sign`.** Not "compatible": identical. Sealing the same document with either tool produces the same bytes, and a seal from one verifies under the other — 28/28 at function level, 18/18 on round trips including *"identical sealed bytes"* in both directions.

Three things a reimplementation gets wrong, all of which these tests exist to catch:

- the signature is over **`bytes.fromhex(body_hash)`** — the 64 raw hash bytes, not the body, not the hex string;
- the `sign:` block's `fingerprint` is **32 hex chars**, while this skill's own `provider.fingerprint()` returns **eight** under the same name;
- the frontmatter boundary is `sign.py`'s `_FM_RE`, **not** `core/frontmatter.py`'s — they disagree on CRLF.

```
node     test-document-format.mjs           14 unit checks
node     test-published-negative.mjs        14 checks on the published path; --live also asks the site
```

Four more run only where the Python signer sits beside this one: 28 function-level checks and 18 round trips against it, the corpus harness (143 real `.bonsaisig` files, both tools, same verdict), and 34 negative checks, every one of them a guard failing.

The corpus harness is the one to believe. Fixtures are written by the same hand that writes the port, so they agree with its misunderstandings; the 143 sidecars in the origin garden's repository do not. Nine of them carry genuinely stale seals nobody planted, and the port has to flag exactly those nine — passing 134 and disagreeing on the nine that matter is a failure, not a near miss.

## What it refuses, and why

`bin/sign.mjs` **refuses a document carrying an embedded `sign:` block** (exit 3) and names the tool that owns that form. It produces the *detached* form — `file_hash` over exact bytes, in a `.bonsaisig` beside the file. The *embedded* form — `body-hash` over the canonical body, written into the document's own frontmatter — is `tools/sign.py`'s.

Before 2026-09-15 it signed them anyway: it hashed the whole file, the stale seal included, and returned an envelope with exit 0. Zensai hit it on his own `about-me.md` at the gardener's instruction and nothing said the document had not been sealed. That is the detached-only signer rule.

The guard is narrow. Plain markdown still signs; only a *sealed* document is refused. `lib/document-format.mjs` ports `tools/core/frontmatter.py`'s boundary rather than re-deriving it — and ports its *accessor semantics* too, verified 10/10 against the Python on the awkward inputs. Regression test: `node test-document-format.mjs` (12 assertions, the first four on the refusal).

## Open

- Two competing `derive-key.mjs` existed, here and in the origin garden's repository. This is the survivor. The other copy retires with the signing-suite consolidation.
- **`sign-sidecar` takes the salt; `sign.py` looks it up.** sign.py resolves an agent's signing salt from the origin garden's `locked-salts.json`; this skill will not read a registry to find key material (`sign-service.mjs` says why), so the caller names the salt. Every caller repointed in step 3 of `sign.py`'s retirement has to learn that. It is arguably the better contract — it makes the caller say which key it signs with — but it is a real interface difference, not a detail.
- **Seal-open has no published contract.** Its second signature is over an open payload, not a body-hash, so it verifies only with `--keys garden` (`references/trust-anchor.md`).
- **PNG seals have no home in core** and `sign.py` is where they still live. Whoever retires `sign.py` owns that question.
