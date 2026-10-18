// ---
// id: 01M4KSMQQ6X17QT9EJYNX80HRJ
// title: rt's manifest, its seal and core's minimum: one format for the generator, the drift gate, the installer and the doctor
// type: script
// tended-by: baisai
// created: 2026-10-10
// updated: 2026-10-18
// ---
//
// rt-manifest.mjs — runtime rituals/specs/spec-rt-slice.md §2, §4, §5. The one master of the
// format: runtime's generator and drift gate, core's install-runtime and rt's doctor all import it
// (runtime and rt reach it through core, a down edge). It reads bytes and hashes them; it never
// imports, requires or runs a file it is given.
//
//   RT-MANIFEST.json  (in rt)    { format, name, version, upstream: { repo, commit }, files: [{ path, sha256, bytes }] }
//   .RT-MANIFEST.json.bonsaisig  (in rt)  the manifest's own seal (bonsaisig/2, owner, target RT-MANIFEST.json); the one
//                     file rt carries that its manifest cannot list
//   rt-minimum.json   (in core)  { format, name, 'min-version', signers }: the oldest rt this core takes, and whose
//                     seal on an rt's manifest it believes. No hash and no commit: any rt at or above it installs.
//   runtime.json      (in a pot) what the pot installed: the manifest's sha256, its version, who sealed it, when
//                     the published keys vouched; a record of the pot's, not a pin of core's
//
// Core pinned one rt by its manifest's sha256 until 2026-10-18 (rt-pin.json). The gardener: "we should never refer to a
// specific version of runtime as a dependency me thinks", "maybe a minimumversion, bvut not a fixed version".

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { v2SchemaProblem } from '../../bonsai-garden-sign/lib/seal-v2.mjs';

export const MANIFEST = 'RT-MANIFEST.json';
export const MANIFEST_SEAL = `.${MANIFEST}.bonsaisig`; // the manifest's seal, beside it (the hidden sidecar name)
export const MANIFEST_FORMAT = 'bonsai-garden-rt-manifest/1';
export const MINIMUM_FORMAT = 'bonsai-garden-rt-minimum/1';
export const RECORD_FORMAT = 'bonsai-garden-pot-runtime/1';
export const HOOKS_DIR = 'tools/hooks/garden'; // the pot's core.hooksPath, inside rt
export const DOCTOR = 'tools/rt/doctor.mjs';

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const SHA_RE = /^[0-9a-f]{64}$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const VERSION_RE = /^\d+\.\d+\.\d+(\.\d+)?(-[a-z0-9.-]+)?$/;
const PATH_RE = /^(?!\/)(?!.*(^|\/)\.\.?(\/|$))[A-Za-z0-9._/-]+$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const blake = (buf) => crypto.createHash('blake2b512').update(buf).digest('hex');

/** A version's order: MAJOR.MINOR.PATCH[.BUILD], BUILD 0 when absent; a -LABEL names a build and never orders it (AGENTS.md). */
function order(v) {
  if (!VERSION_RE.test(v || ''))
    throw new Error(`${JSON.stringify(v)} is not a version (MAJOR.MINOR.PATCH[.BUILD][-LABEL])`);
  const n = v.split('-')[0].split('.').map(Number);
  return [n[0], n[1], n[2], n[3] ?? 0];
}
/** <0, 0 or >0 as version `a` orders before, with or after `b`. */
export function versionCmp(a, b) {
  const x = order(a),
    y = order(b);
  for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}
export const atLeast = (v, min) => versionCmp(v, min) >= 0;

/** The manifest's bytes for `files` ({ rel: Buffer }): sorted, fixed key order, one trailing newline. */
export function manifestBytes({ name, version, upstream, files }) {
  const list = Object.keys(files)
    .sort()
    .map((p) => ({ path: p, sha256: sha256(files[p]), bytes: files[p].length }));
  for (const f of list)
    if (!PATH_RE.test(f.path) || f.path === MANIFEST || f.path === MANIFEST_SEAL)
      throw new Error(`not a path a manifest can carry: ${f.path}`);
  const m = {
    format: MANIFEST_FORMAT,
    name,
    version,
    upstream: { repo: upstream.repo, commit: upstream.commit },
    files: list,
  };
  return Buffer.from(`${JSON.stringify(m, null, 2)}\n`);
}

export function parseManifest(buf) {
  let m;
  try {
    m = JSON.parse(buf.toString('utf8'));
  } catch {
    throw new Error(`${MANIFEST} is not JSON`);
  }
  if (!m || m.format !== MANIFEST_FORMAT) throw new Error(`${MANIFEST} is not ${MANIFEST_FORMAT}`);
  if (typeof m.name !== 'string' || !VERSION_RE.test(m.version || ''))
    throw new Error(`${MANIFEST} names no rt and version`);
  if (!m.upstream || !COMMIT_RE.test(m.upstream.commit || ''))
    throw new Error(`${MANIFEST} carries no upstream commit (the stamp)`);
  if (!Array.isArray(m.files) || !m.files.length) throw new Error(`${MANIFEST} lists no files`);
  for (const f of m.files) {
    if (!f || !PATH_RE.test(f.path || '') || !SHA_RE.test(f.sha256 || ''))
      throw new Error(`${MANIFEST} has a malformed entry: ${JSON.stringify(f)}`);
  }
  return m;
}

/** Core's minimum (rt-minimum.json), read and checked for shape. Throws with one line saying what is wrong. */
export function readMinimum(file) {
  let m;
  try {
    m = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${file}: ${e.code === 'ENOENT' ? 'not found' : 'not JSON'}`);
  }
  if (!m || m.format !== MINIMUM_FORMAT) throw new Error(`${file} is not ${MINIMUM_FORMAT}`);
  if (typeof m.name !== 'string' || !m.name || !VERSION_RE.test(m['min-version'] || ''))
    throw new Error(`${file} names no rt and minimum version`);
  if (
    !Array.isArray(m.signers) ||
    !m.signers.length ||
    !m.signers.every((x) => typeof x === 'string' && SLUG_RE.test(x))
  )
    throw new Error(`${file} names no signer whose seal on an rt's manifest this core believes`);
  return m;
}

/** A pot's record of the rt it installed (runtime.json), read and checked for shape. Throws with one line. */
export function readRecord(file) {
  let p;
  try {
    p = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${file}: ${e.code === 'ENOENT' ? 'not found' : 'not JSON'}`);
  }
  if (!p || p.format !== RECORD_FORMAT) throw new Error(`${file} is not a pot's rt record (${RECORD_FORMAT})`);
  if (typeof p.name !== 'string' || !VERSION_RE.test(p.version || '') || !SHA_RE.test(p['manifest-sha256'] || '')) {
    throw new Error(`${file} names no rt, version and manifest sha256`);
  }
  if (p['rt-commit'] !== null && p['rt-commit'] !== undefined && !COMMIT_RE.test(p['rt-commit']))
    throw new Error(`${file}: rt-commit is not a commit`);
  return p;
}
/** The name rt <= 0.8.3's doctor imports this reader by (it reads the pot's runtime.json with it). */
export const readPin = readRecord;

/**
 * The manifest's seal at `dir`, offline: present at the hidden name, bonsaisig/2, an owner seal (not open) by a key
 * `minimum` names, naming RT-MANIFEST.json, over exactly the manifest's bytes. Returns { data } (the sidecar, for the
 * published keys to vouch for: install-runtime asks them) or { problem: { kind, what } }. Kinds: unsealed, seal.
 */
export function manifestSeal(dir, minimum) {
  const no = (kind, what) => ({ problem: { kind, what } });
  let side;
  try {
    side = fs.readFileSync(path.join(dir, MANIFEST_SEAL), 'utf8');
  } catch {
    return no(
      'unsealed',
      `${MANIFEST} carries no seal (${MANIFEST_SEAL}); this core takes an rt only under its owner's seal`,
    );
  }
  let data;
  try {
    data = JSON.parse(side);
  } catch {
    return no('seal', `${MANIFEST_SEAL} is not JSON`);
  }
  const p = v2SchemaProblem(data);
  if (p) return no('seal', `${MANIFEST_SEAL} is not a bonsaisig/2 seal (${p})`);
  if ('open' in data)
    return no('seal', `${MANIFEST} carries an open seal, a declaration of work in progress, not a release`);
  if (data.role !== 'owner')
    return no('seal', `${MANIFEST} is sealed ${data.role} by ${data.signer}; this core takes only an owner seal`);
  // Mori-shin's R3 (2026-10-18): a seal that declares the software fallback is no release (the signer's own word, so it
  // catches a careless cut, not a thief; build-rt takes the opt-out from the sealer, the other half)
  if (data.custody === 'software-fallback')
    return no(
      'seal',
      `${MANIFEST} is sealed through the software fallback (custody: software-fallback); a release is sealed through the signing gate`,
    );
  if (!minimum.signers.includes(data.signer))
    return no(
      'seal',
      `${MANIFEST} is sealed by ${data.signer}, not a key this core names (${minimum.signers.join(', ')})`,
    );
  if (data.target !== MANIFEST) return no('seal', `the seal names ${data.target}, not ${MANIFEST}`);
  let buf;
  try {
    buf = fs.readFileSync(path.join(dir, MANIFEST));
  } catch {
    return no('seal', `${MANIFEST} is missing beside its seal`);
  }
  if (blake(buf) !== data['file-hash'])
    return no(
      'seal',
      `hash-mismatch: ${MANIFEST} is not the bytes that were sealed (edited after its seal, or a seal lifted from another rt)`,
    );
  return { data };
}

/**
 * Every entry under `dir` (not `.git`), by lstat: { files: [rel], links: [rel], other: [rel] }.
 * A symlink is never followed.
 */
export function walk(dir) {
  const out = { files: [], links: [], other: [] };
  const go = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (!rel && e.name === '.git') continue;
      const st = fs.lstatSync(path.join(d, e.name));
      if (st.isSymbolicLink()) out.links.push(r);
      else if (st.isDirectory()) go(path.join(d, e.name), r);
      else if (st.isFile()) out.files.push(r);
      else out.other.push(r);
    }
  };
  go(dir, '');
  for (const k of Object.keys(out)) out[k].sort();
  return out;
}

/**
 * Is the tree at `dir` exactly what its manifest lists, and (given `record`, a pot's runtime.json) the rt that pot
 * recorded? Reads bytes only. Returns { ok, problems: [{ kind, what }], manifest, manifestSha }. Kinds: not-recorded,
 * tampered, unlisted, link, missing, malformed. The manifest's own seal is the one file the manifest does not list;
 * whether it holds is manifestSeal's question, not this one's.
 */
export function verifyTree(dir, record = null) {
  const problems = [];
  const say = (kind, what) => problems.push({ kind, what });
  const tree = walk(dir);
  for (const l of tree.links) say('link', `${l} is a symlink; rt carries none`);
  for (const o of tree.other) say('malformed', `${o} is not a regular file`);
  const mf = path.join(dir, MANIFEST);
  let buf,
    m = null,
    msha = null;
  try {
    buf = fs.readFileSync(mf);
  } catch {
    say('missing', `${MANIFEST} is missing`);
    return { ok: false, problems, manifest: null, manifestSha: null };
  }
  msha = sha256(buf);
  if (record && msha !== record['manifest-sha256'])
    say('not-recorded', `${MANIFEST} is sha256 ${msha}; the pot recorded ${record['manifest-sha256']} at install`);
  try {
    m = parseManifest(buf);
  } catch (e) {
    say('malformed', e.message);
    return { ok: false, problems, manifest: null, manifestSha: msha };
  }
  if (record && (m.name !== record.name || m.version !== record.version))
    say('not-recorded', `this is ${m.name} ${m.version}; the pot recorded ${record.name} ${record.version}`);
  const listed = new Set(m.files.map((f) => f.path));
  for (const f of m.files) {
    const p = path.join(dir, f.path);
    let st;
    try {
      st = fs.lstatSync(p);
    } catch {
      say('missing', `${f.path} is listed and not here`);
      continue;
    }
    if (!st.isFile()) continue; // a link or other: said above
    const got = sha256(fs.readFileSync(p));
    if (got !== f.sha256) say('tampered', `${f.path} is sha256 ${got}; the manifest says ${f.sha256}`);
  }
  for (const f of tree.files)
    if (f !== MANIFEST && f !== MANIFEST_SEAL && !listed.has(f))
      say('unlisted', `${f} is here and the manifest does not list it`);
  return { ok: problems.length === 0, problems, manifest: m, manifestSha: msha };
}
