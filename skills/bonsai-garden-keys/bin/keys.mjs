#!/usr/bin/env node
// ---
// id: 01M498HC6FG37QTV44TVH7TTFG
// title: The gardener's keys, one binary, the arc's verbs in order
// type: script
// tended-by: baisai
// created: 2026-10-06
// updated: 2026-10-18
// ---
//
// keys.mjs — spec-gardeners-keys.md §2: detect, id, mint, recover, namespace, identity, derive,
// seed, verify, attest, and status; past the arc, seal-staged, install-runtime and fill-bodies
// (planting 7c). Bonsai runs the same binary the gardener does; there is no
// --walk flag and no second code path. Exit: 0 done · 2 refused (one line: why, and what to do) ·
// 3 halt (the state cannot be determined) · 64 usage. A refusal never writes.
//
// The master salt is read from custody once per verb, kept in memory, and never printed, logged,
// written outside custody and the sealed export, or put on a command line (test-keys.mjs greps).
//
// Two verbs believe something they did not make, and ask the origin for it: namespace
// and identity read the shipped reserved-marks.json, pinned by its seal and believed only on
// bon-sai.garden's signed answer (spec §6.4; there is no flag that names another file); seed
// confirms Bonsai's entry the same way before it writes (§8.1). Unreachable halts (3): no cache,
// no offline mode, no --trust-file. The question goes through bonsai-garden-mark's origin.mjs;
// cli(argv, { origin }) takes another one only from a caller in process (the suites' fake site),
// never from a flag, a file or the environment.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { backends, offered, detect, RANK, FLOOR, CustodyError, randomSalt } from '../lib/custody.mjs';
import { sealEnvelope, openEnvelope, envelopePayload } from '../lib/envelope.mjs';
import {
  rootSalt,
  today,
  keyOf,
  sealWith,
  P,
  readJson,
  jsonText,
  writeJson,
  readLocks,
  keyOnFile,
  writeKey,
  fpIndices,
  withinByInode,
  publicMaterialProblems,
  companionsOf,
} from '../lib/garden.mjs';
import { searchSigning, describeEstimate } from '../lib/search-signing.mjs';
import { transport } from '../lib/call-home.mjs';
import { fileURLToPath } from 'node:url';
import { searchNamespace, pairOf, chars, bonFirst, attempts, GUARDIAN } from '../../bonsai-garden-mark/namespace.mjs';
import { loadReservedSet } from '../../bonsai-garden-mark/reserved-marks.mjs';
import { makeOrigin } from '../../bonsai-garden-mark/origin.mjs';
import { v2SchemaProblem } from '../../bonsai-garden-sign/lib/seal-v2.mjs';
import { signData, verifySignature } from '../../bonsai-garden-sign/lib/derive-key.mjs';
import { potVerdict, NOT_LAB_NOTE, labNote } from '../lib/pot-verdict.mjs';
import { newUlid, whyBad } from '../../bonsai-garden-sign/lib/ulid-rule.mjs';
import { creditInfo, sealRole } from '../../bonsai-garden-sign/lib/credit.mjs';
import { readSealPolicy, prepareV2, nowUtc } from '../../bonsai-garden-sign/lib/seal-v2.mjs';
import { findSidecar, targetPathFor } from '../../bonsai-garden-sign/lib/sidecar-format.mjs';
import { spawnSync } from 'node:child_process';
import { installRuntime } from '../lib/install-runtime.mjs';
import { fillBodies } from '../lib/fill-bodies.mjs';
import {
  writeDocs,
  sign as signCertificate,
  verify as verifyCertificates,
  roleFor,
  passportRel,
  CovenantRefusal,
} from '../lib/covenant.mjs';
import { plantHomes } from '../lib/homes.mjs';

class Exit extends Error {
  constructor(code, msg) {
    super(msg);
    this.exit = code;
  }
}
const refuse = (m) => new Exit(2, m);
const halt = (m) => new Exit(3, m);
const usage = (m) => new Exit(64, m);

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const NAME_RE = /^[a-z][a-z0-9-]{1,30}$/;
const BOOL = new Set(['lab-preview', 'passphrase-stdin', 'check', 'candidates', 'all', 'upgrade', 'renew']);
const KNOWN = new Set([
  'pot',
  'backends',
  'keychain',
  'op-vault',
  'name',
  'gardener',
  'shin',
  'out',
  'file',
  'pair',
  'fp-attests',
  'pick',
  'candidates',
  'all',
  'upgrade',
  'bonsai-entry',
  'keys',
  'lab-preview',
  'passphrase-stdin',
  'check',
  'as',
  'from',
  'into',
  'choices',
  'for',
  'renew',
]);

const USAGE = `keys.mjs — the gardener's keys (spec-gardeners-keys.md), verbs in the arc's order:

  detect   --pot <dir>                              what custody this host has, and: mint · derive · cannot tell
  id       --pot <dir> --name <romaji> --gardener <slug> --shin <slug>
  mint     --pot <dir> [--lab-preview]              32 bytes into custody; prints the root fingerprint only
  recover  export --pot <dir> --out <file>          the sealed backup, by your hand, once
  recover  drill  --pot <dir> --file <export>       decrypt in memory, compare the root: ok (mandatory before namespace)
  recover  restore --pot <dir> --file <export>      a new or wiped host: back into custody, then the drill
  namespace --pot <dir>                             three kanji, the third 庭, none matching the shipped reserved rule
  identity <slug> --pot <dir> --pair 〇〇 [--candidates | --pick <1-5>] [--fp-attests 2]
  identity bonsai-shin --pot <dir> --candidates | --pick <1-5>     the guardian's ID is drawn, never chosen (no --pair)
  derive   <slug> --pot <dir>                       public key and fingerprint into the pot's identity layout
  derive   --all --pot <dir>                        the root and every locked entity, custody opened once
  seed     --pot <dir> --bonsai-entry <file>         the pot's agents/registry.json, in order, once the origin vouches
  verify   --keys pot --pot <dir> --file <path>     a seal against the pot's own registry
  attest   --pot <dir>                              the call home: one public document, sealed
  status   --pot <dir>                              where the arc stands, from the pot's files alone
  custody  status --pot <dir>                       the same table as detect
  seal-staged --pot <dir> --as <slug> -- <path> ... seal THESE staged files with <slug>'s key from this garden's salt
  seal-staged --check --pot <dir>                   refuse a staged file whose seal does not verify (the commit gate)
  install-runtime --pot <dir> --from <path|url> [--into <dir>] [--upgrade]
                                                    stage 5: fetch rt; take it only when every byte is its manifest's, it is at or
                                                    above core's minimum (rt-minimum.json) and the published keys vouch for its
                                                    owner's seal on the manifest; then wire the pot
                                                    (--upgrade: move to a newer rt, or replace an intact rt this pot installed that
                                                    core no longer takes; the old one is kept beside it)
  fill-bodies --pot <dir> --choices <choices.json> [--check]
                                                    planting 7c: the registry, garden.json and the gardener's choices written into
                                                    the bodies (tokens, versions, the registry's display fields, .pending on his yes);
                                                    no seal written. --check: C1–C9, the drift gate before every seal (exit 1)
  covenant write  --pot <dir> [--name "<signed>"]   stage 4: lore/covenant.md and lore/codex.md, the garden's own, never overwritten
  certificate sign --pot <dir> --for <kin> --as <the gardener | the kin> [--renew]
                                                    the kin's certificate in its identity/passport.json: one statement (garden, sponsor,
                                                    agentic-teammate, covenant and codex by id and sha256, date), signed by both
  certificate verify --pot <dir> [--for <kin>]      both signatures, both keys the registry's, the texts as they stand (exit 1)

  --backends a,b      which custody backends to offer (default: this platform's: ${offered().join(', ')})
  --keychain <file>   macOS: a named keychain file instead of the login keychain
  --op-vault <name>   1Password: the vault (default "Bonsai Garden")
  --passphrase-stdin  read passphrases from stdin, one per line (otherwise asked on the terminal)

namespace, identity and seed ask bon-sai.garden whether it vouches (the reserved set's seal, Bonsai's
entry); no answer halts. The reserved set is the shipped skills/bonsai-garden-mark/reserved-marks.json.

Exit: 0 done · 1 drift (fill-bodies --check, seal-staged --check, verify) · 2 refused · 3 halt · 64 usage.`;

function parse(argv) {
  const pos = [],
    f = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      f['--'] = argv.slice(i + 1);
      break;
    } // seal-staged: the paths you are committing
    if (!a.startsWith('--')) {
      pos.push(a);
      continue;
    }
    const k = a.slice(2);
    if (k === 'exclude')
      throw usage(
        "--exclude is gone: the reserved set is the shipped, sealed reserved-marks.json, believed on bon-sai.garden's word (spec §6.4)",
      );
    if (!KNOWN.has(k)) throw usage(`unknown flag --${k}`);
    if (BOOL.has(k)) {
      f[k] = true;
      continue;
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw usage(`--${k} needs a value`);
    f[k] = v;
    i++;
  }
  return { pos, f };
}

// ── passphrases: the terminal, hidden; or stdin lines, named by a flag ────────

function promptHidden(prompt) {
  return new Promise((resolve, reject) => {
    const s = process.stdin;
    s.setRawMode(true); // before the prompt: a keystroke after it is never echoed
    process.stderr.write(`${prompt}: `);
    s.resume();
    s.setEncoding('utf8');
    let buf = '';
    const on = (chunk) => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') {
          s.setRawMode(false);
          s.pause();
          s.removeListener('data', on);
          process.stderr.write('\n');
          resolve(buf);
          return;
        }
        if (c === '\u0003') {
          s.setRawMode(false);
          s.pause();
          s.removeListener('data', on);
          reject(refuse('interrupted; nothing written'));
          return;
        }
        if (c === '\u007f') {
          buf = buf.slice(0, -1);
          continue;
        }
        buf += c;
      }
    };
    s.on('data', on);
  });
}

function passphrases(fromStdin) {
  let lines = null;
  const next = async (prompt) => {
    if (fromStdin) {
      if (lines === null) lines = fs.readFileSync(0, 'utf8').split('\n');
      if (!lines.length || (lines.length === 1 && lines[0] === ''))
        throw refuse(`stdin has no line left for: ${prompt}; nothing written`);
      return lines.shift();
    }
    if (!process.stdin.isTTY)
      throw usage('a passphrase is needed and there is no terminal: run in one, or pass --passphrase-stdin');
    return promptHidden(prompt);
  };
  return {
    ask: (p) => next(p),
    async askNew(p) {
      const a = await next(p);
      const b = await next(`${p}, again`);
      if (a !== b) throw refuse('the two passphrases differ; nothing written');
      if ([...a].length < 12) throw refuse('a passphrase is at least 12 characters; nothing written');
      return a;
    },
  };
}

// ── context and shared steps ─────────────────────────────────────────────────

function context(f, deps = {}) {
  if (!f.pot) throw usage('--pot <dir> is required');
  const pot = path.resolve(f.pot);
  const pp = passphrases(!!f['passphrase-stdin']);
  const all = backends({ env: process.env, keychain: f.keychain || null, opVault: f['op-vault'], passphrase: pp });
  const names = f.backends ? f.backends.split(',').filter(Boolean) : offered();
  for (const n of names)
    if (!all[n]) throw usage(`unknown custody backend ${n} (known: ${Object.keys(all).join(', ')})`);
  return { pot, f, pp, all, names, origin: deps.origin || makeOrigin() };
}

/** The shipped reserved set, pinned by its seal and the origin's word (spec §6.4). Refuses 2, halts 3. */
async function reservedRule(ctx) {
  try {
    return await loadReservedSet({ origin: ctx.origin });
  } catch (e) {
    if (e && e.code === 'RESERVED_REFUSED') {
      const m = `no reserved set to search against: ${e.message}`;
      throw e.exit === 3 ? halt(m) : refuse(m);
    }
    throw e;
  }
}

/** Where core ships Bonsai's seed entry; the seal must name it. */
const SEED_TARGET = 'agents/bonsai/identity/bonsai-seed-entry.json';

/**
 * Spec §8.1: the file supplies, the origin confirms. Offline first (the seal's form, an owner seal by
 * bonsai, the address, the bytes, the fingerprint the entry states), then bon-sai.garden's signed
 * answer. Returns the answer's own verified_at, which the registry records as `vouched`.
 */
async function vouchBonsai(ctx, file, be) {
  const side = path.join(path.dirname(file), `.${path.basename(file)}.bonsaisig`);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(side, 'utf8'));
  } catch (e) {
    throw refuse(
      `Bonsai's entry has no seal beside it (${path.basename(side)}${e.code === 'ENOENT' ? '' : ', unreadable'}); ` +
        'seed asks the origin to vouch for the sealed file, never the file alone (spec §8.1); nothing written',
    );
  }
  const p = v2SchemaProblem(data);
  if (p) throw refuse(`Bonsai's entry's seal is not a bonsaisig/2 seal (${p}); nothing written`);
  if (data.signer !== 'bonsai' || data.role !== 'owner' || 'open' in data) {
    throw refuse(
      `Bonsai's entry is sealed ${'open' in data ? 'open' : data.role} by ${data.signer}; seed proceeds only on an owner seal by bonsai; nothing written`,
    );
  }
  if (data.target !== SEED_TARGET)
    throw refuse(
      `the seal names ${data.target}, not ${SEED_TARGET}, the address core ships Bonsai's entry at; nothing written`,
    );
  if (crypto.createHash('blake2b512').update(fs.readFileSync(file)).digest('hex') !== data['file-hash']) {
    throw refuse("hash-mismatch: Bonsai's entry is not the bytes that were sealed; nothing written");
  }
  if (data.fingerprint !== be.fingerprint) {
    throw refuse(
      `the seal's fingerprint ${data.fingerprint} is not the fingerprint the entry states (${be.fingerprint}); nothing written`,
    );
  }
  const v = await ctx.origin.ask(data);
  if (v.status === 'keys-unreachable')
    throw halt(`keys-unreachable: ${v.reason}; Bonsai's entry cannot be confirmed; nothing written`);
  if (v.status !== 'signature-vouched')
    throw refuse(`${v.status}: ${v.reason || "bon-sai.garden does not vouch for Bonsai's entry"}; nothing written`);
  if (!v.verifiedAt)
    throw refuse("answer-malformed: the origin's signed answer carries no verified_at; nothing written");
  return v.verifiedAt;
}

function garden(ctx) {
  const g = readJson(P.garden(ctx.pot));
  if (!g) throw refuse(`no garden.json in ${ctx.pot}: run id first`);
  return g;
}
function needRoot(g) {
  if (!g['root-fingerprint']) throw refuse('this garden has no root yet: run mint first');
}

const custodyExit = (e, what) => {
  if (e instanceof Exit) return e;
  if (e instanceof CustodyError && e.code === 'EXISTS') return refuse(e.message);
  return halt(`${what}: ${e.message}`);
};

/** The salt, once, from the one backend that holds this garden's item; checked against the root. */
async function readMaster(ctx, g) {
  const d = await detect({ pot: ctx.pot, all: ctx.all, names: ctx.names });
  if (d.verdict !== 'derive') throw halt(`cannot read garden ${g.garden}'s salt: ${d.reason}`);
  let hex;
  try {
    hex = await ctx.all[d.holder].get(g.garden);
  } catch (e) {
    throw custodyExit(e, `custody (${d.holder})`);
  }
  if (g['root-fingerprint'] && keyOf(hex, rootSalt(g.garden)).fingerprint !== g['root-fingerprint']) {
    throw halt(`custody (${d.holder}) holds a salt whose root is not this garden's root; stopping`);
  }
  return { hex, holder: d.holder, tier: d.tier };
}

/** §3.4: the floor, and the one flag. The flag is read from argv only, never env or a file. */
function floor(name, tier, labPreview) {
  if (RANK[tier] >= RANK[FLOOR]) return;
  if (labPreview) return;
  throw refuse(
    `the best custody on this host is ${name} (${tier}), below the floor (${FLOOR} or above). ` +
      "set up a keystore first: 1Password, or the OS's own. (--lab-preview allows the software fallback, named as such, " +
      'for the lab preview only.)',
  );
}

function sealRoot(hex, g, file) {
  return sealWith(hex, rootSalt(g.garden), g.name, file, { custody: g['custody-tier'] });
}

const readExport = (file) => {
  if (!file) throw usage('--file <the sealed export> is required');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw refuse(`${file} cannot be read as an export (${e.code || 'not JSON'})`);
  }
};

/** The export's provenance: this garden's id, this garden's root, the root's signature over the rest. */
function exportIsThisGardens(env, g) {
  if (
    !env ||
    env.garden !== g.garden ||
    env['root-fingerprint'] !== g['root-fingerprint'] ||
    typeof env.signature !== 'string'
  )
    return false;
  const pub = Buffer.from(g['root-public-key'] || '', 'base64');
  if (pub.length !== 32) return false;
  return verifySignature(pub.toString('hex'), envelopePayload(env), env.signature);
}

/** Decrypt, compare the root, hand the salt to `then`, zero. Wrong passphrase: refused, nothing written. */
async function drillWith(ctx, g, env, then) {
  if (!exportIsThisGardens(env, g))
    throw refuse(
      "this export is not this garden's: its id, root or the root key's signature does not hold; nothing written",
    );
  const pass = await ctx.pp.ask('export passphrase');
  let raw;
  try {
    raw = openEnvelope(env, pass, g.garden);
  } catch {
    throw refuse('the drill FAILED: the passphrase does not open the export; nothing written');
  }
  try {
    const hex = raw.toString('hex');
    if (keyOf(hex, rootSalt(g.garden)).fingerprint !== g['root-fingerprint'])
      throw refuse('the drill FAILED: the export derives another root; nothing written');
    return await then(hex);
  } finally {
    raw.fill(0);
  }
}

// ── the verbs ────────────────────────────────────────────────────────────────

async function cmdDetect(ctx) {
  const d = await detect({ pot: ctx.pot, all: ctx.all, names: ctx.names });
  console.log('backend          tier               available  present  unlocked');
  for (const r of d.rows) {
    const cell = (v) => (v === true ? 'yes' : v === false ? 'no' : '?');
    console.log(
      `${r.name.padEnd(16)} ${String(r.tier).padEnd(18)} ${r.error ? `ERROR: ${r.error}` : `${cell(r.available).padEnd(10)} ${cell(r.present).padEnd(8)} ${cell(r.unlocked)}${r.note ? `   (${r.note})` : ''}`}`,
    );
  }
  console.log(`\nverdict: ${d.verdict} — ${d.reason}`);
  if (d.chosen)
    console.log(
      `would use: ${d.chosen} (${d.tier})${RANK[d.tier] < RANK[FLOOR] ? `, below the floor (${FLOOR}): only with --lab-preview` : ''}`,
    );
  if (d.verdict === 'cannot-tell') throw halt(d.reason);
}

async function cmdId(ctx) {
  const { pot, f } = ctx;
  if (!fs.existsSync(pot) || !fs.existsSync(path.join(pot, '.git')))
    throw refuse(`${pot} is not a git repository; a pot is one (git init it first)`);
  if (!f.name || !f.gardener || !f.shin)
    throw usage('id needs --name <romaji> --gardener <slug> --shin <slug>[,<slug>...]');
  if (!NAME_RE.test(f.name))
    throw refuse(`the garden's name is lowercase romaji, ^[a-z][a-z0-9-]{1,30}$, not ${JSON.stringify(f.name)}`);
  // one companion or more (a garden may plant more than one): --shin a,b
  const shins = String(f.shin)
    .split(',')
    .map((s) => s.trim());
  for (const s of [f.gardener, ...shins])
    if (!SLUG_RE.test(s)) throw refuse(`${JSON.stringify(s)} is not a slug (^[a-z0-9][a-z0-9-]*$)`);
  const seeded = [f.gardener, 'bonsai', 'bonsai-shin', ...shins];
  if (seeded.includes(f.name)) {
    throw refuse(
      `the garden's name "${f.name}" is a slug the registry seed will carry; the root key's slug is the garden's name, ` +
        'and the two would collide in the seal grammar. Choose another name.',
    );
  }
  if (new Set(seeded).size !== seeded.length)
    throw refuse('the gardener, bonsai, bonsai-shin and every companion need different slugs');
  if (fs.existsSync(P.garden(pot))) throw refuse(`${P.garden(pot)} already exists; a garden is given its id once`);
  const pj = readJson(P.pot(pot));
  if (pj) throw refuse(`${P.pot(pot)} already names garden ${pj.garden}`);
  const ulid = newUlid();
  if (whyBad(ulid)) throw halt(`the generated id ${ulid} fails the ULID rule (${whyBad(ulid)})`);
  // `shin` stays the first companion, as every reader of a one-companion garden expects; `shins` is written only for more
  writeJson(P.garden(pot), {
    garden: ulid,
    name: f.name,
    gardener: f.gardener,
    shin: shins[0],
    ...(shins.length > 1 ? { shins } : {}),
    namespace: null,
    'root-fingerprint': null,
    'root-public-key': null,
    'custody-tier': null,
    'lab-preview': false,
    created: today(),
  });
  writeJson(P.pot(pot), { garden: ulid, namespace: null });
  console.log(`garden ${ulid} · ${f.name}`);
  console.log('next: mint');
}

async function cmdMint(ctx) {
  const g = garden(ctx);
  const d = await detect({ pot: ctx.pot, all: ctx.all, names: ctx.names });
  if (d.verdict === 'cannot-tell') throw halt(d.reason);
  if (d.verdict === 'derive') {
    throw refuse(
      g['root-fingerprint']
        ? `${d.reason}; this garden is minted, and mint never overwrites an item (there is no --force)`
        : `${d.reason}, and garden.json names no root: an interrupted mint, or an item put here by another hand, ` +
            'and the tool cannot tell which, so it adopts neither (spec §4.1; nothing was derived, sealed or exported from it). ' +
            `The way out is yours: remove the orphan item with the keystore's own tool (service bon-sai.garden, account ${g.garden}/master-salt; ` +
            'Keychain Access, secret-tool clear, or the 1Password app), then run mint again. This tool never deletes a custody item, and mint never overwrites one; there is no --force.',
    );
  }
  if (!d.chosen)
    throw refuse(
      `no custody backend is available on this host (${ctx.names.join(', ')}). set up a keystore first: 1Password, or the OS's own.`,
    );
  floor(d.chosen, d.tier, !!ctx.f['lab-preview']);
  // The pot must be able to take the root before custody takes the salt: an item with no root is a
  // stuck garden (Fuji-shin, 2026-10-06). Rewrite garden.json as it is, through the same writer.
  try {
    writeJson(P.garden(ctx.pot), g);
  } catch (e) {
    throw refuse(
      `cannot write ${P.garden(ctx.pot)} (${e.code || 'error'}); the pot must be writable before anything goes into custody. Nothing written.`,
    );
  }
  const b = ctx.all[d.chosen];
  const raw = randomSalt();
  const hex = raw.toString('hex');
  raw.fill(0);
  try {
    await b.put(g.garden, hex);
  } catch (e) {
    throw custodyExit(e, 'mint');
  }
  let back;
  try {
    back = await b.get(g.garden);
  } catch (e) {
    throw halt(`custody fault: ${b.name} cannot read back what it was given (${e.code}); nothing was deleted`);
  }
  if (back !== hex)
    throw halt(`custody fault: ${b.name} read back something other than what it was given; nothing was deleted`);
  const root = keyOf(hex, rootSalt(g.garden));
  const lab = !!ctx.f['lab-preview'];
  Object.assign(g, {
    'root-fingerprint': root.fingerprint,
    'root-public-key': root.b64,
    'custody-tier': d.tier,
    'lab-preview': lab,
  });
  writeJson(P.garden(ctx.pot), g);
  sealRoot(hex, g, P.garden(ctx.pot));
  console.log(`root fingerprint: ${root.fingerprint}`);
  console.log(`custody: ${d.chosen} (${d.tier})`);
  if (d.tier === 'software-fallback')
    console.log(
      'LAB PREVIEW: the master salt rests on the software fallback, named as such; every attestation says so.',
    );
  console.log('next: recover export --out <a path off this machine>, then recover drill');
}

async function cmdRecover(ctx, sub) {
  const g = garden(ctx);
  needRoot(g);
  if (sub === 'export') {
    if (!ctx.f.out) throw usage('recover export needs --out <file>');
    const out = path.resolve(ctx.f.out);
    if (!fs.existsSync(path.dirname(out))) throw refuse(`${path.dirname(out)} does not exist; nothing written`);
    // by identity, not spelling: the out's directory and every directory above its real path, against the pot
    if (withinByInode(ctx.pot, path.dirname(out))) {
      throw refuse(
        'refusing to write the export inside the pot: a pot is a git repository, and the export does not belong in one',
      );
    }
    let taken = false;
    try {
      fs.lstatSync(out);
      taken = true;
    } catch {
      /* free */
    }
    if (taken) throw refuse(`${out} already exists; the export is written once and never overwritten`);
    const { hex } = await readMaster(ctx, g);
    const pass = await ctx.pp.askNew('export passphrase');
    const raw = Buffer.from(hex, 'hex');
    let env;
    try {
      env = sealEnvelope(raw, pass, g.garden);
    } finally {
      raw.fill(0);
    }
    env['root-fingerprint'] = g['root-fingerprint'];
    env.signature = signData(hex, rootSalt(g.garden), envelopePayload(env)).toString('base64');
    fs.writeFileSync(out, jsonText(env), { flag: 'wx', mode: 0o600 });
    console.log(`exported: ${out}`);
    console.log(
      'keep it off this machine (1Password as a document, a USB key, printed); where is yours to choose. next: recover drill',
    );
    return;
  }
  if (sub === 'drill') {
    const env = readExport(ctx.f.file);
    await drillWith(ctx, g, env, async (hex) => {
      g['recovery-drilled'] = today();
      writeJson(P.garden(ctx.pot), g);
      sealRoot(hex, g, P.garden(ctx.pot));
    });
    console.log(`ok  the export restores this garden's root (${g['root-fingerprint']})`);
    return;
  }
  if (sub === 'restore') {
    const env = readExport(ctx.f.file);
    const d = await detect({ pot: ctx.pot, all: ctx.all, names: ctx.names });
    const errored = d.rows.filter((r) => r.error);
    if (errored.length) throw halt(errored.map((r) => `${r.name}: ${r.error}`).join('; '));
    const holder = d.rows.find((r) => r.present === true);
    if (holder) throw refuse(`${holder.name} already holds an item for garden ${g.garden}; restore never overwrites`);
    const top = d.rows.filter((r) => r.available).sort((a, b) => RANK[b.tier] - RANK[a.tier])[0];
    if (!top)
      throw refuse(
        "no custody backend is available on this host. set up a keystore first: 1Password, or the OS's own.",
      );
    if (top.unlocked === false)
      throw halt(`${top.name} is locked; unlock it — this tool never steps down past a locked keystore`);
    floor(top.name, top.tier, !!ctx.f['lab-preview']);
    await drillWith(ctx, g, env, async (hex) => {
      try {
        await ctx.all[top.name].put(g.garden, hex);
      } catch (e) {
        throw custodyExit(e, 'restore');
      }
      const back = await ctx.all[top.name].get(g.garden);
      if (keyOf(back, rootSalt(g.garden)).fingerprint !== g['root-fingerprint'])
        throw halt('custody fault after restore; nothing was deleted');
    });
    console.log(`ok  restored into ${top.name} (${top.tier}); the root is this garden's (${g['root-fingerprint']})`);
    return;
  }
  throw usage('recover export | drill | restore');
}

async function cmdNamespace(ctx) {
  const g = garden(ctx);
  needRoot(g);
  if (!g['recovery-drilled'])
    throw refuse(
      'recovery first: recover export, then recover drill (mandatory before the namespace; a backup never restored is not a backup)',
    );
  if (g.namespace)
    throw refuse(`this garden already carries a namespace, ${g.namespace.kanji}; a namespace is searched once`);
  const ex = await reservedRule(ctx);
  const r = searchNamespace({ name: g.name, exclude: ex });
  if (!r) throw halt('no namespace within the search bound');
  const { hex } = await readMaster(ctx, g);
  const at = new Date().toISOString();
  g.namespace = { kanji: r.kanji, indices: r.indices, salt: r.salt, locked_at: at };
  writeJson(P.garden(ctx.pot), g);
  const locks = readLocks(ctx.pot);
  locks._garden = { name: g.name, garden: g.garden, salt: r.salt, indices: r.indices, kanji: r.kanji, locked_at: at };
  writeJson(P.locks(ctx.pot), locks);
  const pj = readJson(P.pot(ctx.pot)) || { garden: g.garden };
  pj.namespace = r.kanji;
  writeJson(P.pot(ctx.pot), pj);
  for (const p of [P.garden(ctx.pot), P.locks(ctx.pot), P.pot(ctx.pot)]) sealRoot(hex, g, p);
  console.log(`namespace: ${r.kanji}   ${r.salt}   ${JSON.stringify(r.indices)}`);
}

async function cmdIdentity(ctx, slug) {
  if (!slug) throw usage('identity <slug> --pot <dir> --pair 〇〇');
  if (!SLUG_RE.test(slug))
    throw refuse(
      `${JSON.stringify(slug)} is not a slug (^[a-z0-9][a-z0-9-]*$); the namespace rides in the salt, never in the slug`,
    );
  const g = garden(ctx);
  needRoot(g);
  if (!g.namespace) throw refuse('this garden has no namespace yet: run namespace first');
  if (slug === g.name) throw refuse('the root key carries no mark (fp-attests 0); it is derived, not searched');
  const n = ctx.f['fp-attests'] === undefined ? 2 : Number(ctx.f['fp-attests']);
  if (![1, 2].includes(n)) throw usage('--fp-attests is 1 or 2');
  const guardian = slug === GUARDIAN;
  let pick = null;
  if (ctx.f.pick !== undefined) {
    if (!/^[1-5]$/.test(String(ctx.f.pick)))
      throw refuse(
        `--pick is 1 to 5, the attempt the gardener chose; ${JSON.stringify(ctx.f.pick)} is not one (spec §7.3)`,
      );
    pick = Number(ctx.f.pick);
  }
  if (ctx.f.candidates && pick) throw usage('--candidates only prints the five; --pick locks one: not both');
  let pair = null;
  const ex = await reservedRule(ctx);
  if (guardian) {
    if (ctx.f.pair)
      throw refuse(
        `${GUARDIAN} does not choose a pair: the rite draws five allowed IDs and the gardener picks one (spec §7.1); run identity ${GUARDIAN} --candidates`,
      );
  } else {
    if (!ctx.f.pair) throw usage('identity needs --pair 〇〇, the two kanji the entity chose');
    try {
      pair = pairOf(ctx.f.pair);
    } catch (e) {
      throw usage(e.message);
    }
    const why = ex.reserved(pair);
    if (why) throw refuse(`${chars(pair)}: ${why}, in the first namespace; choose another`);
    const bon = bonFirst(pair); // spec §6.1, held here as well as in the search: two walls
    if (bon) throw refuse(`${chars(pair)}: ${bon}; choose another`);
  }
  const locks = readLocks(ctx.pot);
  if (locks.agents[slug])
    throw refuse(
      `${slug} is already locked in this garden (${locks.agents[slug].identity_kanji}); a lock is never searched twice`,
    );
  for (const [other, e] of Object.entries(locks.agents)) {
    if (pair && JSON.stringify(e.identity_pair) === JSON.stringify(pair))
      throw refuse(`${chars(pair)} is taken in this garden by ${other}; choose another`);
  }
  // spec §7.3 and §7.1: five attempts, public and deterministic (no key, no custody); the gardener picks one
  const five = attempts({
    slug,
    garden: g.name,
    pair,
    exclude: ex,
    count: 5,
    taken: Object.values(locks.agents).map((e) => e.identity_pair),
    nsFirstTwo: guardian ? g.namespace.indices.slice(0, 2) : null,
  });
  if (five.length < 5) throw halt('fewer than five attempts within the search bound');
  if (ctx.f.candidates) {
    console.log(
      `${slug}: five attempts${pair ? ` for ${chars(pair)}, the same two kanji each` : ', each a drawn allowed pair'}, its own two after:`,
    );
    for (const c of five) console.log(`  ${c.n}  ${c.kanji}   ${c.salt}`);
    console.log(
      `pick one with: identity ${slug}${pair ? ` --pair ${chars(pair)}` : ''} --pick <1-5>   (none pleases him: leave --pick out and the first stands, recorded as default)`,
    );
    return;
  }
  const id = pick ? five[pick - 1] : five[0];
  pair = id.pair;
  const { hex } = await readMaster(ctx, g);
  const say = (e) => console.log(describeEstimate(e));
  let sg;
  try {
    sg = await searchSigning({
      masterHex: hex,
      base: `${slug}@${g.name}-sign`,
      want: pair.slice(0, n),
      onEstimate: say,
      onTick: (t) => console.log(`signing search: ${Math.round(t.elapsed)} s elapsed`),
    });
  } catch (e) {
    if (e.code === 'SEARCH_CAP')
      throw halt(
        `${e.message}; nothing was written. Run identity ${slug} again (a new search is a new lottery), or choose another pair.`,
      );
    throw e;
  }
  if (!sg) throw halt('no signing salt within the search bound');
  const at = new Date().toISOString();
  locks.agents[slug] = {
    identity_salt: id.salt,
    identity_locked_at: at,
    identity_pair: pair,
    identity_kanji: chars(pair),
    identity_kanji_full: id.kanji,
    picked: pick || 'default',
    identity_tier: 'plain',
    signing_salt: sg.salt,
    signing_locked_at: new Date().toISOString(),
    fp_attests: n,
    namespace: g.namespace.kanji,
  };
  writeJson(P.locks(ctx.pot), locks);
  sealRoot(hex, g, P.locks(ctx.pot));
  console.log(
    `${slug}: ${id.kanji} (${pick ? `attempt ${pick}` : 'the first, picked: default'})   identity ${id.salt}   signing ${sg.salt}   fingerprint ${sg.fingerprint} (attests ${n})`,
  );
  console.log('mark: a plain mark, two chosen kanji; unrendered here (rendering is optional, spec Open)');
}

/** What a verb wrote without sealing, and the command that seals exactly those paths when they are staged. */
function unsealedNote(pot, paths) {
  console.log(`unsealed: ${paths.join(', ')}`);
  console.log(
    `next: git -C ${pot} add -- ${paths.join(' ')}  then  node ${path.relative(process.cwd(), fileURLToPath(import.meta.url)) || 'keys.mjs'} seal-staged --pot ${pot} --as <you> -- ${paths.join(' ')}`,
  );
}

async function cmdDerive(ctx, slug) {
  const all = ctx.f.all === true;
  if (all && slug) throw usage('derive takes a slug or --all, not both');
  if (!all && !slug) throw usage('derive <slug> --pot <dir>   or   derive --all --pot <dir>');
  const g = garden(ctx);
  needRoot(g);
  const locks = readLocks(ctx.pot);
  const slugs = all ? [g.name, ...Object.keys(locks.agents)] : [slug];
  // every slug is checked against the lock before custody is opened, so one bad name costs no unlock
  for (const sl of slugs) {
    if (sl !== g.name && !locks.agents[sl]?.signing_salt)
      throw refuse(`${sl} has no signing salt in this pot: run identity ${sl} first`);
  }
  const { hex } = await readMaster(ctx, g); // one unlock for the whole run
  const wrote = [];
  for (const sl of slugs) {
    let salt,
      n = 0,
      want = null;
    if (sl === g.name) salt = rootSalt(g.garden);
    else {
      const e = locks.agents[sl];
      salt = e.signing_salt;
      n = e.fp_attests;
      want = e.identity_pair;
    }
    const k = keyOf(hex, salt);
    if (n && fpIndices(k.fingerprint, n).join() !== want.slice(0, n).join()) {
      throw halt(
        `${sl}'s signing salt does not attest its pair under the salt in custody; the lock and the custody disagree`,
      );
    }
    const on = keyOnFile(ctx.pot, sl);
    if (on && !on.raw.equals(k.raw))
      throw refuse(`a different key is already on file for ${sl}; refusing to overwrite it`);
    if (!on) {
      writeKey(ctx.pot, sl, k.raw, k.fingerprint);
      for (const f of [`${sl}-public-key.bin`, `${sl}-fingerprint.txt`]) {
        const rel = `agents/${sl}/identity/${f}`;
        if (fs.existsSync(path.join(ctx.pot, rel))) wrote.push(rel);
      }
    }
    console.log(`${sl}: ${k.fingerprint}${on ? '   (already on file, the same)' : ''}`);
  }
  // Bonsai's gap 72: these are written unsealed, and the pot's own gate refuses an unsealed file. The seal-staged guard stays
  // (only named paths, never the whole index); the tool names what it wrote and the command that seals it.
  if (wrote.length) unsealedNote(ctx.pot, wrote);
}

// A ULID, generated and never typed (AGENTS.md): 48 bits of time then 80 of randomness, Crockford base32.
function ulid() {
  const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let t = Date.now(),
    head = '';
  for (let i = 0; i < 10; i++) {
    head = A[t % 32] + head;
    t = Math.floor(t / 32);
  }
  const r = crypto.randomBytes(10);
  let bits = '';
  for (const b of r) bits += b.toString(2).padStart(8, '0');
  let tail = '';
  for (let i = 0; i < 80; i += 5) tail += A[parseInt(bits.slice(i, i + 5), 2)];
  return head + tail;
}

async function cmdSeed(ctx) {
  const g = garden(ctx);
  needRoot(g);
  if (!g.namespace) throw refuse('this garden has no namespace yet: run namespace first');
  if (!ctx.f['bonsai-entry'])
    throw refuse("Bonsai's seed entry is an input, the origin garden's published key: --bonsai-entry <file>");
  let be;
  try {
    be = JSON.parse(fs.readFileSync(ctx.f['bonsai-entry'], 'utf8'));
  } catch (e) {
    throw refuse(`${ctx.f['bonsai-entry']} cannot be read (${e.code || 'not JSON'})`);
  }
  const beRaw = Buffer.from(be['public-key'] || '', 'base64');
  if (
    be.slug !== 'bonsai' ||
    beRaw.length !== 32 ||
    crypto.createHash('sha256').update(beRaw).digest('hex').slice(0, 32) !== be.fingerprint
  ) {
    throw refuse('the Bonsai entry is not a slug "bonsai" with a 32-byte public key whose fingerprint it states');
  }
  const vouched = await vouchBonsai(ctx, ctx.f['bonsai-entry'], be);
  const locks = readLocks(ctx.pot);
  const { hex } = await readMaster(ctx, g);
  const tier = g['custody-tier'];
  const entry = (slug, type, extra = {}) => {
    const salt = slug === g.name ? rootSalt(g.garden) : locks.agents[slug]?.signing_salt;
    if (!salt) throw refuse(`${slug} has no signing salt in this pot: run identity ${slug} first`);
    const on = keyOnFile(ctx.pot, slug);
    if (!on) throw refuse(`no key on file for ${slug}: run derive ${slug} first`);
    const k = keyOf(hex, salt);
    if (!on.raw.equals(k.raw))
      throw refuse(`the key on file for ${slug} does not derive from this garden's salt; refusing to seed`);
    return {
      slug,
      path: `agents/${slug}`,
      type,
      fingerprint: k.fingerprint,
      'fp-attests': slug === g.name ? 0 : locks.agents[slug].fp_attests,
      'custody-tier': tier,
      ...extra,
    };
  };
  const agents = [
    entry(g.name, 'garden', { shintai: 'none' }),
    entry(g.gardener, 'gardener'),
    {
      slug: 'bonsai',
      path: 'agents/bonsai',
      type: 'seed',
      origin: true,
      fingerprint: be.fingerprint,
      'fp-attests': be['fp-attests'] ?? 2,
      vouched,
    },
    entry('bonsai-shin', 'shin', { parent: 'bonsai' }),
    ...companionsOf(g).map((s) => entry(s, 'shin')),
  ];
  // The gardener's ruling, 2026-10-11 ("option 2"): a garden keeps ONE registry, in the origin's shape; the key fields
  // seed writes live inside each entry, and the display fields (name, pronouns, accent, one-line, tagline …) are
  // the garden's to fill. Seed writes the shape once, and on a second run accepts a registry whose key fields still
  // agree with what the keys say, leaving the display fields as they were.
  const shown = (a) => {
    if (a.slug === g.name) return { kanji: g.namespace.kanji, shintai: 'none' };
    if (a.slug === 'bonsai') return { kanji: be.kanji || null, shintai: 'origin' };
    const e = locks.agents[a.slug] || {};
    return {
      kanji: e.identity_kanji_full || e.identity_kanji || null,
      shintai: a.type === 'gardener' ? 'none' : 'own',
    };
  };
  const shaped = (a) => {
    const { kanji, shintai } = shown(a);
    const out = {
      slug: a.slug,
      name: a.slug,
      kanji,
      'kanji-chars': kanji ? [...kanji] : null,
      pronouns: null,
      type: a.type,
      shintai,
      parent: a.parent || null,
      principal: null,
      status: 'active',
      direction: null,
      guardian: null,
      element: null,
      fp8: a.fingerprint.slice(0, 8),
      fingerprint: a.fingerprint,
      'fp-attests': a['fp-attests'],
      'custody-tier': a['custody-tier'],
    };
    if (a.origin) {
      out.origin = true;
      out.vouched = a.vouched;
    }
    return { ...out, 'accent-rgba': null, 'mark-url': null, 'one-line': null, tagline: null, path: a.path };
  };
  const KEY_FIELDS = ['slug', 'type', 'fingerprint', 'fp-attests', 'custody-tier', 'parent', 'origin', 'path'];
  const reg = {
    $schema: 'https://bon-sai.garden/schemas/agent-registry-v1.json',
    _meta: {
      id: ulid(),
      description: `${g.name}: the garden's one registry, keys and roster together, in the origin garden's shape. Key fields as seed wrote them; the display fields are the garden's to fill.`,
      version: '1.0.0',
      created: today(),
      'tended-by': g.gardener,
      garden: g.garden,
    },
    garden: g.garden,
    agents: agents.map(shaped),
  };
  const existing = fs.existsSync(P.registry(ctx.pot)) ? fs.readFileSync(P.registry(ctx.pot), 'utf8') : null;
  let keep = false;
  if (existing !== null) {
    let was = null;
    try {
      was = JSON.parse(existing);
    } catch {
      /* other content: refused below */
    }
    const have = was && Array.isArray(was.agents) ? was.agents : null;
    // a second seed over the same registry: the origin vouched again; the record keeps the first answer's time
    const bonsaiWas = have?.find((x) => x.slug === 'bonsai');
    if (bonsaiWas && typeof bonsaiWas.vouched === 'string')
      agents.find((x) => x.slug === 'bonsai').vouched = bonsaiWas.vouched;
    const want = agents.map(shaped);
    const same =
      have &&
      have.length === want.length &&
      want.every((w) => {
        const h = have.find((x) => x.slug === w.slug);
        return (
          h && KEY_FIELDS.every((k) => (h[k] ?? null) === (w[k] ?? null)) && (!w.origin || h.vouched === w.vouched)
        );
      });
    if (!same)
      throw refuse(
        `${P.registry(ctx.pot)} already exists and its key fields (slug, type, fingerprint, fp-attests, custody-tier, parent, origin, path) do not match what the keys say; the seed writes a registry once and never over other content`,
      );
    keep = true; // display fields are the garden's: left exactly as they are
  }
  const bOn = keyOnFile(ctx.pot, 'bonsai');
  if (bOn && !bOn.raw.equals(beRaw)) throw refuse('a different Bonsai key is already on file in this pot');
  if (!bOn) writeKey(ctx.pot, 'bonsai', beRaw, be.fingerprint);
  if (!keep) writeJson(P.registry(ctx.pot), reg);
  sealRoot(hex, g, P.registry(ctx.pot));
  for (const a of agents)
    console.log(
      `${a.slug.padEnd(14)} ${a.type.padEnd(9)} ${a.fingerprint}  attests ${a['fp-attests']}${a.origin ? "  (the origin's key, an input)" : ''}`,
    );
  // F-21 (the gardener, 2026-10-15): every key-holder of this garden gets a home of their own, written with the roster
  const homes = plantHomes(ctx.pot, { reg: readJson(P.registry(ctx.pot)), g });
  if (homes.length) {
    console.log(`homes: ${homes.length} file(s) under home/, each its owner's to seal`);
    unsealedNote(ctx.pot, homes);
  }
}

async function cmdVerify(ctx) {
  if (ctx.f.keys !== 'pot')
    throw usage(
      "this skill verifies against a pot: --keys pot --pot <dir> --file <path> (the published keys are bonsai-garden-sign's verify)",
    );
  if (!ctx.f.file) throw usage('verify needs --file <path>');
  const file = path.resolve(ctx.f.file);
  if (!fs.existsSync(file)) throw refuse(`file not found: ${file}`);
  // the root is the named pot, never discovered by walking up from the file (spec §11)
  // a pot that declared its own rehearsal softens custody-fallback for ITS root only (pot-verdict.mjs); core's policy is untouched
  const { v, softened } = potVerdict(ctx.pot, file);
  const meta = v.meta || {};
  const reg = readJson(P.registry(ctx.pot));
  const entry = reg && (reg.agents || []).find((a) => a.slug === meta.signer);
  if (v.status === 'ok' || v.accepted === true) {
    console.log(`ok       ${file}${v.status !== 'ok' ? `  [${v.status}]` : ''}`);
    console.log(`  signer:      ${meta.signer} (${meta.role})`);
    console.log(`  fingerprint: ${meta.fingerprint}`);
    console.log(
      `  custody:     ${meta.custody || 'not declared in the seal'}; the registry says ${entry?.['custody-tier'] ? entry['custody-tier'] : 'nothing'}`,
    );
    if (softened) console.log(`  ${labNote(1)}`);
    return;
  }
  console.error(`FAIL     ${file}  [${v.status}]`);
  if (v.reason) console.error(`  why: ${v.reason}`);
  if (v.status === 'custody-refused') console.error(`  note: ${NOT_LAB_NOTE}`);
  throw new Exit(1, null);
}

async function cmdAttest(ctx) {
  const g = garden(ctx);
  needRoot(g);
  const reg = readJson(P.registry(ctx.pot));
  if (!reg) throw refuse('no registry in this pot: run seed first');
  const early = publicMaterialProblems({ g, reg });
  if (early.length) throw refuse(`${early[0].why}; nothing written`);
  if (Buffer.from(g['root-public-key'] || '', 'base64').length !== 32)
    throw refuse("garden.json's root-public-key is not 32 bytes of base64");
  const pick = (slug) => {
    const a = reg.agents.find((x) => x.slug === slug);
    if (!a) throw refuse(`the registry has no ${slug}`);
    return `    - { slug: ${a.slug}, fingerprint: ${a.fingerprint}, fp-attests: ${a['fp-attests']}${a.parent ? `, parent: ${a.parent}` : ''} }`;
  };
  const doc = [
    'garden-attestation:',
    `  garden: ${g.garden}`,
    `  name: ${g.name}`,
    `  namespace: ${g.namespace ? g.namespace.kanji : ''}`,
    `  root-fingerprint: ${g['root-fingerprint']}`,
    `  custody-tier: ${g['custody-tier']}`,
    `  lab-preview: ${g['lab-preview'] === true}`,
    '  keys:',
    pick(g.gardener),
    pick('bonsai-shin'),
    ...companionsOf(g).map(pick),
    '  rite: bunshin',
    `  created: ${today()}`,
    '',
  ].join('\n');
  const { hex } = await readMaster(ctx, g);
  const late = publicMaterialProblems({ g, reg, doc, hex });
  if (late.length) throw refuse(`${late[0].why}; nothing written`);
  const locks = readLocks(ctx.pot);
  const bs = locks.agents['bonsai-shin'];
  if (!bs) throw refuse('bonsai-shin has no signing salt: it seals the attestation');
  const att = P.attestation(ctx.pot);
  if (
    fs.existsSync(att) &&
    fs.readFileSync(att, 'utf8').replace(/created: .*\n/, '') !== doc.replace(/created: .*\n/, '')
  ) {
    throw refuse(`${att} already exists with other content`);
  }
  if (!fs.existsSync(att)) fs.writeFileSync(att, doc);
  const sidecar = sealWith(hex, bs.signing_salt, 'bonsai-shin', att, { custody: g['custody-tier'] });
  const sc = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
  writeJson(P.countersign(ctx.pot), {
    format: 'bonsai-garden-countersign/1',
    countersigns: path.basename(att),
    'seal-id': sc.id,
    'seal-hash': crypto.createHash('blake2b512').update(fs.readFileSync(sidecar)).digest('hex'),
  });
  sealRoot(hex, g, P.countersign(ctx.pot));
  const sent = await transport().send([att, sidecar, P.countersign(ctx.pot)]);
  console.log(`attestation: ${att}  sealed by bonsai-shin, countersigned by the root (${g.name})`);
  console.log(`custody-tier: ${g['custody-tier']}${g['lab-preview'] ? '  (LAB PREVIEW)' : ''}`);
  console.log(sent.sent ? `sent: ${sent.where}` : `not sent: ${sent.why}`);
}

// ── seal-staged: a commit's seals, with this garden's own keys (rt slice spec §7; the move down into core) ──

function gitIn(pot, args) {
  const r = spawnSync('git', ['-C', pot, ...args], { encoding: 'utf8' });
  if (r.error) throw halt(`git cannot run here (${r.error.code}); a check that cannot run is not a pass`);
  return r;
}
const zsplit = (out) => out.split('\0').filter(Boolean);
const stagedIn = (pot, filter = 'ACMR') =>
  zsplit(gitIn(pot, ['diff', '--cached', '--name-only', `--diff-filter=${filter}`, '-z']).stdout);
const fullyStaged = (pot, rel) => gitIn(pot, ['diff', '--quiet', '--', rel]).status === 0;
// in the index at all: `git diff --quiet` reads 0 for an UNTRACKED file, so an unstaged seal passed as staged (F-17, the kobun
// dry run, 2026-10-14: garden.json, the registry and the attestation would have been committed without their seals)
const tracked = (pot, rel) => gitIn(pot, ['ls-files', '--error-unmatch', '--', rel]).status === 0;
const isSidecar = (rel) => rel.endsWith('.bonsaisig');
const LAB_POLICY_NOTE = NOT_LAB_NOTE;

/** The owner gate: an owner seal on a file whose credit names someone else. */
function ownerProblem(pot, rel) {
  const found = findSidecar(path.join(pot, rel));
  if (!found.path) return null;
  let d;
  try {
    d = JSON.parse(fs.readFileSync(found.path, 'utf8'));
  } catch {
    return null;
  }
  if (d.format !== 'bonsaisig/2' || d.role !== 'owner') return null;
  let text = '';
  try {
    text = fs.readFileSync(path.join(pot, rel)).toString('utf8');
  } catch {
    /* bytes */
  }
  const [who] = creditInfo(text, rel);
  return who.size && !who.has(d.signer)
    ? `${rel}: an owner seal by ${d.signer}, but the file credits ${[...who].sort().join(', ')}`
    : null;
}

async function cmdSealStaged(ctx) {
  const { pot, f } = ctx;
  if (!fs.existsSync(path.join(pot, '.git')))
    throw refuse(`${pot} is not a git repository; seal-staged seals a pot's commit`);
  if (!readJson(P.registry(pot))) {
    throw refuse(
      'this pot has no agents/registry.json yet: nothing in it can be sealed or verified before the keys arc seeds it (seed); nothing written',
    );
  }
  const reg = readJson(P.registry(pot));
  if (f.check) {
    if (f.as || f['--']?.length)
      throw usage('seal-staged --check --pot <dir> takes no --as and no paths: it checks the whole commit');
    const staged = stagedIn(pot);
    const targets = new Set(staged.filter((r) => !isSidecar(r)));
    for (const sc of staged.filter(isSidecar)) {
      // a seal staged alone: its file is checked too
      try {
        const t = targetPathFor(path.join(pot, sc));
        if (t) targets.add(path.relative(pot, t).split(path.sep).join('/'));
      } catch (e) {
        targets.add(`${sc} (${e.message})`);
      }
    }
    const problems = [];
    let custodyRefused = 0,
      labSoftened = 0;
    for (const rel of [...targets].sort()) {
      const abs = path.join(pot, rel);
      if (!fs.existsSync(abs)) {
        problems.push(`${rel}: a seal is staged for a file that is not here`);
        continue;
      }
      if (!fullyStaged(pot, rel)) {
        problems.push(
          `${rel}: the working tree differs from what is staged; the gate verifies the staged bytes only when they are the file's`,
        );
        continue;
      }
      const { ok, v, softened } = potVerdict(pot, abs);
      if (softened) labSoftened++;
      if (!ok) {
        if (v.status === 'custody-refused') custodyRefused++;
        problems.push(`${rel}: its seal reads ${v.status}${v.reason ? ` (${v.reason})` : ''}`);
        continue;
      }
      const sc = findSidecar(abs);
      const scRel = sc.path ? path.relative(pot, sc.path).split(path.sep).join('/') : null;
      if (scRel && (!tracked(pot, scRel) || !fullyStaged(pot, scRel))) {
        problems.push(`${rel}: its seal ${scRel} is not staged as it is on disk (stage it: git add -- ${scRel})`);
        continue;
      }
      const op = ownerProblem(pot, rel);
      if (op) problems.push(op);
    }
    for (const p of problems) console.log(`  REFUSED ${p}`);
    console.log(`seal-staged --check: ${targets.size} staged · ${problems.length} refused`);
    if (labSoftened) console.log(`  ${labNote(labSoftened)}`);
    if (custodyRefused) console.log(`  note: ${LAB_POLICY_NOTE}`);
    if (problems.length) {
      console.log(
        `  fix: node ${path.relative(process.cwd(), fileURLToPath(import.meta.url)) || 'keys.mjs'} seal-staged --pot ${pot} --as <you> -- <the paths above>`,
      );
      throw new Exit(1, null);
    }
    return;
  }
  const slug = f.as;
  if (!slug) throw usage('seal-staged --pot <dir> --as <slug> -- <path> ... (or --check)');
  const g = garden(ctx);
  needRoot(g);
  const entry = (reg.agents || []).find((a) => a.slug === slug);
  if (!entry)
    throw refuse(`${slug} is not in this pot's registry; only a key the pot lists can seal here; nothing written`);
  if (entry.origin)
    throw refuse(
      `${slug}'s key is the origin's, and no one in this garden holds it; seal as yourself; nothing written`,
    );
  const locks = readLocks(pot);
  const salt = slug === g.name ? rootSalt(g.garden) : locks.agents[slug]?.signing_salt;
  if (!salt) throw refuse(`${slug} has no signing salt in this pot; nothing written`);
  const want = f['--'] || [];
  if (!want.length) {
    throw refuse(
      'name the paths you are committing: seal-staged --pot <dir> --as <you> -- <path> ... ' +
        "(the index may hold someone else's staged work; sealing it all would seal theirs in your name); nothing written",
    );
  }
  const inIndex = new Set(stagedIn(pot));
  const real = fs.realpathSync(pot);
  const targets = [],
    problems = [];
  for (const raw of want) {
    const abs = path.resolve(path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw));
    const cand = fs.existsSync(abs) ? abs : path.resolve(pot, raw);
    let rel;
    try {
      rel = path.relative(real, fs.realpathSync(cand)).split(path.sep).join('/');
    } catch {
      problems.push(`${raw}: not found`);
      continue;
    }
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      problems.push(`${raw}: outside this pot`);
      continue;
    }
    if (isSidecar(rel)) continue;
    if (!inIndex.has(rel)) {
      problems.push(`${rel}: not staged; stage it first, only what you commit is sealed`);
      continue;
    }
    if (!fullyStaged(pot, rel)) {
      problems.push(`${rel}: the working tree differs from what is staged; stage it whole`);
      continue;
    }
    try {
      prepareV2(path.join(pot, rel), {
        signer: slug,
        role: 'custodian',
        fingerprint: entry.fingerprint,
        timestamp: nowUtc(),
      });
    } catch (e) {
      problems.push(`${rel}: cannot be sealed (${String(e.message).split('\n')[0]})`);
      continue;
    } // core's own rules, asked before any write
    targets.push(rel);
  }
  if (problems.length) {
    // a refusal never writes
    for (const p of problems) console.log(`  REFUSED ${p}`);
    throw refuse(`${problems.length} path(s) refused; nothing sealed`);
  }
  const { hex } = await readMaster(ctx, g);
  if (keyOf(hex, salt).fingerprint !== entry.fingerprint) {
    throw halt(
      `${slug}'s key from this garden's salt is not the fingerprint the registry records; stopping, nothing sealed`,
    );
  }
  const created = new Set(stagedIn(pot, 'A'));
  const sealedNow = [];
  const warnPolicy = { ...readSealPolicy(), 'custody-fallback': 'warn' }; // did WE write a seal that holds? (acceptance is the gate's)
  for (const rel of targets) {
    const abs = path.join(pot, rel);
    if (potVerdict(pot, abs, warnPolicy).ok) {
      // a kept seal goes into the commit with its file, as a new one does (F-17): staging only the seals this run made left
      // every kept one untracked, and the commit would have carried the file without the seal it relies on
      const kept = findSidecar(abs).path;
      const addKept = kept ? gitIn(pot, ['add', '--', path.relative(pot, kept)]) : { status: 0 };
      if (addKept.status !== 0) throw halt(`git add failed for ${rel}'s seal: ${addKept.stderr.trim()}`);
      console.log(`  kept    ${rel}  (its seal already holds; staged with it)`);
      continue;
    }
    let text = '';
    try {
      text = fs.readFileSync(abs).toString('utf8');
    } catch {
      /* bytes */
    }
    // a file under agents/<x>/identity/ is <x>'s (Bonsai's gap 73): whoever else seals it holds it, and never owns it
    const idOwner = /^agents\/([^/]+)\/identity\//.exec(rel);
    const role = idOwner && idOwner[1] !== slug ? 'custodian' : sealRole(text, rel, slug, created.has(rel));
    // a seal has no default role (2026-09-24): say WHY this one, next to it (Mori-shin's note on a pot body's SKILL.md, 2026-10-11)
    const [who] = creditInfo(text, abs);
    const why =
      idOwner && idOwner[1] !== slug
        ? `a file under ${idOwner[1]}'s identity/ is ${idOwner[1]}'s; ${slug} holds it`
        : path.basename(rel) === 'SKILL.md' && !who.size && role === 'custodian'
          ? 'this SKILL.md credits what its identity document credits; none found at references/identity.md or memory/identity.md'
          : who.size
            ? `the file credits ${[...who].sort().join(', ')}`
            : created.has(rel) && role === 'owner'
              ? 'it credits no one and this change created it'
              : 'it credits no one';
    const side = sealWith(hex, salt, slug, abs, { custody: g['custody-tier'], role });
    const after = potVerdict(pot, abs, warnPolicy);
    if (!after.ok) throw halt(`${rel}: sealed, but the seal does not verify (${after.v.status}); stopping`);
    const add = gitIn(pot, ['add', '--', rel, path.relative(pot, side)]);
    if (add.status !== 0) throw halt(`git add failed for ${rel}: ${add.stderr.trim()}`);
    sealedNow.push(rel);
    console.log(
      `  sealed  ${rel}  ${role}: ${slug}  (${why})${g['custody-tier'] ? `  (custody ${g['custody-tier']})` : ''}`,
    );
  }
  console.log(`seal-staged: ${sealedNow.length} sealed · ${targets.length - sealedNow.length} kept`);
}

// ── stage 4: the garden's codex and covenant on record, and each kin's certificate (lib/covenant.mjs) ──

function potRegistry(ctx) {
  const reg = readJson(P.registry(ctx.pot));
  if (!reg) throw refuse('no agents/registry.json in this pot: run seed first');
  return reg;
}
const libExit = (e) => (e instanceof CovenantRefusal ? refuse(e.message) : e);

/** A kin's certificate (sponsor and agentic-teammate, one statement): who signs is asked before custody is opened. */
async function cmdCertificate(ctx, sub) {
  const g = garden(ctx),
    reg = potRegistry(ctx);
  const kinSlug = ctx.f.for;
  if (sub === 'verify') {
    let p;
    try {
      p = verifyCertificates(ctx.pot, { g, reg, only: kinSlug || null });
    } catch (e) {
      throw libExit(e);
    }
    for (const x of p) console.log(`  FAIL  ${x.check}: ${x.why}`);
    console.log(
      `certificate verify: ${p.length ? `${p.length} finding(s)` : `ok — ${kinSlug || 'every kin'}: sponsor and agentic-teammate signed one statement over the texts as they stand`}`,
    );
    if (p.length) throw new Exit(1, null);
    return;
  }
  if (sub !== 'sign')
    throw usage(
      'certificate sign --pot <dir> --for <kin> --as <the gardener | the kin> [--renew] · certificate verify --pot <dir> [--for <kin>]',
    );
  const slug = ctx.f.as;
  if (!kinSlug || !slug)
    throw usage('certificate sign --pot <dir> --for <kin> --as <the gardener | the kin> [--renew]');
  needRoot(g);
  let who;
  try {
    who = roleFor(kinSlug, slug, reg, g);
  } catch (e) {
    throw libExit(e);
  }
  const salt = readLocks(ctx.pot).agents[slug]?.signing_salt;
  if (!salt) throw refuse(`${slug} has no signing salt in this pot; nothing written`);
  const { hex } = await readMaster(ctx, g);
  try {
    const r = signCertificate(ctx.pot, { kin: kinSlug, slug, hex, salt, g, reg, renew: !!ctx.f.renew });
    const rel = passportRel(who.kin);
    if (!r.wrote) {
      console.log(`already signed: ${slug} signed ${kinSlug}'s certificate as the ${r.role}; nothing written`);
      return;
    }
    console.log(
      `signed  ${rel} as the ${r.role} (${slug}) · ${r.complete ? 'the certificate is complete: both sides signed' : `pending the ${r.role === 'sponsor' ? 'agentic-teammate' : 'sponsor'}`}`,
    );
    unsealedNote(ctx.pot, [rel]);
  } catch (e) {
    throw libExit(e);
  }
}

async function cmdCovenant(ctx, sub) {
  const g = garden(ctx),
    reg = potRegistry(ctx);
  try {
    if (sub === 'write') {
      const wrote = writeDocs(ctx.pot, { g, reg, signedName: ctx.f.name || null });
      if (!wrote.length) {
        console.log("covenant: lore/covenant.md and lore/codex.md are already this pot's; never overwritten");
        return;
      }
      for (const w of wrote) console.log(`wrote   ${w}`);
      unsealedNote(ctx.pot, wrote);
      return;
    }
  } catch (e) {
    throw libExit(e);
  }
  throw usage(
    'covenant write --pot <dir> [--name "<signed name>"]  (each kin\'s certificate: certificate sign|verify)',
  );
}

function cmdStatus(ctx) {
  const pot = ctx.pot;
  const g = readJson(P.garden(pot));
  const line = (done, what, detail) => console.log(`${done ? '✓' : '·'} ${what.padEnd(10)} ${detail}`);
  if (!g) {
    line(false, 'id', 'no garden.json');
    console.log('next: id');
    return;
  }
  const locks = readLocks(pot);
  const reg = readJson(P.registry(pot));
  const slugs = [g.name, g.gardener, 'bonsai-shin', ...companionsOf(g)];
  const derived = slugs.filter((s) => keyOnFile(pot, s));
  const steps = [
    ['id', true, `${g.garden} · ${g.name}`],
    [
      'mint',
      !!g['root-fingerprint'],
      g['root-fingerprint']
        ? `root ${g['root-fingerprint']} · custody ${g['custody-tier']}${g['lab-preview'] ? ' (LAB PREVIEW)' : ''}`
        : 'no root yet',
    ],
    ['recover', !!g['recovery-drilled'], g['recovery-drilled'] ? `drilled ${g['recovery-drilled']}` : 'not drilled'],
    ['namespace', !!g.namespace, g.namespace ? g.namespace.kanji : 'none'],
    [
      'identity',
      [g.gardener, ...companionsOf(g)].every((s) => locks.agents[s]) && !!locks.agents['bonsai-shin'],
      Object.entries(locks.agents)
        .map(([s, e]) => `${s} ${e.identity_kanji}`)
        .join(', ') || 'none',
    ],
    ['derive', derived.length === slugs.length, derived.join(', ') || 'none'],
    ['seed', !!reg, reg ? `${reg.agents.length} entries` : 'no registry'],
    [
      'attest',
      fs.existsSync(P.attestation(pot)),
      fs.existsSync(P.attestation(pot)) ? 'attestation written and sealed (transport open)' : 'no attestation',
    ],
  ];
  for (const [w, d, x] of steps) line(d, w, x);
  const next = steps.find(([, d]) => !d);
  console.log(next ? `next: ${next[0]}` : 'the arc is complete');
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main(argv, deps = {}) {
  if (!argv.length || argv[0] === '--help' || argv[0] === 'help') {
    console.log(USAGE);
    return 0;
  }
  const { pos, f } = parse(argv);
  const [verb, ...rest] = pos;
  const ctx = () => context(f, deps);
  switch (verb) {
    case 'detect':
      await cmdDetect(ctx());
      break;
    case 'custody':
      if (rest[0] !== 'status') throw usage('custody status --pot <dir>');
      await cmdDetect(ctx());
      break;
    case 'id':
      await cmdId(ctx());
      break;
    case 'mint':
      await cmdMint(ctx());
      break;
    case 'recover':
      await cmdRecover(ctx(), rest[0]);
      break;
    case 'namespace':
      await cmdNamespace(ctx());
      break;
    case 'identity':
      await cmdIdentity(ctx(), rest[0]);
      break;
    case 'derive':
      await cmdDerive(ctx(), rest[0]);
      break;
    case 'seed':
      await cmdSeed(ctx());
      break;
    case 'verify':
      await cmdVerify(ctx());
      break;
    case 'attest':
      await cmdAttest(ctx());
      break;
    case 'status':
      cmdStatus(ctx());
      break;
    case 'seal-staged':
      await cmdSealStaged(ctx());
      break;
    case 'install-runtime':
      await installRuntime(ctx(), { refuse, halt, usage, deps });
      break;
    case 'fill-bodies':
      await fillBodies(ctx(), {
        refuse,
        halt,
        usage,
        drift: () => new Exit(1, null),
        keysBin: fileURLToPath(import.meta.url),
      });
      break;
    case 'covenant':
      await cmdCovenant(ctx(), rest[0]);
      break;
    case 'certificate':
      await cmdCertificate(ctx(), rest[0]);
      break;
    default:
      throw usage(`unknown verb ${JSON.stringify(verb)}\n\n${USAGE}`);
  }
  return 0;
}

/** The binary. `deps.origin` is for a caller in process (the suites' fake site); a run from the shell gets the real one. */
export function cli(argv, deps = {}) {
  return main(argv, deps).then(
    (c) => {
      process.exitCode = c;
    },
    (e) => {
      if (e instanceof Exit) {
        if (e.message && e.message !== 'null') {
          const tag = e.exit === 2 ? 'refused' : e.exit === 3 ? 'halt' : e.exit === 64 ? 'usage' : 'error';
          console.error(`${tag}: ${e.message}`);
        }
        process.exitCode = e.exit;
        return;
      }
      // an unforeseen error: never its stack (it could carry a value), one redacted line, and a halt
      console.error(
        `halt: unexpected: ${
          String(e?.message || e)
            .replace(/[0-9a-fA-F]{32,}/g, '<redacted>')
            .split('\n')[0]
        }`,
      );
      process.exitCode = 3;
    },
  );
}
const direct = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (direct) cli(process.argv.slice(2));
