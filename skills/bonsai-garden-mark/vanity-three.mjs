// ---
// id: 01M3BS43MWXEYQ3S06F6CEF266
// ---
// vanity-three.mjs — 30-bit vanity search for a (A, B, C) target.
//
// Used to lock all three kanji of a 3-character identicon. Roughly 1024×
// slower than a 20-bit (A, B) search. We parallelize across worker threads
// to make the wall time tolerable.
//
// Usage:
//   node vanity-three.mjs --base <prefix> --a <char> --b <char> --c <char>
//
// --base and the three targets are REQUIRED; see USAGE below.
//
// Each worker takes a slice of the nonce space (workerN, workerN+W, workerN+2W,...)
// and races to find a hit. First worker to find one signals the others to stop.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { slice } from './engine.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const USAGE = `
Usage:
  node vanity-three.mjs --base <prefix> --a <kanji> --b <kanji> --c <kanji>
                        [--set kanji-1024-vX.Y.json] [--sep '#'] [--workers 4]
                        [--startN 0] [--chunk 300000000] [--out <file>]

  --base   the string the mark is derived from, e.g. "example-agent"
  --a/b/c  the three kanji to lock, as characters, e.g. --a 山 --b 水 --c 空
  --set    which curated set to search against (default: the highest-numbered
           kanji-1024-v*.json in this directory; .bak files are never used)

There are no defaults for --base or the targets. A vanity search pointed at
someone else's mark by default is a tool that does the wrong thing out of the
box, and this one shipped that way.
`;

function fail(msg) {
  console.error(`${msg}\n`);
  console.error(USAGE.trim());
  // 64 = EX_USAGE. Deliberately NOT 2: the search's own "exhausted this chunk
  // without a hit" path already exits 2, and a caller that cannot tell a typo
  // from an honest miss will treat one as the other.
  process.exit(64);
}

function required(args, name, what) {
  const v = args[name];
  if (v === undefined || v === '') fail(`missing --${name} (${what})`);
  return v;
}

// The kanji set is an ARGUMENT, resolved to the CURRENT set by default — never
// a hardcoded filename. This script shipped reading `kanji-1024-v1.0.json.bak`:
// a superseded set, kept only as a backup. A stranger running it would have
// minted marks against a set the garden no longer uses, silently, and the
// indices would not match anything. Resolve, or fail — do not fall back.
function resolveSet(explicit) {
  if (explicit) {
    const p = join(HERE, explicit);
    if (!existsSync(p)) fail(`kanji set not found: ${explicit}`);
    return p;
  }
  const sets = readdirSync(HERE)
    .filter((f) => /^kanji-1024-v[\d.]+\.json$/.test(f)) // .bak deliberately excluded
    .sort();
  if (!sets.length) fail('no kanji-1024-v*.json set in this directory');
  return join(HERE, sets[sets.length - 1]);
}

// ─── Worker side ───────────────────────────────────────────────────────────
function runWorker() {
  const { base, separator, targetA, targetB, targetC, workerId, workerCount, reportEvery, startN, endN } = workerData;
  const prefixStr = base + separator;
  const prefixBytes = Buffer.from(prefixStr, 'utf8');
  // Pre-compute the SHA-256 state with prefix already absorbed; we'll copy it
  // each iteration and just append the nonce. Roughly 2× speedup at small
  // prefix sizes.
  const prefixHash = createHash('sha256').update(prefixBytes);
  const nonceBuf = Buffer.allocUnsafe(16);
  let n = startN + workerId;
  let last = n;
  const t0 = Date.now();

  while (n < endN) {
    if (n - last >= reportEvery) {
      parentPort.postMessage({ type: 'progress', workerId, attempts: n - startN + 1 });
      last = n;
    }
    const nonceStr = n.toString();
    const nonceLen = nonceStr.length;
    for (let i = 0; i < nonceLen; i++) {
      nonceBuf[i] = nonceStr.charCodeAt(i);
    }
    const h = prefixHash.copy();
    h.update(nonceBuf.subarray(0, nonceLen));
    const d = h.digest();
    const [a, b, c] = slice(d);
    if (a === targetA && b === targetB && c === targetC) {
      parentPort.postMessage({
        type: 'hit',
        workerId,
        nonce: n,
        salt: prefixStr + nonceStr,
        digestHex: d.toString('hex'),
        indices: [a, b, c],
        ms: Date.now() - t0,
      });
      return;
    }
    n += workerCount;
  }
  // exhausted this slice without a hit
  parentPort.postMessage({ type: 'exhausted', workerId, lastN: n });
}

// ─── Main side ─────────────────────────────────────────────────────────────
async function runMain() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(USAGE.trim()); // asked for, so exit 0: 64 is for a search that was not stated in full
    return;
  }
  const args = Object.fromEntries(
    process.argv.slice(2).reduce((acc, val, i, arr) => {
      if (val.startsWith('--')) acc.push([val.slice(2), arr[i + 1]]);
      return acc;
    }, []),
  );

  const base = required(args, 'base', 'the string the mark is derived from');
  const separator = args.sep || '#';
  const targetChars = [
    required(args, 'a', 'first kanji'),
    required(args, 'b', 'second kanji'),
    required(args, 'c', 'third kanji'),
  ];
  const SET_PATH = resolveSet(args.set);
  const workerCount = parseInt(args.workers || '4', 10);
  const reportEvery = parseInt(args.report || '200000', 10);
  const startN = parseInt(args.startN || '0', 10);
  const chunkSize = parseInt(args.chunk || '300000000', 10); // ~40s at 7.5M/s
  const endN = startN + chunkSize;
  const stateFile = args.state || 'vanity-three-state.json';
  const outFile = args.out || `${base}-three.json`;

  const data = JSON.parse(readFileSync(SET_PATH, 'utf8'));
  const byChar = new Map(data.kanji.map((k) => [k.char, k]));
  const targets = targetChars.map((c) => {
    const k = byChar.get(c);
    if (!k) {
      console.error(`Kanji "${c}" not in curated set.`);
      process.exit(1);
    }
    return k;
  });
  const [tA, tB, tC] = targets.map((k) => k.index);

  console.log(`Target: ${targetChars.join('')} → A=#${tA}, B=#${tB}, C=#${tC}`);
  console.log(`Base:   "${base}${separator}<n>"`);
  console.log(
    `Range:  nonces ${startN.toLocaleString()} .. ${endN.toLocaleString()} (chunk ${chunkSize.toLocaleString()})`,
  );
  console.log(`Search space: 2^30 ≈ 1.07B   expected ~1.07B attempts to first hit`);
  console.log(`Workers: ${workerCount}\n`);

  const workers = [];
  const startTime = Date.now();
  const progress = new Array(workerCount).fill(0);

  let done = false;

  function onHit(res) {
    if (done) return;
    done = true;
    const wallMs = Date.now() - startTime;
    console.log(`\n✓ FOUND in ${res.ms.toLocaleString()}ms by worker ${res.workerId}`);
    console.log(`  salt:        ${res.salt}`);
    console.log(`  SHA-256:     ${res.digestHex}`);
    console.log(`  indices:     A=${res.indices[0]}  B=${res.indices[1]}  C=${res.indices[2]}`);
    console.log(`  wall time:   ${(wallMs / 1000).toFixed(1)}s`);
    console.log(`  nonce:       ${res.nonce.toLocaleString()}`);

    for (const w of workers) w.terminate();

    writeFileSync(
      join(HERE, outFile),
      JSON.stringify(
        {
          entity: 'Fuji-shin (3-kanji)',
          kanji_triple: targetChars.join(''),
          kanji_a: { char: targets[0].char, index: targets[0].index, meanings: targets[0].meanings.slice(0, 3) },
          kanji_b: { char: targets[1].char, index: targets[1].index, meanings: targets[1].meanings.slice(0, 3) },
          kanji_c: { char: targets[2].char, index: targets[2].index, meanings: targets[2].meanings.slice(0, 3) },
          salt: res.salt,
          sha256: res.digestHex,
          indices: res.indices,
          nonce: res.nonce,
          search_ms: wallMs,
          workers: workerCount,
        },
        null,
        2,
      ),
      'utf8',
    );
    console.log(`\nWrote fuji-shin-three.json`);
    process.exit(0);
  }

  let lastReport = Date.now();
  function onProgress({ workerId, attempts }) {
    progress[workerId] = attempts;
    const now = Date.now();
    if (now - lastReport > 3000) {
      const total = progress.reduce((s, v) => s + v, 0);
      const wallMs = now - startTime;
      const rate = total / (wallMs / 1000);
      const eta = (1.07e9 - total) / rate;
      const pct = ((total / 1.07e9) * 100).toFixed(1);
      process.stdout.write(
        `  ${total.toLocaleString()} attempts (${pct}%, ${Math.round(rate).toLocaleString()}/s, ETA ${eta > 0 ? `${(eta / 60).toFixed(1)}min` : '...'})       \r`,
      );
      lastReport = now;
    }
  }

  let exhaustedCount = 0;
  function onExhausted() {
    exhaustedCount++;
    if (exhaustedCount === workerCount && !done) {
      done = true;
      const total = progress.reduce((s, v) => s + v, 0);
      const wallMs = Date.now() - startTime;
      console.log(`\nChunk exhausted: ${total.toLocaleString()} attempts, no hit. wall=${(wallMs / 1000).toFixed(1)}s`);
      writeFileSync(
        join(HERE, stateFile),
        JSON.stringify(
          {
            base,
            separator,
            targetChars,
            indices: [tA, tB, tC],
            nextStartN: endN,
            lastChunkAttempts: total,
            lastChunkMs: wallMs,
            cumulativeProbability: 1 - Math.exp(-endN / 1.07e9),
          },
          null,
          2,
        ),
        'utf8',
      );
      process.exit(2); // non-zero = continue searching
    }
  }

  for (let i = 0; i < workerCount; i++) {
    const w = new Worker(new URL(import.meta.url), {
      workerData: {
        base,
        separator,
        targetA: tA,
        targetB: tB,
        targetC: tC,
        workerId: i,
        workerCount,
        reportEvery,
        startN,
        endN,
      },
    });
    w.on('message', (msg) => {
      if (msg.type === 'hit') onHit(msg);
      else if (msg.type === 'progress') onProgress(msg);
      else if (msg.type === 'exhausted') onExhausted(msg);
    });
    w.on('error', (err) => console.error(`Worker ${i} error:`, err));
    workers.push(w);
  }
} // end runMain

// ─── Entry point ───────────────────────────────────────────────────────────
if (!isMainThread) {
  runWorker();
} else {
  await runMain();
}
