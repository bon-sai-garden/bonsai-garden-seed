// ---
// id: 01M4Z27XPV5T9JBCRQ67WY8XMY
// title: fill-bodies, tested by planting each violation: one fixture pot per check C1–C9, a clean pot that passes, every refusal
// type: script
// tended-by: baisai
// created: 2026-10-15
// updated: 2026-10-20
// ---
//
// test-fill-bodies.mjs — planting 7c (Bonsai's spec, 2026-10-15): `keys.mjs fill-bodies` writes the outcome into
// the bodies, and `--check` refuses a pot where a copy drifted. Each check has its own fixture pot holding exactly
// the violation it is meant to catch, and the case passes only when --check fails on that check and no other; a
// clean pot, filled, passes. A check that has not been seen to refuse its own fixture is not trusted, so
// `--mutants` breaks each check in a scratch copy of core and watches its case go red.
//
// Fixtures are built here, in a scratch directory, in the shape `seed` writes (bin/keys.mjs cmdSeed's `shaped`)
// and with key files where `derive` puts them (lib/garden.mjs writeKey). Every key is THROWAWAY: 32 random bytes
// made in this run, standing in for a public key, never a garden's real one; each fixture pot carries a file that
// says so (outside the bodies and the registry, which the checks read). C3's fixture is the one place a foreign
// 32-hex string is planted on purpose. No custody, no network (the binary runs with a fetch that throws), and
// BONSAI_GARDEN points at nothing.
//
//   node skills/bonsai-garden-keys/test-fill-bodies.mjs              every case
//   node skills/bonsai-garden-keys/test-fill-bodies.mjs --list
//   node skills/bonsai-garden-keys/test-fill-bodies.mjs --only a,b
//   node skills/bonsai-garden-keys/test-fill-bodies.mjs --mutants    each check broken in a scratch copy: its case must go red
//   FILL_BODIES_SRC_CORE=<a core checkout> node ...                  run the cases against another core

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.env.FILL_BODIES_SRC_CORE
  ? path.resolve(process.env.FILL_BODIES_SRC_CORE)
  : path.resolve(HERE, '..', '..');
const KEYS = path.join(SRC, 'skills', 'bonsai-garden-keys', 'bin', 'keys.mjs');
const G = await import(path.join(SRC, 'skills', 'bonsai-garden-keys', 'lib', 'garden.mjs'));
const { newUlid } = await import(path.join(SRC, 'skills', 'bonsai-garden-sign', 'lib', 'ulid-rule.mjs'));
const SET = JSON.parse(
  fs.readFileSync(path.join(SRC, 'skills', 'bonsai-garden-mark', 'kanji-1024-v1.2.json'), 'utf8'),
).kanji;
const argv = process.argv.slice(2);
const TMP = fs.mkdtempSync(path.join(process.env.KEYS_TEST_TMP || os.tmpdir(), 'fill-bodies-'));
const UNREACHABLE = '/nonexistent/mono-is-unreachable-in-this-run';
const NOFETCH =
  'data:text/javascript,globalThis.fetch=()=>{throw new Error("NETWORK: fill-bodies reached for the network")}';
const ENV = { PATH: process.env.PATH, HOME: TMP, BONSAI_GARDEN: UNREACHABLE };

const run = (args) => {
  const r = spawnSync(process.execPath, ['--import', NOFETCH, KEYS, ...args], { cwd: TMP, env: ENV, encoding: 'utf8' });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
};
const fill = (p) => run(['fill-bodies', '--pot', p.pot, '--choices', p.choices]);
const check = (p) => run(['fill-bodies', '--check', '--pot', p.pot, '--choices', p.choices]);
/** [check, file:line] for every finding --check printed. */
const findings = (r) =>
  r.out
    .split('\n')
    .map((l) => /^\s+(C\d+)\s+(\S+)\s/.exec(l))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]);
const only = (r, c, file) => {
  const f = findings(r);
  return (
    r.code === 1 &&
    f.length > 0 &&
    f.every(([x, at]) => x === c && /:\d+$/.test(at) && (!file || at.startsWith(`${file}:`)))
  );
};
const show = (r) =>
  `exit ${r.code}: ${
    findings(r)
      .map((x) => x.join(' '))
      .join(', ') || (r.err || r.out).trim().split('\n').pop()
  }`.slice(0, 220);

/** sha256 of every file under a pot: the test's own before/after, independent of the tool's. */
function hashes(dir) {
  const m = new Map();
  const go = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) go(p);
      else
        m.set(
          path.relative(dir, p).split(path.sep).join('/'),
          crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),
        );
    }
  };
  go(dir);
  return m;
}
const diff = (a, b) => ({
  changed: [...b]
    .filter(([k, v]) => a.has(k) && a.get(k) !== v)
    .map(([k]) => k)
    .sort(),
  added: [...b.keys()].filter((k) => !a.has(k)).sort(),
  gone: [...a.keys()].filter((k) => !b.has(k)).sort(),
});
const reported = (r, verb) =>
  r.out
    .split('\n')
    .map((l) => new RegExp(`^\\s+${verb}\\s+(\\S+)`).exec(l))
    .filter(Boolean)
    .map((m) => m[1])
    .sort();

// ── fixtures ─────────────────────────────────────────────────────────────────

const throwawayKey = () => {
  const raw = crypto.randomBytes(32);
  return { raw, fingerprint: crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32) };
};
const kanji4 = () => Array.from({ length: 4 }, () => SET[100 + crypto.randomInt(800)].char).join('');
let potN = 0;

/**
 * A pot as 6.8 and 7b leave it: garden.json, a seeded registry, every key on file, and two bodies (the companion
 * and the guardian) carrying {{planting.*}} tokens. `slugs` names the garden's own; nothing in the tool knows them.
 */
function build({ lab = false, slugs = {}, vouched = true } = {}) {
  const S = { root: 'marta', gardener: 'ana', origin: 'bonsai', guardian: 'bonsai-shin', shin: 'kiko', ...slugs };
  const pot = path.join(TMP, `pot${++potN}`);
  fs.mkdirSync(pot, { recursive: true });
  fs.writeFileSync(
    path.join(pot, 'FIXTURE-THROWAWAY-KEYS.txt'),
    "THROWAWAY: every key in this fixture pot is 32 random bytes made by test-fill-bodies.mjs; none is a garden's.\n",
  );
  const garden = newUlid(),
    tier = lab ? 'software-fallback' : 'os-protected';
  const K = Object.fromEntries(Object.values(S).map((s) => [s, throwawayKey()]));
  const g = {
    garden,
    name: S.root,
    gardener: S.gardener,
    shin: S.shin,
    namespace: {
      kanji: `${SET[300].char}${SET[301].char}庭`,
      indices: [300, 301, 322],
      salt: `${S.root}#1`,
      locked_at: '2026-10-15T00:00:00.000Z',
    },
    'root-fingerprint': K[S.root].fingerprint,
    'root-public-key': K[S.root].raw.toString('base64'),
    'custody-tier': tier,
    'lab-preview': lab,
    created: '2026-10-15',
    'recovery-drilled': '2026-10-15',
  };
  fs.writeFileSync(G.P.garden(pot), G.jsonText(g));
  // the registry, field for field in the order cmdSeed's `shaped` writes it
  const shaped = (slug, type, extra = {}) => {
    const k = slug === S.root ? g.namespace.kanji : kanji4();
    const out = {
      slug,
      name: slug,
      kanji: k,
      'kanji-chars': [...k],
      pronouns: slug === S.root ? null : 'they/them', // seed's own default since F-26: never a blank
      type,
      shintai: slug === S.root || type === 'gardener' ? 'none' : type === 'seed' ? 'origin' : 'own',
      parent: extra.parent || null,
      principal: null,
      status: 'active',
      direction: null,
      guardian: null,
      element: null,
      fp8: K[slug].fingerprint.slice(0, 8),
      fingerprint: K[slug].fingerprint,
      'fp-attests': slug === S.root ? 0 : 2,
      'custody-tier': tier,
    };
    if (extra.origin) {
      out.origin = true;
      if (vouched) out.vouched = '2026-10-15T00:00:00.000Z';
      delete out['custody-tier'];
    }
    return { ...out, 'accent-rgba': null, 'mark-url': null, 'one-line': null, tagline: null, path: `agents/${slug}` };
  };
  const reg = {
    $schema: 'https://bon-sai.garden/schemas/agent-registry-v1.json',
    _meta: {
      id: newUlid(),
      description: `${S.root}: the garden's one registry, keys and roster together, in the origin garden's shape. Key fields as seed wrote them; the display fields are the garden's to fill.`,
      version: '1.0.0',
      created: '2026-10-15',
      'tended-by': S.gardener,
      garden,
    },
    garden,
    agents: [
      shaped(S.root, 'garden'),
      shaped(S.gardener, 'gardener'),
      shaped(S.origin, 'seed', { origin: true }),
      shaped(S.guardian, 'shin', { parent: S.origin }),
      shaped(S.shin, 'shin'),
    ],
  };
  fs.mkdirSync(path.dirname(G.P.registry(pot)), { recursive: true });
  fs.writeFileSync(G.P.registry(pot), G.jsonText(reg));
  for (const s of Object.values(S)) G.writeKey(pot, s, K[s].raw, K[s].fingerprint);
  const origin = reg.agents.find((a) => a.origin);
  for (const [slug, guardian] of [
    [S.shin, false],
    [S.guardian, true],
  ])
    writeBody(pot, slug, { lab, guardian, originFp: origin.fingerprint });
  const a = (s) => reg.agents.find((x) => x.slug === s);
  const choices = {
    garden,
    kin: {
      [S.shin]: {
        name: 'Kiko',
        pronouns: 'she/her',
        accent: '#6e913c',
        'one-line': 'Keeper of the little elm',
        tagline: 'I keep the last fruit for later.',
        line: 'Walk slowly.',
        memory: 'skeleton',
        portrait: 'brief',
        'displayed-pair': a(S.shin).kanji.slice(0, 2),
        version: '1.0.0',
        'previous-version': '0.9.0',
        'pending-removal': 'yes',
      },
      [S.guardian]: {
        name: 'Mamori',
        pronouns: 'he/him',
        accent: '8A6A50',
        'one-line': 'Guardian of the garden',
        tagline: 'The gate stays where it is.',
        line: 'Walk with me?',
        memory: 'initial',
        portrait: 'redraw',
        'displayed-pair': a(S.guardian).kanji.slice(0, 2),
        version: '0.1.0',
      },
    },
  };
  const cf = path.join(TMP, `choices${potN}.json`);
  fs.writeFileSync(cf, `${JSON.stringify(choices, null, 2)}\n`);
  return { pot, choices: cf, S, g, reg, K, rel: (s, f) => `agents/${s}/${f}` };
}

function writeBody(pot, slug, { lab, guardian, originFp }) {
  const d = path.join(pot, 'agents', slug);
  const w = (f, t) => {
    fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true });
    fs.writeFileSync(path.join(d, f), t);
  };
  const fm = (title, type, extra = '') =>
    `---\nid: ${newUlid()}\ntitle: "${title}"\ntype: ${type}\ntended-by: {{planting.slug}}\ncreated: 2026-10-15\nupdated: 2026-10-15\n${extra}---\n`;
  w(
    'SKILL.md',
    '---\nname: {{planting.slug}}\ndescription: >\n  Activate {{planting.name}}, of {{planting.garden-name}}.\nversion: 0.0.0\n---\n' +
      '> **Integrity first.** When the harness names this garden\'s MCP, enter with `bonsai_session_start("{{planting.slug}}")` and read its `integrity:` line; ' +
      `when it names none, show the gardener \`{{planting.displayed-pair}} {{planting.fp8}}\` and let him confirm it.${lab ? " In this garden a pass is a rehearsal's, and says so." : ''}\n\n` +
      '# {{planting.name}}\n\n## Tagline\n\n> *"{{planting.line}}"*\n\nVersion history: `references/changelog.md`.\n',
  );
  w(
    'references/about-me.md',
    fm('About {{planting.name}}', 'constitution', 'version: 0.0.0\n') +
      '\n# About {{planting.name}}\n\nI am **{{planting.name}}**. My slug is `{{planting.slug}}`. I live in **{{planting.garden-name}}** ({{planting.namespace}}), the garden of the gardener (`{{planting.gardener}}`). ' +
      'My pronouns are {{planting.pronouns}}. My ID is **{{planting.id-kanji}}**.\n' +
      "My key was born from the garden's own root and is kept at {{planting.custody-tier}}; its fingerprint, `{{planting.fingerprint}}`, spells {{planting.fp-spells}} (it attests {{planting.fp-attests}}).\n\n" +
      'My colour is {{planting.accent}}. {{planting.one-line}}.\n',
  );
  w(
    'references/identity.md',
    fm('{{planting.name}} — identity', 'identity') +
      '\n| Field | Value |\n|---|---|\n| ID | **{{planting.id-kanji}}** |\n| Fingerprint | `{{planting.fingerprint}}` (attests {{planting.fp-attests}}: {{planting.fp-spells}}) |\n' +
      `| Custody | {{planting.custody-tier}}, the gardener's |\n| Pronouns | {{planting.pronouns}} |\n${guardian ? '| Parent | {{planting.parent}} |\n' : ''}`,
  );
  w(
    'references/heritage.md',
    fm('{{planting.name}} — heritage', 'lineage') +
      '\n**{{planting.id-kanji}}** · `{{planting.slug}}` · `{{planting.fp8}}` · {{planting.garden-name}} {{planting.namespace}}\n' +
      (guardian ? `\nDivided from {{planting.parent}}, whose key \`${originFp}\` the origin vouched for.\n` : ''),
  );
  w(
    'references/changelog.md',
    `${fm('{{planting.name}} — changelog', 'changelog')}\n- **0.9.0** — the body before this garden.\n`,
  );
  w('memory/MEMORY.md', `${fm('{{planting.name}} — memory', 'memory-index')}\nEmpty until the first session.\n`);
  w('identity/.pending', 'keys: derive has not run\n');
}

/** A filled copy of a fresh pot, for a fixture to plant one violation in. */
function filled(opts) {
  const p = build(opts);
  const r = fill(p);
  if (r.code !== 0) throw new Error(`the fill a fixture starts from exited ${r.code}: ${(r.err || r.out).trim()}`);
  return p;
}
const edit = (p, relPath, fn) => {
  const f = path.join(p.pot, relPath);
  fs.writeFileSync(f, fn(fs.readFileSync(f, 'utf8')));
};
const editReg = (p, fn) => {
  const reg = JSON.parse(fs.readFileSync(G.P.registry(p.pot), 'utf8'));
  fn(reg);
  fs.writeFileSync(G.P.registry(p.pot), G.jsonText(reg));
};
const editChoices = (p, fn) => {
  const c = JSON.parse(fs.readFileSync(p.choices, 'utf8'));
  fn(c);
  fs.writeFileSync(p.choices, `${JSON.stringify(c, null, 2)}\n`);
};

// ── cases ────────────────────────────────────────────────────────────────────

const cases = [];
const t = (name, fn) => cases.push({ name, fn });

t('clean-pot-fills-and-passes-check', () => {
  const p = build();
  const pre = check(p); // unfilled: tokens, .pending, null display fields
  const f = fill(p);
  const c = check(p);
  return [
    pre.code === 1 && f.code === 0 && c.code === 0 && /0 finding/.test(c.out),
    `before fill ${show(pre)} | fill ${f.code} | check ${show(c)}`,
  ];
});

t('clean-lab-pot-fills-and-passes-check', () => {
  const p = build({ lab: true });
  const f = fill(p),
    c = check(p);
  return [f.code === 0 && c.code === 0, `fill ${f.code} | check ${show(c)}`];
});

t('a-second-garden-with-other-slugs-passes-too', () => {
  // no slug lives in the tool: another garden, another origin slug, another guardian slug
  const p = build({ slugs: { root: 'osaka', gardener: 'ren', origin: 'elder', guardian: 'mori-ko', shin: 'mio' } });
  const f = fill(p),
    c = check(p);
  const skill = fs.readFileSync(path.join(p.pot, 'agents', 'mio', 'SKILL.md'), 'utf8');
  return [
    f.code === 0 && c.code === 0 && /^name: mio$/m.test(skill) && /^version: 1\.0\.0$/m.test(skill),
    `fill ${f.code} | check ${show(c)}`,
  ];
});

t('fill-writes-the-outcome-in', () => {
  const p = filled();
  const kiko = p.reg.agents.find((a) => a.slug === p.S.shin);
  const about = fs.readFileSync(path.join(p.pot, p.rel(p.S.shin, 'references/about-me.md')), 'utf8');
  const skill = fs.readFileSync(path.join(p.pot, p.rel(p.S.shin, 'SKILL.md')), 'utf8');
  const reg = JSON.parse(fs.readFileSync(G.P.registry(p.pot), 'utf8'));
  const k = reg.agents.find((a) => a.slug === p.S.shin),
    m = reg.agents.find((a) => a.slug === p.S.guardian);
  const spells = G.fpIndices(kiko.fingerprint, 2)
    .map((i) => SET[i].char)
    .join('');
  const keysSame =
    JSON.stringify(
      reg.agents.map((a) => [a.slug, a.fingerprint, a['fp-attests'], a['custody-tier'], a.parent, a.path]),
    ) ===
    JSON.stringify(
      p.reg.agents.map((a) => [a.slug, a.fingerprint, a['fp-attests'], a['custody-tier'], a.parent, a.path]),
    );
  const ok =
    !about.includes('{{planting.') &&
    about.includes(kiko.fingerprint) &&
    about.includes(`spells ${spells}`) &&
    /^version: 1\.0\.0$/m.test(about) &&
    /^version: 1\.0\.0$/m.test(skill) &&
    skill.includes(`${kiko.kanji.slice(0, 2)} ${kiko.fp8}`) &&
    k.name === 'Kiko' &&
    k['accent-rgba'] === 'rgba(110,145,60,0.35)' &&
    k['one-line'] === 'Keeper of the little elm' &&
    k.pronouns === 'she/her' &&
    m['accent-rgba'] === 'rgba(138,106,80,0.35)' &&
    keysSame &&
    !/\/Users\/|\/home\/|\/private\/|\/tmp\//.test(about + skill);
  return [
    ok,
    `fp-spells ${spells}, accent ${k['accent-rgba']} / ${m['accent-rgba']}, key fields untouched ${keysSame}`,
  ];
});

t('fill-is-idempotent-and-says-so', () => {
  const p = filled();
  const a = hashes(p.pot);
  const r = fill(p);
  const b = hashes(p.pot);
  const d = diff(a, b);
  return [
    r.code === 0 &&
      /nothing changed/.test(r.out) &&
      !d.changed.length &&
      !d.added.length &&
      !d.gone.length &&
      !/seal-staged/.test(r.out),
    `second fill ${r.code}: ${r.out.trim().split('\n')[0]}`,
  ];
});

t('the-report-is-the-hash-diff', () => {
  // the first fill, and a pot where one body was already filled by hand: the report names exactly what changed on disk
  const p = build();
  const a = hashes(p.pot);
  const r1 = fill(p);
  const d1 = diff(a, hashes(p.pot));
  const ok1 =
    JSON.stringify(reported(r1, 'wrote')) === JSON.stringify([...d1.changed, ...d1.added].sort()) &&
    JSON.stringify(reported(r1, 'deleted')) === JSON.stringify(d1.gone);
  const q = build();
  const q2 = path.join(TMP, `pot${++potN}-twin`); // q's twin, filled; three of its files carried back by hand
  fs.cpSync(q.pot, q2, { recursive: true });
  if (fill({ pot: q2, choices: q.choices }).code !== 0) throw new Error('the twin did not fill');
  for (const f of ['SKILL.md', 'references/about-me.md', 'references/identity.md'])
    fs.copyFileSync(path.join(q2, q.rel(q.S.shin, f)), path.join(q.pot, q.rel(q.S.shin, f)));
  const b = hashes(q.pot);
  const r2 = fill(q);
  const d2 = diff(b, hashes(q.pot));
  const w2 = reported(r2, 'wrote');
  const untouched = ['SKILL.md', 'references/about-me.md', 'references/identity.md']
    .map((f) => q.rel(q.S.shin, f))
    .filter((f) => !d2.changed.includes(f));
  const ok2 =
    JSON.stringify(w2) === JSON.stringify([...d2.changed, ...d2.added].sort()) &&
    untouched.length >= 1 &&
    untouched.every((f) => !w2.includes(f));
  const seal = r1.out.split('\n').filter((l) => /seal-staged/.test(l));
  const sealOk =
    seal.some((l) => l.includes(`--as ${p.S.shin} --`)) &&
    seal.some((l) => l.includes(`--as ${p.g.name} -- agents/registry.json`)) &&
    seal.every((l) => !/\.pending/.test(l)) &&
    !fs.readdirSync(path.join(p.pot, 'agents', p.S.shin)).some((x) => x.endsWith('.bonsaisig'));
  return [
    r1.code === 0 && ok1 && r2.code === 0 && ok2 && sealOk,
    `first: ${reported(r1, 'wrote').length} reported, ${d1.changed.length + d1.added.length} on disk; ` +
      `partial: ${w2.length} reported, ${d2.changed.length} on disk, ${untouched.length} left as they were and not reported; seal lines ${seal.length}, no seal written ${sealOk}`,
  ];
});

t('pending-removed-only-with-yes-and-keys-on-file', () => {
  const p = build();
  // the guardian says yes but its key is not on file; the shin says yes with keys; the third kin has no body and no .pending
  editChoices(p, (c) => {
    c.kin[p.S.guardian]['pending-removal'] = 'yes';
  });
  fs.rmSync(path.join(p.pot, 'agents', p.S.guardian, 'identity', `${p.S.guardian}-public-key.bin`));
  const q = build();
  editChoices(q, (c) => {
    delete c.kin[q.S.shin]['pending-removal'];
  });
  const r = fill(p),
    s = fill(q);
  const pend = (x, slug) => fs.existsSync(path.join(x.pot, 'agents', slug, 'identity', '.pending'));
  return [
    r.code === 0 &&
      !pend(p, p.S.shin) &&
      pend(p, p.S.guardian) &&
      reported(r, 'deleted').join() === p.rel(p.S.shin, 'identity/.pending') &&
      s.code === 0 &&
      pend(q, q.S.shin) &&
      pend(q, q.S.guardian) &&
      !reported(s, 'deleted').length,
    `yes+keys removed ${!pend(p, p.S.shin)}, yes without keys kept ${pend(p, p.S.guardian)}, no yes kept ${pend(q, q.S.shin)}`,
  ];
});

// one fixture per check: --check fails on that check and on no other
t('C1-a-token-left', () => {
  const p = filled();
  edit(p, p.rel(p.S.shin, 'references/heritage.md'), (s) => `${s}\nfp {{planting.fp8}}\n`);
  const r = check(p);
  return [only(r, 'C1', p.rel(p.S.shin, 'references/heritage.md')), show(r)];
});
t('C2-a-stale-word', () => {
  const p = filled();
  edit(p, p.rel(p.S.shin, 'references/about-me.md'), (s) => `${s}\nMy mark is Not  Yet drawn.\n`);
  const r = check(p);
  return [only(r, 'C2', p.rel(p.S.shin, 'references/about-me.md')), show(r)];
});
t('C3-a-foreign-fingerprint', () => {
  const p = filled();
  const foreign = throwawayKey().fingerprint; // THROWAWAY: another garden's key, carried in on purpose
  edit(p, p.rel(p.S.shin, 'references/heritage.md'), (s) => `${s}\nCarried in from an earlier body: \`${foreign}\`.\n`);
  const r = check(p);
  return [only(r, 'C3', p.rel(p.S.shin, 'references/heritage.md')), show(r)];
});
t('C3-an-fp8-beside-a-kanji-id-that-is-no-kin-this-file-names', () => {
  const p = filled();
  edit(
    p,
    p.rel(p.S.shin, 'references/heritage.md'),
    (s) => `${s}\nAn old mark: 古印 ${throwawayKey().fingerprint.slice(0, 8)}\n`,
  );
  const r = check(p);
  return [only(r, 'C3', p.rel(p.S.shin, 'references/heritage.md')), show(r)];
});
t('C4-two-versions', () => {
  const p = filled();
  edit(p, p.rel(p.S.shin, 'references/about-me.md'), (s) => s.replace(/^version: 1\.0\.0$/m, 'version: 1.0.1'));
  const r = check(p);
  return [only(r, 'C4', p.rel(p.S.shin, 'references/about-me.md')), show(r)];
});
t('C4-the-previous-version-left', () => {
  const p = filled();
  edit(p, p.rel(p.S.shin, 'references/heritage.md'), (s) => `${s}\nVERSION 0.9.0\n`);
  const r = check(p);
  return [only(r, 'C4', p.rel(p.S.shin, 'references/heritage.md')), show(r)];
});
t('C5-lab-wording-in-a-real-garden', () => {
  const p = filled();
  edit(p, p.rel(p.S.shin, 'references/about-me.md'), (s) => `${s}\nI was planted in a rehearsal.\n`);
  const r = check(p);
  return [only(r, 'C5', p.rel(p.S.shin, 'references/about-me.md')), show(r)];
});
t('C5-a-lab-garden-whose-integrity-line-does-not-say-rehearsal', () => {
  const p = filled({ lab: true });
  edit(p, p.rel(p.S.shin, 'SKILL.md'), (s) => s.replace(" In this garden a pass is a rehearsal's, and says so.", ''));
  const r = check(p);
  return [only(r, 'C5', p.rel(p.S.shin, 'SKILL.md')), show(r)];
});
t('C6-a-host-path', () => {
  const p = filled();
  edit(p, p.rel(p.S.shin, 'references/about-me.md'), (s) => `${s}\nMy record: /Users/fixture/notes.md\n`);
  const r = check(p);
  return [only(r, 'C6', p.rel(p.S.shin, 'references/about-me.md')), show(r)];
});
t('C7-a-display-field-null', () => {
  const p = filled();
  editReg(p, (reg) => {
    reg.agents.find((a) => a.slug === p.S.shin)['one-line'] = null;
  });
  const r = check(p);
  return [only(r, 'C7', 'agents/registry.json'), show(r)];
});
t('C8-a-body-that-differs-from-the-registry', () => {
  const p = filled();
  edit(p, p.rel(p.S.shin, 'references/identity.md'), (s) =>
    s.replace('| Pronouns | she/her |', '| Pronouns | they/them |'),
  );
  const r = check(p);
  return [only(r, 'C8', p.rel(p.S.shin, 'references/identity.md')), show(r)];
});
t('C9-pending-still-there', () => {
  const p = filled();
  fs.writeFileSync(path.join(p.pot, p.rel(p.S.shin, 'identity/.pending')), 'keys: derive has not run\n');
  const r = check(p);
  return [only(r, 'C9', p.rel(p.S.shin, 'identity/.pending')), show(r)];
});
t('C7-a-pronoun-left-blank', () => {
  // F-26 of dry run #4: a kin is never "it", so a body's registry pronouns are never a blank a reader falls back from
  const p = filled();
  editReg(p, (reg) => {
    reg.agents.find((a) => a.slug === p.S.shin).pronouns = null;
  });
  const r = check(p);
  return [only(r, 'C7', 'agents/registry.json'), show(r)];
});

// ── F-21 of dry run #4: carried testimony. The gardener's three rulings (2026-10-20, as Aruji): a witness's pronouns
//    are the witness's; ancestors in another garden, or witnesses with no fingerprint, never block; history is not a
//    gap. The fixture is kobun's fourteen findings in their own shapes: eight witness pages speaking in the first
//    person (six with pronouns that are not the guardian's), a heritage page naming seven ancestors by fp8 (THROWAWAY
//    keys of no garden), and a witness's own line that something is "pending". ────────────────────────────────────

const WITNESSES = [
  ['aki', 'they/them'],
  ['bo', 'she/her'],
  ['cira', 'she/her'],
  ['dov', 'he/him'],
  ['ema', 'she/her'],
  ['fen', 'she/her'],
  ['gil', 'he/him'],
  ['hana', 'she/her'],
];
const witnessPage = (slug, pronouns, { from = 'bonsai', extra = '' } = {}) =>
  `---\nid: ${newUlid()}\ntitle: "Witness CV — ${slug}"\ntype: feedstock-cv\nauthor: ${slug}\n` +
  `${from ? `copied-from: ${from}\n` : ''}created: 2026-09-01\nversion: 1.1.0\n---\n\n# Witness CV: ${slug}\n\n` +
  `I am **${slug}**. My pronouns are ${pronouns}.\n${extra}`;
const heritagePage = ({ from = 'bonsai' } = {}) =>
  `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n${from ? `<meta name="copied-from" content="${from}">\n` : ''}` +
  '<title>Heritage · the seven witnesses</title>\n</head>\n<body>\n' +
  Array.from(
    { length: 7 },
    (_, i) =>
      `<h2>${WITNESSES[i][0]} <span class="jp">${SET[200 + i].char}才</span></h2>\n` +
      `<div class="fingerprint">fp &middot; ${throwawayKey().fingerprint.slice(0, 8)}</div>\n`, // THROWAWAY ancestors
  ).join('') +
  '</body>\n</html>\n';
/** The guardian's body as kobun's carried it: witness pages, a feedstock CV and the heritage page, each with its source. */
function carry(p, opts = {}) {
  const at = (f) => p.rel(p.S.guardian, f);
  const w = (f, s) => {
    fs.mkdirSync(path.dirname(path.join(p.pot, at(f))), { recursive: true });
    fs.writeFileSync(path.join(p.pot, at(f)), s);
  };
  for (const [i, [slug, pr]] of WITNESSES.entries()) {
    const extra = i === 7 ? '\nMy parent signs our bond in an attestation, pending the ratification ceremony.\n' : '';
    w(`references/witness/${slug}.md`, witnessPage(slug, pr, { ...opts, extra }));
  }
  // a feedstock CV speaks of its kin from outside, as core's do: carried, with no first-person line of its own
  w(
    'references/feedstock/cv-aki.md',
    `---\nid: ${newUlid()}\ntitle: "CV — aki, seen from outside"\ntype: feedstock-cv\n` +
      `${opts.from === undefined || opts.from ? `copied-from: ${opts.from ?? 'bonsai'}\n` : ''}created: 2026-09-02\n---\n\naki keeps the soil.\n`,
  );
  w('references/heritage.html', heritagePage(opts));
  return at;
}

t('F21-kobuns-fourteen-carried-testimony-reads-clean', () => {
  const p = filled();
  carry(p);
  const r = check(p);
  return [r.code === 0 && /0 finding/.test(r.out), show(r)];
});
t('F21-the-owners-own-voice-is-still-checked', () => {
  // the same words, moved out of the carried pages into the guardian's own constitution, are his and are read
  const p = filled();
  carry(p);
  edit(p, p.rel(p.S.guardian, 'references/about-me.md'), (s) => `${s}\nMy pronouns are she/her.\n`);
  const r = check(p);
  return [only(r, 'C8', p.rel(p.S.guardian, 'references/about-me.md')), show(r)];
});
t('F21-a-file-that-names-its-source-is-carried-wherever-it-sits', () => {
  const p = filled();
  fs.mkdirSync(path.join(p.pot, p.rel(p.S.guardian, 'references/lineage')), { recursive: true });
  fs.writeFileSync(
    path.join(p.pot, p.rel(p.S.guardian, 'references/lineage/elder.md')),
    witnessPage('elder', 'she/her', {
      extra: `\nMy key in my first garden: fp ${throwawayKey().fingerprint.slice(0, 8)}, still pending its move.\n`,
    }),
  );
  const r = check(p);
  return [r.code === 0 && /0 finding/.test(r.out), show(r)];
});
t('F21-history-is-not-a-gap', () => {
  // a changelog keeps its history (as C4 already reads it): a stale word in a past entry is not a body left unfilled
  const p = filled();
  edit(
    p,
    p.rel(p.S.shin, 'references/changelog.md'),
    (s) => `${s}- **0.8.0** — the mark not yet drawn, keys pending.\n`,
  );
  const r = check(p);
  return [r.code === 0 && /0 finding/.test(r.out), show(r)];
});
t('C10-carried-testimony-that-names-no-source', () => {
  // read past only on its provenance: a page in references/witness/ that says nowhere where it came from is refused
  const p = filled();
  const at = carry(p);
  edit(p, at('references/witness/bo.md'), (s) => s.replace(/^copied-from: .*\n/m, ''));
  edit(p, at('references/heritage.html'), (s) => s.replace(/^<meta name="copied-from"[^\n]*\n/m, ''));
  const r = check(p);
  const f = findings(r).map((x) => x[1]);
  return [
    only(r, 'C10') &&
      f.length === 2 &&
      f.includes(`${at('references/witness/bo.md')}:1`) &&
      f.includes(`${at('references/heritage.html')}:1`),
    show(r),
  ];
});

// every refusal (2): fill and --check alike, and nothing written
function refused(p, mutate, re) {
  mutate(p);
  const a = hashes(p.pot);
  const f = fill(p),
    c = check(p);
  const d = diff(a, hashes(p.pot));
  const still = !d.changed.length && !d.added.length && !d.gone.length;
  return [
    f.code === 2 && c.code === 2 && re.test(f.err) && still,
    `fill ${f.code}, check ${c.code}, nothing written ${still}: ${f.err.trim().split('\n')[0].slice(0, 150)}`,
  ];
}
t('refuses-no-registry', () => refused(build(), (p) => fs.rmSync(G.P.registry(p.pot)), /no agents\/registry\.json/));
t('refuses-no-garden-json', () => refused(build(), (p) => fs.rmSync(G.P.garden(p.pot)), /no garden\.json/));
t('refuses-choices-for-another-garden', () =>
  refused(
    build(),
    (p) =>
      editChoices(p, (c) => {
        c.garden = newUlid();
      }),
    /another garden/,
  ),
);
t('refuses-an-unknown-token', () =>
  refused(
    build(),
    (p) => edit(p, p.rel(p.S.shin, 'references/about-me.md'), (s) => `${s}\n{{planting.colour}}\n`),
    /unknown token.*planting\.colour/,
  ),
);
t('refuses-a-key-field-disagreement-in-the-choices', () =>
  refused(
    build(),
    (p) =>
      editChoices(p, (c) => {
        c.kin[p.S.shin].fingerprint = throwawayKey().fingerprint;
      }),
    /key-field disagreement/,
  ),
);
t('refuses-a-registry-that-disagrees-with-the-key-on-file', () =>
  refused(
    build(),
    (p) =>
      editReg(p, (reg) => {
        const a = reg.agents.find((x) => x.slug === p.S.shin);
        a.fingerprint = throwawayKey().fingerprint;
        a.fp8 = a.fingerprint.slice(0, 8);
      }),
    /key-field disagreement.*key on file/,
  ),
);
t('refuses-a-body-naming-the-origin-with-no-vouched-origin-entry', () =>
  refused(build({ vouched: false }), () => {}, /origin's fingerprint.*not vouched/),
);
t('an-unvouched-origin-named-by-no-body-is-not-refused', () => {
  const p = build({ vouched: false });
  edit(p, p.rel(p.S.guardian, 'references/heritage.md'), (s) => s.replace(/\nDivided from[^\n]*\n/, '\n'));
  const f = fill(p),
    c = check(p);
  return [f.code === 0 && c.code === 0, `fill ${f.code}, check ${show(c)}`];
});
t('no-network-and-no-mono', () => {
  const p = build();
  const f = fill(p),
    c = check(p);
  return [
    f.code === 0 && c.code === 0 && !/NETWORK|nonexistent/.test(f.out + f.err + c.out + c.err),
    `fill ${f.code}, check ${c.code}`,
  ];
});

// ── mutants: each check broken in a scratch copy, watched to fail ────────────

const L = 'skills/bonsai-garden-keys/lib/fill-bodies.mjs';
const MUTANTS = [
  ...['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10'].map((c) => [
    `${c}-disabled`,
    [[L, `  ${c}(M, out) {`, `  ${c}(M, out) { return;`]],
    cases.filter((x) => x.name.startsWith(`${c}-`)).map((x) => x.name),
  ]),
  [
    'report-from-the-plan-not-the-disk',
    [
      [
        L,
        'const wrote = [...after]\n    .filter(([r, x]) => before.get(r) !== x)\n    .map(([r]) => r)\n    .sort();',
        "const wrote = M.bodies.flatMap((b) => b.files.map((f) => f.rel)).concat('agents/registry.json').sort();",
      ],
    ],
    ['the-report-is-the-hash-diff', 'fill-is-idempotent-and-says-so'],
  ],
  [
    'pending-without-the-yes',
    [[L, "keyOnFile(M.pot, slug) && yes(b.choice['pending-removal'])", 'keyOnFile(M.pot, slug)']],
    ['pending-removed-only-with-yes-and-keys-on-file'],
  ],
  [
    'pending-without-the-keys',
    [[L, 'fs.existsSync(pend) && keyOnFile(M.pot, slug) && yes(', 'fs.existsSync(pend) && yes(']],
    ['pending-removed-only-with-yes-and-keys-on-file'],
  ],
  [
    'unknown-token-passes',
    [[L, 'if (!TOKEN_KEYS.includes(m[1])) out.push(', 'if (false) out.push(']],
    ['refuses-an-unknown-token'],
  ],
  [
    'unvouched-origin-passes',
    [[L, 'if (!M.origin || M.origin.vouched) return [];', 'return [];']],
    ['refuses-a-body-naming-the-origin-with-no-vouched-origin-entry'],
  ],
  [
    'key-field-disagreement-passes',
    [[L, 'if (bad.length)\n    throw refuse(\n      `key-field', 'if (false)\n    throw refuse(\n      `key-field']],
    ['refuses-a-key-field-disagreement-in-the-choices', 'refuses-a-registry-that-disagrees-with-the-key-on-file'],
  ],
  [
    'choices-of-another-garden-pass',
    [[L, '|| choices.garden !== g.garden) {', ') {']],
    ['refuses-choices-for-another-garden'],
  ],
  // F-21: the scope, broken both ways, and each of its two routes in
  [
    'carried-read-as-the-owners-voice',
    [
      [
        L,
        'const carried = (f) => carriedByPlace(f.base) || copiedFrom(f.text) !== null;',
        'const carried = () => false;',
      ],
    ],
    [
      'F21-kobuns-fourteen-carried-testimony-reads-clean',
      'F21-a-file-that-names-its-source-is-carried-wherever-it-sits',
    ],
  ],
  [
    'everything-carried',
    [
      [
        L,
        'const carried = (f) => carriedByPlace(f.base) || copiedFrom(f.text) !== null;',
        'const carried = () => true;',
      ],
    ],
    ['F21-the-owners-own-voice-is-still-checked'],
  ],
  [
    'carried-by-place-alone',
    [
      [
        L,
        'const carried = (f) => carriedByPlace(f.base) || copiedFrom(f.text) !== null;',
        'const carried = (f) => carriedByPlace(f.base);',
      ],
    ],
    ['F21-a-file-that-names-its-source-is-carried-wherever-it-sits'],
  ],
  [
    'history-read-as-a-gap',
    [[L, '.filter((x) => !isChangelog(x)))', '.filter(() => true))']],
    ['F21-history-is-not-a-gap'],
  ],
  [
    'a-null-read-twice',
    [[L, 'if (p && present(a.pronouns) && p.toLowerCase()', 'if (p && p.toLowerCase()']],
    ['C7-a-pronoun-left-blank'],
  ],
];

if (argv.includes('--list')) {
  for (const c of cases) console.log(c.name);
  process.exit(0);
}

if (argv.includes('--mutants')) {
  const pick = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
  let bad = 0;
  console.log(
    'mutant                                  cases                                                       result',
  );
  // the control: an unbroken copy, every case named by a mutant, all green; else a red below means nothing
  const all = [...new Set(MUTANTS.flatMap((m) => m[2]))];
  for (const [name, edits, names, wantGreen] of [['(control: no edit)', [], all, true], ...MUTANTS]) {
    if (pick && !pick.includes(name)) continue;
    const core = fs.mkdtempSync(path.join(TMP, `mutant-${name}-`));
    for (const sk of ['bonsai-garden-keys', 'bonsai-garden-sign', 'bonsai-garden-mark'])
      fs.cpSync(path.join(SRC, 'skills', sk), path.join(core, 'skills', sk), { recursive: true });
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
    if (!names.length) harness = 'names no case';
    let verdict;
    if (harness) verdict = `HARNESS ERROR: ${harness}`;
    else {
      const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--only', names.join(',')], {
        env: { ...process.env, FILL_BODIES_SRC_CORE: core },
        encoding: 'utf8',
      });
      const res = names.map((n) => (new RegExp(`^(PASS|FAIL)  ${n}(\\s|$)`, 'm').exec(r.stdout) || [null, '?'])[1]);
      if (wantGreen)
        verdict = res.every((x) => x === 'PASS')
          ? 'GREEN'
          : `CONTROL RED (${names.filter((_, i) => res[i] !== 'PASS').join(', ')})`;
      else
        verdict = res.every((x) => x === 'FAIL')
          ? 'KILLED'
          : `SURVIVED (${names.map((n, i) => `${n} ${res[i]}`).join(', ')})`;
    }
    if (verdict !== (wantGreen ? 'GREEN' : 'KILLED')) bad++;
    console.log(`${name.padEnd(40)}${names.join(', ').slice(0, 58).padEnd(60)}${verdict}`);
  }
  console.log(`\n${bad ? `${bad} mutant(s) not killed` : 'every mutant killed'}   (scratch: ${TMP})`);
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
console.log(`\n${ran - failed}/${ran} passed${failed ? ` — ${failed} FAILED` : ''}   (scratch: ${TMP})`);
process.exit(failed ? 1 : 0);
