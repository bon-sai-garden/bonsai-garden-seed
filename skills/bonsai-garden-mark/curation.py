#!/usr/bin/env python3
# ---
# id: 01M3BS43J3QTW68PG7FPRD3HE9
# ---
"""
curation.py — produce kanji-1024.json from Jōyō 2010.

Pipeline:
  1. Parse the workshop's kanji-to-number.md to get all 2,136 Jōyō kanji
     with stroke count and grade.
  2. For each kanji, look up English meanings via jamdict (KANJIDIC2).
  3. Apply filters: stroke window, negative-meaning regex, visual-confusable
     clusters, variant-form pruning.
  4. Sort by familiarity (grade ascending, then index in source).
  5. Take exactly 1,024.
  6. Emit kanji-1024.json with index, kanji, strokes, grade, meanings.

This is a deterministic, reproducible curation. The output is the moral
commitment — re-running with the same source data and filter rules must
produce the same 1,024 in the same order.
"""

import json
import re
import sys
from pathlib import Path

try:
    from jamdict import Jamdict
except ImportError:
    print("jamdict not installed. Run: pip install jamdict jamdict-data --break-system-packages", file=sys.stderr)
    sys.exit(1)


REPO = Path("/sessions/blissful-funny-knuth/mnt/bonsai-garden")
SOURCE = REPO / "lore/signatures/kanji/kanji-to-number.md"
# Generator output. Deliberately NOT a live set filename: regenerating must never
# clobber the canonical set (kanji-1024-v1.2.json) or an archived one (*.json.bak).
# v1.0 was produced by this script; v1.1 and v1.2 were curated from it by hand.
OUT = REPO / "tools/kanji-identicon/kanji-1024-REGENERATED.json"
TARGET_SIZE = 1024


# ─────────────────────────────────────────────────────────────────────────────
# 1. Source data parsing
# ─────────────────────────────────────────────────────────────────────────────


def parse_source() -> list[dict]:
    """Parse the markdown table from kanji-to-number.md.
    Returns: list of {kanji, strokes, grade}, in source order."""
    rows = []
    text = SOURCE.read_text(encoding="utf-8")
    for line in text.splitlines():
        m = re.match(r"^\|\s*(\S)\s*\|\s*(\d+)\s*\|\s*(\S+)\s*\|", line)
        if not m:
            continue
        kanji, strokes, grade = m.group(1), int(m.group(2)), m.group(3)
        if kanji == "Kanji":  # header row
            continue
        rows.append({"kanji": kanji, "strokes": strokes, "grade": grade})
    return rows


# ─────────────────────────────────────────────────────────────────────────────
# 2. Filters
# ─────────────────────────────────────────────────────────────────────────────

# Stroke window: 4-14 inclusive.
STROKE_MIN, STROKE_MAX = 4, 14


# Negative-meaning regex. Word-boundary-anchored to avoid matching e.g.
# "harvest" against /har/. Matches any meaning string containing these terms.
NEGATIVE_TERMS = [
    # death and dying — prefix-match to catch "deathly", "dying", "deceased"
    r"\bdeath",
    r"\bdead",
    r"\bdie\b",
    r"\bdying",
    r"\bdied",
    r"\bcorpse",
    r"\bperish",
    r"\bmortal",
    r"\bdeceas",
    r"\bgrave\b",
    r"\bcoffin",
    r"\bfuneral",
    r"\btomb",
    r"\bcemetery",
    # killing
    r"\bkill",
    r"\bslay",
    r"\bslaughter",
    r"\bexecut(e|ion)",
    r"\bmurder",
    r"\bassassin",
    r"\bsuicide",
    # violence and weapons
    r"\bwar\b",
    r"\bbattle",
    r"\bcombat",
    r"\bweapon",
    r"\bsword",
    r"\bblade",
    r"\bspear",
    r"\bhalberd",
    r"\barrow",
    r"\bbullet",
    r"\bgun\b",
    r"\bbomb",
    r"\bcannon",
    r"\battack",
    r"\bassault",
    r"\bstrike\b",
    r"\bsmite",
    r"\bbeat\b",
    r"\bbeating",
    r"\btorture",
    r"\babuse",
    r"\babusiv",
    r"\bcruel",
    r"\bhostag",
    r"\bcaptiv",
    r"\bslave",
    r"\bslavery",
    r"\bstab",
    r"\bthrust\b",
    r"\bpierce",
    r"\bgore\b",
    # injury and wound
    r"\bwound",
    r"\binjur",
    r"\bharm\b",
    r"\bharmful",
    r"\bhurt\b",
    r"\bdamag",
    r"\bbleed",
    r"\bblood",
    r"\bscar\b",
    r"\bscarring",
    # illness, disease, pain
    r"\bsick",
    r"\bill\b",
    r"\billness",
    r"\bdiseas",
    r"\bdisord",
    r"\bfever",
    r"\bplague",
    r"\bepidemic",
    r"\binfect",
    r"\bvirus",
    r"\bcancer",
    r"\btumor",
    r"\bcyst",
    r"\bsymptom",
    r"\bpox\b",
    r"\bleprosy",
    r"\bparalys",
    r"\bsuffer",
    r"\bpain(?!t)",
    r"\bagony",
    r"\bache\b",
    r"\bsore\b",
    r"\bblister",
    r"\bswell\b",
    r"\bdistress",
    # crime and dishonesty
    r"\bcrime",
    r"\bcriminal",
    r"\bsteal",
    r"\btheft",
    r"\brob\b",
    r"\brobbery",
    r"\bburglary",
    r"\bfraud",
    r"\bdeceiv",
    r"\bdeceit",
    r"\bdeception",
    r"\bswindl",
    r"\bcheat",
    # negative emotion
    r"\bhate",
    r"\bhatred",
    r"\bloath",
    r"\bdetest",
    r"\banger\b",
    r"\bangry",
    r"\bfury",
    r"\bfurious",
    r"\bwrath",
    r"\brage",
    r"\bresent",
    r"\bgrudge",
    r"\bdespair",
    r"\bgrief",
    r"\bgriev",
    r"\bmourn",
    r"\bshame",
    r"\bdisgrace",
    r"\bhumiliat",
    r"\bfear",
    r"\bdread",
    r"\bterror",
    r"\bhorror",
    r"\bfright",
    r"\bafraid",
    r"\bscared",
    r"\bsad\b",
    r"\bsadness",
    r"\bsorrow",
    r"\bjealous",
    r"\benvy",
    r"\benvious",
    r"\blonely",
    r"\bsolitar",
    r"\bgloom",
    r"\bgrim\b",
    r"\bweep",
    r"\bcry\b",
    r"\bcrying",
    r"\btears?\b",
    r"\bscold",
    r"\brebuke",
    r"\bblame",
    r"\bchastise",
    r"\btorment",
    r"\boppression",
    r"\boppress",
    # taboo
    r"\bdemon",
    r"\bdevil",
    r"\bhell\b",
    r"\bsatan",
    r"\bcurse",
    r"\bevil\b",
    r"\bwicked",
    r"\bsinful",
    r"\bsin\b",
    r"\bghost",
    r"\bhaunt",
    r"\bcorrupt",
    # discrimination / negative descriptors
    r"\bdiscrim",
    r"\binferior",
    r"\bvulgar",
    r"\bobscene",
    r"\bbarbar",
    r"\bsavage",
    r"\bugly",
    r"\bfilth",
    r"\bdirty",
    r"\blewd",
    r"\bnaked",
    r"\bnude",
    r"\bvain\b",
    r"\bvanity",
    r"\bdeform",
    # bodily functions
    r"\burine",
    r"\bfeces",
    r"\bexcrement",
    r"\bvomit",
    r"\bdrool",
    r"\bmucus",
    r"\bsnot\b",
    r"\bsaliva",
    # body parts felt as clinical / sensitive
    r"\bskeleton",
    r"\bskull",
    r"\bintestin",
    r"\bbowel",
    r"\borgan\b",
    r"\bnipple",
    r"\bbreast",
    r"\bfetus",
    r"\bembryo",
    r"\bwomb",
    r"\bcastrat",
    r"\bbrothel",
    r"\bprostitut",
    # negative outcomes
    r"\bpoison",
    r"\btoxic",
    r"\bvenom",
    r"\bdecay",
    r"\brot\b",
    r"\brott",
    r"\bdecompos",
    r"\bdrought",
    r"\bdisaster",
    r"\bcalamity",
    r"\bcatastrophe",
    r"\bruin\b",
    r"\bdestroy",
    r"\bdestruction",
    r"\bsacrifice",
    r"\bquarrel",
    r"\bdispute",
    r"\bcondemn",
    r"\barrest",
    r"\bcapture",
    r"\bimprison",
    r"\bjail\b",
    r"\bprison",
    r"\bdrown",
    r"\bsuffocat",
    r"\bbully",
    r"\binsult",
    # disability-adjacent words best avoided as labels
    r"\bwidow",
    r"\borphan",
    r"\bblind\b",
    r"\bdeaf\b",
    r"\bmute\b",
    r"\bpregnan",
    r"\bmiscarr",
    # negative modifiers / value-words
    r"\bbad\b",
    r"\bnegative\b",
    r"\bemptiness\b",
    r"\bvoid\b",
    r"\bfailure",
    r"\bdefeat",
    # additional sensitive terms surfaced in audit rounds
    r"\bobese",
    r"\bobesity",
    r"\bkidnap",
    r"\babduct",
    r"\bcrush\b",
    r"\bintimidat",
    r"\bthreaten",
    r"\bthreat\b",
    r"\bchoke",
    r"\bchoked\b",
    r"\bsmother",
    r"\bsuffocat",
    r"\bregret",
    r"\brepent",
    r"\bremorse",
    r"\bcoerce",
    r"\bcoercion",
    r"\bdebauch",
    r"\bdisgust",
    r"\bloathsome",
    r"\bextinct",
    r"\bperish",
    r"\bbarren",
    r"\bsterile",
    r"\bidiot",
    r"\bstupid",
    r"\bfoolish",
    r"\bcoward",
    r"\bswamp",
    r"\bgrave\b",
    r"\bdesolat",
]

NEGATIVE_REGEX = re.compile("|".join(NEGATIVE_TERMS), re.IGNORECASE)


# Visual confusable clusters — keep the first, drop the rest.
# Hand-curated; conservative. The aim is to drop the *most dangerous*
# look-alikes (the ones that fool a reader on first glance), not every
# pair that shares a radical.
CONFUSABLE_CLUSTERS = [
    # Genuinely indistinguishable pairs (single-stroke or single-detail differences
    # that confuse readers on first glance). Kept conservative — many earlier
    # cluster entries (王/主, 田/由/申/甲, 雷/雪/雲, etc.) are visually distinct
    # enough at identicon size and should NOT be dropped.
    "土士",  # earth / samurai — only horizontal-bar length differs
    "末未",  # end / not yet — only which bar is longer
    "千干",  # thousand / dry — only the top stroke differs
    "大太犬",  # big / fat / dog — single dot placement
    "矢失",  # arrow / lose — single stroke difference at top
    "人入",  # person / enter — mirror direction
    "己已巳",  # self / already / snake — closed-loop variants
    "戊戍戌",  # the calendar trio — virtually identical
    "牛午",  # cow / noon — top stroke direction
    "力刀",  # power / sword — single-line difference
    "玄幺",  # mystery / tiny — only first is jōyō
]


# Variant-form pruning. Pairs where modern usage strongly prefers one form,
# or where one is the old (旧字体) form of the other. Keep first, drop second.
VARIANT_DROPS: set = {
    # Some examples — KANJIDIC marks variants but they may both be in jōyō.
    # Conservative for now; the visual-confusable filter catches the most
    # confusing cases. Can extend after first review.
}


# Priority kanji — guaranteed to land in the final 1,024 regardless of grade-rank,
# stroke window, or any filter. These are deliberate inclusions; they bypass
# stroke-window, meaning-filter, and confusable-cluster pruning.
#
# Currently lists the workshop's defining kanji so the identicon system can
# represent the workshop's named entities. Add to this list with intent —
# every entry occupies a slot in the 1,024-set.
PRIORITY_INCLUDE = [
    # the *-sai talent-kanji shared by all six gardeners
    "才",  # Xsai (Tasai/Zensai/Eisai/Hissai/Baisai/Jisai) — 3 strokes, deliberately included
    # the first kanji of each *-sai
    "禅",  # Zensai
    "多",  # Tasai
    "映",  # Eisai
    "筆",  # Hissai
    "培",  # Baisai
    "慈",  # Jisai
    # Fuji-shin
    "富",  # Fuji-shin first
    "士",  # Fuji-shin middle (3 strokes — deliberately included)
    "身",  # Fuji-shin last
    # Aruji
    "主",  # Aruji
    # Bonsai garden — full name 盆栽園 "bonsai-en"
    "盆",  # Bonsai first
    "栽",  # Bonsai/Baisai role-compound second
    "園",  # Bonsai-en third / garden
]


def is_clean_meaning(meanings: list[str]) -> tuple[bool, str]:
    """Return (passes, reason). meanings is the list of English glosses."""
    if not meanings:
        return False, "no meanings available"
    for m in meanings:
        if NEGATIVE_REGEX.search(m):
            return False, f"negative term in meaning: {m!r}"
    return True, ""


# ─────────────────────────────────────────────────────────────────────────────
# 3. Familiarity ranking
# ─────────────────────────────────────────────────────────────────────────────

GRADE_RANK = {
    "g1": 1,
    "g2": 2,
    "g3": 3,
    "g4": 4,
    "g5": 5,
    "g6": 6,
    "jōyō": 7,
    "joyo": 7,  # secondary-school jōyō (no specific grade)
}


PRIORITY_SET = set(PRIORITY_INCLUDE)


def familiarity_key(row: dict, src_index: int) -> tuple:
    """Lower = more familiar. Priority-included kanji sort first; ties broken
    by source-file order so the result is deterministic."""
    priority_bucket = 0 if row["kanji"] in PRIORITY_SET else 1
    return (priority_bucket, GRADE_RANK.get(row["grade"], 99), src_index)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Pipeline
# ─────────────────────────────────────────────────────────────────────────────


def main():
    print("Loading source list...", file=sys.stderr)
    rows = parse_source()
    print(f"  source: {len(rows)} kanji from {SOURCE.name}", file=sys.stderr)

    print("Looking up meanings via jamdict (KANJIDIC2)...", file=sys.stderr)
    jam = Jamdict()
    for i, row in enumerate(rows):
        res = jam.lookup(row["kanji"])
        if res.chars:
            row["meanings"] = list(res.chars[0].meanings(english_only=True))
        else:
            row["meanings"] = []
        if i % 200 == 0:
            print(f"  ...{i}/{len(rows)}", file=sys.stderr)

    print("Applying filters...", file=sys.stderr)
    dropped = {"stroke": 0, "meaning": 0, "confusable": 0, "variant": 0, "no_meaning": 0}

    # Stroke window — priority kanji bypass this filter.
    survivors = []
    for r in rows:
        if r["kanji"] in PRIORITY_SET or (STROKE_MIN <= r["strokes"] <= STROKE_MAX):
            survivors.append(r)
        else:
            dropped["stroke"] += 1
    print(
        f"  after stroke window {STROKE_MIN}-{STROKE_MAX}: {len(survivors)} (dropped {dropped['stroke']})",
        file=sys.stderr,
    )

    # Meaning filter — priority kanji bypass this filter.
    next_survivors = []
    drop_log = []
    for r in survivors:
        if r["kanji"] in PRIORITY_SET:
            next_survivors.append(r)
            continue
        ok, reason = is_clean_meaning(r["meanings"])
        if ok:
            next_survivors.append(r)
        else:
            if "no meanings" in reason:
                dropped["no_meaning"] += 1
            else:
                dropped["meaning"] += 1
            drop_log.append(f"{r['kanji']} ({r['strokes']} strokes, {r['grade']}): {reason}")
    survivors = next_survivors
    print(
        f"  after meaning filter: {len(survivors)} (dropped {dropped['meaning']} on meaning, {dropped['no_meaning']} on missing data)",
        file=sys.stderr,
    )

    # Confusable filter — priority kanji bypass this filter.
    drop_set = set()
    for cluster in CONFUSABLE_CLUSTERS:
        for ch in cluster[1:]:
            if ch not in PRIORITY_SET:
                drop_set.add(ch)
    survivors = [r for r in survivors if r["kanji"] not in drop_set]
    dropped["confusable"] = len(drop_set & {r["kanji"] for r in rows})
    print(
        f"  after confusable filter: {len(survivors)} (dropped ~{dropped['confusable']} as look-alikes)",
        file=sys.stderr,
    )

    # Variant pruning
    survivors = [r for r in survivors if r["kanji"] not in VARIANT_DROPS]

    # Familiarity sort
    survivors_with_idx = [(r, i) for i, r in enumerate(survivors)]
    survivors_with_idx.sort(key=lambda pair: familiarity_key(pair[0], pair[1]))
    survivors = [r for r, _ in survivors_with_idx]

    # Take exactly TARGET_SIZE
    if len(survivors) < TARGET_SIZE:
        print(f"  WARNING: only {len(survivors)} survivors, need {TARGET_SIZE}. Loosen filters.", file=sys.stderr)
        final = survivors
    else:
        final = survivors[:TARGET_SIZE]

    # Emit
    out = {
        "version": 1,
        "size": len(final),
        "source": "KANJIDIC2 / Jōyō 2010 via jamdict-data",
        "filter_rules": {
            "stroke_window": [STROKE_MIN, STROKE_MAX],
            "negative_meaning_terms": len(NEGATIVE_TERMS),
            "confusable_clusters": len(CONFUSABLE_CLUSTERS),
            "sort": "grade ascending, then source order",
        },
        "kanji": [
            {
                "index": i,
                "char": r["kanji"],
                "strokes": r["strokes"],
                "grade": r["grade"],
                "meanings": r["meanings"][:5],  # first 5 only, for size
            }
            for i, r in enumerate(final)
        ],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT} ({len(final)} kanji)", file=sys.stderr)

    # Quick stats
    by_grade = {}
    by_strokes = {}
    for r in final:
        by_grade[r["grade"]] = by_grade.get(r["grade"], 0) + 1
        by_strokes[r["strokes"]] = by_strokes.get(r["strokes"], 0) + 1
    print(f"\nGrade distribution: {dict(sorted(by_grade.items()))}", file=sys.stderr)
    print(f"Stroke distribution: {dict(sorted(by_strokes.items()))}", file=sys.stderr)

    # Sample
    print("\nFirst 30 (most familiar):", file=sys.stderr)
    for r in final[:30]:
        print(
            f"  {r['index']:4d}  {r['char']}  ({r['strokes']} strokes, {r['grade']})  {', '.join(r['meanings'][:3])}",
            file=sys.stderr,
        )
    print("\nLast 10 (least familiar in selection):", file=sys.stderr)
    for r in final[-10:]:
        print(
            f"  {r['index']:4d}  {r['char']}  ({r['strokes']} strokes, {r['grade']})  {', '.join(r['meanings'][:3])}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
