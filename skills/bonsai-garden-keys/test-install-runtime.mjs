// ---
// id: 01M4KSMRM4D79A20B07PSV3526
// title: install-runtime, tested by planting each refusal: nothing fetched is trusted before it verifies
// type: script
// tended-by: baisai
// created: 2026-10-10
// updated: 2026-10-22
// ---
//
// test-install-runtime.mjs — rt's spec, §5 and §6. A fixture rt is made in
// scratch (a stub hook, a stub doctor, a README and the manifest, through core's own rt-manifest.mjs), its
// manifest sealed owner by a THROWAWAY key the suite's fake bon-sai.garden holds (test-support.mjs), and
// the scratch core copy's rt-minimum.json names that key and the oldest version it takes. Every source
// kind and refusal is planted against it. No network: a URL source is a file:// URL that does not exist,
// or an https URL answered by the entry's local fetch (RT_TEST_FETCH_DIR); the published keys are the fake
// site (KEYS_TEST_SITE_MODE puts it in a failure mode); the global fetch throws.
//
// Core names no rt by hash or commit (the gardener, 2026-10-18: "we should never refer to a specific
// version of runtime as a dependency me thinks", "maybe a minimumversion, bvut not a fixed version"). Run
// against a core from before that (INSTALL_SRC_CORE; one with no rt-minimum.json), the suite gives that
// core's pin its most generous honest form: `today()` writes that core's pin file naming the very rt a case
// offers, or, where the case is about core naming no hash of a newer rt, the minimum's rt.
//
//   node skills/bonsai-garden-keys/test-install-runtime.mjs
//   INSTALL_SRC_CORE=<a core checkout> node ...   run against another core (to watch the cases fail)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeWorld } from './test-support.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.env.INSTALL_SRC_CORE ? path.resolve(process.env.INSTALL_SRC_CORE) : path.resolve(HERE, '..', '..');
const OWNER = 'rt-owner'; // the key the fixture's minimum names, held by the fake site
const OTHER = 'other-kin'; // a key the fake site holds and the minimum does not name
const W = await makeWorld({ srcCore: SRC, label: 'install-runtime', signers: [OWNER, OTHER] });
const M = await import(pathToFileURL(path.join(HERE, 'lib', 'rt-manifest.mjs')).href); // the format, from this checkout
const U = await import(pathToFileURL(path.join(HERE, '..', 'bonsai-garden-sign', 'lib', 'ulid-rule.mjs')).href); // the seal's id reader
const KEYS = path.join(W.core, 'skills', 'bonsai-garden-keys');
const MIN_FILE = path.join(KEYS, 'rt-minimum.json');
const LEGACY_PIN = path.join(KEYS, 'rt-pin.json');
const LEGACY = !fs.existsSync(MIN_FILE); // a core from before the minimum: it reads a pin
const MARK = path.join(W.dir, 'RAN'); // a fetched file that runs writes here; nothing may
const MIN = '0.1.0';

const setMin = (over = {}) =>
  fs.writeFileSync(
    MIN_FILE,
    `${JSON.stringify(
      { format: 'bonsai-garden-rt-minimum/1', name: 'bonsai-garden-rt', 'min-version': MIN, signers: [OWNER], ...over },
      null,
      2,
    )}\n`,
  );
setMin();

/** A core from before the minimum gets the pin that would let it take the rt at `dir`: today's trust, at its most generous. */
function today(dir) {
  if (!LEGACY) return;
  const buf = fs.readFileSync(path.join(dir, M.MANIFEST));
  const m = JSON.parse(buf);
  const head = fs.existsSync(path.join(dir, '.git'))
    ? W.sh('git', ['-C', dir, 'rev-parse', 'HEAD']).stdout.trim()
    : null;
  fs.writeFileSync(
    LEGACY_PIN,
    `${JSON.stringify(
      {
        format: 'bonsai-garden-rt-pin/1',
        name: m.name,
        version: m.version,
        [M.V1_FROM]: m[M.V1_FROM],
        'rt-commit': head,
        'manifest-sha256': M.sha256(buf),
      },
      null,
      2,
    )}\n`,
  );
}

// ── the fixture rt ───────────────────────────────────────────────────────────
const FILES = {
  'tools/hooks/garden/pre-commit': Buffer.from(`#!/bin/sh\n# fixture hook\nexit 0\n`),
  'tools/rt/doctor.mjs': Buffer.from(
    `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(MARK)}, 'doctor ran');\nconsole.log('fixture doctor');\n`,
  ),
  'README.md': Buffer.from('# fixture rt\n'),
};
const FILES2 = {
  ...FILES,
  'tools/rt/doctor.mjs': Buffer.from(
    `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(MARK)}, 'doctor ran');\nconsole.log('fixture doctor, the next version');\n`,
  ),
};
/** rt at `dir`: the files, the manifest, and its seal (by `seal`: a slug the site holds, a signer object, or null for none). */
async function writeRt(
  dir,
  files = FILES,
  { commit = 'a'.repeat(40), version = MIN, seal = OWNER, target = M.MANIFEST, role = 'owner', extra, v1 = false } = {},
) {
  for (const [rel, b] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), b);
  }
  fs.writeFileSync(
    path.join(dir, M.MANIFEST),
    M.manifestBytes({
      name: 'bonsai-garden-rt',
      version,
      [M.V1_FROM]: { repo: 'rt-source', commit },
      files,
      v1,
    }),
  );
  if (seal) await W.seal(path.join(dir, M.MANIFEST), seal, { target, role, extra });
}
const RT_GIT = path.join(W.dir, 'src', 'rt-git');
fs.mkdirSync(RT_GIT, { recursive: true });
await writeRt(RT_GIT);
W.sh('git', ['init', '-q', RT_GIT]);
W.sh('git', ['-C', RT_GIT, 'add', '-A']);
W.sh('git', ['-C', RT_GIT, 'commit', '-q', '-m', 'rt fixture']);
const RT_HEAD = W.sh('git', ['-C', RT_GIT, 'rev-parse', 'HEAD']).stdout.trim();
const shaOf = (dir) => M.sha256(fs.readFileSync(path.join(dir, M.MANIFEST)));
const GOOD = shaOf(RT_GIT);

/** An unpacked copy of an rt (`opts` as writeRt), with `edit` applied, at a fresh path. */
let srcN = 0;
async function dirSource(edit = () => {}, files = FILES, opts = {}) {
  const d = path.join(W.dir, 'src', `dir${++srcN}`);
  fs.mkdirSync(d, { recursive: true });
  await writeRt(d, files, opts);
  await edit(d);
  return d;
}
const newer = (edit, opts = {}) => dirSource(edit, FILES2, { version: '0.1.1', ...opts });
/** A .tar.gz of a directory source, with one top-level directory as a release tarball has. */
function tgz(dir, name = `rt${++srcN}.tar.gz`) {
  const out = path.join(W.dir, 'src', name);
  const top = path.join(W.dir, 'src', `pack${srcN}`);
  fs.cpSync(dir, path.join(top, 'bonsai-garden-rt-0.1.0'), { recursive: true, verbatimSymlinks: true });
  const r = W.sh('tar', ['-czf', out, '-C', top, 'bonsai-garden-rt-0.1.0']);
  if (r.code !== 0) throw new Error(`tar: ${r.stderr}`);
  return out;
}

let potN = 0;
function fresh() {
  const parent = path.join(W.dir, `garden${++potN}`);
  fs.mkdirSync(parent);
  const pot = path.join(parent, 'pot');
  fs.mkdirSync(pot);
  W.sh('git', ['init', '-q', pot]);
  return { pot, dest: path.join(parent, 'bonsai-garden-rt'), parent };
}
const install = (pot, from, extra = [], env = {}) =>
  W.run(['install-runtime', '--pot', pot, ...(from ? ['--from', from] : []), ...extra], { env });
const cfg = (pot, k) => W.sh('git', ['-C', pot, 'config', '--get', k]).stdout.trim();
const rec = (pot) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(pot, 'runtime.json'), 'utf8'));
  } catch {
    return {};
  }
};
const said = (r) => `${r.stdout}${r.stderr}`;
const last = (r) => said(r).trim().split('\n').slice(-1)[0];
/** Nothing at the destination, no staging left, no record in the pot, no wiring, and nothing fetched ran. */
function untouched({ pot, dest, parent }) {
  const staging = fs.readdirSync(parent).filter((x) => x.includes('.incoming-'));
  return (
    !fs.existsSync(dest) &&
    staging.length === 0 &&
    !fs.existsSync(path.join(pot, 'runtime.json')) &&
    !cfg(pot, 'bonsai.rt') &&
    !cfg(pot, 'core.hooksPath') &&
    !fs.existsSync(MARK) &&
    !fs.existsSync(path.join(pot, '.gitignore'))
  );
}
/** The rt whose manifest is `sha` sits at the destination, intact, recorded and wired, and nothing of it ran. */
function installed({ pot, dest }, sha = GOOD) {
  const hook = path.join(dest, 'tools', 'hooks', 'garden', 'pre-commit');
  return (
    fs.existsSync(dest) &&
    M.verifyTree(dest).ok &&
    shaOf(dest) === sha &&
    rec(pot)['manifest-sha256'] === sha &&
    fs.realpathSync(cfg(pot, 'core.hooksPath')) === fs.realpathSync(path.dirname(hook)) &&
    fs.realpathSync(cfg(pot, 'bonsai.core')) === fs.realpathSync(W.core) &&
    (fs.statSync(hook).mode & 0o111) !== 0 &&
    !fs.existsSync(MARK)
  );
}
const asked = (slug) => W.siteAsked().lines.filter((l) => l === `ASK ${slug}`).length;

const cases = [];
const t = (name, fn) => cases.push({ name, fn });

// ── the minimum, not a pin: the five properties of 2026-10-18 ───────────────────────────────────────────────

t('an-rt-above-the-minimum-installs-though-core-names-no-hash-of-it', async () => {
  setMin();
  today(RT_GIT); // the most a pinning core could name: the minimum's own rt
  const d = await newer();
  const g = fresh();
  const before = asked(OWNER);
  const r = install(g.pot, d);
  const sealedBy = rec(g.pot)['sealed-by'] || {};
  return [
    r.code === 0 &&
      installed(g, shaOf(d)) &&
      rec(g.pot).version === '0.1.1' &&
      sealedBy.signer === OWNER &&
      asked(OWNER) > before,
    `exit ${r.code}: ${last(r)}`,
  ];
});

// the manifest's two shapes (2026-10-21: a shipped file says nothing of where it was made): rt 0.9.1-rc on names no
// commit; an older rt names the one it was made from, and a pot keeps the rt it installed
t('an-rt-whose-manifest-names-no-commit-installs-and-the-pot-records-none', async () => {
  setMin();
  const d = await newer();
  const m = JSON.parse(fs.readFileSync(path.join(d, M.MANIFEST), 'utf8'));
  const g = fresh();
  const r = install(g.pot, d);
  return [
    r.code === 0 &&
      m.format === 'bonsai-garden-rt-manifest/2' &&
      !(M.V1_FROM in m) &&
      installed(g, shaOf(d)) &&
      !(M.V1_FROM in rec(g.pot)),
    `exit ${r.code}, format ${m.format}, record ${JSON.stringify(Object.keys(rec(g.pot)))}: ${last(r)}`,
  ];
});

t('an-older-rt-whose-manifest-names-its-commit-still-installs-and-the-pot-records-it', async () => {
  setMin();
  const d = await newer(undefined, { v1: true });
  const m = JSON.parse(fs.readFileSync(path.join(d, M.MANIFEST), 'utf8'));
  const g = fresh();
  const r = install(g.pot, d);
  return [
    r.code === 0 &&
      m.format === 'bonsai-garden-rt-manifest/1' &&
      installed(g, shaOf(d)) &&
      rec(g.pot)[M.V1_FROM]?.commit === 'a'.repeat(40),
    `exit ${r.code}, format ${m.format}: ${last(r)}`,
  ];
});

t('a-manifest-of-the-new-shape-that-names-a-commit-is-malformed', async () => {
  const buf = M.manifestBytes({ name: 'bonsai-garden-rt', version: '0.1.1', files: FILES });
  const m = JSON.parse(buf);
  const planted = Buffer.from(JSON.stringify({ ...m, [M.V1_FROM]: { repo: 'x', commit: 'a'.repeat(40) } }));
  let said = '';
  try {
    M.parseManifest(planted);
  } catch (e) {
    said = e.message;
  }
  return [/names no commit it was made from/.test(said), said || 'parsed'];
});

t('an-rt-below-the-minimum-is-refused-and-never-run', async () => {
  setMin();
  const d = await dirSource(undefined, FILES, { version: '0.0.9' });
  today(d); // a core that pinned the older rt, as today's pins 0.8.3
  const g = fresh();
  const r = install(g.pot, d);
  return [
    r.code === 2 && /below-minimum/.test(said(r)) && /0\.1\.0/.test(said(r)) && untouched(g),
    `exit ${r.code}: ${last(r)}`,
  ];
});

t('an-rt-whose-manifest-carries-no-seal-is-refused', async () => {
  setMin();
  const d = await newer(undefined, { seal: null });
  today(d);
  const g = fresh();
  const r = install(g.pot, d);
  return [r.code === 2 && /unsealed/.test(said(r)) && untouched(g), `exit ${r.code}: ${last(r)}`];
});

t('an-rt-whose-manifest-is-wrongly-sealed-is-refused', async () => {
  setMin();
  const forger = W.stranger(OWNER); // the right name, a key the published keys do not hold
  const variants = {
    'a key the published keys do not hold': [await newer(undefined, { seal: forger }), /rejected/],
    'a garden key this core does not name': [await newer(undefined, { seal: OTHER }), /not a key this core names/],
    'the manifest changed after its seal': [
      await newer(async (d) => {
        const m = JSON.parse(fs.readFileSync(path.join(d, M.MANIFEST), 'utf8'));
        fs.writeFileSync(
          path.join(d, M.MANIFEST),
          M.manifestBytes({ name: m.name, version: '0.1.2', [M.V1_FROM]: m[M.V1_FROM], files: FILES2 }),
        );
      }),
      /hash-mismatch/,
    ],
    'a seal that names another file': [
      await newer(undefined, { target: 'tools/RT-MANIFEST.json' }),
      /names tools\/RT-MANIFEST\.json/,
    ],
    'a custodian seal': [await newer(undefined, { role: 'custodian' }), /custodian/],
    'an open seal': [
      await newer(undefined, {
        extra: {
          open: {
            reason: 'work in progress',
            closer: OWNER,
            'ruled-by': OWNER,
            'opened-at': '2026-10-18T00:00:00Z',
            expires: '2026-10-19T00:00:00Z',
            'open-hash': 'f'.repeat(128),
          },
        },
      }),
      /open seal/,
    ],
  };
  const out = [];
  for (const [what, [d, why]] of Object.entries(variants)) {
    today(d);
    const g = fresh();
    const r = install(g.pot, d);
    out.push([what, r.code === 2 && why.test(said(r)) && untouched(g), r.code, last(r)]);
  }
  const bad = out.filter((x) => !x[1]);
  return [
    bad.length === 0,
    bad.map((x) => `${x[0]}: exit ${x[2]} (${x[3].slice(0, 110)})`).join(' | ') || `${out.length} refused`,
  ];
});

// Mori-shin's R3 (her read of 2026-10-18): a seal that declares it was made through the software fallback is no release. The
// declaration is the signer's own, so this catches a careless cut, not a thief. A seal declaring another tier is taken.
t('an-rt-whose-manifest-seal-declares-the-software-fallback-is-refused', async () => {
  setMin();
  const soft = await newer(undefined, { extra: { custody: 'software-fallback' } });
  today(soft);
  const g = fresh();
  const r = install(g.pot, soft);
  const os = await newer(undefined, { extra: { custody: 'os-protected' } });
  const h = fresh();
  const r2 = install(h.pot, os);
  return [
    r.code === 2 && /software-fallback/.test(said(r)) && untouched(g) && r2.code === 0 && installed(h, shaOf(os)),
    `software-fallback ${r.code}: ${last(r).slice(0, 120)} | os-protected ${r2.code}`,
  ];
});

// Mori-shin's R6 and her probe P3: an archive that carries a top-level .git/ landed it in rt, and a later `git status` there ran
// its core.fsmonitor. Nothing outside the manifest is installed: the archive is refused, and nothing of it ran.
t('an-archive-carrying-a-git-directory-is-refused-and-nothing-of-it-runs', async () => {
  setMin();
  const withGit = await dirSource(undefined, FILES, {});
  fs.mkdirSync(path.join(withGit, '.git'), { recursive: true });
  fs.writeFileSync(path.join(withGit, '.git', 'config'), `[core]\n\tfsmonitor = touch ${MARK}\n`);
  fs.writeFileSync(path.join(withGit, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  today(withGit);
  const g = fresh();
  const r = install(g.pot, tgz(withGit));
  const landed = fs.existsSync(path.join(g.dest, '.git'));
  if (landed) W.sh('git', ['-C', g.dest, 'status', '--short']); // what a harness or a prompt in rt would run
  const ran = fs.existsSync(MARK);
  const ok = r.code === 2 && /\.git/.test(said(r)) && untouched(g) && !landed;
  fs.rmSync(MARK, { force: true }); // the later cases' "nothing ran" stays theirs
  return [ok, `exit ${r.code}, a .git/ landed in rt ${landed}, ran ${ran}: ${last(r).slice(0, 120)}`];
});

t('an-rt-whose-bytes-differ-from-its-manifest-is-refused-though-sealed-and-above-the-minimum', async () => {
  setMin();
  const before = asked(OWNER);
  const d = await newer((x) => fs.appendFileSync(path.join(x, 'tools', 'rt', 'doctor.mjs'), '// one more line\n'));
  today(d);
  const g = fresh();
  const r = install(g.pot, d);
  return [
    r.code === 2 && /tampered: tools\/rt\/doctor\.mjs/.test(said(r)) && untouched(g) && asked(OWNER) === before,
    `exit ${r.code}, the site asked ${asked(OWNER) - before} time(s): ${last(r)}`,
  ];
});

t('the-published-keys-unreachable-halts-and-installs-nothing', async () => {
  setMin();
  const d = await newer();
  today(d);
  const g = fresh();
  const r = install(g.pot, d, [], { KEYS_TEST_SITE_MODE: 'unreachable' });
  return [r.code === 3 && /keys-unreachable/.test(said(r)) && untouched(g), `exit ${r.code}: ${last(r)}`];
});

t('core-reads-no-fixed-hash-or-commit-of-an-rt', () => {
  // what install-runtime decides by: its own code, the format's library and the file it reads. No 40- or 64-hex value in
  // them, and no read of a pin.
  const keys = path.join(SRC, 'skills', 'bonsai-garden-keys');
  const read = (rel) => (fs.existsSync(path.join(keys, rel)) ? fs.readFileSync(path.join(keys, rel), 'utf8') : '');
  const hex = ['lib/install-runtime.mjs', 'lib/rt-manifest.mjs', 'rt-minimum.json'].filter((f) =>
    /(^|[^0-9a-f])([0-9a-f]{40}|[0-9a-f]{64})([^0-9a-f]|$)/.test(read(f)),
  );
  const pinRead = /rt-pin/.test(read('lib/install-runtime.mjs'));
  const min = read('rt-minimum.json');
  return [
    hex.length === 0 && !pinRead && /"min-version"/.test(min),
    `fixed values in ${hex.join(', ') || 'none'}; install-runtime names rt-pin ${pinRead}; rt-minimum.json ${min ? 'there' : 'missing'}`,
  ];
});

// ── what stage 5 always did ───────────────────────────────────────────────────────────────────────────────

t('no-source-is-usage-and-says-the-address-is-unruled', () => {
  const g = fresh();
  const r = install(g.pot, null);
  return [r.code === 64 && /not ruled/.test(r.stderr) && untouched(g), `exit ${r.code}`];
});

t('installs-from-a-git-path-at-its-head', () => {
  setMin();
  today(RT_GIT);
  const g = fresh();
  const r = install(g.pot, RT_GIT);
  const head = W.sh('git', ['-C', g.dest, 'rev-parse', 'HEAD']).stdout.trim();
  return [
    r.code === 0 && installed(g) && head === RT_HEAD && rec(g.pot)['rt-commit'] === RT_HEAD,
    `exit ${r.code}: ${last(r)}`,
  ];
});

// Bonsai's rehearsal, gap 54: a pot's first commit swept Finder's .DS_Store into the seals. The pot's first .gitignore comes with the install.
const lines = (f) =>
  fs.existsSync(f)
    ? fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .map((x) => x.trim())
    : [];
t('a-first-install-writes-a-gitignore-with-ds-store-and-stays-idempotent', () => {
  setMin();
  const g = fresh();
  const gi = path.join(g.pot, '.gitignore');
  const r = install(g.pot, RT_GIT);
  const first = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  const again = install(g.pot, RT_GIT);
  const second = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  return [
    r.code === 0 &&
      again.code === 0 &&
      lines(gi).includes('.DS_Store') &&
      first === second &&
      lines(gi).filter((x) => x === '.DS_Store').length === 1,
    `exit ${r.code}/${again.code}, .gitignore ${JSON.stringify(first.slice(0, 60))}, unchanged on the second run ${first === second}`,
  ];
});

t('install-names-the-files-it-wrote-and-the-command-that-seals-them', () => {
  // Bonsai's gap 72: runtime.json and .gitignore are written unsealed; the install says so and names them
  setMin();
  const g = fresh();
  const r = install(g.pot, RT_GIT);
  const again = install(g.pot, RT_GIT);
  return [
    r.code === 0 &&
      /seal-staged/.test(r.stdout) &&
      r.stdout.includes('runtime.json') &&
      r.stdout.includes('.gitignore') &&
      again.code === 0 &&
      !/seal-staged/.test(again.stdout),
    `first: ${r.stdout.trim().split('\n').slice(-2).join(' | ').slice(0, 200)}`,
  ];
});

// ── moving on (Bonsai's gap 70): install-runtime never overwrites on its own ─────────────────────────────────
const replacedOf = (g) => fs.readdirSync(g.parent).filter((x) => x.startsWith('bonsai-garden-rt.replaced-'));

t('an-rt-below-a-raised-minimum-is-replaced-only-on-request-and-the-old-one-is-kept', async () => {
  setMin();
  const g = fresh();
  const first = install(g.pot, RT_GIT);
  const d = await newer();
  setMin({ 'min-version': '0.1.1' }); // a core that moved on: the installed rt is below it now
  const plain = install(g.pot, d);
  const stillOld = M.verifyTree(g.dest).ok && shaOf(g.dest) === GOOD;
  const up = install(g.pot, d, ['--upgrade']);
  const kept = replacedOf(g);
  const oldKept = kept.length === 1 && shaOf(path.join(g.parent, kept[0])) === GOOD;
  const again = install(g.pot, d, ['--upgrade']);
  const hooks =
    fs.realpathSync(cfg(g.pot, 'core.hooksPath')) === fs.realpathSync(path.join(g.dest, 'tools', 'hooks', 'garden'));
  setMin();
  return [
    first.code === 0 &&
      plain.code === 2 &&
      /--upgrade/.test(said(plain)) &&
      stillOld &&
      up.code === 0 &&
      installed(g, shaOf(d)) &&
      rec(g.pot).version === '0.1.1' &&
      oldKept &&
      again.code === 0 &&
      replacedOf(g).length === 1 &&
      hooks,
    `first ${first.code}, plain ${plain.code}, old left alone ${stillOld}, upgrade ${up.code}, runtime.json ${rec(g.pot).version}, old kept ${oldKept}, again ${again.code}/${replacedOf(g).length} kept, hooks ${hooks}`,
  ];
});

t('a-pot-moves-to-a-newer-rt-by-its-own-choice-and-never-back', async () => {
  setMin();
  const g = fresh();
  install(g.pot, RT_GIT);
  const d = await newer();
  const plain = install(g.pot, d); // the installed rt still meets the minimum: used as it is, and the way on named
  const stayed = rec(g.pot).version === MIN;
  const up = install(g.pot, d, ['--upgrade']);
  const back = install(g.pot, RT_GIT, ['--upgrade']);
  return [
    plain.code === 0 &&
      /used as it is/.test(plain.stdout) &&
      /--upgrade/.test(plain.stdout) &&
      stayed &&
      up.code === 0 &&
      rec(g.pot).version === '0.1.1' &&
      back.code === 2 &&
      /newer/.test(said(back)) &&
      installed(g, shaOf(d)),
    `plain ${plain.code} (stayed ${stayed}), upgrade ${up.code}, back ${back.code}: ${last(back)}`,
  ];
});

t('a-failed-upgrade-leaves-the-old-rt-wired-and-nothing-moved', async () => {
  setMin();
  const g = fresh();
  install(g.pot, RT_GIT);
  const d = await newer((x) => fs.appendFileSync(path.join(x, 'tools/rt/doctor.mjs'), '// tampered after the seal\n'));
  const up = install(g.pot, d, ['--upgrade']);
  return [
    up.code === 2 &&
      installed(g) &&
      replacedOf(g).length === 0 &&
      fs.readdirSync(g.parent).filter((x) => x.includes('.incoming-')).length === 0 &&
      !fs.existsSync(MARK),
    `exit ${up.code}, old intact ${installed(g)}`,
  ];
});

t('an-upgrade-never-replaces-what-is-not-an-intact-rt-this-pot-installed', async () => {
  setMin();
  const g = fresh();
  install(g.pot, RT_GIT);
  fs.appendFileSync(path.join(g.dest, 'tools/rt/doctor.mjs'), '// hand edit\n');
  const d = await newer();
  const up = install(g.pot, d, ['--upgrade']);
  const handEdit = fs.readFileSync(path.join(g.dest, 'tools/rt/doctor.mjs'), 'utf8').endsWith('// hand edit\n');
  const g2 = fresh();
  fs.mkdirSync(g2.dest);
  fs.writeFileSync(path.join(g2.dest, 'something'), 'not an rt');
  const stranger = install(g2.pot, d, ['--upgrade']);
  return [
    up.code === 2 &&
      handEdit &&
      replacedOf(g).length === 0 &&
      stranger.code === 2 &&
      fs.existsSync(path.join(g2.dest, 'something')) &&
      replacedOf(g2).length === 0,
    `edited ${up.code} (kept ${handEdit}), stranger ${stranger.code}`,
  ];
});

t('an-existing-gitignore-is-kept-and-gets-ds-store-once', () => {
  setMin();
  const g = fresh();
  const gi = path.join(g.pot, '.gitignore');
  fs.writeFileSync(gi, 'node_modules/\nmy-private-notes.md\n');
  const r = install(g.pot, RT_GIT);
  const L = lines(gi);
  return [
    r.code === 0 &&
      L.includes('node_modules/') &&
      L.includes('my-private-notes.md') &&
      L.filter((x) => x === '.DS_Store').length === 1,
    `exit ${r.code}, lines ${JSON.stringify(L.filter(Boolean))}`,
  ];
});

t('installs-from-an-unpacked-copy', async () => {
  setMin();
  const d = await dirSource();
  const g = fresh();
  const r = install(g.pot, d);
  return [r.code === 0 && installed(g) && rec(g.pot)['rt-commit'] === null, `exit ${r.code}: ${last(r)}`];
});

t('installs-from-a-local-archive-and-a-downloaded-one', async () => {
  setMin();
  const a = fresh(),
    b = fresh();
  const file = tgz(await dirSource());
  const r1 = install(a.pot, file);
  const r2 = install(b.pot, `https://rt.example.invalid/releases/${path.basename(file)}`, [], {
    RT_TEST_FETCH_DIR: path.dirname(file),
  });
  const fetched = W.siteAsked().lines.some((l) => l.startsWith('FETCH https://rt.example.invalid/'));
  return [
    r1.code === 0 && installed(a) && r2.code === 0 && installed(b) && fetched && !W.siteAsked().network,
    `local ${r1.code}, download ${r2.code}`,
  ];
});

t('a-missing-source-is-refused', () => {
  const g = fresh();
  const r = install(g.pot, path.join(W.dir, 'no-such-rt'));
  return [r.code === 2 && /does not exist/.test(r.stderr) && untouched(g), `exit ${r.code}`];
});

t('a-tampered-file-is-refused-and-never-run', async () => {
  setMin();
  const tamper = (d) => fs.appendFileSync(path.join(d, 'tools', 'rt', 'doctor.mjs'), '// one more line\n');
  const a = fresh(),
    b = fresh();
  const r1 = install(a.pot, await dirSource(tamper));
  const r2 = install(b.pot, tgz(await dirSource(tamper)));
  return [
    r1.code === 2 &&
      /tampered: tools\/rt\/doctor\.mjs/.test(said(r1)) &&
      untouched(a) &&
      r2.code === 2 &&
      /tampered/.test(said(r2)) &&
      untouched(b),
    `dir ${r1.code}, archive ${r2.code}`,
  ];
});

t('a-source-whose-head-moved-past-its-manifest-is-refused', () => {
  // the source repository moved on: a new commit changes the hook, and its manifest still names the old bytes
  setMin();
  const src = path.join(W.dir, 'src', 'rt-git-moved');
  W.sh('git', ['clone', '-q', RT_GIT, src]);
  fs.appendFileSync(path.join(src, 'tools', 'hooks', 'garden', 'pre-commit'), '# changed\n');
  W.sh('git', ['-C', src, 'commit', '-q', '-am', 'changed hook']);
  const g = fresh();
  const r = install(g.pot, src);
  return [r.code === 2 && /tampered: tools\/hooks\/garden\/pre-commit/.test(said(r)) && untouched(g), `exit ${r.code}`];
});

t('no-minimum-in-core-is-refused', () => {
  fs.rmSync(MIN_FILE);
  const g = fresh();
  const r = install(g.pot, RT_GIT);
  setMin();
  return [r.code === 2 && /no usable rt minimum/.test(r.stderr) && untouched(g), `exit ${r.code}: ${last(r)}`];
});

t('an-unlisted-file-is-refused', async () => {
  setMin();
  const g = fresh();
  const r = install(
    g.pot,
    await dirSource((d) =>
      fs.writeFileSync(path.join(d, 'tools', 'hooks', 'garden', 'post-checkout'), `#!/bin/sh\ntouch ${MARK}\n`, {
        mode: 0o755,
      }),
    ),
  );
  return [
    r.code === 2 && /unlisted: tools\/hooks\/garden\/post-checkout/.test(said(r)) && untouched(g),
    `exit ${r.code}`,
  ];
});

t('a-symlink-is-refused', async () => {
  setMin();
  const g = fresh();
  const r = install(g.pot, await dirSource((d) => fs.symlinkSync('/etc/hosts', path.join(d, 'tools', 'rt', 'hosts'))));
  return [r.code === 2 && /link: tools\/rt\/hosts/.test(said(r)) && untouched(g), `exit ${r.code}`];
});

t('an-archive-reaching-outside-itself-is-refused', () => {
  setMin();
  const g = fresh();
  const top = path.join(W.dir, 'src', 'evil');
  fs.mkdirSync(path.join(top, 'a'), { recursive: true });
  fs.writeFileSync(path.join(top, 'x.txt'), 'x');
  const out = path.join(W.dir, 'src', 'evil.tar.gz');
  W.sh('tar', ['-czf', out, '-C', path.join(top, 'a'), '../x.txt']);
  const r = install(g.pot, out);
  return [r.code === 2 && /outside itself/.test(r.stderr) && untouched(g), `exit ${r.code}: ${r.stderr.trim()}`];
});

t('offline-halts-and-says-stage-5', () => {
  setMin();
  const a = fresh(),
    b = fresh();
  const r1 = install(a.pot, 'https://rt.example.invalid/rt.tar.gz', [], {
    RT_TEST_FETCH_DIR: W.dir,
    RT_TEST_FETCH_MODE: 'offline',
  });
  const r2 = install(b.pot, 'file:///nonexistent/bonsai-garden-rt.git');
  return [
    r1.code === 3 &&
      /stage 5/.test(r1.stderr) &&
      untouched(a) &&
      r2.code === 3 &&
      /stage 5/.test(r2.stderr) &&
      untouched(b) &&
      !W.siteAsked().network,
    `download ${r1.code}, clone ${r2.code}`,
  ];
});

t('an-existing-destination-is-used-only-when-it-is-an-rt-this-core-accepts', () => {
  setMin();
  const g = fresh();
  const r1 = install(g.pot, RT_GIT);
  const again = install(g.pot, RT_GIT); // the same rt: used as it is
  const h = fresh();
  fs.mkdirSync(h.dest);
  fs.writeFileSync(path.join(h.dest, 'something.txt'), "someone else's\n");
  const r2 = install(h.pot, RT_GIT);
  const kept = fs.readFileSync(path.join(h.dest, 'something.txt'), 'utf8') === "someone else's\n";
  return [
    r1.code === 0 &&
      again.code === 0 &&
      /used as it is/.test(again.stdout) &&
      r2.code === 2 &&
      /never overwrites/.test(r2.stderr) &&
      kept &&
      !cfg(h.pot, 'bonsai.rt'),
    `first ${r1.code}, again ${again.code}, occupied ${r2.code}`,
  ];
});

t('another-commit-gate-is-not-taken-over', () => {
  setMin();
  const g = fresh();
  W.sh('git', ['-C', g.pot, 'config', 'core.hooksPath', path.join(W.dir, 'someone-elses-hooks')]);
  const r = install(g.pot, RT_GIT);
  return [
    r.code === 2 &&
      /does not take over another commit gate/.test(r.stderr) &&
      !fs.existsSync(g.dest) &&
      cfg(g.pot, 'core.hooksPath') === path.join(W.dir, 'someone-elses-hooks'),
    `exit ${r.code}`,
  ];
});

t('a-pot-that-is-not-a-repository-is-refused', () => {
  const parent = path.join(W.dir, 'not-a-garden');
  fs.mkdirSync(path.join(parent, 'pot'), { recursive: true });
  const r = install(path.join(parent, 'pot'), RT_GIT);
  return [r.code === 2 && !fs.existsSync(path.join(parent, 'bonsai-garden-rt')), `exit ${r.code}`];
});

// ── the garden MCP (phase 4): an rt that carries the server wires the pot to it ───────────────────────────────────────────
const RT_MCP = path.join(W.dir, 'src', 'rt-mcp');
fs.mkdirSync(RT_MCP, { recursive: true });
await writeRt(RT_MCP, {
  ...FILES,
  'tools/bonsai-mcp/server.py': Buffer.from('# fixture server\n'),
  'tools/bonsai-mcp/pyproject.toml': Buffer.from('[project]\nname = "x"\n'),
  'tools/rt/host-service.mjs': Buffer.from('// fixture host service\n'),
});
const MCP_SHA = shaOf(RT_MCP);
// an older rt: the server, and no host service beside it
const RT_MCP_OLD = path.join(W.dir, 'src', 'rt-mcp-old');
fs.mkdirSync(RT_MCP_OLD, { recursive: true });
await writeRt(RT_MCP_OLD, {
  ...FILES,
  'tools/bonsai-mcp/server.py': Buffer.from('# fixture server\n'),
  'tools/bonsai-mcp/pyproject.toml': Buffer.from('[project]\nname = "x"\n'),
});
const FAKE_UV = path.join(W.dir, 'bin', 'uv');
fs.mkdirSync(path.dirname(FAKE_UV), { recursive: true });
fs.writeFileSync(FAKE_UV, '#!/bin/sh\nexit 0\n');
fs.chmodSync(FAKE_UV, 0o755);
const mcpOf = (pot) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(pot, '.mcp.json'), 'utf8'));
  } catch {
    return null;
  }
};
const ignored = (pot) => {
  try {
    return fs.readFileSync(path.join(pot, '.gitignore'), 'utf8').split('\n');
  } catch {
    return [];
  }
};

// The gardener, 2026-10-19: "no terminal is not a fix or a workaround. we need to be able to register a stable garden mcp!"
// A per-session .mcp.json server is dropped by the desktop app after one turn (W's F-10); the garden MCP is a host service,
// registered once at user level by rt's host-service.mjs. install-runtime writes no .mcp.json and names that step.
t('an-rt-with-the-server-writes-no-mcp-json-and-names-the-host-service-step', () => {
  setMin();
  const g = fresh();
  const r = install(g.pot, RT_MCP, [], { BONSAI_UV: FAKE_UV });
  const hs = path.join(g.dest, 'tools', 'rt', 'host-service.mjs');
  const ok =
    r.code === 0 &&
    !mcpOf(g.pot) &&
    r.stdout.includes(`node ${hs} install --pot ${g.pot}`) &&
    /registered once at user level/.test(r.stdout) &&
    ignored(g.pot).includes('.mcp.json') &&
    M.verifyTree(g.dest).ok &&
    shaOf(g.dest) === MCP_SHA;
  return [ok, `exit ${r.code}; .mcp.json ${JSON.stringify(mcpOf(g.pot)).slice(0, 120)}`];
});

t('an-rt-with-the-server-and-no-host-service-says-it-cannot-be-installed-from-it', () => {
  setMin();
  const g = fresh();
  const r = install(g.pot, RT_MCP_OLD, [], { BONSAI_UV: FAKE_UV });
  return [
    r.code === 0 && !mcpOf(g.pot) && /no tools\/rt\/host-service\.mjs/.test(r.stdout) && /--upgrade/.test(r.stdout),
    `exit ${r.code}`,
  ];
});

t('the-first-contract-is-written-once-and-named-unsealed-and-an-existing-one-is-never-overwritten', () => {
  setMin();
  const g = fresh();
  fs.writeFileSync(path.join(g.pot, 'CLAUDE.md'), 'mine\n');
  const r = install(g.pot, RT_MCP, [], { BONSAI_UV: FAKE_UV });
  const agents = fs.existsSync(path.join(g.pot, 'AGENTS.md'))
    ? fs.readFileSync(path.join(g.pot, 'AGENTS.md'), 'utf8')
    : '';
  const ok =
    r.code === 0 &&
    /host-service\.mjs install/.test(agents) &&
    /registered once, at user level/.test(agents) &&
    !new RegExp(`${['bonsai', 'garden', 'runtime'].join('-')}|\\.mcp\\.json`).test(agents) && // the name built from its parts: this file names no repository
    !/__SERVER__/.test(agents) &&
    fs.readFileSync(path.join(g.pot, 'CLAUDE.md'), 'utf8') === 'mine\n' &&
    /unsealed: .*AGENTS\.md/.test(r.stdout) &&
    !/unsealed: .*CLAUDE\.md/.test(r.stdout);
  return [ok, `exit ${r.code}`];
});

// F-16 (kobun dry run, 2026-10-14): the first contract was written with no id header, and the pot's first seal-staged refused it.
// The property is the seal's own: ownId, the reader seal-staged uses, finds one well-formed id in each, and the two differ.
t('the-first-contract-carries-a-minted-id-the-seal-accepts-and-names-the-gardener', () => {
  setMin();
  const g = fresh();
  fs.writeFileSync(path.join(g.pot, 'garden.json'), `${JSON.stringify({ gardener: 'fixture-gardener' })}\n`);
  const r = install(g.pot, RT_MCP, [], { BONSAI_UV: FAKE_UV });
  const read = (n) => {
    try {
      return fs.readFileSync(path.join(g.pot, n));
    } catch {
      return Buffer.alloc(0);
    }
  };
  const a = U.ownId(read('AGENTS.md'), 'AGENTS.md'),
    c = U.ownId(read('CLAUDE.md'), 'CLAUDE.md');
  const text = read('CLAUDE.md').toString();
  const ok =
    r.code === 0 &&
    a.carrier &&
    a.problem === null &&
    c.carrier &&
    c.problem === null &&
    a.id !== c.id &&
    /^tended-by: fixture-gardener$/m.test(read('AGENTS.md').toString()) &&
    /\n@AGENTS\.md\n/.test(text) &&
    !/__SERVER__/.test(read('AGENTS.md').toString());
  return [ok, `exit ${r.code}; AGENTS ${a.problem || a.id}; CLAUDE ${c.problem || c.id}`];
});

// N-1 (kobun dry run): the garden MCP's own state, .bonsai/write-log.jsonl, sat untracked and committable. Asked of git, not of the file.
t('the-mcps-own-state-is-ignored-by-git', () => {
  setMin();
  const g = fresh();
  const r = install(g.pot, RT_MCP, [], { BONSAI_UV: FAKE_UV });
  const ci = W.sh('git', ['-C', g.pot, 'check-ignore', '-q', '.bonsai/write-log.jsonl']);
  return [r.code === 0 && ci.code === 0, `exit ${r.code}; check-ignore ${ci.code}`];
});

t('a-pots-own-mcp-json-is-left-as-it-is', () => {
  setMin();
  const g = fresh();
  const mine = JSON.stringify({ mcpServers: { theirs: { command: 'x' } } });
  fs.writeFileSync(path.join(g.pot, '.mcp.json'), mine);
  const r = install(g.pot, RT_MCP, [], { BONSAI_UV: FAKE_UV });
  const now = fs.readFileSync(path.join(g.pot, '.mcp.json'), 'utf8');
  return [r.code === 0 && now === mine, `exit ${r.code}; ${now.slice(0, 120)}`];
});

t('no-uv-writes-no-mcp-json-says-so-and-the-install-still-holds', () => {
  setMin();
  const g = fresh();
  const r = install(g.pot, RT_MCP, [], { BONSAI_UV: path.join(W.dir, 'no-such-uv') });
  return [
    r.code === 0 &&
      !mcpOf(g.pot) &&
      /no uv on this host/.test(r.stdout) &&
      !fs.existsSync(path.join(g.pot, 'AGENTS.md')) &&
      !!cfg(g.pot, 'bonsai.rt'),
    `exit ${r.code}`,
  ];
});

t('an-rt-without-the-server-writes-no-mcp-json-and-no-contract', () => {
  setMin();
  const g = fresh();
  const r = install(g.pot, RT_GIT, [], { BONSAI_UV: FAKE_UV });
  return [
    r.code === 0 &&
      !mcpOf(g.pot) &&
      !fs.existsSync(path.join(g.pot, 'AGENTS.md')) &&
      !ignored(g.pot).includes('.mcp.json'),
    `exit ${r.code}`,
  ];
});

let failed = 0;
for (const c of cases) {
  let ok = false,
    why = '';
  try {
    [ok, why] = await c.fn();
  } catch (e) {
    why = `threw: ${String(e.message).split('\n')[0]}`;
  }
  console.log(`${ok === true ? 'PASS' : 'FAIL'}  ${c.name}${why ? `  — ${why}` : ''}`);
  if (ok !== true) failed++;
}
console.log(
  `\n${cases.length - failed}/${cases.length} passed${failed ? ` — ${failed} FAILED` : ''}   (scratch: ${W.dir})`,
);
process.exit(failed ? 1 : 0);
