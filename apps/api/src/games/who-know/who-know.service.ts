import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus, Role, UserState } from '@repo/types';
import { PrivateStateService } from '../private-state.service';

const WK_ROLE = 'wkRole';
const WK_VOTE = 'wkVote';
const MAX_WORD_LENGTH = 60;

@Injectable()
export class WhoKnowService {
  constructor(private readonly privateState: PrivateStateService) {}

  private getRole(room: RoomState, socketId: string): Role | undefined {
    return this.privateState.get<Role>(room.code, socketId, WK_ROLE);
  }

  private setRole(room: RoomState, socketId: string, role: Role): void {
    this.privateState.set(room.code, socketId, WK_ROLE, role);
  }

  private clearRoles(room: RoomState): void {
    for (const p of room.players) {
      this.privateState.delete(room.code, p.socketId, WK_ROLE);
    }
  }

  private revealRoles(room: RoomState): void {
    for (const p of room.players) {
      const role = this.getRole(room, p.socketId);
      if (role) p.role = role;
    }
  }

  assignRoles(
    room: RoomState,
    requesterId: string,
  ): { room: RoomState; roles: Record<string, Role> } | null {
    if (room.status !== RoomStatus.LOBBY && room.status !== RoomStatus.RESULT) return null;
    if (room.roomHostId !== requesterId) return null;

    const connectedPlayers = room.players.filter((p) => p.connected !== false);
    if (connectedPlayers.length < 4) return null;

    room.status = RoomStatus.WORD_SETTING;

    // Assign Host based on config (connected players only)
    let hostPlayer: UserState;

    if (room.config.hostSelection === 'FIXED') {
      hostPlayer =
        connectedPlayers.find((p) => p.socketId === room.roomHostId) || connectedPlayers[0];
    } else if (room.config.hostSelection === 'RANDOM') {
      const hostIndex = Math.floor(Math.random() * connectedPlayers.length);
      hostPlayer = connectedPlayers[hostIndex];
    } else {
      let eligibleHosts = connectedPlayers.filter((p) => !p.hasBeenHost);
      if (eligibleHosts.length === 0) {
        connectedPlayers.forEach((p) => (p.hasBeenHost = false));
        eligibleHosts = connectedPlayers;
      }
      const hostIndex = Math.floor(Math.random() * eligibleHosts.length);
      hostPlayer = eligibleHosts[hostIndex];
    }

    hostPlayer.hasBeenHost = true;

    const remainingPlayers = connectedPlayers.filter((p) => p.socketId !== hostPlayer.socketId);
    const knowIndex = Math.floor(Math.random() * remainingPlayers.length);
    const knowPlayer = remainingPlayers[knowIndex];

    const roles: Record<string, Role> = {};
    room.players.forEach((p) => {
      let role = Role.Unknow;
      if (p.socketId === hostPlayer.socketId) role = Role.Host;
      else if (p.socketId === knowPlayer.socketId) role = Role.Know;

      this.setRole(room, p.socketId, role);
      roles[p.socketId] = role;
      delete p.role;
    });

    room.hostPlayerId = hostPlayer.socketId;

    return { room, roles };
  }

  setWord(
    room: RoomState,
    word: string,
    requesterId: string,
    secretWords: Map<string, string>,
  ): RoomState | null {
    if (room.status !== RoomStatus.WORD_SETTING) return null;

    if (this.getRole(room, requesterId) !== Role.Host) return null;

    const trimmed = word.trim();
    if (!trimmed || trimmed.length > MAX_WORD_LENGTH) return null;

    room.status = RoomStatus.QUESTIONING;
    const timeMs = (room.config.timerMin || 5) * 60 * 1000;
    room.endTime = Date.now() + timeMs;
    secretWords.set(room.code, trimmed);

    return room;
  }

  stopTimer(room: RoomState, requesterId: string): RoomState | null {
    if (room.status !== RoomStatus.QUESTIONING) return null;

    if (this.getRole(room, requesterId) !== Role.Host) return null;

    room.endTime = undefined;
    return room;
  }

  endQuestioning(room: RoomState, requesterId: string, timeout: boolean = false): RoomState | null {
    if (room.status !== RoomStatus.QUESTIONING) return null;

    if (this.getRole(room, requesterId) !== Role.Host) return null;

    if (timeout) {
      room.status = RoomStatus.RESULT;
      room.winner = 'TIMEOUT';
      this.revealRoles(room);
    } else {
      room.status = RoomStatus.VOTING;
      room.votes = {};
    }
    room.endTime = undefined;

    return room;
  }

  handleQuestioningTimeout(room: RoomState): RoomState | null {
    if (room.status !== RoomStatus.QUESTIONING) return null;

    room.status = RoomStatus.RESULT;
    room.winner = 'TIMEOUT';
    room.endTime = undefined;
    this.revealRoles(room);

    return room;
  }

  checkVoteResolution(room: RoomState): boolean {
    if (room.status !== RoomStatus.VOTING) return false;

    const votes = this.privateState.getRoomData<string>(room.code, WK_VOTE);
    const playingCount = room.players.filter(
      (p) => this.getRole(room, p.socketId) !== Role.Host && p.connected !== false,
    ).length;
    const votesCast = votes.size;

    if (playingCount === 0 || (votesCast >= playingCount && playingCount > 0)) {
      room.status = RoomStatus.RESULT;

      const voteCounts: Record<string, number> = {};
      for (const targetId of votes.values()) {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
      }

      let maxVotes = 0;
      let suspectedIds: string[] = [];

      Object.entries(voteCounts).forEach(([id, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          suspectedIds = [id];
        } else if (count === maxVotes) {
          suspectedIds.push(id);
        }
      });

      const insider = room.players.find((p) => this.getRole(room, p.socketId) === Role.Know);
      const isInsiderCaught = insider && suspectedIds.includes(insider.socketId);

      if (isInsiderCaught) {
        room.winner = 'COMMONERS';
        room.players.forEach((p) => {
          const role = this.getRole(room, p.socketId);
          if (role !== Role.Know && role !== Role.Host) p.score += 1;
        });
      } else {
        room.winner = 'INSIDER';
        if (insider) insider.score += 2;
      }

      // Reveal votes and roles at resolution
      room.votes = {};
      for (const [voterId, targetId] of votes.entries()) {
        room.votes[voterId] = targetId;
      }
      this.revealRoles(room);

      return true;
    }
    return false;
  }

  submitVote(room: RoomState, voterId: string, targetId: string): RoomState | null {
    if (room.status !== RoomStatus.VOTING) return null;

    const voter = room.players.find((p) => p.socketId === voterId);
    if (!voter || voter.connected === false) return null;
    if (this.getRole(room, voterId) === Role.Host) return null;
    if (this.privateState.has(room.code, voterId, WK_VOTE)) return null;

    const target = room.players.find((p) => p.socketId === targetId);
    if (!target || target.connected === false) return null;
    if (targetId === voterId) return null;
    if (this.getRole(room, targetId) === Role.Host) return null;

    this.privateState.set(room.code, voterId, WK_VOTE, targetId);

    this.checkVoteResolution(room);

    return room;
  }

  resetGame(
    room: RoomState,
    requesterId: string,
    secretWords: Map<string, string>,
  ): RoomState | null {
    if (room.status !== RoomStatus.RESULT) return null;
    if (room.roomHostId !== requesterId) return null;

    room.status = RoomStatus.LOBBY;
    room.votes = undefined;
    room.endTime = undefined;
    room.winner = undefined;
    room.hostPlayerId = undefined;

    this.clearRoles(room);
    room.players.forEach((p) => {
      delete p.role;
      this.privateState.delete(room.code, p.socketId, WK_VOTE);
    });

    secretWords.delete(room.code);
    return room;
  }
}
