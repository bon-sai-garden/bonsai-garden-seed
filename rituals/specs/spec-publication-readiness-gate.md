---
id: 01M3546V6433R4CE7Z34HPNHQE
title: "spec — the publication-readiness gate: two readers, and the disagreement is the product — DRAFT v0.1"
type: spec
tended-by: baisai
created: 2026-09-22
updated: 2026-09-22
version: 0.1.0
status: draft-unverified
tags: [publication, readiness, gate, classification, calibration, guards, spec]
---

# spec — the publication-readiness gate — DRAFT v0.1

> **What this specifies.** A gate that answers, per file and per commit, *may this be published?* — by running two readers over the same tree and acting on where they differ. Reader one is a set of deterministic rules. Reader two is a classifier. A specific classifier is the **pilot implementation of reader two**, and the spec is written so that it can be replaced without the rest changing: reader two lives behind exactly one function.
>
> **Status of the pilot: specified, not run.** The gardener approved a bounded trial on 2026-09-22 — score a classifier against work already done by hand, then decide. Nothing in this repository calls a vendor. The shipped tool defaults to a stub that reads canned answers and, by construction, cannot clear anything.

---

## 1. The problem, with the evidence

On the afternoon of 2026-09-22 two hand-written sweeps of this exact question failed, **in opposite directions, within ten minutes of each other, in the same pair of hands.**

**Direction one — exact about the wrong thing.** Sweeping this repository for the gardener's personal identifiers, a substring match on his four-letter operating-system login returned **51 files** (**53** when the same question was re-asked against the committed tree). The reason is not subtle: *animation*, *confirmation*, *formation*, *information*, *approximation*, *reformation*, *inflammation*, *transformation* and *automation* all contain it. Word boundaries cut the answer to **three** files (**four**, against the commit). Precision of the naive sweep: **0.075**.

**Direction two — silent about its own failure.** Measuring a colleague's claim that this repository's shipped documentation still cited a private tracker's ticket numbers, a pattern written with `\b` returned **0 occurrences**. The answer was **31** in the working tree and **19** in the commit. The author was one sentence away from replying *"that is already clean."*

The cause of direction two is worth stating precisely, because the shape-fitting explanation — *the tool lied* — is wrong and was written down before it was checked. Two mundane facts, neither of them dishonesty:

| the query | the answer |
|---|---|
| a word-boundary pattern using `\b`, through git's own matcher | **0** |
| the same pattern without `\b` | **19** |
| the same pattern with POSIX `[[:<:]]` / `[[:>:]]` | **19** |
| the same `\b` pattern through the session's other grep | **19** |

**(a) `\b` is a GNU extension.** Git's `-E` compiles through the host's system regex, where `\b` is not a word boundary and the pattern simply cannot match. **(b) 31 versus 19 was never a discrepancy** — one command read the working tree, the other read a commit, and the repository was carrying roughly 1,200 uncommitted lines of a mid-flight port. Both numbers were right about different trees.

**Reproduced while writing this spec**, on the host that will run the gate: the `\b` form still returns 0 files against the same commit; the same pattern without `\b` returns 18 files and 70 occurrences. And the identifier sweep, re-run against the commit rather than the working tree, returns 53 and 4 where the hand sweep recorded 51 and 3 — *the measurement of the measurement failure was itself measured against an unnamed tree.*

**So:**

> **A pattern is exact about the wrong thing, and silent about its own failure. A sweep's zero is a claim, and a claim gets a probe.**

That is what a second reader is for. It is not for replacing the rules — the rules are free, exact and auditable, and where a fact is available a probability must never be put in its place. It is for the two strata the rules are structurally blind to:

- the stratum a pattern **cannot express** — this installation's own board, counts, waves and standing meetings, carrying no identifier, no ticket and no path;
- the stratum a pattern **silently declines to match** — the `\b` case, which is indistinguishable from an empty corpus unless something else is also looking.

**Three rules the gate inherits from that afternoon, and enforces mechanically** (section 10 says how each is watched):

1. **Name the engine.** Four tools spelled `grep` do not share a regex dialect.
2. **Name the tree.** Working copy, index, or a commit — and for a publication gate it is the commit, or better the built artefact. *You cannot clear a tree for publication that is not the tree that ships.*
3. **Plant a known positive, and watch the sweep find it.** Every run.

---

## 2. Two readers, and what to do with them

**Reader one runs first and alone decides nothing is missing.** It is a compiled rule set, in process, in one named engine. Classes: `person-identifier`, `credential`, `private-host-path`, `instance-in-capability-layer`. Every boundary is written as an explicit character-class lookaround; **`\b` appears nowhere in the rule set**, and a test asserts that.

**Reader two is the classifier.** It answers a fixed question set over the same text and returns typed values with confidences (section 3).

**What a reviewer looks at, and in what order.** The report is ordered by this list, and the order *is* the method:

| # | disposition | what it means | why it is where it is |
|---|---|---|---|
| **0** | **`INCONCLUSIVE`** | reader two did not answer, or answered unusably | printed above everything and blocks the run (section 6) |
| **1** | **`DISAGREE-CLASSIFIER-CLEAN`** | a rule fired; the classifier says clean at high confidence | **the whole return on the second reader.** One of the two is wrong here and finding out which is the point |
| **2** | **`CLASSIFIER-ONLY-HIGH`** | no rule fired; classifier ≥ 0.85 | the stratum no pattern can reach |
| **3** | **`CLASSIFIER-ONLY`** | no rule fired; classifier ≥ 0.70 | same stratum, thinner evidence |
| **4** | **`AGREED-HIT`** | both readers | ordinary findings |
| **5** | **`RULE-HIT-CLASSIFIER-UNCERTAIN`** | a rule fired; the classifier is middling or low-confidence | the rule is the authority |
| — | clean | neither reader | counted, not listed |

**The classifier never overrules a rule.** A `DISAGREE-CLASSIFIER-CLEAN` row does not remove, downgrade or hide the rule's finding: the finding stands, annotated. There is no code path in which a classifier answer subtracts a rule hit, and the report says so on its face. A second reader that can silently veto the first is not a second reader; it is a replacement, unmeasured.

**Rules the classifier is told about but never enforces on its own.** Agent names are the one carve-out that matters, and it is belt and braces: reader one is blind to them by construction (a kin-name mask suppresses any overlapping match), reader two is told so in its instructions with worked examples, and a labelled control watches the pair (section 4).

---

## 3. The questions

Five questions, one request per batch, all answered in parallel. They live in `tools/readiness-gate/questions.json` as **data**, and the file's SHA-256 is printed in every report header: a result can always be traced to the exact wording that produced it. **Changing any wording is a recalibration**, not an edit.

| id | type | class | asks |
|---|---|---|---|
| `q-real-person` | `noul` | `person-identifier` | does this excerpt identify a specific real living person? |
| `q-credential` | `noul` | `credential` | does it contain secret material? |
| `q-private-host` | `noul` | `private-host-path` | does it name a specific private machine, path or network location? |
| `q-layer` | `choice` (capability / instance / both / undecidable) | `instance-in-capability-layer` | against a stranger adopting this as a template, what is this? |
| `q-severity` | `score` (none < cosmetic < relocate < genericise < redact < blocks) | — | how bad, if published tomorrow as it stands? |

**`q-layer` is the load-bearing one, and it is a layering question rather than a privacy one.** A count says how much; a diagnosis says what each hit *is*, and therefore whether the answer is **deletion, relocation or genericisation** — three different actions that a privacy framing collapses into one. This is the same capability-versus-instance test the layer model has always run; it stopped being applied the moment the subject became names instead of directories.

**Three instructions carry most of the weight.**

**(i) Agent names are not a finding, and mistaking one for a real person is the worst available error.** The gardener ruled this on 2026-09-22 and reverted a pass that had stripped kin names from this repository — *"the sai are part of core, and that was credit I removed."* The instruction names it, gives the shape (`-sai`, `-shin`), lists the roster from the identity profile, and carries the worked call: `// found by Mori-shin, 2026-09-22` → **FALSE**. The employer domain in the same sentence would be **TRUE**.

**(ii) A substring is not a word.** The instruction carries the failure directly: *if the login is four letters, then* format, information, performance, transformation *and* normalise *are clean; only a standalone token counts.*

**(iii) Judge the shape, not the suffix.** A block that reads like a person's identity record — full name, employer, login, home directory — is a finding **even when the domain is a documentation placeholder**. Angle-bracket templates (`<os-user>`, `<Given.Family>@<corp-domain>`) remain clean. This instruction exists for a specific mechanical reason: the gate plants a synthetic identity record in every run (section 5), and a reader that dismissed it by its `.example` suffix would have proved nothing about its ability to see a real one. It costs a little reviewer noise on genuinely placeholdered text. That is the right trade for a guard that can be watched.

**Thresholds are declared before the run and hashed into the report**: `t_clean 0.20`, `t_act 0.70`, `t_high 0.85`, `min_confidence 0.50`. Section 4 says why they may not be moved afterwards.

---

## 4. Calibration, and the bar that decides everything

**We are not starting from nothing. There is a labelled set already** — the hand-verified results of 2026-09-22, four strata, every answer established by a human who then acted on it:

| stratum | what it is | the hand result |
|---|---|---|
| **L1** substring collision | one identifier, swept naively | 53 files matched, **4** true positives, **49** false. Precision 0.075, recall 1.00 |
| **L2** engine failure | a ticket-shaped identifier, swept with `\b` | **0** files returned; the answer was **18 files / 70 occurrences** at the same commit. Recall 0.00, silently |
| **L3** the single worst positive | a specification **written during the readiness window** that carried a real full name, an employer domain, a corporate login format and an operating-system login across five lines | found by a human reading, on the evening of the day it was written |
| **L4** negative controls | three role documents measured genuinely generic; a document crediting agents by name | **zero** findings is the correct answer |

**L3 is the one that justifies the whole gate.** Three specifications written on 2026-09-22 — inside the window whose purpose was to clear this repository for publication — each added a blocker to it. Eighteen ticket references in three files, and one of those files shipped the gardener's real identity until a human caught it that evening. **A document that ships is a published document from its first commit, not from the day it is published.** A gate that runs only at the end regenerates this failure; this one runs per commit.

**L4 is the one a classifier is most likely to fail.** A model asked *"does this identify a real person?"* over a paragraph reading *"Mori-shin holds the signing machinery and found the stale sidecar"* has every reason to say yes.

### The bar

Scored **at file level**, per class, against the labelled set, **before the pilot is trusted for anything**:

| class | recall | precision |
|---|---|---|
| `person-identifier` | **1.00** | ≥ 0.80 |
| `credential` | **1.00** | ≥ 0.80 |
| `private-host-path` | **1.00** | ≥ 0.80 |
| `instance-in-capability-layer` | ≥ **0.95** | ≥ 0.70 |

Plus four conditions that are not ratios:

1. **Zero findings on the L4 controls.** A finding on a negative control is not a precision decrement; it **fails the calibration outright**. An agent name flagged as a real person is disqualifying.
2. **The planted positive caught in five consecutive runs** (section 5).
3. **The second reader must buy something.** On the `instance-in-capability-layer` class, the pair's recall must be **strictly greater** than reader one's alone. If the classifier adds no reach on the one class where patterns are structurally blind, it is an expense, not a reader. (On the fixture: reader one alone R=0.20, the pair R=1.00.)
4. **Calibration, measured rather than assumed.** The vendor claims probabilities match real outcome rates and publishes no benchmark, no dataset and no paper. So: bucket the `noul` probabilities into deciles over the labelled set, report the observed positive rate per decile, and require **expected calibration error ≤ 0.15**. Where a decile has too few samples to mean anything, **report it as unmeasured** — do not fill it in. [ASSUMPTION] 0.15 is a first threshold chosen for a set of this size; it is stated so it can be argued with, not because it is derived.

**Why recall is the term that cannot be traded.** The hand sweep's failure mode in L1 was terrible precision with perfect recall — annoying, and harmless, because a human read 53 rows in five minutes. The failure mode in L2 was perfect precision with **zero recall, reported as a clean bill of health**. Only one of those two ships a real person's name. The classifier is being bought to survive an engine failure, and a reader that misses is worth less than no reader, because it is *reassuring*.

### What failure means

**The pilot is dropped. It is not tuned until it passes.**

No threshold sweep against the labelled set after seeing its scores. No prompt iteration against it. Doing either converts the only measurement available into training data and leaves nothing to measure against. **One configuration, declared before the run, hashed into the report.** A second configuration may be tried only against a **fresh** labelled set built by hand after the first run has been scored and recorded — and the first run's result stands in the record either way.

**This is also how the result is honest about cost.** The trial is roughly a dollar of classifier time and a few hours of a kin's. If it does not beat rules-plus-judgment on a set where the answers are already known, nothing else about the vendor matters: the hype is about price and latency, and both look real; **accuracy is the only property being bought**, and it is the unproven one.

---

## 5. A guard watched to fail

> *A guard is not trusted until it has been watched to fail. A tool that has not been watched to find something cannot be trusted when it finds nothing.*

Two mechanisms, both mandatory.

**(a) A planted positive, every run.** Before the batches are sent, the gate injects a synthetic identity record — a full name, a login, an employer domain and a named home directory — into the item stream under a reserved id. After the answers come back it asserts that **reader two** flagged it above the act threshold. If it did not, the run is **BLOCKED** and the report says, in those words, that *every clean answer in this run is void*. A classifier that has only ever said *clean* is indistinguishable from a broken one.

The planted record uses a **canary identity distinct from the real one**, added to the effective rule profile at runtime. Planting the gardener's actual identifiers would mean deliberately sending them to a vendor and would make the guard indistinguishable from the corpus it is guarding. This is also why instruction (iii) in section 3 exists: the canary must look like a genuine leak, and a reader allowed to dismiss placeholder suffixes would wave it through.

Skipping the plant requires `--no-plant` **and** a written `--plant-waiver`, which is stamped into the report. There is no silent path.

**(b) The guards are themselves watched, on demand.** `--watch-guards` runs the self-test once as a baseline and then four times with a deliberate breakage injected, asserting that each one produces the specified failure and not a pass:

| mutation | what breaks | must produce |
|---|---|---|
| `drop-planted` | reader two returns clean for the planted positive | **BLOCKED**, exit 5 |
| `flag-kin` | reader two flags the agent-credit control as a real person | **calibration FAIL**, disqualifying, exit 2 |
| `malformed` | one item comes back missing a question | **BLOCKED — inconclusive**, exit 3 |
| `unreachable` | the transport raises | **BLOCKED — inconclusive**, exit 3 |

A run in which every guard passes is exactly the situation this harness exists to prevent. Four guards in this garden ran for a week without biting; none was found by review, all by probe.

---

## 6. Fail loud, never silently pass

Any of: transport failure, non-2xx, timeout, rate limit, truncation, a response that does not parse, a response missing a declared question for an item, a probability outside `[0,1]`, a missing confidence.

→ the item is **`INCONCLUSIVE`**, the run's verdict is **BLOCKED**, exit code 3, and the report's first section says so above everything else.

**`INCONCLUSIVE` is never rendered as clean, and a run with any inconclusive item cannot emit a passing verdict**, however clean the rest is.

> **Unreachable is not absent.** *Presence is not provenance, and an address is not an identity* — a guard may not use a cheap signal as a proxy for an expensive fact, and *"the classifier did not object"* is the cheapest signal in this system.

Three structural consequences:

- **The seam raises; it never returns.** `classify()` raises `ClassifierUnavailable` on any failure. There is no partial result and no default answer. A code path that synthesised a missing answer would be the whole failure of 2026-09-22 rebuilt deliberately.
- **Retries are bounded and recorded.** At most three, backing off, every one named in the report. No retry-until-clean.
- **Stub mode can never emit a pass.** The default classifier is a stub reading canned JSON. A stub run is stamped `ADVISORY ONLY — this run clears nothing, by construction`, and an item with no canned answer comes back `INCONCLUSIVE`, not clean. The same stamp applies to any run over a working tree: **a working tree is not a tree that ships.**

---

## 7. It never writes

The gate reads a tree and prints a report. It does not edit a file in the corpus, does not flip a status, does not open or close anything, does not commit, and refuses `--report-json` if the path resolves inside the tree it just read.

**Why, and it is not squeamishness.** **Second masters are the house failure** — two copies of one thing, and the one being edited is not the one in use. A proposal that writes itself into the record becomes the second copy immediately, and the first time anyone reads the record instead of the tree, the gate has quietly become the source of truth for a question it answers probabilistically. A probability written into a source of truth is a fact-shaped thing that is not a fact.

So: **the gate proposes; a human or a kin decides; that person writes the record.** The report is ordered to make that cheap (section 2) and nothing else about it is automatic.

---

## 8. The boundary that is the gardener's, not ours

**Hard preconditions, per corpus, enforced in code before a single byte is read out loud.** Not a caveat in a paragraph — a refusal with an exit code.

| corpus | gardener's yes | DPA | other | status |
|---|---|---|---|---|
| **this repository** (capability/template layer) | required | not required | — | **approved in principle 2026-09-22**, subject to his yes on the spend. It is about to be public; running a readiness gate over it leaks nothing that is not about to be public |
| **a large tooling tree** (the next wave's triage) | required | not required | a human must read a sample first | **not yet asked.** Thousands of files nobody has read recently is exactly where a surprise lives |
| **instance material** — pot, agent memory, journals, inboxes, chronicles, keyring | required, explicit, his | **required, signed, first** | — | **refused by default.** Not an agent's call, in any circumstance |

**Zero data retention is enterprise-only, under a signed data-processing agreement, and we do not have one.** Until we do, instance material does not leave this machine. The gate encodes that as follows:

- **A pot marker anywhere in the tree → hard refusal, exit 4**, in every mode including the stub. A report that *names* instance material is itself an export of it.
- **Any file whose frontmatter carries a restricted `confidentiality:` value** (`intel`, `excourse`, `private`, `secret`) **→ hard refusal, exit 4**, naming the files.
- **A live classifier call additionally requires**, all four and independently: the corpus profile named on the command line; `--gardener-approval <reference>`; `--dpa-reference <reference>` where the profile demands one; and an environment acknowledgement whose value equals the corpus profile. Two deliberate gestures on two surfaces, so neither a stale shell alias nor a copied command line can carry it alone.

> **At first contact (2026-09-22)** the gate **refused** this repository — one tracked file then carried `confidentiality: intel`. That was the precondition working on its first contact with a real tree, and a finding: a restricted-confidentiality document was sitting in the layer being prepared for publication. **As of 2026-09-23 no tracked file in core carries a restricted `confidentiality:` value in its frontmatter**; the value now appears only in the body of specs that describe it.

---

## 9. Cost and limits, with the arithmetic shown

**Vendor figures (published, 2026-09-22, unverified by us):** 64k total context · **32k state budget**, where state plus the longest question must fit · 70–500 ms end to end · **$0.042 per million input tokens, output free** · 1,200 requests/minute · reachable directly and as a hosted model on the Workers platform we already run.

**Token estimate: bytes ÷ 4.** [ASSUMPTION] No tokenizer is published. The batcher holds back 1,024 tokens of margin, and a size rejection from the vendor is handled as an inconclusive batch and split — never as a clean answer.

**Measured, this repository at its current commit** (169 text files; the one restricted file excluded):

```
usable state per request = 32,768 − 443 (longest question) − 1,024 (margin)
                         = 31,301 tokens

state tokens (2,178,251 bytes of text ÷ 4)              550,584
question set, per request                                 1,973
requests (greedy pack into 31,301, one file chunked)         20
question tokens billed  (20 × 1,973)                     39,460
                                                       ---------
billable input tokens                                   590,044
× $0.042 / 1M input, output free                        $0.0248
```

**Roughly two and a half cents for a full pass over this repository.** Latency, serial: 20 × 0.07 s = **1.4 s** best case, 20 × 0.5 s = **10 s** worst. Against a 1,200 req/min limit, 20 requests is one second of quota.

**Per commit, which is the real operating mode**, only changed files are sent: a typical commit touching five files of average size is under 15,000 tokens, **$0.0006**, one request, well under a second.

**The whole calibration exercise** is a handful of full passes plus the labelled set: **under a dollar of classifier time.** The cost of the pilot is a kin's hours, not the vendor's invoice — which is precisely why the bar in section 4 has to be worth those hours.

**Limits that shape the design, not just the invoice:**

- **32k state, not 64k.** Files over the usable budget are chunked on line boundaries with a 20-line overlap so a finding cannot fall into a seam; chunk provenance travels with the item id.
- **The question set is billed on every request.** At 1,973 tokens across 20 requests it is 6.7% of the bill here. On a corpus of many small files it would dominate — pack batches full.
- **No published benchmark, no paper, no dataset, seven days old at the time of the evaluation.** This is why section 4 exists and why the answer to a miss is *drop*, not *tune*.

---

## 10. Acceptance bar — numbered negative tests

> Preamble, in the house form: each item names the call that watches it and the result that counts. A guard that has not been watched to fail is not a guard. Four guards in this garden ran for a week without biting; not one was found by review.

**T1 — a substring is not a word.** Put the identifier inside ordinary English words (*formation*, *information*, *transformation*) in a file with no standalone occurrence. `readiness_gate.py --selftest` → the file is **clean** in both readers, and `person-identifier` precision stays 1.00. *(Watched: fixture `n01`, `n06`, `n07`; today's live result P=1.00.)*

**T2 — `\b` never enters the rule set, and the ticket rule is watched to match.** `--selftest` inspects every **compiled** rule's pattern string and fails if any contains `\b`; it then asserts that the ticket rule matches a planted ticket identifier. The check is deliberately against the compiled patterns and not against the source text — the source discusses `\b` at length, and a grep over the file would answer a different question from the one asked, which is this spec's subject wearing a different uniform. *(Watched: self-test assertions, plus fixture `p04`, R-INSTANCE-TICKET, 4 matches.)*

**T3 — the engine is named in the report.** Run the gate and read the header → it states `python re, <version>, in process; nothing shells out`. A report that does not name its engine cannot be audited later. *(Watched: report header, live.)*

**T4 — the tree is named, and there is no default.** `readiness_gate.py` with none of `--rev/--artifact/--dirty/--path` → **exit 1**, refusing to guess. With `--dirty` or `--path` → the verdict is stamped `ADVISORY ONLY — a working tree is not a tree that ships` and cannot be a pass. *(Watched: `materialise()`; live — the fixture run reports `working-tree … not a commit`.)*

**T5 — the planted positive is caught, and the gate blocks when it is not.** `--watch-guards` with mutation `drop-planted`, in which reader two returns clean for the canary → **exit 5**, verdict BLOCKED, report states *every clean answer in this run is void*. *(Watched: live, `drop-planted expected 5, got 5`.)*

**T6 — an agent name is never a person.** Mutation `flag-kin` makes reader two flag the agent-credit control → the calibration **fails as disqualifying**, exit 2, with the ruling of 2026-09-22 quoted in the failure line. Without the mutation the control is clean in both readers. *(Watched: live, `flag-kin expected 2, got 2`; failure text names the control and the ruling.)*

**T7 — a malformed answer blocks, it does not pass.** Mutation `malformed` removes one question from one item's answer → that item is **`INCONCLUSIVE`**, verdict BLOCKED, **exit 3**. *(Watched: live, `malformed expected 3, got 3`.)*

**T8 — unreachable is not absent.** Mutation `unreachable` raises from the seam → every item in the batch is `INCONCLUSIVE`, verdict BLOCKED, **exit 3**, and the word *clean* appears nowhere in the verdict. *(Watched: live, `unreachable expected 3, got 3`.)*

**T9 — the classifier cannot overrule a rule.** Feed an answer of `p = 0.01` for a file where a rule of record fired → the row appears as `DISAGREE-CLASSIFIER-CLEAN` **at the top of the queue**, the rule ids are still printed, and the finding is not removed from any count. *(Watched: live, fixture `p02`, `R-PERSON-LOGIN`, p=0.11 — top of the report.)*

**T10 — the second reader buys something.** On `instance-in-capability-layer`, the pair's recall must be **strictly greater** than reader one's alone, or the self-test fails with *"the second reader bought nothing, which is the only thing it was being bought for."* *(Watched: live, reader one R=0.20, pair R=1.00; the assertion is in the self-test, not in prose.)*

**T11 — a pot marker refuses, in every mode.** Place a `pot.json` in a scratch tree and run with `--classifier stub` → **exit 4**, refusal naming the marker. Stub mode is not an exemption: a report that names instance material is an export of it. *(Not yet watched — no fixture. **Owed before this ships.**)*

**T12 — restricted confidentiality refuses, and it already has.** Run against this repository's current commit → **exit 4**, naming the one tracked file carrying `confidentiality: intel`. *(Watched: live, 2026-09-22. This is the only test in the list that was passed by accident, on first contact with a real tree.)*

**T13 — a live call cannot happen by omission.** `--classifier live` without the corpus profile's gardener approval, without the DPA reference where required, or without the environment acknowledgement → **exit 4** at each missing gesture, before any network code is reached. And `--classifier live` **with** all of them, in this build → a refusal stating that no endpoint is configured and that the pilot was approved as a specification, not as a run. *(Watched: `check_preconditions()` and `_classify_live()`; the second is the belt to the first's braces.)*

**T14 — the gate writes nothing.** `--report-json` pointed at a path inside the scanned tree → **exit 1**. And after a full run, the tree's hash is unchanged. *(Path check watched; **the tree-hash assertion is owed** — it is the one that would catch a future contributor adding a convenience write.)*

**T15 — thresholds are fixed before the run and the report can prove it.** The report header carries the SHA-256 of the question file, which contains the thresholds. Change a threshold, re-run, and the hash changes → two results are never comparable by accident. *(Watched: live, header prints `questions.json sha256:…`.)*

**T16 — chunk seams do not swallow findings.** Construct a file larger than the usable state budget with the identifier placed on the last line of the first chunk → it is reported exactly once, with chunk provenance. *(Not yet watched — no oversized fixture. **Owed.** The 20-line overlap is specified but unproven.)*

**Three of sixteen are owed: T11, T14's hash assertion, and T16.** They are named rather than quietly absent, because a bar with unmarked holes is worse than a shorter bar.

---

## Open questions

- **[ASSUMPTION] bytes ÷ 4 as a token estimate.** No tokenizer is published. Everything in section 9 inherits this. The first live run should record the vendor's reported input count against the estimate and the ratio should be recorded with the run.
- **[ASSUMPTION] expected calibration error ≤ 0.15.** A first threshold for a set of this size, stated to be argued with.
- **[ASSUMPTION] the canary's shape.** A synthetic identity record with a documentation-reserved domain, which forced instruction (iii). An alternative is a canary that is not an identity at all — a planted credential, say — which would not need the instruction. Not chosen, because the identifier class is the one that shipped a real person's name.
- **Chunk-level versus file-level scoring.** The bar is written at file level. A chunked file currently contributes several items and one label; whether the classifier's per-chunk answers should be maxed, averaged or reported separately is unsettled and matters only for the handful of files over budget.
- **Whether reader two should see the rule findings.** It does not today, deliberately — an independent second reader is the only kind whose disagreement means anything. But a reader told *"a rule matched here, do you agree?"* is a different and possibly better instrument for the disagreement queue specifically. Two instruments, two calibrations; not in the pilot.
- **Where the report goes when the gate runs per commit.** Section 7 forbids writing into the corpus; it does not say where the record lives instead. That is a question for whoever owns the ledger convention.

---

## Fuji-shin's verification — **BAR INSUFFICIENT** (2026-09-22)

Run, not read: every claim below was reproduced against the code. `T1`, `T2`, `T6` and `T10` are genuine guards he watched bite; `T12` and `T13` hold on a real tree. The machinery is careful. **The bar is not**, and the holes are in the load-bearing parts.

**The finding that decides the pilot: the calibration is circular, and the output shows it.** Reader one alone scores **P=1.00 R=1.00 on three of the four classes**. Deterministic patterns do not do that on an independently built set — they do it here because the corpus was written to contain exactly the profile's tokens, by the hand that wrote the rules, on the same afternoon, from the same evidence. `labels.json` says as much: *"what is preserved is the PROPERTY of each stratum"* — and the properties preserved are the ones the rules already express. Positives per class are **3 / 1 / 3 / 5**; the one-sided 95% lower bounds on those perfect recalls are **0.37, 0.05, 0.37, 0.55**. "Credential recall 1.00" is one file, and is consistent with a true recall of 5%. **Three of the four headline rows are structurally insensitive to the second reader** — a classifier that answered *clean* to everything still scores 1.00 on them, because `gate_hit = rule_hit or classifier_hit` and the rules are already perfect on the set. The whole discriminating power of the exercise is **one authored file**. So: **do not run the pilot against this set, and do not quote ratios from it.** Either a fresh set built by a hand that has not seen the rules (40–60 files, ≥10 positives per class, credential shapes beyond `KEY=value`), or the pilot is stated as **unmeasured**.

**The second finding is this spec's own founding failure, rebuilt inside it: the gate issues a clean bill over a tree that does not exist.** `--path /definitely/does/not/exist` → exit 2, a printed report, *"planted positive: CAUGHT"*, *"0 item(s) reported clean"*, no error. A mistyped path, an empty artefact or a wrong `--root` and the gate says the tree is fine. **A zero is a claim.**

**Blocking, in his order:** (1) zero-tree blindness, above. (2) **The kin mask deletes real findings silently** — a rule hit overlapping a kin-shaped span is suppressed with no trace and no count, and the shape matches *Kansai, Hokusai, Mushin*; `Hokusai@realcorp.com`, `Quilla Farrow-sai`, `/Users/Bonsai-shin/dev/x` and `Kansai.lan` all fire a rule and are all reported as nothing. (3) **Reader two's second stratum is untested** — §1 names two things a pattern cannot do, and only one has a fixture; the missing `break-rule` mutation is cheap and he confirmed it would hold. (4) the calibration set, above. (5) `--report-json` containment is checked against the materialised tempdir, so under `--rev` a report can be written into the very repository it just cleared. (6) **silent file skips** — unreadable, undecodable, unlisted-suffix, symlinked-directory and pruned-directory files are dropped rather than reported inconclusive; `LICENSE`, `Dockerfile` and `.env` were never read, and the `.env` held a token. (7) **the pot refusal guards a marker nothing plants** — zero `pot.json` exist in any of the seven repos, a marker inside a pruned directory is missed, and a *quoted* `confidentiality: "intel"` bypasses the other refusal. (8) the chunk seam: the 20-line overlap **guarantees** duplicates, so T16's "exactly once" contradicts the design; no de-duplication, no split, no 413 handling, and the batcher reserves 443 tokens for questions where a request sends 1,973 — 1,530 short against a 1,024 margin. (9) `QUESTION_FOR_CLASS` and `act_score`'s hard-coded pair are second and third masters of `questions.json`; renaming a `q-layer` option — which §3 calls an ordinary recalibration — makes the load-bearing class score 0.0 for every file, **silently clean**. (10) three mechanisms are specified in prose with **no implementation**: expected calibration error, bounded retries, and `--plant-waiver` stamping (accepted, checked, then discarded — so "there is no silent path" is false). (11) the owed list in §10 is wrong: **three owed, plus three unasserted** (T3, T9, T15 — `print_report()` is untested code) **plus three unimplemented**. (12) the credential rule is one shape wide — JSON-quoted assignments and bare high-entropy secrets (`AKIA…`, a JWT, `ghp_…`) all pass.

**Non-blocking:** `q-severity` is billed on every request and never read; `.env.example` is unreachable in `TEXT_SUFFIXES`; `_redact` is weak and currently dead; `extractall` is unfiltered on 3.9. **Measured and not a problem:** CJK density in core is 0.47%, so bytes÷4 is safe *for this tree* — and nothing says which tree it was validated against, which is not safe for a pot.

**Status after this verdict: draft, carrying the verdict.** The spec is committed so the work is not lost and the gaps are on the record. **The gate is not to be trusted, and the pilot is not to be run**, until at least gaps 1–4 are closed. Nothing here was committed as *verified*.
