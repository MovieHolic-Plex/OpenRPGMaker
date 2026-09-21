# 프로젝트 시작 화면 캡처 — 2026-09-11

질문: "프로젝트 시작할 때 뜨는 것들" = 첫 방문 부팅 게이트. 아래 순서로 뜬다.

## 즉시 확인

- `01-first-screen.png` — 진짜 첫 화면. 편집기 셸(좌 타일 레일 + 캔버스 + AI 패널) 위에
  **웰컴 브리핑("감독 / 어떤 게임을 만들까요?")** 이 덮인다.
- `02-welcome-more-worlds.png` — "이런 세계도 있어요 (15)" 를 펼친 상태(포스터 15장).
- `04-editor-settled.png` / `05-editor-first-view.png` — 브리핑을 닫은 뒤 편집기 첫 화면.
- `07-new-project-dialog.png` — 상단 「새 프로젝트 ▾ → 새 프로젝트」 다이얼로그(시작 장르 7종).
- `08-ai-studio-start.png` — 상단 「스튜디오」 = AI 스튜디오 시작 화면.

## 재현 방법

첫 방문 게이트는 (1) `localStorage['oprn:editor-welcome-dismissed']` 없음, (2) URL 에 `?project=` 없음,
(3) 자동화 아님(`navigator.webdriver` false, `?freshProject`/`?blankProject`/`?devProject` 없음)일 때만 뜬다.
캡처는 Chromium 에서 `navigator.webdriver` 를 false 로 덮고 `?forceWelcome=1` 로 진입했다.

```bash
DEV_SERVER_PORT=9871 npx vite --configLoader runner --host 127.0.0.1 --strictPort
```

## 부팅 때 실제로 일어나는 일 (소스 근거)

1. `src/app/mode.ts bootApp` — 첫 방문(저장된 선택 없음 + `?project=` 없음)이면
   `store.loadNewRemoteProject(createBlankProject())` 로 **새 project id 를 발급**한다.
   이번 캡처에서 실제 발급: `oprn-b03386cc84` (LegacyDb `rpg_zzu.projects` 에 존재 확인).
2. `finishEditorBoot` → `shouldPresentEditorWelcome` 이 참이면 `presentEditorWelcome` =
   `01-first-screen.png` 의 브리핑. (부팅 후 URL 이 `?project=oprn-xxxxxxxxxx&map=map_blank_start` 로 바뀐다.)
   같은 부팅에서 `presentEditorWelcome` 완료 후 `renderTopbar()` → `enterMode("edit")` 순서라,
   브리핑 아래에는 이미 편집 셸(좌 타일 레일·캔버스·AI 패널)이 깔려 있다.
3. 브리핑에서 "빈 맵으로 시작" 을 누르면 `?project=` 가 생기므로 로그인 모달은 뜨지 않고
   게스트 신원이 자동 확보된다(`10-second-visit.png` 경로).
   웰컴 인텐트가 없는 **두 번째 방문**에서만 로그인 모달이 뜬다(`teamWorkflowUi.openLoginModalIfNeeded`).
4. 초보 모드 코치마크 3점/`표준 모드` 웰컴 카드는 이번 빌드에서 관측되지 않았다
   (초보 모드여도 노출되지 않음 — `coachMarks.ts` 의 호출처 0건). 표면 잡음으로 남겨둔다.

## 부수 관측 (고치지 않음)

- `?forceWelcome=1` 로 진입하면 `map` URL 동기화가 `?project=` 를 붙여,
  그 뒤 부팅은 딥링크로 판정된다. 그래서 첫 화면 뒤에 로그인 벽이 겹치지 않는다.
- 개발 서버 콘솔에 `409 (Conflict)` 1건 + `ERR_CONNECTION_REFUSED` 3건이 남는다
  (`page-errors.txt`). 로컬 LegacyDb 프록시/동기화 잡음으로 보이며 화면에는 영향이 없다.
- `welcome-copy.json` — 브리핑의 실제 문구/버튼 라벨 29개. `new-project-menu.json` — 「새 프로젝트」 메뉴 항목.
