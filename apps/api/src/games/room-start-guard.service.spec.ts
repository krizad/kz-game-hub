import { RoomStartGuardService } from './room-start-guard.service';
import { RoomState, RoomStatus, GameType } from '@repo/types';

describe('RoomStartGuardService', () => {
  let service: RoomStartGuardService;

  beforeEach(() => {
    service = new RoomStartGuardService();
  });

  function createMockRoom(overrides?: Partial<RoomState>): RoomState {
    return {
      id: 'room-1',
      code: 'TEST01',
      gameType: GameType.SOUNDS_FISHY,
      status: RoomStatus.LOBBY,
      roomHostId: 'host-1',
      createdAt: new Date(),
      config: { hostSelection: 'FIXED', timerMin: 1, language: 'th' },
      players: [
        { id: 'p1', socketId: 'host-1', name: 'Host', score: 0, roomId: 'room-1', connected: true },
        {
          id: 'p2',
          socketId: 'guest-2',
          name: 'Guest',
          score: 0,
          roomId: 'room-1',
          connected: true,
        },
      ],
      ...overrides,
    } as unknown as RoomState;
  }

  it('acquires a start ticket with snapshot data', () => {
    const room = createMockRoom();
    const ticket = service.begin('TEST01', room);
    expect(ticket).not.toBe('START_BUSY');
    if (ticket === 'START_BUSY') return;

    expect(ticket.code).toBe('TEST01');
    expect(ticket.roomHostId).toBe('host-1');
    expect(ticket.participantIds).toEqual(['p1', 'p2']);
    expect(service.isBusy('TEST01')).toBe(true);
    expect(service.isCurrent(ticket, room)).toBe(true);
  });

  it('rejects double-start with START_BUSY', () => {
    const room = createMockRoom();
    const ticket1 = service.begin('TEST01', room);
    expect(ticket1).not.toBe('START_BUSY');

    const ticket2 = service.begin('TEST01', room);
    expect(ticket2).toBe('START_BUSY');
  });

  it('invalidates ticket when room status changes away from LOBBY', () => {
    const room = createMockRoom();
    const ticket = service.begin('TEST01', room);
    expect(ticket).not.toBe('START_BUSY');
    if (ticket === 'START_BUSY') return;

    room.status = RoomStatus.QUESTIONING;
    expect(service.isCurrent(ticket, room)).toBe(false);
  });

  it('invalidates ticket when host rotates', () => {
    const room = createMockRoom();
    const ticket = service.begin('TEST01', room);
    expect(ticket).not.toBe('START_BUSY');
    if (ticket === 'START_BUSY') return;

    room.roomHostId = 'guest-2';
    expect(service.isCurrent(ticket, room)).toBe(false);
  });

  it('invalidates ticket when room config changes', () => {
    const room = createMockRoom();
    const ticket = service.begin('TEST01', room);
    expect(ticket).not.toBe('START_BUSY');
    if (ticket === 'START_BUSY') return;

    room.config = { ...room.config, language: 'en' };
    expect(service.isCurrent(ticket, room)).toBe(false);
  });

  it('invalidates ticket when participant roster changes', () => {
    const room = createMockRoom();
    const ticket = service.begin('TEST01', room);
    expect(ticket).not.toBe('START_BUSY');
    if (ticket === 'START_BUSY') return;

    // A player leaves
    room.players = [room.players[0]];
    expect(service.isCurrent(ticket, room)).toBe(false);
  });

  it('release allows a subsequent start attempt', () => {
    const room = createMockRoom();
    const ticket1 = service.begin('TEST01', room);
    expect(ticket1).not.toBe('START_BUSY');
    if (ticket1 === 'START_BUSY') return;

    service.release(ticket1);
    expect(service.isBusy('TEST01')).toBe(false);

    const ticket2 = service.begin('TEST01', room);
    expect(ticket2).not.toBe('START_BUSY');
  });

  it('invalidate clears in-flight ticket on room deletion', () => {
    const room = createMockRoom();
    const ticket = service.begin('TEST01', room);
    expect(ticket).not.toBe('START_BUSY');
    if (ticket === 'START_BUSY') return;

    service.invalidate('TEST01');
    expect(service.isBusy('TEST01')).toBe(false);
    expect(service.isCurrent(ticket, room)).toBe(false);
  });
});
