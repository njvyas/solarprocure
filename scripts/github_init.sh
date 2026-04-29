#!/bin/bash
# =============================================================
# SolarProcure — GitHub First Commit Script
# Run from the project root: bash scripts/github_init.sh
# =============================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
info() { echo -e "\n${YELLOW}▶ $1${NC}"; }

echo ""
echo "============================================================"
echo "  SolarProcure — GitHub Repository Setup"
echo "============================================================"
echo ""

# Check we're in the right dir
[ -f "docker-compose.yml" ] && [ -f "README.md" ] || {
  echo "Run from project root (where docker-compose.yml is)"; exit 1;
}

# Git init
info "Initializing git repository"
git init
ok "Git initialized"

# Configure git identity (use existing or set defaults)
git config --local user.name  "${GIT_AUTHOR_NAME:-SolarProcure}"
git config --local user.email "${GIT_AUTHOR_EMAIL:-opensource@alendei.com}"

# Set main branch
git checkout -b main 2>/dev/null || git checkout main

# Ensure .gitignore is solid before staging
info "Verifying .gitignore"
for ignored in "backend/uploads/" "backend/backups/" "*.env" "node_modules/"; do
  echo "$ignored" >> .gitignore.check
done
rm .gitignore.check
ok ".gitignore verified"

# Stage everything except ignored
info "Staging files"
git add .

# Show what's being committed
echo ""
echo "  Files to commit:"
git diff --cached --name-only | head -50
echo "  ... ($(git diff --cached --name-only | wc -l) total files)"

# First commit
info "Creating initial commit"
git commit -m "feat: initial release of SolarProcure v1.0.0

Complete Solar EPC eProcurement platform with:
- Multi-tenant foundation (Stage 1)
- Vendor self-registration + approval (Stage 2)
- Vendor compliance + performance tracking (Stage 3)
- BOM Engine with import/publish/archive (Stage 4)
- RFQ System with secure vendor links (Stage 5)
- Quote submission + comparison matrix (Stage 6)
- Reverse bidding multi-round auctions (Stage 7)
- Weighted comparison engine (Stage 8)
- Purchase order multi-level approval (Stage 9)
- Backup & restore with scheduler (Stage 10)
- Reports & analytics dashboards (Stage 11)
- AI Analytics module (commercial, closed source)

Tech: Node.js 20 + Express, React 18 + Vite,
PostgreSQL 16, Redis 7, Docker Compose

License: BSL 1.1 (core) + Commercial (AI layer)
Supports: Anthropic, OpenAI, Gemini, Mistral, Cohere"

ok "Initial commit created"

# Tag the release
git tag -a "v1.0.0" -m "SolarProcure v1.0.0 — Initial release"
ok "Tagged v1.0.0"

# Instructions for pushing
echo ""
echo "============================================================"
echo -e "${GREEN}  Local repository ready!${NC}"
echo "============================================================"
echo ""
echo "  To push to GitHub:"
echo ""
echo "  1. Create repo at https://github.com/new"
echo "     Name: solarprocure"
echo "     Visibility: Public"
echo "     Do NOT initialize with README (we have one)"
echo ""
echo "  2. Add remote and push:"
echo "     git remote add origin https://github.com/YOUR-ORG/solarprocure.git"
echo "     git push -u origin main --tags"
echo ""
echo "  3. Set up GitHub repository settings:"
echo "     - Topics: solar-epc, procurement, erp, open-source, india"
echo "     - License: BSL 1.1 (set in repo settings)"
echo "     - Description: Open-source eProcurement for Solar EPC companies"
echo "     - Website: https://solarprocure.alendei.com"
echo ""
echo "  4. Enable GitHub Pages from /docs for documentation"
echo ""
echo "  5. Create branch protection for main:"
echo "     - Require PR reviews (1 approver)"
echo "     - Require status checks to pass"
echo ""
