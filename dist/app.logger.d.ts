import { ConsoleLogger, LoggerService } from '@nestjs/common';
export declare class AppLogger implements LoggerService {
    private readonly consoleLogger;
    private readonly logPath;
    constructor();
    log(...args: Parameters<LoggerService['log']>): void;
    error(...args: Parameters<LoggerService['error']>): void;
    warn(...args: Parameters<LoggerService['warn']>): void;
    debug(...args: Parameters<LoggerService['debug']>): void;
    verbose(...args: Parameters<LoggerService['verbose']>): void;
    fatal(...args: Parameters<LoggerService['fatal']>): void;
    setLogLevels(levels: Parameters<ConsoleLogger['setLogLevels']>[0]): void;
    private write;
    private stringify;
}
