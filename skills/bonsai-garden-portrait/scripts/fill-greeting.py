#!/usr/bin/env python3
# ---
# id: 01M393VCEVTNEJYAAFR7PGDBQW
# title: Fill the shared greeting from files, never by hand
# type: script
# tended-by: tasai
# created: 2026-09-24
# updated: 2026-10-21
# ---
"""fill-greeting.py — render templates/greeting-v6-compact.html for one kin, every value from a file or a flag.

The face is a link, never base64 (the gardener, 2026-10-21: "now that we are public I would like to bring back
the visual intro"). The link comes from the garden's agents/faces.json, the first root that has one: a `base`
pinned to a full commit or a release tag (never a branch: a CDN caches a branch for days, a commit cannot change
under us) and a `file` pattern with {slug}. No faces.json anywhere: the card carries no face, and the kin's
kanji seal stands in the circle. The seal sits under the face in every card, so a face that does not load
(the sandbox refuses the origin, a kin drawn after the pin) shows the seal, never a broken frame.
The fragment is written whole; the kin passes it to the widget tool as it is. Its size is printed.

Integrity is said only when it fails (the gardener, 2026-10-21: "We should only ever talk about integrity etc, when
it fails (fail loudly), never mention it when all is fine"). When the five checks pass and the MCP and the skill are
current, the compact card carries nothing about them: no dots, no ticks, no status chips. Otherwise one loud line
opens the card, in garden amber: each check that failed or could not run, with what it said (--said CHECK=TEXT,
the tool's own line, copied), and an MCP or skill that is not current. A check that could not run is never shown as
passed. The kin passes the states; nothing about them is written by hand.

A missing input REFUSES: one line naming what and where, exit 2, never a traceback, so the seat
falls back to the plain-text card and says why (AGENTS.md, Every kin; 2026-09-28).

The body is found by the registry's own `path`, in each root named by --garden (repeatable, in
order): the first root whose registry names the kin AND whose body holds a portrait
(assets/portrait-thumb.b64.meta) wins. Core does not read the runtime's router; the caller names
the roots, e.g. --garden <garden> --garden <core> (Bonsai's body is core's; Fuji-shin's is nested in
Baisai's). An installed package is a root too: --garden <the package> reads the kin's own row from
its identity/registry-entry.json (package.py writes it) and the body is the package itself, so a
kin with no garden on the host greets from the kit the package carries (scripts/greeting/).

Identity, mark, portrait and intro come from the garden's files; the kanji the fingerprint spells comes
from skills/bonsai-garden-mark/fp-kanji.py; the build, checks and env come from flags the kin filled
from what they loaded or ran THIS turn. Nothing is typed into the HTML. Any placeholder left → exit 1.

    python3 fill-greeting.py --garden <the garden root> --slug tasai \
      --subtitle "South · operations" --version 3.0.2 --build 3.0.2.1-20260923T0750Z \
      --integrity pass --identity fail --files missing --fullfp pass \
      --said "identity=<the check's own line>" --said "files=<why it could not run>" \
      --location "<city>, <country>" --tz Europe/Berlin --host <host> \
      --harness "local-agent-mode-bonsai-garden 1.0.0" --model "Opus 5.5" \
      --mcp "mcp 24526cf2 · current · http :5052" --skill "skill e8b5e0fe ≠ repo 02b420d6 · DRIFT" --skill-state warn \
      --permission auto --out greeting.html
"""

import argparse
import importlib.util
import json
import re
import sys
from html import escape as esc  # registry data going into attributes and text of a trust surface
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE.parent / "templates" / "greeting-v6-compact.html"  # the default since 2026-10-13
TEMPLATE_FULL = HERE.parent / "templates" / "greeting-v6.html"  # --full: the animated signature, ~4x the context
FPK = HERE.parents[1] / "bonsai-garden-mark" / "fp-kanji.py"


def fp_kanji(fp: str, n: int) -> str:
    spec = importlib.util.spec_from_file_location("fpk", FPK)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m.kanji(fp, n)


class Refused(Exception):
    pass


def need(path: Path, what: str, slug: str) -> Path:
    if not path.is_file():
        raise Refused(f"no {what} for {slug}: {path} missing")
    return path


PACKAGE_ROW = Path("identity") / "registry-entry.json"  # an installed package: its kin's own row, written by package.py
FACES = (Path("agents") / "faces.json", Path("identity") / "faces.json")  # a garden's pin; a package's copy of it
# A face is served by a CDN the widget sandbox lets through, pinned: @ a full commit or a release tag, never a branch.
FACE_BASE = re.compile(r"https://(cdn\.jsdelivr\.net|unpkg\.com)/[\w./-]+@([0-9a-f]{40}|v?\d+\.\d+\.\d+[\w.+-]*)/[\w./-]*")


CHECK_LABELS = {"integrity": "integrity", "identity": "identity", "files": "files", "alive": "alive", "fullfp": "full fingerprint"}
LOUD_AMBER = "#E0A04A"  # garden amber: the loud line's ground, with near-black words, in light and dark alike
# alive is the live handshake (spec-handshake-daemon-identity-proof, a draft of 2026-09-04, Mori-shin's), and it runs
# in no seat yet. Until it exists, alive is "not asked": a check that does not exist yet, not one that failed (Tasai,
# 2026-10-21; Mori-shin read it, no veto). Not asked is silent in both forms and never drawn as passed. Only alive may
# be not asked, and alive takes nothing else: nothing can produce its pass honestly (two cards drew "alive" passed on
# the caller's word, 2026-10-21). This is the one place that says so. When the handshake lands, alive goes back to the
# five in the same change: empty both sets below. The garden's tripwire for that day: its tools/test-alive-not-asked.py.
NOT_ASKED = "not-asked"
STATES = ("pass", "fail", "missing", NOT_ASKED)
MAY_BE_NOT_ASKED = {"alive"}
UNTIL_HANDSHAKE = {"alive"}  # the checks that take only NOT_ASKED until the handshake exists


def default_state(check: str) -> str:
    return NOT_ASKED if check in UNTIL_HANDSHAKE else "missing"


def check_states(states: dict) -> None:
    """Refuse a state the checks cannot honestly hold (ValueError, one line): not asked on a check that runs, and
    anything but not asked on a check that does not exist yet."""
    for k, v in states.items():
        if v == NOT_ASKED and k not in MAY_BE_NOT_ASKED:
            raise ValueError(f"--{k} {NOT_ASKED}: only {', '.join(sorted(MAY_BE_NOT_ASKED))} may be not asked; {k} runs")
        if k in UNTIL_HANDSHAKE and v != NOT_ASKED:
            raise ValueError(f"--{k} {v}: refused until the handshake exists; {k} is not asked yet (leave it out)")


def now_local(tz=None) -> str:
    """The clock as the card shows it, read here so no kin types a time: 2026-10-21 17:19 CEST."""
    from datetime import datetime
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    try:
        now = datetime.now(ZoneInfo(tz)) if tz else datetime.now().astimezone()
    except (ZoneInfoNotFoundError, ValueError, OSError) as e:
        raise Refused(f"no time zone {tz!r}") from e
    return now.strftime("%Y-%m-%d %H:%M ") + (now.strftime("%Z") or now.strftime("UTC%z"))


def parse_said(pairs: list) -> dict:
    """--said CHECK=TEXT, repeated, as {check: text}. A check name that is not one of the five is refused."""
    said = {}
    for p in pairs:
        name, sep, text = p.partition("=")
        if not sep or name not in CHECK_LABELS:
            raise ValueError(f"--said {p!r}: write CHECK=TEXT, CHECK one of {', '.join(CHECK_LABELS)}")
        said[name] = text.strip()
    return said


def loud_items(states: dict, said: dict, mcp: str = "", mcp_state: str = "ok", skill: str = "", skill_state: str = "ok"):
    """What the greeting must say out loud, in order; empty when all is fine. Shared with text-card.py (one master).

    A check is said when it failed or could not run ("missing": never shown as passed), with what it said. An MCP or
    a skill is said when its state is warn, or its own line reads STALE or DRIFT (as the env block prints them)."""
    items = []
    for k, label in CHECK_LABELS.items():
        state = states.get(k, default_state(k))
        if state not in ("pass", NOT_ASKED):  # not asked is silent: a check that does not exist yet
            items.append(f"{label} {'failed' if state == 'fail' else 'could not run'}" + (f": {said[k]}" if said.get(k) else ""))
    if mcp_state == "warn" or re.search(r"\bSTALE\b", mcp or ""):
        items.append(f"mcp: {mcp}")
    if skill_state == "warn" or re.search(r"\bDRIFT\b", skill or ""):
        items.append(f"skill: {skill}")
    return items


def find_face(gardens: list, slug: str):
    """(the face's URL or "", the file it came from or a note) — from the first root holding a faces file."""
    for g in gardens:
        for rel in FACES:
            fp = g / rel
            if not fp.is_file():
                continue
            try:
                faces = json.loads(fp.read_text(encoding="utf-8"))
                base, pattern = faces["base"], faces["file"]
            except (ValueError, KeyError, TypeError) as e:
                raise Refused(f"{fp} is unreadable: {e}") from e
            if not (isinstance(base, str) and FACE_BASE.fullmatch(base) and base.endswith("/")):
                raise Refused(f"face base in {fp} is not a pinned CDN path ending in '/' (a full commit or a tag): {base!r}")
            if not (isinstance(pattern, str) and "{slug}" in pattern and re.fullmatch(r"[\w{}.-]+", pattern)):
                raise Refused(f"face file pattern in {fp} must name {{slug}}: {pattern!r}")
            return base + pattern.replace("{slug}", slug), str(fp)
    return "", "no faces.json in " + ", ".join(str(g) for g in gardens) + "; the seal stands in"


def find_body(gardens: list, slug: str):
    """(registry entry, body dir) — the first root naming the kin whose body holds a portrait.

    A root may also be an INSTALLED PACKAGE (W, 2026-10-16): its agents/registry.json is the package marker, an
    empty roster on purpose, and the kin's own row travels at identity/registry-entry.json, written by package.py
    at build; the body is the package root itself. Read only when the root's registry does not name the kin, so a
    garden checkout is never shadowed by a row inside it."""
    tried, reg0 = [], None
    for g in gardens:
        rp = g / "agents" / "registry.json"
        if not rp.is_file():
            tried.append(f"{g} (no agents/registry.json)")
            continue
        try:
            agents = json.loads(rp.read_text(encoding="utf-8"))["agents"]
        except (ValueError, KeyError) as e:
            raise Refused(f"{rp} is unreadable: {e}") from e
        agents = agents if isinstance(agents, list) else list(agents.values())
        reg = next((x for x in agents if x.get("slug") == slug), None)
        body = None
        if reg:
            body = g / (reg.get("path") or f"agents/{slug}")
        elif (g / PACKAGE_ROW).is_file():
            try:
                rows = json.loads((g / PACKAGE_ROW).read_text(encoding="utf-8"))["agents"]
            except (ValueError, KeyError) as e:
                raise Refused(f"{g / PACKAGE_ROW} is unreadable: {e}") from e
            reg = next((x for x in rows if x.get("slug") == slug), None)
            if reg:
                body = g  # the package root is the body
            else:
                tried.append(f"{g} ({PACKAGE_ROW} does not name {slug})")
                continue
        else:
            tried.append(f"{g} (registry does not name {slug})")
            continue
        reg0 = reg0 or reg
        if (body / "assets" / "portrait-thumb.b64.meta").is_file():
            return reg, body
        tried.append(f"{body} (no assets/portrait-thumb.b64.meta)")
    if reg0 is None:
        raise Refused(f"{slug} is in no registry: " + "; ".join(tried))
    raise Refused(f"no portrait for {slug}: " + "; ".join(tried))


def main():
    ap = argparse.ArgumentParser()
    for a in (
        "slug",
        "subtitle",
        "version",
        "location",
        "host",
        "harness",
        "model",
        "mcp",
        "skill",
        "permission",
        "out",
    ):
        ap.add_argument("--" + a.replace("_", "-"), required=True)
    ap.add_argument("--garden", action="append", required=True, help="a garden root; repeat, in order")
    ap.add_argument("--at-local", default="", help="the time as shown; omitted, the machine's clock (never typed by hand)")
    ap.add_argument("--tz", help="an IANA zone for the clock; omitted, the machine's local zone")
    ap.add_argument("--build", default="")
    for a in ("integrity", "identity", "files", "alive", "fullfp"):
        ap.add_argument("--" + a, choices=STATES, default=default_state(a))
    ap.add_argument("--mcp-state", choices=("ok", "warn"), default="ok")
    ap.add_argument("--skill-state", choices=("ok", "warn"), default="ok")
    ap.add_argument(
        "--said",
        action="append",
        default=[],
        metavar="CHECK=TEXT",
        help="what a check that did not pass said, its own line; repeat per check (integrity, identity, files, alive, fullfp)",
    )
    ap.add_argument(
        "--full", action="store_true", help="the animated v6 card (about 12 KB) instead of the compact one (about 3 KB)"
    )
    a = ap.parse_args()

    reg, body = find_body([Path(x).expanduser() for x in a.garden], a.slug)
    assets = body / "assets"
    fp, kanji = reg.get("fingerprint"), reg.get("kanji")
    if not fp or not kanji:
        raise Refused(f"no fingerprint or kanji for {a.slug} in its registry entry")
    chars = list(reg.get("kanji-chars") or kanji)
    if "".join(chars) != kanji:
        raise Refused(f"kanji-chars {chars} do not spell kanji {kanji} for {a.slug}")
    # The fingerprint attests exactly the characters its vanity search forced, and no more
    # (Mori-shin, 2026-10-06). `fp-attests` names how many; absent, the whole name is owed, so
    # a long name without the field still fails rather than passing on a guessed prefix. Bits
    # past n were never chosen: they are not decoded, shown or compared.
    n = reg.get("fp-attests", len(chars))
    if not isinstance(n, int) or isinstance(n, bool) or not 2 <= n <= len(chars):
        raise Refused(f"fp-attests {n!r} for {a.slug} is not a whole number from 2 to {len(chars)}")
    attested, name_only = "".join(chars[:n]), "".join(chars[n:])
    owed = "fp-attests" not in reg and len(chars) > 2
    # A name longer than two characters with no `fp-attests` fails closed, and it must not decode past
    # the two characters every vanity search forces: the rest were never chosen, so they are never shown.
    spelled = fp_kanji(fp, 2) if owed else fp_kanji(fp, n)
    meta = json.loads(need(assets / "portrait-thumb.b64.meta", "portrait meta", a.slug).read_text())
    # base64 travels only in the animated --full card; the compact card links the face (find_face)
    thumb = need(assets / "portrait-thumb.b64", "portrait thumb", a.slug).read_text().strip() if a.full else ""
    intro_md = need(assets / "intro.md", "intro line", a.slug).read_text()
    intro = re.search(r'## The line\s*\n+>\s*"([^"]+)"', intro_md)
    if not intro:
        raise Refused(f"no intro line for {a.slug}: {assets / 'intro.md'} has no '## The line' quote")
    svg = need(assets / f"{a.slug}-mark.svg", "mark", a.slug).read_text()
    if "<svg" not in svg:
        raise Refused(f"no mark for {a.slug}: {assets / (a.slug + '-mark.svg')} holds no <svg>")
    svg = svg[svg.index("<svg") :]
    root_end = svg.index(">")
    root = re.sub(r'\s(width|height)="[^"]*"', "", svg[:root_end])
    svg = root.replace("<svg", '<svg width="32" height="32"', 1) + svg[root_end:]
    for k in ("bytes", "checksum_fnv1a32", "mime"):
        if k not in meta:
            raise Refused(f"no {k} in {assets / 'portrait-thumb.b64.meta'} for {a.slug}")

    checks = {"integrity": a.integrity, "identity": a.identity, "files": a.files, "alive": a.alive, "fullfp": a.fullfp}
    try:
        check_states(checks)  # the one place: alive alone not asked, and nothing else until the handshake exists
    except ValueError as e:
        raise Refused(str(e)) from e
    names = {
        "integrity": "SKILL.md is the sealed body",
        "identity": "sealing key published and known",
        "files": "every file matches the manifest",
        "alive": "live handshake",
        "fullfp": "full fingerprint compared",
    }
    of = f" of {kanji}" if name_only else ""
    if owed:
        state, title = (
            "failed",
            (
                f"the name has {len(chars)} characters and the registry does not say how many the "
                f"fingerprint attests (fp-attests); nothing past the first two is decoded"
            ),
        )
    elif spelled != attested:
        state, title = (
            "failed",
            f"fingerprint spells {spelled}, name begins {attested}{of}"
            if name_only
            else f"fingerprint spells {spelled}, name is {kanji}",
        )
    elif all(v == "pass" for v in checks.values()):
        # the extra phrase only where there is something to distinguish, so a two-character card is unchanged
        state, title = (
            "verified",
            "all checks passed; full fingerprint compared"
            + (f"; fingerprint attests {attested}{of}" if name_only else ""),
        )
    elif "fail" in checks.values():
        state = "failed"
        title = " · ".join(f"{names[k]}: {v}" for k, v in checks.items())
    else:
        state = "unchecked"
        title = " · ".join(f"{names[k]}: {v}" for k, v in checks.items())

    # The name-only characters sit on their own line under the fingerprint line, outside the verify link:
    # secondary ink at full strength (never the faint "strokes still owed" look, which means a check failed),
    # no tick, no link, and the word "name". Empty for a kin whose whole name the fingerprint spells.
    if name_only:
        tip = esc(f"{name_only}: part of the name, not spelled by the key", quote=True)
        name_only_row = (
            f'<span class="fp-name-only" title="{tip}" aria-label="{tip}" style="display:flex;align-items:baseline;gap:5px;">'
            f'<span style="font-family:var(--font-sans);font-size:13px;color:var(--text-primary);">{esc(name_only, quote=True)}</span>'
            f'<span style="font-size:11px;font-family:var(--font-mono);color:var(--text-muted);">name</span></span>'
        )
    else:
        name_only_row = ""
    for k in ("name", "accent-rgba", "fp8"):
        if not reg.get(k):
            raise Refused(f"no {k} for {a.slug} in its registry entry")
    # The canonical colour, solid: the ring and the seal's ground. Kanji are white, black, canonical or amber, never grey.
    rgb = re.match(r"rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})", reg["accent-rgba"])
    if not rgb:
        raise Refused(f"accent-rgba {reg['accent-rgba']!r} for {a.slug} is not an rgb(a) colour")
    # The seal: the kanji in columns of two, read right to left, as a hanko is.
    seal = "<br>".join(esc("".join(chars[i : i + 2])) for i in range(0, len(chars), 2))
    face_url, face_from = find_face([Path(x).expanduser() for x in a.garden], a.slug)
    try:
        said = parse_said(a.said)
    except ValueError as e:
        raise Refused(str(e)) from e
    loud = loud_items(checks, said, a.mcp, a.mcp_state, a.skill, a.skill_state)
    loud_html = (
        f'<div style="padding:5px 10px;border-radius:var(--radius);background:{LOUD_AMBER};color:#1c1a17;'
        f'font-size:12px;font-weight:500">&#9650; {esc(" · ".join(loud))}</div>'
        if loud
        else ""
    )
    v = {
        "ID": f"p-{a.slug}",
        "NAME": reg["name"],
        "SUBTITLE": a.subtitle,
        "INTRO_LINE": intro.group(1),
        "ACCENT_RGBA": reg["accent-rgba"],
        "CANON": "rgb({},{},{})".format(*rgb.groups()),
        "SEAL": seal,
        "LOUD": loud_html,
        # a background, not an <img>: a face that fails paints nothing, where Chromium draws a broken-image glyph
        "FACE": f'<span style="background:url({esc(face_url, quote=True)}) 50%/cover"></span>' if face_url else "",
        "KANJI": kanji,
        "FP8": reg["fp8"],
        "FINGERPRINT": fp,
        "FP_KANJI": spelled,
        "MARK_SVG": svg,
        "KANJI_ATTESTED": attested,
        "KANJI_NAME_ONLY": name_only,
        "FP_ATTESTS": str(n),
        "NAME_ONLY_ROW": name_only_row,
        "THUMB_B64": thumb,
        "EXPECTED_BYTES": str(meta["bytes"]),
        "EXPECTED_CHECKSUM": meta["checksum_fnv1a32"],
        "MIME": meta["mime"],
        "VERSION": a.version,
        "BUILD": a.build or "build unstamped",
        "BUILD_STATE": "ok" if a.build else "warn",
        "CHECK_INTEGRITY": a.integrity,
        "CHECK_IDENTITY": a.identity,
        "CHECK_FILES": a.files,
        "CHECK_ALIVE": a.alive,
        "CHECK_FULLFP": a.fullfp,
        "TRUST_STATE": state,
        "TRUST_MARK": "✓" if state == "verified" else "",
        "TRUST_TITLE": title,
        "LOCATION": a.location,
        "AT_LOCAL": a.at_local or now_local(a.tz),
        "HOST": a.host,
        "HARNESS": a.harness,
        "MODEL": a.model,
        "MCP": a.mcp,
        "MCP_STATE": a.mcp_state,
        "SKILL": a.skill,
        "SKILL_STATE": a.skill_state,
        "PERMISSION": a.permission,
        "PERMISSION_STATE": "warn" if a.permission in ("bypassPermissions", "mode unknown") else "ok",
    }
    t = (TEMPLATE_FULL if a.full else TEMPLATE).read_text()
    t = t[t.index("-->") + 3 :].lstrip()
    for k, val in v.items():
        t = t.replace(f"__{k}__", val)
    left = sorted(set(re.findall(r"__[A-Z0-9_]+__", t)))
    if left:
        raise Refused(f"unfilled placeholders for {a.slug}: {left}")
    Path(a.out).write_text(t)
    print(
        f"wrote {a.out} · {len(t.encode())} bytes · trust {state} · fingerprint spells {spelled}"
        + (f" (attests {n} of {len(chars)}; {name_only} name-only)" if name_only else "")
        + ("" if a.full else f" · face {face_url or face_from}")
        + ("" if a.full else (f" · LOUD: {' · '.join(loud)}" if loud else " · silent: every check that ran passed" + ("; alive not asked" if a.alive == NOT_ASKED else "")))
    )


if __name__ == "__main__":
    try:
        main()
    except Refused as e:
        print(f"fill-greeting: REFUSED — {e}", file=sys.stderr)
        sys.exit(2)
    except Exception as e:  # never a traceback: name it and stop
        print(f"fill-greeting: REFUSED — unexpected {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(2)
