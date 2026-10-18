/**
 * ---
 * id: 01M2D299ASMBN4ZEB46V1GFVWX
 * title: Keyring Custody Provider
 * type: script
 * tended-by: mori-shin
 * created: 2026-09-13
 * updated: 2026-09-13
 * ---
 * `type: script` is a placeholder — pending Baisai's patterns.md proposal
 * (2026-09-13 review); see ../lib/derive-key.mjs's header for the full note.
 *
 * Custody provider abstraction — the one place this signing service knows
 * an operating system exists.
 *
 * Everything in ./derive-key.mjs and ./key-provider.mjs is pure Node
 * `crypto`, with zero platform dependency. The only OS-bound question in
 * the whole signing story is: *where does the master salt live at rest,
 * and how does a process get transient, in-memory access to it without it
 * ever touching disk in the clear?* This module names that question as an
 * interface and dispatches to one backend under ../custody/ per platform,
 * so nothing above this file ever has to know which OS it's running on.
 *
 * A custody provider is a plain object shaped like:
 *   {
 *     platform: string,           // 'darwin' | 'win32' | 'linux'
 *     assuranceTier: AssuranceTier,
 *     description: string,        // one line, human-readable, honest
 *     async getMasterSaltHex(): Promise<string>,
 *   }
 *
 * Design rule, named so it doesn't drift: a custody provider FAILS LOUDLY
 * when it cannot retrieve the salt. It never silently falls back to a
 * lower-assurance backend on the same machine — that would let a trust
 * claim quietly downgrade without anyone deciding it should. If a machine
 * is meant to have more than one custody option, that's a deliberate,
 * visible choice made by whoever configures the process, not something
 * this dispatcher picks for itself.
 */

/**
 * Assurance tiers — named honestly, not marketed. A tier describes how the
 * master salt is actually protected at rest on that backend, so nothing
 * downstream has to guess what "protected" means on a given machine.
 */
export const AssuranceTier = Object.freeze({
  // Non-extractable even to a privileged local process — backed by
  // dedicated secure hardware (Apple Secure Enclave, a provisioned TPM 2.0
  // via CNG or tpm2-tools, or an external FIDO2/PKCS#11 hardware key).
  HARDWARE: 'hardware',

  // Gated by the OS's own login/keystore mechanism (macOS Keychain without
  // an explicit Secure-Enclave-bound ACL, Windows DPAPI, a desktop Secret
  // Service such as GNOME Keyring or KWallet). Real protection against a
  // casual read, not against a sufficiently privileged local attacker who
  // can act as the logged-in user or root.
  OS_PROTECTED: 'os-protected',

  // No OS keystore available at all — a passphrase- or key-wrapped file on
  // disk (e.g. an age or libsodium sealed box). The weakest real tier;
  // never silently presented as equivalent to the other two.
  SOFTWARE_FALLBACK: 'software-fallback',
});

/**
 * Resolve the custody provider for the current process's platform.
 *
 * @returns {Promise<object>} the platform's custody provider
 * @throws {Error} if no custody backend exists yet for this platform
 */
export async function getCustodyProvider() {
  switch (process.platform) {
    case 'darwin': {
      const mod = await import('../custody/macos-keychain.mjs');
      return mod.default;
    }
    case 'win32': {
      const mod = await import('../custody/windows-dpapi.mjs');
      return mod.default;
    }
    case 'linux': {
      const mod = await import('../custody/linux-secret-service.mjs');
      return mod.default;
    }
    default:
      throw new Error(
        `No master-salt custody provider exists for platform "${process.platform}" yet. ` +
          `See tools/runtime/keyring/README.md for the supported set and how to add one.`,
      );
  }
}
