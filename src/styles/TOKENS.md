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
| `--text-3` | `#566179` |
| `--text-placeholder` | `#566179` |
| `--text-disabled` | `#94A3B8` |
| `--accent` | `#4A57D6` |
| `--accent-hover` | `#3C48C4` |
| `--accent-active` | `#2F3AAE` |
| `--accent-muted` | `rgba(74, 87, 214, 0.12)` |
| `--accent-border` | `rgba(74, 87, 214, 0.45)` |
| `--on-accent` | `#ffffff` |
| `--cinema-night` | `#101a29` |
| `--cinema-paper` | `#fff9eb` |
| `--cinema-accent` | `#edcea0` |
| `--danger` | `#B5302E` |
| `--danger-muted` | `rgba(198, 64, 61, 0.13)` |
| `--success` | `#18764F` |
| `--success-muted` | `rgba(24, 118, 79, 0.13)` |
| `--warning` | `#7A5300` |
| `--warning-muted` | `rgba(138, 94, 0, 0.13)` |
| `--black-soft` | `#0F172A` |
| `--white-soft` | `#F8FAFC` |
| `--radius-s` | `6px` |
| `--radius-m` | `10px` |
| `--radius-l` | `14px` |
| `--radius-pill` | `999px` |
| `--radius-1` | `4px` |
| `--radius-2` | `6px` |
| `--radius-3` | `10px` |
| `--radius-4` | `14px` |
| `--font-floor` | `12px` |
| `--font-12` | `12px` |
| `--font-13` | `13px` |
| `--font-14` | `14px` |
| `--font-16` | `16px` |
| `--font-18` | `18px` |
| `--font-22` | `22px` |
| `--font-28` | `28px` |
| `--font-size-xs` | `var(--font-floor)` |
| `--font-size-sm` | `var(--font-12)` |
| `--hit-min` | `32px` |
| `--hit-min-dense` | `28px` |
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
| `--focus-color` | `var(--accent)` |
| `--focus-ring` | `0 0 0 2px var(--focus-color)` |
| `--focus-outline` | `2px solid var(--focus-color)` |
| `--focus-offset` | `2px` |
| `--transition-fast` | `120ms ease` |
| `--transition-med` | `160ms ease` |
| `--font-ui` | `system-ui, "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, "Segoe UI", sans-serif` |
| `--font-mono` | `"Cascadia Mono", "JetBrains Mono", "SFMono-Regular", Consolas, monospace` |
| `--font-pixel` | `"NeoDunggeunmo", "Galmuri11", "Galmuri9", "GulimChe", "DotumChe", "MS Gothic", monospace` |
| `--font-serif` | `Georgia, "Noto Serif KR", serif` |
| `--font-pixel-text` | `"Galmuri11 Regular", var(--font-pixel)` |
| `--font-pixel-title` | `"Galmuri11 Bold", Galmuri9, monospace` |
| `--font-pixel-small` | `"Galmuri9", "Noto Sans CJK KR", "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif` |
| `--font-pixel-legacy` | `"Galmuri11", "NeoDunggeunmo", monospace` |
| `--font-mono-system` | `monospace` |
| `--font-sans-system` | `sans-serif` |
| `--font-system-ui` | `system-ui, sans-serif` |
| `--font-serif-myeongjo` | `'Noto Serif KR', 'Nanum Myeongjo', 'Batang', Georgia, serif` |
| `--font-title-display` | `"Cinzel", "Trajan Pro", "Cormorant SC", Georgia, "Noto Serif KR", serif` |
| `--font-title-menu` | `"Cinzel", "Trajan Pro", Georgia, var(--font-ui), serif` |
| `--z-below` | `0` |
| `--z-base` | `1` |
| `--z-raised` | `2` |
| `--z-canvas-decor` | `3` |
| `--z-canvas-raised` | `4` |
| `--z-canvas-chrome` | `5` |
| `--z-canvas-chip` | `22` |
| `--z-canvas-veil` | `30` |
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
| `--z-dropdown` | `var(--z-popover-high)` |
| `--z-overlay` | `var(--z-modal-overlay)` |
| `--z-dialog` | `var(--z-app-modal)` |
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

## 4. 척도 (HIG 기반, 2026-10-28)

새 규칙은 아래 척도만 쓴다. 옛 이름(`--radius-s/m/l`, `--font-size-xs/sm`)은 같은 값의 별칭으로 남아 있다.

- **글자 척도** — `--font-12` `--font-13` `--font-14` `--font-16` `--font-18` `--font-22` `--font-28` 일곱 단계,
  바닥은 `--font-floor`(12px). 편집기 크롬 글자는 12px 아래로 내려가지 않는다. 본문 13, 주 라벨 14,
  창 제목 16, 큰 제목 18 이상. `--font-size-xs` 는 10px 였고 이제 바닥(12px)을 가리킨다.
  저작된 게임 화면(런타임 스킨·도트 글꼴)은 이 바닥의 대상이 아니다.
- **표적 크기** — `--hit-min`(32px) 은 포인터 표적의 하한, `--hit-min-dense`(28px) 는 표·목록 안처럼
  촘촘한 줄에서만 쓴다. 글리프를 키우지 말고 `min-height`/`min-width`·패딩으로 맞춘다. 터치 배치는 44px.
- **반경** — `--radius-1`(4) `--radius-2`(6) `--radius-3`(10) `--radius-4`(14) 와 `--radius-pill`.
  그림(아이콘 도트)의 원은 `50%` 를 그대로 쓴다.
- **층** — 의미 이름 `--z-dropdown`·`--z-popover`·`--z-overlay`·`--z-dialog`·`--z-toast`·`--z-tooltip`.
  새 규칙은 숫자 z-index 리터럴(특히 1000 이상)을 쓰지 않는다.
- **장식 효과 금지** — 편집기 크롬(톱바·도크·패널·대화창)에는 장식 그라데이션, `backdrop-filter` 흐림,
  무한 반복 애니메이션을 새로 넣지 않는다. 진행 표시(로더·스피너)와 저작된 게임 화면만 예외다.
- **흑백** — 순흑·순백 리터럴(`#000`/`#fff`) 대신 `--black-soft`·`--white-soft` 를 쓴다.
- **대비** — `--text-1/2/3`·`--text-placeholder` 는 모든 바탕 토큰과 `--bg-hover`·`--bg-active`·
  `--control-bg-active` 위에서 4.5:1 이상, 상태 글자(`--danger`·`--warning`·`--success`)는 자기 `-muted` 위에서 4.5:1 이상.

## 5. 포커스·테마·움직임

- **포커스** — `--focus-color`(accent), `--focus-ring`(2px 불투명 링), `--focus-outline`, `--focus-offset`.
  `base/index.css` 의 `:focus-visible` 이 앱 공통 링이다. 표면이 `outline: none` 을 쓰면 반드시
  `box-shadow: var(--focus-ring)` 을 함께 둔다. 링은 배경 대비 3:1 이상이고 호버와 달라야 한다.
- **다크** — `base/theme.css` 가 OS 다크(`prefers-color-scheme: dark`)를 따라 토큰 값을 덮는다.
  `html[data-theme="light"]` 는 라이트로 고정한다. tokens.css 는 내보낸 게임(player.css)도 읽으므로
  다크 값은 편집기만 읽는 base 쪽에 둔다. 리터럴 색을 쓴 표면은 다크에서 따라오지 않는다 — 토큰으로 옮긴다.
- **강제 색** — 같은 파일의 `forced-colors` 블록이 반투명 칠 토큰을 투명·Canvas 로 바꾸고,
  `overrides.css` 가 흐림(`backdrop-filter`)을 끈다.
- **동작 줄이기** — `overrides.css` 의 `prefers-reduced-motion` 블록이 편집기 크롬의 전환·애니메이션을
  즉시 끝낸다(테스트 플레이 창 안의 게임 화면은 제외).
- **한국어 줄바꿈** — `:root:lang(ko)` 가 `word-break: keep-all` 을 상속시킨다. 칸이 좁아도 어절 안에서 끊지 않는다.

## 6. 공용 아이콘

`src/styles/components/icons.css` 의 `.ui-icon` 한 벌(선 2px, 둥근 끝, currentColor 마스크)을 쓴다.
`<span class="ui-icon" data-icon="close" aria-hidden="true"></span>`, 20px 는 `.ui-icon--20`.
이름: play stop pause spark minus plus more close check chevron-down/up/left/right arrow-up/down/left/right
search tool palette warning info help trash edit external menu refresh save folder map settings user lock eye copy.
그림문자(▶ ✦ − + ⋯ × 🔎 🛠 🎨 …)를 아이콘 대신 쓰지 않는다. 버튼에 글자가 없으면 `aria-label` 을 주면
공용 지연 툴팁이 그 이름으로 뜬다(`installDelayedTooltips`).
