# NPC Move Route Manual QA Matrix

## Scope

User goal: Korean `이동 유형` and `이동 경로` settings create actually moving NPCs, support complex planned routes, and make every Move Route command function in runtime. Evidence root:

`C:\Users\hyeon\Downloads\rpg-zzu\output\evidence\npc-move-route-all-functions`

## Results

| Scenario | Evidence | Result |
| --- | --- | --- |
| Page movement route dialog is Korean and no longer overlaps options/footer | `ui-fixed-move-route-dialog-wide.png`, `ui-fixed-layout-metrics-wide.json` | PASS |
| Page route authoring saves all expanded MoveCommand families | `green-playwright-event-route-after-quality-fix.txt`, `ui-fixed-page-route-after-quality-fix.png`, `qa-project-route-extract.json` | PASS |
| Event-command `moveEvent` route body exposes the same expanded command catalog | `green-playwright-command-route-after-quality-fix.txt`, `ui-fixed-command-route-body.png` | PASS |
| Runtime NPC actually moves across positions, not just animates in place | `ui-fixed-runtime-moving-01.png` through `ui-fixed-runtime-moving-16.png`, `runtime-route-summary.json`, `qa-runtime-route-analysis.json` | PASS |
| Route side effects execute | `audio-state-after-route-ui-fixed.json`, `runtime-route-summary.json`, `green-vitest-runtime-migration-after-quality-fix.txt` | PASS |
| Frequency waits after active move completion | `green-vitest-runtime-migration-after-quality-fix.txt` | PASS |
| Page-owned movers are removed when route switch changes the active page to fixed/no-route | `green-vitest-runtime-migration-after-quality-fix.txt` | PASS |
| Expanded route payloads are validated on project import | `green-vitest-runtime-migration-after-quality-fix.txt` | PASS |
| Type/build regression | `typecheck-after-quality-fix.txt`, `build-after-quality-fix.txt` | PASS |
| Final code review blockers rechecked | `.omo/evidence/npc-move-route-blockers-rereview-code-review.md` | PASS |
| Full final code review completed | `.omo/evidence/npc-move-route-final-code-review.md` | PASS |
| Bounded changed-files/diff context exists despite dirty worktree | `bounded-changed-files-after-quality-fix.txt`, `bounded-diff-after-quality-fix.patch`, `bounded-diff-manifest-after-quality-fix.json` | PASS |
| ULW notepad artifact exists for this exact run | `.omo/ulw-loop/019f0ded-d3e8-7ec1-9b37-95ba3c114ba0/notepad.md`, `notepad-after-quality-fix.md` | PASS |

## Notes

- `green-vitest-runtime-migration-after-quality-fix.txt`: 2 files passed, including 10 runtime NPC tests and migration/import shape validation.
- `green-playwright-event-route-after-quality-fix.txt`: page route editor workflow passed.
- `green-playwright-command-route-after-quality-fix.txt`: event-command move route body workflow passed.
- `build-after-quality-fix.txt`: production build exited 0. Vite reports an existing dynamic/static import warning for `src/project/store.ts`; it is non-fatal.
- The worktree is broad and dirty, so `bounded-changed-files-after-quality-fix.txt` and `bounded-diff-after-quality-fix.patch` define the reviewed NPC Move Route scope.
