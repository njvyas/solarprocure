<div align="center">

# eProcurement for Solar EPC

**End-to-end procurement platform built for solar EPC companies.**
Vendor management → BOMs → RFQs → Reverse bidding → PO approvals → AI analytics.

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL_1.1-orange.svg)](./LICENSE)
[![Node.js 20](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://docker.com)
[![Stages](https://img.shields.io/badge/Stages-13%2F13-brightgreen.svg)](#stages)

</div>

---

## What it does

A production-grade, multi-tenant eProcurement system purpose-built for solar EPC project execution. It replaces spreadsheets and email chains with a structured, auditable procurement workflow:

- **Vendor lifecycle** — self-registration portal, document collection, compliance cert tracking, performance scoring
- **BOM engine** — structured bill of materials with import, versioning, and direct RFQ publishing
- **RFQ system** — create RFQs from BOMs, invite approved vendors, generate secure token links for quote submission
- **Reverse bidding** — multi-round live auction with configurable floor price, decrement enforcement, and real-time leaderboard
- **Comparison engine** — weighted scoring matrix (price + technical + delivery), L1/H1 analysis, award workflow
- **Purchase orders** — multi-level approval chain (configurable levels), issue, reject, request-changes lifecycle
- **Backup & restore** — automated `pg_dump` + file archive, retention policy, two-step restore confirmation
- **Reports** — spend forecasting, vendor performance, RFQ activity, audit summary
- **AI analytics** *(closed core)* — spend forecast, vendor risk matrix, savings opportunities, anomaly detection, procurement chat — powered by your choice of Claude, GPT, Gemini, Mistral, Cohere, or self-hosted models

---

## Architecture

```
Browser (React 18 + Vite)
        │ HTTPS
   nginx reverse proxy
   ┌────┴────┐
API :4000  Static :3000
Node/Express  nginx SPA
   │
   ├── PostgreSQL 16  (31 tables, 57 indexes, row-level tenant isolation)
   ├── Redis 7        (JWT blacklist, session store)
   └── External AI    (Anthropic / OpenAI / Gemini / Mistral / Cohere / custom)

All four services run in Docker Compose with named volumes.
```

Full architecture diagram: [`docs/architecture.svg`](./docs/architecture.svg)

---

## Quick start (5 minutes)

**Requirements:** Docker 24+, Docker Compose v2, Git

```bash
# 1. Clone
git clone https://github.com/alendei-group/eprocurement.git
cd eprocurement

# 2. Configure
cp .env.example .env
# Edit .env — set JWT_SECRET, JWT_REFRESH_SECRET, POSTGRES_PASSWORD
# (use: openssl rand -hex 32 for each secret)

# 3. Start
docker compose up -d

# 4. Wait for healthy (~30s)
docker compose ps

# 5. Open
open http://localhost:3000
```

**Demo credentials:**

| Org slug | Email | Password | Role |
|---|---|---|---|
| `alendei-green` | `admin@alendei-green.com` | `Admin@1234` | Super Admin |
| `alendei-green` | `procurement@alendei-green.com` | `Admin@1234` | Procurement Manager |
| `alendei-green` | `finance@alendei-green.com` | `Admin@1234` | Finance Approver |
| `demo-solar` | `admin@demo-solar.com` | `Admin@1234` | Super Admin (Tenant 2) |

> ⚠️ Change all passwords immediately after first login.

---

## Production deploy

```bash
# On your server (Ubuntu 22.04 / Debian 12 / RHEL 9):
git clone https://github.com/alendei-group/eprocurement.git
sudo bash eprocurement/deploy.sh --domain yourdomain.com --env prod
```

The deploy script handles: Docker install, nginx config, Let's Encrypt SSL, UFW firewall, fail2ban, cron health checks, and daily backups. See [`deploy.sh`](./deploy.sh) for full details.

---

## Integration tests

```bash
# After docker compose up -d && sleep 30:
bash scripts/validate_all_stages.sh
# → 209 assertions across all 12 stages
```

---

## Who it's for

**Solar EPC project teams** (5–500 people) who:
- Run multiple projects simultaneously across vendors for modules, inverters, cables, civil works, and O&M
- Need an auditable procurement trail for investor due diligence, lender compliance, or internal controls
- Are currently running procurement on WhatsApp, email threads, and Excel — and losing track of vendor commitments, price comparisons, and PO approvals
- Want to bring competitive bidding discipline (reverse auctions) to project procurement

**Typical org:** 1 Procurement Manager, 1–2 Finance Approvers, project-level Viewers, 20–200 vendors in the portal

---

## Stages

| # | Module | Status |
|---|--------|--------|
| 1 | Foundation: Auth, RBAC, multi-tenancy | ✅ |
| 2 | Vendor self-registration + approval | ✅ |
| 3 | Vendor compliance + performance scoring | ✅ |
| 4 | BOM engine (import, version, publish) | ✅ |
| 5 | RFQ system (create, send, vendor tokens) | ✅ |
| 6 | Quote submission + evaluation + award | ✅ |
| 7 | Reverse bidding (multi-round, floor price) | ✅ |
| 8 | Comparison engine (weighted scoring matrix) | ✅ |
| 9 | Purchase orders + multi-level approval | ✅ |
| 10 | Backup & restore (pg_dump + file archive) | ✅ |
| 11 | Reports & analytics | ✅ |
| 12 | Tenant settings + user profile self-service | ✅ |
| 13 | Admin settings GUI, email notifications, setup wizard, production hardening | ✅ |
| AI | AI analytics module *(closed core, commercial)* | ✅ |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, CSS variables (no UI framework) |
| Backend | Node.js 20, Express, express-validator, Winston, Busboy |
| Database | PostgreSQL 16 (row-level multi-tenancy) |
| Cache / Auth | Redis 7 (JWT blacklist + refresh token store) |
| Auth | JWT (15m access + 7d refresh), bcrypt(12), token revocation |
| Encryption | AES-256-CBC (API keys at rest) |
| Deploy | Docker Compose, nginx, certbot, fail2ban, UFW |
| AI | Anthropic, OpenAI, Gemini, Mistral, Cohere, custom OpenAI-compatible |

---

## Project structure

```
eprocurement/
├── backend/
│   ├── src/
│   │   ├── config/         # DB + Redis connections
│   │   ├── middleware/      # auth, error, upload, validate
│   │   ├── routes/         # 14 route files (1 per module)
│   │   ├── services/       # 12 service files (business logic)
│   │   └── utils/          # jwt, rbac, response, logger
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # layout, auth
│   │   ├── contexts/       # AuthContext
│   │   └── pages/          # 1 directory per module
│   ├── Dockerfile.prod
│   └── vite.config.js
├── scripts/
│   ├── init.sql            # 31 tables + seed data
│   └── validate_all_stages.sh  # 182-assertion integration test
├── deploy.sh               # production deploy (Ubuntu/RHEL/Debian)
├── docker-compose.yml
├── LICENSE                 # BSL 1.1
└── README.md
```

---

## API overview

All endpoints require `Authorization: Bearer <token>` except auth + public vendor/quote routes.

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/vendors                    # list (paginated)
POST   /api/vendors/register           # public — vendor self-reg
POST   /api/vendors/:id/review         # approve / reject

GET    /api/boms
POST   /api/boms/:id/import            # bulk line item import
POST   /api/boms/:id/publish

GET    /api/rfqs
POST   /api/rfqs/:id/send
POST   /api/rfqs/:id/import-bom
GET    /api/rfqs/token/:token          # public — vendor quote page

POST   /api/quotes/submit/:token       # public — vendor submits quote
POST   /api/quotes/:id/evaluate        # shortlist / award

POST   /api/bidding                    # create session
POST   /api/bidding/:id/start-round
POST   /api/bidding/bid/:token         # public — vendor places bid

POST   /api/evaluations/:id/score
POST   /api/evaluations/:id/finalize

POST   /api/purchase-orders/:id/submit
POST   /api/purchase-orders/:id/approve
POST   /api/purchase-orders/:id/issue

POST   /api/backup                     # 202 Accepted (async)
GET    /api/backup/:id/validate
POST   /api/backup/:id/restore

GET    /api/reports/dashboard
GET    /api/reports/spend
GET    /api/reports/vendors

POST   /api/ai/providers               # admin: add AI provider
POST   /api/ai/insights                # 202 Accepted (async analysis)
POST   /api/ai/chat                    # conversational analytics
```

Full API reference: [`docs/api.md`](./docs/api.md) *(coming soon)*

---

## Multi-tenancy

Every table has a `tenant_id` column. The JWT encodes `tid` (tenant ID) — never from user input. Every query filters by `tenant_id`. Cross-tenant access returns 404 (not 403 — no information leakage).

---

## License

The **base system** (all modules except AI) is licensed under [Business Source License 1.1](./LICENSE).

- **Free for**: self-hosted use, internal business use, development, testing
- **Open source on**: January 1, 2029 (converts to GPL v2)
- **Commercial license required for**: SaaS offerings, hosting for third parties

The **AI Analytics Module** (`backend/src/services/ai.service.js`, `backend/src/routes/ai.routes.js`, `frontend/src/pages/ai/`) is **not open source** and requires a commercial license regardless of use case.

Commercial licensing: [opensource@alendei.com](mailto:opensource@alendei.com)

---

## Contributing

Pull requests welcome for the base system. Please open an issue first for significant changes.

AI module contributions are not accepted as that code is not open source.

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Run the integration tests: `bash scripts/validate_all_stages.sh`
4. Submit a pull request

---

## Support

- GitHub Issues: bugs, feature requests, integration questions
- Email: [support@alendei.com](mailto:support@alendei.com)
- Commercial: [sales@alendei.com](mailto:sales@alendei.com)

---

<div align="center">
Built by <a href="https://alendei.com">Alendei Group</a> · Vadodara, India<br>
<em>"Alendei from Bharat"</em>
</div>
