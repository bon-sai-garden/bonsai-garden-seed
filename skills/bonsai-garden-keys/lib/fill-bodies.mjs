// ---
// id: 01M4Z27XFGZ0DF36A46J6JP3X3
// title: fill-bodies — planting 7c: the outcome written into the bodies, and its --check, the drift gate before every seal
// type: script
// tended-by: baisai
// created: 2026-10-15
// updated: 2026-10-20
// ---
//
// fill-bodies.mjs — the verb behind `keys.mjs fill-bodies --pot <dir> --choices <choices.json> [--check]`
// (Bonsai's spec, planting 7c, 2026-10-15). After 6.8 (derive, seed, status) and 7b (the bodies assembled),
// before 7g (conformance) and 7h (the seal). The gardener, 2026-10-12: the outcome is *written in*, not
// pointed at; copies typed by hand drift, so these are generated, and --check is the gate that says so.
//
// Inputs, and only these: the pot's agents/registry.json as `seed` wrote it (slug, kanji, fp8, fingerprint,
// fp-attests, custody-tier, parent; the origin's entry with origin: true and vouched), the pot's garden.json
// as `id`, `mint` and `namespace` wrote it (garden, name, gardener, namespace.kanji, custody-tier,
// lab-preview, root-fingerprint), and the choices file 7a wrote: { garden: <ULID>, kin: { <slug>: { name,
// pronouns, accent, one-line, tagline, line, memory, portrait, displayed-pair, version, previous-version,
// pending-removal } } }. No garden, gardener or kin slug is named in this file: a body is any registry
// entry whose `path` holds a SKILL.md, and the origin is whichever entry says origin: true.
//
// Fill: {{planting.<key>}} tokens in every text file of a body; `version:` in the frontmatter of SKILL.md
// and references/about-me.md, both from the kin's one chosen version; the registry's display fields
// (name, pronouns, accent-rgba, one-line, tagline) as a second seed accepts them; identity/.pending
// removed only where derive put the keys on file AND the choices say pending-removal: yes. What it wrote
// is read from a hash of the pot before and after, never from what it meant to write. No seal is written:
// it prints the seal-staged line for exactly the files that changed. Never touches custody.
//
// --check: ten properties of the pot as a whole (C1–C10), every failing file:line named, exit 1. Carried testimony
// (F-21 of dry run #4) is another's words in a body: a witness page, a feedstock CV, the heritage page, or any file
// that names its source with `copied-from:`. C2, C3 and C8 read the owner's own voice only; C10 holds what they
// read past to its provenance. The gardener's three rulings, 2026-10-20, are the spec: a witness's pronouns are the
// witness's; ancestors in another garden, or witnesses with no fingerprint, never block; history is not a gap.
// Exit 2 (refused, nothing written): no registry, no garden.json, a choices file for another garden, an
// unknown token, a key-field disagreement, a body naming the origin's fingerprint with no vouched origin.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { P, jsonText, keyOnFile, fpIndices } from './garden.mjs';
import { RANK } from './custody.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WORDS_FILE = path.join(SKILL, 'references', 'planting-stale-words.json');
const KANJI_SET = path.join(SKILL, '..', 'bonsai-garden-mark', 'kanji-1024-v1.2.json');

/** The spec's token keys, and no others: anything else after {{planting. is refused (2). */
export const TOKEN_KEYS = Object.freeze([
  'slug',
  'name',
  'id-kanji',
  'displayed-pair',
  'fingerprint',
  'fp8',
  'fp-attests',
  'fp-spells',
  'custody-tier',
  'garden-name',
  'namespace',
  'gardener',
  'version',
  'pronouns',
  'accent',
  'one-line',
  'line',
  'parent',
]);
const TOKEN_RE = /\{\{planting\.([^{}\s]*)\}\}/g;
const TOKEN_OPEN = '{{planting.';
/** seed's KEY_FIELDS (bin/keys.mjs cmdSeed), and the two it derives from them: fill never writes these. */
const KEY_FIELDS = [
  'slug',
  'type',
  'fingerprint',
  'fp-attests',
  'custody-tier',
  'parent',
  'origin',
  'path',
  'fp8',
  'kanji',
];
/** The display fields seed leaves null and a second seed accepts filled (runbook 7f). */
const DISPLAY = ['name', 'pronouns', 'accent-rgba', 'one-line', 'tagline'];
/** The origin garden's registry writes every accent at this alpha (rgba(r,g,b,0.35)); a pot's registry is in its shape. */
const ACCENT_ALPHA = 0.35;
const VERSION_RE = /^\d+\.\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?$/;
const HEX32 = /(?<![0-9a-fA-F])[0-9a-fA-F]{32}(?![0-9a-fA-F])/g;
const HEX8 = /(?<![0-9A-Za-z])[0-9a-fA-F]{8}(?![0-9A-Za-z])/g;
const BESIDE = 24; // "beside": within this many characters on the same line
const HAN_RUN = /\p{Script=Han}{2,}/u;
const FP_WORD = /(?<![A-Za-z0-9])fp8?(?![A-Za-z0-9])/i;
const INTEGRITY = '> **Integrity first.**';
/** A line of base64 only (a vCard's PHOTO, folded): data, not words; every text check reads past it. */
const B64_LINE = /^[A-Za-z0-9+/=]{60,}$/;

const rel = (pot, abs) => path.relative(pot, abs).split(path.sep).join('/');

/**
 * Carried testimony, by place: where a body keeps another kin's words (a witness page, a CV seen from outside) and its
 * lineage (the heritage page, whose ancestors may live in another garden). A file anywhere else is carried when it
 * says so itself, with `copied-from:`. Paths are a body's own (`base`).
 */
export const CARRIED_DIRS = Object.freeze(['references/witness/', 'references/feedstock/']);
export const CARRIED_FILES = Object.freeze(['references/heritage.html']);
const carriedByPlace = (base) => CARRIED_DIRS.some((d) => base.startsWith(d)) || CARRIED_FILES.includes(base);
/** Where a carried file says it came from: a frontmatter `copied-from:`, or an HTML `<meta name="copied-from">`. */
export function copiedFrom(text) {
  const lines = linesOf(text),
    r = fmRange(lines);
  if (r)
    for (let i = r[0]; i < r[1]; i++) {
      const m = /^copied-from:\s*(.*?)\s*$/.exec(lines[i]);
      if (m) return m[1].replace(/^(['"])(.*)\1$/, '$2').trim() || null;
    }
  const meta = /<meta\s+name=["']copied-from["']\s+content=["']([^"']*)["']/i.exec(text);
  return meta ? meta[1].trim() || null : null;
}
const carried = (f) => carriedByPlace(f.base) || copiedFrom(f.text) !== null;
/** A body's files in its owner's own voice: everything but carried testimony. */
const ownVoice = (b) => b.files.filter((f) => !carried(f));
/** A changelog keeps its history: by name, or by its frontmatter `type: changelog` (C2 and C4 read it the same way). */
const isChangelog = (f) =>
  path.basename(f.base) === 'changelog.md' || /^type:\s*changelog\s*$/m.test(f.text.split(/\r?\n---/)[0]);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole-word, case-insensitive; a space in the entry matches any whitespace. Letters, digits and _ bound a word. */
const wordRe = (w) =>
  new RegExp(`(?<![\\p{L}\\p{N}_])${w.trim().split(/\s+/).map(esc).join('\\s+')}(?![\\p{L}\\p{N}_])`, 'iu');
/** A slug or name named in prose: a hyphen binds it too, so `bonsai` is not named by `bonsai-shin`. */
const nameRe = (w) => new RegExp(`(?<![\\p{L}\\p{N}_-])${esc(w)}(?![\\p{L}\\p{N}_-])`, 'iu');
const yes = (v) => v === 'yes' || v === true;
const present = (v) => v !== null && v !== undefined && v !== '';

function readJsonOr(file, refuse, what) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw refuse(`${what} cannot be read as JSON (${e.message.split('\n')[0]}); nothing written`);
  }
}

/** Every file under `dir`, relative to it; `.git` at the top is skipped. */
function walk(dir, { skipDot = false } = {}) {
  const out = [];
  const go = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (d === dir && e.name === '.git') continue;
      if (skipDot && e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) go(p);
      else if (e.isFile()) out.push(p);
    }
  };
  if (fs.existsSync(dir)) go(dir);
  return out.sort();
}

/** sha256 of every file in the pot: the before and after the report is read from. */
function snapshot(pot) {
  const m = new Map();
  for (const f of walk(pot)) m.set(rel(pot, f), crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'));
  return m;
}

/** UTF-8 text, or null for bytes (a NUL, or not valid UTF-8) and base64 files. */
function textOf(abs) {
  if (abs.endsWith('.b64')) return null;
  const buf = fs.readFileSync(abs);
  if (buf.includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return null;
  }
}

const linesOf = (text) => text.split(/\r?\n/);
function* scan(lines) {
  for (let i = 0; i < lines.length; i++) if (!B64_LINE.test(lines[i].trim())) yield [i + 1, lines[i]];
}

// ── frontmatter versions ─────────────────────────────────────────────────────

/** [start, end) line indices of the YAML block at byte 0, or null. */
function fmRange(lines) {
  if (lines[0] !== '---') return null;
  for (let i = 1; i < lines.length; i++) if (lines[i] === '---') return [1, i];
  return null;
}
/** Every top-level `version:` in the frontmatter, as [line number, value]. */
function versionsOf(text) {
  const lines = linesOf(text),
    r = fmRange(lines);
  if (!r) return null;
  const out = [];
  for (let i = r[0]; i < r[1]; i++) {
    const m = /^version:\s*(.*?)\s*$/.exec(lines[i]);
    if (m) out.push([i + 1, m[1].replace(/^(['"])(.*)\1$/, '$2')]);
  }
  return out;
}
/** The text with every frontmatter `version:` set to v (one added before the closing --- if none); null without frontmatter. */
function withVersion(text, v) {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = linesOf(text),
    r = fmRange(lines);
  if (!r) return null;
  let found = false;
  for (let i = r[0]; i < r[1]; i++)
    if (/^version:/.test(lines[i])) {
      lines[i] = `version: ${v}`;
      found = true;
    }
  if (!found) lines.splice(r[1], 0, `version: ${v}`);
  return lines.join(nl);
}

// ── the model: what the pot and the choices say ──────────────────────────────

function load(ctx, { refuse, usage }) {
  const { pot, f } = ctx;
  if (!f.choices)
    throw usage('fill-bodies --pot <dir> --choices <choices.json> [--check]: the choices file 7a wrote is required');
  const reg = readJsonOr(P.registry(pot), refuse, 'agents/registry.json');
  if (!reg) throw refuse(`no agents/registry.json in ${pot}: run derive and seed first (6.8); nothing written`);
  if (!Array.isArray(reg.agents))
    throw refuse('agents/registry.json has no agents list; it is not the shape seed writes; nothing written');
  const g = readJsonOr(P.garden(pot), refuse, 'garden.json');
  if (!g) throw refuse(`no garden.json in ${pot}: run id first; nothing written`);
  let choices;
  try {
    choices = JSON.parse(fs.readFileSync(path.resolve(f.choices), 'utf8'));
  } catch (e) {
    throw refuse(`${f.choices} cannot be read as a choices file (${e.code || 'not JSON'}); nothing written`);
  }
  if (!choices || typeof choices !== 'object' || choices.garden !== g.garden) {
    throw refuse(
      `the choices file names garden ${choices?.garden}, and this pot is garden ${g.garden}: a choices file for another garden is refused; nothing written`,
    );
  }
  if (!choices.kin || typeof choices.kin !== 'object' || Array.isArray(choices.kin))
    throw refuse('the choices file has no `kin` object (slug → choices); nothing written');
  const words = JSON.parse(fs.readFileSync(WORDS_FILE, 'utf8'));
  const set = JSON.parse(fs.readFileSync(KANJI_SET, 'utf8')).kanji;

  // key fields: the registry against the garden, the keys on file and the choices. Any disagreement refuses.
  const bad = [];
  for (const k of ['garden'])
    if (present(reg[k]) && reg[k] !== g.garden)
      bad.push(`the registry names garden ${reg[k]}, garden.json ${g.garden}`);
  if (reg._meta && present(reg._meta.garden) && reg._meta.garden !== g.garden)
    bad.push(`the registry's _meta names garden ${reg._meta.garden}, garden.json ${g.garden}`);
  const bySlug = new Map();
  for (const a of reg.agents) {
    if (!a || typeof a.slug !== 'string') {
      bad.push('a registry entry with no slug');
      continue;
    }
    if (bySlug.has(a.slug)) bad.push(`${a.slug} is in the registry twice`);
    bySlug.set(a.slug, a);
    if (typeof a.fingerprint !== 'string' || !/^[0-9a-f]{32}$/.test(a.fingerprint)) {
      bad.push(`${a.slug}: fingerprint is not 32 hex`);
      continue;
    }
    if (present(a.fp8) && a.fp8 !== a.fingerprint.slice(0, 8))
      bad.push(`${a.slug}: fp8 ${a.fp8} is not its fingerprint's first eight (${a.fingerprint.slice(0, 8)})`);
    const on = keyOnFile(pot, a.slug);
    if (on && on.fingerprint !== a.fingerprint)
      bad.push(`${a.slug}: the key on file is ${on.fingerprint}, the registry says ${a.fingerprint}`);
    if (typeof a.path === 'string' && (path.isAbsolute(a.path) || a.path.split('/').includes('..')))
      bad.push(`${a.slug}: path ${a.path} leaves the pot`);
  }
  for (const [slug, c] of Object.entries(choices.kin)) {
    const a = bySlug.get(slug);
    if (!a) {
      bad.push(`the choices name ${slug}, whom this pot's registry does not list`);
      continue;
    }
    if (!c || typeof c !== 'object') {
      bad.push(`the choices for ${slug} are not an object`);
      continue;
    }
    for (const k of KEY_FIELDS)
      if (k in c && JSON.stringify(c[k] ?? null) !== JSON.stringify(a[k] ?? null))
        bad.push(`${slug}: the choices say ${k} ${JSON.stringify(c[k])}, the registry ${JSON.stringify(a[k] ?? null)}`);
  }
  if (bad.length)
    throw refuse(
      `key-field disagreement, and fill-bodies never writes a key field: ${bad.join('; ')}; nothing written`,
    );

  const originEntry = reg.agents.find((a) => a.origin === true) || null;
  const origin = originEntry
    ? { entry: originEntry, vouched: typeof originEntry.vouched === 'string' && originEntry.vouched !== '' }
    : null;
  const bodies = [];
  for (const a of reg.agents) {
    if (typeof a.path !== 'string') continue;
    const dir = path.join(pot, a.path);
    if (!fs.existsSync(path.join(dir, 'SKILL.md'))) continue;
    const files = [];
    for (const abs of walk(dir, { skipDot: true })) {
      const text = textOf(abs);
      if (text !== null)
        files.push({ abs, rel: rel(pot, abs), text, base: path.relative(dir, abs).split(path.sep).join('/') });
    }
    bodies.push({ entry: a, dir, files, choice: choices.kin[a.slug] || null });
  }
  const regText = fs.readFileSync(P.registry(pot), 'utf8');
  return { pot, g, reg, regText, choices, words, set, bySlug, origin, bodies };
}

/** The value each token takes in `b`'s body; undefined where the inputs hold none. */
function values(M, b) {
  const a = b.entry,
    c = b.choice || {},
    g = M.g;
  const n = Number(a['fp-attests']) || 0;
  const ns = g.namespace && typeof g.namespace === 'object' ? g.namespace.kanji : g.namespace;
  const v = {
    slug: a.slug,
    name: c.name ?? a.name,
    'id-kanji': a.kanji,
    'displayed-pair': c['displayed-pair'],
    fingerprint: a.fingerprint,
    fp8: a.fp8 ?? a.fingerprint.slice(0, 8),
    'fp-attests': a['fp-attests'],
    'fp-spells': n
      ? fpIndices(a.fingerprint, n)
          .map((i) => M.set[i].char)
          .join('')
      : undefined,
    'custody-tier': a['custody-tier'],
    'garden-name': g.name,
    namespace: ns,
    gardener: g.gardener,
    version: c.version,
    pronouns: c.pronouns ?? a.pronouns,
    accent: c.accent ? normHex(c.accent) : undefined,
    'one-line': c['one-line'] ?? a['one-line'],
    line: c.line,
    parent: a.parent,
  };
  for (const k of Object.keys(v)) if (!present(v[k])) v[k] = undefined;
  return v;
}

const normHex = (h) => {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(h));
  return m ? `#${m[1].toLowerCase()}` : null;
};
const rgbaOf = (h) => {
  const x = normHex(h).slice(1);
  return `rgba(${parseInt(x.slice(0, 2), 16)},${parseInt(x.slice(2, 4), 16)},${parseInt(x.slice(4, 6), 16)},${ACCENT_ALPHA})`;
};

/** Unknown tokens anywhere in a body: refused (2), each named. */
function unknownTokens(M) {
  const out = [];
  for (const b of M.bodies)
    for (const f of b.files) {
      for (const [n, line] of scan(linesOf(f.text)))
        for (const m of line.matchAll(TOKEN_RE))
          if (!TOKEN_KEYS.includes(m[1])) out.push(`${f.rel}:${n} {{planting.${m[1]}}}`);
    }
  return out;
}

/** Bodies naming the origin's key while the registry holds no vouched origin entry: refused (2). */
function unvouchedOrigin(M, texts) {
  if (!M.origin || M.origin.vouched) return [];
  const o = M.origin.entry,
    fp8 = o.fp8 ?? o.fingerprint.slice(0, 8),
    out = [];
  for (const { rel: r, text } of texts) {
    for (const [n, line] of scan(linesOf(text))) {
      for (const m of line.matchAll(HEX32)) if (m[0].toLowerCase() === o.fingerprint) out.push(`${r}:${n}`);
      for (const m of line.matchAll(HEX8))
        if (m[0].toLowerCase() === fp8 && beside(line, m.index, 8)) out.push(`${r}:${n}`);
    }
  }
  return out;
}

function beside(line, at, len) {
  const w = line.slice(Math.max(0, at - BESIDE), at + len + BESIDE);
  return HAN_RUN.test(w) || FP_WORD.test(w);
}

// ── fill ─────────────────────────────────────────────────────────────────────

function plan(M, { refuse }) {
  const problems = [],
    writes = new Map(),
    deletes = [];
  for (const b of M.bodies) {
    const slug = b.entry.slug;
    if (!b.choice) {
      problems.push(`${slug}'s body is in this pot and the choices give nothing for ${slug}`);
      continue;
    }
    const ver = b.choice.version;
    if (!present(ver) || !VERSION_RE.test(String(ver))) {
      problems.push(
        `${slug}: the choices give no version (MAJOR.MINOR.PATCH[.BUILD][-LABEL]), or not one: ${JSON.stringify(ver)}`,
      );
      continue;
    }
    if (present(b.choice['previous-version']) && String(b.choice['previous-version']) === String(ver))
      problems.push(`${slug}: previous-version and version are both ${ver}`);
    if (present(b.choice.accent) && !normHex(b.choice.accent))
      problems.push(`${slug}: accent ${JSON.stringify(b.choice.accent)} is not a hex colour (#rrggbb)`);
    if (present(b.choice.memory) && !['initial', 'skeleton'].includes(b.choice.memory))
      problems.push(`${slug}: memory is initial or skeleton, not ${JSON.stringify(b.choice.memory)}`);
    if (present(b.choice.portrait) && !['reuse', 'redraw', 'brief'].includes(b.choice.portrait))
      problems.push(`${slug}: portrait is reuse, redraw or brief, not ${JSON.stringify(b.choice.portrait)}`);
    const v = values(M, b);
    for (const f of b.files) {
      let text = f.text.replace(TOKEN_RE, (all, k) => {
        if (v[k] === undefined) {
          problems.push(
            `${f.rel}: {{planting.${k}}} has no value for ${slug} in the registry, garden.json or the choices`,
          );
          return all;
        }
        return String(v[k]);
      });
      if (f.base === 'SKILL.md' || f.base === 'references/about-me.md') {
        const t = withVersion(text, ver);
        if (t === null) problems.push(`${f.rel}: no frontmatter to carry the version`);
        else text = t;
      }
      if (text !== f.text) writes.set(f.abs, text);
    }
    const pend = path.join(P.idDir(M.pot, slug), '.pending');
    if (fs.existsSync(pend) && keyOnFile(M.pot, slug) && yes(b.choice['pending-removal'])) {
      deletes.push(pend);
      const side = path.join(path.dirname(pend), '..pending.bonsaisig'); // its seal, if it had one: nothing left to cover
      if (fs.existsSync(side)) deletes.push(side);
    }
  }
  // the registry's display fields, from the choices; key fields are never touched
  const reg = JSON.parse(M.regText);
  let regChanged = false;
  for (const [slug, c] of Object.entries(M.choices.kin)) {
    const a = reg.agents.find((x) => x.slug === slug);
    const want = {
      name: c.name,
      pronouns: c.pronouns,
      'accent-rgba': present(c.accent) && normHex(c.accent) ? rgbaOf(c.accent) : undefined,
      'one-line': c['one-line'],
      tagline: c.tagline,
    };
    for (const k of DISPLAY)
      if (present(want[k]) && a[k] !== want[k]) {
        a[k] = want[k];
        regChanged = true;
      }
  }
  if (regChanged) writes.set(P.registry(M.pot), jsonText(reg));
  if (problems.length) throw refuse(`${problems.join('; ')}; nothing written`);
  // every body file as it will read once written: a planted origin key is refused before a byte moves
  const origin = unvouchedOrigin(
    M,
    bodyFiles(M).map((f) => ({ rel: f.rel, text: writes.has(f.abs) ? writes.get(f.abs) : f.text })),
  );
  if (origin.length)
    throw refuse(
      `a body names the origin's fingerprint, and the registry's origin entry is not vouched (run seed --bonsai-entry): ${origin.join(', ')}; nothing written`,
    );
  return { writes, deletes };
}

function fill(M, ctx, h) {
  const unknown = unknownTokens(M);
  if (unknown.length)
    throw h.refuse(`unknown token(s), the keys are ${TOKEN_KEYS.join(', ')}: ${unknown.join(', ')}; nothing written`);
  const { writes, deletes } = plan(M, h);
  const before = snapshot(M.pot);
  for (const [abs, text] of writes) fs.writeFileSync(abs, text);
  for (const abs of deletes) fs.rmSync(abs);
  const after = snapshot(M.pot);
  const wrote = [...after]
    .filter(([r, x]) => before.get(r) !== x)
    .map(([r]) => r)
    .sort();
  const gone = [...before.keys()].filter((r) => !after.has(r)).sort();
  if (!wrote.length && !gone.length) {
    console.log(
      'fill-bodies: nothing changed; every body already holds its outcome (the pot hashes the same before and after)',
    );
    return;
  }
  console.log(
    `fill-bodies: ${wrote.length} written · ${gone.length} deleted   (read from a hash of the pot before and after)`,
  );
  for (const r of wrote) console.log(`  wrote   ${r}`);
  for (const r of gone) console.log(`  deleted ${r}   (the gardener's yes: pending-removal, and the keys on file)`);
  // who seals what (runbook 7h): a body's files by its own kin, the registry by the root; anything else by the gardener
  const owner = (r) => {
    const b = M.bodies.find((x) => r.startsWith(`${x.entry.path.replace(/\/$/, '')}/`));
    return b ? b.entry.slug : r === 'agents/registry.json' ? M.g.name : '<you>';
  };
  const groups = new Map();
  for (const r of wrote) {
    const o = owner(r);
    if (!groups.has(o)) groups.set(o, []);
    groups.get(o).push(r);
  }
  const bin = path.relative(process.cwd(), h.keysBin) || 'keys.mjs';
  console.log(`next: git -C ${M.pot} add -- ${[...wrote, ...gone].join(' ')}`);
  for (const [o, rs] of groups)
    console.log(`  then  node ${bin} seal-staged --pot ${M.pot} --as ${o} -- ${rs.join(' ')}`);
  console.log(`  and   node ${bin} fill-bodies --check --pot ${M.pot} --choices ${ctx.f.choices}   (before the seal)`);
}

// ── --check: C1–C9 ───────────────────────────────────────────────────────────

/** The registry's line for `slug`'s entry (its "slug": line), for file:line. */
function regLine(M, slug) {
  const i = linesOf(M.regText).findIndex((l) => l.includes(`"slug": ${JSON.stringify(slug)}`));
  return i < 0 ? 1 : i + 1;
}
const regFile = (M) => ({ rel: 'agents/registry.json', text: M.regText });
const bodyFiles = (M) => M.bodies.flatMap((b) => b.files);

export const CHECKS = {
  C1(M, out) {
    // no token left
    for (const f of [...bodyFiles(M), regFile(M)]) {
      for (const [n, line] of scan(linesOf(f.text)))
        if (line.includes(TOKEN_OPEN))
          out(f.rel, n, `a token left: ${line.slice(line.indexOf(TOKEN_OPEN)).slice(0, 40)}`);
    }
  },
  C2(M, out) {
    // no stale planting word (the shipped list), in the owner's own voice: carried testimony and history are not gaps
    const res = M.words['stale-words'].map((w) => [w, wordRe(w)]);
    for (const f of M.bodies.flatMap(ownVoice).filter((x) => !isChangelog(x)))
      for (const [n, line] of scan(linesOf(f.text))) {
        for (const [w, re] of res) if (re.test(line)) out(f.rel, n, `a word a planting makes stale: "${w}"`);
      }
  },
  C3(M, out) {
    // every fingerprint is this garden's
    const ok = new Set(M.reg.agents.filter((a) => !a.origin).map((a) => a.fingerprint));
    if (M.g['root-fingerprint']) ok.add(M.g['root-fingerprint']);
    if (M.origin?.vouched) ok.add(M.origin.entry.fingerprint);
    const fp8 = (a) => a.fp8 ?? a.fingerprint.slice(0, 8);
    for (const b of M.bodies)
      for (const f of ownVoice(b)) {
        // carried testimony is read past: its ancestors may live in another garden, or carry no fingerprint (C10 holds it)
        const named = M.reg.agents.filter(
          (a) =>
            a === b.entry ||
            [a.slug, a.name].some((x) => present(x) && nameRe(String(x)).test(f.text)) ||
            (present(a.kanji) && f.text.includes(a.kanji)),
        );
        const allowed8 = new Set(named.filter((a) => !a.origin || M.origin.vouched).map(fp8));
        for (const [n, line] of scan(linesOf(f.text))) {
          for (const m of line.matchAll(HEX32))
            if (!ok.has(m[0].toLowerCase()))
              out(f.rel, n, `${m[0]} is no fingerprint of this garden's registry, nor the vouched origin's`);
          for (const m of line.matchAll(HEX8)) {
            if (!beside(line, m.index, 8) || allowed8.has(m[0].toLowerCase())) continue;
            out(
              f.rel,
              n,
              `${m[0]}, beside a kanji ID or fp, is not the fp8 of ${b.entry.slug} or of a kin this file names`,
            );
          }
        }
      }
  },
  C4(M, out) {
    // one version, and none of the last one left
    for (const b of M.bodies) {
      const skill = b.files.find((f) => f.base === 'SKILL.md'),
        about = b.files.find((f) => f.base === 'references/about-me.md');
      const sv = skill ? versionsOf(skill.text) || [] : [];
      if (!about) {
        out(
          skill ? skill.rel : b.entry.path,
          sv.length ? sv[0][0] : 1,
          'no references/about-me.md beside SKILL.md to carry the same version',
        );
      } else {
        const av = versionsOf(about.text) || [];
        const all = [...sv.map((x) => ['SKILL.md', ...x]), ...av.map((x) => ['about-me.md', ...x])];
        const distinct = new Set(all.map((x) => x[2]));
        if (!sv.length) out(skill.rel, 1, 'SKILL.md carries no version');
        if (!av.length) out(about.rel, 1, 'about-me.md carries no version');
        if (distinct.size > 1)
          out(
            about.rel,
            av.length ? av[0][0] : 1,
            `SKILL.md and about-me.md disagree: ${all.map((x) => `${x[0]}:${x[1]} ${x[2]}`).join(', ')}`,
          );
      }
      const prev = b.choice?.['previous-version'];
      if (!present(prev)) continue;
      const re = new RegExp(`(?<![\\w.])${esc(String(prev))}(?![\\w-]|\\.\\d)`);
      for (const f of b.files) {
        if (isChangelog(f)) continue; // a changelog keeps its history
        for (const [n, line] of scan(linesOf(f.text)))
          if (re.test(line)) out(f.rel, n, `the previous version ${prev} is still written here`);
      }
    }
  },
  C5(M, out) {
    // lab wording iff lab-preview, both ways
    const lab = M.g['lab-preview'] === true;
    if (!lab) {
      const res = M.words['lab-words'].map((w) => [w, wordRe(w)]);
      for (const f of [...bodyFiles(M), regFile(M)])
        for (const [n, line] of scan(linesOf(f.text))) {
          for (const [w, re] of res)
            if (re.test(line)) out(f.rel, n, `"${w}" in a garden whose garden.json says lab-preview: false`);
        }
      return;
    }
    const re = wordRe(M.words['integrity-rehearsal-word']);
    for (const b of M.bodies) {
      const skill = b.files.find((f) => f.base === 'SKILL.md');
      const lines = linesOf(skill.text);
      const i = lines.findIndex((l) => l.startsWith(INTEGRITY));
      if (i < 0)
        out(
          skill.rel,
          1,
          `lab-preview: true, and this SKILL.md has no integrity line (${INTEGRITY}) to name it a rehearsal's`,
        );
      else if (!re.test(lines[i]))
        out(skill.rel, i + 1, "lab-preview: true, and the integrity line does not name this pass a rehearsal's");
    }
  },
  C6(M, out) {
    // no host path
    const pats = [
      [/(?<![\w.:/-])\/Users\//, '/Users/'],
      [/(?<![\w.:/-])\/home\/[^/\s]+\//, '/home/<x>/'],
      [/(?<![\w.~-])~\//, '~/'],
      [/(?<![A-Za-z0-9])[A-Za-z]:\\/, 'a drive path (C:\\)'],
    ];
    const exp = [process.env.BONSAI_GARDEN, path.resolve(M.pot)].filter((x) => x && path.isAbsolute(x) && x.length > 1);
    for (const f of [...bodyFiles(M), regFile(M)])
      for (const [n, line] of scan(linesOf(f.text))) {
        for (const [re, what] of pats) if (re.test(line)) out(f.rel, n, `a host path: ${what}`);
        for (const x of exp)
          if (line.includes(x)) out(f.rel, n, "a host path: an expanded $BONSAI_GARDEN or the pot's own absolute path");
      }
  },
  C7(M, out) {
    // display fields present
    for (const b of M.bodies)
      for (const k of ['one-line', 'accent-rgba', 'name', 'pronouns']) {
        if (!present(b.entry[k]))
          out(
            'agents/registry.json',
            regLine(M, b.entry.slug),
            `${b.entry.slug} has a body and their registry ${k} is null${k === 'one-line' ? " (the greeting's subtitle)" : k === 'pronouns' ? ' (a kin is never "it": not yet known is they/them)' : ''}`,
          );
      }
  },
  C8(M, out) {
    // body ↔ registry
    const tiers = Object.keys(RANK);
    const gt = M.g['custody-tier'];
    for (const a of M.reg.agents) {
      if (a.origin) continue; // the origin's key is held in the origin's own garden, at that garden's tier
      // an entry that claims no tier (a kin of another garden the gardener listed by hand) has none to differ
      if (present(gt) && present(a['custody-tier']) && a['custody-tier'] !== gt)
        out(
          'agents/registry.json',
          regLine(M, a.slug),
          `${a.slug}'s custody-tier ${a['custody-tier']} is not garden.json's ${gt}`,
        );
    }
    for (const b of M.bodies) {
      const a = b.entry;
      // the owner's own voice only: a witness page says "my pronouns are" of the witness, not of this kin
      for (const f of ownVoice(b))
        for (const [n, line] of scan(linesOf(f.text))) {
          if (line.includes(TOKEN_OPEN)) continue; // C1's
          for (const [field, value] of labelled(line)) {
            if (field === 'id') {
              const k = (HAN_RUN.exec(value) || [])[0];
              if (k && k !== a.kanji)
                out(f.rel, n, `the ID written here, ${k}, is not ${a.slug}'s registry kanji ${a.kanji}`);
            } else if (field === 'fingerprint') {
              const x = (value.match(/[0-9a-fA-F]{32}/) || [])[0];
              if (x && x.toLowerCase() !== a.fingerprint)
                out(f.rel, n, `the fingerprint written here, ${x}, is not ${a.slug}'s registry fingerprint`);
            } else if (field === 'custody') {
              const t = tiers.find((x) => new RegExp(`(?<![\\w-])${esc(x)}(?![\\w-])`).test(value));
              if (t && t !== a['custody-tier'])
                out(
                  f.rel,
                  n,
                  `the custody tier written here, ${t}, is not ${a.slug}'s registry custody-tier ${a['custody-tier']}`,
                );
              else if (t && present(gt) && t !== gt)
                out(f.rel, n, `the custody tier written here, ${t}, is not garden.json's ${gt}`);
            } else if (field === 'pronouns') {
              const p = (/[A-Za-z]+\/[A-Za-z]+(?:\/[A-Za-z]+)?/.exec(value) || [])[0];
              // a registry with none is C7's to say, once; here only a body that differs from what it records
              if (p && present(a.pronouns) && p.toLowerCase() !== String(a.pronouns).toLowerCase())
                out(f.rel, n, `the pronouns written here, ${p}, are not ${a.slug}'s registry pronouns ${a.pronouns}`);
            }
          }
        }
    }
  },
  C9(M, out) {
    // .pending gone where it should be
    for (const a of M.reg.agents) {
      const pend = path.join(P.idDir(M.pot, a.slug), '.pending');
      const c = M.choices.kin[a.slug];
      if (fs.existsSync(pend) && keyOnFile(M.pot, a.slug) && c && yes(c['pending-removal']))
        out(rel(M.pot, pend), 1, `${a.slug}'s keys are on file and the gardener said yes to removing it`);
    }
  },
  C10(M, out) {
    // carried testimony names where it came from: C2, C3 and C8 read past it only on its provenance, never on its place
    for (const b of M.bodies)
      for (const f of b.files) {
        if (!carriedByPlace(f.base) || copiedFrom(f.text) !== null) continue;
        out(
          f.rel,
          1,
          `carried testimony that names no source: give it ${f.base.endsWith('.html') ? '<meta name="copied-from" content="<the body it came from>"> in its head' : 'copied-from: <the body it came from> in its frontmatter'}`,
        );
      }
  },
};

/**
 * Where a body writes its own key fields: a table row `| Label | value |`, a `Label: value` line at the margin, or the
 * first-person forms a body uses (*My ID is*, *My pronouns are*, *my fingerprint*, *My key … its fingerprint*).
 * Returns [field, value] pairs; field is id · fingerprint · custody · pronouns.
 */
function labelled(line) {
  const out = [];
  const field = (label) => {
    const l = label
      .trim()
      .replace(/^\*\*|\*\*$/g, '')
      .trim();
    if (/^(ID|Kanji ID|ID kanji|id-kanji)$/.test(l)) return 'id';
    if (/^fingerprint$/i.test(l)) return 'fingerprint';
    if (/^(custody|custody tier|custody-tier)$/i.test(l)) return 'custody';
    if (/^pronouns$/i.test(l)) return 'pronouns';
    return null;
  };
  const row = /^\s*\|([^|]+)\|([^|]+)\|/.exec(line);
  if (row && field(row[1])) out.push([field(row[1]), row[2]]);
  // a `Label: value` line at the margin only: an indented one is a nested record (a lineage's parent block), not this kin's
  const kv = /^(?:[-*]\s+)?(\*\*[^*]+\*\*|[A-Za-z][A-Za-z -]*?)\s*:\s*(.+)$/.exec(line);
  if (!row && kv && field(kv[1])) out.push([field(kv[1]), kv[2]]);
  const id = /\b[Mm]y ID is\s+(.{0,40})/.exec(line);
  if (id) out.push(['id', id[1]]);
  const pronouns = /\bmy pronouns are\s+(\S+)/i.exec(line);
  if (pronouns) out.push(['pronouns', pronouns[1]]);
  // "my fingerprint …" first; failing that, "my key … its fingerprint …"
  const mine = /\bmy (?:key['’]s )?fingerprint\b[^0-9a-fA-F]{0,12}([0-9a-fA-F]{32})/i.exec(line);
  const its =
    !mine && /\bmy key\b/i.test(line) ? /\bits fingerprint\b[^0-9a-fA-F]{0,12}([0-9a-fA-F]{32})/i.exec(line) : null;
  const fingerprint = mine || its;
  if (fingerprint) out.push(['fingerprint', fingerprint[1]]);
  return out;
}

function check(M, h) {
  const unknown = unknownTokens(M);
  if (unknown.length) throw h.refuse(`unknown token(s), the keys are ${TOKEN_KEYS.join(', ')}: ${unknown.join(', ')}`);
  const origin = unvouchedOrigin(M, bodyFiles(M));
  if (origin.length)
    throw h.refuse(
      `a body names the origin's fingerprint, and the registry's origin entry is not vouched (run seed --bonsai-entry): ${origin.join(', ')}`,
    );
  const findings = [];
  for (const [c, fn] of Object.entries(CHECKS))
    fn(M, (file, line, why) => findings.push({ c, at: `${file}:${line}`, why }));
  const seen = new Set();
  const uniq = findings.filter((x) => {
    const k = `${x.c} ${x.at} ${x.why}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  for (const x of uniq) console.log(`  ${x.c}  ${x.at}  ${x.why}`);
  const failing = [...new Set(uniq.map((x) => x.c))];
  console.log(
    `fill-bodies --check: ${M.bodies.length} bod${M.bodies.length === 1 ? 'y' : 'ies'} · ${uniq.length} finding(s)${failing.length ? ` (${failing.join(', ')})` : ''}`,
  );
  if (uniq.length) throw h.drift();
}

/** The verb. `h` carries the binary's exits (refuse 2, halt 3, usage 64, drift 1) and its own path, for the printed line. */
export async function fillBodies(ctx, h) {
  const M = load(ctx, h);
  if (ctx.f.check) return check(M, h);
  return fill(M, ctx, h);
}
