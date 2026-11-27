import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const envCandidates = [resolve(__dirname, '../../../.env'), resolve(__dirname, '../../.env')];
const envPath = envCandidates.find((p) => existsSync(p));
if (envPath) config({ path: envPath });

export * from '@prisma/client';

/**
 * Root .env previously pointed at the production MySQL, so everyday commands
 * (`pnpm dev`, `db:push`, `db:studio`) could write to live data by accident.
 * Outside production a remote DATABASE_URL now fails fast; opt back in with
 * ALLOW_REMOTE_DATABASE_URL=1 when you really need a remote database locally.
 */
function assertLocalDatabaseUrl(connectionString: string): void {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_REMOTE_DATABASE_URL === '1') {
    return;
  }
  let host = '';
  try {
    host = new URL(connectionString).hostname;
  } catch {
    return; // Unparseable URL fails later with a driver error.
  }
  const isLoopback =
    host === 'localhost' || host === '::1' || host === '[::1]' || /^127(\.\d+){3}$/.test(host);
  if (!isLoopback) {
    throw new Error(
      `[database] DATABASE_URL points at a non-loopback host ("${host}") outside production. ` +
        'Point DATABASE_URL at a local MySQL (e.g. mysql://root:password@localhost:3307/kz_game_hub) ' +
        'or set ALLOW_REMOTE_DATABASE_URL=1 to allow remote databases while developing.',
    );
  }
}

const connectionString = `${process.env.DATABASE_URL}`;
assertLocalDatabaseUrl(connectionString);
const isMysql = /^(mysql|mariadb):\/\//i.test(connectionString);

const adapter = isMysql
  ? new PrismaMariaDb(connectionString)
  : new PrismaPg(new Pool({ connectionString }));

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? [] : ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
