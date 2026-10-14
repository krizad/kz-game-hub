import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus } from '@repo/types';

export interface RoomStartTicket {
  ticketId: string;
  code: string;
  room: RoomState;
  roomHostId: string;
  configSnapshot: string;
  participantIds: string[];
  createdAt: number;
}

@Injectable()
export class RoomStartGuardService {
  private readonly activeTickets = new Map<string, RoomStartTicket>();

  /**
   * Acquire a start ticket for an async game initiation.
   * If a start operation is already in-flight for this room, returns 'START_BUSY'.
   */
  begin(code: string, room: RoomState): RoomStartTicket | 'START_BUSY' {
    if (this.activeTickets.has(code)) {
      return 'START_BUSY';
    }

    const ticket: RoomStartTicket = {
      ticketId: `${code}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      code,
      room,
      roomHostId: room.roomHostId,
      configSnapshot: JSON.stringify(room.config ?? {}),
      participantIds: this.getParticipantIds(room),
      createdAt: Date.now(),
    };

    this.activeTickets.set(code, ticket);
    return ticket;
  }

  /**
   * Revalidates that the room has not changed during async generation.
   * Checks object identity, ticket registration, LOBBY status, host identity,
   * config snapshot, and connected non-viewer participant roster.
   */
  isCurrent(ticket: RoomStartTicket, room: RoomState | undefined): boolean {
    if (!room || ticket.room !== room) return false;
    if (this.activeTickets.get(ticket.code) !== ticket) return false;
    if (room.status !== RoomStatus.LOBBY) return false;
    if (room.roomHostId !== ticket.roomHostId) return false;
    if (JSON.stringify(room.config ?? {}) !== ticket.configSnapshot) return false;

    const currentParticipants = this.getParticipantIds(room);
    if (currentParticipants.length !== ticket.participantIds.length) return false;
    for (let i = 0; i < currentParticipants.length; i++) {
      if (currentParticipants[i] !== ticket.participantIds[i]) return false;
    }

    return true;
  }

  /**
   * Release a ticket when async start finishes or fails.
   */
  release(ticket: RoomStartTicket): void {
    if (this.activeTickets.get(ticket.code) === ticket) {
      this.activeTickets.delete(ticket.code);
    }
  }

  /**
   * Invalidate any in-flight ticket for a room (e.g. room deletion).
   */
  invalidate(code: string): void {
    this.activeTickets.delete(code);
  }

  /**
   * Check whether a room is currently generating / starting.
   */
  isBusy(code: string): boolean {
    return this.activeTickets.has(code);
  }

  private getParticipantIds(room: RoomState): string[] {
    return (room.players || [])
      .filter((p) => !p.isViewer && p.connected !== false)
      .map((p) => p.id || p.socketId)
      .sort();
  }
}
