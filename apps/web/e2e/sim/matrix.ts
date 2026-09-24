/**
 * Simulated playthrough matrix: one entry per game x lobby-selectable
 * mode/config variant. Every entry is playable to completion through the UI.
 *
 * `external: true` entries depend on network services beyond the default
 * iTunes lookup or an LLM key; they are skipped unless
 * E2E_SIM_INCLUDE_EXTERNAL=1.
 */
export interface SimPlayer {
  /** Player index that performs this action (0 = host). */
  page: number;
  text: RegExp;
  /** Optional text of a specific player the action applies to. */
  target?: RegExp;
}

export interface MatrixEntry {
  id: string;
  game: string;
  /** Lobby button text used by createRoom(). */
  lobbyButton: string;
  players: number;
  description: string;
  external?: boolean;
  /** Extra lobby configuration applied by the host after creating the room. */
  configure?: string[];
  /** Optional per-entry timeout override in ms. */
  timeout?: number;
}

export const GAME_MATRIX: MatrixEntry[] = [
  // --- Who Know ---
  {
    id: 'who-know-4p',
    game: 'WHO_KNOW',
    lobbyButton: 'Who Know!',
    players: 4,
    description: 'Word reveal, questioning, voting, results',
  },

  // --- Sounds Fishy ---
  {
    id: 'sounds-fishy-3p',
    game: 'SOUNDS_FISHY',
    lobbyButton: 'Sounds Fishy',
    players: 3,
    description: 'Answer, eliminate, round over scores',
  },

  // --- Tic-Tac-Toe family (mode chosen in the lobby) ---
  {
    id: 'ttt-classic-2p',
    game: 'TIC_TAC_TOE',
    lobbyButton: 'Classic Tic Tac Toe',
    players: 2,
    description: 'Classic PVP, X wins',
  },
  {
    id: 'ttt-classic-bot-easy',
    game: 'TIC_TAC_TOE',
    lobbyButton: 'Classic Tic Tac Toe',
    players: 1,
    description: 'Classic vs easy bot',
    configure: ['ttt-opponent-bot', 'ttt-diff-easy'],
  },
  {
    id: 'ttt-classic-bot-god',
    game: 'TIC_TAC_TOE',
    lobbyButton: 'Classic Tic Tac Toe',
    players: 1,
    description: 'Classic vs god bot',
    configure: ['ttt-opponent-bot', 'ttt-diff-god'],
  },
  {
    id: 'ttt-gobbler-2p',
    game: 'TIC_TAC_TOE',
    lobbyButton: 'Gobbler Tic Tac Toe',
    players: 2,
    description: 'Gobbler PVP, X wins row',
  },
  {
    id: 'ttt-ultimate-2p',
    game: 'TIC_TAC_TOE',
    lobbyButton: 'Ultimate Tic-Tac-Toe',
    players: 2,
    description: 'Ultimate PVP, X wins',
  },

  // --- RPS / Hand Duel (mode + best-of in lobby) ---
  {
    id: 'rps-bestof1-rr',
    game: 'RPS',
    lobbyButton: 'Hand Duel',
    players: 2,
    description: 'BO1 round robin',
    configure: ['rps-bestof:1'],
  },
  {
    id: 'rps-bestof3-rr',
    game: 'RPS',
    lobbyButton: 'Hand Duel',
    players: 2,
    description: 'BO3 round robin',
    configure: ['rps-bestof:3'],
  },
  {
    id: 'rps-bestof3-chaos',
    game: 'RPS',
    lobbyButton: 'Hand Duel',
    players: 2,
    description: 'BO3 all at once',
    configure: ['rps-mode:ALL_AT_ONCE', 'rps-bestof:3'],
  },

  // --- Detective Club ---
  {
    id: 'detective-club-3p',
    game: 'DETECTIVE_CLUB',
    lobbyButton: 'Detective Club',
    players: 3,
    description: 'Setup, 2 playing rounds, discussion, vote, scoring',
    timeout: 240000,
  },

  // --- Who Am I (word mode in lobby) ---
  {
    id: 'whoami-player-input',
    game: 'WHO_AM_I',
    lobbyButton: 'Who Am I',
    players: 2,
    description: 'Players write words, ask, guess, YES win',
    configure: ['whoami-rounds:1', 'whoami-wordmode:PLAYER_INPUT'],
    timeout: 180000,
  },
  {
    id: 'whoami-host-input',
    game: 'WHO_AM_I',
    lobbyButton: 'Who Am I',
    players: 3,
    description: 'Host assigns words, ask, guess, YES win',
    configure: ['whoami-wordmode:HOST_INPUT'],
    timeout: 180000,
  },
  {
    id: 'whoami-random',
    game: 'WHO_AM_I',
    lobbyButton: 'Who Am I',
    players: 2,
    description: 'Random DB words, ask, guess, YES win',
    configure: ['whoami-wordmode:RANDOM', 'whoami-category:Animals'],
    timeout: 180000,
  },
  {
    id: 'whoami-ai',
    game: 'WHO_AM_I',
    lobbyButton: 'Who Am I',
    players: 2,
    description: 'AI-generated word (needs LLM key)',
    external: true,
    configure: ['whoami-wordmode:AI_GENERATED'],
  },

  // --- Who First ---
  {
    id: 'who-first-2p',
    game: 'WHO_FIRST',
    lobbyButton: 'Who First',
    players: 2,
    description: 'Countdown duel, press, end game',
  },
  {
    id: 'who-first-penalty',
    game: 'WHO_FIRST',
    lobbyButton: 'Who First',
    players: 2,
    description: 'Countdown duel with false-start penalty',
    configure: ['who-first-penalty'],
  },

  // --- Music Trivia (mode in lobby; iTunes default source) ---
  // Music entries need live external music lookups + browser audio playback,
  // so they are external by default even for the iTunes source.
  {
    id: 'music-trivia-typing',
    game: 'MUSIC_TRIVIA',
    lobbyButton: 'Music Trivia',
    players: 2,
    description: 'Typing mode, 5 rounds, game over',
    external: true,
    configure: ['music-trivia-rounds:5', 'music-trivia-query:Pop'],
    timeout: 240000,
  },
  {
    id: 'music-trivia-gm',
    game: 'MUSIC_TRIVIA',
    lobbyButton: 'Music Trivia',
    players: 2,
    description: 'Game master (host judges), 5 rounds',
    external: true,
    configure: ['music-trivia-mode:GAME_MASTER', 'music-trivia-rounds:5', 'music-trivia-query:Pop'],
    timeout: 240000,
  },
  {
    id: 'music-trivia-soundcloud',
    game: 'MUSIC_TRIVIA',
    lobbyButton: 'Music Trivia',
    players: 2,
    description: 'SoundCloud source (flaky network)',
    external: true,
    configure: [
      'music-trivia-source:SOUNDCLOUD',
      'music-trivia-rounds:5',
      'music-trivia-query:Pop',
    ],
  },
  {
    id: 'music-trivia-youtube',
    game: 'MUSIC_TRIVIA',
    lobbyButton: 'Music Trivia',
    players: 2,
    description: 'YouTube source (flaky network)',
    external: true,
    configure: ['music-trivia-source:YOUTUBE', 'music-trivia-rounds:5', 'music-trivia-query:Pop'],
  },

  // --- The Mind (variants in lobby) ---
  {
    id: 'the-mind-normal',
    game: 'THE_MIND',
    lobbyButton: 'The Mind',
    players: 2,
    description: 'Win all levels to You Win',
    configure: ['the-mind-maxlevel:4'],
  },
  {
    id: 'the-mind-extreme',
    game: 'THE_MIND',
    lobbyButton: 'The Mind',
    players: 2,
    description: 'Extreme mode, win all levels',
    configure: ['the-mind-extreme', 'the-mind-maxlevel:3'],
  },
  {
    id: 'the-mind-blind',
    game: 'THE_MIND',
    lobbyButton: 'The Mind',
    players: 2,
    description: 'Blind mode, finish by Game Over',
    configure: ['the-mind-maxlevel:3', 'the-mind-blind'],
  },

  // --- Saboteur (3+ players) ---
  {
    id: 'saboteur-3p',
    game: 'SABOTEUR',
    lobbyButton: 'Saboteur',
    players: 3,
    description: 'Play 3 rounds to Game Over',
    timeout: 420000,
  },
  {
    id: 'saboteur-stone-ends',
    game: 'SABOTEUR',
    lobbyButton: 'Saboteur',
    players: 3,
    description: 'Stone goal ends round instantly, 3 rounds',
    configure: ['saboteur-stone-on'],
    timeout: 420000,
  },

  // --- Coup (3 players) ---
  {
    id: 'coup-3p',
    game: 'COUP',
    lobbyButton: 'Coup',
    players: 3,
    description: 'Income rush, coups until one player remains',
  },

  // --- Thai Card Game (preset in lobby) ---
  {
    id: 'card-pok-deng',
    game: 'CARD_GAME',
    lobbyButton: 'Thai Card Game',
    players: 2,
    description: 'Pok Deng round to dealer-rotation RESULT',
  },
  {
    id: 'card-slave',
    game: 'CARD_GAME',
    lobbyButton: 'Thai Card Game',
    players: 2,
    description: 'Slave: play all cards until RESULT',
    timeout: 180000,
  },
];

export function filterMatrix(idsOrPrefixes: string[]): MatrixEntry[] {
  if (idsOrPrefixes.length === 0) return GAME_MATRIX;
  const lowered = idsOrPrefixes.map((s) => s.trim().toLowerCase()).filter(Boolean);
  return GAME_MATRIX.filter((entry) =>
    lowered.some(
      (needle) => entry.id.toLowerCase() === needle || entry.id.toLowerCase().startsWith(needle),
    ),
  );
}

export const DEFAULT_PLAYS = 1;
