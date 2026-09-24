import { Test, TestingModule } from '@nestjs/testing';
import { GameType } from '@repo/types';

jest.mock('@repo/database', () => ({
  prisma: {
    gameSetting: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

import { prisma } from '@repo/database';
import { GameSettingsService } from './game-settings.service';

describe('GameSettingsService', () => {
  let service: GameSettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameSettingsService],
    }).compile();
    service = module.get<GameSettingsService>(GameSettingsService);
    jest.clearAllMocks();
  });

  it('loads flags from the DB and keeps unknown games enabled', async () => {
    (prisma.gameSetting.findMany as jest.Mock).mockResolvedValue([
      { gameType: 'COUP', enabled: false },
      { gameType: 'SABOTEUR', enabled: true },
      { gameType: 'NOT_A_GAME', enabled: false },
    ]);

    await service.load();

    expect(service.isEnabled(GameType.COUP)).toBe(false);
    expect(service.isEnabled(GameType.SABOTEUR)).toBe(true);
    // Unlisted and invalid rows fall back to the enabled default.
    expect(service.isEnabled(GameType.THE_MIND)).toBe(true);
    expect(service.snapshot()).toEqual({ COUP: false, SABOTEUR: true });
  });

  it('fails open when the DB load errors', async () => {
    (prisma.gameSetting.findMany as jest.Mock).mockRejectedValue(new Error('db down'));

    await service.load();

    expect(service.isEnabled(GameType.COUP)).toBe(true);
  });

  it('persists a flag flip and updates the in-memory snapshot', async () => {
    (prisma.gameSetting.upsert as jest.Mock).mockResolvedValue({});

    await service.setEnabled(GameType.COUP, false);

    expect(prisma.gameSetting.upsert).toHaveBeenCalledWith({
      where: { gameType: 'COUP' },
      update: { enabled: false },
      create: { gameType: 'COUP', enabled: false },
    });
    expect(service.isEnabled(GameType.COUP)).toBe(false);
  });
});
