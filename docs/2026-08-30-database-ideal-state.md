# 데이터베이스 UI/UX — 근거 기반 "이상적 상태" 정의

작성: 2026-08-30
범위: 데이터베이스 모달 29개 탭 전부
성격: 목표 정의 + 실행 계약. 진단은 `docs/2026-08-29-database-uiux-brainstorm.md` 를 정본으로 인용한다.

계측 하네스: `scripts/qa/db-ux-probe.mjs` (신규). 29탭을 순회하며 4축을 한 번에 측정하고
`verify-shots/db-ux/<before|after>/probe.json` 에 남긴다. 이 문서의 목표값은 그 하네스의
출력으로 판정한다 — "눈으로 보기 좋아졌다" 는 판정 근거가 아니다.

---

## 0. 왜 이 문서가 필요한가

브레인스톰 문서는 원인을 확정했지만 **목표 상태를 숫자로 못박지 않았다.** 그래서 "개선했다" 는
주장이 검증 불가능했다. 이 문서는 각 축에 대해 (a) 현재값 (b) 목표값 (c) 판정 방법을 적는다.

그리고 이 저장소에는 눈으로 고치다 실패한 선례가 있다 — PR #194 는 line-height 잘림을
육안으로 골라 고치다 **5번 틀렸다**(브레인스톰 §3-A 인용). 계측 우선은 취향이 아니라 이 저장소의
학습이다.

---

## 1. 이상적 상태 — 5개 축

### 축 1. 컨트롤 외형: OS 위젯 0개

**이상 상태.** 모달 안의 어떤 폼 컨트롤도 OS 기본 위젯으로 보이지 않는다. `select` 는 자체
셰브론, `input[type=number]` 는 스피너 없음, `checkbox`/`radio` 는 에디터 강조색, `range` 는
자체 트랙/썸, `details > summary` 는 자체 화살표.

**근거.** 브레인스톰 §2(1)(2). 런타임 select 141개, number 생성 187곳. `appearance:none` 을
select 에 주는 규칙은 기준선 1건뿐이고 나머지 61건은 배경·테두리·폰트만 바꿔 셰브론은 OS 그대로다.
실측으로 확인된 최악 지점은 배우 탭 `시작 직업 > 직업` — `actorRecordControls.ts:186→195` 의
순수 `el("select")` 가 list 뷰 기본 경로에서 `classicSheet` 미append 로 **어떤 규칙에도
매치되지 않는 완전 무스타일 위젯**이다 (2026-08-30 스크린샷 `before/actors.png` 로 재확인).

**목표값.** `probe.json` 의 `totals.selectUnskinned = 0`, `numberUnskinned = 0`,
`detailsMarker = 0`, `rangeUnskinned = 0`.

**레버리지.** `databaseModal.ts:433` 이 backdrop 을 `document.body` 직속으로 붙이므로
`.database-modal-backdrop` 스코프 1세트가 29탭을 전부 덮는다. 탭을 하나씩 돌 필요가 없다.

### 축 2. 이미지: 안 보이는 이미지 0개

**이상 상태.** 데이터베이스 안의 모든 이미지 표면(레코드 목록 썸네일, 아이템·스킬 아이콘, 배우
캐릭셋·얼굴, 시스템 미리보기, 농사·작물 미디어)이 실제로 그려진다. 디스크에 자산이 실제로 없는
경우에는 **빈 상자가 아니라 라벨이 붙은 자리표시자**가 보인다 — 사용자가 "이미지가 안 보인다"
와 "이미지가 없다" 를 구분할 수 있어야 한다.

**근거.** 사용자 보고. 코드 경로상 후보는 (a) `resolveAssetResourceUrl` 이 null 을 반환해
`backgroundImage` 자체가 설정되지 않는 경로(`databaseItemRecordView.ts:387`,
`databaseCropView.ts:892`, `databaseSystemView.ts:845/1849`), (b) 크로마키
(`chromaKey.ts` → `applyMagentaChromaKey`/`applyAutoChromaKeyToBackground`)가 실패하거나
과하게 먹어 픽셀이 전부 투명해지는 경로, (c) 0px 로 접힌 상자,
(d) `.db-list-thumb-probe` 같은 계측용 1x1 이미지가 실제 슬롯을 밀어내는 회귀
(`databaseCharacterView.ts:400-405` 가 이미 한 번 인라인으로 되돌린 전례).

**목표값.** `totals.imgBroken = 0`, `imgZero = 0`, `bgZero = 0`, `badUrls = 0`,
`failedImageRequests = 0`. 자산 부재가 원인인 항목은 자리표시자 렌더를 스크린샷으로 증명한다.

### 축 3. 타이포그래피: 자기 글리프를 깎는 요소 0개

**이상 상태.** 어떤 텍스트 요소도 자기 자신의 `overflow` 로 글리프를 깎지 않는다. 한글 본문의
최소 크기는 판독 가능한 하한을 지키고, 제목류의 `line-height` 는 1.3 이상이다.

**근거.** 브레인스톰 §3. lh 선언 134건(단축 111 + 롱핸드 23), 111 중 **106건이 1.05 미만**.
11px 미만 텍스트 노드 341개. 핵심 메커니즘은 `1d693d77`(PR #194) 주석이 남긴 사실 —
"**요소 자신의** `overflow: hidden` 이 글리프 위아래를 깎는다. 그래서 부모 상자를 키워도
안 없어졌다." 이래서 조상-비교 측정은 0건을 냈고 육안 판정이 5번 틀렸다.

**목표값.** `totals.selfClipped = 0`. `lowLineHeight`(비율 1.2 미만) 는 제목류에서 0,
`tinyFont`(11px 미만) 는 before 대비 유의하게 감소. `src/styles/database/**` 에 제목류
선택자의 `line-height < 1.3` 선언이 남지 않는다.

**함정.** lh 상향은 헤더를 키운다 → 축 4 회수와 **한 묶음으로** 검증해야 상쇄가 보인다
(브레인스톰 Q5).

### 축 4. 공간과 설명문: 설명은 아이콘으로, 헤더는 회수

**이상 상태.** 탭 헤더가 상시 비용으로 화면을 먹지 않는다. 문장으로 설명하던 것은 **아이콘 +
값 칩**으로 바뀌어 한눈에 읽힌다. 설명문이 필요한 경우는 밀도 축(`--db-header-prose`)에 걸려
초급 모드에서만 보인다.

**근거.** 브레인스톰 §4. `.db-battle-studio-heading` 이 4탭에서 **97.1px 상시 비용**
(padding 16 + title-block 80.1 + border 1)이고 `modern/utility-records.css:18-26` +
`workspace-modern.css:220-246` 조합 때문에 **스크롤해도 사라지지 않는다**(scrollTop 285 이동
후 rect 불변). 탭별 가용 높이는 497~772px 로 **275px 출렁인다**.
사용자 요구가 여기에 직접 붙는다 — "설명은 최소화, 일목요연, 아이콘 다수 사용 가능,
사용자들은 이미지에 기반한 설명을 좋아함".

**목표값.** `.db-battle-studio-heading` 97.1px → **56px 이하**. life-panel 3탭의 카드
171px → 한 줄 칩(~60px). `totals.workspaceHeightSwing` 275px 대비 감소.
`structureKitDbTab.ts:98-100` 의 무클래스 `h3`+`p`(UA `margin:1em 0` 로 제목 13px < 설명
14px 위계 역전)를 `db-tab-note` 로 전환.

**설명문 처분 방침(브레인스톰 Q2 추천 (b)).** 전부 삭제가 아니라 **밀도 축에 건다.**
`editorUiMode.ts:188-194` 의 body 클래스를 재사용하므로 새 메커니즘 비용이 없다.
아이콘은 `databaseTabIcons.ts`(223줄, 인라인 SVG) 문법을 재사용한다 — 래스터 생성 이미지는
쓰지 않는다(저장소 용량·스튜디오 톤·픽셀 스케일 불일치). 이미지 기반 설명은 **생성 그림이
아니라 실제 게임 자산 썸네일**로 만든다. 그게 사용자가 편집 중인 대상 자체이므로 생성 일러스트
보다 정보량이 높다.

**보존 계약.** 헤더 안 인터랙티브 노드 4군데는 prose 와 이미 별개 자식이다
(`databaseBattleStudio.ts:24-37` nav 4버튼 / `databaseLifeCraftingView.ts:330-369` 섹션 칩 10개 /
`databaseSystemStudio.ts:112-152` 상태점+검색+플레이테스트 / `databaseOverviewView.ts:75-96`
AI 버튼). eyebrow/h2/h3/p 만 제거하고 인터랙티브 자식은 그대로 반환한다 — "통째로 지운다" 는
전제는 성립하지 않는다.

### 축 5. 회귀: 계약을 하나도 깨지 않는다

**이상 상태.** 기존 계약 전부 그대로.

**근거이자 목표값.**
- `test/e2e/database-modal-size-invariant.spec.ts:53` — 3뷰포트(1920×1200 / 1280×800 /
  1024×768)에서 전 탭 window `width`/`height`/`left`/`top` 델타 0. **새 탭 콘텐츠가 모달
  기하를 다시 선언하면 실패한다** (과거 1628 → 1584 → 1530px 점프 사고).
- `npm run gates:css` 래칫 — `scripts/check-css-budget.mjs:38-44` 가 hex / important /
  undefinedVars / globalRootFiles / **cssFileCount** 5지표에 "내려가거나 그대로" 만 허용.
  **새 CSS 파일을 만들면 FAIL** 이므로 기존 `modern-controls.css` 에 병합한다.
- `db-field-*` / `db-record-row-*` / `db-record-card-*` / `db-system-nav-*` /
  `db-type-chart-*` / `db-tab-*` testid 전부 유지 (`openwiki/editor-database.md`).
- vitest 기준선은 이미 빨간불이므로 **기준선에 없는 새 실패 이름만** 회귀로 본다 (`AGENTS.md`).

---

## 2. 하지 않을 것 (범위 경계)

브레인스톰 §6 의 안 C 중 아래는 **사용자가 제기하지 않았고 회귀 표면이 넓다.** 제외한다.

- `fieldset` 74개를 `db-ws-card` 로 수렴 — 구조 변경, 계약 미확인.
- `workspaceList` 19뷰에 `createVirtualList` 배선 — 성능 불만 없음.
- 표 4개 헤더 클릭 정렬 — 기능 추가.
- `@layer` 도입 — **거꾸로다.** normal 선언에서 unlayered 가 layered 를 이기므로 database 를
  레이어로 감싸면 언레이어 `!important` 에 전부 진다. `runtime/battle-skins/index.css:4-5` 가
  언레이어 유지를 의식적 결정으로 못박고 있다.
- 사용자 CSS 파일 주입 — 3클래스+ 선택자 49.5%, `!important` 463건과 싸워야 한다.
  커스터마이즈는 커스텀 프로퍼티 값만 노출하는 방향이 옳다(브레인스톰 Q1 (a))이나, 이번 범위는
  **축 1~4 를 실제로 고치는 것**이고 커스터마이즈 UI 는 후속이다.

포함하는 예외 1건: **커스텀 셀렉트**(`eventEditor/customSelect.ts` 546줄 + CSS 290줄, database
사용 0건). §2 의 최대 원인이고 이미 검증된 자산이라서다. 단 **스코프 해제 선행** — 해제 없이
설치하면 트리거가 맨 button 으로 남아 지금보다 나빠진다(브레인스톰 Q4).

---

## 3. 실행 순서와 파일 소유권

병렬 에이전트가 같은 파일을 동시에 만지면 검증이 움직이는 표적을 쫓는다(`AGENTS.md` 하드 룰).
그래서 웨이브마다 **파일 소유권을 배타적으로** 나눈다.

| 웨이브 | 노드 | 배타 소유 파일 | 의존 |
|---|---|---|---|
| 1 | 이미지 복구 | `databaseRecordThumbnails.ts`, `databaseCharacterView.ts`, `chromaKey.ts`, `record-thumbs.css`, `skill-item-visuals.css` | — |
| 1 | 컨트롤 스킨 | `modern-controls.css`, `studio-theme.css` | — |
| 2 | 타이포 하한 | `src/styles/database/**` (웨이브1 소유 2파일 제외) | 1 |
| 2 | 헤더→아이콘 | `databaseBattleStudio.ts`, `databaseLifeCraftingView.ts`, `databaseSystemStudio.ts`, `databaseOverviewView.ts`, `structureKitDbTab.ts`, `battle-studio.css`, life CSS | 1 |
| 3 | 커스텀 셀렉트 | `databaseControls.ts`, `actorRecordControls.ts`, `event-editor.custom-select.css` | 2 |
| 4 | 검증 | (읽기 전용) | 3 |

웨이브 3 이 마지막인 이유: 스킨(웨이브1)이 먼저 깔려야 셀렉트 트리거 외형이 회귀하지 않고,
타이포 하한(웨이브2)이 먼저 정해져야 팝오버 행 높이를 같은 토큰에 맞출 수 있다.

---

## 3.5 실측이 뒤집은 전제 (2026-08-30 BEFORE 측정)

브레인스톰 문서 기준으로 계획을 세운 뒤 30탭 + 49서브섹션을 실측하니 **여러 전제가 이미 해소돼
있었다.** 정직하게 적는다 — 아래는 이번 작업의 성과가 아니다.

| 전제 | 실측 | 판정 |
|---|---|---|
| select 141개가 OS 위젯 | `selectUnskinned = 0` | **이미 해결** (appearance:none 기준선이 전부 덮음) |
| 작업영역 출렁임 275px | 전탭 796px, `swing = 0` | **이미 해결** (모달 기하 단일소유자) |
| 자산 로드 실패로 이미지 안 보임 | HTTP 200 전부, `imgBroken/badUrls/failedImageRequests = 0` | **원인 아님** |
| 0px 이미지 16건이 버그 | 전부 비활성 패널(display:none) 안, computed 크기 정상(40/24/72x48) | **버그 아님** |
| 글자 잘림이 광범위 | `selfClipped = 0` (상위 탭), 서브섹션에서 **4건** | **범위 축소, 단 실재** |

따라서 실제 대상은 다음으로 확정한다.

1. **숫자 스피너 122개** — 단, `modern-controls.css:60-72` 가 "대안(스테퍼) 없이 스피너를 지우면
   마우스 전용 사용자에게 회귀" 라며 과거 되돌린 결정을 기록해 두었다. 그래서 **스테퍼를 공용
   헬퍼(`numberField`)에 먼저 배선하고 그다음 스피너를 제거**한다. 이 순서를 뒤집으면 회귀다.
2. **range 6개 / details 마커 3개** — 대안 필요 없음, 바로 스킨.
3. **이미지 실패의 비가시성** — 현재 실패한 이미지는 "빈 상자" 로 조용히 사라진다.
   `.db-list-thumb.empty` 는 opacity 0.36 + 1px 대각선이라 사실상 안 보인다.
   선례: `src/styles/dialogue.css:405-420` 에 같은 계열 사고(에디터 전용 CSS 에만 크기 선언이
   있어 출하 플레이어에서 "높이 0 의 빈 테두리")가 기록돼 있다. → 자리표시자 + onerror + 크기 하한.
4. **11px 미만 한글 389노드** — 사용자의 "안 보인다" 는 오늘 기준 잘림이 아니라 **너무 작은 글자**다.
5. **자체 클리핑 4건 (실재)** — `system` 탭 `title` 섹션의 `span.db-system-preview-label`:
   font-size 11px / line-height 11px(비율 1.0)로 **자기 글리프를 2px 깎는다**. 잘리는 한글은
   타이틀·시작화면·시스템·전투. PR #194 주석이 설명한 "요소 자신의 overflow" 메커니즘과 동일하다.
6. **헤더 비용** — 문서가 지목한 97.1px 보다 life 계열이 훨씬 크다: characters 677.5 /
   monster-species 566.5 / crops 422.4.

### 범위에서 제외 (근거 있는 축소)

**커스텀 셀렉트 설치를 제외한다.** 브레인스톰 Q4 의 전제("트리거가 OS 위젯")가 `selectUnskinned = 0`
으로 거짓임이 밝혀졌다. 남는 이득은 옵션 팝업 외형 하나인데, 546줄 컴포넌트를 141개 셀렉트에
꽂는 회귀 표면이 그 이득을 넘는다. 사용자가 제기한 항목도 아니다.

## 4. 판정 (이 문서의 계약)

`before/probe.json` 대 `after/probe.json` 을 비교해 아래가 모두 성립할 때 완료다.

| 축 | 지표 | before | after 목표 |
|---|---|---|---|
| 1 | numberUnskinned / rangeUnskinned / detailsMarker | 122 / 6 / 3 | 전부 0 (스테퍼 배선 선행) |
| 2 | 이미지 실패의 가시성 | 실패 시 빈 상자(비가시) | 자리표시자 렌더 + 회귀 테스트 |
| 3 | selfClipped / subSelfClipped / tinyFont | 0 / 4 / 389 | 0 / 0 / 0 |
| 4 | 헤더: characters / monster-species / crops / battle-studio | 677.5 / 566.5 / 422.4 / 97.1 | ≤200 / ≤180 / ≤160 / ≤56 |
| 5 | modal-size-invariant e2e / gates:css / 신규 실패 이름 | — | 통과 / 통과 / 0건 |
