import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus, WhoAmIGameState, WordCategory } from '@repo/types';
import { prisma } from '@repo/database';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class WhoAmIService {
  // ─── Categories from DB ────────────────────────────────────────────
  async getCategories(lang?: string): Promise<WordCategory[]> {
    if (lang) {
      const results = await prisma.word.groupBy({
        by: ['category'],
        _count: { id: true },
        where: { lang },
      });
      return results.map((r) => ({ name: r.category, count: r._count.id }));
    }
    const results = await prisma.word.groupBy({
      by: ['category'],
      _count: { id: true },
    });
    return results.map((r) => ({ name: r.category, count: r._count.id }));
  }

  // ─── Start Game (HOST_INPUT mode) ─────────────────────────────────
  startGameHostInput(
    room: RoomState,
    requesterId: string,
    playerWords: Record<string, string>,
  ): RoomState | null {
    if (room.roomHostId !== requesterId) return null;
    if (room.config.wordMode !== 'HOST_INPUT') return null;

    // Host does NOT play in HOST_INPUT mode
    const gamePlayers = room.players.filter((p) => p.socketId !== requesterId);
    if (gamePlayers.length < 2) return null;

    // Verify words provided for all non-host players
    for (const p of gamePlayers) {
      if (!playerWords[p.socketId]?.trim()) return null;
    }

    room.status = RoomStatus.PLAYING;

    const shuffled = [...gamePlayers].sort(() => Math.random() - 0.5);

    const gameState: WhoAmIGameState = {
      currentTurn: shuffled[0].socketId,
      playerWords,
      currentGuess: null,
      votes: {},
      turnStatus: 'VOTING',
      winner: null,
      currentRound: 1,
      maxRounds: room.config.maxRounds || 3,
      eliminatedPlayers: [],
      phase: 'ASKING',
      finalGuessUsed: [],
    };

    room.whoAmIState = gameState;
    return room;
  }

  // ─── Start Game (AI_GENERATED mode) ───────────────────────────────
  async startGameAiGenerated(room: RoomState, requesterId: string): Promise<RoomState | null> {
    if (room.roomHostId !== requesterId) return null;
    if (room.config.wordMode !== 'AI_GENERATED') return null;
    if (room.players.length < 2) return null;

    const lang = room.config.language || 'th';
    const isThai = lang === 'th';
    const langLabel = isThai ? 'Thai' : 'English';
    const example = isThai
      ? '["หมูปิ้ง", "ช้าง", "นายกรัฐมนตรี"]'
      : '["Elephant", "Harry Potter", "Pizza"]';

    const promptCategory = room.config.wordCategory || (isThai ? 'สิ่งของรอบตัว' : 'Random things');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are an expert game master generating words for the game "Who Am I".
Target Language: ${langLabel}
Category: "${promptCategory}"
Count: ${room.players.length} words

RULES:
1. Output MUST be strictly NOUNS (animals, objects, places, famous people) or VERBS (actions).
2. NEVER output a full sentence, explanation, or long phrase. Keep each item to 1-3 words MAXIMUM.
3. The words should be recognizable by an average person, but creative and fun to guess.
4. Provide the output as a valid JSON array of strings.

GOOD EXAMPLES: ${example}
BAD EXAMPLES: ["A big animal with a trunk", "Running in the park", "The man who invented electricity"]

Output ONLY a JSON array containing exactly ${room.players.length} strings. No markdown formatting.`;

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
      } catch {
        console.log('gemini-2.5-flash failed, falling back to gemini-1.5-flash...');
        response = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
      }

      const responseText = response.text;
      let words: string[] = [];
      try {
        // Strip markdown if AI somehow includes it despite instructions
        const cleanText = responseText
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        words = JSON.parse(cleanText);
      } catch {
        console.error('Failed to parse AI response', responseText);
        return null;
      }

      if (!Array.isArray(words) || words.length < room.players.length) {
        return null; // Fallback or handle error
      }

      // Asynchronously insert generated words into DB
      Promise.resolve().then(async () => {
        try {
          const existingWords = await prisma.word.findMany({
            where: {
              category: promptCategory,
              lang: lang,
              word: { in: words },
            },
            select: { word: true },
          });
          const existingSet = new Set(existingWords.map((w) => w.word.toLowerCase()));
          const newWords = words.filter((w) => !existingSet.has(w.toLowerCase()));

          if (newWords.length > 0) {
            await prisma.word.createMany({
              data: newWords.map((w) => ({
                word: w,
                category: promptCategory,
                lang: lang,
              })),
            });
          }
        } catch (dbError) {
          console.error('Failed to save AI words to DB:', dbError);
        }
      });

      room.status = RoomStatus.PLAYING;

      const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);
      const playerWords: Record<string, string> = {};
      shuffledPlayers.forEach((p, idx) => {
        playerWords[p.socketId] = words[idx];
      });

      const gameState: WhoAmIGameState = {
        currentTurn: shuffledPlayers[0].socketId,
        playerWords,
        currentGuess: null,
        votes: {},
        turnStatus: 'VOTING',
        winner: null,
        currentRound: 1,
        maxRounds: room.config.maxRounds || 3,
        eliminatedPlayers: [],
        phase: 'ASKING',
        finalGuessUsed: [],
      };

      room.whoAmIState = gameState;
      return room;
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      console.log('Falling back to database for words...');

      const lang = room.config.language || 'en';
      const category =
        room.config.wordCategory || (lang === 'th' ? 'สิ่งของรอบตัว' : 'Random things');

      const dbWords = await prisma.$queryRawUnsafe<{ word: string; emoji: string | null }[]>(
        `SELECT word, emoji FROM "Word" WHERE category = $1 AND lang = $2 ORDER BY RANDOM() LIMIT $3`,
        category,
        lang,
        room.players.length,
      );

      if (dbWords.length < room.players.length) return null; // not enough words in DB

      room.status = RoomStatus.PLAYING;
      const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);
      const playerWords: Record<string, string> = {};
      shuffledPlayers.forEach((p, idx) => {
        const w = dbWords[idx];
        playerWords[p.socketId] = w.emoji ? `${w.emoji} ${w.word}` : w.word;
      });

      const gameState: WhoAmIGameState = {
        currentTurn: shuffledPlayers[0].socketId,
        playerWords,
        currentGuess: null,
        votes: {},
        turnStatus: 'VOTING',
        winner: null,
        currentRound: 1,
        maxRounds: room.config.maxRounds || 3,
        eliminatedPlayers: [],
        phase: 'ASKING',
        finalGuessUsed: [],
      };

      room.whoAmIState = gameState;
      return room;
    }
  }

  // ─── Start Game (RANDOM mode) ─────────────────────────────────────
  async startGameRandom(room: RoomState, requesterId: string): Promise<RoomState | null> {
    if (room.roomHostId !== requesterId) return null;
    if (room.config.wordMode !== 'RANDOM') return null;
    if (room.players.length < 2) return null;

    const category = room.config.wordCategory;
    if (!category) return null;

    const lang = room.config.language || 'en';

    const words = await prisma.$queryRawUnsafe<{ word: string; emoji: string | null }[]>(
      `SELECT word, emoji FROM "Word" WHERE category = $1 AND lang = $2 ORDER BY RANDOM() LIMIT $3`,
      category,
      lang,
      room.players.length,
    );

    if (words.length < room.players.length) return null; // not enough words in DB

    room.status = RoomStatus.PLAYING;

    const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);
    const playerWords: Record<string, string> = {};
    shuffledPlayers.forEach((p, idx) => {
      const w = words[idx];
      playerWords[p.socketId] = w.emoji ? `${w.emoji} ${w.word}` : w.word;
    });

    const gameState: WhoAmIGameState = {
      currentTurn: shuffledPlayers[0].socketId,
      playerWords,
      currentGuess: null,
      votes: {},
      turnStatus: 'VOTING',
      winner: null,
      currentRound: 1,
      maxRounds: room.config.maxRounds || 3,
      eliminatedPlayers: [],
      phase: 'ASKING',
      finalGuessUsed: [],
    };

    room.whoAmIState = gameState;
    return room;
  }

  // ─── Start Game (HOST_INPUT) — waiting for host to submit all words ─
  startGameAwaitHostInput(room: RoomState, requesterId: string): RoomState | null {
    if (room.roomHostId !== requesterId) return null;
    if (room.config.wordMode !== 'HOST_INPUT') return null;
    if (room.players.length < 3) return null; // host + at least 2 players

    const gamePlayers = room.players.filter((p) => p.socketId !== requesterId);
    if (gamePlayers.length < 2) return null;

    room.status = RoomStatus.PLAYING;

    const gameState: WhoAmIGameState = {
      currentTurn: '',
      playerWords: {},
      currentGuess: null,
      votes: {},
      turnStatus: 'VOTING',
      winner: null,
      currentRound: 1,
      maxRounds: room.config.maxRounds || 3,
      eliminatedPlayers: [],
      phase: 'AWAITING_HOST_INPUT',
      finalGuessUsed: [],
    };

    room.whoAmIState = gameState;
    return room;
  }

  // ─── Start Game (PLAYER_INPUT) — enter COLLECTING_WORDS phase ─────
  startGamePlayerInput(room: RoomState, requesterId: string): RoomState | null {
    if (room.roomHostId !== requesterId) return null;
    if (room.config.wordMode !== 'PLAYER_INPUT') return null;
    if (room.players.length < 2) return null;

    room.status = RoomStatus.PLAYING;

    const gameState: WhoAmIGameState = {
      currentTurn: '',
      playerWords: {},
      currentGuess: null,
      votes: {},
      turnStatus: 'VOTING',
      winner: null,
      currentRound: 1,
      maxRounds: room.config.maxRounds || 3,
      eliminatedPlayers: [],
      phase: 'COLLECTING_WORDS',
      finalGuessUsed: [],
      wordSubmissions: {},
      wordSubmissionCategory: room.config.wordCategory || '',
    };

    room.whoAmIState = gameState;
    return room;
  }

  // ─── Player submits their word (PLAYER_INPUT mode) ────────────────
  submitPlayerWord(
    room: RoomState,
    socketId: string,
    word: string,
  ): { room: RoomState; error?: string } | null {
    if (room.status !== RoomStatus.PLAYING) return null;

    const gameState = room.whoAmIState;
    if (!gameState) return null;
    if (gameState.phase !== 'COLLECTING_WORDS') return null;
    if (!room.players.find((p) => p.socketId === socketId)) return null;

    const trimmedWord = word.trim().toLowerCase();
    if (!trimmedWord) return null;

    // Check for duplicates — compare with other players' submissions (not the submitter's own)
    const submissions = gameState.wordSubmissions || {};
    const duplicateEntries = Object.entries(submissions).filter(
      ([sid, w]) => sid !== socketId && w.toLowerCase() === trimmedWord,
    );

    if (duplicateEntries.length > 0) {
      // Remove all duplicate submissions (including the existing one)
      for (const [sid] of duplicateEntries) {
        delete submissions[sid];
      }
      // Don't store this one either
      gameState.wordSubmissions = submissions;
      return {
        room,
        error: `Duplicate word "${word.trim()}"! All matching submissions have been cleared. Please submit a different word.`,
      };
    }

    // Store submission (keep original casing)
    submissions[socketId] = word.trim();
    gameState.wordSubmissions = submissions;

    // Check if all players have submitted
    const allSubmitted = room.players.every((p) => submissions[p.socketId]?.trim());

    if (allSubmitted) {
      // Shuffle-assign words so nobody gets their own
      this.assignShuffledWords(room, gameState);
    }

    return { room };
  }

  // ─── Shuffle words so no player gets their own ────────────────────
  private assignShuffledWords(room: RoomState, gameState: WhoAmIGameState): void {
    const submissions = gameState.wordSubmissions!;
    const playerIds = room.players.map((p) => p.socketId);
    const words = playerIds.map((id) => submissions[id]);

    // Derangement: shuffle until nobody has their own word
    let shuffled: string[];
    let attempts = 0;
    do {
      shuffled = [...words].sort(() => Math.random() - 0.5);
      attempts++;
      // Safety: after many attempts, force a derangement via cyclic shift
      if (attempts > 100) {
        shuffled = [...words];
        shuffled.push(shuffled.shift()!); // simple cyclic shift guarantees derangement
        break;
      }
    } while (shuffled.some((w, i) => w === words[i]));

    const playerWords: Record<string, string> = {};
    playerIds.forEach((id, i) => {
      playerWords[id] = shuffled[i];
    });

    gameState.playerWords = playerWords;
    gameState.phase = 'ASKING';
    gameState.wordSubmissions = undefined;

    const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);
    gameState.currentTurn = shuffledPlayers[0].socketId;
  }

  // Helper: find next non-eliminated player who (in FINAL_GUESS phase) hasn't used their guess
  private findNextPlayer(
    room: RoomState,
    gameState: WhoAmIGameState,
    afterSocketId: string,
  ): string | null {
    // In HOST_INPUT mode, skip the room host
    const players =
      room.config.wordMode === 'HOST_INPUT'
        ? room.players.filter((p) => p.socketId !== room.roomHostId)
        : room.players;

    const currentIndex = players.findIndex((p) => p.socketId === afterSocketId);
    if (currentIndex === -1) {
      // afterSocketId not in players array — find first valid
      for (const p of players) {
        if (gameState.eliminatedPlayers.includes(p.socketId)) continue;
        if (gameState.phase === 'FINAL_GUESS' && gameState.finalGuessUsed.includes(p.socketId))
          continue;
        return p.socketId;
      }
      return null;
    }

    for (let i = 1; i <= players.length; i++) {
      const idx = (currentIndex + i) % players.length;
      const p = players[idx];
      if (gameState.eliminatedPlayers.includes(p.socketId)) continue;
      if (gameState.phase === 'FINAL_GUESS' && gameState.finalGuessUsed.includes(p.socketId))
        continue;
      return p.socketId;
    }
    return null; // no valid player found
  }

  // Helper: enter FINAL_GUESS phase
  private enterFinalGuessPhase(room: RoomState, gameState: WhoAmIGameState): void {
    const players =
      room.config.wordMode === 'HOST_INPUT'
        ? room.players.filter((p) => p.socketId !== room.roomHostId)
        : room.players;

    gameState.phase = 'FINAL_GUESS';
    const firstPlayer = this.findNextPlayer(room, gameState, players[players.length - 1].socketId);
    if (!firstPlayer) {
      gameState.winner = null;
      room.status = RoomStatus.RESULT;
    } else {
      gameState.currentTurn = firstPlayer;
      gameState.currentGuess = null;
      gameState.turnStatus = 'VOTING';
      gameState.votes = {};
      gameState.guessResult = undefined;
      gameState.guessedWord = undefined;
    }
  }

  handleGameAction(
    room: RoomState,
    requesterId: string,
    action: Record<string, unknown>,
  ): RoomState | null {
    if (action.type === 'END_MATCH') {
      return this.resetGame(room, requesterId);
    }

    if (room.status !== RoomStatus.PLAYING) return null;

    const gameState = room.whoAmIState;
    if (!gameState) return null;

    // Don't allow game actions during word collection
    if (gameState.phase === 'COLLECTING_WORDS') return null;

    if (
      action.type === 'VOTE_GUESS' &&
      typeof action.vote === 'string' &&
      ['YES', 'NO', 'MAYBE'].includes(action.vote)
    ) {
      if (gameState.currentTurn === requesterId) return null;
      if (gameState.turnStatus !== 'VOTING' && gameState.turnStatus !== 'RESULT') return null;
      if (!room.players.find((p) => p.socketId === requesterId)) return null;

      gameState.votes[requesterId] = action.vote as 'YES' | 'NO' | 'MAYBE';

      return room;
    }

    if (action.type === 'END_TURN') {
      if (gameState.currentTurn !== requesterId) return null;
      if (gameState.turnStatus !== 'VOTING') return null;
      if (gameState.phase === 'FINAL_GUESS') return null;

      const players =
        room.config.wordMode === 'HOST_INPUT'
          ? room.players.filter((p) => p.socketId !== room.roomHostId)
          : room.players;

      const currentIndex = players.findIndex((p) => p.socketId === gameState.currentTurn);
      let nextIndex = (currentIndex + 1) % players.length;

      let checked = 0;
      while (
        gameState.eliminatedPlayers.includes(players[nextIndex].socketId) &&
        checked < players.length
      ) {
        nextIndex = (nextIndex + 1) % players.length;
        checked++;
      }

      if (nextIndex <= currentIndex) {
        gameState.currentRound += 1;
        if (gameState.currentRound > gameState.maxRounds) {
          this.enterFinalGuessPhase(room, gameState);
          return room;
        }
      }

      gameState.currentTurn = players[nextIndex].socketId;
      gameState.currentGuess = null;
      gameState.turnStatus = 'VOTING';
      gameState.votes = {};

      return room;
    }

    if (action.type === 'GUESS_WORD') {
      if (gameState.currentTurn !== requesterId) return null;
      if (gameState.turnStatus !== 'VOTING') return null;
      if (typeof action.guess !== 'string' || !action.guess.trim()) return null;
      if (gameState.eliminatedPlayers.includes(requesterId)) return null;

      gameState.turnStatus = 'RESULT';
      gameState.guessResult = true;
      gameState.guessedWord = action.guess.trim();
      gameState.votes = {};

      return room;
    }

    if (action.type === 'NEXT_TURN') {
      if (gameState.turnStatus !== 'RESULT') return null;
      if (gameState.currentTurn !== requesterId && room.roomHostId !== requesterId) return null;

      const votes = Object.values(gameState.votes);
      const yesVotes = votes.filter((v) => v === 'YES').length;
      const noVotes = votes.filter((v) => v === 'NO').length;

      const isCorrectGuess = yesVotes > noVotes;

      const players =
        room.config.wordMode === 'HOST_INPUT'
          ? room.players.filter((p) => p.socketId !== room.roomHostId)
          : room.players;

      if (gameState.guessResult && isCorrectGuess) {
        const activePlayer = room.players.find((p) => p.socketId === gameState.currentTurn);
        if (activePlayer) activePlayer.score += 1;

        gameState.winner = gameState.currentTurn;
        room.status = RoomStatus.RESULT; // use RESULT instead of FINISHED to match hub
      } else if (gameState.phase === 'FINAL_GUESS') {
        gameState.finalGuessUsed.push(gameState.currentTurn);

        const nextPlayer = this.findNextPlayer(room, gameState, gameState.currentTurn);

        if (!nextPlayer) {
          gameState.winner = null;
          room.status = RoomStatus.RESULT;
        } else {
          gameState.currentTurn = nextPlayer;
          gameState.currentGuess = null;
          gameState.turnStatus = 'VOTING';
          gameState.votes = {};
          gameState.guessResult = undefined;
          gameState.guessedWord = undefined;
        }
      } else {
        gameState.eliminatedPlayers.push(gameState.currentTurn);

        const activePlayers = players.filter(
          (p) => !gameState.eliminatedPlayers.includes(p.socketId),
        );

        if (activePlayers.length === 0) {
          gameState.winner = null;
          room.status = RoomStatus.RESULT;
          return room;
        }

        const nextPlayer = this.findNextPlayer(room, gameState, gameState.currentTurn);

        if (!nextPlayer) {
          gameState.winner = null;
          room.status = RoomStatus.RESULT;
        } else {
          const nextIndex = players.findIndex((p) => p.socketId === nextPlayer);
          const currentIndex = players.findIndex((p) => p.socketId === gameState.currentTurn);

          if (nextIndex <= currentIndex) {
            gameState.currentRound += 1;
            if (gameState.currentRound > gameState.maxRounds) {
              this.enterFinalGuessPhase(room, gameState);
              return room;
            }
          }

          gameState.currentTurn = nextPlayer;
          gameState.currentGuess = null;
          gameState.turnStatus = 'VOTING';
          gameState.votes = {};
          gameState.guessResult = undefined;
          gameState.guessedWord = undefined;
        }
      }

      return room;
    }

    return null;
  }

  resetGame(room: RoomState, requesterId: string): RoomState | null {
    if (room.status !== RoomStatus.RESULT) return null;
    if (room.roomHostId !== requesterId) return null;

    room.status = RoomStatus.LOBBY;
    room.whoAmIState = undefined;

    return room;
  }
}
