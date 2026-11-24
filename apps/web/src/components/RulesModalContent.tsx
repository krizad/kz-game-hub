'use client';

import { GameType } from '@repo/types';
import { WhoKnowRules } from './games/who-know/WhoKnowRules';
import { TicTacToeRules } from './games/tic-tac-toe/TicTacToeRules';
import { RPSRules } from './games/rps/RPSRules';
import { LobbyRules } from './games/LobbyRules';
import { SoundsFishyRules } from './games/sounds-fishy/SoundsFishyRules';
import { DetectiveClubRules } from './games/detective-club/DetectiveClubRules';
import { WhoAmIRules } from './games/who-am-i/WhoAmIRules';
import { WhoFirstRules } from './games/who-first/WhoFirstRules';
import { MusicTriviaRules } from './games/music-trivia/MusicTriviaRules';
import { TheMindRules } from './games/the-mind/TheMindRules';
import { SaboteurRules } from './games/saboteur/SaboteurRules';
import { CoupRules } from './games/coup/CoupRules';
import { CardGameRules } from './games/card-game/CardGameRules';
import { PokerRules } from './games/poker/PokerRules';
import { PokerV2Rules } from './games/poker-v2/PokerV2Rules';
import { BananaThiefRules } from './games/banana-thief/BananaThiefRules';
import { DogRelayRules } from './games/dog-relay/DogRelayRules';
import { CipherGridRules } from './games/cipher-grid/CipherGridRules';
import { WerewolfRules } from './games/werewolf/WerewolfRules';
import { BattleshipRules } from './games/battleship/BattleshipRules';

export function RulesModalContent({ activeTab }: { activeTab: GameType | 'LOBBY' }) {
  switch (activeTab) {
    case 'LOBBY':
      return <LobbyRules />;
    case GameType.WHO_KNOW:
      return <WhoKnowRules />;
    case GameType.TIC_TAC_TOE:
      return <TicTacToeRules />;
    case GameType.RPS:
      return <RPSRules />;
    case GameType.SOUNDS_FISHY:
      return <SoundsFishyRules />;
    case GameType.WHO_AM_I:
      return <WhoAmIRules />;
    case GameType.DETECTIVE_CLUB:
      return <DetectiveClubRules />;
    case GameType.WHO_FIRST:
      return <WhoFirstRules />;
    case GameType.MUSIC_TRIVIA:
      return <MusicTriviaRules />;
    case GameType.THE_MIND:
      return <TheMindRules />;
    case GameType.SABOTEUR:
      return <SaboteurRules />;
    case GameType.COUP:
      return <CoupRules />;
    case GameType.CARD_GAME:
      return <CardGameRules />;
    case GameType.BANANA_THIEF:
      return <BananaThiefRules />;
    case GameType.POKER:
      return <PokerRules />;
    case GameType.POKER_V2:
      return <PokerV2Rules />;
    case GameType.DOG_RELAY:
      return <DogRelayRules />;
    case GameType.CIPHER_GRID:
      return <CipherGridRules />;
    case GameType.WEREWOLF:
      return <WerewolfRules />;
    case GameType.BATTLESHIP:
      return <BattleshipRules />;
    default:
      return null;
  }
}
