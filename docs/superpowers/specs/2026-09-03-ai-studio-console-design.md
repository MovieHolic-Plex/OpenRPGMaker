# AI 스튜디오 재개편 — 「장면 콘솔」 (2026-09-03)

작성: Claude (AI Bot) · 브랜치 `worried-peacock` · 기준 커밋 `a8b8513c`

## 1. 왜 바꾸나 (실측, 1440×900 · 1280×720)

`topbar-ai-studio` 로 여는 스튜디오(`aiStudioShell.ts` + `08-studio-mode-start-screen.css`)는 세 칸 격자에 내용을
그대로 꽂아 둔 상태다. 스크린샷 `/tmp/studio-shots/before/` 기준:

| 영역 | 지금 | 문제 |
|---|---|---|
| 장면(왼쪽 200px) | 이름 + 「맵/실내」 글자 행 16개 | 썸네일·크기·이벤트 수·시작 맵 표시·검색·새 장면 없음. 어느 맵인지 이름 외 단서 0 |
| 모니터(가운데) | 실제 캔버스 + 좌하단 검은 알약 라벨 + 우상단 줌 3개 | 라벨이 맵을 가림. 장면 정보(크기·칩셋·레이어)와 **나가는 길**이 없다(`onExit` 옵션이 미사용) |
| 조수(오른쪽 380px) | 「조수 / 장면을 만들고 있음」 + 빈 백지 + 입력줄 | 유휴인데 「만들고 있음」. 빈 대화에 안내 0. 입력줄 칩이 잘림(「맥」) |
| 덱(아래 280px) | 글자 탭 3개 + 회색 상자 카드 19개 | 아이콘·분류 없음, 40% 빈 공간. 도구 호출 로그는 `setToolLines` 가 `void` 로 버림 |

시각 문법도 없다: 모든 면이 `--bg-raised` 흰색 + 1px 선, 굵기 700 일색, 반경 8/10 혼용, 아이콘 0.

## 2. 목표

편집기 셸의 단일 테마(쿨 화이트 + 인디고, `DESIGN.md` §2) 안에서 **「바닥 + 섬」** 구성으로 스튜디오를 다시 세운다.
바닥은 `--bg-inset`, 네 영역은 `--bg-raised` 섬(12px), 모니터는 액자. 새 파일·새 hex·새 `!important` 없음
(`check-css-budget.mjs` 래칫). 스튜디오 밖(입력줄 캡슐·톱바·기록)은 손대지 않는다.
에디터 좌측 도크는 스튜디오가 열리면 숨긴다 — 초보 레일 `--z-rail:50` 이
호스트 z-index 40 위에 그려져 장면 레일을 가렸다. `body.ai-studio-open` 에서
`.left-panel` 을 `visibility:hidden` 하고 호스트를 `--z-flyout` 으로 올린다.
장면 레일·조수 열은 52px 까지 접을 수 있고, 실내 자식은 부모 아래 기본 접힘이다.

## 3. 레이아웃 — 스크롤 소유권

```
grid-template-columns: 232px | minmax(0,1fr) | 400px      (≤1280: 208 | 1fr | 360, ≤1024: 176 | 1fr | 320)
grid-template-rows:    minmax(0,1fr) | auto(덱)
```

| 영역 | 고정 | 스크롤 소유자 |
|---|---|---|
| 장면 레일 | 머리(제목·수·＋)·검색 | `.ai-studio-scene-list` |
| 모니터 | 머리띠 44px(장면 이름·메타 칩·줌·나가기) | 없음 — Phaser 캔버스가 스스로 팬 |
| 조수 | 머리(상태 점·이름·상태)·컴포저 | 기존 `.ai-chat-log` |
| 덱 | 탭 띠 40px | `.ai-studio-deck-pane` (접으면 0) |

## 4. 영역별 설계

### 4.1 장면 레일 `ai-studio-scenes`
- 머리: 「장면」(13/600) + 개수(12, `--text-3`) + **＋ 새 장면**(아이콘 버튼, `ai-studio-scene-add`) →
  `addMap("새 장면 N", 20, 15)` 뒤 `selectEditorMap`.
- 검색 `ai-studio-scene-search`: 이름 부분일치, 입력 중엔 폴더를 평탄화. 결과 0 → 「‘q’ 에 맞는 장면이 없습니다」.
- 행 `ai-studio-scene`: 썸네일 56×42(`createMapThumbnail`, testid `ai-studio-thumb-<id>`) · 이름(13/600, 말줄임) ·
  메타 「20×15 · 이벤트 3」(12, `--text-3`) · 배지 「시작」(시작 맵)만. 실내는 배지가 아니라 들여쓰기(`--scene-depth`)와
  `data-kind="interior"` 로만 말한다 — 실측에서 15행에 「실내」 배지가 반복돼 정보가 아니라 소음이었고, 별도 grid 열에
  둔 배지는 208px 폭에서 이름과 겹쳤다(이름 줄 안에 flex 로 넣고 이름만 말줄임). 현재 행 = `--accent-muted` + 왼쪽 2px 인디고 바.
- 폴더 = 그룹 머리(이름 + 자식 수).

### 4.2 모니터 `ai-studio-monitor`
- 머리띠: 장면 이름(15/700, testid `ai-studio-monitor-label` 유지) + 칩 「20×15」「칩셋 이름」「레이어」.
  오른쪽: 입양한 `editor-zoom-controls` · 구분선 · **편집기로**(`ai-studio-exit`, arrowLeft 아이콘) → `options.onExit()`.
- 무대: 캔버스가 나머지를 채운다. 좌하단 알약 라벨 삭제. 캔버스 없으면 아이콘 + 「맵을 여기서 직접 움직입니다」.

### 4.3 조수 `ai-studio-chat`
- 머리: 상태 점 8px(`data-state` idle/busy, busy 는 인디고 + 불투명도 맥동, `prefers-reduced-motion` 존중) +
  「조수」 + 상태 문장. `setStatus("")`/`"대기"` → 「대기 중」.
- **브리핑** `ai-studio-briefing`(로그가 비었을 때만): 「지금 이 장면」 카드 — `readAgentBrief()` 의
  맵 이름·크기·이벤트 수·부족한 것(`deficit`) + `directorStartPrompts` 3개 버튼(클릭 → 입력줄 채움, `onSuggest`).
  로그에 자식이 생기면 사라진다(MutationObserver, 없으면 refresh 시점).
- 컴포저: 「맥락」 칩 잘림의 원인은 visibility 로만 숨어 156px 를 차지하는 키 힌트(`.ai-composer-hint`) —
  스튜디오에서만 `display:none`. 줄바꿈 허용은 오답이었다(360px 열에서 액션 행이 4줄로 늘어 브리핑을 덮음).
  포커스 팝오버의 감독 프롬프트 3개(`ai-composer-chips`)는 브리핑과 같은 문장이라 스튜디오에서 숨긴다.
- 브리핑은 `flex: 0 1 auto; min-height: 0; overflow: auto` — 로그가 빈 동안 전부 보이고, 더 짧을 때만 안에서 스크롤.
  `max-height: 60%` 는 720 높이에서 세 번째 제안을 반쯤 잘랐다(오답).

### 4.4 덱 `ai-studio-deck`
- 탭 띠: 세그먼트(아이콘 + 라벨 + 배지) 도구 · 작업 `done/total` · 변경 `●` · **활동** `n`(새 탭, `ai-studio-tab-activity`).
  오른쪽: 도구 필터 `ai-studio-tool-filter`(도구 탭에서만) · 「모든 도구」(`openToolBrowserModal`) ·
  접기 `ai-studio-deck-collapse`(aria-expanded, `is-collapsed` → 판 숨김).
- 도구 판: 절 「자주 쓰는」(FREQUENT + STUDIO_EXTRA 순서 유지, 첫 카드 = NPC 놓기) + 나머지 카테고리 절.
  카드 = 28px 아이콘 상자(편집 `--accent-muted`/조회 `--control-bg`) + 라벨 13/600 + 모드 12. 격자
  `repeat(auto-fill, minmax(min(132px,100%),1fr))`.
- 작업 판: 목표(13/600) + 진행 `done/total` + 4px 진행 막대 + 층 머리 + 항목(상태 점 + 제목 + 상태 글).
- 변경 판: 기존 `renderChangePreviewCard`. 빈 상태 = 아이콘 + 문장.
- 활동 판 `ai-studio-activity`: `setToolLines` 를 최신순 모노 행으로 실제 표시.

## 5. 시각 문법 (DESIGN.md 「한 문법」 준수)
- 글자: 12 보조 · 13 본문 · 15 제목. 굵기 500/600/700 만. 숫자 `tabular-nums`.
- 반경: 12 섬 · 8 카드 · 6 컨트롤 · 999 점/배지만. 그림자는 모니터 액자에만 `--shadow-pop`.
- 아이콘: `renderEditorIcon`(SVG 16px) 만. 글리프 문자 아이콘 0. 이모지 0.
- 색: 토큰만. 액센트 인디고 하나. 상태는 `--success`/`--danger`/`--warning`.
- 모션: `--transition-fast/med`, transform/opacity 만. 호버 -1px, 눌림 scale(.98).

## 6. 계약 유지
`ai-studio-shell/scenes/monitor/chat/deck/composer/tab-*/tool-grid/tool-card/work-item/scene` testid,
`attach/detach` 가 로그·입력줄을 원위치, 「NPC 놓기」 첫 카드, 빈 안내 두 문장, 「빈 맵」 행, `Canonical` 부재,
`ai-studio-monitor-thumb` 부재. `aiLogSlot`·`aiPanelChrome` 의 토글 계약 무변.

## 7. 검증
- `test/aiStudioShell.test.ts` 확장(검색·새 장면·나가기·상태·활동·접기·진행률·브리핑).
- `npm run typecheck:app` 0 · `npm run gates -- --only css` 기준선 대비 새 실패 0.
- 스크린샷 1440×900 · 1280×720 · 1920×1080 전후 비교(`/tmp/studio-shots/{before,after}`), 잘림·겹침 실측.
