# Monster field medicine: focused native review

2026-10-03, isolated worktree. No suites, gates, or full typecheck run.
No canonical SQLite or remote project writes.

- `native-review.json`: native functions exercised with the exported campaign project.
  HP recovery, actor vitals unchanged, status/turn cleanup, full/fainted rejection,
  allAllies single inventory use, PP caps and no-op rejection, project serialize/load,
  and an actual Gen1 PP-only item action with PP narration.
- `browser-review.json`: exported `player.html` through `startPlayerQaServer`, from a
  native saved-session fixture. Real keyboard navigation opened items and selected
  party monster targets. HP changed 1→21 with one copy consumed; known move PP changed
  1→11 without changing HP. Browser reported zero page errors.
- `01-monster-hp-targets.png`: both party monsters, individual HP recovery preview.
- `02-monster-pp-targets.png`: PP restoration preview, full-PP second monster disabled.

Both screenshots were visually inspected: target names, levels, HP, and the PP footer
remain readable with no overlap. Fixture setup used temporary files only.
