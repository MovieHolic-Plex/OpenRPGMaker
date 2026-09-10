# OPRN-OUT-020 — Named locations as a shared map layer

Branch `agent/oprn020`, worktree `/home/main/z-project/rpg-zzu-oprn020`, dev port 9854.

## The architectural call, made first (as the contract required)

`layoutPlan.regions` was evaluated as the host for this feature and **rejected**, with a
one-way bridge added instead. Evidence for the rejection is in the source, not in taste:

- `setMapLayoutPlan(map, plan)` replaces the whole array; `village/builder.ts:1609` and
  `largeRiverMarketVillageBuild.ts:554` call it on every (re)build. A human edit stored there
  disappears the next time the builder runs — silently.
- `houseProtection.ts:53/110/117` and `villageEvaluate.ts:176/649/704` read `role` as a
  *construction* fact. Human-authored labels in the same array would change what the village
  verifier reports.

So `map.locations` (`MapNamedLocation[]`, optional) is the human/gameplay layer, and
`adoptLayoutRegionsAsLocations` is the only movement between the two — a **copy**, one
direction, idempotent, explicitly invoked, leaving `layoutPlan` byte-identical. Adopted
entries keep `origin { kind:"layoutRegion", regionId, planKind? }` as a provenance snapshot.
**Nothing happens to an old builder map by opening it**: no automatic adoption, no field
added, no serialization change.

## Acceptance criteria

### 1. Draw / select / name / rename / resize / delete through a toggleable editor layer — **MET**

- Toggle: `map-location-layer-toggle` ("로케이션") in the canvas toolbar, present in every edit
  mode, persisted in `localStorage` `oprn:map-location-layer`. While off the overlay is
  `pointer-events: none` and renders nothing.
- Gestures (`src/editor/mapLocationLayer.ts`): empty-area drag draws, click selects, body drag
  moves, bottom-right handle resizes, Delete/Backspace deletes, Escape cancels drag then
  selection. Inspector adds name field, x/y/w/h fields, note, and a delete button.
- Proof: `test/mapLocationLayer.test.ts` (7 tests, real DOM) and browser shots
  `verify-shots/oprn-020/01..06`. Shot `06-renamed-same-id.png` shows the box aligned to map
  tiles at (3,3) 9×7, the label, the resize handle, and the whole inspector.

### 2. Stable ID + user-facing label, references survive label changes — **MET**

- `MapNamedLocation.id` (`loc1`, `loc2`… unique inside the map) is what references store;
  `name` is what people and the assistant say. The inspector prints the ID with the sentence
  "이름을 바꿔도 이 ID 를 가리키는 조건·인카운터는 그대로입니다".
- Proof: `mapNamedLocations.test.ts` "renaming the location does not change condition
  evaluation", `mapLocationTools.test.ts` "renaming through the tool keeps the stable id",
  and browser shot `06-renamed-same-id.png` (ID line unchanged across the rename, asserted in
  `scripts/qa/map-location-layer.mjs`).

### 3. Assistant lists and resolves without the user repeating coordinates — **MET**

Six tools in `src/editor/tools/mapLocationTools.ts`: `list_map_locations`,
`resolve_map_location` (by ID, exact name, partial name, or by point — the point form returns
the *most specific* overlapping area), `create_map_location`, `update_map_location`,
`delete_map_location`, `adopt_layout_regions`. `find_layout_regions` is untouched and still
sees only builder regions. Proof: `test/mapLocationTools.test.ts` (12 tests).

### 4. Event conditional branches reference a named location (inside/outside) — **MET**

`Condition` gains `{ kind: "insideLocation", locationId, inside }`, authorable in the fork
condition form and in advanced page conditions ("구역(로케이션)"). Evaluation is identical on
all three surfaces — page appearance, map fork, and battle events —
`test/conditionEvaluatorParity.test.ts` still has an **empty** divergence allowlist and now
covers this kind. Unresolvable (map not supplied, or location deleted) is **false for both
`inside:true` and `inside:false`**; a missing place's "outside" is not silently true.

**Transition (enter/leave) semantics are deferred**, and this is a scope statement, not an
oversight: the engine has no per-step location-change hook, so enter/leave would need a new
runtime event source (session-side previous-location tracking plus a trigger kind). The issue
itself scopes it as "if supported by the event model". Inside/outside plus a self-switch
reproduces enter-once today. Product owner decision required before adding a trigger kind.

### 5. Random encounters reference the same location without copying its rectangle — **MET**

`EncounterConditions.locationId` next to the retained legacy `region`. `src/player/encounters.ts`
resolves it from `map.locations`; `locationId` wins when both exist; a deleted location
**suppresses** the entry rather than widening it to the whole map. Authoring UI is the map
settings encounter row ("이름 붙은 구역" selector, which disables the raw-rectangle checkbox
while a location is selected and shows a broken-reference note when the ID is gone).
Proof: `mapNamedLocations.test.ts` "encounter references" block (4 tests) — including moving
the location and watching the encounter follow it.

### 6. Deleting/invalidating a referenced location produces a visible diagnostic and repair path — **MET**

- Deletion **does not** touch references. `projectLint` reports `map-location-missing-ref`
  (error). The inspector renders a "끊긴 참조 N건" panel with per-ID repair controls.
- Three repairs (`repairMapLocationReferences`): `remap` (repoint at another area),
  `detach` (drop just the area clause — a fork whose entire condition was the missing area
  becomes always-true `{kind:"all",conditions:[]}` so its `then` branch is not lost), and
  `freezeRect` (demote an encounter to the legacy raw rectangle it used to have).
- The assistant's `delete_map_location` **refuses** a referenced delete unless the caller
  states `brokenReferences`. The asymmetry with the human path is deliberate: the tool runner's
  commit gate blocks writes that introduce new error-severity lint, and cutting a reference is
  a decision to ask the user about; a human can delete now and repair from the visible panel.
- Proof: `mapNamedLocations.test.ts` repair block (7 tests), `mapLocationLayer.test.ts`
  "shows the reference impact before deletion and a repair path after it", browser shot
  `08-broken-reference-repair.png` (diagnostic panel + repair button + impact toast).

### 7. Overlap, map resize, copy, import/export, legacy raw rectangles documented and regression-tested — **MET**

| Behavior | Contract | Test |
|---|---|---|
| Overlap | Allowed; point lookup picks smallest area, ties by authoring order; editor shows an info badge, never blocks | "overlap contract" (2 tests) + layer test |
| Map resize | Clamp, **never delete**; fully-outside areas survive as border 1×1 and lint reports `map-location-degenerate` | "clamps locations on shrink…" |
| Map shift | Areas move with content and clamp at the border | "shifts locations with map content" |
| Copy | `cloneGameMap` carries areas with identical IDs; references are map-scoped so the copy points at its own areas and diverges independently | "map copy carries locations with identical ids" |
| Import/export | serialize → deserialize round-trips areas, `insideLocation` conditions and encounter refs; duplicate IDs rejected at load; **out-of-bounds saved rectangles still load** so the user can repair them | "schema load / migrate / save" (4 tests) |
| Legacy raw rectangles | `EncounterConditions.region` untouched and still evaluated; `locationId` wins when both exist | "legacy raw-rectangle encounters keep working untouched", "a location reference wins over a coexisting legacy rectangle" |

Documented in `openwiki/runtime-project-schema.md` §명명 로케이션 레이어.

### 8. Relationship/migration with `layoutPlan.regions` explicit, old builder maps unchanged — **MET**

See the top section. Machine-checked by "adopts builder regions as locations without touching
layoutPlan, and is idempotent" (asserts `map.layoutPlan` deep-equals its pre-adoption clone,
twice), "adopting a subset by role leaves the other regions untouched", "a legacy builder map
with no locations layer is unchanged by load/save", and the tool-side
"adopt_layout_regions copies builder regions and leaves layoutPlan byte-identical".

**Migrating existing builder maps is deliberately deferred to the product owner.** Adoption
stays a per-map explicit action. Auto-adopting every `layoutPlan.regions` on load would
(a) mutate old projects on open, (b) mint dozens of gameplay-visible names the author never
wrote, and (c) fight `role`-driven village verification. If the owner wants a bulk migration,
the primitive already exists (`adoptLayoutRegionsAsLocations`, idempotent, role-filterable).

## Verification actually run in this worktree

- `npx tsc -p tsconfig.app.json --noEmit` → **exit 0, zero errors** (repeated after every edit).
- `npx vitest run <file> --maxWorkers=2`:
  - `test/mapNamedLocations.test.ts` — 31 passed
  - `test/mapLocationTools.test.ts` — 12 passed
  - `test/mapLocationLayer.test.ts` — 7 passed
  - `test/commandKindCoverage.test.ts` — 180 passed (added the new kind's minimal instance)
  - `test/conditionEvaluatorParity.test.ts` — 38 passed (added the new kind's parity case)
  - `test/battleConditionStateBridge.test.ts`, `test/relationshipAuthoring.test.ts` — 10 passed
  - `test/mapLayoutPlan.test.ts`, `test/mapEncounterPanel.test.ts`, `test/aiConnectionStatusWiring.test.ts` — 10 passed
  - Combined run of the seven feature-adjacent files: **277 passed, 0 failed**.
- `node scripts/check-css-budget.mjs` → gate passed, 0 regressions (2 improvements).
- `npm run openwiki:verify` → `"failures": []`; `npm run openwiki:index` regenerated.
- Browser: `npm run dev:worktree` on port 9854 + `node scripts/qa/map-location-layer.mjs` →
  8 screenshots + `SUMMARY.md` in `verify-shots/oprn-020/`, zero real page errors.

### Pre-existing failures (not caused by this change)

- `test/modalEscapeLayerGate.test.ts` fails at the branch baseline too (offenders
  `panels/aiStickyChecklist.ts`, `panels/resourceManagerViews.ts` — neither touched here).
  Confirmed by stashing all changes and re-running.
- Full `npm run typecheck` and the whole suite are RED at baseline per the task brief; not
  re-litigated.

## Notes for the reviewer

- The Supabase content rule does not apply: this is editor/engine code with no authored game
  content. Schema changes are proven by load/migrate/save tests instead.
- Two existing shared contracts had to widen, both deliberately and both machine-guarded:
  `BATTLE_CONDITION_SESSION_STATE_FIELDS` gained `currentMapId`/`x`/`y` (its own comment
  demands that a newly stateful condition also require the field at the real play-to-battle
  boundary — `playSceneBattle.ts` now supplies them, and
  `test/battleConditionStateBridge.test.ts` enforces it), and `resolveEventPage` gained an
  optional location context threaded from `runtimeEventState`'s per-map traversal.
- A real bug was found and fixed by the browser run, not by the unit tests: overlay geometry
  originally ignored the Phaser camera, drawing boxes ~500px away from the cursor. The layer
  now converts through the `regionClientRect` registry. The DOM test's fallback path is why
  the unit tests missed it; the routing wiki now records the trap.
