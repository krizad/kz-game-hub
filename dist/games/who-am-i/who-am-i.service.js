"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhoAmIService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const database_1 = require("@repo/database");
const genai_1 = require("@google/genai");
const private_state_service_1 = require("../private-state.service");
const WAI_MY_WORD = 'waiMyWord';
const WAI_VISIBLE_WORDS = 'waiVisibleWords';
const WAI_SUBMITTED = 'waiSubmittedWord';
const MAX_WORD_LENGTH = 60;
const GEMINI_TIMEOUT_MS = 15000;
let WhoAmIService = class WhoAmIService {
    constructor(privateState) {
        this.privateState = privateState;
    }
    shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    setMyWord(room, socketId, word) {
        this.privateState.set(room.code, socketId, WAI_MY_WORD, word);
    }
    clearRoomPrivateData(room) {
        for (const p of room.players) {
            this.privateState.delete(room.code, p.socketId, WAI_MY_WORD);
            this.privateState.delete(room.code, p.socketId, WAI_VISIBLE_WORDS);
            this.privateState.delete(room.code, p.socketId, WAI_SUBMITTED);
        }
    }
    syncVisibleWords(room) {
        const allWords = {};
        for (const p of room.players) {
            const word = this.privateState.get(room.code, p.socketId, WAI_MY_WORD);
            if (word)
                allWords[p.socketId] = word;
        }
        for (const p of room.players) {
            const visible = {};
            for (const [socketId, word] of Object.entries(allWords)) {
                if (socketId !== p.socketId)
                    visible[socketId] = word;
            }
            if (Object.keys(visible).length > 0) {
                this.privateState.set(room.code, p.socketId, WAI_VISIBLE_WORDS, visible);
            }
        }
    }
    finishGame(room, gameState, winner) {
        gameState.winner = winner;
        room.status = types_1.RoomStatus.RESULT;
        const revealedWords = {};
        for (const p of room.players) {
            const word = this.privateState.get(room.code, p.socketId, WAI_MY_WORD);
            if (word)
                revealedWords[p.socketId] = word;
        }
        gameState.revealedWords = revealedWords;
    }
    createGameState(room, currentTurn, phase) {
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
    async getCategories(lang) {
        const where = lang ? { lang } : {};
        const results = await database_1.prisma.word.groupBy({
            by: ['category'],
            _count: { id: true },
            where,
        });
        return results.map((r) => ({ name: r.category, count: r._count.id }));
    }
    async fetchRandomWords(category, lang, count) {
        const words = await database_1.prisma.word.findMany({
            where: { category, lang },
            select: { word: true, emoji: true },
        });
        return this.shuffleArray(words).slice(0, count);
    }
    startGameHostInput(room, requesterId, playerWords) {
        if (room.status !== types_1.RoomStatus.LOBBY)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        if (room.config.wordMode !== 'HOST_INPUT')
            return null;
        const gamePlayers = room.players.filter((p) => p.socketId !== requesterId);
        if (gamePlayers.length < 2)
            return null;
        const trimmedWords = {};
        for (const p of gamePlayers) {
            const word = playerWords[p.socketId]?.trim();
            if (!word || word.length > MAX_WORD_LENGTH)
                return null;
            trimmedWords[p.socketId] = word;
        }
        room.status = types_1.RoomStatus.PLAYING;
        const shuffled = this.shuffleArray(gamePlayers);
        for (const p of gamePlayers) {
            this.setMyWord(room, p.socketId, trimmedWords[p.socketId]);
        }
        const gameState = this.createGameState(room, shuffled[0].socketId, 'ASKING');
        room.whoAmIState = gameState;
        return room;
    }
    async startGameAiGenerated(room, requesterId) {
        if (room.status !== types_1.RoomStatus.LOBBY)
            return null;
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
        let words = [];
        if (process.env.GEMINI_API_KEY) {
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
                            ...new Set(parsed
                                .filter((w) => typeof w === 'string')
                                .map((w) => w.trim())
                                .filter((w) => w && w.length <= MAX_WORD_LENGTH)),
                        ];
                    }
                }
                finally {
                    clearTimeout(timeout);
                }
            }
            catch (error) {
                console.error('Error calling Gemini API:', error);
            }
        }
        if (words.length < room.players.length) {
            console.log('Falling back to database for words...');
            const category = room.config.wordCategory || (isThai ? 'สิ่งของรอบตัว' : 'Random things');
            const dbWords = await this.fetchRandomWords(category, lang, room.players.length);
            if (dbWords.length < room.players.length)
                return null;
            words = dbWords.map((w) => (w.emoji ? `${w.emoji} ${w.word}` : w.word));
        }
        else {
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
        }
        room.status = types_1.RoomStatus.PLAYING;
        const shuffledPlayers = this.shuffleArray(room.players);
        shuffledPlayers.forEach((p, idx) => {
            this.setMyWord(room, p.socketId, words[idx]);
        });
        const gameState = this.createGameState(room, shuffledPlayers[0].socketId, 'ASKING');
        room.whoAmIState = gameState;
        return room;
    }
    async startGameRandom(room, requesterId) {
        if (room.status !== types_1.RoomStatus.LOBBY)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        if (room.config.wordMode !== 'RANDOM')
            return null;
        if (room.players.length < 2)
            return null;
        const category = room.config.wordCategory;
        if (!category)
            return null;
        const lang = room.config.language || 'th';
        const words = await this.fetchRandomWords(category, lang, room.players.length);
        if (words.length < room.players.length)
            return null;
        room.status = types_1.RoomStatus.PLAYING;
        const shuffledPlayers = this.shuffleArray(room.players);
        shuffledPlayers.forEach((p, idx) => {
            const w = words[idx];
            this.setMyWord(room, p.socketId, w.emoji ? `${w.emoji} ${w.word}` : w.word);
        });
        const gameState = this.createGameState(room, shuffledPlayers[0].socketId, 'ASKING');
        room.whoAmIState = gameState;
        return room;
    }
    startGameAwaitHostInput(room, requesterId) {
        if (room.status !== types_1.RoomStatus.LOBBY)
            return null;
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
        const gameState = this.createGameState(room, '', 'AWAITING_HOST_INPUT');
        room.whoAmIState = gameState;
        return room;
    }
    startGamePlayerInput(room, requesterId) {
        if (room.status !== types_1.RoomStatus.LOBBY)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        if (room.config.wordMode !== 'PLAYER_INPUT')
            return null;
        if (room.players.length < 2)
            return null;
        room.status = types_1.RoomStatus.PLAYING;
        const gameState = this.createGameState(room, '', 'COLLECTING_WORDS');
        gameState.wordSubmissionCategory = room.config.wordCategory || '';
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
        if (this.privateState.has(room.code, socketId, WAI_SUBMITTED))
            return null;
        const trimmedWord = word.trim();
        if (!trimmedWord || trimmedWord.length > MAX_WORD_LENGTH)
            return null;
        const existingSubmissions = this.privateState.getRoomData(room.code, WAI_SUBMITTED);
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
        const connectedPlayers = room.players.filter((p) => p.connected !== false);
        const allSubmitted = connectedPlayers.every((p) => this.privateState.has(room.code, p.socketId, WAI_SUBMITTED));
        if (allSubmitted) {
            this.assignShuffledWords(room, gameState);
        }
        return { room };
    }
    assignShuffledWords(room, gameState) {
        const playerIds = room.players.filter((p) => p.connected !== false).map((p) => p.socketId);
        const words = playerIds.map((id) => this.privateState.get(room.code, id, WAI_SUBMITTED));
        let shuffled;
        let attempts = 0;
        do {
            shuffled = this.shuffleArray(words);
            attempts++;
            if (attempts > 100) {
                shuffled = [...words];
                shuffled.push(shuffled.shift());
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
            this.finishGame(room, gameState, null);
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
            if (gameState.guessResult && isCorrectGuess) {
                const activePlayer = room.players.find((p) => p.socketId === gameState.currentTurn);
                if (activePlayer)
                    activePlayer.score += 1;
                this.finishGame(room, gameState, gameState.currentTurn);
            }
            else if (gameState.phase === 'FINAL_GUESS') {
                gameState.finalGuessUsed.push(gameState.currentTurn);
                const nextPlayer = this.findNextPlayer(room, gameState, gameState.currentTurn);
                if (!nextPlayer) {
                    this.finishGame(room, gameState, null);
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
                const players = room.config.wordMode === 'HOST_INPUT'
                    ? room.players.filter((p) => p.socketId !== room.roomHostId)
                    : room.players;
                const activePlayers = players.filter((p) => !gameState.eliminatedPlayers.includes(p.socketId));
                if (activePlayers.length === 0) {
                    this.finishGame(room, gameState, null);
                    return room;
                }
                const nextPlayer = this.findNextPlayer(room, gameState, gameState.currentTurn);
                if (!nextPlayer) {
                    this.finishGame(room, gameState, null);
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
        this.clearRoomPrivateData(room);
        return room;
    }
    remapSocketId(state, oldSocketId, newSocketId) {
        if (state.currentTurn === oldSocketId)
            state.currentTurn = newSocketId;
        if (state.winner === oldSocketId)
            state.winner = newSocketId;
        if (state.votes[oldSocketId]) {
            state.votes[newSocketId] = state.votes[oldSocketId];
            delete state.votes[oldSocketId];
        }
        state.eliminatedPlayers = state.eliminatedPlayers.map((id) => id === oldSocketId ? newSocketId : id);
        state.finalGuessUsed = state.finalGuessUsed.map((id) => id === oldSocketId ? newSocketId : id);
    }
};
exports.WhoAmIService = WhoAmIService;
exports.WhoAmIService = WhoAmIService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], WhoAmIService);
//# sourceMappingURL=who-am-i.service.js.map