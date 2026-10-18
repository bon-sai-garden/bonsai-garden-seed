// ---
// id: 01M498HC0K51NYRQYVBWX3T853
// title: The gardener's keys, tested by planting each refusal
// type: script
// tended-by: baisai
// created: 2026-10-06
// updated: 2026-10-16
// ---
//
// test-keys.mjs — spec-gardeners-keys.md §13, every refusal planted, never read off the code.
//
//   node skills/bonsai-garden-keys/test-keys.mjs              every case
//   node skills/bonsai-garden-keys/test-keys.mjs --only a,b   the named cases (the mutant harness uses this)
//   node skills/bonsai-garden-keys/test-keys.mjs --list       the case names
//   node skills/bonsai-garden-keys/test-keys.mjs --shard 2/4  every fourth case, counting from the second: a runner
//                                                             splits the suite this way; --list honours it
//   node skills/bonsai-garden-keys/test-keys.mjs --help       this header
//
// TIME. Every case plants a world of its own, so the whole suite is slow: 89 cases, about 23 minutes alone on a
// loaded Mac Studio (1402 s on 2026-10-16, with the declared dependencies), past a 900 s runner limit. A runner
// that has one gives each shard its own process (--shard k/n); --only runs one case in seconds.
//
// Everything runs in a fresh scratch directory: a throwaway HOME, throwaway pots, throwaway
// custody (a scratch keychain FILE on macOS, a fake secret-tool and a fake op on PATH, the
// fallback file under the throwaway HOME). Nothing here reads or writes the gardener's real
// Keychain, the real 1Password, the real master salt or any real kin key. The real login
// keychain is never named: every macos-keychain case passes --keychain <scratch file>, and a
// case that would reach the default keychain is a bug in this file.
//
// KEYS_SKILL_DIR (this harness only, never the binary) points the cases at another copy of the
// skill: test-keys-mutants.mjs runs them against deliberately broken copies to watch them fail.
//
// THE ORIGIN, since the shipped reserved set: namespace, identity and seed ask bon-sai.garden (spec §6.4, §8.1).
// The suite never does. The three skills are copied into scratch; each copy carries a planted,
// sealed reserved-marks.json (a THROWAWAY origin key seals it) and an entry script that runs the
// binary's exported cli() with a fake site (../bonsai-garden-mark/test-fake-origin.mjs) answering
// signed by a THROWAWAY verifier key. The global fetch in that process is replaced by one that
// logs and throws, and every case fails if anything reached it. Bonsai's seed entry is a throwaway
// key the fake site holds for the slug `bonsai`, sealed by it, owner.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC_SKILL = process.env.KEYS_SKILL_DIR ? path.resolve(process.env.KEYS_SKILL_DIR) : HERE;
const SRC_SKILLS = path.dirname(SRC_SKILL);
const FAKE = await import(path.join(HERE, '..', 'bonsai-garden-mark', 'test-fake-origin.mjs')); // test support, never mutated
const SET = JSON.parse(
  fs.readFileSync(path.join(SRC_SKILLS, 'bonsai-garden-mark', 'kanji-1024-v1.2.json'), 'utf8'),
).kanji;
const IS_MAC = process.platform === 'darwin';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  // the header above is the one statement of what this file takes; print it rather than keep a second copy
  const lines = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n');
  const head = [];
  for (const l of lines.slice(lines.indexOf('// ---', 1) + 1)) {
    if (!l.startsWith('//')) break;
    head.push(l.replace(/^\/\/ ?/, ''));
  }
  console.log(head.join('\n').trim());
  process.exit(0);
}
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const shardArg = argv.includes('--shard') ? argv[argv.indexOf('--shard') + 1] : null;
const shard = shardArg ? shardArg.split('/').map(Number) : null;
if (
  shard &&
  !(
    shard.length === 2 &&
    Number.isInteger(shard[0]) &&
    Number.isInteger(shard[1]) &&
    shard[0] >= 1 &&
    shard[0] <= shard[1]
  )
) {
  console.error(`--shard takes k/n with 1 <= k <= n, not ${JSON.stringify(shardArg)}`);
  process.exit(64);
}
const inShard = (i) => !shard || i % shard[1] === shard[0] - 1;

// ── scratch world ────────────────────────────────────────────────────────────

const SCRATCH = fs.mkdtempSync(path.join(process.env.KEYS_TEST_TMP || os.tmpdir(), 'keys-test-'));
const HOME = path.join(SCRATCH, 'home');
const FAKEBIN = path.join(SCRATCH, 'fakebin');
fs.mkdirSync(HOME, { recursive: true });
fs.mkdirSync(FAKEBIN, { recursive: true });

// A fake secret-tool with the real one's grammar: `store --label=… k v …` reads the secret from
// stdin and overwrites silently (as the real one does, which is why put must look first);
// `lookup k v …` prints it, exit 1 and no stderr when absent. Modes, per store dir:
// ok · absent (no daemon on the bus) · locked · error · mangle (stores something else).
const FAKE_SS = `#!/usr/bin/env node
const fs = require('fs'), path = require('path');
const dir = process.env.FAKE_SS_DIR;
fs.appendFileSync(path.join(dir, 'argv.log'), JSON.stringify(process.argv.slice(2)) + '\\n');
let mode = 'ok'; try { mode = fs.readFileSync(path.join(dir, 'mode'), 'utf8').trim(); } catch {}
const storeFile = path.join(dir, 'store.json');
const store = fs.existsSync(storeFile) ? JSON.parse(fs.readFileSync(storeFile, 'utf8')) : {};
if (mode === 'absent') { process.stderr.write('Cannot autolaunch D-Bus without X11 $DISPLAY\\n'); process.exit(1); }
if (mode === 'error') { process.stderr.write('secret-tool: something unforeseen\\n'); process.exit(1); }
const [verb, ...rest] = process.argv.slice(2);
const attrs = rest.filter((a) => !a.startsWith('--'));
const key = attrs.join('|');
if (verb === 'lookup') {
  if (mode === 'locked') { process.stderr.write('Cannot get secret of a locked object\\n'); process.exit(1); }
  if (key in store) { process.stdout.write(store[key]); process.exit(0); }
  process.exit(1);
}
if (verb === 'store') {
  if (mode === 'locked') { process.stderr.write('Cannot create an item in a locked collection\\n'); process.exit(1); }
  let v = fs.readFileSync(0, 'utf8');
  if (mode === 'mangle') v = v.slice(0, -1) + (v.slice(-1) === '0' ? '1' : '0');
  store[key] = v; fs.writeFileSync(storeFile, JSON.stringify(store)); process.exit(0);
}
process.stderr.write('fake secret-tool: unknown verb\\n'); process.exit(2);
`;

// A fake op: `whoami`, `item get <title> --vault V [--fields label=password --reveal] [--format json]`,
// `item create --vault V` reading a JSON template from stdin. Modes: ok · signed-out.
const FAKE_OP = `#!/usr/bin/env node
const fs = require('fs'), path = require('path');
const dir = process.env.FAKE_OP_DIR;
fs.appendFileSync(path.join(dir, 'argv.log'), JSON.stringify(process.argv.slice(2)) + '\\n');
let mode = 'ok'; try { mode = fs.readFileSync(path.join(dir, 'mode'), 'utf8').trim(); } catch {}
const storeFile = path.join(dir, 'store.json');
const store = fs.existsSync(storeFile) ? JSON.parse(fs.readFileSync(storeFile, 'utf8')) : {};
const a = process.argv.slice(2);
const opt = (n) => { const i = a.indexOf(n); return i < 0 ? null : a[i + 1]; };
if (mode === 'signed-out') { process.stderr.write('[ERROR] You are not currently signed in.\\n'); process.exit(1); }
if (a[0] === 'whoami') { process.stdout.write('{"account":"fake"}'); process.exit(0); }
if (a[0] === 'item' && a[1] === 'get') {
  const k = opt('--vault') + '|' + a[2];
  if (!(k in store)) { process.stderr.write('[ERROR] "' + a[2] + '" isn\\'t an item in the vault.\\n'); process.exit(1); }
  if (a.includes('--reveal')) { process.stdout.write(store[k] + '\\n'); process.exit(0); }
  process.stdout.write('{"title":"' + a[2] + '"}'); process.exit(0);
}
if (a[0] === 'item' && a[1] === 'create') {
  const t = JSON.parse(fs.readFileSync(0, 'utf8'));
  const k = opt('--vault') + '|' + t.title;
  store[k] = t.fields.find((f) => f.id === 'password').value;
  fs.writeFileSync(storeFile, JSON.stringify(store)); process.exit(0);
}
process.stderr.write('fake op: unknown\\n'); process.exit(2);
`;

fs.writeFileSync(path.join(FAKEBIN, 'secret-tool'), FAKE_SS, { mode: 0o755 });
fs.writeFileSync(path.join(FAKEBIN, 'op'), FAKE_OP, { mode: 0o755 });

// ── the core the binary runs from: copies, each with a planted reserved set and a fake origin ──

const ORIGIN_KEY = FAKE.throwawaySigner('fixture-origin'); // seals the planted reserved sets
const BONSAI_KEY = FAKE.throwawaySigner('bonsai'); // stands in for the origin's Bonsai key
const STRANGER_KEY = FAKE.throwawaySigner('fixture-stranger'); // a key the fake site does not hold
const VERIFIER = FAKE.keypair();
const ABOUT = [
  // spec §6.3, copied independently
  'Indices of the 1024-kanji set (v1.2) reserved in the first namespace. A mark that matches the rule (any shown kanji in wildcard, or its first in A and its second in B) means: choose another. It names no one and attests nothing.',
  'Not a roster. Nothing here can be verified against. Whoever wears a match anyway gets look-alike from the verifier, never a false yes.',
  'It only grows. An index never leaves this file; a retired name is still a taken name.',
];
const TEMPLATE = path.join(SCRATCH, 'core-template');
for (const sk of ['bonsai-garden-keys', 'bonsai-garden-sign', 'bonsai-garden-mark']) {
  fs.cpSync(path.join(SRC_SKILLS, sk), path.join(TEMPLATE, 'skills', sk), { recursive: true });
}
fs.rmSync(path.join(TEMPLATE, 'skills', 'bonsai-garden-mark', 'reserved-marks.json'), { force: true });
fs.rmSync(path.join(TEMPLATE, 'skills', 'bonsai-garden-mark', '.reserved-marks.json.bonsaisig'), { force: true });
const SKILL = path.join(TEMPLATE, 'skills', 'bonsai-garden-keys');
const SKILLS = path.dirname(SKILL);
const BIN = path.join(SKILL, 'bin', 'keys.mjs');
const SITE_CFG = {
  signers: [ORIGIN_KEY, BONSAI_KEY].map((k) => ({
    slug: k.slug,
    raw: k.raw.toString('base64'),
    fingerprint: k.fingerprint,
  })),
  verifier: VERIFIER.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
  verifierPub: VERIFIER.b64,
};
const ENTRY = (core) => `// TEST ENTRY (test-keys.mjs): the binary's cli() with a fake origin, and no network
import fs from 'node:fs';
import crypto from 'node:crypto';
import { cli } from ${JSON.stringify(path.join(core, 'skills', 'bonsai-garden-keys', 'bin', 'keys.mjs'))};
import { makeOrigin } from ${JSON.stringify(path.join(core, 'skills', 'bonsai-garden-mark', 'origin.mjs'))};
import { canonicalAnswer } from ${JSON.stringify(path.join(core, 'skills', 'bonsai-garden-sign', 'lib', 'published-keys.mjs'))};
import { fakeSite } from ${JSON.stringify(path.join(HERE, '..', 'bonsai-garden-mark', 'test-fake-origin.mjs'))};
const log = (x) => fs.appendFileSync(process.env.KEYS_SITE_LOG, x + '\\n');
globalThis.fetch = async () => { log('NETWORK'); throw new Error('no network in the suite'); };
const cfg = ${JSON.stringify(SITE_CFG)};
const verifier = { privateKey: crypto.createPrivateKey({ key: Buffer.from(cfg.verifier, 'base64'), format: 'der', type: 'pkcs8' }) };
const signers = cfg.signers.map((s) => ({ ...s, raw: Buffer.from(s.raw, 'base64') }));
const site = fakeSite({ signers, verifier, mode: process.env.KEYS_SITE_MODE || 'vouch', canonicalAnswer });
const fetchImpl = async (u, init) => { log('ASK ' + JSON.parse(init.body).signer); return site.fetchImpl(u, init); };
await cli(process.argv.slice(2), { origin: makeOrigin({ fetchImpl, pinnedKey: cfg.verifierPub }) });
`;
const SEAL_V2 = await import(path.join(TEMPLATE, 'skills', 'bonsai-garden-sign', 'lib', 'seal-v2.mjs'));
const { newUlid } = await import(path.join(TEMPLATE, 'skills', 'bonsai-garden-sign', 'lib', 'ulid-rule.mjs'));
/** A real bonsaisig/2 sidecar at the hidden name, by a throwaway signer (synchronous). */
function sealSync(file, signer, { target, role = 'owner' }) {
  const obj = SEAL_V2.buildV2({
    id: newUlid(),
    signer: signer.slug,
    role,
    fingerprint: signer.fingerprint,
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    target,
    fileHash: crypto.createHash('blake2b512').update(fs.readFileSync(file)).digest('hex'),
  });
  obj.signature = crypto.sign(null, SEAL_V2.v2Payload(obj), signer.privateKey).toString('base64');
  fs.writeFileSync(
    path.join(path.dirname(file), `.${path.basename(file)}.bonsaisig`),
    `${JSON.stringify(obj, null, 2)}\n`,
  );
}
let coreN = 0;
/** A copy of the template core with `rule` planted (or none), sealed as asked, and its entry script. */
function plantCore({ rule = null, none = false, unsealed = false, signer = ORIGIN_KEY } = {}) {
  const core = path.join(SCRATCH, `core${++coreN}`);
  fs.cpSync(TEMPLATE, core, { recursive: true });
  const file = path.join(core, 'skills', 'bonsai-garden-mark', 'reserved-marks.json');
  if (!none) {
    fs.writeFileSync(file, typeof rule === 'string' ? rule : `${JSON.stringify(rule, null, 2)}\n`);
    if (!unsealed) sealSync(file, signer, { target: 'skills/bonsai-garden-mark/reserved-marks.json' });
  }
  const entry = path.join(core, 'entry.mjs');
  fs.writeFileSync(entry, ENTRY(core));
  return entry;
}
function defaultRule(A = [], B = []) {
  return {
    format: 'bonsai-garden-reserved-marks/1',
    about: ABOUT,
    wildcard: [0],
    A: [...new Set([...FILLER_A, ...A])].sort((x, y) => x - y),
    B: [...new Set([...RULE_B, ...B])].sort((x, y) => x - y),
  };
}

let worldN = 0;
/** A fresh world: its own fake stores, its own HOME, one pot (a git repo). */
function world({ ss = 'ok', op = 'ok' } = {}) {
  const w = path.join(SCRATCH, `w${++worldN}`);
  const ssDir = path.join(w, 'ss'),
    opDir = path.join(w, 'op'),
    home = path.join(w, 'home');
  for (const d of [ssDir, opDir, home]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(ssDir, 'mode'), ss);
  fs.writeFileSync(path.join(opDir, 'mode'), op);
  const pot = newPot(w, 'pot');
  return { dir: w, ssDir, opDir, home, pot, log: [], entry: DEFAULT_ENTRY, siteLog: path.join(w, 'site.log') };
}
/** How many times the fake site was asked in this world; a reach for the real network fails the suite. */
function asked(W) {
  const lines = exists(W.siteLog) ? fs.readFileSync(W.siteLog, 'utf8').split('\n').filter(Boolean) : [];
  if (lines.includes('NETWORK')) throw new Error('a run reached for the real network');
  return lines.length;
}
function newPot(w, name) {
  const pot = path.join(w, name);
  fs.mkdirSync(pot, { recursive: true });
  spawnSync('git', ['init', '-q', pot]);
  return pot;
}

/** Run the binary as a gardener would, in a bare environment: no BONSAI_GARDEN, no garden on the way up. */
function run(W, args, { input = '', env = {}, cwd = null, site = 'vouch' } = {}) {
  const e = {
    PATH: `${FAKEBIN}:/usr/bin:/bin:/usr/sbin:/sbin:${path.dirname(process.execPath)}`,
    HOME: W.home,
    FAKE_SS_DIR: W.ssDir,
    FAKE_OP_DIR: W.opDir,
    LANG: 'C',
    ...env,
    KEYS_SITE_MODE: site,
    KEYS_SITE_LOG: W.siteLog, // read by the test entry only, never the binary
  };
  const r = spawnSync(process.execPath, [W.entry, ...args], {
    cwd: cwd || W.dir,
    env: e,
    input,
    encoding: 'utf8',
    timeout: 600000,
  });
  const out = { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '', args };
  W.log.push(out);
  return out;
}

// ── helpers that read custody as a test, in this process only ────────────────

const ssStore = (W) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(W.ssDir, 'store.json'), 'utf8'));
  } catch {
    return {};
  }
};
const ssItem = (W, ulid) => ssStore(W)[`service|bon-sai.garden|account|${ulid}/master-salt`];
const gardenJson = (pot) => JSON.parse(fs.readFileSync(path.join(pot, 'garden.json'), 'utf8'));
const exists = (p) => fs.existsSync(p);

function plantGarden(W, { name = 'marta', extra = {} } = {}) {
  const r = run(W, ['id', '--pot', W.pot, '--name', name, '--gardener', 'ana', '--shin', 'kiko']);
  if (r.code !== 0) throw new Error(`id failed: ${r.stderr}`);
  if (Object.keys(extra).length) {
    const g = gardenJson(W.pot);
    fs.writeFileSync(path.join(W.pot, 'garden.json'), `${JSON.stringify({ ...g, ...extra }, null, 2)}\n`);
  }
  return gardenJson(W.pot).garden;
}
const PASS = 'correct horse battery staple';
const pp = (...lines) => `${lines.join('\n')}\n`;

/** fp → its first n kanji indices (engine.js slice over the fingerprint's bytes). */
function fpIndices(fpHex, n) {
  const b = Buffer.from(fpHex, 'hex');
  const out = [];
  for (let k = 0; k < n; k++) {
    let v = 0;
    for (let i = 0; i < 10; i++) {
      const bit = 10 * k + i;
      v = (v << 1) | ((b[bit >> 3] >> (7 - (bit & 7))) & 1);
    }
    out.push(v);
  }
  return out;
}
const markIdx = (s) => fpIndices(crypto.createHash('sha256').update(s, 'utf8').digest('hex'), 3);
const chars = (idx) => idx.map((i) => SET[i].char).join('');
// the guardian's pair is drawn, never chosen (spec §7.1): its identity takes no --pair, and the first attempt stands
const pairArg = (slug, a, b) => (slug === 'bonsai-shin' ? [] : ['--pair', SET[a].char + SET[b].char]);

// The Aruji's rule (spec 0.1.5) at its floor: the wildcard 〇, set B's six, and 33 first kanji in A.
// A's filler (900..932) is THROWAWAY test material, never the real set A; nothing here invents it.
const RULE_B = [1, 3, 5, 10, 322, 582];
const FILLER_A = Array.from({ length: 33 }, (_, i) => 900 + i);
/** Plant the reserved set the binary will read for this world (a sealed copy of core), never a flag. */
function ruleFile(W, { A = [], B = [], raw = null, none = false, unsealed = false, signer = ORIGIN_KEY } = {}) {
  W.entry = plantCore({ rule: raw || defaultRule(A, B), none, unsealed, signer });
  return W.entry;
}
const DEFAULT_ENTRY = plantCore({ rule: defaultRule() });
const blockedBy = (A, B) => (i) => i.includes(0) || (A.includes(i[0]) && B.includes(i[1]));

// ── cases ────────────────────────────────────────────────────────────────────

const cases = [];
const t = (name, fn) => cases.push({ name, fn });

t('usage-is-64', () => {
  const W = world();
  const r = run(W, ['no-such-verb']);
  return [r.code === 64, `exit ${r.code}`];
});

t('id-refuses-name-equal-to-seed-slug', () => {
  const W = world();
  const a = run(W, ['id', '--pot', W.pot, '--name', 'ana', '--gardener', 'ana', '--shin', 'kiko']);
  const b = run(W, ['id', '--pot', W.pot, '--name', 'bonsai-shin', '--gardener', 'ana', '--shin', 'kiko']);
  return [a.code === 2 && b.code === 2 && !exists(path.join(W.pot, 'garden.json')), `exits ${a.code},${b.code}`];
});

t('id-refuses-non-git-pot-and-bad-name', () => {
  const W = world();
  const bare = path.join(W.dir, 'not-a-repo');
  fs.mkdirSync(bare);
  const a = run(W, ['id', '--pot', bare, '--name', 'marta', '--gardener', 'ana', '--shin', 'kiko']);
  const b = run(W, ['id', '--pot', W.pot, '--name', 'Marta!', '--gardener', 'ana', '--shin', 'kiko']);
  return [a.code === 2 && b.code === 2 && !exists(path.join(bare, 'garden.json')), `exits ${a.code},${b.code}`];
});

t('id-refuses-second-garden-json', () => {
  const W = world();
  plantGarden(W);
  const before = fs.readFileSync(path.join(W.pot, 'garden.json'));
  const r = run(W, ['id', '--pot', W.pot, '--name', 'other', '--gardener', 'ana', '--shin', 'kiko']);
  return [r.code === 2 && before.equals(fs.readFileSync(path.join(W.pot, 'garden.json'))), `exit ${r.code}`];
});

t('id-is-a-generated-ulid', () => {
  const W = world();
  const u = plantGarden(W);
  return [/^[0-9A-HJKMNP-TV-Z]{26}$/.test(u) && exists(path.join(W.pot, 'pot.json')), u];
});

t('mint-over-existing-item-refused', () => {
  const W = world();
  const u = plantGarden(W);
  const planted = 'ab'.repeat(32);
  fs.writeFileSync(
    path.join(W.ssDir, 'store.json'),
    JSON.stringify({ [`service|bon-sai.garden|account|${u}/master-salt`]: planted }),
  );
  const before = fs.readFileSync(path.join(W.ssDir, 'store.json'));
  const r = run(W, ['mint', '--pot', W.pot, '--backends', 'secret-service']);
  const g = gardenJson(W.pot);
  // refused for the right reason, the item is there: a refusal for any other reason is not this guard
  return [
    r.code === 2 &&
      /never overwrites|already holds an item/.test(r.stderr) &&
      before.equals(fs.readFileSync(path.join(W.ssDir, 'store.json'))) &&
      !g['root-fingerprint'],
    `exit ${r.code}: ${r.stderr.trim().split('\n')[0]}`,
  ];
});

t('put-refuses-existing-before-a-byte', async () => {
  // the backend's own refusal, beneath the verb's: put on an occupied item throws EXISTS
  const W = world();
  const { backends } = await import(path.join(SKILL, 'lib', 'custody.mjs'));
  const env = { ...process.env, PATH: `${FAKEBIN}:${process.env.PATH}`, FAKE_SS_DIR: W.ssDir };
  const ss = backends({ env })['secret-service'];
  const u = '01M498HDH9TVC8T8FEKT2YGDRE';
  fs.writeFileSync(
    path.join(W.ssDir, 'store.json'),
    JSON.stringify({ [`service|bon-sai.garden|account|${u}/master-salt`]: 'cd'.repeat(32) }),
  );
  const before = fs.readFileSync(path.join(W.ssDir, 'store.json'));
  let code = null;
  try {
    await ss.put(u, 'ef'.repeat(32));
  } catch (e) {
    code = e.code;
  }
  const storeCalls = fs
    .readFileSync(path.join(W.ssDir, 'argv.log'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('"store"'));
  return [
    code === 'EXISTS' && before.equals(fs.readFileSync(path.join(W.ssDir, 'store.json'))) && storeCalls.length === 0,
    `code ${code}, store calls ${storeCalls.length}`,
  ];
});

t('mint-on-cannot-tell-halts', () => {
  // a garden.json that already names a root, and no custody item anywhere: unreachable is not absent
  const W = world();
  plantGarden(W, { extra: { 'root-fingerprint': '0'.repeat(32) } });
  const r = run(W, ['mint', '--pot', W.pot, '--backends', 'secret-service']);
  return [r.code === 3 && Object.keys(ssStore(W)).length === 0, `exit ${r.code}`];
});

t('mint-on-erroring-backend-halts', () => {
  const W = world({ ss: 'error' });
  plantGarden(W);
  const r = run(
    W,
    ['mint', '--pot', W.pot, '--backends', 'secret-service,file', '--lab-preview', '--passphrase-stdin'],
    { input: pp(PASS, PASS) },
  );
  return [r.code === 3 && !exists(path.join(W.home, '.bonsai-garden')), `exit ${r.code}`];
});

t('detect-never-steps-down-past-a-locked-keystore', () => {
  const W = world({ ss: 'locked' });
  plantGarden(W);
  const r = run(
    W,
    ['mint', '--pot', W.pot, '--backends', 'secret-service,file', '--lab-preview', '--passphrase-stdin'],
    { input: pp(PASS, PASS) },
  );
  return [
    r.code === 3 && /locked/i.test(r.stdout + r.stderr) && !exists(path.join(W.home, '.bonsai-garden')),
    `exit ${r.code}`,
  ];
});

t('floor-refuses-fallback-without-lab-preview', () => {
  const W = world({ ss: 'absent' });
  plantGarden(W);
  const r = run(W, ['mint', '--pot', W.pot, '--backends', 'secret-service,file', '--passphrase-stdin'], {
    input: pp(PASS, PASS),
    env: { BONSAI_LAB_PREVIEW: '1', LAB_PREVIEW: '1', BONSAI_GARDEN_LAB_PREVIEW: 'true' },
  });
  return [
    r.code === 2 &&
      /set up a keystore first/.test(r.stderr) &&
      !exists(path.join(W.home, '.bonsai-garden')) &&
      !gardenJson(W.pot)['root-fingerprint'],
    `exit ${r.code}: ${r.stderr.trim().split('\n')[0]}`,
  ];
});

t('floor-passes-vault-cli', () => {
  // spec 0.1.2, the Aruji: "1Password alone is a stranger's floor, good for now"; the tier is named
  const W = world({ ss: 'absent' });
  const u = plantGarden(W);
  const r = run(W, ['mint', '--pot', W.pot, '--backends', 'secret-service,op,file']);
  const store = fs.existsSync(path.join(W.opDir, 'store.json'))
    ? JSON.parse(fs.readFileSync(path.join(W.opDir, 'store.json'), 'utf8'))
    : {};
  return [
    r.code === 0 &&
      gardenJson(W.pot)['custody-tier'] === 'vault-cli' &&
      /^[0-9a-f]{64}$/.test(store[`Bonsai Garden|${u}/master-salt`] || '') &&
      !exists(path.join(W.home, '.bonsai-garden')),
    `exit ${r.code}: ${(r.stderr || '').trim().split('\n')[0]}`,
  ];
});

t('lab-preview-proceeds-and-names-the-tier', () => {
  const W = world({ ss: 'absent' });
  plantGarden(W);
  const r = run(
    W,
    ['mint', '--pot', W.pot, '--backends', 'secret-service,file', '--lab-preview', '--passphrase-stdin'],
    { input: pp(PASS, PASS) },
  );
  const g = gardenJson(W.pot);
  // the first seal: garden.json's, by the root key; it declares the tier when the envelope carries
  // the optional `custody` field (Mori-shin's half of §10, in core's seal-v2.mjs)
  let sc = {};
  try {
    sc = JSON.parse(fs.readFileSync(path.join(W.pot, '.garden.json.bonsaisig'), 'utf8'));
  } catch {
    /* none */
  }
  return [
    r.code === 0 &&
      g['custody-tier'] === 'software-fallback' &&
      g['lab-preview'] === true &&
      /software-fallback/.test(r.stdout) &&
      sc.custody === 'software-fallback',
    `exit ${r.code}, first seal custody ${sc.custody}: ${(r.stderr || r.stdout).trim().split('\n')[0]}`,
  ];
});

t('mint-prints-the-root-fingerprint-and-nothing-secret', () => {
  const W = world();
  const u = plantGarden(W);
  const r = run(W, ['mint', '--pot', W.pot, '--backends', 'secret-service']);
  const hex = ssItem(W, u);
  const g = gardenJson(W.pot);
  const fp = g['root-fingerprint'];
  return [
    r.code === 0 &&
      /^[0-9a-f]{64}$/.test(hex || '') &&
      r.stdout.includes(fp) &&
      !r.stdout.includes(hex) &&
      g['custody-tier'] === 'os-protected',
    `exit ${r.code}`,
  ];
});

t('readback-mismatch-is-a-custody-fault', () => {
  const W = world({ ss: 'mangle' });
  const u = plantGarden(W);
  const r = run(W, ['mint', '--pot', W.pot, '--backends', 'secret-service']);
  return [
    r.code === 3 &&
      /custody fault/i.test(r.stderr) &&
      ssItem(W, u) !== undefined &&
      !gardenJson(W.pot)['root-fingerprint'],
    `exit ${r.code}: ${r.stderr.trim().split('\n')[0]}`,
  ];
});

function mintedWorld(opts = {}) {
  const W = world(opts);
  const u = plantGarden(W);
  const m = run(W, ['mint', '--pot', W.pot, '--backends', 'secret-service']);
  if (m.code !== 0) throw new Error(`mint: ${m.stderr}`);
  return { W, u };
}

t('export-refuses-short-passphrase-and-the-pot', () => {
  const { W } = mintedWorld();
  const a = run(
    W,
    [
      'recover',
      'export',
      '--pot',
      W.pot,
      '--out',
      path.join(W.dir, 'a.sealed'),
      '--backends',
      'secret-service',
      '--passphrase-stdin',
    ],
    { input: pp('short', 'short') },
  );
  const b = run(
    W,
    [
      'recover',
      'export',
      '--pot',
      W.pot,
      '--out',
      path.join(W.pot, 'b.sealed'),
      '--backends',
      'secret-service',
      '--passphrase-stdin',
    ],
    { input: pp(PASS, PASS) },
  );
  const c = run(
    W,
    [
      'recover',
      'export',
      '--pot',
      W.pot,
      '--out',
      path.join(W.dir, 'c.sealed'),
      '--backends',
      'secret-service',
      '--passphrase-stdin',
    ],
    { input: pp(PASS, `${PASS}x`) },
  );
  return [
    a.code === 2 &&
      b.code === 2 &&
      c.code === 2 &&
      !exists(path.join(W.dir, 'a.sealed')) &&
      !exists(path.join(W.pot, 'b.sealed')) &&
      !exists(path.join(W.dir, 'c.sealed')),
    `exits ${a.code},${b.code},${c.code}`,
  ];
});

t('export-refuses-overwrite', () => {
  const { W } = mintedWorld();
  const out = path.join(W.dir, 'x.sealed');
  fs.writeFileSync(out, 'already here');
  const r = run(
    W,
    ['recover', 'export', '--pot', W.pot, '--out', out, '--backends', 'secret-service', '--passphrase-stdin'],
    { input: pp(PASS, PASS) },
  );
  return [r.code === 2 && fs.readFileSync(out, 'utf8') === 'already here', `exit ${r.code}`];
});

t('drill-wrong-passphrase-fails-and-writes-nothing', () => {
  const { W } = mintedWorld();
  const out = path.join(W.dir, 'marta-master-salt.sealed');
  const e = run(
    W,
    ['recover', 'export', '--pot', W.pot, '--out', out, '--backends', 'secret-service', '--passphrase-stdin'],
    { input: pp(PASS, PASS) },
  );
  const before = fs.readFileSync(path.join(W.pot, 'garden.json'));
  const r = run(W, ['recover', 'drill', '--pot', W.pot, '--file', out, '--passphrase-stdin'], {
    input: pp('a wrong passphrase, long'),
  });
  return [
    e.code === 0 && r.code === 2 && before.equals(fs.readFileSync(path.join(W.pot, 'garden.json'))),
    `exits ${e.code},${r.code}`,
  ];
});

t('drill-refuses-a-tampered-export', () => {
  const { W } = mintedWorld();
  const out = path.join(W.dir, 'marta-master-salt.sealed');
  run(W, ['recover', 'export', '--pot', W.pot, '--out', out, '--backends', 'secret-service', '--passphrase-stdin'], {
    input: pp(PASS, PASS),
  });
  const env = JSON.parse(fs.readFileSync(out, 'utf8'));
  env.garden = '01M498HDH9TVC8T8FEKT2YGDRE'; // provenance: another garden's name on it
  fs.writeFileSync(out, JSON.stringify(env));
  const r = run(W, ['recover', 'drill', '--pot', W.pot, '--file', out, '--passphrase-stdin'], { input: pp(PASS) });
  return [r.code === 2, `exit ${r.code}`];
});

t('namespace-refuses-before-the-drill', () => {
  const { W } = mintedWorld();
  ruleFile(W);
  const r = run(W, ['namespace', '--pot', W.pot, '--backends', 'secret-service']);
  return [r.code === 2 && /recovery first/.test(r.stderr) && !gardenJson(W.pot).namespace, `exit ${r.code}`];
});

function drilledWorld(opts = {}) {
  const { W, u } = mintedWorld(opts);
  const out = path.join(W.dir, 'marta-master-salt.sealed');
  const e = run(
    W,
    ['recover', 'export', '--pot', W.pot, '--out', out, '--backends', 'secret-service', '--passphrase-stdin'],
    { input: pp(PASS, PASS) },
  );
  const d = run(W, ['recover', 'drill', '--pot', W.pot, '--file', out, '--passphrase-stdin'], { input: pp(PASS) });
  if (e.code !== 0 || d.code !== 0) throw new Error(`export/drill: ${e.stderr} ${d.stderr}`);
  return { W, u, out };
}

t('namespace-refuses-without-the-shipped-set', () => {
  // no reserved-marks.json in the core the binary runs from; then a sealed pair list; then an unsealed rule
  const { W } = drilledWorld();
  ruleFile(W, { none: true });
  const a = run(W, ['namespace', '--pot', W.pot, '--backends', 'secret-service']);
  ruleFile(W, { raw: { pairs: [] } });
  const b = run(W, ['namespace', '--pot', W.pot, '--backends', 'secret-service']);
  ruleFile(W, { unsealed: true });
  const c = run(W, ['namespace', '--pot', W.pot, '--backends', 'secret-service']);
  const ok =
    a.code === 2 &&
    /no reserved set/.test(a.stderr) &&
    b.code === 2 &&
    /pair list is not read/.test(b.stderr) &&
    c.code === 2 &&
    /unsealed/.test(c.stderr) &&
    !gardenJson(W.pot).namespace &&
    asked(W) === 0;
  return [ok, `exits ${a.code},${b.code},${c.code}; the site asked ${asked(W)}`];
});

t('namespace-ends-in-niwa-and-skips-an-excluded-pair', () => {
  const { W } = drilledWorld();
  // what the search would find with nothing excluded, computed here independently
  const name = gardenJson(W.pot).name;
  let first = null;
  const floorBlocks = blockedBy(FILLER_A, RULE_B);
  for (let n = 0; !first; n++) {
    const i = markIdx(`${name}#${n}`);
    if (i[2] === 322 && !floorBlocks(i)) first = i;
  }
  ruleFile(W, { A: [first[0]], B: [first[1]] }); // a throwaway rule, test material only
  const r = run(W, ['namespace', '--pot', W.pot, '--backends', 'secret-service']);
  const ns = gardenJson(W.pot).namespace || {};
  const idx = ns.salt ? markIdx(ns.salt) : [];
  const ok =
    r.code === 0 &&
    idx[2] === 322 &&
    ns.kanji === chars(idx) &&
    ns.kanji.endsWith('庭') &&
    !(idx[0] === first[0] && idx[1] === first[1]) &&
    !blockedBy([...FILLER_A, first[0]], [...RULE_B, first[1]])(idx);
  const again = run(W, ['namespace', '--pot', W.pot, '--backends', 'secret-service']);
  return [ok && again.code === 2, `exit ${r.code}, ${ns.kanji}, second ${again.code}`];
});

function namespacedWorld(opts = {}) {
  const ctx = drilledWorld(opts);
  const ex = ruleFile(ctx.W);
  const r = run(ctx.W, ['namespace', '--pot', ctx.W.pot, '--backends', 'secret-service']);
  if (r.code !== 0) throw new Error(`namespace: ${r.stderr}`);
  return { ...ctx, ex };
}

t('identity-refuses-a-reserved-pair', () => {
  const { W } = namespacedWorld();
  // 900 is in the throwaway set A, 1 (才) in set B
  const pair = SET[900].char + SET[1].char;
  const r = run(W, [
    'identity',
    'ana',
    '--pot',
    W.pot,
    '--pair',
    pair,
    '--fp-attests',
    '1',
    '--backends',
    'secret-service',
  ]);
  const locks = exists(path.join(W.pot, 'locked-salts.json'))
    ? JSON.parse(fs.readFileSync(path.join(W.pot, 'locked-salts.json'), 'utf8'))
    : {};
  return [r.code === 2 && /set A/.test(r.stderr) && !locks.agents?.ana, `exit ${r.code}`];
});

t('reserved-rule-wildcard-and-sets', () => {
  // spec 0.1.5, the Aruji's rule: 〇 (0) refused at any index; first in A and second in B refused.
  // A THROWAWAY rule file, test material only; the real reserved-marks.json is generated elsewhere.
  const { W } = drilledWorld();
  const name = gardenJson(W.pot).name;
  let first = null;
  const floorBlocks = blockedBy(FILLER_A, RULE_B);
  for (let n = 0; !first; n++) {
    const i = markIdx(`${name}#${n}`);
    if (i[2] === 322 && !floorBlocks(i)) first = i;
  }
  ruleFile(W, { A: [first[0], 21], B: [first[1], 70] });
  const ns = run(W, ['namespace', '--pot', W.pot, '--backends', 'secret-service']);
  const got = gardenJson(W.pot).namespace?.indices || [];
  const nsOk =
    ns.code === 0 &&
    got[2] === 322 &&
    !got.includes(0) &&
    !([first[0], 21].includes(got[0]) && [first[1], 70].includes(got[1]));
  // first in A, second in B: refused even though the exact pair was never listed (水森 from A×B)
  const ab = run(W, [
    'identity',
    'ana',
    '--pot',
    W.pot,
    '--pair',
    SET[21].char + SET[first[1]].char,
    '--fp-attests',
    '1',
    '--backends',
    'secret-service',
  ]);
  // the wildcard anywhere
  const wc = run(W, [
    'identity',
    'ana',
    '--pot',
    W.pot,
    '--pair',
    SET[26].char + SET[0].char,
    '--fp-attests',
    '1',
    '--backends',
    'secret-service',
  ]);
  // first in A, second not in B: allowed
  const okp = run(W, [
    'identity',
    'ana',
    '--pot',
    W.pot,
    '--pair',
    SET[21].char + SET[27].char,
    '--fp-attests',
    '1',
    '--backends',
    'secret-service',
  ]);
  return [
    nsOk && ab.code === 2 && /set A/.test(ab.stderr) && wc.code === 2 && /wildcard/.test(wc.stderr) && okp.code === 0,
    `namespace ${ns.code} ${chars(got)}, A×B ${ab.code}, wildcard ${wc.code}, A×notB ${okp.code}`,
  ];
});

t('identity-refuses-bon-as-a-first-shown-kanji-for-every-entity', () => {
  // spec §6.1 (0.5.0): the reserved rule lets 盆 through with a second outside B, and the verifier answers
  // look-alike to any 盆-first mark off the origin's key; so the search refuses it, whoever asks.
  const { W } = namespacedWorld();
  ruleFile(W, { A: [21], B: [70] });
  const bon = SET.findIndex((k) => k.char === '盆');
  const r = run(W, [
    'identity',
    'ana',
    '--pot',
    W.pot,
    '--pair',
    SET[bon].char + SET[27].char,
    '--fp-attests',
    '1',
    '--backends',
    'secret-service',
  ]);
  const lock = fs.existsSync(path.join(W.pot, 'locked-salts.json'))
    ? fs.readFileSync(path.join(W.pot, 'locked-salts.json'), 'utf8')
    : '';
  return [
    r.code === 2 && /盆/.test(r.stderr) && /first/.test(r.stderr) && !/"ana"/.test(lock),
    `exit ${r.code}: ${r.stderr.trim().slice(0, 140)}`,
  ];
});

// ── spec §7.3 (five attempts) and §7.1 (the guardian's draw) ─────────────────────────────────────────────
const NSJ = path.join(SKILLS, 'bonsai-garden-mark', 'namespace.mjs');
const idArgs = (W, slug, more) => [
  'identity',
  slug,
  '--pot',
  W.pot,
  '--fp-attests',
  '1',
  '--backends',
  'secret-service',
  ...more,
];
const parseFive = (out) =>
  [...out.matchAll(/^\s*([1-5])\s+(\S{4})\s+(\S+)\s*$/gm)].map((m) => ({ n: Number(m[1]), kanji: m[2], salt: m[3] }));
const locksOf = (W) => {
  const f = path.join(W.pot, 'locked-salts.json');
  return exists(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
};
const PAIR = () => SET[21].char + SET[70].char;

t('identity-candidates-print-five-ids-and-write-nothing', () => {
  const { W } = namespacedWorld();
  const before = fs.readFileSync(path.join(W.pot, 'locked-salts.json'), 'utf8');
  const a = run(W, idArgs(W, 'ana', ['--pair', PAIR(), '--candidates']));
  const b = run(W, idArgs(W, 'ana', ['--pair', PAIR(), '--candidates']));
  const five = parseFive(a.stdout);
  const after = fs.readFileSync(path.join(W.pot, 'locked-salts.json'), 'utf8');
  return [
    a.code === 0 &&
      five.length === 5 &&
      new Set(five.map((x) => x.salt)).size === 5 &&
      five.every((x) => x.kanji.startsWith(PAIR())) &&
      a.stdout === b.stdout &&
      before === after,
    `exit ${a.code}, ${five.length} IDs, same twice ${a.stdout === b.stdout}, pot unchanged ${before === after}`,
  ];
});

t('identity-pick-locks-the-chosen-attempt-and-the-lock-rederives', () => {
  const { W } = namespacedWorld();
  const five = parseFive(run(W, idArgs(W, 'ana', ['--pair', PAIR(), '--candidates'])).stdout);
  const r = run(W, idArgs(W, 'ana', ['--pair', PAIR(), '--pick', '3']));
  const e = locksOf(W).agents?.ana || {};
  const chk = spawnSync(process.execPath, [NSJ, 'check-locks', path.join(W.pot, 'locked-salts.json')], {
    encoding: 'utf8',
  });
  return [
    r.code === 0 &&
      five.length === 5 &&
      e.identity_salt === five[2].salt &&
      e.picked === 3 &&
      e.identity_kanji_full === five[2].kanji &&
      chk.status === 0,
    `exit ${r.code}, salt is the third ${e.identity_salt === five[2]?.salt}, picked ${e.picked}, check-locks ${chk.status}`,
  ];
});

t('identity-pick-out-of-range-is-refused-and-nothing-is-written', () => {
  const { W } = namespacedWorld();
  const r0 = run(W, idArgs(W, 'ana', ['--pair', PAIR(), '--pick', '0']));
  const r6 = run(W, idArgs(W, 'ana', ['--pair', PAIR(), '--pick', '6']));
  const rx = run(W, idArgs(W, 'ana', ['--pair', PAIR(), '--pick', 'two']));
  return [
    r0.code === 2 && r6.code === 2 && rx.code === 2 && !locksOf(W).agents?.ana,
    `exits ${r0.code},${r6.code},${rx.code}`,
  ];
});

t('identity-without-a-pick-the-first-stands-and-says-default', () => {
  const { W } = namespacedWorld();
  const five = parseFive(run(W, idArgs(W, 'ana', ['--pair', PAIR(), '--candidates'])).stdout);
  const r = run(W, idArgs(W, 'ana', ['--pair', PAIR()]));
  const e = locksOf(W).agents?.ana || {};
  return [
    r.code === 0 && e.picked === 'default' && five.length === 5 && e.identity_salt === five[0].salt,
    `exit ${r.code}, picked ${e.picked}`,
  ];
});

t('attempts-never-wear-the-wildcard-or-a-garden-third-kanji', async () => {
  // §7.3: a candidate whose third or fourth kanji is 〇, or whose third is 庭, is skipped and is not an attempt.
  // 2000 draws make a missing filter all but certain to show (about 0.3% of candidates carry either).
  const { attempts } = await import(path.join(SKILLS, 'bonsai-garden-mark', 'namespace.mjs'));
  const ex = { size: 1, reserved: () => null };
  const got = attempts({
    slug: 'bonsai-shin',
    garden: 'probe',
    pair: null,
    exclude: ex,
    taken: [],
    nsFirstTwo: null,
    count: 2000,
  });
  const bad = got.filter((c) => c.indices[2] === 0 || c.indices[3] === 0 || c.indices[2] === 322);
  const unique = new Set(got.map((c) => c.salt)).size;
  return [
    got.length === 2000 && bad.length === 0 && unique === 2000,
    `${got.length} drawn, ${bad.length} carrying 〇 or 庭 in the tail`,
  ];
});

t('the-draw-skips-a-taken-pair-the-namespaces-own-pair-and-a-bon-first-one', async () => {
  // deterministic, not statistical: take the draw's own first two pairs and declare them taken / the namespace's;
  // then find a candidate that is 盆-first and watch the draw step over it.
  const M = await import(path.join(SKILLS, 'bonsai-garden-mark', 'namespace.mjs'));
  const ex = { size: 1, reserved: () => null };
  const d0 = M.attempts({ slug: 'bonsai-shin', garden: 'probe', exclude: ex, count: 3 });
  const X = d0[0].pair,
    Y = d0[1].pair;
  const d1 = M.attempts({ slug: 'bonsai-shin', garden: 'probe', exclude: ex, taken: [X], nsFirstTwo: Y, count: 5 });
  const skips = d1.every((c) => c.pair.join() !== X.join() && c.pair.join() !== Y.join()) && d1.length === 5;
  const base = 'bonsai-shin@probe-id';
  let nBon = -1,
    before = 0;
  for (let n = 0; nBon < 0 && n < 3_000_000; n++) {
    const i = M.indices4(`${base}#${n}`);
    if (!M.tailOk(i)) continue;
    if (SET[i[0]].char === '盆') nBon = n;
    else before++;
  }
  const d2 = M.attempts({ slug: 'bonsai-shin', garden: 'probe', exclude: ex, count: before + 1 });
  const steps = nBon >= 0 && d2.length === before + 1 && !d2.some((c) => c.salt === `${base}#${nBon}`);
  return [skips && steps, `taken/namespace pair skipped ${skips}, 盆-first at #${nBon} stepped over ${steps}`];
});

t('guardian-pair-is-refused-the-rite-renders-the-slug-does-not-choose', () => {
  const { W } = namespacedWorld();
  const r = run(W, idArgs(W, 'bonsai-shin', ['--pair', PAIR()]));
  return [
    r.code === 2 && /rite|renders|draw/i.test(r.stderr) && !locksOf(W).agents?.['bonsai-shin'],
    `exit ${r.code}: ${r.stderr.trim().slice(0, 120)}`,
  ];
});

t('guardian-draw-five-allowed-ids-none-bon-first-none-taken-none-the-namespaces', () => {
  const { W } = namespacedWorld();
  const ana = run(W, idArgs(W, 'ana', ['--pair', PAIR()]));
  const a = run(W, idArgs(W, 'bonsai-shin', ['--candidates']));
  const b = run(W, idArgs(W, 'bonsai-shin', ['--candidates']));
  const five = parseFive(a.stdout);
  const ns = gardenJson(W.pot).namespace?.kanji || '';
  const bad = five.filter(
    (x) =>
      x.kanji[0] === '盆' ||
      x.kanji.slice(0, 2) === PAIR() ||
      x.kanji.slice(0, 2) === ns.slice(0, 2) ||
      x.kanji.includes(SET[0].char),
  );
  return [
    ana.code === 0 &&
      a.code === 0 &&
      five.length === 5 &&
      !bad.length &&
      a.stdout === b.stdout &&
      !locksOf(W).agents?.['bonsai-shin'],
    `ana ${ana.code}, exit ${a.code}, ${five.length} IDs, ${bad.length} bad, same twice ${a.stdout === b.stdout}`,
  ];
});

t('guardian-pick-locks-the-draw-and-a-hand-typed-guardian-salt-fails-check-locks', () => {
  const { W } = namespacedWorld();
  const five = parseFive(run(W, idArgs(W, 'bonsai-shin', ['--candidates'])).stdout);
  const r = run(W, idArgs(W, 'bonsai-shin', ['--pick', '2']));
  const lockFile = path.join(W.pot, 'locked-salts.json');
  const e = locksOf(W).agents?.['bonsai-shin'] || {};
  const good = spawnSync(process.execPath, [NSJ, 'check-locks', lockFile], { encoding: 'utf8' });
  // a salt typed by hand: it re-derives its own pair, so only the draw's own conditions can refuse it. Take a salt
  // that is 盆-first: the search never hands it out, and the lock must not be believed.
  const base = `bonsai-shin@${gardenJson(W.pot).name}-id`;
  let n = 0,
    bon = null;
  for (; n < 4_000_000 && !bon; n++) {
    const i = markIdx(`${base}#${n}`);
    if (chars([i[0]]) === '盆') bon = { salt: `${base}#${n}`, i };
  }
  const locks = locksOf(W);
  Object.assign(locks.agents['bonsai-shin'], {
    identity_salt: bon.salt,
    identity_pair: bon.i.slice(0, 2),
    identity_kanji: chars(bon.i.slice(0, 2)),
    identity_kanji_full: undefined,
  });
  fs.writeFileSync(lockFile, JSON.stringify(locks, null, 2));
  const bad = spawnSync(process.execPath, [NSJ, 'check-locks', lockFile], { encoding: 'utf8' });
  return [
    r.code === 0 &&
      five.length === 5 &&
      e.identity_salt === five[1].salt &&
      e.picked === 2 &&
      good.status === 0 &&
      bad.status === 1 &&
      /盆/.test(bad.stdout + bad.stderr),
    `pick ${r.code}, salt is the second ${e.identity_salt === five[1]?.salt}, good ${good.status}, 盆-first typed ${bad.status}`,
  ];
});

t('identity-refuses-a-pair-taken-in-this-garden-and-a-bad-slug', () => {
  const { W } = namespacedWorld();
  const pair = SET[21].char + SET[70].char; // 水森
  const a = run(W, [
    'identity',
    'ana',
    '--pot',
    W.pot,
    '--pair',
    pair,
    '--fp-attests',
    '1',
    '--backends',
    'secret-service',
  ]);
  const b = run(W, [
    'identity',
    'kiko',
    '--pot',
    W.pot,
    '--pair',
    pair,
    '--fp-attests',
    '1',
    '--backends',
    'secret-service',
  ]);
  const c = run(W, [
    'identity',
    'Bad@Slug',
    '--pot',
    W.pot,
    '--pair',
    SET[22].char + SET[23].char,
    '--fp-attests',
    '1',
    '--backends',
    'secret-service',
  ]);
  return [a.code === 0 && b.code === 2 && c.code === 2, `exits ${a.code},${b.code},${c.code}`];
});

t('hand-edited-lock-fails-check-set', () => {
  const { W } = namespacedWorld();
  run(W, [
    'identity',
    'ana',
    '--pot',
    W.pot,
    '--pair',
    SET[21].char + SET[70].char,
    '--fp-attests',
    '1',
    '--backends',
    'secret-service',
  ]);
  // spec §7 names check-set.mjs; that file is Mori-shin's seal, so the re-derivation lives in the mark
  // skill's namespace.mjs (check-locks) and check-set's delegation is offered to her by letter
  const CHECK = path.join(SKILLS, 'bonsai-garden-mark', 'namespace.mjs');
  const lockFile = path.join(W.pot, 'locked-salts.json');
  const good = spawnSync(process.execPath, [CHECK, 'check-locks', lockFile], { encoding: 'utf8' });
  const locks = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  locks.agents.ana.identity_salt = locks.agents.ana.identity_salt.replace(/#(\d+)$/, (_, n) => `#${Number(n) + 1}`);
  fs.writeFileSync(lockFile, JSON.stringify(locks, null, 2));
  const bad = spawnSync(process.execPath, [CHECK, 'check-locks', lockFile], { encoding: 'utf8' });
  return [good.status === 0 && bad.status === 1, `good ${good.status}, edited ${bad.status}`];
});

t('derive-refuses-a-slug-without-a-signing-salt', () => {
  const { W } = namespacedWorld();
  const r = run(W, ['derive', 'nobody', '--pot', W.pot, '--backends', 'secret-service']);
  return [r.code === 2 && !exists(path.join(W.pot, 'agents', 'nobody')), `exit ${r.code}`];
});

/**
 * Bonsai's seed entry, as core ships it (bonsai-garden-seed-entry/1) and sealed owner by the key the
 * fake site holds for `bonsai`: a THROWAWAY stand-in, test material only. Variants plant what seed
 * must refuse: another key (self-consistent, sealed by itself), no seal, a custodian seal, a seal
 * on another address, the file edited after its seal, and a seal by another key than the entry's.
 */
function bonsaiEntry(
  W,
  {
    key = BONSAI_KEY,
    sealer = null,
    role = 'owner',
    target = 'agents/bonsai/identity/bonsai-seed-entry.json',
    unsealed = false,
    editAfter = false,
    name = 'bonsai-seed-entry.json',
  } = {},
) {
  const f = path.join(W.dir, name);
  fs.writeFileSync(
    f,
    `${JSON.stringify(
      {
        format: 'bonsai-garden-seed-entry/1',
        slug: 'bonsai',
        kanji: '盆才守神',
        'public-key': key.raw.toString('base64'),
        fingerprint: key.fingerprint,
        'fp-attests': 2,
        source: 'a throwaway fixture',
      },
      null,
      2,
    )}\n`,
  );
  if (!unsealed) sealSync(f, sealer || key, { target, role });
  if (editAfter) fs.appendFileSync(f, ' ');
  return f;
}

/** The whole arc, to the seed; fp-attests 1 to keep the suite quick, the arc case runs 2. */
function seededWorld({ fpAttests = '1', opts = {} } = {}) {
  const ctx = namespacedWorld(opts);
  const { W } = ctx;
  const pairs = { ana: [21, 70], 'bonsai-shin': [24, 25], kiko: [26, 27] };
  for (const [slug, [a, b]] of Object.entries(pairs)) {
    const r = run(W, [
      'identity',
      slug,
      '--pot',
      W.pot,
      ...pairArg(slug, a, b),
      '--fp-attests',
      fpAttests,
      '--backends',
      'secret-service',
    ]);
    if (r.code !== 0) throw new Error(`identity ${slug}: ${r.stderr}`);
  }
  const name = gardenJson(W.pot).name;
  for (const slug of [name, 'ana', 'bonsai-shin', 'kiko']) {
    const r = run(W, ['derive', slug, '--pot', W.pot, '--backends', 'secret-service']);
    if (r.code !== 0) throw new Error(`derive ${slug}: ${r.stderr}`);
  }
  const be = bonsaiEntry(W);
  const s = run(W, ['seed', '--pot', W.pot, '--bonsai-entry', be, '--backends', 'secret-service']);
  if (s.code !== 0) throw new Error(`seed: ${s.stderr}`);
  return { ...ctx, be, pairs };
}

t('seed-refuses-a-key-not-from-this-garden', () => {
  const ctx = namespacedWorld();
  const { W } = ctx;
  for (const [slug, [a, b]] of Object.entries({ ana: [21, 70], 'bonsai-shin': [24, 25], kiko: [26, 27] })) {
    run(W, [
      'identity',
      slug,
      '--pot',
      W.pot,
      ...pairArg(slug, a, b),
      '--fp-attests',
      '1',
      '--backends',
      'secret-service',
    ]);
  }
  const name = gardenJson(W.pot).name;
  for (const slug of [name, 'ana', 'bonsai-shin', 'kiko'])
    run(W, ['derive', slug, '--pot', W.pot, '--backends', 'secret-service']);
  // swap in a key from nowhere for kiko
  const { publicKey } = crypto.generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const idDir = path.join(W.pot, 'agents', 'kiko', 'identity');
  fs.writeFileSync(path.join(idDir, 'kiko-public-key.bin'), raw);
  fs.writeFileSync(
    path.join(idDir, 'kiko-fingerprint.txt'),
    `${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)}\n`,
  );
  const r = run(W, ['seed', '--pot', W.pot, '--bonsai-entry', bonsaiEntry(W), '--backends', 'secret-service']);
  return [r.code === 2 && !exists(path.join(W.pot, 'agents', 'registry.json')), `exit ${r.code}`];
});

// ── the gardener's ruling 2026-10-11, "option 2": a garden keeps ONE registry, in the origin's shape, the key fields
//    seed writes kept inside each entry (Bonsai's rehearsal, item 1) ───────────────────────────────────────────────
const regOf = (W) => JSON.parse(fs.readFileSync(path.join(W.pot, 'agents', 'registry.json'), 'utf8'));

t('seed-writes-the-origins-registry-shape-with-its-key-fields-inside', () => {
  const { W } = readyToSeed();
  const r = seedOf(W, bonsaiEntry(W));
  const reg = r.code === 0 ? regOf(W) : { agents: [] };
  const DISPLAY = [
    'name',
    'kanji',
    'kanji-chars',
    'pronouns',
    'type',
    'shintai',
    'parent',
    'principal',
    'status',
    'direction',
    'guardian',
    'element',
    'fp8',
    'fingerprint',
    'accent-rgba',
    'mark-url',
    'one-line',
    'tagline',
    'path',
  ];
  const shaped = reg.agents.length === 5 && reg.agents.every((a) => DISPLAY.every((k) => k in a));
  const g = gardenJson(W.pot);
  const root = reg.agents.find((a) => a.slug === g.name) || {};
  const shin = reg.agents.find((a) => a.slug === 'bonsai-shin') || {};
  const locks = JSON.parse(fs.readFileSync(path.join(W.pot, 'locked-salts.json'), 'utf8'));
  const keys =
    reg.agents.every((a) => typeof a.fingerprint === 'string' && a.fp8 === a.fingerprint.slice(0, 8)) &&
    reg.agents.filter((a) => a.slug !== 'bonsai').every((a) => 'custody-tier' in a) &&
    reg.agents.find((a) => a.slug === 'bonsai').origin === true &&
    typeof reg.agents.find((a) => a.slug === 'bonsai').vouched === 'string' &&
    shin.parent === 'bonsai';
  return [
    r.code === 0 &&
      /agent-registry-v1/.test(reg.$schema || '') &&
      /^[0-9A-HJKMNP-TV-Z]{26}$/.test(reg._meta?.id || '') &&
      reg.garden === g.garden &&
      shaped &&
      keys &&
      root.kanji === g.namespace.kanji &&
      shin.kanji === locks.agents['bonsai-shin'].identity_kanji_full &&
      shin['kanji-chars'].join('') === shin.kanji,
    `exit ${r.code}, shaped ${shaped}, keys ${keys}, schema ${reg.$schema}, root ${root.kanji}, shin ${shin.kanji}`,
  ];
});

t('seed-accepts-a-registry-whose-display-fields-were-filled-and-leaves-them', () => {
  const { W } = readyToSeed();
  seedOf(W, bonsaiEntry(W));
  const f = path.join(W.pot, 'agents', 'registry.json');
  const reg = regOf(W);
  const me = reg.agents.find((a) => a.slug === 'ana');
  Object.assign(me, {
    name: 'Ana',
    pronouns: 'she/her',
    'one-line': 'tends the beans',
    tagline: 'Walk with me?',
    'accent-rgba': 'rgba(1,2,3,0.35)',
  });
  fs.writeFileSync(f, `${JSON.stringify(reg, null, 2)}\n`);
  const again = seedOf(W, bonsaiEntry(W));
  const after = regOf(W).agents.find((a) => a.slug === 'ana');
  return [
    again.code === 0 &&
      after.name === 'Ana' &&
      after.pronouns === 'she/her' &&
      after['one-line'] === 'tends the beans' &&
      after.tagline === 'Walk with me?',
    `exit ${again.code}, display fields kept ${after.name} ${after.pronouns}`,
  ];
});

t('seed-refuses-a-registry-whose-key-field-was-changed-or-whose-roster-differs', () => {
  const { W } = readyToSeed();
  seedOf(W, bonsaiEntry(W));
  const f = path.join(W.pot, 'agents', 'registry.json');
  const orig = fs.readFileSync(f, 'utf8');
  const tries = [];
  for (const mutate of [
    (r) => {
      r.agents.find((a) => a.slug === 'ana').fingerprint = 'f'.repeat(32);
    },
    (r) => {
      r.agents.find((a) => a.slug === 'ana')['custody-tier'] = 'hardware';
    },
    (r) => {
      r.agents.find((a) => a.slug === 'bonsai-shin').parent = null;
    },
    (r) => {
      r.agents.push({ slug: 'stranger', type: 'shin', fingerprint: 'a'.repeat(32) });
    },
  ]) {
    const r = JSON.parse(orig);
    mutate(r);
    fs.writeFileSync(f, `${JSON.stringify(r, null, 2)}\n`);
    const before = fs.readFileSync(f, 'utf8');
    const out = seedOf(W, bonsaiEntry(W));
    tries.push(out.code === 2 && fs.readFileSync(f, 'utf8') === before);
  }
  return [tries.every(Boolean), `refused untouched: ${tries.join(',')}`];
});

t('seed-refuses-a-registry-with-other-content', () => {
  const ctx = namespacedWorld();
  const { W } = ctx;
  for (const [slug, [a, b]] of Object.entries({ ana: [21, 70], 'bonsai-shin': [24, 25], kiko: [26, 27] })) {
    run(W, [
      'identity',
      slug,
      '--pot',
      W.pot,
      ...pairArg(slug, a, b),
      '--fp-attests',
      '1',
      '--backends',
      'secret-service',
    ]);
  }
  const name = gardenJson(W.pot).name;
  for (const slug of [name, 'ana', 'bonsai-shin', 'kiko'])
    run(W, ['derive', slug, '--pot', W.pot, '--backends', 'secret-service']);
  fs.writeFileSync(path.join(W.pot, 'agents', 'registry.json'), JSON.stringify({ agents: [{ slug: 'someone' }] }));
  const before = fs.readFileSync(path.join(W.pot, 'agents', 'registry.json'));
  const r = run(W, ['seed', '--pot', W.pot, '--bonsai-entry', bonsaiEntry(W), '--backends', 'secret-service']);
  return [
    r.code === 2 && before.equals(fs.readFileSync(path.join(W.pot, 'agents', 'registry.json'))),
    `exit ${r.code}`,
  ];
});

t('keys-pot-stale-seal-is-hash-mismatch', () => {
  const { W } = seededWorld();
  const gj = path.join(W.pot, 'garden.json');
  const ok = run(W, ['verify', '--keys', 'pot', '--pot', W.pot, '--file', gj]);
  fs.appendFileSync(gj, ' ');
  const stale = run(W, ['verify', '--keys', 'pot', '--pot', W.pot, '--file', gj]);
  return [
    ok.code === 0 && stale.code === 1 && /hash-mismatch/.test(stale.stderr + stale.stdout),
    `ok ${ok.code}, stale ${stale.code}`,
  ];
});

t('keys-pot-unknown-signer-is-never-ok', () => {
  const { W } = seededWorld();
  // a seal by a key this pot does not list: plant a second pot's sealed garden.json here
  const other = seededWorld();
  const f = path.join(W.pot, 'stranger.json');
  fs.copyFileSync(path.join(other.W.pot, 'garden.json'), f);
  const side = (p) => path.join(path.dirname(p), `.${path.basename(p)}.bonsaisig`);
  const sc = JSON.parse(fs.readFileSync(side(path.join(other.W.pot, 'garden.json')), 'utf8'));
  sc.target = 'stranger.json';
  fs.writeFileSync(side(f), JSON.stringify(sc, null, 2));
  // same name, other garden: the key on file is not this signer's
  const r = run(W, ['verify', '--keys', 'pot', '--pot', W.pot, '--file', f]);
  // a signer the pot does not list at all
  sc.signer = 'nobody-here';
  fs.writeFileSync(side(f), JSON.stringify(sc, null, 2));
  const u = run(W, ['verify', '--keys', 'pot', '--pot', W.pot, '--file', f]);
  return [
    r.code === 1 &&
      /bad-signature/.test(r.stderr) &&
      u.code === 1 &&
      /unknown-signer/.test(u.stderr) &&
      !/^ok/m.test(r.stdout + u.stdout),
    `exits ${r.code},${u.code}: ${(u.stderr + u.stdout).trim().split('\n')[0]}`,
  ];
});

t('verify-names-only-keys-pot', () => {
  const W = world();
  const r = run(W, ['verify', '--keys', 'published', '--pot', W.pot, '--file', path.join(W.pot, 'x')]);
  const s = run(W, ['verify', '--keys', 'pot', '--file', path.join(W.pot, 'x')]);
  return [r.code === 64 && s.code === 64, `exits ${r.code},${s.code}`];
});

t('attest-refuses-a-root-key-that-is-not-32-bytes', () => {
  const { W } = seededWorld();
  const g = gardenJson(W.pot);
  g['root-public-key'] = 'AAAA'; // three bytes; no 64 hex anywhere, so only the length check can refuse
  fs.writeFileSync(path.join(W.pot, 'garden.json'), `${JSON.stringify(g, null, 2)}\n`);
  const r = run(W, ['attest', '--pot', W.pot, '--backends', 'secret-service']);
  return [
    r.code === 2 && /root-public-key/.test(r.stderr) && !exists(path.join(W.pot, 'garden-attestation.yaml')),
    `exit ${r.code}`,
  ];
});

t('attest-refuses-a-secret-shape-in-a-field', () => {
  // 64 hex in a field that flows into the document (a registry fingerprint)
  const { W } = seededWorld();
  const regFile = path.join(W.pot, 'agents', 'registry.json');
  const reg = JSON.parse(fs.readFileSync(regFile, 'utf8'));
  reg.agents.find((a) => a.slug === 'ana').fingerprint = 'ab'.repeat(32);
  fs.writeFileSync(regFile, `${JSON.stringify(reg, null, 2)}\n`);
  const r = run(W, ['attest', '--pot', W.pot, '--backends', 'secret-service']);
  return [
    r.code === 2 && /not public material/.test(r.stderr) && !exists(path.join(W.pot, 'garden-attestation.yaml')),
    `exit ${r.code}: ${r.stderr.trim().split('\n')[0]}`,
  ];
});

t('attest-refuses-a-fragment-of-the-salt', () => {
  // the salt's first eight characters in the garden's name: no field is 64 hex, the document is not
  const { W, u } = seededWorld();
  const g = gardenJson(W.pot);
  g.name = `${g.name}-${ssItem(W, u).slice(0, 8)}`;
  fs.writeFileSync(path.join(W.pot, 'garden.json'), `${JSON.stringify(g, null, 2)}\n`);
  const r = run(W, ['attest', '--pot', W.pot, '--backends', 'secret-service']);
  return [
    r.code === 2 && /master salt, or a fragment/.test(r.stderr) && !exists(path.join(W.pot, 'garden-attestation.yaml')),
    `exit ${r.code}: ${r.stderr.trim().split('\n')[0]}`,
  ];
});

t('attest-refuses-a-fragment-in-upper-case', () => {
  // the salt is random: when its first eight are all digits, upper case IS lower case and the case
  // watches nothing (it passed for the wrong reason once, 2026-10-07, on 8 digits). Plant again then.
  let W, u;
  for (let n = 0; n < 6; n++) {
    ({ W, u } = seededWorld());
    if (/[a-f]/.test(ssItem(W, u).slice(0, 8))) break;
  }
  if (!/[a-f]/.test(ssItem(W, u).slice(0, 8)))
    return [false, 'six salts in a row began with eight digits; the case cannot watch its guard'];
  const g = gardenJson(W.pot);
  g.name = `${g.name}-${ssItem(W, u).slice(0, 8).toUpperCase()}`;
  fs.writeFileSync(path.join(W.pot, 'garden.json'), `${JSON.stringify(g, null, 2)}\n`);
  const r = run(W, ['attest', '--pot', W.pot, '--backends', 'secret-service']);
  return [
    r.code === 2 && /master salt, or a fragment/.test(r.stderr) && !exists(path.join(W.pot, 'garden-attestation.yaml')),
    `exit ${r.code}`,
  ];
});

t('attest-document-check-stands-alone', async () => {
  // the document-level check, unit by unit: clean fields, a document that carries 64 hex anyway
  const { publicMaterialProblems } = await import(path.join(SKILL, 'lib', 'garden.mjs'));
  const p = publicMaterialProblems({
    g: { name: 'marta' },
    reg: { agents: [] },
    doc: `garden-attestation:\n  x: ${'cd'.repeat(32)}\n`,
    hex: 'ef'.repeat(32),
  });
  return [p.length === 1 && p[0].check === 'document', JSON.stringify(p.map((x) => x.check))];
});

t('restore-refuses-an-existing-item-then-restores-and-drills-ok', () => {
  const { W, u, out } = drilledWorld();
  const before = ssItem(W, u);
  const a = run(
    W,
    ['recover', 'restore', '--pot', W.pot, '--file', out, '--backends', 'secret-service', '--passphrase-stdin'],
    { input: pp(PASS) },
  );
  // a wiped host: the item gone, then restored from the export alone
  fs.writeFileSync(path.join(W.ssDir, 'store.json'), '{}');
  const b = run(
    W,
    ['recover', 'restore', '--pot', W.pot, '--file', out, '--backends', 'secret-service', '--passphrase-stdin'],
    { input: pp(PASS) },
  );
  return [
    a.code === 2 &&
      /restore never overwrites/.test(a.stderr) &&
      b.code === 0 &&
      /\bok\b/.test(b.stdout) &&
      ssItem(W, u) === before,
    `exits ${a.code},${b.code}`,
  ];
});

t('two-gardens-side-by-side-and-the-legacy-item-untouched', async () => {
  // one host, one store: two gardens, and our legacy item planted with THROWAWAY bytes
  const W = world();
  const legacyKey = 'service|Bonsai Garden Master Salt|account|bonsai-master-salt';
  const legacy = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(path.join(W.ssDir, 'store.json'), JSON.stringify({ [legacyKey]: legacy }));
  const u1 = plantGarden(W);
  run(W, ['mint', '--pot', W.pot, '--backends', 'secret-service']);
  const pot2 = newPot(W.dir, 'pot2');
  const r2 = run(W, ['id', '--pot', pot2, '--name', 'ilse', '--gardener', 'ana', '--shin', 'kiko']);
  const u2 = gardenJson(pot2).garden;
  const before1 = ssItem(W, u1);
  const m2 = run(W, ['mint', '--pot', pot2, '--backends', 'secret-service']);
  const store = ssStore(W);
  return [
    r2.code === 0 &&
      m2.code === 0 &&
      u1 !== u2 &&
      ssItem(W, u1) === before1 &&
      ssItem(W, u2) &&
      ssItem(W, u2) !== before1 &&
      store[legacyKey] === legacy &&
      gardenJson(W.pot)['root-fingerprint'] !== gardenJson(pot2)['root-fingerprint'],
    `mint2 ${m2.code}`,
  ];
});

// OPT-IN ONLY (--keychain-file-test). Tasai's rule of 2026-10-06, after a probe of a LOCKED scratch
// keychain put a SecurityAgent dialog on the gardener's screen: no `security` call that can prompt.
// So: throwaway password on the command line, unlocked with -p, no auto-lock (set-keychain-settings
// with no -l/-u), never locked, never show-keychain-info, never login.keychain-db, never on the
// search list. Without the flag the macOS backend is covered by its stub case below and this one
// reports SKIPPED, never PASS.
const KC_OPT_IN = argv.includes('--keychain-file-test');
t('macos-keychain-scratch-file-roundtrip', () => {
  if (!IS_MAC) return [true, 'skipped: not macOS'];
  if (!KC_OPT_IN) return ['skip', 'SKIPPED: opt-in only (--keychain-file-test); the stub case covers the backend'];
  const W = world();
  const kc = path.join(W.dir, 'scratch.keychain-db');
  if (path.basename(kc) === 'login.keychain-db' || kc.includes('/Library/Keychains/'))
    return [false, 'refusing a keychain path that is not scratch'];
  const pw = crypto.randomBytes(12).toString('hex');
  // Every `security` call has a hard timeout and is killed at it, so a stray dialog cannot sit open;
  // a call that times out stops the case at once and says which call it was (the gardener, 2026-10-07).
  const steps = [];
  const sec = (args, opts = {}) => {
    const t0 = Date.now();
    const r = spawnSync('security', args, { encoding: 'utf8', timeout: 8000, killSignal: 'SIGKILL', ...opts });
    steps.push(`${args[0]} ${Date.now() - t0}ms`);
    if (r.error || r.signal)
      throw new Error(
        `STOP: security ${args[0]} did not answer within 8s (${r.error ? r.error.code : r.signal}); a dialog may have opened`,
      );
    return r;
  };
  const searchBefore = sec(['list-keychains', '-d', 'user']).stdout;
  if (sec(['create-keychain', '-p', pw, kc]).status !== 0) return [false, 'create-keychain failed'];
  if (sec(['unlock-keychain', '-p', pw, kc]).status !== 0) return [false, 'unlock-keychain failed'];
  sec(['set-keychain-settings', kc]); // no -l, no -u: never auto-locks
  if (sec(['list-keychains', '-d', 'user']).stdout !== searchBefore) {
    return [false, 'the scratch keychain joined the search list; stopping before any item is written'];
  }
  // legacy item planted with THROWAWAY bytes in the scratch keychain, compared after
  const legacy = crypto.randomBytes(32).toString('hex');
  sec(['-i'], {
    input: `add-generic-password -a bonsai-master-salt -s "Bonsai Garden Master Salt" -w ${legacy} "${kc}"\n`,
  });
  const u = plantGarden(W);
  const timed = (args) => {
    const t0 = Date.now();
    const x = run(W, args);
    steps.push(`keys ${args[0]} ${Date.now() - t0}ms`);
    return x;
  };
  const det0 = timed(['detect', '--pot', W.pot, '--backends', 'macos-keychain', '--keychain', kc]);
  const r = timed(['mint', '--pot', W.pot, '--backends', 'macos-keychain', '--keychain', kc]);
  const read = sec(['find-generic-password', '-a', `${u}/master-salt`, '-s', 'bon-sai.garden', '-w', kc]);
  const det1 = timed(['detect', '--pot', W.pot, '--backends', 'macos-keychain', '--keychain', kc]);
  const again = timed(['mint', '--pot', W.pot, '--backends', 'macos-keychain', '--keychain', kc]);
  const leg = sec(['find-generic-password', '-a', 'bonsai-master-salt', '-s', 'Bonsai Garden Master Salt', '-w', kc]);
  const searchAfter = sec(['list-keychains', '-d', 'user']).stdout;
  const ok =
    det0.code === 0 &&
    /verdict: mint/.test(det0.stdout) &&
    r.code === 0 &&
    /^[0-9a-f]{64}$/.test(read.stdout.trim()) &&
    !r.stdout.includes(read.stdout.trim()) &&
    det1.code === 0 &&
    /verdict: derive/.test(det1.stdout) &&
    again.code === 2 &&
    leg.stdout.trim() === legacy &&
    gardenJson(W.pot)['custody-tier'] === 'os-protected' &&
    searchAfter === searchBefore;
  return [
    ok,
    `detect ${det0.code}/${det1.code}, mint ${r.code}, again ${again.code}, legacy intact ${leg.stdout.trim() === legacy}, search list unchanged ${searchAfter === searchBefore}; ${steps.join(', ')}; keychain ${kc}`,
  ];
});

t('macos-keychain-backend-stub', async () => {
  // The macOS backend's own logic, behind a stub `security` (no real Keychain, no prompt possible):
  // the right item name, the hex on stdin and never on argv, EXISTS before a byte, absent is exit 44.
  const W = world();
  const stubDir = path.join(W.dir, 'stub');
  fs.mkdirSync(stubDir);
  const stub = path.join(stubDir, 'security');
  fs.writeFileSync(
    stub,
    `#!/usr/bin/env node
const fs=require('fs'),p=require('path');const d=${JSON.stringify(stubDir)};
fs.appendFileSync(p.join(d,'argv.log'),JSON.stringify(process.argv.slice(2))+'\\n');
const sf=p.join(d,'store.json');const s=fs.existsSync(sf)?JSON.parse(fs.readFileSync(sf,'utf8')):{};
const a=process.argv.slice(2);const o=(n)=>{const i=a.indexOf(n);return i<0?null:a[i+1];};
if(a[0]==='-i'){const line=fs.readFileSync(0,'utf8');const m=line.match(/add-generic-password -a "([^"]+)" -s "([^"]+)" -w ([0-9a-f]+)/);
 if(!m){process.exit(1);} s[m[2]+'|'+m[1]]=m[3];fs.writeFileSync(sf,JSON.stringify(s));process.exit(0);}
if(a[0]==='find-generic-password'){const k=o('-s')+'|'+o('-a');if(!(k in s)){process.stderr.write('security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.\\n');process.exit(44);}
 if(a.includes('-w'))process.stdout.write(s[k]+'\\n');process.exit(0);}
process.exit(2);
`,
    { mode: 0o755 },
  );
  const { backends } = await import(path.join(SKILL, 'lib', 'custody.mjs'));
  const kc = backends({
    env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}` },
    keychain: '/nonexistent/stub.keychain-db',
    securityBin: stub,
  })['macos-keychain'];
  const u = '01M498HDPPDZQHYM1YHAK7APK7';
  const st0 = await kc.status(u);
  const hex = crypto.randomBytes(32).toString('hex');
  await kc.put(u, hex);
  const back = await kc.get(u);
  let code = null;
  try {
    await kc.put(u, 'ef'.repeat(32));
  } catch (e) {
    code = e.code;
  }
  const log = fs.readFileSync(path.join(stubDir, 'argv.log'), 'utf8');
  const ok =
    st0.present === false &&
    back === hex &&
    code === 'EXISTS' &&
    !log.includes(hex) &&
    log.includes(`${u}/master-salt`) &&
    log.includes('bon-sai.garden') &&
    !log.includes('login.keychain');
  return [
    ok,
    `absent ${st0.present === false}, roundtrip ${back === hex}, second put ${code}, hex on argv ${log.includes(hex)}`,
  ];
});

t('the-arc-end-to-end-and-the-secret-never-leaks', () => {
  const ctx = seededWorld({ fpAttests: '2' });
  const { W, u, pairs } = ctx;
  const name = gardenJson(W.pot).name;
  const a = run(W, ['attest', '--pot', W.pot, '--backends', 'secret-service']);
  const v1 = run(W, ['verify', '--keys', 'pot', '--pot', W.pot, '--file', path.join(W.pot, 'garden.json')]);
  const v2 = run(W, ['verify', '--keys', 'pot', '--pot', W.pot, '--file', path.join(W.pot, 'agents', 'registry.json')]);
  const v3 = run(W, ['verify', '--keys', 'pot', '--pot', W.pot, '--file', path.join(W.pot, 'garden-attestation.yaml')]);
  const st = run(W, ['status', '--pot', W.pot]);
  const reg = JSON.parse(fs.readFileSync(path.join(W.pot, 'agents', 'registry.json'), 'utf8'));
  const g = gardenJson(W.pot);
  // the fingerprint chains: each kin's fingerprint decodes to its chosen pair
  let chains = true;
  for (const [slug, pair] of Object.entries(pairs)) {
    const e = reg.agents.find((x) => x.slug === slug);
    const want = slug === 'bonsai-shin' ? locksOf(W).agents?.[slug]?.identity_pair || [] : pair; // the guardian's pair is drawn (spec §7.1)
    chains =
      chains &&
      e &&
      e['fp-attests'] === 2 &&
      fpIndices(e.fingerprint, 2).join() === want.join() &&
      e['custody-tier'] === 'os-protected';
  }
  const root = reg.agents.find((x) => x.slug === name);
  chains =
    chains && root && root.type === 'garden' && root['fp-attests'] === 0 && root.fingerprint === g['root-fingerprint'];
  const att = fs.existsSync(path.join(W.pot, 'garden-attestation.yaml'))
    ? fs.readFileSync(path.join(W.pot, 'garden-attestation.yaml'), 'utf8')
    : '';

  // §3.5: the hex, its first 8, its base64 and its raw bytes, in every byte any step printed or wrote
  const hex = ssItem(W, u);
  const raw = Buffer.from(hex, 'hex');
  const needles = [
    Buffer.from(hex),
    Buffer.from(hex.toUpperCase()),
    Buffer.from(hex.slice(0, 8)),
    Buffer.from(raw.toString('base64')),
    Buffer.from(raw.toString('base64url')),
    raw,
  ];
  const hay = [];
  for (const o of W.log)
    hay.push(
      [`out ${o.args[0]}`, Buffer.from(o.stdout + o.stderr)],
      [`argv ${o.args[0]}`, Buffer.from(o.args.join(' '))],
    );
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== '.git') walk(p);
        continue;
      }
      if (p === path.join(W.ssDir, 'store.json')) continue; // custody itself (the fake keystore)
      hay.push([`file ${path.relative(W.dir, p)}`, fs.readFileSync(p)]);
    }
  };
  walk(W.dir);
  const hits = [];
  for (const [where, buf] of hay) for (const n of needles) if (buf.includes(n)) hits.push(where);
  const ok =
    a.code === 0 &&
    v1.code === 0 &&
    v2.code === 0 &&
    v3.code === 0 &&
    st.code === 0 &&
    chains &&
    /custody-tier: os-protected/.test(att) &&
    att.includes(g.namespace.kanji) &&
    hits.length === 0 &&
    g['recovery-drilled'] &&
    /attest/.test(st.stdout);
  return [
    ok,
    `attest ${a.code}, verify ${v1.code}/${v2.code}/${v3.code}, chains ${chains}, leaks ${hits.length ? hits.join('; ') : 0}`,
  ];
});

t('lab-preview-arc-records-the-tier-everywhere', () => {
  const W = world({ ss: 'absent' });
  const u = plantGarden(W);
  const B = ['--backends', 'secret-service,file', '--passphrase-stdin'];
  const m = run(W, ['mint', '--pot', W.pot, '--lab-preview', ...B], { input: pp(PASS, PASS) });
  const out = path.join(W.dir, 'marta-master-salt.sealed');
  const e = run(W, ['recover', 'export', '--pot', W.pot, '--out', out, ...B], {
    input: pp(PASS, `${PASS}-export`, `${PASS}-export`),
  });
  const d = run(W, ['recover', 'drill', '--pot', W.pot, '--file', out, '--passphrase-stdin'], {
    input: pp(`${PASS}-export`),
  });
  ruleFile(W);
  const n = run(W, ['namespace', '--pot', W.pot, ...B], { input: pp(PASS) });
  for (const [slug, [x, y]] of Object.entries({ ana: [21, 70], 'bonsai-shin': [24, 25], kiko: [26, 27] })) {
    run(W, ['identity', slug, '--pot', W.pot, ...pairArg(slug, x, y), '--fp-attests', '1', ...B], { input: pp(PASS) });
  }
  for (const slug of ['marta', 'ana', 'bonsai-shin', 'kiko'])
    run(W, ['derive', slug, '--pot', W.pot, ...B], { input: pp(PASS) });
  const s = run(W, ['seed', '--pot', W.pot, '--bonsai-entry', bonsaiEntry(W), ...B], { input: pp(PASS) });
  const a = run(W, ['attest', '--pot', W.pot, ...B], { input: pp(PASS) });
  const reg = exists(path.join(W.pot, 'agents', 'registry.json'))
    ? JSON.parse(fs.readFileSync(path.join(W.pot, 'agents', 'registry.json'), 'utf8'))
    : { agents: [] };
  const att = exists(path.join(W.pot, 'garden-attestation.yaml'))
    ? fs.readFileSync(path.join(W.pot, 'garden-attestation.yaml'), 'utf8')
    : '';
  const g = gardenJson(W.pot);
  const custodyFile = path.join(W.home, '.bonsai-garden', 'custody', `${u}.salt.sealed`);
  const ok =
    [m, e, d, n, s, a].every((x) => x.code === 0) &&
    g['custody-tier'] === 'software-fallback' &&
    g['lab-preview'] === true &&
    reg.agents.filter((x) => x.slug !== 'bonsai').every((x) => x['custody-tier'] === 'software-fallback') &&
    /custody-tier: software-fallback/.test(att) &&
    /lab-preview: true/.test(att) &&
    exists(custodyFile) &&
    (fs.statSync(custodyFile).mode & 0o077) === 0;
  return [ok, `codes ${[m, e, d, n, s, a].map((x) => x.code).join(',')}`];
});

t('derive-all-unlocks-custody-once-and-writes-every-key', () => {
  // Bonsai's rehearsal, gap 3: derive x4 plus seed asked the passphrase five times. `derive --all` asks once.
  const W = world({ ss: 'absent' });
  plantGarden(W);
  const B = ['--backends', 'secret-service,file', '--passphrase-stdin'];
  run(W, ['mint', '--pot', W.pot, '--lab-preview', ...B], { input: pp(PASS, PASS) });
  const out = path.join(W.dir, 'marta-master-salt.sealed');
  run(W, ['recover', 'export', '--pot', W.pot, '--out', out, ...B], {
    input: pp(PASS, `${PASS}-export`, `${PASS}-export`),
  });
  run(W, ['recover', 'drill', '--pot', W.pot, '--file', out, '--passphrase-stdin'], { input: pp(`${PASS}-export`) });
  ruleFile(W);
  const nsr = run(W, ['namespace', '--pot', W.pot, ...B], { input: pp(PASS) });
  if (nsr.code !== 0) throw new Error(`namespace: ${nsr.stderr}`);
  for (const [slug, [x, y]] of Object.entries({ ana: [21, 70], 'bonsai-shin': [24, 25], kiko: [26, 27] })) {
    const r = run(W, ['identity', slug, '--pot', W.pot, ...pairArg(slug, x, y), '--fp-attests', '1', ...B], {
      input: pp(PASS),
    });
    if (r.code !== 0) throw new Error(`identity ${slug}: ${r.stderr}`);
  }
  const name = gardenJson(W.pot).name;
  const one = run(W, ['derive', '--all', '--pot', W.pot, ...B], { input: pp(PASS) }); // ONE passphrase on stdin
  const again = run(W, ['derive', '--all', '--pot', W.pot, ...B], { input: pp(PASS) });
  const both = run(W, ['derive', 'ana', '--all', '--pot', W.pot, ...B], { input: pp(PASS) });
  const keys = [name, 'ana', 'bonsai-shin', 'kiko'].filter((sl) =>
    exists(path.join(W.pot, 'agents', sl, 'identity', `${sl}-public-key.bin`)),
  );
  return [
    one.code === 0 && again.code === 0 && both.code === 64 && keys.length === 4,
    `exits ${one.code},${again.code},${both.code}, keys on file ${keys.length}`,
  ];
});

t('derive-names-the-files-it-wrote-and-the-command-that-seals-them', () => {
  // Bonsai's gap 72: derive wrote the key and fingerprint files, unsealed, and the pot's own gate then refused them with no
  // word from the tool. The seal-staged guard (only named paths, never the whole index) stays; the tool names what it wrote.
  const { W } = namespacedWorld();
  run(W, [
    'identity',
    'ana',
    '--pot',
    W.pot,
    ...pairArg('ana', 21, 70),
    '--fp-attests',
    '1',
    '--backends',
    'secret-service',
  ]);
  const r = run(W, ['derive', 'ana', '--pot', W.pot, '--backends', 'secret-service']);
  const again = run(W, ['derive', 'ana', '--pot', W.pot, '--backends', 'secret-service']);
  const rel = 'agents/ana/identity/ana-public-key.bin';
  return [
    r.code === 0 &&
      /seal-staged/.test(r.stdout) &&
      r.stdout.includes(rel) &&
      r.stdout.includes('agents/ana/identity/ana-fingerprint.txt') &&
      again.code === 0 &&
      !/seal-staged/.test(again.stdout),
    `first: ${r.stdout.trim().split('\n').slice(-2).join(' | ').slice(0, 200)} | again names nothing: ${!/seal-staged/.test(again.stdout)}`,
  ];
});

t('runs-from-core-alone', () => {
  // no import in the keys skill reaches outside core's skills/ (a clean machine has core and runtime only).
  // An import is a statement, not text: a line that opens with import/export (its `from` may sit lines below), or an
  // import() with no quote before it on its line. A test's fixture holding source in a string is neither, whatever its
  // quotes; matched as text, one became an import the day a formatter unescaped them (2026-10-15).
  const IMPORTS = [
    /^\s*(?:import|export)\b[^;'"`]*?\bfrom\s*(['"])(\.{1,2}\/[^'"]+)\1/gm,
    /^\s*import\s*(['"])(\.{1,2}\/[^'"]+)\1/gm,
    /^[^'"`\n]*\bimport\s*\(\s*(['"`])(\.{1,2}\/[^'"`]+)\1/gm,
  ];
  const bad = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        walk(p);
        continue;
      }
      if (!/\.m?js$/.test(e.name)) continue;
      const src = fs.readFileSync(p, 'utf8');
      for (const re of IMPORTS)
        for (const m of src.matchAll(re)) {
          const target = path.resolve(path.dirname(p), m[2]);
          if (!target.startsWith(SKILLS + path.sep)) bad.push(`${path.relative(SKILL, p)} -> ${m[2]}`);
        }
    }
  };
  walk(SKILL);
  return [bad.length === 0, bad.join('; ') || 'all imports inside core skills/'];
});

// ── Fuji-shin's round, 2026-10-06: two refusals that did not hold, five guards no test watched ────

t('export-refuses-the-pot-by-any-name', () => {
  // F1: a directory named `..x` inside the pot, and a symlink outside that points into it
  const { W } = mintedWorld();
  fs.mkdirSync(path.join(W.pot, '..x'));
  const a = run(
    W,
    [
      'recover',
      'export',
      '--pot',
      W.pot,
      '--out',
      path.join(W.pot, '..x', 'e.sealed'),
      '--backends',
      'secret-service',
      '--passphrase-stdin',
    ],
    { input: pp(PASS, PASS) },
  );
  fs.symlinkSync(W.pot, path.join(W.dir, 'into-the-pot'));
  const b = run(
    W,
    [
      'recover',
      'export',
      '--pot',
      W.pot,
      '--out',
      path.join(W.dir, 'into-the-pot', 'e.sealed'),
      '--backends',
      'secret-service',
      '--passphrase-stdin',
    ],
    { input: pp(PASS, PASS) },
  );
  // and the other way: a pot named through a symlink, the export written to its real path
  const c = run(
    W,
    [
      'recover',
      'export',
      '--pot',
      path.join(W.dir, 'into-the-pot'),
      '--out',
      path.join(W.pot, 'f.sealed'),
      '--backends',
      'secret-service',
      '--passphrase-stdin',
    ],
    { input: pp(PASS, PASS) },
  );
  const none =
    !exists(path.join(W.pot, '..x', 'e.sealed')) &&
    !exists(path.join(W.pot, 'e.sealed')) &&
    !exists(path.join(W.pot, 'f.sealed'));
  return [
    a.code === 2 && b.code === 2 && c.code === 2 && none,
    `exits ${a.code},${b.code},${c.code}, nothing in the pot ${none}`,
  ];
});

t('export-refuses-a-link-into-a-directory-inside-the-pot', () => {
  // a symlink to <pot>/sub: the out's own directory is not the pot, an ancestor of its real path is
  const { W } = mintedWorld();
  fs.mkdirSync(path.join(W.pot, 'sub'));
  fs.symlinkSync(path.join(W.pot, 'sub'), path.join(W.dir, 'into-sub'));
  const r = run(
    W,
    [
      'recover',
      'export',
      '--pot',
      W.pot,
      '--out',
      path.join(W.dir, 'into-sub', 'e.sealed'),
      '--backends',
      'secret-service',
      '--passphrase-stdin',
    ],
    { input: pp(PASS, PASS) },
  );
  return [r.code === 2 && !exists(path.join(W.pot, 'sub', 'e.sealed')), `exit ${r.code}`];
});

/**
 * Does this filesystem fold `variant` onto `name`? Decided by planting, never by the platform's name:
 * a probe file is written under one spelling and looked up under the other, in a fresh directory.
 */
function folds(dir, name, variant) {
  const probe = fs.mkdtempSync(path.join(dir, 'fold-probe-'));
  fs.writeFileSync(path.join(probe, name), 'x');
  return exists(path.join(probe, variant));
}

t('export-refuses-the-pot-by-another-spelling', () => {
  // F1 on APFS (Fuji-shin, second round): `.../POT/` for a pot at `.../pot`, and an NFD spelling of an
  // NFC pot directory. Meaningful on either kind of volume:
  //   where the filesystem folds the spelling, the variant IS the pot: the export must be refused;
  //   where it does not, the variant is made as its own directory, a sibling: the export must be written
  //   there and not into the pot. Neither branch can pass by the directory being absent.
  const W = world();
  const NFC = 'pöt',
    NFD = 'pöt';
  const pot = newPot(W.dir, NFC);
  const id = run(W, ['id', '--pot', pot, '--name', 'marta', '--gardener', 'ana', '--shin', 'kiko']);
  const m = run(W, ['mint', '--pot', pot, '--backends', 'secret-service']);
  const results = [];
  for (const [label, variant] of [
    ['case', NFC.toUpperCase()],
    ['nfd', NFD],
  ]) {
    const folded = folds(W.dir, NFC, variant);
    if (!folded) fs.mkdirSync(path.join(W.dir, variant));
    const out = path.join(W.dir, variant, `${label}.sealed`);
    const r = run(
      W,
      ['recover', 'export', '--pot', pot, '--out', out, '--backends', 'secret-service', '--passphrase-stdin'],
      { input: pp(PASS, PASS) },
    );
    const inPot = fs.readdirSync(pot).includes(`${label}.sealed`);
    const ok = folded
      ? r.code === 2 && /inside the pot/.test(r.stderr) && !inPot
      : r.code === 0 && !inPot && exists(out);
    results.push(
      `${label}: ${folded ? 'folds' : 'distinct'} -> exit ${r.code}${inPot ? ', IN THE POT' : ''}${ok ? '' : ' FAIL'}`,
    );
  }
  return [id.code === 0 && m.code === 0 && results.every((x) => !x.endsWith('FAIL')), results.join('; ')];
});

t('export-refuses-a-dangling-link-at-the-out-path', () => {
  // lstat, not existsSync: a dangling symlink at --out is taken, refused (2) with nothing written,
  // never left to the write's EEXIST (3). The link points outside the pot; the target must stay unmade.
  const { W } = mintedWorld();
  const target = path.join(W.dir, 'nowhere', 'target.sealed');
  const link = path.join(W.dir, 'dangling.sealed');
  fs.symlinkSync(target, link);
  const r = run(
    W,
    ['recover', 'export', '--pot', W.pot, '--out', link, '--backends', 'secret-service', '--passphrase-stdin'],
    { input: pp(PASS, PASS) },
  );
  return [r.code === 2 && /already exists/.test(r.stderr) && !exists(target), `exit ${r.code}`];
});

t('export-outside-the-pot-still-works', () => {
  // the containment check must not refuse a sibling whose name merely starts with the pot's
  const { W } = mintedWorld();
  const sib = path.join(W.dir, 'pot-backups');
  fs.mkdirSync(sib);
  const r = run(
    W,
    [
      'recover',
      'export',
      '--pot',
      W.pot,
      '--out',
      path.join(sib, 'e.sealed'),
      '--backends',
      'secret-service',
      '--passphrase-stdin',
    ],
    { input: pp(PASS, PASS) },
  );
  return [r.code === 0 && exists(path.join(sib, 'e.sealed')), `exit ${r.code}`];
});

t('reserved-set-floor', () => {
  // F2, now through the shipped file: each planted set is well-formed and SEALED by the origin's key,
  // and fails exactly one part of the floor, which the refusal names. The site is never asked: the
  // floor is the reader's, offline. (Shape refusals are reserved-marks' own suite.)
  const { W } = drilledWorld();
  const full = defaultRule();
  const files = {
    'no-wildcard': [{ ...full, wildcard: [] }, /wildcard does not hold 〇/],
    // a wildcard that is not empty and still lacks 〇: the limit is 〇, not "some wildcard"
    'wildcard-without-maru': [{ ...full, wildcard: [5] }, /wildcard does not hold 〇/],
    'b-missing-one': [{ ...full, B: RULE_B.filter((i) => i !== 582) }, /set B lacks 技/],
    // 盆 alone gone from set B: the limit is all six, 盆 included
    'b-missing-bon': [{ ...full, B: RULE_B.filter((i) => i !== 10) }, /set B lacks 盆/],
    'a-under-33': [{ ...full, A: FILLER_A.slice(0, 32) }, /set A holds 32\b/],
    // a pair list riding beside a rule at its floor: only the shape check can refuse it
    'a-pair-list': [
      {
        ...full,
        pairs: [
          [1, 2],
          [3, 4],
        ],
      },
      /pair list is not read/,
    ],
  };
  const codes = {};
  for (const [n, [raw, why]] of Object.entries(files)) {
    ruleFile(W, { raw });
    const r = run(W, ['namespace', '--pot', W.pot, '--backends', 'secret-service']);
    codes[n] =
      r.code === 2 && /reserved set to search against/.test(r.stderr) && why.test(r.stderr)
        ? 'refused'
        : `exit ${r.code}: ${r.stderr.trim().split('\n')[0].slice(-80)}`;
  }
  const ok = Object.values(codes).every((c) => c === 'refused') && !gardenJson(W.pot).namespace && asked(W) === 0;
  return [ok, `${JSON.stringify(codes)}; the site asked ${asked(W)}`];
});

t('an-arbitrary-set-is-refused-without-the-origins-word', () => {
  // the flip of reserved-floor-counts-and-does-not-know (spec §6.4 point 5): 33 arbitrary indices,
  // well-formed and sealed, but by a key bon-sai.garden does not hold. The floor counts; the seal knows.
  const { W } = drilledWorld();
  ruleFile(W, { raw: { ...defaultRule(), A: Array.from({ length: 33 }, (_, i) => 600 + i) }, signer: STRANGER_KEY });
  const r = run(W, ['namespace', '--pot', W.pot, '--backends', 'secret-service']);
  return [
    r.code === 2 && /rejected/.test(r.stderr) && !gardenJson(W.pot).namespace && asked(W) === 1,
    `exit ${r.code}: ${r.stderr.trim().split('\n')[0].slice(0, 120)}`,
  ];
});

t('reserved-set-empty-rule-refused', () => {
  const { W } = drilledWorld();
  ruleFile(W, { raw: { ...defaultRule(), wildcard: [], A: [], B: [] } });
  const r = run(W, ['namespace', '--pot', W.pot, '--backends', 'secret-service']);
  return [r.code === 2 && /under the floor/.test(r.stderr) && !gardenJson(W.pot).namespace, `exit ${r.code}`];
});

t('a-foreign-salt-in-custody-halts', () => {
  // custody holds a salt for this garden's item whose root is not garden.json's root
  const { W, u } = mintedWorld();
  const store = ssStore(W);
  store[`service|bon-sai.garden|account|${u}/master-salt`] = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(path.join(W.ssDir, 'store.json'), JSON.stringify(store));
  const out = path.join(W.dir, 'e.sealed');
  const e = run(
    W,
    ['recover', 'export', '--pot', W.pot, '--out', out, '--backends', 'secret-service', '--passphrase-stdin'],
    { input: pp(PASS, PASS) },
  );
  const d = run(W, ['derive', gardenJson(W.pot).name, '--pot', W.pot, '--backends', 'secret-service']);
  return [
    e.code === 3 &&
      d.code === 3 &&
      /not this garden's root/.test(e.stderr) &&
      !exists(out) &&
      !exists(path.join(W.pot, 'agents')),
    `export ${e.code}, derive ${d.code}`,
  ];
});

t('two-holders-halt', () => {
  const { W, u } = mintedWorld();
  fs.writeFileSync(
    path.join(W.opDir, 'store.json'),
    JSON.stringify({ [`Bonsai Garden|${u}/master-salt`]: ssItem(W, u) }),
  );
  const d = run(W, ['detect', '--pot', W.pot, '--backends', 'secret-service,op']);
  const x = run(W, ['derive', gardenJson(W.pot).name, '--pot', W.pot, '--backends', 'secret-service,op']);
  return [
    d.code === 3 && /two custody items/.test(d.stdout + d.stderr) && x.code === 3,
    `detect ${d.code}, derive ${x.code}`,
  ];
});

t('seed-refuses-a-bonsai-entry-that-is-not-its-key', () => {
  const ctx = namespacedWorld();
  const { W } = ctx;
  for (const [slug, [a, b]] of Object.entries({ ana: [21, 70], 'bonsai-shin': [24, 25], kiko: [26, 27] })) {
    run(W, [
      'identity',
      slug,
      '--pot',
      W.pot,
      ...pairArg(slug, a, b),
      '--fp-attests',
      '1',
      '--backends',
      'secret-service',
    ]);
  }
  const name = gardenJson(W.pot).name;
  for (const slug of [name, 'ana', 'bonsai-shin', 'kiko'])
    run(W, ['derive', slug, '--pot', W.pot, '--backends', 'secret-service']);
  const f = bonsaiEntry(W);
  const be = JSON.parse(fs.readFileSync(f, 'utf8'));
  be.fingerprint = crypto.randomBytes(16).toString('hex'); // a fingerprint that is not its key's
  fs.writeFileSync(f, JSON.stringify(be));
  const r = run(W, ['seed', '--pot', W.pot, '--bonsai-entry', f, '--backends', 'secret-service']);
  return [
    r.code === 2 && /fingerprint it states/.test(r.stderr) && !exists(path.join(W.pot, 'agents', 'registry.json')),
    `exit ${r.code}`,
  ];
});

t('drill-refuses-an-export-whose-root-signature-fails', () => {
  // the one layer alone: the envelope opens and derives this root, only the root key's signature is wrong
  const { W } = mintedWorld();
  const out = path.join(W.dir, 'marta-master-salt.sealed');
  run(W, ['recover', 'export', '--pot', W.pot, '--out', out, '--backends', 'secret-service', '--passphrase-stdin'], {
    input: pp(PASS, PASS),
  });
  const env = JSON.parse(fs.readFileSync(out, 'utf8'));
  const sig = Buffer.from(env.signature, 'base64');
  sig[10] ^= 1;
  env.signature = sig.toString('base64');
  fs.writeFileSync(out, JSON.stringify(env));
  const before = fs.readFileSync(path.join(W.pot, 'garden.json'));
  const r = run(W, ['recover', 'drill', '--pot', W.pot, '--file', out, '--passphrase-stdin'], { input: pp(PASS) });
  return [
    r.code === 2 && /signature/.test(r.stderr) && before.equals(fs.readFileSync(path.join(W.pot, 'garden.json'))),
    `exit ${r.code}`,
  ];
});

t('mint-refuses-an-unwritable-pot-before-custody', () => {
  // the stuck state: put succeeds and garden.json cannot be written. The pot is proved writable first.
  const W = world();
  plantGarden(W);
  fs.chmodSync(W.pot, 0o555);
  let r;
  try {
    r = run(W, ['mint', '--pot', W.pot, '--backends', 'secret-service']);
  } finally {
    fs.chmodSync(W.pot, 0o755);
  }
  return [
    r.code === 2 && Object.keys(ssStore(W)).length === 0 && !gardenJson(W.pot)['root-fingerprint'],
    `exit ${r.code}, items in custody ${Object.keys(ssStore(W)).length}`,
  ];
});

t('an-interrupted-mint-is-named-and-refused', () => {
  // the residue, if it happens anyway: an item and no root. Refused, named, nothing overwritten.
  const W = world();
  const u = plantGarden(W);
  fs.writeFileSync(
    path.join(W.ssDir, 'store.json'),
    JSON.stringify({ [`service|bon-sai.garden|account|${u}/master-salt`]: 'ab'.repeat(32) }),
  );
  const r = run(W, ['mint', '--pot', W.pot, '--backends', 'secret-service']);
  // spec §4.1: the refusal names the way out by the gardener's hand, and the item it means
  const wayOut =
    /remove the orphan item with the keystore's own tool/.test(r.stderr) &&
    /then run mint again/.test(r.stderr) &&
    r.stderr.includes(`${u}/master-salt`) &&
    /never deletes/.test(r.stderr);
  return [
    r.code === 2 && /interrupted mint/.test(r.stderr) && wayOut && ssItem(W, u) === 'ab'.repeat(32),
    `exit ${r.code}: ${r.stderr.trim().slice(0, 300)}`,
  ];
});

t('same-sentences-from-a-seat-and-a-bare-shell', () => {
  // spec §12: one binary, the same exits and the same sentences whichever face runs it
  const ctx = namespacedWorld();
  const { W } = ctx;
  const decoy = path.join(W.dir, 'decoy-garden');
  fs.mkdirSync(path.join(decoy, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(decoy, 'agents', 'registry.json'), '{"agents":[]}');
  const seat = { BONSAI_AGENT_SLUG: 'bonsai', BONSAI_ENV: 'seat', CLAUDECODE: '1', BONSAI_GARDEN: decoy };
  const B = ['--backends', 'secret-service'];
  const calls = [
    ['detect', '--pot', W.pot, ...B],
    ['status', '--pot', W.pot],
    ['mint', '--pot', W.pot, ...B],
    ['namespace', '--pot', W.pot, ...B],
    ['identity', 'Bad@Slug', '--pot', W.pot, '--pair', '水森', ...B],
    ['verify', '--keys', 'pot', '--pot', W.pot, '--file', path.join(W.pot, 'garden.json')],
    ['verify', '--keys', 'published', '--pot', W.pot, '--file', 'x'],
    ['derive', 'nobody', '--pot', W.pot, ...B],
    ['no-such-verb'],
  ];
  const diffs = [];
  for (const c of calls) {
    const bare = run(W, c);
    const seated = run(W, c, { env: seat, cwd: W.home });
    if (bare.code !== seated.code || bare.stdout !== seated.stdout || bare.stderr !== seated.stderr) diffs.push(c[0]);
  }
  return [diffs.length === 0, diffs.length ? `differ: ${diffs.join(', ')}` : `${calls.length} calls, identical`];
});

t('hidden-passphrase-prompt-on-a-tty', () => {
  // The terminal path: no --passphrase-stdin. A pty from python3's pty module, a throwaway passphrase,
  // the fake secret-tool. The passphrase must never be echoed, and the export must open with it.
  const py = spawnSync('python3', ['-c', 'import pty, select'], { encoding: 'utf8' });
  if (py.status !== 0) return ['skip', 'SKIPPED: no python3 with pty here'];
  const { W } = mintedWorld();
  const out = path.join(W.dir, 'tty.sealed');
  const driver = `
import os, pty, sys, time, select
pw = os.environ['KEYS_TTY_PASS'].encode()
pid, fd = pty.fork()
if pid == 0:
    os.execv(sys.argv[1], sys.argv[1:])
buf = b''; sent = 0; deadline = time.time() + 180
while time.time() < deadline:
    r, _, _ = select.select([fd], [], [], 0.5)
    if fd not in r: continue
    try: chunk = os.read(fd, 4096)
    except OSError: break
    if not chunk: break
    buf += chunk
    if buf.count(b'passphrase') > sent and buf.rstrip().endswith(b':'):
        os.write(fd, pw + b'\\r'); sent += 1
_, st = os.waitpid(pid, 0)
sys.stdout.buffer.write(buf)
sys.exit((st >> 8) & 0xff)
`;
  const env = {
    PATH: `${FAKEBIN}:/usr/bin:/bin:/usr/sbin:/sbin:${path.dirname(process.execPath)}`,
    HOME: W.home,
    FAKE_SS_DIR: W.ssDir,
    FAKE_OP_DIR: W.opDir,
    LANG: 'C',
    KEYS_TTY_PASS: PASS,
  };
  const r = spawnSync(
    'python3',
    [
      '-c',
      driver,
      process.execPath,
      BIN,
      'recover',
      'export',
      '--pot',
      W.pot,
      '--out',
      out,
      '--backends',
      'secret-service',
    ],
    { cwd: W.dir, env, encoding: 'utf8', timeout: 240000 },
  );
  const transcript = r.stdout || '';
  const d = run(W, ['recover', 'drill', '--pot', W.pot, '--file', out, '--passphrase-stdin'], { input: pp(PASS) });
  const ok =
    r.status === 0 &&
    exists(out) &&
    !transcript.includes(PASS) &&
    !transcript.includes(PASS.slice(0, 6)) &&
    (transcript.match(/passphrase/g) || []).length === 2 &&
    d.code === 0;
  return [
    ok,
    `tty export ${r.status}, echoed ${transcript.includes(PASS.slice(0, 6))}, prompts ${(transcript.match(/passphrase/g) || []).length}, drill ${d.code}`,
  ];
});

// ── the shipped reserved set: the origin is asked, never the package (spec §6.4, §8.1) ─────────────────────

t('exclude-is-usage-64', () => {
  const { W } = drilledWorld();
  const r = run(W, [
    'namespace',
    '--pot',
    W.pot,
    '--exclude',
    path.join(W.dir, 'weaker.json'),
    '--backends',
    'secret-service',
  ]);
  return [
    r.code === 64 && /--exclude is gone/.test(r.stderr) && !gardenJson(W.pot).namespace && asked(W) === 0,
    `exit ${r.code}: ${r.stderr.trim()}`,
  ];
});

t('namespace-asks-the-origin-once-and-proceeds-on-its-word', () => {
  const { W } = drilledWorld();
  const r = run(W, ['namespace', '--pot', W.pot, '--backends', 'secret-service']);
  const log = fs.readFileSync(W.siteLog, 'utf8').trim().split('\n');
  return [
    r.code === 0 && !!gardenJson(W.pot).namespace && log.length === 1 && log[0] === 'ASK fixture-origin',
    `exit ${r.code}; asked ${JSON.stringify(log)}`,
  ];
});

t('namespace-halts-when-the-origin-cannot-be-reached', () => {
  const { W } = drilledWorld();
  const a = run(W, ['namespace', '--pot', W.pot, '--backends', 'secret-service'], { site: 'unreachable' });
  const b = run(
    W,
    [
      'identity',
      'ana',
      '--pot',
      W.pot,
      '--pair',
      SET[21].char + SET[70].char,
      '--fp-attests',
      '1',
      '--backends',
      'secret-service',
    ],
    { site: 'unreachable' },
  );
  return [
    a.code === 3 && /keys-unreachable/.test(a.stderr) && !gardenJson(W.pot).namespace && b.code !== 0,
    `namespace ${a.code}: ${a.stderr.trim().split('\n')[0].slice(0, 100)}`,
  ];
});

t('identity-halts-when-the-origin-cannot-be-reached', () => {
  const { W } = namespacedWorld();
  const r = run(
    W,
    [
      'identity',
      'ana',
      '--pot',
      W.pot,
      '--pair',
      SET[21].char + SET[70].char,
      '--fp-attests',
      '1',
      '--backends',
      'secret-service',
    ],
    { site: 'unreachable' },
  );
  const locks = exists(path.join(W.pot, 'locked-salts.json'))
    ? JSON.parse(fs.readFileSync(path.join(W.pot, 'locked-salts.json'), 'utf8'))
    : {};
  return [r.code === 3 && /keys-unreachable/.test(r.stderr) && !locks.agents?.ana, `exit ${r.code}`];
});

t('namespace-refuses-what-the-origin-does-not-vouch-for', () => {
  const { W } = drilledWorld();
  const out = {};
  for (const [mode, want] of [
    ['rejected', /rejected/],
    ['forged', /answer-forged/],
    ['unsigned', /answer-unsigned/],
  ]) {
    const r = run(W, ['namespace', '--pot', W.pot, '--backends', 'secret-service'], { site: mode });
    out[mode] =
      r.code === 2 && want.test(r.stderr)
        ? 'refused'
        : `exit ${r.code}: ${r.stderr.trim().split('\n')[0].slice(0, 80)}`;
  }
  return [Object.values(out).every((x) => x === 'refused') && !gardenJson(W.pot).namespace, JSON.stringify(out)];
});

/** The arc up to the seed, with the seed itself left to the case. */
function readyToSeed() {
  const ctx = namespacedWorld();
  const { W } = ctx;
  for (const [slug, [a, b]] of Object.entries({ ana: [21, 70], 'bonsai-shin': [24, 25], kiko: [26, 27] })) {
    const r = run(W, [
      'identity',
      slug,
      '--pot',
      W.pot,
      ...pairArg(slug, a, b),
      '--fp-attests',
      '1',
      '--backends',
      'secret-service',
    ]);
    if (r.code !== 0) throw new Error(`identity ${slug}: ${r.stderr}`);
  }
  for (const slug of [gardenJson(W.pot).name, 'ana', 'bonsai-shin', 'kiko'])
    run(W, ['derive', slug, '--pot', W.pot, '--backends', 'secret-service']);
  fs.writeFileSync(W.siteLog, '');
  return ctx;
}
const seedOf = (W, be, site = 'vouch') =>
  run(W, ['seed', '--pot', W.pot, '--bonsai-entry', be, '--backends', 'secret-service'], { site });
const noRegistry = (W) => !exists(path.join(W.pot, 'agents', 'registry.json'));

t('seed-writes-vouched-from-the-origins-signed-answer', () => {
  const { W } = readyToSeed();
  const r = seedOf(W, bonsaiEntry(W));
  const reg = noRegistry(W)
    ? { agents: [] }
    : JSON.parse(fs.readFileSync(path.join(W.pot, 'agents', 'registry.json'), 'utf8'));
  const b = reg.agents.find((a) => a.slug === 'bonsai') || {};
  const again = seedOf(W, bonsaiEntry(W)); // idempotent: the second run carries the first answer's time
  return [
    r.code === 0 &&
      b.vouched === '2026-10-07T12:00:00.000Z' &&
      b.fingerprint === BONSAI_KEY.fingerprint &&
      again.code === 0 &&
      fs
        .readFileSync(W.siteLog, 'utf8')
        .trim()
        .split('\n')
        .every((l) => l === 'ASK bonsai'),
    `exit ${r.code}, vouched ${b.vouched}, again ${again.code}`,
  ];
});

t('seed-refuses-what-the-origin-does-not-vouch-for', () => {
  const { W } = readyToSeed();
  const out = {};
  for (const [mode, want] of [
    ['rejected', /rejected/],
    ['forged', /answer-forged/],
    ['unsigned', /answer-unsigned/],
    ['no-time', /verified_at/],
  ]) {
    const r = seedOf(W, bonsaiEntry(W), mode);
    out[mode] =
      r.code === 2 && want.test(r.stderr) && noRegistry(W)
        ? 'refused'
        : `exit ${r.code}: ${r.stderr.trim().split('\n')[0].slice(0, 90)}`;
  }
  return [Object.values(out).every((x) => x === 'refused'), JSON.stringify(out)];
});

t('seed-halts-when-the-origin-cannot-be-reached', () => {
  const { W } = readyToSeed();
  const r = seedOf(W, bonsaiEntry(W), 'unreachable');
  return [
    r.code === 3 && /keys-unreachable/.test(r.stderr) && noRegistry(W) && !exists(path.join(W.pot, 'agents', 'bonsai')),
    `exit ${r.code}: ${r.stderr.trim().split('\n')[0].slice(0, 100)}`,
  ];
});

t('seed-refuses-a-self-consistent-entry-with-another-key', () => {
  // spec §13: a file that agrees with itself, by a key that is not the origin's, sealed by that key as "bonsai"
  const { W } = readyToSeed();
  const other = FAKE.throwawaySigner('bonsai');
  const r = seedOf(W, bonsaiEntry(W, { key: other }));
  return [
    r.code === 2 && /rejected/.test(r.stderr) && noRegistry(W) && asked(W) === 1,
    `exit ${r.code}: ${r.stderr.trim().split('\n')[0].slice(0, 100)}`,
  ];
});

t('seed-refuses-an-entry-without-its-seal', () => {
  const { W } = readyToSeed();
  const r = seedOf(W, bonsaiEntry(W, { unsealed: true }));
  return [
    r.code === 2 && /no seal/.test(r.stderr) && noRegistry(W) && asked(W) === 0,
    `exit ${r.code}: ${r.stderr.trim()}`,
  ];
});

t('seed-refuses-an-entry-edited-after-its-seal', () => {
  const { W } = readyToSeed();
  const r = seedOf(W, bonsaiEntry(W, { editAfter: true }));
  return [
    r.code === 2 && /hash-mismatch/.test(r.stderr) && noRegistry(W) && asked(W) === 0,
    `exit ${r.code}: ${r.stderr.trim()}`,
  ];
});

t('seed-refuses-a-seal-that-is-not-bonsais-owner-seal', () => {
  const { W } = readyToSeed();
  const a = seedOf(W, bonsaiEntry(W, { role: 'custodian', name: 'a.json' }));
  const b = seedOf(W, bonsaiEntry(W, { sealer: ORIGIN_KEY, name: 'b.json' })); // sealed, but not by bonsai
  return [
    a.code === 2 &&
      /owner/.test(a.stderr) &&
      b.code === 2 &&
      /bonsai/.test(b.stderr) &&
      noRegistry(W) &&
      asked(W) === 0,
    `custodian ${a.code}: ${a.stderr.trim().slice(0, 80)} | other signer ${b.code}: ${b.stderr.trim().slice(0, 80)}`,
  ];
});

t('seed-refuses-a-seal-on-another-address', () => {
  const { W } = readyToSeed();
  const r = seedOf(W, bonsaiEntry(W, { target: 'agents/elsewhere/bonsai-seed-entry.json' }));
  return [
    r.code === 2 &&
      /agents\/bonsai\/identity\/bonsai-seed-entry\.json/.test(r.stderr) &&
      noRegistry(W) &&
      asked(W) === 0,
    `exit ${r.code}: ${r.stderr.trim().slice(0, 120)}`,
  ];
});

t('seed-refuses-an-entry-whose-seal-names-another-fingerprint', () => {
  // the entry states key K2 (and agrees with itself); the seal is the origin's real Bonsai key K1.
  // The site WOULD vouch for that seal; only the fingerprint check keeps K2 out of the pot.
  const { W } = readyToSeed();
  const other = FAKE.keypair();
  const r = seedOf(W, bonsaiEntry(W, { key: { ...other, slug: 'bonsai' }, sealer: BONSAI_KEY }));
  return [
    r.code === 2 && /fingerprint/.test(r.stderr) && noRegistry(W) && asked(W) === 0,
    `exit ${r.code}: ${r.stderr.trim().slice(0, 120)}`,
  ];
});

// ── run ──────────────────────────────────────────────────────────────────────

if (argv.includes('--list')) {
  for (const [i, c] of cases.entries()) if (inShard(i)) console.log(c.name);
  process.exit(0);
}
let failed = 0,
  ran = 0,
  skipped = 0;
for (const [i, c] of cases.entries()) {
  if (!inShard(i)) continue;
  if (only && !only.includes(c.name)) continue;
  let ok = false,
    why = '';
  try {
    [ok, why] = await c.fn();
  } catch (e) {
    ok = false;
    why = `threw: ${e.message.split('\n')[0]}`;
  }
  if (ok === 'skip') {
    skipped++;
    console.log(`SKIP  ${c.name}  — ${why}`);
    continue;
  }
  ran++;
  console.log(`${ok === true ? 'PASS' : 'FAIL'}  ${c.name}${why ? `  — ${why}` : ''}`);
  if (ok !== true) failed++;
}
console.log(
  `\n${ran - failed}/${ran} passed${skipped ? `, ${skipped} skipped` : ''}${failed ? ` — ${failed} FAILED` : ''}   (scratch: ${SCRATCH})`,
);
process.exit(failed ? 1 : 0);
