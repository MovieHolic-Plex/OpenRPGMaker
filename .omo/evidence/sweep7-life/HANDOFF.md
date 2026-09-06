# PR666 local merge candidate

- Task: st_01a0782e; isolated worktree `/home/main/z-project/rpg-zzu-sweep7-life`, branch `agent/sweep7-life`.
- Adopted parent: `db825efc51ebd186163b020e3d61d63ddabaf7c3`.
- Merged tip: `966f414c07729e7d9474c568cbaf19a94d2bc740` (PR666).
- User explicitly authorized integration in this sweep; historical delivery-only PR text is retained as historical evidence, not current routing.
- Parent owns integration with later shared-main changes, combined build, browser QA, restart and deployment. No shared-main checkout, push, comments or DB writes were performed here.

## Conflicts and resolution

Four textual conflicts:

1. `src/testing/sceneTestRunner.ts`: compose per-coordinate event/chest/forage/fishing/farm dispatch with main's explicit expected NPC event-id checks. Non-event owners cannot certify an explicit NPC target. Preserve input validation, reward baselines, choice cancellation, relocation, NPC positions and battle-input handling from main.
2. `openwiki/runtime-sessions.md`: retain both main's cinematic lifecycle contract and incoming life-field/date contract.
3. `openwiki/testing.md`: retain both sets of scoped verification history and limitations.
4. `openwiki/INDEX.md`: regenerate with the canonical index script after composing the pages.

Auto-merges retain main's NPC detection dispatch, random-battle session/input ownership, action-combat dispatch, promotion/detection Save5 fields and recovery validation, event behavior and audio state. Added four regression cases for explicit feet-event assertions blocked by front fishing, forage, chest or farming. All four pass.

All inherited `.omo/evidence/life-full-20260906` files compare byte-identically with PR666 (`git diff --quiet 966f414c -- .omo/evidence/life-full-20260906`, exit 0). Raw transcripts, warnings and failures are unchanged.

## Actual bounded verification

- Changed-file TypeScript syntactic/semantic diagnostics: **25 files, zero diagnostics, exit 0**. Script, exact file list and output retained here.
- App typecheck: `timeout --signal=TERM --kill-after=10s 180s npm run typecheck:app`, **exit 124**, no TypeScript diagnostics emitted before timeout.
- A serial app-typecheck attempt after the test/diagnostic processes finished: 300-second bound, **exit 124**, no TypeScript diagnostics emitted before timeout. Both original logs are retained. App typecheck is **not verified green**.
- Single focused Vitest execution with `--maxWorkers=2`, 300-second process bound: **380 passed, 1 failed, 381 total in 19 files; 18 files passed, 1 failed; exit 1**. Completed in 259.73 seconds. Exact command is `focused.command`, unmodified output is `focused.log`.
- Failure: `test/databaseLifeCraftingView.test.ts`, `materializes real defaults only on first custom-table creation, as one undoable edit`: `Error: Test timed out in 15000ms.` Reported duration 20373ms.
- Additional unhandled runner error: `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`.
- Passing coverage includes farming, regrowth, skill-disabled harvesting, authored tools, maker deadlines, all 49 field-interaction cases, Save5 versions, lossless recovery, NPC battle lifetime, explicit scene-target verification, and map BGM state.
- Host observation after the run: load average 213.19/195.49/171.20 on this 32-core host, swap 37Gi used of 37Gi. Resource pressure was observed; causation of the test timeout is **not established**. No baseline triage, test retry, timeout relaxation, suppression or unrelated fix.
- Scoped whitespace check (`src`, `test`, `openwiki`): exit 0. Canonical index generation: exit 0. No unresolved merge paths remain.
- No full gates, builds or browser execution here, as requested. This is a bounded, partially verified candidate, not a green shipping verdict.

## Safe shipping-player smoke for parent

From the candidate/combined checkout:

```sh
VITE_CACHE_DIR="$PWD/.vite-cache/sweep7-life-smoke" npm run qa:runtime -- --scenario smoke --browser firefox --out .omo/evidence/sweep7-life-smoke
```

This uses the dedicated `player.html` QA server, exported-player store shim and local fixture; it does not enter the editor or save remote content. The harness owns a free loopback port and closes its browser/server. This command was inspected, not executed in this task. It is a boot/map-transition smoke, not full life-gameplay or compiled-deployment acceptance. Read its `SUMMARY.md` first.
