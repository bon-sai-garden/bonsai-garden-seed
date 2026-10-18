// ---
// id: 01M3BS43S6NN65EPDMVBN33Y17
// ---
/**
 * published-keys.mjs — ask the published keys, never the package.
 *
 * Mori-shin's ruling, 2026-09-24, under the Aruji's steer (carried by Bonsai):
 * *"verifying core offline is out of scope"* and, with no reach to the public
 * keys, *"it should fail loudly."* The full ruling, and why, is
 * ../references/trust-anchor.md.
 *
 * SEAL v2: a v2 seal sends {format, signer, payload, signature}; the
 * site verifies the signature over those exact payload bytes and answers, signed,
 * with the payload's sha256, so an answer cannot be replayed for another seal.
 * Target, id and bytes are checked here, where the file is.
 *
 * WHAT THIS DOES
 * --------------
 * A seal's signer, body-hash and signature go to https://bon-sai.garden/verify
 * — the one public trust surface (spec-key-management-and-verify, decision #9).
 * The site holds the keys and answers for one seal at a time; it publishes no
 * roster (decision #1), so nothing here can list the kin. Its answer is signed
 * by the workshop verifier key (decision #11), and that signature is checked
 * here before a single field of the answer is believed.
 *
 * WHAT TRAVELS, AND WHAT DOES NOT
 * -------------------------------
 * No signer's key travels with this code. A key that travels with what it
 * verifies proves only that the package agrees with itself; someone who swaps
 * both passes. What travels is the site's address and the verifier key, a pin
 * on the *channel*, which vouches for no seal on its own. Beating this means
 * breaking bon-sai.garden and its TLS, or rewriting this file. Rewriting this
 * file beats every verifier that ships inside what it checks; no code can
 * defend against its own replacement, and this does not claim to.
 *
 * WHAT IT REFUSES
 * ---------------
 * Every failure is loud and none of them reads as `ok`:
 *   keys-unreachable   the site did not answer (network, timeout, non-200)
 *   answer-unsigned    the site answered ok with no response_sig
 *   answer-forged      the response_sig does not verify under the pinned key
 *   answer-malformed   the answer is not the /verify contract
 *   rejected           the site does not vouch for this seal: an unknown signer
 *                      or a bad signature, deliberately indistinguishable there
 * There is no cache, no offline mode, and no fallback to a local key.
 */

import { webcrypto, createHash } from 'node:crypto';
import { V2_FORMAT, v2Payload, v2SchemaProblem } from './seal-v2.mjs';

export const PUBLISHED_VERIFY_URL = 'https://bon-sai.garden/verify';

/**
 * The workshop verifier key: base64, raw 32 bytes. The same value the site's
 * generated keys.js exports as WORKSHOP_VERIFY_PK. It is a pin on the channel.
 * It is not a signer's key, and it cannot make a seal verify.
 */
export const WORKSHOP_VERIFY_PK = 'nC0eCKpG+TXJhDQu1eQx9YHUQ3GaCpqUAt3s7H0adj0=';

const TIMEOUT_MS = 15000;

/** The worker's canonical form: keys sorted, response_sig excluded. */
export function canonicalAnswer(obj) {
  const sorted = {};
  for (const k of Object.keys(obj).sort()) if (k !== 'response_sig') sorted[k] = obj[k];
  return JSON.stringify(sorted);
}

async function answerSigHolds(answer, pinnedB64) {
  if (typeof answer.response_sig !== 'string') return false;
  try {
    const pk = await webcrypto.subtle.importKey('raw', Buffer.from(pinnedB64, 'base64'), { name: 'Ed25519' }, false, [
      'verify',
    ]);
    return await webcrypto.subtle.verify(
      'Ed25519',
      pk,
      Buffer.from(answer.response_sig, 'base64'),
      new TextEncoder().encode(canonicalAnswer(answer)),
    );
  } catch {
    return false;
  }
}

/**
 * Ask the site once and believe the answer only if it is signed by the pinned key.
 * Returns { answer } for a vouched `ok:true`, else { status, reason } — one of
 * keys-unreachable · answer-malformed · rejected · answer-unsigned · answer-forged.
 */
async function askSite(body, { fetchImpl, pinnedKey, url }) {
  let resp;
  try {
    resp = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return {
      status: 'keys-unreachable',
      reason: `cannot reach the published keys at ${url} (${err.name === 'TimeoutError' ? 'timed out' : err.message}); not verified`,
    };
  }
  if (resp.status !== 200) {
    return {
      status: 'keys-unreachable',
      reason: `the published keys at ${url} answered HTTP ${resp.status}; not verified`,
    };
  }
  let answer;
  try {
    answer = await resp.json();
  } catch {
    return { status: 'answer-malformed', reason: `${url} did not answer JSON; not verified` };
  }
  if (!answer || typeof answer !== 'object' || typeof answer.ok !== 'boolean') {
    return { status: 'answer-malformed', reason: `${url} did not answer the /verify contract; not verified` };
  }
  if (answer.ok !== true) {
    return {
      status: 'rejected',
      reason:
        'the published keys do not vouch for this seal (unknown signer or bad signature; the site does not say which)',
    };
  }
  if (typeof answer.response_sig !== 'string') {
    return {
      status: 'answer-unsigned',
      reason: `${url} answered ok without a response_sig; an unsigned answer is not believed`,
    };
  }
  if (!(await answerSigHolds(answer, pinnedKey))) {
    return {
      status: 'answer-forged',
      reason: `the answer's response_sig does not verify under the workshop verifier key; not believed`,
    };
  }
  return { answer };
}

/**
 * Adjudicate one v1 seal against the published keys (callers retire the result).
 *
 * Same order as the local verdict (verify.mjs `adjudicate`): who signed, then
 * whether the stored fingerprint is theirs, then the hash, then the signature,
 * which the site has already checked. A seal under the wrong key reads
 * `bad-signature`, not `hash-mismatch`, exactly as before.
 *
 * `fetchImpl` and `pinnedKey` exist for the negative tests only. There is
 * deliberately no environment variable that redirects either one: an env var
 * that can move the trust anchor is a trust anchor.
 */
export async function adjudicatePublished({
  meta,
  actualHash,
  fetchImpl = fetch,
  pinnedKey = WORKSHOP_VERIFY_PK,
  url = PUBLISHED_VERIFY_URL,
}) {
  const signer = meta.signer || '';
  const storedHash = meta['body-hash'] || '';
  const storedSig = meta.signature || '';
  const storedFp = meta.fingerprint || '';
  const say = (status, reason) => ({ status, meta, reason });

  const r = await askSite({ signer, body_hash: storedHash, signature: storedSig }, { fetchImpl, pinnedKey, url });
  if (!r.answer) return say(r.status, r.reason);
  const answer = r.answer;
  if (answer.signer !== signer) {
    return say('answer-malformed', `${url} answered for '${answer.signer}', not '${signer}'`);
  }
  meta._key_path = `published ${url}`;
  if (answer.kanji) meta._kanji = answer.kanji;
  if (storedFp && storedFp !== answer.fingerprint) return say('bad-signature');
  if (actualHash !== storedHash) return say('hash-mismatch');
  return say('ok');
}

/**
 * Seal v2: the site is asked whether the SIGNATURE holds over the exact
 * v2 payload under the signer's published key; the rest (target, id, bytes) is
 * checked locally by the caller, because only the caller holds the file.
 *
 * The request carries the payload itself, as a string, so the site verifies the
 * very bytes this verifier built and needs no second copy of the payload builder.
 * The signed answer names format, signer, fingerprint, role, and the sha256 of the
 * payload it vouched for: an answer replayed from another seal by the same signer
 * does not match (the v1 answer named only the signer, and could be replayed).
 *
 * Returns { status: 'signature-vouched', meta } or a failing verdict.
 */
export async function adjudicatePublishedV2({
  data,
  fetchImpl = fetch,
  pinnedKey = WORKSHOP_VERIFY_PK,
  url = PUBLISHED_VERIFY_URL,
}) {
  const meta = { ...data };
  const say = (status, reason) => ({ status, meta, reason });
  const problem = v2SchemaProblem(data);
  if (problem) return say(`bad-sidecar (${problem})`);
  const payload = v2Payload(data);
  const r = await askSite(
    { format: V2_FORMAT, signer: data.signer, payload: payload.toString('utf8'), signature: data.signature },
    { fetchImpl, pinnedKey, url },
  );
  if (!r.answer) return say(r.status, r.reason);
  const a = r.answer;
  if (a.format !== V2_FORMAT || a.signer !== data.signer) {
    return say(
      'answer-malformed',
      `${url} answered for ${a.format || 'v1'} '${a.signer}', not bonsaisig/2 '${data.signer}'`,
    );
  }
  if (a.payload_sha256 !== createHash('sha256').update(payload).digest('hex')) {
    return say('answer-malformed', `${url} vouched for another payload than this seal's (a replayed answer?)`);
  }
  meta._key_path = `published ${url}`;
  if (a.kanji) meta._kanji = a.kanji;
  if (a.fingerprint !== data.fingerprint)
    return say('bad-signature', "the fingerprint is not the signer's published key");
  if (a.role !== data.role)
    return say('answer-malformed', `${url} read the role as '${a.role}', the seal says '${data.role}'`);
  return say('signature-vouched');
}
