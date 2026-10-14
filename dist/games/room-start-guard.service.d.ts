import { RoomState } from '@repo/types';
export interface RoomStartTicket {
    ticketId: string;
    code: string;
    room: RoomState;
    roomHostId: string;
    configSnapshot: string;
    participantIds: string[];
    createdAt: number;
}
export declare class RoomStartGuardService {
    private readonly activeTickets;
    begin(code: string, room: RoomState): RoomStartTicket | 'START_BUSY';
    isCurrent(ticket: RoomStartTicket, room: RoomState | undefined): boolean;
    release(ticket: RoomStartTicket): void;
    invalidate(code: string): void;
    isBusy(code: string): boolean;
    private getParticipantIds;
}
