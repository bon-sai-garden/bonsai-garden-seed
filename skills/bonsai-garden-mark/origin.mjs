// ---
// id: 01M4AFY7867WXRKGQZRWMYWVE8
// title: The one question a stranger's tool asks the origin, behind an interface
// type: script
// tended-by: baisai
// created: 2026-10-07
// updated: 2026-10-21
// ---
//
// origin.mjs — the network step of the gardener's keys, and the only one: "does bon-sai.garden
// vouch for this seal?" (spec-gardeners-keys.md §6.4 for the reserved set, §8.1 for Bonsai's seed
// entry). It is asked through bonsai-garden-sign's published-keys.mjs `adjudicatePublishedV2`,
// which checks the site's signed answer under the pinned workshop verifier key and believes
// nothing unsigned. This file adds one thing: the signed answer's own `verified_at`, captured
// from the answer the adjudicator believed, so the seed can record *when* the origin vouched.
//
//   const origin = makeOrigin();                 // the real one: bon-sai.garden, the pinned key
//   const v = await origin.ask(sidecarData);     // { status, reason, verifiedAt }
//
// `status` is `signature-vouched` or a published-keys reason: keys-unreachable, answer-unsigned,
// answer-forged, answer-malformed, rejected, bad-signature, bad-sidecar (…). Callers halt (3) on
// keys-unreachable and refuse (2) on everything else that is not `signature-vouched`.
//
// The parameters of makeOrigin exist for the test suites only, which pass a fake site and a
// throwaway verifier key IN PROCESS. There is no environment variable, flag or file that moves
// any of them: a switch that can move the trust anchor is a trust anchor (published-keys.mjs).
// No cache, no offline mode, no fallback (the ruling of 2026-09-24).
//
// THE COUNT (bon-sai.garden/stats, the site's src/stats.js; spec-gardeners-keys §8.1: the seed's question is also how
// the origin counts plantings, said openly). `ask(data, { count })` puts one field beside the seal in the request,
// never in it: exactly { event, release, lab-preview }, event `seed` or `start`, release a version
// (MAJOR.MINOR.PATCH[.BUILD][-LABEL]), lab-preview a boolean. Anything else is not sent, and nothing says so to the
// site. The answer is adjudicated by published-keys.mjs exactly as without it: the count changes no verdict. The
// site counts only a seal it vouches for, so `counted` is the field beside a vouch and null beside anything else.
//
// What a live check would need, and the suites never do: a host online, bon-sai.garden's /verify
// answering for bonsaisig/2, and the signer's key in the site's bundle. The suites stub the site.

import {
  adjudicatePublishedV2,
  PUBLISHED_VERIFY_URL,
  WORKSHOP_VERIFY_PK,
} from '../bonsai-garden-sign/lib/published-keys.mjs';

/** The events a seal check may be counted as (the site counts `planted` by another route, when there is one). */
export const COUNT_EVENTS = Object.freeze(['seed', 'start']);
/** A garden release, as the site's store reads one (src/stats-do.js RELEASE_RE): no build stamp. */
export const RELEASE_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}(?:\.\d{1,4})?(?:-[a-z][a-z0-9]{0,11})?$/;
const COUNT_KEYS = 'event,lab-preview,release';

/** Why `count` is not the site's count field, or null: exactly the three keys, each its kind. */
export function countProblem(count) {
  if (!count || typeof count !== 'object' || Array.isArray(count)) return 'not an object';
  const keys = Object.keys(count).sort().join(',');
  if (keys !== COUNT_KEYS) return `its keys are ${keys || 'none'}, not event, release and lab-preview`;
  if (!COUNT_EVENTS.includes(count.event)) return `event ${JSON.stringify(count.event)} is not seed or start`;
  if (typeof count.release !== 'string' || !RELEASE_RE.test(count.release))
    return `release ${JSON.stringify(count.release)} is not a release`;
  if (typeof count['lab-preview'] !== 'boolean') return 'lab-preview is not true or false';
  return null;
}

export function makeOrigin({ fetchImpl = null, pinnedKey = WORKSHOP_VERIFY_PK, url = PUBLISHED_VERIFY_URL } = {}) {
  return {
    url,
    async ask(data, { count = null } = {}) {
      let verifiedAt = null;
      // the three values rebuilt, so nothing else can ride along; a count that is not exactly the field is not sent
      const field =
        count && !countProblem(count)
          ? { event: count.event, release: count.release, 'lab-preview': count['lab-preview'] }
          : null;
      // read lazily: the global fetch at the moment of asking, never a copy taken at import
      const base = fetchImpl || ((...a) => globalThis.fetch(...a));
      const capture = async (u, init) => {
        const sent = field ? { ...init, body: JSON.stringify({ ...JSON.parse(init.body), count: field }) } : init;
        const resp = await base(u, sent);
        try {
          const j = await resp.clone().json();
          verifiedAt = j && typeof j.verified_at === 'string' ? j.verified_at : null;
        } catch {
          verifiedAt = null;
        }
        return resp;
      };
      const v = await adjudicatePublishedV2({ data, fetchImpl: capture, pinnedKey, url });
      // verified_at is believed only when the answer it came in was: it sits under response_sig
      return {
        status: v.status,
        reason: v.reason || null,
        verifiedAt: v.status === 'signature-vouched' ? verifiedAt : null,
        // what rode beside the seal, said only when the answer vouched: the site counts nothing else (as verifiedAt)
        counted: v.status === 'signature-vouched' ? field : null,
      };
    },
  };
}
