import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { getFeaturesByIds } from '../data/features-registry';
import type { RegistryFeature } from '../data/features-registry';
import type { SaaSProductData, SaaSPlanData, ProprietaryFeature } from '../types/saas';
import { RELATED_CATEGORIES, groupProductsByCategory, CATEGORY_ORDER } from '../lib/categories';
import { useCurrencyShared as useCurrency } from '../lib/currency-context';
import { CurrencyProvider } from './CurrencyProvider';
import CurrencySelector from './CurrencySelector';
import AffiliateLink from './AffiliateLink';
import { getMonetizedUrl } from '../lib/affiliates';
import { getFreshness, FRESHNESS_CLASSES } from '../lib/freshness';
import { Check, X, AlertTriangle, ArrowDown, DollarSign, Shield, SearchX } from 'lucide-react';

/** Returns the annual price of a plan, preferring priceAnnually over priceMonthly * 12 */
function getAnnualPrice(plan: SaaSPlanData): number {
  return plan.priceAnnually ?? (plan.priceMonthly ?? 0) * 12;
}

interface Props {
  products: SaaSProductData[];
}

interface FeatureItem {
  id: string;
  name: string;
  description: string;
  isProprietary: boolean;
  isEnterpriseLocked: boolean;
  productName: string;
}

export default function DowngradeEngine({ products }: Props) {
  return (
    <CurrencyProvider>
      <CurrencySelector />
      <DowngradeEngineInner products={products} />
    </CurrencyProvider>
  );
}

function DowngradeEngineInner({ products }: { products: SaaSProductData[] }) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [migrationDays, setMigrationDays] = useState<number>(0);
  const [teamHourlyRate, setTeamHourlyRate] = useState<number>(0);
  const [shareCopied, setShareCopied] = useState(false);

  const { fmt, convert } = useCurrency();

  // ── Shareable / deep-linkable state ──────────────────────────────────────
  // The whole analysis is reconstructable from a URL, so a finance lead can
  // send "here's exactly what I ran" to their team. We hydrate from the query
  // string once on mount, then mirror state back into it as it changes.
  const didHydrate = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const toolParam = params.get('tool');
    const prod = toolParam
      ? products.find(p => p.id === toolParam || p.slug === toolParam)
      : undefined;

    if (prod) {
      setSelectedProductId(prod.id);

      const planParam = params.get('plan');
      const plan = planParam ? prod.plans.find(pl => pl.id === planParam) : undefined;
      if (plan) setSelectedPlanId(plan.id);

      const featParam = params.get('features');
      if (featParam) {
        const validIds = new Set<string>([
          ...prod.featureIds,
          ...prod.proprietaryFeatures.map(f => f.id),
        ]);
        const ids = featParam.split(',').map(s => s.trim()).filter(id => validIds.has(id));
        if (ids.length > 0) setSelectedFeatures(new Set(ids));
      }

      const md = parseInt(params.get('migrationDays') ?? '', 10);
      if (Number.isFinite(md) && md > 0) setMigrationDays(md);
      const rate = parseInt(params.get('rate') ?? '', 10);
      if (Number.isFinite(rate) && rate > 0) setTeamHourlyRate(rate);
    }
    didHydrate.current = true;
    // products is a stable prop for the page; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !didHydrate.current) return;
    const params = new URLSearchParams();
    if (selectedProductId) params.set('tool', selectedProductId);
    if (selectedPlanId) params.set('plan', selectedPlanId);
    if (selectedFeatures.size > 0) params.set('features', [...selectedFeatures].join(','));
    if (migrationDays > 0) params.set('migrationDays', String(migrationDays));
    if (teamHourlyRate > 0) params.set('rate', String(teamHourlyRate));
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [selectedProductId, selectedPlanId, selectedFeatures, migrationDays, teamHourlyRate]);

  const handleCopyShareLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
      if ((window as any).plausible) (window as any).plausible('Downgrade Share Link Copied');
    } catch {
      // Clipboard blocked (e.g. insecure context) — select-as-fallback isn't
      // worth the complexity; the URL is already live in the address bar.
    }
  }, []);

  // Filter products by search term, preserving selected product
  const filteredProducts = useMemo(() => {
    const term = productSearch.toLowerCase().trim();
    if (!term) return products;

    const filtered = products.filter(p => p.name.toLowerCase().includes(term));

    // Preserve the currently selected product even if it doesn't match the filter
    if (selectedProductId) {
      const selectedProduct = products.find(p => p.id === selectedProductId);
      if (selectedProduct && !filtered.some(p => p.id === selectedProductId)) {
        return [selectedProduct, ...filtered];
      }
    }

    return filtered;
  }, [products, productSearch, selectedProductId]);

  const product = useMemo(
    () => products.find(p => p.id === selectedProductId),
    [selectedProductId, products]
  );

  const currentPlan = useMemo(
    () => product?.plans.find(p => p.id === selectedPlanId),
    [product, selectedPlanId]
  );

  // Build merged feature list: registry features + proprietary features
  const allFeatures = useMemo((): FeatureItem[] => {
    if (!product) return [];
    const registryFeatures = getFeaturesByIds(product.featureIds).map(
      (rf: RegistryFeature): FeatureItem => ({
        id: rf.id,
        name: rf.name,
        description: rf.description,
        isProprietary: false,
        isEnterpriseLocked: rf.isEnterpriseLocked,
        productName: product.name,
      })
    );
    const proprietary = product.proprietaryFeatures.map(
      (pf: ProprietaryFeature): FeatureItem => ({
        id: pf.id,
        name: pf.name,
        description: pf.description,
        isProprietary: true,
        isEnterpriseLocked: pf.isEnterpriseLocked,
        productName: product.name,
      })
    );
    return [...registryFeatures, ...proprietary];
  }, [product]);

  const handleProductChange = (id: string) => {
    setSelectedProductId(id);
    setSelectedPlanId('');
    setSelectedFeatures(new Set());
    setMigrationDays(0);
    setTeamHourlyRate(0);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 300);
  };

  const handlePlanChange = (id: string) => {
    setSelectedPlanId(id);
    setSelectedFeatures(new Set());
  };

  const toggleFeature = useCallback((featureId: string) => {
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      return next;
    });
  }, []);

  const analysis = useMemo(() => {
    if (!product || !currentPlan || selectedFeatures.size === 0) return null;

    // Calculate migration cost
    const safeMigrationDays = Math.max(0, migrationDays);
    const safeTeamHourlyRate = Math.max(0, teamHourlyRate);
    const migrationCost = safeMigrationDays * 8 * safeTeamHourlyRate;

    // Internal downgrades: cheaper plans from SAME product
    const lowerPlans = product.plans
      .filter(p => {
        if (p.id === currentPlan.id) return false;
        const pPrice = getAnnualPrice(p);
        const cPrice = getAnnualPrice(currentPlan);
        return pPrice < cPrice;
      })
      .sort((a, b) => getAnnualPrice(b) - getAnnualPrice(a));

    const downgradeSuggestions: {
      targetPlan: SaaSPlanData;
      annualSavings: number;
      lostFeatureIds: string[];
      retainedFeatureIds: string[];
      confidenceScore: number;
    }[] = [];

    for (const targetPlan of lowerPlans) {
      const lost: string[] = [];
      const retained: string[] = [];
      for (const featureId of selectedFeatures) {
        const hasFeature = targetPlan.features[featureId] === true;
        if (hasFeature) retained.push(featureId);
        else lost.push(featureId);
      }
      const currentAnnual = getAnnualPrice(currentPlan);
      const targetAnnual = getAnnualPrice(targetPlan);
      const annualSavings = currentAnnual - targetAnnual;
      if (annualSavings <= 0) continue;
      const year1NetSavings = annualSavings - migrationCost;
      downgradeSuggestions.push({
        targetPlan,
        annualSavings,
        year1NetSavings,
        migrationCost,
        hasNegativeROI: year1NetSavings < 0,
        lostFeatureIds: lost,
        retainedFeatureIds: retained,
        confidenceScore: selectedFeatures.size > 0
          ? Math.round((retained.length / selectedFeatures.size) * 100)
          : 0,
      });
    }

    // External alternatives: products in related categories with >=50% feature match
    const relatedCategories = RELATED_CATEGORIES[product.category] || [product.category];
    const candidateProducts = products.filter(
      p => p.id !== product.id && relatedCategories.includes(p.category)
    );

    const alternativeSuggestions: {
      altProduct: SaaSProductData;
      altPlan: SaaSPlanData;
      annualSavings: number;
      matchScore: number;
    }[] = [];

    for (const alt of candidateProducts) {
      for (const plan of alt.plans) {
        const altAnnualPrice = getAnnualPrice(plan);
        const currentAnnualPrice = getAnnualPrice(currentPlan);
        if (altAnnualPrice >= currentAnnualPrice) continue;

        let matchCount = 0;
        for (const featureId of selectedFeatures) {
          // Only compare registry features (featureIds), not proprietary
          if (product.featureIds.includes(featureId) && plan.features[featureId] === true) {
            matchCount++;
          }
        }
        // Count only registry features among selected for match
        const selectedRegistryFeatures = [...selectedFeatures].filter(fid =>
          product.featureIds.includes(fid)
        );
        const matchScore =
          selectedRegistryFeatures.length > 0
            ? matchCount / selectedRegistryFeatures.length
            : 0;

        if (matchScore >= 0.5) {
          const annualSavings = currentAnnualPrice - altAnnualPrice;
          const year1NetSavings = annualSavings - migrationCost;
          alternativeSuggestions.push({
            altProduct: alt,
            altPlan: plan,
            annualSavings,
            year1NetSavings,
            migrationCost,
            hasNegativeROI: year1NetSavings < 0,
            matchScore,
          });
        }
      }
    }

    alternativeSuggestions.sort((a, b) => b.annualSavings - a.annualSavings);

    // Savings summary
    const internalTotal = downgradeSuggestions.length > 0
      ? Math.max(...downgradeSuggestions.map(d => d.annualSavings))
      : 0;

    const bestAltTotal = alternativeSuggestions.length > 0
      ? Math.max(...alternativeSuggestions.map(a => a.annualSavings))
      : 0;

    return {
      downgradeSuggestions: downgradeSuggestions
        .filter(d => d.annualSavings > 0)
        .slice(0, 5),
      alternativeSuggestions: alternativeSuggestions.slice(0, 3),
      internalTotal,
      bestAltTotal,
      bestOption: Math.max(internalTotal, bestAltTotal),
      migrationCost,
      bestOptionYear1: Math.max(internalTotal, bestAltTotal) - migrationCost,
    };
  }, [product, currentPlan, selectedFeatures, products, migrationDays, teamHourlyRate]);

  // Determine which features are available in the current plan
  const availableInPlan = useMemo(() => {
    if (!currentPlan) return new Set<string>();
    return new Set(Object.keys(currentPlan.features).filter(k => currentPlan.features[k] === true));
  }, [currentPlan]);

  const hasResults =
    analysis &&
    (analysis.downgradeSuggestions.length > 0 || analysis.alternativeSuggestions.length > 0);

  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 768) {
        alert('For mobile devices: use your browser\'s "Share" menu and select "Print" to save as PDF.');
      } else {
        window.print();
      }
    }
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!analysis || !product) return;

    const headers = ['Type', 'Target', 'Annual Savings', 'Year 1 Net Savings', 'Confidence Score', 'Features Lost', 'Features Retained'];
    const rows: string[][] = [];

    // Internal downgrade suggestions
    for (const s of analysis.downgradeSuggestions) {
      rows.push([
        'Internal Downgrade',
        `${product.name} ${currentPlan?.name || ''} -> ${s.targetPlan.name}`,
        convert(s.annualSavings).toString(),
        convert(s.year1NetSavings).toString(),
        `${s.confidenceScore}%`,
        s.lostFeatureIds.map(fid => {
          const f = allFeatures.find(af => af.id === fid);
          return f?.name || fid;
        }).join('; '),
        s.retainedFeatureIds.map(fid => {
          const f = allFeatures.find(af => af.id === fid);
          return f?.name || fid;
        }).join('; '),
      ]);
    }

    // External alternative suggestions
    for (const a of analysis.alternativeSuggestions) {
      rows.push([
        'External Alternative',
        `${a.altProduct.name} - ${a.altPlan.name}`,
        convert(a.annualSavings).toString(),
        convert(a.year1NetSavings).toString(),
        `${Math.round(a.matchScore * 100)}%`,
        '',
        '',
      ]);
    }

    if (rows.length === 0) return;

    // Build CSV with proper escaping
    const escapeCsv = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `downgrade-analysis-${product.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [analysis, product, currentPlan, convert, allFeatures]);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Selection Panel */}
      <div className="card-blur rounded-xl p-6 sm:p-8 mb-8 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Select SaaS</label>
            <input
              type="search"
              aria-label="Filter products"
              placeholder="Filter products..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all mb-3"
            />
            <select
              value={selectedProductId}
              onChange={e => handleProductChange(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
            >
              <option value="">Choose a product...</option>
              {(() => {
                const grouped = groupProductsByCategory(filteredProducts);
                return CATEGORY_ORDER.map(cat => {
                  const catProducts = grouped[cat];
                  if (!catProducts || catProducts.length === 0) return null;
                  return (
                    <optgroup key={cat} label={cat}>
                      {catProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </optgroup>
                  );
                });
              })()}
            </select>
            {productSearch.trim() !== '' && filteredProducts.length === 0 && (
              <p className="text-xs text-zinc-500 mt-2">No products match your search</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Current Plan</label>
            <select
              value={selectedPlanId}
              onChange={e => handlePlanChange(e.target.value)}
              disabled={!product}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select plan...</option>
              {product?.plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.priceMonthly !== null ? `${fmt(p.priceMonthly)}/mo` : 'Custom pricing'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6 pt-6 border-t border-zinc-800">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Estimated Migration Days
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={migrationDays}
              onChange={e => setMigrationDays(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Team Cost ($/hr)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={teamHourlyRate}
              onChange={e => setTeamHourlyRate(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="card-blur rounded-xl p-6 sm:p-8 mb-8 animate-pulse space-y-4 print:hidden">
          <div className="h-4 bg-zinc-800 rounded w-3/4" />
          <div className="h-3 bg-zinc-800 rounded w-1/2" />
          <div className="h-3 bg-zinc-800 rounded w-2/3" />
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="h-20 bg-zinc-800 rounded-lg" />
            <div className="h-20 bg-zinc-800 rounded-lg" />
            <div className="h-20 bg-zinc-800 rounded-lg" />
          </div>
        </div>
      )}

      {/* Feature Selector */}
      {product && currentPlan && !isLoading && (
        <div className="card-blur rounded-xl p-6 sm:p-8 mb-8 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="text-lg font-semibold text-zinc-100">Select features you actually use</h3>
            {(() => {
              const f = getFreshness(product.lastVerified);
              const c = FRESHNESS_CLASSES[f.level];
              return (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium num ${c.ring} ${c.text}`}
                  title={f.caveat ?? `${product.name} pricing — ${f.label.toLowerCase()}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} aria-hidden="true" />
                  {product.name} pricing · {f.label.toLowerCase()}
                </span>
              );
            })()}
          </div>
          <p className="text-zinc-400 text-sm mb-6">
            Be honest. Only check the features critical to your daily workflow. The engine will find the cheapest plan that covers them.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allFeatures.map(feature => {
              const hasInCurrent = availableInPlan.has(feature.id);
              const isSelected = selectedFeatures.has(feature.id);

              return (
                <button
                  key={feature.id}
                  onClick={() => hasInCurrent && toggleFeature(feature.id)}
                  disabled={!hasInCurrent}
                  className={`relative flex items-start gap-3 p-4 rounded-lg border text-left transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                    !hasInCurrent
                      ? 'border-zinc-800/50 opacity-40 cursor-not-allowed'
                      : isSelected
                        ? 'border-emerald-400/40 bg-emerald-400/5'
                        : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'
                  }`}
                  aria-pressed={isSelected}
                >
                  <div
                    className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center mt-0.5 transition-colors ${
                      isSelected ? 'bg-emerald-400 border-emerald-400' : 'border-zinc-600'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-zinc-950" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-200 flex items-center gap-1.5">
                      {feature.name}
                      {feature.isProprietary && (
                        <span className="text-[10px] text-emerald-400/70 border border-emerald-400/20 rounded px-1 py-0.5 leading-none">
                          Exclusive to {feature.productName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">{feature.description}</div>
                  </div>
                  {!hasInCurrent && (
                    <span className="absolute top-2 right-2 text-[10px] text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">
                      Not in plan
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedFeatures.size > 0 && (
            <div className="mt-6 flex items-center justify-between pt-6 border-t border-zinc-800">
              <span className="text-sm text-zinc-400">
                {selectedFeatures.size} feature{selectedFeatures.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setSelectedFeatures(new Set())}
                className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none rounded px-2 py-1"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}

      {/* Savings Summary Card (shown if results exist) */}
      {hasResults && analysis && (
        <div className="card-blur rounded-xl p-6 mb-8 border border-emerald-400/10 bg-emerald-400/5">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Savings Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-950/50 rounded-lg p-4 border border-zinc-800">
              <div className="text-xs text-zinc-400 mb-1">Max Internal Downgrade</div>
              <div className="text-xl font-bold text-emerald-400">
                {fmt(analysis.internalTotal)}/yr
              </div>
            </div>
            <div className="bg-zinc-950/50 rounded-lg p-4 border border-zinc-800">
              <div className="text-xs text-zinc-400 mb-1">Best Alternative</div>
              <div className="text-xl font-bold text-emerald-400">
                {fmt(analysis.bestAltTotal)}/yr
              </div>
            </div>
            <div className="bg-zinc-950/50 rounded-lg p-4 border border-emerald-400/20">
              <div className="text-xs text-zinc-400 mb-1">Best Single Option</div>
              <div className="text-xl font-bold text-emerald-400">
                {fmt(analysis.bestOption)}/yr
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                Choose one: internal downgrade or external migration (mutually exclusive)
              </div>
            </div>
          </div>

          {/* Year 1 Net Savings breakdown */}
          {analysis.migrationCost > 0 && (
            <div className={`mt-6 p-4 rounded-lg border ${
              analysis.bestOptionYear1 < 0
                ? 'border-amber-400/20 bg-amber-400/5'
                : 'border-emerald-400/20 bg-emerald-400/5'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className={`text-sm font-semibold flex items-center gap-2 ${
                    analysis.bestOptionYear1 < 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {analysis.bestOptionYear1 < 0 && (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    Year 1 Net Savings: {fmt(analysis.bestOptionYear1)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    After deducting migration cost ({fmt(analysis.migrationCost)})
                  </div>
                  {analysis.bestOptionYear1 < 0 && (
                    <div className="text-xs text-amber-400/80 mt-1 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>Migration cost exceeds first-year savings. Positive ROI from Year 2 onward.</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500">Annual Ongoing Savings</div>
                  <div className="text-lg font-bold text-emerald-400">
                    {fmt(analysis.bestOption)}/yr
                  </div>
                  <div className="text-xs text-zinc-500">(from Year 2 onward)</div>
                </div>
              </div>
            </div>
          )}

          {/* Export & Print buttons */}
          <div className="mt-6 pt-4 border-t border-zinc-800 flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 mr-auto print:hidden"
              aria-label="Copy a shareable link to this analysis"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {shareCopied ? 'Link copied' : 'Copy share link'}
            </button>
            <button
              onClick={handleExportCsv}
              disabled={!analysis || (analysis.downgradeSuggestions.length === 0 && analysis.alternativeSuggestions.length === 0)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Export analysis results as CSV"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 print:hidden"
              aria-label="Print or save analysis results as PDF"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 12H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print / Save PDF
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {analysis && selectedFeatures.size > 0 && (
        <div className="space-y-6">
          {/* Downgrade Suggestions */}
          {analysis.downgradeSuggestions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                <ArrowDown className="w-5 h-5 text-emerald-400" />
                Internal Downgrade Opportunities
              </h3>

              <div className="space-y-4">
                {analysis.downgradeSuggestions.map((suggestion, idx) => (
                  <div key={idx} className="card-blur rounded-xl p-6 border-l-2 border-l-emerald-400">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="text-sm text-zinc-400 mb-1">
                          {currentPlan!.name} <span className="text-zinc-600">→</span> {suggestion.targetPlan.name}
                        </div>
                        <div className={`text-2xl font-bold flex items-center gap-2 ${
                          suggestion.hasNegativeROI ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          <DollarSign className="w-5 h-5" />
                          {fmt(suggestion.year1NetSavings)}/year saved
                          {suggestion.hasNegativeROI && (
                            <span title="Migration cost exceeds first-year savings. Positive ROI from Year 2 onward.">
                              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                            </span>
                          )}
                        </div>
                        {suggestion.migrationCost > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="text-xs text-zinc-500">
                              Annual Ongoing Savings: <span className="text-emerald-400 font-medium">{fmt(suggestion.annualSavings)}/yr</span> (from Year 2)
                            </div>
                            <div className="text-xs text-zinc-500">
                              Migration Cost: <span className="text-zinc-400">{fmt(suggestion.migrationCost)}</span>
                            </div>
                            {suggestion.hasNegativeROI && (
                              <div className="text-xs text-amber-400/80 flex items-start gap-1.5 mt-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>Migration cost exceeds first-year savings. Positive ROI from Year 2 onward.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Confidence Score Bar */}
                      <div className="shrink-0 flex items-center gap-2">
                        <div className="text-xs text-zinc-400">Confidence:</div>
                        <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              suggestion.confidenceScore >= 80
                                ? 'bg-emerald-400'
                                : suggestion.confidenceScore >= 50
                                  ? 'bg-amber-400'
                                  : 'bg-red-400'
                            }`}
                            style={{ width: `${suggestion.confidenceScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-zinc-400">{suggestion.confidenceScore}%</span>
                      </div>
                    </div>

                    {suggestion.lostFeatureIds.length > 0 && (
                      <div className="mb-4">
                        <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Features you will lose</div>
                        <div className="flex flex-wrap gap-2">
                          {suggestion.lostFeatureIds.map(fid => {
                            const f = allFeatures.find(af => af.id === fid);
                            return (
                              <span
                                key={fid}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-400/5 border border-red-400/20 text-red-400 text-xs"
                              >
                                <X className="w-3 h-3" />
                                {f?.name || fid}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {suggestion.retainedFeatureIds.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Features retained</div>
                        <div className="flex flex-wrap gap-2">
                          {suggestion.retainedFeatureIds.map(fid => {
                            const f = allFeatures.find(af => af.id === fid);
                            return (
                              <span
                                key={fid}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-400/5 border border-emerald-400/20 text-emerald-400 text-xs"
                              >
                                <Check className="w-3 h-3" />
                                {f?.name || fid}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alternative Suggestions */}
          {analysis.alternativeSuggestions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                Cheaper External Alternatives
              </h3>

              <div className="space-y-4">
                {analysis.alternativeSuggestions.map((alt, idx) => (
                  <div key={idx} className="card-blur rounded-xl p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 font-bold text-sm">
                          {alt.altProduct.name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-100">{alt.altProduct.name}</div>
                          <div className="text-sm text-zinc-400">
                            {alt.altPlan.name} —{' '}
                            {alt.altPlan.priceMonthly !== null
                              ? `${fmt(alt.altPlan.priceMonthly)}/mo`
                              : 'Contact for pricing'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold flex items-center gap-1.5 justify-end ${
                          alt.hasNegativeROI ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {fmt(alt.year1NetSavings)}/yr
                          {alt.hasNegativeROI && (
                            <span title="Migration cost exceeds first-year savings. Positive ROI from Year 2 onward.">
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {Math.round(alt.matchScore * 100)}% feature match
                        </div>
                        {alt.migrationCost > 0 && (
                          <div className="text-xs text-zinc-500 mt-1">
                            Ongoing: {fmt(alt.annualSavings)}/yr | Migration: {fmt(alt.migrationCost)}
                          </div>
                        )}
                        {alt.hasNegativeROI && (
                          <div className="text-xs text-amber-400/80 mt-1">
                            Migration exceeds Year 1 savings. ROI from Year 2.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800">
                      <span className="text-xs text-zinc-500">
                        {alt.altPlan.priceMonthly !== null
                          ? `${fmt(alt.altPlan.priceMonthly)}/mo`
                          : 'Custom pricing'}{' '}
                        vs{' '}
                        {currentPlan!.priceMonthly !== null
                          ? `${fmt(currentPlan!.priceMonthly)}/mo`
                          : 'Custom pricing'}
                      </span>
                      <AffiliateLink
                        href={getMonetizedUrl(alt.altProduct)}
                        productId={alt.altProduct.id}
                        planId={alt.altPlan.id}
                        campaign="downgrade_engine"
                        variant="button"
                      >
                        View Alternative
                      </AffiliateLink>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state when no results found despite feature selection */}
          {analysis.downgradeSuggestions.length === 0 &&
            analysis.alternativeSuggestions.length === 0 && (
              <div className="card-blur rounded-xl p-8 text-center">
                <SearchX className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">No Direct Alternatives Found</h3>
                <p className="text-zinc-400 text-sm max-w-md mx-auto mb-4">
                  Your selected features require the current plan tier. Try deselecting non-critical features to unlock savings, or run a full stack audit to find hidden redundancies.
                </p>
                <a
                  href="/audit"
                  className="inline-flex items-center gap-2 text-emerald-400 text-sm hover:underline focus:ring-2 focus:ring-emerald-500 focus:outline-none rounded px-2 py-1"
                >
                  Run Stack Audit &rarr;
                </a>
              </div>
            )}
        </div>
      )}

      {!product && !isLoading && (
        <div className="card-blur rounded-xl p-12 text-center print:hidden">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
            <ArrowDown className="w-8 h-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-300 mb-2">Select a SaaS to begin</h3>
          <p className="text-zinc-500 text-sm max-w-md mx-auto">
            Choose your current software and plan above. The engine will analyze every feature matrix to find your optimal downgrade path.
          </p>
        </div>
      )}
    </div>
  );
}
