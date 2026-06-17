import React, { useState, useMemo } from 'react';

interface SaaSTool {
  name: string;
  category: string;
  seats: number;
  pricePerSeat: number;
  plan: string;
}

// Seed names and default seat counts only — NO hardcoded prices.
// Actual per-seat prices are resolved from the products dataset at mount time.
const DEFAULT_SEED_TOOLS = [
  { name: 'Slack', seats: 50 },
  { name: 'Notion', seats: 50 },
  { name: 'Asana', seats: 30 },
  { name: 'HubSpot', seats: 10 },
  { name: 'Zoom', seats: 50 },
];

// Map dataset category strings to the component's select category list.
const CATEGORY_MAP: Record<string, string> = {
  'Productivity & Wiki': 'Productivity',
  'CRM & Sales': 'CRM',
  'Video Conferencing': 'Video',
  'Dev Tools & VCS': 'Dev Tools',
  'Error Tracking & Monitoring': 'Monitoring',
  'Email & Marketing Automation': 'Email Marketing',
  'Customer Support & Helpdesk': 'Customer Support',
};

function normalizeCategory(rawCategory: string): string {
  return CATEGORY_MAP[rawCategory] ?? rawCategory;
}

/**
 * Seeds the initial tool list from the live products dataset.
 * Falls back to an empty array if the dataset is not yet available.
 * No hardcoded per-seat prices.
 */
function initDefaultTools(products: any[]): SaaSTool[] {
  return DEFAULT_SEED_TOOLS.flatMap(seed => {
    const product = products.find(
      (p: any) => p.name.toLowerCase() === seed.name.toLowerCase()
    );
    if (!product) return [];
    const pricedPlans = (product.plans as any[]).filter(
      (p: any) => p.priceMonthly !== null && p.priceMonthly > 0 && !p.isEnterprise
    );
    if (pricedPlans.length === 0) return [];
    // Use the lowest paid non-enterprise plan as the entry-level default
    const plan = [...pricedPlans].sort((a: any, b: any) => a.priceMonthly - b.priceMonthly)[0];
    return [{
      name: product.name,
      category: normalizeCategory(product.category),
      seats: seed.seats,
      pricePerSeat: plan.priceMonthly,
      plan: plan.name,
    }];
  });
}

const categories = [
  'Communication',
  'Productivity',
  'Project Management',
  'CRM',
  'Video',
  'Design',
  'Dev Tools',
  'Monitoring',
  'Email Marketing',
  'Customer Support',
];

interface Props {
  products?: any[];
}

export default function SaaSavingsCalculator({ products = [] }: Props) {
  const [tools, setTools] = useState<SaaSTool[]>(() => initDefaultTools(products));
  const [showResults, setShowResults] = useState(false);

  const addTool = () => {
    setTools([...tools, { name: '', category: 'Communication', seats: 10, pricePerSeat: 0, plan: '' }]);
  };

  const removeTool = (index: number) => {
    setTools(tools.filter((_, i) => i !== index));
  };

  const handleToolSelection = (index: number, selectedName: string) => {
    const matchedProduct = products.find(p => p.name.toLowerCase() === selectedName.toLowerCase());

    if (matchedProduct) {
      // Find the highest standard (non-enterprise) paid plan as the default selection
      const pricedPlans = matchedProduct.plans.filter(
        (p: any) => p.priceMonthly !== null && p.priceMonthly > 0
      );
      const defaultPlan = pricedPlans.length > 0 ? pricedPlans[pricedPlans.length - 1] : null;

      const updated = [...tools];
      updated[index] = {
        ...updated[index],
        name: matchedProduct.name,
        category: normalizeCategory(matchedProduct.category),
        pricePerSeat: defaultPlan ? defaultPlan.priceMonthly : updated[index].pricePerSeat,
        plan: defaultPlan ? defaultPlan.name : updated[index].plan,
      };
      setTools(updated);
    } else {
      updateTool(index, 'name', selectedName);
    }
  };

  const updateTool = (index: number, field: keyof SaaSTool, value: string | number) => {
    const updated = [...tools];
    updated[index] = { ...updated[index], [field]: value };
    setTools(updated);
  };

  const calculations = useMemo(() => {
    const totalMonthly = tools.reduce((sum, t) => sum + (t.seats * t.pricePerSeat), 0);
    const totalAnnual = totalMonthly * 12;

    const downgradeSavings = tools.reduce((sum, t) => {
      const matchedProduct = products.find(p => p.name.toLowerCase() === t.name.toLowerCase());
      // Fallback estimate when the product isn't in the dataset
      let downgradeRate = t.pricePerSeat * 0.6;

      if (matchedProduct) {
        const pricedPlans = matchedProduct.plans.filter(
          (p: any) => p.priceMonthly !== null && p.priceMonthly > 0
        );
        if (pricedPlans.length > 0) {
          const cheapestPlan = pricedPlans.sort((a: any, b: any) => a.priceMonthly - b.priceMonthly)[0];
          downgradeRate = cheapestPlan.priceMonthly < t.pricePerSeat
            ? cheapestPlan.priceMonthly
            : t.pricePerSeat; // already on the cheapest plan — no savings
        }
      }

      return sum + (t.seats * (t.pricePerSeat - downgradeRate));
    }, 0);

    // If multiple tools share a category, estimate consolidation to the cheapest per-seat option
    let consolidationSavings = 0;
    const byCategory: Record<string, SaaSTool[]> = {};
    tools.forEach(t => {
      if (!byCategory[t.category]) byCategory[t.category] = [];
      byCategory[t.category].push(t);
    });

    Object.values(byCategory).forEach(categoryTools => {
      if (categoryTools.length > 1) {
        const totalCategorySpend = categoryTools.reduce((s, t) => s + (t.seats * t.pricePerSeat), 0);
        const totalCategorySeats = categoryTools.reduce((s, t) => s + t.seats, 0);
        const cheapestPerSeat = Math.min(...categoryTools.map(t => t.pricePerSeat));
        const consolidatedCost = totalCategorySeats * cheapestPerSeat;
        if (totalCategorySpend > consolidatedCost) {
          consolidationSavings += (totalCategorySpend - consolidatedCost);
        }
      }
    });

    // Flat 15% negotiation estimate — industry-typical, not guaranteed
    const negotiationSavings = totalMonthly * 0.15;

    const totalMonthlySavings = downgradeSavings + consolidationSavings + negotiationSavings;
    const totalAnnualSavings = totalMonthlySavings * 12;
    const savingsPercentage = totalMonthly > 0 ? (totalMonthlySavings / totalMonthly) * 100 : 0;

    return {
      totalMonthly,
      totalAnnual,
      downgradeSavings: downgradeSavings * 12,
      consolidationSavings: consolidationSavings * 12,
      negotiationSavings: negotiationSavings * 12,
      totalAnnualSavings,
      savingsPercentage,
    };
  }, [tools, products]);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${Math.round(amount)}`;
  };

  return (
    <div className="space-y-8">
      <div className="card-blur rounded-xl p-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Your Current SaaS Stack</h2>
        <p className="text-zinc-500 text-sm mb-6">
          Add the SaaS tools your team uses. Select a known product from the list to auto-fill its current verified price, or enter your own figures.
        </p>

        <div className="space-y-4">
          {tools.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-zinc-800 rounded-lg">
              <p className="text-zinc-400 text-sm mb-1 font-medium">No tools added yet.</p>
              <p className="text-zinc-600 text-xs">Click "Add a tool" below. Select a known product to auto-fill its current price from our verified dataset.</p>
            </div>
          ) : (
            tools.map((tool, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-3">
                  <label className="text-xs text-zinc-500 mb-1 block">Tool Name</label>
                  <input
                    type="text"
                    list="saas-products"
                    value={tool.name}
                    onChange={e => handleToolSelection(i, e.target.value)}
                    placeholder="e.g., Slack"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                  <datalist id="saas-products">
                    {products.map(p => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-zinc-500 mb-1 block">Category</label>
                  <select
                    value={tool.category}
                    onChange={e => updateTool(i, 'category', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-zinc-500 mb-1 block">Seats</label>
                  <input
                    type="number"
                    value={tool.seats}
                    onChange={e => updateTool(i, 'seats', parseInt(e.target.value) || 0)}
                    min="1"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-zinc-500 mb-1 block">$/seat/mo</label>
                  <input
                    type="number"
                    value={tool.pricePerSeat}
                    onChange={e => updateTool(i, 'pricePerSeat', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-zinc-500 mb-1 block">Plan</label>
                  <input
                    type="text"
                    value={tool.plan}
                    onChange={e => updateTool(i, 'plan', e.target.value)}
                    placeholder="e.g., Pro"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <div className="sm:col-span-1">
                  <button
                    onClick={() => removeTool(i)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-red-400 hover:border-red-400/30 transition-all focus:ring-2 focus:ring-red-500 focus:outline-none"
                    aria-label={`Remove ${tool.name}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          onClick={addTool}
          className="mt-4 text-sm text-emerald-400 hover:text-emerald-300 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        >
          + Add {tools.length === 0 ? 'a tool' : 'another tool'}
        </button>
      </div>

      <button
        onClick={() => setShowResults(true)}
        disabled={tools.length === 0}
        className="w-full btn-primary text-base py-4 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Calculate My Savings Estimate
      </button>

      {showResults && (
        <div className="space-y-6">
          <div className="card-blur rounded-xl p-6 border border-emerald-400/10">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Your Current Spend</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Monthly</div>
                <div className="text-2xl font-bold text-zinc-100">{formatCurrency(calculations.totalMonthly)}/mo</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Annual</div>
                <div className="text-2xl font-bold text-zinc-100">{formatCurrency(calculations.totalAnnual)}/yr</div>
              </div>
            </div>
          </div>

          <div className="card-blur rounded-xl p-6 border-2 border-emerald-400/30">
            <h2 className="text-lg font-semibold text-zinc-100 mb-1">Estimated Potential Savings</h2>
            <p className="text-xs text-zinc-500 mb-5">
              Ballpark figures based on your inputs and simplified assumptions — not a guarantee. See the disclaimer below for details.
            </p>
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-emerald-400 mb-2">
                {formatCurrency(calculations.totalAnnualSavings)}/yr
              </div>
              <div className="text-sm text-zinc-500">
                ~{calculations.savingsPercentage.toFixed(0)}% estimated reduction in SaaS spend
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                <div>
                  <div className="text-sm font-medium text-zinc-200">Downgrade Savings (estimated)</div>
                  <div className="text-xs text-zinc-500">Potential savings from moving to the lowest paid plan per tool</div>
                </div>
                <div className="text-lg font-bold text-emerald-400">{formatCurrency(calculations.downgradeSavings)}/yr</div>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                <div>
                  <div className="text-sm font-medium text-zinc-200">Consolidation Savings (estimated)</div>
                  <div className="text-xs text-zinc-500">Potential savings from eliminating redundant tools in the same category</div>
                </div>
                <div className="text-lg font-bold text-emerald-400">{formatCurrency(calculations.consolidationSavings)}/yr</div>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm font-medium text-zinc-200">Negotiation Savings (estimated)</div>
                  <div className="text-xs text-zinc-500">Assumes ~15% off at renewal — typical industry range, not guaranteed</div>
                </div>
                <div className="text-lg font-bold text-emerald-400">{formatCurrency(calculations.negotiationSavings)}/yr</div>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-lg bg-zinc-900/60 border border-zinc-700/50">
              <p className="text-xs text-zinc-400 leading-relaxed">
                <span className="font-semibold text-zinc-300">Disclaimer:</span> These are rough estimates based on your inputs and simplified heuristics — a flat 15% negotiation assumption, downgrade savings based on lowest public list prices, and consolidation based on category overlap. They are not verified savings. Actual results depend on your contracts, real usage, and negotiating leverage. For exact, dataset-verified figures, use the{' '}
                <a href="/downgrade" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">Downgrade Engine</a>
                {' '}and the{' '}
                <a href="/audit" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">Stack Auditor</a>.
              </p>
            </div>
          </div>

          <div className="card-blur rounded-xl p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-2">Turn This Estimate Into Verified Savings</h2>
            <p className="text-xs text-zinc-500 mb-5">
              The numbers above are a starting point. These tools use our verified dataset to give you exact, actionable figures.
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                  <span className="text-emerald-400 font-bold text-sm">1</span>
                </div>
                <div>
                  <a href="/downgrade" className="text-sm font-medium text-zinc-200 hover:text-emerald-400 transition-colors">
                    Run the Downgrade Engine
                  </a>
                  <p className="text-xs text-zinc-500 mt-0.5">See exactly which lower-tier plans cover your actual feature usage — verified plan-by-plan against our dataset, not a flat estimate.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                  <span className="text-emerald-400 font-bold text-sm">2</span>
                </div>
                <div>
                  <a href="/audit" className="text-sm font-medium text-zinc-200 hover:text-emerald-400 transition-colors">
                    Run the Stack Auditor
                  </a>
                  <p className="text-xs text-zinc-500 mt-0.5">Find verified open-source and cheaper alternatives to every tool in your stack, with real price comparisons.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
                  <span className="text-emerald-400 font-bold text-sm">3</span>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-zinc-200">Generate Negotiation Scripts</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Get data-driven scripts to negotiate your next renewal using real competitor pricing from our dataset.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
