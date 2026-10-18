#!/usr/bin/env python3
# ---
# id: 01M48J5F557D9S1ZFTSPYH50W8
# ---
"""Build the Garden Walk pages (Eisai, 2026-10-06, draft 0.1).

Source is src/*.html (the part inside <main>) and walk.css/walk.js. This writes, beside itself:
  the ten pages  NN-slug.html   (standalone, open from disk)
  index.html                    (the storyboard: every page in a frame, for review; core only)
  pages.json                    (the contract the site build reads: file, route, title, phase)

  build.py            write everything
  build.py --check    rebuild in memory, fail (exit 1) if anything on disk differs, or a guard fails

Guards, because a guard is not trusted until it has been watched to fail:
  - Words that are ours may not appear in what a gardener reads before the turn (pages 00 to 04b).
  - No page carries an eight-character hex string (the public Teams page refuses them; so does this).
  - walk.js reaches no network and keeps nothing: the pages' promise that what you type stays on the page.
Stdlib only.
"""

import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
LOGO = "../../../../bonsai-garden-logo.svg"  # core root; the site build rewrites it
OVERLAY = None  # --src DIR: page bodies that replace src/ ones, file by file (a content set)

# stem, route, step label (for the path), phase, title, description, id
PAGES = [
    (
        "00-gate",
        "",
        None,
        "gate",
        "Walk with me?",
        "The gate: a short welcome, and a promise that nothing is set up until you say so.",
        "01M48J5FAG0SHMF2V7WQEEP3EC",
    ),
    (
        "01-about-you",
        "about-you",
        "About you",
        "walk",
        "First, about you",
        "Step one of the walk: a name to call you by, in fields, in your own words, or through a few questions.",
        "01M48J5FHA6WH23755T8RP6997",
    ),
    (
        "02-what-its-for",
        "what-its-for",
        "What it's for",
        "walk",
        "Second, what it's for",
        "Step two of the walk: a few questions about what you want your garden to do, written down in your words.",
        "01M48J5FVKQYET9Q4W657Y75XA",
    ),
    (
        "03-whos-with-you",
        "whos-with-you",
        "Who's with you",
        "walk",
        "Third, who's with you",
        "Step three of the walk: one companion beside you, and a guardian for your garden.",
        "01M48J5FZJDFAQ909KYYR0JHCS",
    ),
    (
        "04-imagine-them",
        "imagine-them",
        "Imagine them",
        "walk",
        "Fourth, imagine them",
        "Step four of the walk: you imagine your companion, and five lenses say what they see before anything is written down.",
        "01M48J5G4AAM3Y219XDQGN0RJ0",
    ),
    (
        "04b-the-turn",
        "the-turn",
        "Your word",
        "turn",
        "The turn",
        "The turn: nothing has been set up; to go on, you say so in your own words.",
        "01M48J5G9CJN2HZ6WJD7EJEY35",
    ),
    (
        "05-the-tools",
        "the-tools",
        "Tools",
        "plant",
        "Fifth, the tools",
        "Step five: the tools your garden needs, installed by your own hand.",
        "01M48J5GFNR1A8KTYXNF70Y947",
    ),
    (
        "06-home-and-keys",
        "home-and-keys",
        "Home & keys",
        "plant",
        "Sixth, a home, a key, a name",
        "Step six: a home for your garden, a key that stays yours, and names.",
        "01M48J5GN0DXR5MYHYGKSJ61HV",
    ),
    (
        "07-signing",
        "signing",
        "Signing",
        "plant",
        "Seventh, the two promises",
        "Step seven: your promise and your guardian's, sealed together at the same moment.",
        "01M48J5GVFV2PD7YDZ89KFV5N5",
    ),
    (
        "08-calling-home",
        "calling-home",
        None,
        "end",
        "Calling home",
        "After the signing: public things go home, nothing else, and the walk is over.",
        "01M48J5H272NA5YJ3J0NPW1RX1",
    ),
]
INDEX_ID = "01M48J5HB38EQTVZFASRWR4HYZ"
# the path of stones: (stem, label, phase). The turn sits between four and five.
STONES = [(p[0], p[2], p[3]) for p in PAGES if p[2] and p[3] != "turn"]

# Ours, not theirs yet: none of these reaches a gardener's eyes before the turn (pages 00 to 04b).
OURS = [
    "pot",
    "shin",
    "sai",
    "bunshin",
    "niwanushi",
    "codex",
    "rite",
    "nano",
    "micro",
    "slug",
    "intake",
    "about-me",
    "shintai",
    "kami",
    "witness",
    "witnesses",
    "strategic",
]
ALLOWED = {"04-imagine-them": {"witness", "witnesses"}}  # the Aruji asked for the witnesses on step four (2026-10-06)
BEFORE_TURN = {"00-gate", "01-about-you", "02-what-its-for", "03-whos-with-you", "04-imagine-them", "04b-the-turn"}


def read(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


def write(p, text):
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(text)


def ring(big=False):
    import math

    dots = []
    for k in range(16):
        a = math.radians(k * 22.5)
        x, y = 32 + 27 * math.sin(a), 32 - 27 * math.cos(a)
        lit = k < 4
        op = (1.0, 0.7, 0.42, 0.2)[k] if lit else 1
        cls = "lit" if lit else "dot"
        opacity = f' opacity="{op}"' if lit else ""
        dots.append(f'<circle class="{cls}" cx="{x:.1f}" cy="{y:.1f}" r="3.1"{opacity}/>')
    cls = "w-ring big" if big else "w-ring"
    return (
        f'<span class="{cls}" style="position:relative;display:inline-block">'
        f'<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><g class="spin">{"".join(dots)}</g></svg>'
        f'<img src="{LOGO}" alt="" style="position:absolute;inset:22%;width:56%;height:56%"></span>'
    )


def who(center=False):
    st = ' style="justify-content:center"' if center else ""
    return (
        f'<div class="w-who"{st}>{ring()}<div><span class="name">Bonsai</span>'
        '<span class="kanji" lang="ja">盆才守神</span></div></div>'
    )


def path(stem, phase):
    if phase in ("gate",):
        return ""
    items = []
    order = [p[0] for p in PAGES]
    here = order.index(stem)
    for s, label, ph in STONES:
        i = order.index(s)
        if phase == "end" or i < here:
            state = "done"
        elif i == here:
            state = "now"
        else:
            state = "later"
        cls = state + (" plant" if ph == "plant" else "")
        if s == "05-the-tools":
            t = order.index("04b-the-turn")
            tstate = "done" if (here > t or phase == "end") else ("now" if here == t else "later")
            items.append(
                f'<li class="turn {tstate}"><span class="step"><span class="gate" aria-hidden="true"></span>'
                '<span class="lab">Your word</span></span></li>'
            )
        cur = ' aria-current="step"' if state == "now" else ""
        lab = html.escape(label)
        if state == "later":
            items.append(
                f'<li class="{cls}"><span class="step"><span class="stone"></span><span class="lab">{lab}</span></span></li>'
            )
        else:
            items.append(
                f'<li class="{cls}"><a href="{s}.html"{cur}><span class="stone"></span><span class="lab">{lab}</span></a></li>'
            )
    return f'<nav class="w-path" aria-label="The walk, in seven steps"><ol>{"".join(items)}</ol></nav>'


def count_text(stem, phase):
    if phase == "turn":
        return "Between four and five"
    if phase == "end":
        return "After the walk"
    for n, (s, _, _) in enumerate(STONES, 1):
        if s == stem:
            return f"Step {n} of 7"
    return ""


def links(body, stem):
    order = [p[0] for p in PAGES]
    i = order.index(stem)
    nxt = order[i + 1] if i + 1 < len(order) else order[i]
    prv = order[i - 1] if i > 0 else order[i]
    body = body.replace('href="@next"', f'href="{nxt}.html"').replace('href="@prev"', f'href="{prv}.html"')
    return re.sub(r'href="@page:([0-9a-z-]+)"', lambda m: f'href="{m.group(1)}.html"', body)


NUMERAL = {
    "01-about-you": "1",
    "02-what-its-for": "2",
    "03-whos-with-you": "3",
    "04-imagine-them": "4",
    "05-the-tools": "5",
    "06-home-and-keys": "6",
    "07-signing": "7",
}


def chunk(body, stem=""):
    if '<div class="w-voice">' in body:
        body = body.replace('<p class="say">', '<p class="say lead">', 1)  # the first line is the headline
        if stem in NUMERAL:
            body = body.replace(
                '<p class="eyebrow w-step">',
                f'<span class="w-numeral" aria-hidden="true">{NUMERAL[stem]}</span><p class="eyebrow w-step">',
                1,
            )
            # the numeral, the label and the headline are one group, so variant B can set the numeral beside the headline on a shared baseline
            body = re.sub(
                r'(<span class="w-numeral"[^>]*>[^<]*</span>)(\s*<p class="eyebrow w-step">.*?</p>\s*<p class="say lead">.*?</p>)',
                lambda m: f'<div class="w-head">{m.group(1)}<div class="w-headtext">{m.group(2)}</div></div>',
                body,
                count=1,
                flags=re.S,
            )
    body = body.replace("{{logo}}", LOGO)
    body = body.replace("{{ring:big}}", ring(True))
    body = body.replace("{{who:center}}", who(True)).replace("{{who}}", who())
    return body


THEME = (
    "<script>(function(){try{var s=localStorage.getItem('bonsai-theme');var d=matchMedia('(prefers-color-scheme: dark)').matches;"
    "document.documentElement.setAttribute('data-theme',s||(d?'dark':'light'))}catch(e){document.documentElement.setAttribute('data-theme','light')}})()</script>"
)


def page(meta, standalone=True):
    stem, _route, _label, phase, title, desc, pid = meta
    own = os.path.join(OVERLAY, stem + ".html") if OVERLAY else None
    body = read(own if own and os.path.exists(own) else os.path.join(SRC, stem + ".html"))
    body = links(chunk(body, stem), stem)
    kind = {"gate": "gate-page", "turn": "turn-page"}.get(phase, "")
    planting = " is-planting" if phase in ("plant", "end") else ""
    cls = f"walk {kind}{planting}".strip()
    top = (
        f'<header class="w-top"><a class="w-brand" href="00-gate.html"><img src="{LOGO}" alt="">'
        f'<span>Walk with Bonsai</span></a>{path(stem, phase)}<span class="w-count">{count_text(stem, phase)}</span></header>'
    )
    if phase == "gate":
        top = (
            f'<header class="w-top"><a class="w-brand" href="00-gate.html"><img src="{LOGO}" alt="">'
            '<span>Bonsai Garden</span></a></header>'
        )
    foot = (
        '<footer class="w-foot"><span>This is a preview of the walk. Nothing you type leaves this page.</span>'
        '<a data-leave href="index.html">Leave the walk</a></footer>'
    )
    main = f'<main id="main" class="w-main" data-walk-main>{body}</main>'
    region = f'<!--walk:begin--><script src="walk-early.js"></script>{top}{main}{foot}<!--walk:end-->'
    head = (
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>{html.escape(title)} · The Garden Walk — Bonsai Garden</title>'
        f'<meta name="description" content="{html.escape(desc, quote=True)}">{THEME}'
        '<link rel="stylesheet" href="walk.css">'
    )
    return (
        f'<!doctype html>\n<!--\nid: {pid}\ntype: mockup\ntended-by: eisai\nfor: the Garden Walk, a page of the chain (generated by build.py; edit src/{stem}.html)\n-->\n'
        f'<html lang="en"><head>{head}</head><body class="{cls}">'
        f'<a class="skip" href="#main">Skip to the page</a>{region}<script src="walk.js" defer></script></body></html>\n'
    )


def index():
    shots = []
    for stem, _route, _label, _phase, title, desc, _pid in PAGES:
        shots.append(
            f'<a class="shot" href="{stem}.html"><span class="frame"><iframe src="{stem}.html#still" title="{html.escape(title)}" tabindex="-1" loading="lazy"></iframe></span>'
            f'<b>{html.escape(title)}</b><span>{html.escape(desc)}</span></a>'
        )
    head = (
        f'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Garden Walk, storyboard</title>{THEME}'
        '<link rel="stylesheet" href="walk.css">'
    )
    top = f'<header class="w-top"><a class="w-brand" href="00-gate.html"><img src="{LOGO}" alt=""><span>The Garden Walk</span></a></header>'
    main = (
        '<main id="main" class="w-main"><p class="eyebrow">Storyboard · ten pages · draft 0.1 · Eisai, 2026-10-06</p>'
        '<h1 class="w-title" style="margin-top:8px">The Garden Walk</h1>'
        '<p style="max-width:62ch;color:var(--slate)">The walk as a chain of full pages, one per stage, from the gate to calling home. '
        'Everything on them is an example; the fields and buttons are drawn and not wired. Open a page to walk it.</p>'
        f'<div class="board">{"".join(shots)}</div></main>'
    )
    return (
        f'<!doctype html>\n<!--\nid: {INDEX_ID}\ntype: mockup\ntended-by: eisai\nfor: the Garden Walk, the storyboard (generated by build.py; core only)\n-->\n'
        f'<html lang="en"><head>{head}</head><body class="walk">{top}{main}<script src="walk.js" defer></script></body></html>\n'
    )


def manifest():
    out = []
    for stem, route, label, phase, title, desc, pid in PAGES:
        out.append(
            {
                "file": stem + ".html",
                "stem": stem,
                "route": route,
                "label": label,
                "phase": phase,
                "title": title,
                "description": desc,
                "id": pid,
            }
        )
    return (
        json.dumps({"$generated-by": "build.py, do not edit by hand", "pages": out}, indent=2, ensure_ascii=False)
        + "\n"
    )


def visible(text):
    text = re.sub(r"<(script|style)\b.*?</\1>", " ", text, flags=re.S)
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return html.unescape(text)


def guards(files):
    bad = []
    for stem, *_ in PAGES:
        text = visible(files[stem + ".html"]).lower()
        if stem in BEFORE_TURN:
            for w in OURS:
                if w in ALLOWED.get(stem, ()):
                    continue
                if re.search(rf"(?<![a-z-]){re.escape(w)}(?![a-z-])", text):
                    bad.append(f"{stem}: our word before the turn: {w!r}")
        if re.search(r"\b[0-9a-f]{8}\b", text):
            bad.append(f"{stem}: an eight-character hex string")
    js = "\n".join(read(os.path.join(HERE, n)) for n in ("walk.js", "walk-early.js"))
    for pat in (
        r"\bfetch\s*\(",
        r"XMLHttpRequest",
        r"sendBeacon",
        r"WebSocket",
        r"\blocalStorage\b",
        r"\bsessionStorage\b",
        r"\bindexedDB\b",
        r"document\.cookie",
    ):
        if re.search(pat, js):
            bad.append(f"walk.js or walk-early.js: {pat} (the pages promise nothing leaves and nothing is kept)")
    for stem, *_ in PAGES:
        if re.search(r"<form\b", files[stem + ".html"]):
            bad.append(f"{stem}: a <form> (nothing here submits)")
    return bad


def build():
    files = {m[0] + ".html": page(m) for m in PAGES}
    files["index.html"] = index()
    files["pages.json"] = manifest()
    return files


def arg(name):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None


def main():
    global LOGO, OVERLAY
    check = "--check" in sys.argv
    out = arg("--out")
    OVERLAY = os.path.abspath(arg("--src")) if arg("--src") else None
    if out:  # a content set built somewhere else (outside every repo, if its words are someone's)
        if check:
            sys.exit("--check compares the committed pages; it does not take --out")
        out = os.path.abspath(out)
        os.makedirs(out, exist_ok=True)
        LOGO = "logo.svg"
    files = build()
    bad = guards(files)
    if bad:
        print("guard failed:")
        for b in bad:
            print("  " + b)
        return 1
    if out:
        import shutil

        for name, text in files.items():
            write(os.path.join(out, name), text)
        for name in ("walk.css", "walk.js", "walk-early.js"):
            shutil.copy(os.path.join(HERE, name), os.path.join(out, name))
        shutil.copy(os.path.join(HERE, "..", "..", "..", "..", "bonsai-garden-logo.svg"), os.path.join(out, "logo.svg"))
        print(f"wrote {len(files)} pages to {out} (overlay: {OVERLAY or 'none'}), guards pass")
        return 0
    drift = []
    for name, text in files.items():
        p = os.path.join(HERE, name)
        have = read(p) if os.path.exists(p) else None
        if have != text:
            drift.append(name)
            if not check:
                write(p, text)
    if check:
        if drift:
            print("drift: " + ", ".join(drift))
            return 1
        print(f"ok: {len(files)} files match their sources, guards pass")
        return 0
    print(f"wrote {len(files)} files ({len(drift)} changed), guards pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())
