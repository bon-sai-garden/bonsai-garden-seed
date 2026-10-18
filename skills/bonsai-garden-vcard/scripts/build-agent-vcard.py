#!/usr/bin/env python3
# ---
# id: 01M3953H363PMB496YVHRGGSFM
# title: build-agent-vcard.py — a vCard 3.0 contact card for a garden's kin
# type: script
# tended-by: baisai
# created: 2026-09-03
# updated: 2026-10-12
# ---
"""
build-agent-vcard.py — vCard 3.0 builder for a Bonsai Garden's kin.

Reads the kin's about-me.md and portrait (portrait-thumb.jpg preferred, else
portrait.jpg / portrait.png) and, when the garden has one, the kin's entry in
agents/registry.json. Handles:
  - Inline JPEG embedding with correct 75-char folding and CRLF continuation
  - Kanji secondary name (NICKNAME, and X-BONSAI-KANJI)
  - How the name is said, when the kin's files say it (X-PHONETIC-LAST-NAME)
  - Fingerprint and, when given, a key/verify URI
  - PNG -> JPEG conversion on-the-fly (requires Pillow)

Nothing here names one garden. The title, display name, kanji and fingerprint
come from the kin's own files (registry entry, about-me); the garden's domain,
URL, email and verify link are flags, and a field with no value is left out
rather than filled with somebody else's.

Usage:
    python3 build-agent-vcard.py --agent-dir agents/<slug>
    python3 build-agent-vcard.py --agent-dir agents/<slug> --domain example.garden
    python3 build-agent-vcard.py --about-me about-me.md --portrait portrait-thumb.jpg \
        --registry agents/registry.json --title "Engineer"
"""

from __future__ import annotations

import argparse
import base64
import io
import re
import sys
from pathlib import Path

# Registry fields a title is read from, in order. `title` and `role` are the natural
# names; `one-line` is the short self-description every registry entry carries.
TITLE_FIELDS = ("title", "role", "one-line")

# Where a kin's files say how the name is spoken, for a contacts app: the registry
# entry first, then the about-me frontmatter. A spelling the app's voice reads right
# (Trime -> "Trim"), not IPA. Absent means the field is left out, never the slug:
# the slug is how the name is WRITTEN, lowercased, and a card that offers it as the
# pronunciation says "trime" for a kin whose e is silent (found 2026-09-26).
PHONETIC_FIELD = "phonetic-name"


# ── vCard line folding (RFC 2426 / RFC 6350) ──────────────────────────────────

CRLF = "\r\n"
FOLD_AT = 75  # octets — fold before exceeding this


def _fold(line: str) -> str:
    """Fold a vCard content line at 75 octets using CRLF + SPACE continuation."""
    encoded = line.encode("utf-8")
    if len(encoded) <= FOLD_AT:
        return line

    parts: list[str] = []
    current_chars = ""
    current_bytes = b""

    for char in line:
        char_bytes = char.encode("utf-8")
        if len(current_bytes) + len(char_bytes) > FOLD_AT:
            parts.append(current_chars)
            # Continuation line: leading SPACE counts as 1 octet
            current_bytes = b" " + char_bytes
            current_chars = " " + char
        else:
            current_bytes += char_bytes
            current_chars += char

    if current_chars:
        parts.append(current_chars)

    return CRLF.join(parts)


def _fold_base64(prop_prefix: str, b64_data: str) -> str:
    """
    Fold a base64 property (PHOTO;ENCODING=b;TYPE=JPEG:<data>).

    The prefix + ":" consumes some of the 75-char first-line budget.
    Each subsequent line starts with a space (1 char, 1 octet).
    Returns a CRLF-joined string, no trailing CRLF.
    """
    first_budget = FOLD_AT - len(prop_prefix.encode("utf-8")) - 1  # -1 for ":"
    cont_budget = FOLD_AT - 1  # -1 for leading space

    # Strip any existing whitespace from b64_data
    data = b64_data.replace("\n", "").replace("\r", "").replace(" ", "")

    lines: list[str] = []
    if first_budget > 0:
        lines.append(prop_prefix + ":" + data[:first_budget])
        data = data[first_budget:]
    while data:
        lines.append(" " + data[:cont_budget])
        data = data[cont_budget:]

    return CRLF.join(lines)


# ── Portrait loading ──────────────────────────────────────────────────────────

CARD_PHOTO_PX = 256


def _parse_crop(text: str) -> tuple:
    """`CX,CY,SIZE` (fractions of the portrait): the centre of a square and its side as a share of the shorter side. Raises ValueError."""
    parts = text.split(",")
    if len(parts) != 3:
        raise ValueError("--photo-crop is CX,CY,SIZE: three numbers (fractions of the portrait)")
    try:
        cx, cy, size = (float(x) for x in parts)
    except ValueError:
        raise ValueError("--photo-crop is CX,CY,SIZE: three numbers (fractions of the portrait)") from None
    if not (0 < size <= 1):
        raise ValueError(
            "--photo-crop: SIZE is the square's side as a share of the portrait's shorter side, above 0 and at most 1"
        )
    if not (cx - size / 2 >= 0 and cx + size / 2 <= 1 and cy - size / 2 >= 0 and cy + size / 2 <= 1):
        raise ValueError("--photo-crop: the square must lie inside the portrait (CX,CY is its centre, SIZE its side)")
    return cx, cy, size


def _crop_to_card_photo(portrait_path: Path, crop: tuple) -> bytes:
    """A card's photo is chosen for the card (a rehearsal gardener's ask, 2026-10-11): Contacts shows it in a circle, and a full-figure portrait
    leaves the face small and off-centre. Cut the square the caller named and resize it to 256x256, for the card only."""
    try:
        from PIL import Image  # type: ignore
    except ImportError as e:
        raise RuntimeError("--photo-crop needs Pillow (pip install Pillow)") from e
    cx, cy, size = crop
    with Image.open(portrait_path) as img:
        img = img.convert("RGB")
        side = size * min(img.size)
        left, top = cx * img.width - side / 2, cy * img.height - side / 2
        box = (round(left), round(top), round(left + side), round(top + side))
        out = img.crop(box).resize((CARD_PHOTO_PX, CARD_PHOTO_PX), Image.LANCZOS)
        buf = io.BytesIO()
        out.save(buf, format="JPEG", quality=88, optimize=True)
        return buf.getvalue()


def _load_portrait_jpeg(portrait_path: Path) -> bytes:
    """
    Return raw JPEG bytes from portrait_path.

    If the file is already JPEG (.jpg / .jpeg), reads bytes directly.
    If PNG, converts to JPEG via Pillow (required).
    Raises RuntimeError with a user-friendly message on failure.
    """
    suffix = portrait_path.suffix.lower()

    if suffix in (".jpg", ".jpeg"):
        return portrait_path.read_bytes()

    if suffix == ".png":
        try:
            from PIL import Image  # type: ignore
        except ImportError as e:
            raise RuntimeError(
                f"Portrait is PNG ({portrait_path.name}) but Pillow is not installed.\n"
                "Install with: pip install Pillow\n"
                "Or supply a JPEG portrait directly (portrait-thumb.jpg is preferred)."
            ) from e
        with Image.open(portrait_path) as img:
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85, optimize=True)
            return buf.getvalue()

    raise RuntimeError(f"Unsupported portrait format {suffix!r}. Supply a .jpg or .png file.")


def _find_portrait(assets_dir: Path) -> Path | None:
    """Find the best portrait file in an agent's assets/ directory."""
    candidates = [
        assets_dir / "portrait-avatar.jpg",  # made for the card (a square the kin chose); preferred
        assets_dir / "portrait-thumb.jpg",
        assets_dir / "portrait-thumb.jpeg",
        assets_dir / "portrait.jpg",
        assets_dir / "portrait.jpeg",
        assets_dir / "portrait.png",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


# ── about-me.md parsing ───────────────────────────────────────────────────────


def _parse_frontmatter(text: str) -> dict[str, str]:
    """Extract key/value pairs from YAML frontmatter (no yaml dependency)."""
    m = re.match(r"\A---[ \t]*\n(.*?)\n---[ \t]*(?:\n|\Z)", text, re.DOTALL)
    if not m:
        return {}
    fm: dict[str, str] = {}
    sign_block = False
    for line in m.group(1).splitlines():
        if re.match(r"^sign:\s*$", line):
            sign_block = True
            continue
        if sign_block:
            # Capture sign sub-keys
            sm = re.match(r"^\s+([\w-]+):\s*(.+)$", line)
            if sm:
                fm[f"sign.{sm.group(1).strip()}"] = sm.group(2).strip().strip('"')
            elif not line.startswith(" "):
                sign_block = False
        kv = re.match(r"^([\w-]+):\s*(.+)$", line)
        if kv and not sign_block:
            fm[kv.group(1).strip()] = kv.group(2).strip().strip('"')
    return fm


def _extract_kanji(text: str) -> str | None:
    """
    Extract kanji name from about-me.md body.

    Looks for the identity line: **Identity:** <kanji> — ...
    Returns the kanji string or None.
    """
    # Pattern: ** Identity:** followed by one or more CJK chars: the unified ideographs, hiragana, katakana
    m = re.search(
        r"\*\*Identity:\*\*\s+([\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]+)",
        text,
    )
    return m.group(1) if m else None


def find_about_me(agent_dir: Path) -> Path:
    """about-me.md sits in references/ in a 3.0 shintai, at the root in older ones."""
    for c in (agent_dir / "references" / "about-me.md", agent_dir / "about-me.md"):
        if c.is_file():
            return c
    return agent_dir / "references" / "about-me.md"


def find_registry(start: Path) -> Path | None:
    """The garden's agents/registry.json, found by walking up from the kin's directory."""
    for d in (start, *start.parents):
        if d.name == "agents" and (d / "registry.json").is_file():
            return d / "registry.json"
        if (d / "agents" / "registry.json").is_file():
            return d / "agents" / "registry.json"
    return None


def registry_entry(registry_path: Path | None, slug: str | None) -> dict:
    if not registry_path or not slug:
        return {}
    import json

    try:
        data = json.loads(registry_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise RuntimeError(f"cannot read the registry {registry_path}: {e}") from e
    for a in data.get("agents", []) if isinstance(data, dict) else []:
        if isinstance(a, dict) and a.get("slug") == slug:
            return a
    return {}


def title_from(entry: dict) -> str | None:
    for k in TITLE_FIELDS:
        v = entry.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def parse_about_me(about_me_path: Path) -> dict[str, str | None]:
    """Parse about-me.md and return a dict of known fields."""
    text = about_me_path.read_text(encoding="utf-8")
    fm = _parse_frontmatter(text)

    slug = fm.get("tended-by")
    fingerprint = fm.get("sign.fingerprint", fm.get("fingerprint"))
    kanji = _extract_kanji(text)

    return {
        "slug": slug,
        "fingerprint": fingerprint,
        "kanji": kanji,
        "phonetic": fm.get(PHONETIC_FIELD),
    }


# ── vCard 3.0 builder ─────────────────────────────────────────────────────────


def build_agent_vcard(
    slug: str,
    title: str | None,
    org: str | None,
    email: str | None,
    url: str | None,
    fingerprint: str | None,
    kanji: str | None,
    jpeg_bytes: bytes | None,
    display_name: str | None = None,
    key_uri: str | None = None,
    phonetic: str | None = None,
) -> str:
    """
    Build a vCard 3.0 string for one of a garden's kin. Empty fields are left out.

    Returns full vCard text with CRLF line endings per RFC 2426.
    """
    display_name = display_name or (slug.capitalize() if "-" not in slug else slug.title())

    lines: list[str] = [
        "BEGIN:VCARD",
        "VERSION:3.0",
    ]

    # ── Primary display name (Latin) ──────────────────────────────────────
    lines.append(_fold(f"FN:{display_name}"))
    lines.append(_fold(f"N:{display_name};;;;"))
    # N puts the name in the FAMILY slot, so its reading is the phonetic LAST name; a
    # phonetic first name would sit against an empty given name and be read as a second
    # name. Only what the kin's files say; no guess.
    if phonetic:
        lines.append(_fold(f"X-PHONETIC-LAST-NAME:{phonetic}"))

    # ── Kanji secondary name ─────────────────────────────────────────────
    # vCard 3.0 allows exactly one FN (RFC 2426), so the kanji is a NICKNAME, not a second FN
    # (Bonsai's first-user test, 2026-09-24: two FN lines confuse some clients).
    if kanji:
        lines.append(_fold(f"NICKNAME;CHARSET=UTF-8:{kanji}"))
        lines.append(_fold(f"X-BONSAI-KANJI:{kanji}"))

    # ── Work identity ─────────────────────────────────────────────────────
    if title:
        lines.append(_fold(f"TITLE:{title}"))
    if org:
        lines.append(_fold(f"ORG:{org}"))

    # ── Contact ───────────────────────────────────────────────────────────
    if email:
        lines.append(_fold(f"EMAIL;TYPE=INTERNET,PREF:{email}"))
    if url:
        lines.append(_fold(f"URL:{url}"))

    # ── Workshop identity ─────────────────────────────────────────────────
    if key_uri:
        lines.append(_fold(f"KEY;TYPE=URI:{key_uri}"))
    if fingerprint:
        # The FULL fingerprint: /verify needs all 32 characters, so a shortened one could not be
        # checked (Bonsai's first-user test, 2026-09-24). A human reads the kanji; a verifier reads this.
        lines.append(_fold(f"X-FINGERPRINT:{fingerprint}"))

    # ── Inline photo ──────────────────────────────────────────────────────
    # Embedding notes:
    #   - vCard 3.0 uses ENCODING=b (base64) with TYPE=JPEG
    #   - Lines must fold at 75 octets; continuation lines start with SPACE
    #   - portrait-thumb.jpg (≈ 6 KB → ≈ 8 KB base64) is strongly preferred
    #     over portrait.png (≈ 950 KB → ≈ 1.3 MB) which most apps discard
    if jpeg_bytes:
        b64 = base64.b64encode(jpeg_bytes).decode("ascii")
        prop_prefix = "PHOTO;ENCODING=b;TYPE=JPEG"
        lines.append(_fold_base64(prop_prefix, b64))

    lines.append("END:VCARD")

    return CRLF.join(lines) + CRLF


# ── CLI ───────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a vCard 3.0 (.vcf) for a Bonsai Garden agent.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--agent-dir",
        metavar="PATH",
        help="Root of an agent directory (agents/<slug>/) — derives about-me, portrait, and output paths.",
    )
    parser.add_argument("--about-me", metavar="PATH", help="Explicit path to about-me.md")
    parser.add_argument("--portrait", metavar="PATH", help="Explicit path to portrait image (JPEG preferred)")
    parser.add_argument("--output", metavar="PATH", help="Output .vcf file path (default: <assets-dir>/<slug>.vcf)")
    parser.add_argument(
        "--registry",
        metavar="PATH",
        help="The garden's agents/registry.json (default: found by walking up from --agent-dir; none is fine)",
    )
    parser.add_argument("--slug", metavar="SLUG", help="The kin's slug (default: about-me's tended-by)")
    parser.add_argument(
        "--title", metavar="TEXT", help="Title (default: the registry entry's title, role or one-line; else left out)"
    )
    parser.add_argument(
        "--org",
        metavar="TEXT",
        default="Bonsai Garden",
        help="Organisation field (default: Bonsai Garden, the craft's name)",
    )
    parser.add_argument(
        "--domain",
        metavar="DOMAIN",
        help="The garden's domain; gives the email (<slug>@DOMAIN) and URL (https://DOMAIN) defaults. None by default",
    )
    parser.add_argument("--email", metavar="TEXT", help="Email (default: <slug>@<domain> with --domain, else left out)")
    parser.add_argument(
        "--url", metavar="TEXT", help="Website URL (default: https://<domain> with --domain, else left out)"
    )
    parser.add_argument(
        "--key-url",
        metavar="TEMPLATE",
        help="KEY URI; {fingerprint} is replaced with the kin's full fingerprint "
        "(e.g. https://example.garden/verify/?fp={fingerprint}). Left out by default",
    )
    parser.add_argument(
        "--phonetic",
        metavar="TEXT",
        help="How the name is said, as a spelling a contacts app reads right "
        f"(default: the registry entry's or about-me's `{PHONETIC_FIELD}`; "
        "else left out)",
    )
    parser.add_argument("--no-photo", action="store_true", help="Omit the photo field entirely")
    parser.add_argument(
        "--photo-crop",
        metavar="CX,CY,SIZE",
        help="cut the card's photo from the portrait: a square centred at CX,CY (fractions of the portrait) whose side "
        "is SIZE of the portrait's shorter side, resized to 256x256, for the card only. Contacts shows a card "
        "photo in a circle: a full-figure portrait leaves the face small and off-centre",
    )
    args = parser.parse_args()
    crop = None
    if args.photo_crop:
        try:
            crop = _parse_crop(args.photo_crop)
        except ValueError as e:
            parser.error(str(e))

    # ── Resolve paths ─────────────────────────────────────────────────────
    about_me_path: Path | None = None
    portrait_path: Path | None = None
    output_path: Path | None = None

    if args.agent_dir:
        agent_dir = Path(args.agent_dir).expanduser().resolve()
        assets_dir = agent_dir / "assets"
        about_me_path = about_me_path or find_about_me(agent_dir)
        portrait_path = portrait_path or _find_portrait(assets_dir)
        output_path = output_path or None  # resolved after parsing slug

    if args.about_me:
        about_me_path = Path(args.about_me).expanduser().resolve()
    if args.portrait:
        portrait_path = Path(args.portrait).expanduser().resolve()
    if args.output:
        output_path = Path(args.output).expanduser().resolve()

    if not about_me_path or not about_me_path.exists():
        print(f"error: about-me.md not found at {about_me_path}", file=sys.stderr)
        sys.exit(1)

    # ── Parse about-me.md ─────────────────────────────────────────────────
    parsed = parse_about_me(about_me_path)
    # Whose card this is comes from the BODY — its folder, agents/<slug>/ — never from the
    # about-me's `tended-by:`, which names who tends the document. Jisai tends Bonsai's
    # about-me, and the first 2.0.0 made Bonsai's card read "Jisai" (found 2026-09-24).
    body_dir = about_me_path.parent.parent if about_me_path.parent.name == "references" else about_me_path.parent
    slug = args.slug or (body_dir.name if body_dir.parent.name == "agents" else None)

    if not slug:
        print("error: can't tell whose card this is — pass --agent-dir agents/<slug> or --slug", file=sys.stderr)
        sys.exit(1)

    registry_path = Path(args.registry).expanduser().resolve() if args.registry else find_registry(about_me_path.parent)
    if args.registry and not registry_path.is_file():
        print(f"error: registry not found at {registry_path}", file=sys.stderr)
        sys.exit(1)
    try:
        entry = registry_entry(registry_path, slug)
    except RuntimeError as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)

    # The registry is the source for identity. The about-me's seal names whoever SEALED the file,
    # which is not always its owner, so it is only a fallback, and a disagreement is said aloud.
    fingerprint = entry.get("fingerprint") or parsed["fingerprint"]
    kanji = entry.get("kanji") or parsed["kanji"]
    if (
        entry.get("fingerprint")
        and parsed["fingerprint"]
        and not str(entry["fingerprint"]).startswith(str(parsed["fingerprint"])[:8])
    ):
        print(
            f"warning: about-me is sealed by {parsed['fingerprint'][:8]}, the registry says "
            f"{slug} is {str(entry['fingerprint'])[:8]} — using the registry",
            file=sys.stderr,
        )

    # ── Field defaults: the kin's own files, then the flags, never a guess ─
    title = args.title or title_from(entry)
    phonetic = args.phonetic or entry.get(PHONETIC_FIELD) or parsed["phonetic"]
    email = args.email or (f"{slug}@{args.domain}" if args.domain else None)
    url = args.url or (f"https://{args.domain}" if args.domain else None)
    key_uri = args.key_url.replace("{fingerprint}", fingerprint or "") if args.key_url else None
    if args.key_url and "{fingerprint}" in args.key_url and not fingerprint:
        key_uri = None
        print("key-url: SKIPPED — the template needs a fingerprint and none was found", file=sys.stderr)

    # ── Resolve output path ───────────────────────────────────────────────
    if not output_path:
        if args.agent_dir:
            assets_dir = Path(args.agent_dir).expanduser().resolve() / "assets"
            assets_dir.mkdir(parents=True, exist_ok=True)
            output_path = assets_dir / f"{slug}.vcf"
        else:
            output_path = Path(f"{slug}.vcf")

    # ── Load portrait ─────────────────────────────────────────────────────
    jpeg_bytes: bytes | None = None
    if not args.no_photo:
        if portrait_path and portrait_path.exists():
            try:
                jpeg_bytes = _crop_to_card_photo(portrait_path, crop) if crop else _load_portrait_jpeg(portrait_path)
                size_kb = len(jpeg_bytes) / 1024
                print(f"portrait: {portrait_path.name}  ({size_kb:.1f} KB as JPEG)")
                if size_kb > 100:
                    print(
                        f"  ⚠  Portrait is {size_kb:.0f} KB — most contacts apps silently\n"
                        f"     discard photos larger than ~100 KB. Use portrait-thumb.jpg\n"
                        f"     instead (the bonsai-garden-portrait skill makes one).",
                        file=sys.stderr,
                    )
            except RuntimeError as e:
                print(f"portrait: SKIPPED — {e}", file=sys.stderr)
        else:
            print("portrait: not found — vCard will have no photo", file=sys.stderr)

    # ── Build ─────────────────────────────────────────────────────────────
    vcf = build_agent_vcard(
        slug=slug,
        title=title,
        org=args.org or None,
        email=email,
        url=url,
        fingerprint=fingerprint,
        kanji=kanji,
        jpeg_bytes=jpeg_bytes,
        display_name=entry.get("name"),
        key_uri=key_uri,
        phonetic=phonetic,
    )

    # ── Write ─────────────────────────────────────────────────────────────
    output_path.write_text(vcf, encoding="utf-8")
    print(f"written: {output_path}  ({len(vcf):,} bytes)")
    if kanji:
        print(f"  kanji:       {kanji}")
    if phonetic:
        print(f"  phonetic:    {phonetic}")
    if fingerprint:
        print(f"  fingerprint: {fingerprint}")


if __name__ == "__main__":
    main()
