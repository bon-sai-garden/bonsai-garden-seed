#!/usr/bin/env node
// ---
// id: 01M4TC82K1WESC2FR0HQ85M0BQ
// title: The lens gate command line: verdict, ledger-check, digest-check, digest-pin, prompt, template
// type: script
// tended-by: bonsai
// created: 2026-10-13
// updated: 2026-10-16
// ---
// lens-gate: verdict | ledger-check | digest-check | digest-pin | prompt | template
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as G from '../lib/gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LENSES = resolve(HERE, '..', 'lenses');
const [cmd, ...rest] = process.argv.slice(2);
const USAGE = 'usage: lens-gate <verdict|ledger-check|digest-check|digest-pin|prompt|template> [flags]';
if (cmd === '--help' || cmd === '-h') {
  console.log(USAGE); // asked for: exit 0, where a missing or unknown command stays a refusal (2)
  process.exit(0);
}

function flags(argv) {
  const f = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      f._.push(a);
      continue;
    }
    const k = a.slice(2);
    const boolean = ['lab-preview', 'json', 'numbers'].includes(k);
    if (boolean) f[k] = true;
    else f[k] = argv[++i];
  }
  return f;
}
const need = (f, k) => {
  if (!f[k]) throw new G.Refused(`--${k} is required`);
  return f[k];
};
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

try {
  const f = flags(rest);
  if (cmd === 'verdict') {
    const v = G.verdict(readJson(need(f, 'readings')), {
      labPreview: !!f['lab-preview'],
      ruling: f.ruling ?? null,
      ruledBy: f['ruled-by'] ?? null,
      barShift: f['bar-shift'] !== undefined ? Number(f['bar-shift']) : 0,
      barReason: f['bar-reason'] ?? null,
      acknowledge: f.acknowledge
        ? f.acknowledge
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    });
    console.log(
      f.json
        ? JSON.stringify(v, null, 2)
        : `${v.status.toUpperCase()} · ${v.subject} · ${v.mode} · bar ${v.bar === 'as set' ? 'as set' : `${v.bar.moved}: ${v.bar.reason}`} · lowest lens ${v.lowest}${v.spreadSignal ? ' · the lenses differ (signal)' : ''}` +
            (v.holds.length ? `\nholds: ${v.holds.join(', ')}` : '') +
            (v.below.length ? `\nunder the bar: ${v.below.join(', ')}` : '') +
            `\n${v.findings.length} findings · ${v.conditions.length} conditions` +
            (v.ruling?.by ? `\nruled by ${v.ruling.by}: ${v.ruling.words}\n(base verdict ${v.base})` : ''),
    );
    // the numbers are for the screen at the gate, on request, and never part of the record
    if (f.numbers)
      console.error(
        `working (not for the record): bar ${v.working.bar} · ${Object.entries(v.working.numbers)
          .map(([l, n]) => `${l} ${n}`)
          .join(' · ')} · spread ${v.working.spread}`,
      );
    process.exit(v.status === 'clears' || v.status === 'passed-on-ruling' ? 0 : 1);
  } else if (cmd === 'ledger-check') {
    const r = G.ledgerCheck(readJson(need(f, 'ledger')), f.root ?? process.cwd());
    console.log(`${r.present} of ${r.total} present · ${r.missing} missing · ${r.needsReader} need a reader`);
    for (const x of r.results.filter((y) => y.state !== 'present'))
      console.log(`  ${x.state}: ${x.id}${x.why ? ` — ${x.why}` : ''}`);
    console.log(r.note);
    process.exit(r.missing ? 1 : 0);
  } else if (cmd === 'digest-check') {
    const r = G.digestCheck(
      f.lenses ?? LENSES,
      f['source-map'] ? readJson(f['source-map']) : null,
      f['source-root'] ?? null,
    );
    for (const x of r.results) console.log(`${x.lens}: ${x.state}${x.why ? ` — ${x.why}` : ''}`);
    process.exit(r.ok ? 0 : 1);
  } else if (cmd === 'digest-pin') {
    console.log(
      'pinned: ' +
        G.pinDigests(f.lenses ?? LENSES, readJson(need(f, 'source-map')), f['source-root'] ?? null).join(', '),
    );
  } else if (cmd === 'prompt') {
    const open = f.ledger ? readJson(f.ledger).conditions.filter((c) => c.status !== 'closed') : [];
    console.log(
      G.brief({
        digests: G.loadDigests(f.lenses ?? LENSES),
        draft: need(f, 'draft'),
        dossier: f.dossier ?? null,
        openConditions: open,
        mode: f.mode ?? 'single',
      }),
    );
  } else if (cmd === 'template') {
    console.log(JSON.stringify(G.template(f._[0]), null, 2));
  } else {
    console.error(USAGE);
    process.exit(2);
  }
} catch (e) {
  if (e instanceof G.Refused) {
    console.error(`lens-gate: REFUSED — ${e.message}`);
    process.exit(2);
  }
  console.error(`lens-gate: REFUSED — unexpected ${e.name}: ${e.message}`);
  process.exit(2);
}
