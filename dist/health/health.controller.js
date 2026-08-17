"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const database_1 = require("@repo/database");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
let HealthController = class HealthController {
    async check() {
        const databaseStartedAt = Date.now();
        let database;
        try {
            await database_1.prisma.$connect();
            database = {
                status: 'connected',
                latencyMs: Date.now() - databaseStartedAt,
            };
        }
        catch {
            database = { status: 'disconnected' };
        }
        const memory = process.memoryUsage();
        const version = this.getPackageVersion();
        return {
            status: database.status === 'connected' ? 'ok' : 'degraded',
            service: 'kz-game-hub-api',
            version,
            environment: process.env.NODE_ENV || 'development',
            nodeVersion: process.version,
            pid: process.pid,
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            database,
            memory: {
                rssMb: Math.round(memory.rss / 1024 / 1024),
                heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
                heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
            },
        };
    }
    getPackageVersion() {
        try {
            const packageJsonPath = (0, node_path_1.resolve)(__dirname, '../../package.json');
            const packageJson = JSON.parse((0, node_fs_1.readFileSync)(packageJsonPath, 'utf8'));
            return packageJson.version || 'unknown';
        }
        catch {
            return process.env.npm_package_version || 'unknown';
        }
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Health check' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "check", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)('Health'),
    (0, common_1.Controller)('health')
], HealthController);
//# sourceMappingURL=health.controller.js.map