import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const SaasFeatureSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/, 'Must be snake_case or camelCase alphanumeric'),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(['core', 'security', 'integration', 'analytics', 'support', 'proprietary']),
  isEnterpriseLocked: z.boolean().default(false),
  comparable: z.literal(false),
});

const PlanAddOnSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1),
  description: z.string().max(280).optional(),
  priceMonthly: z.number().nonnegative().nullable(),
  priceAnnually: z.number().nonnegative().nullable(),
  unit: z.enum(['per_user', 'flat', 'per_unit']),
});

const VolumeTierSchema = z.object({
  minSeats: z.number().int().positive(),
  pricePerSeatMonthly: z.number().nonnegative(),
});

const PricingPlanSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/, 'Must be kebab_case alphanumeric'),
  name: z.string().min(1),
  priceMonthly: z.number().nonnegative().nullable(),
  priceAnnually: z.number().nonnegative().nullable(),
  seatsIncluded: z.number().int().positive().default(1),
  features: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
  isEnterprise: z.boolean().default(false),
  migrationComplexity: z.enum(['low', 'medium', 'high']).optional(),
  // ── Fidelity & realism extensions (all optional; existing data stays valid) ──
  seatMin: z.number().int().positive().optional(),
  priceNote: z.string().max(280).optional(),
  sourceUrl: z.string().url().optional(),
  capturedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date YYYY-MM-DD').optional(),
  addOns: z.array(PlanAddOnSchema).optional(),
  volumeTiers: z.array(VolumeTierSchema).optional(),
});

export const saasCollection = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/saas' }),
  schema: z.object({
    id: z.string().regex(/^[a-z0-9_-]+$/, 'Must be kebab-case alphanumeric'),
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/, 'Must be kebab-case'),
    category: z.enum([
      'CRM & Sales', 'Project Management', 'Communication',
      'Customer Support', 'Email Marketing', 'Video Conferencing',
      'Productivity & Wiki', 'Dev Tools',
      'Design', 'Monitoring',
    ]),
    description: z.string().min(10).max(300),
    websiteUrl: z.string().url(),
    // Canonical vendor pricing page, for "verify on the vendor's page" links.
    pricingUrl: z.string().url().optional(),
    // Affiliate links must be real https links — never copy-pasted template IDs.
    // This refine is the build-time guard that stops a placeholder (e.g.
    // ".../c/12345/67890") from ever shipping again. Keep the patterns in sync
    // with src/lib/affiliates.ts and scripts/validate-data.mjs.
    affiliateUrl: z
      .string()
      .url()
      .refine((u) => u.startsWith('https://'), 'Affiliate URL must use https')
      .refine(
        (u) => !/(12345|67890|98765|your[-_]?(id|ref|affiliate)|example|placeholder|changeme|localhost)/i.test(u),
        'Affiliate URL looks like a placeholder — replace with the real partner link or set null',
      )
      .nullable()
      .default(null),
    pricingModel: z.enum(['per_user', 'per_month', 'per_month_per_user', 'freemium', 'custom']),
    freeTrialDays: z.number().int().nonnegative().nullable().default(null),
    lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date YYYY-MM-DD'),
    popularityScore: z.number().min(0).max(100).optional(),
    g2Rating: z.number().min(0).max(5).optional(),
    featureIds: z.array(z.string()).default([]),
    proprietaryFeatures: z.array(SaasFeatureSchema).default([]),
    openSourceAlternatives: z.array(z.object({
      name: z.string().min(1),
      url: z.string().url(),
      replaces: z.string().min(1),
      setupComplexity: z.enum(['low', 'medium', 'high']),
      savingsPerMonth: z.number().nonnegative(),
      effortHours: z.number().positive().optional(),
    })).optional(),
    plans: z.array(PricingPlanSchema).min(1, 'Each product must have at least 1 plan'),
  }),
});

export const blogCollection = defineCollection({
  loader: glob({ pattern: '*.md{,x}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(10).max(300),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    heroImage: z.string().optional(),
    author: z.string().default('StackCut Team'),
    tags: z.array(z.string()).default([]),
    category: z.enum(['cost-optimization', 'negotiation', 'open-source', 'audit', 'general']),
  }),
});

export const collections = {
  'saas': saasCollection,
  'blog': blogCollection,
};
