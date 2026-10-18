#!/usr/bin/env python3
# ---
# id: 01M3BS43P0ZFT4WQ4V8BPRQXNS
# ---
"""
make-portrait-thumbs.py — regenerate every agent's greeting-portrait thumbnail
from its full-resolution portrait.png.

Why this exists
---------------
2026-09-11. The greeting portrait had been failing to render for weeks. Three
rounds of diagnosis blamed the show_widget sandbox (CSP on data:, then on
blob:). All of that was wrong. The sandbox decodes data:, blob:, JPEG, PNG,
WebP and AVIF without complaint — each verified live.

The real fault: agents/baisai/assets/portrait-thumb.b64 was 7,920 base64 chars,
and only 7,064 of them survived the trip into widget_code. A JPEG missing its
last 642 bytes has no EOI marker, so the decoder fires onerror — which looks
exactly like a CSP block, which is why it misled three rounds of investigation.

52% of that file was Adobe XMP + Photoshop IPTC + EXIF written by weave-in, and
none of it is any use in a thumbnail. Strip it and the same picture costs 1,486
bytes instead of 5,939.

2026-09-12 addendum — the ceiling is not the only failure mode. A SECOND,
independent corruption source was caught live this session: relaying a base64
string from one tool result into a later tool call is not guaranteed lossless
even when the string is well under FAIL_CHARS. A verified 2,828-char payload
(well inside the "warn" band, nowhere near FAIL_CHARS) came out at 2,829 chars
after passing through an LLM turn — one substituted/inserted character, same
failure shape (broken base64 padding, decoder throws). Byte-length alone can't
catch this, because a same-length substitution changes nothing the old .meta
checked. That is why this revision adds a STRING-level checksum (FNV-1a/32,
computed over the base64 text itself, not the decoded image) to the sidecar:
cheap enough to reimplement in a widget's inline <script> with no crypto API
dependency, and it catches single-character drift that byte-length can't.
Practical consequence: prefer the smallest size that still reads as a face
(144px validated empirically against all 18 current agents at q75 webp, real
margin under FAIL_CHARS) over the largest size that merely clears the ceiling
— smaller payloads are relayed correctly more often, not just permitted more.

So this tool does three things the old pipeline did not:
  1. Emits thumbnails with ALL metadata stripped, small enough to transcribe
     into a widget without truncation.
  2. Writes a sidecar .b64.meta next to each thumb recording the exact byte
     count, SHA-256, base64 length AND a base64-string-level FNV-1a checksum,
     so the greeting widget can self-check what it received on TWO independent
     axes (truncation via length, substitution via checksum) and fail LOUDLY
     instead of silently.
  3. Feeds the fallback chain documented in agents/shared/routines.md §Routine
     2.5: this script's output is tier 2 (verified local embed); when it
     fails verification the routine drops to tier 3 (kanji/initials glyph,
     see make-identity-cards.py) and finally tier 4 (plain ASCII identity
     card, same tool) — no tier ever shows the visitor a raw decode error.

Never let a thumbnail carry metadata. Never ship one without its .meta.

Usage (run from repo root, or pass --repo-root)
-----
  python3 skills/bonsai-garden-portrait/scripts/make-portrait-thumbs.py                  # dry run, report only
  python3 skills/bonsai-garden-portrait/scripts/make-portrait-thumbs.py --apply
  python3 skills/bonsai-garden-portrait/scripts/make-portrait-thumbs.py --size 288 --format avif --quality 60
  python3 skills/bonsai-garden-portrait/scripts/make-portrait-thumbs.py --agent bonsai --apply

Sizing
------
--size is SOURCE pixels, not display pixels. The greeting card shows the thumb
in a 96px CSS box, so 144px still gives a >1x render and clears the relay-
safety ceiling with real margin (worst case across all 18 current agents:
4,840 of 7,000 b64 chars at 144px/webp/q75). 192px was the original documented
default and is kept available for CDN/offline use (jsDelivr, a public repo
mirror) where relay-through-tool-calls never happens — but it is NOT the
recommended size for anything that has to pass through show_widget, because
7 of 18 agents exceeded FAIL_CHARS at 192px/webp/q80, and AVIF at 192px was
worse across the board, not better, despite AVIF's usual efficiency edge.
DPI metadata is irrelevant on screen and is deliberately not written.

Codec guidance: webp is the safe default (proven here, universally supported by
the site and kiosk readers too). avif buys roughly 15-25% more detail per byte
at LARGER sizes, but underperformed webp on this specific content at 192px —
re-measure before trusting the usual assumption if you change size or content.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import sys
from datetime import date
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install --upgrade Pillow")


def _default_repo_root() -> Path:
    """Run-from-repo-root by convention (matches every other tool in this
    skill), overridable with --repo-root. Deliberately NOT derived from
    __file__'s nesting depth — this script moved from tools/portraits/ (mono)
    into skills/bonsai-garden-portrait/scripts/ (core) with a different depth, and a
    hardcoded parents[N] silently breaks every time a script's folder moves.
    """
    return Path.cwd()


REPO: Path = _default_repo_root()
AGENTS: Path = REPO / "agents"

# Transcription safety. Round 1 lost a 7,920-char payload; 1,984 came through
# clean. Anything above WARN is asking to be truncated again -- and the .meta
# self-check is what makes that survivable rather than mysterious.
#
# NOTE (2026-09-12): these thresholds guard against TRUNCATION. They do not
# and cannot guard against same-length SUBSTITUTION corruption (see the
# module docstring's 2,828-char near-miss) — that is what checksum_fnv1a32
# in the .meta sidecar is for. Treat WARN/FAIL as "don't make it bigger than
# it needs to be", not "under this line, relay is safe."
WARN_CHARS = 4000
FAIL_CHARS = 7000

MIME = {"jpeg": "image/jpeg", "webp": "image/webp", "png": "image/png", "avif": "image/avif"}

FNV_OFFSET_32 = 0x811C9DC5
FNV_PRIME_32 = 0x01000193
FNV_MASK_32 = 0xFFFFFFFF


def fnv1a32(data: bytes) -> str:
    """FNV-1a, 32-bit, returned as 8 lowercase hex chars.

    Deliberately not SHA-256: this checksum has to be reimplementable in a
    few lines of inline JS inside a show_widget sandbox with no crypto API
    available, so a widget can self-check the base64 STRING it actually
    received (not the decoded image — the corruption happens before decode)
    before it ever tries to render. Reference JS:

        function fnv1a32(str) {
          let h = 0x811c9dc5;
          for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
          }
          return (h >>> 0).toString(16).padStart(8, "0");
        }
    """
    h = FNV_OFFSET_32
    for byte in data:
        h ^= byte
        h = (h * FNV_PRIME_32) & FNV_MASK_32
    return f"{h:08x}"


def encode(im: Image.Image, fmt: str, quality: int) -> bytes:
    """Encode with every metadata chunk dropped."""
    buf = io.BytesIO()
    rgb = im.convert("RGB")
    if fmt == "jpeg":
        rgb.save(buf, "JPEG", quality=quality, optimize=True, progressive=False)
    elif fmt == "webp":
        rgb.save(buf, "WEBP", quality=quality, method=6)
    elif fmt == "avif":
        rgb.save(buf, "AVIF", quality=quality)
    elif fmt == "png":
        rgb.save(buf, "PNG", optimize=True)
    else:
        raise ValueError(f"unsupported format: {fmt}")
    return buf.getvalue()


def strip_check(data: bytes, fmt: str) -> str:
    """Confirm the encoder really did drop the metadata blocks."""
    problems = []
    if fmt == "jpeg":
        for marker, name in ((b"\xff\xe1", "APP1/EXIF-XMP"), (b"\xff\xed", "APP13/IPTC")):
            if marker in data[:2048]:
                problems.append(name)
    if b"http://ns.adobe.com/xap" in data or b"<x:xmpmeta" in data:
        problems.append("XMP payload")
    if b"8BIM" in data:
        problems.append("Photoshop resource block")
    return "clean" if not problems else "STILL PRESENT: " + ", ".join(problems)


def process(slug: str, src: Path, size: int, fmt: str, quality: int, apply: bool):
    im = Image.open(src)
    im.load()
    orig = im.size
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)

    data = encode(im, fmt, quality)
    b64 = base64.b64encode(data).decode("ascii")

    meta = {
        "agent": slug,
        "generated": date.today().isoformat(),
        "generator": "tools/portraits/make-portrait-thumbs.py",
        "source": str(src.relative_to(REPO)),
        "source_px": list(orig),
        "px": size,
        "format": fmt,
        "mime": MIME[fmt],
        "quality": quality if fmt != "png" else None,
        "bytes": len(data),
        "b64_chars": len(b64),
        "sha256": hashlib.sha256(data).hexdigest(),
        "checksum_fnv1a32": fnv1a32(b64.encode("ascii")),
        "metadata_stripped": True,
        "note": (
            "Greeting widget MUST verify BOTH before render: (1) decoded "
            "length == bytes, (2) fnv1a32(received base64 string) == "
            "checksum_fnv1a32. (1) alone only catches truncation; (2) "
            "catches same-length substitution too. On failure, do not "
            "show a raw decode error — degrade to the kanji/initials "
            "glyph, then the plain-text ASCII card. See routines.md "
            "Routine 2.5."
        ),
    }

    status = "ok"
    if len(b64) >= FAIL_CHARS:
        status = "TOO LARGE"
    elif len(b64) >= WARN_CHARS:
        status = "large"

    if apply:
        (src.parent / "portrait-thumb.b64").write_text(b64 + "\n", encoding="ascii")
        (src.parent / "portrait-thumb.b64.meta").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    return meta, status, strip_check(data, fmt)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument(
        "--size",
        type=int,
        default=144,
        help="source pixels, square (default 144 — validated "
        "relay-safe for all current agents at webp q75; "
        "use 192+ only for CDN/offline delivery that never "
        "passes through show_widget)",
    )
    ap.add_argument("--format", default="webp", choices=("webp", "avif", "jpeg", "png"))
    ap.add_argument("--quality", type=int, default=75)
    ap.add_argument("--agent", help="single agent slug; default is all")
    ap.add_argument(
        "--repo-root", type=Path, default=None, help="repo root (default: current directory — run this from repo root)"
    )
    ap.add_argument("--apply", action="store_true", help="write files (default is a dry run)")
    args = ap.parse_args()

    global REPO, AGENTS
    REPO = args.repo_root or _default_repo_root()
    AGENTS = REPO / "agents"

    if not AGENTS.is_dir():
        print(f"agents/ not found under {REPO}")
        return 1

    # Each body where the registry's own `path` puts it (a nested body such as
    # agents/baisai/fuji-shin was invisible to a plain agents/<slug>/ scan;
    # 2026-09-28), then any agents/<slug>/ the registry does not name.
    bodies = {}
    reg = AGENTS / "registry.json"
    if reg.is_file():
        try:
            entries = json.loads(reg.read_text(encoding="utf-8"))["agents"]
            for e in entries if isinstance(entries, list) else entries.values():
                if e.get("slug") and e.get("path"):
                    bodies[e["slug"]] = REPO / e["path"]
        except (ValueError, KeyError) as e:
            sys.exit(
                f"make-portrait-thumbs: REFUSED — agents/registry.json unreadable ({e}); fix it rather than scanning a guessed tree"
            )
    for d in sorted(AGENTS.iterdir()):
        if d.is_dir():
            bodies.setdefault(d.name, d)
    targets = []
    for slug, d in sorted(bodies.items()):
        if args.agent and slug != args.agent:
            continue
        p = d / "assets" / "portrait.png"
        if p.is_file():
            targets.append((slug, p))

    if not targets:
        print("no portrait.png found" + (f" for '{args.agent}'" if args.agent else ""))
        return 1

    print(f"{'agent':<12} {'source':>11} {'bytes':>7} {'b64':>7}  {'chk':<8} {'status':<9} metadata")
    print("-" * 78)

    worst = "ok"
    for slug, src in targets:
        try:
            meta, status, strip = process(slug, src, args.size, args.format, args.quality, args.apply)
        except Exception as e:
            print(f"{slug:<12} {'':>11} {'':>7} {'':>7}  {'':<8} ERROR     {e}")
            worst = "TOO LARGE"
            continue
        print(
            f"{slug:<12} {str(meta['source_px'][0]) + 'px':>11} "
            f"{meta['bytes']:>7} {meta['b64_chars']:>7}  "
            f"{meta['checksum_fnv1a32']:<8} {status:<9} {strip}"
        )
        if status == "TOO LARGE" or (status == "large" and worst == "ok"):
            worst = status

    print()
    print(
        f"target {args.size}px {args.format} q{args.quality} · "
        f"warn above {WARN_CHARS} b64 chars · fail above {FAIL_CHARS} "
        f"(round 1 truncated at 7064)"
    )
    print(
        "DRY RUN — nothing written. re-run with --apply"
        if not args.apply
        else "written: portrait-thumb.b64 + portrait-thumb.b64.meta per agent "
        "(meta now carries checksum_fnv1a32 alongside sha256)"
    )
    if worst == "TOO LARGE":
        print(
            "!! at least one thumb exceeds the transcription-safe ceiling. "
            "Drop --size, drop --quality, or switch --format avif before shipping."
        )
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
