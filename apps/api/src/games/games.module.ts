import { Module } from '@nestjs/common';
import { GamesGateway } from './games.gateway';
import { GamesService } from './games.service';
import { WhoKnowService } from './who-know/who-know.service';
import { TicTacToeService } from './tic-tac-toe/tic-tac-toe.service';
import { RPSService } from './rps/rps.service';
import { GobblerService } from './gobbler/gobbler.service';
import { SoundsFishyService } from './sounds-fishy/sounds-fishy.service';
import { DetectiveClubService } from './detective-club/detective-club.service';
import { WhoAmIService } from './who-am-i/who-am-i.service';
import { LeaderboardService } from './leaderboard/leaderboard.service';
import { WhoFirstService } from './who-first/who-first.service';
import { MusicTriviaService } from './music-trivia/music-trivia.service';
import { TheMindService } from './the-mind/the-mind.service';
import { SaboteurService } from './saboteur/saboteur.service';
import { CoupService } from './coup/coup.service';
import { PlayerSessionService } from './player-session.service';
import { RoomTimerService } from './room-timer.service';
import { PrivateStateService } from './private-state.service';

@Module({
  providers: [
    GamesGateway,
    GamesService,
    WhoKnowService,
    TicTacToeService,
    RPSService,
    GobblerService,
    SoundsFishyService,
    DetectiveClubService,
    WhoAmIService,
    LeaderboardService,
    WhoFirstService,
    MusicTriviaService,
    TheMindService,
    SaboteurService,
    CoupService,
    PlayerSessionService,
    RoomTimerService,
    PrivateStateService,
  ],
})
export class GamesModule {}
