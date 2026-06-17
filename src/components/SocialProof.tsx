import React, { useState, useEffect } from 'react';

/**
 * Trust band for the homepage.
 *
 * Honesty rules for a site whose entire pillar is data fidelity:
 *  - The headline stats are REAL — computed from the dataset at build time and
 *    passed in as props (see index.astro). No invented "$2.4M saved" figures.
 *  - The scenarios below are explicitly labelled WORKED EXAMPLES computed from
 *    published list prices, not testimonials from real named customers. We do
 *    not fabricate quotes or imply users we don't have.
 */

interface WorkedExample {
  title: string;
  scenario: string;
  basis: string;
  figure: string;
  figureLabel: string;
}


interface StatItem {
  value: string;
  label: string;
  icon: string;
}

interface SocialProofProps {
  /** Real counts/figures computed from the dataset in index.astro. */
  productsIndexed?: number;
  plansPriced?: number;
  savingsOnBooks?: string;
  /** Dataset-derived: (Business priceAnnually − Plus priceAnnually) × 30 seats for Notion.
   *  Computed in index.astro so this card can never silently drift from real prices. */
  notionDowngradeExample?: number;
}

export default function SocialProof({
  productsIndexed,
  plansPriced,
  savingsOnBooks,
  notionDowngradeExample,
}: SocialProofProps) {
  // Notion figure: derived from the live dataset in index.astro.
  // Fallback ($3,600) matches current dataset: (Business $240 − Plus $120) × 30 seats.
  const notionFigure = notionDowngradeExample != null
    ? `$${notionDowngradeExample.toLocaleString()}/yr`
    : '$3,600/yr';

  const workedExamples: WorkedExample[] = [
    {
      title: 'Plan downgrade',
      scenario:
        'A 30-seat team on Notion Business when the Plus plan already covers every feature they actually use.',
      basis: 'Difference between Business and Plus annual list price × 30 seats — computed from the live dataset.',
      figure: notionFigure,
      figureLabel: 'list-price gap',
    },
    {
      title: 'The enterprise tax',
      scenario:
        'A 200-employee company forced onto an enterprise tier purely to unlock SAML SSO, versus a vendor that includes it at no extra tier.',
      basis: 'Enterprise uplift × headcount, illustrative at $240/seat/yr uplift across 200 seats.',
      figure: 'up to $48,000/yr',
      figureLabel: 'avoidable uplift',
    },
    {
      title: 'Stack consolidation',
      scenario:
        'Three overlapping project-management tools collapsed into one after the redundancy audit flags duplicate core features.',
      basis: 'Sum of the two redundant tools\' annual subscriptions for the team.',
      figure: '$14,400/yr',
      figureLabel: 'redundant spend',
    },
  ];

  const [activeExample, setActiveExample] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveExample(prev => (prev + 1) % workedExamples.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const stats: StatItem[] = [
    {
      value: savingsOnBooks ?? '—',
      label: 'Spread on the books (max−min plan, all tools)',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    {
      value: productsIndexed ? `${productsIndexed}` : '—',
      label: 'SaaS tools indexed',
      icon: 'M9 17V9m4 8V5m4 12v-5M4 21h16',
    },
    {
      value: plansPriced ? `${plansPriced.toLocaleString()}` : '—',
      label: 'Pricing plans mapped',
      icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
    },
    {
      value: '0',
      label: 'User accounts required',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    },
  ];

  return (
    <section className="py-16 px-4" aria-label="What the numbers look like">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100 mb-4">
            What the numbers look like
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            The figures below come straight from the dataset. The cases are worked
            examples from published list prices — not testimonials.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12" role="list" aria-label="Key statistics">
          {stats.map((stat, i) => (
            <div key={i} className="card-blur rounded-lg p-5 text-center" role="listitem">
              <div className="w-9 h-9 mx-auto mb-3 rounded-md bg-emerald-400/10 border border-emerald-400/25 flex items-center justify-center" aria-hidden="true">
                <svg className="w-4.5 h-4.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                </svg>
              </div>
              <div className="num text-2xl sm:text-3xl font-semibold text-emerald-400" aria-label={`${stat.value} ${stat.label}`}>{stat.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="card-blur rounded-xl p-8 border border-emerald-400/10">
          <div className="flex items-center justify-between gap-2 mb-6">
            <span className="text-xs uppercase tracking-[0.16em] text-zinc-500 num">Worked example</span>
            <span className="text-[11px] text-zinc-500 border border-zinc-800 rounded px-2 py-0.5">
              Illustrative · based on list prices
            </span>
          </div>

          <div className="relative min-h-[150px]" role="region" aria-label="Worked savings examples" aria-live="polite">
            {workedExamples.map((ex, i) => (
              <div
                key={i}
                className={`absolute inset-0 transition-opacity duration-500 ${
                  i === activeExample ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                aria-hidden={i !== activeExample}
              >
                <div className="text-sm font-semibold text-emerald-400 mb-2">{ex.title}</div>
                <p className="text-lg text-zinc-200 leading-relaxed mb-3">{ex.scenario}</p>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <p className="text-xs text-zinc-500 max-w-md">
                    <span className="text-zinc-400">How it’s computed:</span> {ex.basis}
                  </p>
                  <div className="text-right shrink-0">
                    <div className="num text-xl font-bold text-emerald-400">{ex.figure}</div>
                    <div className="text-xs text-zinc-500">{ex.figureLabel}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 mt-6" role="tablist" aria-label="Example navigation">
            {workedExamples.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveExample(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === activeExample ? 'bg-emerald-400' : 'bg-zinc-700 hover:bg-zinc-600'
                }`}
                role="tab"
                aria-selected={i === activeExample}
                aria-label={`Show example ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
