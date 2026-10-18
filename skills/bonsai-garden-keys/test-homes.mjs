// ---
// id: 01M4Z2NDFWQBP5N51V6KX7SEVN
// title: homes, tested as properties: every key-holder gets a home, the origin and the garden never, nothing overwritten
// type: script
// tended-by: baisai
// created: 2026-10-15
// updated: 2026-10-15
// ---
//
// test-homes.mjs — lib/homes.mjs. Scratch pots only; no keys are needed (homes write no seals).
//
//   node skills/bonsai-garden-keys/test-homes.mjs
//   HOMES_LIB=<a copy of lib/homes.mjs> node ...   run against a mutant, to watch the cases fail

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ownId } from '../bonsai-garden-sign/lib/ulid-rule.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const H = await import(
  pathToFileURL(process.env.HOMES_LIB ? path.resolve(process.env.HOMES_LIB) : path.join(HERE, 'lib', 'homes.mjs')).href
);
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'homes-'));
const results = [];
function t(name, fn) {
  let ok = false,
    note = '';
  try {
    [ok, note] = fn();
  } catch (e) {
    note = `threw: ${e.message}`;
  }
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  — ${note}`);
}

let n = 0;
const g = { garden: '01M4Z2C0000000000000000000', name: 'fixture-garden', gardener: 'fixture-gardener' };
const reg = {
  agents: [
    { slug: 'fixture-garden', type: 'garden', shintai: 'none' },
    { slug: 'fixture-gardener', type: 'gardener', shintai: 'none' },
    { slug: 'bonsai', type: 'seed', origin: true, shintai: 'origin' },
    { slug: 'bonsai-shin', type: 'shin', shintai: 'own', parent: 'bonsai' },
    { slug: 'fixture-shin', type: 'shin', shintai: 'own', name: 'Fixture Shin' },
  ],
};
const fresh = () => {
  const p = path.join(SCRATCH, `pot${++n}`);
  fs.mkdirSync(p, { recursive: true });
  return p;
};
const has = (pot, rel) => fs.existsSync(path.join(pot, rel));

t('every-key-holder-gets-an-inbox-ledger-and-every-kin-a-working-state', () => {
  const pot = fresh();
  const wrote = H.plantHomes(pot, { reg, g });
  const want = ['fixture-gardener', 'bonsai-shin', 'fixture-shin']
    .map((s) => `home/${s}/inbox/acknowledged.md`)
    .concat(['bonsai-shin', 'fixture-shin'].map((s) => `home/${s}/memory/working-state.md`));
  return [want.every((r) => has(pot, r)) && wrote.length === want.length, `wrote ${wrote.length}: ${wrote.join(', ')}`];
});

t('the-origin-and-the-garden-get-no-home-and-the-gardener-no-working-state', () => {
  const pot = fresh();
  H.plantHomes(pot, { reg, g });
  return [
    !has(pot, 'home/bonsai') && !has(pot, 'home/fixture-garden') && !has(pot, 'home/fixture-gardener/memory'),
    fs.readdirSync(path.join(pot, 'home')).sort().join(', '),
  ];
});

t('each-file-carries-its-own-minted-id-and-names-its-owner', () => {
  const pot = fresh();
  const wrote = H.plantHomes(pot, { reg, g });
  const ids = new Set();
  const bad = wrote.filter((rel) => {
    const buf = fs.readFileSync(path.join(pot, rel));
    const o = ownId(buf, rel);
    ids.add(o.id);
    const owner = rel.split('/')[1];
    return o.problem !== null || !new RegExp(`^tended-by: ${owner}$`, 'm').test(buf.toString());
  });
  return [
    bad.length === 0 && ids.size === wrote.length,
    bad.length ? `bad: ${bad.join(', ')}` : `${ids.size} distinct ids`,
  ];
});

t('nothing-is-ever-overwritten-and-a-second-run-writes-nothing', () => {
  const pot = fresh();
  H.plantHomes(pot, { reg, g });
  const ws = path.join(pot, 'home/fixture-shin/memory/working-state.md');
  fs.appendFileSync(ws, '\nlived line\n');
  const again = H.plantHomes(pot, { reg, g });
  return [again.length === 0 && /lived line/.test(fs.readFileSync(ws, 'utf8')), `second run wrote ${again.length}`];
});

t('no-slug-is-hardcoded-a-garden-with-other-names-gets-its-own-homes', () => {
  const pot = fresh();
  const g2 = { ...g, name: 'other-garden', gardener: 'someone' };
  const reg2 = {
    agents: [
      { slug: 'other-garden', type: 'garden', shintai: 'none' },
      { slug: 'someone', type: 'gardener', shintai: 'none' },
      { slug: 'kin-a', type: 'shin', shintai: 'own' },
    ],
  };
  const wrote = H.plantHomes(pot, { reg: reg2, g: g2 });
  return [
    wrote.join(',') ===
      'home/someone/inbox/acknowledged.md,home/kin-a/inbox/acknowledged.md,home/kin-a/memory/working-state.md',
    wrote.join(', '),
  ];
});

const failed = results.filter((x) => !x).length;
console.log(
  `\n${results.length - failed}/${results.length} passed${failed ? ` — ${failed} FAILED` : ''}   (scratch: ${SCRATCH})`,
);
process.exit(failed ? 1 : 0);
