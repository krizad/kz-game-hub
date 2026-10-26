# 0015. Werewolf local party hostless

Status: Accepted
Date: 2026-10-25

## Context

The hub needs a social deduction game played face to face around one table (6–12 players in v1) where every player uses their own phone and no human game master exists. The server must run the whole night/day cycle, and a shared narrator device announces phases aloud. Secret roles mean every design choice either leaks or protects information, and the choices are protocol-level: changing them later breaks live rooms, tests, and recorded results.

## Decision

- New identity `GameType.WEREWOLF` (display names: มนุษย์หมาป่า / Werewolf), following the sibling social deduction games rather than ADR 0006's mode pattern. Seats are 6–12; extra joiners are spectators.
- Fixed nightly wake order **Werewolves → Seer → Doctor → Witch**. The Werewolves wake first so the Witch can learn the night's victim before deciding to heal; the order is never varied, so timing itself carries no information. A wake is skipped silently when its role group is dead or has nothing left to use.
- Wolf reveal mode `EYE_CONTACT` (wolves look at each other across the real table; phones never carry the roster) or `PRIVATE_ROSTER` (roster sent privately; eyes stay closed). Wolf coordination mode `SECRET_BALLOT` (hidden plurality, tie = no kill), `LIVE_TALLY` (same vote with running results visible to wolves only), or `SILENT_CONSENSUS` (kill only if every living wolf submits the same target). All six combinations are valid; the lobby validates enums only.
- Every timeout resolves as **no action** (no kill, no check, no heal, no poison, no shot) — deterministic and AFK-safe. Day vote: plurality lynched, tie = no lynch, abstain allowed, no self-vote, live progress shows only the count of votes cast.
- Role composition is generated: 2 wolves (6–9 players) or 3 (10–12); Seer always present, Doctor from 7, Witch from 8 and Hunter from 9 with host toggles; validation requires wolves ≥ 1 and wolves < living others. Special-role edge rules: Witch sees the victim before choosing, cannot self-heal, owns one heal and one poison (poison is unhealable); Doctor may self-heal but never the same target twice in a row; the Hunter shoots on any death except Witch poison, shots resolving before the win check.
- Death **immediately reveals the role** to the whole table (casual party standard), while dead players otherwise keep a ghost view of public information only until the match ends.
- Win condition is parity: wolves win when living wolves equal or outnumber all other living players; the village wins when no wolf remains. Winners score +1 each through the standard result recording.
- Disconnect handling borrows the Dog Relay pattern: a phase whose required actor is disconnected auto-pauses (timer frozen, 60s per-player grace, remaining time restored on return); grace expiry means elimination **without revealing the role**; if the match can no longer finish it returns to the lobby with no recorded result. There is no manual pause in v1.
- Narration is **TTS-first**: `speechSynthesis` in the room language with on-screen captions, an audio readiness check on the narrator screen, and a wav-pack override hook reserved for later. Narration carries only public information and never gates play.

## Consequences

All secrets (roles, rosters, night actions, votes) live in the private-state store; the public state carries phases, timers, and revealed deaths only. The server must therefore resolve every night silently and broadcast the same state shape to wolves and villagers — audits for leakage become part of the test suite. Skipping wakes means narrator lines are generated from state, not from a fixed script index. TTS-first means voice quality varies by device; the narrator screen's readiness check and captions are the mitigation, and narration failures must never stall the game loop.
