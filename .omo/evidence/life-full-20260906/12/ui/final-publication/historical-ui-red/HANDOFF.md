# Task12 UI producer-r2 handoff (frozen uncommitted)

This is one serial shared-unit handoff, not final task12 approval. Source is frozen uncommitted on `agent/life-full-p4` at HEAD `bbd1422c906f1c52111ade44d1762785480a50e9` (preservation metadata only). Product base remains `a51149b344d345f134cf2831c06867ba2a8a003c`. Astra owns CLI/build/docs commit of this same byte-identified unit next. Attempt1 producer/build/verify evidence is untouched.

## Outcome

Live production callers in `lifeLedger.spatialEntries` pass one scene `SpatialLiveContextReader` as the final argument of all six place/move/upgrade building and place/move/rotate decoration APIs. Missing scene refuses `{ok:false,reason:"blocked"}` instead of the static path. Place/move targets use `adjacentSpatialPosition` with the full player body and `scene.facing`. Upgrade/rotate keep stored coordinates and still pass the reader plus a target-specific rendered-body preflight. Removes and other ledger tabs are unchanged. Occupancy/transaction/restore/farming/save codec files were not edited. Astra wiki/index files were not edited.

**UI tests:** 88/88, exit 0, one focused run on final bytes. **Native player.html:** place + overlap refuse + upgrade + walk-after-place + menu Save/raw-slot (exit 0). Slot Load-menu reload and native decorations were not completed. **Remote authored project:** save+reload proved.

## NPC / body / passage and mid-step choices

- Player discrete body: `resolvePlayerBody(project, session)` full footprint at `PlayScene.tileX/tileY` (logical origin while a step is in flight). Sprite lerp is not forwarded to core.
- Player passage: `passRows` from the same resolver, movement/last-exit only. Placement overlap uses full `footprintBounds`, never `passRows`/`passRect`.
- In-flight player: integer anchors stay at the origin; UI refuses the mutation until the step completes (`scene.moving`), so a right-adjacent target that the interpolating 3x3 body would cover cannot apply.
- NPCs in the core reader: `runtimeEventViewsForMap` on current map/session/`eventPositions`. `eventLocations` wins (destination written at step start). Spawned and incoming relocated actors included. Page-less, erased, off-map ghosts omitted. Only `priority === "same"` and `overlapForbidden` actors are walking walls in the reader `npcs` array.
- Visible construction protection is separate: `placementBlockedByRenderedBodies` uses destination plus the interpolating foot (`lerp(from,to,elapsed/duration)`) converted with `footprintBounds` and unit-square occupancy, never passed into core geometry. Above/below/pass-through bodies with a page block construction on overlap and are not last-exit walking walls. Unrelated movers that do not overlap the target do not ban construction. Actors are not frozen, snapped, or teleported. Menu/world-clock policy is unchanged.
- Fractional player anchors make `peekLive` unusable so apply refuses. A stale preflight never replaces the fresh apply reader call.
- Live HUD never omits the reader.

## Wiki update brief (fact-only, Astra)

Do not treat this as a wiki edit. `openwiki/runtime-sessions.md` still says farming occupancy “deliberately omits `session.farmPlots`”. In this tree `spatialOccupancy.ts` includes plots, with a self-plot exemption in `farming.ts`. After this UI unit, live ledger mutations pass a call-scoped scene reader and adjacent full-body targets; live context is still not serialized on session/placement/save.

Two load-time contracts that native QA hit and did not change:

1. `normalizeSystemRecords` does not whitelist `system.playerFootprint` / `system.playerPassRows`. Authored 3x3/passRows1 in the QA fixture JSON is dropped on player parse, so native New Game ran as 1x1. Repro: fixture bytes contain the fields; Spaces target after boot is `(8, 9)` not 3x3 `(7, 9)`; Supabase reload proof also has `reloadPlayerFootprint: null`.
2. `startSession` assigns `farmPlots: {}` and does not copy authored `start.farmPlots`. Native New Game never saw the fixture plot at `7,9`.

INDEX regeneration is parent/Astra-owned.

## Source identity

See `source.sha256` and `SOURCE-HANDOFF.json`. Untracked new files: `src/player/lifePlacementScene.ts`, `test/lifePlacementSceneUi.test.ts`. Dirty set is the 11 UI/test paths plus Astra’s 3 wiki/index files from attempt1. No other product dirt.

## UI verification

- Restored 11 UI/test paths to base preimages (wiki untouched), hashes equal `a51149b344d345f134cf2831c06867ba2a8a003c` owners.
- Characterization on restored product: `pre/characterization.log` **73/73**, 5 files, exit 0.
- Behavioral RED through existing ledger APIs (no future helper import): `pre/red.log` **2 failed / 0 passed**, exit 1. Foot-tile place at `(5,5)` and six mutations without a reader spent gold. Full streams kept.
- Those two RED cases remain in `test/lifePlacementSceneUi.test.ts` (no-reader refuse; display/apply not the foot tile).
- Readonly `SpatialLiveActor.x/y` mutations replaced with position boxes. `createStatusMenuDetail` now receives `waitModeEnabled: false`.
- Final command (exit 0):

```
node scripts/run-vitest.mjs run --configLoader runner --cache=false --maxWorkers=2 --minWorkers=1 \
  test/lifePlacementSceneUi.test.ts test/p2SpatialPlayIntegration.test.ts \
  test/p2SpatialRuntimeUi.test.ts test/playerStatusMenu.test.ts \
  test/playerOpenSaveMenu.test.ts test/lifeFieldInteraction.test.ts
```

- Result: 6 files, **88 passed**, including 45 `lifeFieldInteraction` cases. Old foot-target assertions now assert adjacent coordinates, not deleted. Astra 355-core suite was not rerun. LSP diagnostics on edited UI/test files: 0.

## Native

- Dedicated `player.html` + `startPlayerQaServer` (not editor play). Keyboard only; no `DOM.click()`.
- Isolated remote project `rpg-zzu-life-full-p4-t12-ui-01a07a93` (not stardew-demo / WISH). `native/remote-proof.json`: saveKind `saved`, sha256 `5ff28314f2921dcec9ba369d7947806483a1b23319b50cc26c1c7f3389094112`. Reload showed shed/rug/table types, npc `npc_walker` 3x3/passRows1, plots `7,9`, start `(8,8)`. Credentials not recorded. First attempt1 project `…-01a07a27` was not overwritten.
- Final owned run `native/native-qa-final.log` / `native-qa-9` **exit 0**:
  - Title via document init hook; snapshot.player `{x:8,y:8}` gold 500.
  - NPC `activeMove` from/to observed (sprite pixels 264,144).
  - Spaces target `map_blank_start (8, 9)` not foot `(8, 8)`. Screenshots 1024/1440.
  - Place shed at 8,9, gold 500→490. Overlap re-place `blocked`, gold unchanged.
  - Upgrade to level 2, gold 470. Catalog cloud picture, no `__MISSING` (`field-after-save-1024.png`).
  - Menu fully closed, hold ArrowLeft until `snapshot.player` 8,8→7,8.
  - Menu Save slot 1; raw key `task12-ui-native-r2:save-slot:v5:1` (3586 bytes) retains shed level 2 at 8,9 and player 7,8. Decorations `{}`.
- Failed native streams preserved: `native-qa-1` … `native-qa-8` plus attempt1 directory. No skip/deletion/timing retries of assertions.
- Limits: native decorations/rotate/plot/last-exit/3x3 body were not completed in player.html because of the two load-time contracts above and same-cell rug targeting. Slot Load-menu reload was not driven; persistence is the raw slot JSON. Handler tests cover all six callers, rendered NPC overlap, in-flight player refusal, and visibility vs walking.

## Commands and exits

| Step | Exit | Path |
| --- | --- | --- |
| restore to base | 0 | `pre/restore.json` |
| characterization | 0 | `pre/characterization.exit` |
| RED | 1 | `pre/red.exit` |
| UI final | 0 | `tests/ui-green-final.exit` |
| remote save | 0 | `native/remote-save.exit` |
| native final | 0 | `native/native-qa-final.exit` |

Heavy commands used lock `/tmp/rpg-zzu-life-full-qa-01a0727b.lock` (180s acquire), `--maxWorkers=2 --minWorkers=1`, `--cache=false`.

## Cleanup

Owned tmpfs `/dev/shm/st_01a07a93` was private cache. Attempt1 leftover `/dev/shm/st_01a07a27` was copied to `prior-scratch/` then removed. Shared lock was not nested and was not deleted. Playwright browsers path `/home/main/.cache/ms-playwright` was not deleted. `node_modules` untouched. Native servers closed in script finally; no leftover `vite.player-qa` at handoff. See `cleanup.json`.

## Safe publication list

Include: this HANDOFF, SOURCE-HANDOFF.json, source.sha256, pre/*, tests/*.log.gz, native/remote-proof.json, native/*.log.gz, native/*.png, native/fixture.json, native/build-fixture.mts, native/native-qa.mjs, native/raw-slot-1.json, native/raw-slot-1.parsed.json, native/native-evidence.json. Exclude: `.env.local`, anon keys, headers, private reasoning.

## Limits

- No occupancy/transaction/recovery/farming/save codec edits, no commit/merge/push, no INDEX/wiki edit, no 355-core rerun, no typecheck:app/full build (Astra).
- Native 3x3/plots/last-exit/decorations/Load-reload remain incomplete for the contracts named above.
