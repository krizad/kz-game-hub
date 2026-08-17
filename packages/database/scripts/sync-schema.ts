import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../.env') });

const SCHEMA_PATH = resolve(__dirname, '../prisma/schema.prisma');

type Provider = 'postgresql' | 'mysql';

function detectProviderFromUrl(url: string): Provider | null {
  const match = /^([a-zA-Z0-9]+):\/\//.exec(url);
  if (!match) return null;
  const protocol = match[1].toLowerCase();
  if (protocol === 'mysql' || protocol === 'mariadb') return 'mysql';
  if (protocol === 'postgresql' || protocol === 'postgres') return 'postgresql';
  return null;
}

function resolveProvider(): Provider {
  const arg = process.argv[2];
  if (arg === 'mysql' || arg === 'postgresql') return arg;

  const url = process.env.DATABASE_URL || '';
  const detected = detectProviderFromUrl(url);
  if (detected) return detected;

  console.error(
    `Cannot determine database provider. Set DATABASE_URL (postgresql:// or mysql://) or pass "postgresql" | "mysql" as an argument.`,
  );
  process.exit(1);
}

const PROVIDER_RE =
  /(datasource db \{[^}]*provider\s*=\s*)"(postgresql|mysql|sqlite|sqlserver|cockroachdb|mongodb)"/;

function main() {
  const provider = resolveProvider();
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');

  const match = PROVIDER_RE.exec(schema);
  if (!match) {
    console.warn('Could not find datasource db block in schema.prisma. No changes made.');
    return;
  }

  if (match[2] === provider) {
    console.log(`schema.prisma provider is already "${provider}"`);
    return;
  }

  const updated = schema.replace(PROVIDER_RE, `$1"${provider}"`);
  writeFileSync(SCHEMA_PATH, updated);
  console.log(`schema.prisma provider switched to "${provider}"`);
}

main();
