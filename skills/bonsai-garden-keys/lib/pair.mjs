// ---
// id: 01M5MVSSWK8RKV31J77JZYF4H8
// title: An entity's pair, in kanji or by index, and the one answer to whether it is free
// type: script
// tended-by: mori-shin
// created: 2026-10-23
// updated: 2026-10-23
// ---
//
// pair.mjs — the pair an entity chooses at `identity`, read in either of two forms, and the one
// answer to "is it free?" that `identity` and `check-pair` both give. Backlog B10-44 and B10-47,
// from a planting on a fresh Mac (2026-10-23): a pasted pair of kanji did not survive the
// gardener's shell, and a pair was called free by eye that the reserved rule matches.
//
// TWO FORMS, ONE PAIR. `--pair 真心` (the two kanji, as before) or `--pair-index 319,79` (their
// numbers in the published vocabulary, kanji-1024-v1.2.json: plain ASCII, nothing for a shell's
// line editor to mangle). Both resolve to the same two indices; both are echoed back as kanji and
// numbers before anything is locked (`pairLine`). Both at once is usage (64): two forms of one value
// are two masters. A malformed or out-of-range index is refused (2), as a pick outside 1-5 is.
//
// ONE ANSWER. `ruleFinding` holds the two refusals that depend only on the pair: the reserved rule
// (the shipped set, believed on the origin's word by the caller; this file never reads it) and 盆
// never a first shown kanji (namespace.mjs's `bonFirst`). `takenFinding` holds the third, a pair
// another entity in this garden already holds. `identity` refuses on them in that order;
// `check-pair` reports them all. The verdict is the rule's own (`rule.reserved`); `reservedWords`
// only says it in plain words, naming which kanji is in which set. A reason it does not recognise
// is passed on in the rule's own words, never softened and never turned into "free".

import { pairOf, chars, bonFirst, kanjiSet, SET_FILE } from '../../bonsai-garden-mark/namespace.mjs';

/** Two decimal numbers, a comma between them, no space, no sign, no leading zero. */
export const PAIR_INDEX_RE = /^(0|[1-9][0-9]{0,3}),(0|[1-9][0-9]{0,3})$/;

/** A pair that cannot be read: `exit` is the binary's code for it (64 usage, 2 refused). */
export class PairError extends Error {
  constructor(exit, message) {
    super(message);
    this.exit = exit;
  }
}

/** '319,79' → [319, 79]; refused (2) unless both are indices of the published vocabulary. */
export function pairFromIndices(text) {
  const size = kanjiSet().length;
  const m = PAIR_INDEX_RE.exec(String(text ?? ''));
  if (!m)
    throw new PairError(
      2,
      `--pair-index is two numbers joined by a comma, with no space, as 319,79; ${JSON.stringify(text)} is not that`,
    );
  const idx = [Number(m[1]), Number(m[2])];
  for (const i of idx)
    if (i >= size)
      throw new PairError(2, `${i} is outside the published vocabulary, which runs 0 to ${size - 1} (${SET_FILE})`);
  return idx;
}

/**
 * The pair a command line names: `{ pair, form }`, or null when it names none.
 * `--pair` and `--pair-index` together are usage (64); kanji the set does not hold are usage (64), as before.
 */
export function resolvePair(f) {
  const byKanji = f.pair !== undefined;
  const byIndex = f['pair-index'] !== undefined;
  if (byKanji && byIndex)
    throw new PairError(64, 'one form of the pair, not both: --pair 〇〇 or --pair-index <a>,<b>');
  if (byKanji) {
    try {
      return { pair: pairOf(f.pair), form: '--pair' };
    } catch (e) {
      throw new PairError(64, e.message);
    }
  }
  if (byIndex) return { pair: pairFromIndices(f['pair-index']), form: '--pair-index' };
  return null;
}

/** The echo: the pair as kanji and as numbers, and the form it came in. */
export function pairLine(pair, form) {
  const [a, b] = [...chars(pair)];
  return `pair: ${a}${b}  ${pair[0]},${pair[1]}  (${a} ${pair[0]}, ${b} ${pair[1]}; given as ${form})`;
}

/** The reserved rule's reason, in plain words that name which kanji is in which set; null when the rule passes it. */
export function reservedWords(pair, why) {
  if (!why) return null;
  const [ca, cb] = [...chars(pair)];
  if (/ is the wildcard/.test(why)) {
    const w = [...why][0];
    const at = pair.find((i) => chars([i]) === w);
    return `${w}${at === undefined ? '' : ` (${at})`} is the wildcard: a mark that shows it anywhere is reserved in the first namespace`;
  }
  if (/first in set A, second in set B/.test(why))
    return `${ca} (${pair[0]}) is in set A and ${cb} (${pair[1]}) is in set B: a pair whose first kanji is in set A and whose second is in set B is reserved in the first namespace`;
  return `${why}, in the first namespace`;
}

/** What the pair alone is refused for: the reserved rule, then 盆 first. `{ kind, words }` or null. */
export function ruleFinding(pair, rule) {
  const words = reservedWords(pair, rule.reserved(pair));
  if (words) return { kind: 'reserved', words };
  const bon = bonFirst(pair);
  if (bon) return { kind: 'bon-first', words: bon };
  return null;
}

/** Whether another entity in this garden holds the pair. `{ kind, words }` or null. */
export function takenFinding(pair, locks) {
  for (const [other, e] of Object.entries(locks?.agents || {}))
    if (JSON.stringify(e.identity_pair) === JSON.stringify(pair))
      return { kind: 'taken', words: `taken in this garden by ${other}` };
  return null;
}

/** Every finding, in the order `identity` refuses on them. `locks` null: the garden's taken pairs are not asked. */
export function pairFindings({ pair, rule, locks = null }) {
  return [ruleFinding(pair, rule), locks ? takenFinding(pair, locks) : null].filter(Boolean);
}
