/**
 * KZ Game Hub - Random Funny Name Generator
 * Format: <สัตว์><สี/ขนาด><กริยาปั่นๆ>
 * (Animal + Color/Size + Funny/Meme Action)
 */

export const ANIMALS_TH = [
  'แมว',
  'หมา',
  'เป็ด',
  'ไก่',
  'หมู',
  'หมี',
  'ลิง',
  'ช้าง',
  'กบ',
  'เต่า',
  'คาปิบารา',
  'แพนด้า',
  'กระต่าย',
  'นาก',
  'เสือ',
  'สิงโต',
  'นกฮูก',
  'แฮมสเตอร์',
  'ปลาวาฬ',
  'ฉลาม',
  'จิ้งจก',
  'แรคคูน',
  'โคอาล่า',
  'เพนกวิน',
  'ยีราฟ',
  'จระเข้',
  'ฮิปโป',
  'กิ้งก่า',
  'แมลงสาบ',
  'ปลาทอง',
  'อัลปาก้า',
  'สลอธ',
  'กุ้งมังกร',
  'ม้าน้ำ',
  'ตุ่นปากเป็ด',
  'แมงมุม',
  'นกกระจอก',
  'นกพิราบ',
  'ปู',
  'ปลาหมึก',
] as const;

export const ATTRIBUTES_TH = [
  'ส้ม',
  'ม่วง',
  'ชมพู',
  'ดำ',
  'ขาว',
  'เขียว',
  'ฟ้า',
  'เหลือง',
  'ทอง',
  'รุ้ง',
  'นีออน',
  'อ้วน',
  'ผอม',
  'จิ๋ว',
  'ยักษ์',
  'เตี้ย',
  'เบิ้ม',
  'มินิ',
  'ตัวตึง',
  'ตุ้ยนุ้ย',
  'เปรี้ยว',
  'หล่อ',
  'ตาโต',
  'บึกบึน',
  'กล้ามโต',
  'ขนฟู',
  'ขาสั้น',
  'หน้ามึน',
  'ไซส์บิ๊ก',
  'พุงพลุ้ย',
  'ดุดัน',
  'ตัวป่วน',
] as const;

export const ACTIONS_TH = [
  'เต้นแร็ป',
  'ตกท่อ',
  'วิ่งชนกำแพง',
  'ตดอัดหน้า',
  'ขโมยกล้วย',
  'ร้องกรี๊ด',
  'แอบกินมาม่า',
  'ช็อตฟีล',
  'กลิ้งตกเตียง',
  'สะดุดขาตัวเอง',
  'โดนสาป',
  'เล่นของสูง',
  'นั่งเหม่อ',
  'นอนกลิ้ง',
  'ดีดนิ้ว',
  'ปั่นไฟ',
  'บินชนกระจก',
  'หัวเราะอร่อย',
  'เหยียบเปลือกกล้วย',
  'ตกใจหมดเลย',
  'ขิตแป๊บ',
  'เลิ่กลั่ก',
  'โวยวาย',
  'จามแรง',
  'หาวปากกว้าง',
  'สะบัดบ๊อบ',
  'มุดถังขยะ',
  'เดินเซ',
  'งัดถั่งงัด',
  'เคี้ยวน้ำแข็ง',
  'เล่นมายากล',
  'ย่องเบา',
  'แอบตด',
  'กัดสายไฟ',
  'สวบหมดจาน',
  'ไถสเก็ต',
  'ดริฟต์โค้ง',
  'พ่นไฟ',
  'ปีนเสาไฟ',
  'แกล้งตาย',
  'บีบไก่โอ๊ก',
  'ซดชานม',
  'สะดุดอากาศ',
] as const;

export const ANIMALS_EN = [
  'Cat',
  'Dog',
  'Duck',
  'Frog',
  'Bear',
  'Panda',
  'Otter',
  'Penguin',
  'Capybara',
  'Koala',
  'Hamster',
  'Shark',
  'Sloth',
  'Raccoon',
  'Hippo',
  'Rabbit',
  'Tiger',
  'Lion',
  'Gecko',
  'Whale',
] as const;

export const ATTRIBUTES_EN = [
  'Orange',
  'Chubby',
  'Tiny',
  'Giant',
  'Purple',
  'Pink',
  'Fluffy',
  'Buff',
  'Neon',
  'Golden',
  'Mini',
  'Sleepy',
  'Spicy',
  'Chonky',
  'Derpy',
  'Zesty',
] as const;

export const ACTIONS_EN = [
  'Rapping',
  'Vibing',
  'Stumbling',
  'Zooming',
  'Sneezing',
  'Screaming',
  'Faceplanting',
  'Moonwalking',
  'Snacking',
  'Drifting',
  'Panicking',
  'Trolling',
  'Dabbling',
  'Skating',
  'Rolling',
] as const;

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

/**
 * Generate a random funny player name.
 * Thai format: <สัตว์><สี/ขนาด><กริยาปั่นๆ> (e.g., แมวส้มเต้นแร็ป, เป็ดจิ๋วตกท่อ)
 * English format: <Color/Size><Animal><Action> (e.g., OrangeCatRapping, ChubbyPandaVibing)
 */
export function generateRandomFunnyName(language: 'th' | 'en' = 'th'): string {
  if (language === 'en') {
    const attribute = pickRandom(ATTRIBUTES_EN);
    const animal = pickRandom(ANIMALS_EN);
    const action = pickRandom(ACTIONS_EN);
    return `${attribute}${animal}${action}`;
  }

  const animal = pickRandom(ANIMALS_TH);
  const attribute = pickRandom(ATTRIBUTES_TH);
  const action = pickRandom(ACTIONS_TH);
  return `${animal}${attribute}${action}`;
}
