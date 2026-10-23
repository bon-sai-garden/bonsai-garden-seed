#!/usr/bin/env node
// ---
// id: 01M3F38BJSW50E9C883JQRRVFJ
// title: verify-envelope.mjs — check a seal envelope v2 yourself, without trusting the signer's code
// type: script
// tended-by: tasai
// created: 2026-09-26
// updated: 2026-10-16
// ---
//
// A standalone verifier for a seal envelope v2 (skills/bonsai-garden-sign/references/spec-seal-envelope.md).
// It uses only Node's built-in crypto and, optionally, `git`, and imports no garden code, so checking a
// signature doesn't depend on the code that made it. Read it before you run it; it is short on purpose.
//
//   node verify-envelope.mjs --envelope <doc>.envelope.json --doc <doc> --public-key <key.bin|key.pem>
//        [--fingerprint <32-hex or file>]         the signer's fingerprint, from a source you trust
//        [--reveal <where.json>]                  opens where.commit, if you hold the private reveal
//        [--repo <git dir> --commit <sha> --doc-path <path in repo>]   the doc as committed is these bytes
//
// The real check is --fingerprint from a trusted root. Without it, 3a only compares your key
// against the signer the envelope itself names.
//
// TAKE THE PUBLIC KEY FROM A SOURCE YOU TRUST, not from the envelope. A published trust root is
// best, and the signer's identity folder will do. The envelope's own copy of the key is only
// compared against yours; it is never used to verify.
//
// Every check prints PASS or FAIL, and the script exits 1 if any check fails.

import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const n = process.argv[i + 1];
    if (n && !n.startsWith('--')) {
      args[a.slice(2)] = n;
      i++;
    } else args[a.slice(2)] = true;
  }
}
const USAGE =
  'usage: verify-envelope.mjs --envelope <file> --doc <file> --public-key <file> [--fingerprint <hex|file>] [--reveal <file>] [--repo <dir> --commit <sha> --doc-path <path>]';
if (args.help || process.argv.includes('-h')) {
  console.log(`${USAGE}\n  (the header of this file says what each check does)`); // asked for: exit 0
  process.exit(0);
}
if (!args.envelope || !args.doc || !args['public-key']) {
  console.error(USAGE);
  process.exit(2);
}

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failed++;
};
const b2 = (buf) => crypto.createHash('blake2b512').update(buf).digest('hex');
// canonical JSON, as the spec defines it: sorted keys, no whitespace, UTF-8
const canon = (v) =>
  v === null || typeof v !== 'object'
    ? JSON.stringify(v)
    : Array.isArray(v)
      ? `[${v.map(canon).join(',')}]`
      : '{' +
        Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
          .join(',') +
        '}';

const env = JSON.parse(fs.readFileSync(args.envelope, 'utf8'));
const e = env.envelope;
if (e?.v !== 2) {
  check('0   envelope is v2', false, `v=${e?.v}`);
  process.exit(1);
}

// 1. The document is these exact bytes.
const doc = fs.readFileSync(args.doc);
check(
  '1a  document hashes to envelope.hash',
  e.hash && e.hash.alg === 'blake2b-512' && b2(doc) === e.hash.value,
  `${b2(doc).slice(0, 16)}…`,
);
const fm = doc.toString('utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
const docId = fm && (fm[1].match(/^id:\s*["']?([0-9A-HJKMNP-TV-Z]{26})["']?\s*$/m) || [])[1];
check(
  '1b  the envelope refers to this document by its frontmatter id',
  !!docId && docId === e.ref,
  docId ? `${docId} vs ${e.ref}` : 'no frontmatter id: found',
);
if (args.repo && args.commit && args['doc-path']) {
  const committed = execFileSync('git', ['-C', args.repo, 'show', `${args.commit}:${args['doc-path']}`]);
  check(`1c  document at commit ${args.commit} is the same bytes`, b2(committed) === e.hash.value);
}

// 2. The env-hash is exactly the envelope as written, with the domain prefix.
const envHash = b2(Buffer.from(`bonsai-seal-v2\n${canon(e)}`, 'utf8'));
check(
  '2   env-hash = blake2b-512("bonsai-seal-v2\\n" + canonical-json(envelope))',
  envHash === env['env-hash'],
  `${envHash.slice(0, 16)}…`,
);

// 3. The public key comes from YOUR source, and is matched against what the envelope names.
const kf = fs.readFileSync(args['public-key']);
let key;
try {
  key =
    kf.length === 32
      ? crypto.createPublicKey({
          key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), kf]),
          format: 'der',
          type: 'spki',
        })
      : crypto.createPublicKey(kf);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error(`a ${key.asymmetricKeyType} key, not ed25519`);
} catch (err) {
  const head = kf.toString('utf8', 0, 64);
  const hint = /TOMBSTONE/.test(head)
    ? ' (this file is a tombstone, not a key; use the raw 32-byte .bin beside it)'
    : '';
  check(
    '3   the --public-key file is an Ed25519 public key',
    false,
    `${args['public-key']}: ${String(err.message).split('\n')[0]}${hint}`,
  );
  console.log(`\n${failed} check(s) FAILED.`);
  process.exit(1);
}
const raw = key.export({ format: 'der', type: 'spki' }).subarray(-32);
const fpOfKey = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
check("3a  the key's fingerprint = the signer the envelope names", fpOfKey === e.signer?.fp, fpOfKey);
if (!args.fingerprint) console.log("NOTE  no --fingerprint given: 3a only matches the key to the envelope's own claim");
if (args.fingerprint) {
  const want = fs.existsSync(args.fingerprint)
    ? fs.readFileSync(args.fingerprint, 'utf8').trim()
    : String(args.fingerprint);
  check('3b  = the fingerprint from your trusted source', fpOfKey === want);
}
if (env['public-key-hex'])
  check('3c  the key the envelope carries is the same key', raw.toString('hex') === env['public-key-hex']);

// 4. The signature: Ed25519, under your key, over the 64 bytes of env-hash.
check(
  '4   signature verifies under the trusted key',
  crypto.verify(null, Buffer.from(envHash, 'hex'), key, Buffer.from(env.signature || '', 'base64')),
);

// 5. Optional: the private reveal opens the public place-commitment.
if (args.reveal) {
  const w = JSON.parse(fs.readFileSync(args.reveal, 'utf8'));
  check(
    '5   where.commit opens to the salt + location in the reveal',
    b2(Buffer.concat([Buffer.from(w.salt, 'hex'), Buffer.from(w.location, 'utf8')])) === e.where?.commit,
  );
}

// What the signature binds. Read it.
console.log(
  `\n    signer  ${e.signer?.slug} ${e.signer?.fp}\n    intent  ${e.intent?.kind}: "${e.intent?.purpose}"\n    at      ${e.at}\n    ref     ${e.ref}`,
);
for (const w of e.witnesses || [])
  console.log(`    witness ${w.slug} ${w.fp} (countersignatures are not checked by this tool yet)`);
console.log(failed ? `\n${failed} check(s) FAILED.` : '\nAll checks pass.');
process.exit(failed ? 1 : 0);
