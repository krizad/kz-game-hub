# Banana Thief — Role Card Artwork Prompts

การ์ดบทบาททั้ง 7 ใบสำหรับเกม **ลิงขโมยกล้วย (Banana Thief)** · ชุดภาพ v2 ได้รับการปรับปรุงพร้อม prompt ที่ผ่านการทดสอบจริงแล้ว เพื่อให้ลายเส้น, กรอบการ์ด, พระจันทร์เสี้ยว และแถบชื่อล่างมีความเป็นหนึ่งเดียวกัน 100%

**ปัญหาที่แก้ไขจากชุดแรก (v1):**

1. **กรอบการ์ด & ขอบสติกเกอร์**: ลิงทุกตัวมีขอบไดคัตขาวหนา (white die-cut sticker outline) รอบตัวละครเหมือนกันทุกใบ ลอยเด่นเหนือพื้นหลังท้องฟ้า
2. **พระจันทร์**: บังคับเป็นพระจันทร์เสี้ยวสีเหลืองนวล (pale-yellow crescent moon) มุมขวาบนทุกใบ (แก้ไขใบแกะดำและลิงแฝดที่เดิมเคยเป็นพระจันทร์เต็มดวง)
3. **เครื่องแต่งกาย**: ลิงทุกตัวเป็นลิงธรรมชาติ ขนสีน้ำตาล ครีม ชมพู ไม่ใส่เสื้อผ้า (แก้ไขลิงแฝดที่เดิมใส่เสื้อแดงกางเกงยีนส์) ยกเว้นพร็อพประจำบทบาท เช่น หน้ากากโจร / หมวกนักสืบ / หน้ากากละคร
4. **แถบชื่อด้านล่าง**: แถบสี่เหลี่ยมผืนผ้าสีทึบเรียบเสมอขอบ ไม่มีกรอบซ้อน ไม่มีริบบิ้น ไม่มีตัวอักษรใดๆ รองรับการ overlay ฟอนต์ชื่อบทบาทจาก `RoleArtwork.tsx`

---

## ตารางสถานะไฟล์ภาพ (Status)

| บทบาท                       | ไฟล์รูปจริง     | สีแถบ Banner (Hex)  | สถานะปัจจุบัน     | สำรองไฟล์เดิม             |
| --------------------------- | --------------- | ------------------- | ----------------- | ------------------------- |
| ลิงขโมยกล้วย (Banana Thief) | `thief.png`     | แดง `#EF4444`       | v2 Active         | `backup_v1/thief.png`     |
| ลิงขี้เซา (Sleepy Monkey)   | `mouse.png`     | เทาชนวน `#64748B`   | v2 Active         | `backup_v1/mouse.png`     |
| สมุนโจร (Follower)          | `follower.png`  | ม่วง `#A855F7`      | v2 Active         | `backup_v1/follower.png`  |
| นักสืบ (DLC)                | `detective.png` | ฟ้าสว่าง `#06B6D4`  | v2 Active         | `backup_v1/detective.png` |
| แกะดำ (DLC)                 | `sycophant.png` | ส้มอำพัน `#F59E0B`  | v2 Active         | `backup_v1/sycophant.png` |
| ลิงแฝด (DLC)                | `twins.png`     | ชมพู `#EC4899`      | v2 Active         | `backup_v1/twins.png`     |
| แพะรับบาป (DLC)             | `goat.png`      | เขียวมรกต `#10B981` | Prompt พร้อมสร้าง | `backup_v1/goat.png`      |

> หมายเหตุ: ชื่อไฟล์ `mouse.png` / `mouse.svg` เป็นชื่อ internal ตามโครงสร้างโค้ดเดิม ไม่ต้องเปลี่ยนชื่อเพื่อความเข้ากันได้ของ `RoleArtwork.tsx`

---

## Master Style Guide & Formula (สูตร Prompt มาตรฐาน)

ใช้โครงสร้างนี้เพื่อให้ทุกใบมีทิศทางศิลปะเดียวกัน:

```
Board game role card, flat vector sticker neo-brutalism style, bold clean black outlines, bold flat colors, no gradients. [CHARACTER DESCRIPTION]. The monkey has warm brown fur, cream face patch and belly, round ears with pink inside [PROPS]. Crisp white die-cut sticker outline around the monkey character [AND PROPS]. Dark navy night sky background (#0F172A) with a pale yellow crescent moon in the top right corner and tiny 4-point golden stars. Dark ground silhouette at the bottom third. Across the bottom edge is a solid flat [COLOR_NAME] rectangular banner ([HEX]) with no text, no words, no letters. Single thick rounded card border.
```

**Negative Prompt (สำหรับทุก Generator):**

```
text, letters, words, typography, watermark, signature, gradient, soft shading, photorealistic, realistic fur, 3d render, blurry edges, extra limbs, extra arms, human clothing, double frame, ribbon banner, full moon
```

**สเปกทางเทคนิค:**

- **Aspect Ratio:** `3:4` หรือ `5:7` (แนะนำ 896×1200 หรือ 1024×1434)
- **Palette หลัก:**
  - ขนลิง: น้ำตาลอบอุ่น `#A16207`
  - ใบหน้าและหน้าท้อง: ครีมสว่าง `#FDE68A`
  - ด้านในหู: ชมพูอ่อน `#F9A8D4`
  - กล้วย: เหลืองสด `#FBBF24`
  - ท้องฟ้ายามค่ำคืน: กรมท่าน้ำเงินเข้ม `#0F172A`
  - พระจันทร์เสี้ยวและดวงดาว: เหลืองนวลสว่าง

---

## Prompts รายใบ (Tested & Production-Ready)

### 1. ลิงขโมยกล้วย — `thief.png` (Banner: สีแดง #EF4444)

> **Natural / Gemini / Imagen:**
> Board game role card, flat vector sticker neo-brutalism style, bold clean black outlines, bold flat colors, no gradients. A sneaky chibi cartoon monkey wearing a black bandit robber mask, tiptoeing mischievously while carrying a huge bunch of bright yellow bananas on its back. The monkey has warm brown fur, cream face patch, round ears with pink inside. Crisp white die-cut sticker outline around the monkey character. Dark navy night sky background (#0F172A) with a pale yellow crescent moon in the top right corner and tiny 4-point golden stars. Dark ground silhouette at the bottom third. Across the bottom edge is a solid flat red rectangular banner (#EF4444) with no text, no words, no letters. Single thick rounded card border.

```
board game role card, sneaky chibi cartoon monkey wearing a black bandit robber mask, tiptoeing mischievously, carrying a huge bunch of yellow bananas on its back, warm brown fur, cream face, pink inner ears, crisp white die-cut sticker outline around monkey and bananas, flat vector sticker style, neo-brutalism, bold black outlines, bold flat colors, no gradients, dark navy night sky #0F172A, pale yellow crescent moon top right, tiny golden stars, dark ground silhouette, solid flat red banner across bottom edge, no text, no letters --ar 3:4 --v 6 --style raw
```

---

### 2. ลิงขี้เซา — `mouse.png` (Banner: เทาชนวน #64748B)

> **Natural / Gemini / Imagen:**
> Board game role card, flat vector sticker neo-brutalism style, bold clean black outlines, bold flat colors, no gradients. A sleepy chibi cartoon monkey curled up happily sleeping on a soft blue pillow, hugging a ripe yellow banana, closed eyes with a peaceful sweet smile, tiny cute floating Zzz letters near head. The monkey has warm brown fur, cream face patch and belly, round ears with pink inside. Crisp white die-cut sticker outline around the monkey and pillow. Dark navy night sky background (#0F172A) with a pale yellow crescent moon in the top right corner and tiny 4-point golden stars. Dark ground silhouette at the bottom third. Across the bottom edge is a solid flat slate-gray rectangular banner (#64748B) with no text, no words, no letters. Single thick rounded card border.

```
board game role card, sleepy chibi cartoon monkey curled up sleeping on a soft blue pillow, hugging a yellow banana, peaceful smile, closed eyes, tiny floating Zzz, warm brown fur, cream face, pink inner ears, crisp white die-cut sticker outline around monkey and pillow, flat vector sticker style, neo-brutalism, bold black outlines, bold flat colors, no gradients, dark navy night sky #0F172A, pale yellow crescent moon top right, tiny golden stars, dark ground silhouette, solid flat slate gray banner across bottom edge, no text, no letters --ar 3:4 --v 6 --style raw
```

---

### 3. สมุนโจร — `follower.png` (Banner: สีม่วง #A855F7)

> **Natural / Gemini / Imagen:**
> Board game role card, flat vector sticker neo-brutalism style, bold clean black outlines, bold flat colors, no gradients. Two sneaky chibi cartoon monkeys standing close together, one larger monkey whispering into the other smaller monkey's ear, a small white speech bubble with three dots "..." between them, sneaky conspiratorial expressions. Both monkeys have warm brown fur, cream face patch and belly, round ears with pink inside, no human clothes. Crisp white die-cut sticker outline around both monkey characters. Dark navy night sky background (#0F172A) with a pale yellow crescent moon in the top right corner and tiny 4-point golden stars. Dark ground silhouette at the bottom third. Across the bottom edge is a solid flat purple rectangular banner (#A855F7) with no text, no words, no letters. Single thick rounded card border.

```
board game role card, two sneaky chibi cartoon monkeys standing close together, one whispering into the other's ear, small white speech bubble with three dots, sneaky expressions, warm brown fur, cream face, pink inner ears, no clothes, crisp white die-cut sticker outline around monkeys, flat vector sticker style, neo-brutalism, bold black outlines, bold flat colors, no gradients, dark navy night sky #0F172A, pale yellow crescent moon top right, tiny golden stars, dark ground silhouette, solid flat purple banner across bottom edge, no text, no letters --ar 3:4 --v 6 --style raw
```

---

### 4. นักสืบ — `detective.png` (Banner: ฟ้าสว่าง #06B6D4, DLC)

> **Natural / Gemini / Imagen:**
> Board game role card, flat vector sticker neo-brutalism style, bold clean black outlines, bold flat colors, no gradients. A clever chibi cartoon monkey detective wearing a cyan deerstalker hat and a small dark cyan detective cape collar, holding a large round magnifying glass up to one eye, confident sly smirk. The monkey has warm brown fur, cream face patch and belly, round ears with pink inside. Crisp white die-cut sticker outline around the monkey character. Dark navy night sky background (#0F172A) with a pale yellow crescent moon in the top right corner and tiny 4-point golden stars. Dark ground silhouette at the bottom third. Across the bottom edge is a solid flat cyan rectangular banner (#06B6D4) with no text, no words, no letters. Single thick rounded card border.

```
board game role card, clever chibi cartoon monkey detective wearing cyan deerstalker hat and cape collar, holding a large magnifying glass to one eye, confident smirk, warm brown fur, cream face, pink inner ears, crisp white die-cut sticker outline around monkey, flat vector sticker style, neo-brutalism, bold black outlines, bold flat colors, no gradients, dark navy night sky #0F172A, pale yellow crescent moon top right, tiny golden stars, dark ground silhouette, solid flat cyan banner across bottom edge, no text, no letters --ar 3:4 --v 6 --style raw
```

---

### 5. แกะดำ — `sycophant.png` (Banner: ส้มอำพัน #F59E0B, DLC)

> **Natural / Gemini / Imagen:**
> Board game role card, flat vector sticker neo-brutalism style, bold clean black outlines, bold flat colors, no gradients. A cheeky chibi cartoon monkey holding a smiling golden theater comedy mask in front of its face, peeking out from behind the mask with one suspicious cunning eye, small floating question marks "?" beside its head. The monkey has warm brown fur, cream face patch and belly, round ears with pink inside, no clothes. Crisp white die-cut sticker outline around the monkey character and golden mask. Dark navy night sky background (#0F172A) with a pale yellow crescent moon in the top right corner (crescent moon only, not full moon) and tiny 4-point golden stars. Dark ground silhouette at the bottom third. Across the bottom edge is a solid flat amber-orange rectangular banner (#F59E0B) with no text, no words, no letters. Single thick rounded card border.

```
board game role card, cheeky chibi cartoon monkey holding a smiling golden theater comedy mask, peeking with one suspicious cunning eye, small floating question marks, warm brown fur, cream face, pink inner ears, no clothes, crisp white die-cut sticker outline around monkey and mask, flat vector sticker style, neo-brutalism, bold black outlines, bold flat colors, no gradients, dark navy night sky #0F172A, pale yellow crescent moon top right, tiny golden stars, dark ground silhouette, solid flat amber orange banner across bottom edge, no text, no letters --ar 3:4 --v 6 --style raw
```

---

### 6. ลิงแฝด — `twins.png` (Banner: ชมพู #EC4899, DLC)

> **Natural / Gemini / Imagen:**
> Board game role card, flat vector sticker neo-brutalism style, bold clean black outlines, bold flat colors, no gradients. Two identical cute chibi cartoon twin monkeys standing side by side with arms cheerfully linked, matching joyful smiles, a small glowing red heart floating above between them. Both monkeys have warm brown fur, cream face patch and belly, round ears with pink inside, no clothes, no shirts, no pants. Crisp white die-cut sticker outline around the twin monkeys. Dark navy night sky background (#0F172A) with a pale yellow crescent moon in the top right corner (crescent moon only, not full moon) and tiny 4-point golden stars. Dark ground silhouette at the bottom third. Across the bottom edge is a solid flat pink rectangular banner (#EC4899) with no text, no words, no letters. Single thick rounded card border.

```
board game role card, two identical chibi cartoon twin monkeys standing side by side with arms cheerfully linked, matching joyful smiles, small glowing red heart floating between them, warm brown fur, cream face, pink inner ears, no clothes, no shirts, crisp white die-cut sticker outline around twin monkeys, flat vector sticker style, neo-brutalism, bold black outlines, bold flat colors, no gradients, dark navy night sky #0F172A, pale yellow crescent moon top right, tiny golden stars, dark ground silhouette, solid flat pink banner across bottom edge, no text, no letters --ar 3:4 --v 6 --style raw
```

---

### 7. แพะรับบาป — `goat.png` (Banner: เขียวมรกต #10B981, DLC)

> **Natural / Gemini / Imagen:**
> Board game role card, flat vector sticker neo-brutalism style, bold clean black outlines, bold flat colors, no gradients. A cheerful innocent chibi cartoon monkey gleefully stepping into an open golden cage with a bunch of yellow bananas inside, arms wide open happily welcoming capture, a bright green target crosshair symbol floating above its head, joyful carefree smile. The monkey has warm brown fur, cream face patch and belly, round ears with pink inside, no clothes. Crisp white die-cut sticker outline around the monkey and the cage. Dark navy night sky background (#0F172A) with a pale yellow crescent moon in the top right corner and tiny 4-point golden stars. Dark ground silhouette at the bottom third. Across the bottom edge is a solid flat emerald-green rectangular banner (#10B981) with no text, no words, no letters. Single thick rounded card border.

```
board game role card, cheerful innocent chibi cartoon monkey stepping into an open golden cage with bananas inside, arms wide open welcoming capture, bright green target crosshair floating above head, joyful smile, warm brown fur, cream face, pink inner ears, no clothes, crisp white die-cut sticker outline around monkey and cage, flat vector sticker style, neo-brutalism, bold black outlines, bold flat colors, no gradients, dark navy night sky #0F172A, pale yellow crescent moon top right, tiny golden stars, dark ground silhouette, solid flat emerald green banner across bottom edge, no text, no letters --ar 3:4 --v 6 --style raw
```

---

## เช็กลิสต์การตรวจสอบ (Quality Checklist)

- [x] **กรอบการ์ดเหมือนกันทุกใบ**: กรอบดำหนาโค้งมน + ขอบสติกเกอร์ขาวคมชัดรอบตัวละคร (Die-cut sticker outline)
- [x] **พระจันทร์เสี้ยว (Crescent Moon)**: มุมขวาบน เป็นพระจันทร์เสี้ยวสีเหลืองนวลทุกลำดับภาพ ไม่มีพระจันทร์เต็มดวงหลุดมา
- [x] **แถบชื่อด้านล่างว่างเปล่า**: เป็นสี่เหลี่ยมสีทึบเรียบตรงกับโค้ดสีบทบาท ไม่มีตัวอักษรหรือกรอบในซ้อน เพื่อให้ `RoleArtwork.tsx` แสดงผลชื่อสองภาษาทับได้อย่างแม่นยำ
- [x] **ตัวละครลิงคงเส้นคงวา**: ตัวลิงขนสีน้ำตาล #A16207 + ใบหน้า/ท้องครีม #FDE68A + หูด้านในชมพู #F9A8D4
- [x] **ไม่มีเสื้อผ้ามนุษย์ที่ไม่เข้าพวก**: แก้ไขลิงแฝดเป็นลิงน่ารักธรรมชาติ
- [x] **อัตราส่วนสม่ำเสมอ**: 3:4 (896×1200) สัดส่วนการ์ดบอร์ดเกมสากล คมชัดสูงบนทุกหน้าจอ
- [x] **ไฟล์ต้นฉบับสำรองไว้แล้ว**: บันทึกสำรองภาพ v1 ไว้ที่ `apps/web/public/images/banana-thief/backup_v1/`
