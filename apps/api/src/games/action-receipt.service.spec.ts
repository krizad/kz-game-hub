import { ActionReceipt, SOCKET_EVENTS } from '@repo/types';
import { ActionReceiptService, computePayloadFingerprint } from './action-receipt.service';

describe('ActionReceiptService', () => {
  let service: ActionReceiptService;

  beforeEach(() => {
    service = new ActionReceiptService();
  });

  describe('requestId validation', () => {
    it('accepts valid request IDs with length between 1 and 64', () => {
      expect(service.isValidRequestId('1')).toBe(true);
      expect(service.isValidRequestId('req-123-abc')).toBe(true);
      expect(service.isValidRequestId('a'.repeat(64))).toBe(true);
    });

    it('rejects invalid request IDs', () => {
      expect(service.isValidRequestId('')).toBe(false);
      expect(service.isValidRequestId('a'.repeat(65))).toBe(false);
      expect(service.isValidRequestId(null)).toBe(false);
      expect(service.isValidRequestId(undefined)).toBe(false);
      expect(service.isValidRequestId(12345)).toBe(false);
      expect(service.isValidRequestId({})).toBe(false);
    });
  });

  describe('fingerprinting', () => {
    it('ignores requestId in payload fingerprinting', () => {
      const p1 = { code: 'ABCDEF', index: 3, requestId: 'req-1' };
      const p2 = { code: 'ABCDEF', index: 3, requestId: 'req-2' };
      expect(computePayloadFingerprint(p1)).toEqual(computePayloadFingerprint(p2));
    });

    it('distinguishes different action parameters', () => {
      const p1 = { code: 'ABCDEF', index: 3 };
      const p2 = { code: 'ABCDEF', index: 4 };
      expect(computePayloadFingerprint(p1)).not.toEqual(computePayloadFingerprint(p2));
    });
  });

  describe('cache check and record', () => {
    const code = 'ROOM01';
    const playerId = 'player-seat-1';
    const event = SOCKET_EVENTS.TTT_MAKE_MOVE;
    const requestId = 'req-move-001';
    const payload = { code, index: 4, requestId };

    it('returns MISS on fresh request', () => {
      const result = service.check(code, playerId, event, requestId, payload);
      expect(result.kind).toBe('MISS');
    });

    it('returns HIT with cached receipt when duplicate request arrives with matching payload', () => {
      const receipt: ActionReceipt = {
        code,
        requestId,
        event,
        status: 'accepted',
        serverNow: 1000,
      };

      service.record(code, playerId, event, requestId, payload, receipt, 1000);

      const checkResult = service.check(code, playerId, event, requestId, payload, 1500);
      expect(checkResult.kind).toBe('HIT');
      if (checkResult.kind === 'HIT') {
        expect(checkResult.receipt).toEqual(receipt);
      }
    });

    it('returns CONFLICT with REQUEST_ID_REUSED when duplicate requestId has conflicting payload', () => {
      const receipt: ActionReceipt = {
        code,
        requestId,
        event,
        status: 'accepted',
        serverNow: 1000,
      };

      service.record(code, playerId, event, requestId, payload, receipt, 1000);

      const conflictingPayload = { code, index: 8, requestId };
      const checkResult = service.check(code, playerId, event, requestId, conflictingPayload, 1500);

      expect(checkResult.kind).toBe('CONFLICT');
      if (checkResult.kind === 'CONFLICT') {
        expect(checkResult.receipt.status).toBe('rejected');
        expect(checkResult.receipt.reason).toBe('REQUEST_ID_REUSED');
        expect(checkResult.receipt.requestId).toBe(requestId);
      }
    });

    it('supports legacy payloads without requestId by ignoring cache', () => {
      const result = service.check(code, playerId, event, undefined as unknown as string, payload);
      expect(result.kind).toBe('MISS');

      // Recording with undefined requestId does nothing
      service.record(
        code,
        playerId,
        event,
        undefined as unknown as string,
        payload,
        {
          code,
          requestId: '',
          event,
          status: 'accepted',
          serverNow: 1000,
        },
        1000,
      );
      expect(service.getSeatEntryCount(code, playerId)).toBe(0);
    });

    it('preserves cached receipts across reconnects using stable playerId', () => {
      const receipt: ActionReceipt = {
        code,
        requestId,
        event,
        status: 'accepted',
        serverNow: 2000,
      };

      // Player joins on socket-alpha, records receipt
      service.record(code, playerId, event, requestId, payload, receipt, 2000);

      // Player disconnects and reconnects on socket-beta, stable playerId remains the same
      const reconnectResult = service.check(code, playerId, event, requestId, payload, 2100);
      expect(reconnectResult.kind).toBe('HIT');
      if (reconnectResult.kind === 'HIT') {
        expect(reconnectResult.receipt).toEqual(receipt);
      }
    });
  });

  describe('TTL and capacity eviction', () => {
    const code = 'ROOM01';
    const playerId = 'player-seat-1';
    const event = SOCKET_EVENTS.TTT_MAKE_MOVE;

    it('evicts entries older than 60s (TTL)', () => {
      const requestId = 'req-ttl-01';
      const payload = { index: 0, requestId };
      const receipt: ActionReceipt = {
        code,
        requestId,
        event,
        status: 'accepted',
        serverNow: 10_000,
      };

      service.record(code, playerId, event, requestId, payload, receipt, 10_000);

      // Within 60s -> HIT
      expect(service.check(code, playerId, event, requestId, payload, 69_000).kind).toBe('HIT');

      // After 60.001s -> MISS (expired)
      expect(service.check(code, playerId, event, requestId, payload, 70_001).kind).toBe('MISS');
    });

    it('limits cache size to 64 entries per seat, evicting the oldest', () => {
      // Record 64 entries
      for (let i = 0; i < 64; i++) {
        const reqId = `req-${i}`;
        service.record(
          code,
          playerId,
          event,
          reqId,
          { index: i },
          { code, requestId: reqId, event, status: 'accepted', serverNow: 1000 + i },
          1000 + i,
        );
      }
      expect(service.getSeatEntryCount(code, playerId)).toBe(64);

      // req-0 is currently the oldest
      expect(service.check(code, playerId, event, 'req-0', { index: 0 }, 1070).kind).toBe('HIT');

      // Record 65th entry
      service.record(
        code,
        playerId,
        event,
        'req-64',
        { index: 64 },
        { code, requestId: 'req-64', event, status: 'accepted', serverNow: 1100 },
        1100,
      );

      // Max capacity preserved
      expect(service.getSeatEntryCount(code, playerId)).toBe(64);

      // Oldest entry (req-0) was evicted
      expect(service.check(code, playerId, event, 'req-0', { index: 0 }, 1110).kind).toBe('MISS');

      // Newer entries remain cached
      expect(service.check(code, playerId, event, 'req-1', { index: 1 }, 1110).kind).toBe('HIT');
      expect(service.check(code, playerId, event, 'req-64', { index: 64 }, 1110).kind).toBe('HIT');
    });

    it('clears all room cache when clearRoom is called', () => {
      service.record(
        code,
        playerId,
        event,
        'req-clear',
        { index: 0 },
        { code, requestId: 'req-clear', event, status: 'accepted', serverNow: 1000 },
        1000,
      );

      expect(service.getSeatEntryCount(code, playerId)).toBe(1);

      service.clearRoom(code);
      expect(service.getSeatEntryCount(code, playerId)).toBe(0);
      expect(service.check(code, playerId, event, 'req-clear', { index: 0 }, 1050).kind).toBe(
        'MISS',
      );
    });
  });
});
