/**
 * ---
 * id: 01M2D29991R6ME7WZTF1A8FBEA
 * title: Keyring Key Provider
 * type: script
 * tended-by: mori-shin
 * created: 2026-09-13
 * updated: 2026-10-21
 * ---
 * `type: script` is a placeholder — pending Baisai's patterns.md proposal
 * (2026-09-13 review); see lib/derive-key.mjs's header for the full note.
 *
 * KeyProvider — the structural per-agent signing-key isolation boundary.
 *
 * Ported and lightly adapted from the origin garden's tools/keyring/key-provider.mjs
 * (Mori-shin, 2026-09-13). Like derive-key.mjs, this module is pure — it takes
 * a masterSaltHex and an agentSalt string as plain arguments and holds no
 * platform-specific code anywhere. Where the master salt itself comes from is
 * entirely out of scope here; see ../custody/ and ../sign-service.mjs.
 *
 * A KeyProvider, once minted for one agent, exposes only zero-argument
 * operations (`sign(data)`, `publicKeyHex()`, `fingerprint()`) — there is no
 * method anywhere on the object that takes a second agentSalt or agentId.
 * Re-pointing at a different agent requires minting an entirely new provider
 * object — a visible, deliberate act, never a parameter that could drift.
 *
 * Buffer hygiene: `sign()` derives its own seed, uses it, and zeroes it
 * (`.fill(0)`) in a `finally` block before returning — win or throw, the raw
 * 32-byte seed does not outlive the call that needed it. (The masterSaltHex
 * string itself is a JS string, not a Buffer — it can't be zeroed the same
 * way. That is an inherited limitation, not something this port introduces;
 * see references/signing-service.md's Known limitations section.)
 *
 * Adapted from the original: `mintKeyProviderForAgent` here resolves against
 * a plain `{ [agentId]: { signing_salt } }` map passed in by the caller,
 * not against the origin garden's `agents-registry.mjs` (a different repo's
 * registry shape). Core is meant to stand alone — it should not reach back
 * into the origin garden's registry module to mint a key for its own resident
 * agent. Full registry-backed validation (unknown-id refusal, etc.) is left
 * to whatever wires this into core's own registry, later, alongside Baisai.
 */

import crypto from 'node:crypto';
import { deriveKey, createPrivateKeyFromSeed, derivePublicKey } from './derive-key.mjs';

// Tracks which objects were actually minted by this module, so pool code
// can assert "this is a real provider" rather than trusting shape alone.
const minted = new WeakSet();

/**
 * Mint a KeyProvider bound permanently to one (masterSaltHex, agentSalt)
 * pair.
 *
 * @param {string} masterSaltHex - 32-byte master salt (hex). Host-side only.
 * @param {string} agentSalt - the salt string this provider is bound to.
 * @returns {object} frozen provider exposing sign/publicKeyHex/fingerprint.
 */
export function mintKeyProvider(masterSaltHex, agentSalt) {
  if (typeof agentSalt !== 'string' || agentSalt.length === 0) {
    throw new Error('mintKeyProvider requires a non-empty agentSalt bound at mint time');
  }

  // Frozen into the closure — no method below re-accepts an identity.
  const boundMasterHex = masterSaltHex;
  const boundSalt = agentSalt;

  const provider = Object.freeze({
    agentSalt: boundSalt,

    sign(data) {
      const seed = deriveKey(boundMasterHex, boundSalt);
      try {
        const privKey = createPrivateKeyFromSeed(seed);
        const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
        return crypto.sign(null, dataBuffer, privKey);
      } finally {
        seed.fill(0);
      }
    },

    publicKeyHex() {
      return derivePublicKey(boundMasterHex, boundSalt).publicKeyHex;
    },

    fingerprint() {
      const { publicKeyHex } = derivePublicKey(boundMasterHex, boundSalt);
      return crypto.createHash('sha256').update(Buffer.from(publicKeyHex, 'hex')).digest('hex').slice(0, 8);
    },
  });

  minted.add(provider);
  return provider;
}

/**
 * Mint a KeyProvider for a core-resident agent by id, resolving its signing
 * salt from a plain `{ [agentId]: { signing_salt } }` map (the same shape as
 * the `.agents` map in the origin garden's `locked-salts.json`, deliberately —
 * so a salt entry can be copied across without reshaping it, but core never
 * imports the origin garden's own registry module to do the copying).
 *
 * @param {string} agentId - e.g. "bonsai"
 * @param {string} masterSaltHex - host-side master salt (never from a repo file)
 * @param {object} agentSalts - `{ [agentId]: { signing_salt } }` map
 * @returns {object} frozen provider bound to that one agent
 */
export function mintKeyProviderForAgent(agentId, masterSaltHex, agentSalts) {
  const entry = agentSalts?.[agentId];
  if (!entry?.signing_salt) {
    throw new Error(`Agent "${agentId}" has no signing salt in the supplied map — cannot mint a KeyProvider`);
  }

  return mintKeyProvider(masterSaltHex, entry.signing_salt);
}

/**
 * True if `obj` is a provider minted by this module (i.e., not a plain
 * object impersonating one).
 */
export function isKeyProvider(obj) {
  return minted.has(obj);
}

export default { mintKeyProvider, mintKeyProviderForAgent, isKeyProvider };
