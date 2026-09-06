# Focused parent-serialized wiki proposal

Do not replace existing Save5/Project4, recovery, XP, regrowth or clock text. No shared wiki or INDEX was edited by task8.

## openwiki/editor-database.md

Insert this paragraph in `생활 기술·제작 저작 표면`, immediately after the paragraph that describes record snapshots and undo:

> Tool-action authoring uses the real resolver defaults: creating the first nonempty custom table copies hoe/till, wateringCan/water, axe/chop/tree and pickaxe/mine/rock, then prepends the new row. Existing nonempty tables remain ordered complete replacements; adding another row only appends and loading never merges defaults. New rows do not silently select the first database item. `itemId` takes precedence over `farmTool` within a row; first matching rows retain their order. The condition hint explains that empty item/kind conditions mean any valid non-consumable farm tool, not a seed or consumable. The farmable checkbox displays the effective default (true for till/water) but stores an explicit boolean when edited, so unchecked false survives Project4 serialization, reload and undo/redo. `test/toolActionAuthoringParity.test.ts` and `test/databaseLifeCraftingView.test.ts` cover these contracts.

## openwiki/runtime-sessions.md

Insert after the existing `Authoring tools (opt-in, not a forced Stardew loop)` paragraph; preserve its crafting, chest and upgrade descriptions:

> Tool rules are ordered complete replacement tables, with four legacy defaults only when absent/empty. `resolveToolUseOnTile` validates integer map bounds, gives a row's `itemId` priority over its kind, and resolves empty conditions only against valid non-consumable farm tools. `toolRuleRequiresFarmable` is shared with the editor: omitted till/water restrictions are true; explicit false releases only the region restriction. Farming reuses terrain and static spatial occupancy authorities, so walls, chests, placements (including nonblocking decorations), unrelated placeables and overlapping assets still refuse. The target tree/rock itself is the only placeable occupancy exemption. Wide tools apply only to safe cells and remain draft-atomic for energy/XP failure. Held tools resolve authored till/water/harvest actions at each tile while preserving the legacy empty-hand cascade and seed planting region requirement. Mature crops must satisfy authored harvest rules if any exist; without harvest rules legacy harvesting remains. Task8's fish proof covers this same resolver only: task10 owns fishing/forage input and catch integration. Live-body placement safety remains the separately assigned task12 boundary.

## openwiki/testing.md

Also append this caller-dependency paragraph to the proposed runtime-sessions entry above:

> Task12 integration constraint: `interactWithFarmPlotSingle` in `src/player/farming.ts` calls `canOccupySpatialFootprint` before accessing the target plot. That authority currently deliberately omits `session.farmPlots`. When farm-plot occupancy is added for spatial placement, farming must retain access to its own current plot so valid water/harvest actions do not reject themselves. Verify placement-over-plot refusal alongside continued water/harvest access. This is a later caller dependency, not a current task8 failure; task12 owns the implementation.

Append a focused entry under `Agent validation rule`:

> Tool-rule parity: `test/toolActionAuthoringParity.test.ts` plus database-life, farming, tool-capability, serialization, regrowth and disabled-XP regressions. Task8 evidence at `.omo/evidence/life-full-20260906/8/` records RED, 269 tests/15 files, changed-file diagnostics, app typecheck, full build, the public authority probe, and native Firefox editor keyboard/undo controls at 1440x900 and 1024x768. The editor boot subscription uses `perf-metrics-json.initialEditRenderMs`, not the early toolbar mount, which can be replaced during boot. Native player gameplay is not claimed. Chromium transport failures, probe setup failures and offline fixture warnings remain in the evidence. Screenshots were captured, but this child had no image-decoding-capable model; DOM observations are verified, visual image review remains with the parent.

## INDEX

After applying only the approved wiki additions, regenerate with the repository's existing `npm run openwiki:index`, then run `npm run openwiki:index -- --check` and `npm run openwiki:verify`. These shared edits and checks belong to the parent.
