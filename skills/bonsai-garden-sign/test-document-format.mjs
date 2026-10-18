// ---
// id: 01M3BS43V53JJ4H7FPDVFZA2YX
// ---
// test-document-format.mjs — regression test for the embedded-format refusal.
//
// Run: node test-document-format.mjs
//
// The point of these is the NEGATIVE case. Before 2026-09-15, signing a sealed
// document with this detached signer returned an envelope and exit 0 — a wrong
// answer delivered as a success. A guard nobody has watched fail is not a guard,
// so the first assertion here is that the refusal actually refuses.

import { hasEmbeddedSeal, frontmatter, assertNotEmbeddedFormat } from './lib/document-format.mjs';

let pass = 0,
  fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name} ${detail}`);
  }
};

const sealed = `---\ntitle: x\nsign:\n  signer: example-agent\n  body-hash: abc\n---\n\nbody\n`;
const plain = `---\ntitle: x\nupdated: 2026-09-15\n---\n\nbody\n`;

// ── the refusal ─────────────────────────────────────────────────────────────
let threw = null;
try {
  assertNotEmbeddedFormat(sealed, 'x.md');
} catch (e) {
  threw = e;
}
check('a sealed document is REFUSED', threw !== null && threw.code === 'EMBEDDED_FORMAT');
check('the refusal names the other tool', threw && /tools\/sign\.py/.test(threw.message));
check('the refusal names both forms', threw && /EMBEDDED/.test(threw.message) && /DETACHED/.test(threw.message));

// ── and does not over-reach ─────────────────────────────────────────────────
let ok = true;
try {
  assertNotEmbeddedFormat(plain, 'y.md');
} catch {
  ok = false;
}
check('plain markdown still signs — the guard is not a ban on .md', ok);

// ── detection edges ─────────────────────────────────────────────────────────
check('no frontmatter at all', !hasEmbeddedSeal('just text\nsign: not frontmatter\n'));
check('frontmatter must be FIRST', !hasEmbeddedSeal(`\n\n---\nsign:\n  a: b\n---\n`));
check('a nested sign: key is not a seal', !hasEmbeddedSeal(`---\nmeta:\n  sign: something\n---\n\nb`));
check('sign: with trailing spaces', hasEmbeddedSeal(`---\ntitle: x\nsign:   \n  signer: a\n---\n\nb`));
// This assertion used to read `.replace(/\r/g, '')` — it stripped the carriage
// returns it claimed to test, passed, and hid a real hole: the guard was blind
// to CRLF, so a CRLF-sealed document was signed with exit 0. A test that edits
// its input until it passes is worse than no test, because it is believed.
const CRLF_SEALED = '---\r\ntitle: x\r\nsign:\r\n  signer: a\r\n---\r\n\r\nb';
check('CRLF sealed document IS detected', hasEmbeddedSeal(CRLF_SEALED));
check('the CRLF fixture really contains CRLF', CRLF_SEALED.includes('\r\n'));
check('CRLF document with no seal is not detected', !hasEmbeddedSeal('---\r\ntitle: x\r\n---\r\n\r\nb'));
check(
  'frontmatter extracted, body excluded',
  (frontmatter(plain) || '').includes('title: x') && !(frontmatter(plain) || '').includes('body'),
);
check('empty frontmatter is not a seal', !hasEmbeddedSeal(`---\n---\n\nbody`));
check('--- inside the body is not a boundary', (frontmatter(`---\ntitle: x\n---\n\na\n---\nb\n`) || '') === 'title: x');

console.log(`\n  ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
