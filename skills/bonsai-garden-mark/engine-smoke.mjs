// ---
// id: 01M3BS43JCFHJK0EN9WA532GCS
// ---
import { identicon, vanitySearch, constants } from './engine.js';
import { readFileSync } from 'node:fs';

// beside this file, wherever it is run from: SKILL.md runs it from the repository root
const set = JSON.parse(readFileSync(new URL('./kanji-1024-v1.2.json', import.meta.url), 'utf8')).kanji;
console.log(`Loaded ${set.length} kanji.`);
console.log(`Constants:`, constants);

// 1. Determinism
const a = await identicon('hello', set);
const b = await identicon('hello', set);
console.log(
  `\n[determinism] same input → same output: ${a.hashHex === b.hashHex && a.indices.join(',') === b.indices.join(',')}`,
);
console.log(
  `  hello → ${a.kanji
    .slice(0, 2)
    .map((k) => k.char)
    .join('')}  (A=${a.indices[0]}, B=${a.indices[1]}, C=${a.indices[2]})`,
);

// 2. Distinct inputs
const c = await identicon('world', set);
console.log(`\n[distinctness] different inputs differ: ${a.hashHex !== c.hashHex}`);
console.log(
  `  world → ${c.kanji
    .slice(0, 2)
    .map((k) => k.char)
    .join('')}`,
);

// 3. Hex parsing
const hex64 = '0'.repeat(64);
const d = await identicon(hex64, set);
const expected = '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925';
console.log(`\n[hex] 32 zero bytes:`);
console.log(`  hash matches known SHA-256: ${d.hashHex === expected}`);
console.log(
  `  → ${d.kanji
    .slice(0, 2)
    .map((k) => k.char)
    .join('')}`,
);

// 4. A,B stability with vs. without C
const probe = await identicon('example-agent', set);
console.log(`\n[forward-compat] adding C does not change A,B:`);
console.log(`  example-agent 2-kanji: ${probe.kanji[0].char}${probe.kanji[1].char}`);
console.log(`  example-agent 3-kanji: ${probe.kanji[0].char}${probe.kanji[1].char}${probe.kanji[2].char}`);
console.log(`  indices: ${probe.indices.join(', ')}`);

// 5. Vanity search
console.log(`\n[vanity] finding a salt for a known pair:`);
const target = await identicon('example-agent-two', set);
console.log(
  `  target: ${target.kanji[0].char}${target.kanji[1].char} (A=${target.indices[0]}, B=${target.indices[1]})`,
);
const t0 = Date.now();
const result = await vanitySearch({
  base: 'test',
  targetA: target.indices[0],
  targetB: target.indices[1],
  maxAttempts: 5_000_000,
});
const t1 = Date.now();
if (result) {
  console.log(`  found "${result.salt}" in ${result.attempts.toLocaleString()} attempts, ${t1 - t0}ms`);
  const v = await identicon(result.salt, set);
  const match = v.indices[0] === target.indices[0] && v.indices[1] === target.indices[1];
  console.log(`  verify: ${v.kanji[0].char}${v.kanji[1].char}  match=${match}`);
}

// 6. Distribution sanity: hash 1000 random inputs, count unique pairs
console.log(`\n[distribution] 1000 random inputs:`);
const seen = new Set();
for (let i = 0; i < 1000; i++) {
  const r = await identicon(`probe-${i}`, set);
  seen.add(r.indices[0] * 1024 + r.indices[1]);
}
console.log(`  unique pairs: ${seen.size}/1000  (expect ~999.5 by birthday math)`);
