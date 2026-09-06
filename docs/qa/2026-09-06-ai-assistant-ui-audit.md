# AI 조수 UI 조작 전수 조사

**결론: 실제 브라우저에서 10개 결함을 확인했다.** 특히 전체 기록, 접기, 스튜디오를 연속으로 조작하면 화면 상태가 서로 충돌한다. 처음의 작은 입력창에서 버튼을 한 번씩 눌러 보는 검사만으로는 이 문제들을 발견할 수 없다.

이 PR은 **조사 보고서와 증거**다. 제품 코드를 수정하거나 아래 결함을 해결한 PR은 아니다.

## 조사 기준과 증거

- 대상 커밋: `49067218a`. 조사 시각: 2026-09-07 02시대 UTC. 파일 날짜는 요청 날짜를 유지했다.
- 실제 Chromium `149.0.7827.55`, Playwright를 eval JS 커널에서 직접 사용했다. 지원 최소 크기 `1024×768`와 `1440×900`을 검사했다.
- 편집기 URL: `http://127.0.0.1:19841/?freshProject=1`. 별도 브라우저 프로필과 임시 프로젝트로 검사했다. 사용자 브라우저의 쿠키·캐시를 지우지 않았다.
- 워크트리 보정 후 배정된 9841은 다른 프로세스가 사용 중이었다. 그 프로세스를 건드리지 않고 전용 서버를 19841에 띄웠다.
- Bun.WebView는 이 커널에서 `backend "chrome" is only available on the main thread`로 생성되지 않았다. 설치된 Playwright를 사용했다.
- Chromium의 직접 모듈 로딩이 빈 화면에서 멈춰 기존 `test/e2e/assistant-glass-settings.spec.ts`의 **응답을 바꾸지 않는 정적 GET 중계** 방식을 사용했다. UI는 실제 Vite 소스다. 서버 응답을 가짜 UI로 대체하지 않았다.
- 레이아웃·메뉴·설정 검사는 실제 동작이다. 전송·중단·대화 복원 검사는 `/v1/chat/completions`에 **읽기 전용 응답 fixture**를 공급했다. 실제 모델 품질, OAuth 성공, 원격 프로젝트 저장을 검증했다는 뜻이 아니다.
- 프로젝트 변경·인증 해제·새 OAuth 로그인 등은 실행하지 않았다. 해당 컨트롤도 아래 목록에 포함하되, 실행하지 않은 것을 PASS로 표시하지 않았다.

**증거 위치**

- [데스크톱 실측값](../../output/evidence/ai-ui-audit-2026-09-06/measurements.json): 실제 도구 결과와 당시 노트에서 옮긴 값이다. 첫 커널의 메모리 로그가 유실돼 원시 trace라고 표시하지 않았다.
- [최소 화면·대화 조작 로그](../../output/evidence/ai-ui-audit-2026-09-06/action-log.json): 후반 브라우저 실행에서 직접 수집한 액션과 판정값.
- [리사이즈·스튜디오 이동 로그](../../output/evidence/ai-ui-audit-2026-09-06/movement-log.json): 분할선·장면 검색·크기 조절의 실측값.
- [스크린샷 목록 및 재현 순서](../../output/evidence/ai-ui-audit-2026-09-06/README.md).

스크린샷은 실제 페이지에서 캡처했다. 다만 이 세션과 독립 이미지 확인 담당 모델 모두 이미지 입력을 지원하지 않아 **픽셀을 보고 평가했다는 주장은 하지 않는다**. 결함 판정은 DOM, 계산된 CSS, 좌표, 실제 클릭 가로채기와 소스 대조에 근거한다. PNG는 사람이 검토할 수 있도록 보존했다.

## 확인된 결함

### F1. 높아진 조수 패널에서 더보기·성향·맥락 팝오버가 화면 밖으로 열린다 — P1

**재현**

1. `ai-command-menu-toggle`을 누르고 메뉴의 `전체 기록`을 누른다.
2. `ai-command-menu-toggle`, `ai-preference-toggle`, `ai-context-meter`를 각각 연다.
3. 팝오버의 `getBoundingClientRect().top`과 실제 메뉴 항목의 클릭 가능 여부를 확인한다.

1440×900에서 더보기는 **y=-189**, 성향은 **y=-113.5**, 맥락은 **y=-85.9375**였다. 1024×768에서도 더보기는 y=-189였다. 단순히 경계에 닿는 정도가 아니라 주요 항목이 뷰포트 밖으로 나간다.

**전체 기록만의 문제가 아니다.** 읽기 전용 응답 두 턴 뒤 일반 float 패널도 높이 699px, 상단 187px로 커졌고 메뉴는 **y=-59**가 됐다. 앞선 실제 포인터 내보내기 시도는 톱바가 클릭을 가로채 실패했다. 같은 내보내기는 키보드로 포커스 후 Enter를 누르면 파일이 내려왔다. 기능 자체보다 배치·도달성 문제라는 대조 근거다.

- 원인: `src/styles/database/tabs-b-assistant-panel/18-assistant-deck.css:1257`과 `:1320`이 항상 `bottom: calc(100% + 6px)`로 위에 연다. `src/editor/panels/aiComposer.ts:400`의 `openPopover`에는 뷰포트에 맞춰 방향을 바꾸거나 좌표를 제한하는 단계가 없다.
- 제안: 작은 float뿐 아니라 긴 대화·전체 기록을 기준으로 앵커 위치를 계산하고 위/아래 전환 및 뷰포트 제한을 적용한다.
- 증거: `04-history-ai-command-menu-toggle.png`, `15-minimum-history-menu.png`, `18-tall-float-menu.png`.

### F2. 전체 기록에서 접으면 입력창이 남고 폭 47px로 찌그러진다 — P1

**재현:** `전체 기록` → `ai-collapse`.

패널에는 `is-history-open is-docked is-collapsed`가 함께 남는다. 접힌 상태여도 입력창·접기 버튼·복원 버튼이 모두 visible이다.

| 화면 | 접힌 뒤 데크 좌표·크기 | 계산된 display |
|---|---|---|
| 1440×900 | x=1379, y=49, 47×799 | flex |
| 1024×768 | x=963, y=49, 47×667 | flex |

일반 float 접기는 `display:none`으로 정상 동작했다.

- 원인: `aiChatPanel.ts:2535`의 접기가 history 상태를 해제하지 않는다. `18-assistant-deck.css:85`의 접힘 숨김 규칙을 뒤쪽 `:1455`의 전체 기록 `display:flex`가 같은 specificity로 덮는다.
- 제안: 접힘이 전체 기록보다 우선하도록 상태와 CSS 계약을 함께 정리한다. 일반 float 접기만 검사하는 테스트로는 부족하다.
- 증거: `05-history-collapsed.png`, `16-minimum-history-collapse.png`.

### F3. 전체 기록에서 스튜디오로 들어가면 이전 데크가 남아 종료 클릭까지 막는다 — P1

**재현:** `전체 기록` → 톱바 `topbar-ai-studio` → 스튜디오 `ai-studio-exit`.

`is-history-open is-studio`가 공존하면서 이전 데크가 **1440×637.6875px**로 계속 표시된다. `편집기로` 버튼의 실제 포인터 클릭은 `ai-glass-log`, 모니터, 덱 splitter의 가로채기로 5초 후 실패했다. 톱바 스튜디오 토글로는 빠져나올 수 있었다.

대조군인 **일반 float → 스튜디오**는 이전 데크가 `display:none`이고 `편집기로` 클릭도 성공했다.

- 원인: `aiChatPanel.ts:2614-2618`이 스튜디오 진입 시 `is-docked`만 제거하고 `is-history-open`은 남긴다. F2와 같은 전체 기록 CSS가 스튜디오의 데크 숨김을 덮는다.
- 제안: 스튜디오·기록의 표시 상태를 배타적으로 전환하고, 왕복 후 DOM 마운트와 hit-test까지 검사한다.
- 증거: `06-history-to-studio.png`, 정상 비교 `07-direct-studio.png`.

### F4. 전체 기록을 닫는 가시적 경로가 없다 — P2

**재현:** 전체 기록을 연 뒤 같은 `전체 기록` 메뉴 항목을 다시 활성화한다. 메뉴가 화면 밖에 있어 항목에 포커스하고 Enter로도 확인했다.

다시 눌러도 `is-history-open`은 유지된다. 실제 토글 버튼은 hidden/inert 툴바 안에 있고, 메뉴에는 닫기로 바뀌는 항목이 없다. 새로고침 또는 스튜디오 진입·종료가 우회 경로다. F2 때문에 접기도 정상적인 탈출 경로가 되지 못한다.

- 원인: `aiChatPanel.ts:2109-2112`의 `openHistory`가 `historyButton.click()` 직후 **항상 `applyHistoryOpen(true)`**를 호출한다. hidden 버튼 자체의 `:2600` 토글은 정상이어도 메뉴가 결과를 다시 true로 바꾼다.
- 제안: 열기/닫기를 구별한 가시적 컨트롤을 제공하고 메뉴 라벨·aria 상태를 동일 상태에서 계산한다.
- 근거: `measurements.json`의 `sameMenuActionLeavesHistoryOpen`.

### F5. 스튜디오 장면·조수 열을 접어도 모니터 공간이 늘지 않는다 — P2

**재현:** 일반 float에서 스튜디오 진입 → `ai-studio-scenes-collapse` → `ai-studio-chat-collapse`.

| 화면 | 접기 전 grid-template-columns | 둘 다 접은 뒤 |
|---|---|---|
| 1440×900 | 252px 8px 712px 8px 400px | 동일 |
| 1024×768 | 252px 8px 308px 8px 400px | 동일 |

클래스와 버튼 상태는 바뀌지만 열 너비는 줄지 않는다. CSS가 의도한 접힌 열 너비는 52px다.

- 원인: `aiStudioShell.ts:400`이 `--studio-scenes-w`, `--studio-chat-w`를 inline style로 지정한다. `:546-564`의 접기는 클래스만 바꾸고 `08-studio-mode-start-screen.css:1403-1409`가 일반 stylesheet로 같은 변수를 52px로 덮으려 한다. inline 값이 우선한다.
- 제안: 저장된 펼침 너비와 현재 표시 너비를 구별하거나 접기 상태가 실제 grid 계산에 우선하도록 한다.
- 증거: `08-studio-collapsed-columns.png`, `17-minimum-studio-collapse.png`.

### F6. 톱바 AI 설정은 저장되어도 열린 조수에 즉시 반영되지 않는다 — P2

**재현:** `topbar-ai-settings` → 글자 크기 `크게`, 자율성 `최대` → `지금 저장`.

저장된 글자 크기는 `large`인데 패널은 `data-ai-font-size="normal"`로 남았다. 자율성도 설정은 max지만 컴포저는 balanced였다. 반대로 **조수 더보기 → 설정**에서 small/confirm을 고르면 패널과 컴포저가 즉시 small/confirm으로 바뀌었다.

배경 농도는 반례다. 톱바에서도 100%를 고르면 패널 CSS 변수에 즉시 `100%`가 반영된다. 따라서 모든 설정이 고장났다고 일반화할 수 없다.

- 원인: `menu.ts:353`은 인자 없는 `openAiSettingsModal()`을 호출한다. `aiSettingsModal.ts:81-83`의 글자 크기는 주입된 콜백/루트만 갱신한다. 조수 경로는 `aiChatPanel.ts:470-483`에서 세션·모델 칩·effort 동기화를 주입한다.
- 제안: 설정 저장의 현재 패널 반영 경로를 진입점과 무관하게 공유한다.
- 근거: `measurements.json`의 `settings`.

### F7. 설정·이전 대화 모달에서 Tab 포커스가 편집기로 빠진다 — P2

**재현:** 모달을 열고 닫기 버튼에 포커스 → `Shift+Tab`.

설정과 이전 대화 모두 `aria-modal=true`인데 포커스가 바깥의 `authoring-journey-toggle`로 이동했다. 설정에서 그 상태로 Escape를 누르면 모달은 닫히지만 원래 열기 버튼이 아닌 편집기 버튼에 포커스가 남았다.

- 원인: `aiSettingsModal.ts:122-129`, `aiConversationHistoryModal.ts:231-235`의 닫기는 DOM 제거만 한다. `src/editor/ui/modalStack.ts`는 최상위 Escape 순서를 관리하며 포커스 가두기나 opener 복원을 대신하지 않는다.
- 제안: 공용 모달의 포커스 계약을 재사용하고 첫/마지막 컨트롤의 Tab·Shift+Tab 및 Escape 복원 위치를 실제 브라우저에서 검사한다.
- 근거: `measurements.json`의 `focus`. 이번 검증은 역방향 Tab과 해당 Escape 경로이며 모든 키 조합을 검증했다고 주장하지 않는다.

### F8. 동일한 AI 설정인데 진입점에 따라 대기 화면 선택 항목이 사라진다 — P2

**재현:** 톱바 AI 설정과 조수 더보기의 설정을 각각 연다.

톱바에는 `ai-command-temperature-*`가 0개, 조수 경로에는 3개였다. 조수 경로의 `ink-only`, `map-first`, `quiet-gold`는 각각 `data-temperature`를 변경했다.

- 원인: `aiChatPanel.ts:2680` 부근에서 만든 temperature 절은 `extraSections`로만 주입된다. 인자 없는 톱바 호출에는 없다.
- 제안: 전역 AI 설정으로 제공할 절과 패널 전용 절을 명시적으로 나누되, 같은 이름의 설정 창에서 이유 없이 기능이 빠지지 않게 한다.
- 근거: `measurements.json`의 `temperatureChoices`.

### F9. 빈 대화의 내보내기는 활성처럼 보이지만 아무 반응 없이 닫힌다 — P3

**재현:** 대화가 없는 상태에서 더보기 → `대화 내보내기`.

메뉴는 닫히지만 다운로드도 새 안내도 없다. 같은 빈 상태의 맥락 압축은 `압축할 대화가 없습니다.`, 보내기를 실제 좌표 클릭하면 `보낼 지시를 입력하세요`가 나온다. 대화가 있으면 키보드 내보내기는 `ai-session-audit.json` 다운로드에 성공했다.

- 원인: visible 메뉴 항목은 활성 상태인데 `aiChatPanel.ts:1896`의 숨은 export delegate는 `refreshExportButton()`으로 disabled다. `.click()`이 실행되지 않아 핸들러 안의 빈 대화 안내에 도달하지 않는다.
- 제안: 가시 메뉴에도 비활성 상태와 이유를 전달하거나, UI 버튼 간 `.click()` 대신 공유 액션을 호출한다.
- 근거: `measurements.json`의 `emptyActions`, `action-log.json`의 nonempty export.

### F10. 유휴 조수의 크기 조절 손잡이가 실제 폭을 바꾸지 않는다 — P2

**재현:** 빈 대화에서 입력창 밖의 `ai-resize-handle`에 포커스 → ArrowLeft 두 번 → 손잡이를 왼쪽으로 80px 드래그한다. 각 단계에서 CSS animation 완료를 기다린 뒤 측정했다.

| 상태 | 저장·인라인 폭 | 실제 데크 폭 | 손잡이 aria-valuenow |
|---|---|---|---|
| 시작 | 480px | 480px | 480 |
| ArrowLeft 두 번 | 496px | 480px | 480 |
| 80px 드래그 | 560px | 480px | 480 |
| 그 뒤 입력창 포커스 | 560px | 560px | 480 |

손잡이를 움직일 때는 아무 변화가 없다가 입력창을 누르면 뒤늦게 커진다. 커진 뒤 접근성 값도 480으로 남았다.

- 원인: `aiChatResizeChrome.ts:76-83`은 일반 폭 변수만 바꾸는데, `18-assistant-deck.css:81-83`의 유휴·입력창 비포커스 규칙은 그 변수를 사용하지 않고 compact 폭을 우선한다. `syncAria`는 실제 폭이 유휴 규칙에 고정된 시점에 계산된다.
- 제안: 크기 조절 중/키보드 손잡이 포커스 상태에서는 사용자 폭을 즉시 반영하고, 표시 폭 전환 후 ARIA 값을 동기화한다.
- 증거: `movement-log.json`, `20-idle-resize-no-effect.png`.

## 컨트롤 전수 목록과 검사 범위

`B`는 실제 브라우저 조작, `F`는 fixture 응답을 통과시킨 실제 UI 조작, `S`는 소스·연결·출현 조건 조사만 수행했다는 뜻이다. **S는 정상 판정이 아니다.** 반복 생성되는 행은 개별 데이터마다 버튼 종류가 늘어나는 것이 아니라 같은 핸들러를 공유한다. 각 행에서 생성되는 종류를 모두 적었다.

소스 경로의 기본 접두사는 `src/editor/panels/`다. `aiPanelLayout.ts` 자체는 버튼을 만들지 않고 지속성·크기·글자·농도 헬퍼만 제공한다.

### 레일·컴포저·더보기

| 컨트롤 / 선택자 | 구현·동작 | 결과 |
|---|---|---|
| `ai-new-chat` | `aiComposer.ts`, `aiChatPanel.ts` → startNewConversation | F: 기존 대화 기록 후 새 대화, 복원까지 확인 |
| `ai-open-conversations` | openConversationHistory | B/F: 모달·검색·기록 복원 확인 |
| `ai-command-menu-toggle` | `aiComposer.ts` openPopover(menu) | B: 재클릭·Escape·외부 클릭 정상; F1 |
| `ai-preference-toggle` | openPopover(preference), 목록 refresh | B: float 정상; history에서 F1 |
| `ai-context-meter` | `aiContextMeter.ts` → context popover | B: float 정상; history에서 F1 |
| `ai-collapse` | toggleCollapsed | B: float 정상, history F2 |
| `ai-collapsed-restore` | restoreCollapsed | B: 왕복·reload 지속성 확인 |
| `ai-send`, `ai-input` | send; Enter 전송/Shift+Enter 줄바꿈 | F: 실제 클릭 전송 final, 빈 포인터 안내 확인. 줄바꿈은 S |
| `ai-abort` | abortActiveTurn | F: 응답 hold 중 클릭 → 중단 문구, send 복귀 |
| `ai-composer-mode-do/ask/plan` | 모드 radio → session composerMode | B: 세 버튼 aria-checked 전환 확인; 모델 수행 정책 전체는 미검증 |
| `ai-composer-autonomy`, `ai-composer-reasoning` | config/session effort 갱신 | B: 설정 경로와 값 동기화 대조; F6. 직접 native select 각 값 조합은 S |
| `ai-composer-model` | 모델명 span | 버튼 아님, 표시만 수행 |
| `ai-composer-undo`, `ai-collapsed-undo` | 현재 AI 적용 체크포인트 되돌리기 | S: 적용 완료 시만 노출. 프로젝트 변경을 생성하지 않아 미실행 |
| `ai-selection-chip-clear` | 선택 영역 AI 맥락 제거 | S: selectionTaskActive일 때만 생성·노출 |
| `ai-resize-handle` | `aiChatResizeChrome.ts`, pointer drag/좌우 키 | B: 방향키·80px 드래그·입력 포커스 비교, F10 |
| `ai-command-menu-compact` | compactContextNow | B: 빈 대화 안내 정상. 실제 압축 모델 호출은 미실행 |
| `ai-command-menu-instructions` | `aiInstructionsModal.ts` | B: 열기·닫기, 저장하지 않음 |
| `ai-command-menu-export` | hidden export delegate | B/F: 빈 상태 F9, 비어 있지 않을 때 키보드 다운로드 성공 |
| 메뉴 `전체 기록` (`role=menuitem`, testid 없음) | sharedMenuActions.openHistory | B: F1–F4 |
| `ai-command-menu-tools` | `toolBrowserModal` 진입 | B: 열기·전체 196개 보기·npc 검색·닫기 |
| `ai-command-menu-settings` | openAiSettings, 콜백·extraSections 주입 | B: 표시 설정 정상 반영, 톱바와 F6/F8 차이 |
| `ai-context-compact` | 맥락 팝오버 압축 | S: 메뉴 압축과 같은 액션, 유효 대화 필요 |
| `ai-context-compact-undo` | 압축 이전 맥락 복구 | S: 압축 결과가 있어야 활성 |
| `ai-context-summary-toggle` | 요약 본문 펼침 | S: 요약이 있을 때만 검사 가능 |

### 설정·성향·대화 모달

| 컨트롤 / 선택자 | 구현·동작 | 결과 |
|---|---|---|
| `topbar-ai-settings` | `menu.ts` → 기본 옵션 모달 | B: F6/F8 |
| `ai-settings-close` | 모달 해제·폼 dispose | B: 클릭·Escape 닫힘, F7 |
| `ai-settings-connection-check` | 인증 상태 재조회 | S: 렌더·핸들러 확인. 명시 재조회 버튼은 미실행 |
| `ai-auth-oauth`, `ai-auth-api-key` | `aiAuthSettings.ts` 연결 종류 radio | S: 현재 API 키 지원 제공자 없음 안내 확인. 종류 변경은 미실행 |
| `ai-auth-quick-google-antigravity`, `ai-auth-quick-openai-codex` | 제공자 선택 카드·방향키 | S: 렌더 확인, 사용자 연결 변경하지 않음 |
| `ai-oh-my-pi-provider` | 제공자 custom select | S: 두 제공자 목록 확인 |
| `ai-oauth-login`, `ai-auth-disconnect` | 로그인/재확인·연결 해제 | S: 기존 계정 연결을 변경하지 않음 |
| `ai-oauth-copy-code`, `ai-oauth-paste-submit`, `ai-oauth-device-cancel` | 기기 로그인 코드 복사·콜백 전달·취소 | S: 기기 인증 진행 중에만 노출 |
| `ai-oauth-paste-url`, `ai-oauth-device-url` | 콜백 입력·인증 URL 링크 | S: 동일 조건 |
| `ai-config-model-preset`, `ai-config-lite-model-preset` | 추천 모델 custom select | S: 목록·현재 값 확인, 전체 제공자 모델 호환성 미검증 |
| `ai-config-model`, `ai-config-lite-model`, `ai-config-maxtokens` | 텍스트·숫자 설정 입력 | S: 폼 및 autosave 경로 확인, 경계값 미실행 |
| `ai-config-autonomy` | 자율성 프리셋 | B: max/confirm/balanced 선택 및 F6 대조 |
| `ai-config-reasoning` | 추론 강도 | S: 옵션 off/low/medium/high 확인 |
| `ai-config-agentmode` | auto/chat 선택 | B: 실제 custom select로 chat 선택, F 전송 수행 |
| `ai-font-size` | small/normal/large custom select | B: 세 값 선택, F6 |
| `ai-background-opacity` | range 78–100 | B: 키보드 End→100, 현재 패널에 즉시 반영 |
| `ai-config-save` | 즉시 persist | B: 저장값과 패널값 대조 |
| `ai-command-temperature-quiet-gold/ink-only/map-first` | 대기 화면 radio | B: 세 값 data-temperature 반영, F8 |
| `ai-preference-add` / 입력 Enter | `aiPreferenceMemorySettings.ts` 직접 성향 추가 | B: 격리 저장소에 한 행 추가 |
| `ai-preference-pin` | pinned 토글 | B: true→false 확인 |
| `ai-preference-delete` | 해당 행 삭제 | B: 1→0 |
| `ai-preference-clear` | 전체 성향 삭제 | B: QA용 재추가 후 0건 확인 |
| `ai-history-search` | 목록 필터 | B: 없는 검색어의 빈 상태 |
| `ai-history-open` | 저장 기록 읽기·세션 복원 | F: 2턴 응답 복원 성공 |
| `ai-history-delete` | 기록 삭제 | F: QA 기록 삭제 클릭, 브라우저 프로필도 폐기 |
| `ai-history-close` | 모달 닫기 | B: Escape, F7 |
| `ai-instructions-input`, `ai-instructions-save` | 프로젝트 고정 지침 편집·저장 | S: 원격 프로젝트 저작 범위가 아니므로 저장 미실행 |
| `ai-instructions-close` | 지침 모달 닫기 | B |
| `tool-browser-show-all/search/close` | 전체 도구·검색·닫기 | B |

모든 custom select의 실제 가시 버튼은 `[data-custom-select-for="<testid>"]`이다. 원래 `<select>`는 `aria-hidden=true`, `tabindex=-1`이다. 설정 검사는 그 가시 버튼과 `role=option`을 눌렀으며, 숨은 select의 값만 강제로 바꿔 UI 검사를 대체하지 않았다.

### 스튜디오

| 컨트롤 / 선택자 | 구현·동작 | 결과 |
|---|---|---|
| `topbar-ai-studio` | 공개 스튜디오 전환 이벤트 | B: 직접·history 경유 진입/복귀 대조 |
| `ai-studio-exit` | applyStudio(false) | B: 직접 진입에서는 정상, history 경유 F3 |
| `ai-studio-scenes-collapse`, `ai-studio-chat-collapse` | 해당 열 클래스 토글 | B: F5 |
| `ai-studio-deck-collapse` | 도구 덱 접기·펼치기 | B: 두 번 조작. 높이·키보드 모든 경계값은 미측정 |
| `ai-studio-tab-tools/work/changes/activity` | showTab | B: 네 탭 aria-selected 확인 |
| `ai-studio-tool-card[data-tool]` | 도구 설명으로 입력창 채우기 | B: author_house 카드가 입력창을 채움. 공유 생성 핸들러 조사, 모든 도구 실행은 아님 |
| `ai-studio-tools-all` | 전체 도구 브라우저 | B: 도구 브라우저 열림·닫힘 확인 |
| `ai-studio-tool-filter` | 도구 카드 필터 | B: NPC 검색 후 관련 카드 목록 확인 |
| `ai-studio-scene-search` | 장면 목록 필터 | B: 달빛 검색으로 달빛 숲 한 건 |
| `ai-studio-scene-add` | 새 맵 생성·선택 | S: 프로젝트 쓰기라 미실행 |
| `ai-studio-scene[data-map-id]` | 현재 맵 선택 | B: 달빛 숲 선택 후 일반 조수 맵 문맥도 달빛 숲으로 변경 |
| `ai-studio-scene-fold[data-map-id]` | 자식 장면 접기 | B: 접기·펼치기 왕복 |
| `ai-studio-split-scenes/chat/deck` | 드래그·방향키·Home/End·더블클릭 초기화 | B: 세 손잡이 방향키 16px 변화·더블클릭 초기화. Home/End·드래그 경계는 S |
| `editor-zoom-prev/stepper/next` | 기존 맵 줌 컨트롤을 스튜디오로 이동 | S: 재마운트 확인, 줌 QA는 미실행 |

### 응답에 따라 생성되는 컨트롤

| 컨트롤 / 선택자 | 구현·출현 조건 | 결과 |
|---|---|---|
| `ai-turn-rewind` | `aiChatPanel.ts`, 현재 세션 사용자 턴의 history marker | F: 입력 원문 복원·대화 되감기 확인. 맵 변경 되돌림은 미검증 |
| `ai-turn-group-toggle` | `aiConversationLog.ts`, 이전 턴 그룹 | F: 2턴에서 펼침·접힘 |
| `.ai-reasoning-toggle` | reasoning 항목 | S: 해당 응답 fixture 없음 |
| `ai-tool-activity-toggle` | 도구 작업 그룹 | S: 이번 fixture는 도구를 호출하지 않음 |
| `ai-error-open-settings` | 설정/실행 오류 말풍선 | S: 오류 생성 조건 조사 |
| `ai-proposal-dismiss`, 빈 제안의 `되묻기` | `aiChatPanelHelpers.ts`, 적용 호출 0건 | S: notice→제거/입력 포커스 경로 |
| `ai-change-expand`, `ai-change-undo` | `aiChangePreview.ts`, 실제 변경 전후 카드 | S: 프로젝트 변경을 생성하지 않음 |
| `ai-change-wide-mode-side/overlay`, `ai-change-wide-slider`, `ai-change-wide-close` | 확대 비교 뷰 | S: 변경 카드가 전제 |
| `ai-plan-book-open`, `ai-run-stop`, `ai-run-details-toggle` | `aiChatRenderers.ts`, 실행 계획·진행 상태 | S: 계획/실행 중 상태가 전제. 일반 abort만 F |
| `ai-plan-book-prev/next/close`, `ai-plan-book-dot`, `ai-plan-book-toc-row` | `aiWorkPlanModal.ts`, `aiWorkPlanBookDom.ts` | S: 페이지·목차·키보드 연결 조사 |
| `ai-vocab-edit-name/role/layerHome/patternKind-<n>` | 어휘 제안 카드의 입력·선택 | S: propose_tile_vocabulary가 전제 |
| 제안 승인 버튼 | `aiProposalCard.ts` | 현재 정책상 없음. 자동 적용이므로 누락 버튼 버그로 세지 않음 |

### 숨은 호환 훅·폐기 표면

- `ai-chat-toolbar`는 **hidden + inert**다. `ai-tools-browser`, `ai-harness`, `ai-studio-toggle`, `ai-dock-toggle`, `ai-export`, `ai-undo-last`, `ai-font-cycle`, `ai-new-session`, `ai-more-menu-toggle`은 메뉴 위임/테스트 호환용이다. 일반 사용자가 클릭 가능한 버튼으로 세지 않았다.
- 숨은 `ai-more-menu`의 `ai-more-compact/instructions/export/history/tools/settings`, `ai-temperature-*`도 같은 구분이다. `ai-more-actions`는 그 내부 details다.
- `ai-harness-download/close`는 숨은 진단 훅에서 여는 `aiHarnessModal.ts`의 컨트롤이다. S이며 이번 실제 UI 경로에서 실행하지 않았다.
- `chat-dock-toggle`, `ai-dock-mode-btn`, `ai-chat-detach`는 도크 3종 폐기와 함께 제거됐다. float/side/glass 전환 버튼이 없어졌다는 이유만으로 새 버그라고 보고하지 않았다.
- `aiStartScreenCards.ts`의 authoring 예제/visual/try 카드 생성기는 남아 있지만 `ensureStartScreen`은 no-op이다. 현재 노출된 버튼으로 오인하지 않았다.
- `aiAssistantPanel.ts`의 예전 preview/generate/approve는 별도 레거시 표면이다. 현재 메인 조수 데크의 승인 버튼으로 간주하지 않았다.

## 기존 테스트의 빈틈과 후속 수정 순서

이 PR에서 테스트를 통과시키기 위해 제품 동작을 바꾸지 않았다. 아래는 수정 작업을 시작할 때 필요한 회귀 기준이다.

1. **F1–F4를 먼저 수정:** `test/e2e/assistant-single-dock.spec.ts`에 작은 float뿐 아니라 긴 대화·전체 기록·history→studio 순서를 추가한다. `display` 검사와 실제 포인터 click을 함께 검사해야 한다.
2. **F5:** `test/aiStudioShell.test.ts`의 클래스/ARIA 검사에만 의존하지 않고, 실제 grid 열 너비와 모니터 증가분을 브라우저에서 잰다.
3. **F6/F8:** `test/e2e/assistant-glass-settings.spec.ts`에서 두 설정 진입점에 같은 글자·자율성·대기 화면 계약을 적용한다. 농도만 갱신되는 성공 사례가 나머지 설정을 보증하지 않는다.
4. **F7:** 모달의 양끝 Tab·Shift+Tab, Escape 후 attached opener 복원을 확인한다.
5. **F9:** 빈 내보내기에서 visible 메뉴와 액션 상태의 일치를 검사한다. 숨은 delegate를 직접 클릭하는 테스트는 이 문제를 놓친다.
6. **F10:** 빈 대화/입력 비포커스에서 실제 손잡이로 폭을 변경하고, settled geometry와 ARIA가 함께 갱신되는지 검사한다.

**미검증 범위:** 원격 프로젝트 데이터 변경, 실제 모델 생성 품질, 새 OAuth 인증·연결 해제, 적용/되돌리기·비교 카드·계획서·어휘 제안의 조건부 전체 동작, 모든 맵/도구 인스턴스 및 splitter 경계값. 목록과 연결은 조사했지만 실제 실행하지 않은 항목을 정상으로 보장하지 않는다.

## 검증·정리

- 제품 소스 변경 없음. 순수 보고서/증거이므로 제품 RED→GREEN이나 전체 build 통과를 주장하지 않는다.
- DOM 측정·실제 클릭·키보드·다운로드 이벤트·새로고침 검증을 수행했다. 발견된 UI FAIL은 그대로 보고서에 남겼다.
- JSON 증거는 파싱 검사, 문서는 diff/링크/내용 검토 대상으로 검증한다.
- JSON용 LSP는 설정된 Biome 실행 파일이 설치되지 않아 사용할 수 없다. 이를 타입 검사 성공으로 표시하지 않는다.
- 브라우저·전용 서버·임시 다운로드·프로필의 정리 내역은 증거 README에 기록한다.
