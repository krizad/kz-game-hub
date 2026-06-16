# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: room.spec.ts >> Room Creation & Join Flow >> join with room code via URL param
- Location: e2e/room.spec.ts:31:7

# Error details

```
Error: apiRequestContext._wrapApiCall: file data stream has unexpected number of bytes
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e4]:
      - button "EN" [ref=e5] [cursor=pointer]
      - button "TH" [ref=e6] [cursor=pointer]
    - generic [ref=e7]:
      - button "🏆 Leaderboard" [ref=e8] [cursor=pointer]:
        - text: 🏆
        - generic [ref=e9]: Leaderboard
      - button "กฎกติกา" [ref=e10] [cursor=pointer]:
        - img [ref=e11]
        - generic [ref=e14]: กฎกติกา
    - generic [ref=e15]:
      - img "KZ Game Hub Logo" [ref=e18]
      - heading "คุณได้รับคำเชิญ!" [level=1] [ref=e19]
      - paragraph [ref=e20]: เข้าร่วมห้อง ABC123
      - generic [ref=e21]:
        - generic [ref=e22]:
          - generic [ref=e23]: ชื่อที่แสดง
          - textbox "ชื่อที่แสดง" [active] [ref=e24]:
            - /placeholder: กรอกชื่อของคุณเพื่อเริ่มเล่น
            - text: Joiner
        - button "เข้าสู่เกม" [ref=e25] [cursor=pointer]
        - button "กลับหน้าหลัก" [ref=e26] [cursor=pointer]
  - alert [ref=e27]
```