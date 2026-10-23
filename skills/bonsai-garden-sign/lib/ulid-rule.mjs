// ---
// id: 01M3BS43SWHQACH8Y1P2M4JHK8
// ---
/**
 * ulid-rule.mjs — core's tools/ulid.py rule, ported for the v2 verifier.
 *
 * The gardener, 2026-09-24: *"apply valid ulids in the process!!!!"* Every v2 seal
 * carries an `id` inside its signed payload. For a file that can carry an id itself
 * (.md frontmatter `id:`, a script header `# id:` / ` * id:`) the seal's id must be
 * the file's own; every other file (JSON, images, binaries) carries it in the seal.
 *
 * tools/ulid.py is the master; this is a port of `why_bad`, `header_lines`,
 * `read_id`, `_carries_id` (with its NO_ID_NAMES) and `id_exempt` (templates and cards),
 * and nothing else. It travels with the verifier
 * because a package carries the verifier and not core's tools/. Held to ulid.py
 * by test-seal-v2-parity.mjs, over the garden's own files and the edge cases.
 * `newUlid` is ulid.py's construction, for the one case a seal mints an id (a file
 * that cannot carry its own, sealed for the first time); what it mints is checked by
 * whyBad like any other id.
 */

import { randomBytes } from 'node:crypto';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const EPOCH_FLOOR_MS = 1704067200000; // 2024-01-01T00:00:00Z
const DAY_MS = 86400000;
const MIN_DISTINCT_RANDOM = 7;
const MAX_RUN = 5;
export const MD_EXT = ['.md'];
export const SCRIPT_EXT = ['.py', '.sh', '.mjs', '.js'];

// ulid.py NO_ID_NAMES: SKILL.md's frontmatter is the platform's (name, description, version
// only), so its id lives in its seal, as for any file that cannot carry one. A README.md is the
// forge's front page, where a frontmatter block renders as a table, and README.<name>.md a README
// kept under another name and published as README.md: theirs live in their seals too (ulid.py
// NO_ID_NAME_RE).
export const NO_ID_NAMES = ['SKILL.md', 'README.md'];
export const NO_ID_NAME_RE = /^README\.[a-z0-9-]+\.md$/;

export function carriesId(p) {
  const base = p.split(/[\\/]/).pop();
  if (NO_ID_NAMES.includes(base) || NO_ID_NAME_RE.test(base)) return false;
  const low = p.toLowerCase();
  return [...MD_EXT, ...SCRIPT_EXT].some((e) => low.endsWith(e));
}

function decodeMs(u) {
  let n = 0;
  for (const ch of u.slice(0, 10)) n = n * 32 + CROCKFORD.indexOf(ch);
  return n;
}

function maxRun(s) {
  let best = 0,
    run = 0,
    prev = null;
  for (const ch of s) {
    run = ch === prev ? run + 1 : 1;
    prev = ch;
    if (run > best) best = run;
  }
  return best;
}

/** null if `value` is a real ULID, else the reason — ulid.py `why_bad`, message for message. */
export function whyBad(value, nowMs = Date.now()) {
  if (value === null || value === undefined) return 'no id:';
  if (value === '') return 'empty id:';
  if (!ULID_RE.test(value)) {
    if ([...value].length !== 26) return `shape: ${[...value].length} chars, a ULID has 26`;
    if (value !== value.toUpperCase() && ULID_RE.test(value.toUpperCase())) {
      return 'shape: lower case — a ULID is upper-case Crockford';
    }
    const stray = [...new Set([...value].filter((c) => !CROCKFORD.includes(c)))].sort().join('');
    return `shape: not Crockford base-32 (has ${stray})`;
  }
  const ms = decodeMs(value);
  if (ms < EPOCH_FLOOR_MS || ms > nowMs + DAY_MS) {
    const stamp = ms < 2 ** 42 ? new Date(ms).toISOString().slice(0, 10) : 'far future';
    return `time: timestamp decodes to ${stamp}`;
  }
  const rnd = value.slice(10);
  const distinct = new Set(rnd).size;
  if (distinct < MIN_DISTINCT_RANDOM) return `entropy: random half has ${distinct} distinct chars — looks typed`;
  if (maxRun(value) > MAX_RUN) return `entropy: a run of ${maxRun(value)} identical chars — looks typed`;
  return null;
}

// Python's str.rstrip()/strip() with no argument strip whitespace; for the ASCII the
// headers are written in, trimEnd/trim is the same set.
function headerLines(text, p) {
  if (text.startsWith('\ufeff')) text = text.slice(1);
  const low = p.toLowerCase();
  const lines = text.split('\n');
  if (MD_EXT.some((e) => low.endsWith(e))) {
    if (!lines.length || lines[0].trimEnd() !== '---') return null;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trimEnd() === '---') return lines.slice(1, i).map((l) => l.replace(/\r+$/, ''));
    }
    return null;
  }
  if (SCRIPT_EXT.some((e) => low.endsWith(e))) {
    const marker = /^[ \t]*(?:#|\/\/|\*)[ \t]*---[ \t]*$/;
    let start = null;
    const head = lines.slice(0, 60);
    for (let i = 0; i < head.length; i++) {
      if (marker.test(head[i].replace(/\r+$/, ''))) {
        if (start === null) start = i;
        else return lines.slice(start + 1, i).map((x) => x.replace(/\r+$/, ''));
      }
    }
    return null;
  }
  return null;
}

const ID_LINE = /^(?<lead>[ \t]*(?:#|\/\/|\*)?[ \t]*)id:[ \t]*(?<v>.*?)[ \t]*$/;

function clean(v) {
  v = v.split(' #')[0].trim();
  if (v.length >= 2 && v[0] === v[v.length - 1] && (v[0] === "'" || v[0] === '"')) v = v.slice(1, -1);
  return v;
}

/** [hasHeader, id|null, structuralProblem|null] — ulid.py `read_id`. */
export function readId(text, p) {
  const head = headerLines(text, p);
  if (head === null) return [false, null, null];
  const isMd = MD_EXT.some((e) => p.toLowerCase().endsWith(e));
  const found = [];
  for (const l of head) {
    const m = ID_LINE.exec(l);
    if (!m) continue;
    const lead = m.groups.lead;
    if ((isMd && lead === '') || (!isMd && /[#*/]/.test(lead))) found.push(clean(m.groups.v));
  }
  if (found.length > 1) return [true, found[0], `structure: ${found.length} id: keys in one header`];
  return [true, found.length ? found[0] : null, null];
}

/**
 * ulid.py TEMPLATE_PLACEHOLDERS / is_template / template_exempt (Tasai, 2026-09-24). A
 * template BY PROPERTY — exactly one top-level `template: true` in its header — whose id
 * is exactly one of these placeholders is exempt from the id rule; its v2 seal carries a
 * minted id of its own. The placeholder without the flag is a typed id like any other.
 */
export const TEMPLATE_PLACEHOLDERS = ['<ULID>', 'TODO-generate-ulid'];
const TEMPLATE_LINE = /^(?<lead>[ \t]*(?:#|\/\/|\*)?[ \t]*)template:[ \t]*(?<v>.*?)[ \t]*$/;

export function isTemplate(text, p) {
  const head = headerLines(text, p);
  if (head === null) return false;
  const isMd = MD_EXT.some((e) => p.toLowerCase().endsWith(e));
  const found = [];
  for (const l of head) {
    const m = TEMPLATE_LINE.exec(l);
    // the bare YAML boolean; "true" quoted is a string
    if (m && ((isMd && m.groups.lead === '') || (!isMd && /[#*/]/.test(m.groups.lead))))
      found.push(m.groups.v.split(' #')[0].trim());
  }
  return found.length === 1 && found[0] === 'true';
}

export function templateExempt(text, p) {
  if (!isTemplate(text, p)) return false;
  const [has, id, structural] = readId(text, p);
  return has && structural === null && TEMPLATE_PLACEHOLDERS.includes(id);
}

/**
 * ulid.py CARD_ID_RE / CARD_LANES / is_card / id_exempt. A kanban card's id is its ticket
 * number (a name, by the card schema of core's validate-metadata.py: `<lane>/BL-XX###.md`,
 * the id its stem). Exempt like a template; its v2 seal carries a minted id of its own.
 */
export const CARD_ID_RE = /^BL-[A-Z]{2}\d{3}$/;
export const CARD_LANES = ['backlog', 'todo', 'in-progress', 'review', 'done'];

export function isCard(value, p) {
  const parts = p.replace(/\\/g, '/').split('/');
  if (parts.length < 2 || !MD_EXT.some((e) => p.toLowerCase().endsWith(e))) return false;
  const name = parts[parts.length - 1];
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return CARD_LANES.includes(parts[parts.length - 2]) && CARD_ID_RE.test(stem) && value === stem;
}

/** 'template' | 'card' | null — ulid.py `id_exempt`. */
export function idExempt(text, p) {
  if (templateExempt(text, p)) return 'template';
  const [has, id, structural] = readId(text, p);
  if (has && structural === null && isCard(id, p)) return 'card';
  return null;
}

/**
 * The id a file carries itself, for the v2 check: { carrier:false } for a file type
 * that cannot carry one; else { carrier:true, id, problem } where problem is null
 * only for one well-formed id.
 */
export function ownId(buf, p) {
  if (!carriesId(p)) return { carrier: false, id: null, problem: null };
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return { carrier: true, id: null, problem: 'unreadable: not UTF-8' };
  }
  // a template or a card: its minted id lives in its seal alone; the frontmatter id is never compared
  if (idExempt(text, p)) return { carrier: false, id: null, problem: null };
  const [has, id, structural] = readId(text, p);
  if (!has) return { carrier: true, id: null, problem: 'no header carrying an id:' };
  if (structural) return { carrier: true, id, problem: structural };
  const bad = whyBad(id);
  return { carrier: true, id, problem: bad };
}

/**
 * A fresh ULID, for a file that cannot carry its own id (JSON, images, binaries) and
 * has no v2 seal to keep one from. ulid.py `new_ulid`'s construction (48-bit ms +
 * 80 random bits, Crockford), and checked by whyBad before any seal carries it.
 */
let lastMs = -1;
let lastRand = 0n;
export function newUlid() {
  const ms = Date.now();
  let rand;
  if (ms === lastMs) {
    rand = lastRand + 1n;
    if (rand >= 1n << 80n) throw new Error('random counter overflow within one millisecond');
  } else {
    rand = BigInt(`0x${randomBytes(10).toString('hex')}`);
  }
  lastMs = ms;
  lastRand = rand;
  const n = (BigInt(ms) << 80n) | rand;
  let out = '';
  for (let i = 25; i >= 0; i--) out += CROCKFORD[Number((n >> BigInt(5 * i)) & 31n)];
  return out;
}
