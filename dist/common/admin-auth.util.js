"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timingSafeSecretEqual = timingSafeSecretEqual;
const node_crypto_1 = require("node:crypto");
function timingSafeSecretEqual(candidate, secret) {
    if (typeof candidate !== 'string' || !secret)
        return false;
    const candidateDigest = (0, node_crypto_1.createHash)('sha256').update(candidate, 'utf8').digest();
    const secretDigest = (0, node_crypto_1.createHash)('sha256').update(secret, 'utf8').digest();
    return (0, node_crypto_1.timingSafeEqual)(candidateDigest, secretDigest);
}
//# sourceMappingURL=admin-auth.util.js.map