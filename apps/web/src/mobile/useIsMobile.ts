import { useEffect, useState } from 'react';

export function useIsMobile(breakpointPx: number = 820) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);

    setIsMobile(mql.matches);
    // Safari support
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    // eslint-disable-next-line deprecation/deprecation
    mql.addListener(handler);
    // eslint-disable-next-line deprecation/deprecation
    return () => mql.removeListener(handler);
  }, [breakpointPx]);

  return isMobile;
}

