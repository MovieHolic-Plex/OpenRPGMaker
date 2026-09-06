# Milestone 1: animation scroll and shared numeric composite

This is a verified increment, not R1-R8 closure or visual approval.

- Base: 49067218aebf889d98c2dc05be08231787483427.
- Branch/worktree: agent/db-css-ownership-20260906,
  /home/main/z-project/rpg-zzu-db-css-ownership-20260906.
- Browser: Firefox 1532, http://127.0.0.1:10331; server PID 12232 cwd
  independently read through /proc/12232/cwd. No remote writes: browser routes
  abort every non-GET/HEAD/OPTIONS request; freshProject uses local test state.
- DESIGN.md was edited before implementation. initial-review.md is unchanged.

## Observed RED and GREEN

`initial-browser-red.json` preserves actual assertion failures before the fix:
- Animation overflow-y was visible rather than auto/scroll.
- Item price composite was 34px with a 1px/8px inner border/radius.

The first RED runner hit the external 240s command deadline after these two
failures; remaining cases were not completed. The first GREEN attempt used
cached transforms in the frozen server and was terminated, not counted as a
pass. Only this worktree's server was refreshed. The subsequent four tests
passed; after supervisor review, unsafe casts were removed and wheel reachability
and stationary-header assertions strengthened, then all four passed again.

Final command: `DEV_SERVER_PORT=10331 E2E_RETRIES=0 npm run test:e2e -- --config
playwright.db-css.config.ts --project firefox`: exit 0, 4/4, 3.6m.
At 1440x900 and 1024x900: real wheel reaches a lower cell control, center hit-test
succeeds before focus, header bounds remain identical, stage >=280px; item
stepper is 32px with no inner border/radius/shadow at rest/hover/focus.

## Verification

- TypeScript LSP: no diagnostics on test/spec config. CSS LSP unavailable:
  configured Biome executable is not installed; no dependency was added.
- PostCSS parsed all four changed CSS files, no syntax errors.
- Related unit commands: numeric label trust, Studio v2 and animation frame
  selection (28 passed); number-field and modern-control contracts (28 passed).
  A nonexistent databaseControls.test.ts argument selected no additional file;
  the actual databaseControlsNumberField and databaseModernControls suites were
  then explicitly run and passed.
- `npm run typecheck:app`: exit 0.
- `npm run build`: exit 0 (app/player/standalone). Existing circular-chunk,
  mixed static/dynamic import, unresolved runtime asset and large-chunk warnings
  remain in /tmp/db-css-build1.log; they were not suppressed.
- `npm run gates:css`: exit 0; graph/live-class/budget gates pass.
- `npm run openwiki:index`: exit 0. `git diff --check`: exit 0.
- Functional declarations in the four affected sheets: 1657 -> 1619 (-38).
  This is a parsed declaration count, not lines or a claimed complete debt audit.

Logs: /tmp/db-css-green3.log, /tmp/db-css-unit1.log,
/tmp/db-css-unit-number.log, /tmp/db-css-typecheck1.log,
/tmp/db-css-build1.log, /tmp/db-css-css1.log.

## Remaining scope

R2 entry-after-battle/return/reopen, Classes/Troops, complete R3 state/semantics,
R4/R5 shared navigation/CRUD/labels, R6 fonts, R1 graph/declaration-owner inventory
and retained-important justification, R7 mandatory matrix and R8 preservation
remain open. No pixel verdict: both supervisor image-provider paths failed to
receive pixels; screenshots remain evidence for human review.
