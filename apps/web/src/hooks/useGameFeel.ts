'use client';

import { useCallback } from 'react';
import { gameFeel, FlashType } from '@/lib/gameFeel';

/**
 * Hook to trigger sensory juice and kinetic feedback:
 * - shake: Trauma-based screen shake (shake = trauma^2)
 * - flash: Edge/screen flash overlay
 * - haptic: Device vibration
 * - celebrate: Confetti burst
 */
export function useGameFeel() {
  const shake = useCallback((trauma?: number) => {
    gameFeel.shake(trauma);
  }, []);

  const flash = useCallback((type?: FlashType, durationMs?: number) => {
    gameFeel.flash(type, durationMs);
  }, []);

  const haptic = useCallback((pattern?: number | number[]) => {
    gameFeel.haptic(pattern);
  }, []);

  const celebrate = useCallback((options?: { particleCount?: number; spread?: number }) => {
    void gameFeel.celebrate(options);
  }, []);

  return { shake, flash, haptic, celebrate };
}
