# rpg-zzu 디자인 토큰 가이드

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
| `--bp-sm` | `640px` |
| `--bp-md` | `900px` |
| `--bp-lg` | `1280px` |
| `--bp-xl` | `1488px` |
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
| `database` | `src/styles/database/` | `database/index.css` | `src/editor/panels/databaseModal.ts` | DB 모달 30탭·조수 패널·스튜디오 |
| `resources` | `src/styles/resources/` | `resources/index.css` | `index.css` | 리소스 매니저 |
| `runtime` | `src/styles/runtime/` + `dialogue.css` | `runtime/index.css` | 기존대로 | 플레이어 런타임. 내용 불변 |
| `overrides` | `src/styles/overrides.css` | 자체 | `index.css` | 표면 경계를 넘어야 하는 예외. 항목마다 이유 주석과 만기일 |

레이어 순서 선언은 `index.css` 첫 줄 하나뿐이다:

```css
@layer tokens, base, components, shell, map, event, database, resources, runtime, overrides;
```

## 3. 규칙
- 토큰은 tokens.css 에서만 `:root` 로 정의한다. 다른 파일의 `:root` 재정의 금지(게이트 R4).
- 표면 사설 토큰은 표면 접두어(`--ev-*`, `--db-*`, `--map-*`, `--shell-*`)를 쓰고 표면 루트 선택자 아래에서만 정의한다(게이트 R4).
- `var(--x)` 는 정의가 있거나 토큰으로 떨어지는 폴백이 있어야 한다. 리터럴 폴백(`var(--x, #fff)`) 금지(게이트 R4).
- 색·간격·그림자 리터럴은 tokens.css 밖에서 쓰지 않는다. 필요하면 토큰을 추가한다.
- `!important` 는 `overrides` 레이어에서만, 이유 주석과 만기일과 함께(게이트 R3).
- "뒤에 와야" 류 순서 주석은 설계 결함 신호다. 레이어 순서로 풀어라(게이트 R6).
