import { ConsoleLogger, LoggerService } from '@nestjs/common';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export class AppLogger implements LoggerService {
  private readonly consoleLogger = new ConsoleLogger();
  private readonly logPath: string;

  constructor() {
    const logDirectory = resolve(__dirname, '../logs');
    mkdirSync(logDirectory, { recursive: true });
    this.logPath = join(logDirectory, 'app.log');
  }

  log(message: any, ...optionalParams: any[]): void {
    this.consoleLogger.log(message, ...optionalParams);
    this.write('LOG', message, optionalParams);
  }

  error(message: any, ...optionalParams: any[]): void {
    this.consoleLogger.error(message, ...optionalParams);
    this.write('ERROR', message, optionalParams);
  }

  warn(message: any, ...optionalParams: any[]): void {
    this.consoleLogger.warn(message, ...optionalParams);
    this.write('WARN', message, optionalParams);
  }

  debug(message: any, ...optionalParams: any[]): void {
    this.consoleLogger.debug(message, ...optionalParams);
    this.write('DEBUG', message, optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]): void {
    this.consoleLogger.verbose(message, ...optionalParams);
    this.write('VERBOSE', message, optionalParams);
  }

  fatal(message: any, ...optionalParams: any[]): void {
    this.consoleLogger.fatal(message, ...optionalParams);
    this.write('FATAL', message, optionalParams);
  }

  setLogLevels(levels: Parameters<ConsoleLogger['setLogLevels']>[0]): void {
    this.consoleLogger.setLogLevels(levels);
  }

  private write(level: string, message: unknown, optionalParams: unknown[]): void {
    const values = [message, ...optionalParams]
      .filter((value) => value !== undefined)
      .map((value) => this.stringify(value));

    try {
      appendFileSync(
        this.logPath,
        `[${new Date().toISOString()}] [${level}] ${values.join(' ')}\n`,
      );
    } catch {
      // Console output remains available if the hosting filesystem is unavailable.
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
