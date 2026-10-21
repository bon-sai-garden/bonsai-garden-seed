#!/usr/bin/env python3
# ---
# id: 01M5CZKM3JBAZ1D2A76Y494AB5
# title: test-without-pillow.py — a kin's vCard on a host with no Pillow: its photo by sips on macOS, else a plain message naming what is missing
# type: script
# tended-by: baisai
# created: 2026-10-20
# updated: 2026-10-20
# ---
"""test-without-pillow.py: T-10 of the kobun walk (2026-10-20). The gardener's work Mac had no Pillow, and a card whose
portrait is a PNG, or whose photo is cut with --photo-crop, needs one image step. On macOS, sips takes it; elsewhere
the card says plainly what is missing and is written without a photo.

Pillow is hidden from the script under test by a shim on PYTHONPATH (a `PIL` package that raises ImportError), never
uninstalled; `BONSAI_SIPS` points the script at no sips to stand for a host without one. The portrait is a PNG this
file writes byte by byte.

    python3 skills/bonsai-garden-vcard/test-without-pillow.py
"""

import base64
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "scripts" / "build-agent-vcard.py"
SIPS = shutil.which("sips") or ("/usr/bin/sips" if Path("/usr/bin/sips").is_file() else None)
ok_all = True


def check(name, ok, detail=""):
    global ok_all
    ok_all &= bool(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def png(path: Path, w: int = 600, h: int = 400) -> None:
    """An RGB PNG, wider than tall: a blue field with a red square, written without any imaging library."""
    rows = b""
    for y in range(h):
        row = bytearray(b"\x00")
        for x in range(w):
            row += b"\xe6\x14\x14" if 200 <= x < 300 and 100 <= y < 200 else b"\x14\x28\xc8"
        rows += bytes(row)

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows))
        + chunk(b"IEND", b"")
    )


work = Path(tempfile.mkdtemp(prefix="vcard-no-pillow-", dir=os.environ.get("KEYS_TEST_TMP")))
shim = work / "shim" / "PIL"
shim.mkdir(parents=True)
(shim / "__init__.py").write_text('raise ImportError("Pillow is hidden from this run by test-without-pillow.py")\n')
kin = work / "agents" / "testkin"
(kin / "references").mkdir(parents=True)
(kin / "assets").mkdir()
(kin / "references" / "about-me.md").write_text("---\nname: Testkin\nkanji: 試験\n---\n# Testkin\n")
portrait = work / "portrait.png"
png(portrait)


def card(*extra, sips=None, out="out.vcf"):
    env = {**os.environ, "PYTHONPATH": str(work / "shim")}
    env.pop("PYTHONHOME", None)
    if sips is not None:
        env["BONSAI_SIPS"] = sips
    r = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--about-me",
            str(kin / "references" / "about-me.md"),
            "--slug",
            "testkin",
            "--portrait",
            str(portrait),
            "--output",
            str(work / out),
            *extra,
        ],
        capture_output=True,
        text=True,
        env=env,
    )
    text = (
        (work / out).read_bytes().decode("utf-8") if (work / out).exists() else ""
    )  # CRLF kept: a fold is CRLF + space
    unfolded = text.replace("\r\n ", "")
    photo = next((ln.split(":", 1)[1] for ln in unfolded.split("\r\n") if ln.startswith("PHOTO")), "")
    return r.returncode, r.stdout + r.stderr, base64.b64decode(photo) if photo else b""


def size_of(jpeg: bytes) -> str:
    f = work / "photo.jpg"
    f.write_bytes(jpeg)
    return subprocess.run(
        [SIPS, "-g", "pixelWidth", "-g", "pixelHeight", str(f)], capture_output=True, text=True
    ).stdout


def centre_rgb(jpeg: bytes):
    """The centre pixel, read through sips as an uncompressed BMP (no imaging library in this test)."""
    f, b = work / "c.jpg", work / "c.bmp"
    f.write_bytes(jpeg)
    subprocess.run([SIPS, "-s", "format", "bmp", str(f), "--out", str(b)], capture_output=True)
    d = b.read_bytes()
    off, w, h, bpp = (
        struct.unpack_from("<I", d, 10)[0],
        *struct.unpack_from("<iiHH", d, 18)[:2],
        struct.unpack_from("<H", d, 28)[0],
    )
    row = (w * bpp // 8 + 3) // 4 * 4
    y = abs(h) // 2 if h < 0 else abs(h) - 1 - abs(h) // 2
    px = d[off + y * row + (w // 2) * (bpp // 8) : off + y * row + (w // 2) * (bpp // 8) + 3]
    return (px[2], px[1], px[0])


def no_meta(b: bytes) -> bool:
    return b[:2] == b"\xff\xd8" and b"\xff\xe1" not in b[:4096] and b"8BIM" not in b and b"Exif" not in b[:4096]


r = subprocess.run(
    [sys.executable, "-c", "import PIL"],
    capture_output=True,
    text=True,
    env={**os.environ, "PYTHONPATH": str(work / "shim")},
)
check("the shim hides Pillow", r.returncode != 0 and "hidden" in r.stderr)

code, out, photo = card(sips=str(work / "no-sips-here"), out="a.vcf")
check(
    "no Pillow, no sips, a PNG portrait: the card is written without a photo, and says Pillow, sips and a JPEG are the ways",
    code == 0 and not photo and "Pillow" in out and "sips" in out and "portrait-thumb.jpg" in out,
    [ln for ln in out.splitlines() if "SKIPPED" in ln][:1],
)
code, out, photo = card("--photo-crop", "0.42,0.38,0.5", sips=str(work / "no-sips-here"), out="b.vcf")
check(
    "no Pillow, no sips, --photo-crop: written without a photo, naming Pillow and sips",
    code == 0 and not photo and "Pillow" in out and "sips" in out,
    [ln for ln in out.splitlines() if "SKIPPED" in ln][:1],
)

if not SIPS:
    print("  [SKIP] the sips cases: this host has no sips (macOS only)")
else:
    code, out, photo = card(sips=SIPS, out="c.vcf")
    dims = size_of(photo) if photo else ""
    check(
        "no Pillow, sips, a PNG portrait: the photo is the portrait as a JPEG, its metadata cut",
        code == 0 and photo and no_meta(photo) and "pixelWidth: 600" in dims and "pixelHeight: 400" in dims,
        f"exit {code}; {len(photo)} bytes; {' '.join(dims.split()[1:])}",
    )
    code, out, photo = card("--photo-crop", "0.42,0.38,0.5", sips=SIPS, out="d.vcf")
    dims = size_of(photo) if photo else ""
    centre = centre_rgb(photo) if photo else None
    check(
        "no Pillow, sips, --photo-crop: the photo is the named square, 256 x 256, the red square at its centre, no metadata",
        code == 0
        and photo
        and no_meta(photo)
        and "pixelWidth: 256" in dims
        and "pixelHeight: 256" in dims
        and centre
        and centre[0] > 180
        and centre[2] < 90,
        f"exit {code}; {len(photo)} bytes; {' '.join(dims.split()[1:])}; centre {centre}",
    )

print("\n" + ("all passed" if ok_all else "FAILED") + f"   (scratch: {work})")
sys.exit(0 if ok_all else 1)
