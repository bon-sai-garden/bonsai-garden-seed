// ---
// id: 01M3BS43T0AFDQHWTQTMBRWZD2
// title: verify.mjs — the two verdicts, the read half of the signing layer
// type: script
// tended-by: mori-shin
// created: 2026-09-15
// updated: 2026-10-06
// ---
/**
 * verify.mjs — the two verdicts, ported from tools/sign.py's `verify_file` and
 * `verify_sidecar_file`.
 *
 * These are the read half of the signing layer, and the half
 * that has to be exactly right: a verifier that is merely *nearly* a port turns
 * a detected defect into a clean bill of health. That cost is not theoretical —
 * stale seals sitting committed, found only because `verify-sidecar` existed.
 *
 * THE STATUS VOCABULARY IS THE CONTRACT. Callers (tools/hooks/pre-exec-verify.sh,
 * tools/validate-metadata.py) branch on these strings:
 *
 *   embedded: ok · no-signature · unknown-signer · hash-mismatch · bad-signature
 *   sidecar:  ok · no-sidecar   · unknown-signer · hash-mismatch · bad-signature
 *             · bad-sidecar (<reason>)
 *   seal v2 (2026-09-24): the above, plus
 *             target-mismatch   the sidecar names another file (moved, renamed, copied)
 *             retired-v1        a v1 seal (embedded sign: block or v1 sidecar): body-only,
 *                               metadata unsigned. Accepted with a warning while
 *                               ../seal-policy.json says "v1": "warn"; refused once it
 *                               says "refuse". `accepted` on the verdict says which.
 *             open · open-drift · open-expired · open-malformed   (a v2 seal-open)
 *   sidecar name (the dot-prefixed sidecar change phase 3, 2026-10-05):
 *             two-sidecars      both X.bonsaisig and .X.bonsaisig beside one file; refused
 *             retired-sidecar-name   the seal sits at the old name X.bonsaisig. Accepted with
 *                               a warning while ../seal-policy.json says "sidecar-name":
 *                               "warn" and the seal itself holds; refused, whatever its
 *                               bytes, once it says "refuse". The reason names the fix.
 *   published (both forms, 2026-09-24): the above, less unknown-signer, plus
 *             rejected · keys-unreachable · answer-unsigned · answer-forged ·
 *             answer-malformed · open-unpublished — every one of them a FAIL
 *
 * ORDER OF CHECKS IS ALSO THE CONTRACT. sign.py checks the stored fingerprint
 * against the resolved key BEFORE recomputing the hash, so a file signed by the
 * wrong key reads `bad-signature` rather than `hash-mismatch`. Reordering these
 * changes verdicts on real files without changing a single cryptographic result.
 */

import fs from 'node:fs';
import path from 'node:path';
import { verifySignature } from './derive-key.mjs';
import { loadPublicKey, registryFingerprint } from './garden-root.mjs';
import { loadPotKey } from './pot-keys.mjs';
import { canonicalMdBody, blake2b512Hex, extractSignMd, parseMd } from './embedded-format.mjs';
import { findSidecar, readSidecar } from './sidecar-format.mjs';
import { adjudicatePublished, adjudicatePublishedV2 } from './published-keys.mjs';
import {
  sidecarGeneration,
  v2SchemaProblem,
  v2Payload,
  sealTargetFor,
  adjudicateBytes,
  readSealPolicy,
  sealAccepted,
  retiredSidecarNameReason,
  CUSTODY_REFUSED,
  RETIRED_V1,
  RETIRED_V1_REASON,
  RETIRED_SIDECAR_NAME,
} from './seal-v2.mjs';
import { ownId } from './ulid-rule.mjs';

/**
 * ed25519 verify without the noise. `verifySignature` writes to stderr when the
 * inputs are malformed; across a 143-file corpus sweep that turns a report into
 * a wall. The verdict is identical — only the console is quieter.
 */
function verifyQuiet(publicKeyHex, data, signatureB64) {
  const original = console.error;
  console.error = () => {};
  try {
    return verifySignature(publicKeyHex, data, signatureB64);
  } catch {
    return false;
  } finally {
    console.error = original;
  }
}

/**
 * Shared tail of both verdicts: resolve the signer's key, compare the stored
 * fingerprint, compare the hash, then check the signature. `actualHash` is the
 * caller's — it is the one thing the two forms compute differently.
 */
function adjudicate({ root, meta, actualHash }) {
  const signer = meta.signer || '';
  const storedHash = meta['body-hash'] || '';
  const storedSig = meta.signature || '';
  const storedFp = meta.fingerprint || '';

  let key;
  try {
    key = loadPublicKey(root, signer);
  } catch (err) {
    if (err.code === 'NO_PUBLIC_KEY') return { status: 'unknown-signer', meta };
    throw err; // a corrupt key file is not "unknown signer"
  }

  meta._key_path = path.relative(root, key.keyPath);

  if (storedFp && storedFp !== key.fingerprint) return { status: 'bad-signature', meta };
  if (actualHash !== storedHash) return { status: 'hash-mismatch', meta };

  const ok = verifyQuiet(key.publicKeyHex, Buffer.from(storedHash, 'hex'), storedSig);
  return { status: ok ? 'ok' : 'bad-signature', meta };
}

/**
 * The RAW v1 embedded verdict — port of sign.py `_verify_embedded_v1` (was
 * `verify_file`), markdown only. Callers want `verifyEmbeddedFile`, which retires it.
 *
 * PNG IS NOT PORTED. sign.py verifies a `.png` via a BonsaiSign iTXt chunk and
 * a pixel-byte canonicalisation that needs Pillow; core has no image dependency
 * and inventing one here would be a second definition of the PNG seal. This
 * throws `UNSUPPORTED_FORMAT` naming sign.py — loudly, so a caller cannot read
 * a refusal as a pass. A PNG with a v2 sidecar verifies like any other file.
 */
export function verifyEmbeddedV1(filePath, { root }) {
  const suffix = path.extname(filePath).toLowerCase();
  if (suffix !== '.md') {
    const err = new Error(
      `cannot verify ${filePath}: core's verifier reads embedded seals in .md only. ` +
        (suffix === '.png'
          ? `PNG seals live in a BonsaiSign iTXt chunk and are not ported — use ` +
            `\`python3 tools/sign.py verify\` for those.`
          : `Everything else is sealed by a .bonsaisig sidecar, and this file has none.`),
    );
    err.code = 'UNSUPPORTED_FORMAT';
    throw err;
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const meta = extractSignMd(text);
  if (!meta) return { status: 'no-signature', meta: null };

  const actualHash = blake2b512Hex(canonicalMdBody(text));
  const open = extractOpenMd(text);
  if (open !== null) return adjudicateOpen({ root, meta, open, actualHash });
  return adjudicate({ root, meta, actualHash });
}

/**
 * v1 is retired. While ../seal-policy.json says `"v1": "warn"`, a v1 seal
 * is still checked, and one that holds reads `retired-v1`, accepted, with a warning;
 * one that fails keeps its own verdict. Once it says `"refuse"`, every v1 seal reads
 * `retired-v1`, refused, whatever its bytes.
 */
export function retireV1(v1, policy = readSealPolicy()) {
  const why = policy.why ? `${RETIRED_V1_REASON} (${policy.why})` : RETIRED_V1_REASON;
  if (policy.v1 !== 'warn') return { ...v1, status: RETIRED_V1, accepted: false, generation: 'v1', reason: why };
  if (v1.status === 'ok') return { ...v1, status: RETIRED_V1, accepted: true, generation: 'v1', reason: why };
  return { ...v1, accepted: false, generation: 'v1' };
}

/**
 * THE document verdict (`verify --file`): a document's seal is its sidecar when it
 * has one — v2 is detached for every file — and only otherwise its retired embedded
 * block. A document carrying both is governed by the sidecar, which covers the old
 * block's bytes too.
 */
export function verifyEmbeddedFile(filePath, { root, policy } = {}) {
  if (findSidecar(filePath).status !== 'no-sidecar') return verifySidecarFile(filePath, { root, policy });
  const v1 = verifyEmbeddedV1(filePath, { root });
  if (v1.status === 'no-signature') return v1;
  return retireV1(v1, policy);
}

/**
 * Seal-open — port of sign.py `_verify_open` (Mori-shin's ruling, 2026-09-23).
 * Same statuses, same order: ok · open · open-drift · open-expired ·
 * open-malformed · bad-signature · unknown-signer. `open` is its own verdict,
 * never `ok`; callers that branch on `ok` refuse it, as the builder must.
 */
export const OPEN_DOMAIN = 'bonsai-seal-open-v1\n';
export const OPEN_FIELDS = ['reason', 'closer', 'ruled-by', 'opened-at', 'expires', 'sealed-hash', 'open-hash'];
const OPEN_MAX_MS = 14 * 24 * 3600 * 1000;

export function extractOpenMd(text) {
  const [fm] = parseMd(text);
  if (fm === null) return null;
  const fields = {};
  let found = false;
  for (const line of fm.split(/\r?\n/)) {
    if (/^open\s*:/.test(line)) {
      found = true;
      continue;
    }
    if (!found) continue;
    if (!/^\s/.test(line)) break;
    const m = /^\s+(\S+?):\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('"')) {
      try {
        v = JSON.parse(v);
      } catch {
        /* keep raw */
      }
    }
    fields[m[1]] = v;
  }
  return found ? fields : null;
}

export function openPayload(fields) {
  return Buffer.from(OPEN_DOMAIN + OPEN_FIELDS.map((k) => `${k}: ${fields[k]}\n`).join(''), 'utf8');
}

function parseUtc(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s)) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function adjudicateOpen({ root, meta, open, actualHash, now = Date.now() }) {
  const signer = meta.signer || '';
  let key;
  try {
    key = loadPublicKey(root, signer);
  } catch (err) {
    if (err.code === 'NO_PUBLIC_KEY') return { status: 'unknown-signer', meta, open };
    throw err;
  }
  meta._key_path = path.relative(root, key.keyPath);
  if (meta.fingerprint && meta.fingerprint !== key.fingerprint) return { status: 'bad-signature', meta, open };

  const verdict = (status) => ({ status, meta, open });
  if ([...OPEN_FIELDS, 'signature'].some((k) => !String(open[k] ?? '').trim())) return verdict('open-malformed');
  const canon = registryFingerprint(root, signer);
  if (canon && canon !== key.fingerprint) return verdict('bad-signature');
  if (open['sealed-hash'] !== (meta['body-hash'] || '')) return verdict('open-malformed');
  const opened = parseUtc(open['opened-at']);
  const expires = parseUtc(open.expires);
  if (opened === null || expires === null || expires <= opened || expires - opened > OPEN_MAX_MS || opened > now)
    return verdict('open-malformed');
  if (!verifyQuiet(key.publicKeyHex, Buffer.from(open['sealed-hash'], 'hex'), meta.signature || '')) {
    return verdict('bad-signature');
  }
  if (!verifyQuiet(key.publicKeyHex, openPayload(open), open.signature)) return verdict('bad-signature');
  if (actualHash === open['sealed-hash']) return verdict('ok');
  if (actualHash !== open['open-hash']) return verdict('open-drift');
  if (now >= expires) return verdict('open-expired');
  return verdict('open');
}

/** The local key for `signer`, as verify's `adjudicate` resolves it; a verdict when there is none. */
function localKey(root, meta) {
  try {
    const key = loadPublicKey(root, meta.signer);
    meta._key_path = path.relative(root, key.keyPath);
    return { key };
  } catch (err) {
    if (err.code === 'NO_PUBLIC_KEY') return { verdict: { status: 'unknown-signer', meta } };
    throw err; // a corrupt key file is not "unknown signer"
  }
}

/** The signer's key from a named pot (pot-keys.mjs); a verdict when there is none or it cannot stand. */
function potKey(pot, meta) {
  try {
    const key = loadPotKey(pot, meta.signer);
    meta._key_path = path.relative(pot.dir, key.keyPath);
    return { key };
  } catch (err) {
    if (err.code === 'NO_PUBLIC_KEY') return { verdict: { status: 'unknown-signer', meta, reason: err.message } };
    if (err.potStatus) return { verdict: { status: err.potStatus, meta, accepted: false, reason: err.message } };
    throw err;
  }
}

/**
 * After the signature holds: where the file is, what id it carries, what its bytes
 * are. Shared by the local and the published verdicts, which differ only in who
 * vouches for the signature.
 *   target-mismatch  the seal names another address (moved, renamed, copied onto)
 *   id-mismatch      a file that carries its own id carries another one (or none)
 *   then the bytes:  ok · hash-mismatch · open · open-drift · open-expired · open-malformed
 */
export function v2Tail(filePath, meta) {
  let actual;
  try {
    actual = sealTargetFor(filePath);
  } catch (err) {
    return { status: 'target-mismatch', meta, reason: err.message };
  }
  if (actual !== meta.target) {
    return { status: 'target-mismatch', meta, reason: `sealed for ${meta.target}, found at ${actual}` };
  }
  const bytes = fs.readFileSync(filePath);
  const own = ownId(bytes, actual);
  if (own.carrier && (own.problem || own.id !== meta.id)) {
    return {
      status: 'id-mismatch',
      meta,
      reason: own.problem ? `the file's own id: ${own.problem}` : `the seal says ${meta.id}, the file says ${own.id}`,
    };
  }
  const status = adjudicateBytes(meta, blake2b512Hex(bytes), meta.target);
  return { status, meta, ...(meta.open ? { open: meta.open } : {}) };
}

/**
 * v2, local keys. Order is the contract: schema → signer's key → fingerprint (the
 * key's, and the registry's) → the signature over the payload → target → id →
 * bytes. The fingerprint comes before the hash, as in v1 (the wrong-signer fixture
 * holds that order).
 */
export function verifyV2Local(filePath, data, { root, pot } = {}) {
  const meta = { ...data };
  const problem = v2SchemaProblem(data);
  if (problem) return { status: `bad-sidecar (${problem})`, meta, generation: 'v2' };
  const { key, verdict } = pot ? potKey(pot, meta) : localKey(root, meta);
  if (verdict) return { ...verdict, generation: 'v2' };
  if (data.fingerprint !== key.fingerprint) {
    return { status: 'bad-signature', meta, generation: 'v2', reason: "the fingerprint is not the signer's key" };
  }
  const canon = pot ? null : registryFingerprint(root, data.signer); // a pot's registry was already held to its key file in loadPotKey
  if (canon && canon !== key.fingerprint) {
    return {
      status: 'bad-signature',
      meta,
      generation: 'v2',
      reason: 'the key on disk is not the one the registry records',
    };
  }
  if (!verifyQuiet(key.publicKeyHex, v2Payload(data), data.signature)) {
    return {
      status: 'bad-signature',
      meta,
      generation: 'v2',
      reason: 'the signature does not hold over the v2 payload',
    };
  }
  return { ...v2Tail(filePath, meta), generation: 'v2' };
}

/**
 * Where a file's sidecar is read from, through the one finder (sidecar-format.mjs,
 * the dot-prefixed sidecar change): `X.bonsaisig` or `.X.bonsaisig`. Both present is its own verdict,
 * `two-sidecars`, refused and naming both — a verifier does not choose between two
 * seals for one file. Neither is `no-sidecar`, with the address a writer uses today
 * as `sidecarPath` so the CLI can say where it looked. The two words are sign.py's.
 */
function locateSidecar(filePath) {
  const found = findSidecar(filePath);
  if (found.status === 'two-sidecars') {
    return {
      verdict: {
        status: 'two-sidecars',
        meta: null,
        sidecarPath: null,
        sidecarPaths: found.paths,
        reason:
          `two sidecars for one file: ${found.paths.join(' and ')}; a verifier does not choose — ` +
          'remove the one that is not the seal',
      },
    };
  }
  if (found.status === 'no-sidecar') {
    return { verdict: { status: 'no-sidecar', meta: null, sidecarPath: found.paths[1], sidecarPaths: found.paths } };
  }
  return { sidecarPath: found.path, legacy: found.name === 'legacy', hiddenPath: found.paths[0] };
}

/**
 * The old name, retired (the dot-prefixed sidecar change phase 3) — the same shape as retireV1: the policy decides
 * acceptance, the status always says what it is. `refusedOldName` is asked before the seal is
 * read: under "sidecar-name": "refuse" an old-name seal is refused whatever its bytes, and the
 * published path asks nothing of the site. `retireSidecarName` is applied after: under "warn"
 * a seal that is accepted reads retired-sidecar-name, accepted (a v1 seal there carries both
 * reasons); one that fails keeps its own verdict, refused, and names the fix as well.
 * The finder stays policy-free: the writers' move (adoptSidecar) is the fix, and must work
 * under either mode.
 */
function refusedOldName(located, policy) {
  if (!located.legacy || policy['sidecar-name'] === 'warn') return null;
  const fix = retiredSidecarNameReason(located.sidecarPath, located.hiddenPath);
  return {
    status: RETIRED_SIDECAR_NAME,
    meta: null,
    accepted: false,
    sidecarPath: located.sidecarPath,
    reason: policy.whyName ? `${fix} (${policy.whyName})` : fix,
  };
}

/**
 * A seal that declares `custody: software-fallback` is a pass only while ../seal-policy.json says
 * "custody-fallback": "warn" (the lab preview; the Aruji's fifth decision, 2026-10-06). Missing
 * reads refuse: for a stranger the fallback is below the floor. A worse finding stands: a drifted
 * or forged fallback seal keeps its own verdict, so this never hides one. Other tiers pass through.
 */
function applyCustodyPolicy(v, policy) {
  if (v.meta?.custody !== 'software-fallback') return v;
  if (!(v.status === 'ok' || (sealAccepted(v.status, policy) && v.accepted !== false))) return v;
  if (policy['custody-fallback'] === 'warn') return v;
  const why = 'the seal rests on the software-fallback custody tier, which the policy refuses outside the lab preview';
  return {
    ...v,
    status: CUSTODY_REFUSED,
    accepted: false,
    reason: policy.whyCustody ? `${why} (${policy.whyCustody})` : why,
  };
}

function retireSidecarName(v, located, policy) {
  if (!located.legacy) return v;
  const fix = retiredSidecarNameReason(located.sidecarPath, located.hiddenPath);
  if (policy['sidecar-name'] !== 'warn') {
    // refusedOldName answers first; this holds if a caller skips it
    return {
      ...v,
      status: RETIRED_SIDECAR_NAME,
      accepted: false,
      reason: policy.whyName ? `${fix} (${policy.whyName})` : fix,
    };
  }
  if (sealAccepted(v.status, policy) && v.accepted !== false) {
    return {
      ...v,
      status: RETIRED_SIDECAR_NAME,
      accepted: true,
      reason: v.status === RETIRED_V1 && v.reason ? `${fix}; and ${v.reason}` : fix,
    };
  }
  return { ...v, accepted: false, reason: v.reason ? `${v.reason}; also: ${fix}` : fix };
}

/**
 * The sidecar verdict. A v2 sidecar is checked in full; a v1 sidecar is retired
 * (retireV1); anything else is a bad sidecar. The one difference from the embedded
 * form: the hash is over the file's EXACT BYTES, frontmatter and all.
 */
export function verifySidecarFile(filePath, { root, policy, pot } = {}) {
  const located = locateSidecar(filePath);
  if (located.verdict) return located.verdict;
  const pol = policy || readSealPolicy();
  const refused = refusedOldName(located, pol);
  if (refused) return refused;
  const raw = verifyLocatedLocal(filePath, located.sidecarPath, { root, policy: pol, pot });
  let v = applyCustodyPolicy(raw, pol);
  if (pot?.lab && v.status === CUSTODY_REFUSED) {
    // A declared rehearsal softens custody-fallback for ITS root only (core's seal-policy.json is untouched), and says so, every time.
    const soft = applyCustodyPolicy(raw, { ...pol, 'custody-fallback': 'warn' });
    if (soft.status !== CUSTODY_REFUSED) v = { ...soft, labSoftened: true };
  }
  return retireSidecarName(v, located, pol);
}

function verifyLocatedLocal(filePath, sidecarPath, { root, policy, pot }) {
  const { data, error, missing } = readSidecar(sidecarPath);
  if (missing) return { status: 'no-sidecar', meta: null, sidecarPath };
  if (error) return { status: `bad-sidecar (${error})`, meta: null, sidecarPath };
  const gen = sidecarGeneration(data);
  if (gen === 'v2') return { ...verifyV2Local(filePath, data, { root, pot }), sidecarPath };
  if (gen === 'v1' && pot)
    return { status: RETIRED_V1, meta: data, accepted: false, reason: RETIRED_V1_REASON, sidecarPath }; // a pot's only yes is pot-ok, for a v2 seal
  if (gen === 'v1') {
    const actualHash = blake2b512Hex(fs.readFileSync(filePath));
    return { ...retireV1(adjudicate({ root, meta: data, actualHash }), policy), sidecarPath };
  }
  // a bare scalar in place of the object names null, as sign.py does (Mori-shin's ruling, 2026-10-15)
  return { status: `bad-sidecar (unknown format ${JSON.stringify(data?.format ?? null)})`, meta: data, sidecarPath };
}

/**
 * The same verdicts, adjudicated by the published keys instead of a garden root
 * (published-keys.mjs; ../references/trust-anchor.md). This is the default the CLI
 * uses. The `{ root }` forms above stay for host tooling that holds the source the
 * site is built from, and only when it names them (`--keys garden`).
 *
 * The file is read and hashed here, locally; only the seal goes to the site. A v2
 * seal-open verifies here too: its OPEN declaration is inside the one signed
 * payload. A v1 seal-open is refused (`open-unpublished`), as before.
 */
export async function verifyEmbeddedFilePublished(filePath, opts = {}) {
  if (findSidecar(filePath).status !== 'no-sidecar') return verifySidecarFilePublished(filePath, opts);
  const suffix = path.extname(filePath).toLowerCase();
  if (suffix !== '.md') {
    return verifyEmbeddedV1(filePath, { root: null }); // throws UNSUPPORTED_FORMAT, same words
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const meta = extractSignMd(text);
  if (!meta) return { status: 'no-signature', meta: null };
  if (extractOpenMd(text) !== null) {
    return retireV1(
      {
        status: 'open-unpublished',
        meta,
        reason:
          'a v1 seal-open cannot be verified by the published keys; ' +
          'on a host that holds the source, name it: --keys garden',
      },
      opts.policy,
    );
  }
  return retireV1(
    await adjudicatePublished({ ...opts, meta, actualHash: blake2b512Hex(canonicalMdBody(text)) }),
    opts.policy,
  );
}

export async function verifySidecarFilePublished(filePath, opts = {}) {
  const located = locateSidecar(filePath);
  if (located.verdict) return located.verdict;
  const pol = opts.policy || readSealPolicy();
  const refused = refusedOldName(located, pol);
  if (refused) return refused;
  return retireSidecarName(
    applyCustodyPolicy(await verifyLocatedPublished(filePath, located.sidecarPath, { ...opts, policy: pol }), pol),
    located,
    pol,
  );
}

async function verifyLocatedPublished(filePath, sidecarPath, opts) {
  const { data, error, missing } = readSidecar(sidecarPath);
  if (missing) return { status: 'no-sidecar', meta: null, sidecarPath };
  if (error) return { status: `bad-sidecar (${error})`, meta: null, sidecarPath };
  const gen = sidecarGeneration(data);
  if (gen === 'v2') {
    const v = await adjudicatePublishedV2({ ...opts, data });
    if (v.status !== 'signature-vouched') return { ...v, generation: 'v2', sidecarPath };
    return { ...v2Tail(filePath, v.meta), generation: 'v2', sidecarPath };
  }
  if (gen === 'v1') {
    const verdict = await adjudicatePublished({
      ...opts,
      meta: data,
      actualHash: blake2b512Hex(fs.readFileSync(filePath)),
    });
    return { ...retireV1(verdict, opts.policy), sidecarPath };
  }
  // a bare scalar in place of the object names null, as sign.py does (Mori-shin's ruling, 2026-10-15)
  return { status: `bad-sidecar (unknown format ${JSON.stringify(data?.format ?? null)})`, meta: data, sidecarPath };
}
