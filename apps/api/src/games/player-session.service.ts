import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

interface SessionRecord {
  playerId: string;
  expiresAt: number;
}

interface PendingTokenRecord {
  roomCode: string;
  playerId: string;
  token: string;
}

@Injectable()
export class PlayerSessionService {
  private static readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000;

  private readonly sessions = new Map<string, Map<string, SessionRecord>>();
  private readonly pendingTokens = new Map<string, PendingTokenRecord>();

  issue(roomCode: string, playerId: string, socketId: string): void {
    this.revokePlayer(roomCode, playerId);

    const token = randomBytes(32).toString('base64url');
    const roomSessions = this.sessions.get(roomCode) ?? new Map<string, SessionRecord>();
    roomSessions.set(this.hash(token), {
      playerId,
      expiresAt: Date.now() + PlayerSessionService.SESSION_TTL_MS,
    });
    this.sessions.set(roomCode, roomSessions);
    this.pendingTokens.set(socketId, { roomCode, playerId, token });
  }

  /**
   * Preserve an existing verified session token and its original expiry across
   * reconnects, while queuing the same token for delivery to the new socket.
   */
  retain(roomCode: string, playerId: string, token: string, socketId: string): boolean {
    if (this.verify(roomCode, token) !== playerId) {
      return false;
    }

    this.deletePendingForPlayer(roomCode, playerId);
    this.pendingTokens.set(socketId, { roomCode, playerId, token });
    return true;
  }

  consume(roomCode: string, token: string): string | null {
    // Reconnect tokens are stable for the lifetime of the session. A refresh
    // can race the SESSION_ASSIGNED response that rotates a one-shot token,
    // leaving the browser with a token the server has already consumed.
    return this.verify(roomCode, token);
  }

  verify(roomCode: string, token: string): string | null {
    const roomSessions = this.sessions.get(roomCode);
    if (!roomSessions) return null;

    const tokenHash = this.hash(token);
    const session = roomSessions.get(tokenHash);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      roomSessions.delete(tokenHash);
      if (roomSessions.size === 0) this.sessions.delete(roomCode);
      this.deletePendingForPlayer(roomCode, session.playerId);
      return null;
    }
    return session.playerId;
  }

  takePendingToken(socketId: string): string | null {
    const record = this.pendingTokens.get(socketId);
    this.pendingTokens.delete(socketId);
    if (!record) return null;
    if (this.verify(record.roomCode, record.token) !== record.playerId) {
      return null;
    }
    return record.token;
  }

  revokePlayer(roomCode: string, playerId: string): void {
    this.deletePendingForPlayer(roomCode, playerId);

    const roomSessions = this.sessions.get(roomCode);
    if (!roomSessions) return;

    for (const [tokenHash, session] of roomSessions.entries()) {
      if (session.playerId === playerId) roomSessions.delete(tokenHash);
    }
    if (roomSessions.size === 0) this.sessions.delete(roomCode);
  }

  clearRoom(roomCode: string): void {
    this.sessions.delete(roomCode);
    for (const [socketId, record] of this.pendingTokens.entries()) {
      if (record.roomCode === roomCode) {
        this.pendingTokens.delete(socketId);
      }
    }
  }

  clearAll(): void {
    this.sessions.clear();
    this.pendingTokens.clear();
  }

  private deletePendingForPlayer(roomCode: string, playerId: string): void {
    for (const [socketId, record] of this.pendingTokens.entries()) {
      if (record.roomCode === roomCode && record.playerId === playerId) {
        this.pendingTokens.delete(socketId);
      }
    }
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('base64url');
  }
}
