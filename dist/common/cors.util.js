"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCorsOrigin = parseCorsOrigin;
function parseCorsOrigin(raw = process.env.CORS_ORIGIN) {
    if (!raw)
        return '*';
    const origins = raw
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
    return origins.length > 0 ? origins : '*';
}
//# sourceMappingURL=cors.util.js.map