> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

## 이벤트 UX 2차 감사 후속: 선택·검색·목록·복제 (2026-10-04)

범위는 `verify-shots/editor-ux-audit-round2-20261004/agents/events-storage.md`의 1·2·5·6·7번이다.
저장 직렬화·여러 단계 역사 점프·초안 보관함(3·4·8번)은 감독자 소유이며 이 변경에서 다루지 않는다.
원본 README의 Ctrl+A 1,000명령 긴 작업 관측은 수정 전 증거다. Tab은 당시 긴 작업이 없었으므로
좁은 경계 탐색만 개선했다. 이번 변경의 성능 수치·네이티브 화면 합격을 아직 주장하지 않는다.

- **선택:** 경로를 한 번 인코딩한 Set으로 회원 여부를 판단한다. 표시면의 경로→행 사전을 재사용하고
  이전/다음 선택의 차이만 칠한다. 여러 보기에 같은 경로가 있으면 모두 반영하며 숨은 명령도 Ctrl+A에 포함한다.
  부모를 복사/잘라내면 자식은 중복 복사하지 않는다. Tab과 처리하지 않는 키는 선택/인스펙터를 바꾸지 않는다.
  선택 알림은 편집·히스토리 버튼만 갱신하며 검색을 다시 돌리지 않는다. 행 추가/삭제/경로 변경은 사전을 무효화한다.
- **검색:** 현재 페이지의 명령 요약·종류·대사 원문과 조상 경로를 모델에서 한 번 인덱싱한다.
  명령 배열 판본이나 정규화 검색어가 바뀔 때만 일치 집합을 계산한다. 표시면의 행/분기 묶음 좌표도 기억하며
  보이는 List/Story만 걸러내고 바뀐 hidden 값만 쓴다. 숨은 표시면은 다음 진입에 적용한다.
  Flow 결과 수는 모델에서 계산하므로 검색만으로 숨은 List를 만들지 않는다. 일치 자식의 조상·분기 묶음을 보존한다.
- **검사 배지:** 검사 결과마다 commandPath→문제 배열을 한 번 만든다. 행마다 전체 문제를 filter하지 않는다.
  같은 경로의 문제 순서·개수·최고 심각도·제목과 검사 목적지는 유지한다.
- **목록:** 첫 List 생성은 프레임마다 최대 80개 항목/약 8ms 목표로 나눈다(단일 행 생성 시간은 나누지 못한다).
  완성 전에는 `.cmd-list[aria-busy="true"]`와 `event-command-list-loading`이 있다. 숨기면 후속 생성도 멈추고
  List 진입에 재개한다. 새 판본·페이지·닫기로 무효화된 프레임은 옛 행을 붙이지 못한다.
  검사 목적지 이동/기존 명령 포커스 복원은 필요한 경우 `finishCommandListMount`로 완성하고 실제 경로에 포커스를 준다.
  배열 이동은 `eventCommandMove.pageId` 통지로 현재 List를 제자리 갱신한다. 같은 경로·명령 정체성·얼굴 상태·문제인
  행은 DOM을 유지하고 영향을 받은 자리만 교체한다. 얼굴 변경 뒤의 요약은 다음 얼굴 변경까지 다시 계산한다.
  Story/Flow 및 다른 편집은 기존 staged 본문 교체와 오류 회복 경로를 유지한다.
- **이벤트 쓰기:** 일반 프로젝트/맵 변경기의 얕은 복제 우회가 아니다. `store.updateEvent`는 선택한 이벤트 전체
  (페이지·중첩 명령·draft.original 포함)를 깊게 격리한 뒤 이벤트만 받는 변경기를 실행한다.
  `replaceEvent`는 외부 입력을 복제하고 `replaceEventCommands`는 교체할 명령 트리만 복제한다.
  배열 이동 전용 `reorderEventCommands`는 원본에서 양쪽 컨테이너를 먼저 검증하고 그 경로의 배열·부모 명령·선택지
  소유자만 복사한다. 공유 명령의 필드를 고치는 API로 쓰면 안 된다. 자기 자손 드롭·없는 분기·제자리 이동은 게시하지 않는다.
  프로젝트/맵 껍질과 events 배열은 새로 만들고 모든 타일 격자·다른 이벤트·다른 맵의 정체성은 보존한다.
  청소는 깊게 격리한 이벤트/새 명령에만 돌리고 이동은 이미 정규화된 명령만 재배열한다.
  기존 쓰기 권한·정본 권한 검사·mutation 기록·구독 통지·자동저장 예약·보관함 동기화는 유지한다.
- **페이지 히스토리:** 실제 store가 소유하는 페이지에만 `immutableSnapshots:true`를 켠다.
  before/undo/redo 기록은 불변 명령 판본을 보관하고 no-op은 구조 비교로 판단한다. 전체 페이지 stringify는 없다.
  복원은 입력을 격리하는 명령 교체 API를 쓴다. 일반/제자리 변경 호스트는 기본 깊은 복제 히스토리를 유지한다.
- **Tab:** 첫/마지막 포커스 후보를 기억하고 내부 이동은 브라우저에 맡긴다. 창의 DOM·hidden·disabled·tabindex·class·style·
  details/open·inert·상위 표시 속성·resize로 무효화한다. 같은 작업에서 속성을 바꾼 뒤 Tab을 눌러도 observer 기록을 먼저
  비우므로 늦은 경계를 쓰지 않는다. 알려진 숨은 하위 트리는 geometry 읽기 전에 제외하고 경계만 실측한다.
  중첩 모달이 최상위면 이 트랩은 개입하지 않으며 닫을 때 관찰자/리스너를 해제한다.

회귀 소스는 `test/ux2EventMutationIsolation.test.ts`, `test/ux2EventCommandSurfaces.test.ts`,
`test/ux2EventFocusBoundaries.test.ts`다. 테스트·gates·typecheck·브라우저·dev 서버를 실행하지 않았으며
esbuild transform으로 변경 TS의 구문만 확인한다. 구문 확인은 타입/실행/성능 확인을 대신하지 않는다.

**감독자의 실제 편집기 QA 순서:**

1. 후보 커밋의 실제 편집기에서 폐기 가능한 프로젝트를 연다. 실제 SQLite 대상이면 project id/폴더도 기록한다.
   100/1,000/5,000명령, 깊은 fork/choices/loop, 서로 다른 얼굴 변경, 검사 문제 0/10/100/1,000개를 준비한다.
   같은 환경의 기준 커밋 `7ce9a76555`와 비교하고 기존 감사 증거를 덮지 않는다. 모델 요청은 필요 없다.
2. List 첫 열기부터 busy 해제까지 전체 생성 시간과 초기 입력 반응/프레임 최대 작업을 각각 잰다.
   busy가 사라지기 전에도 Ctrl+A가 전체 모델을 고르는지 확인한다. 완료 뒤 20회 교대 클릭·Ctrl+A·다중 복사/잘라내기·
   붙여넣기·undo/redo를 수행하고 실제 선택/행/클립보드 내용·포커스·미변경 초안/이벤트를 확인한다.
3. List→Story→검색, Story부터 검색, Flow부터 검색, 무일치→지우기, 한글 조합 입력을 비교한다.
   숨은 List의 text/hidden 접근 횟수는 입력마다 0이어야 한다. 일치 개수·부모·분기 묶음과 검색창 포커스/커서를 확인한다.
   생성 중 다른 보기/페이지로 이동하거나 닫고 다시 열어 옛 프레임이 새 화면에 행을 추가하지 않는지도 확인한다.
4. 같은 1,000명령을 100×100/512×512 맵에서 가운데 한 칸 이동·양쪽 드롭·분기 간 드롭한다.
   타일 배열/다른 이벤트 정체성이 유지되고 옛 스냅샷/draft.original 바이트가 같은지 확인한다.
   List의 바깥 workbench와 미변경 행 DOM이 유지되고 이동한 자리·얼굴 미리보기·번호·검사 배지만 맞게 변하는지 확인한다.
   이동 취소/undo/redo, Apply 후 재편집·Cancel도 실제 컨트롤로 확인한다. 저장/재로드 합격은 감독자의 저장 슬라이스와 함께 확인한다.
5. 20회 Tab/Shift+Tab으로 양쪽 경계 wrap을 확인한다. List→Story/Flow, 무일치 검색, details 열기/닫기,
   같은 작업 안 disabled/hidden 변경, 새 버튼 추가, 중첩 편집/확인 창, 최소화·복원·크기 변경 뒤에도 반복한다.
   후보/geometry 읽기·handler CPU·page-wide long task를 따로 기록하고 iframe/자동화 왕복을 함수 CPU로 계산하지 않는다.

남은 한계: 전체 이벤트 검증·보관함 동기화는 그대로다. Story/Flow 이동은 기존 전체 본문 렌더다.
단일 복잡한 행과 명시적 목적지 이동/포커스 복원의 전체 mount는 프레임 목표를 넘을 수 있으므로 네이티브 측정이 필요하다.

## 이벤트 보기의 지연 생성 (2026-10-04)

`content.ts`는 현재 목록·스토리·플로우 보기만 처음에 만든다. 목록은 `ensureCommandList`에서 한 번 생성하며,
스토리와 플로우는 같은 보기에 머무는 재적용에서 중복 생성하지 않는다. 다른 보기로 나가면 스토리/플로우 본문을
비우고 다음 진입 때 최신 미리보기 위치로 다시 만든다. 기존 목록이 이미 생성됐으면 보기 전환에서 재사용한다.
검색은 전체 명령을 대상으로 유지한다. 2차 감사 후속에서는 플로우의 검색 결과 수도 모델에서 계산해 숨은 목록을 생성하지 않는다.

선택 권위는 `commandInspector.selectedCommandPath`다. AI 삽입 대상도 이 값을 읽도록 `aiAssist`의 선택 콜백을
연결했다. 숨은 목록의 `.selected` DOM 유무로 스토리/플로우의 선택을 잃어서는 안 된다.
명령 본문 변경은 기존 modal 재렌더·command history 계약을 따르며 실제 LLM 호출이나 명령 저장은 바꾸지 않았다.
네이티브 화면의 긴 목록, 보기 전환, 검색·선택 및 스토리부터 연 경우의 지연 생성 근거는
`verify-shots/editor-ux-improvements-20261004/README.md`와 `scripts/qa/editor-ux-forms-audit.mjs`를 본다.

## 명령 드래그 소유권과 레거시 페이지 붙여넣기 (2026-10-02)

- `commandListDragDrop.ts`는 같은 렌더의 `CommandListActions`가 시작한 전용 MIME 드래그만 받는다. 일반 `text/plain`의 `[0]`, 다른 이벤트 편집면의 드래그, 페이지 전환 전 드래그, 원본과 다른 경로 payload는 명령 이동이 아니다. 분기 경로의 음수 sentinel은 유지한다.
- 목록 host를 재사용하면 `ensureListDropHandlers`의 WeakMap을 최신 actions로 갱신한다. 첫 바인딩의 콜백을 영구 캡처하면 페이지를 바꾼 뒤 빈 목록 영역에 드롭할 때 이전 페이지를 수정한다. 비어 있는 목록도 바인딩을 갱신한다.
- 페이지가 없는 옛 이벤트에 `pasteEventPage`를 호출하면 기존 루트 명령·트리거·조건을 기본 페이지로 승격하고 복사본을 그 앞(낮은 우선순위)에 넣는다. 복사본 하나만 만들면 런타임이 원래 루트 명령을 더 이상 실행하지 않는다.
- 회귀 소스: `test/eventCommandDragOwnership.test.ts`, `test/eventCommandHistoryDrag.test.ts`, `test/eventEditorCommandBoard.test.ts`, `test/eventPages.test.ts`. 이번 세션은 테스트 실행 명시가 없어 스위트를 실행하지 않았다. 격리 브라우저 컴포넌트 관측 범위는 `verify-shots/event-drag-audit/README.md` 참조.

## 감사 후속: 조건 순서와 생활 경로 보존 (2026-09-20)

`pageConditions.ts`의 스위치 슬롯 편집은 기존 조건의 위치에서 교체한다. 첫 조건을 삭제 후 append하면 두 스위치 행이 서로 바뀌어 다음 편집 대상을 오인한다.
`pageNpcLiving.ts`는 첫 목적지의 좌표/방향만 바꾸고 기존 switchId 및 뒤 목적지를 보존한다. 이 폼이 전체 생활 경로를 다시 정의하는 것은 아니다.
실제 컴포넌트의 브라우저 관측값과 범위는 `docs/reviews/2026-09-20-data-integrity-fixes.md`에 있다.

# Editor Event Authoring

## AI 이벤트 작업함 — 여러 칸을 동시에 (2026-09-28)

빈 칸 우클릭의 첫 항목은 「AI로 여기에 이벤트...」(단축키 A)다. 편집기를 열지 않고 칸 옆에 한 줄 입력창을 띄우며,
Enter 로 맡기면 곧바로 닫혀 다음 칸을 누를 수 있다. 맡긴 일은 캔버스 오른쪽 아래 「AI 작업함」에 쌓이고 칸 위에 번호 핀이 선다.

- 코드: `src/ai/eventDraftAuthoring.ts`(문장 → 이벤트 한 개 전체: 이름·모습·트리거·페이지·조건),
  `src/editor/eventAiQueue/eventAiQueue.ts`(큐·동시 실행·배치), `eventAiQueueView.ts`(핀·입력창·작업함), `styles/map/event-ai-queue.css`.
- 채팅 조수 세션을 빌리지 않는다. 그 세션은 한 턴·초안 하나라 여러 개를 동시에 돌릴 수 없었다. 작업마다 자기 호출을 갖고,
  동시 실행 수만 전역 상한(기본 4, 최대 8)으로 제한한다.
- 명령 사전과 검증은 페이지 작성기와 공유한다: `eventCommandCatalogSections` · `validateAssistCommandValue`(eventCommandAssist.ts).
  이벤트 겉모양(모습 id·트리거·우선순위·조건)만 이 생성기가 따로 검증한다. 상태는 셀프 스위치만 쓰게 해 전역 스위치 번호가 겹치지 않는다.
- 결과는 이벤트 한 개 조각이다. 배치 직전에 칸이 비었는지 다시 보고, 찼으면 「막힘」으로 돌린다. 배치 한 번 = 맵 스냅샷 한 칸(되돌리기 한 번에 그 이벤트만).
- 이벤트가 **있는** 칸은 기존대로 「이 이벤트를 AI 로 고치기...」 → 편집기 명령 도크다.
- 이벤트 추가(`scope:"map"` + `eventId`, 칸 목록 없음)는 EditScene 이 번들 캐릭셋을 뒤늦게 싣는다 — 없으면 처음 쓰는 상자·주민 그림이 빈 칸 표식으로 보였다.
- 브라우저 증거: `test/e2e/_event-ai-queue-shots.spec.ts` → `verify-shots/event-ai-queue/` (8칸, 최대 동시 호출 4, 7개 배치·1개 막힘, 되돌리기 1회 = 이벤트 1개).

## 조수에서도 이벤트 명령 생성기 사용 (2026-09-20)

「AI로 명령 만들기」 버튼은 공용 조수 브리지·세션·턴 실행기로 들어간다. 호스트가
현재 이벤트·페이지·선택 명령을 전달하고, 실행 가능한 도구와 쓰기 대상을 해당 페이지로
제한한다. `event_command_assist`가 기존 생성/검증을 맡으며 모달 안에서 명령 diff를
검토하고 줄을 제외·수정한 뒤 기존 일괄 적용과 한 번 되돌리기를 사용한다.
대상 페이지·추가 전용 모드·취소/오래된 결과 거부 계약은 `editor-ai-tools.md`의
「이벤트 명령 AI 공용 도구」 절을 따른다.

## 적대적 리뷰 고위험 항목 보정 (2026-09-19)

- 이벤트 삭제 전 확인 문구가 저장하지 않은 초안을 알려 주고, 맵 히스토리 스냅샷이 초안까지 보존하므로 토스트 복구/Ctrl+Z가 새 이벤트와 편집 중인 이벤트를 되살린다. 새 이벤트 모달 재진입은 `draft.kind === "new"`도 계속 편집한다. 원격/교체 스냅샷이 같은 이벤트를 바꾸거나 지우면 로컬 초안을 유지하면서 `draft.conflict`를 표시하고 푸터에 충돌 상태를 알린다.
- 새 페이지는 현재 승자(선택 페이지가 없으면 마지막 페이지) 앞에 삽입되어 빈 페이지를 만드는 순간 런타임 우선순위가 바뀌지 않는다. 페이지 탭의 추가 안내와 도움말도 이 계약을 설명한다.
- 명령 피커는 맵·공통·전투 이벤트 컨텍스트에 맞춰 M2 항목을 필터링한다. Tint Screen은 `durationMs`를 정본으로 사용하고(레거시 `duration`만 작은 값을 초로 환산), 폼·요약·미리보기·런타임이 같은 변환을 공유한다. 상점 편집기/미리보기는 현재 계절의 `priceBySeason`을 계산해 표시한다.
- AI 초안은 생성 시점의 명령 목록 서명을 저장하고 적용 직전에 다시 비교한다. append 응답은 기존 명령과 같은 자기 필드 서명이면 검증 실패로 되돌려 자가 수정한다.
- 가져오기는 프로젝트 교체 확인을 거치며, 이벤트 모달·서브다이얼로그의 포커스 트랩은 문서 캡처 단계에서 포커스가 바깥으로 빠진 경우에도 첫/마지막 컨트롤로 되돌린다. 상태 텍스트에는 `role=status`/`aria-live`가 있다.
- M2 명령은 저장·AI 경계에서 카탈로그 ID, 필드 원시 타입, 선택지 값을 검증한다. 명령 목록 컨텍스트 메뉴는 현재 포커스한 menuitem을 활성화하고 방향키로 이동한다.

## 등장 조건은 조건 그룹을 기본으로 펼친다 (2026-09-19)

페이지에 `conditions`가 하나라도 있으면 이벤트 편집기 설정 레일의 첫 활성 그룹은
「언제 보이나요」(`when`)다. 조건이 없는 페이지는 기존처럼 「모습과 대화」에서 시작한다.
사용자가 다른 그룹을 선택한 뒤에는 `activeEventRailGroup` 상태를 존중한다. 조건을
작성했는데도 조건 편집면이 접힌 채 시작해 등장 조건이 안 보이던 UX 회귀를 막는 계약이다.

## 명령 중심 배치와 AI 작성 모달 (2026-09-18)

- `content.ts`의 `event-editor-command-focused`는 왼쪽 페이지 설정, 중앙 명령,
  오른쪽 상시 미리보기로 배치한다. `styles/event/command-workbench.css`가 마지막
  event-layer import로 열 배치를 소유한다. 기존 인스펙터의 `grid-column: 2`와
  좁은 화면 absolute 덮개 규칙을 되살리면 명령이 리사이저 트랙에 들어가거나 가려진다.
- 첫 방문은 목록 보기다. 중앙 보기 전환은 목록·스토리·플로우이며, 미리보기는
  목록을 대체하지 않는다. 선택 전에는 기존 페이지 순차 미리보기를 오른쪽에 표시한다.
  단일 클릭은 선택 강조와 오른쪽 미리보기만 갱신한다. 수정 폼이나 미리보기를
  명령 아래에 펼치지 않는다(사용자 후속 수정). 더블클릭·Enter/Space·명령 편집
  액션에서 기존 명령 편집 다이얼로그를 연다.
- AI 버튼은 `aiAssist.ts`의 작성 모달을 연다. `eventAiModal.ts`는 배경 입력 차단,
  Tab 순환, 닫기 후 포커스 복원을 맡고 Escape는 기존 modalStack을 사용한다.
  초안은 모달 안의 `stagedHost`에만 표시한다. 중앙 목록과 명령 수는 적용 전까지
  저작 데이터를 기준으로 유지한다. 각 초안 행의 수정은 기존 명령 편집 다이얼로그를
  사용하며 프로젝트에 즉시 쓰지 않는다. 최종 적용은 기존 replaceAll 한 번으로
  처리하므로 한 번의 되돌리기 계약을 유지한다.
- `modal.ts`는 포커스된 인라인 입력을 교체할 때 발생하는 동기 change/store 재진입을
  직렬화한다. 이전 표면의 selection listener는 렌더 시작 시 해제한다. 이 둘이 없으면
  중첩 렌더가 공유 인스펙터·AI 호스트를 분리된 DOM으로 바꾸어 입력 후 선택이 사라지거나
  AI 모달에서 Escape가 부모 편집기를 닫는다. AI 모달 스택 등록은 부착된 DOM만 소유한다.
- 1600px 화면 실측: 설정 240px / 리사이저 6px / 명령 약 789px / 미리보기 약 403px.
  1024px에서는 200 / 6 / 492 / 260px이며 800px 이하에서는 세로로 배치한다.
  명령 영역은 선택 전후 같은 행 배치를 유지한다.
- 브라우저 캡처: `output/evidence/event-command-layout/`의 기본 화면, 선택 명령,
  AI 모달, 1024px 화면. 기존 샘플의 임시 세션으로 UI만 확인했으며 원격 콘텐츠
  저장 작업은 아니다. 전체 gates/vitest/typecheck 및 실제 LLM 생성은 실행하지 않았다.


## 배우·파티·시점·회차·요일·문자열 조건 (명작 공백 G1, 2026-09-27)

쯔꾸르·JRPG 명작 20편 대조에서 가장 많은 우회의 뿌리는 **이벤트가 배우 레벨·HP·상태를 못 읽는 것**이었다.
13개 조건을 한 해석기(`src/project/conditionActorQueries.ts` `evalActorQueryCondition`)에 모으고
세 평가기(맵 fork `session.evalCondition`, 페이지 `io/pageResolution.ts`, 트룹 `battle/battleEvents.ts`)가 같은 함수를 부른다.
`test/conditionEvaluatorParity.test.ts` 가 세 표면의 판정 일치를 kind 마다 고정한다.

| kind | 읽는 것 | 해석 불가일 때 |
|---|---|---|
| `actorStat` | 배우(또는 `leader`)의 level·hp·mp·hpPercent·mpPercent | 파티에 없으면 거짓 |
| `actorState` | 배우(`anyone`·`leader`·id)의 상태 보유 | — |
| `partyLeader` · `partySize` | 선두 배우 · 인원 | 빈 파티면 선두 거짓 |
| `facing` | 주인공(`session.playerFacing`) 또는 이 이벤트의 방향 | 이벤트 위치 모르면 거짓 |
| `relativeFacing` | 주인공이 이벤트를 봄 / 이벤트 등 뒤 / 이벤트가 주인공 등 뒤 | 같은 칸은 거짓 |
| `hiding` · `pursuitActive` | 숨는 중 · 추격 중(`session.horror`) | — |
| `clearCount` · `endingSeen` · `newGamePlus` | **기기** 회차 기록(`session.clearHistory`, 부팅 때 clearRecord 에서 채움) | 기록 없으면 0회 |
| `weekday` | 게임 달력 요일(0=일…6=토, `system.timeSystem.startWeekday` 기본 월) | 시계 꺼짐이면 거짓 |
| `stringVariable` | 문자열 변수 ==·!=·포함·비어 있음 | 없는 변수는 빈 문자열 |

- **Data Query**(m2-217)에 같은 조회 14종을 더했다 — `actorLevel/actorHp/actorMp/actorMaxHp/actorHpPercent/actorHasState/partyLeaderIndex/partySize/playerFacing/playtimeSeconds/steps/clearCount/weekday/stringLength`. 식(m2-216)은 `leaderLevel·leaderHp·leaderMp·leaderHpPercent·partySize·playtime·steps·clearCount` 를 식별자로 읽는다.
- **문자 입력**: `enterHeroName.stringVariableId` 를 주면 배우 이름 대신 문자열 변수에 저장한다(`prompt` 가 창 제목). 대사에서 `\T[id]` 로 찍는다(`\S[n]` 은 이미 속도 제어라 `T`).
- 세션 새 칸 `playerFacing`·`stringVariables`·`stepCount` 는 세이브에 들어가고, `clearHistory` 는 **세이브에 넣지 않는다**(회차는 슬롯이 아니라 기기에 속한다).
- 편집기: 조건 종류 선택기·고급 조건 목록 모두 `actorQueryConditionForm.ts` 하나가 그린다. 없는 배우·상태·엔딩 참조는 초안 검증이 `condition.<kind>.reference` 경고로 잡는다.
- **추격 훅(#28)**: 추격자 `movement.pursuit.lostSwitchId` 는 수색 끝에 포기하는 순간 켜고 다시 발견하면 끈다. `followSwitchId` 는 문을 따라 다른 맵으로 넘어오기 시작하면 켠다(`horrorRuntime.ts` / `pursuitDoors.ts`). 페이지 조건으로 「따돌렸다」·「문이 열린다」 연출을 건다. 페이지 추격 패널과 `configure_object_behavior` 의 `pursuit` 에 노출, `test/mgPursuitHooks.test.ts`.
- 난이도·아이템 사용 조건(`difficulty`·`itemUsed`)은 간단 행이 없어 고급 조건 목록에 나온다(`pageConditionLayout.ts`).

## 구역(로케이션) 조건분기 (OPRN-OUT-020, 2026-09-10)

`Condition` 에 `{ kind: "insideLocation", locationId, inside }` 가 있다. 「조건 종류」 선택기의
**구역(로케이션)** 이고, fork(조건분기)와 페이지 출현 조건 양쪽에서 저작한다. 좌표를 적지 않는다 —
`GameMap.locations` 의 사각형을 가리키므로 구역을 옮기거나 넓히면 조건도 함께 따라온다.

- 선택기는 **현재 맵의 로케이션만** 담는다(`renderInsideLocationCondition` in `conditionForm.ts`).
  조건은 맵 경계를 넘지 않으므로 다른 맵 목록을 섞으면 절대 참이 되지 않는 조건이 만들어진다.
- **끊긴 참조는 목록에서 사라지지 않고 「(삭제된 로케이션 …)」 항목으로 남는다.** 조용히 다른 구역으로
  갈아치우면 사고가 데이터에 굳는다. 같은 상태를 `eventDraftValidator` 가
  `condition.insideLocation.missing`(error, field `event-condition-inside-location`)로 막고,
  `projectLint` 가 `map-location-missing-ref` 로 올린다.
- 요약 문장은 `src/editor/mapLocationLabels.ts` 한 곳이 만든다(`insideLocationSentence`) — 명령 요약·
  페이지 조건 문장·배지가 같은 낱말을 쓴다. 배지는 이름 10자 절단 + 「안/밖」.
- 미리보기(`conditionEvalPreview`)는 이 조건을 **판정 불가(undefined)** 로 둔다 — 미리보기 세션에는
  주인공 좌표가 없으므로 참/거짓을 지어내지 않는다.
- 구역을 그리는 곳은 맵 캔버스 툴바의 **로케이션** 토글이다. 계약은
  `openwiki/runtime-project-schema.md` 의 「명명 로케이션 레이어」 절이 소유한다.
- 회귀: `test/mapNamedLocations.test.ts`(조건 의미·이름 변경 후 참조 생존·페이지 조건),
  `test/conditionEvaluatorParity.test.ts`(페이지·맵 fork·전투 세 표면 일치),
  `test/commandKindCoverage.test.ts`(shape 왕복).

## 구역 드나듦 트리거 (2026-09-10)

「시작 방식」 선택기의 **「구역에 드나들면」**(`{ kind:"locationTransition", locationId, transition }`).
OPRN-OUT-020 이 미뤄 둔 enter/leave 이고, 제품 책임자 승인 후 **기존 트리거 유니온과 기존
디스패치**를 확장했다(새 스케줄러 없음). 런타임 계약·경계 사례는
`openwiki/runtime-project-schema.md` 의 「구역 드나듦 트리거」 절이 소유한다.

- 고르면 그 아래에 구역·시점 선택기가 붙는다(`event-page-trigger-location`,
  `event-page-trigger-location-transition`). **구역은 이름으로 고른다 — 좌표 입력칸이 없다.**
  사각형은 로케이션 레이어가 소유하고 트리거는 ID 만 저장하므로 이름을 바꿔도 참조가 살아 있다.
- 표면의 집은 `src/editor/locationTriggerAuthoring.ts` 하나다. 끊긴 참조 문구는 이미 있던
  `mapLocationLabels`(`insideLocationSentence` 와 같은 규칙)를 재사용한다 — 같은 사실을 두 낱말로
  말하지 않는다. 호버 카드 라벨도 구역 이름을 담은 문장을 쓴다(「구역」만 적으면 어느 구역인지
  안 보인다).
- **끊긴 참조는 조건과 같은 통로다.** 선택기에서 사라지지 않고 「(삭제된 로케이션 …)」 항목으로
  남고(조용히 다른 구역으로 갈아치우면 사고가 데이터에 굳는다), `eventDraftValidator` 가
  `page.trigger.location-missing`(error, field `event-page-trigger-location`)으로 적용/테스트를
  막고, `projectLint` 가 `map-location-missing-ref` 로 올린다. 복구
  (`repairMapLocationReferences`)의 `detach` 는 시작 방식을 **`action` 으로 강등**한다 —
  `auto` 로 강등하면 맵 진입마다 멋대로 돌고, 명령을 지우면 저작이 사라진다.
- `triggerFromKind` 는 이제 `SimpleTriggerKind`(매개변수 없는 종류)만 받는다. 이 트리거를
  `{ kind }` 만으로 지으면 서란된 데이터가 되므로 타입으로 막았고, 생산기는
  `locationTransitionTrigger`(이전 값 보존 + 첫 구역 기본값) 하나다.
- 회귀: `test/locationTransitionAuthoring.test.ts`(12건, 실제 DOM — 선택 가능성·이름 목록·
  ID 안정성·구역 없는 맵 안내·삭제된 구역 항목·검증기 차단),
  `test/locationTransitions.test.ts`(진단·복구), 브라우저 증거 `verify-shots/loc-transition/`.

## Native battle confirmation admission (2026-09-08)

`commandEditDialog.ts` validates native battle commands before its button-based
Confirm. `commandBodyDatabase.ts` rechecks the current project records, shows the
existing `battle-processing-warning` as a focusable alert, and retains the mounted
staged draft when the fixed troop is empty/missing, its effective composition is
empty, or variable mode has no existing variable selected. Rule/preset and branch
edits survive rejection and correction; changing the troop source still swaps one
picker slot rather than mounting two. An unused fixed reference is not required
in variable mode; the runtime variable value is validated when the battle starts.

The aggregate event validator also blocks Apply/Test for empty fixed composition,
using `battle.troop.empty` and the troop picker locator. Existing missing-reference
rules remain. Nonempty legacy enemyIds and hidden members are legitimate runtime
composition, not empty battles. No command draft is committed or discarded by a
failed Confirm. Tests: `eventBattleAdmission` and `battleProcessingCommandBody`.
Lead browser checks should use the real picker/Confirm controls, verify that the
same dialog remains open with its prior rule edits, then correct and save/reopen.

## Character graphic no-match recovery (OUT-007, 2026-09-08)

- Reproduced surface: Event editor > graphic picker > advanced direct ID. An
  unavailable ID formerly closed the picker and entered a dangling sprite ID
  into the event draft. `npcGraphicPicker.ts` now checks the current shared
  `projectCharsetAssets` catalog at confirmation, returning a local typed
  `no-match` instead of a graphic. The request stays editable and the live
  status names the searched bundled/uploaded sources and recovery choices.
- Manual catalog selection retries normally. Cancel writes nothing. Explicit
  `그림 없이 계속` removes only the sprite reference, preserving the separate
  authored `transparent` flag. No sprite already means no map image; setting
  transparency here would leave later manual selections invisibly hidden.
  Reopening and confirming restores visible graphics without unhiding an
  intentionally hidden page. Commands, identity and conditions remain intact.
  An empty catalog uses those same actions rather than throwing during render.
  Lookup does not catch or reclassify image, transport, generation or save errors.
- The shared AI query boundary already uses `ToolError(graphic-not-found)` with
  candidates; `place_npc` rejection is atomic and explicit manual/transparent
  retries work. No broad AI data-loss defect or new resolver abstraction is claimed.
- Regressions: `test/npcGraphicRecovery.test.ts`; real-browser driver:
  `node scripts/qa/character-asset-recovery.mjs` (`BASE_URL`, `QA_WIDTH`, `QA_OUTPUT`).
  It uses a local-only editor draft, never remote project writes or mocked assets.

## Page preview state follows the current script (2026-09-08)

- `previewSimulation.ts` carries the active face (resource, side, flip) in each
  transient state snapshot. A face-clear command removes it. Skipped branches
  do not apply it, and choice-local state does not leak into sibling/outer steps.
- `eventScriptModernViews.ts` reads the step snapshot instead of scanning prior
  commands or keeping a page-keyed face cache. Editing a face while a later
  dialogue step is selected therefore updates immediately, including clear.
- `commandPreview.ts` uses those face options and simulated variable values for
  dialogue rendering. List-to-inspector/edit-dialog face context uses the same
  `ActiveFace` shape so right-side and flipped faces are not lost.
- Authoring views reserve the inspector track before selection. Otherwise the
  first click opens the inspector, wraps the toolbar and moves the command row
  under a view tab before the second click. Preview/flow and staged proposals
  can still expand when no inspector is open; closing an inspector in a list
  must not move the row. The browser regression checks cold and reopened cases.
- Regression: `test/eventPreviewState.test.ts`; real UI edit/clear/side/flip,
  variable interpolation, skipped branches and view/transport transitions:
  `test/e2e/event-preview-state.spec.ts`. A worktree-only pass is not deployment:
  confirm the actual served bundle and repeat edits on the production preview.

## Event editor window controls (2026-09-06)

- `eventEditor/modal.ts` retains one mounted editor while minimized, rather than
  closing or creating another draft. The top-right group uses native SVG buttons:
  `event-editor-window-minimize`, `event-editor-window-fullscreen`, and the
  existing `event-editor-modal-close`. Full-view rendering/geometry is still
  owned by `modalFullscreen.ts`; drag/resize keep their existing owners.
- The final `event-editor.balanced.css` rules override the old full-viewport
  default with an inset, bounded normal window and right-aligned 32px controls.
  Full view uses the existing 6px viewport inset and restores prior inline size
  and translation. Double-click ignores button SVG/summary targets; Alt+Enter
  and Escape retain their previous maximize/restore behavior.
- Minimize suspends refresh **before blur**, preserving native pending fields,
  dynamic DOM, selection and caret through background map/selection updates.
  It removes the modal stack entry, focus trap and body-open class and hides the
  whole backdrop. `hotkeys.ts` ignores hidden retained event modals for both
  general map shortcuts and history ownership. `event-editor-window-restore` is a named keyboard-reachable
  chip, not a modal. Restore reinstates the saved event/page selection while
  refresh is still suspended, then returns keyboard focus to the retained field.
  Same-event map reopening dispatches restore, including new unsaved drafts.
- Store subscriptions remain only to preserve draft validity while dormant:
  deletion with an empty vault closes; `projectSwitch` or project identity change
  tears down without discarding/writing the incoming project's same-ID draft.
  Ordinary undo/AI replace continues to honor the existing draft vault contract.
- Close cleanup is shared by normal close, switch, project replacement and the
  existing `oprn:event-editor-close` event. A body detach observer also disposes
  externally removed modals. All subscriptions, checkpoints, custom-select and
  fullscreen listeners, restore chip and focus ownership end there. Pending
  discard confirms are bound to their owning editor and canceled on teardown;
  stale asynchronous approvals cannot reopen an editor in a new project.
- Switching to a different event restores a dormant window before flushing and
  asking to discard; declining keeps the original draft's map and page. After
  a successful existing/new draft open, the shared modal-open boundary reapplies
  the requested map through `selectEditorMap` with `clearEventSelection: false`.
  Otherwise restoring the old window leaves the canvas/map tree on map A while
  the new modal edits map B. Two-map tests cover clean/approved opens, cancellation,
  and restoring a nondefault page. Minimize/restore does not steal
  focus from a higher modal. Save/Apply/Cancel and local command history remain
  unchanged; no app-wide window manager or persistence schema was introduced.
- Deterministic happy-dom coverage: `test/eventEditorWindowControls.test.ts`.
  Browser surface scenario: `test/e2e/event-editor-window-controls.spec.ts`, using
  a local-only blank session and real native pointer/keyboard controls at
  1024x768, 1280x800, 1440x900. Run with
  `DEV_SERVER_PORT=<worktree-port> E2E_RETRIES=0 npx playwright test test/e2e/event-editor-window-controls.spec.ts`.
  It has no fixed sleeps or polling loop; output includes normal/minimized/
  maximized/saved screenshots. Lead owns full gates and independent visual QA.

## 이벤트 편집기 가독성 — 읽는 글자와 꾸미는 글자 (2026-09-03 후속)

P0 문법 고정 뒤에도 「가독성이 여전히 떨어진다」는 피드백이 와서, 목록 보기를 다시 실측하고 고쳤다. 실측은 `scripts/qa-event-editor-ux.mjs` 의 C13~C16 이고, 증거는 `.omo/evidence/event-editor-ux/readability-red/`(고치기 전) 와 `readability-green/`(고친 뒤) 이다.

- **원인(RED 실측, 14행·분기 2종 이벤트)**: 명령 요약 글자가 12px(글자 수의 72~78%) — P0 가 보조 12px 목록에 `.cmd-summary-token` 을 넣은 탓이다. 행마다 네 변 테두리 상자가 둘(행 테두리 + 분류 알약, 14행에 32개). 라벨(액센트 파랑)·값(초록)·본문(검정)이 같은 무게로 섞여 7:1 대비 글자가 43% 뿐. 들여쓰기 18px, 마커 줄은 명령 행과 같은 글자.
- **규칙**: 읽는 글자(요약 본문·값·선택지 칩·스토리 detail·인스펙터 제목·입력) 14px/20px `--text-1`; 꾸미는 글자(번호·종류 라벨·마커·힌트) 12px `--text-2`. 종류 라벨 「문장 표시」는 꾸미는 글자다(`--text-2` 500). 행은 줄이다 — 흰 바탕, 테두리·틴트 없음, 34px, 상태는 배경(hover `--bg-hover` · 선택 `--accent-muted` + 왼쪽 3px). 분류 알약은 색 아이콘 + 회색 낱말. 들여쓰기 28px + 세로선, 마커 줄은 12px 700 에 갈래 톤(fork 액센트 · choices 경고 · shop 성공) 2px 표식. 긴 대사는 두 줄까지 보이고 줄임표.
- **어디서**: 전부 `src/styles/editor/event-editor.balanced.css` 끝 「가독성」 절. DOM 은 안 건드렸다(testid·클래스 그대로). P0 절의 12px 목록에서 `.cmd-summary-token`, 13px 목록에서 `.event-storyboard-card-detail`·`.event-inspector-title` 을 뺐다.
- **함정 1 — flex 줄어듦**: `.cmd-list` 는 세로 flex 라 내용이 넘치면 항목이 먼저 줄어든다. 마커 줄에 `min-height: 0` 을 주자 13px 로 짜부라져 표식이 잘렸다(실측 height 12.6px). 행·마커에 `flex: 0 0 auto`.
- **함정 2 — 게이트의 기본 이벤트는 명령 1개**: 읽기 지표를 그 위에서 재면 글자 39자·행 1·마커 0 이라 뜻이 없다. C13 앞에서 모달 dataset(mapId/eventId)의 이벤트에 선택지·조건 분기 6줄을 `__oprnEditorStore.update` 로 그 자리에 더 심는다(모달이 store 를 구독해 다시 그린다). 닫고 새 이벤트를 여는 길은 「취소(삭제)」 확인창에 막혔다.
- **함정 3 — C12 의 마지막 Escape**: 팝오버가 이미 닫힌 뒤라 편집기 층에 닿아 「적용하지 않은 변경」 확인창을 띄운다. 지표엔 영향이 없지만 증거 사진을 가려서 C13 앞에서 「계속 편집」(`app-modal-cancel`)으로 물린다.
- **함정 4 — 공유 머신의 net::ERR_NETWORK_CHANGED**: 모듈 로드가 통째로 죽어 빈 문서로 4분을 기다렸다. 부팅 폴링이 45초마다 reload 한다.
- **결과(GREEN)**: 중앙값 12 → 14px(14px 글자 82%), 7:1 대비 43% → 98%, 행당 상자 2.29 → 0, 들여쓰기 18 → 28px. C7~C12 는 그대로 통과(C8 허용 집합에 14 추가).

## 이벤트 편집기 문법 고정 — P0 (2026-09-03)

제안서 `docs/proposals/2026-09-03-event-editor-ux-redesign.html`(실측 45장 · DOM 계측) 의 P0 를 구현했다. 표면 구조(보기 4종 · 인스펙터/모달 · 도구 ▾)는 건드리지 않고 문법과 탈출 규칙만 고정한다. P1(보기 통합 · 모달 폐지 · 인라인 팔레트) · P2(사이드 시트 · CSS 세대 삭제)는 e2e 계약 이관이 선행돼야 한다 — 같은 제안서 §15.

- **스타일은 `src/styles/editor/event-editor.balanced.css` 끝 「문법 고정」 절에서만 고친다.** 캐스케이드 최종 승자다([[rpg-zzu-event-editor-css-cascade]] 실측). 새 시트 · `important` 선언 · 새 hex 는 CSS 예산 래칫(`npm run gates -- --only css`)이 막는다. 앞 세대(blocks.css 등)가 5중 클래스 선택자를 쓰는 곳은 DOM 사슬을 따라 특이도를 맞춘다.
- **규격**: 글자 12 · 13 · 15 · 18px, 라운딩 6 · 4px · 50%(점), `--text-3` 는 순백 위 12px 이상에서만, 버튼 여섯 묶음(채움 · 테두리 · 유령 · 아이콘 · 위험 · 칩). 값과 근거는 `DESIGN.md` 「One grammar, measured (2026-09-03)」.
- **아이콘**: `src/editor/panels/eventEditor/editorIcons.ts` 의 `renderEditorIcon(name)` 하나만 쓴다(빌더는 저장소 공용 `buildSvgIcon`). 글리프 문자(↑ ✎ ✕ ⛶ ❝ ◇ …)를 버튼 텍스트로 넣지 말 것 — 게이트 C10 이 잡는다. 분류 아이콘은 `CategoryVisual.icon` + `renderCategoryIcon()`; `data-glyph` 는 호환용 속성으로만 남고 `::before` 는 꺼져 있다.
- **탈출 규칙**: 툴바 팝오버(`<details>`)는 `makePopoverEscapable` 이 Escape 층 등록과 바깥 pointerdown 닫힘을 함께 건다. 닫기 확인창 문구는 실제 푸터 버튼(「적용」 「저장하고 닫기」)만 가리킨다 — 테스트 `test/eventEditorModalClose.test.ts`.
- **헤더**: 이름 상자(`event-editor-name`) = **이벤트 이름**(`GameEvent.name`, 2026-09-18) · 맵 이름(`event-editor-map-name`) · 좌표 · 이벤트 ID 칩(≤1100px 에서는 접힘) · NPC 칩(연결됐을 때만). 이름을 아직 짓지 않은 옛 저작물은 빌려 쓰는 페이지 이름을 placeholder 로 보이고 옆에 「표시 이름: … (페이지 이름에서)」(`event-editor-identity`) 를 붙인다. 「페이지 N/M」 카운터는 없다.
- **원시 ID**: 명령 요약과 이동 경로 대상은 `eventNameForSummary()`(commandSummary.ts) 로 이름을 보인다. `eventDisplayName` 정의는 `@/project/eventDisplayName` 로 옮겼다(eventMarkerUx ↔ commandSummary 순환 방지, 기존 import 경로는 재export).
- **끝 행**: 명령 목록은 「선택 끝」「분기 끝」 마커 행을 두지 않는다(`branchGroupEndLabel` 삭제). 분기 머리 · 들여쓰기 · 빈 분기 행은 그대로.
- **측정**: `QA_BASE_URL=http://127.0.0.1:<port> node scripts/qa-event-editor-ux.mjs --label <name>` — C7~C12 가 문법 게이트다. main 기준 RED(`.omo/evidence/event-editor-ux/p0-red/`) 와 구현 뒤 GREEN(`p0-green/`) 결과를 남겼다. 표면 스냅샷(글리프 → SVG, 끝 행 제거)은 의도한 변경이라 기준선을 다시 떴다.


## 2026-09-17 적대적 리뷰 P0 다섯 가지 수정 (2026-09-18)

근거: `docs/2026-09-17-event-editor-authoring-adversarial-review.md`. 실제로 NPC 하나를 저작하며 찍은 리뷰의 P0 다섯 개와 P1·P2 일부를 고쳤다. 계약이 바뀐 것만 적는다.

- **이벤트 이름은 `GameEvent.name` 이다.** `eventDisplayName()`(`@/project/eventDisplayName`) 규칙: ① `name` → ② 이름 붙은 마지막 페이지(단 자동 이름 `페이지 N` 은 **이름으로 치지 않는다**) → ③ ID. 헤더의 큰 상자가 `name` 을 쓴다(`updateEvent(mapId, id, { name })`). 페이지 이름은 탭 더블클릭·F2·우클릭 「이름 바꾸기」(`evt-page-rename-N`, `event-page-menu-rename`)와 설정 열 맨 위 「페이지 이름」(`event-classic-name` > `event-page-name-input`)에서 고친다 — 이 컨트롤은 레일 그룹 밖 한 줄이라 «기타» 그룹을 만들지 않는다. 왜: 예전엔 이 상자가 활성 페이지 이름이었고 2페이지를 자동 이름 그대로 두고 저장하면 NPC 가 맵 툴팁·목록·인스펙터에서 전부 「페이지 2」로 불렸다.
- **참조 조건은 비운 채 세운다.** 칩(스위치·스위치 2·변수·아이템·주인공)과 고급 조건·`compileConditionFromText` 폴백·빈 `not` 그룹 모두 `switchId/variableId/itemId/actorId: ""`. 첫 레코드(대개 퀘스트 스위치 0001)는 사용자의 선택이 아니다. 칩을 **실제로 클릭**하면 재렌더 뒤 그 행의 피커가 바로 열린다(`isTrusted` 클릭만 — 테스트의 합성 click 은 창을 띄우지 않는다). 레코드 피커는 지금 값이 목록에 없으면 **아무것도 미리 고르지 않고**(「선택」 비활성), 개명은 선택 행의 「이름 바꾸기」(`event-record-picker-rename-open`) 뒤에만 펼친다. 「+ 새 …」는 만든 레코드의 이름 상자를 펼치고 포커스를 준다. 구획 머리 숫자는 전체 일치 수고 200개 넘으면 「처음 N개만 표시」를 적는다.
- **삽입 자리 규칙은 하나다.** 「+ 명령」·Enter(피커)·붙여넣기(Ctrl+V)·우클릭 「아래에 삽입…」/「아래에 주석 삽입」 전부 **선택 행 바로 아래, 같은 깊이**(`commandInspector.defaultInsertionPath / insertionPathAfter`). 여러 행을 골랐으면 마지막 뿌리 선택 아래. 선택이 없으면 루트 끝. 피커 제목이 자리를 말한다(「명령 추가 — 선택한 대기 바로 아래에」). 컨테이너를 명시한 호출(빈 분기 슬롯·「+ 이 분기에 명령 추가」·페이지 끝 줄)만 그 컨테이너 끝에 넣는다. 분기에 명령이 있어도 끝에 `event-command-branch-add-<path>` / `event-storyboard-branch-add-<path>` 줄이 남는다. 스토리 카드는 `user-select: none`.
- **닫으면 편집 중 상태가 걷힌다.** `closeHandler` 가 `selectedEventPageId` 를 null 로 하고 window 에 `oprn:event-editor-closed`(`eventEditorLifecycleEvents.ts`) 를 알린다. EditScene 은 그 신호로 「편집 위치 x,y」 배너를 지운다. 맵 마커는 편집기가 페이지를 보고 있는 동안만 그 페이지를 그리고, 아니면 **게임 시작 시 켜질 페이지**(`eventPageAtGameStart` = `resolveEventPage(event, project.session, map.locations)`, 없으면 1페이지)를 그린다.
- **좁은 화면(`narrow.css`, index.css 마지막 import).** 모달 창 grid 의 열을 `minmax(0, 1fr)` 로 못 박았다 — 예전엔 암묵 열이 헤더 max-content(1033px)로 커져 768 에서 「저장하고 닫기」가 화면 밖이었다. ≤1100: 빈 인스펙터 트랙을 예약하지 않고(1024 에서 960px 중 324px 가 빈 판이었다), 명령을 고르면 인스펙터가 오른쪽 **덮개**(absolute, `grid-column: 1 / -1`)로 뜬다. 스토리 카드는 어느 폭·높이에서도 한 줄 — `@media (max-height: 800px)` 의 세로 쌓기와 `@media (max-width: 1100px)` 의 `flex-basis: 158px`(세로 flex 트랙에서 높이가 됐다)를 되돌렸다.
- **설정 레일의 «레일 + 넓은 시트» 분리는 컨테이너 쿼리가 결정한다 (2026-09-20).** `pages-4.part-2.css` 의 마스터-디테일 블록은 예전에 `@media (min-width: 1441px)` 만 보고 열렸다 — 그 시절 설정 컬럼은 `clamp(660px, 30vw, 780px)` 였다. 명령 중심 배치(`command-workbench.css`, event 레이어 **마지막** import)가 설정 트랙을 240px 로 못 박은 뒤로는 **1680px 에서도 시트의 포함 블록이 205px 인데 `left: 208px`** 이 되어 본문 폭이 음수화되고 패딩 14px 만 남은 **30px 슬리버**가 됐다(실측). 조건 12행은 통째로 보이지 않았고 「모습과 대화」는 스프라이트 한 칸만 남았다. 이제 컨테이너를 `.event-page-props`(아코디언의 직계 부모 — 폭이 아코디언과 정확히 같다)에 걸고 `@container evt-settings-rail (min-width: 430px)` 로 연다: 196px 레일 + 12px 간격 + 218px(조건 2열 그리드 `minmax`) = 426px → 430px. **컨테이너는 자기 쿼리의 영향을 받지 않으므로 아코디언 자신에 걸면 안 된다** — 그렇게 하면 `display: contents`/`position: relative` 가 아코디언에 닿지 않고 본문만 absolute 가 되어 포함 블록이 워크벤치로 새어나간다(실측: 설정 열 517px 일 때 시트가 1230px 로 명령 열을 덮었다). 실측 확인: 1680/1920/2560 에서 시트 203px(세로 아코디언), 리사이저로 설정 열을 469px 이상 넓히면 레일 196 + 시트 261 로 분리, 포함 블록은 아코디언(`offsetParent = .event-editor-settings-accordion`).
- **입력 change 는 포인터 제스처 뒤에 커밋한다**(`commitAfterPointerGesture.ts`, 이벤트 이름·페이지 이름 상자). 다른 버튼을 누르며 blur 된 change 가 본문을 동기 재렌더해 누르던 버튼이 pointerup 전에 교체됐다 — 「이름을 치고 + 를 눌렀는데 아무 일도 없다」의 원인.
- P1·P2 에서 고친 것: 「크기와 통행」 입력 56px 보장 + 좁으면 미리보기를 아래로(컨테이너 쿼리) · 피커 트리거 라벨이 개명을 따라감(`recordsOf(kind)` 를 호출 시점에 읽음) · 3단계 서브다이얼로그 배경 반투명(불투명 밑판 제거) · 서브다이얼로그 첫 포커스는 본문의 첫 입력(`focusFirstControl`) · 검증 항목 클릭은 자기 열 안에서만 스크롤(`scrollIntoNearestScroller.ts`) · 커스텀 select 접근성 이름에서 select/button 글 제외(7,019자 → 「값」) · 아무것도 안 만든 빈 페이지엔 `page.invisible-collision` 경고를 내지 않음 · 검증 종 항목은 원인→기대→힌트만 보이고 코드·ID 는 title/dataset · 그래픽 피커 제목 「그래픽」.
- **남긴 것**: 「움직임과 속도」 fieldset 7개(P1-13), 명령 피커 밀도·아이템 네이티브 select(P2-17), 스토리 뷰 삼중 라벨·자르기(P2-16), 첫 화면 입구 다섯 개(P2-15), 문구 잡음(P2-18). 표면 기준선 픽스처(`test/fixtures/eventEditor*Surface.baseline.json`)는 클래스 목록 변화로 갱신이 필요하다.

## NPC 일정 구조화 편집 (2026-08-24)

- `src/editor/panels/eventEditor/eventScheduleEditor.ts`는 `event.schedule`이 비어 있어도 항상 `event-schedule-editor`를 렌더한다. `event-schedule-add`로 현재 이벤트 위치를 기본 목적지로 한 행을 만들고, 각 행은 삭제할 수 있다.
- 조건 편집은 `NpcScheduleWhen`의 기존 필드만 사용한다: `timePhase`, 정확 시각 범위인 `hourRange`, `season`, `dayRange`. 목적지는 `at.mapId/x/y`, 선택 방향은 `facing`, 활동 분기는 `activity`다. 새 시작 계절/요일 같은 schema 필드를 만들지 않는다.
- `hourRange`와 `dayRange`는 각각 사용 체크박스를 가진다. 체크를 끄면 필드 자체를 제거해 다시 “항상” 조건으로 돌아가며, 단순히 화면 숫자만 비활성화한 채 stale 범위를 남기지 않는다.
- UI change handler는 HTML `min`/`max` 우회를 신뢰하지 않는다. hour는 0..47/48, day는 1..99, x/y는 선택한 target map bounds로 clamp한다. `when:{}`인 무조건 행이 뒤 행보다 앞에 있으면 `event-schedule-shadow-warning-N`을 표시해 first-match ordering shadow를 드러낸다.
- 기존 aggregate draft validator가 찾는 `event-schedule-map-N`, `event-schedule-x-N`, `event-schedule-y-N` testid를 유지하므로 존재하지 않는 map, bounds 밖 좌표, 통과 불가능 좌표의 Apply/Test 차단과 포커스 이동 계약은 그대로다.
- 표면 CSS는 `src/styles/editor/event-editor.modernize.css`의 schedule block이 소유한다. 행 CRUD 계약은 `test/editorNpcSchedule.test.ts`, 기존 bounds/passability 및 focus 계약은 `test/eventDraftValidator.test.ts`와 `test/eventEditorTrustLoop.test.ts`가 소유한다.
- 프로젝트 전역 참조 검증도 모든 맵(맵 트리에 연결되지 않은 orphan host 포함)의 `event.schedule[].at`을 검사한다. blank/missing/unknown `mapId`, 정수가 아닌 좌표, 맵 bounds 밖 좌표는 `hostMapId + eventId + eventIndex + scheduleIndex`로 보고하며 load repair는 해당 행만 제거한다. 유효한 중복 행은 first-match authoring 순서이므로 deduplicate하지 않는다.
- 런타임 일정 상태는 `event.id`를 전역 key로 사용한다. 따라서 프로젝트 내 같은 이벤트 ID가 둘 이상이고 그중 하나라도 일정 행을 가지면 hard reference error다. 기존 프로젝트 호환을 위해 모두 unscheduled인 중복 이벤트 ID는 이 규칙이 차단하지 않는다.
- 맵 삭제 영향(`MapDeletionImpact.incomingScheduleRows`)은 삭제되는 맵 자신이 아니라 살아남는 attached/orphan host의 정확한 일정 행을 열거한다. cascade는 대상 맵을 가리키는 일정 행만 제거하고 이벤트 page/command와 다른 일정 행을 보존한다.

## AI 가 이벤트 페이지를 이해하지 못했다 (2026-08-30 실측 · 수정)

**신고:** "랜덤하게 대사 치는 NPC" 를 요청했더니 AI 가 대사 후보를 **페이지 여러 장**에 나눠 담았고
플레이하면 한 장만 나왔다. 근본 원인은 셋이고 전부 고쳤다.

1. **프롬프트에 페이지 의미론이 아예 없었다.** 24개 작업 수칙 어디에도 "동시에 활성인 페이지는 1장"
   이라는 말이 없었고, 8번 수칙은 오히려 "분기 대사로 **페이지를** 풍부하게 구성하세요" 라고 적혀 있어
   다중 페이지 저작을 **권장**했다. `src/ai/eventPageSemantics.ts` 의 `EVENT_PAGE_SEMANTICS_BLOCK` 이
   툴 능력 색인과 **같은 예산 밖 고정 자리**에 붙는다(소형 예산에서 잘리면 모델이 죽는 페이지를
   저작하므로 잘려서는 안 된다). 8번 수칙은 "한 페이지 안을 풍부하게" 로 고쳤다.
2. **조건 스키마가 커맨드 스키마였다.** `SIMPLE_PAGE_SCHEMA.conditions` 의 `items` 가
   `COMMAND_SCHEMA` 였다 — 옆에 `CONDITION_SCHEMA` 가 있는데도. 그래서 모델에게 노출된
   `conditions[].kind` enum 은 커맨드 kind 까지 포함한 잡탕이었다. 게다가 `CONDITION_SCHEMA` 의
   enum 은 손으로 복사한 16종이라 `run`(로그라이크 런)이 빠져 있었다 — 이제
   `commandKindRegistry.CONDITION_KINDS` 를 그대로 쓴다(SSOT, 테스트가 고정).
3. **죽은 페이지를 아무도 경고하지 않았다.** `src/project/eventPageShadow.ts` 가 판정한다:
   뒤 페이지 조건 집합이 앞 페이지 조건 집합의 **부분집합**이면 앞 페이지는 절대 발동하지 않는다
   (조건 0개 페이지는 앞 전부를 가린다). `all:[a,b]` 중첩과 키 순서에 속지 않게 정규화한다.
   판정을 **세 곳**이 공유한다 — `compileSimplePages`(place_npc/make_villager 가 같은 턴에 경고를 받는다),
   `assertEventShape`(upsert_event), `projectLint`(`event-page-shadowed` warning),
   `explainEvent`(`shadowedByPageNumber` + summary).

### 우선순위는 1페이지가 아니다 (바꾸지 않았다)

`io/pageResolution.resolveEventPage` 는 **마지막 페이지부터 거꾸로** 훑어 조건이 맞는 첫 페이지를
쓴다 = **뒤 페이지가 앞 페이지를 덮는다.** 이것이 RM2K3 규칙이고 표준 저작 관용구
("페이지 1 = 기본, 뒤에 조건 페이지를 덧붙여 덮는다")가 여기 의존한다. 1페이지 우선으로 뒤집으면
기존 프로젝트의 모든 진행 상태 페이지가 죽는다. 따라서 엔진은 그대로 두고 **모델이 이 규칙을 알도록**
고쳤다. 증상("1페이지만 나온다")은 규칙이 아니라 조건 없는 페이지를 여러 장 만든 저작의 결과다.

### 랜덤 대사는 페이지가 아니다

엔진에 랜덤 변수 연산은 없다(`VariableOperand = number | {kind:"var"}`). 랜덤은
`m2Command` `m2-211-weighted-branch`(runtime full, `m2ModernRuntime.selectWeightedIndex`)가
`fields.table` 가중치로 결과 변수를 뽑는 것이고, 그 변수를 `fork` 로 갈라 대사를 나눈다 —
**전부 한 페이지 안에서**. 이 패턴이 프롬프트 블록과 경고 힌트 양쪽에 박혀 있다.

### 새 린트가 출하 콘텐츠에서 실제로 잡은 것 (skyStair autoEvent)

`gate()`(`src/editor/content/skyStairMaps.ts`)는 규칙을 알고 주석까지 달아 뒀다 —
"막힌 쪽을 **먼저**, 열린 쪽을 나중에 — 마지막 매칭이 이기므로 순서를 뒤집으면 영구 차단이다".
그런데 200줄 아래 `autoEvent()` 는 정반대로 걸쇠 페이지(`selfSwitch A`)를 먼저, 무조건 실행
페이지를 나중에 놓았다. 마지막 매칭이 이기므로 **무조건 페이지가 영원히 이기고 걸쇠가 걸리지
않는다** — 자동 이벤트가 맵에 들어올 때마다 커맨드를 다시 실행했다. 새 `event-page-shadowed`
린트가 4건으로 지목해서 발견했고, 순서를 뒤집어 고쳤다. 출하 기본 프로젝트 30종 전수 감사
결과 이제 죽은 페이지 0건이다(수정 전 4건).

### 조건만 걸고 켜지 않으면 그것도 죽은 페이지다 (가려짐의 거울상)

라이브 검증에서 나온 잔여 결함이다. 프롬프트를 고친 뒤 모델은 "말 걸 때마다 다음 대사"를
페이지 1(무조건)/2(`selfSwitch A`)/3(`selfSwitch B`)로 **옳게** 나눴는데 `setSelfSwitch` 를
하나도 넣지 않았다 — 조건은 맞고 가려짐도 없는데 2·3 페이지가 영원히 잠겼다. 결과가 같으므로
같이 잡는다: `findUnwrittenSelfSwitchGates` 는 페이지 조건이 요구하는 `selfSwitch`(value:true) 를
알려진 커맨드 트리의 어디에서도 켜지 않으면 지목한다. 이 순회는 커맨드 union의 중첩 shape에
묶이지 않고 모든 배열·객체를 내려가므로 `choices.options[].branch`, `cancelBranch`, `fork`, `loop`,
전투·상점 등의 분기까지 포함한다. 단 `callCommonEvent`, `callMapEvent`, `battleProcessing` 은 호출한
이벤트의 self switch를 외부 커맨드가 쓸 수 있어 write set을 알 수 없으므로, false positive를 피하려고
그 이벤트의 gate 판정을 생략한다. 전역 `switch` 는 기존 `story-flag:read-without-write` 가 이미 보므로
중복하지 않는다.
린트 코드는 `event-selfswitch-gate-unwritten`, explain_event 는 `unwrittenSelfSwitchKeys`.

계약 테스트: `test/aiEventPageSemantics.test.ts`, 예산 고정은
`test/aiToolCapabilityIndex.test.ts`.

## 복잡한 NPC 는 조회 후 상태별 다중 페이지로 저작한다 (2026-09-01)

2026-08-30 수정은 죽은 페이지(조건 없는 페이지 여러 장)를 막았지만, 8번 수칙이
"한 페이지 안을 풍부하게"로만 기울어 **상태별 다중 페이지 NPC 자체를 모델이 피했다.**
실제 증상: 한 줄 인사 NPC만 놓고 `find_events`/`get_event`/`get_story_state` 를 부르지 않음.

고친 계약:

1. `EVENT_PAGE_SEMANTICS_BLOCK` 에 「복잡한 NPC 저작(단편 금지)」 절. 쓰기 전
   `find_events` → `get_event`(풍부한 예) → `get_story_state` → `get_database_records` →
   `list_npc_graphics` → `place_npc`. 상태 패턴: 재방문 selfSwitch / 퀘스트 switch /
   호감 `characterId`+`friendshipAtLeast` / 시간·계절. 한 만남 안의 분기는 여전히 그 페이지의
   `choices`(페이지를 늘리지 않음).
2. 작업 수칙 8은 두 층을 구분한다. 영역 가이드·`place_npc` description 도 같은 조회 순서를 말한다.
3. `place_npc` 에 `characterId`, 페이지별 `name`/`graphic`. 호감 조건/커맨드만 있고
   `characterId` 가 없으면 이름에서 할당한다.
4. `make_villager` `dialogue.when` 이 switch/selfSwitch/variable/item/friendship 을 받고,
   복잡한 분기는 `pages: SimplePage[]` 로 우회한다.
5. `find_events` / `get_map_region` 이벤트가 이름·페이지 수·조건 kind·characterId 를 돌려
   템플릿을 고른 뒤 `get_event` 로 읽을 수 있다.
6. `find_events`/`get_event` 는 기존 event 핀. `explain_event`/`get_story_state`/`declare_story_flag` 는
   프롬프트가 이름을 말해 능력 색인·find_tools 경로로 잡는다(핀을 늘리면 tile+event 복합 턴에서
   실내 하네스 핀이 밀린다).

죽은 페이지 금지(조건 없는 페이지 여러 장, selfSwitch 조건만 걸고 안 켜기)는 그대로다.

> **Encoding note:** Some Korean descriptive text has EUC-KR→UTF-8 mojibake from the original source commit. English terms, file paths, and code references are intact. For accurate Korean, consult the referenced source files. Partial automated restoration applied; remaining garbled CJK is irreversibly corrupted.

Event authoring, event pages, event commands, move routes, command dialogs, and cutscene/horror/puzzle tools.

## Roguelike run authoring (2026-08-24)

- The native command picker exposes **로그라이크 런 제어**. Its rich body switches among start, next-floor, end, run-flag, and room-reset fields; changing the action rerenders because each action has a different command shape.
- Fork condition forms expose **로그라이크 런** with active, floor, flag, and result modes. Page conditions expose the same control under the advanced-condition list, and page badges/summaries use `R` and run-specific text.
- Multi-field handlers keep staged values so consecutive edits do not restore an older field. `test/roguelikeRunEditor.test.ts` protects floor condition editing, consecutive flag edits, and action-shape rerendering.
- AI-assisted room authoring uses the existing field-spawn builder first (`make_hunting_ground` or equivalent), then `configure_roguelike_room` to group those spawn ids into weighted/floor-gated slots, and finally `runControl` events for start, advance, reset, and end. Conventional regenerating loot uses self-switch/`Erase Event` pages; room generations reset those by default, while `resetEventState:false` protects persistent story events. The room tool does not invent missing field-spawn references.

## Event Authoring

- Task15 economy command forms: actual owners are `commandBodyDatabase.ts` `craftRecipeBody` / `applyItemUpgradeBody` (not Commerce). Optional `resultVariableId` is authored only when a variable is selected; clearing the picker omits the property (never stores `""`). `commandSummary` and visual `commandPreview` show the declared variable name. Runtime still writes success1/failure0 through existing setVariable and continues.
- `src/editor` is the main area to inspect for editor behavior. Start with `src/editor/EditScene.ts`, `src/editor/actions.ts`, `src/editor/editorState.ts`, and the feature modules under `src/editor/panels/`.
- Map editing lives in `src/editor/map*`, `src/editor/tile*`, `src/editor/tileset*`, and `src/editor/structure*` files. Look at `src/editor/tileActions.ts`, `src/editor/tilePaletteStamp.ts`, `src/editor/tilePicking.ts`, `src/editor/mapEditHistory.ts`, `src/editor/mapShiftActions.ts`, and `src/editor/mapClipboard.ts` for common flows.
- `src/editor/EditScene.ts` is the Phaser scene coordinator. Camera pan behavior lives in `src/editor/CameraPanController.ts`, drag-state branching in `src/editor/DragOperationHandler.ts`, tile paint/pick/stamp application in `src/editor/TilePaintEngine.ts`, and AI ghost/focus drawing in `src/editor/agentPreviewRenderers.ts`.
- Store mutations can carry a `ProjectChangeDescriptor` from `src/project/store.ts`. High-frequency tile edits should use `scope: "map"` with concrete `{ x, y, layer }` cells so `EditScene` can update only those tile objects; broad map shape/metadata edits should use map scope without cells; database edits should use `scope: "database"` so the map canvas does not redraw.
- `COMMAND_GUARANTEES[*].supportByContext` is the native runtime-support SSOT for picker rows, persisted/inserted command rows, event-draft validation, and project lint. `commandRuntimeSupport(command, context)` must receive `map`, `common`, or `troop` whenever the owner is known; omission means the conservative worst grade across all three contexts, never an assumed full grade. M2 catalog entries with an `existingKind` are graded through the same native guarantee, while genuinely persisted M2 commands use the M2 classification tables. Every command button publishes `data-runtime-support` (`runtime-full` / `runtime-partial` / `editor-only`) and truthful `data-runtime-owner` (`interpreter` / `player` / `battle`). Unavailable informational entries stay searchable and keyboard-focusable with `aria-disabled="true"`; visible text referenced by `aria-describedby` explains their alternate authoring route, and they have no selection handler.
- High-frequency edits that only mutate one existing `GameMap` should use `store.updateMap(mapId, mapMutator, { cells })` instead of `store.update`. `updateMap` clones only the target map, shallow-copies the project root and `maps`, shares database/assets/tilesets references, emits map scope, and skips full-project normalize passes. Keep tileset/passability/database/project-tree edits on `store.update`.
- **Auto-connect (?댁썐 ?깊삎):** defaults to **Manual (`false`)** for *non-autotile* exact placement. **RM-style exception:** if the stroke paints or erases a tile that belongs to any `tileset.autotileGroups` trigger/member set (Combined Town dirt/sand; interior wall-frame; interior **dark wall 366**), lower paint/erase/fill **always** runs `shapeTerrainAfterLowerEdit` even when Manual is selected ??same as AI `paint_tiles`. Manual only skips reshape for ordinary single tiles. Paint title row no longer exposes the toggle; **?띿꽦** assist still has `auto-connect-mode-toggle`. Interior needs seeded `autotileGroups` (theme pack seeds dark-wall on load).
- **?ㅽ넗???autotile) 개념:** ?ъ슜?먭? **몸통 브러??????섎굹**留?移좏븯硫? 4/8?댁썐 마스?щ줈 蹂쨌?멸낸 모�꽌由???쇱씠 ?먮룞 교체?섎뒗 吏???깊삎?대떎. ?숆만/모�옒? 같고, ?ㅻ궡 ?대몢??踰쎌? 브러??**366**留???ν븯怨??뚮뜑??쿼터 ?⑹꽦(`interiorDarkWallQuarterComposition`). ???variant ?ъ벐湲곕뒗 ?섏? ?딅뒗??Option B). ?뚯씠?꾨씪?? `paintDarkWallAndShape`. ?섎룞 ?먮뵒?? `tileActions.lowerEditsNeedAutotileShape` (Manual?댁뼱??366 ?깊삎). 코드: `src/project/defaults/darkWallAutotile.ts`, `src/editor/tileActions.ts`. 寃利? `test/darkWallAutotile.test.ts`, `test/e2e/interior-dark-wall-autotile.spec.ts`.
- **Bulk tile paint:** Brush, stamp, palette stamp, and shape-drag must call `paintTilesBulk` / `eraseVisibleTilesBulk` (`tileActions.ts`) so one stroke step is **one** `updateMap` (one map clone, one `repairTreePairs`, one emit, one auto-save reschedule). Never loop `paintTile` per brush cell ??that multiplies clone+listener cost by brush area and feels like DB lag even though auto-save is debounced (~4s).
- **Paint must stay local-first:** autosave/map-patch merge must not replace live map bodies after save. If tiles appear then disappear a moment later, check `store.persistCurrent` is not applying `result.project` onto `this.current` (see `openwiki/runtime-project-schema.md` local-first paint note). Remote lag is OK; local brush feedback is not.
- **Eraser (?섏쐞/?곸쐞):** `eraseVisibleTilesBulk` on **upper** erases upper only (no lower fallback). On **lower**, if lower is empty and upper is occupied it falls back to upper so visible decorations can still be cleared. **`eraseTilesBulk` expands companions before clear**: hard cluster footprints (bench/table/2횞2 tree) + tree canopy?봳runk pairs so `repairTreePairs` cannot immediately restore a canopy you just erased. Tests: `test/layerRouting.m1.test.ts`.
- Undo history is budgeted around per-map snapshots: high-frequency edits that only touch one existing map should record `{ kind: "map" }` snapshots through `mapEditHistory`.
- Keep full-project snapshots for global edits such as database/system changes, map add/delete/tree changes, resize, imports, or any mutation whose boundary is ambiguous.
- Map properties expose hunting data JSON editors for `encounterTable` and `fieldSpawns`. Mutations go through `setMapEncounterTable` and `setMapFieldSpawns`, deleting empty arrays so legacy maps stay compact.
- Tile palette work usually touches `src/editor/tilePaletteStamp.ts`, `src/editor/chipsetTileRender.ts`, `src/editor/runtimeTileMetadata.ts`, and `src/editor/tilesetActions.ts`.
- Default Combined Town 모�옒/?숆만 ?뚮뜑留?uses `src/project/defaults/terrainQuarterAutotile.ts` for RM2003-style 8x8 quarter composition. **Interior ?ㅽ겕?붿? RM2k3 쿼터 ?ㅽ넗???*(`src/project/defaults/interiorDarkWallQuarter.ts` ??援?`interiorWallFrameQuarter.ts`??deprecated ?촦xport). **Option B 계약(2026-07-15):** ??μ? `366` ?섎굹肉먯씠怨?쿼터???뚮뜑?먯꽌留?만든??
 - **중심 게이??** `centerTile === 366`???留??⑹꽦?쒕떎. 주택 ?듯???`397/396/398/426/428/456/457/458`, ?�림 硫?怨?공허 `430`??중심?대㈃ `null`??반환??plain ?듯??쇰줈 洹몃┛????援?계약처럼 문·포?ㅽ듃쨌怨듯뿀源뚯? ?⑹꽦 ??곸씠 ?섏? ?딅뒗??
 - **?대몺 mass ?먯젙:** 留??덉뿉?쒕뒗 `366`留?mass??留?諛뽰? mass濡?본다). 援?`블록 硫ㅻ쾭 ??430/233/234/257/258/?숆뎬 ?뚮몢由?116/146` 광역 吏묓빀怨?`233/257/258` ?쇰꺼 ?덉쇅, house-specific 분기???꾨? ??젣?먮떎.
 - **?뚯뒪 ?좏깮:** 쿼터(NW/NE/SW/SE)마다 v(?몃줈)쨌h(媛濡?쨌d(?媛? ?댁썐??mass ?щ?濡?怨좊Ⅸ????`v쨌h쨌d 踰썩넂427 중앙`, `v쨌h留?踰썩넂368 ?ㅻぉ`, `v留뚢넂426(좌반)/428(?곕컲)`, `h留뚢넂397(?곷컲)/457(?섎컲)`, `모�몢 ?대┝??96/398/456/458 볼록 코너`. ??ID?ㅼ? **?꾪??쇱뒪 좌표??肉?* `memberTileIds`쨌`triggerTileIds`쨌`variantMap` 異쒕젰쨌留???κ컪???꾨땲??
 - **쿼터 ?앸왂 ?놁쓬:** `427` underlay瑜?깔고 ??荑쇳꽣瑜???긽 명시?쒕떎. 援??쒖?????쇨낵 媛숈? 쿼터???앸왂??최적?붾뒗 ???ID媛 ?붾㈃???덉뼱 ?섏삤???먯씤?대씪 ?쒓굅?덈떎.
 - ??규칙??1以?밴드 ?곹븯 2?깅텇, 1??기둥 좌우 2?깅텇, T-교차/??옄 ?ㅻぉ ?⑹쓣 ?꾨? ?먮룞 ?앹꽦?쒕떎 ??????곗씠?곕뒗 `366` 洹몃?濡??먭퀬 ?뚮뜑留?諛붾먮떎. Editor tile objects, map screenshots, transfer-map previews, play mode, and AI temporary map images must use `chipsetQuarterComposition()` and fall back to raw tile drawing when it returns `null`.
 - 계약 문서/?쒓컖 증거: `docs/interior-wall-frame-autotile-cases.html`. PNG ?ъ깮?깆? `bun scripts/render-interior-wall-contract-cases.mts` (?ㅼ젣 ?곸닔쨌grammar쨌quarter ?⑥닔瑜??몄텧?쒕떎 ???먯쑝濡??쎌???議곕┰?섏? 留?寃?.
- **?덇굅???ㅻ궡 踰?계약 진단:** `src/project/defaults/legacyInteriorWallContract.ts`. `findLegacyInteriorWallContract(project)`??援?`harness-interior-house-v1-wall-frame-autotile` 洹몃９怨??섏떖 ?(map id + 좌표)??**?쎄린 ?꾩슜**?쇰줈 보고?쒕떎. ?먯젙? `dark-legacy`(援?dark ?꾩슜 variant `367/368/369/427`留? 쨌 `house-legacy`(湲덉? `233/257/258`留? 쨌 `ambiguous`(?????덇굅??dark 利앷굅媛 주택 硫??꾩뿉 ?덉쓬) 쨌 `clean`. `collapseLegacyDarkWallMap(map)`? **명시?곸쑝濡?dark濡??먯젙??留듭뿉留?* ?곕뒗 ?쒖닔 蹂??援?9醫????variant ??`366`, ?낅젰 留?遺덈?). 주택 留듭? ???추측 蹂??????먮옒 `InteriorRoomPlan`?쇰줈 walls瑜??ъ깮?깊븳?? ambiguous 留듭? ?덈? ?먮룞 蹂寃쏀븯吏 ?딅뒗??
- The old terrain-template system is removed. Do not add `tileset.terrainTemplates`, terrain-template panels, or `*_terrain_template` tools back; structure knowledge now flows through house kits (`build_house_kit`) plus dirt/sand autotile painting.
- Prop/tree scatter (`scatter_object` / `place_props`) protects water, solid terrain, **dirt/sand road surfaces**, occupied upper cells, events, and transfers. Road cells stay passable for movement but must not receive trees. Poisson/cluster modes follow natural-scatter sample rank when space is open; packing filters apply only in tight corridors. Grammarless multi-tile **bag** prop groups (e.g. small-props, house-yard-props, cemetery-props) scatter as **1-cell** random picks. **Combined Town furniture vision (forced):** horizontal bench **327|328** (`bench-horizontal`); vertical chair **358|388** both upper (`bench-vertical`). House-yard (in front of houses): **349** firewood, **350** mailbox, **351** pot, **352** jar. Cemetery (far from houses): **323** cemetery, **353** gravestone, **383** skeleton (not statue). Tables: horizontal **234|235*|236**, vertical **144/174*/204** (mid stretch unlimited). Table chairs: **175** N of table, **176** S, **205** W, **206** E; free chairs **147**/**148**. **202|203** fruit box, **237** wood box, **116/146** wood door, **111|112*|113** stone stairs, **322** wall ladder (upper, passable), **28/58/88** castle windows, **231** magic circle. **Castle map modules** (gold `map_castle_keep` ??full recipe `openwiki/castle-map.md`): roof deck `harness-combined-town-castle-roof-deck` (**18??10**), wall face `??castle-wall-face` (**21/51\*/81**), round tower `??castle-round-tower` (cap upper **24\|25**, neck **138\|139**, body **140\|141**, windows **142\|143**, base upper **54\|55**). Courtyard stays grass; south gate gap + sand approach. **Tool:** `build_castle` stamps modules (default 48횞40; e.g. ?깆콈2=`map_castle_keep_2`). Broadleaf: `harness-combined-town-broadleaf-tree-2x2`.
- **Tileset DB chipset UI:** Database ????쇱뀑 main pane shows the **full chipset sheet** (`tilesetChipsetPreview.ts`) inside a **scroll viewport** (wheel / ?먥넂?묅넃 / middle-drag). Scale **2x(default)/3x/4x**. Layout chain: `rm2k3-tileset-main` ??`tileset-db-edit-area` ??`tileset-db-preview-wrap` ??`.tileset-db-preview { overflow:auto; height:100%; min-height:0 }` so 16-row sheets are not clipped by parent `overflow:hidden`. Layer filter ?꾩껜|?섏쐞|?곸쐞 dims non-matching cells (`layer-dimmed`) ??use **?꾩껜** to see every graphic. **Primary edit: right-click** ??`tilesetTileContextMenu.ts` (?섎?/?듯뻾/?덉씠??번호 복사). Optional **?꾩껜李?*. Map palette still filters by edit layer.
- **Forest = canopy upper + trunk lower on overlapping cells:** A forest is not just dense upper tiles. Conifer/dry tree stamp is **1횞2**: top tile (260/261) on **`upperTiles`**, bottom tile (290/291) on **`lowerTiles`**. Placing a second tree one row south puts its canopy on the same cell as the first tree?셲 trunk ??`lower=trunk + upper=canopy` (the classic RM forest stack). Broadleaf 2횞2: top row upper, bottom row lower. Never put both halves only on upper (they cannot share a cell). Play mode routes **??canopy** (`passageMark === "star"`) into `upperTileLayer` at `MAP_UPPER_LAYER_DEPTH` (250k) so canopies draw above characters. **Solid upper furniture (횞)** (desk/table/bench) is y-sorted with same-priority characters via `mapUpperTileDepth` on the root display list ??never park all upper tiles at 250k or characters sink under desks. Scatter uses layer-aware `footprintFits` so canopy can land on existing trunk lower.
- **Transparent trunk on lower:** Chip 290 etc. are transparent. On **lower** alone they show black holes (no underlay). Editor/play render must composite **grass under trunk** when drawing a tree-trunk lower tile (`createTrunkOnGrassObject` / play `renderTile` grass-then-trunk). Data stays `lower=290` for solid passage; only the draw path adds the grass underlay.
- **Tree pair post-hook (required):** Every tree trunk (lower/upper 290/291/292/293) must have its matching canopy on **upper** of the cell **above** (290??60, 291??61, 292??62, 293??63). Implemented in `repairTreePairsOnMap` / `repairTreePairsOnProject` (`src/project/lint/repairTreePairs.ts`). Runs as write-tool postprocess in `toolRunner` (before commit) and after manual paint/erase/fill in `tileActions`. Orphan trunks on row y=0 are removed (no cell above).
- Selection-based deterministic building palette work lives in `src/editor/panels/buildPalette.ts` and `src/editor/panels/buildPaletteCore.ts`, mounted from `src/editor/panels/editorZoomToolbar.ts`. It consumes `editorState.selection`, stamps path/water/roof/tree/NPC/prop primitives without LLM calls, and routes AI-fill through the existing region task modal/runRegionTask path. The house primitive converts the drag rectangle plus the selected shape (`rect`, `l`, or `u`) into `build_house_kit` wings and exposes the two learned kits (`blue-stone`, `bright-plaster`) plus door-event/interior/window toggles. The village primitive calls `build_village` with `bounds` set to the drag rectangle so the builder's plaza, houses, paths, NPCs, and self-audit stay inside the selected area. When the select tool drag ends, `DragOperationHandler` emits `oprn:ai-selection-context`; `aiChatPanel` arms the bottom command bar with `ai-selection-chip`, focuses the input, and sends Enter through `runRegionTask` until the chip is cleared.
- **Selection action chips** (`src/editor/selectionActionChips.ts`): left-select exposes a floating toolbar on `.phaser-container` (same slot as build palette when palette is off) with **복사(Copy) / 붙여넣기(Paste) / 지우기(Clear) / ✨AI / ✕(Deselect)** buttons plus a `W×H` size label. Paste is **clipboard-gated** (only shown when `editorState.clipboard` exists). Copy calls `copySelection`; Clear calls `clearSelectionRegion` (empties both layers); Deselect calls `clearSelection` (clears selection + pastePreview). **Paste preview mode:** Ctrl+V or the Paste chip enters `editorState.pastePreview = {x,y}` — a semi-transparent tile ghost follows the cursor (`renderPastePreviewGhost` in EditScene); the selection toolbar is hidden while the ghost is active (`shouldShowSelectionActionChips`). Left-click confirms via `confirmPastePreview` (commits `pasteClipboard` + toast, **does not** select the pasted region); Esc/right-click cancels via `cancelPastePreview`. Placement: `fixedSelectionChipsPosition` pins the toolbar to the **bottom-right** of the canvas; CSS: `.selection-action-chips { position:absolute; z-index:30; backdrop-filter }`. `mapClipboard.ts` owns `enterPastePreview`/`movePastePreview`/`confirmPastePreview`/`cancelPastePreview`/`clearSelection`/`clearSelectionRegion`. Esc handling is layered: `handleEscapeKey` in EditScene cancels paste preview first, then clears selection.
- **Canvas work area fill (2026-09-18 갱신):** dense(standard/expert, 플로팅 툴바)에서 `.editor-canvas-scroll-shell` 은 normal flow + `flex:1` 로 배너 뒤에 바로 붙는다 — 고정 `top: 48px` / 배너 시 `74px` 예약이 배너 실측(42px)과 어긋나 상단 빈 띠를 남기던 결함 수정. beginner(도크 툴바)는 absolute 예약을 유지한다. 배너 있을 때 플로팅 툴바는 `.canvas-area:has(.persistence-mode-banner) .canvas-toolbar:not(.is-docked-chrome) { top: 50px }` 로 배너(42px) 아래에 뜬다 — 구 선택자(`.persistence-mode-banner ~ .canvas-toolbar`)는 배너가 호스트 안에 있어 성립하지 않았고 툴바가 배너 닫기 버튼을 가렸다. 도크 툴바(beginner)는 배너와 같은 행에 겹쳐 배너 텍스트를 가렸으므로 `body.editor-ui-beginner .canvas-area:has(.persistence-mode-banner) .canvas-toolbar.is-docked-chrome { top: 42px }` 로 배너 아래로 내린다 — body 접두는 도크 원 규칙(클래스 4+요소 1)을 이기기 위한 특이도다. 셸(absolute + top:auto)은 static 위치라 자동으로 따라 밀린다. `.phaser-container` 는 `display:block; width/height:100%`(고정 1024×768 아님). `fitCanvas()` 가 호스트 rect 에 맞춰 Phaser 를 리사이즈한다.
- AI `create_map` in `src/editor/tools/mapTools.ts` creates plain grass maps by default. Its old `border: "wall"` outer frame is **no longer in the model-facing schema** (2026-09-11) — the assistant used to pick it on its own for every cave/dungeon/basement request; the runtime argument still works for scripts, tests and replayed conversations. Details and measurements: `editor-ai-tools.md`. House harness kits in `src/editor/houseKit.ts` add upper-layer windows by default on wall mid rows (`windows: false` preserves exact golden layouts).
- **Map tree vs `project.maps`:** the map list UI (`mapList.ts`) only walks `project.mapTree`, not every key in `project.maps`. Orphan maps (written into `maps` without a tree node ??e.g. ad-hoc scripts) are invisible until reattached. `create_map` / UI `addMap` always update the tree. Load/normalize runs `repairMapTreeOrphans` (`src/project/mapTree.ts`, from `store.normalizeCurrentProject`) to attach orphans as root children and prune dead nodes. Prefer `create_map` over raw `maps[id]=??.
- **Market / deck harness (Combined Town):** engine modules still use deck tiles body **222**, edges **228/229/230/192**, rails, etc. (`stampMarketHarness` hardcodes chips). **AI v3 construction tools no longer take `*VocabId` / harness group ids** ??use `material` = tile **label/description** (e.g. `"臾?`, `"침�뿽??`, `"?섎Т ?곸옄"`, `"??吏?踰?`). Resolve via `resolveMaterialByLabel` / `tile_query ask:"labels"`. **Shop pattern:** transparent `action` event **on counter tile** runs `shop`; merchant NPC behind counter is chat-only. Village map: `buildVillageShoppingStreetProject` / `map_village_shopping_street`. Large 100횞100: `buildLargeRiverMarketVillageProject` / `map_large_river_market_village`.
- **AI assistant viewport context:** `EditScene` publishes camera tile viewport via `editorMapViewport.ts`. Each chat turn prepends center coords + visible rect (`mapViewportContext.ts`) and, in-browser, a low-detail viewport map image on the user message. System map summary clips to viewport when present (not always top-left).
- **Default LLM/auth path:** new settings default to `authMode: "chatgpt"` with factory default provider `google-antigravity` (`gemini-3.7-flash`), alongside `openai-codex` (`gpt-5.6-sol`). OAuth acquisition and token refresh are owned directly by this repository in plain Node (`src/ai/oauth/` and `scripts/lib/aiAuthRuntime.ts`), so Bun is not needed for authentication routes. Completions run through the loopback Bun worker (`scripts/oh-my-pi-worker.ts`), which serves a single `/complete` route receiving an already-resolved `apiKey` with no credentials stored in the worker. Two front-ends share the router (`scripts/lib/ohMyPiHttp.mjs`): **DEV** mounts the handlers same-origin inside the vite dev server via `codexOAuthPlugin` in `vite.config.ts` (`DEFAULT_CHATGPT_BASE_URL` is `/v1` when `import.meta.env.DEV`), so `npm run dev` alone is enough with no second terminal. **PREVIEW / `dist/`** falls back to `127.0.0.1:17832`; `npm start` runs `scripts/start-preview.mjs`, which opens that companion in-process before vite preview, so preview no longer boots with AI silently unreachable (`npm run ai:oauth` still starts it standalone). Never expose OAuth tokens to browser local storage.
- **AI harness blow-ups (2026-07 lake-clear incident):** (1) `get_map_region` must mark lake autotiles as `~` via `isMapWaterTile` and return `data.water.bounds` ??do not rely on `TILE.WATER` alone. (2) `toolResultForModel` omits `lower`/`upper` matrices; `show_map_region` clamps to 24횞24. (3) Lake/road clear needs `confirmDestroy:true` on clear assets (water is non-grass ?쐀uilt??. (4) Avoid full-map 52횞52 vision scans.
- Hunting-ground authoring tools live in `src/editor/tools/mapTools.ts`: `set_encounter_table` replaces a map's weighted/conditional encounter table, and `make_hunting_ground` appends a field spawn while optionally setting matching encounter entries. Keep schemas provider-compatible with plain object/array/string/number/boolean types and validate troop ids plus tile rect bounds before writing. **`parseFieldSpawn` must carry every field the caller sends (2026-08-29):** `factionId`, `footprint`, `passRows`, `persistKill`, and `onKillSwitchId` were dropped on the floor, so an authored faction override or kill persistence vanished the moment a spawn went through this tool, and `make_hunting_ground` could not express the per-spawn faction that `make_action_enemy`'s `spawn.factionId` already wrote. All five are now optional `make_hunting_ground` parameters, validated before the write: ids must be non-blank, `footprint.width`/`height` and `passRows` must be at least 1, and `onKillSwitchId` must name an existing `project.switches` row (`switch-not-found`). Omitted keys stay absent, so existing callers serialize byte-identically. Contract: `test/mapToolsFieldSpawn.test.ts`.
- Farming authoring uses `GameMap.farmableArea` plus crop/item database records. The write tool `create_farm_plot { mapId, area }` only declares farmable tile rects and must not paint soil/fences or mutate tile layers. The write tool `define_crop` upserts `database.crops[]` records and validates seed/harvest item ids. Regenerate `scripts/generated/toolCatalog.json` whenever these schemas change.
- Event editing flows are split across `src/editor/eventActions.ts`, `src/editor/eventPages.ts`, `src/editor/eventDraftActions.ts`, `src/editor/eventDeletion.ts`, `src/editor/eventCommandFactory.ts`, and `src/editor/eventCommands/`.
- **이벤트 에디터 Option A 레이아웃 (2026-08-27):** `src/editor/panels/eventEditor/` 셸 레이아웃을 Option A 규격으로 정렬한다. 모달 상단 타이틀바(`event-editor-titlebar`)는 편집 가능한 이름(`event-editor-name`), ID, 좌표, `테스트` 버튼과 함께 헤더 페이지 세그먼트(`[data-testid^=evt-page-segment]`)를 포함한다. 기존 모달 본문의 넓은 페이지 탭 스트립(`.event-page-number-tabs`, `event-page-strip`, `event-page-tab-*`)은 완전히 제거된다. 좌측 설정 레일(`event-editor-settings-column`)은 최대 4개 그룹의 요약 아코디언(`details > summary` 구조: 조건, 그래픽, 트리거/우선순위, 이동 빈도/경로)으로 구성되며 각 그룹의 summary에 현재 설정 요약 텍스트가 노출된다. 명령 목록(`event-editor-commands-column`)은 행 클릭 시 선택 하이라이트가 적용되고 더블클릭 또는 Enter로 편집 대화상자를 열며 행별 '편집' 버튼은 노출하지 않는다. 우측 통합 인스펙터(`event-editor-inspector-column`)는 선택한 명령의 상세 필드와 라이브 프리뷰를 일체형으로 표시한다. 하단 푸터(`event-editor-modal-footer`)는 단일 primary 액션인 `저장하고 닫기`(`event-editor-save`)만 제공한다. 모달 루트 testid는 `event-editor-modal`을 유지한다. 테스트: `test/e2e/event-layout-optiona.spec.ts`, `test/eventEditorHierarchyShell.test.ts`, `test/eventEditorBalancedShell.test.ts`, `test/eventEditorSettingsLayout.test.ts`, `test/eventEditorStoryboardBranches.test.ts`, `test/eventEditorUiDensity.test.ts`, `test/eventEditorModal.test.ts`.
- **이벤트 에디터 계층 재배열 (2026-08-27, 아래 Option A 항목을 상위 갱신한다):** 타이틀바(48px)는 **페이지 세그먼트를 담지 않는다**. `renderClassicPageTabStrip` 은 2줄 리치 탭이라 48px 헤더에서 수직 오버플로우를 일으켜 탭이 화면 상단에 잘렸다 (실증: BEFORE `header.overflowY = true` → AFTER `false`). 헤더는 이름·ID·좌표·NPC 짱·`페이지 n/N` 카운터(`event-editor-header-page-count`)·테스트·닫기만 가진다. 세그먼트의 유일한 집은 `.event-editor-pagebar` 행이며, 한 줄로 유지된 채 가로 스크롤한다.
- **컬럼 라벨:** 항상 마운트되는 두 컬럼은 자기 역할을 직접 말한다 — `event-editor-column-label-settings`(`이 페이지 설정`), `event-editor-column-label-commands`(`이 페이지가 하는 일`) + 명령 개수 배지 `event-editor-command-count`. 인스펙터 컬럼은 선택 전에는 `hidden` 이라 라벨을 부이지 않는다 — 인스펙터 렌더러가 host 를 `replaceChildren` 하므로 거기에 라벨을 넣으면 지워진다.
- **「이 페이지가 하는 일」 목록은 실행 순서를 화면에 적는다 (2026-08-30):** 칼럼 라벨은 예전부터 «위에서 아래로 차례대로 실행됩니다» 라고 약속했지만 그 순서를 적는 표시가 목록에 하나도 없었다 (스토리 보기는 이미 원형 번호를 갖고 있었으므로 두 보기가 어긋나 있었다). 이제 `commandList.ts` 의 모든 행이 드래그 핸들 다음 칸에 `.cmd-step`(`event-command-step-<경로>`)을 단다. 계약:
  - **번호는 자기 컨테이너 안에서 1 부터 다시 시작한다.** 분기 안이라는 범위는 바로 위 분기 헤더 줄(`renderBranchDropLine`)이 말하므로 `2-1` 같은 점 표기를 쓰지 않는다.
  - 번호는 **경로의 마지막 칸 + 1** 이다. 중간 칸을 이어 붙이면 안 된다 — `choices` 의 `branchIndex` 는 선택지 인덱스(음수 아님)라서 실행 순서가 아닌 칸이 번호에 섞인다. 다른 분기들은 음수 상수(`FORK_THEN_BRANCH_INDEX` 등)라 부호로 걸러지는 것처럼 보이지만 `choices` 가 그 가정을 깬다.
  - **개수 배지는 저작한 명령 수를 센다** — `totalCommandCount()` 가 `eventCommandBranches` 로 분기 속 `Command` 객체까지 재귀로 세며, 분기 머리글·빈 분기·묶음 끝 마커 같은 화면 줄은 세지 않는다. 배지의 `title`/접근성 이름은 「분기 안 명령 포함」을 명시해 옆의 실행 순서 힌트와 구분한다. AI 초안이 적용 대기 중이면 배지와 초안 행 번호는 현재 페이지가 아니라 제외 토글까지 반영한 **적용 예정 결과**를 기준으로 갱신된다. 각 컨테이너에서 적용 후 남는 행(`keep`·`change`·적용할 `add`, 또는 삭제 제외로 되살린 `remove`)만 1부터 연속 번호를 받고, 적용 후 사라질 `remove`와 제외한 `add`는 화면에는 비교용으로 남되 번호를 표시하거나 소비하지 않는다.
  - **`.cmd-empty-line` 은 한 번 클릭으로 명령 피커를 연다.** 예전에는 `<button>` 인데 `dblclick` 만 들어서 한 번 누르면 아무 일도 없었고, 라벨 `명령 추가 — 더블클릭 또는 위 [+ 명령]` 이 자기가 아닌 툴바 버튼 이름을 부르고 있었다. 지금 라벨은 `+ 여기에 명령 추가` 다.
  - **카테고리 배지(`.cmd-cat-icon`)는 좁은 폭에서도 낱말을 지우지 않는다.** `@media (max-width: 1050px)` 가 `::after { display: none }` 으로 낱말을 지워 24px 글리프만 남겼는데, 이 줄이 어떤 종류의 일인지 알려주는 유일한 표시가 칼럼이 좁아질 때 정확히 사라졌다 (실측 1024 폭: 행 740px, 요약문 넘침 없음 → 아낀 26px 가 아무 값도 없었다). 이제 글꼴·패딩만 줄인다. 스토리 보기의 `.event-storyboard-card-cat` 도 같은 계약이다.
  - **`.cmd-step` 은 장식이다** — `aria-hidden="true"` 이고 `aria-label` 을 갖지 않는다. 베어 `<span>` 은 자기 접근성 객체가 없어 `aria-label` 이 감싸는 `role="button"` 인 `.cmd-head` 이름 앞에 `"1번째 명령"` 을 덧붙이기만 했다 — 형제 장식 `.cmd-prefix` / `.cmd-cat-icon` 과 같은 계약이다.
  - **`.cmd-head` 그리드는 자식 수가 변하는 것을 버턴다.** 트랙은 `auto auto 3px auto minmax(0, 1fr) auto auto` 이고 요약은 항상 `.cmd-summary` 한 칸에 들어간다 — 화자 얼굴(`cmd-speaker-face`)도 그 안이다. 예전에는 6트랙 고정이라 얼굴이 있는 줄에서 16px 얼굴이 `1fr` 을 받고 요약이 마지리 `auto` 로 밀려 유연성을 잉었고 배지들은 암시 트랙으로 넘치며 얼굴 줄과 얼굴 없는 줄의 요약 시작이 어긋난다. 지원/검사 배지는 명시 `grid-column` 을 갖는다. 실제 증거(1440·1024·960·800): 얼굴 줄과 바로 위 얼굴 없는 줄의 `summary.x` 가 동일하고 행별 가로 오버플로우가 전부 0 이다.
  - 배지와 힌트는 같은 읽기를 주장하지 않는다: 분기 자식은 런타임에 상호 배타이므로 어느 플레이스로도 배지 숫자만큼 실행되지 않는다. 그래서 배지는 「작성한 명령 수」를 말하고 실행 순서는 칼럼 힌트가 말한다.
  - 진단 스펙 `test/e2e/_evpage-do-shots.spec.ts` 는 산 선택자만 쓴다(`.cmd-list` / `.cmd-item` / `.cmd-summary` / `event-command-empty-line`). 예전 버전은 없는 testid(`event-command-row*`, `event-command-list`, `event-command-empty`)를 지어하 모든 JSON 보고서가 before·after 모두 `rowCount: 0` 이었다 — 아무것도 재지 않는 증거였다. 페이지 세그먼트 산 testid 는 `evt-page-segment-<n>` 이고 `event-page-tab-<n>` 은 `src` 어느 곳에도 없다 — 그것을 누르는 `eventEditorMockupShots.spec.ts` 와, 초보 모드에서 마운트되지 않는 이벤트 목록 패널의 `event-list-row-*` 로 진입하는 `eventEditorCertEvidence.openEventEditor` 는 기준 커밋 84bfc655 에서도 이미 열리지 않는 상태다(하니스 결함, 이 변경과 무관). `event-list-row-*` 자체는 `src/editor/panels/eventEditor.ts` 가 실제로 발행한다.
  - 빈 분기의 문구는 `src/editor/eventCommandBranches.ts` 가 정본이고 **두 개로 갈라져 있다**: `branchEmptyLabel`(`비어 있음`)은 상태만 적는 읽기 전용 문구로 AI 초안 미리보기가 쓰고, `branchEmptyActionLabel`(`비어 있음 — 여기에 명령 추가`)은 실제로 누를 수 있는 버튼 전용이다. 하나로 합치면 클릭해도 아무 일도 없는 diff 미리보기 마커에 「여기에 명령 추가」가 적혀, 이 변경이 없애려던 바로 그 결함(라벨이 못 하는 일을 약속함)이 되살아난다. 목록·스토리의 빈 분기는 실제 한 번 클릭 피커 버튼이다(`event-command-branch-empty-<경로>` / `event-storyboard-branch-empty-<경로>`). 목록 버튼은 인접한 `renderBranchDropLine` 과 같은 `data-container-path` 및 드롭 핸들러를 가져 클릭 삽입과 드래그 드롭 모두 그 분기에 직접 들어가며, AI 미리보기는 같은 문구의 읽기 전용 마커다. 스토리의 중첩 명령(`.event-storyboard-branch-step`)도 각 분기 컨테이너에서 1부터 다시 번호를 붙인다 — 이전에는 상위 카드만 번호가 있어 목록이 모든 줄을 번호한 뒤부터 두 보기가 어긋나 있었다.
  - 계약 테스트: `test/eventEditorCommandBoard.test.ts` (번호 순서·저작 명령 개수·루트/분기 한 번 클릭), `test/eventEditorStoryboardBranches.test.ts` (중첩 번호·빈 분기). 증거: `output/evidence/event-do-column/{before,after}/`; 수정된 프로브는 실제 `.cmd-item`/`.cmd-list`/`.cmd-kind` 기하와 행별 가로 오버플로우를 1440/1024/960/800에서 기록한다.
- **설정 레일:** 폭 **268px** (228px 에서는 `맵에서 숨기기` 라벨이 잘렸다). 아코디언 그룹은 `pageProps.ts` 의 `railGroup()` 팬토리가 만들며 `data-rail-group` 과 `evt-rail-meta-<slug>` 를 발행한다. 제목과 요약은 **그리드 행을 나눠** 생기므로 `모습과 대화그래픽 없음` 처럼 붙지 않는다 — 이전에는 아코디언 CSS 가 아예 없었다. NPC 관계와 일정은 `evt-rail-group-npc` (기본 접함)으로 내려가 페이지 설정보다 조용해진다. 진입점은 `appendEventRailGroup()`.
- **명령 툴바:** 플로팅 보조 도구 스트립(`event-command-quick-tools`)은 사라진다 — 명령 목록 아랫부분을 가리는 중복 표면이었다. 다섯 버튼은 **testid 그대로** 툴바 오른쪽 `.event-editor-command-aux-group` 으로 이사한다 (`event-command-quick-ai|preview|storyboard|flow|next` — `preview` 는 2026-08-30 에 중복으로 제거됐다, 아래 항목 참조). 따라서 `openCommandPicker(page, "quick-next")` 기존 e2e 진입점 9건은 그대로 살아 있다. 툴바 읽는 순서는 CSS `order` 가 소유한다: `+명령`(primary) 왼쪽 → 검색 → 보조 액션 → 뷰 토글 + aux 오른쪽.
- **중복 제거:** 페이지 스트립의 `명령 N` 칩은 제거됐다 (명령 컬럼 라벨이 개수를 소유). `pages-meta` 는 경고가 있을 때만 만들어진다.
- **검증 경고 행:** `.event-draft-validation` 은 `.event-editor` flex 컬럼에서 `flex: 0 0 auto` 를 받는다 — 이전에는 유생한 flex 자식이라 모달 아래로 밀려 `경고 1` 이 잘렸다.
- **증거와 계약:** `test/eventEditorLayoutHierarchy.test.ts` 가 DOM 계약을 잡고, 진단 스펙 `test/e2e/_event-editor-layout-shots.spec.ts` (`EVIDENCE_TAG=before|after`) 가 5개 상태를 1440×900 에서 촬영하고 기하·콘솔 에러를 JSON 으로 남긴다. (옛 초보 모드는 이벤트 목록 패널을 마운트하지 않았다 — 편집 모드는 2026-09-27 에 삭제됐고 목록 패널은 늘 있다. e2e 진입은 여전히 `openSeededEventEditor`(맵 더블클릭)가 가장 안정적이다.)
- **Option A 계층 구조:** 헤더(타이틀 + 페이지 세그먼트 + 테스트) + 본문 워크벤치(좌측 4그룹 요약 아코디언 레일 228px, 중앙 명령 목록, 우측 통합 인스펙터 340px) + 단일 primary 저장 액션 푸터. 검증 피드백은 세그먼트 배지 및 푸터 상태 텍스트로 전달된다.
- **Event editor shell density (Option A layout, 2026-08-27):** `src/editor/panels/eventEditor/` chrome aligns to Option A layout. The titlebar holds the editable name (`event-editor-name`), ID, coords, header page segments (`[data-testid^=evt-page-segment]`), and `테스트` action. The legacy wide page-tab strip in the modal body is removed (`.event-page-number-tabs`, `event-page-strip`, `event-page-tab-*` absent). The left settings rail (`event-editor-settings-column`) is organized into a 4-group summary accordion (`details > summary` for conditions, graphic, trigger/priority, autonomous movement) with live summary copy. Command editing uses click-select to highlight rows, double-click or Enter to open the edit dialog (removing per-row 편집 buttons). The right integrated inspector shows the selected command details and preview directly. Footer contains exactly one primary save action `저장하고 닫기` (`event-editor-save`). Modal root testid stays `event-editor-modal`. Tests: `test/e2e/event-layout-optiona.spec.ts`, `test/eventEditorHierarchyShell.test.ts`, `test/eventEditorBalancedShell.test.ts`, `test/eventEditorSettingsLayout.test.ts`, `test/eventEditorStoryboardBranches.test.ts`, `test/eventEditorUiDensity.test.ts`, `test/eventEditorModal.test.ts`.
- **Current hierarchy (Option A):** titlebar with integrated page segments + workbench + footer with single primary save. Workbench starts two-column (`228px / minmax(0,1fr)`) with a 4-group summary accordion rail on the left; inspector (`340px`) opens on row selection. Validation is a segment badge plus footer status line, not a full-width identity band. Retained actions remain mounted and keyboard reachable.
- **Event AI 명령 도크 (2026-08-28, 아래 「Event AI assist card」 항목을 상위 갱신한다):** `aiAssist.ts` 는 **「이 페이지가 하는 일」 칼럼의 마지막 그리드 행에 붙는 인플로우 도크**다. 예전에는 도구 팝오버 안의 칩이 `position:absolute` 카드로 열려 **자기가 명령을 넣을 목록을 덮었다** (실측: 1440 폭에서 cmd-list 면적의 46%, 1024 폭에서는 전폭). 삽입 위치를 못 보면서 삽입 위치를 고르라는 구조였다. 계약:
  - **진입점은 하나** — 툴바 `event-command-quick-ai` 가 도크를 토글한다(`aria-expanded` 반영). 도구 팝오버에는 AI 칩이 없다. 예전에는 같은 「AI 명령」 라벨이 툴바와 팝오버에 동시에 떠 있었다.
  - **칼럼 그리드는 `auto minmax(0,1fr) auto`** (`event-editor.balanced.css`). 암시 행으로 내버려 두면 1fr 이 줄지 않아 도크가 모달 밑밖으로 밀려난다(실측: 900 높이에서 도크 밑이 1016).
  - `event-editor-ai.css` 가 도크를 `max-height: min(46vh, 420px)` 로 묶어 cmd-list 행이 항상 남는다. cmd-list 와의 겹침 면적은 **0** 이어야 한다.
  - **Escape 는 도크만 닫는다** — 열릴 때 `registerModal` 로 모달 스택 최상단이 된다. 예전에는 프롬프트를 쓰다 Escape 를 누르면 이벤트 에디터 전체가 닫혔다.
  - 열면 프롬프트에 **포커스**가 가고, **Ctrl/Cmd+Enter** 로 생성한다.
  - **삽입 위치를 항상 말한다** (`ai-event-target`): 선택이 없으면 「맨 아래에 이어서 넣습니다」, 있으면 「「<명령 이름>」 다음에 넣습니다」. 삽입 버튼 라벨도 같이 바뀐다. 선택은 스토어 갱신 없이 클래스만 바뀌므로 cmd-list 클릭·도크 열기마다 다시 읽는다.
  - **상태 배지는 한국어**(`생성 중`/`오류`/`초안 N개`/`작성 중`) — 예전엔 `busy`/`error`/`ready`/`draft` 영문 토큰이 노출됐다. 오류 문구는 사람이 다음에 할 일을 앞에 두고 검증기 원문을 `—` 뒤에 붙인다. 사용자가 입력을 고치면 지난 오류는 스스로 사라진다.
  - 프롬프트 예시 칩(`ai-event-example-*`)은 입력만 채운다(자동 생성 금지).
  - 가드: `test/eventCommandAssist.test.ts`, `test/e2e/event-editor-aux-non-occlusion.spec.ts`(겹침 0 · Escape 범위 · 포커스), 증거는 `output/evidence/event-ai-assist-ux/960x900-compact.png`.
- **Event AI 초안 표시·프롬프트 계약 (2026-08-30, 실측 기반):**
  - **초안은 보기 방식보다 우선한다.** `content.ts` 의 `applyViewMode` 는 초안이 있으면 `stagedHost` 를 무조건 보인다. 예전에는 스토리·미리보기에서 `stagedHost` 를 숨기면서 목록도 숨겨, 기본 보기(스토리)에서 「위 목록에 표시했어요」라고 말하며 **아무것도 보여주지 않았다**. 기존 e2e 는 도크를 열기 전에 「목록 보기」를 눌러 이 경로를 지나지 않았다.
  - **완료 렌더는 살아 있는 도크로 간다.** `aiAssist.ts` 의 `liveDock` 이 현재 렌더 인스턴스를 들고 있고, 생성 완료 콜백은 자기 클로저가 아니라 그쪽에 그린다. 생성 중 스토어가 갱신되면(본문 재렌더) 예전 코드는 문서에서 떨어져 나간 `stagedHost` 에 그려 초안이 영원히 안 보였다. 재렌더된 도크는 `statusKind === "busy"` 면 생성 버튼을 계속 잠근다.
  - **충격은 대사보다 앞이다 (2026-09-22).** `buildEventAssistPrompt` 의 「충격 연출」 절이 함정·피격·마법·사망을 `playAudio`(효과음) → `showAnimation`(wait:true) → 상태 변화 → text 순으로 쓰게 한다. 화면을 덮는 애니메이션 id 를 목록 앞에 둔다. 게임오버 창의 그림·제목은 이 명령 배열 밖이고, 스튜디오 조수의 `set_game_over` 가 `system.gameOver` 를 고친다. 가드: `test/eventCommandAssist.test.ts`. 게임오버 그림은 `generate_game_over_image` 뒤 `set_game_over` 다.
  - **리소스 저작 능력을 유지하되 id 는 종류별로 준다.** `playAudio`/`showPicture`/`changeFace`/`playMovie`를 kind 목록에서 빼지 않는다. 대신 `src/ai/eventResourceCatalog.ts`가 슬롯별(`faceset`/`music`/`sound`/`picture`/`movie`) 목록을 만들고 프롬프트가 절을 나눠 실으며, 각 절은 `refSection`의 `MAX_REF_ENTRIES`로 잘린다. **한 덩어리 `collectResourceIds` 는 쓰지 않는다** — 실측으로 블랭크 프로젝트가 1851개였고 앞 40개가 전부 `tex_*` 칩셋과 `cc0-jetrel-*` 아이콘이라 얼굴·음악·효과음·그림 id 가 하나도 노출되지 않았다. **얼굴·음악·효과음은 에디터 폼과 같은 카탈로그**(`AUTHORABLE_FACESET_FACE_ASSETS`, `BGM_CATALOG`/`SE_CATALOG`+CC0·EasyRPG 오디오)를 쓴다. 얼굴 절은 흉상·전신 프리셋(`generated-face-*`)을 **맨 앞에** 둔다 — 낱장 얼굴 80장 뒤에 붙이면 상한 40개에 잘려 대형 초상 레이아웃이 가능하다는 사실이 프롬프트에서 사라진다. **그림 절은 성격이 다르다: 제안용이다.** 폼이 자유 입력이고 「그림 선택」 픽커는 `kind:"image"`로 454개를 제시하므로 큐레이션 목록은 «추천»일 뿐이고 유효성은 런타임 해석기가 정한다(아래 항목). 그 목록은 `resolvePictureSource`로 한 번 걸러 **검증이 받아 주는 집합의 부분집합**으로 유지한다 — 칩셋 이미지 10개(`newCommand("showPicture")`의 기본값 `tex_tiles_default` 포함)는 해석되지 않아 화면에 아무것도 안 나오므로 추천에서 뺀다.
  - **고를 리소스가 없는 kind 는 프로젝트를 보고 뺀다.** `aiCommandKinds(project)`가 슬롯이 빈 kind 를 제외한다. 동영상은 업로드로만 들어오므로 블랭크 프로젝트에서 `playMovie` 는 어떤 id 를 써도 구조적으로 틀린다 — 하드코딩이 아니라 프로젝트 상태로 판정한다.
  - **resourceId 검증은 종류까지 본다 — 단, 그림 칸의 권위는 런타임 해석기다.** `io/commandReferenceValidation`은 전역 집합 소속만 보므로 `{"kind":"playAudio","resourceId":"tex_easyrpg_chipset_dungeon"}`가 통과해 **소리 없는 이벤트**로 출하됐다(자가수정 루프가 볼 오류가 아예 없었다). `parseAndValidate`의 `validateResourceSlots`가 얼굴·음악·효과음·동영상은 슬롯 집합으로, **그림은 `resolvePictureSource`(런타임과 같은 함수)로** 판정한다. 그림을 큐레이션 집합으로 판정하던 구현은 픽커가 권한 이미지 **164개**를 반려했다(실측 454개 중; `scarloxy-monster-icon-*`, `monster` 종류로 올린 업로드 등) — false accept 보다 나쁜 false reject 였다(자가수정 3회를 태우고 하드 실패한다). 해석기가 오디오 업로드를 거부하므로 종류 교차 보호는 그대로다: 오디오 업로드를 그림 칸에 쓰면 여전히 반려된다. 빈 문자열은 「얼굴 지우기」라 통과시킨다. 알려진 한계: `playMovie` 는 미등록 id 를 `/assets/movies/<id>.mp4` 로 폴백하므로(`playSceneMovies.ts:30-39`) 이론상 같은 false-reject 가 가능하지만, 동영상 슬롯이 비면 kind 자체가 빠져 오늘은 도달 불가다.
  - **transfer 는 런타임이 실제로 착지시키는 칸으로만 보낸다.** 맵 참조 목록에 `가로 W × 세로 H` 와 `밟을 수 있는 칸 예: x=… y=…`를 싣고, `parseAndValidate`가 맵 밖 좌표와 `isPassableLanding` 실패 좌표를 반려한다. 이 공용 판정은 `isPassable && 네 방향 중 canMove 하나 이상`이며 런타임 `nearestPassableTile`도 그대로 쓴다. 따라서 한 방향 비트만 열린 함정 칸을 AI 게이트가 허용한 뒤 런타임이 조용히 재배치하는 불일치가 없다. 착지 가능한 칸이 맵 전체에 하나도 없을 때만 기존 안전 밸브대로 반려하지 않는다. 실측: 같은 요청에서 `(0,0)`(벽) → `(10,7)`.
  - **생성 시작 목록이 낙관적 동시성 기준이다.** `aiAssist.ts`는 await 전에 `page.commands`를 직렬화하고, 완료 시 store의 같은 페이지를 다시 읽어 비교한다. 생성 중 사용자가 목록을 고쳤으면 초안을 만들지 않고 「명령 목록이 생성 중에 바뀌었어요」 오류와 재생성 안내만 남긴다. `liveDock`은 현재 같은 key의 도크에만 DOM 렌더를 보내며 페이지 전환·에디터 닫기 뒤에는 상태만 저장한다. 에디터 close 이벤트와 테스트 reset은 `liveDock`을 비워 분리된 DOM 클로저를 남기지 않는다.
  - **생성 버튼은 살아 있는 도크에서 풀어야 한다.** `finally`는 자기 클로저의 버튼과 `liveDock.setGenerating(false)`를 **모두** 호출한다. 생성 중 스토어가 갱신되면 클로저의 버튼은 이미 문서에서 떨어져 나간 옛 도크 것이고, 새 도크는 `statusKind === "busy"`를 보고 자기 버튼을 잠근 상태다. 상태 쓰기는 재렌더를 부르지 않으므로 여기서 직접 풀지 않으면 **다시 생성할 방법이 영구히 없어진다**(B2 가 다루던 바로 그 흔한 경로다). 가드: `test/eventCommandAssist.test.ts`의 「생성 중 재렌더 뒤에도 살아 있는 도크의 생성 버튼이 다시 활성된다」.
  - **실측 도구:** `scripts/event-ai-live-probe.mts` (`emit` / `run` / `score`) + `src/benchmark/eventAi/scenarios.ts` 12 시나리오. 도크 예시 버튼에 박힌 문장을 그대로 쓴다 — 앱이 스스로 권하는 문장이 실패하면 그게 제품 결함이다. 결과는 `reports/event-ai-probe/<run>/REPORT.md`.
  - 가드: `test/e2e/event-ai-dock-defects.spec.ts`(기본 보기 · 생성 중 재렌더), `test/eventCommandAssist.test.ts`(kind 노출 · 좌표 검증). 증거 스크린샷: `test/e2e/_event-ai-adv-shots.spec.ts` → `verify-shots/event-ai-adv/`.
- **Event AI 도크 상태·문구 정리 (2026-09-03):** 실제 LLM 로 끝까지 태운 실측에서 동작은 정상이었고 결점은 표현이었다.
  - 같은 요약 숫자(「새로 6개 · 없어짐 2개」)가 칩·상태줄·결과 메타 세 곳에 반복됐다 → 숫자는 **칩과 결과 메타**만 말하고 상태줄은 다음 행동(「초안을 만들었어요. 위 목록에서 확인하고 「이대로 하기」를 누르세요.」)만 말한다. 결과 제목은 「위 목록이 초안이에요」/「위 목록 끝에 초안을 붙였어요」, 메타는 요약 + 「빼고 싶은 줄은 「빼기」로 제외할 수 있어요」.
  - 생성 버튼 라벨이 렌더 시점에만 정해져 초안이 생긴 뒤에도 「초안 만들기」로 남았다 → `refreshGenerateLabel()` 이 `renderStaged` 마다 「다시 만들기」/「초안 만들기」를 맞춘다. 생성 중에는 버튼 안 `.ai-event-spinner` 가 돌고 `aria-busy`, 도크 루트에 `is-generating`.
  - 적용 직후 입력이 남아 있다고 칩이 「작성 중」이라 했다 → `PanelState.applied` 로 「반영됨」(초록, `data-kind="applied"`)을 말하고 입력을 고치면 풀린다.
  - 초안 행 토글 「이건 빼기」/「다시 적용」 → 「빼기」/「되살리기」, 테두리 없는 12px 보조 글자(hover 에서만 테두리). 초안 목록(`.cmd-staged`)은 실제 목록과 같은 여백·들여쓰기(`6px 12px 24px`, `--blk-indent: 28px`)를 갖는다 — 예전엔 여백 0 이라 칼럼 가장자리에 붙었다. 결과 줄(`.ai-event-result`)은 제목·안내 왼쪽, 「이대로 하기·취소」 오른쪽 한 줄(flex-wrap).
  - 표면 기준선 `eventEditorShellSurface.baseline.json` 의 라벨 문구가 이에 맞춰 갱신됐다(라벨 수 변화 없음).
  - **헤더 닫기(×)·전체 보기 단추가 실제 마우스로 눌리지 않던 결함**(`modalDrag.ts`): 드래그 시작 가림막이 `instanceof HTMLElement` 라 SVG 아이콘(`<path>`)을 누르면 비켜나 `setPointerCapture + preventDefault` 가 뒤따르는 click 을 삼켰다(글리프→SVG 전환 뒤 생긴 회귀, e2e `event-ai-command-dock` 「닫기」 단계가 main 에서 실패). `instanceof Element` 로 고쳤다 — `test/eventEditorModalDragSvgTarget.test.ts`.
- **Event AI assist card (2026-08-24):** `aiAssist.ts` presents the flow as prompt → draft generation → result review → explicit insertion. The prompt has a visible `<label>`, its helper copy is connected with `aria-describedby`, generation feedback uses a polite status region, and the result region stays hidden until commands exist. `event-editor-ai.css` owns the readable rhythm (`13px/1.65`, 96px minimum prompt height, `12px/1.65` preview rows); `03-legend-toolbar.css` caps the floating card at 680px and keeps it out of command-list flow. At `1180px` or below, opening the AI chip must raise the aux tools above the compact command inspector instead of letting the inspector cover the prompt. Guards: `test/eventCommandAssist.test.ts` and `test/e2e/event-editor-aux-non-occlusion.spec.ts`; the latter writes `output/evidence/event-ai-assist-ux/960x900-compact.png`.
- **Event editor background persistence:** nested command/page/picker dialogs use a translucent warm scrim so the event editor remains visible behind them. Full view keeps a narrow scrim edge, and Escape exits full view without dropping the editor from `modalStack`. `test/e2e/event-editor-backdrop-persistence.spec.ts` tours the mounted button families and guards the same root backdrop across interactions.
- **Mockup parity maintenance (2026-08-24):** `eventEditorMockupShots.spec.ts` guards the `실행 내용 · N개` header, compact toolbar menus, conditional validation control, and the initial/selected viewport matrix at 1586, 1440, 1280, 1024, 960, and 800px widths. Historical screenshots and `new-editor/REPORT.html` document the earlier layout only; they must not force removed legend, recommendation, or bottom-strip chrome back into the product.
- **미리보기는 「이 페이지가 하는 일」 컬럼의 세 번째 보기 (2026-08-28, 아래 2026-08-30 항목이 툴바 부분을 갱신한다):** 보기 토글은 `목록 / 스토리 / 미리보기`(`event-view-toggle-list|storyboard|preview`) 세 칸이고, 미리보기를 고르면 `event-page-preview-host` > `event-page-preview` 가 명령 컬럼 전체 폭·높이를 그대로 쓴다. 미리보기 모드는 `oprn:storyboard-mode` 에 **저장되지 않는다**(저작 보기 = 목록/스토리만 남는다).
- **분기 열거는 `eventCommandBranches` 가 정본이다 (2026-08-30):** `src/editor/eventCommandBranches.ts` 의 `eventCommandBranches(command)` 가 분기 목록·라벨·경로 칸(`branchIndex`)·목록 마커 톤(`tone`)을 **한 곳에서** 준다. 뷰는 자기 목록을 갖지 않는다 — 네 뷰와 두 비-뷰 호출부가 전부 얇은 어댑터다: `commandList.ts:appendCommandChildren`(목록), `storyboardView.ts:branchesOf`(스토리), `previewSimulation.ts:branchesOf` + `walkWithSimulation`(미리보기·플로우), `tools/commandTraversal.ts:commandBranches`(프로젝트 순회), `eventDraftValidator.ts:commandBranches`(검증). **분기를 새로 만들면 정본에만 추가한다.** 왜 강제인가 (실측): 예전에는 열거 함수가 다섯 벌이었고 그중 셋이 상점 실패 분기(`failedTransactionBranch`)를 빠뜨렸다 — 런타임 `player/interpreter/resume.ts:38-40` 은 실행하는데 목록·플로우·미리보기에는 줄이 안 났고 검증도 그 안에 못 들어갔다(화면에 없는 분기는 모르고 지워진다). `commandList.ts` 는 `SHOP_FAILED_TRANSACTION_BRANCH_INDEX`(-12) 를 import 조차 안 해서 주소를 매길 수도 없었고, `previewSimulation` 의 `inn` 은 거울상으로 정상 분기를 빠뜨렸다. 라벨 규약은 **「언제 실행되나」를 답하는 `~때` 꼴**이다 (`조건이 맞을 때` / `조건이 맞지 않을 때` / `취소했을 때` / `반복할 내용` / `거래했을 때` / `거래하지 못했을 때` / `골드가 부족할 때` / `이겼을 때` / `성공했을 때` …). 예전에는 같은 조건 분기가 뷰마다 `참` / `참일 때` / `조건이 맞을 때` / `조건을 만족함` 네 이름이었다. 분기 «있음» 판정은 **배열이 있으면 있음**(빈 배열 포함) 또는 플래그가 켜져 있으면 있음 — 빈 분기를 찾아 명령을 밀어 넣는 호출부가 있으므로 «비어 있지 않음» 으로 좁히지 말 것. 목록 뷰의 묶음 끝 마커는 `branchGroupEndLabel`. 계약: `test/eventCommandBranchesSingleSource.test.ts`.
- **파생 보기 입구는 보기 세그먼트뿐이다 (2026-08-30):** 툴바 aux 버튼 `event-command-quick-preview`(`▶ 미리보기`) 와 `event-command-quick-flow`(`⌘ 플로우 보기`) 는 **둘 다 없다**. 각각 세그먼트 `event-view-toggle-preview` / `event-view-toggle-flow` 와 같은 화면으로 들어가는 중복 컨트롤이었다. aux 그룹에 남는 것은 `event-command-quick-ai` 하나뿐이고, `renderCommandAuxGroup` 의 `open(selector)` 헬퍼도 함께 사라졌다(`renderCommandToolbar` 의 `onOpenPreview` 배선도 그때 제거).
- **플로우는 네 번째 보기 방식이다 (2026-08-30, 위 「미리보기는 …세 번째 보기」 항목을 상위 갱신한다):** 보기 토글은 `목록 / 스토리 / 미리보기 / 플로우`(`event-view-toggle-list|storyboard|preview|flow`) **네 칸**이다. 플로우를 고르면 `event-page-flow-host` > `event-page-flow`(`<section>`) 가 명령 컬럼을 그대로 쓴다. 미리보기와 플로우는 **배타적**이므로 겹칠 오버레이가 없다. 저장 대상은 저작 보기(`목록`/`스토리`)만 — `AUTHORING_MODES` 가 그 목록이고, 확인 보기는 `oprn:storyboard-mode` 에 남지 않는다.

  왜 옮겼는가 (실측 2026-08-30): 예전 플로우는 `도구` 팝오버 안 `event-script-flowchart` details 였고, 본문에 `position:absolute; max-height: min(72vh,760px); right:0` 이 걸린 오버레이였다. (a) 미리보기 **위에** 떠서 「자동 재생」 버튼과 단계 카운터를 덮었고, (b) 팝오버 폭에 묶여 618×280 밖에 못 썼다 — 플로우는 분기를 **가로로** 벌리므로 폭이 특히 아프다(최상위 명령 7개 중 2개만 보였다). (c) 겹쳐 뜬 동안에도 미리보기가 몇 번째 단계인지 알려주지 않았다.

  단계 이어받기: `stepByPage`(모듈 지역 `Map<auxCompositeKey, index>`)에 미리보기가 현재 단계를 쓰고, 플로우가 읽어 그 노드에 `.is-current` + `aria-current="step"` 을 붙이고 `event-page-flow-current` 에 `미리보기 현재 단계 n/총` 을 쓴다. **인덱스로 짝지으면 안 된다** — `breakLoop` 은 뒤 명령을 걷지 않고 빠져나오므로 「단계 n번째」와 「노드 n번째」가 어긋난다(가드가 이 경우를 직접 만든다). 그래서 `SimulatedStep.path` 가 목록·스토리와 **같은** 편집 경로를 들고 다니고, 플로우 노드는 `data-cmd-path` 로 같은 주소를 찍어 경로로 맞춘다. `onSelect` 를 주면 노드가 `<button>` 이 되어 목록·스토리와 같은 인스펙터를 채운다. 계약: `test/eventPageFlowView.test.ts`.

  남은 testid: 본문은 `event-flowchart-body` 그대로(스크롤 컨테이너 CSS 재사용), 노드는 `event-flow-node-<kind>`, 분기 라벨은 `.event-flow-branch-label`. 사라진 것: `event-script-flowchart`, `event-flow-chip-status`, `event-command-quick-flow`. `auxOpenController` 의 `"flow"` 슬롯은 더 이상 바인딩되지 않는다.
- **Page Preview UX (2026-09-06; supersedes both August stage-cap notes):** `eventScriptModernViews.ts` remains a simulated sequencer, not a game interpreter. The page-only framing in the final `event-editor.balanced.css` cascade fills the actual remaining row after disclaimer, transport, shared heading/padding and context. The old `58vh` cap is removed; standalone command previews keep their 4:3 and positional presentation. At 1024x768, 1280x800 and 1440x900, ordinary text and speaker must fit every clipping ancestor on entry, including with the inspector. Long content is recoverable in the named, focusable stage scroll region; changing steps resets stage/context scrolling to the beginning.
  - Choices stay display-only and preserve label text/newlines/order/cancel context. Shared `.ecp-choice` rows use a decorative SVG arrow column plus a shrinkable wrapping label, including CJK and unbroken Latin tokens. The five-option/48-character authoring limits are unchanged; eight-option imports are separate resilience coverage.
  - Previous/Next are native-disabled at boundaries. `event-script-live-restart` stops and returns to step one; it is enabled while running even on step one. Last-step Play is explicitly replay-from-start; automatic arrival stops immediately, at the existing 1200ms interval. Empty pages omit transport; one-step pages disable all controls. Manual movement, view/page replacement and modal removal stop playback. Re-entry preserves/clamps the shared `stepByPage` position and Flow still highlights the exact nested `SimulatedStep.path`.
  - Transport uses natural-width 13px labels, 30px minimum height, existing refresh/arrow SVGs and local play/pause specs. Supporting text is at least 12px; the non-wrapping tabular counter reserves seven characters. No change to resource-manager/global `.btn.small` consumers. Disabling a focused boundary control falls back to Next, Previous, then Play; enabled controls keep focus.
  - Compact context wraps to two lines; a native details/summary exposes the full caption and branch/skipped context in a bounded scroll area. A visible hint names stage scrolling. One persistent polite atomic status shares the counter render and includes command kind plus at most 60 branch characters, never unbounded command bodies. DOM tests are not a screen-reader speech pass.
  - `content.ts:applyViewMode` restores focus to the replacement selected tab only when focus was in the old toggle. Arrow/Home/End remain one uninterrupted roving-tab sequence; non-tab refreshes do not steal focus. Regression seams: `test/eventEditorPagePreviewView.test.ts`, `test/eventPagePreviewTransport.test.ts`, existing simulation/Flow/command-preview/icon suites. Firefox local-only browser receipts and the reusable capture script are under `output/evidence/event-preview-ux/`; use only port 29841 for this worktree, block write requests, and preserve the before evidence.
  - **Preview paint (2026-09-07):** generic nameplate background must consume `--runtime-dialogue-glass-surface-strong` as an image layer (not a nested color-stop). Result gameover/title/ending and audio play/stop use distinct semantic fills/ink. `--shadow-pop` is a complete shadow list — do not prefix extra lengths. Guard: `test/eventPreviewPaintCssom.test.ts` (Chromium CSSOM + glyph-vs-hidden pixels). Do not repair washed Hangul with overflow/font.


- **미리보기는 「이 페이지가 하는 일」 컬럼의 세 번째 보기 (2026-08-28, 아래 2026-08-31 항목이 툴바 부분을 갱신한다):** 보기 토글은 `목록 / 스토리 / 미리보기`(`event-view-toggle-list|storyboard|preview`) 세 칸이고, 미리보기를 고르면 `event-page-preview-host` > `event-page-preview` 가 명령 컬럼 전체 폭·높이를 그대로 쓴다. 미리보기 모드는 `oprn:storyboard-mode` 에 **저장되지 않는다**(저작 보기 = 목록/스토리만 남는다).
- **분기 열거는 `eventCommandBranches` 가 정본이다 (2026-08-31):** `src/editor/eventCommandBranches.ts` 의 `eventCommandBranches(command)` 가 분기 목록·라벨·경로 칸(`branchIndex`)·목록 마커 톤(`tone`)을 **한 곳에서** 준다. 뷰는 자기 목록을 갖지 않는다 — 네 뷰와 두 비-뷰 호출부가 전부 얇은 어댑터다: `commandList.ts:appendCommandChildren`(목록), `storyboardView.ts:branchesOf`(스토리), `previewSimulation.ts:branchesOf` + `walkWithSimulation`(미리보기·플로우), `tools/commandTraversal.ts:commandBranches`(프로젝트 순회), `eventDraftValidator.ts:commandBranches`(검증). **분기를 새로 만들면 정본에만 추가한다.** 왜 강제인가 (실측): 예전에는 열거 함수가 다섯 벌이었고 그중 셋이 상점 실패 분기(`failedTransactionBranch`)를 빠뜨렸다 — 런타임 `player/interpreter/resume.ts:38-40` 은 실행하는데 목록·플로우·미리보기에는 줄이 안 났고 검증도 그 안에 못 들어갔다(화면에 없는 분기는 모르고 지워진다). `commandList.ts` 는 `SHOP_FAILED_TRANSACTION_BRANCH_INDEX`(-12) 를 import 조차 안 해서 주소를 매길 수도 없었고, `previewSimulation` 의 `inn` 은 거울상으로 정상 분기를 빠뜨렸다. 라벨 규약은 **「언제 실행되나」를 답하는 `~때` 꼴**이다 (`조건이 맞을 때` / `조건이 맞지 않을 때` / `취소했을 때` / `반복할 내용` / `거래했을 때` / `거래하지 못했을 때` / `골드가 부족할 때` / `이겼을 때` / `성공했을 때` …). 예전에는 같은 조건 분기가 뷰마다 `참` / `참일 때` / `조건이 맞을 때` / `조건을 만족함` 네 이름이었다. 분기 «있음» 판정은 **배열이 있으면 있음**(빈 배열 포함) 또는 플래그가 켜져 있으면 있음 — 빈 분기를 찾아 명령을 밀어 넣는 호출부가 있으므로 «비어 있지 않음» 으로 좁히지 말 것. 목록 뷰의 묶음 끝 마커는 `branchGroupEndLabel`. 계약: `test/eventCommandBranchesSingleSource.test.ts`.
- **페이지 관리는 탭 옆 한 줄이 정본이다 (2026-08-30):** `pageProps.ts` 의 `renderPageActions` 가
  `.event-editor-pagebar` 에서 탭 스트립 **바로 오른쪽**에 여섯 버튼을 항상 마운트한다 —
  `event-page-duplicate`(복제) · `event-page-copy`(복사) · `event-page-paste`(붙여넣기) ·
  `event-page-move-back`/`event-page-move-forward`(순서) · `event-page-delete`(삭제).
  못 쓰는 상황은 **`disabled` + 이유를 담은 `title`** 이다. 조건부 마운트 금지 — 버튼이 나타났다
  사라지며 이웃 버튼 자리를 밀었다. 페이지 추가는 여전히 스트립의 `evt-page-add`(`+`) 하나다.

  왜 바꿨는가 (실측 1600×1000): 예전 `renderPageTabs` 는 접힌 `<details class="event-page-tabs">`
  (`페이지 ▾`)였고 `margin-left: auto` 로 **x=1514** 에 밀려 있었다. 탭 줄은 x=12..639 다. 즉
  조작 대상과 조작 수단이 1500px 떨어진 채 기본 상태가 닫힘이라, 복사·삭제가 화면에 아예 없었다
  ("페이지 삭제·복사 기능이 없다"는 재발견이 여기서 나온다). 같이 고친 것:
  - **복제·순서 이동은 UI 도달 불가였다** — `copyEventPage` / `moveEventPage` 는 모델·유닛테스트가
    있는데 호출부가 0이었다. 페이지 순서는 런타임 우선순위다(`resolveEventPage` 는 **마지막에
    조건이 맞는 페이지**를 고른다) — 순서를 못 바꾸면 우선순위를 못 정한다.
  - **복제·붙여넣기는 기준 페이지 바로 앞(낮은 우선순위)**에 꽂는다. 런타임은 조건을 통과한
    마지막 페이지를 고르므로, 바로 뒤에 꽂으면 기준 페이지가 마지막일 때 복사본이 즉시 승자가 된다.
    기준 페이지가 첫째·가운데·마지막 어디에 있든 바로 앞 삽입은 기존 resolve 결과를 유지한다.
  - 복제·붙여넣기 이름은 `X 복사본`, `X 복사본 2`, … 순서로 충돌을 피한다.
  - **탭 우클릭 메뉴** `pageTabContextMenu.ts` (`event-page-context-menu`, 항목
    `event-page-menu-*`). 명령 목록에는 우클릭 메뉴가 있는데 탭에는 없어 상호작용 모델이 갈렸다.
    스킨은 `.event-command-context-menu` 를 공유하고, Escape 는 `stopPropagation` 으로 메뉴만 닫는다.
  - **WAI-ARIA tablist 계약**: `role="tab"` 에서 `aria-pressed` 를 제거(tab 은 `aria-selected` 만
    쓴다), roving `tabindex`(활성 0 / 나머지 -1), `ArrowLeft/Right/Home/End` 로 선택 이동,
    **Ctrl/Cmd+화살표로 순서 변경**. 예전엔 ArrowRight 를 눌러도 포커스·선택 모두 제자리였다.
  - **헤더 이름 상자가 활성 페이지를 따라간다** (`modal.ts`). 헤더는 모달을 열 때 한 번만 렌더되고
    refresh 는 페이지 카운터만 갱신했다 — 그래서 상자는 1페이지 이름에 묶여 있었고, 2페이지를 고른
    뒤 이름을 고치면 **1페이지 이름이 바뀌었다**(실측: `페이지 2/4` 인데 상자는 `페이지 1`).
    이제 `change` 가 입력 시점에 활성 페이지를 다시 읽고, `refreshHeaderPageSegments` 가 포커스가
    없을 때만 값을 맞추며, 페이지가 2장 이상이면 접근성 이름이 `페이지 이름 (n/N)` 이 된다. **(2026-09-18 폐기: 이 상자는 이제 이벤트 이름이다 — 위 «P0 다섯 가지 수정» 참조.)**
  - 페이지 액션 아이콘 슬롯 제거: `.event-page-button-icon-{copy,paste,delete}` 는 글리프 CSS가 없어
    18px 빈 상자였다. 라벨만 남긴다.
  - 복제·복사·붙여넣기·순서·삭제는 모두 `toast` 로 결과를 말한다(예전 복사는 무반응이었다).
  - 한 동작은 **모든 표면에서 한 단어**만 쓴다 — 버튼·좁은 포트·우클릭 메뉴가 같은 `복사` /
    `붙여넣기` 를 쓴다. 라벨을 `font-size: 0` 으로 지우고 `::after` + `attr(data-compact-label)`
    로 다른 말을 그리지 마라 — 화면은 `보관`, DOM·접근성 이름은 `복사해 두기` 가 되어 보이는
    라벨이 접근성 이름에 없는 상태(WCAG 2.5.3 Label in Name 실패)가 되고 음성 제어가 깨진다.
    복제·복사·붙여넣기의 시각적 구분은 **장식용 CSS 글리프(`::before`)** 가 맡는다.
  - 탭 우클릭 메뉴는 선택을 옮기지 않으니, 붙여넣기도 **우클릭한 페이지**를 기지로 삼는다 —
    `pasteEventPage(mapId, eventId, anchorPageId?)` 의 3번짜 인자로 명시하며, 생략하면 활성 페이지다.
    기지 id 가 이벤트에 없으면 **index 0**(가장 낮은 우선순위)에 넣는다 — 맵 단위 되돌리기·원격
    리로드가 페이지를 지워도 `editorState` 는 재조정되지 않아 낡은 id 가 남는다. 끝에 붙이면
    그 상황에서 붙여넣기가 **가장 높은 우선순위**를 얻어 insert-before 불변식이 뒤집힌다.
    예전엔 메뉴가 `editorState` 의 활성 페이지로 자리를 잡아, 1페이지를 고른 상태에서 3페이지를
    우클릭해 붙여넣으면 새 페이지가 index 0 에 꽂혔다(복제·순서·삭제는 우클릭한 페이지를 다뤄
    같은 메뉴 안에서 기지가 갈렸다).
  - **복사는 읽기 전용이다** — `copyEventPageToClipboard` 는 선택을 바꾸지 않는다.
    예전엔 여기서 `editorState.set` 을 부려서 탭 우클릭 «복사» 만으로 헤더 이름 상자·명령 목록·
    검증 벨·버튼 줄의 대상이 전부 우클릭한 페이지로 넘어갔다.
  - **클립보드 갱신 경로는 하나다**: `subscribeCopiedEventPage`(`eventPageClipboard.ts`). 버튼 줄이
    구독하기 때문에 버튼·우클릭 메뉴 어느 경로로 복사해도 붙여넣기 활성·안내문이 같이 맞춰진다.
    클립보드는 store 도 editorState 도 아니므로 이 구독 없이는 아무도 변경을 듣지 못한다 — 이미
    활성인 페이지를 메뉴로 복사하면 선택값이 그대로라 `editorState.set` 은 통지하지 않아
    «복사했어요» 토스트와 동시에 붙여넣기가 disabled + «먼저 복사를 누르세요» 여서 버튼 상태가
    현실과 모순됐다.
  - 복제·붙여넣기의 **자리 약속은 토스트·툴팁 둘 다** 에 적는다 — hover 툴팁만 있으니
    마우스를 얼리지 않는 사용자는 우선순위 계약을 볼 수 없었다.
  - `role="tab"` 은 `aria-selected` 만 쓰므로 e2e 도 그것을 읽어야 한다 — `aria-pressed` 로 활성 탭을
    찾는 assertion 은 항상 -1 을 낸다(`test/e2e/event-layout-optiona.spec.ts` C4 가 이로 인해 poll
    후 색잡이었다).
  - 페이지 순서 이동·삭제는 boolean 결과를 반환하고 실제 변경이 있을 때만 성공 toast 를 띄운다.
    우클릭 메뉴는 클릭 시점의 live 페이지 배열을 읽으며, 닫기 한 경계가 outside listener 와
    modalStack 등록을 함께 해제한다.
  - 탭 포커스 복원은 위치 testid 가 아니라 `data-page-id` 로 새 렌더 트리를 다시 찾는다.
  - 1024px 이하에서는 액션 문구를 줄이고 페이지바 안의 탭 스트립만 가로 스크롤을 소유한다.
    고정 액션을 `overflow:hidden` 밖으로 자르는 구조는 금지다.
  - **탭은 드래그로 순서를 바꾼다** (`pageTabDragDrop.ts`). 페이지가 2장 이상이면
    `.evt-page-segment` 에 `draggable="true"` 이고, 떨어뜨린 칸의 왼쪽/오른쪽 반으로
    앞/뒤를 고른다. 모델은 `moveEventPageTo` 한 번의 `store.update` 다 — `moveEventPage(±1)`
    을 반복하지 마라(중간 상태가 감사 로그와 구독 렌더를 여러 번 깨운다). 드롭 소스는
    MIME `getData` 가 아니라 모듈 변수(`draggingPageId`)다(맵 트리와 같은 함정).
    `text/uri-list` 나 URL 모양 `text/plain` 은 넣지 않는다 — 브라우저 크롬에 떨어뜨리면
    탐색이 된다.
  - **복제·복사·붙여넣기 버튼은 네이티브 드래그를 막는다.** 복제 글리프 `⧉`(`U+29C9`)와
    짧은 라벨은 브라우저가 기본 텍스트/링크 드래그로 가져가고, 주소창·파일 대화상자에
    떨어뜨리면 「브라우즈」로 이어지며 클릭(실제 복제)은 삼킨다. 버튼은 `draggable="false"`
    + `dragstart` `preventDefault` + `user-select:none` / `-webkit-user-drag:none` 이다.
  - 계약: `test/eventPageManagementSurface.test.ts`, `test/eventPages.test.ts`,
    `test/eventEditorModal.test.ts`. 표면 기준선
    `test/fixtures/eventEditorShellSurface.baseline.json` 과 CSS 실사용 클래스 기준선을 함께 갱신했다.

- **미리보기 입구는 보기 세그먼트 하나다 (2026-08-31):** 툴바 aux 버튼 `event-command-quick-preview`(`▶ 미리보기`) 는 **없다**. 세그먼트 `event-view-toggle-preview` 와 같은 `changeMode("preview")` 로 들어가는 중복 컨트롤이었고 같은 라벨로 나란히 서 있었다. aux 그룹에 남는 것은 `event-command-quick-ai` 와 `event-command-quick-flow` 뿐이다(플로우는 팝오버를 여는 별개 동작). `renderCommandToolbar` 의 `onOpenPreview` 배선도 함께 사라졌다.
- **Historical August page-stage sizing:** superseded by the 2026-09-06 Page Preview UX contract above; do not restore the viewport-height cap.

  왜 옮겼는가 (실측 2026-08-28, `verify-shots/page-preview-probe/02-preview-open.png`): 예전 미리보기는 `도구` 팝오버 안 `event-script-live-preview` details 였고, 그 본문에 `position: absolute; max-height: min(280px, 42vh)` 가 걸려 있었다. 무대는 486px 로 자라는데 본문이 280px 이라 무대 아래쪽과 캡션이 잘렸고, 팝오버가 스토리보드 위에 겹쳐 글자가 서로 뚫고 나왔다. 즉 미리보기가 열려도 볼 수 없었다.

  구성: `renderEventPagePreview({ mapId, eventId, page })` 가 미리보기 패널을, `renderEventPageFlow({ mapId, eventId, page, onSelect })` 가 플로우 패널을 만든다(예전 `renderEventScriptModernViews` 는 둘을 한 번에 만들었고, 그 다음 세대인 `renderEventScriptFlowchart` 는 팝오버 아코디언을 만들었다 — 둘 다 없다). 스텝 조작 testid(`event-script-live-prev|next|play`)와 무대·캡션 testid(`event-script-live-stage|caption`)는 그대로다. `auxOpenController` 의 `"preview"`·`"flow"` 슬롯은 더 이상 바인딩되지 않는다 — 컨트롤러는 범용이라 슬롯 자체는 남겨 뒀다.

- **Storyboard trust surface (2026-08-25):** **Storyboard is the default authoring view**; List remains the complete reorder/context-menu surface. Storyboard is a vertical scan view: top-level commands keep full authored dialogue in the DOM, and every path-bearing branch (choice/fork/loop/shop/inn/promotion/evolution/battle) recursively exposes descendants at arbitrary depth with exact selectable command paths. Selected cards publish `.is-selected` plus `aria-current="step"`. The inspector's current-edit action switches persisted card density back to the mounted form before focusing it; closing returns focus to the selected Storyboard control. “미리보기 새로고침” rerenders from current command data rather than claiming runtime playback restart. The add card opens the normal command picker and is labelled as command addition, not scene or AI generation.
- **Event editor windowing (2026-08-24):** the title bar exposes full view (`Alt+Enter`, title-bar double click); Escape restores windowed geometry before a later Escape reaches the modal close guard. The settings/canvas separator supports pointer drag, Arrow keys (`Shift` for the large step), Home/End, and double-click reset with separator ARIA values. Full view disables outer drag/resize and restores the previous inline width/height/transform.
- **적대적 UI/UX 정리 (2026-08-27, 위의 「명령 툴바」 항목을 상위 갱신한다):**
  - **명령 행 클릭 계약이 실제로 배선됐다.** `commandList.ts` 의 행 `click` 은 예전에 곧바로 편집 모달을 열었고 `showCommandInspector()` 는 재렌더 복원 분기(`sameInspectorPath(path, selectedCommandPath())`) 안에서만 호출됐다. 그 조건은 `showCommandInspector()` 자신이 세우는 값이라 영원히 거짓이었고, 그래서 "선택한 명령" 인스펙터 칼럼은 도달 불가능한 빈 칼럼이었다(실측: `hidden=true, width=0`). 이제 **한 번 클릭 = 선택 + 인스펙터**, **더블클릭·Enter/Space·우클릭 「편집」 = 편집 모달** 이고 행 tooltip 도 그대로 말한다. 계약 테스트: `test/eventEditorInspectorSelection.test.ts`.
  - **툴바 중복 제거.** `event-command-quick-next`(툴바 `+ 명령` 을 대신 클릭) 와 `event-command-quick-storyboard`(목록/스토리 세그먼트를 대신 클릭) 는 삭제됐다. 남은 aux 는 `event-command-quick-ai` 하나다(2026-08-30 에 `preview`·`flow` 도 세그먼트와 중복이라 제거됐다 — 위 「파생 보기 입구」 항목). e2e 헬퍼 `test/e2e/eventStoryboardPicker.ts` 의 `PickerEntryPoint` 는 `"quick-next"` 이름을 유지하되 살아있는 `event-command-toolbar-add` 를 가리키므로 기존 스펙 8개 호출부는 그대로 돈다.
  - **라벨은 잘리지 않는다.** `toolbarButton()` 이 `title.split(" ")[0]` 으로 라벨을 만들어 "다시 실행"→"다시", "AI 명령"→"AI", "다음 행동"→"다음" 이 되던 것을 고쳐, 아이콘과 온전한 한국어 라벨을 따로 받는다.
  - **1024px 툴바는 줄바꿈한다.** 이전에는 `+ 명령` 프라이머리가 열 왼쪽 밖으로 잘렸다(실측: 버튼 `left=222` vs 열 `left=268`). `03-legend-toolbar.css` 가 툴바 행을 `flex-wrap: wrap` + 자동 높이 행으로 고정하고 프라이머리는 라벨 폭을 유지한다.
  - **죽은 identity 카드 제거.** `display: none` 인 채 DOM 에 남아 있던 `.event-editor-card` 와 그 안의 `window.alert` 기반 「ⓘ 이벤트 정보」 버튼, 도달 불가능한 `event-position-x/y` 좌표 입력이 사라졌다. 이벤트 위치 검증(`event.position.out-of-bounds`) 의 이동 대상은 헤더의 보이는 좌표 표시 `event-editor-coords` 로 옮겼다.
  - **네이티브 대화상자 금지.** 이벤트 에디터는 `window.alert` / `window.confirm` 을 쓰지 않는다 — 페이지 삭제와 「그 외 분기」 삭제는 앱의 `showConfirm` 을 쓴다.
  - **문구·프리뷰 정직성.** 좌측 레일 「움직임과 속도」 요약은 raw enum(`fixed`) 대신 `movementTypeChipLabel()` 의 한국어 라벨을 쓴다. m2 명령 본문의 리소스 프리뷰는 종류를 보고 렌더한다 — 오디오(music/sound) 필드는 640×500 "그림을 고르세요" 이미지 우물을 만들지 않고 선택한 음악을 한 줄로 알린다. 도움말도 staged 폼의 현실대로 "값을 고르고 확인을 누르면 적용됩니다." 로 바뀌었다.
  - **적대적 프로브:** `scripts/qa-event-editor-ux.mjs --label <tag>` 가 위 계약 9개를 실제 브라우저에서 판정하고 하나라도 깨지면 exit 1 이다. 증거는 `.omo/evidence/event-editor-ux/<tag>/`.
- **셀프 스위치 조건 행:** `selfSwitch`는 간단 행에 표시된다(고급 전용 아님). 컨트롤은 `conditionForm.selfSwitchControl` — 세그먼트 A/B/C/D 버튼 + ON/OFF 토글. 첫 번째 selfSwitch는 간단 행, 초과분은 고급 목록. `setSelfSwitch` 명령 본문도 동일 컨트롤 사용.
- **호감도 조건은 NPC 관계 게이트를 UI 에서도 말한다 (2026-08-28):** 런타임 `resolveSocialKey` 는 `event.id` 로 폴백하지 않으므로 NPC 키가 비었고 이벤트에 `characterId` 도 없으면 `friendshipAtLeast` 는 **항상 거짓**이다(`docs/specs/2026-07-14-character-id-relationship-gate.md` §1-7). 예전에는 `renderPageConditions` 의 event 인자가 `_event` 로 미사용이라 조건 행이 이 사실을 감췄고 자리표시자는 "비우면 이 이벤트" 라고 거짓말했다. 지금은 `renderPageConditions` → 컨텍스트 `hostHasCharacterId` → `renderFriendshipAtLeastCondition({ hostHasCharacterId })` 로 흐르고, 미연결 + NPC 키 공백이면 자리표시자가 "NPC 키를 적어야 합니다" 로 바뀌며 `event-condition-friendship-requires-character-id` 힌트가 붙는다(고급 목록 행은 `event-page-advanced-condition-friendship-requires-character-id-<i>`). **행을 숨기거나 잠그지는 않는다** — NPC 키를 직접 적는 저작 경로는 미연결에서도 유효하고, RM 계약상 핵심 조건 행은 항상 자리를 지킨다. 같은 조합은 검증기가 `condition.friendship.no-character-id` 경고로도 잡는다. 계약 테스트: `test/friendshipConditionGate.test.ts`.
- **검증 이슈 앵커는 닫힌 레일 그룹을 연다:** 좌측 레일 그룹은 `<details>` 가 아니라 `is-open` 클래스라서 `navigateToEventDraftIssue` 의 details 여는 로직만으로는 못 열었다. `openEventRailGroupFor(target)`(`pageProps.ts`)이 앵커가 속한 그룹을 활성 그룹으로 바꾼 뒤 포커스한다. 조건·그래픽·이동 이슈 전부가 이 경로를 탄다.


## Condition / Loop / Variable command trust fixes (2026-08-07)
- `conditionForm.ts`: 빈 스위치/변수/배우/아이템 인라인 에러, all/any 빈 그룹 경고, 종류 전환 시 값 캐시 복원(되돌리기 유실 방지), 변수 비교값 정수 절삭 일관화.
- `commandBodyVariable.ts`: 소스 전환 값 캐시 보존, 숫자 입력 소수 절삭 방지(정수 표시), 0 나누기/오버플로 경고 배지, 대상·소스 변수 빈 ID 에러. 렌더 중 상태변경 제거.
- `commandBodyLoop.ts`: 빈 본문/무한루프(탈출 없음) 경고, breakLoop 탈출 배지, 작업 중 staged 동기화, 삭제 후 포커스 복원.
- `session.ts` / `previewSimulation.ts`: 변수 나눗셈을 `Math.trunc` + `+/-9,999,999` 클램프, 0 나누기는 유지+경고(로그), `clampVariableValue`/`VARIABLE_MIN|MAX` 노출.
- `stack.ts`: `breakLoop`가 루프 밖에서 스택을 증발시키지 않도록 가드 — 루프 없으면 경고만, `hasLoopFrame` 추가. 최대 반복 100,000 가드는 유지.
- `eventDraftValidator.ts`: `loop.break-outside-loop` / `loop.empty-body` / `loop.no-break` / `variable.divide-by-zero` / `condition.all|any.empty` 경고/에러, 기존 레퍼런스 검증과 함께 커밋 게이트에서 노출.
- `conditionEvalPreview.ts`: 프리뷰 평가를 `startSession` 고정에서 `previewSimulation` 시뮬 상태 기준으로 승격(작가-플레이어 괴리 완화).
- 스타일: `event-editor.part-3/08-inline-validation-badges.css` 인라인 에러/경고 배지.

## Event draft trust loop (2026-07-30)
- Opening an event starts an editor-only draft through `eventDraftActions.ts`. Existing events keep their pre-open canonical body in `draft.original`; new events use `draft.kind:"new"`. Editor map markers, event lists, and drag operations intentionally read `editorWorkingEvents()` so the open working body remains visible, while persistence and runtime consumers use the canonical projection described in `runtime-project-schema.md`.
- **본문이 헤더/푸터만 남고 하얘지면 (2026-09-02):** `modal.ts` 의 `refresh()` 는 동적 본문을 지운 뒤 `renderEventEditorDynamic` 을 그린다. 페이지에 `graphic` / `movement` / `trigger` / `commands` 가 없으면 설정 레일이 `page.movement.type` 에서 던지고 본문이 빈 칸으로 남았다. `normalizeEventPage` 가 화면용 기본값을 채우고, 검증기는 같은 칸을 선택적으로 읽으며, `refresh` 가 그래도 던지면 `event-editor-render-error` 를 남긴다. 레이아웃은 `event-editor.balanced.css` 가 바디를 flex 로 고정하고 에디터 그리드를 페이지바+워크벤치 두 행(`!important`)만 인정한다 — 옛 `auto auto 1fr` 3행이 이기면 워크벤치가 0 높이로 접힌다. 계약: `test/eventEditorModal.test.ts`, `test/eventPageNormalize.test.ts`, `test/eventEditorBalancedShell.test.ts`.
- Apply and OK run the aggregate validator before `saveEventDraft`; Cancel restores `draft.original` or removes a new draft. Linked display names and field-template switch definitions now live in `draft.authoredWrites` (`eventDraftAuthored.ts`), not canonical profiles/flags. Dirty checks and the existing vault include them; Apply takes one project snapshot when linked writes exist (map-only otherwise), and Cancel drops them without global history. Validation/preview consumers must use `projectWithEventDraftAuthoredWrites(project, mapId, eventId)` for staged references; that working projection must never be persisted. `validateEventDraftBody` now applies that projection itself, and the NPC rail reads the staged name; `test/eventDraftProjectionIntegration.test.ts` covers both the rail and parent Apply. PR #614 is integrated as an incomplete snapshot, not Phase 2 completion; current verification and limitations are recorded in `.omo/evidence/wish-event-audit/PR614_MERGE.md`. The modal checkpoints the working body into `eventDraftVault.ts` and project-scoped localStorage so an autosave merge, remote reload, or interrupted editor render cannot blank the open event. Footer text distinguishes local recovery/draft state from actual LegacyDb autosave state; “로컬 복구” is never presented as remote success.
- Empty pages render six beginner paths in `eventEditor/content.ts`: dialogue NPC, item-reward treasure chest, transfer, shop, battle, and blank/search. The treasure starter compiles to `changeItem += 1` with the first existing item and refuses when the database has no item; reusable item storage remains the separate `openChest` (`보관 상자`) command. Its editor form presents local/shared storage scope, names shared storage in author-facing language, and previews the two-way bag ↔ chest interaction without exposing runtime keys. `eventBeginnerTemplates.ts` otherwise seeds only map/item/troop ids that exist in the current project, chooses a passable transfer cell deterministically, and refuses with an explicit message when a required record does not exist. Each valid starter still opens the normal command edit dialog before insertion.
- Dialogue command previews use the runtime `--runtime-dialogue-*` dark-glass tokens for `.ecp-message-window`, speaker tabs, faces, and choices. Preserve the preview DOM/testids and keep transparent, face-left/right, bust/full, position, and choice states visually aligned with `src/styles/dialogue.css`.
- Reactive modal renders preserve settings/command scroll, focused testid/command row, text selection, selected command, and open details. The command picker shortcut is Ctrl/Cmd+K. Focus restoration and draft Cancel behavior are covered by `test/eventEditorTrustLoop.test.ts`; pure starter safety is covered by `test/eventBeginnerTemplates.test.ts`.

## 회상 오프닝 저작 — beat 컴파일러다 (2026-09-03)

- `script_cutscene_preset` `memory_opening` 은 `src/editor/recollectionBeats.ts` 의 `recollectionBeats()` 가 만든다: 페이드 아웃 → 회상 BGM(`cc0-bgm-rtp-emo-001`) → 틴트(`#c4a070`) → `showPicture`(`pic_memory`) → 대사 → 그림 지우기 → 틴트/페이드 복원 → BGM 정지. 새 `Command.kind` 는 없다 — 기존 showPicture/playAudio/fade/tint 조합이므로 인터프리터를 손대지 않는다.
- `pictureResourceId`·`bgmResourceId` 인자로 스틸/BGM 을 바꿀 수 있고, 비우면 기본값(구름 스틸 + CC0 BGM)이 들어간다.
- 빈 이벤트의 「회상 오프닝」 CTA(`memoryOpeningTemplate.ts`)는 별도 「컷신」 페이지를 만들지 않고 보고 있던 빈 페이지에 그 프리셋을 심는다.
- 계약: `test/recollectionBeats.test.ts`, `test/eventEditorMemoryOpeningTemplate.test.ts`, `test/scriptCutsceneIntegration.test.ts`(장면 테스트로 스틸 표시 + 종료 후 입력 잠금 해제까지 검증).

- 맵 기반 회상 예제 **「철수의 기억」** (2026-09-05): LegacyDb `rpg-zzu-cheolsu-memory-20260905-df12`. 현재 강변의 상자 조사 → 별도 여름 맵 자동 컷신 → 현재 귀환과 후일담. `memory_seen`/`memory_closed`로 완료 상태를 분리하고, 맵 전이는 각 이벤트의 마지막 명령으로 둔다. 재현 저작: `npx tsx scripts/build-cheolsu-memory.mts` (이 ID만 저장 후 재로드 대조). 출하 플레이어 검증: `node scripts/qa-cheolsu-memory.mjs`; 결과 `verify-shots/runtime-qa/cheolsu-keyboard-fixed/SUMMARY.md`. 후속 검토에서 NPC 방향 전환의 30초 정지를 발견했다. 해당 구간의 이벤트 이동 허용/복원 명령을 원격 프로젝트에 추가했고, 검증은 일반 키보드 입력과 침묵 시간 상한을 사용한다(`docs/reviews/2026-09-05-event-runtime-audit.md`). 대사창은 장면 중간에도 닫히므로 창 부재만으로 컷신 종료를 단정하지 않고, 대사 내용·진행 스위치·입력 복구를 함께 확인한다.

## Guided story arc facade

`author_story_arc` is the deterministic high-level path for bounded tutorial objectives, executable choice branches, and an optional twist reveal. It compiles only to existing event text/choices/fork/setSwitch/setVariable commands plus quest graphs and story-flag metadata, reports the created identifiers, and rejects empty objectives or branch bodies. It is a structural authoring aid, not an automatic prose-quality or story-quality judge.

## 지도·화면 효과 탭 초보자 UX (2026-08-27)
- **전수 감사:** 명령 피커 3탭 45항목을 playwright로 전부 열어 스크린샷(`.omo/evidence/event-map-items/before|after/`)과 항목별 감사(`audit-before.md`)로 남겼다. 고유 다이얼로그 44개가 A형(설명카드+요약+미리보기)과 B형 레거시(기타 명령 껍데기)로 갈라진다.
- **B형 껍데기 통일 완료 (2026-09-15).** 당시 적은 9건 목록(m2-026/030/066/078/201/202/205/207/212)은 **틀렸다** — 실제 렌더를 떠서 세어 보니 7건이다. m2-202(화면 연출)는 이미 설명카드를 달고 있었고, m2-205(길찾기 이동)는 이미 전용 폼(설명카드+미리보기, 컨트롤 30개)이었다. 눈으로 목록을 만들지 말고 `captureM2Surface` 로 떠서 셀 것.
- 남은 7건(m2-026/030/066/078/201/207/212)에 설명카드를 붙였다(`commandBodyM2.ts`의 `M2_INTENT_BY_TITLE`). 키는 카탈로그의 **영어 `title`** — 전문 렌더러들이 쓰는 분기 축과 같다(id 는 별칭이 갈린다). 카드 본문 둘째 문장은 **부정문**이다: 한국어 머리글이 이미 "무엇을 하는지"는 말하므로, 카드의 값은 "무엇을 하지 **않는지**"(헷갈리는 짝 배제)에 있다. 첫 문장만 쓸 거면 붙이지 마라.
- 판정 축은 `m2-command-intent-card` 클래스 하나로 모았다. 전에는 화면 연출·이벤트 지우기가 제각각의 마커를 쓰고 있었다. 계약 테스트 `test/m2CommandIntentCard.test.ts`.
- **남은 결함:** m2 다이얼로그의 `event-command-edit-summary` 가 명령 이름 대신 종류 딱지 "기타 명령"을 보여 준다(전용 폼인 m2-205 도 마찬가지). 폼 머리글(`cream-command-form-head`)에는 한국어 이름이 이미 있으므로 정보는 있다 — 요약 쪽 배선 문제.
- **적용된 픽스:** (1) `isM2CatalogEntrySelectableInMap`이 m2-055(Show Animation 중복 등재)를 맵 피커에서 제외 — 카탈로그 엔트리는 저장 프로젝트 호환을 위해 유지. (2) 조명 설정(setLighting) 입력을 0~1 → 밝기(%)/100 스케일로 통일하고 암전/AMB/주변광 3중 용어를 "밝기"로 정리(`commandBodyPage3Native.ts`, `commandPreview.ts` lightingStage/caption). (3) 카메라 프리뷰의 내부 토큰(panTo 등)은 `CAMERA_MODE_LABELS`로 한국어화. (4) 타일 변경(changeTile)에 실맵 캔버스 미리보기 추가(`change-tile-map-canvas`, drawTransferMapPreview 재사용). (5) 프리셋 칩 세로 쪼개짐 방지 CSS(`05-force-modern-actor-page3.css`: nowrap+min-width fit-content). (6) parallax 병기 문구 정리.
- **계약 테스트:** `test/eventMapItemsBeginnerUx.test.ts`. e2e 증거: `_event-map-items-after.spec.ts`.

## 은퇴한 명령(deprecated) 레지스트리 (2026-08-28)

- 정본은 `src/project/eventCommands/m2CatalogData.ts` 의 **`DEPRECATED_M2_COMMAND_IDS`** 다: `카탈로그 id → { supersededBy, reason }`. 엔트리는 `entry.deprecated` 로 굽혀 나오고, `isM2CatalogEntrySelectableInMap` · `isM2CatalogEntrySelectableInBattleEvent` · `commandPicker` 의 `COMMAND_PAGES` 세 곳이 모든 피커(탭 그리드 + 전교 검색)에서 그 행을 배제한다. 카탈로그 엔트리와 런타임 실행 경로는 남는다 — **저장된 프로젝트는 계속 열리고 돌아간다**. 새로 저작하는 경로만 사라진다.
- 현재 등록: `m2-055-show-animation` → `m2-054-show-animation` (중복 등재, 종전 `entry.index === 55` 하드코딩을 대체), `m2-209-advanced-dialogue` → `m2-001-show-text` (「고급 대화」를 「문장 표시」로 통합).
- **라벨 문자열로 걸지 말 것.** 종전 `commandPicker` 는 `entry.pickerLabel !== "고급 대화"` 로 걸렀는데, `pickerLabelFor` 가 말줄임을 붙여 실제 라벨은 `"고급 대화..."` 이다 — 필터가 한 번도 맞지 않아 "통합했다"고 적어둔 명령이 탭 1 「말하기」에 그대로 살아있었다(실측 2026-08-28).
- 레지스트리 무결성은 카탈로그 모듈을 로드하는 자리에서 즉시 터리는 방식으로 강제한다(없는 id · 없는 `supersededBy` · `supersededBy` 가 다시 은퇴 행). 계약 테스트는 `test/advancedDialogueMerge.test.ts`, e2e 는 `test/e2e/oprn-modern-event-commands.spec.ts` 의 `DEPRECATED_COMMAND_TEST_IDS` 전 탭 부재 단언이다(라벨이 아니라 버튼 testid 로 건다 — 라벨로 걸면 말줄임 드리파트에 단언이 공허하게 통과한다).
- 고급 대화가 남긴 것: 감정·자동 넘김은 문장 표시 폼의 고급 옵션(`event-command-text-advanced`)이고 얼굴은 「얼굴 바꾸기」 명령이다. 저장된 m2-209 행은 로드 시 `rewriteLegacyAdvancedDialogueInProject` (`src/project/io/rewriteLegacyDialogue.ts`) 가 맵 이벤트·페이지·공통 이벤트·전투 이벤트의 최상위 명령 배열과 `commandBranches` 가 열거하는 모든 중첩 분기 배열을 네이티브 `text` 로 1회 정규화하고, 그전에 남은 행은 `m2ModernRuntime` · `commandPreview` 가 그대로 받아 연산한다. `test/advancedDialogueMerge.test.ts` 는 중첩 위치를 `commandBranches` 에서 파생하므로 새 분기 종류가 추가되면 정규화 누락을 분기 이름과 함께 실패시킨다.

## Companion roster in the command picker (2026-08-27)

- The 명령 피커 탭 2 (`동료 · 전투`) opens with a `companion-roster` section rendered by `src/editor/panels/eventEditor/companionRoster.ts`. It lists every `project.database.actors` record with a portrait crop (standalone `faceset` face file first, `charset` idle-front fallback; charset frames are the only single-cell crops left) and inserting through the standard addFollower edit dialog. Cards carry `companion-card-<actorId>` / thumb testids `companion-thumb-<actorId>`.
- `buildFollowerPresets()` exposes ALL database actors as follower preset chips (the legacy first-two-only truncation is gone). The first actor's chip keeps the contract id `preset:companion-hero`; its label embeds the actor name (`동료 주인공 (이름)`). Chip buttons use testid prefix `follower-preset-chip-*`, and actor chips render `follower-preset-thumb-*` portraits via the shared renderer.
- Do not reimplement local actor pickers in companion surfaces — reuse `companionPortraitElement` / existing `actorSheetIcon`. Coverage: `test/companionRoster.test.ts`, `test/followerPresets.test.ts`, and the exhaustive click-through spec `test/e2e/event-companion-command-sweep.spec.ts` (sweeps every tab-2 entry, then asserts DB roster + preset chips with evidence under `.omo/evidence/companion-sweep/`).

## Presentation and system M2 command bodies

- Rich Page-3 presentation and system command bodies live in `src/editor/panels/eventEditor/commandBodyM2Page3.ts`. They render dedicated two-column intent layouts (`page3-command-body actor-m2-command-body`) for screen tint, flash, shake, weather overlays, parallax background, tile swap, picture controls, vehicles, and coordinate queries.
- Visual preview panels mount on the right column via `previewPanel(testId)`. Commands publish specific preview testids such as `tint-screen-preview`, `flash-screen-preview`, `set-weather-effects-preview`, `change-parallax-back-preview`, `show-picture-m2-preview`, and `move-to-variable-location-preview`.
- Screen and weather forms expose interactive color chips and swatch/overlay preview elements (`.actor-m2-chip-grid`, `.actor-m2-preview-actor`, `.actor-m2-preview-copy`). When authors adjust color values, weather intensity, or resource targets, previews update their line and note descriptors immediately.
- TDD behavior contracts live in `test/page3CommandBodies.test.ts` (with interpreter execution coverage in `test/commandContracts/m2Command.contract.test.ts`). Each contract test exercises DOM inputs, verifies staged command replacement via `replaceFields`, and confirms that `executeM2RuntimeCommand` mutates session state as expected.

## 좌측 설정 레일 그룹 소속 (2026-08-27)

- 레일 그룹은 `pageProps.ts` 의 `wrapPageSettingsAsAccordion` 이 렌더된 DOM 을 재부모화해서 만든다.
  각 그룹은 **명시 셀렉터로 claim** 하며, claim 대상은 `source` 의 **직속 자식**으로 승격돼야 한다.
  실측 사고: memory("기억과 정리") 그룹이 겨눈 `event-classic-overlap` 이 `event-page-behavior-sections`
  안에 있었고 그 부모를 when 그룹이 먼저 claim 해서 memory claim 이 0개가 됐다. 그리고 미claim 자식이
  `rail.lastElementChild` 로 흘러들어가 그 그룹은 읽기 전용 칩 3개만 담은 쓰레받이가 됐다(편집 컨트롤 0개).
  그룹 순서만 바꿔도 쓰레받이 위치가 이동하는 위치 의존 버그였다.
- 지금은 미claim 자식이 남으면 조용히 섞지 않고 `evt-rail-group-other`("기타") 로 드러낸다. 새 컨트롤을
  추가하면 그룹 셀렉터에도 등록하라 — 등록을 잊으면 "기타" 그룹이 나타나 `test/eventRailGroupComposition.test.ts`
  가 실패한다.
- memory 그룹의 실제 내용은 겹침(통행 차단)이므로 제목은 "겹침과 통행" 이다. `page.overlapForbidden` 은
  **실행 억제가 아니라 같은 칸 통행 차단**이다(런타임 소비는 통행 판정 4곳). 라벨을 "중복 실행 방지" 로
  되돌리지 말 것.
- 기본값 규칙은 한 곳으로 통일한다: `overlapForbidden !== false` (헤더 요약·칩·체크박스 전부 동일).
- 접힌 그룹의 요약은 사용자가 패널을 펼치기 전에 읽는 유일한 정보다. 원시 enum 을 그대로 쓰지 말라 —
  움직임 그룹은 `movementSummaryText` 로 "정지" / "무작위 · x2 빠름" 을 보여준다.

## 설정 레일 한 열 정돈 (2026-09-27, 적대적 시각 QA 후속)

실측(1280·1440·1920): 설정 열이 205px 로 고정돼 「레일 + 넓은 시트」 두 면 배치
(`pages-4.part-2.css` 의 `@container evt-settings-rail (min-width: 430px)`)가 **한 번도 켜지지 않았다**.
명령 중심 배치(`command-workbench.css`)가 설정 트랙을 240px 로 줄인 뒤부터다. 모든 그룹이 세로 폴백이었고,
그 폴백에서 그룹 본문 → 필드셋 테두리 → 안쪽 상자가 겹쳐 컨트롤 폭이 155px 남았다.

- **세로 한 열이 정식 배치다.** 정돈 규칙은 event 레이어 마지막 시트 `src/styles/event/settings-rail.css` 가 소유한다:
  본문 테두리 상자 제거 → 섹션 제목(legend, float 로 흐름에 넣어 윗테두리에 겹치지 않게) + 구분선 한 겹,
  라벨은 컨트롤 **위** 한 줄, 컨트롤 32px 한 높이, 사용자 지정 select 값은 자르지 않고 줄바꿈.
  두 면 배치는 리사이저로 430px 이상 넓힐 때만 켜진다(규칙은 남겨 뒀다).
- **설정 트랙 기본값은 288px** — `layoutResize.ts` 의 `columnWidthBounds` 최소값과 같다. 240px 는 그 하한
  밑이라 리사이저를 처음 잡는 순간 48px 튀었다.
- **「시작 방식」은 「모습과 대화」 가 claim 한다.** 2026-09-19 조건 모달 재설계가
  `event-page-trigger-priority-stack` 을 when 에서 뺀 뒤 아무도 claim 하지 않아, 새 이벤트마다
  「기타 · 분류 없음 1개」 가 생겼다. 단위 테스트 픽스처에서는 재현되지 않았는데 브라우저에서는 항상 보였다 —
  그룹 소속은 `test/eventSettingsRailTidy.test.ts` 가 실제 렌더로 고정한다.
- **「움직임과 속도」 안의 두 번째 접이식을 걷었다.** `collapsibleSection("움직임")` 은 details→div 후처리로
  눌러도 안 열리는 ▸ 만 남았고 제목이 네 겹이었다. 이제 `event-classic-movement-section` 은 평범한 div 스택이고
  (testid 유지), 요약 칩 `event-movement-summary-chips` 는 그룹 헤더 요약 칸(`evt-rail-meta-move`)으로 올라갔다.
- **그룹 화살표는 `is-open` 을 본다.** 옛 규칙은 `<details>` 의 `[open]` 을 봐서 열린 그룹도 ▾ 였다.
  닫힘 ▸ · 열림 ▾ · 창을 여는 「언제 보이나요」 는 … (`aria-haspopup="dialog"`).
- **아래쪽 그룹을 열면 그 헤더를 보이는 곳에 둔다**(`scrollIntoNearestScroller(header, "nearest")`).
  위 그룹이 접히며 레일이 짧아져 방금 누른 헤더가 화면 위로 밀려나던 결함(레일 윗단 -116px).

### 등장 조건 창 (`openConditionsModal`)

- 창은 레일의 when 본문을 **빌려** 보여 준다. 편집기는 store 가 바뀔 때마다 레일을 새로 그리므로,
  창은 `store.subscribe` → microtask 뒤 `liveRailGroup(openKey, "when")` 의 새 본문으로 갈아 끼운다.
  예전에는 처음 옮긴 본문(떨어져 나간 사본)을 계속 보여 줘서, 칩을 눌러도 창의 칩은 꺼진 채였다.
- 창은 편집기 backdrop 안에 붙는다(`document.body` 아님). body 에 붙이면 사용자 지정 select 설치 범위 밖이라
  맨 select 가 나왔다. backdrop 은 본문 재렌더에도 살아남는다. 편집기 창(`.event-editor-modal-window`)
  안에 붙이면 끌기 transform 이 fixed 기준을 바꾸므로 그 바깥이다.
  그 결과 창은 `.event-editor-modal-body` 밖이라 옛 select 모양 규칙이 닿지 않는다 — 창 안 컨트롤 문법은
  `settings-rail.css` 의 `.event-condition-modal-body …` 블록이 따로 준다. select 목록 팝오버도 같은 backdrop 에
  붙으므로 `--z-popover-top` 으로 창 위에 둔다.
- when 은 레일에서 펼치지 않는다(CSS 가 본문을 감춘다) → 기본 활성 그룹이 될 수 없다. 조건이 있어도 처음 열림은
  「모습과 대화」 이고, 조건은 헤더 요약 「조건 N개」 + 점이 알린다. 창이 떠 있는 동안에만 when 이 활성이고,
  닫으면 직전 그룹으로 돌아간다. 검증 이슈 이동(`openEventRailGroupFor`)이 when 안 칸을 가리키면 같은 창이 뜬다.
- 푸터는 「완료」 하나다. 조건은 누르는 즉시 반영되는데 「조건 저장」 과 「닫기」 가 같은 함수를 불렀다.
- 창은 Tab 을 창 안에서 돌린다(`aria-modal`). Esc 는 modalStack 이 창만 닫는다.

시각 QA: 이 세션의 임시 Playwright 프로브(1280 표준 · 1440/1920 전문가, 그룹 넷 × 이동 유형 넷 + 조건 창 왕복)로
잘림·겹침·legend 위치·작은 누름 영역을 쟀고 세 폭 모두 0건이다. 전후 캡처는 `verify-shots/event-settings-rail/`.

## 페이지 조건 극성(켜짐/꺼짐) 저작 (2026-08-27)

- 런타임(`src/project/io/pageResolution.ts`)은 `switch.value:false`, `item.present:false`,
  `actor.present:false` 를 정상 평가한다. 그런데 편집기는 항상 `true` 로만 써서 false 방향을 만들 수도,
  데이터에 있는 false 를 볼 수도 없었고, id 를 한 번 바꾸면 조용히 true 로 뒤집혔다.
- 세 조건 행은 각각 극성 select 를 가진다: `event-page-switch-condition-value`(on/off),
  `event-page-item-condition-present`, `event-page-actor-condition-present`(present/absent).
  체크박스 재활성 경로는 기존 `condition.value` 를 보존한다. 계약은 `test/eventPageConditionOffValue.test.ts`.
- 이동 속도 select 는 런타임 `clampSetting` 과 같은 1~8 범위를 제시해야 한다(이전에는 1~6 이라 7·8 저작 불가).

## 「움직임과 속도」 부피 정리 (2026-08-29)

- **생활 이동은 두 행이다.** 예전에는 233px 레일에 컨트롤 13개(목적지 5 + 맵 연결 8)를
  `auto-fit minmax(148px, 1fr)` 로 깔았고, 그 폭에서 그리드는 1열이 되므로 실측 13행 세로 스택이었다.
  지금은 「목적지」 행(맵 select + 「맵에서 찍기」)과 X/Y/방향/반복 4칸 행으로 조인다.
  실측(1440 뷰포트, 편집면 529px): 같은 맵 목적지 **10행**, 연결이 있는 다른 맵 목적지 **11행**.
- **맵 연결은 조건부다.** 목적지가 같은 맵이면 `renderMapLinkBlock` 이 빈 블록을 낸다
  (`.event-page-map-link-block:empty { display: none }`) — 같은 맵에서 맵 연결은 뜻이 없다.
  다른 맵인데 연결이 없으면 한 줄로 「‘X’로 나가는 연결이 없습니다」(`--danger`) 만 알리고 폼을 펼친다.
  연결이 이미 있으면 폼을 접고 `event-page-map-link-toggle`(연결 편집/연결 접기) 로만 연다.
  **연결이 없을 때 토글을 같이 내지 말 것** — 할 일이 「연결 추가」 하나인데 버튼 두 개는 어느 쪽이
  본 행동인지 흐린다. 펼침 상태는 `openEventMapLink`(`eventEditorOpenState.ts`) 가 들고 있다.
  패널은 `<details>` 가 아니라 `hidden` 이다 — 레일 그룹이 `<details>` 를 `<div>` 로 갈아치우므로.
- **좌표는 찍는다.** `mapPointDialog.ts` 의 `openMapPointDialog()` 가 「장소 이동」 과 같은
  `drawTransferMapPreview` 미리보기를 띄우고 클릭한 칸을 돌려준다(testid 접두사 방식:
  `<prefix>-dialog|-canvas|-status|-map|-ok|-cancel`). 「맵에서 찍기」 는 숨은 필드가 아니라
  **보이는 select/X/Y 를 갱신**한다 — 검증기 앵커(`event-page-living-target-map`/`-x`)와 손입력
  e2e 경로가 둘 다 살아야 한다.
- **선택 칸 표시는 십자선이다.** 캔버스는 맵 해상도로 그린 뒤 CSS 로 축소되므로, 100×100 맵을 상자에
  맞추면 배율이 0.4 밑으로 내려가 타일 한 칸 테두리(2px)가 1px 미만이 되어 사실상 보이지 않았다.
  `drawMarker()` 는 맵 전체를 가로지르는 십자 안내선(어두운 밑선 + 흰 선) 뒤에 반투명 채움과 2겹
  테두리를 **마지막에** 올린다. 「장소 이동」 미리보기도 같은 함수를 쓴다.
- **사용자 지정 경로는 궤적으로 읽는다.** `previewMoveRoute.ts` 의 `tracePath`/`renderTrajectory`/
  `renderTape`/`svgSupported` 를 내보내 레일에서 재사용한다 — 궤적 썸네일(`event-page-route-thumb`,
  누르면 경로 편집) + 화살표 칩 테이프 + 전체 라벨 한 줄이 가로로 나란히 선다.
  전체 라벨(`event-page-movement-route-summary`) 의 한국어 텍스트는 그대로 둘 것 —
  `test/e2e/oprn-event-pages.spec.ts` 가 "오른쪽 이동" 을 이 요소에서 찾는다.
- **`.event-page-movement-label` 은 `.event-editor` 를 앞에 붙여야 산다.** `core.part-2.css` 의
  `.event-editor label { display: block }` 은 특이도 (0,1,1) 이라 (0,1,0) 짜리 `display: grid` 를
  이기고 있었고, 그래서 이동 그룹의 모든 라벨 행이 세로로 쌓여 높이를 두 배로 먹었다.
- **시각 QA:** `node scripts/qa-event-movement-ux.mjs --label <tag>` 가 정지 → 사용자 지정 →
  생활 이동(같은 맵) → 맵 찍기 → 다른 맵 → 연결 생성 8단계를 실제 브라우저에서 캡처하고
  섹션 높이·행 수·`overflowX` 를 잰다. 증거는 `.omo/evidence/event-movement-ux/<tag>/`.
  기준선(main)에서도 돌아가야 하므로 새 testid 는 optional 로만 본다.

## 조건은 평가기가 셋이다 — 판정 일치를 테스트로 고정한다 (2026-08-29)

같은 19종 `Condition` 유니온(`src/project/types/events.ts:59-89`, 정본 목록
- `relationshipAtLeast` 는 `friendshipAtLeast` 와 같은 소셜 키 규칙을 쓰지만 수치가 아니라 순서 있는 열거(`single | dating | engaged | married`)를 비교한다. 저작 표면 세 곳(간단 행/칩, 고급 목록, fork 조건 폼)에 모두 등록돼 있고, 상태를 바꾸는 명령은 `setRelationship` 뿐이다. 조건만 넣고 명령을 두지 않으면 항상 거짓이다. 연결된 인물이 없으면 `friendshipAtLeast` 와 동일하게 닫힌 채로 거짓이며 검증기가 `condition.relationship.no-character-id` 로 경고한다.
`src/project/commandKindRegistry.ts:105-124`)을 **세 곳**이 각자 평가한다:

| 평가기 | 위치 | 쓰는 곳 |
|---|---|---|
| `evalPageCondition` | `src/project/io/pageResolution.ts:45` | 이벤트 페이지 출현 판정 |
| `evalCondition` | `src/project/session.ts:828` | 맵 조건 분기(`interpreter/commandCatalog.ts` fork) |
| `evaluateCondition` | `src/battle/battleEvents.ts:926` (내부 함수) | 전투 분기 + 트룹 페이지 |

**활동 조건은 프로젝트의 실제 일정에서 후보를 받는다 (2026-08-29).** `activity` 는 자유 문자열이고
매칭은 완전 일치다. 저작자가 유효한 값을 추측해야 했던 문제를 `collectNpcActivitySuggestions`
(`panels/eventEditor/options.ts`) 로 없앴다 — 모든 맵 이벤트의 `schedule[].activity` 를 모아
`<datalist>` 로 건다. 페이지 간단 행은 `event-page-npc-activity-condition-options`, 분기 폼과 고급
목록은 `${activityTestId}-options` 를 쓴다(고급 목록은 행마다 id 가 달라야 하므로 testId 에서 파생).
**기본값 `work` 는 그대로 둔다** — `editor/tools/eventTools.ts` 의 `dailyRoutine` 이 생성하는 일정이
`activity: "home" | "work"` 를 쓰고 `defaultActivityLine` 이 그 키를 한국어 대사로 번역한다. 즉 `work`
는 이 레포가 인정하는 어휘이지 자리표시자가 아니다. 저작된 기본 콘텐츠는 한국어(`저녁 장터`, `귀가`)를
쓰므로 두 어휘가 공존한다 — 그래서 "영어 기본값" 을 결함으로 보고 빈 값으로 바꾸면 도구가 만든 NPC 를
가리키는 가장 흔한 경우가 깨진다.

**셋이 갈라져 있었다(실측).** `npcActivity` 는 전투에서 하드코딩 `false` 였고,
`friendshipAtLeast` 는 빈 `npcKey` 를 소유 이벤트 `characterId` 로 해석하지 않아 항상 거짓이었다.
둘 다 `src/editor/tools/troopBattlePageTools.ts` 가 모든 `CONDITION_KINDS` 를 받으므로
**저작은 되는데 절대 참이 될 수 없는** 상태였다. 지금은 전투도 소유 이벤트의 활동을 보고,
`resolveSocialKey` 를 **재사용**한다(두 번째 해석 규칙을 만들지 않는다).

**정본 계약은 `test/conditionEvaluatorParity.test.ts` 다.** 19종 × (만족/불만족) 을 세 평가기에
동일 입력으로 먹여 판정 일치를 단언하고, `Object.keys(CASES)` 를 `CONDITION_KINDS` 와 순서까지
비교하므로 **종류를 빠뜨리면 실패한다**. 허용 예외 목록(`ALLOWLISTED_DIVERGENCES`)은 현재 **비어 있다** —
지우거나 채우기 전에 왜 갈라져야 하는지 근거를 남겨라. `battleResult` 의 표면별 시간 의미 차이(맵=방금 끝난 전투,
전투 중=직전 전투)는 상태-패리티가 아니라 별도 계약으로, fork 폼 힌트가 설명한다.

### 함정: 부재 타이머는 0초로 읽혀 조건이 참이 된다

세 평가기 모두 `(timers[timerId] ?? 0) <= condition.seconds` 다. 따라서 **타이머가 한 번도 켜지지
않았어도** `seconds >= 0` 조건은 참이다(`0초 이하` 도 참). 이것은 이 엔진의 **의도된 계약**이며
`test/pageConditionsGuarantee.test.ts`, `test/commandContracts/fork.contract.test.ts`,
`test/selfSwitch.test.ts` 가 고정하고 있다 — 거짓으로 만드는 유일한 방법은 **음수** 임계값이다.

RM2K3/EasyRPG 와는 다르다(그쪽은 타이머가 **작동 중**이어야 한다). `PlaySession.timers` 에 running
비트가 없고 `timer stop` 이 값을 지우지 않으므로, RM 정합은 스키마 변경이다. **"고치지" 말고**
저작 시점 경고(`condition.timer.always-true`)로 보이게 두라.
**음수는 폼에서 못 적는다** — 타이머 입력이 `min="0"` 이라 거짓으로 만드는 유일한 방법이 UI에 없다.
대신 fork 폼이 `event-fork-timer-warning` 인라인 경고를 직접 보여준다(2026-09-18).

### 고급 조건 목록에서 극성을 벗기지 마라 (D08 재발 방지)

`pageAdvancedConditions.ts` 의 오버플로 행(3번째 스위치, 2번째 아이템/주인공)은 한때
`showValue: false` + `forceTrueOnSwitchChange: true` 로 극성을 **강제**했다. 그래서 그 행은
꺼짐/보유 안 함/파티에 없음을 저작할 수 없었고, 대상 id 를 바꾸면 저장된 `false` 가 조용히 `true` 로
뒤집혔다. 이것은 `ab8f9714` 가 단순 행에서 이미 고친 **P0 결함 D08 이 다른 목록에 남아 있던** 것이다.
계약: `test/eventPageConditionOffValue.test.ts` (오버플로 조건까지 왕복 단언).

### 참조를 비워도 조건을 삭제하지 않는다

대상 id 가 비면 조건을 지우는 대신 **인라인 오류**를 띄운다(분기 폼과 같은 규약).
DB 에서 지워진 유령 참조는 `<id> (없음)` 라벨로 **계속 보인다** — 안 보이게 하면 저작자가 설정한
극성이 조용히 유실된다. 회귀: `test/pageItemCondition.test.ts`(유령 itemId 표시),
`test/pageConditionAuthoringIntegrity.test.ts`(빈 참조 보존 + 비활성 행 조작 시 자동 활성화).

### 조건 미리보기는 모르면 모른다고 말한다

`conditionEvalPreview` 의 판정값은 `boolean | undefined` **3상태**다. 편집기 상태로 판정할 수 없는
조건은 「판정 불가」(`event-condition-eval-undetermined`)를 띄우고, `all`/`any`/`not` 은 3값 논리로
전파한다. 리프는 **값이 아니라 존재**로 게이트한다 — `timer` 는 `Object.hasOwn(timers, timerId)` 일
때만 판정한다. 종전에는 빈 세션으로 평가해서 16종 중 **7종**(timer/timePhase/season/npcActivity/
friendshipAtLeast/battleResult/run)을 틀리게 확신했고, 특히 거의 모든 타이머 조건이 「충족」으로
보였다. 계약: `test/conditionEvalPreview.test.ts`.

**뱃지와 시뮬레이션은 같은 맵 입력으로 평가한다 (2026-09-18).** `insideLocation` 은 뱃지가
무조건 「판정 불가」였는데 시뮬레이션은 map context 없이 `else` 단정이던 갈라짐을 고치면서,
둘 다 편집 중 맵(`editorState.currentMapId`)의 로케이션 기하로 평가한다. 맵을 모르면
둘 다 판정 불가다. fork 시뮬레이션의 taken 값도 3상태(`then|else|unknown`)이며 unknown이면
양쪽 분기를 전부 skipped 로 둔다. 계약: `test/previewSimulation.test.ts`.

### 조건 문구에 내부 토큰을 넣지 마라

`ON`/`OFF`, `AND()`/`OR()`/`NOT`, 생 비교 연산자, `timer1`/`timer2`, `run`,
`completed`/`failed`/`abandoned` 는 사용자에게 보이면 안 된다. 통일 어휘는 켜짐/꺼짐,
보유 중/보유 안 함, 파티에 있음/파티에 없음, 타이머 1/타이머 2,
모두 맞을 때/하나라도 맞을 때/아닐 때, 완료/실패/포기 다. 문장·배지·탭 요약·명령 요약이 전부
대상이며(`pageConditionSentence.ts`, `pageProps.ts`, `commandSummary.ts`) 게이트는
`test/conditionCopyTokens.test.ts` 다.

**조건 행을 접거나 숨기지 마라.** 접기 안은 D09(battleResult·all·any·not 이 화면에서 통째로
사라진 P1 결함)로 되돌아가는 일이라며 명시적으로 거부됐다
(`docs/proposals/2026-08-28-event-editor-ui-improvement.html`). `all`/`any`/`not` 은 페이지 표면에서
읽기 전용 요약 + 삭제로 유지되며, 중첩 저작은 분기(fork) 폼이 담당한다.


## 공포 게임 제작 기능 (2026-09-05)

이벤트 「움직임과 속도」에 연결 방 추격, 밀 수 있는 가구, 은신처 설정을 추가했다. 데이터·런타임·저작·검증 계약은 [horror-authoring.md](horror-authoring.md) 참조.


### NPC 발견·추격 저작 (2026-09-06)

`pageNpcBehavior.ts`는 정지 페이지에도 발견 이벤트를 제공하고, 추격에는 명시적 시야를 제공한다.
`pageHorror.ts`의 tracking은 마지막 목격 수색/현재 위치 추적이며 생략값은 마지막 목격이다.
새 chase 선택만 기본 정책을 저작한다. 기존 chase를 열기/취소하거나 빈도를 수정하는 것으로
숨은 기본 정책을 추가하지 않는다. `normalizeEventPage`는 선택 sight를 보존한다.
모든 입력은 기존 `updateEventPage` 드래프트/감사 경로를 사용한다. 발견 대기는 ms, 문 대기는 초다.
필드·런타임·저장 계약과 테스트는 [horror-authoring.md](horror-authoring.md)의 NPC 발견 절을 따른다.

## 명령 툴바는 한 줄이다 — wrap 금지와 폭 흡수 순서 (2026-09-21)

사용자 화면에서 이벤트 편집기 명령 툴바가 두 줄로 접히고 그 위에 빈 밴드가 생겼다.
`+ 명령`·검색은 첫 줄, 보기 전환(목록/스토리/플로우)과 `AI로 명령 만들기`는 둘째 줄로
떨어졌다. 원인은 두 겹이다.

1. **흡수 규칙이 죽어 있었다.** 검색 입력은 2026-08-29 에 「입력 + 지우기 + 일치 개수」
   한 벌로 감싸이면서 `.event-editor-command-search-field` 래퍼가 생겼는데,
   `command-list.css` 의 «남는 폭은 검색이 흡수한다» 규칙은 여전히
   `.event-editor-command-toolbar > .event-editor-command-search`(직계 자식)를 본다.
   래퍼가 끼는 순간 그 선택자는 아무것도 매칭하지 않고, 검색은 `min-width: 96px` 로
   짜부라진 채 툴바의 남는 폭을 아무도 흡수하지 않았다.
2. **`flex-wrap: wrap` 이 켜져 있었다.** `command-list.css` 와
   `command-workbench.css` 가 각각 `flex-wrap: wrap` 을 선언한다.

지금 계약은 **한 줄**이다. 넘침은 순서대로 흡수한다.

- 검색 래퍼(`.event-editor-command-search-field`)가 `flex: 1 1 140px` /
  `max-width: 320px` / `min-width: 96px` 로 먼저 줄어든다.
- 그다음 아이콘 툴 버튼(`편집`·`도구`)과 되돌리기/다시 실행이 줄어든다.
- 보기 전환 세그먼트(`.event-view-toggle`)는 `flex-shrink: 0` 이다 — 낱말이 곧 정보다.
- `AI로 명령 만들기`(aux 그룹)는 `flex-shrink: 0` 이고 라벨을 항상 유지한다.
  그 그룹의 유일한 표면이고, 별 글리프만으로는 무엇을 하는 버튼인지 알 수 없다.

좁은 칼럼에서 낱말을 접는 규칙은 `.event-contents-fieldset` 의 컨테이너 쿼리
`evt-command-column` 하나가 소유한다. **800px 미만이면 보조 도구(aux 제외)가 아이콘만
남고, 800px 이상이면 낱말이 돌아온다.** 실측(2026-09-21, 인스펙터가 열린 4트랙):
명령 칼럼은 1440 에서 718px, 1920·2560 에서 764px 이 상한이다. 764px 에 낱말 8개를
세우면 검색이 102px 로 눌려 검색 구실을 못 하므로 임계값은 800px 이다. 사용자가
리사이저로 설정 칼럼을 줄이면 낱말이 돌아온다.

같은 변경에 딸린 수정 하나: 검색 지우기 버튼(`event-command-search-clear`)은
`content.ts` 가 `hidden` 을 켜는데도 화면에 남아 있었다. `dialogs-5.css` 의
`.event-editor-modal-window .event-editor .event-editor-command-search-clear`(0,3,0)가
`display: inline-flex` 로 `hidden` 을 이기고 있었고, 그 시트가 `command-list-4.css` 보다
나중이라 같은 특이도로는 못 이긴다. 창 접두를 붙인 `[hidden]` 규칙으로 잠근다.

소유: `src/styles/event/command-list-4.css`(흡수·접힘·컨테이너 쿼리),
`src/styles/event/command-list.css`(툴바 한 줄 선언),
`src/styles/event/command-workbench.css`(툴바 한 줄 + 컨테이너 정의).
전후 캡처와 실측은 이 세션의 `1440/1920/2560` 프로브(툴바 높이 44px, 자식 y 단일 행).

## 공통 이벤트 호출 그래프 경고 (2026-10-02)

`eventDraftValidator.checkCallDepth`는 공통 이벤트의 실제 `commands`를 읽는다. 공통 이벤트에 없는 `pages`를 캐스트해 순회하던 경로는 순환·깊이 경고를 전혀 만들지 못했다. 현재 편집 페이지가 호출하는 그래프만 검사하고, 순환 또는 8단계 초과 경고를 호출 명령의 `pageId`/`commandPath`에 붙인다. 다른 이벤트의 무관한 순환은 이 초안의 경고로 표시하지 않는다.

중첩 명령은 기존 `eventCommandBranches` 기반 순회를 쓰며, 호출 인접 목록의 중복 제거와 루트별 `(depth, id)` 완료 캐시로 반복 호출 경로의 지수적 확장을 막는다. 경고는 커밋을 금지하지 않는다. `test/eventDraftValidator.test.ts`에 간접·중첩 순환, 깊이 경계, 무관한 순환, 반복 호출 사례를 추가했으며 이번 세션에서는 실행하지 않았다.

## Independent opening timelines

See [opening-animatic-authoring.md](opening-animatic-authoring.md) for assistant tools, shared renderer, poses, audio, preview evidence, and entry timing; [opening-reference-study.md](opening-reference-study.md) holds source-qualified research.

## Safe ambient patrol authoring (2026-10-04)

`read_npc_layout` reads actual graphics/positions/movement and pure eventsCutOffBy;
never call passageBlockWarning in a read tool (it can relocate the event).
`configure_npc_patrol` accepts mapId/eventId, optional x/y,2..12 directions closing
at the origin and800..5000ms interval. It protects nested transfer source/landings,
start and guide/sign areas by Manhattan radius2, map borders, real bidirectional
terrain, other solid NPC cells and event access; every cell needs at least3 exits.
Only one unconditional text-only1×1 NPC page is allowed: story/commerce/battle pages
are rejected atomically. The same source tools serve browser and headless assistants.
A fresh read_npc_layout is required before and after patrol writes by Pi production.

Authored custom route.skippable:false now retries blocked absolute steps indefinitely;
it cannot consume a blocked right step and later take its unmatched left step.
Default/skippable custom, living replans and schedule retry limits keep their rules.
Dialogues still pause autonomous movement. Entering a map applies its authored route.
These checks do not replace native walking/collision evidence. Reviewed expedition
layouts add27 ambient patrols in9 towns, retaining key story/vendor positions and
using inspected People1 roles. No terrain is repainted for NPC repairs.

Patrol authoring also reserves all cells of other authored repeating patrols rather
than only their initial positions, preventing intersecting resident loops.

## 일기·사물 이벤트의 그래픽 미리보기 (2026-10-04)

실제 조수에 일기 배치를 요청하면 `upsert_event`로 `ev_diary`를 만들고
`graphic.sprite.id = cc0-jetrel-notebook`을 지정한다. 맵의 `resolveEventSpriteTexture`는
이 아이템 그림을 지원하지만, 이벤트 편집기의 옛 `eventGraphicPreview`는 charset
카탈로그만 조회해 `data-unsupported=true`인 빈 칸을 그렸다. 그림이 저장에서 사라진 문제가 아니다.

`eventGraphicPreviewResource.ts`는 맵과 같은 리소스 조회를 거쳐 캐릭터 시트, 프로젝트
스프라이트 참조, 업로드 일반 시트, 공용 아이템 그림을 구분한다. 일반 시트는
`uploadedSpriteGeometry`/`uploadedSpriteFrame`의 행 우선 좌표와 `uploadedAssetUrl`을
사용하며 알파를 유지한다. 아이템 그림은 전체 이미지를 쓰고 charset의 pattern/방향으로
자르거나 걷기 애니메이션을 넣지 않는다. 캐릭터 시트만 투명색 처리와 걷기 프레임을 쓴다.
작은 미리보기는 기존 캐릭터 칸 안에 맞추고, 크기·통행 미리보기는 실제 프레임 크기와
맵의 아이템 맞춤 배율을 적용한다. 페이지 그림·명령 데이터는 변경하지 않는다.

실제 조수 요청·SQLite 저장, 편집기 화면과 재로드 근거:
`verify-shots/event-diary-graphic/README.md`. 브라우저 형식 비교는
`scripts/qa/event-graphic-preview.mjs`, 실제 조수 실행과 재로드는
`scripts/qa/event-diary-graphic.mjs`/`event-diary-reload.mjs`다.
