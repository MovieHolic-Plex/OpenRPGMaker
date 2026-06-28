# Visual QA - Verdict: GOOD

Feature: event editor titlebar drag
Route: http://127.0.0.1:5174/?freshProject=1
Viewport: 1600x1000

Evidence:
- 01-editor-open-before-drag.png
- 02-drag-in-progress.png
- 03-editor-after-drag.png
- state.json

Result:
- Modal moved from x=62,y=6 to x=222,y=96.
- Delta was x=160,y=90.
- The condition panel remained visible after the drag.
- The title bar text and close button remained visible and usable.
- No obvious Korean text clipping or overlap appeared in the changed titlebar/condition area.

Completion gate: satisfied.
