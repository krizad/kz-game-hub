'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { RoomStatus } from '@repo/types';
import { DogRelayCardCatalog } from './DogRelayCardCatalog';

export function DogRelaySeats() {
  const { room, socketId, sendDogRelayAction, actionLoading } = useGameStore();
  const { t } = useTranslate();
  const seatElements = useRef(new Map<string, HTMLLIElement>());
  const movedPlayerId = useRef<string | null>(null);
  const seatOrder = room?.dogRelayState?.seatOrder;
  useEffect(() => {
    if (movedPlayerId.current) {
      seatElements.current.get(movedPlayerId.current)?.focus();
      movedPlayerId.current = null;
    }
  }, [seatOrder]);
  if (!room?.dogRelayState) return null;
  const order = room.dogRelayState.seatOrder;
  const canMove =
    room.status === RoomStatus.LOBBY && room.roomHostId === socketId && !actionLoading;
  const move = (index: number, direction: number) => {
    movedPlayerId.current = order[index];
    const next = [...order];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    sendDogRelayAction({ type: 'REORDER_SEATS', playerIds: next });
  };
  return (
    <section className="w-full space-y-3" aria-label={t('dogRelay.seats')}>
      <h3 className="font-black text-lg">{t('dogRelay.seats')}</h3>
      <p className="text-sm">{t('dogRelay.circleHint')}</p>
      <DogRelayCardCatalog />
      <ol className="space-y-2">
        {order.map((id, index) => {
          const player = room.players.find((p) => p.id === id);
          return (
            <li
              data-testid="dog-relay-seat"
              key={id}
              tabIndex={-1}
              ref={(element) => {
                if (element) seatElements.current.set(id, element);
                else seatElements.current.delete(id);
              }}
              className="flex gap-2 items-center border-2 border-black bg-white p-2"
            >
              <span className="font-black">{index + 1}.</span>
              <span className="flex-1 min-w-0 break-words font-bold">{player?.name ?? id}</span>
              {room.status === RoomStatus.LOBBY && room.roomHostId === socketId && (
                <>
                  <button
                    type="button"
                    aria-label={t('dogRelay.moveUp', { name: player?.name ?? id })}
                    disabled={!canMove || index === 0}
                    onClick={() => move(index, -1)}
                    className="border-2 border-black p-2 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={t('dogRelay.moveDown', { name: player?.name ?? id })}
                    disabled={!canMove || index === order.length - 1}
                    onClick={() => move(index, 1)}
                    className="border-2 border-black p-2 disabled:opacity-30"
                  >
                    ↓
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
