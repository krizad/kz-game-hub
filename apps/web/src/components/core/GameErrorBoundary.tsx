'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslate } from '@/hooks/useTranslate';

interface GameErrorBoundaryProps {
  /** Changing roomCode or gameType automatically resets a caught render crash. */
  resetKey: string;
  onLeaveRoom: () => void;
  children: ReactNode;
}

interface GameErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

function GameErrorFallback({
  onRetry,
  onLeaveRoom,
}: {
  onRetry: () => void;
  onLeaveRoom: () => void;
}) {
  const { t } = useTranslate();
  return (
    <section
      data-testid="game-error-boundary"
      role="alert"
      className="flex-1 flex flex-col items-center justify-center gap-4 bg-white border-4 border-black p-6 shadow-[4px_4px_0_0_#000] min-h-[300px] text-center"
    >
      <div className="text-4xl" aria-hidden="true">
        🛠️
      </div>
      <h2 className="text-lg font-black uppercase tracking-wide text-black">
        {t('errorBoundary.gameTitle')}
      </h2>
      <p className="text-sm font-medium text-slate-700 max-w-md">
        {t('errorBoundary.gameDesc')}
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <button
          type="button"
          data-testid="game-error-retry-btn"
          onClick={onRetry}
          className="min-h-11 px-4 py-2 bg-lime-300 hover:bg-lime-400 border-2 border-black font-black shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
        >
          {t('errorBoundary.retryGame')}
        </button>
        <button
          type="button"
          data-testid="game-error-leave-btn"
          onClick={onLeaveRoom}
          className="min-h-11 px-4 py-2 bg-white hover:bg-rose-100 border-2 border-black font-black shadow-[3px_3px_0_0_#000] active:translate-y-0.5 active:shadow-none"
        >
          {t('errorBoundary.leaveRoom')}
        </button>
      </div>
    </section>
  );
}

/**
 * Inner React Error Boundary isolating single-game render crashes while keeping
 * the live Socket.io room session intact (ADR 0018).
 */
export class GameErrorBoundary extends Component<GameErrorBoundaryProps, GameErrorBoundaryState> {
  state: GameErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): GameErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[GameErrorBoundary]', error, info.componentStack);
  }

  componentDidUpdate(prevProps: GameErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: undefined });
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <GameErrorFallback onRetry={this.handleRetry} onLeaveRoom={this.props.onLeaveRoom} />
      );
    }
    return this.props.children;
  }
}
