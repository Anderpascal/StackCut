# StackCut

**Kill the Enterprise Tax.**
A manually-verified pricing ledger that maps every SaaS tier, spots redundant features, and shows you the exact downgrade path.

![StackCut](public/og-default.jpg)

## What is this?
StackCut is a deterministic, manually-verified B2B SaaS cost-audit toolkit. The average B2B organization overpays by 34% on software. Our tools help you find the leaks so you can pull the plug.

### Core Modules
1. **Downgrade Engine**: Select your SaaS and plan. Check the features you actually use. See if you can drop to a lower tier without losing functionality.
2. **Enterprise Tax Calculator**: Discover how much you overpay for a single security feature (SSO, Audit Logs). See Open Source alternatives.
3. **Negotiation Script Generator**: Generate hyper-persuasive cancellation and negotiation emails based on real competitor pricing data.
4. **SaaS Stack Auditor**: Add your current tools. We cross-reference feature matrices to identify redundancies.

## Tech Stack
- **Framework**: Astro 6
- **UI Component Library**: React 18
- **Styling**: Tailwind CSS 4
- **Database**: Local JSON content collections
- **Analytics**: Plausible (Privacy-first)
- **Monetization**: EthicalAds & Affiliate Marketing

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`

## Deployment
This project is built as a static site.
```bash
npm run build
```
The output will be in the `dist/` directory, ready to deploy to Vercel, Netlify, or any static host.

## Content & Data
The real value of this project is in the `/src/content/saas` directory. Here you'll find the pricing structures and feature mappings of 50+ SaaS tools.

> **Note**: To monetize the site, you need to replace the placeholder `affiliateUrl` fields in the JSON files with your real affiliate links.

## License
MIT
