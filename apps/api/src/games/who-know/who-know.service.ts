import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus, Role, UserState } from '@repo/types';

@Injectable()
export class WhoKnowService {
  assignRoles(
    room: RoomState,
    requesterId: string,
  ): { room: RoomState; roles: Record<string, Role> } | null {
    if (room.players.length < 4) return null;
    if (room.roomHostId !== requesterId) return null;

    room.status = RoomStatus.WORD_SETTING;

    // Assign Host based on config
    let hostPlayer: UserState;

    if (room.config.hostSelection === 'FIXED') {
      hostPlayer = room.players.find((p) => p.socketId === room.roomHostId) || room.players[0];
    } else if (room.config.hostSelection === 'RANDOM') {
      const hostIndex = Math.floor(Math.random() * room.players.length);
      hostPlayer = room.players[hostIndex];
    } else {
      let eligibleHosts = room.players.filter((p) => !p.hasBeenHost);
      if (eligibleHosts.length === 0) {
        room.players.forEach((p) => (p.hasBeenHost = false));
        eligibleHosts = room.players;
      }
      const hostIndex = Math.floor(Math.random() * eligibleHosts.length);
      hostPlayer = eligibleHosts[hostIndex];
    }

    hostPlayer.hasBeenHost = true;

    const remainingPlayers = room.players.filter((p) => p.socketId !== hostPlayer.socketId);
    const knowIndex = Math.floor(Math.random() * remainingPlayers.length);
    const knowPlayer = remainingPlayers[knowIndex];

    const roles: Record<string, Role> = {};
    room.players.forEach((p) => {
      let role = Role.Unknow;
      if (p.socketId === hostPlayer.socketId) role = Role.Host;
      else if (p.socketId === knowPlayer.socketId) role = Role.Know;

      p.role = role;
      roles[p.socketId] = role;
    });

    return { room, roles };
  }

  setWord(
    room: RoomState,
    word: string,
    requesterId: string,
    secretWords: Map<string, string>,
  ): RoomState | null {
    if (room.status !== RoomStatus.WORD_SETTING) return null;

    const player = room.players.find((p) => p.socketId === requesterId);
    if (!player || player.role !== Role.Host) return null;

    room.status = RoomStatus.QUESTIONING;
    const timeMs = (room.config.timerMin || 5) * 60 * 1000;
    room.endTime = Date.now() + timeMs;
    secretWords.set(room.code, word);

    return room;
  }

  stopTimer(room: RoomState, requesterId: string): RoomState | null {
    if (room.status !== RoomStatus.QUESTIONING) return null;

    const player = room.players.find((p) => p.socketId === requesterId);
    if (!player || player.role !== Role.Host) return null;

    room.endTime = undefined;
    return room;
  }

  endQuestioning(room: RoomState, requesterId: string, timeout: boolean = false): RoomState | null {
    if (room.status !== RoomStatus.QUESTIONING) return null;

    const player = room.players.find((p) => p.socketId === requesterId);
    if (!player || player.role !== Role.Host) return null;

    if (timeout) {
      room.status = RoomStatus.RESULT;
      room.winner = 'TIMEOUT';
    } else {
      room.status = RoomStatus.VOTING;
      room.votes = {};
    }
    room.endTime = undefined;

    return room;
  }

  checkVoteResolution(room: RoomState): boolean {
    if (room.status !== RoomStatus.VOTING || !room.votes) return false;

    const playingCount = room.players.filter(
      (p) => p.role !== Role.Host && p.connected !== false,
    ).length;
    const votesCast = Object.keys(room.votes).length;

    if (playingCount === 0 || (votesCast >= playingCount && playingCount > 0)) {
      room.status = RoomStatus.RESULT;

      const voteCounts = Object.values(room.votes).reduce(
        (acc, votedForId) => {
          acc[votedForId] = (acc[votedForId] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

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

      const insider = room.players.find((p) => p.role === Role.Know);
      const isInsiderCaught = insider && suspectedIds.includes(insider.socketId);

      if (isInsiderCaught) {
        room.winner = 'COMMONERS';
        room.players.forEach((p) => {
          if (p.role !== Role.Know && p.role !== Role.Host) p.score += 1;
        });
      } else {
        room.winner = 'INSIDER';
        if (insider) insider.score += 2;
      }
      return true;
    }
    return false;
  }

  submitVote(room: RoomState, voterId: string, targetId: string): RoomState | null {
    if (room.status !== RoomStatus.VOTING) return null;

    const voter = room.players.find((p) => p.socketId === voterId);
    if (!voter || voter.role === Role.Host) return null;

    if (!room.votes) room.votes = {};
    if (room.votes[voterId] !== undefined) return null;

    room.votes[voterId] = targetId;

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

    room.players.forEach((p) => {
      p.role = null as unknown as Role;
    });

    secretWords.delete(room.code);
    return room;
  }
}
