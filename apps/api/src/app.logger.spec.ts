import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppLogger } from './app.logger';

describe('AppLogger', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kz-app-logger-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes formatted logs with pid to game-hub.logs by default', () => {
    const logger = new AppLogger({ logDirectory: tempDir });
    logger.log('[ROOM] created', 'GamesGateway');

    const logPath = join(tempDir, 'game-hub.logs');
    expect(logger.getLogPath()).toBe(logPath);
    expect(existsSync(logPath)).toBe(true);

    const content = readFileSync(logPath, 'utf-8');
    expect(content).toContain(`[pid:${process.pid}] [LOG] [ROOM] created GamesGateway`);
  });

  it('does not write a file when logToFile is false', () => {
    const logger = new AppLogger({ logDirectory: tempDir, logToFile: false });
    logger.log('smoke test only');

    expect(existsSync(join(tempDir, 'game-hub.logs'))).toBe(false);
  });

  it('rotates game-hub.logs when maxBytes is exceeded', () => {
    const logger = new AppLogger({
      logDirectory: tempDir,
      maxBytes: 120,
      maxFiles: 2,
    });

    logger.log('first message long enough to cross rotation boundary 1234567890');
    logger.log('second message triggers rotation 123456789012345678901234567890');
    logger.log('third message triggers second rotation 1234567890123456789012345');

    expect(existsSync(join(tempDir, 'game-hub.logs'))).toBe(true);
    expect(existsSync(join(tempDir, 'game-hub.logs.1'))).toBe(true);
  });

  it('filters debug logs unless minLevel is debug', () => {
    const infoLogger = new AppLogger({ logDirectory: tempDir, minLevel: 'log' });
    infoLogger.debug('hidden debug detail');
    expect(existsSync(join(tempDir, 'game-hub.logs'))).toBe(false);

    const debugLogger = new AppLogger({ logDirectory: tempDir, minLevel: 'debug' });
    debugLogger.debug('visible debug detail');
    const content = readFileSync(join(tempDir, 'game-hub.logs'), 'utf-8');
    expect(content).toContain('[DEBUG] visible debug detail');
  });
});
