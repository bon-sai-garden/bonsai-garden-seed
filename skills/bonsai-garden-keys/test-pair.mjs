// ---
// id: 01M5MVSSWM7QB0E6EEZA91HSW9
// title: The pair in kanji or by index, and one answer to whether it is free, tested as properties
// type: script
// tended-by: mori-shin
// created: 2026-10-23
// updated: 2026-10-23
// ---
//
// test-pair.mjs — lib/pair.mjs, `identity --pair-index` and `check-pair` (B10-44, B10-47, 2026-10-23).
//
//   node skills/bonsai-garden-keys/test-pair.mjs              every case
//   node skills/bonsai-garden-keys/test-pair.mjs --only a,b   the named cases
//   node skills/bonsai-garden-keys/test-pair.mjs --list       the case names
//   node skills/bonsai-garden-keys/test-pair.mjs --mutants    each guard broken in a scratch copy of core, beside an
//                                                              unbroken control: every case it names must go red
//   PAIR_TEST_SRC_CORE=<a core> node ... test-pair.mjs        the cases against another core (the mutants use this;
//                                                              so does watching the cases red on a core before the change)
//
// Two kinds of case. In process: lib/pair.mjs against a rule read from the REAL shipped reserved-marks.json by the
// reader's own offline parse (the words are tested on the real sets; the origin's word is the binary's business).
// Through the binary: test-support.mjs's scratch world, a fake bon-sai.garden and the lab preview's file custody, never
// the gardener's keychain, master salt or network. Two worlds: test-support's planted rule (a throwaway set A), and
// one carrying the real shipped set's bytes, sealed by a second THROWAWAY key under mori-shin's slug that the fake site
// holds in place of the first, so `identity` and `check-pair` read the rule the gardener's copy reads (清身 is reserved
// there: 清 in set A, 身 in set B). Every case reads one property, never a line of the code.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.env.PAIR_TEST_SRC_CORE ? path.resolve(process.env.PAIR_TEST_SRC_CORE) : path.resolve(HERE, '..', '..');
const REAL_SET = path.resolve(HERE, '..', 'bonsai-garden-mark', 'reserved-marks.json'); // this checkout's, always
const { makeWorld, PASS, pp } = await import(pathToFileURL(path.join(HERE, 'test-support.mjs')).href);
const TMP = fs.mkdtempSync(path.join(process.env.KEYS_TEST_TMP || os.tmpdir(), 'pair-test-'));
const argv = process.argv.slice(2);
const lib = (rel) => import(pathToFileURL(path.join(SRC, 'skills', rel)).href);
const SET = JSON.parse(fs.readFileSync(path.join(SRC, 'skills', 'bonsai-garden-mark', 'kanji-1024-v1.2.json'), 'utf8'))
  .kanji;
const idx = (c) => SET.findIndex((k) => k.char === c);
const ch = (p) => p.map((i) => SET[i].char).join('');

/** The real shipped set, read by the reader's offline parse: its sets and the rule over them. */
async function realRule() {
  const RM = await lib('bonsai-garden-mark/reserved-marks.mjs');
  const sets = RM.parseReserved(fs.readFileSync(REAL_SET, 'utf8'));
  return { rule: RM.ruleOf(sets), sets };
}

// ── worlds ─────────────────────────────────────────────────────────────────────

/** A world through namespace (lab preview), with the real shipped set planted when `real`. */
async function namespaced({ real = false } = {}) {
  const W = await makeWorld({ srcCore: SRC, tmp: TMP, label: real ? 'real' : 'planted', signers: real ? ['mori-shin'] : [] });
  if (real) {
    const rule = path.join(W.core, 'skills', 'bonsai-garden-mark', 'reserved-marks.json');
    fs.copyFileSync(REAL_SET, rule);
    await W.seal(rule, 'mori-shin', { target: 'skills/bonsai-garden-mark/reserved-marks.json' });
  }
  const pot = W.newPot();
  const step = (args, input = pp(PASS)) => {
    const r = W.run(args, { input });
    if (r.code !== 0) throw new Error(`${args[0]} exited ${r.code}: ${(r.stderr || r.stdout).trim().split('\n').pop()}`);
  };
  step(['id', '--pot', pot, '--name', 'marta', '--gardener', 'ana', '--shin', 'kiko'], '');
  step(['mint', '--pot', pot, '--lab-preview', ...W.B], pp(PASS, PASS));
  const exp = path.join(W.dir, 'export.sealed');
  step(['recover', 'export', '--pot', pot, '--out', exp, ...W.B], pp(PASS, `${PASS}-x`, `${PASS}-x`));
  step(['recover', 'drill', '--pot', pot, '--file', exp, '--passphrase-stdin'], pp(`${PASS}-x`));
  step(['namespace', '--pot', pot, ...W.B]);
  return { W, pot };
}
const identity = (W, pot, slug, more) =>
  W.run(['identity', slug, '--pot', pot, '--fp-attests', '1', ...W.B, ...more], { input: pp(PASS) });
const checkPair = (W, more, env = {}) => W.run(['check-pair', ...more], { env });
const lockOf = (pot, slug) => {
  const f = path.join(pot, 'locked-salts.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).agents?.[slug] || null : null;
};
const asked = (W) => W.siteAsked().lines.filter((l) => l.startsWith('ASK')).length;
/** check-pair's lines, without the one that names the form the pair came in. */
const sansForm = (out) =>
  out
    .split('\n')
    .filter((l) => !/given as --pair/.test(l))
    .join('\n');

// ── cases ──────────────────────────────────────────────────────────────────────

const cases = [];
const t = (name, fn) => cases.push({ name, fn });

t('kanji-and-index-forms-resolve-to-the-same-pair', async () => {
  const P = await lib('bonsai-garden-keys/lib/pair.mjs');
  const { rule } = await realRule();
  const pairs = ['清身', '真心', '助手', '〇心', `盆${SET[79].char}`, '水森'];
  const off = [];
  for (const k of pairs) {
    const a = P.resolvePair({ pair: k });
    const want = [...k].map(idx);
    const b = P.resolvePair({ 'pair-index': want.join(',') });
    const fa = JSON.stringify(P.pairFindings({ pair: a.pair, rule }));
    const fb = JSON.stringify(P.pairFindings({ pair: b.pair, rule }));
    if (JSON.stringify(a.pair) !== JSON.stringify(want) || JSON.stringify(b.pair) !== JSON.stringify(want) || fa !== fb)
      off.push(k);
  }
  return [off.length === 0, off.length ? `differ: ${off.join(' ')}` : `${pairs.length} pairs, the same indices and findings`];
});

t('an-out-of-range-or-malformed-index-is-refused', async () => {
  const P = await lib('bonsai-garden-keys/lib/pair.mjs');
  const bad = ['1024,5', '5,1024', '9999,1', '-1,5', '5', '5,6,7', 'a,b', '05,6', '5, 6', ' 5,6', '', '5,'];
  const wrong = [];
  for (const v of bad) {
    try {
      P.resolvePair({ 'pair-index': v });
      wrong.push(`${JSON.stringify(v)} taken`);
    } catch (e) {
      if (!(e instanceof P.PairError) || e.exit !== 2) wrong.push(`${JSON.stringify(v)} exit ${e.exit}`);
    }
  }
  const edges = [
    ['0,1023', [0, 1023]],
    ['1023,0', [1023, 0]],
  ].filter(([v, want]) => JSON.stringify(P.resolvePair({ 'pair-index': v }).pair) !== JSON.stringify(want));
  let both = null;
  try {
    P.resolvePair({ pair: '真心', 'pair-index': '319,79' });
  } catch (e) {
    both = e.exit;
  }
  return [
    !wrong.length && !edges.length && both === 64,
    `${bad.length - wrong.length}/${bad.length} refused (2)${wrong.length ? `; ${wrong.join(', ')}` : ''}; edges ${edges.length ? 'WRONG' : 'ok'}; both forms ${both}`,
  ];
});

t('the-reason-names-which-kanji-is-in-which-set', async () => {
  const P = await lib('bonsai-garden-keys/lib/pair.mjs');
  const { rule, sets } = await realRule();
  const qs = [idx('清'), idx('身')];
  const f = P.pairFindings({ pair: qs, rule });
  const ab = f.length === 1 && f[0].kind === 'reserved' && /清 \(510\) is in set A/.test(f[0].words) && /身 \(5\) is in set B/.test(f[0].words);
  const wild = P.pairFindings({ pair: [0, idx('心')], rule });
  const wc = wild.length === 1 && wild[0].kind === 'reserved' && /^〇 \(0\) is the wildcard/.test(wild[0].words);
  const bon = P.pairFindings({ pair: [idx('盆'), idx('心')], rule });
  const bf = bon.length === 1 && bon[0].kind === 'bon-first' && /盆/.test(bon[0].words);
  const free = ['真心', '助手', '清心', '真身'].filter((k) => P.pairFindings({ pair: [...k].map(idx), rule }).length);
  // the words never decide: a reason the rule gives in a form this file does not know is passed on, not dropped
  const odd = P.pairFindings({ pair: [idx('真'), idx('心')], rule: { reserved: () => 'a reason of another form' } });
  const passed = odd.length === 1 && /a reason of another form/.test(odd[0].words);
  const facts = sets.A.has(510) && sets.B.has(5);
  return [
    facts && ab && wc && bf && !free.length && passed,
    `清身 ${ab ? 'A×B named' : 'WRONG'}, 〇 ${wc ? 'wildcard' : 'WRONG'}, 盆 ${bf ? 'first' : 'WRONG'}, free ${free.length ? `WRONG: ${free}` : '4/4'}, unknown form ${passed ? 'passed on' : 'DROPPED'}`,
  ];
});

t('a-taken-pair-names-its-holder', async () => {
  const P = await lib('bonsai-garden-keys/lib/pair.mjs');
  const locks = { agents: { ana: { identity_pair: [21, 70] } } };
  const a = P.takenFinding([21, 70], locks);
  const b = P.takenFinding([70, 21], locks);
  const none = P.pairFindings({ pair: [21, 70], rule: { reserved: () => null } }); // no locks: not asked
  return [a?.kind === 'taken' && /by ana/.test(a.words) && b === null && !none.some((x) => x.kind === 'taken'), `${a?.words}`];
});

t('identity-refuses-qingshen-on-the-real-set-and-locks-nothing', async () => {
  // the confirmation B10-47 asks for: the identity step refuses 清身 under the shipped rule, before and after a pick.
  // Kanji only, so the same case runs on a core from before --pair-index (the index form is the table's, below).
  const { W, pot } = await namespaced({ real: true });
  const c = identity(W, pot, 'ana', ['--pair', '清身', '--candidates']);
  const k = identity(W, pot, 'ana', ['--pair', '清身', '--pick', '1']);
  return [
    c.code === 2 && k.code === 2 && /set A/.test(k.stderr) && !lockOf(pot, 'ana'),
    `--candidates exit ${c.code}, --pick 1 exit ${k.code}: ${k.stderr.trim().slice(0, 110)}; locked ${!!lockOf(pot, 'ana')}`,
  ];
});

t('identity-and-check-pair-give-the-same-reason', async () => {
  const { W, pot } = await namespaced({ real: true });
  const id = identity(W, pot, 'ana', ['--pair', '清身', '--candidates']);
  const cp = checkPair(W, ['--pair', '清身']);
  const reason = cp.stdout.split('\n').find((l) => /is in set A/.test(l))?.trim();
  return [
    cp.code === 1 &&
      /^reserved {2}清身 {2}510,5$/m.test(cp.stdout) &&
      !!reason &&
      /清 \(510\) is in set A and 身 \(5\) is in set B/.test(reason) &&
      id.code === 2 &&
      id.stderr.includes(reason),
    `check-pair exit ${cp.code}, identity exit ${id.code}, same words ${!!reason && id.stderr.includes(reason)}`,
  ];
});

t('check-pair-answers-the-same-for-kanji-and-index', async () => {
  const { W } = await namespaced({ real: true });
  const rows = [
    ['清身', '510,5', 1],
    ['真心', '319,79', 0],
    ['助手', '251,20', 0],
  ];
  const off = [];
  for (const [k, n, want] of rows) {
    const a = checkPair(W, ['--pair', k]);
    const b = checkPair(W, ['--pair-index', n]);
    if (a.code !== want || b.code !== want || sansForm(a.stdout) !== sansForm(b.stdout)) off.push(`${k} ${a.code}/${b.code}`);
  }
  return [off.length === 0, off.length ? off.join(', ') : `${rows.length} pairs, one answer each`];
});

t('identity-and-check-pair-agree-on-every-pair-of-a-table', async () => {
  // the drift gate between the two verbs: one verdict for each pair, from either
  const { W, pot } = await namespaced({ real: true });
  const { sets } = await realRule();
  const A = [...sets.A].sort((x, y) => x - y),
    B = [...sets.B].sort((x, y) => x - y);
  const notB = [...Array(1024).keys()].find((i) => i > 0 && !sets.B.has(i) && !sets.wildcard.has(i));
  const notA = [...Array(1024).keys()].find((i) => i > 0 && !sets.A.has(i) && !sets.wildcard.has(i) && SET[i].char !== '盆');
  const table = [
    [A[0], B[0]],
    [A[A.length - 1], B[B.length - 1]],
    [A[1], notB],
    [notA, B[1]],
    [notA, notB],
    [0, notB],
    [notA, 0],
    [idx('盆'), notB],
  ];
  const off = [];
  for (const p of table) {
    const cp = checkPair(W, ['--pair-index', p.join(',')]);
    const id = identity(W, pot, 'ana', ['--pair-index', p.join(','), '--candidates']);
    const free = cp.code === 0;
    if (!((free && id.code === 0) || (!free && cp.code === 1 && id.code === 2))) off.push(`${ch(p)} check ${cp.code} identity ${id.code}`);
  }
  const locked = !!lockOf(pot, 'ana');
  return [!off.length && !locked, off.length ? off.join('; ') : `${table.length} pairs agree; nothing locked`];
});

t('identity-takes-the-pair-by-index-and-echoes-it-before-the-lock', async () => {
  const { W, pot } = await namespaced();
  const byKanji = identity(W, pot, 'ana', ['--pair', '水森', '--candidates']);
  const byIndex = identity(W, pot, 'ana', ['--pair-index', '21,70', '--candidates']);
  const five = (o) => o.split('\n').filter((l) => /^\s*[1-5]\s+\S{4}\s+\S+\s*$/.test(l));
  const same = five(byKanji.stdout).length === 5 && five(byKanji.stdout).join() === five(byIndex.stdout).join();
  const hint = /--pair-index 21,70 --pick <1-5>/.test(byIndex.stdout);
  const lock = identity(W, pot, 'ana', ['--pair-index', '21,70', '--pick', '2']);
  const lines = lock.stdout.split('\n');
  const echo = lines.findIndex((l) => /^pair: 水森 {2}21,70 {2}\(水 21, 森 70; given as --pair-index\)$/.test(l));
  const locked = lines.findIndex((l) => /^ana: 水森/.test(l));
  const e = lockOf(pot, 'ana');
  return [
    byIndex.code === 0 && same && hint && lock.code === 0 && echo >= 0 && locked > echo && JSON.stringify(e?.identity_pair) === '[21,70]' && e?.picked === 2,
    `candidates same ${same}, hint ${hint}, lock exit ${lock.code}, echo at ${echo} before lock at ${locked}`,
  ];
});

t('identity-refuses-a-bad-index-before-asking-and-writes-nothing', async () => {
  const { W, pot } = await namespaced();
  const before = asked(W);
  const lockBefore = fs.readFileSync(path.join(pot, 'locked-salts.json'));
  const r = [
    identity(W, pot, 'ana', ['--pair-index', '1024,70']),
    identity(W, pot, 'ana', ['--pair-index', '21,1024', '--pick', '1']),
    identity(W, pot, 'ana', ['--pair-index', '21;70']),
  ];
  const both = identity(W, pot, 'ana', ['--pair', '水森', '--pair-index', '21,70']);
  const unchanged = lockBefore.equals(fs.readFileSync(path.join(pot, 'locked-salts.json')));
  return [
    r.every((x) => x.code === 2) && both.code === 64 && asked(W) === before && unchanged,
    `exits ${r.map((x) => x.code)}, both forms ${both.code}, origin asked ${asked(W) - before} more, locks unchanged ${unchanged}`,
  ];
});

t('the-guardian-takes-no-pair-in-either-form', async () => {
  // spec §7.1: bonsai-shin's pair is drawn, never chosen; the index form is no way round that
  const { W, pot } = await namespaced();
  const k = identity(W, pot, 'bonsai-shin', ['--pair', '水森', '--candidates']);
  const i = identity(W, pot, 'bonsai-shin', ['--pair-index', '21,70', '--candidates']);
  const drawn = identity(W, pot, 'bonsai-shin', ['--candidates']);
  return [
    k.code === 2 && i.code === 2 && /does not choose a pair/.test(i.stderr) && drawn.code === 0 && !lockOf(pot, 'bonsai-shin'),
    `--pair ${k.code}, --pair-index ${i.code}, drawn ${drawn.code}`,
  ];
});

t('check-pair-with-a-pot-names-a-taken-pair', async () => {
  const { W, pot } = await namespaced();
  const lock = identity(W, pot, 'ana', ['--pair-index', '21,70']);
  const withPot = checkPair(W, ['--pot', pot, '--pair-index', '21,70']);
  const without = checkPair(W, ['--pair-index', '21,70']);
  const notPot = checkPair(W, ['--pot', path.join(W.dir, 'no-such-pot'), '--pair-index', '21,70']);
  return [
    lock.code === 0 &&
      withPot.code === 1 &&
      /^taken {2}水森 {2}21,70$/m.test(withPot.stdout) &&
      /taken in this garden by ana/.test(withPot.stdout) &&
      without.code === 0 &&
      notPot.code === 2,
    `with --pot ${withPot.code}, without ${without.code}, not a pot ${notPot.code}`,
  ];
});

t('check-pair-halts-when-the-origin-cannot-be-reached', async () => {
  const { W } = await namespaced();
  const r = checkPair(W, ['--pair', '真心'], { KEYS_TEST_SITE_MODE: 'unreachable' });
  const n = checkPair(W, ['--pair', '真心'], { KEYS_TEST_SITE_MODE: 'rejected' });
  return [
    r.code === 3 && n.code === 2 && !/^free/m.test(r.stdout + n.stdout),
    `unreachable ${r.code}, not vouched ${n.code}`,
  ];
});

t('check-pair-reads-no-custody-and-writes-nothing', async () => {
  const { W, pot } = await namespaced();
  const snap = (d) =>
    fs
      .readdirSync(d, { recursive: true })
      .filter((f) => !String(f).startsWith('.git'))
      .sort()
      .map((f) => {
        const p = path.join(d, String(f));
        return fs.statSync(p).isFile() ? `${f}:${fs.readFileSync(p).toString('base64')}` : String(f);
      })
      .join('\n');
  const before = snap(pot);
  const homeBefore = snap(W.home);
  // no passphrase on stdin: a verb that opened the file custody would have to ask for one
  const r = checkPair(W, ['--pot', pot, '--pair', '真心']);
  const extra = checkPair(W, ['清身']);
  return [
    r.code === 0 && before === snap(pot) && homeBefore === snap(W.home) && extra.code === 64,
    `exit ${r.code}, pot unchanged ${before === snap(pot)}, home unchanged ${homeBefore === snap(W.home)}, a bare word ${extra.code}`,
  ];
});

// ── mutants: each guard broken in a scratch copy of core, watched to fail ───────

const PR = 'skills/bonsai-garden-keys/lib/pair.mjs';
const KB = 'skills/bonsai-garden-keys/bin/keys.mjs';
const MUTANTS = [
  [
    'reserved-rule-not-asked',
    [[PR, '  const words = reservedWords(pair, rule.reserved(pair));', '  const words = null;']],
    [
      'the-reason-names-which-kanji-is-in-which-set',
      'identity-refuses-qingshen-on-the-real-set-and-locks-nothing',
      'identity-and-check-pair-give-the-same-reason',
    ],
  ],
  [
    'unknown-reason-dropped',
    [[PR, '  return `${why}, in the first namespace`;', '  return null;']],
    ['the-reason-names-which-kanji-is-in-which-set'],
  ],
  [
    'index-range-unchecked',
    [[PR, '    if (i >= size)', '    if (false)']],
    ['an-out-of-range-or-malformed-index-is-refused', 'identity-refuses-a-bad-index-before-asking-and-writes-nothing'],
  ],
  [
    'index-off-by-one',
    [[PR, '  const idx = [Number(m[1]), Number(m[2])];', '  const idx = [Number(m[1]), Number(m[2]) + 1];']],
    ['kanji-and-index-forms-resolve-to-the-same-pair', 'check-pair-answers-the-same-for-kanji-and-index'],
  ],
  [
    'both-forms-taken',
    [[PR, '  if (byKanji && byIndex)', '  if (false)']],
    ['an-out-of-range-or-malformed-index-is-refused'],
  ],
  [
    'taken-not-asked',
    [[PR, '    if (JSON.stringify(e.identity_pair) === JSON.stringify(pair))', '    if (false)']],
    ['a-taken-pair-names-its-holder', 'check-pair-with-a-pot-names-a-taken-pair'],
  ],
  [
    'check-pair-says-free-for-everything',
    [[KB, '  const found = pairFindings({ pair, rule: ex, locks });', '  const found = [];']],
    ['identity-and-check-pair-give-the-same-reason', 'identity-and-check-pair-agree-on-every-pair-of-a-table'],
  ],
  [
    'identity-skips-the-rule',
    [[KB, '    const why = ruleFinding(pair, ex)?.words;', '    const why = null;']],
    ['identity-refuses-qingshen-on-the-real-set-and-locks-nothing', 'identity-and-check-pair-agree-on-every-pair-of-a-table'],
  ],
  [
    'identity-echo-dropped',
    [[KB, '    console.log(pairLine(given.pair, given.form));', '']],
    ['identity-takes-the-pair-by-index-and-echoes-it-before-the-lock'],
  ],
  [
    'guardian-takes-an-index',
    [[KB, "    if (ctx.f.pair !== undefined || ctx.f['pair-index'] !== undefined)", '    if (ctx.f.pair !== undefined)']],
    ['the-guardian-takes-no-pair-in-either-form'],
  ],
  [
    'pair-read-after-the-origin',
    [
      [KB, '  const given = guardian ? null : pairFrom(ctx.f);\n  if (!guardian) {', '  let given = null;\n  if (false) {'],
      [KB, '  } else {\n    pair = given.pair;', '  } else {\n    given = pairFrom(ctx.f);\n    pair = given.pair;'],
    ],
    ['identity-refuses-a-bad-index-before-asking-and-writes-nothing'],
  ],
];

if (argv.includes('--list')) {
  for (const c of cases) console.log(c.name);
  process.exit(0);
}

if (argv.includes('--mutants')) {
  const pick = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
  let bad = 0;
  const all = [...new Set(MUTANTS.flatMap((m) => m[2]))];
  for (const [name, edits, names, wantGreen] of [['(control: no edit)', [], all, true], ...MUTANTS]) {
    if (pick && !pick.includes(name)) continue;
    const core = fs.mkdtempSync(path.join(TMP, `mutant-${name.replace(/\W+/g, '-')}-`));
    for (const sk of ['bonsai-garden-keys', 'bonsai-garden-sign', 'bonsai-garden-mark'])
      fs.cpSync(path.join(SRC, 'skills', sk), path.join(core, 'skills', sk), { recursive: true });
    fs.mkdirSync(path.join(core, 'tools'), { recursive: true });
    fs.copyFileSync(path.join(SRC, 'tools', 'ulid.py'), path.join(core, 'tools', 'ulid.py'));
    let harness = null;
    for (const [file, find, repl] of edits) {
      const f = path.join(core, file),
        s = fs.readFileSync(f, 'utf8');
      if (s.split(find).length !== 2) {
        harness = `replacement matched ${s.split(find).length - 1} times, not once: ${find.slice(0, 60)}`;
        break;
      }
      fs.writeFileSync(
        f,
        s.replace(find, () => repl),
      );
    }
    let verdict;
    if (harness) verdict = `HARNESS ERROR: ${harness}`;
    else {
      const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--only', names.join(',')], {
        env: { ...process.env, PAIR_TEST_SRC_CORE: core, KEYS_TEST_TMP: TMP },
        encoding: 'utf8',
        timeout: 900000,
      });
      const res = names.map((n) => (new RegExp(`^(PASS|FAIL)  ${n}(\\s|$)`, 'm').exec(r.stdout) || [null, '?'])[1]);
      if (wantGreen)
        verdict = res.every((x) => x === 'PASS') ? 'GREEN' : `CONTROL RED (${names.filter((_, i) => res[i] !== 'PASS').join(', ')})`;
      else
        verdict = res.every((x) => x === 'FAIL') ? 'KILLED' : `SURVIVED (${names.map((n, i) => `${n} ${res[i]}`).join(', ')})`;
    }
    if (verdict !== (wantGreen ? 'GREEN' : 'KILLED')) bad++;
    console.log(`${name.padEnd(38)}${verdict}   ${names.join(', ')}`);
  }
  console.log(`\n${bad ? `${bad} mutant(s) not killed` : 'every mutant killed'}`);
  fs.rmSync(TMP, { recursive: true, force: true }); // this run's own scratch, made above
  process.exit(bad ? 1 : 0);
}

const pick = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
let failed = 0,
  ran = 0;
for (const c of cases) {
  if (pick && !pick.includes(c.name)) continue;
  let ok = false,
    why = '';
  try {
    [ok, why] = await c.fn();
  } catch (e) {
    ok = false;
    why = `threw: ${String(e.message).split('\n')[0]}`;
  }
  ran++;
  console.log(`${ok === true ? 'PASS' : 'FAIL'}  ${c.name}${why ? `  — ${why}` : ''}`);
  if (ok !== true) failed++;
}
console.log(`\n${ran - failed}/${ran} passed${failed ? ` — ${failed} FAILED` : ''}`);
if (!process.env.KEYS_TEST_TMP) fs.rmSync(TMP, { recursive: true, force: true }); // this run's own scratch, made above
process.exit(failed ? 1 : 0);
