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
exports.WerewolfService = void 0;
const common_1 = require("@nestjs/common");
const types_1 = require("@repo/types");
const private_state_service_1 = require("../private-state.service");
const ROOM_KEY = '__room__';
const K_NIGHT = 'WW_NIGHT';
const K_PAUSE = 'WW_PAUSE';
const K_DOCTOR_LAST = 'WW_DOCTOR_LAST';
const K_POTIONS = 'WW_WITCH_POTIONS';
const K_DAY_VOTES = 'WW_DAY_VOTES';
const K_HUNTER_DAY_SHOT = 'WW_HUNTER_DAY_SHOT';
const K_LYNCHED_HUNTER = 'WW_LYNCHED_HUNTER';
const K_AFTER_RESULT = 'WW_AFTER_RESULT';
const WW_RECONNECT_GRACE_MS = 60_000;
const RESULT_DWELL_MS = 8_000;
let WerewolfService = class WerewolfService {
    constructor(privateStateService) {
        this.privateStateService = privateStateService;
    }
    nightSeconds(room) {
        return room.config.werewolfNightSeconds ?? 20;
    }
    discussionSeconds(room) {
        return room.config.werewolfDiscussionSeconds ?? 180;
    }
    voteSeconds(room) {
        return room.config.werewolfVoteSeconds ?? 60;
    }
    playerBySocket(room, socketId) {
        return room.players.find((p) => p.socketId === socketId && !p.isViewer);
    }
    playerById(room, playerId) {
        return room.players.find((p) => p.id === playerId);
    }
    keyOf(room, playerId) {
        if (!playerId)
            return null;
        return this.playerById(room, playerId)?.socketId ?? null;
    }
    roleOf(room, socketId) {
        return this.privateStateService.get(room.code, socketId, 'wwRole');
    }
    roleOfId(room, playerId) {
        const player = this.playerById(room, playerId);
        return player ? this.roleOf(room, player.socketId) : undefined;
    }
    nameOf(room, playerId) {
        return this.playerById(room, playerId)?.name ?? '?';
    }
    livingWolves(room, state) {
        return Object.keys(state.players).filter((key) => state.players[key].alive && this.roleOf(room, key) === types_1.WerewolfRole.WEREWOLF);
    }
    livingCount(state) {
        return Object.values(state.players).filter((view) => view.alive).length;
    }
    nightRecord(room) {
        return (this.privateStateService.get(room.code, ROOM_KEY, K_NIGHT) ?? {
            killVotes: {},
            bittenPlayerId: null,
            killSettled: false,
            checkTargetPlayerId: null,
            doctorHealPlayerId: null,
            witchHealPlayerId: null,
            witchPoisonPlayerId: null,
            hunterShotTargetPlayerId: null,
            hunterShotHunterId: null,
        });
    }
    potions(room, playerId) {
        const all = this.privateStateService.get(room.code, ROOM_KEY, K_POTIONS) ??
            {};
        return all[playerId] ?? { healUsed: false, poisonUsed: false };
    }
    consumePotion(room, playerId, kind) {
        const all = this.privateStateService.get(room.code, ROOM_KEY, K_POTIONS) ??
            {};
        const mine = all[playerId] ?? { healUsed: false, poisonUsed: false };
        if (kind === 'heal')
            mine.healUsed = true;
        else
            mine.poisonUsed = true;
        all[playerId] = mine;
        this.privateStateService.set(room.code, ROOM_KEY, K_POTIONS, all);
    }
    biteWillLand(night) {
        return (night.bittenPlayerId !== null &&
            night.bittenPlayerId !== night.doctorHealPlayerId &&
            night.bittenPlayerId !== night.witchHealPlayerId);
    }
    startGame(room, requesterId) {
        if (room.gameType !== types_1.GameType.WEREWOLF)
            return null;
        if (room.status !== types_1.RoomStatus.LOBBY)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        const seated = room.players.filter((p) => !p.isViewer && p.connected !== false);
        if (seated.length < types_1.WEREWOLF_MIN_PLAYERS || seated.length > types_1.WEREWOLF_MAX_PLAYERS) {
            return null;
        }
        const { roles } = (0, types_1.getWerewolfRoleTable)(seated.length, {
            witchEnabled: room.config.werewolfWitchEnabled !== false,
            hunterEnabled: room.config.werewolfHunterEnabled !== false,
        });
        const shuffled = this.shuffle(roles);
        const players = {};
        const wolfNames = [];
        seated.forEach((player, index) => {
            const role = shuffled[index];
            players[player.socketId] = { alive: true };
            this.privateStateService.set(room.code, player.socketId, 'wwRole', role);
            if (role === types_1.WerewolfRole.WEREWOLF)
                wolfNames.push(player.name);
        });
        if ((room.config.werewolfWolfReveal ?? types_1.WerewolfWolfRevealMode.EYE_CONTACT) ===
            types_1.WerewolfWolfRevealMode.PRIVATE_ROSTER) {
            for (const player of seated) {
                if (this.roleOf(room, player.socketId) === types_1.WerewolfRole.WEREWOLF) {
                    this.privateStateService.set(room.code, player.socketId, 'wwWolves', [...wolfNames]);
                }
            }
        }
        room.werewolfState = {
            phase: types_1.WerewolfPhase.NIGHT,
            phaseEndsAt: null,
            night: 0,
            paused: false,
            players,
            nightSlots: (0, types_1.getWerewolfNightSlots)(shuffled),
            nightSlotIndex: -1,
            dawn: null,
            voteProgress: null,
            voteResult: null,
            hunterShot: null,
            winner: null,
        };
        room.status = types_1.RoomStatus.PLAYING;
        this.beginNight(room);
        return room;
    }
    reset(room, requesterId) {
        if (room.gameType !== types_1.GameType.WEREWOLF)
            return null;
        if (room.roomHostId !== requesterId)
            return null;
        this.privateStateService.clearRoom(room.code);
        room.werewolfState = undefined;
        room.status = types_1.RoomStatus.LOBBY;
        return room;
    }
    beginNight(room) {
        const state = room.werewolfState;
        state.phase = types_1.WerewolfPhase.NIGHT;
        state.night += 1;
        state.dawn = null;
        state.voteProgress = null;
        state.voteResult = null;
        state.hunterShot = null;
        state.paused = false;
        this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, {
            killVotes: {},
            bittenPlayerId: null,
            killSettled: false,
            checkTargetPlayerId: null,
            doctorHealPlayerId: null,
            witchHealPlayerId: null,
            witchPoisonPlayerId: null,
            hunterShotTargetPlayerId: null,
            hunterShotHunterId: null,
        });
        this.privateStateService.delete(room.code, ROOM_KEY, K_DAY_VOTES);
        this.privateStateService.delete(room.code, ROOM_KEY, K_HUNTER_DAY_SHOT);
        this.privateStateService.delete(room.code, ROOM_KEY, K_LYNCHED_HUNTER);
        this.beginSlot(room, 0);
    }
    livingTargetNames(room, state) {
        return Object.keys(state.players)
            .filter((key) => state.players[key].alive)
            .map((key) => ({ id: key, name: this.playerBySocket(room, key)?.name ?? '?' }));
    }
    beginSlot(room, slotIndex) {
        const state = room.werewolfState;
        state.nightSlotIndex = slotIndex;
        const slot = state.nightSlots[slotIndex];
        state.phaseEndsAt = Date.now() + this.nightSeconds(room) * 1000;
        for (const key of Object.keys(state.players)) {
            this.privateStateService.delete(room.code, key, 'wwNight');
        }
        const livingNames = this.livingTargetNames(room, state);
        switch (slot) {
            case 'WOLVES': {
                const wolves = this.livingWolves(room, state);
                if (wolves.length === 0)
                    break;
                const coordination = room.config.werewolfWolfCoordination ?? types_1.WerewolfWolfCoordinationMode.SECRET_BALLOT;
                for (const key of wolves) {
                    this.privateStateService.set(room.code, key, 'wwNight', {
                        kind: types_1.WerewolfNightActionKind.KILL,
                        targets: livingNames.filter((t) => t.id !== key),
                        showTally: coordination === types_1.WerewolfWolfCoordinationMode.LIVE_TALLY,
                    });
                }
                if (coordination === types_1.WerewolfWolfCoordinationMode.LIVE_TALLY) {
                    for (const key of wolves) {
                        this.privateStateService.set(room.code, key, 'wwTally', {});
                    }
                }
                break;
            }
            case 'SEER': {
                const seer = livingNames.find((t) => this.roleOf(room, t.id) === types_1.WerewolfRole.SEER);
                if (!seer)
                    break;
                this.privateStateService.set(room.code, seer.id, 'wwNight', {
                    kind: types_1.WerewolfNightActionKind.CHECK,
                    targets: livingNames.filter((t) => t.id !== seer.id),
                });
                break;
            }
            case 'DOCTOR': {
                const doctor = livingNames.find((t) => this.roleOf(room, t.id) === types_1.WerewolfRole.DOCTOR);
                if (!doctor)
                    break;
                const lastHealed = this.keyOf(room, this.privateStateService.get(room.code, ROOM_KEY, K_DOCTOR_LAST));
                this.privateStateService.set(room.code, doctor.id, 'wwNight', {
                    kind: types_1.WerewolfNightActionKind.HEAL,
                    targets: livingNames.filter((t) => t.id !== lastHealed),
                });
                break;
            }
            case 'WITCH': {
                const witch = livingNames.find((t) => this.roleOf(room, t.id) === types_1.WerewolfRole.WITCH);
                if (!witch)
                    break;
                const night = this.nightRecord(room);
                const potions = this.potions(room, this.playerBySocket(room, witch.id).id);
                if (potions.healUsed && potions.poisonUsed)
                    break;
                const victimKey = night.killSettled ? this.keyOf(room, night.bittenPlayerId) : null;
                this.privateStateService.set(room.code, witch.id, 'wwNight', {
                    kind: types_1.WerewolfNightActionKind.HEAL,
                    targets: livingNames.filter((t) => t.id !== witch.id),
                    victimId: victimKey,
                    victimName: victimKey ? (this.playerBySocket(room, victimKey)?.name ?? null) : null,
                    healRemaining: !potions.healUsed,
                    poisonRemaining: !potions.poisonUsed,
                });
                break;
            }
            case 'HUNTER_SHOT': {
                const night = this.nightRecord(room);
                const biteOnHunter = this.biteWillLand(night) &&
                    this.roleOfId(room, night.bittenPlayerId) === types_1.WerewolfRole.HUNTER;
                night.hunterShotHunterId = biteOnHunter ? night.bittenPlayerId : null;
                this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
                if (!night.hunterShotHunterId)
                    break;
                const hunterKey = this.keyOf(room, night.hunterShotHunterId);
                if (!hunterKey)
                    break;
                this.privateStateService.set(room.code, hunterKey, 'wwNight', {
                    kind: types_1.WerewolfNightActionKind.SHOT,
                    targets: livingNames.filter((t) => t.id !== hunterKey),
                });
                break;
            }
        }
    }
    handlePhaseTimeout(room, expectedDeadline) {
        const state = room.werewolfState;
        if (!state || room.status !== types_1.RoomStatus.PLAYING)
            return null;
        if (state.paused || state.phaseEndsAt !== expectedDeadline)
            return null;
        if (state.phase === types_1.WerewolfPhase.NIGHT) {
            const night = this.nightRecord(room);
            this.settleSlot(room, state, night);
            const next = state.nightSlotIndex + 1;
            if (next < state.nightSlots.length) {
                this.beginSlot(room, next);
            }
            else {
                this.resolveNight(room);
            }
            return room;
        }
        if (state.phase === types_1.WerewolfPhase.DAY_DISCUSSION) {
            this.beginVote(room);
            return room;
        }
        if (state.phase === types_1.WerewolfPhase.DAY_VOTE) {
            this.resolveVote(room);
            return room;
        }
        if (state.phase === types_1.WerewolfPhase.DAY_RESULT) {
            if (this.privateStateService.get(room.code, ROOM_KEY, K_AFTER_RESULT) === 'SHOT') {
                this.beginDayHunterShot(room);
            }
            else {
                this.beginNight(room);
            }
            return room;
        }
        if (state.phase === types_1.WerewolfPhase.DAY_HUNTER_SHOT) {
            this.resolveHunterShot(room);
            return room;
        }
        return null;
    }
    settleSlot(room, state, night) {
        const slot = state.nightSlots[state.nightSlotIndex];
        switch (slot) {
            case 'WOLVES': {
                if (night.killSettled)
                    break;
                const wolves = this.livingWolves(room, state);
                const wolfIds = new Set(wolves.map((key) => this.playerBySocket(room, key)?.id).filter(Boolean));
                const cast = Object.entries(night.killVotes).filter(([voterId]) => wolfIds.has(voterId));
                const targets = cast.map(([, targetId]) => targetId);
                const coordination = room.config.werewolfWolfCoordination ?? types_1.WerewolfWolfCoordinationMode.SECRET_BALLOT;
                let bitten = null;
                if (coordination === types_1.WerewolfWolfCoordinationMode.SILENT_CONSENSUS) {
                    const unanimous = wolves.length > 0 &&
                        cast.length === wolves.length &&
                        targets.every((t) => t === targets[0]);
                    bitten = unanimous ? targets[0] : null;
                }
                else {
                    const counts = new Map();
                    for (const target of targets)
                        counts.set(target, (counts.get(target) ?? 0) + 1);
                    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
                    if (sorted.length > 0 && (sorted.length === 1 || sorted[0][1] > sorted[1][1])) {
                        bitten = sorted[0][0];
                    }
                }
                night.bittenPlayerId = bitten;
                night.killSettled = true;
                this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
                break;
            }
            case 'SEER': {
                const seerKey = Object.keys(state.players).find((key) => state.players[key].alive && this.roleOf(room, key) === types_1.WerewolfRole.SEER);
                if (seerKey && night.checkTargetPlayerId) {
                    const targetKey = this.keyOf(room, night.checkTargetPlayerId);
                    if (targetKey) {
                        const visions = this.privateStateService.get(room.code, seerKey, 'wwVisions') ?? [];
                        visions.push({
                            night: state.night,
                            targetName: this.nameOf(room, night.checkTargetPlayerId),
                            isWolf: this.roleOfId(room, night.checkTargetPlayerId) === types_1.WerewolfRole.WEREWOLF,
                        });
                        this.privateStateService.set(room.code, seerKey, 'wwVisions', visions);
                    }
                }
                break;
            }
            case 'DOCTOR': {
                if (night.doctorHealPlayerId) {
                    this.privateStateService.set(room.code, ROOM_KEY, K_DOCTOR_LAST, night.doctorHealPlayerId);
                }
                break;
            }
            case 'WITCH':
            case 'HUNTER_SHOT':
                break;
        }
    }
    resolveNight(room) {
        const state = room.werewolfState;
        const night = this.nightRecord(room);
        const deaths = [];
        if (this.biteWillLand(night))
            deaths.push({ playerId: night.bittenPlayerId });
        if (night.witchPoisonPlayerId)
            deaths.push({ playerId: night.witchPoisonPlayerId });
        if (night.hunterShotTargetPlayerId) {
            deaths.push({ playerId: night.hunterShotTargetPlayerId, cause: 'SHOT' });
        }
        this.markDeaths(room, state, deaths);
        state.dawn = {
            night: state.night,
            deaths: this.toAnnouncements(room, deaths),
        };
        const winner = this.checkWinner(room, state);
        if (winner) {
            this.finishGame(room, state, winner);
            return;
        }
        state.phase = types_1.WerewolfPhase.DAY_DISCUSSION;
        state.phaseEndsAt = Date.now() + this.discussionSeconds(room) * 1000;
    }
    beginVote(room) {
        const state = room.werewolfState;
        state.phase = types_1.WerewolfPhase.DAY_VOTE;
        state.phaseEndsAt = Date.now() + this.voteSeconds(room) * 1000;
        this.privateStateService.set(room.code, ROOM_KEY, K_DAY_VOTES, {});
        state.voteProgress = { cast: 0, total: this.livingCount(state) };
        for (const key of Object.keys(state.players)) {
            this.privateStateService.set(room.code, key, 'wwDayVote', null);
        }
    }
    resolveVote(room) {
        const state = room.werewolfState;
        const votes = this.privateStateService.get(room.code, ROOM_KEY, K_DAY_VOTES) ?? {};
        const counts = new Map();
        for (const targetId of Object.values(votes)) {
            if (targetId === 'ABSTAIN')
                continue;
            counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
        }
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const lynchedPlayerId = sorted.length > 0 && (sorted.length === 1 || sorted[0][1] > sorted[1][1])
            ? sorted[0][0]
            : null;
        const publicVotes = {};
        for (const [voterId, targetId] of Object.entries(votes)) {
            const voterKey = this.keyOf(room, voterId);
            const targetKey = targetId === 'ABSTAIN' ? 'ABSTAIN' : this.keyOf(room, targetId);
            if (voterKey && targetKey)
                publicVotes[voterKey] = targetKey;
        }
        state.voteResult = {
            lynchedPlayerId: this.keyOf(room, lynchedPlayerId),
            votes: publicVotes,
        };
        state.voteProgress = null;
        if (lynchedPlayerId) {
            this.markDeaths(room, state, [{ playerId: lynchedPlayerId }]);
        }
        const winner = this.checkWinner(room, state);
        if (winner) {
            this.finishGame(room, state, winner);
            return;
        }
        const lynchedWasHunter = lynchedPlayerId !== null && this.roleOfId(room, lynchedPlayerId) === types_1.WerewolfRole.HUNTER;
        this.privateStateService.set(room.code, ROOM_KEY, K_AFTER_RESULT, lynchedWasHunter ? 'SHOT' : 'NIGHT');
        if (lynchedWasHunter) {
            this.privateStateService.set(room.code, ROOM_KEY, K_LYNCHED_HUNTER, lynchedPlayerId);
        }
        state.phase = types_1.WerewolfPhase.DAY_RESULT;
        state.phaseEndsAt = Date.now() + RESULT_DWELL_MS;
    }
    beginDayHunterShot(room) {
        const state = room.werewolfState;
        const lynchedPlayerId = this.privateStateService.get(room.code, ROOM_KEY, K_LYNCHED_HUNTER);
        const hunterKey = this.keyOf(room, lynchedPlayerId);
        if (!lynchedPlayerId || !hunterKey) {
            this.beginNight(room);
            return;
        }
        state.phase = types_1.WerewolfPhase.DAY_HUNTER_SHOT;
        state.phaseEndsAt = Date.now() + this.nightSeconds(room) * 1000;
        state.hunterShot = {
            hunterId: hunterKey,
            hunterName: this.nameOf(room, lynchedPlayerId),
        };
        this.privateStateService.set(room.code, hunterKey, 'wwNight', {
            kind: types_1.WerewolfNightActionKind.SHOT,
            targets: this.livingTargetNames(room, state).filter((t) => t.id !== hunterKey),
        });
    }
    resolveHunterShot(room) {
        const state = room.werewolfState;
        const targetPlayerId = this.privateStateService.get(room.code, ROOM_KEY, K_HUNTER_DAY_SHOT);
        let deaths = [];
        if (targetPlayerId) {
            this.markDeaths(room, state, [{ playerId: targetPlayerId, cause: 'SHOT' }]);
            deaths = [{ playerId: targetPlayerId, cause: 'SHOT' }];
        }
        state.dawn = {
            night: state.night,
            deaths: this.toAnnouncements(room, deaths),
        };
        const winner = this.checkWinner(room, state);
        if (winner) {
            this.finishGame(room, state, winner);
            return;
        }
        this.privateStateService.set(room.code, ROOM_KEY, K_AFTER_RESULT, 'NIGHT');
        state.phase = types_1.WerewolfPhase.DAY_RESULT;
        state.phaseEndsAt = Date.now() + RESULT_DWELL_MS;
    }
    checkWinner(room, state) {
        const annotated = room.players
            .filter((p) => !p.isViewer && state.players[p.socketId])
            .map((p) => ({
            alive: state.players[p.socketId].alive,
            isWolf: this.roleOf(room, p.socketId) === types_1.WerewolfRole.WEREWOLF,
        }));
        return (0, types_1.evaluateWerewolfWinner)(annotated);
    }
    finishGame(room, state, winner) {
        state.phase = types_1.WerewolfPhase.GAME_OVER;
        state.winner = winner;
        state.phaseEndsAt = null;
        state.paused = false;
        state.nightSlotIndex = -1;
        for (const player of room.players) {
            if (player.isViewer)
                continue;
            const view = state.players[player.socketId];
            if (!view)
                continue;
            view.finalRole = this.roleOf(room, player.socketId);
            const isWinner = winner === 'WOLVES'
                ? view.finalRole === types_1.WerewolfRole.WEREWOLF
                : view.finalRole !== types_1.WerewolfRole.WEREWOLF;
            if (isWinner)
                player.score += 1;
        }
        room.status = types_1.RoomStatus.RESULT;
    }
    markDeaths(room, state, deaths) {
        for (const death of deaths) {
            const key = this.keyOf(room, death.playerId);
            const role = this.roleOfId(room, death.playerId);
            if (!key)
                continue;
            const view = state.players[key];
            if (!view || !view.alive)
                continue;
            view.alive = false;
            view.revealedRole = role;
        }
    }
    toAnnouncements(room, deaths) {
        return deaths.flatMap((death) => {
            const key = this.keyOf(room, death.playerId);
            const role = this.roleOfId(room, death.playerId);
            if (!key || !role)
                return [];
            return [
                {
                    playerId: key,
                    name: this.nameOf(room, death.playerId),
                    role,
                    cause: death.cause,
                },
            ];
        });
    }
    handleNightAction(room, socketId, action, targetId) {
        const state = room.werewolfState;
        if (!state || room.status !== types_1.RoomStatus.PLAYING || state.paused)
            return null;
        const actor = this.playerBySocket(room, socketId);
        if (!actor)
            return null;
        const view = state.players[socketId];
        const role = this.roleOf(room, socketId);
        if (!view || !role)
            return null;
        const night = this.nightRecord(room);
        const targetKey = state.players[targetId] ? targetId : null;
        const targetPlayer = targetKey ? this.playerBySocket(room, targetKey) : undefined;
        if (!targetPlayer)
            return null;
        if (action === types_1.WerewolfNightActionKind.SHOT) {
            return this.handleShot(room, state, night, socketId, actor.id, targetKey, targetPlayer);
        }
        if (state.phase !== types_1.WerewolfPhase.NIGHT)
            return null;
        const expectedSlot = this.slotForAction(action, role);
        if (!expectedSlot || state.nightSlots[state.nightSlotIndex] !== expectedSlot)
            return null;
        switch (action) {
            case types_1.WerewolfNightActionKind.KILL: {
                if (role !== types_1.WerewolfRole.WEREWOLF || !view.alive)
                    return null;
                if (!state.players[targetKey].alive || targetKey === socketId)
                    return null;
                night.killVotes[actor.id] = targetPlayer.id;
                this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
                this.refreshWolfTally(room, state);
                const coordination = room.config.werewolfWolfCoordination ?? types_1.WerewolfWolfCoordinationMode.SECRET_BALLOT;
                this.privateStateService.set(room.code, socketId, 'wwNight', {
                    kind: action,
                    targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
                    showTally: coordination === types_1.WerewolfWolfCoordinationMode.LIVE_TALLY,
                    submittedTargetName: targetPlayer.name,
                });
                return room;
            }
            case types_1.WerewolfNightActionKind.CHECK: {
                if (role !== types_1.WerewolfRole.SEER || !view.alive)
                    return null;
                if (!state.players[targetKey].alive || targetKey === socketId)
                    return null;
                night.checkTargetPlayerId = targetPlayer.id;
                this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
                this.privateStateService.set(room.code, socketId, 'wwNight', {
                    kind: action,
                    targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
                    submittedTargetName: targetPlayer.name,
                });
                return room;
            }
            case types_1.WerewolfNightActionKind.HEAL: {
                if (role === types_1.WerewolfRole.DOCTOR) {
                    if (!view.alive)
                        return null;
                    if (!state.players[targetKey].alive)
                        return null;
                    const lastHealed = this.keyOf(room, this.privateStateService.get(room.code, ROOM_KEY, K_DOCTOR_LAST));
                    if (targetKey === lastHealed)
                        return null;
                    night.doctorHealPlayerId = targetPlayer.id;
                    this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
                    this.privateStateService.set(room.code, socketId, 'wwNight', {
                        kind: action,
                        targets: [],
                        submittedTargetName: targetPlayer.name,
                    });
                    return room;
                }
                if (role === types_1.WerewolfRole.WITCH) {
                    if (!view.alive)
                        return null;
                    const potions = this.potions(room, actor.id);
                    if (potions.healUsed || potions.poisonUsed)
                        return null;
                    if (!night.killSettled || !night.bittenPlayerId)
                        return null;
                    const victimKey = this.keyOf(room, night.bittenPlayerId);
                    if (targetKey !== victimKey)
                        return null;
                    night.witchHealPlayerId = night.bittenPlayerId;
                    this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
                    this.consumePotion(room, actor.id, 'heal');
                    this.privateStateService.set(room.code, socketId, 'wwNight', {
                        kind: action,
                        targets: [],
                        submittedTargetName: this.nameOf(room, night.bittenPlayerId),
                    });
                    return room;
                }
                return null;
            }
            case types_1.WerewolfNightActionKind.POISON: {
                if (role !== types_1.WerewolfRole.WITCH || !view.alive)
                    return null;
                const potions = this.potions(room, actor.id);
                if (potions.healUsed || potions.poisonUsed)
                    return null;
                if (!state.players[targetKey].alive || targetKey === socketId)
                    return null;
                night.witchPoisonPlayerId = targetPlayer.id;
                this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
                this.consumePotion(room, actor.id, 'poison');
                this.privateStateService.set(room.code, socketId, 'wwNight', {
                    kind: action,
                    targets: [],
                    submittedTargetName: targetPlayer.name,
                });
                return room;
            }
            default:
                return null;
        }
    }
    handleShot(room, state, night, socketId, actorPlayerId, targetKey, targetPlayer) {
        const role = this.roleOf(room, socketId);
        const view = state.players[socketId];
        if (role !== types_1.WerewolfRole.HUNTER)
            return null;
        if (!view)
            return null;
        if (state.phase === types_1.WerewolfPhase.NIGHT) {
            if (state.nightSlots[state.nightSlotIndex] !== 'HUNTER_SHOT')
                return null;
            if (night.hunterShotHunterId !== actorPlayerId)
                return null;
            if (!state.players[targetKey].alive || targetKey === socketId)
                return null;
            night.hunterShotTargetPlayerId = targetPlayer.id;
            this.privateStateService.set(room.code, ROOM_KEY, K_NIGHT, night);
        }
        else if (state.phase === types_1.WerewolfPhase.DAY_HUNTER_SHOT) {
            if (!state.players[targetKey].alive || targetKey === socketId)
                return null;
            this.privateStateService.set(room.code, ROOM_KEY, K_HUNTER_DAY_SHOT, targetPlayer.id);
        }
        else {
            return null;
        }
        this.privateStateService.set(room.code, socketId, 'wwNight', {
            kind: types_1.WerewolfNightActionKind.SHOT,
            targets: [],
            submittedTargetName: targetPlayer.name,
        });
        return room;
    }
    slotForAction(action, role) {
        switch (action) {
            case types_1.WerewolfNightActionKind.KILL:
                return role === types_1.WerewolfRole.WEREWOLF ? 'WOLVES' : null;
            case types_1.WerewolfNightActionKind.CHECK:
                return role === types_1.WerewolfRole.SEER ? 'SEER' : null;
            case types_1.WerewolfNightActionKind.HEAL:
                if (role === types_1.WerewolfRole.DOCTOR)
                    return 'DOCTOR';
                if (role === types_1.WerewolfRole.WITCH)
                    return 'WITCH';
                return null;
            case types_1.WerewolfNightActionKind.POISON:
                return role === types_1.WerewolfRole.WITCH ? 'WITCH' : null;
            default:
                return null;
        }
    }
    refreshWolfTally(room, state) {
        const coordination = room.config.werewolfWolfCoordination ?? types_1.WerewolfWolfCoordinationMode.SECRET_BALLOT;
        if (coordination !== types_1.WerewolfWolfCoordinationMode.LIVE_TALLY)
            return;
        const night = this.nightRecord(room);
        const tally = {};
        for (const [voterId, targetId] of Object.entries(night.killVotes)) {
            tally[this.nameOf(room, voterId)] = this.nameOf(room, targetId);
        }
        for (const key of this.livingWolves(room, state)) {
            this.privateStateService.set(room.code, key, 'wwTally', tally);
        }
    }
    handleDayVote(room, socketId, targetId) {
        const state = room.werewolfState;
        if (!state || room.status !== types_1.RoomStatus.PLAYING)
            return null;
        if (state.phase !== types_1.WerewolfPhase.DAY_VOTE || state.paused)
            return null;
        const actor = this.playerBySocket(room, socketId);
        const view = state.players[socketId];
        if (!actor || !view || !view.alive)
            return null;
        if (targetId !== 'ABSTAIN') {
            if (!state.players[targetId] || !state.players[targetId].alive)
                return null;
            if (targetId === socketId)
                return null;
        }
        const votes = this.privateStateService.get(room.code, ROOM_KEY, K_DAY_VOTES) ?? {};
        const hadVoted = actor.id in votes;
        votes[actor.id] = targetId === 'ABSTAIN' ? 'ABSTAIN' : this.playerBySocket(room, targetId).id;
        this.privateStateService.set(room.code, ROOM_KEY, K_DAY_VOTES, votes);
        if (!hadVoted) {
            state.voteProgress = {
                cast: (state.voteProgress?.cast ?? 0) + 1,
                total: state.voteProgress?.total ?? this.livingCount(state),
            };
        }
        this.privateStateService.set(room.code, socketId, 'wwDayVote', targetId === 'ABSTAIN' ? 'ABSTAIN' : (this.playerBySocket(room, targetId)?.name ?? null));
        return room;
    }
    handlePlayerDisconnect(room, socketId) {
        const state = room.werewolfState;
        if (!state || state.phase === types_1.WerewolfPhase.GAME_OVER)
            return;
        const player = room.players.find((p) => p.socketId === socketId);
        if (player) {
            if (!player.isViewer && state.players[socketId]?.alive) {
                this.pausePhase(room, player.id);
            }
            return;
        }
        this.eliminateRemoved(room, socketId);
    }
    handleReconnect(room, playerId) {
        const state = room.werewolfState;
        if (!state || state.phase === types_1.WerewolfPhase.GAME_OVER)
            return;
        this.resumeIfAllBack(room);
        const player = this.playerById(room, playerId);
        if (!player)
            return;
        this.refreshPrivateViews(room, player.socketId);
    }
    pausePhase(room, playerId) {
        const state = room.werewolfState;
        const now = Date.now();
        let pause = this.privateStateService.get(room.code, ROOM_KEY, K_PAUSE);
        if (!pause) {
            pause = {
                remainingMs: Math.max(0, (state.phaseEndsAt ?? now) - now),
                graceEndsAtById: {},
            };
            state.paused = true;
            state.phaseEndsAt = null;
        }
        pause.graceEndsAtById[playerId] = now + WW_RECONNECT_GRACE_MS;
        this.privateStateService.set(room.code, ROOM_KEY, K_PAUSE, pause);
    }
    resumeIfAllBack(room) {
        const state = room.werewolfState;
        if (!state)
            return;
        const pause = this.privateStateService.get(room.code, ROOM_KEY, K_PAUSE);
        if (!pause)
            return;
        const stillAway = room.players.some((p) => p.connected === false && !p.isViewer && state.players[p.socketId]?.alive === true);
        if (stillAway)
            return;
        state.paused = false;
        state.phaseEndsAt = Date.now() + pause.remainingMs;
        this.privateStateService.delete(room.code, ROOM_KEY, K_PAUSE);
    }
    eliminateRemoved(room, socketId) {
        const state = room.werewolfState;
        if (!state)
            return;
        const view = state.players[socketId];
        if (view && view.alive) {
            view.alive = false;
            const winner = this.checkWinner(room, state);
            const livingCount = this.livingCount(state);
            if (winner === 'WOLVES' || winner === 'VILLAGE' || livingCount < 3) {
                this.privateStateService.clearRoom(room.code);
                room.werewolfState = undefined;
                room.status = types_1.RoomStatus.LOBBY;
                return;
            }
        }
        this.resumeIfAllBack(room);
        if (room.werewolfState)
            this.refreshAllNightPrompts(room);
    }
    refreshPrivateViews(room, socketId) {
        const state = room.werewolfState;
        if (!state)
            return;
        if (state.phase === types_1.WerewolfPhase.NIGHT) {
            this.rebuildNightPrompt(room, socketId);
        }
        if (state.phase === types_1.WerewolfPhase.DAY_HUNTER_SHOT) {
            const shotHunterId = this.privateStateService.get(room.code, ROOM_KEY, K_LYNCHED_HUNTER);
            if (shotHunterId && this.keyOf(room, shotHunterId) === socketId) {
                const shotTargetId = this.privateStateService.get(room.code, ROOM_KEY, K_HUNTER_DAY_SHOT);
                this.privateStateService.set(room.code, socketId, 'wwNight', {
                    kind: types_1.WerewolfNightActionKind.SHOT,
                    targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
                    submittedTargetName: shotTargetId ? this.nameOf(room, shotTargetId) : null,
                });
            }
        }
    }
    refreshAllNightPrompts(room) {
        const state = room.werewolfState;
        if (!state || state.phase !== types_1.WerewolfPhase.NIGHT)
            return;
        for (const player of room.players) {
            if (player.isViewer)
                continue;
            this.rebuildNightPrompt(room, player.socketId);
        }
    }
    rebuildNightPrompt(room, socketId) {
        const state = room.werewolfState;
        const view = state.players[socketId];
        const role = this.roleOf(room, socketId);
        if (!view || !role)
            return;
        const night = this.nightRecord(room);
        const slot = state.nightSlots[state.nightSlotIndex];
        const actorPlayerId = this.playerBySocket(room, socketId)?.id;
        switch (slot) {
            case 'WOLVES': {
                if (role !== types_1.WerewolfRole.WEREWOLF || !view.alive)
                    return;
                const votedFor = actorPlayerId ? night.killVotes[actorPlayerId] : undefined;
                const coordination = room.config.werewolfWolfCoordination ?? types_1.WerewolfWolfCoordinationMode.SECRET_BALLOT;
                this.privateStateService.set(room.code, socketId, 'wwNight', {
                    kind: types_1.WerewolfNightActionKind.KILL,
                    targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
                    showTally: coordination === types_1.WerewolfWolfCoordinationMode.LIVE_TALLY,
                    submittedTargetName: votedFor ? this.nameOf(room, votedFor) : null,
                });
                return;
            }
            case 'SEER': {
                if (role !== types_1.WerewolfRole.SEER || !view.alive)
                    return;
                this.privateStateService.set(room.code, socketId, 'wwNight', {
                    kind: types_1.WerewolfNightActionKind.CHECK,
                    targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
                    submittedTargetName: night.checkTargetPlayerId
                        ? this.nameOf(room, night.checkTargetPlayerId)
                        : null,
                });
                return;
            }
            case 'DOCTOR': {
                if (role !== types_1.WerewolfRole.DOCTOR || !view.alive)
                    return;
                const lastHealed = this.keyOf(room, this.privateStateService.get(room.code, ROOM_KEY, K_DOCTOR_LAST));
                this.privateStateService.set(room.code, socketId, 'wwNight', {
                    kind: types_1.WerewolfNightActionKind.HEAL,
                    targets: this.livingTargetNames(room, state).filter((t) => t.id !== lastHealed),
                    submittedTargetName: night.doctorHealPlayerId
                        ? this.nameOf(room, night.doctorHealPlayerId)
                        : null,
                });
                return;
            }
            case 'WITCH': {
                if (role !== types_1.WerewolfRole.WITCH || !view.alive)
                    return;
                const potions = this.potions(room, actorPlayerId);
                if (potions.healUsed || potions.poisonUsed) {
                    this.privateStateService.delete(room.code, socketId, 'wwNight');
                    return;
                }
                const victimKey = night.killSettled ? this.keyOf(room, night.bittenPlayerId) : null;
                this.privateStateService.set(room.code, socketId, 'wwNight', {
                    kind: types_1.WerewolfNightActionKind.HEAL,
                    targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
                    victimId: victimKey,
                    victimName: victimKey ? (this.playerBySocket(room, victimKey)?.name ?? null) : null,
                    healRemaining: !potions.healUsed,
                    poisonRemaining: !potions.poisonUsed,
                });
                return;
            }
            case 'HUNTER_SHOT': {
                if (role !== types_1.WerewolfRole.HUNTER)
                    return;
                if (night.hunterShotHunterId !== actorPlayerId)
                    return;
                this.privateStateService.set(room.code, socketId, 'wwNight', {
                    kind: types_1.WerewolfNightActionKind.SHOT,
                    targets: this.livingTargetNames(room, state).filter((t) => t.id !== socketId),
                    submittedTargetName: night.hunterShotTargetPlayerId
                        ? this.nameOf(room, night.hunterShotTargetPlayerId)
                        : null,
                });
                return;
            }
        }
    }
    remapSocketId(state, oldSocketId, newSocketId) {
        if (state.players[oldSocketId]) {
            state.players[newSocketId] = state.players[oldSocketId];
            delete state.players[oldSocketId];
        }
        if (state.dawn) {
            for (const death of state.dawn.deaths) {
                if (death.playerId === oldSocketId)
                    death.playerId = newSocketId;
            }
        }
        if (state.voteResult) {
            if (state.voteResult.lynchedPlayerId === oldSocketId) {
                state.voteResult.lynchedPlayerId = newSocketId;
            }
            const remappedVotes = {};
            for (const [voterKey, targetKey] of Object.entries(state.voteResult.votes)) {
                remappedVotes[voterKey === oldSocketId ? newSocketId : voterKey] =
                    targetKey === oldSocketId ? newSocketId : targetKey;
            }
            state.voteResult.votes = remappedVotes;
        }
        if (state.hunterShot?.hunterId === oldSocketId)
            state.hunterShot.hunterId = newSocketId;
    }
    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
};
exports.WerewolfService = WerewolfService;
exports.WerewolfService = WerewolfService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [private_state_service_1.PrivateStateService])
], WerewolfService);
//# sourceMappingURL=werewolf.service.js.map