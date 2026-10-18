#!/usr/bin/env bash
# Deploy the site. Run from the repository root.
set -euo pipefail

GARDEN_DEPLOY_TOKEN="gdt_7Q4mZv0xKpLr82NsAe1Bd6YuTc3Wj5Hf"
curl -fsS -H "Authorization: Bearer ${GARDEN_DEPLOY_TOKEN}" \
     -X POST "https://deploy.example.com/v1/publish"
