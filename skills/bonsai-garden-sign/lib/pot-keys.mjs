// ---
// id: 01M4NQCZTVQASDM7GRSNABN27V
// title: pot-keys — a pot's own registry and keys, as a verifier's key source: explicit, never inferred, never read as ok
// type: script
// tended-by: mori-shin
// created: 2026-10-11
// updated: 2026-10-11
// ---
/**
 * pot-keys.mjs — `verify-sidecar <file> --keys pot --pot <dir> [--expect-fp <fp32>]`, the Node half (Mori-shin's ruling of 2026-10-11;
 * the Python half is tools/sign.py `_load_pot_key`, mono 5e1b712a6). A pot's registry vouching for the pot's own files is internal
 * consistency, not identity, so:
 *
 *   * the pot is NAMED (`--pot`), never inferred from where the file sits: a forged file planted beside its own registry and key
 *     verifies nothing unless a caller points at that pot on purpose;
 *   * the registry's fingerprint must be the key file's SHA-256[:32] (else `key-mismatch`);
 *   * the pot is trusted only if its garden.json says `"lab-preview": true` (a declared rehearsal) or the caller pins the signer
 *     (`--expect-fp`; a wrong pin is `pin-mismatch`); a pot that is neither is `pot-untrusted`;
 *   * the registry's `path` is not believed past the pot: a key file that resolves outside it is no key.
 *
 * The verdict word for a good seal is `pot-ok`, never `ok` (the CLI prints it): our scripts match ^ok.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

/** The pot's trust: { dir, lab, pin } or a thrown { code: 'NOT_A_POT' | 'POT_UNTRUSTED' }. */
export function potTrust(potDir, pin = null) {
  let dir;
  try {
    dir = fs.realpathSync(potDir);
  } catch {
    dir = path.resolve(potDir);
  }
  if (!fs.existsSync(path.join(dir, 'agents', 'registry.json'))) {
    const e = new Error(`${dir} is not a pot: no agents/registry.json`);
    e.code = 'NOT_A_POT';
    throw e;
  }
  let lab = false;
  try {
    lab = JSON.parse(fs.readFileSync(path.join(dir, 'garden.json'), 'utf8'))['lab-preview'] === true;
  } catch {
    /* not declared */
  }
  if (!lab && !pin) {
    const e = new Error(
      "a pot's registry vouching for the pot's own files is internal consistency, not identity: this pot is neither a declared rehearsal nor " +
        'pinned. Two ways out: declare it ("lab-preview": true in the pot\'s garden.json), or pin the signer you expect (--expect-fp <fp32>).',
    );
    e.code = 'POT_UNTRUSTED';
    throw e;
  }
  return { dir, lab, pin: pin || null };
}

function fail(status, why) {
  const e = new Error(why);
  e.potStatus = status;
  return e;
}

/** The signer's public key from the pot. Throws NO_PUBLIC_KEY (→ unknown-signer) or an error carrying .potStatus (key-mismatch | pin-mismatch). */
export function loadPotKey(pot, slug) {
  const noKey = (why) => {
    const e = new Error(why);
    e.code = 'NO_PUBLIC_KEY';
    return e;
  };
  let reg;
  try {
    reg = JSON.parse(fs.readFileSync(path.join(pot.dir, 'agents', 'registry.json'), 'utf8'));
  } catch (err) {
    throw noKey(`the pot has no readable agents/registry.json (${err.message})`);
  }
  const entry = (reg && Array.isArray(reg.agents) ? reg.agents : []).find(
    (a) => a && typeof a === 'object' && a.slug === slug,
  );
  if (!entry) throw noKey(`${JSON.stringify(slug)} is not in the pot's registry`);
  const rel = String(entry.path || `agents/${slug}`)
    .trim()
    .replace(/^\/+|\/+$/g, '');
  const keyFile = path.resolve(pot.dir, rel, 'identity', `${slug}-public-key.bin`);
  let real;
  try {
    real = fs.realpathSync(keyFile);
  } catch {
    throw noKey(`no identity key for ${JSON.stringify(slug)} inside the pot at ${keyFile}`);
  }
  const inside = path.relative(pot.dir, real);
  if (inside.startsWith('..') || path.isAbsolute(inside) || !fs.statSync(real).isFile()) {
    throw noKey(`no identity key for ${JSON.stringify(slug)} inside the pot at ${keyFile}`);
  }
  const raw = fs.readFileSync(real);
  if (raw.length !== 32) throw fail('key-mismatch', `the key at ${real} is ${raw.length} bytes; expected 32`);
  const fingerprint = createHash('sha256').update(raw).digest('hex').slice(0, 32);
  if (entry.fingerprint !== fingerprint) {
    throw fail(
      'key-mismatch',
      `the pot's registry says ${JSON.stringify(entry.fingerprint)} for ${JSON.stringify(slug)}; the key file hashes to ${fingerprint}`,
    );
  }
  if (pot.pin && fingerprint !== pot.pin)
    throw fail('pin-mismatch', `the signer's key hashes to ${fingerprint}; the caller pinned ${pot.pin}`);
  return { publicKeyHex: raw.toString('hex'), fingerprint, keyPath: real };
}
