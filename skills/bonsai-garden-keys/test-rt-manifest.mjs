#!/usr/bin/env node
// ---
// id: 01M5G30NAWTN36GKXT9C0J9MFS
// title: rt's manifest and its mode field, tested by planting each case against the reader (Mori-shin's ruling, 2026-10-21)
// type: script
// tended-by: baisai
// created: 2026-10-21
// updated: 2026-10-21
// ---
//
// test-rt-manifest.mjs — RT-MANIFEST.json's `mode` (Mori-shin's ruling of 2026-10-21; the format string stays
// rt-manifest/2): every entry { path, sha256, bytes, mode }, mode the string "100644" or "100755", on every entry or on
// none. The reader checks the owner's execute bit (mode & 0o100) against each entry and says what it did:
// `mode: checked | not-stated | not-checkable`, never checked when it was not. A miss fails that entry (kind `mode`), with
// the fix in plain words. Each case is planted, and each fails by its name. Bytes only: nothing here is run.
//
//   node skills/bonsai-garden-keys/test-rt-manifest.mjs
//   RT_MANIFEST_SRC=<a rt-manifest.mjs> node ...     the reader under test (another one, to watch the cases fail)
//   OLD_READER=<an older rt-manifest.mjs> node ...    case 10: a manifest that states modes, read by an older reader

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.env.RT_MANIFEST_SRC
  ? path.resolve(process.env.RT_MANIFEST_SRC)
  : path.join(HERE, 'lib', 'rt-manifest.mjs');
const M = await import(pathToFileURL(SRC).href);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-manifest-mode-'));
let pass = 0,
  fail = 0;
const check = (name, ok, why = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !why ? '' : `  — ${why}`}`);
};
const attempt = (f) => {
  try {
    return { value: f() };
  } catch (e) {
    return { error: e.message };
  }
};

const FILES = {
  'tools/rt/doctor.mjs': Buffer.from('#!/usr/bin/env node\n'),
  'README.md': Buffer.from('# rt\n'),
  'tools/hooks/garden/.pre-commit.bonsaisig': Buffer.from('{}\n'),
};
const MODES = { 'tools/rt/doctor.mjs': '100755', 'README.md': '100644', 'tools/hooks/garden/.pre-commit.bonsaisig': '100644' };

/** an rt at a fresh directory: the files, each with the exec bit its mode says, and the manifest's bytes as given */
let n = 0;
function plant(manifestBuf, chmods = {}) {
  const dir = path.join(tmp, `rt-${n++}`);
  for (const [rel, buf] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), buf);
    fs.chmodSync(path.join(dir, rel), chmods[rel] ?? (MODES[rel] === '100755' ? 0o755 : 0o644));
  }
  fs.writeFileSync(path.join(dir, M.MANIFEST), manifestBuf);
  return dir;
}
const edit = (buf, f) => {
  const m = JSON.parse(buf);
  f(m);
  return Buffer.from(`${JSON.stringify(m, null, 2)}\n`);
};

// the writer: modes on every entry, as strings, inside the bytes
const r0 = attempt(() => M.manifestBytes({ name: 'bonsai-garden-rt', version: '0.9.2', files: FILES, modes: MODES }));
const good = r0.value ?? Buffer.from('{}');
const gm = r0.value ? JSON.parse(good) : { files: [] };
check(
  'the writer: every entry carries mode, the string git holds, after path, sha256 and bytes',
  gm.files.length === 3 &&
    gm.files.every((f) => JSON.stringify(Object.keys(f)) === '["path","sha256","bytes","mode"]') &&
    gm.files.every((f) => f.mode === MODES[f.path]),
  r0.error || JSON.stringify(gm.files[0]),
);
const rMiss = attempt(() =>
  M.manifestBytes({ name: 'bonsai-garden-rt', version: '0.9.2', files: FILES, modes: { 'README.md': '100644' } }),
);
check('the writer refuses modes for some files only', !!rMiss.error && /mode/.test(rMiss.error), rMiss.error || 'written');
const rBadW = attempt(() =>
  M.manifestBytes({ name: 'bonsai-garden-rt', version: '0.9.2', files: FILES, modes: { ...MODES, 'README.md': '100775' } }),
);
check('the writer refuses a third mode', !!rBadW.error && /100775/.test(rBadW.error), rBadW.error || 'written');
const none = M.manifestBytes({ name: 'bonsai-garden-rt', version: '0.9.2', files: FILES });
check('the writer without modes writes none (every rt before 0.9.2)', !JSON.parse(none).files.some((f) => 'mode' in f));

// the reader: a manifest that states modes, every exec bit as stated
let v = M.verifyTree(plant(good));
check('the reader: a tree whose exec bits are as stated passes, and says mode: checked', v.ok && v.mode === 'checked', JSON.stringify(v.problems));

// 1. 100755 listed, the file not executable
v = M.verifyTree(plant(good, { 'tools/rt/doctor.mjs': 0o644 }));
check(
  'case 1: 100755 listed, not executable: the entry fails, kind mode, the fix named',
  !v.ok && v.problems.some((p) => p.kind === 'mode' && /tools\/rt\/doctor\.mjs/.test(p.what) && /chmod \+x/.test(p.what)),
  JSON.stringify(v.problems),
);
// 2. 100644 listed, the file executable
v = M.verifyTree(plant(good, { 'README.md': 0o755 }));
check(
  'case 2: 100644 listed, executable: the entry fails, kind mode, the fix named',
  !v.ok && v.problems.some((p) => p.kind === 'mode' && /README\.md/.test(p.what) && /chmod -x/.test(p.what)),
  JSON.stringify(v.problems),
);
// only the owner's bit is git's to say: a group or other bit is the umask's
v = M.verifyTree(plant(good, { 'README.md': 0o654 }));
check('the group and other bits are not judged (a umask owns them)', v.ok, JSON.stringify(v.problems));

// 3, 4, 5: malformed
for (const [label, buf, want] of [
  ['case 3: "100775"', edit(good, (m) => (m.files[0].mode = '100775')), /malformed/],
  ['case 4: a number 100755', edit(good, (m) => (m.files[0].mode = 100755)), /malformed/],
  ['case 5: mode on some entries only', edit(good, (m) => delete m.files[1].mode), /mode on some entries/],
]) {
  const p = attempt(() => M.parseManifest(buf));
  v = M.verifyTree(plant(buf));
  check(
    `${label}: malformed, by the parser and by the tree's reader`,
    !!p.error && want.test(p.error) && !v.ok && v.problems.some((x) => x.kind === 'malformed' && want.test(x.what)),
    `${p.error || 'parsed'} / ${JSON.stringify(v.problems)}`,
  );
}

// 8. mode edited after the seal: the seal no longer covers the bytes
{
  const blake = (b) => crypto.createHash('blake2b512').update(b).digest('hex');
  const dir = plant(edit(good, (m) => (m.files.find((f) => f.path === 'README.md').mode = '100755')));
  const seal = {
    format: 'bonsaisig/2',
    id: '01M5G30NF7NB1T005ZGTDKR7ZD',
    signer: 'rt-owner',
    role: 'owner',
    fingerprint: '0'.repeat(32),
    timestamp: '2026-10-21T20:00:00Z',
    algorithm: 'ed25519+blake2b512',
    target: M.MANIFEST,
    'file-hash': blake(good), // sealed over the manifest as written
    signature: 'AAAA',
  };
  fs.writeFileSync(path.join(dir, M.MANIFEST_SEAL), `${JSON.stringify(seal, null, 2)}\n`);
  const s = M.manifestSeal(dir, { signers: ['rt-owner'] });
  check('case 8: a mode edited after the seal: the seal fails (hash-mismatch)', !!s.problem && /hash-mismatch/.test(s.problem.what), JSON.stringify(s));
  fs.writeFileSync(path.join(dir, M.MANIFEST), good);
  check('… and the bytes as sealed hold under it', !M.manifestSeal(dir, { signers: ['rt-owner'] }).problem);
}

// 9. a manifest from before 0.9.2 states no modes: ok, and says so
v = M.verifyTree(plant(none, { 'README.md': 0o755 }));
check('case 9: a manifest without modes: ok, mode: not-stated (never checked)', v.ok && v.mode === 'not-stated', JSON.stringify(v));

// where the execute bit cannot be read: not-checkable, never checked, never a failure
v = M.verifyTree(plant(good, { 'tools/rt/doctor.mjs': 0o644 }), null, { execBits: false });
check('no execute bit to read: mode: not-checkable, neither a pass nor a failure of the mode', v.ok && v.mode === 'not-checkable', JSON.stringify(v));

// 10. the same manifest under an older reader: unharmed
if (process.env.OLD_READER) {
  const O = await import(pathToFileURL(path.resolve(process.env.OLD_READER)).href);
  const p = attempt(() => O.parseManifest(good));
  const ov = O.verifyTree(plant(good));
  check('case 10: a manifest that states modes, read by an older reader: ok, unharmed', !p.error && ov.ok, p.error || JSON.stringify(ov.problems));
} else console.log('SKIP  case 10: name an older reader with OLD_READER=<rt-manifest.mjs> to run it');

console.log(`\n${pass}/${pass + fail} passed`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
