# การทดสอบ E2E ด้วยฐานบนเครื่อง

E2E เล่นเกมจนจบอาจบันทึก GameResult และแก้ query_count. Config ทั้งสามชุดจึงต้องมี `TEST_DATABASE_URL` ชัดเจน; ไม่อ่านฐานจาก root `.env` แทน. URL ต้องเป็น MySQL/MariaDB ที่ localhost/127.0.0.1/::1, ชื่อฐานมี `_test`/`-test` หรือชื่อ `test`, ไม่มี query/hash override. Config ปฏิเสธก่อนเริ่ม servers ถ้าค่าไม่ผ่าน.

ตัวอย่างสร้าง MySQL ชั่วคราวสำหรับ tests เท่านั้น:

```bash
docker run --name kz-game-hub-e2e-local --rm -d \
  -p 127.0.0.1:13306:3306 \
  --tmpfs /var/lib/mysql:rw,size=768m --tmpfs /tmp:rw,size=128m \
  -e MYSQL_ROOT_PASSWORD=local-test-root \
  -e MYSQL_DATABASE=kz_game_hub_test \
  -e MYSQL_USER=test -e MYSQL_PASSWORD=test mysql:8.0
docker exec kz-game-hub-e2e-local mysqladmin ping -h 127.0.0.1 -uroot -plocal-test-root
```

รอฐานพร้อม แล้วเตรียม packages/schema/seed ด้วย runner:

```bash
TEST_DATABASE_URL='mysql://test:test@127.0.0.1:13306/kz_game_hub_test' \
  node scripts/test-isolated.mjs --prepare --list
TEST_DATABASE_URL='mysql://test:test@127.0.0.1:13306/kz_game_hub_test' \
  node scripts/test-isolated.mjs urgent-fixes.spec.ts --workers=2
```

`--prepare` ทำ build types→database→db:push→db:seed→E2E artist fixture หลังตรวจ URL แล้ว. Fixture ใช้ id `e2e-artist`, catalog จำลอง 5 เพลงระดับ Easy; ไม่เรียก provider. การเลือก tests ที่ว่างต้อง exit nonzero; runner ไม่อนุญาต `--pass-with-no-tests`.

Configs ใช้ Web3100/API3101 และไม่ reuse server ที่เปิดอยู่. หยุด test servers ของชุดก่อนหน้าให้เรียบร้อยก่อนรันใหม่; `pnpm dev` ใน directory เดียวกันอาจชน `.next` และ dev watcher จึงควรหยุดก่อน E2E. เมื่อยกเลิก runner จะส่ง signal ไป child process group ของตัวเอง.

ฐาน tmpfs หายเมื่อ container หยุด. เมื่อเสร็จให้หยุดเฉพาะ container ที่สร้างสำหรับงานนี้:

```bash
docker stop kz-game-hub-e2e-local
```

Nightly/manual CI ใช้ MySQL service `kz_game_hub_test` และ fixture เดียวกัน. การตรวจ workflow บนเครื่องไม่ถือว่า GitHub run ผ่านแล้ว.

Demo suite (`apps/web/e2e/demo.spec.ts` — อัดวีดีโอ demo ครบ 20 เกมลง `apps/web/public/demo/`) ใช้ config หลัก (Web3100/API3101) จึงอยู่ภายใต้สัญญา `TEST_DATABASE_URL` เดียวกัน และต้องมี `ffmpeg` ในเครื่องสำหรับต่อวีดีโอ: `TEST_DATABASE_URL=... pnpm -F web exec playwright test demo`.
