// ---
// id: 01M4KRPW3TZ1G3BR1WDHRDBKQJ
// title: seal-staged, tested by planting each refusal: a new pot seals and verifies its commits without the origin's garden
// type: script
// tended-by: baisai
// created: 2026-10-10
// updated: 2026-10-10
// ---
//
// test-seal-staged.mjs — rt's spec §7 and the P2 minimum of the move into core: in a pot the keys arc seeded, `keys.mjs seal-staged` seals named staged files with the
// key this garden's own salt derives, and `seal-staged --check` refuses what does not verify. Every run
// is in a scratch world (test-support.mjs) with BONSAI_GARDEN pointing at nothing and no origin garden beside
// the core copy: a reach for the origin's tools fails loudly. Throwaway salts only.
//
//   node skills/bonsai-garden-keys/test-seal-staged.mjs            every case
//   node skills/bonsai-garden-keys/test-seal-staged.mjs --list
//   SEAL_STAGED_SRC_CORE=<a core checkout> node ...                run the cases against another core
//                                                                  (to watch them fail on one without the verb)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWorld, PASS, pp, UNREACHABLE } from './test-support.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.env.SEAL_STAGED_SRC_CORE
  ? path.resolve(process.env.SEAL_STAGED_SRC_CORE)
  : path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);

const W = await makeWorld({ srcCore: SRC, policy: 'refuse', label: 'seal-staged' });
const SEEDED = W.newPot('seeded');
let seedErr = null;
try {
  await W.seedPot(SEEDED, { attest: true });
} catch (e) {
  seedErr = e.message;
}

let potN = 0;
/** A fresh copy of the seeded pot (the same garden, the same custody under the world's HOME). */
function pot() {
  const p = path.join(W.dir, `pot${++potN}`);
  fs.cpSync(SEEDED, p, { recursive: true });
  return p;
}
const git = (p, ...a) => W.sh('git', ['-C', p, ...a]);
const seal = (p, as, paths, extra = []) =>
  W.run(['seal-staged', '--pot', p, '--as', as, ...W.B, ...extra, '--', ...paths], { input: pp(PASS) });
const check = (p) => W.run(['seal-staged', '--check', '--pot', p]);
const ALL = (p) =>
  git(p, 'ls-files', '--others', '--exclude-standard')
    .stdout.split('\n')
    .filter(Boolean)
    .filter((x) => !x.endsWith('.bonsaisig'));
/** Stage the whole arc's output and seal what the arc left unsealed (the key files), as the gardener. */
function sealArc(p) {
  git(p, 'add', '-A');
  const unsealed = git(p, 'diff', '--cached', '--name-only')
    .stdout.split('\n')
    .filter((x) => x && !x.endsWith('.bonsaisig'))
    .filter((x) => !fs.existsSync(path.join(p, path.dirname(x), `.${path.basename(x)}.bonsaisig`)));
  return { r: seal(p, 'ana', unsealed), unsealed };
}

const cases = [];
const t = (name, fn) => cases.push({ name, fn });

t('the-world-seeds-without-the-origin', () => [
  seedErr === null && !W.siteAsked().network,
  seedErr || 'the arc ran with BONSAI_GARDEN unreachable and no origin garden beside core',
]);

t('seal-then-check-passes-under-warn', () => {
  const p = pot();
  const { r, unsealed } = sealArc(p);
  W.setPolicy('warn');
  const c = check(p);
  W.setPolicy('refuse');
  const commit = git(p, 'commit', '-q', '-m', 'the arc');
  return [
    r.code === 0 && unsealed.length > 0 && c.code === 0 && commit.code === 0,
    `seal ${r.code} (${unsealed.length} files), check ${c.code}: ${c.stdout.trim().split('\n').pop()}, commit ${commit.code}`,
  ];
});

// Bonsai's rehearsal, gap 69 (2026-10-11): the pot's own commit gate honours the pot's own lab-preview switch, for that
// root only. Core's seal-policy.json stays "refuse"; the pot that minted with --lab-preview says so in its garden.json.
t('a-lab-preview-pot-passes-its-own-gate-under-the-default-policy-and-says-so', () => {
  const p = pot();
  sealArc(p);
  const lab = JSON.parse(fs.readFileSync(path.join(p, 'garden.json'), 'utf8'))['lab-preview'] === true;
  const c = check(p);
  const commit = git(p, 'commit', '-q', '-m', 'the first commit');
  return [
    lab &&
      c.code === 0 &&
      /lab-preview: custody software-fallback accepted/.test(c.stdout) &&
      !/seal-policy\.json says refuse/.test(c.stdout) &&
      commit.code === 0 &&
      JSON.parse(fs.readFileSync(W.polFile, 'utf8'))['custody-fallback'] === 'refuse',
    `lab ${lab}, check ${c.code}: ${c.stdout.trim().split('\n').slice(-2).join(' | ').slice(0, 160)}, commit ${commit.code}`,
  ];
});

t('a-pot-that-is-not-lab-preview-stays-custody-refused-and-names-the-way-out', () => {
  const p = pot();
  sealArc(p);
  const gj = path.join(p, 'garden.json');
  const g = JSON.parse(fs.readFileSync(gj, 'utf8'));
  g['lab-preview'] = false;
  fs.writeFileSync(gj, `${JSON.stringify(g, null, 2)}\n`);
  const c = check(p);
  return [
    c.code === 1 && /custody-refused/.test(c.stdout) && /lab-preview/.test(c.stdout) && !/by hand/.test(c.stdout),
    `check ${c.code}: ${c.stdout.trim().split('\n').pop().slice(0, 140)}`,
  ];
});

t('keys-verify-honours-the-pots-own-lab-preview-switch-and-says-so', () => {
  // Bonsai's item 2: `keys verify` had no per-pot switch; its only way out was a hand edit of core's machine-wide policy
  const p = pot();
  sealArc(p);
  const f = path.join(p, 'agents', 'ana', 'identity', 'ana-public-key.bin'); // a file ana's software-fallback seal covers
  const v = () => W.run(['verify', '--keys', 'pot', '--pot', p, '--file', f]);
  const lab = v();
  const gj = path.join(p, 'garden.json');
  const g = JSON.parse(fs.readFileSync(gj, 'utf8'));
  g['lab-preview'] = false; // only the switch differs; the file verified is untouched
  fs.writeFileSync(gj, `${JSON.stringify(g, null, 2)}\n`);
  const notLab = v();
  return [
    lab.code === 0 &&
      /lab-preview: custody software-fallback accepted/.test(lab.stdout) &&
      notLab.code === 1 &&
      /custody-refused/.test(notLab.stderr) &&
      !/by hand/.test(notLab.stderr),
    `lab ${lab.code}: ${lab.stdout.trim().split('\n').pop().slice(0, 90)} | not lab ${notLab.code}: ${notLab.stderr.trim().split('\n')[0].slice(0, 80)}`,
  ];
});

t('a-tampered-file-fails-the-check', () => {
  const p = pot();
  sealArc(p);
  fs.appendFileSync(path.join(p, 'garden.json'), ' ');
  git(p, 'add', 'garden.json');
  W.setPolicy('warn');
  const c = check(p);
  W.setPolicy('refuse');
  return [
    c.code === 1 && /garden\.json: its seal reads hash-mismatch/.test(c.stdout),
    `check ${c.code}: ${c.stdout.trim().split('\n')[0]}`,
  ];
});

t('a-file-staged-without-a-seal-fails-the-check', () => {
  const p = pot();
  sealArc(p);
  fs.writeFileSync(path.join(p, 'notes.txt'), 'a new file nobody sealed\n');
  git(p, 'add', 'notes.txt');
  W.setPolicy('warn');
  const c = check(p);
  W.setPolicy('refuse');
  return [c.code === 1 && /notes\.txt: its seal reads no-sidecar/.test(c.stdout), `check ${c.code}`];
});

t('a-seal-by-a-key-this-pot-does-not-list-fails', () => {
  // a seal from another garden (a second seeded pot's garden.json), planted with its sidecar
  const p = pot();
  sealArc(p);
  const other = W.newPot('other-garden');
  return W.seedPot(other, { name: 'osaka', gardener: 'ren', shin: 'mio', attest: false }).then(() => {
    fs.copyFileSync(path.join(other, 'garden.json'), path.join(p, 'garden.json'));
    fs.copyFileSync(path.join(other, '.garden.json.bonsaisig'), path.join(p, '.garden.json.bonsaisig'));
    git(p, 'add', 'garden.json', '.garden.json.bonsaisig');
    W.setPolicy('warn');
    const c = check(p);
    W.setPolicy('refuse');
    return [
      c.code === 1 && /garden\.json: its seal reads (unknown-signer|bad-signature)/.test(c.stdout),
      `check ${c.code}: ${c.stdout.trim().split('\n')[0]}`,
    ];
  });
});

t('an-owner-seal-against-the-credit-fails', async () => {
  const p = pot();
  sealArc(p);
  const rel = 'kiko-notes.md',
    abs = path.join(p, rel);
  const { newUlid } = await import(path.join(W.core, 'skills', 'bonsai-garden-sign', 'lib', 'ulid-rule.mjs'));
  fs.writeFileSync(abs, `---\nid: ${newUlid()}\ntitle: notes\ntended-by: kiko\n---\n\nkiko's page\n`);
  git(p, 'add', rel);
  const r = seal(p, 'ana', [rel]);
  const side = path.join(p, `.${rel}.bonsaisig`);
  const role = JSON.parse(fs.readFileSync(side, 'utf8')).role; // the rule: ana edits kiko's page, custodian
  W.setPolicy('warn');
  const fine = check(p);
  // plant what the rule never writes: an owner seal by ana that HOLDS over a page crediting kiko.
  // Only the throwaway salt of this world can make one; it is read here, in memory, and never written.
  const { backends } = await import(path.join(W.core, 'skills', 'bonsai-garden-keys', 'lib', 'custody.mjs'));
  const G = await import(path.join(W.core, 'skills', 'bonsai-garden-keys', 'lib', 'garden.mjs'));
  const g = JSON.parse(fs.readFileSync(path.join(p, 'garden.json'), 'utf8'));
  const file = backends({ home: W.home, passphrase: { ask: async () => PASS, askNew: async () => PASS } }).file;
  const hex = await file.get(g.garden);
  G.sealWith(hex, G.readLocks(p).agents.ana.signing_salt, 'ana', abs, { custody: 'software-fallback', role: 'owner' });
  git(p, 'add', `.${rel}.bonsaisig`);
  const c = check(p);
  W.setPolicy('refuse');
  return [
    r.code === 0 &&
      role === 'custodian' &&
      fine.code === 0 &&
      c.code === 1 &&
      /kiko-notes\.md: an owner seal by ana, but the file credits kiko/.test(c.stdout),
    `rule gave ${role}, check ${fine.code}; planted owner seal: check ${c.code}`,
  ];
});

t('only-named-staged-fully-staged-paths', () => {
  const p = pot();
  const a = seal(p, 'ana', []); // no paths
  fs.writeFileSync(path.join(p, 'unstaged.txt'), 'x\n');
  const b = seal(p, 'ana', ['unstaged.txt']); // not staged
  fs.writeFileSync(path.join(p, 'half.txt'), 'one\n');
  git(p, 'add', 'half.txt');
  fs.writeFileSync(path.join(p, 'half.txt'), 'two\n');
  const c = seal(p, 'ana', ['half.txt']); // working tree differs
  const d = seal(p, 'ana', ['../outside.txt']);
  fs.writeFileSync(path.join(p, 'no-id.md'), '---\ntitle: a page with no id\n---\n\nx\n');
  git(p, 'add', 'no-id.md');
  const e = seal(p, 'ana', ['no-id.md']); // core's id rule, asked before any write
  const none =
    !fs.existsSync(path.join(p, '.half.txt.bonsaisig')) &&
    !fs.existsSync(path.join(p, '.unstaged.txt.bonsaisig')) &&
    !fs.existsSync(path.join(p, '.no-id.md.bonsaisig'));
  return [
    a.code === 2 &&
      b.code === 2 &&
      c.code === 2 &&
      d.code === 2 &&
      e.code === 2 &&
      /no-id\.md: cannot be sealed/.test(e.stdout) &&
      none,
    `exits ${a.code},${b.code},${c.code},${d.code},${e.code}`,
  ];
});

t('only-a-key-the-pot-lists-and-never-the-origins', () => {
  const p = pot();
  fs.writeFileSync(path.join(p, 'x.txt'), 'x\n');
  git(p, 'add', 'x.txt');
  const a = seal(p, 'stranger', ['x.txt']);
  const b = seal(p, 'bonsai', ['x.txt']);
  return [
    a.code === 2 &&
      /not in this pot's registry/.test(a.stderr) &&
      b.code === 2 &&
      /origin's/.test(b.stderr) &&
      !fs.existsSync(path.join(p, '.x.txt.bonsaisig')),
    `exits ${a.code},${b.code}`,
  ];
});

t('no-registry-no-seal', () => {
  const p = W.newPot('bare');
  fs.writeFileSync(path.join(p, 'x.txt'), 'x\n');
  W.sh('git', ['-C', p, 'add', 'x.txt']);
  const a = check(p);
  const b = seal(p, 'ana', ['x.txt']);
  return [a.code === 2 && b.code === 2 && /no agents\/registry\.json/.test(a.stderr), `exits ${a.code},${b.code}`];
});

t('the-seal-is-this-gardens-and-names-its-tier-and-a-lab-pot-accepts-it-under-refuse', () => {
  const p = pot();
  sealArc(p);
  const side = JSON.parse(
    fs.readFileSync(path.join(p, 'agents', 'ana', 'identity', '.ana-public-key.bin.bonsaisig'), 'utf8'),
  );
  const reg = JSON.parse(fs.readFileSync(path.join(p, 'agents', 'registry.json'), 'utf8'));
  const ana = reg.agents.find((a) => a.slug === 'ana');
  const v = W.run([
    'verify',
    '--keys',
    'pot',
    '--pot',
    p,
    '--file',
    path.join(p, 'agents', 'ana', 'identity', 'ana-public-key.bin'),
  ]);
  return [
    side.signer === 'ana' &&
      side.fingerprint === ana.fingerprint &&
      side.custody === 'software-fallback' &&
      side.role === 'owner' &&
      v.code === 0 &&
      /lab-preview: custody software-fallback accepted/.test(v.stdout),
    `signer ${side.signer}, custody ${side.custody}, verify in this lab pot under core's refuse ${v.code}`,
  ];
});

t('an-identity-file-of-another-entity-is-held-as-custodian-and-ones-own-as-owner', () => {
  // Bonsai's gap 73: seal-staged sealed the origin's key in the pot as owner: <root>, where custodian fits. A file under
  // agents/<x>/identity/ is <x>'s; whoever else seals it (the gardener's act, or the root's) holds it, never owns it.
  const p = pot();
  sealArc(p);
  const roleOf = (slug, file) => {
    const f = path.join(p, 'agents', slug, 'identity', `.${file}.bonsaisig`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  };
  const own = roleOf('ana', 'ana-public-key.bin'),
    others = ['bonsai-shin', 'bonsai'].map((x) => roleOf(x, `${x}-public-key.bin`)).filter(Boolean);
  return [
    own &&
      own.signer === 'ana' &&
      own.role === 'owner' &&
      others.length >= 1 &&
      others.every((o) => o.role === 'custodian'),
    `ana's own: ${own?.role}; others: ${others.map((o) => `${o.signer}/${o.role}`).join(', ')}`,
  ];
});

t('the-run-says-why-a-role-was-chosen-and-for-a-skill-md-names-the-identity-document', () => {
  // Mori-shin, 2026-10-11 (a pot body's SKILL.md): a seal has no default role; a lean SKILL.md credits what its identity document
  // credits, so with none it credits no one. The run must say WHY next to the role, not leave a custodian unexplained.
  const p = pot();
  sealArc(p);
  git(p, 'commit', '-q', '-m', 'the arc', '--no-verify');
  const skill = path.join(p, 'agents', 'ana', 'SKILL.md');
  fs.writeFileSync(
    skill,
    '---\nname: ana\ndescription: x\nversion: 1.0.0\n---\n> **Integrity first.** run the check.\n',
  );
  git(p, 'add', '--', 'agents/ana/SKILL.md');
  const first = seal(p, 'ana', ['agents/ana/SKILL.md']);
  git(p, 'commit', '-q', '-m', 'skill', '--no-verify');
  fs.appendFileSync(skill, '\nmore\n');
  git(p, 'add', '--', 'agents/ana/SKILL.md');
  const again = seal(p, 'ana', ['agents/ana/SKILL.md']);
  const L = (r) => r.stdout.split('\n').find((l) => l.includes('agents/ana/SKILL.md') && /sealed/.test(l)) || '';
  return [
    first.code === 0 &&
      again.code === 0 &&
      /owner: ana/.test(L(first)) &&
      /created/.test(L(first)) &&
      /custodian: ana/.test(L(again)) &&
      /identity document/.test(L(again)) &&
      /references\/identity\.md/.test(L(again)),
    `first: ${L(first).trim().slice(0, 150)} | again: ${L(again).trim().slice(0, 200)}`,
  ];
});

// F-17, the kobun dry run (2026-10-14): stage the files BY NAME, never the sidecars, as a walk script does. A seal the run
// keeps must go into the index with its file, and the gate must refuse a staged file whose seal is not staged.
function stageByName(p) {
  const files = ALL(p);
  git(p, 'add', '--', ...files);
  return files;
}
t('a-kept-seal-is-staged-with-its-file', () => {
  const p = pot();
  const files = stageByName(p);
  const sealedAlready = files.filter((x) =>
    fs.existsSync(path.join(p, path.dirname(x), `.${path.basename(x)}.bonsaisig`)),
  );
  const r = seal(p, 'ana', sealedAlready);
  const unstagedSeals = sealedAlready
    .map((x) => path.join(path.dirname(x), `.${path.basename(x)}.bonsaisig`).replace(/^\.\//, ''))
    .filter((sc) => git(p, 'ls-files', '--error-unmatch', '--', sc).code !== 0);
  return [
    r.code === 0 && sealedAlready.length > 0 && /kept/.test(r.stdout) && unstagedSeals.length === 0,
    `seal ${r.code}, ${sealedAlready.length} kept, still unstaged: ${unstagedSeals.join(', ') || 'none'}`,
  ];
});
t('the-check-refuses-a-staged-file-whose-seal-is-not-staged', () => {
  const p = pot();
  stageByName(p); // files only: every seal the arc wrote stays untracked
  W.setPolicy('warn');
  const c = check(p);
  W.setPolicy('refuse');
  return [
    c.code === 1 && /its seal \S+\.bonsaisig is not staged/.test(c.stdout),
    `check ${c.code}: ${c.stdout.trim().split('\n').slice(-2).join(' | ')}`,
  ];
});

t('nothing-reached-for-mono-or-the-network', () => {
  const touched = W.log.filter((o) => (o.stdout + o.stderr).includes(UNREACHABLE));
  return [
    !W.siteAsked().network && touched.length === 0,
    `network ${W.siteAsked().network}, mentions of the unreachable root ${touched.length}`,
  ];
});

if (argv.includes('--list')) {
  for (const c of cases) console.log(c.name);
  process.exit(0);
}
let failed = 0,
  ran = 0,
  skipped = 0;
for (const c of cases) {
  let ok = false,
    why = '';
  try {
    [ok, why] = await c.fn();
  } catch (e) {
    ok = false;
    why = `threw: ${String(e.message).split('\n')[0]}`;
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
  `\n${ran - failed}/${ran} passed${skipped ? `, ${skipped} skipped` : ''}${failed ? ` — ${failed} FAILED` : ''}   (scratch: ${W.dir})`,
);
process.exit(failed ? 1 : 0);
