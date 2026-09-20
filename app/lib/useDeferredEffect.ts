'use client';
import { useEffect, useEffectEvent, type DependencyList, type EffectCallback } from 'react';

// Defer synchronization work (fetches/local storage) until after the committed frame.
// Cancellation prevents a queued callback from starting after unmount/dependency change.
export function useDeferredEffect(effect: EffectCallback, dependencies: DependencyList) {
  const run = useEffectEvent(effect);
  useEffect(() => {
    let cleanup: ReturnType<EffectCallback>;
    const timer = setTimeout(() => { cleanup = run(); }, 0);
    return () => { clearTimeout(timer); if (typeof cleanup === 'function') cleanup(); };
  }, dependencies);
}
