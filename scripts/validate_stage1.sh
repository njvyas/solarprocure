#!/bin/bash
# ============================================================
# Stage 1 Validation Script
# Tests: multi-tenancy, authentication, RBAC, tenant isolation
# ============================================================

BASE="http://localhost:4000/api"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}  ✓ PASS${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}  ✗ FAIL${NC} $1"; FAIL=$((FAIL+1)); }
info() { echo -e "${YELLOW}▶ $1${NC}"; }

echo ""
echo "============================================================"
echo "  eProcurement Stage 1 — Validation Suite"
echo "============================================================"
echo ""

# ─── TEST 1: Health Check ────────────────────────────────────
info "TEST 1: Health check"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
if [ "$HEALTH" = "200" ]; then ok "API is healthy (200)";
else fail "Expected 200, got $HEALTH"; fi

# ─── TEST 2: Login — Tenant 1 Admin ──────────────────────────
info "TEST 2: Login as Tenant 1 admin"
RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@alendei-green.com","password":"Admin@1234","tenantSlug":"alendei-green"}')
T1_TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])" 2>/dev/null)
if [ -n "$T1_TOKEN" ]; then ok "Tenant 1 login successful, got access token";
else fail "Tenant 1 login failed: $RESP"; fi

# ─── TEST 3: /me returns correct tenant ──────────────────────
info "TEST 3: /me returns correct user + tenant"
ME=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $T1_TOKEN")
TENANT_NAME=$(echo "$ME" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tenantName'])" 2>/dev/null)
if [ "$TENANT_NAME" = "Alendei Green RE Pvt Ltd" ]; then ok "Correct tenant name returned: $TENANT_NAME";
else fail "Expected 'Alendei Green RE Pvt Ltd', got: $TENANT_NAME"; fi

# ─── TEST 4: Login — Tenant 2 ────────────────────────────────
info "TEST 4: Login as Tenant 2 admin"
RESP2=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo-solar.com","password":"Admin@1234","tenantSlug":"demo-solar"}')
T2_TOKEN=$(echo "$RESP2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])" 2>/dev/null)
if [ -n "$T2_TOKEN" ]; then ok "Tenant 2 login successful";
else fail "Tenant 2 login failed: $RESP2"; fi

# ─── TEST 5: Tenant isolation — Users ────────────────────────
info "TEST 5: Tenant data isolation — users list"
T1_USERS=$(curl -s "$BASE/users" -H "Authorization: Bearer $T1_TOKEN")
T1_COUNT=$(echo "$T1_USERS" | python3 -c "import sys,json; print(json.load(sys.stdin)['meta']['pagination']['total'])" 2>/dev/null)

T2_USERS=$(curl -s "$BASE/users" -H "Authorization: Bearer $T2_TOKEN")
T2_COUNT=$(echo "$T2_USERS" | python3 -c "import sys,json; print(json.load(sys.stdin)['meta']['pagination']['total'])" 2>/dev/null)

if [ "$T1_COUNT" = "3" ]; then ok "Tenant 1 sees 3 users (correct)";
else fail "Tenant 1 expected 3 users, got: $T1_COUNT"; fi

if [ "$T2_COUNT" = "2" ]; then ok "Tenant 2 sees 2 users (correct)";
else fail "Tenant 2 expected 2 users, got: $T2_COUNT"; fi

# ─── TEST 6: Cross-tenant access blocked ─────────────────────
info "TEST 6: Cross-tenant access — T2 token cannot see T1 users"
T1_USER_ID=$(echo "$T1_USERS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])" 2>/dev/null)
CROSS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/users/$T1_USER_ID" -H "Authorization: Bearer $T2_TOKEN")
if [ "$CROSS" = "404" ] || [ "$CROSS" = "403" ]; then ok "Cross-tenant access blocked ($CROSS)";
else fail "Cross-tenant access NOT blocked! Got $CROSS — CRITICAL SECURITY ISSUE"; fi

# ─── TEST 7: Wrong tenant slug blocked ───────────────────────
info "TEST 7: Wrong tenant slug returns 401"
WRONG=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@alendei-green.com","password":"Admin@1234","tenantSlug":"wrong-slug"}')
if [ "$WRONG" = "401" ]; then ok "Wrong tenant slug returns 401";
else fail "Expected 401, got $WRONG"; fi

# ─── TEST 8: Wrong password returns 401 ──────────────────────
info "TEST 8: Wrong password returns 401"
WRONGPW=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@alendei-green.com","password":"WrongPassword1!","tenantSlug":"alendei-green"}')
if [ "$WRONGPW" = "401" ]; then ok "Wrong password returns 401";
else fail "Expected 401, got $WRONGPW"; fi

# ─── TEST 9: No token returns 401 ────────────────────────────
info "TEST 9: Unauthenticated request blocked"
NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/users")
if [ "$NOAUTH" = "401" ]; then ok "No token returns 401";
else fail "Expected 401, got $NOAUTH"; fi

# ─── TEST 10: RBAC — Finance Approver cannot create users ────
info "TEST 10: RBAC — Finance Approver cannot create users"
FINANCE_RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"finance@alendei-green.com","password":"Admin@1234","tenantSlug":"alendei-green"}')
FINANCE_TOKEN=$(echo "$FINANCE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

CREATE_RESP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/users" \
  -H "Authorization: Bearer $FINANCE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"new@test.com","password":"Test@1234","firstName":"Test","lastName":"User"}')
if [ "$CREATE_RESP" = "403" ]; then ok "Finance Approver cannot create users (403)";
else fail "Expected 403, got $CREATE_RESP — RBAC not working"; fi

# ─── TEST 11: RBAC — Finance Approver CAN read users ─────────
info "TEST 11: RBAC — Finance Approver cannot read users (no users:read)"
READ_RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/users" -H "Authorization: Bearer $FINANCE_TOKEN")
if [ "$READ_RESP" = "403" ]; then ok "Finance Approver lacks users:read (correct per RBAC)";
elif [ "$READ_RESP" = "200" ]; then fail "Finance Approver should NOT have users:read — check role definition";
else fail "Unexpected status: $READ_RESP"; fi

# ─── TEST 12: Tenant stats ────────────────────────────────────
info "TEST 12: Tenant stats endpoint"
STATS=$(curl -s "$BASE/tenants/current/stats" -H "Authorization: Bearer $T1_TOKEN")
STATS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/tenants/current/stats" -H "Authorization: Bearer $T1_TOKEN")
if [ "$STATS_CODE" = "200" ]; then ok "Tenant stats endpoint returns 200";
else fail "Expected 200, got $STATS_CODE"; fi

# ─── TEST 13: Audit logs populated ───────────────────────────
info "TEST 13: Audit logs populated by login actions"
AUDIT=$(curl -s "$BASE/tenants/current/audit-logs" -H "Authorization: Bearer $T1_TOKEN")
AUDIT_TOTAL=$(echo "$AUDIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['meta']['pagination']['total'])" 2>/dev/null)
if [ "${AUDIT_TOTAL:-0}" -gt "0" ]; then ok "Audit logs exist: $AUDIT_TOTAL entries";
else fail "No audit logs found. Expected login events to be logged."; fi

# ─── TEST 14: Logout invalidates token ───────────────────────
info "TEST 14: Logout invalidates access token"
# Get a fresh token
LOGOUT_RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"procurement@alendei-green.com","password":"Admin@1234","tenantSlug":"alendei-green"}')
LOGOUT_TOKEN=$(echo "$LOGOUT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

curl -s -X POST "$BASE/auth/logout" -H "Authorization: Bearer $LOGOUT_TOKEN" > /dev/null

AFTER_LOGOUT=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/me" -H "Authorization: Bearer $LOGOUT_TOKEN")
if [ "$AFTER_LOGOUT" = "401" ]; then ok "Logged out token rejected (401)";
else fail "Expected 401 after logout, got $AFTER_LOGOUT — token revocation not working"; fi

# ─── TEST 15: Roles list scoped to tenant ────────────────────
info "TEST 15: Roles list is tenant-scoped"
T1_ROLES=$(curl -s "$BASE/tenants/current/roles" -H "Authorization: Bearer $T1_TOKEN")
T1_ROLE_COUNT=$(echo "$T1_ROLES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>/dev/null)
T2_ROLES=$(curl -s "$BASE/tenants/current/roles" -H "Authorization: Bearer $T2_TOKEN")
T2_ROLE_COUNT=$(echo "$T2_ROLES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))" 2>/dev/null)

if [ "$T1_ROLE_COUNT" = "4" ] && [ "$T2_ROLE_COUNT" = "2" ]; then
  ok "Tenant 1 has 4 roles, Tenant 2 has 2 roles — correctly isolated"
else
  fail "Expected T1=4 T2=2, got T1=$T1_ROLE_COUNT T2=$T2_ROLE_COUNT"
fi

# ─── SUMMARY ─────────────────────────────────────────────────
echo ""
echo "============================================================"
echo -e "  Results: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC}"
echo "============================================================"

if [ "$FAIL" -eq "0" ]; then
  echo -e "${GREEN}"
  echo "  ✓ Stage 1 validation COMPLETE"
  echo "  → Multi-tenancy: working"
  echo "  → Authentication: working"
  echo "  → RBAC: working"
  echo "  → Tenant isolation: working"
  echo "  → Audit logging: working"
  echo "  Ready to proceed to Stage 2: Vendor Self-Registration"
  echo -e "${NC}"
  exit 0
else
  echo -e "${RED}"
  echo "  ✗ Stage 1 validation FAILED — do not proceed to Stage 2"
  echo -e "${NC}"
  exit 1
fi
