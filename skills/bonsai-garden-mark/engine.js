// ---
// id: 01M3BS43JGGWC36P0CSSG7G51Q
// ---
// engine.js — pure functions for the kanji identicon system.
//
// The whole engine is:
//   1. SHA-256 of the input bytes
//   2. Take 30 bits → split into three 10-bit indices (A, B, C)
//   3. Look up kanji from the curated 1,024-character set
//
// Display layer chooses whether to render two or three kanji.
// Bits 20-29 are computed but ignored in v1 — they are reserved for the
// future 3-kanji mode and DO NOT affect kanji A and B.
//
// No dependencies. Browser SubtleCrypto for SHA-256.

const SET_SIZE = 1024;
const BITS_PER_KANJI = 10; // log2(1024)
const PAIR_BITS = 20; // 2 kanji
const TRIPLE_BITS = 30; // 3 kanji (forward-compatible)

// ─────────────────────────────────────────────────────────────────────────────
// Input normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize an input into a Uint8Array of bytes.
 *   - Hex strings (with or without 0x): parsed as bytes.
 *   - Anything else: encoded as UTF-8.
 * The "looks like hex" rule: even number of hex chars, optional 0x prefix,
 * length >= 2.
 */
export function inputToBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (typeof input !== 'string') {
    throw new TypeError('input must be a string or Uint8Array');
  }
  const trimmed = input.trim();
  const hexStripped = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? trimmed.slice(2) : trimmed;
  const looksLikeHex = hexStripped.length >= 2 && hexStripped.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(hexStripped);
  if (looksLikeHex) {
    const out = new Uint8Array(hexStripped.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(hexStripped.substr(i * 2, 2), 16);
    }
    return out;
  }
  return new TextEncoder().encode(input);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hash
// ─────────────────────────────────────────────────────────────────────────────

/** SHA-256 of bytes → Uint8Array (32 bytes). */
export async function sha256(bytes) {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(buf);
}

/** Hex helper. */
export function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Bit slicing — the moral commitment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Read N bits from a byte array, starting at bit offset `start` (MSB-first
 * within each byte). The first byte's most-significant bit is bit 0.
 *
 * Returns the integer value of those bits.
 */
function readBits(bytes, start, n) {
  let value = 0;
  for (let i = 0; i < n; i++) {
    const bit = start + i;
    const byte = bytes[bit >> 3];
    const offset = 7 - (bit & 7);
    value = (value << 1) | ((byte >> offset) & 1);
  }
  return value;
}

/**
 * Derive (A, B, C) indices from a 32-byte SHA-256 digest.
 *   A = bits 0..9
 *   B = bits 10..19
 *   C = bits 20..29
 *
 * Slicing is the v1 commitment. Changing it would break every existing
 * identicon. Do not change it.
 */
export function slice(digest) {
  if (digest.length < 4) {
    throw new RangeError('digest must be at least 4 bytes (32 bits required)');
  }
  const a = readBits(digest, 0, BITS_PER_KANJI);
  const b = readBits(digest, BITS_PER_KANJI, BITS_PER_KANJI);
  const c = readBits(digest, 2 * BITS_PER_KANJI, BITS_PER_KANJI);
  return [a, b, c];
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level identicon function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the kanji identicon for an input.
 *
 * @param {string|Uint8Array} input
 * @param {object[]} kanjiSet  — the 1,024-character curated set
 *                              (objects with at least `.char`)
 * @returns {Promise<{indices: number[], kanji: object[], hashHex: string}>}
 *
 * In v1 only kanji[0] and kanji[1] are displayed. kanji[2] is the
 * forward-compatible third character.
 */
export async function identicon(input, kanjiSet) {
  if (!Array.isArray(kanjiSet) || kanjiSet.length !== SET_SIZE) {
    throw new RangeError(`kanjiSet must have exactly ${SET_SIZE} entries`);
  }
  const bytes = inputToBytes(input);
  const digest = await sha256(bytes);
  const [a, b, c] = slice(digest);
  return {
    indices: [a, b, c],
    kanji: [kanjiSet[a], kanjiSet[b], kanjiSet[c]],
    hashHex: toHex(digest),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vanity search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search for a salt/nonce string that, appended to a base input, hashes to
 * a desired (A, B) — or optionally (A, B, C) — pair.
 *
 * Strategy: try sequential decimal nonces appended after a separator.
 * Mean attempts: ~1M for a 20-bit target (A+B), ~1B for a 30-bit target.
 *
 * @param {object} opts
 * @param {string} opts.base          — base string to prefix
 * @param {string} [opts.separator]   — separator between base and nonce (default "#")
 * @param {number} opts.targetA       — desired kanji A index (0..1023)
 * @param {number} opts.targetB       — desired kanji B index (0..1023)
 * @param {number} [opts.targetC]     — optional kanji C index
 * @param {number} [opts.maxAttempts] — give up after this many attempts (default 10_000_000)
 * @param {function} [opts.onProgress] — called every 50k attempts with {attempts}
 * @returns {Promise<{salt: string, attempts: number, hashHex: string} | null>}
 */
export async function vanitySearch({
  base = '',
  separator = '#',
  targetA,
  targetB,
  targetC = null,
  maxAttempts = 10_000_000,
  onProgress = null,
} = {}) {
  if (
    !Number.isInteger(targetA) ||
    targetA < 0 ||
    targetA >= SET_SIZE ||
    !Number.isInteger(targetB) ||
    targetB < 0 ||
    targetB >= SET_SIZE
  ) {
    throw new RangeError('targetA and targetB must be integers in [0, 1024)');
  }
  if (targetC !== null && (targetC < 0 || targetC >= SET_SIZE)) {
    throw new RangeError('targetC must be in [0, 1024) or null');
  }

  const enc = new TextEncoder();
  const baseBytes = enc.encode(base + separator);

  for (let n = 0; n < maxAttempts; n++) {
    const nonce = n.toString();
    const nonceBytes = enc.encode(nonce);
    const combined = new Uint8Array(baseBytes.length + nonceBytes.length);
    combined.set(baseBytes, 0);
    combined.set(nonceBytes, baseBytes.length);

    const digest = await sha256(combined);
    const [a, b, c] = slice(digest);

    if (a === targetA && b === targetB && (targetC === null || c === targetC)) {
      return {
        salt: base + separator + nonce,
        attempts: n + 1,
        hashHex: toHex(digest),
        indices: [a, b, c],
      };
    }

    if (onProgress && (n + 1) % 50_000 === 0) {
      onProgress({ attempts: n + 1 });
      // Yield so the UI can update
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants (re-exported for clarity)
// ─────────────────────────────────────────────────────────────────────────────

export const constants = {
  SET_SIZE,
  BITS_PER_KANJI,
  PAIR_BITS,
  TRIPLE_BITS,
  PAIR_SPACE: SET_SIZE * SET_SIZE, // 2^20
  TRIPLE_SPACE: SET_SIZE ** 3, // 2^30
};
