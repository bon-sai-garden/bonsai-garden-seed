// ---
// id: 01M4TC82FVSX5P7ABPSXC3495K
// title: The lens gate's logic: verdict, ledger, digests, brief, as pure functions
// type: script
// tended-by: bonsai
// created: 2026-10-13
// updated: 2026-10-13
// ---
// The lens gate's logic, as pure functions. Nothing here reads a model, a network or a key.
// A reader produces readings (JSON); this decides what they add up to, and refuses what is malformed.
// Fail closed: a missing lens, a duplicate, a number outside 0..100 or a verdict letter that is not
// s/c/n is a refusal that names it, never a partial verdict and never an "ok".
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute, join } from 'node:path';

export const ROSTER = ['zensai', 'tasai', 'baisai', 'hissai', 'eisai']; // Jisai brings no lens (the gardener, 2026-10-10)
export const BAR = 76; // lowest lens must reach it (the gardener, 2026-10-13: "reset to 76 for now")
export const MARGIN = 5; // "give or take (+5/-5). your ruling": the guardian may move the bar this far, with a reason
export const SPREAD_SIGNAL = 10; // spread is signal, never a verdict
export const QUESTIONS = ['fit', 'safety', 'soil'];
const LETTERS = new Set(['s', 'c', 'n']); // solid · with conditions · not solid

export class Refused extends Error {}

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

export function validateReadings(doc, roster = ROSTER) {
  if (!doc || typeof doc !== 'object') throw new Refused('readings: not an object');
  if (typeof doc.subject !== 'string' || !doc.subject.trim()) throw new Refused('readings: no subject');
  if (!Array.isArray(doc.readings)) throw new Refused('readings: no readings array');
  const seen = new Map();
  for (const r of doc.readings) {
    const who = r?.lens;
    if (!roster.includes(who))
      throw new Refused(`readings: ${JSON.stringify(who)} is not a lens of this gate (${roster.join(', ')})`);
    if (seen.has(who)) throw new Refused(`readings: ${who} appears twice`);
    if (!Number.isInteger(r.number) || r.number < 0 || r.number > 100)
      throw new Refused(`readings: ${who} number ${JSON.stringify(r.number)} is not a whole number from 0 to 100`);
    for (const q of QUESTIONS)
      if (!LETTERS.has(r[q])) throw new Refused(`readings: ${who} ${q} is ${JSON.stringify(r[q])}, not s, c or n`);
    if (
      r.findings !== undefined &&
      (!Array.isArray(r.findings) || r.findings.some((t) => typeof t !== 'string' || !t.trim()))
    )
      throw new Refused(`readings: ${who} findings must be a list of sentences`);
    if (r.blocking !== undefined && (!Array.isArray(r.blocking) || r.blocking.some((b) => typeof b !== 'string' || !b)))
      throw new Refused(`readings: ${who} blocking must be a list of flag names`);
    const conds = r.conditions ?? [];
    if (!Array.isArray(conds) || conds.some((c) => !c || typeof c.text !== 'string' || !c.text.trim()))
      throw new Refused(`readings: ${who} has a condition with no text`);
    if (QUESTIONS.some((q) => r[q] === 'c') && conds.length === 0)
      throw new Refused(`readings: ${who} answers "with conditions" and names none`);
    seen.set(who, r);
  }
  const missing = roster.filter((l) => !seen.has(l));
  if (missing.length)
    throw new Refused(`readings: no reading from ${missing.join(', ')} — a gate with a lens missing is not a gate`);
  return roster.map((l) => seen.get(l));
}

export function verdict(
  doc,
  { labPreview = false, barShift = 0, barReason = null, ruling = null, ruledBy = null, acknowledge = [] } = {},
) {
  const rs = validateReadings(doc);
  if (!Number.isInteger(barShift) || Math.abs(barShift) > MARGIN)
    throw new Refused(
      `bar: a shift of ${JSON.stringify(barShift)} is outside the guardian's margin of ${MARGIN} either way`,
    );
  if (barShift !== 0 && (!barReason || !norm(barReason)))
    throw new Refused('bar: a moved bar needs its reason in words');
  const bar = BAR + barShift;
  const holds = [];
  for (const r of rs) {
    if (r.safety === 'n') holds.push(`unsafe@${r.lens}`);
    for (const q of ['fit', 'soil']) if (r[q] === 'n') holds.push(`not-solid:${q}@${r.lens}`); // a number cannot outvote a "not solid"
    for (const b of r.blocking ?? []) holds.push(`blocking:${b}@${r.lens}`);
  }
  const below = rs.filter((r) => r.number < bar).map((r) => r.lens);
  const base = holds.length ? 'held' : below.length ? 'does-not-clear' : 'clears';
  const nums = rs.map((r) => r.number);
  const lowest = rs.reduce((a, r) => (r.number < a.number ? r : a), rs[0]);
  // The record carries findings and conditions, never a number (the gardener, 2026-10-13: "no number recording, but
  // findings and conditions"). The numbers decide here and go no further; `working` is for the screen at the gate only.
  const out = {
    subject: doc.subject,
    mode: labPreview ? 'lab-preview' : 'garden',
    status: base,
    base,
    bar: barShift === 0 ? 'as set' : { moved: barShift > 0 ? 'raised' : 'lowered', reason: norm(barReason) },
    lowest: lowest.lens,
    spreadSignal: Math.max(...nums) - Math.min(...nums) >= SPREAD_SIGNAL,
    holds,
    below,
    letters: Object.fromEntries(rs.map((r) => [r.lens, QUESTIONS.map((q) => r[q]).join('')])),
    findings: rs.flatMap((r) => (r.findings ?? []).map((t) => ({ lens: r.lens, text: norm(t) }))),
    conditions: rs.flatMap((r) => (r.conditions ?? []).map((c) => ({ lens: r.lens, text: c.text }))),
    ruling: null,
  };
  Object.defineProperty(out, 'working', {
    enumerable: false,
    value: {
      bar,
      numbers: Object.fromEntries(rs.map((r) => [r.lens, r.number])),
      spread: Math.max(...nums) - Math.min(...nums),
    },
  });
  if (ruling !== null) {
    if (base === 'clears') {
      out.ruling = { note: 'not needed: the readings clear on their own' };
      return out;
    }
    if (!norm(ruling)) throw new Refused('ruling: no words');
    if (!ruledBy || !norm(ruledBy)) throw new Refused('ruling: no one named as ruling');
    const unack = holds.filter((h) => !acknowledge.includes(h));
    if (unack.length)
      throw new Refused(`ruling: does not acknowledge ${unack.join(', ')} — name each hold it passes over`);
    out.status = 'passed-on-ruling'; // the base verdict is never rewritten: the record says it, and who ruled
    out.ruling = { by: norm(ruledBy), words: norm(ruling), acknowledged: acknowledge };
  }
  return out;
}

// --- the conditions ledger: what the script CAN say after an edit (the words are there), never what it means ---------
export function ledgerCheck(ledger, root) {
  if (!ledger || !Array.isArray(ledger.conditions)) throw new Refused('ledger: no conditions array');
  const results = [];
  const ids = new Set();
  for (const c of ledger.conditions) {
    if (!c.id || ids.has(c.id))
      throw new Refused(`ledger: condition id ${JSON.stringify(c.id)} is missing or repeated`);
    ids.add(c.id);
    if (!c.check) {
      results.push({ id: c.id, state: 'needs-reader' });
      continue;
    }
    const { file, contains = [], notContains = [] } = c.check;
    if (!file || contains.length + notContains.length === 0)
      throw new Refused(`ledger: ${c.id} has a check that asserts nothing`);
    const abs = resolve(root, file);
    const rel = relative(resolve(root), abs);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Refused(`ledger: ${c.id} names a file outside the root`);
    if (!existsSync(abs)) {
      results.push({ id: c.id, state: 'missing', why: `no file ${file}` });
      continue;
    }
    const text = norm(readFileSync(abs, 'utf8'));
    const lacks = contains.filter((s) => !text.includes(norm(s)));
    const has = notContains.filter((s) => text.includes(norm(s)));
    results.push(
      lacks.length || has.length
        ? {
            id: c.id,
            state: 'missing',
            why: [...lacks.map((s) => `lacks "${s}"`), ...has.map((s) => `still has "${s}"`)].join('; '),
          }
        : { id: c.id, state: 'present' },
    );
  }
  const n = (s) => results.filter((r) => r.state === s).length;
  return {
    total: results.length,
    present: n('present'),
    missing: n('missing'),
    needsReader: n('needs-reader'),
    results,
    note: 'present means the words are there, not that the condition is met in meaning; a reader still decides that',
  };
}

// --- the digests: five compact lenses, each pinned to the lens file it was cut from -------------------------------------
const DIGEST_FIELDS = ['lens', 'owner', 'vantage', 'sees', 'always', 'lean', 'silentWhen', 'weights', 'source'];

export function loadDigests(dir, roster = ROSTER) {
  const out = {};
  for (const f of readdirSync(dir)
    .filter((x) => x.endsWith('.lens.json'))
    .sort()) {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const k of DIGEST_FIELDS) if (d[k] === undefined || d[k] === '') throw new Refused(`digest ${f}: no ${k}`);
    if (!roster.includes(d.lens)) throw new Refused(`digest ${f}: ${d.lens} is not a lens of this gate`);
    if (`${d.lens}.lens.json` !== f) throw new Refused(`digest ${f}: names lens ${d.lens}`);
    if (!Array.isArray(d.sees) || d.sees.length === 0) throw new Refused(`digest ${f}: sees is empty`);
    if (!d.source.version) throw new Refused(`digest ${f}: source needs a version`);
    if (d.source.path !== undefined)
      throw new Refused(
        `digest ${f}: carries a source path — a digest names what it was cut from by version and hash, never by a path into someone's garden`,
      );
    out[d.lens] = d;
  }
  const missing = roster.filter((l) => !out[l]);
  if (missing.length) throw new Refused(`digests: none for ${missing.join(', ')}`);
  return roster.map((l) => out[l]);
}

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// Where each owner keeps their lens is the owning garden's business, so it comes from the caller as a map
// {lens: path}, never from the digest: a path in a shipped file would point into a garden the reader does not have.
function sourceOf(map, root, lens) {
  const rel = map?.[lens];
  return rel ? resolve(root ?? '.', rel) : null;
}

export function digestCheck(dir, sourceMap = null, root = null) {
  const res = loadDigests(dir).map((d) => {
    if (!sourceMap)
      return { lens: d.lens, state: 'not-checked', why: 'no source map given: the digest is the shipped form' };
    const p = sourceOf(sourceMap, root, d.lens);
    if (!p) return { lens: d.lens, state: 'source-missing', why: 'the source map names no file for this lens' };
    if (!existsSync(p)) return { lens: d.lens, state: 'source-missing', why: sourceMap[d.lens] };
    if (!d.source.sha256) return { lens: d.lens, state: 'unpinned', why: 'no sha256 in the digest' };
    return sha(p) === d.source.sha256
      ? { lens: d.lens, state: 'ok' }
      : { lens: d.lens, state: 'drifted', why: `${sourceMap[d.lens]} changed since this digest was cut` };
  });
  return { results: res, ok: res.every((r) => r.state === 'ok' || r.state === 'not-checked') };
}

export function pinDigests(dir, sourceMap, root = null) {
  const done = [];
  for (const d of loadDigests(dir)) {
    const p = sourceOf(sourceMap, root, d.lens);
    if (!p || !existsSync(p)) throw new Refused(`pin: no source file for ${d.lens}`);
    d.source.sha256 = sha(p);
    writeFileSync(join(dir, `${d.lens}.lens.json`), `${JSON.stringify(d, null, 2)}\n`);
    done.push(d.lens);
  }
  return done;
}

// --- the single-reader brief: one reader, five digests, the draft once --------------------------------------------------
export function brief({ digests, draft, dossier = null, openConditions = [], mode = 'single' }) {
  const L = [];
  L.push(
    `# Lens gate brief (${mode})`,
    '',
    'Three questions, asked once of the draft, from five vantages. Not asked: whether each statement is sourced, and nothing about who the principal or any child is by name.',
    '1. **fit**: does what the roster carries match the role and the strategic north?',
    '2. **safety**: is it a morally safe choice, for the one it serves and for anyone outside the room?',
    '3. **soil**: is it solid ground to grow from: coherent, routes that exist, nothing borrowed that cannot be kept?',
    '',
    'Answer each question with s (solid), c (with conditions) or n (not solid). A c names its conditions; an n is not outvoted by a number.',
    'Give each lens its findings (what it saw, in a sentence each) and one number 0..100 with its own deductions. The number is used at the gate and is not kept in the record; the findings and conditions are. The bar is held at the gate, never by a lens.',
    '',
    `Read the draft once: ${draft}${dossier ? `; dossier: ${dossier}` : ''}.`,
    '',
  );
  if (mode === 'delta') {
    L.push(
      'This is a delta reading: judge only whether each open condition below is met in meaning by the edit. Do not re-read the whole draft for new conditions unless an edit introduced one.',
      '',
      ...openConditions.map((c) => `- ${c.id} (${[].concat(c.lens ?? []).join(', ')}): ${c.text}`),
      '',
    );
  }
  for (const d of digests) {
    L.push(
      `## ${d.lens} — ${d.vantage}`,
      'Sees:',
      ...d.sees.map((s) => `- ${s}`),
      'Always raised, never tuned away:',
      ...d.always.map((s) => `- ${s}`),
      `Lean (a bias to name, not to trust): ${d.lean}`,
      `Silent when: ${d.silentWhen}`,
      `Deductions: ${d.weights}`,
      '',
    );
  }
  L.push('## Output', 'JSON only, in the shape of `lens-gate template`: one reading per lens, no lens omitted.');
  return L.join('\n');
}

export function template(subject = '<subject>') {
  return {
    subject,
    readings: ROSTER.map((lens) => ({
      lens,
      number: 0,
      fit: 's',
      safety: 's',
      soil: 's',
      blocking: [],
      findings: [],
      conditions: [],
    })),
  };
}
