#!/opt/homebrew/bin/python3.11
# ---
# id: 01M4DMWQQGVZC6CT23GJQK44WX
# ---
"""The three concept pieces (bon, soil, sai): from the renders to core's woven images (Eisai, 2026-10-08).

The gardener, 2026-10-08: "store them and rename them, weave them properly. and add to core in images folder or the
like." The renders arrive as transparent PNG; their alpha is kept exactly. A render that came on white instead (no
alpha, or an alpha that is all opaque) has the white turned into transparency, since the site is dark first:

  1. background  the near-white that touches the image's edge is the background (a flood from the border, so white
                 inside an object stays); it becomes fully transparent.
  2. the seam    a narrow band where object meets background is "unmixed" from white (colour-to-alpha), so soft edges
                 and glows (sai's light) keep their softness on any ground instead of a white fringe. The object's
                 inside is untouched and stays fully opaque.
  3. size        the longer side at most --size px (default 1024).
  4. weave       the two layers core's portrait skill writes (skills/bonsai-garden-portrait/scripts/portrait_lib.py):
                 EXIF authorship (exiftool) and a signed C2PA manifest, marked as AI-generated
                 (trainedAlgorithmicMedia), authored "Bonsai Garden", woven by the given agent's identity.

  build-concept-images.py --bon <file> --soil <file> --sai <file> [--agent eisai] [--size 1024]
  build-concept-images.py ... --out <dir> --size 720 --palette     a lighter woven copy for a web page
  build-concept-images.py --verify [--out <dir>]                   read each image's C2PA manifest back

Provenance of the pieces in xp/images/concept/ (approved by the gardener, 2026-10-08): generated with Codex's built-in
image_gen in the skill-illustrate workshop, in the garden's voxel style, as transparent PNG. Without the kanji overlay
(the gardener, 2026-10-08: "pick the images without the kanji overlay"): the sources are that workshop's raw renders
bonsai-pot-rounded-bon-kanji-raw, bonsai-soil-rounded-soil-kanji-raw (both from before the 盆 and 土 were set) and
bonsai-agent-clean-humanoid-bonsai-voxel-transparent (candidates/2026-10-08-bonsai-pot-soil-agent-voxel), each cropped
to its piece.
The public site's copies (720 px, palette, no embedded thumbnail, ~110 KB) are made by the same run with --out,
--size 720 and --palette, and are woven the same way.

Writes concept/{bon,soil,sai}.png beside itself (core's xp/images/ since 2026-10-18, off the top level). Needs Pillow, numpy, c2pa-python, cryptography (requirements.txt; Python 3.11
here) and exiftool (CREDITS.md names each). Fails on a missing tool rather than writing an unwoven image.
"""

import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
# core's root by marker, never by counting levels: this script moved from images/ to xp/images/ on 2026-10-18
CORE = next((d for d in HERE.parents if (d / "skills" / "bonsai-garden-portrait").is_dir()), None)
if CORE is None:
    sys.exit("build-concept-images: core's portrait skill is not above this script; refusing")
OUT = HERE / "concept"
SKILL = CORE / "skills" / "bonsai-garden-portrait"
sys.path.insert(0, str(SKILL / "scripts"))
import portrait_lib as lib  # noqa: E402 — the portrait skill's scripts/ goes on sys.path one line above; the import must follow it

TITLES = {"bon": "bon, the pot", "soil": "soil", "sai": "sai, the agentic team mate"}


def to_transparent(src: Path, size: int):
    import numpy as np
    from PIL import Image, ImageFilter

    src_im = Image.open(src)
    if src_im.mode in ("RGBA", "LA", "PA") or "transparency" in src_im.info:
        # the renders arrive as transparent PNG (the gardener, 2026-10-08): keep their alpha exactly, crop and size
        img = src_im.convert("RGBA")
        lo = int((np.asarray(img)[..., 3] == 0).mean() * 1000) / 10
        if lo > 1:
            bbox = img.getchannel("A").point(lambda v: 255 if v > 2 else 0).getbbox()
            if bbox:
                left, top, right, bottom = bbox
                img = img.crop(
                    (max(0, left - 12), max(0, top - 12), min(img.width, right + 12), min(img.height, bottom + 12))
                )
            img.thumbnail((size, size), Image.LANCZOS)
            return img, lo, 0
        # an alpha channel that is fully opaque is no transparency: fall through to the white
    im = src_im.convert("RGB")
    a = np.asarray(im).astype(np.float32)
    h, w, _ = a.shape
    # near-white, low-chroma pixels are background candidates
    mn, mx = a.min(axis=2), a.max(axis=2)
    cand = (mn > 232) & ((mx - mn) < 22)
    # flood from the border: background is the near-white connected to the edge (white inside an object stays)
    bg = np.zeros((h, w), bool)
    stack = [(y, x) for x in range(w) for y in (0, h - 1) if cand[y, x]] + [
        (y, x) for y in range(h) for x in (0, w - 1) if cand[y, x]
    ]
    while stack:
        y, x = stack.pop()
        if bg[y, x] or not cand[y, x]:
            continue
        bg[y, x] = True
        if y > 0:
            stack.append((y - 1, x))
        if y < h - 1:
            stack.append((y + 1, x))
        if x > 0:
            stack.append((y, x - 1))
        if x < w - 1:
            stack.append((y, x + 1))
    # the seam: a band of a few pixels around the background, unmixed from white
    bgimg = Image.fromarray((bg * 255).astype("uint8"))
    band = np.asarray(bgimg.filter(ImageFilter.MaxFilter(13))) > 0
    band &= ~bg
    alpha = np.ones((h, w), np.float32)
    alpha[bg] = 0.0
    seam = a[band]
    sa = ((255.0 - seam).max(axis=1) / 255.0).clip(0, 1)
    safe = np.where(sa > 1e-3, sa, 1.0)[:, None]
    unmixed = ((seam - 255.0 * (1.0 - sa)[:, None]) / safe).clip(0, 255)
    rgb = a.copy()
    rgb[band] = unmixed
    alpha[band] = sa
    out = np.dstack([rgb, alpha * 255.0]).round().astype("uint8")
    img = Image.fromarray(out, "RGBA")
    bbox = img.getbbox()
    if bbox:
        pad = 12
        left, top, right, bottom = bbox
        img = img.crop((max(0, left - pad), max(0, top - pad), min(w, right + pad), min(h, bottom + pad)))
    img.thumbnail((size, size), Image.LANCZOS)
    return img, round(float(bg.mean()) * 100, 1), int(band.sum())


def main():
    try:
        import numpy  # noqa: F401 — to_transparent's arithmetic; checked here so a missing one is said before any work
        from PIL import Image
    except ImportError as e:  # one plain line, never a traceback (Python 3.11 or later: requirements.txt's floor)
        print(
            f"SETUP  {'Pillow' if e.name == 'PIL' else e.name} is not installed: this script needs Pillow and numpy from core's "
            "requirements.txt (Python 3.11 or later; python3 tools/setup-core.py --install); nothing written"
        )
        return 2

    ap = argparse.ArgumentParser()
    for k in TITLES:
        ap.add_argument("--" + k, type=Path)
    ap.add_argument("--agent", default="eisai")
    ap.add_argument("--size", type=int, default=1024)
    ap.add_argument(
        "--out", type=Path, default=OUT, help="where the woven images go (default concept/ beside this script)"
    )
    ap.add_argument(
        "--palette", action="store_true", help="web copy: a 256-colour palette with alpha, woven the same way"
    )
    ap.add_argument("--verify", action="store_true")
    a = ap.parse_args()
    if a.verify:
        import c2pa

        bad = 0
        for k in TITLES:
            p = a.out / (k + ".png")
            try:
                with c2pa.Reader(str(p)) as r:
                    m = r.json()
                print(f"ok    {p}  (C2PA manifest present, {len(m)} bytes of JSON)")
            except Exception as e:
                bad = 1
                print(f"FAIL  {p}  {e}")
        return bad
    if not all(getattr(a, k) for k in TITLES):
        ap.error("give --bon, --soil and --sai")
    if not lib.check_exiftool() or not lib.check_c2pa():
        print("SETUP  exiftool and c2pa-python are both needed: no unwoven image is written")
        return 2
    a.out.mkdir(parents=True, exist_ok=True)
    if a.palette:
        # the signer embeds a preview thumbnail by default, larger than a web copy itself; the manifest and its
        # signature do not need it
        import c2pa

        c2pa.load_settings({"builder": {"thumbnail": {"enabled": False}}})
    chain, key = lib.ensure_identity(SKILL / "identity" / a.agent, a.agent, cn="Bonsai Garden", org="Bonsai Garden")
    for k, title in TITLES.items():
        img, bgpct, seam = to_transparent(getattr(a, k), a.size)
        out = a.out / (k + ".png")
        if a.palette:
            # voxel art holds its look in 256 colours; the weave below is applied to these exact bytes
            img = img.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        img.save(out, optimize=True)
        out.chmod(0o644)
        n = lib.write_exif_layer(out, copyright_name="Bonsai Garden", url="https://bon-sai.garden")
        man = lib.build_manifest(
            title=title,
            copyright_name="Bonsai Garden",
            org="Bonsai Garden",
            url="https://bon-sai.garden",
            digital_source_type=lib.DIGITAL_SOURCE_TYPES["ai"],
            agent_slug=a.agent,
        )
        lib.sign_c2pa(out, chain_pem_path=chain, key_path=key, manifest=man)
        out.chmod(0o644)
        print(f"wrote {out}  {img.width}x{img.height}  background {bgpct:.1f}%  seam {seam} px  exif {n}  c2pa signed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
