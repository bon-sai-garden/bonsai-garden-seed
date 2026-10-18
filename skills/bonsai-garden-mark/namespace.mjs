// ---
// id: 01M498HCC3GPN0RC0VD0Y8Z90J
// title: A garden's namespace and an entity's plain mark, searched against the shipped reserved rule
// type: script
// tended-by: baisai
// created: 2026-10-06
// updated: 2026-10-16
// ---
//
// namespace.mjs — the two mark searches the gardener's keys need (spec-gardeners-keys.md §6, §7.1),
// and the check that a pot's locks were searched, not typed (§7, last line).
//
//   node namespace.mjs namespace --name <romaji>
//   node namespace.mjs identity  --slug <slug> --garden <romaji> --pair 〇〇
//   node namespace.mjs check-locks <pot>/locked-salts.json
//
// Pure: SHA-256 of a salt string, sliced as engine.js slices it (10 bits per kanji, MSB first).
// No secret is involved in a mark, so nothing here reads custody; the signing salt, which needs
// the master salt, is searched by bonsai-garden-keys (lib/search-signing.mjs).
//
// The namespace: base `<romaji>#<n>`, the third kanji fixed at 庭 (index 322), the first two free
// and NOT matching the reserved rule. About a thousand tries. The variant spec §6.1 asks of
// vanity-three.mjs is this file: vanity-three writes into core by default and runs workers for a
// 30-bit search; this one is 10 bits plus the rule, and writes nothing.
//
// The reserved set is an INPUT, never built here, and there is exactly one: the shipped
// reserved-marks.json beside this file, read by reserved-marks.mjs `loadReservedSet`, which checks
// its seal's hash and believes it only on bon-sai.garden's signed answer (spec §6.4). There is no
// flag that names another file (--exclude left with 0.2.0 of the spec: a flag that names the rule's
// file can name a weaker one). The searches below take the rule as an argument, so the suites call
// them on planted rules; a stranger's run cannot. Unreachable halts (3). A search without the
// reserved set is the one thing this file will not do.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slice } from './engine.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SET_FILE = 'kanji-1024-v1.2.json';
export const NIWA = 322; // 庭, courtyard, garden: every new garden's third kanji
// Spec §6.1 (0.5.0): 盆 is never a first shown kanji for any entity, in any garden. The reserved rule lets 盆
// through with a second outside B, and the verifier answers look-alike to any 盆-first mark on a key other
// than the origin's. Beside the rule, not in reserved-marks.json; the search is the only place it acts, so
// the origin's own 盆才守神, which was never searched for, is untouched.
export const BON = '盆';
export const GUARDIAN = 'bonsai-shin'; // the one slug whose pair is drawn, never chosen (spec §7.1)
export const bonFirst = (pair) =>
  chars(pair)[0] === BON
    ? `${BON} is never a first shown kanji: it is the origin's, and the verifier answers look-alike to a ${BON}-first mark on any other key`
    : null;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const NAME_RE = /^[a-z][a-z0-9-]{1,30}$/;

let _set = null;
export function kanjiSet() {
  if (!_set) _set = JSON.parse(fs.readFileSync(path.join(HERE, SET_FILE), 'utf8')).kanji;
  return _set;
}
export const chars = (idx) => idx.map((i) => kanjiSet()[i].char).join('');

/** The three indices a salt string's mark carries. */
export function indicesOf(str) {
  return slice(createHash('sha256').update(str, 'utf8').digest());
}

/** '〇〇' → [a, b], or throws naming the kanji the set does not hold. */
export function pairOf(text) {
  const cs = [...String(text || '')];
  if (cs.length !== 2)
    throw Object.assign(new Error(`a pair is two kanji, not ${JSON.stringify(text)}`), { code: 'BAD_PAIR' });
  return cs.map((c) => {
    const k = kanjiSet().find((x) => x.char === c);
    if (!k) throw Object.assign(new Error(`${c} is not in the curated set (${SET_FILE})`), { code: 'BAD_PAIR' });
    return k.index;
  });
}

/** Iterate nonces over `<base>#<n>` with the prefix absorbed once. */
function* nonces(base, max) {
  const prefix = createHash('sha256').update(`${base}#`, 'utf8');
  for (let n = 0; n < max; n++) {
    const d = prefix.copy().update(String(n), 'utf8').digest();
    yield [n, slice(d)];
  }
}

/** Spec §6.1: `<romaji>#<n>` until the third kanji is 庭 and the three are not reserved. */
export function searchNamespace({ name, exclude, max = 10_000_000 }) {
  if (!NAME_RE.test(name || ''))
    throw Object.assign(new Error(`the garden's name is not ^[a-z][a-z0-9-]{1,30}$`), { code: 'BAD_NAME' });
  if (!exclude || typeof exclude.reserved !== 'function' || !exclude.size)
    throw Object.assign(new Error('no reserved set'), { code: 'NO_EXCLUSION' });
  for (const [n, idx] of nonces(name, max)) {
    if (idx[2] === NIWA && !exclude.reserved(idx)) {
      return { salt: `${name}#${n}`, indices: idx, kanji: chars(idx), nonce: n };
    }
  }
  return null;
}

/** Spec §7.1: `<slug>@<romaji>-id#<n>` until the mark's first two kanji are the chosen pair. */
export function searchIdentity({ slug, garden, pair, exclude, max = 60_000_000 }) {
  if (!SLUG_RE.test(slug || ''))
    throw Object.assign(new Error(`the slug is not ^[a-z0-9][a-z0-9-]*$`), { code: 'BAD_SLUG' });
  if (!exclude || typeof exclude.reserved !== 'function' || !exclude.size)
    throw Object.assign(new Error('no reserved set'), { code: 'NO_EXCLUSION' });
  const why = exclude.reserved(pair);
  if (why) {
    throw Object.assign(new Error(`${chars(pair)}: ${why}, in the first namespace; choose another`), {
      code: 'RESERVED',
    });
  }
  const bon = bonFirst(pair);
  if (bon) throw Object.assign(new Error(`${chars(pair)}: ${bon}; choose another`), { code: 'BON_FIRST' });
  const base = `${slug}@${garden}-id`;
  for (const [n, idx] of nonces(base, max)) {
    if (idx[0] === pair[0] && idx[1] === pair[1])
      return { salt: `${base}#${n}`, indices: idx, kanji: chars(pair), nonce: n };
  }
  return null;
}

/** An entity's four indices from its identity salt's hash, ten bits each: the same slicing vanity-four uses (spec §7.3). */
export function indices4(str) {
  const d = createHash('sha256').update(str, 'utf8').digest();
  const out = [];
  for (let k = 0; k < 4; k++) {
    let v = 0;
    for (let b = k * 10; b < k * 10 + 10; b++) v = (v << 1) | ((d[b >> 3] >> (7 - (b & 7))) & 1);
    out.push(v);
  }
  return out;
}

/** §7.3: the third and fourth kanji are random but never 〇 (the wildcard, the origin's tail), and the third is never 庭. */
export const tailOk = (idx) => idx[2] !== 0 && idx[3] !== 0 && idx[2] !== NIWA;

/**
 * Spec §7.3 and §7.1: the first `count` candidate identity salts, in order. An attempt is one four-kanji ID.
 * With `pair` (the gardener's and the companion's, already validated): each attempt spells that pair, and its own
 * two random kanji follow. Without it (the guardian): the pair is DRAWN, a candidate only if the reserved rule
 * lets it by, it is not 盆-first, not taken by another entity, and not the namespace's own first two. A candidate
 * that fails is skipped and never counts. Public and deterministic: no key, no custody.
 */
export function attempts({
  slug,
  garden,
  pair = null,
  exclude,
  taken = [],
  nsFirstTwo = null,
  count = 5,
  max = 60_000_000,
}) {
  if (!SLUG_RE.test(slug || ''))
    throw Object.assign(new Error(`the slug is not ^[a-z0-9][a-z0-9-]*$`), { code: 'BAD_SLUG' });
  if (!exclude || typeof exclude.reserved !== 'function' || !exclude.size)
    throw Object.assign(new Error('no reserved set'), { code: 'NO_EXCLUSION' });
  const base = `${slug}@${garden}-id`;
  const prefix = createHash('sha256').update(`${base}#`, 'utf8');
  const takenS = new Set(taken.map((t) => t.join()));
  const out = [];
  for (let n = 0; n < max && out.length < count; n++) {
    const d = prefix.copy().update(String(n), 'utf8').digest();
    const idx = [];
    for (let k = 0; k < 4; k++) {
      let v = 0;
      for (let b = k * 10; b < k * 10 + 10; b++) v = (v << 1) | ((d[b >> 3] >> (7 - (b & 7))) & 1);
      idx.push(v);
    }
    if (!tailOk(idx)) continue;
    const p = [idx[0], idx[1]];
    if (pair) {
      if (p[0] !== pair[0] || p[1] !== pair[1]) continue;
    } else {
      if (exclude.reserved(p) || bonFirst(p)) continue;
      if (takenS.has(p.join())) continue;
      if (nsFirstTwo && p[0] === nsFirstTwo[0] && p[1] === nsFirstTwo[1]) continue;
    }
    out.push({ n: out.length + 1, salt: `${base}#${n}`, nonce: n, indices: idx, pair: p, kanji: chars(idx) });
  }
  return out;
}

/**
 * Re-derive every mark in a pot's locked-salts.json from its salt. A lock that was typed, or
 * edited after the search, disagrees with its own salt here. Returns the problems found.
 */
export function checkLocks(locks, { exclude = null } = {}) {
  const problems = [];
  const g = locks?._garden;
  if (g) {
    const idx = indicesOf(g.salt || '');
    if (!g.salt || g.salt.split('#')[0] !== g.name)
      problems.push(`_garden: salt ${JSON.stringify(g.salt)} is not <name>#<n>`);
    if (idx[2] !== NIWA) problems.push(`_garden: ${g.salt} does not end in 庭`);
    if (JSON.stringify(idx) !== JSON.stringify(g.indices) || chars(idx) !== g.kanji) {
      problems.push(
        `_garden: ${g.salt} renders ${chars(idx)} ${JSON.stringify(idx)}, the lock says ${g.kanji} ${JSON.stringify(g.indices)}`,
      );
    }
  }
  for (const [slug, e] of Object.entries(locks?.agents || {})) {
    const want = `${slug}@${g ? g.name : '?'}-id#`;
    if (!e.identity_salt?.startsWith(want))
      problems.push(`${slug}: identity salt ${JSON.stringify(e.identity_salt)} is not ${want}<n>`);
    if (e.signing_salt && !e.signing_salt.startsWith(`${slug}@${g ? g.name : '?'}-sign#`))
      problems.push(`${slug}: signing salt is not in this garden's namespace`);
    const idx = indicesOf(e.identity_salt || '').slice(0, 2);
    if (JSON.stringify(idx) !== JSON.stringify(e.identity_pair) || chars(idx) !== e.identity_kanji) {
      problems.push(`${slug}: ${e.identity_salt} renders ${chars(idx)}, the lock says ${e.identity_kanji}`);
    }
    // §7.3, §7.1: what the draw would have refused is refused here too, so a typed lock is not believed
    const four = indices4(e.identity_salt || '');
    if (e.identity_kanji_full !== undefined && chars(four) !== e.identity_kanji_full) {
      problems.push(`${slug}: ${e.identity_salt} renders ${chars(four)}, the lock says ${e.identity_kanji_full}`);
    }
    if (
      e.picked !== undefined &&
      e.picked !== 'default' &&
      !(Number.isInteger(e.picked) && e.picked >= 1 && e.picked <= 5)
    ) {
      problems.push(`${slug}: picked ${JSON.stringify(e.picked)} is not an attempt (1 to 5) or default`);
    }
    if (!tailOk(four))
      problems.push(
        `${slug}: ${chars(four)} has 〇 in its last two or 庭 third; the draw skips it, so it was never an attempt`,
      );
    if (slug === GUARDIAN) {
      if (e.picked === undefined)
        problems.push(`${slug}: no picked record; the guardian's ID is drawn and picked, never typed (spec §7.1)`);
      const why = bonFirst(four.slice(0, 2));
      if (why) problems.push(`${slug}: ${chars(four.slice(0, 2))}: ${why}`);
      if (g?.indices && four[0] === g.indices[0] && four[1] === g.indices[1])
        problems.push(`${slug}: ${chars(four.slice(0, 2))} is the namespace's own first two`);
      if (exclude) {
        const r = exclude.reserved(four.slice(0, 2));
        if (r) problems.push(`${slug}: ${chars(four.slice(0, 2))}: ${r}`);
      }
    }
  }
  return problems;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function opts(a) {
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const k = a[i].slice(2);
    if (k === 'exclude')
      throw Object.assign(
        new Error(
          "--exclude is gone: the reserved set is the shipped, sealed reserved-marks.json, believed on bon-sai.garden's word (spec §6.4)",
        ),
        { code: 'USAGE' },
      );
    if (!['name', 'slug', 'garden', 'pair'].includes(k))
      throw Object.assign(new Error(`unknown flag --${k}`), { code: 'USAGE' });
    o[k] = a[++i];
  }
  return o;
}

async function shippedRule() {
  const { loadReservedSet } = await import('./reserved-marks.mjs');
  return loadReservedSet(); // the shipped file, its seal, the origin's word; nothing else
}

const direct = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
const USAGE =
  'usage: namespace.mjs namespace --name <romaji> | identity --slug <slug> --garden <romaji> --pair 〇〇 | check-locks <pot>/locked-salts.json';
// not top-level await: reserved-marks.mjs imports this file, and a module mid-evaluation cannot wait on it
async function cli() {
  const [verb, ...rest] = process.argv.slice(2);
  if (verb === '--help' || verb === '-h') {
    console.log(`${USAGE}  (see the header of this file)`);
    process.exit(0);
  }
  try {
    if (verb === 'check-locks') {
      const p = checkLocks(JSON.parse(fs.readFileSync(rest[0], 'utf8')));
      for (const x of p) console.log(`  ✗ ${x}`);
      console.log(
        p.length ? `FAIL — ${p.length} lock(s) disagree with their salts` : 'every lock re-derives from its salt',
      );
      process.exit(p.length ? 1 : 0);
    }
    const o = opts(rest);
    if (verb === 'namespace') {
      const r = searchNamespace({ name: o.name, exclude: await shippedRule() });
      console.log(
        r ? `${r.kanji}  ${r.salt}  ${JSON.stringify(r.indices)}` : 'no namespace found within the search bound',
      );
      process.exit(r ? 0 : 2);
    } else if (verb === 'identity') {
      const pair = pairOf(o.pair);
      const r = searchIdentity({ slug: o.slug, garden: o.garden, pair, exclude: await shippedRule() });
      console.log(r ? `${r.kanji}  ${r.salt}` : 'no salt found within the search bound');
      process.exit(r ? 0 : 2);
    }
    console.error(`${USAGE}  (see the header)`);
    process.exit(64);
  } catch (e) {
    const usage = e.code === 'USAGE' || e.code === 'BAD_PAIR' || e.code === 'BAD_SLUG' || e.code === 'BAD_NAME';
    console.error(`${usage ? 'usage' : e.exit === 3 ? 'halt' : 'refused'}: ${e.message}`);
    process.exit(usage ? 64 : e.exit === 3 ? 3 : 2);
  }
}
if (direct) cli();
