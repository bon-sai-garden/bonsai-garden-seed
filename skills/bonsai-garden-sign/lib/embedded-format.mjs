// ---
// id: 01M3BS43RQ6EGXWQ6BXZZZGCYK
// ---
/**
 * embedded-format.mjs — the EMBEDDED seal, ported from tools/sign.py.
 *
 * The gardener's ruling, 2026-09-15: *"signing is a core concept for
 * the garden. being able to sign md files is a necessity for core."* So core
 * learns the form it previously refused.
 *
 * BYTE-PARITY WITH sign.py IS THE REQUIREMENT, not a nice-to-have: a document
 * sealed by either tool must verify under the other. Every function here is a
 * port of a named Python function, and the parity harness checks them against
 * the real thing rather than against my reading of it.
 *
 * Three things a reimplementation gets wrong, all found by reading rather than
 * assuming:
 *
 *   1. The signature is over `bytes.fromhex(body_hash)` — the 64 RAW HASH BYTES
 *      — not over the body and not over the hex string. Sign the wrong one and
 *      the result verifies under neither tool.
 *   2. The canonical body is everything AFTER the closing `---`, including its
 *      leading newline, with CRLF normalised to LF. The frontmatter is excluded,
 *      which is why a seal survives a metadata edit (and why that choice is
 *      still open for review).
 *   3. The frontmatter boundary is sign.py's `_FM_RE`, which is NOT the same
 *      regex as tools/core/frontmatter.py's. They disagree on CRLF. See
 *      document-format.mjs.
 */

import { createHash } from 'node:crypto';
import { FRONT_RE_SOURCE } from './document-format.mjs';

export const ALGORITHM_MD = 'ed25519+blake2b512';

/** Port of sign.py `_parse_md` → [frontmatterOrNull, body]. */
export function parseMd(text) {
  const re = new RegExp(FRONT_RE_SOURCE);
  const m = re.exec(text);
  if (m && m.index === 0) return [m[1], text.slice(m[0].length)];
  return [null, text];
}

/**
 * Port of sign.py `_canonical_md_body`.
 *
 * Everything after the frontmatter, CRLF→LF, as UTF-8 bytes. This is the
 * payload the body-hash is taken over — the ONE definition D1 would
 * change, deliberately isolated here so that ruling is a one-function edit.
 */
export function canonicalMdBody(text) {
  const [, body] = parseMd(text);
  return Buffer.from(body.replace(/\r\n/g, '\n'), 'utf8');
}

/** Port of sign.py `blake2b512_hex`. */
export function blake2b512Hex(data) {
  return createHash('blake2b512').update(data).digest('hex');
}

/** Port of sign.py `_build_sign_block`. Field order is load-bearing for diffs. */
export function buildSignBlock({ signer, fingerprint, timestamp, bodyHash, signatureB64, ipv4 = null, ipv6 = null }) {
  let ip = '';
  if (ipv4) ip += `  ipv4: ${ipv4}\n`;
  if (ipv6) ip += `  ipv6: ${ipv6}\n`;
  return (
    `sign:\n` +
    `  signer: ${signer}\n` +
    `  fingerprint: ${fingerprint}\n` +
    `  timestamp: "${timestamp}"\n` +
    `  algorithm: ${ALGORITHM_MD}\n` +
    `  body-hash: ${bodyHash}\n` +
    ip +
    `  signature: ${signatureB64}\n`
  );
}

/** Port of sign.py `_strip_sign_from_fm` — drop an existing sign: block. */
export function stripSignFromFm(fm) {
  const out = [];
  let inSign = false;
  for (const line of fm.split('\n')) {
    if (/^sign:[ \t]*\r?$/.test(line)) {
      inSign = true;
      continue;
    }
    if (inSign) {
      if (/^[ \t]/.test(line) || line.trim() === '') continue; // still inside the block
      inSign = false;
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * Port of sign.py `_embed_sign_md`.
 *
 * The `---\n${body}` at the end is not a typo: `body` already begins with
 * whatever followed the closing delimiter, so writing the newline here is what
 * makes a re-parse recover the body byte for byte.
 */
export function embedSignMd(text, signBlock) {
  const [fm, body] = parseMd(text);
  if (fm === null) {
    // sign.py guards here with assert_safe_to_prepend: a document that OPENS
    // with a `---` the parser could not read would gain a SECOND frontmatter
    // block, and every field in the real one would go invisible. Refuse.
    if (text.startsWith('---')) {
      const err = new Error(
        `refusing to sign: the document opens with '---' but no frontmatter block ` +
          `could be parsed. Prepending one would create a second block and hide the ` +
          `first. Fix the frontmatter, then sign.`,
      );
      err.code = 'AMBIGUOUS_FRONTMATTER';
      throw err;
    }
    return `---\n${signBlock.replace(/\n+$/, '')}\n---\n${body}`;
  }
  const clean = stripSignFromFm(fm).replace(/\n+$/, '');
  const newFm = `${clean}\n${signBlock}`.replace(/^\n+/, '').replace(/\n+$/, '');
  return `---\n${newFm}\n---\n${body}`;
}

/** The bytes an ed25519 signature is taken over: the raw hash, not the hex. */
export function signablePayload(bodyHashHex) {
  return Buffer.from(bodyHashHex, 'hex');
}

/**
 * Port of sign.py `_extract_sign_md` — read the `sign:` block back out of a
 * document's frontmatter. Returns a plain object keyed exactly as the block is
 * (`body-hash`, not `bodyHash`), or null when there is no block.
 *
 * Hand-parsed, as the Python is, rather than via a YAML library: the block is a
 * fixed shape this tool writes itself, and a YAML dependency in the verifier
 * would be a second definition of what the seal covers.
 *
 * Note `.strip().strip('"')` in the Python — it strips a quote from EITHER end
 * independently, so a value quoted on one side only still loses that quote. The
 * only quoted field is `timestamp`, which this tool always writes quoted on both
 * sides; the one-sided case is malformed input either way. Ported literally
 * because a verifier that disagrees with the signer about what a value IS will
 * eventually disagree about whether a seal is good.
 */
export function extractSignMd(text) {
  const [fm] = parseMd(text);
  if (fm === null) return null;

  const fields = {};
  let inSign = false;
  for (const line of fm.split(/\r?\n/)) {
    if (/^sign\s*:/.test(line)) {
      inSign = true;
      continue;
    }
    if (!inSign) continue;
    if (/^\s/.test(line)) {
      const m = /^\s+(\S+?):\s*(.*)/.exec(line);
      if (m) fields[m[1]] = m[2].trim().replace(/^"/, '').replace(/"$/, '');
    } else {
      break;
    }
  }
  return Object.keys(fields).length ? fields : null;
}
