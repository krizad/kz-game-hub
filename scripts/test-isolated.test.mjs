import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test(
  'termination stops the runner and its descendant processes',
  { skip: process.platform === 'win32', timeout: 10000 },
  async () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const temporaryRoot = path.join(root, 'tmp-script');
    await mkdir(temporaryRoot, { recursive: true });
    const fixture = await mkdtemp(path.join(temporaryRoot, 'runner-signal-'));
    const fakePnpm = path.join(fixture, 'pnpm');
    await writeFile(
      fakePnpm,
      `#!/usr/bin/env node
const { spawn } = require('node:child_process');
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
child.on('spawn', () => console.log('DESCENDANT:' + child.pid));
setInterval(() => {}, 1000);
`,
      { mode: 0o755 },
    );
    const runner = spawn(process.execPath, ['scripts/test-isolated.mjs'], {
      cwd: root,
      env: {
        ...process.env,
        PATH: fixture + path.delimiter + process.env.PATH,
        TEST_DATABASE_URL: 'mysql://test:test@127.0.0.1:13306/kz_game_hub_test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let descendant;
    try {
      const exit = once(runner, 'exit');
      let output = '';
      for await (const chunk of runner.stdout) {
        output += chunk;
        const match = output.match(/DESCENDANT:(\d+)/);
        if (match) {
          descendant = Number(match[1]);
          break;
        }
      }
      assert.ok(descendant, 'child process must start before interruption');
      runner.kill('SIGTERM');
      const [code] = await exit;
      assert.equal(code, 143);
      for (let attempt = 0; attempt < 50; attempt++) {
        try {
          process.kill(descendant, 0);
        } catch (error) {
          assert.equal(error.code, 'ESRCH');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.fail('descendant remained alive after runner termination');
    } finally {
      runner.kill('SIGTERM');
      if (descendant) {
        try {
          process.kill(descendant, 'SIGTERM');
        } catch {}
      }
      await rm(fixture, { recursive: true, force: true });
    }
  },
);
