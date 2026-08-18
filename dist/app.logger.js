"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppLogger = void 0;
const common_1 = require("@nestjs/common");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
class AppLogger {
    constructor() {
        this.consoleLogger = new common_1.ConsoleLogger();
        const logDirectory = (0, node_path_1.resolve)(__dirname, '../logs');
        (0, node_fs_1.mkdirSync)(logDirectory, { recursive: true });
        this.logPath = (0, node_path_1.join)(logDirectory, 'app.log');
    }
    log(message, ...optionalParams) {
        this.consoleLogger.log(message, ...optionalParams);
        this.write('LOG', message, optionalParams);
    }
    error(message, ...optionalParams) {
        this.consoleLogger.error(message, ...optionalParams);
        this.write('ERROR', message, optionalParams);
    }
    warn(message, ...optionalParams) {
        this.consoleLogger.warn(message, ...optionalParams);
        this.write('WARN', message, optionalParams);
    }
    debug(message, ...optionalParams) {
        this.consoleLogger.debug(message, ...optionalParams);
        this.write('DEBUG', message, optionalParams);
    }
    verbose(message, ...optionalParams) {
        this.consoleLogger.verbose(message, ...optionalParams);
        this.write('VERBOSE', message, optionalParams);
    }
    fatal(message, ...optionalParams) {
        this.consoleLogger.fatal(message, ...optionalParams);
        this.write('FATAL', message, optionalParams);
    }
    setLogLevels(levels) {
        this.consoleLogger.setLogLevels(levels);
    }
    write(level, message, optionalParams) {
        const values = [message, ...optionalParams]
            .filter((value) => value !== undefined)
            .map((value) => this.stringify(value));
        try {
            (0, node_fs_1.appendFileSync)(this.logPath, `[${new Date().toISOString()}] [${level}] ${values.join(' ')}\n`);
        }
        catch {
        }
    }
    stringify(value) {
        if (value instanceof Error)
            return value.stack || value.message;
        if (typeof value === 'string')
            return value;
        try {
            return JSON.stringify(value);
        }
        catch {
            return String(value);
        }
    }
}
exports.AppLogger = AppLogger;
//# sourceMappingURL=app.logger.js.map