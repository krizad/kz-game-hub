"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock('youtubei.js', () => ({
    Innertube: {
        create: jest.fn(),
    },
}));
const youtubei_js_1 = require("youtubei.js");
const youtube_adapter_1 = require("./youtube.adapter");
describe('YouTubeAdapter', () => {
    it('retries the session after a failed init', async () => {
        const adapter = new youtube_adapter_1.YouTubeAdapter();
        const create = youtubei_js_1.Innertube.create;
        create.mockRejectedValueOnce(new Error('offline'));
        create.mockResolvedValueOnce({ search: jest.fn() });
        await expect(adapter.init()).rejects.toThrow('offline');
        await expect(adapter.init()).resolves.toBeUndefined();
        await expect(adapter.init()).resolves.toBeUndefined();
        expect(create).toHaveBeenCalledTimes(2);
    });
});
//# sourceMappingURL=youtube.adapter.spec.js.map