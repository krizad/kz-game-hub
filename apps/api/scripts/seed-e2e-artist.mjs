import { configureTestDatabase } from '../../../scripts/test-database.mjs';

configureTestDatabase();
const { prisma } = await import('@repo/database');
try {
  const artist = await prisma.artistPreset.upsert({
    where: { name: 'E2E Artist' },
    update: { enabled: true },
    create: { id: 'e2e-artist', name: 'E2E Artist', enabled: true },
  });
  await prisma.artistTrack.createMany({
    data: Array.from({ length: 5 }, (_, index) => ({
      artistId: artist.id,
      videoId: `e2eTrack00${index}`,
      title: `E2E Song ${index}`,
      normalizedTitle: `e2e song ${index}`,
      viewCount: 60000000,
      durationMs: 30000,
    })),
    skipDuplicates: true,
  });
} finally {
  await prisma.$disconnect();
}
