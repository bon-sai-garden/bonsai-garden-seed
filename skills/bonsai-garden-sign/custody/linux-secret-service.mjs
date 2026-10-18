/**
 * ---
 * id: 01M2D299G8C1NFV97TNJ976E86
 * title: Keyring Linux Secret Service
 * type: script
 * tended-by: mori-shin
 * created: 2026-09-13
 * updated: 2026-09-13
 * ---
 * `type: script` is a placeholder — pending Baisai's patterns.md proposal
 * (2026-09-13 review); see ../lib/derive-key.mjs's header for the full note.
 *
 * Linux custody backend — NOT YET BUILT.
 *
 * Intended shape, named here so the gap is specific rather than vague, and
 * so the honest limit of "Linux" as one platform name is visible up front —
 * unlike macOS/Windows, Linux has no single universal answer:
 *
 * - OS_PROTECTED tier, when a desktop session is running: the freedesktop
 *   Secret Service API (GNOME Keyring or KWallet), via `libsecret`
 *   (`secret-tool`) or the same `@napi-rs/keyring`-class binding proposed
 *   for Windows. Requires a running keyring daemon — not present on a
 *   headless server, most containers, or most CI runners.
 * - HARDWARE tier, when the machine has a provisioned TPM 2.0: a sealed key
 *   via `tpm2-tools` or a PKCS#11 module, independent of any desktop
 *   session — the one path that also covers a headless box.
 * - SOFTWARE_FALLBACK, honestly, for the common remaining case (a bare VM,
 *   container, or CI runner with neither): a passphrase- or key-wrapped
 *   file (age or libsodium sealed box) on disk. Real, but the weakest of
 *   the three tiers this design names — never to be returned here without
 *   assuranceTier correctly set to SOFTWARE_FALLBACK so nothing downstream
 *   mistakes it for OS_PROTECTED or HARDWARE.
 *
 * None of the three is implemented. This file exists so the dispatcher has
 * something honest to import on `linux` — it fails loudly and names the
 * actual gap, rather than pretending one Linux answer covers every Linux
 * machine.
 */

export default {
  platform: 'linux',
  assuranceTier: null,
  description: "Not yet built. See this file's own header — Linux needs at least two backends, not one.",
  async getMasterSaltHex() {
    throw new Error(
      'No Linux custody backend exists yet for the master salt. ' +
        'See tools/runtime/keyring/custody/linux-secret-service.mjs for the ' +
        'intended design (Secret Service/libsecret for OS_PROTECTED when a ' +
        'desktop session exists, tpm2-tools/PKCS#11 for HARDWARE where a TPM ' +
        'is provisioned, an explicit lower-assurance file fallback otherwise) ' +
        '— nothing here is implemented yet.',
    );
  },
};
