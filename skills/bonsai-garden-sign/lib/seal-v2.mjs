// ---
// id: 01M3BS43SB3N88STWZC2BKMVR4
// title: seal-v2.mjs — the one definition of seal v2 in Node
// type: script
// tended-by: mori-shin
// created: 2026-09-25
// updated: 2026-10-21
// ---
/**
 * seal-v2.mjs — the one definition of seal v2 in Node.
 *
 * The gardener, 2026-09-24: *"We need bonsaisig for every file and tamper-proof
 * and a valid seal v2. retire old seals."*
 *
 * WHAT WAS WRONG WITH v1
 *   embedded `sign:`  signed blake2b(body after the frontmatter) and nothing else,
 *                     so status, tended-by, confidentiality, decision — and the
 *                     seal's own timestamp — could be rewritten and still verify.
 *   v1 `.bonsaisig`   signed blake2b(the exact bytes) and nothing else, so its
 *                     own timestamp and target could be rewritten and still verify.
 *
 * WHAT v2 IS
 *   A detached `<file>.bonsaisig` for every file, JSON, exactly these fields:
 *
 *     format       "bonsaisig/2"
 *     id           the file's ULID (core tools/ulid.py's rule). A file that carries its
 *                  own id (.md frontmatter, a script header) must carry THIS one; any
 *                  other file carries it here alone. Minted, never typed.
 *     signer       slug
 *     role         "owner" | "custodian"   (a custodian seal is never authorship)
 *     fingerprint  sha256(public key)[:32], hex
 *     timestamp    YYYY-MM-DDTHH:MM:SSZ
 *     algorithm    "ed25519+blake2b512"
 *     target       the file's path relative to its seal root (below), "/"-separated: where it was
 *                  sealed. Provenance, signed, never a verdict (F-12, from 2026-10-21): a verifier
 *                  reports it as `sealedAt` beside the file's own address, `foundAt`, and `moved`
 *     file-hash    blake2b-512 of the file's exact bytes, hex — frontmatter and all
 *     open         optional: a signed OPEN declaration (seal-open), documents only
 *     signature    ed25519, base64, over the payload:
 *
 *   payload = UTF-8( "bonsai-seal-v2\n" + canonicalJson(every field but signature) )
 *   canonicalJson = keys sorted at every level, no insignificant whitespace, strings
 *                   only (Python: json.dumps(sort_keys=True, separators=(",", ":"),
 *                   ensure_ascii=False)).
 *
 *   The domain tag means a v1 signature (over 64 raw hash bytes) can never stand
 *   as a v2 one, and a v2 signature can never stand as anything else.
 *
 * SEAL ROOT, for `target`: the nearest directory above the file (symlinks
 * resolved) that holds `.git` or `agents/registry.json`. By marker, never by
 * counting levels; no marker is a refusal to SEAL, never a basename (provenance
 * must be named when the seal is made). At verification the same root names
 * where the file is found, and a file with no root above it is found at none:
 * that is no verdict either. A built package carries `agents/registry.json` at
 * its root, so a package's own files have package-relative targets wherever it
 * is unpacked; which bytes sit at which path in it is its MANIFEST.json's.
 *
 * tools/sign.py (in the origin garden) carries the Python twin of every function here;
 * test-seal-v2-parity.mjs holds the two to byte identity.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { whyBad, ownId, newUlid } from './ulid-rule.mjs';
import { parseMd } from './embedded-format.mjs';
import { findSidecar } from './sidecar-format.mjs';

export const V2_FORMAT = 'bonsaisig/2';
export const V2_DOMAIN = 'bonsai-seal-v2\n';
export const ALGORITHM = 'ed25519+blake2b512';
export const ROLES = Object.freeze(['owner', 'custodian']);
/** The custody tiers a seal may declare (custody-provider.mjs AssuranceTier, plus vault-cli; spec-gardeners-keys §3.3, §10). */
export const CUSTODY_TIERS = Object.freeze(['hardware', 'os-protected', 'vault-cli', 'software-fallback']);
/** A seal resting on the software fallback while ../seal-policy.json says "custody-fallback": "refuse" (missing reads refuse). */
export const CUSTODY_REFUSED = 'custody-refused';
export const V2_REQUIRED = Object.freeze([
  'format',
  'id',
  'signer',
  'role',
  'fingerprint',
  'timestamp',
  'algorithm',
  'target',
  'file-hash',
  'signature',
]);
// Two optional, SIGNED fields since 2026-10-06 (Mori-shin's ruling on letters, and the gardener's-keys
// spec §10): `held-by`, the receiver of a letter sealed by its sender, and `custody`, the tier the
// signer's master salt rested on. Absent means not declared; present, both are inside the payload.
export const V2_OPTIONAL = Object.freeze(['open', 'held-by', 'custody']);
export const OPEN_V2_FIELDS = Object.freeze(['reason', 'closer', 'ruled-by', 'opened-at', 'expires', 'open-hash']);
export const OPEN_MAX_DAYS = 14;
export const RETIRED_V1 = 'retired-v1';
/** the dot-prefixed sidecar change phase 3: a sidecar found at the old name `X.bonsaisig`. The status on both sides of the switch. */
export const RETIRED_SIDECAR_NAME = 'retired-sidecar-name';

const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const HEX32_RE = /^[0-9a-f]{32}$/;
const HEX128_RE = /^[0-9a-f]{128}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: the class names the control characters a seal field may not carry; sign.py's _CONTROL_RE is the same class, in parity
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

// ── canonical payload ─────────────────────────────────────────────────────────

/**
 * Canonical JSON: strings and plain objects only, keys sorted at every level.
 * Anything else throws — a number or an array would be a second canonical form
 * to keep in parity, and the seal needs neither.
 */
export function canonicalJson(v) {
  if (typeof v === 'string') return JSON.stringify(v);
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return (
      '{' +
      Object.keys(v)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`)
        .join(',') +
      '}'
    );
  }
  throw new TypeError(`seal v2 fields are strings or objects of strings, not ${Array.isArray(v) ? 'array' : typeof v}`);
}

/** The exact bytes a v2 signature is over: the domain tag, then every field but `signature`. */
export function v2Payload(sidecar) {
  const rest = {};
  for (const k of Object.keys(sidecar)) if (k !== 'signature' && !k.startsWith('_')) rest[k] = sidecar[k];
  return Buffer.from(V2_DOMAIN + canonicalJson(rest), 'utf8');
}

/** The sidecar object, in the order it is written to disk (the payload does not depend on it). */
export function buildV2({
  id,
  signer,
  role,
  fingerprint,
  timestamp,
  target,
  fileHash,
  open = null,
  heldBy = null,
  custody = null,
}) {
  const o = { format: V2_FORMAT, id, signer, role };
  if (heldBy) o['held-by'] = heldBy;
  o.fingerprint = fingerprint;
  o.timestamp = timestamp;
  o.algorithm = ALGORITHM;
  if (custody) o.custody = custody;
  o.target = target;
  o['file-hash'] = fileHash;
  if (open) {
    o.open = {};
    for (const k of OPEN_V2_FIELDS) o.open[k] = open[k];
  }
  return o;
}

/** 'v2' · 'v1' · 'unknown' — what a parsed sidecar claims to be. */
export function sidecarGeneration(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'unknown';
  if (data.format === V2_FORMAT) return 'v2';
  if (data.format === undefined && typeof data['body-hash'] === 'string') return 'v1';
  return 'unknown';
}

/**
 * null when `data` is a well-formed v2 sidecar, else the reason. Strict: an
 * unknown field is refused, not carried — every field is part of the signed
 * payload, and a field no verifier understands is a claim nobody checks.
 */
export function v2SchemaProblem(data) {
  if (sidecarGeneration(data) !== 'v2') return 'not a bonsaisig/2 sidecar';
  for (const k of Object.keys(data)) {
    if (!V2_REQUIRED.includes(k) && !V2_OPTIONAL.includes(k)) return `unknown field ${JSON.stringify(k)}`;
  }
  for (const k of V2_REQUIRED) {
    if (typeof data[k] !== 'string' || data[k] === '') return `field ${k} missing or not a string`;
    if (CONTROL_RE.test(data[k])) return `field ${k} carries a control character`;
  }
  const idBad = whyBad(data.id);
  if (idBad) return `id ${JSON.stringify(data.id)} is not a valid ULID (${idBad})`;
  if (!SLUG_RE.test(data.signer)) return 'signer is not a slug';
  if (!ROLES.includes(data.role)) return `role ${JSON.stringify(data.role)} is neither owner nor custodian`;
  if (!HEX32_RE.test(data.fingerprint)) return 'fingerprint is not 32 hex characters';
  if (!TS_RE.test(data.timestamp)) return 'timestamp is not YYYY-MM-DDTHH:MM:SSZ';
  if (data.algorithm !== ALGORITHM) return `algorithm ${JSON.stringify(data.algorithm)} is not ${ALGORITHM}`;
  if (!HEX128_RE.test(data['file-hash'])) return 'file-hash is not 128 hex characters';
  if (data.target.startsWith('/') || data.target.split('/').includes('..') || data.target.includes('\\')) {
    return 'target is not a repo-relative path';
  }
  if ('held-by' in data && !(typeof data['held-by'] === 'string' && SLUG_RE.test(data['held-by']))) {
    return 'held-by is not a slug';
  }
  if ('custody' in data && !CUSTODY_TIERS.includes(data.custody)) {
    return `custody ${JSON.stringify(data.custody)} is not a custody tier (${CUSTODY_TIERS.join('|')})`;
  }
  if ('open' in data) {
    const o = data.open;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return 'open is not an object';
    for (const k of Object.keys(o)) if (!OPEN_V2_FIELDS.includes(k)) return `unknown open field ${JSON.stringify(k)}`;
    for (const k of OPEN_V2_FIELDS) {
      if (typeof o[k] !== 'string' || !o[k].trim()) return `open.${k} missing or empty`;
      if (CONTROL_RE.test(o[k])) return `open.${k} carries a control character`;
    }
  }
  return null;
}

// ── seal root and target ──────────────────────────────────────────────────────

function isDirMarker(d) {
  try {
    if (fs.existsSync(path.join(d, '.git'))) return true;
  } catch {
    /* no */
  }
  try {
    return fs.statSync(path.join(d, 'agents', 'registry.json')).isFile();
  } catch {
    return false;
  }
}

/** The seal root above `file` (symlinks resolved), or null. */
export function sealRootFor(file) {
  let real;
  try {
    real = fs.realpathSync(file);
  } catch {
    real = path.resolve(file);
  }
  let d = path.dirname(real);
  for (;;) {
    if (isDirMarker(d)) return { root: d, real };
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

/** The `target` a v2 seal on `file` carries. Throws NO_SEAL_ROOT — never a basename. */
export function sealTargetFor(file) {
  const r = sealRootFor(file);
  if (!r) {
    const err = new Error(
      `no seal root above ${path.resolve(file)} (no .git and no agents/registry.json); ` +
        `refusing to seal a file whose address cannot be named`,
    );
    err.code = 'NO_SEAL_ROOT';
    throw err;
  }
  return path.relative(r.root, r.real).split(path.sep).join('/');
}

// ── the v1 cutover ────────────────────────────────────────────────────────────

/**
 * The cutover lives in ONE committed file beside this library, read by this
 * verifier and by tools/sign.py alike: ../seal-policy.json, `"v1": "warn"` or
 * `"v1": "refuse"`. Never an environment variable — an env var that moves the
 * cutover is a way to un-retire v1 on one host. Missing, unreadable or any other
 * value reads as refuse: the safe side of not knowing is the stricter one.
 */
export const SEAL_POLICY_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seal-policy.json');

/**
 * The same file holds the second switch, `"sidecar-name"` (the dot-prefixed sidecar change phase 3): whether a seal
 * found at the old name `X.bonsaisig` is accepted (`warn`) or refused (`refuse`). Each key is
 * read on its own, by the same rule: missing, unreadable, or any value but warn|refuse is refuse.
 * The returned object carries both modes, `why` for v1 and `whyName` for the sidecar name.
 */
export function readSealPolicy(policyPath = SEAL_POLICY_PATH) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  } catch (err) {
    const what = `seal policy unreadable at ${policyPath} (${err.code || err.message})`;
    // (no custody-fallback key here, on purpose: applyCustodyPolicy reads a missing key as refuse, and the
    //  mutation harness anchors on this line as it stood on 2026-10-05)
    return {
      v1: 'refuse',
      'sidecar-name': 'refuse',
      why: `${what}; v1 refused`,
      whyName: `${what}; the old sidecar name refused`,
    };
  }
  const mode = (k) => (data && (data[k] === 'warn' || data[k] === 'refuse') ? data[k] : null);
  const v1 = mode('v1');
  const name = mode('sidecar-name');
  const cf = mode('custody-fallback');
  return {
    v1: v1 || 'refuse',
    'sidecar-name': name || 'refuse',
    'custody-fallback': cf || 'refuse',
    whyCustody: cf
      ? null
      : `seal policy at ${policyPath} names no custody-fallback mode (warn|refuse); a software-fallback seal refused`,
    why: v1 ? null : `seal policy at ${policyPath} names no v1 mode (warn|refuse); v1 refused`,
    whyName: name
      ? null
      : `seal policy at ${policyPath} names no sidecar-name mode (warn|refuse); the old sidecar name refused`,
  };
}

export const RETIRED_V1_REASON =
  'a v1 seal signs the body (embedded) or the bytes (sidecar) but none of its own metadata: ' +
  'frontmatter, timestamp and target are unsigned. Re-seal as v2: sign.py sign <file> --as <slug>';

/** The fix a retired-sidecar-name verdict names: the move, or a re-seal (the writers move it). */
export function retiredSidecarNameReason(legacyPath, hiddenPath) {
  return (
    `the seal sits at the retired sidecar name ${path.basename(legacyPath)}; a sidecar is now ` +
    `${path.basename(hiddenPath)}, hidden, beside its file. ` +
    `Fix: git mv ${legacyPath} ${hiddenPath}, or re-seal (the writers move it)`
  );
}

/**
 * Is `status` a pass under the current policy? ok always; retired-v1 only while v1 is in warn
 * mode; retired-sidecar-name only while sidecar-name is in warn mode. A policy object without
 * the key (an older caller's) reads refuse for it, as the file does.
 */
export function sealAccepted(status, policy = readSealPolicy()) {
  return (
    status === 'ok' ||
    (status === RETIRED_V1 && policy.v1 === 'warn') ||
    (status === RETIRED_SIDECAR_NAME && policy['sidecar-name'] === 'warn')
  );
}

// ── the open declaration, adjudicated ─────────────────────────────────────────

function parseUtc(s) {
  if (typeof s !== 'string' || !TS_RE.test(s)) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/**
 * After the signature and the id have held: the file's bytes against the seal.
 * ok · hash-mismatch, or for a sidecar that carries `open`: ok (back at the seal) ·
 * open · open-drift · open-expired · open-malformed. OPEN is its own verdict, never ok.
 */
export function adjudicateBytes(data, actualHash, target, now = Date.now()) {
  if (!('open' in data)) return actualHash === data['file-hash'] ? 'ok' : 'hash-mismatch';
  const o = data.open;
  if (!target.toLowerCase().endsWith('.md')) return 'open-malformed'; // code is never OPEN
  const opened = parseUtc(o['opened-at']);
  const expires = parseUtc(o.expires);
  if (
    opened === null ||
    expires === null ||
    expires <= opened ||
    expires - opened > OPEN_MAX_DAYS * 24 * 3600 * 1000 ||
    opened > now ||
    !HEX128_RE.test(o['open-hash']) ||
    o['open-hash'] === data['file-hash']
  )
    return 'open-malformed';
  if (actualHash === data['file-hash']) return 'ok';
  if (actualHash !== o['open-hash']) return 'open-drift';
  if (now >= expires) return 'open-expired';
  return 'open';
}

// ── sealing: what a new v2 seal carries ───────────────────────────────────────

/**
 * Port of sign.py `_strip_retired_blocks`: drop a document's embedded `sign:` and
 * v1 `open:` blocks, which v2 retires. Nothing new is ever embedded. The document
 * is returned unchanged when it carries neither; a frontmatter left empty goes.
 * Line-for-line the Python: a block runs from its key to the next line that does
 * not start with whitespace (so a blank line inside it goes with it).
 */
export function stripRetiredBlocks(text) {
  const [fm, body] = parseMd(text);
  if (fm === null) return text;
  const lines = fm.split(/(?<=\n)/);
  const has = (key) => lines.some((l) => new RegExp(`^${key}\\s*:`).test(l));
  if (!has('sign') && !has('open')) return text;
  const strip = (ls, key) => {
    const out = [];
    let skipping = false;
    for (const l of ls) {
      if (new RegExp(`^${key}\\s*:`).test(l)) {
        skipping = true;
        continue;
      }
      if (skipping && /^\s/.test(l)) continue;
      skipping = false;
      out.push(l);
    }
    return out;
  };
  const clean = strip(strip(lines, 'sign'), 'open').join('').replace(/\n+$/, '');
  if (clean.trim()) return `---\n${clean}\n---\n${body}`;
  return body.replace(/^\n+/, '');
}

/**
 * The id a new seal on `filePath` carries (the gardener: valid ULIDs, applied in the
 * process). A file that can carry its own id must: its header id, checked by
 * ulid.py's rule, or the seal is refused (ID_REFUSED). Any other file keeps the id
 * of its existing v2 seal at the same address, or gets a fresh one — a seal copied
 * to a new address never lends its id to the copy. The existing seal is found through
 * the one finder (either sidecar name, the dot-prefixed sidecar change); two sidecars for one file is refused
 * here as it is at verification (TWO_SIDECARS) — a sealer does not choose which id to
 * carry forward any more than a verifier chooses which seal to believe.
 */
export function resolveSealId(filePath, target) {
  const bytes = fs.readFileSync(filePath);
  const own = ownId(bytes, target);
  if (own.carrier) {
    if (own.problem) {
      const err = new Error(
        `refusing to seal ${target}: its own id cannot stand (${own.problem}). ` +
          `A document or script carries its id in its header; mint one with ` +
          `\`python3 tools/ulid.py new\` (core) and write it there, never typed.`,
      );
      err.code = 'ID_REFUSED';
      throw err;
    }
    return own.id;
  }
  const found = findSidecar(filePath);
  if (found.status === 'two-sidecars') {
    const err = new Error(
      `refusing to seal ${target}: two sidecars for one file, ` +
        `${found.paths.join(' and ')}; remove the one that is not the seal, then seal again`,
    );
    err.code = 'TWO_SIDECARS';
    throw err;
  }
  if (found.status === 'ok') {
    try {
      const prev = JSON.parse(fs.readFileSync(found.path, 'utf8'));
      if (sidecarGeneration(prev) === 'v2' && prev.target === target && !whyBad(prev.id)) return prev.id;
    } catch {
      /* unreadable: mint */
    }
  }
  const id = newUlid();
  if (whyBad(id)) throw new Error(`minted id ${id} fails the ULID rule (${whyBad(id)})`);
  return id;
}

/** Everything a v2 seal on `filePath` carries except the signature. */
export function prepareV2(filePath, { signer, role, fingerprint, timestamp, heldBy = null, custody = null }) {
  if (!ROLES.includes(role)) {
    const err = new Error(`--role must be owner or custodian, not ${JSON.stringify(role)}`);
    err.code = 'BAD_ROLE';
    throw err;
  }
  const target = sealTargetFor(filePath);
  const id = resolveSealId(filePath, target);
  const fileHash = createHash('blake2b512').update(fs.readFileSync(filePath)).digest('hex');
  const obj = buildV2({ id, signer, role, fingerprint, timestamp, target, fileHash, heldBy, custody });
  const problem = v2SchemaProblem({ ...obj, signature: 'x' });
  if (problem) throw new Error(`refusing to seal ${target}: ${problem}`);
  return obj;
}

/** The timestamp a seal carries: now, to the second, UTC. */
export function nowUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
