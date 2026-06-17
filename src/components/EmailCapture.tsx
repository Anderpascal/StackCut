import React, { useState } from 'react';

interface EmailCaptureProps {
  variant?: 'footer' | 'inline' | 'sidebar';
  headline?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormState = 'idle' | 'loading' | 'success' | 'error';

export default function EmailCapture({ variant = 'inline', headline }: EmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  // Honeypot: a hidden field real users never fill. Bots that auto-fill forms
  // populate it; the server treats any non-empty value as spam.
  const [companyWebsite, setCompanyWebsite] = useState('');

  const defaultHeadlines: Record<string, string> = {
    footer: 'Get weekly SaaS savings tips',
    inline: 'Never overpay for SaaS again',
    sidebar: 'SaaS savings in your inbox',
  };

  const displayHeadline = headline || defaultHeadlines[variant] || defaultHeadlines.inline;

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
        body: JSON.stringify({ email, company_website: companyWebsite, source: `email_capture_${variant}` }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Subscription failed');
      }

      if (typeof window !== 'undefined' && (window as any).plausible) {
        (window as any).plausible('Newsletter Subscribe', { props: { status: 'success' } });
      }

      setState('success');
      setEmail('');
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const variantStyles: Record<string, string> = {
    footer: 'flex-col sm:flex-row gap-3',
    inline: 'flex-col sm:flex-row gap-3',
    sidebar: 'flex-col gap-3',
  };

  const inputStyles: Record<string, string> = {
    footer: 'flex-1',
    inline: 'flex-1',
    sidebar: 'w-full',
  };

  return (
    <div className={variant === 'sidebar' ? '' : 'max-w-md'}>
      {state === 'success' ? (
        <div className="rounded-lg p-4 border border-emerald-400/20 bg-emerald-400/5 text-center">
          <p className="text-emerald-400 text-sm font-medium">
            Subscribed! Check your inbox for a confirmation email.
          </p>
        </div>
      ) : (
        <>
          {displayHeadline && (
            <p className={`text-sm font-medium text-zinc-300 mb-3 ${variant === 'sidebar' ? 'text-xs' : ''}`}>
              {displayHeadline}
            </p>
          )}
          <form
            onSubmit={handleSubmit}
            className={`flex ${variantStyles[variant] || variantStyles.inline}`}
            data-plausible-event="Newsletter Subscribe"
          >
            {/* Honeypot — visually hidden, off the tab order, ignored by humans */}
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
              className={`${inputStyles[variant] || inputStyles.inline} bg-zinc-950 border ${
                state === 'error' ? 'border-red-400' : 'border-zinc-800'
              } rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500 transition-all`}
              aria-label="Email address for newsletter"
              disabled={state === 'loading'}
            />
            <button
              type="submit"
              disabled={state === 'loading'}
              className="btn-primary text-sm py-2.5 px-5 shrink-0 focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-60"
            >
              {state === 'loading' ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
          {state === 'error' && errorMsg && (
            <p className="text-red-400 text-xs mt-2">{errorMsg}</p>
          )}
        </>
      )}
    </div>
  );
}
