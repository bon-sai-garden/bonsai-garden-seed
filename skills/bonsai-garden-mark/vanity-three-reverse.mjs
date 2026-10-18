// ---
// id: 01M3BS43MN07Z00ED27XQ0708Y
// ---
// vanity-three-reverse.mjs — reverse 3-kanji search
//
// Given (A, B), find all C values that produce hits across the full 2^30 space.
// Maps results back to kanji characters.
//
// Usage:
//   node vanity-three-reverse.mjs --base <prefix> --a <char> --b <char>
//
// --base and both targets are REQUIRED; see USAGE below.
//
// Output: <base>-reverse.json with all valid (nonce, C-index, C-kanji) tuples.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { slice } from './engine.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const USAGE = `
Usage:
  node vanity-three-reverse.mjs --base <prefix> --a <kanji> --b <kanji>
                                [--set kanji-1024-vX.Y.json] [--sep '#']
                                [--workers 4] [--startN 0] [--chunk 1073741824]
                                [--out <file>]

  --base   the string the mark is derived from, e.g. "example-agent"
  --a/b    the two kanji to lock; every C that completes them is collected
  --set    which curated set to search against (default: the highest-numbered
           kanji-1024-v*.json in this directory; .bak files are never used)

There are no defaults for --base or the targets.
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
  const { base, separator, targetA, targetB, workerId, workerCount, reportEvery, startN, endN } = workerData;
  const prefixStr = base + separator;
  const prefixBytes = Buffer.from(prefixStr, 'utf8');
  const prefixHash = createHash('sha256').update(prefixBytes);
  const nonceBuf = Buffer.allocUnsafe(16);
  let n = startN + workerId;
  let last = n;
  const t0 = Date.now();
  const hits = []; // collect all hits from this worker

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
    if (a === targetA && b === targetB) {
      // Hit! Collect it.
      hits.push({
        nonce: n,
        salt: prefixStr + nonceStr,
        digestHex: d.toString('hex'),
        c_index: c,
      });
    }
    n += workerCount;
  }
  // send all collected hits at the end
  parentPort.postMessage({ type: 'exhausted', workerId, hits, lastN: n, ms: Date.now() - t0 });
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
  const targetChars = [required(args, 'a', 'first kanji'), required(args, 'b', 'second kanji')];
  const SET_PATH = resolveSet(args.set);
  const workerCount = parseInt(args.workers || '4', 10);
  const reportEvery = parseInt(args.report || '200000', 10);
  const startN = parseInt(args.startN || '0', 10);
  const chunkSize = parseInt(args.chunk || '1073741824', 10); // full 2^30 by default
  const endN = startN + chunkSize;
  const outFile = args.out || `${base}-reverse.json`;

  const data = JSON.parse(readFileSync(SET_PATH, 'utf8'));
  const byChar = new Map(data.kanji.map((k) => [k.char, k]));
  const byIndex = new Map(data.kanji.map((k) => [k.index, k]));

  const targets = targetChars.map((c) => {
    const k = byChar.get(c);
    if (!k) {
      console.error(`Kanji "${c}" not in curated set.`);
      process.exit(1);
    }
    return k;
  });
  const [tA, tB] = targets.map((k) => k.index);

  console.log(`Reverse search: ${targetChars.join('')} → A=#${tA}, B=#${tB}, C=?`);
  console.log(`Base:   "${base}${separator}<n>"`);
  console.log(
    `Range:  nonces ${startN.toLocaleString()} .. ${endN.toLocaleString()} (chunk ${chunkSize.toLocaleString()})`,
  );
  console.log(`Search space: 2^30 ≈ 1.07B   collecting all (A, B, *) hits`);
  console.log(`Workers: ${workerCount}\n`);

  const workers = [];
  const startTime = Date.now();
  const progress = new Array(workerCount).fill(0);
  const allHits = [];
  let completedWorkers = 0;

  function onProgress({ workerId, attempts }) {
    progress[workerId] = attempts;
    const now = Date.now();
    const total = progress.reduce((s, v) => s + v, 0);
    const wallMs = now - startTime;
    const rate = total / (wallMs / 1000);
    const eta = (endN - startN - total) / rate;
    const pct = ((total / (endN - startN)) * 100).toFixed(1);
    process.stdout.write(
      `  ${total.toLocaleString()} attempts (${pct}%, ${Math.round(rate).toLocaleString()}/s, ETA ${eta > 0 ? `${(eta / 60).toFixed(1)}min` : '...'})       \r`,
    );
  }

  function onExhausted({ hits }) {
    allHits.push(...hits);
    completedWorkers++;
    if (completedWorkers === workerCount) {
      const total = progress.reduce((s, v) => s + v, 0);
      const wallMs = Date.now() - startTime;
      console.log(`\n✓ Searched ${total.toLocaleString()} attempts. Found ${allHits.length} hits.\n`);

      // Group by C index and map to kanji
      const byC = new Map();
      allHits.forEach((hit) => {
        if (!byC.has(hit.c_index)) {
          byC.set(hit.c_index, []);
        }
        byC.get(hit.c_index).push(hit);
      });

      // Build output
      const results = [];
      const cValues = Array.from(byC.keys()).sort((a, b) => a - b);

      cValues.forEach((cIdx) => {
        const cKanji = byIndex.get(cIdx);
        const hits = byC.get(cIdx);
        results.push({
          c_index: cIdx,
          c_kanji: cKanji ? cKanji.char : '?',
          c_meanings: cKanji ? cKanji.meanings.slice(0, 3) : [],
          hit_count: hits.length,
          first_nonce: hits[0].nonce,
          first_salt: hits[0].salt,
          first_digest: hits[0].digestHex,
        });
      });

      const output = {
        entity: 'Fuji-shin (3-kanji reverse search)',
        search_base: `${base}${separator}`,
        target_a: { char: targets[0].char, index: targets[0].index, meanings: targets[0].meanings.slice(0, 3) },
        target_b: { char: targets[1].char, index: targets[1].index, meanings: targets[1].meanings.slice(0, 3) },
        target_c: 'any (reverse search)',
        valid_c_options: results,
        total_hits_found: allHits.length,
        unique_c_indices: cValues.length,
        search_ms: wallMs,
        workers: workerCount,
      };

      writeFileSync(join(HERE, outFile), JSON.stringify(output, null, 2), 'utf8');
      console.log(`Wrote ${outFile}`);
      console.log(`\nValid C options for ${targetChars.join('')} (sorted by index):`);
      results.forEach((r) => {
        console.log(`  #${r.c_index}: ${r.c_kanji} (${r.c_meanings.join(', ')}) — ${r.hit_count} hit(s)`);
      });
      process.exit(0);
    }
  }

  for (let i = 0; i < workerCount; i++) {
    const w = new Worker(new URL(import.meta.url), {
      workerData: {
        base,
        separator,
        targetA: tA,
        targetB: tB,
        workerId: i,
        workerCount,
        reportEvery,
        startN,
        endN,
      },
    });
    w.on('message', (msg) => {
      if (msg.type === 'progress') onProgress(msg);
      else if (msg.type === 'exhausted') onExhausted(msg);
    });
    w.on('error', (err) => console.error(`Worker ${i} error:`, err));
    workers.push(w);
  }
}

if (isMainThread) {
  runMain().catch(console.error);
} else {
  runWorker();
}
