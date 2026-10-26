'use client';

/**
 * Global Audio Manager for KZ Game Hub.
 *
 * Implements a singleton Web Audio API bus architecture (Master -> SFX) with:
 * - Lazy initialization on first user interaction (auto-unlock on click/tap/keydown)
 * - Safe gain control and persisted mute state in localStorage ('kzGameSoundsEnabled')
 * - SFX pitch randomization (pitch wobble) to prevent the "machine-gun effect"
 * - Lightweight procedural sound synthesis (0 external asset dependencies)
 */

const STORAGE_KEY = 'kzGameSoundsEnabled';
const VOLUME_KEY = 'kzGameSoundsVolume';

export interface AudioSettings {
  enabled: boolean;
  volume: number;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private enabled: boolean = true;
  private volume: number = 0.5;
  private isUnlocked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedEnabled = window.localStorage.getItem(STORAGE_KEY);
      if (savedEnabled !== null) {
        this.enabled = savedEnabled === '1';
      }
      const savedVol = window.localStorage.getItem(VOLUME_KEY);
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.volume = parsed;
        }
      }
      this.attachUnlockListeners();
    }
  }

  private attachUnlockListeners(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.initContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      this.isUnlocked = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;

      this.ctx = new AudioContextClass();

      // Master bus (perceptual logarithmic/quadratic gain curve per audio-design Pattern 1)
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.enabled ? this.volume * this.volume : 0,
        this.ctx.currentTime,
      );
      this.masterGain.connect(this.ctx.destination);

      // SFX bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      return this.ctx;
    } catch {
      return null;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
      window.dispatchEvent(
        new CustomEvent('kz-sound-settings-change', {
          detail: { enabled, volume: this.volume },
        }),
      );
    }
    this.updateGains();
  }

  public getVolume(): number {
    return this.volume;
  }

  public getAudioContext(): AudioContext | null {
    return this.initContext();
  }

  public getSfxDestination(): GainNode | null {
    this.initContext();
    return this.sfxGain;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VOLUME_KEY, String(this.volume));
      window.dispatchEvent(
        new CustomEvent('kz-sound-settings-change', {
          detail: { enabled: this.enabled, volume: this.volume },
        }),
      );
    }
    this.updateGains();
  }

  private updateGains(): void {
    if (!this.ctx || !this.masterGain) return;
    // Map linear 0..1 slider through a perceptual quadratic curve (audio-design Pattern 1)
    const targetGain = this.enabled ? this.volume * this.volume : 0;
    try {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    } catch {
      // safe fallback
    }
  }

  /**
   * Generates a slight random pitch variation factor around 1.0 (0.95 to 1.05)
   * to eliminate repetitive robotic playback ("machine-gun effect").
   */
  private getPitchJitter(): number {
    return 0.95 + Math.random() * 0.1;
  }

  /**
   * Safe helper to execute an audio node graph on the SFX bus.
   */
  private runSfx(builder: (ctx: AudioContext, destination: GainNode, now: number) => void): void {
    if (!this.enabled || typeof window === 'undefined') return;
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    try {
      builder(ctx, this.sfxGain, ctx.currentTime);
    } catch {
      // Non-fatal if audio graph construction fails
    }
  }

  // ── Procedural Sound Synthesizers ──────────────────────────────────

  /**
   * Card snap / deal: short filtered click with pitch wobble.
   */
  public playCardSnap(): void {
    const jitter = this.getPitchJitter();
    this.runSfx((ctx, dest, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(80 * jitter, now + 0.05);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.06);
    });
  }

  /**
   * Chip clink: high dual metallic ping for bets/coins.
   */
  public playChipClink(): void {
    const jitter = this.getPitchJitter();
    this.runSfx((ctx, dest, now) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2400 * jitter, now);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(3200 * jitter, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(dest);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.1);
      osc2.stop(now + 0.1);
    });
  }

  /**
   * Tic-Tac-Toe / Board Game mark placement: crisp wooden/bubble pop.
   */
  public playPlaceMark(side: 'X' | 'O' = 'X'): void {
    const baseFreq = side === 'X' ? 440 : 520;
    const jitter = this.getPitchJitter();
    this.runSfx((ctx, dest, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.09);
    });
  }

  /**
   * Who First / Reflex buzzer: high clear 880Hz alert.
   */
  public playBuzzer(): void {
    this.runSfx((ctx, dest, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.25);
    });
  }

  /**
   * Ready prompt: 440Hz short beep.
   */
  public playReady(): void {
    this.runSfx((ctx, dest, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.15);
    });
  }

  /**
   * Foul / Penalty: low descending buzz (220Hz -> 110Hz).
   */
  public playFoul(): void {
    this.runSfx((ctx, dest, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.3);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  /**
   * Victory / Success: ascending joyful arpeggio (C5 -> E5 -> G5 -> C6).
   */
  public playSuccessChime(): void {
    this.runSfx((ctx, dest, now) => {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const time = now + idx * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(time);
        osc.stop(time + 0.26);
      });
    });
  }

  /**
   * Error / Mistake buzz: discordant low harmonic chord.
   */
  public playErrorBuzz(): void {
    this.runSfx((ctx, dest, now) => {
      const freqs = [150, 158]; // slight dissonance
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.3);
      });
    });
  }

  /**
   * RPS Clash: explosive white-noise burst.
   */
  public playClash(): void {
    this.runSfx((ctx, dest, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.16);
    });
  }

  /**
   * Sounds Fishy reveal splash: filtered bubble burst.
   */
  public playSplash(): void {
    const jitter = this.getPitchJitter();
    this.runSfx((ctx, dest, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(600 * jitter, now + 0.08);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.13);
    });
  }

  /**
   * Saboteur Rockfall: cavern rumble and crumbling stone burst.
   */
  public playRockCrumble(): void {
    const jitter = this.getPitchJitter();
    this.runSfx((ctx, dest, now) => {
      // Low rumble
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.35);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.36);

      // Crackle impact
      const snap = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snap.type = 'square';
      snap.frequency.setValueAtTime(180 * jitter, now);
      snap.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      snapGain.gain.setValueAtTime(0.2, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      snap.connect(snapGain);
      snapGain.connect(dest);
      snap.start(now);
      snap.stop(now + 0.13);
    });
  }

  /**
   * Gobbler Piece Gobble: suction/gulp downward sweep.
   */
  public playGobble(): void {
    const jitter = this.getPitchJitter();
    this.runSfx((ctx, dest, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(95 * jitter, now + 0.18);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.19);
    });
  }

  /**
   * Cipher Grid Assassin: dramatic sudden-death dissonance and low boom.
   */
  public playAssassin(): void {
    this.runSfx((ctx, dest, now) => {
      // Low ominous thud
      const boom = ctx.createOscillator();
      const boomGain = ctx.createGain();
      boom.type = 'sine';
      boom.frequency.setValueAtTime(75, now);
      boom.frequency.exponentialRampToValueAtTime(25, now + 0.45);

      boomGain.gain.setValueAtTime(0.4, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      boom.connect(boomGain);
      boomGain.connect(dest);
      boom.start(now);
      boom.stop(now + 0.46);

      // Dissonant minor-second screech
      const sting1 = ctx.createOscillator();
      const sting2 = ctx.createOscillator();
      const stingGain = ctx.createGain();

      sting1.type = 'sawtooth';
      sting2.type = 'sawtooth';
      sting1.frequency.setValueAtTime(780, now);
      sting2.frequency.setValueAtTime(825, now);

      stingGain.gain.setValueAtTime(0.18, now);
      stingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      sting1.connect(stingGain);
      sting2.connect(stingGain);
      stingGain.connect(dest);

      sting1.start(now);
      sting2.start(now);
      sting1.stop(now + 0.4);
      sting2.stop(now + 0.4);
    });
  }

  /**
   * Buzzer Press: snappy tactile mechanical trigger for Who First & Music Trivia.
   */
  public playBuzzerPress(): void {
    const jitter = this.getPitchJitter();
    this.runSfx((ctx, dest, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220 * jitter, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.09);
    });
  }

  /**
   * Ultimate Tic-Tac-Toe: Sub-board conquest mini-fanfare (C5 -> E5 -> G5).
   */
  public playSubBoardWin(): void {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      this.runSfx((ctx, dest, now) => {
        const start = now + idx * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + 0.23);
      });
    });
  }

  /**
   * Banana Thief: stealth clock tick for masked room ambience.
   */
  public playStealthTick(): void {
    this.runSfx((ctx, dest, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);

      gain.gain.setValueAtTime(0.015, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 0.06);
    });
  }
}

export const audioManager = new AudioManager();
