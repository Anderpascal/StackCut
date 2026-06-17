import type { SaaSProductData } from '../types/saas';

/**
 * Mapa de categorías relacionadas para búsqueda de alternativas.
 * Las claves DEBEN coincidir con las categorías del enum en content.config.ts.
 * Cada categoría se incluye a sí misma como primera entrada.
 */
export const RELATED_CATEGORIES: Record<string, string[]> = {
  'CRM & Sales':         ['CRM & Sales', 'Customer Support', 'Email Marketing'],
  'Customer Support':    ['Customer Support', 'CRM & Sales', 'Communication'],
  'Communication':       ['Communication', 'Video Conferencing'],
  'Project Management':  ['Project Management', 'Productivity & Wiki', 'Dev Tools'],
  'Video Conferencing':  ['Video Conferencing', 'Communication'],
  'Email Marketing':     ['Email Marketing', 'CRM & Sales'],
  'Productivity & Wiki': ['Productivity & Wiki', 'Project Management', 'Design'],
  'Dev Tools':           ['Dev Tools', 'Project Management', 'Monitoring'],
  'Design':              ['Design', 'Productivity & Wiki', 'Project Management'],
  'Monitoring':          ['Monitoring', 'Dev Tools'],
};

/**
 * Silos de comparación para detección de REDUNDANCIA en StackAuditor.
 *
 * A DIFERENCIA de RELATED_CATEGORIES (usado en DowngradeEngine para buscar
 * ALTERNATIVAS), COMPARISON_SILOS es más RESTRICTIVO. Dos herramientas solo
 * se comparan si sus categorías pertenecen al mismo silo.
 *
 * Principio rector: dos categorías son comparables si y solo si las herramientas
 * de ambas pueden SUSTITUIRSE en algún escenario de negocio real.
 */
export const COMPARISON_SILOS: Record<string, string[]> = {
  'CRM & Sales':         ['CRM & Sales', 'Email Marketing'],
  'Customer Support':    ['Customer Support', 'CRM & Sales'],
  'Communication':       ['Communication', 'Video Conferencing'],
  'Project Management':  ['Project Management'],
  'Video Conferencing':  ['Video Conferencing', 'Communication'],
  'Email Marketing':     ['Email Marketing', 'CRM & Sales'],
  'Productivity & Wiki': ['Productivity & Wiki'],
  'Dev Tools':           ['Dev Tools'],
  'Design':              ['Design'],
  'Monitoring':          ['Monitoring'],
};

/**
 * Verifica si dos categorías SaaS pertenecen al mismo silo de comparación.
 * Consulta O(1): búsqueda en array de ≤5 elementos.
 *
 * @returns true si las herramientas de cat1 y cat2 pueden compararse para redundancia.
 */
export function areCategoriesComparable(cat1: string, cat2: string): boolean {
  // Misma categoría: siempre comparable
  if (cat1 === cat2) return true;
  // Verificar si cat2 está en el silo de cat1
  const silo = COMPARISON_SILOS[cat1];
  if (silo && silo.includes(cat2)) return true;
  // Verificar simétricamente (cat1 en el silo de cat2)
  const silo2 = COMPARISON_SILOS[cat2];
  if (silo2 && silo2.includes(cat1)) return true;
  return false;
}

/**
 * Orden canónico de categorías para renderizado de <optgroup>.
 * El orden es significativo: así aparecerán en los selectores.
 */
export const CATEGORY_ORDER: string[] = [
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

/**
 * Agrupa productos por su campo `category`.
 * @returns Record<string, SaaSProductData[]> solo con categorías que tengan ≥1 producto.
 */
export function groupProductsByCategory(
  products: SaaSProductData[]
): Record<string, SaaSProductData[]> {
  const grouped: Record<string, SaaSProductData[]> = {};
  for (const p of products) {
    if (!grouped[p.category]) {
      grouped[p.category] = [];
    }
    grouped[p.category].push(p);
  }
  return grouped;
}
