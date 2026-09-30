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
var BananaThiefService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BananaThiefService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const ROOM_KEY = '__room__';
const CT_ROLE = 'ctRole';
const CT_DIE = 'ctDie';
const CT_REROLL_USED = 'ctRerollUsed';
const CT_BANANA_STATUS = 'ctBananaStatus';
const CT_AWAKE_PEERS = 'ctAwakePeers';
const CT_PEEK_OFFER = 'ctPeekOffer';
const CT_PEEK_RESULT = 'ctPeekResult';
const CT_STOLE = 'ctStole';
const CT_WITNESSES = 'ctWitnesses';
const CT_SEES_THIEF = 'ctSeesThief';
const CT_SPECIAL = 'ctSpecial';
const CT_TWIN_PARTNER = 'ctTwinPartner';
const CT_CHOSEN_FOLLOWERS = 'ctChosenFollowers';
const BANANA_THIEF_DLC_MIN_PLAYERS = types_1.BANANA_THIEF_MIN_PLAYERS + 1;
const CT_ROOM_THIEF = 'ctRoomThief';
const CT_ROOM_FOLLOWERS = 'ctRoomFollowers';
const CT_ROOM_VOTES = 'ctRoomVotes';
const CT_ROOM_PENDING_PEEK = 'ctRoomPendingPeek';
const CT_ROOM_STOLEN = 'ctRoomStolen';
const SCORE_CORRECT_VOTE = 2;
const SCORE_THIEF_ESCAPE = 3;
const SCORE_FOLLOWER_ESCAPE = 2;
let BananaThiefService = BananaThiefService_1 = class BananaThiefService {
    constructor(privateState) {
        this.privateState = privateState;
        this.logger = new common_1.Logger(BananaThiefService_1.name);
    }
    participatingIds(room) {
        return room.players.filter((p) => p.connected !== false && !p.isViewer).map((p) => p.socketId);
    }
    shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    randomDie() {
        return 1 + Math.floor(Math.random() * types_1.BANANA_THIEF_CLOCK_HOURS);
    }
    getThiefId(room) {
        return this.privateState.get(room.code, ROOM_KEY, CT_ROOM_THIEF) ?? null;
    }
    setThiefId(room, socketId) {
        this.privateState.set(room.code, ROOM_KEY, CT_ROOM_THIEF, socketId);
    }
    getFollowerIds(room) {
        return this.privateState.get(room.code, ROOM_KEY, CT_ROOM_FOLLOWERS) ?? [];
    }
    setFollowerIds(room, ids) {
        this.privateState.set(room.code, ROOM_KEY, CT_ROOM_FOLLOWERS, ids);
    }
    getVotes(room) {
        return this.privateState.get(room.code, ROOM_KEY, CT_ROOM_VOTES) ?? {};
    }
    setVotes(room, votes) {
        this.privateState.set(room.code, ROOM_KEY, CT_ROOM_VOTES, votes);
    }
    getPendingPeeks(room) {
        return this.privateState.get(room.code, ROOM_KEY, CT_ROOM_PENDING_PEEK) ?? [];
    }
    addPendingPeek(room, socketId) {
        const pending = this.getPendingPeeks(room);
        if (!pending.includes(socketId))
            pending.push(socketId);
        this.privateState.set(room.code, ROOM_KEY, CT_ROOM_PENDING_PEEK, pending);
    }
    removePendingPeek(room, socketId) {
        const pending = this.getPendingPeeks(room).filter((id) => id !== socketId);
        if (pending.length === 0) {
            this.privateState.delete(room.code, ROOM_KEY, CT_ROOM_PENDING_PEEK);
        }
        else {
            this.privateState.set(room.code, ROOM_KEY, CT_ROOM_PENDING_PEEK, pending);
        }
    }
    clearPendingPeeks(room) {
        for (const id of this.getPendingPeeks(room)) {
            this.privateState.delete(room.code, id, CT_PEEK_OFFER);
        }
        this.privateState.delete(room.code, ROOM_KEY, CT_ROOM_PENDING_PEEK);
    }
    isStolen(room) {
        return this.privateState.get(room.code, ROOM_KEY, CT_ROOM_STOLEN) ?? false;
    }
    setStolen(room, stolen) {
        this.privateState.set(room.code, ROOM_KEY, CT_ROOM_STOLEN, stolen);
    }
    getDie(room, socketId) {
        return this.privateState.get(room.code, socketId, CT_DIE);
    }
    getRole(room, socketId) {
        return this.privateState.get(room.code, socketId, CT_ROLE);
    }
    setRole(room, socketId, role) {
        this.privateState.set(room.code, socketId, CT_ROLE, role);
    }
    refreshAwakePeers(room, clock) {
        const awakeIds = this.participatingIds(room).filter((id) => (this.getDie(room, id) ?? types_1.BANANA_THIEF_CLOCK_HOURS) <= clock);
        const nameOf = (id) => room.players.find((p) => p.socketId === id)?.name;
        for (const id of awakeIds) {
            const name = nameOf(id);
            if (!name)
                continue;
            this.privateState.set(room.code, id, CT_AWAKE_PEERS, awakeIds
                .filter((other) => other !== id)
                .map(nameOf)
                .filter((n) => !!n));
        }
    }
    refreshBananaStatus(room, clock) {
        const thiefId = this.getThiefId(room);
        const stolen = this.isStolen(room);
        const stealHour = thiefId ? this.getDie(room, thiefId) : undefined;
        for (const id of this.participatingIds(room)) {
            const die = this.getDie(room, id) ?? types_1.BANANA_THIEF_CLOCK_HOURS;
            if (die > clock) {
                this.privateState.delete(room.code, id, CT_BANANA_STATUS);
                continue;
            }
            const status = id === thiefId
                ? 'STOLEN_BY_YOU'
                : stolen && stealHour !== undefined && die === stealHour
                    ? 'WITNESSED_THEFT'
                    : stolen
                        ? 'MISSING'
                        : 'PRESENT';
            this.privateState.set(room.code, id, CT_BANANA_STATUS, status);
        }
    }
    startRound(room, requesterId) {
        if (room.gameType !== types_1.GameType.BANANA_THIEF)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        if (room.status === types_1.RoomStatus.PLAYING)
            return null;
        const participants = this.participatingIds(room);
        const minRequired = (0, types_1.getBananaThiefRequiredPlayerCount)(room.config).min;
        if (participants.length < minRequired)
            return null;
        const shuffled = this.shuffleArray(participants);
        const thiefId = shuffled[0];
        this.setThiefId(room, thiefId);
        this.setFollowerIds(room, []);
        this.setVotes(room, {});
        this.clearPendingPeeks(room);
        this.setStolen(room, false);
        for (const id of participants) {
            this.setRole(room, id, id === thiefId ? types_1.BananaThiefRole.THIEF : types_1.BananaThiefRole.MOUSE);
            this.privateState.delete(room.code, id, CT_DIE);
            this.privateState.delete(room.code, id, CT_REROLL_USED);
            this.privateState.delete(room.code, id, CT_BANANA_STATUS);
            this.privateState.delete(room.code, id, CT_AWAKE_PEERS);
            this.privateState.delete(room.code, id, CT_PEEK_OFFER);
            this.privateState.delete(room.code, id, CT_PEEK_RESULT);
            this.privateState.delete(room.code, id, CT_STOLE);
            this.privateState.delete(room.code, id, CT_WITNESSES);
            this.privateState.delete(room.code, id, CT_SEES_THIEF);
            this.privateState.delete(room.code, id, CT_CHOSEN_FOLLOWERS);
            this.privateState.delete(room.code, id, CT_SPECIAL);
            this.privateState.delete(room.code, id, CT_TWIN_PARTNER);
        }
        this.maybeAssignSpecials(room, participants.filter((id) => id !== thiefId));
        room.status = types_1.RoomStatus.PLAYING;
        room.bananaThiefState = {
            phase: types_1.BananaThiefPhase.SETUP,
            readyIds: [],
            clock: 0,
            tickEndsAt: null,
            phaseEndsAt: null,
            bananaStolen: false,
            votesRecorded: 0,
            votesTotal: participants.length,
        };
        return room;
    }
    maybeAssignSpecials(room, miceIds) {
        const selected = room.config.bananaThiefSelectedSpecials;
        if (selected && selected.length > 0) {
            const shuffledMice = this.shuffleArray(miceIds);
            for (const special of selected) {
                if (special === types_1.BananaThiefSpecial.TWINS) {
                    if (shuffledMice.length < 2)
                        continue;
                    const a = shuffledMice.shift();
                    const b = shuffledMice.shift();
                    const nameOf = (id) => room.players.find((p) => p.socketId === id)?.name;
                    const nameA = a ? nameOf(a) : undefined;
                    const nameB = b ? nameOf(b) : undefined;
                    if (!a || !b || !nameA || !nameB)
                        continue;
                    this.privateState.set(room.code, a, CT_SPECIAL, special);
                    this.privateState.set(room.code, b, CT_SPECIAL, special);
                    this.privateState.set(room.code, a, CT_TWIN_PARTNER, nameB);
                    this.privateState.set(room.code, b, CT_TWIN_PARTNER, nameA);
                }
                else {
                    const id = shuffledMice.shift();
                    if (!id)
                        continue;
                    this.privateState.set(room.code, id, CT_SPECIAL, special);
                }
            }
            return;
        }
        if (!(room.config.bananaThiefDlc ?? false))
            return;
        if (miceIds.length < 4)
            return;
        const pool = [
            types_1.BananaThiefSpecial.DETECTIVE,
            types_1.BananaThiefSpecial.SYCOPHANT,
            types_1.BananaThiefSpecial.SCAPEGOAT,
        ];
        const count = miceIds.length >= BANANA_THIEF_DLC_MIN_PLAYERS ? 2 : 1;
        if (count >= 2) {
            pool.push(types_1.BananaThiefSpecial.TWINS);
        }
        const shuffledMice = this.shuffleArray(miceIds);
        const shuffledPool = this.shuffleArray(pool);
        const chosen = shuffledPool.slice(0, count);
        for (const special of chosen) {
            if (special === types_1.BananaThiefSpecial.TWINS) {
                const [a, b] = shuffledMice.splice(0, 2);
                const nameOf = (id) => room.players.find((p) => p.socketId === id)?.name;
                const nameA = a ? nameOf(a) : undefined;
                const nameB = b ? nameOf(b) : undefined;
                if (!a || !b || !nameA || !nameB)
                    continue;
                this.privateState.set(room.code, a, CT_SPECIAL, special);
                this.privateState.set(room.code, b, CT_SPECIAL, special);
                this.privateState.set(room.code, a, CT_TWIN_PARTNER, nameB);
                this.privateState.set(room.code, b, CT_TWIN_PARTNER, nameA);
            }
            else {
                const id = shuffledMice.shift();
                if (!id)
                    continue;
                this.privateState.set(room.code, id, CT_SPECIAL, special);
            }
        }
    }
    ready(room, socketId, force = false) {
        const state = room.bananaThiefState;
        if (!state || state.phase !== types_1.BananaThiefPhase.SETUP)
            return null;
        const participants = this.participatingIds(room);
        if (!participants.includes(socketId))
            return null;
        if (force && room.roomHostId === socketId)
            return this.afterSetup(room);
        state.readyIds = state.readyIds ?? [];
        if (!state.readyIds.includes(socketId))
            state.readyIds.push(socketId);
        if (participants.every((id) => state.readyIds.includes(id))) {
            return this.afterSetup(room);
        }
        return room;
    }
    rollDie(room, socketId) {
        const state = room.bananaThiefState;
        if (!state || state.phase !== types_1.BananaThiefPhase.SETUP)
            return null;
        if (!this.participatingIds(room).includes(socketId))
            return null;
        if (this.getDie(room, socketId) === undefined) {
            this.privateState.set(room.code, socketId, CT_DIE, this.randomDie());
            return room;
        }
        if (this.privateState.get(room.code, socketId, CT_REROLL_USED))
            return null;
        this.privateState.set(room.code, socketId, CT_DIE, this.randomDie());
        this.privateState.set(room.code, socketId, CT_REROLL_USED, true);
        return room;
    }
    afterSetup(room) {
        for (const id of this.participatingIds(room)) {
            if (this.getDie(room, id) === undefined) {
                this.privateState.set(room.code, id, CT_DIE, this.randomDie());
            }
        }
        return this.beginNight(room);
    }
    beginChooseFollower(room) {
        const state = room.bananaThiefState;
        state.phase = types_1.BananaThiefPhase.CHOOSE_FOLLOWER;
        state.readyIds = [];
        state.clock = types_1.BANANA_THIEF_CLOCK_HOURS;
        state.nightGrace = false;
        state.tickEndsAt = null;
        const chooseSeconds = 15;
        state.phaseEndsAt = Date.now() + chooseSeconds * 1000;
        return room;
    }
    chooseFollower(room, requesterId, targetId) {
        const state = room.bananaThiefState;
        if (!state || state.phase !== types_1.BananaThiefPhase.CHOOSE_FOLLOWER)
            return null;
        const thiefId = this.getThiefId(room);
        if (requesterId !== thiefId)
            return null;
        if (targetId === thiefId)
            return null;
        const participants = this.participatingIds(room);
        if (!participants.includes(targetId))
            return null;
        if (this.privateState.get(room.code, targetId, CT_SPECIAL) ===
            types_1.BananaThiefSpecial.SCAPEGOAT) {
            return null;
        }
        const followers = [...this.getFollowerIds(room)];
        const maxFollowers = room.config.bananaThiefFollowerCount ?? 1;
        if (!followers.includes(targetId)) {
            if (followers.length >= maxFollowers) {
                followers.shift();
            }
            followers.push(targetId);
        }
        this.setFollowerIds(room, followers);
        const thiefName = room.players.find((p) => p.socketId === thiefId)?.name;
        const followerNames = followers
            .map((id) => room.players.find((p) => p.socketId === id)?.name)
            .filter((n) => !!n);
        this.privateState.set(room.code, thiefId, CT_CHOSEN_FOLLOWERS, followerNames);
        for (const fid of followers) {
            this.setRole(room, fid, types_1.BananaThiefRole.FOLLOWER);
            if (thiefName) {
                this.privateState.set(room.code, fid, CT_SEES_THIEF, thiefName);
            }
        }
        if (followers.length >= maxFollowers) {
            this.beginDiscussion(room);
            return room;
        }
        return room;
    }
    chooseFollowerTimeout(room) {
        const state = room.bananaThiefState;
        if (!state || state.phase !== types_1.BananaThiefPhase.CHOOSE_FOLLOWER)
            return null;
        this.beginDiscussion(room);
        return room;
    }
    beginNight(room) {
        const state = room.bananaThiefState;
        const hostPaced = (room.config.bananaThiefNarrator ?? 'AUTO') === 'HOST';
        const tickSeconds = room.config.bananaThiefTickSeconds ?? 6;
        state.phase = types_1.BananaThiefPhase.NIGHT;
        state.readyIds = [];
        state.clock = 0;
        state.nightGrace = false;
        state.tickEndsAt = hostPaced ? null : Date.now() + tickSeconds * 1000;
        return room;
    }
    tick(room) {
        const state = room.bananaThiefState;
        if (!state || state.phase !== types_1.BananaThiefPhase.NIGHT)
            return null;
        if (state.clock >= types_1.BANANA_THIEF_CLOCK_HOURS) {
            state.nightGrace = false;
            this.clearPendingPeeks(room);
            return this.endNight(room);
        }
        state.clock += 1;
        const clock = state.clock;
        const thiefId = this.getThiefId(room);
        const thiefDie = thiefId ? this.getDie(room, thiefId) : undefined;
        if (thiefDie === clock && thiefId) {
            this.setStolen(room, true);
            const thiefName = room.players.find((p) => p.socketId === thiefId)?.name;
            const witnesses = [];
            for (const id of this.participatingIds(room)) {
                if (id === thiefId) {
                    this.privateState.set(room.code, id, CT_STOLE, true);
                    continue;
                }
                if ((this.getDie(room, id) ?? types_1.BANANA_THIEF_CLOCK_HOURS) === clock) {
                    const witnessName = room.players.find((p) => p.socketId === id)?.name;
                    if (witnessName)
                        witnesses.push(witnessName);
                    if (thiefName)
                        this.privateState.set(room.code, id, CT_SEES_THIEF, thiefName);
                }
            }
            this.privateState.set(room.code, thiefId, CT_WITNESSES, witnesses);
        }
        else {
            const soloWakees = this.participatingIds(room).filter((id) => (this.getDie(room, id) ?? types_1.BANANA_THIEF_CLOCK_HOURS) === clock);
            if (soloWakees.length === 1) {
                this.privateState.set(room.code, soloWakees[0], CT_PEEK_OFFER, true);
                this.addPendingPeek(room, soloWakees[0]);
            }
        }
        this.refreshAwakePeers(room, clock);
        this.refreshBananaStatus(room, clock);
        if (clock >= types_1.BANANA_THIEF_CLOCK_HOURS) {
            if (this.getPendingPeeks(room).length > 0) {
                state.nightGrace = true;
                const graceSeconds = Math.max(5, room.config.bananaThiefTickSeconds ?? 6);
                state.tickEndsAt = Date.now() + graceSeconds * 1000;
            }
            else {
                return this.endNight(room);
            }
        }
        else {
            const hostPaced = (room.config.bananaThiefNarrator ?? 'AUTO') === 'HOST';
            state.tickEndsAt = hostPaced
                ? null
                : Date.now() + (room.config.bananaThiefTickSeconds ?? 6) * 1000;
        }
        return room;
    }
    nextHour(room, requesterId) {
        const state = room.bananaThiefState;
        if (!state || state.phase !== types_1.BananaThiefPhase.NIGHT)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        return this.tick(room);
    }
    endNight(room) {
        const followerCount = room.config.bananaThiefFollowerCount ?? 1;
        if (followerCount > 0) {
            return this.beginChooseFollower(room);
        }
        this.beginDiscussion(room);
        return room;
    }
    beginDiscussion(room) {
        const state = room.bananaThiefState;
        state.phase = types_1.BananaThiefPhase.DISCUSSION;
        state.clock = types_1.BANANA_THIEF_CLOCK_HOURS;
        state.tickEndsAt = null;
        state.bananaStolen = true;
        state.phaseEndsAt = Date.now() + (room.config.bananaThiefDiscussionSeconds ?? 180) * 1000;
        this.clearPendingPeeks(room);
    }
    peek(room, socketId, targetId) {
        const state = room.bananaThiefState;
        if (!state || state.phase !== types_1.BananaThiefPhase.NIGHT)
            return null;
        if (!this.getPendingPeeks(room).includes(socketId))
            return null;
        if (!this.privateState.get(room.code, socketId, CT_PEEK_OFFER))
            return null;
        if (targetId === socketId)
            return null;
        const participants = new Set(this.participatingIds(room));
        if (!participants.has(targetId))
            return null;
        const die = this.getDie(room, targetId);
        if (die === undefined)
            return null;
        const targetName = room.players.find((p) => p.socketId === targetId)?.name;
        const isDetective = this.privateState.get(room.code, socketId, CT_SPECIAL) ===
            types_1.BananaThiefSpecial.DETECTIVE;
        const peekRole = isDetective
            ? (this.getRole(room, targetId) ?? types_1.BananaThiefRole.MOUSE)
            : undefined;
        this.privateState.set(room.code, socketId, CT_PEEK_RESULT, {
            targetId,
            targetName,
            die,
            ...(peekRole ? { role: peekRole } : {}),
        });
        this.privateState.delete(room.code, socketId, CT_PEEK_OFFER);
        this.removePendingPeek(room, socketId);
        return room;
    }
    startVote(room, requesterId) {
        const state = room.bananaThiefState;
        if (!state || state.phase !== types_1.BananaThiefPhase.DISCUSSION)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        return this.openBallot(room);
    }
    openBallot(room) {
        const state = room.bananaThiefState;
        const participants = this.participatingIds(room);
        if (participants.length === 0)
            return null;
        state.phase = types_1.BananaThiefPhase.VOTING;
        state.phaseEndsAt = Date.now() + (room.config.bananaThiefVoteSeconds ?? 15) * 1000;
        state.votesRecorded = 0;
        state.votesTotal = participants.length;
        this.setVotes(room, {});
        return room;
    }
    vote(room, socketId, targetId) {
        const state = room.bananaThiefState;
        if (!state || state.phase !== types_1.BananaThiefPhase.VOTING)
            return null;
        const participants = new Set(this.participatingIds(room));
        if (!participants.has(socketId) || !participants.has(targetId) || targetId === socketId) {
            return null;
        }
        const votes = this.getVotes(room);
        if (votes[socketId])
            return null;
        votes[socketId] = targetId;
        this.setVotes(room, votes);
        state.votesRecorded = Object.keys(votes).filter((v) => participants.has(v)).length;
        if (state.votesRecorded >= state.votesTotal) {
            this.finalize(room);
        }
        return room;
    }
    handleVotePhaseEnd(room) {
        const state = room.bananaThiefState;
        if (!state || state.phase !== types_1.BananaThiefPhase.VOTING)
            return null;
        this.finalize(room);
        return room;
    }
    finalize(room, fledThief = false) {
        const state = room.bananaThiefState;
        const thiefId = this.getThiefId(room);
        const followerIds = this.getFollowerIds(room);
        const votes = this.getVotes(room);
        const participants = new Set(this.participatingIds(room));
        const tally = {};
        for (const target of Object.values(votes)) {
            if (participants.has(target))
                tally[target] = (tally[target] ?? 0) + 1;
        }
        let caughtId = null;
        if (fledThief) {
            caughtId = thiefId;
        }
        else {
            let max = 0;
            let tied = false;
            for (const [id, count] of Object.entries(tally)) {
                if (count > max) {
                    max = count;
                    tied = false;
                    caughtId = id;
                }
                else if (count === max) {
                    tied = true;
                }
            }
            if (tied)
                caughtId = null;
        }
        const caughtIsGoat = !!caughtId &&
            this.privateState.get(room.code, caughtId, CT_SPECIAL) ===
                types_1.BananaThiefSpecial.SCAPEGOAT;
        const winner = caughtIsGoat
            ? 'SCAPEGOAT'
            : caughtId && caughtId === thiefId
                ? 'MICE'
                : 'THIEF';
        const scoreDeltas = {};
        for (const id of participants)
            scoreDeltas[id] = 0;
        if (winner === 'SCAPEGOAT') {
            if (caughtId)
                scoreDeltas[caughtId] = SCORE_THIEF_ESCAPE;
        }
        else if (winner === 'MICE') {
            for (const [voter, target] of Object.entries(votes)) {
                if (participants.has(voter) && target === thiefId) {
                    scoreDeltas[voter] = (scoreDeltas[voter] ?? 0) + SCORE_CORRECT_VOTE;
                }
            }
        }
        else {
            if (thiefId && participants.has(thiefId)) {
                scoreDeltas[thiefId] = (scoreDeltas[thiefId] ?? 0) + SCORE_THIEF_ESCAPE;
            }
            for (const id of followerIds) {
                if (participants.has(id)) {
                    scoreDeltas[id] = (scoreDeltas[id] ?? 0) + SCORE_FOLLOWER_ESCAPE;
                }
            }
            for (const id of participants) {
                if (scoreDeltas[id] === 0 &&
                    this.privateState.get(room.code, id, CT_SPECIAL) ===
                        types_1.BananaThiefSpecial.SYCOPHANT) {
                    scoreDeltas[id] = SCORE_FOLLOWER_ESCAPE;
                }
            }
        }
        for (const [id, delta] of Object.entries(scoreDeltas)) {
            const player = room.players.find((p) => p.socketId === id);
            if (player)
                player.score += delta;
        }
        state.phase = types_1.BananaThiefPhase.RESULT;
        state.tickEndsAt = null;
        state.phaseEndsAt = null;
        state.thiefId = thiefId;
        state.followerIds = followerIds.filter((id) => participants.has(id));
        state.votes = votes;
        state.caughtId = caughtId;
        state.dice = {};
        for (const id of participants) {
            state.dice[id] = this.getDie(room, id) ?? 0;
        }
        state.specials = {};
        for (const id of participants) {
            const special = this.privateState.get(room.code, id, CT_SPECIAL);
            if (special)
                state.specials[id] = special;
        }
        state.fledThief = fledThief;
        state.winner = winner;
        state.scoreDeltas = scoreDeltas;
        room.status = types_1.RoomStatus.RESULT;
    }
    reset(room, requesterId) {
        if (room.gameType !== types_1.GameType.BANANA_THIEF)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        room.status = types_1.RoomStatus.LOBBY;
        room.bananaThiefState = undefined;
        this.privateState.clearRoom(room.code);
        room.players.forEach((p) => {
            p.score = 0;
        });
        return room;
    }
    remapRoomSecrets(code, oldSocketId, newSocketId) {
        const thief = this.privateState.get(code, ROOM_KEY, CT_ROOM_THIEF);
        if (thief === oldSocketId) {
            this.privateState.set(code, ROOM_KEY, CT_ROOM_THIEF, newSocketId);
        }
        const followers = this.privateState.get(code, ROOM_KEY, CT_ROOM_FOLLOWERS);
        if (followers?.includes(oldSocketId)) {
            this.privateState.set(code, ROOM_KEY, CT_ROOM_FOLLOWERS, followers.map((id) => (id === oldSocketId ? newSocketId : id)));
        }
        const pendingPeeks = this.privateState.get(code, ROOM_KEY, CT_ROOM_PENDING_PEEK);
        if (pendingPeeks?.includes(oldSocketId)) {
            this.privateState.set(code, ROOM_KEY, CT_ROOM_PENDING_PEEK, pendingPeeks.map((id) => (id === oldSocketId ? newSocketId : id)));
        }
        const votes = this.privateState.get(code, ROOM_KEY, CT_ROOM_VOTES);
        if (votes) {
            const remapped = {};
            let changed = false;
            for (const [voter, target] of Object.entries(votes)) {
                const newVoter = voter === oldSocketId ? newSocketId : voter;
                const newTarget = target === oldSocketId ? newSocketId : target;
                if (newVoter !== voter || newTarget !== target)
                    changed = true;
                remapped[newVoter] = newTarget;
            }
            if (changed)
                this.privateState.set(code, ROOM_KEY, CT_ROOM_VOTES, remapped);
        }
    }
    remapSocketId(state, oldSocketId, newSocketId) {
        if (state.thiefId === oldSocketId)
            state.thiefId = newSocketId;
        if (state.caughtId === oldSocketId)
            state.caughtId = newSocketId;
        if (state.readyIds) {
            state.readyIds = state.readyIds.map((id) => (id === oldSocketId ? newSocketId : id));
        }
        if (state.followerIds) {
            state.followerIds = state.followerIds.map((id) => (id === oldSocketId ? newSocketId : id));
        }
        if (state.votes) {
            const remapped = {};
            for (const [voter, target] of Object.entries(state.votes)) {
                remapped[voter === oldSocketId ? newSocketId : voter] =
                    target === oldSocketId ? newSocketId : target;
            }
            state.votes = remapped;
        }
        if (state.scoreDeltas && oldSocketId in state.scoreDeltas) {
            state.scoreDeltas[newSocketId] = state.scoreDeltas[oldSocketId];
            delete state.scoreDeltas[oldSocketId];
        }
    }
    handlePlayerDisconnect(room, socketId) {
        const state = room.bananaThiefState;
        if (!state || state.phase === types_1.BananaThiefPhase.RESULT)
            return;
        if (this.getThiefId(room) === socketId) {
            this.finalize(room, true);
            return;
        }
        const participants = new Set(this.participatingIds(room));
        if (state.phase === types_1.BananaThiefPhase.SETUP) {
            state.readyIds = (state.readyIds ?? []).filter((id) => participants.has(id));
            if (participants.size > 0 && [...participants].every((id) => state.readyIds.includes(id))) {
                this.afterSetup(room);
            }
            return;
        }
        if (state.phase === types_1.BananaThiefPhase.CHOOSE_FOLLOWER) {
            if (this.getThiefId(room) === socketId) {
                this.finalize(room, true);
                return;
            }
        }
        if (state.phase === types_1.BananaThiefPhase.VOTING) {
            const votes = this.getVotes(room);
            state.votesRecorded = Object.keys(votes).filter((v) => participants.has(v)).length;
            state.votesTotal = participants.size;
            if (participants.size > 0 && state.votesRecorded >= state.votesTotal) {
                this.finalize(room);
            }
        }
    }
};
exports.BananaThiefService = BananaThiefService;
exports.BananaThiefService = BananaThiefService = BananaThiefService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], BananaThiefService);
//# sourceMappingURL=banana-thief.service.js.map