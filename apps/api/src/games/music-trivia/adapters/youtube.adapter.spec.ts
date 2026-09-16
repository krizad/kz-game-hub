jest.mock('youtubei.js', () => ({
  Innertube: {
    create: jest.fn(),
  },
}));

import { Innertube } from 'youtubei.js';
import { YouTubeAdapter } from './youtube.adapter';

describe('YouTubeAdapter', () => {
  it('retries the session after a failed init', async () => {
    const adapter = new YouTubeAdapter();
    const create = Innertube.create as jest.Mock;
    create.mockRejectedValueOnce(new Error('offline'));
    create.mockResolvedValueOnce({ search: jest.fn() });

    await expect(adapter.init()).rejects.toThrow('offline');
    await expect(adapter.init()).resolves.toBeUndefined();
    await expect(adapter.init()).resolves.toBeUndefined();

    expect(create).toHaveBeenCalledTimes(2);
  });
});
