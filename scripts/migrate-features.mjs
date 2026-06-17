#!/usr/bin/env node
/**
 * scripts/migrate-features.mjs
 *
 * Automated migration script that aligns SaaS JSON featureIds with the new
 * 31-feature registry (v2). It adds suggested core + infrastructure features
 * per category, removes invalid/unknown IDs, and deduplicates.
 *
 * Usage:
 *   node scripts/migrate-features.mjs
 *
 * Exit codes:
 *   0 — Migration completed with no invalid feature IDs found.
 *   1 — At least one product had invalid feature IDs. Review the report.
 *
 * ⚠️  IMPORTANT: The REGISTRY_FEATURE_IDS and CORE_FEATURE_IDS sets below
 *     MUST be kept in sync with src/data/features-registry.ts.
 *     If you add/remove/rename a feature, update these sets and re-run.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Path resolution ────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SAAS_DIR = resolve(ROOT, 'src', 'content', 'saas');
const REPORT_PATH = resolve(ROOT, '.opencode', 'migration-report.json');

// ── Feature ID canónicos (31 features) ─────────────────────────────────────
// ⚠️  SINCRONIZAR con src/data/features-registry.ts
const REGISTRY_FEATURE_IDS = new Set([
  // Infrastructure features (7)
  'api_access', 'integrations', 'saml_sso', 'audit_logs',
  'sla', 'priority_support', 'roles_permissions',
  // Core features — existing (8)
  'custom_fields', 'workflows', 'advanced_analytics', 'reporting',
  'ai_features', 'white_label', 'crm_basic', 'email_automation',
  // Core features — new (16)
  'real_time_messaging', 'file_sharing', 'ticketing', 'knowledge_base',
  'dashboards', 'alerting', 'recording', 'collaboration',
  'version_control', 'pipeline_mgmt', 'lead_scoring', 'email_templates',
  'a_b_testing', 'video_hosting', 'dependency_tracking', 'kanban_boards',
]);

// ⚠️  SINCRONIZAR con featureRegistry.filter(f => f.type === 'core')
const CORE_FEATURE_IDS = new Set([
  'custom_fields', 'workflows', 'advanced_analytics', 'reporting',
  'ai_features', 'white_label', 'crm_basic', 'email_automation',
  'real_time_messaging', 'file_sharing', 'ticketing', 'knowledge_base',
  'dashboards', 'alerting', 'recording', 'collaboration',
  'version_control', 'pipeline_mgmt', 'lead_scoring', 'email_templates',
  'a_b_testing', 'video_hosting', 'dependency_tracking', 'kanban_boards',
]);

// ── Category → suggested features ──────────────────────────────────────────
// Features that make sense for each SaaS vertical. The script ADDS these
// if they are not already present. Existing features are NEVER removed
// unless they are invalid (not in the registry) or duplicated.
//
// ⚠️  All IDs here MUST exist in REGISTRY_FEATURE_IDS.
const CATEGORY_DEFAULTS = {
  'CRM & Sales': {
    core: ['crm_basic', 'email_automation', 'pipeline_mgmt', 'lead_scoring', 'reporting', 'custom_fields'],
    infrastructure: ['api_access', 'integrations', 'roles_permissions'],
  },
  'Communication': {
    core: ['real_time_messaging', 'file_sharing', 'collaboration'],
    infrastructure: ['api_access', 'integrations', 'saml_sso'],
  },
  'Customer Support': {
    core: ['ticketing', 'knowledge_base', 'reporting', 'dashboards'],
    infrastructure: ['api_access', 'integrations'],
  },
  'Project Management': {
    core: ['custom_fields', 'workflows', 'reporting', 'dashboards', 'dependency_tracking', 'kanban_boards'],
    infrastructure: ['api_access', 'integrations', 'roles_permissions'],
  },
  'Video Conferencing': {
    core: ['real_time_messaging', 'recording', 'file_sharing', 'video_hosting'],
    infrastructure: ['api_access', 'integrations'],
  },
  'Email Marketing': {
    core: ['email_automation', 'email_templates', 'a_b_testing', 'reporting', 'dashboards'],
    infrastructure: ['api_access', 'integrations'],
  },
  'Productivity & Wiki': {
    core: ['custom_fields', 'file_sharing', 'collaboration', 'dashboards', 'knowledge_base'],
    infrastructure: ['api_access', 'integrations'],
  },
  'Dev Tools': {
    core: ['version_control', 'dashboards', 'reporting', 'workflows'],
    infrastructure: ['api_access', 'integrations', 'saml_sso', 'audit_logs'],
  },
  'Design': {
    core: ['file_sharing', 'collaboration', 'version_control'],
    infrastructure: ['api_access', 'integrations'],
  },
  'Monitoring': {
    core: ['alerting', 'dashboards', 'reporting', 'advanced_analytics'],
    infrastructure: ['api_access', 'integrations', 'saml_sso', 'audit_logs'],
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validate that all suggested feature IDs exist in the registry.
 * Called once at startup to catch configuration mistakes early.
 */
function validateCategoryDefaults() {
  const errors = [];
  for (const [category, defaults] of Object.entries(CATEGORY_DEFAULTS)) {
    for (const fid of defaults.core) {
      if (!REGISTRY_FEATURE_IDS.has(fid)) {
        errors.push(`CATEGORY_DEFAULTS["${category}"].core: "${fid}" is NOT in REGISTRY_FEATURE_IDS`);
      }
    }
    for (const fid of defaults.infrastructure) {
      if (!REGISTRY_FEATURE_IDS.has(fid)) {
        errors.push(`CATEGORY_DEFAULTS["${category}"].infrastructure: "${fid}" is NOT in REGISTRY_FEATURE_IDS`);
      }
    }
  }
  return errors;
}

/**
 * Migrate a single product's featureIds.
 *
 * @param {string} productId - Product identifier (for logging only)
 * @param {string} category - The product's SaaS category
 * @param {string[]} currentFeatureIds - Current feature ID array
 * @returns {object} Migration result
 */
function migrateProduct(productId, category, currentFeatureIds) {
  const defaults = CATEGORY_DEFAULTS[category];

  if (!defaults) {
    return {
      added: [],
      removed: [],
      unchanged: currentFeatureIds,
      invalid: [],
      warnings: [`Category "${category}" has no defaults — no features suggested`],
      hasCore: currentFeatureIds.some(fid => CORE_FEATURE_IDS.has(fid)),
    };
  }

  // Work with a Set to deduplicate automatically
  const featureSet = new Set(currentFeatureIds);

  // 1. Detect and remove invalid feature IDs
  const removed = [];
  const invalid = [];
  for (const fid of featureSet) {
    if (!REGISTRY_FEATURE_IDS.has(fid)) {
      invalid.push(fid);
      removed.push(fid);
    }
  }
  for (const fid of removed) {
    featureSet.delete(fid);
  }

  // 2. Record which features were already there (before adding suggestions)
  const unchanged = [...featureSet];

  // 3. Add suggested core + infrastructure features that are missing
  const added = [];
  const allSuggestions = [...defaults.core, ...defaults.infrastructure];

  for (const fid of allSuggestions) {
    if (!featureSet.has(fid)) {
      featureSet.add(fid);
      added.push(fid);
    }
  }

  // 4. Check if product has at least 1 core feature after migration
  const hasCore = [...featureSet].some(fid => CORE_FEATURE_IDS.has(fid));

  const warnings = [];
  if (!hasCore) {
    warnings.push(`Product has 0 core features after migration`);
  }
  if (featureSet.size > 12) {
    warnings.push(`Product has ${featureSet.size} features (over 12) — review for over-assignment`);
  }

  return {
    added,
    removed,
    unchanged,
    invalid,
    warnings,
    hasCore,
    finalCount: featureSet.size,
    finalFeatureIds: [...featureSet],
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('┌──────────────────────────────────────────────────┐');
  console.log('│  StackAuditor — Feature ID Migration Script v2    │');
  console.log('│  Target: 50 JSONs in src/content/saas/            │');
  console.log('└──────────────────────────────────────────────────┘\n');

  // 0. Validate category defaults first
  const configErrors = validateCategoryDefaults();
  if (configErrors.length > 0) {
    console.error('❌ CONFIGURATION ERRORS in CATEGORY_DEFAULTS:\n');
    for (const err of configErrors) {
      console.error(`   ${err}`);
    }
    console.error('\nFix the above errors before running the migration.\n');
    process.exit(2);
  }
  console.log('✅ CATEGORY_DEFAULTS validated — all IDs exist in registry.\n');

  // 1. Scan JSON files
  const allFiles = await readdir(SAAS_DIR);
  const jsonFiles = allFiles.filter(f => f.endsWith('.json'));
  jsonFiles.sort();

  console.log(`📁 Found ${jsonFiles.length} SaaS JSON files to process.\n`);

  // 2. Process each product
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalProducts: jsonFiles.length,
      productsModified: 0,
      totalFeaturesAdded: 0,
      totalFeaturesRemoved: 0,
      totalInvalidFound: 0,
      productsWithWarnings: 0,
      productsWithZeroCore: 0,
    },
    products: {},
    productsWithZeroCore: [],
    productsOverTenFeatures: [],
    exitCode: 0,
  };

  let hasErrors = false;

  for (const filename of jsonFiles) {
    const filePath = resolve(SAAS_DIR, filename);

    // Read raw JSON
    const raw = await readFile(filePath, 'utf-8');
    let product;
    try {
      product = JSON.parse(raw);
    } catch (err) {
      console.error(`❌ Failed to parse ${filename}: ${err.message}`);
      hasErrors = true;
      report.products[filename] = { error: `Parse error: ${err.message}` };
      continue;
    }

    // Basic validation
    if (!product.id || !product.name) {
      console.warn(`⚠️  ${filename}: Missing id or name field — skipping`);
      continue;
    }

    const productId = product.id;
    const category = product.category || 'Unknown';
    const featureIds = Array.isArray(product.featureIds) ? product.featureIds : [];

    // Perform migration
    const result = migrateProduct(productId, category, featureIds);

    // Record warnings
    if (result.warnings.length > 0) {
      report.summary.productsWithWarnings++;
    }
    if (!result.hasCore) {
      report.summary.productsWithZeroCore++;
      report.productsWithZeroCore.push(productId);
    }
    if (result.finalCount > 10) {
      report.productsOverTenFeatures.push(`${productId} (${result.finalCount} features)`);
    }

    // Check if the JSON needs updating
    const hasChanges = result.added.length > 0 || result.removed.length > 0;

    if (result.invalid.length > 0) {
      hasErrors = true;
      report.summary.totalInvalidFound += result.invalid.length;
    }

    if (hasChanges) {
      // Update featureIds preserving order: unchanged first, then added
      product.featureIds = result.finalFeatureIds;

      // Write back with 2-space indentation + trailing newline
      const updated = JSON.stringify(product, null, 2) + '\n';
      await writeFile(filePath, updated, 'utf-8');

      report.summary.productsModified++;
      report.summary.totalFeaturesAdded += result.added.length;
      report.summary.totalFeaturesRemoved += result.removed.length;

      console.log(`📝 ${productId.padEnd(20)} | +${String(result.added.length).padStart(2)} added | -${String(result.removed.length).padStart(2)} removed | ${result.finalCount} total`);
    } else if (result.invalid.length > 0) {
      console.log(`⚠️  ${productId.padEnd(20)} | ${result.invalid.length} invalid IDs found (no changes applied)`);
    } else {
      console.log(`✅ ${productId.padEnd(20)} | up to date`);
    }

    // Store in report
    report.products[productId] = {
      file: filename,
      category,
      added: result.added,
      removed: result.removed,
      unchanged: result.unchanged.filter(fid => !result.removed.includes(fid)),
      invalid: result.invalid,
      warnings: result.warnings,
      hasCore: result.hasCore,
      finalCount: result.finalCount,
    };
  }

  // 3. Summary
  console.log('\n┌──────────────────────────────────────────────────┐');
  console.log('│                   MIGRATION SUMMARY               │');
  console.log('├──────────────────────────────────────────────────┤');
  console.log(`│ Total products processed:     ${String(report.summary.totalProducts).padStart(3)}               │`);
  console.log(`│ Products modified:            ${String(report.summary.productsModified).padStart(3)}               │`);
  console.log(`│ Total features added:         ${String(report.summary.totalFeaturesAdded).padStart(3)}               │`);
  console.log(`│ Total features removed:       ${String(report.summary.totalFeaturesRemoved).padStart(3)}               │`);
  console.log(`│ Invalid feature IDs found:    ${String(report.summary.totalInvalidFound).padStart(3)}               │`);
  console.log(`│ Products with warnings:       ${String(report.summary.productsWithWarnings).padStart(3)}               │`);
  console.log(`│ Products with 0 core:         ${String(report.summary.productsWithZeroCore).padStart(3)}               │`);
  console.log('└──────────────────────────────────────────────────┘');

  if (report.productsWithZeroCore.length > 0) {
    console.log('\n⚠️  PRODUCTS WITH 0 CORE FEATURES (after migration):');
    for (const pid of report.productsWithZeroCore) {
      console.log(`   - ${pid}`);
    }
  }

  if (report.productsOverTenFeatures.length > 0) {
    console.log('\n⚠️  PRODUCTS WITH >10 FEATURES (review for over-assignment):');
    for (const entry of report.productsOverTenFeatures) {
      console.log(`   - ${entry}`);
    }
  }

  if (hasErrors) {
    console.log('\n❌ ERRORS FOUND: Some product(s) have invalid feature IDs.');
    console.log('   Review the report at opencode/migration-report.json');
    console.log('   Fix the invalid IDs manually in the JSON files.\n');
    report.exitCode = 1;
  } else {
    console.log('\n✅ All product feature IDs are valid.');
    console.log('   Review the report at opencode/migration-report.json\n');
    report.exitCode = 0;
  }

  // 4. Write report
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  console.log(`📄 Report written to: ${REPORT_PATH}\n`);

  process.exit(report.exitCode);
}

main().catch(err => {
  console.error('💥 UNCAUGHT ERROR:', err);
  process.exit(2);
});
