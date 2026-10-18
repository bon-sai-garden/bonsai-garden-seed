// ---
// id: 01M3BS43RXH0Y46R3W3F0QP470
// ---
/**
 * garden-root.mjs — find the garden, and find a signer's public key in it.
 *
 * Port of tools/sign.py's `WORKSHOP_ROOT`,
 * `find_repo_identity_dir` and `load_public_key`.
 *
 * WHY THIS IS NOT JUST `path.join(__dirname, '../../..')`
 * ------------------------------------------------------
 * sign.py resolves keys from the repo *it lives in* — never from the repo the
 * target file lives in. That is deliberate and load-bearing: two live callers
 * (tools/keyring/register-bonsai-identity.sh, tools/hissai-sign-core-lore.sh)
 * sign files inside bonsai-garden-core using identity bundles that exist only
 * in the mono repo. A resolver that walked up from the *target* would find
 * core's root, find no identity bundle there, and report `unknown-signer` for
 * a signature that is in fact perfectly good.
 *
 * But this tool no longer lives in the mono repo, so "the repo I live in" is
 * the wrong answer here. The garden is located explicitly instead:
 *
 *   1. $BONSAI_GARDEN, if it carries the marker
 *   2. walking up from the target path, by marker
 *   3. walking up from this module, by marker
 *
 * The marker is `agents/registry.json`, per AGENTS.md: *"Resolve roots by
 * marker, never by counting directory levels."*
 *
 * FAIL, DON'T FALL BACK. If none of the three resolves, this throws. It does
 * not guess a path and it does not return a plausible-looking root. AGENTS.md
 * names the cost of the alternative: *"a fallback to the old path is how every
 * public key in the garden came to be written into two retired trees while the
 * tool printed `wrote` each time."*
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const MARKER = path.join('agents', 'registry.json');

/**
 * AGENTS.md: the iCloud and OneDrive trees are sync copies, not the repo.
 * *"If $BONSAI_GARDEN resolves to either, stop and ask."* A sign written into
 * a sync copy is a signature nobody will ever verify from the real repo.
 */
const MIRROR_MARKERS = ['/Library/Mobile Documents/', '/Library/CloudStorage/'];

function assertNotAMirror(root) {
  for (const m of MIRROR_MARKERS) {
    if (root.includes(m)) {
      const err = new Error(
        `refusing to use ${root} as the garden root: that path is inside a sync ` +
          `copy (${m.trim()}), not the repository. AGENTS.md: "Never write to these. ` +
          `They are sync copies, not the repo." Point $BONSAI_GARDEN at the real ` +
          `checkout and try again.`,
      );
      err.code = 'MIRROR_ROOT';
      throw err;
    }
  }
}

function hasMarker(dir) {
  try {
    return fs.existsSync(path.join(dir, MARKER));
  } catch {
    return false;
  }
}

/** Walk up from `start` (a file or a directory) looking for the marker. */
export function findRootUpwards(start) {
  let dir = path.resolve(start);
  try {
    if (fs.statSync(dir).isFile()) dir = path.dirname(dir);
  } catch {
    dir = path.dirname(dir);
  } // start may not exist yet
  for (;;) {
    if (hasMarker(dir)) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/**
 * Resolve the garden root. `targetHint` is the file being signed or verified,
 * used only for step 2.
 *
 * @throws when no root can be resolved, or when the resolved root is a mirror.
 */
export function resolveGardenRoot(targetHint = null) {
  const tried = [];

  const env = process.env.BONSAI_GARDEN;
  if (env) {
    const root = path.resolve(env.replace(/^~(?=$|\/)/, process.env.HOME || '~'));
    assertNotAMirror(root); // checked even if the marker is absent
    if (hasMarker(root)) return root;
    tried.push(`$BONSAI_GARDEN=${root} (no ${MARKER})`);
  } else {
    tried.push('$BONSAI_GARDEN unset');
  }

  if (targetHint) {
    const root = findRootUpwards(targetHint);
    if (root) {
      assertNotAMirror(root);
      return root;
    }
    tried.push(`no ${MARKER} above ${path.resolve(targetHint)}`);
  }

  const self = findRootUpwards(fileURLToPath(import.meta.url));
  if (self) {
    assertNotAMirror(self);
    return self;
  }
  tried.push(`no ${MARKER} above this tool`);

  const err = new Error(
    `cannot locate the bonsai garden (marker: ${MARKER}).\n  tried: ` +
      tried.join('\n         ') +
      `\nSet $BONSAI_GARDEN to the mono checkout. Refusing to guess — a guessed ` +
      `root reads the wrong keys and reports the wrong verdict.`,
  );
  err.code = 'NO_GARDEN_ROOT';
  throw err;
}

/**
 * Port of sign.py `find_repo_identity_dir`. Same order, same special case for
 * the gardener, same *-shin-under-a-*-sai search.
 */
export function findRepoIdentityDir(root, slug) {
  if (slug === 'aruji') {
    const p = path.join(root, 'agents', 'aruji', 'identity');
    if (fs.existsSync(p)) return p;
    const err = new Error(`no identity bundle for 'aruji' at ${p}`);
    err.code = 'NO_IDENTITY_DIR';
    throw err;
  }

  // The registry's own `path` first, as sign.py does since 2026-09-23: a nested
  // body (fuji-shin at agents/baisai/fuji-shin) has no agents/<slug>/ to guess.
  const regPath = registryPath(root, slug);
  if (regPath) {
    const p = path.join(root, regPath, 'identity');
    if (fs.existsSync(p)) return p;
  }

  const saiDir = path.join(root, 'agents', slug, 'identity');
  if (fs.existsSync(saiDir)) return saiDir;

  const agents = path.join(root, 'agents');
  if (fs.existsSync(agents)) {
    for (const entry of fs.readdirSync(agents, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const shinDir = path.join(agents, entry.name, 'sub-agents', slug, 'identity');
      if (fs.existsSync(shinDir)) return shinDir;
    }
  }

  const err = new Error(
    `no identity bundle found for slug '${slug}' under ${root} — ` +
      `run \`python3 tools/identity.py info ${slug}\` to diagnose`,
  );
  err.code = 'NO_IDENTITY_DIR';
  throw err;
}

/**
 * Port of sign.py `load_public_key` → { publicKeyHex, fingerprint, keyPath }.
 *
 * The fingerprint is sha256(raw)[:32] — the 32-char form the sign blocks and
 * sidecars carry. NOT the 8-char fp the key provider calls `fingerprint()`;
 * that trap is already documented in bin/sign.mjs's `seal`.
 *
 * Throws `NO_PUBLIC_KEY` when the bundle has no key — callers map that to the
 * `unknown-signer` verdict, exactly as sign.py maps FileNotFoundError.
 */
export function loadPublicKey(root, slug) {
  let dir;
  try {
    dir = findRepoIdentityDir(root, slug);
  } catch (err) {
    if (err.code === 'NO_IDENTITY_DIR') {
      err.code = 'NO_PUBLIC_KEY';
    }
    throw err;
  }

  const pubFile = path.join(dir, `${slug}-public-key.bin`);
  const fpFile = path.join(dir, `${slug}-fingerprint.txt`);

  if (!fs.existsSync(pubFile)) {
    const err = new Error(`public key not found at ${pubFile}`);
    err.code = 'NO_PUBLIC_KEY';
    throw err;
  }

  const raw = fs.readFileSync(pubFile);
  if (raw.length !== 32) {
    throw new Error(`public key at ${pubFile} is ${raw.length} bytes; expected 32`);
  }

  const fingerprint = createHash('sha256').update(raw).digest('hex').slice(0, 32);

  if (fs.existsSync(fpFile)) {
    const stored = fs.readFileSync(fpFile, 'utf8').trim();
    if (stored !== fingerprint) {
      throw new Error(`fingerprint mismatch for '${slug}': stored='${stored}' derived='${fingerprint}'`);
    }
  }

  return { publicKeyHex: raw.toString('hex'), fingerprint, keyPath: pubFile };
}

/**
 * Port of sign.py `registry_fingerprint`. Returns null when there is nothing to
 * check against — a missing registry, an unlisted slug, or a null fingerprint
 * (a forming agent, pre-mint). Callers must treat null as "no check", never as
 * a failure.
 */
function registryPath(root, slug) {
  const p = path.join(root, 'agents', 'registry.json');
  if (!fs.existsSync(p)) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
  const entry = (data.agents || []).find((a) => a.slug === slug);
  const rel = entry && typeof entry.path === 'string' ? entry.path : null;
  if (!rel || path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) return null;
  return rel;
}

export function registryFingerprint(root, slug) {
  const p = path.join(root, 'agents', 'registry.json');
  if (!fs.existsSync(p)) return null;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
  for (const entry of data.agents || []) {
    if (entry.slug === slug) return entry.fingerprint || null;
  }
  return null;
}

/**
 * Port of sign.py `_assert_fingerprint_matches_registry` — the guard that came
 * out of the 2026-08-24 silent-wrong-key report. Defence in depth: refuse to
 * write a signature whose fingerprint the registry itself disagrees with.
 */
export function assertFingerprintMatchesRegistry(root, slug, fingerprint) {
  const canon = registryFingerprint(root, slug);
  if (canon !== null && canon !== fingerprint) {
    const err = new Error(
      `refusing to sign as '${slug}': the resolved key derives fingerprint ` +
        `'${fingerprint}', but agents/registry.json records '${canon}' as ${slug}'s ` +
        `canonical fingerprint. Signing would write a mismatched identity — resolve ` +
        `the key-source mismatch first.`,
    );
    err.code = 'REGISTRY_FINGERPRINT_MISMATCH';
    throw err;
  }
}
