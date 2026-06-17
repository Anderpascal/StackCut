/**
 * Tests for the new validation rules added to scripts/validate-data.mjs.
 *
 * All fixtures are inline strings — no real data files are read.
 * The module is imported for its exported pure functions only; the main
 * validation loop is guarded by _runningAsScript and does NOT execute
 * during the test run.
 *
 * Covered rules:
 *  - detectDuplicateKeys     (Rule 1 — duplicate JSON keys in raw text)
 *  - validateAddOnPricing    (Rule 2 — add-on price coherence)
 *  - validateDataProvenance  (Rule 3 — sourceUrl/capturedAt provenance)
 *  - validateDuplicatePlanIds (Rule 4 — duplicate plan IDs + name/price mismatch)
 */

import { describe, it, expect } from 'vitest';

// @ts-ignore — validate-data.mjs is a plain-JS ESM module; vitest/vite resolves it fine
import {
  detectDuplicateKeys,
  validateAddOnPricing,
  validateDataProvenance,
  validateDuplicatePlanIds,
} from '../../scripts/validate-data.mjs';

// ─── Type aliases for readability ────────────────────────────────────────────

type ValidationEntry = { product: string; rule: string; message: string };
type AddOnResult = { errors: ValidationEntry[]; warnings: ValidationEntry[] };

// ─── detectDuplicateKeys ─────────────────────────────────────────────────────

describe('detectDuplicateKeys — Rule 1 (duplicate JSON key detector)', () => {
  it('returns [] for an empty object', () => {
    expect(detectDuplicateKeys('{}')).toEqual([]);
  });

  it('returns [] for an object with distinct keys', () => {
    expect(detectDuplicateKeys('{"a": 1, "b": 2, "c": 3}')).toEqual([]);
  });

  it('detects a single duplicate key at the top level', () => {
    const result: string[] = detectDuplicateKeys('{"x": 1, "x": 2}');
    expect(result).toContain('x');
    expect(result).toHaveLength(1);
  });

  it('detects duplicate key regardless of value type (object vs array)', () => {
    // This is the exact class of bug found in slack.json ("addOns" appears twice)
    const raw = `{
      "id": "pro",
      "addOns": [{"id": "a", "priceMonthly": 10, "priceAnnually": 120}],
      "features": {"x": true},
      "addOns": [{"id": "a", "priceMonthly": 10, "priceAnnually": 100}]
    }`;
    const result: string[] = detectDuplicateKeys(raw);
    expect(result).toContain('addOns');
  });

  it('returns [] when the same key name exists in different sibling objects (not duplicate)', () => {
    // "x" appears in two separate nested objects — that is NOT a duplicate
    const raw = '{"a": {"x": 1}, "b": {"x": 2}}';
    expect(detectDuplicateKeys(raw)).toEqual([]);
  });

  it('detects a duplicate inside a nested object', () => {
    const raw = '{"outer": {"inner": 1, "inner": 2}}';
    const result: string[] = detectDuplicateKeys(raw);
    expect(result).toContain('inner');
    expect(result).not.toContain('outer');
  });

  it('does not flag keys in the root when only the nested object has a duplicate', () => {
    const raw = '{"a": 1, "b": {"c": 1, "c": 2}}';
    const result: string[] = detectDuplicateKeys(raw);
    expect(result).toContain('c');
    expect(result).not.toContain('a');
    expect(result).not.toContain('b');
  });

  it('handles string values containing braces without being confused', () => {
    // The value of "trap" looks like JSON with a duplicate key — should be ignored
    const raw = '{"trap": "{\\"x\\": 1, \\"x\\": 2}", "clean": 3}';
    expect(detectDuplicateKeys(raw)).toEqual([]);
  });

  it('handles escaped quotes inside string keys correctly', () => {
    // Key is literally: a"b (with an embedded quote)
    const raw = '{"a\\"b": 1, "a\\"b": 2}';
    const result: string[] = detectDuplicateKeys(raw);
    expect(result).toContain('a"b');
  });

  it('handles string values containing quote characters without ending string early', () => {
    const raw = '{"key": "value with \\"embedded\\" quotes", "other": 1}';
    expect(detectDuplicateKeys(raw)).toEqual([]);
  });

  it('handles arrays at the root level', () => {
    const raw = '[{"a": 1, "a": 2}, {"b": 1}]';
    const result: string[] = detectDuplicateKeys(raw);
    expect(result).toContain('a');
    expect(result).not.toContain('b');
  });

  it('detects multiple distinct duplicate keys in the same object', () => {
    const raw = '{"x": 1, "y": "a", "x": 2, "y": "b"}';
    const result: string[] = detectDuplicateKeys(raw);
    expect(result).toContain('x');
    expect(result).toContain('y');
    expect(result).toHaveLength(2);
  });

  it('handles unicode escape sequences in strings without confusing the scanner', () => {
    // " is the Unicode for '"' — should NOT end the string
    const raw = '{"key": "\\u0022quoted\\u0022", "other": 1}';
    expect(detectDuplicateKeys(raw)).toEqual([]);
  });

  it('handles a realistic slack.json-shaped snippet with duplicate addOns', () => {
    // Mirrors the actual defect: "addOns" key duplicated in the "pro" plan object
    const raw = JSON.stringify({
      id: 'slack',
      plans: [
        {
          id: 'free',
          priceMonthly: 0,
        },
      ],
    }).replace(
      '"plans"',
      // Inject a raw duplicate-key object as the "pro" plan
      '"plans"'
    );
    // Direct fixture test — use a literal raw string that has the duplicate
    const rawWithDuplicate = `{
  "id": "slack",
  "plans": [
    {
      "id": "pro",
      "priceMonthly": 8.75,
      "addOns": [{"id": "slack_ai", "priceMonthly": 10, "priceAnnually": 120}],
      "features": {"integrations": true},
      "addOns": [{"id": "slack_ai", "priceMonthly": 10, "priceAnnually": 100}]
    }
  ]
}`;
    const result: string[] = detectDuplicateKeys(rawWithDuplicate);
    expect(result).toContain('addOns');
  });
});

// ─── validateAddOnPricing ─────────────────────────────────────────────────────

describe('validateAddOnPricing — Rule 2 (add-on price coherence)', () => {
  const slug = 'test-product';

  it('returns empty results when plan has no addOns', () => {
    const plan = { id: 'pro', priceMonthly: 15 };
    const result: AddOnResult = validateAddOnPricing(plan, slug);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns empty results when addOns is an empty array', () => {
    const plan = { id: 'pro', addOns: [] };
    const result: AddOnResult = validateAddOnPricing(plan, slug);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('passes when priceAnnually equals priceMonthly * 12 exactly', () => {
    const plan = {
      id: 'pro',
      addOns: [{ id: 'addon-a', priceMonthly: 10, priceAnnually: 120 }],
    };
    const result: AddOnResult = validateAddOnPricing(plan, slug);
    expect(result.errors).toHaveLength(0);
  });

  it('passes when priceAnnually is less than priceMonthly * 12 (annual discount)', () => {
    const plan = {
      id: 'pro',
      addOns: [{ id: 'addon-a', priceMonthly: 10, priceAnnually: 100 }],
    };
    const result: AddOnResult = validateAddOnPricing(plan, slug);
    expect(result.errors).toHaveLength(0);
  });

  it('errors when priceAnnually exceeds priceMonthly * 12 + 0.01', () => {
    // priceMonthly=10 → threshold = 120.01; priceAnnually=121 → ERROR
    const plan = {
      id: 'pro',
      addOns: [{ id: 'slack_ai', priceMonthly: 10, priceAnnually: 121 }],
    };
    const result: AddOnResult = validateAddOnPricing(plan, slug);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule).toBe('addon-price-consistency');
    expect(result.errors[0].product).toBe(slug);
    expect(result.errors[0].message).toContain('slack_ai');
  });

  it('does NOT error when priceAnnually is within the 0.01 tolerance', () => {
    // priceMonthly=10 → threshold = 120.01; priceAnnually=120.005 → OK
    const plan = {
      id: 'pro',
      addOns: [{ id: 'addon-a', priceMonthly: 10, priceAnnually: 120.005 }],
    };
    const result: AddOnResult = validateAddOnPricing(plan, slug);
    expect(result.errors).toHaveLength(0);
  });

  it('warns when priceMonthly is set but priceAnnually is null (incomplete)', () => {
    const plan = {
      id: 'pro',
      addOns: [{ id: 'addon-b', priceMonthly: 5, priceAnnually: null }],
    };
    const result: AddOnResult = validateAddOnPricing(plan, slug);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].rule).toBe('addon-price-incomplete');
  });

  it('does not warn for usage-based (per_unit) add-ons with no priceAnnually', () => {
    // Usage add-ons (e.g. $0.90 per AI resolution) are billed per consumption
    // and have no annual equivalent — should be exempt from the completeness check.
    const plan = {
      id: 'pro',
      addOns: [{ id: 'ai_resolutions', priceMonthly: 0.9, priceAnnually: null, unit: 'per_unit' }],
    };
    const result: AddOnResult = validateAddOnPricing(plan, slug);
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('warns when priceAnnually is set but priceMonthly is null (incomplete)', () => {
    const plan = {
      id: 'pro',
      addOns: [{ id: 'addon-c', priceMonthly: null, priceAnnually: 60 }],
    };
    const result: AddOnResult = validateAddOnPricing(plan, slug);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].rule).toBe('addon-price-incomplete');
  });

  it('does not warn when both prices are null (add-on with no pricing)', () => {
    const plan = {
      id: 'enterprise',
      addOns: [{ id: 'addon-d', priceMonthly: null, priceAnnually: null }],
    };
    const result: AddOnResult = validateAddOnPricing(plan, slug);
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('checks each add-on independently', () => {
    const plan = {
      id: 'pro',
      addOns: [
        { id: 'ok-addon', priceMonthly: 10, priceAnnually: 100 },    // OK
        { id: 'bad-addon', priceMonthly: 10, priceAnnually: 130 },   // ERROR
        { id: 'incomplete', priceMonthly: 5, priceAnnually: null },  // WARN
      ],
    };
    const result: AddOnResult = validateAddOnPricing(plan, slug);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('bad-addon');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain('incomplete');
  });
});

// ─── validateDataProvenance ───────────────────────────────────────────────────

describe('validateDataProvenance — Rule 3 (price provenance warning)', () => {
  const slug = 'test-product';

  it('does not warn for enterprise plans (custom pricing, no public source needed)', () => {
    const plan = { id: 'enterprise', priceMonthly: 500, isEnterprise: true };
    const result = validateDataProvenance(plan, slug);
    expect(result.warnings).toHaveLength(0);
  });

  it('does not warn for free plans (priceMonthly = 0)', () => {
    const plan = { id: 'free', priceMonthly: 0, isEnterprise: false };
    const result = validateDataProvenance(plan, slug);
    expect(result.warnings).toHaveLength(0);
  });

  it('does not warn for plans with null priceMonthly', () => {
    const plan = { id: 'custom', priceMonthly: null, isEnterprise: false };
    const result = validateDataProvenance(plan, slug);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when a paid non-enterprise plan has neither sourceUrl nor capturedAt', () => {
    const plan = { id: 'pro', priceMonthly: 15, isEnterprise: false };
    const result = validateDataProvenance(plan, slug);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].rule).toBe('data-provenance');
    expect(result.warnings[0].product).toBe(slug);
    expect(result.warnings[0].message).toContain('pro');
  });

  it('does not warn when sourceUrl is present', () => {
    const plan = {
      id: 'pro',
      priceMonthly: 15,
      isEnterprise: false,
      sourceUrl: 'https://example.com/pricing',
    };
    const result = validateDataProvenance(plan, slug);
    expect(result.warnings).toHaveLength(0);
  });

  it('does not warn when capturedAt is present', () => {
    const plan = {
      id: 'pro',
      priceMonthly: 15,
      isEnterprise: false,
      capturedAt: '2026-06-13',
    };
    const result = validateDataProvenance(plan, slug);
    expect(result.warnings).toHaveLength(0);
  });

  it('does not warn when both sourceUrl and capturedAt are present', () => {
    const plan = {
      id: 'pro',
      priceMonthly: 15,
      isEnterprise: false,
      sourceUrl: 'https://example.com/pricing',
      capturedAt: '2026-06-13',
    };
    const result = validateDataProvenance(plan, slug);
    expect(result.warnings).toHaveLength(0);
  });

  it('treats an empty-string sourceUrl as missing (still warns)', () => {
    const plan = {
      id: 'pro',
      priceMonthly: 15,
      isEnterprise: false,
      sourceUrl: '   ',   // whitespace-only
    };
    const result = validateDataProvenance(plan, slug);
    expect(result.warnings).toHaveLength(1);
  });
});

// ─── validateDuplicatePlanIds ─────────────────────────────────────────────────

describe('validateDuplicatePlanIds — Rule 4 (duplicate plan ID / name-price mismatch)', () => {
  const slug = 'test-product';

  it('returns empty results for an empty plans array', () => {
    const result = validateDuplicatePlanIds([], slug);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns empty results for a single plan', () => {
    const plans = [{ id: 'free', name: 'Free', priceMonthly: 0, isEnterprise: false }];
    const result = validateDuplicatePlanIds(plans, slug);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns empty results when all plan IDs are distinct', () => {
    const plans = [
      { id: 'free', name: 'Free', priceMonthly: 0, isEnterprise: false },
      { id: 'pro', name: 'Pro', priceMonthly: 15, isEnterprise: false },
      { id: 'enterprise', name: 'Enterprise', priceMonthly: null, isEnterprise: true },
    ];
    const result = validateDuplicatePlanIds(plans, slug);
    expect(result.errors).toHaveLength(0);
  });

  it('errors when two plans share the same id', () => {
    const plans = [
      { id: 'pro', name: 'Pro', priceMonthly: 15, isEnterprise: false },
      { id: 'pro', name: 'Pro Plus', priceMonthly: 25, isEnterprise: false },
    ];
    const result = validateDuplicatePlanIds(plans, slug);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].rule).toBe('duplicate-plan-id');
    expect(result.errors[0].product).toBe(slug);
    expect(result.errors[0].message).toContain('"pro"');
  });

  it('errors for each occurrence beyond the first when there are 3+ plans with the same id', () => {
    const plans = [
      { id: 'pro', name: 'Pro A', priceMonthly: 10, isEnterprise: false },
      { id: 'pro', name: 'Pro B', priceMonthly: 20, isEnterprise: false },
      { id: 'pro', name: 'Pro C', priceMonthly: 30, isEnterprise: false },
    ];
    const result = validateDuplicatePlanIds(plans, slug);
    // Two extras beyond the first → 2 errors
    expect(result.errors).toHaveLength(2);
  });

  it('warns when two non-enterprise paid plans share the same name but different prices', () => {
    const plans = [
      { id: 'pro-usd', name: 'Pro', priceMonthly: 15, isEnterprise: false },
      { id: 'pro-eur', name: 'Pro', priceMonthly: 13, isEnterprise: false },
    ];
    const result = validateDuplicatePlanIds(plans, slug);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].rule).toBe('plan-name-price-mismatch');
    expect(result.warnings[0].message).toContain('"Pro"');
  });

  it('does not warn when two non-enterprise paid plans share the same name AND same price', () => {
    const plans = [
      { id: 'pro-a', name: 'Pro', priceMonthly: 15, isEnterprise: false },
      { id: 'pro-b', name: 'Pro', priceMonthly: 15, isEnterprise: false },
    ];
    const result = validateDuplicatePlanIds(plans, slug);
    expect(result.warnings).toHaveLength(0);
  });

  it('does not warn for same-name plans when one is enterprise (null pricing)', () => {
    const plans = [
      { id: 'business', name: 'Business', priceMonthly: 50, isEnterprise: false },
      { id: 'enterprise', name: 'Business', priceMonthly: null, isEnterprise: true },
    ];
    const result = validateDuplicatePlanIds(plans, slug);
    expect(result.warnings).toHaveLength(0);
  });

  it('does not warn for same-name plans when one is free (priceMonthly = 0)', () => {
    const plans = [
      { id: 'free-a', name: 'Free', priceMonthly: 0, isEnterprise: false },
      { id: 'free-b', name: 'Free', priceMonthly: 0, isEnterprise: false },
    ];
    const result = validateDuplicatePlanIds(plans, slug);
    expect(result.warnings).toHaveLength(0);
  });
});
