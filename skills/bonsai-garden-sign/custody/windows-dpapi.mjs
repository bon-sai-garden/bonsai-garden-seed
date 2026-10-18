/**
 * ---
 * id: 01M2D299EAERRC03FGZWBGRNBF
 * title: Keyring Windows Dpapi
 * type: script
 * tended-by: mori-shin
 * created: 2026-09-13
 * updated: 2026-09-13
 * ---
 * `type: script` is a placeholder — pending Baisai's patterns.md proposal
 * (2026-09-13 review); see ../lib/derive-key.mjs's header for the full note.
 *
 * Windows custody backend — NOT YET BUILT.
 *
 * Intended shape, named here so the gap is specific rather than vague:
 *
 * - OS_PROTECTED tier: DPAPI (`CryptProtectData`/`CryptUnprotectData`),
 *   scoped to the current Windows user, via a native binding (the
 *   `@napi-rs/keyring` line is the natural fit — it wraps DPAPI/Credential
 *   Manager on Windows, Keychain on macOS, and Secret Service on Linux
 *   behind one API, the way the archived `keytar` used to).
 * - HARDWARE tier, if the machine has a provisioned TPM 2.0: a key held in
 *   the Windows CNG "Platform Crypto Provider" (Microsoft's TPM-backed
 *   KSP), non-extractable the same way the Secure Enclave is on macOS.
 *
 * Neither is implemented. This file exists so `custody-provider.mjs`'s
 * dispatcher has something honest to import on win32 — it fails loudly and
 * says exactly what's missing, rather than the dispatcher silently
 * pretending Windows isn't a real platform.
 */

export default {
  platform: 'win32',
  assuranceTier: null,
  description: "Not yet built. See this file's own header for the intended DPAPI/TPM shape.",
  async getMasterSaltHex() {
    throw new Error(
      'No Windows custody backend exists yet for the master salt. ' +
        'See tools/runtime/keyring/custody/windows-dpapi.mjs for the intended ' +
        'design (DPAPI via @napi-rs/keyring for OS_PROTECTED, CNG Platform ' +
        'Crypto Provider for HARDWARE where a TPM is present) — nothing here ' +
        'is implemented yet.',
    );
  },
};
