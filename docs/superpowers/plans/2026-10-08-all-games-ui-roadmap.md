# KZ Game Hub: All Games UI Roadmap

This index coordinates the separate game plans below. The first shared pass is already in the working tree: game catalog cards now show genre, player count, and a short description in Thai and English, and the shared in-game status header displays phase, active turn, and public progress where supported.

## Recommended implementation order

1. [Shared play-surface polish](2026-10-08-shared-game-ui.md): refine the common status header, responsive spacing, focus states, and motion rules.
2. [Tic-Tac-Toe modes](2026-10-08-tic-tac-toe-ui.md): Classic, Gobbler, and Ultimate.
3. [Hand Duel](2026-10-08-rps-ui.md) and [Who First](2026-10-08-who-first-ui.md): short competitive games that establish feedback and result patterns.
4. [Who Know](2026-10-08-who-know-ui.md), [Sounds Fishy](2026-10-08-sounds-fishy-ui.md), [Detective Club](2026-10-08-detective-club-ui.md), and [Who Am I](2026-10-08-who-am-i-ui.md): social deduction and guessing.
5. [Banana Thief](2026-10-08-banana-thief-ui.md) and [Coup](2026-10-08-coup-ui.md): hidden roles and multi-step decisions.
6. [The Mind](2026-10-08-the-mind-ui.md) and [Saboteur](2026-10-08-saboteur-ui.md): cooperative board and card play.
7. [Music Trivia](2026-10-08-music-trivia-ui.md) and [Thai Card Game](2026-10-08-thai-card-game-ui.md): media and card table treatments.

The sequence is a recommendation, not a dependency chain. Each game plan is independently deliverable after the shared play-surface plan.

## Shared completion bar

- Players can identify the current phase, whose turn it is, and their next available action without opening the rules modal.
- Thai and English text fit at narrow mobile widths and do not rely on color alone to communicate state.
- Turn, selection, reveal, and result changes have clear visual feedback; motion respects reduced-motion preferences.
- Private roles, words, hands, and unrevealed choices remain private in the UI and existing server payloads.
- Existing game-flow E2E coverage for the affected game passes, with a targeted assertion added when the improved affordance is not covered.
- No game mechanic, scoring rule, socket event, or room-state field changes as part of a UI-only plan.

## Plans

- [Shared play-surface polish](2026-10-08-shared-game-ui.md)
- [Knowguise (Who Know)](2026-10-08-who-know-ui.md)
- [Tic-Tac-Toe: Classic, Gobbler, Ultimate](2026-10-08-tic-tac-toe-ui.md)
- [Hand Duel (RPS)](2026-10-08-rps-ui.md)
- [Sounds Fishy](2026-10-08-sounds-fishy-ui.md)
- [Detective Club](2026-10-08-detective-club-ui.md)
- [Who Am I](2026-10-08-who-am-i-ui.md)
- [Who First](2026-10-08-who-first-ui.md)
- [Music Trivia](2026-10-08-music-trivia-ui.md)
- [The Mind](2026-10-08-the-mind-ui.md)
- [Saboteur](2026-10-08-saboteur-ui.md)
- [Coup / Golden Sand House](2026-10-08-coup-ui.md)
- [Thai Card Game: Pok Deng and Slave](2026-10-08-thai-card-game-ui.md)
- [Banana Thief](2026-10-08-banana-thief-ui.md)

## Project constraints

- Frontend is a single-page client application; game views are selected by GameViewManager.
- Game state is server-authoritative and the client remains a read-only mirror.
- Do not expose private game data in room broadcasts or public UI.
- Keep Thai and English dictionaries aligned.
- Use the existing Tailwind, Framer Motion, Lucide React, and react-hot-toast stack.
- Prefer existing Playwright E2E flows in apps/web/e2e.

## Engagement library recommendations

- Keep Framer Motion as the shared tool for card/role reveals, turn changes, selection feedback, and result transitions. It is already installed and used in several game views; do not add a second general-purpose animation library.
- Use one shared, lazy-loaded `canvas-confetti` helper for match/game wins where a celebration fits. Trigger once after the authoritative result is visible, never on every small score update, and set `disableForReducedMotion: true`.
- Consider Rive only for a character-led experience, starting with Banana Thief, and only when a purpose-made character asset is available. Use Motion as the fallback if no Rive asset is ready.
- Keep the existing sound board for game cues. Revisit Howler only if music fades, audio sprites, or layered sound become difficult to manage.
- Do not add PixiJS or Phaser to the current turn-based board/card games. Reconsider them for a future real-time arcade game or a demonstrated canvas rendering bottleneck.
- Any motion must preserve the same information and affordances when reduced motion is enabled; use subtle opacity/highlight alternatives where movement is disabled.

The per-game plans below identify where these shared tools add useful feedback. Library additions are optional implementation details: prefer the installed stack unless the specific visual effect warrants a new dependency.
