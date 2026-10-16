# Image Generator (Flux Schnell / ComfyUI)

เครื่องมือสำหรับ Generate รูปภาพผ่าน ComfyUI API โดยใช้โมเดล **Flux.1 Schnell (FP8)** จาก workflow [`flux-workflow.json`](./flux-workflow.json)

**Default Endpoint:** `https://duck-rather-mature-plus.trycloudflare.com`

---

## 🚀 วิธีใช้งานด่วน (Quick Start)

### 1. สร้างภาพทั่วไป (Text-to-Image)

```bash
# Generate ด้วย prompt เริ่มต้นใน workflow
pnpm gen:image

# กำหนด prompt ที่ต้องการ
pnpm gen:image -p "A futuristic Thai night market in year 2080, cyberpunk style, neon lights"

# กำหนดขนาดภาพและ Seed
pnpm gen:image -p "Fantasy potion bottle, glowing liquid, game asset icon" -w 512 -H 512 -s 12345
```

---

### 2. สร้างการ์ดเกม Dog Relay (โดยส่ง Base Image ไปเป็น Reference) 🐶

ระบบจะอัปโหลดรูป `dog-base.png` ขึ้น ComfyUI โดยอัตโนมัติ และสลับไปใช้ workflow [`flux-img2img-workflow.json`](./flux-img2img-workflow.json) เพื่อคงใบหน้า ท่าทาง และสัดส่วนเดิมของน้องหมาไว้ แล้วเพิ่มชุด/อุปกรณ์ตามบทบาทการ์ด:

```bash
# 1. ดูรายชื่อการ์ด Dog Relay ทั้งหมด 30 ใบ
pnpm gen:image --list-cards

# 2. สร้างการ์ด Doctor Dog (#003 หมาหมอ) จาก base image
pnpm gen:image --card dog-003 --base --denoise 0.88

# 3. สร้างการ์ด Chef Dog (#002 หมาพ่อครัว)
pnpm gen:image --card chef --base --denoise 0.88

# 4. ใช้ base image อื่นที่ต้องการ
pnpm gen:image -p "Wearing cyberpunk tactical jacket with neon LED strips" -i ./my_photo.png --denoise 0.65
```

---

### 3. ใช้งานผ่าน Python (Zero-dependency)

รองรับ Python 3 (ใช้เฉพาะ Standard Library ไม่ต้องลง library เพิ่ม):

```bash
python3 scripts/gen-image/generate.py -p "A mystical ancient temple ruins, cinematic lighting"
```

---

## ⚙️ Options / พารามิเตอร์ทั้งหมด

| ธง (Flag)                      | คำอธิบาย                                                                                 | ค่าเริ่มต้น (Default)                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `-p`, `--prompt <text>`        | Prompt คำสั่งสร้างภาพ                                                                    | Prompt ใน workflow                                                   |
| `-n`, `--negative <text>`      | Negative Prompt                                                                          | `""`                                                                 |
| `-c`, `--card <id\|num\|name>` | ระบุการ์ด Dog Relay (เช่น `dog-001`, `1`, `chef`, `หมาหมอ`)                              | -                                                                    |
| `--list-cards`                 | แสดงรายชื่อการ์ด Dog Relay ทั้งหมด 30 ใบ                                                 | -                                                                    |
| `-i`, `--image <path>`         | Path รูปภาพต้นฉบับสำหรับ Image-to-Image (img2img)                                        | -                                                                    |
| `--base`                       | ใช้น้องหมาต้นฉบับ `dog-base.png` ของ Dog Relay เป็น reference                            | `false`                                                              |
| `--denoise <0.0-1.0>`          | ความแรงในการเปลี่ยนรายละเอียด (0.65 = ใกล้เคียงเดิมมาก, 0.85-0.88 = เติมชุดและพร็อพใหม่) | `0.65` / `0.85`                                                      |
| `-w`, `--width <px>`           | ความกว้างของรูป (ใช้เฉพาะ text2img)                                                      | `1024`                                                               |
| `-H`, `--height <px>`          | ความสูงของรูป (ใช้เฉพาะ text2img)                                                        | `1024`                                                               |
| `--steps <count>`              | จำนวน inference steps                                                                    | `4` (เหมาะสมสำหรับ Flux Schnell)                                     |
| `--cfg <scale>`                | CFG scale                                                                                | `1.0`                                                                |
| `-s`, `--seed <number>`        | เลข Seed สำหรับสุ่มภาพ                                                                   | สุ่มอัตโนมัติ (Random)                                               |
| `-u`, `--url <url>`            | URL ของ ComfyUI Server                                                                   | `https://duck-rather-mature-plus.trycloudflare.com`                  |
| `-o`, `--output <path>`        | โฟลเดอร์หรือชื่อไฟล์สำหรับบันทึก                                                         | `scripts/gen-image/output/`                                          |
| `--workflow <path>`            | Path ไปยังไฟล์ workflow JSON                                                             | `flux-workflow.json` (หรือ `flux-img2img-workflow.json` เมื่อใช้ภาพ) |
| `--no-meta`                    | ปิดการบันทึกไฟล์คู่ `.json` metadata                                                     | บันทึกเสมอ                                                           |
| `-h`, `--help`                 | ดูคู่มือและคำอธิบาย                                                                      | -                                                                    |

---

## 🌐 การเปลี่ยน Endpoint URL

สามารถระบุผ่าน Argument `-u`:

```bash
pnpm gen:image -u "https://your-comfyui-domain.trycloudflare.com" -p "cyberpunk city"
```

หรือตั้งค่า Environment Variable `COMFYUI_URL`:

```bash
export COMFYUI_URL="https://your-comfyui-domain.trycloudflare.com"
pnpm gen:image -p "cyberpunk city"
```

---

## 📁 ไฟล์ผลลัพธ์ (Output)

- รูปภาพจะถูกบันทึกไว้ที่ `scripts/gen-image/output/` โดยอัตโนมัติ (และโฟลเดอร์นี้อยู่ใน `.gitignore`)
- รูปแต่ละรูปจะมีไฟล์ `.json` แนบมาด้วยเสมอ ซึ่งจะบันทึก:
  - วันเวลาที่สร้าง (`generatedAt`)
  - Prompt และ Negative Prompt ที่ใช้
  - Seed, Steps, CFG, Width, Height
  - Prompt ID บน ComfyUI
  - Endpoint URL ที่ใช้
