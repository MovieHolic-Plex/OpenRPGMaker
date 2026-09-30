# Project first run — 2026-10-01

## Browser evidence

- `01-launcher.png`: three playable example starts plus explicit blank and AI planning paths.
- `02-setup.png`: example details, name/location, and folded screen-size settings.
- `03-interview-receipt.png`: submitted answer and three visible preparation stages.
- `04-interview-next.png`: the previous answer receipt, question progress, and accumulated planning answers.
- `05-editor-guide.png`: first editing guide in the existing right dock.
- `06-dialogue-reloaded.png`: edited dialogue restored after reloading the canonical project.

Launcher/interview captures use the worktree dev launcher at port 9858. The launcher capture has no desktop bridge; its desktop-only notice is expected. Interview cancellation during a transition was checked: the modal stayed closed and no browser errors occurred.

Editor captures use the production renderer and the native SQLite browser bridge at port 9861. The project is a newly created local proof folder, not an existing user's project. The save button was used and its actual `saved` status was awaited before reload. `sqlite-proof.json` records the project id, folder, restored dialogue, and browser error result.

All three example factories (monster collection, story, adventure) produced two maps and seven events, with the first-run flag. The existing playable-segment automatic judgement accepted each generated example. This is the factory's own creation check; these captures do not claim exported-player runtime QA.

`npm run build:fast` completed. Per this session's AGENTS restriction, gates, Vitest, and full typecheck were not run. Regression cases were updated for the new chooser and interview timing/cancellation.
