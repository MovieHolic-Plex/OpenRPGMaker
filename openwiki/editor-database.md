# Editor Database

## Database Studio chrome (2026-08-24)

- The Database modal is a **neutral cool studio**, not the editor cream shell and not RM2k3. Tokens live in `src/styles/database/studio-theme.css` (`--db-studio-*`), scoped under `.database-modal-backdrop` and imported last among database CSS in `src/styles/index.css`. Do not put studio hex in `tokens.css`.
- Nav is a **labeled 220px rail** (group headers visible) that collapses to 56px only below 800px. Tab `textContent` / `db-tab-*` testids stay. Each tab button's first child is an inline `svg.db-tab-icon` from `databaseTabIcons.ts`; CSS owns only its size and `color`.
- Record lists are **name-first** with muted `#n` meta. Do not put `0001:` back in `databaseRecordViews.ts` / utility / common-event rows. Unused switch/variable reserve rows are not rendered.
- Footer: `지금 저장` (`database-footer-apply`) is the filled primary; `닫기` (`database-footer-ok`) is ghost. Dirty 3-way Save/Discard/Keep is unchanged.
- Keep G006 in-modal `switchDatabaseActiveTab`, gallery+list toggles, and every `db-field-*` / `db-record-row-*` / `db-record-card-*` / `db-system-nav-*` / `db-type-chart-*` testid.
- **Modal geometry has exactly one owner (2026-08-27):** `.database-modal-backdrop .database-modal-window:has(.db-shared-workspace)` in `src/styles/database/sidebar.css` declares the studio frame's `width` / `height` / `max-*` / `min-*`. No tab-content selector (`:has(.oprn-record-*)`, `:has(.db-elements-classic)`, `:has(:is(...workspace...))`) may declare window geometry again — that pattern is what made the modal jump 1628 → 1584 → 1530 px between sidebar tabs (98px width, 49px horizontal shift, measured at 1920x1200). `test/e2e/database-modal-size-invariant.spec.ts` walks every `DATABASE_TAB_SPECS` entry at 1920x1200 / 1280x800 / 1024x768 and fails on **any** non-zero delta in the window's `width` / `height` / `left` / `top`. `.maximized`, `.floating`, `.is-docked`, `.village-info-window`, and `.ai-settings-window` are separate modes and keep their own geometry.
- `.db-body.db-shared-workspace` is the invariant content boundary for every registered Database tab. The modal shell owns the viewport, `.db-tabs` owns the labeled rail, and tab-specific workbenches may scroll or reflow only inside that shared boundary; active-tab content must not resize the modal, sidebar, footer, or workspace frame.
- The pinned Overview is a whole-game pulse, not a combat-stat dashboard. It surfaces world/maps, story/events, cast, game systems/data, readiness, and start-point summaries (`db-overview-game-pulse`, `-world`, `-story`, `-cast`, `-systems`, `-readiness`) from the current project and retains same-modal navigation.
- **2026-08-26 navigation/overview correction (supersedes the stale W2/W5 bullets below):** the complete registered tab order uses one labeled 220px grouped rail, collapsing to 56px only below 800px. The Overview leads with project identity/readiness and whole-game summaries; its `AI 어시스턴트` action enters the editor-wide assistant with the current Database screen as context. Do not visually hide desktop labels or restore balance-only analytics as the Overview's primary information architecture.

### Actor data-table slice (2026-08-25)

- `actors` is the first record collection using the approved Database Studio table grammar. `databaseActorStudio.ts` owns the searchable table, comparative columns, and map-visibility chips; `databaseRecordViews.ts` still owns selection, search state, add/duplicate/delete, partial detail refresh, and existing `db-record-row-*` contracts.
- The selected actor's existing `renderActorRecordForm` remains the editing authority and renders in `.db-studio-inspector-pane`. Do not duplicate field controls inside table cells or bypass `updateDatabaseRecord`; table values are comparative read-only projections of the same record.
- Desktop layout is scoped in `desktop-record-shell/13-actor-studio.css`. Other collections intentionally retain their current record workspace until migrated. Responsive widths below 901px continue through the legacy stacked rules rather than forcing the desktop table.
- Structural regression coverage is `test/databaseRecordPartialRender.test.ts`: the actor studio/table/header/inspector must coexist with existing row and detail-form testids, while the same file continues to prove selection and rename partial-render behavior.
- The actor Studio inspector must express hierarchy directly, without beginner guides, numbered walkthroughs, next-step buttons, or explanatory workflow copy. Its fixed structure is selected-actor hero → `기본 / 외형 / 성장 / 전투 / 결과` tab strip → one active panel. `db-actor-section-tabs`, `db-actor-tab-*`, and `db-actor-panel-*` are the navigation contract. Existing field/panel testids and `updateDatabaseRecord` ownership remain unchanged inside the panels.
- The hero owns selected-actor identity, class, level range, and start-party membership. The table owns selection and comparison only; do not restore duplicate current-selection/party summary metrics or analytics. System remains the authority for `startActorIds`.
- Scroll ownership is explicit: list rows scroll inside `.db-actor-studio-table`; the actor hero and section tabs remain fixed; only `.actor-section-body` scrolls. Do not return to one long inspector document where category navigation depends on scrolling.

## 세계관 그룹 — 이 세계 · 설정집 (2026-09-03)

- 자료집 레일 **첫 그룹** `세계관` (`slug: lore`). 탭 `이 세계` (`worldCanon`, `db-tab-world-canon`) 와 `설정집` (`worldCodex`, `db-tab-world-codex`). 예전에 「세계」이던 타일셋·생성 규칙 그룹은 **「맵」** 으로 개명했다 (`slug` 는 `world` 유지 — 접힌 타일셋 폴더 부제 계약).
- `이 세계` 는 싱글톤 `project.worldCanon` 이다. 이름·한 줄 전제·톤 칩·시대·기술 천장·없는 것 태그·힘/신/죽음/돈 법칙·마크다운 본문. 비어 있으면 키를 저장하지 않는다 (`normalizeWorldCanon` / `compactWorldCanon`). 스키마는 `src/project/world/canon.ts`.
- 텍스트는 `recordCoalescedSnapshot`, 칩·태그·법칙 토글은 `recordProjectSnapshot`. UI 는 `databaseWorldCanonView.ts`, 계약 `test/worldCanon.test.ts` + `test/databaseWorldCanonView.test.ts`.
- `설정집` 은 세계관 카드 위키를 `workspaceShell` 셸에 심은 것이다 (`world-panel-embedded` + `db-world-codex-workspace`). 본문은 레이아웃 루트 하나만 자식으로 둬 `.db-body` 자체 스크롤을 만들지 않는다 — 계약 `test/databaseWorldCodexStructure.test.ts`. 톱바 세계관 버튼은 이 그룹의 `이 세계` 탭으로 점프한다.
- **소바자 세 곳 (2026-09-03).** (1) 조수: `src/ai/worldCanonContext.ts` 의 `worldCanonPromptSection` 이 `## 이 세계(세계관 고정)` 블록을 감독 지침과 같은 **예산 밖 고정분**으로 넣는다 — 이름·전제·톤·없는 것(절대 금지)·법칙 + 본문 600자. 엔티티 다이제스트 배제(`worldAiExclusion`)는 그대로다. (2) 개요 탭 `db-overview-canon` 카드가 이름·전제를 보이고 이 세계 탭으로 점프한다. (3) 환영 장르 포스터(`applyWelcomeGenrePresetToOpenProject`)가 세계관이 뱄 때만 톤·전제 초안을 심는다. 계약 `test/worldCanonConsumers.test.ts`.

## '생성 규칙' 탭 — AI 마을 생성의 물·숲·길 (2026-08-30)

- `맵` 그룹 첫 탭 `생성 규칙` (`worldGen`, testid `db-tab-world-gen`) 은 `project.system.worldGen` 을 저작한다. 강 띠 두께·호수 지름·수면 모양·숲 깊이·나무 밀도·간격·길 재료·광장 자리, 그리고 "이 말이 나오면 이 지형" 낱말 규칙이 전부 이 한 탭에 있다.
- 값을 만지면 실제 칩셋 타일로 그린 미리보기가 즉시 갱신된다. 미리보기는 시공기와 **같은 함수**(`buildTerrainConstraintMasks` / `cellsInFillShape` / 나무 수 헬퍼)를 쓴다 — 미리보기 전용 근사식을 넣지 마라. 예시 프리셋 카드도 같은 렌더러로 그린 썸네일이다.
- 낱말 규칙은 낱말 목록 + 제외 낱말 + 지형 칩이다. **정규식·코드 입력을 넣지 마라** — 초보 저자가 대상이고 자연어까지만 허용하는 것이 설계 전제다.
- 구조 변경은 `recordProjectSnapshot`, 슬라이더/텍스트는 `recordCoalescedSnapshot` 이라 modal dirty/undo 계약을 따른다. 탭 count 는 저자가 만든 낱말 규칙 수다.
- 스키마·기본값·정규화·경로 전체와 "새 항목 추가 절차" 는 `openwiki/world-generation-rules.md` 가 소유한다.

## P2 낚시·채집·박물관 저작 표면 (2026-08-25)

- `생활` 그룹의 `낚시·채집·박물관` (`lifeCollections`) 탭은 fish species, fishing spots, seasonal forage areas, museum rewards를 구조화해서 목록·추가·이름 변경·삭제한다. 기본값 동작은 collection tracking까지 서로 참조가 맞는 최소 패키지를 만든다. 물고기 삭제는 해당 catch만 제거하고, catch가 하나도 남지 않은 낚시터만 함께 제거한다.
- item 삭제는 물고기 지급, 채집 drop, 도감 추적, 박물관 eligibility/condition/item reward 참조가 남아 있으면 차단된다. map 삭제 확인은 낚시터/채집 구역 수를 표시하고 해당 맵의 행만 제거한다. UI가 참조 권위자가 되어서는 안 된다. 전역 lint/repair는 `src/project/io/references.ts`, map lifecycle은 `src/project/mapDeletion.ts`가 소유한다.

## 계절·날씨 / 동물·축사 저작 표면 (2026-08-25)

- grouped Database navigation의 `생활` 그룹은 `농사·작물`, `주민 관계`, `생활 기술·제작`, `계절·날씨`, `동물·축사` 순서다. 새 탭의 stable ids는 `dailyWeather` / `farmAnimals`, testids는 `db-tab-daily-weather` / `db-tab-farm-animals`다.
- `databaseDailyWeatherView.ts`는 `system.dailyWeather`를 구조화 편집한다. 빈 프로젝트는 `4계절 기본 날씨 만들기`로 봄·여름·가을·겨울 확률표와 3일 예보를 채울 수 있고, 이후 enabled/forecastDays와 각 rule의 kind/weight/intensity를 편집한다. 예보 결과 자체는 저작하거나 저장하지 않는다.
- `databaseFarmAnimalsView.ts`는 `database.farmAnimalSpecies`, `system.farmAnimalBuildings`, `session.farmAnimals`를 한 화면에서 연결한다. 기본값은 기존 아이템과 시작 맵을 재사용해 닭·소, 축사, 두 시작 개체를 만들며 새 아이템·맵 fixture를 몰래 추가하지 않는다. 종은 feed/product/cadence/friendship, 축사는 map/position/capacity/allowed species, 개체는 species/building/event binding을 편집한다.
- 동물 종의 먹이·생산물로 사용 중인 아이템은 Database 공통 삭제 가드가 차단한다. 종 삭제는 시작 동물과 축사의 허용 종 참조를, 축사 삭제는 시작 동물의 배정을 먼저 확인한다. 참조가 있으면 구조화 UI는 snapshot이나 project mutation 없이 오류 toast만 표시한다.
- 구조 변경은 `recordProjectSnapshot`, 필드 변경은 `recordCoalescedSnapshot`을 사용하므로 modal dirty/undo 계약을 따른다. 탭 count는 weather rule 수, 또는 species/building/start instance 합계다.
- 레이아웃은 `styles/database/desktop-record-shell/11-life-authoring.css`에 modal-scoped로 있다. 1180px 이하에서는 세 개의 동물 저작 열이 한 열로 접히고, 799px 이하에서는 계절 카드와 rule grid도 한 열/두 열로 축소된다.
- 집중 테스트는 `test/p1LifeEditorAuthoring.test.ts`, `test/p1ReferenceIntegrity.test.ts`, `test/databaseSidebarNav.test.ts`, `test/databaseSidebarKeyboard.test.ts`다.

## 생활 기술·제작 저작 표면 (2026-08-24)

- `src/editor/panels/database.ts`의 `lifeCrafting` / `db-tab-life-crafting`은 grouped navigation의 `생활` 그룹에 있다. 탭 count는 `database.lifeSkills`와 기존 제작/강화/가격/도구 행동뿐 아니라 `energy`, `shipping`, `worldUnlocks`, `bundles`, `makers`도 합산한다. optional singleton인 energy/shipping은 존재할 때 각각 1건으로 센다.
- `src/editor/panels/databaseLifeCraftingView.ts`가 생활 기술·제작과 P0 생활 시스템의 구조화 저작을 소유한다. 사이드바 탭 제목을 본문에 반복하지 않고, 열 개 종류는 `db-ws-section-tab` 한 줄(가로 스크롤)로만 전환한다. 빈 상세는 한 줄 설명 + 만들기 CTA 이고, 에너지/출하도 같은 목록+상세 2칸을 유지한다. 생활 기술 5종/type/maxLevel/레벨 보상, 제작법 재료·결과·`requiresUnlock`, 강화 전후·비용·재료·도구 capability(`areaWidth`, `areaHeight`, `energyMultiplier`), 판매가와 도구 행동을 JSON 없이 편집한다. 도구 capability 축은 런타임/shape와 같은 `1..9`(총 81칸 이하)로 clamp한다.
- 같은 화면의 `에너지`는 max/initial/restorePerDay, `출하`는 enabled/historyLimit/allowedItemIds 다중 선택, `지역 해금`은 id/name/switch, `꾸러미`는 요구 아이템과 gold/item/switch/worldUnlock/recipe 보상, `가공 설비`는 input/output/durationMinutes를 필드로 노출한다. 구조 변경은 `recordProjectSnapshot`, 필드 변경은 `recordCoalescedSnapshot`을 사용하므로 add/duplicate/delete와 field edit 모두 undo·dirty-state 계약을 따른다.
- optional 설정을 끄는 동작은 값을 조용히 제거하지 않는다. `shipping.enabled=false`는 historyLimit/allowedItemIds를 그대로 보존하며, energy/shipping 객체 삭제와 bundle reward 초기화는 설명이 붙은 명시적 제거 버튼으로만 수행한다. 비어 있는 collection은 `[]`로 유지되어 기존 값을 암묵적으로 재생성하지 않는다.
- `databaseRecordModel.ts`의 system whitelist와 `p0SystemRecords.ts` 정규화를 그대로 거치며 별도 migration은 없다. complete nested shape와 serialize/deserialize 왕복은 `test/p0ProjectSchema.test.ts`, `test/databaseLifeCraftingView.test.ts`, `test/lifeAuthoringReferences.test.ts`가 증명한다.
- System `time` 섹션은 `db-field-system-time-days-per-season`으로 `TimeSystemConfig.daysPerSeason`을 편집한다. 기본값은 28이며 `dayStartHour` / `dayEndHour`와 함께 보존된다. 현재 schema에는 별도 시작 계절·시작 날짜 필드가 없으므로 UI가 임의 필드를 만들지 않는다.
- 삭제/검증은 `databaseReferences.ts`와 `project/io/references.ts`를 함께 유지한다. shipping allowed item, bundle 요구/아이템 보상, maker input/output, world unlock 및 bundle 보상 switch도 item/switch 삭제 가드와 orphan lint 대상이다. bundle reward가 참조하는 recipe/worldUnlock은 해당 구조화 목록에서 삭제할 수 없다.
- `sellPrices.itemId`와 각 id 기반 컬렉션은 중복이면 reference/shape issue다. UI의 ID 입력은 lifeSkill/recipe/upgrade/toolAction/worldUnlock/bundle/maker 안에서 중복 값을 저장하지 않고, 복제는 새 ID를 만든다. amount row는 같은 item 중복을 차단하고 새 판매가 행은 아직 가격이 없는 item을 자동 선택한다.
- `databaseCommandReferences.ts`는 `changeLifeSkillExp`, `craftRecipe`, `applyItemUpgrade`를 map/common/troop nested branch까지 찾으므로 해당 이벤트 명령이 남은 레코드는 UI에서 삭제하거나 ID를 변경할 수 없다. recipe ID는 생활 기술 보상과 bundle 보상, worldUnlock ID는 bundle 보상도 확인한 뒤 rename을 차단한다. 참조가 있는 ID를 구조화 폼에서 직접 바꿔 dangling reference를 만드는 경로도 삭제 가드와 같은 fail-closed 정책이다.
- CSS는 `src/styles/database/desktop-record-shell/11-life-authoring.css`에 modal-scoped로 있으며 1024px 밀도와 1360px 이상(1440 acceptance) 확장 레이아웃을 따로 둔다. 집중 테스트는 `test/databaseLifeCraftingView.test.ts`, `test/databaseSidebarNav.test.ts`, `test/databaseSidebarKeyboard.test.ts`, `test/databaseSystemView.test.ts`, `test/lifeAuthoringReferences.test.ts`다.

> **Encoding note:** Some Korean descriptive text has EUC-KR→UTF-8 mojibake from the original source commit. English terms, file paths, and code references are intact. For accurate Korean, consult the referenced source files. Partial automated restoration applied; remaining garbled CJK is irreversibly corrupted.

Database tabs, record views, battle database records, utility records, references, common-event command editing, and record mutation.

## Database Editor

- **얼굴은 리소스 목록에서도 낱장이다 (2026-08-27):** 얼굴 한 칸 = 파일 한 장 모델은 피커뿐 아니라 **리소스 관리자(얼굴 그래픽) 목록**에서도 지켜야 한다. `defaultResourceProfiles()` 는 `FACESET_FACE_ASSETS` 112장을 48×48 `kind: "faceset"` 프로필로 등록하고, `EASYRPG_RTP_ASSETS` 의 faceset 행(4×4 시트)은 **건너뛴다** — 시트는 v3 로드 해석용으로만 등록돼 있는 레거시다. 이미 저장된 프로젝트에 남은 시트 프로필은 `ensureBundledResourceProfiles()` 가 `LEGACY_FACESET_SHEET_IDS` 기준으로 걷어내므로, 로드 한 번으로 112장으로 수렴한다. 실측 회귀: 이 등록을 빼먹으면 피커는 낱장 112장인데 리소스 관리자는 192×192 시트 5장만 보여 저자 눈에는 "전혀 나뉘지 않은" 상태가 된다. 얼굴 표면을 손볼 때는 피커·이벤트 명령 미리보기·**리소스 관리자**·런타임 상태 메뉴를 같이 확인하라.
- **시트 업로드는 앱이 쪼갠다 (2026-08-27):** 저자가 192×192(16칸)·96×96(4칸) 시트를 업로드하면 `planFacesetSheetSplit` → `sliceFacesetSheetDataUrls`(canvas)가 48×48 낱장으로 잘라 `<base>-00..-15` 리소스로 등록한다. `decideFacesetUploadDimensions` 는 더 이상 시트를 거부하지 않는다 — 저자에게 터미널에서 `npm run assets:slice-faces` 를 돌리라고 요구하지 않는다(그 스크립트는 레포 내장 에셋 재생성 전용이다). 계약: `test/facesetSheetSlicing.test.ts`, `test/facesetUploadDimension.test.ts`.
- **이미 저장된 업로드 시트도 쪼개진다 (2026-08-27):** `faceIdForSheetCell` 은 내장 7장만 알아서 업로드 시트 id 를 그대로 되돌려준다 — 그 상태로 `migrateV3toV4` 가 `faceIndex` 를 지우면 업로드 4×4 시트를 가리킨 액터가 48px 얼굴 칸에 겪자 전제를 다 누른 상태로 남는다. 그래서 마이그레이션은 `faceIdForFace` 로 업로드 시트도 `<시트 id>-NN` 으로 옮긴다. 대상은 **업로드 faceset 자산 중 48 배수 정사각인 id 집합**으로 한정한다 — 이 및장이 없으면 얼굴과 무관한 m2 `fields.value` 가 `-07` 을 달고 망가진다.

  시트 자산·프로필은 낱장 16개로 재작성된다. 단, **마이그레이션은 동기라 항상 canvas 를 쓸 수 없다**(노드 테스트에서도 돌아간다). 그래서 각 칸은 시트 이미지를 물린 상토로 `meta.sheetCell` / `meta.sheetSourceId` 표식을 달고 들어오고, 로드 직후 `repairUploadedFacesetSheets`(`facesetSheetRepair.ts`)가 canvas 로 진짜 절단을 마무리한 뒤 표식을 지운다. **이 순서가 계약이다**: 시트를 먼저 지우고 나중에 낱장을 만들면 `resourceReferenceValidation` 이 아직 없는 낱장 id 를 보고 로드를 토한다.

  호출자 주의: `normalizeCurrentProject` 는 동기 사전 점검 `hasPendingFacesetSheetRepair` 로 거를러 **자를 것이 있을 때만 await** 해야 한다. 로드 경로에 불필요한 자시합을 더하면 지속화 순서가 밀려 `storePersistence`·`storeFlushShaEvidence` 의 순서 계약이 진다(실머 8건). 계약: `test/facesetUploadedSheetMigration.test.ts`.

- **기본 장비 런타임 축 계약 (2026-08-29):** `EquipmentRecord.accuracy`는 일반 공격 최종 명중률에 곱하는 0~100% 보정(기본 100), `criticalRate`는 액터 기본 치명타율에 더하는 0~100%p 보정(기본 0)이다. 일반 공격은 장비의 첫 `attackElementIds` 하나를 속성 배율에 적용하므로 기본 카탈로그는 무기당 공격 속성을 최대 하나만 저작한다. `stateInflictIds`/`stateInflictionChance`는 적중한 일반 공격, `elementalDefenseIds`는 일치 속성 피해 50% 감소, `stateDefenseIds`/`stateResistanceChance`는 `stateDefenseMode:"resist"`일 때 상태 저항 판정에 쓰인다. `twoHanded`는 양손 슬롯 점유, `effectFlags.doubleAttack`/`attackAll`은 일반 공격 횟수/대상을 바꾼다. 반면 장비용 MP 비용은 `EquipmentRecord`에 없고, `preemptive`·`ignoreDodge`·`preventCriticalHits`·`increasePhysicalDodge`·`halfMpCost`·`negateTerrainDamage` 플래그와 `stateDefenseMode:"inflict"`는 턴제 런타임 소비자가 없으므로 기본 장비에 저작하지 않는다. `test/equipmentCatalogRuntimeAxes.test.ts`가 실제 전투 런타임과 결정적 RNG로 명중·치명타·상태 부여·공격 속성·속성 방어·상태 저항을 검증하고, `test/defaultItemCatalogQuality.test.ts`가 기본 카탈로그의 허용 축만 검사한다.
- 기본 아이템 카탈로그는 `public/assets/cc0/jetrel/icons` 아래의 대응 아이콘과 함께 JRPG 아이템 100종 이상을 제공한다. 기존 Jetrel CC0 아이콘은 유지하고, 맞지 않거나 빠진 아이콘은 가능한 경우 로컬 생성 스크립트로 만든 뒤 `src/assets/cc0IconAssets.ts`에 `generated` 라이선스로 등록한다. `defaultItemRecords()`를 비롯한 기본 데이터베이스 레코드는 `createBlankProject` → `saveProjectToSupabase` 경로로 **새** 프로젝트를 만들며, `ensureDefaultDatabaseIconResources()`는 `normalizeCurrentProject`에서 번들 아이콘 리소스를 연결한다. 불러올 때도 Supabase `current_json` 행이 기준 원본이다. 일반 기본값 보충은 금지하되, `repairSupabaseCurrentJson`은 2026-08 영문 아이템 껍데기 결함만 제한적으로 이전한다. ASCII 슬러그 이름과 `<slug> 기본 아이템입니다.` 설명이 모두 손대지 않은 모양일 때만 행을 교체하고, 이름이나 설명 중 하나라도 고친 부분 편집 행은 의도적으로 보존하며, 복구된 카탈로그에 필요한 승격 장비 9개와 아이템 효과 스킬 2개 및 그 스킬이 참조하는 번들 전투 애니메이션만 추가한다. 참조 없는 옛 장비 아이템 행은 제거하지만, 이벤트·시스템·시작 인벤토리가 참조하는 행은 한국어 비착용 안내 행으로 남겨 참조를 보존한다. 이 복구는 깨끗하게 열기만 해서는 저장 행에 즉시 기록되지 않으며, 이후 다른 편집을 저장할 때 함께 영구 반영된다.
- **로드 정규화 기본 카탈로그 보충 (2026-08-30):** `src/project/defaults/defaultDatabaseIconResources.ts`의 `ensureDefaultDatabaseIconResources()`는 불러온 프로젝트에서 id가 빠진 기본 ITEM과 EQUIPMENT 레코드를 보충한다. 같은 id의 기존 레코드는 덮어쓰지 않으므로 사용자 편집값은 유지된다.
- **기본 카탈로그 계약:** 아이템과 장비 이름에는 한글이 들어가고, 모든 레코드는 서로 다른 구체적인 한국어 설명을 가진다. 사용 가능한 아이템의 `occasion`, `consumable`, 실행 가능한 회복·상태·스킬·기술서 효과는 서로 맞아야 한다. `occasion: "never"`는 소모하지 않는 재료, 수확물, 도구, 이벤트·퀘스트 물품과 농사 권위자가 소비하는 작물 씨앗에만 쓴다. 농기구에는 유효한 `farmTool`이 있어야 한다. 착용 장비는 `project.database.equipment`에만 두며, 장비 모양 행을 `database.items`에 남기지 않는다. 전투 아이템과 아이템 효과 스킬은 실제 전투 애니메이션 레코드를 참조해야 한다. 전투 대상 해석이 쓰러진 전투원을 제외하므로 부활 아이템은 필드 전용이다. `test/defaultItemCatalogQuality.test.ts`가 데이터와 애니메이션 참조 계약을 검사하고, `test/itemRuntimeUsability.test.ts`가 실제 메뉴·전투·농기구 권위자를 실행한다.
- **기능 확장 기본 아이템(2026-08-29):** `defaultFeatureItemRecords.ts`가 기본 카탈로그에서 비어 있던 상태 추가, 아군 전체 대상, 몬스터 `careProfile`, 영구 성장 씨앗, `switchId`, 속성 아이템 스킬, 유한 `consumptionLimit` 경로를 출하 레코드로 연결한다. 출하 프로젝트에 연결되지 않은 작물 씨앗은 심기·수확을 약속하지 않도록 카탈로그에서 제외한다. 스위치 아이템은 필드 메뉴에서 아직 꺼진 전용 스위치만 켜고 성공 사용 1회를 공통 아이템 전환 권위자에 넘긴다. 유한 충전은 메뉴와 전투 모두 `transitionItemState(..., { kind: "successfulUse" })`가 계산하며, `allAllies` 전투 아이템은 대상 수와 관계없이 명령당 한 번만 전환한다. 집중 실행 계약은 `test/defaultFeatureItemRuntime.test.ts`다.
- **Characters ??actors (G006):** Characters are **not** a `database.*` collection and are **not** party Actors. The `characters` database tab (`db-tab-characters`, `databaseCharacterView.ts`) manages the opt-in identity package `project.characters` plus orphan event-used characterIds via `listCharacterIdIndex`. Do **not** confuse these social keys with Actor (`database.actors`) party members. List thumbs come from the first host map-event charset crop (`characterListThumbnail.ts` / `resolveCharacterListThumbSource`: hosts[0] event page graphic only). Never use Actor facesets, `database.actors`, or a CharacterProfile portrait field for list thumbs ??CharacterProfile has displayName/birthday/giftPrefs only, no portrait resource.

- **Battle effect sheets are generated procedurally, not prompted.** `src/assets/generatedEffectSheets.json` is the single catalog (slug, Korean name, frameCount, tags, scope/position, independent sound/flash/shake seeds); `scripts/gen-effect-sheets.mjs` (`npm run generate:effect-sheets`) renders each slug to `public/assets/generated/effects/effect-<slug>.png` as 96x96 cells with a purpose-specific 8, 10, or 12 frame length. The generated family uses a 75ms frame interval, so total playback remains 600–900ms; legacy/authored animations retain the 120ms default. Rendering runs through `scripts/lib/effectSheet/` (canvas primitives + per-slug painters + fixed-seed PRNG). `src/assets/generatedEffectSheets.ts` re-exports the catalog for the runtime: resource ids are `generated-battle-anim-<slug>`, resolved by `resolveGeneratedEffectAssetUrl` inside `resolveAssetResourceUrl`, registered in `collectResourceIds` (missing = default project fails deserialization), and listed by the `battle` kind of `databaseResourcePickerDialog`. `defaultBattleAnimationRecords()` maps every catalog entry to a record that plays every authored frame and merges same-frame sound/flash/shake into one timing; `anim_magic` / `anim_heal` / `anim_poison` point at `arcane-nova` / `heal-bloom` / `poison-mist` instead of reusing the melee `easyrpg-battle-blow` / `-arrow` art. Why procedural: frame-to-frame continuity is the whole effect, and image models re-imagine the silhouette per frame. Adding one: catalog entry → painter in `render.mjs` `PAINTERS` → run the generator → commit the PNG. `node scripts/gen-effect-sheets.mjs --check` fails on drift, and `test/generatedEffectSheets.test.ts` locks catalog/painter/PNG/record agreement byte-for-byte. `npm run generate:effect-showcase` builds the self-contained audiovisual catalog at `reports/generated-effect-showcase-2026-08-24.html` from those same catalog rows, PNG bytes, and bundled EasyRPG sounds.
- The generated catalog currently contains **34 audiovisual sets**. The 12 genre-generic monster-battler additions live in `scripts/lib/effectSheet/paintersMonster.mjs`: tackle impact, claw rake, bite crunch, projectile shot, leaf volley, psychic wave, shadow pulse, holy beam, sleep dust, power aura, guard barrier, and capture seal. The next 12 reusable combat/utility additions live in `scripts/lib/effectSheet/paintersUtility.mjs`: critical burst, sonic wave, drain orbs, revive rise, cleanse sparkle, paralysis bind, blind veil, confusion spiral, silence lock, summon portal, smoke vanish, and meteor fall. They deliberately use generic geometric silhouettes rather than copied commercial-game move art. Physical/projectile effects use 8 frames, elemental/status/support effects use 10, and large ritual/seal/meteor effects use 12; every entry owns one bundled sound timed to its impact frame.
- New projects bind the starter actors, classes, skills, and battle-usable items to purpose-specific generated effects through `generatedBattleEffectBindings.ts`; creating animation records alone is insufficient because runtime playback follows those authored references. Existing Supabase rows remain load-authoritative and receive no silent default backfill. Their explicit upgrade path is Database → Battle Animations → `이펙트 34종 적용` (`db-install-generated-effects`): `installGeneratedBattleEffectPack()` adds missing generated records, upgrades the three retained legacy aliases when they still use old art, and changes only known starter record ids. It preserves unrelated/custom records, records one undo snapshot, and becomes a disabled `적용됨` button when no changes remain.
- Database workflows live in `src/editor/databaseActions.ts`, `src/editor/databaseRecordMutators.ts`, `src/editor/databaseReferences.ts`, and `src/editor/databaseCopy.ts`.
- **상태 변화 · 전투 연출 · 몬스터 돌봄 저작 (2026-09-05 복구):** `databaseItemRecordView.ts`의 현재 카드 계층에 누락 브랜치의 세 컨트롤을 통합했다. 효과 구역은 종류별 패널 → 상태 변화 → 전투 연출 → 연결 스킬, 사용 제한 구역 끝에는 몬스터 돌봄 카드가 온다. 기존 아이템 요약과 최신 `modern/equipment-items.css`는 유지한다.
  - `medicine`/`special`의 상태 변화 행은 상태·확률·부여/해제·삭제를 저작한다(`db-item-state-effect-row-<i>`, `db-field-item-state-effect-{state,chance,op}-<i>`, `db-item-state-effect-add`). 부여 확률은 0..100으로 제한한다. 기존 `healStateIds` 회복 체크박스도 유지한다. CSS는 `skill-item-visuals.css`의 상태 행 규칙을 아이템에도 공유한다.
  - `db-picker-item-animation`은 `animationId`를 선택하거나 비운다. 전투에서 대상 위치에 재생하며 필드 메뉴에서는 재생하지 않는다.
  - `db-field-item-care-kind`/`-friendship`/`-exp`는 `careProfile`을 저작한다. 없음은 프로필 삭제, 경험치 0은 `expDelta` 생략이다. `databaseRecordMutators.updateItemRecord` 화이트리스트에 이 필드를 포함해야 UI 편집이 저장된다.
  - `itemEffectStory`는 상태 부여 확률과 연출 이름을 설명하며 `databaseFieldSupport`의 21개 필드 중 세 필드를 런타임 지원으로 공개한다. `test/databaseItemInspector.test.ts`는 조작과 직렬화→재로드→필드 삭제를, `test/e2e/item-effects-authoring.spec.ts`는 실제 브라우저 조작·탭 왕복·내보내기를 검증한다. 복구 화면은 `verify-shots/item-editor-modern/recovered-*.png`다.
- Item types `weapon|shield|body|head|accessory` no longer open a live equipment form. The Items tab shows a door (`db-item-open-equipment-tab`) to the Equipment tab (G006). Runtime gear stays on `database.equipment`.
- **Items tab information hierarchy (2026-08-29):** the inspector's card order *is* the hierarchy and is asserted by `test/databaseItemInspector.test.ts` ("orders workbench cards"): 요약(`db-item-card-story`) → `db-item-section-definition` → 기본/그래픽 → `db-item-section-effect` → 대상과 사용 시점 + 종루별 효과 패넬 + 연결 스킬 → `db-item-section-limits` → 사용 가능 + 포획 → 공시. Four defects this replaced: the grab-bag `수치` card (가격+범위+포획 배율+볼 등급+스킬 in one card whose title explained nothing), the graphic card wedged between effect cards, four duplicate `db-item-card-usable` copies (one per type panel), and **two live scope controls on one screen**. Scope now has exactly one owner per type: `medicine` uses its 2-way `db-field-item-scope` segment, every other non-equipment type uses the shared `db-field-scope` select — never both (same failure shape as the equipment `slot` duplication). `itemFields` in `databaseBasicRecordFields.ts` stays as the aggregate for existing callers, but the view composes `itemPriceField` / `itemScopeField` / `itemCaptureFields` / `skillPicker` into separate cards. Capture fields stay visible for every non-equipment type (a new record is `normalGoods` and `test/e2e/qa-items.spec.ts` authors capture on it) but sit last under `db-item-card-capture` with a scope hint.
- **Category filter chips carry counts and cluster order (2026-08-29):** `categoryFilterChips` in `databaseRecordViews.ts` renders `db-filter-chip-<id>` with a `.db-filter-chip-count` badge counted from the **unfiltered** collection (counting the filtered array collapses every other chip to 0 after one click). Items group through `ITEM_CHIP_CLUSTERS` — 무분류 물품, then `소비`, then `장비`, with `.db-filter-cluster` captions; `test/databaseFilterChips.test.ts` fails if a new `ItemType` is missing from a cluster. Zero-count chips are dimmed (`is-empty`) and keep no badge, but stay rendered and clickable — hiding them makes the row reflow as the filter changes, and every `db-filter-chip-*` testid must exist on first paint (audit specs click `db-filter-chip-medicine` straight after opening the tab).
- `src/editor/databaseFieldSupport.ts` is the source of truth for item/equipment field support disclosures shown by database record views. Keep each field's runtime/authoring-only status and help text aligned with the executing authority: finite-use item charges use `src/project/itemTransitions.ts`, while equipment changes use `src/project/equipmentRules.ts` atomically for fixed/cursed, dual-wield, and two-handed invariants. Fields with no runtime consumer remain authoring-only disclosure and must not be advertised as gameplay-active.
- Visual resource picking is shared through `src/editor/panels/databaseResourcePickerDialog.ts` (searchable thumbnail grid + large preview). Items/equipment icons and images, enemy/species monsters, system title/system/system2 graphics, and actor faceset/charset/battleCharset all open this picker. List thumbnails live in `databaseRecordThumbnails.ts` (32px; actors/enemies/items/equipment/skills/animations/classes/troops/states). Actor `characterIndex` is an optional sheet cell (0..7, default 0) used by charset previews and thumbs; faces use standalone 48×48 face graphic resource ids directly without an index.
- **In-modal Database navigation contract (G006 residual binding):** When the Database modal is already open, cross-tab jumps (e.g. Enemy ??linked Species) MUST keep the same modal instance: call `setSelectedMonsterSpeciesId(speciesId)` then `switchDatabaseActiveTab("monsterSpecies")` (or the shared tab switch that re-renders body only ??same path as sidebar tab clicks). **Forbid** `openDatabaseModal(...)` as an in-modal jump: reopening tears down/rebuilds the shell, resets dirty baseline/session selection, and can leak document keydown listeners if close is skipped. `openDatabaseModal(initialTab?)` remains the outside-entry path (menu/toolbar/world manager) and still uses `setDatabaseActiveTab` only on first open. Append G006 action buttons only on enemy/species views (`speciesFields` array extension point in `databaseEnemyRecordView.ts`); do not scatter jump controls across unrelated tabs.
- `src/editor/panels/databaseModal.ts` owns the Database modal shell. Modal close attempts are guarded by `src/editor/panels/editorModalDirtyState.ts`: clean Cancel closes directly, while dirty Cancel/Escape/backdrop/X show Save / Discard / Keep Editing. Discard restores the modal-open project snapshot; Apply/Save persist and reset the dirty baseline.
- **Database tab chrome unify (2026-07-14):** Shared shell CSS `:has()` targets generic `.rm2k3-record-workspace` / `.db-record-workspace` (not only actors/classes/??list) so crops/characters/monster-species get the same modal size, header, and sidebar as core records. Empty list panes reserve min-height + inset frame; list toolbars use shared `db-toolbar-button` density; detail empty states use a card. CSS: `src/styles/database/desktop-record-shell/10-tab-chrome-unify.css` (imported last from `desktop-record-shell.css`). Evidence: `output/evidence/database-ui-unify/{before,after}/`.
- Database write tools in `src/editor/tools/dbTools.ts` use read-modify-write semantics: existing records are merged with only the supplied fields before normalization, unknown fields are rejected with allowed-field guidance, and successful upserts return the full resulting record in `ToolResult.data`.
- The AI chat dock remains available while the Database modal is open so users can issue database-agent requests against the visible modal. Do not reintroduce CSS rules that hide `.ai-chat-panel` for `.database-modal-backdrop`.
- `src/editor/panels/databaseCommonEventViews.ts` owns the Common Events tab view. Common-event command editing uses `src/editor/panels/databaseCommandListAdapter.ts` with shared `renderCommandList`, `openEventCommandPicker`, and `openEventCommandEditDialog`; do not restore the old text-only inline command editor for Common Events.
- Troop battle event command editing also uses shared database command-list rendering. Keep battle-event command rows on the same command editor path unless the task names a narrower troop-only control. Battle-event rows pass the troop-specific runtime support table so unsupported commands show partial/editor-only badges instead of inheriting map-runtime support.
- Troop battle event condition controls include round cadence (`turn`, `onRound`, `everyRound`), switch/variable, enemy HP range, `enemyHpBelow`, actor HP, and actor-command forms. Keep these controls aligned with `src/battle/battleEvents.ts` and battle reference validation when adding condition kinds.
- Class battle command rows are runtime-facing data, not cosmetic labels. Keep `kind`, optional `skillSubsetName`, and optional `skillId` edits in sync with `src/battle/battleCommands.ts`; the battle UI consumes class commands in order and treats `guard` as the existing defend action.
- Monster collection authoring spans System, Items, Enemies, Troops, Classes, Skills, States, and Monster Species database views. `system.monsterCollection` gates capture command exposure; optional `system.typeChart` stores the Pokemon-style type matrix; item `captureProfile.multiplier` remains the compatibility strength while the Items view's `ballClass` selector authors `poke|great|ultra|master`; enemy `speciesId` links battlers to collectable species; the Troops view exposes `uncapturable` and `trainerBattle`; the States view exposes `gen1MajorStatus`; class command kind `"capture"` is only useful when the system gate is enabled. Keep these controls, record mutators, normalization, reference validation, and `dbTools` schemas aligned.
- **Enemy vs Species responsibilities (G006):** Enemies (`database.enemies`, 몬�뒪??tab) own battle-facing battler data: combat stats, attack patterns/actions, rewards, rates, and optional `speciesId` capture link. Species (`database.monsterSpecies[]`, 醫낆” tab) own collectable identity: baseStats, types (max 2), captureRate, skillsByLevel, evolutions, and species graphic. `enemy.speciesId` links a battler to a collectable species for capture without making the enemy record a player-owned monster. **No dual-write stats:** editing enemy stats must not rewrite species `baseStats` (or the reverse). Optional graphic copy (`db-enemy-species-copy-graphic`) may copy species graphic fields onto the enemy only; never auto-sync stats. Enemy species panel chips: unset warn / missing error / graphic mismatch info (`databaseEnemyRecordView.ts`). Species intro copy states the same split.
- The System database tab edits `project.system` through `src/editor/panels/databaseSystemView.ts`: start party (up to 4 `startActorIds` slots, synced to `session.partyActorIds`), title/system/battle-system resource ids, initial troop, `battleFlow`, `activeSlots`, `monsterCollection`, `giftSystem`, `rewardPolicy`, optional `timeSystem` (enable + day bounds + onDayEnd common event), `typeChart.types` plus the attacker/defender matrix, and title-screen layout/labels. Structural edits (party slots, type list, time enable) re-render the tab body; blank/removing the type list deletes `system.typeChart` **after `window.confirm`** (cancel restores the previous type list), preserving legacy neutral damage when the author confirms. Never collapse a multi-member start party to a single actor when one slot changes. `commonEventReferenceMessage` blocks deleting a common event that `timeSystem.onDayEnd` points at (copy: 시간 시스템(하루 끝)). Terrain backdrop/footstep use `resourcePickerControl` (testid `db-field-terrain-backdrop-*` / `db-field-terrain-footstep-*` stay on the text field).
- **Project fonts (System → 폰트, 2026-08-27):** `system.fonts?: { ui?, pixel?, mono? }` authors the project font per role from the registry in `src/project/fontRegistry.ts`, which is the single list of selectable faces (`system-sans`, `system-serif`, `system-mono`, plus the three bundled pixel woff2 faces `neodgm` / `galmuri11` / `galmuri9`). Selection ids are validated against that registry and against the role — an unknown id, a face that does not serve the role, or a value equal to `DEFAULT_FONT_SELECTION[role]` is not stored, and an empty result drops the `fonts` key entirely (same "don't persist defaults" convention as `battleUiStyle` / `battleModel`). `normalizeSystemRecords` is a **whitelist**, so a font field missing from it vanishes after one save/load roundtrip; keep the registry, the type, and the normalizer in sync. Application is one hop: `applyProjectFontTheme` (`src/app/fontTheme.ts`) writes `--font-ui` / `--font-pixel` / `--font-mono` as inline custom properties on `document.documentElement`, overriding the `:root` defaults in `src/styles/tokens.css`; `src/app/mode.ts` calls it once after load and again on every `store.subscribe` change, exactly like `syncBattleModelAttribute`. Editor and runtime share one document, so that single wiring covers both surfaces and **no CSS consumer needs to change** — every `font-family` in `src/` reads a token (or an alias chain ending at one, e.g. `--runtime-pixel-font` → `var(--font-pixel)` → `--runtime-dialogue-font`). Phaser canvas text is the one exception, because canvas cannot resolve CSS variables: `editSceneEventMarkers.ts` (`eventLabelFontFamily()`) and `playSceneActionCombat.ts` call `projectFontStack(store.getCurrent().system.fonts, role)` at text-creation time, so they follow the author's live selection rather than the default. Reading `DEFAULT_FONT_SELECTION` directly there is a regression — the setting would change every surface except canvas text — and `test/fontFamilyTokenGuard.test.ts` fails if either file does it. Testids: `db-system-nav-font`, `db-field-system-font-ui` / `-pixel` / `-mono`, `db-system-font-preview`, `db-system-font-reset`. Tests: `test/systemFontTheme.test.ts` (registry ↔ tokens.css agreement, normalize roundtrip, applier) and `test/fontFamilyTokenGuard.test.ts` (no literal stack survives outside the two owning files, alias chains resolved transitively).
- **Project play resolution (System → 화면, 2026-08-24):** `system.playResolution?: { width, height }` authors the logical map/runtime viewport. Omission and an explicit 320×240 both normalize to the legacy default; custom values clamp to 320–1920 × 240–1080. `db-field-system-resolution-preset` offers 320×240, 426×240, 640×360, and 640×480, while the width/height fields allow bounded custom values. Custom values remain authorable: the diagnostics card reports the reduced aspect ratio, 16px reference-tile span, ceil-rounded minimum map size, partial-tile edges, undersized map count/list, and an estimated current-window fit scale as warnings rather than blockers. The title workbench preview uses the authored aspect ratio. The setting is applied on the next Test Play boot. `createPlaySurface`, Phaser boot, dialogue pagination, runtime DOM marker culling, and the lighting mask must resolve the same project value. Tests: `test/playResolution.test.ts`, `test/databaseSystemView.test.ts`, `test/playerBootFactory.test.ts`.
- **Editor boot welcome (2026-08-20):** After store.load and enterMode(edit), finishEditorBoot may overlay a canvas-scoped director briefing (`src/editor/editorWelcome.ts`, CSS `src/styles/shell/editor-welcome.css`) instead of the old full-screen cinematic welcome. Copy: "어떤 게임을 만들까요?" + one input + 만들기 + three featured posters (몬스터 수집 / 회상 스토리 / 모험 JRPG) + 빈 맵으로 시작. Horror, farm, and partner-raise posters stay in the collapsed 「이런 세계도 있어요」 tier. Each official pack still owns one stable `data-pack-id`. Illustrated-card start auto-sends to the current map via `setPendingWelcomePipeline` (`replaceWithBlank: false`); the separate blank-system-preset button confirms before the verified new-project transaction. Skip dismisses and then starts coach marks. Dismiss key `oprn:editor-welcome-dismissed` is set only after a completed action. Brush/standard coach is suppressed while the briefing is open (`markWelcomeIntentAppliedThisBoot`). Skipped when modeMounted, automation boot context, dismissed, or deep-linked `?project=`. Tests: `test/editorWelcome.test.ts`, `test/transactionalNewRemoteProject.test.ts`, `test/aiBootIntent.test.ts`. Playwright: `?forceWelcome=1`.
- **Title / opening workbench (System tab, 2026-07-15):** ?뚭쾶???쒖옉?붾㈃??is a left-fields + right live-preview workbench (`db-title-workbench`) grouped as fieldsets ?쒖떆/?ㅻ뵒??메뉴. Display: title text, presentation mode text|graphic|both (logo resource + X/Y when graphic/both), background resource picker (writes only titleScreen.backgroundResourceId ??never clears system.titleResourceId), layout title/menu X/Y, showInputHint. Audio: BGM music picker + play/stop, SE pickers cursor/confirm/cancel (kind sound, allowClear). Menu: per-option label + visibility; New Game visibility is locked checked+disabled. Live preview shows only visible menu labels via listTitleMenuOptions and logo per presentation mode. The preview column must remain content-sized, top-aligned, and sticky while the long settings column scrolls; do not let CSS grid stretch its label row and push the 180px stage down. Tool set_title_screen creates titleScreen when missing and nested-merges sounds/titleGraphic/layout. Default title art from bundled generated assets. Schema via normalizeTitleScreenSettings (menuVisibility, sounds, titleGraphic, showInputHint, musicResourceId). Code: databaseSystemView.ts, dbTools.ts, player.ts (startTitleBgm/stopTitleBgm, juice sound overrides), styles database/title-workbench.css. Tests: test/databaseSystemView.test.ts, test/titleScreenMusic.test.ts, test/titleScreenSettingsNormalize.test.ts, test/dbToolsIntegrity.test.ts, test/e2e/title-database-authoring.spec.ts.
- Elements tab ?뚯턀? 개수??resizes `database.elements[]` through `resizeElementRecords` (1~99, unique ids). Class 전투 명령은 인라인 워크벤치로 편집한다(`battleCommandsForActor` / `finalizeClassBattleCommands` / `moveEditableClassCommand`). 컬럼 헤더 + 종류별 컨텍스트 활성화(`skill`/`skillSubset` 일 때만 스킬 그룹·스킬 필드 활성화, 적 행동 basic/skill 모드와 동일 패턴), 인라인 ↑↓ 재정렬, 행 추가/삭제(최대 6), 고정 교체 footer, 전투 메뉴 미리보기. 별도 순서 설정 다이얼로그는 제거됨. Enemy action dialog supports live 기본 ?됰룞 vs ?ㅽ궗 modes (`applyEnemyActionBehaviourMode`); empty `skillId` is basic attack. Animation stage ?뚯? ?쇨큵...???뚮낫媛꾠?write selected-frame cells via `batchApplyCells` / `interpolateCells`. Battle Screen also edits `system.battleFlow` and `system.activeSlots`; battler animations edit idle and attack pose first-frame durations.
- Skill targeting is authored independently from effect kind. Skill scope controls and write schemas enumerate `self | ally | allAllies | enemy | allEnemies`; `allAllies` must stay aligned across `databaseBasicRecordFields.ts`, event-command advanced fields, database references, and `upsert_skill` in `dbTools.ts`. MP cost remains the shared flat-plus-percent record, and state add/remove rows remain `stateEffects`; neither cost nor damage/healing/support kind may implicitly rewrite scope. Runtime uses this authored value for both actor and enemy casters. The Skills view exposes `maxPp` (0 in the control removes the finite-PP field; persisted values clamp to 1..99) and `gen1CriticalRate` (`normal|high`), and `upsert_skill` supports the same fields.
- Skill typing reuses `SkillRecord.elementId` rather than adding a second skill-type field. Keep skill element pickers/reference validation compatible with `system.typeChart.types` because typed damage and STAB consume that id at runtime.
- **Element effectiveness compounding (B5 doc):** One `SkillRecord.elementId` drives up to three independent multiplicative factors at runtime (`src/battle/runtime.ts` `elementMultiplierFor`): (1) RM2k3 grade — target's `elementRates[elementId]` (A–E) → `DatabaseElementRecord.damageMultipliers[grade]/100` (A=2.0, C=1.0, D=0.5, E=0; negative = absorb); (2) Pokemon type chart — `system.typeChart.multipliers[attackType][defenderType]` × STAB(1.5 if attacker has the type); (3) equipment — `elementalDefenseIds` match → ×0.5. These COMPOUND: a typed skill vs a grade-A target with matching equipment can reach e.g. 2.0×1.5×1.5×0.5. New elements default grade C (neutral) and `elementRates` default C, so by default only the type-chart path is active — classic grade path is opt-in per target. There is no per-project mutual-exclusion; document this compounding when authoring both charts.
- **predict↔runtime parity (B1 fix):** `src/battle/battlePredict.ts` `predictSkillDamage` MUST resolve battler types via `battlerTypes(project, snapshot)` (speciesId-first) and `typeChartMultiplierForTypes`, the same path as `runtime.ts`. Do NOT revert to the recordId-based `typeChartMultiplierFor` for predict — player monsters have `recordId = instanceId` (not in `database.enemies`/`monsterSpecies`), so recordId lookup returns `[]` and silently drops type effectiveness + STAB. `battlerTypes` accepts a structural `BattlerTypeRef { speciesId?, recordId }` so both `MutableBattler` and `BattleBattlerSnapshot` share one path. Regression: `test/battleElementAdversarialFixes.test.ts`.
- **elementRates orphan scrub (B4 fix):** `databaseElementList.resizeElementRecords` truncates via `slice` and does NOT know about `elementRates`. The editor resize handler (`databaseElementsClassic.ts`) and load-time `repairProjectReferences` (`src/project/io/references.ts` `pruneDanglingElementRates`) scrub dangling `elementRates` keys from actors/enemies/classes — otherwise a truncated element id (e.g. `element_0006`) survives, and `nextUniqueElementId` reuses the same ordinal on regrow, silently reviving a stale grade (200% weakness) against an unrelated new element. `validateElementRates` reports dangling keys (mirrors equipment-element reporting). `elementRates` keys are strictly `database.elements[].id` (the editor only creates rows from `database.elements`); `elementIds()` unions typeChart types for `skill.elementId` validation but the scrub uses a database-elements-only set. **B4b root cause:** `normalizeRates` previously seeded `{ state_death: "C" }` into BOTH `stateRates` (correct — state_death is a state) and `elementRates` (wrong — not an element). Fixed in `databaseRecordModel.ts`/`databaseEnemyTroopRecordModel.ts` by moving the `state_death` seed to the `stateRates` call site only; `normalizeRates` now starts empty. Existing saves with stale `state_death` in `elementRates` are scrubbed on load by `pruneDanglingElementRates`.
- **Element kind field is live (B2 wiring):** `DatabaseElementRecord.kind` (`physical`|`magical`) determines which defense stat reduces damage. When a skill's `elementId` points to an element with `kind:"magical"`, damage reduction uses `target.mind` (magical defense); `physical` or no-element uses `target.defense`. Wired in `runtime.ts` (`isMagicalElement` → `applySkillLike({ useMagicalDefense })`), `battleDamage.ts` (`computeMagnitude` selects `target.mind` vs `target.defense`), and `battlePredict.ts` (`isMagicalElement` → `targetStats.mind`). The 물리/마법 radio UI in `databaseElementsClassic.ts` is live and meaningful. Keep the three paths (runtime, damage, predict) in parity.
- **Reserved element field (B3):** `rateLabels` is **reserved/unused at runtime** — grades are hardcoded A–E in `isWeakness`/`isResistance`/`ELEMENT_DAMAGE_GRADES`; `rateLabels` is normalized-only and persisted for schema compatibility. No edit UI exists for it.
- **Species type membership vs `system.typeChart` (G006):** System tab authors `typeChart.types` + multipliers (`databaseSystemView.ts`); blank type list deletes `system.typeChart` (legacy neutral damage). On the Monster Species tab, when chart types exist, type UI is checkbox chips from `system.typeChart.types` (max 2 selected; third click rejected). Types stored on the species that are **not** in the chart surface a membership warn (`db-monster-species-type-warn`, ?쒗????곸꽦?쒖뿉 ?녿뒗 ??? ?╈? without clearing the outlier values. When the chart is empty/absent, free-text comma types remain (`db-monster-species-types-free`) with a hint to configure the System type chart. Skill typing still reuses `SkillRecord.elementId` against the same chart ids for typed damage/STAB.
- The Monster Species database tab edits optional `database.monsterSpecies[]` records. Keep its id/name/graphic/types/baseStats/captureRate/skillsByLevel/evolutions fields aligned with `MonsterSpeciesRecord`, `normalizeMonsterSpeciesRecord`, reference validation, defaults, and tool schemas.
- **Monster tabs hardening (2026-08-20, 전투·몬스터 영역 = enemies/monsterSpecies/troops):**
  - `captureRate` 는 0~1 도메인이 유일하게 옳다(`captureSuccessRate` 가 확률로 직접 쓴다). `normalizeMonsterSpeciesRecord` 가 1을 넘는 레거시 값을 `value/100` 으로 이관한다. 출하 기본 종족은 `0.4`. **주의:** 구 clamp 가 이미 `1.0` 으로 저장해버린 프로젝트는 마이그레이션으로 복구되지 않는다 — `scripts/repair-capture-rate-residue.mts` 로 복구한다(실측: `rpg-zzu-dungeon-example` 120종 복구).
  - 전투 진형 좌표의 단일 권위자는 `classicEnemyFormation(index)`(`src/battle/battleBattlers.ts`) 다. 적 그룹 뷰의 `DEFAULT_MEMBER`/`positionedMember`/`arrangeMembers`/예시 멤버가 모두 이 함수를 쓴다 — 에디터 좌표가 런타임 재배치(`x>150`)에 걸리지 않게 하는 유일한 방법이다. 미리보기는 `x/320`·`y/240`(모델 클램프와 일치), `x=150` 안내선(`db-troop-preview-recenter-line`), 아군 마커(`db-troop-preview-party-marker-N`, `battleX 252 / battleY 96+36i`)를 그린다.
  - 전투 이벤트 조건은 런타임이 전부 AND 로 평가한다. 조건 편집은 **첫 조건만** 교체하고 나머지를 보존해야 한다(`setFreshCondition`). `kindOfBattleEventCondition` 은 전용 폼이 없는 종류(selfSwitch/gold/timer/item/actorTurn/enemyTurn 등)에 `undefined` 를 반환하고, UI 는 경고 칩 + `조건 교체` 버튼만 보여 값 파괴를 막는다.
  - 숫자 필드 bounds 는 normalize 의 clamp 범위와 숫자까지 일치시킨다(권위: `databaseEnemyTroopRecordModel.ts`, `actionCombat.ts`, `monsterCollection.ts`). `enemy.level`(`db-field-enemy-level`)은 보상 레벨갭·포획 시작 레벨에 쓰이므로 `updateEnemyRecord` 패치 경로도 함께 유지한다.
  - 적 `transparent`/`flying`/`graphicHue` 는 `databaseFieldSupport.ts` 에 `owner:"enemy"` authoringOnly 로 공시한다(런타임 소비자 없음). 액션 전투 `aggroRange`/`moveIntervalMs`/`knockbackResist` 는 저작 가능하다.
  - 공격 패턴 표: 유령 행 없음(0액션 → `db-enemy-actions-empty`), 행 추가/복사/제거 버튼(`db-enemy-action-add|duplicate|delete`), 우선도 내림차순 표시 + 원본 인덱스 편집(`dataset.actionIndex`), 삭제된 스킬은 `삭제된 스킬(id)` + `is-dangling`. **버튼 라벨에 "복제"/"삭제" 를 쓰지 말 것** — 레코드 툴바 버튼과 e2e `hasText` 가 충돌한다(그래서 `행 복사`/`행 제거`).
  - 속성 유효도 행은 `database.elements` 에서 만들고, 목록에 없는 잔여 키는 `is-dangling` 행 + 삭제 버튼으로 정리한다. 상태 행의 `state_death` 는 데이터에 없어도 런타임이 인정하는 **암묵 상태**이므로 항상 렌더한다(`references.ts` `isKnownStateId`, `commandCatalog.ts`).
  - 진화 사이클/자기 진화는 `monsterEvolutionCycleSpeciesIds` + `validateMonsterSpeciesRecords` 의 **하드 에러**다(로드를 막는다). 반면 상성표 미등록 타입과 "수집 OFF + 종족 데이터" 는 출하 기본 프로젝트가 그 상태로 실려 있어 lint 경고로 올리면 전 프로젝트 노이즈가 된다 — 각각 종족 탭 칩(`db-monster-species-type-warn`)과 수집 탭 배너(`db-collection-gate-warn`)가 맥락 안에서 담당한다.
  - 경험치 곡선 편집기는 레코드 타입에 결합하지 않는다: `renderExperienceCurvePanel({ testidPrefix, readCurve, onCommit, refresh }, host)` 를 직업(`db-class-exp-*`)과 종족(`db-monster-species-exp-*`)이 공유한다.
  - 적 그룹 `밸런스` 패널은 보상 롤업(숨김 멤버 제외 — `battleRewards.ts`)과 `simulateBattle` 난이도 추정(고정 seed 12345, n=10, rAF 후 실행)을 제공한다. 20 샘플은 클릭→결과 561ms(실측)로 UI 를 멈춰 세웠다.
  - **기본 DB 몬스터 로스터는 106종이다 (2026-08-28 정리, 2026-09 리밸런스).** 이전에는 221종이었고 그 중 `enemy_extra_006`~`enemy_extra_120` 115종이 등차수열 더미였다(`maxHp` 40,45,50,55… / `attack` 15,17,18,20…, 아트는 `enemy-art-NNN.png` 공용 슬롯). 짝이던 `species_extra_006`~`species_extra_120` 115종과 함께 `defaultDatabaseBattleRecords.ts` 에서 제거했다. 남은 것은 손으로 저작한 6종(`enemy_slime`/`enemy_meadow_slime`/`enemy_cave_bat`/`enemy_stone_golem`/`enemy_dragon`/`enemy_mine_skel_archer`) + `generatedEnemyRecords()` 100종이고, `monsterSpecies` 는 5종이다.
    - **지우기 전에 살아남는 레코드의 `speciesId` 를 먼저 훑어라.** `enemy_mine_skel_archer` 가 `species_extra_105` 를 가리키고 있어서 `references.ts:500` 이 로드를 막았다(`goldenProjectParity` 전멸). 이제 그 적은 `speciesId` 가 없다 — `generatedEnemyRecords()` 100종도 원래 없으므로 그게 기본 로스터의 표준 형태다.
    - `modernNocturneGame.ts` 는 기본 DB 의 `enemy_extra_016`/`038` 을 filter 로 건져 쓰던 유일한 소비자였다. 지금은 `enemy_neon_wraith`/`enemy_archive_custodian` 을 자기 파일에서 직접 만든다. `monsterResourceId` 의 `-enemy_extra_NNN` 접미는 **일부러 남겼다** — `generatedAssetResourceResolver.ts` 의 그 정규식이 아트를 공급한다(`test/generatedEnemyBattlers.test.ts`).
    - `test/koreanLocalizationDefaults.test.ts:90` 은 `enemies` 를 **29**개로 기대한다. 221 시절에도 틀렸고 106 이 된 뒤에도 틀리다 — 기준선 적신호이며 이 정리와 무관하다. 로스터 목표치를 정할 때 같이 고쳐라.
    - **리밸런스(2026-09): 106종 전원에 `level`·스탯·보상을 부여했다.** 권장 레벨 기준 TTK 2~7(보스 6~12)·TTD 3+(보스 2.5~6) 밴드, `exp/hp ≈ 0.42`, `mind = attack`·MP(보스 40/일반 10) 규약 유지, `actionProfile` 실시간 수치는 불변. 손저작 6종의 구 스윙 주석(공격력 45)은 실측 공격력 22와 괴리되어 두 기준선을 병기한다. 계약: `test/monsterRebalanceBands.test.ts`. `emberQuestGame` 의 튜닝 오버라이드는 그대로라 엠버 전투 스케일은 별개다.
- **Default DB graphic matching + Notion-style image pipeline (G006):** enemies/species/items/equipment must not share one generic image for unrelated names. Extra enemies map 1:1 to generated battlers (`generated-enemy-zombie-01` ??; starter species use dedicated art (`leafling`/`sparkit`/`aqualing`/`king-slime`); tiered equipment/items use distinct `cc0-jetrel-*` icons. **Art pipeline:** shared prompt builder `scripts/lib/dbArtPrompt.ts` (`buildDbArtPrompt({ kind: "icon"|"monster", name, subject, tags? })`) enforces 16-bit JRPG / single subject / transparent / no text-UI-logo-watermark-franchise-photorealism negatives (`DB_ART_PROMPT_NEGATIVES`). **Callers of `buildDbArtPrompt` today:** `scripts/generate-default-item-icons.mts` only. The bundled title crest is registered in `generatedAssetResourceResolver.ts`; run `npm run clean:title-logo` when its generated PNG needs deterministic edge-connected checkerboard removal, then copy the inspected output into `public/assets/generated/title/title-logo-crest.png` and update the title manifest hash. Procedural `scripts/generate-db-item-monster-art.py` remains for matched battler/icon silhouettes. Register outputs in `cc0IconAssets.ts` / `generatedAssetResourceResolver.ts`, wire defaults, prove with `test/dbArtPrompt.test.ts`, `test/dbImageMatching.test.ts`, and `test/titleLogoAsset.test.ts`. Uniqueness gate is **blank-project defaults** (`createBlankProject` / `dbImageMatching`); some older demo fixtures (e.g. dew-village-demo extras) may still reuse battlers and are residual cleanup, not the blank-project contract.
- The Crops database tab edits optional `database.crops[]` records. Keep id/name/seedItemId/harvestItemId/harvestCount/stages/seasons/regrow/graphicStages aligned with `CropRecord`, `normalizeCropRecord`, reference validation, demo defaults, farming runtime, and `define_crop`.
- **Life authoring surface (2026-08-24):** Grouped Database navigation no longer mixes crops/residents under the ambiguous `수집` label. `전투·몬스터` owns enemies/monsterSpecies/troops plus the existing battle tabs; `생활` owns the renamed `농사·작물` and `주민 관계` tabs. Stable tab ids/testids remain `crops`/`db-tab-crops`, `characters`/`db-tab-characters`, and `monsterSpecies`/`db-tab-monster-species`. `databaseCropView.ts` reports time, farmable-map, tool, and seed/harvest-reference readiness; `databaseCharacterView.ts` reports gift/calendar/profile readiness plus orphan/unused identity warnings; `databaseMonsterSpeciesView.ts` reports the species → enemy → troop → field-spawn → drop pipeline. Each readiness card owns a direct navigation/selection action, while empty catalogs expose first-record actions (`db-crop-empty-add`, `db-character-empty-add`). The card body is the button (`action` without `onClick` promotes the whole chip); the chevron keeps the `*-action` testid but is no longer a nested button. System jumps call `requestSystemSection` before the tab click so 선물 lands on 시작 설정 (`db-field-system-gift-system`), 생일/작물 시간 land on 시간 (`db-field-system-time-enabled`), and 종족 방식 lands on 시작 설정의 몬스터 수집. Contract: `test/databaseLifeReadinessNav.test.ts`. These panels are derived editor UI only: they add no project fields, seed no authored content, and keep `characters` distinct from party Actors. Shared DOM/navigation helpers are in `databaseLifeUi.ts`; modal-scoped CSS is `desktop-record-shell/11-life-authoring.css`. Monster tabs can prepend `db-collection-gate-warn`, so the desktop grid must reserve explicit banner/header/workspace rows; otherwise the species workspace intercepts readiness-card clicks. Browser coverage is `test/e2e/stardew-life-content.spec.ts` at 1024×768 and 1440×900.
- Item records can set `farmTool:"hoe"|"wateringCan"` from the Items tab or `upsert_item`; farming runtime checks only inventory possession of those items.
- Monster gift, storage, and evolution event commands are `giveMonster`, `moveMonster`, and `evolveMonster`. NPC relationship commands are `changeFriendship` and `getFriendship`. Event editor labels, summaries, command bodies, branch path traversal, command factory defaults, runtime support metadata, interpreter execution, and command-reference validation should be updated together when these command shapes change.
- Monster collection write tools live in `src/editor/tools/dbTools.ts`: `define_monster_species` upserts species records including `types` and `evolutions`, `set_type_chart` writes the system type matrix, and `give_starter_monsters` creates or updates the standard three-choice starter event using `choices` plus `giveMonster`. `define_monster_species.graphic.monsterResourceId` and `upsert_enemy.monsterResourceId` validate resource existence at tool execution time, try `monster` resource-search resolution for query-like values, and fail with `invalid-args` plus three available examples when unresolved. Regenerate the tool catalog after changing any of these schemas.
- Class promotion authoring lives on the Classes database record view and `src/editor/tools/dbTools.ts` as `define_promotion`. Keep `ClassRecord.promotions[]` validation, delete/reference scans, command summaries, nested `promoteActor` branch paths, and the tool catalog aligned whenever promotion requirements or branch semantics change.
- **Equipment effect summary chips (G006/G004):** Equipment detail form (`databaseEquipmentRecordView.ts`) shows a live chip row (`db-equipment-summary-chips`) via pure `equipmentEffectSummaryChips(record)`: effect-flag labels (?좎젣/2??공격/?꾩껜 공격/??, badges (?묒넀 ?λ퉬, ?二?, and counts (공격 ?띿꽦 N / ?띿꽦 방�뼱 N / ?곹깭 遺??N / ?곹깭 방�뼱 N); empty state is muted ?쒗슚怨??놁쓬?? Refresh chips on flag/badge/element/state edits. Play status menu detail text still surfaces runtime-relevant authored effects (double attack, elemental defense, state resistance). If equipment effect fields are added to DB records, update record normalization, DB tools, reference validation, battle aggregation, menu detail labels, **and** the summary-chip helper in the same change.
- Event command runtime parity badges are driven by `src/project/eventCommands/runtimeSupport.ts`. Command picker buttons and command-list rows share the badge renderer in `src/editor/panels/eventEditor/commandRuntimeBadge.ts`; keep `runtime-full | runtime-partial | editor-only` as the public support grades and update the support table when interpreter coverage changes.
- Enemy action switch picker controls should open the existing switch/variable picker when switches exist, and should be disabled with a clear title/ARIA reason when no switches exist.
- Switch/variable selection surfaces outside the utility tabs should include story flag ids when present, for example `0003: ?쒖옣怨?만남 쨌 met-mayor`. In the Database utility tabs, story flags are separated into a read-only `?ㅽ넗由??뚮옒洹?(?쎄린 ?꾩슜)` section so normal switch/variable rows stay visually clean. Switch and variable definitions have no configured count ceiling: new projects seed only one 20-row picker block for first-use command forms, `+ 추가` creates/reuses records on demand, and range authoring grows only through the requested last ordinal (including beyond 1000). Legacy projects that already contain 1000 unnamed preallocated slots remain readable and those unnamed rows stay hidden.
- The Terms utility tab edits optional `Project.meta.terms` fields grouped by battle, shop, inn, and common labels. Empty inputs delete the stored override and fall back through `src/project/terms.ts`; placeholders show the Korean defaults from `defaultTerms()` without forcing those values into old saves.
- `src/editor/databaseCommandReferences.ts` scans command-bearing database references, including common events and troop battle event pages. Keep `src/editor/databaseReferences.ts` as the message facade for delete blocking, including battle animation references from actors/classes and common-event delete checks.


## Beginner-centric adversarial review (2026-08)

`docs/reviews/db-beginner-adversarial-qa.md` is the current beginner-centric review of the whole Database modal: 24 surfaces x beginner/expert x 3 viewports, 289 consolidated findings (`docs/reviews/db-beginner-adversarial-qa-findings.md`), 25-heuristic disposition (met 2 / partial 15 / missing 8), and 14 evidence-linked improvement proposals (P0: timeSystem.onDayEnd delete guard, in-flight edit truncation on system section nav, virtualizer selection loss). A beginner-lane e2e contract now exists: `test/e2e/qa-db-beginner-mode.spec.ts` proves the Tools-menu entry, common-6 nav, plain jargon labels, and dirty guard under beginner chrome (see `openwiki/testing.md` for the full permanent + `_db-audit-*` diagnostic spec families).

## DB UI modernization (2026-08)

- **Party Studio actor/class build surfaces (2026-08-24):** Actor detail keeps every legacy field/testid but adds a schema-preserving build preview (`databasePartyBuildSummary.ts`) for runtime levels 1–99, with the authored natural `maxLevel` disclosed separately. Effective stats and listed starting equipment must use `effectiveActorEquipment` before delegating calculations to `actorDerivedStats`; DB growth skills come from `learnedSkillIds`. Missing or slot-invalid skill/equipment references render as inert warnings, never navigation links. The growth-source disclosure is intentionally precise: an actor's assigned starting class contributes class skills/commands/equipment relationships, while the actor's own parameter curves remain authoritative until a runtime class override from class change/promotion exists. Class detail adds a derived Lv20 role/build summary plus actor backlinks. The equipment metric counts `equipment.equippableClassIds` plus the class checklist (`equipmentPermissions.equipmentIds`) — not `canEquip`'s actorIds/classIds self-wildcard, which previously made the banner say 86 while six boxes were checked. Default starter classes no longer list themselves in those wildcard arrays; their parameter curves are role-biased so 전사/수호자/마도사/정찰병 read as 공격형/수비형/마력형/기동형 instead of a fake 균형형. Equal-stat curves are labelled `균일 성장`. Promotion add/remove re-renders the row list. The build eyebrow is Korean (`직업 설계`), not `CLASS BLUEPRINT`. Actor class/skill/equipment links and class actor backlinks set the destination record selection and call `switchDatabaseActiveTab` against the existing `.database-modal-body`; never reopen the Database modal. Actor class/equipment edits and class skill/command/equipment/promotion edits refresh their derived surfaces immediately. The preview level is editor-local and must not dirty or persist project data. Contracts: `test/databasePartyBuildStudio.test.ts`, `test/e2e/database-party-build-studio.spec.ts`.
- **Party Studio skill/item/equipment inspectors (2026-08-24):** Skill detail adds a live ability composer with activation/target/cost chips, ordered effect blocks, and exact-record backlinks for every authoritative consumer: actors, classes, items, equipment, enemy skill lists/actions, and monster-species level skills. Backlinks must update the destination tab's own selection state before using the existing same-modal tab switch. The skill animation stage registers its controller by stage-root element in `databaseSkillAnimationStage.ts`; DOM owners stop stages by scope before tab replacement, record-detail replacement, and modal removal, then the tab cache owner resumes autoplay after cached DOM reattachment. Picker replacement still stops its current stage directly. Item detail tells an effect story from runtime-enforced occasion and eligibility rules; optional schema fields that the runtime ignores for that item kind must not be presented as enforced restrictions. Equipment detail compares the selected actor's initial build by reusing `normalizeActorRecord`, `effectiveActorEquipment`, `transitionActorEquipment`, and `actorDerivedStats`; it explicitly excludes live-session class changes, permanent bonuses, and inventory state. These are editor-only derived views: no schema or persistence changes. Contracts: `test/databaseSkillComposer.test.ts`, `test/databaseItemInspector.test.ts`, `test/databaseEquipmentInspector.test.ts`, `test/databaseEquipmentRecordView.test.ts`.

The Database modal was modernized in six waves while keeping every hard contract (G006 in-modal jumps, dirty 3-way guard, AI dock visibility, existing `db-field-*`/`db-tab-*`/`db-type-chart-*`/`db-record-row-*` testids, zero schema changes). New surface styles are scoped to the modal.

- **Light palette is modal-scoped (W1):** `src/styles/database/light-theme.css` defines the cream palette (`rgba(248,245,236)` family) and is imported last in `src/styles/index.css` (after `dock.css`). Every rule is scoped under `.database-modal-backdrop` — nothing leaks to the app shell (the rest of the editor stays dark). Do not add `:root`/global rules to this file; new DB surfaces must consume these scoped tokens.
- **Global icon-rail navigation (W2, revised 2026-08-24):** `TAB_GROUPS` in `src/editor/panels/database.ts` still defines the 23-tab order and Ctrl+T cycle, but every full Database tab now shares the same 56px cream `.db-tabs` icon rail. Group headings and text labels are visually hidden; stable per-tab glyphs live in `sidebar.css`, while `title`/`aria-label`, `db-tab-*` testids, `.active`, and same-modal `switchDatabaseActiveTab` behavior remain unchanged. The tab search rests at 40px and expands as a 200px overlay on focus so it does not permanently consume content width. Dock mode remains a denser 48px variant. The rail later returned to a 220px labeled grouped form; see the sidebar rail accordion entry below for the current contract. Do not make System use a different rail geometry.
- **Sidebar rail accordion (2026-08-28):** the labeled 220px `.db-tabs` rail no longer pours all 29 tabs into one column. `TAB_GROUPS` entries carry a `slug` (party/monster/battle/life/world/system — regrouped 2026-08-29 from 5 to 6 because `전투·몬스터` held 9 tabs and `지형` sat in a battle group despite being map data); `TAB_GROUPS` is now the **only** hand-written rail order and `tabOrder` derives from it (`['overview', ...TAB_GROUPS.flatMap(g => g.tabs)]`) — the two hand-written orders had already drifted apart on `terrain`. Each `.db-tab-group` header renders `data-testid="db-tab-group-<slug>"` plus `aria-expanded`, and clicking one opens that group **exclusively** (accordion) - two open groups put the rail back into permanent scroll. Collapsed slugs persist in `localStorage` under `oprn:database.collapsedTabGroups`, read lazily on first render because module load happens before `window` exists in unit tests; the default collapses everything except the active tab's group. Measured before/after at 1600x1000: rail scrollHeight 1200 vs clientHeight 796 (404px permanently below the fold) became scrollHeight <= clientHeight. Rows are 36px, zero counts carry no badge at all (both `appendTabButton` and `refreshTabCounts`), badges use `tabular-nums`, and every tab keeps its icon at every width so the labeled rail is icon+label instead of a wall of Korean words.

  Traps this area has already sprung:
  - Group headers must stay non-focusable `DIV`s: `test/databaseSidebarKeyboard.test.ts` pins `tagName === "DIV"` and keeps headers out of tab order, so collapse is a click handler and keyboard users reach a collapsed group through the tab search filter.
  - The collapse chevron must come from CSS `::after`. `test/databaseSidebarNav.test.ts` pins `.db-tab-group` `textContent` to exactly the six labels, so a glyph added as text breaks it. This is the one legitimate `content:` in the rail — `test/databaseTabIcons.test.ts` only forbids `content:` on `.db-tab` itself (matched with `\.db-tab(?![-\w])`, so the group header is exempt).
  - **Tab icons are owned by `databaseTabIcons.ts`, not by CSS.** Distributing glyphs through per-testid `content` rules failed twice over: the list covered 24 of 29 tabs, so 생활 기술·제작 / 계절·날씨 / 동물·축사 / 농장 건물 / 낚시·채집 fell through to `content: attr(data-short)` and rendered a **Korean first letter** in the icon slot; and `system-studio.css` re-declared the same `::before` with `content: none !important`, winning on specificity (`:has(.db-system-studio) .db-tabs > .db-tab::before` is (0,4,1) against sidebar's (0,3,1), both `!important`) — so opening 시스템 above 1100px wiped all 29 icons. Specificity, not import order: reordering `index.css` would not have helped, the block had to go. `TAB_ICONS` is typed `Record<DatabaseTab, readonly SvgNodeSpec[]>`, so a new tab without an icon is now a **compile error**. `data-short` is gone; do not reintroduce it.
  - Stored collapse state must be sanitised against the current `TAB_GROUPS`. A returning user's `["battle","life","map","system"]` contains neither `monster` nor `world`, so after any regroup those render expanded next to whatever was already open — two open groups, which is exactly the permanent-scroll state the accordion exists to prevent. `readStoredCollapsedGroups()` drops unknown slugs and discards the whole stored value when more than one group would be open. Tests start from empty storage and never see this.
  - The collapsed rail zeroes the label's `font-size` but the label is still a flex item, so a leftover `gap` shifts the icon off-centre by half the gap in a 40px button. The collapsed and `.is-docked` blocks set `gap: 0`.
  - Collapse toggles `hidden` on sibling `.db-tab` buttons and must not wrap tabs in a container: the rail DOM contract is flat (search input, overview button, then alternating group headers and tab buttons) and `applyTabFilter` walks `header.children` directly.
  - `sidebar.css` carries a container query **and** a `@media (min-width: 800px)` fallback twin of the same rule. Fixing only the container query leaves the media fallback re-hiding the icon - change both or the desktop icons stay dead.
  - The collapsed rail sets `.db-tab { color: transparent !important }` to hide the label, and the icon strokes with `currentColor`. It survives because `.db-tab > .db-tab-icon { color: … }` is a **direct** declaration on the child: an inherited value has no specificity and loses to any direct declaration, so no `!important` is needed on the icon.
  - A group header aligned only with `text-align: left` still renders flush right: the header box shrinks to content inside the column and is pushed to the end. It needs `width: 100%` + `align-self: stretch`, and the contract test must measure the header's left edge against a tab row's left edge instead of reading computed `text-align` (that assertion passed while the pixels were still wrong).

  Contracts: `test/databaseTabIcons.test.ts` (icon coverage, house SVG spec, no color literals, no emoji, no CSS `content` glyph on `.db-tab`, no `attr(data-short)`) and `test/e2e/database-sidebar-rail-modern.spec.ts` (runs on **Firefox** - on hosts whose Docker bridges churn, Chromium aborts every module load with `ERR_NETWORK_CHANGED` and renders a blank page). Evidence: `output/evidence/db-rail-modern/`.
- **Per-modal tab render cache (2026-08-24):** Ordinary sidebar clicks reuse the detached DOM of tabs already visited in the current Database modal, avoiding repeated list/thumbnail/detail-form construction. The cache is scoped by modal host and exact `Project` object identity; every `store.update`/`replace`, undo/redo, AI/external project refresh, or renderer-time normalization changes that identity and drops all older entries. `refreshDatabasePanel` and programmatic G006 `switchDatabaseActiveTab` always render fresh because their target selection/session state may have changed. Debounced callbacks from a detached tab may invalidate only their old entry and must never repaint the currently active tab. Contract tests: `test/databaseRecordPartialRender.test.ts` (same-project DOM reuse + project-mutation invalidation); browser validation should sweep all 24 tab buttons and include an edit -> other tab -> undo -> return scenario.
- **Gallery view + category filter chips (W3):** `databaseRecordViewSession.ts` persists per-collection view mode (`rpg-zzu.database.viewMode`, `"gallery"|"list"`) and category filter (`rpg-zzu.database.categoryFilter`). Icon-bearing collections (items/equipment/actors/enemies/skills/classes/troops/states/battleAnimations) default to gallery; switch/variable/terms and other text collections stay list-only. Toggle buttons `db-view-toggle-gallery` / `db-view-toggle-list` are only rendered for gallery-eligible collections. Gallery cards (`button.db-gallery-card`, testid `db-record-card-<id>`) render a 48px thumbnail + name + category tag, windowed by the virtualizer (`databaseListVirtualizer.ts` columns option — 3 columns ≤1100px modal width, 4 above). Filter chips (`db-filter-chip-<id>`, "전체" = `db-filter-chip-all`) appear for items (ITEM_TYPES) and equipment (slots); they AND with the search query. The list view is preserved as a toggle — never remove it.
- **Modern control primitives (W4):** `src/editor/panels/databaseControls.ts` adds `sliderStepperField` (range+number pair, `-slider`/`-stepper` testid suffixes, clamped + step-normalized both ways), `segmentedControl` (native radio group — testid on the group, `-option` on each radio), `toggleSwitch` (checkbox `role="switch"`, Space/click native), and `avatarChipRow` (faceset circular chips, `aria-pressed`, `-chip` testid + `data-actor-id`). Existing `textField`/`numberField`/`selectField` signatures are unchanged. No custom focus traps; Escape keeps the modal's top-level routing.
- **Item/equipment inspectors (W4):** `databaseItemRecordView.ts` renders a header (96px icon + name `db-field-name` + type tag) above the workbench. Medicine HP/MP recovery % uses the slider/stepper (`db-field-item-hp-percent-stepper` etc., 0–100 step 5); 대상(scope) is a segmented control; usable actors are avatar chips (`db-field-item-usable-actors`, equipment items keep per-actor checkboxes `db-field-item-usable-actor-<id>`); menu/battle flags are toggles. `databaseEquipmentRecordView.ts` promotes the summary chip row (`db-equipment-summary-chips`, pure `equipmentEffectSummaryChips`) into the header next to icon + name + slot segmented control. The legacy duplicate name field was removed from `databaseRecordViews.ts recordForm` for items/equipment — the inspector headers own `db-field-name` (one element, Playwright strict-mode safe).
- **System Studio + section nav (W4.5, revised 2026-08-25):** `databaseSystemView.ts` splits the tab into 9 mounted sections (`db-system-nav-<slug>`: overview/party/display/resources/startup/optin/time/typechart/title). `overview` is the default and exclusively owns `databaseSystemStudio.ts`: the project-backed 시작 설정/파티/화면/시간 cards, a derived semantic state registry, the project-backed 전투 규칙/기능 확장/타이틀 cards, and a live title/current-value preview. The overview is a read-only summary and adds no authored fields; every ordinary card value must come from an existing `Project` field or a derived index. Unimplemented Save/Economy/Input editors stay hidden rather than appearing as placeholder cards, hard-coded completion/warning claims are forbidden, and preview facts are non-interactive until a real destination exists. State usage comes from `buildStoryFlagUsageIndex`, and card navigation delegates to the existing section/tab buttons. Switching sections only toggles DOM visibility — it never calls `store.update` (zero snapshots). Field testids (`db-field-system-*`) remain reachable inside hidden sections; structural contracts (party slots, time enable, type-list change re-render) are unchanged. `system-studio.css` consumes the shared cream Database palette, with a 184px section nav, 248px preview, and 18px content gutter beside the 56px global icon rail. Contracts: `test/databaseSystemStudio.test.ts`, `test/databaseSystemSections.test.ts`, `test/e2e/database-icon-rail.spec.ts`, and the ≥95% structural parity capture in `test/e2e/system-studio-visual.spec.ts`. Browser evidence: `output/evidence/system-studio/system-studio-backed-settings-1586x992.png`.
- **Type-chip matrix (W4.5):** `typeChartFieldset` renders one `button.db-type-chip` per attacker×defender pair with testid `db-type-chart-<attacker>-<defender>` and `data-value` (machine-readable multiplier; `data-state` = up/down/neutral/diag). Left-click cycles 0→0.25→0.5→1→1.5→2→3→4; right-click opens a clamped `[0,4]` step-0.25 popover (`db-type-chart-popover-input` / `-confirm`). The line above the matrix is an edit hint ("칸을 누르면 배율이 바로 바뀝니다"), not a read-only preview. `normalizeTypeChart` semantics are unchanged: blank type list deletes `system.typeChart` after confirm, 32-type cap, `[0,4]` clamp. `qa-system.spec.ts` still reads cell values via `data-value`.
- **Overview dashboard tab (W5):** `db-tab-overview` is the pinned first sidebar entry; it is never the default open tab (last-used tab persists via `rpg-zzu.database.activeTab`). `renderOverviewTab` (`databaseOverviewView.ts`) shows 9 collection stat **buttons** (`db-overview-stat-*`) that jump via `switchDatabaseActiveTab` (G006), then lazily injects the start-party power curve (inline SVG `db-overview-curve` + `db-overview-curve-legend`), monster HP-vs-hit scatter (`db-overview-scatter`), issue cards, and the ✨ AI 분석 button via `requestIdleCallback` (200ms `setTimeout` fallback) — only on the overview tab, never on first modal entry to another tab. `partyPowerCurve` reads `system.startActorIds` (authored start party), not leftover session party. Attack-stagnation issues jump to **classes**. The view has zero write paths. Evidence: `test/e2e/db-desktop-matrix.spec.ts` runs the full flow (modal → sidebar → gallery → filter chip → item slider edit → type-chip matrix → overview → dock toggle) at 1024×768 / 1280×800 / 1440×900 with console-clean assertions and `dbmodern-<viewport>-<step>.png` screenshots under `.superpowers/sdd/qa-shots/`.
- **Tileset graphic picker (2026-08-20):** `tileset-rm2k3-graphic-browse` is enabled (`설정...`). It opens `tileset-graphic-picker` listing bundled chipsets plus uploaded `chipset`/`tileset` assets (not `picture`). Same-id pick is a no-op unless `tilesPerRow`/`tileSize`/`count`/`passability` length is stale, in which case it remaps to `CHIPSET_SLICING` + `TILE_FRAME_COUNT`. Bundled EasyRPG and uploaded chipset/tileset both remap those arrays. Display shows the Korean chipset name; raw id stays in `title`. Tests: `test/databaseTilesetGraphicPicker.test.ts`.
- **Tileset tab slim (2026-08-31):** default surface is the chipset sheet + passage/layer. Per-tile `description` lives in a collapsed `<details>` on the knowledge tab (`tileset-tile-meaning-details`); group prose (`description` / `placementRules`) is likewise folded (`tileset-knowledge-prose`). Harness seed no longer copies group essays onto every `tileMeta.description` (`applyTileContract` in `combinedTown.ts` / `themePacks.ts`). The unused `최대 개수 (고정)` button, inline AI launcher, duplicate full-sheet button, and compose-tab dummy side pane are gone. `AI 타일셋` stays on the detail hero. Tests: `test/tilesetSectionTabs.test.ts`, `test/tilesetHarness.test.ts`, `test/e2e/oprn-tileset-readability.spec.ts`.
- **통행 붓 + 넓은 시트 (2026-09-01):** 타일 규칙(통행) 면은 칸 클릭 토글이 아니라 **통과/막힘/위 ★ 붓**이다. 시트에서 클릭·드래그가 그 규칙을 칠하고, 통과 칸은 글자를 비워 그림을 가리지 않는다. 레이어·나침반(4방향)은 오른쪽 얇은 인스펙터. 방향별 통행은 기본으로 열려 있고, 화살표를 눌러도 접히지 않는다. 통행 면의 라벨 입력은 빼 둔다(우클릭 의미 편집·지식 탭). 이름/그래픽/투명색 카드는 시트 **아래**. 목록 열은 176–200px. **전체창**도 같은 붓(통과/막힘/위 ★) + 순환이며 클릭·드래그로 칠한다. Tests: `test/tilesetSectionTabs.test.ts`.
- **Animation frame pick + battle-command door (2026-08-20):** `selectFrame` writes `editorState` **and** calls the form `rerender` so `.active` and the cell table follow the row/prev/next (do not rely on map `refreshPanels`). Battle Commands keep `db-field-battle-command-*` (no `database.battleCommands` path copy); kind labels match class `COMMAND_KIND_LABELS`; skill is a named `<select>` (`db-picker-battle-command-skill-*`) plus a visually hidden fillable `db-field-battle-command-skill-*`; `db-open-classes-tab` jumps via G006. Animation graphic uses `resourcePickerControl` kind `battle` (visible name + 설정..., fillable hidden id). Battle Screen uses a System2 resource picker. Tests: `test/databaseAnimationFrameSelect.test.ts`, `test/databaseBattleCommandsTab.test.ts`.
- **Battle Studio surfaces (2026-08-24, revised 2026-09-04):** `battleAnimations`, `battleScreen`, `battleCommands`, and `terrain` keep the Database modal's cream shell, sidebar, record list, and every existing field/testid, but share a canvas-first studio language through `databaseBattleStudio.ts` and `src/styles/database/battle-studio.css`. `battleStudioHeading` renders the description callers pass as `.db-battle-studio-sub` (scoped under the modal selectors). The shared underline navigation must call `switchDatabaseActiveTab` (G006) and never reopen the modal. Animation editing is arranged as a dark stage, a scrollable light inspector, and an integrated dark timeline; Battle Screen previews the resolved background/enemy assets beside system controls and a troop strip, and links out to system › 시작 설정 (`db-battle-screen-open-system-startup`, `requestSystemSection("startup")` + focus on `db-field-system-battle-ui-style`) for UI style / rule model which live only there; Battle Commands pairs a live menu canvas with class-link guidance and editable command cards; Terrain pairs presets, a live backdrop, and the existing record controls. Flow wording is `턴 전투` / `게이지 전투` everywhere (`엄격 턴제` retired; `라운드` retired). This is derived/editor UI only: zero schema or persistence changes. The root surface explicitly owns a one-column grid so legacy `.db-detail-form` desktop columns cannot scatter its regions. At 1024px the workspaces stack inside the existing detail scroll area without document-level horizontal overflow; 1440px uses stage/inspector columns. Contract: `test/databaseBattleStudio.test.ts`; browser evidence: `output/evidence/database-battle-studio/`.

## P2 spatial authoring (2026-08-25)

- The Life group owns `farmSpatial` (`db-tab-farm-spatial`, label `농장 건물·집 꾸미기`). `databaseFarmSpatialView.ts` is a structured four-panel editor for `database.farmBuildingTypes`, `database.homeDecorationTypes`, `session.farmBuildingPlacements`, and `session.homeDecorationPlacements`; it never edits P1 `system.farmAnimalBuildings` or legacy `session.placeables`.
- Building levels expose footprint, generic capacity, build/upgrade gold and item costs, base/orientation graphics, and allowed maps. Decoration types expose their inventory item, footprint, movement blocking, allowed rotations/maps, and graphics. Starting placements expose type, level where applicable, map, x/y, and orientation. ID edits cascade to authored placements atomically; referenced type deletion is blocked.
- Structural changes use `recordProjectSnapshot`; field changes use `recordCoalescedSnapshot`, preserving Database dirty/undo behavior. The aggregate tab count includes both type tables and both starting-placement arrays.
- Product artwork is `/assets/farming/life-ui/decorating-card.png` (`db-spatial-hero-image`). CSS is isolated in `styles/database/desktop-record-shell/12-spatial-authoring.css`: a two-column 1440 layout collapses at a 980px container and again at 680px for the 1024 acceptance lane.
- Stable browser entry points: `db-spatial-workspace`, `db-spatial-add-building-type`, `db-spatial-add-decoration-type`, `db-spatial-add-building-placement`, `db-spatial-add-decoration-placement`, plus record IDs prefixed `db-spatial-building-*` / `db-spatial-decoration-*`. Focused coverage: `test/p2SpatialEditorAuthoring.test.ts` and the Database sidebar suites.

## 세계 그룹 — 타일셋이 중간 카테고리 (2026-09-01)

`세계` 레일은 `생성 규칙`(프로젝트 전역) 다음에 **타일셋 폴더**를 둔다. 폴더 자식은
통행(`db-tab-tilesets`, testid 유지 — e2e 가 이 버튼을 누른다) · 오토타일 설정 ·
미분류 모아보기 · 구조물 · 공간 종류. 마을·지형 효과·공용 이벤트는 폴더 밖 형제다.

칩셋 선택은 `oprn:database.selectedTilesetId` 한 키를 공유한다. 「방」 단독 탭은 없다 —
공간 종류는 통행과 같은 층의 이 칩셋 면이다. 폴더 버튼 testid `db-tileset-folder` 는
`.db-tab` 이 아니다(키보드/DOM 순서 계약은 자식 탭만 센다). 접힌 「세계」 부제는
자식 다섯을 나열하지 않고 「타일셋」 한 낱말로 접는다.

타일셋 워크스페이스 **안쪽** 섹션 탭(타일 규칙/단어장/구성)은 그대로 둔다. 레일 면은
그 모드의 바로가기이고, 안쪽 탭을 없애면 기존 e2e 가 깨진다.

## 오토타일 설정 — 9칸/11칸/커스텀 카드 (2026-09-01)

`db-tab-tileset-autotile` 과 구성 탭은 같은 면이다. 예전의 멤버 번호 나열·16칸
비트마스크·「템플릿에서 만들기」숫자 위저드는 기본 표면이 아니다.

- **형식 카드:** 워크벤치 맨 위 전폭. 9칸(3×3) · 11칸(3×4, 외딴 점·오목 코너) · 커스텀.
  카드를 고른 뒤 칩셋에서 블록 **왼쪽 위**를 누르면 그룹이 생긴다(`addAutotileGroupFromTemplate`).
- **격자:** 오른쪽 사이드바는 오토타일 전용이다(선택 타일 인스펙터 없음). 선택된 그룹의
  역할 격자가 **먼저** 보이고, 그룹 칩 목록은 그 아래 짧은 스크롤 띠다. 「기본 그룹 불러오기」는
  그 띠 오른쪽에 있다. 칸을 누른 뒤 시트를 누르면 그 역할만 바뀐다. 내장 그룹은 보기만
  되고 칸 클릭 또는 「이 그룹 편집」으로 복사한다.
- **시트 클릭:** `editMode === "autotile"` 에서 `applyAutotileSheetPick`. 9칸/11칸이 선택된 뒤에는
  블록 왼쪽 위로 그룹을 만들고, 아니면 **이미 있는 그룹 멤버를 누르면 그 그룹을 고른다**.
  호버 시 블록 칸에 `.autotile-hover`. 멤버 칸은 `.autotile-member`.
- **통행:** 오토타일 격자 아래 「이 블록 통행」으로 멤버 칸 전부를 통과/막힘/위 ★로 칠한다.
  지금 블록의 다수 통행이 버튼에 `.active` 로 보인다.
- 비트마스크·연결 타일 숫자는 `<details>` 「고급」 안에만 남긴다. 6칸·물 애니메이션은
  처음부터 보이며 「다른 형식 접기」로 숨긴다. 순수 계산은 `tilesetAutotileLayout.ts` /
  `tilesetAutotileTemplates.ts`. Tests: `test/tilesetAutotileEditor.test.ts`,
  `test/tilesetAutotileLayout.test.ts`.

## 공간 종류와 구조물은 다른 면이다 (2026-09-01)

`공간 종류`(`tilesetSpaces`, `src/editor/panels/tilesetSpacesTab.ts`) 는 장소 문법이고,
`구조물` 은 찍을 타일 덩어리다. 예전에는 공간 종류 탭이 `setStructureKitFolderView("spaces")`
로 구조물 앨범을 열어 실내 오브젝트 표·[+ 새 구조물]·방 카드가 한 화면에 섞였다.

| | 공간 종류 | 구조물 |
|---|---|---|
| 무엇인가 | 침실·주방·광장처럼 **장소의 문법** | 집·우물·침대처럼 **찍는 모양** |
| 데이터 | `tileset.interiorRoomKinds` | `tileset.structureKits` + 내장 킷 + 실내 가구 |
| 화면 | 카드 + 이름·필수 역할·분위기·복도 | 앨범·원본 칩·래스터 표·편집기 |
| 하지 않는 일 | 타일을 찍거나 킷을 복제 | 방 문법을 정의 |

실내 칩셋만 기본 7종을 시드한다. 마을 칩셋에 침실을 기본으로 얹지 않는다.
공간 카드의 역할 썸네일은 그 역할을 채우는 가구의 **미리보기**일 뿐이고, 가구를
고치는 자리는 구조물 탭이다. 계약: `test/tilesetSpacesTab.test.ts`,
`test/databaseTilesetFolder.test.ts`, `test/structureKitDbTab.test.ts` 의
「구조물 탭은 공간 종류를 그리지 않는다」.

## 맵 → 타일셋 → 개념 꾸러미 (2026-09-02 시작, Phase 4 졸업)

~~데이터베이스 레일에 **임시** 그룹을 두고, 그 안에 `개념 꾸러미`(`scratchConcepts`) 한 탭만 둔다.~~
**Phase 4(개념 통합)에서 임시 그룹을 졸업했다** — `개념 꾸러미`(`scratchConcepts`)는
「맵」 그룹 타일셋 폴더(통행·오토타일·미분류·구조물·공간 종류 옆)에 있다.
세계·공간 종류·구조물과 아직 합치지 않는다 — 시설→장소→물건→칩 나무를 그림으로
저작하는 실험 면이다. `place_concept(query)` 가 이 필드를 읽어 시공한다.

**2026-09-03 — 이 탭은 템플릿 편집기다.** 「AI 는 소비만」을 철회했다. 여기서 고친 시설은 모델이 `get_concept_facility` 로 읽는 **출발점**이고, 모델은 요청에 맞게 장소·물건을 고친 `plan` 을 `place_concept` 에 넘겨 방 수·크기·내용물이 다른 시설을 짓는다(`openwiki/editor-ai-tools.md` 2026-09-03 항목). 사용자가 `required` 로 박은 물건을 모델이 빼면 경고가 남는다. plan 없이 부르면 종전대로 템플릿 그대로다.

- 데이터: `tileset.scratchConceptBundles`. undefined 는 시드 전, 빈 배열은 사용자가 지운 상태.
- 실내 칩셋만 **시설 초안 묶음 아홉 종**을 시드한다(`CONCEPT_FACILITY_TEMPLATES`: 여관·민가·상점·술집·서재·대장간·교회·창고·길드, 여관이 첫째). 마을 칩셋에는 얹지 않는다. 옛 프로젝트에 여관만 시드돼 있으면 그대로다 — 나머지는 시설 띠의 「초안 넣기」로 골라 넣는다(재시드 아님, 사용자 선택).
- 물건의 그림은 같은 타일셋 가구 킷/`INTERIOR_OBJECT_CATALOG` id 를 가리킨다. 픽셀을 복제하지 않는다.
- 칩은 내장 8종(`pass`/`block`/`event`/`transfer`/`loot`/`sleep`/`floor`/`wall`) + 사용자 자유 칩. 산문 배치 규칙이 아니다. 자유 칩은 엔진 무동작 메모 태그 — 시공 분류·이벤트·점수·컨텍스트가 모르는 칩을 무시한다. 규칙은 `src/project/types/conceptBundle.ts` 의 `CONCEPT_FREE_CHIP_PATTERN` / `validateConceptChipId` 한 곳이다: 빈 id·32자 초과·영문·숫자·-_ 외 문자를 한글 이유로 거절하고, 내장 칩은 항상 통과한다. 인스펙터 추가·이름 변경(`scratchConceptTab`), plan `parseChips`, 타일셋 검증(`shapeResourceFields`)이 같은 검증기를 쓴다. 화면에서 내장 칩은 토글 버튼, 자유 칩은 id 입력으로 이름을 바꾸고 지우기 버튼으로 삭제한다. 잘못된 입력은 `scratch-concept-chip-error` 에 이유를 보여 주고 저장하지 않으며, 이름 변경 실패는 예전 id 로 되돌린다.
- 화면: 타일셋 레일 + 장소 카드(가구 썸네일) + 인스펙터(큰 미리보기·이름·그림·그림 칠하기·칩 토글/자유 칩 편집·장소 소속).
- 사용자가 고친다: 시설명, 장소 추가/삭제/이름, 물건 추가/삭제/이름/그림/그림 직접 칠하기, 칩 토글/자유 칩 추가·이름 변경·삭제, 장소 소속, 필수 여부. 모두 `store.update` 로 `scratchConceptBundles` 에 남고, 다음 `place_concept` 가 그 나무를 읽는다.
- 물건 그림(2026-09-04): 인스펙터의 「그림」 셀렉트(`scratch-concept-thing-graphic`)가 같은 타일셋 가구 목록(`objectsForTileset` — 프로젝트 킷 → 카탈로그 순)에서 `thing.objectId` 를 갈아 끼운다. 모르는 id(옛 나무·지운 킷)는 「그림 없음」 옵션으로 남아 미리보기에 「그림 없음」이 뜬다. 이름과 달리 물건 id 는 그대로라 시공·이벤트·필수 판정이 갈라지지 않는다.
- 그림 직접 칠하기(2026-09-05): 인스펙터의 「그림 칠하기/사본 만들어 칠하기」(`scratch-concept-thing-paint`)가 구조물 타일 에디터(`openStructureKitEditor`)를 연다. 타일셋 저장 그림이면 그 킷을 바로 고치고, 카탈로그 그림이면 사본(`duplicateIntoTileset`)을 만들어 이 물건에 붙인 뒤 연다 — 원본 카탈로그는 그대로 둔다. 저장은 에디터가 즉시 하고 닫히면 인스펙터를 다시 그린다.
- 장소 카드 물건마다 바로 칠하기(2026-09-05): 각 물건 칩에 `scratch-concept-thing-paint-<thingId>` 가 있다. `ensureThingKitForEdit(tilesetId, bundleId, thingId)` 가 저장 킷 id 를 돌려주거나 카탈로그면 사본을 만들어 `thing.objectId` 를 붙인다 — 인스펙터 버튼과 같은 경로. 피커 항목은 아직 물건이 아니라 칠하기가 없다. 계약: `test/scratchConceptTab.test.ts`.
- **장소 도면 필드 (2026-09-02 시공 개편):** 장소 레코드에 선택 필드 `role`(`entrance` 홀·정문 / `walkway` 복도 / `room` 방), `size`(`s` 5×3 · `m` 7×4 · `l` 9×5), `count`(1..4, 같은 장소 여러 개) 가 붙었다. 장소 카드의 도면 열(`scratch-concept-place-role-<id>` / `-size-<id>` / `-count-<id>`)에서 고친다. 필드가 없는 옛 나무는 기본값(방·보통·1)으로 읽고, 복도는 라벨(복도·통로) 폴백으로 알아본다. 검증기(`shapeResourceFields`)가 모르는 role/size 와 범위 밖 count 를 거절한다.
- 여관 초안 시드: 침실 `room·m·count 2`, 복도 `walkway`, 식당/홀 `entrance·l`. 도면은 남→북으로 홀(정문) → 복도 → 객실 ×2.
- **시설 띠·재질 (2026-09-02 시설 다양화):** 보드 위에 시설 띠(`scratch-concept-facilities`)가 이 타일셋의 꾸러미를 칩(`scratch-concept-facility-<bundleId>`)으로 늘어놓는다. `+ 시설`(`scratch-concept-facility-add`)은 빈 꾸러미를 만들고, 아직 없는 초안이 있으면 `초안 넣기…` 셀렉트(`scratch-concept-template-select`)가 그것만 보여 준다. 도구줄의 `시설 삭제`(`scratch-concept-facility-remove`)는 꾸러미를 지운다 — 마지막 것을 지우면 빈 배열이 남고 다시 시드하지 않는다(빈 화면의 `초안 N종 넣기`(`scratch-concept-seed-templates`)가 다시 넣는 유일한 길). 시설에 **벽 재질** `wall`(`cream`·`gold-brick`·`stone-brick`, `scratch-concept-facility-wall`), 장소에 **바닥 재질** `floor`(`wood`·`stone`·`plank`·`mat`, `scratch-concept-place-floor-<id>`)가 붙었다. 기본값(크림·나무)은 필드를 지운다. 시공 뒤 파이프라인 리틴트가 그 방 바닥·그 시설 벽면을 갈아 끼운다. 장소 카드에 **층** `level`(1~3, `scratch-concept-place-level-<id>`, 2026-09-03)이 더 붙었다 — 2층 이상 장소는 `place_concept` 이 `<mapId>_2f` 별도 맵으로 짓고 계단(맵 연결 칩) 물건이 층을 잇는다. 1층은 필드를 지운다.
- 피커는 프로젝트 킷 뒤에 카탈로그에만 있는 소품(성상·과일 선반·항아리 선반·곡물 자루·잡화 상자·물통·주전자·스툴·붉은 카펫·짚 돗자리)을 이어 보여 준다 — 킷을 옛 카탈로그로 시드한 프로젝트에서도 고를 수 있다. 러그류(`rug*`)는 기본 칩이 통행 가능·바닥, 계단류(`stairs*`)는 통행 가능·맵 연결.
- 진입: `src/editor/panels/scratchConceptTab.ts`. 초안 데이터: `src/project/defaults/conceptFacilityTemplates.ts`. 계약: `test/scratchConceptTab.test.ts`, `test/conceptFacilityTemplates.test.ts`, `test/placeConceptTool.test.ts`. 시공 쪽 설명은 `openwiki/editor-interior-room-harness.md` 「개념 시설 시공」. 갤러리 보고서: `npx tsx scripts/gen-concept-facility-gallery.mts` → `reports/concept-facilities/index.html`.

## '구조물' 탭 — 두 출처 앨범 + 방 종류 문법 (2026-08-28)

`src/editor/panels/structureKitDbTab.ts` + 데이터 계층 `src/editor/panels/structureKitDbSources.ts`.

- **목록 규약은 등록 킷**: `tileset.structureKits`. 집 외장은 `author_house` 정본이 담당하므로 내장 파라메트릭 집 선반은 없다.
- **타일셋 레일이 앨범 축, 원본 칩이 그 안의 필터**: `structure-kit-source-all` / `-interior` / `-user` (라벨 전체 · 실내 오브젝트 · 내가 저장한 구조물). 각 칩의 숫자는 그 원본이 지금 나열하는 행 수와 같다.
- **실내 오브젝트는 타일셋 데이터**: `interiorObjectsForTileset` 은 그 타일셋의 실내 가구 킷(`ai.snap` / `ai.interiorRole` / `learnedFrom: interior-catalog`)을 돌려준다. 실내 칩셋은 코드 카탈로그를 시드·폴백한다. **방·공간 종류는 이 탭이 아니다** — `tileset.interiorRoomKinds` 는 형제 탭 `tilesetSpaces` 가 저작한다. "한 타일셋의 구조물은 다른 타일셋에 섞이지 않는다"는 기존 IA 규약을 그대로 지킨다.
- **행은 실제 래스터**: 오브젝트 행 `structure-kit-object-<id>` 은 `INTERIOR_OBJECT_CATALOG` 의 셀을 `renderTileCellsToCanvas` 로 그린다(받침 타일 `VR.FLOOR`). 킷 행 `structure-kit-db-<kitId>` 은 기존대로 `assembledKitCells`.
- **가상 항목은 실내 카탈로그 오브젝트뿐이다**: 실내 카탈로그 오브젝트는 프로젝트 데이터가 아니라 코드다 — 이름 변경·삭제를 노출하지 않고 인스펙터가 그 이유를 적는다. 등록 킷의 액션은 이름 변경, 부위 삭제, 문에서 입구 추정, 팔레트에서 쓰기, 복제, 편집, 낱개 내보내기, 삭제다.
- **빈 상태 카피는 불변**: 앨범에 아무것도 없을 때 `structure-kit-db-empty` + `이 타일셋에는 아직 구조물이 없습니다.`. 원본·검색·테마 필터 때문에 행만 없는 경우는 `structure-kit-source-empty` 로 구분해 안내한다.
- 커버리지: `test/structureKitDbTab.test.ts` (앨범 기본 선택, 내장 킷 노출, 레일 카운트, 빈 카피, rows 없는 malformed 킷 무크래시, 내장 킷 삭제 버튼 부재, 세 원본 칩 카운트 일치, 오브젝트 인스펙터, 공간 종류 카드 부재). 스타일은 `src/styles/editor/harness-suggestion.css`.

## '구조물' 편집기와 파일 입출력 (2026-08-29)

읽기 전용 진열대였던 탭이 **직접 만들고 고치고 파일로 주고받는 어휘집**이 됐다.
설계는 `docs/superpowers/specs/2026-08-28-db-structures-editor-design.md`.

- **편집 잠금은 계보가 아니라 소유로 판정한다.** 예전에는 `learnedFrom` 을 보고 잠갔는데, 그러면 사람이 만든 킷도 계보 값에 따라 잠긴다. 이제 앨범 엔트리의 `source` 가 `"user"` 인지(= `tileset.structureKits` 에 실제로 들어 있는 프로젝트 데이터인지)로 판정한다. 내장 파라메트릭 킷과 실내 카탈로그 오브젝트는 코드라서 잠긴 채로 남는다. 같은 이유로 `toast()` 만 부르고 아무것도 저장하지 않던 가짜 `[지금 저장]` 버튼은 사라졌다 — 저장은 `store.update()` 즉시 반영이고 취소는 DB 모달의 세션 롤백이 담당한다.
- **아무 원본이든 편집은 `section` 으로 굽는다(bake).** house 파라미터와 실내 카탈로그 오브젝트를 래스터 `rows` 로 전개한 뒤 편집한다(`structureKitRasterModel.ts`). 즉 복제는 사진을 찍는 행위다 — 원본 코드가 나중에 바뀌어도 구운 사본은 그대로다. 계보는 `learnedFrom: "db-authored"` 로 남는다.
- **편집기는 DB 모달 위에 뜨는 전용 다이얼로그**(`structureKitEditorDialog.ts`, testid `structure-kit-editor`)다. 인스펙터 열이 352px 고정이라 9×8 킷이 들어가지 않는다는 치수 실측 때문이며, 인스펙터(`structureKitInspector.ts`)는 요약과 액션만 담당하도록 물러났다.
- 진입점: 도구줄 `structure-kit-new` → 빈 킷으로 직행. 표 행 더블클릭과 인스펙터의 복제·편집 버튼도 같은 편집기를 연다. 편집기 안은 `structure-kit-editor-canvas`, 타일 팔레트 `structure-kit-editor-tile-<tileId>`, 부위 도구 `structure-kit-editor-tool-part`, 부위 목록 `structure-kit-editor-parts`.
- **칸 계산 함수는 `rect`·`scale` 을 인자로 받는다.** 유닛 테스트 환경이 `environment: "node"` + `FakeElement` 라 `getBoundingClientRect()` 가 전부 0 이고 `getContext()` 는 `null` 이다. 내부에서 `event.clientX - rect.left` 를 읽으면 테스트가 항상 (0,0) 을 보게 되므로 순수 함수 경계를 이렇게 그었다 — 클릭 좌표 → 칸 매핑의 실제 증명은 e2e 몫이다.
- **크기 조절은 부위 손실을 숨기지 않는다.** `resizeKit` 은 새 크기 밖으로 나가는 부위를 보고서로 돌려주고, 편집기가 그 사실을 사람에게 알린 뒤 반영한다.
- **AI 메타는 초안과 승인이 분리된다.** `StructureKitAiMeta`(`description`·`placementRules`·`tags`·`role`·`repeatability`)에서 AI 초안(`structure-kit-editor-ai-draft`)은 폼을 채우기만 하고, `structure-kit-editor-ai-accept` 를 눌러야 `store.update()` 가 일어난다. **어떤 자동 경로도 `origin` 을 `"user"` 로 만들지 않는다**(제로 부트스트랩). 미승인 메타는 인스펙터가 `structure-kit-ai-unapproved` 로 구분해 적는다.
- **구조물 스탬프는 사람 팔레트 전용이다 (2026-08-31).** 집 시공은 `author_house`.
- **`repeatability` 가 시공 반복을 지배한다.** 이 값이 없으면 우물·간판처럼 한 채로 완결인 구조물도 이어 찍힌다. `ai.repeatability === "fixed"` 면 1회로 고정하고 `undefined` 는 기존 동작을 유지한다 — 하위 호환. 이 반복 규칙은 사람 팔레트/`applyStampStructureKit` 경로의 계약이다.
- **AI 가 받는 것이 넓어졌다.** `src/ai/contextBuilder.ts` 가 구조물마다 설명·배치규칙·반복 여부를 함께 출력하고(설명은 100자로 자른다), `structureKitTools.ts` 의 도구 응답도 `ai` 를 싣는다. 이름만 보고 추측하던 상태를 끝낸 것이다.
- **파일 포맷은 `rpgzzu-structure-kits` v1**(`structureKitFile.ts`). 파일에 들어가는 순간 사진이 된다 — house 킷도 구운 래스터로 나가므로 받는 쪽에 같은 코드가 없어도 열린다. 가져오기는 `planImport` 가 3단으로 판정한다: 포맷·버전 검증(미래 버전 거부) → 칩셋 경계 확인(`structure-kit-import-mismatch`) → 서명 기준 중복 판정. 같은 파일을 두 번 넣어도 사본이 쌓이지 않는다.
- 내보내기·가져오기 진입점: 도구줄 `structure-kit-export`(체크된 행이 있으면 **지금 보이는 그 선택**만, 없으면 앨범 전체) / `structure-kit-import`, 확인창은 `structure-kit-import-list` + `structure-kit-import-confirm`. 다운로드는 `src/util/downloadBlob.ts` 한 곳을 지난다 — anchor 를 DOM 에 붙였다 떼고 `revokeObjectURL` 을 동기 호출하지 않는, `menu.ts` 에서 겪은 3-버그 회피 패턴이다.
- 커버리지: `test/structureKitRasterModel.test.ts`(칸 계산·페인트·크기조절·부위 CRUD·굽기), `test/structureKitFile.test.ts`(직렬화·검증·`planImport`·origin 보존), `test/structureKitEditorDialog.test.ts`, `test/structureKitTools.test.ts`(repeatability), `test/downloadBlob.test.ts`, 그리고 브라우저 왕복은 `test/e2e/db-structure-editor.spec.ts` 3케이스.

## 삭제 가드는 묶음 조건(all/any/not) 안까지 본다 (2026-08-29 실측 결함 수정)

`Condition` 이 `all`/`any`/`not` 을 갖게 된 뒤 런타임 평가기와 일부 검증기는 갱신됐지만
**참조 스캐너는 갱신되지 않았다.** `src/editor/databaseCommandReferences.ts` 의 두 함수가
leaf 조건에서 멈추고 `default: return false` 했다:

- `conditionReferencesSwitchVariable` — `switchVariableReferencedInProject` →
  `databaseReferences.ts:298` `switchVariableReferenceMessage` → `actions.ts:425/457`
  `deleteSwitch`/`deleteVariable` 는 메시지가 `null` 이면 **삭제한다.**
- `conditionReferencesDatabase` — 아이템·주인공·적 삭제 가드가 같은 방식으로 눈이 멀었다.

결과: AND/OR/NOT 그룹 안에서만 쓰이는 스위치·변수·아이템이 **경고 없이 삭제되고**, 남은 조건은
`(session.switches[condition.switchId] ?? false)` (`src/project/io/pageResolution.ts:34`) 로
판정돼 페이지가 조용히 안 켜진다(값이 `false` 면 반대로 늘 켜진다). 아무것도 던지지 않는다.

두 함수 모두 `all`/`any` 는 `condition.conditions` 로, `not` 은 `condition.condition` 으로
재귀한다. 형태는 이미 올바르게 재귀하던 형제
`src/project/io/commandReferenceValidation.ts:116` `collectConditionItemReferenceIds` 에서 가져왔다.
계약 테스트: `test/databaseReferenceGuards.test.ts` (all 안 스위치 / not 안 변수 / any 안 아이템 +
참조 없는 스위치는 여전히 삭제되는 회귀 케이스).
## '진영' 탭과 몬스터 소속 진영 (2026-08-29)

전투 태도표(`project.factions`)를 사람이 저작하는 화면. 데이터 규약은 `openwiki/runtime-project-schema.md`, 전투 판정은 `openwiki/runtime-action-combat.md` 가 소유한다.

- **탭 등록**: `factions`(`db-tab-factions`, 라벨 `진영`)는 `몬스터` 그룹의 `enemies` · `monsterSpecies` · `troops` 뒤에 온다. 카운트는 `2 + 예약 id 를 뺀 저작 진영 수`라서 아무것도 만들지 않은 프로젝트도 `2`(예약 `player`/`enemy`)로 나온다. 화면은 `databaseFactionView.ts`(공용 `workspaceShell`/`listPane`/`detailPane` 빌더), 순수 변경 모델은 `databaseFactionModel.ts`.
- **기본값과 대칭 판정을 UI 가 다시 구현하지 않는다.** 표시값은 전부 `resolveFactionTable` → `factionStance` 를 거쳐 나오고(`authoredFactionStance`), 관계가 없을 때의 값도 관계를 비운 테이블에서 구한다(`defaultFactionStance`). 편집기가 자체 기본값을 세우면 "우호로 바꿨는데 계속 적대"처럼 전투와 어긋나는 화면이 생긴다. 목록 순서도 `table.ids` 라 예약 진영이 항상 앞자리(번호표 `예약`)이고, 삭제 버튼은 예약 id 에서 disabled 다.
- **관계 편집의 정면은 선택 진영 목록이다(2026-09-04).** 카드 `db-faction-relations` 는 선택 진영을 제외한 모든 상대를 나열하고, 각 행에 현재값 칩(`바꿈` / `기본`), 실제 전투 결과(`willAttackOnSight` 양방향 평가: `이쪽이 먼저 공격` / `상대가 먼저 공격` / `서로 먼저 공격하지 않음`)를 함께 보여 준다. 버튼 다섯 개가 `setSparseFactionStance` 로 바로 저장한다. 태도는 허가일 뿐이라 선공 설명은 전투 결과 한 줄로만 둔다 — 우호(1 이상)의 아군 오사격 면제는 `isHittableByFaction` 규칙이며 버튼 툴팁에 적는다.
- **행렬 셀도 한 쌍을 대칭으로 쓴다.** 카드 `db-faction-matrix-card`(`전체 관계표 (고급)`)는 기본 접힘(`collapsible`, `collapsed`)이고 목록과 같은 값을 보여 준다. `db-faction-matrix` 의 셀 `db-faction-stance-<rowId>-<columnId>` 은 누를 때 -2 → -1 → 0 → 1 → 2 로 순환하고 `data-authored` 로 바뀜/기본을 구분한다. `setSparseFactionStance` 는 (1) 값이 기본값과 같아지면 관계 항목을 아예 쓰지 않고 (2) 순서가 뒤집힌 중복 관계를 걷어 한 쌍으로 합친다 — N² 화면이 프로젝트 JSON 을 N² 데이터로 부풀리지 않게 막는 유일한 장치다. 안내문 `db-faction-hostility-notice` 는 외부 JSON 의 양방향 값이 다를 때 전투와 같이 더 적대적인 쪽이 이긴다는 사실을 적는다.
- **셀 색은 런타임 `stanceBarColor` 를 그대로 쓴다** — 의도적인 비토큰 값이다. 같은 관계가 편집기와 플레이 화면에서 다른 색으로 읽히면 안 되기 때문이고, 색만 신호로 두지 않고 숫자·라벨·바꿈 표식(`● 바꿈` / `○ 기본`)을 함께 둔다.
- **ID 변경은 참조를 함께 옮긴다.** `renameFaction` 이 관계의 양 끝, `EnemyRecord.factionId`, 모든 맵의 `FieldSpawnDef.factionId`, 그리고 `changeFactionStance` 명령의 두 피연산자(`visitProjectCommands` 로 맵 이벤트·페이지·커먼 이벤트·트룹 전투 페이지까지)를 다시 쓴다. 삭제(`deleteFaction`)는 같은 참조를 사람이 읽는 목록(`몬스터 '…'`, `맵 '…'의 필드 스폰 '…'`, 이벤트 위치)으로 만들어 막고, 예약 id 는 아예 거부한다. 복제는 정체성만 복사하고 관계는 물려주지 않는다 — 원본의 동맹·적을 조용히 상속하는 쪽이 더 위험하다.
- 세계관에서 구체화된 진영은 `FactionDef.worldEntityId` 에 출처(`WorldEntity.id`)를 들고 있어서, 이 탭에서 전투 ID 를 바꿔도 세계관 재반영이 같은 세력의 진영을 하나 더 만들지 않는다.
- **플레이어 처치 평판은 진영 속성이 아니라 프로젝트 전체 규칙**이라 별도 카드 `db-faction-reputation` 에 있다: 켜면 `factions.playerKillReputation { weight }`(기본 0.25, 음수는 0 으로 조인다), 끄면 키를 지운다(`setPlayerKillReputation`). 실제 적용은 런타임 `applyPlayerKillReputation` 이 세션 오버레이에만 쓴다.
- 구조 변경(추가·복제·삭제·ID·선공 성향·보호·평판)은 `recordProjectSnapshot`, 이름·색처럼 연속으로 들어오는 입력은 `recordCoalescedSnapshot` 이라 DB 모달의 dirty/undo 계약을 그대로 따른다. 필드·행렬·평판 쓰기는 `replaceFactions` 를 지나 `normalizeProjectFactions` 로 정규화되고, ID 변경·삭제는 모델이 만든 프로젝트를 `store.replace` 로 반영한다. 어느 경로든 남는 값이 없으면 `project.factions` 키 자체를 지운다.
- 커버리지: `test/databaseFactionModel.test.ts`(희소 쓰기, 역순 중복 제거, 비대칭 입력, ID 변경 시 명령·몬스터·스폰 재작성, 참조 있는 삭제 차단), `test/databaseFactionView.test.ts`(공용 빌더, 예약 진영 전투 결과, 관계 목록 직접 변경·기본값 복귀, 셀 순환과 바꿈 표식).

### 몬스터 폼의 소속 진영 (`databaseEnemyRecordView.ts`)

- 드롭다운(`db-picker-enemy-faction`)은 `enemy` 를 "진영 없음"이 아니라 **런타임 기본 진영**으로 보여 준다(`… · 기본값`). 기본값을 고르면 레코드에서 `factionId` 키를 지워 희소하게 유지하고, 힌트 `db-enemy-faction-default-clears` 가 그 동작을 적는다.
- 결과 카드 `db-enemy-faction-effective` 는 유효 진영·식별 색(`db-enemy-faction-color`)·출처(`레코드에 저장됨` / `미저장 · enemy로 전투`)와 플레이어 기준 태도를 함께 보여 준다. 저장값이 없는 진영을 가리키면 렌더가 조용히 고치지 않고 결손 항목을 선택된 채로 남기며, 경고 `db-enemy-faction-missing` 과 `저장값 지우기`(`db-enemy-faction-clear-missing`)로 명시적 복구만 제공한다.
- **실제로 서로 선공하는 관계는 미리보기 제한으로 접지 않는다.** 관계 목록은 `willAttackOnSight(stance, aggression)`를 양쪽 방향으로 평가해 이 몬스터 진영이 상대를 공격하거나 상대 진영이 이쪽을 공격하면 **전부** `db-enemy-faction-relationships-primary` 에 먼저 놓는다. 따라서 매우 공격적(2)의 중립 대상과 광폭(3) 진영도 숨지 않는다. 제한(`FACTION_RELATION_PREVIEW_LIMIT = 6`)은 양쪽 모두 선공하지 않는 관계에만 적용하고, 접히는 카드 `db-enemy-faction-relationships-more`의 제목도 `서로 선공하지 않는 관계 N개`로 판정 범위를 정확히 적는다.
- 예약 진영만 있는 프로젝트에는 `db-enemy-faction-guide` 안내와 `진영 탭 열기`(`db-enemy-open-factions`)가 붙고, 점프는 모달을 다시 열지 않고 `switchDatabaseActiveTab`(G006)을 쓴다.
- 커버리지: `test/databaseEnemyFactionPanel.test.ts`.

### 다 만들어 놓고 못 쓰던 이유 — `[편집]` 이 화면 밖 67px 에 있었다 (2026-08-29 실측)

위 편집기가 전부 동작하는데도 사용자는 "구조물을 수정할 수 없다"고 했다. 실제 브라우저로 재현해 재 보니 **버튼이 보이는 영역 밖에 있었다.**

- **원인은 `height: 100%` 와 `display: block` 의 조합이다.** `.structure-kit-album-workspace` 가 `height:100%` 인데 담는 그릇 `.db-body.db-shared-workspace`(`src/styles/database/sidebar.css`)는 `display` 를 지정하지 않는 block + `overflow:auto` 다. 그래서 앨범이 자기 앞에 있는 `h3`("구조물") + `p`(설명) **67px 을 없는 것처럼** 높이를 잡고 그만큼 아래로 삐져나갔다. 인스펙터 액션 줄은 `margin-top:auto` 로 그 바닥에 붙으므로 `[편집]` 이 정확히 67px 밖으로 밀렸다.
- **수치**: `[편집]` y=831 vs 클립 경계 y=829, `elementFromPoint` → `div.database-footer-status`. 1366×768 / 1440×900 / 1920×1080 **세 해상도 모두 삐짐 67px 로 동일** — 제목 두 줄 높이가 화면 크기와 무관해서다. 큰 모니터로도 안 보인다.
- **내장 행보다 내 구조물 행이 더 심하다.** 내장은 버튼 2개라 한 줄(38px)이고 내 구조물은 5개가 352px 폭에 안 들어가 글자가 두 줄로 접혀(53px) 15px 더 두꺼워진다. 아슬아슬하게 걸려 있던 것이 완전히 넘어간다. → **`flex-wrap: wrap` 으로 고치려 들면 악화된다.** 줄이 두 단이 되어 더 높아진다. 버튼 **개수를 줄이는 것**이 해법이다.
- **고침**: 담는 그릇을 세로 flex 로 만들고(`display:flex; flex-direction:column`), 앨범의 `height:100%` 를 **뺀다**. 세로 flex 안에서는 `flex:1` 이 남은 높이를 정확히 준다. `height:100%` 를 남기면 그릇 높이(= h3+p 포함)를 그대로 받아 잘림이 되살아난다. 실측: 삐짐 67→0, `[편집]` y 831→764, 좌표 직접 클릭으로 편집기 열림.
- **형제 탭은 이미 같은 처방을 갖고 있었다.** 타일셋 탭은 `tabs-a.part-2.css` / `desktop.css` 에서 `:has(.tileset-db-workspace)` 로 고쳐 뒀고 **구조물 탭만 빠져 있었다.** 새로 발명할 것이 없었다.
- **마커 클래스로 하면 안 된다.** `renderActiveTab` 이 body 를 `replaceChildren` 만 하므로 TS 에서 붙인 className·dataset 이 탭을 바꾼 뒤에도 남아 다른 탭으로 샌다. `:has()` 로 판정해야 한다. `sidebar.css` 쪽 선택자가 특이도는 높지만 `display` 를 건드리지 않아 충돌하지 않는다.
- **복제가 막다른 길이었다.** 내장 킷은 "편집하려면 [내 구조물로 복제]를 쓰세요"라고 안내하는데, 복제 핸들러가 사본을 만들고 목록만 다시 그려서 인스펙터가 계속 원본을 봤다. 선택을 사본으로 옮길 때는 **`session.selectedKitId` 만으로 부족하다** — `session.source`(`"builtin"` 이면 사용자 킷이 걸러진다)와 `session.searchQuery` 를 함께 맞춰야 한다. 안 그러면 선택 복구 로직이 `visibleEntries[0]` 으로 즉시 갈아탄다. `[+ 새 구조물]` 핸들러가 옳은 순서의 선례다.

### 구조물 어휘 — 역할·레이어·테마·증분 축·칸 힌트 (2026-08-30)

사용자는 "구조물의 역할·레이어·배치 규약·사용 테마를 수정할 수 있어야 하고, 새 구조물을 추가할 때
각 타일에 «세로로 증분 가능» 같은 설명을 넣을 수 있어야 한다"고 했다. 실측해 보니 여섯 축 중
세 개(설명·배치 규칙·분류)만 편집 가능했고, `tags` 는 **타입과 AI 초안 파서에는 있는데 폼이 없었다** —
사람이 손으로 넣을 방법이 아예 없는 필드였다. `layerHome`·`themes` 는 존재하지도 않았다.

- **`StructureKitAiMeta` 에 세 필드가 늘었다**: `growthAxis`(`horizontal|vertical|both`),
  `layerHome`(`lower|upper|perCell`), `themes: string[]`. 이름·값은 `TileGroupMetadata` 와 의도적으로
  같다(`patternGrammar.axis`, `layerHome`) — AI 가 이미 그 단어들을 읽고 있다.
- **`SectionStructureKitDef.cellHints`** 가 칸 단위 힌트다: `{dx, dy, growth?, note?}`.
  `parts` 와 합치지 않은 이유는 소비자가 다르기 때문이다 — 부위는 워프·간판 좌표를 만들고,
  칸 힌트는 시공 반복 축과 AI 설명으로 간다. 한 칸에 힌트는 하나(`dx,dy` 가 키)다.
- **`repeatability` 는 가로 전용이었다.** `repeat|fixed` 두 값으로는 「세로로만 쌓는 벽」을 적을 수 없고,
  `stamp_structure_kit` 도 가로 반복밖에 없었다. 판정은 `structureKitGrowthAxes()` 한 곳으로 모았고
  세 층이 이 순서로 이긴다: `ai.growthAxis` → `ai.repeatability` → `kind`.
  `structureKitRepeatable()` 은 그 결과의 `x` 를 돌려주는 얇은 껍데기로 남겼다(호출부 다수).
  **세로 증분은 사람이 명시할 때만 열린다** — 조용히 3층이 생기는 쪽이 1층보다 나쁘다.
- **`stamp_structure_kit` 에 `repeatY` 가 붙었다**(기본 1). 축이 허용하지 않는 방향은 1회로 조이고
  **조인 사실을 요약 문장과 `data.repeatClamped` 에 남긴다** — 말없이 조이면 모델은 쌓았다고 믿고
  다음 층을 그 위에 얹는다. 반복 격자는 `unitRects` 목록 하나로 만들어 배치 조건 검사와 실제 시공이
  **같은 목록**을 본다(둘이 갈라지면 검사를 통과한 좌표와 찍는 좌표가 달라진다).
- **AI 가 받는 것**: `contextBuilder` 의 구조물 줄에 증분 축·레이어가 붙고, 테마·태그·칸 힌트(앞 6개)가
  뒤따른다. 칸 힌트는 **자르지 않는다** — 「이 열은 세로로 증분 가능」이 잘리면 무한 확장 구조물을
  통째로 못 쓴다. `list_structure_kits` 는 `growth{x,y}`·`layerHome`·`cellHints` 를 그대로 싣는다.
- **파일 포맷은 v1 그대로**다. 새 필드는 전부 옵션이라 옛 편집기도 파일을 열 수 있다(버전을 올리면
  `version > STRUCTURE_KIT_FILE_VERSION` 검사가 옛 빌드에서 파일을 통째로 거부한다).
- **같은 파서에서 실측 결함 둘을 함께 고쳤다.**
  ① `readAiMeta` 가 `ai.placement` 를 **읽지 않았다** — 직렬화는 이미 쓰고 있었으므로
  내보내기→가져오기를 한 번 거치면 «필수» 배치 조건이 조용히 사라져 막혀 있던 자리에 찍혔다.
  ② `description`·`placementRules` 가 둘 다 비면 메타를 통째로 버렸다 — 축·테마만 적은 구조물이
  왕복에서 어휘를 전부 잃었다. 이제 한 필드라도 내용이 있으면 살린다.
- **편집기**: AI 메타 탭에 `structure-kit-editor-ai-growth`(증분 축) ·
  `-ai-layer`(레이어, 「미지정」 옆에 유도값을 적어 둔다) · `-ai-tags` · `-ai-themes` 가 늘었다.
  태그·테마는 쉼표로 나누는 한 줄 입력이다 — 칩으로 닫지 않은 이유는 값 어휘가 열린 집합이기 때문이다
  (실내 테마 7종은 방 채우기 전용 문법이고 야외 테마는 사람이 짓는다).
  도구 레일에는 `structure-kit-editor-tool-hint`(칸 힌트)가 붙었고, 칸을 누르면 부위 종류와 같은
  팝오버(`structure-kit-editor-hint-menu`)로 축을 고른다. `window` 가 없는 유닛 테스트 환경에서는
  팝오버 대신 **결정적 순환**(가로→세로→양방향→없음)이 돌아 같은 값 집합을 덮는다.
  칸별 설명은 목록(`structure-kit-editor-cell-hints`)의 입력칸에서 쓴다 — 팝오버에 텍스트 입력을
  넣으면 바깥클릭 닫기와 싸운다. 캔버스에는 격자선과 같은 겹침 층으로 배지를 얹는다
  (`renderTileCellsToCanvas` 가 타일셋 로드 후 비동기로 다시 그리므로 캔버스에 직접 그으면 지워진다).
- **크기 조절이 칸 힌트 손실도 보고한다**: `resizeKit` 의 `droppedHints`. 1×1 이라 클램프 여지가 없어
  부위와 따로 센다.
- 커버리지: `test/structureKitGrowth.test.ts`(축 3층 우선순위·레이어 유도),
  `test/structureKitRasterModel.test.ts`(칸 힌트 CRUD·축/메모 독립성·크기 조절 손실·굽기 보존),
  `test/structureKitFile.test.ts`(어휘 왕복·배치 조건 왕복·행렬 밖 힌트 폐기·자유 문장 없는 메타 생존),
  `test/structureKitTools.test.ts`(`growth`/`layerHome`/`cellHints` 응답, 축 제한 보고,
  경계 거부, 프롬프트 내용), `test/structureKitEditorDialog.test.ts`(새 폼 4칸·수락 반영·칸 힌트 순환),
  `test/structureKitPartKindMenu.test.ts`(칸 힌트 팝오버).

### 편집기를 맵 타일 편집기 수준으로 (2026-08-30 실측)

잘림을 고친 뒤에도 사용자는 "수정 UI UX 가 매우 불편하다, 모달보다 50%쯤 더 커야 하고 실제 타일 칠하는 편집기와 비슷해야 한다"고 했다. 크기만의 문제가 아니라 결함 셋이 겹쳐 있었다.

- **다이얼로그 배경이 투명했다.** `.db-enemy-dialog` 가 `var(--oprn-chrome)` / `var(--oprn-light)` 를 쓰는데 **그 토큰은 저장소 어디에도 정의돼 있지 않다.** `--oprn-*` 60개 중 23개가 그렇다. 대체값 없는 미정의 커스텀 프로퍼티는 계산값 시점에 **선언 자체를 무효로** 만들어 `background` 가 초기값 `transparent` 로 떨어진다 — 그래서 편집기를 열면 뒤의 DB 표가 그대로 뚫고 보였다. `--bg-overlay` / `--border-default`, 헤더는 `--accent` 그라디언트로 교체했다. **경고: 이 함정은 콘솔 에러도 남기지 않는다.** 남은 20개는 상태·배우·적 표 소관이라 별건으로 남겼다.
- **창이 내용 크기로 잡혀 있었다.** 실측 732×537 인데 허용된 자리는 1424×884 였다. `[data-testid="structure-kit-editor"] > .db-enemy-dialog` 에 `width: min(1424px, calc(100vw - 16px))` + 같은 꼴의 `height` 를 준다. DB 모달(z 900)과 편집기 백드롭(`--z-popover-high` 1200)이 별개 층이라 **DB 모달 크기 불변식 e2e 를 건드리지 않고** 독립적으로 커질 수 있다.
- **`pointermove` 리스너가 없어서** 한 칸 칠할 때마다 따로 클릭해야 했다. pointer capture + `buttons & 1` 가드로 드래그 스트로크를 붙였다. 이미 그 타일이면 no-op 이라 중복 store 쓰기와 리렌더가 사라진다.

"맵 편집기를 그대로 가져다 쓰면 되지 않나" 의 답은 **절반만**이다. 맵 쪽은 Phaser 씬(`EditScene`)이고 구조물 쪽은 DOM `<canvas>` 라 칠하기 엔진·격자·줌은 다시 만들어야 한다. 재사용한 것은 순수 함수와 아이콘뿐이다.

- **`makeTileToolbar` 는 쓰지 않는다.** `installToolbarBadgeRefresh` 가 `latestToolbarRerender` 모듈 전역을 덮어써서 맵 도구막대가 같이 흔들린다. 아이콘 팩토리 `makeSvgIcon`(`tileToolbarIcons.ts`)만 가져왔다. `buildSvgIcon` 은 `viewBox` 만 주고 width/height 를 붙이지 않으니 **쓰는 쪽 CSS 가 크기를 정해야 한다** — 보기 줄을 빼먹었더니 되돌리기 버튼이 내용 없는 빈 알약으로 보였다.
- **팔레트 격자도 자체 구현이다.** `makeGridPalette` 는 순수해서 쓸 수는 있지만 ① 칸 크기가 컨테이너 쿼리(`--chipset-cell: 100cqi`)에 묶여 임의 다이얼로그에 옮겨 담을 수 없고 ② 오토타일을 대표 1칸으로 접고 레이어로 걸러 480칸 중 일부가 사라진다. 편집기는 480칸 전부를 보여야 한다.
- **검색·분류는 `tilePaletteFilter.ts` 로 뽑아 공유한다.** 원래 `tilePalette.ts` 의 비공개 함수였고 `activeTileCategory`·`tileSearchQuery`·`recentTiles` **모듈 전역**을 직접 읽었다 — 그대로 부르면 맵 팔레트 필터가 편집기와 함께 움직인다. 그래서 상태는 호출부가 들고 파일은 순수 계산만 한다. 규칙을 복사하지 않은 이유는 이 저장소에 이미 타일 칠하기 구현이 셋(Phaser 맵 / 구조물 / `tilesetAiTerrainExample.ts`)이라 넷째 사본이 생기면 정본이 사라진다.
- **되돌리기는 킷 단위 스택(80단)**이고 `recordProjectSnapshot` 을 쓰지 않는다. 그쪽은 스트로크마다 프로젝트 전체를 `structuredClone` 하고, DB 모달 취소가 `truncateMapEditHistoryFromMarker` 로 그 이력을 통째로 지운다. 단축키는 문서 레벨 capture 리스너이고 `!overlay.isConnected` 일 때 스스로 떼어진다 — 백드롭 클릭과 Esc 는 우리 닫기 콜백을 지나지 않는다.
- **격자선은 DOM 오버레이다.** `renderTileCellsToCanvas` 는 캔버스를 즉시 돌려주고 타일셋 이미지가 로드되면 **비동기로 다시 그린다** — 캔버스에 직접 그은 선은 그때 지워진다.
- **`fitScale` 은 높이도 본다.** 옛 `canvasScale` 은 폭만 봐서 3×64 같은 긴 킷이 세로로 터졌다. 배율은 1..8 로 조인다.
- **`place-content: center` 는 `safe` 를 붙여야 한다.** 캔버스가 칸보다 크면 위/왼쪽으로 넘친 부분이 **스크롤로 닿지 않는다.** 3×40 킷을 최소 배율 1x 로 봐도 세로가 남는데, 실측으로 `scrollHeight` 가 300 → 200 으로 줄고 첫 줄이 칸 위 99px 지점에 박혀 영구히 가려졌다. `safe center` 는 잘림이 생길 때만 시작 정렬로 물러난다.
- **빈 칸은 배경 타일로 메우지 않는다.** 인스펙터 썸네일과 달리 편집기에서는 "비어 있음" 과 "풀을 칠했음" 이 구별돼야 한다. 설계의 "인스펙터와 통일" 항목을 의도적으로 어긴 곳이다.
- 레이어 이름은 하층/상층 → **바닥/덧그림**, 덧그림일 때 스테이지에 점선 테두리. testid(`structure-kit-editor-layer-lower/upper`)는 그대로다.
- 새 testid: `-tool-rect/-ellipse/-fill/-pick`, `-undo`, `-redo`, `-zoom-in/-out/-fit/-value`, `-grid-toggle`, `-search`, `-category-<id>`. 기존 `-tile-<n>` · `-tool-paint/erase/part` · `-layer-*` 는 유지해 테스트 변경이 없다.
- 실측(1440×900): 창 1424×884 · 배경 불투명 · 창밖 삐짐 0 · 캔버스 720×640(5x) · 팔레트 300×596/480칸 · 드래그 한 번에 6칸 · 검색 "문" 9칸 · 분류 "집" 75칸 · 팔레트 스크롤 300 유지. 1366×768 / 1280×720 에서도 도구·분류칩·보기 줄이 한 줄에 들어간다.

## 스킬 탭 `연출` 카드 = 살아 있는 애니메이션 스테이지 (2026-08-30)

- 스킬을 고르면 `연출` 카드가 시트 첫 칸을 자른 정지 이미지 1장이 아니라 **자동 반복 재생 스테이지**다. `renderSkillAnimationStage`(`src/editor/panels/databaseSkillAnimationStage.ts`)가 `db-skill-animation-preview` 안에 인셋 스테이지 웰 `db-skill-animation-stage`(픽셀 그리드 + 중심 십자선), 셀 레이어 `db-skill-animation-cells`(`data-frame-index`), 프레임 카운터 `db-skill-animation-frame-counter`(`3 / 12`), 시트 메타 칩 `db-skill-animation-sheet-meta`(`96×96 · 5열 · 15fps`), 재생/정지 토글 `db-skill-animation-toggle`(`aria-pressed`)을 렌더한다. 기존 `db-skill-animation-preview` testid 와 `.db-skill-animation-preview-frame` 클래스는 그대로 유지된다.
- 프레임 전진의 정본은 `src/editor/panels/eventEditor/showAnimationPlayback.ts` **하나**다. `playShowAnimation(stage, layer, source, { loop, onFrame, onStop })` 이 15fps(`SHOW_ANIMATION_FRAME_MS = 1000/15`)·시트 좌표·크로마키 규약을 소유하고 이벤트 편집기 표시면과 스킬 스테이지가 그걸 공유한다. `playShowAnimationOnce` 는 그 위의 얇은 래퍼다.
- **스킬·이벤트 표시면에 새 `setInterval` 재생 루프를 만들면 결함이다.** 애니메이션 탭의 수동 1회 재생(`databaseAnimationPreview.ts`)은 그보다 먼저 있던 별개 화면이고, 재생기를 여기서 더 늘리지 않는다.
- 타이머 수명은 하드룰이다. `renderPreviewPanel` 은 표시면을 `replaceChildren` 하기 **전에** 이전 핸들의 `stop()` 을 부르고, `renderSkillRecordForm` 은 폼 단위 `WeakMap`(`activeAnimationStages`)으로 레코드 폼이 교체될 때 이전 스테이지를 죽인다. 픽커 변경도 `bindAnimationPreviewRefresh` → `renderPreviewPanel` 로 같은 경로를 탄다.
- 왜 이렇게 엄한가: 분리된 DOM 에 인터벌이 살아남는 것은 이미 한 번 출하된 실측 결함이다(커밋 `2ed96476`, 미부착 유예가 무한이어서 버려진 표시면에 프레임을 계속 그렸다. 2틱 상한으로 고쳤다). `test/e2e/zz-qa-dbmodal-attacks.spec.ts:168` 은 모달을 10회 열고 닫은 뒤 stray timer 0 을 단정한다.
- 정지 상태도 1급이다. `animationId` 가 없으면 기존 `(애니메이션 없음)` 빈 상태를 유지하고, 프레임이 1장이면 첫 프레임 정지 렌더 + 토글 `disabled`, `prefers-reduced-motion: reduce`(또는 `window.setInterval` 이 없는 헤드리스 호스트)면 자동재생하지 않고 첫 프레임에 서서 토글로만 재생한다.
- 스타일은 `src/styles/database/skill-item-visuals.css` 안에서만 늘린다. 색은 `.database-modal-backdrop` 아래 `--db-studio-*` 토큰만 쓰고(하드코딩 hex/rgba 금지), **새 CSS 파일을 만들지 않는다**(`scripts/check-css-budget.mjs` 파일 수 래칫).
- 커버리지: `test/databaseSkillAnimationStage.test.ts`(자동 반복 + 카운터 추적, 1프레임 정지, reduced-motion 정지, 토글 왕복, 표시면 교체 후 분리된 스테이지의 인터벌 정리), `test/databaseSkillItemForms.test.ts`(스테이지·셀·시트 메타·토글 계약), `test/eventEditorShowAnimationPreview.test.ts`(loop 랩어라운드와 `onFrame` 이 기존 1회 재생을 깨지 않음).

## 데이터베이스 30탭 UI/UX 계약 (2026-08-30 실측)

계측은 `scripts/qa/db-ux-probe.mjs` 로 한다(사용법은 `openwiki/testing.md`). 아래 모든 수치는
**레포지토리에 들어 있는 단 두 파일**로 재계산된다:

- `verify-shots/db-ux/before/probe.json` — 29탭, expert, 1680x1050
- `verify-shots/db-ux/after/probe.json` — 30탭, expert, 1680x1050

`/tmp` 에만 있는 순회 결과를 이 문서의 근거로 쓰지 마라. 재현할 수 없는 수치는 없는 수치다.
(네 뷰포트 관찰은 아래 "줄상자 바닥" 절에 따로 적는다.)

`before` 에는 `tilesets` · `factions` 가 **없다**(29탭). 그 두 탭이 `0 -> 107.5px` 로 보이면
회귀가 아니라 계수 누락이다. `residents` 는 before 에서
`tab button not found: db-tab-residents` 로 에러난 상태다.

### 헤더는 설명문이 아니라 아이콘 칩 한 줄이다

집계는 `탭수 × 합계px` 이고, 괄호는 탭 하나당 평균이다.

**함정: 한 탭이 같은 선택자를 두 번 달 수 있다.** before 의 `characters` 는 `.db-life-panel` 을
둘(171.2 + 142.2) 가지고 있다. slug 를 키로 하는 map 으로 재계산하면 중복이 조용히 덮여
n=3 / 484.6 이 나온다 — 리스트로 모아서 세라. 이 표의 `.db-life-panel` 이 한 번 218.6 으로
잘못 적힌 것도(4개 합을 3으로 나눔) 같은 함정이다.

| 선택자 | 이전 | 이후 |
|---|---|---|
| `.db-life-header` (생활) | 3× 645.6 (215.2) | 3× 150.0 (50.0) |
| `.db-life-panel` | 4× 655.8 (164.0) | 3× 150.0 (50.0) |
| `.db-battle-studio-heading` (전투) | 4× 388.4 (97.1) | 4× 151.2 (37.8) |
| `.db-overview-hero` | 1× 118.5 | 1× 78.4 |
| `.db-record-intro` | 4× 144.0 (36.0) | 1× 34.2 |
| `.db-tab-note` (구조물) | — (아래 주석) | 1× 42.1 |
| **`.db-ws-hero`** | **17× 1828.4 (85.1~151.1)** | **18× 1799.4 — 압축 안 함** |
| 헤더 합계 (전체 탭) | 3882.7 | 2517.8 |
| 헤더 합계 탭간 편차 | 677.5 | 193.7 |

작업영역 높이(`workspaceH`)는 before/after 모두 **모든 탭에서 796px, 편차 0** 이다.
진단 문서의 "흔들림 275px" 는 이 하네스의 지표로는 재현되지 않는다 — 실제로 움직이는 것은
위 표의 **헤더 합계 편차(677.5 -> 193.7)** 다. 이 둘을 헷갈리지 마라.

`.db-life-panel` 은 **4개 → 3개**로 개수 자체가 줄었다. before 의 `characters` 탭이 이 헤더를
둘(171.2 + 142.2) 달고 있었고 지금은 탭당 하나다. "3 → 3" 이 아니라 "4 → 3" 이라 평균만 보면
이야기를 놓친다.

`.db-ws-hero` 의 이후 분포는 **넓어졌다** — 37.0~156.7px. 합계는 29px 줄었지만 그 안에서 세 탭이
오히려 커졌다(`equipment` 151.1→156.7, `items` 103.1→105.5, `farm-spatial` 85.1→85.6). 줄상자
바닥 1.35 가 기존 배너를 조금씩 키운 결과다. 이 선택자를 손대는 다음 사람은 "전부 줄었다" 고
가정하지 마라.

`.db-tab-note` 주석: 커밋된 before 에는 이 컨테이너가 없다. 당시 구조물 탭은 맨 `h3` + `p` 였고
프로브 선택자 목록에 안 걸렸다. `fbd2d9fb` 가 같은 내용을 `.db-tab-note` 로 감싸자 75.7px 로
잡혔고(그 커밋 메시지는 "아이콘 바로 압축" 이라고 적었지만 설명문은 그대로 있었다), `c9ae257d` 가
문단을 칩으로 바꿔 42.1px 가 됐다.

#### `.db-ws-hero` 는 일부러 압축하지 않았다

이게 **살아남은 가장 큰 헤더 덩어리**다. 17탭 1828.4px 로, 이번에 압축한
`.db-life-header`(645.6) + `.db-life-panel`(655.8) + `.db-battle-studio-heading`(388.4) = 1689.8 을
**합친 것보다 통째로 크다.** 그런데도 안 건드렸고, 이유는 이것이다:

`databaseWorkspace.ts` 의 `detailHero` 는 설명문이 아니라 **레코드 신원 헤더**다 —
`.db-ws-hero-media`(56px 썸네일/캔버스) · `-title` · `-tags` · `-actions`(툴바). "내가 무엇을
편집하는지 · 어떻게 생겼는지 · 무엇을 할 수 있는지" 를 지는 기능 요소라서, 다른 탭에 쓴 변환
(문단을 지우고 사실 하나를 칩으로)의 대상이 아니다. 유일한 설명문은 선택적인
`.db-ws-hero-sub` 뿐이다.

샴탕하게 짜려면 **`.db-ws-hero-sub` 만**, 그것도 부제목이 탭 이름을 되뇌는 탭에서만 떼라.
썸네일 레이아웃과 툴바는 건드리지 마라 — 그건 자기 커밋과 자기 before/after 가 필요한 별건이다.

설명 문단을 지우고 같은 정보를 아이콘 + 수치 칩으로 옮긴다. 개요 탭은 제목 옆 5개 칩(세계·이야기·
등장인물·시스템·시작 지점)과 9개 수치 칩이 표준이다.

#### 헤더 압축의 재사용 패턴 — `.db-tab-note` + `.db-tab-note-chip`

한 줄로 줄일 헤더가 또 나오면 **새 패턴을 발명하지 말고 이것을 쓴다.** 여섯 번째 방식이 생기는 것을
막으려고 여기에 적는다.

- `.db-tab-note` 는 원래 `.db-record-intro` 와 공용인 "인트로 / 노트 띠" 스타일이다
  (`desktop-record-shell/10-tab-chrome-unify.css` 의 `Shared intro / note strip`). 이 브랜치가
  만든 클래스가 아니라 브랜치 이전부터 있었다.
- 그 안에 `.db-tab-note-chip` 이 있을 때만 제목과 칩을 한 줄에 놓는다. 게이트는
  `.db-tab-note:has(.db-tab-note-chip)` 이다 — 칩이 없는 기존 사용처의 모양은 건드리지 않는다.
- 칩 내용은 `makeDatabaseTabIcon(<탭 id>)` + `<span>` 라벨. 저작 예시는
  `src/editor/panels/structureKitDbTab.ts` (구조물 탭).
- 칩의 글자 크기는 정확히 **11.5px** 이다(`10-tab-chrome-unify.css` 의 `font: 600 11.5px/1.35`).
  `studio-theme.css` 의 런타임 바닥 `max(11.5px, 1em)` 과 같은 값이다. 프로브 문턱(11)과 혼동하지
  마라 — 문턱은 기준선과 맞춘 계측 값이고, 이 11.5 는 새로 쓰는 칩이 따를 값이다.

긴 문장을 칩의 `title` 에만 넣는 것은 **보조 정보일 때만** 허용된다. `title` 은 hover 전용이라
키보드·터치로 닿지 않고 스크린리더 announce 도 일관되지 않는다. 그 문장이 없으면 기능을 오해할
수준이면 칩을 `<button type="button">` + popover 로 만들거나 `aria-describedby` 로 시각적
숨김 텍스트를 붙여라.

### 숫자 입력은 스테퍼를 먼저 붙이고 그다음 스피너를 지운다

순서가 계약이다. `appearance: none` 으로 브라우저 스피너를 먼저 없애면 마우스로 값을 조절할 방법이
사라진다. `databaseControls.ts` 가 스테퍼 버튼을 붙인 뒤에 스피너를 지운다.
실측(커밋된 before/after probe.json): `numberUnskinned` **120** → 0, `rangeUnskinned` 6 → 0,
`detailsMarker` 3 → 0, `checkUnskinned` 0 → 0.

이미지 쪽도 같은 쌍에서 나온다: `imgZero` 9 → 0, `bgZero` 7 → 0, `imgBroken` 0 → 0.
0px 이미지는 **깨진 것과 조상이 접힌 것**을 반드시 갈라 봐야 한다 — 함정은 `openwiki/testing.md`.

**`selectUnskinned` 는 이미 0 이었다.** "네이티브 select 141개가 OS 껍데기를 노출한다" 는 진단은
런타임에서 반증됐다 — 기존 CSS 가 이미 `appearance:none` 을 먹이고 있었다. 커스텀 select 위젯을
새로 만들 근거가 없으므로 만들지 않았다. 같은 실수를 반복하지 말고 먼저 재라.

### 줄상자 바닥은 1.35 다 (1.25 는 큰 한글 제목에서 깎인다)

`studio-theme.css` 가 `:has(.db-shared-workspace)` 안의 텍스트 요소에 줄상자 바닥을 먹인다.
값은 **1.35** 이고, 1.25 로는 모자란다는 것이 실측으로 나왔다:

- 개요 h2 는 `font: 800 clamp(24px, 3vw, 34px)`. **1024px 럭에서 3vw = 30.72px** 로 풀린다.
- 1.25 면 줄상자 38.4px. 800 굵기 한글 받침 잉크는 40.4px → 자기 `overflow` 로 2px 깎임.
- 이전 주석은 "1.25 fits every viewport step" 이라고 단정했지만 **큰 럭에서만 확인한 것**이었다.
- 1.35 x 30.72 = 41.5px > 40.4px. 통과.

10px span 부터 30px 제목까지 **한 종류의 고정 바닥을 공유**하는 구조다. 그래서 바닥은 가장 큰
글자가 안 깎이는 값으로 정해야 한다. `clamp()`/`vw` 를 쓰는 제목은 **가장 좁은 지원 럭(1024px)에서**
재라 — 넓은 럭에서만 보면 반드시 놓친다.

작은 글자 바닥은 같은 파일의 `font-size: max(11.5px, 1em)` 이 런타임에서 처리한다
(`tinyFont` **366** → 0).

**문턱은 11px 이고, 그게 뭘 증명하는지 정확히 알아야 한다.** 프로브의 `TINY_FLOOR` 는 11 이다.
진단 기준선이 "11px 미만" 을 셌고 before 도 그 자로 366 을 기록했으니 비교 가능성을 지키려면 같은
자를 써야 한다. 실측: 문턱을 11.5 로 올리면 726건이 새로 걸리는데 **전부 정확히 11px** 이고 11px
미만은 0건이다. 즉 `tinyFont 0` 은 "11px 미만 글자가 없다" 는 뜻이고, "모든 글자가 11.5px 이상"
이라는 뜻이 **아니다.** 소스의 `9px`/`11px` 선언을 일괄 치환하는 방식은 70개 파일을 흔들면서
관측되는 이득이 없어 쓰지 않았다 — 런타임 바닥이 이미 같은 일을 한다.

**가상 요소도 재야 한다(`tinyPseudo`).** `::before`/`::after` 의 `content` 는 자식 텍스트 노드가
아니라서 `ownText` 검사에 절대 걸리지 않는데 화면에는 글자가 그려진다. 안 재면 `tinyFont 0` 이
"작은 글자가 없다" 가 아니라 "안 봤다" 가 된다. 이 계수기를 붙이자마자 모달 전역에서 유일한 11px
미만 렌더링 텍스트가 드러났다 — `sidebar.css` 의 `.db-tab-group::after` 셰브론(`▾`) 10px,
30탭 × 6개 = **180건**. 11px 로 올려 `tinyPseudo` 0 이 됐다. 장식 글리프도 예외로 두지 않는다.

근거는 커밋돼 있다: `verify-shots/db-ux/pseudo-baseline/probe.json` 은 셰브론만 10px 로 되돌린
상태의 30탭 순회이고 `totals.tinyPseudo` 가 **180**, 전량이
`div.db-tab-group::after@10px "▾"` 이며 탭마다 정확히 6개다. 같은 파일의 `tinyFont` 0 ·
`selfClipped` 0 은 `after/probe.json` 과 같아서, 이 쌍의 유일한 차이가 셰브론임을 보여준다.
`before/probe.json` 에는 `tinyPseudo` 키가 **아예 없다** — 계수기가 그 순회보다 나중에 생겼다.
그래서 이 지표의 before 는 위 baseline 파일이고, before/after 쌍이 아니다.
소스의 `9px`/`11px` 선언을 일괄 치환하는 방식은 70개 파일을 흔들면서 관측되는 이득이 없어 쓰지 않았다.

**`lowLineHeight` 480 → 25 이고, 남은 25건은 의도적이다.** `system-studio.css` 의 `font: .../1 !important`
단축 지정을 받는 고정 높이 버튼들(비율 1.0)이다. 중요도 없는 longhand 는 중요도 있는 shorthand 를
특이도로 못 이긴다. 이들은 실제로 글자가 깎이지 않고(`selfClipped` 0) 제목 계열도 아니다. 여기에
`!important` 를 되살리면 CSS 예산 래칫이 986 → 987 로 올라간다 — 관측되는 이득 없이 게이트만 잃는다.

### 이미지 실패는 빈 상자가 아니라 라벨 붙은 자리표시자다

실패한 썸네일이 크기 0 으로 사라지면 사용자는 "아무것도 없다" 로 읽는다. `databaseRecordThumbnails.ts`
가 실패 시 32x32 자리표시자를 그리고 `회복약 썸네일 이미지 불러오기 실패` 같은 aria-label 을 붙인다.
`scripts/qa/db-placeholder-proof.mjs` 가 살아 있는 썸네일 8개를 실제로 깨뜨려 자리표시자 8개가
보이고 크기 0 이 하나도 없음을 증명한다. 커버리지: `test/databaseImageFailurePlaceholder.test.ts`.

---

## '마을' 탭 — 마을 하네스 값을 사람이 저작한다 (2026-08-30)

마을 생성의 값은 전부 코드 상수였다. 집 형태 34종은 `HOUSE_TEMPLATES` 의 `wingsAt()` 함수였고, 길 폭·광장 모양·마당 스타일은 씨앗값과 테마 문자열에서 파생됐다. 사용자가 바꿀 자리가 없었고, AI 도 코드 요약만 읽었으므로 "내가 정한 대로 깔아 줘" 가 성립하지 않았다. 이 탭이 그 입력단이다.

- **레일 위치**: 세계 그룹, 타일셋 폴더(`공간 종류`)와 `지형 효과` 사이. `id: "villages"`, `data-testid="db-tab-villages"`. 배지 숫자는 사용자 레코드 수(`villageTemplates.length + villagePresets.length`)이며 **내장 34종은 세지 않는다**.
- **두 종류를 한 탭에서 저작한다.** 목록 창 칩(`db-village-kind-template` / `db-village-kind-preset`)이 축이고, 오른쪽 상세는 고른 종류를 편집한다. 저장 위치는 `project.villageTemplates` / `project.villagePresets` — 프로젝트에 있으면 **전부 사용자 저작**이다(내장 카탈로그는 코드에 남고 레코드가 되지 않는다).
- **제로 부트스트랩**: 탭을 열기만 해서는 아무 레코드도 생기지 않는다. 두 배열은 그대로 `undefined` 다.
- **화면의 선택지와 하네스가 받는 값은 같은 상수에서 나온다.** select 옵션은 `village/authoringData.ts` 의 `VILLAGE_PATH_STYLES` · `VILLAGE_PLAZA_LAYOUTS` · `VILLAGE_RANGE` 등을 그대로 쓴다. 예전에 화면과 하네스가 갈라졌던 항목(`roadWidth` 2~3, `roadNaturalness` 하한 0.35)이 여기 있다 — 갈라지면 사용자가 고른 값이 조용히 무시된다.
- **집 형태**: 폭 3~8 · 높이 4~24 바운딩 박스 + 날개(직사각형, 최소 3×3) 목록. 날개 하한은 내장 34종에서 뽑았다 — 「현관 오두막」의 뒷채와 「ㄷ자」의 두 다리가 3×3 이라, 하한을 3×4 로 조이면 내장을 복제해 온 직후 화면만 "규약 위반" 이라고 말한다(하네스는 잘 짓는다). `test/villageAuthoringData.test.ts` 의 34종 왕복이 이 어긋남을 막는다. 날개 합집합이 집 바닥이므로 숫자만으로는 L 자인지 ㄷ 자인지 알 수 없어 `db-village-footprint-large` 격자 미리보기를 함께 그린다. `박스 맞추기`(`db-village-wing-tighten`)는 빈 줄·열을 없애고, `내장 형태에서 값 가져오기`(`db-village-import-apply`)는 값을 **베껴** 온다(`clonedFrom` 만 계보로 남고, 이후 내장이 바뀌어도 사본은 그대로다).
- **규약 위반은 막지 않고 보여준다.** `templateFromRecord()` 가 거절한 레코드는 목록 행에 `규약 위반`, 상세에 `db-village-template-warning` 으로 뜨고, 시공에서는 그 형태만 건너뛴다(경고 1줄, 시공 실패 아님).
- **배치 프리셋은 모든 값이 「지정 안 함」에서 시작한다.** 고른 값만 키로 남고(`undefined` 는 키째 지운다), 비운 값은 코드 기본값/씨앗값이 담당한다. `쓸 집 형태 고르기` 는 카탈로그 전체(내장+사용자)를 체크박스로 내주고 고른 id 만 `templateIds` 로 저장한다 — 하나도 안 고르면 전체를 쓴다.
- **참조는 따라간다.** 집 형태를 지우면 프리셋 화이트리스트에서도 빠지고, id 를 바꾸면 프리셋이 새 id 를 가리킨다. 죽은 id 를 남기면 시공 때 경고가 되기 때문이다.
- **사슬**: 이 레코드가 `village/authoringData.ts` → `buildVillageDomain` 의 `VillageIntent.templateCatalog` 로 들어가고, 동시에 `ai/contextBuilder.ts` 의 `## 마을 저작 데이터` 섹션에 실려 모델이 `author_village({ presetId })` / `housePlans[].templateId` 로 지목할 수 있게 된다. 우선순위는 **명시 인자 > 사용자 프리셋 > 테마 추론 > 씨앗값 파생**.
- **기하 규약은 시공기에서 베껴 온다.** `templateFromRecord()` 는 폭·높이·바운딩 박스만 보는 게 아니라 `stampFootprintHouseKit` 이 요구하는 것까지 본다 — **열마다** 이어진 칸이 `벽 밴드 + 지붕 2` 행 이상이어야 하고(1층 5행, 2층 7행, 낮은 벽 4행), A자 지붕 킷은 날개 하나에 높이가 `벽 밴드 + ⌊(폭−1)/2⌋ + 1` 로 고정이다. 이걸 안 보면 화면은 「통과」라고 하는데 하네스는 "집을 한 채도 시공하지 못했다" 로 실패한다(8×8 에 위 4행만 폭 8 인 ㅜ 자로 실측). `+ 날개 추가` 의 기본 높이도 `minWingRun()` 을 써서 누른 직후 위반이 되지 않게 한다.
- 커버리지: `test/databaseVillageView.test.ts`(33케이스 — 규약 통과·내장 복제·날개 편집·짧은 열 위반·프리셋 키 생성/삭제·참조 정리·그림·격자), `test/villageAuthoringData.test.ts`(17케이스 — 읽기·AI 컨텍스트·시공 반영·내장 34종 왕복·열 높이·A자 지붕), `test/houseTemplateCatalog.test.ts`(내장 34종 데이터화 등가성).

### 붓을 고르면 화면이 흔들렸다 — 재부모가 스크롤·포커스를 지운다 (2026-08-30 실측)

사용자: "팔레트에서 클릭해서 그리는 형식인데 이게 자꾸 state 때문에 흔들리는 것 같다."
맞았다. 관찰기 `scripts/observe-structure-ux.mjs`(포트를 주면 워크트리 dev 서버에 붙는다,
결과는 `verify-shots/structure-ux-*/OBS.json` + PNG)로 재니 숫자가 그대로 나왔다.

- **고치기 전 실측(1440×900, 12×10 킷)**: 팔레트를 400px 내려 타일을 하나 고르면 `scrollTop`
  **400 → 0**, 두 번째로 고를 때 **250 → 0**. 검색창에 글자를 치다 타일을 고르면
  `document.activeElement` 가 `search` → **BODY**. 즉 이웃 타일을 연달아 집는 리듬이 불가능하고,
  매번 다시 스크롤해서 같은 자리를 눈으로 찾아야 했다.
- **원인은 `redraw()` 가 `rightWrap.replaceChildren(tabsWrap, toolsWrap, filterWrap, paletteWrap)` 로
  같은 노드를 다시 붙인 것**이다. 자식 목록이 똑같아도 `replaceChildren` 은 노드를 떼었다 다시
  붙이며, **재부모는 스크롤 컨테이너의 `scrollTop` 을 0 으로 되돌리고 포커스를 body 로 떨어뜨린다.**
  게다가 `drawPalette` 가 480칸을 매번 재생성했다 — 자기 안에서 `scrollTop` 을 복원해도 그 뒤에
  오는 재부모가 다시 지웠다(복원 코드가 있는데도 증상이 남은 이유).
- **고침: 오른쪽 열은 열 때 한 번만 조립한다.** `createPalette` / `createFilterBar` / `createTools` /
  `createTabs` 가 노드를 만들어 두고 `refresh()` 는 **클래스·속성만** 바꾼다. 탭 전환도
  `replaceChildren` 이 아니라 `hidden` 토글이다. 실측: 400 → **400**, 250 → **250**, 검색 중
  타일을 골라도 검색어가 남고 포커스는 누른 그 칸에 있다.
- **팔레트 refresh 는 지문(signature)으로 자기 자신을 아낀다.** 칠하기 드래그는 칸마다
  `redrawCanvasOnly()` 를 부르고 거기서 팔레트 표식도 갱신하는데, 붓·필터·사용 타일 집합을 이어
  붙인 문자열이 그대로면 즉시 빠져나온다. 그래서 480칸 DOM 쓰기는 실제로 바뀐 프레임에만 일어난다.
- **격자를 켜도 아무것도 보이지 않았다.** `kitRender.ts` 는 캔버스를 `#101318` 로 칠하는데
  격자선 색이 `var(--border-strong)`(= `rgba(15,23,42,.461)`, 거의 검정)이었다. 검정 위의 검정이라
  12×10 빈 킷 스크린샷이 **완전한 검정 한 장**이었다 — 칸 경계도, 킷이 어디서 끝나는지도 알 수 없었다.
  선을 `rgb(255 255 255 / 0.18)` 로, 스테이지 테두리를 `rgb(255 255 255 / 0.32)` 로 바꿨다.
  **이 둘은 의도적 비토큰 값**이다: 아래에 깔린 색이 테마 토큰이 아니라 캔버스에 직접 칠한 고정색이다.
- **이미 쓴 타일을 팔레트에서 구별한다.** `collectUsedTiles(kit)`(두 레이어 모두 본다)가 정본이고
  AI 초안 프롬프트의 타일 범례도 같은 함수를 쓴다. 표식은 `.is-used` → 오른쪽 위 점 + `title` 에
  "· 이 구조물에 사용 중", 필터 줄에 `사용 중 N칸`(`structure-kit-editor-used-count`).
  검색에 안 걸린 사용 타일은 `opacity .22` 로 점까지 사라지므로 `.is-filtered-out.is-used` 만
  `.55` 로 둔다 — "쓴 타일 표시"가 검색 흐림보다 우선이다.
- **[안 쓴 타일만] 은 체크박스**(`structure-kit-editor-unused-only`)다. 분류칩에 섞으면 "집" 같은
  분류와 배타가 되는데 실제 저작은 둘을 겹쳐 쓴다. 켜면 쓰인 칸을 `hidden` 으로 **숨긴다** —
  "칸 위치가 시트 좌표라 숨기지 않는다"는 이 팔레트의 기본 규약을 사람이 명시적으로 켠 이 필터에서만
  어긴다. 단 **지금 잡은 붓은 숨기지 않는다**(아니면 켜는 순간 쓰는 붓이 화면에서 사라진다).
- 커버리지: `test/structureKitEditorDialog.test.ts`(`collectUsedTiles`, 타일을 골라도 팔레트·검색창
  노드가 같은 인스턴스로 남는다, 사용 표식·개수, `[안 쓴 타일만]` 숨김과 붓 면제, 칠하면 표식이 붙는다),
  브라우저 왕복은 `test/e2e/db-structure-editor.spec.ts` 의 스크롤·포커스 유지 케이스와 사용 표식 케이스.
  스크롤은 FakeDom 이 흉내내지 않으므로 유닛에서는 **노드 정체성**으로 대신 못을 박는다.

---

## '마을' 탭 — 숫자칸을 그림으로 바꾼다 (2026-08-31)

기능은 사슬 끝까지 이어져 있었지만 화면이 스프레드시트였다. 1301줄에 `<canvas>` · `<img>` 가 **0개**였다. 8×9 ㄱ자 집을 만들려면 `x/y/w/h` 숫자 8개를 손으로 넣고, 미리보기는 칸 채움/빈칸을 나타내는 `<span>` 격자라 실제 집이 어떻게 생기는지 알 수 없었다. 내장 34종 고르기는 `직사각 대 (8×7) · rect-large` 텍스트 `<select>` 였다. 저장 계약(`villageTemplates` / `villagePresets`)과 기하 규약은 그대로 두고 **입력 방식만** 바꿨다.

- **그림은 진짜 시공기를 돈다.** `villageHousePreview.ts` 는 레코드를 `w+2 × h+2` 잔디 스크래치 맵에 `stampFootprintHouseKit()` 으로 찍고 `drawMapTileLayers()` 로 굽는다 — 시공과 썸네일이 쓰는 **그 함수들**이다. 화면이 자기 나름의 그림을 상상해 그리면 결과와 어긋나고, 어긋난 미리보기는 없는 것보다 나쁘다.
- **재료를 못 구하면 그림인 척하지 않는다.** 킷 타일 번호(406·467·374…)는 합본 마을 칩셋(`tex_easyrpg_chipset_combined_town`)의 번호 체계에 종속이다. 그 칩셋에 묶인 타일셋이 프로젝트에 없으면 `housePreviewMap()` 이 `undefined` 를 내고 화면은 기존 추상 격자로 내려앉는다.
- **그림 세 층은 비용이 달라 방식이 다르다.** ①집 형태 = 실시간 캔버스(스탬프 1회, 내용 시그니처로 캐시). ②마을 원형 6갈래 = **구운 PNG**(`scripts/bake-village-archetype-previews.mts` → `public/assets/village-preview/<id>.png`) — 도로 탐색까지 도는 무거운 시공이라 브라우저에서 6판을 돌리지 않는다. ③내 프리셋 = 버튼을 눌러야 도는 실시간 시공(`villagePresetPreview.ts` 가 `structuredClone` 초안에서 `buildVillageDomain` 을 돌린다 — 실제 프로젝트에는 맵이 생기지 않는다). 값 하나 고칠 때마다 자동으로 돌리면 select 한 번에 화면이 멈춘다.
- **구운 PNG 는 쓰기 옵션이 크기를 10배 가른다.** pngjs 기본값(`deflateStrategy: 3` = Z_RLE, 필터 자동)으로 288×288 한 장이 141KB 였다. `{ deflateLevel: 9, deflateStrategy: 0, filterType: 0 }` 이면 같은 픽셀이 14KB 다(6장 840KB → 90KB). 화면에 뜨는 카드 자산이라 크기가 그대로 첫 로딩 시간이 된다.
- **모양 팔레트 + 격자 드래그.** `db-village-shape-palette` 10장(네모·2층·ㄱ·ㄴ·ㄷ·ㅁ 중정·T 현관·필지+헛간·A자·낮은 헛간)이 대표 내장 정의의 날개를 베끼고 타일 그림을 함께 그린다. `db-village-footprint-large` 격자는 날개마다 절대 배치 사각형 + 변 손잡이 8개를 얹은 조작면이다. 클램프는 순수 함수 `moveWing()` / `resizeWing()`(`databaseVillageModel.ts`)이 전부 끝낸다 — 드래그로는 애초에 규약을 어길 수 없게 만드는 편이 어긴 뒤 안내문을 띄우는 것보다 낫다. 드래그 중에는 store 를 건드리지 않고(한 칸마다 커밋하면 되돌리기 스택이 수십 개로 불고 rerender 가 조작 중인 노드를 떼어낸다) 포인터를 놓을 때 한 번 커밋한다. 키보드로도 만들 수 있다 — 날개 상자가 탭 정지점이고 화살표=이동, Shift+화살표=오른쪽·아래 변 크기.
- **격자에는 `.db-village-footprint-large` 클래스를 붙이지 않는다.** 예전 격자 규칙이 `gap: 2px; padding: 8px` 을 넣는데 드래그가 `clientWidth / 열 수` 로 칸 크기를 재므로 여백이 끼면 좌표가 어긋난다. testid 는 그 상자를 가리켜야 하므로 testid 만 격자에 남기고 클래스는 `.db-village-grid` 하나만 쓴다.
- **숫자칸은 없애지 않고 접는다.** `db-village-wing-${i}-${axis}` · `db-village-wing-add` · `db-village-wing-tighten` 는 「숫자로 고치기」(`db-village-wing-numbers`) 안에 그대로 산다 — 정확한 값을 박아야 할 때가 있고, 격자 드래그는 「대충 이 모양」까지만 빠르다. 접기는 `<details>` 가 아니라 `div` + 토글 버튼 + `hidden` 이다(Chromium `::details-content` 가 flex 스크롤 자식을 무력화한다). 닫혀 있어도 자식은 DOM 에 남는다.
- **첫 화면은 예시부터.** 레코드가 하나도 없으면 상세 창이 시작 화면(`db-village-start-hero`)이 된다 — 위는 원형 6장(구운 PNG), 아래는 모양 팔레트 10장(실시간 캔버스). 기존 빈 상태(`db-village-template-blank` / `db-village-preset-blank`)를 **대체하지 않고 감싼다**.
- **캔버스는 유닛 테스트로 못 본다.** `test/fakeDom.ts` 의 `getContext()` 가 의도적으로 `null` 을 준다. 그래서 유닛은 **스탬프된 GameMap 의 타일 배열**까지만 단정하고(지붕 몸통·처마·벽 9분할 하단행이 실제로 들어갔는지, 옥상 패스가 `upperTiles` 만 건드리는지), 픽셀은 e2e 가 `getImageData()` 로 색 수를 세어 단색 폴백과 가른다.
- 커버리지: `test/villageHousePreview.test.ts`(13 — 칩셋 찾기·킷 해석·잔디 여백·실제 타일·규약 위반 시 `undefined`·내장 34종 전부 렌더), `test/villageWingGeometry.test.ts`(13 — `moveWing`/`resizeWing` 클램프), `test/villagePresetPreview.test.ts`(6 — 시공 결과·프로젝트 무오염·씨앗 차이·원형 6갈래), `test/villageArchetypePreviews.test.ts`(3 — PNG 존재·시그니처·남는 그림 없음 드리프트 게이트), `test/e2e/db-village-visual.spec.ts`(4 — 원형 PNG 서빙·히어로 픽셀·손잡이 드래그 커밋·프리셋 미리보기).
- **함정(e2e)**: 상세 창은 스크롤한다. 기본 위치에서 격자는 뷰포트 **아래 1500px** 지점이고 `boundingBox()` 는 스크롤을 해 주지 않으므로, 드래그 전에 격자를 화면 안으로 끌어오지 않으면 `page.mouse` 가 뷰포트 밖을 짚고 손잡이는 `pointerdown` 을 아예 받지 못한다(값이 안 바뀌어 "드래그가 고장났다" 로 오독하게 된다).

### AI로 몬스터·아이템 생성 (2026-08-30)

아이템/적 탭 툴바에 `AI로 생성`(`db-ai-generate-open`) 이 있다. 모달
(`databaseAiGenerateDialog.ts`, testid `db-ai-generate-dialog-<kind>`)에 설명을 넣으면
**레코드 + 그림**이 한 번에 등록된다. 오케스트레이션은 `src/editor/aiDatabaseGeneration.ts`:

1. `chatCompletion` 으로 레코드 JSON 을 받는다. 응답은 `parseGeneratedRecord` 가
   **필드 allowlist**(item 9개 / enemy 6개)로 걸러낸다 — `upsert_item`/`upsert_enemy` 의
   `rejectUnknownFields` 가 모르는 필드에 하드 실패하므로, 모델을 믿지 않고 미리 자른다.
2. 그림은 `generateAiImage` (아래 이미지 경로) → `flattenGeneratedArtwork` 로 배경을 투명화.
3. 적용은 **기존 툴만** 쓴다: `upsert_resource` → `upsert_item`/`upsert_enemy` 를
   `applyToolSequenceToStore` 로 한 undo 체크포인트에 묶는다. 새 쓰기 경로를 만들지 마라.

리소스 kind 는 종류마다 다르다 — 적은 `monster`, 아이템은 `picture`. 아이템 아이콘 피커
(`kind:"icon"`)가 업로드 자산 중 `picture`/`monster`/`system` 만 목록에 올리기 때문이다
(`databaseResourcePickerDialog.ts` `uploadedMatchesKind`). 그림은 `assets.uploaded[id].dataUrl`
로 들어가고 `resolveAssetResourceUrl` 이 업로드를 먼저 보므로 썸네일·전투 화면이 그대로 집는다.

Tests: `test/aiDatabaseGeneration.test.ts`, `test/generatedArtworkAlpha.test.ts`,
`test/imageGenerationClient.test.ts`.

### AI 어시스턴트 바 — 진행·결과가 바 안에 보인다 (2026-09-03)

헤더 `AI 어시스턴트`(`database-ai-toggle`) 가 여는 바는 `src/editor/panels/databaseAiBar.ts` 가 소유한다
(`databaseModal.ts` 는 `createDatabaseAiBar` 를 부르고 `element`/`toggle` 을 놓기만 한다).

- **왜 다시 만들었나(실측):** 예전 바는 `sendAiAssistantMessage` 를 fire-and-forget 으로 던지고 토스트
  「채팅 패널에서 제안을 확인하세요」만 남겼다. DB 창은 모달이라 채팅 패널이 **뒤에 가려지고**, AI 가
  `tune_enemy` 로 몬스터 HP 를 64→300 으로 바꿔도 화면에는 흔적이 없었다.
- **같은 채팅 세션을 쓴다.** 별도 LLM 파이프라인이 아니다. 진행은 `aiAssistantBridge` 의 읽기 API
  (`getAiAssistantStatus` · `getAiAssistantAudit` · `abortAiAssistantTurn`)를 400ms 폴링해 그 턴의 감사
  항목만(`startIndex` 이후) 그린다: 요청 원문 → 상태줄(`data-phase` thinking/working/done/error) →
  바꾼 것(쓰기 툴 요약, 실패는 「실패 —」 접두어) → 답변(마크다운 강조 제거) → 행동(중단·되돌리기·채팅에서
  이어가기·지우기). 읽기 툴(`find_tools`·조회)은 「바꾼 것」에서 뺀다 — 브리지 감사 항목이 `mode`/`ok` 를
  실어 준다(`aiChatPanel.ts collectAudit`).
- **되돌리기는 `undoMapEdit`** 이고 라벨에 되돌릴 항목 이름을 적는다(승인 게이트가 없으므로 복구 경로가
  이것이다 — `approvalPolicy.ts`).
- 바에 「실패 — 'upsert_enemy' 커밋 거부(무결성 오류)」가 찍히던 원인은 모델의 자리표시 id(`skill_0001`)였고,
  지금은 `upsert_enemy` 가 사유를 돌려주고 요약이 첫 위반을 싣는다(`openwiki/editor-ai-tools.md` 2026-09-03).
- **컨텍스트 풋터는 그대로다:** `[컨텍스트] 에디터 전체 요청 · 현재 화면: 데이터베이스 DB 탭 <라벨>,
  선택 레코드: <이름>(<id>)` (`databaseAiContextFooter`). buildSpec 정규식과 도구 노출 키워드가 이 형식을
  읽는다. `window.__oprnDbAiLastRequest` 훅도 유지.
- **제안 칩은 탭·선택 레코드로 만든다**(`databaseAiSuggestions`): 레코드 탭이면 「선택 레코드 다듬기」·
  「비슷한 것 하나 더」, 그룹별 밸런스 문장 하나(파티=성장 곡선, 몬스터=난이도, 시스템=스위치·변수…),
  「이 탭 점검」. 개요처럼 레코드가 없으면 「다음 할 일」. 범용 맵·이벤트 문장은 없다.
- **레이아웃:** `ai-bar.css`(index.css 에서 studio-v2 **뒤**에 읽는다 — light-theme 의 옛 오버라이드는 삭제).
  창(`@container db-modal`) 폭 1100px 이상에서 턴이 보이면 두 열(왼쪽 입력·제안, 오른쪽 턴,
  `grid-template-rows: auto 1fr`), 그 아래는 한 열. 턴 상자는 `min(30vh, 260px)`, 창 높이 820px 이하면
  150px. 행이 있는 목록은 `min-height: 0`(studio-v2) — 예전 220px 최소 높이 때문에 바가 열린 1024×900
  에서 목록이 1fr 행을 넘쳐 발 단추가 행 위에 올라탔다.
- **입력에서 Escape 는 바만 접는다**(stopPropagation) — 문서 층 모달 스택이 받으면 DB 창이 닫혔다.
- Tests: `test/databaseAiBar.test.ts`(happy-dom: 제안·풋터·턴 요약·DOM 계약·폴링·되돌리기·Escape),
  `test/databaseModalAiConnection.test.ts`(모달 통합), e2e `test/e2e/qa-db-ai-dock.spec.ts`.
  증거: `.omo/evidence/ai-surfaces-ux/{before,after}/`(`scripts/capture-ai-surfaces.mjs`).

### AI로 몬스터·아이템 생성 — 대화상자 재작성 (2026-09-03)

`databaseAiGenerateDialog.ts` 는 더 이상 `db-enemy-dialog` 껍데기를 빌리지 않는다(Win98 식 파란 헤더·
MS PGothic·420px 창이 30탭 스튜디오 안에서 유일하게 다른 시대였다). 자체 클래스 `db-ai-generate-*`
(`ai-bar.css` — 파일 수 래칫 때문에 같은 시트)로 흰 면·12px 라운딩·14px 읽는 글자.

- **단계가 보인다:** `aiDatabaseGeneration.ts` 의 `deps.onPhase("text"|"artwork"|"apply")` 를 상태줄
  `data-phase` 로 노출. 그림 76초 동안 「그리는 중… 30초 이상」이 읽힌다.
- **완료 카드**(`db-ai-generate-result`): 이름·id·핵심 수치(몬스터 HP/공격/방어/민첩/경험치/골드, 아이템
  가격/종류/사용/HP 회복 — `recordFacts`) + 그림. 주 단추는 「하나 더 만들기」로 바뀐다(설명을 비우고
  같은 대화상자에서 이어 만든다).
- 예시 칩 3개(입력만 채움), 실행 중엔 입력·옵션·예시 잠금 + 닫기가 「취소」(AbortSignal), 바깥 클릭은
  실행 중 무시, 닫으면 「AI로 생성」 단추로 포커스 복귀. 상태 접두어 「완료」/「실패」 와 testid 는
  `scripts/capture-ai-db-generate.mts` 가 읽으므로 유지. 테스트 주입: `deps.generate`/`loadConfig`/`readRecord`.
- Tests: `test/databaseAiGenerateDialog.test.ts`, `test/databaseAiGenerateLazyImport.test.ts`(동적 import 유지).

## Database Studio v2 — 30탭 셸·폼 문법 통일 (2026-09-03)

`src/styles/database/studio-v2.css` 한 층이 30탭이 이미 발행하는 클래스(`.db-field` · `fieldset/legend` ·
`.db-ws-*` · `.oprn-record-*` · `.db-list-row` …)에 같은 규칙을 걸어 세대 차이를 접는다. index.css 에서
`database/modern/*` 뒤(가장 늦게) 읽히고, `!important` · hex · 글꼴 스택 리터럴이 없다
(`test/databaseStudioV2.test.ts`). 앞선 층의 `!important` 는 그 층(`studio-theme.css` · `sidebar.css`)에서
**값만** 고쳤다 — 예산 래칫(important 988 · hex 1677 · 파일 266)은 main 과 같거나 낮다.
`form-hierarchy-modern.css` 는 여기로 흡수해 삭제했다(파일 수 +1 −1).

**셸.** 헤더는 `데이터베이스 | 그룹 › 탭`(`database-modal-crumb`). 활성 탭은 `database.ts` 의
`subscribeDatabaseActiveTab` 으로 따라간다 — 레일 클릭·G006 점프·Ctrl+T 가 전부 `setDatabaseActiveTab`
한 곳을 지나므로 DOM 이벤트가 필요 없고 fake DOM 에서도 돈다. 창 컨트롤은 `⇥ □ x` 글리프가 아니라
SVG(`database-modal-icon`, `tileToolbarIcons` 규격). 푸터 상태는 전폭 초록 띠가 아니라 점 하나 붙은
28px 필(`databaseFooterStatusText` 는 체크 글리프 없이 "자동 저장됨"). 「도움말」은 `tertiary` 클래스.
레일 그룹 헤더 12px/600, 부제 11px(10px 은 모달 안 유일한 11px 미달 글자였다 — `databaseGroupPeek` 갱신).

**워크스페이스.** 회색 바탕 위 테두리 카드 세 겹 → 창 전체가 흰 면, 레일 | 목록 | 상세는 세로 헤어라인.
묶음 카드는 `--db-studio-canvas` 회색 면에 테두리 없음, 제목 13/600 + 힌트 12 text-3. 카드 속 입력은 다시
흰 면. 구형 목록 창은 `databaseRecordViews.ts` 가 제목+개수를 `.db-ws-list-head` 로 묶어 `listPane()` 과
같은 모양이 된다(`oprn-record-count` 는 그대로, `db-ws-count` 를 함께 단다). 툴바는 한 줄, 뷰 토글은 우측
세그먼트.

**폼 문법.** `.db-field` = 라벨(좌, `minmax(min(96px, 38%), max-content)`) | 값(우). 라벨은 **말줄임 금지**
— 어절로 줄바꿈. `modern/enemies.css:144` · `actors.css:971` 의 ellipsis 를 소스에서 걷었다. 좁은 수치
격자(`.db-enemy-stat-grid` · `.db-enemy-reward-grid` · `.db-item-grid` · `.db-state-runtime-panel`)만 라벨
위. 입력 크롬 한 종류(32px · 8px · `--db-studio-border-default` · 포커스 액센트 링). `select` 는 chevron
밴드 때문에 `padding` 단축을 쓰지 않는다(`databaseSelectChevronGuard`). 스테퍼는 `28px | 1fr | 28px`
한 상자 — **격자가 아니라 flex** 다. 좁은 칸(≤120px)에서 `modern-controls.css` 의 `@container` 가 단추를
접는데, 격자면 접힌 단추의 빈 28px 두 칸이 남아 입력이 0 폭이 됐다(지형 「다른 프리셋 빠른 편집」 실측:
52px 스테퍼에 단추가 남고 입력이 + 밑으로 들어갔다). **`@container` 는 특이성을 올려주지 않는다** — v2 의
`display:inline-flex`(0,4,0) 가 modern-controls 의 접기 규칙(0,3,0) 을 이겨 버리므로, v2 가 같은 깊이로
접기 규칙을 다시 적는다(`test/databaseStudioV2.test.ts` 가 선택자 깊이를 고정). 라벨-위 격자 목록에
`.db-terrain-quick-row` 도 들어간다. 히어로(`.db-ws-hero` · `.db-record-hero` · 아이템/장비 인스펙터 헤더)는
52px 매체 + 18/700 제목 + 11.5 한글 아이브로우 + 알약, 히어로 안 이름 입력은 제목처럼(테두리는 hover/focus
에만).

**상태 탭은 격자를 바꿨다.** 8열/16열 고정 영역 격자가 한 행 높이를 가장 낮은 카드에 맞춰 139px 로 눌러
「기본 설정」 다섯 필드 중 셋이 카드 안 스크롤 뒤에 숨어 있었다. 이제 `repeat(auto-fit, minmax(300px,1fr))`
카드 흐름이고 `grid-area` 는 `> *` 로 전부 auto. **함정(CDP 실측):** 폼이 flex column 이라 워크벤치에
`flex: 0 0 auto` 가 없으면 flex-shrink 가 워크벤치를 폼 높이로 눌러 auto 행이 전부 같은 높이(120px)로
배분되고 카드 내용이 밖으로 새어 겹친다. 규칙은 다 맞는데 겹치면 먼저 이걸 의심하라.
같은 함정의 두 번째 얼굴: `.db-ws-detail-body` 도 세로 flex 열이라 `overflow:hidden` 을 가진 자식(요약 띠
`.db-ws-stats`)은 자동 최소 높이가 0 이 되어 본문이 넘칠 때 **2px 로 짜부라진다**(지형 요약 띠, 전투 배경·
발소리·탈것 셀이 통째로 사라졌다). v2 는 `.db-ws-detail-body > * { flex-shrink: 0 }` 으로 막고, 남는 세로를
받아야 하는 타일셋 그림판만 `modern/tilesets.css` 가 더 높은 특이도로 `flex:1` 을 다시 연다.

**목록 행의 보조 칩.** 이름은 `flex:1 1 auto; min-width:0` 이고 칩은 `flex:0 0 auto` 였으니 좁으면 이름이
먼저 잘렸다(「킹슬…」). 칩에 min-width 를 주고 이름에 5em 바닥을 깔아 보면 짧은 이름이 26px 을 헛되이
차지해 이번엔 칩이 잘렸다(주민 「연결만 있음 · 이벤…」). 답은 자르지 않는 것: 칩이 있는 행만
`flex-wrap: wrap; justify-content: flex-end` 로 두고 한 줄에 못 들어가면 칩이 둘째 줄 오른쪽으로 내려간다
(타일셋 목록이 먼저 쓰던 방식). `04-modern-records` 의 번호 칸 `min-width: 48px` 도 「#5」에 28px 을
낭비해 줄바꿈을 앞당기던 원인이라 v2 가 0 으로 푼다. `listRow` 는 칩에 `title` 을 단다.

**영문 잔재 한글화.** `ELEMENT/TERRAIN/BATTLE SCREEN/BATTLE COMMANDS/WEATHER/SEASON/CROP/SWITCH/VARIABLE/
BATTLE/SHOP/INN/COMMON/RESIDENT/FARM/SPECIES/COMMON EVENT/GAME OVERVIEW` 아이브로우와 `LIVE PREVIEW/GAUGE/
TURN/BATTLE MENU` 칩. 전투 애니메이션 타이밍 표 헤더 `사운드...` 는 리터럴 텍스트였다 → `사운드`.

**계측.** `scripts/audit-db-conformance.mjs` 에 `textClip` 술어(말줄임된 텍스트 · overflow:hidden 조상 밖으로
나간 텍스트/컨트롤; 스크롤 컨테이너 안은 제외)를 추가했다. 기준선(main, 1680×1050): textClip 2건(몬스터
「이동 간격(ms)」 · 종족 목록 「킹슬라임」). `clipped` 술어는 1×1 로 숨긴 sr-only 라벨을 건너뛴다(v2 가
이름 입력을 제목으로 쓰면서 라벨을 이렇게 숨기자 actors/items/states/animations 가 전부 clipped:1 로 잡혔다
— 화면 독자용이지 잘라먹는 상자가 아니다). `detailDead`(상세 창 빈 면적 55% 초과) 는 흰 면 + 카드 흐름에서
몇 탭이 문턱을 넘나든다(troops 53→57 · life-collections 46→60 등) — 필드가 적은 폼의 여백이라 위반이
아니라 밀도 축의 관찰값으로 읽는다. 증거는 `docs/2026-09-03-db-studio-v2-assets/`.

