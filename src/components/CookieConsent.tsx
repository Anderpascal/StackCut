import React, { useState, useEffect } from 'react';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('cookie-consent-dismissed');
    if (!dismissed) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-zinc-400 text-sm">
          We use EthicalAds (privacy-first, no cookies) and affiliate links.
          <a href="/privacy" className="text-emerald-400 hover:underline ml-1">Learn more</a>
        </p>
        <button onClick={() => { localStorage.setItem('cookie-consent-dismissed', '1'); setVisible(false); }}
                className="btn-primary text-sm px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
          Got it
        </button>
      </div>
    </div>
  );
}
