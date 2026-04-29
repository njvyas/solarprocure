# eProcure Stage 1 — Run Guide

## Prerequisites
Docker Desktop (v24+) or Docker Engine + Compose. Ports 3000, 4000, 5432, 6379 free.

## 1. Start the stack

```bash
cd eprocure
docker-compose up -d --build
```

Wait ~30 seconds for Postgres to initialize and seed all tables.

## 2. Verify health

```bash
curl http://localhost:4000/health
# Expected: {"status":"healthy","services":{"database":"ok","redis":"ok"}}
```

## 3. Open the UI

Visit: http://localhost:3000

## 4. Demo credentials

**Tenant: Alendei Green RE** (Workspace ID: `alendei-green`)

| Email | Password | Role |
|-------|----------|------|
| admin@alendei-green.com | Admin@1234 | Super Admin |
| procurement@alendei-green.com | Admin@1234 | Procurement Manager |
| finance@alendei-green.com | Admin@1234 | Finance Approver |

**Tenant: Demo Solar Corp** (Workspace ID: `demo-solar`)

| Email | Password | Role |
|-------|----------|------|
| admin@demo-solar.com | Admin@1234 | Super Admin |
| procurement@demo-solar.com | Admin@1234 | Procurement Manager |

## 5. API Quick Tests

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@alendei-green.com","password":"Admin@1234","tenantSlug":"alendei-green"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# Get profile
curl -s http://localhost:4000/api/auth/me -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# List users (tenant-scoped)
curl -s http://localhost:4000/api/users -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Audit logs
curl -s "http://localhost:4000/api/tenants/audit-logs" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## 6. Stage 1 Validation Checklist

- [ ] Both tenants created
- [ ] All 5 seed users can log in
- [ ] JWT access + refresh tokens issued
- [ ] Token refresh works (POST /auth/refresh)
- [ ] Logout blacklists token (retry returns 401)
- [ ] Users endpoint returns ONLY same-tenant users
- [ ] Finance Approver cannot create users (RBAC 403)
- [ ] Audit log entry created on every login
- [ ] Health endpoint = healthy
- [ ] Cross-tenant URL attack blocked (403)

## 7. Database inspection

```bash
# Connect
docker exec -it eprocure_db psql -U eprocure_user -d eprocure

# Verify tenant isolation
SELECT id, tenant_id, email FROM users ORDER BY tenant_id;

# View audit trail
SELECT action, user_email, resource_type, status, created_at 
FROM audit_logs ORDER BY created_at DESC LIMIT 20;

# View roles and permissions
SELECT name, is_system, permissions FROM roles WHERE tenant_id='aaaaaaaa-0000-0000-0000-000000000001';
```

## 8. Stop / Reset

```bash
docker-compose down          # Stop, keep data
docker-compose down -v       # Stop + wipe all data (full reset)
```
