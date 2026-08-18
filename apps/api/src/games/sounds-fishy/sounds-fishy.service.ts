import { Injectable } from '@nestjs/common';
import {
  RoomState,
  RoomStatus,
  SoundsFishyPhase,
  SoundsFishyState,
  SoundsFishyQuestionData,
  Role,
} from '@repo/types';
import { prisma } from '@repo/database';
import { PrivateStateService } from '../private-state.service';

const ROOM_KEY = '__room__';
const SF_ROLE = 'sfRole';
const SF_TRUE_ANSWER = 'sfTrueAnswer';
const SF_MY_ANSWER = 'sfMyAnswer';
const SF_ROOM_TRUE_ANSWER = 'sfRoomTrueAnswer';
const SF_ROOM_BLUE_FISH = 'sfRoomBlueFish';
const SF_ROOM_RED_HERRINGS = 'sfRoomRedHerrings';

const MAX_ANSWER_LENGTH = 200;

@Injectable()
export class SoundsFishyService {
  constructor(private readonly privateState: PrivateStateService) {}

  private shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private isMember(room: RoomState, socketId: string): boolean {
    return room.players.some((p) => p.socketId === socketId);
  }

  private getTrueAnswer(room: RoomState): string {
    return this.privateState.get<string>(room.code, ROOM_KEY, SF_ROOM_TRUE_ANSWER) ?? '';
  }

  private getBlueFishId(room: RoomState): string | null {
    return this.privateState.get<string>(room.code, ROOM_KEY, SF_ROOM_BLUE_FISH) ?? null;
  }

  private getRedHerringIds(room: RoomState): string[] {
    return this.privateState.get<string[]>(room.code, ROOM_KEY, SF_ROOM_RED_HERRINGS) ?? [];
  }

  private revealRoles(room: RoomState): void {
    const state = room.soundsFishyState;
    if (!state) return;
    state.blueFishId =
      this.privateState.get<string>(room.code, ROOM_KEY, SF_ROOM_BLUE_FISH) ?? null;
    state.redHerringIds =
      this.privateState.get<string[]>(room.code, ROOM_KEY, SF_ROOM_RED_HERRINGS) ?? [];
    if (state.question) {
      state.question.answer = this.getTrueAnswer(room);
    }
  }

  async assignRoles(
    room: RoomState,
    requesterId: string,
  ): Promise<{ room: RoomState; roles: Record<string, Role> } | null> {
    const connectedPlayers = room.players.filter((p) => p.connected !== false);
    if (connectedPlayers.length < 3) return null; // Need at least 3 players
    if (room.roomHostId !== requesterId) return null;

    const lang = room.config.language || 'th';

    let questionRecord: {
      id: string;
      question: string;
      answer: string;
      lang: string;
    } | null = null;
    try {
      const minQueryCountResult = await prisma.soundsFishyQuestion.aggregate({
        where: { lang },
        _min: { query_count: true },
      });

      // If no questions in DB
      if (minQueryCountResult._min.query_count === null) return null;

      const minQueryCount = minQueryCountResult._min.query_count;

      const questionsWithMinCount = await prisma.soundsFishyQuestion.findMany({
        where: { lang, query_count: minQueryCount },
        select: { id: true, question: true, answer: true, lang: true },
      });

      if (questionsWithMinCount.length === 0) return null;

      const randomIndex = Math.floor(Math.random() * questionsWithMinCount.length);
      questionRecord = questionsWithMinCount[randomIndex];

      // Increment query_count for the chosen question
      if (questionRecord) {
        await prisma.soundsFishyQuestion.update({
          where: { id: questionRecord.id },
          data: { query_count: { increment: 1 } },
        });
      }
    } catch {
      return null;
    }

    if (!questionRecord) return null;

    // Assign roles randomly among connected players
    // 1 Picker, 1 Blue Fish, rest are Red Herrings
    const shuffledPlayers = this.shuffleArray(connectedPlayers);
    const picker = shuffledPlayers[0];
    const blueFish = shuffledPlayers[1];
    const redHerrings = shuffledPlayers.slice(2);

    // Store secrets server-side only
    for (const p of connectedPlayers) {
      const role =
        p.socketId === picker.socketId
          ? 'PICKER'
          : p.socketId === blueFish.socketId
            ? 'BLUE_FISH'
            : 'RED_HERRING';
      this.privateState.set(room.code, p.socketId, SF_ROLE, role);
      if (role !== 'PICKER') {
        this.privateState.set(room.code, p.socketId, SF_TRUE_ANSWER, questionRecord.answer);
      }
    }
    this.privateState.set(room.code, ROOM_KEY, SF_ROOM_TRUE_ANSWER, questionRecord.answer);
    this.privateState.set(room.code, ROOM_KEY, SF_ROOM_BLUE_FISH, blueFish.socketId);
    this.privateState.set(
      room.code,
      ROOM_KEY,
      SF_ROOM_RED_HERRINGS,
      redHerrings.map((p) => p.socketId),
    );

    const questionData: SoundsFishyQuestionData = {
      id: questionRecord.id,
      question: questionRecord.question,
      lang: questionRecord.lang,
    };

    const state: SoundsFishyState = {
      currentPhase: SoundsFishyPhase.SETUP,
      pickerId: picker.socketId,
      blueFishId: null,
      redHerringIds: [],
      question: questionData,
      playerAnswers: {},
      answeredPlayerIds: [],
      eliminatedPlayers: [],
      roundScorePool: 0,
      roundPoints: {},
      typingAnswers: {},
    };

    room.status = RoomStatus.QUESTIONING;
    room.soundsFishyState = state;

    const roles: Record<string, Role> = {};
    room.players.forEach((p) => {
      p.role = null as unknown as Role;
      roles[p.socketId] = p.role;
    });

    return { room, roles };
  }

  typeAnswer(room: RoomState, playerId: string, answer: string): RoomState | null {
    if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== SoundsFishyPhase.SETUP)
      return null;
    const state = room.soundsFishyState;

    if (!this.isMember(room, playerId)) return null;
    if (playerId === state.pickerId) return null;

    state.typingAnswers[playerId] = answer.slice(0, MAX_ANSWER_LENGTH);

    return room;
  }

  checkAnswerResolution(room: RoomState): boolean {
    if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== SoundsFishyPhase.SETUP)
      return false;
    const state = room.soundsFishyState;

    const requiredAnswersCount = room.players.filter(
      (p) => p.socketId !== state.pickerId && p.connected !== false,
    ).length;
    const answeredCount = this.privateState.getRoomData(room.code, SF_MY_ANSWER).size;
    if (answeredCount >= requiredAnswersCount && requiredAnswersCount > 0) {
      state.currentPhase = SoundsFishyPhase.THE_PITCH;
      return true;
    }
    return false;
  }

  submitAnswer(room: RoomState, playerId: string, answer: string): RoomState | null {
    if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== SoundsFishyPhase.SETUP)
      return null;
    const state = room.soundsFishyState;

    if (!this.isMember(room, playerId)) return null;
    if (playerId === state.pickerId) return null; // Picker doesn't answer
    if (this.privateState.has(room.code, playerId, SF_MY_ANSWER)) return null; // No resubmission

    const trimmed = answer.trim().slice(0, MAX_ANSWER_LENGTH);
    if (!trimmed) return null;

    const trueAnswer = this.getTrueAnswer(room).trim().toLowerCase();
    const normalized = trimmed.toLowerCase();

    if (playerId === this.getBlueFishId(room)) {
      if (normalized !== trueAnswer) return null; // Blue fish must enter the true answer
    } else if (this.getRedHerringIds(room).includes(playerId)) {
      if (normalized === trueAnswer) return null; // Red herring must not copy the truth
    }

    if (state.typingAnswers) delete state.typingAnswers[playerId];

    this.privateState.set(room.code, playerId, SF_MY_ANSWER, { playerId, answer: trimmed });
    if (!state.answeredPlayerIds.includes(playerId)) {
      state.answeredPlayerIds.push(playerId);
    }

    this.checkAnswerResolution(room);

    return room;
  }

  revealPlayer(room: RoomState, pickerId: string, targetId: string): RoomState | null {
    if (!room.soundsFishyState) return null;
    const state = room.soundsFishyState;

    if (
      state.currentPhase !== SoundsFishyPhase.THE_PITCH &&
      state.currentPhase !== SoundsFishyPhase.THE_HUNT
    )
      return null;
    if (pickerId !== state.pickerId) return null;
    if (!this.isMember(room, targetId)) return null;
    if (state.eliminatedPlayers.includes(targetId)) return null; // Can't reveal eliminated players
    if (state.playerAnswers[targetId]) return null; // Already revealed

    const privateAnswer = this.privateState.get<{ playerId: string; answer: string }>(
      room.code,
      targetId,
      SF_MY_ANSWER,
    );
    if (!privateAnswer) return null;

    state.playerAnswers[targetId] = {
      playerId: targetId,
      answer: privateAnswer.answer,
      isRevealed: true,
    };

    // Allow elimination once at least one player is revealed
    state.currentPhase = SoundsFishyPhase.THE_HUNT;

    return room;
  }

  eliminatePlayer(room: RoomState, pickerId: string, targetId: string): RoomState | null {
    if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== SoundsFishyPhase.THE_HUNT)
      return null;
    const state = room.soundsFishyState;

    if (pickerId !== state.pickerId) return null;
    if (targetId === state.pickerId) return null;
    if (state.eliminatedPlayers.includes(targetId)) return null;

    const nonPickerIds = room.players
      .filter((p) => p.connected !== false)
      .map((p) => p.socketId)
      .filter((id) => id !== state.pickerId);
    if (!nonPickerIds.includes(targetId)) return null;

    const allRevealed = nonPickerIds.every((id) => state.playerAnswers[id]?.isRevealed);

    if (!allRevealed) return null;

    state.eliminatedPlayers.push(targetId);

    const blueFishId = this.getBlueFishId(room);
    const redHerringIds = this.getRedHerringIds(room);

    if (targetId === blueFishId) {
      // Game over! Picker loses.
      state.roundScorePool = 0;
      // Distribute points
      const survivingRedHerrings = redHerringIds.filter(
        (id) => !state.eliminatedPlayers.includes(id),
      ).length;

      const blueFishPlayer = room.players.find((p) => p.socketId === blueFishId);
      if (blueFishPlayer) {
        blueFishPlayer.score += survivingRedHerrings;
        state.roundPoints[blueFishPlayer.socketId] = survivingRedHerrings;
      }

      redHerringIds.forEach((id) => {
        if (!state.eliminatedPlayers.includes(id)) {
          const p = room.players.find((player) => player.socketId === id);
          if (p) {
            p.score += 1;
            state.roundPoints[p.socketId] = 1;
          }
        } else {
          state.roundPoints[id] = 0;
        }
      });
      state.roundPoints[state.pickerId] = 0;

      state.currentPhase = SoundsFishyPhase.SCORING;
      room.status = RoomStatus.RESULT;
      this.revealRoles(room);
    } else if (redHerringIds.includes(targetId)) {
      // Correct pick!
      state.roundScorePool += 1;

      // Check if all red herrings are eliminated
      const allRedHerringsEliminated = redHerringIds.every((id) =>
        state.eliminatedPlayers.includes(id),
      );
      if (allRedHerringsEliminated) {
        // Auto bank points
        const pickerPlayer = room.players.find((p) => p.socketId === state.pickerId);
        if (pickerPlayer) {
          pickerPlayer.score += state.roundScorePool;
          state.roundPoints[pickerPlayer.socketId] = state.roundScorePool;
        }

        // Red herrings and blue fish get 0 points since picker won
        redHerringIds.forEach((id) => {
          state.roundPoints[id] = 0;
        });
        if (blueFishId) state.roundPoints[blueFishId] = 0;

        state.currentPhase = SoundsFishyPhase.SCORING;
        room.status = RoomStatus.RESULT;
        this.revealRoles(room);
      }
    }

    return room;
  }

  bankPoints(room: RoomState, pickerId: string): RoomState | null {
    if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== SoundsFishyPhase.THE_HUNT)
      return null;
    const state = room.soundsFishyState;

    if (pickerId !== state.pickerId) return null;
    if (state.roundScorePool === 0) return null;

    const pickerPlayer = room.players.find((p) => p.socketId === state.pickerId);
    if (pickerPlayer) {
      pickerPlayer.score += state.roundScorePool;
      state.roundPoints[pickerPlayer.socketId] = state.roundScorePool;
    }

    // Others get 0
    this.getRedHerringIds(room).forEach((id) => {
      state.roundPoints[id] = 0;
    });
    const blueFishId = this.getBlueFishId(room);
    if (blueFishId) state.roundPoints[blueFishId] = 0;

    state.currentPhase = SoundsFishyPhase.SCORING;
    room.status = RoomStatus.RESULT;
    this.revealRoles(room);

    return room;
  }

  nextRound(room: RoomState, requesterId: string): RoomState | null {
    if (room.status !== RoomStatus.RESULT) return null;
    if (room.roomHostId !== requesterId) return null;

    room.status = RoomStatus.LOBBY;
    delete room.soundsFishyState;
    this.privateState.clearRoom(room.code);

    return room;
  }
}
