#!/usr/bin/env node
// ---
// id: 01M4ZTJPG7AH04DVGWBBBDCWT7
// title: lint.mjs — the one lint and format run for a garden repository, at the pinned versions
// type: script
// tended-by: baisai
// created: 2026-10-15
// updated: 2026-10-18
// ---
//
// lint.mjs — ruff for Python, Biome for JavaScript, at the versions pinned in this file, against the masters
// (core's tools/lint/ruff.toml and tools/lint/biome-master.jsonc) or a repository's copies of them. The gardener,
// 2026-10-15: "the best possible code base. No redundancy, perfectly linted."
//
//   node tools/lint.mjs                      check: format and lint every file; exit 1 on any finding
//   node tools/lint.mjs --fix                write: format, then the linters' safe fixes, then check
//   node tools/lint.mjs --repo <dir>         lint another repository with this runner (runtime is linted by core's)
//   node tools/lint.mjs [--fix] -- <path>…   only these paths, relative to the repository
//   --ruff-config <file> --biome-config <file>   the masters, named (default: core's tools/lint/, MASTER_FILES)
//   --ruff-sub <dir>=<file>                      a subtree linted under its own ruff config (repeatable)
//
// One master for each: core's tools/lint/ruff.toml and tools/lint/biome-master.jsonc, or the files named. They left
// core's top level for tools/lint/ on 2026-10-18 (the gardener: "biome and ruff etc. to be moved into a separate folder
// and not sit in top-level dir"), so core itself is linted with its masters named, like a repository with no copies.
// Inside the tree it checks, Biome 2 refuses any second file called biome.json(c) ("a nested root configuration"), so
// the Biome master carries a name Biome never discovers; ruff reads no other config once one is named, and the ruff
// master's folder is never taken for a subtree with a config of its own. (The strip, 2026-10-18: the masters leave core
// for the pot's build-process/lint/, and a repository then keeps no copies.) A repository that keeps copies at its
// root has them compared to the masters before anything runs (ruff.toml byte-equal, Biome's the same settings: a
// comment-free biome.json may hold them) and the tools read its copies, as before: a second master is caught, never
// trusted. One that keeps none is linted with the masters named to each tool (ruff --config, Biome --config-path).
// Under a named config ruff reads no other, so a subtree with its own (a tracked ruff.toml below the root, or
// --ruff-sub) is linted on its own, under its own, and left out of the root's run. Half a set of copies is refused.
//
// Exit: 0 clean · 1 findings · 2 refused (a tool that does not start, a config that drifted, a bad argument). A
// check that cannot run is never a pass.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RUFF = 'ruff@0.17.0'; // through uvx: a dev tool, nothing ships with it
export const BIOME = '@biomejs/biome@2.5.15'; // through npx
export const CONFIGS = ['ruff.toml', 'biome.jsonc']; // a copy's name at a repository's root

const CORE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// the masters, off core's top level since 2026-10-18, each under the name of the copy it masters
export const MASTER_FILES = {
  'ruff.toml': path.join(CORE, 'tools', 'lint', 'ruff.toml'),
  'biome.jsonc': path.join(CORE, 'tools', 'lint', 'biome-master.jsonc'), // never biome.json(c): Biome would find it
};
const same = (x, y) => path.resolve(x) === path.resolve(y);

class Refused extends Error {}

function parseArgs(argv) {
  const a = { fix: false, repo: null, paths: [], ruffConfig: null, biomeConfig: null, subs: [] };
  const value = (i, what) => {
    if (i + 1 >= argv.length) throw new Refused(`${argv[i]} needs ${what}`);
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--') {
      a.paths = argv.slice(i + 1);
      break;
    }
    if (x === '--fix') a.fix = true;
    else if (x === '--repo') a.repo = path.resolve(value(i++, 'a directory'));
    else if (x === '--ruff-config') a.ruffConfig = path.resolve(value(i++, 'a file'));
    else if (x === '--biome-config') a.biomeConfig = path.resolve(value(i++, 'a file'));
    else if (x === '--ruff-sub') {
      const [dir, file] = value(i++, '<dir>=<file>').split('=');
      if (!dir || !file) throw new Refused('--ruff-sub needs <dir>=<file>');
      a.subs.push([dir.replace(/\/+$/, ''), path.resolve(file)]);
    } else throw new Refused(`unknown argument: ${x} (paths go after --)`);
  }
  return a;
}

// the repository root, by marker: the nearest directory above that holds .git
function repoRoot(start) {
  for (let d = path.resolve(start); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, '.git'))) return d;
    if (path.dirname(d) === d) throw new Refused(`${start} is not inside a git repository`);
  }
}

// every config byte-equal to core's, or refuse
// JSONC to JSON: comments dropped outside strings; a string's own `//` is kept
export function stripJsonc(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') j += s[j] === '\\' ? 2 : 1;
      out += s.slice(i, j + 1);
      i = j;
    } else if (c === '/' && s[i + 1] === '/') {
      while (i < s.length && s[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && s[i + 1] === '*') {
      i = s.indexOf('*/', i + 2) + 1;
      if (i === 0) throw new Refused('an unterminated /* comment in a Biome config');
    } else out += c;
  }
  return out;
}

// a value with its object keys sorted, so two configs holding the same settings in another order compare equal
const canon = (v) =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canon(v[k])]),
        )
      : v;

function biomeSettings(file) {
  try {
    return canon(JSON.parse(stripJsonc(fs.readFileSync(file, 'utf8'))));
  } catch (e) {
    if (e instanceof Refused) throw e;
    throw new Refused(`${file} is not readable as JSON(C): ${e.message}`);
  }
}

// The repository's configs against the masters, or refuse. Returns how the tools find their config: 'own' (the
// repository holds the masters), 'copies' (its root copies, each the master's), 'named' (none: the masters are named to
// the tools). ruff.toml is byte-equal (TOML carries its comments). Biome's is the same SETTINGS: core's biome.jsonc holds
// the reasons as comments, and a repository may keep a comment-free biome.json (renaming a committed file is a delete,
// and deletes are the gardener's), compared by value.
function checkConfigs(repo, m) {
  for (const f of [m.ruff, m.biome]) if (!fs.existsSync(f)) throw new Refused(`the master ${f} is not there`);
  const ruffCopy = path.join(repo, CONFIGS[0]);
  const copies = ['biome.jsonc', 'biome.json'].map((n) => path.join(repo, n)).filter((p) => fs.existsSync(p));
  // its own masters only when it holds BOTH (`&&`, never `||`): holding one and named another, its copy of the other is
  // compared below like any copy (test-lint.mjs, the mixed-master cases; Fuji-shin's phase-1 check, finding 5)
  if (same(ruffCopy, m.ruff) && copies.some((c) => same(c, m.biome))) return 'own';
  const hasRuff = fs.existsSync(ruffCopy);
  if (!hasRuff && copies.length === 0) return 'named';
  if (!hasRuff || copies.length === 0) {
    throw new Refused(
      `${repo} keeps ${hasRuff ? 'ruff.toml and no Biome config' : 'a Biome config and no ruff.toml'}: copies of both, or of neither (the masters are then named to the tools)`,
    );
  }
  if (!fs.readFileSync(ruffCopy).equals(fs.readFileSync(m.ruff))) {
    throw new Refused(`${ruffCopy} differs from the master (${m.ruff}): copy it, or change the master`);
  }
  if (copies.length > 1) throw new Refused(`${repo} has both biome.jsonc and biome.json: one config, not two`);
  if (JSON.stringify(biomeSettings(copies[0])) !== JSON.stringify(biomeSettings(m.biome))) {
    throw new Refused(
      `${copies[0]} holds other settings than the master (${m.biome}): copy its settings, or change the master`,
    );
  }
  return 'copies';
}

// a subtree's own ruff config: every tracked ruff.toml below the root (read by ruff itself unless the root's config is
// named, which makes ruff read no other), and each --ruff-sub; a --ruff-sub wins over a tracked one at the same place.
// The master named for the root is not a subtree's own, though tracked below it: core keeps its masters in tools/lint/.
function ruffSubs(root, mode, named, master) {
  const subs = new Map();
  if (mode === 'named') {
    const r = spawnSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' });
    for (const f of (r.stdout || '').split('\0'))
      if (path.posix.basename(f) === 'ruff.toml' && f.includes('/') && !same(path.join(root, f), master))
        subs.set(path.posix.dirname(f), path.join(root, f));
  }
  for (const [d, f] of named) {
    if (!fs.existsSync(f)) throw new Refused(`--ruff-sub ${d}: ${f} is not there`);
    subs.set(d, f);
  }
  return [...subs.entries()];
}

// the paths a run takes: under the subtree `d` (or `d` itself, when a path named holds it), or everything else
const under = (p, d) => p === d || p.startsWith(`${d}/`);
const holds = (p, d) => p === '.' || d.startsWith(`${p.replace(/\/+$/, '')}/`);

function run(cmd, args, repo) {
  const r = spawnSync(cmd, args, { cwd: repo, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  if (r.error)
    throw new Refused(
      `${cmd} did not start (${r.error.code || r.error.message}): ${cmd === 'uvx' ? 'install uv' : 'install node'}`,
    );
  return { code: r.status, out: `${r.stdout}${r.stderr}`.trim() };
}

// a tool's own exit codes: 0 clean, 1 findings; anything else is the tool failing, which is not a finding and not a pass
function step(label, cmd, args, repo) {
  const r = run(cmd, args, repo);
  if (r.code !== 0 && r.code !== 1) throw new Refused(`${label} failed to run (exit ${r.code}):\n${r.out}`);
  return { label, ok: r.code === 0, out: r.out };
}

const PY = /\.pyi?$/;
const JS = /\.[cm]?js$/;

// named paths go to the tool that reads them (ruff parses any file it is handed, whatever its extension); a
// directory goes to both, and each tool keeps to its own files inside it
function route(root, paths) {
  if (!paths.length) return { py: ['.'], js: ['.'] };
  const py = [];
  const js = [];
  for (const p of paths) {
    const abs = path.resolve(root, p);
    if (!fs.existsSync(abs)) throw new Refused(`${p}: no such path in ${root}`);
    if (fs.statSync(abs).isDirectory()) {
      py.push(p);
      js.push(p);
    } else if (PY.test(p)) py.push(p);
    else if (JS.test(p)) js.push(p);
    else throw new Refused(`${p} is neither Python nor JavaScript`);
  }
  return { py, js };
}

export function lint({ fix = false, repo = CORE, paths = [], ruffConfig = null, biomeConfig = null, subs = [] } = {}) {
  const root = repoRoot(repo);
  const m = {
    ruff: ruffConfig || MASTER_FILES[CONFIGS[0]],
    biome: biomeConfig || MASTER_FILES[CONFIGS[1]],
  };
  const mode = checkConfigs(root, m);
  const { py, js } = route(root, paths);
  const ruff = (...a) => ['--quiet', RUFF, ...a];
  const biome = (...a) => ['--yes', BIOME, ...a, ...(mode === 'named' ? ['--config-path', m.biome] : [])];
  // the root's ruff run and one per subtree with a config of its own, each with its paths and its config flags
  const sub = ruffSubs(root, mode, subs, m.ruff);
  const runs = [];
  const rootPy = py.filter((p) => !sub.some(([d]) => under(p, d)));
  if (rootPy.length)
    runs.push({
      label: '',
      paths: rootPy,
      flags: [...(mode === 'named' ? ['--config', m.ruff] : []), ...sub.flatMap(([d]) => ['--extend-exclude', d])],
    });
  for (const [d, f] of sub) {
    const ps = [...py.filter((p) => under(p, d)), ...(py.some((p) => holds(p, d)) ? [d] : [])];
    if (ps.length)
      runs.push({ label: ` (${d}: ${path.basename(f)})`, paths: [...new Set(ps)], flags: ['--config', f] });
  }
  if (fix) {
    for (const r of runs) step(`ruff format --write${r.label}`, 'uvx', ruff('format', ...r.flags, ...r.paths), root);
    for (const r of runs)
      step(`ruff safe fixes${r.label}`, 'uvx', ruff('check', '--fix', ...r.flags, ...r.paths), root);
    if (js.length) step('biome safe fixes', 'npx', biome('check', '--write', '--no-errors-on-unmatched', ...js), root);
  }
  const steps = [];
  for (const r of runs)
    steps.push(step(`ruff format${r.label}`, 'uvx', ruff('format', '--check', ...r.flags, ...r.paths), root));
  for (const r of runs) steps.push(step(`ruff lint${r.label}`, 'uvx', ruff('check', ...r.flags, ...r.paths), root));
  if (js.length) {
    const b = step('biome', 'npx', biome('check', '--error-on-warnings', '--no-errors-on-unmatched', ...js), root);
    // perfectly linted is no diagnostic at all: Biome exits 0 over infos, so an info is read from its own count
    if (b.ok && /^Found \d+ infos?\./m.test(b.out)) b.ok = false;
    steps.push(b);
  }
  return steps;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const a = parseArgs(process.argv.slice(2));
    const steps = lint({ ...a, repo: a.repo || CORE });
    for (const s of steps) {
      console.log(`${s.ok ? 'clean' : 'FINDINGS'}  ${s.label}`);
      if (!s.ok) console.log(s.out.replace(/^/gm, '    '));
    }
    process.exit(steps.every((s) => s.ok) ? 0 : 1);
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    console.error(`refused: ${e.message}`);
    process.exit(2);
  }
}
