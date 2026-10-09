# CSS 표면 격리 설계 — 에디터 + 데이터베이스

작성: 2026-09-11. 근거: 같은 날 수행한 에디터 CSS 적대적 전체 리뷰(서브에이전트 3개 + 교차 검증).
상태: 설계 승인 대기 → 승인 후 `docs/superpowers/plans/` 에 실행 계획.

## 1. 문제

디렉토리는 이미 표면별로 나뉘어 있다(`src/styles/editor` 36,349줄 · `database` 40,862줄 · `shell` 5,623줄 · `map`
1,219줄 · `runtime` 11,392줄). 그런데도 스타일이 꼬이는 원인은 폴더가 아니라 **캐스케이드가 하나**라는 데 있다.

측정으로 확정한 사실(스크립트: 275개 시트를 `index.css` 부터 평탄화, postcss 로 62,189 선언 인덱스):

| 증상 | 측정값 |
|---|---|
| 진입점 | `src/styles/index.css` 하나. 승자는 "누가 뒤에 오는가"로 결정 |
| "반드시 X 뒤에" 순서 주석 | index.css 와 허브에 12곳 |
| 이벤트 에디터가 같은 DOM 을 재선언하는 세대 | 7 (legacy → part-1/2/4/3 → modern/* → modernize → mockup → windowing → balanced) |
| 같은 선택자·같은 속성을 3개 이상 파일이 다른 값으로 선언 | 에디터 범위 68건, 4~5개 파일이 싸우는 표면은 모달 창·헤더·푸터·workbench |
| `.event-editor-modal-window` 를 건드리는 파일 | 9 |
| `.database-modal-window` 를 건드리는 파일 | 34 |
| `!important` | 에디터·셸 63, DB 315 (spatial-collections 125, studio-theme 88) |
| `@layer` | index.css 가 10개 레이어를 선언하지만 실제 레이어 안에 있는 에디터 시트는 4개. 언레이어 규칙이 항상 이겨 그 4개는 조용히 진다 (`village-info.css` 모달 크기 무효, `storyboard.css` 사실상 전부 사문) |
| CSS→TS 방향 죽은 규칙 | 191개 / 1,154줄 (동적 접두어 제외, 상위 13종 grep 재확인) |
| 폴백 없는 미정의 변수 | 4 (`--editor-row-hover` `--editor-surface` `--surface-1` `--event-popup-surface`) |
| `TOKENS.md` | 폐기된 웜 크림 팔레트를 계약. `tokens.css` 는 2026-08-25 부터 슬레이트. 크림 폴백 리터럴 26종의 원인 |
| 게이트 4종 | 위 결함을 하나도 잡지 못함 (`dead-css` 는 TS→CSS 방향·접두어 3종 한정, `live-classes` 는 디렉터리 순회, `budget` 은 줄 수 판정 제외, `graph` 는 배선만) |

세 가지 근본 원인:

1. **표면 경계가 CSS 에 없다.** 어느 파일이든 어느 클래스든 건드릴 수 있다. 에디터 시트가 DB 시트에 진다.
2. **순서가 규칙이다.** 순서로 이기려다 `!important` 를 쓰고, 그러면 다음 사람도 `!important` 를 쓴다(workbench 열 배치는 3세대 전부 `!important`).
3. **세대 교체를 덮어쓰기로 했다.** 옛 시트를 지우지 않고 새 시트를 뒤에 얹는다.

## 2. 목표 · 비목표

**목표**

- 표면(surface) 하나의 스타일은 그 표면의 디렉토리·진입 시트·레이어 안에서만 정의되고, 다른 표면의 DOM 에 닿지 않는다.
- import 순서·`!important` 로 승자를 정하지 않는다. 승자는 레이어 순서와 특이도로만 정해진다.
- 시각 결과는 바뀌지 않는다. 모든 단계는 기준선(계산 스타일 JSON + 픽셀 스크린샷)이 동일함을 증거로 닫는다.
- 게이트가 위 원인 세 가지의 재발을 CI 에서 막는다.
- 이벤트 에디터 7세대와 DB 세대(core → tabs → desktop → light-theme → studio-theme → workspace-modern → modern/* → studio-v2)를 각각 한 세대로 접는다.

**비목표**

- 시각 재디자인. 색·간격·폰트 값을 바꾸지 않는다(단, 이미 죽은 선언은 지운다).
- `runtime/`(플레이어), `resources/`, `dialogue.css`, `community-site/` 의 내부 정리. 이들은 레이어 경계만 받고 내용은 그대로 둔다.
- 클래스 이름 체계 통일. 접두어 레지스트리는 **현재 이름을 등록**하는 것이지 이름을 바꾸는 것이 아니다.
- CSS Modules · Tailwind 등 도구 도입.

## 3. 설계

### 3.1 표면과 레이어

표면 하나 = 디렉토리 하나 = 진입 시트 하나 = 레이어 하나 = 그 표면을 마운트하는 TS 한 곳의 import.

| 레이어 (순서) | 디렉토리 | 진입 시트 | import 하는 곳 | 내용 |
|---|---|---|---|---|
| `tokens` | `src/styles/tokens.css` | 자체 | `index.css` | 디자인 토큰. 유일한 `:root` 토큰 정의 위치 |
| `base` | `index.css` 하단 블록 → `src/styles/base/` | `base/index.css` | `index.css` | html/body/스크롤바/selection 등 요소 기본값 |
| `components` | `src/styles/components/` | `components/index.css` | `index.css` | 표면 공용 프리미티브(app-modal, icons, empty-state, grid-4, 버튼 `.btn`) |
| `shell` | `src/styles/shell/` | `shell/index.css` | `index.css` | 톱바·메뉴·좌측 레일·밀도 모드·웰컴·컨텍스트 메뉴 |
| `map` | `src/styles/map/` ← `editor/` 의 맵 관련 시트 이동 | `map/index.css` | `index.css` | 맵 패널·팔레트·캔버스 툴바·region-task·world-panel·map-props·인라인 어시스트 등 맵 편집 표면 |
| `event` | `src/styles/event/` ← `editor/event-editor*` 전부 + storyboard + 서브다이얼로그 | `event/index.css` | `src/editor/panels/eventEditor/modal.ts` | 이벤트 에디터 모달과 그 안의 모든 것 |
| `database` | `src/styles/database/` | `database/index.css` | `src/editor/panels/databaseModal.ts` | DB 모달 30탭·조수 패널·스튜디오 |
| `resources` | `src/styles/resources/` | `resources/index.css` | `index.css` | 리소스 매니저 |
| `runtime` | `src/styles/runtime/` + `dialogue.css` | `runtime/index.css` | 기존대로 | 플레이어 런타임. 내용 불변 |
| `overrides` | `src/styles/overrides.css` | 자체 | `index.css` | 표면 경계를 넘어야 하는 예외. 항목마다 이유 주석과 만기일 |

레이어 순서 선언은 `index.css` 첫 줄 하나뿐이다:

```css
@layer tokens, base, components, shell, map, event, database, resources, runtime, overrides;
```

지연 로드되는 표면(`event`, `database`)의 CSS 가 나중에 주입되어도 이 선언이 순서를 고정한다. 레이어는 선언 순서로 정렬되고, 나중에 같은 이름에 추가된 규칙은 그 자리에 들어간다.

`editor/` 디렉토리는 **없어진다**. 현재 59개 시트는 `map/`(맵 편집·팔레트·월드 패널·마을 정보·region-task·인라인 어시스트)과 `event/`(이벤트 에디터와 그 안의 모든 것)로 나뉜다. 어느 쪽도 아닌 셸 대화상자(`ai-settings-modal.css`, `help-modal.css`, `audio-test-dialog.css`, `cluster-ai-modal.css`, `local-diagnostics.css`)는 `shell/dialogs/` 로 간다. 배정표는 실행 계획에서 파일 단위로 확정한다.

### 3.2 레이어에 넣는 방법

리프 시트는 건드리지 않는다. 진입 시트가 `layer()` 로 넣는다:

```css
/* src/styles/event/index.css */
@import "./shell.css" layer(event);
@import "./pages.css" layer(event);
```

Vite 6.4.3 이 이를 `@layer event { … }` 로 인라인함을 확인했다(2026-09-11, 최소 재현 빌드). 중첩 허브(`event-editor.css` → `part-*.css`)는 진입 시트로 평탄화한다. 허브 계층은 진입 시트 한 단계만 허용한다.

### 3.3 경계 규칙 (게이트가 강제)

- **R1 언레이어 금지.** `index.css` 의 `@layer` 선언과 `@import … layer()` 를 제외한 모든 규칙은 어느 레이어 안에 있어야 한다. 위반 = 실패.
- **R2 표면 밖 선택자 금지.** 표면마다 클래스 접두어·루트 선택자 레지스트리(`scripts/css-surfaces.json`)를 둔다. 예: `event` = `.event-*`, `.ecp-*`, `.cmd-*`, `.rich-*`, `.m2-*`, `.page3-*`, `.schema-*`, `.shop-*`, `.move-route-*`, `.event-subdialog-*` …; `database` = `.database-*`, `.db-*`, `.oprn-record-*`, `.actor-*`, `.ai-chat-*`, `.tileset-*` …. 표면 시트의 선택자에 등장하는 클래스는 자기 표면 레지스트리 또는 `components` 레지스트리에 있어야 한다. `data-testid` 속성 선택자는 표면 루트 안에서만 허용. 위반 = 실패. 예외는 `overrides` 레이어로만.
- **R3 `!important` 래칫.** 표면별 개수 기준선을 저장하고 늘면 실패. 목표치: `event` 63→0, `database` 315→0(`overrides` 제외). 0 이 된 표면은 기준선을 0 으로 고정.
- **R4 변수 해석.** `var(--x)` 는 `tokens.css` 에 정의되거나, 같은 표면 안에서 정의되거나, 토큰으로 떨어지는 폴백이 있어야 한다. 표면 사설 토큰은 표면 접두어(`--ev-*`, `--db-*`, `--map-*`, `--shell-*`)를 쓰고 표면 루트 선택자 아래에서만 정의한다. `:root` 재정의 금지.
- **R5 CSS→TS 죽은 선택자.** 선택자가 요구하는 모든 클래스·id·data 속성이 `src/**/*.ts|tsx`·`index.html` 어디에도 없으면 실패. 동적 접두어(`\`foo-${`·`"foo-" +`)는 접두어 단위로 살아 있다고 본다. 기준선은 0 에서 시작한다(정리 후 도입).
- **R6 순서 주석 금지.** "뒤에 와야", "must come after", "마지막 발언자" 류의 주석이 있으면 실패. 순서로 이기는 설계가 남았다는 신호다.

게이트 스크립트는 `scripts/check-css-surfaces.mjs` 하나로 R1–R6 을 한 패스에 검사하고, `gates:css` 에 붙인다. 기존 `check-css-live-classes.mjs`·`check-dead-css-classes.mjs`·`measure-css-deletable.mjs` 는 R5 도입 후 제거한다(살려 둘 이유가 없고 허위 초록의 원천이다). `check-css-graph.mjs` 는 허브 평탄화 후 "진입 시트 외 @import 금지" 검사로 축소한다.

### 3.4 세대 접기 (표면 내부 정리)

표면마다 같은 절차:

1. **평탄화 인덱스**: 그 표면의 유효 순서로 모든 선언을 (선택자, 속성) 키로 인덱싱한다. 리뷰에서 쓴 `/tmp/cssrev/extract.mjs` 를 `scripts/css-flatten.mjs` 로 승격한다.
2. **사문 제거**: 같은 (선택자, 속성)의 뒤 선언에 완전히 가려지는 앞 선언을 지운다. `@media`·`:hover` 등 조건이 다른 것은 가려진 것으로 보지 않는다. 특이도가 다른 선택자 간 가림은 계산하지 않고 남긴다(보수적).
3. **죽은 규칙 제거**: R5 판정 죽음을 지운다.
4. **`!important` 해체**: 남은 `!important` 는 (a) 같은 표면 안 경쟁이면 뒤 선언만 남기고 플래그 제거, (b) 다른 표면을 이기려는 것이면 `overrides` 로 이동하고 이유 기록, (c) 레이어 순서로 이미 이기는 것이면 플래그 제거.
5. **재편성**: 남은 규칙을 세대가 아니라 **구성 요소** 기준으로 파일에 모은다(`event/shell.css`, `event/pages.css`, `event/command-list.css`, `event/inspector.css`, `event/subdialogs/*.css`, `event/command-forms/*.css`, `event/previews/*.css`). 파일 하나 1,000줄 상한.
6. **검증**: 3.5 기준선 동일.

이벤트 에디터의 실질 기준은 `event-editor.balanced.css`(3,269줄) 다. legacy·part-*·modern/*·modernize·mockup 의 같은 선택자 선언은 2단계에서 대부분 사라진다. DB 의 실질 기준은 `studio-v2.css` + `modern/*` 이며 `light-theme.css`·`studio-theme.css`·`workspace-modern.css` 가 주로 사라진다.

### 3.5 검증 하네스

기존 계산 스타일 기준선 6종(`test/fixtures/eventEditor*Surface.baseline.json`)은 유지하고 확장한다. 픽셀 기준선은 현재 0 건이라 새로 만든다.

- **계산 스타일 기준선**: 기존 6종을 그대로 유지한다. 셸·맵·마을 정보·DB 는 happy-dom 렌더 진입점이 표준화돼 있지 않아 아래 픽셀 기준선이 맡는다.
- **픽셀 기준선** (`test/e2e/css-surface-shots.spec.ts`, `toHaveScreenshot`, 1280×800 과 1440×900): 에디터 초기 화면, 초보/전문 밀도, 이벤트 에디터 페이지 1·2·3, 명령 피커, 그래픽 대화상자, 이동 경로 대화상자, 마을 정보, DB 모달 30탭. 애니메이션 비활성(`reduced-motion` + `animations: "disabled"`), 고정 프로젝트 픽스처, 고정 시계. 임계값 `maxDiffPixelRatio: 0.001`.
- **기준선 갱신 규칙**: 기준선은 **표면 작업 시작 전** 현재 main 에서 찍는다. 표면 작업 중에는 갱신 금지. 의도적 차이가 나오면 그 항목은 사문이 아니었다는 뜻이므로 되돌린다. 유일한 예외는 리뷰에서 결함으로 확정된 4건(마을 정보 모달 크기, 명령 피커 푸터 배경, `--editor-row-hover`, `--editor-surface`/`--surface-1`)이며, 이들은 스펙 §1 을 근거로 별도 커밋에서 고치고 기준선을 갱신한다.

### 3.6 `TOKENS.md`

`tokens.css` 값으로 전면 재작성한다. "웜 크림" 서술과 크림 값 표를 전부 지운다. 표면 사설 토큰 규칙(R4)과 레이어 표(§3.1)를 문서에 넣는다. §4 0단계에서 한다.

## 4. 단계

각 단계는 독립 PR 이고, 게이트 전부 초록 + 기준선 동일이 머지 조건이다. main 이 빠르게 움직이므로(테스트 중 19 커밋 관찰) 단계를 작게 자른다.

| 단계 | 내용 | 산출 |
|---|---|---|
| 0. 잠금 | 기준선 촬영(계산 스타일 + 픽셀), `check-css-surfaces.mjs` 초안(R1–R6, 현재 상태를 기준선으로 저장해 **경고만**), `css-flatten.mjs`, `css-surfaces.json` 레지스트리 초안, `TOKENS.md` 재작성, 미정의 변수 4건·마을 정보 모달 결함 수정 | 게이트 스크립트, 기준선, 문서 |
| 1. 레이어 씌우기 | `index.css` 레이어 선언 확정, 표면별 진입 시트 생성, 모든 허브를 `@import … layer()` 로 전환, `event`·`database` 진입 시트를 TS import 로 이동. **리프 시트 내용 불변.** R1 을 실패로 승격 | 시각 동일 검증. `!important` 는 이 단계에서 일부 무의미해지지만 아직 지우지 않음 |
| 2. 이벤트 에디터 접기 | §3.4 절차. `editor/event-editor*` + storyboard + custom-select + 서브다이얼로그 → `event/`. R2·R3·R5 를 `event` 표면에 대해 실패로 승격 | `event/` 완성, 세대 1 |
| 3. 셸·맵 접기 | `editor/` 잔여 + `shell/` + `map/` → `shell/`·`map/`. `editor/` 디렉토리 삭제. R2·R3·R5 승격 | `editor/` 소멸 |
| 4. DB 접기 (4 PR) | 4a 셸·레일·목록 (`studio-v2` 기준, `light-theme`·`studio-theme`·`workspace-modern` 흡수) → 4b `modern/*` 탭 → 4c 조수 패널(`tabs-b-assistant-panel/*`) → 4d 공간(`spatial-*`, `desktop-record-shell/*`). 각 PR 마다 R2·R3·R5 승격 | `database/` 세대 1 |
| 5. 마감 | `overrides` 항목 만기 검토, 옛 게이트 3종 삭제, R6 승격, `check-css-graph` 축소, 이 스펙의 §1 표를 "이후" 수치로 갱신 | 종료 |

## 5. 성공 기준 (이후 수치)

| 지표 | 이전 | 목표 |
|---|---|---|
| 언레이어 규칙(base 제외) | 거의 전부 | 0 |
| `!important` — event+map+shell / database | 63 / 315 | 0 / 0, `overrides` ≤ 10 |
| `.event-editor-modal-window` 를 건드리는 파일 | 9 | `event/` 안 ≤ 2 |
| `.database-modal-window` 를 건드리는 파일 | 34 | `database/` 안 ≤ 3 |
| 순서 주석 | 12 | 0 |
| CSS→TS 죽은 규칙 | 191 | 0 (게이트 유지) |
| 폴백 없는 미정의 변수 | 4 | 0 (게이트 유지) |
| 허브 깊이 | 최대 3 | 1 (진입 시트만) |
| 총 줄 수 editor+shell+database | 82,834 | 측정만 한다. 줄 수는 목표가 아니다 |
| 픽셀·계산 스타일 기준선 | — | 전 단계 동일(§3.5 예외 4건 제외) |

## 6. 위험과 대응

- **`!important` 역전.** 레이어 안에서는 낮은 레이어의 `!important` 가 높은 레이어의 `!important` 를 이긴다. 1단계에서 레이어를 씌우면 현재 `!important` 승자가 바뀔 수 있다. → 1단계 전에 평탄화 인덱스로 `!important` 쌍을 전수 열거하고, 표면 간 쌍은 미리 `overrides` 로 옮긴다. 기준선이 잡는다.
- **지연 로드 표면의 FOUC.** `event`·`database` CSS 가 청크와 함께 늦게 오면 첫 프레임이 깨질 수 있다. DB 는 이미 청크(`dist/assets/databaseModal-*.css`)라 현재 동작이 기준이다. `event` 는 `modal.ts` 가 정적 import 되므로 메인 번들에 남는다. 문제가 생기면 `<link rel=preload>` 로 대응.
- **동적 접두어 오탐.** R5 가 `\`ev-${kind}\`` 같은 동적 클래스를 죽음으로 볼 수 있다. → 접두어 단위 생존 판정 + 레지스트리 allowlist. 판정 불가는 실패가 아니라 경고.
- **기준선 픽스처 불안정.** 스크린샷이 폰트·GPU 로 흔들리면 게이트가 소음이 된다. → Chromium 단일, `deviceScaleFactor: 1`, 폰트 로드 대기, 임계값 0.1%. 소음이 계속되면 계산 스타일 기준선만 머지 조건으로 두고 픽셀은 증거로 격하.
- **main 이동.** 단계 PR 이 오래 열려 있으면 충돌한다. → 표면 단위로 잘라 PR 당 1–2일. 리프 시트를 안 건드리는 1단계를 먼저 머지해 이후 충돌 면적을 줄인다.
- **워크트리 제약.** 워크트리엔 `node_modules` 심링크와 `.env.local` 이 필요하고 vitest 는 OOM 이 난다(메모리 참고). → 기준선 갱신은 본 체크아웃에서, 병합은 `gh pr` 로.

## 7. 열어 둔 결정

- `map` 과 `shell` 을 합칠지. 좌측 레일(셸)과 팔레트(맵)가 같은 DOM 트리를 공유해 R2 위반이 많이 나올 수 있다. 3단계 시작 시 레지스트리 초안으로 위반 수를 재고 결정한다. 합치면 레이어 이름은 `shell`.
- `runtime` 을 `index.css` 에 남길지 플레이어 진입으로 옮길지. 이 스펙 범위 밖. 레이어 이름만 예약한다.
