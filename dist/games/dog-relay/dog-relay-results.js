"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDogRelayResultRows = buildDogRelayResultRows;
const types_1 = require("@repo/types");
function buildDogRelayResultRows(room) {
    const state = room.dogRelayState;
    if (room.gameType !== types_1.GameType.DOG_RELAY ||
        room.status !== types_1.RoomStatus.RESULT ||
        state?.phase !== 'RESULT' ||
        !state.result) {
        throw new Error('DOG_RELAY_NO_RESULT');
    }
    return state.seatOrder.map((id) => {
        const player = room.players.find((candidate) => candidate.id === id);
        if (!player)
            throw new Error('DOG_RELAY_MISSING_PARTICIPANT');
        const won = state.result.winnerIds.includes(id);
        return { playerName: player.name, score: won ? 1 : 0, rank: won ? 1 : 2 };
    });
}
//# sourceMappingURL=dog-relay-results.js.map