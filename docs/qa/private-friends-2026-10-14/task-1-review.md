# Task 1 review — 47f4c9fe

Reviewer private_room_policy_review_retry; spec issues found, quality Needs fixes.

Important1: games.gateway.ts335 seated exception checks socket ID or valid token without matching name. GamesService.joinRoom275 restores token only with matching name; otherwise creates new viewer391. A seated socket/new name or valid token/different name bypasses disabled spectator admission. Align guard with actual identity outcome; add real-service regression.

Important2: useGameStore.ts444 clears current client room on SPECTATORS_DISABLED, while gateway rejects target before leavePreviousRoom1568. Failed attempt to spectate disabled B while already in A must preserve A session, clearing only optimistic attempted spectator state.

Strengths: new defaults/legacy fallbacks, runtime enum and boolean sanitizer, host LOBBY gate, public filtering/rebroadcast, localized native controls and token-free links. Browser policy test covers viewport/language assertions. Existing mocked DB/dev startup warning output documented; no new warning defect identified. Reviewer did not rerun tests.
