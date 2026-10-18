// ---
// id: 01M4AFY74CE4RZJHX429W5XF8H
// title: The shipped reserved set — its generator, its drift gate, and its reader pinned by seal
// type: script
// tended-by: baisai
// created: 2026-10-07
// updated: 2026-10-16
// ---
//
// reserved-marks.mjs — spec-gardeners-keys.md §6.3 to §6.5.
//
//   node reserved-marks.mjs generate --registry <origin's agents/registry.json> [--out <file>]
//   node reserved-marks.mjs check [--registry <origin's agents/registry.json>] [--staged]
//
// THE FILE, `reserved-marks.json` beside this one: exactly five keys, { format, about, wildcard,
// A, B }; indices into kanji-1024-v1.2.json, sorted, unique, in 0..1023; written by one function,
// JSON.stringify(obj, null, 2) + "\n", so two runs are byte-identical. No columns, ever. It names
// no one: a stone, not a face (Chisai, 2026-10-06). Sealed owner by Mori-shin after she reviews
// each generation as its list; the generator's runner never seals it in her name.
//
// GENERATE. Inputs, all named, none typed: (1) the roster at --registry, required, no default
// (core never reads the origin's roster by a path of its own): every entry's `kanji` first
// character, whatever its status, 〇 aside; (2) core's own skills/*/references/identity.md, the
// frontmatter `mark:` first character whatever `mark-status`, re-derived from its `mark-salt`
// through engine.js (a mark its salt does not spell was typed, and is refused by name); (3) the
// committed file (HEAD), because the set only grows; (4) the rule's constants below, written once
// as characters and resolved through the curated set. Prose is never an input.
//
// CHECK, the drift gate. Core alone (pre-commit, CI): the shape and the five keys; sorted, unique,
// in range; the header byte-exact; the floor; only grows against HEAD (with --staged, the index
// against HEAD); every core skill's first mark kanji in A; the seal's hash. With --registry (mono's
// pre-commit, when the roster is staged): every roster first kanji in A (stale: regenerate in
// core), and every index no source derives must already have shipped (hand-added).
//
// THE READER, loadReservedSet: reads only the shipped file, found beside this module; checks its
// seal's file-hash over the exact bytes; and believes it only on bon-sai.garden's signed answer
// (origin.mjs → published-keys.mjs adjudicatePublishedV2). Unreachable halts (3): no cache, no
// offline mode, no flag that names another file. The floor is a constant here, never a field the
// checked file states about itself.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slice } from './engine.js';
import { kanjiSet, chars } from './namespace.mjs';
import { makeOrigin } from './origin.mjs';
import { v2SchemaProblem } from '../bonsai-garden-sign/lib/seal-v2.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const FORMAT = 'bonsai-garden-reserved-marks/1';
export const ABOUT = Object.freeze([
  'Indices of the 1024-kanji set (v1.2) reserved in the first namespace. A mark that matches the rule (any shown kanji in wildcard, or its first in A and its second in B) means: choose another. It names no one and attests nothing.',
  'Not a roster. Nothing here can be verified against. Whoever wears a match anyway gets look-alike from the verifier, never a false yes.',
  'It only grows. An index never leaves this file; a retired name is still a taken name.',
]);
export const KEYS = Object.freeze(['format', 'about', 'wildcard', 'A', 'B']);
/** The rule's constants (the Aruji, 2026-10-06): written once, as characters. */
export const WILDCARD_CHARS = Object.freeze(['〇']);
export const B_CHARS = Object.freeze(['才', '身', '園', '技', '庭', '盆']);
/** The floor of set A: the count on the day of the rule. A only grows, so it never needs raising. */
export const MIN_A = 33;
export const FILE_NAME = 'reserved-marks.json';
export const SHIPPED = path.join(HERE, FILE_NAME);
export const SHIPPED_TARGET = `skills/bonsai-garden-mark/${FILE_NAME}`;

export const R = Object.freeze({
  HAND: 'hand-added',
  LEFT: 'an index left the set; it only grows',
  STALE: 'stale: regenerate',
  FLOOR: 'under the floor',
  FORMAT: 'not the format',
  COLUMNS: 'no columns',
  HEADER: 'header',
  PAIRS: 'the pair list is not read',
  ONE_SHAPE: 'one shape',
  HASH: 'hash-mismatch',
  TYPED: 'typed mark',
  UNSEALED: 'unsealed',
  NOT_OWNER: 'not an owner seal',
  NOT_SHIPPED: 'not the shipped file',
  MISSING: 'no reserved set',
  INPUT: 'input refused',
});

export class Refusal extends Error {
  constructor(reason, detail, exit = 2) {
    super(`${reason}: ${detail}`);
    this.reason = reason;
    this.detail = detail;
    this.exit = exit;
    this.code = 'RESERVED_REFUSED';
  }
}

/** The one serialiser. */
export const serialize = (obj) => `${JSON.stringify(obj, null, 2)}\n`;

export function indexOfChar(c, what) {
  const k = kanjiSet().find((x) => x.char === c);
  if (!k) throw new Refusal(R.INPUT, `${what}: ${c} is not in the curated set (kanji-1024-v1.2.json)`);
  return k.index;
}

export function constants() {
  return {
    wildcard: WILDCARD_CHARS.map((c) => indexOfChar(c, 'the wildcard')),
    B: B_CHARS.map((c) => indexOfChar(c, 'set B')).sort((x, y) => x - y),
  };
}

// ── shape and floor ──────────────────────────────────────────────────────────

const SETS = ['wildcard', 'A', 'B'];

/** Every way `data` is not the one shape, in a fixed order: [{ reason, detail }]. */
export function shapeProblems(data) {
  const out = [];
  const add = (reason, detail) => out.push({ reason, detail });
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    add(R.FORMAT, 'not a JSON object');
    return out;
  }
  if ('pairs' in data) add(R.PAIRS, 'a { "pairs": [...] } list; the rule replaced it (spec 0.1.5)');
  for (const alias of ['set-a', 'set-b'])
    if (alias in data) add(R.ONE_SHAPE, `"${alias}"; the reader reads wildcard, A and B only`);
  for (const k of Object.keys(data)) {
    if (!KEYS.includes(k) && k !== 'pairs' && k !== 'set-a' && k !== 'set-b') add(R.COLUMNS, `a sixth key, "${k}"`);
  }
  for (const s of SETS) {
    if (Array.isArray(data[s]) && data[s].some((v) => v !== null && typeof v === 'object'))
      add(R.COLUMNS, `an object in ${s}`);
  }
  for (const k of KEYS) if (!(k in data)) add(R.FORMAT, `the key "${k}" is missing`);
  if ('format' in data && data.format !== FORMAT)
    add(R.FORMAT, `format is ${JSON.stringify(data.format)}, not "${FORMAT}"`);
  if ('about' in data) {
    const a = data.about;
    if (!Array.isArray(a) || a.length !== ABOUT.length)
      add(R.HEADER, `the about lines are not Chisai's three (${Array.isArray(a) ? a.length : typeof a})`);
    else
      a.forEach((line, i) => {
        if (line !== ABOUT[i]) add(R.HEADER, `about line ${i + 1} is altered`);
      });
  }
  for (const s of SETS) {
    if (!(s in data)) continue;
    const v = data[s];
    if (!Array.isArray(v)) {
      add(R.FORMAT, `${s} is not a list`);
      continue;
    }
    const seen = new Set();
    for (const i of v) {
      if (i !== null && typeof i === 'object') continue; // a column, above
      if (!Number.isInteger(i)) {
        add(R.FORMAT, `${s} holds ${JSON.stringify(i)}, not an integer index`);
        continue;
      }
      if (i < 0 || i > 1023) {
        add(R.FORMAT, `${s} holds ${i}, outside 0..1023`);
        continue;
      }
      if (seen.has(i)) add(R.FORMAT, `${s} holds ${i} twice`);
      seen.add(i);
    }
    const ints = v.filter((i) => Number.isInteger(i));
    if (ints.some((i, n) => n > 0 && ints[n - 1] > i)) add(R.FORMAT, `${s} is not sorted ascending`);
  }
  if (Array.isArray(data.A) && data.A.includes(0)) add(R.FORMAT, '〇 (0) is in A; it is the wildcard, never in A');
  return out;
}

/** The floor: 〇 in the wildcard, all six of B, at least MIN_A in A. Names the part. */
export function floorProblems(sets) {
  const out = [];
  const { wildcard: W0, B: B0 } = constants();
  for (const w of W0)
    if (!sets.wildcard.has(w)) out.push({ reason: R.FLOOR, detail: `the wildcard does not hold ${chars([w])} (${w})` });
  for (const b of B0)
    if (!sets.B.has(b))
      out.push({
        reason: R.FLOOR,
        detail: `set B lacks ${chars([b])} (${b}); the rule's set B is ${B_CHARS.join(' ')}`,
      });
  if (sets.A.size < MIN_A)
    out.push({
      reason: R.FLOOR,
      detail: `set A holds ${sets.A.size}, under the ${MIN_A} the rule counted (it only grows)`,
    });
  return out;
}

const toSets = (data) =>
  Object.fromEntries(SETS.map((s) => [s, new Set(Array.isArray(data[s]) ? data[s].filter(Number.isInteger) : [])]));

/** Text → { wildcard, A, B } as Sets, or throws the first problem as a Refusal. */
export function parseReserved(text) {
  let data;
  try {
    data = JSON.parse(String(text));
  } catch {
    throw new Refusal(R.FORMAT, 'not JSON');
  }
  const shape = shapeProblems(data);
  if (shape.length) throw new Refusal(shape[0].reason, shape[0].detail);
  const sets = toSets(data);
  const floor = floorProblems(sets);
  if (floor.length) throw new Refusal(floor[0].reason, floor[0].detail);
  return sets;
}

/** The rule over the kanji a mark shows: 〇 anywhere; first in A and second in B. */
export function ruleOf(sets) {
  const { wildcard: W, A, B } = sets;
  return {
    size: W.size + A.size + B.size,
    reserved(idx) {
      const w = idx.find((i) => W.has(i));
      if (w !== undefined) return `${chars([w])} is the wildcard, reserved at every index`;
      if (A.has(idx[0]) && B.has(idx[1]))
        return `${chars(idx.slice(0, 2))} matches the reserved rule (first in set A, second in set B)`;
      return null;
    },
  };
}

// ── the seal ─────────────────────────────────────────────────────────────────

export const sidecarOf = (file) => path.join(path.dirname(file), `.${path.basename(file)}.bonsaisig`);
const blake = (bytes) => createHash('blake2b512').update(bytes).digest('hex');

/** Offline: the sidecar's form, owner, target and file-hash over `bytes`. Returns the sidecar or throws. */
export function sealProblem(bytes, sideText) {
  if (sideText === null || sideText === undefined) {
    return {
      reason: R.UNSEALED,
      detail: `${FILE_NAME} has no seal beside it (.${FILE_NAME}.bonsaisig); it is believed only under the origin's seal`,
    };
  }
  let data;
  try {
    data = JSON.parse(String(sideText));
  } catch {
    return { reason: 'bad-sidecar', detail: 'the seal is not JSON' };
  }
  const p = v2SchemaProblem(data);
  if (p) return { reason: 'bad-sidecar', detail: p };
  if (data.role !== 'owner')
    return {
      reason: R.NOT_OWNER,
      detail: `sealed ${data.role} by ${data.signer}; the set is believed only under an owner seal`,
    };
  if ('open' in data)
    return { reason: R.NOT_OWNER, detail: 'an open seal is a declaration of work in progress, not a seal on a rule' };
  if (data.target !== SHIPPED_TARGET)
    return { reason: R.NOT_SHIPPED, detail: `the seal names ${data.target}, not ${SHIPPED_TARGET}` };
  if (blake(bytes) !== data['file-hash'])
    return { reason: R.HASH, detail: 'the file is not the bytes that were sealed: edited after its seal' };
  return { data };
}

/**
 * The reader. Reads `file` (the shipped one; tests plant others) and its hidden sidecar, offline
 * checks first, then asks the origin. Returns the rule, or throws a Refusal (exit 2; 3 unreachable).
 */
export async function loadReservedSet({ file = SHIPPED, origin = makeOrigin() } = {}) {
  const wrap = (reason, detail, exit = 2) => new Refusal(reason, detail, exit);
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch (e) {
    throw wrap(R.MISSING, `${file} cannot be read (${e.code || e.message}); never search without the shipped set`);
  }
  let sideText = null;
  try {
    sideText = fs.readFileSync(sidecarOf(file), 'utf8');
  } catch {
    sideText = null;
  }
  const s = sealProblem(bytes, sideText);
  if (!s.data) throw wrap(s.reason, s.detail);
  const sets = parseReserved(bytes.toString('utf8'));
  const v = await origin.ask(s.data);
  if (v.status === 'keys-unreachable')
    throw wrap(v.status, `${v.reason}; the reserved set's seal cannot be checked, so nothing is searched`, 3);
  if (v.status !== 'signature-vouched')
    throw wrap(v.status, v.reason || "bon-sai.garden does not vouch for the reserved set's seal");
  return ruleOf(sets);
}

// ── the generator ────────────────────────────────────────────────────────────

/** The indices a salt string's first n kanji carry, through engine.js (n ≤ 4). */
export function markIndices(salt, n) {
  const d = createHash('sha256').update(salt, 'utf8').digest();
  const three = slice(d);
  if (n <= 3) return three.slice(0, n);
  if (n === 4) return [...three, parseInt(d.toString('hex').slice(0, 10), 16) & 0x3ff];
  throw new Refusal(R.TYPED, `a mark of ${n} kanji; the engine spells at most four`);
}

/** Top-level `key: value` scalars of a markdown file's frontmatter, with 1-based line numbers. */
export function frontmatter(text) {
  const lines = String(text).split('\n');
  const out = {};
  if (lines[0].trim() !== '---') return out;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.trim() === '---') break;
    const m = /^([A-Za-z0-9_-]+):[ \t]*(.*?)[ \t]*$/.exec(l);
    if (!m) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
      try {
        v = JSON.parse(v);
      } catch {
        /* keep raw */
      }
    } else if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) v = v.slice(1, -1);
    out[m[1]] = { value: v, line: i + 1 };
  }
  return out;
}

/** Core's skill marks: [{ skill, file, mark, salt, index, source }]. Throws on a typed mark. */
export function skillMarks(coreRoot, readText = (p) => fs.readFileSync(p, 'utf8')) {
  const out = [];
  const skillsDir = path.join(coreRoot, 'skills');
  let names = [];
  try {
    names = fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch (e) {
    throw new Refusal(R.INPUT, `${skillsDir} cannot be read (${e.code})`);
  }
  for (const name of names) {
    const rel = `skills/${name}/references/identity.md`;
    const file = path.join(coreRoot, rel);
    if (!fs.existsSync(file)) continue;
    const fm = frontmatter(readText(file));
    if (!fm.mark) continue; // no mark: adds nothing
    const mark = fm.mark.value;
    const cs = [...mark];
    if (!cs.length) throw new Refusal(R.TYPED, `${rel}:${fm.mark.line}: an empty mark`);
    if (!fm['mark-salt']?.value) {
      throw new Refusal(
        R.TYPED,
        `${rel}:${fm.mark.line}: mark ${mark} has no mark-salt; a mark nobody can re-derive was typed`,
      );
    }
    const salt = fm['mark-salt'].value;
    const spelled = chars(markIndices(salt, cs.length));
    if (spelled !== mark) {
      throw new Refusal(
        R.TYPED,
        `${rel}:${fm.mark.line}: mark ${mark}, but its salt ${JSON.stringify(salt)} spells ${spelled}`,
      );
    }
    const index = indexOfChar(cs[0], rel);
    out.push({
      skill: name,
      file: rel,
      mark,
      salt,
      index,
      source: `${rel}:${fm.mark.line}  mark: ${mark} (re-derived from ${JSON.stringify(salt)})`,
    });
  }
  return out;
}

/** The roster's first kanji: [{ slug, kanji, index|null, source }]. Throws on an unreadable roster. */
export function rosterMarks(registryPath, label = registryPath) {
  if (!registryPath)
    throw new Refusal(R.INPUT, "--registry <the origin's agents/registry.json> is required; it has no default");
  let text, data;
  try {
    text = fs.readFileSync(registryPath, 'utf8');
  } catch (e) {
    throw new Refusal(R.INPUT, `${registryPath} cannot be read (${e.code || e.message})`);
  }
  try {
    data = JSON.parse(text);
  } catch {
    throw new Refusal(R.INPUT, `${registryPath} is not JSON`);
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.agents))
    throw new Refusal(R.INPUT, `${registryPath} has no "agents" list`);
  const lines = text.split('\n');
  const lineOf = (slug, kanji) => {
    const at = lines.findIndex((l) => l.includes(`"slug": ${JSON.stringify(slug)}`));
    for (let i = Math.max(at, 0); i < lines.length; i++)
      if (lines[i].includes('"kanji"') && lines[i].includes(JSON.stringify(kanji))) return i + 1;
    return null;
  };
  const out = [];
  for (const e of data.agents) {
    if (!e || typeof e.kanji !== 'string' || !e.kanji) continue; // an entry with no mark adds nothing
    const first = [...e.kanji][0];
    const ln = lineOf(e.slug, e.kanji);
    const source = `${label}${ln ? `:${ln}` : ''}  ${e.slug} kanji ${e.kanji} (${e.status || 'no status'})`;
    if (first === WILDCARD_CHARS[0]) {
      out.push({
        slug: e.slug,
        kanji: e.kanji,
        index: null,
        source: `${source}: 〇 is the wildcard, already reserved everywhere`,
      });
      continue;
    }
    out.push({ slug: e.slug, kanji: e.kanji, index: indexOfChar(first, `${label}: ${e.slug}`), source });
  }
  return out;
}

/** git show <rev>:<rel> in `root` → Buffer, or null when absent. */
function gitShow(root, spec) {
  const r = spawnSync('git', ['-C', root, 'show', spec], { encoding: 'buffer' });
  return r.status === 0 ? r.stdout : null;
}
function everShipped(root, rel) {
  const r = spawnSync('git', ['-C', root, 'log', '-1', '--format=%H', '--', rel], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim().length > 0;
}

/** The derivation: what the sources put in each set, each index with the lines that put it there. */
export function derive({ registryPath, registryLabel, coreRoot, committedText = null }) {
  const src = { wildcard: new Map(), A: new Map(), B: new Map() };
  const put = (set, i, line) => {
    if (!src[set].has(i)) src[set].set(i, []);
    src[set].get(i).push(line);
  };
  const c = constants();
  for (const [n, i] of c.wildcard.entries())
    put('wildcard', i, `rule constant: ${WILDCARD_CHARS[n]}, the wildcard (spec §6.2)`);
  for (const ch of B_CHARS) put('B', indexOfChar(ch, 'set B'), `rule constant: ${ch}, set B (spec §6.2)`);
  const notes = [];
  for (const r of rosterMarks(registryPath, registryLabel)) {
    if (r.index === null) notes.push(r.source);
    else put('A', r.index, r.source);
  }
  for (const s of skillMarks(coreRoot)) put('A', s.index, s.source);
  if (committedText !== null) {
    const committed = parseReserved(committedText); // a malformed committed file is refused
    for (const s of SETS)
      for (const i of committed[s])
        if (!src[s].has(i)) put(s, i, 'the committed file: shipped before, and it only grows');
  }
  return { src, notes };
}

/** The generation: { obj, text, src, notes }. Refuses under the floor. */
export function generate({ registryPath, registryLabel = registryPath, coreRoot }) {
  const head = gitShow(coreRoot, `HEAD:${SHIPPED_TARGET}`);
  const { src, notes } = derive({
    registryPath,
    registryLabel,
    coreRoot,
    committedText: head ? head.toString('utf8') : null,
  });
  const sorted = (m) => [...m.keys()].sort((x, y) => x - y);
  const obj = {
    format: FORMAT,
    about: [...ABOUT],
    wildcard: sorted(src.wildcard),
    A: sorted(src.A).filter((i) => i !== 0),
    B: sorted(src.B),
  };
  const floor = floorProblems(toSets(obj));
  if (floor.length) throw new Refusal(floor[0].reason, floor[0].detail);
  return { obj, text: serialize(obj), src, notes };
}

// ── the gate ─────────────────────────────────────────────────────────────────

export function check({ coreRoot, registryPath = null, registryLabel = registryPath, staged = false }) {
  const problems = [],
    notes = [];
  const add = (reason, detail) => problems.push({ reason, detail });
  const rel = SHIPPED_TARGET,
    relSide = `skills/bonsai-garden-mark/.${FILE_NAME}.bonsaisig`;
  const readNow = (r) =>
    staged
      ? gitShow(coreRoot, `:${r}`)
      : fs.existsSync(path.join(coreRoot, r))
        ? fs.readFileSync(path.join(coreRoot, r))
        : null;
  const cur = readNow(rel);
  const head = gitShow(coreRoot, `HEAD:${rel}`);

  // the skill marks are checked whether or not a set has shipped: a typed mark is refused by name
  let skills = [];
  try {
    skills = skillMarks(coreRoot);
  } catch (e) {
    if (e instanceof Refusal) add(e.reason, e.detail);
    else throw e;
  }

  if (cur === null) {
    if (head !== null || everShipped(coreRoot, rel)) add(R.LEFT, `${rel} has left core; the set only grows`);
    else
      notes.push(
        `no ${FILE_NAME} has shipped in this core yet: nothing to compare (the first generation is the origin's to run and Mori-shin's to seal)`,
      );
    return { problems, notes };
  }
  let data = null;
  try {
    data = JSON.parse(cur.toString('utf8'));
  } catch {
    add(R.FORMAT, 'not JSON');
  }
  if (data !== null) {
    for (const p of shapeProblems(data)) add(p.reason, p.detail);
    const sets = toSets(data);
    for (const p of floorProblems(sets)) add(p.reason, p.detail);
    if (!problems.length && cur.toString('utf8') !== serialize(data))
      add(R.FORMAT, 'not the bytes the generator writes (JSON.stringify(obj, null, 2) + "\\n")');
    // only grows
    if (head !== null) {
      let was = null;
      try {
        was = toSets(JSON.parse(head.toString('utf8')));
      } catch {
        was = null;
      }
      if (was)
        for (const s of SETS) for (const i of was[s]) if (!sets[s].has(i)) add(R.LEFT, `${s} lost ${i} ${chars([i])}`);
    }
    // B and the wildcard derive from the rule's constants alone: anything more must have shipped
    {
      let was = null;
      try {
        was = head ? toSets(JSON.parse(head.toString('utf8'))) : null;
      } catch {
        was = null;
      }
      const c = constants();
      for (const [s, base] of [
        ['B', c.B],
        ['wildcard', c.wildcard],
      ])
        for (const i of sets[s]) {
          if (!base.includes(i) && !was?.[s].has(i))
            add(R.HAND, `${s} holds ${i} ${chars([i])}, which no source derives and which never shipped`);
        }
    }
    // core's own skill marks
    for (const sk of skills)
      if (!sets.A.has(sk.index))
        add(
          R.STALE,
          `${sk.file}: ${sk.mark}'s first kanji ${chars([sk.index])} (${sk.index}) is not in A; regenerate in core`,
        );
    // the roster, when given
    if (registryPath) {
      let roster = null;
      try {
        roster = rosterMarks(registryPath, registryLabel);
      } catch (e) {
        if (e instanceof Refusal) add(e.reason, e.detail);
        else throw e;
      }
      if (roster) {
        for (const r of roster)
          if (r.index !== null && !sets.A.has(r.index))
            add(R.STALE, `${r.slug}'s first kanji ${chars([r.index])} (${r.index}) is not in A; regenerate in core`);
        let was = null;
        try {
          was = head ? toSets(JSON.parse(head.toString('utf8'))) : null;
        } catch {
          was = null;
        }
        const derivedA = new Set([
          ...roster.filter((r) => r.index !== null).map((r) => r.index),
          ...skills.map((s) => s.index),
        ]);
        for (const i of sets.A) {
          if (!derivedA.has(i) && !was?.A.has(i))
            add(R.HAND, `A holds ${i} ${chars([i])}, which no source derives and which never shipped`);
        }
      }
    }
  }
  // the seal's hash
  const side = readNow(relSide);
  const sp = sealProblem(cur, side === null ? null : side.toString('utf8'));
  if (!sp.data) add(sp.reason, sp.detail);
  return { problems, notes };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

/** The core checkout this file sits in, found by marker: the root whose skills/bonsai-garden-mark is HERE. */
export function coreRootOf(here = HERE) {
  const me = fs.realpathSync(here);
  for (let d = path.dirname(me); ; d = path.dirname(d)) {
    try {
      if (fs.realpathSync(path.join(d, 'skills', 'bonsai-garden-mark')) === me && fs.existsSync(path.join(d, '.git')))
        return d;
    } catch {
      /* no */
    }
    if (path.dirname(d) === d) return null;
  }
}

function opts(a) {
  const o = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) {
      o._.push(a[i]);
      continue;
    }
    const k = a[i].slice(2);
    if (k === 'staged') {
      o.staged = true;
      continue;
    }
    if (!['registry', 'out'].includes(k)) {
      const e = new Error(`unknown flag --${k}`);
      e.exit = 64;
      throw e;
    }
    if (a[i + 1] === undefined) {
      const e = new Error(`--${k} needs a value`);
      e.exit = 64;
      throw e;
    }
    o[k] = a[++i];
  }
  return o;
}

const USAGE =
  'usage: reserved-marks.mjs generate --registry <path> [--out <file>] | check [--registry <path>] [--staged]';

async function main(argv) {
  const [verb, ...rest] = argv;
  if (verb === '--help' || verb === '-h') {
    console.log(`${USAGE}  (see the header of this file)`);
    return 0;
  }
  const o = opts(rest);
  const coreRoot = coreRootOf();
  if (!coreRoot) {
    const e = new Error('no core checkout above this file (generate and check run in core; the reader needs none)');
    e.exit = 2;
    throw e;
  }
  if (verb === 'generate') {
    if (!o.registry) {
      const e = new Error("generate needs --registry <the origin's agents/registry.json>; it has no default");
      e.exit = 64;
      throw e;
    }
    const g = generate({ registryPath: o.registry, registryLabel: o.registry, coreRoot });
    const out = o.out ? path.resolve(o.out) : SHIPPED;
    fs.writeFileSync(out, g.text);
    console.log('index  kanji  set       source');
    for (const s of SETS)
      for (const [i, lines] of [...g.src[s].entries()].sort((x, y) => x[0] - y[0])) {
        if (s === 'A' && i === 0) continue;
        for (const [n, line] of lines.entries())
          console.log(
            n === 0 ? `${String(i).padEnd(6)} ${chars([i])}     ${s.padEnd(9)} ${line}` : `${''.padEnd(25)} ${line}`,
          );
      }
    for (const n of g.notes) console.log(`  note: ${n}`);
    console.log(`\nwildcard ${g.obj.wildcard.length} · A ${g.obj.A.length} · B ${g.obj.B.length}`);
    console.log(
      `wrote ${out}  sha256 ${createHash('sha256').update(g.text).digest('hex')}  (unsealed: the owner reviews this list and seals it)`,
    );
    return 0;
  }
  if (verb === 'check') {
    const r = check({
      coreRoot,
      registryPath: o.registry || null,
      registryLabel: o.registry || null,
      staged: !!o.staged,
    });
    for (const n of r.notes) console.log(`  · ${n}`);
    for (const p of r.problems) console.log(`  ✗ ${p.reason}: ${p.detail}`);
    console.log(
      r.problems.length
        ? `FAIL — ${r.problems.length} problem(s) with ${SHIPPED_TARGET}`
        : `ok — ${SHIPPED_TARGET}${o.registry ? ' (with the roster)' : ''}`,
    );
    return r.problems.length ? 1 : 0;
  }
  const e = new Error(USAGE);
  e.exit = 64;
  throw e;
}

const direct = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (direct) {
  main(process.argv.slice(2)).then(
    (c) => {
      process.exitCode = c;
    },
    (e) => {
      const tag = e.exit === 64 ? 'usage' : e.exit === 3 ? 'halt' : 'refused';
      console.error(`${tag}: ${e.message}`);
      process.exitCode = e.exit || 2;
    },
  );
}
