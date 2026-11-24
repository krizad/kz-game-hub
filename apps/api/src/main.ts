import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppLogger } from './app.logger';
import { APP_VERSION } from '@repo/types';
import { parseCorsOrigin } from './common/cors.util';

function registerProcessLogging(logger: AppLogger): void {
  process.on('uncaughtException', (error: Error) => {
    logger.fatal('[SYS] Uncaught exception', error);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error(
      '[SYS] Unhandled promise rejection',
      reason instanceof Error ? reason : String(reason),
    );
  });
}

async function bootstrap() {
  const logger = new AppLogger();
  registerProcessLogging(logger);

  const app = await NestFactory.create(AppModule, {
    logger,
  });
  app.enableCors({ origin: parseCorsOrigin() });
  app.enableShutdownHooks();

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('KZ Game Hub API')
      .setDescription('WebSocket-based game hub API with health check')
      .setVersion(APP_VERSION)
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
  }

  const port = Number.parseInt(process.env.PORT || '3001', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(
    `[BOOT] API [${APP_VERSION}] listening on http://localhost:${port} ` +
      `(env=${process.env.NODE_ENV || 'development'}, pid=${process.pid}, ` +
      `cors=${process.env.CORS_ORIGIN ? 'configured' : '*'}, ` +
      `log=${logger.isFileLoggingEnabled() ? logger.getLogPath() : 'disabled'})`,
  );
  if (!isProduction) {
    logger.log(`[BOOT] Swagger docs at http://localhost:${port}/api`);
  }
}
bootstrap();
