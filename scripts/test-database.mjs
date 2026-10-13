export function configureTestDatabase(env = process.env) {
  const value = env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error(
      'Set TEST_DATABASE_URL to a disposable local MySQL database before running E2E.',
    );
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid local MySQL URL.');
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    !['mysql:', 'mariadb:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^[a-zA-Z0-9_-]+$/.test(database) ||
    !/^(?:test(?:[_-].*)?|.*[_-]test(?:[_-].*)?)$/.test(database) ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'E2E requires loopback MySQL and a database named test or containing _test/-test.',
    );
  }
  env.DATABASE_URL = value;
  return value;
}
