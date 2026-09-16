"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CARD_GAME_PRESETS = void 0;
exports.presetForConfig = presetForConfig;
const pok_deng_preset_1 = require("./pok-deng.preset");
const slave_preset_1 = require("./slave.preset");
const sam_sip_preset_1 = require("./sam-sip.preset");
const old_maid_preset_1 = require("./old-maid.preset");
exports.CARD_GAME_PRESETS = {
    POK_DENG: pok_deng_preset_1.POK_DENG_PRESET,
    SLAVE: slave_preset_1.SLAVE_PRESET,
    SAM_SIP: sam_sip_preset_1.SAM_SIP_PRESET,
    OLD_MAID: old_maid_preset_1.OLD_MAID_PRESET,
};
function presetForConfig(config) {
    return exports.CARD_GAME_PRESETS[config?.preset ?? 'POK_DENG'];
}
//# sourceMappingURL=index.js.map