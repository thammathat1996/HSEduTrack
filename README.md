# HSEduTrack

เว็บตรวจสอบคะแนนนักเรียน เผยแพร่ด้วย GitHub Pages จาก `index.html` และโฟลเดอร์ `sprites/` ข้อมูลคะแนนอยู่ใน Google Sheet ผ่าน Google Apps Script

## ไฟล์ที่เผยแพร่

- `index.html` — หน้าเว็บสำหรับครูและนักเรียน
- `sprites/`, `sprites_db.js`, `sprites_db.json` — รูปและข้อมูลตัวละคร
- `.gitignore` — กำหนดไฟล์สำรองและไฟล์ความลับที่ไม่ควรส่งขึ้น Git

Repository นี้เผยแพร่เฉพาะไฟล์หน้าเว็บ ไม่มีไฟล์คะแนนนักเรียนที่ส่งออก ไฟล์สำรอง หรือโค้ดฝั่งเซิร์ฟเวอร์

## GitHub Pages

ใน Settings → Pages เลือก Deploy from a branch แล้วตั้ง `main` กับ `/(root)` เว็บไซต์จะเปิดที่ `https://thammathat1996.github.io/HSEduTrack/`

ข้อมูลคะแนนยังเชื่อมกับ Google Sheet เดิม การเข้าเว็บจากอุปกรณ์หลายเครื่องจะอ่านฐานข้อมูลเดียวกัน
