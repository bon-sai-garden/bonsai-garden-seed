// ---
// id: 01M5FY6W9DW1H675M0GCZZW1QW
// title: The call home's envelope, bonsai-garden-attestation/1, and the one reader that judges it (spec-gardeners-keys §10)
// type: script
// tended-by: baisai
// created: 2026-10-21
// updated: 2026-10-21
// ---
//
// attestation.mjs — the envelope `attest` writes and `attest consent` completes, and the reader that judges it,
// whoever made it (spec-gardeners-keys.md 0.8.0 §10 and §13; Mori-shin's rulings of 2026-10-21 on names and on the
// shin). Offline: no key, no custody, no network. Every check returns problems, each named by its reason, and none
// throws for a refusal.
//
//   signedBytes(body)                  what each of the three signs: the domain, a newline, the canonical body
//   canonical(value)                   keys sorted, arrays in their order; strings, safe integers, booleans only
//   bodyProblems(body, { parent })     shape · names-in-body · fingerprint · fp-attests · shin-order · key-reuse ·
//                                      id-reuse · parent (Bonsai's fingerprint as the pot's registry holds it)
//   signatureProblems(env, { need })   signature-role (a `by` outside the three, one missing or twice) · signature
//                                      (not that role's fingerprint, or not good over the body under that role's key)
//   envelopeProblems(env, opts)        the envelope's own shape, then both of the above
//   shinOrder(entries)                 the writer's duty: `canonical` sorts keys, never an array's elements
//
// What the envelope delivers is said in the spec and not repeated here: no name in its bytes, and the names still
// testable, about 20 bits each, against the namespace and the IDs by anyone holding a list of them (§10).

import crypto from 'node:crypto';
import { RANK } from './custody.mjs';
import { fpIndices } from './garden.mjs';
import { chars } from '../../bonsai-garden-mark/namespace.mjs';
import { whyBad } from '../../bonsai-garden-sign/lib/ulid-rule.mjs';

export const FORMAT = 'bonsai-garden-attestation/1';
/** The domain the signed bytes begin with: the format's own name, so a signature here is good nowhere else. */
export const DOMAIN = FORMAT;
/** Who signs, each exactly once. A shin signs nothing (§10). */
export const ROLES = Object.freeze(['root', 'guardian', 'gardener']);
export const R = Object.freeze({
  SHAPE: 'shape',
  NAMES: 'names-in-body',
  FINGERPRINT: 'fingerprint',
  FP_ATTESTS: 'fp-attests',
  SHIN_ORDER: 'shin-order',
  KEY_REUSE: 'key-reuse',
  ID_REUSE: 'id-reuse',
  PARENT: 'parent',
  ROLE: 'signature-role',
  SIGNATURE: 'signature',
});

const ENVELOPE_KEYS = ['body', 'format', 'signatures'];
const BODY_KEYS = ['created', 'custody-tier', 'garden', 'gardener', 'guardian', 'lab-preview', 'rite', 'shin'];
const GARDEN_KEYS = ['id', 'namespace', 'root-fingerprint', 'root-public-key'];
const ENTITY_KEYS = ['fingerprint', 'fp-attests', 'id', 'public-key'];
const GUARDIAN_KEYS = [...ENTITY_KEYS, 'parent', 'picked'];
const SIGNATURE_KEYS = ['by', 'fingerprint', 'signature'];
const NAME_KEYS = new Set(['name', 'slug']);
const HEX32 = /^[0-9a-f]{32}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const NIWA = '庭';
const SPKI = Buffer.from('302a300506032b6570032100', 'hex');

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The one serialization the three sign: keys sorted, arrays in their order, nothing a parser could read two ways. */
export function canonical(v) {
  if (typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v)) throw new TypeError(`the envelope carries integers only, not ${v}`);
    return String(v);
  }
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (isObj(v))
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(',')}}`;
  throw new TypeError(`the envelope carries no ${v === null ? 'null' : typeof v}`);
}

export const signedBytes = (body) => Buffer.from(`${DOMAIN}\n${canonical(body)}`, 'utf8');

/** A base64 public key's fingerprint (the first 32 hex of its SHA-256), or null when it is not 32 bytes, canonically. */
export function fingerprintOf(b64) {
  if (typeof b64 !== 'string') return null;
  const raw = Buffer.from(b64, 'base64');
  if (raw.length !== 32 || raw.toString('base64') !== b64) return null;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

/** The shin entries as one body has them, whatever order garden.json lists the shin in (§10). */
export const shinOrder = (entries) =>
  [...entries].sort((a, b) => (a.fingerprint < b.fingerprint ? -1 : a.fingerprint > b.fingerprint ? 1 : 0));

function namesIn(v, where, out) {
  if (Array.isArray(v)) for (const [i, x] of v.entries()) namesIn(x, `${where}[${i}]`, out);
  else if (isObj(v))
    for (const [k, x] of Object.entries(v)) {
      if (NAME_KEYS.has(k)) out.push(`${where}.${k}`);
      namesIn(x, `${where}.${k}`, out);
    }
  return out;
}

/** The body's refusals (§10's table, and `parent`). `parent` is Bonsai's fingerprint as the pot's registry holds it. */
export function bodyProblems(body, { parent = null } = {}) {
  const out = [];
  const no = (reason, detail) => out.push({ reason, detail });
  if (!isObj(body)) {
    no(R.SHAPE, 'the body is not an object');
    return out;
  }
  for (const p of namesIn(body, 'body', []))
    no(R.NAMES, `${p}: the envelope names no one; its keys say the role and the public key says who`);
  const exactly = (o, want, where) => {
    for (const k of want) if (!(k in o)) no(R.SHAPE, `${where} lacks ${k}`);
    for (const k of Object.keys(o))
      if (!want.includes(k) && !NAME_KEYS.has(k))
        no(R.SHAPE, `${where} carries ${k}, which the envelope does not have`);
  };
  exactly(body, BODY_KEYS, 'the body');

  const keys = []; // [where, public-key, fingerprint]: one key in two places lets one signature stand for both
  const ids = []; // [where, id]
  const g = body.garden;
  if (!isObj(g)) no(R.SHAPE, 'garden is not an object');
  else {
    exactly(g, GARDEN_KEYS, 'garden');
    if (typeof g.id !== 'string' || whyBad(g.id)) no(R.SHAPE, 'garden.id is not a ULID');
    if (typeof g.namespace !== 'string' || [...g.namespace].length !== 3 || !g.namespace.endsWith(NIWA))
      no(R.SHAPE, `garden.namespace is not three kanji ending in ${NIWA}`);
    const fp = fingerprintOf(g['root-public-key']);
    if (!fp) no(R.SHAPE, 'garden.root-public-key is not 32 bytes of base64');
    if (typeof g['root-fingerprint'] !== 'string' || !HEX32.test(g['root-fingerprint']))
      no(R.SHAPE, 'garden.root-fingerprint is not 32 lowercase hex');
    else if (fp && fp !== g['root-fingerprint'])
      no(R.FINGERPRINT, `garden.root-fingerprint ${g['root-fingerprint']} is not its key's (${fp})`);
    keys.push(['garden.root', g['root-public-key'], g['root-fingerprint']]);
  }

  const entity = (e, want, where) => {
    if (!isObj(e)) {
      no(R.SHAPE, `${where} is not an object`);
      return;
    }
    exactly(e, want, where);
    const idOk = typeof e.id === 'string' && [...e.id].length === 4;
    if (!idOk) no(R.SHAPE, `${where}.id is not four kanji`);
    const fp = fingerprintOf(e['public-key']);
    if (!fp) no(R.SHAPE, `${where}.public-key is not 32 bytes of base64`);
    const fpOk = typeof e.fingerprint === 'string' && HEX32.test(e.fingerprint);
    if (!fpOk) no(R.SHAPE, `${where}.fingerprint is not 32 lowercase hex`);
    else if (fp && fp !== e.fingerprint)
      no(R.FINGERPRINT, `${where}.fingerprint ${e.fingerprint} is not its key's (${fp})`);
    const n = e['fp-attests'];
    if (n !== 1 && n !== 2) no(R.FP_ATTESTS, `${where}.fp-attests is ${JSON.stringify(n)}, not 1 or 2`);
    else if (idOk && fpOk) {
      const rendered = chars(fpIndices(e.fingerprint, n));
      const claimed = [...e.id].slice(0, n).join('');
      if (rendered !== claimed)
        no(
          R.FP_ATTESTS,
          `${where}: the fingerprint renders ${rendered}, not ${claimed}, the first ${n} of its id ${e.id}`,
        );
    }
    keys.push([where, e['public-key'], e.fingerprint]);
    ids.push([where, e.id]);
  };

  entity(body.guardian, GUARDIAN_KEYS, 'guardian');
  if (isObj(body.guardian)) {
    const p = body.guardian.parent;
    if (typeof p !== 'string' || !HEX32.test(p)) no(R.SHAPE, 'guardian.parent is not 32 lowercase hex');
    else if (!parent) no(R.PARENT, "the reader holds no fingerprint of Bonsai's to check guardian.parent against");
    else if (p !== parent)
      no(R.PARENT, `guardian.parent ${p} is not Bonsai's fingerprint as the registry holds it (${parent})`);
    else keys.push(['guardian.parent (Bonsai)', null, p]);
    if (body.guardian.picked !== 'gardener' && body.guardian.picked !== 'default')
      no(R.SHAPE, 'guardian.picked is neither gardener nor default');
  }
  entity(body.gardener, ENTITY_KEYS, 'gardener');
  if (!Array.isArray(body.shin)) no(R.SHAPE, 'shin is not an array (it is always one, [] for a garden with none)');
  else {
    for (const [i, e] of body.shin.entries()) entity(e, ENTITY_KEYS, `shin[${i}]`);
    const fps = body.shin.map((e) => (isObj(e) ? e.fingerprint : null));
    if (fps.every((f) => typeof f === 'string'))
      for (let i = 1; i < fps.length; i++)
        if (!(fps[i - 1] < fps[i]))
          no(R.SHIN_ORDER, `shin[${i - 1}] and shin[${i}] are not in ascending fingerprint order`);
  }

  if (!Object.hasOwn(RANK, body['custody-tier']))
    no(R.SHAPE, `custody-tier ${JSON.stringify(body['custody-tier'])} is no tier`);
  if (typeof body['lab-preview'] !== 'boolean') no(R.SHAPE, 'lab-preview is not true or false');
  if (body.rite !== 'bunshin') no(R.SHAPE, 'rite is not bunshin');
  if (typeof body.created !== 'string' || !DAY.test(body.created)) no(R.SHAPE, 'created is not YYYY-MM-DD');

  const twice = (pairs, reason, what) => {
    const seen = new Map();
    for (const [where, v] of pairs) {
      if (typeof v !== 'string') continue;
      if (seen.has(v)) no(reason, `${seen.get(v)} and ${where} carry one ${what}`);
      else seen.set(v, where);
    }
  };
  twice(
    keys.map(([w, k]) => [w, k]),
    R.KEY_REUSE,
    'public key',
  );
  twice(
    keys.map(([w, , f]) => [w, f]),
    R.KEY_REUSE,
    'fingerprint',
  );
  twice(ids, R.ID_REUSE, 'id');
  return out;
}

function keyHolds(b64, bytes, sig) {
  try {
    const raw = Buffer.from(b64, 'base64');
    const s = Buffer.from(sig, 'base64');
    if (raw.length !== 32 || s.length !== 64 || s.toString('base64') !== sig) return false;
    const key = crypto.createPublicKey({ key: Buffer.concat([SPKI, raw]), format: 'der', type: 'spki' });
    return crypto.verify(null, bytes, key, s);
  } catch {
    return false;
  }
}

/** Each signature checked alone, with its role's key in the body. `need`: the roles that must have signed. */
export function signatureProblems(env, { need = ROLES } = {}) {
  const out = [];
  const no = (reason, detail) => out.push({ reason, detail });
  const body = env?.body;
  const sigs = env?.signatures;
  if (!Array.isArray(sigs)) {
    no(R.SHAPE, 'signatures is not an array');
    return out;
  }
  let bytes = null;
  try {
    bytes = signedBytes(body);
  } catch (e) {
    no(R.SIGNATURE, `the body has no canonical form (${e.message}); no signature can hold over it`);
  }
  const of = {
    root: () => [body?.garden?.['root-public-key'], body?.garden?.['root-fingerprint']],
    guardian: () => [body?.guardian?.['public-key'], body?.guardian?.fingerprint],
    gardener: () => [body?.gardener?.['public-key'], body?.gardener?.fingerprint],
  };
  const seen = new Set();
  sigs.forEach((s, i) => {
    const where = `signatures[${i}]`;
    if (!isObj(s)) {
      no(R.SHAPE, `${where} is not an object`);
      return;
    }
    for (const k of SIGNATURE_KEYS) if (!(k in s)) no(R.SHAPE, `${where} lacks ${k}`);
    for (const k of Object.keys(s)) if (!SIGNATURE_KEYS.includes(k)) no(R.SHAPE, `${where} carries ${k}`);
    if (!ROLES.includes(s.by)) {
      no(
        R.ROLE,
        `${where} is by ${JSON.stringify(s.by)}: only the root, the guardian and the gardener sign; a shin signs nothing`,
      );
      return;
    }
    if (seen.has(s.by)) {
      no(R.ROLE, `the ${s.by} signs twice`);
      return;
    }
    seen.add(s.by);
    const [key, fp] = of[s.by]();
    if (s.fingerprint !== fp)
      no(R.SIGNATURE, `the ${s.by}'s signature names ${s.fingerprint}, not the ${s.by}'s fingerprint in the body`);
    else if (bytes && !keyHolds(key, bytes, s.signature))
      no(R.SIGNATURE, `the ${s.by}'s signature does not hold over this body under the ${s.by}'s key`);
  });
  for (const r of need) if (!seen.has(r)) no(R.ROLE, `no signature by the ${r}`);
  return out;
}

/** The whole envelope: its own shape, the body's table, and each signature. */
export function envelopeProblems(env, { parent = null, need = ROLES } = {}) {
  if (!isObj(env)) return [{ reason: R.SHAPE, detail: 'the envelope is not an object' }];
  const out = [];
  for (const k of ENVELOPE_KEYS) if (!(k in env)) out.push({ reason: R.SHAPE, detail: `the envelope lacks ${k}` });
  for (const k of Object.keys(env))
    if (!ENVELOPE_KEYS.includes(k)) out.push({ reason: R.SHAPE, detail: `the envelope carries ${k}` });
  if (env.format !== FORMAT) out.push({ reason: R.SHAPE, detail: `the envelope is not ${FORMAT}` });
  return [...out, ...bodyProblems(env.body, { parent }), ...(isObj(env.body) ? signatureProblems(env, { need }) : [])];
}
