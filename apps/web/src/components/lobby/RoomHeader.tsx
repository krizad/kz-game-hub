'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { GameType } from '@repo/types';
import { toast } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslate } from '@/hooks/useTranslate';
import { LanguageSwitcher } from '@/components/core/LanguageSwitcher';
import { RulesModal } from '@/components/RulesModal';

export function RoomHeader() {
  const { room, leaveRoom } = useGameStore();
  const { t } = useTranslate();

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  if (!room) return null;

  return (
    <>
      <header className="flex-none flex items-center justify-between gap-4 p-2 sm:p-4 bg-white border-4 border-black shadow-[4px_4px_0_0_#000] z-10 w-full">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap w-full">
          <img
            src="/icon.png"
            alt="Logo"
            className="w-8 h-8 rounded-lg border-2 border-black shadow-[2px_2px_0_0_#000]"
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
                              : room.gameType === GameType.THE_MIND
                                ? 'The Mind'
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
            className="bg-[#A3E635] hover:bg-[#84cc16] text-black border-2 border-black font-bold px-2.5 py-1.5 rounded-lg shadow-[2px_2px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all text-xs flex items-center gap-1.5 sm:ml-2"
            title={t('lobby.copyLink')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
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
            className="bg-[#C084FC] hover:bg-[#A855F7] text-black border-2 border-black font-bold px-2.5 py-1.5 rounded-lg shadow-[2px_2px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all text-xs flex items-center gap-1.5 ml-1"
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
          <RulesModal
            defaultGameType={room.gameType}
            isGameRoom={true}
            triggerClassName="text-sm font-black text-black hover:bg-yellow-300 bg-white transition-colors flex items-center gap-2 px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none text-nowrap"
          />
          <button
            onClick={() => setShowLeaveModal(true)}
            className="bg-[#F43F5E] hover:bg-[#E11D48] text-white border-2 border-black px-3 py-1.5 rounded-lg font-bold text-xs sm:text-sm shadow-[2px_2px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1.5 whitespace-nowrap"
            title={t('lobby.leave')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#FEF08A] border-4 border-black w-full max-w-sm shadow-[8px_8px_0_0_#000] relative animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8 flex flex-col gap-4 text-center">
              <h3 className="text-2xl font-black text-black uppercase tracking-widest bg-white border-2 border-black py-2 rounded-md shadow-[2px_2px_0_0_#000]">
                {t('lobby.leaveRoomTitle')}
              </h3>
              <p className="text-black font-bold text-sm bg-white p-2 rounded border border-black/20">
                {t('lobby.leaveRoomDesc')}
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 bg-white hover:bg-gray-100 text-black border-2 border-black font-black py-3 px-4 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px]"
                >
                  {t('lobby.cancel')}
                </button>
                <button
                  onClick={() => {
                    leaveRoom();
                    setShowLeaveModal(false);
                  }}
                  className="flex-1 bg-[#F43F5E] hover:bg-[#E11D48] text-white border-2 border-black font-black py-3 px-4 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px]"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#C084FC] border-4 border-black w-full max-w-sm shadow-[8px_8px_0_0_#000] relative animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 md:p-8 flex flex-col items-center gap-4 text-center">
              <h3 className="text-2xl font-black text-black uppercase tracking-widest w-full bg-white border-2 border-black py-2 rounded-md shadow-[2px_2px_0_0_#000]">
                {t('lobby.invitePlayers')}
              </h3>
              <p className="text-black font-bold text-sm bg-white p-2 rounded border border-black/20 w-full">
                {t('lobby.scanQrCodeDesc')}{' '}
                <span className="text-black font-black bg-white px-1 border border-black rounded">
                  {room.code}
                </span>
              </p>

              <div className="bg-white p-4 border-4 border-black shadow-[4px_4px_0_0_#000] mx-auto mb-2">
                <QRCodeSVG
                  value={`${globalThis.location.origin}/?room=${room.code}`}
                  size={200}
                  bgColor={'#ffffff'}
                  fgColor={'#000000'}
                  level={'H'}
                />
              </div>

              <button
                onClick={() => setShowQRModal(false)}
                className="w-full bg-[#A3E635] hover:bg-[#84cc16] text-black border-2 border-black font-black py-3 px-4 transition-all shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] mt-2"
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
