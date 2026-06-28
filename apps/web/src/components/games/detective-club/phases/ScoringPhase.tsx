import { useGameStore } from '@/store/useGameStore';
import { useTranslate } from '@/hooks/useTranslate';
import { getRoleLabel } from '../DetectiveClubView';
import { ActionLoadingOverlay } from '@/components/core/ActionLoadingOverlay';

export function ScoringPhase() {
  const { room, socketId, detectiveClubNextRound, leaveRoom, actionLoading } = useGameStore();
  const { t } = useTranslate();

  if (!room || !room.detectiveClubState) return null;

  const state = room.detectiveClubState;
  const isHost = socketId === room.roomHostId;

  const conspiratorEntry = Object.entries(state.players).find(([, p]) => p.role === 'CONSPIRATOR');
  if (!conspiratorEntry) return null;
  const [conspiratorId] = conspiratorEntry;
  const conspiratorName = room.players.find((p) => p.socketId === conspiratorId)?.name || 'Unknown';
  const votesAgainstConspirator = Object.values(state.players).filter(
    (p) => p.votedFor === conspiratorId,
  ).length;

  return (
    <div className="flex-1 flex flex-col space-y-6 relative">
      {actionLoading && <ActionLoadingOverlay />}
      <div className="bg-white border border-amber-200 rounded-xl p-8 text-center w-full shadow-lg">
        <h2 className="text-4xl font-black mb-4 uppercase tracking-widest bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
          {t('gameDetectiveClub.roundOver')}
        </h2>
        <p className="text-slate-700 text-lg mb-2">
          {t('gameDetectiveClub.conspiratorWas')}{' '}
          <span className="text-rose-400 font-bold">{conspiratorName}</span>
        </p>

        {votesAgainstConspirator > 0 ? (
          <div className="mt-4 bg-emerald-950/30 border border-emerald-900/50 p-4 rounded-xl">
            <p className="text-emerald-400 font-bold uppercase tracking-widest mb-1">
              {t('gameDetectiveClub.conspiratorCaught')}
            </p>
            <p className="text-slate-600 text-sm">
              {t('gameDetectiveClub.detectivesIdentified', { count: votesAgainstConspirator })}
            </p>
          </div>
        ) : (
          <div className="mt-4 bg-rose-950/30 border border-rose-900/50 p-4 rounded-xl">
            <p className="text-rose-400 font-bold uppercase tracking-widest mb-1">
              {t('gameDetectiveClub.conspiratorEscaped')}
            </p>
            <p className="text-slate-600 text-sm">{t('gameDetectiveClub.nobodyCaught')}</p>
          </div>
        )}
      </div>

      <div className="flex-1 bg-amber-50/50 border border-amber-200 rounded-xl p-4 sm:p-6 overflow-y-auto w-full md:max-w-2xl md:mx-auto">
        <h3 className="text-slate-600 font-bold uppercase tracking-widest text-xs mb-4 text-center">
          {t('gameDetectiveClub.scoreboard')}
        </h3>
        <div className="space-y-3">
          {room.players.map((p) => {
            const pState = state.players[p.socketId];
            if (!pState) return null;

            const isMe = p.socketId === socketId;
            const votedFor = room.players.find((x) => x.socketId === pState.votedFor)?.name;

            return (
              <div
                key={p.socketId}
                className={`flex items-center justify-between p-4 rounded-xl border ${isMe ? 'bg-indigo-950/20 border-indigo-500/30' : 'bg-white/50 border-amber-200'}`}
              >
                <div className="flex flex-col">
                  <span className={`font-bold ${isMe ? 'text-indigo-300' : 'text-slate-800'}`}>
                    {p.name} {isMe && `(${t('lobby.you')})`}
                  </span>
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border leading-none ${
                          pState.role === 'INFORMER'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : pState.role === 'CONSPIRATOR'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {getRoleLabel(pState.role, t)}
                      </span>
                    </div>
                    {pState.votedFor && (
                      <span className="text-xs text-slate-600 bg-amber-100/50 px-2 py-1 rounded inline-block w-fit mt-1 border border-amber-300/50 shadow-inner">
                        {t('gameDetectiveClub.votedFor')}{' '}
                        <span className="text-rose-400 font-bold">{votedFor}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-2xl font-black text-amber-500 leading-none">
                    {p.score}{' '}
                    <span className="text-sm text-amber-500/50 uppercase tracking-widest">
                      {t('gameDetectiveClub.pts')}
                    </span>
                  </span>
                  {state.scoreDeltas && state.scoreDeltas[p.socketId] !== undefined && (
                    <span
                      className={`text-sm font-bold mt-1 ${state.scoreDeltas[p.socketId] > 0 ? 'text-emerald-400' : 'text-slate-500'}`}
                    >
                      {state.scoreDeltas[p.socketId] > 0 ? '+' : ''}
                      {state.scoreDeltas[p.socketId]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isHost ? (
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
          <button
            onClick={() => detectiveClubNextRound()}
            disabled={actionLoading}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] uppercase tracking-wider text-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('gameDetectiveClub.playNextRound')}
          </button>
          <button
            onClick={() => leaveRoom()}
            className="w-full sm:w-auto bg-rose-600/10 border border-rose-600/30 hover:bg-rose-600/20 text-rose-500 font-bold px-6 py-4 rounded-xl transition-all uppercase tracking-wider text-sm"
          >
            {t('gameDetectiveClub.endGame')}
          </button>
        </div>
      ) : (
        <div className="text-center mt-6 text-slate-500 font-medium pb-8">
          {t('gameDetectiveClub.waitingForHostNextRound')}
        </div>
      )}
    </div>
  );
}
