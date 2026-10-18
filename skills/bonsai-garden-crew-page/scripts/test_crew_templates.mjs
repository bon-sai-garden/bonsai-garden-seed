// ---
// id: 01M48W8K8AHYGQQP1AXQJ1D18N
// title: Watch the crew-page templates' guards fail (node:test, core alone)
// type: script
// tended-by: eisai
// created: 2026-10-06
// updated: 2026-10-06
// ---
//
// node scripts/test_crew_templates.mjs — the page's second refusal, the navigation circle, the
// preview's own folder, and the visual rules a template must keep (no reticle, selector with no
// LED ticks or category labels, labels never cut, the outer ring only on the member shown).
// The ring script's motion is tested by an instance that has a DOM to run it in.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCrewData, assertPreviewOutDir } from '../templates/astro/lib/crew-guard.mjs';
import { rosterOrder, navFor } from '../templates/astro/lib/crew-nav.mjs';

const T = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../templates/astro');
const good = { status: 'approved', approved: true, sealed: true, draft: false, draft_reasons: [] };
const data = (mode, intro) => ({ mode, groups: [{ key: 'a', members: [{ slug: 'alpha', intro }] }] });

test('production lets approved and sealed through, and "introduction coming"', () => {
  assertCrewData(data('production', good), 'production');
  assertCrewData(data('production', null), 'production');
});
test('production refuses a draft, an unsealed introduction, and preview data', () => {
  assert.throws(
    () => assertCrewData(data('production', { ...good, status: 'draft', approved: false, draft: true }), 'production'),
    /refuses alpha/,
  );
  assert.throws(() => assertCrewData(data('production', { ...good, sealed: false }), 'production'), /sealed false/);
  assert.throws(() => assertCrewData(data('preview', good), 'production'), /data says preview/);
});
test('a preview builds only into its own folder', () => {
  assert.throws(() => assertPreviewOutDir(['astro', 'build'], '/app'), /own --outDir/);
  assert.throws(() => assertPreviewOutDir(['astro', 'build', '--outDir', 'dist'], '/app'), /may not write into dist/);
  assert.equal(assertPreviewOutDir(['astro', 'build', '--outDir', '/tmp/p'], '/app'), '/tmp/p');
});
test('the roster order is the selector rows; previous and next are a circle', () => {
  const order = rosterOrder({
    rows: [
      ['a', 'b', 'c'],
      ['d', 'e'],
    ],
    groups: [],
  });
  assert.deepEqual(order, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual([navFor(order, 'a').prev, navFor(order, 'e').next], ['e', 'a']);
  assert.deepEqual([navFor(order, 'c').prev, navFor(order, 'c').next], ['b', 'd']);
  assert.throws(() => navFor(order, 'z'), /not on the roster/);
});
for (const f of [
  'crew.css',
  'components/LedRing.astro',
  'components/CrewShell.astro',
  'components/AgentSelector.astro',
  'components/CrewMember.astro',
  'components/CrewOverview.astro',
  'components/RingPlayer.astro',
]) {
  test(`${f} ships no corner-bracket, crosshair or reticle frame`, () => {
    const src = readFileSync(path.join(T, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\*.*$/gm, '');
    assert.doesNotMatch(src, /\.tm-[\w-]*(bracket|crosshair|cross-hair|reticle|corner)/i);
    assert.doesNotMatch(src, /class="[^"]*(bracket|crosshair|reticle|corner)/i);
    assert.doesNotMatch(src, /M4 26V4h22/);
  });
}
test('the selector: no LED ring, no category label, labels never cut, the outer ring only on the member shown', () => {
  const sel = readFileSync(path.join(T, 'components/AgentSelector.astro'), 'utf8');
  const css = readFileSync(path.join(T, 'crew.css'), 'utf8');
  assert.doesNotMatch(sel, /LedRing|class="led|halo|tm-roster-kanji|tm-roster-group/);
  assert.doesNotMatch(css.match(/\.tm-roster-name \{[^}]*\}/)[0], /ellipsis|nowrap/);
  assert.match(sel, /on \? 'tm-av is-current' : 'tm-av'/);
  assert.match(css, /\.tm-av\.is-current \{[^}]*0 0 0 7px/);
});
test('no template names a route, a domain or a member', () => {
  for (const f of [
    'components/CrewMember.astro',
    'components/CrewOverview.astro',
    'components/AgentSelector.astro',
    'components/CrewShell.astro',
    'components/RingPlayer.astro',
  ]) {
    const src = readFileSync(path.join(T, f), 'utf8');
    assert.doesNotMatch(src, /href="\/[a-z]|bon-sai\.garden|\/teams\//, f);
  }
});

test("a quote block renders as a blockquote with a quiet cite, from the builder's escaped blocks", () => {
  const src = readFileSync(path.join(T, 'components/CrewMember.astro'), 'utf8');
  const css = readFileSync(path.join(T, 'crew.css'), 'utf8');
  assert.match(src, /m\.intro\.blocks/, 'the body is rendered from blocks, in order');
  assert.match(src, /<blockquote class="tm-quote">/, 'a quote is a blockquote');
  assert.match(src, /<cite class="tm-quote-cite"/, 'its attribution is a cite');
  assert.match(css, /\.tm-quote-cite\s*\{/, 'the cite has its quiet style');
});
