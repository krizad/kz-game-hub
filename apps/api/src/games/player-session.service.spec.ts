import { PlayerSessionService } from './player-session.service';

describe('PlayerSessionService', () => {
  let service: PlayerSessionService;

  beforeEach(() => {
    service = new PlayerSessionService();
  });

  it('allows the same private token to reconnect repeatedly until rotated', () => {
    service.issue('ABCDEF', 'player-1', 'socket-1');
    const token = service.takePendingToken('socket-1');

    expect(token).toBeTruthy();
    expect(service.consume('ABCDEF', token!)).toBe('player-1');
    expect(service.consume('ABCDEF', token!)).toBe('player-1');
  });

  it('rotates the token when issuing a replacement session', () => {
    service.issue('ABCDEF', 'player-1', 'socket-1');
    const firstToken = service.takePendingToken('socket-1')!;
    service.issue('ABCDEF', 'player-1', 'socket-2');
    const secondToken = service.takePendingToken('socket-2')!;

    expect(secondToken).not.toBe(firstToken);
    expect(service.consume('ABCDEF', firstToken)).toBeNull();
    expect(service.consume('ABCDEF', secondToken)).toBe('player-1');
  });

  it('verify and consume both preserve the token for reconnects', () => {
    service.issue('ABCDEF', 'player-1', 'socket-1');
    const token = service.takePendingToken('socket-1')!;

    expect(service.verify('ABCDEF', token)).toBe('player-1');
    expect(service.verify('ABCDEF', token)).toBe('player-1');
    expect(service.consume('ABCDEF', token)).toBe('player-1');
    expect(service.verify('ABCDEF', token)).toBe('player-1');
  });

  it('consume ignores unknown tokens without revoking others', () => {
    service.issue('ABCDEF', 'player-1', 'socket-1');
    const firstToken = service.takePendingToken('socket-1')!;
    service.issue('ABCDEF', 'player-2', 'socket-2');
    const secondToken = service.takePendingToken('socket-2')!;

    expect(service.consume('ABCDEF', 'not-a-token')).toBeNull();
    expect(service.consume('ABCDEF', firstToken)).toBe('player-1');
    expect(service.consume('ABCDEF', secondToken)).toBe('player-2');
  });

  it('retains the existing token across reconnects and preserves original 24h TTL', () => {
    jest.useFakeTimers();
    try {
      service.issue('ABCDEF', 'player-1', 'socket-1');
      const token = service.takePendingToken('socket-1')!;
      expect(token).toBeTruthy();

      // Advance 12 hours, then reconnect using retain
      jest.advanceTimersByTime(12 * 60 * 60 * 1000);
      service.retain('ABCDEF', 'player-1', token, 'socket-2');
      expect(service.takePendingToken('socket-2')).toBe(token);
      expect(service.verify('ABCDEF', token)).toBe('player-1');

      // Advance another 12 hours + 1ms — original 24h TTL is now expired
      jest.advanceTimersByTime(12 * 60 * 60 * 1000 + 1);
      expect(service.verify('ABCDEF', token)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('cleans up pending tokens when revoking a player or clearing a room', () => {
    service.issue('ABCDEF', 'player-1', 'socket-1');
    const token1 = service.takePendingToken('socket-1')!;
    service.issue('ABCDEF', 'player-1', 'socket-1b');
    service.issue('ABCDEF', 'player-2', 'socket-2');

    service.revokePlayer('ABCDEF', 'player-1');
    expect(service.takePendingToken('socket-1b')).toBeNull();
    expect(service.verify('ABCDEF', token1)).toBeNull();

    service.clearRoom('ABCDEF');
    expect(service.takePendingToken('socket-2')).toBeNull();
  });
});

