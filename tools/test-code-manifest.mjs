#!/usr/bin/env node
// ---
// id: 01M5DV0D6RMXDDNN1KTPJ06GE1
// title: test-code-manifest.mjs — the code manifest maps every tracked sealed code file to its seal's id, and its drift gate bites
// type: script
// tended-by: baisai
// created: 2026-10-21
// updated: 2026-10-21
// ---
//
// A throwaway git checkout, files sealed by a throwaway key (test-fake-origin.mjs): no kin's key, no salt, no network.
//   node tools/test-code-manifest.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sealWith, throwawaySigner } from '../skills/bonsai-garden-mark/test-fake-origin.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(HERE, 'code-manifest.mjs');
const SIGN_LIB = path.join(HERE, '..', 'skills', 'bonsai-garden-sign', 'lib');
const ids = execFileSync('python3', [path.join(HERE, 'ulid.py'), 'new', '-n', '6'], { encoding: 'utf8' })
  .trim()
  .split('\n');

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${ok || !detail ? '' : ` — ${detail}`}`);
};
const run = (...args) => {
  const r = spawnSync('node', [TOOL, ...args], { encoding: 'utf8' });
  return { rc: r.status, out: `${r.stdout}${r.stderr}` };
};

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'code-manifest-'));
process.on('exit', () => fs.rmSync(T, { recursive: true, force: true }));
const R = path.join(T, 'checkout');
fs.mkdirSync(path.join(R, 'tools'), { recursive: true });
execFileSync('git', ['init', '-q', R]);
const k = throwawaySigner('fixkin');
const put = async (rel, text, { seal = true } = {}) => {
  const f = path.join(R, ...rel.split('/'));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
  let id = null;
  if (seal) id = (await sealWith(SIGN_LIB, f, k, { target: rel })).data.id;
  execFileSync('git', ['-C', R, 'add', '-f', '--', rel]);
  return { f, id };
};
const sidecar = (f) => path.join(path.dirname(f), `.${path.basename(f)}.bonsaisig`);
const manifest = () => JSON.parse(fs.readFileSync(path.join(R, 'CODE-MANIFEST.json'), 'utf8'));

console.log('the map: tracked, sealed, code');
const a = await put('tools/a.py', `# ---\n# id: ${ids[0]}\n# ---\nprint("a")\n`);
const b = await put('tools/b.sh', `#!/bin/sh\n# ---\n# id: ${ids[1]}\n# ---\necho b\n`);
await put('tools/data.json', '{"not": "code"}\n');
await put('tools/loose.py', 'print("unsealed")\n', { seal: false });
let r = run('write', '--root', R);
check('write answers ok', r.rc === 0, r.out);
const m = manifest();
check(
  'the map lists the two sealed code files, with the ids their seals carry, and nothing else',
  JSON.stringify(m.files) ===
    JSON.stringify([
      { path: 'tools/a.py', id: a.id },
      { path: 'tools/b.sh', id: b.id },
    ]),
  JSON.stringify(m.files),
);
check('… in its own format', m.format === 'bonsai-garden-code-manifest/1', m.format);
r = run('check', '--root', R);
check('the drift gate passes on the map just written', r.rc === 0 && r.out.startsWith('ok'), r.out);

console.log('the drift gate');
const e = await put('tools/e.mjs', `// ---\n// id: ${ids[2]}\n// ---\nconsole.log('e');\n`);
r = run('check', '--root', R);
check(
  'a sealed code file added and tracked: drift, named',
  r.rc === 1 && r.out.includes('not in the map: tools/e.mjs'),
  r.out,
);
run('write', '--root', R);
check(
  '… written again, it is mapped',
  manifest().files.some((x) => x.path === 'tools/e.mjs' && x.id === e.id),
);
// another sealed document, with its own sidecar, put in a.py's place: the attack the map exists for
fs.copyFileSync(b.f, a.f);
fs.copyFileSync(sidecar(b.f), sidecar(a.f));
r = run('check', '--root', R);
check(
  "another sealed document in a.py's place: drift, naming the id the map holds and the one the seal there carries",
  r.rc === 1 && r.out.includes(`tools/a.py: the map says ${a.id}, the seal there says ${b.id}`),
  r.out,
);
run('write', '--root', R);
execFileSync('git', ['-C', R, 'rm', '-q', '--cached', '--', 'tools/e.mjs']);
r = run('check', '--root', R);
check(
  'a mapped file no longer tracked: drift, named',
  r.rc === 1 && r.out.includes('in the map, not in the tree: tools/e.mjs'),
  r.out,
);
run('write', '--root', R);
fs.writeFileSync(path.join(R, 'CODE-MANIFEST.json'), `${JSON.stringify(manifest())}\n`);
r = run('check', '--root', R);
check('the same entries written by hand, another way: drift (the file is generated, never edited)', r.rc === 1, r.out);
run('write', '--root', R);

console.log('refusals');
fs.copyFileSync(sidecar(b.f), path.join(path.dirname(b.f), `${path.basename(b.f)}.bonsaisig`));
r = run('write', '--root', R);
check(
  'two sidecars beside one file: write refuses, naming it',
  r.rc === 1 && r.out.includes('tools/b.sh: two sidecars'),
  r.out,
);
r = run('check', '--root', T);
check('a directory that is not a git checkout: refused', r.rc === 2, r.out);
fs.rmSync(path.join(R, 'CODE-MANIFEST.json'));
fs.rmSync(path.join(path.dirname(b.f), `${path.basename(b.f)}.bonsaisig`));
r = run('check', '--root', R);
check('no map at all: the drift gate fails, never passes', r.rc === 1 && r.out.includes('missing'), r.out);

console.log(fail ? `\nFAIL — ${fail} of ${pass + fail}` : `\nall ${pass} hold`);
process.exit(fail ? 1 : 0);
