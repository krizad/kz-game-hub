import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GamesService } from './games.service';
import { LeaderboardService } from './leaderboard/leaderboard.service';
import { RoomTimerService } from './room-timer.service';
import { PrivateStateService } from './private-state.service';
import { RoomState, GameType, RPSChoice } from '@repo/types';
export declare class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly gamesService;
    private readonly leaderboardService;
    private readonly roomTimerService;
    private readonly privateStateService;
    server: Server;
    private readonly recordedResults;
    constructor(gamesService: GamesService, leaderboardService: LeaderboardService, roomTimerService: RoomTimerService, privateStateService: PrivateStateService);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleLeaveRoom(client: Socket): void;
    handleGetAvailableRooms(client: Socket): void;
    handleCreateRoom(data: {
        name: string;
        gameType?: GameType;
    }, client: Socket): void;
    handleJoinRoom(data: {
        code: string;
        name: string;
        reconnectToken?: string;
    }, client: Socket): void;
    handleStartGame(data: {
        code: string;
    }, client: Socket): Promise<void>;
    handleSetWord(data: {
        code: string;
        word: string;
    }, client: Socket): void;
    handleStopTimer(data: {
        code: string;
    }, client: Socket): void;
    handleEndQuestioning(data: {
        code: string;
        timeout?: boolean;
    }, client: Socket): void;
    handleSubmitVote(data: {
        code: string;
        targetId: string;
    }, client: Socket): void;
    handleResetGame(data: {
        code: string;
    }, client: Socket): void;
    handleUpdateConfig(data: {
        code: string;
        config: Partial<RoomState['config']>;
    }, client: Socket): void;
    handleTTTJoinSide(data: {
        code: string;
        side: 'X' | 'O';
    }, client: Socket): void;
    handleTTTMakeMove(data: {
        code: string;
        index: number;
    }, client: Socket): void;
    handleTTTReset(data: {
        code: string;
    }, client: Socket): void;
    handleRPSNextRound(data: {
        code: string;
    }, client: Socket): void;
    handleRPSMakeChoice(data: {
        code: string;
        choice: RPSChoice;
    }, client: Socket): void;
    handleRPSReset(data: {
        code: string;
    }, client: Socket): void;
    handleGobblerJoinSide(data: {
        code: string;
        side: 'X' | 'O';
    }, client: Socket): void;
    handleGobblerPlace(data: {
        code: string;
        pieceId: string;
        toIndex: number;
    }, client: Socket): void;
    handleGobblerMove(data: {
        code: string;
        fromIndex: number;
        toIndex: number;
    }, client: Socket): void;
    handleGobblerReset(data: {
        code: string;
    }, client: Socket): void;
    handleSoundsFishyTypeAnswer(data: {
        code: string;
        answer: string;
    }, client: Socket): void;
    handleSoundsFishySubmitAnswer(data: {
        code: string;
        answer: string;
    }, client: Socket): void;
    handleSoundsFishyRevealAnswer(data: {
        code: string;
        targetId: string;
    }, client: Socket): void;
    handleSoundsFishyEliminatePlayer(data: {
        code: string;
        targetId: string;
    }, client: Socket): void;
    handleSoundsFishyBankPoints(data: {
        code: string;
    }, client: Socket): void;
    handleSoundsFishyNextRound(data: {
        code: string;
    }, client: Socket): void;
    handleSoundsFishyReset(data: {
        code: string;
    }, client: Socket): void;
    handleDetectiveClubSubmitWord(data: {
        code: string;
        word: string;
    }, client: Socket): void;
    handleDetectiveClubPlayCard(data: {
        code: string;
        cardIndex: number;
    }, client: Socket): void;
    handleDetectiveClubNextPhase(data: {
        code: string;
    }, client: Socket): void;
    handleDetectiveClubVote(data: {
        code: string;
        targetId: string;
    }, client: Socket): void;
    handleDetectiveClubNextRound(data: {
        code: string;
    }, client: Socket): void;
    handleDetectiveClubReset(data: {
        code: string;
    }, client: Socket): void;
    handleWhoAmISubmitWords(data: {
        code: string;
        playerWords: Record<string, string>;
    }, client: Socket): void;
    handleWhoAmISubmitPlayerWord(data: {
        code: string;
        word: string;
    }, client: Socket): void;
    handleWhoAmIGetCategories(data: {
        lang?: string;
    }, client: Socket): Promise<void>;
    handleGameAction(data: {
        code: string;
        action: Record<string, unknown>;
    }, client: Socket): Promise<void>;
    handleTheMindReady(data: {
        code: string;
    }, client: Socket): void;
    handleTheMindPlayCard(data: {
        code: string;
        card: number;
        pile?: 'UP' | 'DOWN';
    }, client: Socket): void;
    handleTheMindNextLevel(data: {
        code: string;
    }, client: Socket): void;
    handleTheMindProposeShuriken(data: {
        code: string;
    }, client: Socket): void;
    handleTheMindVoteShuriken(data: {
        code: string;
        agree: boolean;
    }, client: Socket): void;
    handleTheMindCancelShuriken(data: {
        code: string;
    }, client: Socket): void;
    handleLeaderboardGet(data: {
        gameType?: string;
    }, client: Socket): Promise<void>;
    handleSpectateJoin(data: {
        code: string;
        name: string;
    }, client: Socket): void;
    private broadcastRoomState;
    private emitPrivateStates;
    private emitSessionToken;
    private syncWhoFirstTimer;
    private syncWhoKnowTimer;
    private syncTheMindTimer;
    private isValidPayload;
    private isValidName;
    private hasSafeValues;
    private maybeRecordGameResult;
    private calculateRank;
}
