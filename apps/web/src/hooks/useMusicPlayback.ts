import { useCallback, useEffect, useRef, useState } from 'react';
import type { MusicTriviaPhase, MusicTriviaSyncPlayPayload } from '@repo/types';
import type ReactPlayer from 'react-player';

export type MusicPlaybackStatus = 'loading' | 'ready' | 'playing' | 'blocked' | 'error';
export type MusicPlaybackReason = 'AUTOPLAY_BLOCKED' | 'NETWORK_OR_PROVIDER' | 'EXPIRED_CLIP';

/** Local media state only. The sync payload contains no answer or artist data. */
export function useMusicPlayback(
  syncPlay: MusicTriviaSyncPlayPayload | null,
  phase: MusicTriviaPhase | undefined,
  enabled: boolean,
  serverOffsetMs = 0,
) {
  const [status, setStatus] = useState<MusicPlaybackStatus>('ready');
  const [reason, setReason] = useState<MusicPlaybackReason | null>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [paused, setPaused] = useState(false);
  const [providerAttempt, setProviderAttempt] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSettingsRef = useRef({ volume, muted });
  audioSettingsRef.current = { volume, muted };
  const providerRef = useRef<ReactPlayer | null>(null);
  const attemptRef = useRef(0);
  const lastSyncRef = useRef<MusicTriviaSyncPlayPayload | null>(null);
  const currentRef = useRef({ syncPlay, phase, enabled, paused, serverOffsetMs });
  currentRef.current = { syncPlay, phase, enabled, paused, serverOffsetMs };

  const elapsedSeconds = useCallback(() => {
    const current = currentRef.current;
    if (!current.syncPlay) return 0;
    return Math.max(
      0,
      (Date.now() + current.serverOffsetMs - current.syncPlay.playStartTime) / 1000,
    );
  }, []);

  const isExpired = useCallback(() => {
    const clip = currentRef.current.syncPlay;
    return !!clip && elapsedSeconds() * 1000 >= clip.durationMs;
  }, [elapsedSeconds]);

  const markExpired = useCallback(() => {
    attemptRef.current++;
    audioRef.current?.pause();
    const player = providerRef.current?.getInternalPlayer();
    if (player?.pauseVideo) player.pauseVideo();
    else if (player?.pause) player.pause();
    setStatus('error');
    setReason('EXPIRED_CLIP');
  }, []);

  const playNative = useCallback(() => {
    const clip = currentRef.current.syncPlay;
    if (
      !clip ||
      currentRef.current.phase !== 'PLAYING' ||
      !currentRef.current.enabled ||
      currentRef.current.paused
    )
      return;
    if (isExpired()) {
      markExpired();
      return;
    }
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(clip.previewUrl);
      audioRef.current = audio;
      audio.addEventListener('error', () => {
        const current = currentRef.current;
        if (current.phase !== 'PLAYING' || !current.enabled || current.paused) return;
        if (
          current.syncPlay?.sourceType === 'YOUTUBE' ||
          current.syncPlay?.sourceType === 'SOUNDCLOUD'
        )
          return;
        if (isExpired()) {
          markExpired();
          return;
        }
        setStatus('error');
        setReason('NETWORK_OR_PROVIDER');
      });
      audio.addEventListener('ended', () => {
        markExpired();
      });
    } else if (audio.src !== clip.previewUrl) {
      audio.src = clip.previewUrl;
    }
    if (lastSyncRef.current !== clip) {
      try {
        const elapsed = elapsedSeconds();
        if (elapsed > 0) {
          audio.currentTime = elapsed;
        }
      } catch {
        // Audio element may not seek before metadata is loaded
      }
      lastSyncRef.current = clip;
    }
    audio.volume = audioSettingsRef.current.volume;
    audio.muted = audioSettingsRef.current.muted;
    const attempt = ++attemptRef.current;
    setStatus('loading');
    setReason(null);
    audio
      .play()
      .then(() => {
        if (attempt !== attemptRef.current) return;
        if (isExpired()) markExpired();
        else if (
          currentRef.current.phase === 'PLAYING' &&
          currentRef.current.enabled &&
          !currentRef.current.paused
        ) {
          setStatus('playing');
          setReason(null);
        }
      })
      .catch((error: unknown) => {
        if (attempt !== attemptRef.current) return;
        const current = currentRef.current;
        if (current.phase !== 'PLAYING' || !current.enabled || current.paused) return;
        const err = error as { name?: string } | null;
        if (err?.name === 'AbortError') return;
        const isNotAllowed = err?.name === 'NotAllowedError';
        setStatus(isNotAllowed ? 'blocked' : 'error');
        setReason(isNotAllowed ? 'AUTOPLAY_BLOCKED' : 'NETWORK_OR_PROVIDER');
      });
  }, [elapsedSeconds, isExpired, markExpired]);

  useEffect(() => {
    if (!syncPlay || phase !== 'PLAYING' || !enabled || paused) {
      attemptRef.current++;
      audioRef.current?.pause();
      setStatus('ready');
      setReason(null);
      return;
    }
    if (isExpired()) {
      markExpired();
      return;
    }
    if (syncPlay.sourceType === 'YOUTUBE' || syncPlay.sourceType === 'SOUNDCLOUD') {
      audioRef.current?.pause();
      setStatus('loading');
      setReason(null);
    } else {
      playNative();
    }
  }, [syncPlay, phase, enabled, paused, isExpired, markExpired, playNative]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  useEffect(() => {
    if (phase !== 'PLAYING' || !syncPlay || !enabled) return;
    const remaining = syncPlay.durationMs - (Date.now() + serverOffsetMs - syncPlay.playStartTime);
    if (remaining <= 0) {
      markExpired();
      return;
    }
    const timer = window.setTimeout(markExpired, remaining);
    return () => window.clearTimeout(timer);
  }, [syncPlay, phase, enabled, serverOffsetMs, markExpired]);

  useEffect(
    () => () => {
      attemptRef.current++;
      audioRef.current?.pause();
      const player = providerRef.current?.getInternalPlayer();
      if (player?.pauseVideo) player.pauseVideo();
      else if (player?.pause) player.pause();
    },
    [],
  );

  const retry = useCallback(() => {
    if (
      !currentRef.current.syncPlay ||
      currentRef.current.phase !== 'PLAYING' ||
      !currentRef.current.enabled
    )
      return;
    if (isExpired()) {
      markExpired();
      return;
    }
    setPaused(false);
    currentRef.current.paused = false;
    const clip = currentRef.current.syncPlay;
    if (clip.sourceType === 'YOUTUBE' || clip.sourceType === 'SOUNDCLOUD') {
      setStatus('loading');
      setReason(null);
      const player = providerRef.current?.getInternalPlayer();
      try {
        providerRef.current?.seekTo(elapsedSeconds(), 'seconds');
      } catch {
        // Player may not be ready to seek yet
      }
      if (player?.playVideo) player.playVideo();
      else if (player?.play) player.play();
      setProviderAttempt((value) => value + 1);
    } else {
      playNative(); // Called synchronously inside the click gesture.
    }
  }, [elapsedSeconds, isExpired, markExpired, playNative]);

  const onProviderReady = useCallback(() => {
    const current = currentRef.current;
    if (current.phase !== 'PLAYING' || !current.enabled) return;
    if (isExpired()) markExpired();
    else {
      try {
        providerRef.current?.seekTo(elapsedSeconds(), 'seconds');
      } catch {
        // Player may not be ready to seek yet
      }
    }
  }, [elapsedSeconds, isExpired, markExpired]);

  const onProviderPlay = useCallback(() => {
    const current = currentRef.current;
    if (current.phase !== 'PLAYING' || !current.enabled || current.paused) return;
    if (isExpired()) markExpired();
    else {
      setStatus('playing');
      setReason(null);
    }
  }, [isExpired, markExpired]);

  const onProviderError = useCallback(
    (error?: unknown) => {
      const current = currentRef.current;
      if (current.phase !== 'PLAYING' || !current.enabled) return;
      if (isExpired()) {
        markExpired();
        return;
      }
      const err = error as { name?: string; message?: string; data?: number } | null;
      const isAutoplay =
        error === 'AUTOPLAY_BLOCKED' ||
        error === 150 ||
        err?.data === 150 ||
        err?.name === 'NotAllowedError' ||
        String(err?.message || '')
          .toLowerCase()
          .includes('autoplay');
      if (isAutoplay) {
        setStatus('blocked');
        setReason('AUTOPLAY_BLOCKED');
      } else {
        setStatus('error');
        setReason('NETWORK_OR_PROVIDER');
      }
    },
    [isExpired, markExpired],
  );

  const isProvider = syncPlay?.sourceType === 'YOUTUBE' || syncPlay?.sourceType === 'SOUNDCLOUD';
  return {
    status,
    reason,
    retry,
    muted,
    setMuted,
    volume,
    setVolume,
    paused,
    setPaused,
    providerRef,
    providerAttempt,
    providerPlaying:
      !!isProvider &&
      phase === 'PLAYING' &&
      enabled &&
      !paused &&
      status !== 'blocked' &&
      status !== 'error',
    onProviderReady,
    onProviderPlay,
    onProviderError,
  };
}
