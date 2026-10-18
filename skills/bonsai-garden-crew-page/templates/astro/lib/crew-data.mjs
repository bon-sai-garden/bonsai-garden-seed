// ---
// id: 01M48VA7Q4674Z3QRTK4ZA0JV7
// title: Crew-page data — run the builder once per build, refuse what the guard refuses
// type: script
// tended-by: eisai
// created: 2026-10-06
// updated: 2026-10-08
// ---
//
// The instance names its config and where this skill is (core's scripts/build_crew_data.py, never
// copied). A bundler moves this file, so its own URL cannot be trusted at build time: the instance
// passes `skillDir`, found by marker. It runs once per build; every page shares the result.
//
//   loadCrew({ config: '/abs/.../crew-page.config.json', skillDir: '/abs/.../bonsai-garden-crew-page' })
//   preview: true needs the build's own --outDir, never dist/ (assertPreviewOutDir).
//   dev: true (an instance's dev server, import.meta.env.DEV) writes no output, so a preview there needs
//   no --outDir; a build never passes it.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { assertCrewData, assertPreviewOutDir } from './crew-guard.mjs';
import { rosterOrder } from './crew-nav.mjs';

let cache = null;

export function loadCrew({
  config,
  skillDir,
  preview = false,
  dev = false,
  python = 'python3',
  argv = process.argv,
  cwd = process.cwd(),
}) {
  if (cache) return cache;
  if (!config || !existsSync(config)) throw new Error(`crew: no config at ${config}`);
  const BUILDER = skillDir ? path.join(skillDir, 'scripts', 'build_crew_data.py') : '';
  if (!existsSync(BUILDER)) throw new Error(`crew: the builder is not beside this skill (${BUILDER})`);
  const mode = preview ? 'preview' : 'production';
  if (preview && !dev) assertPreviewOutDir(argv, cwd);
  const data = JSON.parse(
    execFileSync(python, [BUILDER, '--config', config, ...(preview ? ['--preview'] : [])], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      maxBuffer: 64 * 1024 * 1024,
    }),
  );
  assertCrewData(data, mode);
  const members = data.groups.flatMap((g) => g.members.map((m) => ({ ...m, group: g.key, family: g.family })));
  cache = { mode, preview, data, route: data.route, members, order: rosterOrder(data) };
  return cache;
}

// getStaticPaths for the instance's [slug] page: one real page per member.
export function crewPaths(crew) {
  return crew.members.map((m) => ({ params: { slug: m.slug } }));
}

// The one ring a member page plays: the rings array CrewShell embeds, and the index LedRing reads.
// The display palette (lit) is what the LEDs show; the canonical palette stays the data.
export function memberRings(m) {
  if (!m?.ring) return { rings: [], ringId: -1 };
  return {
    rings: [
      {
        palette: m.ring.display || m.ring.palette,
        glow: m.ring.glow || null,
        frames: m.ring.frames,
        frame_ms: m.ring.frame_ms,
      },
    ],
    ringId: 0,
  };
}
