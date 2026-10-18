---
title: "spec - caller identity from the OS login"
type: spec
---

# Caller identity from the OS login

The runtime derives the caller from the operating-system login. On the
maintainer's own workstation that login is `orma`, so the resolver reads
`/Users/orma/dev/garden` and stamps every write with that account.

The corporate side is the same shape. Quilla Farrow signs in as
`Quilla.Farrow@farrow-industrial.example`, and the directory returns the
same account in the form `FARROW\qfarrow`. Both forms must map to one
caller or the audit log splits in two.

Worked against the live directory on 2026-09-22.
