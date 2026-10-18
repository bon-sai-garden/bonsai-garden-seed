// ---
// id: 01M48VA7N2E665M8513WS3VAVY
// title: Crew-page navigation — the roster order and previous/next
// type: script
// tended-by: eisai
// created: 2026-10-06
// updated: 2026-10-06
// ---
//
// The order is the agent selector's two rows in the instance's members file (selector-rows), read
// left to right, top to bottom: nothing else decides it. Data without rows falls back to the groups.
// The roster is a circle: the last member's next is the first. scripts/build_crew_data.py
// --check-built checks the built pages against the same rule (expected_nav).

export function rosterOrder(data) {
  if (Array.isArray(data.rows)) return data.rows.flat();
  return data.groups.flatMap((g) => g.members.map((m) => m.slug));
}

export function navFor(order, slug) {
  const i = order.indexOf(slug);
  if (i < 0) throw new Error(`crew: ${slug} is not on the roster`);
  const n = order.length;
  return { prev: order[(i - 1 + n) % n], next: order[(i + 1) % n], index: i, total: n };
}
