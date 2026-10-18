#!/usr/bin/env node
/**
 * ---
 * id: 01M39MJ8MSSEWZHGPR0ZYQDJ1M
 * title: verify-manifest — a package checks itself before anything in it is used
 * type: script
 * tended-by: baisai
 * created: 2026-09-24
 * updated: 2026-10-17
 * ---
 *
 * The wake-time half of the one builder (package.py, beside this file). Every
 * package the builder makes carries this script at scripts/integrity/, next to a
 * copy of core's verifier (scripts/integrity/bonsai-garden-sign/), and the first
 * body line of every packaged SKILL.md says to run it before anything else.
 *
 * The gardener, 2026-09-24: "if that file is tampered with, we're not executing
 * it. End stop."
 *
 * WHAT IT CHECKS, IN ORDER
 *   1. MANIFEST.json is present and is the builder's shape.
 *   2. Its seal (.MANIFEST.json.bonsaisig, found by the one Node finder; at the old name it reads
 *      retired-sidecar-name, the dot-prefixed sidecar change phase 3) verifies — seal v2, whose target is
 *      MANIFEST.json at the package root and whose role is owner — and the signer
 *      is the owner the manifest names. By default the PUBLISHED keys decide
 *      (bonsai-garden-sign/references/trust-anchor.md): the site answers, signed,
 *      or the check fails. No key is ever taken from inside the package.
 *   3. The package's SKILL.md `name:` is the manifest's slug (a manifest lifted
 *      from another package does not vouch for this one).
 *   4. Every file under the package is listed with its exact sha256, and every
 *      listed file is present. An extra file is a finding, not a pass.
 *      One exception, named: SKILL.md's frontmatter. Claude's skill upload
 *      rewrites it on install (found 2026-10-02, on two companion bodies: every file matched
 *      but SKILL.md). When the bytes differ, the body below the frontmatter must
 *      equal the manifest's `skill_body` (CRLF read as LF, outer whitespace
 *      trimmed; package.py computes the same), and step 3 has already held the
 *      name. The ok line then says so. A manifest without `skill_body` is exact.
 *      A second exception, named: `memory` at the package root as a symlink that
 *      resolves to a directory is a LIVE STORE (W's SKILL.md §Memory: a live store
 *      was linked over the shipped seed, and that is normal operation). It is not
 *      walked and its seed entries are not reported missing; the ok line says
 *      `memory: live store`, a second line names the target and how many seed files
 *      went unchecked. A `memory` link that dangles or lands on a file is BROKEN and
 *      fails; a symlink anywhere else still fails; a real memory/ directory is exact.
 *      (W, 2026-10-16: a gate that fails on the correct state teaches everyone to
 *      wave it through.)
 *
 *   One more answer, named: UNSEALED. A manifest that says `unsealed` (package.py's
 *      core-alone build with no owner's key named) skips step 2 and must carry no seal;
 *      steps 3 and 4 run in full, and the answer is `UNSEALED … files match`, exit 1.
 *      It is never ok: the integrity line stops on it, and only the sealed release
 *      replaces it (the gardener, 2026-10-17: the core-alone build, restored).
 *
 * Anything but `ok` exits 1, and the SKILL.md line says: stop, tell the gardener.
 *
 *   node scripts/integrity/verify-manifest.mjs [--dir <package>] [--keys published|garden]
 *
 * --keys garden is for host tooling only, and it needs $BONSAI_GARDEN pointing at a
 * garden OUTSIDE the package: the package's own marker (agents/registry.json, an
 * empty roster) must never become the key source.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// the manifest's own seal, under either name: the Node finder in bonsai-garden-sign/lib/sidecar-format.mjs
// is the one rule, asked in main() for both of its names; this set only keeps the seal out of
// "every byte", and builds no sidecar name of its own
const OWN = new Set(['MANIFEST.json']);

function fail(msg) {
  console.log(`FAIL     integrity: ${msg}`);
  console.log('  stop: use nothing in this package, and tell the gardener exactly this line.');
  process.exit(1);
}

function args(argv) {
  const out = { keys: 'published' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') out.dir = argv[++i];
    else if (argv[i] === '--keys') out.keys = argv[++i];
    else fail(`unknown argument ${argv[i]}`);
  }
  return out;
}

/** The package root: the nearest directory above this script holding MANIFEST.json. */
function findPackage(start) {
  let d = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(d, 'MANIFEST.json'))) return d;
    const up = path.dirname(d);
    if (up === d) return null;
    d = up;
  }
}

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) out.push({ rel: path.relative(base, p), link: true });
    else if (e.isDirectory()) walk(p, base, out);
    else if (e.isFile()) out.push({ rel: path.relative(base, p) });
  }
  return out;
}

async function main() {
  const a = args(process.argv.slice(2));
  if (a.keys !== 'published' && a.keys !== 'garden') fail(`--keys takes published or garden, not ${a.keys}`);
  const pkg = a.dir ? path.resolve(a.dir) : findPackage(HERE);
  if (!pkg || !fs.existsSync(path.join(pkg, 'MANIFEST.json'))) fail('no MANIFEST.json — this is not a sealed package');

  const libVerify = path.join(HERE, 'bonsai-garden-sign', 'lib', 'verify.mjs');
  if (!fs.existsSync(libVerify)) fail(`no verifier at ${path.relative(pkg, libVerify) || libVerify}`);
  const verify = await import(pathToFileURL(libVerify).href);
  const finder = await import(pathToFileURL(path.join(HERE, 'bonsai-garden-sign', 'lib', 'sidecar-format.mjs')).href);
  const manifestFile = path.join(pkg, 'MANIFEST.json');
  for (const p of [finder.sidecarPathFor(manifestFile), finder.legacySidecarPathFor(manifestFile)])
    OWN.add(path.basename(p));

  let m;
  try {
    m = JSON.parse(fs.readFileSync(path.join(pkg, 'MANIFEST.json'), 'utf8'));
  } catch (e) {
    fail(`MANIFEST.json does not parse (${e.message})`);
  }
  for (const k of ['slug', 'owner', 'version', 'build', 'source', 'algorithm', 'files']) {
    if (!(k in m)) fail(`MANIFEST.json has no ${k}`);
  }
  if (m.algorithm !== 'sha256') fail(`MANIFEST.json algorithm is ${m.algorithm}, not sha256`);

  // 2a. an unsealed local build (package.py core alone, no key named) says so in its manifest. Its seal step does
  //     not run; every byte is still checked below, and the answer is UNSEALED, exit 1, never ok: the integrity
  //     line stops on it. A manifest that says unsealed while a seal sits beside it is a contradiction, and fails.
  if ('unsealed' in m && (typeof m.unsealed !== 'string' || !m.unsealed.trim()))
    fail('MANIFEST.json names `unsealed` without a reason');
  const unsealed = typeof m.unsealed === 'string' ? m.unsealed.trim() : null;
  if (unsealed) {
    const seals = [finder.sidecarPathFor(manifestFile), finder.legacySidecarPathFor(manifestFile)].filter((p) =>
      fs.existsSync(p),
    );
    if (seals.length)
      fail(
        `MANIFEST.json says it is unsealed, and a seal sits beside it (${seals.map((p) => path.basename(p)).join(', ')}): one of the two is false`,
      );
  }

  // 2. the seal, by the named key source
  let verdict = null;
  let retired = false;
  if (!unsealed) {
    const manifestPath = path.join(pkg, 'MANIFEST.json');
    if (a.keys === 'garden') {
      const g = process.env.BONSAI_GARDEN;
      if (!g) fail('--keys garden needs $BONSAI_GARDEN naming a garden outside this package');
      const root = path.resolve(g.replace(/^~(?=$|\/)/, process.env.HOME || '~'));
      const rel = path.relative(root, pkg);
      if (!rel.startsWith('..') && !path.isAbsolute(rel))
        fail(`$BONSAI_GARDEN (${root}) contains this package; its keys would be the package's own`);
      const { resolveGardenRoot } = await import(
        pathToFileURL(path.join(HERE, 'bonsai-garden-sign', 'lib', 'garden-root.mjs')).href
      );
      const r = resolveGardenRoot(null);
      if (path.resolve(r) !== root) fail(`garden root resolved to ${r}, not $BONSAI_GARDEN`);
      verdict = verify.verifySidecarFile(manifestPath, { root });
    } else {
      verdict = await verify.verifySidecarFilePublished(manifestPath);
    }
    // Seal v2: a v1 manifest seal reads retired-v1 — accepted, with a warning, only
    // while the verifier's own seal-policy.json says warn; refused after the cutover.
    retired = verdict.status === 'retired-v1' && verdict.accepted === true;
    // the dot-prefixed sidecar change phase 3: a manifest seal at the old name, accepted while "sidecar-name" is warn
    const retiredName = verdict.status === 'retired-sidecar-name' && verdict.accepted === true;
    if (verdict.status !== 'ok' && !retired && !retiredName) {
      fail(`manifest seal: ${verdict.status}${verdict.reason ? ` — ${verdict.reason}` : ''}`);
    }
    if (retired)
      console.error(
        `WARN     integrity: the manifest carries a retired v1 seal — accepted until the cutover; repackage`,
      );
    if (retiredName)
      console.error(
        `WARN     integrity: the manifest's seal sits at the old name MANIFEST.json.bonsaisig — accepted until the flip; repackage`,
      );
    const signer = verdict.meta?.signer;
    if (signer !== m.owner) fail(`manifest sealed by '${signer}', but its owner is '${m.owner}'`);
    // a custodian seal is never authorship: the manifest must be the owner's, as owner
    if (!retired && verdict.meta.role !== 'owner')
      fail(`manifest sealed by '${signer}' as ${verdict.meta.role}, not as owner`);
  }

  // 3. this package's own name
  const skill = path.join(pkg, 'SKILL.md');
  if (m.kind !== 'plugin') {
    if (!fs.existsSync(skill)) fail('no SKILL.md beside the manifest');
    const nm = /^name:\s*["']?([^"'\n]+?)["']?\s*$/m.exec(fs.readFileSync(skill, 'utf8'));
    if (!nm || nm[1] !== m.slug) fail(`SKILL.md name '${nm ? nm[1] : ''}' is not the manifest's '${m.slug}'`);
  }

  // 4. every byte
  const prefix = `${m.slug}/`;
  const listed = new Map();
  for (const [k, v] of Object.entries(m.files)) {
    if (!k.startsWith(prefix)) fail(`manifest entry outside the package: ${k}`);
    listed.set(k.slice(prefix.length), v);
  }
  const problems = [];
  const seen = new Set();
  let frontmatterRewritten = false;
  let liveStore = null; // the directory a LIVE install's `memory` link resolves to
  for (const f of walk(pkg)) {
    const rel = f.rel.split(path.sep).join('/');
    if (OWN.has(rel)) continue;
    if (f.link) {
      if (rel === 'memory') {
        // LIVE (W's SKILL.md §Memory): a symlink that resolves to a directory. The seed under it is
        // the state this install started from, superseded by what the link points at; checking the
        // live store against the seed would fail every correct install. BROKEN (dangles, or a file)
        // is a stop: the store is gone or moved, and the seed must not be read in its place.
        let target = null;
        try {
          target = fs.realpathSync(path.join(pkg, 'memory'));
          if (!fs.statSync(target).isDirectory()) target = null;
        } catch {
          target = null;
        }
        if (target) {
          liveStore = target;
          continue;
        }
        let link = '?';
        try {
          link = fs.readlinkSync(path.join(pkg, 'memory'));
        } catch {}
        problems.push(
          `memory is a BROKEN link (${link}): the live store is gone or moved, and the seed is not read in its place`,
        );
        continue;
      }
      problems.push(`symlink: ${rel}`);
      continue;
    }
    seen.add(rel);
    const want = listed.get(rel);
    if (want === undefined) {
      problems.push(`not in the manifest: ${rel}`);
      continue;
    }
    const got = createHash('sha256')
      .update(fs.readFileSync(path.join(pkg, rel)))
      .digest('hex');
    if (
      got !== want &&
      rel === 'SKILL.md' &&
      m.skill_body &&
      skillBodyHash(fs.readFileSync(path.join(pkg, rel), 'utf8')) === m.skill_body
    ) {
      frontmatterRewritten = true;
      continue;
    }
    if (got !== want) problems.push(`changed: ${rel}`);
  }
  // the seed: the manifest's memory/ entries, unchecked only behind a live store
  const seed = [...listed.keys()].filter((rel) => rel === 'memory' || rel.startsWith('memory/'));
  for (const rel of listed.keys()) {
    if (seen.has(rel)) continue;
    if (liveStore && seed.includes(rel)) continue;
    problems.push(`missing: ${rel}`);
  }
  if (problems.length) {
    fail(
      `${problems.length} file(s) differ from the sealed manifest — ${problems.slice(0, 8).join('; ')}` +
        (problems.length > 8 ? `; … ${problems.length - 8} more` : ''),
    );
  }

  const checked = liveStore ? listed.size - seed.length : listed.size;
  if (unsealed) {
    console.log(`UNSEALED integrity: ${m.slug} ${m.build} · ${checked} files match · no seal: ${unsealed}`);
    console.log(
      '  stop: nothing here wakes a kin; install the sealed release, and tell the gardener exactly this line.',
    );
    process.exit(1);
  }
  console.log(
    `ok       integrity: ${m.slug} ${m.build} · ${checked} files match · ` +
      `sealed by ${m.owner} ${(verdict.meta.fingerprint || '').slice(0, 8)} · keys ${a.keys}` +
      (retired ? ' · [retired-v1]' : '') +
      (frontmatterRewritten ? ' · SKILL.md frontmatter rewritten by the installer, body intact' : '') +
      (liveStore ? ' · memory: live store' : ''),
  );
  if (liveStore) {
    console.log(
      `         live store: memory → ${liveStore} · the manifest's ${seed.length} memory/ file(s) are the seed ` +
        `this install started from, not checked (the store is lived, not issued)`,
    );
  }
}

// The same as package.py's skill_body_hash: the body below the frontmatter, CRLF read as LF,
// outer whitespace trimmed. Change one, change both — test_package.py holds them together.
function skillBodyHash(text) {
  let t = text.replace(/\r\n/g, '\n');
  if (t.startsWith('---\n')) {
    const i = t.indexOf('\n---\n', 3);
    if (i >= 0) t = t.slice(i + 5);
  }
  return createHash('sha256')
    .update(t.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, ''), 'utf8')
    .digest('hex');
}

main().catch((e) => fail(e.message));
