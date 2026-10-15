# 0010. Dig Doggo as a Second Native Hub Game

Status: Accepted  
Date: 2026-10-15

KZ Game Hub will add `DIG_DOGGO` as a separate game alongside the existing `SABOTEUR`, porting Dig Doggo's deterministic game core while keeping Hub's Socket.io transport, room lifecycle, and in-memory server authority. Saboteur code, UI, rules, settings, assets, and leaderboard identity remain active and separate. Dig Doggo gets its own enabled-by-default setting and leaderboard identity; Practice/Bots and Discord Activity stay out of the first delivery. `dig-doggo/docs/game-rules.md` is authoritative: add regression cases for known source-core differences and fix only behaviors the rules confirm, leaving undocumented edge cases unchanged until clarified.
