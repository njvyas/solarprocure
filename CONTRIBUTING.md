# Contributing to eProcurement

## What you can contribute to

The **base system** (all modules except `backend/src/services/ai.service.js`, `backend/src/routes/ai.routes.js`, `frontend/src/pages/ai/`) is open for contributions.

**AI module PRs will be closed without review.** That code is not open source.

## Development setup

```bash
git clone https://github.com/alendei-group/eprocurement.git
cd eprocurement
cp .env.example .env
# Edit .env with local values

docker compose up -d
# API: http://localhost:4000/api/health
# Frontend: http://localhost:3000
```

## Running tests

```bash
bash scripts/validate_all_stages.sh
```

All 182 assertions must pass before opening a PR.

## Code standards

- No hardcoded UUIDs, IP addresses, or credentials anywhere in source
- All new routes must call `requirePermission(module, action)` 
- Every state-changing route must call `audit.create/update/delete`
- New tables need `tenant_id` FK and an index on it
- New frontend pages need a `ProtectedRoute` wrapper with correct permission

## Commit style

```
feat(vendors): add bulk approval endpoint
fix(rfqs): correct token expiry check
docs(readme): update quick start steps
test(stage-9): add PO rejection flow assertion
```

## Questions

Open a GitHub Discussion or email [opensource@alendei.com](mailto:opensource@alendei.com)
