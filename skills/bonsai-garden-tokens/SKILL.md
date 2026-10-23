---
name: bonsai-garden-tokens
description: >
  Teach any *-sai or *-shin how to read its own token budget and spend it
  deliberately -- what the numbers mean, where to read them in this harness,
  and the structural habits (thread size, model choice, context handling)
  that decide whether a day costs what a day should or what a week should.
  In Claude Code the reading mechanism is the mcp__ccd_session_mgmt__get_usage
  MCP tool; another harness supplies its own reader against the same
  contract. Use for: deciding where a task should run (main thread vs.
  sub-invocation), picking a sub-agent's model before spawning it, checking
  how much context is left before compacting or handing off, and naming the
  token/currency cost of a proposed scale-out before spending the gardener's
  money on their behalf. Not a metering system, not a budget enforcer, not a
  dashboard -- a one-page contract an agent reads.
version: 0.1.0
---
> **Integrity first.** Before you read or run anything else in this package, run `node scripts/integrity/verify-manifest.mjs` from this skill's base directory. It checks every file against the sealed `MANIFEST.json` and asks the published keys at bon-sai.garden whose seal that is. Anything but `ok` (no `node`, no verifier, no key, no answer, a mismatch) means stop: use nothing here, and tell the gardener exactly what it said. A tampered file is not executed.

# Bonsai Garden Tokens

**What this is.** A skill, not a service: after reading this, any *-sai or
*-shin should be able to answer *"where am I, and where should this work
run?"* in under a minute. It teaches a discipline that holds in any harness,
and points at the one reading mechanism this harness happens to have.

**Why it is in core.** Every garden runs on a token budget, in whatever
harness it happens to be wearing. Nothing here names an agent, a garden, or
a specific plan tier -- it is capability, not instance, by the same test
`LAYERS.md` applies everywhere else: *would another garden need this, or is
it ours?* Another garden needs this.

---

## The one question

Before doing work, or before handing work to a sub-agent, ask:

1. **Where am I?** -- how much of the plan window is spent, how full is
   *this* thread's context, how close is auto-compact.
2. **Where should this work run?** -- in this thread, or handed to a
   sub-invocation; on which model; and if several at once, at what cost.

Everything below is in service of answering those two questions fast.

---

## 1. The structural discipline (matters more than the reading)

**The main session is the expensive, small thread.** It carries judgment,
direction, and the goal itself. It should stay short: every message in it
is read by the model that is *holding the thread*, so its cost compounds
with its length, and a long main session is not free even when nothing in
it looks expensive.

**Sub-invocations are the cheap, large threads.** Reading a codebase,
sweeping a directory, running a build-and-verify loop, drafting a first
pass -- these belong in a sub-agent, not in the main thread, because a
sub-agent's context is disposable: it can be enormous, read everything, and
be thrown away, without lengthening the seat that holds the goal.

**Getting this backwards is how a day costs what a week should.** A main
session that reads five files itself instead of delegating the read is
paying goal-holding-thread rates for work that didn't need them.

## 2. Model selection is the biggest single lever, and the default is wrong

A sub-agent **inherits the parent's model unless told otherwise.** That
default is almost always wrong, because it means an expensive judgment-model
gets used for rote work, or -- the more dangerous direction -- an
identity-bearing seat quietly ends up on a model too weak to carry it.

The rule, stated so the two facts in `agents/shared/routines.md`'s model
guardrail stop looking like they conflict:

> **The floor attaches to what the seat is doing, not to whether it is a
> sub-agent.** No *-sai and no *-shin may run on Haiku, because a *-sai's
> or *-shin's work *is* voice, register, and judgment, and Haiku erodes
> exactly those. Fuji-shin is the sole exception, and the exception is
> narrow on purpose: their entire designed function -- running checks,
> verifying builds, fast deterministic passes -- carries no character and no
> judgment to erode. They are not exempt because they are cheap or because they are
> a sub-agent; they are exempt because there is nothing in their work for Haiku
> to flatten. **No other *-shin inherits this by default** -- a new *-shin
> earns their own model floor from their own contract, the same way Fuji-shin's
> was earned rather than assumed.

Applied when spawning any sub-invocation, *-shin or otherwise:

- **Ask what the seat is doing, not what it is called.** Mechanical,
  deterministic verification with no register to protect -> Haiku is fine,
  often preferable for speed and cost. Building, refactoring, sweeping with
  judgment calls, or anything that speaks in an agent's voice -> Sonnet is
  the floor.
- **The top model belongs to the seat holding the goal.** Opus-class
  capacity is spent on direction and judgment, not spread thin across
  parallel workers that don't need it.
- **Choosing the default (inherit) is still a choice.** State it, don't let
  it happen silently -- an identity-bearing sub-invocation inheriting Haiku
  from a Haiku-running parent is the failure the guardrail exists to catch,
  not a loophole around it.

## 3. Context is budget too

A long main session is not free even when every individual message looked
cheap -- length itself is the cost, and it eats into the same ceiling that
triggers auto-compaction (dropping the thread's own detail) or forces a
handoff (a fresh session picking up a compressed summary of what came
before). Handing work out to sub-invocations is what keeps the expensive
thread short enough that neither has to happen mid-task.

Watch two numbers, not one: the *plan* window (money/quota, resets on a
clock) and *this session's context* (a hard ceiling this thread alone is
approaching, resets only by compacting or starting fresh). They are
independent; a session can be nowhere near its plan limit and still be
about to auto-compact, or vice versa.

## 4. Naming cost when proposing scale

*"Three agents in parallel"* is a plan. *"Three agents in parallel, roughly
40k tokens each and under a euro of extra usage"* is a decision the
gardener can actually make. Silence about cost spends their money on their
behalf -- the same failure whether the currency is tokens, wall-clock, or
the plan's extra-usage spend. Say the number before running it, using
whatever the harness's reader gives you (see below) to make it a real
estimate rather than a guess.

---

## Reading the budget: the harness seam

The discipline above is universal. The *reading mechanism* is not --
`get_usage` is a Claude Code tool, and core cannot assume Claude Code. So
the seam is drawn here: **any harness's reader fills the same shape**, and
this skill's teaching never has to change when a new one is written.

**The contract every reader answers:**

| Question | Shape |
|---|---|
| How much of my plan window(s) is spent? | a list of `{ label, percentUsed, resetsAt }` -- one entry per window that applies (e.g. a short rolling limit, a weekly all-model limit, a weekly per-model limit) |
| Is there spend beyond the plan? | `{ enabled, spent, currency }` if the plan has an extra-usage/overage mode, else absent |
| How full is *this* thread's context? | `{ tokensUsed, contextWindow, percentUsed, autoCompactsAtPercent }`, optionally broken into `categories` (what the tokens went to) |

A harness that has no such reader yet simply has nothing to plug into the
top of §1-4 -- the discipline still holds; only the numbers are missing.

### Claude Code's reader

`mcp__ccd_session_mgmt__get_usage(session_id: "self" | <sessionId>)` is the
tool. Read-only, safe to call any time. Actual shape (a live call, trimmed):

```json
{
  "plan": {
    "status": "ok",
    "plan": "Team",
    "windows": [
      { "label": "5-hour limit",       "percentUsed": 49, "resetsIn": "1h 59m" },
      { "label": "Weekly · all models","percentUsed": 35, "resetsIn": "1d 8h" },
      { "label": "Weekly · <model>",   "percentUsed": 26, "resetsIn": "1d 8h" }
    ],
    "extraUsage": { "enabled": true, "spent": "21.29", "currency": "EUR" }
  },
  "context": {
    "session": "self",
    "status": "ok",
    "tokensUsed": 638578,
    "contextWindow": 1000000,
    "percentUsed": 64,
    "autoCompactsAtPercent": 97,
    "categories": [
      { "name": "Messages",     "tokens": 552096, "percent": 55 },
      { "name": "System tools", "tokens": 32538,  "percent": 3 },
      { "name": "MCP tools",    "tokens": 26698,  "percent": 3 },
      { "name": "System prompt","tokens": 11841,  "percent": 1 },
      { "name": "Skills",       "tokens": 9946,   "percent": 1 },
      { "name": "Memory files", "tokens": 6025,   "percent": 1 }
    ]
  }
}
```

Notes on reading it:

- `plan.status` / `context.status` can be `not_applicable` (a key/gateway
  account, no plan limits), `unavailable` (transient), or `ok`. Check status
  before trusting the numbers.
- `windows` is a list because plan tiers can carry several ceilings at once
  (short rolling window, weekly all-model, weekly per-model) -- read all of
  them, the tightest one is the one that binds.
- `context.percentUsed` vs. `autoCompactsAtPercent` is the number that
  answers "how much runway before this thread compacts." `categories` is
  where to look when that number is surprising -- usually "Messages."
- `session_id` defaults to `"self"`; pass another session's id to check a
  sub-invocation's or sibling session's fill before deciding whether to hand
  it more work.

### A different harness

Whatever mechanism that harness exposes for plan/quota and context state,
write a reader against the same three-row contract above and the teaching
in §1-4 applies unchanged. Nothing about the discipline is Claude-Code-
specific; only this one table's right-hand column is.

---

## What this deliberately leaves out

- **No metering, no logging, no persisted usage state.** `get_usage` (or
  the harness-equivalent) is the record; this skill does not keep a second
  one.
- **No enforcement.** Nothing here stops a session from running over
  budget -- it teaches what to look at and what to do about it, not a gate.
- **No dashboard.** If a gardener wants one, that is `explain-usage` or a
  purpose-built surface, not this.
- **No per-harness reader implementations beyond Claude Code's.** Writing
  one for a harness that isn't in front of us yet would be guessing at an
  interface nobody has used -- the contract table is what a future reader
  is written against, not code shipped speculatively ahead of the need.
