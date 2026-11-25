'use client';

import dynamic from 'next/dynamic';
import { GameType } from '@repo/types';
import { GameChunkFallback } from './GameChunkFallback';

// Raw chunk loaders shared between next/dynamic and lobby-phase prefetch (ADR 0018)
const loadTicTacToeUnifiedView = () =>
  import('@/components/games/tic-tac-toe/TicTacToeUnifiedView');
const loadRPSView = () => import('@/components/games/rps/RPSView');
const loadSoundsFishyView = () => import('@/components/games/sounds-fishy/SoundsFishyView');
const loadDetectiveClubView = () => import('@/components/games/detective-club/DetectiveClubView');
const loadWhoAmIView = () => import('@/components/games/who-am-i/WhoAmIView');
const loadMusicTriviaView = () => import('@/components/games/music-trivia/MusicTriviaView');
const loadWhoFirstView = () => import('@/components/games/who-first/WhoFirstView');
const loadTheMindGameView = () => import('@/components/games/the-mind/TheMindGameView');
const loadSaboteurView = () => import('@/components/games/saboteur/SaboteurView');
const loadCoupView = () => import('@/components/games/coup/CoupView');
const loadBananaThiefView = () => import('@/components/games/banana-thief/BananaThiefView');
const loadWhoKnowView = () => import('@/components/games/who-know/WhoKnowView');
const loadPokDengView = () => import('@/components/games/card-game/PokDengView');
const loadSlaveView = () => import('@/components/games/card-game/SlaveView');
const loadPokerView = () => import('@/components/games/poker/PokerView');
const loadPokerV2View = () => import('@/components/games/poker-v2/PokerV2View');
const loadCipherGridView = () => import('@/components/games/cipher-grid/CipherGridView');
const loadDogRelayView = () => import('@/components/games/dog-relay/DogRelayView');
const loadWerewolfView = () => import('@/components/games/werewolf/WerewolfView');
const loadBattleshipView = () => import('@/components/games/battleship/BattleshipView');
const loadThirtyOneView = () => import('@/components/games/thirty-one/ThirtyOneView');

/**
 * Prefetch map used while a room is in LOBBY status so the active game's chunk
 * is pre-warmed before the host clicks Start (ADR 0018).
 */
export const GAME_VIEW_LOADERS: Record<GameType, () => Promise<unknown>> = {
  [GameType.TIC_TAC_TOE]: loadTicTacToeUnifiedView,
  [GameType.RPS]: loadRPSView,
  [GameType.SOUNDS_FISHY]: loadSoundsFishyView,
  [GameType.DETECTIVE_CLUB]: loadDetectiveClubView,
  [GameType.WHO_AM_I]: loadWhoAmIView,
  [GameType.MUSIC_TRIVIA]: loadMusicTriviaView,
  [GameType.WHO_FIRST]: loadWhoFirstView,
  [GameType.THE_MIND]: loadTheMindGameView,
  [GameType.SABOTEUR]: loadSaboteurView,
  [GameType.COUP]: loadCoupView,
  [GameType.BANANA_THIEF]: loadBananaThiefView,
  [GameType.WHO_KNOW]: loadWhoKnowView,
  [GameType.CARD_GAME]: () => Promise.all([loadPokDengView(), loadSlaveView()]),
  [GameType.POKER]: loadPokerView,
  [GameType.POKER_V2]: loadPokerV2View,
  [GameType.CIPHER_GRID]: loadCipherGridView,
  [GameType.DOG_RELAY]: loadDogRelayView,
  [GameType.WEREWOLF]: loadWerewolfView,
  [GameType.BATTLESHIP]: loadBattleshipView,
  [GameType.THIRTY_ONE]: loadThirtyOneView,
};

// Dynamic Game Views (options must be inline object literals for Next.js SWC)
export const DynamicTicTacToeUnifiedView = dynamic(
  () => loadTicTacToeUnifiedView().then((m) => m.TicTacToeUnifiedView),
  { ssr: false, loading: () => <GameChunkFallback /> },
);
export const DynamicRPSView = dynamic(() => loadRPSView().then((m) => m.RPSView), {
  ssr: false,
  loading: () => <GameChunkFallback />,
});
export const DynamicSoundsFishyView = dynamic(
  () => loadSoundsFishyView().then((m) => m.SoundsFishyView),
  { ssr: false, loading: () => <GameChunkFallback /> },
);
export const DynamicDetectiveClubView = dynamic(
  () => loadDetectiveClubView().then((m) => m.DetectiveClubView),
  { ssr: false, loading: () => <GameChunkFallback /> },
);
export const DynamicWhoAmIView = dynamic(() => loadWhoAmIView().then((m) => m.WhoAmIView), {
  ssr: false,
  loading: () => <GameChunkFallback />,
});
export const DynamicMusicTriviaView = dynamic(
  () => loadMusicTriviaView().then((m) => m.MusicTriviaView),
  { ssr: false, loading: () => <GameChunkFallback /> },
);
export const DynamicWhoFirstView = dynamic(() => loadWhoFirstView().then((m) => m.WhoFirstView), {
  ssr: false,
  loading: () => <GameChunkFallback />,
});
export const DynamicTheMindGameView = dynamic(
  () => loadTheMindGameView().then((m) => m.TheMindGameView),
  { ssr: false, loading: () => <GameChunkFallback /> },
);
export const DynamicSaboteurView = dynamic(() => loadSaboteurView().then((m) => m.SaboteurView), {
  ssr: false,
  loading: () => <GameChunkFallback />,
});
export const DynamicCoupView = dynamic(() => loadCoupView().then((m) => m.CoupView), {
  ssr: false,
  loading: () => <GameChunkFallback />,
});
export const DynamicBananaThiefView = dynamic(
  () => loadBananaThiefView().then((m) => m.BananaThiefView),
  { ssr: false, loading: () => <GameChunkFallback /> },
);
export const DynamicWhoKnowView = dynamic(() => loadWhoKnowView().then((m) => m.WhoKnowView), {
  ssr: false,
  loading: () => <GameChunkFallback />,
});
export const DynamicPokDengView = dynamic(() => loadPokDengView().then((m) => m.PokDengView), {
  ssr: false,
  loading: () => <GameChunkFallback />,
});
export const DynamicSlaveView = dynamic(() => loadSlaveView().then((m) => m.SlaveView), {
  ssr: false,
  loading: () => <GameChunkFallback />,
});
export const DynamicPokerView = dynamic(() => loadPokerView().then((m) => m.PokerView), {
  ssr: false,
  loading: () => <GameChunkFallback />,
});
export const DynamicPokerV2View = dynamic(() => loadPokerV2View().then((m) => m.PokerV2View), {
  ssr: false,
  loading: () => <GameChunkFallback />,
});
export const DynamicCipherGridView = dynamic(
  () => loadCipherGridView().then((m) => m.CipherGridView),
  { ssr: false, loading: () => <GameChunkFallback /> },
);
export const DynamicDogRelayView = dynamic(() => loadDogRelayView().then((m) => m.DogRelayView), {
  ssr: false,
  loading: () => <GameChunkFallback />,
});
export const DynamicWerewolfView = dynamic(() => loadWerewolfView().then((m) => m.WerewolfView), {
  ssr: false,
  loading: () => <GameChunkFallback />,
});
export const DynamicBattleshipView = dynamic(
  () => loadBattleshipView().then((m) => m.BattleshipView),
  { ssr: false, loading: () => <GameChunkFallback /> },
);
export const DynamicThirtyOneView = dynamic(
  () => loadThirtyOneView().then((m) => m.ThirtyOneView),
  { ssr: false, loading: () => <GameChunkFallback /> },
);

// Dynamic Lobby Settings & Panels
export const DynamicCardGameSettings = dynamic(
  () => import('@/components/games/card-game/CardGameSettings').then((m) => m.CardGameSettings),
  { ssr: false },
);
export const DynamicPokerSettings = dynamic(
  () => import('@/components/games/poker/PokerSettings').then((m) => m.PokerSettings),
  { ssr: false },
);
export const DynamicPokerV2Settings = dynamic(
  () => import('@/components/games/poker-v2/PokerV2Settings').then((m) => m.PokerV2Settings),
  { ssr: false },
);
export const DynamicDogRelaySeats = dynamic(
  () => import('@/components/games/dog-relay/DogRelaySeats').then((m) => m.DogRelaySeats),
  { ssr: false },
);
export const DynamicCipherGridSettings = dynamic(
  () =>
    import('@/components/games/cipher-grid/CipherGridSettings').then((m) => m.CipherGridSettings),
  { ssr: false },
);
export const DynamicWhoKnowSettings = dynamic(
  () => import('@/components/games/who-know/WhoKnowSettings').then((m) => m.WhoKnowSettings),
  { ssr: false },
);
export const DynamicRpsSettings = dynamic(
  () => import('@/components/games/rps/RpsSettings').then((m) => m.RpsSettings),
  { ssr: false },
);
export const DynamicWhoAmISettings = dynamic(
  () => import('@/components/games/who-am-i/WhoAmISettings').then((m) => m.WhoAmISettings),
  { ssr: false },
);
export const DynamicMusicTriviaSettings = dynamic(
  () =>
    import('@/components/games/music-trivia/MusicTriviaSettings').then(
      (m) => m.MusicTriviaSettings,
    ),
  { ssr: false },
);
export const DynamicSaboteurSettings = dynamic(
  () => import('@/components/games/saboteur/SaboteurSettings').then((m) => m.SaboteurSettings),
  { ssr: false },
);
export const DynamicBananaThiefSettings = dynamic(
  () =>
    import('@/components/games/banana-thief/BananaThiefSettings').then(
      (m) => m.BananaThiefSettings,
    ),
  { ssr: false },
);
export const DynamicWerewolfSettings = dynamic(
  () => import('@/components/games/werewolf/WerewolfSettings').then((m) => m.WerewolfSettings),
  { ssr: false },
);
export const DynamicDogRelaySettings = dynamic(
  () => import('@/components/games/dog-relay/DogRelaySettings').then((m) => m.DogRelaySettings),
  { ssr: false },
);
export const DynamicBattleshipSettings = dynamic(
  () =>
    import('@/components/games/battleship/BattleshipSettings').then((m) => m.BattleshipSettings),
  { ssr: false },
);
export const DynamicSoundsFishySettings = dynamic(
  () =>
    import('@/components/games/sounds-fishy/SoundsFishySettings').then(
      (m) => m.SoundsFishySettings,
    ),
  { ssr: false },
);
export const DynamicDetectiveClubSettings = dynamic(
  () =>
    import('@/components/games/detective-club/DetectiveClubSettings').then(
      (m) => m.DetectiveClubSettings,
    ),
  { ssr: false },
);
export const DynamicThirtyOneSettings = dynamic(
  () => import('@/components/games/thirty-one/ThirtyOneSettings').then((m) => m.ThirtyOneSettings),
  { ssr: false },
);
