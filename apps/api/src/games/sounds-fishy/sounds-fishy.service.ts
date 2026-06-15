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

@Injectable()
export class SoundsFishyService {
  async assignRoles(
    room: RoomState,
    requesterId: string,
  ): Promise<{ room: RoomState; roles: Record<string, Role> } | null> {
    if (room.players.length < 3) return null; // Need at least 3 players
    if (room.roomHostId !== requesterId) return null;

    const lang = room.config.language || 'th';
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
    const questionRecord = questionsWithMinCount[randomIndex];

    // Increment query_count for the chosen question
    if (questionRecord) {
      await prisma.soundsFishyQuestion.update({
        where: { id: questionRecord.id },
        data: { query_count: { increment: 1 } },
      });
    }

    // Assign roles randomly
    // 1 Picker, 1 Blue Fish, rest are Red Herrings
    const shuffledPlayers = [...room.players].sort(() => 0.5 - Math.random());
    const picker = shuffledPlayers[0];
    const blueFish = shuffledPlayers[1];
    const redHerrings = shuffledPlayers.slice(2);

    const questionData: SoundsFishyQuestionData = {
      id: questionRecord.id,
      question: questionRecord.question,
      answer: questionRecord.answer,
      lang: questionRecord.lang,
    };

    const state: SoundsFishyState = {
      currentPhase: SoundsFishyPhase.SETUP,
      pickerId: picker.socketId,
      blueFishId: blueFish.socketId,
      redHerringIds: redHerrings.map((p) => p.socketId),
      question: questionData,
      playerAnswers: {},
      eliminatedPlayers: [],
      roundScorePool: 0,
      roundPoints: {},
      typingAnswers: {},
    };

    room.status = RoomStatus.QUESTIONING;
    room.soundsFishyState = state;

    // Clear previous generic roles if any, maybe assign host?
    // Usually host is picker for display consistency in other places, but let's just leave role as null.
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

    if (playerId === state.pickerId) return null;

    state.typingAnswers[playerId] = answer;

    return room;
  }

  checkAnswerResolution(room: RoomState): boolean {
    if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== SoundsFishyPhase.SETUP)
      return false;
    const state = room.soundsFishyState;

    // Check if everyone has answered
    const requiredAnswersCount = room.players.filter(
      (p) => p.socketId !== state.pickerId && p.connected !== false,
    ).length;
    if (
      Object.keys(state.playerAnswers).length >= requiredAnswersCount &&
      requiredAnswersCount > 0
    ) {
      // Transition to SUBMISSION/PITCH phase
      state.currentPhase = SoundsFishyPhase.THE_PITCH;
      return true;
    }
    return false;
  }

  submitAnswer(room: RoomState, playerId: string, answer: string): RoomState | null {
    if (!room.soundsFishyState || room.soundsFishyState.currentPhase !== SoundsFishyPhase.SETUP)
      return null;
    const state = room.soundsFishyState;

    if (playerId === state.pickerId) return null; // Picker doesn't answer

    // Validate that answer is not exactly the truth
    if (state.redHerringIds.includes(playerId)) {
      if (answer.toLowerCase().trim() === state.question?.answer.toLowerCase().trim()) {
        return null; // Return null to indicate error (can enhance gateway to give specific message)
      }
    }

    if (state.typingAnswers) delete state.typingAnswers[playerId];

    state.playerAnswers[playerId] = {
      playerId,
      answer,
      isRevealed: false,
    };

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
    if (!state.playerAnswers[targetId]) return null;
    if (state.eliminatedPlayers.includes(targetId)) return null; // Can't reveal eliminated players
    if (state.playerAnswers[targetId].isRevealed) return null; // Already revealed

    state.playerAnswers[targetId].isRevealed = true;

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

    const nonPickerIds = room.players.map((p) => p.socketId).filter((id) => id !== state.pickerId);
    if (!nonPickerIds.includes(targetId)) return null;

    const allRevealed = nonPickerIds.every((id) => {
      const pData = state.playerAnswers[id];
      return pData && pData.isRevealed;
    });

    if (!allRevealed) return null;

    state.eliminatedPlayers.push(targetId);

    if (targetId === state.blueFishId) {
      // Game over! Picker loses.
      state.roundScorePool = 0;
      // Distribute points
      const survivingRedHerrings = state.redHerringIds.filter(
        (id) => !state.eliminatedPlayers.includes(id),
      ).length;

      const blueFishPlayer = room.players.find((p) => p.socketId === state.blueFishId);
      if (blueFishPlayer) {
        blueFishPlayer.score += survivingRedHerrings;
        state.roundPoints[blueFishPlayer.socketId] = survivingRedHerrings;
      }

      state.redHerringIds.forEach((id) => {
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
    } else if (state.redHerringIds.includes(targetId)) {
      // Correct pick!
      state.roundScorePool += 1;

      // Check if all red herrings are eliminated
      const allRedHerringsEliminated = state.redHerringIds.every((id) =>
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
        state.redHerringIds.forEach((id) => {
          state.roundPoints[id] = 0;
        });
        if (state.blueFishId) state.roundPoints[state.blueFishId] = 0;

        state.currentPhase = SoundsFishyPhase.SCORING;
        room.status = RoomStatus.RESULT;
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
    state.redHerringIds.forEach((id) => {
      state.roundPoints[id] = 0;
    });
    if (state.blueFishId) state.roundPoints[state.blueFishId] = 0;

    state.currentPhase = SoundsFishyPhase.SCORING;
    room.status = RoomStatus.RESULT;

    return room;
  }

  nextRound(room: RoomState, requesterId: string): RoomState | null {
    if (room.status !== RoomStatus.RESULT) return null;
    if (room.roomHostId !== requesterId) return null;

    room.status = RoomStatus.LOBBY;
    delete room.soundsFishyState;

    return room;
  }
}
