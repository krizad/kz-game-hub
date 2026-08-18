import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus, WhoAmIGameState, WordCategory } from '@repo/types';
import { prisma } from '@repo/database';
import { GoogleGenAI } from '@google/genai';
import { PrivateStateService } from '../private-state.service';

const WAI_MY_WORD = 'waiMyWord';
const WAI_VISIBLE_WORDS = 'waiVisibleWords';
const WAI_SUBMITTED = 'waiSubmittedWord';
const MAX_WORD_LENGTH = 60;
const GEMINI_TIMEOUT_MS = 15000;

@Injectable()
export class WhoAmIService {
  constructor(private readonly privateState: PrivateStateService) {}

  private shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private setMyWord(room: RoomState, socketId: string, word: string): void {
    this.privateState.set(room.code, socketId, WAI_MY_WORD, word);
  }

  private clearRoomPrivateData(room: RoomState): void {
    for (const p of room.players) {
      this.privateState.delete(room.code, p.socketId, WAI_MY_WORD);
      this.privateState.delete(room.code, p.socketId, WAI_VISIBLE_WORDS);
      this.privateState.delete(room.code, p.socketId, WAI_SUBMITTED);
    }
  }

  private syncVisibleWords(room: RoomState): void {
    const allWords: Record<string, string> = {};
    for (const p of room.players) {
      const word = this.privateState.get<string>(room.code, p.socketId, WAI_MY_WORD);
      if (word) allWords[p.socketId] = word;
    }
    for (const p of room.players) {
      const visible: Record<string, string> = {};
      for (const [socketId, word] of Object.entries(allWords)) {
        if (socketId !== p.socketId) visible[socketId] = word;
      }
      if (Object.keys(visible).length > 0) {
        this.privateState.set(room.code, p.socketId, WAI_VISIBLE_WORDS, visible);
      }
    }
  }

  private finishGame(room: RoomState, gameState: WhoAmIGameState, winner: string | null): void {
    gameState.winner = winner;
    room.status = RoomStatus.RESULT;
    const revealedWords: Record<string, string> = {};
    for (const p of room.players) {
      const word = this.privateState.get<string>(room.code, p.socketId, WAI_MY_WORD);
      if (word) revealedWords[p.socketId] = word;
    }
    gameState.revealedWords = revealedWords;
  }

  private createGameState(
    room: RoomState,
    currentTurn: string,
    phase: WhoAmIGameState['phase'],
  ): WhoAmIGameState {
    return {
      currentTurn,
      currentGuess: null,
      votes: {},
      turnStatus: 'VOTING',
      winner: null,
      currentRound: 1,
      maxRounds: room.config.maxRounds || 3,
      eliminatedPlayers: [],
      phase,
      finalGuessUsed: [],
      wordSubmittedIds: [],
    };
  }

  // ─── Categories from DB ────────────────────────────────────────────
  async getCategories(lang?: string): Promise<WordCategory[]> {
    const where = lang ? { lang } : {};
    const results = await prisma.word.groupBy({
      by: ['category'],
      _count: { id: true },
      where,
    });
    return results.map((r) => ({ name: r.category, count: r._count.id }));
  }

  // ─── Random words from DB (database-agnostic) ──────────────────────
  private async fetchRandomWords(
    category: string,
    lang: string,
    count: number,
  ): Promise<{ word: string; emoji: string | null }[]> {
    const words = await prisma.word.findMany({
      where: { category, lang },
      select: { word: true, emoji: true },
    });
    return this.shuffleArray(words).slice(0, count);
  }

  // ─── Start Game (HOST_INPUT mode) ─────────────────────────────────
  startGameHostInput(
    room: RoomState,
    requesterId: string,
    playerWords: Record<string, string>,
  ): RoomState | null {
    if (room.status !== RoomStatus.LOBBY) return null;
    if (room.roomHostId !== requesterId) return null;
    if (room.config.wordMode !== 'HOST_INPUT') return null;

    // Host does NOT play in HOST_INPUT mode
    const gamePlayers = room.players.filter((p) => p.socketId !== requesterId);
    if (gamePlayers.length < 2) return null;

    // Verify words provided for all non-host players
    const trimmedWords: Record<string, string> = {};
    for (const p of gamePlayers) {
      const word = playerWords[p.socketId]?.trim();
      if (!word || word.length > MAX_WORD_LENGTH) return null;
      trimmedWords[p.socketId] = word;
    }

    room.status = RoomStatus.PLAYING;

    const shuffled = this.shuffleArray(gamePlayers);

    for (const p of gamePlayers) {
      this.setMyWord(room, p.socketId, trimmedWords[p.socketId]);
    }

    const gameState = this.createGameState(room, shuffled[0].socketId, 'ASKING');
    room.whoAmIState = gameState;
    return room;
  }

  // ─── Start Game (AI_GENERATED mode) ───────────────────────────────
  async startGameAiGenerated(room: RoomState, requesterId: string): Promise<RoomState | null> {
    if (room.status !== RoomStatus.LOBBY) return null;
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

    let words: string[] = [];

    if (process.env.GEMINI_API_KEY) {
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

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              abortSignal: controller.signal,
            },
          });

          const responseText = response.text;
          const cleanText = responseText
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
          const parsed = JSON.parse(cleanText);
          if (Array.isArray(parsed)) {
            words = [
              ...new Set(
                parsed
                  .filter((w): w is string => typeof w === 'string')
                  .map((w) => w.trim())
                  .filter((w) => w && w.length <= MAX_WORD_LENGTH),
              ),
            ];
          }
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        console.error('Error calling Gemini API:', error);
      }
    }

    if (words.length < room.players.length) {
      console.log('Falling back to database for words...');
      const category = room.config.wordCategory || (isThai ? 'สิ่งของรอบตัว' : 'Random things');
      const dbWords = await this.fetchRandomWords(category, lang, room.players.length);
      if (dbWords.length < room.players.length) return null;
      words = dbWords.map((w) => (w.emoji ? `${w.emoji} ${w.word}` : w.word));
    } else {
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
    }

    room.status = RoomStatus.PLAYING;

    const shuffledPlayers = this.shuffleArray(room.players);
    shuffledPlayers.forEach((p, idx) => {
      this.setMyWord(room, p.socketId, words[idx]);
    });

    const gameState = this.createGameState(room, shuffledPlayers[0].socketId, 'ASKING');
    room.whoAmIState = gameState;
    return room;
  }

  // ─── Start Game (RANDOM mode) ─────────────────────────────────────
  async startGameRandom(room: RoomState, requesterId: string): Promise<RoomState | null> {
    if (room.status !== RoomStatus.LOBBY) return null;
    if (room.roomHostId !== requesterId) return null;
    if (room.config.wordMode !== 'RANDOM') return null;
    if (room.players.length < 2) return null;

    const category = room.config.wordCategory;
    if (!category) return null;

    const lang = room.config.language || 'th';

    const words = await this.fetchRandomWords(category, lang, room.players.length);

    if (words.length < room.players.length) return null; // not enough words in DB

    room.status = RoomStatus.PLAYING;

    const shuffledPlayers = this.shuffleArray(room.players);
    shuffledPlayers.forEach((p, idx) => {
      const w = words[idx];
      this.setMyWord(room, p.socketId, w.emoji ? `${w.emoji} ${w.word}` : w.word);
    });

    const gameState = this.createGameState(room, shuffledPlayers[0].socketId, 'ASKING');
    room.whoAmIState = gameState;
    return room;
  }

  // ─── Start Game (HOST_INPUT) — waiting for host to submit all words ─
  startGameAwaitHostInput(room: RoomState, requesterId: string): RoomState | null {
    if (room.status !== RoomStatus.LOBBY) return null;
    if (room.roomHostId !== requesterId) return null;
    if (room.config.wordMode !== 'HOST_INPUT') return null;
    if (room.players.length < 3) return null; // host + at least 2 players

    const gamePlayers = room.players.filter((p) => p.socketId !== requesterId);
    if (gamePlayers.length < 2) return null;

    room.status = RoomStatus.PLAYING;

    const gameState = this.createGameState(room, '', 'AWAITING_HOST_INPUT');
    room.whoAmIState = gameState;
    return room;
  }

  // ─── Start Game (PLAYER_INPUT) — enter COLLECTING_WORDS phase ─────
  startGamePlayerInput(room: RoomState, requesterId: string): RoomState | null {
    if (room.status !== RoomStatus.LOBBY) return null;
    if (room.roomHostId !== requesterId) return null;
    if (room.config.wordMode !== 'PLAYER_INPUT') return null;
    if (room.players.length < 2) return null;

    room.status = RoomStatus.PLAYING;

    const gameState = this.createGameState(room, '', 'COLLECTING_WORDS');
    gameState.wordSubmissionCategory = room.config.wordCategory || '';
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
    if (this.privateState.has(room.code, socketId, WAI_SUBMITTED)) return null;

    const trimmedWord = word.trim();
    if (!trimmedWord || trimmedWord.length > MAX_WORD_LENGTH) return null;

    const existingSubmissions = this.privateState.getRoomData<string>(room.code, WAI_SUBMITTED);
    for (const [sid, existingWord] of existingSubmissions.entries()) {
      if (sid !== socketId && existingWord.toLowerCase() === trimmedWord.toLowerCase()) {
        return {
          room,
          error: `Duplicate word "${trimmedWord}"! Please submit a different word.`,
        };
      }
    }

    this.privateState.set(room.code, socketId, WAI_SUBMITTED, trimmedWord);
    if (!gameState.wordSubmittedIds.includes(socketId)) {
      gameState.wordSubmittedIds.push(socketId);
    }

    // Check if all connected players have submitted
    const connectedPlayers = room.players.filter((p) => p.connected !== false);
    const allSubmitted = connectedPlayers.every((p) =>
      this.privateState.has(room.code, p.socketId, WAI_SUBMITTED),
    );

    if (allSubmitted) {
      this.assignShuffledWords(room, gameState);
    }

    return { room };
  }

  // ─── Shuffle words so no player gets their own ────────────────────
  private assignShuffledWords(room: RoomState, gameState: WhoAmIGameState): void {
    const playerIds = room.players.filter((p) => p.connected !== false).map((p) => p.socketId);
    const words = playerIds.map(
      (id) => this.privateState.get<string>(room.code, id, WAI_SUBMITTED)!,
    );

    // Derangement: shuffle until nobody has their own word
    let shuffled: string[];
    let attempts = 0;
    do {
      shuffled = this.shuffleArray(words);
      attempts++;
      // Safety: after many attempts, force a derangement via cyclic shift
      if (attempts > 100) {
        shuffled = [...words];
        shuffled.push(shuffled.shift()!); // simple cyclic shift guarantees derangement
        break;
      }
    } while (shuffled.some((w, i) => w === words[i]));

    playerIds.forEach((id, i) => {
      this.setMyWord(room, id, shuffled[i]);
    });

    gameState.phase = 'ASKING';
    gameState.wordSubmittedIds = [];

    const shuffledPlayers = this.shuffleArray(room.players);
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
      this.finishGame(room, gameState, null);
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

      if (gameState.guessResult && isCorrectGuess) {
        const activePlayer = room.players.find((p) => p.socketId === gameState.currentTurn);
        if (activePlayer) activePlayer.score += 1;

        this.finishGame(room, gameState, gameState.currentTurn);
      } else if (gameState.phase === 'FINAL_GUESS') {
        gameState.finalGuessUsed.push(gameState.currentTurn);

        const nextPlayer = this.findNextPlayer(room, gameState, gameState.currentTurn);

        if (!nextPlayer) {
          this.finishGame(room, gameState, null);
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

        const players =
          room.config.wordMode === 'HOST_INPUT'
            ? room.players.filter((p) => p.socketId !== room.roomHostId)
            : room.players;
        const activePlayers = players.filter(
          (p) => !gameState.eliminatedPlayers.includes(p.socketId),
        );

        if (activePlayers.length === 0) {
          this.finishGame(room, gameState, null);
          return room;
        }

        const nextPlayer = this.findNextPlayer(room, gameState, gameState.currentTurn);

        if (!nextPlayer) {
          this.finishGame(room, gameState, null);
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
    this.clearRoomPrivateData(room);

    return room;
  }
}
