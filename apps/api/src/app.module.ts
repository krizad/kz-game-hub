import { Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { GamesModule } from './games/games.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [GamesModule, HealthModule],
  controllers: [],
  providers: [],
})
export class AppModule implements OnApplicationShutdown {
  private readonly logger = new Logger(AppModule.name);

  onApplicationShutdown(signal?: string): void {
    this.logger.warn(
      `[SYS] Application shutdown signal=${signal ?? 'none'} (pid=${process.pid})`,
    );
  }
}
