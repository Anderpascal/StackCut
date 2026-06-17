import type { RegistryFeature } from '../data/features-registry';

// --- Raw Content Collection data types ---

/** A paid extra that sits on top of a plan (e.g. extra storage, an AI add-on). */
export interface PlanAddOn {
  id: string;
  name: string;
  description?: string;
  priceMonthly: number | null;
  priceAnnually: number | null;
  /** How the price scales: per seat, a flat fee, or per arbitrary unit (e.g. per 1k contacts). */
  unit: 'per_user' | 'flat' | 'per_unit';
}

/** A volume break that lowers the per-seat price above a seat threshold. */
export interface VolumeTier {
  minSeats: number;
  pricePerSeatMonthly: number;
}

export interface SaaSPlanData {
  id: string;
  name: string;
  priceMonthly: number | null;
  priceAnnually: number | null;
  seatsIncluded: number;
  features: Record<string, boolean | number | string>;
  isEnterprise: boolean;
  migrationComplexity?: 'low' | 'medium' | 'high';
  /** Minimum billable seats the vendor enforces on this plan, if any. */
  seatMin?: number;
  /** Human-readable caveat shown next to the price (e.g. "annual billing only"). */
  priceNote?: string;
  /** Exact vendor pricing-page URL this plan's figures were read from. */
  sourceUrl?: string;
  /** ISO date this specific plan's price was last captured (finer than product.lastVerified). */
  capturedAt?: string;
  addOns?: PlanAddOn[];
  volumeTiers?: VolumeTier[];
}

export interface ProprietaryFeature {
  id: string;
  name: string;
  description: string;
  category: string;
  isEnterpriseLocked: boolean;
  comparable: false;
}

export interface OpenSourceAlternative {
  name: string;
  url: string;
  replaces: string;
  setupComplexity: 'low' | 'medium' | 'high';
  savingsPerMonth: number;
  effortHours?: number;
}

export interface SaaSProductData {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  websiteUrl: string;
  pricingUrl?: string;
  affiliateUrl: string | null;
  pricingModel: string;
  freeTrialDays: number | null;
  lastVerified: string;
  popularityScore?: number;
  g2Rating?: number;
  featureIds: string[];
  proprietaryFeatures: ProprietaryFeature[];
  plans: SaaSPlanData[];
  openSourceAlternatives?: OpenSourceAlternative[];
}

// --- Summary types (for pages) ---

export interface SaaSProductSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  websiteUrl: string;
  affiliateUrl: string | null;
  pricingModel: string;
  freeTrialDays: number | null;
  lastVerified: string;
  popularityScore?: number;
  g2Rating?: number;
  cheapestPlan: PricingPlanSummary | null;
  featureCount: number;
}

export interface PricingPlanSummary {
  id: string;
  name: string;
  priceMonthly: number | null;
  priceAnnually: number | null;
  seatsIncluded: number;
  isEnterprise: boolean;
}

// --- Analysis types ---

export interface DowngradeSuggestion {
  currentPlan: SaaSPlanData;
  targetPlan: SaaSPlanData;
  annualSavings: number;
  lostFeatures: (RegistryFeature | ProprietaryFeature)[];
  retainedFeatures: (RegistryFeature | ProprietaryFeature)[];
  riskLevel: 'low' | 'medium' | 'high';
  confidenceScore: number;
}

export interface AlternativeSuggestion {
  product: SaaSProductData;
  matchingPlan: SaaSPlanData;
  annualSavings: number;
  matchScore: number;
}

export interface EnterpriseTaxBreakdown {
  planName: string;
  pricePerUser: number;
  userCount: number;
  totalMonthly: number;
  premiumFeatures: { name: string; price: number }[];
  openSourceAlternatives: OSSAlternative[];
  avoidableOverpayment: number | null;
  ossSavings: number;
}

export interface OSSAlternative {
  name: string;
  description: string;
  setupComplexity: 'low' | 'medium' | 'high';
  savingsPerMonth: number;
  effortHours: number;
  url: string;
  roiPerHour: number;
}

export interface NegotiationScriptParams {
  saasName: string;
  currentPlan: string;
  monthlySpend: number;
  competitorName: string;
  competitorPrice: number;
  userCount: number;
}

export interface StackAuditRedundantPair {
  tool1: string;
  tool2: string;
  id1: string;
  id2: string;
  overlappingFeatures: string[];
  overlappingFeatureNames: string[];
  overlappingCoreFeatures: string[];
  overlappingCoreFeatureNames: string[];
  siloCategory: string;
  redundancyReason: 'core_overlap';
  recommendation: string;
  potentialSavings: number;
  /** The cheaper tool of the pair — the one to keep if consolidating. */
  cheaperToolId: string;
  cheaperToolName: string;
  cheaperToolSlug: string;
  cheaperToolAffiliateUrl: string | null;
  cheaperToolWebsiteUrl: string;
  /** The more expensive tool of the pair — candidate to cancel/downgrade. */
  moreExpensiveToolId: string;
  moreExpensiveToolName: string;
  moreExpensiveToolSlug: string;
  moreExpensiveToolAffiliateUrl: string | null;
  moreExpensiveToolWebsiteUrl: string;
  /** Deep-link to the Downgrade Engine for the expensive tool. */
  downgradeUrl: string;
  /** Deep-link to the alternatives page for the expensive tool. */
  alternativesUrl: string;
}

export interface StackAuditResult {
  redundantPairs: StackAuditRedundantPair[];
  totalMonthlySpend: number;
  totalPotentialSavings: number;
  unusedTools: string[];
}

export interface MigrationCostParams {
  migrationDays: number;
  teamHourlyRate: number;
}

export interface CsvExportRow {
  type: string;
  target: string;
  annualSavings: number;
  year1NetSavings: number;
  confidenceScore: number;
  featuresLost: string;
  featuresRetained: string;
}
