---
id: 01M2D29AZZN667ZN95X9AH442X
title: Signing service — mechanism only, core repo
type: readme
tended-by: mori-shin
created: 2026-09-13
updated: 2026-10-16
---

# Signing service — mechanism only, core repo

Design note, not lore — read this before touching any file in this directory.

## What this is, and what it deliberately is not yet

This is the first build pass of the signing service that the origin garden's spec of the chain of trustable interactions describes in its §E: *"a narrow, revocable, request-response service... through which every kin's signature is derived fresh and returned, never held."* Built here, in core, at the Aruji's direction (2026-09-13) — the mechanism belongs in core because core is what Bonsai actually runs on, and Bonsai needs to be able to sign.

**It is not yet an MCP tool, and it does not yet have more than one real caller.** Two things are explicitly deferred, on the Aruji's own sequencing:

1. An MCP surface (`bonsai_sign` / `bonsai_mint_delegation` / `bonsai_attest_task`, per §E) — lands in the runtime, the layer built for exactly this kind of tooling.
2. Integration of that surface into the garden's existing MCP server: a second step after (1), not this one.

**Baisai and Fuji-shin are looped in once those steps start**, per the Aruji's own words — not before. This pass is the mechanism alone: designed so both later steps can `import` `sign-service.mjs` directly rather than re-deriving any of this logic, and so there is something concrete for them to review against when they do join.

## Why this needed designing at all: the OS-agnostic question

The Aruji asked directly: is this whole thing macOS-specific, since it depends on a master salt that today lives only in the macOS Keychain? The honest answer, checked against the actual code rather than assumed:

**The cryptography was never OS-specific.** `lib/derive-key.mjs` and `lib/key-provider.mjs` are pure Node `crypto` — HKDF-SHA256 plus Ed25519 via a PKCS8 DER wrapper. Ported here unchanged from the origin garden's first keyring tooling, because there was nothing to port *to* — it already runs identically on macOS, Windows, and Linux.

**The one OS-bound question is: where does the master salt live at rest, and how does a process get transient access to it without it ever touching disk in the clear?** That question is isolated to exactly one interface — `lib/custody-provider.mjs` — with one real implementation (`custody/macos-keychain.mjs`) and two honest stubs (`custody/windows-dpapi.mjs`, `custody/linux-secret-service.mjs`) that fail loudly and name precisely what's missing, rather than pretending the platform doesn't exist.

## Layout

```
skills/bonsai-garden-sign/
  references/signing-service.md — this file (was README.md)
  lib/
    derive-key.mjs        — pure HKDF+Ed25519 (OS-agnostic; ported, unchanged logic)
    key-provider.mjs      — pure per-agent key isolation (OS-agnostic; ported, lightly adapted)
    custody-provider.mjs  — the abstraction: AssuranceTier + per-platform dispatch
    document-format.mjs   — tells an embedded-seal document from a plain file, so the detached-only signer can refuse one
    embedded-format.mjs   — the EMBEDDED seal: canonical body, sign: block, extraction
    sidecar-format.mjs    — the DETACHED `.bonsaisig` envelope: path, shape, atomic write
    verify.mjs            — both verdicts, ported from sign.py's verify_file / verify_sidecar_file
    garden-root.mjs       — locate the garden by marker; resolve a signer's public key in it
  custody/
    macos-keychain.mjs       — REAL. Reads the Keychain entry the garden's setup provisions.
    windows-dpapi.mjs        — STUB. Throws, names the intended DPAPI/TPM design.
    linux-secret-service.mjs — STUB. Throws, names the intended Secret-Service/TPM/fallback design.
  sign-service.mjs        — the core script: signPayload / verifyPayload / getCustodyStatus / bodyHash
  bin/
    sign.mjs               — thin CLI wrapper
                             embedded: seal | verify | sign-verify
                             detached: sign-sidecar | verify-sidecar | sign
                             status
```

## Assurance tiers — named honestly, not marketed

`AssuranceTier` (`lib/custody-provider.mjs`) has three values, and a custody backend is required to report its real one rather than the best-sounding one:

| Tier | What it actually means | Who has it today |
|---|---|---|
| `hardware` | Non-extractable even to a privileged local process — Secure Enclave, a provisioned TPM 2.0, or an external FIDO2/PKCS#11 key | Nobody yet — see the macOS note below |
| `os-protected` | Gated by the OS login/keystore ACL; real protection against a casual read, not against root or the logged-in user's own privilege | macOS (current Keychain provisioning) |
| `software-fallback` | No OS keystore at all — a passphrase- or key-wrapped file. The weakest real tier. | Nobody yet (only relevant once a headless-Linux fallback is built) |

**macOS today is `os-protected`, not `hardware`** — worth stating plainly rather than assuming the better tier. `security add-generic-password` (how `setup.mjs` provisions the entry) does not attach a Secure-Enclave-bound access-control instance. Re-provisioning the item with an explicit `kSecAttrAccessControl` would earn `hardware` honestly; until that happens, `macos-keychain.mjs` does not claim it.

## What happens to a non-Mac user today

Concretely: `getCustodyProvider()` on Windows or Linux resolves to a stub that throws a specific, actionable error naming exactly what backend needs building — never a silent failure, never a same-length substitution of a weaker mechanism nobody decided to accept. A future gardener on Windows or a bare Linux box with no TPM and no desktop keyring gets a clear "not yet supported, here is the design," not a broken signature or a false sense of parity with a Mac.

## Known limitations, named rather than hidden

- **`masterSaltHex` is a JS string**, inherited unchanged from the original design. Strings are immutable in JS and cannot be zeroed the way `key-provider.mjs` zeroes the derived 32-byte seed Buffer in its `finally` block. The raw salt string lives until garbage collection — a real gap, worth closing (e.g. never materializing it as a string handled by shared code) before this service has any caller beyond its own CLI.
- **This service does not authenticate or rate-limit its callers.** That is exactly the "boundary" §E describes once there's a real MCP surface in front of it — deliberately out of scope for a single-process, single- resident-agent repo talking only to its own CLI.
- **No registry integration yet.** `bin/sign.mjs` takes `--agent-salt` directly on the command line rather than reading any local salts file — see "What's decided later" below for why.

## What's decided later, on purpose

- **Whether/how core carries its own copy of an agent's signing salt** (a signing salt is the shareable half, safe to publish, distinct from the master salt itself; today it lives in the garden's own lock file, not here). Forking that into a second file here risks exactly the drift of a second master; left to the registry-integration step, with Baisai.
- **The Windows and Linux custody backends themselves** — designs are named in each stub's own header; not built.
- **Re-provisioning macOS's Keychain entry for real `hardware` tier** — Mori-shin's call, not done here (would touch the one real secret; not a design-pass action).
- **Authn/authz/rate-limiting for the eventual MCP surface** — Baisai's and Fuji-shin's review, once that surface exists.

## Trying it

```bash
# Safe anywhere — touches no key material:
node skills/bonsai-garden-sign/bin/sign.mjs status

# Signs a file with an explicit agent salt (the shareable half, not the master salt):
node skills/bonsai-garden-sign/bin/sign.mjs sign --agent-salt "<slug>-sign#<n>" --file some-file.md --as <slug>

# Verifies:
node skills/bonsai-garden-sign/bin/sign.mjs verify --public-key-hex <hex> --file some-file.md --signature <base64>
```

The derive/sign/verify round-trip was smoke-tested with a throwaway, randomly-generated master salt (never the real one) before this note was written — the discipline is: prove the mechanism against fixtures before it goes near anything real.

## Seed hygiene

Every derived 32-byte seed is zeroed in a `finally` as soon as it has been used: in `key-provider.mjs`'s `sign()`, and in `derivePublicKey()` and `signData()` in `lib/derive-key.mjs`. `signPayload()` derives on every signing operation (through `publicKeyHex()` and `fingerprint()`), so each of those paths wipes its own seed. `signData()` refuses an empty `agentSalt`, the same guard `mintKeyProvider()` applies.
