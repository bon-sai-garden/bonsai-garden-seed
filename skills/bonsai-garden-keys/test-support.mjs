// ---
// id: 01M4KRPW037TJQNYJ66D9J6SBS
// title: A scratch world for the suites past the arc: a core copy with a fake origin, and a seeded lab-preview pot
// type: script
// tended-by: baisai
// created: 2026-10-10
// updated: 2026-10-18
// ---
//
// test-support.mjs — TEST SUPPORT, never imported by anything a gardener runs. Used by
// test-seal-staged.mjs, test-install-runtime.mjs, runtime's tools/rt/test-rt.mjs and the stage-5
// proof. test-keys.mjs keeps its own harness (its cases plant custody faults this file does not need).
//
// makeWorld() copies core's keys, sign and mark skills and tools/ulid.py into a scratch directory,
// plants a reserved set sealed by a THROWAWAY origin key, and writes an entry that runs the binary's
// cli() with a fake bon-sai.garden (../bonsai-garden-mark/test-fake-origin.mjs). The global fetch in
// that process logs and throws. Custody is the lab preview's: the passphrase-wrapped file under a
// throwaway HOME, the passphrase a constant of this file, the master salt made by `mint` in the run
// and never read by this file. No real keychain, 1Password, master salt, key or network is touched.
//
// The environment every run gets names no garden: BONSAI_GARDEN points at a path that does not exist,
// so a tool that reached for the origin's mono would fail loudly instead of finding it.
//
// `signers` (2026-10-18, install-runtime's minimum): more THROWAWAY keys the fake site holds, by slug, so a
// suite can seal a fixture with a key the published keys vouch for (W.seal) and one they do not
// (W.stranger). KEYS_TEST_SITE_MODE, read only by the generated entry, puts the fake site in one of
// test-fake-origin.mjs's failure modes (unreachable, rejected, forged, ...); unset, it vouches.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PASS = 'correct horse battery staple';
export const pp = (...lines) => `${lines.join('\n')}\n`;
export const UNREACHABLE = '/nonexistent/mono-is-unreachable-in-this-run';

const RULE_B = [1, 3, 5, 10, 322, 582];
const FILLER_A = Array.from({ length: 33 }, (_, i) => 900 + i); // THROWAWAY set A, test material only
const ABOUT = [
  'Indices of the 1024-kanji set (v1.2) reserved in the first namespace. A mark that matches the rule (any shown kanji in wildcard, or its first in A and its second in B) means: choose another. It names no one and attests nothing.',
  'Not a roster. Nothing here can be verified against. Whoever wears a match anyway gets look-alike from the verifier, never a false yes.',
  'It only grows. An index never leaves this file; a retired name is still a taken name.',
];

/**
 * A scratch world. `srcCore` is the core whose skills are copied (default: this checkout);
 * `policy` is the copy's custody-fallback setting ('refuse', core's default, or 'warn', the
 * lab preview's hand-set value).
 */
export async function makeWorld({
  srcCore = path.resolve(HERE, '..', '..'),
  policy = 'refuse',
  tmp = null,
  label = 'world',
  signers: extra = [],
} = {}) {
  const FAKE = await import(path.join(srcCore, 'skills', 'bonsai-garden-mark', 'test-fake-origin.mjs'));
  const dir = fs.mkdtempSync(path.join(tmp || process.env.KEYS_TEST_TMP || os.tmpdir(), `${label}-`));
  const core = path.join(dir, 'core');
  for (const sk of ['bonsai-garden-keys', 'bonsai-garden-sign', 'bonsai-garden-mark']) {
    fs.cpSync(path.join(srcCore, 'skills', sk), path.join(core, 'skills', sk), { recursive: true });
  }
  fs.mkdirSync(path.join(core, 'tools'), { recursive: true });
  fs.copyFileSync(path.join(srcCore, 'tools', 'ulid.py'), path.join(core, 'tools', 'ulid.py'));
  const polFile = path.join(core, 'skills', 'bonsai-garden-sign', 'seal-policy.json');
  setPolicy(core, policy);

  const ORIGIN = FAKE.throwawaySigner('fixture-origin');
  const BONSAI = FAKE.throwawaySigner('bonsai');
  const EXTRA = Object.fromEntries(extra.map((slug) => [slug, FAKE.throwawaySigner(slug)]));
  const VERIFIER = FAKE.keypair();
  const signLib = path.join(core, 'skills', 'bonsai-garden-sign', 'lib');
  const rule = path.join(core, 'skills', 'bonsai-garden-mark', 'reserved-marks.json');
  fs.writeFileSync(
    rule,
    `${JSON.stringify(
      { format: 'bonsai-garden-reserved-marks/1', about: ABOUT, wildcard: [0], A: FILLER_A, B: RULE_B },
      null,
      2,
    )}\n`,
  );
  await FAKE.sealWith(signLib, rule, ORIGIN, { target: 'skills/bonsai-garden-mark/reserved-marks.json' });

  const cfg = {
    signers: [ORIGIN, BONSAI, ...Object.values(EXTRA)].map((k) => ({
      slug: k.slug,
      raw: k.raw.toString('base64'),
      fingerprint: k.fingerprint,
    })),
    verifier: VERIFIER.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
    verifierPub: VERIFIER.b64,
  };
  const entry = path.join(dir, 'entry.mjs');
  const siteLog = path.join(dir, 'site.log');
  fs.writeFileSync(
    entry,
    `// TEST ENTRY (test-support.mjs): the binary's cli() with a fake origin and a fetch that throws
import fs from 'node:fs';
import crypto from 'node:crypto';
import { cli } from ${JSON.stringify(path.join(core, 'skills', 'bonsai-garden-keys', 'bin', 'keys.mjs'))};
import { makeOrigin } from ${JSON.stringify(path.join(core, 'skills', 'bonsai-garden-mark', 'origin.mjs'))};
import { canonicalAnswer } from ${JSON.stringify(path.join(signLib, 'published-keys.mjs'))};
import { fakeSite } from ${JSON.stringify(path.join(core, 'skills', 'bonsai-garden-mark', 'test-fake-origin.mjs'))};
const log = (x) => fs.appendFileSync(${JSON.stringify(siteLog)}, x + '\\n');
globalThis.fetch = async () => { log('NETWORK'); throw new Error('no network in the suite'); };
const cfg = ${JSON.stringify(cfg)};
const verifier = { privateKey: crypto.createPrivateKey({ key: Buffer.from(cfg.verifier, 'base64'), format: 'der', type: 'pkcs8' }) };
const signers = cfg.signers.map((s) => ({ ...s, raw: Buffer.from(s.raw, 'base64') }));
const site = fakeSite({ signers, verifier, mode: process.env.KEYS_TEST_SITE_MODE || 'vouch', canonicalAnswer });
const fetchImpl = async (u, init) => { log('ASK ' + JSON.parse(init.body).signer); return site.fetchImpl(u, init); };
let deps = { origin: makeOrigin({ fetchImpl, pinnedKey: cfg.verifierPub }) };
if (process.env.RT_TEST_FETCH_DIR) {
  // install-runtime's download path, served from a local directory: URL basename -> file there
  const path = await import('node:path');
  deps.fetch = async (u) => {
    log('FETCH ' + u);
    if (process.env.RT_TEST_FETCH_MODE === 'offline') throw new TypeError('fetch failed (the test is offline)');
    const f = path.join(process.env.RT_TEST_FETCH_DIR, new URL(u).pathname.split('/').pop());
    if (!fs.existsSync(f)) return new Response('not found', { status: 404 });
    return new Response(fs.readFileSync(f), { status: 200 });
  };
}
await cli(process.argv.slice(2), deps);
`,
  );

  const home = path.join(dir, 'home');
  fs.mkdirSync(home, { recursive: true });
  const baseEnv = {
    PATH: `/usr/bin:/bin:/usr/sbin:/sbin:${path.dirname(process.execPath)}`,
    HOME: home,
    LANG: 'C',
    BONSAI_GARDEN: UNREACHABLE,
    BONSAI_REPOS_ROOT: UNREACHABLE,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: path.join(home, '.gitconfig'),
    GIT_AUTHOR_NAME: 'Gardener',
    GIT_AUTHOR_EMAIL: 'gardener@example.invalid',
    GIT_COMMITTER_NAME: 'Gardener',
    GIT_COMMITTER_EMAIL: 'gardener@example.invalid',
  };
  fs.writeFileSync(baseEnv.GIT_CONFIG_GLOBAL, '[init]\n\tdefaultBranch = main\n');
  const log = [];
  /** The binary through the entry, as a gardener runs it, in the bare environment above. */
  const run = (args, { input = '', env = {}, cwd = dir } = {}) => {
    const r = spawnSync(process.execPath, [entry, ...args], {
      cwd,
      env: { ...baseEnv, ...env },
      input,
      encoding: 'utf8',
      timeout: 600000,
    });
    const out = { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', args };
    log.push(out);
    return out;
  };
  /** Any command in the same environment (git, python3, node <rt>/...). */
  const sh = (cmd, args, { input = '', env = {}, cwd = dir } = {}) => {
    const r = spawnSync(cmd, args, { cwd, env: { ...baseEnv, ...env }, input, encoding: 'utf8', timeout: 600000 });
    const out = { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', args: [cmd, ...args] };
    log.push(out);
    return out;
  };
  const newPot = (name = 'pot') => {
    const pot = path.join(dir, name);
    fs.mkdirSync(pot, { recursive: true });
    const r = sh('git', ['init', '-q', pot]);
    if (r.code !== 0) throw new Error(`git init: ${r.stderr}`);
    return pot;
  };
  /** Bonsai's seed entry, a THROWAWAY stand-in sealed owner by the key the fake site holds for `bonsai`. */
  const bonsaiEntry = async () => {
    const f = path.join(dir, 'bonsai-seed-entry.json');
    if (fs.existsSync(f)) return f;
    fs.writeFileSync(
      f,
      `${JSON.stringify(
        {
          format: 'bonsai-garden-seed-entry/1',
          slug: 'bonsai',
          kanji: '盆才守神',
          'public-key': BONSAI.raw.toString('base64'),
          fingerprint: BONSAI.fingerprint,
          'fp-attests': 2,
          source: 'a throwaway fixture',
        },
        null,
        2,
      )}\n`,
    );
    await FAKE.sealWith(signLib, f, BONSAI, { target: 'agents/bonsai/identity/bonsai-seed-entry.json' });
    return f;
  };
  const B = ['--backends', 'file', '--passphrase-stdin'];
  /**
   * The keys arc on `pot`, lab preview: id, mint, recover export and drill, namespace, identity for
   * the gardener, bonsai-shin and one shin, derive, seed, and (unless told not to) attest. Throws on
   * any step that does not exit 0, naming it.
   */
  const seedPot = async (
    pot,
    { name = 'marta', gardener = 'ana', shin = 'kiko', attest = true, fpAttests = '1' } = {},
  ) => {
    const steps = [];
    const step = (what, args, input = pp(PASS)) => {
      const r = run(args, { input });
      steps.push([what, r]);
      if (r.code !== 0)
        throw new Error(`${what} exited ${r.code}: ${(r.stderr || r.stdout).trim().split('\n').slice(-2).join(' | ')}`);
      return r;
    };
    // shin: null plants a garden with no companion (W's F-5, 2026-10-18): bonsai-shin is then its only kin
    step('id', ['id', '--pot', pot, '--name', name, '--gardener', gardener, ...(shin ? ['--shin', shin] : [])], '');
    step('mint', ['mint', '--pot', pot, '--lab-preview', ...B], pp(PASS, PASS));
    const exp = path.join(dir, `${name}-master-salt.sealed`);
    step(
      'recover export',
      ['recover', 'export', '--pot', pot, '--out', exp, ...B],
      pp(PASS, `${PASS}-export`, `${PASS}-export`),
    );
    step(
      'recover drill',
      ['recover', 'drill', '--pot', pot, '--file', exp, '--passphrase-stdin'],
      pp(`${PASS}-export`),
    );
    step('namespace', ['namespace', '--pot', pot, ...B]);
    const SET = JSON.parse(
      fs.readFileSync(path.join(core, 'skills', 'bonsai-garden-mark', 'kanji-1024-v1.2.json'), 'utf8'),
    ).kanji;
    const kin = { [gardener]: [21, 70], 'bonsai-shin': [24, 25], ...(shin ? { [shin]: [26, 27] } : {}) };
    for (const [slug, [a, b]] of Object.entries(kin)) {
      step(`identity ${slug}`, [
        'identity',
        slug,
        '--pot',
        pot,
        ...(slug === 'bonsai-shin' ? [] : ['--pair', SET[a].char + SET[b].char]),
        '--fp-attests',
        fpAttests,
        ...B,
      ]);
    }
    for (const slug of [name, gardener, 'bonsai-shin', ...(shin ? [shin] : [])])
      step(`derive ${slug}`, ['derive', slug, '--pot', pot, ...B]);
    step('seed', ['seed', '--pot', pot, '--bonsai-entry', await bonsaiEntry(), ...B]);
    if (attest) step('attest', ['attest', '--pot', pot, ...B]);
    return { steps, exportFile: exp, name, gardener, shin };
  };
  const siteAsked = () => {
    const lines = fs.existsSync(siteLog) ? fs.readFileSync(siteLog, 'utf8').split('\n').filter(Boolean) : [];
    return { network: lines.includes('NETWORK'), lines };
  };
  /** A real bonsaisig/2 sidecar on `file` by `who`: a slug from `signers` (a key the fake site holds) or a signer object. */
  const seal = (file, who, opts = {}) => FAKE.sealWith(signLib, file, typeof who === 'string' ? EXTRA[who] : who, opts);
  return {
    dir,
    core,
    entry,
    seal,
    /** A THROWAWAY key under `slug` that the fake site does not hold: what it seals, the published keys reject. */
    stranger: (slug) => FAKE.throwawaySigner(slug),
    home,
    env: baseEnv,
    run,
    sh,
    newPot,
    seedPot,
    bonsaiEntry,
    siteAsked,
    log,
    B,
    setPolicy: (v) => setPolicy(core, v),
    polFile,
  };
}

/** The copy's custody-fallback line, set as the gardener would by hand. Only ever a scratch copy. */
function setPolicy(core, value) {
  const f = path.join(core, 'skills', 'bonsai-garden-sign', 'seal-policy.json');
  const pol = JSON.parse(fs.readFileSync(f, 'utf8'));
  pol['custody-fallback'] = value;
  fs.writeFileSync(f, `${JSON.stringify(pol, null, 2)}\n`);
}

/** Every byte the world's runs printed or wrote, searched for `needles` (Buffers); returns where they were found. */
export function leaks(world, needles, { skip = [] } = {}) {
  const hits = [];
  for (const o of world.log) {
    const hay = Buffer.from(`${o.stdout + o.stderr} ${o.args.join(' ')}`);
    for (const n of needles) if (hay.includes(n)) hits.push(`output of ${o.args.slice(0, 2).join(' ')}`);
  }
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (skip.includes(p)) continue;
      if (e.isDirectory()) {
        walk(p);
        continue;
      }
      if (!e.isFile()) continue;
      const buf = fs.readFileSync(p);
      for (const n of needles) if (buf.includes(n)) hits.push(`file ${path.relative(world.dir, p)}`);
    }
  };
  walk(world.dir);
  return hits;
}
