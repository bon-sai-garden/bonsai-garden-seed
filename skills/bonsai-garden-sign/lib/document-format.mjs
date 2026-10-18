// ---
// id: 01M3BS43RJDDC5TNDYSGB9KX41
// ---
/**
 * document-format.mjs — tell an embedded-seal document from a plain file.
 *
 * The garden signs in two forms, and they are not interchangeable:
 *
 *   DETACHED  a .bonsaisig envelope beside the file, hashing its exact bytes.
 *             `file_hash`. This skill's form.
 *   EMBEDDED  a `sign:` block written INTO a markdown document's frontmatter,
 *             hashing the canonical BODY with that block excluded. `body-hash`.
 *             tools/sign.py's form.
 *
 * Before this file existed, signing an embedded-format document with this
 * detached signer SUCCEEDED: it hashed the whole file — the stale seal included
 * — and returned an envelope with exit 0. Zensai hit it on 2026-09-15 running
 * the core signer on his own about-me.md at the gardener's instruction, and
 * nothing said the document had not been sealed. A wrong answer delivered as a
 * success, in the one layer whose whole job is to be checkable.
 *
 * The frontmatter boundary below is a PORT of tools/core/frontmatter.py's
 * FRONT_RE, not a re-derivation. Re-deriving it is how the double-frontmatter
 * class happened: an ad-hoc matcher that agreed with the real one on the easy
 * cases and not on the rest.
 */

// PORTED FROM tools/sign.py's _FM_RE — deliberately, and NOT from
// tools/core/frontmatter.py's FRONT_RE, which is a DIFFERENT regex:
//
//   sign.py         ^---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(\r?\n|$)    DOTALL
//   frontmatter.py  \A---[ \t]*\n(.*?)^---[ \t]*(?:\n|\Z)          DOTALL|MULTILINE
//
// They disagree on every case tested, and materially on two: frontmatter.py does
// NOT match CRLF frontmatter — it reports "no frontmatter" for a CRLF document —
// and sign.py does not match an empty frontmatter block.
//
// This file ported frontmatter.py first, on 2026-09-15, and inherited the CRLF
// blindness: a CRLF-sealed document slipped past the refusal and was signed,
// exit 0. The test that should have caught it read `crlf.replace(/\r/g, '')` —
// it stripped the carriage returns it claimed to be testing, and passed. The
// test lied, so the hole stayed open.
//
// RESOLVED 2026-09-15. There is now ONE definition: the canonical
// tools/core/frontmatter.py carries a form handling CRLF *and* empty blocks,
// and tools/sign.py imports it rather than keeping its own. This is a port of
// that one. Verified byte-identical to BOTH old Python regexes across all
// 3,098 documents in the five repos, so no seal moved; all 246 signed
// documents still verify.
const FRONT_RE = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

// Exported so embedded-format.mjs uses the SAME pattern rather than a second
// copy of it. One definition; a copy here would re-create the split above.
export const FRONT_RE_SOURCE = FRONT_RE.source;

/**
 * Return the frontmatter block, or null when there is none.
 *
 * Parity note: the regex capture is byte-identical to Python's
 * `FRONT_RE.match(text).group(1)` — verified on the same input, both give
 * `"title: x\n"`. But Python's NAMED accessor, `frontmatter.raw()`, strips the
 * trailing newline, and this is the equivalent named accessor, so it strips too.
 * Porting the pattern without porting the accessor's semantics is how two
 * implementations agree on the regex and disagree on the answer.
 */
export function frontmatter(text) {
  if (!text.startsWith('---')) return null; // must be the FIRST thing
  const m = FRONT_RE.exec(text);
  if (m?.index !== 0) return null;
  // The group is optional, so it is undefined for an EMPTY block — the regex
  // matched, there is simply nothing in it. Undefined would read as "no
  // frontmatter", which is a different fact.
  return m[1] ?? '';
}

/**
 * Does this document carry an embedded `sign:` block?
 *
 * Matches a top-level `sign:` key only — indented `sign:` inside some other
 * mapping is a different field and not our business.
 */
export function hasEmbeddedSeal(text) {
  const fm = frontmatter(text);
  if (fm === null) return false;
  return /^sign:[ \t]*\r?$/m.test(fm) || /^sign:[ \t]*\r?\n[ \t]+\w/m.test(fm);
}

/**
 * Throw when a detached signer is pointed at an embedded-format document.
 *
 * Deliberately narrow: it refuses SEALED documents, not markdown. A .md with no
 * `sign:` block signs normally — the guard exists to stop a wrong result, not
 * to ban a file type.
 */
export function assertNotEmbeddedFormat(text, path) {
  if (!hasEmbeddedSeal(text)) return;
  const err = new Error(
    `refusing to sign ${path}\n\n` +
      `  It carries an embedded \`sign:\` block, which means it is sealed in the\n` +
      `  EMBEDDED form: a body-hash over the canonical body, written into the\n` +
      `  document's own frontmatter.\n\n` +
      `  This tool produces the DETACHED form: a file_hash over the file's exact\n` +
      `  bytes, in a .bonsaisig envelope beside it. Pointing it at a sealed\n` +
      `  document would hash the stale seal along with the body and hand back a\n` +
      `  signature that attests nothing anyone will check.\n\n` +
      `  To re-seal an embedded document:\n` +
      `      python3 tools/sign.py sign-verify ${path} --as <slug>\n\n` +
      `  Teaching this tool the embedded form is sequenced in\n` +
      `  rituals/specs/spec-signing-node-parity.md. Until then the two forms are\n` +
      `  separate on purpose, and this refusal is the separation.`,
  );
  err.code = 'EMBEDDED_FORMAT';
  throw err;
}
