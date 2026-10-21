#!/usr/bin/env python3
# ---
# id: 01M5CZKM3JBAZ1D2A76Y494AB4
# title: test-without-pillow.py — the greeting thumb on a host with no Pillow: sips on macOS, else a plain message naming what is missing
# type: script
# tended-by: baisai
# created: 2026-10-20
# updated: 2026-10-20
# ---
"""test-without-pillow.py: T-10 of the kobun walk (2026-10-20). The gardener's work Mac had no Pillow; the portrait
tool stopped, and the walk made its one resize by hand with macOS's own `sips`. A planting host is a stranger's
machine, so the tool says what it can do there.

Pillow is hidden from the script under test by a shim on PYTHONPATH (a `PIL` package that raises ImportError), never
uninstalled; `BONSAI_SIPS` points the script at no sips to stand for a host without one. The fixture portrait is a
PNG this file writes itself, byte by byte (no Pillow needed to make it).

    python3 skills/bonsai-garden-portrait/scripts/test-without-pillow.py
"""

import base64
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
THUMBS = HERE / "make-portrait-thumbs.py"
SIPS = shutil.which("sips") or ("/usr/bin/sips" if Path("/usr/bin/sips").is_file() else None)
ok_all = True


def check(name, ok, detail=""):
    global ok_all
    ok_all &= bool(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def png(path: Path, size: int = 512) -> None:
    """A square RGB PNG: a blue field with a red square, written without any imaging library."""
    rows = b""
    for y in range(size):
        row = bytearray(b"\x00")
        for x in range(size):
            row += b"\xe6\x14\x14" if 180 <= x < 300 and 140 <= y < 260 else b"\x14\x28\xc8"
        rows += bytes(row)

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    head = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", head) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")
    )


work = Path(tempfile.mkdtemp(prefix="portrait-no-pillow-", dir=os.environ.get("KEYS_TEST_TMP")))
shim = work / "shim" / "PIL"
shim.mkdir(parents=True)
(shim / "__init__.py").write_text('raise ImportError("Pillow is hidden from this run by test-without-pillow.py")\n')
garden = work / "garden"
(garden / "agents" / "testkin" / "assets").mkdir(parents=True)
png(garden / "agents" / "testkin" / "assets" / "portrait.png")


def thumbs(*args, sips=None):
    env = {**os.environ, "PYTHONPATH": str(work / "shim")}
    env.pop("PYTHONHOME", None)
    if sips is not None:
        env["BONSAI_SIPS"] = sips
    r = subprocess.run(
        [sys.executable, str(THUMBS), "--repo-root", str(garden), "--agent", "testkin", *args],
        capture_output=True,
        text=True,
        env=env,
    )
    return r.returncode, r.stdout + r.stderr


assets = garden / "agents" / "testkin" / "assets"

# 1. the shim holds: the script really cannot import Pillow in these runs
r = subprocess.run(
    [sys.executable, "-c", "import PIL"],
    capture_output=True,
    text=True,
    env={**os.environ, "PYTHONPATH": str(work / "shim")},
)
check("the shim hides Pillow", r.returncode != 0 and "hidden" in r.stderr, r.stderr.strip().splitlines()[-1][:100])

# 2. no Pillow, no sips: a plain message that names Pillow and how to get it, nothing written
code, out = thumbs("--format", "jpeg", "--quality", "40", "--apply", sips=str(work / "no-sips-here"))
check(
    "no Pillow and no sips: refused, naming Pillow and the line that installs it, nothing written",
    code != 0
    and "Pillow" in out
    and "pip install" in out
    and "sips" in out
    and not (assets / "portrait-thumb.b64").exists(),
    out.strip().splitlines()[-1][:160] if out.strip() else f"exit {code}",
)

if not SIPS:
    print("  [SKIP] the sips cases: this host has no sips (macOS only)")
else:
    # 3. no Pillow, sips, the default format (webp, which sips does not write): a message that says what will work
    code, out = thumbs("--apply", sips=SIPS)
    check(
        "no Pillow, sips, --format webp: refused, saying sips writes jpeg and naming Pillow for webp",
        code != 0 and "--format jpeg" in out and "Pillow" in out and not (assets / "portrait-thumb.b64").exists(),
        out.strip().splitlines()[-1][:160] if out.strip() else f"exit {code}",
    )

    # 4. no Pillow, sips, jpeg: the thumb and its .meta, the right size, every metadata block gone
    code, out = thumbs("--format", "jpeg", "--quality", "40", "--apply", sips=SIPS)
    b64 = (assets / "portrait-thumb.b64").read_text().strip() if (assets / "portrait-thumb.b64").exists() else ""
    meta = (
        json.loads((assets / "portrait-thumb.b64.meta").read_text())
        if (assets / "portrait-thumb.b64.meta").exists()
        else {}
    )
    data = base64.b64decode(b64) if b64 else b""
    jpg = work / "thumb.jpg"
    jpg.write_bytes(data)
    dims = subprocess.run(
        [SIPS, "-g", "pixelWidth", "-g", "pixelHeight", str(jpg)], capture_output=True, text=True
    ).stdout
    clean = (
        data[:2] == b"\xff\xd8"
        and b"\xff\xe1" not in data[:4096]
        and b"\xff\xed" not in data[:4096]
        and b"8BIM" not in data
        and b"<x:xmpmeta" not in data
        and b"Exif" not in data[:4096]
    )
    check(
        "no Pillow, sips, jpeg: the thumb is written, 144 x 144, its .meta true to its bytes, and no metadata left in it",
        code == 0
        and "pixelWidth: 144" in dims
        and "pixelHeight: 144" in dims
        and meta.get("format") == "jpeg"
        and meta.get("bytes") == len(data)
        and meta.get("b64_chars") == len(b64)
        and meta.get("encoder") == "sips"
        and meta.get("source_px") == [512, 512]
        and clean,
        f"exit {code}; {len(data)} bytes; meta {meta.get('format')} {meta.get('encoder')} {meta.get('source_px')}; clean {clean}",
    )

    # 5. the ceiling still holds on the fallback: sips writes larger JPEGs, so q75 at 144 px must read as too large or pass,
    #    never be written silently over the line
    code, out = thumbs("--format", "jpeg", "--size", "512", "--quality", "95", sips=SIPS)
    check(
        "the transcription ceiling still guards the fallback (a 512 px q95 dry run reads TOO LARGE)",
        code == 2 and "TOO LARGE" in out,
        f"exit {code}",
    )

print("\n" + ("all passed" if ok_all else "FAILED") + f"   (scratch: {work})")
sys.exit(0 if ok_all else 1)
