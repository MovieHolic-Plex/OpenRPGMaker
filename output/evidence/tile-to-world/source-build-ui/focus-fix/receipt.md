# V-INPUT-RERENDER-FOCUS

Independent RED preserved (`independent/VisualFixVerify.json`, `independent/boundary-fix-focus.test.ts`).
This run RED: `focus-fix/red.log` — focused false, caret 13 vs 6.

Fix: seed/map/rect/entry `input`/`change` update chrome state and `syncSpatialBuildEnabled()` only. They do not call Database `onChange` / remount. Project-key bind, empty-seed, and pre-pin numeric guards unchanged.

Permanent probe: `test/spatialSourceBuildUiFocus.test.ts` (same assertion as independent focus test).
Keyboard: `focus-fix/*-keyboard.png` + `keyboard-qa.json` PASS on :44207.

Previous visual-fix layout receipts are not this run.
No stage/commit.
