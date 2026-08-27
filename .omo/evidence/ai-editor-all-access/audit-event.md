# Audit: Event editor mutations → AI tool reachability

- Date: 2026-08-26
- Scope read-only: `src/editor/event*`, `src/editor/panels/eventEditor`, `src/editor/tools` event/narrative families, `src/editor/cutscene`, `src/ai` routing, `src/editor/tools/toolRegistry.ts`.
- AI facade: `TOOL_REGISTRY` in `src/editor/tools/toolRegistry.ts` (toolCatalog/toolRunner expose it) + per-domain pinned tools in `PINNED_TOOLS_BY_DOMAIN`; low-level project mutations in `src/editor/tools/eventTools.ts` / `dbTools.ts`.
- Classification: **COVERED** = a registered AI tool achieves the same persisted mutation; **MISSING** = an editor mutation with no AI-facade path; **UI-ONLY** = transient view/clipboard/history state, not a persisted project mutation (no equivalence required).

## Event CRUD

| Editor mutation | Owning source | AI tool / facade | Class |
|---|---|---|---|
| Add event to map | `src/editor/eventActions.ts:addEvent` | `upsert_event` (new id) + `place_npc` | COVERED |
| Create draft event | `src/editor/eventDraftActions.ts:createEventDraft` | `upsert_event` (underlying add) | COVERED |
| Delete event | `src/editor/eventActions.ts:deleteEvent` | `remove_event` | COVERED |
| Restore-after-delete (toast undo) | `src/editor/eventDeletion.ts:deleteEditorEvent` | undo/history via UI; not a persisted mutation | UI-ONLY |
| Move event (x/y) | `src/editor/eventActions.ts:moveEvent` | `move_event` | COVERED |
| Duplicate event | `src/editor/tools/eventTools.ts duplicate_event` | `duplicate_event` | COVERED |
| Update event fields (trigger/condition/sprite/characterId/giftPrefs/giftResponses/talkFriendship) | `src/editor/eventActions.ts:updateEvent` | `upsert_event` (top-level patch preserves omitted fields) | COVERED |
| Event draft save/discard/checkpoint | `src/editor/eventDraftActions.ts:saveEventDraft`/`discardEventDraft`/`checkpointEventDraft` | editor session + localStorage vault (`@/project/eventDraftVault`); not a project-authored mutation | UI-ONLY |

## Command authoring

| Editor mutation | Owning source | AI tool / facade | Class |
|---|---|---|---|
| Append command to root/container list | `src/editor/eventActions.ts:addCommand` | `upsert_event` `{commands}` full-array write; `dbTools` low-level arrays | COVERED |
| Insert command at index | `src/editor/eventActions.ts:insertCommand` | `upsert_event` full-array rewrite (no path-target) | COVERED* |
| Delete command at path | `src/editor/eventActions.ts:deleteCommand` | `upsert_event` full-array rewrite | COVERED* |
| Replace command at path | `src/editor/eventActions.ts:replaceCommand` | `upsert_event` full-array rewrite | COVERED* |
| Page-level command CRUD at path | `src/editor/eventPages.ts` `addEventPageCommandAt`/`insertEventPageCommandAt`/`replaceEventPageCommandAt`/`deleteEventPageCommandAt` | `upsert_event` full-array rewrite | COVERED* |
| Replace whole page command list | `src/editor/eventPages.ts:replaceEventPageCommands` | `upsert_event` `pages[].commands` | COVERED |
| Reorder command within container | `src/editor/eventPages.ts:moveEventPageCommandAt` | `upsert_event` full-array rewrite (order in array) | COVERED* |
| Move command across nested containers | `src/editor/eventPages.ts:moveEventPageCommandAcross` | `upsert_event` full-array rewrite | COVERED* |
| Copy/paste command (clipboard) | `src/editor/panels/eventEditor/commandClipboard.ts:copyEventCommandToClipboard` | transient clipboard — not a persisted mutation | UI-ONLY |
| Command kind factory defaults | `src/editor/eventCommandFactory.ts:newCommand` | `upsert_event` `COMMAND_SCHEMA` | COVERED |
| Command schema/validation | `src/editor/eventDraftValidator.ts` / `eventDraftValidator` | `validateLowLevelCommandArray` / `countLimitedRuntimeSupportCommandsForEvent` | COVERED |

\* Functionally reachable because `upsert_event` replaces the whole `commands` array in one write, so any single-command add/insert/delete/reorder is expressible by resending the full (possibly nested) array. It is not a path-addressed tool — see GAP-2.

## NPC

| Editor mutation | Owning source | AI tool / facade | Class |
|---|---|---|---|
| Place NPC with pages/graphic/trigger | `src/editor/tools/eventTools.ts place_npc` / editor `place_npc` panel | `place_npc`, `make_villager` | COVERED |
| Enumerate/choose charset graphic | `src/editor/panels/eventEditor/npcGraphicPicker.ts` | `list_npc_graphics` + `place_npc` graphic resolution | COVERED |
| NPC characterId (shared friendship key) | `src/editor/eventActions.ts:updateEvent` (characterId) | `place_npc`/`make_villager` `characterId`, `updateEvent` charId | COVERED |
| Gift prefs / gift responses | `src/editor/eventActions.ts:updateEvent` | `make_villager` `giftPrefs`/`giftResponses` (`src/editor/tools/eventTools.ts:119/129`) | COVERED |
| Daily-talk friendship opt-in | `src/editor/eventActions.ts:updateEvent` (talkFriendship) | `make_villager` `talkFriendship` | COVERED |
| Page movement type/speed/frequency + custom route | `src/editor/panels/eventEditor/pageMovement.ts:replaceMovement` | `upsert_event` `pages[].movement`; `place_npc` movement | COVERED |
| Page animation type | `src/editor/panels/eventEditor/pageAnimationType.ts` (`updateEventPage animationType`) | only raw `upsert_event` `pages[]` object (SimplePage shortcut drops animationType) | COVERED (narrow) |
| Villager home/work map connection | `src/editor/panels/eventEditor/pageNpcLiving.ts:upsertConnection` → `project.mapConnections` | none — GAP-1 | **MISSING** |

## Narrative

| Editor mutation | Owning source | AI tool / facade | Class |
|---|---|---|---|
| Store/arc authoring (multi-event narrative) | `src/editor/panels/eventEditor/storyboardView.ts` (view) | `author_story_arc` (`storyArcTools.ts`) | COVERED |
| Declare story flag / query state | `src/editor/tools/storyTools.ts declare_story_flag`/`get_story_state` | `declare_story_flag`, `get_story_state`, `find_flag_usage` | COVERED |
| Quest create/define/lint/verify | `src/editor/tools/questTools.ts` | `create_quest`, `define_quest`, `lint_quest`, `verify_quest`, `generate_walkthrough`, `create_quest_flags` | COVERED |
| Ending define/list | `src/editor/tools/endingTools.ts` | `define_ending`, `list_endings` | COVERED |
| Horror/narrative templates | `src/editor/tools/narrativeHorrorTemplateTools.ts` | `script_cutscene_preset`, `make_horror_loop`, `make_gallery_room` | COVERED |
| Puzzle / examine hotspots | `src/editor/tools/investigationTools.ts` | `compile_puzzle`, `place_examine_hotspots` | COVERED |
| Dialogue text via page | `src/editor/eventPages.ts:setEventPageTextCommand` | `upsert_event`/`place_npc` `lines`/`text` | COVERED |

## Cutscene

| Editor mutation | Owning source | AI tool / facade | Class |
|---|---|---|---|
| Script a cutscene from beats | `src/editor/cutscene/index.ts:compileCutscene` | `script_cutscene` (`eventTools.ts:1949`, `CUTSCENE_BEAT_SCHEMA`) | COVERED |
| Preset cutscene composition | `src/editor/tools/narrativeHorrorTemplateTools.ts` | `script_cutscene_preset` | COVERED |

## Schedule

| Editor mutation | Owning source | AI tool / facade | Class |
|---|---|---|---|
| Add schedule entry | `src/editor/panels/eventEditor/eventScheduleEditor.ts:addScheduleEntry` (`updateEvent schedule`) | `set_npc_schedule` | COVERED |
| Update `when` (timePhase/hourRange/season/dayRange) | `eventScheduleEditor.ts:updateWhen`/`updateScheduleEntry` | `set_npc_schedule` `npcScheduleSchema` | COVERED |
| Update destination/facing/activity | `eventScheduleEditor.ts:updateScheduleEntry` | `set_npc_schedule` (`at`/`facing`/`activity`) | COVERED |
| Delete schedule entry | `eventScheduleEditor.ts:deleteScheduleEntry` | `set_npc_schedule` (empty/omitted schedule clears) | COVERED |

## Common events

| Editor mutation | Owning source | AI tool / facade | Class |
|---|---|---|---|
| Add common event | `src/editor/panels/databaseCommonEventViews.ts:addCommonEvent` | `upsert_common_event` (`dbTools.ts:1125`) | COVERED |
| Update commands | `databaseCommonEventViews.ts:updateCommonEventCommands` | `upsert_common_event` `commands` | COVERED |
| Rename | `databaseCommonEventViews.ts:commonEventNameRow` | `upsert_common_event` `name` | COVERED |
| Trigger control (none/auto/parallel) | `databaseCommonEventViews.ts:commonEventTriggerControl` | `upsert_common_event` `trigger` | COVERED |
| Condition switch | `databaseCommonEventViews.ts:commonEventConditionSwitchControl` | `upsert_common_event` `conditionSwitchId` | COVERED |
| Duplicate common event | `databaseCommonEventViews.ts:duplicateCommonEventButton` | `upsert_common_event` (new id) | COVERED |

## Real gaps

### GAP-1 — NPC living map connection (MISSING)
- Editor: `src/editor/panels/eventEditor/pageNpcLiving.ts:upsertConnection` writes `project.mapConnections` (whole-project array of `MapConnection` with `from`/`to`/`npcEnabled`).
- Source contract: `store.update((project) => { project.mapConnections ??= []; ... push/replace })` — a persisted project mutation.
- AI reachability: `upsert_world_entities` / `link_world_ref` (`worldTools.ts`) operate on world-graph refs, not `mapConnections`; `create_transfer_pair` creates transfer *events*, not connections. `rg mapConnections src/editor/tools` returns only the empty-project default.
- **RED assertion**: `place_npc ... connection` (or new tool) must produce an entry in `project.mapConnections` that round-trips through the villager-living panel — assert `mapConnections` length/content after the tool, else "villager living/home link" authoring is unreachable to the AI.

### GAP-2 — path-addressed per-command insert/move (MISSING as a tool)
- Editor: `src/editor/eventActions.ts:insertCommand`/`moveEventPageCommandAt` and `src/editor/eventPages.ts:moveEventPageCommandAcross` address a single command by a nested container path (e.g. `[0,"branch",1]` inside choices/fork). The AI facade has no path-addressable command tool; it must resend the entire `commands` tree through `upsert_event`.
- Source contract: `resolveCommandListAtPath(commands, containerPath, ...)` + `list.splice(index, 0, cmd)` — the editor mutates one node, preserving the rest untouched.
- Reachability cost: whole-tree rewrite on every targeted edit is failure-prone for deep choices/fork branches (the 2026-08-23 "선택지를 만드는 입력이 없다" exposure class).
- **RED assertion**: an introspective command tool (e.g. `upsert` targeting a path) must insert a command at a nested path while leaving sibling commands byte-identical — assert nonzero path-addressed mutation exists (or that a targeted insert is reproducible), else fine-grained branch editing is not directly reachable.

### GAP-3 — page `animationType` reachable only via raw page object (MISSING on high-level facade)
- Editor: `src/editor/panels/eventEditor/pageAnimationType.ts` sets `page.animationType` through `updateEventPage`.
- Source contract: `compileSimplePage` (`src/editor/tools/eventCompile.ts:376`) constructs `EventPage` without `animationType`, and `SIMPLE_PAGE_SCHEMA` (`schemaShapes.ts:120`) omits it — so `place_npc`/`make_villager` (SimplePage path) cannot set the page animation preset.
- Reachability: only reachable by handing `upsert_event` a full `EventPage` object; the high-level NPC authoring facade silently drops it.
- **RED assertion**: `place_npc`/`make_villager` with an `animationType` input must persist that field on the page (and the panel must read it back), else page animation type is effectively unreachable to the AI through the intended NPC facade.

## Routing / exposure notes
- All event/narrative/cutscene/schedule tools are tagged `event` domain in `toolRegistry.ts` (`...withDomain(EVENT_TOOLS,"event")`, STORY_ARC/ENDING/NARRATIVE_HORROR `"event"`) and pinned via `PINNED_TOOLS_BY_DOMAIN["event"]` so trim-to-40 keeps them (`place_npc`, `make_villager`, `script_cutscene`, `script_cutscene_preset`, `set_shop_stock`, `create_transfer_pair`, `place_chest`, `set_scene_mood`, `author_story_arc`, `define_ending`, `list_endings`, ...).
- Common events route through `DB_TOOLS` (`upsert_common_event`, database domain).
- No exposure gaps found in routing for the covered rows; the missing rows above are capability gaps, not trim/exposure gaps.

## Verification
- `rg -n "MISSING|COVERED|UI-ONLY" .omo/evidence/ai-editor-all-access/audit-event.md` — every table row is classified; each MISSING row (GAP-1/2/3) cites its source contract and a proposed RED assertion.
