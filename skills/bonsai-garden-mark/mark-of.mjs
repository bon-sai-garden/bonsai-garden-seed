// ---
// id: 01M3BS43K9GWDT1FBPF8YKV579
// ---
// mark-of.mjs — show the kanji mark a salt (or any text) renders to.
//
//   node skills/bonsai-garden-mark/mark-of.mjs "bonsai-garden-tokens#245416"
//
// Uses this skill's own engine and the canonical set, kanji-1024-v1.2.json, and nothing else.
// Prints the three kanji (the mark is the first two; the third is reserved), their positions
// in the set, and their meanings. Written 2026-09-24 because verify.mjs silently ignored a salt
// it was handed and still said "All checks passed" (Bonsai's first-user test).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { identicon } from './engine.js';

const here = dirname(fileURLToPath(import.meta.url));
const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error(
    'Give me something to render, in quotes:\n\n  node skills/bonsai-garden-mark/mark-of.mjs "bonsai-garden-tokens#245416"\n',
  );
  process.exit(2);
}
const set = JSON.parse(readFileSync(resolve(here, 'kanji-1024-v1.2.json'), 'utf8')).kanji;
for (const input of inputs) {
  const r = await identicon(input, set);
  const [a, b, c] = r.kanji;
  // KANJIDIC2's meanings first; the garden's own reading, where the set records one, after a " · "
  const m = (k) =>
    (k.meanings || [k.meaning]).filter(Boolean).slice(0, 3).join(', ') +
    (k.garden ? `  ·  garden: ${k.garden.meanings.join(', ')}` : '');
  console.log(`${a.char}${b.char}  (third ${c.char})  ←  ${input}`);
  console.log(`  ${a.char} #${r.indices[0]}  ${m(a)}`);
  console.log(`  ${b.char} #${r.indices[1]}  ${m(b)}`);
  console.log(`  ${c.char} #${r.indices[2]}  ${m(c)}  (reserved)\n`);
}
