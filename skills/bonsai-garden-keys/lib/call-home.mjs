// ---
// id: 01M498HDB7Y03D801KWN24NFXE
// title: The call home, behind an interface whose transport is still open
// type: script
// tended-by: baisai
// created: 2026-10-06
// updated: 2026-10-06
// ---
//
// call-home.mjs — spec-gardeners-keys.md §10: one document, public material only, one way.
// The document is fixed by the spec; the transport is OPEN (provisioning spec §5, the Aruji's).
// This file is the seam: `transport()` returns the one in use, and today that is `unwired`, which
// sends nothing and says so. A transport, when one is ruled, implements `send(paths)` and returns
// `{ sent: true, where }` or throws; nothing ever comes back into the garden by it.

export const unwired = Object.freeze({
  name: 'unwired',
  async send() {
    return {
      sent: false,
      where: null,
      why: "the call-home transport is open (spec-gardeners-keys §10; the Aruji's): the document is written and sealed, and nothing was sent",
    };
  },
});

export function transport() {
  return unwired;
}
