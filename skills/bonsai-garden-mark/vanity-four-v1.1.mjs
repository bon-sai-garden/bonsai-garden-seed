// ---
// id: 01M3BS43MDGK0K3BGAZW4HMCVW
// ---
// vanity-four-v1.1.mjs — 4-kanji (40-bit) vanity search.
//
// The only 40-bit searcher in this skill; the three-kanji tools are 30-bit.
// It shipped hardwired to one garden's own mark (bon-sai / 盆才守神) against a
// superseded kanji set kept as a .bak — a tool that did the wrong thing out of
// the box for anyone but us. Base, targets and set are arguments now.
//
// Run: node vanity-four-v1.1.mjs --base <prefix> --a 山 --b 水 --c 空 --d 風
// Expected time: ~14-28h on 8 workers at ~11-22M hashes/sec

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const USAGE = `
Usage:
  node vanity-four-v1.1.mjs --base <prefix> --a <kanji> --b <kanji> --c <kanji> --d <kanji>
                            [--set kanji-1024-vX.Y.json] [--sep '#'] [--workers 8]

  --base   the string the mark is derived from, e.g. "example-agent"
  --a..d   the four kanji to lock, as characters
  --set    which curated set to search against (default: the highest-numbered
           kanji-1024-v*.json here; .bak files are never chosen for you)

No defaults for --base or the targets: this is a 2^40 search, and starting one
pointed at the wrong mark costs a day of someone's machine.
`;

function fail(msg) {
  console.error(`${msg}\n`);
  console.error(USAGE.trim());
  process.exit(64); // EX_USAGE, distinct from the search's own codes
}

function required(args, name, what) {
  const v = args[name];
  if (v === undefined || v === '') fail(`missing --${name} (${what})`);
  return v;
}

function resolveSet(explicit) {
  if (explicit) {
    const p = join(__dirname, explicit);
    if (!existsSync(p)) fail(`kanji set not found: ${explicit}`);
    return p;
  }
  const sets = readdirSync(__dirname)
    .filter((f) => /^kanji-1024-v[\d.]+\.json$/.test(f)) // .bak deliberately excluded
    .sort();
  if (!sets.length) fail('no kanji-1024-v*.json set in this directory');
  return join(__dirname, sets[sets.length - 1]);
}

function slice40(d) {
  return [
    ((d[0] << 2) | (d[1] >> 6)) & 0x3ff, // bits [0-9]
    ((d[1] << 4) | (d[2] >> 4)) & 0x3ff, // bits [10-19]
    ((d[2] << 6) | (d[3] >> 2)) & 0x3ff, // bits [20-29]
    ((d[3] << 8) | d[4]) & 0x3ff, // bits [30-39]
  ];
}

function runWorker() {
  const { base, separator, targetA, targetB, targetC, targetD, workerId, workerCount, reportEvery, startN, endN } =
    workerData;
  const prefixStr = base + separator;
  const prefixBytes = Buffer.from(prefixStr, 'utf8');
  const prefixHash = createHash('sha256').update(prefixBytes);
  const nonceBuf = Buffer.allocUnsafe(20);
  let n = startN + workerId;
  let last = n;
  const hits = [];

  while (n < endN) {
    if (n - last >= reportEvery) {
      parentPort.postMessage({ type: 'progress', workerId, attempts: n - startN });
      last = n;
    }
    const nonceStr = n.toString();
    const nonceLen = nonceStr.length;
    for (let i = 0; i < nonceLen; i++) nonceBuf[i] = nonceStr.charCodeAt(i);
    const h = prefixHash.copy();
    h.update(nonceBuf.subarray(0, nonceLen));
    const d = h.digest();
    const [a, b, c, dd] = slice40(d);
    if (a === targetA && b === targetB && c === targetC && dd === targetD) {
      const hitObj = {
        nonce: n,
        salt: prefixStr + nonceStr,
        digestHex: d.toString('hex'),
        indices: [a, b, c, dd],
      };
      hits.push(hitObj);
      parentPort.postMessage({ type: 'hit', hit: hitObj });
    }
    n += workerCount;
  }
  parentPort.postMessage({ type: 'exhausted', workerId, hits, ms: 0 });
}

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

  const set = JSON.parse(readFileSync(resolveSet(args.set), 'utf8'));
  const byIndex = new Map(set.kanji.map((k) => [k.index, k]));
  const byChar = new Map(set.kanji.map((k) => [k.char, k]));

  const base = required(args, 'base', 'the string the mark is derived from');
  const separator = args.sep || '#';
  const indexOf = (name, what) => {
    const ch = required(args, name, what);
    const k = byChar.get(ch);
    if (!k) fail(`kanji "${ch}" is not in this set`);
    return k.index;
  };
  const targetA = indexOf('a', 'first kanji');
  const targetB = indexOf('b', 'second kanji');
  const targetC = indexOf('c', 'third kanji');
  const targetD = indexOf('d', 'fourth kanji');

  const workerCount = parseInt(args.workers || '8', 10);
  const reportEvery = 500_000;
  const startN = 0;
  const endN = Number.MAX_SAFE_INTEGER;

  const kaA = byIndex.get(targetA),
    kaB = byIndex.get(targetB);
  const kaC = byIndex.get(targetC),
    kaD = byIndex.get(targetD);

  console.log(`\n=== ${base} — 40-bit vanity search ===\n`);
  console.log(
    `Target:  ${kaA?.char}(#${targetA}) ${kaB?.char}(#${targetB}) ${kaC?.char}(#${targetC}) ${kaD?.char}(#${targetD})`,
  );
  console.log(`Kanji:   ${kaA?.char} ${kaB?.char} ${kaC?.char} ${kaD?.char}`);
  console.log(`Base:    "${base}${separator}<n>"`);
  console.log(`Workers: ${workerCount}`);
  console.log('Space:   2^40 ~ 1.1T (ETA ~14-28h depending on host speed)\n');

  const workers = [];
  const startTime = Date.now();
  const progress = new Array(workerCount).fill(0);
  let firstHit = null;

  function onProgress({ workerId, attempts }) {
    progress[workerId] = attempts;
    const total = progress.reduce((s, v) => s + v, 0);
    const wallMs = Date.now() - startTime;
    const rate = total / (wallMs / 1000);
    const etaH = (1_099_511_627_776 - total) / rate / 3600;
    const pct = ((total / 1_099_511_627_776) * 100).toFixed(3);
    process.stdout.write(
      '  ' +
        total.toLocaleString() +
        ' (' +
        pct +
        '%, ' +
        (rate / 1e6).toFixed(1) +
        'M/s, ETA ~' +
        etaH.toFixed(1) +
        'h)     \r',
    );
  }

  function onHit(hit) {
    if (firstHit) return;
    firstHit = hit;
    const wallMs = Date.now() - startTime;
    console.log(`\n\n✓ FOUND after ${(wallMs / 3600000).toFixed(2)}h`);
    console.log(`  Nonce:   ${hit.nonce}`);
    console.log(`  Salt:    ${hit.salt}`);
    console.log(`  SHA-256: ${hit.digestHex}`);
    console.log(`  Kanji:   ${kaA?.char}${kaB?.char}${kaC?.char}${kaD?.char} (${hit.indices.join(',')})`);
    console.log('\n  Add to reserved-hashes-v1.1.md as bon-sai ID mark.\n');
    for (const w of workers) w.terminate();
    process.exit(0);
  }

  for (let i = 0; i < workerCount; i++) {
    const w = new Worker(new URL(import.meta.url), {
      workerData: {
        base,
        separator,
        targetA,
        targetB,
        targetC,
        targetD,
        workerId: i,
        workerCount,
        reportEvery,
        startN,
        endN,
      },
    });
    w.on('message', (msg) => {
      if (msg.type === 'progress') onProgress(msg);
      else if (msg.type === 'hit') onHit(msg.hit);
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
