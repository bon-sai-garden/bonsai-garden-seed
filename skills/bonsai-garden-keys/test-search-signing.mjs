// ---
// id: 01M4KNN3SAWFY5MMBTCK75X2F6
// title: The signing search's workers die with their parent, and the search has a cap and an estimate
// type: script
// tended-by: baisai
// created: 2026-10-10
// updated: 2026-10-10
// ---
//
// test-search-signing.mjs — spec-gardeners-keys.md §7.4, R1 and R2. Watched to fail first.
//
//   node skills/bonsai-garden-keys/test-search-signing.mjs
//
// R1: the parent is killed with SIGKILL while its workers run; every worker must be gone within
//     five seconds. The workers hold the master salt, so a survivor is the salt in a process
//     nobody owns. Throwaway salt only: a fixed test master, never a real one.
// R2: a search with a wall-clock cap ends itself (code SEARCH_CAP) and reports an estimate
//     measured from a real derivation rate before it starts, and elapsed time at intervals.

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = process.env.SEARCH_LIB || path.join(HERE, 'lib', 'search-signing.mjs');
const MASTER = 'ab'.repeat(32); // a throwaway test master, not a salt anyone holds
let fails = 0;
const ok = (c, m) => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
  if (!c) fails++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const pkill = () => spawnSync('pkill', ['-9', '-f', 'signing-worker']);
const kidsOf = (pid) =>
  spawnSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' })
    .stdout.split('\n')
    .filter(Boolean)
    .map(Number);

// ---- R1: kill the parent, count the survivors -------------------------------------------------
{
  const code = `import(${JSON.stringify(LIB)}).then(m => m.searchSigning({ masterHex: ${JSON.stringify(MASTER)}, base: 'x@y-sign', want: [1, 2, 3], workers: 3, max: 200000000 }))`;
  const parent = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: 'ignore' });
  await sleep(2500);
  const kids = kidsOf(parent.pid);
  ok(kids.length === 3, `three workers are running under the parent (saw ${kids.length})`);
  process.kill(parent.pid, 'SIGKILL');
  const t0 = Date.now();
  while (Date.now() - t0 < 5000 && kids.some(alive)) await sleep(250);
  const survivors = kids.filter(alive);
  ok(
    survivors.length === 0,
    `every worker is gone within five seconds of the parent's SIGKILL (survivors: ${survivors.join(',') || 'none'})`,
  );
  for (const p of survivors) {
    try {
      process.kill(p, 'SIGKILL');
    } catch {
      /* gone */
    }
  } // reap what the bug left
}

// ---- R2: cap, estimate, elapsed ---------------------------------------------------------------
{
  // a search with no cap would run to its bound: end the run rather than wait for it
  const dog = setTimeout(() => {
    console.log('FAIL  the capped search did not end within 20 s');
    pkill();
    process.exit(1);
  }, 20000);
  const { searchSigning } = await import(LIB);
  const est = [],
    ticks = [];
  let err = null;
  const t0 = Date.now();
  try {
    await searchSigning({
      masterHex: MASTER,
      base: 'x@y-sign',
      want: [1, 2, 3],
      workers: 2,
      capSeconds: 4,
      tickMs: 1000,
      onEstimate: (e) => est.push(e),
      onTick: (t) => ticks.push(t),
    });
  } catch (e) {
    err = e;
  }
  clearTimeout(dog);
  const took = (Date.now() - t0) / 1000;
  ok(
    err && err.code === 'SEARCH_CAP',
    `a search past its cap ends with code SEARCH_CAP (got ${err && (err.code || err.message)})`,
  );
  ok(took < 9, `and it ends near the cap, not at the bound (took ${took.toFixed(1)} s for a 4 s cap)`);
  ok(
    est.length >= 1 && est[0].ratePerSec > 100 && est[0].expectedSeconds > 0,
    `an estimate is printed before the work, from a measured rate (${est[0] ? `${Math.round(est[0].ratePerSec)}/s` : 'none'})`,
  );
  ok(
    ticks.length >= 2 && ticks[ticks.length - 1].elapsed >= ticks[0].elapsed,
    `elapsed time is reported at intervals (${ticks.length} ticks)`,
  );
}

// ---- the words of the estimate: a unit that is right, a plural that is right, a cap that is the cap --------------
{
  const { describeEstimate } = await import(LIB);
  const w = (expectedSeconds, capSeconds) =>
    describeEstimate({ ratePerSec: 4000, measured: 'one process, two seconds', expectedSeconds, capSeconds });
  const a = w(10, 30),
    b = w(60, 180),
    c = w(300, 900),
    d = w(100, 300);
  ok(
    /about 10 seconds/.test(a) && /after 30 seconds/.test(a) && !/1 minutes/.test(a),
    `seconds under a minute and a half: "${a.slice(a.indexOf('about'))}"`,
  );
  ok(
    /about 60 seconds/.test(b) && /after 3 minutes/.test(b) && !/1 minutes/.test(b),
    `a minute is still said in seconds, its cap in minutes, never "1 minutes": "${b.slice(b.indexOf('about'))}"`,
  );
  ok(
    /about 5 minutes/.test(c) && /after 15 minutes/.test(c),
    `five minutes, a cap of fifteen: "${c.slice(c.indexOf('about'))}"`,
  );
  ok(
    /about 2 minutes/.test(d) && /after 5 minutes/.test(d),
    `100 s reads 2 minutes, its 300 s cap 5: "${d.slice(d.indexOf('about'))}"`,
  );
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
