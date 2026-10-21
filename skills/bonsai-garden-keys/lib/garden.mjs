// ---
// id: 01M498HCXGF1NCW24D9A2D94HS
// title: A garden's pot files, its root key, and seals made with this garden's own keys
// type: script
// tended-by: baisai
// created: 2026-10-06
// updated: 2026-10-20
// ---
//
// garden.mjs — the pot side of spec-gardeners-keys.md §5, §7, §8: garden.json, pot.json,
// locked-salts.json and agents/registry.json in a pot; the root key (§5.2); and v2 seals written
// with a key derived from THIS garden's master salt, in process. Nothing here goes through the
// origin garden's signing gate, which reads the origin's salt and no other.
//
// Every seal is bonsaisig/2 through core's own writer (bonsai-garden-sign/lib/seal-v2.mjs). When
// the envelope carries the optional `custody` field (spec §10), the tier is passed and signed.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { derivePublicKey, signData } from '../../bonsai-garden-sign/lib/derive-key.mjs';
import * as seal from '../../bonsai-garden-sign/lib/seal-v2.mjs';
import { writeSealSidecar } from '../../bonsai-garden-sign/lib/sidecar-format.mjs';

export const rootSalt = (garden) => `garden-root@${garden}`;
/** A garden's companions: garden.json `shins` when it names more than one, else its one `shin` (2026-10-15). */
export const companionsOf = (g) => (Array.isArray(g.shins) && g.shins.length ? g.shins : [g.shin]).filter(Boolean);
export const today = () => new Date().toISOString().slice(0, 10);
/** Whoever's pronouns are not yet known: a kin is never "it" (the gardener, 2026-10-20, F-26 of dry run #4). */
export const UNKNOWN_PRONOUNS = 'they/them';

/** { raw, hex, b64, fingerprint } of the key `agentSalt` derives from `masterHex`. */
export function keyOf(masterHex, agentSalt) {
  const { publicKeyHex } = derivePublicKey(masterHex, agentSalt);
  const raw = Buffer.from(publicKeyHex, 'hex');
  return {
    raw,
    hex: publicKeyHex,
    b64: raw.toString('base64'),
    fingerprint: crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32),
  };
}

/** Seal `file` (inside the pot) as `signer`, with the key `agentSalt` derives from `masterHex`. */
export function sealWith(masterHex, agentSalt, signer, file, { custody = null, role = 'owner' } = {}) {
  const { fingerprint } = keyOf(masterHex, agentSalt);
  const fields = { signer, role, fingerprint, timestamp: seal.nowUtc() };
  // the optional signed tier, where this core's envelope knows it (spec §10; Mori-shin's half)
  if (custody && seal.V2_OPTIONAL?.includes('custody')) fields.custody = custody;
  const obj = seal.prepareV2(file, fields);
  const signature = signData(masterHex, agentSalt, seal.v2Payload(obj)).toString('base64');
  return writeSealSidecar(file, { ...obj, signature });
}

// ── pot files ────────────────────────────────────────────────────────────────

export const P = {
  garden: (pot) => path.join(pot, 'garden.json'),
  pot: (pot) => path.join(pot, 'pot.json'),
  locks: (pot) => path.join(pot, 'locked-salts.json'),
  registry: (pot) => path.join(pot, 'agents', 'registry.json'),
  idDir: (pot, slug) => path.join(pot, 'agents', slug, 'identity'),
  attestation: (pot) => path.join(pot, 'garden-attestation.yaml'),
  countersign: (pot) => path.join(pot, 'garden-attestation.countersign.json'),
};

export const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
export const jsonText = (o) => `${JSON.stringify(o, null, 2)}\n`;
export function writeJson(p, o) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, jsonText(o));
  fs.renameSync(tmp, p);
}

export function readLocks(pot) {
  return (
    readJson(P.locks(pot)) || {
      schema_version: 2,
      schema_label: "a garden pot's locks (spec-gardeners-keys §6, §7)",
      set_file: 'kanji-1024-v1.2.json',
      agents: {},
    }
  );
}

/** The public key on file for `slug` in this pot, or null. */
export function keyOnFile(pot, slug) {
  const d = P.idDir(pot, slug);
  const f = path.join(d, `${slug}-public-key.bin`);
  if (!fs.existsSync(f)) return null;
  const raw = fs.readFileSync(f);
  return { raw, fingerprint: crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32) };
}

export function writeKey(pot, slug, raw, fingerprint) {
  const d = P.idDir(pot, slug);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, `${slug}-public-key.bin`), raw);
  fs.writeFileSync(path.join(d, `${slug}-fingerprint.txt`), `${fingerprint}\n`);
}

/** fp → its first n kanji indices, as engine.js slices a digest. */
export function fpIndices(fpHex, n) {
  const b = Buffer.from(fpHex, 'hex');
  const out = [];
  for (let k = 0; k < n; k++) {
    let v = 0;
    for (let i = 0; i < 10; i++) {
      const bit = 10 * k + i;
      v = (v << 1) | ((b[bit >> 3] >> (7 - (bit & 7))) & 1);
    }
    out.push(v);
  }
  return out;
}

/**
 * Is the directory `start` the directory `dir`, or below it? Decided by identity, not by spelling:
 * `start` is resolved to its real path, and each directory from there up to the root is compared to
 * `dir` by device and inode. A path string can be spelled round (`..x`, a symlink, `POT` for `pot` on
 * a case-folding volume, an NFD spelling of an NFC name: Fuji-shin, 2026-10-06, two rounds); an inode
 * cannot, and the test is as right on a case-sensitive volume as on APFS.
 */
export function withinByInode(dir, start) {
  const d = fs.statSync(dir);
  let p = fs.realpathSync(start);
  for (;;) {
    const s = fs.statSync(p);
    if (s.dev === d.dev && s.ino === d.ino) return true;
    const up = path.dirname(p);
    if (up === p) return false;
    p = up;
  }
}

/**
 * Spec §10, "public material only": three checks, each its own, each named by what it caught.
 *   fields    a value shaped like a master salt (64 hex) in garden.json or the registry
 *   document  the same shape in the document as written
 *   salt      the master salt itself, or its first eight characters, in the document
 */
export function publicMaterialProblems({ g, reg, doc = null, hex = null }) {
  const out = [];
  const fields = [...secretShapedFields(g, 'garden.json'), ...secretShapedFields(reg, 'registry')];
  if (fields.length)
    out.push({
      check: 'fields',
      why: `not public material: ${fields.join(', ')} holds a value shaped like a master salt (64 hex)`,
    });
  if (doc !== null && SECRET_SHAPE.test(doc))
    out.push({ check: 'document', why: 'the attestation would carry a value shaped like a master salt' });
  if (doc !== null && hex && (doc.toLowerCase().includes(hex) || doc.toLowerCase().includes(hex.slice(0, 8)))) {
    out.push({ check: 'salt', why: 'the attestation would carry the master salt, or a fragment of it' });
  }
  return out;
}

/** A value with the shape of a master salt: 64 hex, anywhere in a string. */
export const SECRET_SHAPE = /[0-9a-fA-F]{64}/;
export function secretShapedFields(obj, where = '') {
  const hits = [];
  const walk = (v, p) => {
    if (typeof v === 'string') {
      if (SECRET_SHAPE.test(v)) hits.push(p || '(value)');
      return;
    }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k);
  };
  walk(obj, where);
  return hits;
}
