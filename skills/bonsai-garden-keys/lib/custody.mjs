// ---
// id: 01M498HCJV7QPNFE0R9ZBJ2A1C
// title: Garden-scoped custody for a master salt, get put status, and detect
// type: script
// tended-by: baisai
// created: 2026-10-06
// updated: 2026-10-06
// ---
//
// custody.mjs — spec-gardeners-keys.md §3: one item per garden per host, four backends behind one
// interface, and `detect`, which reads the tier at run time and never from the OS's name.
//
//   get(garden)       → 64 hex, or throws NOT_PROVISIONED / LOCKED / UNAVAILABLE (never '')
//   put(garden, hex)  → writes; throws EXISTS if the item holds anything (before a byte is written);
//                       reads back and compares, CUSTODY_FAULT if the store gave back something else
//   status(garden)    → { available, present, unlocked }   (unlocked: true | false | null = unknown)
//
// Item: service `bon-sai.garden`, account `<garden-ulid>/master-salt` (§3.1). No `--force`, no
// delete, no overwrite, anywhere in this file.
//
// THE SALT NEVER GOES ON ARGV. macOS: `security -i` reads the add command from stdin. Linux:
// `secret-tool store` reads the secret from stdin. 1Password: `op item create` reads a JSON template
// from stdin. A child's stdout and stderr never reach an error message unredacted.
//
// NO PROMPTS. Every child has a timeout; a keystore that waits on a dialog is reported as
// UNAVAILABLE, which `detect` turns into a halt. The macOS backend never asks a locked keychain
// anything (`show-keychain-info` on a locked keychain raises a SecurityAgent dialog: found
// 2026-10-06, on the gardener's screen); it reports `unlocked: null` and lets `get` speak.
//
// Not here: Windows DPAPI (a stub through this arc, spec Open); the legacy item of the origin
// garden (`Bonsai Garden Master Salt`), which this file never names, reads or writes: the gate's
// `--garden` and its legacy fallback are Mori-shin's (spec §12).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { AssuranceTier } from '../../bonsai-garden-sign/lib/custody-provider.mjs';
import { sealEnvelope, openEnvelope } from './envelope.mjs';

/** The tier vocabulary, §3.3: sign's three, plus vault-cli. */
export const Tier = Object.freeze({ ...AssuranceTier, VAULT_CLI: 'vault-cli' });
export const RANK = Object.freeze({ hardware: 4, 'os-protected': 3, 'vault-cli': 2, 'software-fallback': 1 });
/** §3.4, ruled 2026-10-06 (spec 0.1.2): vault-cli passes; the fallback alone does not. */
export const FLOOR = Tier.VAULT_CLI;
export const SERVICE = 'bon-sai.garden';
export const account = (garden) => `${garden}/master-salt`;
const HEX64 = /^[0-9a-f]{64}$/;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const TIMEOUT_MS = 20000;

export class CustodyError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const redact = (s) =>
  String(s || '')
    .replace(/[0-9a-fA-F]{32,}/g, '<redacted>')
    .split('\n')[0]
    .slice(0, 200);

function checkGarden(g) {
  if (!ULID.test(g || '')) throw new CustodyError('BAD_GARDEN', `not a garden ULID: ${JSON.stringify(g)}`);
}
function checkHex(hex) {
  if (!HEX64.test(hex || '')) throw new CustodyError('BAD_VALUE', 'a master salt is 64 lowercase hex characters');
}

function run(bin, args, { env, input } = {}) {
  const r = spawnSync(bin, args, {
    env,
    input,
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (r.error && r.error.code === 'ENOENT') return { missing: true };
  if (r.error) {
    throw new CustodyError(
      'UNAVAILABLE',
      `${path.basename(bin)} did not answer within ${TIMEOUT_MS / 1000}s ` +
        `(${r.error.code || 'error'}); a keystore waiting on a prompt is not one this tool will wait for`,
    );
  }
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/** Put, then read back once and compare (§3.2). A store that gave back other bytes is a finding. */
async function putChecked(b, garden, hex, write) {
  checkGarden(garden);
  checkHex(hex);
  const st = await b.status(garden);
  if (st.present)
    throw new CustodyError(
      'EXISTS',
      `${b.name} already holds an item for garden ${garden}; nothing was written (there is no --force)`,
    );
  if (st.unlocked === false) throw new CustodyError('LOCKED', `${b.name} is locked; unlock it and run again`);
  await write();
  let back;
  try {
    back = await b.get(garden);
  } catch (e) {
    throw new CustodyError(
      'CUSTODY_FAULT',
      `custody fault: ${b.name} accepted the write but cannot read it back (${e.code}); nothing was deleted`,
    );
  }
  if (back !== hex)
    throw new CustodyError(
      'CUSTODY_FAULT',
      `custody fault: ${b.name} read back something other than what it was given; nothing was deleted`,
    );
}

// ── macOS Keychain (os-protected) ────────────────────────────────────────────

function macosKeychain({ env, keychain, securityBin = 'security' }) {
  const kc = keychain ? [keychain] : [];
  const q = (s) => `"${String(s).replace(/(["\\])/g, '\\$1')}"`;
  const b = {
    name: 'macos-keychain',
    tier: Tier.OS_PROTECTED,
    describe: keychain ? `macOS Keychain file ${keychain}` : 'macOS Keychain (the login keychain)',
    async status(garden) {
      if (garden) checkGarden(garden);
      const r = run(
        securityBin,
        ['find-generic-password', '-a', account(garden || '00000000000000000000000000'), '-s', SERVICE, ...kc],
        { env },
      );
      if (r.missing) return { available: false, present: false, unlocked: null };
      if (r.code === 0) return { available: true, present: !!garden, unlocked: null };
      if (r.code === 44) return { available: true, present: false, unlocked: null };
      throw new CustodyError('UNAVAILABLE', `security answered ${r.code}: ${redact(r.stderr)}`);
    },
    async get(garden) {
      checkGarden(garden);
      const r = run(securityBin, ['find-generic-password', '-a', account(garden), '-s', SERVICE, '-w', ...kc], { env });
      if (r.missing) throw new CustodyError('UNAVAILABLE', 'no `security` binary on this host');
      if (r.code === 44) throw new CustodyError('NOT_PROVISIONED', `no item for garden ${garden} in ${b.describe}`);
      if (r.code !== 0) throw new CustodyError('UNAVAILABLE', `security answered ${r.code}: ${redact(r.stderr)}`);
      const v = r.stdout.trim();
      if (!HEX64.test(v))
        throw new CustodyError('UNAVAILABLE', `the item for garden ${garden} does not hold 64 hex characters`);
      return v;
    },
    async put(garden, hex) {
      await putChecked(b, garden, hex, async () => {
        // no -U: `security` itself refuses a duplicate, beneath our own EXISTS check
        const line = `add-generic-password -a ${q(account(garden))} -s ${q(SERVICE)} -w ${hex}${keychain ? ` ${q(keychain)}` : ''}\n`;
        const r = run(securityBin, ['-i'], { env, input: line });
        if (r.missing || r.code !== 0)
          throw new CustodyError('UNAVAILABLE', `security could not write the item (exit ${r.code})`);
      });
    },
  };
  return b;
}

// ── Linux Secret Service over secret-tool (os-protected) ─────────────────────

const SS_ABSENT =
  /autolaunch D-Bus|org\.freedesktop\.secrets was not provided|Cannot spawn a message bus|Could not connect|Failed to connect|No such interface|ServiceUnknown/i;
const SS_LOCKED = /locked/i;

function secretService({ env, bin = 'secret-tool' }) {
  const attrs = (garden) => ['service', SERVICE, 'account', account(garden)];
  const b = {
    name: 'secret-service',
    tier: Tier.OS_PROTECTED,
    describe: 'Linux Secret Service (secret-tool; needs a running keyring daemon and an unlocked collection)',
    async status(garden) {
      if (garden) checkGarden(garden);
      const r = run(bin, ['lookup', ...attrs(garden || '00000000000000000000000000')], { env });
      if (r.missing) return { available: false, present: false, unlocked: null, note: 'secret-tool not installed' };
      // the secret, if printed, is dropped here: status never keeps it
      if (r.code === 0) return { available: true, present: !!garden, unlocked: true };
      if (SS_ABSENT.test(r.stderr))
        return { available: false, present: false, unlocked: null, note: 'no Secret Service on the session bus' };
      if (SS_LOCKED.test(r.stderr)) return { available: true, present: null, unlocked: false };
      if (r.code === 1 && !r.stderr.trim()) return { available: true, present: false, unlocked: true };
      throw new CustodyError('UNAVAILABLE', `secret-tool answered ${r.code}: ${redact(r.stderr)}`);
    },
    async get(garden) {
      checkGarden(garden);
      const r = run(bin, ['lookup', ...attrs(garden)], { env });
      if (r.missing) throw new CustodyError('UNAVAILABLE', 'secret-tool is not installed');
      if (r.code === 0) {
        const v = r.stdout.trim();
        if (!HEX64.test(v))
          throw new CustodyError('UNAVAILABLE', `the item for garden ${garden} does not hold 64 hex characters`);
        return v;
      }
      if (SS_LOCKED.test(r.stderr)) throw new CustodyError('LOCKED', 'the Secret Service collection is locked');
      if (r.code === 1 && !r.stderr.trim())
        throw new CustodyError('NOT_PROVISIONED', `no item for garden ${garden} in the Secret Service`);
      throw new CustodyError('UNAVAILABLE', `secret-tool answered ${r.code}: ${redact(r.stderr)}`);
    },
    async put(garden, hex) {
      await putChecked(b, garden, hex, async () => {
        const r = run(bin, ['store', `--label=Bonsai Garden master salt (${garden})`, ...attrs(garden)], {
          env,
          input: hex,
        });
        if (r.missing || r.code !== 0) {
          throw new CustodyError(
            SS_LOCKED.test(r.stderr || '') ? 'LOCKED' : 'UNAVAILABLE',
            `secret-tool could not store the item (exit ${r.code}): ${redact(r.stderr)}`,
          );
        }
      });
    },
  };
  return b;
}

// ── 1Password over op (vault-cli) ────────────────────────────────────────────
// Built against the CLI's documented grammar and tested against a fake; the first live run on a
// real `op` is owed (no 1Password CLI on the build host, and the real vault is not touched).

function onePassword({ env, bin = 'op', vault = 'Bonsai Garden' }) {
  const b = {
    name: 'op',
    tier: Tier.VAULT_CLI,
    describe: `1Password vault "${vault}" over the op CLI (the bytes transit op and its session)`,
    async status(garden) {
      if (garden) checkGarden(garden);
      const who = run(bin, ['whoami'], { env });
      if (who.missing) return { available: false, present: false, unlocked: null, note: 'op not installed' };
      if (who.code !== 0) return { available: true, present: null, unlocked: false, note: 'signed out' };
      if (!garden) return { available: true, present: false, unlocked: true };
      const r = run(bin, ['item', 'get', account(garden), '--vault', vault, '--format', 'json'], { env });
      if (r.code === 0) return { available: true, present: true, unlocked: true };
      if (/isn't an item|not found|no item/i.test(r.stderr)) return { available: true, present: false, unlocked: true };
      throw new CustodyError('UNAVAILABLE', `op answered ${r.code}: ${redact(r.stderr)}`);
    },
    async get(garden) {
      checkGarden(garden);
      const r = run(bin, ['item', 'get', account(garden), '--vault', vault, '--fields', 'label=password', '--reveal'], {
        env,
      });
      if (r.missing) throw new CustodyError('UNAVAILABLE', 'op is not installed');
      if (r.code !== 0) {
        if (/isn't an item|not found/i.test(r.stderr))
          throw new CustodyError('NOT_PROVISIONED', `no item for garden ${garden} in vault ${vault}`);
        if (/not currently signed in|signed out|session expired/i.test(r.stderr))
          throw new CustodyError('LOCKED', 'op is signed out');
        throw new CustodyError('UNAVAILABLE', `op answered ${r.code}: ${redact(r.stderr)}`);
      }
      const v = r.stdout.trim();
      if (!HEX64.test(v))
        throw new CustodyError('UNAVAILABLE', `the item for garden ${garden} does not hold 64 hex characters`);
      return v;
    },
    async put(garden, hex) {
      await putChecked(b, garden, hex, async () => {
        const template = JSON.stringify({
          title: account(garden),
          category: 'PASSWORD',
          fields: [{ id: 'password', type: 'CONCEALED', purpose: 'PASSWORD', label: 'password', value: hex }],
        });
        const r = run(bin, ['item', 'create', '--vault', vault], { env, input: template });
        if (r.missing || r.code !== 0)
          throw new CustodyError('UNAVAILABLE', `op could not create the item (exit ${r.code}): ${redact(r.stderr)}`);
      });
    },
  };
  return b;
}

// ── the software fallback (software-fallback; --lab-preview only, enforced by the caller) ────

function fileFallback({ home, passphrase }) {
  const dir = path.join(home, '.bonsai-garden', 'custody');
  const file = (garden) => path.join(dir, `${garden}.salt.sealed`);
  let cached = null; // one passphrase per process: put then read-back must not ask three times
  const b = {
    name: 'file',
    tier: Tier.SOFTWARE_FALLBACK,
    describe: `passphrase-wrapped file under ${dir} (scrypt + AES-256-GCM; the recovery envelope)`,
    async status(garden) {
      if (garden) checkGarden(garden);
      return { available: true, present: garden ? fs.existsSync(file(garden)) : false, unlocked: true };
    },
    async get(garden) {
      checkGarden(garden);
      if (!fs.existsSync(file(garden)))
        throw new CustodyError('NOT_PROVISIONED', `no fallback file for garden ${garden}`);
      if (!passphrase)
        throw new CustodyError('LOCKED', 'the fallback file needs a passphrase, and none can be asked here');
      const env = JSON.parse(fs.readFileSync(file(garden), 'utf8'));
      if (cached === null) cached = await passphrase.ask('custody passphrase (the fallback file)');
      let raw;
      try {
        raw = openEnvelope(env, cached, garden);
      } catch {
        cached = null;
        throw new CustodyError('LOCKED', 'the passphrase does not open the fallback file');
      }
      try {
        return raw.toString('hex');
      } finally {
        raw.fill(0);
      }
    },
    async put(garden, hex) {
      await putChecked(b, garden, hex, async () => {
        if (!passphrase)
          throw new CustodyError('LOCKED', 'the fallback file needs a passphrase, and none can be asked here');
        cached = await passphrase.askNew('new custody passphrase (the fallback file)');
        const raw = Buffer.from(hex, 'hex');
        let env;
        try {
          env = sealEnvelope(raw, cached, garden);
        } finally {
          raw.fill(0);
        }
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        fs.chmodSync(dir, 0o700);
        fs.writeFileSync(file(garden), `${JSON.stringify(env, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
      });
    },
  };
  return b;
}

// ── the set, and detect ──────────────────────────────────────────────────────

export function backends({
  env = process.env,
  keychain = null,
  securityBin,
  opVault,
  home = os.homedir(),
  passphrase = null,
} = {}) {
  return {
    'macos-keychain': macosKeychain({ env, keychain, securityBin }),
    'secret-service': secretService({ env }),
    op: onePassword({ env, vault: opVault || undefined }),
    file: fileFallback({ home, passphrase }),
  };
}

/** What this platform offers, highest tier first. Windows DPAPI: a stub through this arc. */
export function offered(platform = process.platform) {
  if (platform === 'darwin') return ['macos-keychain', 'op', 'file'];
  if (platform === 'linux') return ['secret-service', 'op', 'file'];
  return ['op', 'file'];
}

function readJson(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

/**
 * §2 row 0 and §3.2. Verdicts: mint · derive · cannot-tell (with the reason).
 *   cannot tell: a backend errored; pot.json and garden.json disagree; two backends hold the item;
 *                garden.json names a root and no backend holds its salt (unreachable is not absent);
 *                the highest available keystore is locked (never step down past it).
 */
export async function detect({ pot, all, names }) {
  const g = pot ? readJson(path.join(pot, 'garden.json')) : null;
  const pj = pot ? readJson(path.join(pot, 'pot.json')) : null;
  const garden = g ? g.garden : null;
  const rows = [];
  for (const n of names) {
    const b = all[n];
    try {
      rows.push({ name: n, tier: b.tier, ...(await b.status(garden)) });
    } catch (e) {
      rows.push({ name: n, tier: b.tier, error: e.message });
    }
  }
  const out = (verdict, reason, extra = {}) => ({ verdict, reason, rows, garden, ...extra });
  const errored = rows.filter((r) => r.error);
  if (errored.length) return out('cannot-tell', `${errored.map((r) => `${r.name}: ${r.error}`).join('; ')}`);
  if (pj && g && pj.garden !== g.garden)
    return out('cannot-tell', `pot.json names garden ${pj.garden}, garden.json ${g.garden}`);
  if (pj && !g)
    return out(
      'cannot-tell',
      `pot.json names garden ${pj.garden} and this pot has no garden.json: unreachable is not absent`,
    );

  const usable = rows.filter((r) => r.available).sort((a, b) => RANK[b.tier] - RANK[a.tier]);
  const top = usable[0] || null;
  const holders = rows.filter((r) => r.present === true);
  if (garden && holders.length > 1)
    return out('cannot-tell', `two custody items for garden ${garden} (${holders.map((r) => r.name).join(', ')})`);
  if (garden && holders.length === 1)
    return out('derive', `${holders[0].name} holds garden ${garden}'s item`, {
      holder: holders[0].name,
      tier: holders[0].tier,
    });
  if (garden && g['root-fingerprint']) {
    return out(
      'cannot-tell',
      `garden.json names root ${g['root-fingerprint']}, and no offered backend holds its salt: unreachable is not absent (restore it from the sealed export)`,
    );
  }
  if (top && top.unlocked === false)
    return out(
      'cannot-tell',
      `${top.name} (${top.tier}) is locked; unlock it — this tool never steps down past a locked keystore`,
    );
  if (!top)
    return out(
      'mint',
      garden ? 'no item for this garden, and no backend to put one in' : 'no garden here yet (run id first)',
      { chosen: null },
    );
  return out(
    'mint',
    garden ? `no item for garden ${garden} on any offered backend` : 'no garden here yet: run id, then mint',
    { chosen: top.name, tier: top.tier },
  );
}

export const randomSalt = () => crypto.randomBytes(32);
