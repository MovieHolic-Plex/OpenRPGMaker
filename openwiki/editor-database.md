> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

## 아이템·장비 카탈로그의 입력과 가상 스크롤 (2026-10-04)

`databaseInventoryCatalog.ts`는 이름·종류/장착 부위·종류 표시·유효 아이콘/이미지 ID·실제 이미지 URL의
값 투영이 바뀔 때만 목록을 갱신한다. 설명 등 상세 전용 입력은 목록을 건드리지 않는다. 기존 레코드 객체는
편집마다 복제되므로 객체 정체성만으로 변경 여부를 판정하지 않는다. 바뀐 표시값은 이미 붙은 행을 갱신한다.

목록은 기존 `createVirtualList`로 화면 주변만 만든다. 검색·개수·필터·선택은 전체 레코드 목록을 기준으로
계산하며 화면 밖으로 나간 선택은 유지한다. 약한 행 캐시는 붙어 있는 DOM의 투영만 보관한다.
선택 항목 노출·생성·복제 후 이동은 `scrollToIndex`를 사용한다. 원래 검색/상세 입력과 스크롤러는 유지한다.
행에서 Home/End·방향키·PageUp/Down·Tab은 필요한 창을 만들고 포커스를 옮기며 Enter/Space는 기존 버튼 선택이다.

카탈로그 CSS는 바깥 스크롤러를 block, 안쪽 행 호스트를 grid로 둔다. 목록 높이 36px와 내부 gap 1px,
갤러리 두 열·높이 140px와 gap 8px를 실측해 스페이서·창·노출의 공통 피치로 사용한다.
긴 갤러리 이름은 두 줄까지 표시하고 전체 이름은 기존 title로 남긴다. 탭 이동/상세 입력은 포커스를 빼앗지 않는다.
네이티브 입력·이름·종류·필터·보기 전환·맨 끝 스크롤·키보드 선택 근거는
`verify-shots/editor-ux-improvements-20261004/README.md`와 `scripts/qa/editor-ux-forms-audit.mjs`를 본다.

## 자료집 전투 정리 — 전투 방식 두 가지·전투 화면 탭·안 쓰는 칸 삭제 (2026-10-02)

사용자 결정: 전투는 도트 측면(RM2003식)이 주축, 포켓몬식만 예외. 자료집에서 그에 안 맞는 칸을 걷어냈다. **저장값은 하나도 지우지 않는다** — 화면에서만 뺐다.

- **전투 화면 탭**(`databaseBattleScreenTab.ts`, 옛 `databaseUtilityRecordViews.ts` `renderBattleScreenTab` 대체): 카드 셋.
  - 「전투 방식」(`db-battle-method-card`): `db-battle-method-side` 도트 측면 / `db-battle-method-monster` 몬스터 대치. 방식 하나가 화면(`system.battleUiStyle`)과 규칙(`system.battleModel`)을 같이 정한다 — `src/project/battleMethod.ts` `applyBattleMethod`(측면 = 두 키 삭제 → retro2003 + RM 규칙, 몬스터 = `pokemon` + `gen1`). 조수 `set_project_settings battle.uiStyle` 도 같은 함수를 탄다(`projectTools.ts`, 허용 값은 `listActiveBattleSkinIds()` = retro2003·pokemon).
  - 창 색만 다르던 옛 측면 스킨 여섯은 #1895 에서 지웠다(저장값은 retro2003 으로 풀리고 창 색은 `battleLook.window` 로 옮겨짐 — [runtime-battle.md](runtime-battle.md)). 화면·규칙이 어긋난 옛 저장(예: retro2003 + gen1)은 `db-battle-method-rules-mismatch` 안내가 뜬다. 조수 `configure_game_systems battleModel` 도 `applyBattleMethod` 를 타서 규칙만 따로 바꾸지 못한다.
  - 「타격감」(`db-battle-hit-feel-card`, `db-field-system-battle-hit-feel`)과 「전투 화면 꾸미기」(`db-battle-look-card`, `battleLookFields`)는 시스템 탭에서 옮겨 왔다. CSS 스코프도 `.db-system-form` → `.db-battle-screen-studio`(`system-studio.css`).
  - 지운 것: 적 그림을 사선으로 늘어놓던 가짜 무대 미리보기·적 그룹 띠·「시스템 › 시작 설정 열기」 링크(`db-battle-screen-*`), 「전투 시스템 리소스」(`db-field-battle-system-resource` — 런타임은 아무도 읽지 않는 CSS 변수 `--runtime-battle-system2` 만 썼다).
- **시스템 › 시작 설정**: 전투 UI 스타일(`db-field-system-battle-ui-style`)·규칙 모델(`db-field-system-battle-model`) 칸 삭제. 전투 흐름·참전 수는 여기 한 곳에만 남는다(전투 화면 탭에 겹쳐 있던 사본 삭제). 「전투 화면 탭으로」 이동 버튼은 `switchToBattleScreenTab`.
- **적·종족**: 투명(`db-field-enemy-transparent`)·비행(`-flying`)·색조(`db-monster-species-hue`, 적 그래픽 대화의 색조)·몬스터 리소스 ID 글칸(`db-field-enemy-monster-resource`)·적 미리보기 일시정지(`db-enemy-preview-pause`) 삭제. 런타임은 `transparent`/`flying`/`graphicHue` 를 읽지 않는다(authoringOnly 공시도 같이 지웠다 — 아래 잔여 정리). 그림은 「그래픽 바꾸기」 대화로만 고른다. 종족과의 「그래픽이 종족과 다름」 표시는 그림(`monsterResourceId`)만 비교한다 — 지운 칸 차이로 고칠 데 없는 경고가 뜨지 않게. 조수 `upsert` 스키마(`dbTools.ts`)와 `set_project_settings resources`(`battleSystemResourceId`)에서도 이 칸들을 뺐다(저장·변경 함수는 옛 데이터 호환으로 남김).
- **아이템**: 옛 장비 프로필·사용 메시지 UI 는 이미 없었고 남은 죽은 코드만 지웠다(`databaseItemRecordView.ts`).
- **전투 애니메이션**: 레일 칸 `db-tab-animations` 삭제 → 도트 연출(`retroChoreographies`)의 하위 보기 「옛 전투 애니메이션 (대체용)」(`PARTY_SUBVIEW_PARENT.animations`, 하위 내비 `db-subview-retro-choreographies`·`db-subview-animations`). 도트 측면 전투는 스킬에 도트 연출이 있으면 셀 애니메이션을 그리지 않으므로(`battleDom.ts`) 연출 없는 스킬의 대체용·몬스터 대치 전용이다. 탭 검색 「전투 애니메이션」「animations」는 도트 연출에 걸린다(`LEGACY_TAB_SEARCH`). 전투 스튜디오 내비의 애니메이션 칸도 도트 연출로 바뀌었다.
- **소재 고르기**: 은퇴한 전투 배경은 고르기 목록에서 숨긴다(`resourceOptions.ts`). 이미 고른 값은 그대로 보인다.
- 남긴 것: 런타임의 `battleSystemResourceId` 처리 코드(옛 저장 호환). 파티 정면 스프라이트 `bskin-party-*` 는 2026-10-03 `deprecated/` 로 옮겼다(폴백은 도트 배틀러 — [runtime-battle.md](runtime-battle.md) 「옛 전투 그림은 deprecated/」).
- **소재 고르기(2026-10-03)**: 은퇴 스킨 배경 전부(rm2003·pokemon 포함)·옛 숲 레퍼런스·AI 고치·씨앗·슬라임 미리보기·EasyRPG Hornet 을 고르기 목록(`resourceOptions.ts` `RETIRED_PICKER_IDS`)과 몬스터·조수 목록(`monsterResourceCatalog.ts` `RETIRED_MONSTER_IDS`)에서 뺐다. 배경 목록에 슬라임이 끼던 `troop-preview` 판정도 지웠다.
- 잔여 정리: 「전투 스킨」「전투 UI 스타일」 문구를 「전투 방식」으로(전투 꾸미기·명령 CSS 「기본 모양으로」·조수 도구 설명, en/ja/zh 카탈로그 포함). 조수 활동 카드·리소스 고르기 창의 적 색조(`allowHue` 슬라이더·`hue-rotate`)와 `--enemy-pixel-hue` 필터, `databaseFieldSupport.ts` 의 투명·비행·색조 공시, 적 대기 스트립·재생 단추·`.flying` CSS, 몬스터 AI 생성의 그림 단계(그림은 아이템 아이콘만)를 지웠다. `battleSystemResourceId` 는 더 이상 리소스 삭제를 막지 않고 삭제 때 비운다(`resourceManager.ts` — 남기면 참조 검증이 프로젝트를 못 연다). 장르 프리셋 monster-collect 는 `applyBattleMethod(project, "monster")` 를 탄다. 리소스 관리자 「시스템 2」 분류는 남겼다 — 이벤트 「시스템 그림 바꾸기」가 system2 를 고르므로.
- 시험(실행 안 함): `test/battleSystemDeprecation.test.ts`·`databaseBattleStudio.test.ts`·`battleLook.test.ts`·`battleSkinRegistry.test.ts`. 화면 증거 `verify-shots/db-battle-cleanup/{before,after}/`(`capture.mjs`).

## 전투 배경은 종류로 고른다 — 도트 측면 (2026-10-03)

사용자 결정 「(가) 배경 종류로」. 도트 측면(retro2003)은 배경 그림을 그대로 깔지 않고 `resolveSceneryBiome`(`src/assets/battleSceneryCatalog.ts`)이 겹 배경 다섯 종류(풀밭·숲·동굴·설원·사막) 중 하나로 풀어 네 장 겹 배경을 깐다. 이스턴 RPG 기본 배경·옛 스킨 배경은 이름 규칙으로 **전부 풀밭**이 되어, 그림 목록에서 무엇을 골라도 풀밭이었다.

- `src/editor/panels/battleSceneryPicker.ts` `battleSceneryField`: 자동 + 종류 다섯 카드(`<testid>-auto`·`-plains`…, role radio). 저장값은 `battle-scenery-<종류>`, 자동은 키 삭제. 옛 그림이면 「…은 「풀밭」으로 보입니다」(`-legacy`, 기본 숲 레퍼런스는 안내 생략), 업로드 그림(종류로 안 풀리는 id)은 그대로 깔린다(`-custom`).
- 「직접 그림」: 기존 그림 고르기를 그 아래 둔다(업로드·AI 생성용). 종류·옛 그림일 때는 빈 칸으로 보인다(`customPickerResourceId`) — 입력칸 testid(`db-field-troop-backdrop`·`db-field-terrain-backdrop-N`)와 fill 계약은 그대로.
- 쓰는 곳: 적 그룹 설정 카드(`db-troop-scenery-*`, 「배경 변경」은 종류를 차례로 넘김 `nextBattleScenery`), 지형 효과 「전투 · 표시」(`db-terrain-scenery-N-*`). 몬스터 대치(pokemon)는 그림을 그대로 쓰므로 예전 그림 고르기가 그대로 나온다.
- 「배경 움직임」(스크롤·물결·색 순환)은 그림 한 장을 움직이는 효과라 몬스터 대치에서만 보인다 — 측면에서는 칸을 숨긴다.
- 미리보기·목록 썸네일은 `battleBackdropPreviewUrl` 로 실제 전투에 보이는 그림(종류의 `preview.png`)을 쓴다. `battle-scenery-*` id 의 단일 그림도 땅 겹 → 합친 미리보기(`BATTLE_SCENERY_CATALOG[].preview`)로 바꿨고 웹 내보내기에 다섯 장을 싣는다.
- 조수: 적 그룹·지형·맵 전투 배경 칸 설명이 `BATTLE_BACKDROP_ID_HINT`(종류 id 쓰라)를 공유한다. 천공의 계단 층 배경도 종류 id 로 바꿨다(층 일곱 → 종류 넷).
- 소재 고르기에서 지운 측면 스킨 다섯(ff·chrono·octopath·bravely·goldensun) 배경도 숨긴다(`RETIRED_PICKER_IDS`, rm2003 은 retro2003 기본 배경이라 남김).
- 시험(실행 안 함): `test/battleSceneryPicker.test.ts`, `mgL5bvisBackdropMotion.test.ts`, `skyStairGame.test.ts`, e2e `qa-troops`·`sky-stair-multi-enemy-battle`. 증거 `verify-shots/battle-scenery-picker/{before,after}/`.

## 레트로 전투 기믹 편집 칸 (2026-09-30)

retro2003 전투 기믹이 JSON 에만 있던 것을 화면에서 고칠 수 있게 했다. 증거·캡처 목록은 `verify-shots/retro-editable/SHOTS.md`.

- **스킬** (`databaseCombatRuleFields.ts` `skillAreaAndComboFields`, 전투 규칙 카드 안): 범위(`skill-area-shape`: 없음|원|직선) · 반경(`skill-area-radius`, 1~640) · 연계 배우 1~3(`skill-combo-actor-1..3`). 저장은 `updateDatabaseRecord("skills", id, { area, comboActorIds })` (`updateSkillRecord` 화이트리스트). `normalizeSkillRecord` 가 `comboActorIds` 를 **2명 미만이면 지운다** — 한 명만 고르면 저장값이 비고 패널이 재렌더돼 선택이 사라지므로 `pendingComboSlots`(레코드 id 별 임시 슬롯)가 재렌더를 넘어 선택을 들고 있다가 2명이 되면 저장하고 비운다. `databaseSkillRecordView.ts` 는 `area`/`comboActorIds` 만 있는 스킬도 전투 규칙 카드를 연다.
- **상태** (`databaseStateRecordView.ts` `retroGimmickControls`, `state.runtimeEffects` 부분 병합): 게이지 정지(`db-state-rt-freezes-gauge`) · 버서크(`db-state-rt-forced-attack`, `forcedAction:"attackRandom"`) · 물리/마법 방어 배율(`db-state-rt-physical-defense`·`-magic-defense`) · 속성 등급 덮어쓰기(`db-state-rt-element-<id>`, 「덮어쓰지 않음」·A~E). 2026-10-01 반응·표적 7칸: 반격 %(`db-state-rt-counter`) · 회피 %(`-evasion`, 최대 95) · 도발(`-taunt`) · 감싸기(`-cover`) · 리플렉(`-reflect`) · 리레이즈 HP %(`-reraise`) · 선고 차례(`-doom`, 1~9). 변신 그림(`db-state-rt-transform`, 파티원 9칸 시트 목록 + 조수가 넣은 다른 id). 스킬 「전투 규칙」 카드: 게이지 밀기(`feature16-gauge-shift`, -100~100) · 힘 모으기 턴(`feature16-charge-turns`, 0~3) · 소환 그림(`feature16-summon`, 파티원 시트 목록 — `partyPixelChoices` 를 변신과 같이 쓴다). 0·끔은 칸을 지운다(undefined). 런타임 의미는 [runtime-battle.md](runtime-battle.md) 「반응·표적 상태 7종」.
- 이미 화면에 있던 것(타격별 배율·피해 공식·상태 변화·우선도·속성·재사용 대기·급소·HP 대가·흡수·입력 커맨드·명중 보정·행동 불가·행동 제한)은 새로 만들지 않았다.

## 도트 연출 탭 · 애니메이션 갤러리 (2026-09-30, A2)

- 탭 `retroChoreographies`(전투 규칙 그룹, 「도트 연출」, `database.ts`). 기본 연출 1130개는 「기본」 배지의 **읽기 전용**이고 「복제해서 고치기」로 `chor_<slug>` 사본을 만든다. 추가·복제·삭제(삭제는 「쓰는 곳」 스킬 수를 경고). 오른쪽 「쓰는 곳」은 그 연출을 부르는 스킬 목록.
- 편집기 `databaseRetroChoreographyView.ts`: 이름·설명·모션·층 행(시트·앵커·시작 ms·배율·반복·「타마다」)·위/아래/삭제/추가, 시간축 막대(층 시작~끝), 무대 미리보기(`databaseSkillRetroStage.ts` 재사용, 고칠 때마다 다시 재생). 층 행의 숫자칸은 `.db-field` 를 고정폭으로 둬야 한다 — `numberField` 스테퍼가 `width:100%` + `container-type:inline-size` 라 shrink-wrap flex 부모에서 16px 로 접힌다.
- 갤러리 `databaseRetroGallery.ts` + `styles/database/retro-gallery.css`: 시트 갤러리(910장, CSS `steps()` 로 프레임 순환 썸네일)와 연출 갤러리 둘 다. 한국어 낱말 검색은 `src/assets/retroSearchIndex.ts`(「번개」 = 시트 20·연출 28, 「번개 사슬」 = 시트 5·연출 10), 필터, 48개씩 쪽수. 선택하면 무대에서 미리 재생.
- 스킬 탭 `db-skill-retro-picker` 는 이 갤러리 위로 다시 쓰였다(testid `-status`·`-clear` 유지, 고르기 버튼 「이 연출을 이 스킬에 쓰기」).
- 캡처: `node scripts/capture-retro-choreo-a2.mjs`(dev:worktree 9807, `?freshProject=1` 메모리 세션) -> `verify-shots/retro-choreo-a2/`.

## 연출 손잡이 카드 · 상태 「몸에 남는 표시」 (2026-09-30, B)

- 도트 연출 편집기(`databaseRetroChoreographyView.ts`)에 카드 `db-retro-choreo-handles`: 속도 슬라이더(`-speed`, 0.5~2)·무게 칩 3개(`-weight`, `button[data-weight]`)·색조 칩 행(`-tint`, 「원래 색」 포함)·화면 효과(흔들림·번쩍임·어둡게·컷인)·층별 효과음. 값이 기본으로 돌아오면 필드를 지워 A1 과 같은 저장 모양을 지킨다. 필드 조각은 `databaseRetroHandleFields.ts`. 스킬 탭 연출 카드는 「자동 추천」 결과도 보여 준다.
- 상태 탭에 select `db-state-battle-aura`(「걸려 있는 동안 몸에 남는 표시」, 8종 + 기본): `updateDatabaseRecord("states", id, { battleAura })`, 비우면 필드 삭제.
- 캡처 증거: `verify-shots/retro-choreo-b/g0-handles-before.png`·`g1-handles-after.png`(`?freshProject=1` 메모리 세션 — 정본 저장 증거 아님).

## 스킬 탭 「도트 연출」 고르기 (2026-09-30)

스킬 탭 「연출」 카드의 `db-skill-retro-picker`(`src/editor/panels/databaseSkillRetroPicker.ts`): 낱말 검색·모션·속성·계열(직업/몬스터 계열 칩)로 계약 약 850개를 거르고 목록에서 고르면 `updateDatabaseRecord("skills", id, { retroChoreographyId })` 로 저장하며 무대(`db-skill-retro-stage`)가 그 연출로 다시 그려진다(「빌려 온 연출: 이름 (id)」 상태 줄, 「연출 지우기」). 색인·필터는 `retroSkillCatalog.ts` 의 `retroChoreographyEntries`/`filterRetroChoreographies` 를 조수 도구와 공유한다. 스킬 id 자체가 계약이면 고르기는 안내만 보인다. 캡처: `scripts/capture-retro-choreo-a2.mjs` -> `verify-shots/retro-choreo-a2/d*.png`(옛 capture-retro-picker.mjs 는 폐기).

## 적 그룹 「전투 뒤」 구획 (2026-09-28)

- 적 그룹 폼 구획 탭에 「전투 뒤」(`db-troop-section-after`)가 붙었다. `src/editor/panels/databaseTroopAfterBattlePanel.ts` — 결과 탭 셋(`db-troop-after-battle-tab-victory|defeat|escape`) + 명령 목록 하나(`db-troop-after-battle-command-list`, 피커 문맥 "map").
- 조건·빈도가 없다. 결과가 곧 조건이다. 저장은 `updateDatabaseRecord("troops", id, { afterBattle })` → `updateTroopRecord` 가 `normalizeTroopRecord` 로 빈 결과를 지운다.
- 참조 위치(`databaseCommandReferences`)에는 `troopBattleEvent` 종류에 페이지 이름 「전투 뒤 · 이겼을 때」 로 실린다. 런타임 계약은 [runtime-battle.md](runtime-battle.md) 같은 날짜 절.

## 자료집 개선안 2단계 — 헤더 저장 상태·얇은 발 줄·연결 칸 (2026-09-27)

- **저장 상태는 헤더에 있다.** `databaseModal` 이 `db-footer-status` 요소를 만든 뒤 헤더(AI 단추 앞)로 옮긴다. 같은 요소라 testid·aria-live·문구 계약(「자동 저장됨」「적용했습니다」「저장 전」…)과 `paintFooterStatus` 소유는 그대로다. 발 줄은 닫기·지금 저장·되돌리기·도움말만 오른쪽에 붙는다. 확인 줄(dirty prompt)은 여전히 발 줄에 뜬다.
- **연결 칸(`db-connections`)** 은 `.database-modal-body` 의 마지막 형제다(`.db-body` 밖). 그래서 탭 캐시·부분 렌더와 얽히지 않는다. `renderDatabasePanel` 이 호스트를 비우면 `paint` 가 다시 붙인다(`panel.host`). 칠하는 때: 활성 탭 구독, 스토어 변경(읽기 전용이라 편집 중에도), 본문 클릭 뒤 마이크로태스크(목록 선택은 구독이 없다).
- 계산은 순수 함수 `src/editor/databaseRecordConnections.ts`: 주인공·직업·스킬·아이템·장비·몬스터·적 그룹·상태만. 삭제 차단 문장(`projectDatabaseReferenceMessage`)은 첫 건만 말하고, 이 칸은 **전부** 목록으로 낸다. 목록이 비었는데 차단 검사가 참조를 찾으면 그 문장을 「다른 곳」 한 줄로 보인다 — 제작법·출하·박물관처럼 목록이 모르는 참조가 있을 때 「아무 데서도 안 쓴다」고 말하지 않게. 계약: `test/databaseRecordConnections.test.ts`.
- 칸은 컨테이너 1180px 미만·도크 모드에서 접힌다(편집 칸을 좁히지 않는다).
- fieldset 제목은 `float: left; width: 100%` 로 선에서 떼어 카드 안 첫 줄로 둔다(흰 카드 + 테두리에서 선을 끊는 legend 가 옛 그룹 상자처럼 보였다). 카드 안 연속 `.db-field` 행은 헤어라인으로 나눈다.

## 자료집 개선안 1단계 — 그룹 띠·쿨 인디고 팔레트·흰 카드 (2026-09-27)

목업(`visualizations/…/database-ui-proposal.html`, 사용자 확인)의 레일·색·면 구성을 실제 창에 옮겼다.

- **그룹 띠(`.db-group-strip`, `db-group-strip-<slug>`)** 는 `.db-tabs` 의 **앞 형제**다. 레일 DOM 계약(검색 → 개요 → 그룹 머리·탭 번갈아, 머리는 DIV)은 그대로고, 띠는 그 밖에 붙는다. 보이는 구획은 `.db-tabs[data-view-group]` 하나가 정하고 행마다 `data-in-view="0|1"` 이 붙는다(`markViewedSection`). 숨김은 CSS 가 한다 — 탭 버튼의 `hidden`(빈 탭 접기·검색)과 섞이지 않는다.
- 보는 그룹은 **활성 탭이 속한 그룹을 따라간다**(`syncGroupStrip` 이 `updateTabButtons` 끝에서). 조수 점프·딥링크가 다른 그룹 탭을 열면 띠도 옮겨 간다. 개요는 그룹 밖이라 보던 그룹을 둔다. 그룹 머리(`db-tab-group-*`) 클릭도 그 구획으로 옮긴다 — 옛 e2e 헬퍼가 머리를 누르고 탭을 누르는 경로가 그대로 닿는다.
- 탭 검색 중(`.db-tabs[data-searching]`)에는 구획 제한을 푼다. 좁은 창(799px 이하)·도크 모드는 띠를 접고 제한도 걸지 않는다 — 기존 56/48px 아이콘 레일이 전 구획을 보인다. 컨테이너 쿼리와 미디어 폴백은 **쌍**이다.
- 레일 폭은 220 → 196px(띠 64px 가 곁에 선다). `test/databaseSidebarCss.test.ts` 가 `width: 220px` 문자열을 찾으므로 주석 없이 남은 선언을 지우지 마라.
- **팔레트**: `studio-theme.css` 의 `--db-studio-*` 값만 바꿨다(canvas `#F5F6FA`, accent `#4F46E5`, 선택 바탕 `#EEF0FF` 불투명). 새 토큰은 `--db-studio-accent-text`(= accent-active, 선택 행·활성 탭 글자) 하나. text-3 대비는 흰·inset·선택행·바탕 네 면에서 5.2:1 이상.
- **면 구성**(`studio-refresh.css`, index.css 맨 끝): 레일·목록은 흰 기둥, 편집 영역은 청회색 바탕, 묶음 카드는 흰 칸 + 헤어라인. studio-v2 는 반대(창 전체 흰 면, 카드 회색)였다. 카드 안 카드는 테두리 한 겹. 목록 발의 삭제는 평소 중립이고 `.confirming`(두 번째 누름)에서만 붉다.
- CSS 예산은 main 과 같다(hex 1648, !important 285). `.db-tabs > .db-tab` 의 강제 `font` 단축을 `font-size`·`line-height` 로 나눈 이유: `!important` 단축은 font-weight 까지 잠가 활성 행의 600 이 진다.
- 기준선 실패(이 변경 전부터): `databaseSidebarKeyboard` Space 케이스(fake DOM 에 ResizeObserver 없음), `databaseSidebarNav` 지역 배지 수(12 vs 9).

## 맵 그룹 목록 수리 — 출처·썸네일·레일 (2026-09-27)

- **공용 킷 판정에 성채를 넣었다.** `spatialCatalog.isBundledFurniturePackKit` 가 번들 `opengameart_castle`(`tex_opengameart_castle`) 의 `castle-measured-*` 14종(잔디 중심·분수 전체…)을 몰라 「내가 만든 항목」으로 내보냈다. 새 번들 킷 시드를 추가하면 이 함수에도 같은 변경에서 넣어라. `test/spatialCatalog.test.ts` 는 전에 이 타일셋을 필터로 빼고 검사해서 결함을 못 봤다 — 지금은 「내 설계」에 없고 기본에 있음을 직접 단언한다.
- **지역 목록 축소본 129장을 채웠다.** `catalogListImage` 는 `/assets/catalog-thumbs/…` 가 없으면 원본으로 넘어간다. `public/assets/region-references/*.png` 208장 중 129장이 축소본 없이 1216×960 원본으로 카드에 실렸다. 새 참고 사례 PNG 를 넣으면 `python3 scripts/content/build-catalog-thumbs.py` 로 축소본을 같이 커밋한다.
- **목록 썸네일(`renderSpatialListThumb`)** 은 기본 세계를 `renderWorldCatalogThumb`(지역 점 배치), 맵이 연결된 지역을 `regionMapPreview` 로 그린다. 전에는 둘 다 `tilesetListThumb`(시트 귀퉁이)로 떨어져 모든 세계 카드가 같은 그림이었다.
- **레일 탭 검색은 `position: sticky`** 이고 구획 머리는 그 아래(`top: 40px`)에 붙는다. `.db-tabs` 의 `scroll-padding-top: 72px` 가 `revealActiveTab`(`scrollIntoView nearest`)이 활성 행을 고정 머리 밑에 숨기지 않게 한다. 맵 그룹은 레일 맨 아래라 이 탭을 열면 레일이 스크롤되고, 전에는 검색 칸이 반쯤 잘린 채 사라졌다.
- 오브젝트 인스펙터의 `.spatial-object-field` 입력·선택은 `min-width: 0` + `max-width: 100%` 로 패널 폭 안에 머문다(긴 타일셋 이름이 밖으로 밀던 결함).

## 자료집 열기 (2026-09-24)

도구의 자료집은 `openDatabaseModalLazy`가 연다. 본문 묶음(실측 약 1.4MB)은 편집기 첫 화면 그래프에 넣지 않고, 메뉴 모듈이 잡힌 다음 프레임에 미리 읽은 뒤 창까지 만들어 숨겨 둔다. 탭을 지정하지 않은 클릭은 그 창을 보여 준다. 아직 읽는 중이면 「여는 중」 껍데기를 띄우고, 실패하면 다시 열기가 남는다. 특정 탭으로 점프하면 숨겨 둔 창은 버리고 그 탭을 새로 연다.

## 게임 오버 라이브러리 저작 (2026-09-23)

`시스템 → 게임 오버`는 `databaseGameOverLibrary.ts`가 소유하는 이름별 라이브러리다.
공통 설정(`system.gameOver`)을 유지하고 최대 64개 `system.gameOvers[]`를 생성·복제·이름 변경·삭제한다.
`defaultGameOverId`는 전투 전멸과 ID 없는 명령의 기본값이다. 기본값 또는 이벤트에서 참조하는 항목은 삭제할 수 없다.
`gameOverReferenceCounts`는 맵 페이지·공통 이벤트·트룹·엔딩 내부의 중첩 명령을 센다.

각 항목은 장면 시퀀스(텍스트/이미지/영상/음성/음악), 종료 화면 배경·음악·문구, 화면 연출과 패배 후 처리를 따로 갖는다.
연출 `classic/horror/blackout`과 결과 `menu/recover/title`은 독립적이다. 회복 장소와 암전·정적·메뉴 대기·메시지 시간을 편집한다.
`게임 오버`/`주인공 사망` 명령의 선택기는 `gameOverId`를 저장한다. 조건 분기의 각 가지에 다른 ID를 선택하여 멀티 게임 오버를 만든다.
명시한 ID가 없는 경우 에디터/프로젝트 참조 검증에서 오류가 난다.

전체 미리보기는 `createTerminalSurface` + `playGameOverPresentation`으로 출하 플레이어와 같은 연출을 사용한다.
재시도·귀환·타이틀 콜백만 시뮬레이션하며 프로젝트/세션을 바꾸지 않는다. Esc·항목 변경·탭 닫기·프로젝트 교체 때 입력/음악/타이머를 해제한다.
`CinematicTarget`은 기존 문자열 외에 `{gameOverId}`를 받아 항목별 변경/미디어 티켓을 격리한다. 복제는 깊은 복사다.

실제 에디터 저작 → serialize/deserialize → 독립 player.html 재생 증거: `docs/reviews/2026-09-23-game-over-library/`.
QA fixture는 메모리 전용이며 정본 프로젝트 저장 증거로 취급하지 않는다. `scripts/qa/runtime/game-over-library.probe.mjs`가 재현 스크립트다.


## 장소 탭 재설계 — 라이브러리 우선 배치 (2026-09-21)

**문제: 목록이 아니라 나머지가 화면을 먹었다.** 데이터베이스 → 장소를 1600×1000 에서 재 보니
편집기 셸 안에서 카드 그리드가 791×424 였다 — 화면의 21%. 71장이 3,382px 를 굴러가는데 보이는 건
4줄(10장)이었다. 세로를 세 곳이 나눠 먹었다: 목적 띠 + 액션 줄이 각각 밴드로 178px, 오른쪽 320px
속성 패널이 **선택이 없어도** 자리를 차지, 도구·필터가 두 줄로 94px.

바꾼 것과 실측(1600×1000, `output/evidence/places-ux-redesign/impl/`):

1. **목록이 기본.** `.spatial-body.is-library-only` 로 스테이지를 접는다(그리드 1332×527, 7열, 한 화면 14장).
   스테이지 껍데기는 DOM 에 남긴다. 목록을 여는 동안에는 맵을 컴파일하지 않는다 — 속성을 열 때 그린다.
   속성을 열면 5열(65%)로 줄고, 닫으면 7열로 돌아온다.
   완성 사례의 타일 원본과 검토 장소 래스터는 카드 목록과 분리되어 있다.
   **맵에 놓기**는 검토 장소를 기본 장소 설계로 프로젝트에 넣은 뒤 미리보기를 만든다. 장소 설계 문서가 없는 프로젝트는 그 자리에서 레거시 스냅샷을 문서로 바꾼 다음 넣으며, 「장소 편집 켜기」를 먼저 요구하지 않는다. 완성 맵 사례는 그 맵을 맵 목록에 복사한다. 어느 쪽도 만든 사람의 프로젝트 폴더를 찾지 않는다.
2. **선택과 편집기 진입의 분리.** 예전 `onSelect` 는 `listView: card.id !== selected?.id` 였다 —
   아무것도 안 고른 상태에서 카드를 누르면 선택과 동시에 편집기가 열려, 「맵에 놓기」 액션 줄을 볼
   기회가 없었다. 세션에 `galleryCardId` 를 추가해 **첫 클릭은 선택만**, 같은 카드 재클릭이나
   액션 줄의 「편집」이 편집기로 들어간다.
3. **목적 띠 복원.** 3차 수리에서 들어온 `spatial-purpose` 는 타일 화면 개편(2026-09-21) 때 렌더
   호출만 사라져 CSS(`.spatial-purpose*`)만 남아 있었다 — 화면에는 없었다(프로브 두 번 모두 null).
   한 줄 띠로 되살리고, 같은 말을 하던 중복 안내문(`.spatial-kind-guidance`)은 장소 셸에서 숨긴다.
4. **머리 3줄 → 2줄.** 장소 라이브러리 제목·부제·필터·분류 탭·소재 안내를 두 줄로 접고,
   카드 썸네일 120→84px·캡션 여백을 줄였다. 이름은 두 줄 클램프 — 한 줄 말줄임은
   「침묵의 묘역 · 무너진 납골당」 같은 이름을 구별 불가능하게 만들었다(40장 중 6장 잘림).
5. **0건 탈출구.** 필터가 0건이면 「필터 초기화」 버튼을 띄운다(`spatial-filter-reset`).
   종전에는 문구만 있어 사용자가 손으로 되돌려야 했다.
6. **「속성」 토글이 1200px 위에서도 보인다.** 종전에는 컨테이너 쿼리로 `display:none` 이라 넓은
   화면에서 속성을 닫을 수 없었는데, 이제 속성이 opt-in 이라 이 토글이 유일한 입구다.

계약 테스트: `test/spatialPlacesLibraryLayout.test.ts`(첫 렌더는 갤러리 · library-only 클래스 ·
첫 클릭 선택/재클릭 편집 · 액션 줄 편집 · 0건 초기화).

검증: `typecheck:app` exit 0. `spatialPlacesLibraryLayout`·`spatialIntegratedAuthoring`·
`spatialShellDrawer`·`spatialNavigation.routes`·`databaseAllTabsRenderWalk` 등 84건 중 81 통과.
실패 3건(`spatialShellKeyboard`)과 4건(`databaseAllTabsRenderWalk`/`spatialNavigation.routes`)은
**origin/main 원본 체크아웃에서 같은 이름·같은 메시지로 재현**되는 기존 실패다. CSS 게이트도
`check-css-graph`(tileset-ai-workspace.css)·`check-dead-css-classes`(.db-ws-stat-neutral)·
`check-css-surfaces` 위반 0건 신규 — 전부 원본에서 동일하게 재현. hex/undefinedVars 래칫 상향분은
손대지 않은 파일(`runtime/shop.css` 등)에서 온 것이다.

## 몬스터 종족의 전투 뒷모습 (2026-09-20)

> **2026-09-21 타일 화면 개편:** 타일 탭은 `tilesetSettingsPanel.ts`의 전용 라이브러리이며
> 첫 내부 탭은 **AI 참고문서**다. 설정 폼은 별도 탭으로 이동했고, 장소용 설계/배치 셸,
> 별도 AI 분석 런처·JSON 붙여넣기·생성 감사 레일은 타일 UI에서 제거했다.
> 아래 과거의 "기본 통행 화면" / "생성 감사 레일" 설명보다
> [현행 구성과 제거 범위](tileset-reference-documents.md#타일-화면-구성-2026-09-21)를 우선한다.


종족 그래픽 영역의 `전투 뒷모습` 리소스 선택기는 `graphic.backResourceId`를 편집한다. monster 리소스를 선택하거나 지울 수 있으며 기존 `currentSpecies`/`updateSpecies` 경로를 사용한다. 별도 필드 그래픽이나 정면 그래픽을 덮어쓰지 않는다. QA 선택자는 `db-monster-species-back-resource`. 후면 전투 방향에서만 적용하며 없으면 기존 그래픽을 사용한다.

## 이벤트 초안 원본의 삭제 참조 (2026-10-02)

`databaseEventReferences.eventReferenceMatches`는 이벤트 작업본과 `edit` 초안의 저장 원본을 함께 검사한다. DB 레코드·스위치/변수·리소스·공통 이벤트 삭제 가드에 공통 적용하며, 페이지 조건·명령·그래픽 및 기존 메타데이터 검사 범위를 원본에도 그대로 적용한다. 작업본에서 참조를 지운 것만으로는 삭제할 수 없고 이벤트를 적용한 뒤 삭제한다. 같은 이벤트의 작업본과 원본이 둘 다 참조해도 위치는 한 건이다.

새 초안의 생성 기준본과 `remote-delete` 충돌의 원본은 정본 저장 대상이 아니므로 검사하지 않는다. 현재 작업본의 참조는 두 경우 모두 보호한다. `project/eventDrafts.discardEventDraft`도 `remote-delete` 취소 시 이벤트를 제거하여 오래된 원본을 부활시키지 않는다. 저장 투영·vault·취소가 같은 삭제 계약을 따른다. 회귀 소스는 `databaseDraftReferenceGuards.test.ts`, `eventDraftVault.test.ts`; 테스트 실행은 별도 승인 범위다.

## DB 삭제의 스킬·주인공 권한 참조 (2026-10-02)

- 스킬 삭제는 아이템의 `skillId` 외에 `learnedSkillId`(스킬북), `activateSkillId`(발동 효과), 직업 `battleCommands[].skillId`도 차단한다. 습득 목록에 없는 전투 명령 전용 스킬도 참조다.
- 주인공 삭제는 시작·현재 파티 외에 직업 `equipmentPermissions.actorIds`, 장비 `equippableActorIds`, 아이템 `usableActorIds`와 레거시 `equipmentProfile.equippableActorIds`를 검사한다.
- 이 필드들은 `io/references.ts`가 저장본 로드 시 검사하는 외래 키다. 현재 아이템 종류에서 숨겨진 필드도 저작값으로 보존되므로 삭제 가드에서 제외하지 않는다. 참조를 자동 삭제하지 않고 소유 레코드 이름을 안내한다.
- 공용 검사 `projectDatabaseReferenceMessage`를 UI와 AI 삭제가 함께 사용한다. 회귀 소스: `test/databaseDirectReferenceDeletion.test.ts`(차단 후 데이터·undo 불변, 연결 해제 후 삭제·직렬화 왕복). 이 변경 세션에서는 테스트/게이트를 실행하지 않았다.

## 감사 후속: 참조를 보존하는 삭제 경로 (2026-09-20)

- 기본 DB 9종의 삭제 검사는 `databaseRecordReferences.ts`의 `projectDatabaseReferenceMessage(project, collection, id)`가 소유한다. `databaseReferences.ts`는 현재 store를 전달하는 UI 어댑터다. AI 삭제는 자기 draft를 전달한다. store를 AI 도구에 import하지 않는다.
- 작물 씨앗/수확물, 몬스터 종족의 레벨 스킬, 맵 인카운터/필드 스폰, 직업 간 승급/장비 권한을 검사한다. 아이템은 기존 `collectProjectItemReferenceIds`를 보조 판정으로 재사용한다.
- 명령 스캐너는 상점 실패 및 전투 결과 3분기까지 검사한다. 생활 목적지 switchId도 삭제/미사용 판정의 참조다.
- 제작법 삭제와 ID 변경은 `databaseCraftReferences.ts`를 공유한다. 명령·생활 스킬·번들·박물관 보상을 모두 본다.
- 수정·검증 범위와 미해결 목록: `docs/reviews/2026-09-20-data-integrity-fixes.md`. 회귀 테스트 추가, 이 세션에서는 테스트/게이트 미실행.

## 장소 편집 1차 UX 수리 — 이름·툴바·속성·카드 (2026-09-15)

장소 탭의 네 가지 결함을 고쳤다. 실측 근거와 함께 남긴다.

**1. 이름이 제목이 됐다.** `spatialCompositionWorkspace.ts` 헤더의 고정 문구 "장소 편집" 을
설계 이름으로 바꾸고 인라인 편집을 붙였다(`composition-title` 버튼 → `composition-title-input`).
Enter 저장 · Esc 취소 · blur 저장. 이름은 **각 종류의 초안 명령**으로 고친다
(`mutateWorkingSpace` / `mutateWorkingPlace` / `mutateWorkingGeography`) — 라이브러리 레코드를
직접 고치면 저장 상태가 "읽기" 에 머물러 사용자가 초안이 생긴 걸 모른다. 실측으로 확인:
이름 변경 후 제목·선택 드롭다운·인스펙터 입력이 모두 갱신되고 상태가 "적용하지 않은 변경이 있습니다" 로 바뀐다.

**2. 툴바 15개 → 5개 + `⋯ 더 보기`.** `renderSpatialChrome` 의 한 줄 15버튼은 대부분
비활성이라 무엇을 누를 수 있는지가 오히려 안 보였다. 추가·미리보기·적용·되돌리기·다시 실행만
남기고 활성화·복제·삭제·삭제 확인·시공·시드·새로고침·분리는 `details.spatial-more` 안으로
옮겼다. 삭제 확인이 떠 있으면 `open` 으로 강제해 접힌 채로 두지 않는다.
`renderBrowserChrome` 도 같은 규칙으로 복제를 오버플로로 내렸고 요약 라벨을 `⋯ 더 보기` 로 통일했다.
테스트는 이 버튼들을 직접 누르지 않는다(실측: `spatial-duplicate`·`spatial-activate`·`spatial-detach`·
`spatial-refresh` 를 클릭하는 테스트 0건). e2e `spatial-authoring.spec.ts` 도 "숨은 툴바 버튼을
가정하지 않는다" 를 규약으로 적어 두었다.

**3. 속성 패널을 폈다.** 복합 편집기 우측의 접힌 `<details> 기존 설계와 생성 규칙` 을 걷어내고
인스펙터를 바로 렌더한다. 이름 입력이 이 안에 있었기 때문에 **이름 수정 경로가 사실상 없었다.**
`asset-browser.css` 의 중첩 인스펙터 리셋은 `.spatial-asset-browser` 에만 걸려 있었다 —
`.spatial-mixed-workspace` 를 같은 선택자에 추가하지 않으면 좁은 폭에서 `.spatial-inspector` 가
`display:none` 으로 사라진다.

**4. 카드 이름 잘림.** `.spatial-card{min-height:168px}` + `.spatial-card-caption{min-height:48px}`
조합에서 캡션의 세 줄(이름·부제·배지)이 48px 안으로 짓눌려 **13px 글자가 6px 상자에 잘렸다**
(실측 `getBoundingClientRect().height === 6`). 캡션을 `min-height:auto; align-content:start;
grid-auto-rows:auto` 로 풀고 카드 최소 높이를 184px(120 썸네일 + 62 캡션)로 올렸다. 이름 상자 18px 확보.

> **함정 (실측으로 데었다):** 이 잘림을 고칠 때 `.spatial-gallery-grid{align-items:start}` 를
> 먼저 시도했다. `getBoundingClientRect` 는 카드 182px·이름 18px 로 **정상을 보고했지만**
> 실제 화면에서는 그리드 행이 43px 씩만 전진해 카드가 서로 **겹쳐** 캡션이 다음 카드 밑에 깔렸다.
> 숫자만 보고 통과시키면 놓친다. 카드 테두리를 그려 픽셀로 확인하라
> (`output/evidence/places-ux-audit/after/card-outline.png`).

검증: `npm run typecheck:app` exit 0, `npm run gates -- --only css` 기준선 대비 회귀 0,
`test/spatialMixedComposition` · `spatialCompositionWorkspace` · `spatialUnifiedPlaces` ·
`spatialIntegratedAuthoring` · `spatialPlacePlacedUi` · `spatialNewPlace` 37건 통과.
증거 스크린샷은 `output/evidence/places-ux-audit/{before,after}/`.

### 2차 (같은 날) — 갤러리 복귀와 속성 패널 통합

**← 장소 목록.** 세션에 `listView: boolean` 을 추가했다(`spatialAuthoringSession.ts`).
`spatialShell.ts` 의 복합 편집기 분기가 `!session.listView` 를 함께 본다 — canonical 설계가
선택된 채로도 카드 갤러리로 돌아갈 수 있다. 헤더의 `composition-back-to-list` 버튼이
`listView: true` 로 켜고, 갤러리 카드 클릭(`spatialShell.onSelect`)이 다시 끈다.
설계 선택 `<select>`(`composition-design`)는 **지우지 않고** 빵부스러기 우측의 보조
빠른 전환으로 내렸다 — 테스트 4건(`spatialIntegratedAuthoring` 등)과 QA 스크립트 6건이
이 testid 로 `selectOption` 을 쓴다. 완전 제거하려면 그 10곳을 같이 손봐야 한다.

**속성 패널 통합.** 우측이 「배치 속성」과 「속성」 두 덩어리여서 이름이 제목·인스펙터
h3·이름 입력까지 세 번 보였다. 「속성」 하나로 합치고(인스펙터 → 「캔버스」 소제목 →
타일셋·크기·선택 컨트롤 → 건물로 묶기), 중복 이름 h3 는 복합 편집기 안에서만 CSS 로 숨겼다
(`.spatial-mixed-workspace .asset-browser-detail .spatial-inspector-name`).

### 3차 (같은 날) — 이 탭이 뭔지 말하게 한다: 목적·쓰임·배치 감사

사용자 지적: 「장소에서 뭔 할 수 있는지 안 와닿B」. 1·2차는 버튼 위치를 고쳤고 존재 이유는
손대지 않았다. 이 탭은 **사용자와 AI 가 공유하는 어휘집**이다 — `src/ai/spatialContext.ts` 가
AI 에게 `list_spatial_designs kind:place` 로 완성된 집을 찾으라고 지시하고, `spatialTools.ts` 에
list/get/upsert/preview_build/apply_build/edit_occurrence 6개 툴이 이 라이브러리를 겨눈다.

**중요 — AI 위임 버튼은 넣지 않는다.** 감독자 판단: AI 에게 장소 배치를 맡기면 결과가 나쁘다.
단, 버튼을 빼도 `place_concept`·`author_village` 는 이 탭 UI 와 무관하게 돌아간다 —
제거는 품질 조치가 아니라 **위임을 권하지 않는다는 자세**다. 그래서 origin 배지가
"출처 표시"가 아니라 **감사 추적**이 된다: AI 가 어디에 뭐를 놓았는지 찾아 고치는 수단.

**(a) occurrence origin.** `SpatialOccurrence.origin?: "user"|"builtin"|"legacy"|"ai"` 추가
(`types.ts`, guards 허용목록에 `origin` 추가, `SpatialInstantiation` 으로 전달).
AI 경로(`spatialTools` apply_build, `spatialConceptTools`, `legacyHouseInterior`)는 `"ai"`,
편집기 경로(`spatialBuildActions`, `spatialPlacePlaced`, `spatialPlaceRooms`, `placedSpaceMembers`)는
`"user"` 를 찍는다. `authoringRefresh` 는 원본 값을 이어받는다.
**기존 데이터는 필드가 없다** — `occurrenceOrigin()` 이 generatorVersion 태그로 읽는다
(`spatial-ai*`·`spatial-legacy-house*` → ai, 그 밖 → user). 명시 필드가 항상 이긴다.

**(b) 쓰임.** `spatialUsage.ts` 가 occurrences 를 설계별로 집계한다(루트뿐 아니라 다른 장소 안에
방으로 들어간 자식 배치도 센다). 카드에 「맵 N곳 · AI n · 직접 m」 또는 「아직 안 쓰임」,
갤러리에 쓰임 필터(전체/배치됨/안 쓰임/AI가 놓음), 선택 카드에 배치 팝오버(출처 배지 · 맵·좌표 ·
「맵으로 →」). 점프는 `focusEditorRegion` + `requestDatabaseModalClose("x")` 를 쓴다
(databaseModal 은 **지연 import** — 정적이면 모달→DB탭→갤러리→이 모듈 순환이 생긴다).

> **함정 (실측으로 잡았다):** 쓰임을 `canonicalSource?.id ?? localId` 로 찾으면 **틀린다**.
> 기본 카탈로그 카드의 localId 와 라이브러리 설계 id 가 둘 다 `inn` 이라, 기본 「여관」 카드가
> 내 설계의 배치를 빌려 「맵 1곳 · AI 1」 로 표시됐다. **canonical 카드만 쓰임을 갖는다.**

**(c) 목적과 액션.** 셀 폭 전체에 목적 스트립(「여기서 만든 장소가 정본입니다. AI는 여기서 골라
쓸 뿐입니다.」 + 3단계). **갤러리 칼럼(~400px) 안에 넣지 마라** — 세 줄로 접혀 안 읽힌다.
선택 카드에 「맵에 놓기」(기존 `chrome.build` → new-maps 미리보기)·「편집」·「배치 N」.
카드가 `<button>` 이라 안에 버튼을 넣을 수 없어 `.spatial-card-cell` 로 감싼다.
장소 갤러리는 **첫 클릭이 선택**이다(액션 줄이 뜬다). 카드 위에 포인터를 올리면 칸은 자르지 않고, 잘리지 않은 확대 그림만 카드 밖에 뜬다. 그 패널 위에서는 아래 카드로 호버가 넘어가지 않는다. **같은 카드를 빠르게 한 번 더 누르면(더블클릭) 상세 모달**이 열린다 — 그림·분류·쓰임·구성, 그리고 「맵에 놓기」「편집」. 셸이 클릭마다 카드를 다시 그리므로 브라우저 `dblclick` 은 끊긴다. 판정은 카드 id 와 450ms 간격이다. **그 간격을 넘겨 같은 카드를 다시 누르면** 예전처럼 편집기로 들어간다.

> **함정 (또 실측):** 셸은 **정확히 두 행**짜리 그리드다(`chrome` / 본문). 목적 스트립을
> `.spatial-shell` 의 **세 번째 자식**으로 넣으면 본문이 암시 행으로 밀려 `overflow` 에 잘렸다 —
> DOM 에는 있는데 화면에 없어서, 프로브가 `spatial-purpose` 를 기다리는 동안 스크린샷은 깨끗했다.
> 스트립과 본문을 `.spatial-shell-main`(그리드 행 auto·minmax(0,1fr)) 한 겹으로 묶어 둘째 행에 넣는다.

> **함정 (팝오버가 화면 밖에 낳았다):** 셸은 리프레시마다 통째로 다시 만들어진다 — 카드 버튼 하나를
> 눌러도 `.spatial-gallery-grid` 의 `scrollTop` 이 0 으로 돌아가고, 카드 아래에 붙는 팝오버는
> 뷰포트 밖에 낙았다(실측: 그리드 2153 → 0, 팝오버 y=2724 · 뷰포트 280~824). 사용자에겐
> 「배치 N 을 누르면 목록 맨 위로 튕기고 아무것도 안 뜨는」 증상이다. `usageChromeState.galleryScrollTop`
> 으로 스크롤을 이어받고, 열린 팝오버가 있으면 `scrollIntoView({block:"nearest"})` 로 맞춘다
> (실측: 2153 유지, 팝오버 y=571 · 가시). 필터 칩은 다른 결과집합이라 **의도적으로 0 으로 되돌린다**.
> 복원은 셸이 문서에 **붙은 뒤**(microtask + rAF)에 한다. 붙기 전 `scrollTop` 대입은 브라우저가 버려서
> 카드 클릭마다 목록이 맨 위로 튀었다(2026-09-28 실측: 600 → 0, 수정 후 600 유지).

> **탭 본문 스크롤 보존 (`database.ts` `renderActiveTab`):** 값 하나를 바꿔도 모달의 store 구독이
> 탭 본문을 통째로 다시 그린다. 목록은 뷰마다 제 스크롤을 되돌리지만 상세·설정 칸은 그러지 않아
> 숫자 ±·초기화·통행 토글을 누를 때마다 맨 위로 튀었다(실측: 전투 몬스터 상세, 적 그룹, 속성,
> 전투 애니메이션, 맵 → 타일 상세). 이제 같은 탭을 다시 그릴 때 스크롤된 칸을 `data-testid`(없으면
> 태그+첫 클래스)와 순번으로 적어 두고, 새로 그린 뒤 **아직 0 인** 같은 자리 칸에만 되돌린다.
> 뷰가 스스로 정한 위치(선택 행 노출 등)와 탭 이동(새 탭은 맨 위)은 건드리지 않는다.
> 의도된 이동은 남는다: 전투 명령 ▲▼ 는 옮긴 행으로 초점을 따라가고, 시스템 스튜디오 카드는
> 해당 절을 맨 위부터 연다.

> **CSS 예산:** 새 규칙에 `var(--db-studio-*, #HEX)` 폴백을 쓰면 `hexLiterals` 래칫이 막는다
> (spatial-shell.css 31 → 43). 토큰은 `.database-modal-backdrop`(studio-theme.css)에 정의돼 있으므로
> 새 규칙은 폴백 없이 `var(--db-studio-*)` 만 쓴다.

> **기존 결함 (이 PR 밖, 재현 확인됨):** 장소 갤러리에서 시공→적용을 하면
> `referenced: child:40:occ_…:sign:0` 이 잡히지 않고 셀이 날아간다. **1·2차 이전 코드에서도
> 똑같이 재현된다** (96e8473ee 에서 별도 워크트리로 확인: 같은 예외, `galleryPresent:false`).
> 이번 변경의 회귀가 아니다. 다만 「맵에 놓기」가 카드 주 액션이 되면서 **더 쉽게 밟힌다** —
> 다음 순위로 고쳐야 한다. `ownership.ts:40` (strong 참조) 와 시공 compile scope 를 볼 것.

검증: `typecheck:app` 0, `gates --only css` 회귀 0(budget·graph 통과), `test/spatialOccurrenceOrigin.test.ts`
(신규 3건) 포함 관련 10파일 **97건** 통과. 증거: `output/evidence/places-ux-audit/phase3/`
(01 목적·쓰임, 02 AI 필터, 03 배치 팝오버). 프로브: `scripts/tmp-phase3-probe.mjs`(gitignore).

아직 안 한 것(후속): 위 시공→적용 결함, 층·방 트리. 층·방 트리는 「복합 공간 편집기」 절의
단일 캔버스 평탄화 금지 규약과 충돌하므로 층별 편집 라우팅을 먼저 정해야 한다.

## 장소 통합 진행: 방·층과 재료 (2026-09-14)

새 건물의 기존 구조 편집기에 「방 추가」「층 추가」를 붙였다. 원본 방을 복제해 덮지 않고
새 장소를 초안에 만들고 자식 슬롯으로 연결한다. 속성창에서 포함된 장소의 층을 수정하거나
「이 장소에서 빼기」로 슬롯을 제거할 수 있다. 원본 장소는 삭제하지 않고 해당 슬롯의 연결만 함께 제거한다. 배치된 건물은 기존 preview/apply 경로로
동결 배치를 수정하며 원본 구성은 유지한다. 실패한 방 추가는 이전 초안·미리보기를 보존한다.
좁은 화면의 열린 속성 패널은 캔버스 위에 뜨므로 상단 속성 토글로 닫고 조작한다.

직접 구성 재료는 `공간`과 `장소`를 하나의 「장소」로 표시한다. 두 내부 저장 종류 모두
다른 방/장소를 같은 지도에 배치할 수 있으며 자기 자신과 상위 장소는 목록에서 제외한다.
도메인 검증도 같은 허용표를 쓰고 순환 참조를 검사한다. 다층 구성은 여전히 층별 편집 대상이다.
직접 구성은 「건물로 묶기」로 새 건물을 만들고 그 안에서 별도 지도의 방·층을 추가한다. 원래 장소 ID와 그림은 유지하며, 이 작업도 미리보기·적용·취소를 따른다. 진행 기준은 `unified-place-authoring.md`다.

## 새 장소 생성 흐름 (2026-09-14, 2단계)

`spatialStage.domainChrome`의 장소/기존 공간 UI 추가 버튼은 `spatialNewPlaceDialog.ts`를 연다.
이름·실내/실외/건물·가로/세로(4~128칸)·지원 타일셋을 선택한다. 실내는 기존 실내 시공기가
지원하는 타일셋, 실외는 ground 재료가 있는 타일셋만 제시한다. `spatialNewPlace.ts`가
직접 편집할 SpaceDesign 또는 1층 SpaceDesign을 포함한 facility PlaceDesign을 한 번의
초안 편집으로 만든다. 실외 floorAreas는 전체 바닥을 명시한다. 기존 시공기로 생성 가능 여부와
문서 참조를 검사하며 취소/실패는 라이브 프로젝트를 수정하지 않는다. 미리보기→적용과 undo는
기존 컨트롤러를 사용한다. 전환한 프로젝트에 열린 창의 입력을 적용하지 않는다.

프로그램용 `spatialSpacesChrome.add`/`spatialPlacesChrome.add`의 기존 동작은 유지한다.
이 단계는 새 장소 시작 흐름이며 방 추가·층 추가·출입 연결을 새 통합 UX로 만드는 것은 후속이다.
기존 공간 편집 제목/추가 버튼을 장소로 표시하고 DB 검색의 공간/방 키워드는 장소를 찾는다.
스타일은 body에 붙는 모달을 위한 `spatial-new-place.css`이며 전역 테마 토큰을 쓴다.
검증: `test/spatialNewPlace.test.ts`(취소/실패/초안·적용/직렬화·맵 시공), 기존 통합 저작 테스트,
`scripts/capture-new-place.mjs`(격리 fixture, 실제 세 형태 생성·적용, 1440/1024px).

## 장소 목록 통합 1단계 (2026-09-14)

맵 레일에서 독립 `spatialSpaces` 항목을 제거하고 `spatialPlaces` 아래 편집 경로로 유지한다.
장소 설계 목록은 기존 장소와 공간(기본 방 규칙 포함)을 함께 표시하며, 배치 목록도 두 종류를
합친다. 카드의 kind·canonicalSource·ID는 보존한다. `spatialGalleryNavigation.ts`가 선택한
카드 종류에 맞는 기존 편집기로 이동하고 breadcrumb를 남긴다. 공통 구성 편집기의 선택기도
같은 경로를 사용한다. 공간 편집 화면의 「장소 돌아가기」으로 돌아갈 수 있고, 기존 바로가기와
`tilesetSpaces` 방 규칙 편집 경로도 유지한다. 레일의 소속 강조는 장소를 따른다.

이 단계는 목록·탐색 통합이다. 새 장소 생성, 방·층 추가, AI 용어, 공간/장소 내부 스키마와
시공기는 후속 단계이며 변경하지 않았다. 포함된 공간도 재사용을 위해 목록에 표시한다.
시설/정주지/자연 필터는 기존 장소 분류만 필터링한다. 데이터 마이그레이션이나 원격 콘텐츠
수정은 없다. `test/spatialUnifiedPlaces.test.ts`, 기존 catalog/card-resolution 계약,
`scripts/capture-unified-places.mjs`(격리 blankProject, 1440/1024px)로 검증한다.

## 복합 공간 편집기 (2026-09-13)

자체 canonical 설계의 공간·장소·지역·세계는 `spatialCompositionWorkspace.ts`를 쓴다.
오브젝트는 별도 타일셋/오브젝트 브라우저와 타일 화가를 유지한다. 공간 재료는 타일·오브젝트,
장소는 타일·오브젝트·공간, 지역은 여기에 장소, 세계는 여기에 지역을 추가한다.
재료 검색, 클릭/드롭 배치, 선택 이동(드래그·방향키), 삭제, 하위/상위 타일 레이어,
붓·지우개·원래대로, 확대/맞춤, 캔버스 크기를 제공한다. 원래대로는 직접 칠한 셀만 제거한다.
기존 생성 규칙은 우측 접힌 상세에 남고 기존 슬롯도 선택/이동/삭제한다.
선택 항목의 원본 열기(Enter)는 해당 종류의 편집기로 이동하고 뒤로 가기로 부모를 복원한다.
초안은 미리보기→적용 트랜잭션으로 저장하며 잘못된 범위/참조/시공은 초안 반영 전에 거부한다.
직접 구성 편집 취소는 구성 전용 40단계이며 기존 생성 규칙 변경은 공통 초안 취소를 쓴다.

현재 한 캔버스는 **같은 타일셋** 재료만 조합한다. 다른 타일셋 재료는 비활성 표시한다.
기존 여러 층 및 개요 지도 routes/connections를 단일 캔버스로 조용히 평탄화하지 않는다:
구성 없는 기존 설계가 복합 미리보기에 맞지 않으면 기존 편집기로 열어 탐색/층별/개요 편집을 보존한다.
이미 명시적 구성이 있는 설계의 지원 불가 시공은 오류로 막는다. 복합 구성이 없는 인스턴스는
기존 층별/개요 시공기를 계속 사용한다. 라이브 콘텐츠를 자동 변환하거나 원격 덮어쓰지 않는다.

검증: `test/spatialMixedComposition.test.ts`, `test/spatialCompositionWorkspace.test.ts`,
기존 schema/space/place compiler 계약, `scripts/capture-spatial-mixed.mjs`(공간/장소/지역/세계 및1024px),
오브젝트 브라우저는 `scripts/capture-spatial-browser.mjs`.
브라우저 fixture 주입에 동적 store import를 쓸 때 Vite HMR 직후에는 쿼리별 store singleton이
갈릴 수 있다. 이 경우 소유한 dev 서버를 재시작한 뒤 캡처한다.

## Placed-place child proposal adapter (2026-09-08)

Association-based child lifecycle, frozen actual read models, clone/deletion data and
the pending UI integration boundary: [placed-place-edits.md](placed-place-edits.md).

## Monster resource metadata worksheet (2026-09-07)

2026-10-02: 공용 몬스터 미리보기는 140종 native 시트의 idle_a 한 칸이다. 옛 painted starter/monsters 그림과 이름 추정 폴백은 폐기했다. 현재 색/외형 설명·해시·업로드 우선권 및 스킬 비교 근거: [공용 몬스터 폐기](native-enemy-retirement.md).

Database > 전투 몬스터 > 몬스터 소재 uses the full resource catalog independently
of gameplay enemies. Draft, Apply/reset, project-switch safety and focused QA
ownership: [monster-resource-editor.md](monster-resource-editor.md).

## Shared database CSS ownership (2026-09-06)

`studio-v2.css` owns the shared numeric composite: one 32px border box and
28px side buttons, with the existing 120px container collapse. Its generic
input, focus, disabled and card-input rules exclude the composite interior.
The earlier duplicate stepper chrome in `modern-controls.css` is removed;
that sheet retains native checkbox/radio/range/select behavior. Animation's
vertical scroll belongs to `animation-editor.css`; `battle-studio.css` no
longer overrides it with visible overflow. No playback or mutation paths change.
Rendered regressions: `test/e2e/database-css-ownership.spec.ts`, run with
`playwright.db-css.config.ts` (Chromium and Firefox supported, zero retries).
A frozen dev server caches transforms: after an edit restart only the owned
worktree server before measuring, and bind evidence to its cwd/revision.

Shared section navigation now belongs to `workspace-modern.css`; equivalent
actor/enemy controls reuse its 34px grammar. CRUD chrome and 12.5px captions
belong to `studio-v2.css`, with document/System variants kept scoped. Bare Life
numeric inputs retain native spinners and their change-only commit semantics.
Modal-body overflow belongs to `sidebar.css`; cards, legends and list ordinals
to `studio-v2.css`; ordinary 24px DB rows to `record-list-modern.css`; 36px actor
portraits to `desktop-record-shell/13-actor-studio.css`. `record-thumbs.css` keeps
non-DB 32px defaults. Grid-card actions retain intrinsic width through the
workspace's direct-child `justify-self: start` constraint.
The shared danger token is #B91C1C after the earlier color failed contrast on
its actual hover tint. Database close restores the connected opener, or its
logical replacement after a topbar rerender, without stealing focus on tab reuse.

`npm run audit:db-css-ownership` records the import graph, scoped role owners,
retained-important reasons and removed-declaration mappings. Owner proof requires
the exact normalized selector, file, at-rule context and property (including
valid shorthand coverage); descendant/prefix matches are not replacements.
Narrowed rules split retained and excluded consumers rather than assigning an
unrelated intrinsic default. Required DB surface execution consumes per-file
Vitest results and rejects missing, zero-assertion, skipped or failed coverage.
The audit defaults to the merge-base with `origin/main`, so unrelated upstream
style changes are not attributed to this branch. An explicit positional revision
replays a historical comparison. A valid baseline missing a newly added sheet
contributes zero declarations; invalid revisions and unreadable existing blobs
remain errors. Historical comparisons spanning unrelated removals fail closed
until those removals have real ownership evidence.

## 전투 몬스터 표시 크기 (2026-09-06)

- 전투 몬스터 → 외형 → 그래픽의 `전투 표시 크기 (%)`는 기존 `sliderStepperField`를 사용한다. 숫자/슬라이더 testid는 `db-field-enemy-battle-scale-stepper` / `-slider`; 10~300%, 1% 단위, 기본 100%다.
- `EnemyRecord.battleScalePercent?`를 기존 `updateDatabaseRecord` → `updateEnemyRecord` 경로로 편집하므로 저장·감사 로그·병합 실행 취소를 공유한다. `upsert_enemy`의 동일 이름 정수 필드도 같은 정규화를 거친다. 기본값 100%는 정규화 시 필드를 생략한다. 다른 적·종족·능력치·이미지 매핑은 바꾸지 않는다.
- 이 값은 전투 이미지 크기만 바꾼다. 100%를 초과해 전투 화면을 넘는 요청은 종횡비를 유지하며 화면 안에 맞춰 표시하고, 저장된 요청 백분율은 바꾸지 않는다. 안내에도 이 상한을 명시한다. 작업실 미리보기는 소재 확인용 고정 크기를 유지하고, 그래픽 카드 안내대로 `시험 전투`에서 실제 크기를 확인한다. 맵 스프라이트 크기는 별도다.
- 회귀: `test/enemyBattleScale.test.ts`의 실제 폼 입력/포커스/독립 레코드 보존/프로젝트 저장→로드→저장 및 RM·몬스터 대치 렌더 계약. 브라우저에서는 1024/1280/1440 폭에서 외형 탭 숫자·슬라이더를 조작하고 시험 전투 진입·복귀·재열기를 확인한다.

## 전투 명령 배치 스튜디오 (2026-09-05)

- Custom CSS는 `databaseBattleCommandCss.ts`가 소유한다. 직업 배치 아래의 프로젝트 공통 편집기로 유효한 입력만 스타일 샘플에 즉시 반영하며 적용 시 history + store 변경을 남긴다. 잘못된 입력은 적용을 막고 마지막 유효 미리보기를 유지한다. 저장된 CSS 복원·다크 프리셋·기본 스킨 복귀를 제공한다.
- 미적용 초안과 마지막 유효 미리보기는 프로젝트 식별자·저장된 CSS가 같은 동안 재렌더링에 보존한다. 직업 배치 직후 예약된 DB 렌더나 미리보기 토글이 입력을 지우면 안 된다. 프로젝트 또는 저장된 CSS가 바뀌면 초안을 새 기준으로 초기화한다. 기본 스킨 복귀는 아직 적용하지 않은 프리셋도 지우며 이 경우 불필요한 history를 만들지 않는다.
- 공용 `restoreFocusAfterRerender`는 두 번의 DOM 교체를 계속 지원하되, 사용자가 다른 살아 있는 컨트롤로 포커스를 옮기면 남은 복귀 프레임을 중단한다. 새 복귀 요청은 이전 요청을 대체한다. 이전의 무조건 8프레임 복귀는 빠른 다음 클릭과 CSS 타이핑을 빼앗았다. `test/databaseFocusRestoration.test.ts`는 프레임 큐를 직접 진행해 타이밍 운에 기대지 않고 검증한다.
- 저장 필드는 `system.battleCommandCss`이며 `battleCommandCss.ts`의 제한된 선택자·시각 속성 문법을 편집기/출하 플레이어가 공유한다. 임의 선택자, URL, CSS 변수, at-rule은 허용하지 않는다. `test/e2e/battle-command-css.spec.ts`는 패키지 내보내기/재가져오기, `scripts/qa-battle-command-css.mjs`는 편집한 데이터를 별도 player.html 하네스로 넘겨 실제 메뉴·키보드 실행을 검증한다.
- `databaseUtilityRecordViews.ts`는 기존 카탈로그 CRUD/필드/testid와 지형·전투 화면을 유지한다. 새 `databaseBattleCommandStudio.ts`가 직업 선택, 네이티브 드래그 배치/재정렬, 버튼 대안, 상태 안내와 실제 메뉴 해석을 소유한다.
- 카탈로그 팔레트와 선택한 직업의 저장된 `battleCommands` 보드가 나란히 온다. 카탈로그 편집은 그 아래의 기존 입력 필드이며 카드의 `원본 편집`으로 바로 이동한다. 카탈로그 순서는 직업 메뉴 순서가 아니다. 배치는 id를 유지한 값 복사이며 기존 직업 덮어쓰기를 전역 편집으로 동기화하지 않는다.
- 직업 선택과 교체 가능 상황 체크는 편집기 상태뿐이다. `insertCatalogClassCommand` / `reorderEditableClassCommand`의 검증 모델을 사용하고 성공 때만 snapshot + labeled `store.update`를 남긴다. 제거는 남은 배열(기존 초과 행 포함)을 보존한다. 고정 `cmd_change`는 이동/제거 불가, 편집 가능한 행은 최대 6개다.
- 드래그는 인메모리 세션 토큰과 DataTransfer 값, 시작 당시 직업 배열/카탈로그를 현재 store와 비교한다. malformed/stale/cross-class/duplicate/full은 데이터·history 무변경이다. 삽입 위치에 텍스트와 indigo 선을 표시하며 추가/위/아래/제거 버튼, 포커스 복귀, polite live 상태가 같은 편집 경로를 제공한다.
- 리뷰 후 안전성 계약: 삭제된 선택 직업의 남은 버튼은 다른 직업으로 대체하지 않고 편집을 거부한 뒤 화면만 갱신한다. 기존 중복 ID 행은 직업 ID·메뉴 스냅샷·편집 행 인덱스로 구분하여 한 행만 삭제/이동하며, 모호한 ID 전용 이동은 거부한다. 카탈로그 새 ID는 모든 직업의 잔존 참조까지 예약한다. 포커스 복귀는 `data-testid` 문자열을 정확히 비교하므로 따옴표·역슬래시가 있는 저작 ID도 바꾸지 않는다.
- 미리보기는 `battleCommandsForActor`를 선택 직업으로 호출한다. 주인공이 없는 프로젝트는 저장되지 않는 임시 주인공으로 해석한다. 빈 배열 기본 행동, 포획 gate, 교체 상황을 그대로 반영하며 실행 버튼처럼 보이지 않는다. 몬스터 전용 메뉴/스킨 및 실제 동료 상태는 이 편집기 미리보기와 별도다. 스키마/전투 런타임은 변경하지 않는다.
- 집중 계약: `test/databaseBattleCommandStudio.test.ts`, `test/databaseBattleCommandsTab.test.ts`, `test/databaseBattleStudio.test.ts`, `test/e2e/battle-command-studio.spec.ts`. 브라우저는 실제 편집기, dragTo, 키보드, 제거/undo, 프로젝트 패키지 다운로드/재가져오기를 사용한다. evidence: `output/evidence/battle-command-studio-p1`.
- 리뷰 회귀: `databaseBattleCommandStaleClass.test.ts`, `databaseBattleCommandDuplicateRows.test.ts`, `databaseBattleCommandCatalogIds.test.ts`, `test/e2e/battle-command-focus.spec.ts`. 미리보기 표시 이름은 `battleCommandKindLabel`과 프로젝트 용어를 사용한다.

# Editor Database

## 캐릭터·얼굴 메타데이터 (2026-09-06)

- 2026-10-04: GIF 공방에서 사람이 남긴 캐릭터와 `desc.json`도 같은 공용 화면에 표시한다. `sharedCharacters.ts`가 기존 호스트 공용 SQLite `charset-actor-kept`에서 그림·라벨·의상/역할 속성을 공급한다. 새/기존 프로젝트는 기존 공용 기본 자산 설치 경로를 사용하며 열린 에디터는 새로고침한다. `shared_charset_actor_` 그림은 실제 0번 칸만 표시하고 빈 7칸을 후보로 만들지 않는다. 폐기하면 공용 검색에서 빠지며 기존 프로젝트의 그림과 수동 얼굴 연결은 보존한다. 상세 저장/복구 계약은 `charset-actor-harness.md`의 「남김 → 공용 캐릭터와 설명」.
- System 그룹의 `characterGraphics` (`db-tab-character-graphics`)는 `databaseCharacterGraphicsView.ts`가 기존 workspace/list/detail 빌더로 렌더한다. 주민 관계(`characters`)와 다른 면이며, 새로운 자산 목록이나 자동 이벤트 변경 경로를 만들지 않는다.
- `project/characterGraphics.ts`가 기존 `resourceProfiles`의 얼굴 `graphicAttributes`/`graphicNote`, charset `characterSlots`를 읽고 쓴다. 이름은 sprite의 경우 기존 `charsetLabels`, 얼굴은 profile.name이다. 두 그림의 종류·나이·성별·피부·머리·의상·역할은 독립이며 명확한 글자 특징만 기본 표시한다. 모호함은 빈칸이다.
- 상태는 pending/mapped/no-face, 품질은 unspecified/exact/approximate다. pending 이름 편집은 검토 완료가 아니며, no-face는 명시적인 값이다. 그림으로 얼굴을 지정해도 속성을 복사하지 않고 기존 맵·이벤트 명령을 바꾸지 않는다.
- `oprn-npc-face-mapping`(2026-09 개명 전 id `rpg-zzu-npc-face-mapping` 도 가져오기에서 받는다) v1 `mappings`를 가져올 때 label/note/status/faceResourceId를 보존하며 품질 생략은 unspecified다. v2는 같은 mappings에 attributes/quality를 더하고 `faces: [{resourceId,label,note,attributes}]`를 갖는다. 전체 검증 후 history + labeled store.update 한 번으로 적용한다. 중복·잘못된 칸·알 수 없는 얼굴은 전체 가져오기를 거부한다.
- QA 진입: 기존 데이터베이스 → 시스템 → 캐릭터·얼굴. `db-cg-view-sprites`/`db-cg-view-faces`, `db-cg-import-file`, `db-cg-import-json`/`db-cg-import-apply`, `db-cg-export`가 공개 표면이다. 이름·속성 필터와 얼굴 후보 필터는 독립된 editor-only 상태다. 테스트: `characterGraphics.test.ts`, `characterGraphicsLoad.test.ts`, `databaseCharacterGraphics.test.ts`; 브라우저/원격 저장 검증은 별도다.
## Character appearance catalog v1 (2026-09-06)

Database > Party > `캐릭터 외형` (`characterAppearances`,
`db-tab-character-appearances`) is a reusable visual catalog, separate from
resident relationships. `databaseAppearanceView.ts` and
`databaseAppearanceSlots.ts` reuse the Database Studio list/detail primitives.
Authors create partial records, edit name/appearance description, search without
replacing the input, duplicate independently, and see actor/page/portrait-command
usage before deletion. Deletion is blocked while referenced and never deletes
the underlying images.

Each set has a manually chosen walking charset/cell, a standalone face and an
optional bust. Slot upload opens the existing resource manager with the correct
kind; the author then selects the imported resource. Actor and event-page
selectors retain direct graphics and store only an appearance link. The existing
portrait command can select a shared set and explicit face/bust presentation.

Event-page selectors are upgraded to custom dropdown buttons. Before committing
an appearance change, focus that logical trigger so the event modal's existing
interaction snapshot can restore it after rerender. Keyboard QA must target
`data-custom-select-for`, not the hidden native select's testid. Choosing an
option through the actual popup is distinct from programmatic `selectOption`.

Event previews accept both canonical charset resource IDs and legacy texture
keys through the shared charset catalog lookup. Editor map markers also project
the appearance before resolving their texture/frame; reading only the stored
direct sprite would leave a linked NPC invisible in the event layer.
`characterAppearancePreview` and `editSceneRender` tests cover both boundaries;
`xvfb-run -a node scripts/qa/appearance-preview-proof.mjs` exercises the real UI.

AI generation is limited to face/bust candidates. Walking charsets are reference
inputs only, never generation outputs. The DB shows generated artwork before
explicit Apply; an occupied slot has an explicit replacement action. Existing
art remains until application, and a candidate image must load successfully
before Apply is enabled. The shared generation controller owns stale-target and
project-switch checks. World/lore coupling, expression variants and automatic
cutscene insertion are not part of v1.

Shared-catalog read line (2026-09-19): charset/face slots show one read-only line from the shared catalog (`sharedCharsetRow`/`sharedFaceRow` in `src/project/sharedCharacterFaceResolver.ts`) — label · status · quality · attributes. Bust has no shared concept and is excluded; uploaded/generated pictures state "no shared classification". Since 2026-10-01 the bust slot offers 「이 얼굴의 공용 흉상 연결」 when the face is a common expression cell — it writes `shared-<stem>-expressions-bust-base`, and dialogue emotions then swap to the matching expression bust (`src/assets/sharedPortraitAssets.ts`). A fourth slot, **full** (`CharacterAppearanceRecord.full`, kind `picture`), was added the same day with the same shared-link button; `resolveAppearancePortrait(…, "full")` falls back full → bust → face and changeFace accepts `presentation: "full"`. AI candidate generation stays face/bust only. No value sync, no writes, no schema change.

Tests: `characterAppearanceEditor`, `characterAppearanceLifecycle`,
`databaseTabIcons` and `databaseSidebarNav`. The supported viewport matrix is
1024x768, 1280x800 and 1440x900; list and detail have independent bounded scrolls.

## Concept navigation integration (2026-09-06)

PR617's concept-first Map rail is integrated with the current unified inventory
catalog: 34 primary destinations including Opening and Game Over, only
`scratchConcepts` and `tilesets` under Map,
catalog: 33 primary destinations after adding Character appearance v1, only `scratchConcepts` and `tilesets` under Map,
and `commonEvents` under System. Legacy Map destinations remain contextual/search
routes. `equipment` search finds the single `items` destination; programmatic
`equipment` navigation retains the catalog's equipment-filter/selection behavior.
The navigation setter applies tileset facets once without bypassing that alias.
The current multi-floor inn template remains authoritative (`dorm_bed_a`,
`upper_stair`); snapshot tests use those IDs, not the retired bedroom/stairs IDs.
Validation and replay boundaries are in `reports/pr617-621-integration.md`.

## Opening still media, sequence music and AI generation (2026-09-14)

### 새 프로젝트 기본 오프닝 (2026-09-21)

새 프로젝트는 createBlankProject에서 «왕국의 서막»(kingdom-day, dark-citadel,
hero-dawn과 스타터 타이틀 곡)을 받는다. createNewProjectSeed(packId, title)는
인터뷰의 제목을 meta와 마지막 타이틀 카드에 함께 넣는다. **store 로드 정규화에서
오프닝을 채우지 않는다.** undefined는 기존/삭제된 오프닝 없음이므로 저장·로드에 걸쳐
유지해야 한다. enabled:false도 그대로 유지한다. 9/21의 자동 채택 정규화기는
remove_opening 후 재로드 시 삭제를 되돌리는 결함으로 제거했다.

이미지 팩 생성·설치·검색·내보내기 계약과 실제 분량은 [opening-still-pack.md](opening-still-pack.md).
AI 컨텍스트는 intro 25번 줄에 이 사실을 명시한다.

오프닝·게임오버 탭의 그림 슬롯은 picker kind `image`(아이템 아이콘 457개) 대신 신설 kind **`still`** 을 쓴다:
배경화 → 타이틀 아트 → 생성·업로드 그림 순서가 앞에 오고, 기존 `image` 목록은 뒤에 통째로 남아 **아이콘으로
저작해 둔 저장본이 그대로 유효하다**. 버튼 배선은 그대로고 `databaseCinematicMediaFields`(표시)와
`databaseCinematicMediaActions`(검증·커밋)가 같은 kind 를 본다.

- `AI_GENERATABLE_PICKER_KINDS` 에 `still: "backdrop"` 을 넣어 그림 슬롯 피커에 기존 "AI로 만들기"(`aiImageGenerateField`)가
  그대로 붙는다. 생성물은 `kind:"backdrop"` 업로드 자산으로 등록되고 `still` 카탈로그에 바로 잡힐다.
- 「시퀀스 설정」 카드에 **배경음악**(`db-cinematic-music`, picker kind `music`, 비우기·파일 가져오기 허용)이 생겼다.
  슬롯 `{ kind: "music" }` 은 장면이 없어도 설정된다 — 시퀀스가 없으면 빈 시퀀스를 만들고 `musicResourceId` 를 쓴다.
- 업로드 경로: 음악 슬롯은 음성과 같은 `audio` 준비기를 타고, `still` 업로드는 종전처럼 `picture` 프로필로 등록된다.
- 브라우저 계약: `test/e2e/database-opening-still-media.spec.ts` — 배경화 후보 노출·선택 반영, AI 생성 필드 노출,
  배경음악 선택이 `system.opening.musicResourceId` 로 저장됨.

## Opening and game-over authoring (2026-09-06)

The System group contains dedicated `opening` / `gameOver` tabs, labelled
`오프닝` / `게임 오버` (`db-tab-opening` / `db-tab-game-over`). Their source of
truth is `project.system.opening` and `project.system.gameOver`, never
`project.database.system`. Existing System title controls retain their owner.

- `databaseCinematicView.ts` coordinates list/selection/revision and disposal.
  `databaseCinematicForms.ts`, `databaseCinematicMediaFields.ts` and
  `databaseCinematicControls.ts` build the focused form/picker primitives.
- `databaseCinematicActions.ts` owns ordinary scene edits and history;
  `databaseCinematicActionModel.ts` owns union/model helpers;
  `databaseCinematicMediaActions.ts` owns ticketed media selection/import.
  Reading an absent sequence does not materialize defaults. Settings are
  created only by edits; disabling does not delete authored scenes or media.
- New scenes are valid text records. Image/video intent remains view-local
  until a valid resource is ready. Kind conversion copies only common fields,
  so image motion cannot leak into a text/video record. The shared scene/time
  limits are enforced. Optional voice/background can be cleared; required
  media cannot become an empty or unknown reference.
- Every authored update has `scope: "system"` and a readable label. Typing uses
  coalesced history without replacing the active input; selection/navigation
  do not create history. A prepared upload adds asset, profile and consuming
  reference atomically, after project/scene/request freshness checks.
- The store emits over a live listener Set. An Actions controller mounted
  during a project-replacement notification tracks the project it already
  observes, rather than disposing itself on that same event. Later replacement,
  undo/import and explicit view disposal still invalidate old callbacks.
- `databaseCinematicPreview.ts` reuses `playCinematicSequence` and
  `createPlaySurface(resolvePlayResolution(project.system), "fit")`. Its Escape
  handler is installed before runtime keyboard capture, so Escape stops even
  an authored unskippable preview without also closing Database. Start reveals
  the stage; stop removes media, player surface and subscriptions and restores
  the active opener. Preview does not enable disabled settings in the project.
- `database.ts` and `databaseModal.ts` call `disposeDatabaseCinematicsIn` before
  leaving/evicting/closing cinematic views. These views are not reused from
  detached cache. Other Database caching stays unchanged.
- The same authored record is writable through the AI assistant since 2026-09-14:
  `get_opening` / `set_opening` / `remove_opening` / `list_opening_media`
  (`cinematicTools.ts`, system domain). `set_opening` replaces the whole scene list,
  so an AI edit and a tab edit land on one source of truth — `project.system.opening`.
  Media candidates come from the same catalog the tab's picker uses
  (`src/editor/resourceOptions.ts`). See `editor-ai-tools.md` (2026-09-14).
- Scoped editor presentation lives in `src/styles/database/system-studio.css`;
  runtime stage presentation still belongs to the existing runtime CSS closure.

Tests: `databaseCinematics.test.ts`, `cinematicMediaImport.test.ts`,
`databaseCinematicResources.test.ts`, and
`test/e2e/database-cinematics.spec.ts`. Real editor QA uses a fresh unique port,
`?blankProject=1&aiBridge=0`, and local-only fixtures. Serialization/reload is
tested through the real project codec and restored UI, not described as a
remote LegacyDb save. The blank-project `session-not-persisted` warning remains
an explicit fixture condition; other browser errors and remote write attempts
are failures. Optional disk mirroring can be disabled for QA with
`VITE_EDIT_ACTIVITY_DISK_MIRROR=0`, without disabling in-memory edit annotations.

## Cinematic media preparation boundary (2026-09-06)

`prepareCinematicUpload(file, kind, signal)` in `src/editor/cinematicMediaImport.ts`
prepares an `UploadedAsset` without accessing or mutating the current project.
Input image/video/audio maps to picture/movie/sound. Image limits and formats
come from the existing image decision helper; audio/movie rules come from
`mediaImportRuleFor`. GIF/WebP payloads are preserved, not canvas-flattened.
Native readers and decoders are abortable and have one bounded preparation
deadline. Audio/video must expose decodable first data; video also needs valid
dimensions but may report an as-yet-unknown positive duration. Preparation
never starts playback.

The authoring action owns cancellation, stale-project/scene/request checks after
await, and one labelled history transaction adding asset, resource profile and
scene reference. Do not call `importMediaResource` for this atomic workflow.
The shared picker adds `movie` beside existing `image`/`sound`: movie profiles
and uploads are deduplicated, and movie visuals are static labels, not images
or another video player. Shared cinematic preview remains the playback owner.

## System settings workspace (2026-09-06)

`databaseSystemView.ts` and `databaseSystemStudio.ts` own all ten mounted System
sections: overview, party, display, font, resources, startup, optin, time,
typechart and title. This contract supersedes the older nine-section/card-grid
notes below. The shared Database header/rail/footer/save path is unchanged.

- Section navigation is a nonshrinking horizontal reel. `.db-system-section-nav`
  belongs only to the container; buttons use `.db-system-section-button` and
  `aria-current`. `.db-system-sections` owns vertical scrolling; matrix content
  alone owns horizontal scrolling. `requestSystemSection` and host dataset state
  remain the navigation boundary; switching sections never creates history.
- Overview indexes every editing destination, with authored summaries and a
  searchable no-results/reset state. Progress state links are subordinate. Title
  summary and workbench both call `listTitleMenuOptions` with an explicit
  autosave-available preview context: resume is configured, not always available
  in a real runtime. Optional initial troop/day-end event are not warnings.
- Party is four numbered face/selector rows. Clearing a slot compacts the roster
  in existing order and synchronizes `session.partyActorIds`. Fonts keep registry
  IDs/default omission and pair each selector with its role specimen. Display
  keeps custom resolution, bounds and real partial-tile/small-map diagnostics.
- System-local resource presentation wraps the shared picker, shows catalog
  names and explicit clear/change controls, and preserves historic ID testids.
  Legacy title-resource changes still update the title background; background
  override changes do not delete `system.titleResourceId`.
- Action combat remains a support-ended legacy feature. Enabling applies the
  requested boolean after the stored config, and disabling preserves all details.
  Supported RM and Gen1 rule choices are distinct from the battle skin selector.
- Time disable now stores `enabled:false` rather than deleting its config. This
  intentionally fixes the audit's silent 31-day-to-28-day reset. The normalizer
  preserves disabled calendars; `resolveTimeSystem` returns undefined while off.
  The summary reports the configured day, not a running clock.
- Matrix clicks retain multiplier cycling and disabled diagonals. A visible
  direct-entry action and F2 open the same labelled 0–4 entry group; Enter applies,
  Escape cancels and restores focus. Clearing types still requires confirmation.
- Title keeps display/menu/audio/effects and all layer/parallax/audio hooks.
  Explicit `undefined` patches clear logo/sound keys; omitted patch keys preserve
  them. Coordinates remain legacy 320×240 proportions at any authored resolution.
  Nonstructural typing updates preview output without replacing the focused field;
  native numeric typing commits on change while shared steppers commit immediately.
- Each System numeric binding supplies a canonical-value reader. After a commit,
  the same input and its steppers reflect domain normalization and default
  omission; intermediate native digits remain untouched. Action/care fields reuse
  their existing project normalizers rather than inventing editor-only bounds.
- Title value refresh updates the live stage's ratio and proportional positions.
  Effect refresh and Replay share a stage controller that replaces only the
  stage, never Play/Stop/Replay controls. Replacing the whole preview during blur
  would swallow the pending pointer click. Do not infer refresh kind from the
  transient `document.activeElement`, which can be BODY during native change.
- CSS ownership is consolidated in `system-studio.css`. Only conflicting System
  declarations were removed from older sheets; outer modal/global controls and
  runtime preview styling remain shared. Responsive rows use available pane width.
- Regression coverage: `databaseSystemModern`, `databaseSystemSections`,
  `databaseSystemView`, `databaseSystemStudio`, related font/resolution/title tests,
  and `test/e2e/system-studio-visual.spec.ts`,
  `system-interaction-regressions.spec.ts`, `system-round2-regressions.spec.ts`.
  Evidence lives under
  `.omo/evidence/system-modern/`; frozen BEFORE is never overwritten. Firefox
  supplies real geometry/interactions/screenshots; no pixel visual approval or
  Lighthouse score is inferred on this host. Final gates and review are supervisor-owned.

## Graphic 칩 사용자 교정 29건 (2026-09-05)

- 정본은 `src/project/defaults/chipsetLabelCorrections.ts`. 사용자 교정 보고서
  `reports/chipset-label-confirmed-v2-2026-09-05.html`의 6종 칩셋·29개 칩을 반영한다.
  84번은 스테인드 글라스, 돌무더기는 캐기 전/후, 월드 317·347은 폭 1칸 벽이다.
- 여섯 `tileSemantics*.ts` 배열은 원래 판독 결과 위에 정본 교정을 적용한다.
  `scripts/build-tile-semantics.mts`도 같은 래퍼를 생성하므로 재생성으로 교정이 사라지지 않는다.
- 하네스의 메타 생성 단계와 검색 테이블이 같은 교정을 사용한다. 이름·태그·역할·설명·반복성만
  교정하며 맵 배치·통행성·레이어·그림은 바꾸지 않는다. 사용자 메타 및 이식한 칩은 보존한다.
- 던전 255·256·257은 광산 벽 하단 좌/중/우이며 반복성은 `fixed / center / fixed`.
  기본 구조는 가로 3칸·세로 2칸, 가운데 열을 가로 확장한다. 상단 칩 ID는 미확정이다.
- 실내와 던전 소용돌이는 각각 125→155→185→215 순서다. 기존
  `chipsetAnimation.ts`의 4fps 스트립이 이미 이 순서를 구현하므로 재생 로직은 변경하지 않는다.
- 검증: `test/chipsetLabelCorrections.test.ts`에서 검색 대상 ID·반복성·바닥 계약·재생 순서·
  사용자 메타 보존을 검사한다. UI와 프로젝트 저장명은 `tileMeta`를 소비한다.

## Custom equipment slot authoring (2026-09-05)

The disclosure's open state belongs to `InventoryCatalogSession.slotManagerOpen`. Record it synchronously on the native summary click so a queued modal refresh cannot close the controls just opened by the user. The session reset clears it; a regression in `test/databaseInventoryCatalog.test.ts` forces the refresh rather than relying on a timer.

The equipment header's native select consumes `equipmentSlots(project)` from `src/project/equipmentSlots.ts`, not a fixed five-slot list. Its inline `equipmentSlotManager` disclosure (`db-equipment-slot-manager`) lives in the scrolling body, not the fixed header. It adds and immediately selects a real generated-ID slot, renames labels without changing IDs, and disables removal with an explanation while referenced. Catalog mutators are `addEquipmentSlot(project, label)`, `renameEquipmentSlot(project, id, label)`, `equipmentSlotRemovalBlocker(project, id)`, and `removeEquipmentSlot(project, id)`; call them inside a labelled `store.update`, preceded by `recordProjectSnapshot` so each operation is atomic and undoable (`test/equipmentSlotHistory.test.ts`). Read labels with `equipmentSlotLabel(project, id)`. Stored shape and save compatibility are documented in `runtime-project-schema.md`.

Actor initial-equipment pickers, build previews, equipment gallery/filter labels, change-equipment event authoring/previews, and the runtime menu enumerate the same catalog. Adding boots is not an accessory label alias. Built-in hand IDs retain their engine meaning even when renamed; selecting a non-weapon slot clears the incompatible two-handed flag. Existing art, effects, skills, and permission fields are otherwise preserved. Tests: `test/customEquipmentSlots.test.ts`, `test/playerEquipmentRules.test.ts`, `test/databaseEquipmentInspector.test.ts`.

## 통합 아이템·장비 카탈로그 (2026-09-05)

- 파티 레일은 `아이템·장비` (`db-tab-items`) 하나다. `databaseInventoryCatalog.ts`가 두 저장 컬렉션을 합쳐 표시하며 ID/저장 구조/장착 규칙은 바꾸지 않는다. `equipment`는 `setDatabaseActiveTab`/`switchDatabaseActiveTab`/`openDatabaseModal`에서 받는 호환 경로이며 별도 버튼이 아니다. 해당 경로는 기존 `selectedRecordIdForSession("equipment")`를 유지하고 장비 필터로 선택 항목을 연다. 새 모달의 세션 초기화도 이 대상 선택을 보존한다.
- 검색 입력(`db-catalog-search`)은 두 컬렉션의 이름/ID를 함께 검색한다. 전체/아이템/장비 버튼(`db-catalog-filter-*`)과 종류·부위 선택(`db-catalog-subtype`)은 목록만 갱신한다. 검색 DOM/초점과 상세 폼은 유지되며 선택이 필터 밖으로 나가면 `db-catalog-reveal-selection`이 필터 해제 후 그 행을 보여준다. 카운트의 `data-visible-count`와 `data-total-count`는 실제 렌더 목록과 전체 카탈로그 수다. 종류 버튼의 수는 현재 검색에 해당하는 종류별 수다.
- `db-catalog-add-items`/`db-catalog-add-equipment`는 생성 대상을 명시하고, 복제·AI 아이템 생성 뒤에는 새 항목이 보이도록 필터를 해제한다. 삭제는 기존 참조 검사/2회 확인을 그대로 쓰며 컬렉션 전환 뒤에는 새 확인이 필요하다. 갤러리/목록 선택은 기존 items 뷰 환경설정을 공유한다. 상세는 기존 아이템/장비 폼이 계속 소유하며 슬롯 관련 UI/런타임 권위자는 바뀌지 않는다.
- 셸/행/툴바는 `databaseWorkspace` 프리미티브를 쓴다. `modern/equipment-items.css`의 카탈로그 영역이 260px 목록과 유동 상세를 배치한다. 목록 스크롤은 `.db-catalog-rows`, 상세 스크롤은 기존 `.db-ws-detail-body` 하나씩이며 모달 기하는 `sidebar.css` 그대로다. 1024/1280/1440 Firefox QA는 가로 넘침 0과 창 기하 불변을 검사한다.
- 검증: `test/databaseInventoryCatalog.test.ts`, 기존 RecordPartialRender/ItemEquipmentAuthoringTrust/AiBar 테스트. 실제 화면 재현은 `CATALOG_QA_URL=http://127.0.0.1:<port> PLAYWRIGHT_MODULE=<playwright-core index.mjs> node scripts/qa/inventory-catalog.mjs`. 증거는 `output/evidence/inventory-catalog/`에 있다. 옛 `db-tab-equipment` 테스트는 통합 레일→장비 필터→행 선택으로 바뀌었다.

## 아이템·장비 저작 신뢰성 (2026-09-05)

- `src/project/itemUsage.ts`의 `activeItemEffects`가 저장값에서 현재 종류의 실행 효과를 투영한다. 종류 변경은 이전 값을 보관하며, 메뉴·전투·편집기 효과 요약은 이 투영을 사용한다. 책→약 변경 뒤 숨은 스킬 습득, 성장 보정·회복의 다른 종류 누출을 금지한다. `stateEffects`는 약 또는 발동 스킬 없는 특수 아이템에서 지원한다. 기본 상태 부여 특수 아이템과 최신 main의 필드 상태 부여·행 편집기·전투 연출·돌봄 편집을 유지한다. 돌봄은 특수 종류에서 켜며, 설정 시 필드 사용으로 전환한다.
- 아이템의 `db-field-item-occasion` 하나가 occasion/occasionField/occasionBattle/onlyUsableInMenu를 함께 쓴다. `db-field-item-only-menu` 및 스위치 전용 이중 토글은 제거했다. 소모 방식(`db-field-item-consumption-limit`)은 매회 1개·한 개당 2~5회·소모하지 않음이다. 기존 noLimit 저장값은 매회 1개로 표시하며 스키마는 바꾸지 않는다.
- 신규 아이템 종류에는 장비형이 없다. 기존 장비형 행만 유지해 비착용 물품임을 안내한다. 실제 장비로 자동 연결·변환하지 않는다. 아이템의 발동/습득 스킬과 장비의 사용 시 스킬만 편집하며 중복 `skillId` 입력은 제거했다. 특수 아이템의 미지원 배우·직업 제한, 저장 전용 사용 메시지도 새 입력으로 제공하지 않는다.
- 아이템 요약은 대상·포획·상태·소모·스킬 변경 때 동기 갱신한다. 사용 제한은 필드 대상/전투 사용자 차이, 비어 있으면 제한 없음, 배우와 직업은 AND라는 설명을 제공한다. 장비 허용은 OR 및 직업 쪽 권한을 포함한 최종 주인공 목록을 보여준다.
- 장비 전투 효과 컨트롤은 doubleAttack/attackAll/fixedEquipment만 제공한다. 6개 미지원 플래그가 저장되어 있으면 이전 설정 안내에 이름을 보여주고 실제 효과 요약에서는 제외한다. 공격 속성은 단일 선택이며 기존 복수값은 첫 값만 적용됨을 안내한다. 상태 방어 `inflict`는 신규 선택에서 제외하고, 기존 값은 명시적 저항 전환 버튼으로 수리한다. 다른 장비의 저항을 전역으로 꺼서는 안 된다.
- 요약·착용 비교·외형·권한·고급 효과는 공용 `sectionCard`의 접기 기능으로 공간을 줄인다. 장비 능력치를 기본 카드보다 먼저 배치한다. 농사 도구는 일반 물품 또는 기존 도구에, 포획은 특수 아이템에, 액션 스윙은 액션 전투가 켜진 프로젝트의 무기에만 노출한다. 외형의 적용 범위는 해당 카드에서 설명한다. 상세 헤더의 아이콘을 누르면 아이콘 피커가 열리고, 아이콘·이미지 피커는 선택한 이름을 보여 주며 그림을 격자로 고른다. 현재 인벤토리·장비 메뉴·상점은 iconResourceId → imageResourceId 우선순위로 표시하므로 지원 메타데이터도 runtime으로 표시한다. 성장 씨앗은 ‘능력치 성장’, 스위치 효과는 ‘장치 켜기 (ON)’으로 구분한다.
- **로드 시 기본 레코드 재주입 금지:** `ensureDefaultDatabaseIconResources`는 기존 행의 레거시/누락 아이콘만 보정한다. 빠진 아이템·장비·스킬·상태를 추가하지 않는다. 전체 기본 카탈로그는 새 프로젝트 생성 때만 들어간다. 삭제한 항목이 로드 후 다시 살아나는 것을 막는 계약이며 아래 과거 backfill 기록보다 우선한다.
- 검증: `test/itemEquipmentAuthoringTrust.test.ts` (UI→직렬화→메뉴 사용, 삭제 후 로드 정규화, 효과·스킬·소모·권한 표면), 기존 `itemRuntimeUsability`/`equipmentCatalogRuntimeAxes` (기본 카탈로그 실제 실행), `test/e2e/items-equipment-trust.spec.ts` (Firefox 1024/1280/1440 화면과 UI 변경 결과).

## 전투 몬스터와 포획·성장 종족 (Phase 1)

- `createSampleAdventureProject`는 `defaults/fixtures/dew-village-demo.json`을 직접 복제한다. 기본 DB만 고치면 데모의 외형은 바뀌지 않는다. 데모의 리프링·스파킷·아쿠아링도 전용 그림/색조 0을 사용하고, 이름이 `킹슬라임`인 데모 종족은 왕관 그림을 사용한다. 빈 프로젝트의 `초원 슬라임`과는 이름·저작 의도가 다르다. 회귀는 `test/dbImageMatching.test.ts`의 실제 데모 진입점 검사다.
- 표시 탭은 `전투 몬스터` / `포획·성장 종족`이다. 기존 `enemies` / `monsterSpecies` ID와 testid는 유지한다. 전투 몬스터는 출현 전투의 고정 능력치·행동·보상, 종족은 포획·성장·종족값을 소유한다. 연결은 능력치·외형의 지속 상속이 아니다.
- 관계 표시는 `monsterSpeciesForEnemy`를 따른다. 명시적 연결, 미설정, 누락된 ID, 같은 ID 호환 연결을 구분하며 렌더링으로 저장값을 쓰지 않는다. `연결된 종족 열기`는 실제 연결을 연다.
- 미연결은 `이 몬스터로 종족 만들기`, 연결됨은 `새 종족으로 연결 교체`다. 생성은 이름·외형·고정 능력치를 새 종족의 이름·외형·종족값으로 한 번 복사한다. 같은 레벨의 전투 수치가 같다는 뜻은 아니다. 교체 확인은 기존 종족을 보존하고 새 종족 생성과 링크 교체를 한 번에 실행 취소한다. 취소는 데이터를 바꾸지 않는다.
- 외형 차이는 리소스·색조·투명·비행 네 필드를 비교한다. `종족 외형을 이 몬스터로 복사`는 이 네 필드만 한 번 덮어쓰며 능력치와 종족 원본을 바꾸지 않는다.
- 종족 상단 준비 상태는 프로젝트 전체 집계다. 명시적 연결 수와 선택 종족 연결 목록은 같은 ID 호환 연결을 제외한다고 밝힌다. 상단 연결/드롭 액션은 `전투 몬스터 탭 열기`, 출현 액션은 `첫 출현 맵 선택`, 시스템 액션은 `시스템 포획 설정 열기`로 실제 목적지를 표시한다. 선택 종족 목록의 `전투 몬스터 열기`는 해당 레코드를 선택한다.
- 안내는 기존 hero/section hint/버튼에 배치한다. Studio 토큰·모달 크기·스크롤·키보드 계약은 그대로다. 관계 회귀는 `test/databaseEnemyRelationship.test.ts`; 문구 자체를 새 테스트로 고정하지 않는다.

### 종족 검색과 관련 레코드 노출 (Phase 2)

- `databaseMonsterSpeciesView.ts`의 검색은 카탈로그와 같은 부분 갱신 패턴이다. 입력 즉시 목록·개수·선택 안내만 갱신하며 검색 입력 노드/포커스/캐럿과 현재 인스펙터의 드래프트·스킬 행 신원·미리보기 레벨·스크롤은 그대로 둔다. 검색 결과가 없어도 선택 ID를 바꾸지 않는다.
- 목록 필터 슬롯의 `db-monster-species-selection-notice`는 선택 종족이 검색 결과 밖임을 표시한다. `db-monster-species-reveal-selection`은 검색을 지우고 활성 행을 스크롤로 노출한다. 무결과 상태의 `db-monster-species-empty-clear`도 같은 복구 경로를 쓰며, 사라진 버튼 대신 유지된 검색 입력으로 포커스를 돌린다.
- `setSelectedMonsterSpeciesId(id, { reveal: true })`는 종족 검색을 지우고 다음 렌더에서 선택 행을 노출한다. 전투 몬스터 → 종족, 진화 역참조, 종족 추가/복제, 몬스터에서 종족 생성이 이 경로를 쓴다. 진화 역참조는 선택+토스트만 내지 않고 기존 `rerender`를 즉시 호출한다.
- 종족 목록의 스크롤은 뷰 호스트별 `WeakMap`에 보관한다. 모달의 지연 store 갱신이 목록을 다시 만들어도 마지막 위치를 복원하고, 명시적 노출은 그 위치보다 우선한 뒤 즉시 새 위치를 기록한다(비동기 scroll 이벤트에 의존하지 않는다). 노출 요청 자체는 여전히 일회성이며 사용자가 이후 스크롤한 위치(0 포함)를 존중한다. 교체되어 분리된 목록의 늦은 이벤트는 무시하고 새 모달 호스트로 위치를 넘기지 않는다. 실제 모달/스토어 구독과 101종족 회귀: `test/databaseSpeciesModalRefresh.test.ts`; B1 RED/GREEN 근거: `output/evidence/monster-concepts/b1/fix.md`.
- 실행 취소 등으로 선택 ID가 사라져 유효한 첫 종족으로 대체되면 기존 일회성 노출 경로를 요청한다. 검색을 지우고 이전 깊은 스크롤보다 대체 행 노출을 우선하며, 결과 위치는 즉시 저장한다. 유효한 선택의 일반 갱신은 다시 노출하지 않는다. 세 생성 경로의 실제 모달 갱신 후 대체 선택 가시성 회귀와 RED/GREEN: `output/evidence/monster-concepts/r1/fix.md`.
- 종족 → 전투 몬스터는 `setSelectedRecordId("enemies", id, { reveal: true })`와 기존 `switchDatabaseActiveTab`을 쓴다. 세션의 일회성 노출 요청은 대상 검색을 비우고 `databaseRecordViews.ts`에서 소비한다. 전투 몬스터 목록/갤러리는 가상화를 유지한 채 `databaseListVirtualizer.ts`의 `scrollToIndex`로 대상 윈도우를 만든 뒤 네이티브 스크롤로 노출한다. `enemies.part-2.css`는 바깥 스크롤 컨테이너를 block, 안쪽 행 호스트를 grid로 두어 스페이서 사이의 추가 gap을 없앤다. 실제 행 border-box 높이 + 안쪽 grid gap이 윈도우·스페이서·노출의 공통 pitch이며, 패딩은 한 번만 계산한다. 갤러리 열 수를 먼저 적용한 뒤 높이를 재측정하고 새 전체 높이로 스크롤을 clamp하므로 리사이즈 때 빈 윈도우가 되지 않는다. 일반 선택·탭 복귀의 검색/스크롤 복원은 바꾸지 않는다. 기하 회귀: `test/databaseListGeometry.test.ts`; 브라우저 RED와 수정 결과: `output/evidence/monster-concepts/p2/verification.md`, `reveal-fix.md`.
- 탐색은 프로젝트 쓰기나 실행 취소 항목을 만들지 않는다. Phase 1의 관계 해석·확인·복사·참조 삭제 가드·원자적 실행 취소와 준비 상태/선택 종족 목적지 문구는 유지한다. 회귀 테스트: `test/databaseSpeciesSearchNavigation.test.ts` (happy-dom, 실제 패널/스토어, DOM 변경 구독과 제한 시간; 고정 sleep 없음). 브라우저 검증은 동일한 세 데스크톱 크기로 수행한다.

## 몬스터 작업실 — 미리보기 · 행동 · 속성 (2026-09-05)

- `databaseEnemyRecordView.ts`는 기존 11개 필드 패널과 `updateDatabaseRecord` 경로를 유지하고,
  `databaseEnemyStudio.ts`가 중앙 미리보기·공격 패턴·접힌 연결 데이터와 우측 `기본 / 외형 / 전투 / 보상`
  속성 탭을 구성한다. 예전 멀티컬럼 카드 스택은 `modern/enemies.css`에서 제거했다.
- 슬롯·검색·선택·복제·삭제는 `databaseRecordViews.ts` 소유다. 목록 폭은 220px, 속성 폭은 340px.
  상세 영역이 650px 이하인 도크/작은 화면에서는 하나의 세로 스크롤로 전환한다. 모달 창 기하는
  여전히 `sidebar.css`만 소유한다. 다른 DB 탭과 전역 맵/데이터 작업 공간 전환은 이번 슬라이스 범위 밖이다.
- 대기 애니메이션은 기존 `battlerIdleAnimations` 카탈로그의 프레임 수·시간을 그대로 쓰는 CSS 스트립이다.
  등록되지 않았거나 스트립 로드가 실패하면 기존 크로마키 정적 그림이 남는다. 동작 줄이기 환경에서는
  일시 정지로 시작한다. 별도 타이머·전역 리스너는 없다.
  연관 적 그룹에 지정된 배경을 표시하며, 배경이 없으면 중립 스테이지를 쓴다.
- 편집 이벤트가 버블링할 때 현재 store에서 헤더·능력치·미리보기·연결 데이터를 갱신한다.
  입력 컨트롤은 재생성하지 않는다. 이름 변경은 목록 행에도 전파된다. 속성 탭과 미리보기 일시 정지는 레코드별
  `databaseRecordViewSession`에 기억되며 전체 세션 리셋에서 지운다. 방향키/Home/End로 이동한다.
- 연결 데이터는 적 그룹·드롭 아이템·스킬을 동일 DB 창에서 선택해 연다. 진영 설명은 기본 속성의
  `진영 관계와 설정` disclosure 안에 있다. 종족 안내를 창 전체 배너로 중복하지 않는다.
- `시험 전투` → `testPlayModal.openEnemyBattleTestModal` → `prepareEnemyBattleTest`는 현재 프로젝트를
  복제한 뒤 테스트 전용 1인 적 그룹을 넣고 기존 전투 엔진/세션 경로를 실행한다. 적 그룹은 store와
  원격 DB에 들어가지 않는다. authored troop이 없어도 시험 가능하고, 같은 ID가 있으면 충돌을 피한다.
  이 중첩 시험 창은 modalStack에 등록해 Escape가 DB 대신 시험 창만 닫고, 닫으면 시험 버튼에
  포커스를 복귀한다. 준비 중 닫힌 창에는 뒤늦게 전투 컨트롤러를 마운트하지 않는다.
- 검증: `test/enemyBattleTest.test.ts`(실제 엔진 HP 반영·원본 격리),
  `test/e2e/database-enemy-studio.spec.ts`(1680/1280/1024 hit-test·키보드·선택·연결·시험 복귀),
  기존 EnemySpecies/Faction/ResourceSlot, RecordPartialRender, PanelGridClasses 계약.
### Monster action input trust (Phase 1, 2026-09-05)

- `databaseEnemyRecordView.ts` binds the skill field to the selected original-array action index, not priority-sorted display position. Click, focus, Enter/Space, double-click and context-menu entry select that target; selection preserves row nodes and exposes `aria-pressed`. Row rendering and dialog entry read current store actions. Skill changes merge only `skillId` into the live selected action through `updateDatabaseRecord`.
- Add/duplicate select the new row; toolbar deletion selects the preceding original row (or the first remaining row). With no actions, skill/duplicate/delete are disabled and Add remains available. An obsolete skill picker cannot recreate a removed action list.
- Inline skill focus restoration is local to the same enemy/action and only repairs focus lost when its owned picker is detached. Keyboard, pointer or external focus navigation cancels it permanently; pending frames cannot steal focus from another control, dialog or record. Do not use the unconditional shared restoration helper for this picker.
- `databaseEnemyActionDialog.ts` keeps inactive turn inputs disabled while retaining their raw drafts, including empty values. OK requires integer priority 1–100 and, only for turn conditions, integer start/interval 1–999, matching `databaseEnemyTroopRecordModel.ts`. Invalid active fields show associated inline errors, focus the first invalid input, and prevent mutation/closure; Cancel discards the draft.
- Basic/skill switching preserves mounted radio/select nodes and the selected skill draft; basic confirmation still writes the empty-skill sentinel. Named ON/OFF controls disable unused selectors/pickers, retain the chosen switch across use toggles, and open the picker at its current selection. Confirmation retains the existing action replacement/normalization path; runtime, shared controls and CSS are unchanged.
- Focused contracts: `test/databaseEnemySelectionTrust.test.ts` and `test/databaseEnemyActionDialogTrust.test.ts`; browser workflows: `test/e2e/database-enemy-selection-trust.spec.ts` and `test/e2e/database-enemy-action-trust.spec.ts`.

### Monster numeric caption activation (Phase 2, 2026-09-05)

- `databaseControls.numberField` uses a caption-only native `label[for]` targeting the numeric input. Clicking the visible maximum HP caption activates that input without changing its value or committing a decrement. Stepper buttons remain outside the label and keep their existing input-event callbacks.
- `sliderStepperField` targets its numeric input with the same native caption relationship and names its range through `aria-labelledby`; the unit suffix is not part of either input name. Module-local sequential DOM ids keep duplicate controls independently associated even when constructed before mounting.
- Keep the two `.db-field > span` columns, `.db-number-stepper` child order, classes and testids. Simple text/select fields retain their implicit-label helper; no CSS, store mutation path, runtime or content change belongs to this correction.
- Regression coverage: `test/databaseNumericLabelTrust.test.ts`, `test/databaseControlsNumberField.test.ts` and `test/databaseModernControls.test.ts`. Happy DOM proves native control association and non-mutating activation, not native label-focus defaults or geometry; browser verification must check numeric focus, numeric/range accessible names and unchanged studio layout.

### Monster nested dialog focus (Phase 2, 2026-09-05)

- `databaseEnemyRecordSupport.openDialog` wraps only the live Tab/Shift+Tab boundaries of the top `modalStack` layer; interior Tab remains native. The switch picker keeps its own focus and Escape routing. Hidden, disabled and negative-tabindex controls are excluded from the boundary list.
- Action and graphic closure resolves the live opener within the same enemy workbench. Actions use their original-array row testid (including context-menu entry), not the priority-sorted display position; a removed row falls back to Add action. The workbench's `data-enemy-id` prevents restoration into another record.
- After closure, a mutation observer repairs only detachment of the owned return target during a subsequent render. Keyboard, pointer or external focus navigation disposes it permanently; there is no frame-based focus loop. Regression coverage: `test/databaseEnemyDialogFocus.test.ts` with the real record form/store and event-driven focus/mutation assertions.

## 몬스터 그룹 저작 신뢰성 (2026-09-05)

대상은 몬스터·몬스터 종족·적 그룹·진영 네 탭이다.

- 종족의 레벨별 스킬은 마운트된 행 객체를 편집한다. 저장 정규화가 레벨순 정렬을 해도 `input` 뒤 `change`/스킬 교체/삭제가 다른 행을 가리키지 않는다. 외부 수정·undo로 목록이 바뀌면 오래된 초안을 덮어쓰지 않고 다시 표시한다. 타입 상성표에서 삭제된 타입도 선택 칩으로 남아 해제할 수 있다.
- 종족값은 Lv1의 실제 능력치가 아니다. `monsterBattleStatsForSpecies`를 사용하는 레벨별 미리보기(개체값 0)를 제공하며 종족값 수정도 즉시 반영한다. 포획 계수와 실제 성공 확률을 구분한다.
- 몬스터 상태 유효도는 미지정(100%)과 명시 C(60%)를 구분하고 미지정으로 되돌릴 수 있다. 속성은 실제 피해 배율을 표시한다. 액션 전투의 생략된 공격 대기시간/탄속은 런타임 기본값 1200ms/6타일·초로 표시한다. 포획 기능이 꺼진 프로젝트는 안내 상태다.
- 적 그룹 페이지 ID는 `genId`로 생성한다. `runOnce:false`를 보존하며 빈도를 바꿀 때 개별 override를 초기화한다. 첫 조건 교체는 추가 AND 조건을 보존한다. 스위치 ON/OFF, 변수 비교 연산, 그룹 내 적 슬롯별 HP 조건을 편집할 수 있다. HP 범위의 양 끝은 저장값과 표시값을 함께 조정한다.
- `activeSlots`의 0 입력은 시스템 기본값 상속이다. 추가 이벤트가 없어도 기본 EXP/돈/드롭 보상은 동작한다. 밸런스 추정은 10회 표본임을 표시한다.
- 적 그룹 워크벤치의 영역 배치는 `modern/troops.css`가 소유한다. 상세 패널 폭 760px 이하에서 단일 열로 전환한다. 뷰포트 폭만으로 판단하면 목록·내비게이션 레일 때문에 1024px에서 입력이 겹친다.
- 진영은 기본·상속 소속을 포함한 몬스터/필드 스폰 사용처 이동, 상대 진영 검색, 초기 저작 관계에서 N회 처치한 결과 미리보기를 제공한다. 평판 설정은 프로젝트 전체 규칙이다. 미리보기는 `applyPlayerKillReputation`/`effectiveFactionStance`를 사용하며 프로젝트·런타임 세션을 수정하지 않는다.

회귀: `test/monsterBattleAuthoringContract.test.ts`, `test/databaseMonsterEventEditing.test.ts`, 기존 종족/몬스터/진영 뷰 테스트. 브라우저 재현: `AUDIT_BASE=http://127.0.0.1:<port>/ node scripts/qa/monster-database.mjs` (임시 프로젝트, 원격 저장 없음).


## Database Studio chrome (2026-08-24)

Party record tabs use the final section of `studio-v2.css`: actors, classes, skills, items, and equipment have an inset list, an indigo active rail, stronger headers and names, and neutral summaries. The local `--db-record-pane-bg` override is consumed by the existing theme declaration. The compact actor inspector uses a zero minimum grid track so it remains inside the fixed modal at 1024px.

- The Database modal is a **neutral cool studio**, not the editor cream shell and not RM2k3. Tokens live in `src/styles/database/studio-theme.css` (`--db-studio-*`), scoped under `.database-modal-backdrop` and imported last among database CSS in `src/styles/index.css`. Do not put studio hex in `tokens.css`.
- Nav is a **labeled 220px rail** (group headers visible) that collapses to 56px only below 800px. Tab `textContent` / `db-tab-*` testids stay. Each tab button's first child is an inline `svg.db-tab-icon` from `databaseTabIcons.ts`; CSS owns only its size and `color`.
- Record lists are **name-first** with muted `#n` meta. Do not put `0001:` back in `databaseRecordViews.ts` / utility / common-event rows. Unused switch/variable reserve rows are not rendered.
- Footer: `지금 저장` (`database-footer-apply`) is the filled primary; `닫기` (`database-footer-ok`) is ghost. Record edits are already in the store, so footer 닫기 and the header X close immediately and keep them. A world-codex card draft is not in the store yet: the first 닫기/X shows Save / Discard / Keep, and a second press commits the draft and closes (a rejected commit stays open). Escape and the backdrop still ask before closing any session change. The prompt grows the footer instead of sharing the 52px button row.
- Keep G006 in-modal `switchDatabaseActiveTab`, gallery+list toggles, and every `db-field-*` / `db-record-row-*` / `db-record-card-*` / `db-system-nav-*` / `db-type-chart-*` testid.
- **Modal geometry has exactly one owner (2026-08-27):** `.database-modal-backdrop .database-modal-window:has(.db-shared-workspace)` in `src/styles/database/sidebar.css` declares the studio frame's `width` / `height` / `max-*` / `min-*`. No tab-content selector (`:has(.oprn-record-*)`, `:has(.db-elements-classic)`, `:has(:is(...workspace...))`) may declare window geometry again — that pattern is what made the modal jump 1628 → 1584 → 1530 px between sidebar tabs (98px width, 49px horizontal shift, measured at 1920x1200). `test/e2e/database-modal-size-invariant.spec.ts` walks every `DATABASE_TAB_SPECS` entry at 1920x1200 / 1280x800 / 1024x768 and fails on **any** non-zero delta in the window's `width` / `height` / `left` / `top`. `.maximized`, `.floating`, `.is-docked`, `.village-info-window`, and `.ai-settings-window` are separate modes and keep their own geometry.
- **Floating/maximized는 앵커 두 겹을 인라인으로 이긴다 (2026-09-18 실측):** `ai-bar.css`의 `.database-modal-backdrop .database-modal-window { position: relative }`(0,2,0, `tabs-a.part-1.css`보다 나중에 import)가 `.floating { position: fixed }`(0,2,0)와 동점이라 소스 순서로 이겼고, `.maximized`(0,2,0)는 `sidebar.css`의 지오메트리 단일 소유자(`:has(.db-shared-workspace)`, (0,3,0))에 졌다. 증상: 드래그 후 `position: relative`로 남아 커서를 못 따라오고(left/top만 20px 이동), 최대화는 left/top만 8px로 가고 크기 그대로(2000×1200 실측: 1628×900 유지). 선택자 특이성 경쟁은 CSS 게이트 R2에 새 지문을 남기므로(기존 `.floating`/`.maximized`도 기준선 실패), `startModalDrag`·`toggleMaximizedDatabaseModal`·`applyDockMode`에서 인라인 스타일(`position/left/top/width/height`, 최대화는 `max-*` 포함)로 이기고 해제 시 비운다. 또한 헤더 버튼 안 SVG 아이콘에서 시작한 mousedown이 드래그를 유발했으므로 `startModalDrag`는 `closest("button")`으로 거른다.
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

## 프로젝트 위키 출처와 수동 편집 (2026-09-07)

설정집의 위키 문서는 `world-wiki-provenance`에 선언/지식/진행 기록과
명시/추론/실제 적용 근거를 표시한다. 출처 원문은 접힌 `world-wiki-sources`에서
읽으며 HTML로 실행하지 않는다. 대체된 문서는 이력을 남기고 현재 지침에서 제외한다.
수동 편집은 출처를 추가하며 제목/요약/본문 변경 시 낡은 자동 combatMode를 해제한다.
실제 적용 기록의 수동 수정은 원본 증거를 바꾸지 않고 별도 지식 메모를 만든다.
대체 이력에 연결된 문서는 삭제를 거부해 이전 지침이 되살아나지 않게 한다.
열린 초안은 문서 지문으로 경합을 검사하며 충돌 시 사용자 입력을 보존한다.
테스트: `projectWikiCodex.test.ts`, `projectWikiManualEdit.test.ts`.
전체 AI 연결과 지속성은 [프로젝트 위키](project-wiki.md)를 따른다.

## 세계관 그룹 — 세계 개요 · 설정집 (2026-09-18)

- **세계 개요 v2:** 본문이 AI 미터+hero stat+이름/전제+뼈대+법칙 2열+본문 순서다. 뼈대(톤·시대·기술 천장·없는 것)와 법칙은 속성 사이드바가 아니라 본문 카드에 둔다 — 272px 사이드바에선 법칙 2열이 1열 덫에 걸린다. 본문 타이핑은 미터·힌트·stat 값을 다시 렌더 없이 갱신한다. testid: `db-world-canon-ai-meter`, `db-world-canon-hero-stats`, `db-world-canon-hero-stat-body`(값 span), `db-world-canon-frame`, `db-world-canon-laws`. CSS: `world-canon-meter`, `world-canon-law-grid`(799px 이하 1열), 카드 헤드 래핑.
- **이름 카드·미터:** 이름 카드는 `이름과 한 줄` 제목을 단다(카드 순서의 랜드마크). 미터 텍스트는 `role=status`, 막대는 `role=progressbar`(0/600/현재값, 타이핑마다 `aria-valuenow` 갱신).
- **잘림 신호:** 본문이 발췌 상한을 넘으면 hero stat이 warn 톤으로 `뒤 N자 잘림`을 표시한다. 값은 하드코딩이 아니라 **조수가 실제로 보내는 상한과 같은 상수**(`WORLD_CANON_BODY_EXCERPT_CHARS`)를 읽는다 — 문구가 어긋나면 사용자가 잘못된 길이에 맞춰 세계관을 쓴다. 2026-09-20 에 600 → 20,000자로 올렸다(사용자 요청: "세계관이 틀리면 안 된다"). 증거 `verify-shots/world-lore-v2/trunc/`.
- **폴리시 (2026-09-18):** Studio v2 문법 안에서만 — 새 토큰 없음. 미터 바 8px+accent-soft 표면, 법칙 카드 canvas 표면, 선택 카드 좌측 accent 레일, 위키 헤더 hairline+12px 리듬, 톤 칩 on 700. 카드 헤드 래핑은 같은 `database` 레이어라 파일 순서가 아니라 특이성으로 이긴다(풀 체인 0-5-0). 증거 `verify-shots/world-lore-v2/polish2/`(넘침 0, 에러는 자동저장 기준선 17과 동일).
- **폴리시 2 (2026-09-18):** `database` 레이어라 `map(editor)` 레이어 동급 규칙을 특이성과 무관하게 이긴다. lint 경고·에러 블록 탈포화(루트 muted + Studio strong/danger), 칩·카드 호버 피드백, 포커스 링. 증거 `verify-shots/world-lore-v2/p2/`.
- **구 레이아웃 기록 (2026-09-06):** `worldCanon`의 표시 이름은 「세계 개요」이며 stable tab/field testid는 유지한다.
- 설정집 기본 목록은 256px 행 목록이다. 인물·장소·세력·사건·아이템·개념·제작 노트를 따로 탐색하고, 같은 항목/선택 경로로 갤러리 보기를 전환한다. 예전 `place-faction`/`item-concept` URL은 읽을 수 있지만 새 UI는 분리된 분류를 사용한다. 전체 프로젝트 검사는 목록 아래의 별도 disclosure에 두며 빈 문서 앞에 경고 개수를 쌓지 않는다.
- 읽기 선택이 검색/분류 밖으로 나가면 상세를 비운다. 편집 중 초안은 보존하고 필터 밖이라는 표시를 제공한다. 관계 이동은 대상 종류로 분류를 전환하고 검색을 지운다. 새 항목·종류 변경을 확정하면 결과가 보이는 분류로 이동한다.
- `world-panel.css`의 **unlayered 문서 스코프**가 공용 DB 스타일보다 문서 크기에서 우선한다. `.world-edit-body`/`.db-world-canon-body`는 최소 320px, 16px/1.65이며 `field-sizing: content`로 장문만큼 늘어난다. 문서 영역이 스크롤을 소유한다. 제목은 26px이고 일반 DB 입력의 13px 규칙에 눌리지 않는다.
- 800px 미만 **작업 공간 폭**에서는 목록과 문서를 번갈아 표시한다(`world-list-toggle`, `data-view`). 과거 세로 0.65fr/1fr 분할은 제거했다. 1100px 이하에서 펼친 속성은 작업 공간 안쪽 overlay가 되며 Escape로 속성만 닫고 opener에 포커스를 돌려준다. 1024/1280/1440 데스크톱이 주 검증 행렬이다.
- 작성 상태(`status: draft/canon`)와 공개 범위(`visibility: public/secret`)는 독립이다. 예전 `status: secret`은 로드 정규화에서 `visibility: secret`인 초안으로 옮긴다. 기본 draft/public은 저장 키를 생략하며 상태/공개 범위만 있는 객체는 저작 내용으로 세지 않는다. AI는 비밀 여부와 확정 여부를 독립적으로 반영하고, 속성의 「AI 전달 내용」은 실제 `worldCanonPromptSection` 투영을 표시한다.
- 설정집 내부 `world-edit-save`는 「편집 완료」로 부르며 원격 저장 버튼처럼 보이게 하지 않는다. 실제 저장은 기존 모달 footer의 `지금 저장`/세션 commit/flush가 소유한다. 잠금·취소·삭제·프로젝트 교체 가드는 그대로다.
- 회귀: `test/worldDocumentWorkspace.test.ts`, `worldCanon.test.ts`, 기존 세계관 11개 테스트 파일과 `test/e2e/world-authoring-regression.spec.ts`. 수동 브라우저 증거: `output/evidence/world-document-workspace/`. 아래 2026-09-03/05 기록의 이름·배치 설명은 이 절보다 우선하지 않는다.

- 자료집 레일 **첫 그룹** `세계관` (`slug: lore`). 탭 `이 세계` (`worldCanon`, `db-tab-world-canon`) 와 `설정집` (`worldCodex`, `db-tab-world-codex`). 예전에 「세계」이던 타일셋·생성 규칙 그룹은 **「맵」** 으로 개명했다 (`slug` 는 `world` 유지 — 접힌 타일셋 폴더 부제 계약).
- `이 세계` 는 싱글톤 `project.worldCanon` 이다. 이름·한 줄 전제·톤 칩·시대·기술 천장·없는 것 태그·힘/신/죽음/돈 법칙·마크다운 본문. 비어 있으면 키를 저장하지 않는다 (`normalizeWorldCanon` / `compactWorldCanon`). 스키마는 `src/project/world/canon.ts`.
- 텍스트는 `recordCoalescedSnapshot`, 칩·태그·법칙 토글은 `recordProjectSnapshot`. UI 는 `databaseWorldCanonView.ts`, 계약 `test/worldCanon.test.ts` + `test/databaseWorldCanonView.test.ts`.
- `설정집` 은 세계관 카드 위키를 `workspaceShell` 셸에 심은 것이다 (`world-panel-embedded` + `db-world-codex-workspace`). 본문은 레이아웃 루트 하나만 자식으로 둬 `.db-body` 자체 스크롤을 만들지 않는다 — 계약 `test/databaseWorldCodexStructure.test.ts`. 톱바 세계관 버튼은 이 그룹의 `이 세계` 탭으로 점프한다.
- **소바자 세 곳 (2026-09-03).** (1) 조수: `src/ai/worldCanonContext.ts` 의 `worldCanonPromptSection` 이 `## 이 세계(세계관 고정)` 블록을 감독 지침과 같은 **예산 밖 고정분**으로 넣는다 — 이름·전제·톤·없는 것(절대 금지)·법칙 + 본문 발췌(2026-09-20 부터 20,000자 상한, `WORLD_CANON_BODY_EXCERPT_CHARS`). 엔티티 다이제스트 배제(`worldAiExclusion`)는 그대로다. (2) 개요 탭 `db-overview-canon` 카드가 이름·전제를 보이고 이 세계 탭으로 점프한다. (3) 환영 장르 포스터(`applyWelcomeGenrePresetToOpenProject`)가 세계관이 뱄 때만 톤·전제 초안을 심는다. 계약 `test/worldCanonConsumers.test.ts`.

### 세계관 입력 보존·설정집 저장 계약 (2026-09-05)

- 「이 세계」 법칙은 `미정 / 없음 / 있음` 세 상태다. `present: undefined`는 미정, 명시적 `false`는 저장하고 AI 프롬프트에도 전달한다. `writeCanon` 함수 패치는 store 안의 최신 값을 받는다. 법칙 입력/토글이 렌더 당시의 다른 법칙이나 같은 법칙 설명을 되돌리지 않는다.
- 이름·전제·시대·기술·법칙 설명·본문 입력의 `maxlength`는 `WORLD_CANON_BOUNDS`와 같다. 미리보기/600자 발췌 안내는 유지한다.
- `worldCodexSession.ts`는 자료집 컨테이너별 WeakMap으로 초안 상태를 소유한다. DOM 캐시가 무효화되어도 입력이 유지된다. 모달의 전체 저장은 카드 초안을 먼저 커밋하고 flush하며, 잠긴 카드 변경 같은 실패가 있으면 저장 성공으로 표시하거나 닫지 않는다. 닫기 경고는 프로젝트 변경과 카드 초안을 함께 본다. 명시적 폐기는 둘 다 폐기한다. 열린 자료집으로 점프하는 경로는 기존 모달 세션에서 탭만 바꾼다. 프로젝트 교체 시 모달을 닫고 이전 초안의 새 프로젝트 커밋을 거부한다.
- 설정집 input/change는 초안을 갱신한다. 내부 카테고리·검색은 초안을 유지하고, 다른 카드 선택/새 카드 추가는 변경된 초안을 먼저 커밋한다. 검색창 DOM은 유지하고 본문만 갱신해 포커스와 IME 조합을 보존한다.
- 카드 삭제는 잠금을 확인하고 관계·전투 진영의 worldEntityId 출처를 정리한다. 연결된 맵/이벤트/DB 레코드는 유지한다. 프로젝트 스냅샷으로 삭제/출처 정리를 함께 undo한다.
- 설정집 NPC 미등록 검사는 `classifyMapEvent`를 사용한다. 문/상자는 제외하고 NPC·상점의 이름을 검사한다. 다른 카드와 무관한 전역 검사는 기본 접힌 details로 표시한다.
- 임베드 설정집은 부모 폭을 사용한다. 현재 좁은 폭은 위 2026-09-06 문서/목록 전환 계약을 따른다. 공용 `.db-ws-single`은 좁은 폭에서도 한 행 전체를 사용하며 없는 목록에 높이 34%를 예약하지 않는다. 잠금의 키보드 Enter/Space는 카드 선택 이벤트에 가로채이지 않으며 밝은 테마에서도 상태 글자가 보인다. `CameraPanController`도 캔버스가 keydown을 소유한 경우에만 Space keyup의 기본 동작을 막는다(모달 버튼의 기본 클릭 보존).
- AI 배제 계약은 유지한다. 화면 안내에 NPC 작성기는 카드 이름·요약을 읽고, 카드 본문·관계는 전달하지 않는다고 명시한다. 모든 작성 채널에 전달할 규칙은 「이 세계」가 소유한다.
- 검증: `test/worldAuthoringRegression.test.ts`, 기존 worldCanon/worldPanel/worldSystem 및 자료집 모달 테스트, `test/e2e/world-authoring-regression.spec.ts`. 브라우저 증거는 `verify-shots/world-authoring-fixes/`.

## '생성 규칙' 탭 — AI 마을 생성의 물·숲·길 (2026-08-30)

- `맵` 그룹 첫 탭 `생성 규칙` (`worldGen`, testid `db-tab-world-gen`) 은 `project.system.worldGen` 을 저작한다. 강 띠 두께·호수 지름·수면 모양·숲 깊이·나무 밀도·간격·길 재료·광장 자리, 그리고 "이 말이 나오면 이 지형" 낱말 규칙이 전부 이 한 탭에 있다.
- 값을 만지면 실제 칩셋 타일로 그린 미리보기가 즉시 갱신된다. 미리보기는 시공기와 **같은 함수**(`buildTerrainConstraintMasks` / `cellsInFillShape` / 나무 수 헬퍼)를 쓴다 — 미리보기 전용 근사식을 넣지 마라. 예시 프리셋 카드도 같은 렌더러로 그린 썸네일이다.
- 낱말 규칙은 낱말 목록 + 제외 낱말 + 지형 칩이다. **정규식·코드 입력을 넣지 마라** — 초보 저자가 대상이고 자연어까지만 허용하는 것이 설계 전제다.
- 구조 변경은 `recordProjectSnapshot`, 슬라이더/텍스트는 `recordCoalescedSnapshot` 이라 modal dirty/undo 계약을 따른다. 탭 count 는 저자가 만든 낱말 규칙 수다.
- 스키마·기본값·정규화·경로 전체와 "새 항목 추가 절차" 는 `openwiki/world-generation-rules.md` 가 소유한다.

## P2 낚시·채집·박물관 저작 표면 (2026-08-25)

- `생활` 그룹의 `낚시·채집·박물관` (`lifeCollections`) 탭은 fish species, fishing spots, seasonal forage areas, museum rewards를 구조화해서 목록·추가·이름 변경·삭제한다. 기본값 동작은 collection tracking까지 서로 참조가 맞는 최소 패키지를 만든다. 물고기 삭제는 해당 catch만 제거하고, catch가 하나도 남지 않은 낚시터만 함께 제거한다.
- item 삭제는 물고기 지급, 채집 drop, 도감 추적, 박물관 eligibility/condition/item reward 참조가 남아 있으면 차단된다. map 삭제 확인은 낚시터/채집 구역 수를 표시하고 해당 맵의 행만 제거한다. UI가 참조 권위자가 되어서는 안 된다. 전역 lint/repair는 `src/project/io/references.ts`, map lifecycle은 `src/project/mapDeletion.ts`가 소유한다.

## 생활 저작 경계와 자동 화자 (task14, 2026-09-06)

- 주민 생일 입력의 상한은 `daysPerSeasonOf(timeSystem)`이다. 40일 달력의 40일을 허용하며, 현재 28일 달력에 남은 29일은 원래 값을 보여 주고 `aria-invalid`와 경고로 진단한다. 렌더는 날짜를 보정하거나 프로필을 생성하지 않는다.
- 자동 선물 메뉴·선물 반응·대화 호감 피드백은 연결된 `characters[characterId].displayName`을 우선한다. 프로필이 없으면 기존 페이지 이름으로 돌아간다. 이벤트의 화자 없는 문장에도 연결 프로필 이름을 쓰지만, 명시한 `speaker`(빈 문자열 포함)는 유지하고 이벤트 밖 내레이션에는 이름을 발명하지 않는다. 같은 characterId의 호감과 일일 기록 공유는 그대로다.
- 생략된 날씨 예보는 1일, 비·눈 등 강도는 0.5로 표시한다. 맑음은 강도를 소비하지 않고 0이며, 명시된 강도는 편집기에 그대로 남는다. 기본 확률표 생성이 저작하는 3일/0.65와 생략값을 혼동하지 않는다. 네이티브 range 입력은 type/min/max/step 설정 **후** value를 넣어 브라우저의 기본 step=1 반올림을 피한다.
- 계절당 규칙은 기존 런타임/JSON 경계와 같은 최대 128개다. 129번째 추가는 두 추가 버튼 모두 스냅샷·store mutation 전에 거절한다. 최대 기술 레벨은 XP 곡선의 10이며 신규 레벨업 보상은 2..maxLevel이다. maxLevel=1이면 추가할 수 없다. 기존 level1 보상은 읽기·렌더 중 변경하지 않으며 레벨업으로 지급되지 않는다고 안내한다.
- 작물 그림의 마지막 연결 항목이 성숙 상태를 담당한다. frame은 그림의 프레임, label은 편집용 이름이며 맵에는 번호나 이름을 그리지 않는다. 그림이 없을 때 폴백은 색 사각형이다. 미저작/명시 빈 배열/저작 배열과 자동 그림의 명시 고정 경계는 그대로다.
- 회귀: `test/lifeAuthoringBounds.test.ts`. 실제 1024×768·1440×900 에디터 키보드/undo/redo/로컬 Project4 왕복과 별도 `player.html` 선물·대화 소비 증거는 `.omo/evidence/life-full-20260906/14/`에 있다. 원격 콘텐츠 저장이나 전체 생활 완주 검증은 아니다. 기존 Phase3 도구 규칙의 기본표·명시 false·순서 계약은 변경하지 않는다.

## 계절·날씨 / 동물·축사 저작 표면 (2026-08-25)

- **Linked starting homes (2026-09-08):** `databaseFarmAnimalsView.ts:animalHomeOptions` offers an explicit unassigned, legacy barn (`buildingId`), or housing placement (`housingPlacementId`) choice. `applyAnimalPatch` keeps the references mutually exclusive; tagged picker values preserve opaque IDs, including colons and equal legacy/placement spellings. Options show species/capacity restrictions; nearby placements are not inferred homes.
- `occupancySummary` counts legacy barns plus opted-in starting placements with an explicit capacity at their selected level. Capacity sums legacy `capacity` and linked `animalCapacity`, never generic building capacity. Used counts only exclusive references to those homes; unassigned, dangling and dual references do not count. Free is capacity minus used, not a guarantee of species-compatible space at any particular home. Numeric coverage: `test/animalHousingSummaryMetrics.test.ts` (linked-only, legacy-only, mixed, invalid references, non-housing and empty totals).

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
- Task15 출하 허용 체크: `allowedItemIds === undefined`(전체)에서 개별 아이템을 끄면 UI가 현재 `database.items` id 전체를 materialize 한 뒤 해당 id 만 제거한다. `[]`는 계속 none, 명시 목록은 명시로 남는다. 상점은 표시 단가·합계·기본 매도/흥정 기준·정산 gold/pawn 장부에 공유 `resolveShopSellUnitPrice(project, itemId, buyPrice)` 를 쓰고, 출하 정산은 기존 `resolveSellPrice` 그대로(표 100 은 100, 상점 clamp 99 와 분리)다.
- Tool-action authoring uses the real resolver defaults: creating the first nonempty custom table copies hoe/till, wateringCan/water, axe/chop/tree and pickaxe/mine/rock, then prepends the new row. Existing nonempty tables remain ordered complete replacements; adding another row only appends and loading never merges defaults. New rows do not silently select the first database item. `itemId` takes precedence over `farmTool` within a row; first matching rows retain their order. The condition hint explains that empty item/kind conditions mean any valid non-consumable farm tool, not a seed or consumable. The farmable checkbox displays the effective default (true for till/water) but stores an explicit boolean when edited, so unchecked false survives Project4 serialization, reload and undo/redo. `test/toolActionAuthoringParity.test.ts` and `test/databaseLifeCraftingView.test.ts` cover these contracts.
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

- **얼굴은 리소스 목록에서도 낱장이다 (2026-08-27):** 얼굴 한 칸 = 파일 한 장 모델은 피커뿐 아니라 **리소스 관리자(얼굴 그래픽) 목록**에서도 지켜야 한다. `defaultResourceProfiles()` 는 `AUTHORABLE_FACESET_FACE_ASSETS` 80장을 48×48 `kind: "faceset"` 프로필로 등록하고, `EASYRPG_RTP_ASSETS` 의 faceset 행(4×4 시트)은 **건너뛴다** — 시트는 v3 로드 해석용으로만 등록돼 있는 레거시다. 이미 저장된 프로젝트에 남은 시트 프로필은 `ensureBundledResourceProfiles()` 가 `LEGACY_FACESET_SHEET_IDS` 기준으로 걷어내므로, 로드 한 번으로 수렴한다. 실측 회귀: 이 등록을 빼먹으면 피커는 낱장인데 리소스 관리자는 192×192 시트 5장만 보여 저자 눈에는 "전혀 나뉘지 않은" 상태가 된다. 얼굴 표면을 손볼 때는 피커·이벤트 명령 미리보기·**리소스 관리자**·런타임 상태 메뉴를 같이 확인하라.
- **공용 표정 16종 (2026-09-15):** 사용자 제공 푸른 머리 여행자 시트를 `public/assets/shared/faceset/source/blue-traveler-expressions.png`에 보존한다. `node scripts/prepare-shared-faceset.mjs`는 1254×1254 원본을 칸별 중심점 샘플링해 192×192로 변환하고, `node scripts/slice-faceset-sheets.mjs`가 48×48 낱장 16개와 카탈로그를 생성한다. `shared-blue-traveler-expressions-00..15`는 공용 내장 리소스이며 리소스 관리자에서는 **얼굴 그래픽 → 표정 관리** 하위 섹션에 캐릭터별 4×4 묶음으로 노출된다. `src/assets/faceExpressionSets.ts`가 묶음을 정의하고 `resourceExpressionSection.ts`가 캐릭터 선택·16종 미리보기를 렌더링한다. 일반 얼굴 그래픽 목록에서는 이 묶음의 낱장을 제외하되 DB 피커·AI 목록·새 프로젝트의 개별 ID와 01~16 이름은 유지한다. UI 검증 증거: `output/evidence/expression-manager/`. 생성기 origin `shared`는 숨김 대상 `generated`와 다르다. 프로젝트 업로드 복사본을 만들지 않는다. 얼굴 이름과 순서는 생성기의 `SHARED_EXPRESSION_NAMES`가 소유한다. 검증: 분할기 `--verify`, `test/facesetFaceAssets.test.ts`, `test/databaseResourcePickerDialog.test.ts`; 브라우저/원격 참조 저장 증거는 `output/evidence/shared-expressions/`.
- **생성 얼굴 시리즈는 저작 목록에서 내렸다 (2026-09-12):** `generated-actor-hero-01/02-face-NN` 낱장 32장은 `GENERATED_FACESET_FACE_IDS` 에 묶여 리소스 관리자·DB 얼굴 피커·AI 리소스 카탈로그·캐릭터 그래픽 탭·에디터 워밍업에서 전부 빠진다. 다만 **해석·검증 등록은 유지**한다 — `FACESET_FACE_ASSETS`(112장 전체)·`resolveFacesetFaceAssetUrl`·`collectResourceIds`·`faceIdForSheetCell` 매핑은 그대로라, 이 얼굴을 가리키는 저장본도 깨지지 않는다(시트 id 와 같은 "등록만 남기기" 패턴). 저장본에 남은 프로필 행은 `ensureBundledResourceProfiles()` 가 로드 때 걷어낸다. 완전 삭제가 아니라 숨김이다 — 파일·id·해석 경로를 지우면 참조 프로젝트가 역직렬화에서 던진다.
- **리소스 관리자 목록은 프로필을 정본 id 하나로 접는다 (2026-09-12):** 번들 프로젝트의 `resourceProfiles` 는 같은 시트를 두 네임스페이스로 등록한다 — 번들 textureKey(`tex_easyrpg_chipset_*`, `tex_easyrpg_charset_*`)와 RTP 매니페스트 id(`easyrpg-chipset-*`, `easyrpg-charset-*`). 데이터상 둘 다 유효한 id 라 프로필은 **지우지 않는다**(액터 `characterResourceId` 가 `easyrpg-charset-*` 로 저장되고, `characterSlots`·`graphicAttributes` 같은 저작 메타가 어느 id 로도 온다 — `characterGraphics.test.ts` 가 두 id 공존을 요구). 다만 목록에 카드가 두 장이면 중복으로 읽히므로 `resourceManagerUtils.dedupeListedProfiles` 가 표시 단계에서만 접는다: (a) `assetId` 가 업로드 자산과 겹치는 프로필(오디오·몬스터 카탈로그의 `Object.hasOwn(uploaded, id)` 와 같은 규칙 — 이미지 import 는 uploaded+profile 을 같은 id 로 둘 다 쓴다), (b) 정본 id 가 같은 별칭 프로필. 정본 대응은 `canonicalResourceProfileId`: charset 은 `findCharsetAsset().textureKey`, chipset 은 번들 경로 파일명(`-transparent` 제거)에서 유도 — `tex_tiles_default` 는 프로필로 등록되지 않는 런타임 키라 `easyrpg-chipset-exterior` 는 별칭만으로 남아 그대로 보인다. 카테고리 배지 수도 같은 목록을 센다. 계약: `test/resourceManagerDedup.test.ts`, `test/e2e/oprn-resource-manager.spec.ts`.
- **시트 업로드는 앱이 쪼갠다 (2026-08-27):** 저자가 192×192(16칸)·96×96(4칸) 시트를 업로드하면 `planFacesetSheetSplit` → `sliceFacesetSheetDataUrls`(canvas)가 48×48 낱장으로 잘라 `<base>-00..-15` 리소스로 등록한다. `decideFacesetUploadDimensions` 는 더 이상 시트를 거부하지 않는다 — 저자에게 터미널에서 `npm run assets:slice-faces` 를 돌리라고 요구하지 않는다(그 스크립트는 레포 내장 에셋 재생성 전용이다). 계약: `test/facesetSheetSlicing.test.ts`, `test/facesetUploadDimension.test.ts`.
- **이미 저장된 업로드 시트도 쪼개진다 (2026-08-27):** `faceIdForSheetCell` 은 내장 7장만 알아서 업로드 시트 id 를 그대로 되돌려준다 — 그 상태로 `migrateV3toV4` 가 `faceIndex` 를 지우면 업로드 4×4 시트를 가리킨 액터가 48px 얼굴 칸에 겪자 전제를 다 누른 상태로 남는다. 그래서 마이그레이션은 `faceIdForFace` 로 업로드 시트도 `<시트 id>-NN` 으로 옮긴다. 대상은 **업로드 faceset 자산 중 48 배수 정사각인 id 집합**으로 한정한다 — 이 및장이 없으면 얼굴과 무관한 m2 `fields.value` 가 `-07` 을 달고 망가진다.

  시트 자산·프로필은 낱장 16개로 재작성된다. 단, **마이그레이션은 동기라 항상 canvas 를 쓸 수 없다**(노드 테스트에서도 돌아간다). 그래서 각 칸은 시트 이미지를 물린 상토로 `meta.sheetCell` / `meta.sheetSourceId` 표식을 달고 들어오고, 로드 직후 `repairUploadedFacesetSheets`(`facesetSheetRepair.ts`)가 canvas 로 진짜 절단을 마무리한 뒤 표식을 지운다. **이 순서가 계약이다**: 시트를 먼저 지우고 나중에 낱장을 만들면 `resourceReferenceValidation` 이 아직 없는 낱장 id 를 보고 로드를 토한다.

  호출자 주의: `normalizeCurrentProject` 는 동기 사전 점검 `hasPendingFacesetSheetRepair` 로 거를러 **자를 것이 있을 때만 await** 해야 한다. 로드 경로에 불필요한 자시합을 더하면 지속화 순서가 밀려 `storePersistence`·`storeFlushShaEvidence` 의 순서 계약이 진다(실머 8건). 계약: `test/facesetUploadedSheetMigration.test.ts`.

- **기본 장비 런타임 축 계약 (2026-08-29):** `EquipmentRecord.accuracy`는 일반 공격 최종 명중률에 곱하는 0~100% 보정(기본 100), `criticalRate`는 액터 기본 치명타율에 더하는 0~100%p 보정(기본 0)이다. 일반 공격은 장비의 첫 `attackElementIds` 하나를 속성 배율에 적용하므로 기본 카탈로그는 무기당 공격 속성을 최대 하나만 저작한다. `stateInflictIds`/`stateInflictionChance`는 적중한 일반 공격, `elementalDefenseIds`는 일치 속성 피해 50% 감소, `stateDefenseIds`/`stateResistanceChance`는 `stateDefenseMode:"resist"`일 때 상태 저항 판정에 쓰인다. `twoHanded`는 양손 슬롯 점유, `effectFlags.doubleAttack`/`attackAll`은 일반 공격 횟수/대상을 바꾼다. 반면 장비용 MP 비용은 `EquipmentRecord`에 없고, `preemptive`·`ignoreDodge`·`preventCriticalHits`·`increasePhysicalDodge`·`halfMpCost`·`negateTerrainDamage` 플래그와 `stateDefenseMode:"inflict"`는 턴제 런타임 소비자가 없으므로 기본 장비에 저작하지 않는다. `test/equipmentCatalogRuntimeAxes.test.ts`가 실제 전투 런타임과 결정적 RNG로 명중·치명타·상태 부여·공격 속성·속성 방어·상태 저항을 검증하고, `test/defaultItemCatalogQuality.test.ts`가 기본 카탈로그의 허용 축만 검사한다.
- 기본 아이템 카탈로그는 `public/assets/cc0/jetrel/icons` 아래의 대응 아이콘과 함께 JRPG 아이템 100종 이상을 제공한다. 기존 Jetrel CC0 아이콘은 유지하고, 맞지 않거나 빠진 아이콘은 가능한 경우 로컬 생성 스크립트로 만든 뒤 `src/assets/cc0IconAssets.ts`에 `generated` 라이선스로 등록한다. `defaultItemRecords()`를 비롯한 기본 데이터베이스 레코드는 `createBlankProject` → `saveProjectToLegacyDb` 경로로 **새** 프로젝트를 만들며, `ensureDefaultDatabaseIconResources()`는 `normalizeCurrentProject`에서 번들 아이콘 리소스를 연결한다. 불러올 때도 LegacyDb `current_json` 행이 기준 원본이다. 일반 기본값 보충은 금지하되, `repairLegacyDbCurrentJson`은 2026-08 영문 아이템 껍데기 결함만 제한적으로 이전한다. ASCII 슬러그 이름과 `<slug> 기본 아이템입니다.` 설명이 모두 손대지 않은 모양일 때만 행을 교체하고, 이름이나 설명 중 하나라도 고친 부분 편집 행은 의도적으로 보존하며, 복구된 카탈로그에 필요한 승격 장비 9개와 아이템 효과 스킬 2개 및 그 스킬이 참조하는 번들 전투 애니메이션만 추가한다. 참조 없는 옛 장비 아이템 행은 제거하지만, 이벤트·시스템·시작 인벤토리가 참조하는 행은 한국어 비착용 안내 행으로 남겨 참조를 보존한다. 이 복구는 깨끗하게 열기만 해서는 저장 행에 즉시 기록되지 않으며, 이후 다른 편집을 저장할 때 함께 영구 반영된다.
- **로드 정규화 (2026-09-05 변경):** `ensureDefaultDatabaseIconResources()`는 기존 행의 이미지 연결만 보정하며 기본 ITEM/EQUIPMENT 레코드를 재주입하지 않는다. 삭제 보존 계약은 이 페이지 맨 위 참조.
- **기본 카탈로그 계약:** 아이템과 장비 이름에는 한글이 들어가고, 모든 레코드는 서로 다른 구체적인 한국어 설명을 가진다. 사용 가능한 아이템의 `occasion`, `consumable`, 실행 가능한 회복·상태·스킬·기술서 효과는 서로 맞아야 한다. `occasion: "never"`는 소모하지 않는 재료, 수확물, 도구, 이벤트·퀘스트 물품과 농사 권위자가 소비하는 작물 씨앗에만 쓴다. 농기구에는 유효한 `farmTool`이 있어야 한다. 착용 장비는 `project.database.equipment`에만 두며, 장비 모양 행을 `database.items`에 남기지 않는다. 전투 아이템과 아이템 효과 스킬은 실제 전투 애니메이션 레코드를 참조해야 한다. 전투 대상 해석이 쓰러진 전투원을 제외하므로 부활 아이템은 필드 전용이다. `test/defaultItemCatalogQuality.test.ts`가 데이터와 애니메이션 참조 계약을 검사하고, `test/itemRuntimeUsability.test.ts`가 실제 메뉴·전투·농기구 권위자를 실행한다.
- **기능 확장 기본 아이템(2026-08-29):** `defaultFeatureItemRecords.ts`가 기본 카탈로그에서 비어 있던 상태 추가, 아군 전체 대상, 몬스터 `careProfile`, 영구 성장 씨앗, `switchId`, 속성 아이템 스킬, 유한 `consumptionLimit` 경로를 출하 레코드로 연결한다. 출하 프로젝트에 연결되지 않은 작물 씨앗은 심기·수확을 약속하지 않도록 카탈로그에서 제외한다. 스위치 아이템은 필드 메뉴에서 아직 꺼진 전용 스위치만 켜고 성공 사용 1회를 공통 아이템 전환 권위자에 넘긴다. 유한 충전은 메뉴와 전투 모두 `transitionItemState(..., { kind: "successfulUse" })`가 계산하며, `allAllies` 전투 아이템은 대상 수와 관계없이 명령당 한 번만 전환한다. 집중 실행 계약은 `test/defaultFeatureItemRuntime.test.ts`다.
- **`item.switchId` 는 항상 선언된 스위치를 가리킨다(2026-09 회계 정리):** 기동석·기동패 아이템이 `project.switches` 에 없는 스위치를 켜면 실행 자체는 세션 키 쓰기로 동작하지만 저작자가 스위치 탭에서 후속 조건을 연결할 방법이 없었다. `ensureItemSwitchDefs`(`src/project/itemSwitchDefs.ts`)가 `repairProjectReferences`(로드)와 `ensureSwitchVariableSlots`(스토어 정규화) 양쪽에서 정의와 세션 슬롯을 자동 선언하며, 표시 이름은 `ITEM_SWITCH_NAMES` 표 → 아이템 이름 순으로 정한다. `validateItemRecords`는 `skill.effect.switchId` 와 같은 수준으로 `item.switchId`를 하드 검증하고, `deleteSwitch` 가드(`switchVariableReferenceMessage`)도 아이템·스킬 스위치 참조를 막는다. 회귀 계약은 `test/itemSwitchReferences.test.ts`와 `test/databaseReferenceGuards.test.ts`다. 같은 점검에서 포획 `ballClass` 사다리(poke/great/ultra/master — `item_gen_master_orb` 추가, gen1은 master=확정 포획)와 네 농기구 전 종(`item_axe` 추가)이 기본 카탈로그에 채워졌다.
- **Characters ??actors (G006):** Characters are **not** a `database.*` collection and are **not** party Actors. The `characters` database tab (`db-tab-characters`, `databaseCharacterView.ts`) manages the opt-in identity package `project.characters` plus orphan event-used characterIds via `listCharacterIdIndex`. Do **not** confuse these social keys with Actor (`database.actors`) party members. List thumbs come from the first host map-event charset crop (`characterListThumbnail.ts` / `resolveCharacterListThumbSource`: hosts[0] event page graphic only). Never use Actor facesets, `database.actors`, or a CharacterProfile portrait field for list thumbs ??CharacterProfile has displayName/birthday/giftPrefs only, no portrait resource.

- **Battle effect sheets are generated procedurally, not prompted.** `src/assets/generatedEffectSheets.json` is the single catalog (slug, Korean name, frameCount, tags, scope/position, independent sound/flash/shake seeds); `scripts/gen-effect-sheets.mjs` (`npm run generate:effect-sheets`) renders each slug to `public/assets/generated/effects/effect-<slug>.png` as 96x96 cells with a purpose-specific 8, 10, or 12 frame length. The generated family uses a 75ms frame interval, so total playback remains 600–900ms; legacy/authored animations retain the 120ms default. Rendering runs through `scripts/lib/effectSheet/` (canvas primitives + per-slug painters + fixed-seed PRNG). `src/assets/generatedEffectSheets.ts` re-exports the catalog for the runtime: resource ids are `generated-battle-anim-<slug>`, resolved by `resolveGeneratedEffectAssetUrl` inside `resolveAssetResourceUrl`, registered in `collectResourceIds` (missing = default project fails deserialization), and listed by the `battle` kind of `databaseResourcePickerDialog`. `defaultBattleAnimationRecords()` maps every catalog entry to a record that plays every authored frame and merges same-frame sound/flash/shake into one timing; `anim_magic` / `anim_heal` / `anim_poison` point at `arcane-nova` / `heal-bloom` / `poison-mist` instead of reusing the melee `easyrpg-battle-blow` / `-arrow` art. Why procedural: frame-to-frame continuity is the whole effect, and image models re-imagine the silhouette per frame. Adding one: catalog entry → painter in `render.mjs` `PAINTERS` → run the generator → commit the PNG. `node scripts/gen-effect-sheets.mjs --check` fails on drift, and `test/generatedEffectSheets.test.ts` locks catalog/painter/PNG/record agreement byte-for-byte. `npm run generate:effect-showcase` builds the self-contained audiovisual catalog at `reports/generated-effect-showcase-2026-08-24.html` from those same catalog rows, PNG bytes, and bundled EasyRPG sounds.
- The generated catalog currently contains **34 audiovisual sets**. The 12 genre-generic monster-battler additions live in `scripts/lib/effectSheet/paintersMonster.mjs`: tackle impact, claw rake, bite crunch, projectile shot, leaf volley, psychic wave, shadow pulse, holy beam, sleep dust, power aura, guard barrier, and capture seal. The next 12 reusable combat/utility additions live in `scripts/lib/effectSheet/paintersUtility.mjs`: critical burst, sonic wave, drain orbs, revive rise, cleanse sparkle, paralysis bind, blind veil, confusion spiral, silence lock, summon portal, smoke vanish, and meteor fall. They deliberately use generic geometric silhouettes rather than copied commercial-game move art. Physical/projectile effects use 8 frames, elemental/status/support effects use 10, and large ritual/seal/meteor effects use 12; every entry owns one bundled sound timed to its impact frame.
- New projects bind the starter actors, classes, skills, and battle-usable items to purpose-specific generated effects through `generatedBattleEffectBindings.ts`; creating animation records alone is insufficient because runtime playback follows those authored references. Existing LegacyDb rows remain load-authoritative and receive no silent default backfill. Their explicit upgrade path is Database → Battle Animations → `이펙트 34종 적용` (`db-install-generated-effects`): `installGeneratedBattleEffectPack()` adds missing generated records, upgrades the three retained legacy aliases when they still use old art, and changes only known starter record ids. It preserves unrelated/custom records, records one undo snapshot, and becomes a disabled `적용됨` button when no changes remain.
- Database workflows live in `src/editor/databaseActions.ts`, `src/editor/databaseRecordMutators.ts`, `src/editor/databaseReferences.ts`, and `src/editor/databaseCopy.ts`.
- **상태 변화 · 전투 연출 · 몬스터 돌봄 저작 (2026-09-05 복구):** `databaseItemRecordView.ts`의 현재 카드 계층에 누락 브랜치의 세 컨트롤을 통합했다. 효과 구역은 종류별 패널 → 상태 변화 → 전투 연출 → 연결 스킬, 사용 제한 구역 끝에는 몬스터 돌봄 카드가 온다. 기존 아이템 요약과 최신 `modern/equipment-items.css`는 유지한다.
  - `medicine`/`special`의 상태 변화 행은 상태·확률·부여/해제·삭제를 저작한다(`db-item-state-effect-row-<i>`, `db-field-item-state-effect-{state,chance,op}-<i>`, `db-item-state-effect-add`). 부여 확률은 0..100으로 제한한다. 기존 `healStateIds` 회복 체크박스도 유지한다. CSS는 `skill-item-visuals.css`의 상태 행 규칙을 아이템에도 공유한다.
  - `db-picker-item-animation`은 `animationId`를 선택하거나 비운다. 전투에서 대상 위치에 재생하며 필드 메뉴에서는 재생하지 않는다.
  - `db-field-item-care-kind`/`-friendship`/`-exp`는 `careProfile`을 저작한다. 없음은 프로필 삭제, 경험치 0은 `expDelta` 생략이다. `databaseRecordMutators.updateItemRecord` 화이트리스트에 이 필드를 포함해야 UI 편집이 저장된다.
  - `itemEffectStory`는 상태 부여 확률과 연출 이름을 설명하며 `databaseFieldSupport`의 21개 필드 중 세 필드를 런타임 지원으로 공개한다. `test/databaseItemInspector.test.ts`는 조작과 직렬화→재로드→필드 삭제를, `test/e2e/item-effects-authoring.spec.ts`는 실제 브라우저 조작·탭 왕복·내보내기를 검증한다. 복구 화면은 `verify-shots/item-editor-modern/recovered-*.png`다. `recovered-database-harness.ts`는 실제 CSS와 `openDatabaseModal`을 전용 Vite 페이지에서 실행하고, dev-project factory로 원격 저장을 끈다. 로컬 요청만 Node `route.fetch`로 전달해 호스트의 Chromium 네트워크 변경 오류를 우회하며, 내보내기는 정본 `serialize`/`deserialize` 경로를 검증한다.
- Item types `weapon|shield|body|head|accessory` no longer open a live equipment form. The Items tab shows a door (`db-item-open-equipment-tab`) to the Equipment tab (G006). Runtime gear stays on `database.equipment`.
- **Items tab information hierarchy (2026-08-29):** the inspector's card order *is* the hierarchy and is asserted by `test/databaseItemInspector.test.ts` ("orders workbench cards"): 요약(`db-item-card-story`) → `db-item-section-definition` → 기본/그래픽 → `db-item-section-effect` → 대상과 사용 시점 + 종루별 효과 패넬 + 연결 스킬 → `db-item-section-limits` → 사용 가능 + 포획 → 공시. Four defects this replaced: the grab-bag `수치` card (가격+범위+포획 배율+볼 등급+스킬 in one card whose title explained nothing), the graphic card wedged between effect cards, four duplicate `db-item-card-usable` copies (one per type panel), and **two live scope controls on one screen**. Scope now has exactly one owner per type: `medicine` uses its 2-way `db-field-item-scope` segment, every other non-equipment type uses the shared `db-field-scope` select — never both (same failure shape as the equipment `slot` duplication). `itemFields` in `databaseBasicRecordFields.ts` stays as the aggregate for existing callers, but the view composes `itemPriceField` / `itemScopeField` / `itemCaptureFields` / `skillPicker` into separate cards. Capture fields stay visible for every non-equipment type (a new record is `normalGoods` and `test/e2e/qa-items.spec.ts` authors capture on it) but sit last under `db-item-card-capture` with a scope hint.
- **Category filter chips carry counts and cluster order (2026-08-29):** `categoryFilterChips` in `databaseRecordViews.ts` renders `db-filter-chip-<id>` with a `.db-filter-chip-count` badge counted from the **unfiltered** collection (counting the filtered array collapses every other chip to 0 after one click). Items group through `ITEM_CHIP_CLUSTERS` — 무분류 물품, then `소비`, then `장비`, with `.db-filter-cluster` captions; `test/databaseFilterChips.test.ts` fails if a new `ItemType` is missing from a cluster. Zero-count chips are dimmed (`is-empty`) and keep no badge, but stay rendered and clickable — hiding them makes the row reflow as the filter changes, and every `db-filter-chip-*` testid must exist on first paint (audit specs click `db-filter-chip-medicine` straight after opening the tab).
- `src/editor/databaseFieldSupport.ts` is the source of truth for item/equipment field support disclosures shown by database record views. Keep each field's runtime/authoring-only status and help text aligned with the executing authority: finite-use item charges use `src/project/itemTransitions.ts`, while equipment changes use `src/project/equipmentRules.ts` atomically for fixed/cursed, dual-wield, and two-handed invariants. Fields with no runtime consumer remain authoring-only disclosure and must not be advertised as gameplay-active.
- Visual resource picking is shared through `src/editor/panels/databaseResourcePickerDialog.ts` (searchable thumbnail grid + large preview). Items/equipment icons and images, enemy/species monsters, system title/system/system2 graphics, and actor faceset/charset/battleCharset all open this picker. List thumbnails live in `databaseRecordThumbnails.ts` (32px; actors/enemies/items/equipment/skills/animations/classes/troops/states). Actor `characterIndex` is an optional sheet cell (0..7, default 0) used by charset previews and thumbs; faces use standalone 48×48 face graphic resource ids directly without an index.
- **In-modal Database navigation contract (G006 residual binding):** When the Database modal is already open, cross-tab jumps (e.g. Enemy ??linked Species) MUST keep the same modal instance: call `setSelectedMonsterSpeciesId(speciesId)` then `switchDatabaseActiveTab("monsterSpecies")` (or the shared tab switch that re-renders body only ??same path as sidebar tab clicks). **Forbid** `openDatabaseModal(...)` as an in-modal jump: reopening tears down/rebuilds the shell, resets dirty baseline/session selection, and can leak document keydown listeners if close is skipped. `openDatabaseModal(initialTab?)` remains the outside-entry path (menu/toolbar/world manager) and still uses `setDatabaseActiveTab` only on first open. Append G006 action buttons only on enemy/species views (`speciesFields` array extension point in `databaseEnemyRecordView.ts`); do not scatter jump controls across unrelated tabs.
- `src/editor/panels/databaseModal.ts` owns the Database modal shell. Escape and the backdrop go through `src/editor/panels/editorModalDirtyState.ts`: a clean session closes, and a session that differs from open (store edits or a world-codex draft) shows Save / Discard / Keep Editing. Discard restores the modal-open project snapshot; Apply/Save persist and reset the dirty baseline. Footer 닫기 and the header X do not use that gate for store edits — those are already applied — and close while keeping them. They prompt only for an uncommitted world-codex draft.
- Save-refresh reentry: `database.ts:renderActiveTab` commits the focused control under a render-depth guard before replacing tab DOM. Synchronous blur/change rerenders are queued and drained as fresh renders, avoiding nested `replaceChildren` without dropping the edit or a later save-refresh edit. Coverage: `test/databaseTabRenderReentry.test.ts`.
- **Database tab chrome unify (2026-07-14):** Shared shell CSS `:has()` targets generic `.rm2k3-record-workspace` / `.db-record-workspace` (not only actors/classes/??list) so crops/characters/monster-species get the same modal size, header, and sidebar as core records. Empty list panes reserve min-height + inset frame; list toolbars use shared `db-toolbar-button` density; detail empty states use a card. CSS: `src/styles/database/desktop-record-shell/10-tab-chrome-unify.css` (imported last from `desktop-record-shell.css`). Evidence: `output/evidence/database-ui-unify/{before,after}/`.
- Database write tools in `src/editor/tools/dbTools.ts` use read-modify-write semantics: existing records are merged with only the supplied fields before normalization, unknown fields are rejected with allowed-field guidance, and successful upserts return the full resulting record in `ToolResult.data`.
- The AI chat dock remains available while the Database modal is open so users can issue database-agent requests against the visible modal. Do not reintroduce CSS rules that hide `.ai-chat-panel` for `.database-modal-backdrop`.
- `src/editor/panels/databaseCommonEventViews.ts` owns the Common Events tab view. Common-event command editing uses `src/editor/panels/databaseCommandListAdapter.ts` with shared `renderCommandList`, `openEventCommandPicker`, and `openEventCommandEditDialog`; do not restore the old text-only inline command editor for Common Events.
- Troop battle event command editing also uses shared database command-list rendering. Keep battle-event command rows on the same command editor path unless the task names a narrower troop-only control. Battle-event rows pass the troop-specific runtime support table so unsupported commands show partial/editor-only badges instead of inheriting map-runtime support.
- Troop battle event condition controls include round cadence (`turn`, `onRound`, `everyRound`), switch/variable, enemy HP range, `enemyHpBelow`, actor HP, and actor-command forms. Keep these controls aligned with `src/battle/battleEvents.ts` and battle reference validation when adding condition kinds.
- Class battle command rows are runtime-facing data, not cosmetic labels. Keep `kind`, optional `skillSubsetName`, and optional `skillId` edits in sync with `src/battle/battleCommands.ts`; the battle UI consumes class commands in order and treats `guard` as the existing defend action.
- **공통 이벤트 명령·배우별 명령 (2026-10-02):** 직업 명령 행과 전역 전투 명령 카드에 「공통 이벤트 실행」(`commonEvent`) 종류가 있다. 직업 행은 `db-picker-class-command-common-event-*`, 전역 카드는 `db-picker-battle-command-common-event-*` 로 실행할 공통 이벤트를 고른다. 액터 「장비와 스킬」 안의 「전투 명령」 패널(`actor-panel-actor-battle-commands`)은 `ActorRecord.battleCommandIds` 를 편집한다. 끄면 직업 명령을 쓰고, 켜면 직업 명령을 옮겨 와 ↑↓·삭제·추가(7개까지)를 할 수 있다. AI 도구는 `upsert_actor.battleCommandIds` 와 `upsert_database_utility` battleCommands 의 `commonEventId` 를 받는다. 런타임 계약은 `openwiki/runtime-battle.md` 의 같은 날짜 항목에 있다.
- Monster collection authoring spans System, Items, Enemies, Troops, Classes, Skills, States, and Monster Species database views. `system.monsterCollection` gates capture command exposure; optional `system.typeChart` stores the Pokemon-style type matrix; item `captureProfile.multiplier` remains the compatibility strength while the Items view's `ballClass` selector authors `poke|great|ultra|master`; enemy `speciesId` links battlers to collectable species; the Troops view exposes `uncapturable` and `trainerBattle`; the States view exposes `gen1MajorStatus`; class command kind `"capture"` is only useful when the system gate is enabled. Keep these controls, record mutators, normalization, reference validation, and `dbTools` schemas aligned.
- **Enemy vs Species responsibilities (G006):** Enemies (`database.enemies`, 몬�뒪??tab) own battle-facing battler data: combat stats, attack patterns/actions, rewards, rates, and optional `speciesId` capture link. Species (`database.monsterSpecies[]`, 醫낆” tab) own collectable identity: baseStats, types (max 2), captureRate, skillsByLevel, evolutions, and species graphic. `enemy.speciesId` links a battler to a collectable species for capture without making the enemy record a player-owned monster. **No dual-write stats:** editing enemy stats must not rewrite species `baseStats` (or the reverse). Optional graphic copy (`db-enemy-species-copy-graphic`) may copy species graphic fields onto the enemy only; never auto-sync stats. Enemy species panel chips: unset warn / missing error / graphic mismatch info (`databaseEnemyRecordView.ts`). Species intro copy states the same split.
- The System database tab edits `project.system` through `src/editor/panels/databaseSystemView.ts`: start party (up to 4 `startActorIds` slots, synced to `session.partyActorIds`), title/system/battle-system resource ids, initial troop, `battleFlow`, `activeSlots`, `monsterCollection`, `giftSystem`, `rewardPolicy`, optional `timeSystem` (enable + day bounds + onDayEnd common event), `typeChart.types` plus the attacker/defender matrix, and title-screen layout/labels. Structural edits (party slots, type list, time enable) re-render the tab body; blank/removing the type list deletes `system.typeChart` **after `window.confirm`** (cancel restores the previous type list), preserving legacy neutral damage when the author confirms. Never collapse a multi-member start party to a single actor when one slot changes. `commonEventReferenceMessage` blocks deleting a common event that `timeSystem.onDayEnd` points at (copy: 시간 시스템(하루 끝)). Terrain backdrop/footstep use `resourcePickerControl` (testid `db-field-terrain-backdrop-*` / `db-field-terrain-footstep-*` stay on the text field).
- **Project fonts (System → 폰트, 2026-08-27):** `system.fonts?: { ui?, pixel?, mono? }` authors the project font per role from the registry in `src/project/fontRegistry.ts`, which is the single list of selectable faces (`system-sans`, `system-serif`, `system-mono`, plus the three bundled pixel woff2 faces `neodgm` / `galmuri11` / `galmuri9`). Selection ids are validated against that registry and against the role — an unknown id, a face that does not serve the role, or a value equal to `DEFAULT_FONT_SELECTION[role]` is not stored, and an empty result drops the `fonts` key entirely (same "don't persist defaults" convention as `battleUiStyle` / `battleModel`). `normalizeSystemRecords` is a **whitelist**, so a font field missing from it vanishes after one save/load roundtrip; keep the registry, the type, and the normalizer in sync. Application is one hop: `applyProjectFontTheme` (`src/app/fontTheme.ts`) writes `--font-ui` / `--font-pixel` / `--font-mono` as inline custom properties on `document.documentElement`, overriding the `:root` defaults in `src/styles/tokens.css`; `src/app/mode.ts` calls it once after load and again on every `store.subscribe` change, exactly like `syncBattleModelAttribute`. The exported web/single-HTML player also calls `syncProjectFontTheme` from `exportEntry.startPlayer` (2026-10-04), since it does not run editor boot. Within the editor, edit and play modes share one document, so the mode wiring covers both surfaces and **no CSS consumer needs to change** — every `font-family` in `src/` reads a token (or an alias chain ending at one, e.g. `--runtime-pixel-font` → `var(--font-pixel)` → `--runtime-dialogue-font`). Phaser canvas text is the one exception, because canvas cannot resolve CSS variables: `editSceneEventMarkers.ts` (`eventLabelFontFamily()`) and `playSceneActionCombat.ts` call `projectFontStack(store.getCurrent().system.fonts, role)` at text-creation time, so they follow the author's live selection rather than the default. Reading `DEFAULT_FONT_SELECTION` directly there is a regression — the setting would change every surface except canvas text — and `test/fontFamilyTokenGuard.test.ts` fails if either file does it. Testids: `db-system-nav-font`, `db-field-system-font-ui` / `-pixel` / `-mono`, `db-system-font-preview`, `db-system-font-reset`. Tests: `test/systemFontTheme.test.ts` (registry ↔ tokens.css agreement, normalize roundtrip, applier) and `test/fontFamilyTokenGuard.test.ts` (no literal stack survives outside the two owning files, alias chains resolved transitively).
- **Project play resolution (System → 화면, 2026-08-24):** `system.playResolution?: { width, height }` authors the logical map/runtime viewport. Omission and an explicit 320×240 both normalize to the legacy default; custom values clamp to 320–1920 × 240–1080. `db-field-system-resolution-preset` offers 320×240, 426×240, 640×360, and 640×480, while the width/height fields allow bounded custom values. Custom values remain authorable: the diagnostics card reports the reduced aspect ratio, 16px reference-tile span, ceil-rounded minimum map size, partial-tile edges, undersized map count/list, and an estimated current-window fit scale as warnings rather than blockers. The title workbench preview uses the authored aspect ratio. The setting is applied on the next Test Play boot. `createPlaySurface`, Phaser boot, dialogue pagination, runtime DOM marker culling, and the lighting mask must resolve the same project value. Tests: `test/playResolution.test.ts`, `test/databaseSystemView.test.ts`, `test/playerBootFactory.test.ts`.
- **Editor boot welcome (2026-08-20):** After store.load and enterMode(edit), finishEditorBoot may overlay a canvas-scoped director briefing (`src/editor/editorWelcome.ts`, CSS `src/styles/shell/editor-welcome.css`) instead of the old full-screen cinematic welcome. Copy: "어떤 게임을 만들까요?" + one input + 만들기 + three start posters (몬스터 수집 / 회상 스토리 / 모험 JRPG) + 빈 맵으로 시작. Horror, farm, partner-raise, and action posters are not mounted. Each visible pack owns one stable `data-pack-id`. Illustrated-card start auto-sends to the current map via `setPendingWelcomePipeline` (`replaceWithBlank: false`); the separate blank-system-preset button confirms before the verified new-project transaction. Skip dismisses and then starts coach marks. Dismiss key `oprn:editor-welcome-dismissed` is set only after a completed action. Brush/standard coach is suppressed while the briefing is open (`markWelcomeIntentAppliedThisBoot`). Skipped when modeMounted, automation boot context, dismissed, or deep-linked `?project=`. Tests: `test/editorWelcome.test.ts`, `test/transactionalNewRemoteProject.test.ts`, `test/aiBootIntent.test.ts`. Playwright: `?forceWelcome=1`.
- **첫 방문 브리핑은 빈 프로젝트에서만 (2026-09-28):** 「어떤 게임을 만들까요? / 빈 맵으로 시작」 브리핑은 닫음 표시(`oprn:editor-welcome-dismissed`)뿐 아니라 **프로젝트 내용**도 본다 — `isBlankStartProject`(`src/project/projectBlankness.ts`)가 false(맵 2개 이상, 유일한 맵에 이벤트·칠한 타일·2/4층·그림자·높이, 공통 이벤트)면 띄우지 않는다. 닫음 표시는 출처(origin)마다 따로라 워크트리 포트·팀 호스트 주소·새 프로필에서는 늘 비어 있어, 다 만든 프로젝트 위에 브리핑이 떴다. `?forceWelcome=1` 은 내용과 무관하게 띄운다(e2e 는 예제 프로젝트 위에서 검증). 단위: `test/projectBlankness.test.ts`.
- **부팅 진행 막대 (2026-09-28):** `index.html` 의 첫 로드 로더에 진행 막대와 %가 있다. 번들 전에는 CSS 키프레임이 0→12%, 번들이 뜨면 `reportBootStage`(`src/app/bootLoader.ts`)가 prepare 12→20 · shared 20→35 「공용 자료 받는 중…」 · project 35→85 「프로젝트 불러오는 중…」 · editor 85→97 「편집기 여는 중…」 구간을 넘겨받고 `dismissBootLoader` 가 100%로 닫는다. 막대는 `transform: scaleX` 전환이라 프로젝트 역직렬화가 메인 스레드를 막아도 합성 스레드에서 계속 찬다(실측: JS 타이머 방식은 36%에서 9초 멈췄다가 85%로 튀었다). 문구는 한국어 원문이고 다른 언어는 DOM 번역 카탈로그가 바꾼다.
- **Title / opening workbench (System tab, 2026-07-15):** ?뚭쾶???쒖옉?붾㈃??is a left-fields + right live-preview workbench (`db-title-workbench`) grouped as fieldsets ?쒖떆/?ㅻ뵒??메뉴. Display: title text, presentation mode text|graphic|both (logo resource + X/Y when graphic/both), background resource picker (writes only titleScreen.backgroundResourceId ??never clears system.titleResourceId), layout title/menu X/Y, showInputHint. Audio: BGM music picker + play/stop, SE pickers cursor/confirm/cancel (kind sound, allowClear). Menu: per-option label + visibility; New Game visibility is locked checked+disabled. Live preview shows only visible menu labels via listTitleMenuOptions and logo per presentation mode. The preview column must remain content-sized, top-aligned, and sticky while the long settings column scrolls; do not let CSS grid stretch its label row and push the 180px stage down. Tool set_title_screen creates titleScreen when missing and nested-merges sounds/titleGraphic/layout. Default title art from bundled generated assets. Schema via normalizeTitleScreenSettings (menuVisibility, sounds, titleGraphic, showInputHint, musicResourceId). Code: databaseSystemView.ts, dbTools.ts, player.ts (startTitleBgm/stopTitleBgm, juice sound overrides), styles database/title-workbench.css. Tests: test/databaseSystemView.test.ts, test/titleScreenMusic.test.ts, test/titleScreenSettingsNormalize.test.ts, test/dbToolsIntegrity.test.ts, test/e2e/title-database-authoring.spec.ts.
- Elements tab ?뚯턀? 개수??resizes `database.elements[]` through `resizeElementRecords` (1~99, unique ids). Class 전투 명령은 인라인 워크벤치로 편집한다(`battleCommandsForActor` / `finalizeClassBattleCommands` / `moveEditableClassCommand`). 컬럼 헤더 + 종류별 컨텍스트 활성화(`skill`/`skillSubset` 일 때만 스킬 그룹·스킬 필드 활성화, 적 행동 basic/skill 모드와 동일 패턴), 인라인 ↑↓ 재정렬, 행 추가/삭제(최대 6), 고정 교체 footer, 전투 메뉴 미리보기. 별도 순서 설정 다이얼로그는 제거됨. Enemy action dialog supports live 기본 ?됰룞 vs ?ㅽ궗 modes (`applyEnemyActionBehaviourMode`); empty `skillId` is basic attack. Animation stage ?뚯? ?쇨큵...???뚮낫媛꾠?write selected-frame cells via `batchApplyCells` / `interpolateCells`. Battle Screen also edits `system.battleFlow` and `system.activeSlots`; battler animations edit idle and attack pose first-frame durations.
- Skill targeting is authored independently from effect kind. Skill scope controls and write schemas enumerate `self | ally | allAllies | enemy | allEnemies`; `allAllies` must stay aligned across `databaseBasicRecordFields.ts`, event-command advanced fields, database references, and `upsert_skill` in `dbTools.ts`. MP cost remains the shared flat-plus-percent record, and state add/remove rows remain `stateEffects`; neither cost nor damage/healing/support kind may implicitly rewrite scope. Runtime uses this authored value for both actor and enemy casters. The Skills view exposes `maxPp` (0 in the control removes the finite-PP field; persisted values clamp to 1..99) and `gen1CriticalRate` (`normal|high`), and `upsert_skill` supports the same fields.
- Skill typing reuses `SkillRecord.elementId` rather than adding a second skill-type field. Keep skill element pickers/reference validation compatible with `system.typeChart.types` because typed damage and STAB consume that id at runtime.
- **Element effectiveness compounding (B5 doc):** One `SkillRecord.elementId` drives up to three independent multiplicative factors at runtime (`src/battle/runtime.ts` `elementMultiplierFor`): (1) RM2k3 grade — target's `elementRates[elementId]` (A–E) → `DatabaseElementRecord.damageMultipliers[grade]/100` (A=2.0, C=1.0, D=0.5, E=0; negative = absorb); (2) Pokemon type chart — `system.typeChart.multipliers[attackType][defenderType]` × STAB(1.5 if attacker has the type); (3) equipment — `elementalDefenseIds` match → ×0.5. These COMPOUND: a typed skill vs a grade-A target with matching equipment can reach e.g. 2.0×1.5×1.5×0.5. The classic grade/equipment path requires a valid explicit actor/enemy `elementRates[elementId]`; an absent entry is not an authored C grade. Equipment reduction is reached only after that valid grade. Class rate entries are authored references, not a promise that this runtime helper directly reads class rates. There is no per-project mutual-exclusion; document this compounding when authoring both charts.
- **predict↔runtime parity (B1 fix):** `src/battle/battlePredict.ts` `predictSkillDamage` MUST resolve battler types via `battlerTypes(project, snapshot)` (speciesId-first) and `typeChartMultiplierForTypes`, the same path as `runtime.ts`. Do NOT revert to the recordId-based `typeChartMultiplierFor` for predict — player monsters have `recordId = instanceId` (not in `database.enemies`/`monsterSpecies`), so recordId lookup returns `[]` and silently drops type effectiveness + STAB. `battlerTypes` accepts a structural `BattlerTypeRef { speciesId?, recordId }` so both `MutableBattler` and `BattleBattlerSnapshot` share one path. Regression: `test/battleElementAdversarialFixes.test.ts`.
- **elementRates orphan scrub (B4 fix):** `databaseElementList.resizeElementRecords` truncates via `slice` and does NOT know about `elementRates`. The editor resize handler (`databaseElementsClassic.ts`) and load-time `repairProjectReferences` (`src/project/io/references.ts` `pruneDanglingElementRates`) scrub dangling `elementRates` keys from actors/enemies/classes — otherwise a truncated element id (e.g. `element_0006`) survives, and `nextUniqueElementId` reuses the same ordinal on regrow, silently reviving a stale grade (200% weakness) against an unrelated new element. `validateElementRates` reports dangling keys (mirrors equipment-element reporting). `elementRates` keys are strictly `database.elements[].id` (the editor only creates rows from `database.elements`); `elementIds()` unions typeChart types for `skill.elementId` validation but the scrub uses a database-elements-only set. **B4b root cause:** `normalizeRates` previously seeded `{ state_death: "C" }` into BOTH `stateRates` (correct — state_death is a state) and `elementRates` (wrong — not an element). Fixed in `databaseRecordModel.ts`/`databaseEnemyTroopRecordModel.ts` by moving the `state_death` seed to the `stateRates` call site only; `normalizeRates` now starts empty. Existing saves with stale `state_death` in `elementRates` are scrubbed on load by `pruneDanglingElementRates`.
- **Element kind field is live (B2 wiring, model caveat verified 2026-09-05):** `DatabaseElementRecord.kind` (`physical`|`magical`) selects mental defense only in the Gen1 model (`battleDamage.ts::usesMagicalDefense`). In Gen1, a magical skill element uses `target.mind`; physical or absent elements use `target.defense`. RM2k3 retains its existing defense formula regardless of this kind. Wired in `runtime.ts` (`isMagicalElement` → `applySkillLike({ useMagicalDefense })`), `battleDamage.ts` (`computeMagnitude` selects `target.mind` vs `target.defense`), and `battlePredict.ts` (`isMagicalElement` → `targetStats.mind`). The 물리/마법 radio UI in `databaseElementsClassic.ts` is live and meaningful. Keep the three paths (runtime, damage, predict) in parity.
- **Elements illustrated worksheet (2026-09-05):** `databaseElementsClassic.ts` composes the existing workspace primitives in identity → isolated percentage example/A–E worksheet → references order. `databaseElementPresentation.ts` owns an editor-only 17-ID generated-art motif map (not new assets or serialized fields), first resolvable linked-skill animation fallback, neutral missing art, signed numeric outcomes and model-aware defense disclosure. The shared `imageThumbnail` export preserves existing chroma-key and explicit image-load-failure handling. Name/kind updates refresh dependent identity in place; search changes only the list and no-match clear keeps the selected detail. The example starts at C, follows focused grade inputs, and never writes project/history for reference/grade selection. All bars share `max(100, ...abs(percentages))`, with zero-centered signed direction and a 100% reference line; result semantics follow the percentage, not the grade letter. Reset stays in place, multiplier clamps and coalesced history remain, add disables at 99, and resize still prunes dangling rates. References include skills, first equipment attack element, equipment defense and explicit actor/enemy/class rates. Tests: `test/databaseElementsUx.test.ts` (DOM/presentation coverage), `test/e2e/database-elements-ux.spec.ts` (real modal, desktop geometry, search/focus, custom names/art failure, dirty guard and downloaded `.oprn` ZIP data). Evidence lives in `output/evidence/battle-rules-ux/verification.md`; independent visual/CJK review passed all seven states (`output/evidence/battle-rules-ux/st_01a07318-manual-qa.md`). The exact browser spec passed directly against the built preview at `http://127.0.0.1:49242` (1 passed, retries disabled), without forwarding or proxy interception; only the intentional missing-image 404 remains. Two-axis pairwise overlap checks permit non-overlapping wrapping. Supervisor comparison found all 26 newly flagged test files also fail on unchanged `32ef1bcd`; narrow reruns of five load-sensitive files yielded 39 passes, one known base failure and zero new failure names. No new unit regression was found. Supervisor also confirmed the unchanged-base surface gate has the same five files, six failures and 107 passes; scoped implementation/QA requirements are satisfied, with final review and PR owned by the supervisor. The unrelated Gen1 prediction assertion in `battleElementAdversarialFixes.test.ts:157` also fails on unchanged HEAD (`9` versus `16`).
- **Reserved element field (B3):** `rateLabels` is **reserved/unused at runtime** — grades are hardcoded A–E in `isWeakness`/`isResistance`/`ELEMENT_DAMAGE_GRADES`; `rateLabels` is normalized-only and persisted for schema compatibility. No edit UI exists for it.
- **Species type membership vs `system.typeChart` (G006):** System tab authors `typeChart.types` + multipliers (`databaseSystemView.ts`); blank type list deletes `system.typeChart` (legacy neutral damage). On the Monster Species tab, when chart types exist, type UI is checkbox chips from `system.typeChart.types` (max 2 selected; third click rejected). Types stored on the species that are **not** in the chart surface a membership warn (`db-monster-species-type-warn`, ?쒗????곸꽦?쒖뿉 ?녿뒗 ??? ?╈? without clearing the outlier values. When the chart is empty/absent, free-text comma types remain (`db-monster-species-types-free`) with a hint to configure the System type chart. Skill typing still reuses `SkillRecord.elementId` against the same chart ids for typed damage/STAB.
- The Monster Species database tab edits optional `database.monsterSpecies[]` records. Keep its id/name/graphic/types/baseStats/captureRate/skillsByLevel/evolutions fields aligned with `MonsterSpeciesRecord`, `normalizeMonsterSpeciesRecord`, reference validation, defaults, and tool schemas.
- **Monster tabs hardening (2026-08-20, 전투·몬스터 영역 = enemies/monsterSpecies/troops):**
  - `captureRate` 는 0~1 도메인이 유일하게 옳다(`captureSuccessRate` 가 확률로 직접 쓴다). `normalizeMonsterSpeciesRecord` 가 1을 넘는 레거시 값을 `value/100` 으로 이관한다. 출하 기본 종족은 `0.4`. **주의:** 구 clamp 가 이미 `1.0` 으로 저장해버린 프로젝트는 마이그레이션으로 복구되지 않는다 — `scripts/repair-capture-rate-residue.mts` 로 복구한다(실측: `rpg-zzu-dungeon-example` 120종 복구).
  - 전투 진형 좌표의 단일 권위자는 `classicEnemyFormation(index)`(`src/battle/battleBattlers.ts`) 다. 적 그룹 뷰의 `DEFAULT_MEMBER`/`positionedMember`/`arrangeMembers`/예시 멤버가 모두 이 함수를 쓴다 — 에디터 좌표가 런타임 재배치(`x>150`)에 걸리지 않게 하는 유일한 방법이다. 미리보기는 `x/320`·`y/240`(모델 클램프와 일치), `x=150` 안내선(`db-troop-preview-recenter-line`), 아군 마커(`db-troop-preview-party-marker-N`, `battleX 252 / battleY 96+36i`)를 그린다.
  - 전투 이벤트 조건은 런타임이 전부 AND 로 평가한다. 조건 편집은 **첫 조건만** 교체하고 나머지를 보존해야 한다(`setFreshCondition`). `kindOfBattleEventCondition` 은 전용 폼이 없는 종류(selfSwitch/gold/timer/item/actorTurn/enemyTurn 등)에 `undefined` 를 반환하고, UI 는 경고 칩 + `조건 교체` 버튼만 보여 값 파괴를 막는다.
  - 숫자 필드 bounds 는 normalize 의 clamp 범위와 숫자까지 일치시킨다(권위: `databaseEnemyTroopRecordModel.ts`, `actionCombat.ts`, `monsterCollection.ts`). `enemy.level`(`db-field-enemy-level`)은 보상 레벨갭·포획 시작 레벨에 쓰이므로 `updateEnemyRecord` 패치 경로도 함께 유지한다.
  - 적 `transparent`/`flying`/`graphicHue` 는 런타임 소비자가 없고 화면 칸도 지웠다(2026-10-02, 공시도 삭제). 액션 전투 `aggroRange`/`moveIntervalMs`/`knockbackResist` 는 저작 가능하다.
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
- **검수한 몬스터 정체성 매핑 (2026-09-06):** `generated-enemy-leaf-fox`/`fire-pup`/`sparkit-fire`는 `public/assets/generated/monsters/corrected/`의 동명 PNG로 등록했다. 기존 `skeleton-archer`/`orc-shaman`/`spirit-fire`/`spirit-earth`/`spirit-water`/`wisp-blue` ID도 그 폴더의 검수 아트로 해석한다. 한국어 `풀잎여우`·`불꽃강아지`·`불씨강아지` 태그는 해당 리소스에만 붙여 잎/사마귀 아트를 여우로 오인하지 않는다. 새 기본 DB의 리프링/스파킷/아쿠아링은 각각 `generated-enemy-leafling-01`/`generated-enemy-sparkit-fire`/`generated-enemy-aqualing-01`, hue 0이며 타입·스탯은 그대로다. `enemy_mine_skel_archer`는 활을 든 `generated-enemy-skeleton-archer`를 사용한다. 적 아트 공유는 기존 슬라임 쌍과 궁수 쌍만 ID 목록으로 허용한다(`test/dbImageMatching.test.ts`); 다른 중복은 실패다. 트룹·대형 구형 데모 fixture는 변경하지 않는다. URL/파일 등록 회귀는 `test/generatedEnemyBattlers.test.ts`.
- **Default DB graphic matching + Notion-style image pipeline (G006):** enemies/species/items/equipment must not share one generic image for unrelated names. Extra enemies map 1:1 to generated battlers (`generated-enemy-zombie-01` ??; starter species use dedicated art (`leafling`/`sparkit`/`aqualing`/`king-slime`); tiered equipment/items use distinct `cc0-jetrel-*` icons. **Art pipeline:** shared prompt builder `scripts/lib/dbArtPrompt.ts` (`buildDbArtPrompt({ kind: "icon"|"monster", name, subject, tags? })`) enforces 16-bit JRPG / single subject / transparent / no text-UI-logo-watermark-franchise-photorealism negatives (`DB_ART_PROMPT_NEGATIVES`). **Callers of `buildDbArtPrompt` today:** `scripts/generate-default-item-icons.mts` only. The bundled title crest is registered in `generatedAssetResourceResolver.ts`; run `npm run clean:title-logo` when its generated PNG needs deterministic edge-connected checkerboard removal, then copy the inspected output into `public/assets/generated/title/title-logo-crest.png` and update the title manifest hash. Procedural `scripts/generate-db-item-monster-art.py` remains for matched battler/icon silhouettes. Register outputs in `cc0IconAssets.ts` / `generatedAssetResourceResolver.ts`, wire defaults, prove with `test/dbArtPrompt.test.ts`, `test/dbImageMatching.test.ts`, and `test/titleLogoAsset.test.ts`. Uniqueness gate is **blank-project defaults** (`createBlankProject` / `dbImageMatching`); some older demo fixtures (e.g. dew-village-demo extras) may still reuse battlers and are residual cleanup, not the blank-project contract.
- The Crops database tab edits optional `database.crops[]` records. Keep id/name/seedItemId/harvestItemId/harvestCount/stages/seasons/regrow/graphicStages aligned with `CropRecord`, `normalizeCropRecord`, reference validation, demo defaults, farming runtime, and `define_crop`.
- **Life authoring surface (2026-08-24):** Grouped Database navigation no longer mixes crops/residents under the ambiguous `수집` label. `전투·몬스터` owns enemies/monsterSpecies/troops plus the existing battle tabs; `생활` owns the renamed `농사·작물` and `주민 관계` tabs. Stable tab ids/testids remain `crops`/`db-tab-crops`, `characters`/`db-tab-characters`, and `monsterSpecies`/`db-tab-monster-species`. `databaseCropView.ts` reports time, farmable-map, tool, and seed/harvest-reference readiness; `databaseCharacterView.ts` reports gift/calendar/profile readiness plus orphan/unused identity warnings; `databaseMonsterSpeciesView.ts` reports the species → enemy → troop → field-spawn → drop pipeline. Each readiness card owns a direct navigation/selection action, while empty catalogs expose first-record actions (`db-crop-empty-add`, `db-character-empty-add`). The card body is the button (`action` without `onClick` promotes the whole chip); the chevron keeps the `*-action` testid but is no longer a nested button. System jumps call `requestSystemSection` before the tab click so 선물 lands on 시작 설정 (`db-field-system-gift-system`), 생일/작물 시간 land on 시간 (`db-field-system-time-enabled`), and 종족 방식 lands on 시작 설정의 몬스터 수집. Contract: `test/databaseLifeReadinessNav.test.ts`. These panels are derived editor UI only: they add no project fields, seed no authored content, and keep `characters` distinct from party Actors. Shared DOM/navigation helpers are in `databaseLifeUi.ts`; modal-scoped CSS is `desktop-record-shell/11-life-authoring.css`. Monster tabs can prepend `db-collection-gate-warn`, so the desktop grid must reserve explicit banner/header/workspace rows; otherwise the species workspace intercepts readiness-card clicks. Browser coverage is `test/e2e/stardew-life-content.spec.ts` at 1024×768 and 1440×900.
- Item records can set `farmTool:"hoe"|"wateringCan"` from the Items tab or `upsert_item`; farming runtime checks only inventory possession of those items.
- Monster gift, storage, and evolution event commands are `giveMonster`, `moveMonster`, and `evolveMonster`. NPC relationship commands are `changeFriendship` and `getFriendship`. Event editor labels, summaries, command bodies, branch path traversal, command factory defaults, runtime support metadata, interpreter execution, and command-reference validation should be updated together when these command shapes change.
- Monster collection write tools live in `src/editor/tools/dbTools.ts`: `define_monster_species` upserts species records including `types` and `evolutions`, `set_type_chart` writes the system type matrix, and `give_starter_monsters` creates or updates the standard three-choice starter event using `choices` plus `giveMonster`. `define_monster_species.graphic.monsterResourceId` and `upsert_enemy.monsterResourceId` share `ensureMonsterGraphic` with `make_action_enemy`: preserve registered explicit IDs, resolve only exact normalized identities or complete semantic-term matches, and reject unresolved explicit values with `invalid-args`. Missing graphics on visible records fail atomically with `monster-graphic-required` and explicit-ID recovery instructions; `transparent:true` permits intentional omission. Broad search, partial matches, wildcard browsing, and ID hashes never choose persisted art. Species graphic patches preserve omitted existing graphic fields. `make_action_enemy` accepts optional `monsterResourceId` and `transparent` on creation and update. Regenerate the tool catalog after changing any of these schemas. In a monster-party game, `upsert_enemy` copies the species learnset into `actions` and `skillIds` when `speciesId` is set and no action deals damage.
- Class promotion authoring lives on the Classes database record view and `src/editor/tools/dbTools.ts` as `define_promotion`. Keep `ClassRecord.promotions[]` validation, delete/reference scans, command summaries, nested `promoteActor` branch paths, and the tool catalog aligned whenever promotion requirements or branch semantics change.
- **Equipment effect summary chips (G006/G004):** Equipment detail form (`databaseEquipmentRecordView.ts`) shows a live chip row (`db-equipment-summary-chips`) via pure `equipmentEffectSummaryChips(record)`: effect-flag labels (?좎젣/2??공격/?꾩껜 공격/??, badges (?묒넀 ?λ퉬, ?二?, and counts (공격 ?띿꽦 N / ?띿꽦 방�뼱 N / ?곹깭 遺??N / ?곹깭 방�뼱 N); empty state is muted ?쒗슚怨??놁쓬?? Refresh chips on flag/badge/element/state edits. Play status menu detail text still surfaces runtime-relevant authored effects (double attack, elemental defense, state resistance). If equipment effect fields are added to DB records, update record normalization, DB tools, reference validation, battle aggregation, menu detail labels, **and** the summary-chip helper in the same change.
- Event command runtime parity badges are driven by `src/project/eventCommands/runtimeSupport.ts`. Command picker buttons and command-list rows share the badge renderer in `src/editor/panels/eventEditor/commandRuntimeBadge.ts`; keep `runtime-full | runtime-partial | editor-only` as the public support grades and update the support table when interpreter coverage changes.
- Enemy action switch picker controls should open the existing switch/variable picker when switches exist, and should be disabled with a clear title/ARIA reason when no switches exist.
- Switch/variable selection surfaces outside the utility tabs should include story flag ids when present, for example `0003: ?쒖옣怨?만남 쨌 met-mayor`. In the Database utility tabs, story flags are separated into a read-only `?ㅽ넗由??뚮옒洹?(?쎄린 ?꾩슜)` section so normal switch/variable rows stay visually clean. Switch and variable definitions have no configured count ceiling: new projects seed only one 20-row picker block for first-use command forms, `+ 추가` creates/reuses records on demand, and range authoring grows only through the requested last ordinal (including beyond 1000). Legacy projects that already contain 1000 unnamed preallocated slots remain readable and those unnamed rows stay hidden.
- The Terms utility tab edits optional `Project.meta.terms` fields grouped by battle, shop, inn, and common labels. Empty inputs delete the stored override and fall back through `src/project/terms.ts`; placeholders show the Korean defaults from `defaultTerms()` without forcing those values into old saves.
- `src/editor/databaseCommandReferences.ts` scans command-bearing database references, including common events and troop battle event pages. Keep `src/editor/databaseReferences.ts` as the message facade for delete blocking, including battle animation references from actors/classes and common-event delete checks.


## Beginner-centric adversarial review (2026-08)

`docs/reviews/db-beginner-adversarial-qa.md` is the current beginner-centric review of the whole Database modal: 24 surfaces x beginner/expert x 3 viewports, 289 consolidated findings (`docs/reviews/db-beginner-adversarial-qa-findings.md`), 25-heuristic disposition (met 2 / partial 15 / missing 8), and 14 evidence-linked improvement proposals (P0: timeSystem.onDayEnd delete guard, in-flight edit truncation on system section nav, virtualizer selection loss). The beginner-lane spec `qa-db-beginner-mode.spec.ts` was deleted on 2026-09-27 together with the editor modes; every field the beginner lane used to hide (`data-db-ux`) is now always visible. See `openwiki/testing.md` for the permanent + `_db-audit-*` diagnostic spec families.

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
- **Gallery view + category filter chips (W3):** `databaseRecordViewSession.ts` persists per-collection view mode (`oprn:database.viewMode`, `"gallery"|"list"`) and category filter (`rpg-zzu.database.categoryFilter`). Icon-bearing collections (items/equipment/actors/enemies/skills/classes/troops/states/battleAnimations) default to gallery; switch/variable/terms and other text collections stay list-only. Toggle buttons `db-view-toggle-gallery` / `db-view-toggle-list` are only rendered for gallery-eligible collections. Gallery cards (`button.db-gallery-card`, testid `db-record-card-<id>`) render a 48px thumbnail + name + category tag, windowed by the virtualizer (`databaseListVirtualizer.ts` columns option — 3 columns ≤1100px modal width, 4 above). Filter chips (`db-filter-chip-<id>`, "전체" = `db-filter-chip-all`) appear for items (ITEM_TYPES) and equipment (slots); they AND with the search query. The list view is preserved as a toggle — never remove it.
- **Modern control primitives (W4):** `src/editor/panels/databaseControls.ts` adds `sliderStepperField` (range+number pair, `-slider`/`-stepper` testid suffixes, clamped + step-normalized both ways), `segmentedControl` (native radio group — testid on the group, `-option` on each radio), `toggleSwitch` (checkbox `role="switch"`, Space/click native), and `avatarChipRow` (faceset circular chips, `aria-pressed`, `-chip` testid + `data-actor-id`). Existing `textField`/`numberField`/`selectField` signatures are unchanged. No custom focus traps; Escape keeps the modal's top-level routing.
- **Item/equipment inspectors (W4):** `databaseItemRecordView.ts` renders a header (96px icon + name `db-field-name` + type tag) above the workbench. Medicine HP/MP recovery % uses the slider/stepper (`db-field-item-hp-percent-stepper` etc., 0–100 step 5); 대상(scope) is a segmented control; usable actors are avatar chips (`db-field-item-usable-actors`, equipment items keep per-actor checkboxes `db-field-item-usable-actor-<id>`); menu/battle flags are toggles. `databaseEquipmentRecordView.ts` promotes the summary chip row (`db-equipment-summary-chips`, pure `equipmentEffectSummaryChips`) into the header next to icon + name + slot segmented control. The legacy duplicate name field was removed from `databaseRecordViews.ts recordForm` for items/equipment — the inspector headers own `db-field-name` (one element, Playwright strict-mode safe).
- **System Studio + section nav (W4.5, revised 2026-08-25):** `databaseSystemView.ts` splits the tab into 9 mounted sections (`db-system-nav-<slug>`: overview/party/display/resources/startup/optin/time/typechart/title). `overview` is the default and exclusively owns `databaseSystemStudio.ts`: the project-backed 시작 설정/파티/화면/시간 cards, a derived semantic state registry, the project-backed 전투 규칙/기능 확장/타이틀 cards, and a live title/current-value preview. The overview is a read-only summary and adds no authored fields; every ordinary card value must come from an existing `Project` field or a derived index. Unimplemented Save/Economy/Input editors stay hidden rather than appearing as placeholder cards, hard-coded completion/warning claims are forbidden, and preview facts are non-interactive until a real destination exists. State usage comes from `buildStoryFlagUsageIndex`, and card navigation delegates to the existing section/tab buttons. Switching sections only toggles DOM visibility — it never calls `store.update` (zero snapshots). Field testids (`db-field-system-*`) remain reachable inside hidden sections; structural contracts (party slots, time enable, type-list change re-render) are unchanged. `system-studio.css` consumes the shared cream Database palette, with a 184px section nav, 248px preview, and 18px content gutter beside the 56px global icon rail. Contracts: `test/databaseSystemStudio.test.ts`, `test/databaseSystemSections.test.ts`, `test/e2e/database-icon-rail.spec.ts`, and the ≥95% structural parity capture in `test/e2e/system-studio-visual.spec.ts`. Browser evidence: `output/evidence/system-studio/system-studio-backed-settings-1586x992.png`.
- **Type-chip matrix (W4.5):** `typeChartFieldset` renders one `button.db-type-chip` per attacker×defender pair with testid `db-type-chart-<attacker>-<defender>` and `data-value` (machine-readable multiplier; `data-state` = up/down/neutral/diag). Left-click cycles 0→0.25→0.5→1→1.5→2→3→4; right-click opens a clamped `[0,4]` step-0.25 popover (`db-type-chart-popover-input` / `-confirm`). The line above the matrix is an edit hint ("칸을 누르면 배율이 바로 바뀝니다"), not a read-only preview. `normalizeTypeChart` semantics are unchanged: blank type list deletes `system.typeChart` after confirm, 32-type cap, `[0,4]` clamp. `qa-system.spec.ts` still reads cell values via `data-value`.
- **Overview dashboard tab (W5):** `db-tab-overview` is the pinned first sidebar entry; it is never the default open tab (last-used tab persists via `rpg-zzu.database.activeTab`). `renderOverviewTab` (`databaseOverviewView.ts`) shows 9 collection stat **buttons** (`db-overview-stat-*`) that jump via `switchDatabaseActiveTab` (G006), then lazily injects the start-party power curve (inline SVG `db-overview-curve` + `db-overview-curve-legend`), monster HP-vs-hit scatter (`db-overview-scatter`), issue cards, and the ✨ AI 분석 button via `requestIdleCallback` (200ms `setTimeout` fallback) — only on the overview tab, never on first modal entry to another tab. `partyPowerCurve` reads `system.startActorIds` (authored start party), not leftover session party. Attack-stagnation issues jump to **classes**. The view has zero write paths. Evidence: `test/e2e/db-desktop-matrix.spec.ts` runs the full flow (modal → sidebar → gallery → filter chip → item slider edit → type-chip matrix → overview → dock toggle) at 1024×768 / 1280×800 / 1440×900 with console-clean assertions and `dbmodern-<viewport>-<step>.png` screenshots under `.superpowers/sdd/qa-shots/`.
- **Tileset graphic picker (2026-08-20):** `tileset-rm2k3-graphic-browse` is enabled (`설정...`). It opens `tileset-graphic-picker` listing bundled chipsets plus uploaded `chipset`/`tileset` assets (not `picture`). Same-id pick is a no-op unless `tilesPerRow`/`tileSize`/`count`/`passability` length is stale, in which case it remaps to `CHIPSET_SLICING` + `TILE_FRAME_COUNT`. Bundled EasyRPG and uploaded chipset/tileset both remap those arrays. Display shows the Korean chipset name; raw id stays in `title`. Tests: `test/databaseTilesetGraphicPicker.test.ts`.
- **Tileset tab slim (2026-08-31):** default surface is the chipset sheet + passage/layer. Per-tile `description` lives in a collapsed `<details>` on the knowledge tab (`tileset-tile-meaning-details`); group prose (`description` / `placementRules`) is likewise folded (`tileset-knowledge-prose`). Harness seed no longer copies group essays onto every `tileMeta.description` (`applyTileContract` in `combinedTown.ts` / `themePacks.ts`). The unused `최대 개수 (고정)` button, inline AI launcher, duplicate full-sheet button, and compose-tab dummy side pane are gone. `AI 타일셋` stays on the detail hero. Tests: `test/tilesetSectionTabs.test.ts`, `test/tilesetHarness.test.ts`, `test/e2e/oprn-tileset-readability.spec.ts`.
- **통행 붓 + 넓은 시트 (2026-09-01):** 타일 규칙(통행) 면은 칸 클릭 토글이 아니라 **통과/막힘/위 ★ 붓**이다. 시트에서 클릭·드래그가 그 규칙을 칠하고, 통과 칸은 글자를 비워 그림을 가리지 않는다. 레이어·나침반(4방향)은 오른쪽 얇은 인스펙터. 방향별 통행은 기본으로 열려 있고, 화살표를 눌러도 접히지 않는다. 통행 면의 라벨 입력은 빼 둔다(우클릭 의미 편집·지식 탭). 이름/그래픽/투명색 카드는 시트 **아래**. 목록 열은 176–200px. **전체창**도 같은 붓(통과/막힘/위 ★) + 순환이며 클릭·드래그로 칠한다. Tests: `test/tilesetSectionTabs.test.ts`.
- **Animation frame pick + battle-command door (2026-08-20):** `selectFrame` writes `editorState` **and** calls the form `rerender` so `.active` and the cell table follow the row/prev/next (do not rely on map `refreshPanels`). Battle Commands keep `db-field-battle-command-*` (no `database.battleCommands` path copy); kind labels match class `COMMAND_KIND_LABELS`; skill is a named `<select>` (`db-picker-battle-command-skill-*`) plus a visually hidden fillable `db-field-battle-command-skill-*`; `db-open-classes-tab` jumps via G006. Animation graphic uses `resourcePickerControl` kind `battle` (visible catalog name + 그래픽 선택/변경, fillable hidden id). Battle Screen uses a System2 resource picker. Tests: `test/databaseAnimationFrameSelect.test.ts`, `test/databaseBattleCommandsTab.test.ts`.
- **Battle Studio surfaces (2026-08-24, revised 2026-09-04):** `battleAnimations`, `battleScreen`, `battleCommands`, and `terrain` keep the Database modal's cream shell, sidebar, record list, and every existing field/testid, but share a canvas-first studio language through `databaseBattleStudio.ts` and `src/styles/database/battle-studio.css`. `battleStudioHeading` renders the description callers pass as `.db-battle-studio-sub` (scoped under the modal selectors). The shared underline navigation must call `switchDatabaseActiveTab` (G006) and never reopen the modal. Animation editing now puts its named graphic and full-width dark stage first, with a separate light transport and titled authoring sections below (see Phase 2 below); Battle Screen previews the resolved background/enemy assets beside system controls and a troop strip, and links out to system › 시작 설정 (`db-battle-screen-open-system-startup`, `requestSystemSection("startup")` + focus on `db-field-system-battle-ui-style`) for UI style / rule model which live only there; Battle Commands pairs a live menu canvas with class-link guidance and editable command cards; Terrain pairs presets, a live backdrop, and the existing record controls. Flow wording is `턴 전투` / `게이지 전투` everywhere (`엄격 턴제` retired; `라운드` retired). This is derived/editor UI only: zero schema or persistence changes. The root surface explicitly owns a one-column grid so legacy `.db-detail-form` desktop columns cannot scatter its regions. At 1024px the workspaces stack inside the existing detail scroll area without document-level horizontal overflow; animation remains preview-first and full-width at 1440px, while the other studios retain their existing columns. Contract: `test/databaseBattleStudio.test.ts`; browser evidence: `output/evidence/database-battle-studio/`.

## P2 spatial authoring (2026-08-25)

- **Linked animal housing (2026-09-08):** `setBuildingAnimalHousing` opts a building type into `animalHousing.allowedSpeciesIds`; enabling starts with no allowed species and fills missing per-level `animalCapacity` with zero. `commitAnimalCapacity` edits 0..9999 independently of generic `capacity`; zero is a real no-space value.
- Disabling housing or reducing animal capacity first shows the newly unassigned count with explicit Confirm/Cancel, leaving capacity and animal references unchanged until confirmation. `confirmPendingHousingChange` rechecks the type/level and impact, then applies `reconcileLinkedAnimalHousing` through `applyAuthoredHousingReconcile` in the same undoable update. Animals are retained. Cancel discards the proposal; an intervening allowed-species edit invalidates it even when the impact count stays equal. `invalidateFarmSpatialConfirmationContext` clears pending consent on modal close, and project-switch notifications clear it on project replacement, including same-ID replacement.
- Coverage: `test/animalHousingAuthoringUi.test.ts` and `test/animalHousingConfirmationLifecycle.test.ts`. Recorded native editor attempt8 authoring, confirmation/cancel, stale-species, close/reopen and save/reload evidence: [EDITOR-QA.json](../.omo/evidence/life-full-20260906/13/final-publication-candidate/EDITOR-QA.json); 1024/1440 captures include the linked-plus-legacy summary. This is editor evidence, not gameplay on that editor project.

- The Life group owns `farmSpatial` (`db-tab-farm-spatial`, label `농장 건물·집 꾸미기`). `databaseFarmSpatialView.ts` is a structured four-panel editor for `database.farmBuildingTypes`, `database.homeDecorationTypes`, `session.farmBuildingPlacements`, and `session.homeDecorationPlacements`; it never edits P1 `system.farmAnimalBuildings` or legacy `session.placeables`.
- Building levels expose footprint, generic capacity, build/upgrade gold and item costs, base/orientation graphics, and allowed maps. Decoration types expose their inventory item, footprint, movement blocking, allowed rotations/maps, and graphics. Starting placements expose type, level where applicable, map, x/y, and orientation. ID edits cascade to authored placements atomically; referenced type deletion is blocked.
- Structural changes use `recordProjectSnapshot`; field changes use `recordCoalescedSnapshot`, preserving Database dirty/undo behavior. The aggregate tab count includes both type tables and both starting-placement arrays.
- Product artwork is `/assets/farming/life-ui/decorating-card.png` (`db-spatial-hero-image`). CSS is isolated in `styles/database/desktop-record-shell/12-spatial-authoring.css`: a two-column 1440 layout collapses at a 980px container and again at 680px for the 1024 acceptance lane.
- Stable browser entry points: `db-spatial-workspace`, `db-spatial-add-building-type`, `db-spatial-add-decoration-type`, `db-spatial-add-building-placement`, `db-spatial-add-decoration-placement`, plus record IDs prefixed `db-spatial-building-*` / `db-spatial-decoration-*`. Focused coverage: `test/p2SpatialEditorAuthoring.test.ts` and the Database sidebar suites.

## 맵 그룹 — 개념 우선 탐색 Phase 1 (2026-09-05)

주 레일은 **개념 꾸러미**(`scratchConcepts`)와 **타일셋**(`tilesets`)뿐이다. 타일셋 폴더
DOM은 삭제했고 CSS로 숨기지 않는다. `commonEvents`는 시스템 그룹으로 옮겼다.
기존 탭 id와 렌더러는 유지한다. 검색은 새 이름·옛 이름·id를 찾으며 보조 목적지는
검색할 때만 결과 버튼으로 만든다(검색을 비우면 제거).

본문 위 문맥 도구줄: 개념 꾸러미 → **부품 보관함**(`structureKits`)·**기존 방 규칙**
(`tilesetSpaces`)·**기존 마을 설계**(`villages`); 마을 → **공통 생성 기본값**(`worldGen`);
타일셋 → **지형 효과**(`terrain`). 자식은 부모로 돌아가며 주 레일 강조와 모달 경로도 부모를
따른다. 칩셋 선택은 `oprn:database.selectedTilesetId` 한 키를 계속 공유한다.

타일셋 내부 탐색은 **통행·지형 / 자동 연결 / 타일 설명** 하나다. 옛 `tilesetAutotile`과
`tilesetUnlabeled` 점프는 각각 autotile, ai+미분류 필터로 들어가되 주 강조는 타일셋이다.
모드는 진입 시에만 맞추며 로컬 재렌더에서는 덮지 않는다. 맵 면은 공유 선택/모드 세션을
반영해 새로 렌더하고, 다른 도메인의 DOM 캐시·애니메이션 정지 의도는 그대로 둔다.
문맥 도구줄은 로컬 렌더러 호스트 밖에 있어 개념 편집 재렌더로 사라지지 않는다.

Phase 1은 탐색·선택·표현 변경뿐이다. 방 마이그레이션과 마을 합성은 후속 단계이며
`structureKits`·`interiorRoomKinds`·`scratchConceptBundles`·지형·마을 데이터는 그대로 둔다.
회귀: `databaseConceptFirstNav`, `databaseTilesetFolder`, `tilesetTabActivation`, `scratchConceptTab`.

## 오브젝트·공간 수정 복구 (2026-09-13)

- `spatialObjectMutations.ts`는 컨트롤러가 등록돼 있어도 `spatialAuthoring` 없는 프로젝트의
  기존 킷 수정·복제·추가·삭제를 기존 store/history 경로로 저장한다. 문서 없는 초안을 만들면
  `previewSpatialAuthoring`의 문서 검증에서 막히므로 컨트롤러 존재만으로 분기하지 않는다.
- Canonical 오브젝트의 그림이 코드 카탈로그 참조일 수 있다. 「그림 편집」은 그 그림을 새 킷으로
  굽고 선택된 설계의 graphic만 초안에서 교체한다. 다른 설계와 기본 카탈로그는 보존한다.
  그림 편집기 종료는 `openDialog`의 공통 onClose를 사용해 Esc·백드롭으로 닫아도
  초안 툴바를 갱신한다. 기존 킷 카드도 같은 graphic을 가리키는 설계에 연결하며, 설계가 없는 킷에는 작동하지 않는
  앵커·칩·graphic 선택 폼을 노출하지 않는다.
- 공간의 `room-rule` 카드는 `tilesetSpacesTab.renderKindInspector`의 이름·필수 역할·분위기·통로
  편집 폼을 재사용한다. 기본 방 종류는 「내 설계로 복제」로 고유 ID 사본을 만들고 편집한다.
  `roomKindOf`는 사용자 카드를 기본 ID보다 먼저 저작 레코드로 해석한다.
  레거시 수정은 store/history, canonical 프로젝트는 초안 → 미리보기 → 적용을 따른다.
- Canonical 공간에는 이름 입력이 있으며, 추가 후 「내 설계」 필터와 속성을 연다.
  방 규칙의 수정은 방 종류 규칙을 바꾸며 이미 시공된 공간을 재시공하지 않는다.
  좁은 창의 속성은 스테이지 위 스크롤 가능한 drawer로 열어 auto grid 행의 36% 높이로
  축소되던 입력 폼을 복구한다. 방 규칙 폼도 속성 패널 폭에 맞춘다.
- 회귀: `test/spatialLegacyEditing.test.ts`, `test/spatialObjectActions.test.ts`,
  `test/spatialSpaceActions.test.ts`. 브라우저: `node scripts/capture-spatial-edit-repair.mjs <baseURL>`
  (격리된 blankProject 검증), 증거: `output/evidence/spatial-edit-repair/`.

## 오브젝트 브라우저와 공간 배치 작업대 (2026-09-13)

- 설계 모드의 **오브젝트**는 `spatialAssetBrowser.ts`: 타일셋 목록 → 검색/기본·내 설계 필터 →
  그림 카드 → 상세 편집이다. 48개씩 페이지를 나누며 선택이 바뀌면 해당 카드가 있는 페이지를 연다.
  이름 검색은 결과 영역만 갱신하여 포커스를 유지한다. 앵커·칩·직접 graphic 참조는 고급 설정으로 접는다.
- 오브젝트 그림 편집기의 「타일 브라우저 열기」는 `tilesetTileBrowser.ts`의 독립 모달이다.
  원본 행·열 배열, 분류·이름·번호 검색, 24/40/64px 확대, 선택 타일 미리보기를 제공한다.
  확인/더블클릭은 오브젝트 편집기의 브러시만 바꾸고, 취소는 아무것도 바꾸지 않는다.
- **공간**은 `spatialSpaceWorkspace.ts`의 별도 배치 작업대다. 상단에서 공간을 바꾸고,
  `spatialSpaceObjectBrowser.ts`에서 같은 타일셋의 ObjectDesign을 찾아 클릭 후 빈칸 클릭 또는
  드래그로 배치한다. 중앙은 실제 공간, 오른쪽은 이름·형태·크기·선택한 배치의 속성이다.
  원본 공간의 고정 슬롯은 실제 오브젝트 래스터를 투명 배경으로 표시한다. 새 슬롯은 초안에만
  기록되며 미리보기 → 적용을 거친다. 기존 방 종류 카드는 호환 규칙 편집을 유지한다.
- `spatialStage.ts`의 browser 툴바는 추가·복제·미리보기·적용·되돌리기를 노출하고
  맵 배치/삭제/시공은 「배치·관리」에 둔다. 공간 설계가 없는 프로젝트는 상단 「공간 배치 시작」으로 활성화하며 그 전에는 새 공간 추가를 비활성화한다. 다른 4탭과 배치 모드는 기존 셸을 유지한다.
- CSS는 `database/asset-browser.css`, 소유 클래스는 `scripts/css-surfaces.json`에 등록한다.
  중첩 타일 모달은 DB 창 밖에 붙으므로 전역 토큰으로 색을 연결해야 한다.
- 회귀: `test/spatialAssetBrowsers.test.ts`; UI 증거 재생:
  `node scripts/capture-spatial-browser.mjs <baseURL>` → `output/evidence/spatial-browser/`.
  이 스크립트는 원격 저장이 꺼진 격리 테스트이며 콘텐츠 저작/원격 저장 증거가 아니다.

## 맵 그룹 — 공간 저작 셸 UX 계약 (2026-09-12)

타일·오브젝트·공간·장소·지역·세계 6탭은 `spatialShell.ts`+`spatialStage.ts`+`spatialGallery.ts`
공유 셸을 쓴다. 적대적 리뷰(`output/evidence/spatial-ux-review/`) 후 아래 계약이 생겼다.

- **기본 설계는 읽기 전용 카탈로그다.** draft 가 없는 카드도 스테이지·인스펙터가 실제
  내용을 렌더한다 — 세계는 `catalogWorldDesign`(`catalogSeed.ts`) + 지형 래스터,
  공간은 방 종류 요약(필수 역할·분위기), 장소는 카탈로그 번들 래스터.
  인스펙터에 「읽기 전용」안내와 사실표를 둔다.
  **지역은 예외(2026-09-22):** `REGION_CATALOG` 지형 어휘 더미 6종은 갤러리에 내지 않는다 —
  실체(설계·맵·편집 표면)가 없어 실제 자료를 가렸다. 지역 탭 기본 카드는 완성 맵 참고 사례
  (`REGION_REFERENCES`)뿐이고, 지역 탭은 장소 탭과 같은 목록-우선 레이아웃(목적 스트립 ·
  지역 라이브러리 필터 · 배지 · 「속성」 전까지 스테이지 접음)을 쓴다. 계약은
  [spatial-geography-ui.md](spatial-geography-ui.md) «Regions gallery contract».
- **미리보기는 `hasAuthoringDraft()` 일 때만 enabled.** draft 없이 누르면 생기던
  `authoring-draft-missing` 노출을 막는다. 「추가」는 `spatialDocumentPresent` 없으면
  사람 말 안내를 띄운다 — `spatialAuthoring` 문서 없는(레거시·dev) 프로젝트는 읽기 전용이다.
- **내부 토큰은 `spatialFeedback.ts` 의 `humanizeSpatialError` 가 한국어 문구로 바꾼다.**
  `code:path` 는 코드만 번역하고 경로를 보존. 모르는 문자열은 그대로 통과.
  `syncSpatialFeedbackSelection` 이 탭·모드·선택이 바뀔 때 stale 오류·삭제 확인을 걷는다 —
  지난 화면의 배너가 따라오지 않는다.
- **Escape 는 얕은 전이 상태부터 걷는다:** 지리 제스처 → 오류/삭제 확인 → 미리보기 →
  인스펙터 → breadcrumb → 모달. 리렌더로 포커스가 셸 밖(body)으로 나가도 동작하도록
  캡처 단계 document 리스너(`installSpatialEscapeLayer`)가 모달 닫기보다 먼저 소비한다.
- **카드 썸네일은 카드마다 달라야 한다.** 지역·세계는 프리뷰 컴파일 결과를 4px/타일로
  구운 `renderGeographyThumb`(사설 아틀라스 `world_structures_*` 맵은 프리뷰 프로젝트
  안에서 찾아야 한다 — 라이브 프로젝트에는 없다). 배치 맵 카드는 칩셋 통째 이미지가
  아니라 `cellsFromMapRect` 로 실제 맵을 굽는다. 공간은 `spaceCanvasLayout` 레이아웃,
  방 종류는 마루+필수 역할 가구 스프라이트 조합.
- **부제 중복 금지:** `cardSubtitle` 은 name==subtitle 이면 숨긴다. 계층 카탈로그 부제는
  이름 반복 대신 「장소 2곳」 같은 자식 수.
- **툴바 단어 버튼은 네이티브 `title` 로 설명**(`ACTION_HINT`) — 아이콘 전용 지연 툴팁
  롤아웃(`delayed-tooltip.md`) 대상이 아니다. 되돌아갈 부모가 없을 때 `←` 는 렌더하지
  않는다(항상 disabled 버튼 금지).
- **빈 상태는 카피가 있어야 한다:** 갤러리 `spatial-gallery-empty`(배치된 곳 없음/내 설계
  없음), 캔버스 `spatial-canvas-empty`, 인스펙터 「선택된 항목이 없습니다」.
- **1024×768:** 갤러리가 세로 카드 그리드에서 160px 가로 필름스트립으로 전환되고,
  캡션은 `flex: 0 0 auto` 로 내용 높이를 지킨다(썸네일이 나머지를 흡수).
- 시공 대상 폼은 접힌 `<details>`(`시공 대상 — 어느 맵의 어느 영역에 지을지`) 안에 있고
  시드는 정수 검증 + 설명을 단다.
- 회귀: `test/spatialFeedback.test.ts` + 기존 spatial 스위트. 브라우저 검증 스크립트
  `output/spatial-ux-verify.mjs`(52 체크, netns 격리 실행)와 스크린샷
  `output/evidence/spatial-ux-fixed/`.

## 타일 작업대 — 공간 셸 안 레이아웃 계약 (2026-09-13)

타일 탭(`spatialTilesTab`, `data-testid="spatial-shell-tiles"`)은 공유 공간 셸 안에
독립 타일셋 표면(`oprn-tileset-main`, `tileset-db-edit-area`)을 내장한다. 셸의
`<1199px` 컨테이너 쿼리(갤러리 필름스트립·2행 본문)와 독립 표면의 `<1180px`
뷰포트 규칙이 셸 안에서도 그대로 발동해 생기던 결함과 계약:

- **`.spatial-body` 는 행까지 되돌려야 한다.** 열(`grid-template-columns`)만
  고치고 `grid-template-rows` 를 놔두면 갤러리+스테이지가 32% 높이 행에 눌려
  작업대가 ~0px 로 붕괴한다(1024×768 실측 스테이지 178px). 셸 스코프
  `[data-testid="spatial-shell-tiles"]` 선택자가 `!important` 없이도 이긴다 —
  `spatial-collections.css` 는 `tilesets-autotile.css` 를 포함한 타일셋 시트보다 늦게 로드되고 특이도가 높다.
- **시트는 항상 왼쪽 넓은 열.** 비페인트 모드(ai/group)는 DOM 순서가
  `[사이드바, 시트]` 인데 무차별 `grid-column:1` 핀이 시트를 좁은 사이드바 열에
  가뒀다. `passage-paint`(3행 그리드)와 `autotile-compose`(tilesets.css 자체 배치)
  를 제외한 모드는 `minmax(0,1fr) minmax(260px,340px)` + 시트 `grid-column:1`.
- **인스펙터 토글은 셸 안에서 숨긴다.** `<1200px` 에서 토글 버튼이 나타나지만
  인스펙터는 `display:none` 이라 사막 버튼이었다 — 감춘다.
- **`.oprn-tileset-main` 은 grid 여야 한다.** `flex-direction:column` 이면
  「생성 감사」세로 레일이 본문 아래 빈 가로 띠로 깨지고 26px 접힘 계약이 깨진다.
- **시트 프리뷰 `min-height` 는 0.** 480px 강제는 짧은 모달에서 시트 하단을
  `overflow:hidden` 부모에 잘라먹는다 — 시트 자체가 스크롤 상자다.
- **줌 1x 추가**(`PREVIEW_SCALES`): 30열 시트(480px)가 스크롤 없이 들어가는 유일한
  배율.
- 회귀: `test/spatialTilesShellCss.test.ts`(CSS 계약) +
  `test/e2e/spatial-tiles-layout.spec.ts`(1024 생존·지식 탭 시트 넓은 열).
  캡처 `scripts/capture-map-tiles-fix.mjs`, 스샷 `verify-shots/map-tiles-fix/`.
- 게이트 주의: `oprn-db-`·`passage-` 클래스는 database 표면 어휘로
  `scripts/css-surfaces.json` 에 등록돼 있다 — 셸 스코프 규칙에서 써도 R2 에 걸리지
  않는다.

## 오토타일 설정 — 9칸/11칸/커스텀 카드 (2026-09-01)

옛 `tilesetAutotile` 경로와 내부 자동 연결 탭은 같은 면이다. 예전의 멤버 번호 나열·16칸
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

## 맵 → 개념 꾸러미 (2026-09-02 시작, 2026-09-05 개념 우선 Phase 1)

~~데이터베이스 레일에 **임시** 그룹을 두고, 그 안에 `개념 꾸러미`(`scratchConcepts`) 한 탭만 둔다.~~
**Phase 4(개념 통합)에서 임시 그룹을 졸업했고, 개념 우선 Phase 1에서는 맵의 주 진입점이다.**
`개념 꾸러미`(`scratchConcepts`)는 타일셋 폴더 안에 있지 않다.
세계·공간 종류·구조물과 아직 합치지 않는다 — 시설→장소→물건→칩 나무를 그림으로
저작하는 실험 면이다. `place_concept(query)` 가 이 필드를 읽어 시공한다.

**2026-09-03 — 이 탭은 템플릿 편집기다.** 「AI 는 소비만」을 철회했다. 여기서 고친 시설은 모델이 `get_concept_facility` 로 읽는 **출발점**이고, 모델은 요청에 맞게 장소·물건을 고친 `plan` 을 `place_concept` 에 넘겨 방 수·크기·내용물이 다른 시설을 짓는다(`openwiki/editor-ai-tools.md` 2026-09-03 항목). 사용자가 `required` 로 박은 물건을 모델이 빼면 경고가 남는다. plan 없이 부르면 종전대로 템플릿 그대로다.

- **2026-09-05 — 모든 AI 실내 생성의 정본:** 독립 방 세션·집·마을 연결 실내도 꾸러미를 읽는다. 미등록 시설 조회는 현재 장소·물건을 `sources`로 반환해 조합 설계를 지원한다. 삭제한 빈 꾸러미는 시공하지 않는다. 경로·검증: `openwiki/editor-interior-room-harness.md`의 「모든 AI 실내의 개념 꾸러미 계약」.
- 데이터: `tileset.scratchConceptBundles`. undefined 는 시드 전, 빈 배열은 사용자가 지운 상태.
- 실내 칩셋만 **시설 초안 묶음 19종**을 시드한다(`CONCEPT_FACILITY_TEMPLATES`: 기존 여관·민가·상점·술집·서재·대장간·교회·창고·길드 + 진료소·병영·학교·관청·연금술 공방·빵집·농가·귀족 저택·사냥꾼 오두막·은행, 여관이 첫째). 마을 칩셋에는 얹지 않는다. 옛 프로젝트에 여관만 시드돼 있으면 그대로다 — 나머지는 시설 띠의 「초안 넣기」로 골라 넣는다(재시드 아님, 사용자 선택).
- 기존 프로젝트에 일괄 추가: `npx tsx scripts/expand-concept-bundles.mts --project <id>`로 추가 예정 목록을 읽고 `--apply`로 저장한다. 기존 id/라벨은 보존하고 빈 배열은 거절한다. 프로젝트·타일셋 미러의 변경 시각을 비교해 충돌을 감지하며 저장 뒤 양쪽 원격 데이터와 앱 로드를 확인한다. 증거는 `output/evidence/concept-expansion/legacy-db-proof.json`.
- 물건의 그림은 같은 타일셋 가구 킷/`INTERIOR_OBJECT_CATALOG` id 를 가리킨다. 픽셀을 복제하지 않는다.
- **2026-09-05 — 용도 검수 보정:** 병실·병영·농가·저택·오두막 침대는 `event`만 사용한다. 현재 `sleep`은 유료 `inn` 동작이므로 수면 가능이라는 일반 의미로 붙이지 않는다. 여관·술집 객실의 숙박은 유지한다. 여관·저택의 피아노는 선택 가구다. 학교는 `study_desk`(기존 사각 탁자+앞쪽 걸상, 1×2) 두 세트를 교실마다 두고 책장은 자료실에 둔다. 은행은 거래 창구·장부·목제 보관장을 사용하며 금고 그림이나 금융 동작이 있는 것으로 표현하지 않는다. 최종 맵의 책상/걸상 쌍을 세 가지 seed로 검증한다.
- `expand-concept-bundles.mts --baseline <이전 꾸러미 배열.json>`은 저장된 꾸러미가 검토 전 버전과 **완전히 같은 경우에만** 수정 초안으로 갱신한다. 다른 편집이 있으면 보존한다. `--evidence <경로>`로 별도 저장·재로드 증거를 남길 수 있다.
- **2026-09-05 — 장소 구성 확장:** `conceptFacilityExpansion.ts`가 10개 시설과 30개 장소 구성을 추가해 총 19시설·51장소 레코드가 된다(반복 객실 수와 의미가 같은 장소를 합친 고유 개수는 아님). 접수·대기실과 기록 보관실은 공통 구성을 독립된 레코드로 펼친다. 농가·귀족 저택·사냥꾼 오두막은 크기·재질·가구 조합이 다른 주거 출발점이다. 새 픽셀 자산이나 진료·은행 거래 로직은 추가하지 않는다. `place_concept`/`get_concept_facility` 설명은 초안 라벨에서 생성하므로 새 시설의 자연어 도구 탐색도 같은 목록을 쓴다. 기존 저장 꾸러미와 명시적 빈 배열은 유지하며, 확장분을 기존 프로젝트에 적용하려면 「초안 넣기」 또는 명시적 데이터 저장을 사용한다.
- 칩은 내장 8종(`pass`/`block`/`event`/`transfer`/`loot`/`sleep`/`floor`/`wall`) + 사용자 자유 칩. 산문 배치 규칙이 아니다. 자유 칩은 엔진 무동작 메모 태그 — 시공 분류·이벤트·점수·컨텍스트가 모르는 칩을 무시한다. 규칙은 `src/project/types/conceptBundle.ts` 의 `CONCEPT_FREE_CHIP_PATTERN` / `validateConceptChipId` 한 곳이다: 빈 id·32자 초과·영문·숫자·-_ 외 문자를 한글 이유로 거절하고, 내장 칩은 항상 통과한다. 인스펙터 추가·이름 변경(`scratchConceptTab`), plan `parseChips`, 타일셋 검증(`shapeResourceFields`)이 같은 검증기를 쓴다. 화면에서 내장 칩은 토글 버튼, 자유 칩은 id 입력으로 이름을 바꾸고 지우기 버튼으로 삭제한다. 잘못된 입력은 `scratch-concept-chip-error` 에 이유를 보여 주고 저장하지 않으며, 이름 변경 실패는 예전 id 로 되돌린다.
- 화면: 작은 타일셋 셀렉트(`scratch-concept-tileset-select`) + 기존 물건 그림을 쓰는 시설 선택 + 장소 카드 + 물건 인스펙터. 옛 `scratch-concept-tileset-<id>`는 옵션 testid로 남는다. 장소 선택은 그 장소 소속 물건만 검사하고, 물건 칩·칠하기는 그 칩이 있는 장소도 선택한다. 빈 장소에는 다른 장소의 인스펙터를 남기지 않는다. 좁은 데스크톱에서는 인스펙터가 장소 아래로 이어지고 문맥 도구줄은 줄바꿈한다.
- 사용자가 고친다: 시설명, 장소 추가/삭제/이름, 물건 추가/삭제/이름/그림/그림 직접 칠하기, 칩 토글/자유 칩 추가·이름 변경·삭제, 장소 소속, 필수 여부. 모두 `store.update` 로 `scratchConceptBundles` 에 남고, 다음 `place_concept` 가 그 나무를 읽는다.
- 물건 그림(2026-09-04): 인스펙터의 「그림」 셀렉트(`scratch-concept-thing-graphic`)가 같은 타일셋 가구 목록(`objectsForTileset` — 프로젝트 킷 → 카탈로그 순)에서 `thing.objectId` 를 갈아 끼운다. 모르는 id(옛 나무·지운 킷)는 「그림 없음」 옵션으로 남아 미리보기에 「그림 없음」이 뜬다. 이름과 달리 물건 id 는 그대로라 시공·이벤트·필수 판정이 갈라지지 않는다.
- 그림 직접 칠하기(2026-09-05): 인스펙터의 「그림 칠하기/사본 만들어 칠하기」(`scratch-concept-thing-paint`)가 구조물 타일 에디터(`openStructureKitEditor`)를 연다. 사용자 저장 그림이면 그 킷을 바로 고치고, 카탈로그·시드(`learnedFrom: interior-catalog`) 그림이면 사본(`duplicateIntoTileset`)을 만들어 이 물건에 붙인 뒤 연다 — 원본 카탈로그는 그대로 둔다. 저장은 에디터가 즉시 하고 닫히면 인스펙터를 다시 그린다.
- 장소 카드 물건마다 바로 칠하기(2026-09-05): 각 물건 칩에 `scratch-concept-thing-paint-<thingId>` 가 있다. `ensureThingKitForEdit(tilesetId, bundleId, thingId)` 가 사용자 저장 킷 id 를 돌려주거나 카탈로그·시드면 사본을 만들어 `thing.objectId` 를 붙인다 — 인스펙터 버튼과 같은 경로. 피커 항목은 아직 물건이 아니라 칠하기가 없다. 계약: `test/scratchConceptTab.test.ts`.
- **장소 도면 필드 (2026-09-02 시공 개편):** 장소 레코드에 선택 필드 `role`(`entrance` 홀·정문 / `walkway` 복도 / `room` 방), `size`(`s` 5×3 · `m` 7×4 · `l` 9×5), `count`(1..4, 같은 장소 여러 개) 가 붙었다. 장소 카드의 도면 열(`scratch-concept-place-role-<id>` / `-size-<id>` / `-count-<id>`)에서 고친다. 필드가 없는 옛 나무는 기본값(방·보통·1)으로 읽고, 복도는 라벨(복도·통로) 폴백으로 알아본다. 검증기(`shapeResourceFields`)가 모르는 role/size 와 범위 밖 count 를 거절한다.
- 여관 초안 시드: 침실 `room·m·count 2`, 복도 `walkway`, 식당/홀 `entrance·l`. 도면은 남→북으로 홀(정문) → 복도 → 객실 ×2.
- **시설 띠·재질 (2026-09-02 시설 다양화):** 보드 위에 시설 띠(`scratch-concept-facilities`)가 이 타일셋의 꾸러미를 칩(`scratch-concept-facility-<bundleId>`)으로 늘어놓는다. `+ 시설`(`scratch-concept-facility-add`)은 빈 꾸러미를 만들고, 아직 없는 초안이 있으면 `초안 넣기…` 셀렉트(`scratch-concept-template-select`)가 그것만 보여 준다. 도구줄의 `시설 삭제`(`scratch-concept-facility-remove`)는 꾸러미를 지운다 — 마지막 것을 지우면 빈 배열이 남고 다시 시드하지 않는다(빈 화면의 `초안 N종 넣기`(`scratch-concept-seed-templates`)가 다시 넣는 유일한 길). 시설에 **벽 재질** `wall`(`cream`·`gold-brick`·`stone-brick`, `scratch-concept-facility-wall`), 장소에 **바닥 재질** `floor`(`wood`·`stone`·`plank`·`mat`, `scratch-concept-place-floor-<id>`)가 붙었다. 기본값(크림·나무)은 필드를 지운다. 시공 뒤 파이프라인 리틴트가 그 방 바닥·그 시설 벽면을 갈아 끼운다. 장소 카드에 **층** `level`(1~3, `scratch-concept-place-level-<id>`, 2026-09-03)이 더 붙었다 — 2층 이상 장소는 `place_concept` 이 `<mapId>_2f` 별도 맵으로 짓고 계단(맵 연결 칩) 물건이 층을 잇는다. 1층은 필드를 지운다.
- **도면 문법·구역·시설 소속 (2026-09-05):** 도구줄의 「도면」 셀렉트(`scratch-concept-facility-layout`)가 시설 `layout`(`row` 한 줄 / `double-row` 두 줄)을 고친다 — 기본 한 줄은 필드를 지운다. 장소 카드 도면 열에 「구역」 셀렉트(`scratch-concept-place-zone-<id>`)가 붙어 `zone`(`north` 북쪽 / `south` 남쪽 / 자동)을 고친다 — 자동은 필드를 지우고 두 줄 도면이 주방·창고 라벨을 남쪽으로 본다. 도구줄의 「시설 장소」 토글(`scratch-concept-facility-place-<id>`)이 꾸러미 장소 중 이 시설에 드는 것만 도면에 들인다 — 빼도 꾸러미 장소·물건은 남고 다시 넣으면 꾸러미 순서대로 붙는다. 계약: `test/scratchConceptTab.test.ts` 「도면·구역·소속」.
- 피커는 프로젝트 킷 뒤에 카탈로그에만 있는 소품(성상·과일 선반·항아리 선반·곡물 자루·잡화 상자·물통·주전자·스툴·붉은 카펫·짚 돗자리)을 이어 보여 준다 — 킷을 옛 카탈로그로 시드한 프로젝트에서도 고를 수 있다. 러그류(`rug*`)는 기본 칩이 통행 가능·바닥, 계단류(`stairs*`)는 통행 가능·맵 연결.
- 진입: `src/editor/panels/scratchConceptTab.ts`. 초안 데이터: `src/project/defaults/conceptFacilityTemplates.ts`. 계약: `test/scratchConceptTab.test.ts`, `test/conceptFacilityTemplates.test.ts`, `test/placeConceptTool.test.ts`. 시공 쪽 설명은 `openwiki/editor-interior-room-harness.md` 「개념 시설 시공」. 갤러리 보고서: `npx tsx scripts/gen-concept-facility-gallery.mts` → `reports/concept-facilities/index.html`.

## '구조물' 탭 — 두 출처 앨범 + 방 종류 문법 (2026-08-28)

`src/editor/panels/structureKitDbTab.ts` + 데이터 계층 `src/editor/panels/structureKitDbSources.ts`.

- **목록 규약은 등록 킷**: `tileset.structureKits`. 집 외장은 `author_house` 정본이 담당하므로 내장 파라메트릭 집 선반은 없다.
- **파라메트릭 집 킷(`kind:"house"`)은 완전히 제거됐다 (2026-09-13):** `StructureKitDef` 런타임 유니온은 `SectionStructureKitDef` 하나뿐이고 `HouseStructureKitDef` 타입·`builtinHouseStructureKits.ts`·`houseKitTools.ts`(빈 배열 스텁)는 삭제됐다. 옛 저장 데이터에 `kind:"house"` 레코드가 남아 있으면 **비활성(inert) 레거시**다 — `legacyImportValidation` 은 기록으로서 받아들이되, `legacyImport` 는 활성 카탈로그에 싣지 않고 `snapshotRaster`·인스턴스화는 `SpatialOperationError` 로 거부한다. 빌트인 지오메트리 폴백도 없다. `houseKit.ts` 의 `HOUSE_KITS`(재료 킷)는 다른 개념 — `author_house` 의 살아있는 실행 어휘다. Tests: `test/spatialLegacyImport.test.ts` 「inert legacy 포함」·`test/spatialInstances.test.ts`·`test/spatialAssetResolver.test.ts`.
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
- **아무 원본이든 편집은 `section` 으로 굽는다(bake).** 실내 카탈로그 오브젝트 등을 래스터 `rows` 로 전개한 뒤 편집한다(`structureKitRasterModel.ts`). 즉 복제는 사진을 찍는 행위다 — 원본 코드가 나중에 바뀌어도 구운 사본은 그대로다. 계보는 `learnedFrom: "db-authored"` 로 남는다. (예전에는 house 파라미터도 여기서 구웠으나, `kind:"house"` 는 제거돼 굽기 대상이 아니다.)
- **편집기는 DB 모달 위에 뜨는 전용 다이얼로그**(`structureKitEditorDialog.ts`, testid `structure-kit-editor`)다. 인스펙터 열이 352px 고정이라 9×8 킷이 들어가지 않는다는 치수 실측 때문이며, 인스펙터(`structureKitInspector.ts`)는 요약과 액션만 담당하도록 물러났다.
- 진입점: 도구줄 `structure-kit-new` → 빈 킷으로 직행. 표 행 더블클릭과 인스펙터의 복제·편집 버튼도 같은 편집기를 연다. 편집기 안은 `structure-kit-editor-canvas`, 타일 팔레트 `structure-kit-editor-tile-<tileId>`, 부위 도구 `structure-kit-editor-tool-part`, 부위 목록 `structure-kit-editor-parts`.
- **칸 계산 함수는 `rect`·`scale` 을 인자로 받는다.** 유닛 테스트 환경이 `environment: "node"` + `FakeElement` 라 `getBoundingClientRect()` 가 전부 0 이고 `getContext()` 는 `null` 이다. 내부에서 `event.clientX - rect.left` 를 읽으면 테스트가 항상 (0,0) 을 보게 되므로 순수 함수 경계를 이렇게 그었다 — 클릭 좌표 → 칸 매핑의 실제 증명은 e2e 몫이다.
- **크기 조절은 부위 손실을 숨기지 않는다.** `resizeKit` 은 새 크기 밖으로 나가는 부위를 보고서로 돌려주고, 편집기가 그 사실을 사람에게 알린 뒤 반영한다.
- **AI 메타는 초안과 승인이 분리된다.** `StructureKitAiMeta`(`description`·`placementRules`·`tags`·`role`·`repeatability`)에서 AI 초안(`structure-kit-editor-ai-draft`)은 폼을 채우기만 하고, `structure-kit-editor-ai-accept` 를 눌러야 `store.update()` 가 일어난다. **어떤 자동 경로도 `origin` 을 `"user"` 로 만들지 않는다**(제로 부트스트랩). 미승인 메타는 인스펙터가 `structure-kit-ai-unapproved` 로 구분해 적는다.
- **구조물 스탬프는 사람 팔레트 전용이다 (2026-08-31).** 집 시공은 `author_house`.
- **`repeatability` 가 시공 반복을 지배한다.** 이 값이 없으면 우물·간판처럼 한 채로 완결인 구조물도 이어 찍힌다. `ai.repeatability === "fixed"` 면 1회로 고정하고 `undefined` 는 기존 동작을 유지한다 — 하위 호환. 이 반복 규칙은 사람 팔레트/`applyStampStructureKit` 경로의 계약이다.
- **AI 가 받는 것이 넓어졌다.** `src/ai/contextBuilder.ts` 가 구조물마다 설명·배치규칙·반복 여부를 함께 출력하고(설명은 100자로 자른다), `structureKitTools.ts` 의 도구 응답도 `ai` 를 싣는다. 이름만 보고 추측하던 상태를 끝낸 것이다.
- **파일 포맷은 `oprn-structure-kits` v1**(`structureKitFile.ts`; 파일 접미사 `.oprn-kit.json`. 2026-09 개명 전 판별자 `rpgzzu-structure-kits` 파일도 읽어 새 판별자로 정규화한다). 파일에 들어가는 순간 사진이 된다 — 받는 쪽에 같은 코드가 없어도 열린다. 가져오기는 `planImport` 가 3단으로 판정한다: 포맷·버전 검증(미래 버전 거부) → 칩셋 경계 확인(`structure-kit-import-mismatch`) → 서명 기준 중복 판정. 같은 파일을 두 번 넣어도 사본이 쌓이지 않는다.
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

## Battle-animation editor autoplay (2026-09-05)

- `databaseAnimationRecordView.ts` owns playback intent in a WeakMap keyed by the retained record host passed from `databaseRecordViews.ts` (standalone forms default to owning themselves), not project data. This survives the real modal's 450ms interaction-grace flush and replacement form. Entry/new record starts looping at frame zero after a usable graphic loads; reduced motion starts stopped with manual Play available. The existing editor 67ms cadence, `assetScale` geometry and runtime contracts are unchanged.
- Stop restores the selected editing frame using current store cells. Frame row/previous/next selection stops playback before the form rerender; field rerenders keep that stopped intent. Empty/missing/failed graphics and frames without usable visible cells disable Play and render no substitute effect.
- `databaseAnimationPreview.ts` disposes the prior binding on rerender, ignores obsolete image completions, pauses genuinely cached detached tabs, and resumes only their retained playback intent. `database.ts` explicitly calls `disposeAnimationPreviewsIn` on cache eviction, project invalidation, force-fresh rendering and whole-panel replacement; detached DOM ancestry alone is not proof of cache membership. Record replacement and modal close release intervals and the DOM lifecycle observer. No mutation, schema change or remote persistence is added by preview playback.
- Regression coverage: `test/databaseAnimationPreview.test.ts`, `test/databaseAnimationAutoplay.test.ts`, `test/databaseAnimationModalIntent.test.ts`, `test/databaseAnimationCacheLifecycle.test.ts`, existing frame-select/stale-cell/sheet-scale tests, and the autoplay/modal-intent browser specs. The modal regressions subscribe before the actual parent refresh and deliver its grace timer plus scheduled frame; the old 402ms-only advance missed that path. Cache tests count observers across repeated real invalidations, cached-tab resume and close. Evidence and RED/GREEN output: `output/evidence/battle-animation-ux/p1-implementation.md`.

## 스킬 탭 `연출` 카드 = 살아 있는 애니메이션 스테이지 (2026-08-30)

- 스킬을 고르면 `연출` 카드가 시트 첫 칸을 자른 정지 이미지 1장이 아니라 **자동 반복 재생 스테이지**다. `renderSkillAnimationStage`(`src/editor/panels/databaseSkillAnimationStage.ts`)가 `db-skill-animation-preview` 안에 인셋 스테이지 웰 `db-skill-animation-stage`(픽셀 그리드 + 중심 십자선), 셀 레이어 `db-skill-animation-cells`(`data-frame-index`), 프레임 카운터 `db-skill-animation-frame-counter`(`3 / 12`), 시트 메타 칩 `db-skill-animation-sheet-meta`(`96×96 · 5열 · 15fps`), 재생/정지 토글 `db-skill-animation-toggle`(`aria-pressed`)을 렌더한다. 기존 `db-skill-animation-preview` testid 와 `.db-skill-animation-preview-frame` 클래스는 그대로 유지된다.
- 프레임 전진의 정본은 `src/editor/panels/eventEditor/showAnimationPlayback.ts` **하나**다. `playShowAnimation(stage, layer, source, { loop, onFrame, onStop })` 이 15fps(`SHOW_ANIMATION_FRAME_MS = 1000/15`)·시트 좌표·크로마키 규약을 소유하고 이벤트 편집기 표시면과 스킬 스테이지가 그걸 공유한다. `playShowAnimationOnce` 는 그 위의 얇은 래퍼다.
- **스킬·이벤트 표시면에 새 `setInterval` 재생 루프를 만들면 결함이다.** 애니메이션 탭의 기존 재생기(`databaseAnimationPreview.ts`)는 별개 편집 화면이며, 2026-09-05부터 아래 폼 수명 계약으로 자동 반복한다. 스킬·이벤트 재생기를 여기서 더 늘리지 않는다.
- 타이머 수명은 하드룰이다. `renderPreviewPanel` 은 표시면을 `replaceChildren` 하기 **전에** 이전 핸들의 `stop()` 을 부르고, `renderSkillRecordForm` 은 폼 단위 `WeakMap`(`activeAnimationStages`)으로 레코드 폼이 교체될 때 이전 스테이지를 죽인다. 픽커 변경도 `bindAnimationPreviewRefresh` → `renderPreviewPanel` 로 같은 경로를 탄다.
- 왜 이렇게 엄한가: 분리된 DOM 에 인터벌이 살아남는 것은 이미 한 번 출하된 실측 결함이다(커밋 `2ed96476`, 미부착 유예가 무한이어서 버려진 표시면에 프레임을 계속 그렸다. 2틱 상한으로 고쳤다). `test/e2e/zz-qa-dbmodal-attacks.spec.ts:168` 은 모달을 10회 열고 닫은 뒤 stray timer 0 을 단정한다.
- 정지 상태도 1급이다. `animationId` 가 없으면 기존 `(애니메이션 없음)` 빈 상태를 유지하고, 프레임이 1장이면 첫 프레임 정지 렌더 + 토글 `disabled`, `prefers-reduced-motion: reduce`(또는 `window.setInterval` 이 없는 헤드리스 호스트)면 자동재생하지 않고 첫 프레임에 서서 토글로만 재생한다.
- 스타일은 `src/styles/database/skill-item-visuals.css` 안에서만 늘린다. 색은 `.database-modal-backdrop` 아래 `--db-studio-*` 토큰만 쓰고(하드코딩 hex/rgba 금지), **새 CSS 파일을 만들지 않는다**(`scripts/check-css-budget.mjs` 파일 수 래칫).
- 커버리지: `test/databaseSkillAnimationStage.test.ts`(자동 반복 + 카운터 추적, 1프레임 정지, reduced-motion 정지, 토글 왕복, 표시면 교체 후 분리된 스테이지의 인터벌 정리), `test/databaseSkillItemForms.test.ts`(스테이지·셀·시트 메타·토글 계약), `test/eventEditorShowAnimationPreview.test.ts`(loop 랩어라운드와 `onFrame` 이 기존 1회 재생을 깨지 않음).

### retro2003 도트 전투 미리보기 (2026-09-28)

- `연출` 카드 맨 위에 **도트 전투 무대** `db-skill-retro-stage`(`databaseSkillRetroStage.ts`)가 붙는다. 조건: `retroClassSkill(record.id)`(계약 48종) 또는 `retroSkillRecipe(record)`(런타임 레시피 17종 + 속성·이름·효과 추정). 둘 다 없으면 그리지 않는다.
- 무대: 논리 240×136, CSS `scale` 로 카드 폭(최대 480px = 2배)에 맞추고 pixelated. 배경 plains 네 장 겹 배경, 오른쪽 파티 셋(가운데 = 계약 `actorId` 의 전투 도트, `resolvePartyBattleCharset` → 시트 3×8 + `cast/<id>.png`), 왼쪽 적 셋(슬라임·박쥐·늑대 48px 3×3). 회복·아군 버프는 레이어가 파티 위에 올라간다.
- **순서의 정본은 순수 함수** `src/battle/retroSkillTimeline.ts`: `retroClassSkillTimeline(contract)` / `retroRecipeTimeline(RETRO_SKILL_RECIPES 항목)` → `[ms, pose|move|hide|fx|projectile|screen|hit|sound]` 사건 목록, `retroTimelineStateAt(timeline, t)` → 그 시각의 무대 상태. 런타임(`retroSkillChoreography`)은 아직 이 함수를 쓰지 않는다 — 계약 48종의 런타임 연출을 붙일 때 같은 함수를 쓰면 두 화면이 같은 순서가 된다.
  레이어 규칙: user 는 준비 순간, projectile 은 방출(투사체보다 앞의 target 은 조준), 나머지는 착탄부터 목록 순서로 55% 겹쳐 이어 재생. 칸 폭은 계약 `frame`(32·64·128) 그대로이고 screen 은 1.25배로 무대 가운데. 필살기 = 어둡게 → 컷인(띠 + 초상 + 스킬 이름) → 대형 레이어 + 번쩍임·흔들림.
- 조작: `▶ 재생`(`db-skill-retro-play`, 처음부터 + 효과음), `반복`(`db-skill-retro-repeat`), 속도 `0.5×/1×`, 경과 시간 칩, 레이어 칩(키·anchor·규격, 404 면 `그림 없음`). 자동 반복은 **무음**이고 소리는 버튼을 누른 회차에만 난다. 피해·회복 숫자는 표시용(위력 기반)이며 지원 스킬에는 없다.
- 타이머: rAF 루프 하나, 스테이지 루트별 WeakMap 컨트롤러. `stopSkillAnimationStagesIn` / `resumeSkillAnimationStagesIn` 이 `stopRetroSkillStagesIn` / `resumeRetroSkillStagesIn` 을 함께 부르므로 탭 전환·레코드 전환·모달 닫기가 기존 경로 그대로 멈춘다. 떨어진 루트는 2틱 뒤 스스로 멈춘다. reduced-motion·rAF 없음 → 대표 시각 정지 화면. 없는 시트는 그 레이어만 빠진다.
- 목록: 도트 연출이 있는 스킬 썸네일 모서리에 이펙트 한 칸 배지(`db-skill-retro-badge`, 행 `data-retro-fx`). 스킬 탭에는 직업 필터 칩(전체·전사·수호자·마도사·정찰병·성직자·궁수 — 계약 classId 또는 직업 습득표·skillIds)이 뜬다. 이 필터는 세션 메모리만 쓰고 `oprn:database.categoryFilter` 에 저장하지 않는다(아이템·장비 전용 계약 유지).
- 시각 확인: 세션 로컬 `.omo/editor-skill-stage/capture.mjs`(가짜 시계로 16ms 씩 전진, 계약 스킬이 없는 새 프로젝트면 메모리 스토어에만 레코드를 넣는다).

#### 확장 6직업·몬스터 도트 (2026-09-28 mx-ed)

- 직업 칩에 사무라이·닌자·무도가·음유시인·드루이드·마녀(`class_samurai` … `class_witch`)를 더했다. 배우 기록이 없으면 `FALLBACK_BATTLERS` 로 그린다: 사무라이 `charset-battler-actor3-0-samurai`(마도사 actor3-0 의 변형), 닌자 actor3-2, 무도가 actor3-5, 음유시인 actor3-6, 드루이드 actor3-4, 마녀 actor4-7. `CHARSET_BATTLERS` 에 아직 없는 변형 id 는 `battlerPaths` 가 `charset-battlers/<id>.png`·`cast/<id>.png` 로 조립하고, 그 그림이 404 면 밑바탕 칩(actor3-0)으로 물러난다. 양옆 두 배우는 계약 순서에서 시전자 다음 둘(같은 세대끼리 선다).
- 적 편은 `retroStageEnemyLineup`(레이어 키 낱말 → 테마 줄 셋)으로 스킬마다 다르다. 성·저주는 언데드, 불은 불 정령·오크, 얼음·물은 물 정령·리치, 번개는 철 골렘·부유하는 눈, 자연은 벌·식충 식물·독사, 음악은 하피·미믹, 투척은 산적·고블린, 대지·무술은 멧돼지·고블린, 베기는 사마귀·리자드맨. 필살기 과녁은 96px(암흑=마왕, 검·대지·무술=트롤, 그 밖=드래곤), 내려찍기는 골렘. 앞자리만 큰 셀을 쓰고 `enemyHomes` 가 뒤 둘을 밀어 둔다(x ≥ 28). 발은 시트 계약의 바닥 y = cell−4, 대기 칸 길이는 시트의 `idleFrameMs`. 없는 시트는 그 적만 숨는다. 128px target 시트(파산장·용권 멸살 착탄)는 발 아래 24px 기준이다.
- `pixelEnemySheets.ts` 에 확장 30종을 등록했다(총 40). 대기 칸 길이는 각 README 권장값, 권장값이 없는 짐승 10종은 이동 방식 기본값이다.

### 적 탭 도트 미리보기 카드 (2026-09-28 mx-ed)

- `databaseEnemyPixelPreview.ts`: `pixelEnemySheet(monsterResourceId)` 가 있는 몬스터만 기존 「미리보기」 아래 `db-enemy-pixel-preview` 카드를 둔다(`databaseEnemyStudio` 의 `enemyPixelSlot`, 리소스·색조·투명·이름이 바뀔 때만 다시 그린다). 무대는 논리 240×128(plains 겹 배경, 과녁 아군 actor1-0)이고 CSS scale 로 늘리며 pixelated 다.
- 버튼은 `대기`·`공격`·`피격`·`쓰러짐`(`db-enemy-pixel-{idle,attack,hit,dead}`)이다. 공격은 windup 360 → move 320 → attack 300 → recover 360ms(`enemyPixelBeats`, 순수 함수)이고 근접형은 move 칸에서 아군 쪽으로 파고든다. shoot·breath·식충 식물(`IN_PLACE`)은 제자리다. 착탄 칸에서 과녁 아군이 hit 칸이 된다. 9칸 표(`db-enemy-pixel-cells`)는 칸 하나를 눌러 정지 보기, 다시 누르면 대기로 돌아간다.
- 타이머: rAF 하나, 스테이지별 WeakMap 컨트롤러. `stopSkillAnimationStagesIn` / `resumeSkillAnimationStagesIn` 이 `stopEnemyPixelPreviewsIn` / `resumeEnemyPixelPreviewsIn` 을 함께 부르고, 떨어진 루트는 2틱 뒤 멈춘다. 감속 모드에서는 대기 a 에 서 있고 버튼은 대표 칸 하나만 보인다. 시트가 404 면 카드를 조용히 걷는다.
- 목록: 도트 시트가 있는 몬스터 썸네일 모서리에 대기 칸 배지(`db-enemy-pixel-badge`, 행 `data-pixel-sheet`). CSS 는 `database/modern/enemies.css` 에만 더했다(새 파일 없음).
- 시각 확인: 세션 로컬 `.omo/editor-mx/capture.mjs [skills|enemies|all]`(새 프로젝트 메모리 스토어, 계약 스킬이 없으면 메모리에만 넣고 저장하지 않는다). 모달을 닫은 뒤 도는 루프 0, pageerror·시트 404 0 이다.

### 몬스터 스킬 미리보기 (2026-09-28 med)

- 계약은 `src/assets/retroMonsterSkills.ts`(스킬 42 · slug → 스킬 목록, 레벨대마다 1~5개). 편집기 쪽 전부가 `databaseMonsterSkillStage.ts` 에 있다: 순수 타임라인 `monsterSkillTimeline`(사건 형식·상태 계산은 `retroSkillTimeline.ts` 것을 그대로 쓴다), 레이어 그리기 `createMonsterFxPainter`, 스킬 탭 반전 무대 `renderMonsterSkillStage`, 레코드가 없을 때의 계약 둘러보기.
- 몬스터 시트 9칸은 pose 사건에 싣는다: windup=`attack_windup` · move=`walk_b` · attack=`attack` · recover=`attack_follow`(`monsterCellForPose`). lunge 는 직업 파고들기와 같은 박자(질주 130ms · 복귀 190ms · 여운 260ms), 나머지는 여운 520ms.
- 레이어 크기(논리 px, 무대가 2배로 그린다): 32·64 칸 그대로, 대상·전원 위 128 칸은 절반(화면 1배), screen 128 은 무대 높이 × 1.25. **screen 층은 배우 뒤**(`db-*-screen-layer`)에 둔다 — 앞에 두면 심판의 하늘·눈보라가 시전 몬스터를 통째로 덮었다(1차 캡처). 투사체는 몬스터 몸 앞에서 왼→오로 난다(계약상 첫 칸이 오른쪽을 본다). 404 시트는 그 레이어만 생략한다.
- 적 탭 카드: slug(`pixelEnemySlug` = 시트 파일 이름)의 스킬마다 `db-enemy-pixel-skill-<id>` 버튼, 머리에 「스킬 N개」(`db-enemy-pixel-skill-count`)와 모션 칩, 아래 설명(`aria-live`). 대기·공격 버튼이나 칸 정지로 바꾸면 스킬 층·어둡게·흔들림을 지운다. 감속 모드에서는 착탄 한가운데 한 장면.
- 스킬 탭: 직업 칩 뒤 `db-filter-chip-monster`(「몬스터」, `RETRO_MONSTER_FILTER_ID`, 판정 `isMonsterSkillId` = 계약 id 또는 `skill_mon_`). `renderSkillRetroStage` 는 계약 몬스터 스킬이면 반전 무대(`db-skill-mon-stage`, 몬스터 왼쪽 시전 → 아군 셋 오른쪽 대상, 시전 몬스터 = `monsterCasterFor` 의 첫 slug)를 돌려준다. skill_mon_* 레코드가 아직 없으면 몬스터 칩 목록 자리에 계약 42개 선택 상자(`db-skill-mon-browser`)가 뜬다. 타이머는 `stopRetroSkillStagesIn` / `resumeRetroSkillStagesIn` 이 `stop/resumeMonsterSkillStagesIn` 을 함께 부른다.
- 시각 확인: 세션 로컬 `.omo/editor-mon/capture.mjs <회차>`(기본 프로젝트 `/`, Playwright 가짜 시계로 정확한 시각에 찍는다). 마왕 5개 · 서릿 리치 3개 · 슬라임 1개, 「암흑의 심판」「화염 브레스」 모두 pageerror 0.

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

> **2026-09-12 — 표면 위치 변경.** 마을은 장소가 아니라 **지역**이다. `villages`
> 레거시 라우트는 이제 `spatialRegions` 로 가고, 세션은 `tab:"regions"` +
> `regionKindFilter:"settlement"` 로 열린다 — 이 탭의 저작 화면은 지역 스테이지의
> `.spatial-legacy-host` 에 마운트된다. `villagePresets` 는 지역 갤러리의
> `regionKind:"settlement"` 카드이자 정주지 지역(`RegionDesign.settlement`)의
> 레시피, `villageTemplates`(집 형태)는 계속 장소 카드다. 계약:
> `openwiki/spatial-geography-ui.md` 「Settlement regions」.

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

## 날개마다 층수를 정한다 — 계단식 2층 (2026-09-11)

예전에는 층수(`stories`)가 **집 전체에 하나**뿐이었다. 그래서 "2층 본채 앞에 1층 현관 날개" 같은 계단식 집은 시공기의 열 구간 검사에 걸려 거부됐다 — 실측: `a-main-plus-front` 가 `열 x=2의 구간 높이(6)가 최소 7보다 작습니다` 로 실패. 사진 같은 "위층이 드러나는 2층 집" 을 만들 길이 아예 없었다.

- **`FootprintWing.stories`** 가 이제 날개별 층수다. 시공기(`stampFootprintHouseKit.storiesAt`)가 열마다 그 열을 덮는 날개의 층수를 읽어 벽 밴드(2 + (2×층수 − 1))를 정한다. 층수를 **선언한 날개가 이긴다** — 선언 없는 날개가 먼저 와도 계단식 의도가 조용히 무시되지 않게.
- **나인슬라이스 런 경계는 역할이 아니라 날개의 가로 범위다 (2026-09-11 실측 결함).** 층수가 다른 두 날개가 가로로 맞닿으면 왼쪽 날개의 윗층 벽(중단 행)과 오른쪽 날개의 아래 벽(상단 행)이 **같은 행**에서 만나 역할이 같아진다. 역할 연속으로 런을 재면 좌측 끝 타일이 오른쪽 덩어리의 왼쪽 모서리에, 우측 끝 타일이 왼쪽 덩어리의 오른쪽 모서리에 붙는다(사용자 지적: "우측 벽을 붙이는 방식이 좀 잘못됐군"). 그래서 좌우 끝은 그 칸을 덮는 날개(층수 선언 날개 우선)의 가로 범위로 정한다. 회귀: `test/houseTemplates.test.ts` 의 "층이 다른 두 날개가 맞닿아도 각 덩어리가 자기 좌우 모서리로 마감된다". 기존 단일 덩어리 골든(연습04·연습08·ㅁ자)은 그대로다 — 런 경계가 같은 날개 안에서는 예전과 동일하기 때문이다.
- **저작 표면도 같은 규칙을 쓴다.** `shapeReason()`(규약 검사)과 `minWingRun()` 이 열별 층수로 최소 높이를 재고, 템플릿 레코드(`VillageTemplateWing.stories`)·내장 카탈로그(`HouseTemplateWing.stories`)·`houseTemplateWingsAt()`·미리보기(`housePreviewMap`)가 값을 잃지 않고 전달한다.
- **내장 카탈로그 4종 교체(A자 → 계단식).** `tier-front`(7×12) `tier-wide`(8×11) `tier-symmetric`(8×12) `tier-l`(8×13). 각 형태는 2층 날개 + 1층 날개를 조합해 만든다.
- **A자(피라미드) 지붕 삭제.** 사용자 지시로 킷 `aframe-stone` 과 템플릿 `aframe-*` 4종을 엔진·카탈로그·AI 프롬프트·평가 하네스에서 전부 걷어냈다. 지붕 대각 축(6번)은 표준 사선 지붕 과제(`roofGrid` / `t8-roof-diagonal`)로 교체됐다 — 용마루 인셋 폭·좌우 세로 트림·모서리 투명 캡의 레이어 분담을 본다.
- 커버리지: `test/houseTemplates.test.ts`(계단식 2층 시공·층수 미선언 폴백·최소 높이 거부), `test/houseTemplateCatalog.test.ts`(tier-* 날개 층수·열 구간 높이), `test/villageAuthoringData.test.ts`(내장 34종 왕복), `test/villageHousePreview.test.ts`(34종 전부 렌더), `test/benchmark*.test.ts`(6번 축 교체).

### 지붕 가장자리 판정은 "다른 지붕면인가"다 (2026-09-11 실측 결함)

계단식 2층을 넣은 직후 **오른쪽 지붕 접합이 잘못됐다.** 2층 본채 지붕이 1층 날개 지붕과 같은 면으로 취급돼, 본채의 옆 트림(376/377)이 통째로 생략되고 두 경사면이 한 장처럼 이어졌다 — 표로 보면 접합부 x5 y5~y8 이 `377`(트림)이어야 하는데 `404`(몸통).

- **원인**: 지붕 가장자리를 "옆 칸이 지붕인가"(`inRoof`)로만 판정했다. 높이가 다른 지붕이 맞닿으면 서로를 같은 면으로 본다.
- **고치면서 한 번 더 틀렸다**: 처마 행이 다르면 다른 면이라고 했더니 **정당한 ㄱ자 집(연습08 골든)까지 쪼개져** 옆 트림이 잘못 생겼다. 층수가 같은 ㄱ자는 날개 길이만 달라도 한 지붕면이고 처마가 계단처럼 내려간다 — 이건 맞는 그림이다.
- **정본 판정**: 지붕 칸마다 그 열 구간의 **벽 밴드(=층수)** 를 실어 두고(`roofRunBand`), 벽 밴드가 같아야 같은 면(`sameRoofFace`)이다. 층수가 다르면 지붕 높이 자체가 달라 별개 면이고, 층수가 같으면 길이 차이는 같은 면이다. `houseTemplates.test.ts` 의 계단식 2층 검사와 `houseKit.test.ts` 의 연습08 골든이 이 경계를 양쪽에서 잡는다.

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

**2026-10-02 개정 — 적은 그림을 만들지 않는다.** 전투가 전부 도트 측면이 되면서 적의 그림 옵션을 뺐다(아이템만 남음).
enemy allowlist 에 `monsterResourceId` 를 더해 LLM 이 도트 몬스터 140종(`PIXEL_ENEMY_PORTRAIT_URLS`) 중에서 고르고,
목록 밖이면 `pickPixelMonsterId` 가 이름 조각 → 슬라임으로 맞춘다. 결과 미리보기는 그 도트 몬스터의 정지 그림이다.
적 그래픽 칸의 「AI로 만들기」와 소재 고르기의 몬스터 생성도 지웠다 — `runtime-battle.md` 「전투는 전부 도트 측면」.

리소스 kind 는 종류마다 다르다 — 적은 `monster`, 아이템은 `picture`. 아이템 아이콘 피커
(`kind:"icon"`)가 업로드 자산 중 `picture`/`monster`/`system` 만 목록에 올리기 때문이다
(`databaseResourcePickerDialog.ts` `uploadedMatchesKind`). 그림은 `assets.uploaded[id].dataUrl`
로 들어가고 `resolveAssetResourceUrl` 이 업로드를 먼저 보므로 썸네일·전투 화면이 그대로 집는다.

Tests: `test/aiDatabaseGeneration.test.ts`, `test/generatedArtworkAlpha.test.ts`,
`test/imageGenerationClient.test.ts`.

### AI 검토 오버레이 — 레코드 카드로 before → after 를 보고 적용한다 (2026-09-15)

헤더 `AI 어시스턴트`(`database-ai-toggle`) 가 여는 것은 **DB 창 안을 덮는 검토 오버레이**다.
`src/editor/panels/databaseAiBar.ts` 가 소유하고, `databaseModal.ts` 는 `createDatabaseAiBar` 를 부르고
`element`/`toggle` 을 놓으며 `navigate` 만 주입한다. 목업·결정 근거는
`docs/2026-09-15-db-ai-review-overlay-mockup.html`.

- **검토 게이트는 `deferApply` 한 줄로 생긴다.** 오버레이가
  `sendAiAssistantMessage(text, { deferApply: true })` 로 보내면 `aiTurnRunner` 의 apply-now 분기가
  `deps.holdProposal` 로 갈라져 **스토어를 건드리지 않고** 초안을 패널이 든다. 결과의
  `pendingProposal{ before, after, callCount }` 가 카드의 재료이고, 적용·폐기는
  `applyAiAssistantProposal()` / `discardAiAssistantProposal()` 다. 적용은 데크와 **같은** 커밋 게이트
  (`applyProposal` → `applyProposedProject`)를 지나므로 내역·스냅샷·되돌리기가 그대로 붙는다. 그 사이에
  기준 프로젝트가 바뀌었으면 `stale-base` 로 반려되고 사유가 상태줄에 남는다. `deferApply` 턴은
  마일스톤 자동 적용도 끈다(`autonomous=false`) — 안 그러면 「적용 전」이라는 화면의 말이 거짓이 된다.
  초안을 돌려주지 않는 호출자(MCP·외부 전송)에겐 종전대로 즉시 적용 + 「바꾼 것 N개」 + 되돌리기다.
- **Pi 이관은 아니다.** Pi 병합기는 DB 의 **신규 레코드만** 얹는다
  (`mapBundle.ts createdDatabaseEntries` → `createdById`) — 기존 레코드 수정(HP 튜닝)은 병합에서 사라진다.
  DB 표면을 Pi 로 옮기려면 DB 스코프 병합 경로를 먼저 만들어야 한다.
- **카드 한 장 = 레코드 하나.** `diffDatabaseRecords`(`src/project/databaseRecordDiff.ts`)가 두 프로젝트의
  `database` 를 컬렉션·레코드·필드 경로로 비교하고(중첩 2단까지 폄 — `stats.maxHp` 같은 점 경로),
  `databaseAiChangeCards.ts` 가 그린다: 썸네일(적=`monsterResourceId` · 액터=`faceResourceId` ·
  아이템=`iconResourceId`→`imageResourceId`) + 이름·id·동사 배지(변경/추가/삭제) + 필드별 `before → after`
  + 수치 델타 칩. 참조 id(드롭 아이템 등)는 `databaseRecordNameById` 로 사람 말이 된다
  (실측: 「드롭 아이템 없음 → 회복약」). changeLedger 를 안 쓰는 이유: 그쪽은 `이름: 이전 → 이후`
  **문장**이라 썸네일 해석·델타 계산·레코드 점프에 필요한 신원과 원값이 없다. 영역 라벨은
  `DATABASE_AREA_LABELS` 를 공유한다(changeLedger 에서 export).
- **추가 레코드는 필드를 6개만 보이고 「이동」이 없다.** 새 레코드는 모든 필드가 「바뀐 것」이라 다 쓰면
  아이템 하나가 21줄을 먹었고(실측), 이름은 카드 머리가 이미 말한다. 이동을 뺀 이유도 실측이다:
  아직 적용되지 않은 id 는 현재 프로젝트에 없어서 선택이 첫 레코드로 미끄러졌다(「동검」 → 「회복약」).
- **그림이 바뀔 때만 두 장.** `*ResourceId`·`*CharsetId` 필드가 바뀐 레코드는 「지금 / 적용 후」를
  그리고(`database-ai-card-gfx`), 스탯만 바뀌면 썸네일 한 장이다. 삭제 카드는 그림 없이 슬림(`is-slim`).
- **검토가 걸려 있는 동안에는 새 요청을 받지 않는다** — 초안이 덮여 쓰이면 사용자가 본 카드와 실제
  적용되는 내용이 갈라진다. 토스트로 「적용하거나 버린 뒤」를 안내한다.
- **상태줄 단계**(`data-phase`): thinking → working → **review** → done/error. review 에서는 입력·제안·
  되돌리기를 숨기고 적용·버리기만 남긴다(검토 중에는 되돌릴 것이 없다). 적용 뒤에야 되돌리기가 나온다.
- **「바꾼 것 N개」는 이 턴이 *실행한* 쓰기 툴 수이지 적용된 수가 아니다.** 적용 여부의 유일한 근거는
  `DatabaseAiTurnSummary.applied` 이고 되돌리기 단추도 그 값으로만 붙는다. 검토 게이트 턴이 초안을 돌려주지
  않으면(`pendingProposal` 없음) 쓰기 툴이 돌았어도 적용된 것이 없다 — `deferApply` 는 스토어를 건드리지
  않으므로 그때의 사실은 「프로젝트는 그대로」다. 사유는 `runOutcome.execution` 을 사람 말로 옮긴다
  (`budget-exhausted`·`awaiting-user`·`cancelled`, `failed`/`blocked` 는 세션의 마지막 상태 문장).
  **실측 2026-09-15 라이브:** 슬라임 maxHp 300·exp 40 요청에서 쓰기 툴이 성공 3건 · 실패 6건으로 찍히고 턴이
  예산 소진으로 끝나 초안이 버려졌다 — 저장소는 그대로(`STORE_CHANGED {maxHp:false,exp:false}`, maxHp 78)
  였는데 예전 판정은 「완료 · 바꾼 것 3개 — 화면에 바로 반영됐어요」라고 말했다. 지금은 빨간 상태 +
  되돌리기가 숨겨진다. 증거 `.omo/evidence/db-ai-review/live-03-error.png`(사유 문구의 오타는 그 뒤 교정 — 문장 내용은 같다).

#### 예전 인라인 바 (2026-09-03) — 이 절이 위 오버레이로 대체됐다

아래는 배경 기록이다. 세션·풋터·제안 칩 계약은 그대로 살아 있고, 레이아웃과 적용 정책만 바뀌었다.

- **왜 다시 만들었나(실측):** 예전 바는 `sendAiAssistantMessage` 를 fire-and-forget 으로 던지고 토스트
  「채팅 패널에서 제안을 확인하세요」만 남겼다. DB 창은 모달이라 채팅 패널이 **뒤에 가려지고**, AI 가
  `tune_enemy` 로 몬스터 HP 를 64→300 으로 바꿔도 화면에는 흔적이 없었다.
- **같은 채팅 세션을 쓴다.** 별도 LLM 파이프라인이 아니다. 진행은 `aiAssistantBridge` 의 읽기 API
  (`getAiAssistantStatus` · `getAiAssistantAudit` · `abortAiAssistantTurn`)를 400ms 폴링해 그 턴의 감사
  항목만(`startIndex` 이후) 그린다: 요청 원문 → 상태줄(`data-phase` thinking/working/done/error) →
  바꾼 것(쓰기 툴 요약, 실패는 「실패 —」 접두어) → 답변(마크다운 강조 제거) → 행동(중단·되돌리기·채팅에서
  이어가기·지우기). 읽기 툴(`find_tools`·조회)은 「바꾼 것」에서 뺀다 — 브리지 감사 항목이 `mode`/`ok` 를
  실어 준다(`aiChatPanel.ts collectAudit`).
- **적용 뒤 되돌리기는 `undoMapEdit`** 이고 라벨에 되돌릴 항목 이름을 적는다. 전역 승인 게이트는 여전히
  없지만(`approvalPolicy.ts`), **이 표면만은 `deferApply` 로 자기 게이트를 갖는다**(위 참조).
- 바에 「실패 — 'upsert_enemy' 커밋 거부(무결성 오류)」가 찍히던 원인은 모델의 자리표시 id(`skill_0001`)였고,
  지금은 `upsert_enemy` 가 사유를 돌려주고 요약이 첫 위반을 싣는다(`openwiki/editor-ai-tools.md` 2026-09-03).
- **컨텍스트 풋터는 그대로다:** `[컨텍스트] 에디터 전체 요청 · 현재 화면: 데이터베이스 DB 탭 <라벨>,
  선택 레코드: <이름>(<id>)` (`databaseAiContextFooter`). buildSpec 정규식과 도구 노출 키워드가 이 형식을
  읽는다. `window.__oprnDbAiLastRequest` 훅도 유지.
- **제안 칩은 탭·선택 레코드로 만든다**(`databaseAiSuggestions`): 레코드 탭이면 「선택 레코드 다듬기」·
  「비슷한 것 하나 더」, 그룹별 밸런스 문장 하나(파티=성장 곡선, 몬스터=난이도, 시스템=스위치·변수…),
  「이 탭 점검」. 개요처럼 레코드가 없으면 「다음 할 일」. 범용 맵·이벤트 문장은 없다.
- **레이아웃(오버레이 이후):** `ai-bar.css`(index.css 에서 studio-v2 **뒤**에 읽는다). 오버레이는
  `.database-modal-window` 기준 `position: absolute` 이고, 위·아래를 `--database-ai-top` /
  `--database-ai-bottom` 이 잡는다 — 패널이 **열 때마다 헤더와 발 단추 높이를 실측**해 넣는다
  (도크·최대화·좁은 폭에서 둘 다 바뀐다. 실측 1440×900: 헤더 44px · 발 단추 52px · 오버레이 57→835).
  **발 단추를 덮지 않는 것은 장식이 아니다:** `.database-modal-footer` 가 같은 z 층에서 오버레이 위에
  그려져 결정 단추를 잡아먹었다(실측: 푸터 835→887 · 적용 817→845 — `elementFromPoint` 가 푸터를
  돌려줬다). 닫기·저장 길도 검토 중에 열려 있어야 한다. 패널은 `max-width: 880px`, **카드 목록만**
  스크롤하고 결정 단추 줄은 항상 보인다. 답변은 `flex: 0 0 auto` + `max-height: 84px` — 답변을 줄이면
  글자가 반줄로 잘렸다(실측). **행동 줄에 sticky 금지** — 턴 상자가 스크롤하던 시절의 `bottom: -10px` 가
  남아 `overflow: hidden` 인 상자 밖으로 나가 같은 단추를 또 잘랐다. 창 높이 820px 이하면 썸네일 88→64px.
- **입력에서 Escape 는 오버레이만 접는다**(stopPropagation) — 문서 층 모달 스택이 받으면 DB 창이 닫혔다.
- Tests: `test/databaseRecordDiff.test.ts`(구조 diff·델타·그림 필드·추가/삭제·상한),
  `test/databaseAiChangeCards.test.ts`(카드 DOM·썸네일·두 장 그림·슬림 삭제·추가 카드 이동 없음·값 표기),
  `test/databaseAiBar.test.ts`(제안·풋터·턴 요약·DOM 계약·폴링·Escape **+ 검토→적용/버리기·이동·
  검토 중 전송 차단**), `test/databaseModalAiConnection.test.ts`(모달 통합), e2e `test/e2e/qa-db-ai-dock.spec.ts`.
  브라우저 재현: `QA_BASE_URL=http://127.0.0.1:<port> node scripts/qa/db-ai-review.mjs` — 모델을 부르지
  않고 `send` 만 모킹해 실제 DB 창에서 카드·이동·적용·버리기·1024×768 을 겁는다(기하 실측 포함).
  증거: `.omo/evidence/db-ai-review/*.png`(추적됨 — `output/` 은 gitignore 라 증거가 남지 않는다).
- **e2e `qa-db-ai-dock.spec.ts` 의 M7 케이스는 기준선부터 빨간불이다(이 개편 전·후 동일).** 실측:
  23행 `db-tab-enemies` 클릭이 30초 타임아웃 — 레일의 몬스터 그룹이 접혀 있어 단추가 `hidden` 이다.
  AI 코드가 돌기 **전**에 죽는다. 고치려면 탭 전환을 클릭 대신 `switchDatabaseActiveTab` 로 해야 한다
  (`scripts/qa/db-ai-review.mjs` 가 그 방식을 쓴다). M8 두 케이스는 통과하되, **같은 dev 서버를
  QA 스크립트가 직전에 몰면 오염돼 플래키하게 실패한다**(실측 1회) — 깨끗한 상태에서 다시 재어라.
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

**중복 선언 정리 (2026-09-06).** `light-theme.css`, `sidebar.css`, `record-list-modern.css`,
`modern-controls.css`, `workspace-modern.css`, `desktop-record-shell/11-life-authoring.css`,
`14-party-ux-fixes.css`, `modern/troops.css`에서 동일한 선택자·속성의 뒤쪽 선언에 가려지는
118개 선언과 빈 규칙 16개를 제거했다. 살아 있는 규칙의 위치나 import 순서는 바꾸지 않았다.
주석뿐이던 `troops.part-1.css`와 그 import도 제거했다. 선언별 근거는
`.omo/evidence/css-refactor/declarations.json`, 감사와 검증 요약은
`reports/2026-09-06-css-cascade-audit.md`를 본다. 앞으로 공용 문법을 고칠 때는
Studio v2의 최종 소유 규칙을 먼저 확인하고 앞선 시트에 같은 속성을 다시 추가하지 않는다.
일반 `.database-modal-window`는 다른 작업 창도 사용하므로 DB 전용으로 간주해 삭제하지 않는다.
테마의 살아 있는 important 규칙, 동적 import 시트, 도킹·최대화 예외와 호환 폴백은 별도 계약이다.

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
— 어절로 줄바꿈. `modern/enemies.css` 의 레코드 라벨 · `actors.part-3.css` 의 그래픽 패널 라벨은 ellipsis 를 소스에서 걷었다. 좁은 수치
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


## 직업 승급 트리 · 스킬 트리 (2026-09-05)

파티 그룹에 별도 그래프 저작 탭 두 개가 있다. 승급 간선은 기존 `ClassRecord.promotions`,
스킬 트리는 선택적 `Project.growth`를 쓴다. 소유권·저장·미리보기·런타임 계약은
[성장 트리](growth-trees.md)를 먼저 읽는다.

## 미회수 편집 후속 통합 (2026-09-05)

- 구조물 삭제 토스트는 개념 물건 참조가 있어도 카탈로그 id가 남으면 원본 그림으로 돌아갔다고 안내한다. UUID 사본처럼 폴백이 없을 때만 그림 부재 오류를 표시한다. 기존 가져오기·가구 분류 경로는 유지한다. 계약: `test/structureKitDbTab.test.ts`.
- 구형 전투 명령 안내는 실제 동작인 `방어(구형)`·`교체(구형)`으로 표기한다. 설명 글꼴은 DB 모달 규칙보다 우선하며 안내 열은 88px로 긴 이름을 담는다.
## 마을 설계서 (2026-09-05)

마을 탭에 설계서 저작 화면을 연결했다. 기존 프리셋은 명시적으로 전환하며, 새 설계서는 외형·배치·자연·실내·주민 설정과 기본 설계서 선택을 한곳에서 다룬다. 상세 계약과 경계는 [마을 설계서](village-design.md).


## 구조물 증분 메타 정정 (2026-09-05)

- AI 초안은 growthAxis가 있으면 모순되는 repeatability를 버린다. 사람 저작값은 보존하고 축이 설정된 동안 반복 셀렉트만 비활성화한다. 축을 비우면 원래 반복값으로 돌아간다. 축을 바꿀 때 즉시 다시 그린다.
- 칸 힌트가 없으면 힌트 도구를 고르기 전까지 빈 목록을 접고, 도구 설명과 실제 아이콘(grid/rectangle)을 쓴다.
- 목록·인스펙터는 `structureKitGrowthText`로 같은 축 문구를 쓴다. 사람 스탬프 `applyStampStructureKit`의 조인 안내는 실제로 보낸 repeat/repeatY에만 붙인다(undefined도 생략이다). AI stamp 툴을 부활시키지 않는다.
- 계약: `test/structureKitEditorDialog.test.ts`, `test/structureKitTools.test.ts`.


## 개념 회수 UI 직접 렌더 QA (2026-09-05)

`DEV_SERVER_PORT=9901 node scripts/qa/concept-recovery-editor.mjs`는 실제 CSS와 `renderScratchConceptTab`·구조물 편집기를 작은 HTML 호스트에 열어 도면·구역·시설 소속·시드 그림 사본·증분 축 반복값 보존을 검증한다. 원격 저장은 꺼 둔 단위 QA 프로젝트이며 게임 콘텐츠 저작 산출물이 아니다. 결과는 `verify-shots/concept-recovery-editor/`(1024·1440 화면, 구조물 증분 화면, result.json). 시각 확인에서 「두 줄」이 잘리던 도면 선택기에만 최소 폭 72px를 주었다. 전체 편집기 부팅은 호스트 ERR_NETWORK_CHANGED 때문에 별도 검증하지 못했지만, 이 경로는 실제 프로덕션 렌더러와 저장 뮤테이터를 실행하며 pageerror 0건을 확인한다.

## Battle-animation preview-first graphic controls (Phase 2, 2026-09-05)

- `resourcePickerControl({ presentation: "graphic" })` is a narrow animation-editor opt-in: the visible label comes from `listDatabaseResourceOptions` (including project resources), with a readable ID fallback, and the action is `그래픽 선택` / `그래픽 변경`. Other pickers keep their existing presentation. The historical hidden `db-field-animation-resource` input and choose/cancel/clear mutation contracts remain intact.
- The graphic row precedes the full-width preview. `db-animation-transport` contains only Play/Stop and the existing live status; cell batch/copy/paste/interpolation and last-frame duplication live with the cell table, not playback. Pattern thumbnails are read-only divs, not unbound buttons; the inert grid checkbox is removed. Sheet, frame, cell and timing fields remain mounted and reachable in titled sections.
- `animation-editor.css` owns animation composition using existing `--db-studio-*` tokens; the conflicting animation grids/responsive reductions were removed from `battle-studio.css` without changing other studios. The existing detail form owns vertical scroll; wide tables and pattern strips own local horizontal scroll. Computed primary controls are 13px / 32px high with indigo fill and 2px keyboard focus rings. No global resets, new framework, `!important`, runtime or data-schema changes.
- Desktop Chromium measurement: stage 394×280 at 1024×768, 650×280 at 1280×800, 810×315 at 1440×900. Primary graphic name, choose/change and transport controls fit their clipping ancestors and pass center hit-testing at all three sizes. All Phase 1 ownership/cache-disposal and reduced-motion rules above remain unchanged.
- Proof: `test/databaseAnimationFrameSelect.test.ts` binds the visible catalog name through cancel/confirm/clear (RED on the original configured-status string); `test/e2e/battle-animation-editor-ux.spec.ts` drives the real modal, controlled clock, picker and keyboard. Report/captures: `output/evidence/battle-animation-ux/p2-implementation.md`. The worker verified geometry, PNG integrity and changing stage pixels, not a visual verdict; independent visual approval belongs to the parent.
## 검토한 실내 기본값의 원격 반영 (2026-09-05)

`scripts/expand-concept-bundles.mts --project <id> --baseline <old-bundles.json> --tileset-baseline <old-tileset.json> --evidence <dir> --apply`는 검토 전 값과 정확히 같은 꾸러미/메타/그룹만 교체하고 새 id를 추가한다. 사용자 메타·잠금·독립 통행/priority 변경은 보존한다. 기존 furniture kit도 baseline 일치 시에만 바뀐다. 구조물 빈 배열은 사용자 삭제로 보존한다. JSON 경계를 거쳐 undefined 필드를 제거한 뒤 비교하며 projects 해시 CAS와 tileset mirror 갱신 후 원격 및 앱 재로드를 확인한다. 두 테이블 쓰기는 트랜잭션이 아니므로 중간 mirror 충돌은 오류로 남고 완료로 보고하지 않는다. 이번 대상은 `rpg-zzu-house-template-gallery`, 증거는 `output/evidence/concept-v2/legacy-db-proof.json`.

## 특정 꾸러미의 명시적 교체 (2026-09-06)

사용자가 특정 기본 꾸러미를 새로 만들라고 명시하면 `scripts/expand-concept-bundles.mts --project <id> --replace-bundle inn --evidence <dir> --apply`로 해당 id만 교체한다. 이 모드는 baseline 일치 조건 없이 지정한 꾸러미를 교체하므로 명시적 교체 요청에만 쓴다. 다른 꾸러미와 프로젝트 필드는 유지하며, 비어 있는 라이브러리에도 지정한 하나만 추가한다. CAS·저장 전 백업·raw/mirror/app 재로드 검증은 그대로 적용한다.

## 생성 아이템 아트에 dry-run 가짜가 섞여 들어갔다 (2026-09-16)

`scripts/oprn-generated-assets.mjs` 의 `dry-run` 은 실제 생성 대신 **자체 가짜 PNG**
(`(x*17+y*31)%251` 그라데이션, `createFakePng`)를 써서 배관만 검사한다. 그 가짜가
`public/assets/generated/starter/` 로 승격돼 있었다 — 실측(2026-09-15): PNG 221장 중 **5장**.

| 파일 | 크기 | 리소스 id |
|---|---|---|
| `potion-red-icon.png` | 32×32 | `generated-item-potion-red-icon` |
| `potion-red-image.png` | 64×64 | `generated-item-potion-red-image` |
| `bronze-sword-icon.png` | 32×32 | `generated-equipment-bronze-sword-icon` |
| `bronze-sword-image.png` | 64×64 | `generated-equipment-bronze-sword-image` |
| `hero-01-charset.png` | 288×256 | 주인공 01 걷기 캐릭터셋 |

검증이 "공백이 아니다"(`hasVariation`)만 봤고, 그 검사조차 **스캔라인 필터 0** 을 가정해 재인코딩된
파일에서는 무의미했다. 지금은 `inspectPng` 가 필터를 실제로 풀어(`decodeRgba`) 픽셀을 보고,
`isDryRunFake` 가 가짜 패턴을 잡아 승격을 거부한다. 계약은 두 층이다 — `test/oprnGeneratedAssets.test.mjs`(러너가 가짜를 승격하지 않는가)와 `test/generatedAssetPlaceholder.test.mjs`(저장소 `public/assets/generated/**` 전체를 훑어 가짜가 **0장**인가). 판정 함수는 `scripts/lib/dryRunFakePng.mjs` 하나를 공유한다. 2026-06 의 가짜 5장은 2026-09-16 에 `agy` 파이프라인 재실행으로 복구했다 — 그때 `--print-timeout 900s` 가 필요하고(기본 180s 로는 에이전트 이미지 생성이 끝나지 않는다), 증거는 `.omo/evidence/generated-asset-fakes/` 에 있다. 복구 뒤 계약의 허용 목록은 비었으므로, 다시 채워지면 그건 부채를 새로 만든 것이다.

## 배·항구 공통 기본 장소 (2026-09-17)

`shipPlaceReferences.ts`의 갑판 3종·선내 3종·돌부두는 `PLACE_REFERENCES`에
등록한 공통 기본 장소 사례다. 프로젝트 DB에 있는 내 장소와 별개이며 빈 프로젝트에도
나타난다. `regionReferences/ships.json`에는 원격 저장을 확인했던
`rpg-zzu-ship-20260913`의 승인본 타일·이벤트·그림 자산을 보존한다.
항구는 건물을 제거한 64×44 버전이다. 기존 사례와 마찬가지로 읽기 전용이며
카드 조회만으로 현재 프로젝트에 지도를 배치하지 않는다.
`read_region_reference`는 각 배의 실제 타일을 행 단위로 반환한다.
이미지는 `scripts/qa/render-ship-place-references.py`로 재생성한다.
등록 누락 회귀는 `test/regionReferences.test.ts`가 기본 카드 7종·이미지 파일·
타일 전체 재조립으로 검증한다. 서버 파일만 바꾸지 말고 이 등록과 자산을 함께 출하한다.

## Game menu design options (2026-09-18)

The System overview has a dedicated Game menu card showing the current skin.
Display contains resolution only; the `menu` section owns a responsive gallery of twelve preview buttons.
Each button includes a screenshot, label, description and `aria-pressed` selection
state; Enter/Space activates the native button. Re-selecting the active skin is a
no-op. Existing `system.menuUiStyle` values require no migration.

System → Game menu → Game menu design is populated from `menuSkins/registry.ts`.
There are now twelve choices, including four RPG Maker era designs, classic blue windows, a paper journal and
a bottom command ribbon. Selection writes the optional `system.menuUiStyle`;
workbench removes it. Descriptions and decoded PNG previews update immediately;
the chosen design applies to the next play session. Preview files for new IDs
must be committed alongside registry/type changes, or the editor displays a
broken image despite the runtime skin working.

Editor proof: start `npm run dev:worktree` with a private `VITE_CACHE_DIR`, then
`OPRN_QA_EDITOR_URL=http://127.0.0.1:<port> node scripts/qa/menu-design-editor.mjs`.
It checks twelve options, selections, dedicated menu navigation at 1440/1024px, system normalization round
trips, loaded preview images, and default-key removal. This is a temporary editor
control test, not authored remote content. Runtime proof uses the separate player
harness documented in `runtime-sessions.md`.

The 2026-09-18 follow-up expands the menu registry to **12** choices with
`retro-2000`, `retro-2003`, `classic-xp`, `classic-vx`. Each has a committed actual
player preview. The editor probe accepts skin IDs as arguments and an optional
`OPRN_MENU_QA_OUT`; the era-specific evidence is under
`verify-shots/runtime-qa/menu-eras/EDITOR.md`.

## 캐릭터·얼굴 연결 검토 개선 (2026-09-18)

- `characterGraphics.ts`는 저장된 속성이 없을 때 캐릭터 이름뿐 아니라 기존 semantic 태그·성별·나이를 읽는다. 사용자 라벨/태그와 명시적 빈 속성 객체는 기본값보다 우선한다. People1 얼굴의 기존 육안 판독 메타데이터를 재사용하며, 사용자 얼굴 이름·속성·메모는 보존한다. 조회는 프로젝트 데이터를 변경하지 않는다.
- `characterFaceCandidates.ts`가 기본 대응표와 양쪽 속성·이름·메모로 후보를 정렬하고 일치 근거/속성 차이를 노출한다. `reviewedCharsetFace`는 `charsetFaceMap.ts`의 사람 시트 대응만 제공한다. 짝 없는 시트의 NPC 폴백과 몬스터 인덱스는 확정 근거가 아니다. People1 4·5는 차이 확인 문구를 붙인다. 추천은 저장된 연결 또는 동일 인물 판정이 아니다.
- DB 화면은 걷는 모습/현재 얼굴/선택 후보, 대화창 예시, 후보 목록을 보여준다. 후보 클릭은 editor-only 초안이며 `db-cg-apply-face`로 확정할 때만 history + store.update를 남긴다. 현재 얼굴 재선택은 적용 불가, 캐릭터·프로젝트 전환은 후보를 초기화한다. 기존 이벤트는 변경하지 않는다.
- 표정 세트는 기본적으로 인물별 후보 하나로 묶고, 모든 표정 토글 또는 검색으로 개별 표정을 찾는다. 후보는 처음 48개와 더 보기로 렌더하며 이름·메모·ID/속성 필터를 지원한다. 속성과 JSON 입력은 접을 수 있다. `no-face`/`pending` 변경 시 얼굴과 일치 품질을 함께 해제한다. 품질 입력은 연결된 얼굴이 있을 때만 활성화한다.
- 회귀 명세: `characterFaceCandidates.test.ts`, `databaseCharacterGraphics.test.ts`. 세션 규칙에 따라 테스트/게이트는 실행하지 않았다. 실제 편집기 표면 캡처: `output/evidence/character-face/`.

- 실제 편집기에서 후보 선택 → 명시적 적용(`mapped`, 지정 얼굴 ID) → undo(`null`)를 확인했다. 1440×1000 / 1024×768 캡처에서 가로 넘침은 없었다(1024: clientWidth/scrollWidth 768/768). 목록의 숨은 이미지 로드 프로브가 공용 썸네일 CSS에 의해 시트 전체로 노출되던 문제도 프로브를 DOM 밖에 두어 수정했다. 원격 연결 데이터 수정은 없으며 UI 관찰은 저장하지 않는 세션에서 수행했다.

## 얼굴 대응표 실물 대조와 추천 제외 (2026-09-18 후속)

- PR #918의 기존 대응표 신뢰는 잘못이었다. 캐릭터 시트는 8명, 얼굴 시트는 16명이다. `charsetFaceMap.ts`는 시트+offset을 사용한다: Actor1→얼굴 Actor1 0–7, Actor2→얼굴 Actor1 8–15, Actor3→얼굴 Actor2 0–7, Actor4→얼굴 Actor2 8–15. 에디터 조회와 NPC 저작 헬퍼는 동일한 원본 칸 대응을 사용하며, resource ID alias도 canonical charset으로 해석한다. 이는 원본 그림 위치 대응이며 속성/동일 인물 판정과는 다르다.
- `characterGraphics.ts`는 `scripts/shared-face-expression-sources.json`의 기존 baseSheet/baseCell/name을 재사용하여 원본 낱장 얼굴에도 독립된 설명을 제공한다. 걷기 캐릭터 속성을 얼굴에 복사하지 않는다. 예: Actor3 무도가(남성)와 대응 얼굴 청록 머리 여성의 설명 충돌이 드러난다. `흰 머리띠`는 백발 속성으로 오독하지 않는다.
- `rankCharacterFaces` 결과는 paired/similar/none/conflict. 속성 충돌은 대응표 가산점보다 우선하며 충돌 시 +100을 주지 않는다. 나이가 비어 있으면 어린이 얼굴은 추천에서 제외한다. 성별·종류만 같은 후보나 이름 토큰 겹침만 있는 후보는 추천하지 않는다. 머리/의상/역할 일치 또는 명시적 나이+성별 일치는 **유사 특징**일 뿐이다.
- 기본 UI는 paired/similar만 표시하고 나머지는 검색 또는 전체 얼굴 보기에서 경고와 함께 수동 선택 가능하다. 중절모 신사는 소년 얼굴 대신 근거 부족 빈 상태를 표시한다. 원본 대응/유사 특징/근거 부족/추천 제외를 구별한다. 기존 연결이나 이벤트를 자동 교체하지 않는다.
- 증거: `output/evidence/character-face-correction/actor2-before-after.png`, `editor-actor2.png`, `editor-no-match.png`, `editor-conflict.png`, `observations.json`. 비교 PNG는 실제 엔진 크롭과 원본 에셋 및 변경 전후 함수 출력으로 만든 브라우저 캡처다. AI 생성 이미지가 아니다. 테스트 명세는 갱신했으며 세션 규칙에 따라 테스트/게이트는 실행하지 않았다.

### 캐릭터·얼굴 화면 레이아웃 보정 (2026-09-18)

- 전환 버튼과 검색·필터를 `db-cg-list-controls`에 묶어 목록 창의 2–3행에 명시 배치한다. `listToolbar`를 chips 슬롯에 직접 넣으면 공통 CSS가 footer 행으로 보낸다.
- 썸네일·이름/검토 상태·번호는 전용 3열/2행 그리드다. `modern/crops-characters.css`의 공통 썸네일 행 flex 규칙보다 구체적인 선택자를 유지한다.
- 상세 본문을 `face-detail` inline-size 컨테이너로 사용한다. 실제 상세 너비가 720px 이하이면 비교/후보를 세로 배치하므로 모달 크기 변경에도 대응한다.
- 원본 대응 배지와 후보 선택 테두리를 강조하고 카드 제목/안내를 별도 줄로 배치한다. 매칭 데이터와 추천 기준은 변경하지 않는다.
- 브라우저 확인: 1440×1000, 1024×900에서 캐릭터 선택·후보 선택·연결 적용·얼굴 탭 전환. 캡처는 로컬 `output/evidence/character-face-ui/`. 테스트/게이트는 세션 명시 요청이 없어 실행하지 않음.

## 캐릭터·얼굴은 프로젝트 밖 공용 자료 (2026-09-18 저장 범위 수정)

- `?blankProject=1`은 저장하지 않는 프로젝트다. 이전 화면이 `store.update`로 `resourceProfiles.characterSlots`에만 쓰던 구조에서는 임시 탭을 잃으면 연결도 사라지고 다른 프로젝트에서는 보이지 않았다. 추천 후보 필터와 별개의 저장 범위 결함이다.
- `databaseCharacterGraphicsView.ts`는 이제 호스트 공용 카탈로그를 읽고 편집한다. `sharedCharacterGraphics.ts`의 투영은 기본 리소스만 포함하고 게임 문서·이벤트·액터·프로젝트 undo를 변경하지 않는다. 프로젝트 업로드 자산은 공용 자료로 올리지 않는다. 원본 대응표/추천을 확정된 수동 연결로 자동 승격하지 않는다.
- `GET/POST /__oprn/shared-character-graphics`는 Vite dev/preview, Electron app 프로토콜, 프로젝트 HTTP 호스트에 연결된다. 같은 호스트 사용자에 속한 프로젝트들은 같은 자료를 읽는다. 서로 다른 호스트/OS 계정 사이의 클라우드 동기화는 아니다. 팀 호스트에서는 로그인 후 조회하며 공용 수정은 owner만 허용한다.
- 저장 위치는 `OPRN_SHARED_CHARACTER_GRAPHICS_FILE`, 없으면 `${XDG_DATA_HOME:-~/.local/share}/oprn/character-graphics.json`. 프로젝트 폴더·워크트리·dist 밖에 있으며 이전 저장본은 `.previous`에 보존된다. 프로세스 간 배타 파일 잠금, 현재 문서 SHA 비교, 임시 파일 fsync+rename, 수락 파일 재읽기를 사용한다. 잠금 보유 프로세스가 비정상 종료한 경우 호스트를 모두 중지하고 `.lock`을 확인한 뒤 제거한다. JSON 파일과 `.previous`를 함께 백업한다.
- 초기 읽기 실패는 빈 자료로 대체하지 않고 편집을 막는다. POST 수락 전에는 성공이라고 표시하지 않는다. 저장 중 편집 잠금, 충돌/오류 안내, 실패한 변경의 JSON 보관, 명시적 다시 불러오기를 제공한다. 이름·속성·메모는 입력 중 포커스를 유지하고 change(다른 칸으로 이동/Enter) 때 저장한다.
- 기존 프로젝트의 선택적 메타데이터와 IO 계약은 계속 보존한다. 「이 프로젝트의 기존 매핑 가져오기」는 기본 자산의 명시적 슬롯/얼굴 속성을 JSON 초안에 옮긴다. 사용자가 확인하고 「JSON 적용」하면 공용 저장된다. 알 수 없는 ID와 프로젝트 업로드 얼굴은 공용 가져오기에서 제외된다. 기존 v1/v2 JSON 입력도 계속 지원한다.
- 확인: 격리된 호스트 카탈로그를 사용한 Firefox 실측에서 임시 프로젝트 연결 → 다른 새 프로젝트 재조회(`mapped`), 게임 문서 불변, 저장 충돌 후 기존 연결 유지/JSON 보관을 확인했다. 1440×1000 / 1024×900 캡처와 `browser-proof.json`은 `output/evidence/shared-character-faces/`. 회귀 명세는 `databaseCharacterGraphics.test.ts`, `sharedCharacterGraphicsStore.test.ts`; 세션 규칙에 따라 vitest/게이트는 실행하지 않았다.
- 복구 조사: LegacyDb 프로젝트 123개의 `current_json.resourceProfiles`에는 이 섹션의 `characterSlots` 저장본이 없었다. 이는 브라우저에만 남았던 편집이나 별도 JSON 백업의 부재까지 증명하지 않는다. 공용 저장 수정과 과거 수동 매핑 복구를 구별한다.

### 공용 기본 매핑 재저작 (2026-09-18)

> 2026-09-28 전수 대조로 근사 26칸 중 다른 인물인 7칸을 얼굴 없음으로 바꿨다(현재 정확 68·근사 19·얼굴 없음 81).
> 같은 날 원본에 얼굴이 없던 29칸의 짝 얼굴을 생성해 연결했다(현재 정확 97·근사 19·얼굴 없음 52 — 사물·탈것·빈 칸뿐, 얼굴 메타데이터 109개).
> 목록과 저장본 교정은 `openwiki/editor-ai-tools.md` 「얼굴 짝 전수 교정」.

사용자의 재매핑 지시로 `src/assets/sharedCharacterGraphics.json`을 원본 그림에서 새로 저작했다. 168칸 중 94칸 연결(정확 68·근사 26), 74칸 얼굴 없음, 원본 얼굴 메타데이터 80개다. 공용 저장 파일이 없는 호스트는 이 자료로 시작하며, 이미 저장된 호스트 파일은 우선하여 사용자 편집을 보존한다. 각 근사 대응의 차이는 `note`에 남긴다. `Actor3 #5`를 여성 얼굴에 순번으로 연결하지 않으며, 검은 고양이·Scarloxy 전용 그림·물건·빈 칸에 억지 얼굴을 주지 않는다. 시트·얼굴 대조 PNG, 호스트 저장 후 재읽기, LegacyDb 전용 행 `oprn-shared-character-graphics`의 저장(201) 후 재조회 근거는 `.omo/evidence/shared-character-faces/README.md`에 보존한다. LegacyDb는 재저작 자료의 원격 보관본이고 편집기의 공용 저장 정본은 호스트 파일이다.

## Feature16 climate and action forms (2026-09-21)

Map settings (palette tileset-name chip) → 기후 authors inherit/fixed/indoor mode,
fixed weather and intensity via `setMapClimate` (map permission + scoped store
mutation). Selectors: `map-props-tab-climate`, `map-climate-mode`,
`map-climate-weather`, `map-climate-intensity`.
Database → 파티 → 스킬 → 액션 스킬 uses the separate
`databaseActionSkillForm.ts`. `db-field-skill-action-enabled` remains compatible;
new selectors end in `kind`, `cooldown`, `duration`, `status`, `status-duration`.
Kinds are projectile/melee/dash/trap. Each callback edits the latest stored profile
so changing one field cannot restore an older value from another control.

Parent-owned real editor capture (already running editor server):
`FEATURE16_EDITOR_URL=http://127.0.0.1:<port> node scripts/capture-feature16-world-editor.mjs`.
It opens real map/database dialogs, operates visible controls, reads the actual
serializer's result, and writes screenshots/receipt under
`verify-shots/feature16-world-editor`. No synthetic component mounts or DB writes.
These scripts and tests were authored without running servers, tests or typecheck
in the implementation agent's session; centralized validation is still required.
## Combat authoring studio (feature16, 2026-09-21)

Skills → **전투 규칙 · 피해 수식** (`feature16-combat-studio`) adds a bounded arithmetic formula, editable preview power/attacker ATK/defender DEF, ordered hit multipliers, per-skill critical chance/multiplier and cooldown. Existing effect-card hit rate remains authoritative. Preview displays base damage before model modifiers; other preview variables default to 20, level to 1. Invalid input displays **저장하지 않음**, marks the field invalid and never calls `updateDatabaseRecord`; last valid data remains saved. Blank formula restores model defaults; critical chance -1 restores battler defaults. All persisted edits use existing database mutation labels/history.

Enemies → **보상** adds conditional drop rows (`feature16-drops`); first add preserves a legacy single drop as the first row. Each row has item/quantity/rate and always/turn/HP/MP/status/allies/switch condition controls. Explicit “기존 단일 드롭 사용” removes the array and restores legacy fields. The existing attack-pattern dialog uses the same condition editor, including session switch equality. Unknown/dangling item references are not silently created.

Browser proof: `npx playwright test test/e2e/feature16-combat.spec.ts --project=chromium --workers=1`. Parent owns server and execution. This spec opens the **real editor** at `?freshProject=1`, uses visible database controls, verifies invalid edits do not alter exported data, switches tabs and rechecks persistence. Screenshots are emitted to Playwright's per-test output folder as `feature16-combat-{skills,invalid-formula,drops,enemy-condition}.png`. No remote content mutation; no screenshot claimed until the supervisor runs it.
## Troop intent and weakness authoring (2026-09-21)

The troop placement preview contains `databaseTroopIntentPanel`: hypothetical turn/MP/target/row, eligible action candidates with shared damage predictions, and actual element multipliers. Existing actions and elementRates are edited through `updateDatabaseRecord`; no new enemy schema. It does not claim exact AI choice or add predictions to the runtime HUD. Details, limitations and real-editor capture: `openwiki/feature16-battle-ui.md`.

## 인게임 HUD 구성 편집기 (2026-09-21)

자료집 → 시스템 → 인게임 HUD(`databaseFieldHud.ts`)에서 생활·농장, 생존·탐험, 파티 RPG, 액션·모험, 고요한 탐험, 기존 HUD를 고른다. 프리셋 선택은 구성 전체를 교체하며 기존 시스템 편집 스냅샷으로 실행 취소할 수 있다. 구성 요소는 최대 24개, 추가·복제·삭제·순서 변경이 가능하다.

- 왼쪽은 요소 목록, 가운데는 시작 맵의 `renderRegionSnapshot` 배경과 실제 `FieldHud`, 오른쪽은 선택 요소의 데이터/표현/앵커/여백/치수/색/패널/표시 조건이다. 이미지 요소는 기존 picture 리소스 선택기를 사용한다.
- 드래그는 화면 배율을 논리 좌표로 환산하여 좌상단 앵커로 바꾸고 pointerup에 한 번 저장한다. 방향키 1px, Shift+방향키 8px 이동도 같은 편집 경로다. 단순 선택/취소/미리보기 전환은 프로젝트 이력을 만들지 않는다.
- 체력/마력은 선두 또는 지정 배우, 생활 에너지/액션 스태미나/소지금/변수/타이머/아이템 보유량은 실제 데이터에 연결한다. 상태 요소는 배우 상태와 선택 타이머를 읽는다. 음식 효과를 새로 만들지 않으며 생존형의 음식 슬롯은 휴대 식량의 보유 수량이다.
- 시작 상태·저체력·전투·화면 아래 접근·대화 상태 미리보기는 프로젝트와 별도의 세션이다. 지원 시스템이 꺼져 있으면 설명을 표시하며, 현재 조건에서 숨겨진 요소는 편집할 수 있도록 흐리게 보인다.
- 편집은 `databaseSystemView.updateSystem`의 스냅샷/감사/저장 경로를 공유한다. 운영 게임 콘텐츠를 생성하거나 원격 DB를 직접 쓰는 기능이 아니다.

### 장르별 HUD와 글꼴 (2026-09-21 후속)

프리셋은 수집·여행, 고전 JRPG, 상징·호러, 추격·HUD 없음, 하트·모험까지 포함한다.
수집형은 필드의 지역명과 별도의 `field-list` 세로 명령 메뉴를 사용한다. 고전형/추격형의
빈 요소 목록은 정상적인 구성이다. 프리셋을 고르면 권장 메뉴와 목표 표시 설정도 함께
바뀐다. `함께 사용할 메뉴 → 기존 메뉴 설정`으로 시스템의 기존 `menuUiStyle`을 따른다.
HUD 글꼴은 스타일 권장/갈무리9/Neo둥근모/기본 UI 중 선택한다. 글꼴 선택은 HUD에만
적용되고 메뉴 스킨은 자체 글꼴을 사용한다. 게이지의 `수치 함께 표시`를 끄면 하트/꽃만
남길 수 있다. 꽃잎은 실제 연결 데이터 비율을 5단계로 읽으며 임의 그림 상태 교체는 아니다.
별도 메뉴 편집기의 새 `여행 · 세로 명령창`도 같은 스킨 레지스트리를 사용한다.

## 숲·마을·동굴 공통 기본 장소 13종 (2026-09-21)

`forestPlaceReferences.ts`는 이 작업에서 만든 완성 맵 13개를 `PLACE_REFERENCES`에 등록한다.
검은 숲의 오두막, 별 모양 숲, 굽이숲, 굽이숲 작은마을·절벽마을, 솔바람 고원마을·협곡,
고요한 숲마을, 큰 폭포 아래 마을, 숲과 단구의 마을, 언덕 위 숲마을 조화 배치와 동굴 두 개다.
반복·이음새·언덕 비교용 맵 6개는 공용 목록에서 제외한다.

기존 지역 ID `gubisup-80x72`, `small-forest-village-80x72`, `forest-cliff-village-80x72`는
그대로 유지하면서 장소 목록으로 옮긴다. AI 행 조회와 다운로드 경로는 바뀌지 않는다.
`forestPlaceSnapshot`이 저장된 맵·타일셋을 조회하고 기본 장소 카드는 프로젝트와 무관하게 보인다.
다운로드 문구는 장소/지역을 구분하고 파일명은 해당 사례의 이름을 쓴다.

원본은 로컬 프로젝트 `oprn-hill-forest-harmony-20260918-a4e1`의 현재 저장본이다.
기존 원격 원본에 과거 버전이 남은 맵도 있으므로 등록을 이유로 원본 프로젝트 전체를 덮어쓰지 않는다.
공용 스냅샷은 `oprn-place-<slug>-v1`(기존 지역 3종은 `oprn-region-<slug>-v1`)에 저장하고
재로드한 뒤 `regionReferences/<slug>.json` 및 `public/assets/region-references/<slug>*`로 출하한다.
이미 발행한 스냅샷은 불변이다. 새 사용자 편집을 반영할 때는 새 개정 ID가 필요하다.

`publish-forest-place-library.mjs`는 지도 이벤트의 이동 대상 맵을 재귀 수집해 다운로드에 함께 넣고,
로컬 업로드 이미지의 내용 해시를 검증한 뒤 data URL로 포함한다. 동굴 출구가 빠진 문서를 만들지 않는다.
미리보기는 실제 편집기의 `mapOnlyCapture=1` 화면에서 맵 영역을 찍는다.
`capture-forest-place-previews.mjs`와 `capture-forest-place-library.mjs`가 이미지·목록·내려받기 증거를 남긴다.
출하 증거: `.omo/evidence/forest-place-library/`.


## 타일셋 참고문서 (2026-09-21)

[타일셋 참고문서](tileset-reference-documents.md): 프로젝트 소유의 용도별 MD·이미지, 파생 타일셋의 원본 공유, Pi/레거시 AI 전달 확인, 저장·내보내기 계약.

### 숲마을 공용 소품 및 장소 (2026-09-21)

`sharedVillageObjects.json`의 19개 키트는 `shared_forest_village_objects` 번들이다.
새 프로젝트와 기존 프로젝트의 `ensureBundledTilesets`가 공급하며,
`sharedVillageObjectById`는 기존 공용 오브젝트 복사 경로를 사용한다.
`curatedVillagePlaceReferences.ts`의 7개 곡선 마을은 기존 13개 공용 숲 장소에 추가한다.
타일별 AI 참고문서·SQLite 저장·불변 원격 v2 보존본은
`openwiki/tileset-reference-documents.md`와
`tiledata/tilesets/forest_high_cliff_river/shared-library/`를 참조한다.

**낮은 돌 우물 재채색 (2026-09-28).** 원본 Tibo 소품은 파란 회색에 거의 검은 남색 외곽선·물이 불투명 픽셀의 34%였고,
앞 입술이 가장 밝은 베개 음영에 발밑 그림자가 없어 숲마을 게임 화면에서 혼자 떠 보였다. `scripts/content/recolor-forest-stone-well.py`
가 픽셀 모양은 그대로 두고 색만 칩셋 비석·돌기둥의 중성 회색 8단 + 왼위 빛 + 나무 그림자와 같은 규칙의 접지 그림자로 바꾼다.
같은 네 칸이 복사된 PNG 28장(원본 소품·공용 소품 시트·기후/생물군 칩셋·등록 장소 아틀라스)을 원본 칸 해시로 찾아
함께 바꾸고 카드 미리보기 1장도 갱신한다(총 29장). 참고문서 이미지 목록에 새 요약 키를 더한다(옛 키는 옛 프로젝트 인라인 그림용으로 남긴다). 다시 돌리면 아무것도 안 한다.
프로젝트에 이미 **업로드**로 저장된 옛 우물 그림(예: `forest_high_cliff_river` 업로드 시트)은 이 스크립트가 건드리지 않는다.
후속 외곽선 정리는 `scripts/content/prepare-forest-well-outline.mjs --apply`로 동기화한다.
원본과 생성 윤곽 자료는 `tiledata/forest-stone-well/`에 보관한다. 생성 그림의 내부 색을 가져오지 않고
기존 32×32 내부 무늬를 유지하면서 외곽 20픽셀의 색만 연속된 짙은 회색으로 맞췄다(알파·크기 동일).
첨부 그림 전체를 교체해 본 뒤 사용자가 이전 외곽선 정리본을 선택했다.
현재 스크립트는 `outline-native.png`를 정본으로 복사하며, 반려된 교체본도 원래 네 칸으로 되돌린다.
기존 ID·2×2 배치·통행 속성은 그대로다.

### 세계 개요 스프레드 뷰 (2026-09-22)

- 세계 개요 탭을 "문서 먼저" 스프레드 뷰로 다시 쌌다. 본문 순서: 스프레드 헤드(키커 `세계 안내서 · 한 장` + 세계 제목 + 따옴표 감싼 한 줄 전제 에피그래프 + AI 미터 + hero stats) → 이름과 한 줄 → 뼈대(톤·시대·기술·없는 것, 시대/기술은 2열) → **법칙 질문 카드** → 본문. 스키마·store 계약·경계값은 무변경이고 뷰 조립만 바뀌었다.
- **법칙 카드:** tri-state 세그먼트(미정/없음/있음)는 데이터 모델이 UI 로 샌 형태라 폐기하고 질문 카드(`lawCard`, testid `db-world-canon-law-{kind}`)로 교체했다. 카드 클릭이 대화상자(`db-world-canon-law-dialog`, backdrop z-index `--z-modal-top`)를 열고 옵션 3종(`-option-unset|no|yes`) + 비고(`-note`, 160자) + 저장(`-save`)으로 반영한다. `present: undefined|false|true` 의미는 이전과 완전히 같다. 카드 상태 배지는 결과 말로 쓴다: 미정="조수가 상상합니다", 없음="조수도 없다고 답함".
- **라이브 미러:** 스프레드 헤드의 제목/전제는 이름·전제 입력 input 에 즉시 따라붙는다(`renderHeadMirror`). 탭 리렌더를 기다리면 미러가 늦게 갱신돼 문서가 아니라 폼처럼 보였다(실측). 빈 값 초안은 초대 문구("세계의 이름을 지어 보세요")로 렌더한다.
- 계약 이동: `db-world-canon-law-{kind}-note` testid 는 카드 안이 아니라 카드가 여는 대화상자 소유로 이동했다(`worldAuthoringRegression` 수정). tri-state 라디오 testid `db-world-canon-law-{kind}-present` 는 폐기됐다(`worldCanonSpreadView.test.ts` 가 부재를 고정).
- 검증: 세계관 계약 10파일 59케이스 전부 통과, `typecheck:app` 0 에러, 브라우저 증거 `verify-shots/world-lore-v3/` (빈 상태/작성 상태/대화상자/완성 4장, e2e `world-canon-spread-evidence.spec.ts`).


### 세계 개요 탭 구조 — 문서 / 조수 전달 (2026-09-22 v2)

- 한 장 스프레드 전체가 세로로 길어 "목업과 다르다"는 피드백을 받았다. 스프레드 헤드(키커·세계 제목·전제 에피그래프·AI 미터·hero stats)는 문서 상단에 고정하고, 나머지는 DB 공용 `inspectorTabs` 문법의 두 탭으로 나눴다: **문서**(이름과 한 줄 → 뼈대 → 법칙 질문 카드 → 본문)와 **조수 전달**(AI 프롬프트 투영 + 전달 상태 타일). 탭 선택은 WeakMap 으로 리렌더 너머 유지된다.
- **조수 전달 탭**은 목업의 "조수 미리보기 레일"을 실제 구현으로 옮긴 것이다. 상단 안내("여기 보이는 것 = 조수가 아는 것의 전부") + 상태 타일 5개(한 줄 전제·톤·없는 것·법칙 확정·본문 발췌, `data-tone` 으로 누락/경고 왼쪽 레일 색) + `worldCanonPromptSection` 전체 투영(`world-canon-ai-panel-preview`). 문서 탭에서 뭘 고치든 이 탭의 타일/투영이 즉시 따라붙는다(`updateAiPreview` 가 input 캡처로 갱신).
- 법칙 탭 배지: 미정 법칙이 있으면 탭 라벨에 `미정 N` 배지(`inspectorTabs` badge)가 붙는다 — 조수 전달을 안 열어도 미정이 눈에 보인다.
- testid: 탭 스트립 `db-ws-section-tabs`, 탭 `db-ws-section-tab-document|ai`, 패널 `db-ws-section-panel-document|ai`, 조수 패널 `world-canon-ai-panel`, 투영 `world-canon-ai-panel-preview`. 기존 계약(헤드 미러·법칙 카드·대화상자·본문)은 모두 유지.
- 검증: 세계관 계약 10파일 61케이스 전부 통과(탭 계약 2건 추가), `typecheck:app` 0 에러, 브라우저 증거 `verify-shots/world-lore-v3/` — 빈 문서 탭 / 작성된 문서 탭 / 법칙 대화상자 / 조수 전달 탭 4장.


### 세계 개요 본문 우선 — 도화지 첫 화면 (2026-09-22 v3)

- 사용자 피드백: "세계 개요를 클릭했을 때 빈 도화지(혹은 AI 가 미리 채워 둔 줄글)가 보이는 게 맞는다." 탭 순서를 본문 우선으로 재편했다: **본문**(도화지 + 리드 문장) → **세계 설정**(이름·전제·뼈대·법칙 질문 카드) → **조수 전달**(AI 프롬프트 투영 + 상태 타일). 초기 활성 탭은 본문이고, 스프레드 헤드(세계 제목·전제 에피그래프·AI 미터·통계)는 탭 위에 계속 고정된다.
- "AI 가 미리 채워 둔 줄글"은 아직 미구현 — 본문 탭의 리드 문장이 안내만 한다. 생성형 초안 채움은 별도 작업(AI 세션 연결 필요)으로 남긴다.
- testid: 탭 `db-ws-section-tab-body|settings|ai`, 패널 `db-ws-section-panel-body|settings|ai`. 법칙 카드·대화상자 계약은 v2 와 동일하되 세계 설정 탭 안으로 이동했다. 조수 전달 탭의 미정 배지는 세계 설정 탭 라벨로 옮겨졌다(`법칙 미정 N`).
- fakeDom 정리: 중복 정의된 `isConnected` getter 제거(첫 번째 정의가 이기며 복잡한 walker 는 죽은 코드였다), selector 매처에 일반 속성 선택자(`[aria-selected='true']` 등) 지원 추가.
- 검증: 세계관 계약 10파일 62케이스 전부 통과, `typecheck:app` 0 에러, 브라우저 증거 `verify-shots/world-lore-v3/` — 빈 본문 도화지 / 작성된 본문 / 세계 설정 탭 / 법칙 대화상자 / 조수 전달 탭 5장(e2e 통과).


### 세계 개요 헤드 압축 + 세계 설정 평문 폼 (2026-09-22 v4)

- 사용자 피드백: 헤드의 긴 문장들("세계의 이름을 지어 보세요", "한 줄 전제를 먼저 적어 보세요 — …")과 4칸 통계 띠는 과하다. 짧게 줄이거나 아이콘화하고, 설명은 도움말로. 세계 설정도 카드 UI 보다 text form 이 낫다.
- **헤드 압축**: 키커 `세계 안내서` + `?` 도움말 버튼(`db-world-canon-help`, title tooltip 에 탭별 4줄 요약) + 세계 제목(미작성 시 "세계 개요") + AI 미터. 전제 에피그래프 문장 제거(premiseQuote 삭제). 4칸 통계 띠 제거 — 본문 분량은 미터가 이미 말하고, 나머지는 조수 전달 탭의 상태 타일이 소유한다.
- **세계 설정 평문 폼**: `이름과 한 줄`/`뼈대`/`네 가지 질문` 3개 sectionCard 를 폐기하고, 라벨 + 입력 나열(`world-canon-fields`, 그룹 제목은 `world-canon-group-title`)로 교체. 법칙 질문 카드·대화상자 인터랙션은 유지.
- 계약 갱신: 헤드 제목은 "세계 개요"(빈 세계), identity 카드 라벨 단언은 "이름", head-sub 단언 제거(요소 삭제), help tooltip 단언 추가.
- 검증: 세계관 계약 10파일 62케이스 통과, `typecheck:app` 0 에러, 브라우저 증거 `verify-shots/world-lore-v4/` 4장(도화지/평문 폼/법칙 대화상자/조수 전달), e2e 통과.


### 세계 개요 헤드 v5 + 법칙 대화상자 토큰 스코프 수정 (2026-09-22)

- 사용자 피드백 2건. (1) "세계 안내서" 키커를 치워라. (2) 법칙 대화상자가 제대로 보이지 않는다.
- **키커 제거:** `world-canon-kicker` 행을 없애고 헤드를 제목 + `?` 도움말 버튼 한 줄로 압축. 제목 16px, 미터 바 4px·11px 캡션으로 낮춰 헤드 전체 높이를 절반 이하로 줄였다.
- **대화상자 대비 붕괴 원인(실측):** `openLawDialog` 가 backdrop 을 `document.body` 에 붙였다. `--db-studio-*` 토큰은 `.database-modal-backdrop` 스코프에만 정의돼 있어, 모달 밖에서는 `var(--db-studio-surface)` 가 무효값으로 떨어지고 배경·글자색이 상속 회색으로 무너졌다(스크린샷 실측: 패널이 #a19f9c 회색 덩어리). 수정: `document.querySelector(".database-modal-backdrop") ?? document.body` 에 마운트하고, 대화상자 CSS 에 폴백 값(`var(--db-studio-surface, #fff)` 등)을 함께 적어 스코프가 어긋나도 읽히게 했다. backdrop 은 `position: fixed` + `--z-modal-top` 유지.
- 검증: 세계관 계약 10파일 62케이스 통과, `typecheck:app` 0 에러, 브라우저 증거 `verify-shots/world-lore-v4/` 재캡처(대화상자 흰 배경 + 본문 텍스트 확인), e2e 통과.


### 세계 설정 = AI 문답 인터뷰 (2026-09-22 v6)

- 사용자 피드백: "세계 설정을 저렇게 넣지 말고 AI 랑 질의응답하면서 할 수 있게 해." 폼 나열을 버리고 인터뷰 표면으로 교체했다.
- **표면 계약:** `AiSurface` 에 `world-canon-interview` 추가(supervisor 티어, maxTokens 4096). 엔드포인트는 조수와 동일하고 정책 표(`SURFACE_POLICIES`)가 유일한 선언 지점이라는 불변식을 따른다.
- **클라이언트** `src/ai/worldCanonInterview.ts`: 매 턴 모델이 `{recap, question, choices, patch, done}` JSON 하나를 돌려준다. `patch` 는 기존 WorldCanon 스키마 필드만 담고, `sanitizePatch` 가 스키마 밖 키·범위 초과 값을 버리고 `WORLD_CANON_BOUNDS` 로 클램프한다. 저장은 기존 `writeCanon` 경로 하나로 모아 undo 스냅숏·AI 투영이 그대로 붙는다.
- **병합 규칙:** 톤·없는 것은 합집합(기존 값 유지), 본문은 이어 붙이기, 법칙은 필드 단위 갱신. `mergeInterviewPatch` 가 순수 함수라 단위 테스트로 고정된다.
- **패널:** `buildInterviewPanel` — 대화 로그(말풍선) + 진행 칩 7개(이름/전제/톤/법칙/없는 것/시대/기술) + 선택지 버튼 + 입력줄(Enter 전송, Shift+Enter 줄바꿈) + `시작하기`. 대화 기록은 `WeakMap<HTMLElement, InterviewLine[]>` 로 탭 전환을 넘어 유지된다. 손으로 채우고 싶은 사람을 위해 `직접 입력하기` 접힌 details 안에 기존 폼(이름·톤·시대·기술·없는 것·법칙 카드)을 남겼다.
- AI 미연결이면 대화에 `(연결 실패) …` 한 줄로 정직하게 표시하고 입력을 되살린다 — 폼이 아니라 대화라 오류도 대화의 한 줄이어야 한다.
- 검증: `test/worldCanonInterview.test.ts` 7케이스(파싱·펜스 내성·클램프·병합·컨텍스트 주입·표면 렌더·저장 경로) + 세계관 계약 10파일 = **69케이스 통과**, `typecheck:app` 0 에러, 브라우저 증거 `verify-shots/world-lore-v5/` 5장.


### 세계 개요 스프레드 헤드 삭제 (2026-09-22 v6)

- 사용자 요청: "이 부분 그냥 삭제해"(스크린샷 = 제목 + ? 버튼 + 미터 바 + 4칸 통계 띠). 헤드 전체를 화면에서 걷어냈다.
- **삭제 범위:** `world-canon-spread-head`(키커·제목·도움말 버튼·미터 바·발췌 문구·hero stats) DOM 을 제거하고, `headNameMirror` 리스너와 `meterFill`/`meterText`/`heroStats` 생성을 지웠다. 레이아웃 자식은 탭 스트립 하나만 남는다.
- **정보는 사라지지 않았다:** 본문 발췌 카운터는 본문 카드 힌트(`db-world-canon-body-card` 의 `.db-ws-card-hint`)가 그대로 소유하고, 전달 상태 타일·프롬프트 투영은 조수 전달 탭이 소유한다. 죽은 testid `db-world-canon-ai-meter`·`db-world-canon-hero-stats`·`db-world-canon-hero-stat-body`·`db-world-canon-help` 는 폐기됐고 테스트가 부재를 고정한다.
- **죽은 CSS 정리:** 헤드·미터 규칙 22개를 스타일시트에서 제거했다(숨김 처리로 덧대지 않는다 — DOM 이 없으면 죽은 규칙이다).
- 검증: 세계관 계약 11파일 **68케이스 통과**, `typecheck:app` 0 에러, 브라우저 증거 `verify-shots/world-lore-v5/` 재캡처(헤드 없이 탭이 바로 시작), e2e 통과.


### 세계관 본문 AI 도움 — 초안·이어쓰기 (2026-09-22 v7)

- 요구: "세계관 작성에 AI 의 도움을 받을 수 있어야함." 인터뷰는 `세계 설정`(이름·전제·톤·법칙)만 채우고, **본문(역사·땅·문화)** 은 여전히 사람이 처음부터 써야 했다.
- **표면:** `AiSurface` 에 `world-canon-body` 추가(supervisor, maxTokens 8192 — 장문 prose 라 인터뷰 4096 보다 크다).
- **클라이언트** `worldCanonInterview.ts` 확장: `requestWorldCanonBodyDraft` + `bodyDraftMessages` + `parseBodyDraft` + `composeBodyWithDraft`. 모델은 `{body, notes}` JSON 하나를 돌려주고, notes 는 "조수가 새로 지어낸 것" 목록이라 저자가 veto 할 수 있다.
- **두 모드:** `초안 잡기`(설정만으로 4~6문단 새로 씀, 기존 본문이 있으면 confirm 으로 확인 후 아니면 이어쓰기로 전환) · `이어쓰기`(기존 본문 끝을 이어받아 다음 절). 둘 다 `지시(선택)` 입력을 최우선으로 받는다.
- **제안이지 자동 저장이 아니다:** 결과는 textarea 에 들어가고 `writeCanon` 으로 반영되지만, 본문은 길고 되돌리기 비용이 커서 인터뷰처럼 자동 확정하지 않는다. 상태줄이 "고친 뒤 저장하세요"로 안내한다.
- AI 미연결이면 상태줄에 연결 안내가 뜨고 버튼이 되살아난다.
- 검증: `test/worldCanonInterview.test.ts` 12케이스(본문 초안 파싱·클램프·펜스 내성·합성 규칙·컨텍스트 주입·표면 렌더 포함) + 세계관 계약 11파일 = **73케이스 통과**, `typecheck:app` 0 에러, 브라우저 증거 `verify-shots/world-lore-v6/` 4장.


## 공용 아이템 1,000종과 통일 도트 작업 (2026-10-01)

사용자 요청의 대상은 특정 프로젝트 행이 아니라 **모든 새 프로젝트의 기본 데이터**다. 기존 228종을 보존하고 `sharedItemCatalog.json`의 772종을 `defaultItemRecords`에서 정규화해 합친다. 장비 86종은 별도 컬렉션이다. 빈 프로젝트·장르 프로젝트는 `createProjectWithMaps → defaultDatabase` 경로로, 기본 예제는 `fixture:sync`로 동기화한 픽스처로 1,000종을 받는다. 예제 생성 시 `ensureBundledResourceProfiles`로 새 그림 및 실제 크기 정보도 연결한다.

약·음식·상태 치료·전투 소모품·기술서·성장 씨앗·포획·돌봄·재료·열쇠·농사 도구 등은 기존 엔진 필드만 쓴다. 성장 씨앗의 영구 성장 필드는 공격·방어·정신·민첩 네 가지다. HP/MP 영구 성장은 지원하지 않으므로 그 효과를 설명에 쓰지 않는다. 일반 재료·미끼·열쇠 설명은 별도의 제작·낚시·문 열기 이벤트가 자동 실행된다고 주장하지 않는다.

그림 계약은 사용자 승인 시안에 맞춘 32×32, 투명 배경, 이진 알파, 최대 32색, 중앙 정렬·긴 변 최대 26픽셀이다. 기존 `cc0-jetrel-*` ID/경로는 참조 호환용으로 유지하며 새 그림의 출처는 `generated`다. 기존 저장 프로필의 16/128px 오표기는 등록된 실제 크기 32px로 수렴한다. 아이템 행 자체는 로드에서 재주입하지 않으며 저자가 삭제한 항목을 복구하지 않는다.

저작 입력·프롬프트·완료 SHA는 `assets/item-catalog/`에서 관리한다. 등록된 그림 1,054종 모두 생성·저장·시각 검토를 마쳤다. `generation-manifest.json`의 SHA와 실제 PNG가 맞고 시각 검토를 마친 뒤에만 전체 교체 완료로 보고한다. 자세한 절차: `assets/item-catalog/README.md`.

공용 시드 화면 확인: `node scripts/content/capture-shared-item-defaults.mjs`는 격리 dev 서버의 `?blankProject=1`에서 실제 자료집을 열어 전체 1,086행·아이템 필터 1,000행을 읽는다. 신규 「맑은 쑥 회복액」 검색·상세 HP 115·가격 120과 32×32 그림 로드를 확인했고 pageerror 0건이었다. `verify-shots/shared-item-defaults/`에 실제 편집기 화면과 결과 JSON을 남긴다. 이 화면은 공용 생성 경로를 증명하는 저장 없는 QA이며 특정 사용자 프로젝트 정본 저장의 증거로 쓰지 않는다. 전체 그림 생성 완료 여부는 별도로 `assets/item-catalog/generation-manifest.json`·`visual-review.json`·실제 PNG를 대조한다.

`scripts/content/inspect-shared-item-defaults.mts`는 공용 빈 프로젝트를 프로덕션 `serialize`로 파일에 내보낸 뒤 실제 파일을 다시 읽고 `deserialize`로 재로드한다. 확인 결과 아이템 1,000종이 동일했고 삭제한 신규 행도 재로드 후 부활하지 않았다. 이는 공용 기본값의 저장 형식 계약 확인이며 별도의 사용자 SQLite 프로젝트에 쓰지 않는다. 이미지 생성의 완료 판단은 이 데이터 재로드 결과로 대신하지 않는다.

신규 부활 깃털 16종은 `onlyEffectiveOnDeadActors`가 설정된 약이다. 엔진의 `itemAllowsBattle`은 이 조건을 전투 사용에서 제외하므로 저작 `occasion`도 `field`로 맞추고 설명에 필드 사용을 명시했다(2026-10-02). 기존 불사조 깃도 같은 계약이다. `scripts/content/inspect-shared-item-defaults.mts`는 신규 772종의 저작 필드/전투 사용 설정과 실제 사용 허용 함수 사이의 불일치도 보고하며, 빈 프로젝트와 기본 예제 모두 불일치 0개를 확인했다. 픽스처는 부활 16종만 갱신됐고 총 1,000종과 다른 파생 테이블은 유지됐다.

공용 아이콘은 새 `oprn-item-*` ID도 기존 이미지 리소스 해석기를 거쳐 게임 내보내기에 포함된다. `scripts/content/inspect-shared-item-export.mts`는 위에서 저장한 새 프로젝트 파일을 읽어 프로덕션 `collectWebExportAssets`를 호출한다. 2026-10-02 확인에서 등록 아이콘 1,054개의 리소스 ID와 실제 내보내기 경로가 모두 일치했고 누락 0개였다. 생성된 파일 수·바이트와 미생성 그림 수는 별도로 집계한다. 경로가 내보내기에 등록됐다는 사실만으로 미생성 그림까지 완료라고 보고하지 않는다.

이미지 도구가 독립 요청 여러 개를 돌려줘도 정규화와 완료 명세 쓰기는 직렬로 한다. `scripts/content/save-shared-item-art-batch.mjs`는 각 요청의 실제 반환 `source`와 원문 프롬프트를 함께 보관한 뒤 `scripts/content/normalize-shared-item-icon.mjs`를 한 파일씩 호출한다. 완료 명세는 임시 파일에 전체 JSON을 쓰고 원자적으로 교체해 검토 중인 독자가 잘린 문서를 읽지 않게 한다. 생성의 동시 처리와 명세의 동시 쓰기를 혼동하지 말 것. 완료 판단은 여전히 실제 PNG·SHA·시각 검토의 대조이며, 배치 상태 파일만으로 대신하지 않는다.

`scripts/content/inspect-shared-item-art.mjs`는 실제 PNG를 디코드해 SHA·캔버스·이진 알파·색 수·외곽 범위·중앙 정렬을 확인하고 중복 요청 ID/경로와 예상 밖 완료 명세 항목을 거부한다. 시각 검토는 같은 SHA뿐 아니라 `subject`와 `style` 모두 `accepted`여야 완료 수에 포함된다. 이전 수정 사유는 별도 `note`에 남긴다.

위 이미지 검사에서 전체 완료를 확인한 뒤 `scripts/content/capture-shared-item-defaults.mjs`를 실행하면, 새 프로젝트 자료집 화면과 함께 완료 명세의 모든 그림 URL을 32개씩 실제 브라우저에서 로드한다. 현재 SHA를 캐시 키에 넣고 `artworkLoads.checked`·실패 ID·실제 32×32 크기를 보고한다. 이미지가 미완성이면 이 전체 로드 확인은 보류하고 `artworkStillInProgress`를 참으로 남긴다.

최종 완료 근거는 `assets/item-catalog/completion-report.json`에 소스 SHA와 함께 보관했다. 실제 PNG 검사 1,054/1,054·미완료/미검토/문제 0개, 새 프로젝트 자료집 아이템 1,000종·이미지 URL 1,054개 모두 32×32 로드·pageerror 0건, 내보내기 경로 1,054개·누락 0개를 확인했다. 빈 프로젝트와 예제·6장르 모두 1,000종이고 프로덕션 직렬화 재로드에서 전 항목이 같으며 삭제한 행도 복원되지 않았다. 아이템 1,000종과 장비 86종 모두 등록된 완료 그림을 갖고 이름·설명·가격 누락도 없다. 그림 파일 합계는 1,235,714바이트다.

공용 효과·가격 재조정(2026-10-02): [공용 아이템 밸런스](shared-item-balance.md). 효과 조합 404→627, 파티 약 4→50, 아이템 전용 스킬 48종, 직업 한정 비전서 48종. 실제 기본 배우 성장 곡선과 충전 횟수를 가격에 반영한다. 새 프로젝트에서만 적용하고 저장된 저작 데이터는 수렴시키지 않는다.

### 도트 연출의 이동·가속도·배우 경로 (2026-10-02)

기존 「도트 연출」 복제/수정 흐름에 32종 공용 이동 프로그램과 배우별 직접 경로를 붙였다.
스킬 「전투 규칙」의 실제 기믹과 조수 도구의 movement/battleGimmick 필드는 [battle-motion-programs.md](battle-motion-programs.md)를 따른다.

## 저장 결과를 구분하는 적용 피드백 (2026-10-02)

`databaseModalPersistence.applyDatabaseChanges`는 `saved-local`이라도 `written: false`이면 성공으로 처리하지 않는다. 임시 세션에서 기록하지 않았음을 알리고 `false`를 반환하므로 모달의 `markClean`/저장 후 닫기 경로가 실행되지 않는다. 실제 브라우저 저장은 기존 성공 경로를 유지한다. `saved`는 SQLite 폴더·호스트도 사용하는 결과이므로 「온라인」이라고 단정하지 않는 저장 완료 문구를 쓴다. 회귀 소스는 `test/databaseModalPersistence.test.ts`이며 이번 세션에서 실행하지 않았다.

## 생활 컬렉션 검색과 선택된 상세 폼 (UX round 2, 2026-10-04)

`databaseLifeCollectionsView.ts`의 검색·분류 칩·요약 카드 클릭은 검색 노드와 상세 폼을 유지하고
기존 `.db-ws-list`의 결과와 건수만 갱신한다. 검색 디바운스는 90ms 그대로다. 입력 즉시
쿼리를 기억하므로 그 전에 레코드/탭을 전환해도 최신 값이 남고, 분리된 검색의 지연 콜백은
새 탭을 갱신하지 않는다. 결과를 그릴 때 현재 store 데이터를 읽는다. 포커스를 강제로
복구하지 않아 상세 입력으로 이동한 뒤 검색 콜백이 와도 포커스를 빼앗지 않는다.

분류·이름/ID로 데이터부터 거르고 원래 행 번호를 보존한 결과 행만 만든다. 아이템 이름은
아이템 배열이 바뀔 때만 갱신하는 Map으로 읽는다. 상세 폼은 선택한 물고기/낚시터/채집 구역/
박물관 보상 하나만 생성한다. 기존 레코드/선택/삭제/필드 testid는 유지하며 비활성 폼은
DOM에 없다. 기존 검사에서 숨은 폼을 기대한다면 먼저 해당 행을 선택해야 한다. 검색 결과가
없어도 현재 상세 선택은 유지한다. 접힌 기부/추적 아이템 칩은 처음 펼칠 때 생성한다.

회귀 계약: `test/databaseUx2LifeCollections.test.ts` (실행하지 않음). 100어종/1,000아이템에서
물고기 선택지 수는 선택된 폼의 I개이며 검색은 폼/선택지 DOM을 교체하지 않는다. F×I 생성은
제거했지만 선택된 폼의 전체 선택지와 펼친 시스템 칩은 O(I)다. 실제 브라우저 시간·시각 검증은
감독자가 아래 연결 칸 절의 네이티브 재검증 절차와 함께 수행한다.
