import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus, RPSChoice, RPSState, GameType, Role } from '@repo/types';
import { PrivateStateService } from '../private-state.service';

const RPS_CHOICE_KEY = 'rpsChoice';
const VALID_CHOICES: RPSChoice[] = ['ROCK', 'PAPER', 'SCISSORS'];

@Injectable()
export class RPSService {
  constructor(private readonly privateState: PrivateStateService) {}

  assignRoles(
    room: RoomState,
    requesterId: string,
  ): { room: RoomState; roles: Record<string, Role> } | null {
    if (room.gameType !== GameType.RPS) return null;
    if (room.status !== RoomStatus.LOBBY && room.status !== RoomStatus.RESULT) return null;
    if (room.roomHostId !== requesterId) return null;

    if (!room.rpsState) return null;

    const connectedIds = room.players
      .filter((p) => p.connected !== false && !p.isViewer)
      .map((p) => p.socketId);
    if (connectedIds.length < 2) return null;

    room.status = RoomStatus.PLAYING;

    if (room.config.rpsMode === 'ALL_AT_ONCE') {
      room.rpsState.activePlayers = [...connectedIds];
      room.rpsState.queue = [];
    } else {
      room.rpsState.activePlayers = connectedIds.slice(0, 2);
      room.rpsState.queue = connectedIds.slice(2);
    }

    room.rpsState.choices = {};
    room.rpsState.choicesMade = [];
    room.rpsState.scores = {};
    connectedIds.forEach((id) => (room.rpsState!.scores[id] = 0));
    room.rpsState.gameWinner = undefined;
    room.rpsState.roundWinner = undefined;

    for (const id of connectedIds) {
      this.privateState.delete(room.code, id, RPS_CHOICE_KEY);
    }

    return { room, roles: {} };
  }

  makeChoice(room: RoomState, clientId: string, choice: RPSChoice): RoomState | null {
    if (room.gameType !== GameType.RPS || room.status !== RoomStatus.PLAYING) return null;

    const rps = room.rpsState;
    if (!rps || rps.gameWinner) return null;
    if (!VALID_CHOICES.includes(choice)) return null;
    if (!rps.activePlayers.includes(clientId)) return null;
    if (this.privateState.has(room.code, clientId, RPS_CHOICE_KEY)) return null; // Choice locked

    this.privateState.set(room.code, clientId, RPS_CHOICE_KEY, choice);
    if (!rps.choicesMade.includes(clientId)) {
      rps.choicesMade.push(clientId);
    }

    const activeAndConnectedIds = rps.activePlayers.filter((id) =>
      room.players.find((p) => p.socketId === id && p.connected !== false),
    );
    const allChosen = activeAndConnectedIds.every((id) =>
      this.privateState.has(room.code, id, RPS_CHOICE_KEY),
    );

    if (allChosen && activeAndConnectedIds.length > 0) {
      const revealed = this.revealChoices(room);
      if (room.config.rpsMode === 'ALL_AT_ONCE') {
        this.resolveAllAtOnceRound(room, revealed);
      } else {
        this.resolve1v1Round(room, revealed);
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
    } else if (activeAndConnectedIds.length === 0) {
      // Everyone left — resolve as a draw so the room is not stuck forever
      rps.roundWinner = 'DRAW';
      room.status = RoomStatus.RESULT;
    }

    return room;
  }

  private revealChoices(room: RoomState): Record<string, RPSChoice> {
    const taken = this.privateState.takeRoomData<RPSChoice>(room.code, RPS_CHOICE_KEY);
    const revealed: Record<string, RPSChoice> = {};
    for (const [socketId, choice] of taken.entries()) {
      revealed[socketId] = choice;
    }
    room.rpsState!.choices = revealed;
    return revealed;
  }

  private addScore(room: RoomState, socketId: string, amount: number): void {
    const rps = room.rpsState!;
    rps.scores[socketId] = (rps.scores[socketId] || 0) + amount;
    const player = room.players.find((p) => p.socketId === socketId);
    if (player) player.score += amount;
  }

  private resolve1v1Round(room: RoomState, revealed: Record<string, RPSChoice>) {
    const rps = room.rpsState!;
    const [p1, p2] = rps.activePlayers;
    const c1 = revealed[p1];
    const c2 = revealed[p2];

    if (!c1 || !c2) {
      rps.roundWinner = c1 ? p1 : c2 ? p2 : 'DRAW';
      if (c1 && !c2) {
        this.addScore(room, p1, 1);
        if (rps.queue.length > 0) {
          rps.queue.push(p2);
          rps.activePlayers[1] = rps.queue.shift()!;
        }
      } else if (c2 && !c1) {
        this.addScore(room, p2, 1);
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
      this.addScore(room, p1, 1);

      if (rps.queue.length > 0) {
        rps.queue.push(p2);
        rps.activePlayers[1] = rps.queue.shift()!;
      }
    } else {
      rps.roundWinner = p2;
      this.addScore(room, p2, 1);

      if (rps.queue.length > 0) {
        rps.queue.push(p1);
        rps.activePlayers[0] = rps.queue.shift()!;
      }
    }
  }

  private resolveAllAtOnceRound(room: RoomState, revealed: Record<string, RPSChoice>) {
    const rps = room.rpsState!;
    const choicesList = Object.values(revealed);

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
    Object.entries(revealed).forEach(([id, choice]) => {
      if (choice === winningSymbol) {
        winners.push(id);
        this.addScore(room, id, 1);
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
    room.rpsState.choicesMade = [];
    for (const id of room.rpsState.activePlayers) {
      this.privateState.delete(room.code, id, RPS_CHOICE_KEY);
    }
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
      choicesMade: [],
      scores: {},
      gameWinner: undefined,
      roundWinner: undefined,
    };
    for (const p of room.players) {
      this.privateState.delete(room.code, p.socketId, RPS_CHOICE_KEY);
    }

    room.players.forEach((p) => (p.score = 0));

    return room;
  }

  /** Re-point every socket-id reference to the new socket id on reconnection. */
  remapSocketId(state: RPSState, oldSocketId: string, newSocketId: string): void {
    const remapInArray = (ids: string[]) =>
      ids.map((id) => (id === oldSocketId ? newSocketId : id));
    const remapWinner = (winner: string | string[] | undefined): string | string[] | undefined => {
      if (winner === undefined) return undefined;
      if (Array.isArray(winner)) return remapInArray(winner);
      return winner === oldSocketId ? newSocketId : winner;
    };

    state.activePlayers = remapInArray(state.activePlayers);
    state.queue = remapInArray(state.queue);
    state.choicesMade = remapInArray(state.choicesMade);

    if (state.choices[oldSocketId]) {
      state.choices[newSocketId] = state.choices[oldSocketId];
      delete state.choices[oldSocketId];
    }

    if (state.scores[oldSocketId] !== undefined) {
      state.scores[newSocketId] = state.scores[oldSocketId];
      delete state.scores[oldSocketId];
    }

    state.gameWinner = remapWinner(state.gameWinner);
    state.roundWinner = remapWinner(state.roundWinner);
  }
}
