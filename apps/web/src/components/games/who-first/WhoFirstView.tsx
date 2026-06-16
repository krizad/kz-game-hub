import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Play, RotateCcw, AlertTriangle, Users, Trophy } from 'lucide-react';

export const WhoFirstView = () => {
  const { room, socket, socketId } = useGameStore();
  const { t } = useTranslate();
  const [activeTime, setActiveTime] = useState<number>(0);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(0);
  
  const isHost = room?.roomHostId === socketId;
  const state = room?.whoFirstState;
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state?.phase === 'ACTIVE' && state.activeStartTime) {
      interval = setInterval(() => {
        setActiveTime(Date.now() - state.activeStartTime!);
      }, 10); // Update every 10ms for smooth ms counter
    } else {
      setActiveTime(0);
    }
    return () => clearInterval(interval);
  }, [state?.phase, state?.activeStartTime]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state?.phase === 'COUNTDOWN' && state.countdownStartTime && state.countdownDurationMs) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - state.countdownStartTime!;
        const remaining = Math.max(0, state.countdownDurationMs! - elapsed);
        setCountdownRemaining(remaining);
      }, 10);
    } else {
      setCountdownRemaining(0);
    }
    return () => clearInterval(interval);
  }, [state?.phase, state?.countdownStartTime, state?.countdownDurationMs]);

  const isPlayer = room?.players.some((p) => p.socketId === socketId) ?? false;
  const hostPlays = room?.config.whoFirstHostPlays;
  const canPlay = isPlayer && (!isHost || hostPlays);

  const handleStartCountdown = () => {
    if (!room) return;
    socket?.emit('game_action', {
      code: room.code,
      action: { type: 'START_COUNTDOWN' },
    });
  };

  const handlePressButton = () => {
    if (!room) return;
    socket?.emit('game_action', {
      code: room.code,
      action: { type: 'PRESS_BUTTON' },
    });
  };

  const handleNextRound = () => {
    if (!room) return;
    socket?.emit('game_action', {
      code: room.code,
      action: { type: 'NEXT_ROUND' },
    });
  };

  const handleEndGame = () => {
    if (!room) return;
    socket?.emit('game_action', {
      code: room.code,
      action: { type: 'END_GAME' },
    });
  };

  // If we're in countdown phase but the client-side timer hasn't been implemented perfectly, 
  // we might want a local hook to set ACTIVE. Since the backend handles the timer, we'll
  // assume the server will just transition the state.
  // Wait, I didn't add a setTimeout in the backend for countdown! I should send an action from the host when the timer finishes.
  useEffect(() => {
    if (state?.phase === 'COUNTDOWN' && isHost && state.countdownStartTime && state.countdownDurationMs) {
      const now = Date.now();
      const elapsed = now - state.countdownStartTime;
      const remaining = state.countdownDurationMs - elapsed;
      if (remaining > 0) {
        const timeout = setTimeout(() => {
          socket?.emit('game_action', {
            code: room?.code,
            action: { type: 'SET_ACTIVE' },
          });
        }, remaining);
        return () => clearTimeout(timeout);
      } else {
        // Already passed
        socket?.emit('game_action', {
           code: room?.code,
           action: { type: 'SET_ACTIVE' },
        });
      }
    }
  }, [state?.phase, state?.countdownStartTime, state?.countdownDurationMs, isHost, socket, room?.code]);

  if (!room || !state) return null;


  // Render Lobby Config
  if (state.phase === 'LOBBY') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center space-y-6 w-full max-w-md mx-auto p-4">
        <Card className="w-full bg-white border border-amber-200 shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-amber-50 border-b border-amber-200 pb-4 pt-6">
            <CardTitle className="text-2xl font-black text-center text-indigo-600 uppercase tracking-widest">
              {t('whoFirst.lobby.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {isHost ? (
              <>
                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 pb-2">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Label className="flex items-center gap-2 text-slate-700 font-bold">
                      <Play className="w-5 h-5 text-emerald-500" />
                      {t('whoFirst.lobby.minCountdown')}
                    </Label>
                    <input
                      aria-label={t('whoFirst.lobby.minCountdown')}
                      type="number"
                      className="w-16 bg-white border border-slate-300 rounded-lg p-1 text-center font-bold text-slate-700"
                      value={(room.config.whoFirstMinCountdownMs || 2000) / 1000}
                      onChange={(e) => socket?.emit('update_config', { code: room.code, config: { whoFirstMinCountdownMs: parseInt(e.target.value) * 1000 } })}
                      min={1}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Label className="flex items-center gap-2 text-slate-700 font-bold">
                      <Play className="w-5 h-5 text-rose-500" />
                      {t('whoFirst.lobby.maxCountdown')}
                    </Label>
                    <input
                      aria-label={t('whoFirst.lobby.maxCountdown')}
                      type="number"
                      className="w-16 bg-white border border-slate-300 rounded-lg p-1 text-center font-bold text-slate-700"
                      value={(room.config.whoFirstMaxCountdownMs || 5000) / 1000}
                      onChange={(e) => socket?.emit('update_config', { code: room.code, config: { whoFirstMaxCountdownMs: parseInt(e.target.value) * 1000 } })}
                      min={1}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Label htmlFor="infinite-switch" className="flex items-center gap-2 text-slate-700 font-bold">
                      <RotateCcw className="w-5 h-5 text-indigo-500" />
                      {t('whoFirst.lobby.infiniteRounds')}
                    </Label>
                    <Switch
                      id="infinite-switch"
                      className="data-[state=checked]:bg-indigo-500 data-[state=unchecked]:bg-slate-300 shadow-sm"
                      checked={room.config.whoFirstInfiniteRounds}
                      onCheckedChange={(checked) =>
                        socket?.emit('update_config', { code: room.code, config: { whoFirstInfiniteRounds: checked } })
                      }
                    />
                  </div>
                  {!room.config.whoFirstInfiniteRounds && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <Label className="flex items-center gap-2 text-slate-700 font-bold">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        {t('lobby.targetScore')}
                      </Label>
                      <input
                        aria-label={t('lobby.targetScore')}
                        type="number"
                        className="w-16 bg-white border border-slate-300 rounded-lg p-1 text-center font-bold text-slate-700"
                        value={room.config.maxRounds || 3}
                        onChange={(e) => socket?.emit('update_config', { code: room.code, config: { maxRounds: parseInt(e.target.value) } })}
                        min={1}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Label htmlFor="counter-switch" className="flex items-center gap-2 text-slate-700 font-bold">
                      <Play className="w-5 h-5 text-emerald-500" />
                      {t('whoFirst.lobby.showCounter')}
                    </Label>
                    <Switch
                      id="counter-switch"
                      className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-300 shadow-sm"
                      checked={room.config.whoFirstShowCounter !== false}
                      onCheckedChange={(checked) =>
                        socket?.emit('update_config', { code: room.code, config: { whoFirstShowCounter: checked } })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Label htmlFor="penalty-switch" className="flex items-center gap-2 text-slate-700 font-bold">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      {t('whoFirst.lobby.penaltyLabel')}
                    </Label>
                    <Switch
                      id="penalty-switch"
                      className="data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-slate-300 shadow-sm"
                      checked={room.config.whoFirstPenalty}
                      onCheckedChange={(checked) =>
                        socket?.emit('update_config', { code: room.code, config: { whoFirstPenalty: checked } })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Label htmlFor="host-plays-switch" className="flex items-center gap-2 text-slate-700 font-bold">
                      <Users className="w-5 h-5 text-indigo-500" />
                      {t('whoFirst.lobby.hostPlaysLabel')}
                    </Label>
                    <Switch
                      id="host-plays-switch"
                      className="data-[state=checked]:bg-indigo-500 data-[state=unchecked]:bg-slate-300 shadow-sm"
                      checked={room.config.whoFirstHostPlays}
                      onCheckedChange={(checked) =>
                        socket?.emit('update_config', { code: room.code, config: { whoFirstHostPlays: checked } })
                      }
                    />
                  </div>
                </div>
                
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <Label className="text-slate-500 text-sm font-bold mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('lobby.playersInRoom')} ({room.players.filter(p => p.connected).length})
                  </Label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {room.players.filter(p => p.connected).map((player) => (
                      <div key={player.socketId} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 border border-slate-100">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                          {player.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-slate-700 truncate">{player.name} {player.socketId === room.roomHostId && '👑'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <Button 
                  onClick={handleStartCountdown}
                  className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-6 rounded-xl transition-all shadow-lg active:scale-95 text-lg uppercase tracking-widest"
                  size="lg"
                >
                  <Play className="w-6 h-6 mr-2" />
                  {t('whoFirst.lobby.startBtn')}
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                <div className="text-center text-slate-500 font-medium animate-pulse">
                  {t('whoFirst.lobby.waitingForHost')}
                </div>
              </div>
            )}
            
            {!isHost && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <Label className="text-slate-500 text-sm font-bold mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {t('lobby.playersInRoom')} ({room.players.filter(p => p.connected).length})
                </Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {room.players.filter(p => p.connected).map((player) => (
                    <div key={player.socketId} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 border border-slate-100">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase">
                        {player.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-slate-700 truncate">{player.name} {player.socketId === room.roomHostId && '👑'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Game Phases
  const hasPressed = state.presses.some(p => p.socketId === socketId);
  const myPress = state.presses.find(p => p.socketId === socketId);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white border border-amber-200 rounded-2xl p-4 sm:p-6 shadow-xl w-full max-w-2xl mx-auto space-y-8 relative overflow-hidden">
      
      {/* Header Info */}
      <div className="w-full flex justify-between items-center text-slate-600 bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-sm relative h-16">
        <div className="font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
          Round {state.currentRound} {state.maxRounds > 0 ? `/ ${state.maxRounds}` : ''}
        </div>
        {state.phase === 'COUNTDOWN' && room.config.whoFirstShowCounter !== false && (
           <div className="font-mono text-xl font-black text-amber-500 absolute left-1/2 -translate-x-1/2">
              {(countdownRemaining / 1000).toFixed(3)}s
           </div>
        )}
        {state.phase === 'ACTIVE' && room.config.whoFirstShowCounter !== false && (
           <div className="font-mono text-xl font-black text-emerald-600 absolute left-1/2 -translate-x-1/2">
              {(activeTime / 1000).toFixed(3)}s
           </div>
        )}
        {isHost && (state.phase === 'COUNTDOWN' || state.phase === 'ACTIVE') && (
          <Button onClick={handleEndGame} variant="destructive" size="sm" className="font-bold shadow-sm h-8 rounded-lg ml-auto">
            {t('whoFirst.game.endGameNow')}
          </Button>
        )}
      </div>

      {/* Main Interaction Area */}
      {state.phase === 'COUNTDOWN' || state.phase === 'ACTIVE' ? (
        <div className="flex flex-col items-center justify-center space-y-12 py-12 flex-1 w-full">
           {state.phase === 'COUNTDOWN' && (
             <div className="text-5xl md:text-7xl font-black text-amber-500 animate-pulse uppercase tracking-widest drop-shadow-md">
               {t('whoFirst.game.ready')}
             </div>
           )}
           {state.phase === 'ACTIVE' && (
             <div className="text-5xl md:text-7xl font-black text-emerald-500 uppercase tracking-widest drop-shadow-md">
               {t('whoFirst.game.go')}
             </div>
           )}

           {canPlay && (
             <button
               onClick={handlePressButton}
               disabled={hasPressed}
               className={`
                 relative flex items-center justify-center
                 w-48 h-48 md:w-64 md:h-64 rounded-full border-4
                 text-4xl font-black shadow-2xl transition-all duration-150 active:scale-95 uppercase tracking-wider
                 ${hasPressed ? (myPress?.isPenalty ? 'bg-rose-100 text-rose-500 border-rose-300 cursor-not-allowed scale-95 opacity-80' : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed scale-95 opacity-80') : 
                   state.phase === 'ACTIVE' ? 'bg-rose-500 hover:bg-rose-400 text-white border-rose-600 shadow-[0_0_50px_rgba(244,63,94,0.6)]' : 
                   'bg-amber-500 hover:bg-amber-400 text-white border-amber-600 shadow-[0_0_30px_rgba(245,158,11,0.4)]'}
               `}
             >
                {hasPressed ? (
                  myPress?.isPenalty ? t('whoFirst.game.penalty') : t('whoFirst.game.pressed')
                ) : (
                  t('whoFirst.game.pressBtn')
                )}
             </button>
           )}

           {!canPlay && (
             <div className="text-xl text-slate-500 font-bold bg-slate-50 px-6 py-3 rounded-xl border border-slate-200">
               {t('whoFirst.game.spectating')}
             </div>
           )}
        </div>
      ) : null}

      {/* Results Area */}
      {(state.phase === 'ROUND_RESULT' || state.phase === 'FINISHED') && (
        <Card className="w-full bg-white border-indigo-200 shadow-2xl overflow-hidden rounded-3xl animate-in zoom-in-95 duration-300">
          <CardHeader className="bg-indigo-50 border-b border-indigo-100 py-6">
            <CardTitle className="text-2xl text-center text-indigo-700 flex items-center justify-center gap-3 font-black uppercase tracking-widest">
              <Trophy className="text-amber-500 w-8 h-8" />
              {state.phase === 'FINISHED' ? t('whoFirst.result.finalTitle') : t('whoFirst.result.roundTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="divide-y divide-slate-100">
               {state.presses
                 .filter(p => !p.isPenalty)
                 .sort((a, b) => (a.reactionTimeMs || 0) - (b.reactionTimeMs || 0))
                 .map((press, index) => {
                   const player = room.players.find(p => p.socketId === press.socketId);
                   const isMe = press.socketId === socketId;
                   const fastestTime = state.presses.filter(p => !p.isPenalty).sort((a, b) => (a.reactionTimeMs || 0) - (b.reactionTimeMs || 0))[0]?.reactionTimeMs || 0;
                   const diff = (press.reactionTimeMs || 0) - fastestTime;
                   
                   return (
                     <div key={press.socketId} className={`flex items-center justify-between p-5 ${isMe ? 'bg-indigo-50/50' : 'bg-white'}`}>
                       <div className="flex items-center gap-4">
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg border-2 ${index === 0 ? 'bg-amber-100 text-amber-600 border-amber-300 shadow-sm' : index === 1 ? 'bg-slate-100 text-slate-600 border-slate-300 shadow-sm' : index === 2 ? 'bg-amber-50/50 text-amber-700 border-amber-200 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                           {index + 1}
                         </div>
                         <span className={`font-bold ${isMe ? 'text-indigo-600' : 'text-slate-700'} text-lg`}>
                           {player?.name || 'Unknown'} {isMe && `(${t('lobby.you')})`}
                         </span>
                       </div>
                       <div className="text-right">
                         <div className="text-emerald-600 font-black font-mono text-xl">
                           {((press.reactionTimeMs || 0) / 1000).toFixed(3)}s
                         </div>
                         {index > 0 && (
                           <div className="text-xs text-slate-500 font-mono font-bold">
                             +{ (diff / 1000).toFixed(3) }s
                           </div>
                         )}
                       </div>
                     </div>
                   );
               })}
               
               {/* Penalties */}
               {state.presses.filter(p => p.isPenalty).map((press) => {
                 const player = room.players.find(p => p.socketId === press.socketId);
                 return (
                   <div key={press.socketId} className="flex items-center justify-between p-5 bg-rose-50/50">
                     <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full flex items-center justify-center bg-rose-100 border-2 border-rose-200 text-rose-500">
                         <AlertTriangle className="w-5 h-5" />
                       </div>
                       <span className="font-bold text-slate-500 line-through">
                         {player?.name || 'Unknown'}
                       </span>
                     </div>
                     <div className="text-rose-500 font-bold text-sm uppercase tracking-wider bg-white px-3 py-1 rounded-full border border-rose-200 shadow-sm">
                       {t('whoFirst.result.earlyPress')}
                     </div>
                   </div>
                 );
               })}

               {/* Did not press */}
               {room.players.filter(p => p.connected && (!isHost || hostPlays) && !state.presses.some(press => press.socketId === p.socketId)).map((p) => (
                 <div key={p.socketId} className="flex items-center justify-between p-5 opacity-60 bg-slate-50">
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-200 border-2 border-slate-300 text-slate-500 font-black">-</div>
                     <span className="font-bold text-slate-500">{p.name}</span>
                   </div>
                   <div className="text-slate-400 font-bold text-sm uppercase tracking-wider">{t('whoFirst.result.noPress')}</div>
                 </div>
               ))}
             </div>

             {state.phase === 'ROUND_RESULT' && state.presses.length > 0 && state.presses.every(p => p.isPenalty) && (
               <div className="p-6 bg-rose-50 border-t border-rose-100 text-center flex flex-col items-center justify-center gap-2">
                 <AlertTriangle className="w-10 h-10 text-rose-500 animate-bounce" />
                 <h3 className="text-xl font-black text-rose-600 uppercase tracking-widest">{t('whoFirst.result.allFouls')}</h3>
               </div>
             )}
             
             {isHost && state.phase === 'ROUND_RESULT' && (
               <div className="p-6 bg-slate-50 border-t border-slate-200 text-center flex flex-col md:flex-row items-center justify-center gap-4">
                 <Button onClick={handleNextRound} size="lg" className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-6 px-10 rounded-xl transition-all shadow-lg active:scale-95 text-lg uppercase tracking-widest">
                   {t('whoFirst.result.nextRoundBtn')}
                 </Button>
                 <Button onClick={handleEndGame} variant="outline" size="lg" className="w-full md:w-auto border-rose-200 text-rose-600 hover:bg-rose-50 font-bold py-6 px-8 rounded-xl transition-all active:scale-95 text-lg uppercase tracking-widest bg-white shadow-sm">
                   {t('whoFirst.game.endGameNow')}
                 </Button>
               </div>
             )}

             {isHost && state.phase === 'FINISHED' && (
               <div className="p-6 bg-slate-50 border-t border-slate-200 text-center">
                 <Button onClick={() => socket?.emit('reset_game', { code: room.code })} variant="outline" size="lg" className="w-full md:w-auto border-slate-300 text-slate-700 hover:bg-slate-100 font-bold py-6 px-8 rounded-xl transition-all active:scale-95 text-lg uppercase tracking-widest bg-white shadow-sm">
                   <RotateCcw className="w-5 h-5 mr-2" />
                   {t('whoFirst.result.endGameBtn')}
                 </Button>
               </div>
             )}
          </CardContent>
        </Card>
      )}

    </div>
  );
};
