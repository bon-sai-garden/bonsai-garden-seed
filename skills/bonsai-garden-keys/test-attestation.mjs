// ---
// id: 01M5FYBHRF8X4K9WWNYGWHRRAG
// title: The call home's envelope, watched to fail: every refusal of its reader planted, and attest and attest consent through the real binary
// type: script
// tended-by: baisai
// created: 2026-10-21
// updated: 2026-10-21
// ---
//
// test-attestation.mjs — spec-gardeners-keys.md 0.8.0 §10 and §13, the envelope's rows. Two halves:
//
//   the reader, in process     a valid envelope built from THROWAWAY keys (none, one and three shin), then each row of
//                              §10's table planted on its own and read by lib/attestation.mjs, failing by its name:
//                              shape · names-in-body · fingerprint · fp-attests · shin-order · key-reuse · id-reuse ·
//                              signature-role, and parent and signature; each of the three signatures removed, altered
//                              or made by the wrong key fails alone; a body changed after signing fails all three
//   the binary, as a gardener  a scratch world (test-support.mjs, a fake bon-sai.garden, a lab-preview pot) planted with
//                              names that cannot occur by chance in base64, hex or kanji; attest writes the envelope
//                              with two signatures and sends nothing; no planted name is in its bytes; consent refuses
//                              without a terminal and on a wrong pair, and signs on the right one; none and three shin;
//                              both garden.json fields refused; attest refuses what the reader refuses
//
//   node skills/bonsai-garden-keys/test-attestation.mjs
//   node skills/bonsai-garden-keys/test-attestation.mjs --only <row>,<row>   (the binary half is built only when named)
//   ATTEST_TEST_SRC_CORE=<a core> node …   the same rows against another core's skills (red first: HEAD's; mutants)

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWorld, pp, PASS } from './test-support.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.env.ATTEST_TEST_SRC_CORE
  ? path.resolve(process.env.ATTEST_TEST_SRC_CORE)
  : path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const FAKE = await import(path.join(SRC, 'skills', 'bonsai-garden-mark', 'test-fake-origin.mjs'));
let A = null; // lib/attestation.mjs of the core under test; absent before 0.9.2, which is a red row, not a crash
let libErr = null;
try {
  A = await import(path.join(SRC, 'skills', 'bonsai-garden-keys', 'lib', 'attestation.mjs'));
} catch (e) {
  libErr = e.message.split('\n')[0];
}
const { companionsOf, fpIndices } = await import(path.join(SRC, 'skills', 'bonsai-garden-keys', 'lib', 'garden.mjs'));
const { chars } = await import(path.join(SRC, 'skills', 'bonsai-garden-mark', 'namespace.mjs'));
const { newUlid } = await import(path.join(SRC, 'skills', 'bonsai-garden-sign', 'lib', 'ulid-rule.mjs'));

const rows = [];
const t = (name, fn, kind = 'reader') => rows.push({ name, fn, kind });
const reasons = (ps) => [...new Set(ps.map((p) => p.reason))];
const has = (ps, r) => ps.some((p) => p.reason === r);
const say = (ps) =>
  ps
    .map((p) => `${p.reason}: ${p.detail}`)
    .join(' | ')
    .slice(0, 200) || 'none';
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── the reader, in process ─────────────────────────────────────────────────────────────────────────────────────────

const TAIL = ['山川', '木石', '水火', '花月', '空海']; // the two kanji after a pair: any, the fingerprint attests the first two only
let tails = 0;
/** A THROWAWAY key and its entity: an id whose first two kanji its fingerprint renders, as identity locks it. */
function entity() {
  const k = FAKE.keypair();
  const id = chars(fpIndices(k.fingerprint, 2)) + TAIL[tails++ % TAIL.length];
  return { k, e: { id, fingerprint: k.fingerprint, 'public-key': k.b64, 'fp-attests': 2 } };
}
const ROOT = FAKE.keypair();
const BONSAI = FAKE.keypair(); // stands in for the origin's Bonsai key, as the pot's registry would hold it
const G = entity();
const ME = entity();
const SHIN = [entity(), entity(), entity()];

function bodyWith(shin) {
  return {
    garden: { id: newUlid(), namespace: '木水庭', 'root-fingerprint': ROOT.fingerprint, 'root-public-key': ROOT.b64 },
    guardian: { ...G.e, parent: BONSAI.fingerprint, picked: 'default' },
    gardener: { ...ME.e },
    shin: A ? A.shinOrder(shin.map((s) => ({ ...s.e }))) : shin.map((s) => ({ ...s.e })), // copies: a planting edits one body only
    'custody-tier': 'software-fallback',
    'lab-preview': true,
    rite: 'bunshin',
    created: '2026-10-21',
  };
}
const sign = (body, key) => crypto.sign(null, A.signedBytes(body), key.privateKey).toString('base64');
function signed(body, { by = { root: ROOT, guardian: G.k, gardener: ME.k } } = {}) {
  return {
    format: 'bonsai-garden-attestation/1',
    body,
    signatures: Object.entries(by).map(([role, key]) => ({
      by: role,
      fingerprint: role === 'root' ? body.garden['root-fingerprint'] : body[role].fingerprint,
      signature: sign(body, key),
    })),
  };
}
const read = (env, need) => A.envelopeProblems(env, { parent: BONSAI.fingerprint, ...(need ? { need } : {}) });
/** Plant a fault in a fresh valid body, sign it as the three would, read it. */
function planted(edit, { shin = SHIN } = {}) {
  const body = bodyWith(shin);
  edit(body);
  try {
    return read(signed(body));
  } catch (e) {
    return [{ reason: 'threw', detail: e.message }];
  }
}
const libRow = (name, fn) =>
  t(name, () => {
    if (!A) return [false, `no lib/attestation.mjs in this core (${libErr})`];
    return fn();
  });

libRow('a-valid-envelope-with-none-one-or-three-shin-is-read-clean', () => {
  const got = [[], SHIN.slice(0, 1), SHIN].map((s) => read(signed(bodyWith(s))));
  return [got.every((ps) => ps.length === 0), got.map(say).join(' · ')];
});

libRow('the-same-three-shin-in-another-order-make-the-same-bytes', () => {
  const a = bodyWith(SHIN);
  const b = { ...a, shin: A.shinOrder([...SHIN].reverse().map((s) => s.e)) };
  const c = { ...a, shin: A.shinOrder([SHIN[1], SHIN[2], SHIN[0]].map((s) => s.e)) };
  // and one body written with its keys in another order: canonical sorts an object's keys, at every depth
  const d = Object.fromEntries(
    Object.entries(a)
      .reverse()
      .map(([k, v]) => [
        k,
        v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v,
      ]),
  );
  return [
    A.signedBytes(a).equals(A.signedBytes(b)) &&
      A.signedBytes(a).equals(A.signedBytes(c)) &&
      A.signedBytes(a).equals(A.signedBytes(d)),
    `bytes ${A.signedBytes(a).length}`,
  ];
});

libRow('a-name-or-a-slug-on-any-entity-is-names-in-body', () => {
  const got = {
    'garden.name': planted((b) => (b.garden.name = 'marta')),
    'gardener.slug': planted((b) => (b.gardener.slug = 'ana')),
    'guardian.name': planted((b) => (b.guardian.name = 'bonsai-shin')),
    'shin[0].slug': planted((b) => (b.shin[0].slug = 'kiko')),
    'body.name': planted((b) => (b.name = 'marta')),
  };
  return [
    Object.values(got).every((ps) => has(ps, 'names-in-body')),
    JSON.stringify(Object.fromEntries(Object.entries(got).map(([k, v]) => [k, reasons(v)]))),
  ];
});

libRow('an-entity-without-its-public-key-is-shape', () => {
  const ps = planted((b) => delete b.gardener['public-key']);
  const qs = planted((b) => delete b.shin[1]['public-key']);
  return [has(ps, 'shape') && has(qs, 'shape'), `${say(ps)} · ${say(qs)}`];
});

libRow('a-fingerprint-that-is-not-its-keys-is-fingerprint', () => {
  const other = FAKE.keypair();
  const a = planted((b) => (b.gardener.fingerprint = other.fingerprint));
  const r = planted((b) => (b.garden['root-fingerprint'] = other.fingerprint));
  const s = planted((b) => (b.shin[2].fingerprint = other.fingerprint));
  return [
    has(a, 'fingerprint') && has(r, 'fingerprint') && has(s, 'fingerprint'),
    `${reasons(a)} · ${reasons(r)} · ${reasons(s)}`,
  ];
});

libRow('a-fingerprint-whose-first-two-kanji-are-not-its-ids-is-fp-attests', () => {
  const swap = (id) => [...TAIL[0], ...[...id].slice(2)].join('');
  const g = planted((b) => (b.guardian.id = swap(b.guardian.id)));
  const m = planted((b) => (b.gardener.id = swap(b.gardener.id)));
  const s = planted((b) => (b.shin[0].id = swap(b.shin[0].id)));
  const z = planted((b) => (b.gardener['fp-attests'] = 0));
  return [[g, m, s, z].every((ps) => has(ps, 'fp-attests')), [g, m, s, z].map((x) => reasons(x).join('+')).join(' · ')];
});

libRow('parent-that-is-not-the-registrys-fingerprint-for-bonsai-is-parent', () => {
  const ps = planted((b) => (b.guardian.parent = FAKE.keypair().fingerprint));
  const none = A.envelopeProblems(signed(bodyWith(SHIN)), {}); // a reader that holds no Bonsai fingerprint cannot pass it
  return [has(ps, 'parent') && has(none, 'parent'), `${say(ps)} · without one: ${reasons(none)}`];
});

libRow('the-shin-table-each-row-fails-by-its-name', () => {
  const G2 = entity();
  const got = {
    'shin absent': [planted((b) => delete b.shin), 'shape'],
    'shin an object': [planted((b) => (b.shin = { ...b.shin[0] })), 'shape'],
    'an entry with a fifth key': [planted((b) => (b.shin[0].note = 'x')), 'shape'],
    'an entry with a parent': [planted((b) => (b.shin[0].parent = BONSAI.fingerprint)), 'shape'],
    'an entry not an object': [planted((b) => (b.shin[1] = 'kiko')), 'shape'],
    'two entries out of order': [planted((b) => b.shin.reverse()), 'shin-order'],
    'one key in two entries': [
      planted((b) => (b.shin = A.shinOrder([SHIN[0].e, { ...SHIN[0].e, id: G2.e.id }]))),
      'key-reuse',
    ],
    "a shin key equal to the guardian's": [planted((b) => (b.shin = [{ ...G.e, id: SHIN[0].e.id }])), 'key-reuse'],
    "the gardener's key equal to the root's": [
      planted((b) => Object.assign(b.gardener, { 'public-key': ROOT.b64, fingerprint: ROOT.fingerprint })),
      'key-reuse',
    ],
    'two entities with one id': [planted((b) => (b.shin[0].id = b.gardener.id)), 'id-reuse'],
  };
  const bad = Object.entries(got).filter(([, [ps, want]]) => !has(ps, want));
  return [
    bad.length === 0,
    bad.length
      ? bad.map(([k, [ps, w]]) => `${k}: wanted ${w}, read ${reasons(ps)}`).join(' | ')
      : `${Object.keys(got).length} rows by name`,
  ];
});

libRow('a-signature-by-shin-or-a-role-twice-or-missing-is-signature-role', () => {
  const body = bodyWith(SHIN);
  const env = signed(body);
  const byShin = clone(env);
  byShin.signatures.push({ by: 'shin', fingerprint: SHIN[0].e.fingerprint, signature: sign(body, SHIN[0].k) });
  const twice = clone(env);
  twice.signatures.push(clone(env.signatures[0]));
  const missing = clone(env);
  missing.signatures = missing.signatures.filter((s) => s.by !== 'gardener');
  return [
    [byShin, twice, missing].every((e) => has(read(e), 'signature-role')),
    [byShin, twice, missing].map((e) => reasons(read(e))).join(' · '),
  ];
});

libRow('each-signature-removed-altered-or-by-the-wrong-key-fails-alone', () => {
  const body = bodyWith(SHIN);
  const out = [];
  for (const role of ['root', 'guardian', 'gardener']) {
    const i = ['root', 'guardian', 'gardener'].indexOf(role);
    const removed = signed(body);
    removed.signatures.splice(i, 1);
    const altered = signed(body);
    const s = Buffer.from(altered.signatures[i].signature, 'base64');
    s[7] ^= 1;
    altered.signatures[i].signature = s.toString('base64');
    const wrong = signed(body);
    wrong.signatures[i].signature = sign(body, FAKE.keypair());
    const misnamed = signed(body); // a signature whose fingerprint is not its role's
    misnamed.signatures[i].fingerprint = FAKE.keypair().fingerprint;
    for (const [what, env, want] of [
      ['removed', removed, 'signature-role'],
      ['altered', altered, 'signature'],
      ['wrong key', wrong, 'signature'],
      ['not its fingerprint', misnamed, 'signature'],
    ]) {
      const ps = read(env);
      out.push([`${role} ${what}`, ps.length === 1 && ps[0].reason === want, say(ps)]);
    }
  }
  const bad = out.filter(([, ok]) => !ok);
  return [
    bad.length === 0,
    bad.length ? bad.map(([w, , s]) => `${w}: ${s}`).join(' | ') : `${out.length} cases, each one problem`,
  ];
});

libRow('a-body-changed-after-signing-fails-all-three', () => {
  const env = signed(bodyWith(SHIN));
  env.body.created = '2026-10-22';
  const ps = read(env);
  return [ps.length === 3 && ps.every((p) => p.reason === 'signature'), say(ps)];
});

libRow('the-envelope-itself-is-shape-checked', () => {
  const env = signed(bodyWith(SHIN));
  const extra = { ...clone(env), note: 'x' };
  const fmt = { ...clone(env), format: 'bonsai-garden-attestation/2' };
  return [has(read(extra), 'shape') && has(read(fmt), 'shape'), `${reasons(read(extra))} · ${reasons(read(fmt))}`];
});

t('garden-json-shins-one-field-for-one-fact', () => {
  const both = (() => {
    try {
      companionsOf({ shin: 'kiko', shins: ['kiko', 'riku'] });
      return 'taken';
    } catch (e) {
      return /both/.test(e.message) ? 'refused' : `threw: ${e.message}`;
    }
  })();
  const ok =
    JSON.stringify(companionsOf({ shins: [] })) === '[]' &&
    JSON.stringify(companionsOf({ shins: ['kiko', 'riku'] })) === '["kiko","riku"]' &&
    JSON.stringify(companionsOf({ shin: 'kiko' })) === '["kiko"]' &&
    JSON.stringify(companionsOf({ shin: null })) === '[]' &&
    JSON.stringify(companionsOf({})) === '[]' &&
    both === 'refused';
  return [ok, `both: ${both}; shin string: ${JSON.stringify(companionsOf({ shin: 'kiko' }))}`];
});

// ── the binary, as a gardener runs it ──────────────────────────────────────────────────────────────────────────────

// Names that cannot occur by chance in the envelope's bytes: a hyphen is in neither base64 nor hex, and these words
// are not in the format's own vocabulary. The guardian's slug is planted too, as every garden has it.
const NAME = 'quilla-wood';
const GARDENER = 'tova-ana';
const SHIN1 = 'kiko-ren';
const NAMES = [NAME, GARDENER, SHIN1, 'bonsai-shin'];
let W = null;
let worldErr = null;
const pots = {};
async function world() {
  if (W || worldErr) return;
  try {
    W = await makeWorld({ srcCore: SRC, label: 'attestation' });
    pots.one = W.newPot('one');
    await W.seedPot(pots.one, { name: NAME, gardener: GARDENER, shin: SHIN1, attest: false });
  } catch (e) {
    worldErr = e.message;
  }
}
const ENV = (pot) => path.join(pot, 'garden-attestation.json');
const envOf = (pot) => (fs.existsSync(ENV(pot)) ? JSON.parse(fs.readFileSync(ENV(pot), 'utf8')) : null);
const bonsaiFp = (pot) =>
  JSON.parse(fs.readFileSync(path.join(pot, 'agents', 'registry.json'), 'utf8')).agents.find((a) => a.slug === 'bonsai')
    .fingerprint;
const out = (r) => `exit ${r.code}: ${(r.stdout + r.stderr).trim().split('\n').slice(-2).join(' | ')}`.slice(0, 220);
/** A copy of a seeded pot: the same garden, so the same custody item under the world's HOME. */
const copyPot = (from, name) => {
  const to = path.join(W.dir, name);
  fs.cpSync(from, to, { recursive: true });
  return to;
};
const attest = (pot, env = {}) => W.run(['attest', '--pot', pot, ...W.B], { input: pp(PASS), env });
/** The envelope on the seeded pot, made by attest when no row before this one made it: each row stands alone. */
const ensureAttested = () => {
  if (!fs.existsSync(ENV(pots.one))) attest(pots.one, { KEYS_TEST_TRANSPORT_LOG: path.join(W.dir, 'transport.log') });
};
function consent(pot, lines, { terminal = true } = {}) {
  const env = { KEYS_TEST_TRANSPORT_LOG: path.join(W.dir, 'transport.log') };
  if (terminal) {
    const f = path.join(W.dir, `terminal-${crypto.randomUUID()}.txt`);
    fs.writeFileSync(f, lines.map((l) => `${l}\n`).join(''));
    env.KEYS_TEST_TERMINAL = f;
  }
  return W.run(['attest', 'consent', '--pot', pot, ...W.B], { input: pp(PASS), env });
}
const sends = () => {
  const f = path.join(W.dir, 'transport.log');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean) : [];
};
const bin = (name, fn) =>
  t(
    name,
    async () => {
      await world();
      if (worldErr) return [false, `the world could not be planted: ${worldErr}`];
      return fn();
    },
    'binary',
  );

bin('attest-writes-the-envelope-with-two-signatures-and-sends-nothing', () => {
  const r = attest(pots.one, { KEYS_TEST_TRANSPORT_LOG: path.join(W.dir, 'transport.log') });
  const env = envOf(pots.one);
  const ps =
    env && A
      ? A.envelopeProblems(env, { parent: bonsaiFp(pots.one), need: ['root', 'guardian'] })
      : [{ reason: 'none' }];
  return [
    r.code === 0 &&
      !!env &&
      ps.length === 0 &&
      JSON.stringify(env.signatures.map((s) => s.by)) === '["root","guardian"]' &&
      Array.isArray(env.body.shin) &&
      env.body.shin.length === 1 &&
      /awaiting the gardener/.test(r.stdout) &&
      sends().length === 0,
    `${out(r)}; envelope ${env ? env.signatures.map((s) => s.by).join('+') : 'absent'}; read ${say(ps)}; sends ${sends().length}`,
  ];
});

bin('no-planted-name-is-anywhere-in-the-envelopes-bytes', () => {
  ensureAttested();
  const bytes = fs.existsSync(ENV(pots.one)) ? fs.readFileSync(ENV(pots.one)) : Buffer.alloc(0);
  const found = NAMES.filter((n) => bytes.includes(Buffer.from(n)));
  return [bytes.length > 0 && found.length === 0, `${bytes.length} bytes; found ${JSON.stringify(found)}`];
});

bin('attest-is-idempotent-and-refuses-other-content', () => {
  ensureAttested();
  const before = fs.existsSync(ENV(pots.one)) ? fs.readFileSync(ENV(pots.one)) : null;
  const again = attest(pots.one);
  const same = before && fs.readFileSync(ENV(pots.one)).equals(before);
  const p = copyPot(pots.one, 'other-content');
  const env = envOf(p);
  if (env) {
    env.body['lab-preview'] = !env.body['lab-preview'];
    fs.writeFileSync(ENV(p), `${JSON.stringify(env, null, 2)}\n`);
  }
  const other = attest(p);
  return [
    again.code === 0 && same && other.code === 2 && /other content/.test(other.stderr),
    `again ${out(again)}, same ${same}; other ${out(other)}`,
  ];
});

bin('consent-refuses-without-a-terminal', () => {
  ensureAttested();
  const before = fs.readFileSync(ENV(pots.one));
  const r = consent(pots.one, [], { terminal: false });
  return [
    r.code === 2 && /terminal/.test(r.stderr) && fs.readFileSync(ENV(pots.one)).equals(before) && sends().length === 0,
    out(r),
  ];
});

bin('consent-refuses-a-pair-that-is-not-the-guardians', () => {
  ensureAttested();
  const before = fs.readFileSync(ENV(pots.one));
  const r = consent(pots.one, ['木水']);
  return [
    r.code === 2 && /pair/.test(r.stderr) && fs.readFileSync(ENV(pots.one)).equals(before) && sends().length === 0,
    out(r),
  ];
});

bin('consent-signs-on-the-guardians-pair-and-only-then-offers-it', () => {
  ensureAttested();
  const env0 = envOf(pots.one);
  const pair = env0 ? [...env0.body.guardian.id].slice(0, 2).join('') : '';
  const r = consent(pots.one, [pair]);
  const env = envOf(pots.one);
  const ps = env && A ? A.envelopeProblems(env, { parent: bonsaiFp(pots.one) }) : [{ reason: 'none' }];
  return [
    r.code === 0 &&
      ps.length === 0 &&
      JSON.stringify(env.signatures.map((s) => s.by)) === '["root","guardian","gardener"]' &&
      /plain words/.test(r.stdout) &&
      sends().length === 1 &&
      sends()[0].endsWith('garden-attestation.json'),
    `${out(r)}; read ${say(ps)}; sends ${JSON.stringify(sends())}`,
  ];
});

bin('a-garden-with-no-shin-writes-an-empty-array-and-is-read-clean', async () => {
  const pot = W.newPot('lone');
  let err = null;
  try {
    await W.seedPot(pot, { name: 'eremo-wood', gardener: GARDENER, shin: null, attest: true });
  } catch (e) {
    err = e.message;
  }
  const env = envOf(pot);
  const g = JSON.parse(fs.readFileSync(path.join(pot, 'garden.json'), 'utf8'));
  const ps =
    env && A ? A.envelopeProblems(env, { parent: bonsaiFp(pot), need: ['root', 'guardian'] }) : [{ reason: 'none' }];
  return [
    !err &&
      env &&
      JSON.stringify(env.body.shin) === '[]' &&
      ps.length === 0 &&
      JSON.stringify(g.shins) === '[]' &&
      !('shin' in g),
    err ||
      `shin ${JSON.stringify(env?.body.shin)}; garden.json ${JSON.stringify({ shin: g.shin, shins: g.shins })}; read ${say(ps)}`,
  ];
});

bin('three-shin-in-another-garden-json-order-make-the-same-envelope', async () => {
  const pot = W.newPot('three');
  let err = null;
  try {
    await W.seedPot(pot, {
      name: 'tri-wood',
      gardener: GARDENER,
      shin: ['kiko-ren', 'riku-sen', 'mio-ten'],
      attest: true,
    });
  } catch (e) {
    err = e.message;
  }
  if (err) return [false, err];
  const first = fs.readFileSync(ENV(pot));
  const gf = path.join(pot, 'garden.json');
  const g = JSON.parse(fs.readFileSync(gf, 'utf8'));
  fs.writeFileSync(gf, `${JSON.stringify({ ...g, shins: [...g.shins].reverse() }, null, 2)}\n`);
  fs.rmSync(ENV(pot));
  const r = attest(pot);
  const env = envOf(pot);
  return [
    r.code === 0 && fs.readFileSync(ENV(pot)).equals(first) && env.body.shin.length === 3,
    `${out(r)}; same bytes ${fs.existsSync(ENV(pot)) && fs.readFileSync(ENV(pot)).equals(first)}; garden.json ${JSON.stringify(g.shins)}`,
  ];
});

bin('a-garden-json-with-both-shin-and-shins-is-refused', () => {
  ensureAttested();
  const p = copyPot(pots.one, 'both-fields');
  const gf = path.join(p, 'garden.json');
  const g = JSON.parse(fs.readFileSync(gf, 'utf8'));
  fs.writeFileSync(gf, `${JSON.stringify({ ...g, shin: SHIN1, shins: [SHIN1] }, null, 2)}\n`);
  fs.rmSync(ENV(p), { force: true });
  const r = attest(p);
  const st = W.run(['status', '--pot', p]);
  return [
    r.code === 2 && /both/.test(r.stderr) && !fs.existsSync(ENV(p)) && st.code === 2,
    `attest ${out(r)}; status ${out(st)}`,
  ];
});

bin('attest-refuses-what-the-reader-refuses', () => {
  ensureAttested();
  const plant = (name, edit) => {
    const p = copyPot(pots.one, name);
    const lf = path.join(p, 'locked-salts.json');
    const locks = JSON.parse(fs.readFileSync(lf, 'utf8'));
    edit(locks);
    fs.writeFileSync(lf, `${JSON.stringify(locks, null, 2)}\n`);
    fs.rmSync(ENV(p), { force: true });
    const r = attest(p);
    return [r, fs.existsSync(ENV(p))];
  };
  const [reuse, w1] = plant(
    'id-reuse',
    (l) => (l.agents[SHIN1].identity_kanji_full = l.agents[GARDENER].identity_kanji_full),
  );
  const [fpa, w2] = plant(
    'fp-attests',
    (l) =>
      (l.agents[GARDENER].identity_kanji_full = `山川${[...l.agents[GARDENER].identity_kanji_full].slice(2).join('')}`),
  );
  return [
    reuse.code === 2 && /id-reuse/.test(reuse.stderr) && !w1 && fpa.code === 2 && /fp-attests/.test(fpa.stderr) && !w2,
    `id-reuse ${out(reuse)} · fp-attests ${out(fpa)}`,
  ];
});

// ── run ────────────────────────────────────────────────────────────────────────────────────────────────────────────

let failed = 0,
  ran = 0;
for (const r of rows) {
  if (only && !only.includes(r.name)) continue;
  ran++;
  let ok = false,
    why = '';
  try {
    [ok, why] = await r.fn();
  } catch (e) {
    why = `threw: ${e.message.split('\n')[0]}`;
  }
  console.log(`${ok === true ? 'PASS' : 'FAIL'}  ${r.name}  — ${why}`);
  if (ok !== true) failed++;
}
console.log(
  `\n${ran - failed}/${ran} passed${failed ? ` — ${failed} FAILED` : ''}${W ? `   (scratch: ${W.dir})` : ''}`,
);
process.exit(failed ? 1 : 0);
