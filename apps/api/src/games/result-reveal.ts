import {
  getResultRevealPlan,
  getResultRevealProgress,
  ResultRevealActionPayload,
  RoomState,
} from '@repo/types';
import { randomUUID } from 'crypto';

export function syncResultReveal(room: RoomState, now = Date.now()): void {
  const plan = getResultRevealPlan(room);
  if (!plan) {
    delete room.resultReveal;
  } else if (room.resultReveal?.key !== plan.key) {
    room.resultReveal = { ...plan, id: randomUUID(), startedAt: now, advancedMs: 0 };
  }
}

export function applyResultRevealAction(
  room: RoomState,
  socketId: string,
  payload: ResultRevealActionPayload,
  now = Date.now(),
): boolean {
  const reveal = room.resultReveal;
  const player = room.players.find((p) => p.socketId === socketId && !p.isViewer);
  if (
    !reveal ||
    !player ||
    reveal.id !== payload.revealId ||
    getResultRevealPlan(room)?.key !== reveal.key
  )
    return false;
  const progress = getResultRevealProgress(reveal, now);
  if (progress.complete) return false;
  if (payload.action === 'SKIP' && socketId === room.roomHostId) {
    reveal.skipped = true;
    return true;
  }
  if (
    payload.action !== 'REVEAL' ||
    reveal.kind !== 'ROLES' ||
    progress.activeIndex < 0 ||
    progress.showWinner ||
    progress.revealedCount > progress.activeIndex ||
    reveal.playerIds[progress.activeIndex] !== player.id
  )
    return false;
  reveal.advancedMs +=
    reveal.introMs + (progress.activeIndex + 0.5) * reveal.stepMs - progress.elapsed;
  return true;
}
