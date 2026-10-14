import { GameType } from '@repo/types';

export type GameStyle = 'competitive' | 'party' | 'cooperative' | 'bluffing' | 'quick';

export interface GameCatalogItem {
  type: GameType;
  icon: string;
  catalogKey: string;
  color: string;
  minPlayers: number;
  maxPlayers: number;
  cooperative: boolean;
  audioRequired: boolean;
  textRequired: boolean;
  styles: GameStyle[];
  modes?: string[];
}

export const GAME_CATALOG: GameCatalogItem[] = [
  {
    type: GameType.WHO_KNOW,
    icon: '🎭',
    catalogKey: 'whoKnow',
    color: 'bg-indigo-500',
    minPlayers: 4,
    maxPlayers: 12,
    cooperative: false,
    audioRequired: false,
    textRequired: true,
    styles: ['party', 'bluffing'],
  },
  {
    type: GameType.SOUNDS_FISHY,
    icon: '💬',
    catalogKey: 'soundsFishy',
    color: 'bg-teal-300',
    minPlayers: 3,
    maxPlayers: 10,
    cooperative: false,
    audioRequired: false,
    textRequired: true,
    styles: ['party', 'bluffing'],
  },
  {
    type: GameType.TIC_TAC_TOE,
    icon: '❌',
    catalogKey: 'ticTacToe',
    color: 'bg-slate-400',
    minPlayers: 1, // 1 player vs bot or 2 players
    maxPlayers: 2,
    cooperative: false,
    audioRequired: false,
    textRequired: false,
    styles: ['competitive', 'quick'],
    modes: ['CLASSIC', 'GOBBLER', 'ULTIMATE'],
  },
  {
    type: GameType.RPS,
    icon: '✊',
    catalogKey: 'handDuel',
    color: 'bg-amber-300',
    minPlayers: 2,
    maxPlayers: 10,
    cooperative: false,
    audioRequired: false,
    textRequired: false,
    styles: ['competitive', 'quick'],
    modes: ['1V1_ROUND_ROBIN', 'ALL_AT_ONCE'],
  },
  {
    type: GameType.DETECTIVE_CLUB,
    icon: '🖼️',
    catalogKey: 'detectiveClub',
    color: 'bg-yellow-300',
    minPlayers: 3,
    maxPlayers: 8,
    cooperative: false,
    audioRequired: false,
    textRequired: false,
    styles: ['party', 'bluffing'],
  },
  {
    type: GameType.WHO_AM_I,
    icon: '🤔❓',
    catalogKey: 'whoAmI',
    color: 'bg-pink-400',
    minPlayers: 2, // 2 for random/player input, 3 for host input
    maxPlayers: 12,
    cooperative: false,
    audioRequired: false,
    textRequired: true,
    styles: ['party'],
    modes: ['HOST_INPUT', 'RANDOM', 'PLAYER_INPUT', 'AI_GENERATED'],
  },
  {
    type: GameType.WHO_FIRST,
    icon: '🛎️',
    catalogKey: 'whoFirst',
    color: 'bg-emerald-400',
    minPlayers: 2,
    maxPlayers: 10,
    cooperative: false,
    audioRequired: false,
    textRequired: false,
    styles: ['competitive', 'quick'],
  },
  {
    type: GameType.MUSIC_TRIVIA,
    icon: '🎵',
    catalogKey: 'musicTrivia',
    color: 'bg-violet-400',
    minPlayers: 2,
    maxPlayers: 10,
    cooperative: false,
    audioRequired: true,
    textRequired: false,
    styles: ['party'],
    modes: ['TYPING', 'GAME_MASTER'],
  },
  {
    type: GameType.THE_MIND,
    icon: '⏳',
    catalogKey: 'theMind',
    color: 'bg-orange-200',
    minPlayers: 2,
    maxPlayers: 4,
    cooperative: true,
    audioRequired: false,
    textRequired: false,
    styles: ['cooperative'],
  },
  {
    type: GameType.SABOTEUR,
    icon: '⛏️',
    catalogKey: 'saboteur',
    color: 'bg-orange-500',
    minPlayers: 3,
    maxPlayers: 10,
    cooperative: false,
    audioRequired: false,
    textRequired: false,
    styles: ['party', 'bluffing'],
  },
  {
    type: GameType.COUP,
    icon: '🏠📜',
    catalogKey: 'coup',
    color: 'bg-rose-200',
    minPlayers: 3,
    maxPlayers: 6,
    cooperative: false,
    audioRequired: false,
    textRequired: false,
    styles: ['competitive', 'bluffing'],
  },
  {
    type: GameType.CARD_GAME,
    icon: '🃏',
    catalogKey: 'cardGame',
    color: 'bg-amber-500',
    minPlayers: 2,
    maxPlayers: 6,
    cooperative: false,
    audioRequired: false,
    textRequired: false,
    styles: ['party', 'competitive'],
    modes: ['POK_DENG', 'SLAVE'],
  },
  {
    type: GameType.BANANA_THIEF,
    icon: '🐒',
    catalogKey: 'bananaThief',
    color: 'bg-lime-400',
    minPlayers: 4,
    maxPlayers: 8,
    cooperative: false,
    audioRequired: false,
    textRequired: false,
    styles: ['party', 'bluffing'],
  },
  {
    type: GameType.POKER,
    icon: '🅰️',
    catalogKey: 'poker',
    color: 'bg-emerald-400',
    minPlayers: 2,
    maxPlayers: 8,
    cooperative: false,
    audioRequired: false,
    textRequired: false,
    styles: ['competitive'],
  },
];

export function getGameCatalogItem(type: GameType): GameCatalogItem | undefined {
  return GAME_CATALOG.find((item) => item.type === type);
}
