#!/usr/bin/env node
// ---
// id: 01M3J0BF3SE90QFFFNCF4RJHK9
// title: verify-many.mjs — many seal verdicts in one process, for the conformance gate
// type: script
// tended-by: baisai
// created: 2026-09-27
// updated: 2026-10-21
// ---
//
// check-shintai-conformance.py verified a shintai by starting `node sign.mjs` once per seal: 148 starts,
// 20 s, for one body. That cost kept the gate out of bonsai_session_start (Tasai's ask, 2026-09-27).
// This runs the SAME verdicts in one process: the library functions sign.mjs's own `verify` and
// `verify-sidecar` call, with the same arguments, and the same first line sign.mjs would print.
// It decides nothing of its own. A parity test holds it to the CLI, file by file, on real
// and planted seals.
//
//   stdin:  one JSON object per line   {"verb": "verify" | "verify-sidecar" | "find-sidecar" | "target-of", "file": "<path>"}
//   stdout: one JSON object per line   {"file", "verb", "ok": bool, "retired": bool, "first": "<line>"}
//           a v2 seal's verdict adds {"sealedAt", "foundAt", "moved"}: the address it was sealed at, the address it is
//           found at (null with no seal root above it), and whether they differ. Provenance, never a verdict (F-12,
//           2026-10-21); the first line names it only when moved, as sign.mjs prints it.
//           find-sidecar (file = a target)  adds {"status": "ok"|"two-sidecars"|"no-sidecar", "sidecar": path|null}
//           target-of    (file = a sidecar) adds {"status": "ok"|"ambiguous-sidecar"|"not-a-sidecar", "target": path|null, "exists": bool}
//
// The two finder verbs relay lib/sidecar-format.mjs, the one Node finder (the dot-prefixed sidecar change: since phase 1b a
// seal is written at `.X.bonsaisig`; `X.bonsaisig` is found, and its verdict reads retired-sidecar-name
// (phase 3, under seal-policy.json "sidecar-name"); both beside one file is
// `two-sidecars`, never a preference). The Python gates ask here instead of building a sidecar name
// of their own: a third copy of the rule is the drift the spec forbids (2026-10-05).
//
//   node tools/verify-many.mjs [--keys garden|published]     (garden is the gate's default)
//   node tools/verify-many.mjs --keys pot --pot <dir> [--expect-fp <fp32>]
//        a pot vouching for its own files (Mori-shin's ruling, 2026-10-11): the pot is NAMED, trusted only if its
//        garden.json says lab-preview: true or the signer is pinned, a good seal reads `pot-ok  <file>  keys: pot <dir>`
//        with `pot: true` (and `labSoftened` when lab-preview accepted a software-fallback seal), never `ok`; a pot
//        verifies v2 SIDECARS only: the embedded `verify` verb is not ok under a pot; an untrusted or unnamed pot
//        answers every job with its refusal, never a pass. The seam is skills/bonsai-garden-sign/lib/pot-keys.mjs.
//   node tools/verify-many.mjs --keys pot --pot <dir> --pins <file>
//        the same, with each seal's signer pinned by its OWN fingerprint from the gardener's pin file
//        ({"pins": {"<slug>": "<fp32>"}}, ~/.bonsai-garden/pins/<garden>.json, written by his hand). A body holds seals
//        by more than one signer (a custodian's, a sibling's), and one --expect-fp pins one of them: every other seal read
//        pin-mismatch (the 0.8.2 acceptance run, 2026-10-17: the origin served from its pot). Each seal still verifies
//        through pot-keys with --expect-fp's meaning, the pin of the signer it names; a signer with no pin is untrusted.

import fs from 'node:fs';
import readline from 'node:readline';
import {
  verifyEmbeddedFile,
  verifySidecarFile,
  verifyEmbeddedFilePublished,
  verifySidecarFilePublished,
} from '../skills/bonsai-garden-sign/lib/verify.mjs';
import { resolveGardenRoot } from '../skills/bonsai-garden-sign/lib/garden-root.mjs';
import * as SEAL from '../skills/bonsai-garden-sign/lib/seal-v2.mjs';
const { RETIRED_V1 } = SEAL;
// the status word is an interface (the first token of a line callers grep); read from seal-v2.mjs, which owns it,
// and spelled out only so that a seal-v2.mjs without it cannot take every gate down at import (the dot-prefixed sidecar change phase 3)
const RETIRED_SIDECAR_NAME = SEAL.RETIRED_SIDECAR_NAME ?? 'retired-sidecar-name';
import { findSidecar, targetPathFor } from '../skills/bonsai-garden-sign/lib/sidecar-format.mjs';
import { potTrust } from '../skills/bonsai-garden-sign/lib/pot-keys.mjs';

const flag = (n) => {
  const j = process.argv.indexOf(n);
  return j === -1 ? null : process.argv[j + 1];
};
const KEYS = flag('--keys') ?? 'garden';
if (KEYS !== 'garden' && KEYS !== 'published' && KEYS !== 'pot') {
  console.error(`--keys takes 'published', 'garden' or 'pot', not '${KEYS}'`);
  process.exit(2);
}
const POTDIR = flag('--pot'),
  PIN = flag('--expect-fp'),
  PINS_FILE = flag('--pins');
if (PIN !== null && !/^[0-9a-f]{32}$/.test(PIN)) {
  // the same shape both CLIs refuse: an empty pin is not "no pin"
  console.error("--expect-fp is the signer's 32-hex fingerprint");
  process.exit(2);
}
let PINS = null; // slug → fp32, the gardener's pin file; one pin per signer
if (PINS_FILE !== null) {
  if (KEYS !== 'pot' || POTDIR === null || PIN !== null) {
    console.error('--pins needs --keys pot --pot <dir>, and takes the place of --expect-fp (not both)');
    process.exit(2);
  }
  try {
    const doc = JSON.parse(fs.readFileSync(PINS_FILE, 'utf8'));
    const p = doc && typeof doc.pins === 'object' && doc.pins !== null && !Array.isArray(doc.pins) ? doc.pins : null;
    if (!p || !Object.values(p).every((v) => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v)))
      throw new Error('no {"pins": {slug: fp32}}');
    PINS = new Map(Object.entries(p));
  } catch (err) {
    console.error(`--pins ${PINS_FILE}: not a pin file (${err.message})`);
    process.exit(2);
  }
}
if ((KEYS === 'pot') !== (POTDIR !== null) || (PIN !== null && KEYS !== 'pot')) {
  console.error(
    KEYS === 'pot'
      ? '--keys pot needs --pot <dir>'
      : PIN !== null
        ? '--expect-fp needs --keys pot --pot <dir>'
        : '--pot <dir> needs --keys pot',
  );
  process.exit(2);
}
// a pot's trust is decided ONCE; when it cannot stand every job is answered with that refusal, never a pass
let POT = null,
  POT_REFUSED = null;
const trustOf = (pin) => {
  try {
    return { pot: potTrust(POTDIR, pin), refused: null };
  } catch (err) {
    return { pot: null, refused: { code: err.code === 'NOT_A_POT' ? 'not-a-pot' : 'pot-untrusted', why: err.message } };
  }
};
if (KEYS === 'pot') ({ pot: POT, refused: POT_REFUSED } = trustOf(PINS ? null : PIN));
// With --pins, the trust a seal is read under is its signer's: decided once per signer, from the pin file only. The slug
// is the sidecar's own claim; it chooses which pin is expected, and pot-keys then holds that signer's key to that pin.
const bySigner = new Map();
function trustFor(file) {
  if (!PINS) return { pot: POT, refused: POT_REFUSED };
  const sc = findSidecar(file);
  if (sc.status !== 'ok') return { finder: sc.status }; // no seal, or two: that is the verdict, not a trust question
  let signer = null;
  try {
    signer = JSON.parse(fs.readFileSync(sc.path, 'utf8')).signer ?? null;
  } catch {
    /* an unreadable seal names no signer: no pin, untrusted below */
  }
  const key = typeof signer === 'string' ? signer : '';
  if (!bySigner.has(key)) {
    const pin = PINS.get(key) ?? null;
    let t = trustOf(pin);
    // a lab-preview declaration stands in for a pin when the caller gave none; a caller who gave a pin file did, so a signer
    // the file does not name is refused in a lab pot as it is in any other (not-a-pot keeps its own word)
    if (!pin && t.pot)
      t = { pot: null, refused: { code: 'pot-untrusted', why: 'lab-preview is no pin once a pin file is given' } };
    if (t.refused && t.refused.code === 'pot-untrusted')
      t.refused.why = `no pin for ${key ? JSON.stringify(key) : 'an unnamed signer'} in ${PINS_FILE}; ${t.refused.why}`;
    bySigner.set(key, t);
  }
  return bySigner.get(key);
}

// The first line sign.mjs's reportVerdict prints for a result (stdout if it prints there, else
// stderr, which is what the gate read). Only the first token and the file are an interface; the
// gate reports the line as the finding.
function firstLine(r, file) {
  const where = 'sealedAt' in r ? { sealedAt: r.sealedAt, foundAt: r.foundAt, moved: r.moved } : {};
  return { ...firstLineOf(r, file), ...where };
}

function firstLineOf({ status, open, accepted, sealedAt, moved }, file) {
  const at = moved ? `  sealed at ${sealedAt}` : '';
  if (status === 'open') return { ok: false, retired: false, first: `OPEN     ${file}` };
  if (status === 'open-expired' && open)
    return { ok: false, retired: false, first: `FAIL     ${file}  [open-expired]` };
  if (status === 'ok') return { ok: true, retired: false, first: `ok       ${file}${at}` };
  if (status === RETIRED_V1 && accepted)
    return { ok: true, retired: true, first: `ok       ${file}  [${RETIRED_V1}]${at}` };
  // the dot-prefixed sidecar change phase 3: a seal at the old name, accepted while "sidecar-name" is warn: the line sign.mjs prints
  if (status === RETIRED_SIDECAR_NAME && accepted)
    return { ok: true, retired: false, retiredName: true, first: `ok       ${file}  [${RETIRED_SIDECAR_NAME}]${at}` };
  if (status === 'no-signature') return { ok: false, retired: false, first: `unsigned ${file}` };
  if (status === 'no-sidecar') return { ok: false, retired: false, first: `no-sidecar ${file}` };
  return { ok: false, retired: false, first: `FAIL     ${file}  [${status}]` };
}

async function verdict(verb, file) {
  if (!fs.existsSync(file)) return { ok: false, retired: false, first: `error: file not found: ${file}` };
  if (verb === 'find-sidecar') {
    const r = findSidecar(file);
    return { ok: r.status === 'ok', retired: false, first: `${r.status} ${file}`, status: r.status, sidecar: r.path };
  }
  if (verb === 'target-of') {
    try {
      const t = targetPathFor(file);
      if (t === null)
        return {
          ok: false,
          retired: false,
          first: `not-a-sidecar ${file}`,
          status: 'not-a-sidecar',
          target: null,
          exists: false,
        };
      return { ok: true, retired: false, first: `ok       ${file}`, status: 'ok', target: t, exists: fs.existsSync(t) };
    } catch (err) {
      const status = err.code === 'AMBIGUOUS_SIDECAR' ? 'ambiguous-sidecar' : 'error';
      return {
        ok: false,
        retired: false,
        first: `FAIL     ${file}  [${status}] ${err.message}`,
        status,
        target: null,
        exists: false,
      };
    }
  }
  if (KEYS === 'pot' && verb === 'pot-trust') {
    // the ONE reader of the lab switch: callers ask, they do not re-read garden.json
    if (PINS) {
      // per-signer pins: the pot itself stands when it is a pot; each seal's trust is its signer's pin
      const t = trustOf(null);
      const lab = t.pot ? t.pot.lab === true : false;
      if (t.refused && t.refused.code === 'not-a-pot')
        return { ok: false, retired: false, first: `FAIL     ${file}  [not-a-pot] ${t.refused.why}` };
      return {
        ok: true,
        retired: false,
        pot: true,
        lab,
        pinned: true,
        first: `pot-trust ${POTDIR}  ${lab ? 'lab-preview' : 'pinned'}`,
      };
    }
    if (POT_REFUSED)
      return { ok: false, retired: false, first: `FAIL     ${file}  [${POT_REFUSED.code}] ${POT_REFUSED.why}` };
    return {
      ok: true,
      retired: false,
      pot: true,
      lab: POT.lab === true,
      pinned: POT.pin !== null,
      first: `pot-trust ${POT.dir}  ${POT.lab ? 'lab-preview' : 'pinned'}`,
    };
  }
  if (KEYS === 'pot' && (verb === 'verify-sidecar' || verb === 'verify')) {
    const tr = trustFor(file);
    if (tr.finder) return firstLine({ status: tr.finder }, file);
    if (tr.refused)
      return { ok: false, retired: false, first: `FAIL     ${file}  [${tr.refused.code}] ${tr.refused.why}` };
    if (verb === 'verify')
      return {
        ok: false,
        retired: false,
        first: `FAIL     ${file}  [pot-embedded] a pot verifies v2 sidecars: the embedded verify verb is not offered under --keys pot`,
      };
    try {
      const r = verifySidecarFile(file, { pot: tr.pot });
      if (r.status === 'ok')
        return {
          ok: true,
          retired: false,
          pot: true,
          labSoftened: r.labSoftened === true,
          first: `pot-ok  ${file}  keys: pot ${tr.pot.dir}${r.moved ? `  sealed at ${r.sealedAt}` : ''}`,
          sealedAt: r.sealedAt,
          foundAt: r.foundAt,
          moved: r.moved,
        };
      return firstLine({ ...r, accepted: false }, file); // a pot's only yes is pot-ok
    } catch (err) {
      return { ok: false, retired: false, first: `error verifying sidecar for ${file}: ${err.message}` };
    }
  }
  try {
    let r;
    if (verb === 'verify-sidecar') {
      r =
        KEYS === 'garden'
          ? verifySidecarFile(file, { root: resolveGardenRoot(file) })
          : await verifySidecarFilePublished(file);
    } else if (verb === 'verify') {
      r =
        KEYS === 'garden'
          ? verifyEmbeddedFile(file, { root: resolveGardenRoot(file) })
          : await verifyEmbeddedFilePublished(file);
    } else {
      return { ok: false, retired: false, first: `error: unknown verb ${JSON.stringify(verb)}` };
    }
    return firstLine(r, file);
  } catch (err) {
    const first =
      verb === 'verify-sidecar' ? `error verifying sidecar for ${file}: ${err.message}` : `error: ${err.message}`;
    return { ok: false, retired: false, first };
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  let job;
  try {
    job = JSON.parse(line);
  } catch {
    console.log(JSON.stringify({ ok: false, first: `error: not JSON: ${line}` }));
    continue;
  }
  const v = await verdict(job.verb, job.file);
  console.log(JSON.stringify({ file: job.file, verb: job.verb, ...v }));
}
