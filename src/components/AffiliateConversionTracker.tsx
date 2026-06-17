import React, { useState, useEffect } from 'react';

interface AffiliateClick {
  productId: string;
  timestamp: number;
  url: string;
}

const STORAGE_KEY = 'stackcut-affiliate-clicks';
const CONVERSION_WINDOW_DAYS = 30;

export default function AffiliateConversionTracker() {
  const [showBanner, setShowBanner] = useState(false);
  const [recentClick, setRecentClick] = useState<AffiliateClick | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const clicks: AffiliateClick[] = JSON.parse(stored);
      const now = Date.now();
      const conversionWindow = CONVERSION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

      const recentClicks = clicks.filter(click => now - click.timestamp < conversionWindow);

      if (recentClicks.length > 0) {
        const latestClick = recentClicks[recentClicks.length - 1];
        const hoursSinceClick = (now - latestClick.timestamp) / (1000 * 60 * 60);

        if (hoursSinceClick > 1) {
          setRecentClick(latestClick);
          setShowBanner(true);
        }
      }

      if (recentClicks.length !== clicks.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recentClicks));
      }
    } catch {}
  }, []);

  const trackConversion = (converted: boolean) => {
    if (recentClick && typeof window !== 'undefined' && (window as any).plausible) {
      (window as any).plausible('Affiliate Conversion', {
        props: {
          product: recentClick.productId,
          converted: converted ? 'yes' : 'no',
        },
      });
    }

    if (recentClick) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const clicks: AffiliateClick[] = JSON.parse(stored);
          const filtered = clicks.filter(c => c.timestamp !== recentClick.timestamp);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        }
      } catch {}
    }

    setShowBanner(false);
  };

  if (!showBanner || !recentClick) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-40">
      <div className="card-blur rounded-xl p-4 border border-zinc-800 shadow-2xl">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="text-sm font-medium text-zinc-100">Quick question</h4>
            <p className="text-xs text-zinc-500 mt-1">
              Did you sign up for {recentClick.productId} after visiting our site?
            </p>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors ml-2"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => trackConversion(true)}
            className="flex-1 btn-primary text-xs py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            Yes, I signed up
          </button>
          <button
            onClick={() => trackConversion(false)}
            className="flex-1 btn-secondary text-xs py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            Not yet
          </button>
        </div>

        <p className="text-xs text-zinc-600 text-center mt-3">
          This helps us recommend better alternatives. No tracking, just feedback.
        </p>
      </div>
    </div>
  );
}