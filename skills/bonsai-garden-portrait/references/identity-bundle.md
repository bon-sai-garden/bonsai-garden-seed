---
id: 01M3BS43NCTG8BB5GZZZD2V3CQ
---
# identity/

Generated cert chains, one folder per agent slug — `<slug>/{ca.key, ca.crt, private.key, cert.pem, chain.pem}`. Created automatically the first time `make-canonical-portrait.py` signs that agent's portrait (or explicitly via `portrait_lib.ensure_identity`). **Gitignored. Keys never enter the repo.**

## Why self-signed

Phase 1, same as `bonsai-garden/tools/weave-in/`'s own precedent: a workshop-local root CA signs each agent's leaf cert. `c2pa-python` requires a chain (it rejects a bare self-signed end-entity cert), so every agent gets a two-level chain rooted in its own private CA — not one shared workshop-wide CA, so one agent's chain can rotate without touching any other's.

**What this buys:** a genuine, verifiable cryptographic signature over the portrait — tamper-evident, independently checkable with `c2patool` or this skill's own `portrait_lib.sign_c2pa` read-back.

**What this doesn't buy:** public trust. Every signature validates with `signingCredential.untrusted` on any verifier that checks against the public C2PA trust list, because this CA isn't on it. That's expected, not a bug.

## Upgrading past Phase 1

Getting off `untrusted` means getting this CA — or a cert signed by a real one — onto a trust list a verifier actually checks, which in practice means either: (a) a paid C2PA-conformant CA issues the leaf cert directly (no workshop-local root at all), or (b) applying to get a workshop root cross-signed or listed. Neither is a code change here; both are an actual external step someone has to go take. Until then, `signingCredential.untrusted` in a validation read-back is the expected, correct result — not a sign something needs fixing.

## Rotating a compromised or expiring chain

```bash
python3 scripts/make-canonical-portrait.py --slug <slug> --source <original-source> \
  --name "<Name>" --org "<Org>" --force-new-cert
```

Regenerates the chain from scratch and re-signs. The old chain's files are overwritten, not archived — if you need the old public cert for any reason, copy `identity/<slug>/cert.pem` out before rotating.
