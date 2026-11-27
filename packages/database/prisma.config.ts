/// <reference types="node" />
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../.env') });
import { defineConfig } from 'prisma/config';

/**
 * Same guard as src/index.ts: Prisma CLI commands (db:push, migrate, studio)
 * run against whatever DATABASE_URL says, so a remote URL outside production
 * fails fast instead of touching live data by accident.
 */
const datasourceUrl = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost/dummy';
if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_REMOTE_DATABASE_URL !== '1') {
  try {
    const host = new URL(datasourceUrl).hostname;
    const isLoopback = host === 'localhost' || host === '::1' || /^127(\.\d+){3}$/.test(host);
    if (!isLoopback) {
      throw new Error(
        `[database] DATABASE_URL points at a non-loopback host ("${host}") outside production. ` +
          'Point DATABASE_URL at a local MySQL or set ALLOW_REMOTE_DATABASE_URL=1 to override.',
      );
    }
  } catch (error) {
    if (error instanceof TypeError) {
      // Unparseable URL: let Prisma report it.
    } else {
      throw error;
    }
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: datasourceUrl,
  },
});
