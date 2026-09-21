# Tile size support QA

Status: passed
Date: 2026-09-21T01:25:14.749Z
Base revision: 2f55fda1903c52f8ec065241b32953b9d237c276 (working-tree changes included)

- 16px editor: actual PNG import, map application, source frame slicing, pointer paint at (5,4), undo/redo passed.
- 32px editor: actual PNG import, map application, source frame slicing, pointer paint at (5,4), undo/redo passed.
- 48px editor: actual PNG import, map application, source frame slicing, pointer paint at (5,4), undo/redo passed.
- 32px player: one step = 32px; solid tile blocks movement; action transfer to 48px passed.
- 48px player: one step = 48px; solid tile blocks movement; action transfer to 16px passed.
- 16px player: one step = 16px; solid tile blocks movement; action transfer to 32px passed.
- Serialize → deserialize → disk reload: passed.
- Import cancel: passed.
- Uncaught browser errors: 0.

즉시 확인: import-48.png, editor-32.png, editor-48.png, runtime-32.png, runtime-48.png.

Synthetic engine contract fixture only; no authored game content or remote persistence. Player runs through player.html/export store shim. This does not claim MV/MZ A1–E autotile format support or exhaustive feature coverage.
