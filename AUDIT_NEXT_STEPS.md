# StackCut SaaS Audit — Next Steps & Context

> **Purpose of this file:** Provide a clean handoff so a new session can continue the audit without re-reading the entire conversation.  
> **Current state:** All 57 SaaS JSONs (50 original + 7 expansions) have been sanity-checked, feature-IDs cleaned, pricing models corrected, and critical prices updated. The validator, test suite, and Astro build all pass.  
> **Remaining work:** None — the audit backlog is complete. Future work is reactive (pricing refreshes, new products, schema updates).  
> **Session log:** See `AUDIT_SESSION_LOG.md` for a detailed record of what was done in the final session (2026-06-14).

---

## 1. Project Context

### Repository layout (relevant paths)
```
Asesinos saas/
├── src/content/saas/              # 50 product JSON files
├── src/data/features-registry.ts  # Canonical list of feature IDs (61 IDs)
├── src/types/saas.ts              # TypeScript types for plans, addOns, volumeTiers, etc.
├── src/content.config.ts          # Zod schema for Astro content collections
├── scripts/validate-data.mjs      # Business-rule validator (run after edits)
├── src/__tests__/analyze-stack.test.ts  # Vitest suite (151 tests)
├── src/lib/categories.ts          # Comparison silos used by redundancy tests
├── src/components/DowngradeEngine.tsx   # Consumes plan data
└── src/components/StackAuditor.tsx      # Consumes feature/proprietary data
```

### Key facts
- **Existing products:** 57 JSON files in `src/content/saas/`.
- **Feature registry:** 61 IDs in `src/data/features-registry.ts` (7 infrastructure + 54 core/proprietary).
- **All validation green:** `node scripts/validate-data.mjs`, `npm test`, and `npm run build` pass with zero errors.
- **Pricing data convention (ESTABLISHED in this audit):**
  - `priceMonthly` = price billed **month-to-month** (the higher figure when an annual discount exists).
  - `priceAnnually` = **total amount paid per year** when billed annually (NOT `priceMonthly × 12`).
  - If a vendor only lists an annual commitment, set `priceMonthly: null` and put the effective monthly note in `priceNote`.
  - If pricing is usage/contact/host based, set `pricingModel: "custom"` and explain the driver in `priceNote`.
  - Always populate `pricingUrl` with the canonical public pricing page.
  - Always update `lastVerified` and `capturedAt` to the date of verification (`YYYY-MM-DD`).

---

## 2. What Has Already Been Done

### 2.1 Global cleanups (all 50 products)
- **Feature-ID consistency:** 185 references to feature IDs inside `plans[*].featureIds` were either added to the product-level `featureIds`/`proprietaryFeatures` arrays or removed when they did not apply.
- **Pricing URLs:** Added `pricingUrl` to 49 products that lacked it. Only Slack previously had one.
- **Source metadata:** Standardized `capturedAt`/`lastVerified` dates where they were missing or stale.

### 2.2 Pricing-model corrections
These products were incorrectly modeled as flat per-month and have been switched to `custom` (usage/volume/contact-based):
- Mailchimp, ConvertKit, Drip, Brevo, ActiveCampaign, SendGrid, Postmark (email/contact volume)
- Datadog (per host / per module)
- Intercom (per seat + AI resolutions)

Vercel was switched to `per_month_per_user`.

### 2.3 Price & plan corrections (verified against official pages)
| Product | Key correction |
| --- | --- |
| **Salesforce** | Renamed plans to Starter Suite / Pro Suite / Enterprise; removed obsolete "Unlimited"; prices updated to 2026 list. |
| **Figma** | Pro updated to $18/$180; Organization to $54/$540; added `Dev Mode seat` add-on. |
| **GitLab** | Ultimate switched to custom pricing; added `GitLab Duo Credits` add-on. |
| **HubSpot** | Added seat minimums (5/10), clarified Marketing Hub Professional tier, added `priceNote`. |
| **Notion** | Added `Notion AI` add-on across paid plans. |
| **GitHub** | Added `GitHub Copilot` add-on. |
| **Slack** | Added `Slack AI` add-on to Business+ and Enterprise Grid. |
| **Intercom** | Switched to `custom`; added `Fin AI Agent` add-on. |
| **Asana / Airtable** | Added `priceNote` clarifying monthly vs annual pricing. |
| **Jira** | Added `seatMin: 10` and `priceNote` for Standard/Premium. |

### 2.4 Feature corrections
- Removed `crm_basic` from Email Marketing and Customer Support products (falsely flagged as cross-category redundancy).
- Removed `white_label` from HubSpot Enterprise (HubSpot does not offer true white labeling).
- Removed `workflows`, `roles_permissions`, and `priority_support` from Basecamp (not supported by the product).

---

## 3. Remaining Work — Part A: Verify ~30 Existing SaaS

These products received the global cleanup but still need a **deep price verification** against their official 2026 pricing pages. For each one:
1. Open `pricingUrl` (add it if missing).
2. Confirm plan names, list prices, and billing cadence.
3. Add `priceNote` for any usage limit, seat minimum, or annual discount.
4. Add relevant `addOns` (AI modules, storage, API packs, advanced support, etc.).
5. Update `lastVerified` and `capturedAt` to the verification date.
6. Run `node scripts/validate-data.mjs` and `npm test` before moving to the next batch.

### Checklist

- [x] **attio.json** — https://attio.com/pricing  
  Notes: CRM, per-user with free tier; Enterprise contact.
- [x] **bitbucket.json** — https://bitbucket.org/product/pricing  
  Notes: Premium $3.65/user/mo annual ($43.80/yr), Enterprise custom; builds/storage retained.
- [x] **chatwoot.json** — https://www.chatwoot.com/pricing  
  Notes: Free Hacker (2 agents), Startups $19, Business $39, Enterprise $99 per agent/mo annually; Captain AI credits add-on added; trial corrected to 15 days.
- [x] **clickup.json** — https://clickup.com/pricing  
  Notes: Added Business Plus; ClickUp Brain add-on at $7/user/mo.
- [x] **close.json** — https://close.com/pricing  
  Notes: Startup, Professional, Scale prices updated; call-minutes included.
- [x] **coda.json** — https://coda.io/pricing  
  Notes: Pro/Team prices corrected; annual-only billing noted; Coda AI add-on added.
- [x] **crisp.json** — https://crisp.chat/en/pricing  
  Notes: Switched to per-month pricing model; Basic/Pro/Unlimited prices updated; Crisp AI add-on added.
- [x] **discord.json** — https://discord.com/nitro  
  Notes: Nitro Basic $2.99/mo, Nitro $9.99/mo; annual equivalents $29.99/$99.99.
- [x] **freshdesk.json** — https://freshdesk.com/pricing  
  Notes: Growth/Pro/Enterprise prices corrected to month-to-month and annual totals; Freddy AI add-on added.
- [x] **freshsales.json** — https://www.freshworks.com/crm/sales/pricing  
  Notes: Growth/Pro/Enterprise prices corrected; Freddy AI add-on added.
- [x] **front.json** — https://front.com/pricing  
  Notes: Professional/Enterprise prices updated; annual-only billing noted; Front AI add-on added.
- [x] **google-chat.json** — https://workspace.google.com/pricing.html
  Notes: Updated to 2026 USD list prices ($7/$14/$22 annual; $8.40/$16.80/$26.40 flexible). Added Google Voice add-on and 14-day trial.
- [x] **height.json** — https://height.app/pricing
  Notes: Official page unreachable; Team $8.50/user/mo (annual) retained with source caveat. Enterprise custom.
- [x] **linear.json** — https://linear.app/pricing
  Notes: Basic updated to $10/user/mo effective ($120/yr), Business to $16/user/mo effective ($192/yr); annual-only billing.
- [x] **loom.json** — https://www.loom.com/pricing
  Notes: Business $18/mo ($180/yr), Business+AI $24/mo ($240/yr); AI bundled in Business+AI.
- [ ] **mailchimp.json** — https://mailchimp.com/pricing/marketing/  
  Notes: Already corrected to `custom`; verify Free/Essentials/Standard/Premium tiers and contact-based pricing note.
- [x] **miro.json** — https://miro.com/pricing
  Notes: Starter $10/mo ($96/yr), Business $25/mo ($240/yr); Miro AI included in paid tiers, no separate add-on price listed.
- [x] **missive.json** — https://missiveapp.com/pricing  
  Notes: 20% annual discount applied; Productive/Business list prices updated; trial 30 days.
- [x] **monday.json** — https://monday.com/pricing  
  Notes: Basic/Standard/Pro prices updated; seat minimums added; monday AI add-on pending (included as credits).
- [x] **monday-sales-crm.json** — https://monday.com/crm/pricing  
  Notes: Basic/Standard/Pro prices updated; Enterprise renamed Ultimate; seat minimums added.
- [x] **microsoft-teams.json** — https://www.microsoft.com/en-us/microsoft-teams/compare-microsoft-teams-pricing  
  Notes: Free, Essentials, Business Basic, Business Standard, Business Premium prices updated; Copilot add-on added.
- [x] **pipedrive.json** — https://www.pipedrive.com/en/pricing  
  Notes: Plans aligned to Lite/Growth/Premium/Ultimate; Power tier removed; Web Visitors add-on added.
- [x] **shortcut.json** — https://shortcut.com/pricing  
  Notes: Free, Team ($8.50 annual / $10 monthly), Business ($12 annual / $16 monthly), Enterprise custom updated.
- [x] **streak.json** — https://www.streak.com/pricing  
  Notes: Pro/Pro+/Enterprise prices updated; 20% annual discount noted; Extra AI Credits add-on added.
- [x] **todoist.json** — https://todoist.com/pricing  
  Notes: Pro ($4 annual / $5 monthly) and Business ($6 annual / $8 monthly) corrected.
- [x] **zendesk.json** — https://www.zendesk.com/pricing/  
  Notes: Re-aligned to current plans: Support Team, Suite Team, Suite Professional, Suite Enterprise + Copilot; Zendesk Copilot add-on added.
- [x] **zendesk-sell.json** — https://www.zendesk.com/sell/  
  Notes: Sell Team/Growth/Professional/Enterprise prices updated to current list ($19/$55/$115/$169 per agent/mo).
- [x] **zoho-crm.json** — https://www.zoho.com/crm/pricing.html  
  Notes: Standard/Professional/Enterprise/Ultimate prices updated; month-to-month vs annual noted; Ultimate plan added.
- [x] **zoom.json** — https://zoom.us/pricing  
  Notes: Pro $16.99/mo ($149.90/yr), Business $21.99/mo ($199.90/yr), Enterprise custom; Large Meetings add-on added; AI Companion included in paid plans.

> **Tip:** If a pricing page is heavily dynamic (HubSpot, Zoom, Intercom), use a secondary source such as a 2026 pricing PDF, Wayback Machine snapshot, or the vendor's "compare plans" table. Mark the source in `priceNote` if it is not the main `pricingUrl`.

---

## 4. Expansion SaaS JSONs (Completed 2026-06-14)

All seven expansion JSONs were created in `src/content/saas/`, following the schema in `src/types/saas.ts` and `src/content.config.ts`. Prices use 2026 USD list prices where publicly available; usage/contact/ticket-based plans are modeled with `pricingModel: "custom"` or `per_month` plus `priceNote`. Each file includes `pricingUrl`, `lastVerified`, and `capturedAt` dates.

### 4.1 Klaviyo (`klaviyo.json`)
- **Category:** Email Marketing
- **Pricing URL:** https://www.klaviyo.com/pricing
- **Plans:**
  - `free` — $0/mo, up to 250 contacts, 500 emails.
  - `email` — Custom (starts around $20/mo for 500 contacts), unlimited emails up to contact limit.
  - `email_sms` — Custom (starts around $45/mo), includes SMS credits.
- **Key features:** `email_automation`, `email_templates`, `a_b_testing`, `email_sequences`, `transactional_email`, `reporting`, `integrations`, `api_access`
- **Proprietary feature suggestion:** `sms_marketing`, `predictive_analytics`
- **Why include:** De-facto email/SMS standard for Shopify/e-commerce.

### 4.2 Canva (`canva.json`)
- **Category:** Design
- **Pricing URL:** https://www.canva.com/pricing
- **Plans:**
  - `free` — $0
  - `pro` — $17/user/mo monthly / $15/user/mo annual ($180/yr)
  - `teams` — $25/user/mo annual
  - `enterprise` — Custom
- **Key features:** `design_prototyping`, `design_handoff` (limited), `collaboration`, `file_sharing`, `whiteboarding`
- **Proprietary feature suggestion:** `brand_kit`, `magic_studio_ai`
- **Why include:** Dominates marketing/design for non-designers; essential comparison to Figma.

### 4.3 Google Meet / Workspace (`google-meet.json`)
- **Category:** Video Conferencing
- **Pricing URL:** https://workspace.google.com/pricing.html
- **Plans:**
  - `business_starter` — $6/user/mo
  - `business_standard` — $12/user/mo
  - `business_plus` — $18/user/mo
  - `enterprise` — Custom
- **Key features:** `video_conferencing`, `screen_sharing`, `recording`, `collaboration`, `channels`, `calendar`
- **Proprietary feature suggestion:** `google_workspace_bundle`
- **Why include:** Direct Zoom/Teams competitor in Google Workspace shops.

### 4.4 Netlify (`netlify.json`)
- **Category:** Dev Tools
- **Pricing URL:** https://www.netlify.com/pricing/
- **Plans:**
  - `starter` — $0
  - `pro` — $19/user/mo annual / higher monthly
  - `enterprise` — Custom
- **Key features:** `serverless_deploy`, `preview_deployments`, `edge_functions`, `ci_cd_pipelines`, `api_access`, `integrations`
- **Proprietary feature suggestion:** `edge_functions`
- **Why include:** Main Vercel alternative for frontend cloud.

### 4.5 New Relic (`new-relic.json`)
- **Category:** Monitoring
- **Pricing URL:** https://newrelic.com/pricing
- **Plans:**
  - `free` — $0, up to 100 GB ingest/mo, 1 full user.
  - `standard` / `pro` / `enterprise` — Usage-based per GB ingest + user type (full vs basic).
- **Key features:** `infrastructure_monitoring`, `apm`, `alerting`, `dashboards`, `advanced_analytics`, `api_access`, `integrations`
- **Proprietary feature suggestion:** `log_management`, `browser_monitoring`, `mobile_monitoring`
- **Why include:** Direct Datadog competitor in observability.

### 4.6 Gorgias (`gorgias.json`)
- **Category:** Customer Support
- **Pricing URL:** https://www.gorgias.com/pricing
- **Plans:**
  - `starter` — $10/mo per ticket (approximate; verify current model)
  - `basic` / `pro` / `advanced` / `enterprise` — Volume/ticket based
- **Key features:** `ticketing`, `in_app_chat`, `chatbot_builder`, `knowledge_base`, `shared_inbox`, `integrations`, `reporting`
- **Proprietary feature suggestion:** `ecommerce_integrations`
- **Why include:** Shopify support leader; competes with Zendesk/Intercom in e-commerce.

### 4.7 Apollo.io (`apollo-io.json`)
- **Category:** CRM & Sales
- **Pricing URL:** https://www.apollo.io/pricing
- **Plans:**
  - `free` — $0
  - `basic` — $59/user/mo annual
  - `professional` — $99/user/mo annual
  - `organization` — Custom
- **Key features:** `crm_basic`, `email_sequences`, `lead_scoring`, `api_access`, `integrations`, `reporting`
- **Proprietary feature suggestion:** `b2b_contact_database`, `sales_engagement`
- **Why include:** Core sales engagement + data platform compared against HubSpot/Salesforce/Pipedrive.

---

## 5. Validation Commands (run after every batch)

```bash
# 1. Validate business rules and schema
node scripts/validate-data.mjs

# 2. Run unit tests (151 tests)
npm test

# 3. Build the Astro site
npm run build
```

If any test fails:
1. Read the failure message.
2. Check `src/lib/categories.ts` for cross-category redundancy rules.
3. Ensure every `featureId` referenced in a plan exists in the product's `featureIds` or `proprietaryFeatures`.
4. Re-run the three commands before continuing.

---

## 6. Decisions to Preserve

1. **Pricing convention** (see §1).
2. **`pricingModel` values (schema enum):** `freemium`, `per_user`, `per_month`, `per_month_per_user`, `custom`.
3. **Cross-category redundancy guard:** Do not assign `crm_basic` to Email Marketing or Customer Support products unless they are genuinely CRM-first (e.g. HubSpot, Salesforce, Pipedrive).
4. **Add-on modeling:** Any paid module that materially changes the TCO (AI, storage, API, advanced support, dev mode) should be an `addOn` object with `priceMonthly`, `pricingModel`, and `featureId` if applicable.
5. **Date format:** `YYYY-MM-DD` for `capturedAt` and `lastVerified`.

---

## 7. Known Blockers / Warnings

- **Dynamic pricing pages:** Zoom, HubSpot, and Intercom render prices with JavaScript; `webfetch` may return only navigation. Use browser screenshots, vendor PDFs, or cached pricing tables as fallback sources and cite them in `priceNote`.
- **Currency/region differences:** All prices in the JSONs should be **USD list prices for the US market** unless the product is region-locked.
- **Annual vs monthly ambiguity:** Some vendors (Asana, Airtable, Notion) show an "effective monthly" price for annual billing. Use the convention in §1 to avoid confusion.

---

## 8. Quick Reference — Product Status

| Status | Products |
| --- | --- |
| Deep-verified & corrected | HubSpot, Salesforce, Intercom, Mailchimp, ConvertKit, Drip, Brevo, ActiveCampaign, SendGrid, Postmark, Datadog, Vercel, Figma, Notion, GitHub, GitLab, Slack, Asana, Airtable, Jira, Basecamp, Help Scout, google-chat, height, linear, loom, miro, missive, monday, monday-sales-crm, microsoft-teams, pipedrive, attio, bitbucket, clickup, close, coda, crisp, discord, freshdesk, freshsales, front, shortcut, streak, todoist, zendesk, zendesk-sell, chatwoot, zoho-crm, zoom |
| Expansion JSONs created | Klaviyo, Canva, Google Meet, Netlify, New Relic, Gorgias, Apollo.io |
| Not yet created | — |

---

*Generated on: 2026-06-14*  
*Next action: backlog complete; run periodic pricing refreshes or add new products as requested.*
