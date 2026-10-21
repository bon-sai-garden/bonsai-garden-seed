// ---
// id: 01M5CZKM3JBAZ1D2A76Y494AB3
// title: test-ulid — the keys skill's ulid verb mints ids that pass the garden's own rule, and checks a file's id as ulid.py does
// type: script
// tended-by: baisai
// created: 2026-10-20
// updated: 2026-10-20
// ---
//
// test-ulid.mjs — bin/ulid.mjs (O-5 of dry run #4: a kin in a planted garden mints ids, never types them).
//
//   node skills/bonsai-garden-keys/test-ulid.mjs
//   ULID_BIN=<a copy of bin/ulid.mjs> node ...   run the cases against a mutant, to watch them fail
//
// Every file here is scratch. Where core's tools/ulid.py and a python3 are at hand, `check` is held to it file for
// file: the same verdict on every fixture, so the verb is the master's command line, not a second rule.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { whyBad } from '../bonsai-garden-sign/lib/ulid-rule.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BIN = process.env.ULID_BIN ? path.resolve(process.env.ULID_BIN) : path.join(HERE, 'bin', 'ulid.mjs');
const ULID_PY = path.resolve(HERE, '..', '..', 'tools', 'ulid.py');
const SCRATCH = fs.mkdtempSync(path.join(process.env.KEYS_TEST_TMP || os.tmpdir(), 'ulid-'));

const run = (args) => {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd: SCRATCH, encoding: 'utf8' });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
};
const results = [];
function t(name, fn) {
  let ok = false,
    note = '';
  try {
    [ok, note] = fn();
  } catch (e) {
    note = `threw: ${e.message}`;
  }
  results.push(ok === true);
  console.log(`${ok === true ? 'PASS' : 'FAIL'}  ${name}  — ${note}`);
}
const put = (rel, text) => {
  const f = path.join(SCRATCH, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
  return f;
};
const md = (id) => `---\nid: ${id}\ntitle: "a note"\ntype: note\ncreated: 2026-10-20\n---\n\nwords\n`;

t('new-mints-one-id-that-the-rule-takes', () => {
  const r = run(['new']);
  const lines = r.out.trim().split('\n');
  return [r.code === 0 && lines.length === 1 && whyBad(lines[0]) === null, `${r.code}: ${r.out.trim()}`];
});

t('new-n-mints-that-many-distinct-and-in-order', () => {
  const r = run(['new', '-n', '25']);
  const ids = r.out.trim().split('\n');
  const ok =
    r.code === 0 &&
    ids.length === 25 &&
    ids.every((x) => whyBad(x) === null) &&
    new Set(ids).size === 25 &&
    ids.every((x, i) => i === 0 || ids[i - 1] < x);
  return [ok, `${r.code}: ${ids.length} ids, first ${ids[0]}`];
});

t('new-with-a-count-that-is-not-one-is-usage', () => {
  const a = run(['new', '-n', '0']),
    b = run(['new', '-n', 'many']),
    c = run(['mint']);
  return [a.code === 64 && b.code === 64 && c.code === 64 && !a.out && !b.out, `${a.code} ${b.code} ${c.code}`];
});

const fixtures = () => {
  const good = run(['new']).out.trim();
  return {
    good: put('good.md', md(good)),
    lower: put('lower.md', md(good.toLowerCase())),
    typed: put('typed.md', md('01M5CZKMAAAAAAAAAAAAAAAAAA')), // a typed tail: one character, sixteen times
    noid: put('noid.md', '---\ntitle: "no id"\n---\n\nwords\n'),
    script: put('tool.mjs', `// ---\n// id: ${run(['new']).out.trim()}\n// title: a tool\n// ---\nexport {};\n`),
    skill: put('SKILL.md', '---\nname: x\ndescription: y\nversion: 1.0.0\n---\n# x\n'),
    template: put('template.md', '---\nid: <ULID>\ntemplate: true\ntitle: "a template"\n---\n'),
  };
};

t('check-passes-a-real-id-and-names-each-bad-one-with-its-reason', () => {
  const f = fixtures();
  const ok1 = run(['check', f.good, f.script, f.skill, f.template]);
  const bad = run(['check', f.good, f.lower, f.typed, f.noid]);
  const named = [
    /lower\.md.*lower case/,
    /typed\.md.*(entropy|looks typed)/,
    /noid\.md.*no (id:|header carrying an id)/,
  ].every((re) => re.test(bad.out));
  return [
    ok1.code === 0 && bad.code === 1 && named && /good\.md/.test(bad.out),
    `${ok1.code} ${bad.code}: ${bad.out.trim().split('\n').join(' | ').slice(0, 200)}`,
  ];
});

t('check-of-a-path-that-is-not-there-is-bad-not-silent', () => {
  const r = run(['check', path.join(SCRATCH, 'gone.md')]);
  return [r.code === 1 && /gone\.md/.test(r.out + r.err), `${r.code}: ${(r.out + r.err).trim()}`];
});

t('check-agrees-with-ulid-py-file-for-file', () => {
  const py = spawnSync('python3', ['--version'], { encoding: 'utf8' });
  if (py.status !== 0 || !fs.existsSync(ULID_PY))
    return [true, 'no python3 or no core tools/ulid.py here: not compared'];
  const f = fixtures();
  const verdicts = Object.entries(f).map(([k, file]) => {
    const a = run(['check', file]).code === 0;
    const b = spawnSync('python3', [ULID_PY, 'check', file], { encoding: 'utf8' }).status === 0;
    return [k, a, b];
  });
  const differ = verdicts.filter(([, a, b]) => a !== b);
  return [differ.length === 0, verdicts.map(([k, a, b]) => `${k} ${a ? 'ok' : 'bad'}/${b ? 'ok' : 'bad'}`).join(', ')];
});

const failed = results.filter((x) => !x).length;
console.log(
  `\n${results.length - failed}/${results.length} passed${failed ? ` — ${failed} FAILED` : ''}   (scratch: ${SCRATCH})`,
);
process.exit(failed ? 1 : 0);
