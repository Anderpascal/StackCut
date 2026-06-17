import React, { useState, useEffect, useCallback } from 'react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISMISS_KEY = 'stackcut-popup-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000;

type FormState = 'idle' | 'loading' | 'success' | 'error';

export default function ExitIntentPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [hasTriggered, setHasTriggered] = useState(false);
  // Honeypot: hidden field that only bots fill (see api/subscribe.js).
  const [companyWebsite, setCompanyWebsite] = useState('');

  const isDismissed = useCallback(() => {
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (!dismissed) return false;
      const timestamp = parseInt(dismissed, 10);
      return Date.now() - timestamp < DISMISS_DURATION;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (isDismissed() || hasTriggered) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !hasTriggered) {
        setIsVisible(true);
        setHasTriggered(true);
        if (typeof window !== 'undefined' && (window as any).plausible) {
          (window as any).plausible('Exit Intent Popup Shown');
        }
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
    }, 5000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [hasTriggered, isDismissed]);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {}
    if (typeof window !== 'undefined' && (window as any).plausible) {
      (window as any).plausible('Exit Intent Popup Dismissed');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');

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
        body: JSON.stringify({ email, company_website: companyWebsite, source: 'exit_intent' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Subscription failed');
      }

      if (typeof window !== 'undefined' && (window as any).plausible) {
        (window as any).plausible('Exit Intent Subscribe', { props: { status: 'success' } });
      }

      setState('success');
      setEmail('');
      setTimeout(handleDismiss, 3000);
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Newsletter signup"
    >
      <div
        className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none rounded"
          aria-label="Close popup"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {state === 'success' ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-zinc-100 mb-2">You are in!</h3>
            <p className="text-zinc-400 text-sm">Check your inbox for your first SaaS savings report.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-zinc-100 mb-2">Wait — you are leaving money on the table</h3>
              <p className="text-zinc-400 text-sm">
                Get our free weekly report with the latest downgrade paths, pricing changes, and negotiation tactics.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Honeypot — hidden from humans, catches form-filling bots */}
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
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (state === 'error') setState('idle');
                }}
                placeholder="you@company.com"
                required
                className={`w-full bg-zinc-900 border ${
                  state === 'error' ? 'border-red-400' : 'border-zinc-800'
                } rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all`}
                aria-label="Email address for newsletter"
                disabled={state === 'loading'}
              />
              <button
                type="submit"
                disabled={state === 'loading'}
                className="w-full btn-primary text-sm py-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-60"
              >
                {state === 'loading' ? 'Subscribing...' : 'Send Me Free Reports'}
              </button>
            </form>

            {state === 'error' && errorMsg && (
              <p className="text-red-400 text-xs mt-2 text-center">{errorMsg}</p>
            )}

            <p className="text-zinc-600 text-xs text-center mt-4">
              No spam. Unsubscribe anytime. We respect your inbox.
            </p>
          </>
        )}
      </div>
    </div>
  );
}