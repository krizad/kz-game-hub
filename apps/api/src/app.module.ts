import { Module } from '@nestjs/common';
import { GamesModule } from './games/games.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [GamesModule, HealthModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
