#!/usr/bin/env python3
# ---
# id: 01M3BS43P7GH46K60YBK8RAS8G
# ---
"""
portrait_lib.py — shared identity/signing library for the bonsai-garden-portrait skill.

Everything here exists because the historical approach (bonsai-garden's
tools/weave-in/, built 2026-05-20) turned out to be quietly broken against the
c2pa-python version actually available today (0.37.x). This module is a
from-scratch, empirically-verified rewrite of the two hard parts:

  1. Cert generation: pure Python via `cryptography` (no `openssl` CLI
     dependency — weave-in's setup/generate-cert.sh shelled out to openssl;
     this doesn't need to, so it works identically on any OS with Python).

  2. C2PA signing: uses `c2pa.Signer.from_callback`, NOT `Signer.from_info`.
     `from_info` (what weave-in.py used) either rejects a PKCS8 EC key with an
     opaque "invalid signing credentials" error, or — worse, for an RSA key —
     accepts it silently and then fails signing with an opaque "Signature:
     empty string" that gives no hint what's wrong. `from_callback` hands the
     actual RSA-PSS signing to `cryptography` (which we control and can
     verify), and only that path was confirmed, live, this session, to
     produce a claim signature that C2PA's own Reader validates as correct
     (`claimSignature.mismatch` gone from validation_status). The one other
     silent trap: PSS salt length must be the SHA-256 digest size (32 bytes)
     — `padding.PSS.MAX_LENGTH` (what weave-in.py's own dead `_sign_with_key`
     helper used, and what most RSA-PSS examples default to) signs a
     manifest that *embeds* successfully but *fails claim-signature
     validation* silently. Neither of these two bugs raises an exception at
     the point they're wrong — they only show up in the Reader's
     `validation_status`, so ALWAYS read a freshly-signed file back and check
     it, never trust a clean `builder.sign()` return alone.

Known, accepted limitation (same one weave-in's own README already names):
Phase-1 certs are self-signed against a workshop-local root CA, not a public
C2PA trust list. Every manifest signed here will carry a
`signingCredential.untrusted` validation status — expected, not a bug. The
manifest is still fully embedded, tamper-evident, and independently
verifiable with `c2patool` or this same Reader call.
"""

from __future__ import annotations

import datetime
import json
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install --upgrade Pillow")


# ---------------------------------------------------------------------------
# Image
# ---------------------------------------------------------------------------


def square_crop_resize(im: Image.Image, size: int) -> Image.Image:
    """Center-crop to a square (on the shorter side) then resize to size by size."""
    im = im.convert("RGB")
    w, h = im.size
    if w != h:
        edge = min(w, h)
        left = (w - edge) // 2
        top = (h - edge) // 2
        im = im.crop((left, top, left + edge, top + edge))
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return im


# ---------------------------------------------------------------------------
# Identity (cert chain generation — pure Python, no openssl dependency)
# ---------------------------------------------------------------------------


def ensure_identity(
    identity_dir: Path, slug: str, cn: str, org: str, email: str | None = None, force: bool = False
) -> tuple[Path, Path]:
    """Generate (or reuse) a two-level cert chain: workshop-local root CA +
    an agent leaf cert signed by it. Returns (chain_pem_path, private_key_path).

    c2pa-python rejects a bare self-signed end-entity cert, hence the chain —
    same reasoning as weave-in's own setup/generate-cert.sh, ported here so
    this skill has no dependency on that tool or on the `openssl` CLI.
    """
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

    chain_path = identity_dir / "chain.pem"
    key_path = identity_dir / "private.key"
    if chain_path.exists() and key_path.exists() and not force:
        return chain_path, key_path

    identity_dir.mkdir(parents=True, exist_ok=True)
    now = datetime.datetime.now(datetime.timezone.utc)

    # --- Root CA (self-signed, 10 years) ---
    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=4096)
    ca_name = x509.Name(
        [
            x509.NameAttribute(NameOID.COMMON_NAME, "Bonsai Portrait Root CA"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, org),
        ]
    )
    ca_cert = (
        x509.CertificateBuilder()
        .subject_name(ca_name)
        .issuer_name(ca_name)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=False,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=True,
                crl_sign=True,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()),
            critical=False,
        )
        .sign(ca_key, hashes.SHA256())
    )

    # --- Leaf cert (1 year, signed by the CA above) ---
    leaf_key = rsa.generate_private_key(public_exponent=65537, key_size=4096)
    leaf_attrs = [
        x509.NameAttribute(NameOID.COMMON_NAME, cn),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, org),
    ]
    if email:
        leaf_attrs.append(x509.NameAttribute(NameOID.EMAIL_ADDRESS, email))
    builder = (
        x509.CertificateBuilder()
        .subject_name(x509.Name(leaf_attrs))
        .issuer_name(ca_name)
        .public_key(leaf_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=365))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=False,
                key_encipherment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.ExtendedKeyUsage([ExtendedKeyUsageOID.EMAIL_PROTECTION]),
            critical=False,
        )
        .add_extension(
            x509.SubjectKeyIdentifier.from_public_key(leaf_key.public_key()),
            critical=False,
        )
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()),
            critical=False,
        )
    )
    if email:
        builder = builder.add_extension(x509.SubjectAlternativeName([x509.RFC822Name(email)]), critical=False)
    leaf_cert = builder.sign(ca_key, hashes.SHA256())

    pkcs8 = serialization.PrivateFormat.PKCS8
    noenc = serialization.NoEncryption()
    (identity_dir / "ca.key").write_bytes(ca_key.private_bytes(serialization.Encoding.PEM, pkcs8, noenc))
    (identity_dir / "ca.crt").write_bytes(ca_cert.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(leaf_key.private_bytes(serialization.Encoding.PEM, pkcs8, noenc))
    cert_pem = leaf_cert.public_bytes(serialization.Encoding.PEM)
    (identity_dir / "cert.pem").write_bytes(cert_pem)
    chain_path.write_bytes(cert_pem + ca_cert.public_bytes(serialization.Encoding.PEM))

    return chain_path, key_path


# ---------------------------------------------------------------------------
# Layer 1 — EXIF (exiftool)
# ---------------------------------------------------------------------------


def check_exiftool() -> str | None:
    try:
        r = subprocess.run(["exiftool", "-ver"], capture_output=True, text=True)
        return r.stdout.strip() if r.returncode == 0 else None
    except FileNotFoundError:
        return None


def write_exif_layer(
    path: Path,
    *,
    copyright_name: str,
    url: str | None,
    rights: str = "All rights reserved",
    description: str | None = None,
) -> int:
    """Write authorship EXIF/XMP/IPTC fields into path in place. Returns the
    number of fields exiftool reports as written (0 on failure)."""
    year = datetime.date.today().year
    copyright_str = f"© {year} {copyright_name}"
    args = [
        "exiftool",
        "-overwrite_original",
        f"-Artist={copyright_name}",
        f"-Copyright={copyright_str}",
        f"-XMP:Creator={copyright_name}",
        f"-XMP:Rights={rights}",
        "-XMP:Marked=True",
        f"-IPTC:CopyrightNotice={copyright_str}",
        f"-IPTC:By-line={copyright_name}",
        "-Software=bonsai-garden-portrait skill",
    ]
    if url:
        args.append(f"-XMP:CreatorWorkURL={url}")
    if description:
        args.append(f"-XMP:Description={description}")
    args.append(str(path))

    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"✗ exiftool failed:\n{result.stderr}", file=sys.stderr)
        return 0

    readback = subprocess.run(
        [
            "exiftool",
            "-j",
            "-Artist",
            "-Copyright",
            "-XMP:Creator",
            "-XMP:Rights",
            "-XMP:CreatorWorkURL",
            "-XMP:Marked",
            "-IPTC:CopyrightNotice",
            "-IPTC:By-line",
            "-Software",
            "-XMP:Description",
            str(path),
        ],
        capture_output=True,
        text=True,
    )
    if readback.returncode != 0:
        return 0
    data = json.loads(readback.stdout)
    return sum(1 for k, v in data[0].items() if k != "SourceFile" and v) if data else 0


# ---------------------------------------------------------------------------
# Layer 2 — C2PA
# ---------------------------------------------------------------------------

DIGITAL_SOURCE_TYPES = {
    "capture": "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture",
    "ai": "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia",
    "composite": "http://cv.iptc.org/newscodes/digitalsourcetype/compositeSynthetic",
}


def check_c2pa() -> str | None:
    try:
        import c2pa
    except ImportError:
        return None
    # A namespace-package shadow (a bare `c2pa/` directory earlier on
    # sys.path, e.g. bonsai-garden's own orphaned c2pa/ experiment) imports
    # "successfully" but has no __file__ and none of the real API — catch it
    # here rather than let signing fail later with a confusing AttributeError.
    if getattr(c2pa, "__file__", None) is None or not hasattr(c2pa, "Builder"):
        return None
    return getattr(c2pa, "__version__", "unknown")


def build_manifest(
    *,
    title: str,
    copyright_name: str,
    org: str,
    url: str | None,
    digital_source_type: str,
    agent_slug: str,
    session: str | None = None,
) -> dict:
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    creative_work: dict = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "author": {"@type": "Person", "name": copyright_name},
        "copyrightNotice": f"© {datetime.date.today().year} {copyright_name}",
        "dateCreated": now,
    }
    if url:
        creative_work["url"] = url
    return {
        "title": title,
        "assertions": [
            {
                "label": "c2pa.actions",
                "data": {
                    "actions": [
                        {
                            "action": "c2pa.created",
                            "when": now,
                            "digitalSourceType": digital_source_type,
                            "softwareAgent": {"name": "bonsai-garden-portrait", "version": "1.0.0"},
                        },
                    ]
                },
            },
            {"label": "stds.schema-org.CreativeWork", "data": creative_work},
            {
                "label": "cawg.training-mining",
                "data": {
                    "cawg.ai_inference": {"use": "notAllowed"},
                    "cawg.ai_generative_training": {"use": "notAllowed"},
                    "cawg.ai_training": {"use": "notAllowed"},
                },
            },
            {
                "label": "org.bonsai-garden.portrait",
                "data": {
                    "agent": agent_slug,
                    "session": session or datetime.date.today().isoformat(),
                },
            },
        ],
    }


def sign_c2pa(path: Path, *, chain_pem_path: Path, key_path: Path, manifest: dict) -> dict:
    """Sign path in place with a C2PA manifest. Returns the Reader's parsed
    validation_status list (ALWAYS check this — see module docstring; a
    successful sign() call does not by itself mean the signature validates).
    Raises on any hard failure (missing files, sign()/Reader() exceptions).
    """
    import c2pa
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    cert_pem = chain_pem_path.read_text()
    key_pem = key_path.read_bytes()
    private_key = serialization.load_pem_private_key(key_pem, password=None)

    def sign_ps256(data: bytes) -> bytes:
        # Salt length MUST be the hash digest size (32 for SHA-256), not
        # padding.PSS.MAX_LENGTH — see module docstring. MAX_LENGTH signs
        # without error but fails claim-signature validation silently.
        return private_key.sign(
            data,
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=hashes.SHA256().digest_size),
            hashes.SHA256(),
        )

    signer = c2pa.Signer.from_callback(sign_ps256, c2pa.C2paSigningAlg.PS256, cert_pem, None)
    builder = c2pa.Builder(json.dumps(manifest))
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"

    # Temp file lives NEXT TO the target, not in the system tmp dir: the two
    # can be on different filesystems/mounts (confirmed live — a plain
    # Path.replace() across them raises "Invalid cross-device link"), and
    # shutil.copy2 (matching weave-in.py's own precedent) works regardless.
    import os
    import shutil

    tmp_fd, tmp_str = tempfile.mkstemp(suffix=path.suffix, dir=str(path.parent))
    tmp_path = Path(tmp_str)
    try:
        os.close(tmp_fd)
        with open(path, "rb") as src, open(tmp_path, "wb") as dst:
            builder.sign(signer, mime, src, dst)
        shutil.copy2(str(tmp_path), str(path))
    finally:
        if tmp_path.exists():
            tmp_path.unlink()

    with open(path, "rb") as f:
        reader = c2pa.Reader(mime, f)
        result = json.loads(reader.json())
    return result.get("validation_status", [])
