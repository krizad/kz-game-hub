import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { prisma } from '@repo/database';
import { APP_VERSION } from '@repo/types';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    const databaseStartedAt = Date.now();
    let database: { status: 'connected' | 'disconnected'; latencyMs?: number };
    let timeout: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        prisma.$connect(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('database connection timeout')), 3000);
        }),
      ]);
      database = {
        status: 'connected',
        latencyMs: Date.now() - databaseStartedAt,
      };
      if (database.latencyMs > 1000) {
        this.logger.warn(`[HEALTH] Slow database check latencyMs=${database.latencyMs}`);
      } else {
        this.logger.debug(`[HEALTH] ok dbLatencyMs=${database.latencyMs}`);
      }
    } catch (error) {
      database = { status: 'disconnected' };
      this.logger.warn(
        `[HEALTH] Degraded database=disconnected reason=${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    const memory = process.memoryUsage();

    return {
      status: database.status === 'connected' ? 'ok' : 'degraded',
      service: 'kz-game-hub-api',
      version: APP_VERSION,
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

  private getPackageVersion(): string {
    return APP_VERSION;
  }
}
