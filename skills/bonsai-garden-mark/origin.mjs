// ---
// id: 01M4AFY7867WXRKGQZRWMYWVE8
// title: The one question a stranger's tool asks the origin, behind an interface
// type: script
// tended-by: baisai
// created: 2026-10-07
// updated: 2026-10-07
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
// What a live check would need, and the suites never do: a host online, bon-sai.garden's /verify
// answering for bonsaisig/2, and the signer's key in the site's bundle. The suites stub the site.

import {
  adjudicatePublishedV2,
  PUBLISHED_VERIFY_URL,
  WORKSHOP_VERIFY_PK,
} from '../bonsai-garden-sign/lib/published-keys.mjs';

export function makeOrigin({ fetchImpl = null, pinnedKey = WORKSHOP_VERIFY_PK, url = PUBLISHED_VERIFY_URL } = {}) {
  return {
    url,
    async ask(data) {
      let verifiedAt = null;
      // read lazily: the global fetch at the moment of asking, never a copy taken at import
      const base = fetchImpl || ((...a) => globalThis.fetch(...a));
      const capture = async (u, init) => {
        const resp = await base(u, init);
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
      };
    },
  };
}
