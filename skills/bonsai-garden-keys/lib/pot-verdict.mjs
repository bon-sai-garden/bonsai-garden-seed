// ---
// id: 01M4NTNRHKCWE4EZNDSX9A3XE7
// title: The verdict a pot gives its own file: core's policy, and a pot's own declared rehearsal
// type: script
// tended-by: baisai
// created: 2026-10-11
// updated: 2026-10-11
// ---
//
// pot-verdict.mjs: ONE function for the pot's own seals, so the commit gate (keys.mjs seal-staged --check) and the
// runtime's doctor (rt tools/rt/doctor.mjs) cannot read the lab-preview switch two ways. Bonsai's rehearsal, gap 69
// (2026-10-11): both still named a hand edit of core's machine-wide seal-policy.json as the way out, though the pot's
// own garden.json says `lab-preview: true` and every other verifier honours it for that root.
//
// The switch is the POT's, for that root only: a pot that minted with --lab-preview records it in its garden.json,
// and its own software-fallback seals are then accepted (`softened`), said so by the caller on every run. Core's
// seal-policy.json is never touched. A pot that did not declare a rehearsal is read under core's policy as it stands.
// Everything else the policy refuses stays refused (Mori-shin's ruling, 2026-10-11).

import fs from 'node:fs';
import path from 'node:path';
import { verifySidecarFile } from '../../bonsai-garden-sign/lib/verify.mjs';
import { potTrust } from '../../bonsai-garden-sign/lib/pot-keys.mjs';

/** A pot's declared rehearsal: its own garden.json says so. */
export function potIsLab(pot) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pot, 'garden.json'), 'utf8'))['lab-preview'] === true;
  } catch {
    return false;
  }
}

/** `{ ok, v, softened }`: ok, or the reason it is not (`v.status`). An explicit `policy` is core's, as given (no softening). */
export function potVerdict(pot, abs, policy = undefined) {
  const lab = !policy && potIsLab(pot);
  const v = verifySidecarFile(
    abs,
    lab ? { root: pot, pot: potTrust(pot) } : { root: pot, ...(policy ? { policy } : {}) },
  );
  return { ok: v.status === 'ok' || v.accepted === true, v, softened: v.labSoftened === true };
}

/** The line a run prints when it accepted seals under a pot's own rehearsal. */
export const labNote = (n) =>
  `lab-preview: custody software-fallback accepted for ${n} seal${n === 1 ? '' : 's'} (this pot's garden.json says lab-preview: true; core's seal-policy.json is unchanged)`;

/** What to say when a software-fallback seal is refused: the way out is the pot's own declaration, never a hand edit of core. */
export const NOT_LAB_NOTE =
  "a software-fallback seal is refused outside a lab preview (core's seal-policy.json): a pot declares its own rehearsal " +
  'with "lab-preview": true in its garden.json (mint --lab-preview writes it), and that softens this one rule for that pot only; ' +
  'real custody (1Password, the OS keystore) is the way out for a garden that is not a rehearsal';
