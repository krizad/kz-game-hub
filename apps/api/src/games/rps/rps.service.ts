import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus, RPSChoice, GameType, Role } from '@repo/types';

@Injectable()
export class RPSService {
  assignRoles(
    room: RoomState,
    requesterId: string,
  ): { room: RoomState; roles: Record<string, Role> } | null {
    if (room.players.length < 2) return null;
    if (room.roomHostId !== requesterId) return null;

    if (!room.rpsState) return null;

    room.status = RoomStatus.PLAYING;

    const allPlayerIds = room.players.map((p) => p.socketId);

    if (room.config.rpsMode === 'ALL_AT_ONCE') {
      room.rpsState.activePlayers = [...allPlayerIds];
      room.rpsState.queue = [];
    } else {
      room.rpsState.activePlayers = allPlayerIds.slice(0, 2);
      room.rpsState.queue = allPlayerIds.slice(2);
    }

    room.rpsState.choices = {};
    room.rpsState.scores = {};
    allPlayerIds.forEach((id) => (room.rpsState!.scores[id] = 0));
    room.rpsState.gameWinner = undefined;
    room.rpsState.roundWinner = undefined;

    return { room, roles: {} };
  }

  makeChoice(room: RoomState, clientId: string, choice: RPSChoice): RoomState | null {
    if (room.gameType !== GameType.RPS || room.status !== RoomStatus.PLAYING) return null;

    const rps = room.rpsState;
    if (!rps || rps.gameWinner) return null;
    if (!rps.activePlayers.includes(clientId)) return null;

    rps.choices[clientId] = choice;

    const activeAndConnectedIds = rps.activePlayers.filter((id) =>
      room.players.find((p) => p.socketId === id && p.connected !== false),
    );
    const allChosen = activeAndConnectedIds.every((id) => !!rps.choices[id]);

    if (allChosen && activeAndConnectedIds.length > 0) {
      if (room.config.rpsMode === 'ALL_AT_ONCE') {
        this.resolveAllAtOnceRound(room);
      } else {
        this.resolve1v1Round(room);
      }

      const bestOf = room.config.rpsBestOf || 3;
      const targetScore = Math.floor(bestOf / 2) + 1;

      const gameWinners = Object.entries(rps.scores)
        .filter(([, score]) => score >= targetScore)
        .map(([id]) => id);

      if (gameWinners.length > 0) {
        rps.gameWinner = gameWinners.length === 1 ? gameWinners[0] : gameWinners;
      }

      room.status = RoomStatus.RESULT;
    }

    return room;
  }

  private resolve1v1Round(room: RoomState) {
    const rps = room.rpsState!;
    const [p1, p2] = rps.activePlayers;
    const c1 = rps.choices[p1];
    const c2 = rps.choices[p2];

    if (!c1 || !c2) {
      rps.roundWinner = c1 ? p1 : c2 ? p2 : 'DRAW';
      if (c1 && !c2) {
        rps.scores[p1] = (rps.scores[p1] || 0) + 1;
        if (rps.queue.length > 0) {
          rps.queue.push(p2);
          rps.activePlayers[1] = rps.queue.shift()!;
        }
      } else if (c2 && !c1) {
        rps.scores[p2] = (rps.scores[p2] || 0) + 1;
        if (rps.queue.length > 0) {
          rps.queue.push(p1);
          rps.activePlayers[0] = rps.queue.shift()!;
        }
      }
    } else if (c1 === c2) {
      rps.roundWinner = 'DRAW';
    } else if (
      (c1 === 'ROCK' && c2 === 'SCISSORS') ||
      (c1 === 'PAPER' && c2 === 'ROCK') ||
      (c1 === 'SCISSORS' && c2 === 'PAPER')
    ) {
      rps.roundWinner = p1;
      rps.scores[p1] = (rps.scores[p1] || 0) + 1;

      if (rps.queue.length > 0) {
        rps.queue.push(p2);
        rps.activePlayers[1] = rps.queue.shift()!;
      }
    } else {
      rps.roundWinner = p2;
      rps.scores[p2] = (rps.scores[p2] || 0) + 1;

      if (rps.queue.length > 0) {
        rps.queue.push(p1);
        rps.activePlayers[0] = rps.queue.shift()!;
      }
    }
  }

  private resolveAllAtOnceRound(room: RoomState) {
    const rps = room.rpsState!;
    const choicesList = Object.values(rps.choices);

    const hasRock = choicesList.includes('ROCK');
    const hasPaper = choicesList.includes('PAPER');
    const hasScissors = choicesList.includes('SCISSORS');

    if (
      (hasRock && hasPaper && hasScissors) ||
      (!hasRock && !hasPaper) ||
      (!hasRock && !hasScissors) ||
      (!hasPaper && !hasScissors)
    ) {
      rps.roundWinner = 'DRAW';
      return;
    }

    let winningSymbol: RPSChoice;
    if (hasRock && hasScissors) winningSymbol = 'ROCK';
    else if (hasScissors && hasPaper) winningSymbol = 'SCISSORS';
    else winningSymbol = 'PAPER';

    const winners: string[] = [];
    Object.entries(rps.choices).forEach(([id, choice]) => {
      if (choice === winningSymbol) {
        winners.push(id);
        rps.scores[id] = (rps.scores[id] || 0) + 1;
      }
    });

    rps.roundWinner = winners;
  }

  nextRound(room: RoomState, clientId: string): RoomState | null {
    if (room.gameType !== GameType.RPS || room.status !== RoomStatus.RESULT) return null;
    if (!room.rpsState) return null;

    if (room.roomHostId !== clientId) {
      return null;
    }

    if (room.rpsState.gameWinner) {
      return this.reset(room, clientId);
    }

    room.rpsState.choices = {};
    room.status = RoomStatus.PLAYING;
    return room;
  }

  reset(room: RoomState, clientId: string): RoomState | null {
    if (room.gameType !== GameType.RPS || room.status !== RoomStatus.RESULT) return null;

    if (room.roomHostId !== clientId) {
      return null;
    }

    room.status = RoomStatus.LOBBY;
    room.rpsState = {
      activePlayers: [],
      queue: [],
      choices: {},
      scores: {},
      gameWinner: undefined,
      roundWinner: undefined,
    };

    room.players.forEach((p) => (p.score = 0));

    return room;
  }
}
