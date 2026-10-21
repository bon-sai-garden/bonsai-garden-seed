// ---
// id: 01M4Z51Q3E88V1YC40G6BT0P34
// title: the planting's new verbs end to end, through the real binary: homes at seed, stage 4, and the pot's own commit gate
// type: script
// tended-by: baisai
// created: 2026-10-15
// updated: 2026-10-20
// ---
//
// test-planting-e2e.mjs — the verbs wired on 2026-10-15 (covenant write, certificate sign|verify, homes at
// seed), run as a gardener runs them: a scratch world (test-support.mjs), a lab-preview pot seeded through the
// whole keys arc with THROWAWAY keys, no network. The last property is the one that matters: every file these verbs
// write, sealed by its owner, passes the pot's own commit gate (seal-staged --check).
//
//   node skills/bonsai-garden-keys/test-planting-e2e.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWorld, pp, PASS } from './test-support.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..');
const W = await makeWorld({ label: 'planting-e2e' });
// the shared texts the new verbs read from core, which makeWorld's three skills do not carry
for (const rel of ['lore/human-covenant.md', 'agents/shared/codex.md']) {
  fs.mkdirSync(path.dirname(path.join(W.core, rel)), { recursive: true });
  fs.copyFileSync(path.join(SRC, rel), path.join(W.core, rel));
}

const results = [];
function t(name, fn) {
  let ok = false,
    note = '';
  try {
    [ok, note] = fn();
  } catch (e) {
    note = `threw: ${e.message}`;
  }
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  — ${note}`);
}
const out = (r) => `exit ${r.code}: ${(r.stdout + r.stderr).trim().split('\n').slice(-2).join(' | ')}`.slice(0, 220);
const B = W.B;

const pot = W.newPot();
const seeded = await W.seedPot(pot, { attest: false });
const { gardener, shin } = seeded;
const has = (rel) => fs.existsSync(path.join(pot, rel));
/** Planting 7b in one line: a stand-in shintai for each kin (its SKILL.md), so stage 4 has someone to name (T-8). */
const assemble = (p, slugs) => {
  for (const s of slugs) {
    fs.mkdirSync(path.join(p, 'agents', s), { recursive: true });
    fs.writeFileSync(path.join(p, 'agents', s, 'SKILL.md'), `---\nname: ${s}\nversion: '1.0.0'\n---\n# ${s}\n`);
  }
};
assemble(pot, [shin, 'bonsai-shin']);

t('seed-plants-a-home-for-every-key-holder', () => {
  const ok =
    has(`home/${gardener}/inbox/acknowledged.md`) &&
    has(`home/${shin}/memory/working-state.md`) &&
    has('home/bonsai-shin/memory/working-state.md') &&
    !has('home/bonsai') &&
    !has(`home/${gardener}/memory`);
  const seedOut = seeded.steps.find(([w]) => w === 'seed')[1].stdout;
  return [ok && /homes: \d+ file\(s\)/.test(seedOut), fs.readdirSync(path.join(pot, 'home')).join(',')];
});

t('covenant-write-then-a-wrong-signer-is-refused-before-custody-is-opened', () => {
  const w = W.run(['covenant', 'write', '--pot', pot, '--name', 'Ana']);
  const r = W.run(['certificate', 'sign', '--pot', pot, '--for', shin, '--as', 'bonsai-shin', ...B], { input: '' }); // no passphrase given: must not be asked
  return [
    w.code === 0 &&
      has('lore/covenant.md') &&
      has('lore/codex.md') &&
      r.code === 2 &&
      /neither this garden's gardener/.test(r.stderr + r.stdout),
    out(r),
  ];
});

t('sponsor-and-each-agentic-teammate-sign-and-every-certificate-verifies', () => {
  const sign = (kin, as) =>
    W.run(['certificate', 'sign', '--pot', pot, '--for', kin, '--as', as, ...B], { input: pp(PASS) });
  const s1 = sign(shin, gardener),
    t1 = sign(shin, shin);
  const v1 = W.run(['certificate', 'verify', '--pot', pot]); // bonsai-shin has none yet
  const t2 = sign('bonsai-shin', 'bonsai-shin'),
    s2 = sign('bonsai-shin', gardener);
  const v2 = W.run(['certificate', 'verify', '--pot', pot]);
  const cert = JSON.parse(fs.readFileSync(path.join(pot, `agents/${shin}/identity/passport.json`), 'utf8'))
    .certificates[0];
  return [
    [s1, t1, t2, s2].every((r) => r.code === 0) &&
      /complete/.test(t1.stdout) &&
      v1.code === 1 &&
      /FAIL {2}passport: agents\/bonsai-shin/.test(v1.stdout) &&
      v2.code === 0 &&
      cert.statement.sponsor.slug === gardener &&
      cert.statement['agentic-teammate'].slug === shin,
    `${s1.code} ${t1.code} ${v1.code} ${t2.code} ${s2.code} ${v2.code}; ${out(v2)}`,
  ];
});

t('a-codex-changed-after-signing-fails-verify-as-text', () => {
  const f = path.join(pot, 'lore/codex.md');
  const keep = fs.readFileSync(f);
  fs.appendFileSync(f, '\nan added line\n');
  const v = W.run(['certificate', 'verify', '--pot', pot]);
  fs.writeFileSync(f, keep);
  return [v.code === 1 && /FAIL {2}text:/.test(v.stdout), out(v)];
});

t('every-file-the-new-verbs-wrote-sealed-by-its-owner-passes-the-pots-own-gate', () => {
  const groups = {
    [gardener]: ['lore/covenant.md', 'lore/codex.md', `home/${gardener}/inbox/acknowledged.md`],
    [shin]: [
      `home/${shin}/inbox/acknowledged.md`,
      `home/${shin}/memory/working-state.md`,
      `agents/${shin}/identity/passport.json`,
    ],
    'bonsai-shin': [
      'home/bonsai-shin/inbox/acknowledged.md',
      'home/bonsai-shin/memory/working-state.md',
      'agents/bonsai-shin/identity/passport.json',
    ],
  };
  const all = Object.values(groups).flat();
  const add = W.sh('git', ['-C', pot, 'add', '--', ...all]);
  const sealed = Object.entries(groups).map(([slug, paths]) =>
    W.run(['seal-staged', '--pot', pot, '--as', slug, ...B, '--', ...paths], { input: pp(PASS) }),
  );
  const check = W.run(['seal-staged', '--check', '--pot', pot]);
  return [
    add.code === 0 && sealed.every((r) => r.code === 0) && check.code === 0,
    `add ${add.code}; seals ${sealed.map((r) => r.code).join(',')}; check ${out(check)}`,
  ];
});

// ── two companions in one garden (new keys for both) ────────────────────────────────────────────────────────────
t('a-one-companion-garden-json-is-as-it-always-was', () => {
  const g = JSON.parse(fs.readFileSync(path.join(pot, 'garden.json'), 'utf8'));
  return [g.shin === shin && !('shins' in g), JSON.stringify({ shin: g.shin, shins: g.shins })];
});

t('id-refuses-a-companion-named-twice-or-named-like-another-key-holder', () => {
  const p1 = W.newPot('dup1'),
    p2 = W.newPot('dup2');
  const a = W.run(['id', '--pot', p1, '--name', 'twice', '--gardener', 'ana', '--shin', 'kiko,kiko']);
  const b = W.run(['id', '--pot', p2, '--name', 'twice', '--gardener', 'ana', '--shin', 'kiko,ana']);
  const why = (r) => /every companion need different slugs/.test(r.stdout + r.stderr); // its own reason, not "not a slug"
  return [
    a.code === 2 &&
      b.code === 2 &&
      why(a) &&
      why(b) &&
      !fs.existsSync(path.join(p1, 'garden.json')) &&
      !fs.existsSync(path.join(p2, 'garden.json')),
    `${out(a)} / ${out(b)}`,
  ];
});

// the whole arc through the binary for a garden with two companions, then the planting's verbs over both
const two = W.newPot('two');
let twoErr = null;
try {
  const step = (args, input = pp(PASS)) => {
    const r = W.run(args, { input });
    if (r.code !== 0) throw new Error(`${args.slice(0, 2).join(' ')}: ${out(r)}`);
    return r;
  };
  step(['id', '--pot', two, '--name', 'paar', '--gardener', 'ana', '--shin', 'kiko,riku'], '');
  step(['mint', '--pot', two, '--lab-preview', ...B], pp(PASS, PASS));
  const exp = path.join(W.dir, 'paar-master-salt.sealed');
  step(['recover', 'export', '--pot', two, '--out', exp, ...B], pp(PASS, `${PASS}-export`, `${PASS}-export`));
  step(['recover', 'drill', '--pot', two, '--file', exp, '--passphrase-stdin'], pp(`${PASS}-export`));
  step(['namespace', '--pot', two, ...B]);
  const SET = JSON.parse(
    fs.readFileSync(path.join(W.core, 'skills', 'bonsai-garden-mark', 'kanji-1024-v1.2.json'), 'utf8'),
  ).kanji;
  for (const [slug, pair] of Object.entries({ ana: [21, 70], 'bonsai-shin': null, kiko: [26, 27], riku: [28, 29] })) {
    step([
      'identity',
      slug,
      '--pot',
      two,
      ...(pair ? ['--pair', SET[pair[0]].char + SET[pair[1]].char] : []),
      '--fp-attests',
      '1',
      ...B,
    ]);
  }
  for (const slug of ['paar', 'ana', 'bonsai-shin', 'kiko', 'riku']) step(['derive', slug, '--pot', two, ...B]);
  step(['seed', '--pot', two, '--bonsai-entry', await W.bonsaiEntry(), ...B]);
  assemble(two, ['bonsai-shin', 'kiko', 'riku']);
  step(['covenant', 'write', '--pot', two]);
  for (const kin of ['bonsai-shin', 'kiko', 'riku']) {
    step(['certificate', 'sign', '--pot', two, '--for', kin, '--as', 'ana', ...B]);
    step(['certificate', 'sign', '--pot', two, '--for', kin, '--as', kin, ...B]);
  }
} catch (e) {
  twoErr = e.message;
}

t('a-garden-with-two-companions-seeds-both-plants-their-homes-and-certifies-both', () => {
  if (twoErr) return [false, twoErr];
  const g = JSON.parse(fs.readFileSync(path.join(two, 'garden.json'), 'utf8'));
  const reg = JSON.parse(fs.readFileSync(path.join(two, 'agents/registry.json'), 'utf8'));
  const slugs = reg.agents.map((a) => a.slug).join(',');
  const homes = ['kiko', 'riku'].every((s) => fs.existsSync(path.join(two, `home/${s}/memory/working-state.md`)));
  const status = W.run(['status', '--pot', two]);
  const v = W.run(['certificate', 'verify', '--pot', two]);
  return [
    g.shin === 'kiko' &&
      JSON.stringify(g.shins) === '["kiko","riku"]' &&
      slugs === 'paar,ana,bonsai,bonsai-shin,kiko,riku' &&
      homes &&
      /✓ identity/.test(status.stdout) &&
      /✓ derive/.test(status.stdout) &&
      v.code === 0,
    `registry ${slugs}; homes ${homes}; status ${status.stdout
      .split('\n')
      .filter((l) => /identity|derive/.test(l))
      .join(' | ')}; ${out(v)}`,
  ];
});

// W's audit of the third dry run, F-5 (2026-10-18): the gardener said "let's just plant bonsai-shin, we do not need W/u-shin",
// and the keys tool's id required a companion, so a key was minted for a kin no one asked for. A garden needs none: the arc
// runs through the real binary with no --shin, and nothing anywhere names a companion.
const lone = W.newPot('lone');
let loneErr = null;
let loneSeed = null;
try {
  loneSeed = await W.seedPot(lone, { name: 'eremo', shin: null, attest: true });
} catch (e) {
  loneErr = e.message;
}

t('a-garden-plants-without-a-companion-and-its-arc-completes', () => {
  if (loneErr) return [false, loneErr];
  const g = JSON.parse(fs.readFileSync(path.join(lone, 'garden.json'), 'utf8'));
  const reg = JSON.parse(fs.readFileSync(path.join(lone, 'agents/registry.json'), 'utf8'));
  const slugs = reg.agents.map((a) => a.slug).join(',');
  const idOut = loneSeed.steps.find(([w]) => w === 'id')[1].stdout;
  const status = W.run(['status', '--pot', lone]);
  return [
    g.shin === null &&
      !('shins' in g) &&
      slugs === 'eremo,ana,bonsai,bonsai-shin' &&
      /companions: none/.test(idOut) &&
      /the arc is complete/.test(status.stdout) &&
      fs.existsSync(path.join(lone, 'home/bonsai-shin/memory/working-state.md')),
    `registry ${slugs}; id: ${idOut.trim().split('\n')[1] || ''}; ${status.stdout.trim().split('\n').slice(-1)[0]}`,
  ];
});

const failed = results.filter((x) => !x).length;
console.log(
  `\n${results.length - failed}/${results.length} passed${failed ? ` — ${failed} FAILED` : ''}   (scratch: ${W.dir})`,
);
process.exit(failed ? 1 : 0);
