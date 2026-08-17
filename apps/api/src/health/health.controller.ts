import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { prisma } from '@repo/database';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

@ApiTags('Health')
@Controller('health')
export class HealthController {
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
    } catch {
      database = { status: 'disconnected' };
    } finally {
      if (timeout) clearTimeout(timeout);
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

  private getPackageVersion(): string {
    try {
      const packageJsonPath = resolve(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
        version?: string;
      };
      return packageJson.version || 'unknown';
    } catch {
      return process.env.npm_package_version || 'unknown';
    }
  }
}
