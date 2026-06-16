# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lobby.spec.ts >> Lobby Page >> shows name input field
- Location: e2e/lobby.spec.ts:10:7

# Error details

```
Error: apiRequestContext._wrapApiCall: file data stream has unexpected number of bytes
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
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
      - img "KZ Game Hub Logo" [ref=e17]
      - heading "GAME LOBBY" [level=1] [ref=e18]
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: ชื่อที่แสดง
          - textbox "ชื่อที่แสดง" [ref=e22]:
            - /placeholder: กรอกชื่อของคุณ
        - generic [ref=e23]:
          - button "🕵️ Who Know!" [disabled] [ref=e24]:
            - generic [ref=e25]: 🕵️
            - generic [ref=e26]: Who Know!
          - button "🐟 Sounds Fishy" [disabled] [ref=e27]:
            - generic [ref=e28]: 🐟
            - generic [ref=e29]: Sounds Fishy
        - generic [ref=e30]:
          - button "❌⭕️ ❌⭕️ ❌⭕️ Gobbler Tic Tac Toe" [disabled] [ref=e31]:
            - generic [ref=e32]:
              - generic [ref=e33]: ❌⭕️
              - generic [ref=e34]: ❌⭕️
              - generic [ref=e35]: ❌⭕️
            - generic [ref=e36]: Gobbler Tic Tac Toe
          - button "❌⭕️ Classic Tic Tac Toe" [disabled] [ref=e37]:
            - generic [ref=e38]: ❌⭕️
            - generic [ref=e39]: Classic Tic Tac Toe
        - generic [ref=e40]:
          - button "✌️✊✋ Hand Duel" [disabled] [ref=e41]:
            - generic [ref=e42]: ✌️✊✋
            - generic [ref=e43]: Hand Duel
          - button "🔍 Detective Club" [disabled] [ref=e44]:
            - generic [ref=e45]: 🔍
            - generic [ref=e46]: Detective Club
        - generic [ref=e47]:
          - button "🤔❓ Who Am I" [disabled] [ref=e48]:
            - generic [ref=e49]: 🤔❓
            - generic [ref=e50]: Who Am I
          - button "🛎️ Who First" [disabled] [ref=e51]:
            - generic [ref=e52]: 🛎️
            - generic [ref=e53]: Who First
        - generic [ref=e56]: หรือ
        - generic [ref=e58]:
          - textbox "รหัสห้อง" [ref=e59]
          - button "เข้าร่วม" [disabled] [ref=e60]
  - alert [ref=e61]
```