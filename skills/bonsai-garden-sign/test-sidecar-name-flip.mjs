#!/usr/bin/env node
// ---
// id: 01M4AF5TH1TGDX3W0A1F0YGZJJ
// title: test-sidecar-name-flip — the old sidecar name under every policy, in both languages
// type: script
// tended-by: mori-shin
// created: 2026-10-07
// updated: 2026-10-16
// ---
/**
 * test-sidecar-name-flip.mjs — the proof that goes with phase 3, move 2, of the dot-prefixed sidecar change.
 *
 * The flip is one line in seal-policy.json: "sidecar-name": "warn" → "refuse". It takes effect on every
 * tool on the host the moment it is saved, so the proof is run BEFORE it (to show what it will do) and
 * AFTER it (to show it did). It does not touch the real policy. It reads it once, to know which mode the
 * CLI checks must expect, and plants every other mode in scratch policy files:
 *
 *   warn · refuse · a policy naming no sidecar-name · a garbled value · not JSON · an unreadable path
 *
 * For each, three layouts of one known-good seal (tools/sign.py and its own sidecar, staged in a scratch
 * repo at its signed address), asked of Node's verifier AND of sign.py (its policy override set in that
 * process, never through the environment):
 *
 *   hidden-only   .X.bonsaisig               ok, in every mode
 *   both          X.bonsaisig + .X.bonsaisig two-sidecars, in every mode (a verifier does not choose)
 *   old-only      X.bonsaisig                warn: retired-sidecar-name, ACCEPTED, the fix named
 *                                            every other mode: retired-sidecar-name, REFUSED, the fix named
 *   old-only, tampered file                  warn: hash-mismatch (a failing seal keeps its own verdict)
 *                                            every other mode: retired-sidecar-name, whatever its bytes
 *
 * Then the CLI, against the REAL policy as it stands: old-only exits 0 under warn and non-zero under refuse.
 *
 * Usage:  node test-sidecar-name-flip.mjs [--garden <path>]
 *
 * The garden is the checkout that holds tools/sign.py, the Python half of this proof: named by --garden, else by
 * $BONSAI_GARDEN, never guessed from a home path. With neither the run is a SKIP, said out loud, exit 0: nothing
 * was checked (2026-10-16; the old default was one host's checkout, and a clean seat failed on it).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifySidecarFile } from './lib/verify.mjs';
import { readSealPolicy, SEAL_POLICY_PATH } from './lib/seal-v2.mjs';
import { sidecarPathFor, legacySidecarPathFor, findSidecar } from './lib/sidecar-format.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(HERE, 'bin', 'sign.mjs');
const argv = process.argv.slice(2);
const gi = argv.indexOf('--garden');
const named = gi >= 0 ? argv[gi + 1] : process.env.BONSAI_GARDEN;
if (!named) {
  console.log(
    'SKIP  test-sidecar-name-flip: no garden named — this proof asks sign.py of a garden checkout (tools/sign.py) beside Node; pass --garden <path> or set $BONSAI_GARDEN. Nothing was checked.',
  );
  process.exit(0);
}
const GARDEN = path.resolve(named);
if (!fs.existsSync(path.join(GARDEN, 'agents', 'registry.json'))) {
  console.error(`not a garden: ${GARDEN}. Pass --garden <path>.`);
  process.exit(2);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bonsai-name-flip-'));
process.on('exit', () => {
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {}
});
let pass = 0,
  fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `\n          want ${JSON.stringify(want)}\n          got  ${JSON.stringify(got)}`}`,
  );
}

// ── a known-good seal, staged at its signed address in a scratch repo, in the layout asked for
const SRC = path.join(GARDEN, 'tools', 'sign.py');
const SRC_SIG = findSidecar(SRC).path;
const REL = JSON.parse(fs.readFileSync(SRC_SIG, 'utf8')).target || 'tools/sign.py';
let n = 0;
function stage(layout, { tamper = false } = {}) {
  const repo = path.join(TMP, `r${++n}`);
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  const t = path.join(repo, ...REL.split('/'));
  fs.mkdirSync(path.dirname(t), { recursive: true });
  fs.copyFileSync(SRC, t);
  if (layout === 'hidden' || layout === 'both') fs.copyFileSync(SRC_SIG, sidecarPathFor(t));
  if (layout === 'old' || layout === 'both') fs.copyFileSync(SRC_SIG, legacySidecarPathFor(t));
  if (tamper) fs.appendFileSync(t, '\n# drift\n');
  return t;
}

// ── the policies, as files, exactly as the verifiers read them
const policy = (name, body) => {
  const f = path.join(TMP, name);
  if (body !== null) fs.writeFileSync(f, body);
  return f;
};
const P = {
  warn: policy('warn.json', '{"v1":"warn","sidecar-name":"warn"}'),
  refuse: policy('refuse.json', '{"v1":"warn","sidecar-name":"refuse"}'),
  'names none': policy('none.json', '{"v1":"warn"}'),
  garbled: policy('garbled.json', '{"v1":"warn","sidecar-name":"maybe"}'),
  'not JSON': policy('notjson.json', 'sidecar-name: refuse'),
  unreadable: policy('nope.json', null),
};

function py(policyFile, target) {
  const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(path.join(GARDEN, 'tools'))})
from pathlib import Path
import sign as S
S.SEAL_POLICY_OVERRIDE = Path(sys.argv[2])
st, meta = S.verify_sidecar_file(Path(sys.argv[1]))
print(json.dumps([st, bool(S.seal_accepted(st, meta)), (meta or {}).get("_reason", "")]))
`;
  const [status, accepted, reason] = JSON.parse(
    execFileSync('python3', ['-c', script, target, policyFile], { cwd: GARDEN }).toString().trim(),
  );
  return { status, accepted, reason };
}
const node = (policyFile, target) => {
  const v = verifySidecarFile(target, { root: GARDEN, policy: readSealPolicy(policyFile) });
  return {
    status: v.status,
    accepted: v.accepted === undefined ? v.status === 'ok' : v.accepted,
    reason: v.reason || '',
  };
};
const fixNamed = (r) => /git mv .*\.bonsaisig .*\.\S+\.bonsaisig|re-seal/.test(r);

console.log(`garden: ${GARDEN}\nreal policy: ${SEAL_POLICY_PATH}\n`);
for (const [mode, file] of Object.entries(P)) {
  const warn = mode === 'warn';
  console.log(`policy: ${mode}`);
  for (const [lang, ask] of [
    ['node  ', node],
    ['python', py],
  ]) {
    const h = ask(file, stage('hidden'));
    check(`${lang} hidden-only → ok`, [h.status, h.accepted], ['ok', true]);
    const b = ask(file, stage('both'));
    check(`${lang} both present → two-sidecars, refused`, [b.status, b.accepted], ['two-sidecars', false]);
    const o = ask(file, stage('old'));
    check(
      `${lang} old-only → retired-sidecar-name, ${warn ? 'accepted' : 'REFUSED'}, the fix named`,
      [o.status, o.accepted, fixNamed(o.reason)],
      ['retired-sidecar-name', warn, true],
    );
    const x = ask(file, stage('old', { tamper: true }));
    check(
      `${lang} old-only, file tampered → ${warn ? 'hash-mismatch (its own verdict)' : 'retired-sidecar-name whatever its bytes'}`,
      [x.status, x.accepted],
      warn ? ['hash-mismatch', false] : ['retired-sidecar-name', false],
    );
  }
  console.log('');
}

// ── the CLI, against the real policy as it stands right now (so this runs before AND after the flip)
const real = readSealPolicy();
const mode = real['sidecar-name'];
console.log(`the CLI under the real policy (${mode}):`);
const cli = (t) => {
  try {
    execFileSync('node', [CLI, 'verify-sidecar', '--file', t, '--keys', 'garden'], {
      env: { ...process.env, BONSAI_GARDEN: GARDEN },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return 0;
  } catch (e) {
    return e.status;
  }
};
check('hidden-only exits 0', cli(stage('hidden')), 0);
check(
  `old-only exits ${mode === 'warn' ? '0 (accepted with a warning)' : 'non-zero (refused)'}`,
  cli(stage('old')) === 0 ? 0 : 1,
  mode === 'warn' ? 0 : 1,
);
check('both present exits non-zero', cli(stage('both')) === 0 ? 0 : 1, 1);

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail === 0 ? 'PASS' : 'FAIL');
process.exit(fail === 0 ? 0 : 1);
