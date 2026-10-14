'use client';

import React from 'react';

export interface GameActionAreaProps {
  children: React.ReactNode;
  className?: string;
  docked?: boolean;
  ariaLabel?: string;
  testId?: string;
}

export function GameActionArea({
  children,
  className = '',
  docked = false,
  ariaLabel = 'Game actions',
  testId = 'game-action-area',
}: GameActionAreaProps) {
  return (
    <section
      role="region"
      aria-label={ariaLabel}
      data-testid={testId}
      className={`w-full transition-all duration-150 ${
        docked
          ? 'sticky bottom-0 z-20 bg-white/95 backdrop-blur-sm border-t-4 sm:border-4 border-black p-3 sm:p-4 shadow-[0_-4px_0_0_#000] sm:shadow-[4px_4px_0_0_#000] max-h-[45vh] overflow-y-auto'
          : 'bg-white border-4 border-black p-3 sm:p-4 shadow-[4px_4px_0_0_#000]'
      } ${className}`}
    >
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full">
        {children}
      </div>
    </section>
  );
}
