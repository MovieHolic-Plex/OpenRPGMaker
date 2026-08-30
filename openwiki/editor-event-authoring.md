# Editor Event Authoring

## NPC 일정 구조화 편집 (2026-08-24)

- `src/editor/panels/eventEditor/eventScheduleEditor.ts`는 `event.schedule`이 비어 있어도 항상 `event-schedule-editor`를 렌더한다. `event-schedule-add`로 현재 이벤트 위치를 기본 목적지로 한 행을 만들고, 각 행은 삭제할 수 있다.
- 조건 편집은 `NpcScheduleWhen`의 기존 필드만 사용한다: `timePhase`, 정확 시각 범위인 `hourRange`, `season`, `dayRange`. 목적지는 `at.mapId/x/y`, 선택 방향은 `facing`, 활동 분기는 `activity`다. 새 시작 계절/요일 같은 schema 필드를 만들지 않는다.
- `hourRange`와 `dayRange`는 각각 사용 체크박스를 가진다. 체크를 끄면 필드 자체를 제거해 다시 “항상” 조건으로 돌아가며, 단순히 화면 숫자만 비활성화한 채 stale 범위를 남기지 않는다.
- UI change handler는 HTML `min`/`max` 우회를 신뢰하지 않는다. hour는 0..47/48, day는 1..99, x/y는 선택한 target map bounds로 clamp한다. `when:{}`인 무조건 행이 뒤 행보다 앞에 있으면 `event-schedule-shadow-warning-N`을 표시해 first-match ordering shadow를 드러낸다.
- 기존 aggregate draft validator가 찾는 `event-schedule-map-N`, `event-schedule-x-N`, `event-schedule-y-N` testid를 유지하므로 존재하지 않는 map, bounds 밖 좌표, 통과 불가능 좌표의 Apply/Test 차단과 포커스 이동 계약은 그대로다.
- 표면 CSS는 `src/styles/editor/event-editor.modernize.css`의 schedule block이 소유한다. 행 CRUD 계약은 `test/editorNpcSchedule.test.ts`, 기존 bounds/passability 및 focus 계약은 `test/eventDraftValidator.test.ts`와 `test/eventEditorTrustLoop.test.ts`가 소유한다.
- 프로젝트 전역 참조 검증도 모든 맵(맵 트리에 연결되지 않은 orphan host 포함)의 `event.schedule[].at`을 검사한다. blank/missing/unknown `mapId`, 정수가 아닌 좌표, 맵 bounds 밖 좌표는 `hostMapId + eventId + eventIndex + scheduleIndex`로 보고하며 load repair는 해당 행만 제거한다. 유효한 중복 행은 first-match authoring 순서이므로 deduplicate하지 않는다.
- 런타임 일정 상태는 `event.id`를 전역 key로 사용한다. 따라서 프로젝트 내 같은 이벤트 ID가 둘 이상이고 그중 하나라도 일정 행을 가지면 hard reference error다. 기존 프로젝트 호환을 위해 모두 unscheduled인 중복 이벤트 ID는 이 규칙이 차단하지 않는다.
- 맵 삭제 영향(`MapDeletionImpact.incomingScheduleRows`)은 삭제되는 맵 자신이 아니라 살아남는 attached/orphan host의 정확한 일정 행을 열거한다. cascade는 대상 맵을 가리키는 일정 행만 제거하고 이벤트 page/command와 다른 일정 행을 보존한다.

> **Encoding note:** Some Korean descriptive text has EUC-KR→UTF-8 mojibake from the original source commit. English terms, file paths, and code references are intact. For accurate Korean, consult the referenced source files. Partial automated restoration applied; remaining garbled CJK is irreversibly corrupted.

Event authoring, event pages, event commands, move routes, command dialogs, and cutscene/horror/puzzle tools.

## Roguelike run authoring (2026-08-24)

- The native command picker exposes **로그라이크 런 제어**. Its rich body switches among start, next-floor, end, run-flag, and room-reset fields; changing the action rerenders because each action has a different command shape.
- Fork condition forms expose **로그라이크 런** with active, floor, flag, and result modes. Page conditions expose the same control under the advanced-condition list, and page badges/summaries use `R` and run-specific text.
- Multi-field handlers keep staged values so consecutive edits do not restore an older field. `test/roguelikeRunEditor.test.ts` protects floor condition editing, consecutive flag edits, and action-shape rerendering.
- AI-assisted room authoring uses the existing field-spawn builder first (`make_hunting_ground` or equivalent), then `configure_roguelike_room` to group those spawn ids into weighted/floor-gated slots, and finally `runControl` events for start, advance, reset, and end. Conventional regenerating loot uses self-switch/`Erase Event` pages; room generations reset those by default, while `resetEventState:false` protects persistent story events. The room tool does not invent missing field-spawn references.

## Event Authoring


- `src/editor` is the main area to inspect for editor behavior. Start with `src/editor/EditScene.ts`, `src/editor/actions.ts`, `src/editor/editorState.ts`, and the feature modules under `src/editor/panels/`.
- Map editing lives in `src/editor/map*`, `src/editor/tile*`, `src/editor/tileset*`, and `src/editor/structure*` files. Look at `src/editor/tileActions.ts`, `src/editor/tilePaletteStamp.ts`, `src/editor/tilePicking.ts`, `src/editor/mapEditHistory.ts`, `src/editor/mapShiftActions.ts`, and `src/editor/mapClipboard.ts` for common flows.
- `src/editor/EditScene.ts` is the Phaser scene coordinator. Camera pan behavior lives in `src/editor/CameraPanController.ts`, drag-state branching in `src/editor/DragOperationHandler.ts`, tile paint/pick/stamp application in `src/editor/TilePaintEngine.ts`, and AI ghost/focus drawing in `src/editor/agentPreviewRenderers.ts`.
- Store mutations can carry a `ProjectChangeDescriptor` from `src/project/store.ts`. High-frequency tile edits should use `scope: "map"` with concrete `{ x, y, layer }` cells so `EditScene` can update only those tile objects; broad map shape/metadata edits should use map scope without cells; database edits should use `scope: "database"` so the map canvas does not redraw.
- `COMMAND_GUARANTEES[*].supportByContext` is the native runtime-support SSOT for picker rows, persisted/inserted command rows, event-draft validation, and project lint. `commandRuntimeSupport(command, context)` must receive `map`, `common`, or `troop` whenever the owner is known; omission means the conservative worst grade across all three contexts, never an assumed full grade. M2 catalog entries with an `existingKind` are graded through the same native guarantee, while genuinely persisted M2 commands use the M2 classification tables. Every command button publishes `data-runtime-support` (`runtime-full` / `runtime-partial` / `editor-only`) and truthful `data-runtime-owner` (`interpreter` / `player` / `battle`). Unavailable informational entries stay searchable and keyboard-focusable with `aria-disabled="true"`; visible text referenced by `aria-describedby` explains their alternate authoring route, and they have no selection handler.
- High-frequency edits that only mutate one existing `GameMap` should use `store.updateMap(mapId, mapMutator, { cells })` instead of `store.update`. `updateMap` clones only the target map, shallow-copies the project root and `maps`, shares database/assets/tilesets references, emits map scope, and skips full-project normalize passes. Keep tileset/passability/database/project-tree edits on `store.update`.
- **Auto-connect (?댁썐 ?깊삎):** defaults to **Manual (`false`)** for *non-autotile* exact placement. **RM-style exception:** if the stroke paints or erases a tile that belongs to any `tileset.autotileGroups` trigger/member set (Combined Town dirt/sand; interior wall-frame; interior **dark wall 366**), lower paint/erase/fill **always** runs `shapeTerrainAfterLowerEdit` even when Manual is selected ??same as AI `paint_tiles`. Manual only skips reshape for ordinary single tiles. Paint title row no longer exposes the toggle; **?띿꽦** assist still has `auto-connect-mode-toggle`. Interior needs seeded `autotileGroups` (theme pack seeds dark-wall on load).
- **?ㅽ넗???autotile) 개념:** ?ъ슜?먭? **몸통 브러??????섎굹**留?移좏븯硫? 4/8?댁썐 마스?щ줈 蹂쨌?멸낸 모�꽌由???쇱씠 ?먮룞 교체?섎뒗 吏???깊삎?대떎. ?숆만/모�옒? 같고, ?ㅻ궡 ?대몢??踰쎌? 브러??**366**留???ν븯怨??뚮뜑??쿼터 ?⑹꽦(`interiorDarkWallQuarterComposition`). ???variant ?ъ벐湲곕뒗 ?섏? ?딅뒗??Option B). ?뚯씠?꾨씪?? `paintDarkWallAndShape`. ?섎룞 ?먮뵒?? `tileActions.lowerEditsNeedAutotileShape` (Manual?댁뼱??366 ?깊삎). 코드: `src/project/defaults/darkWallAutotile.ts`, `src/editor/tileActions.ts`. 寃利? `test/darkWallAutotile.test.ts`, `test/e2e/interior-dark-wall-autotile.spec.ts`.
- **Bulk tile paint:** Brush, stamp, palette stamp, and shape-drag must call `paintTilesBulk` / `eraseVisibleTilesBulk` (`tileActions.ts`) so one stroke step is **one** `updateMap` (one map clone, one `repairTreePairs`, one emit, one auto-save reschedule). Never loop `paintTile` per brush cell ??that multiplies clone+listener cost by brush area and feels like DB lag even though auto-save is debounced (~4s).
- **Paint must stay local-first:** autosave/map-patch merge must not replace live map bodies after save. If tiles appear then disappear a moment later, check `store.persistCurrent` is not applying `result.project` onto `this.current` (see `openwiki/runtime-project-schema.md` local-first paint note). Remote lag is OK; local brush feedback is not.
- **Eraser (?섏쐞/?곸쐞):** `eraseVisibleTilesBulk` on **upper** erases upper only (no lower fallback). On **lower**, if lower is empty and upper is occupied it falls back to upper so visible decorations can still be cleared. **`eraseTilesBulk` expands companions before clear**: hard cluster footprints (bench/table/2횞2 tree) + tree canopy?봳runk pairs so `repairTreePairs` cannot immediately restore a canopy you just erased. Tests: `test/layerRouting.m1.test.ts`.
- Undo history is budgeted around per-map snapshots: high-frequency edits that only touch one existing map should record `{ kind: "map" }` snapshots through `mapEditHistory`.
- Keep full-project snapshots for global edits such as database/system changes, map add/delete/tree changes, resize, imports, or any mutation whose boundary is ambiguous.
- Map properties expose hunting data JSON editors for `encounterTable` and `fieldSpawns`. Mutations go through `setMapEncounterTable` and `setMapFieldSpawns`, deleting empty arrays so legacy maps stay compact.
- Tile palette work usually touches `src/editor/tilePaletteStamp.ts`, `src/editor/chipsetTileRender.ts`, `src/editor/runtimeTileMetadata.ts`, and `src/editor/tilesetActions.ts`.
- Default Combined Town 모�옒/?숆만 ?뚮뜑留?uses `src/project/defaults/terrainQuarterAutotile.ts` for RM2003-style 8x8 quarter composition. **Interior ?ㅽ겕?붿? RM2k3 쿼터 ?ㅽ넗???*(`src/project/defaults/interiorDarkWallQuarter.ts` ??援?`interiorWallFrameQuarter.ts`??deprecated ?촦xport). **Option B 계약(2026-07-15):** ??μ? `366` ?섎굹肉먯씠怨?쿼터???뚮뜑?먯꽌留?만든??
 - **중심 게이??** `centerTile === 366`???留??⑹꽦?쒕떎. 주택 ?듯???`397/396/398/426/428/456/457/458`, ?�림 硫?怨?공허 `430`??중심?대㈃ `null`??반환??plain ?듯??쇰줈 洹몃┛????援?계약처럼 문·포?ㅽ듃쨌怨듯뿀源뚯? ?⑹꽦 ??곸씠 ?섏? ?딅뒗??
 - **?대몺 mass ?먯젙:** 留??덉뿉?쒕뒗 `366`留?mass??留?諛뽰? mass濡?본다). 援?`블록 硫ㅻ쾭 ??430/233/234/257/258/?숆뎬 ?뚮몢由?116/146` 광역 吏묓빀怨?`233/257/258` ?쇰꺼 ?덉쇅, house-specific 분기???꾨? ??젣?먮떎.
 - **?뚯뒪 ?좏깮:** 쿼터(NW/NE/SW/SE)마다 v(?몃줈)쨌h(媛濡?쨌d(?媛? ?댁썐??mass ?щ?濡?怨좊Ⅸ????`v쨌h쨌d 踰썩넂427 중앙`, `v쨌h留?踰썩넂368 ?ㅻぉ`, `v留뚢넂426(좌반)/428(?곕컲)`, `h留뚢넂397(?곷컲)/457(?섎컲)`, `모�몢 ?대┝??96/398/456/458 볼록 코너`. ??ID?ㅼ? **?꾪??쇱뒪 좌표??肉?* `memberTileIds`쨌`triggerTileIds`쨌`variantMap` 異쒕젰쨌留???κ컪???꾨땲??
 - **쿼터 ?앸왂 ?놁쓬:** `427` underlay瑜?깔고 ??荑쇳꽣瑜???긽 명시?쒕떎. 援??쒖?????쇨낵 媛숈? 쿼터???앸왂??최적?붾뒗 ???ID媛 ?붾㈃???덉뼱 ?섏삤???먯씤?대씪 ?쒓굅?덈떎.
 - ??규칙??1以?밴드 ?곹븯 2?깅텇, 1??기둥 좌우 2?깅텇, T-교차/??옄 ?ㅻぉ ?⑹쓣 ?꾨? ?먮룞 ?앹꽦?쒕떎 ??????곗씠?곕뒗 `366` 洹몃?濡??먭퀬 ?뚮뜑留?諛붾먮떎. Editor tile objects, map screenshots, transfer-map previews, play mode, and AI temporary map images must use `chipsetQuarterComposition()` and fall back to raw tile drawing when it returns `null`.
 - 계약 문서/?쒓컖 증거: `docs/interior-wall-frame-autotile-cases.html`. PNG ?ъ깮?깆? `bun scripts/render-interior-wall-contract-cases.mts` (?ㅼ젣 ?곸닔쨌grammar쨌quarter ?⑥닔瑜??몄텧?쒕떎 ???먯쑝濡??쎌???議곕┰?섏? 留?寃?.
- **?덇굅???ㅻ궡 踰?계약 진단:** `src/project/defaults/legacyInteriorWallContract.ts`. `findLegacyInteriorWallContract(project)`??援?`harness-interior-house-v1-wall-frame-autotile` 洹몃９怨??섏떖 ?(map id + 좌표)??**?쎄린 ?꾩슜**?쇰줈 보고?쒕떎. ?먯젙? `dark-legacy`(援?dark ?꾩슜 variant `367/368/369/427`留? 쨌 `house-legacy`(湲덉? `233/257/258`留? 쨌 `ambiguous`(?????덇굅??dark 利앷굅媛 주택 硫??꾩뿉 ?덉쓬) 쨌 `clean`. `collapseLegacyDarkWallMap(map)`? **명시?곸쑝濡?dark濡??먯젙??留듭뿉留?* ?곕뒗 ?쒖닔 蹂??援?9醫????variant ??`366`, ?낅젰 留?遺덈?). 주택 留듭? ???추측 蹂??????먮옒 `InteriorRoomPlan`?쇰줈 walls瑜??ъ깮?깊븳?? ambiguous 留듭? ?덈? ?먮룞 蹂寃쏀븯吏 ?딅뒗??
- The old terrain-template system is removed. Do not add `tileset.terrainTemplates`, terrain-template panels, or `*_terrain_template` tools back; structure knowledge now flows through house kits (`build_house_kit`) plus dirt/sand autotile painting.
- Prop/tree scatter (`scatter_object` / `place_props`) protects water, solid terrain, **dirt/sand road surfaces**, occupied upper cells, events, and transfers. Road cells stay passable for movement but must not receive trees. Poisson/cluster modes follow natural-scatter sample rank when space is open; packing filters apply only in tight corridors. Grammarless multi-tile **bag** prop groups (e.g. small-props, house-yard-props, cemetery-props) scatter as **1-cell** random picks. **Combined Town furniture vision (forced):** horizontal bench **327|328** (`bench-horizontal`); vertical chair **358|388** both upper (`bench-vertical`). House-yard (in front of houses): **349** firewood, **350** mailbox, **351** pot, **352** jar. Cemetery (far from houses): **323** cemetery, **353** gravestone, **383** skeleton (not statue). Tables: horizontal **234|235*|236**, vertical **144/174*/204** (mid stretch unlimited). Table chairs: **175** N of table, **176** S, **205** W, **206** E; free chairs **147**/**148**. **202|203** fruit box, **237** wood box, **116/146** wood door, **111|112*|113** stone stairs, **322** wall ladder (upper, passable), **28/58/88** castle windows, **231** magic circle. **Castle map modules** (gold `map_castle_keep` ??full recipe `openwiki/castle-map.md`): roof deck `harness-combined-town-castle-roof-deck` (**18??10**), wall face `??castle-wall-face` (**21/51\*/81**), round tower `??castle-round-tower` (cap upper **24\|25**, neck **138\|139**, body **140\|141**, windows **142\|143**, base upper **54\|55**). Courtyard stays grass; south gate gap + sand approach. **Tool:** `build_castle` stamps modules (default 48횞40; e.g. ?깆콈2=`map_castle_keep_2`). Broadleaf: `harness-combined-town-broadleaf-tree-2x2`.
- **Tileset DB chipset UI:** Database ????쇱뀑 main pane shows the **full chipset sheet** (`tilesetChipsetPreview.ts`) inside a **scroll viewport** (wheel / ?먥넂?묅넃 / middle-drag). Scale **2x(default)/3x/4x**. Layout chain: `rm2k3-tileset-main` ??`tileset-db-edit-area` ??`tileset-db-preview-wrap` ??`.tileset-db-preview { overflow:auto; height:100%; min-height:0 }` so 16-row sheets are not clipped by parent `overflow:hidden`. Layer filter ?꾩껜|?섏쐞|?곸쐞 dims non-matching cells (`layer-dimmed`) ??use **?꾩껜** to see every graphic. **Primary edit: right-click** ??`tilesetTileContextMenu.ts` (?섎?/?듯뻾/?덉씠??번호 복사). Optional **?꾩껜李?*. Map palette still filters by edit layer.
- **Forest = canopy upper + trunk lower on overlapping cells:** A forest is not just dense upper tiles. Conifer/dry tree stamp is **1횞2**: top tile (260/261) on **`upperTiles`**, bottom tile (290/291) on **`lowerTiles`**. Placing a second tree one row south puts its canopy on the same cell as the first tree?셲 trunk ??`lower=trunk + upper=canopy` (the classic RM forest stack). Broadleaf 2횞2: top row upper, bottom row lower. Never put both halves only on upper (they cannot share a cell). Play mode routes **??canopy** (`passageMark === "star"`) into `upperTileLayer` at `MAP_UPPER_LAYER_DEPTH` (250k) so canopies draw above characters. **Solid upper furniture (횞)** (desk/table/bench) is y-sorted with same-priority characters via `mapUpperTileDepth` on the root display list ??never park all upper tiles at 250k or characters sink under desks. Scatter uses layer-aware `footprintFits` so canopy can land on existing trunk lower.
- **Transparent trunk on lower:** Chip 290 etc. are transparent. On **lower** alone they show black holes (no underlay). Editor/play render must composite **grass under trunk** when drawing a tree-trunk lower tile (`createTrunkOnGrassObject` / play `renderTile` grass-then-trunk). Data stays `lower=290` for solid passage; only the draw path adds the grass underlay.
- **Tree pair post-hook (required):** Every tree trunk (lower/upper 290/291/292/293) must have its matching canopy on **upper** of the cell **above** (290??60, 291??61, 292??62, 293??63). Implemented in `repairTreePairsOnMap` / `repairTreePairsOnProject` (`src/project/lint/repairTreePairs.ts`). Runs as write-tool postprocess in `toolRunner` (before commit) and after manual paint/erase/fill in `tileActions`. Orphan trunks on row y=0 are removed (no cell above).
- Selection-based deterministic building palette work lives in `src/editor/panels/buildPalette.ts` and `src/editor/panels/buildPaletteCore.ts`, mounted from `src/editor/panels/editorZoomToolbar.ts`. It consumes `editorState.selection`, stamps path/water/roof/tree/NPC/prop primitives without LLM calls, and routes AI-fill through the existing region task modal/runRegionTask path. The house primitive converts the drag rectangle plus the selected shape (`rect`, `l`, or `u`) into `build_house_kit` wings and exposes the two learned kits (`blue-stone`, `bright-plaster`) plus door-event/interior/window toggles. The village primitive calls `build_village` with `bounds` set to the drag rectangle so the builder's plaza, houses, paths, NPCs, and self-audit stay inside the selected area. When the select tool drag ends, `DragOperationHandler` emits `rpgzzu:ai-selection-context`; `aiChatPanel` arms the bottom command bar with `ai-selection-chip`, focuses the input, and sends Enter through `runRegionTask` until the chip is cleared.
- **Selection action chips** (`src/editor/selectionActionChips.ts`): left-select exposes a floating toolbar on `.phaser-container` (same slot as build palette when palette is off) with **복사(Copy) / 붙여넣기(Paste) / 지우기(Clear) / ✨AI / ✕(Deselect)** buttons plus a `W×H` size label. Paste is **clipboard-gated** (only shown when `editorState.clipboard` exists). Copy calls `copySelection`; Clear calls `clearSelectionRegion` (empties both layers); Deselect calls `clearSelection` (clears selection + pastePreview). **Paste preview mode:** Ctrl+V or the Paste chip enters `editorState.pastePreview = {x,y}` — a semi-transparent tile ghost follows the cursor (`renderPastePreviewGhost` in EditScene); left-click confirms via `confirmPastePreview` (commits `pasteClipboard` + auto-selects pasted region + toast); Esc/right-click cancels via `cancelPastePreview`. Placement: `fixedSelectionChipsPosition` pins the toolbar to the **bottom-right** of the canvas; CSS: `.selection-action-chips { position:absolute; z-index:30; backdrop-filter }`. `mapClipboard.ts` owns `enterPastePreview`/`movePastePreview`/`confirmPastePreview`/`cancelPastePreview`/`clearSelection`/`clearSelectionRegion`. Esc handling is layered: `handleEscapeKey` in EditScene cancels paste preview first, then clears selection.
- **Canvas work area fill:** `.editor-canvas-scroll-shell` uses `--editor-canvas-chrome-top` / `--editor-canvas-chrome-bottom` (Figma shell: 48px / 54px to match toolbar reserve + 54px statusbar). `.phaser-container` is `display:block; width/height:100%` (not fixed 1024횞768). `fitCanvas()` resizes Phaser to the host rect.
- AI `create_map` in `src/editor/tools/mapTools.ts` creates plain grass maps by default; only `border: "wall"` adds the old TILE.WALL outer frame. House harness kits in `src/editor/houseKit.ts` add upper-layer windows by default on wall mid rows (`windows: false` preserves exact golden layouts).
- **Map tree vs `project.maps`:** the map list UI (`mapList.ts`) only walks `project.mapTree`, not every key in `project.maps`. Orphan maps (written into `maps` without a tree node ??e.g. ad-hoc scripts) are invisible until reattached. `create_map` / UI `addMap` always update the tree. Load/normalize runs `repairMapTreeOrphans` (`src/project/mapTree.ts`, from `store.normalizeCurrentProject`) to attach orphans as root children and prune dead nodes. Prefer `create_map` over raw `maps[id]=??.
- **Market / deck harness (Combined Town):** engine modules still use deck tiles body **222**, edges **228/229/230/192**, rails, etc. (`stampMarketHarness` hardcodes chips). **AI v3 construction tools no longer take `*VocabId` / harness group ids** ??use `material` = tile **label/description** (e.g. `"臾?`, `"침�뿽??`, `"?섎Т ?곸옄"`, `"??吏?踰?`). Resolve via `resolveMaterialByLabel` / `tile_query ask:"labels"`. **Shop pattern:** transparent `action` event **on counter tile** runs `shop`; merchant NPC behind counter is chat-only. Village map: `buildVillageShoppingStreetProject` / `map_village_shopping_street`. Large 100횞100: `buildLargeRiverMarketVillageProject` / `map_large_river_market_village`.
- **AI assistant viewport context:** `EditScene` publishes camera tile viewport via `editorMapViewport.ts`. Each chat turn prepends center coords + visible rect (`mapViewportContext.ts`) and, in-browser, a low-detail viewport map image on the user message. System map summary clips to viewport when present (not always top-left).
- **Default LLM/auth path:** new settings default to `authMode: "chatgpt"` with factory default provider `google-antigravity` (`gemini-3.7-flash`), alongside `openai-codex` (`gpt-5.6-sol`). OAuth acquisition and token refresh are owned directly by this repository in plain Node (`src/ai/oauth/` and `scripts/lib/aiAuthRuntime.ts`), so Bun is not needed for authentication routes. Completions run through the loopback Bun worker (`scripts/oh-my-pi-worker.ts`), which serves a single `/complete` route receiving an already-resolved `apiKey` with no credentials stored in the worker. Two front-ends share the router (`scripts/lib/ohMyPiHttp.mjs`): **DEV** mounts the handlers same-origin inside the vite dev server via `codexOAuthPlugin` in `vite.config.ts` (`DEFAULT_CHATGPT_BASE_URL` is `/v1` when `import.meta.env.DEV`), so `npm run dev` alone is enough with no second terminal. **PREVIEW / `dist/`** falls back to `127.0.0.1:17832`; `npm start` runs `scripts/start-preview.mjs`, which opens that companion in-process before vite preview, so preview no longer boots with AI silently unreachable (`npm run ai:oauth` still starts it standalone). Never expose OAuth tokens to browser local storage.
- **AI harness blow-ups (2026-07 lake-clear incident):** (1) `get_map_region` must mark lake autotiles as `~` via `isMapWaterTile` and return `data.water.bounds` ??do not rely on `TILE.WATER` alone. (2) `toolResultForModel` omits `lower`/`upper` matrices; `show_map_region` clamps to 24횞24. (3) Lake/road clear needs `confirmDestroy:true` on clear assets (water is non-grass ?쐀uilt??. (4) Avoid full-map 52횞52 vision scans.
- Hunting-ground authoring tools live in `src/editor/tools/mapTools.ts`: `set_encounter_table` replaces a map's weighted/conditional encounter table, and `make_hunting_ground` appends a field spawn while optionally setting matching encounter entries. Keep schemas provider-compatible with plain object/array/string/number/boolean types and validate troop ids plus tile rect bounds before writing. **`parseFieldSpawn` must carry every field the caller sends (2026-08-29):** `factionId`, `footprint`, `passRows`, `persistKill`, and `onKillSwitchId` were dropped on the floor, so an authored faction override or kill persistence vanished the moment a spawn went through this tool, and `make_hunting_ground` could not express the per-spawn faction that `make_action_enemy`'s `spawn.factionId` already wrote. All five are now optional `make_hunting_ground` parameters, validated before the write: ids must be non-blank, `footprint.width`/`height` and `passRows` must be at least 1, and `onKillSwitchId` must name an existing `project.switches` row (`switch-not-found`). Omitted keys stay absent, so existing callers serialize byte-identically. Contract: `test/mapToolsFieldSpawn.test.ts`.
- Farming authoring uses `GameMap.farmableArea` plus crop/item database records. The write tool `create_farm_plot { mapId, area }` only declares farmable tile rects and must not paint soil/fences or mutate tile layers. The write tool `define_crop` upserts `database.crops[]` records and validates seed/harvest item ids. Regenerate `scripts/generated/toolCatalog.json` whenever these schemas change.
- Event editing flows are split across `src/editor/eventActions.ts`, `src/editor/eventPages.ts`, `src/editor/eventDraftActions.ts`, `src/editor/eventDeletion.ts`, `src/editor/eventCommandFactory.ts`, and `src/editor/eventCommands/`.
- **이벤트 에디터 Option A 레이아웃 (2026-08-27):** `src/editor/panels/eventEditor/` 셸 레이아웃을 Option A 규격으로 정렬한다. 모달 상단 타이틀바(`event-editor-titlebar`)는 편집 가능한 이름(`event-editor-name`), ID, 좌표, `테스트` 버튼과 함께 헤더 페이지 세그먼트(`[data-testid^=evt-page-segment]`)를 포함한다. 기존 모달 본문의 넓은 페이지 탭 스트립(`.event-page-number-tabs`, `event-page-strip`, `event-page-tab-*`)은 완전히 제거된다. 좌측 설정 레일(`event-editor-settings-column`)은 최대 4개 그룹의 요약 아코디언(`details > summary` 구조: 조건, 그래픽, 트리거/우선순위, 이동 빈도/경로)으로 구성되며 각 그룹의 summary에 현재 설정 요약 텍스트가 노출된다. 명령 목록(`event-editor-commands-column`)은 행 클릭 시 선택 하이라이트가 적용되고 더블클릭 또는 Enter로 편집 대화상자를 열며 행별 '편집' 버튼은 노출하지 않는다. 우측 통합 인스펙터(`event-editor-inspector-column`)는 선택한 명령의 상세 필드와 라이브 프리뷰를 일체형으로 표시한다. 하단 푸터(`event-editor-modal-footer`)는 단일 primary 액션인 `저장하고 닫기`(`event-editor-save`)만 제공한다. 모달 루트 testid는 `event-editor-modal`을 유지한다. 테스트: `test/e2e/event-layout-optiona.spec.ts`, `test/eventEditorHierarchyShell.test.ts`, `test/eventEditorBalancedShell.test.ts`, `test/eventEditorSettingsLayout.test.ts`, `test/eventEditorStoryboardBranches.test.ts`, `test/eventEditorUiDensity.test.ts`, `test/eventEditorModal.test.ts`.
- **이벤트 에디터 계층 재배열 (2026-08-27, 아래 Option A 항목을 상위 갱신한다):** 타이틀바(48px)는 **페이지 세그먼트를 담지 않는다**. `renderClassicPageTabStrip` 은 2줄 리치 탭이라 48px 헤더에서 수직 오버플로우를 일으켜 탭이 화면 상단에 잘렸다 (실증: BEFORE `header.overflowY = true` → AFTER `false`). 헤더는 이름·ID·좌표·NPC 짱·`페이지 n/N` 카운터(`event-editor-header-page-count`)·테스트·닫기만 가진다. 세그먼트의 유일한 집은 `.event-editor-pagebar` 행이며, 한 줄로 유지된 채 가로 스크롤한다.
- **컬럼 라벨:** 항상 마운트되는 두 컬럼은 자기 역할을 직접 말한다 — `event-editor-column-label-settings`(`이 페이지 설정`), `event-editor-column-label-commands`(`이 페이지가 하는 일`) + 명령 개수 배지 `event-editor-command-count`. 인스펙터 컬럼은 선택 전에는 `hidden` 이라 라벨을 부이지 않는다 — 인스펙터 렌더러가 host 를 `replaceChildren` 하므로 거기에 라벨을 넣으면 지워진다.
- **「이 페이지가 하는 일」 목록은 실행 순서를 화면에 적는다 (2026-08-30):** 칼럼 라벨은 예전부터 «위에서 아래로 차례대로 실행됩니다» 라고 약속했지만 그 순서를 적는 표시가 목록에 하나도 없었다 (스토리 보기는 이미 원형 번호를 갖고 있었으므로 두 보기가 어긋나 있었다). 이제 `commandList.ts` 의 모든 행이 드래그 핸들 다음 칸에 `.cmd-step`(`event-command-step-<경로>`)을 단다. 계약:
  - **번호는 자기 컨테이너 안에서 1 부터 다시 시작한다.** 분기 안이라는 범위는 바로 위 분기 헤더 줄(`renderBranchDropLine`)이 말하므로 `2-1` 같은 점 표기를 쓰지 않는다.
  - 번호는 **경로의 마지막 칸 + 1** 이다. 중간 칸을 이어 붙이면 안 된다 — `choices` 의 `branchIndex` 는 선택지 인덱스(음수 아님)라서 실행 순서가 아닌 칸이 번호에 섞인다. 다른 분기들은 음수 상수(`FORK_THEN_BRANCH_INDEX` 등)라 부호로 걸러지는 것처럼 보이지만 `choices` 가 그 가정을 깬다.
  - **개수 배지는 목록에 보이는 줄 수를 센다** — `totalCommandCount()` 가 `eventCommandBranches` 로 분기 속 명령까지 재귀로 센다. 예전에는 `activePage.commands.length`(상위만)여서 8줄이 보이는 페이지에 `4개` 라고 적혀 있었다.
  - **`.cmd-empty-line` 은 한 번 클릭으로 명령 피커를 연다.** 예전에는 `<button>` 인데 `dblclick` 만 들어서 한 번 누르면 아무 일도 없었고, 라벨 `명령 추가 — 더블클릭 또는 위 [+ 명령]` 이 자기가 아닌 툴바 버튼 이름을 부르고 있었다. 지금 라벨은 `+ 여기에 명령 추가` 다.
  - **카테고리 배지(`.cmd-cat-icon`)는 좁은 폭에서도 낱말을 지우지 않는다.** `@media (max-width: 1050px)` 가 `::after { display: none }` 으로 낱말을 지워 24px 글리프만 남겼는데, 이 줄이 어떤 종류의 일인지 알려주는 유일한 표시가 칼럼이 좁아질 때 정확히 사라졌다 (실측 1024 폭: 행 740px, 요약문 넘침 없음 → 아낀 26px 가 아무 값도 없었다). 이제 글꼴·패딩만 줄인다. 스토리 보기의 `.event-storyboard-card-cat` 도 같은 계약이다.
  - 계약 테스트: `test/eventEditorCommandBoard.test.ts` (번호 순서·개수 일치·한 번 클릭). 증거: `output/evidence/event-do-column/{before,after}/`.
- **설정 레일:** 폭 **268px** (228px 에서는 `맵에서 숨기기` 라벨이 잘렸다). 아코디언 그룹은 `pageProps.ts` 의 `railGroup()` 팬토리가 만들며 `data-rail-group` 과 `evt-rail-meta-<slug>` 를 발행한다. 제목과 요약은 **그리드 행을 나눠** 생기므로 `모습과 대화그래픽 없음` 처럼 붙지 않는다 — 이전에는 아코디언 CSS 가 아예 없었다. NPC 관계와 일정은 `evt-rail-group-npc` (기본 접함)으로 내려가 페이지 설정보다 조용해진다. 진입점은 `appendEventRailGroup()`.
- **명령 툴바:** 플로팅 보조 도구 스트립(`event-command-quick-tools`)은 사라진다 — 명령 목록 아랫부분을 가리는 중복 표면이었다. 다섯 버튼은 **testid 그대로** 툴바 오른쪽 `.event-editor-command-aux-group` 으로 이사한다 (`event-command-quick-ai|preview|storyboard|flow|next` — `preview` 는 2026-08-30 에 중복으로 제거됐다, 아래 항목 참조). 따라서 `openCommandPicker(page, "quick-next")` 기존 e2e 진입점 9건은 그대로 살아 있다. 툴바 읽는 순서는 CSS `order` 가 소유한다: `+명령`(primary) 왼쪽 → 검색 → 보조 액션 → 뷰 토글 + aux 오른쪽.
- **중복 제거:** 페이지 스트립의 `명령 N` 칩은 제거됐다 (명령 컬럼 라벨이 개수를 소유). `pages-meta` 는 경고가 있을 때만 만들어진다.
- **검증 경고 행:** `.event-draft-validation` 은 `.event-editor` flex 컬럼에서 `flex: 0 0 auto` 를 받는다 — 이전에는 유생한 flex 자식이라 모달 아래로 밀려 `경고 1` 이 잘렸다.
- **증거와 계약:** `test/eventEditorLayoutHierarchy.test.ts` 가 DOM 계약을 잡고, 진단 스펙 `test/e2e/_event-editor-layout-shots.spec.ts` (`EVIDENCE_TAG=before|after`) 가 5개 상태를 1440×900 에서 촬영하고 기하·콘솔 에러를 JSON 으로 남긴다. **초보 모드는 이벤트 목록 패널(`event-list-row-*`)을 마운트하지 않는다** — 아이콘 레일만 있으므로 e2e 진입은 `openSeededEventEditor` (맵 더볼클릭) 를 사용해야 한다.
- **Option A 계층 구조:** 헤더(타이틀 + 페이지 세그먼트 + 테스트) + 본문 워크벤치(좌측 4그룹 요약 아코디언 레일 228px, 중앙 명령 목록, 우측 통합 인스펙터 340px) + 단일 primary 저장 액션 푸터. 검증 피드백은 세그먼트 배지 및 푸터 상태 텍스트로 전달된다.
- **Event editor shell density (Option A layout, 2026-08-27):** `src/editor/panels/eventEditor/` chrome aligns to Option A layout. The titlebar holds the editable name (`event-editor-name`), ID, coords, header page segments (`[data-testid^=evt-page-segment]`), and `테스트` action. The legacy wide page-tab strip in the modal body is removed (`.event-page-number-tabs`, `event-page-strip`, `event-page-tab-*` absent). The left settings rail (`event-editor-settings-column`) is organized into a 4-group summary accordion (`details > summary` for conditions, graphic, trigger/priority, autonomous movement) with live summary copy. Command editing uses click-select to highlight rows, double-click or Enter to open the edit dialog (removing per-row 편집 buttons). The right integrated inspector shows the selected command details and preview directly. Footer contains exactly one primary save action `저장하고 닫기` (`event-editor-save`). Modal root testid stays `event-editor-modal`. Tests: `test/e2e/event-layout-optiona.spec.ts`, `test/eventEditorHierarchyShell.test.ts`, `test/eventEditorBalancedShell.test.ts`, `test/eventEditorSettingsLayout.test.ts`, `test/eventEditorStoryboardBranches.test.ts`, `test/eventEditorUiDensity.test.ts`, `test/eventEditorModal.test.ts`.
- **Current hierarchy (Option A):** titlebar with integrated page segments + workbench + footer with single primary save. Workbench starts two-column (`228px / minmax(0,1fr)`) with a 4-group summary accordion rail on the left; inspector (`340px`) opens on row selection. Validation is a segment badge plus footer status line, not a full-width identity band. Retained actions remain mounted and keyboard reachable.
- **Event AI 명령 도크 (2026-08-28, 아래 「Event AI assist card」 항목을 상위 갱신한다):** `aiAssist.ts` 는 **「이 페이지가 하는 일」 칼럼의 마지막 그리드 행에 붙는 인플로우 도크**다. 예전에는 도구 팝오버 안의 칩이 `position:absolute` 카드로 열려 **자기가 명령을 넣을 목록을 덮었다** (실측: 1440 폭에서 cmd-list 면적의 46%, 1024 폭에서는 전폭). 삽입 위치를 못 보면서 삽입 위치를 고르라는 구조였다. 계약:
  - **진입점은 하나** — 툴바 `event-command-quick-ai` 가 도크를 토글한다(`aria-expanded` 반영). 도구 팝오버에는 AI 칩이 없다. 예전에는 같은 「AI 명령」 라벨이 툴바와 팝오버에 동시에 떠 있었다.
  - **칼럼 그리드는 `auto minmax(0,1fr) auto`** (`event-editor.balanced.css`). 암시 행으로 내버려 두면 1fr 이 줄지 않아 도크가 모달 밑밖으로 밀려난다(실측: 900 높이에서 도크 밑이 1016).
  - `event-editor-ai.css` 가 도크를 `max-height: min(46vh, 420px)` 로 묶어 cmd-list 행이 항상 남는다. cmd-list 와의 겹침 면적은 **0** 이어야 한다.
  - **Escape 는 도크만 닫는다** — 열릴 때 `registerModal` 로 모달 스택 최상단이 된다. 예전에는 프롬프트를 쓰다 Escape 를 누르면 이벤트 에디터 전체가 닫혔다.
  - 열면 프롬프트에 **포커스**가 가고, **Ctrl/Cmd+Enter** 로 생성한다.
  - **삽입 위치를 항상 말한다** (`ai-event-target`): 선택이 없으면 「맨 아래에 이어서 넣습니다」, 있으면 「「<명령 이름>」 다음에 넣습니다」. 삽입 버튼 라벨도 같이 바뀐다. 선택은 스토어 갱신 없이 클래스만 바뀌므로 cmd-list 클릭·도크 열기마다 다시 읽는다.
  - **상태 배지는 한국어**(`생성 중`/`오류`/`초안 N개`/`작성 중`) — 예전엔 `busy`/`error`/`ready`/`draft` 영문 토큰이 노출됐다. 오류 문구는 사람이 다음에 할 일을 앞에 두고 검증기 원문을 `—` 뒤에 붙인다. 사용자가 입력을 고치면 지난 오류는 스스로 사라진다.
  - 프롬프트 예시 칩(`ai-event-example-*`)은 입력만 채운다(자동 생성 금지).
  - 가드: `test/eventCommandAssist.test.ts`, `test/e2e/event-editor-aux-non-occlusion.spec.ts`(겹침 0 · Escape 범위 · 포커스), 증거는 `output/evidence/event-ai-assist-ux/960x900-compact.png`.
- **Event AI 초안 표시·프롬프트 계약 (2026-08-30, 실측 기반):**
  - **초안은 보기 방식보다 우선한다.** `content.ts` 의 `applyViewMode` 는 초안이 있으면 `stagedHost` 를 무조건 보인다. 예전에는 스토리·미리보기에서 `stagedHost` 를 숨기면서 목록도 숨겨, 기본 보기(스토리)에서 「위 목록에 표시했어요」라고 말하며 **아무것도 보여주지 않았다**. 기존 e2e 는 도크를 열기 전에 「목록 보기」를 눌러 이 경로를 지나지 않았다.
  - **완료 렌더는 살아 있는 도크로 간다.** `aiAssist.ts` 의 `liveDock` 이 현재 렌더 인스턴스를 들고 있고, 생성 완료 콜백은 자기 클로저가 아니라 그쪽에 그린다. 생성 중 스토어가 갱신되면(본문 재렌더) 예전 코드는 문서에서 떨어져 나간 `stagedHost` 에 그려 초안이 영원히 안 보였다. 재렌더된 도크는 `statusKind === "busy"` 면 생성 버튼을 계속 잠근다.
  - **리소스 저작 능력을 유지한다.** `playAudio`/`showPicture`/`changeFace`/`playMovie`를 kind 목록에서 빼지 않는다. `collectResourceIds(project)`에서 실제 id를 최대 `MAX_REF_ENTRIES`개 실으며, 잘못된 id는 기존 참조 검증과 자가수정 루프가 막는다. 얼굴과 소리는 이벤트 저작의 일급 기능이라 프롬프트 모순을 이유로 기능 자체를 삭제하지 않는다.
  - **transfer 는 런타임이 실제로 착지시키는 칸으로만 보낸다.** 맵 참조 목록에 `가로 W × 세로 H` 와 `밟을 수 있는 칸 예: x=… y=…`를 싣고, `parseAndValidate`가 맵 밖 좌표와 `isPassableLanding` 실패 좌표를 반려한다. 이 공용 판정은 `isPassable && 네 방향 중 canMove 하나 이상`이며 런타임 `nearestPassableTile`도 그대로 쓴다. 따라서 한 방향 비트만 열린 함정 칸을 AI 게이트가 허용한 뒤 런타임이 조용히 재배치하는 불일치가 없다. 착지 가능한 칸이 맵 전체에 하나도 없을 때만 기존 안전 밸브대로 반려하지 않는다. 실측: 같은 요청에서 `(0,0)`(벽) → `(10,7)`.
  - **생성 시작 목록이 낙관적 동시성 기준이다.** `aiAssist.ts`는 await 전에 `page.commands`를 직렬화하고, 완료 시 store의 같은 페이지를 다시 읽어 비교한다. 생성 중 사용자가 목록을 고쳤으면 초안을 만들지 않고 「명령 목록이 생성 중에 바뀌었어요」 오류와 재생성 안내만 남긴다. `liveDock`은 현재 같은 key의 도크에만 DOM 렌더를 보내며 페이지 전환·에디터 닫기 뒤에는 상태만 저장한다. 에디터 close 이벤트와 테스트 reset은 `liveDock`을 비워 분리된 DOM 클로저를 남기지 않는다.
  - **실측 도구:** `scripts/event-ai-live-probe.mts` (`emit` / `run` / `score`) + `src/benchmark/eventAi/scenarios.ts` 12 시나리오. 도크 예시 버튼에 박힌 문장을 그대로 쓴다 — 앱이 스스로 권하는 문장이 실패하면 그게 제품 결함이다. 결과는 `reports/event-ai-probe/<run>/REPORT.md`.
  - 가드: `test/e2e/event-ai-dock-defects.spec.ts`(기본 보기 · 생성 중 재렌더), `test/eventCommandAssist.test.ts`(kind 노출 · 좌표 검증). 증거 스크린샷: `test/e2e/_event-ai-adv-shots.spec.ts` → `verify-shots/event-ai-adv/`.
- **Event AI assist card (2026-08-24):** `aiAssist.ts` presents the flow as prompt → draft generation → result review → explicit insertion. The prompt has a visible `<label>`, its helper copy is connected with `aria-describedby`, generation feedback uses a polite status region, and the result region stays hidden until commands exist. `event-editor-ai.css` owns the readable rhythm (`13px/1.65`, 96px minimum prompt height, `12px/1.65` preview rows); `03-legend-toolbar.css` caps the floating card at 680px and keeps it out of command-list flow. At `1180px` or below, opening the AI chip must raise the aux tools above the compact command inspector instead of letting the inspector cover the prompt. Guards: `test/eventCommandAssist.test.ts` and `test/e2e/event-editor-aux-non-occlusion.spec.ts`; the latter writes `output/evidence/event-ai-assist-ux/960x900-compact.png`.
- **Event editor background persistence:** nested command/page/picker dialogs use a translucent warm scrim so the event editor remains visible behind them. Full view keeps a narrow scrim edge, and Escape exits full view without dropping the editor from `modalStack`. `test/e2e/event-editor-backdrop-persistence.spec.ts` tours the mounted button families and guards the same root backdrop across interactions.
- **Mockup parity maintenance (2026-08-24):** `eventEditorMockupShots.spec.ts` guards the `실행 내용 · N개` header, compact toolbar menus, conditional validation control, and the initial/selected viewport matrix at 1586, 1440, 1280, 1024, 960, and 800px widths. Historical screenshots and `new-editor/REPORT.html` document the earlier layout only; they must not force removed legend, recommendation, or bottom-strip chrome back into the product.
- **미리보기는 「이 페이지가 하는 일」 컬럼의 세 번째 보기 (2026-08-28, 아래 2026-08-30 항목이 툴바 부분을 갱신한다):** 보기 토글은 `목록 / 스토리 / 미리보기`(`event-view-toggle-list|storyboard|preview`) 세 칸이고, 미리보기를 고르면 `event-page-preview-host` > `event-page-preview` 가 명령 컬럼 전체 폭·높이를 그대로 쓴다. 미리보기 모드는 `oprn:storyboard-mode` 에 **저장되지 않는다**(저작 보기 = 목록/스토리만 남는다).
- **분기 열거는 `eventCommandBranches` 가 정본이다 (2026-08-30):** `src/editor/eventCommandBranches.ts` 의 `eventCommandBranches(command)` 가 분기 목록·라벨·경로 칸(`branchIndex`)·목록 마커 톤(`tone`)을 **한 곳에서** 준다. 뷰는 자기 목록을 갖지 않는다 — 네 뷰와 두 비-뷰 호출부가 전부 얇은 어댑터다: `commandList.ts:appendCommandChildren`(목록), `storyboardView.ts:branchesOf`(스토리), `previewSimulation.ts:branchesOf` + `walkWithSimulation`(미리보기·플로우), `tools/commandTraversal.ts:commandBranches`(프로젝트 순회), `eventDraftValidator.ts:commandBranches`(검증). **분기를 새로 만들면 정본에만 추가한다.** 왜 강제인가 (실측): 예전에는 열거 함수가 다섯 벌이었고 그중 셋이 상점 실패 분기(`failedTransactionBranch`)를 빠뜨렸다 — 런타임 `player/interpreter/resume.ts:38-40` 은 실행하는데 목록·플로우·미리보기에는 줄이 안 났고 검증도 그 안에 못 들어갔다(화면에 없는 분기는 모르고 지워진다). `commandList.ts` 는 `SHOP_FAILED_TRANSACTION_BRANCH_INDEX`(-12) 를 import 조차 안 해서 주소를 매길 수도 없었고, `previewSimulation` 의 `inn` 은 거울상으로 정상 분기를 빠뜨렸다. 라벨 규약은 **「언제 실행되나」를 답하는 `~때` 꼴**이다 (`조건이 맞을 때` / `조건이 맞지 않을 때` / `취소했을 때` / `반복할 내용` / `거래했을 때` / `거래하지 못했을 때` / `골드가 부족할 때` / `이겼을 때` / `성공했을 때` …). 예전에는 같은 조건 분기가 뷰마다 `참` / `참일 때` / `조건이 맞을 때` / `조건을 만족함` 네 이름이었다. 분기 «있음» 판정은 **배열이 있으면 있음**(빈 배열 포함) 또는 플래그가 켜져 있으면 있음 — 빈 분기를 찾아 명령을 밀어 넣는 호출부가 있으므로 «비어 있지 않음» 으로 좁히지 말 것. 목록 뷰의 묶음 끝 마커는 `branchGroupEndLabel`. 계약: `test/eventCommandBranchesSingleSource.test.ts`.
- **파생 보기 입구는 보기 세그먼트뿐이다 (2026-08-30):** 툴바 aux 버튼 `event-command-quick-preview`(`▶ 미리보기`) 와 `event-command-quick-flow`(`⌘ 플로우 보기`) 는 **둘 다 없다**. 각각 세그먼트 `event-view-toggle-preview` / `event-view-toggle-flow` 와 같은 화면으로 들어가는 중복 컨트롤이었다. aux 그룹에 남는 것은 `event-command-quick-ai` 하나뿐이고, `renderCommandAuxGroup` 의 `open(selector)` 헬퍼도 함께 사라졌다(`renderCommandToolbar` 의 `onOpenPreview` 배선도 그때 제거).
- **플로우는 네 번째 보기 방식이다 (2026-08-30, 위 「미리보기는 …세 번째 보기」 항목을 상위 갱신한다):** 보기 토글은 `목록 / 스토리 / 미리보기 / 플로우`(`event-view-toggle-list|storyboard|preview|flow`) **네 칸**이다. 플로우를 고르면 `event-page-flow-host` > `event-page-flow`(`<section>`) 가 명령 컬럼을 그대로 쓴다. 미리보기와 플로우는 **배타적**이므로 겹칠 오버레이가 없다. 저장 대상은 저작 보기(`목록`/`스토리`)만 — `AUTHORING_MODES` 가 그 목록이고, 확인 보기는 `oprn:storyboard-mode` 에 남지 않는다.

  왜 옮겼는가 (실측 2026-08-30): 예전 플로우는 `도구` 팝오버 안 `event-script-flowchart` details 였고, 본문에 `position:absolute; max-height: min(72vh,760px); right:0` 이 걸린 오버레이였다. (a) 미리보기 **위에** 떠서 「자동 재생」 버튼과 단계 카운터를 덮었고, (b) 팝오버 폭에 묶여 618×280 밖에 못 썼다 — 플로우는 분기를 **가로로** 벌리므로 폭이 특히 아프다(최상위 명령 7개 중 2개만 보였다). (c) 겹쳐 뜬 동안에도 미리보기가 몇 번째 단계인지 알려주지 않았다.

  단계 이어받기: `stepByPage`(모듈 지역 `Map<auxCompositeKey, index>`)에 미리보기가 현재 단계를 쓰고, 플로우가 읽어 그 노드에 `.is-current` + `aria-current="step"` 을 붙이고 `event-page-flow-current` 에 `미리보기 현재 단계 n/총` 을 쓴다. **인덱스로 짝지으면 안 된다** — `breakLoop` 은 뒤 명령을 걷지 않고 빠져나오므로 「단계 n번째」와 「노드 n번째」가 어긋난다(가드가 이 경우를 직접 만든다). 그래서 `SimulatedStep.path` 가 목록·스토리와 **같은** 편집 경로를 들고 다니고, 플로우 노드는 `data-cmd-path` 로 같은 주소를 찍어 경로로 맞춘다. `onSelect` 를 주면 노드가 `<button>` 이 되어 목록·스토리와 같은 인스펙터를 채운다. 계약: `test/eventPageFlowView.test.ts`.

  남은 testid: 본문은 `event-flowchart-body` 그대로(스크롤 컨테이너 CSS 재사용), 노드는 `event-flow-node-<kind>`, 분기 라벨은 `.event-flow-branch-label`. 사라진 것: `event-script-flowchart`, `event-flow-chip-status`, `event-command-quick-flow`. `auxOpenController` 의 `"flow"` 슬롯은 더 이상 바인딩되지 않는다.
- **미리보기 무대 기하 (2026-08-30):** `.ecp-stage` 는 `aspect-ratio: 4/3` + `place-items: end center` 다. 명령 편집 다이얼로그의 좁은 컬럼에서는 맞지만, 미리보기는 명령 컬럼 전체 폭을 쓰므로 무대가 스크롤 뷰포트보다 높아진다 (실측 2560×1440: 무대 1737×1303, 뷰포트 1030 → 하단 정렬된 메시지 창이 fold 밖, 문장 표시 명령이 «빈 흰 박스» 로 보였다). `event-editor.command-preview/01-event-editor-modern-import.css` 의 `.event-page-preview .ecp-stage { max-width: calc(58vh * 4 / 3) }` 가 높이 기준으로 폭을 제한해 4:3 을 지키며 한 화면에 넣는다. 무대 안이 비어 보이면 렌더러가 아니라 이 기하를 먼저 의심할 것 — `renderCommandPreview` 는 텍스트를 정상적으로 넣는다.

  왜 옮겼는가 (실측 2026-08-28, `verify-shots/page-preview-probe/02-preview-open.png`): 예전 미리보기는 `도구` 팝오버 안 `event-script-live-preview` details 였고, 그 본문에 `position: absolute; max-height: min(280px, 42vh)` 가 걸려 있었다. 무대는 486px 로 자라는데 본문이 280px 이라 무대 아래쪽과 캡션이 잘렸고, 팝오버가 스토리보드 위에 겹쳐 글자가 서로 뚫고 나왔다. 즉 미리보기가 열려도 볼 수 없었다.

  구성: `renderEventPagePreview({ mapId, eventId, page })` 가 미리보기 패널을, `renderEventPageFlow({ mapId, eventId, page, onSelect })` 가 플로우 패널을 만든다(예전 `renderEventScriptModernViews` 는 둘을 한 번에 만들었고, 그 다음 세대인 `renderEventScriptFlowchart` 는 팝오버 아코디언을 만들었다 — 둘 다 없다). 스텝 조작 testid(`event-script-live-prev|next|play`)와 무대·캡션 testid(`event-script-live-stage|caption`)는 그대로다. `auxOpenController` 의 `"preview"`·`"flow"` 슬롯은 더 이상 바인딩되지 않는다 — 컨트롤러는 범용이라 슬롯 자체는 남겨 뒀다.

- **Storyboard trust surface (2026-08-25):** **Storyboard is the default authoring view**; List remains the complete reorder/context-menu surface. Storyboard is a vertical scan view: top-level commands keep full authored dialogue in the DOM, and every path-bearing branch (choice/fork/loop/shop/inn/promotion/evolution/battle) recursively exposes descendants at arbitrary depth with exact selectable command paths. Selected cards publish `.is-selected` plus `aria-current="step"`. The inspector's current-edit action switches persisted card density back to the mounted form before focusing it; closing returns focus to the selected Storyboard control. “미리보기 새로고침” rerenders from current command data rather than claiming runtime playback restart. The add card opens the normal command picker and is labelled as command addition, not scene or AI generation.
- **Event editor windowing (2026-08-24):** the title bar exposes full view (`Alt+Enter`, title-bar double click); Escape restores windowed geometry before a later Escape reaches the modal close guard. The settings/canvas separator supports pointer drag, Arrow keys (`Shift` for the large step), Home/End, and double-click reset with separator ARIA values. Full view disables outer drag/resize and restores the previous inline width/height/transform.
- **적대적 UI/UX 정리 (2026-08-27, 위의 「명령 툴바」 항목을 상위 갱신한다):**
  - **명령 행 클릭 계약이 실제로 배선됐다.** `commandList.ts` 의 행 `click` 은 예전에 곧바로 편집 모달을 열었고 `showCommandInspector()` 는 재렌더 복원 분기(`sameInspectorPath(path, selectedCommandPath())`) 안에서만 호출됐다. 그 조건은 `showCommandInspector()` 자신이 세우는 값이라 영원히 거짓이었고, 그래서 "선택한 명령" 인스펙터 칼럼은 도달 불가능한 빈 칼럼이었다(실측: `hidden=true, width=0`). 이제 **한 번 클릭 = 선택 + 인스펙터**, **더블클릭·Enter/Space·우클릭 「편집」 = 편집 모달** 이고 행 tooltip 도 그대로 말한다. 계약 테스트: `test/eventEditorInspectorSelection.test.ts`.
  - **툴바 중복 제거.** `event-command-quick-next`(툴바 `+ 명령` 을 대신 클릭) 와 `event-command-quick-storyboard`(목록/스토리 세그먼트를 대신 클릭) 는 삭제됐다. 남은 aux 는 `event-command-quick-ai` 하나다(2026-08-30 에 `preview`·`flow` 도 세그먼트와 중복이라 제거됐다 — 위 「파생 보기 입구」 항목). e2e 헬퍼 `test/e2e/eventStoryboardPicker.ts` 의 `PickerEntryPoint` 는 `"quick-next"` 이름을 유지하되 살아있는 `event-command-toolbar-add` 를 가리키므로 기존 스펙 8개 호출부는 그대로 돈다.
  - **라벨은 잘리지 않는다.** `toolbarButton()` 이 `title.split(" ")[0]` 으로 라벨을 만들어 "다시 실행"→"다시", "AI 명령"→"AI", "다음 행동"→"다음" 이 되던 것을 고쳐, 아이콘과 온전한 한국어 라벨을 따로 받는다.
  - **1024px 툴바는 줄바꿈한다.** 이전에는 `+ 명령` 프라이머리가 열 왼쪽 밖으로 잘렸다(실측: 버튼 `left=222` vs 열 `left=268`). `03-legend-toolbar.css` 가 툴바 행을 `flex-wrap: wrap` + 자동 높이 행으로 고정하고 프라이머리는 라벨 폭을 유지한다.
  - **죽은 identity 카드 제거.** `display: none` 인 채 DOM 에 남아 있던 `.event-editor-card` 와 그 안의 `window.alert` 기반 「ⓘ 이벤트 정보」 버튼, 도달 불가능한 `event-position-x/y` 좌표 입력이 사라졌다. 이벤트 위치 검증(`event.position.out-of-bounds`) 의 이동 대상은 헤더의 보이는 좌표 표시 `event-editor-coords` 로 옮겼다.
  - **네이티브 대화상자 금지.** 이벤트 에디터는 `window.alert` / `window.confirm` 을 쓰지 않는다 — 페이지 삭제와 「그 외 분기」 삭제는 앱의 `showConfirm` 을 쓴다.
  - **문구·프리뷰 정직성.** 좌측 레일 「움직임과 속도」 요약은 raw enum(`fixed`) 대신 `movementTypeChipLabel()` 의 한국어 라벨을 쓴다. m2 명령 본문의 리소스 프리뷰는 종류를 보고 렌더한다 — 오디오(music/sound) 필드는 640×500 "그림을 고르세요" 이미지 우물을 만들지 않고 선택한 음악을 한 줄로 알린다. 도움말도 staged 폼의 현실대로 "값을 고르고 확인을 누르면 적용됩니다." 로 바뀌었다.
  - **적대적 프로브:** `scripts/qa-event-editor-ux.mjs --label <tag>` 가 위 계약 9개를 실제 브라우저에서 판정하고 하나라도 깨지면 exit 1 이다. 증거는 `.omo/evidence/event-editor-ux/<tag>/`.
- **셀프 스위치 조건 행:** `selfSwitch`는 간단 행에 표시된다(고급 전용 아님). 컨트롤은 `conditionForm.selfSwitchControl` — 세그먼트 A/B/C/D 버튼 + ON/OFF 토글. 첫 번째 selfSwitch는 간단 행, 초과분은 고급 목록. `setSelfSwitch` 명령 본문도 동일 컨트롤 사용.
- **호감도 조건은 NPC 관계 게이트를 UI 에서도 말한다 (2026-08-28):** 런타임 `resolveSocialKey` 는 `event.id` 로 폴백하지 않으므로 NPC 키가 비었고 이벤트에 `characterId` 도 없으면 `friendshipAtLeast` 는 **항상 거짓**이다(`docs/specs/2026-07-14-character-id-relationship-gate.md` §1-7). 예전에는 `renderPageConditions` 의 event 인자가 `_event` 로 미사용이라 조건 행이 이 사실을 감췄고 자리표시자는 "비우면 이 이벤트" 라고 거짓말했다. 지금은 `renderPageConditions` → 컨텍스트 `hostHasCharacterId` → `renderFriendshipAtLeastCondition({ hostHasCharacterId })` 로 흐르고, 미연결 + NPC 키 공백이면 자리표시자가 "NPC 키를 적어야 합니다" 로 바뀌며 `event-condition-friendship-requires-character-id` 힌트가 붙는다(고급 목록 행은 `event-page-advanced-condition-friendship-requires-character-id-<i>`). **행을 숨기거나 잠그지는 않는다** — NPC 키를 직접 적는 저작 경로는 미연결에서도 유효하고, RM 계약상 핵심 조건 행은 항상 자리를 지킨다. 같은 조합은 검증기가 `condition.friendship.no-character-id` 경고로도 잡는다. 계약 테스트: `test/friendshipConditionGate.test.ts`.
- **검증 이슈 앵커는 닫힌 레일 그룹을 연다:** 좌측 레일 그룹은 `<details>` 가 아니라 `is-open` 클래스라서 `navigateToEventDraftIssue` 의 details 여는 로직만으로는 못 열었다. `openEventRailGroupFor(target)`(`pageProps.ts`)이 앵커가 속한 그룹을 활성 그룹으로 바꾼 뒤 포커스한다. 조건·그래픽·이동 이슈 전부가 이 경로를 탄다.


## Condition / Loop / Variable command trust fixes (2026-08-07)
- `conditionForm.ts`: 빈 스위치/변수/배우/아이템 인라인 에러, all/any 빈 그룹 경고, 종류 전환 시 값 캐시 복원(되돌리기 유실 방지), 변수 비교값 정수 절삭 일관화.
- `commandBodyVariable.ts`: 소스 전환 값 캐시 보존, 숫자 입력 소수 절삭 방지(정수 표시), 0 나누기/오버플로 경고 배지, 대상·소스 변수 빈 ID 에러. 렌더 중 상태변경 제거.
- `commandBodyLoop.ts`: 빈 본문/무한루프(탈출 없음) 경고, breakLoop 탈출 배지, 작업 중 staged 동기화, 삭제 후 포커스 복원.
- `session.ts` / `previewSimulation.ts`: 변수 나눗셈을 `Math.trunc` + `+/-9,999,999` 클램프, 0 나누기는 유지+경고(로그), `clampVariableValue`/`VARIABLE_MIN|MAX` 노출.
- `stack.ts`: `breakLoop`가 루프 밖에서 스택을 증발시키지 않도록 가드 — 루프 없으면 경고만, `hasLoopFrame` 추가. 최대 반복 100,000 가드는 유지.
- `eventDraftValidator.ts`: `loop.break-outside-loop` / `loop.empty-body` / `loop.no-break` / `variable.divide-by-zero` / `condition.all|any.empty` 경고/에러, 기존 레퍼런스 검증과 함께 커밋 게이트에서 노출.
- `conditionEvalPreview.ts`: 프리뷰 평가를 `startSession` 고정에서 `previewSimulation` 시뮬 상태 기준으로 승격(작가-플레이어 괴리 완화).
- 스타일: `event-editor.part-3/08-inline-validation-badges.css` 인라인 에러/경고 배지.

## Event draft trust loop (2026-07-30)
- Opening an event starts an editor-only draft through `eventDraftActions.ts`. Existing events keep their pre-open canonical body in `draft.original`; new events use `draft.kind:"new"`. Editor map markers, event lists, and drag operations intentionally read `editorWorkingEvents()` so the open working body remains visible, while persistence and runtime consumers use the canonical projection described in `runtime-project-schema.md`.
- Apply and OK run the aggregate validator before `saveEventDraft`; Cancel restores `draft.original` or removes a new draft. The modal checkpoints the working body into `eventDraftVault.ts` and project-scoped localStorage so an autosave merge, remote reload, or interrupted editor render cannot blank the open event. Footer text distinguishes local recovery/draft state from actual Supabase autosave state; “로컬 복구” is never presented as remote success.
- Empty pages render six beginner paths in `eventEditor/content.ts`: dialogue NPC, item-reward treasure chest, transfer, shop, battle, and blank/search. The treasure starter compiles to `changeItem += 1` with the first existing item and refuses when the database has no item; reusable item storage remains the separate `openChest` (`보관 상자`) command. Its editor form presents local/shared storage scope, names shared storage in author-facing language, and previews the two-way bag ↔ chest interaction without exposing runtime keys. `eventBeginnerTemplates.ts` otherwise seeds only map/item/troop ids that exist in the current project, chooses a passable transfer cell deterministically, and refuses with an explicit message when a required record does not exist. Each valid starter still opens the normal command edit dialog before insertion.
- Dialogue command previews use the runtime `--runtime-dialogue-*` dark-glass tokens for `.ecp-message-window`, speaker tabs, faces, and choices. Preserve the preview DOM/testids and keep transparent, face-left/right, bust/full, position, and choice states visually aligned with `src/styles/dialogue.css`.
- Reactive modal renders preserve settings/command scroll, focused testid/command row, text selection, selected command, and open details. The command picker shortcut is Ctrl/Cmd+K. Focus restoration and draft Cancel behavior are covered by `test/eventEditorTrustLoop.test.ts`; pure starter safety is covered by `test/eventBeginnerTemplates.test.ts`.

## Guided story arc facade

`author_story_arc` is the deterministic high-level path for bounded tutorial objectives, executable choice branches, and an optional twist reveal. It compiles only to existing event text/choices/fork/setSwitch/setVariable commands plus quest graphs and story-flag metadata, reports the created identifiers, and rejects empty objectives or branch bodies. It is a structural authoring aid, not an automatic prose-quality or story-quality judge.

## 지도·화면 효과 탭 초보자 UX (2026-08-27)
- **전수 감사:** 명령 피커 3탭 45항목을 playwright로 전부 열어 스크린샷(`.omo/evidence/event-map-items/before|after/`)과 항목별 감사(`audit-before.md`)로 남겼다. 고유 다이얼로그 44개가 A형(설명카드+요약+미리보기)과 B형 레거시(기타 명령 껍데기, 9건: m2-026/030/066/078/201/202/205/207/212)로 갈라진다. B형 껍데기 통일은 아직 미착수 — 후속 과제.
- **적용된 픽스:** (1) `isM2CatalogEntrySelectableInMap`이 m2-055(Show Animation 중복 등재)를 맵 피커에서 제외 — 카탈로그 엔트리는 저장 프로젝트 호환을 위해 유지. (2) 조명 설정(setLighting) 입력을 0~1 → 밝기(%)/100 스케일로 통일하고 암전/AMB/주변광 3중 용어를 "밝기"로 정리(`commandBodyPage3Native.ts`, `commandPreview.ts` lightingStage/caption). (3) 카메라 프리뷰의 내부 토큰(panTo 등)은 `CAMERA_MODE_LABELS`로 한국어화. (4) 타일 변경(changeTile)에 실맵 캔버스 미리보기 추가(`change-tile-map-canvas`, drawTransferMapPreview 재사용). (5) 프리셋 칩 세로 쪼개짐 방지 CSS(`05-force-modern-actor-page3.css`: nowrap+min-width fit-content). (6) parallax 병기 문구 정리.
- **계약 테스트:** `test/eventMapItemsBeginnerUx.test.ts`. e2e 증거: `_event-map-items-after.spec.ts`.

## 은퇴한 명령(deprecated) 레지스트리 (2026-08-28)

- 정본은 `src/project/eventCommands/m2CatalogData.ts` 의 **`DEPRECATED_M2_COMMAND_IDS`** 다: `카탈로그 id → { supersededBy, reason }`. 엔트리는 `entry.deprecated` 로 굽혀 나오고, `isM2CatalogEntrySelectableInMap` · `isM2CatalogEntrySelectableInBattleEvent` · `commandPicker` 의 `COMMAND_PAGES` 세 곳이 모든 피커(탭 그리드 + 전교 검색)에서 그 행을 배제한다. 카탈로그 엔트리와 런타임 실행 경로는 남는다 — **저장된 프로젝트는 계속 열리고 돌아간다**. 새로 저작하는 경로만 사라진다.
- 현재 등록: `m2-055-show-animation` → `m2-054-show-animation` (중복 등재, 종전 `entry.index === 55` 하드코딩을 대체), `m2-209-advanced-dialogue` → `m2-001-show-text` (「고급 대화」를 「문장 표시」로 통합).
- **라벨 문자열로 걸지 말 것.** 종전 `commandPicker` 는 `entry.pickerLabel !== "고급 대화"` 로 걸렀는데, `pickerLabelFor` 가 말줄임을 붙여 실제 라벨은 `"고급 대화..."` 이다 — 필터가 한 번도 맞지 않아 "통합했다"고 적어둔 명령이 탭 1 「말하기」에 그대로 살아있었다(실측 2026-08-28).
- 레지스트리 무결성은 카탈로그 모듈을 로드하는 자리에서 즉시 터리는 방식으로 강제한다(없는 id · 없는 `supersededBy` · `supersededBy` 가 다시 은퇴 행). 계약 테스트는 `test/advancedDialogueMerge.test.ts`, e2e 는 `test/e2e/oprn-modern-event-commands.spec.ts` 의 `DEPRECATED_COMMAND_TEST_IDS` 전 탭 부재 단언이다(라벨이 아니라 버튼 testid 로 건다 — 라벨로 걸면 말줄임 드리파트에 단언이 공허하게 통과한다).
- 고급 대화가 남긴 것: 감정·자동 넘김은 문장 표시 폼의 고급 옵션(`event-command-text-advanced`)이고 얼굴은 「얼굴 바꾸기」 명령이다. 저장된 m2-209 행은 로드 시 `rewriteLegacyAdvancedDialogueInProject` (`src/project/io/rewriteLegacyDialogue.ts`) 가 맵 이벤트·페이지·공통 이벤트·전투 이벤트의 최상위 명령 배열과 `commandBranches` 가 열거하는 모든 중첩 분기 배열을 네이티브 `text` 로 1회 정규화하고, 그전에 남은 행은 `m2ModernRuntime` · `commandPreview` 가 그대로 받아 연산한다. `test/advancedDialogueMerge.test.ts` 는 중첩 위치를 `commandBranches` 에서 파생하므로 새 분기 종류가 추가되면 정규화 누락을 분기 이름과 함께 실패시킨다.

## Companion roster in the command picker (2026-08-27)

- The 명령 피커 탭 2 (`동료 · 전투`) opens with a `companion-roster` section rendered by `src/editor/panels/eventEditor/companionRoster.ts`. It lists every `project.database.actors` record with a portrait crop (standalone `faceset` face file first, `charset` idle-front fallback; charset frames are the only single-cell crops left) and inserting through the standard addFollower edit dialog. Cards carry `companion-card-<actorId>` / thumb testids `companion-thumb-<actorId>`.
- `buildFollowerPresets()` exposes ALL database actors as follower preset chips (the legacy first-two-only truncation is gone). The first actor's chip keeps the contract id `preset:companion-hero`; its label embeds the actor name (`동료 주인공 (이름)`). Chip buttons use testid prefix `follower-preset-chip-*`, and actor chips render `follower-preset-thumb-*` portraits via the shared renderer.
- Do not reimplement local actor pickers in companion surfaces — reuse `companionPortraitElement` / existing `actorSheetIcon`. Coverage: `test/companionRoster.test.ts`, `test/followerPresets.test.ts`, and the exhaustive click-through spec `test/e2e/event-companion-command-sweep.spec.ts` (sweeps every tab-2 entry, then asserts DB roster + preset chips with evidence under `.omo/evidence/companion-sweep/`).

## Presentation and system M2 command bodies

- Rich Page-3 presentation and system command bodies live in `src/editor/panels/eventEditor/commandBodyM2Page3.ts`. They render dedicated two-column intent layouts (`page3-command-body actor-m2-command-body`) for screen tint, flash, shake, weather overlays, parallax background, tile swap, picture controls, vehicles, and coordinate queries.
- Visual preview panels mount on the right column via `previewPanel(testId)`. Commands publish specific preview testids such as `tint-screen-preview`, `flash-screen-preview`, `set-weather-effects-preview`, `change-parallax-back-preview`, `show-picture-m2-preview`, and `move-to-variable-location-preview`.
- Screen and weather forms expose interactive color chips and swatch/overlay preview elements (`.actor-m2-chip-grid`, `.actor-m2-preview-actor`, `.actor-m2-preview-copy`). When authors adjust color values, weather intensity, or resource targets, previews update their line and note descriptors immediately.
- TDD behavior contracts live in `test/page3CommandBodies.test.ts` (with interpreter execution coverage in `test/commandContracts/m2Command.contract.test.ts`). Each contract test exercises DOM inputs, verifies staged command replacement via `replaceFields`, and confirms that `executeM2RuntimeCommand` mutates session state as expected.

## 좌측 설정 레일 그룹 소속 (2026-08-27)

- 레일 그룹은 `pageProps.ts` 의 `wrapPageSettingsAsAccordion` 이 렌더된 DOM 을 재부모화해서 만든다.
  각 그룹은 **명시 셀렉터로 claim** 하며, claim 대상은 `source` 의 **직속 자식**으로 승격돼야 한다.
  실측 사고: memory("기억과 정리") 그룹이 겨눈 `event-classic-overlap` 이 `event-page-behavior-sections`
  안에 있었고 그 부모를 when 그룹이 먼저 claim 해서 memory claim 이 0개가 됐다. 그리고 미claim 자식이
  `rail.lastElementChild` 로 흘러들어가 그 그룹은 읽기 전용 칩 3개만 담은 쓰레받이가 됐다(편집 컨트롤 0개).
  그룹 순서만 바꿔도 쓰레받이 위치가 이동하는 위치 의존 버그였다.
- 지금은 미claim 자식이 남으면 조용히 섞지 않고 `evt-rail-group-other`("기타") 로 드러낸다. 새 컨트롤을
  추가하면 그룹 셀렉터에도 등록하라 — 등록을 잊으면 "기타" 그룹이 나타나 `test/eventRailGroupComposition.test.ts`
  가 실패한다.
- memory 그룹의 실제 내용은 겹침(통행 차단)이므로 제목은 "겹침과 통행" 이다. `page.overlapForbidden` 은
  **실행 억제가 아니라 같은 칸 통행 차단**이다(런타임 소비는 통행 판정 4곳). 라벨을 "중복 실행 방지" 로
  되돌리지 말 것.
- 기본값 규칙은 한 곳으로 통일한다: `overlapForbidden !== false` (헤더 요약·칩·체크박스 전부 동일).
- 접힌 그룹의 요약은 사용자가 패널을 펼치기 전에 읽는 유일한 정보다. 원시 enum 을 그대로 쓰지 말라 —
  움직임 그룹은 `movementSummaryText` 로 "정지" / "무작위 · x2 빠름" 을 보여준다.

## 페이지 조건 극성(켜짐/꺼짐) 저작 (2026-08-27)

- 런타임(`src/project/io/pageResolution.ts`)은 `switch.value:false`, `item.present:false`,
  `actor.present:false` 를 정상 평가한다. 그런데 편집기는 항상 `true` 로만 써서 false 방향을 만들 수도,
  데이터에 있는 false 를 볼 수도 없었고, id 를 한 번 바꾸면 조용히 true 로 뒤집혔다.
- 세 조건 행은 각각 극성 select 를 가진다: `event-page-switch-condition-value`(on/off),
  `event-page-item-condition-present`, `event-page-actor-condition-present`(present/absent).
  체크박스 재활성 경로는 기존 `condition.value` 를 보존한다. 계약은 `test/eventPageConditionOffValue.test.ts`.
- 이동 속도 select 는 런타임 `clampSetting` 과 같은 1~8 범위를 제시해야 한다(이전에는 1~6 이라 7·8 저작 불가).

## 「움직임과 속도」 부피 정리 (2026-08-29)

- **생활 이동은 두 행이다.** 예전에는 233px 레일에 컨트롤 13개(목적지 5 + 맵 연결 8)를
  `auto-fit minmax(148px, 1fr)` 로 깔았고, 그 폭에서 그리드는 1열이 되므로 실측 13행 세로 스택이었다.
  지금은 「목적지」 행(맵 select + 「맵에서 찍기」)과 X/Y/방향/반복 4칸 행으로 조인다.
  실측(1440 뷰포트, 편집면 529px): 같은 맵 목적지 **10행**, 연결이 있는 다른 맵 목적지 **11행**.
- **맵 연결은 조건부다.** 목적지가 같은 맵이면 `renderMapLinkBlock` 이 빈 블록을 낸다
  (`.event-page-map-link-block:empty { display: none }`) — 같은 맵에서 맵 연결은 뜻이 없다.
  다른 맵인데 연결이 없으면 한 줄로 「‘X’로 나가는 연결이 없습니다」(`--danger`) 만 알리고 폼을 펼친다.
  연결이 이미 있으면 폼을 접고 `event-page-map-link-toggle`(연결 편집/연결 접기) 로만 연다.
  **연결이 없을 때 토글을 같이 내지 말 것** — 할 일이 「연결 추가」 하나인데 버튼 두 개는 어느 쪽이
  본 행동인지 흐린다. 펼침 상태는 `openEventMapLink`(`eventEditorOpenState.ts`) 가 들고 있다.
  패널은 `<details>` 가 아니라 `hidden` 이다 — 레일 그룹이 `<details>` 를 `<div>` 로 갈아치우므로.
- **좌표는 찍는다.** `mapPointDialog.ts` 의 `openMapPointDialog()` 가 「장소 이동」 과 같은
  `drawTransferMapPreview` 미리보기를 띄우고 클릭한 칸을 돌려준다(testid 접두사 방식:
  `<prefix>-dialog|-canvas|-status|-map|-ok|-cancel`). 「맵에서 찍기」 는 숨은 필드가 아니라
  **보이는 select/X/Y 를 갱신**한다 — 검증기 앵커(`event-page-living-target-map`/`-x`)와 손입력
  e2e 경로가 둘 다 살아야 한다.
- **선택 칸 표시는 십자선이다.** 캔버스는 맵 해상도로 그린 뒤 CSS 로 축소되므로, 100×100 맵을 상자에
  맞추면 배율이 0.4 밑으로 내려가 타일 한 칸 테두리(2px)가 1px 미만이 되어 사실상 보이지 않았다.
  `drawMarker()` 는 맵 전체를 가로지르는 십자 안내선(어두운 밑선 + 흰 선) 뒤에 반투명 채움과 2겹
  테두리를 **마지막에** 올린다. 「장소 이동」 미리보기도 같은 함수를 쓴다.
- **사용자 지정 경로는 궤적으로 읽는다.** `previewMoveRoute.ts` 의 `tracePath`/`renderTrajectory`/
  `renderTape`/`svgSupported` 를 내보내 레일에서 재사용한다 — 궤적 썸네일(`event-page-route-thumb`,
  누르면 경로 편집) + 화살표 칩 테이프 + 전체 라벨 한 줄이 가로로 나란히 선다.
  전체 라벨(`event-page-movement-route-summary`) 의 한국어 텍스트는 그대로 둘 것 —
  `test/e2e/oprn-event-pages.spec.ts` 가 "오른쪽 이동" 을 이 요소에서 찾는다.
- **`.event-page-movement-label` 은 `.event-editor` 를 앞에 붙여야 산다.** `core.part-2.css` 의
  `.event-editor label { display: block }` 은 특이도 (0,1,1) 이라 (0,1,0) 짜리 `display: grid` 를
  이기고 있었고, 그래서 이동 그룹의 모든 라벨 행이 세로로 쌓여 높이를 두 배로 먹었다.
- **시각 QA:** `node scripts/qa-event-movement-ux.mjs --label <tag>` 가 정지 → 사용자 지정 →
  생활 이동(같은 맵) → 맵 찍기 → 다른 맵 → 연결 생성 8단계를 실제 브라우저에서 캡처하고
  섹션 높이·행 수·`overflowX` 를 잰다. 증거는 `.omo/evidence/event-movement-ux/<tag>/`.
  기준선(main)에서도 돌아가야 하므로 새 testid 는 optional 로만 본다.

## 조건은 평가기가 셋이다 — 판정 일치를 테스트로 고정한다 (2026-08-29)

같은 17종 `Condition` 유니온(`src/project/types/events.ts:32-55`, 정본 목록
- `relationshipAtLeast` 는 `friendshipAtLeast` 와 같은 소셜 키 규칙을 쓰지만 수치가 아니라 순서 있는 열거(`single | dating | engaged | married`)를 비교한다. 저작 표면 세 곳(간단 행/칩, 고급 목록, fork 조건 폼)에 모두 등록돼 있고, 상태를 바꾸는 명령은 `setRelationship` 뿐이다. 조건만 넣고 명령을 두지 않으면 항상 거짓이다. 연결된 인물이 없으면 `friendshipAtLeast` 와 동일하게 닫힌 채로 거짓이며 검증기가 `condition.relationship.no-character-id` 로 경고한다.
`src/project/commandKindRegistry.ts:103-120`)을 **세 곳**이 각자 평가한다:

| 평가기 | 위치 | 쓰는 곳 |
|---|---|---|
| `evalPageCondition` | `src/project/io/pageResolution.ts:31` | 이벤트 페이지 출현 판정 |
| `evalCondition` | `src/project/session.ts:735` | 맵 조건 분기(`interpreter/commandCatalog.ts` fork) |
| `evaluateCondition` | `src/battle/battleEvents.ts` (내부 함수) | 전투 분기 + 트룹 페이지 |

**활동 조건은 프로젝트의 실제 일정에서 후보를 받는다 (2026-08-29).** `activity` 는 자유 문자열이고
매칭은 완전 일치다. 저작자가 유효한 값을 추측해야 했던 문제를 `collectNpcActivitySuggestions`
(`panels/eventEditor/options.ts`) 로 없앴다 — 모든 맵 이벤트의 `schedule[].activity` 를 모아
`<datalist>` 로 건다. 페이지 간단 행은 `event-page-npc-activity-condition-options`, 분기 폼과 고급
목록은 `${activityTestId}-options` 를 쓴다(고급 목록은 행마다 id 가 달라야 하므로 testId 에서 파생).
**기본값 `work` 는 그대로 둔다** — `editor/tools/eventTools.ts` 의 `dailyRoutine` 이 생성하는 일정이
`activity: "home" | "work"` 를 쓰고 `defaultActivityLine` 이 그 키를 한국어 대사로 번역한다. 즉 `work`
는 이 레포가 인정하는 어휘이지 자리표시자가 아니다. 저작된 기본 콘텐츠는 한국어(`저녁 장터`, `귀가`)를
쓰므로 두 어휘가 공존한다 — 그래서 "영어 기본값" 을 결함으로 보고 빈 값으로 바꾸면 도구가 만든 NPC 를
가리키는 가장 흔한 경우가 깨진다.

**셋이 갈라져 있었다(실측).** `npcActivity` 는 전투에서 하드코딩 `false` 였고,
`friendshipAtLeast` 는 빈 `npcKey` 를 소유 이벤트 `characterId` 로 해석하지 않아 항상 거짓이었다.
둘 다 `src/editor/tools/troopBattlePageTools.ts` 가 모든 `CONDITION_KINDS` 를 받으므로
**저작은 되는데 절대 참이 될 수 없는** 상태였다. 지금은 전투도 소유 이벤트의 활동을 보고,
`resolveSocialKey` 를 **재사용**한다(두 번째 해석 규칙을 만들지 않는다).

**정본 계약은 `test/conditionEvaluatorParity.test.ts` 다.** 17종 × (만족/불만족) 을 세 평가기에
동일 입력으로 먹여 판정 일치를 단언하고, `Object.keys(CASES)` 를 `CONDITION_KINDS` 와 순서까지
비교하므로 **종류를 빠뜨리면 실패한다**. 허용 예외 목록(`ALLOWLISTED_DIVERGENCES`)은 현재 **비어 있다** —
지우거나 채우기 전에 왜 갈라져야 하는지 근거를 남겨라.

### 함정: 부재 타이머는 0초로 읽혀 조건이 참이 된다

세 평가기 모두 `(timers[timerId] ?? 0) <= condition.seconds` 다. 따라서 **타이머가 한 번도 켜지지
않았어도** `seconds >= 0` 조건은 참이다(`0초 이하` 도 참). 이것은 이 엔진의 **의도된 계약**이며
`test/pageConditionsGuarantee.test.ts`, `test/commandContracts/fork.contract.test.ts`,
`test/selfSwitch.test.ts` 가 고정하고 있다 — 거짓으로 만드는 유일한 방법은 **음수** 임계값이다.

RM2K3/EasyRPG 와는 다르다(그쪽은 타이머가 **작동 중**이어야 한다). `PlaySession.timers` 에 running
비트가 없고 `timer stop` 이 값을 지우지 않으므로, RM 정합은 스키마 변경이다. **"고치지" 말고**
저작 시점 경고(`condition.timer.always-true`)로 보이게 두라.

### 고급 조건 목록에서 극성을 벗기지 마라 (D08 재발 방지)

`pageAdvancedConditions.ts` 의 오버플로 행(3번째 스위치, 2번째 아이템/주인공)은 한때
`showValue: false` + `forceTrueOnSwitchChange: true` 로 극성을 **강제**했다. 그래서 그 행은
꺼짐/보유 안 함/파티에 없음을 저작할 수 없었고, 대상 id 를 바꾸면 저장된 `false` 가 조용히 `true` 로
뒤집혔다. 이것은 `ab8f9714` 가 단순 행에서 이미 고친 **P0 결함 D08 이 다른 목록에 남아 있던** 것이다.
계약: `test/eventPageConditionOffValue.test.ts` (오버플로 조건까지 왕복 단언).

### 참조를 비워도 조건을 삭제하지 않는다

대상 id 가 비면 조건을 지우는 대신 **인라인 오류**를 띄운다(분기 폼과 같은 규약).
DB 에서 지워진 유령 참조는 `<id> (없음)` 라벨로 **계속 보인다** — 안 보이게 하면 저작자가 설정한
극성이 조용히 유실된다. 회귀: `test/pageItemCondition.test.ts`(유령 itemId 표시),
`test/pageConditionAuthoringIntegrity.test.ts`(빈 참조 보존 + 비활성 행 조작 시 자동 활성화).

### 조건 미리보기는 모르면 모른다고 말한다

`conditionEvalPreview` 의 판정값은 `boolean | undefined` **3상태**다. 편집기 상태로 판정할 수 없는
조건은 「판정 불가」(`event-condition-eval-undetermined`)를 띄우고, `all`/`any`/`not` 은 3값 논리로
전파한다. 리프는 **값이 아니라 존재**로 게이트한다 — `timer` 는 `Object.hasOwn(timers, timerId)` 일
때만 판정한다. 종전에는 빈 세션으로 평가해서 16종 중 **7종**(timer/timePhase/season/npcActivity/
friendshipAtLeast/battleResult/run)을 틀리게 확신했고, 특히 거의 모든 타이머 조건이 「충족」으로
보였다. 계약: `test/conditionEvalPreview.test.ts`.

### 조건 문구에 내부 토큰을 넣지 마라

`ON`/`OFF`, `AND()`/`OR()`/`NOT`, 생 비교 연산자, `timer1`/`timer2`, `run`,
`completed`/`failed`/`abandoned` 는 사용자에게 보이면 안 된다. 통일 어휘는 켜짐/꺼짐,
보유 중/보유 안 함, 파티에 있음/파티에 없음, 타이머 1/타이머 2,
모두 맞을 때/하나라도 맞을 때/아닐 때, 완료/실패/포기 다. 문장·배지·탭 요약·명령 요약이 전부
대상이며(`pageConditionSentence.ts`, `pageProps.ts`, `commandSummary.ts`) 게이트는
`test/conditionCopyTokens.test.ts` 다.

**조건 행을 접거나 숨기지 마라.** 접기 안은 D09(battleResult·all·any·not 이 화면에서 통째로
사라진 P1 결함)로 되돌아가는 일이라며 명시적으로 거부됐다
(`docs/proposals/2026-08-28-event-editor-ui-improvement.html`). `all`/`any`/`not` 은 페이지 표면에서
읽기 전용 요약 + 삭제로 유지되며, 중첩 저작은 분기(fork) 폼이 담당한다.
