#!/usr/bin/env node
// ---
// id: 01M4ZTJPP2HN15F2XFDKPVXAE7
// title: test-lint.mjs — the lint runner refuses what it cannot check and fails on every kind of finding
// type: script
// tended-by: baisai
// created: 2026-10-15
// updated: 2026-10-18
// ---
//
// Each case builds a scratch repository with core's configs (the masters, tools/lint/ since 2026-10-18) and one
// planted file, runs tools/lint.mjs on it with
// --repo, and asserts the exit code and the line that names why. Needs uvx and npx with ruff 0.17.0 and Biome
// 2.5.15 reachable (cached or online); a case whose tool cannot start reports that, never a pass.
//
//   node tools/test-lint.mjs [--lint <lint.mjs>]     --lint: another runner (the one before a change, to watch the cases fail)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE = path.dirname(HERE);
const LINT = process.argv.includes('--lint')
  ? path.resolve(process.argv[process.argv.indexOf('--lint') + 1])
  : path.join(HERE, 'lint.mjs');
const LINTMOD = await import(LINT);
const { CONFIGS } = LINTMOD;
// the master of each copy (a runner from before 2026-10-18 kept them at core's root, under the copies' names)
const master = (c) => LINTMOD.MASTER_FILES?.[c] || path.join(CORE, c);
// the real path: on macOS os.tmpdir() is under /var, a link to /private/var, and Biome compares real paths; through
// the link it missed the second biome.jsonc that, by the real path, it refuses
const TMP = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'lint-test-'));

function repo(name, files, { configs = true } = {}) {
  const d = path.join(TMP, name);
  fs.mkdirSync(d, { recursive: true });
  spawnSync('git', ['init', '-q', d]);
  if (configs) for (const c of CONFIGS) fs.copyFileSync(master(c), path.join(d, c));
  for (const [f, text] of Object.entries(files)) fs.writeFileSync(path.join(d, f), text);
  return d;
}

function lint(dir, args = [], env = process.env) {
  const r = spawnSync(process.execPath, [LINT, '--repo', dir, ...args], { encoding: 'utf8', env });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const CLEAN_PY = 'import os\n\n\ndef home():\n    return os.environ.get("HOME")\n';
// biome-ignore lint/suspicious/noTemplateCurlyInString: a fixture is JavaScript source; its ${} is the planted file's own
const CLEAN_JS = 'export const greet = (name) => `hello ${name}`;\n';

const cases = [];
const t = (name, fn) => cases.push([name, fn]);

t('a clean repository passes', () => {
  const r = lint(repo('clean', { 'a.py': CLEAN_PY, 'a.mjs': CLEAN_JS }));
  return [r.code === 0 && /clean {2}biome/.test(r.out), `exit ${r.code}`];
});
t('a Python lint finding fails', () => {
  const r = lint(repo('py-lint', { 'a.py': `import sys\n${CLEAN_PY}`, 'a.mjs': CLEAN_JS }));
  return [r.code === 1 && /FINDINGS {2}ruff lint/.test(r.out) && /F401/.test(r.out), `exit ${r.code}`];
});
t('a Python format difference fails', () => {
  const r = lint(
    repo('py-format', { 'a.py': 'import os\ndef home():\n    return os.environ.get("HOME")\n', 'a.mjs': CLEAN_JS }),
  );
  return [r.code === 1 && /FINDINGS {2}ruff format/.test(r.out), `exit ${r.code}`];
});
t('a JavaScript warning fails', () => {
  const r = lint(
    repo('js-warn', { 'a.py': CLEAN_PY, 'a.mjs': `${CLEAN_JS}export function f(unused) {\n  return 1;\n}\n` }),
  );
  return [
    r.code === 1 && /FINDINGS {2}biome/.test(r.out) && /noUnusedFunctionParameters/.test(r.out),
    `exit ${r.code}`,
  ];
});
t('a JavaScript info alone fails', () => {
  const r = lint(repo('js-info', { 'a.py': CLEAN_PY, 'a.mjs': "export const greet = (name) => 'hello ' + name;\n" }));
  return [r.code === 1 && /FINDINGS {2}biome/.test(r.out) && /useTemplate/.test(r.out), `exit ${r.code}`];
});
t('a config that drifted from core is refused before anything runs', () => {
  const d = repo('drift', { 'a.py': CLEAN_PY, 'a.mjs': CLEAN_JS });
  fs.appendFileSync(path.join(d, 'ruff.toml'), '\n# a local change\n');
  const r = lint(d);
  return [r.code === 2 && /refused: .*ruff\.toml differs from the master/.test(r.out), `exit ${r.code}`];
});
t('a comment-free biome.json holding core settings passes', () => {
  const d = repo('biome-json', { 'a.py': CLEAN_PY, 'a.mjs': CLEAN_JS });
  const { stripJsonc } = LINTMOD;
  const v = JSON.parse(stripJsonc(fs.readFileSync(path.join(d, 'biome.jsonc'), 'utf8')));
  fs.rmSync(path.join(d, 'biome.jsonc'));
  // the same settings, keys in another order: the copy is compared by value, not by bytes
  fs.writeFileSync(
    path.join(d, 'biome.json'),
    JSON.stringify(Object.fromEntries(Object.entries(v).reverse()), null, 2),
  );
  // Biome formats its own config file too: a written copy is formatted once, as a repository would
  lint(d, ['--fix']);
  const r = lint(d);
  return [r.code === 0 && fs.existsSync(path.join(d, 'biome.json')), `exit ${r.code}`];
});
t('a comment added to a biome.jsonc copy is not drift', () => {
  const d = repo('biome-comment', { 'a.py': CLEAN_PY, 'a.mjs': CLEAN_JS });
  fs.writeFileSync(
    path.join(d, 'biome.jsonc'),
    `// a local note\n${fs.readFileSync(path.join(d, 'biome.jsonc'), 'utf8')}`,
  );
  const r = lint(d);
  return [r.code === 0, `exit ${r.code}`];
});
t('a Biome config with other settings is refused', () => {
  const d = repo('biome-other', { 'a.py': CLEAN_PY, 'a.mjs': CLEAN_JS });
  const f = path.join(d, 'biome.jsonc');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('"lineWidth": 120', '"lineWidth": 100'));
  const r = lint(d);
  return [r.code === 2 && /refused: .*biome\.jsonc holds other settings than the master/.test(r.out), `exit ${r.code}`];
});
t('a repository holding both biome.jsonc and biome.json is refused', () => {
  const d = repo('biome-both', { 'a.py': CLEAN_PY, 'a.mjs': CLEAN_JS });
  fs.copyFileSync(path.join(d, 'biome.jsonc'), path.join(d, 'biome.json'));
  const r = lint(d);
  return [r.code === 2 && /refused: .*both biome\.jsonc and biome\.json/.test(r.out), `exit ${r.code}`];
});
// the strip (2026-10-18): the masters leave core for the pot's build-process/lint/, and a repository keeps no copies.
// LONG_PY is clean at core's line length (120) and reformatted at ruff's default (88); QUOTED_JS is clean under core's
// Biome settings (single quotes) and not under Biome's defaults: each is clean only if the master was applied.
const LONG_PY =
  'def f(a, b, c, d):\n    return a\n\n\nx = f("argument_one", "argument_two", "argument_three", "argument_four_long")\n';
const QUOTED_JS = "export const a = 'single quoted';\n";
const masters = (name, edit = (t) => t) => {
  const d = path.join(TMP, name);
  fs.mkdirSync(d, { recursive: true });
  for (const c of CONFIGS) fs.writeFileSync(path.join(d, c), edit(fs.readFileSync(master(c), 'utf8'), c));
  return d;
};
t('a repository that keeps no copies is linted with the masters, named to the tools', () => {
  const r = lint(repo('no-copies', { 'a.py': LONG_PY, 'a.mjs': QUOTED_JS }, { configs: false }));
  return [
    r.code === 0 && /clean {2}ruff format/.test(r.out) && /clean {2}biome/.test(r.out),
    `exit ${r.code}: ${r.out.trim().split('\n').slice(-3).join(' | ')}`,
  ];
});
// core since 2026-10-18: the masters tracked below the root (tools/lint/), under their own names, named to the tools,
// and no copies at the root
const below = (name, files) => {
  const d = repo(name, files, { configs: false });
  fs.mkdirSync(path.join(d, 'tools', 'lint'), { recursive: true });
  const at = (c) => path.join(d, 'tools', 'lint', path.basename(master(c)));
  for (const c of CONFIGS) fs.copyFileSync(master(c), at(c));
  spawnSync('git', ['-C', d, 'add', '-A']);
  return lint(d, ['--ruff-config', at(CONFIGS[0]), '--biome-config', at(CONFIGS[1])]);
};
t('masters tracked below the root are applied, and their folder is no subtree of its own', () => {
  const r = below('masters-below', { 'a.py': LONG_PY, 'a.mjs': QUOTED_JS });
  return [
    r.code === 0 &&
      /clean {2}ruff format\n/.test(`${r.out}\n`) &&
      /clean {2}biome/.test(r.out) &&
      !/\(tools\/lint/.test(r.out),
    `exit ${r.code}: ${r.out
      .split('\n')
      .filter((l) => /^(clean|FINDINGS|refused)/.test(l))
      .join(' | ')}`,
  ];
});
t('masters tracked below the root: a JavaScript finding is still found', () => {
  const r = below('masters-below-js', {
    'a.py': CLEAN_PY,
    'a.mjs': `${QUOTED_JS}export function f(unused) {\n  return 1;\n}\n`,
  });
  return [
    r.code === 1 && /FINDINGS {2}biome/.test(r.out) && /noUnusedFunctionParameters/.test(r.out),
    `exit ${r.code}`,
  ];
});
t('half a set of copies is refused', () => {
  const d = repo('half', { 'a.py': CLEAN_PY }, { configs: false });
  fs.copyFileSync(master('ruff.toml'), path.join(d, 'ruff.toml'));
  const r = lint(d);
  return [r.code === 2 && /refused: .*ruff\.toml and no Biome config/.test(r.out), `exit ${r.code}`];
});
t('--ruff-config and --biome-config name masters outside core, and the tools read those', () => {
  const m = masters('bp-lint', (t, c) => (c === 'ruff.toml' ? t.replace('line-length = 120', 'line-length = 60') : t));
  const d = repo('named', { 'a.py': LONG_PY, 'a.mjs': QUOTED_JS }, { configs: false });
  const args = ['--ruff-config', path.join(m, 'ruff.toml'), '--biome-config', path.join(m, 'biome.jsonc')];
  const r = lint(d, args);
  return [r.code === 1 && /FINDINGS {2}ruff format/.test(r.out) && /clean {2}biome/.test(r.out), `exit ${r.code}`];
});
t('a copy that differs from a named master is refused', () => {
  const m = masters('bp-lint-2', (t, c) => (c === 'ruff.toml' ? `${t}\n# the master moved on\n` : t));
  const r = lint(repo('named-drift', { 'a.py': CLEAN_PY, 'a.mjs': CLEAN_JS }), [
    '--ruff-config',
    path.join(m, 'ruff.toml'),
    '--biome-config',
    path.join(m, 'biome.jsonc'),
  ]);
  return [r.code === 2 && /refused: .*ruff\.toml differs from the master/.test(r.out), `exit ${r.code}`];
});
// mixed masters (Fuji-shin's phase-1 check, finding 5: lint.mjs:132's `&&` -> `||` survived every suite): a repository
// is its own master only when it holds BOTH; holding one and named another, its copy is held to the named one
t('a repository holding the ruff master, named another Biome master, is held to it (not linted as its own)', () => {
  const m = masters('bp-lint-mixed-biome', (t, c) =>
    c === 'biome.jsonc' ? t.replace('"lineWidth": 120', '"lineWidth": 100') : t,
  );
  const d = repo('mixed-biome', { 'a.py': CLEAN_PY, 'a.mjs': CLEAN_JS });
  const r = lint(d, ['--ruff-config', path.join(d, 'ruff.toml'), '--biome-config', path.join(m, 'biome.jsonc')]);
  return [r.code === 2 && /refused: .*biome\.jsonc holds other settings than the master/.test(r.out), `exit ${r.code}`];
});
t('a repository holding the Biome master, named another ruff master, is held to it (not linted as its own)', () => {
  const m = masters('bp-lint-mixed-ruff', (t, c) =>
    c === 'ruff.toml' ? t.replace('line-length = 120', 'line-length = 60') : t,
  );
  const d = repo('mixed-ruff', { 'a.py': CLEAN_PY, 'a.mjs': CLEAN_JS });
  const r = lint(d, ['--ruff-config', path.join(m, 'ruff.toml'), '--biome-config', path.join(d, 'biome.jsonc')]);
  return [r.code === 2 && /refused: .*ruff\.toml differs from the master/.test(r.out), `exit ${r.code}`];
});
t('a subtree with its own ruff.toml keeps its own rules when the masters are named', () => {
  const d = repo('nested', { 'a.py': LONG_PY, 'a.mjs': QUOTED_JS }, { configs: false });
  fs.mkdirSync(path.join(d, 'sub'));
  fs.writeFileSync(path.join(d, 'sub', 'ruff.toml'), 'line-length = 60\n');
  fs.writeFileSync(path.join(d, 'sub', 'b.py'), LONG_PY);
  spawnSync('git', ['-C', d, 'add', '-A']);
  const r = lint(d);
  return [
    r.code === 1 &&
      /clean {2}ruff format\n/.test(`${r.out}\n`) &&
      /FINDINGS {2}ruff format \(sub: ruff\.toml\)/.test(r.out),
    `exit ${r.code}: ${r.out
      .split('\n')
      .filter((l) => /^(clean|FINDINGS)/.test(l))
      .join(' | ')}`,
  ];
});
t('--ruff-sub names a subtree its own config from outside the repository', () => {
  const m = masters('bp-lint-3');
  const subCfg = path.join(m, 'sub.ruff.toml');
  fs.writeFileSync(subCfg, 'line-length = 60\n');
  const d = repo('sub-named', { 'a.py': LONG_PY }, { configs: false });
  fs.mkdirSync(path.join(d, 'tools'));
  fs.writeFileSync(path.join(d, 'tools', 'b.py'), LONG_PY);
  const r = lint(d, ['--ruff-sub', `tools=${subCfg}`, '--', 'a.py', 'tools']);
  return [
    r.code === 1 &&
      /FINDINGS {2}ruff format \(tools: sub\.ruff\.toml\)/.test(r.out) &&
      /clean {2}ruff format\n/.test(`${r.out}\n`),
    `exit ${r.code}: ${r.out
      .split('\n')
      .filter((l) => /^(clean|FINDINGS)/.test(l))
      .join(' | ')}`,
  ];
});
t('a tool that does not start is refused, never a pass', () => {
  const env = {
    ...process.env,
    PATH: path.dirname(process.execPath) === '/usr/bin' ? '/nonexistent' : '/usr/bin:/bin',
  };
  const r = lint(repo('no-tool', { 'a.py': CLEAN_PY, 'a.mjs': CLEAN_JS }), [], env);
  return [r.code === 2 && /refused: uvx did not start/.test(r.out), `exit ${r.code}`];
});
t('a tool that starts and fails is refused, not counted as findings', () => {
  const r = lint(repo('tool-fails', { 'a.py': 'def broken(:\n', 'a.mjs': CLEAN_JS }));
  return [r.code === 2 && /refused: ruff format failed to run \(exit 2\)/.test(r.out), `exit ${r.code}`];
});
t('a named path that is neither Python nor JavaScript is refused', () => {
  const r = lint(repo('not-code', { 'a.py': CLEAN_PY, 'notes.md': '# notes\n' }), ['--', 'notes.md']);
  return [r.code === 2 && /refused: notes\.md is neither Python nor JavaScript/.test(r.out), `exit ${r.code}`];
});
t('--fix formats and applies safe fixes, then checks clean', () => {
  const d = repo('fix', {
    'a.py': `import sys\nimport os\ndef home():\n    return os.environ.get("HOME")\n`,
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a fixture is JavaScript source; its ${} is the planted file's own
    'a.mjs': 'export const greet=(name)=>`hello ${name}`\n',
  });
  const r = lint(d, ['--fix']);
  const py = fs.readFileSync(path.join(d, 'a.py'), 'utf8');
  const js = fs.readFileSync(path.join(d, 'a.mjs'), 'utf8');
  return [r.code === 0 && !py.includes('import sys') && js === CLEAN_JS, `exit ${r.code}`];
});
t('--fix leaves an unsafe fix for a person, and says so', () => {
  const src = "export const greet = (name) => 'hello ' + name;\n";
  const d = repo('fix-unsafe', { 'a.py': CLEAN_PY, 'a.mjs': src });
  const r = lint(d, ['--fix']);
  return [
    r.code === 1 && /useTemplate/.test(r.out) && fs.readFileSync(path.join(d, 'a.mjs'), 'utf8') === src,
    `exit ${r.code}`,
  ];
});
t('paths after -- limit the run', () => {
  const d = repo('paths', { 'good.py': CLEAN_PY, 'bad.py': `import sys\n${CLEAN_PY}`, 'a.mjs': CLEAN_JS });
  const r = lint(d, ['--', 'good.py', 'a.mjs']);
  return [r.code === 0, `exit ${r.code}`];
});
t('an unknown argument is refused', () => {
  const r = lint(repo('bad-arg', { 'a.py': CLEAN_PY }), ['--fxi']);
  return [r.code === 2 && /refused: unknown argument: --fxi/.test(r.out), `exit ${r.code}`];
});

let failed = 0;
for (const [name, fn] of cases) {
  let ok, why;
  try {
    [ok, why] = fn();
  } catch (e) {
    [ok, why] = [false, `threw: ${e.message}`];
  }
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  — ${why}`);
}
console.log(
  `\n${cases.length - failed}/${cases.length} passed${failed ? ` — ${failed} FAILED` : ''}   (scratch: ${TMP})`,
);
process.exit(failed ? 1 : 0);
