/**
 * Tests for computeUnusedTools() — refactored v2 logic with real core features.
 *
 * Covers:
 *  1. Simple unused: toolA's core features fully covered by toolB in same silo
 *  2. No unused: each tool has a unique core feature the other lacks
 *  3. Silo respected: tools in different silos are NOT compared
 *  4. 0 core features: tool with only infra features is NEVER unused
 *  5. Stack of 1: unusedTools is always empty
 *  6. Partial coverage: tool's core features only partially covered by union of others
 *  7. Identical core features: toolA fully covered by toolB → unused
 *  8. Three tools, smallest is strict subset → unused
 */

import { computeUnusedTools } from '../components/StackAuditor';
import { getCoreFeatureIds } from '../data/features-registry';
import { createMockProduct } from './helpers';
import type { SaaSProductData } from '../types/saas';

// Get the actual core feature IDs for filtering
const coreFeatureIds = new Set(getCoreFeatureIds());

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
// Test 1: Simple unused
// toolA (2 core) covered by toolB (3 core, includes same 2), same silo → unused
// ────────────────────────────────────────────────────────────────────────────
describe('computeUnusedTools — simple unused', () => {
  it('toolA whose core features are fully covered by toolB in the same silo should be unused', () => {
    const toolA = createMockProduct({
      id: 'toolA',
      name: 'Tool A',
      category: 'Dev Tools',
      featureIds: ['code_reviews', 'ci_cd_pipelines'],
      plans: [plan(10)],
    });

    const toolB = createMockProduct({
      id: 'toolB',
      name: 'Tool B',
      category: 'Dev Tools',
      featureIds: ['code_reviews', 'ci_cd_pipelines', 'serverless_deploy'],
      plans: [plan(20)],
    });

    const tools: SaaSProductData[] = [toolA, toolB];
    const result = computeUnusedTools(tools, coreFeatureIds);

    expect(result).toContain('Tool A');
    expect(result).not.toContain('Tool B');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 2: No unused
// Each tool has a unique core feature the other lacks → neither unused
// ────────────────────────────────────────────────────────────────────────────
describe('computeUnusedTools — no unused (unique core feature)', () => {
  it('toolA with a core feature not covered by any other tool in the silo should NOT be unused', () => {
    const toolA = createMockProduct({
      id: 'toolA',
      name: 'DevTool Pro',
      category: 'Dev Tools',
      featureIds: ['code_reviews', 'serverless_deploy'],
      plans: [plan(15)],
    });

    const toolB = createMockProduct({
      id: 'toolB',
      name: 'DevTool Lite',
      category: 'Dev Tools',
      featureIds: ['code_reviews', 'ci_cd_pipelines'],
      plans: [plan(5)],
    });

    const tools: SaaSProductData[] = [toolA, toolB];
    const result = computeUnusedTools(tools, coreFeatureIds);

    // toolA core: [code_reviews, serverless_deploy]
    // siloOthersCoreFeatures: {code_reviews, ci_cd_pipelines}
    // serverless_deploy NOT covered → NOT unused
    expect(result).not.toContain('DevTool Pro');

    // toolB core: [code_reviews, ci_cd_pipelines]
    // siloOthersCoreFeatures: {code_reviews, serverless_deploy}
    // ci_cd_pipelines NOT covered → NOT unused
    expect(result).not.toContain('DevTool Lite');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 3: Silo respected
// toolA (Dev Tools) + toolB (Communication) → different silos → neither unused
// ────────────────────────────────────────────────────────────────────────────
describe('computeUnusedTools — silo respected', () => {
  it('tools in different silos should NOT mark each other as unused', () => {
    const toolA = createMockProduct({
      id: 'github',
      name: 'GitHub',
      category: 'Dev Tools',
      featureIds: ['code_reviews', 'ci_cd_pipelines'],
      plans: [plan(20)],
    });

    const toolB = createMockProduct({
      id: 'slack',
      name: 'Slack',
      category: 'Communication',
      featureIds: ['code_reviews', 'ci_cd_pipelines'], // same core features but different silo
      plans: [plan(15)],
    });

    const tools: SaaSProductData[] = [toolA, toolB];
    const result = computeUnusedTools(tools, coreFeatureIds);

    // Even though core features are identical, they are in different silos
    // computeUnusedTools only looks at silo-mates
    expect(result).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 4: 0 core features
// Tool with only infrastructure features is NEVER unused
// ────────────────────────────────────────────────────────────────────────────
describe('computeUnusedTools — 0 core features', () => {
  it('tool with only infrastructure features should never be marked as unused', () => {
    const toolA = createMockProduct({
      id: 'toolA',
      name: 'Infra Only Tool',
      category: 'Dev Tools',
      featureIds: ['api_access', 'integrations', 'saml_sso', 'audit_logs'],
      plans: [plan(30)],
    });

    const toolB = createMockProduct({
      id: 'toolB',
      name: 'Full Featured Tool',
      category: 'Dev Tools',
      featureIds: [
        'api_access',
        'integrations',
        'saml_sso',
        'audit_logs',
        'code_reviews',
        'ci_cd_pipelines',
        'serverless_deploy',
      ],
      plans: [plan(50)],
    });

    const tools: SaaSProductData[] = [toolA, toolB];
    const result = computeUnusedTools(tools, coreFeatureIds);

    // toolA has 0 core features → NEVER unused
    expect(result).not.toContain('Infra Only Tool');

    // toolB has core features → but they're not covered by others (toolA has 0 core)
    // siloOthersCoreFeatures for toolB: {} (toolA has no core features)
    // toolB core: [code_reviews, ci_cd_pipelines, serverless_deploy] — none covered → NOT unused
    expect(result).not.toContain('Full Featured Tool');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 5: Stack of 1 → unusedTools always empty
// ────────────────────────────────────────────────────────────────────────────
describe('computeUnusedTools — single tool', () => {
  it('a stack with only 1 tool should have empty unusedTools', () => {
    const tool = createMockProduct({
      id: 'slack',
      name: 'Slack',
      category: 'Communication',
      featureIds: ['code_reviews', 'ci_cd_pipelines'],
      plans: [plan(15)],
    });

    const tools: SaaSProductData[] = [tool];
    const result = computeUnusedTools(tools, coreFeatureIds);

    expect(result).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 6: Partial coverage — not fully covered by union of others
// toolA (3 core), toolB (1 of them), toolC (1 different one)
// → only 2 of 3 covered → toolA NOT unused; toolB and toolC ARE unused
// ────────────────────────────────────────────────────────────────────────────
describe('computeUnusedTools — partial coverage', () => {
  it('toolA with 3 core features only partially covered by other tools should NOT be unused', () => {
    const toolA = createMockProduct({
      id: 'toolA',
      name: 'Comprehensive Tool',
      category: 'Dev Tools',
      featureIds: ['code_reviews', 'ci_cd_pipelines', 'serverless_deploy'],
      plans: [plan(25)],
    });

    const toolB = createMockProduct({
      id: 'toolB',
      name: 'Code Review Tool',
      category: 'Dev Tools',
      featureIds: ['code_reviews'],
      plans: [plan(10)],
    });

    const toolC = createMockProduct({
      id: 'toolC',
      name: 'CI/CD Tool',
      category: 'Dev Tools',
      featureIds: ['ci_cd_pipelines'],
      plans: [plan(8)],
    });

    const tools: SaaSProductData[] = [toolA, toolB, toolC];
    const result = computeUnusedTools(tools, coreFeatureIds);

    // toolA core: [code_reviews, ci_cd_pipelines, serverless_deploy]
    // siloOthersCoreFeatures: {code_reviews, ci_cd_pipelines}
    // serverless_deploy NOT covered → NOT unused
    expect(result).not.toContain('Comprehensive Tool');

    // toolB core: [code_reviews]
    // siloOthersCoreFeatures: {code_reviews, ci_cd_pipelines, serverless_deploy} (from toolA + toolC)
    // code_reviews IS covered → toolB IS unused
    expect(result).toContain('Code Review Tool');

    // toolC core: [ci_cd_pipelines]
    // siloOthersCoreFeatures: {code_reviews, ci_cd_pipelines, serverless_deploy}
    // ci_cd_pipelines IS covered → toolC IS unused
    expect(result).toContain('CI/CD Tool');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test 7: Identical core features
// toolA (2 core) fully covered by toolB (3 core) in same silo → toolA unused
// ────────────────────────────────────────────────────────────────────────────
describe('computeUnusedTools — identical core features', () => {
  it('two tools where one is fully covered by the other in the same silo should mark the smaller as unused', () => {
    const toolA = createMockProduct({
      id: 'toolA',
      name: 'Clone A',
      category: 'CRM & Sales',
      featureIds: ['crm_basic', 'email_sequences'],
      plans: [plan(50)],
    });

    const toolB = createMockProduct({
      id: 'toolB',
      name: 'Clone B',
      category: 'CRM & Sales',
      featureIds: ['crm_basic', 'email_sequences', 'voip_telephony'],
      plans: [plan(60)],
    });

    const tools: SaaSProductData[] = [toolA, toolB];
    const result = computeUnusedTools(tools, coreFeatureIds);

    // toolA core: [crm_basic, email_sequences] — fully covered by toolB → unused
    expect(result).toContain('Clone A');
    // toolB core: [crm_basic, email_sequences, voip_telephony] — not fully covered → NOT unused
    expect(result).not.toContain('Clone B');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Test 8: Three tools, smallest is strict subset → unused
  // ──────────────────────────────────────────────────────────────────────────
  it('three tools where the smallest is a strict subset of the union of the other two → unused', () => {
    const hubspot = createMockProduct({
      id: 'hubspot',
      name: 'HubSpot',
      category: 'CRM & Sales',
      featureIds: ['crm_basic', 'email_sequences', 'voip_telephony'],
      plans: [plan(50)],
    });

    const salesforce = createMockProduct({
      id: 'salesforce',
      name: 'Salesforce',
      category: 'CRM & Sales',
      featureIds: ['crm_basic', 'email_sequences', 'voip_telephony'],
      plans: [plan(100)],
    });

    const pipedrive = createMockProduct({
      id: 'pipedrive',
      name: 'Pipedrive',
      category: 'CRM & Sales',
      featureIds: ['crm_basic', 'email_sequences'],
      plans: [plan(20)],
    });

    const tools: SaaSProductData[] = [hubspot, salesforce, pipedrive];
    const result = computeUnusedTools(tools, coreFeatureIds);

    // Pipedrive core: [crm_basic, email_sequences]
    // siloOthersCoreFeatures: {crm_basic, email_sequences, voip_telephony}
    // Both covered → Pipedrive IS unused
    expect(result).toContain('Pipedrive');
  });
});
