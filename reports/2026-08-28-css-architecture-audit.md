# rpg-zzu CSS 아키텍처 — 정리 보고서

> 감사 7종 + 반대검증(adversarial verify) 7종 종합. 검증자가 **REFUTED** 판정한 항목은 삭제했고, **OVERSTATED** 항목은 검증자가 정정한 수치·심각도로 낮췄다. 검증자가 추가로 발견한 항목은 1급 findings 로 편입했다. 이 문서의 모든 숫자는 검증자가 재현한 값이다.

---

## 1. 한 줄 진단

> **문법은 깨끗하다(251개 중 1개 파일만 파스 에러). 죽은 파일도 없다(247개 중 246개 live). 문제는 "누가 이기는지"를 결정하는 권위가 없어서, `@import` 물리적 위치가 사실상 유일한 스펙이 된 것이다. 그리고 그 스펙을 검증하는 기계가 하나도 없다.**

| 항목 | 검증된 수치 | 비고 |
|---|---|---|
| CSS 파일 / 라인 | src/styles **247개**, index.css 도달 그래프 **243개 / 74,601줄 / 2,016,925 B** | 브리핑의 249는 repo-wide 251 기준 |
| 도달 불가 파일 | **1개** (102줄) | "죽은 CSS 청소" 프로젝트는 할 게 없다 |
| `!important` | **1,051개** (주석 내 6개 제외 시 ~1,031 선언) | 상위 5개 파일이 **769개 = 73.2%** |
| 그중 **입증된 무용지물** | **332개** (`_vxace.css` 266 + `_mv.css` 66) | 상대편(`battle/` 21개 슬라이스)의 `!important` = **0** |
| `@layer` 채택 | 선언 10개 중 **6개가 멤버 0**, 파일 247개 중 **11개만** 레이어 사용 | `overrides` 레이어도 비어 있음 |
| `@import` 매니페스트 | **25개 파일 / 259개 @import**, 중첩 깊이 3 | "재배열 금지" 주석 **40개 이상** |
| 이중 import | **5개 파일 / 1,276줄** | Vite dedup 이 첫 위치를 채택 → 선언된 순서 계약이 거짓 |
| 중복 선언 블록 | **1,515개 / 10,644개 = 14.2%** (무조건부 674, 파일간 592) | |
| 정의 안 된 custom property | **72개**, 그중 fallback 없음 **37개 / 111곳** | `!important` 와 결합해 파괴적인 곳 **13곳** |
| 전역 `:root` 를 여는 파일 | **11개 / 225개 프로퍼티** | tokens.css 는 그중 90개만 소유 (**60% 가 밖에 있음**) |
| hex 리터럴 | **1,914회 / 577개 distinct** (146개 파일) | `#4a57d6` 276회 중 **253회는 tokens.css 와 값이 일치하는 fallback** |
| 출하 번들 | main.css **1,506,773 B / gzip 216,777** (10,367 rule) | 같은 경로의 main.js 는 **5,936 kB / gzip 1,281 kB** (5.9배) |
| CSS 린트/게이트 | **0개** (stylelint·postcss·lint 스크립트 전무) | |

---

## 2. 근본 원인 — 왜 이렇게 됐는가

네 가지다. 나머지 findings 는 전부 이 넷의 파생이다.

### RC-1. 캐스케이드 권위가 없어서 "물리적 위치"가 스펙이 됐다

`src/styles/index.css:2` 는 10개 레이어를 선언하지만 **6개는 멤버가 0개**이고, `overrides` 도 비어 있다. 247개 중 **11개 파일만** 레이어 블록을 연다. CSS 명세상 unlayered 가 layered 를 무조건 이기므로, 레이어를 쓰는 11개 파일이 **가장 약한 위치**에 있다. 레포는 이걸 이미 알고 있고, 고치는 대신 금지 조항으로 문서화했다 — `src/styles/runtime/battle-skins/index.css:4-5`: *"battle.css 는 unlayered — do NOT wrap these partials in `@layer`, or every override would lose."*

그 결과 순서가 유일한 권위가 됐고, 순서 계약은 주석으로만 존재한다:
- `src/styles/index.css:77-78` — *"마지막 @import — … database/tabs-b.css 경유로 먼저 들어온 옛 규칙을 !important 없이 이긴다"* (거리 66줄)
- `src/styles/database/studio-theme.css:4` — *"Imported after system-studio.css so it wins"* (469줄 파일의 계약 전체가 "나는 51번 줄이다")
- `src/styles/runtime/battle-skins/index.css:24-25` — *"_windowskin.css 는 맨 마지막 … 순서가 곧 권위다"*
- `src/styles/editor/ai-auth-connection.css:3-4` — **가장 결정적인 증거**: *"별도 파일인 이유: 기존 인증 CSS 는 assistant-command-bar.css 에 있는데 그 파일은 다른 작업이 동시에 고치는 중이다. 새 규칙을 그 파일에 넣으면 충돌한다."*

순서를 결정하는 메커니즘이 **4개**다: index.css @import, 하위 배럴 @import, playerRuntime.css @import(이미 Vite dedup 로 깨져 있음), TS `import "*.css"` 의 JS 모듈 로드 순서.

### RC-2. CSS에만 기계 피드백이 없다 — 그리고 레포가 이미 그 대조 실험을 끝냈다

`src/styles/TOKENS.md` 는 두 개의 동일한 형식·동일한 대상·동일한 시기의 규칙을 갖는다.

| 규칙 | 가드 | 결과 |
|---|---|---|
| §4.7 `font-family` 는 역할 토큰만 | **있음** — `test/fontFamilyTokenGuard.test.ts` 가 src 하위 모든 .css 순회 | 247개 파일 위반 **0건** (34 tests pass) |
| §4.1 하드코딩 hex/rgba 금지 | **없음** | TOKENS.md 생성 시점(7e5f7ba6, 2026-07-06) **600개** → 현재 **1,940개**, 8주 만에 **3.2배** |

같은 문서, 같은 에이전트, 같은 기간. 변수는 "테스트가 있는가" 하나뿐이다. **이 보고서의 모든 개선안은 이 한 표에서 정당화된다.**

부수적으로: `npm run build` 는 **매 실행마다** `▲ [WARNING] Comments in CSS use "/* ... */" instead of "//"` 를 7회, 그리고 `Expected ")" to go with "(" … <stdin>:7:12` 를 출력한다. CI 의 build job 이 이걸 매 push 마다 찍고 있는데 아무도 grep 하지 않는다. 그리고 `scripts/verify-gates.mjs` 가 읽는 `.omo/gates-baseline.json` 은 **`.gitignore:6` 으로 무시되고 한 번도 추적된 적이 없다** — AGENTS.md:74 가 요구하는 "에이전트마다 새 워크트리" 환경에서는 baseline 이 항상 없으므로, 명령된 게이트가 명령된 워크플로에서 항상 열화된다.

### RC-3. 격리 워크트리 + 파일 단위 소유권 → "새 파일 만들기"가 유일한 무충돌 수단

AGENTS.md:70-78 이 병렬 에이전트마다 격리 워크트리를 강제한다(정당한 이유가 있다). 결과: **파일 추가 260 / 수정 1,232 / 삭제 9 / 리네임 3.** 추가한 260개 중 삭제된 건 9개(3.5%)이고 그중 3개는 단일 Revert 커밋 — 61일간 의도적 정리는 **약 6건**.

*(브리핑 정정: 이건 파일 내부의 append-only 가 아니다. 수정 커밋의 hunk 중 **87.6% 가 replace** 다. 에이전트는 기존 선언을 상시 고친다. 병리는 "파일을 만들고 절대 은퇴시키지 않는 것"이다. → "append 하지 말고 edit 해라"로 처방하면 아무것도 안 바뀐다.)*

전형: `database/tabs-b-assistant-panel/` — 2026-08-03 기계분할 12개 → 13일 만에 전면 override 레이어 5개 추가(13-assistant-modern 397줄, 14-assistant-ux-repair 106, 15-assistant-readable 96, 16-modern-change-first 604, 17-assistant-modern-shell 242). 배럴 주석이 각 층을 "앞 레이어를 이긴다"고 명시한다(`tabs-b-assistant-panel.css:29, :32, :34`).

2026-08-27 하루에만 CSS 추가 커밋 10건, 그중 3건이 `07-` 접두사를, 2건이 `15-` 를 충돌시켰다.

### RC-4. 하나의 노드 위에 병렬 토큰 네임스페이스가 공존한다

`.database-modal-backdrop` 위에 `--db-light-*`(크림) 과 `--db-studio-*`(쿨 그레이) 두 시스템이 동시에 산다. 이름이 겹치지 않아 서로를 덮지 않고, 어떤 규칙이 어느 쪽으로 렌더되는지는 **작성자가 그때 타이핑한 변수 이름**으로 결정된다. `src/styles/database/sidebar.css:24` 의 `var(--db-studio-surface, var(--db-light-bg-surface, #FFFFFF))` 3중 체인이 "어느 쪽이 소유자인지 알 수 없었다"는 저자의 자백이다.

전역에서는 더 심하다. **11개 파일이 전역 `:root` 를 열어 225개 프로퍼티를 정의**하고, tokens.css 는 그중 90개만 소유한다(**60%가 밖에 있음**). 이게 `--gold` 충돌과 early-binding 누수의 구조적 원인이다.

---

## 3. 문제점 — 심각도순

### 🔴 P0 — 지금 실제로 깨져 있고, 고치는 데 시간이 거의 안 든다

#### P0-1. `benchmark.html` 은 스타일시트가 **한 번도 적용된 적이 없다**

`src/benchmark/ui/styles.css:1-10` 이 CSS 가 아닌 JS `//` 주석을 쓴다. 결정타는 7번째 줄 `// 컨벤션(src/styles/components/*.css 참조):` 의 **닫히지 않은 `(`** — CSS 토크나이저가 나머지 236줄을 하나의 잘못된 prelude 로 삼켜버린다. css-tree(명세 준수 파서)로 소스를 파싱하면 **rule 0개**, `"{" is expected @line243`.

브라우저 실증(headless Chrome, 실제 vite 6.4.3 prod 빌드):
- `document.styleSheets[0].cssRules.length === 0`
- 출하된 `assets/benchmark-*.css` 에 `--bm-*` 정의 **27개 중 0개**, `var(--bm-*)` 참조는 **45개 그대로**
- `.bm-header` display = `block` (소스는 `grid`), `.bm-card` border-top-width = `0px`, body background = `rgba(0,0,0,0)`

*(감사자의 "npm run build 가 실패한다"는 프레이밍은 틀렸다 — package-lock 이 vite 6.4.3 을 고정하고 CI 는 `npm ci` 를 쓰므로 빌드는 26.24s 에 exit 0 이다. 실제 피해는 빌드 차단이 아니라 "출하된 페이지가 무스타일"이다.)*

> **해법**: 1–10줄을 `/* */` 로 교체. 10줄 수정. + CI 의 build job 에 `grep -q 'WARNING'` 게이트 추가(적발률 1/1 로 이미 입증됨).

#### P0-2. `.picture-layer-item` 클래스 충돌 — 런타임 픽처 컨테이너에 흰 배경 + 파란 테두리가 붙는다

| 위치 | 선언 | 레이어 |
|---|---|---|
| `src/styles/runtime/pictures.css:4` | `position: absolute; transform-origin: top left; will-change:…` | `@layer runtime` |
| `src/styles/database/tabs-b-status-menu-main.css:420` | `background: rgba(248,251,255,0.96); border: 1px solid #2e6f9e; color:#08111f; font-size:14px; font-weight:700; padding:4px 6px` | **unlayered** |

컨테이너는 `src/player/runtimeDom.ts:292` 가 `container.className = "picture-layer-item"` 로 만든다. 두 파일은 같은 document 안에 있고(`playerRuntime.css` 8·15번 줄), **unlayered 가 layered 를 이기므로 pictures.css 는 어떤 특정도로도 되찾을 수 없다** — `!important` 없이는 불가능.

> 레포 전체에서 `@layer` 역전이 **이론이 아니라 실제 동작 차이를 만드는 유일한 지점**이다. (다른 2건은 world-panel `h3 { margin }`, storyboard `.event-inspector-density-toggle { justify-self }` — 시각적으로 무해)

> **해법**: `tabs-b-status-menu-main.css:420` 의 클래스를 `.status-menu-picture-chip` 등으로 개명(그 쪽이 상태 메뉴 전용 라벨 칩이므로 이름이 애초에 틀렸다). 1줄 CSS + 해당 TS 방출부.

#### P0-3. 무범위 `button.btn` 이 두 번 선언돼, 앱 전체 버튼 룩을 import 순서가 결정한다

| 파일 | 선언 | index.css 진입 |
|---|---|---|
| `src/styles/editor/core.part-1.css:97` | `background: var(--control-bg); border: 1px solid var(--border); padding: 5px 12px; border-radius: var(--radius); font-size: 13px` | `:6` |
| `src/styles/database/tabs-b-shell-layout.css:227` | `background: var(--surface-panel); border: 1px solid var(--border-default); border-radius: 2px; box-shadow: none; padding: 4px 8px` | `:13` (tabs-b.css:5 경유) |

둘 다 (0,1,1). 나중 것이 이겨서 **에디터의 모든 버튼이 2px radius / 4px 8px** 이고, core.part-1 의 버튼 블록은 `:focus-visible`·`.danger`·`:disabled` 를 제외하면 전부 죽었다. 파일 이름이 "database tabs-b shell layout" 인데 앱 전역 버튼을 정의한다.

*(감사자의 "버튼 컴포넌트가 아예 없다"는 **REFUTED**. `button.btn` 은 존재한다 — 감사자의 정규식이 `button.btn` 을 구조적으로 매칭할 수 없었다. 실제 문제는 부재가 아니라 중복이고, 고치는 비용은 훨씬 싸다.)*

#### P0-4. `--gold` 가 `--accent` 와 같은 색이 돼서 "골드/오렌지" 강조가 전부 파란색이다

```
tokens.css:124                --gold: #4A57D6;
editor/core.part-1.css:20     --gold: var(--warning);      → #8A5E00 (죽음)
database/tabs-b-shell-layout.css:16  --gold: #4A57D6;      ← 최종 승자
database/light-theme.css:118  --gold: #9a6b00;             (모달 스코프)
```
출하 번들 `dist/assets/main-*.css` 에서 확인: byte 2395 `--gold:#4A57D6`, byte 5313 `--gold:var(--warning)`, byte 131701 `--gold:#4A57D6` — 마지막 전역 승자는 `#4A57D6` 로 `--accent`(tokens.css:53) 와 바이트 동일. **17개 파일 55곳의 `var(--gold)` 가 전부 accent blue 로 렌더**되고, 여기엔 `src/styles/editor/event-editor.css` 의 `--oprn-command-orange: var(--gold);` — 이름이 "orange" 인데 파란색인 토큰 — 이 포함된다. 그리고 같은 토큰이 DB 모달 안에서만 amber(#9a6b00)다.

부수: `core.part-1.css:3` 과 `tabs-b-shell-layout.css:1` 의 `:root` 별칭 블록 **22개 중 21개가 바이트 동일**한 복붙이고, 유일하게 갈라진 것이 `--gold` 다.

#### P0-5. 타일셋 통과설정 다이얼로그가 자기를 띄운 DB 모달 **뒤에** 그려진다

`src/editor/panels/tilesetPassageModal.ts:22` 가 `.tileset-modal-backdrop` 루트를 `document.body` 에 붙인다. 유효 z-index 는 `var(--z-popover)` = **90** (`database/tilesets.css:10-12` 가 `tabs-a.part-2.css:212` 의 40을 덮음). 이 다이얼로그는 DB 모달 안에서만 열리는데(`database.ts:589 → tilesetSettingsPanel → openTilesetSettingsModal`), DB 모달의 `.database-modal-backdrop` 은 `position: fixed; z-index: 900` (`tabs-a.part-1.css:297-305`) 이고 역시 body 직속이다. **같은 스택 컨텍스트의 형제, 90 < 900.**

이게 backdrop primitive 를 23번 손으로 구현한(21개 파일, 스크림 값 ~14종, z-index 40·45·55·80·90·280·290·900·1000·1100·1300·2400 + 토큰 5종) 결과의 구체적 실례다.

#### P0-6. `system-studio.css` 의 13개 선언이 **정의되지 않은 변수 + `!important`** 로 배경을 지워버린다

`background: var(--studio-surface-3) !important` 같은 형태. `--studio-surface-3` 는 레포 어디에도 정의가 없으므로 계산값 무효 → `transparent` 로 리셋되고, `!important` 때문에 **뒤에 오는 어떤 규칙으로도 복구 불가**.

- 파괴적 사이트 13곳: `system-studio.css:153, 168, 290, 296, 395, 550, 595, 616, 622, 628, 647, 655` + `shell/editor-ui-modes.css:597`
- 전부 `@media (min-width: 1100px)` 안 → **데스크톱 정상 폭에서만** 발현
- 파일이 정의하는 `--studio-*` 12개와 소비하는 12개가 **6개만 겹친다**. 유령 6개(`--studio-violet`, `-violet-soft`, `-surface-2`, `-surface-3`, `-mint`, `-amber`) = 27회 사용, 정의 0. 죽은 정의 6개(`--studio-bg`, `-inset`, `-well`, `-accent`, `-accent-soft`, `-accent-border`) = 사용 0.
- 상태색이 통째로 사라짐: `:229-230` `em.is-ok { color: var(--studio-mint) }` / `em.is-warn { color: var(--studio-amber) }` 둘 다 `inherit` 로 렌더. `:175-176` 은 `background: var(--studio-violet-soft)`(무효) 옆에 `border: 1px solid rgba(124,108,242,0.22)` 로 바이올렛을 하드코딩해 놓았다.

#### P0-7. 고아 파일 `07-identifiable-previews.css` — 스쿼시 머지가 배럴 등록을 지웠고, 시각 버그가 실제로 출하 중이다

- `cf91ee76` 이 파일 + `@import` 를 **정상적으로 함께** 추가했다.
- `a691a831`(PR #98, 같은 날 05:16) 의 스쿼시 머지가 배럴의 그 한 줄만 **조용히 되돌렸다** — 파일은 남고 등록만 사라짐. *(감사자의 "배럴에 추가된 적 없다"는 오진. 실제는 더 나쁘다: 프로세스가 "새 파일을 import 안 하는" 게 아니라 "이미 import 된 파일을 un-import" 한다.)*
- 실증된 시각 버그: `src/editor/panels/eventEditor/facesetPreview.ts:169-179` 가 `.event-command-face-crop faceset-crop-box` 안에 `<img class="faceset-crop-sheet">` 를 방출한다. `.faceset-crop-box`/`.faceset-crop-sheet` 를 스타일하는 파일은 **이 고아 파일뿐**. 살아있는 규칙(`event-editor.modern/05-…:88`)은 96px 로 클립하는데, 고아 파일의 `background-image: none` 리셋(:14)과 `<img>` absolute-fill 블록(:19-27)이 죽어 있고 전역 `img { max-width }` 도 없다 → **4×4 페이스셋 시트가 96px 클립 위에 원본 크기로 그려진다.**
- `test/quickAuthoringPreviewIdentity.test.ts` 는 5개 중 **2개가 현재 브랜치에서 FAIL** (`:33`, `:77`). 아무도 못 잡았다.
- 레포 전체 도달 불가 파일은 **이 1개뿐**이다(나머지 3개는 TS 에서 의도적으로 import). 사고이지 패턴이 아니다.

---

### 🟠 P1 — 구조적, 반경 크고, 자동화 가능

#### P1-1. `!important` 332개는 "군비경쟁"이 아니라 **철수한 적을 향해 계속 쏘고 있는 것**

`_vxace.css:27-28` 이 자기 266개를 이렇게 정당화한다: *"battle.css 의 Compact HUD layer 가 `.battle-party` 등을 !important 로 강제하므로 여기서도 !important 를 쓴다."*

**그 전제는 오늘 거짓이다.** `rg -o '!important' src/styles/runtime/battle/` → **0**. `battle.css` → **0**. 21개 슬라이스 전부 0. 이유는 커밋 로그에 있다 — `3a19d5f2` *"refactor(battle): remove 515 !important from runtime battle CSS"*. 한쪽이 무장해제했는데, `_vxace.css`(266) + `_mv.css`(66) = **332개와 그것을 정당화하는 거짓 주석 2개가 그대로 남았다.** `_mv.css:145` 는 이중으로 틀렸다 — "Compact HUD is declared after skin imports" 라는데 `playerRuntime.css:3` 이 battle.css 를 `:4` 의 battle-skins 보다 먼저 import 한다.

`_vxace.css:59-63` 은 `(0,2,1)` 선택자로 `(0,1,0)` 선택자를 상대로 `!important` 를 쓴다 — 특정도로도 소스 순서로도 이미 이기고 있는 상대다.

> **단, 전면 무장해제는 틀렸다.** `_windowskin.css:34-41` 의 8개는 `(0,2,0)` 이 `_vxace.css:230` 의 `(0,3,0)` 을 이겨야 하는 구조라 **load-bearing** 이고, `_windowskin.css:29-31` 이 그 이유를 정확히 문서화해 놓았다. 그 8개는 남긴다.

> **해법**: `_vxace.css`/`_mv.css` 의 332개를 삭제하고 e2e 스크린샷으로 검증. 삭제만으로 검증 가능한(mechanically verifiable by deletion) 유일한 `!important` 덩어리다. 거짓 주석 2개도 같이 제거.

#### P1-2. `system-studio.css` 의 레이아웃 계약 전체가 **죽은 `!important`** 이고, 파일 헤더는 출하되지 않는 것을 설명한다

`sidebar.css` 가 `system-studio.css` 를 선택자 단위로 한 단계 높은 특정도에서 전부 그림자 처리한다: window(sidebar:69 vs studio:21), header(:78 vs :30), body(:85 vs :43), db-tabs(:94 vs :56), db-tab(:99 vs :72), footer(:198 vs :1315).

입증된 죽은 선언: `:45 display:grid !important`, `:46 grid-template-columns: 56px …`, `:52` 의 `@media (min-width:1100px)` 트랙 전체, `:33 min-height:48px`, `:34 padding:0 14px`. 그리고 소스 순서 동점패로: `:22-26`(studio-theme.css:108-112 와 **바이트 동일한 복붙**), `:31`, `:38-39`(`font: 600 13px` 가 studio-theme.css:126 의 `600 14px` 에 짐).

**System 탭 헤더는 실제로 14px / 44px 로 렌더된다 — 이 파일이 `!important` 로 선언한 13px / 48px 이 아니라.** 243개 중 약 20개가 입증 가능하게 무력하다.

*(감사자의 "grid vs flex 레이아웃 모델 충돌" 은 **REFUTED** — `sidebar.css:85-92` 가 `(0,4,0)` + `!important` 로 body 를 항상 flex 로 고정한다. 두 `!important` 사이에서는 특정도가 결정하므로 sidebar 가 항상 이긴다. 탭마다 레이아웃 모델이 바뀌지 않는다. 살아남는 1건은 `system-studio.css:58 border-right: --db-studio-border-subtle !important` 가 `sidebar.css:25` 의 `--db-studio-border-default` 를 이기는 **1개 프로퍼티 역전**뿐.)*

#### P1-3. 문서화된 1100px 브레이크포인트는 **존재하지 않는다**. 실제는 800/799px 이고 두 파일 헤더가 모두 틀린 숫자를 적고 있다

- `system-studio.css:4` — *"DB outer rail is 220px labeled at >=1100px, 56px icon below"*
- `sidebar.css:4` — 같은 문장 반복

유일한 1100px 구현은 `system-studio.css:50-53` 이고 P1-2 에서 죽었다. **실제 구현은 전부 sidebar.css 의 800/799px** (`:94-96` 무조건 220px, `:184-189`/`:191-196` 에서 56px 로 접힘). 1100px 에서 테스트하는 사람은 아무 일도 안 일어나는 걸 보고 "반응형 레일이 고장났다"고 결론낸다.

추가: `sidebar.css` 는 **7쌍의 반응형 규칙을 `@container` 와 `@media` 로 이중 작성**한다(`:111/:122, :134/:159, :184/:191, :209/:219, :271/:277, :336/:356, :467/:491`). 데스크톱에선 양쪽이 동시에 발화하므로 한쪽만 고치면 조용히 무효다. `sidebar.css:120-121` 이 과거 사고를 자백한다: *"예전에는 이 쪽만 글리프를 죽이고 있어서 컨테이너 쿼리를 고쳐도 데스크톱 아이콘이 살아나지 않았다."* 두 분기가 일치하는지 검사하는 테스트는 없다.

#### P1-4. 순서 의존성 — "재배열 금지" 주석 40개 이상이 유일한 집행 수단

- **25개 파일 / 259개 `@import`**, 중첩 깊이 3. index.css 73, playerRuntime.css 22, battle.css 22, tabs-b-assistant-panel.css 22, battle-skins/index.css 16, event-editor.css 15, figma-editor.css 12, desktop-record-shell.css 12 …
- 명시적 순서 계약 주석 **40개 이상**(감사자는 8개만 인용).
- **이중 import 5개 파일 / 1,276줄**: `runtime/system.css`, `runtime/playSurface.css`, `database/tabs-b-title-screen.css`, `-status-menu-base.css`, `-status-menu-main.css`. Vite(postcss-import, skipDuplicates)가 **첫 위치**를 채택하므로 `playerRuntime.css:1` 의 *"Authoritative … Keep imports in cascade order"* 는 4개 항목에서 **거짓**이다. 빌드 산출물로 확인: `.play-viewport{` 가 byte 13,515, dialogue.css 의 토큰이 byte 535,036 — playSurface 가 dialogue 보다 **521 KB 앞에** 나온다.
  - **단, 오늘 렌더링 차이는 0이다.** 해당 파일 쌍들의 충돌 selector+property 는 0개이거나(playSurface↔dialogue) `!important` 로 순서 무관하다(title.css↔tabs-b-title-screen 의 4건). **잠재 함정이지 현행 결함이 아니다.**
- **`event-editor.css:1` 이 "Split wrapper: preserves cascade order" 라고 써놓고 `:2-5` 에서 part-1, part-2, part-**4**, part-**3** 순으로 import 한다.** 레포의 다른 모든 매니페스트는 오름차순이다. 정렬하는 순간 캐스케이드가 바뀐다.
- **네 번째 메커니즘**: `src/editor/panels/databaseAnimationRecordView.ts:20-21`, `actorRecordCurveEditors.ts:9`, `databaseUtilityRecordViews.ts:30` 이 총 **1,453줄**을 TS 에서 import 한다. 프로덕션에선 `dist/assets/worldPanel-*.css`(38,566 B / 183 rules) 라는 **별도 lazy 청크**로 나가고, `dist/index.html` 은 이걸 링크하지 않는다 → 첫 페인트에 부재하며, 로드되는 순간 main.css 의 모든 것을 무조건 이긴다. (오늘 실제 충돌은 0 — 165개 선택자 중 main.css 와 겹치는 게 없다. 네임스페이싱이 잘 돼 있다.)

#### P1-5. 이름이 내용을 예측하지 못한다 + 접두사 4종

- `src/styles/editor/palette-player.css`(661줄)의 상위 접두사: event-editor(15), cmd-item(13), cmd-summary(11), toast(10), event-subdialog(10) — palette 도 player 도 아니다. `.event-editor-modal-body` 가 여기 `:60` 에 있다.
- `src/styles/editor/core.part-2.css`(728줄)가 `.battle-party`(:12), `.battle-command-panel`(:48) 을 소유한다 — 같은 클래스가 `runtime/battle/` 슬라이스 4~5개에도 있다. `review.md:258` 이 런타임 전투 UI 로 `flex-wrap:wrap` 이 새는 원인으로 지목한 파일이다.
- `.topbar` 가 **4곳**에서 무범위로 선언된다(감사자는 3곳으로 셌음): `core.part-1.css:71`, `tabs-b-shell-layout.css:28`, `responsive-a.css:91`, `figma-editor/01-shell-topbar-team.css:25`. 전부 `(0,1,0)`, 레이어·미디어 없음. 결과는 "한 파일이 이긴다"가 아니라 **4파일 프랑켄슈타인**: `display` 는 figma-editor/01 에서(block, core 의 flex 를 이김), `align-items:center`·`flex-shrink:0` 는 core.part-1 에서 살아남아 이제 무의미하고, `flex-direction:column` 은 tabs-b-shell-layout 에서, 배경은 figma-editor/01 에서 온다. 세 토큰 패밀리(`--bg-panel`/`--surface-app`/`--editor-shell-bg`)가 전부 평가되고 마지막 것만 보인다. `.main` 도 2곳, `body` 도 4곳.
- 접두사: `database-` 24 / `db-` 655 / `oprn-` 152 / `rm-` 45 클래스, 총 **7,107 rule**. 이중 접두사 방출 **41곳**, 하이브리드 `.oprn-db-fieldset` **18곳**.
  - **중요한 맥락**: `oprn-` 은 포기한 마이그레이션이 아니라 **테스트로 강제된 de-branding 의 산물**이다(`test/detsukuruBrandStrings.test.ts:49-56` 이 `rm2k3-`, `rpg-maker-` 등을 하드페일). 그리고 `.oprn-*` 를 담은 1,112개 rule group 중 **340개(31%)가 같은 콤마 그룹 안에 `.db-*` 도 나열**한다 — 선언된 동의어이므로 캐스케이드 경쟁이 아니다. 중복이지 레이스가 아니다.
  - 부수 결함: 위 브랜드 가드의 패턴 `/rm-tool-icon-/` 이 **실제 클래스 `rm-tool-icon` 보다 하이픈 하나 길다**. `rm-` 접두사 45개 클래스가 자신들을 잡으라고 만든 그물을 전부 통과한다.

#### P1-6. 죽었지만 여전히 관리되고 있는 CSS 클래스 464개 / 920 rule

*(감사자 527/1,172 → 검증자 정정. 감사자가 `test/` 를 grep 범위에서 뺐고, 상위 3개 예시 중 2개가 그 때문에 오탐이었다.)*

확실히 죽은 팔레트 패밀리(TS 0회 / CSS n회): `palette-option-button` 0/7, `stamp-button` 0/12, `chipset-band-button` 0/12, `palette-view-button` 0/4, `structure-stamp-panel` 0/14, `brush-size-btn` 0/16. 그리고 **지금도 새 규칙이 추가되고 있다** — `shell/figma-editor/08-rm-palette-tools.css:352`, `03-layout-left-palette.css:212-217`.

파일 단위 통삭제가 불가능한 이유(dead/total 클래스 비): tile-palette-clusters.css 20/33, storyboard.css 19/44, shell-density.part-1.css 32/102, 08-rm-palette-tools.css 16/42, event-editor.mockup.css 23/139, event-editor.commerce.css 28/180. 산 것과 죽은 것이 섞여 있다.

반대 방향으로는 **TS 가 방출하지만 스타일이 없는 클래스 322개**(3,914 중). 실제 버그: `.confirming`(21곳, 파괴적 삭제 확인 상태에 시각 피드백 0), `.btn-sm`(7곳)·`.btn-mini`(8곳)이 CSS 0 → 크기 modifier 가 조용히 무시됨.
*(단, 감사자가 든 두 예시는 오탐: `.quick-battle-modal-overlay` 는 `quickBattleModal.ts:36-46` 에서 인라인 `cssText` 로 스타일됨, `.grid-active` 는 `nameEntryOverlay.ts:180` 이 읽는 JS 상태 플래그. 322개 중 18개가 이런 쿼리/상태 핸들이다.)*

---

### 🟡 P2 — 크고 신중해야 하는 것

#### P2-1. event-editor: 하나의 모달에 **56개 파일 / 20,135줄** (전체 CSS 의 26.5%), 세대 4종이 동시 live

`.event-editor-modal-body` 가 5개 파일에서 bare 로 + 2개에서 @media 안에서 선언되고, **`padding` 하나에 서로 다른 값 5개**(`var(--space-3)` / `20px 25px 8px` / `9px 10px 6px` / `0` / `0`)가 들어간다. `balanced.css` 가 index.css:76 으로 마지막이라 `padding:0` 이 이기고 나머지는 전부 죽었다.

`.event-editor-modal-window` 는 상호 배타적 기하를 3벌 갖는다:
```
part-1.css:575   width: min(1476px, calc(100vw - 12px)); grid-template-rows: 31px minmax(0,1fr) 40px
modern/01:25     width: min(1080px, calc(100vw - 80px)); grid-template-rows: 52px minmax(0,1fr) 44px
balanced.css:6   width: 100vw; height: 100dvh; border: 0; inset: 0        ← 이게 이김(풀스크린)
```
event-editor 계열 내부에서 **951개 selector+property 쌍이 중복 → 1,157개 선언이 도착 즉시 사망**. 레포 자체 문서가 3주 전에 정확히 진단했다 — `docs/2026-08-07-event-editor-shell-hostile-review.html:431`. 아무것도 줄지 않았다.

#### P2-2. 번호 슬라이스 디렉터리 94개 / 25,375줄 (전체의 33%) — 컴포넌트가 아니라 리뷰 회차 기록

`runtime/battle/` 만 21개, 그중 **6개가 같은 스킨을 연속으로 다시 쓴다**: `14-pokemon-skin-layout`(52 selector) → `16-pokemon-battlers-hud`(35) → `18-pokemon-layout-redesign`(37) → `19-adversarial-review-3`(29) → `20-pokemon-reference-restyle`(42) → `21-gen1-hud-type-badge`(7). `.battle-scene[data-battle-ui-style="pokemon"] .battle-enemy-list-row` 는 5개 파일 7개 블록, `.battle-command` 는 5개 파일 6개 블록.

`runtime/battle/` 의 슬라이스간 선택자 재선언율은 **24%(497개 중 118개, 3개 이상 파일에 54개)** — 나머지 6개 슬라이스 디렉터리는 1~12% 로 **정직한 기계 분할**이다. **battle 만 문제이고 나머지는 건드리면 안 된다.**

부수 구조 결함: `src/player/battleDom.ts:86` 이 `dataset.battleUiStyle`(2값), `:91` 이 `dataset.battleSkin`(12값)을 **같은 `system.battleUiStyle` 필드에서** 세팅한다. pokemon 설정에선 두 속성이 같은 엘리먼트에 붙어 `runtime/battle/`(21 슬라이스)과 `runtime/battle-skins/_pokemon.css` 두 규칙 패밀리가 동시에 발화한다. 경계를 지키는 건 `_vxace.css:28` 의 주석 하나뿐이다.

#### P2-3. 공유 프리미티브 부재 — 백드롭 23개, 폼 베이스 90개, 패널 크롬 613 트리플

| 프리미티브 | 손수 구현 횟수 | 값 분산 |
|---|---|---|
| 모달 백드롭 | 23 rule / 21 파일 | 스크림 ~14종(0.08 ~ 0.5), z-index 12개 정수 + 토큰 5종 |
| input/select/textarea 베이스 | 90 rule / 58 파일 | `border` **31종**, 토큰 방언 7종 |
| 패널 크롬(bg+border+radius) | 1,023 rule / 182 파일 | 고유 트리플 **613개** (재사용률 40%) |
| border-radius | 1,402 선언 / 72 값 | 토큰화 **16.5%** |
| box-shadow | 550 선언 / 292 값 | 토큰화 **19.6%** |
| `:focus-visible` | 187 rule / 89 파일 | outline 값 26종 |

`src/styles/components/` 는 4개 파일 635줄(전체의 0.83%)이고 그중 `icons.css` 459줄은 아이콘 스프라이트다. 실질 프리미티브는 **176줄(0.23%)**. `grid-4.css`(27줄)는 소비자 0.

*(중요: 이걸 **번들 크기**로 팔면 안 된다. 완전 중복 블록은 출하 번들 1,506,773 B 중 **5,040 B = 0.3%** 다. 비용은 바이트가 아니라 "일괄 수정 불가능"이다.)*

#### P2-4. 토큰 정리

| 항목 | 수치 | 성격 |
|---|---|---|
| tokens.css 와 값이 다른 stale fallback | 993쌍 중 **461개** (`var(--text-2,#5c5348)` 113회 등) | **문서 부패**, 렌더링 무해(토큰이 `:root` 에 무조건 정의되므로 fallback 분기 도달 불가) → 코드모드로 전량 삭제 안전 |
| 정의 안 된 프로퍼티 | **72개** / fallback 없음 37개 / 111곳 | P0-6 의 13곳 외 `--oprn-light/-mid/-shadow` 계열 ~33 선언(전부 `!important` 없음 → 복구 가능) |
| 정의됐지만 미사용 | **58개** / 16개 파일 | 삭제 |
| 전역 `:root` 를 여는 파일 | **11개 / 225 프로퍼티** | tokens.css 는 90개만 → **60%가 밖** |
| early-binding 스코프 누수 | **21개 별칭** | `enemies.part-1.css:2-9`(8개), `event-editor.css:24-36`(13개). `:root` 에서 var() 가 치환되므로 DB 모달 테마가 절대 못 미친다. 실증 드리프트: `--oprn-enemy-menu-danger-ink` = 전역 `#C6403D` vs 모달의 `#DC2626`; `--oprn-enemy-menu-muted-ink` = `#626E89` vs 모달의 `#94A3B8` |
| 배틀 스킨 색 이중 소스 | **44 선언 / 11 파일 죽음** | `battleDom.ts:95-97` 이 registry.themeVars 를 인라인 `setProperty` 로 주입 → CSS 는 `!important` 가 0이라 절대 못 이김. 41개는 값도 다르다(`_bravely`: CSS 는 밝은 양피지+갈색 글씨, registry 는 거의 검정+크림 — 반전 테마) |
| 브레이크포인트 | @media **190개 / 96 파일 / 38개 숫자** | `tokens.css:95-98` 의 `--bp-sm/md/lg/xl` 은 **100% dead**(@media 는 var() 를 못 씀) |

**브레이크포인트의 진짜 결함**(감사자의 "1px 데드존"은 **REFUTED** — `max-width` 는 inclusive 라 900/901, 799/800, 1099/1100 은 올바른 쌍이다): **900px, 1024px, 1100px 가 각각 min-width 와 max-width 로 동시에 쓰인다**(min:900 ×1 vs max:900 ×19 / min:1024 ×2 vs max:1024 ×1 / min:1100 ×4 vs max:1100 ×12). 정확히 그 폭에서 두 분기가 동시에 활성이고 `@import` 순서가 결정한다. 하필 1100px 가 System Studio 패널 전체(182 rule 중 86개)가 걸린 경첩이다.

#### P2-5. 렌더 블로킹 CSS 1.5 MB

`assets/main-*.css` = **1,506,773 B / gzip 216,777 / 10,367 rule**, 출하 CSS 의 **97.3%**. 상위 6개 import 가 소스의 60.2%: event-editor.css 414,999 B(20.6%), playerRuntime.css 332,518 B(16.5%), tabs-b.css 208,488 B(10.3%), desktop-record-shell.css 131,001 B(6.5%), figma-editor.css 71,671 B(3.6%), event-editor-rich-forms.css 56,199 B(2.8%). `vite.config.ts` 에 `css` 키 자체가 없다.

**단, 균형감각**: 같은 크리티컬 경로에 `assets/main-*.js` 가 **5,936 kB raw / gzip 1,281 kB** 로 나간다. CSS 는 크리티컬 경로 gzip 바이트의 **~14%** 다. "첫 페인트가 느리다"의 주범은 CSS 가 아니다. *(그리고 감사자의 "DOM 변경마다 style recalc 이 로드된 rule 총량에 비례한다"는 틀렸다 — Blink 는 최우측 simple selector 로 버킷팅한다. 로드 시 파싱/인덱싱 비용만 실재한다.)*

playerRuntime.css 332 KB 가 에디터 크리티컬 경로에 있다(Test Play 눌러야 도달 가능). 다만 스킨은 **12종**이고(16 아님) 실제 스킨 바이트는 96,051 B, 그중 `_rm2003`(35,044)+`_vxace`(27,961)가 65% 다. 분리하려면 `testPlayModal.ts:6` 의 static import 를 먼저 끊어야 한다 — 빌드가 `INEFFECTIVE_DYNAMIC_IMPORT` 로 이미 경고하고 있다.

#### P2-6. HMR: CSS 1줄 고치면 2.07 MB 재전송, 그리고 DevTools 가 소유 파일을 못 가리킨다

`/src/styles/index.css` 응답 = **2,071,795 B 단일 모듈**. 1,424 B 짜리 leaf 를 touch 해도 동일한 2.07 MB 재전송(≈1,455배).

*(정정: 서버 비용은 작다 — cold 0.644s, warm 27~49ms. 그리고 `updateStyle` 은 기존 `<style>` 의 textContent 를 바꾸므로 스크롤 위치는 안 날아간다.)* **진짜 비용은 소스맵이다**: `css` 키가 없어 `css.devSourcemap` 이 false 이고 243개 파일이 한 모듈로 인라인되므로, **DevTools 가 모든 규칙을 `/src/styles/index.css` 로 귀속시킨다.** `!important` 1,051개와 순서 계약 40개짜리 코드베이스에서 계산된 스타일을 소유 파일로 역추적할 수 없다는 뜻이다. **한 줄 설정으로 고쳐진다.**

---

### 🔵 P3 — 위생 수준

- **13개 파일의 주석이 복구 불가능하게 깨져 있다** (cp949↔utf-8 이중 디코드, 미매핑 바이트가 `?` 가 됨). 카운트: `tabs-b-assistant-panel/03-three-tier-ia.css` 122, `08-studio-mode-start-screen.css` 88, `09-ux-polish-density.css` 78, `editor/core.part-2.css` 66, `editor/core.part-1.css` 47 … 전부 주석 안이라 렌더링은 정상. **그러나 주석이 이 프로젝트가 순서 이유를 기록하는 유일한 수단**이다. `TOKENS.md:137` 이 가리키는 소유권 스탬프(`tabs-b-assistant-panel.css:2-3`)와, `review.md:258` 이 런타임 누수 원인으로 지목한 `core.part-2.css:110-123` 의 설명 블록이 판독 불능이다.
- **소유권 주석은 장식이다.** `TOKENS.md:137` 이 "p2-assistant 소유, 건드리지 말 것" 이라고 한 파일에 **4개 신원 / 45 커밋**(Senpi Agent 34, AI Bot 32, 72123a 6, dev-vet 6). `CODEOWNERS` 파일 없음.
- `actors.css:1302-1331` 이 `desktop-record-shell/09-final-readability-fixes.css:1-30` 과 **바이트 동일**하고, 후자가 나중에 import 되므로 전자는 죽었다. `actors.css:1308` 의 `min-height: 820px` 을 고쳐도 아무 일도 안 일어난다. 완전 no-op 중복 rule **44개**(파일간 39개).
- battle-skins 9개 파일에 `/* QA r1(readability): … */` 주석 + 4개 rule 이 스킨 이름만 바꿔 **바이트 동일 복붙**돼 있다. `_hud-templates.css` 라는 정확히 그 용도의 파일이 이미 존재한다.
- `studio-theme.css` 가 자기 안에서 같은 선택자를 30줄 간격으로 두 번 선언한다(`:107`/`:138`, `:132`/`:142`, 두 번째 것들이 무관한 `/* ---- footer ---- */` 헤더 밑에 묻혀 있음). `:145 overflow:auto !important` 는 `sidebar.css:91` 에 져서 죽었다.
- 상태 클래스가 bare 와 `is-` 로 이중 존재: `.active` 183 rule/74 파일 vs `.is-active` 22/17, `.selected` 49/27 vs `.is-selected` 16/9, `.hidden` 17/6 vs `.is-hidden` 3/3 등 6개 상태.
- `.actor-curve-maxMp` — 4,900개 클래스 중 **유일한 camelCase**. `actorRecordCurveEditors.ts:29` 의 `` `actor-curve-${key}` `` 로 TS 데이터 모델 키가 선택자로 샜다. `maxMp` 를 리네임하면 CSS 가 조용히 죽는다.
- `element.style.cssText` 가 3개 파일 9곳에 있다(브리핑의 "인라인 스타일 0" 은 부정확). `quickBattleModal.ts:49-60` 은 `#4A57D6`, `#E7E0D0` 을 하드코딩 — 테마 변경을 따라가지 않는다.
- `backdrop-filter` 46개 중 `-webkit-` 접두사는 3개만 존재. Safari 18 미만에서 블러가 사라진다.

---

## 4. 개선 방안 — 단계별 실행 계획

각 Phase 는 **산출물** + **재발방지 가드레일** 이 짝이다. 가드레일 없는 정리는 몇 주 안에 되돌아간다 — 이 레포는 §4.1/§4.7 대조 실험으로 그걸 이미 증명했다.

---

### Phase 0 — 게이트를 먼저 세운다 (1일, 정리는 아직 하지 않는다)

**순서가 중요하다.** 게이트 없이 정리하면 되돌아가고, 게이트를 먼저 세우면 정리는 그 위에서 안전하다.

| # | 작업 | 산출물 |
|---|---|---|
| 0-1 | `.github/workflows/parity.yml` 의 `build` job 에 `npm run build:app 2>&1 \| tee /tmp/b.log; ! grep -q '▲ \[WARNING\]' /tmp/b.log` 추가 | 이미 매 빌드마다 출력되고 있는 진단이 실패로 승격. **입증된 적발률 1/1** |
| 0-2 | `.omo/gates-baseline.json` 을 **git 추적으로 전환** (`.gitignore:6` 예외 추가) | 새 워크트리에서도 baseline-relative 게이트가 실제로 동작. 현재는 모든 병렬 에이전트에서 무력화 |
| 0-3 | `scripts/check-css-budget.mjs` — 체크인된 baseline 대비 **증가만 실패**: `!important` 총계, 전역 `:root` 선언 파일 수, `src/styles` 파일 수, 정의 없는 `var()` 수, 도달 불가 파일 수 | `scripts/verify-gates.mjs` 에 3번째 게이트로 배선. 기존 baseline-regression 설계를 그대로 재사용 |
| 0-4 | `scripts/check-css-graph.mjs` — index.css + player.css + TS `import "*.css"` 로 전체 그래프 해석 후 ① 도달 불가 파일 ② 2회 이상 import 되는 파일 ③ `NN-*.css` 인데 형제 배럴에 없는 파일 ④ 번호 접두사 중복 → 전부 실패 | P0-7(고아), P1-4(이중 import), 07- 3중 충돌을 한 번에 봉쇄. ~40줄 |
| 0-5 | `vite.config.ts` 에 `css: { devSourcemap: true }` | DevTools 에서 계산 스타일 → 소유 파일 역추적 복원. **1줄** |

**가드레일 요약**: 0-3 은 "숫자는 내려갈 수만 있다" 래칫. 0-4 는 배럴 등록 누락과 스쿼시 머지 클로버를 CI 에서 잡는다.

---

### Phase 1 — P0 버그 7건 (2~3일)

| # | 작업 | 검증 |
|---|---|---|
| 1-1 | `src/benchmark/ui/styles.css:1-10` 을 `/* */` 로 | headless Chrome 으로 `document.styleSheets[0].cssRules.length > 0` 확인 |
| 1-2 | `database/tabs-b-status-menu-main.css:420` 의 `.picture-layer-item` 개명 + 해당 TS 방출부 | 상태 메뉴 스크린샷 + 런타임 픽처 스크린샷 **양쪽** |
| 1-3 | `editor/core.part-1.css:97-146` 을 단일 소유자로 하고 `tabs-b-shell-layout.css:227-250` 의 `button.btn` 블록 삭제(값 차이는 core 로 병합) | 전 화면 버튼 스크린샷 회귀 — **사람 눈 필요** |
| 1-4 | `--gold` 를 명시적으로 결정: `core.part-1.css:20` 과 `tabs-b-shell-layout.css:16` 중 하나만 남기고, `--oprn-command-orange` 2개 호출부를 실제 의도한 색으로 | `var(--gold)` 55곳이 걸린 화면 — **사람 눈 필요** |
| 1-5 | `tilesetPassageModal` 의 z-index 를 DB 모달 위 티어로(`--z-modal-overlay` 등) | 타일셋 통과설정 열어서 확인 |
| 1-6 | `system-studio.css:6-19` 에 유령 6개(`--studio-violet/-violet-soft/-surface-2/-surface-3/-mint/-amber`) 정의 추가, `--db-studio-*` 프리미티브에 매핑. 죽은 정의 6개 삭제 | ≥1100px 뷰포트에서 System Studio 패널 — **사람 눈 필요** |
| 1-7 | `07-identifiable-previews.css` 처리: `faceset-crop-*` 규칙은 살아있는 파일로 이관, 나머지 8개 고아 클래스는 삭제. `test/quickAuthoringPreviewIdentity.test.ts` 를 현행 DOM(`ecp-number-meta-variable`, `ecp-wait-span`, `ecp-wait-rail`)에 맞춰 수정 | 실패 중인 2개 테스트가 통과 + 페이스셋 미리보기 스크린샷 |

**가드레일**: Phase 0 의 0-3(정의 없는 `var()` 카운터) 이 1-6 의 재발을, 0-4 가 1-7 의 재발을 막는다. 1-3/1-4 는 stylelint `selector-max-type` + "무범위 단어 클래스 금지" 규칙(Phase 2)이 받는다.

---

### Phase 2 — stylelint 도입 + 무료 코드모드 (1주)

| # | 작업 | 규모 |
|---|---|---|
| 2-1 | `stylelint` + `stylelint-config-standard` 도입, `"lint:css"` 스크립트, `ax-gates` job 에 배선 | |
| 2-2 | **규칙 세트** (전부 기존 위반 allowlist 로 시작 → 래칫 하향): `declaration-no-important`, `no-duplicate-selectors`, `custom-property-no-missing-var-function`, `unicode-bom: never`, `selector-max-specificity: '0,3,0'`, 커스텀 규칙 2개 — ①`src/styles/**` 에서 `[data-testid` 금지(단, `left-palette-root`/`left-map-root` 는 문서화된 계약이므로 예외) ②최상위 선택자로 무범위 단일 단어 클래스 금지 | |
| 2-3 | **코드모드 A — stale fallback 삭제**: `var(--X, LIT)` 에서 `--X` 가 tokens.css 소유이면 fallback 제거 | **461곳**. tokens.css 는 index.css:4 unlayered 첫 import 라 fallback 도달 불가 — **동작 변화 0** |
| 2-4 | **코드모드 B — 죽은 `!important` 삭제**: `_vxace.css` 266 + `_mv.css` 66 = **332개**. `_windowskin.css:34-41` 의 8개는 **보존**. 거짓 주석 2개(`_vxace.css:27-28`, `_mv.css:145`) 제거 | 12종 스킨 e2e 스크린샷 — **사람 눈 필요** |
| 2-5 | **코드모드 C — 죽은 선언 삭제**: `system-studio.css` 의 입증된 무력 선언(:22-26, :31, :33, :34, :38-39, :45, :46, :50-53) 제거. 파일 헤더(`system-studio.css:1-4`)를 실제 출하되는 것으로 재작성 | ~20 `!important` 감소 |
| 2-6 | 죽은 것 삭제: 미사용 custom property **58개**, 확인된 죽은 클래스 중 팔레트 패밀리(`palette-option-button`/`stamp-button`/`chipset-band-button`/`palette-view-button`/`structure-stamp-panel`/`brush-size-btn` = ~65 rule), no-op 중복 rule **44개**, `actors.css:1302-1331`, `grid-4.css`(소비자 0), battle-skins 9곳 QA 복붙 → `_hud-templates.css` 로 통합 | |
| 2-7 | 문서 정정: `system-studio.css:4` 와 `sidebar.css:4` 의 "1100px" → 실제 **800/799px**. 깨진 주석 13개 파일 재작성(git 히스토리에서 원문 복원 시도, 불가하면 현행 동작 기준으로 새로 씀) | |

**가드레일**: 2-2 의 `declaration-no-important` allowlist 는 파일별 상한을 박고 CI 가 **증가만** 실패시킨다. 2-3 의 재발은 "tokens.css 소유 이름에 fallback 금지" 커스텀 규칙으로 막는다.

---

### Phase 3 — 순서 계약을 실행 가능하게 (1주)

레포는 이미 정답 패턴을 갖고 있다. `src/styles/database/sidebar.css:63-68` — 단일 소유자 명시 + 실측치 인용("1920x1200 에서 1628/1584/1530, 최대 98px 이동") + `test/e2e/database-modal-size-invariant.spec.ts` 로 0px 톨러런스 핀. **이걸 나머지에 적용하는 것뿐이다.**

| # | 작업 |
|---|---|
| 3-1 | `index.css` / `playerRuntime.css` / `battle-skins/index.css` / `event-editor.css` 의 **import 순서 스냅샷 테스트**(~20줄). 재배열하려면 스냅샷을 명시적으로 갱신해야 하고 그때 인접 주석을 읽게 된다 |
| 3-2 | 40개 이상의 순서 주석 중 **load-bearing 8건**을 계산된 스타일 assertion 으로 변환: AI 인증 패널의 computed background, 12종 스킨의 `_windowskin` 이후 창틀 border, `_vxace`-after-`_battlers` 스프라이트 크기 등 |
| 3-3 | 이중 import 5건 해소 — 파일별로 소유자를 정하고 반대편 `@import` 삭제. 0-4 가 재발을 막는다 |
| 3-4 | `event-editor.css:2-5` 의 part-4/part-3 역순: **어느 쪽이 옳은지 스크린샷으로 판정 후** 파일명 또는 순서 중 하나를 고쳐 numeric order 와 일치시킨다 |
| 3-5 | `sidebar.css` 의 `@container`/`@media` 7쌍이 동일 선언을 내는지 검사하는 테스트 |
| 3-6 | `database-modal-size-invariant.spec.ts` 확장: `.database-modal-body` 의 computed `display` + rail 폭을 **모든 사이드바 탭 × 799/800px 양쪽**에서 assert |
| 3-7 | 겹치는 브레이크포인트 3개(900/1024/1100) 를 min-only 규약으로 통일 |

**가드레일**: 3-1 이 "정리하다 실수로 재정렬"이라는 **부류 전체**를 없앤다. 이게 가장 싸고(20줄) 가장 넓은 방어다.

---

### Phase 4 — 프로세스 (병행, 코드 변경 없음)

| # | 작업 |
|---|---|
| 4-1 | **`TOKENS.md` §4 에 escalation ladder 명문화**: `losing rule 삭제 > 컴포넌트 루트 클래스로 스코프 > 특정도 상향 > !important`. 커밋 메시지에 **어느 단을 썼고 그 위 단이 왜 안 됐는지** 적게 한다 |
| 4-2 | **파일 은퇴 규칙**: 새 override 파일은 그것이 덮는 규칙을 삭제할 계획과 함께만 생성 가능. override 가 영구적이면 같은 PR 에서 원본에 접어 넣는다. `src/styles` 파일 수는 감소를 동반하지 않으면 증가 불가(0-3 이 집행) |
| 4-3 | **번호 접두사 폐지.** 접두사는 로드 순서를 인코딩하려고 존재하고, 그게 바로 워크트리 간에 충돌하는 것이다. 컴포넌트 이름으로 명명하고 순서는 배럴 주석이 아니라 3-1 스냅샷이 지킨다 |
| 4-4 | 소유권을 **에이전트 단위 → 컴포넌트 단위**로. `TOKENS.md:137` 의 "p2-assistant 소유" 류 삭제(실제로 4개 신원 45커밋이 들어갔다). 필요하면 `CODEOWNERS` 로 진짜 집행 |
| 4-5 | `TOKENS.md` 를 `AGENTS.md:5-32` 독서 목록에 추가. 현재 md/ts/json 어디서도 참조되지 않는다(CSS 3개 파일에서만 언급) |
| 4-6 | `verify-gates.mjs:7-9` 의 "기준선은 이미 빨간불" 문구 갱신 — `tsc --noEmit` 는 현재 **0 에러**다 |
| 4-7 | `test/detsukuruBrandStrings.test.ts:51` 의 `/rm-tool-icon-/` 패턴을 `/rm-tool-icon/` 로 고치거나, `rm-` 45개 클래스를 명시적 면제로 문서화 |

---

### Phase 5 — 큰 통합 (스프린트 단위, Phase 0~3 완료 후에만)

| # | 대상 | 방법 |
|---|---|---|
| 5-1 | **event-editor 56파일 / 20,135줄** | 3개 뷰포트 computed-style 스냅샷 동결 → 배럴 순서로 last-writer-wins 를 계산하는 PostCSS 리졸버 실행 → 승자만 `part-1/2` 로 이관 후 `.mockup`/`.balanced`/`.modernize` 삭제. 예상 12k줄 제거. **손으로 하면 안 된다** |
| 5-2 | **runtime/battle 포켓몬 슬라이스 14/16/18/19/20** | 하나의 `pokemon-skin.css` 로 병합. **01~13 과 나머지 6개 슬라이스 디렉터리는 손대지 않는다**(재선언율 1~12%, 정직한 기계 분할) |
| 5-3 | **컴포넌트 프리미티브** | `components/` 에 `modal-scrim`(z-index 티어 토큰 포함), `field-input`, `surface-card`, `chip`, `panel-header` 추가. 23개 백드롭 / 90개 폼 베이스 / 613 트리플을 순차 이관 |
| 5-4 | **토큰 네임스페이스 통합** | ①`--db-light-*` vs `--db-studio-*` 를 하나로(현재 studio 가 bridge 로 이기고 있음 — 의도적이고 `studio-theme.css:80` 에 문서화돼 있으므로 급하지 않다) ②전역 `:root` 를 여는 11개 파일 → `tokens.css` + `legacy-aliases.css` 2개로 ③early-binding 누수 21개 별칭을 `.database-modal-backdrop` 스코프로 이동 ④배틀 스킨 CSS 의 죽은 `--battle-*` 44개 삭제, registry.ts 단일 소유 확정 + vitest 가드 |
| 5-5 | **@layer 결정** | 두 선택지 중 하나에 **커밋**한다. (a) `index.css:2` 삭제 + 11개 파일 unwrap → 균일하게 unlayered, 오해 제거, 비용 최소. (b) 디렉터리→레이어 매핑 코드모드로 235개 전량 래핑 — battle 트리(battle.css + 21 슬라이스 + battle-skins)는 **반드시 같은 커밋**에. **부분 마이그레이션은 반드시 상황을 악화시킨다.** (b) 는 `!important` 감축의 전제조건이지만 Phase 5 이전엔 하지 말 것 |
| 5-6 | **CSS 코드 스플리팅** | `event-editor.css` / `tabs-b.css` / `desktop-record-shell.css` / `figma-editor.css` 를 index.css 에서 빼고 소유 TS 모듈로 이동(소스 41% 이동). `playerRuntime.css` 는 `testPlayModal.ts:6` 의 static import 를 먼저 끊어야 효과가 난다. **단, JS 청크가 5.9배 크다 — 성능이 목적이면 JS 를 먼저 봐라** |

---

## 5. 자동화 가능 vs 사람 눈 필요

| 작업 | 자동화 | 근거 / 검증 수단 |
|---|---|---|
| benchmark `//` → `/* */` | ✅ 완전 | 파서가 판정. 브라우저 `cssRules.length` 로 확인 |
| stale fallback 461개 삭제 | ✅ 완전 | fallback 분기 **도달 불가**가 구조적으로 보장됨 → 동작 변화 0 |
| 미사용 custom property 58개 삭제 | ✅ 완전 | 정의−참조−TS `setProperty` 차집합 |
| no-op 중복 rule 44개 삭제 | ✅ 완전 | 동일 선택자·동일 body·동일 media → 나중 것 제거는 계산 결과 불변 |
| `actors.css:1302-1331` 삭제 | ✅ 완전 | `diff` 로 바이트 동일 확인됨, 이미 죽어 있음 |
| import 그래프 검사 / 배럴 검사 / 번호 충돌 검사 | ✅ 완전 | 순수 정적 분석 |
| import 순서 스냅샷 | ✅ 완전 | |
| stylelint 도입 + allowlist 베이스라인 | ✅ 완전 | |
| `--gold` 중복 정의 제거 | ⚠️ 반자동 | 삭제는 자동, **어느 색이 맞는지는 사람이 결정** |
| 클래스 개명(`.picture-layer-item` 등) | ⚠️ 반자동 | 치환은 자동, 두 화면 동시 확인 필요 |
| `button.btn` 통합 | ⚠️ 반자동 | 값 병합은 사람. **전 화면 버튼 회귀** |
| `_vxace`/`_mv` !important 332개 삭제 | ⚠️ 반자동 | 삭제는 스크립트, **12종 스킨 시각 회귀 필수**. `_windowskin.css:34-41` 8개 예외를 스크립트에 하드코딩 |
| `system-studio.css` 죽은 선언 제거 | ⚠️ 반자동 | 죽었다는 건 증명됨, 그래도 ≥1100px 스크린샷 |
| 유령 토큰 6개 정의 | ❌ 사람 | 어떤 색이어야 하는지는 디자인 결정 |
| event-editor 5-1 플래튼 | ❌ 사람 감독 | 리졸버는 자동, **뷰포트 3종 픽셀 diff 게이트 필수** |
| 포켓몬 슬라이스 병합 | ❌ 사람 감독 | 전투 HUD 는 픽셀아트 크롬 — diff 로만 판정 |
| 프리미티브 추출(백드롭/폼/카드) | ❌ 사람 | 어떤 변형을 남길지가 디자인 판단 |
| 브레이크포인트 통합 | ❌ 사람 | 38개 → 4~5개는 레이아웃 결정 |
| `@layer` 전량 마이그레이션 | ❌ 사람 감독 | 코드모드는 가능하나 **캐스케이드 이웃 단위 all-or-nothing** |
| 반응형 레일 800/799 문서화·테스트 | ❌ 사람 | 양쪽 폭에서 실제 확인 |

### 시각 회귀 안전망 — 이미 있다

`verify-shots/` + `.omo/evidence/` + `.superpowers/` 에 **PNG 601장**, Playwright 세팅 완비, `test/e2e/database-modal-size-invariant.spec.ts` 가 **0px 톨러런스 핀** 패턴을 이미 시연한다. **Phase 2 코드모드를 돌리기 전에 이걸 baseline 스냅샷 스위트로 승격시켜라.** 이 레포는 픽셀아트 크롬 게임 에디터이고 위 표의 ⚠️/❌ 항목은 전부 시각 회귀 리스크가 실재한다 — 그런데 그물은 이미 짜여 있고 아무도 안 걸어놨을 뿐이다.

---

## 6. 손대지 말아야 할 것 / 우선순위에서 뺄 것

### 검증에서 무너져서 삭제한 주장 (**시간 낭비하지 마라**)

| 주장 | 판정 |
|---|---|
| "`.btn` 베이스 컴포넌트가 아예 없다, 37개 파일 재스킨" | **REFUTED.** `editor/core.part-1.css:97-146` 에 9개 rule 완비. 감사자 정규식이 `button.btn` 을 매칭 못 함 |
| "system-studio 가 grid, sidebar 가 flex 로 같은 노드를 다툰다 / 탭마다 레이아웃 모델이 바뀐다" | **REFUTED.** `sidebar.css:85-92` 가 `(0,4,0)`+`!important` 로 항상 이김. body 는 **항상 flex** |
| "6개 파일이 전역 스크롤바 스타일을 중복 구현, ~90줄" | **REFUTED.** 6개 중 5개는 `*` 로 표현 불가능한 의도적 커스터마이즈. 실제 중복은 `shell-density.part-1.css:797-811` **1블록 + one-liner 22개 ≈ 25줄** |
| "900/901, 799/800 브레이크포인트에 1px 데드존" | **REFUTED.** `max-width` 는 inclusive. 정상 쌍이다. (진짜 문제는 §P2-4 의 **중복 사용**) |
| "focus 링이 14곳에서 대체 없이 죽어 a11y 파손" | **REFUTED.** outline none/0 인 84개 중 32개는 box-shadow, 36개는 border, 14개는 background 로 대체. 대체 전무는 **2개**(그마저 색은 바뀜) |
| "`.quick-battle-modal-overlay` 에 백드롭 스타일이 없다" | **REFUTED.** `quickBattleModal.ts:36-46` 에서 인라인 `rgba(0,0,0,0.85)` |
| "`transitions.css:13` 의 `var(--bg-canvas,#05070c)` 가 검은 커튼을 그릴 수 있다" | **REFUTED.** `--bg-canvas` 는 tokens.css:19 에 무조건 정의됨 |
| "`npm run build` 가 실패한다" | **REFUTED.** vite 6.4.3 고정, CI `npm ci`, 26.24s exit 0 |
| "`is-error` 를 리네임하면 grep 이 0건" | **REFUTED.** `playLoadingOverlay.ts:100` 외 5곳에 리터럴 존재 |

### 하지 말아야 할 프로젝트

1. **"죽은 CSS 대청소".** 도달 불가 파일은 **247개 중 1개**. 엄격 dead 라인은 74,601 중 **~1,600(2.2%)**. PurgeCSS 류를 돌리면 743개 템플릿 리터럴 클래스 생성 지점 때문에 오삭제가 난다(`oprn-icon-*` 51개가 4곳에서 조립됨 — `menuToolbar.ts:73`, `mapList.ts:298/:1008`, `mapContextMenu.ts:103`). **낭비는 삭제 대상이 아니라 덮어씌워진 선언(중복 selector+property 쌍 기준 2,241~3,930개)이다.**
2. **`.part-N` 되돌리기.** 23파일 11,001줄. 커밋 `1e317409` 이 concat 바이트 동일 + 번들 해시 동일을 검증했고, 23개 파일 전부 중괄호 균형이 맞는다. **오늘 아무 버그도 안 낸다.** 독립 PR 로 하면 11k줄짜리 no-op diff 로 blame 만 파괴한다. 컴포넌트 통합의 부산물로만 해라.
3. **번들 크기를 근거로 한 중복 제거.** 완전 중복 블록은 출하 1,506,773 B 중 **5,040 B = 0.3%**. 논거로 쓰면 finding 이 약해진다. 진짜 논거는 "일괄 수정 불가능"이다.
4. **6개 BOM 파일 캠페인.** 브라우저에 도달하지 않고(dev 모듈·prod 산출물 모두 BOM 0), css-tree 는 6개 전부 에러 없이 파싱한다. lightningcss 를 파일 단위로 돌리는 파이프라인이 이 레포엔 없다. stylelint `unicode-bom: never` 로 한 줄 처리하고 잊어라.
5. **`:has()` 350개 캠페인.** 실측 360개, 대부분 element-anchored 로 문제없다. 손댈 것은 **`body:has(…)` 7개뿐**(`editor-ui-modes.css:386`, `tabs-b-assistant-panel/01-legacy-preview-panel.css:18,:24-26`, `02-chat-dock.css:303-304`) — 이건 invalidation set 을 무력화한다. 나머지 ~353개는 놔둬라.
6. **`backdrop-filter` / 애니메이션 성능.** 세 효과 전부 **조건부**다: 미니맵은 `map?.minimap?.enabled` 옵트인(기본 undefined) + M 키 토글, mother-swirl 은 12종 중 1종의 전투 중, low-HP 펄스는 `.is-low`. `transition: all` 은 **0회**, `will-change` 는 정확히 2회(둘 다 올바름), `prefers-reduced-motion` 은 24블록. 83개 keyframes 중 진짜 나쁜 건 2개(`battle-orb-throw` 의 left/top, `battle-orb-caught` 의 box-shadow spread). **일괄 재작성 금지.**
7. **`data-testid` 셀렉터 431개 제거.** 60%(259개)가 `left-palette-root`/`left-map-root` 두 이름이고, `src/editor/workspace/dockHost.ts:5-10, :22-27` 에 *"이건 CSS 계약이다"* 라고 명시적으로 문서화돼 있으며, 둘 다 프로덕션 `querySelector` 타깃(8곳 이상)이라 리네임하면 **JS 가 먼저 시끄럽게 깨진다.** 실제 대상은 나머지 ~172개다.
8. **`db-` / `oprn-` 접두사 빅뱅 마이그레이션.** `oprn-` 은 포기한 리네임이 아니라 **테스트로 강제된 de-branding 의 잔여물**이고, 1,112개 rule group 중 340개(31%)는 같은 콤마 그룹 안의 **선언된 동의어**라 캐스케이드 경쟁조차 아니다. 남는 실제 작업은 이중 방출 41곳과 `.oprn-db-fieldset` 18곳뿐.
9. **battle 외 6개 슬라이스 디렉터리 플래튼.** 내부 재선언율 1~12%(command-preview 1%, battle-skins 1%, modern 6%, desktop-record-shell 8%, figma-editor 9%, part-3 11%, assistant-panel 12%). **정직한 기계 분할이다.** battle 만 24%.
10. **`@layer` 부분 마이그레이션.** 한 파일씩 옮기면 옮기는 파일마다 우선순위가 **역전**된다. all-or-nothing 이거나 안 하거나 둘 중 하나.
11. **파일 단위 near-duplicate 탐지 툴.** 247개 파일 md5 완전 중복 **0건**. 선택자 겹침 최다 쌍조차 바이트 동일 body 가 0개다. diff 툴은 아무것도 못 찾는다.
12. **단수/복수 클래스 쌍 104개.** `.db-tab`/`.db-tabs` 류 — 전부 정상적인 컨테이너/아이템 규약. 어떤 near-duplicate 툴이든 이걸 먼저 뱉을 테니 **미리 제외 리스트에 넣어라.**

---

## 부록 A — 이미 잘 돼 있는 것 (부수지 마라)

- **`src/styles/database/sidebar.css:63-68`** — 단일 소유자 명시 + 실측치 + 실행 가능한 테스트 핀. **이게 정답 템플릿이다.** 나머지 8개 순서 계약에 그대로 복제하면 된다.
- **`src/styles/tokens.css`** — 90개 프로퍼티, 6단계 elevation 스케일, 완전한 z-index 스케일, 그리고 `:21-32` 에 `--glass-blur-panel` 이 saturate(1.4)→1.08 로 내려간 실측 근거(합성 rgb(217,240,210) 에서 보조 텍스트 대비 4.22:1 로 AA 미달)와 측정 스크립트 인용까지 있다. 웬만한 디자인 시스템보다 낫다.
- **`test/tokensContrast.test.ts`** — 알파 합성까지 해서 20개 이상 조합의 WCAG 4.5:1 을 기계 강제. **`test/fontFamilyTokenGuard.test.ts`** — 247개 파일 순회, 위반 0. **`test/databaseLightTheme.test.ts`** — 주석 제거 후 `:root` 부재 + 전 선택자 스코프 검증. 가드의 올바른 형태가 이미 세 벌 있다.
- **`src/styles/database/light-theme.css`** — 829줄 448선언에 `!important` **0개**. 순수 토큰 remap 만으로 서브트리를 뒤집는다. 올바른 테마 기법이 이 레포 안에 이미 시연돼 있다.
- **`runtime/battle-skins/`** — 17개 파일 간 선택자 겹침 **0/306**. 배럴이 `_vxace`-after-`_battlers`(특정도 동률이라 순서가 결정한다는 것까지 정확히 명시)와 `_windowskin`-last 의 근거를 써놨다. 이 디렉터리가 나머지가 되어야 할 모습이다.
- **`src/util/dom.ts` 의 `el()`** — 클래스 방출 단일 관문. 문자열 연결 0건, `innerHTML` 1건. **이것 때문에 이 감사의 죽은 클래스 분석이 가능했다.** 이 규모의 vanilla DOM 코드베이스는 보통 분석 불가능하다.
- **커밋 `1e317409`** — 7/7 concat 바이트 동일 + 번들 해시 동일 검증 + 자기 서브에이전트 오류(@media 내부 절단) 자진 보고·수정. **동작 보존 리팩터를 증명하고 있다.** 전략은 틀렸지만 실행은 엄정했다.
- **커밋 `3a19d5f2`(!important 515개 제거) 와 `b3b23dbb`(`_rm2003.css` 279→0, `:not(:where(...))` 로 다른 11종 스킨 캐스케이드 불변 보존, `--battle-stage-inset-top` 단일 선언지 확정, `test/battleRm2003PixelGrid.test.ts` 동반)** — "왜 애초에 싸우는가"를 다룬 스타일시트 스코프 작업이 **이미 두 번 있었다.** `!important` 밀도는 1k줄당 12.2(07-15) → 21.2(08-01) → **13.8(08-28)** 로, 시트가 45% 커지는 동안 35% 하락했다. 병리는 "정리를 안 한다"가 아니라 **래칫이 없어서 정리분이 몇 주 만에 재소비된다**는 것이다. → Phase 0-3 의 예산 게이트가 정확히 그 구멍을 막는다.

## 부록 B — 미해결 수치 (범위로만 말할 수 있음)

| 항목 | 범위 | 이유 |
|---|---|---|
| 2개 이상 파일에 정의된 선택자 / 잉여 정의 | **347/527 ~ 972/1,310** (감사자 579/1,163) | bare 단일 클래스만 세느냐, 클래스로 시작하는 모든 선택자 문자열을 세느냐로 갈림. 감사자 값은 그 사이 |
| 중복 selector+property 쌍 / 덮어씌워진 선언 | **2,241/2,671**(@media 제외) ~ **3,930/5,346**(@media 포함) | 둘 다 검증자 실측. @media 제외가 더 보수적이고 옳은 판단 |
| 죽은 CSS 클래스 | **464/920 rule**(템플릿 stem 도달분 제외 후) ~ 668(순진한 grep) | 464 를 채택 |
| `!important` | 1,051 occurrence / 주석 6 / **~1,031 실선언** | grep 은 1,051 |