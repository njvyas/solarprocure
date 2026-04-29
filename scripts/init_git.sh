#!/bin/bash
# Run this once from the project root to set up the git repo for first release
# Usage: bash scripts/init_git.sh

set -e
cd "$(dirname "$0")/.."

echo "Initialising git repository..."

git init
git checkout -b main

git config user.email "opensource@alendei.com"
git config user.name "Alendei Group"

# Stage everything except secrets
git add .
git status --short

git commit -m "feat: initial release — eProcurement for Solar EPC v1.0

11-stage production-ready procurement platform:
- Multi-tenant auth with RBAC (JWT + Redis blacklist)
- Vendor self-registration, compliance, performance scoring
- BOM engine with import, versioning, publish
- RFQ system with vendor token links
- Quote submission, comparison matrix, award workflow
- Reverse bidding (multi-round, floor price, real-time rank)
- Weighted evaluation engine
- Purchase orders with multi-level approval chain
- Automated backup (pg_dump) + two-step restore
- Reports: spend, vendor, RFQ activity, audit summary
- AI analytics module (closed core) — Claude, GPT, Gemini, Mistral, Cohere
- Production deploy script (Ubuntu/Debian/RHEL)
- 182-assertion integration test suite

License: BSL 1.1 (AI module closed)
Converts to GPL v2 on 2029-01-01"

echo ""
echo "Git repo initialised. Next steps:"
echo "  1. Create repo on GitHub: https://github.com/new"
echo "     Name: eprocurement"
echo "     Visibility: Public"
echo "     Do NOT initialise with README (we have one)"
echo ""
echo "  2. Push:"
echo "     git remote add origin git@github.com:alendei-group/eprocurement.git"
echo "     git push -u origin main"
echo ""
echo "  3. Create v1.0.0 release:"
echo "     git tag -a v1.0.0 -m 'v1.0.0 — initial public release'"
echo "     git push origin v1.0.0"
echo ""
echo "  4. On GitHub release page, attach eprocure_final.zip as a binary asset"
