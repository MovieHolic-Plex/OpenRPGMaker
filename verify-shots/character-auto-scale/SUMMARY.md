# Automatic character scaling QA

Status: passed
Date: 2026-09-23T21:38:06.495Z

Dedicated player.html / export store shim. Existing synthetic tile geometry contract fixture with automatic and manual NPCs and one follower; no authored content or remote writes.

- 32px: player/NPC/follower automatic world scale 1 (32px reference); explicit manual 1 and legacy 1.5 preserved. Attack and jump restore the correct scale; action transfer to 48px succeeds.
- 48px: player/NPC/follower automatic world scale 1.5 (32px reference); explicit manual 1 and legacy 1.5 preserved. Attack and jump restore the correct scale; action transfer to 16px succeeds.
- 16px: player/NPC/follower automatic world scale 0.5 (32px reference); explicit manual 1 and legacy 1.5 preserved. Attack and jump restore the correct scale; action transfer to 32px succeeds.

Errors: 0
즉시 확인: runtime-16.png
