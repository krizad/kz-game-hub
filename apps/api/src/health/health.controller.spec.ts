jest.mock('@repo/database', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

import { prisma } from '@repo/database';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let statusMock: jest.Mock;
  const queryRawMock = prisma.$queryRaw as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new HealthController();
    statusMock = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 200 ok and latencyMs when SELECT 1 succeeds', async () => {
    queryRawMock.mockResolvedValueOnce([{ '1': 1 }]);

    const res = await controller.check({ status: statusMock } as never);

    expect(queryRawMock).toHaveBeenCalledTimes(1);
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(res.status).toBe('ok');
    expect(res.database.status).toBe('connected');
    expect(typeof res.database.latencyMs).toBe('number');
    expect(res.service).toBe('kz-game-hub-api');
  });

  it('returns 503 degraded when SELECT 1 rejects', async () => {
    queryRawMock.mockRejectedValueOnce(new Error('connection lost'));

    const res = await controller.check({ status: statusMock } as never);

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(res.status).toBe('degraded');
    expect(res.database).toEqual({ status: 'disconnected' });
  });

  it('returns 503 degraded when SELECT 1 times out after 3s', async () => {
    jest.useFakeTimers();
    queryRawMock.mockReturnValueOnce(new Promise(() => {}));

    const checkPromise = controller.check({ status: statusMock } as never);
    jest.advanceTimersByTime(3001);
    const res = await checkPromise;

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(res.status).toBe('degraded');
    expect(res.database).toEqual({ status: 'disconnected' });
  });
});
