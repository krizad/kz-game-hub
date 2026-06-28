// Music Trivia — multiplayer guess-the-song game (buzzer-based).

export type MusicTriviaPhase =
  | 'SETUP' // Host configures music source & settings
  | 'LOADING' // Server fetching tracks
  | 'PLAYING' // Music playing, waiting for buzzer
  | 'BUZZED' // Someone buzzed, music paused
  | 'ANSWERING' // Buzzed player is answering (typing or verbal)
  | 'ANSWER_RESULT' // Showing if answer was correct/wrong
  | 'REVEAL' // Host revealed the answer (no winner)
  | 'ROUND_RESULT' // Showing round scores
  | 'FINISHED'; // Game over

export type MusicSourceType = 'ITUNES' | 'SPOTIFY' | 'YOUTUBE';

export type MusicTriviaMode = 'TYPING' | 'GAME_MASTER';

// Public track info — no answer spoilers (title + artist kept server-side).
export interface MusicTriviaTrack {
  id: string;
  previewUrl: string; // Audio URL or YouTube videoId
  sourceType: MusicSourceType;
  durationMs: number;
  artworkUrl?: string;
}

export interface BuzzerPress {
  playerId: string;
  timestamp: number;
  reactionTimeMs: number;
}

// Per-round state (broadcast-safe)
export interface MusicTriviaRound {
  roundNumber: number;
  track: MusicTriviaTrack;
  buzzerPresses: BuzzerPress[];
  currentBuzzerId: string | null;
  struckOutIds: string[]; // Players who answered wrong this round
  answeredCorrectly: boolean;
  winnerId: string | null;
}

// History entry — safe to reveal after each round.
export interface MusicTriviaRoundHistory {
  roundNumber: number;
  winnerId: string | null;
  trackTitle: string;
  artistName: string;
  artworkUrl?: string;
  trackViewUrl?: string;
}

// Main game state (broadcast-safe — no answer spoilers in here)
export interface MusicTriviaState {
  phase: MusicTriviaPhase;
  mode: MusicTriviaMode;
  sourceType: MusicSourceType;
  totalRounds: number;
  currentRound: MusicTriviaRound | null;
  roundHistory: MusicTriviaRoundHistory[];
  scores: Record<string, number>; // playerId → total points (1 per correct)
  hostPlays: boolean;
  answerTimeoutMs: number;
  playStartTime?: number; // Server-set timestamp when current clip started/resumed
  errorMessage?: string; // Add errorMessage to handle source config failures
  pausedAtMs?: number; // Server-set timestamp when play was paused (for buzzer)
  revealedAnswer?: {
    title: string;
    artist: string;
    artworkUrl?: string;
    trackViewUrl?: string;
  };
}

// Action types — sent via the shared GAME_ACTION event.
export type MusicTriviaActionType =
  | 'CONFIGURE_SOURCE' // Host sets source + query and starts fetching
  | 'START_ROUND' // Host starts playing music (used internally after configure + next round)
  | 'PRESS_BUZZER' // Player presses buzzer
  | 'SUBMIT_ANSWER' // Typing mode: buzzed player submits text
  | 'HOST_JUDGE' // GM mode: host approves/rejects
  | 'REVEAL_ANSWER' // Host reveals answer (skip / no winner)
  | 'NEXT_ROUND' // Host advances to next round
  | 'END_GAME'; // Host ends game early

export interface MusicTriviaAction {
  type: MusicTriviaActionType;
  query?: string; // CONFIGURE_SOURCE
  sourceType?: MusicSourceType; // CONFIGURE_SOURCE
  searchOptions?: {
    country?: string;
    attribute?: string;
  };
  answer?: string; // SUBMIT_ANSWER
  correct?: boolean; // HOST_JUDGE
}

// Server→client private payload delivered to the buzzed player (Typing mode)
// so they can see the answer they're trying to match is hidden from them —
// actually this is just empty/unused for typing; kept for forward-compat.
export interface MusicTriviaTrackAnswerPayload {
  roundNumber: number;
  // Intentionally empty — answers are private; the player must GUESS the title/artist.
}

// Emitted privately to the host in GAME_MASTER mode so they can judge
export interface MusicTriviaHostAnswerPayload {
  title: string;
  artist: string;
  artworkUrl?: string;
  trackViewUrl?: string;
}

// Broadcast payload for sync_play — clients use playStartTime to sync playback.
export interface MusicTriviaSyncPlayPayload {
  roundNumber: number;
  playStartTime: number;
  previewUrl: string;
  sourceType: MusicSourceType;
  durationMs: number;
  artworkUrl?: string;
}
