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
      <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-md mx-auto">
        <Card className="w-full bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-xl text-center text-slate-100">
              {t('whoFirst.lobby.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isHost ? (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="penalty-switch" className="flex items-center gap-2 text-slate-300">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      {t('whoFirst.lobby.penaltyLabel')}
                    </Label>
                    <Switch
                      id="penalty-switch"
                      checked={room.config.whoFirstPenalty}
                      onCheckedChange={(checked) =>
                        socket?.emit('update_config', { code: room.code, config: { whoFirstPenalty: checked } })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="host-plays-switch" className="flex items-center gap-2 text-slate-300">
                      <Users className="w-4 h-4 text-blue-400" />
                      {t('whoFirst.lobby.hostPlaysLabel')}
                    </Label>
                    <Switch
                      id="host-plays-switch"
                      checked={room.config.whoFirstHostPlays}
                      onCheckedChange={(checked) =>
                        socket?.emit('update_config', { code: room.code, config: { whoFirstHostPlays: checked } })
                      }
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleStartCountdown}
                  className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700"
                  size="lg"
                >
                  <Play className="w-5 h-5 mr-2" />
                  {t('whoFirst.lobby.startBtn')}
                </Button>
              </>
            ) : (
              <div className="text-center text-slate-400 py-8">
                {t('whoFirst.lobby.waitingForHost')}
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
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto space-y-8">
      
      {/* Header Info */}
      <div className="w-full flex justify-between items-center text-slate-400 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div className="font-medium text-slate-300">
          Round {state.currentRound} / {state.maxRounds}
        </div>
        {state.phase === 'ACTIVE' && (
           <div className="font-mono text-xl text-emerald-400">
              {(activeTime / 1000).toFixed(3)}s
           </div>
        )}
      </div>

      {/* Main Interaction Area */}
      {state.phase === 'COUNTDOWN' || state.phase === 'ACTIVE' ? (
        <div className="flex flex-col items-center justify-center space-y-12 py-12">
           {state.phase === 'COUNTDOWN' && (
             <div className="text-4xl md:text-6xl font-bold text-amber-500 animate-pulse">
               {t('whoFirst.game.ready')}
             </div>
           )}
           {state.phase === 'ACTIVE' && (
             <div className="text-4xl md:text-6xl font-bold text-emerald-500">
               {t('whoFirst.game.go')}
             </div>
           )}

           {canPlay && (
             <button
               onClick={handlePressButton}
               disabled={hasPressed}
               className={`
                 relative flex items-center justify-center
                 w-48 h-48 md:w-64 md:h-64 rounded-full
                 text-4xl font-bold shadow-2xl transition-all duration-150 active:scale-95
                 ${hasPressed ? 'bg-slate-700 text-slate-500 cursor-not-allowed scale-95' : 
                   state.phase === 'ACTIVE' ? 'bg-red-500 hover:bg-red-400 text-white shadow-[0_0_50px_rgba(239,68,68,0.5)]' : 
                   'bg-amber-600 hover:bg-amber-500 text-white'}
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
             <div className="text-xl text-slate-400">
               {t('whoFirst.game.spectating')}
             </div>
           )}
        </div>
      ) : null}

      {/* Results Area */}
      {(state.phase === 'ROUND_RESULT' || state.phase === 'FINISHED') && (
        <Card className="w-full bg-slate-900/80 border-slate-700 shadow-2xl overflow-hidden">
          <CardHeader className="bg-slate-800/50 border-b border-slate-700">
            <CardTitle className="text-2xl text-center text-slate-100 flex items-center justify-center gap-2">
              <Trophy className="text-yellow-500 w-6 h-6" />
              {state.phase === 'FINISHED' ? t('whoFirst.result.finalTitle') : t('whoFirst.result.roundTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             <div className="divide-y divide-slate-800/50">
               {state.presses
                 .filter(p => !p.isPenalty)
                 .sort((a, b) => (a.reactionTimeMs || 0) - (b.reactionTimeMs || 0))
                 .map((press, index) => {
                   const player = room.players.find(p => p.socketId === press.socketId);
                   const isMe = press.socketId === socketId;
                   const fastestTime = state.presses.filter(p => !p.isPenalty).sort((a, b) => (a.reactionTimeMs || 0) - (b.reactionTimeMs || 0))[0]?.reactionTimeMs || 0;
                   const diff = (press.reactionTimeMs || 0) - fastestTime;
                   
                   return (
                     <div key={press.socketId} className={`flex items-center justify-between p-4 ${isMe ? 'bg-indigo-500/10' : ''}`}>
                       <div className="flex items-center gap-4">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-yellow-500 text-yellow-950' : index === 1 ? 'bg-slate-300 text-slate-800' : index === 2 ? 'bg-amber-700 text-amber-50' : 'bg-slate-800 text-slate-400'}`}>
                           {index + 1}
                         </div>
                         <span className={`font-medium ${isMe ? 'text-indigo-300' : 'text-slate-200'} text-lg`}>
                           {player?.name || 'Unknown'}
                         </span>
                       </div>
                       <div className="text-right">
                         <div className="text-emerald-400 font-mono text-lg">
                           {((press.reactionTimeMs || 0) / 1000).toFixed(3)}s
                         </div>
                         {index > 0 && (
                           <div className="text-xs text-slate-500 font-mono">
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
                   <div key={press.socketId} className="flex items-center justify-between p-4 bg-red-950/20">
                     <div className="flex items-center gap-4">
                       <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-900/50 text-red-500">
                         <AlertTriangle className="w-4 h-4" />
                       </div>
                       <span className="font-medium text-slate-400 line-through">
                         {player?.name || 'Unknown'}
                       </span>
                     </div>
                     <div className="text-red-500 font-medium text-sm">
                       {t('whoFirst.result.earlyPress')}
                     </div>
                   </div>
                 );
               })}

               {/* Did not press */}
               {room.players.filter(p => p.connected && (!isHost || hostPlays) && !state.presses.some(press => press.socketId === p.socketId)).map((p) => (
                 <div key={p.socketId} className="flex items-center justify-between p-4 opacity-50">
                   <div className="flex items-center gap-4">
                     <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 text-slate-500">-</div>
                     <span className="font-medium text-slate-400">{p.name}</span>
                   </div>
                   <div className="text-slate-500 text-sm">{t('whoFirst.result.noPress')}</div>
                 </div>
               ))}
             </div>
             
             {isHost && state.phase === 'ROUND_RESULT' && (
               <div className="p-6 border-t border-slate-700 bg-slate-800/30 text-center">
                 <Button onClick={handleNextRound} size="lg" className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700">
                   {t('whoFirst.result.nextRoundBtn')}
                 </Button>
               </div>
             )}

             {isHost && state.phase === 'FINISHED' && (
               <div className="p-6 border-t border-slate-700 bg-slate-800/30 text-center">
                 <Button onClick={handleEndGame} variant="outline" size="lg" className="w-full md:w-auto border-slate-600 text-slate-300">
                   <RotateCcw className="w-4 h-4 mr-2" />
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
