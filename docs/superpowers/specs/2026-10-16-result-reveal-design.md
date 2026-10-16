# จังหวะเฉลยท้ายเกม

Approved in chat on 2026-10-16.

Replace the abrupt transition into results with a shared, server-timed reveal before each game's existing detailed summary. Keep the existing warm, bold board-game styling, Thai/English copy, responsive layout and reduced-motion support.

Social deduction games reveal participants in seat order, with an optional button for the current participant to reveal themselves. A timeout advances automatically so absent players cannot stall the room. Reveal votes/answers alongside each participant before announcing the winning side. Card games show only publicly revealed hands; Poker retains its existing show/muck choice before the presentation. Word, music and reflex games reveal answers or performance before the score summary. Tic-tac-toe keeps a short final-board beat; The Mind preserves its existing level replay and adds a short match ending.

The server owns the presentation ID, stable participant IDs, timestamps and host skip action. Reconnection resumes the same timeline. Repeated broadcasts never restart it; the next round clears it. The presentation never reads unrevealed private information. Existing detailed results remain available after the sequence, until the host starts again.

Validation covers result detection for all games/modes, owner/host permissions, stale requests, reconnection, timing boundaries, and browser checks for pacing, hidden winners and synchronized skip. No database schema or production data changes are needed.
