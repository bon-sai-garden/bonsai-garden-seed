// ---
// id: 01M4NQFXM0YBAPS309294XB0YE
// title: test-pot-verify — a pot vouching for its own files: both verifiers, one fixture set, the same verdicts
// type: script
// tended-by: mori-shin
// created: 2026-10-11
// updated: 2026-10-11
// ---
/**
 * test-pot-verify.mjs — `verify-sidecar <file> --keys pot --pot <dir> [--expect-fp <fp32>]`, Mori-shin's ruling of 2026-10-11.
 * Throwaway pots with throwaway keys, built here; nothing real is read or written. Every scenario runs through the Node verifier AND through
 * sign.py (mono, found by its tools/sign.py marker, or $SIGNPY), and the two must give the same verdict word and exit code: one definition.
 *
 *   node test-pot-verify.mjs                 # the scenarios
 *   POT_MUTANTS=1 node test-pot-verify.mjs   # and each guard broken in a copy: the scenarios must then fail
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = process.env.POT_VERIFY_SKILL_DIR || HERE; // a mutant copy, when the mutants run this file
const { buildV2, v2Payload } = await import(path.join(SKILL, 'lib', 'seal-v2.mjs'));
const { blake2b512Hex } = await import(path.join(SKILL, 'lib', 'embedded-format.mjs'));

let failures = 0;
let checks = 0;
const check = (label, cond, detail = '') => {
  checks++;
  if (!cond) failures++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${label}${cond ? '' : `  — ${String(detail).slice(0, 240)}`}`);
};

// sign.py, by marker: the sibling repo that holds tools/sign.py (never a repo's name)
function findSignPy() {
  if (process.env.SIGNPY) return process.env.SIGNPY;
  let d = HERE;
  for (;;) {
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
    for (const sib of fs.existsSync(parent) ? fs.readdirSync(parent) : []) {
      const c = path.join(parent, sib, 'tools', 'sign.py');
      if (fs.existsSync(c) && fs.existsSync(path.join(parent, sib, 'agents', 'registry.json'))) return c;
    }
  }
  return null;
}
const SIGNPY = findSignPy();

const ULID = () => {
  const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let t = Date.now(),
    s = '';
  for (let i = 0; i < 10; i++) {
    s = A[t % 32] + s;
    t = Math.floor(t / 32);
  }
  for (const b of crypto.randomBytes(16)) s += A[b % 32];
  return s.slice(0, 26);
};
const rawPub = (kp) => kp.publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
const fpOf = (raw) => crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);

/** A throwaway pot: registry, key file, garden.json, and data.txt sealed by `signer` (or by `signWith`'s key). */
function makePot({
  lab = true,
  signer = 'testgardener',
  custody = null,
  signWith = null,
  registryFp = null,
  hashText = null,
  keyRel = null,
  keyBytes = null,
  symlinkKey = false,
  listed = true,
  noRegistry = false,
} = {}) {
  const pot = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pot-verify-'))), 'pot');
  const kp = crypto.generateKeyPairSync('ed25519');
  const raw = keyBytes || rawPub(kp);
  const fp = fpOf(rawPub(kp));
  const rel = keyRel || `agents/${signer}`;
  fs.mkdirSync(path.join(pot, 'agents'), { recursive: true });
  const kd = path.resolve(pot, rel, 'identity');
  fs.mkdirSync(kd, { recursive: true });
  const kf = path.join(kd, `${signer}-public-key.bin`);
  if (symlinkKey) {
    const out = path.join(path.dirname(pot), 'outside.bin');
    fs.writeFileSync(out, raw);
    fs.symlinkSync(out, kf);
  } else fs.writeFileSync(kf, raw);
  if (!noRegistry)
    fs.writeFileSync(
      path.join(pot, 'agents', 'registry.json'),
      JSON.stringify({
        agents: listed ? [{ slug: signer, type: 'gardener', fingerprint: registryFp || fp, path: rel }] : [],
      }),
    );
  fs.writeFileSync(path.join(pot, 'garden.json'), JSON.stringify({ name: 'x', 'lab-preview': !!lab }));
  const f = path.join(pot, 'data.txt');
  fs.writeFileSync(f, 'a file the pot vouches for\n');
  const data = buildV2({
    id: ULID(),
    signer,
    role: 'owner',
    fingerprint: fp,
    timestamp: '2026-10-11T12:00:00Z',
    target: 'data.txt',
    fileHash: blake2b512Hex(fs.readFileSync(f)),
    custody,
  });
  data.signature = crypto.sign(null, v2Payload(data), (signWith || kp).privateKey).toString('base64');
  fs.writeFileSync(path.join(pot, '.data.txt.bonsaisig'), `${JSON.stringify(data, null, 2)}\n`);
  if (hashText !== null) fs.writeFileSync(f, hashText);
  return { pot, f, fp };
}

// the Node verb names the file (--file <p>); sign.py takes it first. Callers here pass [file, ...flags].
const runNode = (file, ...flags) => {
  const r = spawnSync(
    process.execPath,
    [path.join(SKILL, 'bin', 'sign.mjs'), 'verify-sidecar', '--file', file, ...flags],
    { encoding: 'utf8', timeout: 60000 },
  );
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
};
const runPy = (file, ...flags) => {
  const r = spawnSync('python3', [SIGNPY, 'verify-sidecar', file, ...flags], { encoding: 'utf8', timeout: 60000 });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
};
const first = (r) => r.out.trim().split('\n')[0] || r.err.trim().split('\n')[0] || '';
/** the verdict word: pot-ok, else the [status] of a FAIL line, else the first words of an error */
const word = (r) => {
  const all = r.out + r.err;
  if (/^pot-ok\b/m.test(r.out)) return 'pot-ok';
  if (/is not a pot/.test(all)) return 'error not-a-pot';
  const m = all.match(/\[([a-z-]+)\]/);
  if (m) return m[1];
  const e = all.match(/^error: (--[a-z-]+[^:]*)/m);
  return e ? `error ${e[1].split(' ').slice(0, 2).join(' ')}` : first(r);
};

/** one scenario, through both verifiers: the same word and the same exit code */
function both(label, args, wantWord, wantCode, extra) {
  const n = runNode(...args);
  const sameNode = word(n) === wantWord && n.code === wantCode;
  check(`${label} → ${wantWord}, exit ${wantCode} (node)`, sameNode, `${n.code} ${word(n)} | ${first(n)}`);
  if (SIGNPY) {
    const p = runPy(...args);
    check(
      `${label}: sign.py says the same`,
      word(p) === word(n) && p.code === n.code,
      `py ${p.code} ${word(p)} | node ${n.code} ${word(n)}`,
    );
  }
  if (extra) extra(n);
  return n;
}
if (!SIGNPY)
  console.log('  note  sign.py not found beside this repo: the Node verdicts are checked alone, with no parity');

console.log('1  the flags and the word');
let { pot, f, fp } = makePot({ lab: true });
let n = both("a lab-preview pot's good seal", [f, '--keys', 'pot', '--pot', pot], 'pot-ok', 0);
check(
  'the first line names the file and the root that vouched',
  first(n) === `pot-ok  ${f}  keys: pot ${pot}`,
  first(n),
);
check(
  'pot-ok never satisfies a caller that matches ^ok',
  !/^ok\b/.test(n.out.trim()) && !/^ok/.test(first(n)),
  first(n),
);
both('--keys pot without --pot', [f, '--keys', 'pot'], 'error --keys pot', 2);
both('--pot without --keys pot', [f, '--pot', pot], 'error --pot <dir>', 2);
both('--expect-fp without a pot', [f, '--expect-fp', fp], 'error --expect-fp pins', 2);
both('a malformed pin', [f, '--keys', 'pot', '--pot', pot, '--expect-fp', 'nothex'], 'error --expect-fp is', 2);
both('a directory that is not a pot', [f, '--keys', 'pot', '--pot', os.tmpdir()], 'error not-a-pot', 2);

console.log('2  the registry alone is not trust');
({ pot, f } = makePot({ lab: true, registryFp: 'f'.repeat(32) }));
both("a registry fingerprint that is not the key file's", [f, '--keys', 'pot', '--pot', pot], 'key-mismatch', 1);
({ pot, f } = makePot({ lab: true, keyBytes: Buffer.alloc(31, 1) }));
both('a key file of the wrong length', [f, '--keys', 'pot', '--pot', pot], 'key-mismatch', 1);
({ pot, f } = makePot({ lab: true, signWith: crypto.generateKeyPairSync('ed25519') }));
both('the registered signer, a signature by another key', [f, '--keys', 'pot', '--pot', pot], 'bad-signature', 1);
({ pot, f } = makePot({ lab: true, listed: false }));
both("a signer the pot's registry does not list", [f, '--keys', 'pot', '--pot', pot], 'unknown-signer', 1);
({ pot, f } = makePot({ lab: true, keyRel: '../outside-pot' }));
both(
  'a registry path that climbs out of the pot finds no key',
  [f, '--keys', 'pot', '--pot', pot],
  'unknown-signer',
  1,
);
({ pot, f } = makePot({ lab: true, symlinkKey: true }));
both(
  'a key file that is a link to somewhere outside the pot finds no key',
  [f, '--keys', 'pot', '--pot', pot],
  'unknown-signer',
  1,
);
({ pot, f } = makePot({ lab: true, hashText: 'edited after the seal\n' }));
both('a file edited after the seal', [f, '--keys', 'pot', '--pot', pot], 'hash-mismatch', 1);

console.log('3  trust comes from a declared rehearsal or a pin');
({ pot, f, fp } = makePot({ lab: false }));
n = both('a pot that is neither lab-preview nor pinned', [f, '--keys', 'pot', '--pot', pot], 'pot-untrusted', 1);
check(
  'and the refusal names both ways out',
  /lab-preview/.test(n.out + n.err) && /--expect-fp/.test(n.out + n.err),
  n.out + n.err,
);
both('the same pot, pinned to the signer', [f, '--keys', 'pot', '--pot', pot, '--expect-fp', fp], 'pot-ok', 0);
both(
  'the same pot, pinned to another fingerprint',
  [f, '--keys', 'pot', '--pot', pot, '--expect-fp', 'a'.repeat(32)],
  'pin-mismatch',
  1,
);
({ pot, f, fp } = makePot({ lab: true }));
both(
  'a lab-preview pot with a wrong pin',
  [f, '--keys', 'pot', '--pot', pot, '--expect-fp', 'b'.repeat(32)],
  'pin-mismatch',
  1,
);

console.log('4  custody: a rehearsal softens custody-fallback for its root, and says so');
({ pot, f } = makePot({ lab: true, custody: 'software-fallback' }));
n = both("a lab-preview pot's software-fallback seal", [f, '--keys', 'pot', '--pot', pot], 'pot-ok', 0);
check(
  'the warning line is printed on that verify',
  /pot-ok \(lab-preview: custody software-fallback accepted\)/.test(n.out),
  n.out,
);
({ pot, f } = makePot({ lab: true, custody: 'os-protected' }));
n = both("a lab-preview pot's os-protected seal", [f, '--keys', 'pot', '--pot', pot], 'pot-ok', 0);
check('no warning when nothing was softened', !/lab-preview: custody/.test(n.out), n.out);
({ pot, f, fp } = makePot({ lab: false, custody: 'software-fallback' }));
both(
  'a PINNED pot that is not a rehearsal: the same seal is refused as ours would be',
  [f, '--keys', 'pot', '--pot', pot, '--expect-fp', fp],
  'custody-refused',
  1,
);
({ pot, f } = makePot({ lab: true, custody: 'software-fallback', hashText: 'changed\n' }));
both('a softened tier never hides a worse finding', [f, '--keys', 'pot', '--pot', pot], 'hash-mismatch', 1);

console.log('5  the verify verb does not offer a pot');
({ pot, f } = makePot({ lab: true }));
{
  const r = spawnSync(
    process.execPath,
    [path.join(SKILL, 'bin', 'sign.mjs'), 'verify', '--file', f, '--keys', 'pot', '--pot', pot],
    { encoding: 'utf8' },
  );
  check(
    'verify --keys pot is refused, naming verify-sidecar',
    r.status === 2 && /verify-sidecar/.test(r.stderr),
    r.stderr,
  );
}

if (process.env.POT_MUTANTS) {
  console.log('mutants of the Node verifier: each guard broken in a copy must make these scenarios fail');
  const MUT = [
    ['the pot-trust gate (declared or pinned) is gone', 'lib/pot-keys.mjs', 'if (!lab && !pin) {', 'if (false) {'],
    [
      'the registry fingerprint is not held to the key file',
      'lib/pot-keys.mjs',
      'if (entry.fingerprint !== fingerprint) {',
      'if (false) {',
    ],
    ['the pin is not checked', 'lib/pot-keys.mjs', 'if (pot.pin && fingerprint !== pot.pin)', 'if (false)'],
    [
      'a key outside the pot is accepted',
      'lib/pot-keys.mjs',
      "if (inside.startsWith('..') || path.isAbsolute(inside) || !fs.statSync(real).isFile()) {",
      'if (false) {',
    ],
    ['a key of the wrong length is accepted', 'lib/pot-keys.mjs', 'if (raw.length !== 32) throw', 'if (false) throw'],
    [
      "a pot's yes prints ok",
      'bin/sign.mjs',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the line of bin/sign.mjs this case breaks, as source text
      'console.log(`pot-ok  ${file}  keys: pot ${pot.dir}`);',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the line it is replaced with, as source text
      'console.log(`ok  ${file}  keys: pot ${pot.dir}`);',
    ],
    [
      'every pot softens custody-fallback, not only a declared rehearsal',
      'lib/verify.mjs',
      'if (pot?.lab && v.status === CUSTODY_REFUSED) {',
      'if (pot && v.status === CUSTODY_REFUSED) {',
    ],
    [
      'the softening is not announced',
      'bin/sign.mjs',
      "if (result.labSoftened) console.log('pot-ok (lab-preview: custody software-fallback accepted)');",
      '',
    ],
    ['--keys pot without --pot is allowed', 'bin/sign.mjs', "if (mode === 'pot' && !args.pot) {", 'if (false) {'],
    ['--pot without --keys pot is allowed', 'bin/sign.mjs', "if (args.pot && mode !== 'pot') {", 'if (false) {'],
    [
      '--expect-fp without a pot is allowed',
      'bin/sign.mjs',
      "if (fp !== undefined && mode !== 'pot') {",
      'if (false) {',
    ],
    [
      "a pot's registry path is believed past the pot (no check the pot has a registry)",
      'lib/pot-keys.mjs',
      "if (!fs.existsSync(path.join(dir, 'agents', 'registry.json'))) {",
      'if (false) {',
    ],
    [
      'verify offers --keys pot',
      'bin/sign.mjs',
      `if (mode === 'pot') {\n    console.error("error: verifying against a pot is verify-sidecar`,
      `if (false) {\n    console.error("error: verifying against a pot is verify-sidecar`,
    ],
  ];
  for (const [label, rel, a, b] of MUT) {
    const src = fs.readFileSync(path.join(HERE, rel), 'utf8');
    if (src.split(a).length - 1 !== 1) {
      check(`mutant anchor '${label}'`, false, `found ${src.split(a).length - 1}`);
      continue;
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-mutant-'));
    for (const d of ['bin', 'lib', 'custody'])
      if (fs.existsSync(path.join(HERE, d))) fs.cpSync(path.join(HERE, d), path.join(tmp, d), { recursive: true });
    fs.copyFileSync(path.join(HERE, 'seal-policy.json'), path.join(tmp, 'seal-policy.json'));
    fs.writeFileSync(path.join(tmp, rel), src.replace(a, b));
    const r = spawnSync(process.execPath, [path.join(HERE, 'test-pot-verify.mjs')], {
      env: { ...process.env, POT_MUTANTS: '', POT_VERIFY_SKILL_DIR: tmp, SIGNPY: '' },
      encoding: 'utf8',
      timeout: 600000,
    });
    check(`${label} → the scenarios fail`, r.status !== 0, 'survived');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(failures ? `\nFAIL (${failures} of ${checks})` : `\nall hold (${checks} checks)`);
process.exit(failures ? 1 : 0);
