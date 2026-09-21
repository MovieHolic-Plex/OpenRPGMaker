# Automatic character scaling QA

Status: passed
Date: 2026-09-21T02:00:50.260Z

Dedicated player.html / export store shim. Existing synthetic tile geometry contract fixture with automatic and manual NPCs and one follower; no authored content or remote writes.

- 32px: player/NPC/follower automatic scale 1; explicit manual 1 and legacy 1.5 preserved. Attack and jump restore the correct scale; action transfer to 48px succeeds.
- 48px: player/NPC/follower automatic scale 2; explicit manual 1 and legacy 1.5 preserved. Attack and jump restore the correct scale; action transfer to 16px succeeds.
- 16px: player/NPC/follower automatic scale 1; explicit manual 1 and legacy 1.5 preserved. Attack and jump restore the correct scale; action transfer to 32px succeeds.

Errors: 0
즉시 확인: runtime-48.png
