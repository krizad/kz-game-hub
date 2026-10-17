/** Public image inventory only; never contains keycard assignments. */
export interface CipherGridPicture {
  readonly id: string;
  readonly src: string;
  readonly thumbnail: string;
  readonly alt: { readonly th: string; readonly en: string };
}

export type CipherGridPicturePack = 'CLASSIC' | 'MINIMAL';

/** Production artwork pack for Cipher Grid Pictures. */
export const CIPHER_GRID_PICTURE_PACK_IS_FIXTURE = false;

// prettier-ignore
export const CIPHER_GRID_PICTURES_CLASSIC = [
  {
    "id": "cg-p001",
    "src": "/images/cipher-grid/pictures-v1/cg-p001.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p001-thumb.webp",
    "alt": {
      "th": "ต้นแอปเปิ้ลที่งอกออกมาจากหลอดไฟสว่างไสว",
      "en": "An apple tree growing out of a glowing lightbulb"
    }
  },
  {
    "id": "cg-p002",
    "src": "/images/cipher-grid/pictures-v1/cg-p002.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p002-thumb.webp",
    "alt": {
      "th": "เรือดำน้ำติดปีกบินอยู่ท่ามกลางก้อนเมฆ",
      "en": "A winged submarine flying through fluffy clouds"
    }
  },
  {
    "id": "cg-p003",
    "src": "/images/cipher-grid/pictures-v1/cg-p003.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p003-thumb.webp",
    "alt": {
      "th": "นาฬิกาลูกตุ้มโบราณที่มีกรงนกและนกน้อยร้องเพลงอยู่ด้านใน",
      "en": "An antique grandfather clock with a birdcage and singing bird inside"
    }
  },
  {
    "id": "cg-p004",
    "src": "/images/cipher-grid/pictures-v1/cg-p004.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p004-thumb.webp",
    "alt": {
      "th": "ปราสาทหินโบราณตั้งอยู่บนกระดองของเต่ายักษ์กลางทะเล",
      "en": "A stone castle tower built on the shell of a giant swimming turtle"
    }
  },
  {
    "id": "cg-p005",
    "src": "/images/cipher-grid/pictures-v1/cg-p005.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p005-thumb.webp",
    "alt": {
      "th": "ถ้วยกาแฟร้อนที่มีเรือใบสามเสาแล่นอยู่บนผิวกาแฟ",
      "en": "A ceramic coffee cup with a tiny three-masted sailboat sailing on coffee"
    }
  },
  {
    "id": "cg-p006",
    "src": "/images/cipher-grid/pictures-v1/cg-p006.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p006-thumb.webp",
    "alt": {
      "th": "หนังสือโบราณที่หน้ากระดาษพับกลายเป็นบันไดหินทอดยาวสู่ยอดเขา",
      "en": "An open book whose pages turn into stone stairs leading up a mountain"
    }
  },
  {
    "id": "cg-p007",
    "src": "/images/cipher-grid/pictures-v1/cg-p007.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p007-thumb.webp",
    "alt": {
      "th": "กรรไกรทองเหลืองโบราณที่มีด้ามจับเป็นมังกรคู่",
      "en": "Vintage brass scissors with ornate dragon heads for handles"
    }
  },
  {
    "id": "cg-p008",
    "src": "/images/cipher-grid/pictures-v1/cg-p008.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p008-thumb.webp",
    "alt": {
      "th": "บอลลูนลมร้อนรูปปลาหมึกยักษ์ที่ใช้หนวดหิ้วกระเช้าผู้โดยสาร",
      "en": "A hot air balloon shaped like a floating octopus holding a wicker basket"
    }
  },
  {
    "id": "cg-p009",
    "src": "/images/cipher-grid/pictures-v1/cg-p009.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p009-thumb.webp",
    "alt": {
      "th": "กล้องโทรทรรศน์ทองเหลืองที่มีรากไม้และเถาวัลย์ดอกไม้ยึดกับพื้นดิน",
      "en": "A brass telescope anchored to the ground with tree roots and blooming vines"
    }
  },
  {
    "id": "cg-p010",
    "src": "/images/cipher-grid/pictures-v1/cg-p010.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p010-thumb.webp",
    "alt": {
      "th": "สมอเรือเหล็กขนาดใหญ่ที่พันด้วยเถาวัลย์กุหลาบแดงผลิบาน",
      "en": "An iron ship anchor entwined with blooming roses and thorny vines"
    }
  },
  {
    "id": "cg-p011",
    "src": "/images/cipher-grid/pictures-v1/cg-p011.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p011-thumb.webp",
    "alt": {
      "th": "อัศวินหุ่นยนต์ไขลานกางร่มกันฝนเดินลุยแอ่งน้ำ",
      "en": "A clockwork robot knight holding an umbrella walking through rain puddles"
    }
  },
  {
    "id": "cg-p012",
    "src": "/images/cipher-grid/pictures-v1/cg-p012.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p012-thumb.webp",
    "alt": {
      "th": "เปียโนหลังใหญ่ที่คีย์เปียโนทอดข้ามลำธารเป็นสะพานโค้งเหนือน้ำ",
      "en": "A grand piano whose keys form an arched bridge over a stream with fish"
    }
  },
  {
    "id": "cg-p013",
    "src": "/images/cipher-grid/pictures-v1/cg-p013.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p013-thumb.webp",
    "alt": {
      "th": "เข็มทิศโบราณที่มีเข็มชี้ทิศเป็นขนนกจุ่มหมึกเขียนหนังสือ",
      "en": "An ornate compass rose with feather quill pens as directional needles"
    }
  },
  {
    "id": "cg-p014",
    "src": "/images/cipher-grid/pictures-v1/cg-p014.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p014-thumb.webp",
    "alt": {
      "th": "นกเรเวนสวมมงกุฎทองคำเกาะอยู่บนกุญแจโบราณขนาดใหญ่",
      "en": "A raven wearing a golden royal crown perched on an antique skeleton key"
    }
  },
  {
    "id": "cg-p015",
    "src": "/images/cipher-grid/pictures-v1/cg-p015.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p015-thumb.webp",
    "alt": {
      "th": "รถจักรไอน้ำโบราณที่วิ่งอยู่บนรองเท้าโรลเลอร์สเก็ตติดล้อขนาดยักษ์",
      "en": "A vintage steam locomotive riding on giant retro roller skates"
    }
  },
  {
    "id": "cg-p016",
    "src": "/images/cipher-grid/pictures-v1/cg-p016.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p016-thumb.webp",
    "alt": {
      "th": "ขวดยาแก้วใสที่มีภูเขาน้ำแข็งและเรือใบจำลองอยู่ด้านใน",
      "en": "A glass potion bottle with a frozen iceberg and miniature ship inside"
    }
  },
  {
    "id": "cg-p017",
    "src": "/images/cipher-grid/pictures-v1/cg-p017.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p017-thumb.webp",
    "alt": {
      "th": "กล้องถ่ายรูปโบราณที่มีเลนส์กล้องเป็นดอกทานตะวันบานสะพรั่ง",
      "en": "A vintage twin-lens reflex camera with a blooming sunflower for a lens"
    }
  },
  {
    "id": "cg-p018",
    "src": "/images/cipher-grid/pictures-v1/cg-p018.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p018-thumb.webp",
    "alt": {
      "th": "พระจันทร์เสี้ยวสวมหมวกนอนและแว่นตากำลังอ่านม้วนคัมภีร์โบราณ",
      "en": "A crescent moon wearing a sleeping nightcap and reading glasses examining a scroll"
    }
  },
  {
    "id": "cg-p019",
    "src": "/images/cipher-grid/pictures-v1/cg-p019.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p019-thumb.webp",
    "alt": {
      "th": "กระท่อมไม้แสนอบอุ่นที่สร้างอยู่ในรองเท้าบูทหนังเก่าและมีควันลอยจากปล่องไฟ",
      "en": "A cozy cottage built into an old leather boot with smoke rising from a chimney"
    }
  },
  {
    "id": "cg-p020",
    "src": "/images/cipher-grid/pictures-v1/cg-p020.webp",
    "thumbnail": "/images/cipher-grid/pictures-v1/cg-p020-thumb.webp",
    "alt": {
      "th": "หมากรุกคิงมีปีกผีเสื้อลายสวยงามยืนอยู่บนใบบัวกลางน้ำ",
      "en": "A chess king piece with monarch butterfly wings standing on a water lily pad"
    }
  }
] as const satisfies readonly CipherGridPicture[];

// prettier-ignore
export const CIPHER_GRID_PICTURES_MINIMAL = [
  {
    "id": "cg-p001",
    "src": "/images/cipher-grid/pictures-minimal/cg-p001.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p001-thumb.webp",
    "alt": {
      "th": "ต้นแอปเปิ้ลที่งอกออกมาจากหลอดไฟ",
      "en": "An apple tree growing out of a lightbulb"
    }
  },
  {
    "id": "cg-p002",
    "src": "/images/cipher-grid/pictures-minimal/cg-p002.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p002-thumb.webp",
    "alt": {
      "th": "เรือดำน้ำติดปีกบินอยู่ท่ามกลางก้อนเมฆ",
      "en": "A winged submarine flying through clouds"
    }
  },
  {
    "id": "cg-p003",
    "src": "/images/cipher-grid/pictures-minimal/cg-p003.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p003-thumb.webp",
    "alt": {
      "th": "นาฬิกาลูกตุ้มโบราณที่มีกรงนกและนกน้อยอยู่ด้านใน",
      "en": "An antique grandfather clock with a birdcage and singing bird inside"
    }
  },
  {
    "id": "cg-p004",
    "src": "/images/cipher-grid/pictures-minimal/cg-p004.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p004-thumb.webp",
    "alt": {
      "th": "ปราสาทหินโบราณบนกระดองเต่ายักษ์กลางทะเล",
      "en": "A stone castle tower on a giant turtle shell"
    }
  },
  {
    "id": "cg-p005",
    "src": "/images/cipher-grid/pictures-minimal/cg-p005.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p005-thumb.webp",
    "alt": {
      "th": "ถ้วยกาแฟที่มีเรือใบแล่นอยู่บนผิวกาแฟ",
      "en": "A coffee cup with a tiny sailboat sailing on coffee"
    }
  },
  {
    "id": "cg-p006",
    "src": "/images/cipher-grid/pictures-minimal/cg-p006.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p006-thumb.webp",
    "alt": {
      "th": "หนังสือที่หน้ากระดาษกลายเป็นบันไดทอดยาวสู่ยอดเขา",
      "en": "An open book whose pages turn into stairs leading up a mountain"
    }
  },
  {
    "id": "cg-p007",
    "src": "/images/cipher-grid/pictures-minimal/cg-p007.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p007-thumb.webp",
    "alt": {
      "th": "กรรไกรโบราณที่มีด้ามจับเป็นมังกรคู่",
      "en": "Vintage scissors with dragon heads for handles"
    }
  },
  {
    "id": "cg-p008",
    "src": "/images/cipher-grid/pictures-minimal/cg-p008.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p008-thumb.webp",
    "alt": {
      "th": "บอลลูนลมร้อนรูปปลาหมึกยักษ์หิ้วกระเช้าผู้โดยสาร",
      "en": "A hot air balloon shaped like an octopus holding a basket"
    }
  },
  {
    "id": "cg-p009",
    "src": "/images/cipher-grid/pictures-minimal/cg-p009.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p009-thumb.webp",
    "alt": {
      "th": "กล้องโทรทรรศน์ที่มีรากไม้และเถาวัลย์ยึดกับพื้นดิน",
      "en": "A telescope anchored to the ground with tree roots and vines"
    }
  },
  {
    "id": "cg-p010",
    "src": "/images/cipher-grid/pictures-minimal/cg-p010.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p010-thumb.webp",
    "alt": {
      "th": "สมอเรือที่พันด้วยเถาวัลย์ดอกกุหลาบผลิบาน",
      "en": "A ship anchor entwined with blooming roses and thorny vines"
    }
  },
  {
    "id": "cg-p011",
    "src": "/images/cipher-grid/pictures-minimal/cg-p011.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p011-thumb.webp",
    "alt": {
      "th": "อัศวินหุ่นยนต์ไขลานกางร่มเดินลุยแอ่งน้ำ",
      "en": "A clockwork robot knight holding an umbrella in rain puddles"
    }
  },
  {
    "id": "cg-p012",
    "src": "/images/cipher-grid/pictures-minimal/cg-p012.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p012-thumb.webp",
    "alt": {
      "th": "เปียโนที่คีย์เปียโนทอดข้ามลำธารเป็นสะพานโค้ง",
      "en": "A grand piano whose keys form a bridge over a stream"
    }
  },
  {
    "id": "cg-p013",
    "src": "/images/cipher-grid/pictures-minimal/cg-p013.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p013-thumb.webp",
    "alt": {
      "th": "เข็มทิศที่มีเข็มชี้ทิศเป็นขนนกจุ่มหมึก",
      "en": "A compass rose with feather quill pens as directional needles"
    }
  },
  {
    "id": "cg-p014",
    "src": "/images/cipher-grid/pictures-minimal/cg-p014.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p014-thumb.webp",
    "alt": {
      "th": "นกเรเวนสวมมงกุฎเกาะอยู่บนลูกกุญแจโบราณ",
      "en": "A crowned raven perched on an antique skeleton key"
    }
  },
  {
    "id": "cg-p015",
    "src": "/images/cipher-grid/pictures-minimal/cg-p015.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p015-thumb.webp",
    "alt": {
      "th": "รถจักรไอน้ำโบราณที่วิ่งอยู่บนรองเท้าโรลเลอร์สเก็ต",
      "en": "A steam locomotive riding on retro roller skates"
    }
  },
  {
    "id": "cg-p016",
    "src": "/images/cipher-grid/pictures-minimal/cg-p016.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p016-thumb.webp",
    "alt": {
      "th": "ขวดยาแก้วใสที่มีภูเขาน้ำแข็งและเรือใบจำลองอยู่ด้านใน",
      "en": "A glass potion bottle with an iceberg and miniature ship inside"
    }
  },
  {
    "id": "cg-p017",
    "src": "/images/cipher-grid/pictures-minimal/cg-p017.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p017-thumb.webp",
    "alt": {
      "th": "กล้องถ่ายรูปโบราณที่มีเลนส์กล้องเป็นดอกทานตะวัน",
      "en": "A vintage camera with a blooming sunflower for a lens"
    }
  },
  {
    "id": "cg-p018",
    "src": "/images/cipher-grid/pictures-minimal/cg-p018.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p018-thumb.webp",
    "alt": {
      "th": "พระจันทร์เสี้ยวสวมหมวกนอนและแว่นตากำลังอ่านม้วนคัมภีร์",
      "en": "A crescent moon with nightcap and glasses reading a scroll"
    }
  },
  {
    "id": "cg-p019",
    "src": "/images/cipher-grid/pictures-minimal/cg-p019.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p019-thumb.webp",
    "alt": {
      "th": "กระท่อมแสนอบอุ่นที่สร้างอยู่ในรองเท้าบูทหนังเก่าและมีควันลอยจากปล่องไฟ",
      "en": "A cozy cottage built into a leather boot with chimney smoke"
    }
  },
  {
    "id": "cg-p020",
    "src": "/images/cipher-grid/pictures-minimal/cg-p020.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p020-thumb.webp",
    "alt": {
      "th": "หมากรุกคิงมีปีกผีเสื้อยืนอยู่บนใบบัวกลางน้ำ",
      "en": "A chess king piece with butterfly wings standing on a lily pad"
    }
  },
  {
    "id": "cg-p021",
    "src": "/images/cipher-grid/pictures-minimal/cg-p021.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p021-thumb.webp",
    "alt": {
      "th": "นาฬิกาพกโบราณที่เข็มนาฬิกาเป็นกรรไกรกำลังตัดด้ายแห่งดวงดาว",
      "en": "A vintage pocket watch with scissor blades as clock hands cutting starry threads"
    }
  },
  {
    "id": "cg-p022",
    "src": "/images/cipher-grid/pictures-minimal/cg-p022.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p022-thumb.webp",
    "alt": {
      "th": "ถ้วยชาบินได้ที่มีไอน้ำกลายเป็นปีกเมฆ",
      "en": "A flying teacup hot air balloon with steam forming cloud wings"
    }
  },
  {
    "id": "cg-p023",
    "src": "/images/cipher-grid/pictures-minimal/cg-p023.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p023-thumb.webp",
    "alt": {
      "th": "หมวกเกราะอัศวินโบราณที่มีเห็ดและพืชป่าผลิบาน",
      "en": "A knight helmet sprouting wild mushrooms and forest flora"
    }
  },
  {
    "id": "cg-p024",
    "src": "/images/cipher-grid/pictures-minimal/cg-p024.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p024-thumb.webp",
    "alt": {
      "th": "ไวโอลินที่ตัวเครื่องเป็นเรือพายมีไม้พายลอยอยู่เหนือน้ำ",
      "en": "A violin body shaped as a wooden rowboat with oars resting on water"
    }
  },
  {
    "id": "cg-p025",
    "src": "/images/cipher-grid/pictures-minimal/cg-p025.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p025-thumb.webp",
    "alt": {
      "th": "ประภาคารโบราณตั้งอยู่บนโคมไฟกระจกที่มีหิ่งห้อยส่องแสง",
      "en": "A lighthouse standing atop a glass lantern swirling with fireflies"
    }
  },
  {
    "id": "cg-p026",
    "src": "/images/cipher-grid/pictures-minimal/cg-p026.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p026-thumb.webp",
    "alt": {
      "th": "เครื่องพิมพ์ดีดโบราณที่ปุ่มกดผลิบานเป็นกลีบดอกไม้",
      "en": "A vintage typewriter whose keys sprout into blooming flower petals"
    }
  },
  {
    "id": "cg-p027",
    "src": "/images/cipher-grid/pictures-minimal/cg-p027.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p027-thumb.webp",
    "alt": {
      "th": "หอยทากยักษ์ที่แบกกังหันลมโบราณไว้บนกระดอง",
      "en": "A giant snail carrying a cozy windmill cottage on its shell"
    }
  },
  {
    "id": "cg-p028",
    "src": "/images/cipher-grid/pictures-minimal/cg-p028.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p028-thumb.webp",
    "alt": {
      "th": "ร่มกันฝนกลับหัวลอยเป็นเรือใบอยู่บนผิวน้ำ",
      "en": "An upside-down umbrella floating as a sailboat on gentle waves"
    }
  },
  {
    "id": "cg-p029",
    "src": "/images/cipher-grid/pictures-minimal/cg-p029.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p029-thumb.webp",
    "alt": {
      "th": "แม่กุญแจรูปนกฮูกแกะสลักลวดลายขนนกพร้อมรูกุญแจที่หน้าอก",
      "en": "An owl-shaped antique padlock with ornate carved feathers and a chest keyhole"
    }
  },
  {
    "id": "cg-p030",
    "src": "/images/cipher-grid/pictures-minimal/cg-p030.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p030-thumb.webp",
    "alt": {
      "th": "นาฬิกาทรายไม้โบราณที่ด้านในมีเรือกระดาษพับลอยแทนเม็ดทราย",
      "en": "A wooden hourglass containing floating origami paper boats instead of sand"
    }
  },
  {
    "id": "cg-p031",
    "src": "/images/cipher-grid/pictures-minimal/cg-p031.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p031-thumb.webp",
    "alt": {
      "th": "ไมโครโฟนโบราณรูปโคนไอศกรีมที่มีตัวโน้ตดนตรีลอยวน",
      "en": "A vintage microphone shaped like an ice cream cone with musical notes swirling"
    }
  },
  {
    "id": "cg-p032",
    "src": "/images/cipher-grid/pictures-minimal/cg-p032.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p032-thumb.webp",
    "alt": {
      "th": "มังกรน้อยนอนหลับขดตัวอยู่ด้านในกาน้ำชาทองแดงโบราณ",
      "en": "A small dragon curled up asleep inside an antique teapot"
    }
  },
  {
    "id": "cg-p033",
    "src": "/images/cipher-grid/pictures-minimal/cg-p033.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p033-thumb.webp",
    "alt": {
      "th": "บ้านนกไม้ที่สร้างอยู่ในกระเป๋ากล้องหนังเก่าห้อยลงมาจากกิ่งไม้",
      "en": "A wooden birdhouse built inside an old leather camera bag hanging on a branch"
    }
  },
  {
    "id": "cg-p034",
    "src": "/images/cipher-grid/pictures-minimal/cg-p034.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p034-thumb.webp",
    "alt": {
      "th": "จักรยานโบราณที่มีล้อจักรยานเป็นผลส้มหั่นแว่นขนาดใหญ่",
      "en": "A vintage bicycle with giant sliced oranges for wheels and citrus spokes"
    }
  },
  {
    "id": "cg-p035",
    "src": "/images/cipher-grid/pictures-minimal/cg-p035.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p035-thumb.webp",
    "alt": {
      "th": "กล้องส่องทางไกลกำลังส่องดูลูกแก้วหิมะที่มีดาราจักรจิ๋วอยู่ด้านใน",
      "en": "A brass spyglass telescope observing a snowglobe containing a miniature galaxy"
    }
  },
  {
    "id": "cg-p036",
    "src": "/images/cipher-grid/pictures-minimal/cg-p036.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p036-thumb.webp",
    "alt": {
      "th": "โทรทัศน์จอแก้วโบราณที่มีตู้ปลาและปลาทองว่ายน้ำอยู่ด้านใน",
      "en": "A vintage television set containing an aquarium with a swimming goldfish inside"
    }
  },
  {
    "id": "cg-p037",
    "src": "/images/cipher-grid/pictures-minimal/cg-p037.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p037-thumb.webp",
    "alt": {
      "th": "หีบสมบัติไม้โบราณที่มีกิ่งไม้และดอกแอปเปิ้ลผลิบานงอกออกมา",
      "en": "An antique treasure chest sprouting leafy branches and blooming blossoms"
    }
  },
  {
    "id": "cg-p038",
    "src": "/images/cipher-grid/pictures-minimal/cg-p038.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p038-thumb.webp",
    "alt": {
      "th": "ปากกาขนนกจุ่มขวดหมึกที่หมึกไหลรินกลายเป็นแม่น้ำทอดยาวใต้สะพาน",
      "en": "A quill pen in an inkpot where ink flows into a winding river with a bridge"
    }
  },
  {
    "id": "cg-p039",
    "src": "/images/cipher-grid/pictures-minimal/cg-p039.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p039-thumb.webp",
    "alt": {
      "th": "กล้องส่องทางไกลสองตาที่มีกิ่งไม้และนกน้อยเกาะอยู่บนเลนส์",
      "en": "A pair of binoculars with leafy perches where two songbirds look through the lenses"
    }
  },
  {
    "id": "cg-p040",
    "src": "/images/cipher-grid/pictures-minimal/cg-p040.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p040-thumb.webp",
    "alt": {
      "th": "มงกุฎโบราณที่ถักทอจากลูกกุญแจ ขนนก และฟันเฟืองไขลาน",
      "en": "An ornate royal crown interwoven from skeleton keys, feathers, and clockwork gears"
    }
  },
  {
    "id": "cg-p041",
    "src": "/images/cipher-grid/pictures-minimal/cg-p041.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p041-thumb.webp",
    "alt": {
      "th": "เข็มทิศโบราณลอยอยู่เหนือน้ำทะเลที่มีประภาคารจิ๋วตั้งอยู่บนหน้าปัดทองเหลือง",
      "en": "A vintage brass compass floating on water with a tiny lighthouse tower on its dial"
    }
  },
  {
    "id": "cg-p042",
    "src": "/images/cipher-grid/pictures-minimal/cg-p042.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p042-thumb.webp",
    "alt": {
      "th": "นาฬิกาลูกตุ้มโบราณที่มีลูกตุ้มเป็นสมอเรือแกว่งจุ่มลงในฟองคลื่นทะเล",
      "en": "A grandfather clock whose pendulum is a ship anchor dipping into ocean waves"
    }
  },
  {
    "id": "cg-p043",
    "src": "/images/cipher-grid/pictures-minimal/cg-p043.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p043-thumb.webp",
    "alt": {
      "th": "ขวดน้ำหอมคริสตัลโบราณที่ฉีดพ่นละอองดวงดาวตกและพระจันทร์เสี้ยว",
      "en": "An antique crystal perfume bottle spraying a shower of shooting stars and crescent moons"
    }
  },
  {
    "id": "cg-p044",
    "src": "/images/cipher-grid/pictures-minimal/cg-p044.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p044-thumb.webp",
    "alt": {
      "th": "แว่นขยายโบราณกำลังรวมแสงแดดที่กลายร่างเป็นผีเสื้อบิน",
      "en": "An antique magnifying glass focusing sunlight that transforms into a flying butterfly"
    }
  },
  {
    "id": "cg-p045",
    "src": "/images/cipher-grid/pictures-minimal/cg-p045.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p045-thumb.webp",
    "alt": {
      "th": "กล่องใส่ไวโอลินไม้ที่เปิดออกกลายเป็นเรือนกระจกจิ๋วเต็มไปด้วยพืชและเฟิร์นผลิบาน",
      "en": "An open violin case functioning as a miniature greenhouse with blooming flora"
    }
  },
  {
    "id": "cg-p046",
    "src": "/images/cipher-grid/pictures-minimal/cg-p046.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p046-thumb.webp",
    "alt": {
      "th": "บอลลูนลมร้อนรูปนกกระเรียนพับกระดาษโอริกามิลอยอยู่บนท้องฟ้า",
      "en": "A hot air balloon crafted as an intricately folded origami crane"
    }
  },
  {
    "id": "cg-p047",
    "src": "/images/cipher-grid/pictures-minimal/cg-p047.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p047-thumb.webp",
    "alt": {
      "th": "หมวกดำน้ำทองเหลืองโบราณใต้ทะเลที่มีต้นบอนไซจิ๋วเติบโตอยู่ด้านใน",
      "en": "An antique diving helmet on the seabed functioning as a terrarium with a bonsai tree"
    }
  },
  {
    "id": "cg-p048",
    "src": "/images/cipher-grid/pictures-minimal/cg-p048.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p048-thumb.webp",
    "alt": {
      "th": "ปากกาขนนกกำลังเขียนโน้ตดนตรีบนบรรทัดห้าเส้นที่ตัวโน้ตบินกลายเป็นนกนางแอ่น",
      "en": "A feather quill pen writing musical notes that take flight as swallows"
    }
  },
  {
    "id": "cg-p049",
    "src": "/images/cipher-grid/pictures-minimal/cg-p049.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p049-thumb.webp",
    "alt": {
      "th": "กรงนกโบราณที่ซี่กรงเป็นสายพิณฮาร์ปและมีนกน้อยเกาะร้องเพลง",
      "en": "An antique birdcage whose bars are harp strings with a songbird perching and singing"
    }
  },
  {
    "id": "cg-p050",
    "src": "/images/cipher-grid/pictures-minimal/cg-p050.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p050-thumb.webp",
    "alt": {
      "th": "เครื่องเล่นแผ่นเสียงโบราณที่ปากลำโพงผลิบานเป็นดอกผักบุ้งยักษ์พร้อมเถาวัลย์ดนตรี",
      "en": "A vintage gramophone horn blooming into a giant morning glory flower with vines"
    }
  },
  {
    "id": "cg-p051",
    "src": "/images/cipher-grid/pictures-minimal/cg-p051.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p051-thumb.webp",
    "alt": {
      "th": "ลูกกุญแจโบราณที่มีฟันกุญแจเป็นรูปหอคอยปราสาทเทพนิยายยุคกลาง",
      "en": "An antique skeleton key whose teeth form the skyline of a medieval castle"
    }
  },
  {
    "id": "cg-p052",
    "src": "/images/cipher-grid/pictures-minimal/cg-p052.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p052-thumb.webp",
    "alt": {
      "th": "ถ้วยน้ำชาลายครามที่มีสะพานไม้ทรงโค้งทอดยาวข้ามผิวน้ำชาและมีปลาคาร์ปว่ายอยู่ข้างใต้",
      "en": "A porcelain teacup with an arched bridge crossing over tea with swimming koi fish"
    }
  },
  {
    "id": "cg-p053",
    "src": "/images/cipher-grid/pictures-minimal/cg-p053.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p053-thumb.webp",
    "alt": {
      "th": "รองเท้าสเก็ตน้ำแข็งที่ใบมีดสเก็ตเป็นหัวปากกาหมึกซึมกำลังเขียนตัวอักษรลงบนน้ำแข็ง",
      "en": "An ice skate with a fountain pen nib for a blade writing script on ice"
    }
  },
  {
    "id": "cg-p054",
    "src": "/images/cipher-grid/pictures-minimal/cg-p054.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p054-thumb.webp",
    "alt": {
      "th": "ตะเกียงไฟโบราณที่ห้อยติดอยู่กับหางเพลิงของดาวตกบนท้องฟ้า",
      "en": "An antique lantern hanging from the tail of a flying shooting star"
    }
  },
  {
    "id": "cg-p055",
    "src": "/images/cipher-grid/pictures-minimal/cg-p055.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p055-thumb.webp",
    "alt": {
      "th": "นาฬิกาพกกลไกโบราณที่กางฝาออกกลายเป็นแมลงปีกแข็งพร้อมปีกเฟืองนาฬิกา",
      "en": "A mechanical pocket watch unfolding into a clockwork scarab beetle with gear wings"
    }
  },
  {
    "id": "cg-p056",
    "src": "/images/cipher-grid/pictures-minimal/cg-p056.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p056-thumb.webp",
    "alt": {
      "th": "เรือพายไม้ลอยน้ำที่ด้านในตัวเรือเป็นชั้นวางหนังสือและคัมภีร์โบราณ",
      "en": "A wooden rowboat floating on water with bookshelves and scrolls lining its interior"
    }
  },
  {
    "id": "cg-p057",
    "src": "/images/cipher-grid/pictures-minimal/cg-p057.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p057-thumb.webp",
    "alt": {
      "th": "เสาไฟถนนโบราณที่ส่องสว่างใต้ทะเลและมีฝูงปลากำลังว่ายวนเวียน",
      "en": "A Victorian streetlamp under the sea with a school of fish swimming around its light"
    }
  },
  {
    "id": "cg-p058",
    "src": "/images/cipher-grid/pictures-minimal/cg-p058.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p058-thumb.webp",
    "alt": {
      "th": "ลูกแก้วหิมะที่มีเรือใบสามเสาแล่นอยู่ท่ามกลางน้ำวนหมุนวน",
      "en": "A glass snowglobe containing a miniature sailing ship caught in a gentle water whirlpool"
    }
  },
  {
    "id": "cg-p059",
    "src": "/images/cipher-grid/pictures-minimal/cg-p059.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p059-thumb.webp",
    "alt": {
      "th": "ชุดเกราะซามูไรโบราณนั่งสมาธิที่มีกิ่งและกลีบดอกซากุระผลิบานพันรอบเกราะ",
      "en": "A suit of samurai armor sitting peacefully overgrown with cherry blossom branches"
    }
  },
  {
    "id": "cg-p060",
    "src": "/images/cipher-grid/pictures-minimal/cg-p060.webp",
    "thumbnail": "/images/cipher-grid/pictures-minimal/cg-p060-thumb.webp",
    "alt": {
      "th": "หนังสือปกแข็งเล่มใหญ่ที่สันหนังสือเป็นต้นไม้ใหญ่โบราณแผ่รากลึกลงบนหน้ากระดาษ",
      "en": "An open book whose spine is an ancient tree trunk with roots growing into the pages"
    }
  }
] as const satisfies readonly CipherGridPicture[];

/** Main primary set is the 60 minimal line art pictures. */
export const CIPHER_GRID_PICTURES = CIPHER_GRID_PICTURES_MINIMAL;

export const CIPHER_GRID_PICTURE_PACKS: Record<
  CipherGridPicturePack,
  readonly CipherGridPicture[]
> = {
  CLASSIC: CIPHER_GRID_PICTURES_CLASSIC,
  MINIMAL: CIPHER_GRID_PICTURES_MINIMAL,
};

export function getCipherGridPicture(
  id: string,
  pack: CipherGridPicturePack = 'MINIMAL',
): CipherGridPicture | undefined {
  const catalog = CIPHER_GRID_PICTURE_PACKS[pack] ?? CIPHER_GRID_PICTURES;
  return catalog.find((picture) => picture.id === id);
}
