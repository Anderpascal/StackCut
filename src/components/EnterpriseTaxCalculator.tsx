import React, { useState, useMemo } from 'react';
import type { SaaSProductData, EnterpriseTaxBreakdown, OSSAlternative } from '../types/saas';
import { Calculator, Lock, Shield, Eye, DollarSign, Users, Printer, ArrowRight } from 'lucide-react';
import { useCurrencyShared as useCurrency } from '../lib/currency-context';
import { CurrencyProvider } from './CurrencyProvider';
import CurrencySelector from './CurrencySelector';
import { groupProductsByCategory, CATEGORY_ORDER } from '../lib/categories';

interface Props {
  products: SaaSProductData[];
}

// Local extension: adds featureName (component-only field) to the shared OSSAlternative type.
type OSSAltExtended = OSSAlternative & { featureName: string };

const OSS_LINKS: Record<string, string> = {
  'Keycloak': 'https://keycloak.org',
  'Authentik': 'https://goauthentik.io',
  'Dex': 'https://dexidp.io',
  'Grafana Loki': 'https://grafana.com/oss/loki',
  'Vector': 'https://vector.dev',
  'Casbin': 'https://casbin.org',
  'Open Policy Agent': 'https://openpolicyagent.org',
  'Uptime Kuma': 'https://uptime.kuma.pet',
};

// IMPORTANT SCOPE: These OSS tools apply only to applications YOU build and deploy yourself.
// They do NOT let you bypass a third-party SaaS vendor's enterprise gate — for example,
// self-hosting Keycloak will NOT give you Slack's SAML SSO without Slack's paid tier,
// because Slack must enable SAML on your account regardless of your IdP.
// Similarly, Grafana Loki cannot reconstruct audit events generated server-side by a third-party vendor.
const openSourceAlternatives: Record<
  string,
  { name: string; description: string; setupComplexity: 'low' | 'medium' | 'high'; savingsPerMonth: number; effortHours: number }[]
> = {
  saml_sso: [
    {
      name: 'Keycloak',
      description: 'Open-source Identity Provider for apps you deploy. Eliminates per-seat SSO licensing costs (Okta, Auth0, etc.) for internal tools and self-hosted software. Does not bypass a third-party SaaS vendor\'s enterprise-tier SSO gate.',
      setupComplexity: 'medium',
      savingsPerMonth: 15,
      effortHours: 40,
    },
    {
      name: 'Authentik',
      description: 'Modern self-hosted identity provider for internal applications. Handles SAML/OIDC for services you control, replacing paid commercial IdPs.',
      setupComplexity: 'low',
      savingsPerMonth: 12,
      effortHours: 20,
    },
    {
      name: 'Dex',
      description: 'Lightweight OIDC/SAML connector for Kubernetes workloads and internal services. Replaces managed IdP subscriptions for infrastructure you own.',
      setupComplexity: 'medium',
      savingsPerMonth: 10,
      effortHours: 30,
    },
  ],
  audit_logs: [
    {
      name: 'Grafana Loki',
      description: 'Log aggregation for infrastructure and services you operate. Replaces paid log-management SaaS for your own servers. Cannot reconstruct audit events generated server-side by third-party SaaS vendors.',
      setupComplexity: 'medium',
      savingsPerMonth: 25,
      effortHours: 30,
    },
    {
      name: 'Vector',
      description: 'High-performance log pipeline for infrastructure you control. Collects and routes logs from your own systems, not from third-party SaaS platforms.',
      setupComplexity: 'low',
      savingsPerMonth: 8,
      effortHours: 15,
    },
  ],
  roles_permissions: [
    {
      name: 'Casbin',
      description: 'Authorization library (ACL, RBAC, ABAC) for applications you build. Eliminates the need for commercial authorization-as-a-service platforms.',
      setupComplexity: 'medium',
      savingsPerMonth: 10,
      effortHours: 25,
    },
    {
      name: 'Open Policy Agent',
      description: 'Policy-as-code engine for unified authorization across your own services and APIs. Replaces commercial policy-management products.',
      setupComplexity: 'high',
      savingsPerMonth: 15,
      effortHours: 40,
    },
  ],
  sla: [
    {
      name: 'Uptime Kuma',
      description: 'Self-hosted uptime monitoring and status pages. Replaces paid monitoring SaaS for your own infrastructure.',
      setupComplexity: 'low',
      savingsPerMonth: 5,
      effortHours: 8,
    },
  ],
};

const enterprisePremiumFeatures = [
  { id: 'saml_sso', name: 'SAML Single Sign-On', avgPricePerUser: 15, icon: Lock },
  { id: 'audit_logs', name: 'Audit Logs', avgPricePerUser: 8, icon: Eye },
  { id: 'roles_permissions', name: 'Custom Roles & Permissions', avgPricePerUser: 10, icon: Shield },
  { id: 'sla', name: 'SLA / Uptime Guarantee', avgPricePerUser: 5, icon: Calculator },
];

export default function EnterpriseTaxCalculator({ products }: Props) {
  return (
    <CurrencyProvider>
      <CurrencySelector />
      <EnterpriseTaxCalculatorInner products={products} />
    </CurrencyProvider>
  );
}

function EnterpriseTaxCalculatorInner({ products }: { products: SaaSProductData[] }) {
  const { fmt } = useCurrency();
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [userCount, setUserCount] = useState<number>(50);
  const [selectedTaxFeatures, setSelectedTaxFeatures] = useState<Set<string>>(
    new Set(['saml_sso', 'audit_logs'])
  );

  const product = useMemo(
    () => products.find(p => p.id === selectedProductId),
    [selectedProductId, products]
  );

  const enterprisePlan = useMemo(() => {
    if (!product) return null;
    return product.plans.find(p => p.isEnterprise) || null;
  }, [product]);

  const proPlan = useMemo(() => {
    if (!product) return null;
    const nonEnterprise = product.plans.filter(p => !p.isEnterprise);
    // Find the most expensive non-enterprise plan
    return (
      nonEnterprise.sort((a, b) => (b.priceMonthly ?? 0) - (a.priceMonthly ?? 0))[0] || null
    );
  }, [product]);

  const toggleTaxFeature = (id: string) => {
    setSelectedTaxFeatures(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const analysis = useMemo(() => {
    if (!product || !enterprisePlan) return null;

    const entPrice = enterprisePlan.priceMonthly;
    const proPrice = proPlan?.priceMonthly ?? null;

    // True when the vendor doesn't publish an enterprise per-seat price
    const hasCustomEnterprisePricing = entPrice === null;

    // Avoidable overpayment: only computable when both tier prices are published
    let avoidableOverpayment: number | null = null;
    if (entPrice !== null && proPrice !== null) {
      avoidableOverpayment = (entPrice - proPrice) * userCount;
    }

    // Baseline: highest published tier × users — a useful floor even when enterprise is custom
    const proBaselineCost: number | null = proPrice !== null ? proPrice * userCount : null;

    // Monthly cost on enterprise tier (null when price is unpublished)
    const totalMonthly: number | null = entPrice !== null ? entPrice * userCount : null;

    // OSS alternatives — for internal apps only, scoped clearly in the UI
    const selectedPremiumFeatures = enterprisePremiumFeatures.filter(f =>
      selectedTaxFeatures.has(f.id)
    );

    const ossAlts: OSSAltExtended[] = selectedPremiumFeatures.flatMap(f =>
      (openSourceAlternatives[f.id] || []).map(alt => {
        const savingsPerMonth = alt.savingsPerMonth;
        const effortHours = alt.effortHours;
        const roiPerHour =
          effortHours > 0 ? Math.round(((savingsPerMonth * 12) / effortHours) * 100) / 100 : 0;
        return {
          name: alt.name,
          description: alt.description,
          setupComplexity: alt.setupComplexity,
          savingsPerMonth,
          effortHours,
          url: OSS_LINKS[alt.name] || '#',
          roiPerHour,
          featureName: f.name,
        };
      })
    );

    // ossSavings: flat monthly sum for internal-apps context.
    // NOT scaled by userCount (these are hosting costs, not per-seat).
    // NOT added to avoidableOverpayment (different context: your own apps vs. third-party SaaS).
    const ossSavings = ossAlts.reduce((acc, alt) => acc + alt.savingsPerMonth, 0);

    return {
      planName: enterprisePlan.name,
      pricePerUser: entPrice,
      userCount,
      totalMonthly,
      hasCustomEnterprisePricing,
      proBaselineCost,
      proPlanName: proPlan?.name ?? null,
      proPricePerUser: proPrice,
      premiumFeatures: selectedPremiumFeatures.map(f => ({
        name: f.name,
        price: f.avgPricePerUser * userCount,
      })),
      openSourceAlternatives: ossAlts,
      avoidableOverpayment,
      ossSavings,
    };
  }, [product, enterprisePlan, proPlan, userCount, selectedTaxFeatures]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth <= 768) {
        alert('Use Ctrl+P (Cmd+P on Mac) or Share → Print to save as PDF');
        return;
      }
      window.print();
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Inputs */}
      <div className="card-blur rounded-xl p-6 sm:p-8 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Select SaaS</label>
            <input
              type="search"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Filter products..."
              aria-label="Filter products"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-300 mb-3 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-zinc-600"
            />
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
            >
              <option value="">Choose a product...</option>
              {(() => {
                const term = productSearch.toLowerCase().trim();
                let enterpriseProducts = products.filter(p => p.plans.some(pl => pl.isEnterprise));
                // Filter by search term
                let filtered =
                  term === ''
                    ? enterpriseProducts
                    : enterpriseProducts.filter(p => p.name.toLowerCase().includes(term));
                // Preserve selected product even if it doesn't match the filter
                if (term !== '' && selectedProductId) {
                  const selected = enterpriseProducts.find(p => p.id === selectedProductId);
                  if (selected && !filtered.some(p => p.id === selectedProductId)) {
                    filtered = [selected, ...filtered];
                  }
                }
                const grouped = groupProductsByCategory(filtered);
                return CATEGORY_ORDER.map(cat => {
                  const catProducts = grouped[cat];
                  if (!catProducts || catProducts.length === 0) return null;
                  return (
                    <optgroup key={cat} label={cat}>
                      {catProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                });
              })()}
            </select>
            {productSearch.trim() !== '' &&
              (() => {
                const term = productSearch.toLowerCase().trim();
                const enterpriseProducts = products.filter(p =>
                  p.plans.some(pl => pl.isEnterprise)
                );
                const matches = enterpriseProducts.filter(p =>
                  p.name.toLowerCase().includes(term)
                );
                return matches.length === 0 ? (
                  <p className="text-xs text-zinc-500 mt-2">No products match your search</p>
                ) : null;
              })()}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Number of Users</label>
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-zinc-500" />
              <input
                type="number"
                min={1}
                max={10000}
                value={userCount}
                onChange={e => setUserCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-3">
            Enterprise features you actually need
          </label>
          <div className="flex flex-wrap gap-3">
            {enterprisePremiumFeatures.map(feature => {
              const Icon = feature.icon;
              const isSelected = selectedTaxFeatures.has(feature.id);
              return (
                <button
                  key={feature.id}
                  onClick={() => toggleTaxFeature(feature.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                    isSelected
                      ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700'
                  }`}
                  aria-pressed={isSelected}
                >
                  <Icon className="w-4 h-4" />
                  {feature.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Export button */}
        <div className="mt-6 pt-4 border-t border-zinc-800 flex justify-end">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:text-zinc-100 transition-all focus:ring-2 focus:ring-emerald-500 focus:outline-none keep-for-print"
            aria-label="Export report as PDF"
            data-plausible-event="PDF Export"
          >
            <Printer className="w-4 h-4" />
            Export PDF
          </button>
          <span className="hidden max-md:block text-xs text-zinc-500 mt-1 text-center">
            Tip: Use Ctrl+P or Share &rarr; Print on mobile
          </span>
        </div>
      </div>

      {/* Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Main Tax Card */}
          <div className="card-blur rounded-xl p-8 border border-red-400/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-red-400/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-100">Enterprise Tax Breakdown</h3>
                <p className="text-sm text-zinc-400">What you overpay for security theater</p>
              </div>
            </div>

            {/* Pricing grid — two layouts depending on whether enterprise price is published */}
            {!analysis.hasCustomEnterprisePricing ? (
              /* Known enterprise pricing */
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                <div className="bg-zinc-950/50 rounded-lg p-4 border border-zinc-800">
                  <div className="text-xs text-zinc-400 mb-1">Enterprise Plan (per user)</div>
                  <div className="text-2xl font-bold text-zinc-100">
                    {fmt(analysis.pricePerUser!)}
                  </div>
                </div>
                <div className="bg-zinc-950/50 rounded-lg p-4 border border-zinc-800">
                  <div className="text-xs text-zinc-400 mb-1">Your Monthly Bill</div>
                  <div className="text-2xl font-bold text-red-400">
                    {fmt(analysis.totalMonthly!)}
                  </div>
                </div>
                <div className="bg-zinc-950/50 rounded-lg p-4 border border-emerald-400/20">
                  <div className="text-xs text-zinc-400 mb-1">Avoidable Overpayment</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {analysis.avoidableOverpayment !== null
                      ? `${fmt(analysis.avoidableOverpayment)}/mo`
                      : '—'}
                  </div>
                  {analysis.proPlanName && (
                    <div className="text-xs text-zinc-500 mt-1">
                      vs. {analysis.proPlanName} tier
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Custom / unpublished enterprise pricing */
              <div className="mb-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-4">
                  <div className="bg-zinc-950/50 rounded-lg p-4 border border-zinc-800">
                    <div className="text-xs text-zinc-400 mb-1">Highest Published Tier</div>
                    <div className="text-lg font-bold text-zinc-100">
                      {analysis.proPlanName ?? 'Pro'}
                    </div>
                    {analysis.proPricePerUser !== null && (
                      <div className="text-sm text-zinc-400 mt-0.5">
                        {fmt(analysis.proPricePerUser)}/user
                      </div>
                    )}
                  </div>
                  <div className="bg-zinc-950/50 rounded-lg p-4 border border-zinc-800">
                    <div className="text-xs text-zinc-400 mb-1">Baseline Monthly Cost</div>
                    <div className="text-2xl font-bold text-red-400">
                      {analysis.proBaselineCost !== null
                        ? `${fmt(analysis.proBaselineCost)}/mo`
                        : '—'}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">minimum floor estimate</div>
                  </div>
                  <div className="bg-zinc-950/50 rounded-lg p-4 border border-amber-400/20">
                    <div className="text-xs text-zinc-400 mb-1">Enterprise Premium</div>
                    <div className="text-xl font-bold text-amber-400">Custom pricing</div>
                    <div className="text-xs text-zinc-500 mt-1">will exceed baseline above</div>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-zinc-300">
                  <span className="font-medium text-amber-400">Custom enterprise pricing: </span>
                  {product?.name} does not publish per-seat enterprise pricing. Your actual bill
                  will exceed the {analysis.proPlanName ?? 'Pro'} baseline shown above. When you
                  request a quote, negotiate SAML SSO and audit logs into the contract before
                  signing — vendors frequently include these features at lower tiers for annual
                  commitments.
                </div>
              </div>
            )}

            {analysis.premiumFeatures.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Feature Cost Breakdown
                </div>
                {analysis.premiumFeatures.map((pf, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0"
                  >
                    <span className="text-zinc-300 text-sm">{pf.name}</span>
                    <span className="text-red-400 font-mono text-sm">+{fmt(pf.price)}/mo</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-zinc-100 font-medium">Total Premium Feature Tax</span>
                  <span className="text-red-400 font-bold font-mono">
                    {fmt(analysis.premiumFeatures.reduce((a, b) => a + b.price, 0))}/mo
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Reducing Your Enterprise Tax */}
          <div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-1 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              How to Reduce Your Enterprise Tax
            </h3>
            <p className="text-zinc-400 text-sm mb-6">
              The enterprise tier exists because vendors can charge a premium for security features
              that matter most to IT and compliance teams. Here are the levers that actually work.
            </p>

            {/* Levers for third-party SaaS — always shown */}
            <div className="card-blur rounded-xl p-6 mb-4 border border-zinc-800">
              <h4 className="text-sm font-semibold text-zinc-200 mb-3 uppercase tracking-wider">
                For this SaaS ({product?.name})
              </h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-zinc-300">
                  <ArrowRight className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium text-zinc-100">Negotiate SSO into a lower tier.</span>{' '}
                    Many vendors will include SAML SSO on a Business or Growth plan if you commit
                    annually. Ask your account rep explicitly before signing.
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm text-zinc-300">
                  <ArrowRight className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium text-zinc-100">Use a competitor as leverage.</span>{' '}
                    Research SSO-friendly alternatives and mention them during renewal. Vendors
                    regularly match lower-tier SSO to retain accounts.
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm text-zinc-300">
                  <ArrowRight className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium text-zinc-100">Choose vendors that don't gate SSO.</span>{' '}
                    Some SaaS products include SAML on all paid tiers. Switching to one of them at
                    renewal eliminates the enterprise tax entirely for that tool.
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm text-zinc-300">
                  <ArrowRight className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium text-zinc-100">Request audit-log exports separately.</span>{' '}
                    Some vendors offer audit log webhooks or API access at lower tiers even when
                    the in-app UI is enterprise-only. Ask what's available over the API.
                  </span>
                </li>
              </ul>
            </div>

            {/* OSS alternatives — scoped to internal apps */}
            {analysis.openSourceAlternatives.length > 0 && (
              <div>
                <div className="card-blur rounded-xl p-4 border border-zinc-800 mb-4">
                  <h4 className="text-sm font-semibold text-zinc-200 mb-1 uppercase tracking-wider">
                    For apps you deploy internally
                  </h4>
                  <p className="text-xs text-zinc-400">
                    These open-source tools replace paid commercial products (Okta, Auth0, Datadog,
                    etc.) for infrastructure and software <em>you control</em>. They do not bypass
                    {' '}{product?.name}'s enterprise gate — that requires the vendor to enable SAML on
                    your account, which still requires their paid tier.
                  </p>
                </div>

                <div className="space-y-4">
                  {analysis.openSourceAlternatives.map((alt, idx) => (
                    <div
                      key={idx}
                      className="card-blur rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <a
                            href={alt.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-100 font-semibold hover:text-emerald-400 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none rounded"
                          >
                            {alt.name}
                          </a>
                          <span className="text-[10px] text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">
                            For your own apps: {alt.featureName}
                          </span>
                        </div>
                        <p className="text-zinc-400 text-sm">{alt.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              alt.setupComplexity === 'low'
                                ? 'bg-emerald-400/10 text-emerald-400'
                                : alt.setupComplexity === 'medium'
                                  ? 'bg-amber-400/10 text-amber-400'
                                  : 'bg-red-400/10 text-red-400'
                            }`}
                          >
                            Setup: {alt.setupComplexity}
                          </span>
                          <span className="text-xs text-zinc-500">
                            ROI: {fmt(alt.roiPerHour)}/hour saved per setup hour
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xl font-bold text-emerald-400">
                          {fmt(alt.savingsPerMonth)}/mo
                        </div>
                        <div className="text-xs text-zinc-400">vs. commercial equivalent</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* OSS savings total — clearly separate from SaaS overpayment */}
                <div className="mt-4 card-blur rounded-xl p-4 border border-emerald-400/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-zinc-300">Internal-apps OSS savings</span>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Estimated savings vs. commercial equivalents for infrastructure you control.
                        Separate from the {product?.name} enterprise-tier analysis above.
                      </p>
                    </div>
                    <span className="text-xl font-bold text-emerald-400 shrink-0 ml-4">
                      {fmt(analysis.ossSavings)}/mo
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Headline savings figure — avoidable enterprise overpayment only */}
          {analysis.avoidableOverpayment !== null && (
            <div className="card-blur rounded-xl p-8 border border-emerald-400/20 bg-emerald-400/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-zinc-100 mb-1">
                    Avoidable Enterprise Overpayment
                  </h3>
                  <p className="text-zinc-400 text-sm">
                    Potential saving by negotiating down from {product?.name}{' '}
                    {enterprisePlan?.name} for {userCount} users — based on published per-seat
                    pricing for both tiers.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-3xl sm:text-4xl font-bold text-emerald-400">
                    {fmt(analysis.avoidableOverpayment * 12)}/yr
                  </div>
                  <div className="text-sm text-zinc-400 mt-1">
                    ({fmt(analysis.avoidableOverpayment)}/mo)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Custom pricing CTA — shown instead of headline when enterprise price is unpublished */}
          {analysis.hasCustomEnterprisePricing && analysis.proBaselineCost !== null && (
            <div className="card-blur rounded-xl p-8 border border-amber-400/20 bg-amber-400/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-zinc-100 mb-1">
                    Baseline Annual Cost (floor estimate)
                  </h3>
                  <p className="text-zinc-400 text-sm">
                    At {product?.name}'s highest published tier ({analysis.proPlanName}) for{' '}
                    {userCount} users. Your enterprise quote will be higher — use this figure as
                    your negotiation floor.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-3xl sm:text-4xl font-bold text-amber-400">
                    {fmt(analysis.proBaselineCost * 12)}/yr
                  </div>
                  <div className="text-sm text-zinc-400 mt-1">minimum baseline</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!product && (
        <div className="card-blur rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
            <Calculator className="w-8 h-8 text-zinc-600" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-300 mb-2">
            Select a SaaS with Enterprise tiers
          </h3>
          <p className="text-zinc-500 text-sm max-w-md mx-auto">
            We will analyze the exact premium you pay for SAML, Audit Logs, and other security
            features locked behind expensive enterprise plans.
          </p>
        </div>
      )}
    </div>
  );
}
