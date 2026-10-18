// ---
// id: 01M4Z2BTQY3M56D8TKAB44G2MA
// title: covenant — stage 4 of the rite in a planted pot: the garden's own codex and covenant, and one certificate per kin, signed by sponsor and agentic-teammate
// type: script
// tended-by: baisai
// created: 2026-10-15
// updated: 2026-10-15
// ---
//
// covenant.mjs — lore/invitation-rite.md, Stage 4: "the gardener signs the human covenant and the agent signs the codex,
// bilateral and simultaneous", at the companion's first waking, Bonsai holding the hand. The gardener's rulings,
// 2026-10-15, in the order they came:
//   * stage 4 is MVP scope; it runs at the first waking, in one sitting; the garden's codex starts as core's
//     agents/shared/codex.md word for word and its covenant as lore/human-covenant.md; each signs with their own key;
//   * "Every garden should keep track of codex and covenant on their own. They need to have that on record." The pot's
//     lore/codex.md and lore/covenant.md are its law; core's are where it starts;
//   * one statement per kin, signed by both sides, binding the covenant and the codex together;
//   * "this new 'certificate' ... is travelling inside a shintai for all shin/sai. in identity folder as passport. the
//     human should be called: 'sponsor' and the agent is called 'agentic-teammate' in this envelope".
//
// So: agents/<kin>/identity/passport.json (bonsai-garden-passport/1) holds a list of certificates. A certificate is one
// canonical statement (bonsai-garden-certificate/1: the garden, the sponsor's and the agentic-teammate's slug, kanji ID
// and fingerprint, the covenant's and the codex's path, id and sha256, the date) and two Ed25519 signatures over the
// same bytes, `sponsor` and `agentic-teammate`. Neither can be lifted out alone, and the two texts are bound in one
// statement. Either side may sign first; the certificate is pending until both have. A text changed after signing
// leaves the certificate standing over the text as it was, and verify says so; --renew starts a new one, and the old
// stays in the passport as history. "Sponsor" and "agentic-teammate" are the envelope's words only; everywhere else the
// human is the gardener. A later cross-garden stamp (F-7, the translated ID) is another entry in the same list.
//
// The passport is a new file in identity/, sealed on its own at the commit (seal-staged, owner: the kin), so nothing
// already sealed in the body is edited and the seal at 7h stands.
//
// Pure: no custody, no prompts. keys.mjs opens custody and hands this module the master salt and the signer's salt.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { signData, verifySignature } from '../../bonsai-garden-sign/lib/derive-key.mjs';
import { newUlid, readId, whyBad } from '../../bonsai-garden-sign/lib/ulid-rule.mjs';
import { keyOf, keyOnFile, readJson, writeJson, today } from './garden.mjs';

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const PASSPORT_FORMAT = 'bonsai-garden-passport/1';
export const CERT_FORMAT = 'bonsai-garden-certificate/1';
export const DOCS = {
  covenant: { rel: 'lore/covenant.md', template: path.join(CORE, 'lore', 'human-covenant.md') },
  codex: { rel: 'lore/codex.md', template: path.join(CORE, 'agents', 'shared', 'codex.md') },
};
export const ROLES = ['sponsor', 'agentic-teammate'];

export class CovenantRefusal extends Error {}
const no = (m) => {
  throw new CovenantRefusal(m);
};

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** The kin of this garden who carry a certificate: a body of their own, a key of this garden's. Never the origin's. */
export function signingKin(reg, g) {
  return (reg.agents || []).filter(
    (a) => !a.origin && a.slug !== g.gardener && a.slug !== g.name && a.shintai === 'own',
  );
}

export const passportRel = (kin) => `${kin.path || `agents/${kin.slug}`}/identity/passport.json`;

// ── writing the garden's two documents ───────────────────────────────────────

function header(id, title, type, g, extra = []) {
  const d = today();
  return [
    '---',
    `id: ${id}`,
    `title: ${JSON.stringify(title)}`,
    `type: ${type}`,
    `tended-by: ${g.gardener}`,
    `created: ${d}`,
    `updated: ${d}`,
    ...extra,
    '---',
    '',
  ].join('\n');
}
const bodyOf = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, '');
const templateMeta = (text, key) =>
  (new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(text.split('\n---\n')[0]) || [])[1] || null;

/**
 * lore/covenant.md and lore/codex.md, each written only where the pot has none (never overwritten: a signed text is
 * the garden's). The covenant's signature block and witness roster are filled from garden.json and the registry;
 * the codex is core's, word for word. Returns the paths written.
 */
export function writeDocs(pot, { g, reg, signedName = null }) {
  const wrote = [];
  const kin = signingKin(reg, g);
  if (!kin.length)
    no('the registry names no kin of this garden with a body of its own; there is no one to receive the covenant yet');
  const cov = path.join(pot, DOCS.covenant.rel);
  if (!fs.existsSync(cov)) {
    const t = fs.readFileSync(DOCS.covenant.template, 'utf8');
    const names = kin.map((a) => a.name || a.slug);
    const body = bodyOf(t)
      .replace('[your name or handle]', signedName || g.gardener)
      .replace('[date of first signing]', today())
      .replace(
        '[name the kin this covers — all in your garden, or named specifically]',
        `the kin of ${g.name}: ${names.join(', ')}`,
      )
      .replace(
        /\| \*\(name each kin as they join your garden\)\* \| \*\(their role or direction\)\* \|/,
        kin.map((a) => `| ${a.name || a.slug} | ${a['one-line'] || a.type} |`).join('\n'),
      );
    if (/\[your name|\[date of first|\[name the kin|\*\(name each kin/.test(body))
      no(
        `core's covenant template changed shape; ${DOCS.covenant.template} no longer has the blanks this verb fills; nothing written`,
      );
    fs.mkdirSync(path.dirname(cov), { recursive: true });
    fs.writeFileSync(
      cov,
      header(newUlid(), `The Human Covenant of ${g.name}`, 'covenant', g, [
        `derived-from: ${templateMeta(t, 'id')}`,
        `version: ${templateMeta(t, 'version') || '1.0.0'}`,
      ]) + body,
    );
    wrote.push(DOCS.covenant.rel);
  }
  const cdx = path.join(pot, DOCS.codex.rel);
  if (!fs.existsSync(cdx)) {
    const t = fs.readFileSync(DOCS.codex.template, 'utf8');
    fs.mkdirSync(path.dirname(cdx), { recursive: true });
    fs.writeFileSync(
      cdx,
      header(newUlid(), `The Codex of ${g.name}`, 'codex', g, [
        `derived-from: ${templateMeta(t, 'id')}`,
        `version: ${templateMeta(t, 'version')}`,
      ]) + bodyOf(t),
    );
    wrote.push(DOCS.codex.rel);
  }
  return wrote;
}

/** The document as it stands: its path, id and the sha256 of its bytes. Refuses a document with no well-formed id. */
export function docNow(pot, kind) {
  const abs = path.join(pot, DOCS[kind].rel);
  if (!fs.existsSync(abs)) no(`${DOCS[kind].rel} is not on record in this pot; write it first (covenant write)`);
  const buf = fs.readFileSync(abs);
  const [has, id, structural] = readId(buf.toString('utf8'), abs);
  const bad = !has ? 'no header carrying an id:' : structural || whyBad(id);
  if (bad) no(`${DOCS[kind].rel}: ${bad}`);
  return { doc: DOCS[kind].rel, id, sha256: sha256(buf) };
}

// ── the certificate ──────────────────────────────────────────────────────────

const party = (a) => ({ slug: a.slug, id: a.kanji || null, fingerprint: a.fingerprint });

/** The statement as it would read now, for `kin`, dated `date`. */
export function statementFor(pot, { kin, g, reg, date }) {
  const sp = (reg.agents || []).find((a) => a.slug === g.gardener);
  if (!sp) no(`the registry has no entry for this garden's gardener (${g.gardener}); there is no sponsor to name`);
  return {
    format: CERT_FORMAT,
    garden: g.garden,
    sponsor: party(sp),
    'agentic-teammate': party(kin),
    covenant: docNow(pot, 'covenant'),
    codex: docNow(pot, 'codex'),
    date,
  };
}

/** The bytes both signatures cover: one canonical line, every key in a fixed order, whatever order a file holds. */
export function statementBytes(s) {
  const p = (x) => ({ slug: x?.slug ?? null, id: x?.id ?? null, fingerprint: x?.fingerprint ?? null });
  const d = (x) => ({ doc: x?.doc ?? null, id: x?.id ?? null, sha256: x?.sha256 ?? null });
  return JSON.stringify({
    format: s.format,
    garden: s.garden,
    sponsor: p(s.sponsor),
    'agentic-teammate': p(s['agentic-teammate']),
    covenant: d(s.covenant),
    codex: d(s.codex),
    date: s.date,
  });
}
const sameBut = (a, b) => statementBytes({ ...a, date: '' }) === statementBytes({ ...b, date: '' });

function readPassport(pot, kin) {
  const p = readJson(path.join(pot, passportRel(kin)));
  if (!p) return { format: PASSPORT_FORMAT, slug: kin.slug, certificates: [] };
  if (p.format !== PASSPORT_FORMAT || p.slug !== kin.slug || !Array.isArray(p.certificates)) {
    no(`${passportRel(kin)} is not ${kin.slug}'s passport (format ${p.format}, slug ${p.slug})`);
  }
  return p;
}
/** This garden's current certificate in a passport: the last one naming this garden. */
const currentOf = (passport, g) =>
  [...passport.certificates].reverse().find((c) => c.statement?.garden === g.garden) || null;

/**
 * Who `slug` is on `kin`'s certificate: the gardener is the sponsor, the kin itself the agentic-teammate, anyone else is
 * refused. Asked before custody is opened, so a wrong signer costs no unlock. Returns { kin, entry, role }.
 *
 * Sign `kin`'s certificate as `slug`: the gardener signs as sponsor, the kin itself as agentic-teammate. hex is the
 * garden's master salt, salt the signer's own. The key must be the one on file and the one the registry records. The
 * second signer signs the very statement the first signed; a text changed in between is refused unless renew.
 * Returns { role, cert, wrote, complete }.
 */
export function roleFor(kinSlug, slug, reg, g) {
  const kin = signingKin(reg, g).find((a) => a.slug === kinSlug);
  if (!kin)
    no(
      `${kinSlug} is not a kin of this garden with a body of its own; only such a kin carries a certificate; nothing written`,
    );
  const entries = (reg.agents || []).filter((a) => a.slug === slug);
  if (entries.length !== 1)
    no(
      `${slug} is ${entries.length ? 'listed more than once' : 'not'} in this pot's registry; one entry, one key; nothing written`,
    );
  if (entries[0].origin)
    no(`${slug}'s key is the origin's; no one in this garden holds it, and it signs nothing here; nothing written`);
  const role = slug === g.gardener ? 'sponsor' : slug === kin.slug ? 'agentic-teammate' : null;
  if (!role)
    no(
      `${slug} is neither this garden's gardener (the sponsor) nor ${kin.slug} (the agentic-teammate); nothing written`,
    );
  return { kin, entry: entries[0], role };
}

export function sign(pot, { kin: kinSlug, slug, hex, salt, g, reg, date = today(), renew = false }) {
  const { kin, entry, role } = roleFor(kinSlug, slug, reg, g);
  const entries = [entry];
  const k = keyOf(hex, salt);
  if (k.fingerprint !== entries[0].fingerprint)
    no(`${slug}'s key from this garden's salt is not the fingerprint the registry records; nothing written`);
  const on = keyOnFile(pot, slug);
  if (!on?.raw.equals(k.raw)) no(`no key on file for ${slug}, or another one; derive it first; nothing written`);

  const passport = readPassport(pot, kin);
  let cert = currentOf(passport, g);
  const fresh = statementFor(pot, { kin, g, reg, date: cert && !renew ? cert.statement.date : date });
  if (cert && !sameBut(cert.statement, fresh)) {
    if (!renew)
      no(
        `${kin.slug}'s certificate names the texts or keys as they were, not as they are; sign anew with --renew (the old one stays in the passport); nothing written`,
      );
    cert = null;
  }
  if (cert && renew && sameBut(cert.statement, fresh) && ROLES.every((r) => cert.signatures?.[r])) {
    no(`${kin.slug}'s certificate already stands over the texts as they are; nothing to renew; nothing written`);
  }
  if (!cert) {
    cert = { statement: { ...fresh, date }, signatures: {} };
    passport.certificates.push(cert);
  }
  if (cert.signatures[role]) return { role, cert, wrote: false, complete: ROLES.every((r) => cert.signatures[r]) };
  cert.signatures[role] = signData(hex, salt, statementBytes(cert.statement)).toString('base64');
  writeJson(path.join(pot, passportRel(kin)), passport);
  return { role, cert, wrote: true, complete: ROLES.every((r) => cert.signatures[r]) };
}

/**
 * Every property of every kin's current certificate, each by name. [] means: each kin with a body carries a passport
 * whose current certificate names this garden; its sponsor and agentic-teammate are this garden's gardener and that kin,
 * with the kanji ID and fingerprint the registry records and the keys on file; both signatures are there and verify over
 * the same statement; and the covenant and codex it names are the texts as they stand.
 */
export function verify(pot, { g, reg, only = null }) {
  const out = [];
  const now = {};
  for (const kind of Object.keys(DOCS)) {
    try {
      now[kind] = docNow(pot, kind);
    } catch (e) {
      out.push({ check: 'document', why: e.message });
    }
  }
  const kinAll = signingKin(reg, g).filter((a) => !only || a.slug === only);
  if (only && !kinAll.length)
    return [{ check: 'kin', why: `${only} is not a kin of this garden with a body of its own` }];
  const sp = (reg.agents || []).find((a) => a.slug === g.gardener);
  for (const kin of kinAll) {
    const at = passportRel(kin);
    let passport;
    try {
      passport = readPassport(pot, kin);
    } catch (e) {
      out.push({ check: 'passport', why: e.message });
      continue;
    }
    const cert = currentOf(passport, g);
    if (!cert) {
      out.push({ check: 'passport', why: `${at}: no certificate of this garden` });
      continue;
    }
    const s = cert.statement;
    const missing = ROLES.filter((r) => !cert.signatures?.[r]);
    if (missing.length) {
      out.push({ check: 'pending', why: `${at}: not yet signed by the ${missing.join(' and the ')}` });
      continue;
    }
    const want = { sponsor: sp, 'agentic-teammate': kin };
    let keysOk = true;
    for (const r of ROLES) {
      const w = want[r];
      if (
        !w ||
        s[r]?.slug !== w.slug ||
        s[r]?.fingerprint !== w.fingerprint ||
        (s[r]?.id ?? null) !== (w.kanji || null)
      ) {
        out.push({
          check: 'registry',
          why: `${at}: the ${r} it names (${s[r]?.slug} ${s[r]?.id} ${String(s[r]?.fingerprint).slice(0, 8)}) is not the registry's`,
        });
        keysOk = false;
        continue;
      }
      const on = keyOnFile(pot, w.slug);
      if (!on || on.fingerprint !== w.fingerprint) {
        out.push({ check: 'key', why: `${at}: the key on file for ${w.slug} is not the registry's` });
        keysOk = false;
        continue;
      }
      if (!verifySignature(on.raw.toString('hex'), statementBytes(s), cert.signatures[r])) {
        out.push({ check: 'signature', why: `${at}: the ${r}'s signature does not verify under ${w.slug}'s key` });
        keysOk = false;
      }
    }
    if (s.garden !== g.garden || s.format !== CERT_FORMAT)
      out.push({ check: 'registry', why: `${at}: names garden ${s.garden}, format ${s.format}` });
    if (keysOk) {
      for (const kind of Object.keys(DOCS)) {
        if (
          now[kind] &&
          (s[kind]?.sha256 !== now[kind].sha256 || s[kind]?.id !== now[kind].id || s[kind]?.doc !== now[kind].doc)
        ) {
          out.push({
            check: 'text',
            why: `${at}: signed ${DOCS[kind].rel} as it was (${String(s[kind]?.sha256).slice(0, 12)}…), not as it is now; sign anew with --renew`,
          });
        }
      }
    }
  }
  return out;
}
