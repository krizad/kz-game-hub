/**
 * Parse comma-separated CORS origins from env (defaulting to '*' when unset/blank).
 * Shared between HTTP (`main.ts`) and WebSocket (`GamesGateway`) so both layers stay in sync.
 */
export function parseCorsOrigin(raw: string | undefined = process.env.CORS_ORIGIN): string | string[] {
  if (!raw) return '*';
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : '*';
}
