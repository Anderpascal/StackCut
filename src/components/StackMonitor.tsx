import React, { useMemo, useState, useCallback } from 'react';
import { CATEGORY_ORDER } from '../lib/categories';
import { getFreshness } from '../lib/freshness';
import { Check, Search, Bell, X } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type FormState = 'idle' | 'loading' | 'success' | 'error';

/** The monitor only needs identity + freshness, not the full product record. */
export interface MonitorProduct {
  id: string;
  name: string;
  slug: string;
  category: string;
  lastVerified: string;
}

interface Props {
  products: MonitorProduct[];
}

/**
 * Stack Monitor — opt in to price-change alerts for a chosen set of tools.
 *
 * The user picks the tools they pay for; we hand the email + tool slugs to
 * /api/monitor, which tags the subscriber per tool in Buttondown. No account,
 * no dashboard to maintain, no per-user tracking — the tag set IS the watch
 * list, and the weekly refresh pipeline is what surfaces changes to alert on.
 */
export default function StackMonitor({ products }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState(''); // honeypot
  const [state, setState] = useState<FormState>('idle');
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return products;
    return products.filter(p => p.name.toLowerCase().includes(term));
  }, [products, search]);

  const grouped = useMemo(() => {
    const map: Record<string, MonitorProduct[]> = {};
    for (const p of filtered) {
      (map[p.category] ??= []).push(p);
    }
    return map;
  }, [filtered]);

  const toggle = useCallback((slug: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
    if (state === 'error') setState('idle');
  }, [state]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');

    if (selected.size === 0) {
      setState('error');
      setMessage('Pick at least one tool to monitor.');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setState('error');
      setMessage('Please enter a valid email address.');
      return;
    }

    setState('loading');
    try {
      const res = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          tools: [...selected],
          company_website: companyWebsite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');

      if (typeof window !== 'undefined' && (window as any).plausible) {
        (window as any).plausible('Stack Monitor Subscribe', { props: { tools: selected.size } });
      }
      setState('success');
      setMessage(data.message || 'You are now monitoring your stack.');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  if (state === 'success') {
    return (
      <div className="max-w-2xl mx-auto card-blur rounded-xl p-10 text-center border border-emerald-400/20">
        <div className="w-16 h-16 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mx-auto mb-4">
          <Bell className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-zinc-100 mb-2">{message}</h3>
        <p className="text-zinc-400 text-sm max-w-md mx-auto">
          Confirm the opt-in email and you’re set. We’ll alert you when the published price of a
          tool you watch changes — and only then. Unsubscribe any time.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card-blur rounded-xl p-6 sm:p-8">
        {/* Selected summary + search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="text-sm text-zinc-400">
            <span className="num font-semibold text-emerald-400">{selected.size}</span> tool{selected.size === 1 ? '' : 's'} selected
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter tools..."
              aria-label="Filter tools"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Selected chips */}
        {selected.size > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {[...selected].map(slug => {
              const p = products.find(pr => pr.slug === slug);
              return (
                <button
                  key={slug}
                  onClick={() => toggle(slug)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-400/10 border border-emerald-400/25 text-emerald-400 text-xs hover:bg-emerald-400/20 transition-colors"
                >
                  {p?.name ?? slug}
                  <X className="w-3 h-3" />
                </button>
              );
            })}
          </div>
        )}

        {/* Tool grid grouped by category */}
        <div className="space-y-6 max-h-[28rem] overflow-y-auto pr-1">
          {CATEGORY_ORDER.map(cat => {
            const catProducts = grouped[cat];
            if (!catProducts || catProducts.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">{cat}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {catProducts.map(p => {
                    const isSelected = selected.has(p.slug);
                    const f = getFreshness(p.lastVerified);
                    return (
                      <button
                        key={p.slug}
                        onClick={() => toggle(p.slug)}
                        aria-pressed={isSelected}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                          isSelected
                            ? 'border-emerald-400/40 bg-emerald-400/5'
                            : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'
                        }`}
                      >
                        <span
                          className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-emerald-400 border-emerald-400' : 'border-zinc-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-zinc-950" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-zinc-200 truncate">{p.name}</span>
                          <span className="block text-[11px] text-zinc-500 num">{f.label.toLowerCase()}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Email + submit */}
      <form onSubmit={handleSubmit} className="card-blur rounded-xl p-6 sm:p-8 mt-6">
        {/* Honeypot */}
        <input
          type="text"
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          value={companyWebsite}
          onChange={e => setCompanyWebsite(e.target.value)}
          className="absolute left-[-9999px] w-px h-px opacity-0"
          aria-hidden="true"
        />
        <label htmlFor="monitor-email" className="block text-sm font-medium text-zinc-300 mb-2">
          Where should we send price-change alerts?
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="monitor-email"
            type="email"
            required
            value={email}
            onChange={e => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
            placeholder="you@company.com"
            className={`flex-1 bg-zinc-950 border ${state === 'error' ? 'border-red-400' : 'border-zinc-800'} rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all`}
            disabled={state === 'loading'}
          />
          <button
            type="submit"
            disabled={state === 'loading'}
            className="btn-primary text-sm px-6 shrink-0 disabled:opacity-60"
          >
            {state === 'loading' ? 'Setting up...' : 'Monitor my stack'}
          </button>
        </div>
        {state === 'error' && message && (
          <p className="text-red-400 text-xs mt-2">{message}</p>
        )}
        <p className="text-zinc-600 text-xs mt-3">
          One email per real price change on the tools you pick — nothing else. No account, no card.
          Your selection is only used to tag what you want to hear about. Unsubscribe any time.
        </p>
      </form>
    </div>
  );
}
