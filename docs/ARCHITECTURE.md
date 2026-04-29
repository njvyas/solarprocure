# SolarProcure Architecture

## System Architecture

```
                        ┌─────────────────────────────────┐
                        │           Internet               │
                        └──────────────┬──────────────────┘
                                       │ HTTPS :443
                        ┌──────────────▼──────────────────┐
                        │         nginx (host)             │
                        │  SSL termination + reverse proxy │
                        │  /api/* → :4000  / → :3000      │
                        └───────────┬───────────┬─────────┘
                                    │           │
              ┌─────────────────────▼─┐   ┌─────▼──────────────────┐
              │   Backend Container   │   │  Frontend Container     │
              │   Node.js 20 :4000    │   │  nginx serving          │
              │                       │   │  React 18 SPA           │
              │  • JWT Auth           │   │  (static files)         │
              │  • RBAC middleware     │   └────────────────────────┘
              │  • 14 route modules   │
              │  • Audit logging      │
              │  • File upload        │
              │  • Backup scheduler   │
              │  • AI orchestration   │
              └──────────┬────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
┌─────────▼──────┐  ┌────▼──────┐  ┌───▼────────────────┐
│  PostgreSQL 16  │  │  Redis 7  │  │  Docker Volumes    │
│  :5432          │  │  :6379    │  │                    │
│                 │  │           │  │  uploads_data/     │
│  31 tables      │  │ JWT BL    │  │  backups_data/     │
│  Row-level MT   │  │ Rate limit│  │  postgres_data/    │
│  28+ indexes    │  │ Sessions  │  │  redis_data/       │
└─────────────────┘  └───────────┘  └────────────────────┘
```

## Multi-Tenancy Model

**Shared database, row-level isolation** — every table has `tenant_id`.

```sql
-- EVERY query includes this pattern
WHERE table.tenant_id = $1 -- always from validated JWT, never from user input
  AND table.deleted_at IS NULL
```

The `tenant_id` in the JWT `tid` claim is the ground truth. URL parameters and request bodies are never trusted for tenant scoping.

## Authentication Flow

```
Login Request
     │
     ▼
[1] Verify tenant slug → get tenant_id
[2] Verify email within tenant → get user
[3] Check account lock / status
[4] bcrypt.compare(password, hash)
[5] Generate JWT pair:
    • Access token  (15m, signed HS256)
    • Refresh token (7d, SHA-256 hashed in DB)
[6] Record login timestamp + IP
[7] Audit log: auth.login
     │
     ▼
Response: { accessToken, refreshToken, user, permissions }

──────────────────────────────────────────────

Per-Request Auth
     │
     ▼
[1] Extract Bearer token
[2] Verify JWT signature
[3] Check Redis blacklist (jti)
[4] Load user from DB (fresh every request)
[5] Verify tenant still active
[6] Load and merge roles → permissions
[7] Attach to req: user, tenantId, permissions
```

## RBAC Model

```
Permission: { "module": ["action", ...] }
Wildcard:   { "*": ["*"] }  ← Super Admin

Modules: vendors, rfqs, boms, quotes, pos, bidding,
         evaluations, reports, backup, ai, users, roles,
         tenants, audit

Actions per module:
  read, create, update, delete
  + module-specific: approve (vendors/pos), send (rfqs),
    evaluate (quotes), restore (backup), use/manage (ai)
```

## Data Flow: RFQ to PO

```
Create BOM ──► Publish BOM
     │
     ▼
Create RFQ ──► Import BOM items ──► Add vendors (approved only)
     │
     ▼
Send RFQ ──► Vendor gets secure link (UUID token, no login)
     │
     ▼
Vendor submits quote (token-gated public endpoint)
     │
     ▼
Comparison matrix (L1 auto-highlighted)
     │
     ├──► Evaluation (weighted scoring)
     │
     ├──► Reverse Bidding (optional)
     │
     ▼
Award quote ──► RFQ status = awarded
     │
     ▼
Create PO (from awarded quote) ──► Submit for approval
     │
     ▼
Multi-level approval (L1 → L2 → approved)
     │
     ▼
Issue PO ──► Vendor receives (future: email notification)
```

## Database Schema Overview

| Group | Tables |
|-------|--------|
| Identity | tenants, roles, users, user_roles, refresh_tokens |
| Vendors | vendors, vendor_documents, vendor_compliance, vendor_performance |
| Procurement | boms, bom_items, rfqs, rfq_items, rfq_vendors |
| Quoting | quotes, quote_items |
| Bidding | bid_sessions, bid_rounds, bids |
| Evaluation | evaluations, evaluation_criteria, evaluation_scores |
| Orders | purchase_orders, po_items, po_approvals |
| Operations | audit_logs, backup_jobs, restore_jobs |
| AI (commercial) | ai_providers, ai_insights, ai_chat_sessions |

## AI Module Architecture

```
Admin adds API key
      │ AES-256-CBC encrypt (key = JWT_SECRET[:32])
      ▼
ai_providers table (key_hint = last 4 chars only)

Insight request
      │
      ▼
buildProcurementContext()  ← queries 6 real tables
      │
      ▼
INSIGHT_PROMPTS[type](ctx) ← structured prompt with real data
      │
      ▼
callAI(provider, key, messages) ← routes to correct provider SDK
      │                           (Anthropic/OpenAI/Gemini/Mistral/Cohere/Custom)
      ▼
Parse JSON response ──► ai_insights table (cached 24h)
      │
      ▼
Frontend polls for completion (async job pattern)
```
