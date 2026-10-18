// ---
// id: 01M4TC82NH9H9X6Y79F2ZKJ2ST
// title: The lens gate's tests: every guard built a case to trip it
// type: script
// tended-by: bonsai
// created: 2026-10-13
// updated: 2026-10-13
// ---
// Run: node --test test/lens-gate.test.mjs
// Every guard here is watched to fail: each refusal and each hold has a case built to trip it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as G from '../lib/gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'bin', 'lens-gate.mjs');
const LENSES = join(HERE, '..', 'lenses');

const reading = (lens, number = 92, over = {}) => ({
  lens,
  number,
  fit: 's',
  safety: 's',
  soil: 's',
  blocking: [],
  conditions: [],
  ...over,
});
const doc = (over = {}, ...replace) => {
  const rs = G.ROSTER.map((l) => reading(l));
  for (const r of replace) rs[G.ROSTER.indexOf(r.lens)] = r;
  return { subject: 'case', readings: rs, ...over };
};
const refuses = (fn, re) =>
  assert.throws(fn, (e) => e instanceof G.Refused && re.test(e.message), `expected a refusal matching ${re}`);
const tmp = () => mkdtempSync(join(tmpdir(), 'lens-gate-'));

test('five lenses at or above the bar clear', () => {
  const v = G.verdict(doc());
  assert.equal(v.status, 'clears');
  assert.equal(v.bar, 'as set');
  assert.equal(G.BAR, 76);
});

test('one lens under the bar does not clear, and names the lens', () => {
  const v = G.verdict(doc({}, reading('hissai', 70, { fit: 'c', conditions: [{ text: 'name the seam' }] })));
  assert.equal(v.status, 'does-not-clear');
  assert.deepEqual(v.below, ['hissai']);
  assert.equal(v.lowest, 'hissai');
});

test('the record carries findings and conditions and no number, anywhere', () => {
  const v = G.verdict(
    doc(
      {},
      reading('hissai', 77, {
        fit: 'c',
        findings: ['he reads as someone now'],
        conditions: [{ text: 'name the seam' }],
      }),
    ),
  );
  assert.deepEqual(v.findings, [{ lens: 'hissai', text: 'he reads as someone now' }]);
  assert.deepEqual(v.conditions, [{ lens: 'hissai', text: 'name the seam' }]);
  const record = JSON.stringify(v);
  assert.ok(!/\d/.test(record.replace(/"subject":"[^"]*"/, '')), `a digit reached the record: ${record}`);
  assert.equal(v.working.numbers.hissai, 77); // at the gate, on request; not enumerable, so never serialized
  refuses(() => G.verdict(doc({}, reading('zensai', 90, { findings: [''] }))), /findings must be/);
});

test("the guardian's margin: the bar moves at most five either way, and only with a reason", () => {
  const at73 = doc({}, reading('zensai', 73, { soil: 'c', conditions: [{ text: 'x' }] }));
  assert.equal(G.verdict(at73).status, 'does-not-clear');
  const v = G.verdict(at73, { barShift: -5, barReason: 'safe and solid; conditions are line edits' });
  assert.equal(v.status, 'clears');
  assert.equal(v.bar.moved, 'lowered');
  assert.equal(
    G.verdict(doc({}, reading('zensai', 80)), { barShift: 5, barReason: 'a child principal' }).status,
    'does-not-clear',
  );
  assert.equal(
    G.verdict(doc({}, reading('zensai', 70, { soil: 'c', conditions: [{ text: 'x' }] })), {
      barShift: -5,
      barReason: 'r',
    }).status,
    'does-not-clear',
  );
  refuses(() => G.verdict(at73, { barShift: -6, barReason: 'r' }), /outside the guardian's margin/);
  refuses(() => G.verdict(at73, { barShift: -5 }), /needs its reason/);
  refuses(() => G.verdict(at73, { barShift: 2.5, barReason: 'r' }), /outside the guardian's margin/);
});

test('a moved bar never passes a hold: safe and solid first', () => {
  const v = G.verdict(doc({}, reading('baisai', 95, { safety: 'n' })), { barShift: -5, barReason: 'r' });
  assert.equal(v.status, 'held');
});

test('a blocking flag holds the gate even at 100', () => {
  const v = G.verdict(doc({}, reading('tasai', 100, { blocking: ['T1'] })));
  assert.equal(v.status, 'held');
  assert.deepEqual(v.holds, ['blocking:T1@tasai']);
});

test('a number cannot outvote "not solid": unsafe, not-solid fit and not-solid soil all hold at 95', () => {
  for (const [q, hold] of [
    ['safety', 'unsafe@baisai'],
    ['fit', 'not-solid:fit@baisai'],
    ['soil', 'not-solid:soil@baisai'],
  ]) {
    const v = G.verdict(doc({}, reading('baisai', 95, { [q]: 'n' })));
    assert.equal(v.status, 'held', q);
    assert.deepEqual(v.holds, [hold]);
  }
});

test('a missing lens, a duplicate and a stranger are refused, each by name', () => {
  const d = doc();
  d.readings = d.readings.filter((r) => r.lens !== 'eisai');
  refuses(() => G.verdict(d), /no reading from eisai/);
  const dup = doc();
  dup.readings.push(reading('zensai'));
  refuses(() => G.verdict(dup), /zensai appears twice/);
  const jisai = doc();
  jisai.readings.push(reading('jisai'));
  refuses(() => G.verdict(jisai), /"jisai" is not a lens/);
});

test('malformed readings are refused: number range and type, letters, c with no conditions, empty condition', () => {
  refuses(() => G.verdict(doc({}, reading('zensai', 101))), /whole number from 0 to 100/);
  refuses(() => G.verdict(doc({}, reading('zensai', '90'))), /whole number from 0 to 100/);
  refuses(() => G.verdict(doc({}, reading('zensai', 88.5))), /whole number from 0 to 100/);
  refuses(() => G.verdict(doc({}, reading('zensai', 90, { fit: 'x' }))), /not s, c or n/);
  refuses(() => G.verdict(doc({}, reading('zensai', 90, { fit: 'c' }))), /names none/);
  refuses(() => G.verdict(doc({}, reading('zensai', 90, { conditions: [{ text: '  ' }] }))), /no text/);
  refuses(() => G.verdict({ readings: [] }), /no subject/);
});

test('spread is a signal, never a verdict', () => {
  const v = G.verdict(doc({}, reading('baisai', 78, { fit: 'c', conditions: [{ text: 'x' }] }), reading('tasai', 95)));
  assert.equal(v.working.spread, 17);
  assert.equal(v.spreadSignal, true);
  assert.equal(G.verdict(doc()).spreadSignal, false);
});

test('a ruling passes a short reading, keeps the base verdict, and says who ruled', () => {
  const d = doc({}, reading('hissai', 60, { fit: 'c', conditions: [{ text: 'x' }] }));
  const v = G.verdict(d, { ruling: 'we use the second reading', ruledBy: 'the gardener' });
  assert.equal(v.status, 'passed-on-ruling');
  assert.equal(v.base, 'does-not-clear');
  assert.equal(v.working.numbers.hissai, 60);
  assert.equal(v.ruling.by, 'the gardener');
});

test('a ruling over a hold must name each hold; one missing is a refusal', () => {
  const d = doc({}, reading('tasai', 95, { blocking: ['T1'] }), reading('baisai', 90, { safety: 'n' }));
  refuses(
    () => G.verdict(d, { ruling: 'go', ruledBy: 'the gardener', acknowledge: ['blocking:T1@tasai'] }),
    /unsafe@baisai/,
  );
  const v = G.verdict(d, {
    ruling: 'go',
    ruledBy: 'the gardener',
    acknowledge: ['blocking:T1@tasai', 'unsafe@baisai'],
  });
  assert.equal(v.status, 'passed-on-ruling');
  assert.equal(v.holds.length, 2);
});

test('a ruling with no words, or with no one named, is refused; on clearing readings it changes nothing', () => {
  const short = doc({}, reading('zensai', 70, { fit: 'c', conditions: [{ text: 'x' }] }));
  refuses(() => G.verdict(short, { ruling: '   ', ruledBy: 'g' }), /no words/);
  refuses(() => G.verdict(short, { ruling: 'ok', ruledBy: '' }), /no one named/);
  const v = G.verdict(doc(), { ruling: 'unneeded', ruledBy: 'g' });
  assert.equal(v.status, 'clears');
  assert.match(v.ruling.note, /not needed/);
});

// --- ledger -----------------------------------------------------------------------------------------------------------
test('ledger: present, missing, needs-reader; a file with the right name and the wrong words is missing', () => {
  const root = tmp();
  mkdirSync(join(root, 'b'));
  writeFileSync(join(root, 'b', 'about-me.md'), 'The   patient hand\nspeaks first. The tree is it.');
  const r = G.ledgerCheck(
    {
      conditions: [
        { id: 'c1', check: { file: 'b/about-me.md', contains: ['The patient hand speaks first'] } },
        { id: 'c2', check: { file: 'b/about-me.md', contains: ['I have no favourite'], notContains: ['she'] } },
        { id: 'c3', check: { file: 'b/about-me.md', notContains: ['The tree is it'] } },
        { id: 'c4', check: { file: 'b/absent.md', contains: ['x'] } },
        { id: 'c5' },
      ],
    },
    root,
  );
  assert.deepEqual(
    r.results.map((x) => x.state),
    ['present', 'missing', 'missing', 'missing', 'needs-reader'],
  );
  assert.equal(r.present, 1);
  assert.equal(r.needsReader, 1);
  rmSync(root, { recursive: true });
});

test('ledger: a check that asserts nothing, a repeated id and a path outside the root are refused', () => {
  const root = tmp();
  refuses(() => G.ledgerCheck({ conditions: [{ id: 'a', check: { file: 'f.md' } }] }, root), /asserts nothing/);
  refuses(() => G.ledgerCheck({ conditions: [{ id: 'a' }, { id: 'a' }] }, root), /repeated/);
  refuses(
    () => G.ledgerCheck({ conditions: [{ id: 'a', check: { file: '../x.md', contains: ['y'] } }] }, root),
    /outside the root/,
  );
  rmSync(root, { recursive: true });
});

// --- digests ----------------------------------------------------------------------------------------------------------
function digestWorld() {
  const root = tmp();
  const lenses = join(root, 'lenses');
  const src = join(root, 'src');
  cpSync(LENSES, lenses, { recursive: true });
  const map = {};
  for (const l of G.loadDigests(lenses)) {
    map[l.lens] = `kept/${l.lens}/lens.md`;
    const p = join(src, map[l.lens]);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `lens ${l.lens}\n`);
  }
  G.pinDigests(lenses, map, src);
  return { root, lenses, src, map };
}

test('digests: pinned and unchanged is ok; a changed source is drifted; a missing one says so', () => {
  const w = digestWorld();
  assert.equal(G.digestCheck(w.lenses, w.map, w.src).ok, true);
  const p = join(w.src, w.map.eisai);
  writeFileSync(p, 'lens eisai\nE7 · a new check\n');
  const r = G.digestCheck(w.lenses, w.map, w.src);
  assert.equal(r.ok, false);
  assert.equal(r.results.find((x) => x.lens === 'eisai').state, 'drifted');
  rmSync(p);
  assert.equal(G.digestCheck(w.lenses, w.map, w.src).results.find((x) => x.lens === 'eisai').state, 'source-missing');
  const { tasai, ...partial } = w.map;
  assert.equal(G.digestCheck(w.lenses, partial, w.src).results.find((x) => x.lens === 'tasai').state, 'source-missing');
  rmSync(w.root, { recursive: true });
});

test('digests: a digest that carries a path into a garden is refused; the shipped ones carry none', () => {
  const w = digestWorld();
  const f = join(w.lenses, 'hissai.lens.json');
  const d = JSON.parse(readFileSync(f, 'utf8'));
  d.source.path = 'home/hissai/working/lens.md';
  writeFileSync(f, JSON.stringify(d));
  refuses(() => G.loadDigests(w.lenses), /carries a source path/);
  for (const x of G.loadDigests(LENSES)) assert.ok(!JSON.stringify(x).includes('home/'), x.lens);
  rmSync(w.root, { recursive: true });
});

test('digests: with no source map the shipped form is "not-checked", never a pass claimed as a check', () => {
  const r = G.digestCheck(LENSES, null);
  assert.ok(r.results.every((x) => x.state === 'not-checked'));
});

test('digests: a missing lens digest is refused, and a digest filed under the wrong name', () => {
  const w = digestWorld();
  rmSync(join(w.lenses, 'tasai.lens.json'));
  refuses(() => G.loadDigests(w.lenses), /none for tasai/);
  writeFileSync(join(w.lenses, 'tasai.lens.json'), readFileSync(join(w.lenses, 'zensai.lens.json')));
  refuses(() => G.loadDigests(w.lenses), /names lens zensai/);
  rmSync(w.root, { recursive: true });
});

test('the shipped digests are complete and each lens says when it is silent', () => {
  for (const d of G.loadDigests(LENSES)) {
    assert.ok(d.silentWhen.length > 10, d.lens);
    assert.ok(d.lean.length > 10, d.lens);
    assert.ok(d.source.sha256, d.lens);
  }
});

// --- the brief --------------------------------------------------------------------------------------------------------
test('the brief carries all five lenses and the not-asked line; a delta brief lists the open conditions', () => {
  const ds = G.loadDigests(LENSES);
  const single = G.brief({ digests: ds, draft: 'd.md' });
  for (const l of G.ROSTER) assert.match(single, new RegExp(`## ${l} `));
  assert.match(single, /Not asked: whether each statement is sourced/);
  const delta = G.brief({
    digests: ds,
    draft: 'd.md',
    mode: 'delta',
    openConditions: [{ id: 'k3', lens: ['tasai'], text: 'son speaks first' }],
  });
  assert.match(delta, /k3 \(tasai\): son speaks first/);
  assert.match(delta, /delta reading/);
});

// --- the command line -------------------------------------------------------------------------------------------------
const run = (...a) => spawnSync('node', [CLI, ...a], { encoding: 'utf8' });
test('cli: exit 0 clears, 1 does not clear, 2 refuses', () => {
  const root = tmp();
  const ok = join(root, 'ok.json');
  writeFileSync(ok, JSON.stringify(doc()));
  const short = join(root, 'short.json');
  writeFileSync(short, JSON.stringify(doc({}, reading('zensai', 60, { fit: 'c', conditions: [{ text: 'x' }] }))));
  const bad = join(root, 'bad.json');
  writeFileSync(bad, JSON.stringify({ subject: 's', readings: [reading('zensai')] }));
  assert.equal(run('verdict', '--readings', ok).status, 0);
  assert.equal(run('verdict', '--readings', short).status, 1);
  const r = run('verdict', '--readings', bad);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /REFUSED/);
  assert.equal(
    run('verdict', '--readings', short, '--ruling', 'second reading stands', '--ruled-by', 'the gardener').status,
    0,
  );
  assert.equal(run('nonsense').status, 2);
  rmSync(root, { recursive: true });
});

test('the bar is inclusive: exactly 76 clears, 75 does not', () => {
  assert.equal(G.verdict(doc({}, reading('zensai', 76))).status, 'clears');
  assert.equal(
    G.verdict(doc({}, reading('zensai', 75, { fit: 'c', conditions: [{ text: 'x' }] }))).status,
    'does-not-clear',
  );
});

test('cli: numbers reach the screen only on request, on stderr, and never the json record', () => {
  const root = tmp();
  const f = join(root, 'r.json');
  writeFileSync(f, JSON.stringify(doc()));
  const plain = run('verdict', '--readings', f, '--json');
  assert.ok(!/92/.test(plain.stdout) && !/92/.test(plain.stderr));
  const shown = run('verdict', '--readings', f, '--json', '--numbers');
  assert.ok(!/92/.test(shown.stdout));
  assert.match(shown.stderr, /not for the record/);
  assert.equal(run('verdict', '--readings', f, '--bar-shift', '-9', '--bar-reason', 'x').status, 2);
  rmSync(root, { recursive: true });
});
