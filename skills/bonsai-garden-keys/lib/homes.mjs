// ---
// id: 01M4Z2NDA1V42GNG0C1ATXAVDP
// title: homes — a planted garden gives every registered kin, and its gardener, a home/<slug>/ of their own
// type: script
// tended-by: baisai
// created: 2026-10-15
// updated: 2026-10-15
// ---
//
// homes.mjs — the ruling of 2026-10-12 (a companion's lived memory lives at home/<slug>/ in the garden's own repo; the
// sealed body's memory/ stays a skeleton) and the gardener's word of 2026-10-15 on the kobun dry run's F-21: "the new
// garden repo should create a home folder for each registered kin in that garden". The runtime's session_start reads
// home/<slug>/memory/working-state.md first when it is there (rt 3d97d9b).
//
// Every registry entry but the origin's (it lives in its own garden) and the garden's own (no body) gets
// home/<slug>/inbox/acknowledged.md: letters land in inbox/, and the ledger is what makes an inbox a record. A kin with
// a body of its own also gets home/<slug>/memory/working-state.md. Each file carries a minted id and names its owner;
// none is ever overwritten. Written unsealed: each owner seals their own at the commit (seal-staged --as <slug>).

import fs from 'node:fs';
import path from 'node:path';
import { newUlid } from '../../bonsai-garden-sign/lib/ulid-rule.mjs';
import { today } from './garden.mjs';

/** The registry entries that get a home: everyone this garden holds a key for, never the origin, never the garden. */
export function homeOwners(reg, g) {
  return (reg.agents || []).filter((a) => !a.origin && a.slug !== g.name && a.type !== 'garden');
}

function doc(slug, title, type, body) {
  const d = today();
  return [
    '---',
    `id: ${newUlid()}`,
    `title: ${JSON.stringify(title)}`,
    `type: ${type}`,
    `tended-by: ${slug}`,
    `created: ${d}`,
    `updated: ${d}`,
    '---',
    '',
    body,
  ].join('\n');
}

/** Write each missing home file; returns the pot-relative paths written (for the seal line), in registry order. */
export function plantHomes(pot, { reg, g }) {
  const wrote = [];
  const put = (rel, text) => {
    const abs = path.join(pot, rel);
    if (fs.existsSync(abs)) return;
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
    wrote.push(rel);
  };
  for (const a of homeOwners(reg, g)) {
    const who = a.name || a.slug;
    put(
      `home/${a.slug}/inbox/acknowledged.md`,
      doc(
        a.slug,
        `${who} — inbox acknowledgements`,
        'ledger',
        `# Inbox acknowledgements — ${who}\n\nOne row per letter received in \`home/${a.slug}/inbox/\`: what it was, when it was read, what was done. ` +
          "Senders' letters are not edited.\n\n| note | read | action |\n|---|---|---|\n",
      ),
    );
    if (a.shintai === 'own') {
      put(
        `home/${a.slug}/memory/working-state.md`,
        doc(
          a.slug,
          `${who} — working state`,
          'working-state',
          `# ${who} — working state\n\nLived memory, ${who}'s own: what is open, what was decided, where to pick up. ` +
            `The body's \`memory/\` stays the skeleton it was sealed as; this file is what \`bonsai_session_start("${a.slug}")\` reads.\n\n` +
            `Planted ${today()} in ${g.name}. Nothing open yet.\n`,
        ),
      );
    }
  }
  return wrote;
}
