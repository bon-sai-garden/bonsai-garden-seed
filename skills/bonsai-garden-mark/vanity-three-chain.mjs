// ---
// id: 01M4ZPA9RJ72S42ZDNS9E84PFK
// title: vanity-three-chain — drive a long three-kanji vanity search across restarts
// type: script
// tended-by: baisai
// created: 2026-10-15
// updated: 2026-10-15
// ---
//
// vanity-three-chain.mjs — run vanity-three.mjs chunk after chunk, resuming each chunk from the
// state file the search leaves behind, until the search writes its result or a deadline is near.
//
// The Node port of vanity-three-chain.sh (AGENTS.md: Python or Node for anything cross-platform).
// Same loop, same exit codes, same lines on stdout; three differences, each deliberate:
//   - nothing of ours is in it: --base and the three kanji are required, as the search requires them;
//   - the result file is the search's own (--out, default <base>-three.json), not a fixed name;
//   - a search that fails for any reason but "no hit in this chunk" (exit 2) stops the chain with
//     that exit code. The shell version looped on a usage error until its deadline and reported
//     "Deadline approached", which is a typo wearing the face of an honest miss.
//
// Usage:
//   node vanity-three-chain.mjs --base <prefix> --a <kanji> --b <kanji> --c <kanji>
//                               [--deadline 38] [--chunk 65000000] [--workers 4]
//                               [--state vanity-three-state.json] [--out <file>]
//                               [--set kanji-1024-vX.Y.json] [--sep '#']
//                               [--search vanity-three.mjs]
//
//   --deadline  seconds; the chain stops (exit 3) once fewer than 5 remain, so a caller with its own
//               timeout (a harness's bash call, a cron slot) can rerun it and resume. Default 38.
//   --chunk     nonces per search call (default 65,000,000, about 36 s at 1.8 M/s on one core).
//   --search    the search script to drive (default: vanity-three.mjs beside this file). The state
//               and result files live beside the search script, where it writes them.
//
// Exit codes: 0 the result file exists · 3 deadline reached, resume later · 64 usage · any other
// code is the search's own, passed through.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const USAGE = `
Usage:
  node vanity-three-chain.mjs --base <prefix> --a <kanji> --b <kanji> --c <kanji>
                              [--deadline 38] [--chunk 65000000] [--workers 4]
                              [--state vanity-three-state.json] [--out <file>]
                              [--set kanji-1024-vX.Y.json] [--sep '#'] [--search vanity-three.mjs]
`;

function fail(msg) {
  console.error(`${msg}\n`);
  console.error(USAGE.trim());
  process.exit(64); // EX_USAGE, as vanity-three.mjs: never 2, which means "no hit in this chunk"
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) fail(`unexpected argument: ${argv[i]}`);
    const name = argv[i].slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) fail(`missing value for --${name}`);
    args[name] = value;
    i++;
  }
  return args;
}

function required(args, name, what) {
  const v = args[name];
  if (v === undefined || v === '') fail(`missing --${name} (${what})`);
  return v;
}

function positiveInt(args, name, fallback) {
  const raw = args[name] ?? String(fallback);
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) fail(`--${name} must be a positive integer, got "${raw}"`);
  return n;
}

function nextStart(stateFile) {
  if (!existsSync(stateFile)) return 0;
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  const n = state.nextStartN;
  if (!Number.isInteger(n) || n < 0) fail(`${stateFile}: nextStartN is not a non-negative integer`);
  return n;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const base = required(args, 'base', 'the string the mark is derived from');
  const kanji = ['a', 'b', 'c'].map((k, i) => required(args, k, `${['first', 'second', 'third'][i]} kanji`));
  const deadlineSecs = positiveInt(args, 'deadline', 38);
  const chunk = positiveInt(args, 'chunk', 65000000);
  const workers = positiveInt(args, 'workers', 4);

  const search = resolve(HERE, args.search ?? 'vanity-three.mjs');
  if (!existsSync(search)) fail(`search script not found: ${search}`);
  const searchDir = dirname(search);
  const stateFile = join(searchDir, args.state ?? 'vanity-three-state.json');
  const outName = args.out ?? `${base}-three.json`;
  const outFile = join(searchDir, outName);

  const forwarded = [];
  for (const name of ['set', 'sep', 'state', 'out']) {
    if (args[name] !== undefined) forwarded.push(`--${name}`, args[name]);
  }

  const t0 = Date.now();
  const elapsed = () => Math.floor((Date.now() - t0) / 1000);

  for (;;) {
    if (existsSync(outFile)) {
      console.log(`Found! See ${outName}`);
      process.exit(0);
    }
    const remaining = deadlineSecs - elapsed();
    if (remaining <= 5) {
      console.log(`Deadline approached (${elapsed()}s elapsed). Stopping.`);
      process.exit(3);
    }

    const startN = nextStart(stateFile);
    console.log(`─── chunk startN=${startN} chunk=${chunk} ─────────────────────────`);
    const r = spawnSync(
      process.execPath,
      [
        search,
        '--base',
        base,
        '--a',
        kanji[0],
        '--b',
        kanji[1],
        '--c',
        kanji[2],
        '--workers',
        String(workers),
        '--startN',
        String(startN),
        '--chunk',
        String(chunk),
        ...forwarded,
      ],
      { cwd: searchDir, encoding: 'utf8' },
    );
    const rc = r.status ?? 1;
    const lines = `${r.stdout ?? ''}${r.stderr ?? ''}`.split('\n').filter((l) => l.length);
    for (const line of lines.slice(-3)) console.log(line);
    console.log(`  (node exit=${rc}, total elapsed ${elapsed()}s)`);

    if (rc === 0 && existsSync(outFile)) {
      console.log(`Found! See ${outName}`);
      process.exit(0);
    }
    if (rc !== 2) {
      console.error(`vanity-three-chain: the search exited ${rc}; stopping rather than retrying it.`);
      process.exit(rc);
    }
  }
}

main();
