---
id: 01M37XP600EA9G46JAZE6DXVGD
title: Session log template
type: template
tended-by: hissai
author: hissai
created: 2026-06-16
updated: 2026-09-05
tags: [ritual, memory, template, session-log, bl-h004]
---

# Session log template

> The chronicle of what was said, not only what was decided. A handover records the outcome; a session log records the passage. Where a handover answers *what is loose for next time*, a session log answers *what happened, in order, and why*. Both are memory. The handover is the summary at the threshold; the log is the room behind it.

## When to use

Open a session log at the start of any working session that is expected to run long, to branch, or to carry decisions that a future reader will want to retrace. Short sessions may skip straight to a handover. The two files are siblings, not substitutes:

- `session-<YYYY-MM-DD>-log.md`: written *during* the session, appended as work moves.
- `session-<YYYY-MM-DD>-handover.md`: written *at the close*, the threshold summary.

Both live in `diary/logs/`. When a single day holds more than one session for the same agent, suffix the agent slug: `session-<YYYY-MM-DD>-<slug>-log.md`.

## Discipline

Write in the workshop voice. No clause-breaking dash (see P-H001 in `agents/hissai/memory/patterns.md`). Record the turn of the work, not the bench particulars: a command that mattered is cited by what it accomplished, not pasted in full (see P-H003). The log is memory the garden can read aloud, not a terminal scroll.

---

## Template (copy below this line)

```
<!-- frontmatter
{
  "id": "<ULID>",
  "title": "Session log — <YYYY-MM-DD> — <slug> — <short subject>",
  "type": "session-log",
  "tended-by": "<slug>",
  "created": "<YYYY-MM-DD>",
  "updated": "<YYYY-MM-DD>",
  "tags": ["session-log", "<slug>"]
}
-->

---
id: <ULID>
title: "Session log — <YYYY-MM-DD> — <slug> — <short subject>"
type: session-log
tended-by: <slug>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: [session-log, <slug>]
---

# Session log — <YYYY-MM-DD> — <slug>

**Opened:** <time> · **Agent:** <slug> · **Frame:** <one line on why this session opened>

## Context at open

What was carried in. The handover read, the working-state digest, the Aruji's framing
for this session if any.

## The passage

A running, time-ordered account. One entry per meaningful turn. Record the decision and
the reason beside it, so a future reader sees not only what was chosen but why the other
road was not taken.

- <time> — <what happened> — <why it mattered>
- <time> — <what happened> — <why it mattered>

## Decisions of record

The choices a future session must honor or revisit. Each with its ground.

- <decision> — ground: <why> — revisit-when: <condition, or "settled">

## Open at close

What is loose. This feeds the handover. Name the next move and what gates it.

- <loose item> — next move: <...> — gated on: <...>

## Sources

Files read or written this session, by role, not by full path dump.
```
