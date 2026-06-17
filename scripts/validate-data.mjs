// Business rule validation for SaaS content data
// Run: node scripts/validate-data.mjs
// Exit code: 0 = pass, 1 = errors found

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);
const root = resolve(__dirname, '..');
const saasDir = resolve(root, 'src', 'content', 'saas');

// ── HARDCODED FALLBACK LISTS ──────────────────────────────────────────────
// ⚠️ MANTENER SINCRONIZADO con src/data/features-registry.ts
// Si se añade/elimina/renombra una feature, actualizar estas listas.

/** All 31 valid feature IDs (fallback if dynamic parsing fails) */
const FALLBACK_FEATURE_IDS = [
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
];

/** Feature IDs that are type === 'core' (fallback) */
const FALLBACK_CORE_FEATURE_IDS = new Set([
  'custom_fields', 'workflows', 'advanced_analytics', 'reporting',
  'ai_features', 'white_label', 'crm_basic', 'email_automation',
  'real_time_messaging', 'file_sharing', 'ticketing', 'knowledge_base',
  'dashboards', 'alerting', 'recording', 'collaboration',
  'version_control', 'pipeline_mgmt', 'lead_scoring', 'email_templates',
  'a_b_testing', 'video_hosting', 'dependency_tracking', 'kanban_boards',
]);

/** Valid SaaS product categories (fallback) */
const FALLBACK_CATEGORIES = [
  'CRM & Sales', 'Communication', 'Customer Support', 'Dev Tools',
  'Email Marketing', 'Productivity & Wiki', 'Project Management',
  'Video Conferencing', 'Design', 'Monitoring',
];

// ── DYNAMIC PARSING OF TYPESCRIPT REGISTRY ────────────────────────────────

/**
 * Parse a TypeScript features-registry file to extract feature IDs and types.
 * Uses regex to avoid needing tsx/ts-node.

 * Extracts patterns like:
 *   id: 'feature_name',   ...   type: 'core',
 * from the featureRegistry array literal.
 *
 * @returns {{ ids: string[], coreIds: Set<string>, allIds: Set<string> }}
 */
function parseFeatureRegistry(filePath) {
  const result = { ids: [], coreIds: new Set(), allIds: new Set() };
  try {
    const raw = readFileSync(filePath, 'utf-8');

    // Match each feature entry block between { } that contains 'comparable: true'
    // Extract id and type from each block
    const entryRegex = /\{\s*(?:[\s\S]*?)id:\s*'([a-z0-9_]+)'(?:[\s\S]*?)type:\s*'(core|infrastructure)'(?:[\s\S]*?)\}/g;
    let match;
    while ((match = entryRegex.exec(raw)) !== null) {
      const id = match[1];
      const type = match[2];
      result.ids.push(id);
      result.allIds.add(id);
      if (type === 'core') {
        result.coreIds.add(id);
      }
    }

    // If regex didn't capture all entries, try alternative: match all id fields
    if (result.ids.length === 0) {
      const idRegex = /id:\s*'([a-z0-9_]+)'/g;
      while ((match = idRegex.exec(raw)) !== null) {
        result.ids.push(match[1]);
        result.allIds.add(match[1]);
      }
      // Also try to get types separately
      const typeRegex = /id:\s*'([a-z0-9_]+)'(?:[\s\S]*?)type:\s*'(core|infrastructure)'/g;
      while ((match = typeRegex.exec(raw)) !== null) {
        if (match[2] === 'core') {
          result.coreIds.add(match[1]);
        }
      }
    }
  } catch (e) {
    console.warn(`Could not parse feature registry from ${filePath}: ${e.message}`);
  }
  return result;
}

/**
 * Parse categories.ts to extract CATEGORY_ORDER array entries.
 */
function parseCategoryOrder(filePath) {
  const categories = [];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    // Match entries in CATEGORY_ORDER array
    const catRegex = /'([^']+)'/g;
    let match;
    // Find the CATEGORY_ORDER section first
    const catOrderMatch = raw.match(/CATEGORY_ORDER\s*:\s*string\[\]\s*=\s*\[([\s\S]*?)\];/);
    if (catOrderMatch) {
      const section = catOrderMatch[1];
      const innerRegex = /'([^']+)'/g;
      while ((match = innerRegex.exec(section)) !== null) {
        categories.push(match[1]);
      }
    }
  } catch (e) {
    console.warn(`Could not parse categories from ${filePath}: ${e.message}`);
  }
  return categories;
}

// ── INITIALIZE REGISTRY DATA ──────────────────────────────────────────────

const regPath = resolve(root, 'src', 'data', 'features-registry.ts');
const catPath = resolve(root, 'src', 'lib', 'categories.ts');

let parsedRegistry;
try {
  parsedRegistry = parseFeatureRegistry(regPath);
} catch (e) {
  // will fall through to fallback below
}

const featureRegistry = (parsedRegistry && parsedRegistry.ids.length > 0)
  ? parsedRegistry.ids
  : FALLBACK_FEATURE_IDS;

const coreFeatureIds = (parsedRegistry && parsedRegistry.coreIds.size > 0)
  ? parsedRegistry.coreIds
  : FALLBACK_CORE_FEATURE_IDS;

let validCategories;
try {
  validCategories = parseCategoryOrder(catPath);
} catch (e) {
  // will fall through to fallback below
}

if (!validCategories || validCategories.length === 0) {
  validCategories = FALLBACK_CATEGORIES;
}

const validCategorySet = new Set(validCategories);

// When set (used by the scheduled freshness CI job), staleness becomes a hard
// error instead of a warning.
const STRICT_FRESHNESS = process.env.STRICT_FRESHNESS === '1' || process.env.STRICT_FRESHNESS === 'true';

// ── RULE 1: DUPLICATE JSON KEY DETECTOR ───────────────────────────────────
//
// JSON.parse silently overwrites duplicate keys (keeps last value). This
// hand-rolled scanner detects them from the raw text before parsing, so data
// corruption via duplicate keys can never reach the application silently.
//
// Handles all JSON string escapes (including \" and \\) so that braces or
// quote characters inside string values never confuse the scanner.

/**
 * Scan a raw JSON string and return the names of any duplicate object keys.
 * Keys are reported per-object: if the same key appears twice inside one
 * JSON object literal, it is added to the returned array once per duplicate
 * occurrence (so three copies of "x" → two entries for "x").
 *
 * @param {string} raw - Raw JSON file content
 * @returns {string[]} Duplicate key names found anywhere in the document
 */
export function detectDuplicateKeys(raw) {
  const duplicates = [];
  let pos = 0;
  const n = raw.length;

  function skipWhitespace() {
    while (pos < n) {
      const c = raw[pos];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        pos++;
      } else {
        break;
      }
    }
  }

  // Advances pos past a complete JSON string (including the surrounding quotes).
  // Returns the string's content with escape sequences decoded, so that key
  // comparison reflects the actual runtime value (e.g. `\"` → `"`).
  function scanString() {
    pos++; // skip opening '"'
    let result = '';
    // Map of single-char JSON escape codes to their decoded characters
    const ESC = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
    while (pos < n) {
      const ch = raw[pos];
      if (ch === '\\') {
        pos++; // skip backslash
        if (pos < n) {
          const esc = raw[pos];
          pos++; // skip the escape character
          if (esc === 'u' && pos + 4 <= n) {
            // Decode \uXXXX to the actual Unicode character
            const code = parseInt(raw.slice(pos, pos + 4), 16);
            result += isNaN(code) ? '' : String.fromCharCode(code);
            pos += 4;
          } else {
            // Decode simple escape or fall back to the literal character
            result += Object.prototype.hasOwnProperty.call(ESC, esc) ? ESC[esc] : esc;
          }
        }
      } else if (ch === '"') {
        pos++; // skip closing '"'
        break;
      } else {
        result += ch;
        pos++;
      }
    }
    return result;
  }

  // Advances pos past a complete JSON value (object, array, string, or primitive).
  function scanValue() {
    skipWhitespace();
    if (pos >= n) return;
    const ch = raw[pos];
    if (ch === '{') {
      scanObject();
    } else if (ch === '[') {
      scanArray();
    } else if (ch === '"') {
      scanString();
    } else {
      // Primitive: number, true, false, null — scan until a structural character
      while (pos < n) {
        const c = raw[pos];
        if (c === ',' || c === ']' || c === '}' || c === ' ' || c === '\t' || c === '\n' || c === '\r') {
          break;
        }
        pos++;
      }
    }
  }

  // Advances pos past a complete JSON object { ... }.
  // Records the keys seen; adds to `duplicates` when the same key appears twice.
  function scanObject() {
    pos++; // skip '{'
    const seen = new Set();
    skipWhitespace();

    while (pos < n && raw[pos] !== '}') {
      skipWhitespace();
      if (pos >= n || raw[pos] === '}') break;

      // Expect a string key
      if (raw[pos] !== '"') break; // malformed JSON — bail out gracefully

      const key = scanString();

      if (seen.has(key)) {
        duplicates.push(key);
      }
      seen.add(key);

      skipWhitespace();
      if (pos < n && raw[pos] === ':') pos++; // skip ':'

      scanValue(); // scan (and skip past) the value

      skipWhitespace();
      if (pos < n && raw[pos] === ',') {
        pos++; // skip ',' between key-value pairs
      }
    }
    if (pos < n && raw[pos] === '}') pos++; // skip closing '}'
  }

  // Advances pos past a complete JSON array [ ... ].
  function scanArray() {
    pos++; // skip '['
    skipWhitespace();

    while (pos < n && raw[pos] !== ']') {
      scanValue();
      skipWhitespace();
      if (pos < n && raw[pos] === ',') {
        pos++;
        skipWhitespace();
      }
    }
    if (pos < n && raw[pos] === ']') pos++; // skip closing ']'
  }

  try {
    skipWhitespace();
    if (pos < n) {
      if (raw[pos] === '{') scanObject();
      else if (raw[pos] === '[') scanArray();
    }
  } catch (_e) {
    // If the scanner hits an unexpected error, do not crash validation.
    // JSON.parse will catch actual parse errors separately.
  }

  return duplicates;
}

// ── RULE 2: ADD-ON PRICE COHERENCE ────────────────────────────────────────
//
// Add-on pricing must follow the same rule as plan pricing: the annual total
// must not exceed the monthly price × 12 (annual billing is always a discount
// or equal, never more expensive). Also warns when pricing is only half-filled.

/**
 * Check add-on pricing coherence for a single plan.
 *
 * Errors:   priceAnnually > priceMonthly × 12 + 0.01
 * Warnings: only one of priceMonthly / priceAnnually is set (incomplete)
 *
 * @param {object} plan  - A plan object (may or may not have addOns)
 * @param {string} slug  - Product slug (for error/warning context)
 * @returns {{ errors: object[], warnings: object[] }}
 */
export function validateAddOnPricing(plan, slug) {
  const errors = [];
  const warnings = [];
  if (!plan.addOns || !Array.isArray(plan.addOns)) return { errors, warnings };

  for (const addOn of plan.addOns) {
    const monthly = addOn.priceMonthly;
    const annually = addOn.priceAnnually;
    const hasMonthly = monthly !== null && monthly !== undefined;
    const hasAnnually = annually !== null && annually !== undefined;
    // Usage-based add-ons (per_unit) are billed per consumption (e.g. $0.90 per
    // AI resolution) and have no annual equivalent — exempt from completeness.
    const isUsageBased = addOn.unit === 'per_unit';

    if (hasMonthly && hasAnnually && monthly > 0) {
      if (annually > monthly * 12 + 0.01) {
        errors.push({
          product: slug,
          rule: 'addon-price-consistency',
          message: `Plan "${plan.id}" add-on "${addOn.id}" has annual pricing ($${annually}) exceeding monthly pricing 12× equivalent ($${(monthly * 12).toFixed(2)})`,
        });
      }
    } else if (hasMonthly && monthly > 0 && !hasAnnually && !isUsageBased) {
      warnings.push({
        product: slug,
        rule: 'addon-price-incomplete',
        message: `Plan "${plan.id}" add-on "${addOn.id}" has priceMonthly ($${monthly}) but no priceAnnually — incomplete pricing`,
      });
    } else if (!hasMonthly && hasAnnually && annually > 0) {
      warnings.push({
        product: slug,
        rule: 'addon-price-incomplete',
        message: `Plan "${plan.id}" add-on "${addOn.id}" has priceAnnually ($${annually}) but no priceMonthly — incomplete pricing`,
      });
    }
  }

  return { errors, warnings };
}

// ── RULE 3: DATA PROVENANCE WARNING ───────────────────────────────────────
//
// For credibility, every non-free non-enterprise plan should document where
// and when its price was verified (sourceUrl + capturedAt). If both are
// missing, emit a warning (not an error — some prices are widely known).

/**
 * Warn when a paid non-enterprise plan lacks both sourceUrl and capturedAt.
 *
 * @param {object} plan  - A plan object
 * @param {string} slug  - Product slug
 * @returns {{ warnings: object[] }}
 */
export function validateDataProvenance(plan, slug) {
  const warnings = [];
  if (plan.isEnterprise) return { warnings };
  if (plan.priceMonthly === null || plan.priceMonthly === undefined || plan.priceMonthly <= 0) {
    return { warnings };
  }

  const hasSourceUrl = typeof plan.sourceUrl === 'string' && plan.sourceUrl.trim() !== '';
  const hasCapturedAt = typeof plan.capturedAt === 'string' && plan.capturedAt.trim() !== '';

  if (!hasSourceUrl && !hasCapturedAt) {
    warnings.push({
      product: slug,
      rule: 'data-provenance',
      message: `Plan "${plan.id}" (priceMonthly=$${plan.priceMonthly}) lacks both sourceUrl and capturedAt — price provenance unverifiable`,
    });
  }

  return { warnings };
}

// ── RULE 4: DUPLICATE PLAN IDs + PRICE-MONOTONICITY SANITY ───────────────
//
// Within a product, plan IDs must be unique (an ERROR — duplicate IDs break
// lookup logic). Separately, if two non-enterprise paid plans share the same
// name but carry different prices, that is likely a data error (WARN).

/**
 * Check for duplicate plan IDs (ERROR) and same-name/different-price plans (WARN).
 *
 * @param {object[]} plans - Array of plan objects
 * @param {string}   slug  - Product slug
 * @returns {{ errors: object[], warnings: object[] }}
 */
export function validateDuplicatePlanIds(plans, slug) {
  const errors = [];
  const warnings = [];
  if (!plans || !Array.isArray(plans)) return { errors, warnings };

  // ERROR: duplicate plan id within product
  const seenIds = new Map(); // id → index of first occurrence
  for (const plan of plans) {
    if (plan.id !== undefined && plan.id !== null) {
      if (seenIds.has(plan.id)) {
        errors.push({
          product: slug,
          rule: 'duplicate-plan-id',
          message: `Duplicate plan id "${plan.id}" within product — plan ids must be unique`,
        });
      } else {
        seenIds.set(plan.id, plan);
      }
    }
  }

  // WARN: non-enterprise paid plans with the same name but different prices
  // (same-id cases are already caught above as ERRORs)
  const pricedPlans = plans.filter(
    p => !p.isEnterprise && p.priceMonthly !== null && p.priceMonthly !== undefined && p.priceMonthly > 0
  );
  const seenNames = new Map(); // name → first plan's priceMonthly
  for (const plan of pricedPlans) {
    if (plan.name) {
      if (seenNames.has(plan.name)) {
        const existingPrice = seenNames.get(plan.name);
        if (Math.abs(existingPrice - plan.priceMonthly) > 0.01) {
          warnings.push({
            product: slug,
            rule: 'plan-name-price-mismatch',
            message: `Two non-enterprise paid plans named "${plan.name}" have different priceMonthly ($${existingPrice} vs $${plan.priceMonthly}) — possible data error`,
          });
        }
      } else {
        seenNames.set(plan.name, plan.priceMonthly);
      }
    }
  }

  return { errors, warnings };
}

// ── MAIN VALIDATION ───────────────────────────────────────────────────────

function runValidation() {
  console.warn(`[validate] Registry loaded: ${featureRegistry.length} feature IDs, ${coreFeatureIds.size} core features, ${validCategories.length} valid categories`);
  console.warn(`[validate] Parsed ${parsedRegistry && parsedRegistry.ids.length > 0 ? 'dynamically from TS files' : 'from hardcoded fallback lists'}`);

  const errors = [];
  const warnings = [];

  if (!existsSync(saasDir)) {
    console.error(`Directory ${saasDir} does not exist`);
    process.exit(1);
  }

  const files = readdirSync(saasDir).filter(f => f.endsWith('.json'));
  const products = [];

  for (const file of files) {
    const slug = file.replace('.json', '');
    const filePath = resolve(saasDir, file);
    const raw = readFileSync(filePath, 'utf-8');

    // ── NEW Rule: Duplicate JSON keys ──────────────────────────────────────
    // Must run on raw text BEFORE JSON.parse, because JSON.parse silently
    // keeps the last value when a key appears more than once.
    const dupKeys = detectDuplicateKeys(raw);
    for (const key of dupKeys) {
      errors.push({
        product: slug,
        rule: 'duplicate-json-key',
        message: `Duplicate JSON key "${key}" in object literal — JSON.parse silently overwrites it`,
      });
    }

    let product;
    try {
      product = JSON.parse(raw);
      products.push(product);
    } catch (e) {
      errors.push({ product: file, rule: 'json-parse', message: `Invalid JSON: ${e.message}` });
      continue;
    }

    // Rule 1: Affiliate placeholder check.
    // Keep this pattern set in sync with src/lib/affiliates.ts and the
    // content.config.ts refine. Catches copy-pasted template IDs like
    // ".../c/12345/67890" that earn nothing and break trust.
    if (product.affiliateUrl) {
      const AFFILIATE_PLACEHOLDER = /(12345|67890|98765|your[-_]?(id|ref|affiliate)|example|placeholder|changeme|todo|xxxx+|localhost|127\.0\.0\.1)/i;
      if (AFFILIATE_PLACEHOLDER.test(product.affiliateUrl)) {
        errors.push({ product: slug, rule: 'affiliate-placeholder', message: `affiliateUrl looks like a placeholder: ${product.affiliateUrl}` });
      }
      if (!/^https:\/\//.test(product.affiliateUrl)) {
        errors.push({ product: slug, rule: 'affiliate-insecure', message: 'affiliateUrl must use https://' });
      }
    }

    // Rule 1b: Category validity check (must be in CATEGORY_ORDER)
    if (product.category) {
      if (!validCategorySet.has(product.category)) {
        errors.push({ product: slug, rule: 'category-invalid', message: `category "${product.category}" is not a valid SaaS category. Must be one of: ${validCategories.join(', ')}` });
      }
    } else {
      errors.push({ product: slug, rule: 'category-missing', message: 'Product is missing required "category" field' });
    }

    // Rule 2: Registry reference check
    if (product.featureIds) {
      for (const fid of product.featureIds) {
        if (!featureRegistry.includes(fid)) {
          errors.push({ product: slug, rule: 'registry-ref-check', message: `featureId "${fid}" not in registry` });
        }
      }
    }

    // Rule 3: Feature uniqueness
    if (product.proprietaryFeatures) {
      for (const pf of product.proprietaryFeatures) {
        if (featureRegistry.includes(pf.id)) {
          errors.push({ product: slug, rule: 'feature-uniqueness', message: `proprietaryFeature "${pf.id}" duplicates registry` });
        }
      }
    }

    // Rule 3b: Core feature count (warning — each product should have ≥1 core feature)
    if (product.featureIds && Array.isArray(product.featureIds)) {
      const coreCount = product.featureIds.filter(fid => coreFeatureIds.has(fid)).length;
      if (coreCount === 0) {
        warnings.push({ product: slug, rule: 'core-feature-missing', message: 'Product has 0 core features (type === "core"). Consider adding at least 1 domain-differentiating feature.' });
      }
    }

    // Rule 4: Staleness check. A warning by default; an ERROR when the scheduled
    // freshness job runs with STRICT_FRESHNESS=1, so stale pricing can never ship
    // silently past the 90-day line. See .github/workflows/refresh-pricing.yml.
    if (product.lastVerified) {
      const verified = new Date(product.lastVerified + 'T00:00:00Z');
      const daysAgo = (Date.now() - verified.getTime()) / (1000 * 60 * 60 * 24);
      if (daysAgo > 90) {
        const entry = { product: slug, rule: 'staleness', message: `lastVerified is ${Math.round(daysAgo)} days old (>90d)` };
        if (STRICT_FRESHNESS) errors.push(entry);
        else warnings.push(entry);
      }
    }

    // Rule 5: Plan sanity
    if (!product.plans || product.plans.length < 1) {
      errors.push({ product: slug, rule: 'plan-sanity', message: 'Must have at least 1 plan' });
    } else {
      for (const plan of product.plans) {
        // Enterprise plans can have null pricing (custom/contact)
        if (plan.priceMonthly === null && plan.priceAnnually === null && !plan.isEnterprise) {
          errors.push({ product: slug, rule: 'plan-sanity', message: `Plan "${plan.id}" has both prices null` });
        }
      }
    }

    // Rule 6: Price realism
    if (product.plans) {
      for (const plan of product.plans) {
        if (plan.priceMonthly !== null && plan.priceMonthly < 0) {
          errors.push({ product: slug, rule: 'price-realism', message: `Plan "${plan.id}" has negative priceMonthly` });
        }
        if (plan.priceMonthly !== null && plan.priceMonthly > 0 && plan.priceMonthly < 1) {
          warnings.push({ product: slug, rule: 'price-realism', message: `Plan "${plan.id}" has priceMonthly ${plan.priceMonthly} (below $1)` });
        }
        // Validate migrationComplexity is a valid enum value
        if (plan.migrationComplexity !== undefined && !['low','medium','high'].includes(plan.migrationComplexity)) {
          warnings.push({ product: slug, rule: 'migration-complexity', message: `Plan "${plan.id}" has invalid migrationComplexity "${plan.migrationComplexity}"` });
        }
      }
    }

    // Rule 6c: Price consistency check (priceAnnually should not exceed priceMonthly * 12)
    if (product.plans) {
      for (const plan of product.plans) {
        if (plan.priceMonthly !== null && plan.priceAnnually !== null && plan.priceMonthly > 0) {
          if (plan.priceAnnually > plan.priceMonthly * 12 + 0.01) {
            errors.push({ product: slug, rule: 'price-consistency', message: `Plan "${plan.id}" has annual pricing ($${plan.priceAnnually}) exceeding monthly pricing 12x equivalent ($${(plan.priceMonthly * 12).toFixed(2)})` });
          }
        }
      }
    }

    // ── NEW Rule: Add-on price coherence ──────────────────────────────────
    // ── NEW Rule: Data provenance warning ─────────────────────────────────
    if (product.plans) {
      for (const plan of product.plans) {
        const addOnResult = validateAddOnPricing(plan, slug);
        errors.push(...addOnResult.errors);
        warnings.push(...addOnResult.warnings);

        const provenanceResult = validateDataProvenance(plan, slug);
        warnings.push(...provenanceResult.warnings);
      }
    }

    // ── NEW Rule: Duplicate plan IDs + price-monotonicity ─────────────────
    if (product.plans) {
      const planIdResult = validateDuplicatePlanIds(product.plans, slug);
      errors.push(...planIdResult.errors);
      warnings.push(...planIdResult.warnings);
    }

    // Rule 6b: Open source alternatives validation
    if (product.openSourceAlternatives && Array.isArray(product.openSourceAlternatives)) {
      // Build set of all known feature IDs for this product
      const knownFeatureIds = new Set([
        ...(product.featureIds || []),
        ...(product.proprietaryFeatures || []).map(pf => pf.id),
      ]);
      for (const alt of product.openSourceAlternatives) {
        if (alt.replaces && !knownFeatureIds.has(alt.replaces)) {
          warnings.push({ product: slug, rule: 'oss-alt-feature-check', message: `openSourceAlternative "${alt.name}" replaces "${alt.replaces}" which is not a registered featureId or proprietaryFeature of this product` });
        }
      }
    }
  }

  // Rule 7: Duplicate slugs
  const slugs = new Set();
  for (const p of products) {
    if (slugs.has(p.slug)) {
      errors.push({ product: p.slug, rule: 'duplicate-slugs', message: `Duplicate slug "${p.slug}"` });
    }
    slugs.add(p.slug);
  }

  const report = {
    timestamp: new Date().toISOString(),
    totalProducts: products.length,
    errors,
    warnings,
    exitCode: errors.length > 0 ? 1 : 0,
  };

  console.log(JSON.stringify(report, null, 2));

  process.exit(report.exitCode);
}

// ── ENTRY POINT GUARD ─────────────────────────────────────────────────────
// Only execute the main validation loop when this file is invoked directly
// as a CLI script (node scripts/validate-data.mjs). When vitest imports the
// module to test the exported pure functions, _runningAsScript is false and
// process.exit() is never called.
const _runningAsScript = (() => {
  try {
    // resolve() normalises separators on Windows, making the comparison reliable
    return resolve(process.argv[1] || '') === __filename;
  } catch (_e) {
    return false;
  }
})();

if (_runningAsScript) {
  runValidation();
}
