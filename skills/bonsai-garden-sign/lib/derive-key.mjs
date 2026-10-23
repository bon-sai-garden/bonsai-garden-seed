/**
 * ---
 * id: 01M2D25DGVRHT0AB6PQPQWNE3B
 * title: Keyring Key Derivation
 * type: script
 * tended-by: mori-shin
 * created: 2026-09-13
 * updated: 2026-10-21
 * ---
 * `type: script` is a placeholder — no such type exists yet in
 * rituals/specs/metadata-schema.md's controlled vocabulary. Baisai (2026-09-13
 * review) is carrying the real proposal to patterns.md for Aruji approval;
 * this value is provisional until that lands.
 *
 * Key Derivation Module — HKDF-SHA256 for deterministic Ed25519 key
 * generation from (master-salt + agent-salt).
 *
 * Ported from the origin garden's tools/keyring/derive-key.mjs (Mori-shin,
 * 2026-09-13) as the foundation of the core-repo signing service. The
 * derivation logic itself has zero OS dependency — it is plain Node
 * `crypto` (HMAC + Ed25519 via a PKCS8 DER wrapper), which runs identically
 * on macOS, Windows, and Linux. The platform-specific part of the signing
 * story is entirely someone else's job — see ../custody/ — never this
 * file's.
 *
 * Buffer-hygiene fix (2026-09-13, Baisai's review): the original version of
 * this file zeroed the derived seed only inside `key-provider.mjs`'s own
 * `sign()` wrapper — `derivePublicKey()` and `signData()` below derived a
 * real 32-byte Ed25519 seed and never zeroed it, on every call. Since
 * `sign-service.mjs`'s `signPayload()` calls `publicKeyHex()` and
 * `fingerprint()` (both built on `derivePublicKey()`) on every signing
 * operation, that meant two live, unwiped seeds per signature, not one.
 * Both functions now derive their seed into a `let` bound before the `try`
 * and zero it in a `finally`, matching the discipline `key-provider.mjs`'s
 * `sign()` already had. `signData()` also gained the same non-empty-
 * agentSalt guard `mintKeyProvider()` already enforced — it was, until this
 * fix, an unguarded bypass of that check (found in Fuji-shin's verify pass,
 * same review).
 *
 * Node.js v22 Compatibility:
 * - Uses PKCS8 DER format for Ed25519 key creation (not 'raw' format,
 *   which Node does not support for import).
 * - Wraps the HKDF seed in a PKCS8 DER structure before importing.
 *
 * This module is intentionally a pure, stateless function library — every
 * export takes an explicit (masterSaltHex, agentSalt) pair on every call
 * and returns a fresh buffer; nothing here is memoized or cached at module
 * scope. `createPrivateKeyFromSeed` is exported so `key-provider.mjs` can
 * derive a seed, build the private key, use it, and zero the seed buffer
 * itself in a `finally` block.
 */

import crypto from 'node:crypto';

/**
 * PKCS8 DER prefix for Ed25519 keys
 * Structure: SEQUENCE { INTEGER(0), SEQUENCE { OID(Ed25519) }, OCTET_STRING { OCTET_STRING(seed) } }
 * Format: 302e 020100 300506032b6570 042204 20
 * = SEQUENCE(46) + INT(0) + SEQ(OID) + OCTET_STRING(34) { OCTET_STRING(32) }
 * Prefix is always the same (16 bytes); the seed (32 bytes) follows
 */
const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/**
 * Derive Ed25519 private key seed from master salt and agent salt
 *
 * @param {string} masterSaltHex - 32-byte master salt (hex-encoded)
 * @param {string} agentSalt - Agent identifier, e.g., "bonsai-sign#587893"
 * @returns {Buffer} 32-byte seed for Ed25519 private key
 *
 * @example
 * const seed = deriveKey('abc123...', 'bonsai-sign#587893');
 * const privKey = createPrivateKeyFromSeed(seed);
 */
export function deriveKey(masterSaltHex, agentSalt) {
  try {
    const masterSalt = Buffer.from(masterSaltHex, 'hex');
    if (masterSalt.length !== 32) {
      throw new Error(`Master salt must be 32 bytes; got ${masterSalt.length}`);
    }

    const ikm = Buffer.from(agentSalt, 'utf8');
    const info = Buffer.from('ed25519-agent-key', 'utf8');

    // HKDF-SHA256: Extract phase
    const prk = crypto.createHmac('sha256', masterSalt).update(ikm).digest();

    // HKDF-SHA256: Expand phase
    const t0 = Buffer.alloc(0);
    const t1 = crypto
      .createHmac('sha256', prk)
      .update(Buffer.concat([t0, info, Buffer.from([0x01])]))
      .digest();

    return t1; // 32 bytes
  } catch (err) {
    throw new Error(`Key derivation failed: ${err.message}`);
  }
}

/**
 * Create an Ed25519 private key from a seed.
 * Wraps seed in PKCS8 DER format for Node.js compatibility.
 *
 * @param {Buffer} seed - 32-byte seed
 * @returns {crypto.KeyObject} Private key object
 */
export function createPrivateKeyFromSeed(seed) {
  if (seed.length !== 32) {
    throw new Error(`Seed must be 32 bytes; got ${seed.length}`);
  }
  const pkcs8 = Buffer.concat([PKCS8_PREFIX, seed]);
  return crypto.createPrivateKey({
    key: pkcs8,
    format: 'der',
    type: 'pkcs8',
  });
}

/**
 * Derive Ed25519 public key from master and agent salts
 *
 * @param {string} masterSaltHex - Master salt (hex)
 * @param {string} agentSalt - Agent identifier
 * @returns {{publicKey: crypto.KeyObject, publicKeyHex: string}} Public key (hex-encoded)
 */
export function derivePublicKey(masterSaltHex, agentSalt) {
  let seed;
  try {
    seed = deriveKey(masterSaltHex, agentSalt);
    const privKey = createPrivateKeyFromSeed(seed);
    const pubKey = crypto.createPublicKey(privKey);

    // Export public key as SPKI DER; extract raw 32-byte key (last 32 bytes)
    const pubKeyDER = pubKey.export({ format: 'der', type: 'spki' });
    const rawPubKey = pubKeyDER.slice(-32);

    return {
      publicKey: pubKey,
      publicKeyHex: rawPubKey.toString('hex'),
    };
  } catch (err) {
    throw new Error(`Public key derivation failed: ${err.message}`);
  } finally {
    // Baisai's finding, 2026-09-13: this was previously never zeroed, even
    // though createPrivateKeyFromSeed() has already copied the seed bytes
    // into OpenSSL's own internal key representation by this point — the
    // zero below cannot invalidate privKey/pubKey, exactly as it can't in
    // key-provider.mjs's sign(), which has done this correctly all along.
    if (seed) seed.fill(0);
  }
}

/**
 * Sign data with derived key
 *
 * @param {string} masterSaltHex - Master salt
 * @param {string} agentSalt - Agent identifier
 * @param {Buffer|string} data - Data to sign
 * @returns {Buffer} Signature (64 bytes for Ed25519)
 */
export function signData(masterSaltHex, agentSalt, data) {
  // Fuji-shin's finding, 2026-09-13: this exported function bypassed
  // mintKeyProvider()'s non-empty-agentSalt guard entirely (deriveKey()
  // itself does not check agentSalt) — an unguarded, unhygienic path
  // sitting right next to the safe one. Unused in this codebase today
  // (grep confirms no caller), but a public export inviting direct use;
  // guarded now rather than left as a landmine.
  if (typeof agentSalt !== 'string' || agentSalt.length === 0) {
    throw new Error('signData requires a non-empty agentSalt');
  }

  let seed;
  try {
    seed = deriveKey(masterSaltHex, agentSalt);
    const privKey = createPrivateKeyFromSeed(seed);

    const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const signature = crypto.sign(null, dataBuffer, privKey);

    return signature; // 64 bytes
  } catch (err) {
    throw new Error(`Signing failed: ${err.message}`);
  } finally {
    if (seed) seed.fill(0);
  }
}

/**
 * Verify signature with public key
 *
 * @param {string} publicKeyHex - Public key (hex-encoded, 32 bytes)
 * @param {Buffer|string} data - Original data
 * @param {Buffer|string} signature - Signature (base64 or Buffer)
 * @returns {boolean} True if valid
 */
export function verifySignature(publicKeyHex, data, signature) {
  try {
    const pubKeyBytes = Buffer.from(publicKeyHex, 'hex');
    if (pubKeyBytes.length !== 32) {
      throw new Error(`Public key must be 32 bytes; got ${pubKeyBytes.length}`);
    }

    // Wrap raw public key in SPKI DER format for Node.js
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    const pubKeyDER = Buffer.concat([spkiPrefix, pubKeyBytes]);

    const pubKey = crypto.createPublicKey({
      key: pubKeyDER,
      format: 'der',
      type: 'spki',
    });

    const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const sigBuffer = typeof signature === 'string' ? Buffer.from(signature, 'base64') : signature;

    return crypto.verify(null, dataBuffer, pubKey, sigBuffer);
  } catch (err) {
    console.error(`Signature verification failed: ${err.message}`);
    return false;
  }
}

export default {
  deriveKey,
  createPrivateKeyFromSeed,
  derivePublicKey,
  signData,
  verifySignature,
};
