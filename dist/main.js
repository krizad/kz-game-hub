"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, '../../../.env') });
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
const app_logger_1 = require("./app.logger");
const types_1 = require("@repo/types");
function registerProcessLogging(logger) {
    process.on('uncaughtException', (error) => {
        logger.fatal('[SYS] Uncaught exception', error);
    });
    process.on('unhandledRejection', (reason) => {
        logger.error('[SYS] Unhandled promise rejection', reason instanceof Error ? reason : String(reason));
    });
}
async function bootstrap() {
    const logger = new app_logger_1.AppLogger();
    registerProcessLogging(logger);
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger,
    });
    app.enableCors();
    app.enableShutdownHooks();
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('KZ Game Hub API')
            .setDescription('WebSocket-based game hub API with health check')
            .setVersion(types_1.APP_VERSION)
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup('api', app, document);
    }
    const port = Number.parseInt(process.env.PORT || '3001', 10);
    await app.listen(port, '0.0.0.0');
    logger.log(`[BOOT] API [${types_1.APP_VERSION}] listening on http://localhost:${port} ` +
        `(env=${process.env.NODE_ENV || 'development'}, pid=${process.pid}, ` +
        `cors=${process.env.CORS_ORIGIN ? 'configured' : '*'}, ` +
        `log=${logger.isFileLoggingEnabled() ? logger.getLogPath() : 'disabled'})`);
    if (!isProduction) {
        logger.log(`[BOOT] Swagger docs at http://localhost:${port}/api`);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map