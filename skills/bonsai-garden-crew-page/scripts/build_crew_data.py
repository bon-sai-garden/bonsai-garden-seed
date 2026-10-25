#!/usr/bin/env python3
# ---
# id: 01M48VA7DK7YA9SZBFZPZW0Q05
# title: Build a garden's crew pages' data from the garden's own sources
# type: script
# tended-by: eisai
# created: 2026-10-06
# updated: 2026-10-25
# ---
"""build_crew_data.py — everything a garden's crew pages show, read from where it lives. Never typed.

Capability only (core). Which garden, which files, which URLs: a config file the instance keeps
(see SKILL.md, and references/crew-config.example.json). Nothing here names a garden's members.

Per member, from the instance's own sources:
  registry                 name, public name, kanji, type, role, fingerprint, path, accent-rgba
  rings                    the sixteen-pixel move (frames, frame_ms), accent where the registry has none
  public_hashes (optional) the four-kanji name-mark (the PUBLIC half of a keyring only)
  ../bonsai-garden-mark/fp-kanji.py   the signing mark, decoded from the public fingerprint
  intro (template)         the introduction and its seal
  portraits (templates)    the portrait and its seal (webp copy, drift-gated)
  seal_renderer (optional) the drawn seal
Membership, groups, the selector's rows, overrides: the instance's members file.

THE GUARD (production, the default): an introduction is included only if its frontmatter says
`status: approved` AND its seal verifies AND the seal's signer is the member named in `tended-by`.
Anything else is refused by name on stderr and the page reads "introduction coming". `--preview`
includes drafts and marks each one. An introduction is two or three paragraphs, then exactly one
best-errors section (fifty words at most; see ERRORS_HEADINGS), under 300 words in all.

A PERSON WHOSE KEY ANOTHER HOLDS (registry key_holder, not himself) is refused: his name and key are
his to publish, never a pipeline's. One exception: the instance config's `published-by-key-holder`
records the key holder's own publication of him (holder, date, words, record), the holder equal to the
registry's key_holder. Then he is shown in the family group only, with no key material at all.

FINGERPRINTS: a hex string may appear in the built HTML only as a member's fingerprint link (FP_LINK:
its first eight as the text, the verify URL with the full fingerprint as the href), never for a
member whose key the page does not show, never in an introduction.

  python3 build_crew_data.py --config CFG                    production JSON on stdout, report on stderr
  python3 build_crew_data.py --config CFG --preview          drafts included and marked
  python3 build_crew_data.py --config CFG --write-portraits  regenerate the webps and their manifest
  python3 build_crew_data.py --config CFG --check-built DIST the built pages: routes, order, selector, no stray hex

Exit 0 = data written; 1 = a refusal that stops the build; 2 = setup failure (a source not found).
No host path ever reaches stdout: the page is public, the report is not.
"""

from __future__ import annotations

import argparse
import atexit
import hashlib
import html
import importlib.util
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# A bundled script reads and writes no bytecode beside itself. A __pycache__ left beside the scripts failed a package's
# own check (a planting, 2026-10-24), and a .pyc planted beside a sealed sibling runs instead of the sibling, under -B
# too, while the sibling's sealed bytes stay untouched (Mori-shin's read, 2026-10-25: bytecode is code). So before any
# sibling is loaded, Python's cache points at a fresh private folder, removed at exit; the instructions that run a
# bundled script pass -B.
sys.dont_write_bytecode = True
sys.pycache_prefix = tempfile.mkdtemp(prefix="bonsai-pycache-")
atexit.register(shutil.rmtree, sys.pycache_prefix, True)

PORTRAIT_PX = 360  # shown at up to 180 css px; 2x for dense screens
WEBP_QUALITY = 80

# A person, not kin. The registry's word since 2026-10-15 is "gardener"; a registry from before it says "aruji".
# Both are a person, so the held-key guard and the frame hold for either. Matched on the old word alone, the guard had
# gone quiet for a person typed "gardener", and nothing said so (2026-10-15, Jisai's registry review, through Tasai).
PERSON_TYPES = frozenset({"gardener", "aruji"})


class Setup(Exception):
    """A source could not be found or loaded. Exit 2."""


class Refuse(Exception):
    """A check refused the data. Exit 1."""


# ── the instance's config ─────────────────────────────────────────────────────

HERE = Path(__file__).resolve().parent
SKILLS = HERE.parent.parent  # core/skills/
FP_KANJI = SKILLS / "bonsai-garden-mark" / "fp-kanji.py"


class Sources:
    """Everything instance-specific, from one config file. Paths in it are relative to the config
    file's folder unless absolute. Garden paths (registry, rings, intro, portraits, tokens) are
    relative to `garden_root`, or resolved by the instance's own router when `resolver` names one:
    ask the router, never guess; a path the router refuses or that is missing is a setup failure."""

    def __init__(self, config: Path):
        self.config_path = config.resolve()
        base = self.config_path.parent
        try:
            c = json.loads(self.config_path.read_text("utf-8"))
        except Exception as exc:
            raise Setup(f"cannot read the config {config}: {exc}") from exc
        self.c = c

        def here(k, required=True):
            v = c.get(k)
            if v is None:
                if required:
                    raise Setup(f"the config names no {k!r}")
                return None
            return (base / os.path.expandvars(v)).resolve()

        self.garden = here("garden_root")
        if not self.garden.is_dir():
            raise Setup(f"garden_root {self.garden} is not a folder")
        self.members_file = here("members")
        self.portrait_dir = here("portrait_out")
        self.manifest_path = here("portrait_manifest")
        self.portrait_url = c.get("portrait_url", "/crew/portraits/")
        self.route = c.get("route", "/crew/")
        self.verify_url = c["verify_url"]
        self.k = c.get("paths", {})
        for need in ("registry", "rings", "intro", "portraits"):
            if need not in self.k:
                raise Setup(f"the config's paths name no {need!r}")
        self.router = None
        r = c.get("resolver")
        if r:
            mod = (base / r["module"]).resolve()
            spec = importlib.util.spec_from_file_location("crew_resolver", mod)
            if not spec or not mod.exists():
                raise Setup(f"the resolver module {mod} is not there")
            m = importlib.util.module_from_spec(spec)
            sys.path.insert(0, str(mod.parent))
            sys.modules["crew_resolver"] = m  # dataclasses look their module up while it executes
            spec.loader.exec_module(m)  # type: ignore[union-attr]
            self.router = getattr(m, r.get("class", "Router"))((base / r["registry"]).resolve())
        self.verifier = [os.path.expandvars(x).replace("{garden}", str(self.garden)) for x in c["seal_verifier"]]
        sr = c.get("seal_renderer")
        self.renderer = [os.path.expandvars(x).replace("{garden}", str(self.garden)) for x in sr] if sr else None

    def path(self, rel: str, must_exist: bool = True) -> Path | None:
        if self.router is not None:
            try:
                res = self.router.resolve(rel)
            except Exception as exc:
                raise Setup(f"the router refused {rel}: {type(exc).__name__}: {exc}") from exc
            p, where = res.path, f"{res.repo}/{rel}"
        else:
            p, where = self.garden / rel, rel
        if not p.exists():
            if must_exist:
                raise Setup(f"{where}: nothing is there")
            return None
        return p

    def sibling(self, repo: str) -> Path:
        """A named sibling repository of the garden root (an instance's portrait override)."""
        return self.garden.parent / repo

    def rel(self, p: Path) -> str:
        """A path for the private report only, never for the page."""
        for b, name in ((self.garden, "garden"), (self.config_path.parent, "config")):
            try:
                return f"{name}:{p.resolve().relative_to(b)}"
            except ValueError:
                pass
        return str(p)


def configure(src: Sources) -> None:
    """The routes and the verify URL are the instance's; the patterns that check them follow."""
    global VERIFY, FP_LINK, ROUTE
    VERIFY = src.verify_url
    ROUTE = src.route
    FP_LINK = re.compile(
        r'<a class="tm-fp" href="' + re.escape(VERIFY) + r'([0-9a-f]{32})" title="([^"<>]*)">([0-9a-f]{8})</a>'
    )


# ── seals ─────────────────────────────────────────────────────────────────────


def verify_seal(src: Sources, p: Path) -> dict:
    """The instance's verifier (config seal_verifier, the file's path appended). Its contract: exit 0
    and a first line beginning 'ok' = verified; a line 'signer: <slug>' names the hand."""
    proc = subprocess.run([*src.verifier, str(p)], cwd=src.garden, capture_output=True, text=True)
    out = proc.stdout + proc.stderr
    first = out.strip().splitlines()[0] if out.strip() else ""
    signer = re.search(r"^\s*signer:\s*(\S+)", out, re.M)
    return {
        "ok": proc.returncode == 0 and first.startswith("ok"),
        "state": first.split()[0] if first else "no-output",
        "signer": signer.group(1) if signer else None,
    }


# ── introductions ─────────────────────────────────────────────────────────────

FM = re.compile(r"\A---\n(.*?)\n---\n(.*)\Z", re.S)


ERRORS_HEADINGS = ("## My best errors", "## Their best errors", "## His best errors", "## Her best errors")
ERRORS_MAX_WORDS = 50
INTRO_MAX_WORDS = 300


def parse_intro(text: str) -> tuple[dict, list[str]]:
    """(frontmatter, paragraphs). A heading line is kept as its own paragraph, unchanged, for
    split_errors to judge: the body is prose, then at most one `## My best errors` section."""
    m = FM.match(text)
    if not m:
        raise Refuse("no frontmatter")
    fm: dict[str, str] = {}
    for line in m.group(1).splitlines():
        kv = re.match(r"^([A-Za-z][\w-]*):\s*(.*)$", line)
        if kv:
            v = kv.group(2).strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
                v = v[1:-1]
            fm[kv.group(1)] = v
    body = re.sub(r"<!--.*?-->", "", m.group(2), flags=re.S)  # notes for the gardener never ship
    if "<!--" in body or "-->" in body:
        raise Refuse("an HTML comment is left open in the body")
    body = re.sub(r"^(#.*)$", r"\n\1\n", body, flags=re.M)  # a heading is always its own block
    paras = [quote_of(p) or re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    return fm, paras


def quote_of(block: str) -> dict | None:
    """A paragraph whose every line starts with '>' is a quote block: {"quote", "cite"}. Its last line,
    when it opens with a dash ('> — The Human Covenant, commitment 4'), is the attribution, the cite;
    without one the quote stands uncited (Tasai for the gardener, 2026-10-09)."""
    lines = [ln.strip() for ln in block.strip().splitlines()]
    if not lines or not all(ln.startswith(">") for ln in lines):
        return None
    lines = [ln[1:].strip() for ln in lines]
    cite = None
    # the cite marks: an em dash, an en dash or a hyphen, written as escapes so no reader takes one for another
    if len(lines) > 1 and re.match(r"^[\u2014\u2013-]\s*\S", lines[-1]):
        cite = re.sub(r"^[\u2014\u2013-]\s*", "", lines.pop())
    return {"quote": re.sub(r"\s+", " ", " ".join(lines)).strip(), "cite": cite}


def words_of(x) -> int:
    """A paragraph's words; a quote's are its quote's, the cite is an attribution, not text."""
    return len((x["quote"] if isinstance(x, dict) else x).split())


def split_errors(paras: list[str]) -> tuple[list[str], dict | None, list[str]]:
    """(main paragraphs, the errors section or None, problems). The gardener, 2026-10-06: the
    passage on past shortcomings shorter and crisper, under a 'My best errors' headline. Exactly
    those headings are accepted; any other heading is refused; the section is at most fifty words
    and comes last."""
    problems, main, section, heading = [], [], [], None
    for x in paras:
        if isinstance(x, dict):
            if heading:
                problems.append("a quote in the best-errors section")
            else:
                main.append(x)
            continue
        if x.startswith("#"):
            if x not in ERRORS_HEADINGS:
                problems.append(f"heading {x[:40]!r} (only {' or '.join(repr(h) for h in ERRORS_HEADINGS)})")
                continue
            if heading:
                problems.append("a second best-errors section")
                continue
            heading = x
            continue
        (section if heading else main).append(x)
    errors = None
    if heading:
        words = sum(len(x.split()) for x in section)
        if not section:
            problems.append("the best-errors section is empty")
        if words > ERRORS_MAX_WORDS:
            problems.append(f"the best-errors section has {words} words (fifty at most)")
        errors = {"heading": heading[3:], "paragraphs": section}
    return main, errors, problems


def inline(md: str) -> str:
    """Escape first, then the two marks an introduction uses. No links, no HTML."""
    s = html.escape(md, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", s)
    return s


def judge_intro(
    src: Sources, slug: str, p: Path | None, preview: bool, placed: bool, needs_errors: bool = True
) -> tuple[dict | None, str | None]:
    """Return (intro, refusal). The guard lives here and only here."""
    if p is None:
        return None, "no introduction yet"
    try:
        fm, paras = parse_intro(p.read_text(encoding="utf-8"))
    except Refuse as r:
        return None, f"unreadable: {r}"
    seal = verify_seal(src, p)
    status = fm.get("status", "")
    writer = fm.get("tended-by", "")
    sealed_by_writer = seal["ok"] and seal["signer"] == writer
    problems = []
    if status != "approved":
        problems.append(f"status {status or 'missing'} (production includes approved only)")
    if not seal["ok"]:
        problems.append(f"seal {seal['state']}")
    elif seal["signer"] != writer:
        problems.append(f"sealed by {seal['signer']}, but tended-by says {writer}")
    texts = [t for x in paras for t in ((x["quote"], x["cite"] or "") if isinstance(x, dict) else (x,))]
    if fingerprint_leaks(" ".join([fm.get("tagline", ""), fm.get("role-line", ""), *texts]), set()):
        problems.append("carries a fingerprint-shaped string in its text (the page shows the fingerprint, as a link)")

        def scrub(t):
            return t and HEX32.sub("[fingerprint]", HEX8.sub("[fingerprint]", t))

        paras = [
            {"quote": scrub(x["quote"]), "cite": scrub(x["cite"])} if isinstance(x, dict) else scrub(x) for x in paras
        ]
    paras, errors, eproblems = split_errors(paras)
    problems += eproblems
    # a quote block is not a body paragraph for the two-to-three rule; its words count toward the limit
    prose = [x for x in paras if isinstance(x, str)]
    if not 2 <= len(prose) <= 3:
        problems.append(f"{len(prose)} paragraphs before the errors section (two or three)")
    if needs_errors and errors is None:
        problems.append("no '## My best errors' section")
    if not needs_errors and errors is not None:
        problems.append("a best-errors section where none belongs")
    words = sum(words_of(x) for x in paras) + (sum(len(x.split()) for x in errors["paragraphs"]) if errors else 0)
    if words >= INTRO_MAX_WORDS:
        problems.append(f"{words} words (under {INTRO_MAX_WORDS})")
    if not placed:
        problems.append("not at its standard address")
    if problems and not preview:
        return None, "; ".join(problems)
    intro = {
        "status": status,
        "approved": not problems,
        "sealed": sealed_by_writer,
        "draft": bool(problems),
        # the stage a preview shows: in review (the gardener is reading it; the gardener, 2026-10-09) is its own,
        # anything else short of approved is a draft; production still takes approved and sealed only
        "stage": "approved" if not problems else ("in-review" if status == "in-review" else "draft"),
        "draft_reasons": problems if preview else [],
        "writer": writer,
        "tagline": fm.get("tagline", ""),
        "role_line": fm.get("role-line", ""),
        "paragraphs": [inline(x) for x in prose],
        # the body in order: {"p": html} for a paragraph, {"quote": html, "cite": html | None} for a quote block
        "blocks": [
            {"quote": inline(x["quote"]), "cite": inline(x["cite"]) if x["cite"] else None}
            if isinstance(x, dict)
            else {"p": inline(x)}
            for x in paras
        ],
        "errors": {"heading": errors["heading"], "paragraphs": [inline(x) for x in errors["paragraphs"]]}
        if errors
        else None,
    }
    return intro, ("; ".join(problems) if problems else None)


# ── portraits ─────────────────────────────────────────────────────────────────


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def encode_webp(png: Path) -> bytes:
    from PIL import Image

    im = Image.open(png)
    im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
    im = im.resize((PORTRAIT_PX, PORTRAIT_PX), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=WEBP_QUALITY, method=6)
    return buf.getvalue()


# ── the seal drawing ──────────────────────────────────────────────────────────


def draw_seal(src: Sources, kanji: str, fp: str, tier: str, label: str) -> str | None:
    """The instance's renderer (config seal_renderer), given --kanji --fp --tier --mode portable --label;
    it prints one SVG. No renderer named: no drawn seal (the marks and the fingerprint link remain)."""
    if not src.renderer:
        return None
    proc = subprocess.run(
        [*src.renderer, "--kanji", kanji, "--fp", fp, "--tier", tier, "--mode", "portable", "--label", label],
        cwd=src.garden,
        capture_output=True,
        text=True,
    )
    svg = proc.stdout.strip()
    if proc.returncode != 0 or not svg.startswith("<svg"):
        raise Refuse(f"the seal renderer failed for {kanji}: {proc.stderr.strip()[:200]}")
    svg = re.sub(r"<!--.*?-->", "", svg, flags=re.S)
    svg = re.sub(r'\s(width|height)="64"', "", svg, count=2)
    return svg


# ── no fingerprint on the page ───────────────────────────────────────────────
# The gardener, 2026-10-06: "no fp list, just a verify page." The build reads fingerprints to decode
# the kanji; none may reach the page, whole or in part. A CSS colour (#rrggbbaa) is not one.

HEX8 = re.compile(r"(?<![0-9A-Za-z#_-])[0-9a-f]{8}(?![0-9A-Za-z_-])")
HEX32 = re.compile(r"(?<![0-9A-Za-z#_-])[0-9a-f]{32}(?![0-9A-Za-z_-])")


VERIFY = "https://example.invalid/verify/?fp="  # set by configure() from the instance's config
ROUTE = "/crew/"
FP_LINK = re.compile(
    r'<a class="tm-fp" href="https://example\.invalid/verify/\?fp=([0-9a-f]{32})" title="([^"<>]*)">([0-9a-f]{8})</a>'
)


def strip_fp_fields(groups):
    """The page data minus the three fields that ARE the fingerprint link; everything else is checked."""
    return [
        g
        | {"members": [{k: v for k, v in m.items() if k not in ("fp8", "fingerprint", "verify")} for m in g["members"]]}
        for g in groups
    ]


def html_fingerprint_leaks(text: str, fingerprints: set[str], linkable: set[str]) -> list[str]:
    """The gardener, 2026-10-06, the afternoon: "embed verify links in the fingerprint." A hex string
    may appear in the built HTML only as a fingerprint link, exactly: <a class="tm-fp"
    href=".../verify/?fp=<full>" title="...">fp8</a>, the full fingerprint one of a member whose key
    the page shows, the text its first eight. Everything else goes through fingerprint_leaks."""
    out = []

    def take(m):
        full, title, short = m.group(1), m.group(2), m.group(3)
        if full not in linkable:
            out.append(f"a fingerprint link to a key the page does not show (begins {full[:4]})")
        elif short != full[:8]:
            out.append(f"a fingerprint link whose text is not its own fingerprint (begins {full[:4]})")
        elif HEX8.search(title) or HEX32.search(title):
            out.append("a fingerprint link with hex in its title")
        return ""

    rest = FP_LINK.sub(take, text)
    return out + fingerprint_leaks(rest, fingerprints)


def fingerprint_leaks(text: str, fingerprints: set[str]) -> list[str]:
    low = text.lower()
    out = [f"a member's fingerprint (begins {fp[:4]}) appears" for fp in sorted(fingerprints) if fp in low]
    out += [
        f"a member's short fingerprint (begins {fp[:4]}) appears"
        for fp in sorted(fingerprints)
        if fp not in low and fp[:8] in low
    ]
    out += [f"a 32-hex string appears ({m.group(0)[:4]}...)" for m in HEX32.finditer(text)]
    out += [f"an 8-hex string appears ({m.group(0)[:4]}...)" for m in HEX8.finditer(text)]
    return out


def expected_nav(order: list[str], slug: str) -> tuple[str, str]:
    """The roster is a circle: the last member's next is the first. Mirrors templates/astro/lib/crew-nav.mjs."""
    i = order.index(slug)
    return order[(i - 1) % len(order)], order[(i + 1) % len(order)]


RETICLE = re.compile(r'class="[^"]*\b[\w-]*(bracket|crosshair|cross-hair|reticle|corner)[\w-]*\b|M4 26V4h22', re.I)


def _href(slug_pat: str) -> str:
    return 'href="' + re.escape(ROUTE) + slug_pat + '/"'


def selector_problems(html: str, rows: list[list[str]], current: str | None, accents: dict | None) -> list[str]:
    """The agent selector: two rows of almost equal count in roster order; no category labels, no
    dividers, no LED ticks; each avatar a thin circle in its canon colour; the outer ring only on the
    member shown; labels whole, never cut."""
    out = []
    nav = re.search(r'<nav[^>]*class="tm-roster(?: [^"]*)?"[^>]*>(.*?)</nav>', html, re.S)
    if not nav:
        return ["no agent selector"]
    body = nav.group(1)
    slug = _href("([a-z0-9-]+)")
    got_rows = [re.findall(slug, r) for r in re.findall(r'<div class="tm-roster-row">(.*?)</div>', body, re.S)]
    if got_rows != rows:
        out.append(
            f"the selector's rows are {[len(r) for r in got_rows]} {[s for r in got_rows for s in r][:3]}..., not {[len(r) for r in rows]} in roster order"
        )
    if re.search(r'class="[^"]*\b(led|halo|tm-ring|tm-roster-kanji|tm-roster-group)\b', body):
        out.append("the selector carries LED ticks, a ring, a category label or a divider group")
    cur = re.findall(slug + r'[^>]*aria-current="page"', body)
    hi = re.findall(r'class="tm-av is-current"', body)
    if current is None and (cur or hi):
        out.append("the overview marks a member as shown")
    if current is not None and (cur != [current] or len(hi) != 1):
        out.append(f"the selector does not mark exactly {current} as shown")
    if "…" in body or "&hellip;" in body:
        out.append("a selector label is cut")
    if accents is not None:
        for sl, col in re.findall(
            slug + r'[^>]*>\s*<span class="tm-av[^"]*" style="--tm-accent-own:(#[0-9a-f]{6})"', body
        ):
            if accents.get(sl) != col:
                out.append(f"{sl}: selector circle {col}, canon accent {accents.get(sl)}")
    return out


def _route_dir(dist: Path) -> Path:
    return dist / ROUTE.strip("/")


def check_built(
    dist: Path,
    order: list[str],
    accents: dict | None = None,
    fps: dict | None = None,
    rows: list[list[str]] | None = None,
    forbidden: list[str] | None = None,
) -> list[str]:
    """The built pages at ROUTE: one real page per member, readable without JavaScript, navigation in
    order. fps: slug -> full fingerprint for members whose key the page shows (None: not checked).
    rows: the selector's two rows (default: one row, the order). forbidden: strings no page may carry
    (the instance's config forbidden_html_parts, e.g. a folder of images that must never be shown)."""
    forbidden = forbidden or []
    out = []
    base = _route_dir(dist)
    ov = base / "index.html"
    if not ov.is_file():
        return [f"no overview page at {ROUTE}index.html"]
    ovt = ov.read_text("utf-8")
    rows = rows or [order]
    if [s for r in rows for s in r] != order:
        out.append("the selector rows are not the roster order")
    out += [f"overview: {x}" for x in selector_problems(ovt, rows, None, accents)]
    if "tm-tile" in ovt:
        out.append("overview: a tile grid (the selector instead)")
    verify_box = 'href="' + VERIFY.split("?")[0] + '"'
    for slug in order:
        p = base / slug / "index.html"
        if not p.is_file():
            out.append(f"{slug}: no page at {ROUTE}{slug}/index.html")
            continue
        t = p.read_text("utf-8")
        prev, nxt = expected_nav(order, slug)
        for rel, want, word in (("prev", prev, "previous"), ("next", nxt, "next")):
            h = _href(re.escape(want))
            if not re.search(rf'rel="{rel}"[^>]*{h}|{h}[^>]*rel="{rel}"', t):
                out.append(f"{slug}: {word} is not {want}")
        if f'href="{ROUTE}"' not in t:
            out.append(f"{slug}: no way back to the crew")
        out += [f"{slug}: {x}" for x in selector_problems(t, rows, slug, accents)]
        if f'id="n-{slug}"' not in t or "tm-intro" not in t:
            out.append(f"{slug}: the member's card is not in the HTML")
        if verify_box in t or "tm-verify" in t:
            out.append(f"{slug}: a separate Check a seal box (the fingerprint is the link)")
        if fps is not None:
            card = re.search(r"<article.*?</article>", t, re.S)
            links = FP_LINK.findall(card.group(0)) if card else []
            if slug in fps:
                if [x[0] for x in links] != [fps[slug]]:
                    out.append(f"{slug}: the card does not carry its own fingerprint link, once")
            elif links or "tm-fp" in t:
                out.append(f"{slug}: a fingerprint on a page whose key is not shown")
        if RETICLE.search(t):
            out.append(f"{slug}: a corner-bracket, crosshair or reticle frame ships")
        for f in forbidden:
            if f in t:
                out.append(f"{slug}: carries {f!r}, which the instance forbids on these pages")
        if accents is not None:
            lg = re.search(r'<figure class="tm-bezel tm-bezel-lg"[^>]*>', t)
            got = re.search(r'data-accent="(#[0-9a-f]{6})"', lg.group(0)) if lg else None
            want = accents.get(slug)
            if (got.group(1) if got else None) != want:
                out.append(f"{slug}: portrait border {got.group(1) if got else None}, canon accent {want}")
    if RETICLE.search(ovt):
        out.append("overview: a corner-bracket, crosshair or reticle frame ships")
    for f in forbidden:
        if f in ovt:
            out.append(f"overview: carries {f!r}, which the instance forbids on these pages")
    if verify_box in ovt or "tm-verify" in ovt:
        out.append("overview: a separate Check a seal box")
    return out


def html_problems(src: Sources, paths: list[str], extra=None) -> int:
    """Every built page through html_fingerprint_leaks; extra(path, text) -> problems, the instance's own."""
    reg = {a["slug"]: a for a in json.loads(src.path(src.k["registry"]).read_text("utf-8"))["agents"]}
    fps = {a["fingerprint"].lower() for a in reg.values() if a.get("fingerprint")}
    cfg = load_members(src)
    hidden = {k for k in cfg.get("no-key-shown", {}) if not k.startswith("$")} | set(held_published(src))
    linkable = {
        reg[s]["fingerprint"].lower()
        for g in cfg["groups"]
        for s in g["members"]
        if s not in hidden and reg.get(s, {}).get("fingerprint")
    }
    bad = 0
    for p in paths:
        leaks = html_fingerprint_leaks(Path(p).read_text("utf-8", errors="replace"), fps, linkable)
        print(f"{'FAIL' if leaks else 'ok  '}  {Path(p).name}: {len(leaks)} fingerprint-shaped string(s)")
        for leak in leaks[:10]:
            print(f"        {leak}")
        bad += bool(leaks)
    return 1 if bad else 0


def load_fp_kanji():
    p = FP_KANJI
    if not p.exists():
        raise Setup(f"core's fp-kanji.py is not beside this skill ({p})")
    spec = importlib.util.spec_from_file_location("fp_kanji", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


RGBA = re.compile(r"^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)")


def accent_of(a: dict, ring: dict | None, token: str | None = None) -> tuple[str | None, bool]:
    """The member's canon colour: the registry's accent-rgba, alpha dropped; else the canon design
    token the members file names (accent-token); else the ring file's accent, marked as a proposal.
    Never typed here."""
    m = RGBA.match(a.get("accent-rgba") or "")
    if m:
        return "#" + "".join(f"{int(x):02x}" for x in m.groups()), False
    if token:
        return token.lower(), False
    if ring and re.fullmatch(r"#[0-9a-fA-F]{6}", ring.get("accent", "")):
        return ring["accent"].lower(), True
    return None, False


def read_token(src: Sources, name: str) -> str:
    if not src.k.get("tokens_css"):
        raise Setup(f"accent-token {name} named, but the config's paths name no tokens_css")
    css = src.path(src.k["tokens_css"]).read_text("utf-8")
    m = re.search(rf"^\s*{re.escape(name)}\s*:\s*(#[0-9a-fA-F]{{6}})\s*;", css, re.M)
    if not m:
        raise Refuse(f"the design token {name} is not in the tokens file")
    return m.group(1)


def recolour(ring: dict, frm: str, to: str) -> dict:
    """A ring file draws every shade of a move as a scaled copy of one accent. Where the canon colour is
    not that accent, scale each shade onto the canon colour: the same move, in the member's colour."""
    f = [int(frm[i : i + 2], 16) for i in (1, 3, 5)]
    t = [int(to[i : i + 2], 16) for i in (1, 3, 5)]
    top = max(f) or 1

    def one(c: str) -> str:
        k = max(int(c[i : i + 2], 16) for i in (1, 3, 5)) / top
        return "#" + "".join(f"{min(255, round(x * k)):02x}" for x in t)

    return ring | {"palette": [one(c) for c in ring["palette"]], "recoloured": True}


LIT_GAMMA = 1.4  # lit-versus-dim: brightness relative to the move's peak, raised to this power
LIT_SAT = 1.15  # saturation lift for the lit shades (capped at 1)
GLOW_FLOOR = 0.25  # a shade below this brightness (after lifting) casts no glow: only lit pixels bloom


def lit(ring: dict) -> dict:
    """The display palette: what the LEDs show. The canonical palette stays the data; this lifts each
    move so its brightest shade is the member's colour at full brightness (HSV value 1, same hue),
    and pushes mid shades down (value ** LIT_GAMMA) so lit pixels stand clear of dim ones. A shade at
    the move's floor stays at the floor: an unlit pixel is no brighter than before."""
    import colorsys

    hsv = [colorsys.rgb_to_hsv(*(int(c[i : i + 2], 16) / 255 for i in (1, 3, 5))) for c in ring["palette"]]
    peak = max(v for _h, _s, v in hsv) or 1.0
    out = []
    for h, s_, v in hsv:
        vn = v / peak
        v2 = min(v, vn**LIT_GAMMA) if vn < 0.2 else vn**LIT_GAMMA
        r, g, b = colorsys.hsv_to_rgb(h, min(1.0, s_ * LIT_SAT), v2)
        out.append("#" + "".join(f"{round(x * 255):02x}" for x in (r, g, b)))
    glow = [
        d if colorsys.rgb_to_hsv(*(int(d[i : i + 2], 16) / 255 for i in (1, 3, 5)))[2] >= GLOW_FLOOR else "none"
        for d in out
    ]
    return ring | {"display": out, "glow": glow}


def ring_of(m: dict, preview: bool) -> dict:
    palette: list[str] = []
    frames = []
    for f in m["frames"]:
        if len(f) != 16:
            raise Refuse(f"{m['slug']}: a ring frame has {len(f)} pixels, not 16")
        row = []
        for c in f:
            if c not in palette:
                palette.append(c)
            row.append(palette.index(c))
        frames.append(row)
    if m["frame_ms"] * len(frames) != m["period_ms"]:
        raise Refuse(f"{m['slug']}: period_ms {m['period_ms']} != frame_ms x frames")
    return {
        "palette": palette,
        "frames": frames,
        "frame_ms": m["frame_ms"],
        "proposed": m.get("source") == "designed",
        "move": m.get("move", "") if preview else "",
    }


def held_published(src: Sources) -> dict:
    """The instance config's published-by-key-holder: slug -> {holder, date, words, record}, the key
    holder's own publication of a person whose key he holds. The guard checks each against the registry."""
    return {k: v for k, v in src.c.get("published-by-key-holder", {}).items() if not k.startswith("$")}


def lights_approved(src: Sources) -> dict | None:
    """The instance config's lights-approved: the gardener's word that the signature lights stand as they
    are, recorded once by name, date and his words. With it no light reads as a proposal; an incomplete
    record refuses, so the removal always has a source."""
    rec = src.c.get("lights-approved")
    if rec is None:
        return None
    missing = [k for k in ("by", "date", "words") if not str(rec.get(k, "")).strip()]
    if missing:
        raise Refuse(f"lights-approved lacks {', '.join(missing)} (by name, date and his words)")
    return rec


def load_members(src: Sources) -> dict:
    if not src.members_file.is_file():
        raise Setup(f"no members file at {src.rel(src.members_file)}")
    return json.loads(src.members_file.read_text("utf-8"))


def build(preview: bool, write_portraits: bool, report, src: Sources) -> dict:
    configure(src)
    cfg = load_members(src)
    reg = {a["slug"]: a for a in json.loads(src.path(src.k["registry"]).read_text("utf-8"))["agents"]}
    rings = {m["slug"]: m for m in json.loads(src.path(src.k["rings"]).read_text("utf-8"))["members"]}
    public = (
        json.loads(src.path(src.k["public_hashes"]).read_text("utf-8"))["agents"] if src.k.get("public_hashes") else {}
    )
    fpk = load_fp_kanji()
    manifest_path = src.manifest_path
    manifest = json.loads(manifest_path.read_text("utf-8")) if manifest_path.exists() else {"portraits": {}}
    portrait_dir = src.portrait_dir
    forbidden = src.c.get("forbidden_portrait_parts", [])
    no_key = {k for k in cfg.get("no-key-shown", {}) if not k.startswith("$")}
    as_sai = {k for k in cfg.get("as-sai", {}) if not k.startswith("$")}
    intro_source = {k: v for k, v in cfg.get("intro-source", {}).items() if not k.startswith("$")}
    display_name = {k: v for k, v in cfg.get("display-name", {}).items() if not k.startswith("$")}
    short_name = {k: v for k, v in cfg.get("short-name", {}).items() if not k.startswith("$")}
    portrait_source = {k: v for k, v in cfg.get("portrait-source", {}).items() if not k.startswith("$")}
    accent_tokens = {k: v for k, v in cfg.get("accent-token", {}).items() if not k.startswith("$")}
    no_errors = {k for k in cfg.get("no-errors-section", {}) if not k.startswith("$")}
    all_fps = {a["fingerprint"].lower() for a in reg.values() if a.get("fingerprint")}
    preview_drafts = {k: v for k, v in cfg.get("preview-only-drafts", {}).items() if not k.startswith("$")}
    published_by_holder = held_published(src)
    lights_ok = lights_approved(src) is not None

    refusals: list[str] = []
    fatal: list[str] = []
    new_manifest: dict = {}
    groups = []
    for g in cfg["groups"]:
        members = []
        for slug in g["members"]:
            a = reg.get(slug)
            if not a:
                fatal.append(f"{slug}: not in the registry")
                continue
            holder = a.get("key_holder")
            by_holder = False
            if a.get("type") in PERSON_TYPES and holder and holder != slug:
                # a person whose key another holds: his name and key are his to publish, never a pipeline's.
                # The one exception: his key holder published him, by his own word, on record in the
                # instance config (published-by-key-holder). Then he is shown as family, with no key.
                rec = published_by_holder.get(slug)
                if not isinstance(rec, dict):
                    fatal.append(f"{slug}: a person whose key {holder} holds is not published by a pipeline")
                    continue
                if rec.get("holder") != holder:
                    fatal.append(
                        f"{slug}: the record says {rec.get('holder')!r} published him, but {holder} holds his key"
                    )
                    continue
                lacking = [k for k in ("date", "words", "record") if not str(rec.get(k) or "").strip()]
                if lacking:
                    fatal.append(f"{slug}: the key holder's publication is on record without its {', '.join(lacking)}")
                    continue
                if not g.get("family"):
                    fatal.append(f"{slug}: a person his key holder published is shown in the family group only")
                    continue
                by_holder = True
            path = a["path"]
            fp = a["fingerprint"]
            n = int(a.get("fp-attests", 2))
            decoded = fpk.kanji(fp, n)
            if decoded != a["kanji"][:n]:
                fatal.append(f"{slug}: fingerprint decodes to {decoded}, registry says {a['kanji']}")
                continue
            pub = public.get(slug, {})
            name_mark = (
                (pub.get("identity") or {}).get("kanji") if str(pub.get("status", "")).startswith("locked") else None
            )
            if slug in no_key or by_holder:  # a person, not kin: the name-mark is the name, no key material
                name_mark = None
            show_key = slug not in no_key and not by_holder
            kind = "sai" if slug in as_sai else a["type"]
            tier = "sai" if kind == "sai" else ("gardener" if kind in PERSON_TYPES else "shin")
            frame = "family" if g.get("family") else tier
            display = display_name.get(slug) or a.get("public-name") or a["name"]

            # introduction
            placed_p = src.path(intro_source.get(slug, src.k["intro"].format(path=path, slug=slug)), must_exist=False)
            if placed_p is None and preview and slug in preview_drafts:
                intro, why = judge_intro(
                    src, slug, src.path(preview_drafts[slug], must_exist=False), True, False, slug not in no_errors
                )
            else:
                intro, why = judge_intro(src, slug, placed_p, preview, True, slug not in no_errors)
            if intro:
                w = reg.get(intro["writer"], {})
                intro["writer_name"] = w.get("public-name") or w.get("name") or ""
            if why:
                refusals.append(f"{slug}: {'shown as DRAFT' if intro else 'refused'}: {why}")

            # portrait
            portrait = None
            png_rel, png = None, None
            if slug in portrait_source:  # named sibling repo + path: read exactly there, fail if missing
                ps = portrait_source[slug]
                repo_dir = src.sibling(ps["repo"])
                if not (repo_dir / ".git").exists():
                    raise Setup(f"{slug}: portrait repo {ps['repo']} is not checked out beside the garden root")
                png_rel = f"{ps['repo']}:{ps['path']}"
                png = repo_dir / ps["path"]
                if not png.is_file():
                    fatal.append(f"{slug}: no portrait at {png_rel}")
                    png = None
            else:  # the first of the config's portrait templates that exists
                for tmpl in src.k["portraits"]:
                    png_rel = tmpl.format(path=path, slug=slug)
                    png = src.path(png_rel, must_exist=False)
                    if png is not None:
                        break
            if png is not None and any(part in str(png) for part in forbidden):
                fatal.append(f"{slug}: a portrait from a forbidden place is never used ({png_rel})")
                png = None
            if png is not None:
                pseal = verify_seal(src, png)
                if not pseal["ok"]:
                    fatal.append(f"{slug}: the portrait's seal says {pseal['state']}")
                else:
                    raw = png.read_bytes()
                    out = portrait_dir / f"{slug}.webp"
                    if write_portraits:
                        portrait_dir.mkdir(parents=True, exist_ok=True)
                        out.write_bytes(encode_webp(png))
                    entry = manifest["portraits"].get(slug, {})
                    have = out.read_bytes() if out.exists() else b""
                    if write_portraits:
                        new_manifest[slug] = {"source": png_rel, "source_sha256": sha(raw), "webp_sha256": sha(have)}
                    elif entry.get("source_sha256") != sha(raw):
                        fatal.append(f"{slug}: the portrait changed at its source; run --write-portraits")
                    elif not have or entry.get("webp_sha256") != sha(have):
                        fatal.append(f"{slug}: portraits/{slug}.webp does not match its manifest")
                    portrait = f"{src.portrait_url}{slug}.webp"

            tok = read_token(src, accent_tokens[slug]) if slug in accent_tokens else None
            accent, accent_proposed = accent_of(a, rings.get(slug), tok)
            accent_proposed = accent_proposed and not lights_ok
            members.append(
                {
                    "slug": slug,
                    "short": short_name.get(slug) or display,
                    "accent": accent,
                    "accent_proposed": accent_proposed,
                    "name": display,
                    "kanji": a["kanji"],
                    "pronouns": a.get("pronouns") or "",
                    "role": (a.get("role") or "").replace("-", " "),
                    "frame": frame,
                    "portrait": portrait,
                    "name_mark": name_mark or a["kanji"],
                    "name_mark_source": "public name-mark" if name_mark else "registry",
                    "signing_mark": decoded if show_key else None,
                    "fp8": fp[:8] if show_key else None,
                    "fingerprint": fp if show_key else None,
                    "verify": f"{VERIFY}{fp}" if show_key else None,
                    "seal_svg": draw_seal(src, decoded, fp, tier, f"{display}'s seal") if show_key else None,
                    "ring": lit(
                        (
                            lambda r: (
                                recolour(r, rings[slug]["accent"].lower(), accent)
                                if accent and rings[slug].get("accent", "").lower() != accent
                                else r
                            )
                        )((lambda r: r | {"proposed": False} if lights_ok else r)(ring_of(rings[slug], preview)))
                    )
                    if slug in rings
                    else None,
                    "intro": intro,
                }
            )
            if slug not in rings:
                refusals.append(f"{slug}: no ring signature")
        groups.append(
            {k: g[k] for k in ("key", "kanji", "title", "lede") if k in g}
            | {"family": bool(g.get("family")), "members": members}
        )

    if write_portraits:
        manifest_path.write_text(
            json.dumps(
                {
                    "$note": "Generated by build_crew_data.py --write-portraits (core: skills/bonsai-garden-crew-page). Do not edit. The build refuses a portrait whose source or webp no longer matches.",
                    "size_px": PORTRAIT_PX,
                    "quality": WEBP_QUALITY,
                    "portraits": new_manifest,
                },
                indent=2,
                ensure_ascii=False,
            )
            + "\n",
            "utf-8",
        )
        print(f"wrote {len(new_manifest)} portrait(s) and {src.rel(manifest_path)}", file=report)

    print(
        f"=== crew data — {'PREVIEW (drafts shown, marked)' if preview else 'PRODUCTION (approved and sealed only)'} ===",
        file=report,
    )
    for r in refusals:
        print(f"  · {r}", file=report)
    for f in fatal:
        print(f"  ❌ {f}", file=report)
    if fatal:
        raise Refuse(f"{len(fatal)} refusal(s) stop the build")
    leaks = fingerprint_leaks(json.dumps(strip_fp_fields(groups), ensure_ascii=False), all_fps)
    for leak in leaks:
        print(f"  ❌ {leak}", file=report)
    if leaks:
        raise Refuse(f"{len(leaks)} fingerprint-shaped string(s) in the page data")
    shown = sum(1 for g in groups for m in g["members"] if m["intro"])
    total = sum(len(g["members"]) for g in groups)
    print(f"  {total} member(s), {shown} introduction(s) shown", file=report)
    rows = cfg["selector-rows"]["rows"]
    flat = [x for r in rows for x in r]
    everyone = [m["slug"] for g in groups for m in g["members"]]
    if len(rows) != 2 or sorted(flat) != sorted(everyone) or len(set(flat)) != len(flat):
        raise Refuse("selector-rows must be two rows holding every member exactly once")
    if abs(len(rows[0]) - len(rows[1])) > 1:
        raise Refuse(f"selector rows of {len(rows[0])} and {len(rows[1])}: almost the same count, please")
    return {"mode": "preview" if preview else "production", "route": src.route, "groups": groups, "rows": rows}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", required=True, help="the instance's crew-page config (JSON)")
    ap.add_argument(
        "--preview", action="store_true", help="include drafts, marked DRAFT (or IN REVIEW, for status in-review)"
    )
    ap.add_argument("--write-portraits", action="store_true", help="regenerate the webps and their manifest")
    ap.add_argument("--check-html", nargs="+", metavar="HTML", help="refuse a built page carrying a stray fingerprint")
    ap.add_argument(
        "--check-built", metavar="DIST", help="the built pages: every member page, navigation in order, no stray hex"
    )
    a = ap.parse_args(argv)
    try:
        src = Sources(Path(a.config))
        configure(src)
        if a.check_html:
            return html_problems(src, a.check_html)
        if a.check_built:
            dist = Path(a.check_built)
            cfg = load_members(src)
            rows = cfg["selector-rows"]["rows"]
            order = [x for r in rows for x in r]
            with open(os.devnull, "w") as null:
                data = build(False, False, null, src)
            accents = {m["slug"]: m["accent"] for g in data["groups"] for m in g["members"]}
            fps = {m["slug"]: m["fingerprint"] for g in data["groups"] for m in g["members"] if m.get("fingerprint")}
            problems = check_built(dist, order, accents, fps, rows, src.c.get("forbidden_html_parts", []))
            for x in problems:
                print(f"  ❌ {x}")
            pages = [str(p) for p in sorted(_route_dir(dist).rglob("index.html"))]
            print(
                f"{'FAIL' if problems else 'ok  '}  {len(order)} member page(s), navigation, selector: {len(problems)} problem(s)"
            )
            hex_rc = html_problems(src, pages) if pages else 1
            return 1 if problems or hex_rc else 0
        data = build(a.preview, a.write_portraits, sys.stderr, src)
    except Setup as e:
        print(f"FATAL: {e}", file=sys.stderr)
        return 2
    except Refuse as e:
        print(f"REFUSED: {e}", file=sys.stderr)
        return 1
    if not a.write_portraits:
        json.dump(data, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
