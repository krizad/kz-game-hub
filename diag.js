const fs = require('fs');
const path = require('path');

let allOk = true;
function log(...a) {
  console.log(...a);
}

log('=== KZ API deploy diagnostic ===');
log('cwd:', process.cwd());
log('node:', process.version);

const checks = [
  ['dist/main.js', 'startup file'],
  ['node_modules/@repo/database', 'workspace dep: database'],
  ['node_modules/@repo/types', 'workspace dep: types'],
  ['node_modules/@nestjs/core', 'nestjs core'],
  ['node_modules/.prisma/client/default.js', 'generated prisma client'],
];
for (const [rel, label] of checks) {
  const p = path.resolve(rel);
  const ok = fs.existsSync(p);
  if (!ok) allOk = false;
  let type = 'MISSING';
  if (ok) {
    try {
      type = fs.lstatSync(p).isSymbolicLink() ? 'SYMLINK' : fs.lstatSync(p).isDirectory() ? 'dir' : 'file';
    } catch (e) {
      type = 'ERROR: ' + e.message;
    }
  }
  log(`${ok ? 'OK  ' : 'FAIL'} ${label}: ${rel} (${type})`);
}

for (const k of ['DATABASE_URL', 'PORT', 'NODE_ENV', 'CORS_ORIGIN']) {
  const v = process.env[k];
  const extra = k === 'DATABASE_URL' && v ? ' (' + v.slice(0, 10) + '...)' : '';
  log(`env ${k}: ${v ? 'SET' + extra : 'MISSING'}`);
}

try {
  const r = require.resolve('@repo/database');
  log('OK  resolve @repo/database ->', r);
} catch (e) {
  allOk = false;
  log('FAIL resolve @repo/database:', e.message);
}

try {
  const r = require.resolve('@prisma/client');
  log('OK  resolve @prisma/client ->', r);
} catch (e) {
  allOk = false;
  log('FAIL resolve @prisma/client:', e.message);
}

try {
  const { prisma } = require('@repo/database');
  log('OK  @repo/database loaded, prisma client constructed');
  prisma.$disconnect().then(() => {
    log(allOk ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ===');
    process.exit(allOk ? 0 : 1);
  });
} catch (e) {
  allOk = false;
  log('FAIL load @repo/database:', e.message);
  log(allOk ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ===');
  process.exit(1);
}
