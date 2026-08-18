import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppLogger } from './app.logger';
import { APP_VERSION } from '@repo/types';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new AppLogger(),
  });
  app.enableCors();

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
  console.log(`API [${APP_VERSION}] listening on http://localhost:${port}`);
  if (!isProduction) {
    console.log(`Swagger docs at http://localhost:${port}/api`);
  }
}
bootstrap();
