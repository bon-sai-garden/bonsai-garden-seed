// ---
// id: 01M4KSMRGMF0QS0K6ZT68PZY5D
// title: install-runtime — stage 5 of the walk: fetch rt, take it only at or above core's minimum and under its owner's seal, then wire the pot to it
// type: script
// tended-by: baisai
// created: 2026-10-10
// updated: 2026-10-21
// ---
//
// install-runtime.mjs — runtime rituals/specs/spec-rt-slice.md §5 and §6, the verb behind
// `keys.mjs install-runtime --pot <dir> --from <path|url> [--into <dir>] [--upgrade]`. It lives in core because
// it runs before any runtime exists (the gardener, 2026-10-06: the rite clones or downloads runtime).
//
// Core names no rt by hash or commit (the gardener, 2026-10-18: "we should never refer to a specific version of
// runtime as a dependency me thinks", "maybe a minimumversion, bvut not a fixed version"). It carries a minimum
// (rt-minimum.json beside this skill): the oldest rt it takes, and whose seal on an rt's manifest it believes. An rt
// is taken when (a) every byte matches its manifest, (b) it is the rt the minimum names at or above its version, and
// (c) its manifest carries an owner seal by a key the minimum names, over exactly those bytes, which the published
// keys at bon-sai.garden vouch for (as every package's integrity line asks them). Anything else is refused, loudly.
//
// The order is the contract. Fetch into a staging directory beside the destination; read the staging tree's bytes
// (a, b and the seal's form, offline); only then ask the published keys (c); then, and only then, move it into
// place, record it in the pot (runtime.json) and set the pot's local git config (core.hooksPath, bonsai.core,
// bonsai.rt). It writes no .mcp.json (2026-10-19): the garden MCP is a host service, rt's host-service.mjs. Nothing fetched is imported, required or run before it verifies; a refusal removes the staging
// directory it made and writes nothing else. The published keys not answering halts (3): nothing is installed.
//
// Sources: a git repository (a local path or a URL: cloned, at its HEAD), a directory holding an unpacked rt, or a
// .tar.gz (a local file, or an https URL: downloaded). There is no default source: the published address of rt is
// the gardener's to rule. A URL that does not answer halts (3) and says the walk stops at stage 5; a copy brought by
// hand (--from <path>) needs no network to fetch, though its seal still needs the published keys.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as M from './rt-manifest.mjs';
import { newUlid } from '../../bonsai-garden-sign/lib/ulid-rule.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORE = path.resolve(SKILL, '..', '..');
export const MINIMUM_FILE = path.join(SKILL, 'rt-minimum.json');

const isUrl = (s) => /^(https?|ssh|git|file):\/\//.test(s) || /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:/.test(s);
const isArchive = (s) => /\.(tar\.gz|tgz)$/i.test(s.split(/[?#]/)[0]);
const today = () => new Date().toISOString().slice(0, 10);

function git(args, opts = {}) {
  const r = spawnSync('git', args, {
    encoding: 'utf8',
    ...opts,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1', ...(opts.env || {}) },
  });
  return {
    code: r.error ? null : r.status,
    out: `${r.stdout || ''}${r.stderr || ''}`.trim(),
    stdout: (r.stdout || '').trim(),
    error: r.error,
  };
}
const headOf = (root) =>
  fs.existsSync(path.join(root, '.git')) ? git(['-C', root, 'rev-parse', 'HEAD']).stdout || null : null;

/**
 * The rt at `root` for this core, from its bytes alone (a, b and the seal's form): { problems: ['kind: what'],
 * manifest, manifestSha, seal }. [] problems means only the published keys are left to ask.
 */
function assess(root, minimum) {
  const v = M.verifyTree(root);
  const problems = v.problems.map((p) => `${p.kind}: ${p.what}`);
  let seal = null;
  if (v.manifest) {
    const { name, version } = v.manifest;
    if (name !== minimum.name) problems.push(`another-rt: this is ${name}; this core takes ${minimum.name}`);
    else if (!M.atLeast(version, minimum['min-version']))
      problems.push(`below-minimum: this is ${name} ${version}; this core takes ${minimum['min-version']} or newer`);
    const s = M.manifestSeal(root, minimum);
    if (s.problem) problems.push(`${s.problem.kind}: ${s.problem.what}`);
    else seal = s.data;
  }
  return { problems, manifest: v.manifest, manifestSha: v.manifestSha, seal };
}

/** (c): the published keys vouch for the manifest's seal, or this halts (unreachable, 3) or refuses (2). The answer's time. */
async function vouch(ctx, seal, where, { refuse, halt }) {
  const a = await ctx.origin.ask(seal);
  if (a.status === 'keys-unreachable')
    throw halt(
      `keys-unreachable: ${a.reason}; ${where}'s seal cannot be checked against the published keys, so nothing is installed. ` +
        'The walk stops at stage 5 here; run again when bon-sai.garden answers.',
    );
  if (a.status !== 'signature-vouched')
    throw refuse(
      `${a.status}: ${a.reason || "the published keys do not vouch for rt's seal"} (${where}, sealed by ${seal.signer}); nothing installed, nothing of it was run`,
    );
  return a.verifiedAt;
}

/** What the pot records of an rt it takes. */
const recordOf = (a, root, verifiedAt) => ({
  name: a.manifest.name,
  version: a.manifest.version,
  ...(a.manifest.upstream ? { upstream: a.manifest.upstream } : {}), // an older rt's manifest names where it was made; 0.9.1-rc on, none
  'rt-commit': headOf(root),
  'manifest-sha256': a.manifestSha,
  'sealed-by': { signer: a.seal.signer, fingerprint: a.seal.fingerprint },
  vouched: verifiedAt,
});

/** The rt at `root` against what this pot recorded at install: [] when it is that rt, intact. */
function recordProblems(root, recorded) {
  const out = M.verifyTree(root, recorded).problems.map((p) => `${p.kind}: ${p.what}`);
  const head = headOf(root);
  if (recorded['rt-commit'] && head && head !== recorded['rt-commit'])
    out.push(`not-recorded: the checkout is at ${head}; the pot recorded ${recorded['rt-commit']}`);
  return out;
}

/** The pot's first .gitignore (Bonsai's rehearsal, gap 54): host litter must never reach a commit, where the gate would seal it.
 *  Written only after the install verified and wired (a refused install leaves nothing behind); an existing file is kept and
 *  only gains the missing lines; running again changes nothing. */
const HOST_LITTER = ['.DS_Store', 'Thumbs.db'];
function ignoreHostLitter(pot, lines = HOST_LITTER) {
  const file = path.join(pot, '.gitignore');
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    /* none yet */
  }
  const have = new Set(text.split('\n').map((l) => l.trim()));
  const missing = lines.filter((l) => !have.has(l));
  if (!missing.length) return false;
  const head = text === '' || text.endsWith('\n') ? text : `${text}\n`;
  fs.writeFileSync(
    file,
    `${head}${text === '' ? '# host litter: never in a commit (written by install-runtime)\n' : ''}${missing.join('\n')}\n`,
  );
  console.log(`ignored: ${path.basename(pot)}/.gitignore now lists ${missing.join(', ')}`);
  return true;
}

export async function installRuntime(ctx, { refuse, halt, usage, deps = {} }) {
  const { pot, f } = ctx;
  if (!f.from) {
    throw usage(
      'install-runtime --pot <dir> --from <path or URL>: name where rt is (a git repository, an unpacked rt, a .tar.gz, ' +
        'or a URL to one). There is no default: the published address of rt is not ruled yet.',
    );
  }
  if (!fs.existsSync(path.join(pot, '.git')))
    throw refuse(`${pot} is not a git repository; a pot is one (git init it first); nothing fetched`);
  let minimum;
  try {
    minimum = M.readMinimum(MINIMUM_FILE);
  } catch (e) {
    throw refuse(`this core carries no usable rt minimum (${e.message}); nothing fetched`);
  }
  const ways = { refuse, halt };
  const dest = path.resolve(f.into || path.join(path.dirname(pot), minimum.name));
  const hooks = path.join(dest, ...M.HOOKS_DIR.split('/'));
  const hp = git(['-C', pot, 'config', '--get', 'core.hooksPath']);
  if (hp.code === 0 && hp.stdout && path.resolve(pot, hp.stdout) !== hooks) {
    throw refuse(
      `this pot's core.hooksPath already points at ${hp.stdout}; install-runtime does not take over another commit gate; nothing fetched`,
    );
  }

  // the destination already there: an rt this core takes is used as it is (or, on --upgrade, moved on from); an intact rt this
  // pot installed that this core no longer takes is replaced on --upgrade only; anything else is never touched
  let replacing = false;
  let existing = null;
  if (fs.existsSync(dest)) {
    const here = assess(dest, minimum);
    if (!here.problems.length) {
      existing = { ...here, verifiedAt: await vouch(ctx, here.seal, dest, ways) };
      if (!f.upgrade) {
        console.log(
          `rt: ${dest} already holds ${here.manifest.name} ${here.manifest.version}, sealed by ${here.seal.signer} and vouched for by the published keys, ` +
            `at or above this core's minimum ${minimum['min-version']}; used as it is (--upgrade --from <a newer rt> moves this pot to it)`,
        );
        return wire(pot, dest, recordOf(here, dest, existing.verifiedAt), 'existing', null);
      }
    } else {
      // Bonsai's gap 70: a pot could never move to a newer rt. On request, an intact rt THIS POT INSTALLED (its bytes still
      // what runtime.json recorded) is replaced; the old one is kept beside it (never deleted); anything else is never touched.
      let recorded = null;
      try {
        recorded = M.readRecord(path.join(pot, 'runtime.json'));
      } catch {
        /* none recorded */
      }
      const oldBad = recorded ? recordProblems(dest, recorded) : ['this pot recorded no install (no runtime.json)'];
      if (f.upgrade && !oldBad.length) {
        replacing = true;
      } else if (f.upgrade) {
        throw refuse(
          `--upgrade replaces only an intact rt this pot installed; ${dest} is not one (${oldBad[0]}); nothing fetched, nothing moved`,
        );
      } else {
        throw refuse(
          `${dest} already holds something that is not an rt this core takes (${here.problems[0]}${here.problems.length > 1 ? `, and ${here.problems.length - 1} more` : ''}); ` +
            'install-runtime never overwrites on its own: --upgrade replaces an intact older rt this pot installed (the old one is kept beside it); ' +
            'otherwise move it away or name another --into',
        );
      }
    }
  }
  if (!fs.existsSync(path.dirname(dest))) throw refuse(`${path.dirname(dest)} does not exist; nothing fetched`);

  const src = f.from;
  const url = isUrl(src);
  const local = url ? null : path.resolve(src);
  if (!url && !fs.existsSync(local)) throw refuse(`the source ${src} does not exist; nothing fetched`);
  const kind = isArchive(src)
    ? 'archive'
    : url
      ? 'git'
      : fs.existsSync(path.join(local, '.git'))
        ? 'git'
        : fs.statSync(local).isDirectory()
          ? 'dir'
          : null;
  if (!kind) throw refuse(`the source ${src} is not a git repository, an unpacked rt or a .tar.gz; nothing fetched`);
  if (kind === 'archive' && url && !/^https:\/\//.test(src))
    throw refuse(`an archive is downloaded over https only, not ${src.split(':')[0]}; nothing fetched`);

  const staging = path.join(
    path.dirname(dest),
    `.${path.basename(dest)}.incoming-${crypto.randomBytes(4).toString('hex')}`,
  );
  fs.mkdirSync(staging);
  let root = staging;
  let taken;
  try {
    if (kind === 'git') {
      const c = git(['clone', '--quiet', '--no-checkout', '--', src, staging], { env: { GIT_CONFIG_NOSYSTEM: '1' } });
      if (c.code !== 0) {
        if (url) {
          throw halt(
            `could not reach ${src} (${c.out.split('\n').pop() || 'no answer'}): nothing was fetched and nothing installed. ` +
              'The walk stops at stage 5 here. Without a network, bring a copy of rt by hand and run again with --from <that path>.',
          );
        }
        throw refuse(`${src} could not be cloned (${c.out.split('\n').pop()}); nothing installed`);
      }
      const co = git(['-C', staging, '-c', 'core.hooksPath=/dev/null', 'checkout', '--quiet', '--detach', 'HEAD']);
      if (co.code !== 0)
        throw refuse(`the source has no commit to check out (${co.out.split('\n').pop()}); nothing installed`);
    } else if (kind === 'dir') {
      fs.cpSync(local, staging, {
        recursive: true,
        verbatimSymlinks: true,
        filter: (p) => path.basename(p) !== '.git' || path.dirname(p) !== local,
      });
    } else {
      let bytes;
      if (url) {
        const get = deps.fetch || globalThis.fetch;
        let res;
        try {
          res = await get(src);
        } catch (e) {
          throw halt(
            `could not reach ${src} (${e.message}): nothing was fetched and nothing installed. The walk stops at stage 5 here. ` +
              'Without a network, bring a copy of rt by hand and run again with --from <that path>.',
          );
        }
        if (!res.ok) throw refuse(`${src} answered ${res.status}; nothing installed`);
        bytes = Buffer.from(await res.arrayBuffer());
      } else bytes = fs.readFileSync(local);
      const tgz = path.join(staging, '.archive.tar.gz');
      fs.writeFileSync(tgz, bytes);
      const list = spawnSync('tar', ['-tzf', tgz], { encoding: 'utf8' });
      if (list.status !== 0)
        throw refuse(`the archive cannot be read (${(list.stderr || '').trim().split('\n').pop()}); nothing installed`);
      const bad = list.stdout
        .split('\n')
        .filter(Boolean)
        .filter((e) => e.startsWith('/') || e.split('/').includes('..'));
      if (bad.length) throw refuse(`the archive names paths outside itself (${bad[0]}); nothing installed`);
      const out = path.join(staging, 'tree');
      fs.mkdirSync(out);
      const x = spawnSync('tar', ['-xzf', tgz, '-C', out], { encoding: 'utf8' });
      fs.rmSync(tgz);
      if (x.status !== 0)
        throw refuse(
          `the archive cannot be unpacked (${(x.stderr || '').trim().split('\n').pop()}); nothing installed`,
        );
      root = out;
      const top = fs.readdirSync(out); // one top-level directory: rt is inside it
      if (
        !fs.existsSync(path.join(out, M.MANIFEST)) &&
        top.length === 1 &&
        fs.lstatSync(path.join(out, top[0])).isDirectory()
      )
        root = path.join(out, top[0]);
      // Mori-shin's R6 and P3: nothing outside the manifest is installed. walk() steps over a top-level .git (a git source's
      // own clone), so an archive that carries one would land it in rt, its config run by the next `git status` there
      if (fs.readdirSync(root).includes('.git'))
        // by name: a link, even a dangling one, counts
        throw refuse(
          'the archive carries a .git/ beside rt, which its manifest does not list and rt never carries; nothing installed, nothing of it was run',
        );
    }
    const got = assess(root, minimum);
    if (got.problems.length) {
      for (const b of got.problems) console.log(`  REFUSED ${b}`);
      throw refuse(
        `what ${src} holds is not an rt this core takes (${got.problems[0]}); nothing installed, nothing of it was run`,
      );
    }
    if (existing && got.manifestSha === existing.manifestSha) {
      console.log(`rt: ${dest} already holds this rt (${got.manifest.name} ${got.manifest.version}); nothing moved`);
      return wire(pot, dest, recordOf(existing, dest, existing.verifiedAt), 'existing', null);
    }
    if (existing && M.versionCmp(got.manifest.version, existing.manifest.version) <= 0)
      throw refuse(
        `--upgrade moves only to a newer rt: ${src} holds ${got.manifest.version}, ${dest} holds ${existing.manifest.version}; nothing moved`,
      );
    taken = recordOf(got, root, await vouch(ctx, got.seal, src, ways));
    if (existing) replacing = true;
    if (replacing) {
      // the older rt is MOVED, never deleted (a delete is the gardener's); if the new one cannot take its place the old is put back
      const kept = `${dest}.replaced-${new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '')}Z-${crypto.randomBytes(2).toString('hex')}`;
      fs.renameSync(dest, kept);
      try {
        fs.renameSync(root, dest);
      } catch (e) {
        fs.renameSync(kept, dest);
        throw e;
      }
      console.log(`rt: the older rt is kept at ${kept}; nothing of it was deleted`);
    } else fs.renameSync(root, dest);
  } finally {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true }); // only the staging directory this run made
  }
  console.log(
    `rt: fetched from ${url ? src : 'a local copy'} (${kind}): ${taken.name} ${taken.version}, every byte its manifest's, ` +
      `at or above this core's minimum ${minimum['min-version']}, sealed by ${taken['sealed-by'].signer} and vouched for by the published keys; installed at ${dest}`,
  );
  return wire(pot, dest, taken, kind, url ? src : null);
}

/** After verification only: the hook may run, the pot records the rt it took, the pot's local config names core and rt. */
function wire(pot, dest, taken, kind, url) {
  const hooks = path.join(dest, ...M.HOOKS_DIR.split('/'));
  for (const h of fs.readdirSync(hooks)) if (!h.startsWith('.')) fs.chmodSync(path.join(hooks, h), 0o755);
  const rec = { format: M.RECORD_FORMAT, ...taken, source: kind, ...(url ? { 'source-url': url } : {}) };
  const file = path.join(pot, 'runtime.json');
  let was = null;
  try {
    was = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    /* none */
  }
  const wroteNow = [];
  if (!was || was['manifest-sha256'] !== rec['manifest-sha256']) {
    fs.writeFileSync(file, `${JSON.stringify({ ...rec, installed: today() }, null, 2)}\n`);
    wroteNow.push('runtime.json');
    console.log(
      `recorded: ${path.join(path.basename(pot), 'runtime.json')} names ${rec.name} ${rec.version}, manifest ${rec['manifest-sha256'].slice(0, 16)}…` +
        (was ? ` (was ${was.version}, ${String(was['manifest-sha256']).slice(0, 16)}…)` : ''),
    );
  } else console.log(`recorded: runtime.json already names this rt`);
  for (const [k, v] of [
    ['core.hooksPath', hooks],
    ['bonsai.core', CORE],
    ['bonsai.rt', dest],
  ]) {
    const r = git(['-C', pot, 'config', '--local', k, v]);
    if (r.code !== 0) throw new Error(`git config ${k} failed: ${r.out}`);
  }
  console.log(`wired: this pot's commit gate is ${hooks}; it finds core at ${CORE}`);
  const mcp = wireMcp(pot, dest, rec);
  // .bonsai/ is the garden MCP's own host-local state (its write log); the kobun dry run's N-1 found it committable by accident
  if (ignoreHostLitter(pot, mcp ? [...HOST_LITTER, '.mcp.json', '.bonsai/'] : HOST_LITTER)) wroteNow.push('.gitignore');
  if (mcp) wroteNow.push(...firstContract(pot));
  if (wroteNow.length) {
    // Bonsai's gap 72: written unsealed; the pot's own gate refuses an unsealed file. Name them and the command that seals them.
    console.log(`unsealed: ${wroteNow.join(', ')}`);
    console.log(
      `next: git -C ${pot} add -- ${wroteNow.join(' ')}  then  node ${path.join(CORE, 'skills', 'bonsai-garden-keys', 'bin', 'keys.mjs')} seal-staged --pot ${pot} --as <you> -- ${wroteNow.join(' ')}`,
    );
  }
  console.log(`next: node ${path.join(dest, ...M.DOCTOR.split('/'))} --pot ${pot}`);
}

// ── the garden MCP (runtime rituals/specs/spec-rt-mcp-slice.md) ─────────────────────────────────────────────────────────────
// Until 2026-10-19 an rt that carries the server (tools/bonsai-mcp/server.py) got the pot's .mcp.json written: a server per
// session, started by the client from the pot's folder. The desktop app drops such a server after one turn (W's F-10, the third
// dry run), and the gardener: "no terminal is not a fix or a workaround. we need to be able to register a stable garden mcp!"
// So install-runtime writes no .mcp.json. The garden MCP is a service on the host, registered once at user level under the
// garden's own name, by rt's own tools/rt/host-service.mjs, once the garden has its keys (garden.json) and its registry
// (planting §8). Here: say so, and name the step. .mcp.json stays ignored by git: a pot may still carry one of its own, and
// host-service install retires a per-session garden entry from it. uv runs the server, so a host without uv is told now.
const SERVER = ['tools', 'bonsai-mcp', 'server.py'];
const HOST_SERVICE = ['tools', 'rt', 'host-service.mjs'];

/** uv by absolute path: BONSAI_UV when set (and then only it), else PATH and the places uv's installers use. */
function findUv() {
  if (process.env.BONSAI_UV !== undefined)
    return fs.existsSync(process.env.BONSAI_UV) ? path.resolve(process.env.BONSAI_UV) : null;
  const dirs = [
    ...(process.env.PATH || '').split(path.delimiter),
    path.join(os.homedir(), '.local', 'bin'),
    path.join(os.homedir(), '.cargo', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ];
  for (const d of dirs.filter(Boolean)) {
    const p = path.join(d, process.platform === 'win32' ? 'uv.exe' : 'uv');
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch {
      /* not here */
    }
  }
  return null;
}

/** true when this rt carries the garden MCP and this host can run it; then the pot gets its first contract. Writes nothing. */
function wireMcp(pot, dest, rt) {
  if (!fs.existsSync(path.join(dest, ...SERVER))) {
    console.log(`mcp: ${rt.name} ${rt.version} carries no garden MCP server`);
    return false;
  }
  if (!findUv()) {
    console.log(
      'mcp: no uv on this host (https://docs.astral.sh/uv/), so the garden MCP cannot run here. ' +
        'Install uv, or name it with BONSAI_UV=<path>, and run install-runtime again (it changes nothing else).',
    );
    return false;
  }
  const hs = path.join(dest, ...HOST_SERVICE);
  console.log(
    fs.existsSync(hs)
      ? `mcp: the garden MCP runs as a service on this host, registered once at user level under the garden's own name; ` +
          `no .mcp.json is written. After the keys (garden.json) and the registry: node ${hs} install --pot ${pot}`
      : `mcp: ${rt.name} ${rt.version} carries the server and no tools/rt/host-service.mjs, so the garden MCP cannot be ` +
          'installed as a host service from it; install-runtime --upgrade --from <a newer rt>. No .mcp.json is written.',
  );
  return true;
}

/** The P-001 header a pot's own document needs before seal-staged takes it (the kobun dry run's F-16, 2026-10-14: both files
 *  were written bare and the pot's first seal refused them). The id is minted, never typed; tended-by is the gardener garden.json
 *  names, and is left out when the pot has no garden.json yet rather than guessed. */
function header(pot, title) {
  let gardener = null;
  try {
    gardener = JSON.parse(fs.readFileSync(path.join(pot, 'garden.json'), 'utf8')).gardener || null;
  } catch {
    /* not seeded yet */
  }
  const d = today();
  return [
    '---',
    `id: ${newUlid()}`,
    `title: ${JSON.stringify(title)}`,
    'type: meta',
    ...(gardener ? [`tended-by: ${gardener}`] : []),
    `created: ${d}`,
    `updated: ${d}`,
    '---',
    '',
    '',
  ].join('\n');
}

/** AGENTS.md (from references/pot-agents.md, one source) and a CLAUDE.md that embeds it, each only where the pot has none. */
function firstContract(pot) {
  const wrote = [];
  const agents = path.join(pot, 'AGENTS.md');
  if (!fs.existsSync(agents)) {
    const tpl = fs
      .readFileSync(path.join(SKILL, 'references', 'pot-agents.md'), 'utf8')
      .replace(/^---\n[\s\S]*?\n---\n+/, '');
    fs.writeFileSync(agents, header(pot, "This pot's AGENTS.md: the garden contract, the pot's own") + tpl);
    wrote.push('AGENTS.md');
  }
  const claude = path.join(pot, 'CLAUDE.md');
  if (!fs.existsSync(claude)) {
    fs.writeFileSync(
      claude,
      header(pot, "This pot's CLAUDE.md: makes Claude Code load AGENTS.md") +
        '# CLAUDE.md\n\n@AGENTS.md\n\nThe garden contract is AGENTS.md, embedded above; this file only makes Claude Code load it.\n',
    );
    wrote.push('CLAUDE.md');
  }
  if (wrote.length) console.log(`contract: wrote ${wrote.join(' and ')} (the pot had none; never overwritten)`);
  return wrote;
}
