// ---
// id: 01M4AFY7G9MRDDYWZ8NXGV2ZST
// title: Each guard of the reserved set broken on purpose, and watched to fail
// type: script
// tended-by: baisai
// created: 2026-10-07
// updated: 2026-10-22
// ---
//
// test-reserved-marks-mutants.mjs — a guard is not trusted until it has been watched to fail.
//
// For each guard in reserved-marks.mjs, origin.mjs, namespace.mjs and keys.mjs' reserved-set
// line: copy the three skills (mark, sign, keys) into scratch, break that one guard with exact
// text replacements, and run the cases of test-reserved-marks.mjs that plant its condition
// against the broken copy. KILLED when every named case FAILS; a survivor fails the harness; a
// replacement that does not match exactly once is a harness error, never a pass. One mutant per
// guard, and each names the cases that watch it, so a case that passes for another guard's
// refusal shows up here as a survivor.
//
//   node skills/bonsai-garden-mark/test-reserved-marks-mutants.mjs            every mutant
//   node skills/bonsai-garden-mark/test-reserved-marks-mutants.mjs --only n,m
//
// The real tree is never modified.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS = path.dirname(HERE);
const TMP = fs.mkdtempSync(path.join(process.env.RESERVED_TEST_TMP || os.tmpdir(), 'reserved-mutants-'));
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;

const M = 'bonsai-garden-mark/reserved-marks.mjs';
const O = 'bonsai-garden-mark/origin.mjs';
const N = 'bonsai-garden-mark/namespace.mjs';
const K = 'bonsai-garden-keys/bin/keys.mjs';
const D = 'bonsai-garden-mark/release-manifest.mjs';

// [name, [[file, find, replace], ...], [cases that must go red]]
const MUTANTS = [
  // §6.5 row 1, hand-added: with the roster (A) and without it (B, the wildcard)
  [
    'no-hand-added-in-A',
    [
      [
        M,
        '          if (!derivedA.has(i) && !was?.A.has(i))\n            add(R.HAND, `A holds ${i} ${chars([i])}, which no source derives and which never shipped`);',
        '          if (false) add(R.HAND, `A holds ${i} ${chars([i])}, which no source derives and which never shipped`);',
      ],
    ],
    ['hand-added', 'check-first-generation-must-equal-the-derivation'],
  ],
  [
    'no-hand-added-in-B',
    [
      [
        M,
        '          if (!base.includes(i) && !was?.[s].has(i))\n            add(R.HAND, `${s} holds ${i} ${chars([i])}, which no source derives and which never shipped`);',
        '          if (false) add(R.HAND, `${s} holds ${i} ${chars([i])}, which no source derives and which never shipped`);',
      ],
    ],
    ['check-hand-added-in-B-without-the-roster'],
  ],
  // row 2, only grows
  [
    'no-only-grows',
    [
      [
        M,
        '      if (was)\n        for (const s of SETS) for (const i of was[s]) if (!sets[s].has(i)) add(R.LEFT, `${s} lost ${i} ${chars([i])}`);',
        '      if (false) add(R.LEFT, `${s} lost ${i} ${chars([i])}`);',
      ],
    ],
    ['an-index-left-the-set', 'check-staged-reads-the-index'],
  ],
  [
    'the-set-may-leave-core',
    [[M, 'if (head !== null || everShipped(coreRoot, rel)) add(R.LEFT', 'if (false) add(R.LEFT']],
    ['check-the-set-cannot-leave-core'],
  ],
  [
    'left-core-only-while-in-head',
    [[M, 'if (head !== null || everShipped(coreRoot, rel)) add(R.LEFT', 'if (head !== null) add(R.LEFT']],
    ['check-the-set-cannot-leave-core'],
  ],
  [
    'staged-reads-the-tree',
    [
      [
        M,
        '  const readNow = (r) =>\n    staged\n      ? gitShow(coreRoot, `:${r}`)',
        '  const readNow = (r) =>\n    false\n      ? gitShow(coreRoot, `:${r}`)',
      ],
    ],
    ['check-staged-reads-the-index'],
  ],
  // row 3, stale
  [
    'no-stale-skill',
    [
      [
        M,
        '    for (const sk of skills)\n      if (!sets.A.has(sk.index))\n        add(\n          R.STALE,',
        '    for (const sk of skills)\n      if (false)\n        add(\n          R.STALE,',
      ],
    ],
    ['stale-regenerate'],
  ],
  [
    'no-stale-roster',
    [
      [
        M,
        "        for (const r of roster)\n          if (r.index !== null && !sets.A.has(r.index))\n            add(R.STALE, `${r.slug}'s first kanji ${chars([r.index])} (${r.index}) is not in A; regenerate in core`);",
        "        for (const r of roster)\n          if (false)\n            add(R.STALE, `${r.slug}'s first kanji ${chars([r.index])} (${r.index}) is not in A; regenerate in core`);",
      ],
    ],
    [
      'stale-regenerate',
      'check-first-generation-must-equal-the-derivation',
      'check-cli-exits-1-and-names-regenerate-in-core',
    ],
  ],
  // row 4, the floor, part by part
  [
    'floor-without-wildcard',
    [
      [
        M,
        '    if (!sets.wildcard.has(w)) out.push({ reason: R.FLOOR, detail: `the wildcard does not hold ${chars([w])} (${w})` });\n  for (const b of B0)',
        '    if (false) out.push({ reason: R.FLOOR, detail: `the wildcard does not hold ${chars([w])} (${w})` });\n  for (const b of B0)',
      ],
    ],
    ['under-the-floor'],
  ],
  [
    'floor-without-set-b',
    [
      [
        M,
        '  for (const b of B0)\n    if (!sets.B.has(b))\n      out.push({',
        '  for (const b of B0)\n    if (false)\n      out.push({',
      ],
    ],
    ['under-the-floor'],
  ],
  [
    'floor-b-drops-bon',
    [
      [
        M,
        "export const B_CHARS = Object.freeze(['才', '身', '園', '技', '庭', '盆']);",
        "export const B_CHARS = Object.freeze(['才', '身', '園', '技', '庭']);",
      ],
    ],
    ['under-the-floor', 'the-rule-constants-are-the-set'],
  ],
  [
    'floor-without-a-count',
    [[M, '  if (sets.A.size < MIN_A)\n    out.push({', '  if (false)\n    out.push({']],
    ['under-the-floor', 'reader-refuses-a-sealed-set-under-the-floor-offline', 'generator-refuses-under-the-floor'],
  ],
  [
    'floor-a-of-32',
    [[M, 'export const MIN_A = 33;', 'export const MIN_A = 32;']],
    ['under-the-floor', 'reader-refuses-a-sealed-set-under-the-floor-offline', 'generator-refuses-under-the-floor'],
  ],
  // row 5, not the format
  [
    'unsorted-accepted',
    [[M, 'if (ints.some((i, n) => n > 0 && ints[n - 1] > i)) add(R.FORMAT', 'if (false) add(R.FORMAT']],
    ['not-the-format'],
  ],
  ['duplicate-accepted', [[M, 'if (seen.has(i)) add(R.FORMAT', 'if (false) add(R.FORMAT']], ['not-the-format']],
  [
    'out-of-range-accepted',
    [
      [
        M,
        '      if (i < 0 || i > 1023) {\n        add(R.FORMAT, `${s} holds ${i}, outside 0..1023`);',
        '      if (false) {\n        add(R.FORMAT, `${s} holds ${i}, outside 0..1023`);',
      ],
    ],
    ['not-the-format'],
  ],
  [
    'string-index-accepted',
    [
      [
        M,
        '      if (!Number.isInteger(i)) {\n        add(R.FORMAT, `${s} holds ${JSON.stringify(i)}, not an integer index`);',
        '      if (false) {\n        add(R.FORMAT, `${s} holds ${JSON.stringify(i)}, not an integer index`);',
      ],
    ],
    ['not-the-format'],
  ],
  [
    'maru-in-A-accepted',
    [[M, 'if (Array.isArray(data.A) && data.A.includes(0)) add(R.FORMAT', 'if (false) add(R.FORMAT']],
    ['not-the-format'],
  ],
  [
    'bytes-not-the-serialiser',
    [
      [
        M,
        "    if (!problems.length && cur.toString('utf8') !== serialize(data))\n      add(R.FORMAT, 'not the bytes the generator writes (JSON.stringify(obj, null, 2) + \"\\\\n\")');",
        '    if (false) add(R.FORMAT, \'not the bytes the generator writes (JSON.stringify(obj, null, 2) + "\\\\n")\');',
      ],
    ],
    ['check-refuses-bytes-not-written-by-the-generator'],
  ],
  // row 6, no columns
  [
    'a-sixth-key-accepted',
    [
      [
        M,
        "if (!KEYS.includes(k) && k !== 'pairs' && k !== 'set-a' && k !== 'set-b') add(R.COLUMNS",
        'if (false) add(R.COLUMNS',
      ],
    ],
    ['no-columns'],
  ],
  [
    'an-object-in-a-set-accepted',
    [
      [
        M,
        "    if (Array.isArray(data[s]) && data[s].some((v) => v !== null && typeof v === 'object'))\n      add(R.COLUMNS, `an object in ${s}`);",
        '    if (Array.isArray(data[s]) && data[s].some(() => false)) add(R.COLUMNS, `an object in ${s}`);',
      ],
    ],
    ['no-columns'],
  ],
  // row 7, header
  ['header-line-unchecked', [[M, 'if (line !== ABOUT[i]) add(R.HEADER', 'if (false) add(R.HEADER']], ['header']],
  [
    'header-count-unchecked',
    [
      [
        M,
        "    if (!Array.isArray(a) || a.length !== ABOUT.length)\n      add(R.HEADER, `the about lines are not Chisai's three (${Array.isArray(a) ? a.length : typeof a})`);",
        "    if (!Array.isArray(a))\n      add(R.HEADER, `the about lines are not Chisai's three (${Array.isArray(a) ? a.length : typeof a})`);",
      ],
    ],
    ['header'],
  ],
  // row 8, the pair list and one shape
  [
    'pair-list-read-again',
    [[M, "if ('pairs' in data) add(R.PAIRS", 'if (false) add(R.PAIRS']],
    ['the-pair-list-and-one-shape', 'reader-refuses-a-sealed-pair-list-offline'],
  ],
  [
    'aliases-read-again',
    [
      [
        M,
        "  for (const alias of ['set-a', 'set-b'])\n    if (alias in data) add(R.ONE_SHAPE, `\"${alias}\"; the reader reads wildcard, A and B only`);\n  for (const k of Object.keys(data)) {",
        "  for (const alias of ['set-a', 'set-b'])\n    if (false) add(R.ONE_SHAPE, `\"${alias}\"; the reader reads wildcard, A and B only`);\n  for (const k of Object.keys(data)) {",
      ],
    ],
    ['the-pair-list-and-one-shape'],
  ],
  // row 9, the seal's hash
  [
    'hash-unchecked',
    [
      [
        M,
        "  if (blake(bytes) !== data['file-hash'])\n    return { reason: R.HASH, detail: 'the file is not the bytes that were sealed: edited after its seal' };",
        "  if (false) return { reason: R.HASH, detail: 'the file is not the bytes that were sealed: edited after its seal' };",
      ],
    ],
    ['edited-after-its-seal'],
  ],
  // rows 10 and 11, the origin's word
  [
    'reader-skips-the-origin',
    [[M, 'const v = await origin.ask(s.data);', "const v = { status: 'signature-vouched' };"]],
    ['a-seal-the-site-does-not-vouch-for', 'unreachable-halts', 'reader-believes-a-vouched-set-and-asks-once'],
  ],
  [
    'reader-believes-any-answer',
    [
      [
        M,
        "    if (v.status !== 'signature-vouched')\n      throw wrap(v.status, v.reason || \"bon-sai.garden does not vouch for the reserved set's seal\");",
        '    if (false) throw wrap(v.status, v.reason || "bon-sai.garden does not vouch for the reserved set\'s seal");',
      ],
    ],
    ['a-seal-the-site-does-not-vouch-for'],
  ],
  [
    'manifest-reader-believes-any-answer',
    [
      [
        M,
        "  if (v.status !== 'signature-vouched')\n    throw wrap(v.status, v.reason || `bon-sai.garden does not vouch for ${found.name}'s seal`);",
        "  if (false) throw wrap(v.status, v.reason || `bon-sai.garden does not vouch for ${found.name}'s seal`);",
      ],
    ],
    ['m-the-site-unreachable-forged-unsigned-rejected-or-timeless', 'm-re-sealed-by-a-writer-slug-whose-key-the-site-does-not-hold'],
  ],
  [
    'unreachable-refuses-instead-of-halting',
    [
      [
        M,
        "the reserved set's seal cannot be checked, so nothing is searched`, 3);",
        "the reserved set's seal cannot be checked, so nothing is searched`, 2);",
      ],
    ],
    ['unreachable-halts'],
  ],
  [
    'origin-time-from-an-unbelieved-answer',
    [
      [
        O,
        "        verifiedAt: v.status === 'signature-vouched' ? verifiedAt : null,\n",
        '        verifiedAt,\n',
      ],
    ],
    ['origin-keeps-the-signed-time-only-when-vouched'],
  ],
  // the reader's own guards
  // the question goes out only after every offline check holds (a well-formed sidecar is sent, so the site is reached)
  [
    'reader-asks-before-the-offline-checks',
    [
      [
        M,
        'if (!s.data) throw wrap(s.reason, s.detail);',
        'if (!s.data) { if (sideText) await origin.ask(JSON.parse(sideText)); throw wrap(s.reason, s.detail); }',
      ],
    ],
    ['edited-after-its-seal', 'reader-refuses-a-custodian-seal', 'reader-refuses-an-open-seal'],
  ],
  [
    'reader-skips-the-floor',
    [
      [
        M,
        "const sets = parseReserved(bytes.toString('utf8'));\n\n  if (!found) {",
        'const sets = ((d) => ({ wildcard: new Set(d.wildcard || []), A: new Set(d.A || []), B: new Set(d.B || []) }))(JSON.parse(bytes));\n\n  if (!found) {',
      ],
    ],
    [
      'reader-refuses-a-sealed-set-under-the-floor-offline',
      'reader-refuses-a-sealed-pair-list-offline',
      'm-re-sealed-by-a-writer-the-site-holds-is-believed-and-the-floor-still-stands',
    ],
  ],
  [
    'unsealed-read-as-a-seal',
    [[M, 'if (sideText === null || sideText === undefined) {', 'if (false) {']],
    ['reader-refuses-an-unsealed-set', 'check-refuses-an-unsealed-set'],
  ],
  [
    'custodian-seal-believed',
    [[M, "  if (data.role !== 'owner')\n    return {", '  if (false)\n    return {']],
    ['reader-refuses-a-custodian-seal'],
  ],
  [
    'open-seal-believed',
    [
      [
        M,
        "  if ('open' in data)\n    return { reason: R.NOT_OWNER, detail: 'an open seal is a declaration of work in progress, not a seal on a rule' };",
        "  if (false)\n    return { reason: R.NOT_OWNER, detail: 'an open seal is a declaration of work in progress, not a seal on a rule' };",
      ],
    ],
    ['reader-refuses-an-open-seal'],
  ],
  // F-12 (spec 0.7.0 §6.4 point 3): the reader takes the target as a path, no verdict; the drift gate keeps it
  [
    'reader-refuses-on-the-target-again',
    [[M, 'const s = sealProblem(bytes, sideText, { place: false });', 'const s = sealProblem(bytes, sideText, { place: true });']],
    ['reader-takes-the-target-as-a-path-not-a-verdict'],
  ],
  // spec 0.7.0 §6.4 points 3 to 5: the release manifest, each guard broken alone
  [
    'any-vouched-kin-may-seal-the-set',
    [[M, '  if (s.data.signer !== SET_OWNER)\n', '  if (false)\n']],
    ['no-manifest-the-set-sealed-by-a-vouched-kin-who-is-not-mori-shin', 'm-the-sidecar-unlisted-or-not-mori-shins'],
  ],
  [
    'the-manifest-is-never-read',
    [[M, '  const found = root ? findManifest(root, wl.manifests) : null;', '  const found = null;']],
    ['m-sealed-by-a-vouched-kin-who-is-no-writer', 'm-believed-through-the-manifest-asks-once-and-hands-back-the-record'],
  ],
  [
    'any-vouched-kin-may-seal-the-manifest',
    [[D, '  if (!writers.includes(seal.signer))\n', '  if (false)\n']],
    ['m-sealed-by-a-vouched-kin-who-is-no-writer', 'm-the-writers-are-the-list-beside-the-reader'],
  ],
  [
    'manifest-custodian-believed',
    [[D, "  if (seal.role !== 'owner') return no(", '  if (false) return no(']],
    ['m-sealed-by-a-writer-not-owner-or-open'],
  ],
  [
    'manifest-open-believed',
    [[D, "  if ('open' in seal)\n", '  if (false)\n']],
    ['m-sealed-by-a-writer-not-owner-or-open'],
  ],
  [
    'a-fallback-seal-is-a-release',
    [[D, '  if (seal.custody === NO_RELEASE_TIER)\n', '  if (false)\n']],
    ['m-a-software-fallback-seal-is-no-release'],
  ],
  [
    'manifest-bytes-unchecked',
    [[D, "  if (blake(bytes) !== seal['file-hash'])\n", '  if (false)\n']],
    ['m-the-manifest-edited-after-its-seal'],
  ],
  [
    'manifest-any-format',
    [[D, '  if (!m || m.format !== RELEASE_FORMAT)\n', '  if (!m)\n']],
    ['m-another-format-or-a-path-twice'],
  ],
  [
    'manifest-a-path-twice',
    [[D, '    if (byPath.has(e.path)) return no(', '    if (false) return no(']],
    ['m-another-format-or-a-path-twice'],
  ],
  [
    'the-set-and-its-sidecar-unlisted',
    [[M, '    for (const rel of [SHIPPED_TARGET, sidecarRel(SHIPPED_TARGET)]) {', '    for (const rel of []) {']],
    ['m-one-index-changed-the-manifest-not', 'm-the-sidecar-unlisted-or-not-mori-shins'],
  ],
  [
    'no-mixed-cut',
    [[M, '    if (mx) throw say(mx);', '    if (false) throw say(mx);']],
    ['m-one-file-of-the-three-skills-differs-a-mixed-cut', 'm-the-files-still-equal-the-manifest-when-the-record-is-taken'],
  ],
  [
    'mixed-cut-reads-one-skill',
    [[D, "export const ARC_SKILLS = Object.freeze(['bonsai-garden-keys', 'bonsai-garden-mark', 'bonsai-garden-sign']);", "export const ARC_SKILLS = Object.freeze(['bonsai-garden-mark']);"]],
    ['m-one-file-of-the-three-skills-differs-a-mixed-cut', 'm-the-files-still-equal-the-manifest-when-the-record-is-taken'],
  ],
  [
    'a-lost-exec-bit-reads-as-a-mixed-cut',
    [[D, '    if (p && p.reason !== M.MODE) return { reason: M.MIXED,', '    if (p) return { reason: M.MIXED,']],
    ['m-a-stated-100755-on-a-file-that-is-not-executable-refuses-naming-it-and-the-fix'],
  ],
  [
    'a-lost-exec-bit-names-only-the-first',
    [[D, '    if (p) off.push(rel);', '    if (p && !off.length) off.push(rel);']],
    ['m-every-lost-exec-bit-of-the-three-skills-is-named-in-one-refusal-with-one-fix'],
  ],
  [
    'manifest-unreachable-refuses',
    [[M, "seal cannot be checked, so nothing is searched`, 3);\n  if (v.status !== 'signature-vouched')\n    throw wrap(v.status, v.reason || `bon-sai.garden", "seal cannot be checked, so nothing is searched`, 2);\n  if (v.status !== 'signature-vouched')\n    throw wrap(v.status, v.reason || `bon-sai.garden"]],
    ['m-the-site-unreachable-forged-unsigned-rejected-or-timeless'],
  ],
  [
    'manifest-answer-without-its-time',
    [[M, '  if (!v.verifiedAt)\n    throw wrap(', '  if (false)\n    throw wrap(']],
    ['m-the-site-unreachable-forged-unsigned-rejected-or-timeless'],
  ],
  [
    'a-record-is-never-taken',
    [[M, '  if (record && record.manifest === fields.manifest && record.sha256 === fields.sha256) {', '  if (false) {']],
    ['m-a-record-stands-in-for-the-question'],
  ],
  [
    'a-record-for-other-bytes-is-taken',
    [[M, '  if (record && record.manifest === fields.manifest && record.sha256 === fields.sha256) {', '  if (record && record.manifest === fields.manifest) {']],
    ['m-a-record-for-other-bytes-is-asked-again'],
  ],
  [
    'a-record-taken-unchecked',
    [[M, '    if (off.length)\n      throw wrap(\n        R.RECORD,', '    if (false)\n      throw wrap(\n        R.RECORD,']],
    ['m-a-record-that-disagrees-with-its-manifest-is-a-finding'],
  ],
  [
    'missing-set-is-empty',
    [
      [
        M,
        '  } catch (e) {\n    throw wrap(R.MISSING, `${file} cannot be read (${e.code || e.message}); never search without the shipped set`);\n  }',
        '  } catch (e) {\n    return ruleOf({ wildcard: new Set(), A: new Set(), B: new Set() });\n    throw wrap(R.MISSING, `${file} cannot be read (${e.code || e.message}); never search without the shipped set`);\n  }',
      ],
    ],
    ['reader-refuses-a-missing-set'],
  ],
  // the generator's own guards
  [
    'typed-mark-accepted',
    [[M, 'if (spelled !== mark) {', 'if (false) {']],
    ['generator-refuses-a-typed-skill-mark', 'check-refuses-a-typed-skill-mark'],
  ],
  [
    'mark-without-salt-accepted',
    [[M, "if (!fm['mark-salt']?.value) {", 'if (false) {']],
    ['generator-refuses-a-mark-without-its-salt'],
  ],
  [
    'unknown-kanji-accepted',
    [[M, 'if (!k) throw new Refusal(R.INPUT,', 'if (!k) return 0; if (!k) throw new Refusal(R.INPUT,']],
    ['generator-refuses-a-kanji-outside-the-set'],
  ],
  [
    'roster-optional',
    [
      [
        M,
        '  if (!registryPath)\n    throw new Refusal(R.INPUT, "--registry <the origin\'s agents/registry.json> is required; it has no default");',
        '  if (false)\n    throw new Refusal(R.INPUT, "--registry <the origin\'s agents/registry.json> is required; it has no default");',
      ],
    ],
    ['generator-needs-the-roster'],
  ],
  [
    'roster-without-agents',
    [
      [
        M,
        '  if (!data || typeof data !== \'object\' || !Array.isArray(data.agents))\n    throw new Refusal(R.INPUT, `${registryPath} has no "agents" list`);',
        '  if (false) throw new Refusal(R.INPUT, `${registryPath} has no "agents" list`);',
      ],
    ],
    ['generator-needs-the-roster'],
  ],
  [
    'maru-into-A',
    [
      [
        M,
        '      out.push({\n        slug: e.slug,\n        kanji: e.kanji,\n        index: null,\n        source: `${source}: 〇 is the wildcard, already reserved everywhere`,\n      });\n      continue;',
        '      out.push({\n        slug: e.slug,\n        kanji: e.kanji,\n        index: 0,\n        source: `${source}: 〇 is the wildcard, already reserved everywhere`,\n      });\n      continue;',
      ],
      [
        M,
        '  const obj = {\n    format: FORMAT,\n    about: [...ABOUT],\n    wildcard: sorted(src.wildcard),\n    A: sorted(src.A).filter((i) => i !== 0),\n    B: sorted(src.B),\n  };',
        '  const obj = { format: FORMAT, about: [...ABOUT], wildcard: sorted(src.wildcard), A: sorted(src.A), B: sorted(src.B) };',
      ],
    ],
    ['maru-in-the-roster-is-not-in-A'],
  ],
  [
    'generator-forgets-what-shipped',
    [
      [
        M,
        "    for (const s of SETS)\n      for (const i of committed[s])\n        if (!src[s].has(i)) put(s, i, 'the committed file: shipped before, and it only grows');\n  }",
        "    for (const s of SETS)\n      for (const i of committed[s]) if (false) put(s, i, 'the committed file: shipped before, and it only grows');\n  }",
      ],
    ],
    ['generator-keeps-what-shipped'],
  ],
  [
    'generator-below-the-floor',
    [
      [
        M,
        'const floor = floorProblems(toSets(obj));\n  if (floor.length) throw',
        'const floor = floorProblems(toSets(obj));\n  if (false) throw',
      ],
    ],
    ['generator-refuses-under-the-floor'],
  ],
  [
    'generator-not-deterministic',
    [
      [
        M,
        '    about: [...ABOUT],\n    wildcard: sorted(src.wildcard),\n    A: sorted(src.A).filter((i) => i !== 0),',
        '    about: [...ABOUT],\n    generated: new Date().toISOString() + Math.random(),\n    wildcard: sorted(src.wildcard),\n    A: sorted(src.A).filter((i) => i !== 0),',
      ],
    ],
    ['two-generator-runs-are-byte-identical', 'first-generation-equals-the-derivation'],
  ],
  [
    'generate-lists-nothing',
    [
      [
        M,
        "        for (const [n, line] of lines.entries())\n          console.log(\n            n === 0 ? `${String(i).padEnd(6)} ${chars([i])}     ${s.padEnd(9)} ${line}` : `${''.padEnd(25)} ${line}`,\n          );",
        "        for (const [n, line] of lines.entries())\n          void (n === 0 ? `${String(i).padEnd(6)} ${chars([i])}     ${s.padEnd(9)} ${line}` : `${''.padEnd(25)} ${line}`);",
      ],
    ],
    ['generate-lists-every-index-with-its-source'],
  ],
  // row 14, the flag that named a weaker file: back in each binary
  [
    'exclude-back-in-keys',
    [
      [K, "    if (k === 'exclude')\n      throw usage(", '    if (false)\n      throw usage('],
      [
        K,
        "  'out',\n  'file',\n  'pair',\n  'fp-attests',\n  'pick',",
        "  'out',\n  'file',\n  'exclude',\n  'pair',\n  'fp-attests',\n  'pick',",
      ],
    ],
    ['the-exclude-flag-is-gone'],
  ],
  [
    'exclude-back-in-namespace',
    [
      [N, "    if (k === 'exclude')\n      throw Object.assign(", '    if (false)\n      throw Object.assign('],
      [
        N,
        "if (!['name', 'slug', 'garden', 'pair'].includes(k))",
        "if (!['name', 'slug', 'garden', 'pair', 'exclude'].includes(k))",
      ],
    ],
    ['the-exclude-flag-is-gone'],
  ],
];

let killed = 0,
  survived = 0,
  broken = 0,
  ran = 0;
for (const [name, edits, cases] of MUTANTS) {
  if (only && !only.includes(name)) continue;
  ran++;
  const dir = path.join(TMP, name);
  for (const s of ['bonsai-garden-keys', 'bonsai-garden-sign', 'bonsai-garden-mark']) {
    fs.cpSync(path.join(SKILLS, s), path.join(dir, s), { recursive: true });
  }
  let bad = null;
  for (const [file, find, repl] of edits) {
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, 'utf8');
    const count = src.split(find).length - 1;
    if (count !== 1) {
      bad = `${file}: the replacement matches ${count} times, not once`;
      break;
    }
    fs.writeFileSync(
      p,
      src.replace(find, () => repl),
    );
  }
  if (bad) {
    broken++;
    console.log(`BROKEN    ${name}  — ${bad}`);
    continue;
  }
  const r = spawnSync(process.execPath, [path.join(HERE, 'test-reserved-marks.mjs'), '--only', cases.join(',')], {
    env: { ...process.env, RESERVED_MARK_DIR: path.join(dir, 'bonsai-garden-mark'), RESERVED_TEST_TMP: TMP },
    encoding: 'utf8',
    timeout: 900000,
  });
  const out = r.stdout || '';
  const red = cases.filter((c) => new RegExp(`^FAIL  ${c}\\b`, 'm').test(out));
  const missing = cases.filter((c) => !new RegExp(`^(PASS|FAIL)  ${c}\\b`, 'm').test(out));
  if (missing.length) {
    broken++;
    console.log(`BROKEN    ${name}  — no such case: ${missing.join(', ')}`);
    continue;
  }
  if (r.status !== 0 && red.length === cases.length) {
    killed++;
    console.log(`KILLED    ${name}  — red: ${red.join(', ')}`);
  } else {
    survived++;
    console.log(
      `SURVIVED  ${name}  — ${cases.length - red.length} of ${cases.length} case(s) stayed green\n${out
        .split('\n')
        .filter((l) => /^(PASS|FAIL)/.test(l))
        .map((l) => `            ${l.slice(0, 160)}`)
        .join('\n')}`,
    );
  }
}
console.log(
  `\n${killed}/${ran} mutants killed${survived ? `, ${survived} SURVIVED` : ''}${broken ? `, ${broken} BROKEN` : ''}   (scratch: ${TMP})`,
);
process.exit(survived || broken ? 1 : 0);
