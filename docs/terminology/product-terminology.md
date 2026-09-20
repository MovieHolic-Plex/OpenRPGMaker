# Korean-English Product Terminology

> Generated from `src/project/terminology/`. Do not hand-edit — run
> `npm run terminology:docs` after changing the source, and
> `npm run terminology:check` to validate it.

- Terminology schema: 1
- Document language: ko
- Updated: 2026-09-09
- Entries: 103

> Preparatory localization reference. Adopting an entry never requires editing an existing string.
> Korean is canonical: an entry records the term the product already uses, plus the one approved English rendering.
> Entries carrying a uiCopyKey must agree with src/editor/uiCopy.ts; the check enforces it.
> Not a locale file, not a message catalogue, and not a translation runtime.

## How to reference a term

Cite the semantic key, never the string. `map.layerGround` stays correct after
any relabelling; "바닥" does not. Resolve a key with `terminologyByKey`, and go
the other way with `terminologyByKorean` / `terminologyByEnglish`.

## Terms

### EditorShell

| key | 한국어 | English | role | surface | note |
| --- | --- | --- | --- | --- | --- |
| `shell.topBar` | 상단 바 | top bar | noun | editor | The single row of editor controls; not the browser or OS title bar. · accepted 한국어: 스튜디오 바 |
| `shell.canvas` | 캔버스 | canvas | noun | editor | The Phaser map surface only; the tile picker is a palette, not a canvas. |
| `shell.commandPalette` | 명령 팔레트 | command palette | noun | editor | Ctrl+K search surface. Never shorten to 팔레트 / palette — that means the tile palette. · accepted 한국어: 명령 · 맵 · 스킬 검색 팔레트 |
| `shell.editorMode` | 편집 모드 | editor mode | noun | editor | Beginner/Standard/Expert density choice; unrelated to the paint tool in use. |
| `shell.modeBeginner` | 초보 | Beginner | noun | editor |  |
| `shell.modeStandard` | 표준 | Standard | noun | editor |  |
| `shell.modeExpert` | 전문가 | Expert | noun | editor |  |
| `shell.viewMenu` | 보기 | View | noun | editor | Menu holding panel layout, density, and editor mode. |
| `shell.help` | 도움말 | Help | noun | editor | The entry point (button and menu); the document it opens is shell.helpGuide. |
| `shell.helpGuide` | 에디터 가이드 | editor guide | noun | editor | The in-app manual itself, titled separately from the Help entry point. |
| `shell.testPlay` | 테스트 실행 (짧게: 테스트) | test play (short: Play) | action | editor | Running the edited game from the editor. Not the automated test suite — never translate as "run tests". · retired 한국어: 시연 실행, 실행 · never in English: run tests, preview |
| `shell.battleTest` | 랜덤 전투 테스트 (짧게: 전투) | random battle test | action | editor |  |
| `shell.mapEventSearch` | 맵·이벤트 찾기 (짧게: 찾기) | map and event search (short: Find) | action | editor |  |
| `shell.undo` | 되돌리기 | undo | action | editor | Canonical Korean follows the visible toolbar button; 실행취소 survives in the shortcut list. · accepted 한국어: 실행취소 |
| `shell.redo` | 다시실행 | redo | action | editor |  |

### MapEditing

| key | 한국어 | English | role | surface | note |
| --- | --- | --- | --- | --- | --- |
| `map.map` | 맵 | map | noun | both | One authored grid of tiles and events. Never "scene", "area", or "level" — those read as different objects. · accepted 한국어: 지도 · never in English: scene, area, level, room |
| `map.mapTree` | 맵 트리 | map tree | noun | editor | The hierarchical list of maps in the left panel. |
| `map.mapSettings` | 맵 설정 | map settings | noun | editor | English is "settings", not "properties": 속성 is already the elemental attribute (db.element). · never in English: map properties, map attributes |
| `map.startMap` | 시작 맵 | start map | property | both |  |
| `map.startPosition` | 시작 위치 | start position | property | both |  |
| `map.layerGround` | 바닥 | ground layer | noun | editor | Drawn under the character. Stored id stays `lower`; 하위 / "lower layer" was retired as a literal 下層 rendering. · retired 한국어: 하위, 하위 레이어 · never in English: lower layer |
| `map.layerOverlay` | 상위 | upper layer | noun | editor | Drawn over the character. Stored id stays `upper`. 덧그림 was the 2026-08 screen name; 장식 is refused because it is a tile role (tile.decoration). · retired 한국어: 덧그림, 덧그림 레이어 · refused 한국어: 장식 · never in English: decoration layer |
| `map.layerEvent` | 이벤트 | event layer | noun | editor | The Korean label is the bare word 이벤트; English must keep "layer" so it cannot be read as event.event. |
| `map.toolPaint` | 칠하기 | paint | action | editor | Tool labels name the action, not the instrument — that rule is why 펜 and 브러시 were dropped. · retired 한국어: 펜, 브러시, 브러시(연필) · never in English: pen, brush, pencil |
| `map.toolErase` | 지우기 | erase | action | editor |  |
| `map.toolFill` | 채우기 | fill | action | editor | Flood fill of the connected same-tile region; the toolbar spells that out in full. · accepted 한국어: 이어진 영역 채우기 |
| `map.toolSelect` | 영역 선택 | select region | action | editor |  |
| `map.toolPickTile` | 타일 집기 | pick tile | action | editor | "eyedropper" is the icon and the internal tool id, not the label. · never in English: eyedropper |
| `map.toolPan` | 화면 밀기 | pan | action | editor |  |
| `map.toolPassabilityOverlay` | 통행 표시 | passability overlay | action | editor | The tool that shows and toggles walkability; the tile datum itself is tile.passability. |
| `map.toolPlaceEvent` | 장면 놓기 | place event | action | editor | Korean says 장면 ("scene") but the object created is an event — English must not say "place scene". · never in English: place scene, scene tool |
| `map.selectedRegion` | 선택 영역 | selected region | noun | editor | The rectangle a right-drag leaves behind, and the scope an assistant task is allowed to touch. |
| `map.structure` | 구조물 | structure | noun | editor | A stamped multi-tile placement on a map; the reusable source is map.structureKit. |
| `map.structureKit` | 킷 | structure kit | noun | editor | The saved tile block a structure is stamped from; its shelf is db.structureKits. |
| `map.zoom` | 배율 | zoom level | property | editor |  |

### TilesetSemantics

| key | 한국어 | English | role | surface | note |
| --- | --- | --- | --- | --- | --- |
| `tile.tile` | 타일 | tile | noun | both | One cell-sized graphic. The grid cell it occupies is 칸 / cell. |
| `tile.tileset` | 타일셋 | tileset | noun | both | Chipset image plus its metadata. "chipset" names only the source PNG; the on-screen picker is tile.tilePalette. · accepted 한국어: 타일 그림판 · never in English: chipset, tile palette |
| `tile.tilePalette` | 타일 팔레트 | tile palette | noun | editor | The left-panel picker showing one tileset. Not the tileset itself and not shell.commandPalette. |
| `tile.autotile` | 오토타일 | autotile | noun | both |  |
| `tile.passability` | 통행 | passability | property | both | Whether a cell can be walked through. The editor overlay is map.toolPassabilityOverlay. |
| `tile.decoration` | 장식 | decoration | noun | editor | A tile role (palette filter chip, tileMeta role `decoration`). Reserved — must not be reused for map.layerOverlay. |
| `tile.unlabeled` | 미분류 모아보기 | unlabeled tiles | noun | editor | Tiles with no semantic label yet, collected for triage. |

### EventAuthoring

| key | 한국어 | English | role | surface | note |
| --- | --- | --- | --- | --- | --- |
| `event.event` | 이벤트 | event | noun | both | The authored object placed on the event layer. The layer is map.layerEvent; one instruction inside it is event.command. |
| `event.eventEditor` | 이벤트 편집기 | event editor | noun | editor |  |
| `event.page` | 페이지 | page | noun | editor | One conditional branch of an event, not a tab and not a screen — the last page whose condition holds is the one that runs. · never in English: tab, sheet |
| `event.command` | 명령 | command | noun | editor | One instruction inside a page. Distinct from shell.commandPalette entries and from db.battleCommands. |
| `event.condition` | 조건 | condition | property | editor | The page-level test deciding whether a page is active. |
| `event.graphic` | 그래픽 | graphic | property | editor | An event's appearance (character sprite or face). The underlying file is a resource.resource. |
| `event.moveRoute` | 이동 경로 | move route | noun | both |  |
| `event.commonEvent` | 공용 이벤트 | common event | noun | both | A project-wide event not bound to a map cell. |
| `event.switch` | 스위치 | switch | noun | both | A named boolean of game state; not a UI toggle control. · never in English: toggle |
| `event.variable` | 변수 | variable | noun | both | A named number of game state; never a source-code variable. |
| `event.npc` | NPC | NPC | noun | both | Left untranslated in both languages; the assistant's Korean label for creating one is 사람 만들기. |
| `event.shop` | 상점 | shop | noun | both |  |
| `event.inn` | 여관 | inn | noun | both |  |

### DatabaseRecords

| key | 한국어 | English | role | surface | note |
| --- | --- | --- | --- | --- | --- |
| `shell.database` | 자료집 | database (short: DB) | noun | editor | The record editor modal. Do not render as "library" — 보관함 / library is the resource shelf. · accepted 한국어: 데이터베이스 · retired 한국어: 자료 · never in English: library, data book |
| `db.overview` | 개요 | overview | noun | editor |  |
| `db.actor` | 주인공 | actor | noun | both | The tab reads 주인공 ("protagonist") but the record and the English term are actor; 액터 survives in help prose. · accepted 한국어: 액터 · never in English: hero, protagonist, character |
| `db.class` | 직업 | class | noun | both | Growth curves and equippable gear. "job" is not used; 클래스 is accepted in help prose only. · accepted 한국어: 클래스 · never in English: job, profession |
| `db.skill` | 스킬 | skill | noun | both |  |
| `db.item` | 아이템·장비 | items and equipment | noun | editor | One tab holding two record types; singular English is "item" and "equipment" respectively. |
| `db.enemy` | 전투 몬스터 | enemy | noun | both | The tab says 전투 몬스터 to hold it apart from db.monsterSpecies; the record and English term are enemy. · accepted 한국어: 적 · never in English: monster |
| `db.monsterSpecies` | 포획·성장 종족 | monster species | noun | both | Capturable, levelling creatures — a different system from db.enemy battle records. |
| `db.troop` | 적 그룹 | troop | noun | both | A fixed encounter group of enemies. Never "party" — the player side is battle.party. · accepted 한국어: 트룹 · never in English: party, enemy group |
| `db.state` | 상태 | state | noun | both | A status condition such as poison or sleep. Not UI state and not a save state. · never in English: status effect, condition |
| `db.element` | 속성 | element | property | both | Elemental attribute governing damage affinity. This Korean word is taken — "property" must render as 설정, see map.mapSettings. · never in English: attribute, property |
| `db.terrainEffect` | 지형 효과 | terrain effect | noun | both | Battle-side effect of a terrain tag; the tile-side datum is a terrain tag, not an effect. |
| `db.battleAnimation` | 전투 애니메이션 (짧게: 애니메이션) | battle animation | noun | both | Full term keeps it apart from an event graphic's walk animation. |
| `db.battleScreen` | 전투 화면 | battle screen | noun | both |  |
| `db.battleCommands` | 전투 명령 | battle commands | noun | both | The in-battle command menu shown to the player; unrelated to event.command. |
| `db.faction` | 진영 | faction | noun | both |  |
| `db.system` | 시스템 | system settings | noun | editor | Project-wide game settings tab; English keeps "settings" so it is not read as the engine. |
| `db.inGameTerms` | 용어 | in-game terms | noun | both | Author-chosen wording for in-game concepts (what their game calls HP or gold) — project content, never product terminology. |
| `db.worldCanon` | 세계 개요 | world canon | noun | editor | The settled facts of the author's world; the surface that edits it is shell.world. |
| `db.worldCodex` | 설정집 | world codex | noun | editor |  |
| `db.conceptBundle` | 개념 꾸러미 | concept bundle | noun | editor | Draft room/facility concepts the assistant can build from. |
| `db.structureKits` | 부품 보관함 | structure kit library | noun | editor | Shelf of map.structureKit entries. English says "library" here and for resource.resourceLibrary — always qualify which one. |
| `db.characterGraphics` | 캐릭터·얼굴 | character and face graphics | noun | editor |  |

### BattleRuntime

| key | 한국어 | English | role | surface | note |
| --- | --- | --- | --- | --- | --- |
| `battle.battle` | 전투 | battle | noun | both | One fight. shell.battleTest shortens to the same word in the top bar — keep "test" in English. · never in English: combat, fight |
| `battle.battler` | 배틀러 | battler | noun | runtime | A combatant instance in a running battle, on either side; its authored source is db.actor or db.enemy. |
| `battle.party` | 아군 | party | noun | runtime | The player's side. Never "troop" — that is the enemy grouping (db.troop). · never in English: troop, allies |
| `battle.turn` | 턴 | battle turn | noun | runtime | One round of battle order. The same Korean word means an assistant exchange — see assistant.turn. |

### ResourcePipeline

| key | 한국어 | English | role | surface | note |
| --- | --- | --- | --- | --- | --- |
| `resource.resource` | 소재 | resource | noun | editor | Image and audio material. 자료 was retired because it collided with the database's short label. · accepted 한국어: 리소스 · retired 한국어: 자료 · never in English: asset, material |
| `resource.resourceLibrary` | 소재 보관함 | resource library | noun | editor | Where resources are reviewed and replaced. English "library" is shared with db.structureKits — always qualify. · retired 한국어: 자료 보관함 |
| `resource.audio` | 음악·효과음 (짧게: 음악) | music and sound effects (short: Audio) | noun | editor | One middle dot, one name. The interpunct separator is part of the approved term. |
| `resource.bgm` | BGM | BGM | noun | both | Background music track, untranslated in both languages; the event commands are BGM 재생 / play BGM. |
| `resource.soundEffect` | 효과음 | sound effect (short: SE) | noun | both |  |
| `shell.world` | 세계관 | world lore | noun | editor | The world-setting document. Not a world map and not a generated world; 세계 / 월드 were retired as dead values. · retired 한국어: 세계, 월드 · never in English: world, world map |

### AssistantStudio

| key | 한국어 | English | role | surface | note |
| --- | --- | --- | --- | --- | --- |
| `assistant.assistant` | 조수 | assistant | noun | editor | The in-editor AI collaborator. Not "agent" and not "copilot" on any user-facing surface. · never in English: agent, copilot, bot |
| `assistant.aiStudio` | AI 스튜디오 (짧게: 스튜디오) | AI Studio | noun | editor | The scene-monitor shell holding the assistant. Distinct from the database's record studios (e.g. actor studio). |
| `assistant.turn` | 턴 | assistant turn | noun | editor | One request-and-response exchange with the assistant. Same Korean word as battle.turn — English must disambiguate. |
| `assistant.task` | 작업 | task | noun | editor | User-facing word for one assistant tool call; internally it is a tool, and the id is never shown raw. |
| `assistant.taskPaintRoad` | 길 그리기 | paint road | action | editor | tools: `paint_road` |
| `assistant.taskBuildVillage` | 마을 짓기 | build village | action | editor | Two tool ids share this one label, so English must stay a single term for both. · tools: `build_house`, `author_village` |
| `assistant.taskPlaceFacility` | 시설 짓기 | place facility | action | editor | tools: `place_concept` |
| `assistant.taskMakeVillager` | 사람 만들기 | make villager | action | editor | Creates an NPC event; the Korean label deliberately avoids the initialism. · tools: `make_villager` |
| `assistant.taskLint` | 검사 | lint check | action | editor | Rule audit of the project. English keeps "lint" so it is not read as a play test. · tools: `run_lint` |
| `assistant.taskPlanWorld` | 세계 계획 | plan world | action | editor | tools: `plan_world` |

### ProjectPersistence

| key | 한국어 | English | role | surface | note |
| --- | --- | --- | --- | --- | --- |
| `project.project` | 프로젝트 | project | noun | editor | One authored game. The player-visible artifact is the game, not the project. |
| `project.onlineSave` | 온라인 저장 | online save | action | editor | Saving the project to the server. Not a runtime save slot. · never in English: cloud save |
| `project.export` | 내보내기 | export | action | editor | Writing the project out as a package file. |
| `project.import` | 가져오기 | import | action | editor |  |
| `project.webExport` | 웹 내보내기 | web export | action | editor | Publishing a playable build, unlike project.export which produces a re-importable package. |

## English collisions

Entries sharing an English rendering. Read both notes before choosing a word.

- none

## Korean collisions

One Korean word, two concepts. English must keep them apart.

- **이벤트** — `map.layerEvent` vs `event.event`
- **턴** — `battle.turn` vs `assistant.turn`

## Reserved and refused English words

Words that would have made two concepts read alike. Do not reach for these;
use the owner's term instead.

- **agent** — refused by `assistant.assistant`; owned by no entry
- **allies** — refused by `battle.party`; owned by no entry
- **area** — refused by `map.map`; owned by no entry
- **asset** — refused by `resource.resource`; owned by no entry
- **attribute** — refused by `db.element`; owned by no entry
- **bot** — refused by `assistant.assistant`; owned by no entry
- **brush** — refused by `map.toolPaint`; owned by no entry
- **character** — refused by `db.actor`; owned by no entry
- **chipset** — refused by `tile.tileset`; owned by no entry
- **cloud save** — refused by `project.onlineSave`; owned by no entry
- **combat** — refused by `battle.battle`; owned by no entry
- **condition** — refused by `db.state`; owned by `event.condition`
- **copilot** — refused by `assistant.assistant`; owned by no entry
- **data book** — refused by `shell.database`; owned by no entry
- **decoration layer** — refused by `map.layerOverlay`; owned by no entry
- **enemy group** — refused by `db.troop`; owned by no entry
- **eyedropper** — refused by `map.toolPickTile`; owned by no entry
- **fight** — refused by `battle.battle`; owned by no entry
- **hero** — refused by `db.actor`; owned by no entry
- **job** — refused by `db.class`; owned by no entry
- **level** — refused by `map.map`; owned by no entry
- **library** — refused by `shell.database`; owned by no entry
- **lower layer** — refused by `map.layerGround`; owned by no entry
- **map attributes** — refused by `map.mapSettings`; owned by no entry
- **map properties** — refused by `map.mapSettings`; owned by no entry
- **material** — refused by `resource.resource`; owned by no entry
- **monster** — refused by `db.enemy`; owned by no entry
- **party** — refused by `db.troop`; owned by `battle.party`
- **pen** — refused by `map.toolPaint`; owned by no entry
- **pencil** — refused by `map.toolPaint`; owned by no entry
- **place scene** — refused by `map.toolPlaceEvent`; owned by no entry
- **preview** — refused by `shell.testPlay`; owned by no entry
- **profession** — refused by `db.class`; owned by no entry
- **property** — refused by `db.element`; owned by no entry
- **protagonist** — refused by `db.actor`; owned by no entry
- **room** — refused by `map.map`; owned by no entry
- **run tests** — refused by `shell.testPlay`; owned by no entry
- **scene** — refused by `map.map`; owned by no entry
- **scene tool** — refused by `map.toolPlaceEvent`; owned by no entry
- **sheet** — refused by `event.page`; owned by no entry
- **status effect** — refused by `db.state`; owned by no entry
- **tab** — refused by `event.page`; owned by no entry
- **tile palette** — refused by `tile.tileset`; owned by `tile.tilePalette`
- **toggle** — refused by `event.switch`; owned by no entry
- **troop** — refused by `battle.party`; owned by `db.troop`
- **world** — refused by `shell.world`; owned by no entry
- **world map** — refused by `shell.world`; owned by no entry

## Locale-sensitive surfaces

Formatting and ordering, inventoried apart from labels. Translating a label
does not fix any of these, and fixing these translates nothing.

- `document-language` (documentLanguage, ko): The shipped document language is declared once on the root element. — `index.html`
- `database-actor-number-format` (number, ko-KR): Actor studio stat numbers use a fixed ko-KR grouping formatter with no fraction digits. — `src/editor/panels/databaseActorStudio.ts`
- `map-inspector-tile-count` (number, ko-KR): Map inspector cell counts are grouped with ko-KR and suffixed by the Korean counter 칸. — `src/editor/panels/mapInspectorPane.ts`
- `commerce-price-format` (currency, ko-KR): Shop and inn prices are ko-KR grouped and suffixed with a bare G rather than a currency code. — `src/editor/panels/eventEditor/shopEditorModel.ts`, `src/editor/panels/eventEditor/commandBodyCommerce.ts`, `src/editor/panels/eventEditor/commandPreview.ts`
- `activity-timestamp-format` (time, ko-KR): Team workflow, world panel, and AI settings timestamps are rendered with ko-KR date/time styles. — `src/editor/teamWorkflowUi.ts`, `src/editor/panels/worldPanelViews.ts`, `src/editor/panels/aiSettingsModal.ts`
- `conversation-date-heading` (date, ko-KR): Assistant conversation history groups turns under ko-KR formatted date headings. — `src/editor/panels/aiChatPanelHelpers.ts`

## Translation boundary

- `product-chrome` — **product-owned, translatable**: Product-owned chrome: menus, toolbars, tab labels, dialog titles, field labels, help text. (자료집, 테스트 실행, 맵 설정, 이동 경로)
- `assistant-user-facing-task-names` — **product-owned, translatable**: Korean labels the assistant shows for its own tool calls, and the tool ids behind them. (길 그리기, 시설 짓기, 검사)
- `authored-record-names` — **user-authored, never translated**: Names the author typed into database records — actors, classes, skills, items, enemies, troops. (주인공 이름, 스킬 이름, 아이템 이름)
- `authored-map-and-event-text` — **user-authored, never translated**: Map names, event names, dialogue, choices, and any message text authored inside events. (맵 이름, NPC 대사, 선택지)
- `authored-in-game-terms` — **user-authored, never translated**: The database 용어 tab: the author's own words for in-game concepts. Product translation must never touch it. (HP 표기, 골드 표기)
- `authored-world-documents` — **user-authored, never translated**: World canon, world codex, and concept bundle prose — authored fiction, not product copy. (세계 개요 본문, 설정집 항목)
- `seed-and-sample-content` — **user-authored, never translated**: Bundled sample records, demo maps, and generation presets. They are starting content the author edits, so they follow the content rule even though the project ships them. (서슬 늑대, 여행자의 빵)
- `stable-identifiers` — **product-owned, never translated**: Test ids, tool names, command kinds, storage keys, and layer ids (`lower`/`upper`/`event`). Renaming one breaks an automation contract, not a translation. (db-tab-actors, place_concept, lower)
