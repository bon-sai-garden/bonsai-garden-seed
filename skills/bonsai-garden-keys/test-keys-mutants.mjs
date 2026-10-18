// ---
// id: 01M49AB833SHNZY2A3X2QX1Z3Q
// title: Each guard of the gardener's keys broken on purpose, and watched to fail
// type: script
// tended-by: baisai
// created: 2026-10-06
// updated: 2026-10-15
// ---
//
// test-keys-mutants.mjs — a guard is not trusted until it has been watched to fail.
//
// For each guard: copy the three skills (keys, sign, mark) into a scratch directory, break that
// guard with one exact text replacement (or a few, where the refusal is held twice, in depth), and
// run the cases of test-keys.mjs that plant its condition against the broken copy. The mutant is
// KILLED when every named case FAILS. A mutant that survives is a guard nobody would miss: the
// harness fails. A replacement that does not match exactly once is a harness error, never a pass.
//
//   node skills/bonsai-garden-keys/test-keys-mutants.mjs            every mutant
//   node skills/bonsai-garden-keys/test-keys-mutants.mjs --only n,m  the named mutants
//
// The real tree is never modified.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILLS = path.dirname(HERE);
const TMP = fs.mkdtempSync(path.join(process.env.KEYS_TEST_TMP || os.tmpdir(), 'keys-mutants-'));
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;

const K = 'bonsai-garden-keys/bin/keys.mjs';
const C = 'bonsai-garden-keys/lib/custody.mjs';
const E = 'bonsai-garden-keys/lib/envelope.mjs';
const N = 'bonsai-garden-mark/namespace.mjs';
const G = 'bonsai-garden-keys/lib/garden.mjs';
const RM = 'bonsai-garden-mark/reserved-marks.mjs'; // the floor and the rule moved here with the shipped reserved set
const PV = 'bonsai-garden-keys/lib/pot-verdict.mjs'; // the pot's verify moved here from keys.mjs (13b5672, 2026-10-11)

// [name, [[file, find, replace], ...], [cases that must go red]]
const MUTANTS = [
  [
    'put-skips-exists',
    [
      [
        C,
        "  const st = await b.status(garden);\n  if (st.present)\n    throw new CustodyError(\n      'EXISTS',",
        "  const st = await b.status(garden);\n  if (false)\n    throw new CustodyError(\n      'EXISTS',",
      ],
    ],
    ['put-refuses-existing-before-a-byte'],
  ],
  [
    'mint-overwrites',
    [
      [K, "  if (d.verdict === 'derive') {\n    throw refuse(", '  if (false) {\n    throw refuse('],
      [
        C,
        "  const st = await b.status(garden);\n  if (st.present)\n    throw new CustodyError(\n      'EXISTS',",
        "  const st = await b.status(garden);\n  if (false)\n    throw new CustodyError(\n      'EXISTS',",
      ],
    ],
    ['mint-over-existing-item-refused'],
  ],
  [
    'mint-ignores-cannot-tell',
    [
      [
        K,
        "  if (d.verdict === 'cannot-tell') throw halt(d.reason);\n  if (d.verdict === 'derive')",
        "  if (d.verdict === 'derive')",
      ],
    ],
    ['mint-on-cannot-tell-halts'],
  ],
  [
    'detect-ignores-errors',
    [[C, "if (errored.length) return out('cannot-tell'", "if (false) return out('cannot-tell'"]],
    ['mint-on-erroring-backend-halts'],
  ],
  [
    'detect-steps-down-past-locked',
    [
      [
        C,
        'const usable = rows.filter((r) => r.available)',
        'const usable = rows.filter((r) => r.available && r.unlocked !== false)',
      ],
    ],
    ['detect-never-steps-down-past-a-locked-keystore'],
  ],
  [
    'no-floor',
    [[K, 'function floor(name, tier, labPreview) {', 'function floor(name, tier, labPreview) { return;']],
    ['floor-refuses-fallback-without-lab-preview'],
  ],
  [
    'floor-reads-env',
    [[K, '  if (labPreview) return;', '  if (labPreview || process.env.BONSAI_LAB_PREVIEW) return;']],
    ['floor-refuses-fallback-without-lab-preview'],
  ],
  [
    'no-readback-compare',
    [
      [
        C,
        "  }\n  if (back !== hex)\n    throw new CustodyError(\n      'CUSTODY_FAULT',",
        "  }\n  if (false)\n    throw new CustodyError(\n      'CUSTODY_FAULT',",
      ],
      [
        K,
        '  if (back !== hex)\n    throw halt(`custody fault: ${b.name} read back something other than what it was given; nothing was deleted`);',
        '  if (false)\n    throw halt(`custody fault: ${b.name} read back something other than what it was given; nothing was deleted`);',
      ],
    ],
    ['readback-mismatch-is-a-custody-fault'],
  ],
  [
    'tier-not-recorded',
    [
      [
        K,
        "    'custody-tier': d.tier,\n    'lab-preview': lab,",
        "    'custody-tier': 'os-protected',\n    'lab-preview': lab,",
      ],
    ],
    ['lab-preview-proceeds-and-names-the-tier'],
  ],
  [
    'short-passphrase-accepted',
    [
      [K, 'if ([...a].length < 12) throw refuse(', 'if (false) throw refuse('],
      [
        E,
        "if (typeof passphrase !== 'string' || [...passphrase].length < MIN_PASSPHRASE) {",
        "if (typeof passphrase !== 'string') {",
      ],
    ],
    ['export-refuses-short-passphrase-and-the-pot'],
  ],
  [
    'export-into-the-pot',
    [[K, '    if (withinByInode(ctx.pot, path.dirname(out))) {', '    if (false) {']],
    ['export-refuses-short-passphrase-and-the-pot', 'export-refuses-the-pot-by-any-name'],
  ],
  // F1, both rounds: containment by spelling instead of identity, each way it was or could be spelled
  [
    'containment-by-path-string',
    [
      [
        G,
        '    if (s.dev === d.dev && s.ino === d.ino) return true;',
        '    if (p === fs.realpathSync(dir)) return true;',
      ],
    ],
    ['export-refuses-the-pot-by-another-spelling'],
  ], // red where the volume folds (APFS); see the case
  [
    'containment-lexical-climb',
    [[G, '  let p = fs.realpathSync(start);', '  let p = path.resolve(start);']],
    ['export-refuses-a-link-into-a-directory-inside-the-pot'],
  ],
  [
    'containment-skips-the-out-dir',
    [[G, '  let p = fs.realpathSync(start);', '  let p = path.dirname(fs.realpathSync(start));']],
    ['export-refuses-the-pot-by-any-name'],
  ],
  [
    'containment-too-wide',
    [[G, '    if (up === p) return false;', '    if (up === p) return true;']],
    ['export-outside-the-pot-still-works'],
  ],
  // Fuji-shin's second round: his two real survivors, and the two he called equivalent, made observable
  [
    'floor-b-drops-bon',
    [
      [
        RM,
        "export const B_CHARS = Object.freeze(['才', '身', '園', '技', '庭', '盆']);",
        "export const B_CHARS = Object.freeze(['才', '身', '園', '技', '庭']);",
      ],
    ],
    ['reserved-set-floor'],
  ],
  [
    'floor-wildcard-any',
    [
      [
        RM,
        '    if (!sets.wildcard.has(w)) out.push({ reason: R.FLOOR, detail: `the wildcard does not hold ${chars([w])} (${w})` });\n  for (const b of B0)',
        '    if (!sets.wildcard.size) out.push({ reason: R.FLOOR, detail: `the wildcard does not hold ${chars([w])} (${w})` });\n  for (const b of B0)',
      ],
    ],
    ['reserved-set-floor'],
  ],
  [
    'export-taken-by-exists',
    [
      [
        K,
        '    try {\n      fs.lstatSync(out);\n      taken = true;\n    } catch {\n      /* free */\n    }',
        '    taken = fs.existsSync(out);',
      ],
    ],
    ['export-refuses-a-dangling-link-at-the-out-path'],
  ], // 3 (EEXIST at the write) instead of 2
  [
    'salt-fragment-case-sensitive',
    [
      [
        G,
        '(doc.toLowerCase().includes(hex) || doc.toLowerCase().includes(hex.slice(0, 8)))',
        '(doc.includes(hex) || doc.includes(hex.slice(0, 8)))',
      ],
    ],
    ['attest-refuses-a-fragment-in-upper-case'],
  ],
  // the hidden prompt, on a pty
  [
    'prompt-echoes',
    [
      [
        K,
        "        if (c === '\\u007f') {\n          buf = buf.slice(0, -1);\n          continue;\n        }\n        buf += c;\n      }\n    };\n    s.on('data', on);\n  });\n}\n",
        "        if (c === '\\u007f') {\n          buf = buf.slice(0, -1);\n          continue;\n        }\n        buf += c;\n        process.stderr.write(c);\n      }\n    };\n    s.on('data', on);\n  });\n}\n",
      ],
    ],
    ['hidden-passphrase-prompt-on-a-tty'],
  ],
  [
    'drill-believes-anything',
    [
      [
        K,
        "    raw = openEnvelope(env, pass, g.garden);\n  } catch {\n    throw refuse('the drill FAILED: the passphrase does not open the export; nothing written');\n  }\n  try {",
        "    raw = openEnvelope(env, pass, g.garden);\n  } catch {\n    raw = Buffer.alloc(32);\n    if (false) throw refuse('the drill FAILED: the passphrase does not open the export; nothing written');\n  }\n  try {",
      ],
      [
        K,
        "    if (keyOf(hex, rootSalt(g.garden)).fingerprint !== g['root-fingerprint'])\n      throw refuse('the drill FAILED: the export derives another root; nothing written');",
        "    if (false) throw refuse('the drill FAILED: the export derives another root; nothing written');",
      ],
    ],
    ['drill-wrong-passphrase-fails-and-writes-nothing'],
  ],
  [
    'export-provenance-unchecked',
    [[K, '  if (!exportIsThisGardens(env, g))\n    throw refuse(', '  if (false)\n    throw refuse(']],
    ['drill-refuses-a-tampered-export'],
  ],
  // §6.1, 0.5.0: 盆 is never a first shown kanji, held twice (the search and the command)
  [
    'bon-first-allowed',
    [
      [K, '  if (bon) throw refuse(', '  if (false) throw refuse('],
      [N, '  chars(pair)[0] === BON', "  chars(pair)[0] === 'x'"],
    ],
    ['identity-refuses-bon-as-a-first-shown-kanji-for-every-entity'],
  ],
  // §7.3, §7.1: five attempts and the guardian's draw
  [
    'draw-keeps-the-wildcard-tail',
    [[N, 'if (!tailOk(idx)) continue;', 'if (false) continue;']],
    ['attempts-never-wear-the-wildcard-or-a-garden-third-kanji'],
  ],
  [
    'draw-takes-bon-first',
    [[N, 'if (exclude.reserved(p) || bonFirst(p)) continue;', 'if (exclude.reserved(p)) continue;']],
    ['the-draw-skips-a-taken-pair-the-namespaces-own-pair-and-a-bon-first-one'],
  ],
  [
    'draw-takes-a-taken-pair',
    [[N, 'if (takenS.has(p.join())) continue;', '']],
    ['the-draw-skips-a-taken-pair-the-namespaces-own-pair-and-a-bon-first-one'],
  ],
  [
    'draw-takes-the-namespaces-pair',
    [[N, 'if (nsFirstTwo && p[0] === nsFirstTwo[0] && p[1] === nsFirstTwo[1]) continue;', '']],
    ['the-draw-skips-a-taken-pair-the-namespaces-own-pair-and-a-bon-first-one'],
  ],
  [
    'guardian-may-choose-a-pair',
    [
      [
        K,
        '  if (guardian) {\n    if (ctx.f.pair)\n      throw refuse(\n        `${GUARDIAN} does not choose a pair: the rite draws five allowed IDs and the gardener picks one (spec §7.1); run identity ${GUARDIAN} --candidates`,',
        '  if (guardian) {\n    if (false)\n      throw refuse(\n        `${GUARDIAN} does not choose a pair: the rite draws five allowed IDs and the gardener picks one (spec §7.1); run identity ${GUARDIAN} --candidates`,',
      ],
    ],
    ['guardian-pair-is-refused-the-rite-renders-the-slug-does-not-choose'],
  ],
  [
    'pick-range-unchecked',
    [[K, 'if (!/^[1-5]$/.test(String(ctx.f.pick)))', 'if (false)']],
    ['identity-pick-out-of-range-is-refused-and-nothing-is-written'],
  ],
  [
    'pick-ignored',
    [[K, 'const id = pick ? five[pick - 1] : five[0];', 'const id = five[0];']],
    ['identity-pick-locks-the-chosen-attempt-and-the-lock-rederives'],
  ],
  [
    'check-locks-believes-a-typed-bon-first-guardian',
    [[N, 'const why = bonFirst(four.slice(0, 2));\n      if (why)', 'const why = null;\n      if (why)']],
    ['guardian-pick-locks-the-draw-and-a-hand-typed-guardian-salt-fails-check-locks'],
  ],
  [
    'derive-all-stops-at-the-root',
    [
      [
        K,
        'const slugs = all ? [g.name, ...Object.keys(locks.agents)] : [slug];',
        'const slugs = all ? [g.name] : [slug];',
      ],
    ],
    ['derive-all-unlocks-custody-once-and-writes-every-key'],
  ],
  // the origin's registry shape (2026-10-11, option 2): key fields checked, display fields left alone
  [
    'seed-accepts-changed-key-fields',
    [[K, '    if (!same)\n      throw refuse(', '    if (false)\n      throw refuse(']],
    ['seed-refuses-a-registry-whose-key-field-was-changed-or-whose-roster-differs'],
  ],
  [
    'seed-rewrites-the-gardens-display-fields',
    [
      [
        K,
        "    keep = true; // display fields are the garden's: left exactly as they are",
        "    keep = false; // display fields are the garden's: left exactly as they are",
      ],
    ],
    ['seed-accepts-a-registry-whose-display-fields-were-filled-and-leaves-them'],
  ],
  [
    'seed-writes-the-old-shape',
    [
      [
        K,
        "  const reg = {\n    $schema: 'https://bon-sai.garden/schemas/agent-registry-v1.json',\n    _meta: {",
        "  const reg = {\n    schema: 'old',\n    _meta: {",
      ],
    ],
    ['seed-writes-the-origins-registry-shape-with-its-key-fields-inside'],
  ],
  [
    'namespace-before-drill',
    [[K, "  if (!g['recovery-drilled'])\n    throw refuse(", '  if (false)\n    throw refuse(']],
    ['namespace-refuses-before-the-drill'],
  ],
  // F2 and Fuji-shin's empty-rule survivor: the floor, whole and part by part
  [
    'no-reserved-floor',
    [[RM, 'export function floorProblems(sets) {', 'export function floorProblems(sets) { return [];']],
    ['reserved-set-floor', 'reserved-set-empty-rule-refused'],
  ],
  [
    'floor-without-wildcard',
    [
      [
        RM,
        '    if (!sets.wildcard.has(w)) out.push({ reason: R.FLOOR, detail: `the wildcard does not hold ${chars([w])} (${w})` });\n  for (const b of B0)',
        '    if (false) out.push({ reason: R.FLOOR, detail: `the wildcard does not hold ${chars([w])} (${w})` });\n  for (const b of B0)',
      ],
    ],
    ['reserved-set-floor'],
  ],
  [
    'floor-without-set-b',
    [
      [
        RM,
        '  for (const b of B0)\n    if (!sets.B.has(b))\n      out.push({',
        '  for (const b of B0)\n    if (false)\n      out.push({',
      ],
    ],
    ['reserved-set-floor'],
  ],
  [
    'floor-without-a-count',
    [[RM, '  if (sets.A.size < MIN_A)\n    out.push({', '  if (false)\n    out.push({']],
    ['reserved-set-floor'],
  ],
  [
    'pair-list-read-again',
    [[RM, "if ('pairs' in data) add(R.PAIRS", 'if (false) add(R.PAIRS']],
    ['reserved-set-floor', 'namespace-refuses-without-the-shipped-set'],
  ],
  [
    'namespace-ignores-exclusion',
    [[N, 'if (idx[2] === NIWA && !exclude.reserved(idx)) {', 'if (idx[2] === NIWA) {']],
    ['namespace-ends-in-niwa-and-skips-an-excluded-pair', 'reserved-rule-wildcard-and-sets'],
  ],
  [
    'rule-without-wildcard',
    [
      [
        RM,
        'if (w !== undefined) return `${chars([w])} is the wildcard',
        'if (false) return `${chars([w])} is the wildcard',
      ],
    ],
    ['reserved-rule-wildcard-and-sets'],
  ],
  [
    'rule-without-sets',
    [
      [
        RM,
        '      if (A.has(idx[0]) && B.has(idx[1]))\n        return `${chars(idx.slice(0, 2))} matches the reserved rule (first in set A, second in set B)`;',
        '      if (false) return `${chars(idx.slice(0, 2))} matches the reserved rule (first in set A, second in set B)`;',
      ],
    ],
    ['reserved-rule-wildcard-and-sets'],
  ],
  [
    'namespace-not-niwa',
    [[N, 'export const NIWA = 322;', 'export const NIWA = 321;']],
    ['namespace-ends-in-niwa-and-skips-an-excluded-pair'],
  ],
  [
    'identity-takes-reserved',
    [
      [K, '  if (why) throw refuse(`${chars(pair)}: ${why}', '  if (false) throw refuse(`${chars(pair)}: ${why}'],
      [
        N,
        '  if (why) {\n    throw Object.assign(new Error(`${chars(pair)}: ${why}',
        '  if (false) {\n    throw Object.assign(new Error(`${chars(pair)}: ${why}',
      ],
    ],
    ['identity-refuses-a-reserved-pair'],
  ],
  [
    'identity-takes-a-taken-pair',
    [
      [
        K,
        '    if (pair && JSON.stringify(e.identity_pair) === JSON.stringify(pair))\n      throw refuse(`${chars(pair)} is taken in this garden by ${other}; choose another`);',
        '    if (false) throw refuse(`${chars(pair)} is taken in this garden by ${other}; choose another`);',
      ],
    ],
    ['identity-refuses-a-pair-taken-in-this-garden-and-a-bad-slug'],
  ],
  [
    'check-locks-trusts-the-lock',
    [
      [
        N,
        'if (JSON.stringify(idx) !== JSON.stringify(e.identity_pair) || chars(idx) !== e.identity_kanji) {',
        'if (false) {',
      ],
      [N, 'if (e.identity_kanji_full !== undefined && chars(four) !== e.identity_kanji_full) {', 'if (false) {'],
    ], // the lock's four kanji are held twice, in depth
    ['hand-edited-lock-fails-check-set'],
  ],
  [
    'seed-trusts-the-key-on-file',
    [
      [
        K,
        "    if (!on.raw.equals(k.raw))\n      throw refuse(`the key on file for ${slug} does not derive from this garden's salt; refusing to seed`);",
        "    if (false) throw refuse(`the key on file for ${slug} does not derive from this garden's salt; refusing to seed`);",
      ],
    ],
    ['seed-refuses-a-key-not-from-this-garden'],
  ],
  [
    'seed-overwrites-a-registry',
    [[K, '    if (!same)\n      throw refuse(', '    if (false)\n      throw refuse(']],
    ['seed-refuses-a-registry-with-other-content'],
  ],
  [
    'verify-walks-instead-of-naming-the-pot',
    [
      [
        PV,
        '{ root: pot, pot: potTrust(pot) } : { root: pot, ',
        '{ root: process.cwd(), pot: potTrust(pot) } : { root: process.cwd(), ',
      ],
    ],
    ['keys-pot-stale-seal-is-hash-mismatch'],
  ],
  [
    'verify-says-ok-to-anything',
    [[K, "if (v.status === 'ok' || v.accepted === true) {", 'if (true) {']],
    ['keys-pot-stale-seal-is-hash-mismatch', 'keys-pot-unknown-signer-is-never-ok'],
  ],
  // Fuji-shin's five survivors, each aimed at the case that now plants its condition
  [
    'attest-fields-check',
    [[G, '  if (fields.length)\n    out.push({', '  if (false)\n    out.push({']],
    ['attest-refuses-a-secret-shape-in-a-field'],
  ],
  [
    'attest-document-check',
    [
      [
        G,
        "  if (doc !== null && SECRET_SHAPE.test(doc))\n    out.push({ check: 'document', why: 'the attestation would carry a value shaped like a master salt' });",
        "  if (false) out.push({ check: 'document', why: 'the attestation would carry a value shaped like a master salt' });",
      ],
    ],
    ['attest-document-check-stands-alone'],
  ],
  [
    'attest-salt-check',
    [
      [
        G,
        '  if (doc !== null && hex && (doc.toLowerCase().includes(hex)',
        '  if (false && (doc.toLowerCase().includes(hex)',
      ],
    ],
    ['attest-refuses-a-fragment-of-the-salt'],
  ],
  [
    'attest-root-key-length',
    [
      [
        K,
        "  if (Buffer.from(g['root-public-key'] || '', 'base64').length !== 32)\n    throw refuse(\"garden.json's root-public-key is not 32 bytes of base64\");",
        '  if (false) throw refuse("garden.json\'s root-public-key is not 32 bytes of base64");',
      ],
    ],
    ['attest-refuses-a-root-key-that-is-not-32-bytes'],
  ],
  [
    'read-master-trusts-a-foreign-salt',
    [
      [
        K,
        "if (g['root-fingerprint'] && keyOf(hex, rootSalt(g.garden)).fingerprint !== g['root-fingerprint']) {\n    throw halt(`custody",
        'if (false) {\n    throw halt(`custody',
      ],
    ],
    ['a-foreign-salt-in-custody-halts'],
  ],
  [
    'detect-ignores-two-holders',
    [
      [
        C,
        "  if (garden && holders.length > 1)\n    return out('cannot-tell', `two custody items for garden ${garden} (${holders.map((r) => r.name).join(', ')})`);",
        "  if (false)\n    return out('cannot-tell', `two custody items for garden ${garden} (${holders.map((r) => r.name).join(', ')})`);",
      ],
    ],
    ['two-holders-halt'],
  ],
  [
    'seed-trusts-the-bonsai-fingerprint',
    [
      [
        K,
        "  if (\n    be.slug !== 'bonsai' ||\n    beRaw.length !== 32 ||\n    crypto.createHash('sha256').update(beRaw).digest('hex').slice(0, 32) !== be.fingerprint\n  ) {",
        "  if (be.slug !== 'bonsai' || beRaw.length !== 32 || false) {",
      ],
    ],
    ['seed-refuses-a-bonsai-entry-that-is-not-its-key'],
  ],
  // his two layers that held each other: each now has a case where it stands alone
  [
    'export-signature-unchecked',
    [[K, "  return verifySignature(pub.toString('hex'), envelopePayload(env), env.signature);", '  return true;']],
    ['drill-refuses-an-export-whose-root-signature-fails'],
  ],
  [
    'restore-holder-check-only',
    [[K, 'if (holder) throw refuse(', 'if (false) throw refuse(']],
    ['restore-refuses-an-existing-item-then-restores-and-drills-ok'],
  ],
  [
    'restore-overwrites',
    [
      [K, 'if (holder) throw refuse(', 'if (false) throw refuse('],
      [
        C,
        "  const st = await b.status(garden);\n  if (st.present)\n    throw new CustodyError(\n      'EXISTS',",
        "  const st = await b.status(garden);\n  if (false)\n    throw new CustodyError(\n      'EXISTS',",
      ],
    ],
    ['restore-refuses-an-existing-item-then-restores-and-drills-ok'],
  ],
  // the stuck state, and the second face
  [
    'mint-puts-before-proving-the-pot',
    [
      [
        K,
        "  // stuck garden (Fuji-shin, 2026-10-06). Rewrite garden.json as it is, through the same writer.\n  try {\n    writeJson(P.garden(ctx.pot), g);\n  } catch (e) {\n    throw refuse(\n      `cannot write ${P.garden(ctx.pot)} (${e.code || 'error'}); the pot must be writable before anything goes into custody. Nothing written.`,",
        "  // stuck garden (Fuji-shin, 2026-10-06). Rewrite garden.json as it is, through the same writer.\n  try {\n    /* skipped */\n  } catch (e) {\n    throw refuse(\n      `cannot write ${P.garden(ctx.pot)} (${e.code || 'error'}); the pot must be writable before anything goes into custody. Nothing written.`,",
      ],
    ],
    ['mint-refuses-an-unwritable-pot-before-custody'],
  ],
  [
    'a-second-face',
    [
      [
        K,
        '  const { pos, f } = parse(argv);',
        "  const { pos, f } = parse(argv);\n  if (process.env.BONSAI_AGENT_SLUG) console.log('(read aloud by a seat)');",
      ],
    ],
    ['same-sentences-from-a-seat-and-a-bare-shell'],
  ],
  [
    'one-item-for-every-garden',
    [
      [
        C,
        'export const account = (garden) => `${garden}/master-salt`;',
        "export const account = (garden) => 'master-salt';",
      ],
    ],
    ['two-gardens-side-by-side-and-the-legacy-item-untouched'],
  ],
  [
    'id-allows-a-seeded-name',
    [[K, 'if (seeded.includes(f.name)) {', 'if (false) {']],
    ['id-refuses-name-equal-to-seed-slug'],
  ],
  [
    'keychain-salt-on-argv',
    [
      [
        C,
        "const r = run(securityBin, ['-i'], { env, input: line });",
        "const r = run(securityBin, ['-i', hex], { env, input: line });",
      ],
    ],
    ['macos-keychain-backend-stub'],
  ],
  [
    'leak-on-stdout',
    [
      [
        K,
        'console.log(`root fingerprint: ${root.fingerprint}`);',
        'console.log(`root fingerprint: ${root.fingerprint} ${hex.slice(0, 8)}`);',
      ],
    ],
    ['the-arc-end-to-end-and-the-secret-never-leaks'],
  ],
  [
    'leak-into-a-file',
    [
      [
        K,
        '  writeJson(P.garden(ctx.pot), g);\n  sealRoot(hex, g, P.garden(ctx.pot));\n  console.log(`root fingerprint',
        "  writeJson(P.garden(ctx.pot), g);\n  fs.writeFileSync(path.join(ctx.pot, '.debug-salt'), Buffer.from(hex, 'hex'));\n  sealRoot(hex, g, P.garden(ctx.pot));\n  console.log(`root fingerprint",
      ],
    ],
    ['the-arc-end-to-end-and-the-secret-never-leaks'],
  ],
  [
    'reaches-outside-core',
    [
      [
        C,
        "import { sealEnvelope, openEnvelope } from './envelope.mjs';",
        "import { sealEnvelope, openEnvelope } from './envelope.mjs';\nconst reachOut = () => import('../../../../bonsai-garden/tools/keyring/derive-key.mjs');",
      ],
    ],
    ['runs-from-core-alone'],
  ],
  // the shipped reserved set: the reserved set pinned by its seal and the origin's word; the seed confirmed before it writes
  [
    'exclude-accepted-again',
    [
      [K, "    if (k === 'exclude')\n      throw usage(", '    if (false)\n      throw usage('],
      [
        K,
        "  'out',\n  'file',\n  'pair',\n  'fp-attests',\n  'pick',",
        "  'out',\n  'file',\n  'exclude',\n  'pair',\n  'fp-attests',\n  'pick',",
      ],
    ],
    ['exclude-is-usage-64'],
  ],
  // the shipped file and its seal's hash still read, the origin's word skipped
  [
    'namespace-without-the-origins-word',
    [
      [
        K,
        '  const ex = await reservedRule(ctx);\n  const r = searchNamespace',
        "  const ex = await loadReservedSet({ origin: { ask: async () => ({ status: 'signature-vouched' }) } });\n  const r = searchNamespace",
      ],
    ],
    [
      'an-arbitrary-set-is-refused-without-the-origins-word',
      'namespace-asks-the-origin-once-and-proceeds-on-its-word',
      'namespace-halts-when-the-origin-cannot-be-reached',
      'namespace-refuses-what-the-origin-does-not-vouch-for',
    ],
  ],
  [
    'identity-without-the-origins-word',
    [
      [
        K,
        '  const ex = await reservedRule(ctx);\n  if (guardian) {',
        "  const ex = await loadReservedSet({ origin: { ask: async () => ({ status: 'signature-vouched' }) } });\n  if (guardian) {",
      ],
    ],
    ['identity-halts-when-the-origin-cannot-be-reached'],
  ],
  [
    'reserved-halt-refuses-instead',
    [[K, '      throw e.exit === 3 ? halt(m) : refuse(m);', '      throw refuse(m);']],
    ['namespace-halts-when-the-origin-cannot-be-reached', 'identity-halts-when-the-origin-cannot-be-reached'],
  ],
  [
    'seed-skips-the-origin',
    [
      [
        K,
        '  const v = await ctx.origin.ask(data);',
        "  const v = { status: 'signature-vouched', verifiedAt: '2026-10-07T12:00:00.000Z' };",
      ],
    ],
    [
      'seed-refuses-what-the-origin-does-not-vouch-for',
      'seed-halts-when-the-origin-cannot-be-reached',
      'seed-refuses-a-self-consistent-entry-with-another-key',
    ],
  ],
  [
    'seed-unreachable-refuses-instead',
    [
      [
        K,
        "    throw halt(`keys-unreachable: ${v.reason}; Bonsai's entry cannot be confirmed; nothing written`);\n  if (v.status !== 'signature-vouched')",
        "    throw refuse(`keys-unreachable: ${v.reason}; Bonsai's entry cannot be confirmed; nothing written`);\n  if (v.status !== 'signature-vouched')",
      ],
    ],
    ['seed-halts-when-the-origin-cannot-be-reached'],
  ],
  [
    'seed-without-a-seal',
    [
      [
        K,
        "    data = JSON.parse(fs.readFileSync(side, 'utf8'));\n  } catch (e) {\n    throw refuse(\n      `Bonsai's entry has no seal beside it (${path.basename(side)}${e.code === 'ENOENT' ? '' : ', unreadable'}); ` +\n        'seed asks the origin to vouch for the sealed file, never the file alone (spec §8.1); nothing written',\n    );\n  }\n  const p = v2SchemaProblem(data);",
        "    data = JSON.parse(fs.readFileSync(side, 'utf8'));\n  } catch (e) {\n    data = {};\n    if (false)\n      throw refuse(\n        `Bonsai's entry has no seal beside it (${path.basename(side)}${e.code === 'ENOENT' ? '' : ', unreadable'}); ` +\n          'seed asks the origin to vouch for the sealed file, never the file alone (spec §8.1); nothing written',\n      );\n  }\n  const p = v2SchemaProblem(data);",
      ],
    ],
    ['seed-refuses-an-entry-without-its-seal'],
  ],
  [
    'seed-any-signer-any-role',
    [[K, "  if (data.signer !== 'bonsai' || data.role !== 'owner' || 'open' in data) {", '  if (false) {']],
    ['seed-refuses-a-seal-that-is-not-bonsais-owner-seal'],
  ],
  [
    'seed-any-address',
    [[K, '  if (data.target !== SEED_TARGET)\n    throw refuse(', '  if (false)\n    throw refuse(']],
    ['seed-refuses-a-seal-on-another-address'],
  ],
  [
    'seed-hash-unchecked',
    [
      [
        K,
        "  if (crypto.createHash('blake2b512').update(fs.readFileSync(file)).digest('hex') !== data['file-hash']) {",
        '  if (false) {',
      ],
    ],
    ['seed-refuses-an-entry-edited-after-its-seal'],
  ],
  [
    'seed-fingerprint-unchecked',
    [[K, '  if (data.fingerprint !== be.fingerprint) {', '  if (false) {']],
    ['seed-refuses-an-entry-whose-seal-names-another-fingerprint'],
  ],
  [
    'seed-without-the-answers-time',
    [
      [
        K,
        '  if (!v.verifiedAt)\n    throw refuse("answer-malformed: the origin\'s signed answer carries no verified_at; nothing written");',
        '  if (false) throw refuse("answer-malformed: the origin\'s signed answer carries no verified_at; nothing written");',
      ],
    ],
    ['seed-refuses-what-the-origin-does-not-vouch-for'],
  ],
  [
    'interrupted-mint-names-no-way-out',
    [
      [
        K,
        'Keychain Access, secret-tool clear, or the 1Password app), then run mint again. This tool never deletes',
        'Keychain Access, secret-tool clear, or the 1Password app). This tool never deletes',
      ],
    ],
    ['an-interrupted-mint-is-named-and-refused'],
  ],
  [
    'seed-vouched-not-recorded',
    [
      [
        K,
        "      'fp-attests': be['fp-attests'] ?? 2,\n      vouched,\n    },\n    entry('bonsai-shin', 'shin', { parent: 'bonsai' }),",
        "      'fp-attests': be['fp-attests'] ?? 2,\n    },\n    entry('bonsai-shin', 'shin', { parent: 'bonsai' }),",
      ],
    ],
    ['seed-writes-vouched-from-the-origins-signed-answer'],
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
  const r = spawnSync(process.execPath, [path.join(HERE, 'test-keys.mjs'), '--only', cases.join(',')], {
    env: { ...process.env, KEYS_SKILL_DIR: path.join(dir, 'bonsai-garden-keys'), KEYS_TEST_TMP: TMP },
    encoding: 'utf8',
    timeout: 900000,
  });
  const out = r.stdout || '';
  const red = cases.filter((c) => new RegExp(`^FAIL  ${c}\\b`, 'm').test(out));
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
