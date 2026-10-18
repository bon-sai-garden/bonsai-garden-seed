// ---
// id: 01M4ZPA9WSCCG7MJNBRZMMMSC9
// title: vanity-three-chain — the Node port held against the shell original, case by case
// type: script
// tended-by: baisai
// created: 2026-10-15
// updated: 2026-10-15
// ---
//
// test-vanity-three-chain.mjs — parity of vanity-three-chain.mjs with vanity-three-chain.sh.
//
// Both drivers run in a throwaway directory against a STUB vanity-three.mjs that records every
// argv it receives, follows a plan (miss N times, then hit; or always miss; or fail with a usage
// code) and writes the same state and result files the real search writes. What is compared, per
// case: the exit code, the sequence of argv the search was called with, and stdout with the
// elapsed-seconds counters masked. The real search is never run: this tests the chain, not the
// search, and a 30-bit search has no place in a test.
//
//   node test-vanity-three-chain.mjs              every case
//   node test-vanity-three-chain.mjs --list
//   node test-vanity-three-chain.mjs --only hit,deadline
//   node test-vanity-three-chain.mjs --watch-fail  run the cases against a mutant of the port that
//                                                  never resumes from the state file; the suite must
//                                                  FAIL on it, or it is not watching anything.
//
// The shell original hardcodes one search (fuji-shin · 富 士 身, four workers, chunk 65,000,000);
// the port is given exactly those as arguments, so the two are asked the same question.
//
// One divergence is asserted, not hidden: on a search exit the chain cannot read as "no hit" (here:
// 64, a usage error), the shell loops until its deadline and exits 3; the port stops at once and
// exits 64. The case `usage-error` pins both numbers.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SH = join(HERE, 'vanity-three-chain.sh');
const MJS = join(HERE, 'vanity-three-chain.mjs');

// The question the shell version asks, verbatim from its own body.
const BASE = 'fuji-shin';
const KANJI = ['富', '士', '身'];
const WORKERS = 4;
const CHUNK = 65000000;

const STUB = String.raw`
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(join(HERE, "plan.json"), "utf8"));
const argv = process.argv.slice(2);
appendFileSync(join(HERE, "calls.log"), JSON.stringify(argv) + "\n");
const arg = (n) => argv[argv.indexOf("--" + n) + 1];
const startN = Number(arg("startN")), chunk = Number(arg("chunk"));
const calls = readFileSync(join(HERE, "calls.log"), "utf8").trim().split("\n").length;
if (plan.sleepMs) { const t = Date.now(); while (Date.now() - t < plan.sleepMs) {} }
console.log("Target: stub");
console.log("Range:  " + startN + " .. " + (startN + chunk));
if (plan.failWith !== undefined) { console.log("stub: failing with " + plan.failWith); process.exit(plan.failWith); }
if (plan.hitOnCall !== undefined && calls >= plan.hitOnCall) {
  writeFileSync(join(HERE, arg("base") + "-three.json"), JSON.stringify({ salt: arg("base") + "#" + startN }));
  console.log("FOUND by stub");
  process.exit(0);
}
writeFileSync(join(HERE, "vanity-three-state.json"), JSON.stringify({ nextStartN: startN + chunk }));
console.log("Chunk exhausted: no hit");
process.exit(2);
`;

const MASK = [
  [/\(\d+s elapsed\)/g, '(Ns elapsed)'],
  [/total elapsed \d+s/g, 'total elapsed Ns'],
];

function fixture(plan, preexisting) {
  const dir = mkdtempSync(join(tmpdir(), 'vanity-chain-'));
  writeFileSync(join(dir, 'vanity-three.mjs'), STUB);
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan));
  writeFileSync(join(dir, 'calls.log'), '');
  if (preexisting) writeFileSync(join(dir, `${BASE}-three.json`), '{}');
  return dir;
}

function mask(s) {
  return MASK.reduce((acc, [re, to]) => acc.replace(re, to), s).replace(/\s+$/, '');
}

function runSh(dir, deadline) {
  cpSync(SH, join(dir, 'vanity-three-chain.sh'));
  const r = spawnSync('bash', [join(dir, 'vanity-three-chain.sh'), String(deadline)], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, CHUNK: String(CHUNK) },
  });
  return { code: r.status, out: mask(r.stdout), calls: readFileSync(join(dir, 'calls.log'), 'utf8') };
}

function runMjs(dir, deadline, port = MJS) {
  const r = spawnSync(
    process.execPath,
    [
      port,
      '--base',
      BASE,
      '--a',
      KANJI[0],
      '--b',
      KANJI[1],
      '--c',
      KANJI[2],
      '--workers',
      String(WORKERS),
      '--chunk',
      String(CHUNK),
      '--deadline',
      String(deadline),
      '--search',
      join(dir, 'vanity-three.mjs'),
    ],
    { cwd: dir, encoding: 'utf8' },
  );
  return { code: r.status, out: mask(r.stdout), calls: readFileSync(join(dir, 'calls.log'), 'utf8') };
}

// Each case: the plan the stub follows, the deadline both drivers get, and what must hold.
const CASES = {
  hit: {
    why: 'two misses then a hit: both resume from the state file and stop at the result',
    plan: { hitOnCall: 3 },
    deadline: 60,
    expect: ({ sh, mjs }) =>
      sameRun(sh, mjs, 0) &&
      sh.calls.split('\n').filter(Boolean).length === 3 &&
      startNs(sh.calls).join(',') === `0,${CHUNK},${2 * CHUNK}`,
  },
  deadline: {
    why: 'misses only, 2 s each, 8 s deadline: both stop with 3 once fewer than 5 s remain',
    plan: { sleepMs: 2000 },
    deadline: 8,
    expect: ({ sh, mjs }) => sameRun(sh, mjs, 3) && startNs(sh.calls).length >= 1,
  },
  'already-found': {
    why: 'the result file is already there: both exit 0 without calling the search',
    plan: { hitOnCall: 1 },
    deadline: 60,
    preexisting: true,
    expect: ({ sh, mjs }) => sameRun(sh, mjs, 0) && sh.calls === '',
  },
  'usage-error': {
    why: 'the search exits 64: the shell loops to its deadline (3), the port stops with 64 after one call',
    plan: { failWith: 64, sleepMs: 500 },
    deadline: 7,
    expect: ({ sh, mjs }) =>
      sh.code === 3 &&
      mjs.code === 64 &&
      mjs.calls.split('\n').filter(Boolean).length === 1 &&
      startNs(sh.calls).length > 1,
  },
};

function startNs(calls) {
  return calls
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const a = JSON.parse(l);
      return a[a.indexOf('--startN') + 1];
    });
}

function sameRun(sh, mjs, code) {
  return sh.code === code && mjs.code === code && sh.calls === mjs.calls && sh.out === mjs.out;
}

function runCase(c, port) {
  const d1 = fixture(c.plan, c.preexisting),
    d2 = fixture(c.plan, c.preexisting);
  try {
    const sh = runSh(d1, c.deadline),
      mjs = runMjs(d2, c.deadline, port);
    const ok = c.expect({ sh, mjs });
    return { ok, sh, mjs };
  } finally {
    rmSync(d1, { recursive: true, force: true });
    rmSync(d2, { recursive: true, force: true });
  }
}

function mutantPort(dir) {
  // The mutant never resumes: every chunk starts at 0. Case `hit` must catch it.
  const src = readFileSync(MJS, 'utf8');
  const mutated = src.replace('const startN = nextStart(stateFile);', 'const startN = 0;');
  if (mutated === src) throw new Error('mutant: the line to break was not found; the test is stale');
  const p = join(dir, 'vanity-three-chain.mutant.mjs');
  writeFileSync(p, mutated);
  return p;
}

function suite(port) {
  const argv = process.argv.slice(2);
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : Object.keys(CASES);
  let failed = 0;
  for (const name of only) {
    const c = CASES[name];
    if (!c) {
      console.error(`no such case: ${name}`);
      process.exit(64);
    }
    const r = runCase(c, port);
    console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(14)} sh=${r.sh.code} mjs=${r.mjs.code}  ${c.why}`);
    if (!r.ok) {
      failed++;
      console.log(`  --- sh stdout ---\n${r.sh.out}\n  --- mjs stdout ---\n${r.mjs.out}`);
      console.log(`  --- sh calls ---\n${r.sh.calls}  --- mjs calls ---\n${r.mjs.calls}`);
    }
  }
  return failed;
}

const argv = process.argv.slice(2);
if (argv.includes('--list')) {
  for (const [n, c] of Object.entries(CASES)) console.log(`${n.padEnd(14)} ${c.why}`);
  process.exit(0);
}
if (!existsSync(SH)) {
  console.error(`shell original not found: ${SH}`);
  process.exit(1);
}

if (argv.includes('--watch-fail')) {
  const dir = mkdtempSync(join(tmpdir(), 'vanity-chain-mutant-'));
  try {
    const failed = suite(mutantPort(dir));
    if (failed === 0) {
      console.log('\nwatch-fail: the suite PASSED on a port that never resumes. It is not a parity test.');
      process.exit(1);
    }
    console.log(`\nwatch-fail: ${failed} case(s) failed on the mutant, as they must.`);
    process.exit(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const failed = suite(MJS);
console.log(failed ? `\n${failed} case(s) FAILED` : '\nparity: every case holds');
process.exit(failed ? 1 : 0);
