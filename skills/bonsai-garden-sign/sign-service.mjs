/**
 * ---
 * id: 01M2D299J3PS8MHHPRMFE6VJZN
 * title: Keyring Sign Service
 * type: script
 * tended-by: mori-shin
 * created: 2026-09-13
 * updated: 2026-09-26
 * ---
 * `type: script` is a placeholder — pending Baisai's patterns.md proposal
 * (2026-09-13 review); see lib/derive-key.mjs's header for the full note.
 *
 * Sign service — the one accountable signing channel this repo owns.
 *
 * This is the "core script" the library builds toward: everything above it
 * (lib/derive-key.mjs, lib/key-provider.mjs, lib/custody-provider.mjs, and
 * the per-platform custody/ backends) exists so that this one module can
 * expose two plain async functions — `signPayload` and `verifyPayload` —
 * that neither hold nor cache a key, never accept a raw master salt from a
 * caller, and fail loudly rather than degrade silently.
 *
 * This is deliberately NOT yet an MCP tool. Per the Aruji's sequencing
 * (2026-09-13): this module is the mechanism, built and reviewable on its
 * own; a runtime-repo MCP surface wrapping it, and its integration into the
 * existing bonsai-garden MCP (the `bonsai_sign` / `bonsai_mint_delegation` /
 * `bonsai_attest_task` shape sketched in
 * bonsai-garden's rituals/specs/spec-chain-of-trustable-interactions.md §E),
 * are later steps — Baisai's and Fuji-shin's to review once this mechanism
 * itself is settled. Designed so that step can simply `import` this file
 * rather than re-derive its logic.
 *
 * What this module does NOT do: it does not decide who is allowed to ask
 * for a signature, rate-limit requests, or authenticate a caller. Those are
 * exactly the "boundary" concerns §E names as the service's job once it has
 * real callers other than this repo's own CLI — out of scope for a single-
 * process, single-resident-agent core repo today, and named here so the
 * gap is visible rather than quietly assumed away.
 */

import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getCustodyProvider } from './lib/custody-provider.mjs';
import { mintKeyProvider } from './lib/key-provider.mjs';
import { verifySignature } from './lib/derive-key.mjs';

/**
 * Sign a payload as one agent, deriving that agent's key fresh from the
 * platform's custody provider and never holding it beyond this call.
 *
 * @param {object} opts
 * @param {string} opts.agentSalt - the agent's signing salt, e.g. "bonsai-sign#587893"
 * @param {Buffer|string|function} opts.data - the bytes (or string) to sign, or a function
 *   (publicKeyHex) => bytes, for a payload that names the key it is signed under
 * @returns {Promise<{signature: string, publicKeyHex: string, fingerprint: string, custodyTier: string|null, platform: string}>}
 *   signature and publicKeyHex/fingerprint are hex/base64 strings, ready to
 *   write into a sign block or a `.bonsaisig` sidecar.
 */
/**
 * Phase 1b of the signing gate (its spec is in the runtime, tools/runtime/signing-gate/spec-signing-gate.md):
 * BY DEFAULT (flipped 2026-09-26) this process never reads the master salt. It asks the gate the Aruji
 * trusted for the key's fingerprint, then hands it the exact seal v2 payload and gets back only the
 * signature. No fallback: a missing gate, or a gate that refuses, signs nothing and says why. The one
 * way round it is explicit and logged: BONSAI_SIGN_VIA_GATE=0 (exactly "0"), for test fixtures. The
 * twin of sign.py's _GateSigner and via_gate().
 */
export const GATE_BIN_DEFAULT = path.join(os.homedir(), '.bonsai-garden', 'bin', 'bonsai-gate');

/** Through the gate unless BONSAI_SIGN_VIA_GATE is exactly "0"; any other value keeps the safe default. */
export function viaGate(env = process.env) {
  return env.BONSAI_SIGN_VIA_GATE !== '0';
}

let optOutLogged = false;

/** The gate the Aruji trusted, at its fixed path. BONSAI_GATE_BIN counts ONLY beside a test salt. */
export function gateBin(env = process.env) {
  return env.BONSAI_GATE_BIN && env.BONSAI_GATE_TEST_MASTER_SALT ? env.BONSAI_GATE_BIN : GATE_BIN_DEFAULT;
}

function askGate(args, stdin = Buffer.alloc(0), env = process.env) {
  const bin = gateBin(env);
  try {
    fs.accessSync(bin, fs.constants.X_OK);
  } catch {
    throw new Error(
      `the signing gate is not installed at ${bin}: nothing signed (no fallback to reading the salt). ` +
        `Build and install it with the runtime's signing-gate build-gate.py (spec-signing-gate.md, "The gardener's steps", step 1)`,
    );
  }
  let input = stdin;
  const argv = [...args];
  if (env.BONSAI_GATE_TEST_MASTER_SALT) {
    // tests only: a THROWAWAY salt, first line
    argv.push('--master-salt-stdin');
    input = Buffer.concat([Buffer.from(`${env.BONSAI_GATE_TEST_MASTER_SALT.trim()}\n`, 'ascii'), stdin]);
  }
  const r = spawnSync(bin, argv, { input, env });
  if (r.status !== 0) {
    throw new Error(`the signing gate refused: ${(r.stderr || '').toString().trim() || `exit ${r.status}`}`);
  }
  return r.stdout.toString('ascii').trim();
}

async function signViaGate({ agentSalt, data }) {
  const fingerprint32 = askGate(['fingerprint', '--signing-salt', agentSalt]);
  if (!/^[0-9a-f]{32}$/.test(fingerprint32))
    throw new Error(`the signing gate returned no fingerprint for ${agentSalt}`);
  // The gate holds no public key to hand out and needs none: a v2 payload names the fingerprint.
  const resolved = typeof data === 'function' ? data(null, fingerprint32) : data;
  const payload = typeof resolved === 'string' ? Buffer.from(resolved, 'utf8') : resolved;
  const signature = askGate(['sign', '--signing-salt', agentSalt], payload);
  if (!/^[A-Za-z0-9+/]{86}==$/.test(signature)) throw new Error('the signing gate returned no signature');
  return {
    signature,
    publicKeyHex: null,
    fingerprint: fingerprint32.slice(0, 8),
    fingerprint32,
    custodyTier: 'signing-gate',
    platform: process.platform,
  };
}

export async function signPayload({ agentSalt, data }) {
  if (!agentSalt) {
    throw new Error('signPayload requires agentSalt');
  }
  if (data === undefined || data === null) {
    throw new Error('signPayload requires data to sign');
  }
  if (viaGate()) return signViaGate({ agentSalt, data });
  if (!optOutLogged) {
    // a direct read of the master salt is never quiet
    optOutLogged = true;
    console.error(
      'sign-service: BONSAI_SIGN_VIA_GATE=0 — signing WITHOUT the gate, master salt read directly from custody (test fixtures only)',
    );
  }

  const custody = await getCustodyProvider();
  const masterSaltHex = await custody.getMasterSaltHex();

  // Known limitation, inherited from the original bonsai-garden design, not
  // introduced here: masterSaltHex is a JS string. Strings are immutable in
  // JS and cannot be zeroed the way a Buffer can — `key-provider.mjs` zeroes
  // the *derived seed* Buffer in its own `finally` block, but this raw
  // string lives until the garbage collector reclaims it. Worth a real fix
  // (e.g. never materializing it as a string at all) before this service
  // has callers beyond this repo's own CLI — named, not solved, here.
  const provider = mintKeyProvider(masterSaltHex, agentSalt);

  // `data` may be a function of the public key (hex): a seal v2 payload names the
  // fingerprint it is signed under, so it can only be built once the key is known —
  // and deriving the key twice would read the master salt twice.
  const resolved = typeof data === 'function' ? data(provider.publicKeyHex()) : data;
  const dataBuffer = typeof resolved === 'string' ? Buffer.from(resolved, 'utf8') : resolved;
  const signature = provider.sign(dataBuffer);

  return {
    signature: signature.toString('base64'),
    publicKeyHex: provider.publicKeyHex(),
    fingerprint: provider.fingerprint(),
    custodyTier: custody.assuranceTier,
    platform: custody.platform,
  };
}

/**
 * Verify a signature against a known public key. Does not touch the
 * custody provider at all — verification never needs the master salt.
 *
 * @param {object} opts
 * @param {string} opts.publicKeyHex
 * @param {Buffer|string} opts.data
 * @param {string} opts.signature - base64
 * @returns {boolean}
 */
export function verifyPayload({ publicKeyHex, data, signature }) {
  return verifySignature(publicKeyHex, data, signature);
}

/**
 * Report what this machine can actually do right now, without touching any
 * key material — safe to call to check custody status before attempting a
 * real sign.
 *
 * @returns {Promise<{platform: string, assuranceTier: string|null, description: string, ready: boolean, error: string|null}>}
 */
export async function getCustodyStatus() {
  let custody;
  try {
    custody = await getCustodyProvider();
  } catch (err) {
    return {
      platform: process.platform,
      assuranceTier: null,
      description: null,
      ready: false,
      error: err.message,
    };
  }

  // A stub backend (Windows, Linux today) resolves fine but has no real
  // assuranceTier — that's the signal this status check surfaces without
  // needing to actually attempt (and fail) a salt read.
  if (!custody.assuranceTier) {
    return {
      platform: custody.platform,
      assuranceTier: null,
      description: custody.description,
      ready: false,
      error: 'Custody backend for this platform is a stub — not yet built.',
    };
  }

  return {
    platform: custody.platform,
    assuranceTier: custody.assuranceTier,
    description: custody.description,
    ready: true,
    error: null,
  };
}

/**
 * Compute the same body-hash algorithm the rest of the workshop's sign
 * blocks use (`ed25519+blake2b512`), so an envelope this service produces
 * slots into the existing convention without inventing a second one.
 *
 * @param {Buffer|string} data
 * @returns {string} hex-encoded blake2b512 digest
 */
export function bodyHash(data) {
  const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return crypto.createHash('blake2b512').update(dataBuffer).digest('hex');
}

export default { signPayload, verifyPayload, getCustodyStatus, bodyHash };
