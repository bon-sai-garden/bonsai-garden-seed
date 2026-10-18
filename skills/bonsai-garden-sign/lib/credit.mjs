// ---
// id: 01M3ACPFZ86B1W8Q7376KVGJ5C
// title: credit.mjs — who a file's own header credits (the Node twin of core's tools/credit.py)
// type: script
// tended-by: mori-shin
// created: 2026-09-24
// updated: 2026-09-24
// ---
/**
 * credit.mjs — who a file's own header credits: `tended-by:`, plus a letter's receiver (`to:`).
 *
 * The Node twin of core's tools/credit.py (the definition; this mirrors it rule for rule, and
 * tools/test-credit.py fails on any case where the two answer differently). Tasai's ruling,
 * 2026-09-24: a seal has NO DEFAULT ROLE. Without --role, `owner` is inferred only when the
 * file's credit names the signer; anything else refuses — a default is how a custodial seal
 * became a public authorship claim (the Aruji's tombstone, re-sealed `tasai · owner`).
 *
 *   node lib/credit.mjs <file> [<file> ...]   one JSON line per file: {"file", "credit"}
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isCard } from './ulid-rule.mjs';

const MD_EXT = ['.md', '.markdown'];
const SCRIPT_EXT = ['.py', '.sh', '.mjs', '.js', '.ts', '.cjs', '.bash', '.zsh', '.rb'];
const PREFIX = /^[ \t]*(?:#|\/\/|\*|--|;)?[ \t]?/;
const KEY = /^([A-Za-z][\w-]*)[ \t]*:[ \t]*(.*)$/;
const SLUG = /[a-z][a-z0-9]*(?:-[a-z0-9]+)*/;
const MARKER = /^[ \t]*(?:#|\/\/|\*)[ \t]*---[ \t]*$/;

const endsWithAny = (s, exts) => exts.some((e) => s.endsWith(e));

export function header(text, rel) {
  if (text.startsWith('﻿')) text = text.slice(1);
  const lines = text.split('\n');
  const low = rel.toLowerCase();
  const strip = (l) => l.replace(/\r$/, '');
  if (endsWithAny(low, MD_EXT)) {
    if (!lines.length || lines[0].trimEnd() !== '---') return null;
    for (let i = 1; i < lines.length; i++) if (lines[i].trimEnd() === '---') return lines.slice(1, i).map(strip);
    return null;
  }
  if (endsWithAny(low, SCRIPT_EXT)) {
    let start = null;
    for (let i = 0; i < Math.min(lines.length, 60); i++) {
      if (MARKER.test(strip(lines[i]))) {
        if (start === null) start = i;
        else return lines.slice(start + 1, i).map((x) => strip(x).replace(PREFIX, ''));
      }
    }
  }
  return null;
}

export function fields(head) {
  const out = {};
  let cur = null;
  for (const l of head) {
    const m = KEY.exec(l);
    if (m) {
      cur = m[1].toLowerCase();
      const v = m[2].trim();
      out[cur] = v ? v.split(/[,[\]]/).filter((x) => x.trim()) : [];
    } else if (cur && /^\s*-\s+/.test(l)) {
      out[cur].push(l.replace(/^\s*-\s+/, ''));
    } else if (l.trim() && !(l.startsWith(' ') || l.startsWith('\t'))) {
      cur = null;
    }
  }
  return out;
}

export function slug(raw) {
  const m = SLUG.exec(
    raw
      .trim()
      .replace(/^['"]+|['"]+$/g, '')
      .toLowerCase(),
  );
  return m ? m[0] : null;
}

// A lean SKILL.md credits what its identity document credits (Mori-shin, 2026-09-24): the first
// of these beside it that exists. Mirrors credit.py's SKILL_IDENTITY.
export const SKILL_IDENTITY = ['references/identity.md', 'memory/identity.md'];

/** The set of kin slugs the file's own header credits (see creditInfo). */
export function credit(text, rel, root = null) {
  return creditInfo(text, rel, root)[0];
}

/** [names, conflict]: the twin of credit.py's credit_info. `root`: what `rel` is relative to,
 *  used only to find a SKILL.md's identity document. */
export function creditInfo(text, rel, root = null) {
  if (path.basename(rel) === 'SKILL.md') {
    const base = path.dirname(root ? path.join(root, rel) : rel);
    for (const cand of SKILL_IDENTITY) {
      const f = path.join(base, cand);
      if (fs.existsSync(f) && fs.statSync(f).isFile()) {
        try {
          return creditInfo(new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(f)), f);
        } catch {
          return [new Set(), false];
        }
      }
    }
    return [new Set(), false];
  }
  const parts = rel.split(/[\\/]/);
  // anything delivered to an inbox, header or none: the inbox names its receiver (Tasai), checked
  // before the header (Fuji-shin: a header-less file in an inbox credited no one)
  const i = parts.slice(0, -1).indexOf('inbox');
  if (i >= 1) {
    const r = slug(parts[i - 1]);
    return [r ? new Set([r]) : new Set(), false];
  } // through slug() (Mori-shin)
  const head = header(text, rel);
  if (!head) return [new Set(), false];
  const f = fields(head);
  // an outbox is a letter location like an inbox (Tasai, mono 36d252d4): whatever its type:
  const letter = (f.type || []).some((v) => slug(v) === 'letter') || parts.slice(0, -1).includes('outbox');
  if (letter) {
    // the Aruji, 2026-09-25: "a letter is owned by the receiver" — its receiver only: never its
    // sender, never a cc: (Mori-shin), not its tended-by (on a letter, who wrote it); outside an
    // inbox its to:, or addressed-to:.
    const out = new Set([...(f.to || []), ...(f['addressed-to'] || [])].map(slug));
    out.delete(null);
    return [out, false];
  }
  const names = (...keys) => {
    const s = new Set(keys.flatMap((k) => (f[k] || []).map(slug)));
    for (const x of [null, 'null', 'none']) s.delete(x);
    return s;
  };
  // a kanban card: assignee:, else lead: (Tasai, 2026-09-25), by the card schema that exempts its
  // id (ulid-rule.mjs isCard, imported, not copied)
  const id = (f.id || [])[0];
  if (id !== undefined && isCard(id.trim().replace(/^['"]+|['"]+$/g, ''), rel)) {
    const a = names('assignee');
    return [a.size ? a : names('lead'), false];
  }
  // the credit fields, strongest first: tended-by; author/authors/written-by; from: (not a letter).
  // tended-by and authorship both naming kin and sharing none: both credited, conflict (held)
  const tb = names('tended-by');
  const w = names('author', 'authors', 'written-by');
  if (tb.size && w.size) {
    const shared = [...tb].some((x) => w.has(x));
    return [new Set([...tb, ...w]), !shared];
  }
  if (tb.size) return [tb, false];
  if (w.size) return [w, false];
  return [names('from'), false];
}

export function isLetter(text, rel) {
  const dirs = rel.split(/[\\/]/).slice(0, -1);
  if (dirs.includes('inbox') || dirs.includes('outbox')) return true;
  const head = header(text, rel);
  return !!head && (fields(head).type || []).some((v) => slug(v) === 'letter');
}

/** The role when none is given — the twin of credit.py's seal_role (Tasai, 2026-09-25): the file
 *  credits the signer → owner; it credits no one and this change created it → owner (a letter
 *  naming no receiver is held); otherwise → custodian. Never a refusal. */
export function sealRole(text, rel, signer, created = false) {
  const [who, conflict] = creditInfo(text, rel);
  if (conflict) return 'custodian'; // tended-by and authorship disagree: held until settled
  if (who.size) return who.has(signer) ? 'owner' : 'custodian';
  return created && !isLetter(text, rel) ? 'owner' : 'custodian';
}

/** [role, how] for a seal: an explicit role stands (a deliberate claim); none → sealRole. */
export function resolveRole(file, signer, role, created = false) {
  if (role !== undefined && role !== null) {
    if (role !== 'owner' && role !== 'custodian')
      throw new Error(`--role must be owner or custodian, not ${JSON.stringify(role)}`);
    return [role, 'given'];
  }
  let text = '';
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(file));
  } catch {
    text = '';
  }
  const r = sealRole(text, file, signer, created);
  const who = [...credit(text, file)].sort();
  if (r === 'owner')
    return [
      r,
      who.length
        ? `inferred: the file credits ${signer}`
        : 'inferred: the file credits no one, and this change created it',
    ];
  return [
    r,
    `inferred: the file credits ${who.length ? who.join(', ') : 'no one'}, so ${signer} holds it as custodian`,
  ];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const f of process.argv.slice(2)) {
    let text = '';
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(f));
    } catch {
      text = '';
    }
    const [who, conflict] = creditInfo(text, f);
    console.log(JSON.stringify({ file: f, credit: [...who].sort(), conflict }));
  }
}
