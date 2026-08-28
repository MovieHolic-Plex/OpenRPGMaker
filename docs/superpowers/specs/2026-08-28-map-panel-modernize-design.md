# 좌측 사이드바 '맵' 패널 모던화 — 설계

- **작성일:** 2026-08-28
- **워크트리:** `.claude/worktrees/map-modernize` (브랜치 `worktree-map-modernize`, base `3a55fde6`)
- **범위:** 좌측 패널의 `맵` 섹션(`panelRegistry.ts` 의 `id:"maps"`)에 한정
- **범위 밖:** 타일 팔레트, 레이어 스위처, `mapList.ts` 파일 분해, `--map-tree-height` 리사이저 동작

## 1. 문제

"모던하지 않다"의 원인은 색이 아니라 **소유권 부재**다. 맵 패널의 스타일은 CSS 13개 파일에
흩어져 있고, 각 파일이 `.left-panel-stack[data-testid="left-map-root"]` 라는 **컨테이너
testid 접두사로 특이도를 확보**한다. 이 방식은 패널이 두 번째 컨테이너(초보 모드
플라이아웃)에 렌더될 때 규칙을 조용히 잃게 만든다.

### 1.1 실측 증거

expert / standard / beginner 3모드, 1440×900, `?devProject=1&marketTown=1`
(캡처: `verify-shots/map-modernize/baseline/`, 계측: 같은 폴더 `diag.json`).

**결함 A — 초보 플라이아웃에서 '시작' 배지가 메타 텍스트를 28px 덮는다.**

```
metaText : "60×60 · 16이벤트 · 문0"   meta   x=195 w=128 right=323
badge    : "시작"                      badge  x=295 w=34  right=329
badgeOverlapsMetaPx : 28
rowGridCols : 22px 12px 44px 94px 34px 28px 28px    ← 이름/메타 칸 94px
```

원인 사슬:

1. `figma-editor/10-map-tree.css:72` 의 `.map-tree-copy { display:flex; flex-direction:column }`
   이 `[data-testid="left-map-root"]` 로 스코프됨 → 플라이아웃(`.basic-flyout-map-host`)에
   도달하지 않는다.
2. 그래서 `.map-tree-copy` 가 block 으로 남고, 그 자식 `.map-tree-meta` 는 **inline `<span>`**
   이다.
3. `map-props.css:453` 이 그 span 에 `overflow:hidden; text-overflow:ellipsis` 를 걸어두었으나
   **inline 박스에서는 무효**다. computed style 확인 결과 `overflow:hidden`,
   `white-space:nowrap` 이 적용돼 있음에도 폭은 128px 로 94px 칸을 뚫는다.

즉 이미 두 파일이 같은 문제를 각자 고치려 했고, 두 번째 시도가 무효인 채로 남아 있다.

**결함 B — 헤더 4번째 버튼(전체 접기/펼치기)의 글리프가 존재하지 않는다.**

`mapList.ts:634` 가 `oprn-icon-tree-open` / `oprn-icon-tree-closed` 를 요구하지만 두 클래스는
`src/styles/` 어디에도 정의돼 있지 않다(`components/icons.css` 의 정의 목록 43개에 없음).
버튼이 빈칸으로 렌더된다.

**결함 C — 헤더 아이콘 4개의 출처가 3곳으로 갈린다.**

| 버튼 | 아이콘 | 정의 위치 |
|---|---|---|
| 루트에 맵 추가 | `map-child` | `components/icons.css` |
| 분류 추가 | `folder` | `map/resource-system.part-2.css` (리소스 매니저 전용 시트) |
| 시작 맵 지정 | `map-start` | `components/icons.css` |
| 전체 접기/펼치기 | `tree-open`/`tree-closed` | **없음** |

**결함 D — 데이터베이스 시트가 맵 트리를 스타일링한다.**

`database/tabs-a.part-2.css:427` 이 전역 `.map-item { display:flex; flex-wrap:wrap }` 과
`.map-tree-icon` 을 정의한다. 도메인 경계 침범이며, `flex-wrap:wrap` 은 좁은 폭에서 행이
접히는 원인이다.

**결함 E — 죽은 규칙.** `editor/core.part-2.css:174-184` 의 `.map-item .del` 은 `mapList.ts`
가 더 이상 생성하지 않는 요소를 스타일링한다.

**결함 F — 선택 행이 토큰 문서와 어긋난다.** `figma-editor/09-rm-chipset-grid.css:131` 이
`background: var(--accent); color: var(--on-accent)` 로 채도 100% 슬래브를 만든다.
`TOKENS.md` 는 선택 행 배경으로 `--accent-muted` 를 규정한다. 후속 보정으로
`10-map-tree.css:87` 이 메타 색을 `color-mix(in srgb, #fff 80%, #4A57D6)` 하드코딩으로
덮는다 — 토큰 밖의 색이 하나 더 생겼다.

**결함 G — 크롬이 콘텐츠보다 크다.** 검색 입력 + 패싯 칩 4개가 맵 개수와 무관하게 항상 두
줄을 점유한다. 맵 1개인 프로젝트에서 필터 크롬이 목록보다 세로로 길다.

### 1.2 현행 소유권 지도

`map-tree` / `map-item` 을 언급하는 파일 13개:

```
shell/figma-editor/10-map-tree.css        352줄  패널 내부 (주 소유자)
shell/shell-density.part-2.css                   패널 내부 (밀도)
shell/editor-responsive-expert.css               패널 내부 (이름 말줄임)
shell/editor-ui-modes.css                        플라이아웃 내부
editor/responsive-a.css                          액션 표시/숨김
editor/map-props.css            441-457          플라이아웃 내부
editor/core.part-2.css          152-184          .map-item 베이스 + 죽은 .del
database/tabs-a.part-2.css      427-435          도메인 침범
shell/figma-editor/09-rm-chipset-grid.css 131-145 패널 높이 + 선택 행
shell/figma-editor/02-menus-toolbar-tools.css     혼합 (그리드 행 + 액션 크기)
shell/figma-editor/07-context-menu-responsive.css 185  .left-panel 그리드 행 (패널 외부)
shell/figma-editor/03-layout-left-palette.css     .resizer-map-tree (패널 외부)
```

`figma-editor/*` 파티션 11개는 파일별로 중괄호 균형이 맞는다(전부 delta=0). 선두 들여쓰기는
기계 분할의 잔재일 뿐 `@media` 중첩이 아니므로, **파일 단위 이관이 안전하다.**

## 2. 설계

### S1 · CSS 소유권 통합

신규 `src/styles/editor/map-panel.modern.css` 를 `.map-tree-panel` 서브트리의 **단독 소유자**로
선언한다. `index.css` 에서 `@import "./editor/map-props.css";` 직후에 import 한다.

**핵심 규칙 변경:** 스코프를 `[data-testid="left-map-root"]` → **`.map-tree-panel`** 로 바꾼다.
이 클래스는 두 변종 모두에 존재한다(실측 DOM: expert = `panel-section map-tree-panel`,
초보 = `panel-section map-tree-panel is-basic-flyout`). 변종 분기는 `.is-basic-flyout`
한 개로만 표현한다. 컨테이너 testid 를 셀렉터로 쓰지 않는다.

이관 계획:

| 파일 | 처리 |
|---|---|
| `figma-editor/10-map-tree.css` | 전량 이관 후 **파일 삭제**, `figma-editor.css` 의 @import 제거 |
| `shell-density.part-2.css` | 맵 블록 이관 |
| `editor-responsive-expert.css` | 맵 블록 이관 (미디어쿼리 조건 보존) |
| `editor-ui-modes.css` | 플라이아웃 맵 블록 이관 |
| `editor/responsive-a.css` | 맵 블록 이관 (미디어쿼리 조건 보존) |
| `editor/map-props.css` 441-457 | **삭제** — 무효 규칙이므로 S2 의 새 규칙이 대체한다 |
| `editor/core.part-2.css` 152-184 | 이관. `.map-item .del` 은 **삭제**(결함 E) |
| `database/tabs-a.part-2.css` 427-435 | **삭제**(결함 D) |
| `figma-editor/09-rm-chipset-grid.css` 131-145 | 이관. 선택 행은 S5 로 대체 |
| `figma-editor/02-menus-toolbar-tools.css` | 액션 크기만 이관, `.left-panel` 그리드 행은 **잔류** |
| `figma-editor/07-…`, `03-…` | 패널 외부(그리드 행 / 리사이저) — **잔류** |

**종료 상태:** 패널 내부 규칙 소유자 1개, 패널 외부 레이아웃 3개.

### S2 · 행 그리드 계약

두 변종이 하나의 그리드 정의를 공유하고, 치수만 토큰으로 갈린다.

```css
.map-tree-panel .map-item {
  display: grid;
  grid-template-columns:
    var(--map-row-toggle) var(--map-row-handle) var(--map-row-thumb)
    minmax(0, 1fr) auto auto;
  align-items: center;
}
.map-tree-panel .map-tree-copy { display: grid; min-width: 0; }
.map-tree-panel .map-tree-name,
.map-tree-panel .map-tree-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

`.map-tree-copy` 를 grid 로 두면 자식 span 이 블록 컨테이너를 얻어 말줄임이 실제로 걸린다.
`minmax(0,1fr)` 이 이름/메타 칸의 최소 폭을 0 으로 풀어 배지·메뉴 칸을 침범하지 않는다.
`flex-wrap` 은 어느 변종에도 쓰지 않는다.

변종 차이는 토큰 3개 재정의로만 표현한다:

```css
.map-tree-panel { --map-row-toggle: 14px; --map-row-handle: 10px; --map-row-thumb: 44px; }
.map-tree-panel.is-basic-flyout { --map-row-toggle: 22px; --map-row-handle: 12px; }
```

이로써 결함 A 는 CSS 구조로 재발이 차단된다.

### S3 · 헤더 툴바

1. `components/icons.css` 에 `oprn-icon-tree-open` / `oprn-icon-tree-closed` 를 **신규 정의**
   한다(결함 B). 기존 글리프와 같은 `::before`/`::after` CSS 도형 방식을 따른다.
2. `folder` 를 `components/icons.css` 로 옮기거나 맵 전용 글리프를 새로 정의해, 리소스 매니저
   시트 의존을 끊는다(결함 C). `resource-system.part-2.css` 의 기존 정의는 리소스 매니저가
   계속 쓰므로 **남긴다**.
3. 버튼 4개를 툴 레일과 같은 모노톤 `rm-tool-icon` 언어로 통일한다: 28px 히트 영역,
   `--control-bg` 면, `--text-2` 글리프, hover 시 `--control-bg-hover`.
4. 제목 `맵 1` → 라벨 `맵` + 개수를 `--text-3` 배지로 분리한다. 개수가 라벨과 같은 크기·굵기로
   경쟁하지 않게 한다.

### S4 · 필터 — 맵 개수 기반 점진적 노출

동작 규칙:

- 맵 개수 **< 8**: 필터 접힘. 헤더에 돋보기 토글 버튼만 노출.
- 맵 개수 **≥ 8**: 지금처럼 펼친 상태로 시작.
- **질의 문자열이 비어 있지 않거나 패싯이 `all` 이 아니면 개수와 무관하게 항상 펼침.**
  숨겨진 필터 때문에 "맵이 사라졌다"고 오인하는 상황을 만들지 않는다.
- 사용자가 토글로 편 상태는 해당 세션의 렌더 사이에 유지한다(모듈 스코프 변수, 영속화 없음).

임계값 8 의 근거: 접힌 필터 크롬(28px)보다 목록이 확실히 길어지는 지점. 행 높이 31px 기준
8행 = 248px 로, 기본 트리 높이 300px 를 채우기 시작하는 개수다.

계약:

- 기존 testid **유지**: `map-tree-filter`, `map-tree-facet-all|empty|nolink|encounter`
- 신규 testid: `map-tree-filter-toggle`
- 접힘 상태에서도 입력·칩은 DOM 에서 제거하지 않고 `hidden` 으로 둔다. 기존 e2e 가
  `getByTestId(...).fill()` 로 접근하는 경로를 깨지 않기 위함이다.
- 패싯 칩을 두 변종 모두 pill(`border-radius: 999px`)로 통일한다. 현재 초보 변종은 각진
  사각형이다.

### S5 · 선택 행

```css
.map-tree-panel .map-item.active {
  background: var(--accent-muted);
  box-shadow: inset 2px 0 0 var(--accent);
  color: var(--text-1);
}
.map-tree-panel .map-item.active .map-tree-meta { color: var(--text-3); }
```

`09-rm-chipset-grid.css:131` 의 `background: var(--accent)` 와 `10-map-tree.css:87` 의
`color-mix(in srgb, #fff 80%, #4A57D6)` 하드코딩을 제거한다(결함 F). 새 hex 를 도입하지
않는다 — `TOKENS.md` 의 토큰만 소비한다.

다중 선택(`.is-multi-selected`)은 `--accent-muted` 를 절반 농도로 쓰고 좌측 레일은 두지
않아, 활성 행 하나와 구분되게 한다.

### S6 · 검증

**기존 스위트 유지 (회귀 게이트):**

- `test/mapList.test.ts` (137줄, 단위)
- `test/basicLeftRail.test.ts`
- `test/e2e/map-tree-thumbnails.spec.ts`
- `test/e2e/oprn-editor-layout.spec.ts`
- `test/editorLayoutPersist.test.ts`

**신규 `test/e2e/map-panel-modern.spec.ts`** — expert / standard / beginner 3모드 전수:

1. `badgeOverlapsMetaPx === 0` — 결함 A 회귀 차단
2. 모든 `.map-tree-name` / `.map-tree-meta` 에서 `scrollWidth <= clientWidth + 1`
3. 헤더 버튼 4개 각각의 아이콘 요소가 렌더 폭 > 0 — 결함 B 회귀 차단
4. 필터 토글 왕복: 맵 1개 → 접힘 확인 → 토글 → 입력 가능 → 패싯 활성 시 강제 노출 확인
5. 기존 testid 전수 존재: `map-tree`, `map-tree-list`, `map-tree-filter`,
   `map-tree-facet-*`, `map-add`, `map-add-folder`, `map-set-start`, `map-toggle-all`,
   `map-tree-node-*`, `map-context-trigger-*`

**시각 증거:** `verify-shots/map-modernize/baseline/` (캡처 완료) vs `.../after/`.
캡처 스크립트 `scripts/_map-panel-baseline.mts`, 계측 스크립트
`scripts/_map-panel-overlap-probe.mts` 는 진단용이므로 `_` 접두사를 유지한다.

**빌드 게이트:** `npx tsc --noEmit -p tsconfig.app.json`, `npx vitest run test/mapList.test.ts
test/basicLeftRail.test.ts test/editorLayoutPersist.test.ts`.

## 3. 불변 계약

작업 전후로 반드시 동일해야 하는 것:

- 모든 `data-testid` (S4 의 신규 1개 추가만 허용)
- 키보드 트리 내비게이션(`handleRowKeydown`), 드래그 재부모화, 박스 선택, Ctrl/Shift 다중
  선택, 중간클릭 테스트플레이, 더블클릭 리네임/속성, 우클릭 컨텍스트 메뉴
- 접힘 상태 영속화 키 `oprn:map-tree-collapsed`
- `--map-tree-height` 리사이저 및 그 영속화
- ARIA: `role="tree"` / `treeitem` / `group`, `aria-level`, `aria-selected`,
  `aria-expanded`, `aria-multiselectable`

## 4. 미결 사항

없음. 임계값(8), 변종 토큰 값, 이관 대상 파일 목록은 모두 위에서 확정했다.
