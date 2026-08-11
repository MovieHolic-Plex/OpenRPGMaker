# rpg-zzu 디자인 토큰 가이드 (UI-0 파운데이션)

**대상:** UI-1~4 영역 에이전트 (database A/B, 맵 에디터, 리소스/다이얼로그)
**원본:** `src/styles/tokens.css` (단일 진실 공급원, index.css 최상단에서 import)
**방향:** 모던 다크 IDE (VS Code / Figma / Linear 계열). 배경 계층 대비 + 은은한 1px 보더, 인디고 액센트 1색.

## 1. 토큰 목록

### 배경 (어두운 순: canvas < inset < base < surface < raised < overlay)
| 토큰 | 값 | 용도 |
|---|---|---|
| `--bg-base` | `#0f1117` | 앱 셸 최하층 (body, 메뉴바) |
| `--bg-surface` | `#151823` | 패널/사이드바/툴바/스테이터스바 |
| `--bg-raised` | `#1c202d` | 카드, **다이얼로그/모달 본문**, 떠 있는 패널 |
| `--bg-overlay` | `#232838` | 팝오버/드롭다운/컨텍스트 메뉴 |
| `--bg-inset` | `#0c0e14` | **인풋 웰, 리스트 웰**, 움푹한 영역 |
| `--bg-canvas` | `#0a0c11` | 맵/게임 캔버스 뒤 우물 |
| `--bg-glass` | `rgba(24,28,40,.88)` | 캔버스 위 반투명 플로팅 툴바 |

### 인터랙션 상태 (반투명 오버레이 — 아무 배경 위에나 얹는다)
| 토큰 | 용도 |
|---|---|
| `--bg-hover` / `--bg-active` | 리스트행·메뉴항목·탭의 hover / 눌림·유사선택 |
| `--control-bg` / `--control-bg-hover` / `--control-bg-active` | 버튼 등 컨트롤의 기본면 / hover / active |

### 보더 · 텍스트
| 토큰 | 용도 |
|---|---|
| `--border-subtle` | 패널 구분선, 섹션 경계 (rgba 흰색 7%) |
| `--border-default` | 컨트롤/카드 기본 보더 (11%) |
| `--border-strong` | hover 보더, 강조 구분 (17%) |
| `--text-1` / `--text-2` / `--text-3` | 본문·제목 / 보조 라벨 / 흐린 힌트·비활성 |

### 액센트 · 상태
| 토큰 | 용도 |
|---|---|
| `--accent` `#7b87f5` | 선택/주요 액션 (인디고) |
| `--accent-hover` / `--accent-active` | hover / 눌림 |
| `--accent-muted` | 선택 행·탭 배경 (16% 알파) |
| `--accent-border` | 선택 컨트롤 보더 (55% 알파) |
| `--on-accent` | 액센트 배경 위 텍스트 (#fff) |
| `--danger` / `--danger-muted` | 파괴적 액션 / 그 배경 |
| `--success` / `--success-muted`, `--warning` / `--warning-muted` | 상태 배지 |

### 지오메트리 · 기타
| 토큰 | 값 |
|---|---|
| `--radius-s / m / l` | 6 / 10 / 14px — 버튼·인풋 / 카드·팝오버 / 모달 |
| `--space-1..6` | 4 / 8 / 12 / 16 / 24 / 32px |
| `--shadow-pop` / `--shadow-modal` | 팝오버 / 모달 그림자 |
| `--focus-ring` | `box-shadow: var(--focus-ring)` 용 / `--focus-outline` = `2px solid var(--accent)` |
| `--transition-fast / med` | 120ms / 160ms ease |
| `--font-ui` / `--font-mono` | system-ui+Pretendard 스택 / 모노 (외부 폰트 로드 금지) |
| `--scrollbar-thumb(-hover)` | 스크롤바 — 전역 기본이 index.css 하단에 이미 있음 (thin+라운드) |

## 2. 레거시 변수 브리지 (그대로 두면 자동으로 모던 다크가 된다)

기존 코드가 쓰는 레거시 변수는 전부 토큰 별칭으로 리매핑돼 있다:

- `editor/core.part-1.css :root` — `--bg`, `--bg-panel(-2)`, `--bg-elev`, `--border(-soft)`, `--text(-dim/-muted)`, `--surface-workbench/panel/recessed/selected`, `--text-primary/secondary/inverse`, `--accent-primary`, `--status-*`, `--radius(-sm)`, `--shadow-popover` → 토큰 별칭
- `database/tabs-b-shell-layout.css :root` — 과거 Win2k 라이트 팔레트였으나 **동일 토큰 별칭으로 교체됨** (전역 :root 라 앱 전체에 영향 있었음)
- `shell/figma-editor.css :root` — `--editor-*` 전부 토큰 별칭
- `--accent`, `--accent-hover`, `--danger`, `--border-default`, `--border-strong`, `--space-1..4`, `--font-mono` 는 **tokens.css 가 직접 정의** — 다른 파일 :root 에서 재정의 금지 (전역 클로버 발생)

즉 var 기반 규칙은 손대지 않아도 다크로 넘어와 있다. **여러분이 할 일은 하드코딩 hex/rgba (베이지 #e5dfd0, #d4d0c8, 베벨 `#6c6c6c #fff #fff #6c6c6c`, 라이트 텍스트-온-라이트 등) 를 토큰으로 치환**하고 낡은 베벨/각진 룩을 아래 패턴으로 바꾸는 것.

## 3. 컴포넌트 패턴

```css
/* 버튼 (기본) */
background: var(--control-bg);
border: 1px solid var(--border-default);
border-radius: var(--radius-s);
color: var(--text-1);
transition: background var(--transition-fast), border-color var(--transition-fast);
/* hover: */ background: var(--control-bg-hover); border-color: var(--border-strong);
/* primary/선택: */ background: var(--accent); border-color: var(--accent-border); color: var(--on-accent);
/* danger: */ color: var(--danger); /* hover 시 */ border-color: var(--danger); background: var(--danger-muted);

/* 인풋/셀렉트 */
background: var(--bg-inset);
border: 1px solid var(--border-default);
border-radius: var(--radius-s);
color: var(--text-1);
/* focus: */ border-color: var(--accent); outline: 2px solid var(--accent-muted);

/* 리스트 행 */
border-radius: var(--radius-s); color: var(--text-2);
/* hover: */ background: var(--bg-hover); color: var(--text-1);
/* 선택: */ background: var(--accent-muted); color: var(--text-1);

/* 탭 */
/* 비활성: */ color: var(--text-2); border-bottom: 2px solid transparent;
/* 활성: */ color: var(--text-1); border-bottom-color: var(--accent);
/* (버튼형 탭이면 background: var(--accent-muted) + border var(--accent-border)) */

/* 모달/다이얼로그 */
background: var(--bg-raised);
border: 1px solid var(--border-strong);
border-radius: var(--radius-l);
box-shadow: var(--shadow-modal);
/* 팝오버/드롭다운: --bg-overlay + --radius-m + --shadow-pop */

/* 상태 배지 */
background: var(--success-muted); border: 1px solid var(--success); color: var(--success);
```

## 4. 금지사항 (전 영역 공통)

1. **하드코딩 hex/rgba 색 금지** — 반드시 토큰(또는 브리지된 레거시 변수) 사용. 예외: 게임 아트웍 위 기능적 마커가 꼭 필요할 때만 최소한으로.
2. **클래스명/testid/DOM 구조 변경 금지.** 선택자 추가는 가능, 삭제·개명 금지. TS 수정 원칙 금지.
3. **:root 에서 `--accent`, `--danger`, `--bg`, `--text` 같은 공용 이름 재정의 금지** — 전역 스코프라 앱 전체가 물든다. 영역 전용 변수는 `--rm2k3-enemy-*` 처럼 네임스페이스 프리픽스.
4. **외부 리소스(웹폰트/CDN) 금지** — 오프라인 LAN 환경.
5. 레이아웃 치수(width/height/inset/grid 골격)는 보수적으로 — 색/보더/라운드/그림자/타이포 중심.
6. `src/styles/runtime/` 와 `dialogue.css` 의 인게임 런타임 look 은 에디터 셸 토큰과 분리한다. 런타임 게임 표면은 `src/styles/runtime/system.css` 의 `--runtime-*` 토큰(픽셀 폰트, 9-slice 윈도우 스킨)을 사용하고, 모던 다크 에디터 토큰을 창 프레임/폰트에 끌어오지 않는다.
7. `database/tabs-b-assistant-panel.css` 는 p2-assistant 소유 — 건드리지 말 것.

## 5. 런타임 대화창

인게임 대화 표면은 `src/styles/runtime/system.css`의 `--runtime-dialogue-*` 토큰을 사용한다. 에디터 셸의 `--bg-*`나 `--accent`를 직접 가져오지 않는다.

- 기본 창: `--runtime-dialogue-glass-surface` 위에 얕은 세로 명암, 1px `--runtime-dialogue-glass-border`, `--runtime-dialogue-radius`, `--runtime-dialogue-glass-shadow`.
- 화자 이름표: 같은 표면의 작은 직사각형 탭. 본문과 겹치지 않도록 `--runtime-dialogue-speaker-inset`을 함께 조정한다.
- 얼굴: 일반 faceset은 48×48 칩, `-bust`/`-portrait`는 88×112 버스트, `-full`/`fullbody`는 92×164 전신으로 표시한다. 좌우 배치에 따라 본문 예약 공간을 반대로 적용한다.
- 선택지·숫자 입력·소지금 창: 같은 표면과 보더를 공유한다. 현재 선택 행은 `--runtime-dialogue-glass-accent-soft`와 좌측 다이아몬드로 표시한다.
- 투명 모드: 배경·블러·그림자를 제거하되 데이터 및 상/중/하단 위치 계약은 그대로 유지한다.
- 에디터 명령 프리뷰의 `.ecp-message-window`도 같은 런타임 토큰을 사용해 실제 플레이와 재질을 맞춘다.
