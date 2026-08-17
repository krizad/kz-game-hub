"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)({ path: (0, path_1.resolve)(__dirname, '../../../.env') });
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors();
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('KZ Game Hub API')
            .setDescription('WebSocket-based game hub API with health check')
            .setVersion('1.0')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup('api', app, document);
    }
    const port = Number.parseInt(process.env.PORT || '3001', 10);
    await app.listen(port, '0.0.0.0');
    console.log(`API listening on http://localhost:${port}`);
    if (!isProduction) {
        console.log(`Swagger docs at http://localhost:${port}/api`);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map