#!/usr/bin/env node
// ---
// id: 01M5N39PH70J5F7KRDBHZTT8RG
// title: keys-command — a short `keys` command for the installed plugin, written once, checked at every call
// type: script
// tended-by: baisai
// created: 2026-10-23
// updated: 2026-10-24
// ---
//
// keys-command.mjs — from a planting on a household Mac, 2026-10-23: every step of a planting pasted the whole path to keys.mjs inside
// the plugin folder, about 200 characters with spaces, into a shell that mangles long pastes. This writes, once, a
// command named `keys` that finds the plugin where it is installed today, checks it, and runs its keys.mjs.
//
//   node "<the plugin>/skills/bonsai-garden-keys/bin/keys-command.mjs" install [--bin <dir>] [--no-profile]
//        the one long line, once. Then, in a new Terminal tab: keys <verb> …, the same verbs, flags and exit codes
//        as keys.mjs, in the folder you are in.
//   node keys-command.mjs run <keys.mjs arguments>
//        what the `keys` command calls: the integrity lines, then keys.mjs. Not typed by hand.
//   node "<the plugin>/skills/bonsai-garden-keys/bin/keys-command.mjs" uninstall [--bin <dir>]
//        takes back exactly what install wrote, and says what it removed (below).
//
// WHERE IT LIVES. ~/.bonsai-garden/bin/keys (the host's own garden folder, beside custody/ and rt-env/), or --bin.
//   On Windows also keys.cmd beside it, for cmd and PowerShell. The command is a small Node script (CommonJS, no
//   extension), not a shell script: Node is the one thing a planting already needs.
// HOW IT IS FOUND. When that folder is not on PATH, one marked line is added to the shell's own start file (zsh:
//   ~/.zshrc; bash: ~/.bash_profile on a Mac and in Git Bash, else ~/.bashrc), once, and named; any other shell gets
//   the line printed. --no-profile writes nothing there and prints the line. A new Terminal tab then knows `keys`.
//   Another `keys` already on PATH, or a file at the target this script did not write, is refused, never replaced.
// HOW IT FINDS THE PLUGIN AFTER AN UPDATE. It never stores a path. It stores which installed plugin it belongs to
//   (`<name>@<marketplace>`, read once at install from Claude Code's own record of installed plugins,
//   <claude config>/plugins/installed_plugins.json, the entry whose folder holds this script) and reads that entry's
//   folder again at every call, so an update that moves the folder moves the command with it. An entry that is gone,
//   or two folders for it, is refused with what to do; nothing is guessed. The command file holds only that lookup;
//   everything else is this file's, inside the sealed plugin, so it is updated with the plugin.
// HOW IT REFUSES A KEYS.MJS WHOSE SEAL FAILS. `run` first runs the integrity line of each skill keys.mjs reads from
//   (keys, and the mark and sign skills it imports): scripts/integrity/verify-manifest.mjs, the line each SKILL.md
//   puts first, which checks every file against the sealed MANIFEST.json and the seal against the published keys at
//   bon-sai.garden. Anything but `ok` refuses (exit 2) with exactly what the check said, and keys.mjs never runs.
//   Silent when every check passes. The trust is the integrity line's own: the check is run from the package it
//   checks, as every SKILL.md runs it. The command file is outside the plugin and its manifest, and small enough to
//   read whole.
//
// HOW IT IS TAKEN BACK. `uninstall` removes the two things install wrote and nothing else: the command file (and on
//   Windows keys.cmd beside it), each only when it is byte for byte the text install writes, and in each start file
//   install knows (~/.zshrc, ~/.bash_profile, ~/.bashrc, whatever $SHELL says today) its own marked line, the mark and
//   the PATH line under it for this folder, with the blank line install put before them. Everything is read first:
//   a file there that install did not write, a command edited since, or a marked line that is not the one install
//   writes is refused (2), and nothing is removed. It leaves the folder, which may hold other things, and says what
//   it removed. Nothing there: it says so (0).
//
// Exit: keys.mjs's own code when it ran; 2 refused (one line, and what to do); 3 halt (the state cannot be
// determined); 64 usage. Install writes nothing when it refuses before the command is written.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fs.realpathSync(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(path.dirname(SELF), '..', '..', '..'); // <plugin>/skills/bonsai-garden-keys/bin/
export const MARK = 'bonsai-garden-keys: the keys command'; // the line that says a command file is ours
export const PROFILE_MARK = '# bonsai-garden-keys: the keys command (keys-command.mjs install)';
export const SKILLS = ['bonsai-garden-keys', 'bonsai-garden-mark', 'bonsai-garden-sign']; // what keys.mjs reads from
const SELF_REL = ['skills', 'bonsai-garden-keys', 'bin', 'keys-command.mjs'];
export const CMD_TEXT = '@node "%~dp0keys" %*\r\n'; // keys.cmd beside the command, on Windows, for cmd and PowerShell
const PROFILES = ['.zshrc', '.bash_profile', '.bashrc']; // every start file install may have written its line into
/** The PATH line install writes for `bin` (the home folder spelled $HOME when it is the default). */
export const pathLine = (bin, ours) => `export PATH="${bin === ours ? '$HOME/.bonsai-garden/bin' : bin}:$PATH"`;
export const CHECK_ENV = 'BONSAI_KEYS_COMMAND_CHECK'; // install's proof: run the written command up to the checks

class Exit extends Error {
  constructor(code, msg) {
    super(msg);
    this.code = code;
  }
}

const real = (p) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
};
const inside = (child, dir) => child === dir || child.startsWith(dir + path.sep);
export const registryFile = (env) =>
  path.join(env.CLAUDE_CONFIG_DIR || path.join(env.HOME || os.homedir(), '.claude'), 'plugins', 'installed_plugins.json');

/** The installed plugin whose folder holds this file, by its key (`<name>@<marketplace>`); refused unless one. */
export function ownEntry(env, file = SELF) {
  const f = registryFile(env);
  let plugins;
  try {
    plugins = JSON.parse(fs.readFileSync(f, 'utf8')).plugins;
  } catch (e) {
    throw new Exit(3, `cannot read Claude Code's list of installed plugins (${f}): ${e.code || e.message}`);
  }
  if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins))
    throw new Exit(3, `${f} is not the shape this command reads (no "plugins" map); nothing was written`);
  const keys = new Set();
  for (const [key, list] of Object.entries(plugins))
    for (const e of Array.isArray(list) ? list : []) {
      const dir = e && typeof e.installPath === 'string' ? real(e.installPath) : null;
      if (dir && inside(file, dir)) keys.add(key);
    }
  if (keys.size === 1) return [...keys][0];
  if (!keys.size)
    throw new Exit(2, `${file} is in no plugin Claude Code lists as installed (${f}); run this line from the installed plugin`);
  throw new Exit(2, `${file} is inside more than one installed plugin (${[...keys].join(', ')}); nothing was written`);
}

/** The command file: the plugin key written in, the folder looked up at every call, then this file's `run`. */
export function commandText(key) {
  return `#!/usr/bin/env node
// ${MARK}: written by keys-command.mjs install (skills/bonsai-garden-keys/bin/ in the plugin). It looks up where
// Claude Code has the plugin ${JSON.stringify(key)} installed today and hands your arguments to that plugin's
// keys-command.mjs run, which checks the plugin and only then runs keys.mjs, here, in the folder you are in.
'use strict';
const KEY = ${JSON.stringify(key)};
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const file = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'plugins', 'installed_plugins.json');
let list;
try {
  list = (JSON.parse(fs.readFileSync(file, 'utf8')).plugins || {})[KEY];
} catch (e) {
  console.error('halt: cannot read ' + file + ' (' + (e.code || e.message) + '); the long form still works');
  process.exit(3);
}
const real = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
const at = (d) => path.join(d, ${SELF_REL.map((s) => JSON.stringify(s)).join(', ')});
const dirs = [...new Set((Array.isArray(list) ? list : []).map((e) => e && typeof e.installPath === 'string' && real(e.installPath)))]
  .filter((d) => d && fs.existsSync(at(d)));
if (dirs.length !== 1) {
  console.error('refused: ' + KEY + (dirs.length ? ' is installed in ' + dirs.length + ' folders (' + dirs.join(', ') +
    '), which one is meant cannot be told' : ' is not installed (' + file + '); install the plugin, then run its' +
    ' keys-command.mjs install once') + '; nothing was run');
  process.exit(2);
}
const r = spawnSync(process.execPath, [at(dirs[0]), 'run', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status === null ? 3 : r.status);
`;
}

/** Each skill keys.mjs reads from runs its own integrity line. [] when every one says ok, else what each said. */
export function integrity(root, env = process.env) {
  const said = [];
  for (const s of SKILLS) {
    const skill = path.join(root, 'skills', s);
    const line = path.join(skill, 'scripts', 'integrity', 'verify-manifest.mjs');
    if (!fs.existsSync(line)) {
      said.push(`${s}: no integrity line (${line} is not there)`);
      continue;
    }
    const r = spawnSync(process.execPath, [line], { cwd: skill, env, encoding: 'utf8' });
    const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
    if (r.status !== 0 || !/^ok\b/.test(out)) said.push(`${s}: ${out || `exit ${r.status}`}`);
  }
  return said;
}

function run(args, env = process.env) {
  const said = integrity(PLUGIN, env);
  if (said.length)
    throw new Exit(2, `the plugin's integrity check did not say ok, so keys.mjs was not run. It said:\n${said.join('\n')}`);
  if (env[CHECK_ENV] === '1') {
    console.log(`ok  keys finds ${PLUGIN}, and its integrity lines say ok`);
    return 0;
  }
  const r = spawnSync(process.execPath, [path.join(PLUGIN, 'skills', 'bonsai-garden-keys', 'bin', 'keys.mjs'), ...args], {
    stdio: 'inherit',
    env,
  });
  return r.status === null ? 3 : r.status;
}

/** The first `keys` on PATH outside `bin`, or null. */
export function otherOnPath(env, bin, platform = process.platform) {
  const names = platform === 'win32' ? ['keys.cmd', 'keys.exe', 'keys.bat', 'keys'] : ['keys'];
  for (const d of (env.PATH || '').split(path.delimiter).filter(Boolean)) {
    if (real(d) && real(d) === real(bin)) continue;
    for (const n of names) {
      try {
        if (fs.statSync(path.join(d, n)).isFile()) return path.join(d, n);
      } catch {}
    }
  }
  return null;
}

/** The shell's own start file, or null when this command does not know the shell ($SHELL). */
export function profileFor(env, platform = process.platform) {
  const sh = path.basename(env.SHELL || '');
  const home = env.HOME || os.homedir();
  if (sh === 'zsh') return path.join(home, '.zshrc');
  if (sh === 'bash') return path.join(home, platform === 'darwin' || platform === 'win32' ? '.bash_profile' : '.bashrc');
  return null;
}

function install(argv, env = process.env, platform = process.platform) {
  const f = { bin: null, profile: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--bin' && argv[i + 1]) f.bin = argv[++i];
    else if (argv[i] === '--no-profile') f.profile = false;
    else throw new Exit(64, `install takes --bin <dir> and --no-profile, not ${JSON.stringify(argv[i])}`);
  }
  const home = env.HOME || os.homedir();
  const ours = path.join(home, '.bonsai-garden', 'bin');
  const bin = path.resolve(f.bin || ours);
  const key = ownEntry(env);
  const target = path.join(bin, 'keys');
  if (fs.existsSync(target) && !fs.readFileSync(target, 'utf8').includes(MARK))
    throw new Exit(2, `${target} is there and was not written by this command; nothing was written`);
  const other = otherOnPath(env, bin, platform);
  if (other)
    throw new Exit(2, `another \`keys\` is on your PATH (${other}); one would hide the other. Nothing was written`);
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(target, commandText(key), { mode: 0o755 });
  fs.chmodSync(target, 0o755);
  if (platform === 'win32') fs.writeFileSync(path.join(bin, 'keys.cmd'), CMD_TEXT);
  console.log(`keys: written at ${target}, for the plugin ${key}`);
  // the proof: the written command, run up to its checks, from where it will be run
  const proof = spawnSync(process.execPath, [target], { env: { ...env, [CHECK_ENV]: '1' }, encoding: 'utf8' });
  const said = `${proof.stdout || ''}${proof.stderr || ''}`.trim();
  if (proof.status !== 0) throw new Exit(2, `the command is written, and its first run refused:\n${said}`);
  console.log(said);
  const line = pathLine(bin, ours);
  const onPath = (env.PATH || '').split(path.delimiter).some((d) => d && real(d) === real(bin));
  const prof = profileFor(env, platform);
  if (onPath) console.log(`${bin} is on your PATH already: type keys <verb> …`);
  else if (f.profile && prof) {
    const had = fs.existsSync(prof) ? fs.readFileSync(prof, 'utf8') : '';
    if (had.includes(PROFILE_MARK)) console.log(`${prof} names it already`);
    else {
      fs.appendFileSync(prof, `${had && !had.endsWith('\n') ? '\n' : ''}\n${PROFILE_MARK}\n${line}\n`);
      console.log(`added to ${prof}:\n  ${line}`);
    }
    console.log('open a new Terminal tab; then type keys <verb> …, the same verbs as keys.mjs');
  } else console.log(`${bin} is not on your PATH. Add this line to your shell's start file, then open a new tab:\n  ${line}`);
  if (platform === 'win32') console.log(`for cmd and PowerShell: ${path.join(bin, 'keys.cmd')}, once ${bin} is on their PATH`);
  return 0;
}

/** Exactly what install wrote, and only that; every file read before anything is removed (HOW IT IS TAKEN BACK). */
export function uninstall(argv, env = process.env, platform = process.platform) {
  let given = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--bin' && argv[i + 1]) given = argv[++i];
    else throw new Exit(64, `uninstall takes --bin <dir>, not ${JSON.stringify(argv[i])}`);
  }
  const home = env.HOME || os.homedir();
  const ours = path.join(home, '.bonsai-garden', 'bin');
  const bin = path.resolve(given || ours);
  const refused = [];
  const files = [];
  const target = path.join(bin, 'keys');
  if (fs.existsSync(target)) {
    const text = fs.readFileSync(target, 'utf8');
    let k = null;
    try {
      k = JSON.parse((text.match(/^const KEY = ("(?:[^"\\]|\\.)*");$/m) || [])[1]);
    } catch {}
    if (typeof k === 'string' && text === commandText(k)) files.push(target);
    else
      refused.push(
        `${target} is not the command install writes (${text.includes(MARK) ? 'it carries the mark and was changed since' : 'install did not write it'})`,
      );
  }
  const cmd = path.join(bin, 'keys.cmd');
  if (platform === 'win32' && fs.existsSync(cmd)) {
    if (fs.readFileSync(cmd, 'utf8') === CMD_TEXT) files.push(cmd);
    else refused.push(`${cmd} is not the keys.cmd install writes`);
  }
  const line = pathLine(bin, ours);
  const edits = [];
  for (const name of PROFILES) {
    const prof = path.join(home, name);
    const had = fs.existsSync(prof) ? fs.readFileSync(prof, 'utf8') : '';
    if (!had.includes(PROFILE_MARK)) continue;
    const lines = had.split('\n');
    const keep = [];
    let blocks = 0;
    let bad = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] !== PROFILE_MARK) {
        keep.push(lines[i]);
        continue;
      }
      if (lines[i + 1] !== line) {
        bad = `${prof}: the line under its mark is ${JSON.stringify(lines[i + 1] ?? '')}, not the one install writes for ${bin} (${line})`;
        break;
      }
      if (keep.length && keep[keep.length - 1] === '') keep.pop(); // the blank line install put before its mark
      i++; // the PATH line
      blocks++;
    }
    if (!bad && !blocks) bad = `${prof} carries the mark inside a line install did not write`;
    if (bad) refused.push(bad);
    else edits.push([prof, keep.join('\n')]);
  }
  if (refused.length) throw new Exit(2, `${refused.join('; ')}. Nothing was removed`);
  if (!files.length && !edits.length) {
    console.log(`keys: nothing to remove: no command at ${target}, and no start file carries its line`);
    return 0;
  }
  for (const f of files) {
    fs.unlinkSync(f);
    console.log(`removed ${f}`);
  }
  for (const [prof, text] of edits) {
    fs.writeFileSync(prof, text);
    console.log(`removed from ${prof}:\n  ${PROFILE_MARK}\n  ${line}`);
  }
  console.log(
    `${bin} itself is left, with whatever else it holds. In a new Terminal tab \`keys\` is gone; the long form still works`,
  );
  return 0;
}

function main(argv) {
  const [verb, ...rest] = argv;
  if (verb === 'install') return install(rest);
  if (verb === 'run') return run(rest);
  if (verb === 'uninstall') return uninstall(rest);
  throw new Exit(
    64,
    'usage: keys-command.mjs install [--bin <dir>] [--no-profile] | uninstall [--bin <dir>]  (the `keys` command calls run)',
  );
}

if (process.argv[1] && real(process.argv[1]) === SELF) {
  let code;
  try {
    code = main(process.argv.slice(2));
  } catch (e) {
    if (!(e instanceof Exit)) e = new Exit(3, e.message);
    console.error(`${e.code === 2 ? 'refused' : e.code === 3 ? 'halt' : 'usage'}: ${e.message}`);
    code = e.code;
  }
  process.exit(code);
}
