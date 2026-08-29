# 데이터베이스 UI/UX 브레인스토밍 — "그냥 html 느낌"의 정체

작성: 2026-08-29
범위: 데이터베이스 모달 29개 탭
성격: 브레인스토밍 / 진단. **코드 변경 없음.**

근거: 브라우저 런타임 실측(29탭, 1680×1050, expert 모드) + 코드·CSS 전수 감사 + **고심각도 주장 10건에 대한 반증 검증**. 반증된 주장은 본문에서 "정정" 으로 표시했다.

전제 두 가지:

- 이 워크트리는 미커밋 수정 23건 상태다. 그중 `src/editor/panels/database.ts`, `src/styles/database/sidebar.css`, `src/styles/database/system-studio.css` 가 수정 중이라 해당 파일 줄번호는 드리프트할 수 있다. 나머지는 HEAD 기준.
- **처방이 아니라 실행이 병목이다.** 이 문서 초판(같은 경로)에 네이티브 컨트롤 스킨 CSS 스케치가 이미 적혀 있었으나 `src/styles/` 에는 미반영이었다.

---

## 0. 요약

불만 3건은 각각 다른 원인이었고, 셋 다 실측으로 확인됐다.

| 불만 | 실제 원인 | 확정 근거 |
|---|---|---|
| "그냥 html 느낌" | 네이티브 폼 컨트롤이 스타일 없이 노출 | select 에 `appearance:none` 을 주는 규칙 **0건** (진단 시점 = PR #227 직전. #227 이 기준선 1건을 추가했다) |
| "글자가 잘리거나 안 보인다" | overflow 버그가 **아니다**. 원인 6종(§3) | 컨테이너 잘림 **0건** / lh 선언 134건 / 11px 미만 341노드 / 미정의 토큰 8종(§3 D — 그 뒤 `ac4d0ee7` 이 6종 해소) |
| "탭마다 헤더가 공간을 먹는다" | 헤더 빌더 난립 + 스크롤로 사라지지 않는 상시 비용 | 작업 영역 출렁임 **275px** (497~772px) |

가장 중요한 사실 두 개.

**고칠 자산이 이미 저장소에 있다.** 커스텀 셀렉트(546줄 TS + 290줄 CSS), 3단 밀도 모드 스위치(`editorUiMode.ts:188-194` + `editor-ui-modes.css`), 밀도 시트(1,173줄), 가상 목록(`databaseListVirtualizer.ts:78`) — 모두 완성돼 있고 **데이터베이스 사용 0건**이다. 새로 만드는 게 아니라 연결하는 작업이다.

**레버리지 지점.** `databaseModal.ts:428` 이 backdrop 을 `document.body` 직속으로 붙이므로 `.database-modal-backdrop` 스코프 규칙 하나가 29개 탭 전체를 덮는다. 컨트롤 외형은 탭을 하나하나 돌지 않고 고칠 수 있다.

---

## 0.5 정정 — 1차 진단에서 틀렸던 것

반증 검증에서 뒤집힌 것들이다. 실행 계획에 영향이 있으니 먼저 적는다.

| 1차 주장 | 정정 | 왜 틀렸나 |
|---|---|---|
| 네이티브 select "95곳" | 분모를 분리해 적어야 한다. **직접 생성 지점 29곳**(`database*`+`actorRecord*`) / 헬퍼 호출 92(src/editor 전체) / **런타임 합계 141개**(2026-08-29 Playwright 재측정: 29탭을 순회하며 각 탭의 `.database-modal-window` 안 select 를 더한 값) | "95 = select 를 포함한 CSS 규칙 수" 라는 설명은 **어떤 분모로도 재현되지 않는다** — database 의 select 규칙은 62건이고(§2 (1)) 런타임 합계는 141개다. 95 자체의 출처는 **미확인** |
| number 입력 190곳 | **187곳** | 113파일 임포트 클로저 기준의 과대 집계 |
| "슬라이더+스테퍼 3곳" 이 대안 | **드래그 스크럽 0곳** (66파일에 `pointermove`/`wheel` 0건). range 헬퍼 4종 6곳 | `sliderStepperField` 만 셌다 |
| `.db-field` 2열은 탭별 오버라이드만, 1열 되돌림 5건 | **최소 6개 뷰가 2열이다.** 진짜 결함은 42규칙이 라벨 트랙을 **24~112px 로 산포**시킨 비일관성. 진짜 되돌림은 `modern/troops.css:91` **1건** | 나머지 4건은 컬럼 미선언(기본값 방치) 또는 필드 1개 한정 예외였다 |
| lh<1.2 "313건" | 런타임 텍스트 **노드** 313개 = CSS **선언** 134건(단축 111 + 롱핸드 23). 111 중 106건이 1.05 미만 | 노드 수와 선언 수를 혼용했다 |
| 가용 높이 768px 단일값 | **772/768/779/796 으로 갈린다.** 출렁임은 249px 이 아니라 **275px** | 잘못된 분모 |
| `.db-ws-hero` 가 탭 헤더 | **아니다. 선택된 레코드의 검사 열 헤더다.** 전폭 히어로는 3탭뿐이고 8탭의 왼쪽 목록 창은 768px 유지 | `db-ws-detail` 안 2열 그리드 구조를 놓쳤다 |
| "헤더 계약 47줄" | 헤더와 무관. `db-*-readiness-*` = life-panel **카드** testid 다 | 잘못 묶었다 |
| 헤더 안 nav 3군데 | **4군데** (+ `databaseOverviewView.ts:75-96` AI 버튼) | 누락 |
| `@layer` 로 `!important` 476건 해소 | **거꾸로다.** normal 선언에서 unlayered 가 layered 를 이기므로, database 를 레이어로 감싸면 476건이 트리에 남은 언레이어 `!important` 532건에 **전부 진다**. `runtime/battle-skins/index.css:4-5` 가 언레이어 유지를 의식적 결정으로 못박고 있다 | 캐스케이드 방향을 반대로 봤다 |

추가로 초판이 `enemies` 헤더를 728px(91%)로 적은 것은 `db-record-intro-shell` 이 콘텐츠 전체를 감싸서 생긴 측정 오류였다. 실제 값은 §4 표.

---

## 1. 측정 방법

두 층에서 독립적으로 셌다.

**런타임(브라우저)** — Playwright 로 29탭을 순회하며 `getBoundingClientRect`/`getComputedStyle` 수집. 헤더 높이, 네이티브 컨트롤 수, 폰트/행높이/불투명도, 컨트롤 높이 종류. 별도로 각 텍스트 노드를 **가장 가까운 클리핑 조상**의 rect 와 비교해 실제 잘린 픽셀을 계산. 탭별 스크린샷 29장으로 교차 확인.

**소스(코드·CSS)** — CSS 를 규칙 단위로 파싱해 선언 수준으로 집계, TS 생성 지점을 grep 으로 전수 조사.

두 층을 나눠 본 게 중요했다. 런타임은 노드 수를, 소스는 선언 수를 준다. 초판이 이 둘을 섞어 lh 건수를 잘못 적었다.

**측정이 가설을 뒤집은 사례.** 처음엔 "글자 잘림 = overflow:hidden 버그"로 가정했다. 컨테이너 경계에서 접근 불가하게 잘린 텍스트는 **0건**, 스크롤조차 막힌 컨테이너도 **0건**이었다. 원인이 완전히 다른 곳(요소 자신의 행높이, 폰트 크기, 무효 토큰)에 있었다.

재현 방법은 §9.

---

## 2. "그냥 html 느낌" — 원인 5종

### (1) 드롭다운이 OS 위젯이다 — 단일 최대 원인

아래 (1)·(2) 의 카운트는 모두 **PR #227(네이티브 폼 컨트롤 기준선) 직전** 상태다. #227 이 `modern-controls.css` 에 `appearance:none` + CSS chevron 기준선 1건을 넣었으므로 "0건/1건" 류는 지금 그대로 재현되지 않는다.

`appearance:none` 을 select 에 주는 규칙은 저장소 전체에서 `.left-panel-stack select`(`src/styles/shell/figma-editor/03-layout-left-palette.css:153`) 하나뿐이고, 이건 워크스페이스 좌측 도크용이다. 데이터베이스 모달은 `databaseModal.ts:428` 에서 `document.body` 직속으로 붙으므로 매치 경로가 없다. `src/styles/database/**` 의 `appearance:none` 12건은 전부 버튼·셀·체크박스 대상이다.

`src/styles/database/**` 에서 **주체가 select 인 규칙 블록은 62건**(2026-08-29 기준, 주석 제거 후 규칙 단위 파싱. #227 이 추가한 기준선과 그 후속 보정을 포함하고, 진단 시점 값은 미확인)이고, 기준선 1건을 빼면 나머지는 배경·테두리·폰트만 바꾸고 chevron 은 OS 그대로다(`modern/troops.css:106-118`, `modern/enemies.css:153-163` 등). 초판의 "47건" 은 재현되지 않는다.

사용자가 지목한 배우 탭 "시작 직업"은 **1차 진단보다 더 나쁘다.** 경로는 `actorRecordView.ts:436` → `actorRecordControls.ts:186` → `:195` 의 순수 `el("select")` 인데, 기본 뷰 모드가 list(`databaseRecordViewSession.ts:106`)여서 `actorStudioActive` 분기(`actorRecordView.ts:62-77`)가 `classicSheet`(:47-60)를 append 하지 않는다. 따라서 `actors.css:57` 의 껍데기 스타일에도 매치되지 않는 **완전 무스타일 네이티브 위젯**이다.

### (2) 숫자 입력이 브라우저 스피너다

`type="number"` **생성 지점** 187곳(numberField 128 `databaseControls.ts:102`, numberControl 21, numberInput 10, 인라인 28 — 128+21+10+28=187)에 대해 스피너를 지우는 규칙은 `styles/editor/event-editor-rich-forms/01-ev-ux-tokens.css:201-204` 1건이고 `.rich-stepper > input` 스코프다. `rich-stepper` 를 붙이는 TS 는 `eventEditor/recordPicker.ts:636,643,649` 뿐 — database 66파일 중 **0개**.

드래그 스크럽은 **0곳**이다. 능력치 커브 편집조차 그래프 드래그가 아니라 number 격자다(`actorRecordCurveEditors.ts:296`, `databaseClassCurveEditors.ts:224`, `databaseClassExperienceCurveEditor.ts:154`). 게임 에디터 기대치와 가장 크게 벌어지는 지점이다.

### (3) 라벨 트랙이 규칙마다 다르다 — 정정된 진단

2열이 없는 게 아니다. `db-ws-card` 를 쓰는 19개 sectionCard 뷰 중 최소 6개가 2열이다 — 아래 표는 5행이지만 equipment/items 행이 한 규칙으로 두 뷰를 덮으므로 뷰 기준 6개다.

| 뷰 | 라벨 트랙 | 규칙 |
|---|---|---|
| enemies | minmax(64px, 84px) | `modern/enemies.css:129` |
| equipment / items | minmax(96px, 0.5fr) | `modern/equipment-items.css:181-190` |
| skills | 88px | `modern/skills.css:88` |
| commonEvents | 72px | `desktop-record-shell/05-dense-workbenches.css:589` |
| tilesets | 52px | `editor/event-editor-legacy.part-2.css:147` |

진짜 결함은 **`db-field` 에 컬럼을 주는 42규칙이 라벨 트랙을 24~112px 로 산포시킨 비일관성**이다. 기반 규칙은 `editor/event-editor-legacy.part-1.css:155-159`(컬럼 미선언 = 1열), `field()` 는 `databaseControls.ts:293` 에서 `label.db-field > span + control` 을 만든다. 명시적 1열 되돌림은 `modern/troops.css:91` 하나뿐이다.

폭 낭비 주장도 조건부다. 카드 최소폭은 400px(`workspace-modern.css:465`)이지만 1열 필드 다수는 minmax(120~240px) auto-fit 격자 안에 들어간다(`modern/troops.css:510,549,744` 등).

### (4) UA 기본 스타일이 그대로 노출된 지점

`structureKitDbTab.ts:98-100` 이 클래스 없는 `<h3>` + `<p>` 를 그대로 append 한다. 실측 computed 는 h3 13px(`tabs-a.part-2.css:74`) / p 14px + `margin: 14px 0` — 이 14px 마진은 CSS 어디에도 없는 **UA `p { margin: 1em 0 }`** 이다. 결과적으로 제목(13px)이 설명(14px)보다 작아 **위계가 거꾸로**다. 같은 탭 다른 요소는 전부 토큰화돼 있어 헤더만 예외다.

`details` 5곳도 `list-style:none` / `::-webkit-details-marker` 처리가 0건이라 크롬 기본 삼각형이 붙는다. 같은 화면의 `db-ws-card-toggle` 은 커스텀 셰브론을 쓰므로 두 종류가 섞인다. `assistant-command-bar.css:238,242` 에는 이미 처리가 있다.

### (5) 이미 있는데 안 쓰이는 자산 — 여기가 핵심 판단

| 자산 | 위치 / 규모 | database 사용 |
|---|---|---|
| 커스텀 셀렉트 | `eventEditor/customSelect.ts`(546줄) + `event-editor.custom-select.css`(290줄) | **0건** (호출은 eventEditor 2곳) |
| 3단 모드 스위치 | `editorUiMode.ts:188-194` + `shell/editor-ui-modes.css`(38건) | **0건** (localStorage 키 이미 존재) |
| 밀도 시트 | `shell/shell-density.part-1/2`(1,173줄) | **0건** (`db-` 언급 0) |
| 가상 목록 | `databaseListVirtualizer.ts:78`(THRESHOLD 80) | 1곳 / `workspaceList` 19뷰 전량 렌더 |
| line-height 결론 | `overview-dashboard.css:44-46` 주석 (1.1 → 1.25) | battle-studio 는 여전히 1.15 |

**커스텀 셀렉트에는 선행 작업이 있다.** 36개 규칙 블록 중 조상 스코프(`.event-editor-modal-body`/`.event-subdialog-body`)가 걸린 건 트리거 박스·hover·focus **3블록**(`custom-select.css:22-45, 47-51, 53-60`)뿐이고 나머지 33블록은 무스코프다. 그냥 설치하면 네이티브 select 는 `opacity:0 !important`(:12)로 사라지고 팝오버·옵션은 완전히 스타일링되는데 **트리거만 맨 `<button>` 으로 남는다 — 미설치보다 나쁜 화면이 된다.** 3블록 스코프 해제가 선행이다.

훔칠 설계 2개: ① 네이티브 select 를 DOM 에 남기고 위에 button 트리거를 얹는 progressive enhancement — testid·값·이벤트 계약이 그대로 살아남는다(`customSelect.ts:389`). ② `MutationObserver`(:467)로 동적 추가 select 자동 인핸스.

---

## 3. 글자 잘림 — 원인 6종

| 원인 | 건수 | 대표 위치 | 처방 |
|---|---|---|---|
| A. line-height < 글꼴 잉크 | 선언 134 (단축 111 + 롱핸드 23), 111 중 106이 1.05 미만 | `battle-studio.css:53-55` — 25px/1.15 = 28.75 line box, scrollHeight 31 vs clientHeight 29 → **2px 초과** | 하한 1.3. **계측 하네스 먼저** |
| B. nowrap + ellipsis 로 대피로 없음 | 2계열 (호출 22 + 카드값) | `workspace-modern.css:292-301` `.db-ws-hero-title`, `11-life-authoring.css:121-123` `.db-life-card-value` | 2줄 clamp 또는 최소 `title` 속성 |
| C. 고정 상자 + clip | height 240 / overflow:hidden 286 / ellipsis 107 / nowrap 167 | `actors.css:64-68` (`height:20px`, 단 기본 경로 미렌더) | min-height 전환 |
| D. **색 소실 = "안 보임"** | 미정의 토큰 8종 (측정 시점) | `system-studio.css:166` `background: var(--studio-surface-2) !important` → invalid-at-computed-value-time → **transparent** | **이미 처리됨** — `ac4d0ee7`(2026-08-29 14:09)이 `system-studio.css:25-30` 에 6종을 `--db-studio-*` 로 매핑했다. 남은 미정의는 `--studio-play`·`--studio-select` 2종이고 둘 다 `shell/editor-ui-modes.css:65-66` 에서 fallback 을 달고 쓰인다 |
| E. 고쳐도 안 바뀜 | 216 선언 사망 / 109 생존 | `system-studio.css` L118-658 이 L850-1332 에 덮임 | 삭제 |
| F. UA 스타일로 위계 역전 | 1탭 | `structureKitDbTab.ts:98-100` — h3 13px < p 14px | `db-tab-note` 로 전환 |

여기에 런타임 실측이 더한 것: **`font-size` 11px 미만 텍스트 노드 341개** (`.db-list-sub` 10.5px 59, 무클래스 `span` 10px 29, `.db-ws-stat-label` 10.5px 22, `.db-ws-hero-eyebrow` 10px 17, `.db-life-card-label`/`-detail` 10px 각 16, `th` 10px 9 …). 정의 예: `record-list-modern.css:87` `font: 600 10.5px/1.5 "Malgun Gothic", …`.

그리고 **스크롤 힌트(mask/페이드/is-scrolled)가 0건**이다. 스크롤 컨테이너가 행 중간을 지나며 끊길 때 "더 있다"는 신호가 없어, 실제로는 도달 가능한 콘텐츠가 잘린 것으로 보인다. 스크린샷의 몬스터 탭 하단 "종족…" 이 이 경우다.

### A 의 처방 순서가 중요하다

이 저장소는 이미 같은 버그를 계측으로 풀었다. 커밋 `1d693d77`(PR #194 로 머지 `a9c0a3a6`)이 남긴 주석:

> line-height 는 글꼴의 실제 잉크(ascent+descent)보다 커야 한다. 1.05 는 18px 글자에 18.9px 상자를 주는데 이 글꼴의 잉크는 20px 이라 **strong 자신의 `overflow: hidden`** 이 글리프 위아래를 1px 씩 깎았다(실측: 잘림비 0.053이 스킨당 21건). 1.2 = 21.6px.

핵심은 "**요소 자신의** overflow 가 자기 글리프를 깎는다. 그래서 부모 상자를 키워도 안 없어졌다"는 부분이다. 이게 조상-비교 측정이 0건을 낸 이유이기도 하다 — 잘림이 부모-자식 관계가 아니라 요소 내부에서 일어난다.

`overview-dashboard.css:44-46` 도 같은 문제를 계측으로 풀었다("line box 37px 대 글리프 박스 41px, 1.25 가 모든 뷰포트 스텝에 맞는다"). 반면 **PR #194 는 눈으로 골라 고치다 5번 틀렸다는 기록을 남겼다.** 111건을 손으로 훑기 전에 `scripts/qa/battle-text-audit.mjs` 의 database 판을 만들어 계산된 line box 대 잉크를 물어보는 편이 빠르다.

폰트 스택은 `--font-ui: system-ui, "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", …`(`tokens.css:90`). 한글 글리프는 em 박스를 거의 꽉 채우므로 lh 1.0~1.15 는 위아래 획을 깎는다.

### E 는 부분 오해를 피해야 한다

L118-658 이 전멸한 게 아니다. rule block 77개 중 **57개가 덮이고(그중 29개는 전멸), 20개는 온전히 살아 있다**(살아 있는 예: `:146`, `:246-248`, `:412`, `:475`, `:527`, `:580`, `:585`, `:653`). 초판은 "17개" 로 적어 57+17=74 가 되며 77 과 맞지 않았다. 재현: 같은 선택자가 658행 이후에서 같은 속성을 다시 선언하면 사망으로 세면 선언 기준 **216 사망 / 109 생존**(§3 E 행과 같은 값)이 나온다. 산 줄과 죽은 줄이 섞여 파일을 통째로 읽지 않으면 구분이 불가능한 것이 진짜 문제다. 그리고 순서를 바꿔도 복구되지 않는다 — 그 블록의 27개 선언이 정의 0건인 `--studio-surface-2/-3`, `--studio-violet(-soft)`, `--studio-mint`, `--studio-amber` 를 읽으므로 캐스케이드에서 이겨도 무효값이다. **복구 대상이 아니라 삭제 대상이다.**

### B 는 미확인

시드 데이터에서 실제 잘림이 관측되지 않았다(scrollWidth == clientWidth). 실사용 프로젝트의 긴 레코드 이름으로 재측정이 필요하다.

---

## 4. 헤더 — 정정된 진단

### 4.1 `.db-ws-hero` 는 탭 헤더가 아니다

`databaseWorkspace.ts:238-248` 이 `.db-ws-detail` 안에 넣고 `workspace-modern.css:41-48` 이 2열 그리드를 만든다. 실측 폭 1024~1084 / 본문 1364 이고, items·equipment·farm-spatial·life-collections·terms·switches·variables·tilesets 의 **왼쪽 목록 창은 768px 을 그대로 유지한다.** 전폭 히어로는 daily-weather·farm-animals(1362)·battle-commands(1322) 3개뿐이다.

### 4.2 실측 작업 영역

가용 높이는 단일값이 아니다: 대부분 768px, overview·structure-kits 779, elements 772, system 796(`system-studio.css:666` `padding:0 !important`).

| 워크스페이스 높이 | 탭 |
|---|---|
| 772 | elements |
| 768 | actors, classes, skills, states, troops, common-events, items, equipment, farm-spatial, life-collections, tilesets, animations |
| 676 | enemies |
| 638 | life-crafting |
| 631 | battle-screen, terrain |
| 543 | crops, characters |
| 497 | monster-species (게이트 배너 표시 시) |

출렁임 범위 **275px**(497~772).

**주의할 반례:** 가장 짧은 작업 열은 헤더가 아예 없는 **classes 탭 목록 창 473px**(폭 258px)이다. 원인 미확인. 공간 문제를 헤더 단독 원인으로 단정할 수 없다는 뜻이다.

### 4.3 헤더는 스크롤로도 사라지지 않는다 — 상시 비용

사용자가 지목한 전투 스튜디오 헤더 97.1px 의 분해: padding-top 16 + title-block 80.1(kicker 15 + gap 3 + h3 28.8 + gap 3 + p 17.4 + padding-bottom 13) + border 1. nav 36px 은 `align-self:end`(`battle-studio.css:65-71`)로 title-block 과 같은 행이라 추가로 쌓이지 않는다.

그리고 `modern/utility-records.css:18-26` 이 표면을 `height:100%; overflow:hidden` 으로 고정하고 `workspace-modern.css:220-246` 이 스크롤 경계를 `.db-ws-detail-body` 안쪽으로 밀기 때문에 **scrollTop 285 이동 후에도 rect 가 불변**이다. 상시 비용이므로 불만 #3 의 근거로는 이 97px 하나로 충분하다.

### 4.4 회수 계획

| 대상 | 현재 | 조치 | 회수 |
|---|---|---|---|
| `.db-battle-studio-heading` × 4탭 | 97.1px | kicker+p 제거, h3 유지 | 38px/탭 |
| 같은 헤더, h3 까지 | 97.1px | nav 만 남김 → 53px | 44px/탭 |
| `.db-record-intro` in `.db-life-header` × 3탭 | 36 + gap 8 | 탭 레일 버튼 `title` 툴팁으로 | 44px/탭 |
| `.db-life-panel` 카드 4장 × 3탭 | 171px | CSS 밀도로 한 줄 칩(~60px) | 111px/탭 |
| structure-kits 무클래스 h3+p | 67px (UA 마진 22 포함) | `db-tab-note`(`10-tab-chrome-unify.css:63`) | 22~35px |
| `.db-overview-hero` p | 폰트 미선언, 상속 14px/normal | 삭제 (아래 pulse 카드가 같은 내용) | 약 20px (미확인) |
| battle-commands 검사 열 히어로 | 110px | 제목 중복이므로 생략 | 519 → 629 |
| system 죽은 h3 | 0px (`system-studio.css:669` `display:none`) | `databaseSystemView.ts:122` 와 규칙 동시 삭제 | 0px (정리 목적) |

### 4.5 헤더 안 내비게이션 — 4군데

| 위치 | 헤더 안의 기능 | 계약 |
|---|---|---|
| `databaseBattleStudio.ts:24-37` | `battleStudioNav` 4버튼 | `test/databaseBattleStudio.test.ts:69,70,98,102` |
| `databaseLifeCraftingView.ts:330-369` | 섹션 칩 10개 (role=tab) | `test/e2e/stardew-p0-life-systems.spec.ts:52` |
| `databaseSystemStudio.ts:112-152` | 상태 점 3 + 검색 + 플레이 테스트 | `test/databaseSystemStudio.test.ts:56` |
| `databaseOverviewView.ts:75-96` | `db-overview-ai` 버튼 (유일본) | `test/databaseOverviewDashboard.test.ts:153,301,326` |

**"통째로 지워야 한다"는 전제는 성립하지 않는다.** 네 곳 모두 prose 블록과 인터랙티브 노드가 이미 별개 자식이다 — `battleStudioNav` 는 `databaseBattleStudio.ts:14` 독립 export, rail 은 `:339` 독립 변수, actions div 는 독립 리터럴이다. eyebrow/h2/h3/p 만 제거하고 인터랙티브 자식을 그대로 반환하면 탭 전환·섹션 전환·검색·플레이테스트가 전부 살아남는다.

깨지는 계약은 텍스트를 요구하는 2건(h2 한 줄 유지로 충족)과 `visible` 을 요구하는 3건(`qa-characters.spec.ts:104`, `_db-audit-crud-collection.spec.ts:708`, `structureKitDbTab.test.ts:63` — 테스트 수정 필요)이다.

life-panel 카드 47줄은 헤더와 무관하므로(§0.5) **DOM 유지 + CSS 밀도만 변경**이 안전하다.

### 4.6 조건부 배너는 헤더로 세지 않는다

`.db-collection-gate-warn` 34px 은 `database.ts:616-621` 조건부 렌더다. troops 에서는 워크스페이스를 줄이지도 않는다(768 유지, `.db-body` 가 836 으로 스크롤). "헤더 없는 탭"은 actors·classes·skills·states·common-events 5개 + troops(배너만, 비용 0).

설명문 처분: 삭제 가능 7 / 툴팁 이동 4 / 유지 **11** / 없음 **7**.

---

## 5. "커스텀 CSS 로 설정 가능하게" — 지금은 불가

### 5.1 규모와 부채

아래는 **2026-08-29 재측정값**이다(분모를 줄마다 명시했다 — 초판은 몇 줄에서 분모를 적지 않아 백분율이 재현되지 않았다).

| 지표 | 값 |
|---|---|
| database CSS | 95파일 / 31,662줄 / 947KB. 전체 `src/styles` 대비 **파일 36.5%(95/260) · 줄 39.4% · 바이트 41.7%** (초판의 "42%" 는 바이트 기준) |
| `database*.ts` | 62개 |
| `!important` (database / 전체) | **463 / 986** — 예산 게이트 기준선(`.omo/css-budget-baseline.json`, 전체 = `src/styles` + `player.css`) 기준. 파일별 최다는 system-studio 242, studio-theme 115, sidebar 41 |
| 하드코딩 색 (database) | hex 287 + rgba/rgb 424 = **711**. 같은 범위 `var(--)` 참조 4,788 → 색 / (색 + var) = **12.9%** (초판의 "756 / 4,778 = 13.7%" 은 나눗셈이 성립하지 않는다 — 13.7% 는 색/(색+var) 분모로 계산된 값이었다) |
| `font:` 단축 중 리터럴 글꼴 | **456 / 482** (`var(--font-*)` 는 26). 초판의 "413 / 439 (토큰 49)" 는 413+49=462 로 분모와 맞지 않았다 |
| 3클래스 이상 선택자 | **2,470 / 4,989 = 49.5%** (쉼표로 분리한 선택자 단위, 주석 제거 후. 초판의 "1,975 / 4,085 = 48.3%" 는 분모 정의가 적혀 있지 않아 재현되지 않는다 — 비율만 같은 자리) |
| 미정의 `--studio-*` 토큰 | **2종** (`--studio-play`·`--studio-select`, 참조 2회 · 둘 다 fallback 있음). 진단 시점의 8종 중 6종은 `ac4d0ee7` 이 `system-studio.css:25-30` 에 매핑했다 |
| `@layer` 사용 파일 | 11 (components 3·shell 1·editor 3·runtime 4), **database 0** |

**CSS 예산 게이트가 있다.** `.omo/css-budget-baseline.json` 기준선(hex 1,761 / important 986 / undefinedVars 63 / globalRootFiles 10 / cssFileCount 260 — 2026-08-29 재저장분)에 대해 `scripts/check-css-budget.mjs:38-44` 가 다섯 지표 모두 "내려가거나 그대로"만 허용하고 `cssFileCount` 도 래칫이다. **개선을 먼저 하고 여유를 만든 뒤 파일을 신설하는 순서**가 게이트와 협력한다.

### 5.2 토큰만 바꿔도 안 먹는다 — 이유 3개

1. **`font:` 단축 413건이 리터럴 글꼴 스택을 담고 있어** `--font-ui` 를 바꿔도 안 따라온다. 단축이라 font-size·line-height 까지 함께 박혀 타이포 스케일 조정도 개별 편집이 된다. **가드가 이 영역을 제외한다** — `test/fontFamilyTokenGuard.test.ts:78` 의 `SHORTHAND_SCOPE = "src/styles/runtime/"`. 드리프트의 근본 원인이다.
2. 하드코딩 색 756건(13.7%), 파일별 최대 54%. `sidebar.css` 는 레일 전체를 소유하는데 49%가 리터럴이다.
3. **커스텀 스타일시트 주입 기능 자체가 없다.** `adoptedStyleSheets`/`customCss`/`userCss`/`styleOverride`/`themeCss` 는 `src/**/*.ts` 히트 0건이고, 런타임 style 주입은 `src/player/runtimeDebugPanel.ts:59` 한 곳뿐이다.

### 5.3 `@layer` 는 답이 아니다 — 정정

normal 선언에서 **unlayered 가 모든 layered 를 이긴다.** 커스텀 시트를 `@layer overrides` 에 넣으면 database 의 언레이어 규칙에 무조건 진다. 반대로 database 를 레이어로 감싸면 지금 싸울 일이 없는 `!important` **463**건이 database 밖에 남는 **523**건(986 − 463) 중 언레이어 몫에 진다. `!important` 는 레이어 순서를 뒤집으므로 방향 자체는 확실하고, 523건의 언레이어/레이어 분해는 **미확인**이다(§5.1 기준 `@layer` 사용 파일은 11개).

이 저장소의 캐스케이드 제어 수단은 `@layer` 가 아니라 `@import` 로드 순서이고, 그 계약이 최소 9곳에 문서화돼 있다(`index.css:1, 52, 54-55, 57-58, 71, 90-91` 등). `runtime/battle-skins/index.css:4-5` 는 *"do NOT wrap these partials in @layer, or every override would lose to battle.css"* 로 언레이어 유지가 의식적 결정임을 못박는다.

**따라서 커스터마이즈는 CSS 규칙을 노출하는 대신 커스텀 프로퍼티 값만 노출한다.** `documentElement.style.setProperty()` 주입은 inline style 이므로 특이도·레이어 싸움이 없다.

### 5.4 밀도 리듬이 없다

컨트롤 높이 선언 8종 171건(30px 45, 34px 27, 18px 22, 22px 20, 20px 16, 26px 15, 38px 14, 16px 12). 한 탭 안에서 5종이 섞이는 경우가 있다(items/equipment: 16/18/30/34/38px). 라벨 트랙도 42규칙에 24~112px 산포. 행 높이·라벨 폭 토큰이 없어서 각 파일이 자기 값을 정한다.

---

## 6. 설계 방향 — 3안 비교

**안 A — 스킨 레이어만 (DOM 무변경, CSS 전용).** `.database-modal-backdrop` 스코프 단일 규칙 세트로 네이티브 컨트롤 외형 통일: select `appearance:none` + 자체 chevron, number `appearance:textfield` + 스피너 제거, checkbox/radio/range `accent-color` 승격(워크벤치별 8건 제거), `summary` marker 제거, `db-field` 라벨 트랙 통일, line-height 하한. 치수: 행 높이 26px, 라벨 트랙 `clamp(72px, 22%, 112px)`, 본문 12px/1.45·제목 하한 1.3, radius 6/4px.

**안 B — A + 밀도 축 배선 + 헤더 정리.** `editorUiMode` 를 database CSS 에 연결하고 헤더 빌더 4곳에서 kicker/설명문을 밀도 축에 건다. TS 편집은 prose 제거와 죽은 h3 삭제로 제한하고 인터랙티브 자식은 손대지 않는다.

**안 C — A + B + 프리미티브 전면 교체.** 커스텀 셀렉트 설치(스코프 3블록 해제 선행), `fieldset` 74개를 `db-ws-card` 로 수렴, `workspaceList` 19뷰에 `createVirtualList` 연결, 표 4개에 헤더 클릭 정렬.

| 축 | 안 A | 안 B | 안 C |
|---|---|---|---|
| 편집 파일 | CSS 6~8 (신규 0~1) | CSS 8~10 + TS 5 | CSS 15+ + TS 12+ |
| 편집 줄 수 (추정) | 300~450 | 500~700 | 1,500+ |
| 회귀 위험 | 낮음 — DOM·testid 무변경 | 중간 — 테스트 5줄 수정 | 높음 — fieldset 74개 구조 변경, 계약 미확인 |
| 체감 개선 | 큼 (select·number·체크박스) | 큼 + 공간 회복 | 중간 (A/B 이후 한계효용) |
| CSS 예산 | important·hex 감소 가능 | 동일 | 파일 신설 시 FAIL 위험 |
| 커스터마이즈 기반 | 부분 | 축 1개 개방 | 축 다수 개방 |

**추천: 안 B + 안 C 중 커스텀 셀렉트 1건.**

안 A 만으로는 불만 #3(공간)이 남는다. 밀도 축은 새 메커니즘이 아니라 이미 있는 `editorUiMode` 연결이라 추가 비용이 작다. 안 C 의 나머지(fieldset 74개, 가상화, 표 정렬)는 **사용자가 제기하지 않은 문제**이고 회귀 표면이 넓다. 커스텀 셀렉트만 예외인 이유는 §2 의 최대 원인이자 검증된 자산이라서다.

---

## 7. 실행 순서

예산 게이트가 래칫이므로 개선 → 여유 확보 → 신설 순서로 끊었다.

| Phase | 내용 | 검증 | 예산 영향 |
|---|---|---|---|
| 0 | 죽은 코드 제거: `system-studio.css` L118-658(생존 17블록 이관), `light-theme.css` 토큰 블록, `databaseSystemView.ts:122` + `system-studio.css:669`, `desktop.css:2-4` height 선언 | 게이트 개선 + 시각 무변화 스냅샷 | important·hex 하강 → `--save-baseline` 으로 조임 |
| 1 | ~~미정의 `--studio-*` 8종 매핑~~ **완료** (`ac4d0ee7`, 6종 매핑 / 남은 2종은 fallback 보유) | system 탭 카드 hover 배경 복원 | undefinedVars 73 → 63 |
| 2 | 네이티브 컨트롤 스킨 | 탭별 select·number 시각 확인 + 기존 e2e | `modern-controls.css` 병합으로 cssFileCount 유지 |
| 3 | 계측 하네스 작성 → lh 하한 1.3 (134건) | 하네스가 잉크 초과 0 보고 | 변화 없음 |
| 4 | `db-field` 라벨 트랙 통일 (42규칙) | 탭별 폼 스크린샷 대조 | important 하강 가능 |
| 5 | 헤더 prose 제거 + 밀도 축 배선 | 테스트 5줄 수정 후 전체 그린 | 변화 없음 |
| 6 | 커스텀 셀렉트 (스코프 3블록 해제 선행 → 설치 + 탭 전환 refresh) | 팝오버 동작 + testid 유지 | 변화 없음 |
| 7 | 토큰 축 노출 + 프리셋 3종 | 프리셋 전환 스크린샷 3장 | hex 하강 |

**회귀 관리.** `test/e2e/database-modal-size-invariant.spec.ts:53` 이 3개 뷰포트에서 모든 탭의 width/height/left/top 델타 0 을 요구한다. 이 계약은 `.db-shared-workspace` 클래스가 붙어 있을 때만 성립한다 — `desktop.css:2-4` 가 `height: min(820px, …)`(0,1,0), `sidebar.css:69-75` 가 `:has(.db-shared-workspace)`(0,2,0)로 900px 을 주므로 **클래스를 빠뜨린 새 탭은 80px 점프한다.** `openwiki/editor-database.md:11` 의 "Modal geometry has exactly one owner" 를 실제로 만들려면 `desktop.css:2-4` height 선언을 지워야 한다 → Phase 0.

**같은 기회에 정리할 것.** `light-theme.css` 토큰 블록은 이미 죽었다. `studio-theme.css`(`index.css:51`)가 `light-theme.css`(:41)보다 뒤라 이름이 겹치는 58개 중 48개를 studio 가 이기고, `studio-theme.css:96-110` 이 15개를 명시적으로 되짚는다. `light-theme.css:23` 의 크림 `#F7F3EA` 는 도달 불가고 실제 기준면은 `#F7F8F8` 이다. 그런데 `light-theme.css:9-13` 헤더 주석은 여전히 크림 기준 WCAG 대비표를 적고 있어 **신뢰하면 잘못된 접근성 결론에 도달한다.** `--db-light-*` 소비처가 7파일 288건 남아 있다.

---

## 8. 결정이 필요한 것

### Q1. 커스터마이즈 축을 어떻게 노출할까

| 선택지 | 결과 |
|---|---|
| (a) 커스텀 프로퍼티만 + `documentElement.style.setProperty` 주입 | 특이도·레이어 싸움 0. 단 `font:` 단축 413건·하드코딩 756건이 축을 무시 → 선행 정리 필요 |
| (b) `@layer overrides` 에 사용자 CSS | database 언레이어 규칙에 짐. **작동하지 않음** |
| (c) 사용자 CSS 파일 자유 편집 | 3클래스+ 선택자 48.3%, `!important` 476건과 싸워야 함 |

추천 (a). 노출 축은 5개로 제한하고 규칙 레벨 오버라이드는 열지 않는다. 초안(미검증):

```css
:root {
  /* 축 1 밀도 */  --db-row-h: 26px;              /* 현재 20~28px 산포 */
                   --db-label-w: clamp(72px, 22%, 112px); /* 42규칙 24~112px 를 하나로 */
                   --db-card-pad: 12px 14px; --db-field-gap: 3px; --db-stack-gap: 10px;
  /* 축 2 타이포 */ --db-font-size: 12px; --db-line: 1.45;
                   --db-line-title: 1.3;          /* 하한. 1.15/1.05 금지 */
                   --db-font-scale: 1;
  /* 축 3 형태 */  --db-radius: 6px; --db-radius-sm: 4px; --db-border: 1px; --db-chevron: url("…");
  /* 축 4 색 */    --db-surface: var(--db-studio-surface); --db-accent: var(--db-studio-accent); /* … */
  /* 축 5 헤더 */  --db-header-prose: none; --db-header-kicker: none;
}
/* 프리셋 — editorUiMode.ts:188-194 의 body 클래스 재사용 */
body.editor-ui-beginner { --db-row-h: 30px; --db-font-size: 13px; --db-label-w: 112px; --db-header-prose: block; }
body.editor-ui-expert   { --db-row-h: 22px; --db-font-size: 11.5px; --db-label-w: 64px; --db-header-prose: none; }
```

미정의 토큰 매핑은 `ac4d0ee7` 에서 이미 끝났다(`--studio-violet(-soft)` → accent 계열, `--studio-mint` → success, `--studio-amber` → warning, `--studio-surface-2/-3` → inset/surface). 남은 `--studio-play`·`--studio-select` 는 fallback 으로 동작 중이고 소비 지점이 셸(`editor-ui-modes.css`)이라 이 축의 대상이 아니다.

### Q2. 헤더 설명문 11건 유지 판정

(a) 삭제 7 + 툴팁 4 만 처리 → 회수 작고 일관성 안 생김 / **(b) 전부 `--db-header-prose` 축에 걸고 expert 기본 숨김 → `editorUiMode` 재사용이라 추가 비용 작음** / (c) 전부 삭제 → 신규 사용자 안내 소실, 어떤 안내문이 혼동을 막는지는 사용 데이터 없음(미확인).

추천 (b).

### Q3. life-panel 카드 4장(3탭 × 171px)

**(a) DOM 유지 + CSS 로 한 줄 칩 압축 → testid 47줄 무손상, 111px/탭 회수** / (b) DOM 재구성 → 6파일 47줄 수정 / (c) 접이식 → 클릭 1회 추가, 상태 저장 위치 결정 필요.

추천 (a).

### Q4. 커스텀 셀렉트 도입 범위

(a) 안 함, CSS 스킨만 → 트리거는 해결, 옵션 팝업은 OS 그대로 / **(b) 스코프 3블록 해제 후 전량 설치 → 팝업까지 에디터 톤** / (c) 레코드 참조 select 만 → 같은 탭에 두 외형 혼재.

추천 (b). **스코프 해제 없이 설치하면 트리거가 맨 button 으로 남아 현재보다 나쁘므로 순서를 지켜야 한다.**

### Q5. 폰트 상향과 헤더 축소의 순서

10px→11.5px 상향은 헤더를 키운다. §4.4 회수와 한 묶음으로 가야 상쇄되는데, 어느 쪽을 먼저 검증할지 결정이 필요하다.

---

## 9. 측정 재현

측정에 쓴 Playwright 프로브 2개는 일회용 진단 스크립트였고 **이 워크트리 정리 과정에서 `scripts/` 와 `verify-shots/` 산출물이 함께 제거됐다.** 이 저장소는 `.gitignore:101-168` 에서 일회용 프로브를 정리 대상으로 규정하므로(유지할 것만 `!` 예외) 이 문서의 숫자가 durable 산출물이고 스크립트는 아니다.

재작성 시 골격은 `scripts/probe-editor-surface.mjs`(gitignore 예외로 유지되는 프로브) 참고. 수집 항목:

1. `localStorage.setItem("oprn:editor-ui-mode", "expert")` 후 `?freshProject=1` 부팅, `toolbar-database` 클릭
2. `[data-testid="db-tab-<slug>"]` 순회 클릭 (29 slug — 목록은 `scripts/shoot-db-tabs.mjs:14`)
3. `.database-modal-body .db-body` 기준 수집:
   - **헤더 비용**: 헤더 후보 클래스의 `getBoundingClientRect().height` / 탭별 가용 높이. **탭마다 가용 높이가 다르므로 분모를 탭별로 실측할 것**(§4.2)
   - **네이티브 컨트롤**: `select`/`input[type=…]`/`details`/`table` 개수 + `getComputedStyle().appearance === "none"` 비율
   - **타이포**: 자체 텍스트 노드를 가진 요소의 `fontSize`/`lineHeight`/`opacity`. 임계 11px / 1.2 / 0.55
   - **밀도**: 컨트롤 높이 고유값 집합, 라벨 트랙 폭
   - **실제 잘림**: 요소 rect 대 `overflow !== visible` 인 가장 가까운 조상 rect. 조상이 스크롤 가능하면 제외

**주의 2개.** ① §3-A 가 설명하듯 행높이로 인한 잘림은 요소 자신의 내부에서 일어나므로 위 5번(조상 비교)으로는 안 잡힌다. 두 검사를 함께 돌려야 한다 — 한쪽만 보면 "잘림 없음"이라는 잘못된 결론이 나온다. ② 런타임 **노드 수**와 CSS **선언 수**를 섞지 말 것(초판이 lh 건수를 이렇게 틀렸다).

---

## 10. 확인됨 / 추정

**실측·코드로 확인됨**: §2 컨트롤 개수와 경로, §3 A·D·E·F 의 위치와 메커니즘, §4.2 작업 영역 높이, §4.3 스크롤 불변, §4.5 인터랙티브 자식 분리 구조, §5.1~5.3 의 모든 카운트와 캐스케이드 방향, 예산 게이트 기준선, 자산 미사용 현황.

**미확인 / 추정**:
- §3-B 는 시드 데이터에서 실제 잘림 미관측. 긴 레코드 이름으로 재측정 필요
- 한글 10px 판독성 판단 — 정량 사용자 테스트 없음
- §4.4 의 `.db-overview-hero` p 회수 약 20px 은 실측 미확인
- §4.2 의 classes 탭 473px 원인 미확인
- lh 1.3 상향이 실제로 몇 px 레이아웃을 밀지는 규칙별 재측정 필요
- §6 의 편집 줄 수 300~450 / 500~700 / 1,500+ 는 추정
- 외부 에디터(RPG Maker·Godot·Unity) 레퍼런스 조사는 **이번 범위에서 수행되지 않았다.** 이 문서의 레퍼런스는 전부 저장소 내부 선례다
- §8 Q1 의 토큰 스키마와 §6 안 A 의 스킨 치수는 초안이며 실행·검증하지 않았다. `::-webkit-details-marker` 는 `MEMORY.md` 의 `::details-content` 이슈와 충돌 가능
