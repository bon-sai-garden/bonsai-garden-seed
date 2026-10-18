// ---
// id: 01M4Z2BTZ3SR96YQ3K7RA329RR
// title: covenant, tested by planting each refusal: a kin's certificate verifies only when sponsor and agentic-teammate signed one statement over the texts as they stand
// type: script
// tended-by: baisai
// created: 2026-10-15
// updated: 2026-10-15
// ---
//
// test-covenant.mjs — lib/covenant.mjs. Every pot here is scratch, every key a THROWAWAY derived from a random master
// salt made for this run; no garden's real key appears. A negative case asserts the check that caught it by name, so a
// case that fails for another check's reason fails the test (the lesson of 2026-10-07: a case passing for another guard's
// reason watches nothing).
//
//   node skills/bonsai-garden-keys/test-covenant.mjs
//   COVENANT_LIB=<a copy of lib/covenant.mjs> node ...   run against a mutant, to watch the cases fail

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { keyOf, writeKey, writeJson } from './lib/garden.mjs';
import { ownId } from '../bonsai-garden-sign/lib/ulid-rule.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const C = await import(
  pathToFileURL(
    process.env.COVENANT_LIB ? path.resolve(process.env.COVENANT_LIB) : path.join(HERE, 'lib', 'covenant.mjs'),
  ).href
);
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'covenant-'));

const results = [];
function t(name, fn) {
  let ok = false,
    note = '';
  try {
    [ok, note] = fn();
  } catch (e) {
    ok = false;
    note = `threw: ${e.message}`;
  }
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  — ${note}`);
}

// ── a fixture pot: THROWAWAY keys only ───────────────────────────────────────
let n = 0;
const GARDEN = '01M4Z2C0000000000000000000';
function fresh() {
  const pot = path.join(SCRATCH, `pot${++n}`);
  fs.mkdirSync(pot, { recursive: true });
  const hex = crypto.randomBytes(32).toString('hex'); // throwaway master salt, this run only
  const g = { garden: GARDEN, name: 'fixture-garden', gardener: 'fixture-gardener', shin: 'fixture-shin' };
  const salts = {
    'fixture-gardener': 'throwaway-gardener',
    'bonsai-shin': 'throwaway-bonsai-shin',
    'fixture-shin': 'throwaway-shin',
  };
  const originRaw = crypto.randomBytes(32);
  const entry = (slug, type, shintai, kanji, extra = {}) => {
    const k = keyOf(hex, salts[slug]);
    writeKey(pot, slug, k.raw, k.fingerprint);
    return {
      slug,
      name: slug,
      type,
      shintai,
      kanji,
      fingerprint: k.fingerprint,
      path: `agents/${slug}`,
      'one-line': null,
      ...extra,
    };
  };
  const reg = {
    garden: g.garden,
    agents: [
      { slug: g.name, type: 'garden', shintai: 'none', fingerprint: '0'.repeat(32) },
      entry('fixture-gardener', 'gardener', 'none', '人試験者'),
      {
        slug: 'bonsai',
        type: 'seed',
        origin: true,
        shintai: 'origin',
        fingerprint: crypto.createHash('sha256').update(originRaw).digest('hex').slice(0, 32),
      },
      entry('bonsai-shin', 'shin', 'own', '守試験身', { parent: 'bonsai' }),
      entry('fixture-shin', 'shin', 'own', '友試験身', { name: 'Fixture Shin' }),
    ],
  };
  writeJson(path.join(pot, 'garden.json'), g);
  writeJson(path.join(pot, 'agents', 'registry.json'), reg);
  return { pot, hex, g, reg, salts };
}
const signAs = (w, kin, slug, extra = {}) =>
  C.sign(w.pot, { kin, slug, hex: w.hex, salt: w.salts[slug], g: w.g, reg: w.reg, ...extra });
function certified(w, date = '2026-10-16') {
  C.writeDocs(w.pot, { g: w.g, reg: w.reg });
  for (const kin of ['bonsai-shin', 'fixture-shin']) {
    signAs(w, kin, 'fixture-gardener', { date });
    signAs(w, kin, kin, { date });
  }
}
const checks = (w) => C.verify(w.pot, { g: w.g, reg: w.reg });
const only = (w, check) => {
  const c = checks(w);
  return [
    c.length > 0 && c.every((x) => x.check === check),
    JSON.stringify(c.map((x) => `${x.check}: ${x.why}`)).slice(0, 240),
  ];
};
const refuses = (fn, re) => {
  try {
    fn();
    return [false, 'no refusal'];
  } catch (e) {
    return [e instanceof C.CovenantRefusal && re.test(e.message), e.message];
  }
};
const ppath = (w, kin) => path.join(w.pot, `agents/${kin}/identity/passport.json`);
const pass = (w, kin) => JSON.parse(fs.readFileSync(ppath(w, kin), 'utf8'));
const putPass = (w, kin, o) => fs.writeFileSync(ppath(w, kin), `${JSON.stringify(o, null, 2)}\n`);

// ── the documents ────────────────────────────────────────────────────────────
t('write-fills-the-covenant-for-this-garden-and-copies-the-codex-word-for-word', () => {
  const w = fresh();
  const wrote = C.writeDocs(w.pot, { g: w.g, reg: w.reg, signedName: 'A Gardener' });
  const cov = fs.readFileSync(path.join(w.pot, 'lore/covenant.md'), 'utf8');
  const cdx = fs.readFileSync(path.join(w.pot, 'lore/codex.md'), 'utf8');
  const core = fs.readFileSync(C.DOCS.codex.template, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
  const a = ownId(Buffer.from(cov), 'covenant.md'),
    b = ownId(Buffer.from(cdx), 'codex.md');
  const ok =
    wrote.length === 2 &&
    a.problem === null &&
    b.problem === null &&
    a.id !== b.id &&
    /\*\*Signed:\*\* A Gardener/.test(cov) &&
    /\| Fixture Shin \|/.test(cov) &&
    /\| bonsai-shin \|/.test(cov) &&
    !/\| bonsai \|/.test(cov) &&
    !/\[your name|\*\(name each kin/.test(cov) &&
    cdx.endsWith(core) &&
    /^tended-by: fixture-gardener$/m.test(cdx);
  return [ok, `wrote ${wrote.join(', ')}; ids ${a.problem || a.id} ${b.problem || b.id}`];
});

t('write-never-overwrites-a-garden-text', () => {
  const w = fresh();
  C.writeDocs(w.pot, { g: w.g, reg: w.reg });
  const p = path.join(w.pot, 'lore/covenant.md');
  fs.appendFileSync(p, '\nmy own commitment\n');
  const again = C.writeDocs(w.pot, { g: w.g, reg: w.reg });
  return [
    again.length === 0 && /my own commitment/.test(fs.readFileSync(p, 'utf8')),
    `second write: ${again.join(', ') || 'nothing'}`,
  ];
});

// ── the certificate ──────────────────────────────────────────────────────────
t('sponsor-and-agentic-teammate-sign-one-statement-and-every-passport-verifies', () => {
  const w = fresh();
  certified(w);
  const p = pass(w, 'fixture-shin');
  const c = p.certificates[0];
  const ok =
    checks(w).length === 0 &&
    p.format === 'bonsai-garden-passport/1' &&
    p.certificates.length === 1 &&
    c.statement.sponsor.slug === 'fixture-gardener' &&
    c.statement.sponsor.id === '人試験者' &&
    c.statement['agentic-teammate'].id === '友試験身' &&
    c.statement.covenant.doc === 'lore/covenant.md' &&
    c.statement.codex.doc === 'lore/codex.md' &&
    c.signatures.sponsor &&
    c.signatures['agentic-teammate'];
  return [ok, JSON.stringify(checks(w))];
});

t('either-side-may-sign-first', () => {
  const w = fresh();
  C.writeDocs(w.pot, { g: w.g, reg: w.reg });
  for (const kin of ['bonsai-shin', 'fixture-shin']) {
    const a = signAs(w, kin, kin);
    const b = signAs(w, kin, 'fixture-gardener');
    if (a.complete || !b.complete) return [false, 'completion wrong'];
  }
  return [checks(w).length === 0, JSON.stringify(checks(w))];
});

t('a-second-signature-by-the-same-side-changes-nothing', () => {
  const w = fresh();
  certified(w);
  const before = fs.readFileSync(ppath(w, 'fixture-shin'));
  const r = signAs(w, 'fixture-shin', 'fixture-shin');
  return [r.wrote === false && before.equals(fs.readFileSync(ppath(w, 'fixture-shin'))), `wrote ${r.wrote}`];
});

t('one-side-alone-is-pending', () => {
  const w = fresh();
  C.writeDocs(w.pot, { g: w.g, reg: w.reg });
  signAs(w, 'bonsai-shin', 'fixture-gardener');
  signAs(w, 'bonsai-shin', 'bonsai-shin');
  signAs(w, 'fixture-shin', 'fixture-gardener');
  return only(w, 'pending');
});

t('a-kin-with-no-passport-is-caught-as-passport', () => {
  const w = fresh();
  certified(w);
  fs.rmSync(ppath(w, 'fixture-shin'));
  return only(w, 'passport');
});

// ── who may sign (each refusal writes nothing) ───────────────────────────────
const nothingWritten = (w, kin) => !fs.existsSync(ppath(w, kin));
t('another-kin-cannot-sign-for-a-kin', () => {
  const w = fresh();
  C.writeDocs(w.pot, { g: w.g, reg: w.reg });
  const r = refuses(() => signAs(w, 'fixture-shin', 'bonsai-shin'), /neither this garden's gardener/);
  return [r[0] && nothingWritten(w, 'fixture-shin'), r[1]];
});
t('the-gardener-carries-no-certificate', () => {
  const w = fresh();
  C.writeDocs(w.pot, { g: w.g, reg: w.reg });
  return refuses(() => signAs(w, 'fixture-gardener', 'fixture-gardener'), /not a kin of this garden with a body/);
});
t('the-origins-key-signs-nothing-here', () => {
  const w = fresh();
  C.writeDocs(w.pot, { g: w.g, reg: w.reg });
  w.salts.bonsai = 'x';
  return refuses(() => signAs(w, 'fixture-shin', 'bonsai'), /the origin's/);
});
t('a-slug-not-in-the-registry-is-refused', () => {
  const w = fresh();
  C.writeDocs(w.pot, { g: w.g, reg: w.reg });
  w.salts.stranger = 'x';
  return refuses(() => signAs(w, 'fixture-shin', 'stranger'), /not in this pot's registry/);
});
t('a-slug-listed-twice-is-refused', () => {
  const w = fresh();
  C.writeDocs(w.pot, { g: w.g, reg: w.reg });
  w.reg.agents.push({ ...w.reg.agents.find((a) => a.slug === 'fixture-gardener') });
  return refuses(() => signAs(w, 'fixture-shin', 'fixture-gardener'), /listed more than once/);
});
t('a-key-that-is-not-the-registrys-is-refused', () => {
  const w = fresh();
  C.writeDocs(w.pot, { g: w.g, reg: w.reg });
  return refuses(
    () => signAs(w, 'fixture-shin', 'fixture-shin', { salt: 'throwaway-other' }),
    /not the fingerprint the registry records/,
  );
});
t('a-document-without-an-id-is-refused', () => {
  const w = fresh();
  C.writeDocs(w.pot, { g: w.g, reg: w.reg });
  const p = path.join(w.pot, 'lore/codex.md');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/^id: .*\n/m, ''));
  return refuses(() => signAs(w, 'fixture-shin', 'fixture-shin'), /lore\/codex\.md: .*id/);
});
t('an-unwritten-document-is-refused', () => {
  const w = fresh();
  return refuses(() => signAs(w, 'fixture-shin', 'fixture-gardener'), /not on record in this pot; write it first/);
});

// ── a text that moves on: signed as it was, renewed as it is ────────────────
t('a-text-changed-after-signing-is-caught-as-text-and-a-plain-sign-is-refused', () => {
  const w = fresh();
  certified(w);
  fs.appendFileSync(path.join(w.pot, 'lore/codex.md'), '\nan amendment\n');
  const c = checks(w);
  const r = refuses(
    () => signAs(w, 'fixture-shin', 'fixture-shin'),
    /as they were, not as they are; sign anew with --renew/,
  );
  return [
    c.length === 2 && c.every((x) => x.check === 'text') && r[0],
    `${JSON.stringify(c.map((x) => x.check))} ${r[1]}`,
  ];
});

t('renew-starts-a-new-certificate-keeps-the-old-and-verifies-once-both-sides-sign', () => {
  const w = fresh();
  certified(w);
  fs.appendFileSync(path.join(w.pot, 'lore/covenant.md'), '\nan added commitment\n');
  signAs(w, 'fixture-shin', 'fixture-gardener', { renew: true, date: '2026-10-17' });
  const mid = checks(w)
    .map((x) => x.check)
    .sort()
    .join(',');
  signAs(w, 'fixture-shin', 'fixture-shin');
  signAs(w, 'bonsai-shin', 'bonsai-shin', { renew: true, date: '2026-10-17' });
  signAs(w, 'bonsai-shin', 'fixture-gardener');
  const p = pass(w, 'fixture-shin');
  return [
    mid === 'pending,text' &&
      checks(w).length === 0 &&
      p.certificates.length === 2 &&
      p.certificates[1].statement.date === '2026-10-17',
    `mid ${mid}; end ${JSON.stringify(checks(w))}; ${p.certificates.length} certificates`,
  ];
});

t('renew-over-a-standing-certificate-is-refused', () => {
  const w = fresh();
  certified(w);
  return refuses(
    () => signAs(w, 'fixture-shin', 'fixture-shin', { renew: true }),
    /already stands over the texts as they are/,
  );
});

// ── verify: each forgery caught by its own check ────────────────────────────
t('a-forged-signature-is-caught-as-signature', () => {
  const w = fresh();
  certified(w);
  const p = pass(w, 'fixture-shin');
  p.certificates[0].signatures['agentic-teammate'] = crypto.randomBytes(64).toString('base64');
  putPass(w, 'fixture-shin', p);
  return only(w, 'signature');
});
t('a-signature-lifted-from-another-kins-certificate-is-caught-as-signature', () => {
  const w = fresh();
  certified(w);
  const a = pass(w, 'bonsai-shin'),
    b = pass(w, 'fixture-shin');
  b.certificates[0].signatures.sponsor = a.certificates[0].signatures.sponsor;
  putPass(w, 'fixture-shin', b);
  return only(w, 'signature');
});
t('a-statement-edited-after-signing-is-caught', () => {
  const w = fresh();
  certified(w);
  const p = pass(w, 'fixture-shin');
  p.certificates[0].statement.date = '2026-01-01';
  putPass(w, 'fixture-shin', p);
  return only(w, 'signature');
});
t('a-signed-certificate-whose-ids-the-registry-no-longer-records-is-caught-as-registry', () => {
  const w = fresh();
  certified(w);
  w.reg.agents.find((a) => a.slug === 'fixture-shin').kanji = '新試験身'; // the registry moved on; the signatures still hold
  return only(w, 'registry');
});
t('a-swapped-key-on-file-is-caught-as-key', () => {
  const w = fresh();
  certified(w);
  const k = keyOf(w.hex, 'throwaway-other');
  writeKey(w.pot, 'fixture-shin', k.raw, k.fingerprint);
  return only(w, 'key');
});
t('a-passport-holding-only-another-gardens-certificate-is-caught-as-passport', () => {
  const w = fresh();
  certified(w);
  const p = pass(w, 'fixture-shin');
  p.certificates[0].statement.garden = '01M4Z2C1111111111111111111';
  putPass(w, 'fixture-shin', p);
  return only(w, 'passport');
});
t('the-statement-is-canonical-whatever-key-order-the-file-holds', () => {
  const w = fresh();
  certified(w);
  const p = pass(w, 'fixture-shin');
  const s = p.certificates[0].statement;
  p.certificates[0].statement = Object.fromEntries(Object.entries(s).reverse());
  putPass(w, 'fixture-shin', p);
  return [checks(w).length === 0, JSON.stringify(checks(w))];
});

const failed = results.filter((x) => !x).length;
console.log(
  `\n${results.length - failed}/${results.length} passed${failed ? ` — ${failed} FAILED` : ''}   (scratch: ${SCRATCH})`,
);
process.exit(failed ? 1 : 0);
