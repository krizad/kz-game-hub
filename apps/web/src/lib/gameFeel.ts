/**
 * Unified Game Feel & Kinetic Juice System for KZ Game Hub
 * Provides trauma-based screen shake (shake = trauma^2), impact flashes,
 * device haptics, and celebration confetti.
 */

export type FlashType = 'red' | 'white' | 'gold' | 'green';

export interface ShakeEventDetail {
  trauma: number;
}

export interface FlashEventDetail {
  type: FlashType;
  durationMs: number;
}

class GameFeelManager {
  private reducedMotion = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = mediaQuery.matches;
      mediaQuery.addEventListener?.('change', (e) => {
        this.reducedMotion = e.matches;
      });
    }
  }

  isReducedMotion(): boolean {
    return this.reducedMotion;
  }

  /**
   * Trauma-based screen shake.
   * Shake intensity decays quadratically (shake = trauma^2) as recommended
   * by game feel standards.
   * @param trauma Value between 0.1 and 1.0.
   */
  shake(trauma = 0.5): void {
    if (this.reducedMotion || typeof window === 'undefined') return;
    const clamped = Math.max(0.05, Math.min(1.0, trauma));
    window.dispatchEvent(
      new CustomEvent<ShakeEventDetail>('kz-game-shake', {
        detail: { trauma: clamped },
      }),
    );
  }

  /**
   * Screen border impact flash.
   * @param type 'red' (damage/eliminated), 'white' (hit/action), 'gold' (victory/jackpot), 'green' (success)
   * @param durationMs Flash display duration before fadeout
   */
  flash(type: FlashType = 'white', durationMs = 350): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent<FlashEventDetail>('kz-game-flash', {
        detail: { type, durationMs },
      }),
    );
  }

  /**
   * Mobile haptic feedback via navigator.vibrate.
   * Safely no-ops on desktop or devices without vibration hardware.
   */
  haptic(pattern: number | number[] = 50): void {
    if (this.reducedMotion || typeof window === 'undefined') return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Safe ignore
    }
  }

  /**
   * Confetti celebration burst.
   */
  async celebrate(options?: { particleCount?: number; spread?: number }): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const { default: confetti } = await import('canvas-confetti');
      confetti({
        particleCount: options?.particleCount ?? 80,
        spread: options?.spread ?? 75,
        startVelocity: 35,
        origin: { y: 0.65 },
        disableForReducedMotion: true,
        zIndex: 9999,
      });
    } catch {
      // Safe ignore
    }
  }
}

export const gameFeel = new GameFeelManager();
