import { PrivateStateService } from '../private-state.service';
import { ArtistPresetService } from '../artist-preset.service';
import { MusicTriviaAction, MusicTriviaLevel, MusicTriviaState, MusicTriviaSyncPlayPayload, RoomState } from '@repo/types';
import { TrackResult } from './music-source-adapter';
export type MusicTriviaTimerName = 'music-trivia-countdown' | 'music-trivia-answer';
export type MusicTriviaTimerCommand = {
    kind: 'SCHEDULE';
    name: MusicTriviaTimerName;
    deadline: number;
} | {
    kind: 'CANCEL';
    name: MusicTriviaTimerName;
};
interface PresetTrackCandidate {
    track: TrackResult;
    viewCount: number;
}
export interface MusicTriviaActionResult {
    room: RoomState;
    syncPlay?: MusicTriviaSyncPlayPayload;
    trackAnswerTo?: {
        socketId: string;
        roundNumber: number;
    };
    hostAnswerTo?: {
        socketId: string;
        title: string;
        artist: string;
        artworkUrl?: string;
        trackViewUrl?: string;
    };
    timerCommands?: MusicTriviaTimerCommand[];
}
export declare class MusicTriviaService {
    private readonly privateState;
    private readonly artistPresets;
    private readonly logger;
    private sourceFactory;
    constructor(privateState: PrivateStateService, artistPresets: ArtistPresetService);
    startGame(room: RoomState, requesterId: string): RoomState | null;
    handleGameAction(room: RoomState, clientId: string, action: MusicTriviaAction): Promise<MusicTriviaActionResult | null>;
    resetGame(room: RoomState, requesterId: string): RoomState | null;
    deleteRoomData(roomCode: string): void;
    remapSocketId(state: MusicTriviaState, oldId: string, newId: string): void;
    private playerReady;
    private startCountdown;
    finalizeCountdown(room: RoomState): MusicTriviaActionResult | null;
    private configureSource;
    private configureFromPreset;
    selectPresetTracks(candidates: PresetTrackCandidate[], level: MusicTriviaLevel, totalRounds: number): TrackResult[];
    private finalizeSelection;
    private startRound;
    private pressBuzzer;
    answerTimeout(room: RoomState): MusicTriviaActionResult | null;
    private strikeOutPlayer;
    private setRevealedAnswer;
    private getTrackAnswer;
    private resumePlayback;
    private buildSyncPlay;
    private giveUp;
    private submitAnswer;
    private hostJudge;
    private revealAnswer;
    private nextRound;
    private endGame;
    private advanceToNextRound;
    private createRound;
    private allPlayersStruckOut;
    private getFullTracks;
    private levenshteinDistance;
    fuzzyMatch(input: string, target: string): boolean;
}
export {};
