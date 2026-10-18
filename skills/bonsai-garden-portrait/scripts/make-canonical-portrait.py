#!/usr/bin/env python3
# ---
# id: 01M3BS43NR2DA9Z8FPWV6ZC4AN
# ---
"""
make-canonical-portrait.py — turn a source photo/render into an agent's
canonical portrait, woven with EXIF authorship metadata and a signed C2PA
manifest.

Part of the bonsai-garden-portrait skill (stage 1 of 3):
  1. make-canonical-portrait.py   source.jpg/png -> agents/<slug>/assets/portrait.png
  2. make-portrait-thumbs.py      portrait.png    -> portrait-thumb.b64 (+ .meta)
  3. make-identity-cards.py       registry.json   -> portrait-card.txt

The source is whatever a gardener provides (a photo, a commissioned piece) or
whatever was generated on their behalf (an AI render) — either way, a plain
jpeg/png. This script center-crops it to a square and resizes to the
canonical size (512px by default), then weaves in two independent layers of
authorship: a fast human-readable EXIF/XMP/IPTC layer (exiftool), and a
cryptographically signed C2PA manifest (c2pa-python). Both layers are
"honest limitations" per weave-in's own precedent: neither survives a
screenshot or most social-platform re-encoding, and Phase-1 certs are
self-signed (untrusted signer on public platforms, valid signature).

Usage:
  python3 scripts/make-canonical-portrait.py --slug bonsai --source raw/bonsai-photo.jpg \\
      --name "Bonsai" --org "Bonsai Garden"

  # Preview only, nothing written:
  python3 scripts/make-canonical-portrait.py --slug bonsai --source photo.jpg \\
      --name "Bonsai" --dry-run

  # AI-generated source, EXIF layer only (no cert needed yet):
  python3 scripts/make-canonical-portrait.py --slug newkin --source render.png \\
      --name "New Kin" --ai-generated --quick
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import portrait_lib as lib

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install --upgrade Pillow")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--slug", required=True, help="agent slug, e.g. bonsai")
    ap.add_argument(
        "--source", required=True, type=Path, help="source jpeg/png — gardener-provided or generated on their behalf"
    )
    ap.add_argument("--name", required=True, help="display / copyright name, e.g. \"Bonsai\"")
    ap.add_argument("--org", default="Bonsai Garden", help="organization name for the cert + copyright line")
    ap.add_argument("--email", default=None, help="optional contact email for the cert")
    ap.add_argument("--url", default=None, help="optional canonical URL for the agent")
    ap.add_argument("--size", type=int, default=512, help="canonical portrait size, square (default 512)")
    ap.add_argument(
        "--repo-root",
        type=Path,
        default=Path.cwd(),
        help="repo root (default: current directory — run this from repo root)",
    )
    ap.add_argument(
        "--out", type=Path, default=None, help="output path (default: <repo-root>/agents/<slug>/assets/portrait.png)"
    )
    ap.add_argument(
        "--skill-root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="bonsai-garden-portrait skill directory (default: this script's own skill folder) "
        "— identity/<slug>/ lives here",
    )
    ap.add_argument(
        "--ai-generated", action="store_true", help="mark digitalSourceType as AI-generated rather than a real capture"
    )
    ap.add_argument(
        "--digital-source-type",
        default=None,
        choices=list(lib.DIGITAL_SOURCE_TYPES),
        help="override the C2PA digital source type (default: capture, or ai if --ai-generated)",
    )
    ap.add_argument("--quick", action="store_true", help="EXIF layer only — skip C2PA (no cert needed)")
    ap.add_argument("--no-weave", action="store_true", help="canonical portrait only — skip both metadata layers")
    ap.add_argument(
        "--force-new-cert", action="store_true", help="regenerate the agent's cert chain even if one already exists"
    )
    ap.add_argument("--dry-run", action="store_true", help="show what would happen; write nothing")
    args = ap.parse_args()

    if not args.source.is_file():
        sys.exit(f"✗ source not found: {args.source}")

    out_path = args.out or (args.repo_root / "agents" / args.slug / "assets" / "portrait.png")
    dst = lib.DIGITAL_SOURCE_TYPES[args.digital_source_type or ("ai" if args.ai_generated else "capture")]

    print(f"→ {args.slug}: {args.source} → {out_path}")
    im = Image.open(args.source)
    orig_size = im.size
    canonical = lib.square_crop_resize(im, args.size)
    print(f"  {orig_size[0]}x{orig_size[1]} → center-cropped square → {args.size}x{args.size}")

    if args.dry_run:
        print(
            "  [dry-run] would write canonical portrait"
            + ("" if args.no_weave else " + EXIF layer" + ("" if args.quick else " + C2PA layer"))
        )
        return 0

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canonical.save(out_path, "PNG", optimize=True)
    print(f"  ✓ canonical portrait written ({out_path.stat().st_size} bytes)")

    if args.no_weave:
        return 0

    # Layer 1 — EXIF
    exiftool_ver = lib.check_exiftool()
    if not exiftool_ver:
        print("  ✗ exiftool not found — EXIF layer skipped. Install: see SKILL.md prerequisites.")
    else:
        n = lib.write_exif_layer(out_path, copyright_name=args.name, url=args.url)
        print(f"  ✓ EXIF layer: {n} fields written (exiftool {exiftool_ver})")

    if args.quick:
        return 0

    # Layer 2 — C2PA
    c2pa_ver = lib.check_c2pa()
    if not c2pa_ver:
        if sys.version_info < (3, 10):
            print(
                f"  ✗ C2PA layer skipped: c2pa-python needs Python 3.10 or newer (this is {sys.version_info.major}.{sys.version_info.minor}). "
                "The portrait is still made, with its EXIF authorship and no signed manifest."
            )
        else:
            print("  ✗ c2pa-python not available — C2PA layer skipped. Install: pip install c2pa-python cryptography")
        return 0

    identity_dir = args.skill_root / "identity" / args.slug
    chain_path, key_path = lib.ensure_identity(
        identity_dir,
        args.slug,
        cn=args.name,
        org=args.org,
        email=args.email,
        force=args.force_new_cert,
    )
    print(f"  ✓ identity: {chain_path.parent} ({'generated' if args.force_new_cert else 'ready'})")

    manifest = lib.build_manifest(
        title=f"{args.name} — canonical portrait",
        copyright_name=args.name,
        org=args.org,
        url=args.url,
        digital_source_type=dst,
        agent_slug=args.slug,
    )
    validation_status = lib.sign_c2pa(out_path, chain_pem_path=chain_path, key_path=key_path, manifest=manifest)

    real_problems = [v for v in validation_status if v.get("code") != "signingCredential.untrusted"]
    print("  ✓ C2PA layer: manifest signed (PS256, self-signed root CA)")
    print(f"    └─ digitalSourceType: {dst.rsplit('/', 1)[-1]}")
    if not validation_status:
        print("    └─ validation: clean (no findings at all — unexpected for a self-signed chain, but good)")
    elif not real_problems:
        print("    └─ validation: signingCredential.untrusted only (expected — self-signed Phase-1 chain)")
    else:
        print("    └─ ⚠ validation found real problems, not just the expected untrusted-signer note:")
        for v in real_problems:
            print(f"       - {v.get('code')}: {v.get('explanation')}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
