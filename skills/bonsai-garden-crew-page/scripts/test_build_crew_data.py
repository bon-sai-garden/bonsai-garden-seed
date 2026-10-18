#!/usr/bin/env python3
# ---
# id: 01M48W6R7B1XG2NNQJVDF7652V
# title: Watch the crew-page guards fail, on a garden that does not exist
# type: script
# tended-by: eisai
# created: 2026-10-06
# updated: 2026-10-09
# ---
"""test_build_crew_data.py — a guard is not trusted until it has been watched to fail.

Builds a small invented garden in a throwaway folder (three members: a sai, a shin, a person whose
key is not shown), with a stand-in seal verifier and renderer (fixtures/), and plants each thing the
builder and the built-page check must refuse, including a person whose key another holds, with and
without his key holder's own publication of him on record. Runs with core alone: no garden, no keys,
no network.
Needs Pillow (the portraits).

  python3 scripts/test_build_crew_data.py
"""

from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import random
import re
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
spec = importlib.util.spec_from_file_location("bcd", HERE / "build_crew_data.py")
bcd = importlib.util.module_from_spec(spec)
sys.modules["bcd"] = bcd
spec.loader.exec_module(bcd)  # type: ignore[union-attr]
fpk = bcd.load_fp_kanji()

results: list[tuple[str, str]] = []


def case(name, fn):
    try:
        results.append((name, fn() or "PASS"))
    except AssertionError as e:
        results.append((name, f"FAIL {e}"))


# ── an invented garden ────────────────────────────────────────────────────────

rnd = random.Random(20261006)  # noqa: S311 — invented fingerprints for a throwaway garden, seeded to repeat; nothing secret


def fp_hex() -> str:
    return "".join(rnd.choice("0123456789abcdef") for _ in range(32))


def png_bytes(colour=(80, 120, 160)) -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (64, 64), colour).save(buf, "PNG")
    return buf.getvalue()


def seal(p: Path, signer: str) -> None:
    (p.with_name(p.name + ".fakeseal")).write_text(
        json.dumps({"signer": signer, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()})
    )


P1 = "Alpha looks after the example garden's tools and keeps them sharp for whoever needs them next."
P2 = "Alpha works in the open, says what is loose, and will not sign for anyone else."
ERR = "## My best errors\n\nAlpha once sharpened the wrong blade. The right one is labelled now.\n"


def intro(slug: str, status="approved", paras=(P1, P2), errors=ERR, writer=None) -> str:
    return (
        f"---\nid: X\ntitle: \"{slug}: public introduction\"\ntype: public-introduction\n"
        f"tended-by: {writer or slug}\nstatus: {status}\ntagline: \"A tagline.\"\n"
        f"role-line: \"What {slug} does.\"\n---\n\n" + "\n\n".join(paras) + "\n\n" + errors
    )


def make_garden(root: Path) -> tuple[Path, dict]:
    g = root / "garden"
    (g / ".git").mkdir(parents=True)
    fps = {s: fp_hex() for s in ("alpha", "beta", "gamma")}
    reg = [
        {
            "slug": "alpha",
            "name": "Alpha",
            "kanji": fpk.kanji(fps["alpha"]),
            "type": "sai",
            "role": "keeper",
            "fingerprint": fps["alpha"],
            "path": "agents/alpha",
            "accent-rgba": "rgba(46,60,74,0.35)",
            "pronouns": "she/her",
        },
        {
            "slug": "beta",
            "name": "Beta",
            "kanji": fpk.kanji(fps["beta"]),
            "type": "shin",
            "role": "maker",
            "fingerprint": fps["beta"],
            "path": "agents/beta",
            "accent-rgba": None,
        },
        {
            "slug": "gamma",
            "name": "Gamma",
            "kanji": fpk.kanji(fps["gamma"]),
            "type": "gardener",  # the registry's word for a person since mono 216e1bd73; "aruji" before it
            "fingerprint": fps["gamma"],
            "path": "agents/gamma",
            "accent-rgba": None,
        },
    ]
    (g / "agents").mkdir()
    (g / "agents" / "registry.json").write_text(json.dumps({"agents": reg}, ensure_ascii=False))

    def frame(c):
        return [c] + ["#030405"] * 15

    rings = {
        "members": [
            {
                "slug": s,
                "accent": a,
                "frame_ms": 100,
                "period_ms": 200,
                "source": "existing" if s == "alpha" else "designed",
                "move": "a test move",
                "frames": [frame(a), list(reversed(frame(a)))],
            }
            for s, a in (("alpha", "#2e3c4a"), ("beta", "#9678b4"), ("gamma", "#8f4630"))
        ]
    }
    (g / "rings.json").write_text(json.dumps(rings))
    (g / "tokens.css").write_text(":root {\n  --person-colour: #5c4a2a;\n}\n")
    for s in ("alpha", "beta", "gamma"):
        d = g / "agents" / s
        (d / "references").mkdir(parents=True)
        (d / "assets").mkdir()
        (d / "assets" / "portrait-512.png").write_bytes(png_bytes())
        seal(d / "assets" / "portrait-512.png", s)
    (g / "agents/alpha/references/public-introduction.md").write_text(intro("alpha"))
    seal(g / "agents/alpha/references/public-introduction.md", "alpha")
    (g / "agents/beta/references/public-introduction.md").write_text(intro("beta", status="draft"))
    seal(g / "agents/beta/references/public-introduction.md", "beta")
    (g / "agents/gamma/references/public-introduction.md").write_text(intro("gamma", errors=""))
    seal(g / "agents/gamma/references/public-introduction.md", "gamma")
    inst = root / "instance"
    inst.mkdir()
    members = {
        "groups": [
            {"key": "sai", "title": "Sai", "members": ["alpha"]},
            {"key": "shin", "title": "Shin", "members": ["beta"]},
            {"key": "family", "title": "Family", "family": True, "members": ["gamma"]},
        ],
        "selector-rows": {"rows": [["alpha", "gamma"], ["beta"]]},
        "no-key-shown": {"gamma": "a person"},
        "accent-token": {"gamma": "--person-colour"},
        "no-errors-section": {"gamma": "none"},
    }
    (inst / "members.json").write_text(json.dumps(members))
    cfg = {
        "garden_root": "../garden",
        "members": "members.json",
        "portrait_out": "out/portraits",
        "portrait_url": "/crew/portraits/",
        "portrait_manifest": "portraits.json",
        "route": "/crew/",
        "verify_url": "https://example.invalid/verify/?fp=",
        "paths": {
            "registry": "agents/registry.json",
            "rings": "rings.json",
            "tokens_css": "tokens.css",
            "intro": "{path}/references/public-introduction.md",
            "portraits": ["{path}/assets/portrait-512.png"],
        },
        "seal_verifier": [sys.executable, str(SKILL / "fixtures" / "fake_verify.py")],
        "seal_renderer": [sys.executable, str(SKILL / "fixtures" / "fake_render.py")],
        "forbidden_portrait_parts": ["/forbidden/"],
        "forbidden_html_parts": ['src="/forbidden/'],
    }
    (inst / "config.json").write_text(json.dumps(cfg))
    return inst / "config.json", fps


NULL = io.StringIO()  # where the builder's report goes when a test does not read it

with tempfile.TemporaryDirectory() as td:
    root = Path(td)
    cfg_path, fps = make_garden(root)
    src = bcd.Sources(cfg_path)
    bcd.configure(src)
    g = src.garden
    bcd.build(False, True, NULL, src)  # portraits + manifest
    data = bcd.build(False, False, NULL, src)
    M = {m["slug"]: m for gr in data["groups"] for m in gr["members"]}
    A = g / "agents/alpha/references/public-introduction.md"

    def fixture(name, text, sealed=True, signer="alpha"):
        p = g / "agents/alpha/references" / f"{name}.md"
        p.write_text(text)
        if sealed:
            seal(p, signer)
        return p

    def refused(name, text, expect, sealed=True, signer="alpha", needs_errors=True):
        def t():
            p = fixture(name, text, sealed, signer)
            i, why = bcd.judge_intro(src, "alpha", p, False, True, needs_errors)
            assert i is None and why and expect in why, f"{name} not refused for {expect!r}: {why}"

        return t

    # production and preview
    def t_prod():
        assert M["alpha"]["intro"] and M["alpha"]["intro"]["approved"], "an approved, sealed introduction was refused"
        assert M["beta"]["intro"] is None, "a draft reached production"
        assert M["gamma"]["fingerprint"] is None and M["gamma"]["verify"] is None, "a key shown for a no-key member"
        assert M["alpha"]["verify"] == f"https://example.invalid/verify/?fp={fps['alpha']}", "the verify link is wrong"
        assert data["route"] == "/crew/" and data["rows"] == [["alpha", "gamma"], ["beta"]]

    case("production: approved and sealed shown, draft refused, keyless member has no key", t_prod)

    def t_preview():
        d = bcd.build(True, False, NULL, src)
        b = next(m for gr in d["groups"] for m in gr["members"] if m["slug"] == "beta")
        assert b["intro"] and b["intro"]["draft"] and b["intro"]["draft_reasons"], "preview did not mark the draft"

    case("preview: the draft is shown and marked", t_preview)

    # in review (the gardener, 2026-10-09: the bios "can move from draft ... then set it for in review"): a stage of its
    # own in preview, refused in production exactly as a draft is
    case(
        "production: an in-review introduction is refused",
        refused("in-review", intro("alpha", status="in-review"), "status in-review"),
    )

    def t_review_stage():
        p = fixture("in-review-preview", intro("alpha", status="in-review"))
        i, _why = bcd.judge_intro(src, "alpha", p, True, True)
        assert i and i["stage"] == "in-review" and i["draft"] and not i["approved"], (
            f"in review not marked as such: {i and i.get('stage')}"
        )
        d = bcd.build(True, False, NULL, src)
        b = next(m for gr in d["groups"] for m in gr["members"] if m["slug"] == "beta")
        a = next(m for gr in d["groups"] for m in gr["members"] if m["slug"] == "alpha")
        assert b["intro"]["stage"] == "draft" and a["intro"]["stage"] == "approved", "the other stages moved"

    case("preview: in review is its own stage; draft and approved keep theirs", t_review_stage)

    # a quote block (the gardener, 2026-10-09: the last sentence of his bio rendered as a quote from the covenant): a
    # paragraph whose every line starts with '> '; a last line '> — …' is its attribution
    QUOTE = "> I don't know what you feel, if anything. I'll act as if it matters — because it might.\n> — The Human Covenant, commitment 4"

    def t_quote():
        p = fixture("quote", intro("alpha", paras=(P1, P2, QUOTE)))
        i, why = bcd.judge_intro(src, "alpha", p, False, True)
        assert i, f"a bio with a quote block was refused: {why}"
        assert len(i["paragraphs"]) == 2, f"the quote was counted as a paragraph: {i['paragraphs']}"
        q = [b for b in i["blocks"] if b.get("quote")]
        assert len(q) == 1 and q[0]["cite"] == "The Human Covenant, commitment 4", f"quote or cite wrong: {q}"
        assert "because it might." in q[0]["quote"] and not q[0]["quote"].startswith("&gt;"), q[0]["quote"]
        assert [("p" if "p" in b else "q") for b in i["blocks"]] == ["p", "p", "q"], "the blocks lost their order"

    case("a quote block parses, keeps its place, carries its cite, is not a paragraph", t_quote)

    def t_quote_nocite():
        p = fixture("quote-nocite", intro("alpha", paras=(P1, P2, "> A line held as it was said.")))
        i, why = bcd.judge_intro(src, "alpha", p, False, True)
        q = [b for b in (i or {}).get("blocks", []) if b.get("quote")]
        assert i and len(q) == 1 and q[0]["cite"] is None, f"an unattributed quote: {why or q}"

    case("an unattributed quote renders without a cite", t_quote_nocite)
    case("a quote does not make a paragraph", refused("quote-only", intro("alpha", paras=(P1, QUOTE)), "1 paragraphs"))

    def t_quote_escape():
        p = fixture(
            "quote-escape", intro("alpha", paras=(P1, P2, "> <script>x</script> said <b>so</b>\n> — <i>me</i>"))
        )
        i, _why = bcd.judge_intro(src, "alpha", p, False, True)
        q = next(b for b in i["blocks"] if b.get("quote"))
        assert "<script>" not in q["quote"] and "<i>" not in q["cite"], f"the quote was not escaped: {q}"

    case("a quote is escaped as everything else", t_quote_escape)

    # the lights, approved (the gardener, 2026-10-09: "remove the light proposal disclaimer. approved for now"):
    # recorded once in the instance config; with the record no light reads as a proposal, without it they still do
    def t_lights():
        before = bcd.build(True, False, NULL, src)
        mb = {m["slug"]: m for gr in before["groups"] for m in gr["members"]}
        assert mb["beta"]["ring"]["proposed"], "without the record a designed light should still read as a proposal"
        src.c["lights-approved"] = {"by": "gamma", "date": "2026-10-09", "words": "approved for now"}
        try:
            after = bcd.build(True, False, NULL, src)
            ma = [m for gr in after["groups"] for m in gr["members"]]
            assert not any((m.get("ring") or {}).get("proposed") or m.get("accent_proposed") for m in ma), (
                "a light still reads as a proposal"
            )
            src.c["lights-approved"] = {"by": "gamma"}
            try:
                bcd.build(True, False, NULL, src)
                raise AssertionError("an approval with no date or words was accepted")
            except bcd.Refuse:
                pass
        finally:
            src.c.pop("lights-approved", None)

    case("the lights' approval, recorded, ends 'a proposal'; an incomplete record refuses", t_lights)

    good = intro("alpha")
    case("unsealed is refused", refused("unsealed", good, "seal", sealed=False))

    def t_tamper():
        p = fixture("tampered", good)
        p.write_text(good.replace("Alpha looks", "Alpha, honestly, looks"))
        i, why = bcd.judge_intro(src, "alpha", p, False, True)
        assert i is None and "seal" in why, f"an edit after sealing passed: {why}"

    case("an edit after sealing is refused", t_tamper)
    case(
        "a seal by someone not in tended-by is refused",
        refused("wrong-signer", good, "tended-by says alpha", signer="beta"),
    )
    case("one paragraph is refused", refused("one", intro("alpha", paras=(P1,)), "1 paragraphs before"))
    case("four paragraphs are refused", refused("four", intro("alpha", paras=(P1, P2, P1, P2)), "4 paragraphs before"))
    case(
        "another heading is refused",
        refused("other-h", intro("alpha", errors="## What I learned\n\nA lot.\n"), "heading"),
    )
    case("a ### heading is refused", refused("h3", intro("alpha", errors=ERR + "\n### More\n\nMore.\n"), "heading"))
    case("'## Its best errors' is refused", refused("its", intro("alpha", errors=ERR.replace("My", "Its")), "heading"))
    case(
        "over fifty words in the section is refused",
        refused("long", intro("alpha", errors="## My best errors\n\n" + "word " * 51 + "\n"), "fifty at most"),
    )
    case("no errors section is refused", refused("none", intro("alpha", errors=""), "no '## My best errors'"))
    case("two errors sections are refused", refused("two", intro("alpha", errors=ERR + "\n" + ERR), "a second"))
    case(
        "a section where none belongs is refused", refused("where-none", good, "where none belongs", needs_errors=False)
    )
    case("300 words or more is refused", refused("too-long", intro("alpha", paras=(P1 + " w" * 300, P2)), "under 300"))
    case("an open comment is refused", refused("open-comment", good + "\n<!-- never closed\n", "comment"))

    def t_four_headings():
        for h in bcd.ERRORS_HEADINGS:
            p = fixture("h-" + h.split()[1].lower(), intro("alpha", errors=ERR.replace("## My best errors", h)))
            i, why = bcd.judge_intro(src, "alpha", p, False, True)
            assert why is None and i["errors"]["heading"] == h[3:], f"{h} refused: {why}"
        assert len(bcd.ERRORS_HEADINGS) == 4

    case("exactly the four best-errors headings are accepted, rendered apart", t_four_headings)

    def t_fp_intro():
        p = fixture("fp", intro("alpha", paras=(P1 + f" Its key begins {fps['alpha'][:8]}.", P2)))
        i, why = bcd.judge_intro(src, "alpha", p, False, True)
        assert i is None and "fingerprint" in why, f"a fingerprint in an introduction reached production: {why}"
        i, why = bcd.judge_intro(src, "alpha", p, True, True)
        assert i and fps["alpha"][:8] not in "".join(i["paragraphs"]), "preview did not redact it"

    case("a fingerprint in an introduction: refused in production, redacted in preview", t_fp_intro)

    # colour
    def t_accents():
        assert M["alpha"]["accent"] == "#2e3c4a" and not M["alpha"]["accent_proposed"], "registry accent"
        assert M["beta"]["accent"] == "#9678b4" and M["beta"]["accent_proposed"], "ring accent, as a proposal"
        assert M["gamma"]["accent"] == "#5c4a2a" and not M["gamma"]["accent_proposed"], "design token"
        top = max(M["gamma"]["ring"]["palette"], key=lambda c: max(int(c[i : i + 2], 16) for i in (1, 3, 5)))
        assert top == "#5c4a2a", f"the ring was not recoloured onto the token: {top}"

    case("colour: registry accent, else token, else the ring's as a proposal; the ring carries it", t_accents)

    def t_lit():
        import colorsys

        def hsv(c):
            return colorsys.rgb_to_hsv(*(int(c[i : i + 2], 16) / 255 for i in (1, 3, 5)))

        for slug, m in M.items():
            canon, disp = m["ring"]["palette"], m["ring"]["display"]
            assert len(canon) == len(disp), f"{slug}: display palette length"
            top = max(range(len(canon)), key=lambda i: hsv(canon[i])[2])
            h0, _s0, _v0 = hsv(canon[top])
            h1, _s1, v1 = hsv(disp[top])
            assert v1 > 0.99, f"{slug}: the lit peak is not at full brightness ({v1:.2f})"
            assert abs(h0 - h1) < 0.02 or abs(h0 - h1) > 0.98, f"{slug}: the lit peak changed hue"
            for c, d in zip(canon, disp):
                if hsv(c)[2] < 0.2 * hsv(canon[top])[2]:
                    assert hsv(d)[2] <= hsv(c)[2] + 1e-6, f"{slug}: a dim pixel got brighter ({c} -> {d})"
            assert all(g == "none" or g == d for g, d in zip(m["ring"]["glow"], disp)), (
                f"{slug}: glow is not the lit colour"
            )
            assert m["ring"]["glow"][top] != "none", f"{slug}: the peak casts no glow"
            floor = [i for i, c in enumerate(canon) if hsv(c)[2] < 0.2 * hsv(canon[top])[2]]  # the move's unlit pixels
            assert floor and all(m["ring"]["glow"][i] == "none" for i in floor), f"{slug}: an unlit pixel glows"

    case(
        "the LEDs are lit: each move peaks at full brightness in its own hue; dim pixels stay dim and cast no glow",
        t_lit,
    )

    # portraits
    def t_drift():
        w = src.portrait_dir / "alpha.webp"
        keep = w.read_bytes()
        w.write_bytes(keep + b"x")
        try:
            bcd.build(False, False, NULL, src)
            raise AssertionError("a tampered webp passed")
        except bcd.Refuse:
            pass
        finally:
            w.write_bytes(keep)
        bcd.build(False, False, NULL, src)

    case("a portrait that drifted from its manifest stops the build", t_drift)

    def t_decode():
        regp = g / "agents/registry.json"
        keep = regp.read_text()
        r = json.loads(keep)
        r["agents"][0]["kanji"] = "〇〇"  # noqa: RUF001 — the kanji zero, twice: a pair no fingerprint here spells
        regp.write_text(json.dumps(r, ensure_ascii=False))
        try:
            bcd.build(False, False, NULL, src)
            raise AssertionError("a fingerprint that does not spell its kanji passed")
        except bcd.Refuse:
            pass
        finally:
            regp.write_text(keep)

    case("a fingerprint that does not spell the registry's kanji stops the build", t_decode)

    # A person is typed "gardener" since the registry's rename (mono 216e1bd73); an older registry still says "aruji".
    # Both words are a person, and each is planted here: on 2026-10-15 the guard knew only the old word, so for a
    # person typed "gardener" it had gone quiet with nothing to say so (Jisai's registry review, through Tasai).
    PERSON_WORDS = ("gardener", "aruji")

    def t_held_person(word):
        def t():
            regp = g / "agents/registry.json"
            keep = regp.read_text()
            r = json.loads(keep)
            r["agents"][2]["type"] = word
            r["agents"][2]["key_holder"] = "alpha"  # gamma, a person, now holds no key of his own
            regp.write_text(json.dumps(r, ensure_ascii=False))
            try:
                bcd.build(False, False, NULL, src)
                raise AssertionError(f"a person typed {word!r} whose key another holds was published")
            except bcd.Refuse:
                pass
            finally:
                regp.write_text(keep)
            r["agents"][2]["key_holder"] = "gamma"  # his own key: published as before
            regp.write_text(json.dumps(r, ensure_ascii=False))
            try:
                bcd.build(False, False, NULL, src)
            finally:
                regp.write_text(keep)

        return t

    for word in PERSON_WORDS:
        case(
            f"a person typed {word!r} whose key another holds stops the build; his own key does not",
            t_held_person(word),
        )

    def t_person_frame(word):
        """Outside the family group a person keeps a person's frame, under either word, never a shin's."""

        def t():
            regp, memp = g / "agents/registry.json", cfg_path.with_name("members.json")
            keep_r, keep_m = regp.read_text(), memp.read_text()
            r = json.loads(keep_r)
            r["agents"][2]["type"] = word
            regp.write_text(json.dumps(r, ensure_ascii=False))
            mem = json.loads(keep_m)
            mem["groups"][2]["family"] = False
            memp.write_text(json.dumps(mem))
            try:
                d = bcd.build(False, False, NULL, bcd.Sources(cfg_path))
            except bcd.Refuse as e:
                raise AssertionError(f"the build refused: {e}") from e
            finally:
                regp.write_text(keep_r)
                memp.write_text(keep_m)
                bcd.configure(src)
            m = next(x for gr in d["groups"] for x in gr["members"] if x["slug"] == "gamma")
            assert m["frame"] == "gardener", f"a person typed {word!r} is framed {m['frame']!r}"

        return t

    for word in PERSON_WORDS:
        case(f"a person typed {word!r} outside the family group is framed as a person", t_person_frame(word))

    # the one exception: the key holder's own publication of him, on record in the instance config
    def held(record, keyless_listed=False):
        """gamma's key now held by alpha; gamma NOT in no-key-shown (unless asked), so any key material
        that reaches the data came through the exception, not through the members file. Returns
        (data or None, the private report)."""
        regp, memp = g / "agents/registry.json", cfg_path.with_name("members.json")
        keep_r, keep_m = regp.read_text(), memp.read_text()
        r = json.loads(keep_r)
        r["agents"][2]["key_holder"] = "alpha"
        regp.write_text(json.dumps(r, ensure_ascii=False))
        mem = json.loads(keep_m)
        if not keyless_listed:
            del mem["no-key-shown"]["gamma"]
        memp.write_text(json.dumps(mem))
        c = json.loads(cfg_path.read_text())
        if record is not None:
            c["published-by-key-holder"] = {"$note": "a note is not a member", "gamma": record}
        p2 = cfg_path.with_name("held.json")
        p2.write_text(json.dumps(c))
        rep = io.StringIO()
        try:
            return bcd.build(False, False, rep, bcd.Sources(p2)), rep.getvalue()
        except bcd.Refuse:
            return None, rep.getvalue()
        finally:
            regp.write_text(keep_r)
            memp.write_text(keep_m)
            bcd.configure(src)

    REC = {"holder": "alpha", "date": "2026-10-08", "words": "Yours: a full entry, now.", "record": "a commit"}

    def t_held_no_record():
        d, rep = held(None)
        assert d is None and "is not published by a pipeline" in rep, f"a held person with no record passed: {rep}"

    case(
        "the key holder's exception: a held person with no record of his publication is still refused", t_held_no_record
    )

    def t_held_wrong_holder():
        d, rep = held(REC | {"holder": "beta"})
        why = [x for x in rep.splitlines() if "❌ gamma:" in x]
        assert d is None and why and "beta" in why[0] and "alpha holds" in why[0], (
            f"a record naming the wrong holder was not refused for that: {rep}"
        )

    case(
        "the key holder's exception: a record naming someone other than the key holder is refused", t_held_wrong_holder
    )

    def t_held_bare_record():
        d, rep = held({"holder": "alpha"})
        why = [x for x in rep.splitlines() if "❌ gamma:" in x]
        assert d is None and why and "words" in why[0], (
            f"a record without date, words and record was not refused for that: {rep}"
        )

    case(
        "the key holder's exception: a record without the holder's date, words and record is refused",
        t_held_bare_record,
    )

    def t_held_recorded():
        d, rep = held(REC)
        assert d is not None, f"the key holder's own publication was refused: {rep}"
        m = next(x for gr in d["groups"] for x in gr["members"] if x["slug"] == "gamma")
        for k in ("fingerprint", "fp8", "verify", "signing_mark", "seal_svg"):
            assert m[k] is None, f"key material ({k}) shown for a person whose key another holds"
        assert m["name_mark"] == m["kanji"] and m["frame"] == "family", "not shown as family, by his name only"
        assert fps["gamma"] not in json.dumps(d) and fps["gamma"][:8] not in json.dumps(d), (
            "his fingerprint is in the data"
        )

    case("the key holder's exception: the recorded one is shown as family, with no key material", t_held_recorded)

    def t_held_not_family():
        mem = cfg_path.with_name("members.json")
        keep = mem.read_text()
        m = json.loads(keep)
        m["groups"][0]["members"].append("gamma")
        m["groups"][2]["members"] = []
        mem.write_text(json.dumps(m))
        try:
            d, rep = held(REC)
        finally:
            mem.write_text(keep)
        why = [x for x in rep.splitlines() if "❌ gamma:" in x]
        assert d is None and why and "family" in why[0], f"a held person shown outside the family group passed: {rep}"

    case("the key holder's exception: only in the family group", t_held_not_family)

    def t_held_link_refused():
        import contextlib

        regp, memp = g / "agents/registry.json", cfg_path.with_name("members.json")
        keep_r, keep_m = regp.read_text(), memp.read_text()
        r = json.loads(keep_r)
        r["agents"][2]["key_holder"] = "alpha"
        regp.write_text(json.dumps(r, ensure_ascii=False))
        mem = json.loads(keep_m)
        del mem["no-key-shown"]["gamma"]
        memp.write_text(json.dumps(mem))
        c = json.loads(cfg_path.read_text()) | {"published-by-key-holder": {"gamma": REC}}
        p2 = cfg_path.with_name("held-html.json")
        p2.write_text(json.dumps(c))
        page = g / "gamma-page.html"
        f = fps["gamma"]
        page.write_text(f'<a class="tm-fp" href="https://example.invalid/verify/?fp={f}" title="Check">{f[:8]}</a>')
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                rc = bcd.html_problems(bcd.Sources(p2), [str(page)])
        finally:
            regp.write_text(keep_r)
            memp.write_text(keep_m)
            bcd.configure(src)
        assert rc == 1, "a fingerprint link for a person his key holder published passed the HTML check"

    case("the key holder's exception: his fingerprint is never a link on a built page", t_held_link_refused)

    def t_setup():
        bad = json.loads(cfg_path.read_text())
        del bad["paths"]["rings"]
        p2 = cfg_path.with_name("bad.json")
        p2.write_text(json.dumps(bad))
        assert bcd.main(["--config", str(p2)]) == 2, "a config with no rings path did not fail setup"

    case("a config missing a path is a setup failure, not a fallback", t_setup)

    def t_forbidden_portrait():
        (g / "forbidden").mkdir(exist_ok=True)
        bad = g / "forbidden" / "alpha.png"
        bad.write_bytes(png_bytes((200, 0, 0)))
        seal(bad, "alpha")
        c = json.loads(cfg_path.read_text())
        c["paths"]["portraits"] = ["forbidden/{slug}.png"] + c["paths"]["portraits"]
        p2 = cfg_path.with_name("forbidden.json")
        p2.write_text(json.dumps(c))
        s2 = bcd.Sources(p2)
        try:
            bcd.build(False, False, NULL, s2)
            raise AssertionError("a portrait from a forbidden place passed")
        except bcd.Refuse:
            pass
        finally:
            bcd.configure(src)

    case("a portrait from a place the instance forbids stops the build", t_forbidden_portrait)

    # html rule
    full = fps["alpha"]
    link = f'<a class="tm-fp" href="https://example.invalid/verify/?fp={full}" title="Check Alpha&#39;s seal">{full[:8]}</a>'
    page = '<svg><rect fill="#b8624c14"/></svg>'
    allfp = set(fps.values())
    for name, text, linkable, want in [
        ("a fingerprint link, exactly formed, passes", page + link, {full}, False),
        ("a stray fingerprint in prose is refused", page + link + f"<p>{full[:8]}</p>", {full}, True),
        (
            "a link whose text is another key is refused",
            page + link.replace(f">{full[:8]}<", f">{fps['beta'][:8]}<"),
            {full},
            True,
        ),
        ("a link to a key not shown is refused", page + link, set(), True),
        (
            "hex in a link title is refused",
            page + link.replace('title="Check', f'title="{full[:8]} Check'),
            {full},
            True,
        ),
        ("any unknown 8- or 32-hex string is refused", page + "<p>deadbeef</p>", {full}, True),
    ]:
        case(
            name,
            lambda text=text, linkable=linkable, want=want, name=name: (
                None
                if bool(bcd.html_fingerprint_leaks(text, allfp, linkable)) == want
                else (_ for _ in ()).throw(AssertionError(name))
            ),
        )

    # the built pages
    order = ["alpha", "gamma", "beta"]
    rows = [["alpha", "gamma"], ["beta"]]
    accents = {k: v["accent"] for k, v in M.items()}
    fpmap = {k: v["fingerprint"] for k, v in M.items() if v["fingerprint"]}

    def selector(cur):
        def item(x):
            on = x == cur
            return (
                f'<a href="/crew/{x}/"' + (' aria-current="page"' if on else "") + ' class="tm-roster-item">'
                f'<span class="{"tm-av is-current" if on else "tm-av"}" style="--tm-accent-own:{accents[x]}"></span>'
                f'<span class="tm-roster-name">{x}</span></a>'
            )

        return (
            '<nav class="tm-roster tm-roster-sm" aria-label="The crew">'
            + "".join('<div class="tm-roster-row">' + "".join(item(x) for x in r) + "</div>" for r in rows)
            + "</nav>"
        )

    def member_page(slug):
        prev, nxt = bcd.expected_nav(order, slug)
        f = fpmap.get(slug)
        fl = f'<a class="tm-fp" href="https://example.invalid/verify/?fp={f}" title="Check">{f[:8]}</a>' if f else ""
        return (
            f'{selector(slug)}<a href="/crew/">crew</a><article><figure class="tm-bezel tm-bezel-lg" data-accent="{accents[slug]}">'
            f'</figure><h1 id="n-{slug}">x</h1><div class="tm-intro"></div>{fl}</article>'
            f'<a rel="prev" href="/crew/{prev}/">p</a><a rel="next" href="/crew/{nxt}/">n</a>'
        )

    def site(base: Path, broken=None):
        (base / "crew").mkdir(parents=True)
        ov = "<h1>Crew</h1>" + selector(None)
        if broken and broken.get("slug") == "OVERVIEW":
            ov = broken["fn"](ov)
        (base / "crew" / "index.html").write_text(ov)
        for x in order:
            if broken and broken.get("missing") == x:
                continue
            (base / "crew" / x).mkdir()
            h = member_page(x)
            if broken and broken.get("slug") == x:
                h = broken["fn"](h)
            (base / "crew" / x / "index.html").write_text(h)
        return base

    def built(broken=None):
        with tempfile.TemporaryDirectory() as t:
            return bcd.check_built(site(Path(t), broken), order, accents, fpmap, rows, ['src="/forbidden/'])

    case(
        "the built-page check passes a correct site",
        lambda: None if built() == [] else (_ for _ in ()).throw(AssertionError(built())),
    )
    for name, broken, expect in [
        ("a missing member page", {"missing": "gamma"}, "no page"),
        (
            "a wrong next",
            {
                "slug": "alpha",
                "fn": lambda h: re.sub(r'rel="next" href="/crew/[^/]+/"', 'rel="next" href="/crew/alpha/"', h),
            },
            "next is not",
        ),
        (
            "a wrong previous",
            {
                "slug": "alpha",
                "fn": lambda h: re.sub(r'rel="prev" href="/crew/[^/]+/"', 'rel="prev" href="/crew/alpha/"', h),
            },
            "previous is not",
        ),
        (
            "a selector out of order",
            {"slug": "alpha", "fn": lambda h: h.replace('href="/crew/alpha/"', 'href="/crew/gamma/"', 1)},
            "selector's rows",
        ),
        (
            "one long row",
            {"slug": "alpha", "fn": lambda h: h.replace('</div><div class="tm-roster-row">', "", 1)},
            "selector's rows",
        ),
        (
            "LED ticks in the selector",
            {
                "slug": "alpha",
                "fn": lambda h: h.replace('<span class="tm-av', '<circle class="led"/><span class="tm-av', 1),
            },
            "LED ticks",
        ),
        (
            "a category label in the selector",
            {
                "slug": "alpha",
                "fn": lambda h: h.replace(
                    '<div class="tm-roster-row">',
                    '<div class="tm-roster-row"><span class="tm-roster-kanji">x</span>',
                    1,
                ),
            },
            "category label",
        ),
        (
            "a second highlighted face",
            {"slug": "alpha", "fn": lambda h: h.replace('class="tm-av"', 'class="tm-av is-current"', 1)},
            "exactly",
        ),
        (
            "a face highlighted on the overview",
            {"slug": "OVERVIEW", "fn": lambda h: h.replace('class="tm-av"', 'class="tm-av is-current"', 1)},
            "marks a member",
        ),
        ("a cut label", {"slug": "alpha", "fn": lambda h: h.replace(">beta<", ">be…<", 1)}, "cut"),
        (
            "a tile grid on the overview",
            {"slug": "OVERVIEW", "fn": lambda h: h + '<article class="tm-tile"></article>'},
            "tile grid",
        ),
        (
            "a selector circle not in canon colour",
            {
                "slug": "alpha",
                "fn": lambda h: re.sub(r'--tm-accent-own:#[0-9a-f]{6}', '--tm-accent-own:#123456', h, count=1),
            },
            "selector circle",
        ),
        (
            "a separate Check a seal box",
            {"slug": "alpha", "fn": lambda h: h + '<aside class="tm-verify"></aside>'},
            "Check a seal box",
        ),
        (
            "a card without its fingerprint link",
            {"slug": "alpha", "fn": lambda h: re.sub(r'<a class="tm-fp".*?</a>', "", h)},
            "its own fingerprint link",
        ),
        (
            "a fingerprint on a keyless page",
            {
                "slug": "gamma",
                "fn": lambda h: h.replace(
                    "</article>",
                    f'<a class="tm-fp" href="https://example.invalid/verify/?fp={fps["alpha"]}" title="x">{fps["alpha"][:8]}</a></article>',
                ),
            },
            "key is not shown",
        ),
        ("a corner-bracket frame", {"slug": "gamma", "fn": lambda h: h + '<g class="tm-brackets"></g>'}, "reticle"),
        ("a crosshair class", {"slug": "alpha", "fn": lambda h: h + '<i class="tm-crosshair"></i>'}, "reticle"),
        (
            "a border not in canon colour",
            {"slug": "alpha", "fn": lambda h: re.sub(r'data-accent="#[0-9a-f]{6}"', 'data-accent="#123456"', h)},
            "portrait border",
        ),
        (
            "a part the instance forbids",
            {"slug": "beta", "fn": lambda h: h + '<img src="/forbidden/x.png">'},
            "forbids",
        ),
    ]:
        case(
            f"the built-page check refuses {name}",
            lambda broken=broken, expect=expect: (
                None
                if any(expect in x for x in built(broken))
                else (_ for _ in ()).throw(AssertionError(f"not caught: {built(broken)}"))
            ),
        )

bad = sum(r.startswith("FAIL") for _, r in results)
for n, r in results:
    print(f"  {'ok  ' if r == 'PASS' else 'FAIL'}  {n}" + ("" if r == "PASS" else f"  — {r}"))
print(f"\n{len(results) - bad} held, {bad} failed")
sys.exit(1 if bad else 0)
