export enum SoundsFishyPhase {
  SETUP = 'SETUP',
  SUBMISSION = 'SUBMISSION',
  THE_PITCH = 'THE_PITCH',
  THE_HUNT = 'THE_HUNT',
  SCORING = 'SCORING',
}

export interface SoundsFishyQuestionData {
  id: string;
  question: string;
  answer: string;
  lang: string;
}

export interface SoundsFishyPlayerAnswer {
  playerId: string;
  answer: string;
  isRevealed: boolean;
}

export interface SoundsFishyState {
  currentPhase: SoundsFishyPhase;
  pickerId: string | null;
  blueFishId: string | null;
  redHerringIds: string[];
  question: SoundsFishyQuestionData | null;
  playerAnswers: Record<string, SoundsFishyPlayerAnswer>;
  eliminatedPlayers: string[];
  roundScorePool: number;
  roundPoints: Record<string, number>;
  typingAnswers: Record<string, string>;
}
