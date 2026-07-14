'use client';

import React from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { GameType, TheMindPhase } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Heart, Star, Users, RotateCcw, Zap, Check, X } from 'lucide-react';

export function TheMindView() {
  const {
    room,
    socket,
    socketId,
    theMindReady,
    theMindPlayCard,
    theMindNextLevel,
    theMindProposeShuriken,
    theMindVoteShuriken,
    theMindCancelShuriken,
  } = useGameStore();
  const { t } = useTranslate();

  if (!room || room.gameType !== GameType.THE_MIND) return null;

  const isHost = room.roomHostId === socketId;

  const renderLobby = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-md mx-auto p-4">
      <Card className="w-full bg-white border border-amber-200 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-indigo-50 border-b border-indigo-200 pb-4 pt-6">
          <CardTitle className="text-2xl font-black text-center text-indigo-600 uppercase tracking-widest">
            {t('gameTheMind.lobby.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {isHost ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-slate-600 text-center font-medium">
                {t('gameTheMind.lobby.readyToStart')}
              </p>
              <Button
                onClick={() => socket?.emit('start_game', { code: room.code })}
                disabled={room.players.filter((p) => p.connected).length < 2}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-6 rounded-xl transition-all shadow-lg active:scale-95 text-lg uppercase tracking-widest"
                size="lg"
              >
                <Play className="w-6 h-6 mr-2" />
                {t('lobby.startGame')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
              <div className="text-center text-slate-500 font-medium animate-pulse">
                {t('lobby.waitingForHost')}
              </div>
            </div>
          )}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-slate-500 text-sm font-bold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t('lobby.playersInRoom')} ({room.players.filter((p) => p.connected).length})
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {room.players
                .filter((p) => p.connected)
                .map((player) => (
                  <div
                    key={player.socketId}
                    className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 border border-slate-100"
                  >
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                      {player.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-slate-700 truncate">
                      {player.name} {player.socketId === room.roomHostId && '👑'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (!room.theMindState) {
    return room.status === 'LOBBY' ? renderLobby() : null;
  }

  const state = room.theMindState;
  const myHand = state.playerHands[socketId] || [];
  const canPlay = state.phase === TheMindPhase.PLAYING;
  const shurikenVote = state.shurikenVotes[socketId];
  const isShurikenProposer = state.shurikenProposerId === socketId;

  const renderSetup = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-8 w-full max-w-lg mx-auto p-4">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-black text-indigo-600 uppercase tracking-widest">
          {t('gameTheMind.game.level')} {state.level}/{state.maxLevel}
        </h2>
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">
            <Heart className="w-5 h-5 text-rose-500" />
            <span className="font-black text-xl text-rose-600">{state.lives}</span>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2">
            <Star className="w-5 h-5 text-indigo-500" />
            <span className="font-black text-xl text-indigo-600">{state.shuriken}</span>
          </div>
        </div>
        <p className="text-slate-500 font-medium text-lg">
          {t('gameTheMind.game.cardsDealt', { count: state.level })}
        </p>
        {!state.readyPlayers.includes(socketId) ? (
          <Button
            onClick={() => theMindReady()}
            className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg active:scale-95 text-lg"
            size="lg"
          >
            <Check className="w-5 h-5 mr-2" />
            {t('gameTheMind.game.readyBtn')}
          </Button>
        ) : (
          <div className="text-green-600 font-bold text-lg flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            {t('gameTheMind.game.waitingForOthers')}
          </div>
        )}
        <p className="text-sm text-slate-400">
          {state.readyPlayers.length}/{room.players.filter((p) => p.connected).length}{' '}
          {t('gameTheMind.game.ready')}
        </p>
      </div>
    </div>
  );

  const renderPlaying = () => (
    <div className="flex-1 flex flex-col space-y-6 w-full max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between bg-white border border-amber-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-500 uppercase">
            {t('gameTheMind.game.level')} {state.level}/{state.maxLevel}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-rose-500" />
            <span className="font-black text-lg text-rose-600">{state.lives}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="w-4 h-4 text-indigo-500" />
            <span className="font-black text-lg text-indigo-600">{state.shuriken}</span>
          </div>
        </div>
      </div>

      <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 text-center">
        <p className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-2">
          {t('gameTheMind.game.pileTop')}
        </p>
        <span className="text-5xl font-black text-indigo-600">{state.pileTop}</span>
        {state.pileTopPlayerId && (
          <p className="mt-2 text-sm text-indigo-500 font-medium">
            {t('gameTheMind.game.playedBy', {
              name: room.players.find((p) => p.socketId === state.pileTopPlayerId)?.name || 'Unknown',
            })}
          </p>
        )}
      </div>

      {state.playedCards && state.playedCards.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
            {t('gameTheMind.game.playedCardsLog')}
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {state.playedCards.map((pc, idx) => {
              const playerName = room.players.find((p) => p.socketId === pc.playerId)?.name || 'Unknown';
              return (
                <div key={idx} className="flex-shrink-0 bg-white border border-slate-200 rounded-lg p-2 text-center min-w-[60px]">
                  <div className="text-xs text-slate-400 truncate w-16" title={playerName}>{playerName}</div>
                  <div className="font-bold text-indigo-600">{pc.card}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
          {t('gameTheMind.game.yourHand')} ({myHand.length})
        </h3>
        <div className="flex flex-wrap gap-2 max-h-[40vh] overflow-y-auto justify-center">
          {myHand.map((card) => {
            const isLowest = card === myHand[0];
            return (
              <button
                key={card}
                onClick={() => {
                  if (canPlay && isLowest) {
                    theMindPlayCard(card);
                  }
                }}
                disabled={!canPlay || !isLowest}
                className={`w-16 h-20 rounded-xl font-black text-xl transition-all duration-200 border-2 ${
                  isLowest && canPlay
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg hover:bg-indigo-500 hover:scale-105 cursor-pointer'
                    : isLowest && !canPlay
                      ? 'bg-indigo-200 text-indigo-400 border-indigo-300 cursor-not-allowed'
                      : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                }`}
              >
                {card}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center gap-3">
        {state.shuriken > 0 && state.phase !== TheMindPhase.SHURIKEN_VOTE && (
          <Button
            onClick={() => theMindProposeShuriken()}
            variant="outline"
            className="border-indigo-200 text-indigo-500 hover:bg-indigo-50 font-bold rounded-xl shadow-sm"
          >
            <Zap className="w-4 h-4 mr-2" />
            {t('gameTheMind.game.useShuriken')} ({state.shuriken})
          </Button>
        )}
        {isHost && (
          <Button
            onClick={() => socket?.emit('reset_game', { code: room.code })}
            variant="outline"
            className="border-rose-200 text-rose-500 hover:bg-rose-50 font-bold rounded-xl shadow-sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            {t('gameTheMind.game.exitGame')}
          </Button>
        )}
      </div>
    </div>
  );

  const renderShurikenVote = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-md mx-auto p-4">
      <Card className="w-full bg-white border border-indigo-200 shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-indigo-50 border-b border-indigo-200 pb-4 pt-6">
          <CardTitle className="text-xl font-black text-center text-indigo-600 uppercase tracking-widest">
            <Zap className="w-6 h-6 inline-block mr-2" />
            {t('gameTheMind.game.shurikenVoteTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <p className="text-center text-slate-600 font-medium">
            {isShurikenProposer
              ? t('gameTheMind.game.youProposedShuriken')
              : t('gameTheMind.game.shurikenProposedBy', {
                  name:
                    room.players.find((p) => p.socketId === state.shurikenProposerId)?.name ||
                    'Unknown',
                })}
          </p>
          <p className="text-center text-sm text-slate-400">
            {t('gameTheMind.game.shurikenVoteDesc')}
          </p>
          {shurikenVote === undefined ? (
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => theMindVoteShuriken(true)}
                className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg active:scale-95"
              >
                <Check className="w-5 h-5 mr-2" />
                {t('gameTheMind.game.agree')}
              </Button>
              <Button
                onClick={() => theMindVoteShuriken(false)}
                variant="outline"
                className="border-rose-200 text-rose-500 hover:bg-rose-50 font-bold py-4 px-8 rounded-xl transition-all shadow-sm"
              >
                <X className="w-5 h-5 mr-2" />
                {t('gameTheMind.game.disagree')}
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <div
                className={shurikenVote ? 'text-green-600 font-bold' : 'text-rose-500 font-bold'}
              >
                {shurikenVote
                  ? t('gameTheMind.game.votedAgree')
                  : t('gameTheMind.game.votedDisagree')}
              </div>
              <p className="text-sm text-slate-400">
                {t('gameTheMind.game.waitingForVotes')} ({Object.keys(state.shurikenVotes).length}/
                {room.players.filter((p) => p.connected).length})
              </p>
            </div>
          )}
          {isShurikenProposer && (
            <Button
              onClick={() => theMindCancelShuriken()}
              variant="outline"
              className="w-full border-amber-200 text-amber-600 hover:bg-amber-50 font-bold"
            >
              {t('gameTheMind.game.cancelProposal')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderShurikenResult = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-lg mx-auto p-4">
      <Card className="w-full bg-white border shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-indigo-50 border-b border-indigo-200 pb-4 pt-6">
          <CardTitle className="text-2xl font-black text-center text-indigo-600 uppercase tracking-widest">
            <Zap className="w-6 h-6 inline-block mr-2" />
            {t('gameTheMind.game.shurikenResultTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <p className="text-center text-slate-600 font-medium">
            {t('gameTheMind.game.shurikenResultDesc')}
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            {Object.entries(state.discardedCards || {}).map(([pid, cards]) => {
              const player = room.players.find((p) => p.socketId === pid);
              return (
                <div key={pid} className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-700">{player?.name || 'Unknown'}</span>
                  <span className="text-indigo-600 font-black">[{cards.join(', ')}]</span>
                </div>
              );
            })}
          </div>
          {isHost && (
            <Button
              onClick={() => theMindNextLevel()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-6 rounded-xl transition-all shadow-lg active:scale-95 text-lg uppercase tracking-widest"
              size="lg"
            >
              <Play className="w-6 h-6 mr-2" />
              {t('gameTheMind.game.resumeLevel')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderLevelResult = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-lg mx-auto p-4">
      <Card className="w-full bg-white border shadow-xl rounded-2xl overflow-hidden">
        <CardHeader
          className={`border-b pb-4 pt-6 ${state.result?.success ? 'bg-green-50 border-green-200' : 'bg-rose-50 border-rose-200'}`}
        >
          <CardTitle
            className={`text-2xl font-black text-center uppercase tracking-widest ${state.result?.success ? 'text-green-600' : 'text-rose-600'}`}
          >
            {state.result?.success
              ? t('gameTheMind.game.levelComplete')
              : t('gameTheMind.game.mistake')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {state.result && !state.result.success && (
            <div className="space-y-3">
              <p className="text-center text-slate-600 font-medium">
                {t('gameTheMind.game.livesRemaining', { lives: state.lives })}
              </p>
              {Object.keys(state.discardedCards).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-amber-700 mb-2">
                    {t('gameTheMind.game.discardedCards')}:
                  </p>
                  {Object.entries(state.discardedCards).map(([pid, cards]) => {
                    const player = room.players.find((p) => p.socketId === pid);
                    return (
                      <div key={pid} className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-slate-700">
                          {player?.name || 'Unknown'}:
                        </span>
                        <span className="text-slate-500">[{cards.join(', ')}]</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {state.result?.success && (
            <p className="text-center text-slate-600 font-medium text-lg">
              {t('gameTheMind.game.levelCleared')}
            </p>
          )}
          {isHost && (
            <Button
              onClick={() => theMindNextLevel()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-6 rounded-xl transition-all shadow-lg active:scale-95 text-lg uppercase tracking-widest"
              size="lg"
            >
              <Play className="w-6 h-6 mr-2" />
              {state.result?.levelCleared
                ? `${t('gameTheMind.game.nextLevel')} ${state.level + 1}`
                : t('gameTheMind.game.resumeLevel')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderGameOver = () => (
    <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-lg mx-auto p-4">
      <Card className="w-full bg-white border shadow-xl rounded-2xl overflow-hidden">
        <CardHeader
          className={
            state.level >= state.maxLevel
              ? 'bg-green-50 border-b border-green-200 pb-4 pt-6'
              : 'bg-rose-50 border-b border-rose-200 pb-4 pt-6'
          }
        >
          <CardTitle
            className={`text-3xl font-black text-center uppercase tracking-widest ${state.level >= state.maxLevel ? 'text-green-600' : 'text-rose-600'}`}
          >
            {state.level >= state.maxLevel
              ? t('gameTheMind.game.youWin')
              : t('gameTheMind.game.gameOver')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 text-center">
          <div className="space-y-2">
            <p className="text-lg font-medium text-slate-600">
              {t('gameTheMind.game.levelReached', { level: state.level, max: state.maxLevel })}
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-1.5">
                <Heart className="w-5 h-5 text-rose-500" />
                <span className="font-black text-xl text-rose-600">{state.lives}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="w-5 h-5 text-indigo-500" />
                <span className="font-black text-xl text-indigo-600">{state.shuriken}</span>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
              {t('gameTheMind.game.finalScores')}
            </p>
            <div className="space-y-2">
              {[...room.players]
                .sort((a, b) => b.score - a.score)
                .map((player) => (
                  <div
                    key={player.socketId}
                    className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100"
                  >
                    <span className="font-medium text-slate-700">
                      {player.name}
                      {player.socketId === socketId && ` (${t('lobby.you')})`}
                    </span>
                    <span className="font-black text-indigo-600">{player.score}</span>
                  </div>
                ))}
            </div>
          </div>
          {isHost && (
            <Button
              onClick={() => socket?.emit('reset_game', { code: room.code })}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-6 rounded-xl transition-all shadow-lg active:scale-95 text-lg uppercase tracking-widest"
              size="lg"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              {t('result.playAgain')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );

  switch (state.phase) {
    case TheMindPhase.LOBBY:
    case TheMindPhase.SETUP:
      return state.level === 1 && state.phase === TheMindPhase.LOBBY
        ? renderLobby()
        : renderSetup();
    case TheMindPhase.PLAYING:
      return renderPlaying();
    case TheMindPhase.SHURIKEN_VOTE:
      return renderShurikenVote();
    case TheMindPhase.SHURIKEN_RESULT:
      return renderShurikenResult();
    case TheMindPhase.LEVEL_RESULT:
      return renderLevelResult();
    case TheMindPhase.GAME_OVER:
      return renderGameOver();
    default:
      return renderSetup();
  }
}
