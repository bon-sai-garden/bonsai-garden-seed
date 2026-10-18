// ---
// id: 01M498HCS0PN8EFYCDR5MFKDEB
// title: The salt envelope, one format for the recovery export and the fallback custody file
// type: script
// tended-by: baisai
// created: 2026-10-06
// updated: 2026-10-06
// ---
//
// envelope.mjs — spec-gardeners-keys.md §9 and §3.3: 32 bytes wrapped under a passphrase,
// scrypt (N=2^17, r=8, p=1) → AES-256-GCM. One format, one reader, two uses.
//
//   { "v": 1, "garden": "<ulid>", "kdf": { "name": "scrypt", "N": 131072, "r": 8, "p": 1, "salt": b64 },
//     "nonce": b64, "ct": b64, "tag": b64 }
//
// The garden's ULID is bound into the GCM additional data: an envelope relabelled for another
// garden does not open. The recovery export adds `root-fingerprint` and a `signature` by the root
// key over the rest (lib/garden.mjs), because v2's seal-root rule refuses to seal a file outside a
// repository, and the export's whole point is to live off the machine.

import crypto from 'node:crypto';

export const KDF = Object.freeze({ name: 'scrypt', N: 2 ** 17, r: 8, p: 1 });
export const MIN_PASSPHRASE = 12;
const AAD = (garden) => Buffer.from(`bonsai-garden-salt-envelope/1\n${garden}`, 'utf8');

function key(passphrase, salt, kdf) {
  if (kdf.name !== 'scrypt') throw new Error(`unknown kdf ${kdf.name}`);
  return crypto.scryptSync(Buffer.from(passphrase, 'utf8'), salt, 32, {
    N: kdf.N,
    r: kdf.r,
    p: kdf.p,
    maxmem: 256 * kdf.N * kdf.r + 1024 * 1024,
  });
}

export function sealEnvelope(raw, passphrase, garden) {
  if (!Buffer.isBuffer(raw) || raw.length !== 32) throw new Error('an envelope holds exactly 32 bytes');
  if (typeof passphrase !== 'string' || [...passphrase].length < MIN_PASSPHRASE) {
    throw Object.assign(new Error(`a passphrase is at least ${MIN_PASSPHRASE} characters`), {
      code: 'SHORT_PASSPHRASE',
    });
  }
  const salt = crypto.randomBytes(16);
  const nonce = crypto.randomBytes(12);
  const k = key(passphrase, salt, KDF);
  try {
    const c = crypto.createCipheriv('aes-256-gcm', k, nonce);
    c.setAAD(AAD(garden));
    const ct = Buffer.concat([c.update(raw), c.final()]);
    return {
      v: 1,
      garden,
      kdf: { ...KDF, salt: salt.toString('base64') },
      nonce: nonce.toString('base64'),
      ct: ct.toString('base64'),
      tag: c.getAuthTag().toString('base64'),
    };
  } finally {
    k.fill(0);
  }
}

/** → the 32 bytes (the caller zeroes them), or throws BAD_PASSPHRASE: wrong passphrase, or tampered. */
export function openEnvelope(env, passphrase, garden = env.garden) {
  if (env?.v !== 1 || !env.kdf) throw Object.assign(new Error('not a salt envelope (v1)'), { code: 'BAD_ENVELOPE' });
  const k = key(passphrase, Buffer.from(env.kdf.salt, 'base64'), env.kdf);
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(env.nonce, 'base64'));
    d.setAAD(AAD(garden));
    d.setAuthTag(Buffer.from(env.tag, 'base64'));
    const raw = Buffer.concat([d.update(Buffer.from(env.ct, 'base64')), d.final()]);
    if (raw.length !== 32) {
      raw.fill(0);
      throw new Error('length');
    }
    return raw;
  } catch {
    throw Object.assign(new Error('the passphrase does not open this envelope (or it was altered)'), {
      code: 'BAD_PASSPHRASE',
    });
  } finally {
    k.fill(0);
  }
}

/** The fields the root key signs on an export: everything but the signature, canonical order. */
function canon(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return (
      '{' +
      Object.keys(v)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(v);
}
export function envelopePayload(env) {
  const rest = {};
  for (const k of Object.keys(env)) if (k !== 'signature') rest[k] = env[k];
  return Buffer.from(`bonsai-garden-recovery-export/1\n${canon(rest)}`, 'utf8');
}
