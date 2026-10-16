import { GameType, RoomState, RoomStatus } from '@repo/types';

export function buildDogRelayResultRows(
  room: RoomState,
): { playerName: string; score: number; rank: number }[] {
  const state = room.dogRelayState;
  if (
    room.gameType !== GameType.DOG_RELAY ||
    room.status !== RoomStatus.RESULT ||
    state?.phase !== 'RESULT' ||
    !state.result
  ) {
    throw new Error('DOG_RELAY_NO_RESULT');
  }
  return state.seatOrder.map((id) => {
    const player = room.players.find((candidate) => candidate.id === id);
    if (!player) throw new Error('DOG_RELAY_MISSING_PARTICIPANT');
    const won = state.result!.winnerIds.includes(id);
    return { playerName: player.name, score: won ? 1 : 0, rank: won ? 1 : 2 };
  });
}
