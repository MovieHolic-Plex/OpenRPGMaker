# Actual Electron launcher QA — 2026-10-03

Run `xvfb-run -a node scripts/qa/interview-desktop.mjs` after packaged renderer and Electron builds. An isolated user-data profile and `OPRN_NEW_PROJECT_ROOT` keep this separate from user projects.

Passed: actual `app://oprn/start-screen.html` New Game -> isolated SQLite folder -> actual production four-genre interview -> monster question -> cancel. No page errors. `report.json` includes the opened project id and exact folder. No AI request was launched from this cancel path.

The harness must DELETE `OPRN_OPEN_PROJECT_DIR`, not set it to an empty string: Electron treats any defined value as an editor-open request. An initial faulty QA invocation with the empty variable was corrected; its accidental workspace-root SQLite/media artifacts were moved to ignored `output/qa/interview-desktop/accidental-root-open/` and are not part of the change.
