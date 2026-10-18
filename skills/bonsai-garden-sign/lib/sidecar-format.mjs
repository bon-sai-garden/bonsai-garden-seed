// ---
// id: 01M3BS43SQNPMT9D14Z6VQ395Y
// ---
/**
 * sidecar-format.mjs — the DETACHED `.bonsaisig` envelope, ported from
 * tools/sign.py's sidecar section.
 *
 * Core had no sidecar lifecycle at all; the garden carries
 * 143 of these files, and `verify-sidecar` is the only thing in it that can
 * detect a stale detached seal — which it did, on seals already committed.
 *
 * THE SHAPE IS FIXED BY 143 FILES ON DISK, not by taste. Every one of them
 * carries exactly these seven keys, in this order:
 *
 *   signer · fingerprint · timestamp · algorithm · target · body-hash · signature
 *
 * `body-hash` — not `file_hash`. The name says "body" and the value is over the
 * WHOLE FILE's bytes; that is confusing and it is what is on disk. sign.py's own
 * comment: *"the sidecar signs the entire file, including any frontmatter."*
 * Renaming it would invalidate 143 seals to fix a word.
 *
 * Two fields sign.py can emit and this port deliberately does not: `ipv4` and
 * `ipv6`. They are off by default there (Seven Seals, seal 7 — a
 * signing machine's address verifies nothing and is an attack surface) and
 * behind BONSAI_SIGN_EMBED_IP=1. No sidecar in the corpus carries either.
 * Porting the opt-in would port the footgun; this writer has no way to emit them.
 */

import fs from 'node:fs';
import path from 'node:path';

export const BONSAI_SIG_EXT = '.bonsaisig';
export const ALGORITHM_MD = 'ed25519+blake2b512';

/**
 * TWO NAMES, ONE SEAL (the dot-prefixed sidecar change, mono `rituals/specs/spec-sidecar-dot-prefix.md`).
 * The sidecar of `X` is moving from `X.bonsaisig` to `.X.bonsaisig`: hidden, beside
 * its file, moving with it. Exactly one dot is added on the way out and exactly one
 * removed on the way back, so a hidden file keeps its own: `.gitignore` seals as
 * `..gitignore.bonsaisig`. Nothing inside a sidecar changes; its own name is in no
 * signed field, so a rename is not a re-seal.
 *
 * Phase 1a: every READER resolves through `findSidecar` and accepts either name.
 * Phase 1b (2026-10-05, mono `4d9bbc866` for sign.py, this file for Node): every WRITER
 * writes the hidden name through `writeSealSidecar`, and an old-name sidecar found beside
 * the file is moved onto the hidden name (the same bytes, one rename) before the write, so
 * a re-seal keeps the id it found there and never leaves two. Hand-built
 * `name + '.bonsaisig'` anywhere else is a defect from here on.
 * Phase 3 (2026-10-05, first move): an old-name seal reads `retired-sidecar-name` — accepted
 * with a warning while ../seal-policy.json says "sidecar-name": "warn", refused once "refuse".
 * The policy is applied by the verdict (lib/verify.mjs), NOT here: the finder stays a locator,
 * and still reports `name: 'legacy'`, because the writers' move onto the hidden name
 * (adoptSidecar) is the fix the refusal names, and it must work under either mode.
 */

/** Where a seal is WRITTEN: `<target>` → `.<target>.bonsaisig`, the hidden name (phase 1b). */
export function sidecarPathFor(targetPath) {
  return path.join(path.dirname(targetPath), `.${path.basename(targetPath)}${BONSAI_SIG_EXT}`);
}

/** The same address under the name phase 1a introduced it by; kept so a caller may say which it means. */
export const hiddenSidecarPathFor = sidecarPathFor;

/** The old name: `<target>` → `<target>.bonsaisig`. Found, to be retired (phase 3) or moved; never written again. */
export function legacySidecarPathFor(targetPath) {
  return path.join(path.dirname(targetPath), path.basename(targetPath) + BONSAI_SIG_EXT);
}

/**
 * Where a seal is READ: the one finder. Either name verifies. Both present is
 * `two-sidecars` — never a preference: two seals at two addresses for one file is
 * the second-master shape, and a verifier that picks one has made a choice nobody
 * reviewed. Neither is `no-sidecar`. The same two words are sign.py's.
 *
 * Returns { status: 'ok' | 'two-sidecars' | 'no-sidecar', path, paths: [hidden, legacy] }.
 */
export function findSidecar(targetPath) {
  const hidden = sidecarPathFor(targetPath);
  const legacy = legacySidecarPathFor(targetPath);
  const paths = [hidden, legacy];
  const hasHidden = fs.existsSync(hidden);
  const hasLegacy = fs.existsSync(legacy);
  if (hasHidden && hasLegacy) return { status: 'two-sidecars', path: null, paths };
  if (hasHidden) return { status: 'ok', path: hidden, paths, name: 'hidden' };
  if (hasLegacy) return { status: 'ok', path: legacy, paths, name: 'legacy' };
  return { status: 'no-sidecar', path: null, paths };
}

/**
 * The way back, for a path ending in `.bonsaisig`. `X.bonsaisig` → `X` has one
 * reading. `.Y.bonsaisig` has two while both names are live: the hidden sidecar of
 * `Y`, or the old-name sidecar of a hidden file `.Y` (`.gitignore.bonsaisig` is
 * real in the site repo). Both are returned, the one-dot-off reading first.
 */
export function targetCandidatesFor(sidecarPath) {
  if (!sidecarPath.endsWith(BONSAI_SIG_EXT)) return [];
  const dir = path.dirname(sidecarPath);
  const stem = path.basename(sidecarPath).slice(0, -BONSAI_SIG_EXT.length);
  if (!stem.startsWith('.')) return [path.join(dir, stem)];
  return [path.join(dir, stem.slice(1)), path.join(dir, stem)];
}

/**
 * `<x>.bonsaisig` → `<x>`, or null when the path is not a sidecar. A dot-prefixed
 * sidecar resolves to the one candidate that exists beside it. When both exist, or
 * neither, the seal's own `target` field decides; when it cannot and both exist,
 * this throws AMBIGUOUS_SIDECAR rather than guess. When it cannot and neither
 * exists, the one-dot-off reading is returned so a caller reports `missing-target`
 * at the address the new rule names.
 */
export function targetPathFor(sidecarPath) {
  const cands = targetCandidatesFor(sidecarPath);
  if (!cands.length) return null;
  if (cands.length === 1) return cands[0];
  const present = cands.filter((p) => fs.existsSync(p));
  if (present.length === 1) return present[0];
  const { data } = readSidecar(sidecarPath);
  const named = data && typeof data.target === 'string' ? path.basename(data.target) : null;
  const pool = present.length ? present : cands;
  const byName = pool.filter((p) => path.basename(p) === named);
  if (byName.length === 1) return byName[0];
  if (!present.length) return cands[0];
  const err = new Error(
    `${sidecarPath}: both ${cands.map((c) => path.basename(c)).join(' and ')} ` +
      `exist beside it and its target field does not decide between them; refusing to guess`,
  );
  err.code = 'AMBIGUOUS_SIDECAR';
  throw err;
}

/**
 * The envelope, with key order matching the 143 on disk so a re-sign produces a
 * one-value diff rather than a reordered file.
 */
export function buildSidecarObject({ signer, fingerprint, timestamp, target, bodyHash, signatureB64 }) {
  return {
    signer,
    fingerprint,
    timestamp,
    algorithm: ALGORITHM_MD,
    target,
    'body-hash': bodyHash,
    signature: signatureB64,
  };
}

/**
 * `target:` is the path relative to the garden root, or the absolute path when
 * the file lies outside it. Port of sign.py's `path.relative_to(WORKSHOP_ROOT)`
 * with its `except ValueError: str(path)` fallback — which is how the sidecars
 * on core's own files came to carry absolute targets.
 */
export function relativeTarget(root, filePath) {
  const abs = path.resolve(filePath);
  const rel = path.relative(root, abs);
  // `rel.startsWith('..')` alone would also reject a real subpath named e.g.
  // `..hidden/`. Test the separator, so only a genuine escape falls back.
  const escapes = rel === '..' || rel.startsWith(`..${path.sep}`);
  if (escapes || path.isAbsolute(rel)) return abs;
  return rel;
}

/** Read and parse a sidecar. Returns { data } or { error } — never throws. */
export function readSidecar(sidecarPath) {
  if (!fs.existsSync(sidecarPath)) return { data: null, error: null, missing: true };
  try {
    return { data: JSON.parse(fs.readFileSync(sidecarPath, 'utf8')), error: null, missing: false };
  } catch (err) {
    return { data: null, error: err.message, missing: false };
  }
}

/**
 * The write address for `targetPath`, after moving an old-name sidecar onto it when that is
 * what is beside the file — the same bytes, one rename, so the move alone is not a re-seal and
 * git sees a rename. Both names present is refused (TWO_SIDECARS), never resolved by a move:
 * a writer does not choose which of two seals to keep any more than a verifier chooses which
 * to believe. The mirror of sign.py's `_adopt_sidecar`. Returns { path, movedFrom }.
 */
export function adoptSidecar(targetPath) {
  const found = findSidecar(targetPath);
  if (found.status === 'two-sidecars') {
    const err = new Error(
      `${targetPath}: two sidecars, ${found.paths.map((p) => path.basename(p)).join(' and ')}; ` +
        `keep one, \`git rm\` the other (the dot-prefixed sidecar change — both present is refused, never preferred)`,
    );
    err.code = 'TWO_SIDECARS';
    throw err;
  }
  const hidden = sidecarPathFor(targetPath);
  if (found.status === 'ok' && found.name === 'legacy') {
    fs.renameSync(found.path, hidden);
    return { path: hidden, movedFrom: found.path };
  }
  return { path: hidden, movedFrom: null };
}

/**
 * THE writer: the seal for `targetPath` goes to the hidden name, an old-name sidecar is moved
 * onto it first, and exactly one sidecar is left. Returns the path written. Every seal written
 * by this skill goes through here; `writeSidecarAtomic` alone is the byte-level half.
 */
export function writeSealSidecar(targetPath, obj) {
  const { path: sidecarPath } = adoptSidecar(targetPath);
  writeSidecarAtomic(sidecarPath, obj);
  return sidecarPath;
}

/** Write a sidecar atomically. sign.py does; a half-written seal is worse than none. */
export function writeSidecarAtomic(sidecarPath, obj) {
  const tmp = `${sidecarPath}.tmp`;
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, sidecarPath);
  } catch (err) {
    if (fs.existsSync(tmp)) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* best effort */
      }
    }
    throw err;
  }
}
