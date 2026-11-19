'use client';

interface SoundToggleProps {
  enabled: boolean;
  onToggle: () => void;
  titleOn: string;
  titleOff: string;
  testId: string;
  /** Size, shadow, and radius stay per-game; colors and behavior are shared. */
  className?: string;
  /** Show a compact volume slider next to the mute button (header-style use). */
  showVolume?: boolean;
  /** Current volume 0-1 (required when showVolume). */
  volume?: number;
  /** Volume change handler (required when showVolume). */
  onVolumeChange?: (volume: number) => void;
  /** Accessible label for the slider. */
  volumeLabel?: string;
}

/** Shared mute/unmute button for game sound effects. */
export function SoundToggle({
  enabled,
  onToggle,
  titleOn,
  titleOff,
  testId,
  className = '',
  showVolume = false,
  volume = 0.5,
  onVolumeChange,
  volumeLabel,
}: SoundToggleProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onToggle}
        title={enabled ? titleOn : titleOff}
        aria-label={enabled ? titleOn : titleOff}
        className={`flex items-center justify-center border-4 border-black text-sm transition-all active:translate-y-0.5 ${
          enabled ? 'bg-lime-300' : 'bg-gray-300 grayscale'
        } ${className}`}
        data-testid={testId}
      >
        {enabled ? '🔊' : '🔇'}
      </button>
      {showVolume && enabled && onVolumeChange && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          aria-label={volumeLabel}
          title={volumeLabel}
          data-testid={`${testId}-volume`}
          className="w-14 sm:w-16 h-1.5 accent-black cursor-pointer"
        />
      )}
    </div>
  );
}
