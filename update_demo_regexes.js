const fs = require('fs');

let content = fs.readFileSync('apps/web/e2e/demo.spec.ts', 'utf8');

// Replace Tic-Tac-Toe
content = content.replace(/hasText: \/Wins\|Draw\/i/g, "hasText: \/Wins|Draw|ชนะ|เสมอ\/i");

// Replace RPS
content = content.replace(/hasText: \/Next Round\/i/g, "hasText: \/Next Round|รอบต่อไป|เริ่มรอบใหม่\/i");

// Replace Gobbler
content = content.replace(/hasText: \/Wins\/i/g, "hasText: \/Wins|ชนะ\/i");

// Replace Who First
content = content.replace(/hasText: \/Start Game\|เริ่มเกม\/i/g, "hasText: \/Start Game|เริ่มเกม\/i");
content = content.replace(/locator\('text=Scoreboard'\)\.or\(p1\.locator\('text=Game Over'\)\)/g, "getByText(\/Scoreboard|Game Over|ตารางคะแนน|จบเกม\/i)");

// Replace Who Know
content = content.replace(/locator\('text=Host Selection'\)/g, "getByText(\/Host Selection|เลือกเจ้าของห้อง\/i)");
content = content.replace(/hasText: \/Fixed\/i/g, "hasText: \/Fixed|คงที่\/i");
content = content.replace(/hasText: \/Start Game\//g, "hasText: \/Start Game|เริ่มเกม\/i");
content = content.replace(/hasText: \/Word Guessed\|Time's Up\/i/g, "hasText: \/Word Guessed|Time's Up|ทายถูกแล้ว|หมดเวลา\/i");
content = content.replace(/locator\('text=Game Over'\)\.or\(p1\.locator\('text=Scoreboard'\)\)\s*\n\s*\.or\(p1\.locator\('text=Commoners'\)\)\.or\(p1\.locator\('text=Insider'\)\)/g, "getByText(\/Game Over|Scoreboard|Commoners|Insider|จบเกม|ตารางคะแนน|คนทั่วไป|คนวงใน\/i)");

// Replace Sounds Fishy
content = content.replace(/getByText\('Start Game'\)/g, "getByText(\/Start Game|เริ่มเกม\/i)");
content = content.replace(/hasText: \/Eliminate\/i/g, "hasText: \/Eliminate|กำจัด\/i");
content = content.replace(/hasText: \/Bank\/i/g, "hasText: \/Bank|รับคะแนน\/i");
content = content.replace(/const bankBtn = pickerPage.locator\('button'\)\.filter\(\{ hasText: \/Bank\|รับคะแนน\/i \}\);/g, "const bankBtn = pickerPage.locator('button').filter({ hasText: \/Bank|รับคะแนน\/i }).first();");
// Add scoreboard wait for Sounds Fishy
if (!content.includes('Scoreboard|ตารางคะแนน')) {
  content = content.replace(/await pickerPage.waitForTimeout\(1500\);\n      const bankBtn/g, "await pickerPage.waitForTimeout(1500);\n      const bankBtn");
}

// Replace Detective Club
content = content.replace(/locator\('text=Round Results'\)\.or\(p1\.locator\('text=Scoreboard'\)\)/g, "getByText(\/Round Results|Scoreboard|ผลลัพธ์รอบนี้|ตารางคะแนน\/i)");

// Replace Music Trivia
content = content.replace(/getByPlaceholder\(\/Taylor Swift\|search\|ค้นหา\/i\)/g, "getByPlaceholder(\/Taylor Swift|search|ค้นหา\/i)");
content = content.replace(/getByText\(\/I'm Ready!\/i\)/g, "getByText(\/I'm Ready!|ฉันพร้อมแล้ว\/i)");
content = content.replace(/getByText\('Start Song \\(Countdown\\)'\)/g, "getByText(\/Start Song|เริ่มเพลง\/i)");
content = content.replace(/hasText: \/BUZZ!\/i/g, "hasText: \/BUZZ!|X\/i");
content = content.replace(/locator\('text=Scoreboard'\)\.or\(p1\.locator\('text=Round'\)\)\.or\(p1\.locator\('text=Correct'\)\)/g, "getByText(\/Scoreboard|Round|Correct|ตารางคะแนน|รอบ|ถูกต้อง\/i)");

fs.writeFileSync('apps/web/e2e/demo.spec.ts', content);
