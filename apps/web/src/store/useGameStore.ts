import { create } from 'zustand';
import { RoomState, SOCKET_EVENTS } from '@repo/types';
import { GameState, PendingAction, StoreSharedContext } from './slices/types';
import { createConnectionSlice } from './slices/connection.slice';
import { createLobbySlice } from './slices/lobby.slice';
import { createGameActionsSlice } from './slices/game-actions.slice';

export type { PendingAction };

export const useGameStore = create<GameState>((set, get) => {
  const ctx: StoreSharedContext = {
    pendingSpectatorJoin: null,
    actionTimeouts: new Map<string, ReturnType<typeof setTimeout>>(),
    clockSyncTimeouts: [],
    bestRtt: Infinity,
    browserListenersAttached: false,
    keepAliveTimer: null,
    stagedDogRelay: null,
    seenDogRelayRounds: new Set<string>(),
    latestCategoriesRequest: null,

    clearAllActionTimeouts: () => {
      ctx.actionTimeouts.forEach((timeout) => {
        clearTimeout(timeout);
      });
      ctx.actionTimeouts.clear();
    },

    clearClockSyncTimeouts: () => {
      ctx.clockSyncTimeouts.forEach((timeout) => {
        clearTimeout(timeout);
      });
      ctx.clockSyncTimeouts.length = 0;
    },

    clearRoomSession: () => {
      ctx.stagedDogRelay = null;
      ctx.seenDogRelayRounds.clear();
      ctx.latestCategoriesRequest = null;
      ctx.clearAllActionTimeouts();
      set({
        room: null,
        myRole: null,
        secretWord: null,
        privateState: {},
        isSpectator: false,
        playerId: '',
        pendingActions: {},
        actionLoading: false,
        categories: [],
        categoriesLoading: false,
        categoriesError: null,
        categoriesLang: null,
      });
    },

    /**
     * Standard game-action emitter: guards on socket/room/loading state,
     * flips `actionLoading`, and sends `{ code, ...payload }`.
     * Returns true when the event was actually emitted.
     */
    emitGameAction: (
      event: string,
      options: {
        loading?: boolean;
        trackReceipt?: boolean;
        payload?: (room: RoomState) => Record<string, unknown>;
      } = {},
    ): boolean => {
      const { socket, room, actionLoading, connected, connectionStatus } = get();
      // Offline check: "offline ไม่ queue"
      if (!socket?.connected || !connected || connectionStatus !== 'connected' || !room) {
        return false;
      }
      const withLoading = options.loading ?? true;
      if (withLoading && actionLoading) return false;

      const shouldTrackReceipt =
        options.trackReceipt ??
        (event === SOCKET_EVENTS.TTT_MAKE_MOVE || event === SOCKET_EVENTS.RPS_MAKE_CHOICE);

      let requestId: string | undefined;
      if (shouldTrackReceipt) {
        requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const timeoutId = setTimeout(() => {
          ctx.actionTimeouts.delete(requestId!);
          const current = get().pendingActions[requestId!];
          if (current && current.status === 'pending') {
            const updated = { ...get().pendingActions };
            updated[requestId!] = { ...current, status: 'unknown' };
            const hasOtherPending = Object.values(updated).some((a) => a.status === 'pending');
            set({
              pendingActions: updated,
              actionLoading: hasOtherPending,
            });
          }
        }, 5000);

        ctx.actionTimeouts.set(requestId, timeoutId);
        set({
          pendingActions: {
            ...get().pendingActions,
            [requestId]: {
              event,
              createdAt: Date.now(),
              status: 'pending',
            },
          },
        });
      }

      if (withLoading) set({ actionLoading: true });
      socket.emit(event, {
        code: room.code,
        ...(options.payload ? options.payload(room) : {}),
        ...(requestId ? { requestId } : {}),
      });
      return true;
    },
  };

  return {
    ...createConnectionSlice(set, get, ctx),
    ...createLobbySlice(set, get, ctx),
    ...createGameActionsSlice(set, get, ctx),
  };
});

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as Record<string, unknown>).__useGameStore = useGameStore;
}
