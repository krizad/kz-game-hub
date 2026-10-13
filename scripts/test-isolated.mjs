import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { configureTestDatabase } from './test-database.mjs';

async function run(args, captureList = false) {
  const child = spawn('pnpm', args, {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: process.env,
    detached: process.platform !== 'win32',
    stdio: captureList ? ['inherit', 'pipe', 'inherit'] : 'inherit',
  });
  let interrupted;
  const stop = (signal) => {
    interrupted = signal;
    if (process.platform === 'win32') child.kill(signal);
    else {
      try {
        process.kill(-child.pid, signal);
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
  };
  const onInterrupt = () => stop('SIGINT');
  const onTerminate = () => stop('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  let output = '';
  child.stdout?.on('data', (data) => {
    output += data.toString();
    process.stdout.write(data);
  });
  let exitCode;
  try {
    exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => resolve(code ?? 1));
    });
  } finally {
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
  }
  if (interrupted) exitCode = interrupted === 'SIGINT' ? 130 : 143;
  if (exitCode !== 0 || (captureList && /Total:\s*0 tests/.test(output))) {
    process.exitCode = exitCode || 1;
    return false;
  }
  return true;
}

try {
  configureTestDatabase();
  const args = process.argv.slice(2);
  if (args.includes('--pass-with-no-tests')) throw new Error('An empty E2E selection must fail.');
  if (args.includes('--prepare')) {
    for (const command of [
      ['-F', '@repo/types', 'build'],
      ['-F', '@repo/database', 'build'],
      ['db:push'],
      ['db:seed'],
      ['-F', 'api', 'exec', 'node', 'scripts/seed-e2e-artist.mjs'],
    ]) {
      if (!(await run(command))) process.exit(process.exitCode);
    }
  }
  const testArgs = args.filter((arg) => arg !== '--prepare');
  await run(['-F', 'web', 'exec', 'playwright', 'test', ...testArgs], testArgs.includes('--list'));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Isolated tests failed.');
  process.exitCode = 1;
}
