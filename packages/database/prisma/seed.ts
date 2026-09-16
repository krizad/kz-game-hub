import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../.env') });

// Loaded after env config so the adapter detects the correct protocol
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require('../src/index');

async function main() {
  console.log('Seeding Sounds Fishy questions...');
  const fishyFilePath = path.join(__dirname, 'sounds-fishy-seed.json');
  const existingQuestions = await prisma.soundsFishyQuestion.count();
  if (existingQuestions > 0) {
    console.log(`Sounds Fishy questions already seeded (${existingQuestions}). Skipping.`);
  } else if (fs.existsSync(fishyFilePath)) {
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
  const existingWords = await prisma.word.count();
  if (existingWords > 0) {
    console.log(`Who Am I words already seeded (${existingWords}). Skipping.`);
  } else if (fs.existsSync(wordsFilePath)) {
    const wordsContent = fs.readFileSync(wordsFilePath, 'utf-8');
    const wordsData = JSON.parse(wordsContent);
    for (const item of wordsData) {
      await prisma.word.create({
        data: {
          word: item.word,
          emoji: item.emoji || null,
          category: item.category,
          lang: item.lang || 'en',
        },
      });
    }
    console.log(`Successfully seeded ${wordsData.length} Who Am I words.`);
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
