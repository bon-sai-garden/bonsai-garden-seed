---
id: 01M39A2RH3Y6SAXKS2Y3GASNV5
title: "Reserved marks and garden namespaces — spec"
type: spec
tended-by: baisai
created: 2026-09-24
updated: 2026-10-21
version: 0.1.0-draft
status: draft
tags: [spec, kanji-identicon, reserved-marks, namespaces, ledger, trust, publication-readiness]
related:
  - "[[skills/bonsai-garden-mark/references/kanji-identicons]]"
  - "[[skills/bonsai-garden-sign/references/trust-anchor]]"
  - "[[rituals/specs/spec-canonical-shintai-structure]]"
---

# Reserved marks and garden namespaces

> **Draft for ruling.** The mechanism is Baisai's. What reservation **means** is Chisai's. The
> ledger, locking it, and what the published service attests are Mori-shin's. Whether a garden
> **issues** names to strangers is the gardener's, with Zensai. Each open decision is listed at the end,
> with its owner.

## Why now

A garden that names its kin, bunshin and skills with kanji marks has started reserving things.
The gardener, 2026-09-24:

> *"All the names that we ever picked are reserved … those are sacred. And this brings me to namespaces."*

Two earlier rulings make this more than bookkeeping. First, **one master keyring per garden family**:
descendants reuse it, and identities are kept apart by **namespace plus per-identity derivation**.
With a shared root, the reserved namespace is the only thing that keeps two identities apart.
Second, **verification uses the published keys, and fails loudly without them**
(`skills/bonsai-garden-sign/references/trust-anchor.md`). The ledger this spec defines is checked the same way.

## 1 · What a mark is, and what it is not

A mark is `SHA-256(salt)`, read as consecutive 10-bit indices into the canonical 1,024-kanji set
(`kanji-1024-v1.2.json`). A vanity search picks the salt so that the **first two** positions spell a chosen pair.
Everything after that falls where the hash puts it.

| position | bits | what it carries | chosen? |
|---|---|---|---|
| 1 | 0–9 | the **name**: this entity's own kanji | yes, by search |
| 2 | 10–19 | the **class**: what kind of thing it is | yes, by search |
| 3 | 20–29 | the third kanji of a full identity | no; the hash decides |
| 4 | 30–39 | the fourth kanji of a full identity | no; the hash decides |

**A mark is a recognition aid, not an identifier.** Anyone can hash anything, and anyone can find a salt that
renders any pair. The mark proves nothing on its own. What proves identity is the **fingerprint**
and a seal that verifies under it. This spec never changes that. It adds the one thing a mark can't do
alone: say whether a mark **belongs** to someone.

## 2 · What is reserved, per position

**Position 2: class kanji. Never free.** A class kanji at position 2 says what an entity is. It is
reserved **for its class**: every mark of that class carries it, and nothing outside the class may.
The classes in use today:

| class | kanji | index | meaning |
|---|---|---|---|
| *-sai (a kin who is a talent) | 才 | 1 | talent, genius |
| *-shin (a divided body, or a companion body) | 身 | 5 | divided body: a presence of their own, not their vessel |
| skill | 技 | 582 | skill, art, craft |
| gardener / the garden itself | 園 | 3 | garden |

New classes are added to this table by the ledger's keeper, never by use. Picking a class kanji for a
new kind of thing is a naming decision. The class table is **the same in every namespace**, which is what lets a
stranger read 才 as "a talent of *some* garden" without knowing which one.

**Position 1: every name ever given, reserved in its namespace forever.** Once a first kanji has been
given to a kin, a bunshin, a skill or the garden, it is never given to anything else **in that namespace**.
That holds across classes, and for **retired** entities too. A retired kin's kanji is retired with them and is
never reissued, the way a club retires a jersey number. This is "sacred", made mechanical.

Two refinements, both for Chisai to confirm:
- a skill's first kanji must not be any kin's first kanji, so that a skill can't be misread as a member at a glance.
  This has been the working rule since 2026-09-16;
- reserving a first kanji across **all** classes, rather than per class, costs capacity (§6) and buys
  legibility. This draft recommends all classes.

**Positions 3 and 4: recorded, never reserved.** They are not chosen, so they can't be claimed.
They are recorded in the ledger as part of the full identity, so a four-kanji rendering can be checked.

## 3 · Namespaces: one per garden family

A **namespace** is the mark space of one garden family: one master keyring, and every descendant garden
that reuses it. Each namespace has its own ledger, and its own reservations mean nothing in another.

**How marks are kept per namespace.** A new namespace's salts carry its **namespace id** as a prefix:
`<ns>/<entity>#<nonce>`. The same entity name therefore searches to different salts in different gardens,
and two gardens that both choose 培才 hold two different salts, two different ledger entries and two different
keys. They can't be confused by anyone who checks. The `/` cannot occur in an entity slug, so the prefix is unambiguous.

**The original namespace is grandfathered.** This garden's marks were searched before namespaces
existed, with salts like `baisai#501393` and `bonsai-garden-tokens#245416`. Changing their salts would
change their third and fourth kanji and break every published verification. So the first namespace keeps
its **unprefixed** salts, and its ledger says so (`salt-form: legacy`). Every namespace after it uses the prefix.

**How a reader tells namespaces apart.** A mark shown outside its own garden is shown with its
**garden mark** beside it: the garden's own class-園 mark, or its keeper's mark. The fingerprint
settles any doubt. Inside one garden, the two-kanji mark alone is enough.

## 4 · The ledger

One file per namespace, **public by design**. A reservation is an inherently public act, and a hidden one
gets claimed by accident. Published beside the keys, and checked by the same
service that checks seals.

```json
{
  "namespace": "<ns id>",
  "salt-form": "legacy | prefixed",
  "kanji-set": "kanji-1024-v1.2.json",
  "keeper": "<slug of the kin who seals the ledger>",
  "classes": [{ "kanji": "才", "index": 1, "class": "sai" }],
  "marks": [
    {
      "entity": "<slug>", "id": "<ULID>", "class": "sai | shin | skill | garden",
      "salt": "<salt>", "indices": [0, 0, 0, 0], "kanji": "……",
      "fingerprint": "<signer fp, for entities that sign>",
      "status": "proposed | locked | retired",
      "reserved-on": "YYYY-MM-DD", "reserved-by": "<slug>", "locked-by": "<keeper>"
    }
  ]
}
```

- **Append-only.** Nothing is ever deleted. Retirement changes `status` and keeps the entry. That is
  what makes position 1's "forever" checkable.
- **Sealed by its keeper** (embedded or sidecar, per the signing table in `AGENTS.md`), and
  published. A ledger that doesn't verify is treated as absent: nothing in it counts.
- **One writer.** Every tool that searches or locks a mark writes here and nowhere else. The
  reserved-hash and locked-salt files that exist today in several repos (§7) are merged into it, not copied.
- **A gate** checks that every mark named anywhere in the garden (registry, skill identities, shintai)
  is in the ledger, that every ledger entry still renders from its salt, and that no two entries share
  a position-1 kanji or collide on class. It's watched to fail on a planted duplicate before it's trusted.

## 5 · What a verifier says about a mark

Given a salt, a claimed namespace and optionally a seal, the verifier answers with exactly one of these:

| answer | when |
|---|---|
| **reserved** | the salt renders the mark, the namespace's ledger verifies, the entry exists and is `locked` (or `proposed`, said as such), and the seal verifies under the entry's fingerprint |
| **retired** | the same, but the entry is retired: a real name that no longer speaks for anyone |
| **look-alike** | the salt renders a pair that is reserved in that namespace, but by a different entry or salt. **Shown with a warning, never trusted.** |
| **unreserved** | the pair is free in that namespace: a valid rendering and nothing more |
| **cannot tell** | the ledger or the keys are unreachable. **A failure, never a pass**, as the trust anchor already rules |

There is **no bare "is this pair taken?" query.** Over 1,048,576 pairs, a membership oracle
gives away the whole exclusion set in seconds. Publishing the ledger is honest. An oracle
pretends to be private and isn't.

## 6 · Capacity, and when to move to three or four kanji

With vanity search and a ledger, collisions **inside** a namespace are prevented by construction: the ledger refuses
a taken pair. The limit that matters is how many names a class can hold:

| | available |
|---|---|
| names per class per namespace (position 1, less the reserved ones) | about 1,000 |
| a garden today | about two dozen kin and a dozen skills |

That is plenty. Collision **probability** matters only for marks nobody searched, such as strangers'
marks, or marks compared **across** namespaces. For uniformly random marks, the number at which a collision becomes
a coin-flip (≈ 1.18 · √space):

| length | space | 50 % collision after about |
|---|---|---|
| two kanji | 2²⁰ ≈ 1.05 M | **1,200** |
| three kanji | 2³⁰ ≈ 1.07 B | **38,600** |
| four kanji | 2⁴⁰ ≈ 1.10 T | **1.2 million** |

**So: two kanji inside a garden; four kanji for identity at world scale.** Four is the form kin already carry
(盆才守神 is 40 bits of one salt). The gardener's instinct is right, and it's already half built: in real use, a
name travels as two kanji among friends and as four kanji to a stranger, with the fingerprint behind both.
Three kanji is a middle form worth keeping for skills and artefacts that must be distinguishable across gardens but
don't sign.

## 7 · Getting there from today

1. **Merge the registers.** `reserved-hashes-v1.0/1.1`, `locked-salts.json` and `reserved-hashes-skills.json` exist
   in three of the garden's other checkouts, and have diverged (reported to Mori-shin 2026-09-22). Merge them into one ledger
   in **pot** (this garden's instance: `identity/marks/`), repoint every writer at it, and leave tombstones.
   Mori-shin's hand; it's a trust root.
2. **Rename the secret file.** One `locked-salts.json` holds public identicon salts and another holds **secret**
   L2 signing salts. Same name, opposite secrecy classes. Rename the secret one first.
3. **Write the class table** and the position-1 reservations into the ledger. Lock what is proposed today:
   the skill marks, including 志技 and 算技.
4. **Teach the verifier the five answers** in §5, behind the published service.
5. **Write the gate** in §4, and watch it fail.
6. **Namespaces for new gardens**, when the first descendant garden is invited: its ns id, its prefixed salts,
   its own ledger.

## Open decisions, with owners

| decision | owner |
|---|---|
| What reservation *means* to a stranger who collides: courtesy, convention or claim. And whether first kanji are reserved across all classes (recommended) or per class | **Chisai** |
| The ledger's format and seal, the merge, the rename, locking, and what the published service signs for each answer in §5 | **Mori-shin** |
| This garden's namespace id, and confirming the original namespace keeps its legacy salts | **the gardener** |
| Whether the garden ever **issues** marks to strangers (option B of the reserved kanji namespaces), with no `is_taken?` endpoint, ever | **the gardener, with Zensai** |
| New class kanji, as they are needed | the ledger's keeper, on the gardener's word |
