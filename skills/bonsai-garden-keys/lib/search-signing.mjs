// ---
// id: 01M498HD32KVFSGYZQ3T4TSCAA
// title: The signing-salt search, across worker processes
// type: script
// tended-by: baisai
// created: 2026-10-06
// updated: 2026-10-10
// ---
//
// search-signing.mjs — spec-gardeners-keys.md §7.2: `<slug>@<romaji>-sign#<n>` until the derived
// key's fingerprint decodes, at its first n kanji, to the entity's identity pair. n is fp-attests
// (2 today): 2^(10n) tries on average, about 100 µs a derivation, so the work is split.
//
// Processes, not worker threads: on the build host (macOS) worker threads behind an idle main
// thread were throttled to ~1% CPU each (measured 2026-10-06: 3 s of CPU in 300 s of wall), while
// separate processes with busy main threads ran at full speed. The master salt goes to each child
// on its STDIN, never on argv or in the environment, and never comes back: a child answers with
// the salt string and fingerprint it found, which are public.

import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { keyOf, fpIndices } from './garden.mjs';

const SELF = fileURLToPath(import.meta.url);
const FLAG = '--signing-worker';

const defaultWorkers = () =>
  Math.max(1, Math.min(8, (os.availableParallelism ? os.availableParallelism() : os.cpus().length) - 1));

// R2: measure one process's derivation rate for two seconds, here, before any worker starts.
function measureRate(masterHex, base, ms = 2000) {
  const t0 = process.hrtime.bigint(),
    end = t0 + BigInt(ms) * 1_000_000n;
  let i = 0;
  while (process.hrtime.bigint() < end) {
    keyOf(masterHex, `${base}#measure${i++}`);
  }
  return i / (Number(process.hrtime.bigint() - t0) / 1e9);
}

// The words of an estimate, in the walk's voice: seconds under a minute and a half, minutes after, singular where it is one.
const span = (sec) => {
  if (sec < 90) {
    const n = Math.max(1, Math.round(sec));
    return `${n} second${n === 1 ? '' : 's'}`;
  }
  const m = Math.round(sec / 60);
  return `${m} minute${m === 1 ? '' : 's'}`;
};
export function describeEstimate(e) {
  return `signing search: ${Math.round(e.ratePerSec).toLocaleString('en')} derivations a second (${e.measured}); about ${span(e.expectedSeconds)} on this machine, a lottery that can take twice as long; it stops by itself after ${span(e.capSeconds)}.`;
}

// Ends with the hit, null when the bound is spent, or an Error with code SEARCH_CAP when the wall
// clock runs out first. `onEstimate` is called before the work (measured rate, expected seconds, cap)
// and once more from the workers' own aggregate; `onTick` reports elapsed seconds at intervals.
// The cap is three times the expected time, never open-ended (`capSeconds` overrides it); `max`
// stays as the second bound.
export function searchSigning({
  masterHex,
  base,
  want,
  workers = defaultWorkers(),
  max = 200_000_000,
  capSeconds,
  tickMs = 5000,
  onEstimate,
  onTick,
}) {
  const tries = 2 ** (10 * want.length);
  const rate1 = measureRate(masterHex, base);
  const expect0 = tries / (rate1 * workers);
  let cap = capSeconds ?? Math.max(30, 3 * expect0);
  if (onEstimate)
    onEstimate({
      ratePerSec: rate1,
      workers,
      expectedSeconds: expect0,
      capSeconds: cap,
      measured: 'one process, two seconds',
    });
  return new Promise((resolve, reject) => {
    const kids = [];
    let done = false,
      exited = 0,
      reEstimated = false;
    const counts = new Array(workers).fill(0);
    const started = Date.now();
    const finish = (fn) => {
      if (done) return;
      done = true;
      clearInterval(tick);
      clearTimeout(capTimer);
      for (const k of kids) {
        try {
          k.kill('SIGKILL');
        } catch {
          /* gone */
        }
      }
      fn();
    };
    const elapsed = () => (Date.now() - started) / 1000;
    const tick = setInterval(() => {
      if (onTick) onTick({ elapsed: elapsed(), expectedSeconds: expect0 });
    }, tickMs);
    let capTimer = setTimeout(onCap, cap * 1000);
    function onCap() {
      const e = new Error(`the signing search passed its cap of ${Math.round(cap)} s without a hit`);
      e.code = 'SEARCH_CAP';
      finish(() => reject(e));
    }
    for (let w = 0; w < workers; w++) {
      const k = spawn(process.execPath, [SELF, FLAG], { stdio: ['pipe', 'pipe', 'ignore', 'ipc'] });
      kids.push(k);
      let out = '';
      k.stdout.on('data', (d) => {
        out += d;
        for (let nl = out.indexOf('\n'); nl >= 0; nl = out.indexOf('\n')) {
          const line = out.slice(0, nl);
          out = out.slice(nl + 1);
          let msg;
          try {
            msg = JSON.parse(line);
          } catch (e) {
            finish(() => reject(e));
            return;
          }
          if (msg.tried !== undefined) {
            counts[w] = msg.tried;
            // the workers' own aggregate replaces the single-process figure once, after a few seconds:
            // on a machine whose cores are not all free the two differ (spec §7.4, F4)
            if (!reEstimated && elapsed() >= 4 && counts.every((c) => c > 0)) {
              reEstimated = true;
              const agg = counts.reduce((a, b) => a + b, 0) / elapsed();
              const exp = tries / agg;
              if (capSeconds === undefined) {
                cap = Math.max(cap, 3 * exp);
                clearTimeout(capTimer);
                capTimer = setTimeout(onCap, Math.max(0, cap * 1000 - (Date.now() - started)));
              }
              if (onEstimate)
                onEstimate({
                  ratePerSec: agg,
                  workers,
                  expectedSeconds: exp,
                  capSeconds: cap,
                  measured: 'the workers, aggregate',
                });
            }
          } else {
            finish(() => resolve(msg));
            return;
          }
        }
      });
      k.on('error', (e) => finish(() => reject(e)));
      k.on('exit', () => {
        if (++exited === workers) finish(() => resolve(null));
      });
      k.stdin.end(JSON.stringify({ masterHex, base, want, w, W: workers, max }));
    }
  });
}

if (process.argv[2] === FLAG && process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const { masterHex, base, want, w, W, max } = JSON.parse(fs.readFileSync(0, 'utf8'));
  const n = want.length;
  // R1: a worker dies with its parent. The loop is busy, so no event can fire inside it: the parent
  // is checked by hand, every 4096 derivations (about a second at most), against the pid this worker
  // started under; `disconnect` covers the idle moments.
  const parent = process.ppid;
  const orphaned = () => process.ppid !== parent;
  process.on('disconnect', () => process.exit(0));
  let last = Date.now();
  for (let i = w, c = 0; i < max; i += W, c++) {
    if ((c & 4095) === 4095) {
      if (orphaned()) process.exit(0);
      if (Date.now() - last >= 1000) {
        last = Date.now();
        process.stdout.write(`${JSON.stringify({ tried: c })}\n`);
      }
    }
    const salt = `${base}#${i}`;
    const k = keyOf(masterHex, salt);
    const idx = fpIndices(k.fingerprint, n);
    let ok = true;
    for (let j = 0; j < n; j++)
      if (idx[j] !== want[j]) {
        ok = false;
        break;
      }
    if (ok) {
      process.stdout.write(`${JSON.stringify({ salt, fingerprint: k.fingerprint, nonce: i })}\n`);
      break;
    }
  }
}
