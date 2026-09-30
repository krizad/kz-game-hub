import { MusicTriviaLevel } from '@repo/types';
export declare const EASY_MIN_VIEWS = 50000000;
export declare const MEDIUM_MIN_VIEWS = 5000000;
export declare function levelOfViewCount(viewCount: number): MusicTriviaLevel;
export declare const LEVEL_BORROW_ORDER: Record<MusicTriviaLevel, MusicTriviaLevel[]>;
export declare function shuffle<T>(items: T[]): T[];
