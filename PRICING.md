# SolarProcure — Pricing

## Open Core Model

The platform uses a **Business Source License (BSL 1.1)** open core model:

| Tier | Price | What's included |
|------|-------|----------------|
| **Community** | Free forever | Full core platform, unlimited users, unlimited projects, self-hosted |
| **AI Starter** | ₹4,999/month per tenant | AI Insights (all 8 types), AI Chat, bring-your-own API key |
| **AI Pro** | ₹14,999/month per tenant | Everything in Starter + hosted AI (no API key needed), priority support |
| **Enterprise** | Custom | Multi-tenant SaaS deployment, SLA, dedicated support, custom integrations |

---

## What's Free (Community)

Everything in the core platform, self-hosted:

- ✅ Multi-tenancy (unlimited tenants on your deployment)
- ✅ Vendor self-registration + document upload
- ✅ BOM Engine (Excel import, versioning)
- ✅ RFQ System with secure vendor links
- ✅ Reverse bidding (multi-round auctions)
- ✅ Comparison engine (weighted scoring)
- ✅ Purchase order workflow (multi-level approval)
- ✅ Reports & analytics dashboards
- ✅ Backup & restore
- ✅ Full audit trail
- ✅ Unlimited users, unlimited data

**The only thing not included:** AI prediction and analytics features.

---

## What's Commercial (AI Layer)

The AI Analytics module (`ai.service.js`, `ai.routes.js`, `pages/ai/`) is closed-source and requires a commercial license:

| Feature | Description |
|---------|-------------|
| Spend Forecast | 3-month prediction with confidence intervals |
| Vendor Risk Analysis | Concentration, compliance, performance matrix |
| RFQ Optimization | Participation and bid quality suggestions |
| Price Benchmarking | L1 vs. average, negotiation opportunity |
| PO Anomaly Detection | Unusual patterns, approval bottlenecks |
| Vendor Recommendations | Best-fit by category and score |
| Savings Opportunities | Consolidation, timing, alternative vendor |
| Compliance Risk | Cert expiry alerts |
| AI Chat | Ask questions in plain English |
| Multi-provider support | Claude, GPT, Gemini, Mistral, Cohere, Custom |

---

## Why This Model

1. **Core is free** — EPC companies shouldn't pay to digitize basic procurement
2. **AI is the moat** — intelligence built on top of 18 months of solar procurement data patterns
3. **BYOK (Bring Your Own Key)** — AI Starter lets you use your own API keys → zero AI cost to us
4. **Converts to GPL in 2029** — community can audit and build on even the AI layer eventually

---

## Revenue Projections (Year 1 Target)

| Segment | Tenants | MRR |
|---------|---------|-----|
| AI Starter (₹4,999) | 50 | ₹2.5L |
| AI Pro (₹14,999) | 15 | ₹2.25L |
| Enterprise | 3 | ₹2.4L |
| **Total** | **68** | **₹7.15L/month** |

Target ARR: **₹85L+ (~$1M)**

---

## Commercial Licensing

Contact: [sales@alendei.com](mailto:sales@alendei.com)

Enterprise plans include:
- Managed cloud deployment (AWS/Azure/GCP India regions)
- Custom AI model fine-tuning on your procurement data
- WhatsApp/email notification integration
- Tally/SAP integration
- Dedicated support engineer
- Custom approval workflow design
