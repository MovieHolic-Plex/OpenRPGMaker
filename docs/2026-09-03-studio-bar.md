# 2026-09-03 스튜디오 바 — 표준·전문가 셸 개편 (톱바 한 줄 · 중복 집 정리)

- 작성: AI Bot (Claude) · 브랜치 `overhaul/editor-standard-expert`
- 대상: 표준·전문가 편집 모드의 톱바(메뉴바 + 전문가 클래식 툴바 행), 「보기」 메뉴, 캔버스 플로팅 툴바. 초보 모드는 같은 톱바를 쓰므로 함께 바뀌되 초보 계약(레일·도구 메뉴의 자료집)은 유지.
- 증거: `docs/2026-09-03-studio-bar-assets/` (1440×900 표준·전문가·초보, 1024 표준 톱바, 1280 전문가 톱바, 메뉴 3종)
- 지시: 「표준·전문가 모드 UI/UX 를 대격변 느낌으로. 중복은 합치고 실제 쓸만한 기능 위주로 배치.」

## 1. 실측 — 무엇이 겹쳐 있었나 (변경 전, 1440×900)

| 항목 | 표준 | 전문가 |
|---|---|---|
| 톱바 높이 | 49px | **116px** (메뉴바 49 + 클래식 툴바 행 67) |
| 톱바 컨트롤 | 18개, 전부 같은 무게의 글자 버튼 | 18 + 15 = **33개** |
| 클래식 툴바 행 15개 중 메뉴 항목의 복제 | — | **14개** (새 프로젝트·저장·저장본·열기·가져오기·DB·리소스·세계관·음악·찾기·도움말·전투 …) |
| 캔버스 플로팅 툴바 | 490×60, 42px 버튼 8개 | 같음 |

같은 동작의 집(변경 전):

| 동작 | 집 | 개수 |
|---|---|---|
| 테스트 실행 | 작업 칩 「테스트」 · ▶ 테스트 버튼 · 게임 메뉴 | 3 |
| 랜덤 전투 테스트 | ⚔ 버튼 · 게임 메뉴 · 클래식 툴바 「전투」 | 3 |
| 데이터베이스 | 작업 칩 「데이터」 · 도구 메뉴 · 클래식 툴바 「DB」 | 3 |
| 소재·세계관·음악·찾기·도움말·새 프로젝트·저장·열기·가져오기·저장본 | 메뉴 항목 + 클래식 툴바 버튼 | 각 2 |
| AI 설정 | 톱바 버튼 + 도구 메뉴 | 2 |
| 편집 모드(초보/표준/전문가) | 「보기」의 「밀도(안내/보통/촘촘)」 + 「편집 모드」 — `setWorkspaceDensity` 가 `setEditorUiMode` 를 그대로 부름 | 같은 축 ×2 |
| 레이어 전환 | 사이드바 바닥/덧그림/이벤트 + 작업 칩 「맵」「이벤트」(= 레이어 전환 + 팔레트 접기) | 2 |

## 2. 바꾼 것 — 한 동작의 집은 하나, 자리는 빈도로

### 톱바 = 스튜디오 바 한 줄 (48px, 3열 그리드)

```
✦ OPRN Studio  [프로젝트명 ▾]  💾  │  ⛁ 자료집  🖼 소재  도구 ▾      ⌕ 명령 · 맵 이동  Ctrl K      [▶ 테스트│⚔]  [스튜디오]  [⊞ 보기 ▾]  │  ?  ⟲  👤  ⚙  ⤢
```

- **왼쪽 = 파일·자료.** 프로젝트 메뉴의 얼굴이 **프로젝트 이름**이 됐다(전에는 이름이 화면 어디에도 없었다). 저장 버튼에 자동 저장 점(초록 저장됨 · 호박 저장 중 · 빨강 실패)이 붙어 평상시에도 저장 상태가 보인다 — 점은 폭이 고정이라 옆 버튼이 안 움직인다(예전에 pending 칩을 접었던 이유). 자료집·소재는 표준·전문가에서 상시 버튼(전에 표준은 도구 메뉴 두 번 클릭이 유일한 길).
- **가운데 = 명령 팔레트.** VS Code 명령 센터처럼 이름과 키캡을 보여준다. 전체 검색이라 한 집 규칙의 예외. 열은 `max-content | minmax(0,1fr) | max-content` — 양 끝 묶음이 내용 폭을 먼저 갖고 칩은 남는 폭 안에서 중앙에 선다. 처음 `1fr | auto | 1fr` 로 두었을 때 1280 전문가에서 왼쪽 묶음이 칩 밑으로 흘러 명령 팔레트가 「찾기」 클릭을 가로챘다(e2e `oprn-map-event-search` 가 잡음). 1599px 이하에서는 명령 라벨·키캡을 숨겨 32px 아이콘 칸으로 유지하고, 1439px 이하에서는 실행·스튜디오·보기 같은 빈도가 낮은 오른쪽 컨트롤도 아이콘으로 접는다. 1600px부터 명령 라벨과 키캡을 다시 보여준다. 저장 상태는 1024px에서 145px, 그 밖의 컴팩트 구간에서 165px로 제한하며 상태 문구는 말줄임·title로 보존하고 재시도 버튼은 남긴다.
- **오른쪽 = 실행·화면·세션.** `▶ 테스트│⚔` 를 한 그룹으로 묶고, 「보기 ▾」, 그리고 아이콘 묶음(도움말·기록·신원·AI 설정·전체화면).
- **삭제:** 전문가 클래식 툴바 행(67px), 게임 메뉴, 작업 칩 4개, 「보기」의 밀도 그룹, 툴바 접기(─), 도구 메뉴의 AI 설정. 선택 이벤트 테스트(클래식 툴바 전용)는 이벤트 편집기의 「테스트」 버튼과 **이벤트 우클릭 「이 이벤트 테스트」** 로 집을 옮겼다.

### 전문가는 무엇이 다른가
같은 한 줄이되 **촘촘**(12.5px 라벨, 간격 8/2px)하고, 기술 용어(DB·리소스·데이터베이스), 배율 6단계, 그리고 세계관·음악·찾기가 「도구 ▾」 메뉴 대신 **인라인 아이콘 버튼**(1클릭)이다. 표준은 메뉴, 전문가는 버튼 — 같은 모드에 두 표면을 함께 두지 않는다(`chrome.toolStrip`, 옛 `classicToolbar`).

### 「보기 ▾」
패널 토글(체크박스) + **편집 모드 라디오 3줄에 한 줄 힌트**(초보 — 이름 붙은 큰 도구 레일 · 첫 사용 안내 / 표준 — 타일 팔레트와 맵 트리 · 쉬운 용어 / 전문가 — 촘촘한 배치 · 기술 용어 · 도구 창 1클릭 · 배율 6단). 밀도 그룹은 없다.

### 캔버스 플로팅 툴바
구조와 testid 는 그대로, 32px 컨트롤의 유리 pill 로 재도색(490×60 → 480×44). ⋯ 게이트 뒤의 배율 목록·맵 PNG 저장도 그대로.

### 소유권
- 새 시트 `src/styles/shell/studio-bar.modern.css` 가 톱바·메뉴 팝업·보기 메뉴·캔버스 툴바의 마지막 발언자(hex 0 · `!important` 0). `shell/editor-responsive-expert.css`(클래식 툴바 오버플로·상태바 등 죽은 규칙)는 삭제하고 살아 있던 AI 컴포저 3규칙만 `editor-ui-modes.css` 로 옮겼다 → CSS 파일 수 ±0.
- 코드: `menu.ts`(renderTopbar 재구성, 프로젝트 이름·저장 점·도구 묶음·명령 센터·전체화면), `workspaceBar.ts`(보기 메뉴만), `authoringTasks.ts`(프리셋 결합 해제), `commandRegistry.ts`(밀도→편집 모드, 프리셋 삭제, 음악·찾기·저장 추가), `workspaceStore/Layout.ts`(`setWorkspacePreset`·`setWorkspaceDensity`·`isWorkspaceDensity` 삭제), `editorUiMode.ts`(`classicToolbar`→`toolStrip`, `gameMenuLabel` 삭제), `eventLayerContextMenu.ts`(「이 이벤트 테스트」), `tileToolbarIcons.ts`(톱바 아이콘 14종), `helpModal.ts`(문구).

## 3. 전후 실측 (1440×900)

| 항목 | 전 | 후 |
|---|---|---|
| 표준 톱바 | 49px · 18개 | 48px · **15개** |
| 전문가 톱바 | 116px · 33개 | 48px · **17개** — 캔버스 +67px |
| 컨트롤 무게 | 글자 버튼 한 종류 | 채운 인디고(▶ 테스트) / 테두리(스튜디오·명령 팔레트) / 고스트(나머지) 셋 |
| 한 동작의 집 | 최대 3 (+같은 축 ×2) | **1** (`test/studioBarActions.test.ts` 가 톱바+팝업 전체에서 testid 중복 0 을 단정) |
| 프로젝트 이름 노출 | 없음 | 프로젝트 메뉴 라벨 |
| 저장 상태 | 오류일 때만 칩 | 점(항상) + 오류 칩 |
| 캔버스 툴바 | 490×60 · 42px | 480×44 · 32px |
| 1024px 전문가 | 클래식 툴바가 ⋯ 오버플로로 접힘 | 한 줄 그대로. 명령·실행·스튜디오·보기는 아이콘 칸으로 접고, 저장 상태와 재시도는 안쪽에 남김 |

## 4. 검증

- `npm run typecheck:app` 0. 루트 `tsc --noEmit` 오류 수는 깨끗한 HEAD 워크트리와 `.mjs` 선언 파일 4건 차이(환경) 외 동일.
- vitest: 새 `test/studioBarActions.test.ts`(11) · 고친 `editorMenuSidebarIa`(+4) · `editorHeaderTerminology`(모드별 집) · `authoringTasks`(재작성) · `commandRegistry` · `windowControls` · `menuWorldSurface` · `saveStatusVisibility` · `leftDockPanels` · `editorUiMode` — 14 파일 123건 통과. `teamWorkflowUi`의 「renders topbar identity …」 1건은 깨끗한 HEAD 에서도 실패(선행).
- CSS 게이트: `check-css-graph` 통과. `check-css-live-classes` 는 삭제한 모드 토글의 `.is-active { text-decoration }` 소실을 잡아 기준선(`.omo/css-live-classes-baseline.json`)을 갱신했다 — 의도한 삭제. `check-css-budget` 의 회귀는 기준선(2026-08-30) 낡음(다른 PR 의 undefinedVars +2 · 파일 +1); 이 변경의 기여는 hex 0 · `!important` 0 · 파일 ±0. `check-dead-css-classes` 의 신규 2건(`db-mini-btn`, `db-resource-picker-hue-value`)은 HEAD 에서도 동일(선행).
- e2e: 삭제 표면을 쓰던 스펙 18개를 새 집으로 고쳤다(게임 메뉴→`mode-play`/`topbar-battle-test`, `toolbar-help`→`menu-help`, `toolbar-event-test`→편집기 「테스트」, 작업 칩→레이어 버튼/도구 메뉴, 클래식 오버플로 단정→한 줄 단정, 표준의 `menu-tools-database`→`toolbar-database`). `toolbar-database`(46개)·`mode-play`(108개)·`toolbar-save`·`topbar-ai-settings` 계약은 그대로다. 실행 결과는 §5.

## 5. e2e 실행 결과

판정 방식은 공유 머신 기준선 비교다 — 같은 스펙을 **깨끗한 `origin/main` 워크트리(`/tmp/ov-base`, 포트 9864)** 와 **이 브랜치(포트 9863)** 에서 돌려 실패 집합의 차이만 본다. 실패 수 자체는 이 머신에서 의미가 없다(첫 실행은 vitest 전체 스위트와 겹쳐 25/34 가 시간 초과였다).

| 실행 | 결과 |
|---|---|
| 이 브랜치, 셸 스펙 12개(재실행, 2 워커) | 21 실패 · 11 통과 |
| origin/main, 같은 스펙 11개(2 워커) | 22 실패 · 4 불안정 · 5 통과 |
| 차집합 — 이 브랜치에서만 실패 | `oprn-editor-shell-copy-5` 1건 → 단독 재실행 **통과(22s)**. 30s 예산 안에 부팅+시연 창 부팅이 들어가야 해 병렬 실행 부하에 취약 |
| 차집합 — main 에서만 실패 | `authoring-journey`, `browser-evidence-button` — 찬 dev 서버의 첫 부팅 >15s. 이 브랜치에서는 통과 |
| 교집합(선행, 20건) | `responsive-shell` 12건(`ai-collapsed-restore` aria-label 이 「조수」인데 스펙은 「AI 패널 펼치기」), `qa-db-beginner-mode` G1~G3(초보 자료집 레일이 평면), `oprn-editor-fidelity-shell`(캔버스 툴바 ⋯ 상태가 저장되어 두 번째 클릭이 접음), `oprn-help-modal:8`(개요 문장이 소스에 없음), `tileset-review-confirm`(`db-tab-tilesets` 가 접힌 폴더 안), `event-editor-controls-1-3-5-6-proof`(`.event-list-row` 미출현), `editor-map-focused-shell`(main 은 `menu-map` 낡은 단정, 이 브랜치는 새 단정을 지나 `ai-settings-body` overflow-y 가 DB studio-v2 층 때문에 auto) |

이 변경이 실제로 잡은 것: 첫 실행에서 `oprn-map-event-search` 4건이 「찾기」 클릭을 명령 팔레트가 가로채 실패했다 — 그리드가 `1fr | auto | 1fr` 이라 1280 전문가에서 왼쪽 묶음이 가운데 칩 밑으로 흘렀다. `max-content | minmax(0,1fr) | max-content` 로 고친 뒤 4건 통과, 1024/1280/1440 × 초보/표준/전문가에서 버튼 박스 교차 0(`/tmp/ov-shots/overlap.mjs`). 2026-09-19 후속 실측에서는 세 모드와 1024·1119·1120·1279·1280·1439·1440·1500·1501·1599·1600px 경계에서 버튼끼리의 교차, 중앙 hit-test 실패, 명령 칩 자식의 부모 밖 넘침, 문서·톱바 가로 넘침이 모두 0이었다. 전문가에서 데이터베이스 모달을 열어 지연 CSS를 로드한 뒤에도 같은 결과였다. 긴 저장 오류 상태의 재시도 버튼도 1024px 톱바 안에 남았다.

vitest 전체(1407 파일)는 첫 실행에서 83 파일 실패였다. 그 84 파일만 두 트리에서 다시 돌리면 실패 테스트가 main 163 · 이 브랜치 164 — 차이 1건은 `regionAiHouseTreeNpc.probe` 의 **실제 LLM 호출** 테스트로, main 에도 같은 `.env.local` 을 두고 돌리면 똑같이 실패한다(환경). 이 브랜치에서만 통과로 돌아온 파일: `eventLayerContextMenu`(새 항목 반영), `databaseViewToggle`·`mapEditLockScratchSession`(첫 실행의 부하 시간 초과).
