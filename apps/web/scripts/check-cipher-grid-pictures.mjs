import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(
  resolve(webRoot, '../../packages/types/src/cipher-grid-pictures.ts'),
  'utf8',
);

function dimensions(bytes, extension, isFixture) {
  if (extension === 'svg') {
    const svg = bytes.toString('utf8');
    assert(isFixture, 'SVG is allowed only for development fixtures');
    assert(
      !/<(?:script|foreignObject)\b|\bon\w+\s*=|(?:href|url)\s*[=(]/i.test(svg),
      'Fixture must be self-contained passive SVG',
    );
    assert(svg.includes('DEV FIXTURE'), 'Fixture must visibly identify itself');
    const tag = svg.match(/<svg\b[^>]*>/)?.[0] ?? '';
    return [Number(tag.match(/\bwidth="(\d+)"/)?.[1]), Number(tag.match(/\bheight="(\d+)"/)?.[1])];
  }
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', 'Expected WebP RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', 'Expected WebP image');
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const tag = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    assert(start + size <= bytes.length, 'Truncated WebP chunk');
    if (tag === 'VP8X')
      return [1 + bytes.readUIntLE(start + 4, 3), 1 + bytes.readUIntLE(start + 7, 3)];
    if (tag === 'VP8 ')
      return [bytes.readUInt16LE(start + 6) & 0x3fff, bytes.readUInt16LE(start + 8) & 0x3fff];
    if (tag === 'VP8L') {
      const bits = bytes.readUInt32LE(start + 1);
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
    }
    offset = start + size + (size % 2);
  }
  throw new Error('WebP dimensions missing');
}

const PACKS = [
  {
    name: 'pictures-v1',
    url: '/images/cipher-grid/pictures-v1/',
    regex: /export const CIPHER_GRID_PICTURES_CLASSIC = ([\s\S]*?) as const satisfies/,
  },
  {
    name: 'pictures-minimal',
    url: '/images/cipher-grid/pictures-minimal/',
    regex: /export const CIPHER_GRID_PICTURES_MINIMAL = ([\s\S]*?) as const satisfies/,
  },
];

for (const packConfig of PACKS) {
  const packRoot = await realpath(resolve(webRoot, `public${packConfig.url}`));
  const literal = source.match(packConfig.regex);
  assert(literal, `Shared catalog for ${packConfig.name} must remain a JSON-compatible literal`);
  const catalog = JSON.parse(literal[1]);
  const manifest = JSON.parse(await readFile(resolve(packRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.pack, packConfig.name);
  assert.equal(manifest.fixture, /CIPHER_GRID_PICTURE_PACK_IS_FIXTURE = true/.test(source));
  assert(manifest.provenance?.description?.trim(), `Pack provenance is required for ${packConfig.name}`);
  assert(catalog.length >= 20, `${packConfig.name} requires at least 20 pictures`);
  assert.deepEqual(
    manifest.pictures.map(({ id, src, thumbnail, alt }) => ({ id, src, thumbnail, alt })),
    catalog,
    `Manifest and shared catalog differ for ${packConfig.name}`,
  );

  const ids = new Set();
  const fullHashes = new Set();
  const thumbnailHashes = new Set();
  let thumbnailBytes = 0;

  for (const [index, picture] of catalog.entries()) {
    assert(/^cg-p\d{3}$/.test(picture.id), `Invalid opaque ID: ${picture.id}`);
    assert(!ids.has(picture.id), `Duplicate ID: ${picture.id}`);
    ids.add(picture.id);
    for (const language of ['th', 'en'])
      assert(picture.alt[language]?.trim(), `${picture.id}: missing ${language} alt`);
    const inventory = manifest.pictures[index];
    for (const role of ['src', 'thumbnail']) {
      const path = picture[role];
      assert(path.startsWith(packConfig.url) && !path.includes('..'), `${picture.id}: path outside pack`);
      const extension = path.split('.').at(-1);
      assert(['svg', 'webp'].includes(extension), `${picture.id}: unsupported format`);
      assert(
        path.slice(packConfig.url.length).startsWith(`${picture.id}.`) ||
          path.slice(packConfig.url.length).startsWith(`${picture.id}-`),
        `${picture.id}: mismatched asset pair`,
      );
      const file = await realpath(resolve(webRoot, `public${path}`));
      assert(file.startsWith(`${packRoot}${sep}`), 'Asset resolves outside pack');
      const bytes = await readFile(file);
      assert(
        bytes.length > 0 && bytes.length <= (role === 'src' ? 120 : 20) * 1024,
        `${picture.id}: ${role} byte budget exceeded`,
      );
      const [width, height] = dimensions(bytes, extension, manifest.fixture);
      const expected = role === 'src' ? 768 : manifest.fixture ? 768 : 192;
      assert.deepEqual(
        [width, height],
        [expected, expected],
        `${picture.id}: incorrect ${role} dimensions`,
      );
      assert.equal(width, role === 'src' ? inventory.width : inventory.thumbnailWidth);
      assert.equal(height, role === 'src' ? inventory.height : inventory.thumbnailHeight);
      const hash = createHash('sha256').update(bytes).digest('hex');
      const hashes = role === 'src' ? fullHashes : thumbnailHashes;
      assert(!hashes.has(hash), `${picture.id}: duplicate ${role} contents`);
      hashes.add(hash);
      if (role === 'thumbnail') thumbnailBytes += bytes.length;
    }
  }
  assert(thumbnailBytes <= 400 * 1024, `Combined thumbnail budget exceeded for ${packConfig.name}`);
  console.log(
    `Cipher Grid [${packConfig.name}]: ${catalog.length} ${manifest.fixture ? 'development fixtures' : 'pictures'} verified; thumbnails ${thumbnailBytes} bytes.`,
  );
}
