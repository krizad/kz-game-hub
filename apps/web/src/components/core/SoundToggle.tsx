'use client';

interface SoundToggleProps {
  enabled: boolean;
  onToggle: () => void;
  titleOn: string;
  titleOff: string;
  testId: string;
  /** Size, shadow, and radius stay per-game; colors and behavior are shared. */
  className?: string;
}

/** Shared mute/unmute button for game sound effects. */
export function SoundToggle({
  enabled,
  onToggle,
  titleOn,
  titleOff,
  testId,
  className = '',
}: SoundToggleProps) {
  return (
    <button
      onClick={onToggle}
      title={enabled ? titleOn : titleOff}
      className={`flex items-center justify-center border-4 border-black text-sm transition-all active:translate-y-0.5 ${
        enabled ? 'bg-lime-300' : 'bg-gray-300 grayscale'
      } ${className}`}
      data-testid={testId}
    >
      {enabled ? '🔊' : '🔇'}
    </button>
  );
}
