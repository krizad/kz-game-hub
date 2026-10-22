'use client';

import { ReactNode, useEffect, useState } from 'react';

export interface CountdownBadgeProps {
  /** Target timestamp in milliseconds. */
  deadline?: number | null;
  /** Server-client time difference in ms. */
  serverOffset?: number;
  /** Presentation format: 'seconds' (e.g. 15), 'mm:ss' (e.g. 01:25), or custom via render prop. */
  format?: 'seconds' | 'mm:ss';
  /** Optional prefix element (e.g. icon or string). */
  prefix?: ReactNode;
  /** Optional suffix element (e.g. 's' or ' remaining'). */
  suffix?: ReactNode;
  /** Additional CSS class names. */
  className?: string;
  /** Fallback content when deadline is null/undefined. Defaults to null. */
  fallback?: ReactNode;
  /** Custom render function if specialized layout is needed. */
  render?: (secondsLeft: number) => ReactNode;
  /** Callback fired when the countdown hits zero. */
  onZero?: () => void;
}

/**
 * Isolated countdown leaf component.
 * Updates its internal timer every 500ms without triggering re-renders of parent tables or game views.
 */
export function CountdownBadge({
  deadline,
  serverOffset = 0,
  format = 'seconds',
  prefix,
  suffix,
  className,
  fallback = null,
  render,
  onZero,
}: CountdownBadgeProps) {
  const calculateSeconds = () => {
    if (!deadline) return null;
    const now = Date.now() + serverOffset;
    return Math.max(0, Math.ceil((deadline - now) / 1000));
  };

  const [secondsLeft, setSecondsLeft] = useState<number | null>(calculateSeconds);

  useEffect(() => {
    if (!deadline) {
      setSecondsLeft(null);
      return;
    }

    const update = () => {
      const now = Date.now() + serverOffset;
      const left = Math.max(0, Math.ceil((deadline - now) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && onZero) {
        onZero();
      }
    };

    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [deadline, serverOffset, onZero]);

  if (secondsLeft === null) return <>{fallback}</>;

  if (render) {
    return (
      <span className={className}>
        {prefix}
        {render(secondsLeft)}
        {suffix}
      </span>
    );
  }

  let formatted: ReactNode = secondsLeft;
  if (format === 'mm:ss') {
    const minutes = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    formatted = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
