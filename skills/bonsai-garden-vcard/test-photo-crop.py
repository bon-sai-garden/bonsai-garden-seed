#!/usr/bin/env python3
# ---
# id: 01M4P6WRZM4NJ3HCRQB1A2ESDX
# title: The vCard photo is a square the card's owner chose, not whatever the portrait's composition leaves in a circle
# type: script
# tended-by: baisai
# created: 2026-10-11
# updated: 2026-10-12
# ---
"""test-photo-crop.py: a rehearsal gardener's ask (2026-10-11): a kin's card photo "does not render properly". The embedded
photo was the full-figure portrait (the figure left of centre, five panes to its right); Contacts shows a card photo in a circle,
so the face came out small and off-centre. The structure was valid (CRLF, 75-octet folds, valid base64): the bug was the picture.

A card's photo is chosen for the card: `--photo-crop CX,CY,SIZE` (fractions of the portrait: the centre, and the side of the
square as a share of the shorter side) cuts a square from the portrait and resizes it to 256x256 for the card only; an
`assets/portrait-avatar.jpg` is preferred over the thumbnail when the kin carries one; with neither, nothing changes.

    python3 skills/bonsai-garden-vcard/test-photo-crop.py
"""

import base64
import io
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

SCRIPT = Path(__file__).resolve().parent / "scripts" / "build-agent-vcard.py"
ok_all = True


def check(name, ok, detail=""):
    global ok_all
    ok_all &= bool(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


work = Path(tempfile.mkdtemp(prefix="vcard-crop-"))
(work / "agents/testkin/assets").mkdir(parents=True)
(work / "agents/testkin/references").mkdir()
(work / "agents/testkin/references/about-me.md").write_text("---\nname: Testkin\nkanji: 試験\n---\n# Testkin\n")
png = work / "p.png"
im = Image.new("RGB", (1000, 1000), (20, 40, 200))
ImageDraw.Draw(im).rectangle(
    [360, 320, 460, 420], fill=(230, 20, 20)
)  # the "face", left of centre and high, as in the portrait that raised it
im.save(png)


def card(*extra, portrait=png, out="out.vcf"):
    r = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--about-me",
            str(work / "agents/testkin/references/about-me.md"),
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
    )
    return r


def photo(out="out.vcf"):
    t = (work / out).read_bytes().decode("latin1").replace("\r\n ", "")
    m = re.search(r"PHOTO;[^:]*:([A-Za-z0-9+/=]+)", t)
    return Image.open(io.BytesIO(base64.b64decode(m.group(1)))) if m else None


r = card()
p = photo()
check(
    "without a crop the card is as it was: the whole portrait, the 'face' is not at the centre",
    r.returncode == 0 and p is not None and p.getpixel((p.width // 2, p.height // 2))[2] > 150,
    f"exit {r.returncode}, centre {p.getpixel((p.width // 2, p.height // 2)) if p else None}",
)
r = card("--photo-crop", "0.41,0.37,0.3")
p = photo()
check(
    "--photo-crop cuts a 256x256 square centred where the caller said: the 'face' is at the centre",
    r.returncode == 0
    and p is not None
    and p.size == (256, 256)
    and p.getpixel((128, 128))[0] > 150
    and p.getpixel((128, 128))[2] < 100,
    f"exit {r.returncode}, size {p.size if p else None}, centre {p.getpixel((128, 128)) if p else None}, {r.stderr.strip()[:80]}",
)
t = (work / "out.vcf").read_bytes()
lines = t.split(b"\r\n")
check(
    "and the card keeps its shape: CRLF, folds within 75 octets, base64 that decodes",
    b"\r\n" in t and all(len(line) <= 75 for line in lines) and photo() is not None,
    f"longest line {max(len(line) for line in lines)}",
)
for bad, why in [
    ("0.1,0.5,0.4", "a box that leaves the image on the left"),
    ("0.5,0.5,0", "a zero side"),
    ("0.5,0.5,1.5", "a side larger than the image"),
    ("x,y,z", "not numbers"),
    ("0.5,0.5", "two numbers"),
]:
    r = card("--photo-crop", bad, out="bad.vcf")
    check(
        f"--photo-crop {bad} ({why}) is refused, writing nothing",
        r.returncode == 2
        and not (work / "bad.vcf").exists()
        and "unrecognized" not in r.stderr
        and "photo-crop" in r.stderr,
        f"exit {r.returncode}: {r.stderr.strip().splitlines()[-1][:110] if r.stderr.strip() else ''}",
    )
av = work / "agents/testkin/assets/portrait-avatar.jpg"
th = work / "agents/testkin/assets/portrait-thumb.jpg"
Image.new("RGB", (64, 64), (0, 200, 0)).save(av)
Image.new("RGB", (64, 64), (200, 0, 200)).save(th)
r = subprocess.run(
    [sys.executable, str(SCRIPT), "--agent-dir", str(work / "agents/testkin"), "--output", str(work / "av.vcf")],
    capture_output=True,
    text=True,
)
p = photo("av.vcf")
check(
    "a kin's assets/portrait-avatar.jpg is the card's photo, preferred over the thumbnail",
    r.returncode == 0 and p is not None and p.getpixel((32, 32))[1] > 150 and p.getpixel((32, 32))[0] < 100,
    f"exit {r.returncode}, centre {p.getpixel((32, 32)) if p else None} {r.stderr.strip()[:80]}",
)
av.unlink()
r = subprocess.run(
    [sys.executable, str(SCRIPT), "--agent-dir", str(work / "agents/testkin"), "--output", str(work / "th.vcf")],
    capture_output=True,
    text=True,
)
p = photo("th.vcf")
check(
    "without an avatar the thumbnail is used, as before",
    r.returncode == 0 and p is not None and p.getpixel((32, 32))[0] > 150 and p.getpixel((32, 32))[1] < 100,
    f"exit {r.returncode}",
)
print("\nall hold" if ok_all else "\nFAIL")
sys.exit(0 if ok_all else 1)
