#!/usr/bin/env node
/**
 * Deploy KZ Game Hub API to a Plesk shared host via FTP (no SSH).
 *
 * Flow:
 *   1. Ensure Prisma schema provider = mysql (target DB is MariaDB) + full build
 *   2. Build a self-contained flat bundle (npm layout, no symlinks, no .pnpm):
 *      - apps/api/dist + package.json with EXACT pinned versions
 *      - @repo/types + @repo/database vendored via file: deps
 *      - npm install --omit=dev (flattened node_modules, safe for Plesk unzip)
 *      - copy generated Prisma client (.prisma) into node_modules
 *   3. Optional local smoke test (boot API + GET /health)
 *   4. Zip bundle contents -> kz-api.zip
 *   5. Upload zip via FTP (basic-ftp, passive mode)
 *
 * Config (root .env or CLI args):
 *   FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE_DIR (default "/"), FTP_SECURE (true|false)
 *
 * Flags:
 *   --dry-run     do everything except the FTP upload
 *   --skip-build  skip build steps (reuse existing dist)
 *   --host/--user/--pass/--remote  override .env values
 */

import 'dotenv/config';
import { execSync, spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { Client } from 'basic-ftp';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const DEPLOY_DIR = join(ROOT, 'deploy-api');

function getCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim();
  } catch {
    return 'local';
  }
}

function getTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const ZIP_PATH = join(ROOT, `kz-api-${getTimestamp()}-${getCommitHash()}.zip`);

const flag = (name) => process.argv.includes(`--${name}`);
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
};

const DRY_RUN = flag('dry-run');
const SKIP_BUILD = flag('skip-build');
const SKIP_UPLOAD = flag('skip-upload');
const FTP_HOST = arg('host') || process.env.FTP_HOST;
const FTP_USER = arg('user') || process.env.FTP_USER;
const FTP_PASS = arg('pass') || process.env.FTP_PASS;
const FTP_REMOTE_DIR = arg('remote') || process.env.FTP_REMOTE_DIR || '/';
const FTP_SECURE = (arg('secure') || process.env.FTP_SECURE || 'false') === 'true';

function run(cmd, cwd = ROOT) {
  console.log(`\n==> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function detectProvider() {
  const url = process.env.DATABASE_URL || '';
  return /^(mysql|mariadb):\/\//i.test(url) ? 'mysql' : 'postgresql';
}

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf-8'));
}

function exactVersion(nodeModulesRoot, name) {
  const p = join(nodeModulesRoot, 'node_modules', name, 'package.json');
  if (!existsSync(p)) return null;
  return readJson(p).version;
}

function findPrismaSource() {
  const store = join(ROOT, 'node_modules', '.pnpm');
  for (const d of readdirSync(store)) {
    if (!d.startsWith('@prisma+client@')) continue;
    const candidate = join(store, d, 'node_modules', '.prisma');
    if (existsSync(join(candidate, 'client', 'default.js'))) return candidate;
  }
  return null;
}

function vendorWorkspacePackage(name, pkgDir, deployVendorDir) {
  const target = join(deployVendorDir, name.replace(/^@repo\//, ''));
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(join(pkgDir, 'dist'), join(target, 'dist'), { recursive: true });
  const pkgJson = readJson(join(pkgDir, 'package.json'));
  const pinned = {};
  for (const [dep, range] of Object.entries(pkgJson.dependencies || {})) {
    const exact = exactVersion(pkgDir, dep);
    pinned[dep] = exact || range;
  }
  pkgJson.dependencies = pinned;
  delete pkgJson.devDependencies;
  delete pkgJson.scripts;
  delete pkgJson.prisma;
  writeFileSync(join(target, 'package.json'), JSON.stringify(pkgJson, null, 2));
  return target;
}

function buildFlatBundle() {
  const apiPkgDir = join(ROOT, 'apps', 'api');
  const dbPkgDir = join(ROOT, 'packages', 'database');
  const typesPkgDir = join(ROOT, 'packages', 'types');

  rmSync(DEPLOY_DIR, { recursive: true, force: true });
  mkdirSync(DEPLOY_DIR, { recursive: true });

  cpSync(join(apiPkgDir, 'dist'), join(DEPLOY_DIR, 'dist'), { recursive: true });
  cpSync(join(ROOT, 'scripts', 'diag-server.js'), join(DEPLOY_DIR, 'diag.js'));

  const vendorDir = join(DEPLOY_DIR, 'vendor');
  mkdirSync(vendorDir, { recursive: true });
  vendorWorkspacePackage('@repo/database', dbPkgDir, vendorDir);
  vendorWorkspacePackage('@repo/types', typesPkgDir, vendorDir);

  const apiJson = readJson(join(apiPkgDir, 'package.json'));
  const deps = {};
  for (const [dep, range] of Object.entries(apiJson.dependencies || {})) {
    if (dep.startsWith('@repo/')) continue;
    if (dep.startsWith('@types/')) continue;
    const exact = exactVersion(apiPkgDir, dep);
    deps[dep] = exact || range;
  }
  deps['@repo/database'] = 'file:./vendor/database';
  deps['@repo/types'] = 'file:./vendor/types';

  const deployJson = {
    name: 'kz-api',
    version: '1.0.0',
    private: true,
    scripts: {
      diag: 'node diag.js',
      'start:prod': 'node dist/main',
    },
    engines: { node: '>=20.19' },
    dependencies: deps,
  };
  writeFileSync(join(DEPLOY_DIR, 'package.json'), JSON.stringify(deployJson, null, 2));
  console.log(`Flat bundle staged with ${Object.keys(deps).length} pinned dependencies`);

  run('npm install --omit=dev --no-audit --no-fund --loglevel=error', DEPLOY_DIR);

  const prismaSource = findPrismaSource();
  if (!prismaSource) throw new Error('Cannot find generated Prisma client (.prisma) in workspace node_modules');
  rmSync(join(DEPLOY_DIR, 'node_modules', '.prisma'), { recursive: true, force: true });
  cpSync(prismaSource, join(DEPLOY_DIR, 'node_modules', '.prisma'), { recursive: true });
  console.log('Copied generated Prisma client into node_modules/.prisma');

  // npm links file: deps as symlinks -> replace with real copies (Plesk-safe)
  for (const name of ['database', 'types']) {
    const linkPath = join(DEPLOY_DIR, 'node_modules', '@repo', name);
    rmSync(linkPath, { recursive: true, force: true });
    cpSync(join(DEPLOY_DIR, 'vendor', name), linkPath, { recursive: true });
  }
  console.log('Dereferenced @repo/* symlinks');

  // vendor/ is only needed for the npm install step, not at runtime
  rmSync(join(DEPLOY_DIR, 'vendor'), { recursive: true, force: true });
  console.log('Removed vendor/ (install-time only)');
}

function smokeTest() {
  return new Promise((resolveSmoke) => {
    const child = spawn('node', ['dist/main.js'], {
      cwd: DEPLOY_DIR,
      env: { ...process.env, PORT: '3999', NODE_ENV: 'production' },
      stdio: 'ignore',
    });
    let settled = false;
    const finish = (ok, detail) => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGTERM'); } catch {}
      resolveSmoke({ ok, detail });
    };
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('http://localhost:3999/health');
        const body = await res.text();
        // CI uses a dummy database URL; this smoke test only checks app boot.
        // The health payload separately reports database connectivity.
        finish(res.ok && body.includes('"service":"kz-game-hub-api"'), body);
      } catch (e) {
        finish(false, e.message);
      }
    }, 8000);
    child.on('exit', () => { clearTimeout(timer); finish(false, 'process exited early'); });
  });
}

async function ftpUpload() {
  if (!FTP_HOST || !FTP_USER || !FTP_PASS) {
    throw new Error('Missing FTP_HOST / FTP_USER / FTP_PASS (set in root .env or pass --host/--user/--pass)');
  }
  const client = new Client(30000);
  client.ftp.verbose = false;
  let lastPct = -1;
  client.trackProgress((info) => {
    if (info.bytesOverall > 0) {
      const pct = Math.floor((info.bytes / info.bytesOverall) * 100);
      if (pct >= lastPct + 10) {
        lastPct = pct;
        process.stdout.write(`  upload... ${pct}%\n`);
      }
    }
  });
  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      secure: FTP_SECURE,
      port: 21,
    });
    await client.ensureDir(FTP_REMOTE_DIR);
    const remoteZip = `${FTP_REMOTE_DIR.replace(/\/$/, '')}/${basename(ZIP_PATH)}`;
    console.log(`Uploading ${ZIP_PATH} -> ${remoteZip}`);
    await client.uploadFrom(ZIP_PATH, remoteZip);
    console.log('Upload complete.');
  } finally {
    client.close();
  }
}

function printChecklist() {
  console.log(`
================================================================
 DONE — next steps in Plesk
================================================================
1) File Manager -> ${FTP_REMOTE_DIR} -> delete old files first
   (dist/, node_modules/, package.json, diag.js — keep the zips)
2) Right-click ${basename(ZIP_PATH)} -> Extract Files (into the same folder)
3) Domains -> <api subdomain> -> Node.js:
   - Document root: ${FTP_REMOTE_DIR}
   - Application startup file: dist/main.js
   - Node.js version: 22 LTS (not 25)
4) Environment variables (App > Custom environment variables):
   NODE_ENV=production
   DATABASE_URL=mysql://<user>:<pass>@<db-host>:3306/<db>
   CORS_ORIGIN=https://<web-url>   <- ต้องเป็น URL จริง ไม่ใช่ localhost
   GEMINI_API_KEY=...  SPOTIFY_CLIENT_ID=...  SPOTIFY_CLIENT_SECRET=...  YOUTUBE_API_KEY=...
5) Restart app -> test https://<api-domain>/health  (ต้องได้ {"status":"ok"})

   Rollback: zips เก่าถูกเก็บไว้ที่ ${FTP_REMOTE_DIR} — extract zip อันเก่าแล้ว Restart ได้เลย
================================================================
`);
}

async function main() {
  const origProvider = detectProvider();
  try {
    if (!SKIP_BUILD) {
      // Always ensure the mysql provider before generating the client —
      // idempotent, so local pg setups stay safe (restored in finally)
      run('pnpm db:use:mysql');
      run('pnpm build');
    }
    buildFlatBundle();
    const smoke = await smokeTest();
    console.log(smoke.ok ? 'Smoke test: OK' : `Smoke test: WARNING — ${smoke.detail}`);
    if (!smoke.ok && process.env.CI === 'true') {
      throw new Error(`Smoke test failed in CI: ${smoke.detail}`);
    }
    if (SKIP_UPLOAD) {
      console.log(`[skip-upload] Bundle ready in ${DEPLOY_DIR}`);
      return;
    }
    rmSync(ZIP_PATH, { force: true });
    run(`zip -q -r ${ZIP_PATH} .`, DEPLOY_DIR);
    if (DRY_RUN) {
      console.log(`[dry-run] Skipping FTP upload. Bundle ready: ${ZIP_PATH}`);
    } else {
      await ftpUpload();
    }
    printChecklist();
  } finally {
    if (!SKIP_BUILD && origProvider !== 'mysql') {
      console.log(`Restoring schema provider to ${origProvider}`);
      run(`pnpm db:use:${origProvider === 'postgresql' ? 'pg' : 'mysql'}`);
    }
  }
}

main().catch((e) => {
  console.error(`\nDEPLOY FAILED: ${e.message}`);
  process.exit(1);
});
