import { useEffect } from 'react';

interface AdBannerProps {
  slot?: 'header' | 'sidebar' | 'inline' | 'footer';
  keywords?: string;
}

export default function AdBanner({ slot = 'inline', keywords }: AdBannerProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      const container = document.querySelector('.ea-container');
      if (container && container.children.length === 0) {
        container.innerHTML = '<div style="padding:1rem;text-align:center;color:#666;font-family:monospace">Support our research by whitelisting this site. We use EthicalAds — no tracking, no personal data.</div>';
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="ea-container w-full my-8"
      data-ea-publisher="stackcut"
      data-ea-type="image"
      data-ea-keywords={keywords || 'saas,software,pricing'}
    >
      <noscript>
        <div className="text-center text-zinc-500 text-sm p-4">
          Support our research by viewing ethical ads.
        </div>
      </noscript>
    </div>
  );
}
