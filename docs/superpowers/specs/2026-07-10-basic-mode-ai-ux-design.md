# 기본 모드 AI UX 극대화 + 사이드바 심플화 + 전문가 모드 1024px 대응 — 디자인 스펙
> 이 문서는 2-모드(기본/전문가) 시대 설계 기록이다. 현행 3-모드(초보/표준/전문가) 규격은 openwiki/editor-pre-edit-routing.md 를 참조하라.

- 생성일: 2026-07-10
- 작성자: Claude (브레인스토밍 세션, 사용자 승인 완료)
- 기준 브랜치: feat/event-command-edit-modal (구현 브랜치는 계획 단계에서 결정)
- 접근 전략: **A안 — 표면 확장** (기존 자산 활용, 셸 구조 리팩터 없음, 단계별 배포 가능)

## 1. 배경과 목표

실측(1440/1024/860px Playwright 스크린샷) 기준 문제:

- **기본 모드**: 좌측 레일의 '도구'가 텍스트 버튼 6개를 세로로 쌓아 ~300px 소모. 타일·레이어·맵 트리까지 합치면 좌측 컬럼이 ~420px. AI 패널은 시작 화면 아래 빈 공간이 크고, 캔버스 인라인 어시스트가 없어 AI와의 상호작용이 채팅 패널에 갇혀 있음.
- **전문가 모드 (≤1024px)**: 메뉴바 라벨 두 줄 꺾임, 클래식 툴바 아이콘 우측 잘림, 좌패널 탭 줄바꿈, 맵 트리 이름 안 보임, 채팅 '보내기' 버튼 잘림, 줌 툴바와 잠금 배너 겹침, 상태바 잘림.

목표(사용자 확정):

1. 기본 모드 AI 어시스턴스 방향 = **캔버스 인라인 어시스트 + 입력창/커맨드 중심 강화**
2. 좌측 사이드바 = **슬림 아이콘 레일(~48px) + 플라이아웃** (VSCode식)
3. 전문가 모드 = **1024px까지 전 기능 정상 표시 보장**, 그 미만은 자동 접힘으로 우아한 저하

## 2. 섹션 1 — 슬림 아이콘 레일 + 플라이아웃 (기본 모드 전용)

`src/editor/panels/basicLeftRail.ts` 재작성. 전문가 모드 좌패널은 불변.

### 레일 (~48px 고정폭)

- 상단: 도구 6개 아이콘 — 선택·브러시·지우개·채우기·이벤트·스포이트.
  - 기존 `data-testid="tool-{id}"`·aria-label 유지 (E2E 보존).
  - 활성 도구 파란 하이라이트, 툴팁에 이름+단축키 표기.
  - 클릭 동작은 현행 로직 승계 (브러시→paintShape pen, 이벤트→layer event 동반 전환).
- 구분선 아래 패널 토글 3개:
  - **타일**: 아이콘 자리에 현재 선택 타일의 실제 썸네일 표시. 클릭 → 타일 플라이아웃.
  - **레이어**: 아이콘 + 현재 레이어 축약 뱃지(이벤트/오브젝트/타일). 클릭 → 레이어 플라이아웃.
  - **맵**: 클릭 → 맵 트리 플라이아웃 (기존 `renderMapList` 재사용).

### 플라이아웃

- 레일 오른쪽 ~300px 팝오버 오버레이. **캔버스 리사이즈 없음** (WebGL 리플로우 회피).
- 바깥 클릭/Esc 닫힘. 핀(📌) 토글로 고정 유지.
- 타일 선택 시 브러시 도구 자동 전환(현행 유지), 캔버스 클릭 시 닫힘(핀 제외).
- 이벤트 레이어에서 타일 토글은 비활성 힌트 (현행 `basic-event-layer-hint` 승계).
- 한 번에 하나의 플라이아웃만 열림.

### 흡수/제거

- 현행 기본 모드의 텍스트 도구 리스트, 인라인 타일 그리드(BASIC_TILE_CAP 48), 레이어 리스트, 하단 맵 트리 컬럼 → 전부 레일+플라이아웃으로 이동. 캔버스 가용폭 +약 370px.
- `editorUiMode.chromeForMode`의 basic `mapTree: true` 의미는 "맵 전환 가능"으로 유지하되, 렌더 위치가 좌측 컬럼 → 플라이아웃으로 변경.

## 3. 섹션 2 — 캔버스 인라인 어시스트

기존 자산 노출: `regionRightDrag`(우클릭 드래그 영역), `regionTask`(clipMapCellsToRegion 하드 스코프), `agentGhostPreview`, `aiSelectionContext`.

### 2-A. 선택 액션 칩

- 선택 도구 영역 선택(또는 우클릭 드래그 영역) 시 영역 우하단에 플로팅 칩 바:
  `[✨ AI 작업…] [🏠 여기에 구조물] [🎨 자연스럽게 다듬기]`
- `✨ AI 작업…` → 기존 `regionTaskModal` 오픈. 프리셋 칩 2개는 영역+프롬프트 템플릿 즉시 실행.
- 칩 구성은 상수 배열(`id/label/promptTemplate`)로 정의.
- Esc/선택 해제 시 제거. `--editor-left-safe` 준수로 레일/패널과 비겹침.

### 2-B. 제안 인라인 승인

- AI 제안 고스트 프리뷰 경계 상단에 미니 툴바: `[✓ 적용] [✗ 거부] [상세 보기]`
- 채팅 제안 카드와 **동일 핸들러** 배선 (수락 = draft→store→projectLint 게이트→undo 체크포인트 경로 그대로).
- '상세 보기' = 채팅 패널 해당 카드로 스크롤+포커스.
- 프리뷰 다수·겹침 시 하나로 묶어 카운트 표시.

### 2-C. 진행 중 배지

- 영역 AI 작업 진행 중: 해당 영역 반투명 테두리 + "AI 작업 중…" 배지 (region task 상태 이벤트 구독). 완료 시 2-B 프리뷰로 전환.

## 4. 섹션 3 — 통합 커맨드 팔레트 + 입력창 강화

### 3-A. Ctrl+K 통합 팔레트

- 현행 스킬 전용 팔레트(`aiSkillDrawer.openSkillPalette`)를 소스 3종으로 확장:
  1. **스킬** (기존)
  2. **에디터 명령** — 도구/레이어 전환, 기본↔전문가 모드, 실행(테스트 플레이), 데이터베이스, 리소스 관리. 명령 레지스트리 상수(`id/label/keywords/run()`).
  3. **맵 이동** — 맵 이름 검색 → 전환.
- UI: 카테고리 그룹 헤더, ↑↓ 탐색 + Enter 실행(현행 '첫 항목 Enter' 개선), 단순 포함 매칭(초성 매칭 비목표).
- 캔버스 포커스 상태에서도 열리도록 document 레벨 바인딩 정리.

### 3-B. 도구 단축키

- V(선택)·B(브러시)·E(지우개)·G(채우기)·N(이벤트)·I(스포이트) — `hotkeys.ts` 추가. 입력창/텍스트 필드 포커스 중 무시. 레일 툴팁·팔레트에 표기.

### 3-C. 입력창 컨텍스트 강화

- 선택 영역 존재 시 "선택 영역 W×H" 칩 자동 부착 (`aiSelectionContext` 이벤트 활용, 표시만 추가). 칩 클릭으로 해제.
- 시작 화면 안내 문구 갱신: "Ctrl+K 명령 · / 스킬 · 영역 선택 후 ✨".

## 5. 섹션 4 — 전문가 모드 1024px 반응형

레이아웃 폭 예산은 TS(`editor.ts applyLayout`, `aiPanelLayout.computeSideChatWidth`)가 이미 클램프 — 결함은 CSS/오버플로우 수준. 새 CSS는 `src/styles/shell/editor-responsive-expert.css` 한 파일에 모음(기존 responsive-a.css 불변).

| 결함 | 대응 |
|---|---|
| 메뉴바 라벨 두 줄 꺾임 | `white-space: nowrap` + 좁은 폭 간격·패딩 축소, 브랜드 텍스트 <1200px에서 로고만 |
| 클래식 툴바 우측 잘림 | ResizeObserver 오버플로우 → 넘치는 버튼 `⋯` 팝오버 수납 (priority+ 패턴, TS) |
| 좌패널 탭 줄바꿈 | 탭 `nowrap` + 최소폭 보정, <1200px 폰트/패딩 1단계 축소 |
| 맵 트리 이름 안 보임 | 이름 `flex:1 + ellipsis` 우선, 행 액션 아이콘은 hover 시 표시 |
| '보내기' 버튼 잘림 | 입력 행 `min-width:0` flex 수정, 좁으면 아이콘(➤)만 |
| 줌 툴바 ↔ 잠금 배너 겹침 | 캔버스 상단 오버레이 flex 스택 정리, 부족 시 배너 위·툴바 아래 |
| 상태바 잘림 | 우선순위 숨김 — 좌표/하위/상위부터 숨김, 모드·맵·도구·잠금·DB 유지 |
| AI 빠른 작업 칩 줄바꿈 | <1200px 그리드 2열→1열 |

- **보장선**: ≥1024px 전 기능 정상 표시. <1024px는 기존 720px 자동 접힘 경로(좌패널 접힘, 채팅 float)로 저하.

## 6. 비목표 (YAGNI)

- 전문가 모드 좌패널의 아이콘 레일화 (플라이아웃 프리미티브 재사용은 후속 과제)
- 모바일/터치 대응, 초성 검색, AI 중심 레이아웃 재편(별도 'AI 에이전트 페이지' 계획과 별개)
- 시작 화면 콘텐츠 리치화(빠른 작업/최근 기록의 기본 모드 노출)는 이번 범위 아님

## 7. 검증 계획

- 단위: 커맨드 레지스트리 매칭, 칩 프리셋 프롬프트 생성, 플라이아웃 상태 전이 (vitest).
- E2E: 기존 `tool-*`/`layer-*`/`basic-*` testid 시나리오 통과 + 플라이아웃 열림/닫힘/핀 스모크 (test/e2e).
- 시각: Playwright 스크린샷 1024×768 / 1280×800 / 1440×900 × 기본/전문가 — 줄바꿈·잘림·겹침 없음 확인.
- 헤드리스 조작: `window.__rpgzzuEditorUiMode`·`__rpgzzuEditorTool` 훅 유지.

## 8. 주요 파일

- `src/editor/panels/basicLeftRail.ts` (재작성), `src/editor/panels/tilePalette.ts` (분기 유지)
- 신규 모듈:
  - `src/editor/panels/basicRailFlyout.ts` — 플라이아웃 호스트(열림/닫힘/핀 상태)
  - `src/editor/selectionActionChips.ts` — 선택 액션 칩 (2-A)
  - `src/editor/proposalInlineApproval.ts` — 고스트 프리뷰 인라인 승인 오버레이 (2-B)
  - `src/editor/commandRegistry.ts` — 커맨드 팔레트 명령 레지스트리 (3-A)
- `src/editor/panels/aiSkillDrawer.ts` (팔레트 확장), `src/editor/hotkeys.ts` (도구 단축키)
- `src/styles/shell/editor-ui-modes.css` (레일 스타일), 신규 `src/styles/shell/editor-responsive-expert.css`
- `src/editor/panels/editor.ts` (기본 모드 좌측 컬럼 폭 처리), `src/editor/agentGhostPreview.ts`·`src/editor/regionTask/*` (인라인 어시스트 배선)
