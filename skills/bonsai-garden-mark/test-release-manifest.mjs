#!/usr/bin/env node
// ---
// id: 01M5G41K5RWY304HM44QV8FMPZ
// title: The release manifest's mode field, read offline: each case planted against the reader (Mori-shin's ruling, 2026-10-21)
// type: script
// tended-by: baisai
// created: 2026-10-21
// updated: 2026-10-21
// ---
//
// test-release-manifest.mjs — the `mode` of a release manifest's entries (Mori-shin's ruling of 2026-10-21; the format
// string stays bonsai-garden-release-manifest/1): { path, sha256, bytes, mode }, mode the string "100644" or "100755", on
// every entry or on none. parseRelease refuses some, or another value, as malformed; entryProblem checks the owner's
// execute bit against a stated mode and fails the entry on a miss (reason `mode`), with the fix in plain words; where no
// execute bit can be read, nothing is said to be checked. The reader as a whole (loadReservedSet, its `mode` verdict) is
// tested in test-reserved-marks.mjs. Bytes only: nothing here is run.
//
//   node skills/bonsai-garden-mark/test-release-manifest.mjs
//   RELEASE_MANIFEST_SRC=<a release-manifest.mjs> node ...  the reader under test (another one, to watch the cases fail)
//   OLD_READER=<an older release-manifest.mjs> node ...     case 10: a manifest that states modes, read by an older reader

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.env.RELEASE_MANIFEST_SRC
  ? path.resolve(process.env.RELEASE_MANIFEST_SRC)
  : path.join(HERE, 'release-manifest.mjs');
const R = await import(pathToFileURL(SRC).href);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-manifest-mode-'));
let pass = 0,
  fail = 0;
const check = (name, ok, why = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !why ? '' : `  — ${why}`}`);
};
const NAME = 'SEED-MANIFEST.json';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const FILES = {
  'skills/bonsai-garden-sign/bin/sign.mjs': ['#!/usr/bin/env node\n', '100755'],
  'skills/bonsai-garden-mark/reserved-marks.json': ['{}\n', '100644'],
};
/** a release at a fresh root: the files with the exec bits given (default: as their modes say) */
let n = 0;
function root(chmods = {}) {
  const dir = path.join(tmp, `r-${n++}`);
  for (const [rel, [text, mode]] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
    fs.chmodSync(path.join(dir, rel), chmods[rel] ?? (mode === '100755' ? 0o755 : 0o644));
  }
  return dir;
}
const manifest = (edit = (e) => e) =>
  Buffer.from(
    `${JSON.stringify(
      {
        format: 'bonsai-garden-release-manifest/1',
        name: 'bonsai-garden-seed',
        version: '0.9.2-rc',
        held: [],
        files: Object.entries(FILES).map(([p, [text, mode]], i) =>
          edit({ path: p, sha256: sha(Buffer.from(text)), bytes: Buffer.byteLength(text), mode }, i),
        ),
      },
      null,
      2,
    )}\n`,
  );
const noMode = ({ mode, ...e }) => e;
const SIGN = 'skills/bonsai-garden-sign/bin/sign.mjs',
  SET = 'skills/bonsai-garden-mark/reserved-marks.json';

// the format: every entry or none, and only the two strings
let p = R.parseRelease(manifest(), NAME);
check('a manifest that states every mode parses, and says so', !p.problem && p.modes === 'stated', JSON.stringify(p.problem || p.modes));
p = R.parseRelease(manifest(noMode), NAME);
check('case 9 (the format): a manifest without modes parses, and says not-stated', !p.problem && p.modes === 'not-stated', JSON.stringify(p.problem || p.modes));
for (const [label, edit, want] of [
  ['case 3: "100775"', (e, i) => (i ? e : { ...e, mode: '100775' }), /malformed/],
  ['case 4: a number 100755', (e, i) => (i ? e : { ...e, mode: 100755 }), /malformed/],
  ['case 5: mode on some entries only', (e, i) => (i ? noMode(e) : e), /mode on some entries/],
]) {
  p = R.parseRelease(manifest(edit), NAME);
  check(`${label}: malformed`, !!p.problem && p.problem.reason === R.M.FORMAT && want.test(p.problem.detail), JSON.stringify(p.problem || 'parsed'));
}

// the entry: the owner's execute bit against the stated mode
const listed = R.parseRelease(manifest(), NAME);
const at = (dir, rel, opts) => R.entryProblem(dir, listed.byPath ?? new Map(), rel, NAME, opts);
check('the bits as stated: both entries hold', !at(root(), SIGN) && !at(root(), SET));
let e = at(root({ [SIGN]: 0o644 }), SIGN);
check(
  'case 1: 100755 listed, not executable: the entry fails, reason mode, the fix named',
  e?.reason === 'mode' && /sign\.mjs/.test(e.detail) && /chmod \+x/.test(e.detail),
  JSON.stringify(e),
);
e = at(root({ [SET]: 0o755 }), SET);
check(
  'case 2: 100644 listed, executable: the entry fails, reason mode, the fix named',
  e?.reason === 'mode' && /reserved-marks\.json/.test(e.detail) && /chmod -x/.test(e.detail),
  JSON.stringify(e),
);
check('the group and other bits are a umask\'s, not judged', !at(root({ [SET]: 0o654 }), SET));
check('no execute bit to read: no failure of the mode (and nothing said checked)', !at(root({ [SIGN]: 0o644 }), SIGN, { execBits: false }));
check(
  'the verdict says what was done: checked, not-stated, not-checkable',
  R.modeVerdict?.(listed, true) === 'checked' &&
    R.modeVerdict?.(R.parseRelease(manifest(noMode), NAME), true) === 'not-stated' &&
    R.modeVerdict?.(listed, false) === 'not-checkable' &&
    R.modeVerdict?.(R.parseRelease(manifest(noMode), NAME), false) === 'not-stated',
  typeof R.modeVerdict,
);
const old = R.parseRelease(manifest(noMode), NAME);
e = R.entryProblem(root({ [SIGN]: 0o644 }), old.byPath ?? new Map(), SIGN, NAME);
check('case 9 (the entry): a manifest without modes judges no exec bit', e === null, JSON.stringify(e));

// 10. the same manifest under an older reader: unharmed
if (process.env.OLD_READER) {
  const O = await import(pathToFileURL(path.resolve(process.env.OLD_READER)).href);
  const op = O.parseRelease(manifest(), NAME);
  const oe = op.problem ? op.problem : O.entryProblem(root(), op.byPath, SIGN, NAME);
  check('case 10: a manifest that states modes, read by an older reader: ok, unharmed', !op.problem && oe === null, JSON.stringify(op.problem || oe));
} else console.log('SKIP  case 10: name an older reader with OLD_READER=<release-manifest.mjs> to run it');

console.log(`\n${pass}/${pass + fail} passed`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
