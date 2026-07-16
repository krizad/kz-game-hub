import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

interface SessionRecord {
  playerId: string;
  expiresAt: number;
}

@Injectable()
export class PlayerSessionService {
  private static readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000;

  private readonly sessions = new Map<string, Map<string, SessionRecord>>();
  private readonly pendingTokens = new Map<string, string>();

  issue(roomCode: string, playerId: string, socketId: string): void {
    this.revokePlayer(roomCode, playerId);

    const token = randomBytes(32).toString('base64url');
    const roomSessions = this.sessions.get(roomCode) ?? new Map<string, SessionRecord>();
    roomSessions.set(this.hash(token), {
      playerId,
      expiresAt: Date.now() + PlayerSessionService.SESSION_TTL_MS,
    });
    this.sessions.set(roomCode, roomSessions);
    this.pendingTokens.set(socketId, token);
  }

  consume(roomCode: string, token: string): string | null {
    const roomSessions = this.sessions.get(roomCode);
    if (!roomSessions) return null;

    const tokenHash = this.hash(token);
    const session = roomSessions.get(tokenHash);
    roomSessions.delete(tokenHash);

    if (!session || session.expiresAt <= Date.now()) return null;
    return session.playerId;
  }

  takePendingToken(socketId: string): string | null {
    const token = this.pendingTokens.get(socketId) ?? null;
    this.pendingTokens.delete(socketId);
    return token;
  }

  revokePlayer(roomCode: string, playerId: string): void {
    const roomSessions = this.sessions.get(roomCode);
    if (!roomSessions) return;

    for (const [tokenHash, session] of roomSessions.entries()) {
      if (session.playerId === playerId) roomSessions.delete(tokenHash);
    }
    if (roomSessions.size === 0) this.sessions.delete(roomCode);
  }

  clearRoom(roomCode: string): void {
    this.sessions.delete(roomCode);
  }

  clearAll(): void {
    this.sessions.clear();
    this.pendingTokens.clear();
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('base64url');
  }
}
