# Indiside Plugin Research Proposal

Date: 2026-07-06
Status: research proposal
Source inventory: `docs/specs/2026-07-06-indiside-plugin-research-source-inventory.md`

## Purpose

This document distills the Indiside `plugin_script` archive into feature candidates that are worth considering for RPG ZZU's editor. The goal is not to import or copy plugin code. The useful lesson from the archive is that RPG Maker authors repeatedly used plugins, script calls, note tags, and plugin commands to fill authoring gaps. RPG ZZU should absorb the strongest patterns into native typed editor surfaces.

## Research Scope

- Source board: https://indiside.com/plugin_script/
- Pages reviewed: 15 board pages
- Rows captured: 288 posts, numbered 288 down to 1
- Categories captured: RPGMV plugin, RPGXP script, RPGVX Ace script, RPGVX script, Unity script
- Candidate body pass: 133 representative articles with links, attachments, and theme signals

The source inventory file contains the full 288-row list. This proposal only carries the shortlist and editor mapping.

## Selection Rules

Prefer features that:

- replace fragile plugin-command or script-call workflows with typed RPG ZZU dialogs;
- fit existing ownership boundaries in `src/editor`, `src/project`, `src/player`, `src/battle`, or `src/assets`;
- improve authoring leverage rather than only adding a one-off visual effect;
- can be saved as deterministic project data and validated through editor/play mode;
- are inspired by public feature patterns without copying third-party plugin implementation.

Avoid features that:

- require arbitrary user script execution inside projects;
- exist only as runtime chrome with little editor authoring value;
- would fork RPG ZZU away from its current typed data model;
- would need copyrighted plugin code or bundled third-party assets.

## Priority Shortlist

| Priority | Feature Area | Why It Fits RPG ZZU | Representative Sources |
| --- | --- | --- | --- |
| P0 | Event template and command preset authoring | RPG ZZU already has rich event pages and typed commands. The biggest editor win is reusable doors, chests, shops, NPCs, transfers, cutscene triggers, and generated command trees that remain editable. | [115 Move Route Extras](https://indiside.com/plugin_script/947595), [279 동적 맵 타일 수정](https://indiside.com/plugin_script/1458510), [260 이벤트 자동 추적](https://indiside.com/plugin_script/1346803), [81 액터 선택지 간편화](https://indiside.com/plugin_script/774623), [23 액터 선택지 간편화](https://indiside.com/plugin_script/60969) |
| P0 | Quest/objective, achievement, and map badge authoring | Quest logs, persistent markers, and achievement systems are recurring author needs. They belong in database records plus event commands, not ad hoc plugin strings. | [286 업적플러그인](https://indiside.com/plugin_script/1489026), [274 실적 플러그인](https://indiside.com/plugin_script/1441963), [271 퀘스트 마커 지속 표시](https://indiside.com/plugin_script/1419675), [118 Gameus Quest System](https://indiside.com/plugin_script/947790), [213 퀘스트 스크립트](https://indiside.com/plugin_script/1173950) |
| P0 | Region, proximity, and step-effect authoring | Region/proximity/footstep behaviors are best expressed as visible map semantics. This can power invisible triggers, footsteps, hazards, encounter zones, and event awareness without note tags. | [128 발소리 재생](https://indiside.com/plugin_script/962752), [260 이벤트 자동 추적](https://indiside.com/plugin_script/1346803), [73 특정범위내 이동](https://indiside.com/plugin_script/774593), [42 특정범위내 이동](https://indiside.com/plugin_script/136124), [78 키입력 조건분기](https://indiside.com/plugin_script/774612) |
| P0 | Structured cutscene and message/input authoring | Cutscene, message, choice, keyboard, numeric, and text-input plugins point to better native command dialogs and previews. These should become typed commands, not plugin-command text. | [287 컷신 플러그인](https://indiside.com/plugin_script/1489905), [277 메시지 속도/글자 크기 옵션](https://indiside.com/plugin_script/1458439), [265 텍스트 입력창](https://indiside.com/plugin_script/1376324), [281 커스텀 숫자 입력 패드](https://indiside.com/plugin_script/1463112), [189 Universal Message System](https://indiside.com/plugin_script/1173847), [53 얼굴/대화창 명령어](https://indiside.com/plugin_script/774479) |
| P1 | Runtime map mutation preview and dynamic tile utilities | The project already has a `changeTile` command path. The next useful step is better picking, preview, and multi-tile mutation presets for bridges, doors, rubble, crops, and construction. | [279 동적 맵 타일 수정](https://indiside.com/plugin_script/1458510), [215 문과 상자를 쉽게 만들수 있는 스크립트](https://indiside.com/plugin_script/1173975), [107 Bind Pictures To Map](https://indiside.com/plugin_script/945555) |
| P1 | Picture, menu, input, and common-event bindings | Picture touch, keyboard, menu, and custom input plugins show demand for common events bound to inputs or UI surfaces. RPG ZZU can expose those as typed binding metadata. | [259 픽쳐 터치](https://indiside.com/plugin_script/1340983), [269 Keyboard Event](https://indiside.com/plugin_script/1402614), [265 텍스트 입력창](https://indiside.com/plugin_script/1376324), [281 커스텀 숫자 입력 패드](https://indiside.com/plugin_script/1463112), [214 메뉴에 퀘스트](https://indiside.com/plugin_script/1173972) |
| P1 | Movement and interaction presets | Movement plugins show repeated demand for 8-direction, half-step, follower, jump, footstep, proximity, and pathfinding behaviors. RPG ZZU can expose these as event-page and move-route presets with preview. | [260 이벤트 자동 추적](https://indiside.com/plugin_script/1346803), [257 8방향 이동](https://indiside.com/plugin_script/1319494), [67 반칸이동](https://indiside.com/plugin_script/774561), [185 빠른 길찾기](https://indiside.com/plugin_script/1173841), [155 발소리](https://indiside.com/plugin_script/1173747), [150 기차처럼 따라오는 동료](https://indiside.com/plugin_script/1173740) |
| P1 | Inventory, shop, crafting, storage, and compendium systems | These are database-shaped systems. They should become records, references, and event commands rather than hidden script configuration. | [251 Item Synthesis](https://indiside.com/plugin_script/1280750), [135 Crafting System](https://indiside.com/plugin_script/966871), [123 Hidden Shop Goods](https://indiside.com/plugin_script/948389), [204 상점 아이템 능력치 표시](https://indiside.com/plugin_script/1173884), [165 창고 시스템](https://indiside.com/plugin_script/1173764), [106 EnemyBook](https://indiside.com/plugin_script/943886) |
| P1 | Korean authoring and text localization polish | Korean name input, particles, database text, font, outline, and shadow-text plugins are directly relevant to RPG ZZU's Korean authoring mode and dialogue-heavy projects. | [285 한글조합입력기](https://indiside.com/plugin_script/1479168), [253 한글 이름 입력창](https://indiside.com/plugin_script/1298484), [91 한국어 조사 처리](https://indiside.com/plugin_script/942920), [95 RPG Maker MV 한글 데이터베이스](https://indiside.com/plugin_script/943025), [172 모든 글자 외곽선](https://indiside.com/plugin_script/1173777), [46 대화 글씨 폰트](https://indiside.com/plugin_script/774425) |
| P2 | Battle setup helpers before full HUD/action systems | Battle plugins repeatedly extend HUDs, enemy counts, damage numbers, ATB/action sequences, battle speed, and battle weather/fog. RPG ZZU should start with troop layout and preview helpers before a full action-sequence system. | [288 Mog Battle HUD](https://indiside.com/plugin_script/1492748), [280 More Enemies](https://indiside.com/plugin_script/1460905), [276 한글 데미지 표시](https://indiside.com/plugin_script/1457907), [136 Damage Popup](https://indiside.com/plugin_script/991370), [248 ATB 전투 시스템](https://indiside.com/plugin_script/1174145), [139 전투 도중 멤버교체](https://indiside.com/plugin_script/1036587) |
| P2 | Overlay, lighting, label, offset, and visual presentation tools | Visual plugins are attractive, but rendering tricks need more visual QA and product direction. Start later with event labels and sprite offsets before mirrors or multiple viewports. | [121 Kaus Ultimate Overlay](https://indiside.com/plugin_script/948121), [270 Mirror Area](https://indiside.com/plugin_script/1402623), [258 이벤트 이름 표시](https://indiside.com/plugin_script/1332956), [263 캐릭터 스프라이트 offset](https://indiside.com/plugin_script/1369338), [132 Map Zoom](https://indiside.com/plugin_script/966841) |
| P2 | Runtime options, persistence, and device inputs | Save slots, autosave, preload, gamepad, mouse, and mobile controls are useful, but they touch runtime/session behavior and should follow after editor-native authoring improvements. | [104 SaveManager](https://indiside.com/plugin_script/943710), [102 세이브 갯수 변경](https://indiside.com/plugin_script/943671), [157 자동 세이브](https://indiside.com/plugin_script/1173751), [100 프리로드 매니저](https://indiside.com/plugin_script/943646), [116 모바일 패드](https://indiside.com/plugin_script/947786), [278 XBOX360 컨트롤러 체크](https://indiside.com/plugin_script/1458442) |
| P2 | Procedural map generation tools | Random room, cave, and maze scripts are attractive, but they are larger tools with many design choices. Treat as later editor utilities after map basics are richer. | [237 Random Room](https://indiside.com/plugin_script/1174099), [236 Random Cave](https://indiside.com/plugin_script/1174098), [235 Maze DFS](https://indiside.com/plugin_script/1174096) |

## Recommended Editor Features

### 1. Event Template And Command Preset Authoring

Add reusable event authoring before generic runtime spawning:

- event templates for Door, Transfer, Chest, NPC Talker, Enemy Touch, Shop, Inn, Pickup, and Cutscene Trigger;
- template stamping from the map editor, with each placed instance detaching into normal editable event data;
- command presets that generate ordinary nested command lists for common flows such as reward chests, shop branches, inns, objective updates, and timed cutscene waits;
- an explicit rule that presets must produce visible typed commands rather than hidden macro/script state;
- later, a typed runtime `spawnEventTemplate` command only if play-time event creation becomes necessary.

Primary ownership: `src/editor/panels/eventEditor/`, `src/editor/eventActions.ts`, `src/editor/eventPages.ts`, `src/editor/eventDraftActions.ts`, `src/editor/eventCommands/`, map placement code, and project event schema.

### 2. Quest/Objectives And Achievement Database

Add first-class records for authored progression:

- Quest/objective records with title, description, stages, objectives, rewards, visible state, and marker policy.
- Achievement records with unlock conditions, hidden state, reward hooks, icon, and display text.
- Event commands for start objective, advance stage, complete objective, fail objective, unlock achievement, and show notification.
- Map/event badges for quest-giver and target states.
- A strict split between authored definitions in project data and runtime completion state in play sessions.

Primary ownership: `src/editor/panels/database*.ts`, `src/editor/databaseActions.ts`, `src/editor/databaseRecordMutators.ts`, `src/editor/databaseCommandReferences.ts`, `src/project`, and play-mode notification/menu surfaces.

### 3. Region, Proximity, And Step-Effect Layer

Expose invisible map behavior as visible authored data:

- a semantic Region or Zone paint layer distinct from lower/upper/event tiles;
- region bindings for common events, footstep audio pools, encounter rules, damage/hazard behavior, and display effects;
- proximity trigger presets such as approach player, chase player, flee player, activate within radius, and line-of-sight checks;
- editor overlays that show region ids, linked common events, and step effects;
- focused runtime checks that fire behavior only on matching tiles or proximity rules.

Primary ownership: `src/editor/EditScene.ts`, `src/editor/tileActions.ts`, `src/editor/map*`, `src/editor/runtimeTileMetadata.ts`, project map schema, and play-mode trigger/interpreter code.

### 4. Event Cinematic And Message/Input Toolkit

Add an event-command authoring layer for common cinematic and text patterns:

- cutscene sequence templates that group screen effects, movement, dialogue, waits, and optional battle skill cut-ins;
- message presets with speaker name, face, position, font, speed, outline/shadow, and instant-display toggles;
- typed input commands for text, numeric entry, Korean name entry, and keyboard event simulation;
- choice helpers for actor/party selection and centered or styled choices;
- command preview that shows message layout before saving the event page.

Primary ownership: `src/editor/panels/eventEditor/`, `src/editor/eventCommands/`, `src/editor/eventActions.ts`, and `src/project` command schema.

### 5. Picture, Menu, Input, And Common-Event Bindings

Add typed bindings where RPG Maker plugins usually used script calls:

- common event binding metadata for button/key, player-menu entry, picture id or hit area, and availability switch;
- text and numeric input commands that store results in variables;
- editor preview for picture hit areas if picture touch is added;
- player menu entries that dispatch common events through interpreter-safe paths;
- no direct DOM callbacks or arbitrary user script.

Primary ownership: `src/editor/panels/databaseCommonEventViews.ts`, event command dialogs, `src/editor/panels/resourceManager.ts`, player menu/input surfaces, and interpreter common-event execution.

### 6. Runtime Map Mutation Preview And Tile-Change Utilities

Improve the existing tile mutation authoring path:

- keep `changeTile` as the core typed command;
- let authors pick target coordinates and tiles from a mini map/chipset preview rather than typing ids;
- add multi-tile mutation presets that emit several `changeTile` commands for bridges, doors, rubble, crops, construction, and puzzle state;
- preview map mutations in the editor and selected-event test play;
- keep session tile state separate from authored map data.

Primary ownership: event command dialogs, `src/editor/EditScene.ts`, map preview helpers, tile palette/picking modules, project command schema, and play-mode map mutation handling.

### 7. Database-Backed Gameplay Systems

Treat inventory/economy extensions as data, not plugins:

- crafting recipes and synthesis rules;
- storage/chest records and shared inventory flags;
- item category and carry-limit fields;
- shop detail previews, hidden goods conditions, and price modifiers;
- enemy/monster book records backed by enemy references.

Primary ownership: database modal tabs, database references, project defaults/migrations, and play-mode menu surfaces.

### 8. Movement And Interaction Presets

Expose frequently scripted movement behaviors as editor presets:

- 8-direction and half-tile movement settings where the runtime can support them;
- event auto-follow/pathfinding commands with route preview;
- proximity trigger and approach-player templates, once the region/proximity layer exists;
- follower train settings and party visibility controls;
- footstep sound regions tied to terrain/tile metadata;
- jump and side-scroll templates marked as advanced because they can affect collision rules.

Primary ownership: event page properties, move-route dialogs, `src/editor/eventDraftActions.ts`, runtime movement/session code, and map metadata.

### 9. Battle Setup Helpers

Start with editor-visible controls that are easier to validate:

- troop placement that scales past the classic small enemy count;
- auto-arrange enemy positions and warn about overlap or viewport overflow;
- compact battle layout preview before launching battle test;
- damage popup localization and formatting settings;
- battle weather/fog and HUD/cut-in fields as later presentation work;
- action sequence templates only after battle command and presentation boundaries are stable.

Primary ownership: `src/battle`, battle database records, troop/event pages, and editor database panels.

### 10. Korean Authoring And Text Localization Polish

Fold Korean-specific plugin patterns into the editor:

- Korean name input command and runtime input surface;
- Korean particle helper for dialogue/database text;
- font, outline, and shadow preview in message authoring;
- localized default database sample records;
- line-fit and overflow warnings for compact dialogue and menu UI.

Primary ownership: event command dialogs, database text fields, player dialogue rendering, and Korean authoring URL flags.

### 11. Overlay, Lighting, Label, Offset, And Visual Presentation Tools

Keep visual enhancement work behind editor-first basics:

- named overlay layers for fog, light, parallax, and map-bound pictures;
- layer-map style composition where a map can reference another map as a visual layer;
- event labels and sprite offset fields in event page graphics;
- mirror/reflection regions for water or glass as a later renderer task;
- minimap and map-name display settings per map;
- zoom and camera preset controls for authored scenes.

Primary ownership: `src/editor/EditScene.ts`, `src/editor/tileActions.ts`, `src/editor/panels/tilePalette.ts`, `src/editor/tileset*`, `src/assets`, and project map schema.

### 12. Save, Project-State, Resource, And Preload Utilities

Handle these selectively because RPG ZZU already has explicit persistence ownership:

- resource import validation for audio/image formats;
- project export diagnostics for missing or unused resources;
- preload hints for large projects;
- explicit separation of editor autosave, project export, and player save slots;
- no asset encryption or DRM-like workflows in the editor core.

Primary ownership: `src/editor/saveActions.ts`, `src/project/store.ts`, resource manager panels, and import/export helpers.

## Suggested Implementation Waves

1. **Authoring acceleration wave**: event templates, command presets, quest/objective records, map badges, and map mutation preview. This gives immediate editor value without requiring broad renderer or battle rewrites.
2. **Semantic map behavior wave**: region/proximity/step-effect layer, picture/menu/common-event bindings, and the first Korean text/input preview improvements. These touch runtime triggers and input, so they need focused play-mode verification.
3. **Database systems wave**: crafting, storage, item limits/categories, shop conditions, enemy/monster book records, and related reference scanning.
4. **Presentation and systems polish wave**: battle troop layout helpers before HUD/action systems, overlay/lighting/event labels/sprite offsets, resource diagnostics, preload hints, save-slot policy, and procedural map tools only when product direction is clearer.

## Validation Expectations

For future implementation PRs:

- Data-shape changes should include load, migrate, save, and play checks.
- Editor UI changes should be driven through the browser editor surface with focused evidence.
- Event/database changes should include focused tests around command serialization and reference scanning.
- Map presentation changes should verify both editor preview and play-mode rendering.
- Runtime options should include persistence/session tests where relevant.

For this proposal PR, docs-only validation is enough:

```bash
git diff --check -- docs/specs/2026-07-06-indiside-plugin-research-proposal.md docs/specs/2026-07-06-indiside-plugin-research-source-inventory.md
```

## Open Questions

- Should quest and achievement records be shipped together, or should achievements be a smaller first slice?
- Should dynamic tile mutation be stored as event commands only, or also as reusable named map operations?
- Should runtime event spawning exist, or are editor-only event templates enough for the first release?
- Should region/proximity behavior use one shared semantic layer, or separate region, audio, hazard, and encounter layers?
- Should Korean text polish live behind the existing Korean authoring flag or become always-available text tooling?
