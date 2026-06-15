import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding Sounds Fishy questions...');
  const fishyFilePath = path.join(__dirname, 'sounds-fishy-seed.json');
  if (fs.existsSync(fishyFilePath)) {
    const fishyContent = fs.readFileSync(fishyFilePath, 'utf-8');
    const questions = JSON.parse(fishyContent);
    for (const q of questions) {
      await prisma.soundsFishyQuestion.create({
        data: {
          question: q.question,
          answer: q.answer,
          lang: q.lang,
        },
      });
    }
    console.log(`Successfully seeded ${questions.length} Sounds Fishy questions.`);
  }

  console.log('Seeding Who Am I words...');
  const wordsFilePath = path.join(__dirname, 'words.json');
  if (fs.existsSync(wordsFilePath)) {
    const wordsContent = fs.readFileSync(wordsFilePath, 'utf-8');
    const wordsData = JSON.parse(wordsContent);
    for (const category in wordsData) {
      const items = wordsData[category];
      for (const item of items) {
        await prisma.word.create({
          data: {
            word: typeof item === 'string' ? item : item.word,
            emoji: typeof item === 'string' ? null : item.emoji || null,
            category: category,
          },
        });
      }
    }
    console.log('Successfully seeded Who Am I words.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
