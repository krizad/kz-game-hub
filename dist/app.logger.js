"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppLogger = void 0;
const common_1 = require("@nestjs/common");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const LEVEL_PRIORITY = {
    fatal: 0,
    error: 1,
    warn: 2,
    log: 3,
    debug: 4,
    verbose: 5,
};
function parsePositiveInt(raw, fallback) {
    if (!raw)
        return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function parseLogLevel(raw) {
    const normalized = raw?.trim().toLowerCase();
    if (normalized === 'fatal' ||
        normalized === 'error' ||
        normalized === 'warn' ||
        normalized === 'log' ||
        normalized === 'debug' ||
        normalized === 'verbose') {
        return normalized;
    }
    return 'log';
}
class AppLogger {
    constructor(options = {}) {
        this.consoleLogger = new common_1.ConsoleLogger();
        const logDirectory = options.logDirectory ??
            (process.env.LOG_DIR ? (0, node_path_1.resolve)(process.env.LOG_DIR) : (0, node_path_1.resolve)(__dirname, '../logs'));
        const rawFileName = options.fileName ?? process.env.LOG_FILE_NAME ?? 'game-hub.logs';
        const fileName = (0, node_path_1.basename)(rawFileName.trim() || 'game-hub.logs');
        this.logToFile =
            options.logToFile ??
                (process.env.LOG_TO_FILE !== 'false' && process.env.LOG_TO_FILE !== '0');
        this.maxBytes = options.maxBytes ?? parsePositiveInt(process.env.LOG_MAX_BYTES, 10 * 1024 * 1024);
        this.maxFiles = options.maxFiles ?? parsePositiveInt(process.env.LOG_MAX_FILES, 5);
        this.minLevelPriority = LEVEL_PRIORITY[options.minLevel ?? parseLogLevel(process.env.LOG_LEVEL)];
        this.logPath = (0, node_path_1.join)(logDirectory, fileName);
        if (this.logToFile) {
            try {
                (0, node_fs_1.mkdirSync)(logDirectory, { recursive: true });
            }
            catch {
            }
        }
    }
    getLogPath() {
        return this.logPath;
    }
    isFileLoggingEnabled() {
        return this.logToFile;
    }
    log(...args) {
        if (!this.shouldEmit('log'))
            return;
        const [message, ...optionalParams] = args;
        this.consoleLogger.log(message, ...optionalParams);
        this.write('LOG', message, optionalParams);
    }
    error(...args) {
        if (!this.shouldEmit('error'))
            return;
        const [message, ...optionalParams] = args;
        this.consoleLogger.error(message, ...optionalParams);
        this.write('ERROR', message, optionalParams);
    }
    warn(...args) {
        if (!this.shouldEmit('warn'))
            return;
        const [message, ...optionalParams] = args;
        this.consoleLogger.warn(message, ...optionalParams);
        this.write('WARN', message, optionalParams);
    }
    debug(...args) {
        if (!this.shouldEmit('debug'))
            return;
        const [message, ...optionalParams] = args;
        this.consoleLogger.debug(message, ...optionalParams);
        this.write('DEBUG', message, optionalParams);
    }
    verbose(...args) {
        if (!this.shouldEmit('verbose'))
            return;
        const [message, ...optionalParams] = args;
        this.consoleLogger.verbose(message, ...optionalParams);
        this.write('VERBOSE', message, optionalParams);
    }
    fatal(...args) {
        if (!this.shouldEmit('fatal'))
            return;
        const [message, ...optionalParams] = args;
        this.consoleLogger.fatal(message, ...optionalParams);
        this.write('FATAL', message, optionalParams);
    }
    setLogLevels(levels) {
        this.consoleLogger.setLogLevels(levels);
        if (levels.length > 0) {
            this.minLevelPriority = Math.max(...levels.map((level) => LEVEL_PRIORITY[level]));
        }
    }
    shouldEmit(level) {
        return LEVEL_PRIORITY[level] <= this.minLevelPriority;
    }
    write(level, message, optionalParams) {
        if (!this.logToFile)
            return;
        const values = [message, ...optionalParams]
            .filter((value) => value !== undefined)
            .map((value) => this.stringify(value));
        const line = `[${new Date().toISOString()}] [pid:${process.pid}] [${level}] ${values.join(' ')}\n`;
        try {
            this.rotateIfNeeded(Buffer.byteLength(line));
            (0, node_fs_1.appendFileSync)(this.logPath, line);
        }
        catch {
        }
    }
    rotateIfNeeded(incomingBytes) {
        if (this.maxBytes <= 0 || this.maxFiles <= 0 || !(0, node_fs_1.existsSync)(this.logPath))
            return;
        const size = (0, node_fs_1.statSync)(this.logPath).size;
        if (size + incomingBytes <= this.maxBytes)
            return;
        for (let index = this.maxFiles; index >= 1; index--) {
            const source = index === 1 ? this.logPath : `${this.logPath}.${index - 1}`;
            const destination = `${this.logPath}.${index}`;
            if (!(0, node_fs_1.existsSync)(source))
                continue;
            if (index === this.maxFiles && (0, node_fs_1.existsSync)(destination)) {
                (0, node_fs_1.unlinkSync)(destination);
            }
            (0, node_fs_1.renameSync)(source, destination);
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