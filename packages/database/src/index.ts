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

const connectionString = `${process.env.DATABASE_URL}`;
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
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
