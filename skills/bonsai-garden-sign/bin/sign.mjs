#!/usr/bin/env node
/**
 * ---
 * id: 01M2D299KV8E3T31S6TV5RT6MT
 * title: Keyring Bin Sign
 * type: script
 * tended-by: mori-shin
 * created: 2026-09-13
 * updated: 2026-09-26
 * ---
 * `type: script` is a placeholder — pending Baisai's patterns.md proposal
 * (2026-09-13 review); see ../lib/derive-key.mjs's header for the full note.
 *
 * CLI wrapper around ../sign-service.mjs — the thin, human-usable layer on
 * top of the actual mechanism. Nothing in here is logic the MCP wrapper
 * (a later step) would need to duplicate; it should `import` sign-service.mjs
 * directly instead of shelling out to this file.
 *
 * Usage:
 *   node sign.mjs status
 *     — reports the custody backend for this machine, touching no key
 *       material. Safe to run anywhere, anytime.
 *
 *   node sign.mjs sign --agent-salt <salt> --file <path> [--as <name>]
 *     — signs the file's exact bytes, prints a JSON envelope shaped like
 *       the workshop's existing .bonsaisig sidecars (file/signer/algorithm/
 *       timestamp/file_hash/signature/public_key_hex/fingerprint).
 *       <salt> is the agent's own signing salt (e.g. "bonsai-sign#587893")
 *       — the per-agent salt, not the master salt. Per bonsai-garden's own
 *       convention (see tools/keyring/setup.mjs's header), an agent's
 *       signing salt is the shareable half; it is not itself a secret.
 *
 *   node sign.mjs verify --public-key-hex <hex> --file <path> --signature <base64>
 *     — verifies a signature against the file's current bytes. Touches no
 *       key material at all.
 *
 * Deliberately does NOT read any registry or locked-salts file on its own —
 * see sign-service.mjs's own header and references/signing-service.md's "What's decided later"
 * section for why that wiring is left to the registry-integration step.
 */

import fs from 'node:fs';
import { signPayload, verifyPayload, getCustodyStatus, bodyHash } from '../sign-service.mjs';
import { assertNotEmbeddedFormat, hasEmbeddedSeal } from '../lib/document-format.mjs';
import { resolveGardenRoot, assertFingerprintMatchesRegistry } from '../lib/garden-root.mjs';
import { potTrust } from '../lib/pot-keys.mjs';
import {
  verifyEmbeddedFile,
  verifySidecarFile,
  verifyEmbeddedFilePublished,
  verifySidecarFilePublished,
} from '../lib/verify.mjs';
import { findSidecar, legacySidecarPathFor, writeSealSidecar } from '../lib/sidecar-format.mjs';
import { prepareV2, v2Payload, stripRetiredBlocks, nowUtc, RETIRED_V1, RETIRED_SIDECAR_NAME } from '../lib/seal-v2.mjs';
import { createHash } from 'node:crypto';
import { resolveRole } from '../lib/credit.mjs';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

async function cmdStatus() {
  const status = await getCustodyStatus();
  console.log(JSON.stringify(status, null, 2));
  process.exitCode = status.ready ? 0 : 1;
}

async function cmdSign(args) {
  const { 'agent-salt': agentSalt, file, as } = args;
  if (!agentSalt || !file) {
    console.error('Usage: sign.mjs sign --agent-salt <salt> --file <path> [--as <name>]');
    process.exitCode = 2;
    return;
  }

  const data = fs.readFileSync(file);

  // Refuse an embedded-format document rather than hand back a
  // detached signature over a body that still contains its own stale seal.
  // Narrow on purpose: markdown signs fine, a SEALED document does not.
  try {
    assertNotEmbeddedFormat(data.toString('utf8'), file);
  } catch (err) {
    if (err.code !== 'EMBEDDED_FORMAT') throw err;
    console.error(err.message);
    process.exitCode = 3;
    return;
  }

  const { signature, publicKeyHex, fingerprint, custodyTier, platform } = await signPayload({ agentSalt, data });

  const envelope = {
    file,
    signer: as || null,
    algorithm: 'ed25519+blake2b512',
    timestamp: new Date().toISOString(),
    file_hash: bodyHash(data),
    signature,
    public_key_hex: publicKeyHex,
    fingerprint,
    custody_tier: custodyTier,
    platform,
  };

  console.log(JSON.stringify(envelope, null, 2));
}

/**
 * `seal` — the EMBEDDED form: a body-hash written into the document's own
 * frontmatter. Unblocked by the gardener's ruling of 2026-09-15 that
 * being able to sign .md files is a necessity for core.
 *
 * Byte-identical to `python3 tools/sign.py sign` for the same key and input —
 * verified 28/28 at function level and 18/18 on full round trips, including
 * "identical sealed bytes" in both directions.
 */
async function cmdSeal(args) {
  const { 'agent-salt': agentSalt, file, as } = args;
  if (!agentSalt || !file || !as) {
    console.error(
      'Usage: sign.mjs seal --agent-salt <salt> --file <path.md> --as <slug> [--role owner|custodian] [--held-by <slug>] [--custody <tier>]',
    );
    process.exitCode = 2;
    return;
  }
  if (!file.endsWith('.md')) {
    console.error(`seal is for markdown. ${file} is not .md — use \`sign-sidecar\`.`);
    process.exitCode = 2;
    return;
  }
  // no default role (Tasai, 2026-09-24): refuse before a retired block is stripped
  if (fs.existsSync(file)) {
    try {
      resolveRole(file, as, args.role);
    } catch (err) {
      console.error(`error: ${err.message}`);
      process.exitCode = 2;
      return;
    }
  }
  // Seal v2: nothing is embedded any more. The retired sign: and open:
  // blocks come out of the frontmatter, and the document gets a v2 sidecar over its
  // exact bytes — `python3 tools/sign.py sign` does the same, byte for byte.
  const text = fs.readFileSync(file, 'utf8');
  const stripped = stripRetiredBlocks(text);
  if (stripped !== text) {
    const tmp = `${file}.tmp`;
    try {
      fs.writeFileSync(tmp, stripped, 'utf8');
      fs.renameSync(tmp, file);
    } catch (e) {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      throw e;
    }
    console.log(`retired: the embedded seal block(s) in ${file} — a v2 sidecar replaces them`);
  }
  await cmdSignSidecar(args);
}

/**
 * Where a verdict's key comes from — named, never inferred (Mori-shin, 2026-09-24;
 * ../references/trust-anchor.md).
 *
 *   published  (default) the site at bon-sai.garden answers for the seal; its
 *              answer is signed and checked. Unreachable is a loud FAIL.
 *   garden     the signer's key from a garden checkout on this host — only for
 *              tooling that holds the source the site is built from. It must
 *              be asked for by name; nothing ever falls back to it.
 */
function keysMode(args) {
  const mode = args.keys === undefined ? 'published' : args.keys;
  if (mode !== 'published' && mode !== 'garden' && mode !== 'pot') {
    console.error(`--keys takes 'published' (the default), 'garden' or 'pot', not '${mode}'`);
    process.exitCode = 2;
    return null;
  }
  // `--keys pot` is a switch thrown on purpose: the pot is NAMED, never inferred from where the file sits (Mori-shin's ruling, 2026-10-11).
  const fp = args['expect-fp'];
  if (mode === 'pot' && !args.pot) {
    console.error('error: --keys pot needs --pot <dir>: the pot is named, never inferred from where the file sits');
    process.exitCode = 2;
    return null;
  }
  if (args.pot && mode !== 'pot') {
    console.error('error: --pot <dir> needs --keys pot: verifying against a pot is a switch you throw on purpose');
    process.exitCode = 2;
    return null;
  }
  if (fp !== undefined && mode !== 'pot') {
    console.error('error: --expect-fp pins a signer inside a pot: it needs --keys pot --pot <dir>');
    process.exitCode = 2;
    return null;
  }
  if (fp !== undefined && !(typeof fp === 'string' && /^[0-9a-f]{32}$/.test(fp))) {
    console.error("error: --expect-fp is the signer's 32-hex fingerprint");
    process.exitCode = 2;
    return null;
  }
  return mode;
}

/**
 * `verify` has TWO forms, and conflating them was a real gap.
 *
 *   explicit  --public-key-hex + --file + --signature
 *             the original: raw bytes against a key the caller already holds.
 *   embedded  --file <x.md> alone
 *             what `python3 tools/sign.py verify <file>` means, and what ~10
 *             live callers in the mono repo actually run (resign-all.sh,
 *             resign-delta.sh, post-write-sign.sh, build-w-shintai.sh,
 *             sign-w-constitution.sh, validate-metadata.py, …).
 *
 * The porting plan's own verb table counts core's `verify` as already covering
 * sign.py's. It does not: the explicit form needs a key and a signature the
 * caller must already have, and hashes the whole file rather than the canonical
 * body. The embedded form below is the one the callers need, and on the caller
 * survey it is the single most-called verb of them all. Found by reading the
 * callers rather than the table.
 */
async function cmdVerify(args) {
  const { 'public-key-hex': publicKeyHex, file, signature } = args;
  if (!file) {
    console.error(
      'Usage: sign.mjs verify --file <path.md>\n' +
        '       sign.mjs verify --public-key-hex <hex> --file <path> --signature <base64>',
    );
    process.exitCode = 2;
    return;
  }

  if (publicKeyHex || signature) {
    if (!publicKeyHex || !signature) {
      console.error(
        'the explicit form needs BOTH --public-key-hex and --signature; ' + 'omit both for the embedded form',
      );
      process.exitCode = 2;
      return;
    }
    const data = fs.readFileSync(file);
    const ok = verifyPayload({ publicKeyHex, data, signature });
    console.log(ok ? 'valid' : 'INVALID');
    process.exitCode = ok ? 0 : 1;
    return;
  }

  if (!fs.existsSync(file)) {
    console.error(`error: file not found: ${file}`);
    process.exitCode = 2;
    return;
  }

  const mode = keysMode(args);
  if (!mode) return;
  if (mode === 'pot') {
    console.error("error: verifying against a pot is verify-sidecar's: --keys pot is not offered on verify");
    process.exitCode = 2;
    return;
  }
  let result;
  try {
    result =
      mode === 'garden'
        ? verifyEmbeddedFile(file, { root: resolveGardenRoot(file) })
        : await verifyEmbeddedFilePublished(file);
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exitCode = err.code === 'UNSUPPORTED_FORMAT' ? 2 : 1;
    return;
  }

  process.exitCode = reportVerdict(result, file, null);
}

/**
 * The printed shape is sign.py's, line for line. `resign-all.sh` greps this
 * output and `validate-metadata.py` maps its prefixes to issue codes, so the
 * first token of each line is an interface, not a presentation choice.
 */
function reportVerdict({ status, meta, open, reason, accepted, sealedAt, foundAt, moved }, file, sidecarPath) {
  const g = (k) => meta?.[k] || '?';
  // F-12 (2026-10-21): the address is provenance, never a verdict. The first token stays `ok`; the line says where the
  // bytes were sealed only when they are found elsewhere, and the ok lines name both addresses then.
  const at = moved ? `  sealed at ${sealedAt}` : '';
  if (status === 'open') {
    console.log(`OPEN     ${file}`);
    console.log(`  reason:   ${open.reason}`);
    console.log(`  closer:   ${open.closer}  (their act closes it)`);
    console.log(`  ruled by: ${open['ruled-by']}`);
    console.log(`  expires:  ${open.expires}`);
    return 3; // OPEN has its own exit code, as in sign.py
  }
  if (status === 'open-expired' && open) {
    console.error(`FAIL     ${file}  [open-expired]`);
    console.error(`  expired ${open.expires}; the closer is ${open.closer}`);
    return 1;
  }
  const okLines = () => {
    if (sidecarPath) console.log(`  sidecar:     ${sidecarPath}`);
    console.log(`  signer:      ${g('signer')}`);
    // a custodian seal is never authorship: the role is shown on every v2 verdict
    if (meta?.role) console.log(`  sealed as:   ${meta.role}: ${meta.signer}`);
    if (meta?.['held-by']) console.log(`  held by:     ${meta['held-by']}`);
    if (meta?.custody) console.log(`  custody:     ${meta.custody}`);
    if (meta?.id) console.log(`  id:          ${meta.id}`);
    if (moved) console.log(`  sealed at:   ${sealedAt}  (found at ${foundAt ?? 'no seal root'})`);
    if (meta?._key_path) console.log(`  key:         ${meta._key_path}`);
    if (meta?._kanji) console.log(`  kanji:       ${meta._kanji}`);
    console.log(`  fingerprint: ${g('fingerprint')}`);
    console.log(`  timestamp:   ${g('timestamp')}`);
  };
  if (status === 'ok') {
    console.log(`ok       ${file}${at}`);
    okLines();
    return 0;
  }
  if ((status === RETIRED_V1 || status === RETIRED_SIDECAR_NAME) && accepted) {
    // Accepted during the batch, so every caller that reads `ok` or exit 0 keeps
    // working — and the verdict is on the first line for every caller that looks.
    // When seal-policy.json flips its key to refuse, this becomes a FAIL everywhere at once.
    // retired-sidecar-name (the dot-prefixed sidecar change phase 3) is the same shape: its reason names the fix.
    console.log(`ok       ${file}  [${status}]${at}`);
    okLines();
    console.error(`WARN     ${file}  [${status}] ${reason}`);
    return 0;
  }
  if (status === 'no-signature') {
    console.log(`unsigned ${file}`);
    return 1;
  }
  if (status === 'no-sidecar') {
    console.log(`no-sidecar ${file}`);
    console.log(`  expected: ${sidecarPath}`);
    return 1;
  }
  console.error(`FAIL     ${file}  [${status}]`);
  if (reason) console.error(`  why:       ${reason}`);
  if (meta) {
    console.error(`  signer:    ${g('signer')}`);
    if (meta.role) console.error(`  sealed as: ${meta.role}: ${meta.signer}`);
    console.error(`  timestamp: ${g('timestamp')}`);
  }
  return 1;
}

/**
 * `verify-sidecar <file> --keys pot --pot <dir> [--expect-fp <fp32>]`: a pot vouching for its own files. A pot's yes is \`pot-ok\`, never \`ok\`
 * (our scripts match ^ok), and it names the root that vouched; a pot that is neither a declared rehearsal nor pinned is refused, naming both
 * ways out; a declared rehearsal softens custody-fallback for that root only and says so on every verify. Exit codes as sign.py's.
 */
function verifyInPot(file, args) {
  let pot;
  try {
    pot = potTrust(args.pot, args['expect-fp'] || null);
  } catch (err) {
    if (err.code === 'POT_UNTRUSTED') {
      console.log(`FAIL     ${file}  [pot-untrusted]`);
      console.log(`  why: ${err.message}`);
      return 1;
    }
    console.error(`error: ${err.message}`);
    return 2;
  }
  let result;
  try {
    result = verifySidecarFile(file, { pot });
  } catch (err) {
    console.error(`error verifying sidecar for ${file}: ${err.message}`);
    return 1;
  }
  if (result.status !== 'ok') return reportVerdict({ ...result, accepted: false }, file, result.sidecarPath); // a pot's only yes is pot-ok
  const m = result.meta || {};
  console.log(`pot-ok  ${file}  keys: pot ${pot.dir}${result.moved ? `  sealed at ${result.sealedAt}` : ''}`);
  if (result.labSoftened) console.log('pot-ok (lab-preview: custody software-fallback accepted)');
  if (result.sidecarPath) console.log(`  sidecar:     ${result.sidecarPath}`);
  console.log(`  signer:      ${m.signer || '?'}`);
  if (m.role) console.log(`  sealed as:   ${m.role}: ${m.signer}`);
  if (m.custody) console.log(`  custody:     ${m.custody}`);
  console.log(`  fingerprint: ${m.fingerprint || '?'}`);
  console.log(`  timestamp:   ${m.timestamp || '?'}`);
  return 0;
}

/**
 * `verify-sidecar` — THE verb this card exists for. The only thing in the
 * garden that detects a stale detached seal; it is what surfaced the stale
 * seals already committed.
 */
async function cmdVerifySidecar(args) {
  const { file } = args;
  if (!file) {
    console.error('Usage: sign.mjs verify-sidecar --file <path>');
    process.exitCode = 2;
    return;
  }
  if (!fs.existsSync(file)) {
    console.error(`error: file not found: ${file}`);
    process.exitCode = 2;
    return;
  }
  const mode = keysMode(args);
  if (!mode) return;
  if (mode === 'pot') {
    process.exitCode = verifyInPot(file, args);
    return;
  }
  let result;
  try {
    result =
      mode === 'garden'
        ? verifySidecarFile(file, { root: resolveGardenRoot(file) })
        : await verifySidecarFilePublished(file);
  } catch (err) {
    console.error(`error verifying sidecar for ${file}: ${err.message}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = reportVerdict(result, file, result.sidecarPath);
}

/**
 * `sign-sidecar` — the detached lifecycle core had none of. Maintains the
 * garden's 143 `.bonsaisig` files.
 *
 * Differs from sign.py in exactly one respect, and it is deliberate: the signing
 * salt is PASSED IN (`--agent-salt`) rather than looked up in the mono repo's
 * locked-salts.json. sign-service.mjs's header states why core does not read a
 * registry to find key material. That makes the caller name the key it signs
 * with — the property the 2026-08-24 silent-wrong-key report asked for. The
 * registry cross-check still fires; see below.
 */
async function cmdSignSidecar(args) {
  const { 'agent-salt': agentSalt, file, as } = args;
  if (!agentSalt || !file || !as) {
    console.error(
      'Usage: sign.mjs sign-sidecar --agent-salt <salt> --file <path> --as <slug> [--role owner|custodian] [--held-by <slug>] [--custody <tier>]',
    );
    process.exitCode = 2;
    return;
  }
  if (!fs.existsSync(file)) {
    console.error(`error: file not found: ${file}`);
    process.exitCode = 2;
    return;
  }
  // NO DEFAULT ROLE (Tasai's ruling, 2026-09-24; parity with sign.py's resolve_role): an
  // explicit --role stands; none given, owner is inferred only when the file's own credit
  // (lib/credit.mjs: tended-by, a letter's from:) names the signer. Anything else refuses.
  let role, roleHow;
  try {
    [role, roleHow] = resolveRole(file, as, args.role);
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exitCode = 2;
    return;
  }

  let root;
  try {
    root = resolveGardenRoot(file);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  // Seal v2: the signature covers every field — format, id, signer, role,
  // fingerprint, timestamp, algorithm, target, file-hash — behind the domain tag. The
  // payload names the fingerprint, so it is built from the key the provider derives.
  const timestamp = nowUtc();
  let obj = null;
  let fingerprint = null;
  let prepErr = null;
  let signature;
  try {
    ({ signature } = await signPayload({
      agentSalt,
      data: (publicKeyHex, gateFingerprint) => {
        // fp32, not the provider's fp8 — the trap `seal` has always documented. Through the signing
        // gate (the default since phase 1b) there is no public key here, only the gate's fp32.
        fingerprint =
          gateFingerprint ?? createHash('sha256').update(Buffer.from(publicKeyHex, 'hex')).digest('hex').slice(0, 32);
        // the two optional signed fields (2026-10-06): a letter's receiver, the salt's custody tier;
        // prepareV2's schema check refuses a value that is not a slug / not a tier before anything is signed
        try {
          obj = prepareV2(file, {
            signer: as,
            role,
            fingerprint,
            timestamp,
            heldBy: args['held-by'] || null,
            custody: args.custody || null,
          });
        } catch (err) {
          prepErr = err;
          return Buffer.alloc(0);
        }
        return v2Payload(obj);
      },
    }));
  } catch (err) {
    // Through the gate (the default since phase 1b) an empty payload is refused before anything else,
    // so the gate's sentence would mask the real cause: a prepareV2 failure (NO_SEAL_ROOT, ID_REFUSED,
    // TWO_SIDECARS). The cause is reported first; the gate's refusal is then a consequence, not news.
    // (Baisai, 2026-09-27, found live when every plugin build failed with the gate's words.)
    if (!prepErr) {
      console.error(err.message);
      process.exitCode = 1;
      return;
    }
  }
  if (prepErr) {
    console.error(prepErr.message);
    process.exitCode = prepErr.code === 'ID_REFUSED' || prepErr.code === 'NO_SEAL_ROOT' ? 3 : 2;
    return;
  }

  // Port of sign.py's `_assert_fingerprint_matches_registry`: refuse to write a
  // signature agents/registry.json would disagree with. A missing registry or an
  // unlisted slug means there is nothing to check, not a failure.
  try {
    assertFingerprintMatchesRegistry(root, as, fingerprint);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 3;
    return;
  }

  // The hidden name (the dot-prefixed sidecar change phase 1b); an old-name sidecar beside the file is moved onto it
  // first, so the id read above carries across and exactly one sidecar is left.
  const movedFrom = findSidecar(file).name === 'legacy' ? legacySidecarPathFor(file) : null;
  const sidecarPath = writeSealSidecar(file, { ...obj, signature });

  console.log(`signed:  ${file}`);
  console.log(`sidecar: ${sidecarPath}`);
  if (movedFrom)
    console.log(
      `moved:   ${movedFrom} -> ${sidecarPath}   (the dot-prefixed sidecar change: the hidden name; stage both)`,
    );
  console.log(`  format:      ${obj.format}`);
  console.log(`  sealed as:   ${role}: ${as}${roleHow === 'given' ? '' : `   (role ${roleHow})`}`);
  if (obj['held-by']) console.log(`  held by:     ${obj['held-by']}`);
  if (obj.custody) console.log(`  custody:     ${obj.custody}`);
  console.log(`  id:          ${obj.id}`);
  console.log(`  target:      ${obj.target}`);
  console.log(`  fingerprint: ${fingerprint}`);
  console.log(`  hash:        ${obj['file-hash'].slice(0, 16)}...`);
  console.log(`  algorithm:   ${obj.algorithm}`);
  if (file.endsWith('.md') && hasEmbeddedSeal(fs.readFileSync(file, 'utf8'))) {
    console.error(`note: ${file} still carries a retired embedded sign: block; \`seal\` removes it`);
  }
}

/**
 * `sign-verify` — seal, then immediately verify what was written.
 *
 * Two live callers: tools/markdown/reseal-broken.py:152 and
 * tools/markdown/unwrap-campaign.py:365, both of the 2,389-file unwrap
 * campaign. sign.py's own note on why it exists: it *"centralises the
 * sign-then-verify loop that was previously scattered across 8 scripts with
 * subtle variations."* The composite is the point — this workshop does not
 * accept a sign that was not watched to verify.
 */
async function cmdSignVerify(args) {
  await cmdSeal(args);
  if (process.exitCode) return;
  await cmdVerify({ file: args.file, keys: args.keys });
  if (process.exitCode) {
    console.error(`error: seal succeeded but immediate verify FAILED: ${args.file}`);
    process.exitCode = 1;
  }
}

const USAGE = [
  'Usage: sign.mjs <status|seal|sign|verify|sign-verify|sign-sidecar|verify-sidecar> [options]',
  '',
  "  SEAL v2 — a .bonsaisig beside every file; its signature covers the file's exact",
  '  bytes AND every field of the seal (id, signer, role, fingerprint, timestamp, target)',
  '    sign-sidecar   --agent-salt <s> --file <p> --as <slug> [--role owner|custodian]',
  '                   [--held-by <slug>] [--custody hardware|os-protected|vault-cli|software-fallback]',
  "                   two optional SIGNED fields: a letter's receiver; the tier the salt rested on",
  '    seal           --agent-salt <s> --file <p.md> --as <slug> [--role …]   retire the',
  '                   embedded block, then sign-sidecar',
  '    sign-verify    --agent-salt <s> --file <p.md> --as <slug>   seal, then verify it',
  '    verify-sidecar --file <p> [--keys published|garden]',
  '    verify-sidecar --file <p> --keys pot --pot <dir> [--expect-fp <fp32>]   a pot vouching for its own files: reads pot-ok, never ok',
  '    verify         --file <p> [--keys published|garden]   the sidecar if there is one,',
  '                   else the retired embedded block (reads retired-v1)',
  '',
  '  v1 seals (embedded sign: blocks, v1 sidecars) read retired-v1: accepted with a',
  '  warning while ../seal-policy.json says "v1": "warn", refused once it says "refuse".',
  '  a seal at the old sidecar name X.bonsaisig reads retired-sidecar-name: accepted with',
  '  a warning while "sidecar-name": "warn", refused once "refuse"; the fix is',
  '  git mv X.bonsaisig .X.bonsaisig, or a re-seal (the writers move it).',
  '    sign           --agent-salt <s> --file <p> [--as <n>]       envelope to stdout, no file written',
  '',
  '  verify also takes the explicit form: --public-key-hex <hex> --signature <b64> --file <p>',
  '',
  '  --keys published (default)  bon-sai.garden/verify answers, signed; unreachable is a FAIL',
  '  --keys garden                the signer key from a garden checkout; named, never a fallback',
  '  --keys pot --pot <dir>       the signer key from a NAMED pot: trusted only if its garden.json says lab-preview: true or the signer is pinned',
  "                               with --expect-fp; the registry fingerprint must be the key file's; a lab-preview pot softens custody-fallback for that root only",
  '',
  '  NOT PORTED from tools/sign.py (the porting plan records the caller evidence):',
  '    unsign · info · verify-response   — no live caller found',
  '    PNG seals (verify/sign of .png)   — needs Pillow; use sign.py, which refuses loudly here',
].join('\n');

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  switch (cmd) {
    case 'status':
      return cmdStatus();
    case 'seal':
      await cmdSeal(args);
      break;
    case 'sign':
      return cmdSign(args);
    case 'verify':
      return cmdVerify(args);
    case 'sign-verify':
      await cmdSignVerify(args);
      break;
    case 'sign-sidecar':
      await cmdSignSidecar(args);
      break;
    case 'verify-sidecar':
      await cmdVerifySidecar(args);
      break;
    default:
      console.error(USAGE);
      process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
