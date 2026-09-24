'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Global game sound-effect settings persisted in localStorage.
 * useEffect plays are opt-out via the mute toggle.
 */
const STORAGE_KEY = 'kzGameSoundsEnabled';

export function useSoundSettings() {
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved !== null) setEnabled(saved === '1');
    setLoaded(true);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  return { enabled, toggle, loaded };
}
