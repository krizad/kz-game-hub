'use client';

import { useState } from 'react';
import { BOT_PLAYER_NAME, BOT_SOCKET_ID, GameType, RoomState, RoomStatus } from '@repo/types';
import { useGameStore } from '@/store/useGameStore';
import { TicTacToeUnifiedView } from '@/components/games/tic-tac-toe/TicTacToeUnifiedView';
import { RPSView } from '@/components/games/rps/RPSView';
import { SoundsFishyView } from '@/components/games/sounds-fishy/SoundsFishyView';
import { DetectiveClubView } from '@/components/games/detective-club/DetectiveClubView';
import { WhoAmIView } from '@/components/games/who-am-i/WhoAmIView';
import { MusicTriviaView } from '@/components/games/music-trivia/MusicTriviaView';
import { WhoFirstView } from '@/components/games/who-first/WhoFirstView';
import { TheMindGameView } from '@/components/games/the-mind/TheMindGameView';
import { SaboteurView } from '@/components/games/saboteur/SaboteurView';
import { CoupView } from '@/components/games/coup/CoupView';
import { BananaThiefView } from '@/components/games/banana-thief/BananaThiefView';
import { WhoKnowView } from '@/components/games/who-know/WhoKnowView';
import { PokDengView } from '@/components/games/card-game/PokDengView';
import { SlaveView } from '@/components/games/card-game/SlaveView';
import { CardGameSettings } from '@/components/games/card-game/CardGameSettings';
import { PokerView } from '@/components/games/poker/PokerView';
import { PokerSettings } from '@/components/games/poker/PokerSettings';
import { CipherGridView } from '@/components/games/cipher-grid/CipherGridView';
import { DogRelayView } from '@/components/games/dog-relay/DogRelayView';
import { DogRelaySeats } from '@/components/games/dog-relay/DogRelaySeats';
import { WerewolfView } from '@/components/games/werewolf/WerewolfView';
import { PlayerGrid } from '@/components/lobby/PlayerGrid';
import { GameSettingsManager } from '@/components/lobby/GameSettingsManager';
import { LobbyStartButton } from '@/components/lobby/LobbyStartButton';
import { useTranslate } from '@/hooks/useTranslate';
import { GameStatusHeader } from '@/components/games/GameStatusHeader';
import { getGamePrompt } from '@/components/games/game-prompts';
import { ResultRevealBoundary } from '@/components/core/ResultRevealBoundary';

function getGameStatus(
  room: RoomState,
  socketId: string,
  privateState: Record<string, unknown> = {},
) {
  let phase: string = room.status;
  let activePlayerId: string | null | undefined;
  let progress: { current: number; total: number } | undefined;

  switch (room.gameType) {
    case GameType.TIC_TAC_TOE: {
      const mode = room.config.ticTacToeMode;
      const state =
        mode === 'GOBBLER'
          ? room.gobblerState
          : mode === 'ULTIMATE'
            ? room.ultimateTicTacToeState
            : room.ticTacToeState;
      if (state) activePlayerId = state.currentTurn === 'X' ? state.playerXId : state.playerOId;
      break;
    }
    case GameType.RPS:
      if (room.rpsState?.roundWinner) phase = 'ROUND_RESULT';
      break;
    case GameType.SOUNDS_FISHY:
      phase = room.soundsFishyState?.currentPhase ?? room.status;
      break;
    case GameType.DETECTIVE_CLUB:
      phase = room.detectiveClubState?.currentPhase ?? room.status;
      activePlayerId = room.detectiveClubState?.currentPhase.startsWith('PLAYING')
        ? room.detectiveClubState.activePlayerId
        : null;
      break;
    case GameType.WHO_AM_I:
      if (room.whoAmIState) {
        phase = room.whoAmIState.phase;
        activePlayerId = room.whoAmIState.currentTurn;
        progress = { current: room.whoAmIState.currentRound, total: room.whoAmIState.maxRounds };
      }
      break;
    case GameType.WHO_FIRST:
      if (room.whoFirstState) {
        phase = room.whoFirstState.phase;
        if (room.whoFirstState.maxRounds > 0) {
          progress = {
            current: room.whoFirstState.currentRound,
            total: room.whoFirstState.maxRounds,
          };
        }
      }
      break;
    case GameType.MUSIC_TRIVIA:
      if (room.musicTriviaState) {
        phase = room.musicTriviaState.phase;
        activePlayerId = room.musicTriviaState.currentRound?.currentBuzzerId;
        if (room.musicTriviaState.totalRounds > 0) {
          progress = {
            current:
              room.musicTriviaState.currentRound?.roundNumber ??
              room.musicTriviaState.roundHistory.length,
            total: room.musicTriviaState.totalRounds,
          };
        }
      }
      break;
    case GameType.THE_MIND:
      if (room.theMindState) {
        phase = room.theMindState.phase;
        progress = { current: room.theMindState.level, total: room.theMindState.maxLevel };
      }
      break;
    case GameType.SABOTEUR:
      if (room.saboteurState) {
        phase = room.saboteurState.currentPhase;
        activePlayerId =
          room.saboteurState.currentPhase === 'PLAYING' ? room.saboteurState.activePlayerId : null;
      }
      break;
    case GameType.COUP:
      if (room.coupState) {
        phase = room.coupState.phase;
        activePlayerId = room.coupState.phase === 'PLAYING' ? room.coupState.currentTurn : null;
      }
      break;
    case GameType.BANANA_THIEF:
      if (room.bananaThiefState) {
        phase = room.bananaThiefState.phase;
        if (room.bananaThiefState.phase === 'VOTING' && room.bananaThiefState.votesTotal > 0) {
          progress = {
            current: room.bananaThiefState.votesRecorded,
            total: room.bananaThiefState.votesTotal,
          };
        }
      }
      break;
    case GameType.CARD_GAME:
      if (room.cardGameState) {
        phase = room.cardGameState.phase;
        activePlayerId =
          room.cardGameState.phase === 'PLAYER_TURNS' ? room.cardGameState.activePlayerId : null;
      }
      break;
    case GameType.POKER:
      if (room.pokerState) {
        phase = room.pokerState.phase;
        activePlayerId =
          room.pokerState.activePlayerId &&
          ['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(room.pokerState.phase)
            ? room.pokerState.activePlayerId
            : null;
      }
      break;
    case GameType.CIPHER_GRID:
      if (room.cipherGridState) {
        phase = room.cipherGridState.phase;
        if (room.cipherGridState.phase === 'CLUE_GIVING') {
          const activeTeam = room.cipherGridState.currentTeam;
          activePlayerId = activeTeam
            ? (room.cipherGridState.cipherLeads[activeTeam] ?? null)
            : null;
        }
      }
      break;
    case GameType.WEREWOLF:
      if (room.werewolfState) {
        phase = room.werewolfState.phase;
        if (
          room.werewolfState.phase === 'DAY_VOTE' &&
          room.werewolfState.voteProgress &&
          room.werewolfState.voteProgress.total > 0
        ) {
          progress = {
            current: room.werewolfState.voteProgress.cast,
            total: room.werewolfState.voteProgress.total,
          };
        }
      }
      break;
    default:
      break;
  }

  const prompt = getGamePrompt(room, socketId, privateState);
  const promptKey = prompt.key;
  const promptParams = prompt.params;

  const activePlayerName = activePlayerId
    ? activePlayerId === BOT_SOCKET_ID
      ? BOT_PLAYER_NAME
      : room.players.find((player) => player.socketId === activePlayerId)?.name
    : undefined;
  const accentClass: Record<GameType, string> = {
    [GameType.WHO_KNOW]: 'bg-indigo-500',
    [GameType.TIC_TAC_TOE]: 'bg-slate-400',
    [GameType.RPS]: 'bg-amber-300',
    [GameType.SOUNDS_FISHY]: 'bg-teal-300',
    [GameType.DETECTIVE_CLUB]: 'bg-yellow-300',
    [GameType.WHO_AM_I]: 'bg-pink-400',
    [GameType.WHO_FIRST]: 'bg-emerald-400',
    [GameType.MUSIC_TRIVIA]: 'bg-violet-400',
    [GameType.THE_MIND]: 'bg-orange-200',
    [GameType.SABOTEUR]: 'bg-orange-500',
    [GameType.COUP]: 'bg-rose-200',
    [GameType.CARD_GAME]: 'bg-amber-500',
    [GameType.POKER]: 'bg-emerald-300',
    [GameType.BANANA_THIEF]: 'bg-lime-400',
    [GameType.CIPHER_GRID]: 'bg-amber-400',
    [GameType.DOG_RELAY]: 'bg-amber-300',
    [GameType.WEREWOLF]: 'bg-indigo-300',
  };

  return {
    phase,
    activePlayerName,
    isMyTurn: activePlayerId === socketId,
    progress,
    accentClass: accentClass[room.gameType],
    promptKey,
    promptParams,
  };
}

export function GameViewManager() {
  const { room, socketId, privateState } = useGameStore();
  const { t } = useTranslate();
  const [showPlayersMobile, setShowPlayersMobile] = useState(false);

  if (!room) return null;

  const renderGameView = () => {
    if (room.gameType === GameType.DOG_RELAY && room.status !== RoomStatus.LOBBY)
      return <DogRelayView />;
    if (room.gameType === GameType.TIC_TAC_TOE) return <TicTacToeUnifiedView />;
    if (room.gameType === GameType.RPS && room.status !== RoomStatus.LOBBY) return <RPSView />;
    if (room.gameType === GameType.SOUNDS_FISHY && room.status !== RoomStatus.LOBBY)
      return <SoundsFishyView />;
    if (room.gameType === GameType.DETECTIVE_CLUB && room.status !== RoomStatus.LOBBY)
      return <DetectiveClubView />;
    if (room.gameType === GameType.WHO_AM_I && room.status !== RoomStatus.LOBBY)
      return <WhoAmIView />;
    if (room.gameType === GameType.MUSIC_TRIVIA && room.status !== RoomStatus.LOBBY)
      return <MusicTriviaView />;
    if (room.gameType === GameType.WHO_FIRST) return <WhoFirstView />;
    if (room.gameType === GameType.THE_MIND) return <TheMindGameView />;
    if (room.gameType === GameType.SABOTEUR && room.status !== RoomStatus.LOBBY)
      return <SaboteurView />;
    if (room.gameType === GameType.COUP && room.status !== RoomStatus.LOBBY) return <CoupView />;
    if (room.gameType === GameType.BANANA_THIEF && room.status !== RoomStatus.LOBBY)
      return <BananaThiefView />;
    if (room.gameType === GameType.CARD_GAME && room.status !== RoomStatus.LOBBY) {
      const preset = room.cardGameConfig?.preset ?? 'POK_DENG';
      if (preset === 'SLAVE') return <SlaveView />;
      return <PokDengView />;
    }
    if (room.gameType === GameType.POKER && room.status !== RoomStatus.LOBBY) {
      return <PokerView />;
    }
    if (room.gameType === GameType.CIPHER_GRID && room.status !== RoomStatus.LOBBY) {
      return <CipherGridView />;
    }
    if (room.gameType === GameType.WEREWOLF && room.status !== RoomStatus.LOBBY) {
      return <WerewolfView />;
    }

    return (
      <div className="flex-1 flex flex-col bg-white border-4 border-black p-2 sm:p-4 shadow-[4px_4px_0_0_#000] min-h-[300px] overflow-y-auto">
        {room.status === RoomStatus.LOBBY && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-[150px]">
            <h4 className="text-lg font-black uppercase text-black tracking-widest bg-white px-4 py-2 rounded-lg border-4 border-black shadow-[4px_4px_0_0_#000]">
              {t('lobby.waitingRoom')}
            </h4>
            {room.gameType === GameType.CARD_GAME && <CardGameSettings />}
            {room.gameType === GameType.POKER && <PokerSettings />}
            {room.gameType === GameType.DOG_RELAY && (
              <>
                <DogRelaySeats />
                {room.dogRelayState?.cancellationReason && (
                  <p role="alert">{t(`dogRelay.${room.dogRelayState.cancellationReason}`)}</p>
                )}
                <p>{t('dogRelay.fixedSettings')}</p>
              </>
            )}
            <LobbyStartButton />
          </div>
        )}
        {room.status !== RoomStatus.LOBBY && <WhoKnowView />}
      </div>
    );
  };

  return (
    <ResultRevealBoundary>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 sm:gap-4 relative w-full">
        {/* Mobile toggle for secondary players panel during active gameplay */}
        {room.status !== RoomStatus.LOBBY && (
          <div className="lg:hidden flex items-center justify-end">
            <button
              data-testid="toggle-players-panel-btn"
              onClick={() => setShowPlayersMobile(!showPlayersMobile)}
              aria-expanded={showPlayersMobile}
              className="text-xs font-black bg-white border-2 border-black px-2.5 py-1 shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none flex items-center gap-1.5"
            >
              <span>👥</span>
              <span>
                {t('lobby.players')} ({room.players.length})
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {showPlayersMobile ? '▲' : '▼'}
              </span>
            </button>
          </div>
        )}

        {/* Players Table (Secondary Panel):
          - In Lobby: always visible.
          - During Active Game: folded on mobile/tablet unless showPlayersMobile is true; always visible on desktop (lg+).
      */}
        <div
          data-testid="game-players-panel"
          className={`${
            room.status === RoomStatus.LOBBY
              ? 'flex'
              : showPlayersMobile
                ? 'flex mb-2'
                : 'hidden lg:flex'
          } lg:flex-none lg:w-72 xl:w-80 flex-col min-h-0 h-fit max-h-[40vh] lg:max-h-full`}
        >
          <PlayerGrid />
        </div>

        {/* Right: Primary Game Area (Status header -> Board/Hand -> Action area) */}
        <div className="flex-1 flex flex-col min-w-0">
          {room.status === RoomStatus.LOBBY && (
            <div className="flex justify-center mb-2">
              <GameSettingsManager />
            </div>
          )}
          {room.status !== RoomStatus.LOBBY && room.gameType !== GameType.DOG_RELAY && (
            <GameStatusHeader {...getGameStatus(room, socketId, privateState)} />
          )}
          {renderGameView()}
        </div>
      </div>
    </ResultRevealBoundary>
  );
}
