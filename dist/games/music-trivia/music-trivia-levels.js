"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEVEL_BORROW_ORDER = exports.MEDIUM_MIN_VIEWS = exports.EASY_MIN_VIEWS = void 0;
exports.levelOfViewCount = levelOfViewCount;
exports.shuffle = shuffle;
exports.EASY_MIN_VIEWS = 50_000_000;
exports.MEDIUM_MIN_VIEWS = 5_000_000;
function levelOfViewCount(viewCount) {
    if (viewCount >= exports.EASY_MIN_VIEWS)
        return 'EASY';
    if (viewCount >= exports.MEDIUM_MIN_VIEWS)
        return 'MEDIUM';
    return 'HARD';
}
exports.LEVEL_BORROW_ORDER = {
    EASY: ['EASY', 'MEDIUM', 'HARD'],
    MEDIUM: ['MEDIUM', 'EASY', 'HARD'],
    HARD: ['HARD', 'MEDIUM', 'EASY'],
};
function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}
//# sourceMappingURL=music-trivia-levels.js.map