// ---
// id: 01M4AFY7CN5SPF1WBSWNMPMAYM
// title: The shipped reserved set, tested by planting each refusal (spec-gardeners-keys §6.5)
// type: script
// tended-by: baisai
// created: 2026-10-07
// updated: 2026-10-07
// ---
//
// test-reserved-marks.mjs — every refusal in spec-gardeners-keys.md §6.5 planted, never read off
// the code; and each guard this build adds, planted the same way. One case per check; each case
// asserts the refusal's REASON and the part it names, so a case cannot pass for another guard's
// refusal (Fuji-shin's lesson of three rounds: a guard whose test passes for the wrong reason is
// a guard nobody watches).
//
//   node skills/bonsai-garden-mark/test-reserved-marks.mjs             every case
//   node skills/bonsai-garden-mark/test-reserved-marks.mjs --only a,b  the named cases
//   node skills/bonsai-garden-mark/test-reserved-marks.mjs --list
//
// Everything is fixture: throwaway git repos standing in for core (with synthetic skill identity
// files whose marks are re-derivable) and for the origin's roster (23 synthetic kin, no slug or
// kanji of ours), a throwaway origin key that seals, and a fake bon-sai.garden (test-fake-origin.mjs)
// answering signed by a throwaway verifier key. NO NETWORK: the global fetch is replaced by one
// that counts and throws, and a case that reaches it fails. No real key, keychain or salt.
//
// RESERVED_MARK_DIR (this harness only, never the module) points the cases at another copy of the
// mark skill: test-reserved-marks-mutants.mjs runs them against deliberately broken copies.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MARK = process.env.RESERVED_MARK_DIR ? path.resolve(process.env.RESERVED_MARK_DIR) : HERE;
const SKILLS = path.dirname(MARK);
const SIGN_LIB = path.join(SKILLS, 'bonsai-garden-sign', 'lib');
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;

let NET = 0;
globalThis.fetch = async () => {
  NET++;
  throw new Error('the suite never touches the network');
};

const RM = await import(path.join(MARK, 'reserved-marks.mjs'));
const { makeOrigin } = await import(path.join(MARK, 'origin.mjs'));
const { canonicalAnswer } = await import(path.join(SIGN_LIB, 'published-keys.mjs'));
const FAKE = await import(path.join(HERE, 'test-fake-origin.mjs')); // test support: never mutated
const SET = JSON.parse(fs.readFileSync(path.join(MARK, 'kanji-1024-v1.2.json'), 'utf8')).kanji;
const ch = (i) => SET[i].char;
const SCRATCH = fs.mkdtempSync(path.join(process.env.RESERVED_TEST_TMP || os.tmpdir(), 'reserved-test-'));
const TARGET = 'skills/bonsai-garden-mark/reserved-marks.json';
const ABOUT = [
  // spec §6.3, Chisai's three lines reworded for the rule, copied here independently
  'Indices of the 1024-kanji set (v1.2) reserved in the first namespace. A mark that matches the rule (any shown kanji in wildcard, or its first in A and its second in B) means: choose another. It names no one and attests nothing.',
  'Not a roster. Nothing here can be verified against. Whoever wears a match anyway gets look-alike from the verifier, never a false yes.',
  'It only grows. An index never leaves this file; a retired name is still a taken name.',
];
const RULE_B = [1, 3, 5, 10, 322, 582]; // 才 園 身 盆 庭 技, checked against the set below
const ser = (o) => `${JSON.stringify(o, null, 2)}\n`;

// ── fixture inputs, independent of the code under test ───────────────────────

/** First n indices of a salt's mark, computed here from the hash bits (not through engine.js). */
function idxOf(salt, n) {
  const b = crypto.createHash('sha256').update(salt, 'utf8').digest();
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
// 23 synthetic kin, first kanji at indices 100..122, second kanji 才 or 身; one forming, one retired
const ROSTER = Array.from({ length: 23 }, (_, i) => ({
  slug: `kin-${String(i + 1).padStart(2, '0')}`,
  kanji: ch(100 + i) + (i % 2 ? '身' : '才'),
  status: i === 5 ? 'forming' : i === 9 ? 'retired' : 'active',
}));
const ROSTER_IDX = ROSTER.map((_, i) => 100 + i);
// 10 synthetic skills whose marks are re-derivable: whatever the salt spells, first kanji distinct
const SKILLS_FX = [];
{
  const used = new Set([0, ...ROSTER_IDX]);
  for (let n = 1; SKILLS_FX.length < 10; n++) {
    for (let k = 0; ; k++) {
      const salt = `fixture-skill-${n}#${k}`;
      const ix = idxOf(salt, 2);
      if (!used.has(ix[0]) && ix[1] !== 0) {
        used.add(ix[0]);
        SKILLS_FX.push({ name: `fixture-skill-${n}`, salt, mark: ch(ix[0]) + ch(ix[1]), first: ix[0] });
        break;
      }
    }
  }
}
const SKILL_IDX = SKILLS_FX.map((s) => s.first);
const EXPECTED_A = [...ROSTER_IDX, ...SKILL_IDX].sort((x, y) => x - y);
const EXPECTED = () => ({
  format: 'bonsai-garden-reserved-marks/1',
  about: [...ABOUT],
  wildcard: [0],
  A: [...EXPECTED_A],
  B: [...RULE_B],
});

const ORIGIN = FAKE.throwawaySigner('fixture-origin');
const VERIFIER = FAKE.keypair();
const STRANGER = FAKE.throwawaySigner('fixture-stranger'); // a key the fake site does not hold

function identityMd({ name, salt, mark }, { withSalt = true, markOverride = null } = {}) {
  return [
    '---',
    'id: fixture',
    `title: ${name}, a fixture`,
    'type: identity',
    ...(mark
      ? [`mark: ${markOverride || mark}`, ...(withSalt ? [`mark-salt: "${salt}"`] : []), 'mark-status: proposed']
      : []),
    '---',
    '',
    `# ${name}`,
    '',
  ].join('\n');
}

const G = (dir, ...a) =>
  spawnSync(
    'git',
    [
      '-C',
      dir,
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'user.name=fixture',
      ...a,
    ],
    { encoding: 'utf8' },
  );

let wN = 0;
/** A fresh world: a fixture core (git, skills, no reserved set yet) and a fixture roster beside it. */
function world({ roster = ROSTER, skills = SKILLS_FX, extraSkills = [] } = {}) {
  const dir = path.join(SCRATCH, `w${++wN}`);
  const core = path.join(dir, 'core');
  fs.mkdirSync(path.join(core, 'skills', 'bonsai-garden-mark'), { recursive: true });
  G(dir, 'init', '-q', core);
  for (const s of [...skills, ...extraSkills]) {
    fs.mkdirSync(path.join(core, 'skills', s.name, 'references'), { recursive: true });
    fs.writeFileSync(path.join(core, 'skills', s.name, 'references', 'identity.md'), s.text || identityMd(s));
  }
  // a skill with no mark line: adds nothing
  fs.mkdirSync(path.join(core, 'skills', 'fixture-no-mark', 'references'), { recursive: true });
  fs.writeFileSync(
    path.join(core, 'skills', 'fixture-no-mark', 'references', 'identity.md'),
    identityMd({ name: 'fixture-no-mark' }),
  );
  G(core, 'add', '-A');
  G(core, 'commit', '-qm', 'fixture skills');
  const reg = path.join(dir, 'mono', 'agents', 'registry.json');
  fs.mkdirSync(path.dirname(reg), { recursive: true });
  fs.writeFileSync(reg, `${JSON.stringify({ $schema: 'fixture', agents: roster }, null, 2)}\n`);
  return { dir, core, reg, file: path.join(core, TARGET) };
}
const plant = (W, obj, { raw = null } = {}) => fs.writeFileSync(W.file, raw !== null ? raw : ser(obj));
const seal = (W, opts = {}) =>
  FAKE.sealWith(SIGN_LIB, W.file, opts.signer || ORIGIN, {
    target: opts.target || TARGET,
    role: opts.role || 'owner',
    extra: opts.extra || {},
  });
const commit = (W, msg = 'baseline') => {
  G(W.core, 'add', '-A');
  const r = G(W.core, 'commit', '-qm', msg);
  if (r.status !== 0) throw new Error(`fixture commit: ${r.stderr}`);
};
/** A world whose HEAD holds the true first generation, sealed by the throwaway origin. */
async function baseline(opts = {}) {
  const W = world(opts);
  plant(W, EXPECTED());
  await seal(W);
  commit(W);
  return W;
}
const site = (mode = 'vouch') => FAKE.fakeSite({ signers: [ORIGIN], verifier: VERIFIER, mode, canonicalAnswer });
const originFor = (s) => makeOrigin({ fetchImpl: s.fetchImpl, pinnedKey: VERIFIER.b64 });

const has = (r, reason, re) => r.problems.some((p) => p.reason === reason && (!re || re.test(p.detail)));
const show = (r) =>
  r.problems
    .map((p) => `${p.reason}: ${p.detail}`)
    .join(' | ')
    .slice(0, 300) || 'no problems';
async function refusal(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
}

// ── cases ────────────────────────────────────────────────────────────────────

const cases = [];
const t = (name, fn) => cases.push({ name, fn });

t('the-rule-constants-are-the-set', () => {
  // the six of B and the wildcard, by character, against the curated set itself
  const ok =
    ['才', '園', '身', '盆', '庭', '技'].every((c) => RULE_B.includes(SET.findIndex((k) => k.char === c))) &&
    SET[0].char === '〇';
  const c = RM.constants();
  return [
    ok && JSON.stringify(c.B) === JSON.stringify(RULE_B) && JSON.stringify(c.wildcard) === '[0]',
    JSON.stringify(c),
  ];
});

// §6.5 row 1
t('hand-added', async () => {
  const W = await baseline();
  plant(W, { ...EXPECTED(), A: [...EXPECTED_A, 700].sort((x, y) => x - y) });
  await seal(W);
  const r = RM.check({ coreRoot: W.core, registryPath: W.reg });
  return [has(r, 'hand-added', /A holds 700\b/), show(r)];
});

// row 2
t('an-index-left-the-set', async () => {
  const W = await baseline();
  const out = {};
  for (const [part, obj, re] of [
    ['A', { ...EXPECTED(), A: EXPECTED_A.filter((i) => i !== 100) }, /^A lost 100\b/],
    ['B', { ...EXPECTED(), B: RULE_B.filter((i) => i !== 3) }, /^B lost 3\b/],
    ['wildcard', { ...EXPECTED(), wildcard: [] }, /^wildcard lost 0\b/],
  ]) {
    plant(W, obj);
    await seal(W);
    const r = RM.check({ coreRoot: W.core });
    out[part] = has(r, 'an index left the set; it only grows', re) ? 'refused' : show(r);
  }
  return [Object.values(out).every((x) => x === 'refused'), JSON.stringify(out)];
});

// row 3
t('stale-regenerate', async () => {
  const W = await baseline();
  // a kin added to the roster with a first kanji the set does not hold
  const roster = [...ROSTER, { slug: 'kin-new', kanji: `${ch(150)}身`, status: 'forming' }];
  fs.writeFileSync(W.reg, JSON.stringify({ agents: roster }, null, 2));
  const a = RM.check({ coreRoot: W.core, registryPath: W.reg });
  // a core skill whose mark's first kanji the set does not hold (core alone, no roster)
  const W2 = await baseline();
  let extra = null;
  for (let k = 0; !extra; k++) {
    const salt = `fixture-late-skill#${k}`;
    const ix = idxOf(salt, 2);
    if (![0, ...EXPECTED_A].includes(ix[0]) && ix[1] !== 0)
      extra = { name: 'fixture-late-skill', salt, mark: ch(ix[0]) + ch(ix[1]), first: ix[0] };
  }
  fs.mkdirSync(path.join(W2.core, 'skills', extra.name, 'references'), { recursive: true });
  fs.writeFileSync(path.join(W2.core, 'skills', extra.name, 'references', 'identity.md'), identityMd(extra));
  const b = RM.check({ coreRoot: W2.core });
  const okA = has(a, 'stale: regenerate', new RegExp(`kin-new.*${ch(150)} \\(150\\).*regenerate in core`));
  const okB = has(b, 'stale: regenerate', new RegExp(`fixture-late-skill.*\\(${extra.first}\\).*regenerate in core`));
  return [okA && okB, `roster: ${show(a)} || skill: ${show(b)}`];
});

// row 4
t('under-the-floor', () => {
  const out = {};
  for (const [n, obj, re] of [
    ['wildcard-without-0', { ...EXPECTED(), wildcard: [5] }, /wildcard does not hold 〇/],
    ['b-without-bon', { ...EXPECTED(), B: RULE_B.filter((i) => i !== 10) }, /set B lacks 盆/],
    ['b-without-gi', { ...EXPECTED(), B: RULE_B.filter((i) => i !== 582) }, /set B lacks 技/],
    ['a-of-32', { ...EXPECTED(), A: EXPECTED_A.filter((i) => i !== 100) }, /set A holds 32\b/],
  ]) {
    const W = world(); // nothing shipped: only this part can be wrong
    plant(W, obj);
    fs.writeFileSync(path.join(W.core, '.keep'), '');
    out[n] = (() => {
      const r = RM.check({ coreRoot: W.core });
      return has(r, 'under the floor', re) ? 'refused' : show(r);
    })();
  }
  return [Object.values(out).every((x) => x === 'refused'), JSON.stringify(out)];
});

// row 5
t('not-the-format', () => {
  const out = {};
  const A = EXPECTED_A;
  for (const [n, obj, re] of [
    ['unsorted', { ...EXPECTED(), A: [A[1], A[0], ...A.slice(2)] }, /^A is not sorted ascending/],
    ['duplicate', { ...EXPECTED(), A: [...A.slice(0, 1), A[0], ...A.slice(1)] }, new RegExp(`^A holds ${A[0]} twice`)],
    ['1024', { ...EXPECTED(), A: [...A, 1024] }, /^A holds 1024, outside/],
    ['-1', { ...EXPECTED(), A: [-1, ...A] }, /^A holds -1, outside/],
    ['string', { ...EXPECTED(), A: [...A.slice(0, -1), String(A[A.length - 1])] }, /^A holds "\d+", not an integer/],
    ['maru-in-A', { ...EXPECTED(), A: [0, ...A] }, /〇 \(0\) is in A/],
  ]) {
    const W = world();
    plant(W, obj);
    const r = RM.check({ coreRoot: W.core });
    out[n] = has(r, 'not the format', re) ? 'refused' : show(r);
  }
  return [Object.values(out).every((x) => x === 'refused'), JSON.stringify(out)];
});

// row 6
t('no-columns', () => {
  const out = {};
  for (const [n, obj, re] of [
    ['slugs', { ...EXPECTED(), slugs: ['kin-01'] }, /a sixth key, "slugs"/],
    ['count', { ...EXPECTED(), count: 33 }, /a sixth key, "count"/],
    ['dates', { ...EXPECTED(), dates: { 100: '2026-10-07' } }, /a sixth key, "dates"/],
    [
      'object-in-A',
      { ...EXPECTED(), A: [...EXPECTED_A.slice(0, -1), { index: EXPECTED_A.at(-1), slug: 'kin-23' }] },
      /an object in A/,
    ],
  ]) {
    const W = world();
    plant(W, obj);
    const r = RM.check({ coreRoot: W.core });
    out[n] = has(r, 'no columns', re) ? 'refused' : show(r);
  }
  return [Object.values(out).every((x) => x === 'refused'), JSON.stringify(out)];
});

// row 7
t('header', () => {
  const out = {};
  for (const [n, about, re] of [
    ['altered', [ABOUT[0], ABOUT[1].replace('Not a roster.', 'A roster.'), ABOUT[2]], /about line 2 is altered/],
    ['missing', [ABOUT[0], ABOUT[2]], /not Chisai's three/],
  ]) {
    const W = world();
    plant(W, { ...EXPECTED(), about });
    const r = RM.check({ coreRoot: W.core });
    out[n] = has(r, 'header', re) ? 'refused' : show(r);
  }
  return [Object.values(out).every((x) => x === 'refused'), JSON.stringify(out)];
});

// row 8
t('the-pair-list-and-one-shape', () => {
  const W1 = world();
  plant(W1, {
    pairs: [
      [100, 1],
      [101, 5],
    ],
  });
  const a = RM.check({ coreRoot: W1.core });
  const { A, B, ...rest } = EXPECTED();
  const W2 = world();
  plant(W2, { ...rest, 'set-a': A, 'set-b': B });
  const b = RM.check({ coreRoot: W2.core });
  // the reader refuses them too, offline, before the site is asked
  return [
    has(a, 'the pair list is not read') && has(b, 'one shape', /"set-a"/) && has(b, 'one shape', /"set-b"/),
    `pairs: ${show(a)} || aliases: ${show(b)}`,
  ];
});

// row 9
t('edited-after-its-seal', async () => {
  const W = await baseline();
  plant(W, { ...EXPECTED(), A: [...EXPECTED_A, 700].sort((x, y) => x - y) }); // NOT re-sealed
  const r = RM.check({ coreRoot: W.core });
  const s = site();
  const e = await refusal(() => RM.loadReservedSet({ file: W.file, origin: originFor(s) }));
  return [
    has(r, 'hash-mismatch') && e && e.reason === 'hash-mismatch' && e.exit === 2 && s.calls.length === 0,
    `check: ${show(r)} || reader: ${e ? e.message : 'believed'}, site asked ${s.calls.length}`,
  ];
});

// row 10
t('a-seal-the-site-does-not-vouch-for', async () => {
  const W = await baseline();
  const out = {};
  for (const [mode, want] of [
    ['rejected', 'rejected'],
    ['forged', 'answer-forged'],
    ['unsigned', 'answer-unsigned'],
  ]) {
    const s = site(mode);
    const e = await refusal(() => RM.loadReservedSet({ file: W.file, origin: originFor(s) }));
    out[mode] =
      e && e.reason === want && e.exit === 2 && s.calls.length === 1
        ? 'refused'
        : e
          ? `${e.reason}/${e.exit}`
          : 'BELIEVED';
  }
  // spec §6.4 point 5, the flip of reserved-floor-counts-and-does-not-know: 33 arbitrary indices,
  // sealed and well-formed, are refused, because only the origin's word makes a set believed
  const W2 = world();
  plant(W2, { ...EXPECTED(), A: Array.from({ length: 33 }, (_, i) => 600 + i) });
  await seal(W2, { signer: STRANGER });
  const s2 = site();
  const e2 = await refusal(() => RM.loadReservedSet({ file: W2.file, origin: originFor(s2) }));
  out.arbitrary =
    e2 && e2.reason === 'rejected' && e2.exit === 2 ? 'refused' : e2 ? `${e2.reason}/${e2.exit}` : 'BELIEVED';
  return [Object.values(out).every((x) => x === 'refused'), JSON.stringify(out)];
});

// row 11
t('unreachable-halts', async () => {
  const W = await baseline();
  const out = {};
  for (const mode of ['unreachable', 'http-500']) {
    const s = site(mode);
    const e = await refusal(() => RM.loadReservedSet({ file: W.file, origin: originFor(s) }));
    out[mode] =
      e && e.reason === 'keys-unreachable' && e.exit === 3 ? 'halt' : e ? `${e.reason}/${e.exit}` : 'BELIEVED';
  }
  return [Object.values(out).every((x) => x === 'halt'), JSON.stringify(out)];
});

// row 12
t('maru-in-the-roster-is-not-in-A', () => {
  const W = world({ roster: [...ROSTER, { slug: 'kin-circle', kanji: '〇身', status: 'active' }] });
  const g = RM.generate({ registryPath: W.reg, coreRoot: W.core });
  return [
    !g.obj.A.includes(0) &&
      JSON.stringify(g.obj.wildcard) === '[0]' &&
      g.notes.some((n) => /kin-circle.*wildcard/.test(n)) &&
      JSON.stringify(g.obj.A) === JSON.stringify(EXPECTED_A),
    `A has 0: ${g.obj.A.includes(0)}, notes ${JSON.stringify(g.notes)}`,
  ];
});

// row 13
t('two-generator-runs-are-byte-identical', () => {
  const W = world();
  const cli = withCli(W);
  const a = spawnSync(process.execPath, [cli, 'generate', '--registry', W.reg, '--out', path.join(W.dir, 'one.json')], {
    encoding: 'utf8',
  });
  const b = spawnSync(process.execPath, [cli, 'generate', '--registry', W.reg, '--out', path.join(W.dir, 'two.json')], {
    encoding: 'utf8',
  });
  const one = fs.existsSync(path.join(W.dir, 'one.json'))
    ? fs.readFileSync(path.join(W.dir, 'one.json'))
    : Buffer.alloc(0);
  const two = fs.existsSync(path.join(W.dir, 'two.json'))
    ? fs.readFileSync(path.join(W.dir, 'two.json'))
    : Buffer.from('x');
  return [
    a.status === 0 && b.status === 0 && one.equals(two) && one.toString() === ser(EXPECTED()),
    `exits ${a.status},${b.status}; identical ${one.equals(two)}; ${(a.stderr || '').trim().slice(0, 120)}`,
  ];
});

// row 14
t('the-exclude-flag-is-gone', () => {
  const pot = fs.mkdtempSync(path.join(SCRATCH, 'pot-'));
  const keys = spawnSync(
    process.execPath,
    [
      path.join(SKILLS, 'bonsai-garden-keys', 'bin', 'keys.mjs'),
      'namespace',
      '--pot',
      pot,
      '--exclude',
      path.join(pot, 'weaker.json'),
    ],
    { encoding: 'utf8' },
  );
  const ns = spawnSync(
    process.execPath,
    [path.join(MARK, 'namespace.mjs'), 'namespace', '--name', 'marta', '--exclude', path.join(pot, 'weaker.json')],
    { encoding: 'utf8' },
  );
  return [
    keys.status === 64 && /--exclude/.test(keys.stderr) && ns.status === 64 && /--exclude/.test(ns.stderr),
    `keys ${keys.status}: ${keys.stderr.trim().split('\n')[0]} || namespace.mjs ${ns.status}: ${ns.stderr.trim().split('\n')[0]}`,
  ];
});

// ── the reader's own guards ─────────────────────────────────────────────────

t('reader-believes-a-vouched-set-and-asks-once', async () => {
  const W = await baseline();
  const s = site();
  const rule = await RM.loadReservedSet({ file: W.file, origin: originFor(s) });
  const ok =
    rule?.reserved([0, 7, 9]) &&
    rule.reserved([100, 1, 9]) &&
    !rule.reserved([100, 7, 9]) &&
    !rule.reserved([7, 1, 9]) &&
    s.calls.length === 1 &&
    s.calls[0].body.signer === 'fixture-origin';
  return [ok, `asked ${s.calls.length}`];
});

t('reader-refuses-an-unsealed-set', async () => {
  const W = world();
  plant(W, EXPECTED());
  const s = site();
  const e = await refusal(() => RM.loadReservedSet({ file: W.file, origin: originFor(s) }));
  return [e && e.reason === 'unsealed' && s.calls.length === 0, e ? e.message.slice(0, 120) : 'BELIEVED'];
});

t('reader-refuses-a-custodian-seal', async () => {
  const W = world();
  plant(W, EXPECTED());
  await seal(W, { role: 'custodian' });
  const s = site();
  const e = await refusal(() => RM.loadReservedSet({ file: W.file, origin: originFor(s) }));
  return [
    e && e.reason === 'not an owner seal' && /custodian/.test(e.detail) && s.calls.length === 0,
    e ? e.message.slice(0, 120) : 'BELIEVED',
  ];
});

t('reader-refuses-an-open-seal', async () => {
  const W = world();
  plant(W, EXPECTED());
  const now = new Date();
  const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  await seal(W, {
    extra: {
      open: {
        reason: 'work in progress',
        closer: 'fixture-origin',
        'ruled-by': 'fixture-origin',
        'opened-at': iso(now),
        expires: iso(new Date(now.getTime() + 86400000)),
        'open-hash': 'ab'.repeat(64),
      },
    },
  });
  const s = site();
  const e = await refusal(() => RM.loadReservedSet({ file: W.file, origin: originFor(s) }));
  return [
    e && e.reason === 'not an owner seal' && /open seal/.test(e.detail) && s.calls.length === 0,
    e ? e.message.slice(0, 120) : 'BELIEVED',
  ];
});

t('reader-refuses-a-seal-on-another-file', async () => {
  const W = world();
  plant(W, EXPECTED());
  await seal(W, { target: 'skills/elsewhere/reserved-marks.json' });
  const s = site();
  const e = await refusal(() => RM.loadReservedSet({ file: W.file, origin: originFor(s) }));
  return [e && e.reason === 'not the shipped file' && s.calls.length === 0, e ? e.message.slice(0, 120) : 'BELIEVED'];
});

t('reader-refuses-a-sealed-set-under-the-floor-offline', async () => {
  // sealed by the origin's own key and still refused, before the site is asked: the floor is the reader's
  const W = world();
  plant(W, { ...EXPECTED(), A: EXPECTED_A.slice(0, 32) });
  await seal(W);
  const s = site();
  const e = await refusal(() => RM.loadReservedSet({ file: W.file, origin: originFor(s) }));
  return [
    e && e.reason === 'under the floor' && /set A holds 32/.test(e.detail) && s.calls.length === 0,
    e ? e.message.slice(0, 120) : 'BELIEVED',
  ];
});

t('reader-refuses-a-sealed-pair-list-offline', async () => {
  const W = world();
  plant(W, { pairs: [[100, 1]] });
  await seal(W);
  const s = site();
  const e = await refusal(() => RM.loadReservedSet({ file: W.file, origin: originFor(s) }));
  return [
    e && e.reason === 'the pair list is not read' && s.calls.length === 0,
    e ? e.message.slice(0, 120) : 'BELIEVED',
  ];
});

t('reader-refuses-a-missing-set', async () => {
  const W = world();
  const e = await refusal(() => RM.loadReservedSet({ file: W.file, origin: originFor(site()) }));
  return [e && e.reason === 'no reserved set' && e.exit === 2, e ? e.message.slice(0, 120) : 'BELIEVED'];
});

t('origin-keeps-the-signed-time-only-when-vouched', async () => {
  const W = await baseline();
  const data = JSON.parse(fs.readFileSync(RM.sidecarOf(W.file), 'utf8'));
  const v = await originFor(site()).ask(data);
  const f = await originFor(site('forged')).ask(data);
  const n = await originFor(site('no-time')).ask(data);
  return [
    v.status === 'signature-vouched' &&
      v.verifiedAt === '2026-10-07T12:00:00.000Z' &&
      f.status === 'answer-forged' &&
      f.verifiedAt === null &&
      n.status === 'signature-vouched' &&
      n.verifiedAt === null,
    `${v.status} ${v.verifiedAt} · ${f.status} ${f.verifiedAt} · ${n.status} ${n.verifiedAt}`,
  ];
});

// ── the generator's own guards ──────────────────────────────────────────────

t('first-generation-equals-the-derivation', () => {
  const W = world();
  const g = RM.generate({ registryPath: W.reg, coreRoot: W.core });
  return [
    g.text === ser(EXPECTED()) && g.obj.A.length === 33,
    `A ${g.obj.A.length}; equal ${g.text === ser(EXPECTED())}`,
  ];
});

t('generator-refuses-a-typed-skill-mark', () => {
  const s = SKILLS_FX[3];
  const typed = { ...s, text: identityMd(s, { markOverride: `${ch(s.first === 700 ? 701 : 700)}技` }) };
  const W = world({ skills: SKILLS_FX.map((x) => (x === s ? typed : x)) });
  const e = (() => {
    try {
      RM.generate({ registryPath: W.reg, coreRoot: W.core });
      return null;
    } catch (x) {
      return x;
    }
  })();
  return [
    e &&
      e.reason === 'typed mark' &&
      new RegExp(`skills/${s.name}/references/identity.md:\\d+: mark .*spells`).test(e.detail),
    e ? e.message.slice(0, 160) : 'generated',
  ];
});

t('generator-refuses-a-mark-without-its-salt', () => {
  const s = SKILLS_FX[4];
  const W = world({ skills: SKILLS_FX.map((x) => (x === s ? { ...s, text: identityMd(s, { withSalt: false }) } : x)) });
  const e = (() => {
    try {
      RM.generate({ registryPath: W.reg, coreRoot: W.core });
      return null;
    } catch (x) {
      return x;
    }
  })();
  return [e && e.reason === 'typed mark' && /no mark-salt/.test(e.detail), e ? e.message.slice(0, 160) : 'generated'];
});

t('generator-refuses-a-kanji-outside-the-set', () => {
  const W = world({ roster: [...ROSTER, { slug: 'kin-latin', kanji: 'Xy', status: 'active' }] });
  const e = (() => {
    try {
      RM.generate({ registryPath: W.reg, coreRoot: W.core });
      return null;
    } catch (x) {
      return x;
    }
  })();
  return [
    e && e.reason === 'input refused' && /kin-latin.*X is not in the curated set/.test(e.detail),
    e ? e.message.slice(0, 160) : 'generated',
  ];
});

t('generator-needs-the-roster', () => {
  const W = world();
  const tryGen = (p) => {
    try {
      RM.generate({ registryPath: p, coreRoot: W.core });
      return 'generated';
    } catch (x) {
      return `${x.reason}: ${x.detail}`;
    }
  };
  const none = tryGen(null);
  const missing = tryGen(path.join(W.dir, 'nowhere.json'));
  const empty = path.join(W.dir, 'empty.json');
  fs.writeFileSync(empty, '{}');
  const noAgents = tryGen(empty);
  const cli = withCli(W);
  const r = spawnSync(process.execPath, [cli, 'generate'], { encoding: 'utf8' });
  const ok =
    /^input refused: .*required/.test(none) &&
    /^input refused: .*cannot be read/.test(missing) &&
    /^input refused: .*no "agents"/.test(noAgents) &&
    r.status === 64 &&
    !fs.existsSync(W.file);
  return [ok, `${none} | ${missing} | ${noAgents} | cli ${r.status}`];
});

t('generator-refuses-under-the-floor', () => {
  const W = world({ roster: ROSTER.slice(0, 22) });
  const e = (() => {
    try {
      RM.generate({ registryPath: W.reg, coreRoot: W.core });
      return null;
    } catch (x) {
      return x;
    }
  })();
  return [
    e && e.reason === 'under the floor' && /set A holds 32/.test(e.detail),
    e ? e.message.slice(0, 160) : 'generated',
  ];
});

t('generator-keeps-what-shipped', async () => {
  // a retired name is still a taken name: an index in the committed file stays, though no source holds it now
  const W = world();
  plant(W, { ...EXPECTED(), A: [...EXPECTED_A, 777].sort((x, y) => x - y) });
  await seal(W);
  commit(W);
  const g = RM.generate({ registryPath: W.reg, coreRoot: W.core });
  return [
    g.obj.A.includes(777) && (g.src.A.get(777) || []).some((l) => /committed file/.test(l)),
    `A has 777: ${g.obj.A.includes(777)}`,
  ];
});

t('generate-lists-every-index-with-its-source', () => {
  const W = world();
  const cli = withCli(W);
  const r = spawnSync(process.execPath, [cli, 'generate', '--registry', W.reg, '--out', path.join(W.dir, 'gen.json')], {
    encoding: 'utf8',
  });
  const lines = r.stdout.split('\n');
  const missing = [];
  for (const [i, k] of ROSTER.entries())
    if (!lines.some((l) => l.includes(`${k.slug} kanji ${k.kanji}`) && /registry\.json:\d+/.test(l)))
      missing.push(`roster ${100 + i}`);
  for (const s of SKILLS_FX)
    if (!lines.some((l) => l.includes(`skills/${s.name}/references/identity.md:`) && l.includes(s.salt)))
      missing.push(`skill ${s.first}`);
  for (const b of RULE_B) if (!lines.some((l) => l.includes(`rule constant: ${ch(b)}`))) missing.push(`B ${b}`);
  return [
    r.status === 0 && missing.length === 0 && /unsealed/.test(r.stdout),
    `exit ${r.status}; missing ${missing.join(', ') || 'none'}`,
  ];
});

// ── the gate's own guards ───────────────────────────────────────────────────

t('check-passes-a-true-generation', async () => {
  const W = await baseline();
  const a = RM.check({ coreRoot: W.core });
  const b = RM.check({ coreRoot: W.core, registryPath: W.reg });
  const c = RM.check({ coreRoot: W.core, staged: true });
  return [!a.problems.length && !b.problems.length && !c.problems.length, `${show(a)} || ${show(b)} || ${show(c)}`];
});

t('check-before-anything-shipped-says-so', () => {
  const W = world();
  const r = RM.check({ coreRoot: W.core, registryPath: W.reg });
  return [
    !r.problems.length && r.notes.some((n) => /has shipped in this core yet/.test(n)),
    `${show(r)}; ${JSON.stringify(r.notes)}`,
  ];
});

t('check-refuses-an-unsealed-set', () => {
  const W = world();
  plant(W, EXPECTED());
  const r = RM.check({ coreRoot: W.core, registryPath: W.reg });
  return [has(r, 'unsealed'), show(r)];
});

t('check-first-generation-must-equal-the-derivation', async () => {
  // nothing committed: an index no source derives is hand-added; a derived one missing is stale
  const W = world();
  plant(W, { ...EXPECTED(), A: [...EXPECTED_A, 701].sort((x, y) => x - y) });
  await seal(W);
  const a = RM.check({ coreRoot: W.core, registryPath: W.reg });
  const W2 = world();
  plant(W2, { ...EXPECTED(), A: [...EXPECTED_A.filter((i) => i !== 101), 702].sort((x, y) => x - y) });
  await seal(W2);
  const b = RM.check({ coreRoot: W2.core, registryPath: W2.reg });
  return [
    has(a, 'hand-added', /A holds 701\b/) &&
      has(b, 'stale: regenerate', /kin-02.*\(101\)/) &&
      has(b, 'hand-added', /A holds 702\b/),
    `${show(a)} || ${show(b)}`,
  ];
});

t('check-hand-added-in-B-without-the-roster', async () => {
  const W = await baseline();
  plant(W, { ...EXPECTED(), B: [...RULE_B, 9].sort((x, y) => x - y) });
  await seal(W);
  const r = RM.check({ coreRoot: W.core });
  return [has(r, 'hand-added', /^B holds 9\b/), show(r)];
});

t('check-staged-reads-the-index', async () => {
  const W = await baseline();
  const good = fs.readFileSync(W.file);
  const goodSide = fs.readFileSync(RM.sidecarOf(W.file));
  plant(W, { ...EXPECTED(), A: EXPECTED_A.filter((i) => i !== 100) });
  await seal(W);
  G(W.core, 'add', '-A');
  fs.writeFileSync(W.file, good);
  fs.writeFileSync(RM.sidecarOf(W.file), goodSide); // the working tree looks fine
  const staged = RM.check({ coreRoot: W.core, staged: true });
  const tree = RM.check({ coreRoot: W.core });
  return [
    has(staged, 'an index left the set; it only grows', /^A lost 100\b/) && !tree.problems.length,
    `staged: ${show(staged)} || tree: ${show(tree)}`,
  ];
});

t('check-the-set-cannot-leave-core', async () => {
  const W = await baseline();
  fs.rmSync(W.file);
  fs.rmSync(RM.sidecarOf(W.file));
  const a = RM.check({ coreRoot: W.core });
  commit(W, 'the set removed'); // even once the removal is committed
  const b = RM.check({ coreRoot: W.core });
  return [
    has(a, 'an index left the set; it only grows', /has left core/) &&
      has(b, 'an index left the set; it only grows', /has left core/),
    `${show(a)} || ${show(b)}`,
  ];
});

t('check-refuses-a-typed-skill-mark', async () => {
  const W = await baseline();
  const s = SKILLS_FX[2];
  fs.writeFileSync(
    path.join(W.core, 'skills', s.name, 'references', 'identity.md'),
    identityMd(s, { markOverride: ch(s.first) + (s.mark[1] === '技' ? '園' : '技') }),
  );
  const r = RM.check({ coreRoot: W.core });
  return [has(r, 'typed mark', new RegExp(`${s.name}.*spells`)), show(r)];
});

t('check-refuses-bytes-not-written-by-the-generator', async () => {
  // the same sets, written compactly and sealed: right content, not the one serialisation
  const W = world();
  fs.writeFileSync(W.file, JSON.stringify(EXPECTED()));
  await seal(W);
  const r = RM.check({ coreRoot: W.core });
  return [has(r, 'not the format', /not the bytes the generator writes/), show(r)];
});

t('check-cli-exits-1-and-names-regenerate-in-core', async () => {
  const W = await baseline();
  const cli = withCli(W);
  fs.writeFileSync(W.reg, JSON.stringify({ agents: [...ROSTER, { slug: 'kin-new', kanji: `${ch(150)}身` }] }, null, 2));
  const bad = spawnSync(process.execPath, [cli, 'check', '--registry', W.reg], { encoding: 'utf8' });
  const good = spawnSync(process.execPath, [cli, 'check'], { encoding: 'utf8' });
  return [
    bad.status === 1 && /stale: regenerate.*kin-new.*regenerate in core/.test(bad.stdout) && good.status === 0,
    `bad ${bad.status}, good ${good.status}: ${good.stdout.trim().split('\n').pop()}`,
  ];
});

/** Place the CLI (and only the code it imports) inside a world's core, so its marker finds that core. */
function withCli(W) {
  const dst = path.join(W.core, 'skills', 'bonsai-garden-mark');
  for (const f of ['reserved-marks.mjs', 'origin.mjs', 'namespace.mjs', 'engine.js', 'kanji-1024-v1.2.json'])
    fs.copyFileSync(path.join(MARK, f), path.join(dst, f));
  fs.cpSync(SIGN_LIB, path.join(W.core, 'skills', 'bonsai-garden-sign', 'lib'), { recursive: true });
  fs.copyFileSync(
    path.join(SIGN_LIB, '..', 'seal-policy.json'),
    path.join(W.core, 'skills', 'bonsai-garden-sign', 'seal-policy.json'),
  );
  return path.join(dst, 'reserved-marks.mjs');
}

// ── run ──────────────────────────────────────────────────────────────────────

if (argv.includes('--list')) {
  for (const c of cases) console.log(c.name);
  process.exit(0);
}
let failed = 0,
  ran = 0;
for (const c of cases) {
  if (only && !only.includes(c.name)) continue;
  ran++;
  const before = NET;
  let ok = false,
    why = '';
  try {
    [ok, why] = await c.fn();
  } catch (e) {
    ok = false;
    why = `threw: ${String(e?.message).split('\n')[0]}`;
  }
  if (NET !== before) {
    ok = false;
    why = `TOUCHED THE NETWORK (${NET - before} call(s)); ${why}`;
  }
  console.log(`${ok === true ? 'PASS' : 'FAIL'}  ${c.name}${why ? `  — ${why}` : ''}`);
  if (ok !== true) failed++;
}
console.log(`\n${ran - failed}/${ran} passed${failed ? ` — ${failed} FAILED` : ''}   (scratch: ${SCRATCH})`);
process.exit(failed ? 1 : 0);
