import { ConsoleLogger, LoggerService, LogLevel } from '@nestjs/common';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';

export interface AppLoggerOptions {
  logDirectory?: string;
  fileName?: string;
  logToFile?: boolean;
  maxBytes?: number;
  maxFiles?: number;
  minLevel?: LogLevel;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  log: 3,
  debug: 4,
  verbose: 5,
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseLogLevel(raw: string | undefined): LogLevel {
  const normalized = raw?.trim().toLowerCase();
  if (
    normalized === 'fatal' ||
    normalized === 'error' ||
    normalized === 'warn' ||
    normalized === 'log' ||
    normalized === 'debug' ||
    normalized === 'verbose'
  ) {
    return normalized;
  }
  return 'log';
}

/**
 * Dual console + file logger writing structured timestamped lines with PID and
 * size-based file rotation to `logs/game-hub.logs` by default.
 */
export class AppLogger implements LoggerService {
  private readonly consoleLogger = new ConsoleLogger();
  private readonly logPath: string;
  private readonly logToFile: boolean;
  private readonly maxBytes: number;
  private readonly maxFiles: number;
  private minLevelPriority: number;

  constructor(options: AppLoggerOptions = {}) {
    const logDirectory =
      options.logDirectory ??
      (process.env.LOG_DIR ? resolve(process.env.LOG_DIR) : resolve(__dirname, '../logs'));
    const rawFileName = options.fileName ?? process.env.LOG_FILE_NAME ?? 'game-hub.logs';
    const fileName = basename(rawFileName.trim() || 'game-hub.logs');

    this.logToFile =
      options.logToFile ??
      (process.env.LOG_TO_FILE !== 'false' && process.env.LOG_TO_FILE !== '0');
    this.maxBytes = options.maxBytes ?? parsePositiveInt(process.env.LOG_MAX_BYTES, 10 * 1024 * 1024);
    this.maxFiles = options.maxFiles ?? parsePositiveInt(process.env.LOG_MAX_FILES, 5);
    this.minLevelPriority = LEVEL_PRIORITY[options.minLevel ?? parseLogLevel(process.env.LOG_LEVEL)];
    this.logPath = join(logDirectory, fileName);

    if (this.logToFile) {
      try {
        mkdirSync(logDirectory, { recursive: true });
      } catch {
        // Console output remains available if the hosting filesystem is unavailable.
      }
    }
  }

  getLogPath(): string {
    return this.logPath;
  }

  isFileLoggingEnabled(): boolean {
    return this.logToFile;
  }

  log(...args: Parameters<LoggerService['log']>): void {
    if (!this.shouldEmit('log')) return;
    const [message, ...optionalParams] = args;
    this.consoleLogger.log(message, ...optionalParams);
    this.write('LOG', message, optionalParams);
  }

  error(...args: Parameters<LoggerService['error']>): void {
    if (!this.shouldEmit('error')) return;
    const [message, ...optionalParams] = args;
    this.consoleLogger.error(message, ...optionalParams);
    this.write('ERROR', message, optionalParams);
  }

  warn(...args: Parameters<LoggerService['warn']>): void {
    if (!this.shouldEmit('warn')) return;
    const [message, ...optionalParams] = args;
    this.consoleLogger.warn(message, ...optionalParams);
    this.write('WARN', message, optionalParams);
  }

  debug(...args: Parameters<LoggerService['debug']>): void {
    if (!this.shouldEmit('debug')) return;
    const [message, ...optionalParams] = args;
    this.consoleLogger.debug(message, ...optionalParams);
    this.write('DEBUG', message, optionalParams);
  }

  verbose(...args: Parameters<LoggerService['verbose']>): void {
    if (!this.shouldEmit('verbose')) return;
    const [message, ...optionalParams] = args;
    this.consoleLogger.verbose(message, ...optionalParams);
    this.write('VERBOSE', message, optionalParams);
  }

  fatal(...args: Parameters<LoggerService['fatal']>): void {
    if (!this.shouldEmit('fatal')) return;
    const [message, ...optionalParams] = args;
    this.consoleLogger.fatal(message, ...optionalParams);
    this.write('FATAL', message, optionalParams);
  }

  setLogLevels(levels: Parameters<ConsoleLogger['setLogLevels']>[0]): void {
    this.consoleLogger.setLogLevels(levels);
    if (levels.length > 0) {
      this.minLevelPriority = Math.max(...levels.map((level) => LEVEL_PRIORITY[level]));
    }
  }

  private shouldEmit(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] <= this.minLevelPriority;
  }

  private write(level: string, message: unknown, optionalParams: unknown[]): void {
    if (!this.logToFile) return;

    const values = [message, ...optionalParams]
      .filter((value) => value !== undefined)
      .map((value) => this.stringify(value));
    const line = `[${new Date().toISOString()}] [pid:${process.pid}] [${level}] ${values.join(' ')}\n`;

    try {
      this.rotateIfNeeded(Buffer.byteLength(line));
      appendFileSync(this.logPath, line);
    } catch {
      // Console output remains available if the hosting filesystem is unavailable.
    }
  }

  private rotateIfNeeded(incomingBytes: number): void {
    if (this.maxBytes <= 0 || this.maxFiles <= 0 || !existsSync(this.logPath)) return;

    const size = statSync(this.logPath).size;
    if (size + incomingBytes <= this.maxBytes) return;

    for (let index = this.maxFiles; index >= 1; index--) {
      const source = index === 1 ? this.logPath : `${this.logPath}.${index - 1}`;
      const destination = `${this.logPath}.${index}`;
      if (!existsSync(source)) continue;
      if (index === this.maxFiles && existsSync(destination)) {
        unlinkSync(destination);
      }
      renameSync(source, destination);
    }
  }

  private stringify(value: unknown): string {
    if (value instanceof Error) return value.stack || value.message;
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
