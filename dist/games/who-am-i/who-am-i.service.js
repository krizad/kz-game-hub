"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhoAmIService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const database_1 = require("@repo/database");
const genai_1 = require("@google/genai");
let WhoAmIService = class WhoAmIService {
    async getCategories(lang) {
        if (lang) {
            const results = await database_1.prisma.word.groupBy({
                by: ['category'],
                _count: { id: true },
                where: { lang },
            });
            return results.map((r) => ({ name: r.category, count: r._count.id }));
        }
        const results = await database_1.prisma.word.groupBy({
            by: ['category'],
            _count: { id: true },
        });
        return results.map((r) => ({ name: r.category, count: r._count.id }));
    }
    async fetchRandomWords(category, lang, count) {
        const words = await database_1.prisma.word.findMany({
            where: { category, lang },
            select: { word: true, emoji: true },
        });
        return [...words].sort(() => Math.random() - 0.5).slice(0, count);
    }
    startGameHostInput(room, requesterId, playerWords) {
        if (room.roomHostId !== requesterId)
            return null;
        if (room.config.wordMode !== 'HOST_INPUT')
            return null;
        const gamePlayers = room.players.filter((p) => p.socketId !== requesterId);
        if (gamePlayers.length < 2)
            return null;
        for (const p of gamePlayers) {
            if (!playerWords[p.socketId]?.trim())
                return null;
        }
        room.status = types_1.RoomStatus.PLAYING;
        const shuffled = [...gamePlayers].sort(() => Math.random() - 0.5);
        const gameState = {
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
    async startGameAiGenerated(room, requesterId) {
        if (room.roomHostId !== requesterId)
            return null;
        if (room.config.wordMode !== 'AI_GENERATED')
            return null;
        if (room.players.length < 2)
            return null;
        const lang = room.config.language || 'th';
        const isThai = lang === 'th';
        const langLabel = isThai ? 'Thai' : 'English';
        const example = isThai
            ? '["หมูปิ้ง", "ช้าง", "นายกรัฐมนตรี"]'
            : '["Elephant", "Harry Potter", "Pizza"]';
        const promptCategory = room.config.wordCategory || (isThai ? 'สิ่งของรอบตัว' : 'Random things');
        try {
            const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
            }
            catch {
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
            let words = [];
            try {
                const cleanText = responseText
                    .replace(/```json/g, '')
                    .replace(/```/g, '')
                    .trim();
                words = JSON.parse(cleanText);
            }
            catch {
                console.error('Failed to parse AI response', responseText);
                return null;
            }
            if (!Array.isArray(words) || words.length < room.players.length) {
                return null;
            }
            Promise.resolve().then(async () => {
                try {
                    const existingWords = await database_1.prisma.word.findMany({
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
                        await database_1.prisma.word.createMany({
                            data: newWords.map((w) => ({
                                word: w,
                                category: promptCategory,
                                lang: lang,
                            })),
                        });
                    }
                }
                catch (dbError) {
                    console.error('Failed to save AI words to DB:', dbError);
                }
            });
            room.status = types_1.RoomStatus.PLAYING;
            const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);
            const playerWords = {};
            shuffledPlayers.forEach((p, idx) => {
                playerWords[p.socketId] = words[idx];
            });
            const gameState = {
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
        catch (error) {
            console.error('Error calling Gemini API:', error);
            console.log('Falling back to database for words...');
            const lang = room.config.language || 'en';
            const category = room.config.wordCategory || (lang === 'th' ? 'สิ่งของรอบตัว' : 'Random things');
            const dbWords = await this.fetchRandomWords(category, lang, room.players.length);
            if (dbWords.length < room.players.length)
                return null;
            room.status = types_1.RoomStatus.PLAYING;
            const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);
            const playerWords = {};
            shuffledPlayers.forEach((p, idx) => {
                const w = dbWords[idx];
                playerWords[p.socketId] = w.emoji ? `${w.emoji} ${w.word}` : w.word;
            });
            const gameState = {
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
    async startGameRandom(room, requesterId) {
        if (room.roomHostId !== requesterId)
            return null;
        if (room.config.wordMode !== 'RANDOM')
            return null;
        if (room.players.length < 2)
            return null;
        const category = room.config.wordCategory;
        if (!category)
            return null;
        const lang = room.config.language || 'en';
        const words = await this.fetchRandomWords(category, lang, room.players.length);
        if (words.length < room.players.length)
            return null;
        room.status = types_1.RoomStatus.PLAYING;
        const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);
        const playerWords = {};
        shuffledPlayers.forEach((p, idx) => {
            const w = words[idx];
            playerWords[p.socketId] = w.emoji ? `${w.emoji} ${w.word}` : w.word;
        });
        const gameState = {
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
    startGameAwaitHostInput(room, requesterId) {
        if (room.roomHostId !== requesterId)
            return null;
        if (room.config.wordMode !== 'HOST_INPUT')
            return null;
        if (room.players.length < 3)
            return null;
        const gamePlayers = room.players.filter((p) => p.socketId !== requesterId);
        if (gamePlayers.length < 2)
            return null;
        room.status = types_1.RoomStatus.PLAYING;
        const gameState = {
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
    startGamePlayerInput(room, requesterId) {
        if (room.roomHostId !== requesterId)
            return null;
        if (room.config.wordMode !== 'PLAYER_INPUT')
            return null;
        if (room.players.length < 2)
            return null;
        room.status = types_1.RoomStatus.PLAYING;
        const gameState = {
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
    submitPlayerWord(room, socketId, word) {
        if (room.status !== types_1.RoomStatus.PLAYING)
            return null;
        const gameState = room.whoAmIState;
        if (!gameState)
            return null;
        if (gameState.phase !== 'COLLECTING_WORDS')
            return null;
        if (!room.players.find((p) => p.socketId === socketId))
            return null;
        const trimmedWord = word.trim().toLowerCase();
        if (!trimmedWord)
            return null;
        const submissions = gameState.wordSubmissions || {};
        const duplicateEntries = Object.entries(submissions).filter(([sid, w]) => sid !== socketId && w.toLowerCase() === trimmedWord);
        if (duplicateEntries.length > 0) {
            for (const [sid] of duplicateEntries) {
                delete submissions[sid];
            }
            gameState.wordSubmissions = submissions;
            return {
                room,
                error: `Duplicate word "${word.trim()}"! All matching submissions have been cleared. Please submit a different word.`,
            };
        }
        submissions[socketId] = word.trim();
        gameState.wordSubmissions = submissions;
        const allSubmitted = room.players.every((p) => submissions[p.socketId]?.trim());
        if (allSubmitted) {
            this.assignShuffledWords(room, gameState);
        }
        return { room };
    }
    assignShuffledWords(room, gameState) {
        const submissions = gameState.wordSubmissions;
        const playerIds = room.players.map((p) => p.socketId);
        const words = playerIds.map((id) => submissions[id]);
        let shuffled;
        let attempts = 0;
        do {
            shuffled = [...words].sort(() => Math.random() - 0.5);
            attempts++;
            if (attempts > 100) {
                shuffled = [...words];
                shuffled.push(shuffled.shift());
                break;
            }
        } while (shuffled.some((w, i) => w === words[i]));
        const playerWords = {};
        playerIds.forEach((id, i) => {
            playerWords[id] = shuffled[i];
        });
        gameState.playerWords = playerWords;
        gameState.phase = 'ASKING';
        gameState.wordSubmissions = undefined;
        const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);
        gameState.currentTurn = shuffledPlayers[0].socketId;
    }
    findNextPlayer(room, gameState, afterSocketId) {
        const players = room.config.wordMode === 'HOST_INPUT'
            ? room.players.filter((p) => p.socketId !== room.roomHostId)
            : room.players;
        const currentIndex = players.findIndex((p) => p.socketId === afterSocketId);
        if (currentIndex === -1) {
            for (const p of players) {
                if (gameState.eliminatedPlayers.includes(p.socketId))
                    continue;
                if (gameState.phase === 'FINAL_GUESS' && gameState.finalGuessUsed.includes(p.socketId))
                    continue;
                return p.socketId;
            }
            return null;
        }
        for (let i = 1; i <= players.length; i++) {
            const idx = (currentIndex + i) % players.length;
            const p = players[idx];
            if (gameState.eliminatedPlayers.includes(p.socketId))
                continue;
            if (gameState.phase === 'FINAL_GUESS' && gameState.finalGuessUsed.includes(p.socketId))
                continue;
            return p.socketId;
        }
        return null;
    }
    enterFinalGuessPhase(room, gameState) {
        const players = room.config.wordMode === 'HOST_INPUT'
            ? room.players.filter((p) => p.socketId !== room.roomHostId)
            : room.players;
        gameState.phase = 'FINAL_GUESS';
        const firstPlayer = this.findNextPlayer(room, gameState, players[players.length - 1].socketId);
        if (!firstPlayer) {
            gameState.winner = null;
            room.status = types_1.RoomStatus.RESULT;
        }
        else {
            gameState.currentTurn = firstPlayer;
            gameState.currentGuess = null;
            gameState.turnStatus = 'VOTING';
            gameState.votes = {};
            gameState.guessResult = undefined;
            gameState.guessedWord = undefined;
        }
    }
    handleGameAction(room, requesterId, action) {
        if (action.type === 'END_MATCH') {
            return this.resetGame(room, requesterId);
        }
        if (room.status !== types_1.RoomStatus.PLAYING)
            return null;
        const gameState = room.whoAmIState;
        if (!gameState)
            return null;
        if (gameState.phase === 'COLLECTING_WORDS')
            return null;
        if (action.type === 'VOTE_GUESS' &&
            typeof action.vote === 'string' &&
            ['YES', 'NO', 'MAYBE'].includes(action.vote)) {
            if (gameState.currentTurn === requesterId)
                return null;
            if (gameState.turnStatus !== 'VOTING' && gameState.turnStatus !== 'RESULT')
                return null;
            if (!room.players.find((p) => p.socketId === requesterId))
                return null;
            gameState.votes[requesterId] = action.vote;
            return room;
        }
        if (action.type === 'END_TURN') {
            if (gameState.currentTurn !== requesterId)
                return null;
            if (gameState.turnStatus !== 'VOTING')
                return null;
            if (gameState.phase === 'FINAL_GUESS')
                return null;
            const players = room.config.wordMode === 'HOST_INPUT'
                ? room.players.filter((p) => p.socketId !== room.roomHostId)
                : room.players;
            const currentIndex = players.findIndex((p) => p.socketId === gameState.currentTurn);
            let nextIndex = (currentIndex + 1) % players.length;
            let checked = 0;
            while (gameState.eliminatedPlayers.includes(players[nextIndex].socketId) &&
                checked < players.length) {
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
            if (gameState.currentTurn !== requesterId)
                return null;
            if (gameState.turnStatus !== 'VOTING')
                return null;
            if (typeof action.guess !== 'string' || !action.guess.trim())
                return null;
            if (gameState.eliminatedPlayers.includes(requesterId))
                return null;
            gameState.turnStatus = 'RESULT';
            gameState.guessResult = true;
            gameState.guessedWord = action.guess.trim();
            gameState.votes = {};
            return room;
        }
        if (action.type === 'NEXT_TURN') {
            if (gameState.turnStatus !== 'RESULT')
                return null;
            if (gameState.currentTurn !== requesterId && room.roomHostId !== requesterId)
                return null;
            const votes = Object.values(gameState.votes);
            const yesVotes = votes.filter((v) => v === 'YES').length;
            const noVotes = votes.filter((v) => v === 'NO').length;
            const isCorrectGuess = yesVotes > noVotes;
            const players = room.config.wordMode === 'HOST_INPUT'
                ? room.players.filter((p) => p.socketId !== room.roomHostId)
                : room.players;
            if (gameState.guessResult && isCorrectGuess) {
                const activePlayer = room.players.find((p) => p.socketId === gameState.currentTurn);
                if (activePlayer)
                    activePlayer.score += 1;
                gameState.winner = gameState.currentTurn;
                room.status = types_1.RoomStatus.RESULT;
            }
            else if (gameState.phase === 'FINAL_GUESS') {
                gameState.finalGuessUsed.push(gameState.currentTurn);
                const nextPlayer = this.findNextPlayer(room, gameState, gameState.currentTurn);
                if (!nextPlayer) {
                    gameState.winner = null;
                    room.status = types_1.RoomStatus.RESULT;
                }
                else {
                    gameState.currentTurn = nextPlayer;
                    gameState.currentGuess = null;
                    gameState.turnStatus = 'VOTING';
                    gameState.votes = {};
                    gameState.guessResult = undefined;
                    gameState.guessedWord = undefined;
                }
            }
            else {
                gameState.eliminatedPlayers.push(gameState.currentTurn);
                const activePlayers = players.filter((p) => !gameState.eliminatedPlayers.includes(p.socketId));
                if (activePlayers.length === 0) {
                    gameState.winner = null;
                    room.status = types_1.RoomStatus.RESULT;
                    return room;
                }
                const nextPlayer = this.findNextPlayer(room, gameState, gameState.currentTurn);
                if (!nextPlayer) {
                    gameState.winner = null;
                    room.status = types_1.RoomStatus.RESULT;
                }
                else {
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
    resetGame(room, requesterId) {
        if (room.status !== types_1.RoomStatus.RESULT)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        room.status = types_1.RoomStatus.LOBBY;
        room.whoAmIState = undefined;
        return room;
    }
};
exports.WhoAmIService = WhoAmIService;
exports.WhoAmIService = WhoAmIService = __decorate([
    (0, common_1.Injectable)()
], WhoAmIService);
//# sourceMappingURL=who-am-i.service.js.map