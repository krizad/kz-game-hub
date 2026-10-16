import { GameType, RoomState, RoomStatus } from '@repo/types';
import { buildDogRelayResultRows } from './dog-relay-results';

describe('buildDogRelayResultRows', () => {
  function completed(winningTeam: 'GOOD' | 'EVIL'): RoomState {
    const ids = ['leader', 'evil', 'good1', 'good2', 'good3'];
    return {
      gameType: GameType.DOG_RELAY,
      status: RoomStatus.RESULT,
      players: [...ids, 'spectator'].map((id) => ({
        id,
        name: id,
        score: 999,
        isViewer: id === 'spectator',
      })),
      dogRelayState: {
        phase: 'RESULT',
        seatOrder: ids,
        result: {
          winningTeam,
          winnerIds: winningTeam === 'EVIL' ? ['evil'] : ids.filter((id) => id !== 'evil'),
        },
      },
    } as RoomState;
  }
  it.each(['GOOD', 'EVIL'] as const)(
    'records team ranks from %s outcome rather than stale scores',
    (team) => {
      const rows = buildDogRelayResultRows(completed(team));
      expect(rows).toHaveLength(5);
      expect(rows.some((row) => row.playerName === 'spectator')).toBe(false);
      expect(rows.filter((row) => row.rank === 1 && row.score === 1)).toHaveLength(
        team === 'GOOD' ? 4 : 1,
      );
      expect(rows.filter((row) => row.rank === 2 && row.score === 0)).toHaveLength(
        team === 'GOOD' ? 1 : 4,
      );
    },
  );
  it('requires a completed result', () => {
    const room = completed('GOOD');
    room.status = RoomStatus.PLAYING;
    expect(() => buildDogRelayResultRows(room)).toThrow('DOG_RELAY_NO_RESULT');
    room.status = RoomStatus.RESULT;
    room.dogRelayState!.result = null;
    expect(() => buildDogRelayResultRows(room)).toThrow('DOG_RELAY_NO_RESULT');
  });
});
