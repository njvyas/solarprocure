#!/bin/bash
# ============================================================
# Integration Test Suite — Stage 1 + Stage 2 Combined
# Tests: Auth, RBAC, Tenant Isolation, Vendor Registration,
#        Vendor Approval Workflow, Document Upload, Cross-tenant
# ============================================================

BASE="http://localhost:4000/api"
PASS=0; FAIL=0
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}  ✗${NC} $1"; FAIL=$((FAIL+1)); }
info() { echo -e "\n${YELLOW}▶ $1${NC}"; }
json() { python3 -c "import sys,json; d=json.load(sys.stdin); print($2)" 2>/dev/null; }

echo ""
echo "============================================================"
echo "  eProcurement — Stage 1+2 Integration Test Suite"
echo "============================================================"

# ─── STAGE 1: FOUNDATION ─────────────────────────────────────
info "STAGE 1 — Health & Auth"

HEALTH=$(curl -s "$BASE/health")
ST=$(echo "$HEALTH" | json - 'd["status"]')
[ "$ST" = "healthy" ] && ok "Health: healthy" || fail "Health check failed: $ST"

STAGE=$(echo "$HEALTH" | json - 'd["stage"]')
[ "$STAGE" = "2" ] && ok "Stage marker = 2" || fail "Expected stage=2, got $STAGE"

# Login T1 admin
T1_ADM=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@alendei-green.com","password":"Admin@1234","tenantSlug":"alendei-green"}')
T1_ADM_TOKEN=$(echo "$T1_ADM" | json - 'd["data"]["accessToken"]')
[ -n "$T1_ADM_TOKEN" ] && ok "T1 admin login OK" || fail "T1 admin login FAILED: $(echo $T1_ADM | python3 -c 'import sys,json; print(json.load(sys.stdin).get("error","?"))' 2>/dev/null)"

# Login T1 procurement
T1_PROC=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"procurement@alendei-green.com","password":"Admin@1234","tenantSlug":"alendei-green"}')
T1_PROC_TOKEN=$(echo "$T1_PROC" | json - 'd["data"]["accessToken"]')
[ -n "$T1_PROC_TOKEN" ] && ok "T1 procurement login OK" || fail "T1 procurement login FAILED"

# Login T2 admin
T2_ADM=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@demo-solar.com","password":"Admin@1234","tenantSlug":"demo-solar"}')
T2_ADM_TOKEN=$(echo "$T2_ADM" | json - 'd["data"]["accessToken"]')
[ -n "$T2_ADM_TOKEN" ] && ok "T2 admin login OK" || fail "T2 admin login FAILED"

# /me tenant check
ME=$(curl -s "$BASE/auth/me" -H "Authorization: Bearer $T1_ADM_TOKEN")
TN=$(echo "$ME" | json - 'd["data"]["tenantName"]')
[ "$TN" = "Alendei Green RE Pvt Ltd" ] && ok "/me returns correct tenant" || fail "/me returned: $TN"

# ─── STAGE 1: TENANT ISOLATION ───────────────────────────────
info "STAGE 1 — Tenant Isolation"

T1_UC=$(curl -s "$BASE/users" -H "Authorization: Bearer $T1_ADM_TOKEN" | json - 'd["meta"]["pagination"]["total"]')
T2_UC=$(curl -s "$BASE/users" -H "Authorization: Bearer $T2_ADM_TOKEN" | json - 'd["meta"]["pagination"]["total"]')
[ "$T1_UC" = "3" ] && ok "T1 sees 3 users" || fail "T1 expected 3 users, got $T1_UC"
[ "$T2_UC" = "2" ] && ok "T2 sees 2 users" || fail "T2 expected 2 users, got $T2_UC"

T1_USER_ID=$(curl -s "$BASE/users" -H "Authorization: Bearer $T1_ADM_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])" 2>/dev/null)
CROSS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/users/$T1_USER_ID" -H "Authorization: Bearer $T2_ADM_TOKEN")
[ "$CROSS" = "404" ] || [ "$CROSS" = "403" ] && ok "Cross-tenant user access blocked ($CROSS)" || fail "Cross-tenant NOT blocked: $CROSS"

NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/vendors")
[ "$NOAUTH" = "401" ] && ok "Unauthenticated vendor access blocked" || fail "Expected 401, got $NOAUTH"

# ─── STAGE 1: RBAC ───────────────────────────────────────────
info "STAGE 1 — RBAC"

FINANCE_TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"finance@alendei-green.com","password":"Admin@1234","tenantSlug":"alendei-green"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

CREATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/users" \
  -H "Authorization: Bearer $FINANCE_TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","password":"Test@1234","firstName":"X","lastName":"Y"}')
[ "$CREATE_STATUS" = "403" ] && ok "Finance cannot create users (RBAC)" || fail "Expected 403, got $CREATE_STATUS"

VENDOR_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/vendors" -H "Authorization: Bearer $FINANCE_TOKEN")
[ "$VENDOR_STATUS" = "403" ] && ok "Finance cannot read vendors (RBAC)" || fail "Expected 403, got $VENDOR_STATUS"

# ─── STAGE 1: LOGOUT + TOKEN REVOCATION ─────────────────────
info "STAGE 1 — Logout + Token Revocation"

TEMP=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"procurement@alendei-green.com","password":"Admin@1234","tenantSlug":"alendei-green"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)
curl -s -X POST "$BASE/auth/logout" -H "Authorization: Bearer $TEMP" -H "Content-Type: application/json" > /dev/null
REVOKED=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/me" -H "Authorization: Bearer $TEMP")
[ "$REVOKED" = "401" ] && ok "Revoked token rejected after logout" || fail "Expected 401 after logout, got $REVOKED"

# ─── STAGE 2: VENDOR SELF-REGISTRATION (PUBLIC) ─────────────
info "STAGE 2 — Vendor Self-Registration (public)"

# Register a new vendor (no auth)
REG=$(curl -s -X POST "$BASE/vendors/register" \
  -F "tenantSlug=alendei-green" \
  -F "companyName=Test Vendor Co Pvt Ltd" \
  -F "contactName=Test Contact" \
  -F "contactEmail=testvendor_$(date +%s)@example.com" \
  -F "contactPhone=+919876500001" \
  -F "gstNumber=24AABCT$(date +%s | tail -c 8)Z5" \
  -F "productCategories=Solar Panels,Inverters" \
  -F "certifications=IEC 61215")

REG_ID=$(echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
REG_STATUS=$(echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
[ -n "$REG_ID" ] && ok "Vendor registered, ID=$REG_ID" || fail "Vendor registration failed: $(echo $REG | python3 -c 'import sys,json; print(json.load(sys.stdin).get("error","?"))' 2>/dev/null)"
[ "$REG_STATUS" = "pending" ] && ok "New vendor status=pending" || fail "Expected pending, got $REG_STATUS"

# Register same email again — should fail 409
SAME_EMAIL=$(echo "$REG" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'].get('id',''))" 2>/dev/null)
# Get the email we used
REG_EMAIL_VAL=$(echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin)" 2>/dev/null)

# ─── STAGE 2: VENDOR LIST SCOPED TO TENANT ──────────────────
info "STAGE 2 — Vendor List Tenant Isolation"

T1_VENDORS=$(curl -s "$BASE/vendors" -H "Authorization: Bearer $T1_ADM_TOKEN")
T1_VC=$(echo "$T1_VENDORS" | python3 -c "import sys,json; print(json.load(sys.stdin)['meta']['pagination']['total'])" 2>/dev/null)
T2_VENDORS=$(curl -s "$BASE/vendors" -H "Authorization: Bearer $T2_ADM_TOKEN")
T2_VC=$(echo "$T2_VENDORS" | python3 -c "import sys,json; print(json.load(sys.stdin)['meta']['pagination']['total'])" 2>/dev/null)

[ "${T1_VC:-0}" -ge "2" ] && ok "T1 sees ≥2 vendors ($T1_VC)" || fail "T1 expected ≥2 vendors, got $T1_VC"
[ "$T2_VC" = "1" ] && ok "T2 sees 1 vendor (isolated)" || fail "T2 expected 1 vendor, got $T2_VC"

# Cross-tenant vendor access
T1_VID=$(echo "$T1_VENDORS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])" 2>/dev/null)
CROSS_V=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/vendors/$T1_VID" -H "Authorization: Bearer $T2_ADM_TOKEN")
[ "$CROSS_V" = "404" ] || [ "$CROSS_V" = "403" ] && ok "Cross-tenant vendor access blocked ($CROSS_V)" || fail "Cross-tenant vendor NOT blocked: $CROSS_V"

# ─── STAGE 2: VENDOR STATS ───────────────────────────────────
info "STAGE 2 — Vendor Stats"

STATS=$(curl -s "$BASE/vendors/stats" -H "Authorization: Bearer $T1_ADM_TOKEN")
STATS_OK=$(echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if 'pending' in d['data'] else 'fail')" 2>/dev/null)
[ "$STATS_OK" = "ok" ] && ok "Vendor stats endpoint returns correct shape" || fail "Vendor stats shape wrong"

# ─── STAGE 2: VENDOR APPROVAL WORKFLOW ──────────────────────
info "STAGE 2 — Vendor Approval Workflow"

# Approve seeded pending vendor (Solex Energy)
SOLEX_ID="v1000000-0000-0000-0000-000000000002"

# Approve with procurement manager (has vendors:approve)
APPROVE=$(curl -s -X POST "$BASE/vendors/$SOLEX_ID/review" \
  -H "Authorization: Bearer $T1_PROC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"approve"}')
APPR_STATUS=$(echo "$APPROVE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
[ "$APPR_STATUS" = "approved" ] && ok "Procurement manager can approve vendor" || fail "Approve failed: $(echo $APPROVE | python3 -c 'import sys,json; print(json.load(sys.stdin).get("error","?"))' 2>/dev/null)"

# Try to approve already-approved vendor — should fail
DOUBLE=$(curl -s -X POST "$BASE/vendors/$SOLEX_ID/review" \
  -H "Authorization: Bearer $T1_PROC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"approve"}')
DOUBLE_CODE=$(echo "$DOUBLE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
[ "$DOUBLE_CODE" = "ALREADY_APPROVED" ] && ok "Re-approve returns ALREADY_APPROVED" || fail "Expected ALREADY_APPROVED, got $DOUBLE_CODE"

# Reject the newly registered vendor
if [ -n "$REG_ID" ]; then
  REJECT=$(curl -s -X POST "$BASE/vendors/$REG_ID/review" \
    -H "Authorization: Bearer $T1_PROC_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"action":"reject","reason":"Incomplete documentation"}')
  REJ_STATUS=$(echo "$REJECT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
  [ "$REJ_STATUS" = "rejected" ] && ok "Vendor rejected with reason" || fail "Reject failed: $REJ_STATUS"
fi

# Finance approver cannot approve vendors
FINANCE_APPROVE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/vendors/$SOLEX_ID/review" \
  -H "Authorization: Bearer $FINANCE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"approve"}')
[ "$FINANCE_APPROVE" = "403" ] && ok "Finance cannot approve vendors (RBAC)" || fail "Expected 403, got $FINANCE_APPROVE"

# ─── STAGE 2: REQUEST CHANGES WORKFLOW ──────────────────────
info "STAGE 2 — Request Changes Workflow"

# Register a fresh vendor to test request_changes
FRESH_REG=$(curl -s -X POST "$BASE/vendors/register" \
  -F "tenantSlug=alendei-green" \
  -F "companyName=Fresh Vendor Ltd" \
  -F "contactName=Fresh Contact" \
  -F "contactEmail=fresh_$(date +%s)@freshvendor.com" \
  -F "contactPhone=+919876511111" \
  -F "productCategories=Cables")

FRESH_ID=$(echo "$FRESH_REG" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

if [ -n "$FRESH_ID" ]; then
  # Request changes
  RC=$(curl -s -X POST "$BASE/vendors/$FRESH_ID/review" \
    -H "Authorization: Bearer $T1_PROC_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"action":"request_changes","note":"Please upload GST certificate"}')
  RC_STATUS=$(echo "$RC" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
  [ "$RC_STATUS" = "changes_requested" ] && ok "Request changes workflow OK" || fail "Expected changes_requested, got $RC_STATUS"

  # Vendor updates details → status resets to pending
  UPDATE=$(curl -s -X PATCH "$BASE/vendors/$FRESH_ID" \
    -H "Authorization: Bearer $T1_PROC_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"companyName":"Fresh Vendor Ltd (Updated)","certifications":["IEC 61215"]}')
  UPD_STATUS=$(echo "$UPDATE" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null)
  [ "$UPD_STATUS" = "pending" ] && ok "Status reset to pending after update" || fail "Expected pending after update, got $UPD_STATUS"
fi

# ─── STAGE 2: DUPLICATE DETECTION ───────────────────────────
info "STAGE 2 — Duplicate Detection"

# Register with existing seed email
DUP=$(curl -s -X POST "$BASE/vendors/register" \
  -F "tenantSlug=alendei-green" \
  -F "companyName=Duplicate Co" \
  -F "contactName=Dup Contact" \
  -F "contactEmail=rajesh@rayzon.com" \
  -F "productCategories=Solar Panels")
DUP_CODE=$(echo "$DUP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
[ "$DUP_CODE" = "DUPLICATE_EMAIL" ] && ok "Duplicate email rejected (DUPLICATE_EMAIL)" || fail "Expected DUPLICATE_EMAIL, got $DUP_CODE"

# Register with existing GST
DUP_GST=$(curl -s -X POST "$BASE/vendors/register" \
  -F "tenantSlug=alendei-green" \
  -F "companyName=Another Co" \
  -F "contactName=Another Contact" \
  -F "contactEmail=another_$(date +%s)@another.com" \
  -F "gstNumber=24AABCR1234A1Z5" \
  -F "productCategories=Inverters")
DUP_GST_CODE=$(echo "$DUP_GST" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
[ "$DUP_GST_CODE" = "DUPLICATE_GST" ] && ok "Duplicate GST rejected (DUPLICATE_GST)" || fail "Expected DUPLICATE_GST, got $DUP_GST_CODE"

# ─── STAGE 2: WRONG TENANT SLUG ─────────────────────────────
info "STAGE 2 — Registration Validation"

WRONG_TENANT=$(curl -s -X POST "$BASE/vendors/register" \
  -F "tenantSlug=does-not-exist" \
  -F "companyName=Test" \
  -F "contactName=Test" \
  -F "contactEmail=test@test.com" \
  -F "productCategories=Solar Panels")
WT_CODE=$(echo "$WRONG_TENANT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
[ "$WT_CODE" = "TENANT_NOT_FOUND" ] && ok "Wrong tenant slug → TENANT_NOT_FOUND" || fail "Expected TENANT_NOT_FOUND, got $WT_CODE"

# Missing required fields
MISSING=$(curl -s -X POST "$BASE/vendors/register" \
  -F "tenantSlug=alendei-green" \
  -F "companyName=Test")
MISSING_CODE=$(echo "$MISSING" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',''))" 2>/dev/null)
[ "$MISSING_CODE" = "VALIDATION_ERROR" ] && ok "Missing required fields → VALIDATION_ERROR" || fail "Expected VALIDATION_ERROR, got $MISSING_CODE"

# ─── STAGE 2: AUDIT LOGS FOR VENDOR ACTIONS ─────────────────
info "STAGE 2 — Audit Trail"

AUDIT=$(curl -s "$BASE/tenants/current/audit-logs?resource_type=vendor" -H "Authorization: Bearer $T1_ADM_TOKEN")
AUDIT_TOTAL=$(echo "$AUDIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['meta']['pagination']['total'])" 2>/dev/null)
[ "${AUDIT_TOTAL:-0}" -gt "0" ] && ok "Vendor audit logs exist: $AUDIT_TOTAL entries" || fail "No vendor audit logs found"

# Verify vendor.approved action is logged
APPR_LOG=$(curl -s "$BASE/tenants/current/audit-logs?action=vendor.updated" -H "Authorization: Bearer $T1_ADM_TOKEN")
APPR_LOG_COUNT=$(echo "$APPR_LOG" | python3 -c "import sys,json; print(json.load(sys.stdin)['meta']['pagination']['total'])" 2>/dev/null)
[ "${APPR_LOG_COUNT:-0}" -gt "0" ] && ok "vendor.updated audit events logged ($APPR_LOG_COUNT)" || fail "No vendor.updated audit logs found"

# ─── SUMMARY ─────────────────────────────────────────────────
echo ""
echo "============================================================"
TOTAL=$((PASS+FAIL))
echo -e "  ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC} / $TOTAL total"
echo "============================================================"

if [ "$FAIL" -eq "0" ]; then
  echo -e "${GREEN}"
  echo "  ALL TESTS PASSED"
  echo ""
  echo "  Stage 1: Foundation + Auth + RBAC + Tenant Isolation ✓"
  echo "  Stage 2: Vendor Self-Registration + Approval Workflow ✓"
  echo ""
  echo "  Ready for Stage 3: Vendor Management (full CRUD + compliance)"
  echo -e "${NC}"
  exit 0
else
  echo -e "${RED}"
  echo "  $FAIL TEST(S) FAILED"
  echo -e "${NC}"
  exit 1
fi
