'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { GameType } from '@repo/types';
import { toast } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslate } from '@/hooks/useTranslate';
import { LanguageSwitcher } from '@/components/core/LanguageSwitcher';
import { RulesModal } from '@/components/RulesModal';

interface RoomHeaderProps {
  onShowLeaderboard: () => void;
}

export function RoomHeader({ onShowLeaderboard }: RoomHeaderProps) {
  const { room, leaveRoom } = useGameStore();
  const { t } = useTranslate();

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  if (!room) return null;

  return (
    <>
      <header className="flex-none flex items-center justify-between gap-4 p-2 sm:p-4 bg-white border border-amber-200 rounded-2xl shadow-xl z-10 w-full">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap w-full">
          <img
            src="/icon.png"
            alt="Logo"
            className="w-8 h-8 rounded-lg shadow-sm border border-amber-300"
          />
          <div className="flex flex-col">
            <span className="text-xs font-black tracking-widest text-slate-500 uppercase leading-none mb-0.5 hidden sm:block">
              {room.gameType === GameType.GOBBLER_TIC_TAC_TOE
                ? t('lobby.gameNames.gobbler')
                : room.gameType === GameType.TIC_TAC_TOE
                  ? t('lobby.gameNames.ticTacToe')
                  : room.gameType === GameType.RPS
                    ? t('lobby.gameNames.handDuel')
                    : room.gameType === GameType.SOUNDS_FISHY
                      ? 'Sounds Fishy'
                      : room.gameType === GameType.DETECTIVE_CLUB
                        ? 'Detective Club'
                        : room.gameType === GameType.MUSIC_TRIVIA
                          ? 'Music Trivia'
                          : room.gameType === GameType.WHO_AM_I
                            ? 'Who Am I'
                            : room.gameType === GameType.WHO_FIRST
                              ? 'Who First'
                              : t('lobby.gameNames.whoKnow')}
            </span>
            <span className="text-xl sm:text-2xl font-black tracking-widest text-indigo-400 leading-none">
              {room.code}
            </span>
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-slate-500 ml-1 sm:ml-2 border-l border-amber-300 pl-2 sm:pl-4 py-0.5 flex items-center gap-1">
            <span className="hidden sm:inline">{t('lobby.roomHost')}</span>
            <span
              className="text-slate-700 font-bold truncate max-w-[100px] sm:max-w-[150px]"
              title="Room Creator"
            >
              {room.players?.find((p) => p.socketId === room.roomHostId)?.name ||
                t('lobby.unknownHost')}
            </span>
          </span>
          <button
            onClick={() => {
              const inviteLink = `${window.location.origin}/?room=${room.code}`;
              navigator.clipboard.writeText(inviteLink);
              toast.success(t('errors.inviteLinkCopied'));
            }}
            className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 font-bold px-2.5 py-1.5 rounded-lg transition-colors text-xs flex items-center gap-1.5 sm:ml-2"
            title={t('lobby.copyLink')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            <span className="hidden sm:inline">{t('lobby.copyLink')}</span>
          </button>
          <button
            onClick={() => setShowQRModal(true)}
            className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 hover:text-purple-300 border border-purple-500/30 font-bold px-2.5 py-1.5 rounded-lg transition-colors text-xs flex items-center gap-1.5 ml-1"
            title={t('lobby.qrCode')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <rect width="4" height="4" x="7" y="7" />
              <rect width="4" height="4" x="13" y="7" />
              <rect width="4" height="4" x="7" y="13" />
              <rect width="4" height="4" x="13" y="13" />
            </svg>
            <span className="hidden sm:inline">{t('lobby.qrCode')}</span>
          </button>
          <LanguageSwitcher />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onShowLeaderboard}
            className="text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg border border-transparent hover:border-amber-200 hover:bg-amber-100/50"
            title="Leaderboard"
          >
            🏆
          </button>
          <RulesModal defaultGameType={room.gameType} isGameRoom={true} />
          <button
            onClick={() => setShowLeaveModal(true)}
            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 px-3 py-1.5 rounded-lg font-bold text-xs sm:text-sm transition-colors flex items-center gap-1.5 whitespace-nowrap"
            title={t('lobby.leave')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="hidden sm:inline">{t('lobby.leave')}</span>
          </button>
        </div>
      </header>

      {/* Leave Room Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-amber-50/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-rose-500/50 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-pink-500"></div>
            <div className="p-6 md:p-8 flex flex-col gap-4 text-center">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest">
                {t('lobby.leaveRoomTitle')}
              </h3>
              <p className="text-slate-600 font-medium text-sm">{t('lobby.leaveRoomDesc')}</p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 bg-amber-100 hover:bg-amber-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-all border border-amber-300"
                >
                  {t('lobby.cancel')}
                </button>
                <button
                  onClick={() => {
                    leaveRoom();
                    setShowLeaveModal(false);
                  }}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-rose-500/20"
                >
                  {t('lobby.confirmLeave')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-amber-50/80 backdrop-blur-sm p-4">
          <div className="bg-white border border-purple-500/50 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
            <div className="p-6 md:p-8 flex flex-col items-center gap-4 text-center">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest">
                {t('lobby.invitePlayers')}
              </h3>
              <p className="text-slate-600 font-medium text-sm mb-2">
                {t('lobby.scanQrCodeDesc')}{' '}
                <span className="text-purple-400 font-bold">{room.code}</span>
              </p>

              <div className="bg-white p-4 rounded-2xl shadow-inner mx-auto mb-2">
                <QRCodeSVG
                  value={`${globalThis.location.origin}/?room=${room.code}`}
                  size={200}
                  bgColor={'#ffffff'}
                  fgColor={'#0f172a'} // slate-900
                  level={'H'}
                />
              </div>

              <button
                onClick={() => setShowQRModal(false)}
                className="w-full bg-amber-100 hover:bg-amber-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-all border border-amber-300 mt-2"
              >
                {t('lobby.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
