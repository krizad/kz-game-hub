jest.mock('@repo/database', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

import { prisma } from '@repo/database';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  const queryRawMock = prisma.$queryRaw as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new HealthController();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns ok and latencyMs when SELECT 1 succeeds', async () => {
    queryRawMock.mockResolvedValueOnce([{ '1': 1 }]);

    const res = await controller.check();

    expect(queryRawMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe('ok');
    expect(res.database.status).toBe('connected');
    expect(typeof res.database.latencyMs).toBe('number');
    expect(res.service).toBe('kz-game-hub-api');
  });

  it('returns degraded when SELECT 1 rejects', async () => {
    queryRawMock.mockRejectedValueOnce(new Error('connection lost'));

    const res = await controller.check();

    expect(res.status).toBe('degraded');
    expect(res.database).toEqual({ status: 'disconnected' });
  });

  it('returns degraded when SELECT 1 times out after 3s', async () => {
    jest.useFakeTimers();
    queryRawMock.mockReturnValueOnce(new Promise(() => {}));

    const checkPromise = controller.check();
    jest.advanceTimersByTime(3001);
    const res = await checkPromise;

    expect(res.status).toBe('degraded');
    expect(res.database).toEqual({ status: 'disconnected' });
  });
});
