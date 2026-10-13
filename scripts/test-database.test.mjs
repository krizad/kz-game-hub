import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configureTestDatabase } from './test-database.mjs';

test('requires explicit test URL instead of falling back to DATABASE_URL', () => {
  const env = { DATABASE_URL: 'mysql://private:secret@remote.invalid/production' };
  assert.throws(() => configureTestDatabase(env), /Set TEST_DATABASE_URL/);
  assert.equal(env.DATABASE_URL, 'mysql://private:secret@remote.invalid/production');
});
test('rejects remote hosts, non-test databases and connection overrides without printing credentials', () => {
  for (const url of [
    'mysql://private:secret@remote.invalid/kz_test',
    'mysql://private:secret@127.0.0.1/production',
    'postgresql://private:secret@127.0.0.1/kz_test',
    'mysql://private:secret@127.0.0.1/kz_test?host=remote.invalid',
    'mysql://private:secret@127.0.0.1/kz_test%2Fproduction',
    'not a URL',
  ]) {
    assert.throws(
      () => configureTestDatabase({ TEST_DATABASE_URL: url }),
      (error) => {
        assert.doesNotMatch(error.message, /private|secret|remote.invalid/);
        return true;
      },
    );
  }
});
test('sets the validated URL for all child processes, including IPv6 loopback', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
    const env = { TEST_DATABASE_URL: `mysql://test:test@${host}:13306/kz_game_hub_test` };
    assert.equal(configureTestDatabase(env), env.TEST_DATABASE_URL);
    assert.equal(env.DATABASE_URL, env.TEST_DATABASE_URL);
  }
});
