'use client';

import { useGameStore } from '@/store/useGameStore';

/**
 * Calculates estimated server clock offset from an RTT sample.
 * t0: client timestamp when request was sent
 * t1: client timestamp when response was received
 * serverNow: server timestamp returned by the server
 *
 * offset = serverNow - (t0 + t1) / 2
 *
 * A positive offset means server clock is ahead of client clock.
 * A negative offset means server clock is behind client clock.
 * Note: Offset is used solely for UI display / countdown presentation;
 * game logic and winners are strictly server-authoritative.
 */
export function estimateServerOffset(t0: number, t1: number, serverNow: number): number {
  return serverNow - (t0 + t1) / 2;
}

export function useServerClock() {
  const serverOffset = useGameStore((state) => state.serverOffset);
  const syncServerTime = useGameStore((state) => state.syncServerTime);

  const getEstimatedServerTime = () => Date.now() + serverOffset;

  const getRemainingMs = (serverTargetTimestamp: number) =>
    Math.max(0, serverTargetTimestamp - (Date.now() + serverOffset));

  return {
    serverOffset,
    syncServerTime,
    getEstimatedServerTime,
    getRemainingMs,
    now: getEstimatedServerTime,
  };
}
