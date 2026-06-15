import { Injectable } from '@nestjs/common';
import { RoomState, RoomStatus, WhoAmIGameState, WordCategory } from '@repo/types';
import { prisma } from '@repo/database';

@Injectable()
export class WhoAmIService {
  
  // ─── Categories from DB ────────────────────────────────────────────
  async getCategories(): Promise<WordCategory[]> {
    const results = await prisma.word.groupBy({
      by: ['category'],
      _count: { id: true },
    });
    return results.map(r => ({ name: r.category, count: r._count.id }));
  }

  // ─── Start Game (HOST_INPUT mode) ─────────────────────────────────
  startGameHostInput(room: RoomState, requesterId: string, playerWords: Record<string, string>): RoomState | null {
    if (room.roomHostId !== requesterId) return null;
    if (room.config.wordMode !== 'HOST_INPUT') return null;

    // Host does NOT play in HOST_INPUT mode
    const gamePlayers = room.players.filter(p => p.socketId !== requesterId);
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

  // ─── Start Game (RANDOM mode) ─────────────────────────────────────
  async startGameRandom(room: RoomState, requesterId: string): Promise<RoomState | null> {
    if (room.roomHostId !== requesterId) return null;
    if (room.config.wordMode !== 'RANDOM') return null;
    if (room.players.length < 2) return null;

    const category = room.config.wordCategory;
    if (!category) return null;

    // Get random words from DB
    const words = await prisma.$queryRawUnsafe<{ word: string; emoji: string | null }[]>(
      `SELECT word, emoji FROM "Word" WHERE category = $1 ORDER BY RANDOM() LIMIT $2`,
      category,
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
  submitPlayerWord(room: RoomState, socketId: string, word: string): { room: RoomState; error?: string } | null {
    if (room.status !== RoomStatus.PLAYING) return null;

    const gameState = room.whoAmIState;
    if (!gameState) return null;
    if (gameState.phase !== 'COLLECTING_WORDS') return null;
    if (!room.players.find(p => p.socketId === socketId)) return null;

    const trimmedWord = word.trim().toLowerCase();
    if (!trimmedWord) return null;

    // Check for duplicates — compare with other players' submissions (not the submitter's own)
    const submissions = gameState.wordSubmissions || {};
    const duplicateEntries = Object.entries(submissions).filter(
      ([sid, w]) => sid !== socketId && w.toLowerCase() === trimmedWord
    );

    if (duplicateEntries.length > 0) {
      // Remove all duplicate submissions (including the existing one)
      for (const [sid] of duplicateEntries) {
        delete submissions[sid];
      }
      // Don't store this one either
      gameState.wordSubmissions = submissions;
      return { room, error: `Duplicate word "${word.trim()}"! All matching submissions have been cleared. Please submit a different word.` };
    }

    // Store submission (keep original casing)
    submissions[socketId] = word.trim();
    gameState.wordSubmissions = submissions;

    // Check if all players have submitted
    const allSubmitted = room.players.every(p => submissions[p.socketId]?.trim());

    if (allSubmitted) {
      // Shuffle-assign words so nobody gets their own
      this.assignShuffledWords(room, gameState);
    }

    return { room };
  }

  // ─── Shuffle words so no player gets their own ────────────────────
  private assignShuffledWords(room: RoomState, gameState: WhoAmIGameState): void {
    const submissions = gameState.wordSubmissions!;
    const playerIds = room.players.map(p => p.socketId);
    const words = playerIds.map(id => submissions[id]);

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
  private findNextPlayer(room: RoomState, gameState: WhoAmIGameState, afterSocketId: string): string | null {
    // In HOST_INPUT mode, skip the room host
    const players = room.config.wordMode === 'HOST_INPUT'
      ? room.players.filter(p => p.socketId !== room.roomHostId)
      : room.players;

    const currentIndex = players.findIndex(p => p.socketId === afterSocketId);
    if (currentIndex === -1) {
      // afterSocketId not in players array — find first valid
      for (const p of players) {
        if (gameState.eliminatedPlayers.includes(p.socketId)) continue;
        if (gameState.phase === 'FINAL_GUESS' && gameState.finalGuessUsed.includes(p.socketId)) continue;
        return p.socketId;
      }
      return null;
    }

    for (let i = 1; i <= players.length; i++) {
      const idx = (currentIndex + i) % players.length;
      const p = players[idx];
      if (gameState.eliminatedPlayers.includes(p.socketId)) continue;
      if (gameState.phase === 'FINAL_GUESS' && gameState.finalGuessUsed.includes(p.socketId)) continue;
      return p.socketId;
    }
    return null; // no valid player found
  }

  // Helper: enter FINAL_GUESS phase
  private enterFinalGuessPhase(room: RoomState, gameState: WhoAmIGameState): void {
    const players = room.config.wordMode === 'HOST_INPUT'
      ? room.players.filter(p => p.socketId !== room.roomHostId)
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

  handleGameAction(room: RoomState, requesterId: string, action: any): RoomState | null {
    if (room.status !== RoomStatus.PLAYING) return null;

    const gameState = room.whoAmIState;
    if (!gameState) return null;

    // Don't allow game actions during word collection
    if (gameState.phase === 'COLLECTING_WORDS') return null;

    if (action.type === 'SUBMIT_GUESS' && typeof action.guess === 'string') {
      if (gameState.currentTurn !== requesterId) return null;
      if (gameState.turnStatus !== 'THINKING') return null;

      gameState.currentGuess = action.guess;
      gameState.turnStatus = 'VOTING';
      gameState.votes = {};

      return room;
    }

    if (action.type === 'VOTE_GUESS' && ['YES', 'NO', 'MAYBE'].includes(action.vote)) {
      if (gameState.currentTurn === requesterId) return null;
      if (gameState.turnStatus !== 'VOTING' && gameState.turnStatus !== 'RESULT') return null;
      if (!room.players.find(p => p.socketId === requesterId)) return null;

      gameState.votes[requesterId] = action.vote;

      return room;
    }

    if (action.type === 'END_TURN') {
      if (gameState.currentTurn !== requesterId) return null;
      if (gameState.turnStatus !== 'VOTING') return null;
      if (gameState.phase === 'FINAL_GUESS') return null;

      const players = room.config.wordMode === 'HOST_INPUT'
        ? room.players.filter(p => p.socketId !== room.roomHostId)
        : room.players;

      const currentIndex = players.findIndex(p => p.socketId === gameState.currentTurn);
      let nextIndex = (currentIndex + 1) % players.length;
      
      let checked = 0;
      while (gameState.eliminatedPlayers.includes(players[nextIndex].socketId) && checked < players.length) {
        nextIndex = (nextIndex + 1) % players.length;
        checked++;
      }

      if (nextIndex <= currentIndex || checked >= players.length - gameState.eliminatedPlayers.length) {
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

      const votes = Object.values(gameState.votes);
      const yesVotes = votes.filter(v => v === 'YES').length;
      const noVotes = votes.filter(v => v === 'NO').length;
      
      const isCorrectGuess = yesVotes > noVotes;

      const players = room.config.wordMode === 'HOST_INPUT'
        ? room.players.filter(p => p.socketId !== room.roomHostId)
        : room.players;
      
      if (gameState.guessResult && isCorrectGuess) {
        const activePlayer = room.players.find(p => p.socketId === gameState.currentTurn);
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

        const activePlayers = players.filter(p => !gameState.eliminatedPlayers.includes(p.socketId));
        
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
          const currentIndex = players.findIndex(p => p.socketId === gameState.currentTurn);
          const nextIndex = players.findIndex(p => p.socketId === nextPlayer);
          
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
