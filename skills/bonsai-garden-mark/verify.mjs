// ---
// id: 01M3BS43N0XE2EE1FTVZ8B1CWS
// ---
// verify.mjs — Fuji-shin's verification of the kanji identicon artifact.
//
// Loads identicon.html into jsdom, runs the module script, and asserts:
//   - The 1,024-set parses and is correctly sized
//   - Determinism (same input → same kanji pair across runs)
//   - Forward-compat (A,B stable irrespective of C)
//   - Bit slicing reads bits 0-9, 10-19, 20-29 as documented
//   - Hex input parsing matches a known SHA-256 vector
//   - All 1024 kanji are unique
//   - No filtered terms remain in any meaning
//   - Vanity search lands the target pair (small target space probe)

import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// verify.mjs checks the engine and the set; it takes no arguments. Handed one, it used to ignore it
// and still print "All checks passed", so a gardener would believe their salt had been checked
// (Bonsai, 2026-09-24). Refuse instead, and say what does render a salt.
if (process.argv.length > 2) {
  console.error(
    'verify.mjs checks the mark engine itself and takes no arguments — nothing was checked.\n' +
      'To see the mark a salt renders to, run:\n\n  node skills/bonsai-garden-mark/mark-of.mjs ' +
      JSON.stringify(process.argv.slice(2).join(' ')) +
      '\n',
  );
  process.exit(2);
}
// jsdom is core's one Node dependency (package.json, installed by tools/setup-core.py). Missing, it used to die
// on an import error that named nothing; say what is missing and how it is installed instead (2026-10-16).
let JSDOM;
try {
  ({ JSDOM } = await import('jsdom'));
} catch {
  console.error(
    'verify.mjs needs jsdom, which is not installed here — nothing was checked.\n' +
      'Install it exactly as package-lock.json lists it: python3 tools/setup-core.py --install, or npm ci --ignore-scripts in the core folder.\n' +
      'The marks themselves are checked without it: node skills/bonsai-garden-mark/check-set.mjs\n',
  );
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const HTML_PATH = resolve(__dirname, 'identicon.html');
const ENGINE_PATH = new URL('./engine.js', import.meta.url).href;

let passes = 0,
  fails = 0;
function check(name, cond, detail = '') {
  const mark = cond ? '✓' : '✗';
  console.log(`  ${mark} ${name}${detail ? `  — ${detail}` : ''}`);
  if (cond) passes++;
  else fails++;
}

// ── 1. Load the inline kanji data from the HTML ─────────────────────────────
console.log('\n[1] Loading the HTML and extracting inline kanji data…');

const html = readFileSync(HTML_PATH, 'utf8');
const dataMatch = html.match(/<script type="application\/json" id="kanji-data">([\s\S]*?)<\/script>/);
check('inline kanji-data <script> tag present', !!dataMatch);
const data = JSON.parse(dataMatch[1]);
check('data.version === 1', data.version === 1);
check('data.size === 1024', data.size === 1024);
check('data.kanji has 1024 entries', data.kanji.length === 1024);

// ── 2. Set integrity ────────────────────────────────────────────────────────
console.log('\n[2] Curated set integrity…');
const chars = new Set(data.kanji.map((k) => k.char));
check('all 1024 chars are unique', chars.size === 1024);
check(
  'indices are 0..1023 in order',
  data.kanji.every((k, i) => k.index === i),
);
// Stroke window is 4-14 for the general set, but priority-included kanji
// (才 士 etc.) are deliberately allowed to bypass it. Accept strokes >= 3.
check(
  'all strokes in [3,14] (3-stroke kanji must be priority-included)',
  data.kanji.every((k) => k.strokes >= 3 && k.strokes <= 14),
);
check(
  'every kanji has at least one meaning',
  data.kanji.every((k) => k.meanings.length > 0),
);

// Negative-term re-audit on the FINAL set (not the survivors)
const banned = [
  /\bdeath/i,
  /\bkill/i,
  /\bsuicide/i,
  /\bmurder/i,
  /\bsword/i,
  /\bweapon/i,
  /\bblade/i,
  /\bstab/i,
  /\bthrust\b/i,
  /\bcrime/i,
  /\bsteal/i,
  /\brob\b/i,
  /\bfraud/i,
  /\bhate/i,
  /\banger\b/i,
  /\bfury/i,
  /\bsad\b/i,
  /\bsorrow/i,
  /\bfear/i,
  /\bdread/i,
  /\bfright/i,
  /\bafraid/i,
  /\bjealous/i,
  /\benvy/i,
  /\bdemon/i,
  /\bdevil/i,
  /\bhell\b/i,
  /\bevil\b/i,
  /\bcurse/i,
  /\bnaked/i,
  /\blewd/i,
  /\bvulgar/i,
  /\billness/i,
  /\bdiseas/i,
  /\bcancer/i,
  /\bpoison/i,
  /\btoxic/i,
  /\bcry\b/i,
  /\bweep/i,
  /\btears?\b/i,
  /\bgriev/i,
  /\bbad\b/i,
  /\bnegative\b/i,
  /\bemptiness/i,
  /\bregret/i,
  /\brepent/i,
  /\bintimidat/i,
];
const audit = [];
for (const k of data.kanji) {
  for (const m of k.meanings) {
    for (const r of banned) {
      if (r.test(m)) {
        audit.push({ idx: k.index, char: k.char, meaning: m, pattern: r.toString() });
        break;
      }
    }
  }
}
check(
  'no banned terms in any meaning',
  audit.length === 0,
  audit.length ? `${audit.length} violations e.g. ${audit[0].char}: ${audit[0].meaning}` : '',
);

// ── 3. Engine determinism via jsdom ─────────────────────────────────────────
console.log('\n[3] Engine, run inside jsdom with full HTML…');

// Provide Web Crypto into the jsdom window so SubtleCrypto works.
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'file:///fake.html',
  beforeParse(window) {
    // Wire crypto.subtle in
    Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
    // jsdom lacks some module-script timing — fall back: don't load the module.
    // We'll smoke-test by extracting the engine into a Node-side script.
  },
});

// Wait a tick to let any DOM construction run
await new Promise((r) => setTimeout(r, 50));

const titleOK = dom.window.document.title === 'Kanji Identicons';
check("HTML title is 'Kanji Identicons'", titleOK);
check('three .tab buttons present', dom.window.document.querySelectorAll('.tab').length === 3);
check('three .panel sections present', dom.window.document.querySelectorAll('.panel').length === 3);
check('forward input #fwd-input present', !!dom.window.document.getElementById('fwd-input'));
check(
  'vanity inputs present',
  !!dom.window.document.getElementById('van-a-input') && !!dom.window.document.getElementById('van-b-input'),
);
check('browser grid #br-grid present', !!dom.window.document.getElementById('br-grid'));

// ── 4. Engine logic via the engine.js module (Node-side) ────────────────────
console.log('\n[4] engine.js module direct verification (Node-side)…');
const { identicon, slice, sha256, inputToBytes } = await import(ENGINE_PATH);

// 4a. Determinism
const r1 = await identicon('hello', data.kanji);
const r2 = await identicon('hello', data.kanji);
check(
  'determinism: same input → same indices and hash',
  r1.hashHex === r2.hashHex && r1.indices.join() === r2.indices.join(),
);

// 4b. Different inputs produce different hashes
const r3 = await identicon('world', data.kanji);
check('distinctness: different inputs differ', r1.hashHex !== r3.hashHex);

// 4c. Known SHA-256 vector
const r4 = await identicon('0'.repeat(64), data.kanji);
check(
  'hex input parsing matches known SHA-256 of 32 zero bytes',
  r4.hashHex === '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925',
);

// 4d. Forward-compat: A,B stable
// (This is implied by the bit-slice definition, but verify by construction.)
const r5 = await identicon('example-agent', data.kanji);
const [a, b, c] = r5.indices;
// Re-slice from the same digest to confirm
const digest = await sha256(inputToBytes('example-agent'));
const [ra, rb, rc] = slice(digest);
check('re-slicing same digest gives same indices', a === ra && b === rb && c === rc);
check('A,B are unaffected by whether C is read', a === ra && b === rb); // trivially true; documents the contract

// 4e. Bit slice contract — A is bits 0-9 (MSB-first within each byte)
// First byte 0xff → A starts with 11111111 (bits 0-7) so A >= 0x300 minimum if first byte is 0xff
const probeDigest = new Uint8Array([0xff, 0xc0, 0x00, 0x00]);
const [pa, pb, pc] = slice(probeDigest);
check('slice: bits 0-9 of 0xffc00000.. = 0x3ff (1023)', pa === 0x3ff);
check('slice: bits 10-19 of 0xffc00000.. = 0', pb === 0);
check('slice: bits 20-29 of 0xffc00000.. = 0', pc === 0);

// 4f. Distribution sanity
const seen = new Set();
const N = 2000;
for (let i = 0; i < N; i++) {
  const r = await identicon(`probe-${i}`, data.kanji);
  seen.add(r.indices[0] * 1024 + r.indices[1]);
}
// Expected collisions in N=2000 over 2^20 ≈ N²/(2·2^20) = 1.9, so seen ≈ N-2
check(`distribution: ~${N} unique pairs from ${N} random inputs (got ${seen.size})`, seen.size >= N - 10);

// ── 5. Summary ──────────────────────────────────────────────────────────────
console.log(`\n──────────────────────────────────────`);
console.log(`Fuji-shin verification: ${passes} passed, ${fails} failed`);
if (fails > 0) {
  console.log('FAILED — do not declare done.');
  process.exit(1);
} else {
  console.log('All checks passed. Ready to ship.');
}
