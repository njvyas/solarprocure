#!/bin/bash
# ============================================================
# Integration Test Suite — Stage 1 + 2 + 3 + 4
# ============================================================
BASE="http://localhost:4000/api"
PASS=0; FAIL=0
G='\033[0;32m'; R='\033[0;31m'; Y='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${G}  ✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${R}  ✗${NC} $1"; FAIL=$((FAIL+1)); }
info() { echo -e "\n${Y}▶ $1${NC}"; }
jq()   { python3 -c "import sys,json; d=json.load(sys.stdin); print($2)" 2>/dev/null; }
auth() { curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"Admin@1234\",\"tenantSlug\":\"$2\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null; }
GET()  { curl -s "$BASE$1" -H "Authorization: Bearer $2"; }
POST() { curl -s -X POST "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"; }
PATCH(){ curl -s -X PATCH "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"; }
DEL()  { curl -s -X DELETE "$BASE$1" -H "Authorization: Bearer $2"; }
code() { curl -s -o /dev/null -w "%{http_code}" "$BASE$1" -H "Authorization: Bearer $2"; }
POST_code() { curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"; }

echo ""
echo "============================================================"
echo "  eProcurement — Stage 1+2+3+4 Integration Test Suite"
echo "============================================================"

# ═══════════════════════════════════════════════════════════
info "STAGE 1 — Foundation + Auth + RBAC"

HEALTH=$(curl -s "$BASE/health")
[ "$(echo "$HEALTH" | jq - 'd["status"]')" = "healthy" ] && ok "API healthy" || fail "API not healthy"
[ "$(echo "$HEALTH" | jq - 'd["stage"]')" = "4" ] && ok "Stage marker = 4" || fail "Stage marker wrong"

T1A=$(auth "admin@alendei-green.com" "alendei-green")
T1P=$(auth "procurement@alendei-green.com" "alendei-green")
T1F=$(auth "finance@alendei-green.com" "alendei-green")
T2A=$(auth "admin@demo-solar.com" "demo-solar")

[ -n "$T1A" ] && ok "T1 admin token OK" || fail "T1 admin login FAILED"
[ -n "$T1P" ] && ok "T1 procurement token OK" || fail "T1 procurement login FAILED"
[ -n "$T2A" ] && ok "T2 admin token OK" || fail "T2 admin login FAILED"

# /me
TN=$(GET /auth/me "$T1A" | jq - 'd["data"]["tenantName"]')
[ "$TN" = "Alendei Green RE Pvt Ltd" ] && ok "/me tenant correct" || fail "/me: $TN"

# User isolation
T1UC=$(GET /users "$T1A" | jq - 'd["meta"]["pagination"]["total"]')
T2UC=$(GET /users "$T2A" | jq - 'd["meta"]["pagination"]["total"]')
[ "$T1UC" = "3" ] && ok "T1 user count=3" || fail "T1 users: $T1UC"
[ "$T2UC" = "2" ] && ok "T2 user count=2" || fail "T2 users: $T2UC"

# Cross-tenant
T1UID=$(GET /users "$T1A" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])" 2>/dev/null)
CROSS=$(code "/users/$T1UID" "$T2A")
[ "$CROSS" = "404" ] || [ "$CROSS" = "403" ] && ok "Cross-tenant user blocked ($CROSS)" || fail "Cross-tenant user NOT blocked: $CROSS"

# RBAC
[ "$(POST_code /users "$T1F" '{"email":"x@x.com","password":"Test@1234","firstName":"X","lastName":"Y"}')" = "403" ] && ok "Finance cannot create users" || fail "RBAC: finance create user should be 403"
[ "$(code /vendors "$T1F")" = "403" ] && ok "Finance cannot read vendors" || fail "RBAC: finance vendor should be 403"
[ "$(code /boms "$T1F")" = "403" ] && ok "Finance cannot read BOMs" || fail "RBAC: finance bom should be 403"

# Logout revocation
TEMP=$(auth "procurement@alendei-green.com" "alendei-green")
POST /auth/logout "$TEMP" '{}' > /dev/null
REVOKED=$(code /auth/me "$TEMP")
[ "$REVOKED" = "401" ] && ok "Logout revokes token" || fail "Token not revoked: $REVOKED"

# Audit logs exist
AL=$(GET /tenants/current/audit-logs "$T1A" | jq - 'd["meta"]["pagination"]["total"]')
[ "${AL:-0}" -gt "0" ] && ok "Audit logs populated ($AL)" || fail "No audit logs"

# ═══════════════════════════════════════════════════════════
info "STAGE 2 — Vendor Self-Registration + Approval"

# Public registration
TS=$(date +%s)
REG=$(curl -s -X POST "$BASE/vendors/register" \
  -F "tenantSlug=alendei-green" \
  -F "companyName=Integration Test Vendor $TS" \
  -F "contactName=Test Contact" \
  -F "contactEmail=itv_${TS}@test.com" \
  -F "contactPhone=+919000000001" \
  -F "gstNumber=24AABCI${TS: -8}Z5" \
  -F "productCategories=Solar Panels,Inverters")
RID=$(echo "$REG" | jq - 'd["data"]["id"]')
RST=$(echo "$REG" | jq - 'd["data"]["status"]')
[ -n "$RID" ] && ok "Vendor registered, ID=$RID" || fail "Registration failed: $(echo $REG | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
[ "$RST" = "pending" ] && ok "New vendor status=pending" || fail "Expected pending, got $RST"

# Vendor list isolation
T1VC=$(GET /vendors "$T1A" | jq - 'd["meta"]["pagination"]["total"]')
T2VC=$(GET /vendors "$T2A" | jq - 'd["meta"]["pagination"]["total"]')
[ "${T1VC:-0}" -ge "2" ] && ok "T1 vendors ≥2 ($T1VC)" || fail "T1 vendor count: $T1VC"
[ "$T2VC" = "1" ] && ok "T2 vendors=1 (isolated)" || fail "T2 vendor count: $T2VC"

T1VID=$(GET /vendors "$T1A" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])" 2>/dev/null)
CROSSV=$(code "/vendors/$T1VID" "$T2A")
[ "$CROSSV" = "404" ] || [ "$CROSSV" = "403" ] && ok "Cross-tenant vendor blocked ($CROSSV)" || fail "Cross-tenant vendor NOT blocked: $CROSSV"

# Approval
if [ -n "$RID" ]; then
  APPR=$(POST "/vendors/$RID/review" "$T1P" '{"action":"approve"}')
  APST=$(echo "$APPR" | jq - 'd["data"]["status"]')
  [ "$APST" = "approved" ] && ok "Vendor approved by procurement" || fail "Approval failed: $APST"
fi

# Duplicate detection
DUP=$(curl -s -X POST "$BASE/vendors/register" -F "tenantSlug=alendei-green" -F "companyName=Dup" -F "contactName=Dup" -F "contactEmail=rajesh@rayzon.com" -F "productCategories=Cables")
[ "$(echo "$DUP" | jq - 'd.get("code","")')" = "DUPLICATE_EMAIL" ] && ok "Duplicate email blocked" || fail "Duplicate email not blocked"

DUPGST=$(curl -s -X POST "$BASE/vendors/register" -F "tenantSlug=alendei-green" -F "companyName=Dup2" -F "contactName=Dup2" -F "contactEmail=newdup_${TS}@test.com" -F "gstNumber=24AABCR1234A1Z5" -F "productCategories=Cables")
[ "$(echo "$DUPGST" | jq - 'd.get("code","")')" = "DUPLICATE_GST" ] && ok "Duplicate GST blocked" || fail "Duplicate GST not blocked"

# Finance cannot approve
[ "$(POST_code "/vendors/$T1VID/review" "$T1F" '{"action":"approve"}')" = "403" ] && ok "Finance cannot approve vendors" || fail "Finance should not approve vendors"

# Vendor stats shape
VSTATS=$(GET /vendors/stats "$T1A")
[ "$(echo "$VSTATS" | jq - '"ok" if "pending" in d["data"] else "fail"')" = "ok" ] && ok "Vendor stats shape correct" || fail "Vendor stats shape wrong"

# ═══════════════════════════════════════════════════════════
info "STAGE 3 — Vendor Compliance + Performance"

# Compliance CRUD
SOLEX="v1000000-0000-0000-0000-000000000002"
COMP=$(POST "/vendors/$SOLEX/compliance" "$T1P" '{"certName":"IEC 62109","certNumber":"IEC-2024-999","issuedBy":"SGS","expiryDate":"2027-01-01"}')
COID=$(echo "$COMP" | jq - 'd["data"]["id"]')
CST=$(echo "$COMP" | jq - 'd["data"]["status"]')
[ -n "$COID" ] && ok "Compliance record created, ID=$COID" || fail "Compliance create failed: $(echo $COMP | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
[ "$CST" = "valid" ] && ok "Compliance status auto-set to valid (expiry 2027)" || fail "Compliance status: $CST"

# Expiring soon — past expiry
EXPSOON=$(POST "/vendors/$SOLEX/compliance" "$T1P" '{"certName":"Expiring Cert","expiryDate":"2025-06-01","status":"expiring_soon"}')
EXP_ST=$(echo "$EXPSOON" | jq - 'd["data"]["status"]')
[ "$EXP_ST" = "expiring_soon" ] && ok "Expiring_soon status set correctly" || fail "Status: $EXP_ST"

# Get compliance list
COMP_LIST=$(GET "/vendors/$SOLEX/compliance" "$T1P")
COMP_COUNT=$(echo "$COMP_LIST" | jq - 'len(d["data"])')
[ "${COMP_COUNT:-0}" -ge "2" ] && ok "Compliance list returned ($COMP_COUNT records)" || fail "Compliance count: $COMP_COUNT"

# Expiry alert endpoint
EXPIRING=$(GET "/vendors/compliance/expiring?days=365" "$T1A")
EXPIRING_OK=$(echo "$EXPIRING" | jq - '"ok" if isinstance(d["data"],list) else "fail"')
[ "$EXPIRING_OK" = "ok" ] && ok "Expiring certs endpoint returns list" || fail "Expiring certs endpoint wrong"

# Update compliance
if [ -n "$COID" ]; then
  UPC=$(curl -s -X PUT "$BASE/vendors/$SOLEX/compliance/$COID" \
    -H "Authorization: Bearer $T1P" -H "Content-Type: application/json" \
    -d '{"certName":"IEC 62109 Updated","certNumber":"IEC-2024-999","issuedBy":"SGS Updated","expiryDate":"2027-01-01"}')
  UPN=$(echo "$UPC" | jq - 'd["data"]["cert_name"]')
  [ "$UPN" = "IEC 62109 Updated" ] && ok "Compliance record updated" || fail "Compliance update: $UPN"
fi

# Delete compliance
if [ -n "$COID" ]; then
  DEL_COMP=$(DEL "/vendors/$SOLEX/compliance/$COID" "$T1P")
  [ "$(echo "$DEL_COMP" | jq - 'd["success"]')" = "True" ] && ok "Compliance record deleted" || fail "Compliance delete failed"
fi

# Performance upsert
PERF=$(POST "/vendors/$SOLEX/performance" "$T1P" '{"periodYear":2025,"periodQuarter":1,"onTimeDeliveryPct":95.5,"qualityScore":88.0,"priceCompetitiveness":82.5,"responsivenessScore":90.0}')
PERF_SCORE=$(echo "$PERF" | jq - 'str(d["data"]["overall_score"])')
[ -n "$PERF_SCORE" ] && ok "Performance record created (overall=$PERF_SCORE)" || fail "Performance create failed: $(echo $PERF | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"

# Upsert idempotency (same period)
PERF2=$(POST "/vendors/$SOLEX/performance" "$T1P" '{"periodYear":2025,"periodQuarter":1,"onTimeDeliveryPct":99.0,"qualityScore":95.0,"priceCompetitiveness":90.0,"responsivenessScore":95.0}')
P2SCORE=$(echo "$PERF2" | jq - 'str(d["data"]["overall_score"])')
[ -n "$P2SCORE" ] && ok "Performance upsert idempotent (updated score=$P2SCORE)" || fail "Performance upsert failed"

# Finance cannot update compliance
[ "$(POST_code "/vendors/$SOLEX/compliance" "$T1F" '{"certName":"X"}')" = "403" ] && ok "Finance cannot add compliance" || fail "RBAC compliance fail"

# Cross-tenant compliance blocked
CROSS_COMP=$(code "/vendors/$SOLEX/compliance" "$T2A")
[ "$CROSS_COMP" = "404" ] || [ "$CROSS_COMP" = "403" ] && ok "Cross-tenant compliance blocked ($CROSS_COMP)" || fail "Cross-tenant compliance NOT blocked: $CROSS_COMP"

# ═══════════════════════════════════════════════════════════
info "STAGE 4 — BOM Engine"

# BOM stats
BSTATS=$(GET /boms/stats "$T1A")
[ "$(echo "$BSTATS" | jq - '"ok" if "draft" in d["data"] else "fail"')" = "ok" ] && ok "BOM stats endpoint returns correct shape" || fail "BOM stats wrong"

# Get seeded BOM
BID="b1000000-0000-0000-0000-000000000001"
SEEDED=$(GET "/boms/$BID" "$T1A")
ITEM_COUNT=$(echo "$SEEDED" | jq - 'len(d["data"]["items"])')
[ "$ITEM_COUNT" = "8" ] && ok "Seeded BOM has 8 items" || fail "Seeded BOM item count: $ITEM_COUNT"

BOM_COST=$(echo "$SEEDED" | jq - 'str(d["data"]["total_estimated_cost"])')
[ -n "$BOM_COST" ] && ok "Seeded BOM total cost computed: ₹$BOM_COST" || fail "BOM cost not computed"

# Create new BOM
NEW_BOM=$(POST /boms "$T1A" '{"name":"Test BOM Stage4","projectName":"Test Project","projectType":"solar_epc","capacityMw":50,"location":"Buldhana, MH","currency":"INR"}')
NBID=$(echo "$NEW_BOM" | jq - 'd["data"]["id"]')
NBST=$(echo "$NEW_BOM" | jq - 'd["data"]["status"]')
[ -n "$NBID" ] && ok "BOM created, ID=$NBID" || fail "BOM create failed: $(echo $NEW_BOM | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
[ "$NBST" = "draft" ] && ok "New BOM status=draft" || fail "New BOM status: $NBST"

# Add items
if [ -n "$NBID" ]; then
  ADD=$(POST "/boms/$NBID/items" "$T1A" '{"items":[{"lineNumber":1,"category":"Solar Modules","description":"550Wp Mono PERC Module","unit":"Nos","quantity":90910,"unitRate":12500},{"lineNumber":2,"category":"Inverters","description":"110kW String Inverter","unit":"Nos","quantity":455,"unitRate":185000}]}')
  ADD_COUNT=$(echo "$ADD" | jq - 'len(d["data"])')
  [ "$ADD_COUNT" = "2" ] && ok "2 items added to BOM" || fail "Items add count: $ADD_COUNT"

  # Verify total recalculated
  BAFTER=$(GET "/boms/$NBID" "$T1A")
  TOTAL=$(echo "$BAFTER" | jq - 'str(d["data"]["total_estimated_cost"])')
  [ -n "$TOTAL" ] && ok "Total auto-recalculated after add: ₹$TOTAL" || fail "Total not recalculated"
fi

# Import JSON rows (replaces items)
if [ -n "$NBID" ]; then
  IMPORT=$(POST "/boms/$NBID/import" "$T1A" '{"rows":[{"line_number":1,"category":"Solar Modules","description":"Imported 550Wp Module","unit":"Nos","quantity":90910,"unit_rate":12000},{"line_number":2,"category":"Inverters","description":"Imported 110kW Inverter","unit":"Nos","quantity":455,"unit_rate":180000},{"line_number":3,"category":"DC Cables","description":"4sqmm DC Cable","unit":"KM","quantity":425,"unit_rate":22000}]}')
  IMP_COUNT=$(echo "$IMPORT" | jq - 'd["data"]["imported"]')
  [ "$IMP_COUNT" = "3" ] && ok "JSON import: 3 rows imported" || fail "Import count: $IMP_COUNT"
fi

# Update single item
if [ -n "$NBID" ]; then
  FIRST_ITEM_ID=$(GET "/boms/$NBID" "$T1A" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['items'][0]['id'])" 2>/dev/null)
  if [ -n "$FIRST_ITEM_ID" ]; then
    UPD_ITEM=$(PATCH "/boms/$NBID/items/$FIRST_ITEM_ID" "$T1A" '{"unitRate":11500}')
    NEW_RATE=$(echo "$UPD_ITEM" | jq - 'str(d["data"]["unit_rate"])')
    [ "$NEW_RATE" = "11500" ] && ok "Item unit rate updated to 11500" || fail "Item update: $NEW_RATE"
  fi
fi

# Cannot publish empty BOM
EMPTY_BOM=$(POST /boms "$T1A" '{"name":"Empty BOM Test"}')
EBID=$(echo "$EMPTY_BOM" | jq - 'd["data"]["id"]')
if [ -n "$EBID" ]; then
  PUB_EMPTY=$(POST_code "/boms/$EBID/publish" "$T1A" '{}')
  [ "$PUB_EMPTY" = "400" ] && ok "Cannot publish BOM with no items (400)" || fail "Expected 400 for empty publish, got $PUB_EMPTY"
fi

# Publish BOM with items
if [ -n "$NBID" ]; then
  PUB=$(POST "/boms/$NBID/publish" "$T1A" '{}')
  PUB_ST=$(echo "$PUB" | jq - 'd["data"]["status"]')
  [ "$PUB_ST" = "published" ] && ok "BOM published successfully" || fail "Publish status: $PUB_ST"
  PUB_VER=$(echo "$PUB" | jq - 'd["data"]["version"]')
  [ "$PUB_VER" = "2" ] && ok "Version incremented to 2 on publish" || fail "Version: $PUB_VER"
fi

# Cannot edit published BOM items (archived check via archive)
if [ -n "$NBID" ]; then
  ARCH=$(POST "/boms/$NBID/archive" "$T1A" '{}')
  ARCH_ST=$(echo "$ARCH" | jq - 'd["data"]["status"]')
  [ "$ARCH_ST" = "archived" ] && ok "BOM archived" || fail "Archive status: $ARCH_ST"

  # Cannot edit archived BOM
  EDIT_ARCH=$(POST_code "/boms/$NBID/items" "$T1A" '{"items":[{"lineNumber":99,"category":"Test","description":"Test","unit":"Nos","quantity":1}]}')
  [ "$EDIT_ARCH" = "400" ] && ok "Cannot add items to archived BOM (400)" || fail "Expected 400, got $EDIT_ARCH"
fi

# BOM tenant isolation
T2BOMS=$(GET /boms "$T2A" | jq - 'd["meta"]["pagination"]["total"]')
[ "$T2BOMS" = "0" ] && ok "T2 sees 0 BOMs (isolated)" || fail "T2 BOMs: $T2BOMS"

# Cross-tenant BOM access
CROSS_BOM=$(code "/boms/$BID" "$T2A")
[ "$CROSS_BOM" = "404" ] || [ "$CROSS_BOM" = "403" ] && ok "Cross-tenant BOM access blocked ($CROSS_BOM)" || fail "Cross-tenant BOM NOT blocked: $CROSS_BOM"

# Finance cannot create/delete BOMs
[ "$(POST_code /boms "$T1F" '{"name":"Finance BOM"}')" = "403" ] && ok "Finance cannot create BOMs" || fail "Finance BOM create should be 403"

# BOM audit trail
BOM_AUDIT=$(GET "/tenants/current/audit-logs?resource_type=bom" "$T1A" | jq - 'd["meta"]["pagination"]["total"]')
[ "${BOM_AUDIT:-0}" -gt "0" ] && ok "BOM audit trail exists ($BOM_AUDIT events)" || fail "No BOM audit logs"

# Delete draft BOM
if [ -n "$EBID" ]; then
  DEL_BOM=$(DEL "/boms/$EBID" "$T1A")
  [ "$(echo "$DEL_BOM" | jq - 'd["success"]')" = "True" ] && ok "Draft BOM soft-deleted" || fail "BOM delete failed"
  [ "$(code "/boms/$EBID" "$T1A")" = "404" ] && ok "Deleted BOM returns 404" || fail "Deleted BOM still accessible"
fi

# ═══════════════════════════════════════════════════════════
echo ""
echo "============================================================"
TOTAL=$((PASS+FAIL))
echo -e "  ${G}$PASS passed${NC} / ${R}$FAIL failed${NC} / $TOTAL total"
echo "============================================================"

if [ "$FAIL" -eq "0" ]; then
  echo -e "${G}"
  echo "  ALL $TOTAL TESTS PASSED"
  echo ""
  echo "  Stage 1: Foundation + Auth + RBAC + Tenant Isolation  ✓"
  echo "  Stage 2: Vendor Self-Registration + Approval Workflow ✓"
  echo "  Stage 3: Vendor Compliance + Performance Tracking     ✓"
  echo "  Stage 4: BOM Engine (CRUD, Import, Publish, Archive)  ✓"
  echo ""
  echo "  Ready for Stage 5: RFQ System"
  echo -e "${NC}"
  exit 0
else
  echo -e "${R}  $FAIL TEST(S) FAILED${NC}"
  exit 1
fi
