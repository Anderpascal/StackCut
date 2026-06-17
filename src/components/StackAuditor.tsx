import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getFeaturesByIds, getCoreFeatureIds } from '../data/features-registry';
import type { RegistryFeature } from '../data/features-registry';
import type { SaaSProductData, StackAuditResult, StackAuditRedundantPair } from '../types/saas';
import { areCategoriesComparable, groupProductsByCategory, CATEGORY_ORDER } from '../lib/categories';
import { Trash2, Plus, AlertTriangle, Check, X, Search, Layers, ChevronDown, Wallet, ArrowRight, TrendingDown, Mail, Monitor, Sparkles, Bookmark } from 'lucide-react';
import { useCurrencyShared as useCurrency } from '../lib/currency-context';
import { CurrencyProvider } from './CurrencyProvider';
import CurrencySelector from './CurrencySelector';
import AffiliateLink from './AffiliateLink';
import { getMonetizedUrl } from '../lib/affiliates';

interface SavedStack {
  version: number;
  tools: string[];
  lastUpdated: string;
}

interface Props {
  products: SaaSProductData[];
}

const STORAGE_KEY = 'saas-downgrader-stack-v2';
const CURRENT_VERSION = 2;

/** Stacks predefinidos para acelerar el onboarding y mostrar valor inmediato. */
const PREDEFINED_STACKS: { id: string; name: string; description: string; toolIds: string[] }[] = [
  {
    id: 'startup-starter',
    name: 'Startup Starter',
    description: 'El kit clásico de una startup remota: comunicación, proyectos y productividad.',
    toolIds: ['slack', 'notion', 'zoom', 'github', 'figma'],
  },
  {
    id: 'sales-stack',
    name: 'Sales Stack',
    description: 'CRM, email outbound y videollamadas para equipos de ventas.',
    toolIds: ['hubspot', 'activecampaign', 'zoom', 'salesforce'],
  },
  {
    id: 'design-studio',
    name: 'Design Studio',
    description: 'Diseño, prototipado, gestión de proyectos creativos y videoconferencia.',
    toolIds: ['figma', 'miro', 'asana', 'notion', 'slack'],
  },
  {
    id: 'dev-team',
    name: 'Dev Team',
    description: 'Repositorios, CI/CD, monitoreo y gestión ágil de proyectos.',
    toolIds: ['github', 'gitlab', 'jira', 'datadog', 'linear'],
  },
  {
    id: 'support-suite',
    name: 'Support Suite',
    description: 'Chat, ticketing, knowledge base y CRM para soporte al cliente.',
    toolIds: ['intercom', 'zendesk', 'freshdesk', 'hubspot'],
  },
];

function loadSavedStack(): SavedStack {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: CURRENT_VERSION, tools: [], lastUpdated: '' };
    const parsed: SavedStack = JSON.parse(raw);
    if (parsed.version !== CURRENT_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return { version: CURRENT_VERSION, tools: [], lastUpdated: '' };
    }
    if (!Array.isArray(parsed.tools)) {
      localStorage.removeItem(STORAGE_KEY);
      return { version: CURRENT_VERSION, tools: [], lastUpdated: '' };
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return { version: CURRENT_VERSION, tools: [], lastUpdated: '' };
  }
}

function getCheapestPaidPrice(product: SaaSProductData): number {
  const pricedPlans = product.plans.filter(p => p.priceMonthly !== null && p.priceMonthly > 0);
  if (pricedPlans.length === 0) return 0;
  return Math.min(...pricedPlans.map(p => p.priceMonthly!));
}

/**
 * Construye una URL deep-link al Downgrade Engine con el plan más caro pagado
 * de la herramienta como punto de partida.
 */
function buildDowngradeUrl(product: SaaSProductData): string {
  const paidPlan = [...product.plans]
    .filter(p => p.priceMonthly !== null && p.priceMonthly > 0)
    .sort((a, b) => (b.priceMonthly ?? 0) - (a.priceMonthly ?? 0))[0];
  const planId = paidPlan?.id ?? product.plans[0]?.id ?? '';
  const params = new URLSearchParams();
  params.set('tool', product.id);
  if (planId) params.set('plan', planId);
  return `/downgrade?${params.toString()}`;
}

/**
 * Construye la URL de alternativas baratas para una herramienta.
 */
function buildAlternativesUrl(product: SaaSProductData): string {
  return `/alternatives/${product.slug}-cheap`;
}

/**
 * Analiza un stack de herramientas SaaS y detecta redundancias.
 *
 * Algoritmo refactorizado (v2):
 * 1. Para cada par (i, j), verifica que estén en el mismo COMPARISON_SILOS.
 * 2. Filtra las features de cada herramienta para conservar solo type === 'core'.
 * 3. Calcula coreOverlap. Aplica umbral >60% del set menor de core features.
 * 4. Si coreOverlap.length >= 2 y supera el umbral, genera redundantPair.
 *
 * @param toolIds - IDs de las herramientas en el stack
 * @param allProducts - Catálogo completo de productos SaaS
 * @param fmt - Función de formateo de moneda
 * @returns StackAuditResult con redundancias detectadas y herramientas unused
 */
export function analyzeStack(
  toolIds: string[],
  allProducts: SaaSProductData[],
  fmt: (val: number) => string
): StackAuditResult {
  // ── STEP 0: Precompute canonical data (once, outside loops) ──────────────
  const tools = allProducts.filter(p => toolIds.includes(p.id));
  const coreFeatureIds = new Set(getCoreFeatureIds());
  const redundantPairs: StackAuditResult['redundantPairs'] = [];

  const REDUNDANCY_THRESHOLD = 0.6; // >60% of the smaller core set
  const MIN_CORE_OVERLAP = 2;

  // ── STEP 1: Pairwise comparison with silo + core filtering ───────────────
  for (let i = 0; i < tools.length; i++) {
    for (let j = i + 1; j < tools.length; j++) {
      const t1 = tools[i];
      const t2 = tools[j];

      // 1a. COMPARISON SILO CHECK (O(1))
      if (!areCategoriesComparable(t1.category, t2.category)) {
        continue;
      }

      // 1b. FILTER TO CORE FEATURES ONLY
      const t1Core = t1.featureIds.filter(fid => coreFeatureIds.has(fid));
      const t2Core = t2.featureIds.filter(fid => coreFeatureIds.has(fid));

      const smallerCoreCount = Math.min(t1Core.length, t2Core.length);

      // 1c. Early exit: no core features to compare
      if (smallerCoreCount === 0) continue;

      // 1d. Calculate core overlap
      const t2CoreSet = new Set(t2Core);
      const coreOverlap = t1Core.filter(fid => t2CoreSet.has(fid));

      // 1e. Apply threshold: >60% of smaller set AND >= 2 core features
      const threshold = Math.ceil(smallerCoreCount * REDUNDANCY_THRESHOLD);
      if (coreOverlap.length < threshold || coreOverlap.length < MIN_CORE_OVERLAP) {
        continue;
      }

      // ── Redundancy DETECTED — Generate redundantPair ────────────────────

      // Full overlap (core + infra) for UI display
      const f1Ids = new Set(t1.featureIds);
      const f2Ids = new Set(t2.featureIds);
      const fullOverlap = [...f1Ids].filter(fid => f2Ids.has(fid));

      const p1Price = getCheapestPaidPrice(t1);
      const p2Price = getCheapestPaidPrice(t2);

      const cheaper = p1Price < p2Price ? t1 : t2;
      const moreExpensive = p1Price < p2Price ? t2 : t1;

      const coreFeatureObjs = getFeaturesByIds(coreOverlap);
      const coreFeatureNames = coreFeatureObjs.map(f => f.name);
      const allFeatureNames = getFeaturesByIds(fullOverlap.slice(0, 6)).map(f => f.name);

      // Recommendation text: mentions core features + category silo
      const recommendation =
        `${cheaper.name} (from ${fmt(p1Price)}/mo) and ${moreExpensive.name} ` +
        `(from ${fmt(p2Price)}/mo) both operate in the **${t1.category}** space ` +
        `and share key capabilities: ${coreFeatureNames.slice(0, 3).join(', ')}. ` +
        `If ${cheaper.name} covers your core needs, consider consolidating by ` +
        `canceling ${moreExpensive.name}.`;

      const pair: StackAuditRedundantPair = {
        tool1: t1.name,
        tool2: t2.name,
        id1: t1.id,
        id2: t2.id,
        overlappingFeatures: fullOverlap.slice(0, 6),
        overlappingFeatureNames: allFeatureNames,
        overlappingCoreFeatures: coreOverlap,
        overlappingCoreFeatureNames: coreFeatureNames,
        recommendation,
        potentialSavings: Math.min(p1Price, p2Price) * 12,
        siloCategory: t1.category,
        redundancyReason: 'core_overlap',
        cheaperToolId: cheaper.id,
        cheaperToolName: cheaper.name,
        cheaperToolSlug: cheaper.slug,
        cheaperToolAffiliateUrl: cheaper.affiliateUrl,
        cheaperToolWebsiteUrl: cheaper.websiteUrl,
        moreExpensiveToolId: moreExpensive.id,
        moreExpensiveToolName: moreExpensive.name,
        moreExpensiveToolSlug: moreExpensive.slug,
        moreExpensiveToolAffiliateUrl: moreExpensive.affiliateUrl,
        moreExpensiveToolWebsiteUrl: moreExpensive.websiteUrl,
        downgradeUrl: buildDowngradeUrl(moreExpensive),
        alternativesUrl: buildAlternativesUrl(moreExpensive),
      };

      redundantPairs.push(pair);
    }
  }

  // ── STEP 2: Sort by potentialSavings descending ──────────────────────────
  redundantPairs.sort((a, b) => b.potentialSavings - a.potentialSavings);

  // ── STEP 3: Total monthly spend ──────────────────────────────────────────
  const totalMonthlySpend = tools.reduce(
    (acc, t) => acc + getCheapestPaidPrice(t), 0
  );

  // ── STEP 4: Total potential savings ──────────────────────────────────────
  const totalPotentialSavings = redundantPairs.reduce(
    (acc, r) => acc + r.potentialSavings, 0
  );

  // ── STEP 5: unusedTools (refactored — core features + silo aware) ────────
  const unusedTools = computeUnusedTools(tools, coreFeatureIds);

  return {
    redundantPairs,
    totalMonthlySpend,
    totalPotentialSavings,
    unusedTools,
  };
}

/**
 * Determina qué herramientas son "potentially unused".
 *
 * Nueva lógica (v2):
 * - SOLO considera features con type === 'core'.
 * - Una herramienta es "unused" si TODAS sus core features están presentes
 *   en el conjunto de core features de al menos otra herramienta del mismo
 *   silo de comparación.
 * - Requiere tools.length > 1.
 * - Si la herramienta tiene 0 core features, NUNCA se marca como unused.
 * - Herramientas sin otras en su silo no se marcan como unused.
 */
export function computeUnusedTools(
  tools: SaaSProductData[],
  coreFeatureIds: Set<string>
): string[] {
  if (tools.length <= 1) return [];

  const unused: string[] = [];

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];

    // Solo considerar core features de esta herramienta
    const toolCoreFeatures = tool.featureIds.filter(fid => coreFeatureIds.has(fid));

    // Si no tiene core features, nunca se considera unused
    if (toolCoreFeatures.length === 0) continue;

    // Encontrar otras herramientas en el MISMO silo de comparación
    const siloTools = tools.filter(
      (_, j) => j !== i && areCategoriesComparable(tool.category, tools[j].category)
    );

    // Si no hay otra herramienta en su silo, nunca se marca como unused
    if (siloTools.length === 0) continue;

    // Construir el conjunto de core features de las herramientas del mismo silo
    const siloOthersCoreFeatures = new Set<string>();
    for (const other of siloTools) {
      other.featureIds
        .filter(fid => coreFeatureIds.has(fid))
        .forEach(fid => siloOthersCoreFeatures.add(fid));
    }

    // ¿Todas las core features de esta herramienta están cubiertas?
    const allCovered = toolCoreFeatures.every(fid => siloOthersCoreFeatures.has(fid));
    if (allCovered) {
      unused.push(tool.name);
    }
  }

  return unused;
}

/**
 * Componente de captura de email embebido dentro del Stack Auditor.
 * Solo se muestra cuando hay resultados de valor.
 */
function AuditEmailCapture() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');

    if (honeypot) return; // Bot trap
    if (!EMAIL_REGEX.test(email)) {
      setState('error');
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setState('loading');

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          company_website: honeypot,
          source: 'stack_audit_post_results',
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Subscription failed');

      if (typeof window !== 'undefined' && (window as any).plausible) {
        (window as any).plausible('Newsletter Subscribe', { props: { status: 'success', source: 'stack_audit' } });
      }

      setState('success');
      setEmail('');
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  if (state === 'success') {
    return (
      <div className="rounded-lg p-4 border border-emerald-400/20 bg-emerald-400/5 text-center">
        <p className="text-emerald-400 text-sm font-medium">Subscribed! Check your inbox for your stack audit report.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={e => setHoneypot(e.target.value)}
        className="absolute left-[-9999px] w-px h-px opacity-0"
        aria-hidden="true"
      />
      <input
        type="email"
        value={email}
        onChange={e => {
          setEmail(e.target.value);
          if (state === 'error') setState('idle');
        }}
        placeholder="you@company.com"
        required
        disabled={state === 'loading'}
        className={`flex-1 bg-zinc-950 border ${state === 'error' ? 'border-red-400' : 'border-zinc-800'} rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all`}
        aria-label="Email address for your stack audit report"
      />
      <button
        type="submit"
        disabled={state === 'loading'}
        className="btn-primary text-sm py-2.5 px-5 shrink-0 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-60"
      >
        {state === 'loading' ? 'Sending...' : 'Send my audit'}
      </button>
      {state === 'error' && errorMsg && (
        <p className="text-red-400 text-xs mt-2 sm:mt-0 sm:absolute sm:bottom-[-20px] sm:left-0">{errorMsg}</p>
      )}
    </form>
  );
}

function StackAuditorInner({ products }: Props) {
  const [stack, setStack] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchDebounced, setSearchDebounced] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const listboxRef = React.useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 150);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchDebounced, selectedCategory]);

  // Load saved stack
  useEffect(() => {
    const saved = loadSavedStack();
    setStack(saved.tools);
    setIsLoaded(true);
  }, []);

  // Save stack
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const toSave: SavedStack = {
        version: CURRENT_VERSION,
        tools: stack,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // localStorage full or unavailable - silently fail
    }
  }, [stack, isLoaded]);

  // Close dropdown on Escape and click outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        dropdownRef.current?.querySelector('input')?.focus();
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const groupedProducts = useMemo(() => groupProductsByCategory(products), [products]);

  const filteredProducts = useMemo(() => {
    const term = searchDebounced.toLowerCase().trim();
    let filtered = products;

    if (term) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(term));
    }

    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // Exclude already added tools
    return filtered.filter(p => !stack.includes(p.id));
  }, [searchDebounced, selectedCategory, stack, products]);

  const filteredGroupedProducts = useMemo(
    () => groupProductsByCategory(filteredProducts),
    [filteredProducts]
  );

  // Flat list for keyboard navigation
  const flatFilteredProducts = useMemo(
    () => CATEGORY_ORDER.flatMap(cat => filteredGroupedProducts[cat] || []),
    [filteredGroupedProducts]
  );

  const addTool = useCallback((id: string, closeDropdown = false) => {
    setStack(prev => (prev.includes(id) ? prev : [...prev, id]));
    if (closeDropdown) {
      setSearch('');
      setSelectedCategory('');
      setIsDropdownOpen(false);
    }
  }, []);

  const addToolAndClose = useCallback((id: string) => {
    addTool(id, true);
    dropdownRef.current?.querySelector('input')?.focus();
  }, [addTool]);

  const handleInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) {
      if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
        setIsDropdownOpen(true);
      }
      return;
    }

    if (flatFilteredProducts.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % flatFilteredProducts.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex(prev =>
          prev === 0 ? flatFilteredProducts.length - 1 : prev - 1
        );
        break;
      case 'Enter':
        event.preventDefault();
        if (flatFilteredProducts[highlightedIndex]) {
          addTool(flatFilteredProducts[highlightedIndex].id, true);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setIsDropdownOpen(false);
        break;
    }
  }, [isDropdownOpen, flatFilteredProducts, highlightedIndex, addTool]);

  const loadPredefinedStack = useCallback((toolIds: string[]) => {
    const available = toolIds.filter(id => products.some(p => p.id === id));
    setStack(prev => {
      const merged = Array.from(new Set([...prev, ...available]));
      return merged;
    });
    if (typeof window !== 'undefined' && (window as any).plausible) {
      (window as any).plausible('Stack Auditor: Predefined Stack Loaded');
    }
  }, [products]);

  const removeTool = useCallback((id: string) => {
    setStack(prev => prev.filter(t => t !== id));
  }, []);

  const clearStack = useCallback(() => {
    setStack([]);
  }, []);

  const { fmt } = useCurrency();

  const result = useMemo(() => analyzeStack(stack, products, fmt), [stack, products, fmt]);

  const stackProducts = useMemo(
    () => products.filter(p => stack.includes(p.id)),
    [stack, products]
  );

  const showResults = stack.length >= 2;
  const hasFindings = result.redundantPairs.length > 0 || result.unusedTools.length > 0;

  if (!isLoaded) return null;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Stack Builder */}
      <div className="card-blur rounded-xl p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">Your Current Stack</h3>
            <p className="text-zinc-400 text-sm">Add every SaaS tool your company pays for. Data never leaves your browser.</p>
          </div>
          <div className="flex items-center gap-2">
            {stack.length > 0 && (
              <button
                onClick={clearStack}
                className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-red-400 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none rounded px-2 py-1"
                aria-label="Clear all tools from stack"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Predefined Stacks */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Quick-start templates</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_STACKS.map(pre => {
              const availableCount = pre.toolIds.filter(id => products.some(p => p.id === id)).length;
              const isActive = pre.toolIds.some(id => stack.includes(id));
              if (availableCount === 0) return null;
              return (
                <button
                  key={pre.id}
                  onClick={() => loadPredefinedStack(pre.toolIds)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                    isActive
                      ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                  }`}
                  title={pre.description}
                >
                  <Bookmark className="w-3 h-3" />
                  {pre.name}
                  <span className="text-zinc-600">({availableCount})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + Category Dropdown */}
        <div ref={dropdownRef} className="relative mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-5 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search for a SaaS tool..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
                aria-label="Search for a SaaS tool to add to your stack"
                aria-expanded={isDropdownOpen}
                aria-controls="stack-audit-search-results"
                aria-activedescendant={
                  isDropdownOpen && flatFilteredProducts[highlightedIndex]
                    ? `stack-audit-option-${flatFilteredProducts[highlightedIndex].id}`
                    : undefined
                }
                autoComplete="off"
              />
            </div>

            <div className="sm:col-span-4 relative">
              <select
                value={selectedCategory}
                onChange={e => {
                  setSelectedCategory(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className="w-full appearance-none bg-zinc-950 border border-zinc-800 rounded-lg pl-4 pr-10 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                aria-label="Filter tools by category"
              >
                <option value="">All categories</option>
                {CATEGORY_ORDER.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            </div>

            <div className="sm:col-span-3 flex items-center">
              <span className="text-xs text-zinc-500">
                {filteredProducts.length} tool{filteredProducts.length !== 1 ? 's' : ''} available
              </span>
            </div>
          </div>

          {/* Search Results Dropdown */}
          {isDropdownOpen && (search.trim() || selectedCategory) && (
            <div
              ref={listboxRef}
              id="stack-audit-search-results"
              className="absolute z-20 left-0 right-0 top-full mt-2 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden max-h-80 overflow-y-auto"
              role="listbox"
              aria-label="Search results"
              onMouseDown={e => e.preventDefault()} // Prevent input blur from closing dropdown before click
            >
              {filteredProducts.length > 0 ? (
                (() => {
                  let globalIndex = 0;
                  return CATEGORY_ORDER.map(cat => {
                    const catProducts = filteredGroupedProducts[cat];
                    if (!catProducts || catProducts.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div className="px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider bg-zinc-900/50 sticky top-0 z-10">
                          {cat}
                        </div>
                        {catProducts.map(p => {
                          const index = globalIndex++;
                          const isHighlighted = index === highlightedIndex;
                          return (
                            <button
                              key={p.id}
                              id={`stack-audit-option-${p.id}`}
                              type="button"
                              onClick={() => addToolAndClose(p.id)}
                              onMouseEnter={() => setHighlightedIndex(index)}
                              className={`w-full flex items-center justify-between px-4 py-3 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                                isHighlighted
                                  ? 'bg-emerald-400/10'
                                  : 'hover:bg-zinc-900'
                              }`}
                              role="option"
                              aria-selected={isHighlighted}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 font-bold text-xs">
                                  {p.name[0]}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-zinc-200">{p.name}</div>
                                  <div className="text-xs text-zinc-500">{p.category}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-emerald-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                  Add
                                </span>
                                <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                                  isHighlighted
                                    ? 'bg-emerald-400 text-zinc-950'
                                    : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                                }`}>
                                  <Plus className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="px-4 py-6 text-center text-zinc-500 text-sm">
                  No tools match your search.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected Tools */}
        <div className="flex flex-wrap gap-2">
          {stackProducts.map(p => (
            <div
              key={p.id}
              className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg bg-emerald-400/5 border border-emerald-400/20 text-emerald-400 text-sm"
            >
              {p.name}
              <button
                onClick={() => removeTool(p.id)}
                className="w-5 h-5 rounded-md hover:bg-emerald-400/10 flex items-center justify-center transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                aria-label={`Remove ${p.name} from stack`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {stack.length === 0 && (
            <div className="w-full py-8 text-center border border-dashed border-zinc-800 rounded-lg">
              <Layers className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">No tools added yet. Search above or pick a template to build your stack.</p>
            </div>
          )}
        </div>

        {stack.length > 0 && (
          <div className="mt-6 pt-6 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-sm text-zinc-400">{stack.length} tool{stack.length !== 1 ? 's' : ''} in stack</span>
            <span className="text-sm text-zinc-300">
              Est. monthly spend: <span className="text-zinc-100 font-mono">{fmt(result.totalMonthlySpend)}/mo</span>
            </span>
          </div>
        )}
      </div>

      {/* Audit Results */}
      {showResults && (
        <div className="space-y-6" aria-live="polite" aria-label="Stack audit results">
          {/* Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card-blur rounded-xl p-6 border-l-2 border-l-amber-400">
              <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Critical Redundancies</div>
              <div className="text-3xl font-bold text-amber-400">{result.redundantPairs.length}</div>
              <div className="text-sm text-zinc-500 mt-1">duplicate tool pairs found</div>
            </div>
            <div className="card-blur rounded-xl p-6 border-l-2 border-l-emerald-400">
              <div className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Annual Savings Potential</div>
              <div className="text-3xl font-bold text-emerald-400">{fmt(result.totalPotentialSavings)}/yr</div>
              <div className="text-sm text-zinc-500 mt-1">by eliminating redundancies</div>
            </div>
          </div>

          {result.unusedTools.length > 0 && (
            <div className="card-blur rounded-xl p-4 border border-amber-400/10">
              <div className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">Potentially Unused Tools</div>
              <div className="flex flex-wrap gap-2">
                {result.unusedTools.map((name, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-400/5 border border-amber-400/20 text-amber-400 text-xs">
                    {name}
                  </span>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-2">These tools have features fully covered by others in your stack.</p>
            </div>
          )}

          {/* Redundancy Details */}
          {result.redundantPairs.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Critical Redundancy Report
              </h3>

              <div className="space-y-4">
                {result.redundantPairs.map((pair, idx) => (
                  <RedundancyCard key={idx} pair={pair} fmt={fmt} />
                ))}
              </div>
            </div>
          )}

          {result.redundantPairs.length === 0 && (
            <div className="card-blur rounded-xl p-8 text-center border border-emerald-400/10">
              <Check className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">No Critical Redundancies Found</h3>
              <p className="text-zinc-400 text-sm max-w-md mx-auto">
                Your stack appears well-diversified. Each tool covers a unique functional area. Nice work on procurement discipline.
              </p>
            </div>
          )}

          {/* Post-audit email capture */}
          {hasFindings && (
            <div className="card-blur rounded-xl p-6 border border-emerald-400/10 bg-emerald-400/5">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">Get this audit in your inbox</h3>
                  <p className="text-zinc-400 text-sm">Send yourself a copy of these findings plus weekly downgrade paths and pricing alerts.</p>
                </div>
              </div>
              <AuditEmailCapture />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tarjeta individual de redundancia con CTAs de monetización.
 *
 * Estrategia de monetización del Stack Auditor:
 * - El auditor detecta "tienes dos herramientas que hacen lo mismo".
 * - La acción de negocio no es "cancelar" directamente, sino decidir cuál quedarse.
 * - Por eso promocionamos:
 *    1. "Keep [cheaper tool]" → affiliate link a la herramienta ganadora (la más barata).
 *    2. "Downgrade [expensive tool]" → deep-link al Downgrade Engine por si prefiere
 *       reducir el plan en lugar de cancelar.
 *    3. "See cheaper alternatives" → página de alternativas del tool caro.
 *    4. "Monitor pricing" → Stack Monitor para recibir alertas de cambios de precio.
 */
function RedundancyCard({ pair, fmt }: { pair: StackAuditRedundantPair; fmt: (val: number) => string }) {
  return (
    <div className="card-blur rounded-xl p-6 border border-amber-400/10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-10 h-10 rounded-full bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-xs z-10">
              {pair.tool1[0]}
            </div>
            <div className="w-10 h-10 rounded-full bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center text-zinc-300 font-bold text-xs">
              {pair.tool2[0]}
            </div>
          </div>
          <div>
            <div className="font-semibold text-zinc-100">{pair.tool1} <span className="text-zinc-600">vs</span> {pair.tool2}</div>
            <div className="text-xs text-zinc-500">Significant feature overlap detected</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold text-emerald-400">{fmt(pair.potentialSavings)}/yr</div>
          <div className="text-xs text-zinc-500">if consolidated</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Overlapping Capabilities</div>
        <div className="flex flex-wrap gap-2">
          {pair.overlappingFeatureNames.map((f, fidx) => (
            <span key={fidx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-400/5 border border-amber-400/20 text-amber-400 text-xs">
              <Check className="w-3 h-3" />
              {f}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-zinc-950/50 rounded-lg p-4 border border-zinc-800 mb-4">
        <div className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-1">Recommendation</div>
        <p className="text-sm text-zinc-300">{pair.recommendation}</p>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <AffiliateLink
          href={getMonetizedUrl({ affiliateUrl: pair.cheaperToolAffiliateUrl, websiteUrl: pair.cheaperToolWebsiteUrl })}
          productId={pair.cheaperToolId}
          campaign="stack_auditor_keep"
          variant="button"
          className="w-full justify-center"
        >
          <Wallet className="w-3.5 h-3.5" />
          Keep {pair.cheaperToolName}
        </AffiliateLink>

        <a
          href={pair.downgradeUrl}
          className="btn-secondary text-sm py-2 px-5 w-full inline-flex items-center justify-center gap-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          data-plausible-event="Stack Auditor: Downgrade CTA"
        >
          <TrendingDown className="w-3.5 h-3.5" />
          Downgrade {pair.moreExpensiveToolName}
        </a>

        <a
          href={pair.alternativesUrl}
          className="btn-secondary text-sm py-2 px-5 w-full inline-flex items-center justify-center gap-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          data-plausible-event="Stack Auditor: Alternatives CTA"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          Cheaper alternatives
        </a>

        <a
          href="/monitor"
          className="btn-secondary text-sm py-2 px-5 w-full inline-flex items-center justify-center gap-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          data-plausible-event="Stack Auditor: Monitor CTA"
        >
          <Monitor className="w-3.5 h-3.5" />
          Monitor pricing
        </a>
      </div>
    </div>
  );
}

export default function StackAuditor({ products }: Props) {
  return (
    <CurrencyProvider>
      <CurrencySelector />
      <StackAuditorInner products={products} />
    </CurrencyProvider>
  );
}
