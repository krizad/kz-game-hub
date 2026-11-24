import { ConsoleLogger, LoggerService, LogLevel } from '@nestjs/common';
export interface AppLoggerOptions {
    logDirectory?: string;
    fileName?: string;
    logToFile?: boolean;
    maxBytes?: number;
    maxFiles?: number;
    minLevel?: LogLevel;
}
export declare class AppLogger implements LoggerService {
    private readonly consoleLogger;
    private readonly logPath;
    private readonly logToFile;
    private readonly maxBytes;
    private readonly maxFiles;
    private minLevelPriority;
    constructor(options?: AppLoggerOptions);
    getLogPath(): string;
    isFileLoggingEnabled(): boolean;
    log(...args: Parameters<LoggerService['log']>): void;
    error(...args: Parameters<LoggerService['error']>): void;
    warn(...args: Parameters<LoggerService['warn']>): void;
    debug(...args: Parameters<LoggerService['debug']>): void;
    verbose(...args: Parameters<LoggerService['verbose']>): void;
    fatal(...args: Parameters<LoggerService['fatal']>): void;
    setLogLevels(levels: Parameters<ConsoleLogger['setLogLevels']>[0]): void;
    private shouldEmit;
    private write;
    private rotateIfNeeded;
    private stringify;
}
