/**
 * Tests for analyzeStack() — refactored v2 algorithm.
 *
 * Covers 13 key test cases:
 *  1. [bitbucket, microsoft-teams] → 0 redundancies (Dev Tools ≠ Communication)
 *  2. [github, zoom] → 0 redundancies (Dev Tools ≠ Video Conferencing)
 *  3. [gitlab, zoom] → 0 redundancies (Dev Tools ≠ Video Conferencing)
 *  4. [bitbucket, github] → 0 redundancies (same silo but insufficient core overlap)
 *  5. [hubspot, salesforce] → 1 redundancy (same silo CRM & Sales, ≥60% core overlap)
 *  6. [slack, microsoft-teams] → 1 redundancy (same silo Communication, ≥60% core overlap)
 *  7. [jira, notion] → 0 redundancies (distintos silos: Project Management ≠ Productivity & Wiki)
 *  8. [slack] → single tool → 0 redundancies, unusedTools empty
 *  9. [github, slack, zoom] → 0 redundancies (all pairs in different silos or 0 core overlap)
 * 10. True positive: overlappingCoreFeatures + overlappingCoreFeatureNames present & non-empty
 * 11. True positive: potentialSavings = cheapest tool's annual price
 * 12. True positive: recommendation contains tool names and core feature names
 * 13. True positive: siloCategory is present
 */

import { analyzeStack } from '../components/StackAuditor';
import { createMockProduct, mockFmt } from './helpers';
import type { SaaSProductData } from '../types/saas';

// ─── Helper: build a basic paid plan ────────────────────────────────────────
function plan(priceMonthly: number) {
  return {
    id: `plan-${priceMonthly}`,
    name: `Plan $${priceMonthly}`,
    priceMonthly,
    priceAnnually: priceMonthly * 12,
    seatsIncluded: 1,
    features: {},
    isEnterprise: false,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Tests 1-3: FALSE POSITIVE ELIMINATION (silo filter)
// Silo: Dev Tools ≠ Communication / Video Conferencing → areCategoriesComparable = false
// ────────────────────────────────────────────────────────────────────────────
describe('analyzeStack — false positive elimination (silo filter)', () => {
  it('T1: bitbucket vs microsoft-teams → 0 redundancies (Dev Tools ≠ Communication)', () => {
    const bitbucket = createMockProduct({
      id: 'bitbucket',
      name: 'Bitbucket',
      category: 'Dev Tools',
      featureIds: [
        'api_access',
        'integrations',
        'saml_sso',
        'audit_logs',
        'version_control',
        'workflows',
        'dashboards',
      ],
      plans: [plan(15)],
    });

    const teams = createMockProduct({
      id: 'microsoft-teams',
      name: 'Microsoft Teams',
      category: 'Communication',
      featureIds: [
        'api_access',
        'integrations',
        'saml_sso',
        'audit_logs',
        'real_time_messaging',
        'file_sharing',
        'collaboration',
      ],
      plans: [plan(12)],
    });

    const allProducts: SaaSProductData[] = [bitbucket, teams];
    const result = analyzeStack(['bitbucket', 'microsoft-teams'], allProducts, mockFmt);

    expect(result.redundantPairs).toHaveLength(0);
  });

  it('T2: github vs zoom → 0 redundancies (Dev Tools ≠ Video Conferencing)', () => {
    const github = createMockProduct({
      id: 'github',
      name: 'GitHub',
      category: 'Dev Tools',
      featureIds: [
        'api_access',
        'integrations',
        'saml_sso',
        'audit_logs',
        'version_control',
        'workflows',
        'dashboards',
      ],
      plans: [plan(20)],
    });

    const zoom = createMockProduct({
      id: 'zoom',
      name: 'Zoom',
      category: 'Video Conferencing',
      featureIds: [
        'api_access',
        'integrations',
        'recording',
        'video_hosting',
        'real_time_messaging',
        'file_sharing',
      ],
      plans: [plan(15)],
    });

    const allProducts: SaaSProductData[] = [github, zoom];
    const result = analyzeStack(['github', 'zoom'], allProducts, mockFmt);

    expect(result.redundantPairs).toHaveLength(0);
  });

  it('T3: gitlab vs zoom → 0 redundancies (Dev Tools ≠ Video Conferencing)', () => {
    const gitlab = createMockProduct({
      id: 'gitlab',
      name: 'GitLab',
      category: 'Dev Tools',
      featureIds: [
        'api_access',
        'integrations',
        'saml_sso',
        'audit_logs',
        'version_control',
        'workflows',
        'dashboards',
      ],
      plans: [plan(30)],
    });

    const zoom = createMockProduct({
      id: 'zoom',
      name: 'Zoom',
      category: 'Video Conferencing',
      featureIds: [
        'api_access',
        'integrations',
        'recording',
        'video_hosting',
        'real_time_messaging',
        'file_sharing',
      ],
      plans: [plan(15)],
    });

    const allProducts: SaaSProductData[] = [gitlab, zoom];
    const result = analyzeStack(['gitlab', 'zoom'], allProducts, mockFmt);

    expect(result.redundantPairs).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 4: [bitbucket, github] → 0 redundancies
// Same silo (Dev Tools) but core overlap = 1 < MIN_CORE_OVERLAP (2)
// ────────────────────────────────────────────────────────────────────────────
describe('analyzeStack — same silo, insufficient core overlap', () => {
  it('T4: bitbucket vs github → 0 redundancies (same silo, only 1 core feature shared)', () => {
    // bitbucket: only 1 core feature (code_reviews)
    const bitbucket = createMockProduct({
      id: 'bitbucket',
      name: 'Bitbucket',
      category: 'Dev Tools',
      featureIds: [
        'api_access',
        'integrations',
        'saml_sso',
        'audit_logs',
        'code_reviews', // 1 core
        'version_control',
        'workflows',
      ],
      plans: [plan(15)],
    });

    // github: 3 core features (code_reviews, ci_cd_pipelines, serverless_deploy)
    const github = createMockProduct({
      id: 'github',
      name: 'GitHub',
      category: 'Dev Tools',
      featureIds: [
        'api_access',
        'integrations',
        'saml_sso',
        'code_reviews',
        'ci_cd_pipelines',
        'serverless_deploy',
        'version_control',
        'dashboards',
      ],
      plans: [plan(20)],
    });

    const allProducts: SaaSProductData[] = [bitbucket, github];
    const result = analyzeStack(['bitbucket', 'github'], allProducts, mockFmt);

    // coreOverlap = [code_reviews] (1)
    // smallerCoreCount = 1, threshold = ceil(1 * 0.6) = 1
    // 1 >= 1 BUT 1 < MIN_CORE_OVERLAP (2) → not redundant
    expect(result.redundantPairs).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 5: [hubspot, salesforce] → 1 redundancy
// Same silo (CRM & Sales), high core overlap (3 core features shared)
// ────────────────────────────────────────────────────────────────────────────
describe('analyzeStack — true positive (CRM & Sales)', () => {
  const hubspot = createMockProduct({
    id: 'hubspot',
    name: 'HubSpot',
    category: 'CRM & Sales',
    featureIds: [
      // ── Core features (3) ──
      'crm_basic',
      'email_sequences',
      'voip_telephony',
      // ── Infrastructure features ──
      'api_access',
      'integrations',
      'custom_fields',
      'reporting',
      'workflows',
      'advanced_analytics',
      'roles_permissions',
      'saml_sso',
      'audit_logs',
      'ai_features',
      'sla',
      'priority_support',
      'pipeline_mgmt',
      'lead_scoring',
      'email_automation',
    ],
    plans: [plan(50)],
  });

  const salesforce = createMockProduct({
    id: 'salesforce',
    name: 'Salesforce',
    category: 'CRM & Sales',
    featureIds: [
      // ── Core features (3) ──
      'crm_basic',
      'email_sequences',
      'voip_telephony',
      // ── Infrastructure features ──
      'api_access',
      'integrations',
      'custom_fields',
      'reporting',
      'workflows',
      'advanced_analytics',
      'roles_permissions',
      'saml_sso',
      'audit_logs',
      'ai_features',
      'sla',
      'priority_support',
      'email_automation',
      'white_label',
      'pipeline_mgmt',
      'lead_scoring',
    ],
    plans: [plan(100)],
  });

  it('T5: hubspot vs salesforce → 1 redundant pair', () => {
    const allProducts: SaaSProductData[] = [hubspot, salesforce];
    const result = analyzeStack(['hubspot', 'salesforce'], allProducts, mockFmt);

    expect(result.redundantPairs).toHaveLength(1);

    const pair = result.redundantPairs[0];
    // HubSpot core (3): crm_basic, email_sequences, voip_telephony
    // Salesforce core (3): crm_basic, email_sequences, voip_telephony
    // coreOverlap (3): crm_basic, email_sequences, voip_telephony
    // smallerCoreCount = 3, threshold = ceil(3 * 0.6) = 2
    // 3 >= 2 AND 3 >= 2 → redundant
    expect(pair.overlappingCoreFeatures.length).toBeGreaterThanOrEqual(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 6: [slack, microsoft-teams] → 1 redundancy
// Same silo (Communication), high core overlap (3 core features shared)
// ────────────────────────────────────────────────────────────────────────────
describe('analyzeStack — true positive (Communication)', () => {
  it('T6: slack vs microsoft-teams → 1 redundant pair', () => {
    const slack = createMockProduct({
      id: 'slack',
      name: 'Slack',
      category: 'Communication',
      featureIds: [
        // ── Core features (3) ──
        'video_conferencing',
        'screen_sharing',
        'email_collaboration',
        // ── Infrastructure features ──
        'api_access',
        'integrations',
        'real_time_messaging',
        'file_sharing',
        'collaboration',
      ],
      plans: [plan(15)],
    });

    const teams = createMockProduct({
      id: 'microsoft-teams',
      name: 'Microsoft Teams',
      category: 'Communication',
      featureIds: [
        // ── Core features (3) ──
        'video_conferencing',
        'screen_sharing',
        'email_collaboration',
        // ── Infrastructure features ──
        'api_access',
        'integrations',
        'real_time_messaging',
        'file_sharing',
        'collaboration',
      ],
      plans: [plan(12)],
    });

    const allProducts: SaaSProductData[] = [slack, teams];
    const result = analyzeStack(['slack', 'microsoft-teams'], allProducts, mockFmt);

    expect(result.redundantPairs).toHaveLength(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 7: [jira, notion] → 0 redundancies
// Project Management ≠ Productivity & Wiki → different COMPARISON_SILOS
// (These categories are NOT comparable in the restrictive COMPARISON_SILOS)
// ────────────────────────────────────────────────────────────────────────────
describe('analyzeStack — distinct silos (Project Management vs Productivity & Wiki)', () => {
  it('T7: jira vs notion → 0 redundancies (different silos)', () => {
    const jira = createMockProduct({
      id: 'jira',
      name: 'Jira',
      category: 'Project Management',
      featureIds: [
        'api_access',
        'integrations',
        'workflows',
        'kanban_boards',
        'dependency_tracking',
        'dashboards',
        'custom_fields',
        'project_timelines',
        'task_management',
      ],
      plans: [plan(10)],
    });

    const notion = createMockProduct({
      id: 'notion',
      name: 'Notion',
      category: 'Productivity & Wiki',
      featureIds: [
        'api_access',
        'integrations',
        'collaboration',
        'file_sharing',
        'knowledge_base',
        'custom_fields',
        'dashboards',
        'wiki_pages',
        'real_time_co_editing',
      ],
      plans: [plan(8)],
    });

    const allProducts: SaaSProductData[] = [jira, notion];
    const result = analyzeStack(['jira', 'notion'], allProducts, mockFmt);

    // COMPARISON_SILOS['Project Management'] = ['Project Management'] only
    // COMPARISON_SILOS['Productivity & Wiki'] = ['Productivity & Wiki'] only
    // → areCategoriesComparable returns false → different silos → 0 redundancies
    expect(result.redundantPairs).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 8: single tool → 0 redundancies, unusedTools = []
// ────────────────────────────────────────────────────────────────────────────
describe('analyzeStack — single tool', () => {
  it('T8: [slack] → 0 redundancies, unusedTools empty, totalMonthlySpend correct', () => {
    const slack = createMockProduct({
      id: 'slack',
      name: 'Slack',
      category: 'Communication',
      featureIds: [
        'api_access',
        'integrations',
        'real_time_messaging',
        'file_sharing',
        'collaboration',
      ],
      plans: [plan(15)],
    });

    const allProducts: SaaSProductData[] = [slack];
    const result = analyzeStack(['slack'], allProducts, mockFmt);

    expect(result.redundantPairs).toHaveLength(0);
    expect(result.unusedTools).toHaveLength(0);
    expect(result.totalMonthlySpend).toBe(15);
    expect(result.totalPotentialSavings).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 9: [github, slack, zoom] → 0 redundancies
// github (Dev Tools) vs slack (Communication) → different silos → skip
// github (Dev Tools) vs zoom (Video Conferencing) → different silos → skip
// slack (Communication) vs zoom (Video Conferencing) → same silo BUT
// both have 0 core features with these mocks → skip (smallerCoreCount = 0)
// ────────────────────────────────────────────────────────────────────────────
describe('analyzeStack — mixed silos', () => {
  it('T9: [github, slack, zoom] → 0 redundancies (all pairs below threshold)', () => {
    const github = createMockProduct({
      id: 'github',
      name: 'GitHub',
      category: 'Dev Tools',
      featureIds: [
        'api_access',
        'integrations',
        'saml_sso',
        'version_control',
        'workflows',
        'dashboards',
      ],
      plans: [plan(20)],
    });

    const slack = createMockProduct({
      id: 'slack',
      name: 'Slack',
      category: 'Communication',
      featureIds: [
        'api_access',
        'integrations',
        'real_time_messaging',
        'file_sharing',
        'collaboration',
        'workflows',
      ],
      plans: [plan(15)],
    });

    // Zoom has features that don't create meaningful core overlap with Slack
    const zoom = createMockProduct({
      id: 'zoom',
      name: 'Zoom',
      category: 'Video Conferencing',
      featureIds: [
        'api_access',
        'integrations',
        'recording',
        'video_hosting',
        'real_time_messaging',
      ],
      plans: [plan(15)],
    });

    const allProducts: SaaSProductData[] = [github, slack, zoom];
    const result = analyzeStack(['github', 'slack', 'zoom'], allProducts, mockFmt);

    // github vs slack: different silo (Dev Tools ≠ Communication) → skip
    // github vs zoom: different silo (Dev Tools ≠ Video Conferencing) → skip
    // slack vs zoom: same silo (Communication ⇔ Video Conferencing) BUT
    //   all featureIds are infrastructure (0 core) → smallerCoreCount = 0 → skip
    expect(result.redundantPairs).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Tests 10-13: RedundantPair field validation (on hubspot vs salesforce)
// ────────────────────────────────────────────────────────────────────────────
describe('analyzeStack — redundantPair field validation', () => {
  const hubspot = createMockProduct({
    id: 'hubspot',
    name: 'HubSpot',
    slug: 'hubspot',
    category: 'CRM & Sales',
    websiteUrl: 'https://hubspot.com',
    affiliateUrl: 'https://partnerstack.com/hubspot',
    featureIds: [
      // ── Core features (3) ──
      'crm_basic',
      'email_sequences',
      'voip_telephony',
      // ── Infrastructure features ──
      'api_access',
      'integrations',
      'custom_fields',
      'reporting',
      'workflows',
      'advanced_analytics',
      'roles_permissions',
      'saml_sso',
      'audit_logs',
      'ai_features',
      'sla',
      'priority_support',
      'pipeline_mgmt',
      'lead_scoring',
      'email_automation',
    ],
    plans: [plan(50)],
  });

  const salesforce = createMockProduct({
    id: 'salesforce',
    name: 'Salesforce',
    slug: 'salesforce',
    category: 'CRM & Sales',
    websiteUrl: 'https://salesforce.com',
    affiliateUrl: 'https://partnerstack.com/salesforce',
    featureIds: [
      // ── Core features (3) ──
      'crm_basic',
      'email_sequences',
      'voip_telephony',
      // ── Infrastructure features ──
      'api_access',
      'integrations',
      'custom_fields',
      'reporting',
      'workflows',
      'advanced_analytics',
      'roles_permissions',
      'saml_sso',
      'audit_logs',
      'ai_features',
      'sla',
      'priority_support',
      'email_automation',
      'white_label',
      'pipeline_mgmt',
      'lead_scoring',
    ],
    plans: [plan(100)],
  });

  const allProducts: SaaSProductData[] = [hubspot, salesforce];
  const result = analyzeStack(['hubspot', 'salesforce'], allProducts, mockFmt);
  const pair = result.redundantPairs[0];

  it('T10: overlappingCoreFeatures and overlappingCoreFeatureNames should be present and non-empty', () => {
    expect(pair).toBeDefined();
    expect(pair.overlappingCoreFeatures.length).toBeGreaterThan(0);
    expect(pair.overlappingCoreFeatureNames.length).toBeGreaterThan(0);
    // Core overlap should include the 3 CRM core features both share
    expect(new Set(pair.overlappingCoreFeatures)).toEqual(
      new Set(['crm_basic', 'email_sequences', 'voip_telephony'])
    );
  });

  it('T11: potentialSavings should be the annual price of the cheaper tool', () => {
    // HubSpot is $50/mo, Salesforce is $100/mo → cheaper is HubSpot at $50 * 12 = $600
    expect(pair.potentialSavings).toBe(600);
  });

  it('T12: recommendation should contain tool names and core feature names', () => {
    expect(pair.recommendation).toContain('HubSpot');
    expect(pair.recommendation).toContain('Salesforce');
    // Should mention at least one core feature name (e.g. "CRM Core")
    const hasCoreFeatureMention = pair.overlappingCoreFeatureNames.some(
      (name) => pair.recommendation.includes(name)
    );
    expect(hasCoreFeatureMention).toBe(true);
  });

  it('T13: siloCategory should be present and match the shared silo', () => {
    expect(pair.siloCategory).toBe('CRM & Sales');
  });

  it('T14: monetization fields should identify cheaper and more expensive tools correctly', () => {
    // HubSpot is $50/mo, Salesforce is $100/mo
    expect(pair.cheaperToolId).toBe('hubspot');
    expect(pair.cheaperToolName).toBe('HubSpot');
    expect(pair.moreExpensiveToolId).toBe('salesforce');
    expect(pair.moreExpensiveToolName).toBe('Salesforce');
  });

  it('T15: deep-link URLs should be generated for the expensive tool', () => {
    expect(pair.downgradeUrl).toMatch(/^\/downgrade\?tool=salesforce/);
    expect(pair.alternativesUrl).toBe('/alternatives/salesforce-cheap');
  });

  it('T16: affiliate URLs should be preserved on both tools for monetization CTAs', () => {
    expect(pair.cheaperToolAffiliateUrl).toBe('https://partnerstack.com/hubspot');
    expect(pair.cheaperToolWebsiteUrl).toBe('https://hubspot.com');
    expect(pair.moreExpensiveToolAffiliateUrl).toBe('https://partnerstack.com/salesforce');
    expect(pair.moreExpensiveToolWebsiteUrl).toBe('https://salesforce.com');
  });

  it('redundancyReason should be "core_overlap"', () => {
    expect(pair.redundancyReason).toBe('core_overlap');
  });

  it('overlappingFeatures should include both core and infra shared features', () => {
    // Should include at least api_access and integrations (infra) + core overlaps
    expect(pair.overlappingFeatures).toContain('api_access');
    expect(pair.overlappingFeatures).toContain('integrations');
    // Core overlaps should also be present
    expect(pair.overlappingFeatures).toContain('crm_basic');
  });

  it('totalPotentialSavings should sum all redundant pair savings', () => {
    expect(result.totalPotentialSavings).toBe(pair.potentialSavings);
  });

  it('totalMonthlySpend should sum cheapest paid prices of all tools', () => {
    // HubSpot $50 + Salesforce $100 = $150
    expect(result.totalMonthlySpend).toBe(150);
  });
});
