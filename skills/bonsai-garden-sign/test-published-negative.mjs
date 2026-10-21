#!/usr/bin/env node
// ---
// id: 01M3BS43VG40EHXKDBYM99ZDPM
// ---
/**
 * test-published-negative.mjs — watch the published-keys verifier say no, for the right reason.
 *
 * lib/published-keys.mjs asks bon-sai.garden/verify instead of any key in the
 * package (references/trust-anchor.md). This harness stubs the site so that every
 * refusal can be forced and named. A verifier that answered `keys-unreachable`
 * for everything would pass a test that only checked "non-zero exit"; each case
 * here asserts one verdict.
 *
 * Two generations are watched. The published path for a v1 seal (three fields
 * out, a v1 answer back, retired-v1 under the cutover) and for a v2 seal (the
 * payload itself out, an answer bound to that payload's sha256 back). A v1-shaped
 * answer to a v2 seal is itself a refusal here: a site that has not learned v2
 * must not be believed for one.
 *
 * The site's verifier key is replaced by a THROWAWAY keypair for the stub, via
 * the `pinnedKey` parameter that exists for this harness only. There is no env
 * variable that can do the same thing to the real verifier.
 *
 * Usage:  node test-published-negative.mjs            (no network, no keys needed)
 *         node test-published-negative.mjs --live     (also asks the real site once)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { webcrypto, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { verifySidecarFilePublished } from './lib/verify.mjs';
import { blake2b512Hex } from './lib/embedded-format.mjs';
import { findSidecar, sidecarPathFor, buildSidecarObject, readSidecar } from './lib/sidecar-format.mjs';
import { canonicalAnswer, PUBLISHED_VERIFY_URL } from './lib/published-keys.mjs';
import { V2_FORMAT, v2Payload, sidecarGeneration, readSealPolicy } from './lib/seal-v2.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const subtle = webcrypto.subtle;

// A scratch seal root: v2 names a file by its address under a root, so the copy
// must sit at the address its seal was made for.
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'published-negative-')));
fs.mkdirSync(path.join(tmp, 'agents'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'agents', 'registry.json'), '{}\n');

// v2: a real sealed file, this skill's own SKILL.md and its sidecar, copied.
const realSeal = readSidecar(findSidecar(path.join(HERE, 'SKILL.md')).path).data;
if (sidecarGeneration(realSeal) !== 'v2') {
  console.error(
    "this skill's SKILL.md no longer carries a bonsaisig/2 seal; the v2 cases have nothing real to stand on",
  );
  process.exit(1);
}
const target = path.join(tmp, ...realSeal.target.split('/'));
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(path.join(HERE, 'SKILL.md'), target);
fs.copyFileSync(findSidecar(path.join(HERE, 'SKILL.md')).path, sidecarPathFor(target)); // through the finder; planted at the writer's address
const seal = realSeal;
// a signer that is not the seal's, whoever sealed SKILL.md last (a custodian re-seal changes it, 2026-10-21)
const OTHER_SIGNER = seal.signer === 'baisai' ? 'tasai' : 'baisai';
const payload = v2Payload(seal);
const payloadSha = createHash('sha256').update(payload).digest('hex');

// v1: a sidecar in the v1 shape over a scratch file. Its signature is a throwaway:
// on the published path only the site judges a v1 signature, and the site is the stub.
// No kin's v1 seal is left in this skill to copy, which is the point of the retirement.
const v1Target = path.join(tmp, 'docs', 'v1-note.txt');
fs.mkdirSync(path.dirname(v1Target), { recursive: true });
fs.writeFileSync(v1Target, 'a file sealed in the retired v1 form\n');
const v1Seal = buildSidecarObject({
  signer: seal.signer,
  fingerprint: seal.fingerprint,
  timestamp: '2026-09-24T00:00:00Z',
  target: 'docs/v1-note.txt',
  bodyHash: blake2b512Hex(fs.readFileSync(v1Target)),
  signatureB64: Buffer.alloc(64, 7).toString('base64'),
});
fs.writeFileSync(sidecarPathFor(v1Target), `${JSON.stringify(v1Seal, null, 2)}\n`);
if (sidecarGeneration(v1Seal) !== 'v1') {
  console.error('the v1 fixture is not read as v1');
  process.exit(1);
}

// The cutover is pinned per case, so this harness says the same thing on either side of the flip.
const WARN = { ...readSealPolicy(), v1: 'warn', why: null };
const REFUSE = { ...readSealPolicy(), v1: 'refuse', why: null };

async function keypair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const raw = Buffer.from(await subtle.exportKey('raw', kp.publicKey)).toString('base64');
  return { sk: kp.privateKey, pkB64: raw };
}
const site = await keypair(); // stands in for the workshop verifier key
const impostor = await keypair(); // someone else's key

async function signed(answer, by = site) {
  const sig = await subtle.sign('Ed25519', by.sk, new TextEncoder().encode(canonicalAnswer(answer)));
  return { ...answer, response_sig: Buffer.from(sig).toString('base64') };
}

// What the site answers for a v1 seal, and for a v2 seal.
const goodV1 = {
  ok: true,
  signer: seal.signer,
  fingerprint: seal.fingerprint,
  kanji: '守身',
  verified_at: '2026-09-24T00:00:00.000Z',
};
const goodV2 = {
  ok: true,
  format: V2_FORMAT,
  signer: seal.signer,
  fingerprint: seal.fingerprint,
  role: seal.role,
  payload_sha256: payloadSha,
  kanji: '守身',
  verified_at: '2026-10-13T00:00:00.000Z',
};

let sent = null;
function stub(respond) {
  return async (url, init) => {
    sent = { url, body: JSON.parse(init.body) };
    return respond();
  };
}
const json = (obj, status = 200) => stub(() => new Response(JSON.stringify(obj), { status }));

let pass = 0,
  fail = 0;
function check(ok, label) {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);
}
async function expect(label, status, fetchImpl, { file = target, policy = WARN } = {}) {
  const r = await verifySidecarFilePublished(file, { fetchImpl, pinnedKey: site.pkB64, policy });
  const ok = r.status === status;
  if (ok) pass++;
  else fail++;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${label}  → ${r.status}${ok ? '' : ` (wanted ${status}; ${r.reason || ''})`}`,
  );
  return r;
}

console.log('published-keys verifier — every refusal, forced\n');

// ── the channel: the same for both generations (asked here with the v2 seal) ──
console.log('the channel');
await expect('the site cannot be reached', 'keys-unreachable', async () => {
  throw new TypeError('fetch failed');
});
await expect('the site answers 503', 'keys-unreachable', json({ ok: false }, 503));
await expect(
  'the site answers something that is not JSON',
  'answer-malformed',
  stub(() => new Response('<html>', { status: 200 })),
);
await expect('the site answers JSON outside the contract', 'answer-malformed', json({ hello: 1 }));
await expect('the site does not vouch (ok:false)', 'rejected', json({ ok: false }));
await expect('ok, but unsigned', 'answer-unsigned', json(goodV2));
await expect('ok, signed by a key that is not the verifier key', 'answer-forged', json(await signed(goodV2, impostor)));
await expect(
  'ok, signed, one field altered after signing',
  'answer-forged',
  json({ ...(await signed(goodV2)), kanji: '偽物' }),
);
await expect(
  'ok, signed, the vouched payload swapped after signing',
  'answer-forged',
  json({ ...(await signed({ ...goodV2, payload_sha256: '0'.repeat(64) })), payload_sha256: payloadSha }),
);

// ── a v2 seal ────────────────────────────────────────────────────────────────
console.log("\na v2 seal (this skill's own SKILL.md)");
await expect(
  'a signed v1-shaped answer to a v2 seal (a site that has not learned v2)',
  'answer-malformed',
  json(await signed(goodV1)),
);
await expect(
  'ok, signed, everything a v2 answer carries except the format',
  'answer-malformed',
  json(await signed((({ format, ...rest }) => rest)(goodV2))),
);
await expect(
  'ok, signed, a format that is not bonsaisig/2',
  'answer-malformed',
  json(await signed({ ...goodV2, format: 'bonsaisig/1' })),
);
await expect(
  'ok, signed, but for a different signer',
  'answer-malformed',
  json(await signed({ ...goodV2, signer: OTHER_SIGNER })),
);
await expect(
  'ok, signed, but vouching for another payload (a replayed answer)',
  'answer-malformed',
  json(await signed({ ...goodV2, payload_sha256: createHash('sha256').update('another seal').digest('hex') })),
);
await expect(
  'ok, signed, no payload hash at all',
  'answer-malformed',
  json(await signed((({ payload_sha256, ...rest }) => rest)(goodV2))),
);
await expect(
  'ok, signed, fingerprint not the one the seal claims',
  'bad-signature',
  json(await signed({ ...goodV2, fingerprint: '0'.repeat(32) })),
);
await expect(
  'ok, signed, the site read another role than the seal says',
  'answer-malformed',
  json(await signed({ ...goodV2, role: seal.role === 'owner' ? 'custodian' : 'owner' })),
);

const goodTwo = await expect('ok, signed, all agrees', 'ok', json(await signed(goodV2)));
check(goodTwo.generation === 'v2', '… read as a v2 seal');
check(
  sent &&
    sent.url === PUBLISHED_VERIFY_URL &&
    sent.body.format === V2_FORMAT &&
    sent.body.signer === seal.signer &&
    sent.body.payload === payload.toString('utf8') &&
    sent.body.signature === seal.signature &&
    Object.keys(sent.body).length === 4,
  `the request carried format, signer, the exact payload and the signature, nothing else, to ${PUBLISHED_VERIFY_URL}`,
);
check(
  !!goodTwo.meta && goodTwo.meta._key_path === `published ${PUBLISHED_VERIFY_URL}`,
  'an ok names where its key came from',
);
await expect('the cutover on refuse does not touch a v2 seal', 'ok', json(await signed(goodV2)), { policy: REFUSE });

// the site vouches for the signature; what only the holder of the file can check is still checked
const moved = path.join(tmp, 'elsewhere', 'SKILL.md');
fs.mkdirSync(path.dirname(moved), { recursive: true });
fs.copyFileSync(target, moved);
fs.copyFileSync(sidecarPathFor(target), sidecarPathFor(moved));
// F-12 (2026-10-21): the address is provenance, never a verdict. The same bytes at another address read ok, and the
// verdict says where they were sealed (Mori-shin's test 1, on the published path)
const movedV = await expect(
  'the seal copied onto the same bytes at another address, site vouches: ok, sealed at its own address',
  'ok',
  json(await signed(goodV2)),
  { file: moved },
);
check(
  movedV.moved === true &&
    movedV.sealedAt === seal.target &&
    typeof movedV.foundAt === 'string' &&
    movedV.foundAt !== seal.target,
  `… the verdict carries sealedAt ${seal.target}, foundAt and moved (got ${JSON.stringify([movedV.sealedAt, movedV.foundAt, movedV.moved])})`,
);
const inPlace = await expect('… and in place, the same seal reads ok, not moved', 'ok', json(await signed(goodV2)));
check(
  inPlace.moved === false && inPlace.sealedAt === seal.target && inPlace.foundAt === seal.target,
  `… in place: sealedAt = foundAt, moved false (got ${JSON.stringify([inPlace.sealedAt, inPlace.foundAt, inPlace.moved])})`,
);
fs.writeFileSync(moved, `${fs.readFileSync(moved, 'utf8')} `);
await expect(
  'the moved copy changed, site vouches for the seal: hash-mismatch wherever it sits',
  'hash-mismatch',
  json(await signed(goodV2)),
  {
    file: moved,
  },
);
fs.appendFileSync(target, ' ');
await expect('the file changed after sealing, site vouches for the seal', 'hash-mismatch', json(await signed(goodV2)));

// ── a v1 seal: retired, and still judged for the right reason ────────────────
console.log('\na v1 seal (retired)');
const v1 = { file: v1Target };
await expect(
  'ok, signed, but for a different signer',
  'answer-malformed',
  json(await signed({ ...goodV1, signer: OTHER_SIGNER })),
  v1,
);
await expect(
  'ok, signed, fingerprint not the one the seal claims',
  'bad-signature',
  json(await signed({ ...goodV1, fingerprint: '0'.repeat(32) })),
  v1,
);
await expect('the site does not vouch (ok:false)', 'rejected', json({ ok: false }), v1);
const good = await expect(
  'ok, signed, all agrees (retired-v1, accepted while the cutover says warn)',
  'retired-v1',
  json(await signed(goodV1)),
  v1,
);
check(good.accepted === true, '… accepted under the warn cutover');
check(
  sent &&
    sent.url === PUBLISHED_VERIFY_URL &&
    sent.body.signer === v1Seal.signer &&
    sent.body.body_hash === v1Seal['body-hash'] &&
    sent.body.signature === v1Seal.signature &&
    Object.keys(sent.body).length === 3,
  `the request carried the seal's three fields and nothing else, to ${PUBLISHED_VERIFY_URL}`,
);
check(
  !!good.meta && good.meta._key_path === `published ${PUBLISHED_VERIFY_URL}`,
  'an ok names where its key came from',
);
const refusedV1 = await expect('the same, once the cutover says refuse', 'retired-v1', json(await signed(goodV1)), {
  ...v1,
  policy: REFUSE,
});
check(refusedV1.accepted === false, '… not accepted');
fs.appendFileSync(v1Target, ' ');
const stale = await expect(
  'the file changed after sealing, site vouches for the seal',
  'hash-mismatch',
  json(await signed(goodV1)),
  v1,
);
check(stale.accepted === false, '… not accepted');

if (process.argv.includes('--live')) {
  const r = await verifySidecarFilePublished(path.join(HERE, 'SKILL.md'));
  console.log(`\n  live  ${PUBLISHED_VERIFY_URL} on this SKILL.md → ${r.status}${r.reason ? ` (${r.reason})` : ''}`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\npass: ${pass}   fail: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
