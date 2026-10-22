'use client';

import { useCallback, useEffect, useState } from 'react';
import { audioManager } from '@/lib/audioManager';

/**
 * Global game sound-effect settings hook.
 * Synchronizes with audioManager and localStorage across all open components.
 */
export function useSoundSettings() {
  const [enabled, setEnabled] = useState<boolean>(() => audioManager.isEnabled());
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    setEnabled(audioManager.isEnabled());
    setLoaded(true);

    const onSettingsChange = (event: Event) => {
      const custom = event as CustomEvent<{ enabled: boolean }>;
      if (custom.detail && typeof custom.detail.enabled === 'boolean') {
        setEnabled(custom.detail.enabled);
      } else {
        setEnabled(audioManager.isEnabled());
      }
    };

    window.addEventListener('kz-sound-settings-change', onSettingsChange);
    return () => {
      window.removeEventListener('kz-sound-settings-change', onSettingsChange);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !audioManager.isEnabled();
    audioManager.setEnabled(next);
    setEnabled(next);
  }, []);

  return { enabled, toggle, loaded };
}
