// ---
// id: 01M5FRRE3WECNC6XHY1DRQ52T3
// title: One planting asks the site once for the reserved set, and its seed counts itself: the release record and the /stats count through the real binary (spec-gardeners-keys §6.4 point 5, §8.1)
// type: script
// tended-by: baisai
// created: 2026-10-21
// updated: 2026-10-21
// ---
//
// test-release-record.mjs — the rows of spec-gardeners-keys.md 0.7.0's §6.4 table that need the whole arc, run as a
// gardener runs it: a scratch world (test-support.mjs) whose core carries SEED-MANIFEST.json sealed by a THROWAWAY
// writer key, a lab-preview pot, a fake bon-sai.garden that logs every question (ASK <signer>), no network.
//
//   one arc, namespace → identity for the three → seed     the set asked once (the manifest's seal), Bonsai's entry once more
//   a verb after seed                                      asked again
//   the release record edited                               refused, a finding; nothing locked
//   its root seal not under the key custody gives          refused before the lock (candidates take the root's seal alone)
//   an unspent record, and Bonsai's entry by another key    seed still asks for his entry, and refuses it (§8.1)
//   the manifest replaced after namespace                  asked again
//   seed's question, counted                               beside Bonsai's seal: event, release, lab-preview; nothing of the garden
//   a checkout with no release manifest                    seed sends no count (a workshop, no release)
//   a malformed count                                      not sent; the answer the same with or without one
//   a count beside a seal the site did not vouch for       never said to be counted
//
//   node skills/bonsai-garden-keys/test-release-record.mjs
//   RELEASE_TEST_SRC_CORE=<a core checkout> node …   the same cases against another core's skills (red first: HEAD's)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWorld, pp, PASS } from './test-support.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.env.RELEASE_TEST_SRC_CORE
  ? path.resolve(process.env.RELEASE_TEST_SRC_CORE)
  : path.resolve(HERE, '..', '..');
const W = await makeWorld({ srcCore: SRC, label: 'release-record', release: true });
const FAKE = await import(path.join(SRC, 'skills', 'bonsai-garden-mark', 'test-fake-origin.mjs'));
const B = W.B;
const SET = JSON.parse(
  fs.readFileSync(path.join(W.core, 'skills', 'bonsai-garden-mark', 'kanji-1024-v1.2.json'), 'utf8'),
).kanji;
const pairOf = (a, b) => SET[a].char + SET[b].char;

const results = [];
async function t(name, fn) {
  let ok = false,
    note = '';
  try {
    [ok, note] = await fn();
  } catch (e) {
    note = `threw: ${e.message}`;
  }
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  — ${note}`);
}
const out = (r) => `exit ${r.code}: ${(r.stdout + r.stderr).trim().split('\n').slice(-2).join(' | ')}`.slice(0, 220);
const asks = () => W.siteAsked().lines.filter((l) => l.startsWith('ASK '));
const since = (n) => asks().slice(n);
const gardenJson = (pot) => JSON.parse(fs.readFileSync(path.join(pot, 'garden.json'), 'utf8'));
const locks = (pot) => fs.readFileSync(path.join(pot, 'locked-salts.json'), 'utf8');

/** The arc up to and with namespace, as seedPot runs it. */
function toNamespace(pot, name) {
  const step = (what, args, input = pp(PASS)) => {
    const r = W.run(args, { input });
    if (r.code !== 0) throw new Error(`${what} exited ${r.code}: ${out(r)}`);
    return r;
  };
  step('id', ['id', '--pot', pot, '--name', name, '--gardener', 'ana', '--shin', 'kiko'], '');
  step('mint', ['mint', '--pot', pot, '--lab-preview', ...B], pp(PASS, PASS));
  const exp = path.join(W.dir, `${name}-master-salt.sealed`);
  step(
    'recover export',
    ['recover', 'export', '--pot', pot, '--out', exp, ...B],
    pp(PASS, `${PASS}-export`, `${PASS}-export`),
  );
  step('recover drill', ['recover', 'drill', '--pot', pot, '--file', exp, '--passphrase-stdin'], pp(`${PASS}-export`));
  return step('namespace', ['namespace', '--pot', pot, ...B]);
}
const identity = (pot, slug, pair, more = []) =>
  W.run(['identity', slug, '--pot', pot, '--pair', pair, '--fp-attests', '1', ...more, ...B], { input: pp(PASS) });

// ── one arc ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const pot1 = W.newPot('one-arc');
let seeded = null,
  arcAsks = [];
try {
  const n0 = asks().length;
  seeded = await W.seedPot(pot1, { name: 'marta' });
  arcAsks = since(n0);
} catch (e) {
  arcAsks = [`the arc stopped: ${e.message}`];
}

await t('one-arc-asks-the-set-once-and-bonsais-entry-once-more', async () => {
  const g = seeded ? gardenJson(pot1) : {};
  const nsOut = seeded ? seeded.steps.find(([w]) => w === 'namespace')[1].stdout : '';
  return [
    JSON.stringify(arcAsks) === JSON.stringify(['ASK baisai', 'ASK bonsai']) &&
      g.release?.manifest === 'SEED-MANIFEST.json' &&
      g.release.signer === 'baisai' &&
      typeof g.release.vouched === 'string' &&
      typeof g.release.spent === 'string' &&
      /believed through SEED-MANIFEST\.json/.test(nsOut),
    `asked ${JSON.stringify(arcAsks)}; record ${JSON.stringify(g.release || null).slice(0, 160)}`,
  ];
});

await t('a-verb-after-seed-asks-again', async () => {
  const n0 = asks().length;
  const r = identity(pot1, 'mika', pairOf(28, 29));
  return [
    r.code === 0 && JSON.stringify(since(n0)) === '["ASK baisai"]',
    `${out(r)}; asked ${JSON.stringify(since(n0))}`,
  ];
});

// ── the record, edited ──────────────────────────────────────────────────────────────────────────────────────────────
await t('the-release-record-edited-is-refused-as-a-finding', async () => {
  const pot = W.newPot('edited');
  toNamespace(pot, 'nora');
  const g = gardenJson(pot);
  fs.writeFileSync(
    path.join(pot, 'garden.json'),
    `${JSON.stringify({ ...g, release: { ...g.release, vouched: '2026-01-01T00:00:00.000Z' } }, null, 2)}\n`,
  );
  const before = locks(pot);
  const n0 = asks().length;
  const r = identity(pot, 'ana', pairOf(21, 70));
  return [
    r.code === 2 &&
      /not under the root's seal/.test(r.stderr) &&
      /finding/.test(r.stderr) &&
      locks(pot) === before &&
      since(n0).length === 0,
    `${out(r)}; asked ${since(n0).length}`,
  ];
});

await t('a-record-re-sealed-by-another-key-is-refused-before-the-lock', async () => {
  const pot = W.newPot('resealed');
  toNamespace(pot, 'olga');
  const g = gardenJson(pot);
  const other = FAKE.throwawaySigner(g.name); // the root's slug, another key: the root's seal alone cannot tell
  fs.writeFileSync(
    path.join(pot, 'garden.json'),
    `${JSON.stringify({ ...g, 'root-public-key': other.b64, release: { ...g.release, vouched: '2026-01-01T00:00:00.000Z' } }, null, 2)}\n`,
  );
  await FAKE.sealWith(path.join(W.core, 'skills', 'bonsai-garden-sign', 'lib'), path.join(pot, 'garden.json'), other, {
    target: 'garden.json',
  });
  const before = locks(pot);
  const n0 = asks().length;
  const cand = identity(pot, 'ana', pairOf(21, 70), ['--candidates']);
  const lock = identity(pot, 'ana', pairOf(21, 70));
  return [
    cand.code === 0 &&
      lock.code === 2 &&
      /not under the root key custody gives/.test(lock.stderr) &&
      locks(pot) === before &&
      since(n0).length === 0,
    `candidates ${cand.code} · lock ${out(lock)}; asked ${since(n0).length}`,
  ];
});

// ── the record never stands in for Bonsai's entry (§8.1, ruled 2026-10-21: it stays a question of its own) ──────────
await t('the-release-record-never-stands-in-for-bonsais-entry', async () => {
  const pot = W.newPot('record-stands');
  toNamespace(pot, 'quilla');
  const step = (what, args) => {
    const r = W.run(args, { input: pp(PASS) });
    if (r.code !== 0) throw new Error(`${what} exited ${r.code}: ${out(r)}`);
  };
  step('identity ana', ['identity', 'ana', '--pot', pot, '--pair', pairOf(21, 70), '--fp-attests', '1', ...B]);
  step('identity bonsai-shin', ['identity', 'bonsai-shin', '--pot', pot, '--fp-attests', '1', ...B]);
  step('identity kiko', ['identity', 'kiko', '--pot', pot, '--pair', pairOf(26, 27), '--fp-attests', '1', ...B]);
  for (const slug of ['quilla', 'ana', 'bonsai-shin', 'kiko'])
    step(`derive ${slug}`, ['derive', slug, '--pot', pot, ...B]);
  const held = gardenJson(pot).release;
  // an entry that agrees with itself, sealed owner as "bonsai" by a key the site does not hold: only the question refuses it
  const other = W.stranger('bonsai');
  const f = path.join(W.dir, 'record-stands-seed-entry.json');
  fs.writeFileSync(
    f,
    `${JSON.stringify({ format: 'bonsai-garden-seed-entry/1', slug: 'bonsai', kanji: '盆才守神', 'public-key': other.raw.toString('base64'), fingerprint: other.fingerprint, 'fp-attests': 2, source: 'a throwaway fixture' }, null, 2)}\n`,
  );
  await W.seal(f, other, { target: 'agents/bonsai/identity/bonsai-seed-entry.json' });
  const n0 = asks().length;
  const r = W.run(['seed', '--pot', pot, '--bonsai-entry', f, ...B], { input: pp(PASS) });
  const g = gardenJson(pot);
  return [
    held?.manifest === 'SEED-MANIFEST.json' &&
      !held.spent &&
      r.code === 2 &&
      /rejected/.test(r.stderr) &&
      JSON.stringify(since(n0)) === '["ASK bonsai"]' &&
      !fs.existsSync(path.join(pot, 'agents', 'registry.json')) &&
      !g.release?.spent,
    `record ${held ? (held.spent ? 'spent' : 'unspent') : 'absent'} · seed ${out(r)}; asked ${JSON.stringify(since(n0))}`,
  ];
});

// ── the manifest, replaced ──────────────────────────────────────────────────────────────────────────────────────────
await t('the-manifest-replaced-after-namespace-is-asked-again', async () => {
  const pot = W.newPot('replaced');
  toNamespace(pot, 'pia');
  const n0 = asks().length;
  const same = identity(pot, 'ana', pairOf(21, 70));
  const n1 = asks().length;
  await W.resealManifest((m) => ({ ...m, version: '0.9.2-rc.1' }));
  const next = identity(pot, 'kiko', pairOf(26, 27));
  await W.resealManifest(); // the world's manifest as it was, for any case after this one
  return [
    same.code === 0 && n1 === n0 && next.code === 0 && JSON.stringify(since(n1)) === '["ASK baisai"]',
    `same manifest: ${same.code}, asked ${n1 - n0} · replaced: ${out(next)}, asked ${JSON.stringify(since(n1))}`,
  ];
});

// ── the /stats count beside Bonsai's seal (§8.1's count, the site's src/stats.js; seed only) ───────────────────────
await t('seed-sends-its-count-beside-bonsais-seal-and-nothing-of-the-garden', async () => {
  // names a hyphen keeps out of base64, hex and kanji, so a find is a leak and never a chance
  const pot = W.newPot('counted');
  const b0 = W.siteBodies().length;
  let err = null;
  try {
    await W.seedPot(pot, { name: 'wren-hollow', gardener: 'tova-ana', shin: 'kiko-ren', attest: false });
  } catch (e) {
    err = e.message;
  }
  if (err) return [false, err];
  const bodies = W.siteBodies().slice(b0);
  const parsed = bodies.map((b) => JSON.parse(b));
  const seedAsk = parsed.filter((b) => b.signer === 'bonsai');
  const others = parsed.filter((b) => b.signer !== 'bonsai');
  const g = gardenJson(pot);
  const secret = [
    g.garden,
    g.namespace.kanji,
    g['root-fingerprint'],
    g['root-public-key'],
    'wren-hollow',
    'tova-ana',
    'kiko-ren',
  ];
  const found = secret.filter((x) => bodies.some((b) => b.includes(x)));
  const one = seedAsk[0] || {};
  return [
    seedAsk.length === 1 &&
      Object.keys(one).sort().join(',') === 'count,format,payload,signature,signer' &&
      JSON.stringify(one.count) === JSON.stringify({ event: 'seed', release: '0.9.2-rc', 'lab-preview': true }) &&
      others.length > 0 &&
      others.every((b) => !('count' in b)) &&
      found.length === 0,
    `seed asked ${seedAsk.length}× with ${JSON.stringify(one.count ?? null)}; ${others.length} other question(s), counted ${others.filter((b) => 'count' in b).length}; garden material found ${JSON.stringify(found)}`,
  ];
});

await t('a-checkout-without-a-release-manifest-sends-no-count', async () => {
  const W2 = await makeWorld({ srcCore: SRC, label: 'release-record-workshop' });
  const pot = W2.newPot('workshop');
  let err = null,
    steps = null;
  try {
    ({ steps } = await W2.seedPot(pot, { name: 'marta', attest: false }));
  } catch (e) {
    err = e.message;
  }
  if (err) return [false, err];
  const seedAsk = W2.siteBodies()
    .map((b) => JSON.parse(b))
    .filter((b) => b.signer === 'bonsai');
  const seedOut = steps.find(([w]) => w === 'seed')[1].stdout;
  return [
    seedAsk.length === 1 && !('count' in seedAsk[0]) && /not counted/.test(seedOut),
    `seed asked ${seedAsk.length}×, count ${JSON.stringify(seedAsk[0]?.count ?? null)}; ${seedOut.split('\n').find((l) => /counted/.test(l)) || 'no count line'}`,
  ];
});

await t('a-malformed-count-is-not-sent-and-the-answer-is-the-same', async () => {
  const { makeOrigin } = await import(path.join(SRC, 'skills', 'bonsai-garden-mark', 'origin.mjs'));
  const { canonicalAnswer } = await import(path.join(SRC, 'skills', 'bonsai-garden-sign', 'lib', 'published-keys.mjs'));
  const signer = FAKE.throwawaySigner('bonsai');
  const verifier = FAKE.keypair();
  const site = FAKE.fakeSite({ signers: [signer], verifier, mode: 'vouch', canonicalAnswer });
  const sent = [];
  const origin = makeOrigin({
    fetchImpl: async (u, init) => {
      sent.push(JSON.parse(init.body));
      return site.fetchImpl(u, init);
    },
    pinnedKey: verifier.b64,
  });
  const f = path.join(W.dir, 'count-probe.json');
  fs.writeFileSync(f, '{"format":"bonsai-garden-seed-entry/1"}\n');
  await FAKE.sealWith(path.join(W.core, 'skills', 'bonsai-garden-sign', 'lib'), f, signer, {
    target: 'agents/bonsai/identity/bonsai-seed-entry.json',
  });
  const data = JSON.parse(fs.readFileSync(path.join(W.dir, '.count-probe.json.bonsaisig'), 'utf8'));
  const good = { event: 'seed', release: '0.9.2-rc', 'lab-preview': false };
  const bad = {
    'a fourth key': { ...good, garden: '01M5FTTQWR6XJZQ5QDH278CC2V' },
    'lab-preview missing': { event: 'seed', release: '0.9.2-rc' },
    'planted, never through /verify': { ...good, event: 'planted' },
    'a build stamp': { ...good, release: '0.9.2-rc-20261021T1900Z' },
    'no version': { ...good, release: 'latest' },
    'lab-preview a word': { ...good, 'lab-preview': 'yes' },
    'an array': [good],
  };
  const plain = await origin.ask(data);
  const counted = await origin.ask(data, { count: good });
  const wrong = [];
  for (const [what, count] of Object.entries(bad)) {
    const v = await origin.ask(data, { count });
    if ('count' in sent.at(-1) || v.status !== plain.status || v.counted !== null) wrong.push(what);
  }
  return [
    plain.status === 'signature-vouched' &&
      counted.status === plain.status &&
      counted.verifiedAt === plain.verifiedAt &&
      !('count' in sent[0]) &&
      JSON.stringify(sent[1].count) === JSON.stringify(good) &&
      wrong.length === 0,
    `plain ${plain.status}, counted ${counted.status} with ${JSON.stringify(sent[1]?.count)}; malformed sent or judged otherwise: ${JSON.stringify(wrong)}`,
  ];
});

await t('a-count-is-claimed-only-for-a-seal-the-site-vouched', async () => {
  // the site counts a seal it vouches for and nothing else; a count the site never took is never said to be counted
  const { makeOrigin } = await import(path.join(SRC, 'skills', 'bonsai-garden-mark', 'origin.mjs'));
  const { canonicalAnswer } = await import(path.join(SRC, 'skills', 'bonsai-garden-sign', 'lib', 'published-keys.mjs'));
  const signer = FAKE.throwawaySigner('bonsai');
  const verifier = FAKE.keypair();
  const site = FAKE.fakeSite({ signers: [signer], verifier, mode: 'vouch', canonicalAnswer });
  const origin = makeOrigin({ fetchImpl: site.fetchImpl, pinnedKey: verifier.b64 });
  const f = path.join(W.dir, 'count-claim-probe.json');
  fs.writeFileSync(f, '{"format":"bonsai-garden-seed-entry/1"}\n');
  await FAKE.sealWith(path.join(W.core, 'skills', 'bonsai-garden-sign', 'lib'), f, signer, {
    target: 'agents/bonsai/identity/bonsai-seed-entry.json',
  });
  const data = JSON.parse(fs.readFileSync(path.join(W.dir, '.count-claim-probe.json.bonsaisig'), 'utf8'));
  const good = { event: 'seed', release: '0.9.2-rc', 'lab-preview': false };
  const seen = {};
  for (const mode of ['vouch', 'rejected', 'forged', 'unsigned', 'unreachable', 'http-500']) {
    site.setMode(mode);
    const v = await origin.ask(data, { count: good });
    seen[mode] = { status: v.status, counted: v.counted };
  }
  const claimed = Object.entries(seen)
    .filter(([m, s]) => m !== 'vouch' && s.counted !== null)
    .map(([m]) => m);
  return [
    seen.vouch.status === 'signature-vouched' &&
      JSON.stringify(seen.vouch.counted) === JSON.stringify(good) &&
      Object.entries(seen).every(([m, s]) => m === 'vouch' || s.status !== 'signature-vouched') &&
      claimed.length === 0,
    `vouched: ${JSON.stringify(seen.vouch)}; claimed counted without a vouch: ${JSON.stringify(claimed)}`,
  ];
});

const failed = results.filter((x) => !x).length;
console.log(
  `\n${results.length - failed}/${results.length} passed${failed ? ` — ${failed} FAILED` : ''}   (scratch: ${W.dir})`,
);
process.exit(failed ? 1 : 0);
