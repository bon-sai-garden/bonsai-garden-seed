// ---
// id: 01M4AFY7KPT7ZSDSZ3HZ97D9HX
// title: A fake bon-sai.garden and throwaway seals, for the suites only
// type: script
// tended-by: baisai
// created: 2026-10-07
// updated: 2026-10-07
// ---
//
// test-fake-origin.mjs — TEST SUPPORT, never imported by anything a gardener runs.
//
// fakeSite() is a stand-in for bon-sai.garden's POST /verify, built from the worker's contract
// (the site's worker, its successVerify): it holds a table
// of throwaway signer keys, verifies a bonsaisig/2 signature over the exact payload it is sent,
// and answers signed by a THROWAWAY verifier key (never the workshop's). Modes model the failures
// published-keys.mjs names: vouch (an honest site), rejected (ok:false), forged (signed by another
// key), unsigned (no response_sig), unreachable (the request throws), http-500, and no-time (an
// honest answer without verified_at). Every request is appended to `calls` so a test can say the
// site was, or was not, asked.
//
// throwawaySigner() and sealWith() make a real v2 sidecar with a key born in this process and
// dropped with it. No real key, keychain, master salt or network is touched here.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function keypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  return {
    raw,
    privateKey,
    fingerprint: crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32),
    b64: raw.toString('base64'),
  };
}

export function throwawaySigner(slug) {
  return { slug, ...keypair() };
}

/** A real bonsaisig/2 sidecar on `file`, at its hidden name, by `signer` (a throwaway). */
export async function sealWith(signLib, file, signer, { target, role = 'owner', extra = {} } = {}) {
  const { buildV2, v2Payload } = await import(path.join(signLib, 'seal-v2.mjs'));
  const { newUlid } = await import(path.join(signLib, 'ulid-rule.mjs'));
  const bytes = fs.readFileSync(file);
  const obj = buildV2({
    id: newUlid(),
    signer: signer.slug,
    role,
    fingerprint: signer.fingerprint,
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    target,
    fileHash: crypto.createHash('blake2b512').update(bytes).digest('hex'),
  });
  Object.assign(obj, extra);
  obj.signature = crypto.sign(null, v2Payload(obj), signer.privateKey).toString('base64');
  const side = path.join(path.dirname(file), `.${path.basename(file)}.bonsaisig`);
  fs.writeFileSync(side, `${JSON.stringify(obj, null, 2)}\n`);
  return { side, data: obj };
}

/**
 * A fetch that answers as /verify would. `signers`: [{ slug, raw }]. `verifier`: the throwaway
 * verifier keypair whose public half the test pins. Returns { fetchImpl, calls, setMode }.
 */
export function fakeSite({ signers = [], verifier, mode = 'vouch', canonicalAnswer }) {
  const calls = [];
  const table = new Map(signers.map((s) => [s.slug, s]));
  const forger = keypair();
  let m = mode;
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    if (m === 'unreachable') throw new TypeError('fetch failed (the fake site is unreachable)');
    if (m === 'http-500') return new Response('oops', { status: 500 });
    const reply = (obj) =>
      new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (m === 'rejected') return reply({ ok: false });
    const s = table.get(body.signer);
    let holds = false;
    if (s && typeof body.payload === 'string' && typeof body.signature === 'string') {
      try {
        const pub = crypto.createPublicKey({
          key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), s.raw]),
          format: 'der',
          type: 'spki',
        });
        holds = crypto.verify(null, Buffer.from(body.payload, 'utf8'), pub, Buffer.from(body.signature, 'base64'));
      } catch {
        holds = false;
      }
    }
    if (!holds) return reply({ ok: false });
    let role = null;
    try {
      role = JSON.parse(body.payload.slice(body.payload.indexOf('\n') + 1)).role;
    } catch {
      /* none */
    }
    const answer = {
      ok: true,
      signer: body.signer,
      fingerprint: s.fingerprint,
      kanji: null,
      ...(m === 'no-time' ? {} : { verified_at: '2026-10-07T12:00:00.000Z' }),
      format: body.format,
      role,
      payload_sha256: crypto.createHash('sha256').update(Buffer.from(body.payload, 'utf8')).digest('hex'),
    };
    if (m === 'unsigned') return reply(answer);
    const key = m === 'forged' ? forger.privateKey : verifier.privateKey;
    answer.response_sig = crypto.sign(null, Buffer.from(canonicalAnswer(answer), 'utf8'), key).toString('base64');
    return reply(answer);
  };
  return {
    fetchImpl,
    calls,
    setMode: (x) => {
      m = x;
    },
  };
}
