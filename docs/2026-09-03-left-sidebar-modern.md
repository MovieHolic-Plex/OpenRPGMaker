# 2026-09-03 좌측 사이드바 모던화 — 타일 시트 폭 채움 · 맵 도크 자동 높이 · 크롬 통일

- 작성: AI Bot (Claude) · 브랜치 `maniacal-blowfish`
- 대상: 표준·전문가 모드 좌측 도크(타일 팔레트 + 맵 트리). 초보 레일·플라이아웃은 공용 행 규칙만 간접 영향.
- 증거: `docs/2026-09-03-left-sidebar-modern-assets/` (1440×900 표준, 1280×800 전문가, 맵 16개 프로젝트)

## 1. 지적과 실측

| 지적 | 실측(변경 전, 1440×900 표준) | 원인 |
|---|---|---|
| 「타일이 덜 깔린다」 | 칸 32px 고정 → 6열 202px, 시트 폭 263px 의 오른쪽 ~60px 이 빈 띠. 시트 275px 에 191칸 중 48칸만 보임 | `--chipset-cell: min(32px, …)` 상한. 시트 아래 맵 도크가 300px 고정으로 세로를 가져감 |
| 「맵이 기능적으로 불완전」 | 맵 1개인데 도크 300px, 3분의 2가 빈 칸. 헤더 아이콘 5개가 같은 무게. 목록에 스크롤 컨테이너가 없어 맵이 늘면 헤더 아래로 잘림(호스트 overflow:hidden) | 높이가 데이터가 아니라 상수(`MAP_TREE_DEFAULT_HEIGHT`)였고 접는 길이 없었다 |
| 「UI/UX 가 맘에 안 든다」 | 패널·시트·도구막대 테두리 3중, 라운드 0/4/5/6px 혼재, 채운 파란 도구 + 빨간 배지 경쟁, 텍스트 글리프(⚙ ▸) | 네 세대 시트(figma-editor/03·08·09, shell-density, editor-ui-modes)가 겹쳐 그리고 아무도 마지막 발언자가 아니었다 |

## 2. 바꾼 것

### 타일 도크
- 칸 크기를 폭에서 계산: `--chipset-cell: min(56px, calc((100cqi - 16px) / 6))`. 6열 계약은 그대로.
- 시트는 테두리 없는 우묵한 면(`--bg-inset`, 10px 라운드), 남는 세로는 시트 하나가 가져간다(다른 줄은 `flex: 0 0 auto`).
- 도구막대: 상자 제거, 고른 도구는 인디고 틴트. 가로 스크롤 대신 줄바꿈 — 맵 모드 4개는 오른쫽 정렬.
- 레이어 전환: 세그먼트 컨트롤(트랙 위 흰 카드). 검색 30px 우묵한 입력 + `#` 토글. 분류 칩은 pill, 줄바꿈 허용.
- 붓 보조·집 킷: 상자 대신 헤어라인 한 줄, 같은 30px 리듬.

### 맵 도크
- **자동 높이**(`mapTreeAuto`, 기본 true): 헤더 + 필터 + 행 합을 재서 clamp(150px, min(320px, 좌패널 40%, 타일 시트에 280px 를 남기는 값)). 마지막 항이 핵심이다 — 맵 16개에서 상한만으로는 시트가 197px 로 눌렸다(e2e `palette-tiles-come-first` 260px 하한 위반). 리사이저 드래그/키보드 → 수동, 더블클릭 → 자동. 옛 저장본은 300 이면 자동, 다른 값이면 수동으로 읽는다.
- **섹션 접기**: 제목 「맵 N」이 토글(`map-tree-section-toggle`, `aria-expanded`). 접으면 헤더 한 줄만 남고 시트가 그 높이를 가져간다. localStorage 에 남는다.
- 헤더: 「새 맵」에 글자 라벨 + 인디고 틴트, 맨 오른쪽. 나머지(필터·분류·시작·전체 접기)는 28px 아이콘 고스트.
- 목록이 실제 스크롤 컨테이너(`.map-tree-list { flex:1; overflow-y:auto }`).

### 소유권
- 새 시트 `src/styles/editor/left-sidebar.modern.css` 한 장이 마지막 발언자. hex 0 · `!important` 0.
- `figma-editor/10-map-tree.css` 삭제(살아 있던 팔레트 규칙은 새 시트 §8, 캔버스 셸 규칙은 `11-canvas-toolbar-uxc.css`). CSS 파일 수 변화 0.
- 상태 모듈 `src/editor/workspace/mapPanelSection.ts`(접힘), `editor.ts`(자동 높이·측정·관찰자).

## 3. 전후 실측 (1440×900 표준, 맵 1개)

| 항목 | 전 | 후 |
|---|---|---|
| 타일 칸 | 32px | 40.2px |
| 그리드 폭 / 시트 폭 | 202 / 263px (빈 띠 ~60px) | 257 / 267px (빈 띠 = 스크롤바 거터 10px) |
| 시트 높이 | 275px | 384px |
| 한눈에 보이는 타일 | 48칸 | 54칸 (칸은 1.58배 크기) |
| 맵 도크 높이 | 300px 고정 | 150px (맵 1개) · 254px (맵 16개, 시트 280px 확보) · 46px (접힘) |
| 도구막대 | 1줄 30px, 4개 도구 가로 스크롤 뒤에 숨음 | 2줄 58px, 11개 전부 노출 |

## 4. 중간 스크린샷 (의도한 순서)

1. `before-standard-1440.png` · `before-left-panel.png` — 변경 전.
2. `step1-css-only-before-autofit.png` — 시트·크롬만 바꾼 상태. 맵 도크가 여전히 305px: 자동 측정이 `scrollHeight` 를 읽어 **지금 높이를 되받는** 결함(목록이 `flex:1` 스크롤 컨테이너라 상자 크기를 따라감). 행 합으로 고침.
3. `step2-toolbar-overlap-defect.png` — 줄바꿈한 도구막대 둘째 줄이 레이어 전환 위로 겹침. 옛 `min-height:30px` 가 flex 자동 최소 높이를 대체해 도구막대가 30px 로 눌린 것. `flex: 0 0 auto` 로 고침.
4. `after-standard-1440.png` · `after-left-panel.png` · `after-expert-left-1280.png` — 결과.
5. `after-16-maps-autofit.png` · `after-map-section-collapsed.png` — 맵 16개 자동 높이(254px, 목록 스크롤, 시트 280px) · 접힘(46px).

## 5. 검증

- `npm run typecheck:app` 0 에러.
- vitest: `mapPanelSection`(신규 2) · `mapList`(신규 3 포함 19) · `leftDockPanels` · `editorMenuSidebarIa` · `tilePaletteGridRoving` · `editorLayoutPersist`(신규 2 포함) · `rightDragPanelRebuilds` — 전부 통과.
- CSS 게이트: `check-css-graph` 통과, `check-css-live-classes` 통과. `check-css-budget` 는 **기준선(2026-08-30)이 main 보다 낡아** hex +27 · 파일 +1 등이 뜨지만 전부 다른 파일(party-ux-fixes, scratch-concept, region-task…) — 이 변경의 기여는 hex 0 · `!important` 0 · 파일 ±0.
- e2e(`DEV_SERVER_PORT` 를 명령에 박고 내 서버로): `map-panel-modern`(16) · `map-tree-thumbnails` · `palette-tiles-come-first` 통과, 부팅 타임아웃 재시도로 통과한 flaky 1~2건은 부하(동시 `npm run gates`) 탓. `editor-map-focused-shell` 은 삭제된 `menu-map` 을 기대하는 선행 실패.
- `npm run gates`: typecheck 0 · vitest 기준선 대비 새 실패 0 · 회귀로 보고된 2건(css 예산 래칫, 이벤트 편집기 표면 스냅샷 3축)은 깨끗한 HEAD 워크트리(`/tmp/mb-base`)에서도 같은 3축이 실패해 선행 상태로 확정.

## 6. 남긴 것

- 초보 모드 맵 플라이아웃을 열면 캔버스(WebGL) 하단 가운데에 150×150 흰 사각형이 그려진다(변경 전부터, DOM 요소 아님). 이 변경과 무관해 손대지 않았다.
- 800px 높이 뷰포트에서 시트가 217px 로 여전히 짧다. 선택 칩·검색·분류를 한 줄로 합치면 60px 을 더 벌 수 있지만 정보 손실이 있어 보류.
