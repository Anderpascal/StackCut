import React, { useState, useMemo } from 'react';
import type { SaaSProductData } from '../types/saas';
import { RELATED_CATEGORIES, CATEGORY_ORDER, groupProductsByCategory } from '../lib/categories';
import { useCurrencyShared as useCurrency } from '../lib/currency-context';
import { CurrencyProvider } from './CurrencyProvider';
import CurrencySelector from './CurrencySelector';
import { Copy, Check, MessageSquare, Zap } from 'lucide-react';

interface Props {
  products: SaaSProductData[];
}

function getSmartAlternatives(
  product: SaaSProductData,
  allProducts: SaaSProductData[]
): SaaSProductData[] {
  const relatedCategories = RELATED_CATEGORIES[product.category] || [product.category];
  return allProducts.filter(
    p => p.id !== product.id && relatedCategories.includes(p.category)
  );
}

type TemplateType = 'negotiation' | 'cancellation' | 'downgrade';
type ToneType = 'professional' | 'assertive' | 'friendly';

const TONE_LABELS: Record<ToneType, string> = {
  professional: 'Professional',
  assertive: 'Assertive',
  friendly: 'Friendly',
};

const TEMPLATE_LABELS: Record<TemplateType, string> = {
  negotiation: 'Negotiation',
  cancellation: 'Cancellation Threat',
  downgrade: 'Plan Downgrade',
};

export function generateScript(
  params: {
    saasName: string;
    currentPlan: string;
    monthlySpend: number;
    competitorName: string;
    competitorPrice: number;
    userCount: number;
  },
  template: TemplateType,
  tone: ToneType,
  fmt: (amount: number) => string
): string {
  const annualSpend = params.monthlySpend * 12;
  const annualCompetitor = params.competitorPrice * 12;
  const savings = annualSpend - annualCompetitor;
  // totalAnnualSavings: the true team-wide figure across all seats
  // (savings is per-user/year; the percent ratio is the same either way)
  const totalAnnualSavings = Math.max(0, (params.monthlySpend - params.competitorPrice) * 12 * params.userCount);
  const savingsPercent = annualSpend > 0 ? Math.round((savings / annualSpend) * 100) : 0;

  const greetings: Record<ToneType, string> = {
    professional: 'Hi there,',
    assertive: 'Hello,',
    friendly: 'Hey, thanks so much for your help —',
  };

  const closings: Record<ToneType, string> = {
    professional: 'Looking forward to your proposal.\n\nBest regards,\n[Your Name]\n[Your Title]\n[Company Name]',
    assertive: 'We expect a response by end of week.\n\nRegards,\n[Your Name]\n[Your Title]\n[Company Name]',
    friendly: 'Thanks again! Really appreciate you taking a look.\n\nBest,\n[Your Name]\n[Your Title]\n[Company Name]',
  };

  const subjectPrefix: Record<TemplateType, string> = {
    negotiation: 'Account Review - Competitive Pricing Analysis for',
    cancellation: 'Notice of Potential Cancellation -',
    downgrade: 'Plan Downgrade Request -',
  };

  if (template === 'negotiation') {
    const bodyTone: Record<ToneType, string> = {
      professional:
        `I am reaching out regarding our ${params.saasName} subscription under the ${params.currentPlan || 'current'} plan. We have been a customer for some time, but as we scale, I have been conducting a thorough review of our software stack costs.\n\n` +
        `After analyzing the market, I found that ${params.competitorName} offers a comparable feature set at a significantly lower price point: ${fmt(params.competitorPrice)}/user/month versus ${fmt(params.monthlySpend)}/user/month with ${params.saasName}.\n\n` +
        `With ${params.userCount} seats, this represents a potential team savings of ${fmt(totalAnnualSavings)} annually in total (${savingsPercent}% reduction). The functional parity is strong enough that my team is already evaluating a pilot switch.\n\n` +
        `Before we initiate any migration, I wanted to give ${params.saasName} the opportunity to retain our business. Is there a retention discount, a plan adjustment, or a long-term agreement rate that could bring our effective cost closer to the market rate?\n\n` +
        `If we can achieve a meaningful reduction, I am happy to commit to an annual contract today.`,
      assertive:
        `We are reviewing our ${params.saasName} subscription under the ${params.currentPlan || 'current'} plan. Our usage data does not justify the current price point.\n\n` +
        `${params.competitorName} provides equivalent functionality at ${fmt(params.competitorPrice)}/user/month — significantly below our current ${fmt(params.monthlySpend)}/user/month with ${params.saasName}.\n\n` +
        `Across ${params.userCount} seats, we are looking at ${fmt(totalAnnualSavings)}/year in total unnecessary spend (${savingsPercent}% over market rate). We require a revised pricing proposal that closes this gap.\n\n` +
        `If ${params.saasName} cannot offer competitive pricing within 5 business days, we will proceed with the migration to ${params.competitorName}.`,
      friendly:
        `I wanted to reach out about our ${params.saasName} subscription — we are on the ${params.currentPlan || 'current'} plan at ${fmt(params.monthlySpend)}/user/month for ${params.userCount} seats.\n\n` +
        `I have been doing some housekeeping on our software stack (trying to be a good steward of the budget!) and noticed that ${params.competitorName} offers very similar functionality at ${fmt(params.competitorPrice)}/user/month. For our ${params.userCount} seats, that is about ${fmt(totalAnnualSavings)}/year difference in total.\n\n` +
        `I would much rather stay with ${params.saasName} — we love the product. Is there any way to get closer to that price point? A retention discount, annual commitment rate, or even a different plan tier? Happy to commit to annual billing if that helps.\n\n` +
        `Totally understand if not, just wanted to ask before we explore alternatives.`,
    };

    return `Subject: ${subjectPrefix[template]} ${params.saasName}\n\n${greetings[tone]}\n\n${bodyTone[tone]}\n\n${closings[tone]}`;
  }

  if (template === 'cancellation') {
    const bodyTone: Record<ToneType, string> = {
      professional:
        `After a comprehensive review of our ${params.saasName} subscription (${params.currentPlan || 'current'} plan at ${fmt(params.monthlySpend)}/user/month for ${params.userCount} users), we have identified a competitive alternative in ${params.competitorName} at ${fmt(params.competitorPrice)}/user/month.\n\n` +
        `The annual cost difference of ${fmt(totalAnnualSavings)} across all ${params.userCount} users (${savingsPercent}% reduction) is material enough that we are initiating a formal evaluation of migration paths. Our team estimates a 4-6 week migration timeline if we proceed.\n\n` +
        `Before we commit to this path, we want to offer ${params.saasName} a final opportunity to retain our business. If you can match or come within 10% of ${params.competitorName}'s pricing, we will cancel our migration plans and renew immediately.\n\n` +
        `Please let us know by [date + 7 days] if a revised proposal is possible. After that, we will begin the data export and migration process.`,
      assertive:
        `We are terminating our ${params.saasName} subscription unless pricing is adjusted to market levels.\n\n` +
        `Current spend: ${fmt(params.monthlySpend)}/user/month × ${params.userCount} users = ${fmt(params.monthlySpend * params.userCount)}/month.\n` +
        `Market alternative (${params.competitorName}): ${fmt(params.competitorPrice)}/user/month.\n` +
        `Annual overpayment across all ${params.userCount} seats: ${fmt(totalAnnualSavings)}.\n\n` +
        `We have identified a migration path and will execute it within 30 days unless ${params.saasName} matches the competitor rate. This is not a negotiation tactic — it is a budget decision.`,
      friendly:
        `Quick heads-up: we are looking at potentially cancelling our ${params.saasName} subscription. Budget is tight and we found ${params.competitorName} at ${fmt(params.competitorPrice)}/user/month — way less than the ${fmt(params.monthlySpend)}/user/month we pay now.\n\n` +
        `We would be saving about ${fmt(totalAnnualSavings)}/year in total across all ${params.userCount} seats by switching, so we are seriously considering it. Migration would probably take 4-6 weeks.\n\n` +
        `Before we go down that road though — any chance you could match or get close to that price? I would genuinely prefer to stay, but the numbers are pretty compelling. If nothing can be done, totally get it and no hard feelings!`,
    };

    return `Subject: ${subjectPrefix[template]} ${params.saasName}\n\n${greetings[tone]}\n\n${bodyTone[tone]}\n\n${closings[tone]}`;
  }

  // downgrade template
  const bodyTone: Record<ToneType, string> = {
    professional:
      `I am writing to request a plan change for our ${params.saasName} subscription. We are currently on the ${params.currentPlan || 'current'} plan at ${fmt(params.monthlySpend)}/user/month for ${params.userCount} users.\n\n` +
      `After reviewing our actual usage patterns, we have determined that we do not require all ${params.currentPlan}-tier features. A lower tier plan would adequately serve our needs at a reduced cost.\n\n` +
      `We have also benchmarked against ${params.competitorName} which offers comparable core features at ${fmt(params.competitorPrice)}/user/month. While we prefer to stay with ${params.saasName}, the current plan tier no longer aligns with our usage.\n\n` +
      `Please advise on the process to downgrade our account without service interruption. If there is a middle-ground plan between our current tier and the base plan, we would appreciate details on that option as well.`,
    assertive:
      `We are downgrading our ${params.saasName} subscription from the ${params.currentPlan || 'current'} plan.\n\n` +
      `Our usage analysis shows we only need a subset of the features we are paying ${fmt(params.monthlySpend)}/user/month for. ${params.competitorName} provides equivalent core functionality at ${fmt(params.competitorPrice)}/user/month — confirming we are over-tiered.\n\n` +
      `Please process the downgrade to the most appropriate lower tier that retains [key features]. If ${params.saasName} cannot accommodate a smooth downgrade path, we will migrate entirely to ${params.competitorName}.`,
    friendly:
      `Hope you are doing well! Quick request: we are looking to downgrade our ${params.saasName} subscription from the ${params.currentPlan || 'current'} plan.\n\n` +
      `We just are not using all the premium features and it feels wasteful to keep paying ${fmt(params.monthlySpend)}/user/month when we could be on a lower tier. For context, ${params.competitorName} offers what we actually need at ${fmt(params.competitorPrice)}/user/month.\n\n` +
      `Is there an easy way to drop down to a plan that keeps [key features] without losing our data or integrations? Would love to keep things simple and stay with ${params.saasName}.`,
  };

  return `Subject: ${subjectPrefix[template]} ${params.saasName}\n\n${greetings[tone]}\n\n${bodyTone[tone]}\n\n${closings[tone]}`;
}

export default function NegotiationScriptGenerator({ products }: Props) {
  return (
    <CurrencyProvider>
      <CurrencySelector />
      <NegotiationScriptGeneratorInner products={products} />
    </CurrencyProvider>
  );
}

function NegotiationScriptGeneratorInner({ products }: { products: SaaSProductData[] }) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>('');
  const [selectedCompetitorPlanId, setSelectedCompetitorPlanId] = useState<string>('');
  const [template, setTemplate] = useState<TemplateType>('negotiation');
  const [tone, setTone] = useState<ToneType>('professional');
  const [manualCompetitorName, setManualCompetitorName] = useState('');
  const [manualCompetitorPrice, setManualCompetitorPrice] = useState('');
  const [userCount, setUserCount] = useState<number>(10);
  const [copied, setCopied] = useState(false);
  const [productSearch, setProductSearch] = useState<string>('');
  const [competitorSearch, setCompetitorSearch] = useState<string>('');

  const { fmt } = useCurrency();

  const product = useMemo(
    () => products.find(p => p.id === selectedProductId),
    [selectedProductId, products]
  );

  const smartAlternatives = useMemo(
    () => (product ? getSmartAlternatives(product, products) : []),
    [product, products]
  );

  // Filtered + grouped products for "Your Current SaaS" selector
  const filteredProducts = useMemo(() => {
    const term = productSearch.toLowerCase().trim();
    let filtered = term === ''
      ? products
      : products.filter(p => p.name.toLowerCase().includes(term));
    // Preserve selected product even if it doesn't match filter
    if (term !== '' && selectedProductId) {
      const selected = products.find(p => p.id === selectedProductId);
      if (selected && !filtered.some(p => p.id === selectedProductId)) {
        filtered = [selected, ...filtered];
      }
    }
    return filtered;
  }, [products, productSearch, selectedProductId]);

  const groupedProducts = useMemo(
    () => groupProductsByCategory(filteredProducts),
    [filteredProducts]
  );

  // Determine "no results" from the original search match (before selected-product preservation)
  const productNoResults = useMemo(() => {
    const term = productSearch.toLowerCase().trim();
    if (term === '') return false;
    return products.filter(p => p.name.toLowerCase().includes(term)).length === 0;
  }, [products, productSearch]);

  // Filtered + grouped products for "Cheaper Alternative" selector
  const filteredAlternatives = useMemo(() => {
    const term = competitorSearch.toLowerCase().trim();
    let filtered = term === ''
      ? smartAlternatives
      : smartAlternatives.filter(p => p.name.toLowerCase().includes(term));
    // Preserve selected competitor even if it doesn't match filter
    if (term !== '' && selectedCompetitorId) {
      const selected = smartAlternatives.find(p => p.id === selectedCompetitorId);
      if (selected && !filtered.some(p => p.id === selectedCompetitorId)) {
        filtered = [selected, ...filtered];
      }
    }
    return filtered;
  }, [smartAlternatives, competitorSearch, selectedCompetitorId]);

  const groupedAlternatives = useMemo(
    () => groupProductsByCategory(filteredAlternatives),
    [filteredAlternatives]
  );

  // Determine "no results" from the original search match (before selected-competitor preservation)
  const competitorNoResults = useMemo(() => {
    const term = competitorSearch.toLowerCase().trim();
    if (term === '') return false;
    return smartAlternatives.filter(p => p.name.toLowerCase().includes(term)).length === 0;
  }, [smartAlternatives, competitorSearch]);

  const competitor = useMemo(
    () => products.find(p => p.id === selectedCompetitorId),
    [selectedCompetitorId, products]
  );

  const competitorPlan = useMemo(
    () => competitor?.plans.find(p => p.id === selectedCompetitorPlanId),
    [competitor, selectedCompetitorPlanId]
  );

  const selectedPlan = useMemo(
    () => product?.plans.find(p => p.id === selectedPlanId),
    [product, selectedPlanId]
  );

  const useManual = manualCompetitorName.trim() !== '' && manualCompetitorPrice !== '';

  const competitorName = useManual ? manualCompetitorName : competitor?.name || '';
  const competitorPrice = useManual
    ? parseFloat(manualCompetitorPrice) || 0
    : competitorPlan?.priceMonthly || 0;

  const handleProductSelect = (id: string) => {
    setSelectedProductId(id);
    setSelectedPlanId('');
    setSelectedCompetitorId('');
    setSelectedCompetitorPlanId('');
    setManualCompetitorName('');
    setManualCompetitorPrice('');
  };

  const params = useMemo(
    () => ({
      saasName: product?.name || '',
      currentPlan: selectedPlan?.name || '',
      monthlySpend: selectedPlan?.priceMonthly || 0,
      competitorName,
      competitorPrice,
      userCount,
    }),
    [product, selectedPlan, competitorName, competitorPrice, userCount]
  );

  const generatedScript = useMemo(() => {
    if (!params.saasName || !params.currentPlan || !params.competitorName || params.monthlySpend <= 0)
      return '';
    return generateScript(params, template, tone, fmt);
  }, [params, template, tone, fmt]);

  const copyToClipboard = () => {
    if (!generatedScript) return;
    navigator.clipboard.writeText(generatedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Inputs */}
      <div className="card-blur rounded-xl p-6 sm:p-8 mb-8">
        {/* Row 1: Product + Plan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Your Current SaaS</label>
            <input
              type="search"
              aria-label="Filter products"
              placeholder="Filter products..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-zinc-600 mb-2"
            />
            <select
              value={selectedProductId}
              onChange={e => handleProductSelect(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
            >
              <option value="">Select your SaaS...</option>
              {CATEGORY_ORDER.map(cat => {
                const catProducts = groupedProducts[cat];
                if (!catProducts || catProducts.length === 0) return null;
                return (
                  <optgroup key={cat} label={cat}>
                    {catProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            {productNoResults && (
              <p className="text-xs text-zinc-500 mt-2">No products match your search</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Your Current Plan</label>
            <select
              value={selectedPlanId}
              onChange={e => setSelectedPlanId(e.target.value)}
              disabled={!product}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select your plan...</option>
              {product?.plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.priceMonthly !== null ? fmt(p.priceMonthly) : 'Custom'}/mo
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Competitor dropdown OR manual */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Cheaper Alternative (from related categories)
            </label>
            <input
              type="search"
              aria-label="Filter products"
              placeholder="Filter products..."
              value={competitorSearch}
              onChange={e => setCompetitorSearch(e.target.value)}
              disabled={!product || smartAlternatives.length === 0}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-zinc-600 mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <select
              value={selectedCompetitorId}
              onChange={e => {
                setSelectedCompetitorId(e.target.value);
                setSelectedCompetitorPlanId('');
                setManualCompetitorName('');
                setManualCompetitorPrice('');
              }}
              disabled={!product || smartAlternatives.length === 0}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select from alternatives...</option>
              {CATEGORY_ORDER.map(cat => {
                const catProducts = groupedAlternatives[cat];
                if (!catProducts || catProducts.length === 0) return null;
                return (
                  <optgroup key={cat} label={cat}>
                    {catProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            {competitorNoResults && (
              <p className="text-xs text-zinc-500 mt-2">No products match your search</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Competitor Plan</label>
            <select
              value={selectedCompetitorPlanId}
              onChange={e => setSelectedCompetitorPlanId(e.target.value)}
              disabled={!competitor}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select competitor plan...</option>
              {competitor?.plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.priceMonthly !== null ? fmt(p.priceMonthly) : 'Custom'}/mo
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Manual competitor inputs (override dropdown) */}
        <div className="border-t border-zinc-800 pt-4 mb-6">
          <p className="text-xs text-zinc-500 mb-3">Or enter a competitor manually (overrides dropdown):</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Competitor name"
              value={manualCompetitorName}
              onChange={e => setManualCompetitorName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-zinc-600"
            />
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">$</span>
              <input
                type="number"
                placeholder="Price/user/mo"
                value={manualCompetitorPrice}
                onChange={e => setManualCompetitorPrice(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-zinc-600"
              />
            </div>
          </div>
        </div>

        {/* Template + Tone + User Count */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Template</label>
            <div className="flex gap-1">
              {(Object.keys(TEMPLATE_LABELS) as TemplateType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTemplate(t)}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                    template === t
                      ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30'
                      : 'bg-zinc-950 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                  }`}
                  aria-label={`${TEMPLATE_LABELS[t]} template`}
                >
                  {TEMPLATE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Tone</label>
            <div className="flex gap-1">
              {(Object.keys(TONE_LABELS) as ToneType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                    tone === t
                      ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30'
                      : 'bg-zinc-950 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                  }`}
                  aria-label={`${TONE_LABELS[t]} tone`}
                >
                  {TONE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">User Count</label>
            <input
              type="number"
              min={1}
              value={userCount}
              onChange={e => setUserCount(parseInt(e.target.value) || 1)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Generated Script */}
      {generatedScript && (
        <div className="card-blur rounded-xl overflow-hidden border border-emerald-400/10">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/30">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-zinc-300">Generated {TEMPLATE_LABELS[template]} Script</span>
            </div>
            <button
              onClick={copyToClipboard}
              aria-label={copied ? 'Copied to clipboard' : 'Copy script to clipboard'}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                copied
                  ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/30'
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-600'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
          <div className="p-6">
            <pre className="font-mono text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {generatedScript}
            </pre>
          </div>
        </div>
      )}

      {!generatedScript && (
        <div className="card-blur rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-300 mb-2">Select your tools to generate</h3>
          <p className="text-zinc-500 text-sm max-w-md mx-auto">
            Choose your current SaaS and a cheaper alternative. We will generate a data-backed negotiation email you can send today.
          </p>
        </div>
      )}
    </div>
  );
}
