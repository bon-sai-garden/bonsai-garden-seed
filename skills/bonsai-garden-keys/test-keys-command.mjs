// ---
// id: 01M5N39PKHQBYF0WV9A27R3K8Y
// title: The short keys command, tested as properties on planted plugins, and the real verifier refusing
// type: script
// tended-by: baisai
// created: 2026-10-23
// updated: 2026-10-24
// ---
//
// test-keys-command.mjs — bin/keys-command.mjs (2026-10-23).
//
//   node skills/bonsai-garden-keys/test-keys-command.mjs                      every case on planted plugins (install,
//        the command, and uninstall: exactly what install wrote, never a file it did not write)
//   node skills/bonsai-garden-keys/test-keys-command.mjs --plugin <file.plugin> [--expect ok|refused]
//        also the real thing: that archive unpacked, the command written for it, and its own integrity lines run
//        against the published keys (the network). A sealed build carrying keys-command.mjs says ok and runs keys.mjs;
//        any other build is refused with the verifier's own words, and keys.mjs never runs. --expect says which.
//   node skills/bonsai-garden-keys/test-keys-command.mjs --mutants            each guard broken in a scratch copy,
//        beside an unbroken control: every case it names must go red
//   node skills/bonsai-garden-keys/test-keys-command.mjs --only a,b           the named cases
//   KEYS_COMMAND_SRC=<a keys-command.mjs> node ... test-keys-command.mjs      the cases against another copy
//
// A planted plugin is a folder laid out as the plugin is (skills/<skill>/scripts/integrity/verify-manifest.mjs for
// keys, mark and sign; skills/bonsai-garden-keys/bin/keys.mjs), with this checkout's keys-command.mjs copied in, a
// verifier that says what the case plants, and a keys.mjs that writes down how it was called. Claude Code's record
// of installed plugins is planted under a scratch CLAUDE_CONFIG_DIR, the home is a scratch HOME: nothing of the
// gardener's machine is read or written. Every case reads a property (what ran, what was written, the exit code),
// never a line of the code.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(process.env.KEYS_COMMAND_SRC || path.join(HERE, 'bin', 'keys-command.mjs'));
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'keys-command-test-')));
const argv = process.argv.slice(2);
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const SKILLS = ['bonsai-garden-keys', 'bonsai-garden-mark', 'bonsai-garden-sign'];
const KEY = 'planted-plugin@planted-marketplace';
let n = 0;

/** A planted plugin at `dir`: verifiers saying `say[skill]` ('ok' unless named), a keys.mjs that records its call. */
function plant(dir, { say = {}, version = 'v1', noLine = [], exitZero = false } = {}) {
  for (const s of SKILLS) {
    const d = path.join(dir, 'skills', s, 'scripts', 'integrity');
    fs.mkdirSync(d, { recursive: true });
    if (noLine.includes(s)) continue;
    const words = say[s] || `ok       integrity: ${s} planted · 3 files match`;
    fs.writeFileSync(
      path.join(d, 'verify-manifest.mjs'),
      `const ok = ${exitZero} || ${JSON.stringify(words)}.startsWith('ok');\n` +
        `if (process.cwd() !== ${JSON.stringify(path.join(dir, 'skills', s))}) { console.log('FAIL run from ' + process.cwd()); process.exit(1); }\n` +
        `console.log(${JSON.stringify(words)}); process.exit(ok ? 0 : 1);\n`,
    );
  }
  const bin = path.join(dir, 'skills', 'bonsai-garden-keys', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.copyFileSync(SRC, path.join(bin, 'keys-command.mjs'));
  fs.writeFileSync(
    path.join(bin, 'keys.mjs'),
    `import fs from 'node:fs';\nfs.writeFileSync(process.env.KEYS_RAN, JSON.stringify({ version: ${JSON.stringify(
      version,
    )}, args: process.argv.slice(2), cwd: process.cwd() }));\nprocess.exit(Number(process.env.KEYS_EXIT || 0));\n`,
  );
  return dir;
}

/** A scratch world: HOME, Claude's config with the record of installed plugins, a PATH holding node only. */
function world(entries = {}) {
  const w = path.join(TMP, `w${++n}`);
  const home = path.join(w, 'home');
  const claude = path.join(w, 'claude');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(path.join(claude, 'plugins'), { recursive: true });
  const nodeDir = path.join(w, 'node-bin');
  fs.mkdirSync(nodeDir);
  fs.symlinkSync(process.execPath, path.join(nodeDir, 'node'));
  const env = {
    HOME: home,
    CLAUDE_CONFIG_DIR: claude,
    PATH: [nodeDir, '/usr/bin', '/bin'].join(path.delimiter),
    SHELL: '/bin/zsh',
    KEYS_RAN: path.join(w, 'ran.json'),
  };
  const reg = (e) =>
    fs.writeFileSync(path.join(claude, 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: e }, null, 2));
  reg(entries);
  return { w, home, env, reg, cmd: path.join(home, '.bonsai-garden', 'bin', 'keys') };
}
const entry = (dir) => [{ scope: 'user', installPath: dir, version: '0.9.3' }];
const node = (args, env, cwd) => spawnSync(process.execPath, args, { env, cwd, encoding: 'utf8' });
const out = (r) => `${r.stdout || ''}${r.stderr || ''}`;
const ran = (W) => (fs.existsSync(W.env.KEYS_RAN) ? JSON.parse(fs.readFileSync(W.env.KEYS_RAN, 'utf8')) : null);
const install = (W, dir, ...extra) =>
  node([path.join(dir, 'skills', 'bonsai-garden-keys', 'bin', 'keys-command.mjs'), 'install', ...extra], W.env, W.home);
const uninstall = (W, dir, ...extra) =>
  node([path.join(dir, 'skills', 'bonsai-garden-keys', 'bin', 'keys-command.mjs'), 'uninstall', ...extra], W.env, W.home);
const keys = (W, args, cwd, extraEnv = {}) =>
  spawnSync(W.cmd, args, { env: { ...W.env, ...extraEnv }, cwd: cwd || W.home, encoding: 'utf8' });

const CASES = {
  'install-writes-the-command-and-one-profile-line-and-proves-it'() {
    const W = world();
    const p = plant(path.join(W.w, 'plugin-v1'));
    W.reg({ [KEY]: entry(p) });
    const r1 = install(W, p);
    const r2 = install(W, p);
    const prof = fs.readFileSync(path.join(W.home, '.zshrc'), 'utf8');
    const mode = fs.statSync(W.cmd).mode & 0o777;
    return [
      r1.status === 0 &&
        r2.status === 0 &&
        mode === 0o755 &&
        fs.readFileSync(W.cmd, 'utf8').includes(KEY) &&
        prof.split('.bonsai-garden/bin').length === 2 &&
        /integrity lines say ok/.test(out(r1)) &&
        ran(W) === null,
      `exit ${r1.status}/${r2.status}, mode ${mode.toString(8)}, profile lines ${prof.split('.bonsai-garden/bin').length - 1}, keys.mjs ran at install: ${ran(W) !== null}\n${out(r1)}`,
    ];
  },
  'the-command-runs-keys-mjs-here-with-every-argument-and-its-exit-code'() {
    const W = world();
    const p = plant(path.join(W.w, 'plugin-v1'));
    W.reg({ [KEY]: entry(p) });
    install(W, p);
    const here = path.join(W.w, 'the pot folder');
    fs.mkdirSync(here);
    const r = keys(W, ['identity', 'ana', '--pot', '.', '--pair-index', '319,79', 'two words'], here, { KEYS_EXIT: '7' });
    const got = ran(W);
    return [
      r.status === 7 &&
        got?.version === 'v1' &&
        JSON.stringify(got.args) === JSON.stringify(['identity', 'ana', '--pot', '.', '--pair-index', '319,79', 'two words']) &&
        got.cwd === here &&
        out(r).trim() === '',
      `exit ${r.status}, ran ${JSON.stringify(got)}, said ${JSON.stringify(out(r))}`,
    ];
  },
  'an-update-that-moves-the-plugin-moves-the-command-with-no-reinstall'() {
    const W = world();
    const p1 = plant(path.join(W.w, 'plugin-v1'));
    W.reg({ [KEY]: entry(p1) });
    install(W, p1);
    const p2 = plant(path.join(W.w, 'cache', '0.9.4'), { version: 'v2' });
    W.reg({ [KEY]: entry(p2) });
    fs.rmSync(p1, { recursive: true });
    const r = keys(W, ['status']);
    return [r.status === 0 && ran(W)?.version === 'v2', `exit ${r.status}, ran ${JSON.stringify(ran(W))}\n${out(r)}`];
  },
  'a-skill-whose-integrity-line-does-not-say-ok-refuses-and-keys-mjs-never-runs'() {
    const results = [];
    for (const s of SKILLS) {
      const W = world();
      const p = plant(path.join(W.w, 'plugin'), {});
      W.reg({ [KEY]: entry(p) });
      install(W, p);
      plant(p, { say: { [s]: `FAIL     integrity: ${s} · 1 mismatch: bin/keys.mjs` } });
      const r = keys(W, ['status']);
      results.push([s, r.status === 2 && ran(W) === null && out(r).includes(`${s}: FAIL     integrity: ${s} · 1 mismatch`), r.status, out(r)]);
    }
    return [results.every((x) => x[1]), results.map((x) => `${x[0]}: exit ${x[2]} ${x[1] ? 'refused, nothing ran' : x[3]}`).join('\n')];
  },
  'a-check-that-exits-0-without-saying-ok-refuses-too'() {
    const W = world();
    const p = plant(path.join(W.w, 'plugin'));
    W.reg({ [KEY]: entry(p) });
    install(W, p);
    plant(p, { say: { 'bonsai-garden-sign': 'pot-ok   integrity: bonsai-garden-sign · keys: pot' }, exitZero: true });
    const r = keys(W, ['status']);
    return [r.status === 2 && ran(W) === null && /bonsai-garden-sign: pot-ok/.test(out(r)), `exit ${r.status}\n${out(r)}`];
  },
  'install-says-so-when-the-written-command-refuses-its-first-run'() {
    const W = world();
    const p = plant(path.join(W.w, 'plugin'), { say: { 'bonsai-garden-keys': 'UNSEALED integrity: bonsai-garden-keys · 3 files match' } });
    W.reg({ [KEY]: entry(p) });
    const r = install(W, p);
    return [
      r.status === 2 && /its first run refused/.test(out(r)) && /UNSEALED integrity: bonsai-garden-keys/.test(out(r)) && ran(W) === null,
      `exit ${r.status}\n${out(r)}`,
    ];
  },
  'a-missing-integrity-line-refuses'() {
    const W = world();
    const p = plant(path.join(W.w, 'plugin'));
    W.reg({ [KEY]: entry(p) });
    install(W, p);
    fs.rmSync(path.join(p, 'skills', 'bonsai-garden-mark', 'scripts', 'integrity', 'verify-manifest.mjs'));
    const r = keys(W, ['status']);
    return [r.status === 2 && ran(W) === null && /bonsai-garden-mark: no integrity line/.test(out(r)), `exit ${r.status}\n${out(r)}`];
  },
  'a-plugin-no-longer-installed-or-in-two-folders-refuses'() {
    const W = world();
    const p = plant(path.join(W.w, 'plugin'));
    W.reg({ [KEY]: entry(p) });
    install(W, p);
    W.reg({});
    const gone = keys(W, ['status']);
    const q = plant(path.join(W.w, 'plugin-project'));
    W.reg({ [KEY]: [...entry(p), { scope: 'project', installPath: q, version: '0.9.3' }] });
    const two = keys(W, ['status']);
    return [
      gone.status === 2 && /is not installed/.test(out(gone)) && two.status === 2 && /2 folders/.test(out(two)) && ran(W) === null,
      `gone: exit ${gone.status} ${out(gone)}two: exit ${two.status} ${out(two)}`,
    ];
  },
  'install-from-outside-an-installed-plugin-writes-nothing'() {
    const W = world();
    const p = plant(path.join(W.w, 'not-installed'));
    W.reg({ [KEY]: entry(path.join(W.w, 'elsewhere')) });
    const r = install(W, p);
    return [
      r.status === 2 && /no plugin Claude Code lists as installed/.test(out(r)) && !fs.existsSync(path.join(W.home, '.bonsai-garden')),
      `exit ${r.status}\n${out(r)}`,
    ];
  },
  'another-keys-on-path-or-a-file-not-ours-at-the-target-is-refused-never-replaced'() {
    const W = world();
    const p = plant(path.join(W.w, 'plugin'));
    W.reg({ [KEY]: entry(p) });
    const theirs = path.join(W.w, 'their-bin');
    fs.mkdirSync(theirs);
    fs.writeFileSync(path.join(theirs, 'keys'), '#!/bin/sh\necho theirs\n', { mode: 0o755 });
    const r1 = install(W, p);
    const wrote1 = fs.existsSync(W.cmd) || fs.existsSync(path.join(W.home, '.zshrc'));
    const r0 = node([path.join(p, 'skills/bonsai-garden-keys/bin/keys-command.mjs'), 'install'], { ...W.env, PATH: `${theirs}${path.delimiter}${W.env.PATH}` }, W.home);
    fs.mkdirSync(path.dirname(W.cmd), { recursive: true });
    fs.writeFileSync(W.cmd, '#!/bin/sh\necho mine\n');
    const r2 = install(W, p);
    return [
      r1.status === 0 &&
        r0.status === 2 &&
        /another `keys` is on your PATH/.test(out(r0)) &&
        r2.status === 2 &&
        /was not written by this command/.test(out(r2)) &&
        fs.readFileSync(W.cmd, 'utf8') === '#!/bin/sh\necho mine\n',
      `control ${r1.status} (wrote ${wrote1}), on PATH ${r0.status}: ${out(r0)}not ours ${r2.status}: ${out(r2)}`,
    ];
  },
  'no-profile-and-unknown-shells-print-the-line-bash-on-a-mac-takes-bash-profile'() {
    const W = world();
    const p = plant(path.join(W.w, 'plugin'));
    W.reg({ [KEY]: entry(p) });
    const a = install(W, p, '--no-profile');
    const none = !fs.existsSync(path.join(W.home, '.zshrc'));
    const fish = node([path.join(p, 'skills/bonsai-garden-keys/bin/keys-command.mjs'), 'install'], { ...W.env, SHELL: '/usr/bin/fish' }, W.home);
    const bash = node([path.join(p, 'skills/bonsai-garden-keys/bin/keys-command.mjs'), 'install'], { ...W.env, SHELL: '/bin/bash' }, W.home);
    const bp = path.join(W.home, process.platform === 'darwin' ? '.bash_profile' : '.bashrc');
    return [
      a.status === 0 &&
        none &&
        /Add this line/.test(out(a)) &&
        fish.status === 0 &&
        /Add this line/.test(out(fish)) &&
        bash.status === 0 &&
        fs.existsSync(bp) &&
        fs.readFileSync(bp, 'utf8').includes('$HOME/.bonsai-garden/bin'),
      `no-profile ${a.status} ${none}, fish ${fish.status}, bash ${bash.status} ${fs.existsSync(bp)}`,
    ];
  },
  'uninstall-removes-exactly-what-install-wrote-and-says-what'() {
    const W = world();
    const p = plant(path.join(W.w, 'plugin'));
    W.reg({ [KEY]: entry(p) });
    const zshrc = path.join(W.home, '.zshrc');
    const before = 'export EDITOR=vi\n# my own line about keys\n';
    fs.writeFileSync(zshrc, before);
    const beside = path.join(path.dirname(W.cmd), 'my-tool');
    fs.mkdirSync(path.dirname(W.cmd), { recursive: true });
    fs.writeFileSync(beside, 'mine\n');
    const i = install(W, p);
    fs.appendFileSync(zshrc, 'alias ll="ls -l"\n'); // the gardener's own line, written after the install
    const u = uninstall(W, p);
    const after = fs.readFileSync(zshrc, 'utf8');
    return [
      i.status === 0 &&
        u.status === 0 &&
        !fs.existsSync(W.cmd) &&
        after === before + 'alias ll="ls -l"\n' &&
        fs.readFileSync(beside, 'utf8') === 'mine\n' &&
        out(u).includes(`removed ${W.cmd}`) &&
        out(u).includes(`removed from ${zshrc}`),
      `install ${i.status}, uninstall ${u.status}, command left ${fs.existsSync(W.cmd)}, profile now ${JSON.stringify(after)}\n${out(u)}`,
    ];
  },
  'uninstall-refuses-a-command-file-it-did-not-write-and-removes-nothing'() {
    const results = [];
    for (const [what, plantIt] of [
      ['not ours', (W) => fs.writeFileSync(W.cmd, '#!/bin/sh\necho mine\n')],
      ['ours, edited since', (W) => fs.appendFileSync(W.cmd, '// and one line of mine\n')],
    ]) {
      const W = world();
      const p = plant(path.join(W.w, 'plugin'));
      W.reg({ [KEY]: entry(p) });
      install(W, p);
      plantIt(W);
      const cmd = fs.readFileSync(W.cmd, 'utf8');
      const prof = fs.readFileSync(path.join(W.home, '.zshrc'), 'utf8');
      const u = uninstall(W, p);
      results.push([
        what,
        u.status === 2 &&
          /Nothing was removed/.test(out(u)) &&
          fs.readFileSync(W.cmd, 'utf8') === cmd &&
          fs.readFileSync(path.join(W.home, '.zshrc'), 'utf8') === prof,
        `${what}: exit ${u.status} ${out(u)}`,
      ]);
    }
    return [results.every((r) => r[1]), results.map((r) => r[2]).join('\n')];
  },
  'uninstall-refuses-a-marked-line-that-is-not-the-one-install-wrote'() {
    const W = world();
    const p = plant(path.join(W.w, 'plugin'));
    W.reg({ [KEY]: entry(p) });
    install(W, p);
    const zshrc = path.join(W.home, '.zshrc');
    fs.writeFileSync(zshrc, fs.readFileSync(zshrc, 'utf8').replace('$HOME/.bonsai-garden/bin', '/opt/elsewhere'));
    const prof = fs.readFileSync(zshrc, 'utf8');
    const u = uninstall(W, p);
    return [
      u.status === 2 && /not the one install writes/.test(out(u)) && fs.existsSync(W.cmd) && fs.readFileSync(zshrc, 'utf8') === prof,
      `exit ${u.status}, command kept ${fs.existsSync(W.cmd)}\n${out(u)}`,
    ];
  },
  'uninstall-with-nothing-installed-removes-nothing-and-says-so'() {
    const W = world();
    const p = plant(path.join(W.w, 'plugin'));
    W.reg({ [KEY]: entry(p) });
    fs.writeFileSync(path.join(W.home, '.zshrc'), 'export EDITOR=vi\n');
    const u = uninstall(W, p);
    return [
      u.status === 0 && /nothing to remove/.test(out(u)) && fs.readFileSync(path.join(W.home, '.zshrc'), 'utf8') === 'export EDITOR=vi\n',
      `exit ${u.status}\n${out(u)}`,
    ];
  },
  'uninstall-with-bin-takes-that-command-and-its-own-line-and-a-shell-changed-since'() {
    const W = world();
    const p = plant(path.join(W.w, 'plugin'));
    W.reg({ [KEY]: entry(p) });
    const bin = path.join(W.w, 'my bin');
    const i = install(W, p, '--bin', bin);
    const bashEnv = { ...W.env, SHELL: '/bin/bash' }; // the shell changed after the install: the zsh line is still found
    const u = node([path.join(p, 'skills/bonsai-garden-keys/bin/keys-command.mjs'), 'uninstall', '--bin', bin], bashEnv, W.home);
    const zshrc = fs.readFileSync(path.join(W.home, '.zshrc'), 'utf8');
    return [
      i.status === 0 && u.status === 0 && !fs.existsSync(path.join(bin, 'keys')) && !zshrc.includes('bonsai-garden-keys') && zshrc === '',
      `install ${i.status}, uninstall ${u.status}, profile ${JSON.stringify(zshrc)}\n${out(u)}`,
    ];
  },
  async 'uninstall-on-windows-takes-keys-cmd-only-as-install-writes-it'() {
    const m = await import(pathToFileURL(SRC).href);
    const results = [];
    for (const [what, text, want] of [
      ['as written', m.CMD_TEXT, 0],
      ['changed', '@echo theirs\r\n', 2],
    ]) {
      const W = world();
      const bin = path.join(W.home, '.bonsai-garden', 'bin');
      fs.mkdirSync(bin, { recursive: true });
      fs.writeFileSync(path.join(bin, 'keys'), m.commandText(KEY));
      fs.writeFileSync(path.join(bin, 'keys.cmd'), text);
      let code;
      const log = console.log;
      console.log = () => {};
      try {
        code = m.uninstall([], W.env, 'win32');
      } catch (e) {
        code = e.code;
      } finally {
        console.log = log;
      }
      const left = ['keys', 'keys.cmd'].filter((f) => fs.existsSync(path.join(bin, f)));
      results.push([what, code === want && (want === 0 ? left.length === 0 : left.length === 2), `${what}: exit ${code}, left ${left}`]);
    }
    return [results.every((r) => r[1]), results.map((r) => r[2]).join('\n')];
  },
};

function real(file, expect) {
  // the real archive, unpacked as the app unpacks it, its own integrity lines asked of the published keys
  const W = world();
  const into = path.join(W.w, 'installed');
  fs.mkdirSync(into);
  const u = spawnSync('unzip', ['-q', file, '-d', into], { encoding: 'utf8' });
  if (u.status !== 0) return [false, `unzip: ${out(u)}`];
  const top = fs.existsSync(path.join(into, 'skills')) ? into : path.join(into, fs.readdirSync(into)[0]);
  W.reg({ [KEY]: entry(top) });
  const r = install(W, top);
  const said = out(r);
  if (expect === 'ok') {
    const k = keys(W, ['check-pair', '--pair-index', '319,79']);
    return [r.status === 0 && /integrity lines say ok/.test(said) && k.status !== 2, `install ${r.status}: ${said}\nkeys: exit ${k.status} ${out(k)}`];
  }
  return [r.status === 2 && /did not say ok/.test(said) && /its first run refused/.test(said), `install ${r.status}: ${said}`];
}

// [name, find, replace, [cases that must go red]]: each guard broken in a scratch copy, beside an unbroken control
const MUTANTS = [
  ['the-checks-skipped', 'if (said.length)\n', 'if (false)\n', ['a-skill-whose-integrity-line-does-not-say-ok-refuses-and-keys-mjs-never-runs', 'a-missing-integrity-line-refuses']],
  ['a-verdict-read-by-exit-code-alone', "if (r.status !== 0 || !/^ok\\b/.test(out))", 'if (r.status !== 0)', ['a-check-that-exits-0-without-saying-ok-refuses-too']],
  ['a-missing-line-passed', 'said.push(`${s}: no integrity line', 'void (`${s}: no integrity line', ['a-missing-integrity-line-refuses']],
  ['the-path-kept-from-install', 'const at = (d) => path.join(d, ', 'const at = (d) => path.join(${JSON.stringify(PLUGIN)} || d, ', ['an-update-that-moves-the-plugin-moves-the-command-with-no-reinstall']],
  ['the-first-of-two-folders-taken', 'if (dirs.length !== 1) {', 'if (!dirs.length) {', ['a-plugin-no-longer-installed-or-in-two-folders-refuses']],
  ['the-exit-code-lost', 'process.exit(r.status === null ? 3 : r.status);', 'process.exit(0);', ['the-command-runs-keys-mjs-here-with-every-argument-and-its-exit-code']],
  ['a-file-not-ours-replaced', "!fs.readFileSync(target, 'utf8').includes(MARK)", 'false', ['another-keys-on-path-or-a-file-not-ours-at-the-target-is-refused-never-replaced']],
  ['another-keys-on-path-ignored', 'const other = otherOnPath(env, bin, platform);', 'const other = null;', ['another-keys-on-path-or-a-file-not-ours-at-the-target-is-refused-never-replaced']],
  ['the-profile-line-written-twice', 'if (had.includes(PROFILE_MARK))', 'if (false)', ['install-writes-the-command-and-one-profile-line-and-proves-it']],
  ['the-proof-not-asked', 'if (proof.status !== 0)', 'if (false)', ['install-says-so-when-the-written-command-refuses-its-first-run']],
  ['uninstall-removes-a-file-it-did-not-write', 'text === commandText(k)', 'true', ['uninstall-refuses-a-command-file-it-did-not-write-and-removes-nothing']],
  ['uninstall-takes-the-mark-for-the-whole-text', 'text === commandText(k)', "text.includes(MARK)", ['uninstall-refuses-a-command-file-it-did-not-write-and-removes-nothing']],
  ['uninstall-takes-any-line-after-the-mark', 'lines[i + 1] !== line', 'false', ['uninstall-refuses-a-marked-line-that-is-not-the-one-install-wrote']],
  ['uninstall-acts-before-every-check', 'if (refused.length) throw', 'if (refused.length && !files.length) throw', ['uninstall-refuses-a-marked-line-that-is-not-the-one-install-wrote']],
  ['uninstall-leaves-the-profile-line', 'for (const [prof, text] of edits)', 'for (const [prof, text] of [])', ['uninstall-removes-exactly-what-install-wrote-and-says-what']],
  ['uninstall-reads-only-the-shell-of-today', 'for (const name of PROFILES)', 'for (const name of [path.basename(profileFor(env, platform) || \'none\')])', ['uninstall-with-bin-takes-that-command-and-its-own-line-and-a-shell-changed-since']],
  ['uninstall-takes-any-keys-cmd', 'fs.readFileSync(cmd, \'utf8\') === CMD_TEXT', 'true', ['uninstall-on-windows-takes-keys-cmd-only-as-install-writes-it']],
];

if (argv.includes('--mutants')) {
  const base = fs.readFileSync(SRC, 'utf8');
  const runWith = (src, only) =>
    spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--only', only.join(',')], {
      env: { ...process.env, KEYS_COMMAND_SRC: src },
      encoding: 'utf8',
    });
  let bad = 0;
  const ctl = path.join(TMP, 'control.mjs');
  fs.writeFileSync(ctl, base);
  const c = runWith(ctl, Object.keys(CASES));
  console.log(`${c.status === 0 ? 'PASS' : 'FAIL'}  control: the unbroken copy passes every case`);
  if (c.status !== 0) bad++;
  for (const [name, find, repl, red] of MUTANTS) {
    const at = base.indexOf(find);
    if (at < 0 || base.indexOf(find, at + 1) >= 0) {
      console.log(`FAIL  ${name}: the line to break is ${at < 0 ? 'not there' : 'there twice'}`);
      bad++;
      continue;
    }
    const m = path.join(TMP, `${name}.mjs`);
    fs.writeFileSync(m, base.slice(0, at) + repl + base.slice(at + find.length));
    const r = runWith(m, red);
    const reds = red.filter((k) => new RegExp(`^FAIL  ${k}$`, 'm').test(r.stdout));
    const killed = reds.length === red.length;
    if (!killed) bad++;
    console.log(`${killed ? 'PASS' : 'FAIL'}  ${name}: ${killed ? 'killed' : 'SURVIVED'} (${reds.length}/${red.length} red)`);
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${MUTANTS.length + 1 - bad}/${MUTANTS.length + 1} mutants killed (with the control)`);
  process.exit(bad ? 1 : 0);
}

const only = opt('--only') ? opt('--only').split(',') : null;
let failed = 0;
for (const [name, fn] of Object.entries(CASES)) {
  if (only && !only.includes(name)) continue;
  let ok, ev;
  try {
    [ok, ev] = await fn();
  } catch (e) {
    [ok, ev] = [false, e.stack];
  }
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n        ${String(ev).split('\n').join('\n        ')}`}`);
}
const plugin = opt('--plugin');
let total = only ? only.length : Object.keys(CASES).length;
if (plugin) {
  total++;
  const [ok, ev] = real(path.resolve(plugin), opt('--expect') || 'refused');
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  the-real-archive-${opt('--expect') || 'refused'}\n        ${String(ev).split('\n').slice(0, 12).join('\n        ')}`);
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
