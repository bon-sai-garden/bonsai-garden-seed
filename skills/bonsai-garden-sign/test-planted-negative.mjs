#!/usr/bin/env node
// ---
// id: 01M3BS43VCAW48D77TQC6C9PSA
// ---
/**
 * test-planted-negative.mjs — two broken seals, planted on purpose, asserted by name.
 *
 * Replaces the corpus test's "named negative fixtures", which were REAL stale seals in the
 * garden's own checkout (a repro script and test.py under tools/bonsai-mcp/). A legitimate edit re-sealed both on
 * 2026-09-22 and the evidence was gone. Planted fixtures live here, beside the verifier, and
 * depend on no other repo staying broken. Mori-shin's ask (2026-09-24): two cases, asserted
 * by name, and the second keeps the check order under test.
 *
 * SEAL v2: v2-stale-hash.txt and v2-wrong-signer.txt are the same two cases under
 * seal v2 (v2-stale-hash by Bonsai as custodian); the v1 pair below stays as the retired case —
 * still broken for the same reasons, and with the tamper removed they read retired-v1.
 *
 *   fixtures/negative/stale-hash.txt    sealed by bonsai over its first two lines; a third was
 *                                        appended after sealing            → hash-mismatch
 *   fixtures/negative/wrong-signer.txt  sealed by baisai, the sidecar relabelled "bonsai" (it
 *                                        keeps baisai's fingerprint), and the bytes changed
 *                                        after sealing                     → bad-signature
 *
 * Why the second case also changes the bytes: the verifier must compare the fingerprint BEFORE
 * the hash. A verifier that checked the hash first would answer hash-mismatch here and fail
 * this test. Both fixtures name bonsai because core carries only Bonsai's public key, so both
 * run on a checkout of core alone.
 *
 * Why --keys garden: the published path cannot tell an unknown signer from a bad signature (both
 * read `rejected`, by design), so the order-of-checks property only exists on the local verdict.
 *
 * Controls: stale-hash with its appended line removed must verify ok, which proves the seal is
 * genuine and the planted tamper is its only defect. For wrong-signer, the control (original
 * label and bytes, verified with baisai's key) runs only with --garden <the garden's checkout>, where that key lives.
 *
 * With sign.py reachable (--signpy <path>), each verdict is asked of sign.py too, and the two
 * must agree.
 *
 * The rule for any fixture sealed with a kin's real key (Bonsai, as owner, 2026-09-24): the signed
 * bytes must describe themselves as a fixture and assert nothing else — never a sentence that
 * could stand as a statement by that kin, because stripping the tamper leaves text they
 * genuinely signed. His preference, for later and for Mori-shin: a dedicated test key rather than
 * a kin's key, so a real key never signs text its kin didn't write.
 *
 *   node test-planted-negative.mjs [--garden <garden root>] [--signpy <path/to/sign.py>]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSidecar, sidecarPathFor } from './lib/sidecar-format.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, 'bin', 'sign.mjs');
const FIX = path.join(HERE, 'fixtures', 'negative');
const argv = process.argv.slice(2);
const opt = (k) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : null;
};
const GARDEN = opt('--garden');
const SIGNPY = opt('--signpy');

// core alone: no BONSAI_* in the verifier's environment, so no key can be borrowed from elsewhere
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('BONSAI_')));

function nodeVerdict(file, garden = null) {
  const env = garden ? { ...cleanEnv, BONSAI_GARDEN: garden } : cleanEnv;
  let out;
  try {
    out = execFileSync('node', [CLI, 'verify-sidecar', '--keys', 'garden', '--file', file], {
      env,
      cwd: garden || path.resolve(HERE, '..', '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
  }
  const first = out.trim().split('\n')[0] || '';
  if (first.startsWith('ok')) return 'ok';
  return (first.match(/\[([a-z-]+)\]/) || [])[1] || `unparsed: ${first}`;
}

function pyVerdict(file) {
  if (!SIGNPY) return null;
  let out;
  try {
    out = execFileSync('python3', [SIGNPY, 'verify-sidecar', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
  }
  const first = out.trim().split('\n')[0] || '';
  return first.startsWith('ok') ? 'ok' : (first.match(/\[([a-z-]+)\]/) || [])[1] || `unparsed: ${first}`;
}

let failures = 0;
function expect(name, got, want) {
  const pass = got === want;
  if (!pass) failures++;
  console.log(`  ${pass ? 'OK' : '!!'} ${name.padEnd(46)} ${got}${pass ? '' : `   (want ${want})`}`);
}
// the first line's verdict token, for a retired-v1 seal accepted under warn too
function nodeFirst(file, garden = null) {
  const env = garden ? { ...cleanEnv, BONSAI_GARDEN: garden } : cleanEnv;
  let out;
  try {
    out = execFileSync('node', [CLI, 'verify-sidecar', '--keys', 'garden', '--file', file], {
      env,
      cwd: garden || path.resolve(HERE, '..', '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
  }
  const first = out.trim().split('\n')[0] || '';
  const tag = (first.match(/\[([a-z0-9-]+)\]/) || [])[1];
  return first.startsWith('ok') ? (tag ? `ok [${tag}]` : 'ok') : tag || `unparsed: ${first}`;
}

// Seal v2: the v2 fixtures are the planted negatives; the v1 ones stay as the
// RETIRED case. Bonsai's condition holds for both: the bytes under a kin's key describe
// themselves as a fixture and assert nothing else. v2-stale-hash is sealed by Bonsai as
// CUSTODIAN — his key holding a file he did not write, which v2 can now say.
console.log('planted negative fixtures (must stay broken, for the right reason):');
for (const [f, want] of [
  ['v2-stale-hash.txt', 'hash-mismatch'],
  ['v2-wrong-signer.txt', 'bad-signature'],
  ['stale-hash.txt', 'hash-mismatch'],
  ['wrong-signer.txt', 'bad-signature'],
]) {
  const file = path.join(FIX, f);
  if (!fs.existsSync(file) || findSidecar(file).status !== 'ok') {
    expect(f, 'fixture missing', want);
    continue;
  }
  expect(`${f} (node)`, nodeVerdict(file), want);
  const p = pyVerdict(file);
  if (p !== null) expect(`${f} (sign.py)`, p, want);
}
{
  const sc = JSON.parse(fs.readFileSync(findSidecar(path.join(FIX, 'v2-stale-hash.txt')).path, 'utf8'));
  expect(
    'v2-stale-hash is a v2 seal, custodian: bonsai',
    `${sc.format} ${sc.role}: ${sc.signer}`,
    'bonsaisig/2 custodian: bonsai',
  );
}

// Controls: undo each planted defect in a scratch copy; the seal must then verify. A v2 seal
// names its address, so the copy sits at that same address under a scratch seal root (.git).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'planted-neg-'));
try {
  console.log('\ncontrols (the planted defect removed; the seal must be genuine):');
  const lines = (f) => fs.readFileSync(path.join(FIX, f), 'utf8').split('\n');
  const atAddress = (f) => {
    const sc = JSON.parse(fs.readFileSync(findSidecar(path.join(FIX, f)).path, 'utf8'));
    const root = path.join(tmp, f.replace(/\W+/g, '-'));
    fs.mkdirSync(path.join(root, '.git'), { recursive: true });
    const dst = path.join(root, ...(sc.target || f).split('/'));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    return { dst, sc };
  };
  {
    const { dst, sc } = atAddress('v2-stale-hash.txt');
    fs.writeFileSync(dst, `${lines('v2-stale-hash.txt').slice(0, 2).join('\n')}\n`);
    fs.writeFileSync(sidecarPathFor(dst), `${JSON.stringify(sc, null, 2)}\n`);
    expect('v2-stale-hash, tamper removed (node)', nodeVerdict(dst), 'ok');
    const p = pyVerdict(dst);
    if (p !== null) expect('v2-stale-hash, tamper removed (sign.py)', p, 'ok');
  }
  {
    const stale = path.join(tmp, 'stale-hash.txt');
    fs.writeFileSync(stale, `${lines('stale-hash.txt').slice(0, 2).join('\n')}\n`);
    fs.copyFileSync(findSidecar(path.join(FIX, 'stale-hash.txt')).path, sidecarPathFor(stale));
    expect('v1 stale-hash, tamper removed (node)', nodeFirst(stale), 'ok [retired-v1]');
  }
  if (GARDEN) {
    const { dst, sc } = atAddress('v2-wrong-signer.txt');
    fs.writeFileSync(dst, `${lines('v2-wrong-signer.txt').slice(0, 2).join('\n')}\n`);
    fs.writeFileSync(sidecarPathFor(dst), `${JSON.stringify({ ...sc, signer: 'baisai' }, null, 2)}\n`);
    expect('v2-wrong-signer, label + bytes restored (node)', nodeVerdict(dst, path.resolve(GARDEN)), 'ok');
    const wrong = path.join(tmp, 'wrong-signer.txt');
    fs.writeFileSync(wrong, `${lines('wrong-signer.txt').slice(0, 2).join('\n')}\n`);
    const v1 = JSON.parse(fs.readFileSync(findSidecar(path.join(FIX, 'wrong-signer.txt')).path, 'utf8'));
    fs.writeFileSync(sidecarPathFor(wrong), `${JSON.stringify({ ...v1, signer: 'baisai' }, null, 2)}\n`);
    expect('v1 wrong-signer, restored (node)', nodeFirst(wrong, path.resolve(GARDEN)), 'ok [retired-v1]');
  } else {
    console.log("  -- wrong-signer controls skipped: need --garden <the garden's checkout>, where baisai's key lives");
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures ? `\nFAIL — ${failures} assertion(s)` : '\nall planted negatives hold, for the right reasons');
process.exit(failures ? 1 : 0);
