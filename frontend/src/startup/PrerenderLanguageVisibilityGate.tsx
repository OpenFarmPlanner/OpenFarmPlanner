import { useLayoutEffect, type ReactNode } from 'react';

interface PrerenderLanguageVisibilityGateProps {
  children: ReactNode;
}

export default function PrerenderLanguageVisibilityGate({ children }: PrerenderLanguageVisibilityGateProps) {
  useLayoutEffect(() => {
    document.documentElement.classList.remove('ofp-hide-prerender');
  }, []);

  return children;
}
