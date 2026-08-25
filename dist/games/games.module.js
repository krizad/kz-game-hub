"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamesModule = void 0;
const common_1 = require("@nestjs/common");
const games_gateway_1 = require("./games.gateway");
const games_service_1 = require("./games.service");
const who_know_service_1 = require("./who-know/who-know.service");
const tic_tac_toe_service_1 = require("./tic-tac-toe/tic-tac-toe.service");
const rps_service_1 = require("./rps/rps.service");
const gobbler_service_1 = require("./gobbler/gobbler.service");
const sounds_fishy_service_1 = require("./sounds-fishy/sounds-fishy.service");
const detective_club_service_1 = require("./detective-club/detective-club.service");
const who_am_i_service_1 = require("./who-am-i/who-am-i.service");
const leaderboard_service_1 = require("./leaderboard/leaderboard.service");
const who_first_service_1 = require("./who-first/who-first.service");
const music_trivia_service_1 = require("./music-trivia/music-trivia.service");
const the_mind_service_1 = require("./the-mind/the-mind.service");
const saboteur_service_1 = require("./saboteur/saboteur.service");
const player_session_service_1 = require("./player-session.service");
const room_timer_service_1 = require("./room-timer.service");
const private_state_service_1 = require("./private-state.service");
let GamesModule = class GamesModule {
};
exports.GamesModule = GamesModule;
exports.GamesModule = GamesModule = __decorate([
    (0, common_1.Module)({
        providers: [
            games_gateway_1.GamesGateway,
            games_service_1.GamesService,
            who_know_service_1.WhoKnowService,
            tic_tac_toe_service_1.TicTacToeService,
            rps_service_1.RPSService,
            gobbler_service_1.GobblerService,
            sounds_fishy_service_1.SoundsFishyService,
            detective_club_service_1.DetectiveClubService,
            who_am_i_service_1.WhoAmIService,
            leaderboard_service_1.LeaderboardService,
            who_first_service_1.WhoFirstService,
            music_trivia_service_1.MusicTriviaService,
            the_mind_service_1.TheMindService,
            saboteur_service_1.SaboteurService,
            player_session_service_1.PlayerSessionService,
            room_timer_service_1.RoomTimerService,
            private_state_service_1.PrivateStateService,
        ],
    })
], GamesModule);
//# sourceMappingURL=games.module.js.map