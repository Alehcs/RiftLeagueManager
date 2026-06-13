'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store/store';

// Initializes the store (seed/load + realtime) once on the client.
export function StoreInitializer() {
  useEffect(() => {
    useStore.getState().init();
  }, []);
  return null;
}
