// ---
// id: 01M5FRRDYN5C3SYKF51YVXA628
// title: A release manifest, read offline as the reserved set's reader believes it (spec-gardeners-keys §6.4 points 3a to 3d)
// type: script
// tended-by: baisai
// created: 2026-10-21
// updated: 2026-10-22
// ---
//
// release-manifest.mjs — the offline half of believing the reserved set through the sealed release manifest that carries
// it (spec-gardeners-keys.md 0.7.0, §6.4 point 3; Mori-shin's ruling of 2026-10-21). Nothing here asks the site and
// nothing here throws for a refusal: each check returns { problem: { reason, detail } } or what it read, and the
// reader (reserved-marks.mjs loadReservedSet) turns a problem into its Refusal and asks bon-sai.garden (3e).
//
//   writersList()                      the writers core names and the manifest names, from release-writers.json beside this file
//   findManifest(root, names)          the manifest at the checkout's root, by name; null when none is there
//   manifestSeal(root, name, writers)  3a: owner, not open, a named writer, not the software fallback, over its exact bytes
//   parseRelease(bytes, name)          3b: bonsai-garden-release-manifest/1, every entry path, sha256 and bytes, no path twice;
//                                      a mode on every entry or on none
//   entryProblem(root, byPath, rel)    3c: the file is listed and is the bytes its entry lists, its exec bit as stated
//   mixedCut(root, entries)            3d: every listed file of the three skills the arc runs equals its entry
//   modeVerdict(listed, execBits)      what was done of the modes: checked | not-stated | not-checkable
//
// THE MODE (Mori-shin's ruling, 2026-10-21; the format string stays): an entry may state `mode`, the string "100644" or
// "100755", and then every entry does; some, or another value, is malformed. Where it is stated, 3c checks the owner's
// execute bit (mode & 0o100) against it, and a miss fails the entry (reason `mode`), the fix in plain words. Where the
// platform has no execute bit (Windows), nothing is said to be checked: the verdict is not-checkable, never checked.
//   releaseOf(root)                    the release this checkout is (3a and 3b offline), for the /stats count only
//
// The root is found by the caller by marker (the directory the shipped file's own address resolves under), never by a
// flag, a variable or a count of directories. A writer's seal vouches the set as it was cut, not who wrote it; what a
// writer's key could still do is said in the spec, point 8. 3d is consistency, not a defence: changed code can skip any
// check of its own, and the defence is the package's integrity line and, before 1.0, the external pinned verifier.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2SchemaProblem } from '../bonsai-garden-sign/lib/seal-v2.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const WRITERS_FILE = path.join(HERE, 'release-writers.json');
export const WRITERS_FORMAT = 'bonsai-garden-release-writers/1';
export const RELEASE_FORMAT = 'bonsai-garden-release-manifest/1';
/** The three skills the arc runs: one cut, not a mix of two (3d). */
export const ARC_SKILLS = Object.freeze(['bonsai-garden-keys', 'bonsai-garden-mark', 'bonsai-garden-sign']);
/** A seal that declares this tier is no release (R3 of 2026-10-18). */
export const NO_RELEASE_TIER = 'software-fallback';

export const M = Object.freeze({
  WRITERS: 'no writers list',
  TWO: 'two manifests',
  UNSEALED: 'unsealed',
  BAD_SEAL: 'bad-sidecar',
  NOT_OWNER: 'not an owner seal',
  NOT_WRITER: 'not a release writer',
  NO_RELEASE: 'no release',
  HASH: 'hash-mismatch',
  FORMAT: 'not the format',
  NOT_LISTED: 'not in the manifest',
  NOT_BYTES: 'not the bytes the manifest lists',
  MIXED: 'mixed cut',
  MODE: 'mode',
});
/** The two modes an entry can state: git's word for a regular file, and for an executable one. */
export const RELEASE_MODES = Object.freeze(['100644', '100755']);
/** Where a platform has no execute bit (Windows), a mode cannot be checked, and is never said to be. */
export const execBitReadable = () => process.platform !== 'win32';

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const no = (reason, detail) => ({ problem: { reason, detail } });
export const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const blake = (b) => createHash('blake2b512').update(b).digest('hex');
export const sidecarRel = (rel) => {
  const i = rel.lastIndexOf('/');
  return `${rel.slice(0, i + 1)}.${rel.slice(i + 1)}.bonsaisig`;
};

/** { writers, manifests } from the list beside this file, or { problem }. */
export function writersList(file = WRITERS_FILE) {
  let d;
  try {
    d = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return no(
      M.WRITERS,
      `${path.basename(file)} cannot be read (${e.code || 'not JSON'}); the reader knows no release writer`,
    );
  }
  if (d?.format !== WRITERS_FORMAT) return no(M.WRITERS, `${path.basename(file)} is not ${WRITERS_FORMAT}`);
  const okList = (v, re) => Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === 'string' && re.test(s));
  if (!okList(d.writers, SLUG)) return no(M.WRITERS, `${path.basename(file)} names no writers (["<slug>", …])`);
  if (!okList(d.manifests, /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/))
    return no(M.WRITERS, `${path.basename(file)} names no manifest file (["<NAME>-MANIFEST.json", …])`);
  return { writers: [...d.writers], manifests: [...d.manifests] };
}

/** The release manifest at the checkout's root: { name, file }, null when none of `names` is there, or { problem }. */
export function findManifest(root, names) {
  const here = names.filter((n) => fs.existsSync(path.join(root, n)));
  if (here.length > 1) return no(M.TWO, `${here.join(' and ')} both sit at ${root}; a checkout is one release`);
  return here.length ? { name: here[0], file: path.join(root, here[0]) } : null;
}

/** 3a, offline: the manifest's own sidecar. Returns { bytes, seal } or { problem }. */
export function manifestSeal(root, name, writers) {
  const file = path.join(root, name);
  const bytes = fs.readFileSync(file);
  let seal;
  try {
    seal = JSON.parse(fs.readFileSync(path.join(root, sidecarRel(name)), 'utf8'));
  } catch (e) {
    return no(
      M.UNSEALED,
      `${name} carries no seal beside it (${sidecarRel(name)}${e.code === 'ENOENT' ? '' : ', unreadable'}); a release manifest is believed only under a writer's seal`,
    );
  }
  const p = v2SchemaProblem(seal);
  if (p) return no(M.BAD_SEAL, `${name}'s seal is not a bonsaisig/2 seal (${p})`);
  if ('open' in seal)
    return no(M.NOT_OWNER, `${name} is sealed open by ${seal.signer}: work in progress, not a release`);
  if (seal.role !== 'owner') return no(M.NOT_OWNER, `${name} is sealed ${seal.role} by ${seal.signer}, not owner`);
  if (!writers.includes(seal.signer))
    return no(
      M.NOT_WRITER,
      `${name} is sealed by ${seal.signer}, who is not a release writer core names (${writers.join(', ')})`,
    );
  if (seal.custody === NO_RELEASE_TIER)
    return no(M.NO_RELEASE, `${name}'s seal declares custody ${NO_RELEASE_TIER}: a lab key, never a release`);
  if (blake(bytes) !== seal['file-hash'])
    return no(M.HASH, `${name} is not the bytes that were sealed: edited after its seal`);
  return { bytes, seal };
}

/** 3b: the release manifest's one format. Returns { manifest, byPath } or { problem }. */
export function parseRelease(bytes, name) {
  let m;
  try {
    m = JSON.parse(bytes.toString('utf8'));
  } catch {
    return no(M.FORMAT, `${name} is not JSON`);
  }
  if (!m || m.format !== RELEASE_FORMAT)
    return no(M.FORMAT, `${name} is ${JSON.stringify(m?.format)}, not ${RELEASE_FORMAT}`);
  if (typeof m.version !== 'string' || !m.version) return no(M.FORMAT, `${name} names no version`);
  if (!Array.isArray(m.files)) return no(M.FORMAT, `${name} lists no files`);
  const byPath = new Map();
  for (const e of m.files) {
    const okEntry =
      e &&
      typeof e.path === 'string' &&
      e.path &&
      !e.path.startsWith('/') &&
      !e.path.split('/').includes('..') &&
      typeof e.sha256 === 'string' &&
      /^[0-9a-f]{64}$/.test(e.sha256) &&
      Number.isInteger(e.bytes) &&
      e.bytes >= 0;
    if (!okEntry)
      return no(
        M.FORMAT,
        `${name} holds an entry that is not { path, sha256, bytes }: ${JSON.stringify(e)?.slice(0, 120)}`,
      );
    if (byPath.has(e.path)) return no(M.FORMAT, `${name} lists ${e.path} twice`);
    byPath.set(e.path, e);
  }
  const stating = m.files.filter((e) => Object.hasOwn(e, 'mode')).length;
  if (stating && stating !== m.files.length)
    return no(
      M.FORMAT,
      `${name} is malformed: mode on some entries (${stating} of ${m.files.length}); a manifest states every entry's mode or none`,
    );
  const odd = stating ? m.files.find((e) => !RELEASE_MODES.includes(e.mode)) : null;
  if (odd)
    return no(M.FORMAT, `${name} is malformed: ${odd.path} has mode ${JSON.stringify(odd.mode)}; a mode is "100644" or "100755"`);
  return { manifest: m, byPath, modes: stating ? 'stated' : 'not-stated' };
}

/** What a reader did of the modes, for its machine-readable result: never checked when it was not (condition 4). */
export const modeVerdict = (listed, execBits = execBitReadable()) =>
  listed?.modes !== 'stated' ? 'not-stated' : execBits ? 'checked' : 'not-checkable';

/** 3c: `rel` is listed, the file at the root is the bytes its entry lists, and its owner's exec bit is the mode the entry
 *  states (where one is stated and the bit can be read). null, or { problem } naming the file. */
export function entryProblem(root, byPath, rel, name, { execBits = execBitReadable() } = {}) {
  const e = byPath.get(rel);
  if (!e) return no(M.NOT_LISTED, `${name} does not list ${rel}`).problem;
  let buf;
  try {
    buf = fs.readFileSync(path.join(root, rel));
  } catch (err) {
    return { reason: M.NOT_BYTES, detail: `${rel} is listed in ${name} and cannot be read here (${err.code})` };
  }
  if (buf.length !== e.bytes || sha256(buf) !== e.sha256)
    return { reason: M.NOT_BYTES, detail: `${rel} is not the bytes ${name} lists for it` };
  if (e.mode !== undefined && execBits && ((fs.statSync(path.join(root, rel)).mode & 0o100) !== 0) !== (e.mode === '100755'))
    return {
      reason: M.MODE,
      detail:
        e.mode === '100755'
          ? `${rel}: ${name} says executable (100755) and it is not; run chmod +x ${rel}`
          : `${rel}: ${name} says not executable (100644) and it is; run chmod -x ${rel}`,
    };
  return null;
}

/** 3d: every listed file under the three skills equals its entry. null, or the problem: a file whose bytes differ is a
 *  mixed cut (the first named); when every byte holds and only exec bits differ, it is `mode`, with every such file and
 *  the one fix named. An unpack that drops modes loses every bit at once (Python's zipfile does; git, unzip and tar keep
 *  them): a stranger who meets it gets the whole answer in one run, never the words of two releases mixed (Fuji-shin's
 *  round, 2026-10-22). */
export function mixedCut(root, byPath, name, opts = {}) {
  const off = [];
  for (const rel of [...byPath.keys()].sort()) {
    if (!ARC_SKILLS.some((s) => rel.startsWith(`skills/${s}/`))) continue;
    const p = entryProblem(root, byPath, rel, name, opts);
    if (p && p.reason !== M.MODE) return { reason: M.MIXED, detail: `${p.detail}: one cut, not a mix of two` };
    if (p) off.push(rel);
  }
  if (!off.length) return null;
  const fix = (want, sign) => {
    const these = off.filter((rel) => byPath.get(rel).mode === want);
    return these.length ? `chmod ${sign}x ${these.join(' ')}` : null;
  };
  return {
    reason: M.MODE,
    detail:
      `${off.length} file(s) of the three skills are the bytes ${name} lists and not the exec bit it states, as an unpack ` +
      `that drops modes leaves them (Python's zipfile does; git, unzip and tar keep them); run ` +
      [fix('100755', '+'), fix('100644', '-')].filter(Boolean).join(' and '),
  };
}

/**
 * The release this checkout is: the version of the release manifest at its root, read as 3a and 3b read it, offline
 * (a writer's owner seal over its exact bytes, the format). For the /stats count beside Bonsai's seal (spec §8.1)
 * and nothing else: no question is answered by it. Null with no manifest, or one that does not hold: a checkout of
 * the workshop is no release, and sends no count.
 */
export function releaseOf(root, writersFile = WRITERS_FILE) {
  if (!root) return null;
  const wl = writersList(writersFile);
  if (wl.problem) return null;
  const found = findManifest(root, wl.manifests);
  if (!found || found.problem) return null;
  const ms = manifestSeal(root, found.name, wl.writers);
  if (ms.problem) return null;
  const listed = parseRelease(ms.bytes, found.name);
  if (listed.problem) return null;
  return typeof listed.manifest?.version === 'string' ? listed.manifest.version : null;
}
