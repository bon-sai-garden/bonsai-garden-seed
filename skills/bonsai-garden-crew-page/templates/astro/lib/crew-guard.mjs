// ---
// id: 01M48VA7JF7ZHA9J16PYZ02GNE
// title: Crew-page guard — the page's own second refusal
// type: script
// tended-by: eisai
// created: 2026-10-06
// updated: 2026-10-06
// ---
//
// scripts/build_crew_data.py is where the guard lives: production includes an introduction only if it
// says `status: approved` and its seal verifies under the writer's own key. This is the page refusing
// a second time, on what it actually received, so a data file from the wrong mode, or a draft that
// slipped through, stops the build instead of shipping. Tested in scripts/test_crew_templates.mjs.

import path from 'node:path';

export function assertCrewData(data, mode) {
  if (!data || !Array.isArray(data.groups)) throw new Error('crew: no data');
  if (data.mode !== mode) {
    throw new Error(`crew: the data says ${data.mode}, this build is ${mode}; refusing to mix them`);
  }
  if (mode !== 'production') return;
  for (const g of data.groups) {
    for (const m of g.members) {
      const i = m.intro;
      if (!i) continue;
      if (i.status !== 'approved' || i.approved !== true || i.sealed !== true || i.draft !== false) {
        throw new Error(`crew: production refuses ${m.slug}'s introduction (status ${i.status}, sealed ${i.sealed})`);
      }
      if (i.draft_reasons?.length) {
        throw new Error(`crew: production refuses ${m.slug}: ${i.draft_reasons.join('; ')}`);
      }
    }
  }
}

// A preview carries drafts. It is built only into its own directory, never into dist/, which is
// what tools/publish-site.sh copies from. No --outDir, or one that is dist/, refuses.
export function assertPreviewOutDir(argv, appDir) {
  const k = argv.indexOf('--outDir');
  const out = k >= 0 ? argv[k + 1] : argv.find((a) => a.startsWith('--outDir='))?.split('=')[1];
  if (!out) {
    throw new Error('crew: a preview build needs its own --outDir (it must never land in dist/)');
  }
  const abs = path.resolve(appDir, out);
  if (abs === path.resolve(appDir, 'dist') || abs.startsWith(path.resolve(appDir, 'dist') + path.sep)) {
    throw new Error(`crew: a preview build may not write into dist/ (${out})`);
  }
  return abs;
}
