#!/usr/bin/env node
// ---
// id: 01M5CZKM3JBAZ1D2A76Y494AB2
// title: ulid.mjs — mint and check document ids from an install alone, so a kin in a planted garden mints an id and never types one
// type: script
// tended-by: baisai
// created: 2026-10-20
// updated: 2026-10-20
// ---
//
//   node <skills>/bonsai-garden-keys/bin/ulid.mjs new [-n N]        N fresh ULIDs, one per line (default 1, at most 1000)
//   node <skills>/bonsai-garden-keys/bin/ulid.mjs check <path>...   each file's own id: ok, or why not
//
// O-5 of dry run #4: Bonsai typed a journal's id by hand because core's tools/ulid.py was not in reach where he stood.
// The core plugin carries tools/ulid.py at its root, two folders above any skill's base directory; a planted pot
// carries no core at all; and Python is not on every host. Node is: every integrity line runs on it. So the keys
// skill, which a planting runs from, carries the verb as well, beside keys.mjs.
//
// Not a second master. It is the command line of bonsai-garden-sign/lib/ulid-rule.mjs, the port of ulid.py's rule
// that every seal-v2 verifier already carries and that skill's parity suite holds to ulid.py (shape, time, entropy,
// structure; templates and cards exempt; SKILL.md carries no id of its own). `check` reads what `ulid.py check PATH`
// reads, a Markdown frontmatter or a script header; the census and the staged gate stay ulid.py's.
//
// Exit: 0 every id ok · 1 a bad id, or a path that cannot be read (check) · 64 usage.

import fs from 'node:fs';
import { newUlid, ownId } from '../../bonsai-garden-sign/lib/ulid-rule.mjs';

const USAGE = `ulid.mjs — a document id is generated, never typed

  new [-n N]        N fresh ULIDs, one per line (default 1, at most 1000)
  check <path>...   each file's own id (a .md frontmatter, a script header): ok, or the reason it is not
                    (shape, time, entropy, structure); exit 1 on any bad one

The rule is core's tools/ulid.py, through bonsai-garden-sign/lib/ulid-rule.mjs.`;

function main(argv) {
  const [verb, ...rest] = argv;
  if (verb === 'new') {
    let n = 1;
    if (rest.length) {
      if (rest.length !== 2 || rest[0] !== '-n' || !/^\d+$/.test(rest[1])) return usage('new [-n N]');
      n = Number(rest[1]);
      if (n < 1 || n > 1000) return usage('new -n N: N from 1 to 1000');
    }
    for (let i = 0; i < n; i++) console.log(newUlid());
    return 0;
  }
  if (verb === 'check') {
    if (!rest.length) return usage('check <path>...');
    let bad = 0;
    for (const p of rest) {
      let buf;
      try {
        buf = fs.readFileSync(p);
      } catch (e) {
        console.log(`BAD   ${p}  cannot be read (${e.code || e.message})`);
        bad++;
        continue;
      }
      const r = ownId(buf, p);
      if (!r.carrier) console.log(`ok    ${p}  carries no id of its own (its id lives in its seal)`);
      else if (r.problem) {
        console.log(`BAD   ${p}  ${r.problem}${r.id ? ` (${r.id})` : ''}`);
        bad++;
      } else console.log(`ok    ${p}  ${r.id}`);
    }
    return bad ? 1 : 0;
  }
  if (verb === '--help' || verb === '-h') {
    console.log(USAGE);
    return 0;
  }
  return usage(verb ? `unknown verb ${verb}` : 'a verb: new or check');
}

function usage(why) {
  console.error(`usage: ${why}\n\n${USAGE}`);
  return 64;
}

process.exit(main(process.argv.slice(2)));
