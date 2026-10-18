/**
 * ---
 * id: 01M2D299CGQN9NA74A5XHGX338
 * title: Keyring Macos Keychain
 * type: script
 * tended-by: mori-shin
 * created: 2026-09-13
 * updated: 2026-09-13
 * ---
 * `type: script` is a placeholder — pending Baisai's patterns.md proposal
 * (2026-09-13 review); see ../lib/derive-key.mjs's header for the full note.
 *
 * macOS custody backend — reads the master salt from the real macOS
 * Keychain entry the workshop already provisions on the gardener's machine.
 *
 * Same account/service constants as bonsai-garden's tools/keyring/setup.mjs
 * — deliberately. This is not a second, parallel Keychain entry; it reads
 * the one real secret that already exists, so a signing operation run
 * through this service and one run through the existing workshop tooling
 * are reading the identical master salt. Provisioning (init/rotate/delete)
 * stays bonsai-garden's job (setup.mjs) — this module only ever reads.
 *
 * Assurance-tier honesty note: `security add-generic-password` (how the
 * entry is provisioned today) does not attach an explicit Secure-Enclave-
 * bound access-control instance. That means this backend, as currently
 * provisioned, is OS_PROTECTED — gated by the Keychain's own ACL and the
 * logged-in user's session — not HARDWARE. A future re-provisioning step
 * that binds the item to the Secure Enclave (via `kSecAttrAccessControl`
 * with biometry/Enclave gating) would earn the HARDWARE tier honestly;
 * until that happens, this file does not claim it.
 */

import { execSync } from 'node:child_process';
import { AssuranceTier } from '../lib/custody-provider.mjs';

const KEYCHAIN_ACCOUNT = 'bonsai-master-salt';
const KEYCHAIN_SERVICE = 'Bonsai Garden Master Salt';

async function getMasterSaltHex() {
  try {
    return execSync(`security find-generic-password -a ${KEYCHAIN_ACCOUNT} -s "${KEYCHAIN_SERVICE}" -w`, {
      encoding: 'utf8',
    }).trim();
  } catch (err) {
    throw new Error(
      `Could not read the master salt from the macOS Keychain ` +
        `(account "${KEYCHAIN_ACCOUNT}", service "${KEYCHAIN_SERVICE}"). ` +
        `Either it isn't provisioned on this machine (see bonsai-garden's ` +
        `tools/keyring/setup.mjs --init), or this process doesn't have ` +
        `Keychain access. Original error: ${err.message}`,
    );
  }
}

export default {
  platform: 'darwin',
  assuranceTier: AssuranceTier.OS_PROTECTED,
  description:
    'macOS Keychain (account "bonsai-master-salt") — OS-protected today; ' +
    'not yet re-provisioned with a Secure-Enclave-bound ACL, so not claimed ' +
    'as HARDWARE tier.',
  getMasterSaltHex,
};
