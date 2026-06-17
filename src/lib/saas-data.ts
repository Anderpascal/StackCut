import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { RELATED_CATEGORIES } from './categories';

export type SaaSProduct = CollectionEntry<'saas'>['data'];

export async function getAllProducts(): Promise<SaaSProduct[]> {
  const entries = await getCollection('saas');
  return entries.map(e => ({ ...e.data, slug: e.data.slug }));
}

export async function getProductBySlug(slug: string): Promise<SaaSProduct | undefined> {
  const products = await getAllProducts();
  return products.find(p => p.slug === slug);
}

export async function getAllSlugs(): Promise<string[]> {
  const products = await getAllProducts();
  return products.map(p => p.slug);
}

export async function getAlternatives(product: SaaSProduct): Promise<SaaSProduct[]> {
  const products = await getAllProducts();
  const relatedCategories = RELATED_CATEGORIES[product.category] || [product.category];
  return products.filter(p => p.id !== product.id && relatedCategories.includes(p.category));
}

export async function getRelatedComparisons(): Promise<{ p1: SaaSProduct; p2: SaaSProduct }[]> {
  const products = await getAllProducts();
  const pairs: { p1: SaaSProduct; p2: SaaSProduct }[] = [];
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const relatedP1 = RELATED_CATEGORIES[products[i].category] || [];
      if (relatedP1.includes(products[j].category)) {
        pairs.push({ p1: products[i], p2: products[j] });
      }
    }
  }
  return pairs;
}
