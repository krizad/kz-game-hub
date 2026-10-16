"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDogRelayPairCorrect = isDogRelayPairCorrect;
exports.resolveDogRelayWinner = resolveDogRelayWinner;
function isDogRelayPairCorrect(actual, guess) {
    return actual.suspectId === guess.suspectId && actual.victimId === guess.victimId;
}
function resolveDogRelayWinner(evilId, ballots) {
    const counts = new Map();
    for (const target of Object.values(ballots))
        counts.set(target, (counts.get(target) ?? 0) + 1);
    const highest = Math.max(0, ...counts.values());
    const leaders = [...counts].filter(([, count]) => count === highest);
    return leaders.length === 1 && leaders[0][0] === evilId ? 'GOOD' : 'EVIL';
}
//# sourceMappingURL=dog-relay.rules.js.map