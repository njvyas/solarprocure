# SolarProcure — Monetization Strategy

## Model: Open Core + BSL

### The Framework

```
Open Source Core (BSL 1.1)
├── Free forever, self-hosted
├── All 11 procurement modules
├── Unlimited users + tenants
└── Community support only

Commercial AI Layer (Closed Source)
├── 8 AI insight types
├── Conversational procurement chat
├── Multi-provider API key management
└── Converts to GPL in 2029 (BSL change date)
```

---

## Revenue Streams

### 1. AI Analytics SaaS (Primary — ₹4,999–₹14,999/tenant/month)

**Why this works:**
- Open source users already have data flowing through the system
- AI sits on top of real procurement data = genuinely useful, not generic
- BYOK (Bring Your Own Key) model = near-zero AI API costs on Starter
- Sticky: once you're running insights, you don't want to stop

**Tiers:**
| Plan | Price | Target |
|------|-------|--------|
| AI Starter | ₹4,999/month | 5–50 MW/year EPC companies |
| AI Pro | ₹14,999/month | 50–500 MW/year companies |
| Enterprise AI | Custom | >500 MW or multi-entity groups |

**Conversion funnel:**
1. Company deploys open source (free)
2. After 30–60 days, has real data
3. Trial AI layer (14-day free trial)
4. Converts on spend forecast or vendor risk insight

---

### 2. Managed Hosting (Secondary — ₹9,999–₹49,999/month)

Many EPC companies don't have DevOps capability.

| Plan | Price | What's included |
|------|-------|----------------|
| Hosted Community | ₹9,999/month | Managed server, backups, SSL, updates |
| Hosted Pro | ₹24,999/month | + AI Starter, monitoring, email support |
| Hosted Enterprise | ₹49,999/month | + AI Pro, SLA 99.9%, phone support |

**Infrastructure cost per tenant:** ~₹2,000–₹4,000/month (cloud)
**Gross margin:** 70–80%

---

### 3. Implementation Services (One-time + Recurring)

| Service | Price |
|---------|-------|
| Standard setup (import vendors, BOM, first RFQ) | ₹50,000 |
| Data migration (from Excel/ERP) | ₹75,000–₹1,50,000 |
| Custom workflow design | ₹1,00,000–₹3,00,000 |
| Training (2-day on-site) | ₹40,000/day |
| Annual AMC (managed updates) | 15% of license/year |

---

### 4. Integration Marketplace (Future — Year 2)

| Integration | Revenue model |
|------------|---------------|
| Tally/SAP/Busy ERP | One-time ₹1,50,000 setup + ₹5,000/month |
| WhatsApp Business notifications | ₹2,000/month |
| Indian e-Invoice (IRP API) | ₹3,000/month |
| GeM (Government e-Marketplace) portal sync | ₹10,000/month |
| MSME registration validation | ₹1,000/month |

---

## GTM Strategy

### Phase 1 (Months 1–3): GitHub credibility
- Ship to GitHub, build star count
- Post in r/solarprocure, LinkedIn solar groups
- Write: "How we replaced Excel procurement for 100MW projects"
- Target: 500 GitHub stars, 50 self-hosted deployments

### Phase 2 (Months 4–6): First paying customers
- Partner with 2–3 solar consultants (referral 15%)
- Target: 10 AI Starter customers = ₹50K MRR
- Case study: "Saved ₹40L on Rajasthan project using vendor risk AI"

### Phase 3 (Months 7–12): Channel growth
- Whitelist for MNRE empaneled EPCs (free hosted plan)
- Channel partners: CA firms handling solar project finances
- Government tenders: SECI, NTPC, REWA — open source + support contract
- Target: ₹7L MRR

### Phase 4 (Year 2): International
- Bangladesh, Sri Lanka, Southeast Asia solar boom
- UAE/Saudi renewable push
- MENA version with Arabic RTL (community PR)

---

## Competitive Positioning

| Competitor | Their weakness | Our answer |
|-----------|---------------|------------|
| SAP Ariba | ₹10L+ setup cost, 12-month deployment | Live in 5 minutes, free |
| IndiaMART/TradeIndia | No procurement workflow | Full RFQ→PO→approval |
| Custom Excel | No audit trail, no reverse bidding | Full digital + AI |
| Generic SaaS ERPs | Not solar-specific | Solar BOM templates, IEC cert tracking |

---

## Why BSL, not MIT?

1. **Prevents AWS/Azure hosting without contributing back** — until 2029
2. **Protects the AI moat** — the thing that generates revenue stays closed
3. **Still fully open source-compatible** — 4-year change date satisfies most community needs
4. **Precedent:** Hashicorp (Terraform), Elastic, MongoDB all used similar approaches

The AGPL alternative was considered but too restrictive for Indian enterprise procurement buyers who need air-gapped deployments.

---

## Financial Model (Year 1)

| Month | Events | MRR |
|-------|--------|-----|
| M1 | GitHub launch, 50 stars | ₹0 |
| M2 | First 3 paying AI Starter | ₹15K |
| M3 | 10 AI Starter | ₹50K |
| M6 | 30 Starter + 5 Pro | ₹2.25L |
| M9 | 50 Starter + 12 Pro + 1 Enterprise | ₹4.8L |
| M12 | 80 Starter + 20 Pro + 3 Enterprise | ₹8.2L |

**Break-even:** Month 5 (assumes 2 founders, no office)

**Year 1 ARR target: ₹85L (~$100K)**
