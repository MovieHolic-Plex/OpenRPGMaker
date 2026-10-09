# OPRN 디자인 토큰 가이드

**원본:** `src/styles/tokens.css` (유일한 `:root` 토큰 정의). 이 문서의 값 표는 `node -e` 로 생성한다 — 손으로 고치지 말고 tokens.css 를 고친 뒤 재생성.
**방향:** 쿨 화이트 + 인디고 단일 액센트(2026-08-25 이후). 크림/골드 팔레트는 폐기됐다. `html { color-scheme: light }`.

값 표 재생성 명령(리포 루트에서):

```bash
node -e '
const s=require("fs").readFileSync("src/styles/tokens.css","utf8").replace(/\/\*[\s\S]*?\*\//g,"");
for(const m of s.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) console.log(`| \`${m[1]}\` | \`${m[2].trim()}\` |`);
'
```

## 1. 토큰 값 (자동 생성)
| 토큰 | 값 |
|---|---|
| `--bg-base` | `#F7F8F8` |
| `--bg-surface` | `#F7F8F8` |
| `--bg-raised` | `#FFFFFF` |
| `--bg-overlay` | `#FFFFFF` |
| `--bg-inset` | `#EEF1F4` |
| `--bg-canvas` | `#EEF1F4` |
| `--bg-glass` | `rgba(247, 248, 248, 0.92)` |
| `--bg-glass-panel` | `rgba(255, 255, 255, 0.78)` |
| `--glass-blur-panel` | `blur(24px) saturate(1.08)` |
| `--bg-scrim` | `rgba(15, 23, 42, 0.40)` |
| `--bg-hover` | `rgba(15, 23, 42, 0.05)` |
| `--bg-active` | `rgba(15, 23, 42, 0.09)` |
| `--control-bg` | `rgba(15, 23, 42, 0.04)` |
| `--control-bg-hover` | `rgba(15, 23, 42, 0.08)` |
| `--control-bg-active` | `rgba(15, 23, 42, 0.12)` |
| `--border-subtle` | `rgba(15, 23, 42, 0.08)` |
| `--border-default` | `rgba(15, 23, 42, 0.127)` |
| `--border-strong` | `rgba(15, 23, 42, 0.461)` |
| `--text-1` | `#0F172A` |
| `--text-2` | `#475569` |
| `--text-3` | `#626E89` |
| `--text-placeholder` | `#626E89` |
| `--text-disabled` | `#94A3B8` |
| `--accent` | `#4A57D6` |
| `--accent-hover` | `#3C48C4` |
| `--accent-active` | `#2F3AAE` |
| `--accent-muted` | `rgba(74, 87, 214, 0.12)` |
| `--accent-border` | `rgba(74, 87, 214, 0.45)` |
| `--on-accent` | `#ffffff` |
| `--danger` | `#C6403D` |
| `--danger-muted` | `rgba(198, 64, 61, 0.13)` |
| `--success` | `#18764F` |
| `--success-muted` | `rgba(24, 118, 79, 0.13)` |
| `--warning` | `#8A5E00` |
| `--warning-muted` | `rgba(138, 94, 0, 0.13)` |
| `--radius-s` | `6px` |
| `--radius-m` | `10px` |
| `--radius-l` | `14px` |
| `--radius-pill` | `999px` |
| `--font-size-xs` | `10px` |
| `--font-size-sm` | `12px` |
| `--line-height-solid` | `1` |
| `--line-height-tight` | `1.2` |
| `--font-weight-medium` | `500` |
| `--font-weight-semibold` | `600` |
| `--font-weight-bold` | `700` |
| `--stroke-1` | `1px` |
| `--stroke-2` | `2px` |
| `--color-mix-ratio-subtle` | `14%` |
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `24px` |
| `--space-6` | `32px` |
| `--shadow-pop` | `0 4px 12px rgba(15, 23, 42, 0.08), 0 12px 32px rgba(15, 23, 42, 0.10)` |
| `--shadow-modal` | `0 8px 24px rgba(15, 23, 42, 0.10), 0 24px 64px rgba(15, 23, 42, 0.14)` |
| `--focus-ring` | `0 0 0 2px rgba(74, 87, 214, 0.45)` |
| `--focus-outline` | `2px solid var(--accent)` |
| `--transition-fast` | `120ms ease` |
| `--transition-med` | `160ms ease` |
| `--font-ui` | `system-ui, "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, "Segoe UI", sans-serif` |
| `--font-mono` | `"Cascadia Mono", "JetBrains Mono", "SFMono-Regular", Consolas, monospace` |
| `--font-pixel` | `"NeoDunggeunmo", "Galmuri11", "Galmuri9", "GulimChe", "DotumChe", "MS Gothic", monospace` |
| `--font-serif` | `Georgia, "Noto Serif KR", serif` |
| `--z-below` | `0` |
| `--z-base` | `1` |
| `--z-raised` | `2` |
| `--z-canvas-decor` | `3` |
| `--z-canvas-raised` | `4` |
| `--z-canvas-chrome` | `5` |
| `--z-canvas-chip` | `22` |
| `--z-toolbar` | `40` |
| `--z-rail` | `50` |
| `--z-flyout` | `70` |
| `--z-status` | `80` |
| `--z-popover` | `90` |
| `--z-app-modal` | `2600` |
| `--z-welcome` | `240` |
| `--z-popover-high` | `1200` |
| `--z-popover-top` | `1201` |
| `--z-modal` | `2100` |
| `--z-modal-overlay` | `2200` |
| `--z-modal-top` | `2300` |
| `--z-proposal` | `2500` |
| `--z-toast` | `2700` |
| `--z-tooltip` | `2650` |
| `--brand-blue` | `#4A57D6` |
| `--mix-base` | `#F7F8F8` |
| `--gold` | `#8A6B2F` |
| `--gold-deep` | `#6E5424` |
| `--gold-soft` | `#E8D9A8` |
| `--gold-wash` | `rgba(138, 107, 47, 0.12)` |
| `--bg-well` | `#EEF1F4` |
| `--scrollbar-thumb` | `rgba(15, 23, 42, 0.18)` |
| `--scrollbar-thumb-hover` | `rgba(15, 23, 42, 0.30)` |
| `--empty-icon-bg` | `rgba(74, 87, 214, 0.10)` |
| `--empty-icon-border` | `rgba(74, 87, 214, 0.28)` |
| `--empty-icon-color` | `#4A57D6` |

## 2. 레이어와 표면

표면 하나 = 디렉토리 하나 = 진입 시트 하나 = 레이어 하나 = 그 표면을 마운트하는 TS 한 곳의 import. (스펙 `docs/superpowers/specs/2026-09-11-css-surface-isolation-design.md` §3.1)

| 레이어 (순서) | 디렉토리 | 진입 시트 | import 하는 곳 | 내용 |
|---|---|---|---|---|
| `tokens` | `src/styles/tokens.css` | 자체 | `index.css` | 디자인 토큰. 유일한 `:root` 토큰 정의 위치 |
| `base` | `index.css` 하단 블록 → `src/styles/base/` | `base/index.css` | `index.css` | html/body/스크롤바/selection 등 요소 기본값 |
| `components` | `src/styles/components/` | `components/index.css` | `index.css` | 표면 공용 프리미티브(app-modal, icons, empty-state, grid-4, 버튼 `.btn`) |
| `shell` | `src/styles/shell/` | `shell/index.css` | `index.css` | 톱바·메뉴·좌측 레일·밀도 모드·웰컴·컨텍스트 메뉴 |
| `map` | `src/styles/map/` ← `editor/` 의 맵 관련 시트 이동 | `map/index.css` | `index.css` | 맵 패널·팔레트·캔버스 툴바·region-task·world-panel·map-props·인라인 어시스트 등 맵 편집 표면 |
| `event` | `src/styles/event/` ← `editor/event-editor*` 전부 + storyboard + 서브다이얼로그 | `event/index.css` | `src/editor/panels/eventEditor/modal.ts` | 이벤트 에디터 모달과 그 안의 모든 것 |
| `database` | `src/styles/database/` | `editor-startup-ai.css` (정적 조수 묶음) + `database/index.css` (지연 DB 접미) | `index.css` + `src/editor/panels/databaseModal.ts` | 첫 페인트 조수 패널·컴포저·팀 사이드바와 DB 모달 30탭·스튜디오 |
| `resources` | `src/styles/resources/` | `resources/index.css` | `index.css` | 리소스 매니저 |
| `runtime` | `src/styles/runtime/` + `dialogue.css` | `runtime/index.css` | 기존대로 | 플레이어 런타임. 내용 불변 |
| `overrides` | `src/styles/overrides.css` | 자체 | `index.css` | 표면 경계를 넘어야 하는 예외. 항목마다 이유 주석과 만기일 |

### 서브레이어 함정 — `@layer x { }` 를 "중복이니 정리" 하지 마라

`@import "x.css" layer(components)` 로 들어온 파일이 **내부에서 다시** `@layer components { }`
로 감싸면, 실효 레이어는 `components` 가 아니라 `components.components` **서브레이어**가 된다.
그리고 CSS Cascade 5 §6.4.4 에 따라 **서브레이어는 부모 직속 규칙에게 진다.**

```
@import "a.css" layer(runtime);      a.css 안이 평범하면 → [runtime]        직속
@import "b.css" layer(runtime);      b.css 안이 @layer runtime { } 면 → [runtime.runtime] 서브
                                     같은 선택자·같은 속성이면 a.css 가 이긴다
```

읽는 사람 눈에는 "이미 `layer(runtime)` 인데 한 번 더 적은 멱등 선언"으로 보인다. 아니다.
**래퍼를 지우면 그 파일이 직속으로 승격해서 승자가 뒤집힌다.**

현재 이 모양인 시트 **10개**(2026-09-17 실측, 4개 번들 전수):

| 파일 | 실효 레이어 |
|---|---|
| `components/app-modal.css` | `components.components` |
| `components/empty-state.css` | `components.components` |
| `components/grid-4.css` | `components.components` |
| `map/world-panel.css` | `map.editor` |
| `database/from-editor-world-panel.css` | `database.editor` |
| `runtime/minimap.css` | `runtime.runtime` |
| `runtime/pictures.css` | `runtime.runtime` |
| `runtime/touchpad.css` | `runtime.runtime` |
| `runtime/transitions.css` | `runtime.runtime` |

**오늘 이 10개 때문에 뒤집히는 승자는 0건이다** — 잠복 함정이지 현행 버그가 아니다.
그러나 `runtime/pictures.css` 는 실제로 이 메커니즘에 의존한다: 래퍼를 지우면
`tabs-b-status-menu-main.css` 를 이겨 버려 이미지 픽처에 흰 상자 + 파란 테두리가 돌아온다.
그래서 그 파일 헤더에 «지우지 말 것» 경고가 붙어 있다.

**게이트가 지켜 준다.** `scripts/check-css-winners.mjs` 가 실효 레이어 경로까지 계산하므로
래퍼를 지우면 즉시 잡힌다(실측: pictures.css 래퍼 제거 → 승자 54건 변경, 레이어가
`[runtime.runtime]` 으로 찍혀 원인이 바로 보인다).

레이어 순서 선언은 `index.css` 첫 줄 하나뿐이다:

```css
@layer tokens, base, components, shell, map, event, database, resources, runtime, overrides;
```

## 3. 규칙
- 토큰은 tokens.css 에서만 `:root` 로 정의한다. 다른 파일의 `:root` 재정의 금지.
  **현재 미준수**: `:root` 정의 토큰 262개 중 tokens.css 는 104개뿐이고 158개가
  다른 시트(`runtime/system.css` 44, `editor/core.part-1.css` 33, `dialogue.css` 30,
  `event/shell.css` 26 …)에 흩어져 있다. 게이트는 아직 이걸 강제하지 않는다.
- 표면 사설 토큰은 표면 접두어(`--ev-*`, `--db-*`, `--map-*`, `--shell-*`)를 쓰고 표면 루트 선택자 아래에서만 정의한다(게이트 R4).
- `var(--x)` 는 정의가 있어야 한다. 게이트 R4 가 미정의 참조를 잡는다.
- **브레이크포인트는 토큰이 될 수 없다.** `@media` 조건절은 커스텀 속성을 평가하지 않는다
  (`@media (max-width: var(--bp-md))` 는 무효 쿼리가 되어 규칙이 조용히 죽는다).
  `--bp-*` 4개는 2026-09-17 에 삭제했다 — 참조 0이었고 애초에 쓸 수 없는 토큰이었다.

  **리터럴 폴백(`var(--x, #fff)`)을 쓰지 마라.** 단, 게이트는 아직 이것을 막지 않는다 —
  `check-css-surfaces.mjs:150` 은 리터럴 폴백을 **무조건 통과 조건**으로 취급한다.
  즉 이 규칙은 현재 사람이 지켜야 한다. 왜 위험한지 실측 사례 두 가지:

  1. **토큰이 정의되면 폴백은 죽는다.** 런타임 시트들이 `var(--text-1, #f4f7ff)` 처럼
     다크 폴백을 성실히 적었지만 `--text-1` 이 라이트로 정의돼 있어 한 번도 실행되지
     않았다. 코드는 다크처럼 읽히는데 화면은 라이트였다(2026-09-17, 터치 버튼 대비 1.15:1).
  2. **토큰이 없으면 폴백이 팔레트를 우회한다.** `--border-color` 는 리포 어디에도
     정의가 없어서 `var(--border-color, rgba(42,37,33,0.12))` 의 크림이 그대로 렌더됐다
     (map-props.css 17건). 폐기된 팔레트가 조용히 살아남는 통로다.

  폴백이 필요하면 **토큰으로** 떨어뜨려라: `var(--x, var(--border-default))`.
- 색·간격·그림자 리터럴은 tokens.css 밖에서 쓰지 않는다. 필요하면 토큰을 추가한다.
- `!important` 는 `overrides` 레이어에서만, 이유 주석과 만기일과 함께(게이트 R3).
- "뒤에 와야" 류 순서 주석은 설계 결함 신호다. 레이어 순서로 풀어라(게이트 R6).

## 시네마틱 새 게임 화면 (2026-10-03)

사용자가 선택한 밤색 배경·따뜻한 종이색 인터뷰는 `--cinema-night`, `--cinema-paper`, `--cinema-accent`를 사용한다. 이미지 위 고정 테마용 예외이며 일반 에디터의 쿨 화이트·인디고 토큰은 그대로다. 반투명 표면과 테두리는 이 토큰의 `color-mix`로 파생한다.
