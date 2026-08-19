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
    <div className="flex-1 flex flex-col space-y-6 relative font-mono">
      {actionLoading && <ActionLoadingOverlay />}
      <div className="bg-white border-8 border-black p-8 text-center w-full shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] ">
        <h2 className="text-4xl sm:text-5xl font-black mb-6 uppercase tracking-widest text-black bg-yellow-300 px-6 py-2 border-4 border-black inline-block - shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          {t('gameDetectiveClub.roundOver')}
        </h2>
        <p className="text-black text-xl font-bold mb-4 bg-white px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
          {t('gameDetectiveClub.conspiratorWas')}{' '}
          <span className="text-white bg-black px-2 py-1 uppercase tracking-widest">
            {conspiratorName}
          </span>
        </p>

        {votesAgainstConspirator > 0 ? (
          <div className="mt-6 bg-emerald-400 border-4 border-black p-4 inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
            <p className="text-black font-black uppercase tracking-widest mb-2 text-xl bg-white px-2 py-1 border-2 border-black">
              {t('gameDetectiveClub.conspiratorCaught')}
            </p>
            <p className="text-black font-bold">
              {t('gameDetectiveClub.detectivesIdentified', { count: votesAgainstConspirator })}
            </p>
          </div>
        ) : (
          <div className="mt-6 bg-rose-400 border-4 border-black p-4 inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ">
            <p className="text-black font-black uppercase tracking-widest mb-2 text-xl bg-white px-2 py-1 border-2 border-black">
              {t('gameDetectiveClub.conspiratorEscaped')}
            </p>
            <p className="text-black font-bold">{t('gameDetectiveClub.nobodyCaught')}</p>
          </div>
        )}
      </div>

      <div className="flex-1 bg-cyan-300 border-8 border-black p-4 sm:p-6 overflow-y-auto w-full md:max-w-2xl md:mx-auto shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] -">
        <h3 className="text-black font-black uppercase tracking-widest text-lg mb-6 text-center bg-white px-4 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          {t('gameDetectiveClub.scoreboard')}
        </h3>
        <div className="space-y-4">
          {room.players.map((p) => {
            const pState = state.players[p.socketId];
            if (!pState) return null;

            const isMe = p.socketId === socketId;
            const votedFor = room.players.find((x) => x.socketId === pState.votedFor)?.name;

            return (
              <div
                key={p.socketId}
                className={`flex items-center justify-between p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white ${isMe ? 'scale-105 ' : ''}`}
              >
                <div className="flex flex-col">
                  <span
                    className={`font-black text-xl mb-2 ${isMe ? 'text-black bg-yellow-300 px-2 py-1 border-2 border-black inline-block' : 'text-black'}`}
                  >
                    {p.name} {isMe && `(${t('lobby.you')})`}
                  </span>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center">
                      <span
                        className={`text-sm uppercase font-black px-2 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                          pState.role === 'INFORMER'
                            ? 'bg-indigo-300 text-black -'
                            : pState.role === 'CONSPIRATOR'
                              ? 'bg-rose-300 text-black '
                              : 'bg-emerald-300 text-black -'
                        }`}
                      >
                        {getRoleLabel(pState.role, t)}
                      </span>
                    </div>
                    {pState.votedFor && (
                      <span className="text-sm font-bold text-black bg-pink-300 px-2 py-1 border-2 border-black inline-block w-fit shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        {t('gameDetectiveClub.votedFor')}{' '}
                        <span className="text-white bg-black px-1 uppercase tracking-widest">
                          {votedFor}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-4xl font-black text-black bg-yellow-300 px-3 py-1 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -">
                    {p.score}{' '}
                    <span className="text-sm text-black uppercase tracking-widest font-bold">
                      {t('gameDetectiveClub.pts')}
                    </span>
                  </span>
                  {state.scoreDeltas && state.scoreDeltas[p.socketId] !== undefined && (
                    <span
                      className={`text-lg font-black mt-2 px-2 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${state.scoreDeltas[p.socketId] > 0 ? 'bg-emerald-400 text-black' : 'bg-gray-300 text-black'}`}
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
        <div className="flex flex-col sm:flex-row gap-6 justify-center mt-8">
          <button
            onClick={() => detectiveClubNextRound()}
            disabled={actionLoading}
            className="w-full sm:w-auto bg-emerald-400 hover:bg-emerald-300 text-black font-black px-8 py-4 border-4 border-black transition-transform shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
          >
            {t('gameDetectiveClub.playNextRound')}
          </button>
          <button
            onClick={() => leaveRoom()}
            className="w-full sm:w-auto bg-rose-400 hover:bg-rose-300 text-black font-black px-6 py-4 border-4 border-black transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest text-lg -"
          >
            {t('gameDetectiveClub.endGame')}
          </button>
        </div>
      ) : (
        <div className="text-center mt-8 text-black font-black uppercase tracking-widest bg-purple-300 px-4 py-2 border-4 border-black inline-block mx-auto shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] pb-2">
          {t('gameDetectiveClub.waitingForHostNextRound')}
        </div>
      )}
    </div>
  );
}
