"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncResultReveal = syncResultReveal;
exports.applyResultRevealAction = applyResultRevealAction;
const types_1 = require("@repo/types");
const crypto_1 = require("crypto");
function syncResultReveal(room, now = Date.now()) {
    const plan = (0, types_1.getResultRevealPlan)(room);
    if (!plan) {
        delete room.resultReveal;
    }
    else if (room.resultReveal?.key !== plan.key) {
        room.resultReveal = { ...plan, id: (0, crypto_1.randomUUID)(), startedAt: now, advancedMs: 0 };
    }
}
function applyResultRevealAction(room, socketId, payload, now = Date.now()) {
    const reveal = room.resultReveal;
    const player = room.players.find((p) => p.socketId === socketId && !p.isViewer);
    if (!reveal ||
        !player ||
        reveal.id !== payload.revealId ||
        (0, types_1.getResultRevealPlan)(room)?.key !== reveal.key)
        return false;
    const progress = (0, types_1.getResultRevealProgress)(reveal, now);
    if (progress.complete)
        return false;
    if (payload.action === 'SKIP' && socketId === room.roomHostId) {
        reveal.skipped = true;
        return true;
    }
    if (payload.action !== 'REVEAL' ||
        reveal.kind !== 'ROLES' ||
        progress.activeIndex < 0 ||
        progress.showWinner ||
        progress.revealedCount > progress.activeIndex ||
        reveal.playerIds[progress.activeIndex] !== player.id)
        return false;
    reveal.advancedMs +=
        reveal.introMs + (progress.activeIndex + 0.5) * reveal.stepMs - progress.elapsed;
    return true;
}
//# sourceMappingURL=result-reveal.js.map