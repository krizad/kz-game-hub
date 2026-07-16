import { PlayerSessionService } from './player-session.service';

describe('PlayerSessionService', () => {
  let service: PlayerSessionService;

  beforeEach(() => {
    service = new PlayerSessionService();
  });

  it('issues a private token that can only be consumed once', () => {
    service.issue('ABCDEF', 'player-1', 'socket-1');
    const token = service.takePendingToken('socket-1');

    expect(token).toBeTruthy();
    expect(service.consume('ABCDEF', token!)).toBe('player-1');
    expect(service.consume('ABCDEF', token!)).toBeNull();
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
});
