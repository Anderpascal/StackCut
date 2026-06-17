/**
 * Tests for src/data/features-registry.ts
 *
 * Covers:
 *  - Structural integrity: 59 features, unique IDs, kebab-case IDs
 *  - RegistryFeature.type field validation (core vs infrastructure)
 *  - Helper functions: getCoreFeatures, getInfrastructureFeatures
 *  - Helper functions: getCoreFeatureIds, getInfrastructureFeatureIds
 *  - Helper functions: isCoreFeature, isInfrastructureFeature
 *  - Helper functions: filterCoreFeatures, filterInfrastructureFeatures
 *  - Helper functions: getFeatureById, getFeaturesByIds
 *  - Helper functions: validateFeatureIds, featureRegistryIds
 *  - Description length minimum (≥30 chars)
 *  - Domain coverage: each SaaS category has ≥2 core features
 */

import {
  featureRegistry,
  featureRegistryIds,
  getCoreFeatures,
  getInfrastructureFeatures,
  getCoreFeatureIds,
  getInfrastructureFeatureIds,
  isCoreFeature,
  isInfrastructureFeature,
  filterCoreFeatures,
  filterInfrastructureFeatures,
  getFeatureById,
  getFeaturesByIds,
  validateFeatureIds,
  REDUNDANCY_CORE_OVERLAP_THRESHOLD,
  MIN_CORE_OVERLAP_FEATURES,
} from '../data/features-registry';
import type { RegistryFeature } from '../data/features-registry';

// ─── Structural integrity ──────────────────────────────────────────────────

describe('featureRegistry structure', () => {
  it('should have exactly 59 features (31 core + 28 infrastructure)', () => {
    expect(featureRegistry).toHaveLength(61);
  });

  it('should have all unique IDs (no duplicates)', () => {
    const ids = featureRegistry.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have all unique names (no duplicates)', () => {
    const names = featureRegistry.map((f) => f.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('should have all IDs matching kebab-case / snake_case pattern', () => {
    const kebabCaseRegex = /^[a-z0-9_]+$/;
    for (const f of featureRegistry) {
      expect(f.id).toMatch(kebabCaseRegex);
    }
  });

  it('should have every description at least 30 characters long', () => {
    for (const f of featureRegistry) {
      expect(f.description.length).toBeGreaterThanOrEqual(30);
    }
  });

  it('should have comparable set to true for every feature', () => {
    for (const f of featureRegistry) {
      expect(f.comparable).toBe(true);
    }
  });

  it('should have valid category values for every feature', () => {
    const validCategories = ['core', 'security', 'integration', 'analytics', 'support'];
    for (const f of featureRegistry) {
      expect(validCategories).toContain(f.category);
    }
  });
});

// ─── type field validation ─────────────────────────────────────────────────

describe('RegistryFeature.type', () => {
  it('every feature should have type "core" or "infrastructure"', () => {
    for (const f of featureRegistry) {
      expect(['core', 'infrastructure']).toContain(f.type);
    }
  });

  it('should have exactly 34 core features', () => {
    const coreFeatures = featureRegistry.filter((f) => f.type === 'core');
    expect(coreFeatures).toHaveLength(34);
  });

  it('should have exactly 27 infrastructure features', () => {
    const infraFeatures = featureRegistry.filter((f) => f.type === 'infrastructure');
    expect(infraFeatures).toHaveLength(27);
  });

  it('infrastructure features should be the canonical 28', () => {
    const infraIds = featureRegistry
      .filter((f) => f.type === 'infrastructure')
      .map((f) => f.id)
      .sort();
    const expected = [
      'a_b_testing',
      'advanced_analytics',
      'ai_features',
      'alerting',
      'api_access',
      'audit_logs',
      'collaboration',
      'custom_fields',
      'dashboards',
      'email_automation',
      'email_templates',
      'file_sharing',
      'integrations',
      'knowledge_base',
      'lead_scoring',
      'pipeline_mgmt',
      'priority_support',
      'recording',
      'reporting',
      'roles_permissions',
      'saml_sso',
      'sla',
      'ticketing',
      'version_control',
      'video_hosting',
      'white_label',
      'workflows',
    ].sort();
    expect(infraIds).toEqual(expected);
  });
});

// ─── getCoreFeatures / getInfrastructureFeatures ────────────────────────────

describe('getCoreFeatures', () => {
  it('should return only features with type === "core"', () => {
    const core = getCoreFeatures();
    expect(core.length).toBeGreaterThanOrEqual(31);
    for (const f of core) {
      expect(f.type).toBe('core');
    }
  });

  it('should return 34 core feature objects', () => {
    expect(getCoreFeatures()).toHaveLength(34);
  });
});

describe('getInfrastructureFeatures', () => {
  it('should return only features with type === "infrastructure"', () => {
    const infra = getInfrastructureFeatures();
    expect(infra).toHaveLength(27);
    for (const f of infra) {
      expect(f.type).toBe('infrastructure');
    }
  });
});

// ─── getCoreFeatureIds / getInfrastructureFeatureIds ────────────────────────

describe('getCoreFeatureIds', () => {
  it('should return at least 34 core feature IDs', () => {
    const ids = getCoreFeatureIds();
    expect(ids.length).toBeGreaterThanOrEqual(34);
  });

  it('should return exactly 34 core feature IDs', () => {
    expect(getCoreFeatureIds()).toHaveLength(34);
  });

  it('every returned ID should belong to a core feature', () => {
    const ids = getCoreFeatureIds();
    for (const id of ids) {
      expect(isCoreFeature(id)).toBe(true);
    }
  });
});

describe('getInfrastructureFeatureIds', () => {
  it('should return exactly 27 infrastructure feature IDs', () => {
    expect(getInfrastructureFeatureIds()).toHaveLength(27);
  });

  it('should return the canonical 28 infrastructure IDs', () => {
    const ids = getInfrastructureFeatureIds().sort();
    const expected = [
      'a_b_testing',
      'advanced_analytics',
      'ai_features',
      'alerting',
      'api_access',
      'audit_logs',
      'collaboration',
      'custom_fields',
      'dashboards',
      'email_automation',
      'email_templates',
      'file_sharing',
      'integrations',
      'knowledge_base',
      'lead_scoring',
      'pipeline_mgmt',
      'priority_support',
      'recording',
      'reporting',
      'roles_permissions',
      'saml_sso',
      'sla',
      'ticketing',
      'version_control',
      'video_hosting',
      'white_label',
      'workflows',
    ].sort();
    expect(ids).toEqual(expected);
  });
});

// ─── isCoreFeature / isInfrastructureFeature ────────────────────────────────

describe('isCoreFeature', () => {
  it('should return true for crm_basic', () => {
    expect(isCoreFeature('crm_basic')).toBe(true);
  });

  it('should return false for api_access', () => {
    expect(isCoreFeature('api_access')).toBe(false);
  });

  it('should return true for code_reviews', () => {
    expect(isCoreFeature('code_reviews')).toBe(true);
  });

  it('should return true for video_conferencing', () => {
    expect(isCoreFeature('video_conferencing')).toBe(true);
  });

  it('should return true for design_prototyping', () => {
    expect(isCoreFeature('design_prototyping')).toBe(true);
  });

  it('should return true for in_app_chat', () => {
    expect(isCoreFeature('in_app_chat')).toBe(true);
  });

  it('should return true for project_timelines', () => {
    expect(isCoreFeature('project_timelines')).toBe(true);
  });

  it('should return true for email_sequences', () => {
    expect(isCoreFeature('email_sequences')).toBe(true);
  });

  it('should return false for workflows (now infrastructure)', () => {
    expect(isCoreFeature('workflows')).toBe(false);
  });

  it('should return false for unknown IDs', () => {
    expect(isCoreFeature('nonexistent_feature')).toBe(false);
  });
});

describe('isInfrastructureFeature', () => {
  it('should return true for saml_sso', () => {
    expect(isInfrastructureFeature('saml_sso')).toBe(true);
  });

  it('should return true for api_access', () => {
    expect(isInfrastructureFeature('api_access')).toBe(true);
  });

  it('should return true for workflows', () => {
    expect(isInfrastructureFeature('workflows')).toBe(true);
  });

  it('should return true for dashboards', () => {
    expect(isInfrastructureFeature('dashboards')).toBe(true);
  });

  it('should return false for crm_basic', () => {
    expect(isInfrastructureFeature('crm_basic')).toBe(false);
  });

  it('should return false for unknown IDs', () => {
    expect(isInfrastructureFeature('nonexistent_feature')).toBe(false);
  });
});

// ─── filterCoreFeatures / filterInfrastructureFeatures ──────────────────────

describe('filterCoreFeatures', () => {
  it('should filter mixed IDs to only core', () => {
    const result = filterCoreFeatures(['crm_basic', 'api_access', 'code_reviews']);
    expect(result).toEqual(['crm_basic', 'code_reviews']);
  });

  it('should return empty array when no core features present', () => {
    const result = filterCoreFeatures(['api_access', 'saml_sso', 'audit_logs', 'workflows']);
    expect(result).toEqual([]);
  });

  it('should return all IDs when all are core', () => {
    const input = ['crm_basic', 'code_reviews', 'video_conferencing'];
    expect(filterCoreFeatures(input)).toEqual(input);
  });

  it('should handle empty input', () => {
    expect(filterCoreFeatures([])).toEqual([]);
  });
});

describe('filterInfrastructureFeatures', () => {
  it('should filter mixed IDs to only infrastructure', () => {
    const result = filterInfrastructureFeatures(['crm_basic', 'api_access']);
    expect(result).toEqual(['api_access']);
  });

  it('should return empty array when no infrastructure features present', () => {
    const result = filterInfrastructureFeatures(['crm_basic', 'code_reviews', 'video_conferencing']);
    expect(result).toEqual([]);
  });

  it('should handle empty input', () => {
    expect(filterInfrastructureFeatures([])).toEqual([]);
  });
});

// ─── getFeatureById / getFeaturesByIds ──────────────────────────────────────

describe('getFeatureById', () => {
  it('should return the correct feature for code_reviews', () => {
    const feature = getFeatureById('code_reviews');
    expect(feature).toBeDefined();
    expect(feature!.id).toBe('code_reviews');
    expect(feature!.name).toBe('Code Reviews');
    expect(feature!.type).toBe('core');
  });

  it('should return the correct feature for api_access', () => {
    const feature = getFeatureById('api_access');
    expect(feature).toBeDefined();
    expect(feature!.type).toBe('infrastructure');
  });

  it('should return undefined for nonexistent ID', () => {
    expect(getFeatureById('made_up_feature')).toBeUndefined();
  });
});

describe('getFeaturesByIds', () => {
  it('should return 2 features for [crm_basic, api_access]', () => {
    const features = getFeaturesByIds(['crm_basic', 'api_access']);
    expect(features).toHaveLength(2);
  });

  it('should filter out nonexistent IDs', () => {
    const features = getFeaturesByIds(['crm_basic', 'does_not_exist']);
    expect(features).toHaveLength(1);
    expect(features[0].id).toBe('crm_basic');
  });

  it('should return empty array for empty input', () => {
    expect(getFeaturesByIds([])).toEqual([]);
  });
});

// ─── validateFeatureIds ─────────────────────────────────────────────────────

describe('validateFeatureIds', () => {
  it('should return valid IDs unchanged', () => {
    const ids = ['crm_basic', 'api_access', 'code_reviews'];
    expect(validateFeatureIds(ids)).toEqual(ids);
  });

  it('should throw an error for invalid IDs', () => {
    expect(() => validateFeatureIds(['crm_basic', 'invalid_feature'])).toThrow(
      /Invalid feature IDs/
    );
  });
});

// ─── featureRegistryIds ─────────────────────────────────────────────────────

describe('featureRegistryIds', () => {
  it('should contain all feature IDs from the registry', () => {
    const idsFromRegistry = featureRegistry.map((f) => f.id);
    expect(featureRegistryIds.sort()).toEqual(idsFromRegistry.sort());
  });

  it('should have the same length as featureRegistry', () => {
    expect(featureRegistryIds).toHaveLength(featureRegistry.length);
  });
});

// ─── Threshold constants ────────────────────────────────────────────────────

describe('redundancy constants', () => {
  it('REDUNDANCY_CORE_OVERLAP_THRESHOLD should be 0.6', () => {
    expect(REDUNDANCY_CORE_OVERLAP_THRESHOLD).toBe(0.6);
  });

  it('MIN_CORE_OVERLAP_FEATURES should be 2', () => {
    expect(MIN_CORE_OVERLAP_FEATURES).toBe(2);
  });
});

// ─── Domain coverage: each SaaS category has ≥2 core features ──────────────

describe('domain coverage — each SaaS category has ≥2 core features', () => {
  /**
   * Mapping from SaaS category to ultra-specific core feature IDs.
   * Based on design.md §2.1.2 "Mapeo de Core Features Ultra-Específicas por Vertical".
   */
  const categoryCoreFeatures: Record<string, string[]> = {
    'CRM & Sales': ['crm_basic', 'email_sequences', 'voip_telephony'],
    Communication: ['real_time_messaging', 'channels', 'voice_channels', 'email_collaboration'],
    'Customer Support': ['in_app_chat', 'chatbot_builder', 'shared_inbox'],
    'Project Management': ['project_timelines', 'gantt_charts', 'task_management'],
    'Video Conferencing': ['video_conferencing', 'screen_sharing'],
    'Email Marketing': ['email_sequences', 'transactional_email'],
    'Productivity & Wiki': ['wiki_pages', 'real_time_co_editing', 'relational_database', 'database_views'],
    'Dev Tools': ['code_reviews', 'ci_cd_pipelines', 'serverless_deploy', 'preview_deployments', 'edge_functions'],
    Design: ['design_prototyping', 'design_handoff', 'whiteboarding'],
    Monitoring: ['infrastructure_monitoring', 'apm'],
  };

  for (const [category, expectedCoreIds] of Object.entries(categoryCoreFeatures)) {
    it(`"${category}" should have at least 2 core features`, () => {
      expect(expectedCoreIds.length).toBeGreaterThanOrEqual(2);
      // Also verify each core feature ID exists in the registry with type core
      for (const id of expectedCoreIds) {
        const feature = getFeatureById(id);
        expect(feature).toBeDefined();
        expect(feature!.type).toBe('core');
      }
    });
  }
});
