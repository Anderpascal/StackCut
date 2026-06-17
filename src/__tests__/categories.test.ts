/**
 * Tests for src/lib/categories.ts
 *
 * Covers:
 *  - COMPARISON_SILOS structure: all 10 categories as keys
 *  - COMPARISON_SILOS values reference valid categories
 *  - areCategoriesComparable() for same-silo pairs returns true
 *  - areCategoriesComparable() for cross-silo pairs returns false
 *  - Symmetry: A comparable with B ⇒ B comparable with A
 *  - Self-comparison: every category is comparable with itself
 *  - RELATED_CATEGORIES sanity check (not modified)
 *  - CATEGORY_ORDER structure
 */

import {
  COMPARISON_SILOS,
  RELATED_CATEGORIES,
  CATEGORY_ORDER,
  areCategoriesComparable,
  groupProductsByCategory,
} from '../lib/categories';
import type { SaaSProductData } from '../types/saas';
import { createMockProduct } from './helpers';

// ─── CATEGORY_ORDER ─────────────────────────────────────────────────────────

describe('CATEGORY_ORDER', () => {
  it('should contain exactly 10 categories', () => {
    expect(CATEGORY_ORDER).toHaveLength(10);
  });

  it('should contain all expected category names', () => {
    const expected = [
      'CRM & Sales',
      'Communication',
      'Customer Support',
      'Dev Tools',
      'Email Marketing',
      'Productivity & Wiki',
      'Project Management',
      'Video Conferencing',
      'Design',
      'Monitoring',
    ];
    for (const cat of expected) {
      expect(CATEGORY_ORDER).toContain(cat);
    }
  });
});

// ─── RELATED_CATEGORIES (sanity check — not modified) ───────────────────────

describe('RELATED_CATEGORIES', () => {
  it('should have all 10 categories as keys', () => {
    const expectedCategories = [
      'CRM & Sales',
      'Customer Support',
      'Communication',
      'Project Management',
      'Video Conferencing',
      'Email Marketing',
      'Productivity & Wiki',
      'Dev Tools',
      'Design',
      'Monitoring',
    ];
    for (const cat of expectedCategories) {
      expect(RELATED_CATEGORIES).toHaveProperty(cat);
    }
  });

  it('should include each category itself as first entry', () => {
    for (const [cat, related] of Object.entries(RELATED_CATEGORIES)) {
      expect(related[0]).toBe(cat);
    }
  });

  it('should not be empty for any category', () => {
    for (const related of Object.values(RELATED_CATEGORIES)) {
      expect(related.length).toBeGreaterThan(0);
    }
  });
});

// ─── COMPARISON_SILOS structure ─────────────────────────────────────────────

describe('COMPARISON_SILOS', () => {
  it('should have a key for every category in CATEGORY_ORDER', () => {
    for (const cat of CATEGORY_ORDER) {
      expect(COMPARISON_SILOS).toHaveProperty(cat);
    }
  });

  it('should have exactly 10 keys', () => {
    expect(Object.keys(COMPARISON_SILOS)).toHaveLength(10);
  });

  it('each category should include itself in its silo', () => {
    for (const [cat, silo] of Object.entries(COMPARISON_SILOS)) {
      expect(silo).toContain(cat);
    }
  });

  it('all values (referenced categories) should exist as keys in COMPARISON_SILOS', () => {
    const allKeys = new Set(Object.keys(COMPARISON_SILOS));
    for (const silo of Object.values(COMPARISON_SILOS)) {
      for (const refCat of silo) {
        expect(allKeys.has(refCat)).toBe(true);
      }
    }
  });

  it('should have no duplicate entries within any silo', () => {
    for (const [cat, silo] of Object.entries(COMPARISON_SILOS)) {
      const unique = new Set(silo);
      expect(unique.size).toBe(silo.length);
    }
  });
});

// ─── areCategoriesComparable — same-silo pairs ─────────────────────────────

describe('areCategoriesComparable — comparable pairs', () => {
  it('CRM & Sales should be comparable with Email Marketing', () => {
    expect(areCategoriesComparable('CRM & Sales', 'Email Marketing')).toBe(true);
  });

  it('CRM & Sales should be comparable with Customer Support', () => {
    expect(areCategoriesComparable('CRM & Sales', 'Customer Support')).toBe(true);
  });

  it('Communication should be comparable with Video Conferencing', () => {
    expect(areCategoriesComparable('Communication', 'Video Conferencing')).toBe(true);
  });

  it('every category should be comparable with itself', () => {
    for (const cat of CATEGORY_ORDER) {
      expect(areCategoriesComparable(cat, cat)).toBe(true);
    }
  });
});

// ─── areCategoriesComparable — cross-silo pairs (should be false) ──────────

describe('areCategoriesComparable — non-comparable pairs', () => {
  it('Dev Tools should NOT be comparable with Communication', () => {
    expect(areCategoriesComparable('Dev Tools', 'Communication')).toBe(false);
  });

  it('Dev Tools should NOT be comparable with Video Conferencing', () => {
    expect(areCategoriesComparable('Dev Tools', 'Video Conferencing')).toBe(false);
  });

  it('Dev Tools should NOT be comparable with CRM & Sales', () => {
    expect(areCategoriesComparable('Dev Tools', 'CRM & Sales')).toBe(false);
  });

  it('Dev Tools should NOT be comparable with Email Marketing', () => {
    expect(areCategoriesComparable('Dev Tools', 'Email Marketing')).toBe(false);
  });

  it('Dev Tools should NOT be comparable with Design', () => {
    expect(areCategoriesComparable('Dev Tools', 'Design')).toBe(false);
  });

  it('Dev Tools should NOT be comparable with Customer Support', () => {
    expect(areCategoriesComparable('Dev Tools', 'Customer Support')).toBe(false);
  });

  it('Dev Tools should NOT be comparable with Monitoring', () => {
    expect(areCategoriesComparable('Dev Tools', 'Monitoring')).toBe(false);
  });

  it('Monitoring should NOT be comparable with Communication', () => {
    expect(areCategoriesComparable('Monitoring', 'Communication')).toBe(false);
  });

  it('Monitoring should NOT be comparable with CRM & Sales', () => {
    expect(areCategoriesComparable('Monitoring', 'CRM & Sales')).toBe(false);
  });

  it('Monitoring should NOT be comparable with Email Marketing', () => {
    expect(areCategoriesComparable('Monitoring', 'Email Marketing')).toBe(false);
  });

  it('Monitoring should NOT be comparable with Customer Support', () => {
    expect(areCategoriesComparable('Monitoring', 'Customer Support')).toBe(false);
  });

  it('CRM & Sales should NOT be comparable with Video Conferencing', () => {
    expect(areCategoriesComparable('CRM & Sales', 'Video Conferencing')).toBe(false);
  });

  it('Communication should NOT be comparable with CRM & Sales', () => {
    expect(areCategoriesComparable('Communication', 'CRM & Sales')).toBe(false);
  });

  it('Project Management should NOT be comparable with Productivity & Wiki', () => {
    expect(areCategoriesComparable('Project Management', 'Productivity & Wiki')).toBe(false);
  });

  it('Project Management should NOT be comparable with Dev Tools', () => {
    expect(areCategoriesComparable('Project Management', 'Dev Tools')).toBe(false);
  });

  it('Design should NOT be comparable with Productivity & Wiki', () => {
    expect(areCategoriesComparable('Design', 'Productivity & Wiki')).toBe(false);
  });
});

// ─── Symmetry ───────────────────────────────────────────────────────────────

describe('areCategoriesComparable — symmetry', () => {
  it('if A is comparable with B, then B should be comparable with A (all combinations)', () => {
    const allCategories = Object.keys(COMPARISON_SILOS);
    for (const catA of allCategories) {
      for (const catB of allCategories) {
        const resultAB = areCategoriesComparable(catA, catB);
        const resultBA = areCategoriesComparable(catB, catA);
        expect(resultAB).toBe(resultBA);
      }
    }
  });

  it('CRM & Sales ↔ Email Marketing symmetry', () => {
    const forward = areCategoriesComparable('CRM & Sales', 'Email Marketing');
    const backward = areCategoriesComparable('Email Marketing', 'CRM & Sales');
    expect(forward).toBe(backward);
    expect(forward).toBe(true);
  });

  it('Communication ↔ Video Conferencing symmetry', () => {
    const forward = areCategoriesComparable('Communication', 'Video Conferencing');
    const backward = areCategoriesComparable('Video Conferencing', 'Communication');
    expect(forward).toBe(backward);
    expect(forward).toBe(true);
  });
});

// ─── groupProductsByCategory ────────────────────────────────────────────────

describe('groupProductsByCategory', () => {
  it('should group products by their category', () => {
    const p1 = createMockProduct({ id: 'a', category: 'Dev Tools' });
    const p2 = createMockProduct({ id: 'b', category: 'Design' });
    const p3 = createMockProduct({ id: 'c', category: 'Dev Tools' });
    const result = groupProductsByCategory([p1, p2, p3] as SaaSProductData[]);
    expect(result['Dev Tools']).toHaveLength(2);
    expect(result['Design']).toHaveLength(1);
  });

  it('should return empty object for empty input', () => {
    expect(groupProductsByCategory([])).toEqual({});
  });

  it('should handle products with the same category', () => {
    const p1 = createMockProduct({ id: 'a', category: 'CRM & Sales' });
    const p2 = createMockProduct({ id: 'b', category: 'CRM & Sales' });
    const result = groupProductsByCategory([p1, p2] as SaaSProductData[]);
    expect(Object.keys(result)).toHaveLength(1);
    expect(result['CRM & Sales']).toHaveLength(2);
  });
});
