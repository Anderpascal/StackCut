import React, { useState } from 'react';

interface AffiliateLinkProps {
  href: string;
  productId: string;
  planId?: string;
  campaign?: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'button' | 'text' | 'card';
}

export default function AffiliateLink({ 
  href, productId, planId, campaign = 'downgrade', 
  children, className = '', variant = 'button' 
}: AffiliateLinkProps) {
  const buildUrl = () => {
    try {
      const url = new URL(href);
      url.searchParams.set('utm_source', 'stackcut');
      url.searchParams.set('utm_medium', 'referral');
      url.searchParams.set('utm_campaign', campaign);
      url.searchParams.set('utm_content', planId ? `${productId}_${planId}` : productId);
      return url.toString();
    } catch {
      return href;
    }
  };

  const handleClick = () => {
    if (typeof window !== 'undefined' && (window as any).plausible) {
      (window as any).plausible('Affiliate Click', { 
        props: { product: productId, plan: planId || 'unknown' } 
      });
    }

    try {
      const STORAGE_KEY = 'stackcut-affiliate-clicks';
      const stored = localStorage.getItem(STORAGE_KEY);
      const clicks = stored ? JSON.parse(stored) : [];
      clicks.push({
        productId,
        timestamp: Date.now(),
        url: href,
      });
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentClicks = clicks.filter((c: any) => c.timestamp > thirtyDaysAgo);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentClicks));
    } catch {}
  };

  const baseClasses = {
    button: 'btn-primary text-sm py-2 px-5 no-print focus:ring-2 focus:ring-emerald-500 focus:outline-none',
    text: 'text-emerald-400 hover:underline transition-colors inline-flex items-center gap-1 focus:ring-2 focus:ring-emerald-500 focus:outline-none',
    card: 'inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-emerald-400 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none'
  };

  return (
    <a href={buildUrl()} target="_blank" rel="noopener noreferrer sponsored"
       data-affiliate-click={productId}
       className={`${baseClasses[variant]} ${className}`}
       onClick={handleClick}
    >
      {children}
    </a>
  );
}
