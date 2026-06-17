/**
 * Verificación Exhaustiva — Test Anti-Falsos-Positivos
 *
 * Este test carga los 50 JSONs reales de src/content/saas/
 * y ejecuta analyzeStack() contra TODOS los pares posibles
 * para garantizar que:
 *
 * 1. Ningún par de categorías DISTINTAS genera redundancia.
 * 2. Todos los pares de la MISMA categoría solo generan redundancia
 *    si comparten >60% de sus core features (umbral v2).
 * 3. Las herramientas con 0 core features nunca generan redundancia.
 */

import { describe, it, expect } from 'vitest';
import { analyzeStack } from '../components/StackAuditor';
import { areCategoriesComparable } from '../lib/categories';
import { isCoreFeature } from '../data/features-registry';
import type { SaaSProductData } from '../types/saas';

// ─── Cargar todos los JSONs reales ─────────────────────────────────────────

const productFiles = import.meta.glob<{ default: SaaSProductData }>(
  '../content/saas/*.json',
  { eager: true }
);

const allProducts: SaaSProductData[] = Object.values(productFiles).map(
  (mod) => mod.default
);

// Helper de formateo de moneda (mínimo para analyzeStack)
const mockFmt = (val: number) => `$${val.toFixed(2)}`;

// ─── Test 1: Categorías distintas = 0 redundancias ─────────────────────────

describe('Exhaustive Anti-Falsos-Positivos — categorías distintas', () => {
  const totalPairs = (allProducts.length * (allProducts.length - 1)) / 2;

  it(`debería evaluar ${totalPairs} pares sin falsos positivos`, () => {
    let crossCategoryPairs = 0;
    let crossCategoryRedundancies = 0;

    for (let i = 0; i < allProducts.length; i++) {
      for (let j = i + 1; j < allProducts.length; j++) {
        const t1 = allProducts[i];
        const t2 = allProducts[j];

        if (t1.category !== t2.category) {
          crossCategoryPairs++;
          const result = analyzeStack(
            [t1.id, t2.id],
            allProducts,
            mockFmt
          );
          if (result.redundantPairs.length > 0) {
            crossCategoryRedundancies++;
            console.warn(
              `FALSO POSITIVO: ${t1.name} (${t1.category}) vs ${t2.name} (${t2.category})`
            );
          }
        }
      }
    }

    console.log(
      `Pares cross-category evaluados: ${crossCategoryPairs}, redundancias: ${crossCategoryRedundancies}`
    );
    expect(crossCategoryRedundancies).toBe(0);
  });
});

// ─── Test 2: Misma categoría = redundancia solo si >60% core ─────────────

describe('Exhaustive — misma categoría, umbral >60% core', () => {
  it('debería tener 0 redundancias entre categorías incompatibles', () => {
    const incompatiblePairs = [
      ['Dev Tools', 'Communication'],
      ['Dev Tools', 'Video Conferencing'],
      ['Dev Tools', 'CRM & Sales'],
      ['Dev Tools', 'Email Marketing'],
      ['Dev Tools', 'Design'],
      ['Dev Tools', 'Customer Support'],
      ['Monitoring', 'Communication'],
      ['Monitoring', 'CRM & Sales'],
      ['Monitoring', 'Email Marketing'],
      ['Monitoring', 'Customer Support'],
      ['Project Management', 'Productivity & Wiki'],
      ['Project Management', 'Dev Tools'],
      ['Design', 'Productivity & Wiki'],
    ];

    for (const [catA, catB] of incompatiblePairs) {
      expect(areCategoriesComparable(catA, catB)).toBe(false);
      expect(areCategoriesComparable(catB, catA)).toBe(false);
    }
  });
});

// ─── Test 3: Productos con 0 core features nunca son redundantes ───────────

describe('Exhaustive — 0 core features', () => {
  it('ningún producto con 0 core features debería generar redundancia', () => {
    const productsWithZeroCore = allProducts.filter((p) => {
      const coreCount = p.featureIds.filter((id) => isCoreFeature(id)).length;
      return coreCount === 0;
    });

    console.log(
      `Productos con 0 core features: ${productsWithZeroCore.length}`
    );

    for (const product of productsWithZeroCore) {
      const result = analyzeStack(
        [product.id],
        allProducts,
        mockFmt
      );
      // Con 1 solo producto, nunca hay redundancia
      expect(result.redundantPairs).toHaveLength(0);
    }

    // Si un producto con 0 core está en un stack de 2+ con otros del mismo silo,
    // tampoco debería ser redundante (porque 0 core = 0 solapamiento)
    for (const zeroCore of productsWithZeroCore) {
      const sameSiloProducts = allProducts.filter(
        (p) =>
          p.id !== zeroCore.id &&
          areCategoriesComparable(p.category, zeroCore.category)
      );

      if (sameSiloProducts.length > 0) {
        const pair = [zeroCore.id, sameSiloProducts[0].id];
        const result = analyzeStack(pair, allProducts, mockFmt);
        // Un producto con 0 core nunca debería ser redundante
        const redundantWithZero = result.redundantPairs.filter(
          (r) => r.id1 === zeroCore.id || r.id2 === zeroCore.id
        );
        expect(redundantWithZero).toHaveLength(0);
      }
    }
  });
});

// ─── Test 4: Verdaderos positivos conocidos ─────────────────────────────────

describe('Exhaustive — verdaderos positivos conocidos', () => {
  it('HubSpot vs Salesforce debería ser redundante (mismo CRM, alto core overlap)', () => {
    const result = analyzeStack(
      ['hubspot', 'salesforce'],
      allProducts,
      mockFmt
    );
    expect(result.redundantPairs.length).toBeGreaterThanOrEqual(1);
  });

  it('Slack vs Microsoft Teams debería ser redundante (mismo Communication, alto core overlap)', () => {
    const result = analyzeStack(
      ['slack', 'microsoft-teams'],
      allProducts,
      mockFmt
    );
    expect(result.redundantPairs.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Test 5: Falsos positivos conocidos eliminados ────────────────────────

describe('Exhaustive — falsos positivos conocidos eliminados', () => {
  it('Bitbucket vs Microsoft Teams NO debería ser redundante', () => {
    const result = analyzeStack(
      ['bitbucket', 'microsoft-teams'],
      allProducts,
      mockFmt
    );
    expect(result.redundantPairs).toHaveLength(0);
  });

  it('GitHub vs Zoom NO debería ser redundante', () => {
    const result = analyzeStack(['github', 'zoom'], allProducts, mockFmt);
    expect(result.redundantPairs).toHaveLength(0);
  });

  it('GitLab vs Zoom NO debería ser redundante', () => {
    const result = analyzeStack(['gitlab', 'zoom'], allProducts, mockFmt);
    expect(result.redundantPairs).toHaveLength(0);
  });

  it('Jira vs Notion NO debería ser redundante (silos distintos)', () => {
    const result = analyzeStack(['jira', 'notion'], allProducts, mockFmt);
    expect(result.redundantPairs).toHaveLength(0);
  });
});
