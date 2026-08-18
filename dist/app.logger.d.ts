import { ConsoleLogger, LoggerService } from '@nestjs/common';
export declare class AppLogger implements LoggerService {
    private readonly consoleLogger;
    private readonly logPath;
    constructor();
    log(message: any, ...optionalParams: any[]): void;
    error(message: any, ...optionalParams: any[]): void;
    warn(message: any, ...optionalParams: any[]): void;
    debug(message: any, ...optionalParams: any[]): void;
    verbose(message: any, ...optionalParams: any[]): void;
    fatal(message: any, ...optionalParams: any[]): void;
    setLogLevels(levels: Parameters<ConsoleLogger['setLogLevels']>[0]): void;
    private write;
    private stringify;
}
