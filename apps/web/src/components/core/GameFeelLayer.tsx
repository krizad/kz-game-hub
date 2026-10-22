'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FlashType, ShakeEventDetail, FlashEventDetail } from '@/lib/gameFeel';

interface GameFeelLayerProps {
  children: React.ReactNode;
}

export function GameFeelLayer({ children }: GameFeelLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const traumaRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const [flash, setFlash] = useState<{ active: boolean; type: FlashType }>({
    active: false,
    type: 'white',
  });
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const isReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onShake = (e: Event) => {
      if (isReduced) return;
      const custom = e as CustomEvent<ShakeEventDetail>;
      const addedTrauma = custom.detail?.trauma ?? 0.5;
      traumaRef.current = Math.min(1.0, traumaRef.current + addedTrauma);

      if (animFrameRef.current === null) {
        lastTimeRef.current = performance.now();
        animFrameRef.current = requestAnimationFrame(shakeLoop);
      }
    };

    const shakeLoop = (time: number) => {
      const dt = Math.max(1, Math.min(100, time - lastTimeRef.current));
      lastTimeRef.current = time;

      // Decay trauma over time (~0.0025 per ms => 0.5 decays in ~200ms)
      traumaRef.current = Math.max(0, traumaRef.current - 0.0025 * dt);
      const trauma = traumaRef.current;
      const shake = trauma * trauma; // Quadratic trauma decay

      const el = containerRef.current;
      if (el) {
        if (trauma > 0.01) {
          const maxOffset = 12; // px
          const maxAngle = 2.5; // deg
          const x = (Math.random() * 2 - 1) * maxOffset * shake;
          const y = (Math.random() * 2 - 1) * maxOffset * shake;
          const rot = (Math.random() * 2 - 1) * maxAngle * shake;
          el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0px) rotate(${rot.toFixed(2)}deg)`;
          animFrameRef.current = requestAnimationFrame(shakeLoop);
        } else {
          el.style.transform = '';
          traumaRef.current = 0;
          animFrameRef.current = null;
        }
      } else {
        animFrameRef.current = null;
      }
    };

    const onFlash = (e: Event) => {
      const custom = e as CustomEvent<FlashEventDetail>;
      const type = custom.detail?.type ?? 'white';
      const durationMs = custom.detail?.durationMs ?? 350;

      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }

      setFlash({ active: true, type });
      flashTimerRef.current = setTimeout(() => {
        setFlash((prev) => ({ ...prev, active: false }));
      }, durationMs);
    };

    window.addEventListener('kz-game-shake', onShake);
    window.addEventListener('kz-game-flash', onFlash);

    return () => {
      window.removeEventListener('kz-game-shake', onShake);
      window.removeEventListener('kz-game-flash', onFlash);
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  const flashClasses = {
    red: 'bg-red-500/25 ring-[12px] ring-inset ring-red-600',
    gold: 'bg-yellow-400/25 ring-[12px] ring-inset ring-amber-400',
    green: 'bg-emerald-500/25 ring-[12px] ring-inset ring-emerald-500',
    white: 'bg-white/40 ring-[12px] ring-inset ring-white',
  }[flash.type];

  return (
    <>
      {flash.active && (
        <div
          data-testid="game-feel-flash"
          aria-hidden="true"
          className={`pointer-events-none fixed inset-0 z-[9998] transition-opacity duration-300 ${flashClasses}`}
        />
      )}
      <div
        ref={containerRef}
        data-testid="game-feel-container"
        className="w-full h-full min-h-screen flex flex-col"
        style={{ willChange: 'transform' }}
      >
        {children}
      </div>
    </>
  );
}
