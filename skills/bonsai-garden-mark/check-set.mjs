// ---
// id: 01M3BS43FYRVJ1MYSN8GJVB3GB
// ---
// check-set.mjs — the mark skill's self-check, on the CANONICAL set (kanji-1024-v1.2.json).
//
//   node skills/bonsai-garden-mark/check-set.mjs
//
// verify.mjs checks identicon.html, an archived lab page that embeds the retired v1.0 set, so
// its "passed" says nothing about the marks the garden uses today. This checks the set those
// marks come from: its shape, and known salts that must render the marks already published.
// Found 2026-09-24, when setup-core.py was reporting verify.mjs as "the kanji-mark check".
// No dependencies beyond Node. Exit 1 on any failure.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identicon } from './engine.js';

const here = dirname(fileURLToPath(import.meta.url));
if (['--help', '-h'].includes(process.argv[2])) {
  console.log(
    'usage: node skills/bonsai-garden-mark/check-set.mjs [set.json]\n' +
      "  the mark skill's self-check on the canonical set (kanji-1024-v1.2.json): its shape, and the known salts that\n" +
      '  must render the marks already published. Exit 1 on any failure. The optional set path is for tests.',
  );
  process.exit(0);
}
const file = process.argv[2] || resolve(here, 'kanji-1024-v1.2.json'); // 2nd arg: tests only
const set = JSON.parse(readFileSync(file, 'utf8'));
let bad = 0;
const check = (ok, what) => {
  console.log(`  ${ok ? '✓' : '✗'} ${what}`);
  if (!ok) bad++;
};

const k = set.kanji;
check(Array.isArray(k) && k.length === 1024, 'the set holds 1,024 kanji');
check(
  k.every((x, i) => x.index === i),
  'every index matches its position',
);
check(new Set(k.map((x) => x.char)).size === 1024, 'no kanji appears twice');
check(
  k.every((x) => Array.isArray(x.meanings) && x.meanings.length > 0),
  'every kanji carries KANJIDIC2 meanings',
);
check(
  k.every((x) => !x.garden || (Array.isArray(x.garden.meanings) && x.garden.meanings.length && x.garden.source)),
  'every garden reading has meanings and a source',
);

// Known salts → the marks already published. If the set drifts, these are the first to say so.
const VECTORS = [
  ['bonsai-id#1099329241688', '盆才守神', 4], // Bonsai's identity mark
  ['bonsai-garden-strategic-context#2788', '志技', 2], // skill mark, 2026-09-24
  ['bonsai-garden-tokens#920001', '節技', 2], // skill mark, 2026-09-24
];
for (const [salt, want, n] of VECTORS) {
  const r = await identicon(salt, k);
  // identicon() returns three positions; a fourth, where a mark carries one, is bits 30-39
  let got = r.kanji.map((x) => x.char).join('');
  if (n === 4) got += k[parseInt(r.hashHex.slice(0, 10), 16) & 0x3ff].char;
  check(got.slice(0, n) === want, `${salt} renders ${want} (got ${got.slice(0, n)})`);
}
console.log(bad ? `\nFAIL — ${bad} check(s)` : '\nThe canonical kanji set checks out.');
process.exit(bad ? 1 : 0);
