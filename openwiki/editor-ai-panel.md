> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# Editor AI Panel & Tools

## 도구 사용량 (2026-09-25)

AI 설정의 「사용량」 탭은 이 브라우저의 실행 영수증, 대화 기록, 활동 로그에서 조수가 부른 도구를 센다.
같은 호출이 여러 기록에 있으면 한 번만 센다. `pi:시공` 같은 역할 이름은 도구가 아니라서 빼며, 개별 도구
(예: `web_search`)는 영수증과 대화 항목에 있을 때만 보인다. 「JSON으로 보내기」는 그 표를
`ai-tool-usage-YYYY-MM-DD.json` 으로 내려받는다. 집계는 `src/ai/toolUsageReport.ts`, 화면은
`src/editor/panels/aiToolUsagePanel.ts`.
## 새 프로젝트 게임 기획 전달 (2026-09-22)

프리셋별 최대 5문항 인터뷰의 확정 기획은 `Project.gameDesignBrief`에 저장한다.
초기 생성 프롬프트와 이후 `contextBuilder`, Pi builder/team/reviewer 시스템 프롬프트가
같은 `gameDesignBriefContext`를 사용한다. 수정한 최종 요약이 원래 답변·프리셋 톤보다
우선하고 추천 출처는 유지한다. 메뉴 생성은 새 SQLite 폴더의 부팅 뒤에만 전송을 예약한다.
미연결이면 초안으로 남기며 기획 수정 메뉴는 자동 전송하지 않는다. 상세 계약은
[장르 프리셋 인터뷰](editor-genre-packs.md)의 저장·handoff 절을 따른다.

2026-09-28 보강: 실제 팀 실행의 검수 프롬프트는 `PI_TEAM_ROLES.reviewer` 가 아니라
`teamSpec.memberSystemPrompt` 가 만든다 — 여기에 기획이 빠져 있어 검수가 인터뷰 답을 몰랐다. 지금은
검수와 Writer(`consult_writer`, `scripts/lib/piWriterTool.ts` 의 시스템 메시지)도 같은 기획을 받는다.
첫 생성 말풍선·입력창에 보이는 문장(`welcomeGenrePresetDisplayText`)은 확정 요약 전체(600자 상한)를
줄 단위로 보인다. 예전 「장르 · 첫 답 24자 · 범위 24자」 한 줄은 모델이 기획을 다 받는데도
사용자에게 인터뷰가 안 넘어간 것처럼 보였다.

## 제작 전 그래픽 선택과 자동 큰 창 (2026-09-21)

`aiCreationChoice.ts` + `aiChatPanel.runPiTurn`은 마을·도시·집의 새 생성 요청에 제작 전 선택을 둔다.
평문 전송은 의도 분류 전에 큰 조수 창을 열고, 쓰기 턴으로 판정된 경우 선택을 기다린다.
슬래시 명령/브리지도 공통 실행 진입점에서 같은 선택을 거친다. 설명·부정·작은 수정 요청,
읽기 전용/계획 턴, 현재 프로젝트의 정확한 칩셋 ID/이름을 명시한 요청은 선택을 생략한다.
현재 감지는 한/영의 제한된 생성 표현이며, 던전·실내 등 모든 제작 의도를 포괄하지 않는다.

- 기존 `createAssistantWide.open()`으로 동일 조수·팀 DOM을 함께 연다. 새 세션을 만들지 않는다.
- 숲마을을 포함한 합본 마을 호환 칩셋을 제공하고, `forest_harmony`를 기본으로 선택한다. `stampRectHouseKit` + `drawMapTileLayers`로 집 외관 3종을
  임시 20×15 캔버스에 그린다. 나무는 시공기와 같은 저작 조립/레이어를 쓰고 길의 오토타일 연결을 계산한다. 실제 캐릭터 시트의 2명을 합성하며 외관/캐릭터를 독립 선택한다.
  이 비교용 데이터는 store, 원격 DB, 게임의 맵 목록에 들어가지 않는다. 다른 칩셋의 동일 좌표가
  호환된다고 가정하지 말 것. 지원 칩셋이 없으면 실행하지 않고 명시적인 리소스 지정을 안내한다.
- 추천/이미지 클릭/선택은 실행이 아니다. 이미지가 준비된 뒤 별도의 제작 확정 버튼을 눌러야
  원문 + 선택한 칩셋/집 키트/캐릭터 ID·인덱스가 실제 Pi task로 전달된다. 결과 품질 보장은
  기존 실행·검토 흐름이 맡는다. 선택 이미지는 대화에 남으며 선택 값 자체를 프로젝트 기본값으로 저장하지 않는다.
- 대기 중에는 turn 슬롯을 점유하고, 팀에는 실제 실행 중인 가짜 담당을 만들지 않고 선택 기준만 보여준다.
  요청 수정은 원문을 복원한다. 작은 창으로 접는 것은 선택을 취소하지 않는다. 대화/프로젝트 전환과
  dispose는 promise를 해제하며, 확인 전 현재 맵이 바뀌면 실행을 취소한다.
- 스타일 진입점: `editor-startup-ai.css → 29-creation-choice.css`. 컴포저 대신 선택/수정 버튼을
  보여 확정 버튼을 가리지 않는다. 좁은 창에서는 비교 카드를 세로로 배치한다.

브라우저 증거/범위: `reports/2026-09-21-assistant-creation-choice.md`.

## 이미지 중심 작업 피드 (2026-09-21)

`activityVisual.ts`는 도구 실행 직전/직후의 **작업 초안**에서 맵 영역·NPC 그래픽·DB 레코드·검색 소재를
잘라 불변 사본으로 만든다. Pi `toolAdapter → tool_end.visuals`와 일반/영역 `AssistantSession →
tool_call.visuals → AiRunSurface`가 같은 수집기를 쓴다. 팀/후속 레인도 Pi 이벤트 계약을 그대로 받는다.
전체 프로젝트나 NPC 커맨드 본문을 이미지 기록에 복사하지 않는다. 최대 32×24 맵 크롭, 40개 이벤트 위치,
6개 검색 결과, 6개 수치 필드로 제한한다. 업로드 이미지는 당시 data URL(1MB 이하) 또는 내용 주소 ref를
보존한다. 리소스 ID를 나중의 현재 프로젝트에 다시 조회하지 않는다.

- 기본 보기에는 최근 이미지 작업 3개와 마지막 상태를 남긴다. 같은 도구의 반복은 같은 대상일 때만 묶는다.
  이미지 없는 기존 워커 이벤트는 기존 최대 네 줄 정책을 유지한다. 자세히/매우 자세히에서도 그림은 바로
  보이고, 도구 입력·결과만 별도 details로 펼친다. 오른쪽 팀 목록에도 최근 대상 썸네일이 붙는다.
- 맵 쓰기는 `변경 전 / 초안`, 실패는 `실패 시점`, 읽기는 `확인한 모습`으로 구분한다. 초안 그림을 실제
  적용/저장 성공 증거로 취급하지 않는다. 실제 적용 상태는 기존 실행/저장 receipt에서 확인한다.
- 맵은 편집기 타일 렌더러를 공유한다. **NPC는 맵 위 위치 마커**이며 별도 카드에서 실제 charset 한 칸을
  보여 준다. 게임 플레이 캡처라고 부르지 않는다. 아이템/장비/몬스터는 실제 소재와 해당 시점 수치를 표시한다.
  등록된 이미지가 없으면 수치 카드, 로드/캡처 실패 또는 보존 기간 만료면 누락 안내를 표시한다.
- 클릭하면 같은 작업의 그림들이 네이티브 dialog에 크게 열린다. `modalStack`을 등록하여 Escape는 이미지
  창만 닫고, 조수 큰 창은 유지한다. 키보드 초점은 원래 이미지 버튼으로 복귀한다.
- `activityMediaArchive.ts`의 별도 IndexedDB `oprn-ai-activity-media`에 불변 렌더 재료와 PNG Blob을 저장한다.
  텍스트 실행 기록에는 작은 참조만 들어간다. 7일/약 64MB, 메모리 256건/약 16MB 제한이며 배치 후 정리한다.
  `aiActivityMedia.ts`는 표시 수준이 생략이어도 들어온 재료를 3개 렌더 작업으로 나눠 PNG로 고정한다.
  이미지가 없는 옛 실행 기록은 복원하지 않는다. 텍스트 JSON 내려받기에 이미지 바이너리를 넣지 않는다.
- `regionSnapshot`의 선택적 `image` 인자는 업로드/이식 타일셋의 당시 아틀라스를 전달하기 위한 것이다.
  업로드 원본은 보존한 ref/data에서 읽고, 이식은 정확한 타일셋 사본으로 완전 베이크를 기다린다.
  실패한 이식 캡처를 원본 타일셋으로 대체하지 않는다.

브라우저 근거: `scripts/qa/ai-visual-feed.mjs`. 실제 편집기와 실제 도구 어댑터로 읽기·도로 쓰기·NPC·소재
검색·몬스터 실패/재시도·아이템 변경을 재생한다. 모델 전송만 결정적 스트림이며 원격 프로젝트 쓰기를 차단한다.
수정 이후 기존 이미지 불변, Blob 보관/새로고침, 큰 창/팀/확대/trace 입력과 결과, 1024px 넘침을 확인한다.

## 조수와 팀 크게 보기 (2026-09-21)

조수 `작업 표시` 행의 `ai-wide-open`(아이콘 + **크게 보기** 글자 버튼)은 현재 대화와 오른쪽 팀 패널을 하나의 큰 창으로 옮긴다.
확대 아이콘만 레일에 두면 발견하기 어려워 표시 수준 버튼 바로 위에 항상 보이도록 배치한다.
`aiAssistantWide.ts`가 원래 자리의 comment marker를 보관하고 **같은 DOM**을 이동·복원한다.
세션·실행·입력창·적용 버튼을 두 벌 만들지 않는다. 입력 초안, 실행 중 중지, 검색, 열린 로그,
선택한 팀원이 유지된다. 팀원이 아직 선택되지 않았으면 첫 팀원을 연다.

- 왼쪽은 대화·실행 기록·입력, 오른쪽은 팀 목록·팀원 상세·후속 대화다. 팀원 상세는 대화를 덮지 않는다.
- 큰 창은 기본 70:30이며 가운데 경계선을 드래그하거나 초점 후 좌우 방향키로 조절한다. Home/더블클릭은
  기본 비율로 돌아간다. 대화와 팀 상세는 각자 스크롤한다. 좁은 화면에서는 위아래로 배치한다.
- 표시 수준 버튼은 기존 노드를 큰 창 상단으로 이동하고 닫을 때 원래 위치에 복원한다. 오른쪽 중복 설정은
  큰 창에서 숨긴다. 팀 목록은 이름·상태·최근 작업을 행으로 표시하며 선택한 팀원 상세는 목록 아래에 둔다.
- 기록 카드를 중첩하지 않는다. Pi 보드를 붙인 요청은 중복 `작업 과정` details를 숨기고 결과·검토 결정은 유지한다.
  별도 경고나 설명이 전달되면 `추가 안내`에서 그대로 읽을 수 있다.
  입력은 기본 두 줄 높이에서 내용에 따라 늘어난다. 큰 창은 대화 가독성을 위해 카드 테두리를 줄인다.
- 창 버튼은 사용자 운영체제를 따른다(2026-09-27, `detectWindowControlStyle`). macOS·iOS는 제목 왼쪽에
  신호등(닫기·최소화·확대), 그 외(Windows·Linux)는 머리줄 오른쪽 끝에 Windows 캡션 버튼(최소화·최대화·닫기,
  닫기 호버 빨강)을 둔다. 최소화(`ai-wide-close`, `작은 패널로 돌아가기`)는 옛 `작게 보기 ↙`를 대신하고,
  닫기(`ai-wide-dismiss`)와 같은 `close()`를 부른다. 최대화(`ai-wide-maximize`)는 배경 여백·둥근 모서리를
  없애 화면을 채우고 `aria-pressed`로 상태를 알린다. Windows에서는 최대화 중 기호가 복원 모양으로 바뀐다.
- 최소화·닫기 버튼, 배경 클릭, Escape는 창만 닫는다. 작업 취소가 아니다. 원래 컨트롤로 초점을 돌린다.
- `modalStack`에 등록하여 위에 열린 설정 모달과 Escape 소유권을 공유한다. 창 내 Tab 순환을 제공한다.
- `27-assistant-wide.css`가 별도 레이아웃을 소유한다. 760px 이하는 한 창 안에서 위아래로 배치한다.
  열기 자체는 작업 표시 수준을 변경하지 않는다. 표시는 양쪽의 동일한 개인 설정을 따른다.
- 패널 dispose 시 큰 창을 먼저 복원한 후 팀 패널과 기존 구독을 정리한다.

브라우저 근거: `scripts/qa/ai-activity-levels.mjs`, `output/evidence/ai-activity-levels/06-wide.png`,
`07-wide-compact.png`(1440px/1024px, 같은 DOM·초안·검색 유지 및 Escape 초점 복귀).

## 작업 표시 네 단계와 별도 실행 기록 (2026-09-21)

- 조수 레일 아래 `작업 표시`는 `생략 / 간단히 보기(기본) / 자세히 보기 / 매우 자세히 보기` 네 버튼이다.
  드롭다운으로 숨기지 않는다. 현재 선택은 `aria-pressed`와 강조 테두리로 표시하고 팀원 상세에도 같은 버튼을 쓴다.
  `aiActivityPreference.ts`의 개인 키 `oprn:ai-activity-level`만 바꾼다. 실행 권한·모델·답변 예산은 바꾸지 않는다.
  신규·설정 없는 기존 사용자 모두 brief로 시작한다. 실행 중 전환은 같은 기록을 다시 그리며 재실행하지 않는다.
- `aiActivityView.ts`는 기본으로 최근 주요 단계 최대 네 줄과 현재 대기 상태를 표시한다. 반복 성공 도구는 묶고
  조회도 남긴다. detail은 개별 작업·담당·결과·시간, trace는 호출 ID·입력·구조화 결과·오류·모델/연결·단계 적용을
  보여 준다. 담당자/도구/오류 필터·내용 검색·최신 이동·JSON 내려받기를 제공한다. 50행씩 불러오고 payload는
  펼칠 때만 DOM으로 만든다. 새 이벤트는 변경 없는 행·열린 상세를 보존하며 강제 스크롤하지 않는다.
  brief는 짧은 타임라인, trace는 시간·담당·작업·상태·소요 열을 맞춘 목록이다. 좁은 패널은 시간·작업·상태만
  먼저 표시한다. 실행 ID와 정확한 시각은 행 상세로 옮긴다. 입력/구조화 결과는 해당 행을 펼쳐 읽는다.
- 단독/팀 Pi는 `TeamBoardState.trace`, 후속 레인은 `LaneState.trace`, 영역/기존 세션은 `AiWorkCard.recordActivity`를
  같은 렌더러로 보낸다. 팀원 상세와 작업 탭은 해당 actor만 투영한다. 기존 200행 보드 요약은 원본 기록이 아니다.
  패널에 별도 검토 안내가 있으면 보드의 적용/버리기 버튼을 중복 노출하지 않는다. 질문·오류·중지·검토 안내·변경 보기·
  되돌리기는 표시 수준 바깥이다. 과거 `작업 과정 기본 접힘` 설명은 이 정책으로 대체한다.
- `src/ai/activityTrace.ts`는 표시와 무관하게 실행별 최대 2,000행/약 2백만 문자(먼저 닿는 상한)를 보존한다.
  도구 시작/끝은 actor + call ID로 연결한다. 워커 어댑터도 이름별 FIFO 대신 호출 ID를 쓴다.
  `tool_end.result/durationMs`와 이벤트 시각은 선택적 전송 필드다. 구 워커의 요약만 있는 결과는 그 한계를 명시한다.
  모델 비공개 thinking 본문·프로젝트 사본은 보존하지 않는다. 인증 필드와 토큰을 가리고, payload의 크기/깊이/배열
  제한은 생략 표시로 알린다. heartbeat/stream은 actor별 최신 신호와 누적 횟수로 합친다.
- `activityTraceArchive.ts`는 별도 IndexedDB `oprn-ai-execution-records`에 기기 내 기록만 보관한다.
  최근 7일/20개 실행/약 10MB 상한이며, 프로젝트 identity로 조회를 격리한다. 페이지 새로고침 뒤 원격 프로젝트의
  같은 identity로 다시 열 수 있다. 일회성 dev/local session은 다른 identity로 시작하면 이전 실행이 섞이지 않는다.
  기록 쓰기 실패는 편집을 중단하지 않는다. 수집 전 과거 데이터는 복원하지 않는다. 기존 opt-in 진단 수집과 무관하다.
  실행별 serial을 비교하여 오래된 화면의 재렌더가 최종 상태를 덮어쓰지 못하게 한다.
- 초안 종료·실제 적용·저장은 구별한다. `aiActivitySave.ts`는 적용 직후 세대의 자동저장 상태만 관찰하고 저장을 유발하지
  않는다. 후속 수정·프로젝트 교체·오류·응답 미확인은 성공으로 표시하지 않는다. 저장 로그 실패가 작업을 막지 않는다.
- 화면 근거: `scripts/qa/ai-activity-levels.mjs` → `output/evidence/ai-activity-levels/`.
  실제 편집기에 결정적 Pi 스트림을 재생하여 220개 조회 이후 입력 복원, 실패/재시도 결과, 네 수준과 팀원 동기화,
  1024px 검토 버튼, 내보내기·IndexedDB 재로드를 확인한다. 라이브 모델 품질이나 원격 콘텐츠 저장을 검증한 것이 아니다.
  단위 계약: `test/aiActivityTrace.test.ts`, `test/aiActivityView.test.ts` (이번 세션에서 Vitest 실행하지 않음).


## 첫 페인트 스타일 소유권 (2026-09-19)

에디터 부트 때 `aiSidebarWorkspace`(왼쪽 활동 막대)와 오른쪽 AI 도크·팀 사이드바를 먼저
마운트한다. 따라서 이 표면의 스타일은 데이터베이스 모달을 열 때 지연 로드하면 안 된다.
`src/styles/database/editor-startup-ai.css`가 기존 기능별 시트
(`assistant-*`, `tabs-b-assistant-panel/01–12`, `18–25` 및 각 `part-*`)를 원래 순서대로
`database` 레이어에 정적으로 가져온다. `src/styles/database/index.css`에는 이 묶음을
다시 가져오지 않는다. DB 레코드·모달 전용 시트는 계속 지연 로드한다.

첫 화면을 바꿀 때는 이 정적 매니페스트의 기하와 시각 규칙을 함께 확인하고,
데이터베이스 모달을 먼저 열지 않은 새로고침에서도
`.ai-chat-panel`, `.ai-composer`, `[data-testid="ai-team-sidebar"]`의 버튼·입력 컨트롤이
기본 브라우저 모양으로 보이지 않는지 캡처한다.

## 채팅 입력창 작업 설정 묶음 (2026-09-18)

`aiComposer.ts`는 입력창의 팀·적용 모드·자율성 선택기를 `작업 설정` 팝오버에 묶는다.
기존 컨트롤과 저장 콜백을 그대로 옮기며 실행 정책·기본값은 바꾸지 않는다.
닫힌 버튼에는 현재 적용 방식(기본/YOLO/자동/검토 후 적용/단계별 적용)을 표시한다.
팝오버는 AI가 할 일·변경 적용 방식·작업 인원의 이름과 설명을 제공한다.
팀 버튼은 기존 팀 메뉴로 전환한다. 설정/팀 메뉴에서 Escape는 보이는 작업 설정 버튼으로
초점을 돌린다. 다른 컴포저 팝오버와 배타적으로 열리고 기존 뷰포트 보정을 사용한다.
스타일은 `18-assistant-deck.css`의 `ai-chat-settings`가 소유한다.

브라우저 증거: `output/evidence/chat-composer-ux/`의 before/after/settings/team/compact PNG.
1440×1000 및 1024×768 실제 편집기에서 확인. 작은 화면 설정 상자는
x=8, y=278, 300×383으로 화면 안에 놓인다. 설정 변경·팀 메뉴 진입·Escape 초점 복귀와
입력 초안 유지를 확인했다. 기존 로컬 showcase에서 UI만 확인했으며 모델 실행·원격 쓰기는
하지 않았다. 세션 규칙에 따라 Vitest/전체 게이트는 실행하지 않았다.

## 검토 대기 액션은 작업 과정 밖에 둔다 (2026-09-18)

`aiPiAgentCommand`가 `검토 대기`로 끝나도 시공/검수는 이미 종료한 상태다.
`aiInlineWorkCard`의 접힌 details 안에만 적용 버튼이 있으면 사용자는 종료되지
않은 실행으로 오해한다. `aiPendingReview.ts`의 안내와 적용·변경 내용 보기·버리기
버튼은 `PiCommandSurface.appendReviewPrompt`를 통해 대화 로그에 직접 붙인다.
실행 기록은 계속 접어 둘 수 있다. 적용/버리기는 기존 보드·팀 액션과 같은
클로저를 사용하며, 적용 중 중복 호출을 막고 적용 실패 시 액션을 유지한다.

수동 적용 후 영수증은 원래 요청의 카드에 붙이고 `적용 완료`로 갱신한다.
새 `작업 중` 카드를 만들지 않는다. 버리면 같은 카드에 `버림`을 표시한다.
적용된 결과의 `hasPendingDraft`는 false다. 다음 요청은 이전의 별도 안내를 제거한다.

브라우저 증거: `scripts/qa/visible-team-review.mjs` →
`output/evidence/visible-team-review/`. 실제 편집기에서 팀 응답을 결정적으로 재생하여
접힌 과정 밖 버튼, 1024px 가시성, 적용 전/후 정본, 버리기, stale 적용 실패 후
재시도·버리기 노출을 확인한다. 맵 이름 변경을 쓰는 최소 QA 픽스처이며
라이브 모델의 집 생성 품질이나 원격 저장을 검증하는 스크립트는 아니다.


## 팀 초기 생성의 맵 사이 연결 계약 (2026-09-28)

새 프로젝트 마법사는 팀 모드로 돈다. 팀 모드는 맵마다 다른 담당이 자기 사본에서 짓고 도착 순서대로 병합하므로,
맵과 맵을 잇는 출입구는 한쪽 담당만 안다. 이음새는 메시지 문장이 아니라 프로젝트 데이터(`worldGraph` + 실제 transfer 이벤트)로 든다.

- 레시피: `teamWorkflows.ts` 첫 항목 `new-project`. 첫 project 작업이 `build_world` 로 노드·edge·빈 맵·출입구를 한 번에 만들고,
  그다음 맵별 `assign_map_agent` 를 병렬 배정한다.
- 담당 프롬프트: `src/ai/piAgent/worldSeams.ts` `describeMapSeams` 가 그 맵의 출입구와 다른 맵에서 오는 도착 칸을
  **병합본의 실제 이벤트**에서 읽어 시공·검수 담당 시스템 프롬프트에 붙인다. 이음새가 없으면 아무것도 붙이지 않는다.
- finish 게이트: `inspectWorldSeams` = `lintWorldGraph` + «계획한 맵이 시작 맵에서 문으로 닿는가». error 가 있으면 finish 를
  **한 번** 거절한다. 같은 오류 묶음으로 다시 부르면 받고 최종 보고에 `남은 맵 연결 오류 N건` 을 남긴다 — 고칠 수 없는 연결로
  팀이 영원히 못 끝나지 않게. `worldGraph` 가 없는 팀 작업은 검사하지 않는다.
- 병합 3방향화(`mapBundle.ts`): 시작 맵은 트리 루트라 그 묶음이 곧 모든 맵이다. 예전 병합은 묶음의 모든 행과 부분 트리를
  결과로 갈아 끼워, 시작 맵 담당이 늦게 끝나면 먼저 병합된 다른 담당의 맵·트리 노드를 출발 사본으로 덮었다(충돌 보고 없음).
  이제 출발 사본(`base`)에서 **바꾼 맵만** 옮기고 트리 자식도 3방향으로 합친다. 바꾼 맵이 그 사이 남에게도 바뀌었으면 뒤의 것이
  이기고 `conflicts` 로 알린다. 팀 런타임의 `conflicts` 는 묶음 전체가 아니라 실제로 바꾼 맵 기준이다.
- 검증: `test/piAgentWorldSeams.test.ts`, `test/piAgentMapBundle.test.ts`(루트 늦은 병합 2건),
  `test/piAgentTeamRuntime.test.ts` 「팀 초기 생성 — 맵 사이 연결 계약」 4건. 라이브 모델 실행으로 효과를 잰 증거는 아직 없다.


## 팀 분업 유즈케이스와 맵 밖 작업 배정 (2026-09-18)

> **팀이 조용히 혼자가 되던 길 (2026-09-28).** 활동 기록 실측: 2026-09-18 12:04 이후 일반 채팅 Pi 실행 67회 중
> 팀 실행 0회. 원인 후보와 조치: ① 마을 요청이면 `resolveVillageContract` 가 계약을 걸고 `runPiCommand` 가 계약이
> 있으면 팀을 껐다 → 이제 `classifyPlainPiTurn` 이 팀 설정일 때 계약을 걸지 않고, 팀 런타임도 실려 온 계약을 벗긴다.
> 그래도 팀이 단독으로 내려가면 채팅에 한 줄로 알린다. ② 검수 담당을 끄면 메뉴는 「완료 후 검토: 생략」인데 런타임은
> 400 으로 실행 전체를 거절했다 → 생략하고 최종 보고에 적는다. ③ Ultrabrain 계획 턴이 팀장 자리를 빌려 활동 기록에
> `pi:팀장` 으로 남아 단독 실행이 팀처럼 보였다 → `pi:계획` 으로 남긴다. 읽기 전용·질문 판정은 여전히 단독이다(의도).

`src/ai/piAgent/teamWorkflows.ts`의 레시피(현재 8가지 — 2026-09-28 new-project 추가)를 팀장 시스템 프롬프트에
실제로 삽입한다: 던전, 퀘스트, 게임 도입부, 전투 콘텐츠, 마을 생활감,
기존 게임 오류 수정, 게임 전체 번역. 각 레시피는 분업·선행 조건·A2A 협의·
통합 검수 기준을 포함한다. 키워드 분류기로 자동 모드를 바꾸는 기능은 아니다.

- `assign_task_agent(mode=read)`: 설계·대사안·용어집·검사 등을 병렬 배정.
  읽기 도구만 제공하고 반환 데이터에 변경이 있으면 병합 단계에서도 거절한다.
  `report_task`의 산출물을 `check_agents`/`wait_agents`의 summary로 전달한다.
  읽기 사본은 시작 시점 기준이므로 후속 제작/최종 검수는 최신 사본으로 재배정한다.
- `assign_task_agent(mode=project)`: 공통 DB·오프닝·공통 번역문·빈 맵 준비를
  실제 작업 사본에 적용한다. 맵 묶음 병합으로 버려지던 최상위 변경도 보존한다.
  프로젝트 쓰기는 모든 다른 맵/프로젝트 쓰기와 상호 배제하고 읽기 작업만
  병행한다. 레코드별 병렬 병합은 제공하지 않는다. 기존 커밋/적용 게이트는 유지한다.
- 명시된 맵 범위나 읽기 전용 요청을 project 쓰기로 승격하지 않는다.
  맵 작업은 기존 `assign_map_agent`, 맵 검수는 `review_map`을 사용한다.
  read 배정에는 검수 프로필도 사용할 수 있다. 기본 제작 프로필의 소개를
  맵뿐 아니라 이벤트·DB·텍스트로 확장하며 저장된 사용자 프로필은 덮어쓰지 않는다.
- 비맵 배정도 진행 보드·A2A 주소·wait/check·최종 수거에 참여한다.
  `report_task` 누락과 읽기 작업의 변경 반환은 실패이며 결과를 적용하지 않는다.
  진행 중인 비맵 작업은 finish를 막고, 실패 결과는 최종 보고에 명시한다.
  실행당 비맵 배정 최대 64건, 산출물 보고 최대 16,000자. 긴 번역 등은 장별로 나눈다.
- 테스트: `piAgentTeamWorkflows` (실제 프롬프트 연결), `piAgentTeamRuntime`
  (병렬 설계→보고서→공통 텍스트 적용, 쓰기 잠금 양방향, 결과 보존, 권한 범위,
  보고서 누락/읽기 변경 거부). 라이브 모델의 7가지 완성품을 만든 증거는 아니다.


## 팀 내 A2A 메시징 (2026-09-18)

팀 런타임은 작업 중 팀장↔팀원·팀원↔팀원 직접 메시징을 제공한다.
외부 A2A 프로토콜 서버가 아니라 **한 Pi 팀 실행 안의 통신**이다.

- `scripts/lib/piTeamMessaging.ts`: 실행별 메시지함. `list_team_agents`,
  `send_team_message`, `read_team_messages`, `wait_team_messages`,
  `acknowledge_team_message`를 팀장·시공·읽기 전용 검수에게 제공한다.
  발신 주소는 도구 바인딩으로 결정하고, 수신 주소는 실행별 agentId다.
  종료된 담당자·다른 실행·자기 자신에게 보내는 메시지는 거절한다.
- 질문은 `kind: question`, 답은 `kind: reply` + 원본 `replyTo`로 연결한다.
  읽음과 반영 확인은 별개이며, `sent`에서 발신 메시지의 확인 상태를 조회한다.
  반영 확인도 발신자에게 알린다. 질문은 확인만 눌러서는 해결되지 않는다.
- `piAgentRuntime.ts`의 구독이 코어 `steer()` 큐에 수신 알림을 넣는다.
  현재 도구 경계 뒤 다음 판단에서 메시지함을 읽는다. 코어 steering은 아직
  실행하지 않은 도구 호출을 건너뛸 수 있으므로 모델은 남은 작업을 다시 판단한다.
  구독은 실행 종료·오류·중단 때 해제한다. 메시지는 편집 권한을 넓히지 않는다.
- `wait_agents`는 최대 10초만 기다리며 팀장 메시지/확인이 오면 조기 반환한다.
  팀장은 상태를 다시 확인하고 질문에 답해야 한다. `wait_team_messages`는
  최대 30초, 취소 가능하며 timeout을 응답이나 합의로 취급하지 않는다.
- 종료한 팀원을 메시지로 자동 재실행하지 않는다. 현재 담당자를 조회하거나
  팀장에게 후속 배정을 요청한다. 맵 in-flight 락·사본 병합은 그대로 유지한다.
- 미열람 팀장 메시지는 `finish`를 막는다. 남은 미확인 협의는 최종 보고에
  명시하며, 메시지와 반영 확인은 기존 팀장 활동 스트림에 `[A2A]`로 남는다.
  실행당 최대 256건, 본문 최대 4,000자. 초과는 조용한 잘림 대신 오류다.
- 검증: `test/piTeamMessaging.test.ts`, `test/piAgentTeamRuntime.test.ts`의
  외부↔실내 좌표 협의/팀장 질문 응답, 실제 Agent 루프의
  `test/piAgentTeamMessaging.bun.test.ts`. 네트워크 없는 결정적 모델 스트림을
  사용하므로 라이브 모델의 자발적 분업·협의 품질을 증명하는 테스트는 아니다.


## 오른쪽 AI 도크 + 왼쪽 활동 막대 (2026-09-26, 아래 2026-09-18 절을 대체)

사용자 결정: AI 는 **오른쪽**에 항상 보이고, 왼쪽은 그리기·맵 만 단다. 예전 「맵 | 그리기 | AI」 가로 탭은
AI 를 여는 순간 팔레트가 사라져 "시키고 바로 손보기"가 한 화면에서 안 됐다.

- 배치(`editor.ts` `renderEditor`): `[활동 막대 48px + 패널] [리사이저] [캠버스] [aside.ai-right-dock (editor-ai-dock)] [팀 레일]`.
  `#ai-panel` 은 `chat-float-host` 를 통해 오른쪽 도크에 붙는다. `is-left-sidebar` 클래스는 이름만 남은
  "고정 도크 패널" 표식이다 — 모든 도크 스타일이 이 클래스에 걸려 있어 바꾸지 않았다.
- 폭 예산(`applyLayout`): 도크 = 뷰포트 26% 를 280~420px 로 자른 값, 왼쪽 = `min(340, leftWidth,
  남은 폭 − 도크 − 팀 레일 − MIN_CANVAS_WIDTH(520))` 를 220px 이상. 실측(2026-09-26): 1440 → 왼 340 · 캠버스 676 ·
  도크 374, 1280 → 340·557·333, 1024 → 220·474·280. 가로 넘침 0.
- `aiSidebarWorkspace.ts`: 세로 활동 막대(`left-activity-bar`) — `sidebar-tools`(그리기) · `sidebar-maps`(맵) ·
  아래 `sidebar-inspect`(검사). 켜진 항목을 다시 누르면 48px 로 접히고, 다른 항목은 그 패널로 바꾸며 편다.
  마지막 패널은 `oprn:left-activity-pane`, 접힘은 `oprn:ai-sidebar-collapsed` 에 저장한다. 처음은 그리기.
  검사는 패널이 아니라 명령: 그리기를 펴고 `openSidebarInspection("ruleAudit")`. 배지는
  `ruleAuditViolationCountCached()` (도구줄 ⋯ 배지와 같은 수)이며 `RULE_AUDIT_UPDATED_EVENT` 로 갱신한다.
  `oprn:ai-sidebar-tools` 는 그리기 패널을 연다. `oprn:ai-sidebar-show` 는 더 듣는 곳이 없다(도크는 항상 보인다).
  회귀: `test/leftActivityBar.test.ts`.
- 막대 항목(2026-09-27): 그리기 · 맵 · **즐겨찾기**(`leftFavoritesPane.ts`) · **진행**(`leftProgressPane.ts`) · **연결**(`leftLinksPane.ts`) … 검사.
  패널은 펼쳐질 때만 그린다(`show()`), 숨은 패널은 `root.hidden` 에서 돌아선다. 마지막 패널은 `oprn:left-activity-pane` 에 저장.
  - 즐겨찾기: 별표한 타일과 최근 고른 타일 18개. 최근 목록은 `tileBrushTools.recordRecentTile` 로 옮겼다(팔레트 「최근」 분류와 공유).
    칸 클릭 = `selectPaletteTile`(팔레트와 같은 경로), 우클릭 = 즐겨찾기 토글. 변경 알림 `TILE_SHORTCUTS_CHANGED_EVENT`.
  - 진행: 캔버스 여정 띠와 같은 `evaluateAuthoringJourney`·진행 저장소. 첫 미완료 단계가 「다음」, 「시작/열기」는 `runAuthoringTask`.
  - 연결: `mapLinkStats.collectMapLinkGraph`(같은 명령 순회) — 시작 맵에서 너비 우선으로 닿는지 판정해 「고립/도달 불가」를 위에 모은다.
    양방향 이동은 ↔ 한 줄로 합친다(마을 하나에 집 15채 = 15줄). 이동 행 클릭 = 그 이벤트로 카메라.
- 스타일: `18-assistant-deck.css` 끝 「왼쪽 활동 막대 + 오른쪽 조수 도크」 절.

## 왼쪽 AI 대화 + 오른쪽 팀원 아바타 (2026-09-18, 위 절이 배치를 대체)

사용자가 승인한 배치: 왼쪽 **AI** 주 대화, 중앙 맵, 오른쪽 원형 팀원 아바타.
기본 편집기에서 우하단 float 데크와 「조수가 한 일」 가로 띠는 더 이상 만들지 않는다.
아래 과거 float/deck/작업 탭 설명보다 이 절과 현재 소스가 우선한다.

- `aiSidebarWorkspace.ts` / `editor.ts`: 왼쪽을 AI / 맵 / 타일 탭으로 전환한다.
  각 DOM을 유지하므로 전환 중 대화·입력은 사라지지 않는다. 접으면 48px 레일만 남고
  리사이저도 숨겨 맵 공간을 반환한다. 펼침은 선택 탭을 유지하고, 레일의 AI/맵 버튼은 해당 탭을
  바로 연다. 접힘은 `oprn:ai-sidebar-collapsed`에 저장한다. `oprn:ai-sidebar-show` /
  `oprn:ai-sidebar-tools`가 공개 AI 열기·접기와 연결된다. 옛 float 위치·접힘 값은 적용하지 않는다.
- `aiChatPanel.ts` / `aiInlineWorkCard.ts`: 레일 이름은 **AI**. 도구 진행·변경·중지·되돌리기는
  요청 아래 인라인 영수증으로 묶는다. `변경 보기`는 기존 `openWideChangeViewer`, `맵에서 보기`는
  기존 참조 내비게이션을 사용한다. `aiWorkStrip`은 이 경로에서 호출하지 않는다.
  Pi 종료도 영수증을 닫고 실패·중단·검토 필요를 구분한다. 자동 「작업」 탭 전환은 제거했다.
- `aiTeamSidebar.ts`: `teamActivity` + 세션 `laneSession()`을 구독한다. 실제 하위 팀원만 원형
  아바타·이름·상태로 표시하고, 총괄/flat 보고용 가상 `agent` 행은 제외한다. 상세는 사용자 클릭으로만
  연다. `aiTeamTranscript`의 실제 로그와 변경 요약을 사용하며 재생성하지 않는 textarea에 팀원별
  초안을 보관한다. 오른쪽은 팀원과 `팀 설정`(`createTeamPanel`)만 가진다.
- `mapSidebarSection.ts`: 맵 탭은 맵 목록(`renderMapList`)과 맵 속성(`renderMapProps`)을 가진다.
  속성은 현재 맵을 따라 갱신하고 좁은 패널에 맞게 한 열로 표시한다. 타일 도크는 maps 호스트를
  만들지 않으며, 기존 타일 내부 맵 드롭다운(`sidebar-map-switcher`)은 유지한다.
- **후속 요청 계약:** 현재 Pi 워커에 live inbox가 없다. 실행·적용·팀 검토 중에는 전송을 막고
  이유를 표시한다. 완료 후에는 선택 팀원의 맵·역할 프롬프트·이전 보고를 기존 lane 실행에 넘긴다.
  `LaneSpec.readOnly/toolDomains`를 요청에 전달해 검토 담당을 쓰기 에이전트로 바꾸지 않는다.
  후속 결과는 같은 패널에서 적용/버리기하고 기존 묶음 충돌/적용 게이트를 통과한다.
  실패·중단 시 요청 초안을 복구하되 새로 작성한 초안은 덮지 않고, 재시도 시 이전 오류를 지운다.
- 왼쪽 밀도 정리: 헤더에는 새 대화·더보기만 노출한다. 이전 대화·취향·보존 기획·맥락은
  이름이 있는 더보기 항목으로 옮기고, 하위 팝오버는 숨겨진 항목 대신 더보기 버튼에 앵커링한다.
  작업 카드는 요청문을 반복하지 않으며, 입력창 테두리는 컴포저 하나만 사용한다.
- 크기·크롬: `18-assistant-deck.css`가 왼쪽 표면을 소유하고, 새 오른쪽 표면은
  `25-team-sidebar.css`가 소유한다. 레거시 스튜디오는 명시적으로 열었을 때 기존 셸을 쓴다.
- 브라우저 증거: `BASE=http://127.0.0.1:9826 node scripts/qa/ai-team-sidebar.mjs` →
  `output/evidence/ai-team-sidebar/SUMMARY.md`. 실제 편집기 + 기존 로컬 marketTown showcase,
  원격 쓰기 차단, Pi 전송 응답 재현이다. **라이브 모델/새 게임 콘텐츠 저작 증거는 아니다.**
  아바타 전환·주/개별 초안 유지·자동 열림 없음·busy 전송 차단·검토 후속 readOnly·1024 레이아웃을 확인한다.
  후속 실패·재시도·적용·중단·Esc 포커스 복귀를 포함해 브라우저 22항목을 확인한다.
  사용자 검증 요청 후 `typecheck:app` 및 관련 Vitest 8파일을 실행한다. CSS 게이트는 HEAD 사본과
  비교한다(기준선 자동 갱신 금지). 새 클래스는 기존 `ai-chat-` / `ai-team-` / `ai-work-` 소유 범위를 사용하며,
  재사용하는 기존 대화 클래스의 소유권은 `scripts/css-surfaces.json`에 명시한다.

## 빈 대화의 읽기 전용 프로젝트 제안 (2026-09-18)

- `aiProjectSuggestions.ts`가 왼쪽 빈 대화 안내를 대체한다. 현재 맵·프로젝트 상태를 1.5초 간격으로 확인하며, 접힘/다른 탭/브라우저 숨김/입력 중/대화 중에는 탐색하지 않는다. 사용자가 잠시 멈출 수 있다.
- `projectSuggestions.ts`는 현재 맵 이벤트(페이지·중첩 명령 포함)와 DB를 읽어 빈 판매 목록, 없는 이동 목적지, 적 만나기가 켜진 맵의 빈 적 그룹 목록 후보를 만든다. 의도적인 빈 설정을 오류로 단정하지 않는다. 재료나 후보가 없으면 제안을 억지로 생성하지 않는다.
- 후보가 달라질 때 기존 Pi companion에 단독 읽기 전용 요청을 보낸다. 최대 4턴/45초, 도메인은 core/map/event/database, 최소 재호출 간격은 60초다. 같은 후보 상태에 반복 호출하지 않는다. 현재 맵·프로젝트가 바뀌면 취소하고 늦은 응답을 무시한다.
- AI는 근거가 있는 후보 ID만 최대 3개 고른다. 출력의 임의 문장을 카드로 채택하지 않으며 반환된 프로젝트도 절대 적용하지 않는다. 연결 실패 시 명확하게 기본 검사 결과라고 표시한다.
- 위치 보기는 맵의 해당 위치로 이동한다. AI와 이어가기는 정확한 맵/이벤트를 담은 요청 초안을 입력창에 넣는다. 자동 전송하거나 수정하지 않는다.
- 넘긴 제안은 패널 수명 동안 프로젝트·맵·후보별로 기억하고, 관련 근거가 달라질 때만 다시 제안한다. 타일만 바꾸면 상점/이동 제안을 재호출하지 않는다. 기록을 영구 저장하는 기능은 아니다.
- 검증: `test/projectSuggestions.test.ts`, `scripts/qa/ai-project-suggestions.mjs`. 브라우저 검증은 기존 로컬 showcase에 테스트용 이동 이벤트만 메모리로 추가하고 원격 쓰기를 차단한다. `LIVE=1`은 실제 모델의 읽기 전용 응답을 사용한다. 증거는 `output/evidence/ai-project-suggestions/`와 `output/evidence/ai-project-suggestions-live/`.

## 사이드바 AI 추천이 거의 작동하지 않던 세 원인 (2026-09-20)

왼쪽 사이드바 AI 패널의 추천이 사실상 죽어 있었다. 원인은 셋이고 서로 독립이다.

1. **후보 탐지기가 사실상 0건이었다.** `projectSuggestions.ts` 는 빈 상점 판매목록·없는 이동
   목적지·적 만나기 켜졌는데 빈 적 그룹 **셋만** 봤다. 실측: LegacyDb 실제 프로젝트 30개
   (111맵·114이벤트 포함) 전부에서 후보 **0건**. 그래서 패널은 언제나 「지금 확인한 범위에서는
   새로 제안할 내용이 없어요」로 끝났고 **AI 호출조차 일어나지 않았다**(브라우저 실측 agent
   호출 0회). 셋은 모두 「이미 만든 것의 연결이 빠졌다」만 잡으므로 처음 만드는 중인 맵은
   어느 것에도 걸리지 않는다. 이제 저작 여정 규칙을 함께 본다: 나가는/들어오는 이동 없음,
   이벤트 0개, 이벤트는 있는데 동작이 전부 빔, 이 맵으로 들어오는 문이 통행 불가 칸에 착지,
   DB 물건·적 그룹이 프로젝트 어디에서도 안 쓰임. 실측 결과 후보가 있는 프로젝트 **25/27**,
   맵 인스턴스 **184/285**, 비용 **16ms**(전체 27개 프로젝트).
2. **저작 예제 6개가 죽어 있었다.** 2026-09-06 커밋이 컴포저 추천 팝오버를 채우던
   `refreshComposerChips`·`refreshNextSteps`·`syncSuggestPopover` 를 삭제했고, 팝오버는
   **빈 껍데기로 남았다**(DOM 에 빈 div 2개, 열리지도 않음). `aiPanelChrome` 의
   「preset promotions 를 마운트하지 않는다」 계약은 그대로 두되, 살아 있는 진입점
   `test/e2e/editor-ai-authoring-entry.spec.ts` 와 어긋난 상태다 — 둘 중 하나는 반드시 틀리다.
3. **「추천 함께 보기」 설정이 무의미했다.** 대기 화면 3분기(추천 함께/조수만/입력창만)는
   저장·표시만 되고 **읽는 코드가 하나도 없었다**. 당시에는 `ink-only`·`map-first` 가 추천
   패널을 끄게 했다. 2026-09-23에 3분기 자체를 삭제했다 — 버튼은 항상 보인다.

추가로 고친 것: **쿨다운이 카드까지 막던 문제.** 예전에는 최소 재호출 간격(60초)이 걸리면
카드가 0장인 채 「바뀐 내용을 잠시 후 다시 살펴볼게요」만 떴다. 탐지기가 후보를 거의 못 내던
시절에는 차이가 없었지만 규칙이 늘어난 지금은 다르다 — 맵을 옮기거나 문을 고치면 **바로
보여줄 카드가 있는데도** 최대 60초 화면이 비어 「고쳤는데 아무 일도 안 일어난다」로 읽혔다.
이제 쿨다운은 **모델 호출만** 늦추고 로컬 탐지 결과는 즉시 깔린다(`renderKey` 를 `key` 와
분리 — 합치면 모델 호출이 영영 안 일어난다). 좌표가 없는 제안(맵 전체)에는 「위치 보기」가
없다 — (0,0) 으로 카메라를 옮기면 「가리켰다」는 거짓말이 된다.

계약: `test/projectSuggestions.test.ts` 19건(탐지 규칙 + 수명주기 + 쿨다운 + 위치 버튼),
`scripts/qa/ai-project-suggestions.mjs` 9검사 통과. 증거: 후보 검출률은 LegacyDb
`rpg_zzu.projects` 30행 실측, 브라우저는 `?devProject=1&marketTown=1`.

## 진단 카드를 캔버스 오른쪽 아래 느낌표 버튼으로 옮긴다 (2026-09-21)

감독 지시: 「AI 추천이 여기 있으면 좀 어색한거같은데 … 차라리 오른쪽 아래에다가 뭔가
느낌표 버튼으로 만들고 거기에 뜨게 할까」.

**무엇이 어색했나.** 진단 카드가 왼쪽 AI 패널의 **빈 대화 첫 화면**을 차지하고 있었다. 그
자리는 「대화를 시작하는」 곳인데 대화와 무관한 진단 목록이 첫인상을 정했고, 대화를 시작하면
사라져서 「어디 있더라」가 됐다. 게다가 2026-09-20 에 「추천 함께 보기」 설정을 그 첫 화면에
묶어 두었으므로, 위치가 바뀌면 그 축도 함께 옮겨야 했다.

**지금 구조.** 표면은 하나다 — 캔버스 오른쪽 아래 `ai-suggestion-peek` 버튼 → 팝오버
(`aiSuggestionPeek.ts`). 카드는 그 팝오버 안(`ai-project-suggestions`)에만 산다. 왼쪽 패널
빈 화면 규칙(`.ai-chat-sidebar-welcome` 전용 5줄)은 그 자리를 쓰는 표면이 하나도 없어져 걷었다.

**위치가 캔버스 영역 안인 이유.** 오른쪽 아래는 팀 레일(84px, 「팀 작업 없음 / 팀 설정」)이 이미
쓰고 있다. `position: absolute` 로 `canvas-area` 안에 두면 레일이 시작하는 곳에서 자동으로
끝나 겹침 계산이 필요 없다(실측 1440×1000: 레일 왼쪽 1357px, 버튼 오른쪽 1340px).

**닫혀 있으면 살펴보지 않는다.** snapshot 의 `active` 가 `peek.isOpen()` 을 포함한다 —
보이지 않는 표면을 위해 1.5초마다 프로젝트를 훑고 모델까지 부르는 것은 낭비다. 버튼을 누르면
`suggestions.refresh()` 가 즉시 한 번 돈다(실측: 닫힘 상태 agent 호출 0회, 연 직후 1회).

**배지.** 카드 수를 `onCountChange` 로 알려 버튼이 「살펴볼 것 N개」를 말한다. 「넘기기」로
줄어드는 것도 즉시 반영되고, 마지막 카드를 넘기면 배지가 사라진다. 살펴볼 것이 있을 때만
버튼이 강조된다(늘 켜져 있으면 「비었다」와 구분되지 않는다).

**설정과의 관계.** 대기 화면 3분기(`quiet-gold` / `ink-only` / `map-first`)는 2026-09-23에 걷었다.
빈 대화 화면이 없어진 뒤 라디오가 정하던 것은 이 버튼을 숨길지뿐이었고, 「조수만 보기」와
「입력창만 보기」는 같은 일이었다. 버튼은 항상 보인다. `.ai-suggestion-peek[hidden] { display: none }`
한 줄은 그대로 둔다 — `display:flex` 가 `hidden` 을 이겨, 닫기 이외의 숨김이 생겨도 화면에 남던
실측이 있었다.

계약: `test/projectSuggestions.test.ts` 19건, `scripts/qa/ai-project-suggestions.mjs` 12검사
(팀 레일 비겹침·배지·위치 보기가 팝오버를 닫는지·마지막 카드에서 배지 소거 포함).

## 팀 설정 목록과 편집 화면 (2026-09-18)

- `aiTeamPanel.ts`의 설정은 원형 아이콘·이름·두 줄 소개·참여 스위치 목록으로 시작한다.
- 설정 행은 `ai-team-roster-member`를 사용해 오른쪽 74px 아바타 행 스타일과 분리한다. 기본 팀 이름/소개는 쉬운 말로 제공하며 저장된 사용자 명세는 덮어쓰지 않는다.
- 팀원을 선택하면 목록 대신 해당 팀원 편집 화면을 표시한다. 이름/역할/소개만 기본 노출하고 세부 지시·기능 범위·작업 횟수는 접힌 고급 설정에 둔다.
- 팀 운영 지침과 기본 팀 복원은 목록 아래 접힌 팀 운영 설정에 둔다. 최근 작업도 별도로 접는다.
- 편집 중 활동 버스 갱신으로 입력 DOM을 재생성하지 않는다. 이름 변경은 현재 초안에 병합하므로 다른 필드 수정이 유실되지 않는다.
- 브라우저 재현: `scripts/qa/ai-team-settings.mjs`, 증거 `output/evidence/ai-team-settings/`.

## 팀 초안 격리와 최종 보정 (2026-09-18)

`aiPiGhostBridge`는 실행별 소유권으로 전역 미리보기를 보호한다. 새 실행은 이전 표시를
비우고, 이전 실행의 늦은 이벤트·타이머·dispose는 새 표시를 변경하지 못한다.
팀원별 증분 출처를 기록해 실패한 팀원의 변경을 철회한다. 최상위 done 및 검토 진입 시
`reconcile(merged.project)`로 최종 수용 결과를 표시한다. 하위 done의 전체 프로젝트는
다른 팀원의 변경을 덮어쓸 수 있으므로 최종 결과로 취급하지 않는다.

## 밑그림이 Pi 경로로 돌아왔다 — 워커가 툴마다 `map_delta` 를 흘린다 (2026-09-17)

사용자 지적: 「AI 에이전트들이 뭘 하는지 실시간으로 보였는데 지금 아예 안 보인다」. 원인은 고스트
고장이 아니라 **경로 이사**다. 조수 채팅의 평문 지시는 2026-09-11 이후 전부 `runPiTurn` 으로 가는데,
`src/ai/piAgent/**` 와 `aiPiAgentCommand.ts` 에는 고스트 호출이 **한 줄도 없었다**. 고스트를 먹이는
코드는 옛 세션 러너(`aiTurnRunner.ts`)와 영역 파이프라인에만 있다.

구조적 이유: Pi 는 루프가 Bun 워커에 있고 결과 프로젝트가 **맨 끝 `done` 에만** 실린다. 그래서
base↔초안 diff 로 굴러가던 고스트가 턴 내내 먹을 재료가 없었다.

| 조각 | 자리 | 계약 |
| --- | --- | --- |
| 증분 | `src/ai/piAgent/mapDelta.ts` | `diffMapsForDelta(before, after)` / `applyMapDeltas(maps, deltas)`. 순수 함수 한 쌍이라 워커·브라우저가 같은 코드를 쓴다. 손대지 않은 맵은 **같은 객체 그대로** 돌려준다(43맵 프로젝트에서 이 동일성이 곧 비용이다). 층은 `lower`·`upper` + 선택 층 `layer2`·`layer4`·`shadow`(두 맵 모두 없으면 항목 없음, 사라지면 `absent:true` — [editor-ai-tools.md](editor-ai-tools.md) 「조수가 보는 네 층」). |
| 발행 | `scripts/lib/piAgentRuntime.ts` | `tool_execution_end` 마다 섀도우와 `ctx.project.maps` 를 견줘 `map_delta` 를 낸다. 섀도우는 **한 번만** 복제하고 증분으로 따라간다 — 툴마다 다시 복제하면 호출 하나가 수십 MB 다. 순서 계약: `tool_end` → `map_delta`. 마지막 한 방울을 `done` 직전에 한 번 더 낸다. |
| 수신 | `src/editor/panels/aiPiGhostBridge.ts` | 초안 맵을 증분 복원하고 **기존 고스트 기계를 그대로** 돌린다(`replaceAgentGhostPreviewFromProjectDiff`). 스로틀·flush·cancel 은 세션 경로와 같은 `createThrottledAgentGhostPreviewUpdater` 다. `setAgentGhostDraftMapProvider` 로 초안 맵을 공급해 렌더러가 컴포지터 경로(오토타일·밑동 합성)를 쓴다 — 없으면 셀이 단색 사각형이 된다. |
| 배선 | `src/editor/panels/aiPiAgentCommand.ts` | 다리는 실행당 **하나**이고 이벤트 래퍼가 전부 그곳을 지난다 — 단일·병렬·팀이 같은 길이다(팀은 `agent_event` 한 겹만 벗긴다). 병렬·팀에서 에이전트마다 소유한 맵이 달라 증분은 그대로 겹쳐 쌓인다. |

인코딩: 바뀐 칸이 층의 **8분의 1** 을 넘으면 칸 목록 대신 층 배열을 통째로 싣는다(칸 하나가 JSON 약
16바이트, 배열 한 칸이 약 2바이트라 그 지점에서 통째가 싸다). 맵 크기가 바뀌면 인덱스 의미가 달라져
언제나 통째다. **맵 밖 변경(데이터베이스·퀘스트·스위치)은 담지 않는다** — 캔버스에 그릴 자리가 없고,
최상위 키를 통째로 나르는 설계는 실측으로 기각됐다(tilesets 1,501 KB · database 485 KB).

밑그림 수명: 실행 내내 → 「검토 대기」 동안 **남는다**(사용자가 적용·버리기를 고르는 화면이 곧 판단
재료다) → 적용·버리기·중단·실패·변경 없음에서 `dispose()`. 적용 직전에 지우는 것은 세션 경로의
`aiProposalCard.applyProposal` 과 같은 관례다 — 초안이 진짜 타일이 되면 같은 그림이 두 겹으로 남는다.

게이트: `test/e2e/pi-ghost-live.spec.ts` — `/v1/agent/run` 을 페이지 안에서 NDJSON 으로 대본화하고
`done` 직전에 스트림을 붙잡아 「턴 도중」 창을 만든다(`route.fulfill` 은 본문을 한 덩어리로 줘서 이
창이 안 생긴다). 세 경계를 단언한다: 턴 도중 마커·칸 수·실행 중 도구 → 검토 대기까지 잔존 → 버리면
0. 세션 경로만 보던 `test/e2e/agent-ghost-sequence.spec.ts` 는 이 회귀를 못 잡는다. 단위는
`test/piAgentMapDelta.test.ts`(증분 왕복 9건) · `test/aiPiGhostBridge.test.ts`(다리 8건).
눈 증거: `node scripts/capture-pi-ghost-live.mjs` → `output/evidence/pi-ghost-live/`.

## 턴 슬롯은 의도 분류 전에 잡는다 + Pi 턴 감사 누적 (2026-09-16)

실측(2026-09-16, 실제 OAuth 모델 `google-antigravity`/`gemini-3.7-flash` 로 조수를 구동): 전송 직후
**1.2s~7.5s** 구간에서 브리지가 `turnBusy=false`·전송 버튼 활성·중단 버튼 숨김으로 보였는데 상태줄은
`의도 읽는 중…` 이었다. 원인은 `send()` 가 `await plainPiTurn(text)`(의도 분류, timeout 6s)를 끝낸
**뒤에야** `runPiTurn` 안에서 `turnBusy` 를 세운 것.

그 창에서 두 번째 지시를 보내면: 클릭이 받아들여지고 `input.value = ""` 를 지나간 뒤 runPiTurn 가드에
걸려 거부됐다 — **사용자가 타이핑한 문장이 복원되지 않고 사라졌다**(대화에 흔적도 남지 않음).

- 슬롯을 분류 **전에** 잡는다(`runSurface.turnBusy = true; refreshSendEnabled();`). 거부는 입력을
  건드리기 전에 일어나므로 문장이 보존된다. `runPiTurn` 은 `slotClaimed` 로 «자기 슬롯» 인지 구분한다
  (구분이 없으면 자기가 잡은 슬롯에 자기가 걸려 턴이 죽는다).
- 분류가 던지면 슬롯을 풀고 로그에 한 줄 남긴다 — 호출자가 클릭 리스너(`void send()`)라 받아 줄
  사람이 없어, 예전에는 unhandled rejection 이 되고 사용자에겐 아무 표시도 없었다.

Pi 턴의 감사 행 누적: `startPiRunLog().finish()` 가 감사 행을 **돌려준다**. 패널은 그 행을
`controller.auditHistory` 에 넣는다(`onRunAudit`). 이전에는 그 행이 활동 로그로만 가서, 세션이 없는
Pi 경로에서 `window.__oprnAiBridge.audit()` 이 **항상 `[]`** 였다(실측: 턴이 성공하고 카드까지 뜬 뒤에도
0건) — 이 API 를 읽는 QA 스펙들(`_adversarial-tile-qa.spec.ts` 등)이 툴 호출을 0으로 봤다.

회귀 고정: `test/aiChatPanelComposerMode.test.ts` «의도 분류 구간의 턴 상태와 입력 보존» 2건 ·
`test/piAgentRunLog.test.ts` «종료는 기록한 것과 같은 감사 행을 돌려준다».

## 결과 보고서 모달 — 변경 지점마다 before/after 한 쌍 (2026-09-15, P2)

「보고서 열기」(작업 탭 검토 스트립 · 로그 카드 「넓게 보기」)가 열던 넓은 뷰어는 맵 하나의 **전체 diff bbox 한 쌍**이었다 —
AI 가 한 맵의 북쪽과 남쪽을 같이 고치면 bbox 가 맵 전체가 되어 사진이 아무것도 말하지 못했다("적용 전 후 사진이 여러 개
떠야 하는 거 아니냐"). P2 는 변경을 **지점**으로 묶어 지점마다 한 쌍을 세로로 나열한다.

| 조각 | 파일 | 계약 |
|---|---|---|
| 지점 계산 | `src/project/changeSites.ts` | 순수 함수 `computeChangeSites(before, after, {pad=3, gap=4, maxSites=12})`. 바뀐 칸(타일 lower/upper diff + 이벤트 추가·삭제·이동 좌표 — 이동은 출발·도착 둘 다)을 체비셰프 거리 ≤ gap 으로 뭉쳐 `ChangeSite` 목록으로. 맵 추가·삭제·크기 변경은 전체 맵 지점 하나. 상한을 넘으면 **gap 을 두 배씩 키워** 다시 뭉친다 — 지점을 자르지 않는다(안 보여주는 변경이 없어야 한다). `SiteRect` 는 RegionRect 와 구조 동일(레이어: src/editor 를 import 하지 않는다). 스택·속성 변경은 그림에 안 나오므로 ledger 의 몫. |
| 보고서 모드 | `aiChangePreview.ts` | `ChangePreviewInput.sites?/report?/findings?`. `openWideChangeViewer` 는 `sites.length > 0` 이면 `.ai-change-wide.is-report`: 머리(제목 + 「변경 지점 N곳」 + 칩) · brief(팀 보고 문장 `ai-change-report-brief` + 검수 지적 `ai-change-report-findings`) · `ai-change-report-sites`(지점마다 `ai-change-report-site`: 번호·맵 이름·`placeLabel`·`statsLabel` + before/after 쌍, 렌더 폭 560) · ledger. 나란히/겹쳐 보기 토글은 보고서 모드에 없다. sites 가 없으면 기존 한 쌍 동작 그대로(기존 호출자 무수정). |
| 배선 | `aiPiAgentCommand.ts` | `reviewInput` 에 `sites: computeChangeSites(base, merged.project)` + `report: boardState.report` + `findings`(검수 실패 지적 모음). 검토 카드의 「넓게 보기」와 버스 `openReport` 가 같은 input 을 쓰므로 두 경로 다 보고서 모드다. |
| 스타일 | `19-assistant-cards.css` 4절 | `.ai-change-wide.is-report`(brief 행 유무로 grid-template-rows 분기, :has) · 지점 구획 · 쌍 캔버스 상한 44vh. |

fixture 함정(실측): `test/piAgentRunOutcome.test.ts` 의 최소 맵 fixture 가 `lowerTiles/events` 없이 GameMap 을 사칭하다
실제 `computeChangeSites` 를 타고 터졌다 — 방어 코드 대신 fixture 를 계약대로 채웠다(`mapWith`).

검증: `test/changeSites.test.ts`(뭉침·이동 양쪽 마킹·mixed·맵 추가/삭제/크기·gap 배증 상한·빈 diff) ·
`test/aiChangePreview.test.ts` 보고서 모드 3건(지점 수 = 구획 수 = 렌더 호출/2 · 머리 brief · sites 없으면 기존 동작) ·
`scripts/qa/ai-work-tab-qa.mjs` (d2) 단계 — 실제 맵 복제에 두 군집 + 이벤트를 심고 **실제 캔버스 렌더**로 지점별 쌍을
검사한다(`05-report-modal.png`).

## 조수 데크 「대화|작업」 탭 + 스튜디오 상세 — 팀원이 어디서 일하는지 한 곳 (2026-09-14, A안)

계획서: `docs/2026-09-14-team-panel-plan.html` + A안 목업 `docs/2026-09-14-team-panel-plan-assets/proposed-a/`.
1단계(좌하단 독립 팀 데크)는 「AI 가 어디서 일하는지」를 두 패널로 갈랐고, 스튜디오 모드에서는 셸 뒤에 묻혀
보이지도 않았다. A안은 팀 데크를 **조수 데크 안 탭**으로 합치고, 스튜디오 덱의 「작업」 탭이 같은 상태를
**상세**로 그린다. 단독 `/pi` 도 같은 자리다 — 「팀/단독」 구분이 사용자에게 사라진다.

| 조각 | 파일 | 계약 |
|---|---|---|
| 과정 로그 | `src/ai/piAgent/teamBoardState.ts` | `TeamBoardAgent.log: TeamAgentLogEntry[]`(kind `task·turn·tool·text·error·review·done`) + `droppedLog`, 상한 `TEAM_AGENT_LOG_CAP`=200. 툴 행은 `tool_start` 에서 `ok:null` 로 열리고 같은 id 의 `tool_end` 가 제자리에서 닫는다. **`tool.args?: string`** — `formatToolArgs(event.args)`(객체는 `k: v · k: v`, 200자 상한)가 `tool_start` 에서 붙고 닫혀도 유지된다. 상세 보기만 그린다. |
| 버스 | `src/ai/piAgent/teamActivity.ts` | 보드 상태(`publishTeamActivity`) · 중지 슬롯(`setTeamStopHandler`/`requestTeamStop`) · **검토 액션 슬롯**(`setTeamReviewActions`/`currentTeamReviewActions`: `apply·discard·openReport?`). `runPiCommand` 가 「검토 대기」 게시 **직전**에 로그 카드 `setReview` 와 **같은 클로저**를 등록하고, 적용·버리기·새 실행 시작에서 null 로 지운다. `openReport` 는 `openWideChangeViewer(reviewInput)` — 2단계 보고서 모달의 진입점. |
| 작업 페인 | `src/editor/panels/aiTeamWorkPane.ts` | `createTeamWorkPane({ detail? })` → `section.ai-team-work[data-detail]`: 빈 안내 · `.ai-team-work-body[.is-single]`(팀원 열 `ul` + 과정 열) · 검토 스트립(`ai-team-work-review`: 버리기 · 보고서 열기 · 적용, 버스 액션이 없으면 disabled) · 푸터(합계·보고·오류·적용 문장). **에이전트가 1명이면 `is-single`** — 팀원 열을 숨기고 과정만(목업 a3). 팀원 클릭은 고정, 새 실행(task 가 바뀜)이면 해제. |
| 과정 열 | `src/editor/panels/aiTeamTranscript.ts` | `createTeamTranscript({ detail? })`. 툴 행은 조수 작업 타임라인과 같은 어휘(`ai-act-chip/label/sum/status`, `aiToolLabels`). detail 이면 `ai-team-tx-args` 인자 줄 + 요약 줄바꿈 허용. 같은 팀원이면 새 행만 덧붙이고 닫힌 툴 행은 제자리 교체. |
| 조수 데크 | `aiChatPanel.ts` | 레일 아래 `div.ai-work-tabs[role=tablist]`(`ai-work-tab-chat` + 배지 `ai-work-tab-badge`, `ai-work-tab-work` + 인원 `ai-work-tab-count` + 점 `.ai-work-tab-live[data-state]`). 실행 상태가 null 이면 탭 줄은 hidden. 「작업」이면 `.ai-chat-body[hidden]` + 페인 표시 + `panel.is-work-tab`. 컴포저는 항상 아래(DOM 순서: 레일 → 팀 막대 → 탭 → 채팅 본문 → 작업 페인 → 결과 줄 → 컴포저). |
| 스튜디오 | `aiStudioShell.ts` | 셸이 버스를 직접 구독한다. 보드가 있으면 덱 「작업」 = `createTeamWorkPane({ detail: true })`(WorkPlan 도 있으면 `.ai-studio-work-split` 좌: 계획 우: 보드), 없으면 기존 WorkPlan 체크리스트. 배지 = 실행 중 인원(없으면 인원, 없으면 `done/total`). 보드가 **처음** 나타날 때만 「작업」으로 전환(setWorkPlan 과 같은 규칙). **덱 높이가 기본(236)이면 보드가 뜰 때 420 으로 한 번 키우고**(`applySplitterSize("deck", 420, false)` — 저장 안 함), 보드가 사라질 때 우리가 키운 값 그대로면 기본으로 되돌린다; 드래그해 둔 높이는 손대지 않는다. 조수 패널은 `is-studio` 에서 데크 탭 줄을 숨기고 탭을 「대화」로 되돌린다. |
| 스타일 | `src/styles/database/tabs-b-assistant-panel/22-team-work.css` + 18 | 토큰만, `!important` 0. `.ai-deck > .ai-team-work { height: min(700px, 68vh) }` → 900 호스트 612 · 1080 호스트 700(목업 계약). `.ai-studio-deck-pane .ai-team-work { height: 100% }`. 18 의 유휴 컴팩트 폭(480) 규칙에 `:not(.is-work-tab)` — 검토 대기는 턴이 없는 유휴라서 그 순간 팀원 열이 480 으로 접히던 것을 막는다(QA 실측). |

**자동 전환·배지 규칙(조수 데크, 스튜디오 밖):** 버스 phase 가 비실행(null·종결) → 실행(준비·실행 중·적용 중)으로
바뀌면 「작업」으로 전환한다. 실행 → 비실행(답 도착)인데 「작업」을 보고 있었으면 「대화」에 배지 1 — 대화 탭을
누르면 지운다. 상태가 null 이 되면 「대화」로 돌린다. 스튜디오에서는 전환·배지를 만들지 않는다(덱이 그린다).

**걷어낸 것(1단계 셸):** `aiTeamDeck.ts`(레일·알약·좌측 앵커·폭 조절·자동 열림·z-order) · 조수 레일 「팀」 토글 ·
`aiPanelLayout` 의 `oprn:ai-team-deck-*` 저장 · 22-team-deck.css 의 컨테이너 쿼리 컴팩트 규칙 · `editor.ts` 마운트.
`aiDeckMoveChrome` 의 `anchorX/cssVars/store/hint` 매개화는 기본값이 조수 현행이라 남겨 두었다(`test/aiDeckMove.test.ts` 20건).

검증: `test/piAgentTeamBoardLog.test.ts`(로그·인자 계약) · `test/aiTeamWorkPane.test.ts`(happy-dom: 빈 안내·순서·고정·is-single·
검토 스트립 버스 액션·상세 인자·새 실행 고정 해제) · `test/aiStudioShell.test.ts`(버스 게시 → 「작업」 상세 페인·배지) ·
`scripts/qa/ai-work-tab-qa.mjs`(dev 서버에서 실제 리듀서 상태를 게시해 1440/1920 — 팀 실행·검토 스트립·단독 실행·스튜디오 상세 4장,
`output/evidence/ai-work-tab/SUMMARY.md` 부터 읽을 것). 버스에는 `page.evaluate` 동적 import 로 게시한다 — QA 용 코드 훅이 필요 없다.
**단, 베어 경로 `/src/ai/piAgent/teamActivity.ts` 를 import 하면 안 된다**: HMR 로 무효화된 모듈은 앱이 `?t=…` 가 붙은 URL 로
import 하므로 베어 경로는 **다른 인스턴스**가 된다(실측: 게시는 됐는데 구독자가 안 불려 DOM 이 빈 상태). QA 는 서빙되는
`aiChatPanel.ts` 소스에서 import 지정자를 뽑아 그 URL 로 import 한다(`resolveAppModules`). 검토 액션도 같은 방법으로 세팅해 스트립
버튼을 실제로 누른다. 게시만으로는 패널이 유휴(`is-assistant-idle`)라 실제 턴과 폭이 다를 수 있다 — 위 `:not(.is-work-tab)` 이 그 차이를 없앤다.

## 조수 채팅은 Pi 하나다 — 세션 경로를 걷어냈다 (2026-09-11)

조수 세션이 deprecated 되면서 «어느 루프로 가는가» 를 답하던 경로 enum(`session` · `pi-agent`)이
사라졌다. 남은 축은 둘뿐이다: **무엇을 해도 되는가**(자율성 다이얼 → Pi 노브)와 **몇 명이 도는가**
(`AiConfig.piTeam`).

| 표면 | 값 | 소유 |
|---|---|---|
| 실행 계획 | `readOnly` · `planOnly` · `maxTurns` · `thinkingLevel` | `resolvePiRunPlan`(`src/ai/piAgent/executionRoute.ts`) ← 자율성 다이얼 |
| 팀 | boolean | `AiConfig.piTeam` — 컴포저 「팀」 토글(`ai-composer-team`) · 설정 「Pi 팀 실행」(`ai-config-pi-team`) |
| 명시 입력 | `/pi …` · `/team …`(= `/pi team …`) | `parsePiCommand` — 언제나 최우선. 다이얼의 읽기 전용·계획보다 **세다** |

- 컴포저의 「경로」 셀렉트(`ai-composer-route`)와 설정의 「지시 실행 경로」(`ai-config-route`)는 **없다** —
  그 자리를 팀 토글이 대신한다. 토글은 다이얼이 쓰기를 허용할 때만 보인다(읽기 전용·계획 턴에서는
  쓰기 툴이 없어 팀이 예산만 태운다).
- 질문(다이얼 「읽기 전용」)·계획(「확인」)은 세션이 아니라 Pi 가 맡는다: `readOnly` 는 요청에 실려
  워커가 쓰기 툴을 주지 않고(`readOnlyTools` + 시스템 프롬프트 한 줄), 계획 턴은 지시문 머리에 계획
  지시가 붙는다(`PLAN_ONLY_PREFIX`). 바뀐 것이 없으면 그 턴의 **답·계획 본문**을 assistant 말풍선으로
  남긴다 — 보드의 220자 한 줄이 답이 되면 질문 모드가 쓸 수 없다.
- **do 레벨의 질문 발화는 의도 선언이 읽기 전용으로 승격한다 (2026-09-12 복원):** `plainPiTurn` 이
  다이얼이 쓰기를 허용할 때만 `declareIntentCached(createLlmIntentDeclarer())` 를 부르고
  `intent.mode === "question"` 이면 `plan.readOnly = true` 로 덮어 Pi 를 단독·읽기 전용으로 돌린다.
  세션 경로의 `mode=question → ask` 승격이 Pi 이관(2026-09-11)에서 빠져 「균형」 질문 턴에 쓰기 툴이
  달려 갔던 구멍을 메운다 — 툴 목록 수준 강제라 모델 선의에 의존하지 않는다. 분류는 **원문 발화**만
  본다(컨텍스트 footer·도구 지시 제외), 실패·지연은 폴백 `mode:"other"` 이라 작성 요청이 읽기 전용으로
  새지 않는다(6초 타임아웃, 캐시 TTL 90초). 승격 시 시스템 줄로 사용자에게 알린다. 명시 `/pi` 는 이
  분류를 거치지 않는다 — `runPiTurn` 진입 전에 `plainPiTurn` 에서만 부른다.
- **초기 노출은 의도 기반 툴 이름 목록이다 (2026-09-19):** `plainPiTurn`이 공유 후보 조립기의
  core/조회/선언/adventure/자연어 후보를 `initialToolNames`로 보내고, `runPiCommand`가
  동반 서비스 요청에 보존한다. 큐·프로젝트 시작·브리지 입력도 같은 경로다. 워커는 검색 결과를
  다음 라운드에 추가하고 빈 검색이면 허용된 전체 카탈로그로 복귀한다. 읽기 전용과 역할별
  `toolNames`는 이 확장으로 넘을 수 없다. 이전의 도메인 단위 노출은 팀 역할·명시 호출에
  남아 있다. 실패한 의도 선언은 전체 후보로 시작한다. 상세·검증 근거는 `editor-ai-tools.md`
  「Hybrid native tool exposure」를 따른다. `AssistantSession`만 수정하고 일반 채팅을
  검증했다고 보고하지 마라 — 기본 채팅은 그 세션을 실행하지 않는다.
- 변경-0 종료의 보드 phase 는 **「완료」**(`markTeamBoardDone`)다 — 「적용됨」은 `applyProposedProject` 가
  실제 커밋한 실행에만 쓴다(2026-09-12 실측: 질문 턴이 「적용됨」 배지 + 실패 톤 캡션으로 끝났다).
  답이 남은 턴은 본문 말풍선을 시스템 줄(「프로젝트는 바뀌지 않았습니다」) **앞에** 붙인다. 보드 행의
  지시가 보드 지시와 같으면 echo(`ai-team-task`)를 그리지 않는다 — 단일 실행에서 같은 문장이
  카드 제목·행·말풍선에 세 번 나오던 것을 막는다.
- 옛 blob 의 `executionRoute: "pi-team"` 은 **팀 비트**로 승격된다(`loadAiConfig`,
  `LEGACY_PI_TEAM_ROUTE`). `session`·`pi-agent` 는 둘 다 «Pi» 이므로 버린다. 이 승격이 이 변경의
  유일한 데이터 위험이고 `test/piAgentExecutionRoute.test.ts` 가 세 값을 전부 고정한다.
- Pi 적용은 조수 세션과 같은 **영수증 카드**(`ai-change-card`, 지금 → 적용 후 두 장)를 남긴다: Pi 명령이
  재료(`PiChangeReceipt`)를 넘기고 패널이 그린다(`showChangeReceipt` → 로그 + 스튜디오 「변경」 탭 +
  되돌리기). 검토 카드에서 적용해도 같은 경로다.
- **결정 자리에 비교가 먼저 선다 (2026-09-14):** 기본값 `piApply: "review"` 에서 검토 카드는 문장·칩·버튼만
  그렸고, 비교는 「적용」 을 누른 **뒤에야** 나왔다 — "부탁했는데 before/after 가 안 보인다" 의 첫 자리다.
  이제 `runPiCommand` 가 검토 단계에서도 같은 카드를 «적용 전» 상태로 만들어 `board.setReview({preview})`
  로 넘기고, 보드의 검토 카드가 그 자리에 그대로 세운다(칩 줄은 카드가 대신하므로 따로 그리지 않는다).
- **Bun 워커의 유휴 타임아웃은 꺼져 있어야 한다 (2026-09-14 실측):** `Bun.serve` 는 `idleTimeout` 기본값이 **10초**라
  연결에 바이트가 오가지 않으면 소켓을 끊는다. `/agent/run` 은 턴 시작·툴 호출·응답 끝에만 NDJSON 줄을 쓰고 하트비트가
  없어서, 모델이 10초 넘게 생각하는 순간 스트림이 끊겼다. 체인: Bun 소켓 닫힘 → Node `fetch`(undici) 가
  `TypeError: terminated` → `companionHttpUtil.pipeWebStream` 이 `{type:"error",message:"terminated"}` 줄로 전달 →
  보드 「Pi 에이전트 실패: terminated」. 동시에 워커는 `request.signal` abort 를 클라이언트 중단으로 읽어 팀장·시공을
  전부 abort 했다(`[pi-agent] aborted by client`). 팀 모드가 유독 잘 죽었다: 팀장은 `wait_agents` 로 조용히 기다리고
  팀원은 Ultrabrain 사고 수준(high)으로 돌아 한 턴이 10초를 넘기기 쉽다 — 09-13~09-14 팀 모드 「마을 만들어줘」
  「집을 만들어바」 「재밌는 rpg 로 만들어줘」 가 전부 25~210초 만에 `terminated`, 단독·low 였던 09-11 「마을을 만들어봐」
  만 살아남았다. 라이브 재현(`?blankProject=1`, 팀 켜고 「마을 만들어줘」): 시공 3턴 시작 +15.1s → 9.5초 침묵 →
  +24.5s `terminated`. 고침은 `scripts/oh-my-pi-worker.ts` 의 `Bun.serve({ idleTimeout: 0 })` 한 줄 — 실행 상한은
  `piAgentRuntime.ts` 의 `timeoutMs`(기본 10분)가 따로 든다. 회귀는 `test/ohMyPiWorkerIdle.node.test.mjs` 가
  모델 없이 잡는다(헤더만 보내고 14초 유휴 → 같은 연결로 400 응답을 받아야 한다; 기본값이면 +12초에 닫힌다).
- **침묵을 없애고, 남은 침묵은 고장으로 읽는다 (2026-09-14):** 유휴 타임아웃을 끄는 것은 10초짜리 컷을 다음 층의
  300초짜리로 뮸 것뿐이고(Node `fetch` → undici `bodyTimeout`), 「5분 넘게 침묵했는지」를 **알 방법이 없다**는 것이
  더 큰 문제다. 세 겹으로 나눠 닫았다.
  - **내용 — 델타 중계(`src/ai/piAgent/deltaRelay.ts`).** pi-agent-core 는 모델을 **스트리밍으로** 부르고(`streamSimple`)
    델타마다 `message_update` 를 내며, Antigravity 제공자는 `includeThoughts` 로 **생각 델타까지** 흘린다. 그런데
    `piAgentRuntime` 은 `turn_start`·`tool_execution_*`·`message_end` 네 가지만 중계하고 이 이벤트를 버렸다 —
    즉 데이터는 워커 문 앞까지 초 단위로 닿고 있는데 문을 안 열어준 것이었다. 이제 `delta` 이벤트로 1초씩
    합쳐 보내고(보드가 이미 1초 티커로 다시 그리므로 그보다 잔 간격은 보이지 않는 렌더만 늘린다), 보드는
    「생각 중 · …」 한 줄로 그린다. 순서 계약: 턴·툴·응답 끝 직전에 `flush()` — 안 하면 조각이 완성문 뒤에 도착한다.
  - **맥박 — 워커 heartbeat(`scripts/lib/piAgentStream.ts`).** `/agent/run` 응답 본문을 이 모듈이 만들고,
    줄 사이가 비면 `PI_AGENT_HEARTBEAT_MS`(5초)마다 `{type:"heartbeat"}` 를 끼운다. 델타가 안 나오는 구간
    (첫 토큰 전 대기, 긴 툴 실행, 팀장의 `wait_agents`, 생각 요약을 숨기는 모델)에서도 와이어는 안 비운다.
  - **판정 — 브라우저 워치독(`client.ts`).** `PI_AGENT_STALE_MS`(30초, heartbeat 의 6배) 동안 줄이 하나도 안 오면
    리더를 취소하고 「워커가 응답하지 않습니다」로 끝낌다. 이제 **침묵은 정상이 아니다** — 생각하는 중이면
    heartbeat 가 오기 때문이다. 이게 없으면 죽은 워커를 10분 상한까지 「실행 중」으로 띄우게 된다.
  `heartbeat` 는 보드 앞에서 버려진다(`aiPiAgentCommand` 의 `wrap` · Ultrabrain 계획 핸들러) — 5초마다 행 전체를
  다시 그릴 이유가 없다. 커버리지: `test/piAgentStreamLiveness.test.ts`(델타 합침·순서·상한, heartbeat 흐름,
  워치독 두 방향, 보드의 delta/heartbeat 처리). 대조 실측: heartbeat 를 빼면 그 테스트가 15초 타임아웃으로,
  `onStale` 을 비우면 워치독 테스트가 같은 모양으로 죽는다.
- **남은 세션 호출자**(deprecated 재고): 선택 영역 작업·영역 생성기(`runRegionTask`/`runOperatorTask`),
  클러스터 AI 모달, 조수 QA 브리지(`aiAssistantBridge` — DB AI 바가 이걸 쓴다), 벤치마크/QA 스크립트.
  각자 표면의 엔진이라 조수 창 경로와 무관하고, Pi 이관은 별도 작업이다.

## 단독 작업은 결과 중심으로 표시한다 (2026-09-14)

`aiTeamBoard.ts`의 단독 실행은 기본적으로 접힌 네이티브 `details` 「작업 기록」이다.
사용자 지시 제목·Pi 배지·시공 행·툴/시간 합계를 기본 화면에서 반복하지 않는다.
팀 모드는 기존 보드를 유지한다. 기록 요소는 상태 갱신에도 같은 DOM을 유지하므로
사용자가 연/닫은 상태가 보존된다. 1초 ticker는 시간 합계만 갱신하고 행을 재생성하지 않는다.

- 적용 전 비교와 적용/버리기 버튼은 `details` **밖**에 있다. 오류 본문도 접지 않는다.
  도구 오류 수·검토 지적은 접힌 요약에 남는다. 검토 해제 시 버튼 DOM도 제거한다.
- 단독 적용 결과는 영수증 하나로 전달한다(영수증을 표시할 수 없는 호출자는 시스템 문장).
  보드 footer와 채팅에 같은 완료 문장을 중복하지 않는다. 단독 결과 제목은 「변경 내용」이며
  기술 수치·내부 맵 ID로 만든 제목은 생략한다. 실제 실행 로그/보드 상태 데이터는 유지한다.
- `aiTeamPanel.setEnabled`는 컴포저 팀 토글·설정 모달과 동기화된다. 팀이 꺼져 있고
  실제 팀 작업이 없으면 레일 아래 팀 패널을 숨긴다. 명시 `/pi team`은 설정과 무관하게 표시한다.
  다음 단독 작업에서 이전 팀 상태를 지운다. 채팅 패널 해제 시 팀 패널 구독도 해제한다.
- 브라우저 재현은 `scripts/qa/ai-routine-edit.mjs`: 네이티브 summary의 Enter 열기/닫기,
  팀 토글, 적용·되돌리기·버리기, 1024×768·1280×800·1440×900 비교·버튼 가시성을 검증한다(편집 모드는 2026-09-27 삭제).
  증거 `output/evidence/ai-routine-edit/compact-<width>-<mode>.png`. 모델 전송은 모킹한다.
  단위 회귀는 `test/piAgentTeamBoardRender.test.ts`와 기존 Pi 실행/컴포저 테스트.

## 바로 깔기 (2026-09-25)

컴포저 왼쪽 `바로 깔기` 토글(`ai-stamp-place`, `aria-pressed`, `localStorage` `oprn:ai-stamp-place`). 켜면 계획 턴·승인·Pi 세션 없이 곧바로 깐다.
**의도 읽기와 일꾼은 모델이 주도한다**(사용자 판단, 2026-09-25 — 정규식만으로는 「땅으로」가 재료 이름이 되어 실패했고,
「땅을 동그랗게, 물을 동그랗게 옆에 나무」처럼 나눠 말하면 알아듣지 못했다).

- `src/editor/stampPlaceRunner.ts` `runStampPlace({text, mapId, selection, signal, onPhase})` — 가벼운 모델(`configForLiteModel`, 추론 끔, JSON) 한 번으로
  문장을 **여러 단계**(`fill_region`·`place_props`·`paint_road`·`tile_erase`·`build_wall`·`place_door`·`author_house`)로 나눈다. 대상 사각형(선택 또는 맵 전체)을
  부분 사각형으로 쪼개고, 재료는 **현재 타일셋의 실제 라벨**(`fillableMaterialSuggestions`·`formatMaterialLabelHint`·벽/문 후보) 중에서 고른다. 원은 정사각 상자.
- 단계는 `applyToolSequenceToStore(..., {continueOnError:true})` 로 한 undo 체크포인트에 적용한다 — 한 단계가 실패해도 나머지는 깔린다.
  실패한 단계만 도구 오류(가까운 라벨 제안 포함)와 함께 **한 번** 되물어 대체 단계를 받는다(최대 모델 호출 2회).
- 순수 계획·검증은 `src/ai/stampPlanner.ts`: 허용 도구만, 좌표는 대상 안으로 자르고, 키는 허용 목록만 옮긴다. 단계 상한 8.
- **반드시 모델을 거친다 (2026-09-27, 사용자 판단).** 낱말 규칙 폴백(`stampPlace.ts`)은 삭제했다 — 「숲」을 통행 불가로 올려 덤불만 깔던 경로였다.
  빈 문장도 모델에 보낸다(`EMPTY_SENTENCE`: 이 자리에 어울리는 것을 알아서). AI 미연결이면 **아무것도 깔지 않고** 연결이 필요하다고 말한다.
  계획 호출이 실패·시간 초과(20s)이거나 쓸 단계가 없으면 **한 번만** 다시 묻고, 그래도 없으면 아무것도 깔지 않고 이유를 말한다.
- **게임 오브젝트도 깐다**: `place_chest`·`place_npc`(이름·그래픽 질의·대사 1~3줄 → `pages:[{lines}]`)·`place_savepoint`·`place_examine_hotspots`.
  숲 규칙: 숲/나무 → `dense`(물·작은 나무·숨은 수관 길), 울창/빽빽/통행 불가 → `impassable`.
- **현재 맵 사실이 1순위** — `src/ai/mapPlacementContext.ts` `buildMapPlacementContext(project, mapId)`(순수).
  이 맵의 조우(`encounterTable`·`troopIds`(조우율>0)·`fieldSpawns`) → 트룹 적 합계 = 전투 1회 골드·경험치·드롭,
  이미 깔린 상자(닫힘 페이지 selfSwitch A=false 의 `changeGold`/`changeItem`)·상점 재고와 가격·NPC 이름·세이브 수·출입구(`transfer`·`worldGraph` 간선),
  이 맵에 걸린 설정집 문서(`projectWikiContext` mapId). 계획 사실(`facts.placement`)로 모델에 간다(`knownItemIds` 는 빼고).
- **상자 금액 범위 `chestGold`**: 전투 1회분 ×0.5~×4, 기존 상자 ×0.5~×2(둘 다 있으면 합친 범위), 전투·상자가 없고 상점만 있으면 상점가 ×0.5~ 중앙 ×3.
  현재 맵에 신호가 없을 때만 출입구 이웃 맵(scope `neighbor`), 그다음 프로젝트 적 보상 분포(`project`), 적도 없으면 20~100G(`none`).
  바로 깔기 검증기가 모델 금액을 이 범위로 맞추고(`clampChestGold`) 결과 줄에 근거를 붙인다. 없는 `itemId` 는 버리고 금액으로 대신한다.
- **겹침 해소 (2026-09-27 라이브 QA)**: 모델이 맵 한가운데 기존 표지판 칸 위에 상인을 세웠다. 이제 맵 사실에 `existing.occupied`(기존 이벤트 id·칸·종류·이름)를 싣고,
  검증 뒤 `resolveStampOverlaps`(`stampPlanner.ts`, 순수)가 새 이벤트를 기존 이벤트 칸과 그 **바로 위아래**(두 칸 높이 그림)·같은 계획의 다른 새 이벤트에서
  반경 6 안의 가장 가까운 `isPassableLanding` 칸으로 옮긴다. 결과 줄에 「겹쳐서 (a,b)→(c,d)」, 빈 칸이 없으면 그 단계를 버린다. 수리 라운드는 방금 깔린 이벤트까지 다시 읽는다.
- **추가 도구**: 상인(`place_npc` merchant:true + stock → `make_villager({shop})` 한 번, 재고는 실제 id·가격이 상자 범위 상한의 2배 이하만, 비면 이 맵 보상 후보),
  `place_storage_chest`, `place_trap`, `place_battle_blocker`(troopId 는 `encounterTroops`=이 맵 조우 트룹만, 없는 id 는 이 맵 첫 트룹으로, 조우가 없으면 버림),
  `set_scene_mood`(날씨 none/rain/storm/snow/fog, applyMode map), `arrange_tall_grass`, `set_start_position`, `move_event`·`remove_event`(`occupied` 에 있는 id 만).
  `knownItemIds`·`itemPrices` 는 거르는 데만 쓰고 모델에게 보내지 않는다.
- **맵 성격 (2026-09-27)**: `GameMap.mapRole`(town/dungeon/field/interior, 값·라벨은 `src/project/mapRole.ts`)을 맵 설정 → 기본 설정 「맵 성격」에서 고른다. 지정하면 `guessMapRole` 이 추정 없이 그 값을 쓴다(`explicit: true`, 이유 「맵 속성에서 지정」 — 조우가 있어도 이긴다). 「자동」은 필드를 지우고 추정 결과와 근거를 선택지에 보여 준다. 조수는 `set_map_properties {mapRole}`(`"auto"` 로 지움). 불러오기에서 모르는 값은 경고 후 버린다(프로젝트는 열린다). 런타임 동작은 바꾸지 않는다.
- **마을 (2026-09-27)**: `mapRole` 이 없으면 `guessMapRole`(`mapPlacementContext.ts`)이 신호로 추정한다 — 조우·필드 스폰이 있으면 던전/필드(이름이 「불타는 마을」이어도),
  없으면 레이아웃 종류(village/town/houses…) → 이름(마을·촌·시장·항구…) → 실내 설정/이름 → 상점·여관 수·주민 3명 이상·safeZones 순. 근거는 `role.reason` 에 남는다.
  마을·실내면: 상자 범위는 이 맵 기존 상자 → 이 맵 상점 물가 → **이웃 맵 기준의 1/4** → 프로젝트 기준의 절반(마을 상자에 던전급 금액 방지), 보상 후보에서 이웃 던전 드롭 제외,
  함정·길막 몬스터는 문장에 함정/몬스터/습격 같은 말이 있을 때만(「알아서」에 섞이지 않게). 새 도구 `place_inn`(여관 주인 NPC + `inn` 명령, 요금은 이 맵 여관 → 이웃 전투 1회의 절반 → 상자 상한 1/10, 요청값은 기준의 1/3~3배로 보정),
  `place_signpost`(기존 마을 표지판과 같은 object1 frame 25 — query 「signpost」 는 주민 그림을 골랐다). 빈 문장 + 마을이면 모델에게 "사람 사는 마을처럼(주민 2~4·상점 없으면 상인 1·표지판 1)"을 준다.
- **채팅 조수도 같은 기준**: 컨텍스트 footer 에 `formatChestRewardHint` 한 줄(범위·근거·아이템 후보), `place_chest` 는 범위 밖 금액이면 막지 않고 경고한다.
- **속도 (측정, 미해결)**: 도구 `run` 은 1ms 인데 `runTool` 한 번이 ~700ms — `createDraft` 의 `structuredClone`(프로젝트 25.9MB 중 타일셋 25.0MB) 367ms + `summarizeChanges` 타일셋 `JSON.stringify` 비교 334ms.
  타일셋을 참조 공유(copy-on-write)하면 줄지만 드래프트에서 타일셋을 직접 고치는 도구가 21파일이라 이번 변경에서 하지 않았다.
- 실측(워크트리 dev, Google 연결): 「왼쪽에 땅을 동그랗게, 가운데 물을 동그랗게, 오른쪽 옆에 나무」 12s·3단계 성공, 「땅으로 깔아줘」 → 흙길 오토타일 채움.
  증거 `verify-shots/stamp-llm/`.

### 연속 주문 대기열 (2026-09-28)

목표: 드래그하면서 바로 깔기 명령을 연달아 내린다. 예전에는 바로 깔기가 채팅의 `turnBusy` 슬롯을 잡아 두 번째 드래그가
「진행 중인 응답이 끝난 뒤 다시 시도하세요」로 버려졌다.

- 소유: `src/editor/stampOrderQueue.ts`(모듈 싱글턴, 스토어 import 없음). 러너 배선은 `aiChatPanel.ts` 모듈 최상단 `configureStampOrderQueue`.
  패널이 아니라 모듈이 소유하는 이유는 레인과 같다 — 스튜디오에서 장면을 더하면 패널이 다시 만들어진다(`aiLaneSession.ts`).
- 규칙: 같은 맵에서 **영역이 겹치는 주문만** 앞 주문이 끝날 때까지 기다린다(선택 없음 = 맵 전체 = 그 맵의 모든 주문과 겹침).
  동시에 도는 주문은 `STAMP_ORDER_CONCURRENCY`(3). 모델 읽기는 겹쳐 돌고, 적용(`applyToolSequenceToStore`)은 동기라 자연히 하나씩이다.
- 조수 턴과의 경계: 주문은 **적용 직전에** `waitForApply` 로 조수 턴(`turnBusy`)이 끝나기를 기다린다. Pi 턴은 시작 시 프로젝트를 바닥으로 잡고
  적용 때 stale-base 를 보므로, 턴 도중에 깔면 조수 결과가 통째로 거절된다. `runSurface.turnBusy=false`·대화 은퇴·패널 해제가 `pokeGate()` 를 부른다.
  기다린 뒤 러너는 **지금 맵**으로 `resolveStampOverlaps` 를 다시 돌린다(먼저 끝난 주문이 세운 NPC 와 겹치지 않게). 프로젝트가 바뀌었으면 그 주문은 중단.
- 표면: 채팅 말풍선은 `#번호 문장` → 끝나면 `#번호 이름 — 완료/일부 적용/실패` + 단계 줄(`takeUnreported` 로 한 번만).
  입력줄 대기 표시(`ai-pending-queue`)에 「바로 깔기 N개 진행 · M개 대기」, 멈추기는 주문이 돌면 서고 `cancelAll()` 로 전부 끊는다.
  캔버스에는 `StampOrderRenderer`(EditScene depth 10.3)가 주문 사각형과 「#3 연못 · 읽는 중 / #1 끝나면 / 조수 응답 뒤에 깔기」를 그린다 — 스튜디오 모니터도 같은 캔버스다.
  바로 깔기가 켜져 있으면 조수 턴 중에도 전송 버튼이 살아 있다(`refreshSendEnabled`).
- 검증: `test/stampOrderQueue.test.ts`(겹침·상한·조수 게이트·프로젝트 교체·중단·보고 1회).
  브라우저: `BASE=http://127.0.0.1:<포트> node scripts/qa/rapid-stamp-orders.mjs` — 모델을 2.5s 늦춘 스텁으로 표준 편집기·스튜디오에서 드래그 3번.
  실측(2026-09-28): 두 모드 모두 거절 0·오류 0, 떨어진 두 주문 동시 읽기(`inflightMax` 2), 겹친 셋째는 첫째 뒤에 깔림. 증거 `verify-shots/rapid-stamp/`.
- **드래그·적용 성능(2026-09-28 고침)**: 새 프로젝트(149MB = 타일셋 82MB + 업로드 자산 66MB)에서 적용 한 번에 메인 스레드가 5~6s 멈추고,
  드래그 한 칸이 중앙값 140ms 였다. 표준 편집기·스튜디오가 같은 캔버스·같은 패널이라 두 모드 모두 같았다. 원인과 고친 자리:
  - 오버레이 강제 레이아웃: `renderRegionSizeBadge`/`positionBuildPaletteOverlay`/`publishMapViewport` 가 부를 때마다 `getBoundingClientRect`.
    `EditScene.hostGeometry()` 캐시(ResizeObserver·resize·scroll 로 무효화) + 팔레트 배치를 rAF 로 모음(`layoutDomOverlays`), 값이 같으면 스타일을 안 쓴다.
    손을 뗄 때는 `flushDomOverlayLayout()` 로 바를 즉시 띄운다.
  - 선택만 바뀌는 드래그 칸마다 채팅 패널(`applyAssistantViewPolicy`·스튜디오 `refreshScenes`)과 톱바가 다시 그렸다 —
    `editorStateChangedOnlyCanvasOverlay` 면 건너뛴다(`aiChatPanel.ts`, `app/mode.ts`).
  - `createDraft` 가 타일셋 전부를 복제(1.4~2.1s) → `cloneProjectForMutation` 지연 사전 + `toolRunner` 의 `finishDraftTilesets`.
  - 되돌리기 스냅샷 전체 복제(1.3s) → `mapEditHistory.projectSnapshotSharingTilesets`(타일셋·업로드 자산 항목 공유, 되돌릴 때 복제).
  - 업로드 자산 복제: `cloneProjectForMutation`·`cloneKeepingDigests` 가 `assets.uploaded` 항목을 공유한다(`projectClone.withoutSharedDictionaries`).
    계약: 업로드 자산 항목은 제자리에서 고치지 않고 사전 자리에 새 객체를 대입한다. 공유 덕에 요약 기억도 살아 한가할 때 도는 커밋 요약이 1.4s 에서 짧아졌다.
  - `resetManualProjectCommitBaseline` 의 전체 요약은 한가할 때로 미룬다(`settlePendingManualDigest`, 저장 커밋이 먼저 오면 그 자리에서 센다).
  - `removeLegacySpriteReferences` 는 한 번 깨끗하다고 본 타일셋·업로드 자산 객체를 `WeakSet` 으로 기억하고 다시 훑지 않는다(240ms).
  실측(부하 12~19 공유 박스, headless, 모델 스텁, `scripts/qa/stamp-drag-perf.mjs` 3회 중앙값, 전후 교대):
  편집기 드래그 칸 139 → 47ms, 드래그 40칸 longtask 합 4.9 → 1.6s, 바 등장 150 → 60ms, 적용 최장 멈춤 5.7s → 0.2s.
  스튜디오 134 → 42ms, 5.4 → 1.4s, 166 → 48ms, 5.8s → 0.24s. 증거 `verify-shots/stamp-drag-perf/final-*.json`, `verify-shots/rapid-stamp/rapid-stamp-studio-after.gif`.
  남은 것: 드래그 중 longtask 합 약 1.5s/40칸(캔버스 `redraw`·상태 줄 갱신 후보, 미추적).

## 단순 생성·수정은 계획 필요 여부로 실행한다 (2026-09-18 갱신)

평문 채팅은 기존 `declareIntentCached` 결과를 재사용한다. 오류 없이 `source: llm`,
`mode: create 또는 modify`, `needsPlan: false`, `clarify: null`이면 `PiRunPlan.routineEdit`를 넘긴다.
생성이라는 이유만으로 계획 불필요 판정을 뒤집지 않는다. 분류 지침은 「이 맵에 집을 만들어라」를
현재 맵의 단일 시공으로 명시하고, 생성에도 기존 대상 맵 ID를 선언하도록 한다.
집 한 채의 도구가 부속 실내·출입구까지 만드는 것은 별도 계획의 근거가 아니다.
새 분류 호출·설정·키워드 판정은 없다. 기존 의도 선언 내부의 요청 범위 감사 호출은 유지한다.
`runPiCommand`는 쓰기가 허용된 단독 실행이며 기존 맵 하나가 지정된 경우만 이 힌트를 사용한다.

- 이 경우 Deep이 바로 실행한다. 별도 Ultrabrain 계획을 만들지 않는다.
- 병합 결과가 해당 맵 이외의 프로젝트 키도 바꾸면 기존 시각 검토를 복원한다.
  해당 맵만 바뀌면 Vision/Ultrabrain 검토를 생략한다. 생략을 검토 통과로 기록하지 않는다.
- 사용자 검토/자동 적용 설정, 적용 전 비교 카드, 커밋 게이트, 범위 밖 변경 제거,
  stale-base 검사, 적용 영수증과 되돌리기는 같은 경로를 쓴다.
- 다단계·불명확한 요청·분류 오류·팀·다중 맵·명시 `/pi`는 기존 절차를 유지한다.
  집 생성으로 부속 실내 맵이 추가되면 별도 계획은 생략하지만, 실제 변경 키가 대상 맵을
  넘으므로 사후 시각 검토는 복원한다. 분류/감사 호출을 없애거나 검수 통과로 간주하지 않는다.
  계획 전용은 항상 쓰기 없이 Ultrabrain으로 실행한다. 자연어 판정의 정확도를 보장하는
  변경은 아니며, 이 첫 축소는 구형 세션 제거나 팀 UI 재설계를 포함하지 않는다.

검증: `test/aiChatPanelComposerMode.test.ts`, `test/piAgentRunOutcome.test.ts`,
`test/piAgentExecutionRoute.test.ts`. 실제 편집기 재현은
`QA_BASE_URL=http://127.0.0.1:<port> node scripts/qa/ai-routine-edit.mjs`.
모델 전송을 모킹하고 원격 저장이 꺼진 blankProject에서 맵 이름 수정→비교→적용→되돌리기와
바닥 한 칸 수정→전후 이미지→버리기를 검증한다.
증거는 `output/evidence/ai-routine-edit/`이며 실제 모델의 응답 품질·지연 측정은 아니다.

## Five model roles and whole-map harmony review (2026-09-14)

The main Pi chat route uses **Ultrabrain** for planning and final map judgement,
**Deep** for implementation/tool work, **Writer** for narrative prose, **Vision** for
image observations, and the existing **Image** selection for image generation.
`modelRoles.ts` resolves `roleModels.{vision,writer,deep}` independently; missing roles
migrate from legacy `model` (writer/vision) and `liteModel` (deep). Explicit ids are preserved.
The legacy fields remain compatibility aliases. Once explicit role settings are saved,
retained region sessions select Ultrabrain for their supervisor and Deep via
the Deep role; provider and effort travel with each role. `resolveSurfaceAiConfig`
selects Vision for tileset analysis, Deep for region/cluster/event-command, and
Ultrabrain for supervisor surfaces. Cast-sheet prose uses Writer. The small intent
classifier remains a non-reasoning, 4096-token routing call; it must not inherit
Deep's expensive effort or the editor's 200000 output budget. Legacy/test configs
without role selections retain their prior behavior.
Provider/model/effort for each LLM role are independent of the autonomy dial. Image keeps
`imageProviderId`/`imageModel` and the existing `imageGenerationClient` path.

`aiPiAgentCommand` runs one read-only Ultrabrain plan across the requested scope before
single-mode Deep execution, except for the routine-edit path described above. Planning errors/empty plans stop execution. Plan-only turns
always enforce read-only and use Ultrabrain alone, even if the caller omitted `readOnly`.
Read-only questions skip the extra planning phase. Team mode uses Ultrabrain as its existing
orchestrator (planning plus assignments), while builders and structural reviewers use Deep.
With explicit role selections, the Deep selection takes precedence over legacy team member
model overrides; the team editor points users to AI role settings instead of offering
a model override that would be ignored. Team role ids (builder/reviewer) are task responsibilities, not model tiers.
`consult_writer` delegates prose on demand and returns text for Deep to apply; it has no
mutation tools. It carries cancellation and rejects incomplete output. Mechanical tasks
need not call Writer. The Node auth owner resolves each selected provider's credentials and
passes a server-only provider-key map to the worker; child calls never reuse another
provider's credential. Plan-only calls do not receive the Writer consultation tool.


`aiPiAgentCommand` reviews the merged, postprocessed Pi draft before presenting/applying it
unless it qualifies for the routine-edit review exemption above.
`src/ai/ultrabrainReview.ts` selects visually changed maps, but sends each **whole map**,
not just edited regions: one PNG up to 1536 px, no tile-array dump or fixed 16-image fanout.
Vision first reports visible evidence; Ultrabrain then judges palette, density, proportions
and relationships against the author request using **the same original whole image** plus
Vision observations. Neither phase has mutation tools. `ultrabrainImage.ts` uses the editor screenshot layer compositor
(`drawMapTileLayer`) for terrain quarters and tile backing, with actual event sprites between
layers. It does not claim passability/runtime proof from a still.
Read-only/unchanged maps incur no review call. Shared renderer limitations (backgrounds,
ambiguous event states, unavailable assets) remain visible; missing image delivery, malformed
or truncated verdicts and cancellation never count as approval. Draft changes stay isolated.
Negative/unavailable reviews keep the existing manual proposal card even in auto-apply mode;
only all-positive review allows automatic application. Findings appear in chat and the board log.

### 검수 응답 재시도와 정직한 보고 (2026-09-16)

두 검수 호출(Vision 관찰 · Ultrabrain 판정)은 **쓸 수 있는 응답을 받을 때까지 최대 2회** 묻는다
(`requestUsableReviewCompletion`). 이유는 실측이다: 프로바이더가 가끔 **최종 출력 없이** 끝난
응답을 *예외가 아니라 200 정상 응답*으로 돌려준다(실측 2026-09-16: 빈 본문 + `finish=stop`,
또는 `Cloud Code Assist API returned a thought-only response without final output`).
`llmClient` 의 일시 오류 재시도는 **예외에만** 걸리므로 이 모양은 그 재시도를 통과해 나갔다 —
그래서 검수 계층에서 «모양» 까지 보고 재시도한다. 중단 신호는 재시도하지 않는다.

실패 문구도 고쳤다. 예전에는 네 갈래(비-stop 마감 · 툴콜 · 본문이 문자열이 아님/비어 있음 ·
이미지 미전달)를 한 문장(`이미지 전달 또는 검수 완료를 확인하지 못했습니다`)으로 뭉쳐 던져,
빈응답까지 «이미지 전달 실패» 로 읽혔다 — 그 문구를 받은 사람은 이미지 경로를 의심했지만
같은 호출이 그대로 성공하기도 했다(같은 날 실측: 실제 앱 호출 200/stop/문자열 422자/delivery 정상).
지금은 `finish=length`, `content=비어 있음`, `imageDelivery=[]` 처럼 어긋난 조건을 그대로 남긴다.

그리고 **검수를 못 한 것은 «지적» 이 아니다**. 예전에는 catch 에서 오류문구를 `findings` 로
발행해 보드에 「검수 지적 1건」이 생겼다(작품 결함처럼 보였다). 지금은 Ultrabrain 행을 `실패` +
`검수 불가 — <사유>` 로 남기고, 버블도 «검수 지적으로 세지 않는다» 고 말한다.
정책은 그대로다: 검수를 못 한 초안은 **승인으로 세지 않고**, 자동 적용 모드에서도 수동 검토
카드를 유지한다. 회귀: `test/ultrabrainReview.test.ts`(재시도·정확한 사유·재시도 안 하는 취소).

AI settings exposes five role sections, including **Ultrabrain · 계획과 최종 판단**.
`ultrabrainConfig.ts` defaults to Google Antigravity / `gemini-3.8-flash` / `high`.
Writer model/provider changes and the autonomy dial do not overwrite it. These preferences
live in `oprn:ai-config`, not the project database. No new credential store is used.

The old 2026-09-10 claim that catalog absence proves Gemini 3.8 is unavailable is obsolete.
OMP 17.4's bundled catalog is still missing it, but direct OAuth wire `gemini-3.8-flash-high`
with `thinkingLevel: HIGH` returned OK on 2026-09-14. `scripts/lib/ohMyPiModel.ts` provides a
narrow compatibility entry using 3.7's transport metadata until upstream includes 3.8.
Both Pi and completion use this exact resolver. Unknown explicit IDs now fail instead of
silently changing models; `loadAiConfig` also preserves explicit IDs. Completion uses
`completeSimple` and maps the envelope's reasoning effort and output limit into SDK options,
so selecting high actually reaches the high wire route.

Coverage: `modelRoles.test.ts`, `piWriterTool.test.ts`, `piAgentTeamRuntime.test.ts`,
`piAgentRunOutcome.test.ts`, `ultrabrainReview.test.ts`, `piAgentModelFallback.bun.test.ts`,
`ohMyPiComplete.bun.test.ts` (real SDK + mock fetch asserts model/effort/image wire).
Browser replay: `QA_BASE_URL=http://127.0.0.1:<port> node scripts/qa/ultrabrain.mjs`
(mock completion by default; `--live` exercises existing OAuth). It verifies independent
settings persistence and whole-image review without writing any project. Evidence:
`output/evidence/ultrabrain/settings.png`, `specialists.png`, `review-input.png`.
Live provider verification can run without Chromium after capture:
`node scripts/qa/model-roles-wire.mjs` checks Vision 3.7/medium → Ultrabrain 3.8/high
with the same PNG; `bun scripts/qa/model-role-plan.ts` verifies read-only Ultrabrain Pi
planning, and `--writer` verifies an actual Deep → consult_writer call. These write
local QA evidence only (`roles-wire.json`, `plan-wire.json`, `writer-wire.json`).
All three live checks passed on 2026-09-14. Both image-review phases cap output at 4096:
forwarding the generic editor default of 200000 to Vision caused a verified HTTP 400.

## Retained map planning items and explicit reuse (2026-09-10, OPRN-019)

An assistant `BuildSpec` remains **session** state: `assistantSession.specsByMap` replaces the
prior spec for the same map, and `dropSession` (new conversation, history restore, project
switch) clears the blueprint. That lifecycle is unchanged. What is new is a separate,
project-persistent, user-owned list beside it.

- `GameMap.planningItems?: MapPlanningItem[]` is optional authored data:
  `{id ("pi_N"), text, status: "active"|"retired", origin: "user"|"spec", createdAt?, updatedAt?,
  specAssetId?}`. Authority is `src/project/mapPlanningItems.ts`. Absent when unauthored, so old
  project JSON stays byte-stable and no schema-version bump is required. See
  `runtime-project-schema.md` for the load/validate/normalize contract.
- Writes go only through `src/editor/mapPlanningActions.ts`
  (`add`/`update`/`setRetired`/`delete`), each a `store.update(..., {scope:"map", mapId})`, so
  autosave, undo and remote sync behave like any other map edit. Emptying the list deletes the
  field. Retire and delete are different actions: a retired row stays visible and struck through
  but leaves the reuse pool; delete removes it.
- Surfaces: the studio deck gained a **기획** tab (`ai-studio-tab-planning`, badge = active count)
  hosting `aiPlanningList.ts` — inline text editing, retire/restore, delete, and an add row.
  The composer rail gained a **보존 기획 재사용** toggle (`ai-planning-toggle`) opening
  `aiPlanningReuse.ts` with three exclusive modes `none | all | selected`
  (`ai-planning-reuse-mode-*`). `none` is the default at every open.
- **The list never enters a prompt by itself.** Only an explicit all/selected choice appends a
  `[보존 기획]` guidance block after the user utterance and before the `[컨텍스트]` facts line;
  `formatPlanningReuseBlock` states in-band that the items are guidance, not a blocking rule.
  The popover preview (`ai-planning-reuse-preview`) is the exact text that will be sent, shown
  before sending, and the composer chip (`ai-planning-chip`) repeats the choice on the action row.
  The choice resets after each send, when the map changes, and when a chosen item is retired or
  deleted. `instruction` (intent declaration, tool-name promotion) still sees only the raw
  utterance. Nothing in the spec gate, approval policy or validators reads this field, so retained
  guidance cannot block manual editing or an unrelated assistant turn.
- Blueprint → list is a user action, never automatic: the `set_build_spec` chat summary carries a
  **보존 기획에 담기** button (`ai-build-spec-capture`) that converts each asset through
  `planningTextFromSpecAsset` (label + kind + coordinates), tagged `origin:"spec"` with a
  `mapId:assetId` key so repeat presses cannot duplicate rows.
- Tests: `mapPlanningItems` (schema, roundtrip, fail-closed wire data, reuse resolution),
  `mapPlanningReuse` (conversation reset, project reload, per-map scope, edit/retire/delete,
  the three modes, real panel payload, non-blocking), `mapPlanningSpecCapture` (real turn loop:
  a confirmed blueprint writes nothing until the capture button is pressed).
  Browser evidence: `verify-shots/oprn-019/`.

## Run outcome line: four independent axes (2026-09-09)

The single `[data-testid="ai-run-outcome"]` line drawn by `renderRunOutcome` states four
facts that never borrow each other's success.

| dataset | means | does NOT mean |
|---|---|---|
| `execution` | how the run ended | that the goal was met |
| `goal` | acceptance assessment state | that anything was saved |
| `delivery` | draft / applied / persisted / verified stage | that an image was sent |
| `imageDelivery` | material image was actually attached to the real request (`attached`/`unattached`) | that the model understood or liked the picture |

`imageDelivery` carries only what `AssistantImageEvidence.deliveryFacts()` reports: `attempted`
is the live render captures of this run, `attached` is the subset the provider acknowledged in
the actual request. A capture without acknowledgment stays 0, and when the map changes afterwards
both capture and delivery retire, because an outdated picture is not current evidence. A run that
never reported delivery facts omits the attribute entirely — unknown is not rewritten as zero or
as failure. Contract tests: `test/aiVisualEvidenceReceipt.test.ts`; the axis table lives in
`test/aiRunOutcome.test.ts`.

**Pi 경로도 같은 4축을 그린다 (2026-09-11).** 2026-09-10부터 평문 지시는 전부 Pi 에이전트
경로로 가므로(`src/ai/piAgent/executionRoute.ts` DEFAULT_EXECUTION_ROUTE), 이 줄이 세션에만
붙으면 20턴 내내 한 번도 안 그려진다(실측: 적대 평가 2026-09-11, 20턴 0회 렌더). 이제
`runPiCommand`가 종료 4축을 `PiCommandSurface.setRunOutcome`으로 게시하고(`src/editor/panels/aiPiAgentCommand.ts`),
패널은 `piRunOutcome ?? controller.session?.getRunOutcome()` 순으로 슬롯에 그린다
(`src/editor/panels/aiChatPanel.ts` refreshRunOutcome). Pi 경로는 수용 검사가 없으므로
`goal`은 늘 `unassessed`이고 `persistence`는 `none`이다 — 사실 없는 축을 성공으로 올리지
않는다. 같은 종료 캡션은 스트림 오류·툴 실패를 숫자+첫줄로 묻고(예: `(⚠ 오류 1건 — OAuth
token expired…)`), 범위 밖 spill 버림도 `범위 밖 N건 버림(키들)`으로 성공 캡션에 함께 고지한다.
계약: `test/piAgentRunOutcome.test.ts`.

**묶음이 만든 정의는 병합이 데려온다 (2026-09-14).** 맵 묶음 병합(`src/ai/piAgent/mapBundle.ts`)은
묶음 밖 변경을 버리지만, 묶음이 **새로 만든** 스위치·변수·공통이벤트·엔딩·타일셋·업로드 자산·
`database` 레코드와 새 플래그의 세션 시작값은 함께 옮긴다. 맵 이벤트가 그 정의를 가리키기 때문이다 —
버리면 병합본이 자기 이벤트의 참조를 잃고 커밋 게이트가 `serialize-roundtrip`(`setSwitch: switchId가
존재하지 않습니다`)으로 **적용 전체를 거부**한다(`/pi` 실측: `적용 실패(commit-rejected): …`).
기존 항목의 수정·삭제는 그대로 범위 밖이고, 함께 옮긴 키는 spill 목록에서 덜어낸다.
계약: `test/piAgentMapBundle.test.ts`(단일·CLI 경로), `test/piAgentTeamRuntime.test.ts`(팀 경로 —
병합이 워커 안에서 돌아 여기가 진짜 실패 경로였다; 시공 팀원의 `place_battle_blocker` 스위치가
게이트를 통과하는지 잡는다).

**살아 있는 워커는 코드를 안 따라온다 (2026-09-14).** 워커(`scripts/oh-my-pi-worker.ts`)는 모듈
그래프를 부팅 때 한 번 로드하는 오래 사는 Bun 자식이라, 페이지를 새로 고쳐도 살아 있는 워커는 옛
병합·옛 툴을 계속 돈다. 실측: 위 픽스가 `main` 에 들어간 뒤에도 편집기는 같은
`적용 실패(commit-rejected): 직렬화 왕복 실패: setSwitch: switchId가 존재하지 않습니다` 를
재현했다 — 브라우저가 아니라 워커가 낡아 있었다(활동 로그 `project oprn-fcfe8b2c2b`, 픽스가
`main` 에 병합되기 70분 전 실행). 이제 dev 서버가 `src/**`·`scripts/**` 변경을 보면 다음 요청 때 워커를 갈아 끼우도록
표시한다(`markOhMyPiWorkerStale`, `vite.config.ts` 의 워처). 진행 중인 실행은 죽이지 않는다.
계약: `test/ohMyPiWorkerStale.node.test.mjs`. 회귀 진단 순서: (1) 활동 로그에서 그 실행의
`result.error` 를 본다(`ai_activity_logs`), (2) 워커를 실제로 다시 띄운 뒤 재현되는지 본다.

## P3 run retirement and stale drafts (2026-09-07)

P3 adds client-local execution ownership and a captured proposal base to the P1/P2
contracts below. The [P3 evidence index](../output/evidence/ai-harness/p3/README.md)
binds these contracts to repaired source `34d5b672ad30c2dec5a3d58fa761f83781a6ee35`.
The earlier integration passed its named controls, but independent review of
`450a1bbfb` found an accounting defect and an incomplete human race. Both corrections
now pass integrated controls; independent re-verification, lead gates and delivery
remain separate. The original needs-fix verdict stays historical, not relabelled.
The overall goal isn't complete.

`AssistantSession.getRunOperation()` returns the in-memory `RunOperation` to capture
before asynchronous work. `retireRun()` settles pending cancellation and revokes
that operation; a replacement send retires its predecessor before taking ownership.
`RunOperation.wait(promise)` releases the caller on retirement without waiting for
an uncooperative producer. It doesn't stop the producer itself. Captured-owner checks
prevent its late model/tool/verification/apply/save/proof continuation from publishing
through the replacement session. Already-aborted entry starts no preparation or
tools, while genuine new-goal entry still retires the old goal and detached payload.

Terminal result, recap and outcome are prepared before synchronous subscribers can
accept B. Successful tool/protocol bookkeeping also precedes callbacks, so cancelling
at a successful write doesn't lose that genuine draft. Normal authoring settlement
isn't cancellation, but current-main independent review also gates application:
an unreviewed draft stays detached until an authorized retry earns a fresh approval.
An already-approved exact draft remains applicable after an authoring error only
while its review, run owner and captured base are current; error status alone is
not cancellation. Review-loop failures still revoke approval, and budget/cancelled
results cannot apply. Applied content and its later P1 proof remain available. Repeated retirement returns the
prepared result rather than manufacturing another terminal result.

Actual local application is also credited before synchronous mutation observers.
The shared adapter passes its existing owner-bound `onApplied` callback into
`ProjectStore.replace` or `replaceProject`. The store invokes it after installing
the project and updating mutation counters, before activity observers or store
subscribers can retire A and start B. A's prepared cancellation result therefore
retains `appliedCalls`, no pending copy of that application, and delivery `applied`.
B gets no A application or proof. This is local accounting, not a save receipt.

The actual Panel Abort calls `aiTurnRunner.abortTurn()` and releases A's live slot
without making B wait for A's delayed transport. Backend ownership and the physical
runner slot are distinct. If only the session/operation changes, A releases its own
busy/controller/presentation slot without retiring B; if another runner owns the
controller, A leaves B's slot alone. Real next-send controls cover both cases.
Applied A content stays in the project. Cancelled pending work remains inspectable
for authorized same-goal resume; explicit new-goal entry discards its detached
payload and authority, not already-applied content or immutable goal history.

On a normal same-session replacement send, capture the exact approved draft's
content identity **before** retiring the predecessor operation. Retirement aborts
the signal used by `isDraftReviewApproved()`; checking retention afterward mistakes
valid reviewed content for an unreviewed draft and resets it to the accepted base.
This snapshot preserves content only: the new owner still clears prior review/apply
authority and must earn a fresh review. Already-cancelled or stale reviews do not
qualify, and explicit `new-goal` still discards the old detached payload. The
`assistantMapPreservationGuard` same-session cases verify that the second writer
sees the built house without old approval, reaches real `protected-house-write`,
and retains its lower tiles, upper tiles and layout under all four permissions.

A proposal rejected as `stale-base` or `stale-baseline` remains inspectable through Ask, but Ask
publishes no apply calls. After intent selection, the next authorized non-question
user authoring turn rebases from current live data and performs new work. It doesn't
replay the rejected snapshot or its tools. The review baseline and original-context
read credits are rebuilt for that recalculation, so intervening human changes are
not misattributed to the new AI draft. Explicit same-goal Continue retains real
applied calls and P1 delivery; detached appearance generation remains turn-scoped.
The native unassessed stale-title case
settles `failed / unassessed / draft`; other goal assessments still use P2's independent
axis. See the [required base and write boundary](editor-ai-tools.md#p3-captured-proposal-base-2026-09-07).

Auto-apply, undo, separate region approval, advisory diagnostics, canonical requirements,
exact-scope verdicts, user-only withdrawal/new-goal/Continue, wiki ownership and current
proof semantics remain intact. No durable checkpoints, remote schema, distributed or
two-tab writer guarantee, generic DAG/code runner, or P4/P5 behavior is added.

Sources: [operation](../src/ai/runOperation.ts), [session](../src/ai/assistantSession.ts),
[runner](../src/editor/panels/aiTurnRunner.ts), [Panel](../src/editor/panels/aiChatPanel.ts).
See [publication boundaries](editor-observability.md#p3-owner-bound-publication-2026-09-07)
and [verification commands and limits](testing.md#p3-ownership-and-stale-base-verification-2026-09-07).

## Map-scoped conversation archive (2026-09-08)

This supersedes the older 50-record retention and current-config mirror notes below.
`src/ai/conversationStore.ts` retains conversations in IndexedDB `oprn-ai-records`
v2. `listConversations` still returns the latest 50; `evicted` is always zero.
The existing 2,000-character argument and 200,000-character transcript budgets
remain. This is a retained, possibly compressed transcript archive, not a promise
of original uncompressed text or a new model-memory system.

- `queryConversationArchive({projectContextKey, mapId?, unknownOnly?, query?, offset?, limit?})`
  returns `{records, total, hasMore, durable}` with deterministic savedAt-desc/id-asc
  order. Scope is mandatory; `null` explicitly selects legacy unscoped records.
  Search covers title and preview. Map filtering returns whole conversations.
- `loadConversationForScope(id, projectContextKey)` returns the whole retained
  record only for that scope. Continue using its original id and all its entries;
  map navigation does not establish a new session.
- `deleteConversationForScope(id, projectContextKey)` returns `{durable}` and
  atomically writes a project-qualified tombstone alongside deletion. The legacy
  global clear tombstones all currently known records, including migrated rows.
  Late local saves, legacy re-imports and explicit remote imports cannot resurrect
  them. Deletion is browser-local, not cross-device LegacyDb deletion.
- Archive summaries carry `mapIds`, `viewedMapIds`, `targetMapIds`,
  `mapAttribution` (`complete | partial | unknown`) and `transcriptCompacted`.
  Associations are collected before compaction from structured user context and
  direct `mapId`/`toMapId` or known `a`/`b` endpoint fields only. Names, prose and
  unrelated nested objects are not evidence. Old rows normalize lazily; malformed
  metadata is re-derived, never assigned to the open map. Continued compacted
  records preserve already indexed maps but may report partial attribution.
- `hydrateConversationArchive({projectContextKey, signal?, isCurrent?})` explicitly
  reads all remote pages of up to 100 rows, validates destination/scope/body and
  imports locally without mirror writes, model calls or wiki extraction. It
  returns `{imported, skipped, rejected, durable}`; `rejected > 0` is incomplete
  recovery. Capture one immutable full stored-value baseline after legacy migration,
  before the first GET, for the entire recovery operation. Inside the existing
  readwrite transaction, import an absent ID only if still absent, or replace an
  unchanged preexisting local record only when the validated remote timestamp is
  strictly newer. Concurrently created/changed entries (including equal-ms nested
  text, title, model and map provenance), foreign collisions and tombstones are
  skipped. Memory-backed baseline records are cloned by value. No per-page baseline
  refresh and no network-held transaction. This is explicitly authorized timestamp
  replacement, not lossless reconciliation of divergent older copies. Pass an abort
  signal and a live panel/project/conversation ownership check; close/project switch
  and view changes invalidate pending admission and UI callbacks. Transport/storage errors reject instead of masquerading as
  empty success. Already imported pages remain if a later page fails or aborts.
- Save captures the remote destination before awaiting local persistence. New
  outbox payloads store only `destinationProjectId`, never credentials; old payloads
  may derive a destination only from explicit `remote:<id>` scope. Ambiguous old
  payloads fail visibly and remain queued. Remote `entries_json` remains an array;
  no remote schema migration is required.

Memory fallback truthfully returns `durable:false`; browser storage removal also
removes tombstones. Existing local title/start-map scope keys can collide and do
not imply collision-proof project identity. Archive queries currently scan local
records; offset-based remote pagination is deterministic on a stable remote set,
not a transaction snapshot of concurrent remote writes. Repeated recovery is safe.
Tests: `mapConversationStore`, `conversationStore`, `mapConversationRemote`,
`historyRecoveryAdmission`, `aiConversationRemoteHistory`, `projectWikiHistorySources`.
The recovery race regressions exercise native IndexedDB transactions and the memory
backend. Browser/live remote evidence is lead-owned.

### Editor history surface

The existing assistant clock (`ai-open-conversations`) opens the same history
modal, initially filtered to the current map. Its visible clock glyph also exposes
`ai-map-history-open`; this is not a second toolbar button. The modal offers
current-map, whole-project and unknown-attribution filters, explicit map choices,
search, pagination and manual remote recovery. Known deleted-map IDs remain
selectable rather than becoming unknown.

Project views use the captured project scope. Opening a result restores its original
conversation ID and all retained entries. Earlier turns can remain visually
collapsed using the existing turn toggle; they are not discarded. Browsing history
and navigating A-B-A do not reset the live project conversation. Project changes
and modal closure invalidate outstanding requests and restoration callbacks.
Ordinary Open is local-only and never imports or selects a remote timestamp. Each
Open click owns a distinct selection generation in addition to the view generation;
a retired read cannot adopt or paint an error even when it settles before the newer
selection. Owned recovery failures refresh usable local rows while retaining the
error. Outgoing live-conversation checkpoint saves remain separate and unchanged.
The initial catalog-to-list continuation retains its starting generation and live
modal ownership: a delayed startup cannot retire a newer explicit Recover or clear
its status. `aiConversationHistoryStartup` covers this ordering and normal startup;
`ai-map-history.spec.ts` exercises it through the shipped clock and Recover with
an offline response fixture and real browser IndexedDB transactions.

The separate unscoped legacy view (`ai-history-filter-legacy`) queries with a
null repository scope and expands retained text read-only. It does not adopt a
conversation, delete records, recover remote records, or resolve unowned map IDs
through the current project's names. Entering it immediately removes old scoped
actions and invalidates pending scoped opens, including a round trip back to a
project view. Retained detached controls cannot bypass the read-only transition.

Recovery reports transport errors instead of an empty success; deletion removes
the whole conversation from every local map view and explicitly remains
browser-local. Compact/partial provenance and memory-only storage are disclosed.
Contracts: `aiConversationHistoryModal`, `aiChatSessionScope`,
`test/e2e/ai-map-history.spec.ts`. Real local, remote and visual evidence lives under
`output/evidence/map-ai-history/`.
The browser harness selects visible entry alternatives and joins navigation and
readiness immediately, so a hidden alternative cannot mask a visible entry and
a readiness rejection cannot escape while navigation is pending.

## Independent result review and repair (2026-09-06)

This supersedes older same-conversation review/9-write-threshold and unreviewed
milestone-application descriptions below. `independentReview.ts` builds a fresh
system/user request through the existing authenticated `ChatFn` transport. It has
no writer transcript, writer success prose, streaming callbacks or executable
tools. A single whole-response Markdown fence (optional `json` label) is
normalized before JSON parsing; surrounding prose, partial/multiple fences and
other language labels are rejected. This matches an observed authenticated
Gemini HTTP 200 response, not only the original unfenced fixture. Any returned
tool call, malformed/inconsistent JSON, stale revision,
truncated response or transport error stops without approval.

`AssistantSession` reviews every completed write batch, including direct/lite
and autonomous work. No-write questions and ask turns do not invoke it. Authoring
turns with zero successful writes still run the existing acceptance/completion
checks: bounded repair attempts end in an error, never a success publication, if
those requirements remain unmet. The
supervisor receives the original request, complete original/current projections
from `originalContext.ts`, actual changed values, tool results, draft acceptance
and available executable/image evidence. Duplicate read-credit receipts are not
sent twice. Oversized complete evidence is an explicit window error, not a
truncated review. Asset transport changes that lack a reviewable projection are
explicitly blocked; their omission never earns approval. `Project.session` is the
authored `ProjectStartState` seed (`startStateOf(project)`), not a live `PlaySession`.
Its party, inventory, gold, flags and farm starts are reviewed as exact before/after
values, alongside authored test presets. No live scene session is read.

Verdicts echo `revision` and contain `verdict`, `summary` and structured findings
(`id`, `target`, `problem`, `requestedChange`, `validation`). Findings go back to
the writer on the same draft; fresh record reads and all existing write gates
still apply. The repaired revision gets another isolated review. Reviews consume
the same round/output budget. Repeated unchanged failures stop; distinct failures
also stop at the existing three-attempt repair cap. Cancellation and reviewer
errors never count as approval. Writer success streaming is withheld on editing
turns; only the reviewed conclusion is published as the changed result.

Required current rendered map coverage and failed/stale explicit scene,
walkthrough or other verification evidence cannot be overridden by an AI pass.
Declared verification tools must actually pass. Pure record/dialogue edits do
not invent placement-image prerequisites. Used-tileset render dependencies
(`tileSize`, `tilesPerRow`, `image`/`tileGrafts` and uploaded atlas bytes via
`tilesetVisualContent` in `mapVisualEvidence.ts`) also require fresh
`show_map_region` coverage for maps that reference the changed tileset, even
when the map object itself is unchanged and `targetMapId` is null. Unused
tilesets and nonvisual tileset metadata (name, passability, terrain, kind) do
not invent that gate. Background refusal and `visualFingerprint` stale-image
retirement stay as before. Contracts: `assistantTilesetVisualReview`,
`mapVisualTilesetDependency`, `assistantBackgroundReview`. The acceptance ledger evaluates the
draft privately for review without labelling it applied; applied-state acceptance
and remote persistence receipts remain separate. Advisory lint results are sent
as evidence, not promoted to an unconditional baseline-breaking gate.

`toolImageEventSprites.ts` adds authored event charset visuals to map-region
images using the shared frame, transparency, scale and footprint helpers.
This is an authoring preview, not a simulation of active page conditions:
identical visible page states share one sprite, and a sole visible graphic on
a later page is still depicted. Distinct visible page graphics, priorities or
footprints cannot be represented by this single frame and explicitly raise
`map-event-rendering-unavailable`; unsupported assets do the same. Neither
case issues a tile-only image receipt. Background rendering unavailability
also remains an observable error. Contracts: `toolImageEventRender`,
`toolImageEventAcceptanceSession`; `scripts/evidence-event-visual-render.mts`
captures pixel changes for movement, graphic selection and later-page visuals.

Grafted tileset atlases used by `show_map_region` / `toolImageCanvas` require a
complete bake bound to base URL, geometry (`count` / `tileSize` / `tilesPerRow`),
and the **canonical complete active graft tuples** (every rendering field:
`targetTile`, `sourceChipset`, `sourceTile`) before a reviewable image is
returned. Ready and in-flight evidence cache keys use that exact identity — not
a short texture-suffix hash — so distinct compositions cannot share a bake or
authority. While pending, evidence schedules the bake and fails closed
immediately with `tileset-graft-rendering-unavailable` (no Session hang on held
I/O, no base-atlas receipt). Missing/failed sources stay unapproved. Ordinary
editor `tilesetImageUrl` may still show the transient ungrafted sheet until bake
completion. Contract: `toolImageGraftReadiness`.


`TurnResult.review`, `result_review` events and `HarnessSnapshot.resultReview`
expose the outcome. `isDraftReviewApproved(project?)` checks the exact current
revision and cancellation state; mutation/undo cannot revive invalidated approval.
Milestones are batched until approval, then use the existing commit/undo/persistence
path. `aiTurnRunner`, the direct proposal host, cluster acceptance and region
application reject unapproved/budget/cancelled drafts, even when successful
writes remain in the proposal ledger. Evaluation retains draft measurements and
review evidence, but an unapproved solver result cannot pass the task.
The real proposal-host and autonomous apply boundaries call `rebaseProject` after
successful application; clean pre-turn store sync does the same. Rejecting a later
draft and starting an unrelated request therefore restores the latest applied
baseline, not the initial conversation project. Both paths have regression tests.

Region clipping and seam preparation run through `setReviewDraftTransform` before
review. Repairs and rerenders see that prepared draft. Later clipping, partial
application, schedule edits or room rerolls cannot borrow its approval; a changed
candidate needs another reviewed request. Region/cluster writers retain their
lite configuration while reviews use the configured supervisor endpoint/model.

Focused contracts: `independentReview`, `assistantIndependentReview`,
`assistantAcceptanceSession`, `assistantVisualEvidenceSession`,
`assistantTilesetVisualReview`, `mapVisualTilesetDependency`,
`assistantBackgroundReview`, `aiTurnAppliedAccounting`, `regionTaskRun`. Existing `chat` injection remains the
real-surface-friendly deterministic transport seam, not a production bypass.

## Combined P2 and independent-review ownership (2026-09-07)

P2 scheduling, canonical requirements and delivery are composed with independent
review, not alternatives to it. `evaluateForReview` receives the current exact
verification store while keeping applied acceptance private. Only active required
items become requirement findings; optional/withdrawn items retain their original
failed evidence without becoming new review blockers. An exact reviewed candidate
can carry its current checks through application, including synchronous store
subscriptions; changed content still retires proof. This never renews apply authority.

Every public send retires the previous review owner before preparatory awaits.
Previously reviewed, unchanged content may remain in the detached draft for the
next request, but requires fresh review before application. Questions retain pending
drafts without invoking review or replacing their answer with a draft error. A host
new-goal action also resets the review baseline, original-context snapshot and read
credits before awaits, so a failed entry followed by resume cannot borrow the old
goal's originals. Successful apply consumes live approval while preserving its
recorded revision in the returned historical result. Apply rejection retires it too.

Review rejection/repeated repair stops project `blocked`, reviewer errors project
`failed`, and review round/output limits project `budget-exhausted`. Boundary
exceptions settle the current returned error handle and cannot make its remaining
calls authoritative. No-write unmet authoring requirements still fail closed after
the bounded repair loop. Regression: `assistantP2ReviewIntegration.test.ts` plus
retained authored-baseline, consumed-approval and P2 owner/continuation suites.

QA transports must recognize the machine `kind: "independent-review"` payload
before handling zero-tool planner/intent requests, then return a revision-bound
review verdict. The frozen upstream `ai-harness-p2`, `ai-harness-r1-ask` and
`ai-harness-r21-new-goal` browser adapters do not yet distinguish these requests.
Their visual writes also need actual current `show_map_region` evidence; an
approval-shaped reply cannot bypass coverage. They use remote QA project writes
and must only run with explicit isolated QA setup, never against user projects.

## P2 run outcomes and user scope actions (2026-09-06)

The session publishes three independent facts, not a single completion badge:

| Axis | Values | Meaning |
| --- | --- | --- |
| `execution` | `response-final`, `awaiting-user`, `blocked`, `cancelled`, `budget-exhausted`, `failed` | Actual execution decision; `response-final` means the response ended, not that the goal passed. |
| `goal` | `unassessed`, `incomplete`, `satisfied` | Canonical acceptance: null, assessed but not verified, or verified. |
| `delivery` | `no-change`, `draft`, `applied`, `persisted`, `persisted-verified` | This run's pending/applied work and accepted save/current proof. |

[runOutcome.ts](../src/ai/runOutcome.ts) exports `RunOutcome`, `RunOutcomeFacts`
and `deriveRunOutcome(facts)`. The pure function returns a frozen value from
`execution`, `acceptance`, `hasPendingDraft`, `hasApplied` and `persistence`
(`none | accepted | verified-current`). It owns no evidence or evaluator.
Pending draft takes precedence over earlier applied milestones; otherwise no
applied work means `no-change`, then current proof, accepted save and actual apply
select the remaining delivery states. Applied work includes owned coordinator wiki
writes, even without tool calls. Both pending and applied call collections
survive this display precedence. Only authorized pending calls are candidates for
application; proof retry doesn't replay already-applied tools.

[AssistantSession](../src/ai/assistantSession.ts) owns the normalized facts.
`getRunOutcome(): RunOutcome | null` is read-only and returns null before a result
exists. It rechecks live receipt and assessed-revision freshness without saving,
proving or changing canonical evidence. Actual settlement updates the original
`TurnResult.runOutcome`, recap and `{ type: "run_outcome", runOutcome }` event.
`getHarnessSnapshot().runOutcome`, bridge send results and serialized activity
carry the same settled projection. See [publication boundaries](editor-observability.md#p2-outcome-publication-2026-09-06),
including legacy omissions and historical-record limits.

P1 remains the save/proof authority: this run's actual apply and correlated flush
receipt can establish `persisted`; only its current passing proof establishes
`persisted-verified`. `commit.persisted`, an old global receipt and model flags
can't establish delivery. Failed or stale proof retains accepted persistence.
Cancellation doesn't roll back applied milestones. Fresh sends clear prior applied
delivery before fallible context/intent awaits; Ask also clears delivery ownership,
not the retained goal evidence. Trusted continuation retains already-owned delivery.
Auto-apply, undo, separate region approval and advisory checks keep their policies.
Outcome projection never grants independent review approval: both apply paths still
require the exact current reviewed draft, live authored baseline and live owner.

Retained cancelled pending work is session context, not current Ask proposal
authority (R1, 2026-09-07). Explicit Ask and model-declared questions, including
questions inferred under Plan, publish `proposedCalls: []` and set the outcome
fact `hasPendingDraft: false`; the question doesn't claim the draft as delivery.
The internal proposal map and detached project remain available for an authorized
Do/resume. `syncBaselineFromStoreIfClean` still refuses to discard that draft.

`maybeAutoApplyMilestone` refuses Ask at the shared acceptance-milestone boundary.
The runner also blocks ordinary application in explicit host Ask even if an
executor supplies calls; inferred questions rely on session normalization and
publication, not host mode alone. Explicit Ask owns publication before fallible
preparation too. Authorized Do/resume still applies the pending work once without
replaying its tool, and real undo restores the pre-draft project. See the
[R1 regression and native scenario](testing.md#p2-r1-retained-draft-ask-2026-09-07).

### Canonical requirements and genuine user actions

`WorkPlan.requirements?: readonly AcceptancePromise[]` and
`WorkItem.requirementIds?: readonly string[]` reuse the existing ledger. Definitions
are `{ id, title, required?, criteria }`, with required defaulting true. Existing
explicit `acceptance` is still assessed without either new field. When both fields
reuse an ID, acceptance is adopted first and later definitions can't weaken it.
Bare scheduler plans without an assessed contract remain unassessed; inferred
missing-spatial-contract repair remains fail-closed. Malformed declarations are
repair obligations, not satisfied legacy plans. Item links don't own requirements:
skip, replan or dropping every link can't erase an adopted obligation.

Only active required items enter the canonical denominator. Optional skipped work
can remain unverified while the required goal is satisfied. Withdrawal also changes
that denominator, not the item's observed evidence or status. Original IDs, target
bindings and per-request pre-write baselines remain. Runtime-owned `source` records
`requestId`, normalized original user `text`, and host `scope` (map ID plus
`{ x, y, width, height }`, or null). Model source/evidence/withdrawal claims grant
no authority. Structural criterion regions still use `{ x, y, w, h }`.

`session.withdrawRequirement({ acceptanceId, requirementId, reason }, onEvent?)`
is synchronous and returns boolean. Stale goal IDs, missing/already-withdrawn items
and blank reasons return false. Success retains the original source and evidence,
adds `{ acceptanceId, requirementId, reason, source: "user" }` withdrawal metadata,
and publishes acceptance/outcome through the session's existing seams. The local
`withdrawAiRequirement(action)` bridge export delegates to the current idle,
non-disposed Panel host. It isn't an HTTP/MCP command, window API or LLM tool.

The sticky's real `ai-requirement-withdraw` button carries `data-requirement-id`
and submits the displayed acceptance ID, item ID and user-exclusion reason. Busy
or withdrawn actions disable; verified items need no exclusion action. Original
request and withdrawal reason remain in the disclosure. The terminal outcome node
is outside folded transcript history, above the composer, with test ID
`ai-run-outcome` and `data-execution`, `data-goal`, `data-delivery`. Korean labels
keep response ending separate from goal satisfaction.

Questions preserve blocked items, retry counters and relevant goal evidence,
including after read-only tools or refused scheduling mutations. Explicit host
`SessionTurnOptions.goalAction: "resume"` or a manual continuation token outside
Ask authorizes reactivation only after the intent decision. The existing
`ai-continue-run` button is available for blocked work as well as budget stops;
its click passes `AiRunSurface.sendText("계속", undefined, { userResume: true })`.
Only that UI action changes both Panel mode ownership and the displayed composer
to Do. Typed, bridge and ordinary RunSurface continuation text in Ask stays Ask.
Synthetic driver continuation and model intent claims aren't new authorization.
A resumed read-only run with unmet required work still ends blocked/incomplete/no-change.

Host `goalAction: "new-goal"` archives the prior immutable canonical snapshot at
public send entry, before context/image, wiki or intent awaits. Archival does not
re-evaluate the retired snapshot or rewrite its original result. The new owner has
no assessment until canonical adoption/evaluation; failed or cancelled entry stays
unassessed, and repeating a failed entry does not archive the same old goal twice.
At that same boundary, `rebaseProject` retires pending calls and their detached
project payload, before preparation can fail or cancel. Store-backed sessions use
current applied store content; detached sessions use their own accepted baseline.
Already-applied content survives, but a later resume or disjoint write cannot carry
an old goal's abandoned draft. Unreviewed current-owner proposals from errors remain detached
until a subsequent authorized run independently reviews the exact current draft.
An error result with already-current independent approval retains the ordinary apply
path, including P3 owner/base rejection and undo. Regressions:
`test/aiNewGoalDraftRetirement.test.ts`, `test/aiApprovedErrorComposition.test.ts`.
Its request text, scope and pre-await baseline are retained for a later host resume.
`getAcceptanceHistory()` returns session-local frozen history, not durable recovery.
Explicit composer Ask overrides this action; model question/source/reset claims do
not undo host new-goal ownership or authorize retirement on their own. Ordinary Ask
retains the active goal's assessment, and a same-goal failure can legitimately remain
satisfied. Regressions: `test/aiNewGoalEarlyOwnership.test.ts`.
Exact tool-verdict requirements reuse [the existing verification store](editor-ai-tools.md#p2-requirement-and-exact-verdict-inputs-2026-09-06).
[P2 evidence index](../output/evidence/ai-harness/p2/README.md) distinguishes producer
verification, independent surface evidence and pending lead gates. This section
records implemented contracts, not Phase approval or checkpoint/boot recovery.

## User-confirmed interaction approach correction (CR-P7-1, 2026-09-08)

The existing checklist offers `접근 보정 검토` only for a live AI-declared canonical
`run_scene_test` with complete map/event ownership and a current failed named
selection. This bounded release supports the first interaction after nonmoving
setup/assertion/facing/snapshot steps, a same-map fixed action event, and no earlier
activation. The host inserts one native adjacent `walk` (which also faces the target).
Unsupported shapes remain blocked; no movement equivalence or model amendment tool
was added. Review exposes the original recipe/initial state, exact insertion, all
original assertions and effective args. A separate `이 접근 보정 승인` click uses the
idle, live panel/session boundary; approval alone is unverified.

`ToolVerificationEvidence` appends `approaches` (revision plus user confirmation) and
`resolutions` (original check, authorized revision, fresh attempt). Original args,
request/baselines, siblings, findings and attempts survive. `correct_verification`
requires that original check ID and exact approved args against applied content;
all remapped map/event receipts, original initial state and assertions must pass,
with zero event activations during the inserted walk. Ordinary/pre-approval passes
cannot supply credit. Writes/undo stale proof; unrelated findings remain obligations.
Snapshots expose these links through normal verification results and the read-only
harness. Pending previews expire on a new turn, write or owner replacement.

Encounter-capable maps are unsupported (CR-P7-1-R1): native battle/troop events do
not appear in scene interaction receipts. Preview and approved execution inspect
current content: positive rate plus legacy troops or a positive-integer-weight
entry in the overriding nonempty table blocks authorization, even if conditional.
No initial-position/condition snapshot or old approval licenses later encounters.
At 1024px, collapse chat, expand the checklist and review/confirm normally; the
recorded-wire browser regression clicks both controls there, then restores chat.

There is no private-ledger persistence/recovery. Historical P7 remains blocked.
A fresh session reproduces and validates only the prospective amendment path; its
baseline cannot prove P7's earlier floor edit. Physical saved-game and actual-provider
proof remain separate. Regressions: `test/approachCorrection.test.ts` and
`scripts/qa/p7-approach-correction.mjs` (explicitly recorded-model HTTP responses,
normal file import/checklist/dispatcher, isolated app, all external writes fenced).

## Live large-world QA: plan repair and final audit (2026-09-07)

The actual 128x128/six-region/eight-landmark run initially produced 19 independent
items, then generator `set_work_plan` collapsed them to five aggregate items after
a tool mismatch. `repairWorkPlan` now retains every existing item ID, completed/
skipped state, notes and current-item evidence during in-loop repair. Adding a distinct
verification declaration to a done item reopens that item's verification, without
removing its prior owned checks. Unchanged declarations retain their proof owner. Missing or
duplicate IDs reject the replacement atomically. Pending instructions/tools,
regrouping and additions remain editable; main-planner adoption owns new goals.
Orchestration and Ralph context expose the actual current `itemId`.
Required verification tools cannot be removed during repair or skipped; a
`run_lint` requirement cannot become `get_project_summary` after lint fails.

P2 compatibility keeps `requirements` adoption alongside legacy `acceptance` on
these identity-preserving repairs. New declarations reach the same canonical
ledger; original obligations cannot be overwritten. `requirementIds` remain
editable scheduler links even on done/skipped items, without resetting their
progress, tool evidence or authoritative obligations. Plan repair is a Do action;
Ask cannot mutate scheduling. Regression: `aiWorkPlanRequirementRepair`, alongside
unchanged required-outcome and question-dispatch assertions.

The same run exposed a reporting split: live final messages correctly said
incomplete, but the latest audited message still contained the model's raw success
claim. `finishRunRecap` now appends its authoritative final text when it differs.
Bridge/history consumers therefore receive the same final verdict as the panel.
`getHarnessSnapshot().acceptance` exposes structured completion state; bridge
`ok` only means the RPC completed, not that the authored goal was verified.
Failed final verification replaces a model success claim rather than appending
contradictory failure text below it.
The PR687 adjudication retains bounded final repair, driven by adopted pending,
unverified or stale requirements and genuine unresolved findings, including findings
without an acceptance declaration. The narrow pre-write lint exception below separates
reported baseline defects from terminal blockers. Successful unadopted exploratory probes never
create rerun obligations after a write or dummy removal. Malformed/execution failures
remain attempts, with only the narrow unowned assertion-free no-target setup exception.
Questions report retained verification negatives without executing repair or changing
scheduling; normal execution and budget-terminal assessment cannot
publish false completion. Budget exhaustion does not grant extra tool calls.
Run-end proof waits for authoritative blockers to clear. An unfinished declared
verification item (including pending scope or current passed proof) cannot be skipped:
rejection preserves plan position, acceptance, requirements, findings and proof. Ordinary
optional/non-verification skips remain usable. Regression: `pr687VerificationIntegration`.
Before preparation or model writes, the host runs the same read-only lint producer against
its pre-write project baseline once per goal. Rebase, repair and continuation never replace
that provenance. An automatic default `run_lint({})` finding can be report-only only when its
complete error records (including code, message, referenced IDs/locations and multiplicity)
were present in that baseline, it has never been observed explicitly, and no active lint
requirement owns the check. Unknown/incomplete provenance, new identities (even at equal
counts), explicit negatives and adopted checks still block. Findings are retained; no pass is
invented. `CompletionAssessment.verification` reports all problems while `blockingVerification`
is the terminal subset. Report-only lint is appended to the completed response and remains in
audits/snapshots without a repair loop. Regression: `advisoryLintProvenance`.
With an isolated write draft, canonical blockers enter the independent review's
required problems and structured repair loop; even a model approval cannot override
them. Without a write draft, bounded acceptance/completion repair owns recovery.
Neither path applies a milestone before independent approval. Declared BuildSpec
placement uses the current native applied-plus-pending ledger, including valid
unchanged maintenance cells. Generic proposal heuristics and all tool diff warnings
remain separate `completionWarnings` in the complete reviewer envelope; they are
not a new unconditional gate on unrelated authored record types. Writer and reviewer
image inputs each require their own provider delivery acknowledgment. A writer's
acknowledgment cannot prove delivery to the independent reviewer.
Regression seams: `nonHistoryIntegrationSeams`, `assistantIndependentReviewCapacity`.
Stale-check feedback includes the exact canonical tool/argument identity. A new
check of guide cells does not silently replace an earlier frontage check; the
executor can see which original coordinates remain pending after compaction.

`paint_tiles` is active again: replacing it with semantic `fill_region` removed
numeric-tile rect/line/cell painting, leaving planned snow terrain impossible for
the executor even though the primitive existed. The planner's canonical tool
list now uses active tools, not hidden legacy names. Spec, read and house-protection
gates still apply to raw painting.

Explicit autonomous/max settings now retain the saved reasoning effort during
execution. Balanced retains its existing fast executor policy. This honors the
chosen setting; it does not remove execution budgets or force high effort over a
manual override.

An image-review crop must also cover the request's actual tile/stack changes and
changed event positions, measured against the immutable request baseline. New or
resized maps require whole-map review. The effective rectangle appears in evidence
so the model can request missing images; an unchanged local inspection stays local.

Regression seams: `workPlanIdentity`, `assistantFinalAudit`,
`assistantAcceptanceRequestBaseline`, `assistantProposalAssembly`. Live evidence
is under `output/evidence/live-world-qa/`; do not mistake saved partial output for
completed content.

## Assistant control audit fixes (2026-09-07)

- Composer menu, preference and context popovers use `anchoredPopupPosition` and rail-relative coordinates; the glass deck establishes a containing block, so viewport `fixed` coordinates are not interchangeable. Open content/deck resize and viewport/scroll changes reposition the popup. Dispose removes observers/listeners. Suggestion content stays in normal flow.
- Full history is a visible toggle: both menu variants update their label and `aria-expanded`. Collapsing history returns to float before hiding the deck; entering studio removes the history CSS class before reparenting. Preserve the separate studio log-mount state without leaving both surface classes active.
- Export actions call the shared export operation, not a disabled hidden button. Empty export shows feedback; the native hidden-button disabled contract remains intact. `aiEmptyExportFeedback.test.ts` uses real DOM semantics because FakeDom.click does not enforce native disabled behavior.
- A saved/user-resized width overrides the idle compact default. `aiChatResizeChrome` observes the actual deck width to keep separator ARIA values correct through focus, viewport and animated size changes.
- Studio splitters persist expanded `--studio-scenes-col` / `--studio-chat-col` values. Collapse classes own effective `--studio-*-w` tracks at 52px; never write the effective tracks inline or collapse loses the CSS cascade.
- The mounted panel registers settings bindings with `registerAiSettingsPanel`. Every settings opener receives the same font root, live-session/model/effort callbacks and temperature section; explicit standalone caller options remain supported. Panel teardown unregisters ownership and closes its settings.
- Settings/history use scoped `installAiModalFocus`: live Tab boundaries exclude hidden/inert/disabled controls and yield to newer modal layers. Closing restores the attached opener. Settings saves can replace the topbar button, so that one stable entry resolves its replacement; other detached openers remain unfocused. Nested custom-select Escape continues through the existing modal stack.
- Regression surfaces: `test/aiPanelChrome.test.ts`, `test/aiEmptyExportFeedback.test.ts`, `test/e2e/ai-ui-audit-fixes.spec.ts`; original findings remain in `docs/qa/2026-09-06-ai-assistant-ui-audit.md`.

## World structure activity labels (2026-09-06)

`author_world_bridge` and `author_world_mountain` explicitly use the world activity
family in `aiActivityNarration.ts`. They must not fall through the `author_` prefix
rule, which describes story authoring. The live panel's `ai-activity-live` row and
the map ghost label consume the same narration function. The registry-wide
`aiActivityNarration.test.ts` contract requires an explicit classification for
every registered tool; adding a tool requires checking this contract too.

## Multi-map construction specifications (2026-09-06)

`AssistantSession` owns one `Map<mapId, {spec, turnIndex}>`; `getActiveSpec()`
remains the most recently confirmed/expanded compatibility view and
`getActiveSpec(mapId)` reads one explicit map contract. Successful writes expand
only their target map, after the runner succeeds. Invalid submissions, rejected
writes and throws do not evict or expand any other map. Implicit selection and
its expansion remain turn-local. Historical carryover snapshots and one-warning
tracking are keyed by map, not by the last displayed blueprint.

`getCompletionSpecs(calls)` is shared by session auto-completion/review and
`aiTurnRunner`. For each changed map it selects current explicit spec, then
current implicit selection, then historical carryover, then eligible active spec.
It consumes applied plus pending calls for accounting, never for reapplication.
`proposalCompletenessWarnings({buildSpecs, calls})` evaluates all selected specs,
qualifies missing assets by map ID, and runs generic heuristics only once. The
legacy `buildSpec` input remains supported. The panel no longer maintains its
own confirmed-spec completeness cache. Blueprint display remains a latest-spec
compatibility surface, not another construction-contract owner.

Successful map removals prune contracts before an ID can be reused. A successful
`reset_project` clears all contracts (including reused start-map IDs and future
plans); failed removal/reset does not. Ordinary rebases retain surviving maps and
never-created `plannedMap` contracts. Resetting goal acceptance does not reset
construction specifications. The NPC fallback selects all current-turn specs,
not historical NPC plans or only the latest map.

Same-layer terrain/road overlap is allowed only with explicit `buildOrder` that
lists both kinds and places `terrain` before `road`. Road-road crossings need no
order. Missing/reversed/incomplete order, terrain/house overlap, and arbitrary
same-layer terrain/terrain intersections or duplicates remain invalid. Declare
actual roads as `kind:"road"`; IDs, style and material labels never infer kinds.
`overExisting` only concerns existing map content, not new-plan intersections.
This does not authorize overwriting existing structures, water, or completed
houses: all existing protection gates still run.

**Overlap diagnostic repair (2026-09-07):** `validateBuildSpec` emits
`spec-new-plan-overlap` for new-plan intersections, `spec-existing-content` for
placement requiring an existing-content policy, and `spec-destroy-confirmation`
for unconfirmed destructive clear. Other validation errors retain the session's
`spec-invalid` fallback. `applyBuildSpec` preserves these codes through tool
events, audit `issueCodes`, and model JSON. Recovery is code-selected, not matched
against localized messages or asset IDs: overlap-only failures receive declared
kind/order and nonoverlapping partition guidance, never an `overExisting` repair.
Mixed failures also retain the actual existing-content remedies. Discard advice
does not replace these cause-specific instructions.

Failed tool `data` exposes `{rejections, repeated, discarded, recovery}`;
`recovery` contains `newPlanOverlap` and `remedyFields`. The same selectors choose
the guidance. The generic `spec-invalid` guidance issue remains on every rejected
submission so alternating failure classes cannot reset the aggregate target
retry count. Three spec rejections still trigger discard guidance; the separate
four-failure work-item retry bound and dependency deferral accounting are unchanged.

`test/buildSpecOverlapRecovery.test.ts` covers code propagation (including changed
diagnostic prose), mixed conflicts, repeat/discard/reset and retry accounting,
the accepted ordered terrain/crossroads tool sequence, and unchanged protection
and geometry boundaries. `test/fixtures/buildSpecOverlapPlans.json` is the exact
parsed set_build_spec input from the four archived Round9 attempts: still rejected
with 5/5/5/7 validator errors. The archive itself is untouched. This is an existing
repair-path improvement, not a terrain-material/passability proof or a guarantee
that a subsequent P1 generation will succeed.

Regression: `assistantMultiMapSpec`, `aiTurnAppliedAccounting`,
`aiCompletionAccounting`, `assistantMapPreservationGuard`, `aiSpecGateHardening`.
Evidence: `.omo/evidence/assistant-audit-pr/maps/`.

## Plan authoring has no small-plan quota (2026-09-06)

`workPlan.ts` no longer recommends 8 todos, 4 items for a village, fixed layer
counts or 200-character instructions. Independently executable/retryable/verifiable
results remain separate items; layers group them without reducing the requested
scope. Large plans are permitted, not padded with invented work.

Planner and `set_work_plan` retain complete goals and item fields. Emergency
fallbacks retain the full original request rather than its first 400/600/800
characters. Current instructions and remaining titles are not locally shortened
when presenting the plan to the model. Declared volume is no longer capped at 50;
negative/nonfinite values retain their existing boundary normalization.

Execution budgets, user abort and repeated-failure guards are separate and remain
in force. Provider context/output capacity is still a transport constraint, not
permission to shrink the authored plan. `test/workPlanSize.test.ts` covers 320
independent items, complete parsed payloads and declared volume above 50; prompt
prose is reviewed rather than pinned by string tests.

## Acceptance sticky note (2026-09-07)

`aiStickyChecklist.ts` is a body-mounted projection of backend
`AcceptanceSnapshot`, separate from ephemeral work-plan/book chrome. P2 adds only
the scoped user withdrawal action described above; the ledger still owns assessment. The runner
forwards acceptance events only from its current non-aborted owner and publishes
the backend terminal snapshot after the existing `ownsTurn(true)` finalization
guard, so abort retains blocked evidence without reviving retired conversations.
The panel's store subscription refreshes retained acceptance on edits/undo; new
chat, history/rewind, project/reset and teardown clear the note. No snapshot is
written into project data or conversation history. Native keyed details/buttons
retain open/focus state; navigation resolves actual maps via `focusEditorRegion`.
The note defaults to compact at every viewport. Inline activity stays current while
collapsed. Only non-withdrawn required items enter the numeric fraction and its
`requiredCount`/`verifiedCount` datasets; zero required hides the fraction. Separate
`optionalCount`/`withdrawnCount` datasets describe the folded optional/withdrawn
groups. Active required working/blocked rows precede verifying/pending rows;
required verified rows have their own initially folded group. Every row retains
its backend status, including genuinely verified optional items. Keyed rows preserve
native disclosure and focus on regrouping; a destination group opens only when
needed to keep a focused row accessible. Blocked reasons are in the row summary;
source, evidence, and the user-only withdrawal action remain in details.

`hide()` keeps the note attached and receiving snapshots/activity/busy updates;
`show()` reopens the same snapshot and focuses its toggle. `hasSnapshot()` is the
panel's refresh/availability seam, independent of visibility. Both AI action menus
share `showAcceptanceChecklist`; their reopen entry is hidden without a snapshot
and disabled while the note is already visible. Hide restores the visible header
menu opener, falling back to the composer input. A new acceptance ID resets hide,
expansion, position, and disclosures. Clear/dispose cannot reopen retired evidence.
Project changes retire the outgoing turn before asynchronous history adoption so
late acceptance cannot remount the previous project's note.
Manual saved-history adoption also retires the outgoing turn before dropping its
session: it shares the new-chat abort/owner invalidation, queue discard, and
busy/progress settlement. The selected record is retained and immediately usable;
late live events and terminal snapshots cannot remount the old checklist or drain
old queued sends into the restored conversation. `aiStickyChecklist` exercises
the real history opener/search/open controls, with terminal assertions synchronized
to the runner's terminal activity record rather than the transport's return.

Pointer drag uses the existing drag button with pointer capture and session-only
position, clamped against measured `--editor-left-safe`, toolbar clearance and the
viewport. Pointer up/cancel/lost capture, hide, clear, and dispose end the gesture;
resize re-clamps a moved visible note. Styles: `assistant-sticky-checklist.css`.
Tests: `aiStickyChecklist`, `aiWorkPlanTerminalFocus`, `aiRetryWorkPlanLifecycle`.
Viewport listeners are optional, matching the panel's existing
headless DOM contract. The PR637/638 integration exposed twelve
`aiChatSessionScope` failures from eager `window` access; the viewport guard
restores those contracts without changing browser checklist ownership.

### Session-owned acceptance contract

Live request coverage (2026-09-07 followup): `createLlmIntentDeclarer` now performs
an independent `REQUEST_COVERAGE_AUDIT` for create/modify requests. It reads the
original request/facts, not the planner or authored draft. `requestCoverage.ts`
parses exact, uniquely located request quotes and existing acceptance criteria.
Every unquoted word, invalid/empty extraction, failed transport, unsupported
obligation or missing check remains `functionalUnresolved`. This is structural
span accounting, not a keyword/regex language planner. Choosing the right semantic
criterion still belongs to the model; even full text coverage is not proof that
the model understood every constraint correctly.

The adapter-owned `IntentDeclaration.requestRequirements` is not consumed from
declaration/worker JSON. Session adoption reuses identical declared functional
checks and gives additional checks mandatory `request-N:coverage:clause:criterion`
IDs in the **same** canonical ledger. Each check is separate so an unresolved
member of a multi-check clause remains visible to the existing R2 refinement path.
Quoted `clarifies:[{requirementId,text}]` must reference an actual unresolved
requirement and a refinement from this user declaration. A failed audit during
host resume creates a new unresolved obligation with that message's source and
pre-write baseline, even if its clarification resolves an earlier requirement.
Ask/non-authoring and synthetic continuation retain their prior semantics; worker
repair/replan/skip cannot weaken these checks. Explicit host withdrawal/new-goal
remain the only scope-exclusion authority. Canonical save proof is unchanged.

Failed NPC shape repair still runs the independent audit in the shared deadline;
if unavailable, it retains a separate unresolved coverage obligation alongside
the NPC error. An NPC-only clarification therefore cannot certify omitted original
constraints, through either ordinary follow-up or explicit host resume.
`parseRequestCoverageResult` returns requirements plus structural extraction error
status; the adapter propagates that error so the 90-second cache cannot suppress
an immediate retry. Malformed JSON, invalid envelopes/links/criteria and empty
non-clarification audits fail this way. Valid model-declared unsupported checks
remain distinct and cacheable. `parseRequestCoverage` keeps its array-returning
replay API and the same fail-closed obligations.

Declaration and audit share the existing 20-second budget. A live Codex audit
timed out and correctly stayed unverified while authoring still produced a saved
draft. Live evidence and limitations, including model-selected overly strict
reachability checks, are in `output/evidence/acceptance-live/README.md`.

Request-bound functional acceptance (2026-09-07): the live lite declaration accepts
`functionalAcceptance` for requested `shopPurchase` and `mapRoundTrip` expectations;
existing `npcRewards` becomes mandatory `npcReward` criteria in the same
`AssistantAcceptanceLedger`. IDs are host-owned `request-N:functional:index`, with
original request source and baseline. Planner/native-plan schemas expose the same
narrow criteria, but replan, skip, optional replacement and `repair_acceptance`
cannot weaken an adopted criterion. Only the existing host `withdrawRequirement`
action withdraws it; ordinary follow-ups retain the ledger and explicit host
`new-goal` starts a new one. Missing/unsupported semantic targets become
`functionalUnresolved` evidence with typed known `expectations`, not a silent
opt-out or an easy static substitute. Review repair (2026-09-07): a later genuine
user clarification can resolve that placeholder without discarding the goal.
`IntentFacts.unresolvedFunctional` enumerates every required, non-withdrawn unresolved
leaf, including mixed arrays, with stable `requirementId` plus zero-based
`criterionIndex`, original source, known expectations and previous refinement sources.
`functionalRefinements:[{requirementId,criterionIndex,criterion,corrections?}]` is consumed
only at the actual LLM-classified user-declaration boundary, including host `resume`,
never by worker tools, Ask, synthetic/fast-path continuations or timeout/fallback.
Omitting the index remains compatible only with an original singleton index0.
The parser and host `refineFunctionals` validate the entire batch before mutation:
ambiguous, duplicate, out-of-range, optional, withdrawn or concrete selectors reject
it without accepting a valid prefix. Only selected leaves change; all siblings,
original promise/source/baseline/required/withdrawal metadata survive, and one source
entry is appended per affected promise. Omitted known fields are retained; conflicts
still require explicit typed user-correction fields. Partial refinements stay unresolved.
Once concrete, a contract cannot be refined or repaired into an easier one; existing
host withdrawal/new-goal actions remain the scope-change authority.

Round13 source repair (2026-09-07): a generic ending/compound placeholder without typed
expectations can specialize through this same later-user route to a narrowly parsed
`toolVerdict/run_scene_test`, not an arbitrary verification tool. The host requires
complete native input, named interact steps and complete ordered map-qualified
`interactionTargets` before execution; no debug `set`, checkpoint reset or first-probe
ownership. A post-interaction ending-ID, actual transfer or nonzero reward/consumption
assertion is required; empty scripts, positions, interaction completion and zero-only
assertions alone are not functional outcomes. Typed shop/travel/reward expectations
cannot be laundered into a scene. The selected index becomes the existing canonical
check ID, with the original request's protected initial state, and requires fresh
exact explicit execution; a prior passing probe or advisory result is not authority.
This does not restore private ledgers from saved conversation transcripts.

The registered `run_scene_test` expect-step schema exposes `endingReached` as a string
with `minLength:1` and a non-whitespace pattern. Native input still rejects `true`,
empty/blank IDs and unknown fields without coercion or invented endings. The installed
Google/Antigravity SDK retains STRING on the emitted wire but spills unsupported
length/pattern constraints into descriptions; native validation remains authoritative
for nonempty IDs. Round13's intended ID is `ending_escape`. Offline real-session and
installed-provider wire regressions: `functionalCompositeClarification.test.ts`,
`functionalClarification.test.ts`, `ohMyPiEndingWire.bun.test.ts`; canonical ownership,
advisory, functional and reward regressions remain unchanged.

`functionalAcceptanceEvaluation.ts` runs the real scene interpreter on current
applied content. Purchase walks to and triggers the exact seller, resolves runtime
stock/pricing, calls production `handleShopTransaction` (including normal visit
and loyalty semantics), and checks exact gold AND inventory deltas. Single-quantity
shops use repeated real transactions. Round trip walks through both exact authored
transfers in one session, checks interpreter-owned source/destination evidence,
then walks back to the original start. Walking checks held-interpreter ownership
at every tile, not just at the SceneStep boundary: a mandatory touch shop cannot
be walked through or replaced by the next transfer. The same event resumes after
a purchase. Purchase, choice and animation completion consume the old hold BEFORE
resuming, keeping interpreter/event ownership locally. A non-suspending arrival
autorun can therefore run after transfer; a new hold is installed only if execution
suspends again. Unsupported nested autorun suspension still fails closed without
replacing the newly held interpreter. Both require the declared actual project
entry; no convenience teleport or injected gold/switch state. NPC rewards reuse
`verifyNpcRewardsPlayable`: exact requested first grants, then zero item/equipment,
monster and gold reward deltas on the second interaction in that same session.
Without a selected request-bound witness, the NPC check remains local interaction
evidence. Once `verify_npc_reward` selects a prerequisite program, both functional
acceptance and accepted-revision reload proof replay that same private witness against
current content; a failed/replaced witness never falls back to easier local proof.
The claim/repeat protection, early-reward rejection and immutable target binding remain.

No worker-provided pass flag, script, tool name or image can supply these verdicts.
All project changes, including DB/session-default changes, keep drafts unverified;
functional evaluation reruns rather than reviving stale receipts. Run-end persistence
uses `verifyPersistedRevision`'s trusted `validate` callback to rerun the immutable
checks on the canonical reload AFTER it matches the accepted content identity.
The remote proof path remains read-only and retains currentness/cancellation checks.
No persisted project-schema change or parallel evidence ledger was introduced.

Scope: ordinary player-buy shops and authored action/touch transfers from the
actual project start; shopkeeper, haggle, service modes, ambiguous triggers and
missing prerequisites fail closed with expected/observed diagnostics. Unrequested
behaviors impose no requirement. Natural-language extraction is still performed by
the declarer model, not proven exhaustive by the engine or scripted-model tests.

Field-action acceptance (2026-09-07): `IntentDeclaration.actionCombat` carries
`{ targets: AcceptanceTarget[] }`, with exact existing `mapId` or authored
`newMapName` targets. This is a structured semantic declaration, not a keyword
router. `AssistantAcceptanceLedger.requireActionCombat(targets, requestBaseline)`
retains these obligations separately from planner IDs, so replacement plans and
repairs of missing spatial acceptance cannot remove them. The `actionCombat`
criterion requires the runtime-owned receipt from `run_action_combat_test`.
`captureActionProof(receipt, project, requestedMapId)` validates exact receipt
ownership, map and current project fingerprint. The async dispatcher must pass
the original object before JSON serialization and pass the requested map even
on failed/cancelled runs, which revoke prior success. Any observed content change
retires old receipts permanently; undo cannot revive them.

Verification ownership (2026-09-07): `ToolVerificationEvidence` stores immutable
adopted requirements, unresolved artifact findings, and auditable attempts separately.
An invocation is not adoption. Session-owned check IDs, not reused scheduling IDs,
survive skip/replan/continuation. Skipped items remain terminal scheduling entries;
`evaluate(applied, draft, blockingProblems)` still publishes its synthetic blocker
until every adopted scope and genuine negative finding is resolved.
`AssistantAcceptanceLedger.verificationOwnership(project)` exposes detached accepted
criterion/index/map bindings without changing promises, baselines or the evaluator.
Reachability successTools bind to those exact accepted routes, including conservative
exact-cell acceptance; the query tool's adjacent-or-on pass alone cannot substitute.

A plan may declare independent `verificationChecks` even when the same tool already
has accepted criteria. Only an exact scope match reuses a criterion; a same-map or
same-tool sibling cannot substitute. Both planner JSON and `set_work_plan` use the
same parser and atomic adoption preflight:

```json
{"successTools":["check_reachability"],"mapTargets":["map_id"],
 "verificationChecks":[{"tool":"check_reachability",
   "args":{"mapId":"map_id","from":{"x":2,"y":2},"targets":[{"x":3,"y":2}]}}]}
```

A criterion reference is `{tool,criterion:{promiseId,criterionIndex}}`. A scene uses
its complete `SceneTestInput` as `args`, plus `interactionTargets:[{stepIndex,mapId,eventId}]`
for every explicit interact step. This freezes start/seed state, ordered targets,
choices, assertions and snapshot boundaries. A legitimately adopted missing/malformed
scope stays `pending-specification`; no arbitrary first same-tool pass can fill it.
Every unresolved new sibling remains pending or rejects the candidate atomically.
To specify an existing pending scope in a later accepted plan, include its returned
`checkId` with the declaration and retain its tool/mapTargets. The original owner survives,
valid specifications are immutable, and earlier exploratory passes are not proof.
These declarations describe only the user's accepted goals; do not invent game goals.

A changed specified `checkId` rejects the whole candidate before plan, acceptance or
verification mutation, whether expressed as args or a criterion reference and whether
its original proof is unverified, passed or stale. Exact reuse retains owner, criterion
linkage, frozen scene state and proof. A distinct new scope must omit the retained ID
and needs fresh execution. Pending resolutions retain tool/owner/mapTargets (omitting
retained targets is not preservation); contradictory same-ID resolutions anywhere in
the candidate reject before either applies. Raw IDs are inspected before lossy parsing.
Rejection returns `ok:false`, `data.conflicts` with item/declaration index/checkId/reason,
and unchanged live `plan`, `acceptance`, and `verification` snapshots. Planner rejection
publishes this same structured result in its status/context instead of installing the
candidate. Rejection creates no extra obligation and does not invalidate genuine old
proof. Native project/quest/troop/scenario inputs retain item map ownership without an
invented `mapId`; the map-scope guard applies only when the tool schema declares it.
Regression: `verificationPlanAtomicity`, `verificationRouteDeclaration`, `verificationNativeScopes`.

`get_work_plan` and verification tool results return `data.verification.requirements`
and `.findings` with ready machine check IDs. `correct_verification({checkId,args})`
resolves that stored check, validates compatible input, executes its original registered
tool through the session dispatcher, and records the real result. It accepts no verdict,
delete, baseline, owner override or replacement requirement. A normal exact-compatible
rerun also works. Corrections can change facing only: movement/walk/set-position stays
exact. Ordered host map/event receipts must match; an early failure without ownership
trace does not authorize navigation equivalence. Changed targets, start, choices,
reward checkpoints or weaker/dropped assertions cannot discharge the original check.
Successful writes stale adopted passing proof, not unowned exploratory history.
An unowned assertion-free no-selected-target interaction records structured setup
failure, not a promise to create an event. Genuine exploratory negatives still block.

The synchronous `playTools` entry for `run_action_combat_test` fails closed unless
the session's async browser dispatcher intercepts it. `run_scene_test` preflights
the entire input before autoruns or movement, rejects malformed/unsupported steps
and never claims field-action combat proof. Wait/spawn tests and turn-based battle
simulation remain distinct capabilities. Ordinary one-page guides pass the NPC
outcome gate unless the structured `statefulNpcs` requirement is explicitly true;
planner-declared `multiPageNpcs` volume is still measured independently.
Focused regressions: `actionAcceptanceRequirements`, `actionAcceptanceProof`,
`sceneTestRunner`, `volumeContract`, and the existing acceptance/verification suites.
Evidence: `output/evidence/action-fixes-acceptance/`. Session wiring and actual
export-player browser QA are owned by the integrating lead.

`assistantAcceptance.ts` parses structured promises separately from the replaceable
`WorkPlan`; `assistantAcceptanceLedger.ts` retains their original baselines and
immutable snapshots. Planner decisions and `set_work_plan` accept
`acceptance: [{ id, title, criteria }]`. Replanning, completing, skipping or clearing
execution steps cannot erase existing promises or weaken valid criteria.
`repair_acceptance` repairs only missing/malformed criteria. Each newly adopted
promise captures its request's pre-write applied snapshot, not the conversation's
initial project or the draft at adoption time. The session captures that snapshot
before planning/tools; milestone rebases, repairs, duplicate IDs, replans and
manual/synthetic continuations cannot move it. New requests may add promises
against newer applied content without replacing earlier promises or baselines.

Literal displayed-title acceptance (2026-09-08): `gameTitle` is the narrow named
criterion for an exact requested title, not a generic JSON-path check:

```json
{"itemId":"req_title","criteria":[{"kind":"gameTitle","title":"작은 열쇠"}]}
```

Use this shape in `repair_acceptance` only for missing/malformed criteria, or put
its criteria in normal planner/native `acceptance` or `requirements` declarations.
Valid original declarations, owners, sources, request baselines and valid sibling
promises remain immutable; this does not authorize restoring a private ledger from
conversation history. `set_title_screen` is the existing authoring tool.
The parser requires a nonblank string, preserves its exact Unicode/whitespace,
and rejects unknown kinds and extra fields. The provider-safe schema exposes
`title` and the canonical example; worker review/pass claims cannot verify it.
Evaluation follows `titleScreen.renderTitleScreen/renderTitleNodes`: use
`system.titleScreen.title`, or `defaultTitleScreenSettings().title` when the settings
object is absent, **never `meta.title`**. Graphic-only mode with a resource ID has
no literal text and fails, including an unresolved resource; graphic mode without
an ID falls back to text, and text/both modes check the displayed title string.
This is literal text proof, not logo OCR or visual layout QA. Evaluation imports
no renderer/DOM code. Title criteria are project-bound: unapplied drafts cannot
verify them, and the existing accepted-revision `validate` callback reruns them
on identity-matched canonical reload. Wrong visible text fails even with correct
metadata and a completed plan. Regression seams: `gameTitleAcceptance`,
`gameTitlePersistenceProof`, and the unchanged strict schema-discriminator contract
extended only with the new kind/field.

Acceptance repair diagnostics (R7): provider schemas expose a union-free field
superset plus canonical per-kind examples; Google-to-Antigravity normalization
cannot erase those examples. `mapCount` requires explicit nonempty `targets`,
each with exactly one `mapId` or `newMapName` selector, and an exact `count`.
Runtime parsing remains atomic across the full criterion array. Tool `data.code`
distinguishes `malformed-criteria`, `unknown-item`, `immutable-valid`,
`invalid-review`, and `image-review-unavailable`; `data.issues` identifies
`criterionIndex`, `field`, `code`, `expected`, and the canonical `example`.
Adoption immediately publishes malformed/missing criteria in the ledger and
injects diagnostics before generation; `set_work_plan` returns that snapshot.
Failed repairs leave all criteria, earlier promises, and baselines unchanged.
Static reachability means exact walkable origin/destination cells, unlike
interaction-oriented `check_reachability`. Failed evidence identifies the cell,
map, and blocker (including solid event ID). Author approach-cell criteria for
interactions; do not relocate NPCs/signs/chests to satisfy a misunderstood check.
Regression seams: `assistantAcceptanceDiagnostics`, `assistantAcceptanceProvider`,
and `assistantAcceptanceSession` replay the five round-2 repair calls.

Checks inspect actual scoped map dimensions, map/event counts, original target
changes, protected map/region content, conservative static reachability and
explicit image review. New-map names bind once to a unique new ID relative to the
first promise for that name; later baselines cannot resolve its ambiguity.
`targetChange` with explicit `newMapName` also recognizes original absence ->
uniquely bound applied-map presence as creation, after normal region validation.
Draft-only creation, existing same-name maps, ambiguous names and replacement IDs
cannot verify it. Existing-map change comparisons remain scoped to original content.
Ledger adoption and repair reject baseline-dependent targets without original
content (`preserve`, or `targetChange` with a missing original `mapId`) atomically
with criterion-indexed `unsupported-original-target` issues. These items remain
repairable; valid siblings, captured baselines and bindings stay immutable. A name
bound in an earlier request can still refer to original content in a later request's
baseline. Regression: `assistantAcceptanceNewMapCharacterization` replays the
captured round5 contract through both plan parsers and the real session/tool path.
Static route checks do not claim conditional transfer or runtime playthrough support.
Image checks require successfully rendered and delivered `show_map_region`
coverage (actual clipped bounds, exact union), then a later explicit
`review_acceptance({itemId, verdict:"pass"|"fail", note})`. Only an explicit pass
verifies the image condition; a failed review revokes an earlier pass and retains
its observation in the evidence disclosure.
`assistantImageEvidence.ts` owns the single receipt store used by both acceptance
and terminal adventure coverage. DB-only writes and non-resetting follow-ups retain
current images; map content, its tileset and shared asset changes retire applicable
receipts, including captures pending delivery. Undo cannot revive retired receipts
or reviews. Failed/empty rendering and metadata alone add no coverage. Applied-state
checks filter evidence without retiring a reviewed draft that has not yet been
applied; draft images never verify the old applied map. Normal finalization and both
execution-budget exits use this same currentness. Image verification remains separate
from structural adventure checks and is not game-completion/playthrough proof.

R11 transport: frontend insertion is not delivery. The companion emits
`image_delivery: [{messageIndex, partIndex}]` only after successful provider
completion; `llmClient` parses it atomically. The session matches acknowledgements
against the actual post-compaction request's image parts before crediting its
turn-local pending receipts. Missing/partial acknowledgements, errors, aborts and
compacted-away images cannot revive on a later response, continuation or retry;
render again to establish new evidence. Existing delivered-current receipts retain
the R2 lifecycle above. The adapter accepts inline base64 PNG/JPEG/GIF/WebP only,
checks canonical encoding, MIME signatures and resolved-model image capability,
and rejects unsupported roles/parts/URLs visibly. Pixel decoding remains the
provider's responsibility. Codex receives consecutive image-terminated user
segments because its SDK otherwise moves all labels before all images. Default
`gemini-3.7-flash`, tiered and fallback-low alias paths retain image capability.
Wire/session regressions: `test/ohMyPiImageTransport.bun.test.ts` and
`test/assistantImageTransport.test.ts`; no live credentials are needed.

`AssistantSession` consults acceptance at final-response and autonomous-continuation
boundaries even when the execution plan is finished. Existing bounded repair
limits remain; unmet promises produce an incomplete result and blocked note.
Run-end persistence proof also retains this acceptance gate: a completed/skipped
execution plan cannot schedule proof while promises remain unmet. PR647's
accepted-revision proof is read-only and retryable, not a replacement for acceptance.
`refreshAcceptance` reevaluates canonical store changes, including manual edits
and undo after completion. Request interpretation is still model-authored:
this is not proof that every natural-language clause was extracted. Missing
spatial criteria fail closed rather than being inferred from tool success.
There is no new approval step, genre quota, remote schema or cross-device ledger.
The note's lifetime is the current conversation/session, not a saved project.

Regression entry points: `test/assistantAcceptance.test.ts`,
`test/assistantAcceptanceSession.test.ts`, `test/assistantImageEvidence.test.ts`,
`test/assistantVisualEvidenceSession.test.ts`, `test/aiStickyChecklist.test.ts`,
`test/e2e/ai-sticky-checklist.spec.ts`. Evidence: `output/evidence/assistant-sticky/`.

## 자동 프로젝트 위키 (2026-09-07)

일반 대화의 설정·제작 결정은 기존 OAuth LLM으로 추출해 `project.world`에 저장한다.
의도 선택 전에 기록 저장을 기다리고, 새 대화에서도 관련 문서를 읽는다.
출처·명시/추론·현재 맵 예외와 실제 적용 기록은 구별한다.
전체 기록 복구, 오류·경합 처리, 실제 전투 수락 검증은
[프로젝트 위키](project-wiki.md)를 따른다. 아래의 과거 세계관 AI 배제 기록은
일반 CRUD·무조건 다이제스트에만 남으며, 이 제한된 위키 경로에는 적용하지 않는다.

R3 delivery accounting (2026-09-07) uses the real coordinator's
`WikiTurnInput.onDelivery` callbacks: `applied` after a changed patch reaches the
store, then `persisted` only for its correlated accepted remote-save receipt.
This covers awaited history backfill and current extraction. Without an accepted
owned save, checkpoint failure or cancellation after apply still reports `applied`.
Empty extraction doesn't claim a historical wiki write or its clean-flush receipt.
Explicit Ask/Plan preparation remains read-only. No wiki milestone invents proposed
or applied tool calls.

The session captures the current run-result owner for these callbacks and ignores
late callbacks from an older run. Intent-time delivery cleanup preserves this
run's already-applied wiki work, not another run's context. Accepted persistence
survives a later edit or cancellation, including during proof retry; only a
passing, still-current proof promotes `persisted` to `persisted-verified`.

Post-tool progress writes use the same coordinator through `observe`.
`applyProposedProject` returns the actual `wikiDelivery` milestone, and
`recordAppliedProject` uses that later wiki revision for save/proof correlation,
not the earlier tool commit's project. Its proof has `commitId: null` rather than
borrowing the tool commit ID. A progress-save failure preserves the actual apply
and existing optional `wikiWarning` policy. See
[receipt ownership](editor-observability.md#p2-outcome-publication-2026-09-06) and
[wiki delivery QA](testing.md#p2-r3-wiki-delivery-2026-09-07).
## Independent image generation settings (2026-09-07)
## Independent image generation settings (2026-09-08)

- Existing AI settings (aiSettingsModal.ts) has separate image provider/model
  selects. AiConfig.imageProviderId/imageModel are optional, stored in the same
  oprn:ai-config blob, and independent of providerId/model/liteModel.
- Old configurations default to google-antigravity / gemini-3.1-flash-image,
  the actual image-output model, not the old gemini-3.8-flash fallback alias.
  Explicit saved image choices are never corrected by the chat model catalog.
- imageGenerationClient reads this selection for X-Oprn-Provider and the model
  body field on the existing /v1/images/generations endpoint. Explicit request
  providerId/model overrides win without changing storage. Reference validation,
  AbortSignal propagation and server error reporting retain their existing path.
- imageModelCatalog contains only image-output routes. Pro is disabled: sibling
  subscription probe returned exact-model 404 on both authenticated endpoints.
  Codex image generation retains the internal codex-image-default selection ID,
  labeled GPT Image 2 (Codex), but explicitly requests upstream model gpt-image-2
  with quality/background/size auto and n: 1 for the single-candidate contract.
  This matches the [pinned official Codex request](https://github.com/openai/codex/blob/3d2ee51ca2d5db578f328aa75e20aa22c0197c9a/codex-rs/ext/image-generation/src/tool.rs#L420-L429)
  (official n is omitted and defaults to one). Returned GeneratedImage.model is
  gpt-image-2, identifying the requested alias, not a dated snapshot: the native
  response does not report that snapshot. Never send the sentinel upstream or
  fall back to another model. Earlier model-omitted probe images/reports retain
  their original unknown identity; do not retroactively label them GPT Image 2.
  Login guidance follows the selected provider. The native Codex route is
  text-only and rejects nonempty references with 409 instead of omitting them.
  Named saved GPT models remain visible, disabled and unchanged, not normalized
  to the sentinel. codexImageRuntime.ts reuses resolved server-side OAuth tokens;
  oh-my-pi-worker.ts dispatches the selected provider without changing chat.
- Unknown provider change events preserve the saved image model without throwing.
  databaseAiGenerateDialog uses selected imageProviderId in its other-provider
  notice, defaulting only for legacy configurations without the image field.
- Tests: test/aiImageSettings.test.ts, test/imageGenerationClient.test.ts.
  scripts/qa/image-options-settings.mjs mounts the real modal/styles in Firefox
  without booting a project. Auth and image responses are intercepted; this is
  UI/routing evidence, not a live generation probe. Native transport/dispatch is
  covered by test/codexImageWorker.node.test.mjs; explicit Antigravity model
  selection is covered by test/ohMyPiImageModelResolution.bun.test.ts.

## 브라우저 포커스와 도구 실행 대기 (2026-09-05)

- 도구 실행 직전의 `AssistantSession.yieldForUi` → `src/ai/yieldToUi.ts`가 이벤트 루프를 양보한다. 포커스가 있는 보이는 문서는 rAF를 기다려 라이브 행·고스트가 그려질 틈을 준다. `document.visibilityState === "hidden"` 또는 `document.hasFocus() === false`이면 `MessageChannel` 태스크로 양보한다. `Promise.resolve()`만 쓰면 입력·중단 이벤트가 굶으므로 대체하지 않는다.
- 2026-09-04의 rAF + 50ms 타이머 폴백은 타이머까지 제한되는 백그라운드에서 도구마다 지연될 수 있었다. 이제 프레임을 기다리던 중에도 `visibilitychange`/창 `blur`를 받으면 메시지 태스크로 전환한다. 완료·전환 시 프레임, 타이머, 이벤트 리스너를 정리하고 메시지 포트도 완료 즉시 닫는다. 포커스가 있는데 rAF가 멈추거나 호출이 실패한 경우의 50ms 안전망, MessageChannel 미지원 환경의 타이머 폴백, Node의 즉시 완료는 유지한다.
- 범위는 살아 있는 문서의 스케줄링이다. 브라우저의 탭 freeze/discard, 탭 닫기, 기기 절전 중에도 작업을 계속하려면 별도의 서버 실행·복구 설계가 필요하다.
- 회귀: `test/yieldToUi.test.ts`(프레임·타이머 정지, 중간 숨김·포커스 상실, 자원 정리, 미지원 환경), `test/assistantSessionYield.test.ts`, `test/e2e/ai-background-progress.spec.ts`(실제 패널의 도구 3개와 최종 답변). 브라우저 증거는 `output/evidence/assistant-background/`. Playwright는 기본으로 포커스를 강제하고 타이머 제한을 끄므로 해당 스펙은 그 옵션을 해제한다. 숨김·분 단위 타이머 제한은 명시적으로 주입하고, MessageChannel과 세션 실행은 실제 브라우저 경로를 쓴다.

## Map-targeted work outcomes (2026-09-06)

Spatial WorkPlan items declare `mapTargets` with exact stable map IDs. Author one map per
item and submit its own single-map BuildSpec; put `create_transfer_pair` in a later item
with both endpoint IDs. Existing layer/item order supplies the prerequisites, not a DAG.
`workPlanTargets.ts` checks declarations and per-target tool outcomes. The session keeps
these outcomes across continuations and resets them only with item/goal/plan evidence.
Successful idempotent/no-change work counts for its own target; another map's success,
a road, or a transfer cannot replace a failed declared authoring tool. Explicit completion
uses the same target gate, and completing an already-done item remains idempotent.
Malformed `set_work_plan` targets are rejected atomically with `data.targetIssues`; legacy
planner items retain actionable correction instructions instead of completing by names.
Nonspatial and map-metadata-only plans keep their existing behavior. Regression:
`test/workPlanMapOutcomes.test.ts` replays the round2 village/cellar failure in both orders.

## 계획 항목의 연속 실행 증거 (2026-09-05)

실행 예산으로 나뉜 driverContinue 또는 continuation은 같은 항목의 성공 툴·생성 맵/퀘스트/NPC·전투 검증과 미적용 제안을 보존한다. 새 목표·새 계획·현재 항목 변경에서만 resetWorkItemEvidence로 비운다. 테스트 `aiMilestoneTurnAccounting`은 maxToolCalls=1로 upsert_item과 set_title_screen을 서로 다른 턴에 실행하고 두 변경이 실제 마일스톤으로 적용되는지 확인한다.

미등록 successTools 이름은 삭제하지 않는다. 남은 필수 조건과 잘못된 이름을 실행 문맥에 표시하고 find_tools/set_work_plan으로 계획을 수리하도록 안내한다. 플래너는 레지스트리 실제 이름 목록을 받으며 장르명만으로 퀘스트 그래프·보스를 필수화하지 않는다. 명시 조회 계약의 도구는 노출 상한에서도 유지된다.

## 계획 규모와 선언 자세 (2026-09-09)

「마을을 만들어」처럼 짧은 신축 요청이 1항목 계획으로 끝났다. 원인은 세 겹이다. (1) 플래너 페이로드에 이것이 **신축 다단계**라는 사실이 없었다 — 선언 계층은 `mode`/`needsPlan`을 이미 계산하는데 플래너는 그것을 못 봤다. (2) 스키마 예시가 레이어 1개·항목 1개·`successTools:["author_village"]` 하나뿐이어서, 플래너가 보는 유일한 구체 예시가 「마을 = 1항목」이었다. (3) `author_village`는 대상 전체를 한 호출로 짓는 파사드라 rule 2의 "single tool turn"에 맞아 보였다.

`buildOrchestratorUserPayload`는 이제 `intent`를 받아 `plannerScopePosture`로 환산한 자세를 `## Scope declaration`에 싣는다. `mode=create`+`needsPlan` → `decompose-greenfield`, `mode=modify` → `respect-existing`(다단계 여부 무관), 질문·판단 불가·단일 단계 신축·선언 없음 → 자세 없음. 코드는 여전히 규모를 강제하지 않는다 — 플래너의 `direct`는 그대로 존중한다(2026-09-03 「이 마을에 상인 하나 추가」 폭주 회귀 방지가 `respect-existing`의 존재 이유다).

파사드가 항목 1개가 아닌 이유를 rule 6에 실측으로 적었다: `author_village`의 필수 인자는 `target`·`countPolicy`뿐이고 결과를 살아있게 만드는 인자는 전부 선택이다(`residents.lines`, `housePlans.ownerName/program`, `npcCount`, `interior`, `settlementLayout`, `theme`, `forestDensity`). 사후 검사(`assertVillagePostconditions`)는 집 수와 NPC 수만 센다 — 대사·상점·실내·연결은 검사하지 않는다. 상점 재고·퀘스트·맵 간 이동·시작 위치·인카운터·보물과 마지막 `show_map_region` 전수 점검은 그 호출 밖에 남으므로 별도 항목이어야 한다. 스키마 예시도 2레이어·3항목으로 바꾸고 "이 예시는 모양이다"를 명시해 상한으로 읽히지 않게 했다.

Tests: `workPlan`(자세 표 6종 + 선언 없음 + 페이로드 전달), `assistantSessionIntent`(세션이 실제로 intent를 넘기는지, 수정 요청이 `respect-existing`을 받고 `direct`가 유지되는지).

## 조회 선행·계획 완료와 실행 종료 (2026-09-05)

사용자가 명시한 읽기 선행은 `intentDeclaration.readBeforeWrite`로 구조화한다. `ToolReadEvidence`는 성공한 get_project_summary/get_map_region/find_events/get_database_records 결과를 기록하고, 결과를 모델이 읽을 수 있는 다음 응답부터 쓰기를 허용한다. DB ID 목록은 참조 근거이며 기존 레코드 갱신은 `include:full`의 현재 값 일치가 필요하다. 실패한 조회와 같은 응답의 후속 쓰기·complete/skip은 계약 선언 여부와 무관하게 보류한다. 직접 NPC 시공·캐스트 라이터도 같은 읽기 게이트를 통과한다. 자동 계속과 수동 continuation은 계약을 보존하고 새 요청은 초기화한다. 이 경계는 사용자 자연어를 정규식으로 재분류하지 않는다.

`complete_work_item`의 `allowWriteEvidenceFallback`은 제거했다. 필수 successTools 전부와 산출물 게이트가 필요하고 현재 항목만 완료할 수 있다. 잘못된 계획은 set_work_plan으로 수정해야 하며 다른 쓰기 성공으로 누락 도구를 대신할 수 없다. 완료 항목 재호출의 idempotence는 유지한다.

체크리스트는 실행 중 모든 체크가 끝나도 ‘마무리 확인 중’, max-tool-calls/token-budget은 ‘작업 중단 — 실행 한도 도달’, 오류·적용 실패는 각 중단 사유를 보여 준다. 건너뛴 항목은 ‘모두 완료’로 세지 않는다. `aiTurnRunner`가 실제 종료·적용 결과를 표면에 전달한다. Tests: `assistantReadContract`, `workPlan`, `aiChatLeanUi`, `aiAutonomousRunSurface`.


## 조수 카메라 이동 수명·부드러운 줌 (2026-09-05)

- `EditScene.panCameraToTile`은 목적지 줌을 `editorState`에 한 번 기록하고, 같은 호출 안에서 실제 카메라를 출발 위치·줌으로 복원한다. 이후 팬의 progress로 look-at과 로그 배율 줌을 함께 보간한다. 거리별 300–650ms, 시작·끝 속도 0의 smoothstep을 쓰며 `prefers-reduced-motion: reduce`면 즉시 도착한다. `onlyIfOffscreen` 판정은 상태의 목적지 줌이 아니라 **현재 카메라 줌**을 쓴다.
- 이동 중 같은 요청은 재시작하지 않는다. 새 요청은 현재 보이는 위치에서 출발한다. 맵·카메라 크기·수동 줌 변경과 씬 정리는 `panEffect.reset()`으로 이전 효과를 실제로 중단한다. 콜백의 맵 검사만으로는 부족하다: Phaser Pan은 **콜백 전에** scroll을 쓴다.
- 이미 시작한 자동 이동도 캔버스 pointerdown, 손 팬, 휠·방향키 입력에 양보한다. 취소 때 목적지 줌을 확정하되 pointerdown은 포인터 아래 월드 좌표를 보존한 뒤 타일을 구한다. 기존 제스처 중 들어온 요청은 마지막 하나만 보관해 종료 때 재생하는 계약을 유지한다.
- `camera.preRender()` 후 뷰포트를 게시해야 같은 프레임의 `worldView`가 반영된다. 효과 콜백은 렌더보다 먼저 실행되므로 기존 worldView를 그대로 읽으면 이전 프레임 좌표다. DOM 마커 재생성은 완료·취소 시에만 한다.
- `planCameraFocus`는 비유한 맵·좌표, 1칸 미만 영역, 맵과 겹치지 않는 영역을 거부하고, 일부 겹친 영역은 해당 맵과의 교집합으로 중심·fit을 계산한다. `focusEditorRegion`도 비유한 입력을 **맵 선택 전에** 거부한다.
- 검증: `test/editSceneCameraFocus.test.ts`, `test/editorCameraFocusPlan.test.ts`, `test/editorReferenceNavigation.test.ts`; 실제 Phaser 프레임·맵 전환·휠 중단·동작 줄이기는 `test/e2e/assistant-camera-motion.spec.ts`, 증거 `.omo/evidence/assistant-camera-motion/`.


## 조수의 맵 전환은 크로스페이드다 — 하드컷 금지 (2026-09-15)

**같은 맵 안의 이동만 부드러웠다.** 위 절의 팬은 `target.mapId === 씬의 현재 맵` 일 때만 돌고,
맵이 바뀌면 `selectEditorMap` → `editorState.set({currentMapId})` → `redrawWhenViewStateChanges`
→ `redraw()` 가 **한 프레임에** 캔버스를 통째로 갈아 끼웠다. 카메라는
`planEditorCameraCenter(preserveLookAt:false)` 로 새 맵 한가운데에 붙고, 그 **뒤에** 목표로
300–650ms 팬이 또 돌았다 — 한 번의 이동에 덜컹이 둘(하드컷 + 낯선 맵 가로지르기)이다.
조수가 여러 맵을 오가는 턴에서 이게 되풀이되는 것이 감독이 말한 「확확 전환」이다.

- **어휘는 크로스페이드다.** 맵 전환은 좌표계가 통째로 달라 팬이 보여 줄 공간 관계가 없다
  (motion vocabulary: Crossfade = 같은 영역에서 정체성을 «교환» 한다. Slide/Layout animation 이 아니다).
  옛 화면을 캔버스 종이색(`--bg-canvas`)으로 덮고, 덮인 동안 맵·카메라·강조를 갈아 끼우고, 새 화면을
  같은 종이색에서 띄운다. 덮기 80ms / 걷기 120ms.
- **소유 경계.** 판정은 순수 모듈 `src/editor/assistantViewTransition.ts`
  (`planAssistantViewTransition` → `cut`|`dissolve`, `remainingCoverMs`). 실제 재생은
  `src/editor/mapDissolveVeil.ts`. 둘을 묶어 호출부에 내보내는 한 문이
  `src/editor/assistantViewSwitch.ts` 다 — **조합 모듈인 `editorReferenceNavigation` 에 두면
  `agentFocus → editorReferenceNavigation → agentFocus` 순환이 생겨서** 별도 모듈이다.
  화면을 바꾸는 세 진입(`focusAcceptedAgentChanges`, `focusEditorRegion`,
  `navigateToEditorReference` 의 map 갈래)이 전부 이 문을 지난다.
- **`apply()` 안에 화면이 바뀌는 일을 전부 넣어라.** 맵 선택·카메라·강조를 한 묶음으로 넣어야
  덮인 동안 다 끝난다. 절반만 넣으면 나머지 절반이 베일 밖에서 그대로 덜컹인다.
- **사람이 목록에서 직접 고르는 전환도 같은 문을 지난다(2026-09-15 후속).** 조수 경로만 녹이고
  목록 클릭을 하드컷으로 남기면, 같은 화면 전환이 «누가 시켰는가» 에 따라 다르게 움직인다 —
  사용자가 목록에서 맵을 누르는 순간이야말로 가장 자주 보는 전환이다.
  `mapList.ts applyTreeSelection` 이 폴더 행(`isFolder`)과 열 수 없는 맵(`canOpenEditorMap` false)을
  먼저 갈라 내고, 남은 경우를 `withAssistantViewTransition` 안에서 맵 선택 + `rerenderMapList()` +
  `focusMapRow()` 한 묶음으로 실행한다. 목록 하이라이트와 로우 포커스는 베일 **밖**(목록 패널)에
  있으므로 `apply()` 밖에 두면 캔버스만 덮기(80ms)만큼 늦게 바뀌어 반쪽 덜컹이가 된다.
  ArrowUp/Down 행 훑기(`focusRelativeRow`)는 일부러 태우지 않는다 — 키마다 전환이 끼면
  훑기가 깜빡임이 된다(훑기는 «고르기» 가 아니라 «지나가기» 다).
- **전환 계약을 «밀리초 임계값» 으로 검증하지 마라 (2026-09-16 실측).**
  `map-list-switch-dissolve.spec.ts` 의 동작 줄이기 항목은 `swapLatencyMs < 130` 이었는데, 그 값은
  전환이 아니라 **맵 재구축 시간**이 지배한다(실측 117–124ms). 즉 재구축이 6ms 만 느려져도 거짓
  실패하는 운 좋은 통과였다 — 상수를 80 으로 낮추자 실제로 그렇게 터졌다. 계약은 «덮기를
  기다렸는가» 이므로 **베일에 페이드가 하나도 안 걸렸는가**(`fadeDurations` 가 빈 배열)로 바꿨다.
  같은 이유로 지속시간·교체 순간 불투명도를 `getComputedStyle` **폴링 표본**으로 읽지 않는다:
  부하가 높으면 루프가 맵 재구축 동안 700ms 넘게 굶어 120ms 걷기 페이드를 통째로 놓치고
  «시간이 있는 보간이었다» 는 단정이 거짓 실패한다. `Element.prototype.animate` 를 걸어
  **계획값**을 받고, 교체 순간의 불투명도는 `editorState` 구독자(=교체와 같은 태스크)에서 읽는다.
- **맵을 건너뛴 카메라는 팬하지 않는다** — `CameraFocusTarget.immediate`. 베일이 연속성을 갖고
  카메라는 이미 도착해 있다. 같은 맵이면 이 깃발을 주지 않는다(기존 팬이 그대로 소유).
- **페이드는 200ms 지만, 전환 전체는 그보다 길다 — 그리고 그 나머지는 줄일 수 없다 (2026-09-16).**
  목록 클릭 한 번을 WAAPI 시계로 분해한 실측(swiftshader, 40×30 맵, `sidebar-map-switch-timing.mjs`):
  클릭 → 새 화면이 다 드러나기까지 **847ms** = 덮기 130 + **베일 유지 428** + 걷기 200 + 클릭·재구축 89.
  유지 구간은 «새 맵이 실제로 그려지기를 기다리는» 필수 시간이다(`afterNextPaint` 의 rAF 2회 +
  맵 재구축 자체 — 베일 밖에서 직접 재면 동기 42–57ms + 다음 페인트까지 270–343ms). 그걸 줄이면
  빈 종이색 캔버스가 드러나 하드컷보다 나빠진다. 그래서 «너무 느리다» 에 대해 줄일 수 있는 것은
  페이드뿐이고, 그 둘을 130/200 → **80/120** 으로 낮췄다(= 전환에서 **130ms 가 결정적으로 줄었다**).
  종단 평균은 같은 스크립트로 847 → **781ms** 였다 — 나머지 차이는 호스트 부하 노이즈이므로
  (이 박스는 loadavg 50–62 를 오간다) 인용할 숫자는 페이드 합과 유지 구간이다.
  80ms 는 60fps 에서 다섯 프레임이라 하드컷을 여전히 가린다.
  **전환 시간을 다시 재려면 `node scripts/qa/sidebar-map-switch-timing.mjs`** (`BASE_URL` 로 워크트리
  dev 서버를 가리킨다). 폴링 표본으로 재면 안 된다 — 맵 재구축이 메인 스레드를 동기로 잡아
  루프가 그 구간을 놓치고 «커버 시작» 이 «교체» 보다 늦게 찍힌다(실측).
- **걷기는 새 맵이 실제로 그려진 뒤에 시작한다**(`afterNextPaint`, rAF 2회 + 400ms 탈출구).
  실측(swiftshader, 24×18 맵): 안 기다렸더니 베일이 걷힌 뒤 **빈 종이색 캔버스**가 500ms 드러났다 —
  하드컷보다 나쁘다.
- **끼어들기는 이어 덮는다.** 걷히는 중에 새 전환이 오면 0 부터 다시 틀지 않고 지금 보이는
  불투명도에서 남은 만큼만 덮는다(`remainingCoverMs`). 덮이기 전에 연달아 오는 전환은 **한 번의
  깜빡임으로 흡수된다**(코얼레싱) — 조수가 맵을 연달아 갈아 끼울 때 깜빡임이 배로 늘지 않는다.
- **호스트는 `[data-testid="edit-canvas"]` 다. `.phaser-container` 로 찾지 마라** — 플레이어도 같은
  클래스를 쓰므로(`player/playSurface.ts`) 테스트 플레이 창이 열려 있으면 게임 화면을 덮을 수 있다.
  베일은 캔버스 **위의 DOM 오버레이까지** 덮어야 한다(로케이션 상자·고스트 마커·활동 칩은 옛 맵
  좌표에 붙어 있다) — 그래서 `--z-canvas-veil: 30`(칩 22 위, 툴바 40 아래)이고, 캔버스 엘리먼트의
  opacity 를 건드리는 방식은 쓰지 않는다.
- **동작 줄이기는 전환을 제거한다**(대체하지 않는다). `prefers-reduced-motion` 의 단일 창구는
  `src/util/reducedMotion.ts` — 팬과 디졸브가 각자 matchMedia 를 읽으면 한쪽만 꺼져
  「즉시 갈아 끼운 뒤 300ms 팬」 같은 반쪽 상태가 난다.
- 검증: `test/assistantViewTransition.test.ts`(순수 판정), `test/editorReferenceNavigation.test.ts`
  (`immediate` 계약); 실제 브라우저의 불투명도 곡선·교체 시점·도착 카메라·같은 맵 제외·동작 줄이기는
  `test/e2e/assistant-map-switch-dissolve.spec.ts`. 사람이 목록에서 직접 고르는 클릭은
  `test/e2e/map-list-switch-dissolve.spec.ts`(행 클릭 → 베일 곡선·교체 시점·같은 행 재클릭·
  폴더 행·동작 줄이기), 증거 `.omo/evidence/map-list-switch-dissolve/`. 사람이 볼 필름스트립은
  `node scripts/qa/assistant-map-switch-filmstrip.mjs`(`FILMSTRIP_DRIVER=map-list` 는 목록 클릭 경로, 기본은 조수 경로; 프레임마다 그 순간의 베일 불투명도를 `frames.json` 에 적는다.
  CDP 스크린캐스트 — `element.screenshot()`
  한 장이 전환 전체(페이드 200ms + 그보다 긴 베일 유지)보다 오래 걸려 중간 프레임을 못 뜬다), 증거
  `.omo/evidence/assistant-map-switch-dissolve/`.


AI chat panel, proposals, region tasks, tool exposure, soft-confirm vocabulary, visual polish, dock modes, and harness integration.

> **Encoding note:** Some Korean descriptive text has EUC-KR→UTF-8 mojibake from the original source commit. English terms, file paths, and code references are intact. For accurate Korean, consult the referenced source files. Partial automated restoration applied; remaining garbled CJK is irreversibly corrupted.

> 이 페이지는 100KB 라 통째 읽기가 잘린다. 아래 절 제목과 `openwiki/INDEX.md` 의 줄 좌표로 필요한 절만 읽어라.

## 패널 셸 · 도크 · 접기 · 컴포저

- **데크 위치 이동 — 레일 드래그로 아무 데나 놓는다 (2026-09-12):** 데크 상단 레일(`.ai-deck-rail`)의 비상호작용 표면(who·state·spacer·레일 자체)을 잡아 끌면 데크가 포인터를 따라오고, 놓으면 `oprn:ai-deck-pos`(`aiPanelLayout.ts` 의 `loadDeckPosition`/`saveDeckPosition`/`clearDeckPosition`)에 `{ right, bottom }`(호스트 우·하 변 → 데크 우·하 변, px)으로 저장된다. 소유자는 `aiDeckMoveChrome.ts` — `aiChatResizeChrome` 과 같은 이유로 대화·런 상태를 읽지 않고 표면 셋(패널·데크·레일)과 "지금 움직여도 되는가" 게터 하나만 받는다. 계약:
  - **right/bottom 앵커**다 — 저장한 사용자 위치만 이 축이다. 저장값이 없으면 데크와 접힘 알약은 왼쪽 아래(`left` + `bottom` = `--ai-deck-inset`)다. 끌어 두면 패널에 `has-custom-deck-pos` 와 `--ai-deck-right`/`--ai-deck-bottom` 을 심고, 더블클릭은 그 클래스를 지워 왼쪽 아래로 되돌린다. left/top 이면 내용이 자랄 때 아래로 잘리므로 세로 축은 항상 bottom 이다.
  - **클램프 기준은 호스트(`.ai-chat-float-host`, 항상 `inset:0`)다 — 패널이 아니다.** 접히면 패널 자신이 알약 상자(약 72×44)로 줄어, 그 사각형으로 자르면 저장 위치가 가장자리 여백(4px)으로 뭉개져 알약이 우하단으로 도망간다(2026-09-12 실측 회귀, `test/aiDeckMove.test.ts` 「접혀서 패널이 알약 크기로 줄어도」). 접힌 동안 호스트가 줄어도 패널(알약) 크기는 그대로라 ResizeObserver 가 안 울린다 — 창 `resize` 를 따로 듣는다. 선호값(`position`)은 자르지 않고 심는 값만 자른다 — 창이 다시 커지면 원래 자리로 돌아간다(리사이즈의 barSize 와 같은 계약).
  - **클릭과 드래그를 가른다 (2026-09-14 보강)** — 시작점이 `button a input select textarea summary [contenteditable]`·`.ai-deck-rail-actions`·`.ai-composer-popover` 안이면 시작하지 않고, 축별 최대 이동이 `DRAG_START_THRESHOLD_PX`(3px)를 넘어야 드래그다. 실측 결함: 1px 만 흔든 클릭이 `{"right":15,"bottom":15}` 를 저장해 데크를 그 자리에 굳혔다(`is-dragging`·grabbing 커서도 그때 번쩍였다). 더블클릭은 저장 위치를 지워 기본 우하단으로 되돌린다 — 되돌리는 유일한 출구다. `title` 힌트는 who/state/spacer 표면에만 달고 **지금 끌 수 있을 때만** 문구를 넣는다(빈 title = 툴팁 없음) — 레일 자체에 달면 아래 붙은 팝오버 항목 위에서도 떠서 열린 메뉴를 훼방한다. 상태는 hover(`pointerenter`) 시점에 다시 읽는다.
  - **릴리스 하나로 끝난다 (2026-09-14 보강)** — `pointerup`·`pointercancel`·`blur`·버튼이 풀린(`buttons === 0`) `pointermove` 가 같은 몸(`onUp`)을 쓴다. 창 밖에서 버튼을 놓으면(Alt-Tab·창 밖 릴리스) `pointerup` 이 오지 않아 `is-dragging`(폭 transition 해제·텍스트 선택 차단)과 grabbing 커서가 남고 **눈에 보이던 이동이 저장되지 않아** 새로고침에서 되돌아갔다(2026-09-14 실측: blur 뒤 `is-dragging true`·`body cursor grabbing`·저장값은 이전 그대로). 같은 부류의 선례가 캔버스 `pointerupoutside`(`EditScene.endPointerGesture`, 2026-08-30)다.
  - **움직이지 않는 상태**: 접힘·전체 기록(`is-history-open`)·스튜디오·도킹 — `resizableDock` 게터가 막는다. 전체 기록에서는 데크가 **보인다**(`display:flex`, 503×835) — 그래서 `grab` 커서와 힌트가 거짓말이 되지 않도록 커서를 `18-assistant-deck.css` 에서 같은 상태 가드(`:not(.is-studio):not(.is-history-open):not(.is-collapsed)`)로 좁히고, grabbing 규칙은 특이도를 한 단계 올려 그 가드를 이기게 둔다(실측: 도킹 상태 커서 `auto`, 힌트 없음, 끌어도 무반응). 드래그 중 패널은 `is-dragging`, 문서 커서는 `grabbing`(기존 body 커서는 끝나면 되돌린다).
  - fakeDom 의 `matchesSelector` 는 콤마 나열을 못 읽는다 — 차단·표면 선택자는 한 번에 하나씩 묻는다. Tests: `test/aiDeckMove.test.ts`(20 — 임계값·blur 릴리스·buttons=0·힌트 상태 포함). QA: `scripts/qa/assistant-deck-move-qa.mjs` — 드래그·저장·재로드 복원·접힘 알약 자리·호스트 클램프·더블클릭 리셋·1px 클릭·blur 릴리스·도킹 신호까지 18개 실측, 산출물 `output/evidence/assistant-deck-move/`.

- **사용 로그는 그 자리에서 .txt 로 나온다 (2026-09-09):** 두 ☰ 표면에 「사용 로그 내려받기」(헤더 `ai-more-usage-log` / 컴포저 `ai-command-menu-usage-log`)를 둔다. 누르면 `listAiActivityLogs()` 를 `formatAiActivityLogText()`(`src/ai/activityLogText.ts`)로 옮겨 `text/plain;charset=utf-8` 블롭을 `ai-usage-log-<ISO, 콜론·점→하이픈>.txt` 로 떨어뜨린다. **왜 새로 만들었나**: 이 로그를 꺼내는 창구가 `npm run ai:log` CLI 와 테스트용 `serializeAiActivityLogs()` 뿐이어서, 조수가 뭘 했는지 확인하려는 사용자에게는 경로가 아예 없었다. 편집 활동 로그(`editActivityPanel`)에는 복사·내보내기가 있었으니 비대칭이기도 했다. 계약 셋 — ① **JSON 아니라 글**이다(한 턴이 한 문단: 지시·모델·맵·영역·결과 상세·자원 요약·도구 호출·대화 기록·진단), 기계 판독은 `serializeAiActivityLogs()` 가 그대로 맡는다. ② **조용히 자르지 않는다**: 지시문·응답·감사 기록은 길어도 전부 싣고, 로그가 이미 예산에 걸려 버린 몫은 `잘린 기록: …` 으로 적는다. ③ **기록이 0건이면 파일을 만들지 않는다** — 빈 파일은 "받았는데 아무것도 없다" 로 끝나므로 안내 토스트만 띄우고 `false` 를 돌린다. 서식(`src/ai/activityLogText.ts`)은 순수 함수라 패널을 세우지 않고 테스트하고, 동작(`src/editor/panels/aiUsageLogDownload.ts`)은 `src/ai` 가 아니라 패널 층에 둔다 — 토스트는 UI 이고 `src/ai` 는 토스트를 모르는 층이다. Tests: `test/aiUsageLogDownload.test.ts`(서식 계약 · 파일명 · 내려받기 · 빈 로그 · 두 표면). 로그 자체의 채널·보존 규칙은 `openwiki/editor-observability.md` 「AI 경로는 별도 채널이다」.

- **리뷰 후 입력·설정 경계 (2026-09-06):** 대화 로그의 `data-editor-navigation-owner`는 방향키·PageUp/Down·Home/End·Space만 소유하며 `shouldIgnoreEditorShortcut`가 맵 카메라로 새는 것을 막는다. 저장·도구·히스토리 단축키는 기존 경로를 유지한다. 맵 포인터의 `releaseTextEntryFocus`는 대화 영역/자식 포커스도 반납해 입력기 우회 없이 캔버스 탐색을 돌려준다. 스튜디오 진입은 전체 style 삭제 대신 `applySize()`로 크기만 정리해 배경 농도·글자 크기를 보존한다. 모호한 답변 링크는 전역 토큰을 바꾸지 않고 gold-deep 75% + text-1 25%로 rest/hover/focus 대비를 확보한다. 회귀: `aiConversationNavigation`, `aiStudioOpacityPersistence`, `test/e2e/ai-conversation-navigation.spec.ts`, `test/e2e/assistant-answer-link-contrast.spec.ts`.

- **최소 농도 전경 대비 (2026-09-06):** 전역 `--text-2` (`#475569`)는 78% 흰 유리/검정 배경에서 4.477905733201011:1로 AA 미달이다. `18-assistant-deck.css`의 float 전용 `--ai-deck-secondary`는 `--text-2` 85% + `--text-1` 15%이며, 레일·모드·모델·메타·추론·타일 캡션·접힘 상태 글자가 공유한다. studio/history에는 이 로컬 토큰을 정의하지 않고 기존 `--text-2`로 폴백한다. 레일 warning/success/error와 알약 warning/error 글자는 기존 의미색 60% + `--text-1` 40%로 보정한다(점·배경색은 그대로). 전역 색, range 78–100/기본 82, 전경 opacity 1, blur 20px/saturate 1.08을 바꾸지 않는다. 근거는 `output/evidence/p2-contrast/`: 실제 편집기 computed color와 조상 배경 합성, 검정/흰색 경계 및 맵 스크린샷 배경 표본. native select의 둥근 테두리 픽셀은 글자 배경이 아니므로 computed border-radius 안쪽 직선 영역에서만 표본을 뽑는다. 4.5 판정 전에 반올림하지 않는다.

- **Safe pipe tables (2026-09-06):** `src/util/markdown.ts` recognizes a header plus matching `:?-{3,}:?` delimiter cells, with optional outer pipes. Body rows must match the column count; malformed rows remain ordinary blocks. Escaped pipes and matching backtick runs do not split cells. Cells reuse the text-node/HTTP(S)-only inline renderer; alignment is a fixed left/center/right value, never untrusted HTML. `test/markdownTables.test.ts` covers parsing, inert payloads, adjacent blocks, streamed finalization and restored audit entries through `aiConversationLog` -> `renderAssistantAnswer`. `18-assistant-deck.css` owns horizontal overflow and table-cell wrapping: `th`/`td` use `white-space: nowrap`, `overflow-wrap: normal`, and `word-break: normal` so columns keep their natural width rather than inheriting paragraph wrapping. Do not force widths in the parser. The original 24-column browser repro at 1280×800 changed from client/scroll widths 590/590px with 110px-tall headers to 590/1837px with 24px-tall headers. Live streamed output, reload and manual history restoration each passed native horizontal wheel scrolling (scrollLeft 0→600) without document overflow. Local RED/GREEN evidence: `output/evidence/markdown-tables/css-24-red/` and `css-24-green/`; the 96-column diagnostic is not the acceptance case.

- **조수 배경 농도 (2026-09-06, clean-glass Phase 2):** 기존 AI 설정의 `표시` 절에서 글자 크기 옆 native range `배경 농도` (`ai-background-opacity`)로 78–100%, 1% 단위, 기본 82%를 조절한다. 숫자가 커질수록 불투명하다. `aiPanelLayout.ts`가 `oprn:ai-background-opacity`의 load/clamp/save/apply를 소유하고 패널 부팅에서 복원한다. 설정은 `input`/`change` 즉시 저장하며 주입된 패널과 현재 `.ai-chat-panel` 루트에 모두 적용하므로 패널 참조 없는 톱바 설정도 작동한다. 패널의 `--ai-background-opacity`가 기존 `--ai-deck-glass`를 통해 데크·접힘 알약 배경에만 반영된다. 글자 opacity는 조절하지 않고 blur 20px / saturate 1.08을 유지한다. 스타일은 **18-assistant-deck.css만** 편집한다. `.ai-chat-log`는 이름 있는 키보드 포커스 영역이자 유일한 세로 대화 스크롤러이고, 반투명 thumb는 hover/focus-within 때 진해진다. code/table 가로 스크롤·바깥 컴포저는 그대로다. 남은 액션 글리프는 `deckIcon` SVG, 중복 장식은 제거한다. Phase 1의 종료 정리·추천 미노출·독립 영역 승인 소유권은 그대로다. 회귀: `test/aiBackgroundOpacity.test.ts`, `test/e2e/assistant-clean-glass.spec.ts`의 `background opacity` 테스트. 증거: `output/evidence/assistant-clean-glass/phase-2/implementation.md`.

- **조수 표면은 데크 하나다 — 레일 · 대화 · 작업 타임라인 · 영수증 · 컴포저 (2026-09-03, 제안서 `docs/2026-09-03-ai-assistant-modern-ui-proposal.html`, 스펙 `docs/superpowers/specs/2026-09-03-assistant-deck-design.md`):** `aside.ai-chat-panel` 안에 `div.ai-deck[data-testid=ai-deck]` 래퍼를 두고 `aiDeckRail`(상태 점·이름·맵·상태 문장·아이콘 슬롯) → `.ai-chat-body` → `.ai-command-bar` 를 세로 flow 로 담는다. 기록 카드와 캡슐이 형제로 따로 뜨던 구조, `− 100% +` 기록 줌, 기록 높이 핸들(`oprn:ai-log-height`)은 걷었다. CSS 는 `18-assistant-deck.css`(셸·레일·대화·타임라인·컴포저·팝오버·알약)와 `19-assistant-cards.css`(영수증·체크리스트·넓은 뷰어)가 **단일 소유**이고 13~17 다섯 레이어는 삭제했다 — 같은 선택자를 덮는 20번 「수리」 레이어를 만들지 말고 18/19 를 고친다. 계약 요점:
  - **상태 하나**: `panel[data-ai-state]` = `idle|run|attention|done|error`. `setStatus` 의 톤(`statusToneOf`)을 `deckStateOfTone` 으로 사상하고, 승인/질문 대기·접힘 중 알림은 `attention`. 레일 점·문장, 알약(`setRestoreButtonState`: 상태 글자 + 개수 배지)이 함께 움직인다. 진행 중엔 레일 `::before` 헤어라인.
  - **버튼은 컴포저가 만들고 레일이 든다**: `createComposerElements` 가 새 대화·이전 대화·더보기·성향·맥락 버튼을 만들되 행에 넣지 않고 반환한다(`newChatButton conversationsButton menuToggle preferenceToggle preferencePopover`). 패널이 `rail.actions` 에 옮기고 ⋯ 메뉴·성향·맥락 팝오버는 `rail.root` 에 붙여 **위로** 연다(유휴 데크는 뷰포트 바닥 110px 이라 아래로 열면 잘린다). 바깥 클릭 판정은 `isInside: deck.contains` — 바 기준이면 레일 토글 재클릭이 닫고 다시 연다.
  - **컴포저 행**: 모드 세그먼트(`ai-composer-mode` — 강제는 세션이 한다. 아래 「컴포저 모드는 프롬프트가 아니라 하네스가 강제한다」) · 컨텍스트 핀 · 되돌리기 · 모델 칩(`ai-composer-model`, 초보 모드 숨김) · 34px 원형 보내기/멈추기. 키 힌트 글자는 입력창 `title`.
  - **작업 타임라인**: `renderToolActivityEntry` 가 `칩 · 라벨(aiToolLabels)/요약 · ✓` 세 칸 행을 만든다(함수 이름은 title). `appendToolLine(..., { live: true })` 는 그룹을 펼친 채 자라고 `closeToolActivity()` 가 접으며 헤더에 `작업 N단계 · 라벨 → 라벨` 요약을 쓴다. 복원 경로는 접힌 채 붙는다. 맵 칩은 `aiMapChip.regionFromToolCall`(x/y·w/h·rect·region·결과 data) → `chipWindow`(7×5 최소, 맵 안) → `renderRegionSnapshot` 92px. 라이브 행(`ai-activity-live`)은 완료 시 자식을 통째로 이어받는다(textContent 평탄화 금지).
  - **추천**은 데크 안 흐름(`.ai-composer-suggest` static): 감독 칩 + `맵 진단` 힌트 + `buildSuggestionRows`(rankAuthoringExamples — 길 없음→길, 사람 없음→NPC·상점) 3행. 단어 칩 6개 폐기.
  - **☰ 메뉴**: 아이콘 + 라벨(`.ai-command-menu-label`) + 메타(`.ai-command-menu-meta`). 「대기 화면」 3분기는 설정 모달 `extraSections`(`ai-settings-section-temperature`)로 이동 — testid `ai-command-temperature-*` 유지, e2e `assistant-single-dock` 갱신.
  - **삭제된 testid**: `ai-log-zoom* ai-log-chrome ai-log-resize-handle`. **폐기 CSS 변수**: `--ai-float-log-height --ai-float-log-offset`. 변경 카드 라벨은 `지금 / 적용 후`, 배지 `적용됨`.
  - Tests: `test/aiDeckRail.test.ts` `aiDeckIcons` `aiToolLabels` `aiMapChip` `aiComposerDeck` `aiDeckCss` `aiSuggestionRows` + 갱신된 `aiPanelChrome aiPanelGlassResize aiConversationLog aiChatObservability aiChatSessionScope aiPanelContextSurfaces aiPreferenceComposerButton aiStudioShell aiChangePreview conversationStore aiSharedSurface`. 캡처: `BASE=… [OUT_DIR=after] node scripts/capture-ai-assistant-current.mjs`, 목업 `scripts/capture-ai-assistant-mock.mjs`.
- **할 일 목록은 계획 수명이다 — 턴이 끝나도 남고, 모든 모드에서 보이고, 항목이 체크되며 진행한다 (2026-09-03):** 사용자가 조수를 「너무 오래 일한다」고 느낀 이유의 절반은 진행이 안 보이기 때문이었다. 세션은 이미 `WorkPlan`(레이어→항목 `pending/in_progress/done/skipped/blocked`)을 세우고 항목이 바뀔 때마다 `work_plan` 이벤트를 내지만(`assistantSession.ts` `emitWorkPlan` — 플래너 결정·`set/complete/skip_work_item` 툴·`advanceWorkPlanFromTools` 자동 완료), 패널의 체크리스트는 자율 런 표면에만, 「자세히」 서랍 안에만 그려지고 턴 끝에 `endAutonomousRun` 으로 걷혔다. `chat` 모드에서는 아예 안 떴다. 지금 계약(`aiChatPanel.ts` 「할 일 목록 표면」 절, `aiTurnRunner.ts` deps `workPlanSurfaceState/showWorkPlan/noteWorkPlanActivity/settleWorkPlanTurn`):
  - **시작**: `sendText` 가 `beginWorkPlanTurn({ autonomous, carriedPlan: session.getWorkPlan() })` — 세션의 **미완료** 계획은 이어받고(「계속」·중간 지시), 끝난 계획은 버린다. 예산(`used/48`)은 실제 자율 진입(`autonomous && !planPreview`)에만 세운다. `beginAutonomousRun`/`beginPlanPreview` 는 이 하나로 합쳤다.
  - **진행**: `work_plan` 이벤트마다 `showWorkPlan(plan)` 이 앞면을 다시 그린다 — 모드 무관. 새 `plan.id` 면 책 모달을 자동으로 연다(`openWorkPlanBook`). 같은 계획의 갱신은 열린 책만 다시 칠한다. `tool_started` 는 `noteWorkPlanActivity(toolLabel(name))` 로 **활동 줄(`ai-work-item-activity`)만** 갈아 끼운다(툴콜은 수백 번 오므로 전체 재렌더 금지 — 테스트가 같은 노드 유지를 단언한다).
  - **끝**: 러너가 완료·중단·오류 공통으로 `settleWorkPlanTurn()` — `active=false`, 목록은 남는다(「모두 완료」 또는 「<항목> — 대기 중」, `data-active`/`data-complete`). 계획이 한 번도 안 온 턴은 표면을 만들지 않는다.
  - **걷힘**: 대화 경계만 — 새 대화·대화 전환(`restoreConversationRecord`)·되감기·패널 해제가 `clearWorkPlanSurface()`(책 모달도 닫는다).
  - **렌더**: 데크 앞면은 `renderWorkPlanChecklist(plan, { active, budget, onStop, onOpenBook, activity })` — 상태 문장(`ai-run-status`) + `done/total` + 「계획 보기」(`ai-plan-book-open`) + 「중지」(`ai-run-stop` → `abortActiveTurn`) + 진행 막대 + 활동 줄. 「자세히」 서랍엔 칩·예산·목표·마일스톤 피드. **항목 본문은 커스텀 책 모달**(`aiWorkPlanModal` / `aiWorkPlanPages`): 표지(진행·목차) + 레이어마다 한 페이지(지시·완료 조건·상태 필). 이전/다음/점, Escape 는 `modalStack`. CSS 는 `19-assistant-cards.css` §4 `.ai-plan-book-*`(토큰만, hex/`!important` 0). 채팅에 📋 마크다운 보드를 덤프하지 않는다.
  - Tests: `test/aiWorkPlanBook.test.ts`(페이지 분해·표지→레이어·목차 점프·갱신 시 페이지 유지·닫기), `test/aiAutonomousRunSurface.test.ts`(턴 후 잔존·chat 모드 표시·새 계획 교체·모두 완료·중지 배선·활동 줄 갱신·모달 자동 open), `test/aiChatLeanUi.test.ts`(앞면 DOM), `test/e2e/ai-composer-mode.spec.ts` 「지시 모드」(목업 LLM 이 fill_region 2회 → 항목 두 개가 순서대로 체크되고 턴 뒤 `data-active=false`·`모두 완료`). 증거: `verify-shots/ai-composer-mode/do-mode-*.png`. 목 세션을 쓰는 패널 테스트는 `getWorkPlan(): null` 이 있어야 한다(턴마다 읽는다).
- **조수 적용 뒤 카메라가 맵 중앙으로 튕기지 않는다 (2026-09-01):** 프로그램 팬이 줌을 바꾸면(`planCameraFocus` 의 fit 줌) `editorState.set({ zoom })` → redraw → `applyCameraView` 가 **맵 한가운데 `centerOn`** 한 뒤 300ms 팬이 출발해서 "중앙 스냅 + 슬라이드"가 됐다. 같은 맵에서 줌·크기만 바뀌면 `preserveCameraLookAt` 으로 이전 look-at 을 유지한다(`planEditorCameraCenter`, `src/editor/cameraStability.ts`). 맵 전환은 그대로 한가운데. 조수 자동 이동(`onlyIfOffscreen`)은 이미 보고 있으면 줌을 낮추지 않는다. 가림 사각형은 투명 `ai-panel`(inset:0)을 세지 않고 `ai-command-bar` + 펼친 `ai-chat-body` 를 한 덩어리로 합친다(`filterAssistantOverlayRects` / `mergeNearbyRects`). 큰 창에서는 합쳐도 높이 60%를 못 넘기므로, 변에 붙은 열/띠는 교차 비율과 별도로 깎는다. 질문용 `highlight_map_region` 은 `onlyIfOffscreen` — `focus_editor_view` 와 답변 링크 클릭은 그대로 강제 이동. Tests: `test/cameraStability.test.ts`, `test/editorCameraFocusPlan.test.ts`, `test/cameraFocusViewport.test.ts`, `test/editorReferenceNavigation.test.ts`, `test/e2e/editor-zoom-preserves-look-at.spec.ts`.
- **스튜디오 덱 탭은 처음 나타날 때만 열고, 스튜디오 입력줄은 데크 컴포저 크롬을 쓴다 (2026-09-04):** `setWorkPlan`/`setChangePreview` 가 매 갱신마다 작업/변경 탭으로 강제 전환해서 도구·활동에 머무를 수 없었다. 빈 값 → 값 첫 등장에만 연다(plan→plan, input→input 은 그대로). 컴포저는 `.ai-deck` 밖으로 `.ai-studio-composer` 에 재부모화되어 `.ai-deck .ai-composer` 규칙이 안 먹었다 — `18-assistant-deck.css` 가 `:is(.ai-deck, .ai-studio-composer)` 로 같은 크롬을 준다. Spec §9: `docs/superpowers/specs/2026-09-03-ai-studio-console-design.md`. Tests: `test/aiStudioShell.test.ts`(21).
- **스튜디오 덱 접힘은 행을 줄이고, 부팅 모니터는 캔버스를 다시 입양한다 (2026-09-04):** 접힌 `.ai-studio-deck` 이 `var(--studio-deck-h)` 그리드 행을 남겨 모니터 아래가 빈 섬이 됐다. `.is-collapsed` 가 `grid-template-rows` 를 손잡이+40px 머리로 줄인다. 덱 손잡이는 `prepend` 로 덱 안 첫 자식이라 형제 `+` 선택자는 죽어 있었고 자손으로 숨긴다. 접힌 장면·조수 손잡이는 `display:none`(탭 순서·히트테스트에서 제거. `grid-template-columns` 의 8px 트랙은 남는다). persist `oprn:ai-studio=1` 부팅은 attach 때 `edit-canvas` 가 아직 document 에 없어 빈 자리가 고정됐다 — `refreshMonitor` 가 빈 자리 + document 의 캔버스/줌을 보면 `adoptLiveMap` 을 다시 부르고, attach 가 그 재시도를 다음 microtask 로 한 번 건다. Spec §8: `docs/superpowers/specs/2026-09-03-ai-studio-console-design.md`. Tests: `test/aiStudioShell.test.ts`(접힘 클래스 · attach 이후 입양).
- **스튜디오는 「장면 콘솔」이다 (2026-09-03, PR 대기):** 바닥(`--bg-inset`) 위 네 섬(`--bg-raised`, 12px) — 장면 레일 252px | 모니터 | 조수 400px, 아래 덱. 스크롤 소유자는 영역마다 하나(`ai-studio-scene-list` · Phaser 캔버스 · `.ai-chat-log` · `ai-studio-deck-pane`). **장면 레일**: 실제 맵 썸네일(`createMapThumbnail`, testid `ai-studio-thumb-<id>`) + 이름 + 「W×H · 이벤트 N」 메타 + 「시작」 배지, 검색(`ai-studio-scene-search`, 입력 중 폴더 평탄화), ＋ 새 장면(`ai-studio-scene-add` → `addMap(20×15)` 뒤 `selectEditorMap`). 실내는 배지가 아니라 들여쓰기(`--scene-depth`)와 `data-kind="interior"` 로만 말하고, 부모 행 접기(`ai-studio-scene-fold`)로 기본 숨긴다 — 15행에 같은 배지가 반복되면 소음이다. 장면 레일·조수 열은 각각 `ai-studio-scenes-collapse` / `ai-studio-chat-collapse` 로 52px 까지 접어 모니터를 넓힌다. 에디터 좌측 도크(초보 레일 `--z-rail:50`)가 스튜디오를 가리지 않게 `body.ai-studio-open` 에서 `.left-panel` 을 숨기고 호스트를 `--z-flyout` 으로 올린다. **모니터** 머리띠: 장면 이름(`ai-studio-monitor-label`) + 칩(`ai-studio-monitor-meta`) + 입양한 줌 스테퍼(26px 로 축소) + **편집기로**(`ai-studio-exit` → `onExit`). 좌하단 알약 라벨 삭제. **조수**: 상태 점(`ai-studio-status[data-state=idle|busy]`, 유휴 「대기 중」 — 예전엔 유휴에도 「장면을 만들고 있음」) + 로그가 빌 때만 보이는 브리핑(`ai-studio-briefing`: `readAgentBrief` 맵·크기·이벤트·부족, `directorStartPrompts` 3개 `ai-studio-suggest` → `onSuggest` 로 입력줄만 채움; MutationObserver 가 로그 자식을 감시). 스튜디오에서는 컴포저 키 힌트를 `display:none`(visibility 만 숨겨 156px 를 차지해 「맥락」 칩이 잘렸다) 하고, 포커스 팝오버의 감독 프롬프트 3개(`ai-composer-chips`)를 숨긴다(브리핑과 중복). **덱**: 탭 4개(도구 · 작업 `done/total` · 변경 ● · **활동** n — `setToolLines` 가 실제로 그린다, 예전엔 `void`), 도구 필터(`ai-studio-tool-filter`, 이름·라벨·설명 부분일치), 「모든 도구」(`openToolBrowserModal`), 접기(`ai-studio-deck-collapse`, `is-collapsed`). 도구 판 = 「자주 쓰는」(FREQUENT+STUDIO_EXTRA) + 카테고리별 `<details>`. 작업 판 = 목표 + `done/total` + 진행 막대(`transform: scaleX(--progress)`) + 상태 점. 라벨 「됨/중」→「완료/진행 중」. 아이콘은 전부 `renderEditorIcon`(SVG) — 이 시트가 `.ai-studio-shell .ee-icon` 크기를 다시 준다(이벤트 편집기 시트는 `.event-*` 스코프). CSS 는 같은 파일 한 층, 새 hex/`!important` 0. 실측 1440×900·1280×720 넘침 0. Spec: `docs/superpowers/specs/2026-09-03-ai-studio-console-design.md`. Tests: `test/aiStudioShell.test.ts`(21).
- **스튜디오는 타일 에디터가 아니라 연출 워크스페이스다 (2026-09-01):** 기본 조수는 여전히 캔버스 위 입력줄 캡슐(`chat-dock-float`). `is-studio` 만 전면이 바뀐다. 레이아웃은 왼쪽 **장면 목록** | 가운데 **살아 있는 맵 에디터**(Phaser `edit-canvas` 를 모니터 칸으로 재부모화 — 썸네일 그림이 아니다. 줌·팬·클릭이 그대로다) + 아래 **AI 도구 덱**(자주 쓰는 툴 카드, 클릭하면 입력줄을 채운다. 작업/변경 탭은 보조) | 오른쪽 **전고 채팅**. 패널이 `.canvas-area` 안이라 스튜디오는 `position:fixed; inset:48px 0 0 0`. **진입은 에디터 맨 위 「스튜디오」**(`topbar-ai-studio`). 숨은 훅 `ai-studio-toggle`. 조수 ☰ 에 두지 마라. 끌 때 캔버스·줌 툴바를 원래 자리로 되돌린다. Owner: `src/editor/aiStudioMode.ts` + `aiStudioShell.ts` + `08-studio-mode-start-screen.css`. Tests: `test/aiStudioShell.test.ts`, `test/aiLogSlot.test.ts`.
- **조수 ☰ 는 다른 크롬에 없는 항목만 둔다 (2026-09-01):** 컴포저 ＋ / 🕒 / ↶ 과 겹치던 새 대화·이전 대화·되돌리기, 에디터 맨 위로 옮긴 스튜디오, 삭제된 스킬 서러의 가르치기 3종(맵 인터뷰·선택 영역 학습·시연)을 메뉴에서 뺐다. 남는 것은 맥락 압축 · 감독 지침 · 내보내기 · 전체 기록 · 툴 브라우저 · 설정. `createAiActionMenuItems` (`aiActionMenu.ts`). Tests: `test/aiChatPanelUxRepairs.test.ts`, `test/aiPanelContextSurfaces.test.ts`.
- **컴포저 모드는 프롬프트가 아니라 하네스가 강제한다 (2026-09-03):** 모드는 `src/ai/composerMode.ts` 의 `"do"|"ask"|"plan"` 하나로 정의하고(패널 `aiComposer` 가 여기서 import), 패널이 `sendUserMessage(…, { composerMode })` 로 넘긴다. 세션 계약:
  - **질문(ask)**: 의도 선언을 `mode:"question" needsPlan:false` 로 덮어쓰고(`applyComposerModeToIntent`), 플래너를 건너뛰고(`plannerSkipReasonFor` → `composer:ask`), 툴 스키마에서 쓰기 툴을 **뺀다**(`isWriteToolName` = 레지스트리 `mode:"write"` ∪ 세션 전용 `set_build_spec`·WorkPlan 4종). 모델이 외워 둔 쓰기 툴을 그래도 부르면 실행 직전에 거부한다(`composerAskRefusal`, `issues[].code = "composer-mode-ask"`) — 노출 목록(`tools:exposed` 감사)은 감사용이고 실행은 이름으로 하므로 게이트가 따로 있어야 한다.
  - **계획(plan)**: 오케스트레이션이 꺼져 있고 선언이 `needsPlan:false` 여도 플래너를 **항상** 돌린다. 플래너가 `direct` 를 내거나 응답을 해석하지 못하면 `adoptFallbackWorkPlan` 이 1항목 최소 계획을 세운다. 이 턴에 계획을 새로 세웠으면(`planAuthoredThisTurn`) 툴 루프에 들어가지 않고 계획 보드 + 「계속」 안내만 돌려준다(`finishPlanOnlyTurn`, 감사 `턴 종료(final) — composer:plan 계획만 수립`). 자율 진입도 그 턴 뒤 자동 계속하지 않는다(`lastTurnPlanOnly`). `resume`(사용자 「계속」)은 그대로 실행된다.
  - **지시(do)**: 종전 그대로. `[컨텍스트]` 꼬리에 아무것도 덧붙이지 않는다.
  - **패널 쪽 함정 두 개(e2e 실측)**: (1) [상위 갱신 2026-09-03 「할 일 목록은 계획 수명이다」] 예전에는 계획 체크리스트(`ai-work-plan-checklist`)가 자율 런 표면에만 그려지고 턴 끝에 걷혀서 계획 모드만 `beginPlanPreview()` 로 예외 처리했다. 지금은 모든 턴이 `beginWorkPlanTurn({ autonomous, carriedPlan })` 하나를 타고 턴이 끝나도 목록이 남으므로 예외가 없다 — 계획만 세운 턴은 `active=false` 로 「… 대기 중」 상태의 목록이 남고, 활성 계획이 있는 「계속」은 예산이 붙은 자율 런이다. (2) 완성도 린트(`proposalCompletenessWarnings`)는 문장 휴리스틱으로 「변경 기대」를 재서 질문·계획 턴에 「⚠ 미이행: 실제 변경이 없습니다」를 붙였다 — 러너는 `runOpts.composerMode !== "do"` 이믄 린트를 건너뛴다.
  - 왜 이렇게 바꿨나: 예전에는 모드가 `[컨텍스트]` 꼬리의 한국어 한 문장뿐이라 쓰기 툴이 그대로 노출됐고 승인 게이트도 없어(`approvalPolicy` 는 카드를 폐기했다) 질문 모드에서도 맵이 바뀔 수 있었고, 계획 모드는 같은 턴에 계획을 쓴 뒤 곧바로 실행했다. 꼬리 문장은 안내로만 남긴다 — 의도 선언·툴 언급 스캔은 `options.instruction`(꼬리 제거 원문)만 보므로 꼬리로는 라우팅을 못 바꾼다.
  - Tests: `test/aiComposerModeSession.test.ts`(노출 필터·쓰기 거부·계획만 수립·「계속」 실행·do 회귀), `test/aiChatPanelComposerMode.test.ts`(칩→옵션 배선), 실표면 `test/e2e/ai-composer-mode.spec.ts`(목업 LLM 이 `fill_region` 을 내도 셀 불변 / 계획 체크리스트만). 증거: `verify-shots/ai-composer-mode/`.
- **턴 라우팅은 의도 선언 하나가 정한다 (2026-09-03):** 패널 `sendText` 는 사용자 발화 + `[컨텍스트]`(현재 맵·선택 영역·재료 라벨 예)만 보내고 `session.sendUserMessage(payload, …, { autonomous, instruction: 원문, scope: 선택 사각형, composerMode })` 로 원문·스코프·모드를 사실로 넘긴다. 「도구 규칙」 블록은 없다(툴 설명으로 이관). 세션 생성 시 `declareIntent: createLlmIntentDeclarer()` 를 넣고, 영역 작업 러너는 `isRegionEscapingIntent` 대신 같은 선언(`intentEscapesRegion`, 캐시 공유)으로 실내/새 맵을 채팅 경로로 우회한다. 아래 「도구 규칙 공유(2026-08-31)」「영역 작업 플래너 스킵(protocol-lock)」「bare 집 → 야외 집 직시공」「집 vs 실내 의도 확인(intentClarify)」 서술은 이 날짜 이전 상태다 — 자세한 것은 `editor-ai-tools.md` 첫 항목과 설계 노트 `docs/superpowers/specs/2026-09-03-llm-intent-routing-design.md`.
- **짧은 턴은 플래너를 건너뛰고, 도구 사이에는 화면을 한 프레임 양보한다 (2026-08-31):** `agentMode auto` 가 매 턴 플래너 LLM 을 돌리면 "여기 나무 심어줘" 도 `플래너가 작업 분해를 판단 중…` 에서 수 초를 태운다. `plannerSkipReason`(`src/ai/plannerSkip.ts`)이 사용자 발화만 보고 스킵을 정한다 — 질문, 선택 영역, 영역 작업 protocol-lock, 72자 미만이면서 마을/퀘스트/여러 맵/**RPG 볼륨** 표지가 없는 요청. `requestNeedsVolumePlan` 이면 짧아도 스킵하지 않는다. 진행 중인 WorkPlan 은 세션이 막는다(resume/replan). 스킵한 턴은 계획 툴·검수·Ralph 도 끈다. 감사 로그 `planner:skip <reason>`. 동기 `runTool` 앞에는 `yieldToUi`(`src/ai/yieldToUi.ts`)가 rAF 1틱을 내줘 라이브 행·고스트·맵 페인트가 한 프레임을 그린다 — Node/테스트는 즉시 resolve. Tests: `test/plannerSkip.test.ts`, `test/assistantSessionYield.test.ts`, `test/aiAssistantSession.test.ts` 오케스트레이션 게이트, `test/volumeContractSession.test.ts`.
- **캡슐은 유휴일 때 줄어들고 일할 때 넓어진다 (2026-08-31):** 도크를 되살리지 않는다. 빈 유휴는 입력줄 폭 `--ai-float-compact-width`(420px) 이고 로그 카드는 `max-height:0`. 포커스(`is-composer-focused`)·턴·대화(`is-assistant-log-open`)가 있으면 저장 폭(`--ai-float-bar-width`, 기본 640)으로 되돌리고 로그를 입력줄 위 카드로 펼친다. 패널 자신은 투명 — `inset:0` 이 맵을 크림으로 덮지 않게. 스튜디오·전체 기록은 이 기하에서 뺀다. CSS: `17-assistant-modern-shell.css`. Tests: `test/aiPanelExpandShrink.test.ts`.
- **입력줄 위 기록 카드는 같은 폭이고, 높이·글자를 줄일 수 있다 (2026-08-31):** `--ai-float-bar-width` 를 패널에도 심어 기록 카드가 입력줄 리사이즈를 상속한다 — 예전엔 변수가 캡슐 인라인이라 형제 `.ai-chat-body` 가 640px 폴백에 고정됐다. 기록 높이는 구 유리 카드 `oprn:ai-panel-size`.height 를 쓰지 않고 `oprn:ai-log-height` 다(옛 값 400~880 이 뷰포트를 삼킨다). 상단 핸들 `ai-log-resize-handle`(위로 끌면 커진다) + 카드 크롬 `− 100% +`(`ai-log-zoom`, 캔버스 줌 스테퍼와 같은 모양) + Ctrl/⌘+휠. 글자 3단 저장은 기존 `oprn:ai-font-size`. 짧은 뷰포트는 기록 `max-height` 를 32vh/320px 로 낮춘다. CSS: `17-assistant-modern-shell.css`. Tests: `test/aiPanelGlassResize.test.ts`, `test/aiChatObservability.test.ts`, `test/aiPanelLayoutResponsive.test.ts`.
- **조수는 입력줄 캡슐 하나다 — 도크 축(glass/side/float)을 걷었다 (2026-08-31, 아래 「유리 도크는 접힌 입력줄로…」(2026-08-30) · 「조수 접기·도크별 크기 조절」(2026-08-28) 두 항목을 상위 갱신한다):** 도크를 3개 두면 계약도 3배가 된다 — 기하·로그 마운트 슬롯·리사이즈 대상·접힘 의미·저장 키가 도크마다 갈라져 있었고, 그중 하나(side)는 실측에서 편집 캔버스를 **741×810 = 뷰포트 폭의 46.3%** 까지 밀어냈다(1600×1000 실측). glass 는 79.6% 를 남겼지만 카드가 캔버스 위 20.2% 를 덮었다. 지금은 float 캡슐만 남고 캔버스는 **1274×810 = 79.6%**, 조수가 덮는 면적은 입력줄 한 줄이다(`after/measure.json`). **side 도크가 먹던 533px 가 맵으로 돌아왔다.**
  - **삭제된 표면.** 명령 4개(`assistant-dock-glass|side|float`, `toggle-chat-dock`), 전환 진입점 5개(`chat-dock-toggle` 숨은 토글 · `ai-dock-mode-btn` 모드 배지 · `ai-chat-detach` 떼기 · 두 ☰ 메뉴의 「도크 전환」 항목 — 그래서 컴포저 메뉴는 5개→4개), `is-glass-folded` 접힘 축 전체(`applyGlassFold`/`scheduleGlassFold`/`GLASS_FOLD_IDLE_MS` 포함), `.ai-chat-side-panel` 호스트와 `--ai-chat-side-width`, side 전용 상승 오버레이·휘발 존(`risingOverlay`/`volatileZone` — before-side 에만 있었다), `resolveSideChatWidth` 의 preferred-폭 소유권. **지우는 이유는 「안 쓰니까」가 아니다** — 도크가 하나뿐인데 항목이 남으면 라벨이 「입력줄」로 고정된 채 눌러도 토스트만 떠서, 메뉴가 있지도 않은 선택지를 광고한다.
  - **남은 계약.** 붙은 곳을 읽는 창구는 `panel.dataset.chatDock` 하나이고 값은 `"float"` 로 고정 노출한다(레이아웃 테스트용). 접힘은 여전히 한 축뿐 — `ai-collapse` → `is-collapsed` → `oprn:ai-panel-collapsed` → `ai-collapsed-restore`. `ai-resize-handle` 은 항상 `ai-command-bar` 왼쪽 edge에서 **폭만** 바꾸고, 입력줄 높이는 textarea 행수 계약이 정한다. 기록 카드 높이는 별 핸들 `ai-log-resize-handle`. 폭 키는 `oprn:ai-panel-size` 하나로 합치고 구 `oprn:ai-panel-size:float` 만 이전용으로 읽는다(`aiPanelLayout.ts`). 구 `refreshDockLabels` 는 라벨 재계산이 본업이었으므로 `applyAssistantViewPolicy` 로 이름을 바꿨다.
  - **잃어버릴 뻔한 기능 2건(둘 다 되살렸다).** (1) 「다음에 뭘 하지」 블록(`ai-next-steps` = 안내 한 줄 + 저작 예제 칩)은 표시 조건이 `dock === "glass" || dock === "side"` 였다 — float 만 남기면 **영구히 도달 불가**가 된다. 유리 카드 본문에서 컴포저 추천 팝오버(`ai-suggest-popover`)로 옮겼고, 팝오버는 캡슐 폭(기본 640px)을 쓰므로 좁은 카드 때문에 4개로 잘라 뒀던 예제를 **6개 전부** 낸다. 팝오버가 열리는 조건도 `칩이 있을 때` → `칩이 있거나 next-steps 가 보일 때` 로 넓혔다. (2) 팝오버가 포커스만으로 자동 열리게 되면서 Escape 우선순위가 뒤집혀 선택 영역 칩을 지울 수 없었다 — **자동 열린 `suggest` 팝오버는 선택 작업이 살아 있는 동안 Escape 를 먹지 않는다**(`aiChatPanel.ts` 의 keydown 분기).
  - Tests: `test/aiSharedSurface.test.ts`(전환 진입점 0건 + dataset 고정), `test/aiPanelChrome.test.ts`(next-steps 위치·예제 6개), `test/aiPanelModernShell.test.ts`, `test/aiMoreMenuLayout.test.ts`(구 `aiGlassPanelWidth.test.ts` 에서 살아남은 CSS 계약 2개), `test/commandRegistry.test.ts`(도크 명령 4개 부재), E2E `test/e2e/assistant-single-dock.spec.ts`(구 `chat-dock-switch.spec.ts` 대체 — 1600/1100/900 폭과 새로고침에서 캡슐이 캔버스 안, 로그 마운트 1개, 접힘 왕복 지속). 삭제된 테스트: `test/chatDock.test.ts`, `test/aiGlassFold.test.ts`, `test/workspaceBarAssistantDock.test.ts`, `test/aiGlassPanelWidth.test.ts`, `test/e2e/_glass-dock-report.spec.ts`, `test/e2e/_assistant-glass-shots.spec.ts`, `scripts/qa/assistant-side-seam-hittest.mjs`(side seam 이 없다). QA: `scripts/qa/assistant-resize-collapse-qa.mjs` 는 캡슐 1회만 측정한다(대상 = `ai-command-bar`). 계측 재현: `node scripts/capture-hud-dock-collapse.mjs --tag <이름>` — 도크별 편집 캔버스 폭을 `getBoundingClientRect` 로 재고 표면 3컷을 찍는다(산출물은 저장소에 넣지 않는다).
  - 이 항목은 아래 2026-08-30 항목들 가운데 도크를 전제한 문장을 상위 갱신한다 — 「조수 패널의 크기 조절은 `aiChatResizeChrome.ts` 가 소유한다」(도크별 소유자 3종 → 캡슐 폭 한 축), 「유리 도크는 접힌 입력줄로 시작해 아래로 펼친다」(유리 카드 자체가 없다), 「☰ 메타 메뉴는 어느 도크에서도 숨지 않는다」(도크가 하나라 숨을 조건이 없다), 「접힘은 …」의 `GLASS_FOLD_IDLE_MS` 8초 유휴 접힘(삭제), 「잘림 게이트는 …」의 세 도크 × 세 상태 축(표면 한 장 × 세 상태로 줄었다).

- **답변 속 이름은 눌러 갈 수 있다 — 링킬은 마크다운이 아니라 **이름 색인**이 만들기 때문이다 (2026-08-30):** 조수가 `‘상인 하나의 집’(실내 맵 1초)` 처럼 저작물 이름을 말하면 그 이름이 그 자리로 가는 버튼이 된다. 모델에게 링킬 문법을 가르치지 **않았다** — UX 정상 정책이 답변에서 내부 ID 노출을 금지하므로(`promptPolicies.ts` 마무리 톤) `[라벨](oprn://map/…)` 같은 경로는 정책과 싸운다. 대슴 생산된 필수 경로는 산문 후처리다:
  - 색인과 탐색은 순수 모듈 `src/editor/aiAnswerLinks.ts` 가 소유한다(DOM·store·Phaser 미의지). `buildEditorReferenceIndex(project)` 는 맵 이름 + 이름 있는 맵 이벤트 페이지 이름을 **긴 이름 우선**으로 색인하고(그래서 `상인 하나의 집` 이 `상인 하나` 보다 이긴다), 같은 이름이 여러 곳이면 한 곳을 고르지 않고 `ambiguous` 로 남긴다 — 짐짝으로 다른 집에 데려가는 것은 거짓이다. 클릭은 이름을 및은 찾기 창(`openMapEventSearchModal({ initialQuery })`, 범위를 자동으로 전체로 올린다)을 열어 사용자가 고르게 한다.
  - **한국어 경계 계산이 이 기능의 진짜 난이도다.** 앞은 단어 문자면 거부(`새마을` 속 `마을`)하고, 뒤는 **완전한 조사 하나 + 보조사 하나까지** 소비한 다음 한글·단어 문자가 아닌 종결만 허용한다. 그래서 `집에서는`·`집으로도`·`집하고`는 링킬지만 `마을길`·`마을회관`·`마을이장`·`마을도로`·`마을지도`는 링킬가 아니다. 경계를 "단어 문자가 아님"으로만 런토이면 한국어는 조사 앞에서 링킬가 전부 사라진다 — 상반 생산 답변은 거의 다 조사가 붙는다.
  - DOM 추가는 `src/editor/panels/aiAnswerLinkRender.ts` 의 `renderAssistantAnswer(text)` 하나다. 마크다운을 그린 뒤 **텍스트 노드만** 쓸고 `PRE/CODE/A/BUTTON` 서부트리는 건드리지 않는다(토큰 문법이 아니니 `renderMarkdown` 자식을 건드리면 세계관 배택·AI 문서 문서까지 전부 링킬가 된다). 조수/시스템 말풍서을 그리는 자리는 세 곳(`aiConversationLog.appendConversationBubble`, `renderStreamedMarkdown`, `aiChatPanel` 의 선택지 칩 재렌더)이고 세 곳 다 이 함수를 부른다 — 하나만 `renderMarkdown` 으로 되돌리면 그 경로에서만 링킬가 조용하게 사라진다.
  - 이동 자습은 `src/editor/editorReferenceNavigation.ts` 하나다(`navigateToEditorReference` / `focusEditorRegion`). 맵 링킬는 맵만 여고, 이벤트 링킬는 맵 전환 + 카매라 이동 + 잠깐 강조다. **`onlyIfOffscreen` 을 쓰지 않는다** — 사용자가 눌렀거나 물어서 시작된 이동이므로 "눌렀는데 아무 일도 없다" 가 더 나삜 실패다(`editorCameraFocus.ts` 의 상자 주석과 같은 판단). 사용자 제스섬 중 양보는 여전히 씨이 `shouldDeferCameraFocus` 로 한다.
  - **조수가 직접 화면을 여는 경로는 `focus_editor_view`**(`src/editor/tools/viewFocusTools.ts`, 순수 read). 이름(query)만 받아 **답변 링킬와 같은 색인**으로 해석하고(말한 곳과 가는 곳이 갈라지면 안 된다), 정확히 같은 이름은 더 긴 부분 일치보다 먼저 고른다. 정확한 이름이 없고 서로 다른 부분 이름이 여럿이면 아무것도 추측하지 않고 후보 이름들을 담은 `ambiguous` ToolError 를 되돌려 정확한 이름으로 다시 부를 수 있게 한다. 실제 이동은 `aiTurnRunner` 의 `tool_call` 분기가 `focusEditorRegion` 으로 한다(highlight_map_region 과 같은 관약). **도메인을 주지 말 것** — 도메인 없는 툴은 `exposedInDomains` 가 항상 통과시킨다. map 도메인에 핸하면 상한(40) 트림이 `set_scene_mood`·`create_transfer_pair` 같은 대표 도구를 밀어낸다(실산: `test/regionIntentExposure.test.ts` 보장 3건 실패).
  - `highlight_map_region` 은 이제 선택 사각형만 생장쟁는 것이 아니라 맵 전환·카메라까지 같이 옮긴다. 이전엔 강조 대상이 다른 맵이거나 화면 밖이면 툴은 성공하고도 사용자는 아무것도 보지 못했다.
  - 계약: `test/aiAnswerLinks.test.ts`(색인·경계·집합), `test/aiAnswerLinkRender.test.ts`(DOM·클릭·코드 제외), `test/editorReferenceNavigation.test.ts`(카메라·강조·삭제된 대상), `test/viewFocusTool.test.ts`(툴 해석 + **모드 5개 전부에서 노출 보장**).

- **접힘은 "조수가 아무것도 하지 않을 때"만 일어난다 — 판정은 `assistantEngaged()` 하나다 (2026-08-30):** 유휴 접힘(`GLASS_FOLD_IDLE_MS` 8초)과 유휴 레이아웃(`is-glass-idle`)이 각자 "바쁨"을 따로 세고 있었고 둘 다 진행 중인 **턴**만 봤다. 그래서 턴 밖에서 도는 작업이 접힘을 못 막았다 — 실측: 수동 맥락 압축(`compactContextNow`, 요약 LLM 콜 1회)은 `turnBusy=false` · `is-turn-running` 없음이라, 직전 턴이 걸어 둔 8초 타이머가 요약 도중 그대로 터져 `.ai-chat-body` 가 접혔다(진행 상황과 결과가 함께 사라진다). 지금은 `assistantEngaged()` 가 턴·진행 표시·압축·자율 런·대기 큐·적용 중·질문 대기를 한 곳에서 판정하고 `canScheduleGlassFold` 와 `syncGlassIdle` 이 **같은 함수**를 쓴다. 압축이 끝나면 그 자리에서 `scheduleGlassFold()` 로 유휴 대기를 다시 센다 — 막는 것이 아니라 미루는 것이다(감독 지시: "시간이 지나면 닫히는 건 알겠는데, 이게 작동중일 때도 닫히니까 문제임"). 계약: `test/aiGlassFold.test.ts`.
- **새 대화는 사용자가 누를 때만 생긴다 — 프로젝트 전환은 그 프로젝트의 마지막 대화를 이어받는다 (2026-08-30):** 리셋 코어는 `resetConversationState(reason)`(턴 포기 + 자기 스코프로 보관 + 세션·표면 정리 + 재스코프, 반환값은 "버릴 이야기가 있었는가")이고, 그 위에 진입점이 둘 있다. `startNewConversation("manual")` 은 컴포저 ＋ 와 액션 메뉴 전용이고, 신원 변경(`store.subscribe`)은 `adoptConversationForCurrentProject()` 로 간다 — 새 스코프의 최신 저장본이 있으면 `restoreConversationRecord(record, "auto")` 로 열고 없을 때만 빈 대화로 남는다. 왜: 부팅 지연 로드(로컬 신원 → 원격 durable id)도 신원 변경으로 보이므로, 예전 코드는 방금 자동 복원한 대화를 부팅마다 다시 비웠다. 안내는 정말 다른 대화를 밀어냈을 때(`hadConversation`)만 띄운다 — 부팅마다 토스트가 뜨면 소음이다.
- **부팅 자동 복원은 스코프별 최신을 본다 (2026-08-30):** `loadLatestConversation()`(전역 최신 1건)을 집어 스코프가 다르면 포기하던 판정을 `loadLatestConversationForScope(scope)` 로 바꿨다. 두 프로젝트를 번갈아 열면 남의 프로젝트 대화가 더 최근이라 **내 대화가 그대로 있는데도** 매번 빈 대화로 시작했다 — 사용자에게는 누르지도 않은 새 세션 강요로 보인다. 저장 배열은 최신이 앞이지만(prepend) 원격 미러·수동 병합으로 순서가 흐트러질 수 있어 `savedAt` 최댓값을 고른다. 계약: `test/conversationStore.test.ts`, `test/aiChatSessionScope.test.ts`.
- **이어가기 입구는 고정 액션 행에 산다 (2026-08-30):** `이전 대화` 모달(`aiConversationHistoryModal.ts`)은 ☰ 메뉴 안에만 있었다. 생성(＋)은 한 번에 닿는데 이어가기는 두 단계 — 그 배치 자체가 "새 세션" 을 기본값으로 만든다. 컴포저의 고정 행에 `ai-open-conversations`(🕒) 를 ＋ 바로 옆에 두고, 주입(`onOpenConversations`)으로 받는다(`preferenceContent` 와 같은 규약 — 컴포저가 대화 저장소를 직접 import 하지 않는다). ☰ 항목은 그대로 남는다.
- **조수 패널의 크기 조절은 `aiChatResizeChrome.ts` 가 소유한다 (2026-08-30):** 도크마다 사용자가 실제로 보는 크기의 소유자가 다르다 — glass 는 카드(패널 자신), side 는 에디터 셸 컬럼(그래서 폭 변경을 `onSideWidthPreview/Commit` 으로 셸에 넘긴다), float 은 컴포저 캡슐이다. 이 모듈은 패널의 대화·런 상태를 하나도 읽지 않고 표면 둘(패널·컴포저 바)과 세 질문("어느 도크인가 / 지금 만져도 되는가 / 유리 카드가 접혔는가")만 받는다. 세 질문은 반드시 **게터**로 받아야 한다 — `collapsed`·`glassFolded` 는 패널이 계속 갈아치우는 가변 클로저라 값으로 넘기면 호출 시점이 어긋난다. 패널에 남는 접점은 `applySize`·`mountHandle`·`dispose` 뿐이다.
- **답변이 한 글자씩 세로로 쓰이던 원인은 [선택지] 칩의 그리드 배치다 (2026-08-30):** `.ai-command-row` 는 `auto minmax(0, 1fr)` 두 칸 그리드고, `renderQuickReplies` 는 칩 상자를 **본문의 형제로** 줄 안에 꽂는다(`lastAssistant.after(chipsHost)`). 배치 규칙이 없으면 칩은 1열(프리픽스 칸)로 자동 배치되어 그 칸을 칩 폭(358px)만큼 벌리고, 본문 칸은 0px 로 눌린다 — 실측: 본문 rect 0×485, 마지막 답변이 열 오른쪽 끝에서 한 자씩 세로로 쓰였다. `.ai-command-row > .ai-quick-replies { grid-column: 1 / -1 }` 로 못 박는다(`04-chat-bubbles-proposals.css`). 줄에 무엇을 더 꽂든, 두 칸 그리드에서는 배치 규칙이 짝으로 필요하다(선례: `.ai-command-attachment { grid-column: 2 }`).
- **잘림 게이트는 "스크롤한 뒤에도 못 보는가"를 잰다 (2026-08-30):** `test/e2e/ai-panel-reachability.spec.ts` 가 세 독(side/float/glass) × 세 상태(기본·펼침·전역 기록) × 두 뷰포트에서 세 가지를 동시에 잰다: 잘림(조상 클리퍼·뷰포트 밖), 가로 밀림(로그가 가로 스크롤되면 모든 줄이 함께 밀린다), 본문 눌림(본문 폭 < 줄 폭×0.5). 함정 둘: (1) `scrollIntoView` 는 어느 스크롤러를 얼마만큼 움직일지를 브라우저 휴리스틱으로 정해 제품 결함과 분간이 안 된다 — 조상 스크롤러를 사람처럼 한 칸씩 움직인다. (2) 접힌 `<details>` 속은 Chromium 이 UA `::details-content` 를 `content-visibility: hidden` 으로 건너뛰면서도 자식의 **버려진 기하**를 되돌려준다 — 110px 부모 안의 344px 자식이라는 가짜 잘림 12건이 나왔고, `details:not([open])` 와 `content-visibility: hidden` 을 판정에서 제외해야 한다. 판정은 스크롤을 움직이므로 끝나면 원래 자리로 되돌린다 — 그러지 않으면 증거 스크린샷이 사용자가 보는 화면이 아니다.
- **패널에서 모듈로 본문을 옮길 때 기계적 접두 치환은 문자열 리터럴을 먹는다 (2026-08-30):** 3,422줄 패널을 분해할 때 클로저 참조를 `deps.` / `deps.surface.` 로 일괄 치환했는데, 정규식이 코드와 문자열을 구분하지 못해 `recordAiUiEvent({ surface: "panel" })` 가 `surface: "deps.surface.panel"` 이 됐다. `AI_UI_EVENT_SURFACES` 어휘에 없는 값이 재시도 클릭마다 UI 이벤트 링·`recordAiActivity(...).uiActions`·하니스 타임라인(`aiHarnessModal.ts`)에 그대로 적혔다 — 산문이 아니라 **기계가 먹는 값**이라 타입체크도 테스트도 잡지 못했다. 치환으로 본문을 옮기면 반드시 **문자열·템플릿·dataset·클래스명·저장 키·이벤트 이름을 리터럴 단위로** 상류와 대조하라(`git show origin/main:<파일>` 과 접두만 벗긴 본문 비교). 상류가 이미 고친 자리를 떼낸 상태로 병합할 때도 같은 함정이 반복된다.
- **잘림 게이트의 판정 자체가 틀릴 수 있다 — 함정 넷 (2026-08-30):** (1) **축을 합치면 안 된다.** 잘림 여부를 불리언 하나로 합치면 `overflow-x: hidden; overflow-y: auto` 상자에도 `scrollLeft` 를 쓰게 되고(Chromium 은 그 쓰기를 받는다) 가로로 못 보는 자료가 "스크롤하면 보인다" 로 통과한다 — 축마다 overflow 와 스크롤 여유(`scrollWidth > clientWidth + 1`)를 함께 봐야 한다. (2) **강제로 연 `<details>` 는 되돌려야 한다.** 독을 side→float→glass 로 한 페이지에서 순회하므로, side 에서 연 작업 기록·실패 상세가 float·glass 의 "기본" 상태 측정까지 열린 채 따라온다 — 열기 전 open 상태를 표로 기억해 독마다 복원한다. 툴 토글·턴 그룹도 같이 복원하고 `.ai-turn-group.is-collapsed` 로 확인한다. (3) **한 축만 0 인 요소를 건너뛰지 마라.** `height < 4 || width < 4` 로 걸러내면 이 페이지가 고친 눌림 계열(본문 rect 0×485)이 판정에서 빠진다 — 두 축이 다 작을 때만 장식으로 보고 건너뛴다. (4) **스크롤러의 가시 사각형은 자기를 자르는 조상들과의 교집합**이고, 보이는 영역보다 큰 요소는 가장자리마다 따로 끌어와 그 가장자리만 재야 한다(안 그러면 두 패스가 진동해 가짜 잘림이 잡힌다). 포화된 스크롤러도 그 순간에는 클리퍼이므로 `visibleBox` 와 `measure` 가 같은 술어를 써야 한다.
- **조수 패널은 클립이 아니라 스크롤러로 자료를 가린다 (2026-08-30):** 대화 열보다 넓은 것은 **자기 스크롤러**를 갖는다 — 마크다운 코드 펜스(`pre`)와 표(`table`)는 `display: block; max-width: 100%; min-width: 0; overflow-x: auto` 로 자기가 스크롤한다(`min-width: 0` 을 빼면 grid 트랙이 콘텐츠 폭으로 늘어난다). 상자가 `overflow: hidden` 으로 자르는 것은 스크롤 없는 지역을 만들 뿐이다(실측: side +250px, glass +197px, 1024폭 +383px).
- **☰ 메타 메뉴는 어느 도크에서도 숨지 않는다 — 삭제된 헤더의 전제가 CSS 에 남아 기본 도크에서 메타 기능 전부가 사라지다 (2026-08-30):** `02-chat-dock.css` 의 `display:none` 묶음이 `.ai-command-menu-toggle` 을 glass·side 에서 가리고 있었다. 그 규칙의 주석은 "유리·사이드는 헤더(더보기/설정)를 가지고 있고" 를 전제로 달렸지만, 2026-08-28 헤더 제거(`aiChatPanel.ts` 의 `.ai-chat-header` 밴드 삭제) 로 그 전제가 죽었다 — `.ai-chat-toolbar` 는 지금 `hidden + inert + display:none` 인 테스트 훅 컨테이너이고 `.ai-dock-mode-btn` 도 그 안에 있다. 그리고 `DEFAULT_CHAT_DOCK === "glass"` 다. 실측(`test/e2e/_aichat-bug-hunt.spec.ts`, 1440×900 기본 부트): glass·side 에서 `ai-command-menu-toggle` 이 `display:none rect 0×0`, float 만 30×30. `ai-dock-mode-btn` 은 세 도크 모두 rect 0×0. 결과 **기본 상태에서 되돌리기·내보내기·도크 전환·전체 기록·툴 및라우저·가르치기 3종이 모두 도달 불가** 었고, side 로 들어가면 도크를 되돌릴 수단조심 없어 탈짜다(Ctrl+K 팔레트나 에디터 상단 부 제외). 수정은 그 먹이 둘을 묶음에서 물리는 것 하나다 — 새 규칙을 만들지 않는다(토큰 및 판정은 그대로). 같은 사건에서 **패널에 AI 설정 진입점이 하나도 없던 것**도 닫았다: `aiActionMenu.ts` 에 `⚙ 설정` 항목(컴포저 testid `ai-settings-toggle`, 헤더 `ai-more-settings`, `aria-label="AI 설정 열기"`)을 달아 `openAiSettingsModal` 로 간다. 이전에는 401 오류 버벼의 [설정 열기]와 에디터 톱바 ⚙ 만 있었다(오류가 터지기 전엔 가능 경로가 아니다). 검증: 수정 후 같은 하네스에서 세 도크 모두 ☰ 30×30, ☰ 열면 9개 항목(`새 대화 | 되돌리기 | 내보내기 | 오른쪽/입력줄/카드 | 툴 및라우저 | ⚙ 설정 | 🎓 맵 인터뷰 | 📐 선택 영역 학습 | ✍️ 시연으로 가르치기`)이 각 504×34 로 보이며 도크 항목 라벨은 현재 도크에 맞게 바뀐다. 증거: `verify-shots/aichat-bug-hunt/REPORT.md` + PNG. Tests: `test/aiDockMetaReach.test.ts`(CSS 소스에 ☰ 숨김 규칙이 다시 생기면 붉은불 + 세 도크의 메뉴 항목 실재 + 설정 항목이 모달을 여는지), `test/aiChatPanelUxRepairs.test.ts`(설정 모달·aria-label). **설정 항목의 testid 는 `ai-command-menu-settings` 이다 — `ai-settings-toggle` 은 쓰지 않는다.** 도중에 드러난 계약 충돌: `test/aiChatPanelUxRepairs.test.ts`(2026-08-29)는 패널 에 `ai-settings-toggle` 이 **있기를** 요구하고, `test/aiChatPanelSettings.test.ts`·`test/aiAssistantUxP0P2.test.ts`(2026-08-30, 더 나중)는 그 id 와 `ai-settings-command-bar` 가 **없기를** 요구한다("조수 패널 크롬에 설정 단추를 중복해 놓지 않는다"). 나중 계약을 이기게 하고, 그게 금지하는 것은 “크롬 버튼” 이므로 ☰ **메뉴 항목**은 모순이 아니다 — 이는 `aiComposer.ts` 의 설계 지식("설정은 그 메뉴 안의 항목이다")을 그대로 구현한 것이다. 금지 계약은 `test/aiDockMetaReach.test.ts` 가 함게 못박아 다시 후퇴하지 않게 한다. 기사 문구 모지바키 도 같이 고쳤다: `타일 의믜→의미`, `선택 여역→선택 영역`, `구조밌→구조물`.

- **카메라와 AI 뷰포트는 `cameraVisibleArea()` 하나만 읽는다 — `camera.scrollX` 는 화면 좌상단이 아니다 (2026-08-30):** 기하의 단일 진실원은 `EditScene.cameraVisibleArea()` 다 — `camera.worldView` + `getBoundingClientRect()` 캔버스 rect + `unoccludedCanvasRect(canvas, 조수 오버레이 rect들)`(`src/editor/cameraFocusViewport.ts`, 오버레이가 한 변의 60% 이상을 가로지르면 그쪽을 인셋한다. 60% 비율이 어느 변을 깎을지 정하고 `minSpanPx`(64px)는 남는 조각이 눈으로 보기 어려울 때만 깎기를 거부한다 — 예전 기본값 240px 은 실측 600×500 캔버스에서 폭 360px 카드 오른쪽에 남는 228px 을 버려 목표를 다시 카드 뒤로 보냈다). 카메라 팬 목표와 AI 뷰포트 스냅샷이 **둘 다 이 함수를** 소비한다. 어느 쪽도 `camera.scrollX` 에서 다시 유도하지 마라 — Phaser 3.60+ 에서 `worldView.x = scrollX + width/2 - width/(2*zoom)` 이므로 줌 1 이 아니면 둘은 다른 점이다. 실측한 결함: `publishMapViewport` 가 `camera.scrollX` 를 월드 좌측으로 넘겨, **기본 줌 2** · 1133×700 캔버스 · scroll (400,300) 에서 사용자가 (60,40) 을 보는 동안 스냅샷은 중앙 타일을 **(42,29)** 로 보고했다(18칸 왼쪽·11칸 위). 그 스냅샷이 통행 그리드와 뷰포트 이미지까지 만들므로 모델은 틀린 영역을 설명받았다. **가림**: 기본 도크(`DEFAULT_CHAT_DOCK`, `chatDock.ts`)는 캔버스 위에 절대 배치되는 유리 카드라, 목표를 **전체 캔버스** 중앙에 두면 카드 뒤로 들어간다 — `cameraLookAtForTarget` 이 look-at 을 `(unoccludedCenter - canvasCenter)/zoom` 만큼 민다. side 도크는 캔버스 옆 형제 컬럼이므로 rect 가 캔버스와 교차하지 않아 자동으로 걸러진다. **가시 타일 사각형은 이제 분수**다 — ceil/floor 로 깎으면 99% 보이는 타일이 버려져 `planCameraFocus` 가 화면 안 대상을 화면 밖으로 판정했다. 그리고 `visible === null` + `onlyIfOffscreen` 은 "항상 이동"이 아니라 **"움직이지 않는다"** 다(판정 불가를 이동으로 바꾸면 사용자가 보던 화면을 빼앗는다). `planCameraFocus` 는 대상 사각형의 **정확한 중심**(`centerTileX`/`centerTileY`, 분수)과, 대상이 안 들어갈 때만 `EDITOR_ZOOM_LEVELS`[0.25,0.5,1,2,3,4,6,8] 중 하나인 `zoom` 을 낸다 — 소비자는 **+0.5 를 더하면 안 된다**. 옛 floor 후 +0.5 짝은 짝수 크기 영역에서 반 타일(8px) 오차였다. 제스처 때문에 `shouldDeferCameraFocus` 로 미룬 초점은 **슬롯 하나**에 담아 제스처가 끝날 때 **정확히 한 번** 재생한다(`pointerup`·`pointerupoutside`·우클릭 영역 종료·팬 정지(스페이스 키 해제·창 `pointerup`/`mouseup`)·붙여넣기 확정·붙여넣기 취소(캔버스 우클릭·Escape·선택 칩 닫기)), 맵 전환과 씬 정리에서는 버린다. 뷰포트 스냅샷은 **팬이 도는 매 프레임** 게시하고(예전엔 300ms 동안 출발 지점이 사실이었다) 마커·팔레트 청소는 `progress === 1` 에만 둔다 — DOM 마커를 매 프레임 갈면 인라인 승인 툴바가 깨진다. E2E 훅: `__oprnEditMapViewport()` → 게시된 `MapViewportSnapshot{mapId,centerX,centerY,x,y,w,h}`, `__oprnEditVisibleArea()` → `{canvas, unoccluded, worldView, zoom}`(worldView 만 월드 px, 나머지는 CSS px). 스펙은 카메라 산수를 직접 재계산하지 말고 이 둘과 `__oprnEditWorldToClient` 를 써라 — `test/e2e/mode-switch-camera-stability.spec.ts` 와 `test/e2e/_probe-event-editor.spec.ts` 는 아직 `scrollX` 규약으로 화면 좌표를 만들며 **줌 != 1 에서 틀리다**. 같은 함정을 오버레이 계열에서 네 번 고쳤다(ffd7b1e1·017f6a28·54776d72·99604ffc). Owner: `src/editor/cameraFocusViewport.ts`(순수), `src/editor/editorCameraFocus.ts`, `src/editor/EditScene.ts`.

- **유리 도크는 접힌 입력줄로 시작해 아래로 펼친다 (2026-08-30):** 감독 지시 — "기본적으로는 접혀져있다가, 클릭하거나 내용이 나와야 하는 경우만 아래로 자연스럽게 나오는 방식". 패턴 이름: progressive disclosure(원칙) / disclosure 패널(컴포넌트) / 남는 한 줄이 trigger, 아래로 흐르는 본문이 flyout / 입력줄이 위인 형태는 command-palette 형(Spotlight·Raycast). **`is-collapsed`(48px 칩)와 다른 축의 새 상태 `is-glass-folded` 이고 glass 에서만 쓴다** — fold 는 `.ai-chat-body` 만 접고 컴포저와 완료 스트립(`.ai-rising-sticky-zone`, [되돌리기])은 남긴다. side·float 은 손대지 않으며 `ai-collapse` / `oprn:ai-panel-collapsed` / `ai-collapsed-restore` 계약이 그대로다. 대신 **glass 에서는 `ai-collapse` 셰브론이 fold 토글로 의미가 바뀌고**(testid·`aria-expanded` 배선은 유지, 라벨만 `조수 대화 접기/펼치기`), 저장된 `oprn:ai-panel-collapsed === "1"` 도 칩 접힘이 아니라 fold 로 라우팅된다(멱등, 새 키 없음). **fold 자체는 저장하지 않는다** — 유휴 자동 접힘이 있으면 "펼침"은 안정된 사용자 선택이 아니라 낡은 키가 될 뿐이다. 기하: 앵커 `inset: 12px auto auto 12px`(`02-chat-dock.css`)를 **움직이지 않는다** — 좌하단으로 내려가는 `is-collapsed` 와 달리 같은 자리에서 아래로 열리는 것이 이 상태의 핵심이다. 순서 뒤집기는 DOM 이 아니라 glass 전용 `order`(컴포저 -1 / 스티키 0 / 본문 1)로 하고, 여닫기는 `max-height: 100vh ↔ 0` 이다 — `grid-template-rows: 0fr→1fr` 은 본문의 `flex: 1 1 auto`(`02-chat-dock.css`) 와 싸워 펼칠 때 카드가 즉시 최대 높이로 튀고, `height: auto` 도 같은 이유로 못 쓴다. `max-height` 는 flex used size 를 덮으므로 스크롤러(`.ai-chat-log`)를 한 줄도 건드리지 않는다. 인라인 크기는 `applySize` 가 **높이만** 비우고 **폭은 유지**한다(안 그러면 CSS `clamp(360px,38vw,520px)` 로 돌아가 펼칠 때 폭이 튄다). CSS 는 `17-assistant-modern-shell.css` 끝의 fold 섹션 — 새 파일을 만들지 않는 이유는 `check-css-budget.mjs` 가 `cssFileCount` 를 262 로 래칫하기 때문이고, 이 파일이 조수 셸 기하의 마지막 레이어라 캐스케이드 위치가 같다. **접힘 높이 규칙은 `:not()` 짝을 반드시 달아야 한다**: `13-assistant-modern.css:15` 가 `height: min(620px, calc(100% - 24px))` 를 (0,7,0)/(0,6,0) 으로 선언하므로, 짧게 `.chat-dock-glass.is-glass-folded`(0,3,0) 로 쓰면 본문이 `max-height: 0` 으로 접혀도 카드는 620px 로 남는다(실측: 접힘 rect 520×620, 컴포저 156px). 같은 `:not(.is-history-open):not(.is-studio):not(.is-collapsed):not(.is-map-first-idle)` 를 달아 (0,8,0)/(0,7,0) 으로 올린 뒤 접힘 rect 가 **520×174**(컴포저 156 + 카드 인셋)로 줄었다 — 근거 `.omo/evidence/assistant-glass-fold/measure.json`. 같은 실측에서 펼친 뒤 `.ai-chat-log` 는 `clientHeight 392 / scrollHeight 681`, `scrollTop 0→200` 으로 살아 있어 `max-height` 여닫기가 안쪽 스크롤러를 죽이지 않음을 확인했다(1280×720 에서도 352/681). 상단 중앙 도구막대는 `elementFromPoint` 로 `tool-select` 가 패널에 덮이지 않음을 두 해상도에서 확인했다. **자동 재접힘은 2026-08-27 에 걷어낸 동작의 부분 복원이다**(아래 항목 참조): 턴 종료 후 `GLASS_FOLD_IDLE_MS`(8s, `aiPanelLayout.ts`) 유휴면 접는다. 그때 문제(답이 48px 얼굴 뒤로 사라짐)를 막는 안전핀 — 입력줄은 절대 숨지 않고, 무장(armed)은 **턴 종료에서만** 하므로 셰브론으로 직접 펼친 것은 마우스가 떠나도 닫히지 않으며, 실패한 턴(`is-turn-error`·`failed`)·진행 중 턴·답 대기 질문·비어 있지 않은 입력·패널 내부 포커스·포인터 hover·바닥에서 4px 이상 올라간 로그(위로 읽는 중)에서는 접지 않고, `keydown`·`input`·`focusin`·`wheel`·`scroll`·`pointerleave` 는 대기를 처음부터 다시 센다. 접힌 본문은 `inert` 로 Tab 순서에서 빠진다. **활성 브라우저 계약:** `test/e2e/editor-ai-authoring-entry.spec.ts` 는 퇴역한 상태바 버튼을 찾지 않고, `topbar-ai-settings` 에서 현재 제공자를 확인한 뒤 접힌 glass 카드의 `ai-collapse` disclosure 로 화면에 출하되는 네 저작 예제와 입력 prefill 흐름에 진입한다. 여섯 항목 전체 카탈로그는 `test/aiStartScreenCards.test.ts` 가 별도로 고정한다. `ai-connection-status` / `ai-authoring-entry` 를 다시 만들거나 테스트 전용으로 마운트하지 않는다. Owner: `aiChatPanel.ts` 의 `applyGlassFold`/`scheduleGlassFold`/`canScheduleGlassFold`. Tests: `test/aiGlassFold.test.ts`(계약 전부), `test/aiPanelAutoExpand.test.ts`(glass 라우팅 + side 칩 축), `test/aiPanelChrome.test.ts`, `test/aiPanelGlassResize.test.ts`(접힘 시 폭 유지·높이 해제).

- **유리 도크는 접힌 입력줄로 시작해 아래로 펼친다 (2026-08-30):** **(2026-08-31 에 상위 갱신됨 — 맨 위 「조수는 입력줄 캡슐 하나다」 항목을 먼저 읽어라. 아래는 도크 축이 있던 시절의 기록이며, glass/side 를 가리키는 문장은 지금 코드에 대응하는 표면이 없다.)** 감독 지시 — "기본적으로는 접혀져있다가, 클릭하거나 내용이 나와야 하는 경우만 아래로 자연스럽게 나오는 방식". 패턴 이름: progressive disclosure(원칙) / disclosure 패널(컴포넌트) / 남는 한 줄이 trigger, 아래로 흐르는 본문이 flyout / 입력줄이 위인 형태는 command-palette 형(Spotlight·Raycast). **`is-collapsed`(48px 칩)와 다른 축의 새 상태 `is-glass-folded` 이고 glass 에서만 쓴다** — fold 는 `.ai-chat-body` 만 접고 컴포저와 완료 스트립(`.ai-rising-sticky-zone`, [되돌리기])은 남긴다. side·float 은 손대지 않으며 `ai-collapse` / `oprn:ai-panel-collapsed` / `ai-collapsed-restore` 계약이 그대로다. 대신 **glass 에서는 `ai-collapse` 셰브론이 fold 토글로 의미가 바뀌고**(testid·`aria-expanded` 배선은 유지, 라벨만 `조수 대화 접기/펼치기`), 저장된 `oprn:ai-panel-collapsed === "1"` 도 칩 접힘이 아니라 fold 로 라우팅된다(멱등, 새 키 없음). **fold 자체는 저장하지 않는다** — 유휴 자동 접힘이 있으면 "펼침"은 안정된 사용자 선택이 아니라 낡은 키가 될 뿐이다. 기하: 앵커 `inset: 12px auto auto 12px`(`02-chat-dock.css`)를 **움직이지 않는다** — 좌하단으로 내려가는 `is-collapsed` 와 달리 같은 자리에서 아래로 열리는 것이 이 상태의 핵심이다. 순서 뒤집기는 DOM 이 아니라 glass 전용 `order`(컴포저 -1 / 스티키 0 / 본문 1)로 하고, 여닫기는 `max-height: 100vh ↔ 0` 이다 — `grid-template-rows: 0fr→1fr` 은 본문의 `flex: 1 1 auto`(`02-chat-dock.css`) 와 싸워 펼칠 때 카드가 즉시 최대 높이로 튀고, `height: auto` 도 같은 이유로 못 쓴다. `max-height` 는 flex used size 를 덮으므로 스크롤러(`.ai-chat-log`)를 한 줄도 건드리지 않는다. 인라인 크기는 `applySize` 가 **높이만** 비우고 **폭은 유지**한다(안 그러면 CSS `clamp(360px,38vw,520px)` 로 돌아가 펼칠 때 폭이 튄다). CSS 는 `17-assistant-modern-shell.css` 끝의 fold 섹션 — 새 파일을 만들지 않는 이유는 `check-css-budget.mjs` 가 `cssFileCount` 를 262 로 래칫하기 때문이고, 이 파일이 조수 셸 기하의 마지막 레이어라 캐스케이드 위치가 같다. **접힘 높이 규칙은 `:not()` 짝을 반드시 달아야 한다**: `13-assistant-modern.css:15` 가 `height: min(620px, calc(100% - 24px))` 를 (0,7,0)/(0,6,0) 으로 선언하므로, 짧게 `.chat-dock-glass.is-glass-folded`(0,3,0) 로 쓰면 본문이 `max-height: 0` 으로 접혀도 카드는 620px 로 남는다(실측: 접힘 rect 520×620, 컴포저 156px). 같은 `:not(.is-history-open):not(.is-studio):not(.is-collapsed):not(.is-map-first-idle)` 를 달아 (0,8,0)/(0,7,0) 으로 올린 뒤 접힘 rect 가 **520×174**(컴포저 156 + 카드 인셋)로 줄었다 — 근거 `.omo/evidence/assistant-glass-fold/measure.json`. 같은 실측에서 펼친 뒤 `.ai-chat-log` 는 `clientHeight 392 / scrollHeight 681`, `scrollTop 0→200` 으로 살아 있어 `max-height` 여닫기가 안쪽 스크롤러를 죽이지 않음을 확인했다(1280×720 에서도 352/681). 상단 중앙 도구막대는 `elementFromPoint` 로 `tool-select` 가 패널에 덮이지 않음을 두 해상도에서 확인했다. **자동 재접힘은 2026-08-27 에 걷어낸 동작의 부분 복원이다**(아래 항목 참조): 턴 종료 후 `GLASS_FOLD_IDLE_MS`(8s, `aiPanelLayout.ts`) 유휴면 접는다. 그때 문제(답이 48px 얼굴 뒤로 사라짐)를 막는 안전핀 — 입력줄은 절대 숨지 않고, 무장(armed)은 **턴 종료에서만** 하므로 셰브론으로 직접 펼친 것은 마우스가 떠나도 닫히지 않으며, 실패한 턴(`is-turn-error`·`failed`)·진행 중 턴·답 대기 질문·비어 있지 않은 입력·패널 내부 포커스·포인터 hover·바닥에서 4px 이상 올라간 로그(위로 읽는 중)에서는 접지 않고, `keydown`·`input`·`focusin`·`wheel`·`scroll`·`pointerleave` 는 대기를 처음부터 다시 센다. 접힌 본문은 `inert` 로 Tab 순서에서 빠진다. Owner: `aiChatPanel.ts` 의 `applyGlassFold`/`scheduleGlassFold`/`canScheduleGlassFold`. Tests: `test/aiGlassFold.test.ts`(계약 전부), `test/aiPanelAutoExpand.test.ts`(glass 라우팅 + side 칩 축), `test/aiPanelChrome.test.ts`, `test/aiPanelGlassResize.test.ts`(접힘 시 폭 유지·높이 해제).

- **조수 접기·도크별 크기 조절 (2026-08-28):** **(2026-08-31 에 상위 갱신됨 — 맨 위 「조수는 입력줄 캡슐 하나다」 항목을 먼저 읽어라. 아래는 도크 축이 있던 시절의 기록이며, glass/side 를 가리키는 문장은 지금 코드에 대응하는 표면이 없다.)** 헤더 밴드는 복원하지 않는다. 기존 `ai-collapse` 버튼은 `aiComposer.ts`의 고정 28px 액션 행 맨 왼쪽에 있으며 glass/side/float 모두 실제 클릭·Tab 접근이 된다. 기존 `loadPanelCollapsed`/`savePanelCollapsed`와 `ai-collapsed-restore` 상태기계를 그대로 써 `oprn:ai-panel-collapsed`를 왕복한다. side의 48px 접힘 rail은 유휴 상태에도 가로 `조수` label을 보여 빈 띠가 되지 않는다. `ai-resize-handle`은 DOM에 하나만 두고 도크 전환 때 옮긴다: glass는 카드 우하단에서 W+H, side는 패널 왼쪽 안쪽의 12px edge에서 셸 컬럼 W만, float은 `ai-command-bar` 왼쪽 edge에서 캡슐 W만 바꾼다. side preferred 폭은 `editor.ts`가 소유하며 user commit/load 때만 바뀐다; drag preview와 `resolveSideChatWidth`의 viewport/canvas clamp는 현재 적용 폭일 뿐 preferred를 덮어쓰지 않아 wide→narrow→wide에서 원래 폭이 복구된다. 저장 키는 기존 `oprn:ai-panel-size:glass|side|float`; float 높이는 textarea 행수 계약 때문에 조절하지 않는다. 포인터와 방향키(Shift 큰 step), separator aria 값을 함께 지원한다. Tests: `test/aiPanelChrome.test.ts`, `test/aiPanelGlassResize.test.ts`, `test/aiPanelResizeAndToolBrowser.test.ts`, E2E `test/e2e/chat-dock-switch.spec.ts`, `test/e2e/_ai-composer.spec.ts`. QA: `scripts/qa/assistant-resize-collapse-qa.mjs`는 glass/side=`ai-panel`, float=`ai-command-bar` rect를 기록한다.
- **채팅 세션의 경계는 프로젝트다 — 맵 이동은 경계가 아니다 (2026-08-28):** 저장/복원 범위는 `conversationScopeKey(identity, project)`(`src/ai/conversationStore.ts`)가 정한다. 원격 프로젝트는 durable row id인 `remote:<projectId>`를 쓰고, durable row가 없는 로컬 세션은 새로고침 뒤에도 재구성되는 `local:<trimmed title or (untitled)>::<startMapId>`를 쓴다. 반면 프로젝트 전환 리셋은 범위 키가 아니라 패널이 캡처한 `store.getProjectIdentity().id`를 비교한다 — 같은 모양의 새 로컬 프로젝트도 런타임 identity가 바뀌면 반드시 새 대화를 시작한다. 전환 시 진행 턴을 abort하고 대기 큐를 버리며, 늦게 정착한 턴은 시작 당시 캡처한 대화 id와 범위에만 저장된다. 로컬 `oprn:ai-conversations` 레코드가 정본이며 각 레코드가 자기 `projectContextKey`를 보존한다. LegacyDb `ai_conversations`는 best-effort 미러이고 저장 호출 시점에 현재 설정된 `config.projectId` 아래 파일링된다; 복원은 이 테이블을 읽지 않으므로 원격 행의 `project_id`가 로컬 범위 소유권을 뜻하지 않는다. `새 대화`는 모든 도크의 컴포저 고정 액션 행 `+`(`ai-new-chat`)에서 보이고, 기존 숨은 `ai-new-session`과 두 메뉴 항목(`ai-more-new-chat` / `ai-command-menu-new-chat`)도 호환 훅으로 유지한다. 리셋은 로그·제안·자율 런·상태 타임라인을 모두 비우고 `data-ai-conversation="empty"`로 되돌린다.

- **AI 표면은 조수와 같은 엔드포인트에 한 지점을 통해 닿는다 (2026-08-30):** 전송(`llmClient.chatCompletion`)과 프롬프트(`systemPromptEnvelope`)는 이미 하나였는데 **그 앞단 두 가지가 표면마다 손으로 조립돼 있었다.** (1) 어떤 설정으로 부르는가 — 조수 채팅 `loadAiConfig()`, 클러스터·이벤트 커맨드 `configForLiteModel(loadAiConfig())`, 영역 작업은 거기에 `maxToolCalls` 캡, 타일셋 분석 `{...config, maxTokens: 8192}`, 구조 키트는 생 `loadAiConfig()` — 다섯 군데. (2) 연결 준비를 누가 판정하는가 — 채팅·클러스터·이벤트는 `isAiConfigReady`, 타일셋 분석은 **자기만의** `hasTilesetAiAccess`, 구조 키트는 **아무 판정도 없었다**.
  2번이 실제 결함이었다. `hasTilesetAiAccess` 는 `config.model` 을 보지 않아 모델이 빈 설정에서 조수는 "설정 필요" 로 막는데 타일셋 AI 버튼은 열려 있고 `model: ""` 로 요청이 나갔고, **프로덕션 reader 는 사라졌지만 마이그레이션이 보존하는 레거시 `oprn:llmApiKey` localStorage 키**를 폴백으로 읽어 그 키 하나가 나머지 전체와 어긋난 판정을 만들었다. 구조 키트는 미연결 클릭을 이제 실제 companion 인증 캐시로 막아, 401 `LlmError` 진단 대신 다른 표면과 같은 "AI 연결을 먼저 완료하세요" 안내를 보여 준다.
  이제 `src/ai/assistantEndpoint.ts` 가 **표면 어휘(`AiSurface`)·표면별 설정 정책(`SURFACE_POLICIES`)·준비 판정(`isAssistantEndpointReady`) 세 가지의 유일한 선언 지점**이다. `AiSurface` 는 여기서 소유하고 `systemPromptEnvelope` 가 재노출한다(엔드포인트 정책과 프롬프트 봉투가 같은 표면 목록을 봐야 한다 — 두 벌로 두면 표면을 늘릴 때 한쪽만 갱신된다). `resolveSurfaceAiConfig(surface, base?)` 는 `baseUrl`·`authMode`·`providerId` 를 **손대지 않는다** — 그래서 엔드포인트는 표면과 무관하게 항상 조수와 같다. 표면 정책은 모델 티어(`supervisor`/`lite`)와 두 항목만 얹는다: `maxTokens` 는 **정확 지정**이며, 실제 효과는 더 큰 예산을 지원하는 companion/Codex/Antigravity도 8192로 낮추는 것이다. 이는 통합에서 새로 고른 정책이 아니라 기존 타일셋 분석 동작의 상속이다. `maxToolCallsCeiling` 은 **상한**(사용자가 더 적게 골랐으면 그 값을 존중). `REGION_TASK_MAX_TOOL_CALLS` 는 `REGION_SURFACE_MAX_TOOL_CALLS` 의 재노출로 남았다(진행 표시 "도구 3/24" 를 그리는 `regionTaskModal` 이 그 이름을 쓴다).
  **준비 판정은 표면을 인자로 받지 않는다.** 처음에는 `isSurfaceEndpointReady(surface)` 로 표면별로 재게 만들었는데 새 단위 테스트가 곧바로 잡았다: `configForLiteModel` 이 모델이 하나도 없을 때 `DEFAULT_LITE_MODEL` 을 채우므로, 해석된 설정으로 판정하면 **배치 표면(lite 티어)은 영원히 '준비됨'** 이 된다. 브라우저의 `loadAiConfig()` 자체도 OAuth와 기본 모델을 항상 백필하므로 config 모양만 보는 무인자 판정은 언제나 true였다. 그래서 기본 config 인자를 없애고, 브라우저 호출부(클러스터·구조 키트·타일셋)는 해석 전 저장 config와 `getAiConnectionStatus(config)`의 live cache를 함께 넘긴다. 하단 상태 칩이 제거되어 더는 캐시를 데우지 않으므로 `renderEditor`가 부팅 때 한 번 `refreshAiConnectionStatus()`를 시작한다. 설정 모달 안의 `aiAuthSettings.applyStatus`는 로그인 완료(직접·폴링·붙여넣기), 재확인, 로그아웃이 모두 지나는 단일 성공 경계다. 이 경계가 공유 캐시를 reset한 뒤 즉시 re-warm하며, reset 세대보다 오래된 부팅 조회 응답은 폐기한다 — 따라서 같은 기본 제공자에서 로그인하거나 로그아웃해도 페이지 새로고침 없이 모든 게이트가 바뀐다. 퇴역한 하단 상태바의 `renderAiConnectionStatus`와 그 안의 중복 `onSaved` 배선은 삭제했고 상태바는 다시 마운트하지 않는다. `ready`와 조회 중인 `checking`은 허용해 느린 첫 조회가 사용자를 잠그지 않고, 확인된 `disconnected`·`offline`·`error`는 요청 전에 막는다. 주입 설정(노드 스크립트·벤치마크·이벤트 커맨드)은 status 없이 기존 shape 판정을 그대로 쓴다. `isAiConfigReady`(`aiChatPanelHelpers`)는 이름을 쓰는 호출부가 많아 껍데기로 남아 위임한다.
  이 통합에 들어오지 않는 것: 내부 플래너(`workPlan.ORCHESTRATOR`)·요약기(`contextCompaction`)·성향 증류기(`preferenceDistiller`). 셋은 사람이 여는 표면이 아니라 조수 턴 **안에서** 도는 내부 단계다(`systemPromptEnvelope` 가 봉투를 씌우지 않는 것과 같은 경계). `src/benchmark/llmClient.ts` 도 밖이다 — 노드 벤치 하네스이고 자체 비용 회계를 든다. **남은 비대칭**: AI 활동 로그(`recordAiActivity`)는 여전히 `chat`·`region` 두 표면만 기록하므로 `npm run ai:log` 는 클러스터·구조 키트·타일셋·이벤트 커맨드 턴을 보지 못한다. 엔드포인트 축이 아니라 관측 축이라 이 변경에 넣지 않았다. Tests: `test/assistantEndpoint.test.ts`(엔드포인트 필드 불변·티어·상한/정확지정·준비 판정 경계), `test/tilesetAiClient.test.ts`, `test/aiChatPanelSettings.test.ts`.
- **사람 성향 기억은 기기 로컬이고, 프롬프트는 공용 봉투 한 지점에서 조립된다 (2026-08-30):** 두 층이다. (1) **성향 기억** — `src/ai/preferenceMemory.ts` 가 `oprn:ai-preference-memory` 에 성향을 저장한다. 스코프는 2층: `global`(사람 습관, 프로젝트를 바꿔도 유지, 상한 16) + `project`(`conversationScopeKey` 를 키로 쓰는 그 게임만의 사실, 상한 8). 신호는 `src/ai/preferenceSignals.ts` 가 LLM 없이 결정론으로 집계한다 — 되돌리기 −3(변경 카드 `onUndo` → `noteAiChangeUndone`; 채팅 제안은 자동 적용이라 **되돌리기가 유일한 강한 부정 신호**다), 정정 발화 −2(직전 변경 턴 뒤 60초 안 부정 어휘), 무사 통과 +1, 명시 선언은 즉시 증류. 문장으로 바꾸는 것은 `src/ai/preferenceDistiller.ts` 의 lite 모델 1회 호출(`response_format: json_object`)이며 **어떤 실패도 throw 하지 않는다** — 카운터는 이미 저장돼 있어 손실이 없고, 연속 3회 실패하면 `pending` 앞 절반을 버려 큐가 막히지 않는다. 프롬프트 블록에는 `PREFERENCE_PRECEDENCE_LINE`("이번 지시와 충돌하면 지시가 우선")이 **필수**다 — 없으면 기억된 취향이 명시 지시를 이긴다. 블록은 `contextBuilder` 의 `withFixedBlocks` 안, 즉 **문자 예산 밖**에 놓인다(능력 색인과 같은 이유 — 13,200자 슬라이싱이 먹으면 "기억하지 못한다"가 그대로 재발한다). 자체 하드캡 12줄·1,200자. (2) **공용 봉투** — `src/ai/systemPromptEnvelope.ts` 의 `composeSystemPrompt({surface, body, includePolicy, includeMemory, projectScopeKey})` 가 `[성향] → [정책] → [본문]` 순으로 조립한다(잘려도 되는 본문 꼬리가 뒤). 이벤트 커맨드 어시스트·구조 키트 편집창·타일셋 분석이 이제 이 봉투를 통과하며, 예전에는 이 세 표면이 `AGENT_UX_POLICY_LINES` 를 한 줄도 못 받았다. `ORCHESTRATOR_SYSTEM_PROMPT`·`SUMMARIZATION_SYSTEM_PROMPT` 는 **의도적으로 감싸지 않는다**(사람과 대화하지 않는 내부 플래너·요약기 — 성향을 넣으면 계획·요약이 취향으로 오염된다). UI 는 **채팅 컴포저 액션 행의 `⌾` 버튼**이 여는 팝오버 "AI 가 기억한 내 성향"(`src/editor/panels/aiPreferenceMemorySettings.ts`): 전역/프로젝트 두 그룹, 항목별 고정·삭제, 직접 추가(전역·강함·고정), 전체 비우기. **AI 설정 모달이 아니라 채팅 패널이다(2026-08-30 감독 지시)** — 성향은 대화에서 배우고 "기억했습니다" 알림도 채팅 버블로 뜨니, 확인·삭제가 모달에 있으면 배운 자리와 고치는 자리가 갈라진다. 설정 모달에 다시 붙이지 말 것. `aiComposer.ts` 의 기존 팝오버 기계에 세 번째 종류(`ComposerPopover = "suggest" | "menu" | "preference"`)로 넣어 배타적 열림·바깥 클릭·Escape 를 그대로 쓰고, 흐름 밖 absolute 라 "바 높이 = f(textarea 줄 수)" 불변식도 안 깨진다. 내용은 `preferenceContent` 로 **주입**한다 — 컴포저가 성향 저장소를 직접 import 하면 컴포저 단위 테스트의 모듈 그래프에 localStorage 층이 들어온다. 스코프는 **함수로** 넘긴다(`projectScopeKey: () => conversationScope`): 그 값은 새 대화·프로젝트 전환에서 재대입되는 let 이라 값으로 굳히면 프로젝트를 바꾼 뒤에도 이전 프로젝트 성향이 목록에 남는다. 설정 모달(`renderAiSettingsForm`)에는 `projectScopeKey` 옵션이 없다 — 성향이 유일한 사용처였을 것이므로 배선을 만들지 않았다. **원격 동기화는 v1 범위 밖이다** — `test/legacyDbRlsCoverage.node.test.mjs` 가 신규 마이그레이션의 anon GRANT 를 금지하고 클라이언트는 anon 키만 쓰므로 새 테이블을 브라우저에서 읽고 쓸 수 없다. Phase 8 인증(`DRAFT_20260706_auth_rls.sql`)이 붙은 뒤 별도로 다루고, 그때까지 성향은 기기에만 남는다(기기를 바꾸면 처음부터 다시 배운다). 조회 키는 **호출부가 넘긴다** — 성향 목록이 `store` 를 직접 읽으면 프로젝트 층 전체가 모듈 그래프에 붙어 목록만 렌더하는 단위 테스트가 로딩만으로 15초를 넘겼다. Tests: `test/preferenceMemory.test.ts`, `test/preferenceSignals.test.ts`, `test/preferenceDistiller.test.ts`, `test/systemPromptEnvelope.test.ts`, `test/aiPreferenceMemorySettings.test.ts`, `test/aiPreferenceComposerButton.test.ts`(⌾ 진입점·팝오버 배타성·설정 모달에 없음), `test/contextBuilder.test.ts`(예산 밖 고정), `test/agentUxPolicyPrompt.test.ts`(봉투 통과).

- **맵 이동은 대화를 끊지 않고 턴에 상황을 남긴다 (2026-08-28):** 맵을 옮길 때마다 세션을 버리면 진행 중인 계획·제안·자율 런이 날아간다. 대신 두 가지를 한다. (1) 사용자 턴마다 `buildConversationTurnContext`(`src/ai/conversationTurnContext.ts`)가 맵 id·이름·크기·뷰포트·선택 영역을 구조화해 `AuditEntry{kind:"user"}.context` 에 박고, 그대로 대화 기록(localStorage + LegacyDb `ai_conversations.entries_json`)에 저장된다 — 예전엔 이 사실이 사용자 메시지 꼬리표 문자열에만 있어 기록에서 되읽을 수 없었다. 뷰포트·선택은 **현재 맵의 것이고 맵 범위 안**일 때만 남는다. (2) 턴 사이에 맵이 바뀌면 `mapTransitionNote` 가 `맵 이동: A → B` 를 status 감사/이벤트로 남기고 **시스템 프롬프트를 새 맵으로 다시 조립한다** — `ContextOptions.getCurrentMapId` 가 생기기 전에는 `currentMapId` 가 세션 생성 시점 값으로 고정돼, 라이브 뷰포트 블록은 새 맵을 가리키는데 타일 어휘·구조 키트·맵 요약은 세션이 시작된 맵을 설명하고 있었다. Tests: `test/aiChatSessionScope.test.ts`, `test/conversationTurnContext.test.ts`.

- **조수 셸 기하는 `17-assistant-modern-shell.css` 한 파일이 정한다 (2026-08-27):** 패널이 갑갑했던 원인은 색이 아니라 기하였다. `origin/main` 실측(`output/evidence/assistant-ui-modern/newmain-before-measure.json`): 헤더 65px 안에 48px 얼굴판이 들어가 여백이 8/12px, 컴포저 134px/8·12px, 빈 대화에서 `.ai-glass-log` 175px + `.ai-history-log-mount` 133px 가 빈 채로 자리를 먹고 그 안의 `.ai-chat-log` 가 22px 회색 캡슐로 남았다(빈 블록 4개). 여백·리듬·표면은 이제 `--ai-shell-gutter/gap/radius/control` 토큰으로 한곳에서 잡는다 — 결과는 헤더 73px/12·16px, 컴포저 156px/12·16px, 빈 블록 1개(`newmain-after-measure.json`). 이 레이어가 13~16 레이어의 상충 기하를 이기는 건 **나중 `@import` 때문이 아니다** — 13 레이어가 `.editor-layout .ai-chat-panel...` 로 한 단계 높은 구상도를 쓰므로 셸 규칙도 같은 구상도를 맞춰야 이긴다(import 순서 재배열 금지). 빈 로그 껍데기를 접는 훅은 `aiChatPanel.ts` 의 `syncConversationState` 가 다는 `.ai-chat-panel[data-ai-conversation="empty"|"active"]` 다. 판정은 **로그의 자식 유무**여야 한다 — 턴 행 `data-testid` 로 세면 복원된 대화(그 testid 를 달지 않는다)를 빈 것으로 보고 숨긴다. 그래서 `refreshNextSteps` 와 `restoreConversationRecord` 양쪽에서 부른다. `:empty` 로도 못 잡는다 — 껍데기 안에 빈 `.ai-chat-log` 엘리먼트가 실제로 들어 있다. 빈 화면 시작 블록의 예시 칩은 2개에서 4개로 늘려 494px 폭을 채운다. Tests: `test/aiPanelModernShell.test.ts`, `test/aiPanelChrome.test.ts`. QA: `node scripts/qa/assistant-ui-modern-qa.mjs --label <name>`(빈 상태 기하 + 360px 좁은 폭 + 복원된 16턴 대화), `node scripts/qa/assistant-adjacent-surfaces-qa.mjs`(캔버스·AI 설정 모달·데이터 화면 회귀).

- **조수 배치와 대기 화면 밀도 (2026-08-24):** 조수는 일반 workspace panel row와 별도다. 탑바 패널 메뉴와 command palette가 실제 `chatDock`의 `왼쪽 카드(glass)` / `오른쪽 고정(side)` / `입력줄(float)`를 직접 바꾸며, 헤더 `↗`는 입력줄로 즉시 떼어낸다. `assistantTemperature`는 `oprn:editor-layout:v4`에 저장되는 `quiet-gold` / `ink-only` / `map-first` 세 단계다. 추천+예시+시각 카드는 `quiet-gold`의 빈 패널에서만 보이고, `ink-only`는 조수 대화면만, `map-first`는 idle 본문을 접어 지도와 입력줄을 우선한다. 헤더·composer 메뉴는 같은 radio 메뉴를 공유하고 popup은 viewport 안에 고정한다.

- **조수가 턴 뒤에 칩으로 접히지 않음 (2026-08-27, 2026-08-30 갱신):** 유리/입력줄은 답을 읽어야 하므로 `scheduleCollapseAfterAiWork` 가 **칩 접힘**(`is-collapsed`, 48px 얼굴)을 하지 않는다 — `AUTO_COLLAPSE_AFTER_AI_MS = 0` 이고 함수 본문은 비어 있다. 이 항목은 그대로 유효하다. 2026-08-30 에 되살아난 것은 **본문 접힘(fold)** 뿐이며 입력줄이 남으므로 답이 얼굴 뒤로 사라지지 않는다(맨 위 항목). 복귀 버튼은 48px 얼굴만이 아니라 `조수` 글자가 있는 칩이다. 유리 카드는 불투명 `var(--bg-raised)` + `clamp(360px, 38vw, 520px)` 이고, 유휴 로그를 `display:none` 으로 접지 않는다. CSS 승자: `15-assistant-readable.css`.

- **편집 크롬 복원 (2026-08-25):** 편집 모드는 메뉴/워크스페이스/테스트/클래식 툴바를 다시 노출한다. 하단 `.editor-statusbar`는 마운트하지 않는다.

- The AI chat dock mode is editor UI state: `ChatDock = "float" | "side" | "glass"` (`src/editor/chatDock.ts`). Empty layout storage defaults to **glass**. Stored `float`/`side`/`glass` are honored; do not bump `LAYOUT_CACHE_VERSION` to force glass. Toggle cycles **glass → side → float → glass**. Glass mounts under `chat-float-host` as a left translucent card (plate name **조수**, short log in `ai-glass-log`, composer). Idle glass (`is-glass-idle`) hides an empty log but keeps `ai-next-steps` (hint + ≤3 stacked visual result cards from `directorStartPrompts` / `buildVisualStartGallery`; click sends). Side empty state uses the same block. Glass never mounts the full-width rising overlay. Float stays composer-only on the canvas. Side stays the right ~1/3 column. **Log placement has one source (2026-08-23):** `mountLog()` in `aiChatPanel.ts` maps (dock × 기록/스튜디오) to one slot and publishes it as `panel.dataset.logSlot` — `history` (`ai-history-log-mount`, whenever 기록 or 스튜디오 is open, any dock), `glass` (`ai-glass-log`), `volatile` (`ai-rising-volatile-zone`, side only), `none` (float default: the log element is intentionally unmounted). The rising overlay is mounted for side only. `applyHistoryOpen` / `applyStudio` no longer re-parent the log themselves; they flip state and let `applyComposerViewPolicy` → `mountLog()` decide, which removed the old double move (close 기록 → volatile → immediately back to glass). Measured matrix (9 states, browser): `verify-shots/ai-dock-log-mount/matrix-after.json`. Spec: `docs/superpowers/specs/2026-08-20-ai-glass-dock-design.md`. Tests: `test/chatDock.test.ts`, `test/aiLogSlot.test.ts`, `test/e2e/chat-dock-switch.spec.ts`.

- **Sticky completion/notice band (2026-08-28):** `stickyProposalZone` (`ai-rising-sticky-zone`) is a direct panel child in every dock and now contains only `ai-completion-host` + `ai-proposal-notice-host`. Proposal pill/reopen/pin DOM was removed with the approval flow. Glass and side keep the band in flow; float alone fixes it above the absolute composer with a `pointer-events:none` container and interactive children restored. Do not make the band fixed in glass: the card's `backdrop-filter` creates a containing block and `overflow:hidden` clips it. Test: `test/aiLogSlot.test.ts`.

- **The volatile-zone idle fade is gone (2026-08-23).** `is-faded` (`opacity .42`), `VOLATILE_OVERLAY_IDLE_MS`, `aiVolatileController.ts`, the local `volatileFadeTimer`, `scheduleVolatileFade`, and `lastTurnFailed` were all removed. The fade was dead three times over: gated on `dock === "float"`, float mounts no volatile zone at all, and the side CSS forced `opacity: 1` back. Two timers (controller + panel-local) also raced for the same class. Volatile-zone visibility now has one owner: `hidden = true` at construction, unhidden by `applyComposerViewPolicy` when `panel.dataset.logSlot === "volatile"`, plus `revealVolatileZone`/`hideVolatileIfIdle` for input focus/blur. Do not reintroduce an opacity fade over the log — a faded error card is unreadable (the reason `lastTurnFailed` existed).

- **`is-prior-turn` has one policy (2026-08-23): prior turns are always visible.** The "mini-stream shows the current turn only" rule was duplicated in `assistant-rising-overlay.css` and `09-ux-polish-density.css`, and in both files the following side-dock rule re-showed them — since the overlay became side-only, the hide never applied. Both files now carry a single `.ai-chat-log > .is-prior-turn { display: block }` / `.ai-chat-log > .ai-turn-group.is-prior-turn { display: flex }`. Turn shortening is `.ai-turn-group.is-collapsed > .ai-turn-group-body`, the only collapse path actually in use.

- **The volatile-zone idle fade is gone (2026-08-23):** the `is-faded` (`opacity .42`) state, `aiVolatileController.ts`, the duplicate local fade timer, `VOLATILE_OVERLAY_IDLE_MS`, `scheduleVolatileFade`, and `lastTurnFailed` were deleted. The fade was doubly dead — every entry point gated on `dock === "float"`, yet float does not mount the volatile zone at all, and the side stylesheet forced `opacity: 1` over `.is-faded`. Zone visibility now has one owner: `hidden` starts true and `applyComposerViewPolicy` unhides it when `panel.dataset.logSlot === "volatile"`; `revealVolatileZone` / `hideVolatileIfIdle` only flip `hidden`. Prior-turn visibility was also single-sourced: the `.ai-rising-overlay ... .is-prior-turn { display: none }` rules in `assistant-rising-overlay.css` and `09-ux-polish-density.css` were unreachable (the overlay is side-only and the side rule always won), so prior turns are simply visible and `.ai-turn-group.is-collapsed` remains the only collapse path.

- **Composer (2026-08-21 rebuild, `src/editor/panels/aiComposer.ts` + `src/styles/database/assistant-composer.css`):** the bottom bar is a textarea with **one fixed single-line action row** under it — there is no vertical button rail. The action row holds, left to right: `+` (`ai-new-chat`, 새 대화), `☰` (`ai-command-menu-toggle`, meta menu), `ai-context-chips`, `ai-pending-queue`, then `ai-status-group`, the `Enter 전송` hint, and `ai-send` ⟷ `ai-abort` (one slot, `refreshAbortButton` flips `hidden`). Settings (`ai-settings-command-bar`) is an **item inside the `☰` menu**, not a standalone bar button; glass/side may hide `☰`, but `ai-new-chat` remains visible in glass, side, and float. **Invariant: bar height = f(textarea rows) only.** The two inline icon controls stay in the existing fixed action row; they do not add a band or vertical rail. The action menu and director-chip popover are `.ai-composer-popover` — absolute direct children of `.ai-command-bar`, `hidden` when closed, mutually exclusive, closed by outside-pointerdown/Escape. The director-chip popover has no toggle button: it opens when the input is focused and empty. Never add a transparent full-width popover layer: an invisible layer over the canvas swallowed map clicks (2026-08-19 P0). `--ai-command-bar-clearance` **and** `--ai-command-bar-inset` both come from one measurement (`syncCommandBarClearance`, includes the open popover's top). Measured (1600×1000, freshProject): float idle 160 → 126. A first attempt used a left meta rail (`/` · `✨` · `☰`) but it was dropped the same day — in glass/side the rail column carried only one button, so the column existed for that button and cluttered the bottom. The predecessor `.ai-command-input-stack` / `aiCommandBar.ts` stacked slash+context+chips+queue **in flow** above the input, so every chip toggle resized the bar and re-triggered the clearance measurement. Regression spec: `test/e2e/_ai-composer.spec.ts` (height invariance, canvas hit-test, caret).

- Header plate (`data-testid="ai-director-plate"`): 48px faceset crop of `easyrpg-faceset-actor1` index 0 + name `조수` + one-line `readAgentBrief().line`. Plate tokens already live in DESIGN.md (name `--text-1` 13px/600, line `--text-2` 12px/400, gap `--space-2`, face well `--studio-inset` / `--studio-line` or `--bg-inset` / `--border-subtle`). Collapsed restore is a 48px face button, `aria-label="AI 어시스턴트"`.

- **Action menus share one item implementation (2026-08-22):** the header `☰` (`.ai-more-menu`) and the composer `☰` (`.ai-command-menu`) build their eight shared items — 되돌리기 · 내보내기 · dock toggle · 전체 기록 · 툴 브라우저 · 🎓 맵 인터뷰 · 📐 선택 여역 학습 · ✍️ 시연으로 가르치기 — from `createAiActionMenuItems` (`src/editor/panels/aiActionMenu.ts`). Containers, positioning and open-state stay per-surface (header owns its own pointerdown/Escape handlers; the composer menu is a `.ai-composer-popover` owned by the composer shell), only the item list is shared. testids differ by surface and are part of the test contract: header `ai-more-*`, composer `ai-command-menu-*` (composer 전체 기록 has none). `applyDockModeChrome` relabels both dock items in one loop, so the two surfaces legitimately show different dock labels at the same time (header "아래 바로" while composer shows "왼쪽 유리"). Header always-visible buttons are now only `ai-new-session` and `ai-more-menu-toggle` — settings (`ai-settings-toggle`) moved into the header menu as an item, and `ai-settings-command-bar` is an item in the composer menu. The hidden `.ai-chat-toolbar` is a **test-hook container, not dead buttons**: 8 of its 9 controls are referenced by tests and the menu items act by calling their `click()`. Only `chat-dock-toggle-bar` had zero references and was removed. Regression spec: `test/e2e/_ai-composer.spec.ts` (shared-item order + header button list).

- **Dock/menu correction (2026-08-24):** the header and composer action menus keep their shared actions, but dock labels now describe the destination: glass `오른쪽에 고정`, side `입력줄로 떼기`, float `왼쪽 카드로 열기`. The side header also exposes an always-visible `↗` (`ai-chat-detach`) escape to float. The header popup is viewport-fixed and clamped through `anchoredPopupPosition`, because an absolute popup inside `.ai-chat-side-panel { overflow: hidden }` was fully clipped. The top-bar `▤` menu no longer renders the generic workspace `assistant` row (that row only mutated workspace JSON and could not move ChatDock); it owns an icon picker wired to `setChatDock`: `◧` 왼쪽 카드, `▥` 오른쪽 고정, `⌨` 입력줄. `refreshDockLabels()` runs on `editorState` changes so menu-driven moves update the panel dataset and labels immediately.

- **Assistant idle-screen choice:** 2026-09-23에 삭제. `quiet-gold` / `ink-only` / `map-first` 와 `aiTemperatureMenu.ts` 는 없다. 캔버스 「살펴볼 것」 버튼은 항상 보인다. 레이아웃 JSON의 `assistantTemperature` 는 읽지 않는다.

- Side work log is RM-style `@>` command rows (`data-testid="ai-command-row"`), not chat bubbles. There is no pending-proposal pin: a turn's writes are applied as the turn ends, so the command row is followed by the applied change card (`ai-change-card`) with its `되돌리기` button.

- **Assistant skills removed (2026-08-27):** the assistant-side skill feature is gone — no skill drawer, no `/` slash skill list, no skill palette section, no skill prompt plumbing (`src/ai/skills.ts`, `aiSkillDrawer.ts`, `assistant-skills.css`, `explicitSkillId`, `appendSkillPromptToggle` all deleted). The composer is free text + send only, and a leading `/` is ordinary text with no popover. Ctrl+K keeps 명령 + 맵 이동 sections. Game skills (battle/life/`database.skills`) are unrelated and untouched. Regression test: `test/assistantSkillsRemoved.test.ts`.

- **Assistant temperature:** 삭제됨(2026-09-23). 저장 키를 다시 읽거나 라디오를 되돌리지 않는다.

- **Decision surface:** 없다. 쓰기가 있는 턴은 그대로 적용되고, 조수 창에 남는 것은 적용 로그 한 줄 + 변경 카드(`ai-change-card`)의 `되돌리기` 다. 변경 0건 턴만 `ai-proposal-notice-host` 에 완성도 린트 안내(`renderEmptyProposalNotice`)를 띄운다.

- **Assistant identity:** the header plate and float command face consistently use the name **조수** and the current `idlePresenceLine`; float retains the command-bar face because its header is hidden.

- **지시줄 effort 셀렉트 — 자율성·추론 강도를 설정 모달 없이 바로 고른다 (2026-09-04):** 컴포저 액션 행 lead 에 네이티브 `<select>` 2개(`ai-composer-autonomy`·`ai-composer-reasoning`, `aiComposer.ts` `effortChips`)를 모드 세그먼트 옆에 둔다. 값 어휘는 설정 모달과 공유한다(`AUTONOMY_LEVELS`·`COMPOSER_REASONING_OPTIONS`). 자율성을 고르면 `resolveAutonomy` 프리셋을 추론·작업모드까지 함께 저장하고 추론 셀렉트도 `syncEffort` 로 맞춘다(설정 모달 다이얼과 같은 동작). 추론 강도는 수동값 그대로 저장한다. **세션은 저장된 reasoningEffort 를 그대로 쓴다** — 예전 `phaseConfig` 의 다이얼 effort 덮개는 걷었다(다이얼 선택 시 호출자가 이미 저장에 반영하므로). 다이얼이 정하는 것은 agentMode·예산·planOnly 다. 설정 모달에서 저장하면 컴포저 표시도 `syncEffort` 로 맞춘다. Tests: `test/aiComposerEffort.test.ts`(어휘·콜백·동기화) `test/aiComposerEffortPanel.test.ts`(저장 배선) `test/aiComposerEffortSession.test.ts`(수동값 우선).

- **자율성 다이얼은 설정 동작 절에 산다 (2026-09-04):** 레벨 정의와 세션 노브 해석은 `src/ai/autonomyLevels.ts`(`AUTONOMY_LEVELS`, `resolveAutonomy`)가 소유하고, 설정 모달(`src/editor/panels/aiSettingsModal.ts`)의 동작(behavior) 섹션이 `자율성` 셀렉트(`data-testid="ai-config-autonomy"`)로 노출한다. 다이얼을 움직이면 해당 레벨의 추론·작업 모드로 `ai-config-reasoning`·`ai-config-agentmode` 셀렉트를 함께 고친 뒤 두 셀렉트에 `input` 이벤트를 쏴 커스텀 셀렉트 라벨을 동기화하고 `persist` 는 한 번만 돌린다(`change` 가 아니라 `input` 만 쏘므로 저장 리스너가 중복으로 타지 않는다). 저장은 `AiConfig.autonomyLevel`(`src/ai/llmClient.ts`)이며, 로더가 옛 blob·이상한 값을 `"balanced"` 로 백필한다. 런 표면 예산(`aiChatPanel.ts` `runBudgetTotal`)은 `min(레벨 cap, 48)` 표시용 클램프다. 실제 루프 상한은 세션(`assistantSession.ts`)이 자기 cap 으로 별도 강제한다. 컴포저 모델 칩(`modelChipLabel`)은 초보 모드에서 숨고, 표준·전문가에서는 모델 id 뒤에 `· 레벨 라벨`을 덧붙인다(읽기 전용 표시).

  | level | reasoning | agentMode | budgetCap | planOnly |
  | --- | --- | --- | --- | --- |
  | confirm | low | chat | 6 | true |
  | balanced | low | auto | 16 | false |
  | autonomous | medium | auto | 32 | false |
  | max | high | auto | 48 | false |

## 세션 수명 · 대화 컨텍스트

- **채팅 세션의 경계는 프로젝트다 — 맵 이동은 경계가 아니다 (2026-08-28):** 저장/복원 범위는 `conversationScopeKey(identity, project)`(`src/ai/conversationStore.ts`)가 정한다. 원격 프로젝트는 durable row id인 `remote:<projectId>`를 쓰고, durable row가 없는 로컬 세션은 새로고침 뒤에도 재구성되는 `local:<trimmed title or (untitled)>::<startMapId>`를 쓴다. 반면 프로젝트 전환 리셋은 범위 키가 아니라 패널이 캡처한 `store.getProjectIdentity().id`를 비교한다 — 같은 모양의 새 로컬 프로젝트도 런타임 identity가 바뀌면 반드시 새 대화를 시작한다. 전환 시 진행 턴을 abort하고 대기 큐를 버리며, 늦게 정착한 턴은 시작 당시 캡처한 대화 id와 범위에만 저장된다. 로컬 `oprn:ai-conversations` 레코드가 정본이며 각 레코드가 자기 `projectContextKey`를 보존한다. LegacyDb `ai_conversations`는 best-effort 미러이고 저장 호출 시점에 현재 설정된 `config.projectId` 아래 파일링된다; 복원은 이 테이블을 읽지 않으므로 원격 행의 `project_id`가 로컬 범위 소유권을 뜻하지 않는다. `새 대화`는 모든 도크의 컴포저 고정 액션 행 `+`(`ai-new-chat`)에서 보이고, 기존 숨은 `ai-new-session`과 두 메뉴 항목(`ai-more-new-chat` / `ai-command-menu-new-chat`)도 호환 훅으로 유지한다. 리셋은 로그·제안·자율 런·상태 타임라인을 모두 비우고 `data-ai-conversation="empty"`로 되돌린다.

- **대화 기록 저장은 예산 안에서만 하고 절대 던지지 않는다 (2026-09-03):** 실측 결함 — 조수를 쓰다 「오류: Failed to execute 'setItem' on 'Storage': Setting the value of 'oprn:ai-conversations' exceeded the quota.」 가 말풍선으로 뜨고 그 턴이 끊겼다. `saveConversation` 은 대화 50건을 매 툴콜마다 통째로 다시 쓰는데, 툴콜 인자(맵 셀 배열·이벤트 본문)를 상한 없이 저장했고 같은 인자가 assistant 항목(`toolCalls[].args` 문자열)과 tool 항목(`args` 객체)에 두 번 들어가 오리진 한도(약 5MB)를 넘겼다. 예외는 `aiTurnRunner` 의 `tool_call` 분기와 `finally` 의 `persistConversation` 에서 터져 턴 catch 가 「오류:」 말풍선으로 그렸다. 지금 계약(`src/ai/conversationStore.ts`): (1) 툴 `args` 와 assistant `toolCalls[].args` 는 직렬화 `CONVERSATION_ARGS_MAX_CHARS`(2,000) 를 넘으면 `{ _truncated: true, preview }` 로 바꾼다 — 대화 기록의 소비자는 복원 화면의 툴 상세 `<pre>` 와 export 뿐이고 진단 원문은 활동 로그(12,000)가 든다. (2) 레코드 한 건의 entries 가 `CONVERSATION_RECORD_MAX_CHARS`(200,000) 를 넘으면 머리(첫 발화)와 꼬리(최근)를 남기고 가운데를 접어 `[conversation-trimmed] … N개 항목을 생략` status 표식 **하나**로 남긴다(다시 저장돼도 누적만 되고 표식이 쌓이지 않는다; 복원 렌더와 모델 주입은 status 를 무시한다). (3) 키 전체가 `CONVERSATION_STORE_MAX_CHARS`(1,000,000) 를 넘으면 최신부터 담고 오래된 대화를 밀어낸다 — 활동 로그·원격 outbox(150만) 와 같은 오리진을 나눠 쓰므로 그보다 작다. (4) 그래도 브라우저가 거절하면 절반씩 줄여 재시도하고, 최신 1건도 못 쓰면 `console.warn` 한 번(실패가 이어지는 동안)과 함께 `{ ok:false }` 를 돌려준다. 압축은 **읽어 온 레거시 레코드에도** 적용되므로 이미 부풀어 있던 브라우저도 다음 저장에서 한 번에 회복한다. 원격 미러(LegacyDb `ai_conversations`)는 로컬과 같은 압축본을 받는다 — 정본이 하나여야 하고 매 툴콜마다 수 MB 를 보내지 않는다. 패널(`aiChatPanel.persistConversation`)은 `ok:false` 일 때만 패널 수명당 한 번 「대화 기록을 이 브라우저에 저장할 수 없습니다(저장 공간 부족)」 토스트를 띄운다. Tests: `test/conversationStore.test.ts` 의 「저장 용량」 describe — 부풀린 레거시 위에서 저장 성공·인자 미리보기·머리/꼬리 접기와 표식 누적·저장소 예산 밀어내기·브라우저 한도 절반 재시도·전면 거절 시 ok:false·원격 압축본 동일.

- **Public remote-history successor (integration st_01a08238 adjudication):** The earlier d2be automatic summary-GET/selected-GET and selectable foreign-local UI is historical, explicitly superseded by the map-scoped archive and separate Recover action above. Browse and ordinary Open use local retained records only; Recover can import absent IDs or update strictly older unchanged local records under the single pre-request value baseline and transactional admission rule. Foreign records remain stored, not listed or adopted; legacy unscoped records remain separately read-only. Ordinary reads do not concatenate or rewrite the selected transcript. Existing outgoing-conversation checkpoints, main retention/tombstones and captured-destination outbox behavior remain. The normal restore callback still drops `AssistantSession` and restores only public audit/transcript, never private ledgers. `test/aiConversationRemoteHistory.test.ts` explicitly migrates the former GET sequence to clock -> Recover -> project filter -> Open while retaining exact entries, race/error/ownership checks and null harness; `historyRecoveryAdmission` proves bounded replacement on native IndexedDB and memory. This source integration does not perform recovery against user records or retroactively restore P7.

- **대화 기록의 로컬 정본은 IndexedDB 다 — localStorage 는 이관 전용 (2026-09-03, 같은 날 후속):** 위 항목의 예산은 응급 처치였다. 근본 원인인 «큰 기록을 5MB 동기 저장소 한 키에 매 툴콜마다 통째로 다시 쓴다» 는 저장소를 바꿔 없앴다. `src/ai/aiRecordDb.ts` 가 IndexedDB `oprn-ai-records`(v1, store `conversations`, keyPath `id`, 인덱스 `savedAt`·`projectContextKey`)를 열고 레코드 단위로 읽고 쓴다. `conversationStore` 의 공개 API(`saveConversation`·`listConversations`·`loadConversation`·`loadLatestConversationForScope`·`deleteConversation`·`clearConversations`)는 **전부 비동기**이며 던지지 않는다. 결과 `ConversationSaveOutcome` 은 `{ ok, durable, evicted }` — `durable:false` 는 IndexedDB 가 없거나(Node) 열기에 실패해(일부 프라이빗 모드) 메모리 폴백으로 살았다는 뜻이고, 패널은 브라우저에 IndexedDB 가 있는데 durable 이 아닐 때만 한 번 토스트한다. 옛 키 `oprn:ai-conversations`(`LEGACY_CONVERSATION_STORAGE_KEY`)는 첫 접근에 읽어 압축해 옮기고 지운다 — e2e 시드·QA 스크립트가 여전히 그 키로 대화를 심어도 그대로 복원되며, 같은 id 는 savedAt 이 큰 쪽이 남는다. 보관 상한은 50건(`CONVERSATION_MAX_RECORDS`), 인자 2,000자·레코드 200,000자 압축은 유지한다(원격 미러와 복원 렌더가 매 툴콜마다 수 MB 를 다룰 이유가 없다). **호출부 계약이 바뀐 곳:** (1) 부팅 복원은 `renderAiChatPanel` 끝의 `restoreLatestForBoot` 가 비동기로 하며, 그 사이 사용자가 입력·전송·프로젝트 전환을 했으면 복원하지 않는다. (2) 프로젝트 전환 채택(`adoptConversationForCurrentProject`)은 비동기이고 세대 번호로 낡은 조회 결과를 버린다. (3) 히스토리 모달의 목록·열기·삭제는 비동기다. 테스트·헤드리스 하네스는 «렌더 직후» 가 아니라 `whenAiChatPanelSettled()` / `whenAiConversationHistoryModalSettled()`(`src/util/pendingWork.ts` 추적기) 뒤를 본다 — setTimeout 폴링은 흔들린다. 단위 테스트는 `fake-indexeddb`(devDependency) 로 실제 IDB 의미론을 돌리고, 브라우저 증명은 `test/e2e/ai-conversation-indexeddb.spec.ts`(옛 키 이관·새로 고침 뒤 IndexedDB 복원·「오류:」 없음). 활동 로그(`oprn:ai-activity-logs`)와 세션 백업 스냅샷은 아직 localStorage 라 같은 계급의 위험이 남아 있다. LegacyDb `ai_conversations` 의 수동 기록 읽기 배선은 위 2026-09-08 계약을 따른다. Tests: `test/conversationStore.test.ts`, `test/aiConversationHistoryModal.test.ts`, `test/aiChatSessionScope.test.ts`.

- **맵 이동은 대화를 끊지 않고 턴에 상황을 남긴다 (2026-08-28):** 맵을 옮길 때마다 세션을 버리면 진행 중인 계획·제안·자율 런이 날아간다. 대신 두 가지를 한다. (1) 사용자 턴마다 `buildConversationTurnContext`(`src/ai/conversationTurnContext.ts`)가 맵 id·이름·크기·뷰포트·선택 영역을 구조화해 `AuditEntry{kind:"user"}.context` 에 박고, 그대로 대화 기록(localStorage + LegacyDb `ai_conversations.entries_json`)에 저장된다 — 예전엔 이 사실이 사용자 메시지 꼬리표 문자열에만 있어 기록에서 되읽을 수 없었다. 뷰포트·선택은 **현재 맵의 것이고 맵 범위 안**일 때만 남는다. (2) 턴 사이에 맵이 바뀌면 `mapTransitionNote` 가 `맵 이동: A → B` 를 status 감사/이벤트로 남기고 **시스템 프롬프트를 새 맵으로 다시 조립한다** — `ContextOptions.getCurrentMapId` 가 생기기 전에는 `currentMapId` 가 세션 생성 시점 값으로 고정돼, 라이브 뷰포트 블록은 새 맵을 가리키는데 타일 어휘·구조 키트·맵 요약은 세션이 시작된 맵을 설명하고 있었다. Tests: `test/aiChatSessionScope.test.ts`, `test/conversationTurnContext.test.ts`.

- **AI 컨텍스트 압축 (2026-08-27):** 대화가 길어져 모델 컨텍스트 윈도우 상한에 도달하면 `src/ai/contextCompaction.ts`가 앞부분 대화를 LLM 요약 1회로 치환하여 세션 대화 배열(`this.messages`)을 영구 압축한다. 요청 전송 직전 사본을 52,000자로 줄이는 `messageBudget.ts` 클램프 및 12,000자 시스템 프롬프트 예산 `contextBuilder.ts`와 분리된 독립 계층이다. 상세 계약: `openwiki/ai-context-compaction.md`. Tests: `test/contextCompaction.test.ts`, `test/assistantSessionCompaction.test.ts`.

- **Database assistant entry (2026-08-26):** Database Overview's `AI 어시스턴트` enters the same editor-wide assistant, not a database-only analysis bot. Its empty state offers whole-project starter actions, and its request prefix says the assistant can help across the editor while naming the currently visible Database screen. Keep the shared session, proposal, approval, and tool-routing contracts; do not create a separate Database-only LLM pipeline.
- **Database assistant bar renders the turn in place (2026-09-03):** still the same session and the same `[컨텍스트]` prefix, but the bar (`src/editor/panels/databaseAiBar.ts`) no longer ends with a toast pointing at a chat panel that the Database modal hides. It polls the bridge read API — `getAiAssistantStatus()` / `getAiAssistantAudit()` (new exports in `src/editor/aiAssistantBridge.ts`, plus `abortAiAssistantTurn()`) — and draws request → phase → write-tool summaries → answer → undo inside the bar. `AiBridgeAuditEntry` tool rows now carry `mode` (`read`/`write`, from `getTool(name)?.mode`) and `ok`, so consumers can drop read tools (`find_tools`, queries) from "바꾼 것" and mark failed writes. Starter chips are per tab/record (`databaseAiSuggestions`), not the four generic project/map/event/data prompts. Details: `openwiki/editor-database.md` 「AI 어시스턴트 바」.

## 제안 적용 · 복구 · 완성도 린트

- **제안은 승인 없이 바로 적용된다 — 복구는 되돌리기다 (2026-08-28 갱신):** 턴이 만든 변경을 어떻게 처리하는지는 `resolveProposalApplyMode`(`src/ai/approvalPolicy.ts`) 한 곳이 정한다: 쓰기 툴콜이 1건이라도 있으면 `apply-now`, 0건이면 `no-changes`. **입력은 `callCount` 하나뿐이다** — 파괴 여부·재료 합의·규칙 귀속·오류 종료·"자동 적용" 설정은 전부 입력에서 뺐고 `classifyApproval` 은 삭제했다. 승인 UI([이 맵에 넣기] · [선택 N개 이 맵에 넣기] · [맵 적용 + 재료 합의] · [앞으로 자동 적용] · 검토 모달 · 명령행 핀 · '나중에' pill)는 조수 창에서 전부 제거됐고 설정의 `안전한 맵 꾸미기 자동 적용`(`autoApprove`) 필드도 `AiConfig` 에서 사라졌다(감독 지시 2026-08-28: "이런 flow 가 필요없다. AI 는 자율적으로 전부 진행하고 사용자는 되돌리기에 의존하면 그만이다"). 복구 경로의 정확한 깊이 계약: 적용 1회마다 `applyProposedProject` 안의 `recordProjectSnapshot` 이 **프로젝트 전체 스냅샷 1개**를 undo 스택에 쌓는다(`mapEditHistory` 는 옵션 없이 부르면 `kind:"project"`). 따라서 **되돌리기 1회는 마지막으로 적용된 마일스톤 1개만 복원하며, 여러 마일스톤으로 된 자율 실행 전체를 한 번에 되돌리지 않는다.** 히스토리는 기본 50개다. 프로젝트 스냅샷의 대형 여부는 `project.maps`의 **첫 번째 맵만 표본으로 삼아** 그 맵이 10,000타일 이상인지 보거나, 전체 맵 수가 12개를 초과하는지로 판정하며, 대형이면 25개로 제한된다. 맵 삭제·`reset_project`도 해당 적용 단위 안에서는 Ctrl+Z / 조수 창 [되돌리기]로 원복된다. 안전 분류(`classifyProposalSafety`)와 완성도 린트 경고는 게이트가 아니라 로그 줄이다. 다만 파괴 표시·파괴성 툴·새 맵 추가·대량 쓰기(6건 이상, 타일 400칸 이상, 이벤트 10개 이상)는 적용 직전 `showConfirm` 중간 확인을 한 번 거친다(`src/ai/overInsertionReview.ts` 판정). 승인 메타데이터(`requiresApproval`·`approvalWarning` — 재료 합의·규칙 쓰기)는 판정에 쓰지 않는다. 취소는 저장소를 건드리지 않고 세션 초안을 `rebaseProject`로 버리며 고스트를 치우고, 턴러너는 취소를 "적용 실패"로 덮어쓰지 않는다(`ProposalApplyOutcome` 3값). 일반 1건 타일 쓰기는 확인 없이 그대로 적용된다. Node 헤드리스(window/document 없음)에서는 `showConfirm`이 자동 통과하지만, DOM이 있는 e2e/브라우저에서는 확인 모달이 실제로 뜬다. Owner: `src/ai/approvalPolicy.ts`, `src/ai/overInsertionReview.ts`, `src/editor/panels/aiProposalCard.ts`. Tests: `test/proposalApplyMode.test.ts`, `test/overInsertionReview.test.ts`.

- **캔버스 AI 만들기 집·마을 (2026-08-25):** 우측 상단 `만들기`는 영역 선택용 건축 팔레트를 열지만, 그 안의 `집`과 `마을`은 로컬 결정론적 primitive를 즉시 적용하지 않는다. 두 버튼 모두 선택 영역과 구체적인 자연어 지시를 `openRegionTaskModal({ autoRun:true })`로 보내 실제 LLM 영역 작업과 분리된 미리보기/적용 검토를 시작한다. 강·길·지붕·NPC·나무·소품은 기존 로컬 도구이며, `AI로 채우기`는 지시 편집 후 사용자가 실행하는 기존 경로다. 회귀 테스트: `test/buildPaletteToggle.test.ts`.

- **툴콜 프로토콜은 경계에서 보정한다 (2026-08-30 실측):** 툴콜 결함 4건 중 3건은 모델이 아니라 **응답 파싱 경계**에 있었다. `src/ai/llmClient.ts`:
  1. 스트리밍 delta 에 `index` 가 없으면 무조건 슬롯 0 이라 **한 배치의 병렬 툴콜 2건이 한 호출로 합쳐졌다** — 이름 `fill_regionplace_npc`, 인자 `'{"a":1}{"b":2}'` 가 되어 `등록되지 않은 툴` 한 건으로 사라졌다. 이제 `toolCallDeltaSlot` 이 배치 위치를 슬롯으로 쓰고, 이미 이름을 가진 슬롯에 또 이름이 선언되면 새 슬롯을 딴다(인자만 오는 후속 청크는 그대로 이어붙는다).
  2. id 가 없을 때 스트리밍은 `call_${name}` 으로 채워 **같은 툴 병렬 호출이 같은 tool_call_id** 를 갖고, 비스트리밍은 `String(tc.id ?? "")` 로 **빈 id** 를 만들었다. 세션은 id 마다 `role:"tool"` 응답을 붙이므로 결과는 중복·빈 `tool_call_id` 다(OpenAI 호환 400 / Gemini function-response 짝 실패). 이제 두 경계가 같은 `uniqueToolCallId` 를 지나 **호출마다 유일**하다. 공급자가 준 id 는 그대로 존중한다.
  3. `parseToolCall`(`assistantSession.ts`)은 인자 JSON 파싱 실패를 삼키고 **빈 인자로 툴을 돌렸다** — 모델은 `필수 인자 누락: mapId, x, y…` 라는 거짓 원인을 받고 같은(대개 출력 상한으로 잘린) 페이로드를 재전송했다. 이제 툴을 돌리지 않고 `invalid-json-args` 로 잘림·길이 상한 가능성을 명시해 되돌린다(감사: `tool-args:invalid-json`).
  회귀: `test/aiToolCallProtocol.test.ts`, `test/aiToolCallSessionProtocol.test.ts`.
- **짝 없는 tool_calls 는 세션을 영구히 죽인다 — 두 층에서 막는다 (2026-08-30 실측):** 툴 실행 후처리에서 예외가 나면(마일스톤 자동 적용·검증 스윕처럼 `await` 가 걸린 자리) `assistant(tool_calls)` 만 영구 대화에 남고 응답이 없었다. 그 뒤 **모든** 턴이 같은 400 으로 죽는다(Gemini: `function call turn comes immediately after a user turn or after a function response turn`). (1) 세션 툴 루프는 호출마다 `respond()` 를 보장한다 — 예외는 삼키지 않고 실패 응답을 붙인 뒤 다시 던진다(감사: `tool-loop:exception`). (2) 전송 사본 계층 `repairToolCallProtocol`(`src/ai/messageBudget.ts`)이 짝 없는 호출에 유실 응답을 끼우고 고아·중복 tool 응답을 버린다 — 이미 저장된 대화와 아직 모르는 경로까지 낫는다. 원본 `this.messages` 는 감사용으로 손대지 않는다. 문자 클램프 3차 폐기가 tool 응답만 버려도 사본은 짝이 맞는다.
- **Antigravity tool-result replay (2026-08-24):** `scripts/lib/ohMyPiPiAiRuntime.ts` must parse OpenAI-compatible `assistant.tool_calls[].function.arguments` JSON strings back into object values before handing the conversation to pi-ai. Gemini Cloud Code Assist requires `functionCall.args` to be a protobuf `Struct`; replaying the JSON string verbatim makes the second request fail with HTTP 400 after the first tool call succeeds. `test/ohMyPiComplete.bun.test.ts` covers the serialized follow-up request, and live verification must include both the structured tool-call round and the post-tool final-answer round.

- **영역작업(AI) 검증게이트 배제 (2026-08-30):** AI 가 만든 영역/제안 결과를 **적용 전에 반려하거나 조용히 고치는 경로는 없다.** 예전에는 `validateLayoutPlacement` 의 error 와 `reviewRegionDraft` 의 blockers 가 적용을 막고, `repairLayoutPlacement`·결정론 수리가 AI 배치를 옮기거나 지웠다. 실측 결과 (1) 휴리스틱 한 건이 제안 전체를 반려해 사용자에게 아무것도 남지 않았고(나무 0그루 오판, 호수 마을 전면 반려), (2) 조용한 수리 때문에 유령 미리보기에서 본 것과 적용 결과가 달라 "AI 가 깐 게 사라졌다" 가 됐다. 이제 두 검증기는 **진단**만 낸다: 이슈·지표는 검토 카드와 채팅 경고 줄로 보이고, 적용 여부는 사용자 결정(적용/버리기)과 되돌리기가 정한다. 남은 거부 사유는 **기준 프로젝트 변경(stale base)** 과 채팅 경로의 **무결성 커밋 게이트**(참조 무결성) 뿐이다. `validateLayoutPlacement`/`repairLayoutPlacement` 자체는 마을 빌더·저작 스크립트용으로 남아 있다. Owner: `src/editor/regionTask/harnessReview.ts`, `src/editor/regionTask/pendingRegionApply.ts`, `src/editor/regionTask/runRegionTask.ts`, `src/editor/panels/aiProposalCard.ts`. Tests: `test/regionTaskApplyFlow.test.ts`, `test/tilemapHarnessSafetyBlockers.test.ts`, `test/layoutPlacementValidate.test.ts`.
- **Same-origin companion (2026-08-27):** 브라우저 LLM 엔드포인트는 항상 페이지 오리진의 `/v1` 이다. `127.0.0.1:17832` 은 oh-my-pi 단독 동반 서비스(`npm run ai:oauth`)가 **그 머신 루프백**에서 듣는 주소이지, 원격 preview 탭이 치면 안 된다. `vite.config.ts` `codexOAuthPlugin` 이 `configureServer` 와 `configurePreviewServer` 둘 다에 `/auth`·`/v1` 을 붙인다. `npm start`(mdc-server:9888 Tailscale) 는 같은 오리진으로 Gemini 완결을 보낸다.
- **원격 OAuth launch (2026-08-27):** Google Antigravity 는 데스크톱 클라라 `redirect_uri` 가 `http://127.0.0.1:PORT/oauth-callback` 만 통과한다. mdc-server 호스트를 callback 으로 넣으면 Google 이 `invalid_request` 로 거절한다. 그래서 `OPRN_PUBLIC_ORIGIN`(없으면 `Origin`/`Host`) 으로 **로그인 시작 URL만** `http://mdc-server:9888/oauth/launch?port=` 로 바꾸고, 돌아온 localhost 콜백 URL 은 `POST /auth/oauth-paste` 로 서버가 대신 GET 한다. Antigravity·Codex 브라우저 로그인은 `/launch` 가 아니라 Google/OpenAI 인가 URL을 바로 연다. 그 URL의 `redirect_uri`가 루프백 콜백이면 원격 origin에서 `pasteCallback`을 켠다. 편집기는 이 화면으로 돌아오면 클립보드의 localhost 주소를 읽어 버튼 없이 연결하고, 붙여넣기만 해도 바로 넘긴다. env 키는 `.env.local` 의 `OPRN_PUBLIC_ORIGIN`. `npm start` 는 값이 없으면 `http://mdc-server:9888` 로 고정한다.
- **OAuth 빠른 선택 (2026-08-24 / 기본 2026-08-25):** `aiAuthSettings.ts` 는 OAuth 모드에서 **ChatGPT(`openai-codex`) ↔ Google Gemini(`google-antigravity`) 두 카드**를 `role="radiogroup"` 퀵 선택으로 노출한다(테스트 `test/aiAuthSettingsSeparation.test.ts`). 공장 기본 제공자는 **`google-antigravity` + `gemini-3.7-flash`** 다(`DEFAULT_OH_MY_PI_PROVIDER`, `DEFAULT_MODEL`). 저장된 providerId·모델은 덮어쓰지 않는다. providerId 가 없는 옛 blob 은 Codex 시절 암시 기본이므로 `openai-codex` 로 남긴다. Gemini 퀵 카드는 Antigravity 로그인으로 라우팅한다(`google-gemini-cli` 는 레지스트리에서 사라졌다). 모델 목록에는 제공자와 무관한 GPT/Claude 항목을 섞지 않고 `gemini-3.7-flash`(빠른 기본)와 `gemini-3.1-pro`(품질 우선)만 먼저 보여준다. 이미 저장된 제공자·모델은 설정을 다시 열 때 덮어쓰지 않는다. 선택하면 providerId·select 값·aria 체크·onChange·상태 조회·기존 로그인 라우팅(`startChatGptLogin`) 을 전부 동기화한다. Gemini 카드는 구독·CLI를 암시하지 않고 `Google 계정으로 로그인합니다. 빠른 Gemini를 기본으로 사용합니다.`라고 안내한다. 드롭다운으로 다른 OAuth 제공자를 고르면 어느 카드도 체크되지 않되 첫 카드는 `tabindex=0` 을 유지해 키보드 사용자가 돌아올 수 있다. 제공자/종류 변경·취소는 내부 인증 연산 세대 카운터를 올려, 늦게 도착한 버전·상태·로그인 결과가 새 선택의 화면(연결 해제 크롬 포함)을 덮어쓰지 못하게 한다. API 키 제공자, 키 저장·연결 해제·폴링 최대 시도·오류(A/B) 의미는 그대로다. OAuth 는 언제나 로컬 oh-my-pi pi-ai 워커(`startChatGptLogin`)가 처리한다 — 비밀은 브라우저에 남지 않는다.
- **Google OAuth 자격 완전성 (2026-08-24):** Antigravity/Gemini CLI 자격은 access/refresh 토큰뿐 아니라 Cloud Code Assist `projectId`까지 있어야 실제 요청이 가능하다. `publicProviderStatus`(`scripts/lib/aiAuthRuntime.ts`)는 이 두 제공자의 오래된 불완전 자격을 `connected:false`로 내려 UI가 `연결됨`/`다시 확인`을 거짓 표시하지 않고 새 로그인을 시작하게 한다. 요청용 자격을 만들 때도 `projectId`와 OAuth 계정 메타데이터를 보존해야 한다. 토큰 세 필드만 복사한 뒤 갱신 결과를 저장본 위에 병합하지 않고 통째로 덮어쓰면 첫 completion이 방금 로그인한 `projectId`를 지워 다음 호출까지 망가뜨린다. 회귀 테스트: `test/ohMyPiComplete.bun.test.ts`의 projectId 없음/있음 상태 경계와 completion 후 보존 경계.
- **환경 변수 키는 동의 후에만 (2026-09-24):** 동반 서비스는 `envScan` 이 `allow` 일 때만 제공자 `envVars` 를 읽고 요청에도 그 키를 쓴다. 기본은 `ask`. AI 연결 패널이 찾아볼지 묻고, `POST /auth/env-scan` 이 `allow`/`deny` 를 `~/.oprn/oh-my-pi-auth.json` 에 남긴다. 환경 변수로 연결된 상태에는 연결 해제 버튼을 붙이지 않는다.
- **영역 작업 인증 게이트:** 영역 작업(`runRegionTask`)·AI 채팅은 LLM 호출을 하므로 OAuth/apiKey 가 미연동이면 401 `LlmError` 로 실패한다. 일상적인 설정 진입점은 하단 상태바가 아니라 편집기 헤더의 **AI 설정**(`topbar-ai-settings`)이다. `getAiConnectionStatus`와 `aiConnectionStatus.ts`는 상태 평가/단위 계약을 위해 남아 있다. `defaultAiConfig()`는 env `VITE_LLM_API_URL`이 있으면 apiKey 모드를 유지하고, env가 없으면 chatgpt OAuth가 기본이다. 단위 테스트: `test/aiConnectionStatus.test.ts`, `test/aiLlmClient.test.ts`, `test/aiChatPanelSettings.test.ts`.
- **조수 배치와 대기 화면 밀도 (2026-08-24):** 조수는 일반 workspace panel row와 별도다. 탑바 패널 메뉴와 command palette가 실제 `chatDock`의 `왼쪽 카드(glass)` / `오른쪽 고정(side)` / `입력줄(float)`를 직접 바꾸며, 헤더 `↗`는 입력줄로 즉시 떼어낸다. `assistantTemperature`는 `oprn:editor-layout:v4`에 저장되는 `quiet-gold` / `ink-only` / `map-first` 세 단계다. 추천+예시+시각 카드는 `quiet-gold`의 빈 패널에서만 보이고, `ink-only`는 조수 대화면만, `map-first`는 idle 본문을 접어 지도와 입력줄을 우선한다. 헤더·composer 메뉴는 같은 radio 메뉴를 공유하고 popup은 viewport 안에 고정한다.
- **조수가 턴 뒤에 칩으로 접히지 않음 (2026-08-27, 2026-08-30 갱신):** 유리/입력줄은 답을 읽어야 하므로 `scheduleCollapseAfterAiWork` 가 **칩 접힘**(`is-collapsed`, 48px 얼굴)을 하지 않는다 — `AUTO_COLLAPSE_AFTER_AI_MS = 0` 이고 함수 본문은 비어 있다. 이 항목은 그대로 유효하다. 2026-08-30 에 되살아난 것은 **본문 접힘(fold)** 뿐이며 입력줄이 남으므로 답이 얼굴 뒤로 사라지지 않는다(맨 위 항목). 복귀 버튼은 48px 얼굴만이 아니라 `조수` 글자가 있는 칩이다. 유리 카드는 불투명 `var(--bg-raised)` + `clamp(360px, 38vw, 520px)` 이고, 유휴 로그를 `display:none` 으로 접지 않는다. CSS 승자: `15-assistant-readable.css`.
- **편집 크롬 복원 (2026-08-25):** 편집 모드는 메뉴/워크스페이스/테스트/클래식 툴바를 다시 노출한다. 하단 `.editor-statusbar`는 마운트하지 않는다.
- **영역 작업 적용 후 드래그 선택은 해제된다 (2026-08-30):** 영역 작업이 맵에 반영되면 그 사각형은 「지금 무엇을 고를지」가 아니라 「방금 무엇이 바뀌었는지」를 가리키는 낡은 표시가 되고, 위에 뜬 선택 액션 칩(복사·지우기·구조물로 저장·AI)이 새로 만들어진 내용에 대한 지시로 오인된다. 그래서 `applyRegionProjectWithHistory`(영역 AI 실행·직접 실내 초안이 공유하는 **단일 store 반영 경로** — 즉시 적용·승인 후 적용·부분 적용·캔버스 인라인 수락·헤드리스 적용이 전부 이 함수를 지난다)가 반영 성공 뒤 `clearSelection()` 을 부른다. **적용된 맵의 선택만** 푼다(다른 맵에서 고른 영역은 이 적용과 무관). 버리기는 선택을 남긴다 — 다시 지시할 대상이 그 영역이다. 회귀 테스트: `test/regionTaskSelectionClear.test.ts`.
- **영역 작업은 플래너를 건너뛴다 (2026-08-26):** `isProtocolLocked` 합성 문장(`영역 작업 도구 규칙`)은 `agentMode auto`여도 `runOrchestratorPlanner`를 호출하지 않는다. 시공 경로가 이미 잠긴 지시를 다시 분해하면 oh-my-pi 워커 크래시(500 / `worker exited`)를 플래너+본문으로 두 번 연속 재시도한다. 워커 크래시 500은 본문 루프에서 1회만 재시도한다.
- **도구 규칙은 조수와 영역 작업이 공유한다 (2026-08-31, PR #378 의견만 반영):** 이전에는 도구
  규칙(재료 라벨 힌트 · 장식 상자 vs 보물상자 · `shape=circle` · `paint_road`)이 **영역 작업
  전용**이었다(`buildRegionTaskMessage` 의 `toolGuide` 배열). 그래서 선택 사각형 없이 조수에게
  같은 말을 하면 같은 요청이 다른 규칙을 받았고, 가방 그룹을 재료로 쓰거나 장식 나무상자를
  `place_chest` 로 놓거나 원형 호수를 네모로 채우는 실수가 조수 쪽에서만 반복됐다.
  이제 정본은 `src/ai/turnGuide.ts` 의 `buildTurnGuide({ instruction, tileset, scope })` 하나다.
  **스코프(선택 사각형)는 엔진이 아니라 인자다** — 있으면 «영역 밖 금지» 문구와 `tile_query` 의
  `mapId` 가 더 붙고, 없으면 재료·도구 규칙만 붙는다. `buildRegionTaskMessage` 는 여기에 위임하고
  footer 만 더하며(1115 → 986줄), `aiChatPanel.sendText` 는 `resolveTurnScope`(선택이 현재 맵
  것이고 `isRegionEscapingIntent` 가 아닐 때만 스코프) + `tilesetForTurn` 으로 같은 가이드를
  붙인다. `formatMaterialLabelHint` · `constructionFacadeLine` · `PROP_VOCAB` 도 turnGuide 가
  정본이고 `runRegionTask` 는 재수출만 한다(기존 수입자 호환).
  - **함정 (실측):** `buildTurnGuide(scope 있음)` 은 domainSeed · scopeLine 을 **이미 포함한다.**
    호순부에서 그걸 또 붙이면 같은 문구가 두 번 들어가고, 늘어난 키워드가 **도구 노출 상한(40)을
    잠식해 `build_house_kit` 같은 핵심 도구가 밀려난다.** 이 증상은 메시지 본문을 읽어도 안 보인다 —
    `toOpenAiTools(undefined, { domains }).map(t => t.function.name)` 을 직접 세라.
  - **위임이 무해함을 증명하는 방법:** 동일 입력(**타일셋 포함**)으로 메시지를 파일로 덤프해
    `origin/main` 워킹트리와 `diff` 한다 — 바이트 일치해야 한다. 규칙 줄(`- ` 시작)만 비교하는
    것보다 안전하다: 시드·스코프 줄은 `- ` 로 시작하지 않아 그 범위에서 안 보이고, 상한(40) 증상을
    정확히 그 함정이 만들었다. 계약 테스트: `test/turnGuideSharedRules.test.ts`
    (사보타주: 스코프 없을 때 가이드를 `""` 로 만들면 7건 실패, 두 경로를 갈라놓으면 2건 실패).
  - **옛 PR #378 을 그대로 붙이지 말 것:** base 가 main 보다 319커밋 뒤여서 영역작업 하위 시스템
    31파일을 지우고, `analyzeRegionBlend`(#347 다듬기) · `verificationGate` 배제(#335) ·
    `resolveSurfaceAiConfig`(#349) · 적용 뒤 선택 해제(#354)를 전부 되돌린다. 생산적인 신규분은
    `turnGuide.ts` 하나라 그것만 가져왔다. 또 #378 은 «결과는 사용자 승인 후에만 반영된다» 문장을
    떨궈서 되살렸다 — 조수도 제안 카드로 승인을 받는다.

- **영역 작업 bare 집 → 야외 집 직시공(2026-07-24 수정):** 영역 작업(`buildRegionTaskMessage`)에서 사용자가 현재 맵 위에 선택 영역을 준 상태로 “집”이라고만 하면, 이전엔 “야외/실내 되묻기”로 턴이 끝났다(0건 호출). 이제 영역 선택 자체가 현재 맵 위 야외 시공 의도의 신호이므로 `author_house(kind:"single")`로 바로 시공한다. `constructionFacadeLine`의 bare fallback은 `/집/`만 잡고 `/건물/`은 잡지 않는다 — 탑/성벽/대장간 등은 structure 가이드가 `build_wall`/`create_farm_plot`으로 안내한다. 채팅 경로(영역 footer 없음)는 `resolveIntentClarification`(`intentClarify.ts` PROTOCOL_LOCKED_RE)가 여전히 bare 집을 사전 차단해 되묻는다 — 영역 메시지만 “영역 작업 도구 규칙” 마커로 protocol-lock 을 우회한다. 단위 테스트: `test/regionTaskRun.test.ts`.

- **AI 리�튂 문서(`present_doc`, core ?꾨찓??:** AI媛 ?쒓컖 ?먮즺媛 ?꾩슂???ㅻ챸(?ㅽ넗???구조쨌???문법·비교????**?섏씠釉뚮━??블록 문서**濡?만든?? 블록: `markdown`/`table`/`sheetMap`(칩�뀑+議??ㅻ쾭?덉씠)/`tileBlockCard`(?곸뿭 ?�롭 카드)/`paintDemo`(RM2k3 3횞4 블록 ?명꽣?숉떚釉??섏씤??/`html`(sandbox iframe, allow-scripts留?. 구조??블록? **?댁븘?덈뒗 ??쇱뀑**(`tilesetImageUrl`)?먯꽌 그려??base64 불필?붋룹??좏겙. 채팅 踰꾨툝濡??몃씪???뚮뜑(`aiChatPanel` present_doc ????`aiConversationLog.appendAiDocument` ??`aiDocRenderers.ts`), `project.aiDocuments[]`???곸냽(`list_ai_docs`濡?조회). Code: `src/editor/tools/aiDocTools.ts`, `src/editor/panels/aiDocRenderers.ts`. Tests: `test/aiDocTools.test.ts`.
- **NPC dialogue faces:** `place_npc` / `make_villager` auto-insert `changeFace` from charset?뭚aceset (`src/assets/charsetFaceMap.ts`) before text. Starter village NPCs already authored faces; do not leave talk pages without face.
- **Interior beta room (villager house, not harness gold):** current gallery map `map_interior_blank` / `?ㅻ궡 공터 (????섎꽕??` is a **beta tileset-authoring room** for a normal villager house, not an official `build_house_kit` harness. Exit alcove target is lower cell **(7,11)**. Intended events later: exit transfer + chest/drawer inspect + bookshelf inspect + NPC talk. Do not promote to harness until the user says so. Interior auto-connect needs the seeded dark-wall `tileset.autotileGroups` entry (`366` brush); harness `tileGroups` alone do not reshape. 援?`wall-frame-autotile`(105 몸통 + 233/258 코너) 그룹? ?쒕뱶?섏? ?딆쑝硫?pack ?곸슜 ????λ맂 ?꾨줈?앺듃?먯꽌???쒓굅?쒕떎 ??주택 踰쎌? ?ㅽ넗??쇱씠 ?꾨땲???듯???grammar??
- **二쇰? 吏??ㅻ궡 ?ㅽ듃 `villager-room-v1` (?덉감?겶룸??고꽩):** village ?몄뀡怨?媛숈? ?덉씠???뚯씠?꾨씪?? Code: `src/editor/interiorRoomPipeline.ts` + tools `start_interior_room_session` / `advance_interior_room_build` / `run_interior_room_pipeline`. **Build order:** `plan ??floor(bbox) ??walls ??furniture ??entrance ??critique`. **Walls = ?섏슦????whole-tile grammar (`planInteriorHouseWalls` / `paintInteriorHouseWalls` ??Option B, 주택 踰??좎씪 writer)**: ????ㅽ넗????놁쓬 ??`shapeAutotileGroupAround`瑜??몄텧?섏? ?딄퀬 ?꾩꽦 ?듯??쇱쓣 `lowerTiles`??직접 기록?쒕떎. 媛숈? plan? ??긽 媛숈? grid瑜?만든?? ?대몢??벽만 **366** ???+ 쿼터 ?뚮뜑(?숆뎬/吏?????꾩슜). ?뺣낯 ?곸닔??`HOUSE_SHELL_TILE` in `src/project/defaults/interiorHouseWallTiles.ts` ?섎굹??援?`INTERIOR_HOUSE_SHELL_CREAM_FACE`/`INTERIOR_WALL_FRAME_TILES`/companion 개념? ?먭린). 배치 ??븷 ?대쫫? variant 결손 방�뼢???꾨땲??**?ㅼ젣 ?쎌? ??방�뼢**???곕Ⅸ????**?�림 踰쎈㈃ 2?? ?쀬쨪 74/75/76 쨌 ?꾨옯以?104/105/106**(媛濡?run ???앸쭔 L/R), **1移??몃줈 칸막????77 쨌 ??107**(천장 직하 2칸만; 臾??대궓쨌泥쒖옣 밴드 愿???댁? ?꾨젅???ъ뒪??428), **457 罹?*(罹???조인??**458(NW)/456(NE)** ??**233/258 湲덉?**), **?ъ뒪??428(??/426(??? 바닥 留덉?留??됯퉴吏 강제**, ?⑥륫 ?몃┝ 397? 바닥 ??쭔, **?�쪽 ?媛?코너???ㅼ젣 공허 430**(援??쒕젋??368 荑쇳꽣媛 감쌈???섏〈? ??젣 ??430? 쿼터 ?⑹꽦 중심???꾨땲??. **臾?*: ?몃┝ ?됱뿉??`398(?? | 바닥 72 | 396(??`, ?꾨옒 ?됱? **`397` 계단 ?섎굹肉?*(**257 받침 湲덉?** ??좌우??공허 430?쇰줈 ?⑤뒗??. `HOUSE_SHELL_FORBIDDEN_TILES = [233, 257, 258]`: 233/258? ?묓겕 ?뚮젅?댁뒪??? 257? 媛援?질감?대씪 踰승룸Ц 목�쟻?쇰줈 ?덈? 기록?섏? ?딅뒗?? 벽걸?대뒗 踰쎈㈃ **?쀬쨪**(?꾨옒 ???踰쎈㈃???), ????媛援??곷떒? **?꾨옯以?*??겹침(?붾뜒 21 upper|51 lower). 벽걸??????媛援??곷떒? 踰쎈㈃ ?꾨옒以?`listWallFace` = `houseShellWallMembers`) upper??겹친?????붾뜒 21(upper, 踰쎈㈃)|51(lower, 바닥) ?몃줈 hard ?띿씠 湲곗? ?덉떆. (援?**366 ?ㅽ겕??留?*? ?숆뎬/吏?????꾩슜 ??`paintDarkWallAndShape`???좎??섎ŉ 吏??ㅻ궡 walls ?덉씠?댁뿉?쒕뒗 ???댁긽 ?곗? ?딅뒗??) 踰??ъ쭏 리�떞?몃뒗 `retintHouseWallFace(map, material)` ???�림 2??`77`쨌`107`留??꾩꽦 벽돌 硫?gold `314??16`/`344??46`, stone `134??36`/`164??66`)?쇰줈 諛붽씀怨?캡�룻룷?ㅽ듃쨌?몃┝쨌臾??꾨젅?꾩? 嫄대뱶리�? ?딅뒗?? **Entrance event** at door: valid `{ kind:"text", body }` (not `lines` ??invalid shape was dropped on save), trigger action, name `?낃뎄`. **Hard bed 355|356**. **Pictures 114|115 horizontal pair**. **湲??곸옄 325|326 hard ??*, **괘종?쒓퀎 389|419 hard ?몃줈??*, 카운?????뚰뭹(237/235/238)? 카운??lower ??upper. **No indoor plants**. **諛???뚰삎 諛?보정, 2026-07-14):** 媛?뺤쭛 4諛?媛숈? ?뚰삎 맵에??鍮?바닥??과다?섎뜕 문제 ?댁냼 ??`placeSouthFiller` ?꾧퀎 **area??0**(援?48), ?щ텇硫?보정·?됯? `floorCells??4`(援?60), 침�떎/거실 ?ш렇쨌踰??댁쨷 ?μ떇쨌踰??ㅻ깄 ?곸옱 ?곹뼢, 주방 ?묒뾽?+?곸옱 ?곹뼢, ?뚰삎 ?쒖옱 ?쒓? 1??怨쇰? 봉쇄 방�?). walkability???꾨떖 遺덇? ?ъ폆??遺숈? ?쒓굅 媛???뚰뭹(`CABINET_U` ?ы븿)??異붽?濡??뱀씤?? **諛?구조(bbox)**: `plan.rooms = [{id,x,y,w,h,theme?}]` ??吏????wings ???rooms ?⑹쭛?⑹씠 바닥, **방�쭏???먭린 ?뚮쭏 媛援?*. ?곹븯 ?몄젒 방�? **3??간격**(밴드 = 罹?457 + ?�림 踰쎈㈃ 횞2, 간격 1~2??critique 경고). **좌우 ?몄젒 諛?gapless)? 1???섏쭅 ?뚰떚??* ??천장 직하 2移몄? ?�림 1移??명듃 **77|107**, 천장 諛대뱶쨌臾??대궓? **428** ?꾨젅?? ?뚰떚???? **????븷 계산 ?꾩뿉 ?덉빟**?쒕떎(`planInteriorHouseWalls` ?대?). walls ?댄썑??`105` 紐명넻留???뜕 ?꾩쿂由?`paintRoomPartitionWalls`??**??젣?먮떎** ???섏궡리�? 留?寃? 주택 ?ъ뒪?몃뒗 ?꾩꽦 ?듯??쇱씠??방�쓣 ?ν븳 **?쒖そ ?좊쭔** 갖는???ㅽ겕 1??기둥??426|428 좌우 諛?쿼터? ?ㅻⅤ????주택 ?? 쿼터 ?⑹꽦???吏 ?딅뒗??. `plan.innerDoors = [{x,y}]`: ?섑룊 ?뚰떚?섏씠硫??몃줈 3移?복도 + 398|396 ?뚮옲?? **?섏쭅 ?뚰떚?섏씠硫?1移?臾?*(醫뚯슦媛 바닥?대㈃ ?먮룞 ?먮퀎). 臾?媛쒓뎄遺 ?? faceBottom/?몃┝ 규칙?먯꽌 ?쒖쇅(???꾨옒 기둥 ?좎?, doorGapKeys). 벽걸?대뒗 湲?踰쎈㈃ run ?곗꽑(?대? 臾몄쑝濡?履쇨컻吏?2移?구�컙 ?뚰뵾). ?곕え: `map_interior_inn_rooms_v1`(諛?5媛? 李쎄퀬쨌媛앹떎횞2·주방·?, ?섏쭅/?섑룊 ?뚰떚???쇳빀). Gallery: `npx tsx scripts/build-interior-room-gallery.mts`, ?ш? ?덉떆: `scripts/build-inn-interior-map.mts`, 諛?구조 ?곕え: `scripts/build-inn-rooms-demo.mts`. 媛?뺤쭛 4諛??ъ깮?? `bun scripts/build-home-4rooms.mts` ??project `rpg-zzu-home-8pyeong` / `map_home_4rooms_v1`.
- House-harness interiors and door events are shared through `src/editor/houseInteriors.ts`. `build_house_kit` and `build_village` default to `interior:true`: they keep the existing exterior grammar, put the door's **appearance on the Object1 charset door event** and therefore **do not paint the 116/146 door tiles** (painting both stacked a tile door under the sprite door — 2026-08-30 fix; the kit wall stays under the event so the wall has no hole), add that door event on the door cell (its page runs `playAudio { resourceId: HOUSE_DOOR_OPEN_SE, loop:false }` → CC0 「문 열기 01」 → three open frames → `transfer`), create one `easyrpg_chipset_interior` child map per house, and add a player-touch exit back to the exterior door-front cell. **Interior map body uses `villager-room-v1` only** (`runInteriorRoomPipeline` via `houseInteriors.ts`). Scales: **cottage-l** 20횞16 **true L floor** (NW kitchen/hearth + NE bedroom notch + south hall only ??SE void; default 1F dwelling/manor; housePlans may set ownerName+program explicitly), **cottage2** 20횞20, **cottage3** 20횞20 three rooms, **mansion** 24횞22 six rooms + corridor (`gold-brick`, 2F+ manor). Demo chief exterior uses housePlans templateId `l` (?깆옄).. Entry/exit landings are force-passable. Old 13횞10 single-room stub is removed. `build_house_kit` clears an impassable south door-front cell to the local majority passable ground tile and warns about the cleanup; if the door front is outside the map, it fails with a south-margin message. Pass `interior:false` to keep the legacy exterior-only result. **Room kits available:** house interiors = `villager-room-v1` only; dungeons = separate `dungeon-room-v1` (not used for village houses).
- AI/tool changeset commits keep `CommitResult.issues` as the full lint list and expose `CommitResult.blocking` for newly introduced blocking errors. Tool-runner commit failures should show `blocking` first so pre-existing project errors do not mask the new rejection cause. `src/editor/tools/toolRunner.ts` treats post-run diff/commit exceptions as a failed tool result (`?꾩쿂由??ㅽ뙣`) rather than a turn-level crash.

- AI/tool changesets accepted through `src/editor/tools/applyChangesetToStore.ts` or the AI chat panel record one LegacyDb commit row plus one project change row with editor identity. Manual edits are batched at successful autosave/flush time and deduped by the last recorded serialized project.

- AI write-tool proposal generation uses `src/editor/agentGhostPreview.ts` for both legacy tool-argument summaries and live draft-diff previews. `aiChatPanel` and `runRegionTask` throttle successful write `tool_call` events at 150ms, compare the current store/base project to `session.getProposedProject()`, and replace the ghost pub/sub state with changed map cells/events. The map renderer keeps sprites for cells that are already on screen and only creates objects for newly painted cells, so a live tile pass does not destroy and rebuild the preview layer on every throttle tick. `EditScene` renders only previews whose `mapId` matches the currently viewed map, so off-map draft work appears when the user later switches maps. Accept/reject/new-session/modal-close and error/abort paths must call `clearAgentGhostPreview()` before any accepted `agentFocus` highlight runs.

- AI proposal cards run a conservative completeness lint before display. If the current-turn or relevant active BuildSpec declares an asset/area that no actual changed tool region touched, or if a no-spec request clearly expected edits but produced no changed calls / a severely short counted placement, the closed `자세히` drawer shows the completeness line and stores the same message in `ToolResult.diff.warnings`. The lint also adds proceed-instruction hints for 0-change turns and flags assistant final text that ends with a wait-please promise when no write tool or proposal was produced.
- 적용 결과는 변경 카드(`aiChangePreview` / `ai-change-card`)가 보여준다 — 배지(`적용됨`, 검토 단계는 `적용 전`) + 한 문장 제목 + 명사 나열 요약(`집 3 · 강 · 앞마당`, `타일 4` / `세계관 1` / `프리셋 2`; `채`/`칸`/`그루`/`건` 이나 툴 이름은 쓰지 않는다) + before/after 미니맵 + `되돌리기`. 결정 카드(수락/거부/항목 선택)는 없다 — 사용자는 결과를 보고 되돌릴지만 정한다.
- **카드가 그림으로 말할 수 없는 변경 (2026-09-14 실측):** 미니맵은 `renderRegionSnapshot`(타일 + 이벤트 좌표)이라 타일·이벤트 위치 밖의 변경(대사·퀘스트·설정·캐릭터·맵 연결)에서는 두 장이 **같은 그림**이 된다. 그때는 `changePreviewPanesMatch` 가 캔버스를 아예 만들지 않고 `ai-change-word-diff` 한 줄로 사실을 말한다 — 같거나 다른지를 렌더 입력(맵 크기·타일 크기·타일셋 정의·타일 배열·이벤트 좌표) 전부로 판정하므로, 그림이 실제로 달라지는 경우를 접지 않는다. 크롭은 `computeMapTileChangeBounds`(`aiProposalCard.ts`)이고, `renderProposalMapThumbnail` 은 **호출자 0인 죽은 코드**다(승인 카드 시절 잔재 — 이 문서의 옛 서술은 틀렸다).
- **요약 카운터 밖의 변경도 이름으로 남는다 (2026-09-14):** `ChangeSummary` 의 카운터 목록은 손으로 관리돼 퀘스트·스토리 플래그·캐릭터·맵 연결·공통 이벤트 같은 필드에서 뒤처졌고, 그 턴은 검토 카드에 칩이 **하나도** 없었다. `src/project/changeAreas.ts` 가 "명시 카운터가 없는 필드가 바뀌었나" 를 여집합으로 계산해 `changeChipsWithAreas(diff, areas)` 가 카운터 뒤에 붙인다. `ChangeSummary` 에 필드를 더하지 않는 이유: `proposalSafety.isPositiveTileOnlyDiff` 가 모르는 키를 만나면 거짓을 내므로(자동 적용이 조용히 멈춘다) 영수증 어휘는 자료형 밖에 둔다.
- **변경 내역(긴 명세) — 큰 위임은 그림으로 검토할 수 없다 (2026-09-14, 감독 지시):** "before/after 가 굉장히 긴 명세여야 하는 것 아닌가. 보통 맡기는 일이 매우 클텐데." `src/project/changeLedger.ts` 가 두 프로젝트에서 **항목별 before → after** 를 계산하고(`buildChangeLedger`), 카드와 넓은 뷰어가 그 목록을 그린다(`ai-change-ledger`, 기본 펼침, 목록만 `max-height` 스크롤). 영역은 고정 순서(프로젝트 정보 → 시작 위치 → 시스템·세션 → 맵 → 이벤트 → 데이터베이스 → 스위치·변수·퀘스트·스토리 플래그·캐릭터·공통 이벤트·엔딩·프리셋·자원·맵 연결·세계관·마을·AI 문서 → 타일셋)이고, 항목 하나는 `영역 · 이름 · (추가|삭제|변경)` + `필드: 이전 → 이후` 줄들이다. 판정은 열거가 아니라 여집합이라 **모르는 모양도 키 이름과 값 요약으로 남는다**. 신원은 `id` → `key` → 자리 번호 순(퀘스트는 `key`, 자원은 `assetId`, 캐릭터·칩셋 이름은 합성 키). 값은 한 줄로 접는다 — 타일은 `N칸 바뀜`, 목록은 `개수 + 앞부분`, 중첩 개체는 JSON 이 아니라 키 이름(`hp HP, mp MP (2개)`). 상한(기본 400)을 넘으면 자르고 `N/M건` 으로 전체 수를 알린다.

- The proposal completeness lint warns when a turn declares three or more story flags without `define_quest`, so narrative-heavy turns are nudged toward a quest graph and `verify_quest` acceptance path.

- `AssistantSession` also treats prior-turn active BuildSpecs as proposal-scope risk: if the next proposal uses that carried-over spatial plan, the first changed call stores `??범위: ???쒖븞?먮뒗 ?댁쟾 계획(...)???ы븿?섏뼱 ?덉뒿?덈떎.` in `ToolResult.diff.warnings`. This warning rides the same proposal warning-line frame as completeness warnings.

- Proposal assembly squashes event movement trial runs before display. Repeated `move_event` calls for the same target keep all tool/audit events, but `proposedCalls` retains only the final move; if a newly created event (`place_npc`/similar event base call) is immediately moved, the creation proposal is rewritten to the final event coordinates instead of showing separate move rows.

- The proposal completeness lint no longer warns about unrecorded worldview (removed 2026-08-28 with the rest of the worldview AI wiring; see `openwiki/editor-pre-edit-routing.md`). `worldEntitiesAdded/Modified` stays in `ChangeSummary` and in the card summary vocabulary, but no tool writes it now — a nonzero count means the wiring came back.

- Accepted AI changesets also run `src/editor/agentFocus.ts`: the editor selects the map with the largest visible map/event change and emits a transient `.agent-focus-highlight` overlay for changed cells or bounds. Keep this on AI acceptance paths only; manual paint/updateMap flows should not request the highlight.

- AI spatial build calls are gated by `src/ai/buildSpec.ts` through `AssistantSession`: `set_build_spec` validates the outline, then spatial write tools use that outline as the starting contract. Empty-space overruns auto-expand the active BuildSpec and pass with `spec-gate-auto-expand` warnings; expansion into existing built cells is still blocked. `build_house_kit` wings are compared as individual rectangles plus the actual door-front footprint rather than one merged bounding box. Clear assets may overlap later placement assets when `buildOrder` puts `clear` first, and an explicit terrain-before-road order permits a road overlay on terrain. Other placement-vs-placement overlap remains an error. Destructive clear/overExisting/confirmDestroy structure-protection checks still come from actual map contents and must not be softened.
- **Inferred viewport placement (2026-09-06, R8):** `viewRelativeLocation.ts` infers only a single explicit screen/viewport placement clause. Quoted dialogue/code, exact-copy text and inventory facts are inference-only exclusions; raw messages and authored dialogue remain unchanged. Separate object directions never combine into a corner, and map-relative directions require map BuildSpec coordinates. The inferred box is separate from selection specs, cannot auto-expand, and retains existing-cell protection. A planned item must itself carry the matching viewport placement instruction to use that inferred permit; unrelated ground/NPC items need their own scope. The first matching spatial gate binds its item id. Spatial coverage counts matching placement-tool evidence, not a same-cell NPC, and includes already-applied milestone calls. Ordinary quantity/diff completeness instead uses an item-owned proposal ledger, including before application; a BuildSpec cannot bypass the item's quantity check. Manual/synthetic continuations retain the original box, owner and applied ledger; new goals reset them. Regression: `test/assistantSpatialObligations.test.ts` (captured R8 request, real draft tools and milestone rebase; persistence boundary replaced only in milestone tests).
- **밑그림 게이트 강화 — 스코프와 보호를 갈라 세운다 (2026-09-03 적대적 리뷰):** 코드 프로브 20건과 실제 조수 턴 2회(`/tmp/blueprint-shots`, 회귀 테스트 `test/aiSpecGateHardening.test.ts`·`test/agentBlueprintHardening.test.ts`)로 밑그림이 「구간 격리」라는 서술과 다르게 동작함을 확인해 고쳤다. (1) **좌표 정규화**: `set_build_spec` 은 runTool 정규화를 안 거치므로 모델이 `"2"` 문자열을 보내면 검증기는 받아주고 세션은 원본을 저장했다 — 게이트의 `x + w` 가 `"24"` 문자열 결합이 되어 밑그림 밖 벽 16칸을 `clear_region` 이 지웠다. `normalizeBuildSpec` 이 저장 직전에 정수로 굳힌다. (2) **기존 내용 보호는 제출 시점이 아니라 호출 시점, 밑그림 안팎 불문**: `protectedCellsInRegions(baseline, regions, assets, tileset)` 가 **기준선 맵**(`baselineProject`, 사용자 맵)에 있던 지어진 칸 중 에셋 선언(`clear`+`confirmDestroy`, 배치 에셋의 `overExisting`)이 덮지 않은 칸을 세고, 하나라도 있으면 차단한다. 이 세션이 초안에 그린 것은 기준선에 없으므로 다시 손댈 수 있다(재작업 허용). 종전에는 밑그림 안에 지은 집을 같은 턴 `clear` 가 무검사로 지웠고, 확정 뒤 사용자가 판 호수를 다음 턴 채우기가 덮었다. (3) **게이트 대상**: `SPATIAL_BUILD_TOOLS` 에서 레지스트리에 없는 tile_* 4종을 뺐고, 살아 있는 v3 프리미티브 7종(`tile_erase`·`place_props`·`build_wall`·`lay_path`·`place_door`·`place_window`·`build_roof`)을 `TILE_WRITE_TOOLS` 로 묶어 **밑그림 없이도 실행되되(soft-allow 유지) 기존 내용 보호는 받게** 했다 — 프롬프트가 정리용으로 권하는 `tile_erase` 가 절벽 능선 6칸을 무검사로 지운 실측이 근거다. `affectedRegions` 가 `area`·`at`·`wallRect` 를 읽고, `paint_tiles mode=fill` 은 맵 전체를 영향 영역으로 본다. (4) **지어진 칸 판정은 잔디 리터럴이 아니다**: 타일셋 그룹 역할 `terrain` 이고 통행 가능한 하위 타일이 바닥(`groundProfileFor`). 잔디(240)만 바닥이던 시절 얼음 대평원(눈 67·바닥 70)은 62×62=3844칸 전부 구조물이라 실제 턴에서 `author_house`·`author_village`·`paint_road`·`fill_region` 이 「기존 구조물 N칸」으로 5회 차단됐고 모델은 통과하려고 28×22 `clear`+`confirmDestroy` 를 선언했다. 길(흙길 오토타일도 terrain)은 이제 바닥이라 길 옆 집이 `overExisting` 을 요구받지 않는다. 최외곽 링은 전부 WALL 인 생성 테두리일 때만 제외한다(사용자가 가장자리에 세운 벽은 보호). (5) **교차 규칙**: 타일을 쓰지 않는 `npc`·`event`·`transfer` 는 길·집과 겹쳐도 교차 오류가 아니다. (6) **암묵 스펙은 프로덕션에서 죽어 있었다**: `implicitSpecFromContext` 의 `$` 앵커 정규식이 패널 footer(재료 힌트가 맵과 선택 사이)와 영역 작업 footer(힌트가 뒤)를 모두 놓쳤다 — `contextFooter.parseContextFooter` 가 항목 단위로 읽고(맵 이름의 ` · `·괄호 허용), `sendUserMessage opts.scope` 도 암묵 스펙이 된다. 암묵 스펙의 자동 확장은 `turnImplicitSpec` 에만 쓰고 `activeSpec` 으로 승격하지 않는다(승격되면 다음 턴부터 그 맵의 게이트가 밑그림 없이 열렸다). (7) **질문 턴**: 밑그림 NPC 자동 배치(`buildSpecNpcAssetsDirectly`)는 변경을 기대하는 턴이고 모델이 되묻지 않았을 때만 — 「이 위치로 진행할까요?」 뒤에 승인 카드 없이 NPC 가 맵에 들어갔다. **청사진 쪽**(`agentBlueprint.ts`·`agentBlueprintRenderer.ts`): 재제출로 에셋 id·사각형이 바뀌면 같은 종류가 새 칸을 절반 넘게 덮을 때 진행을 물려받고 정산 대상(`turnAdvanced`)도 넘긴다(다 지은 집이 planned 파랑으로 영구 잔류하던 run1 실측); 진행 귀속에 덮인 비율 하한 0.02 를 둬 집 호출의 문 앞 1칸이 맵 전체 `clear` 칸을 building 으로 올리지 않는다; 라벨은 좁은 칸(3칸 미만)·41개 이상은 순번만, 같은 자리에서 시작하는 라벨은 줄을 내려 쌓고(`blueprintLabelLayout`), 제도선 아래 어두운 halo 를 깔아 얼음 배경(대비 1.5:1)에서도 보이며, `shape` circle/ellipse 는 타원으로 그린다. 남긴 것: `fill_region` 이 벽까지 메우며 rect 밖 몇 칸을 쓰는 것(빈 틈이라 보호 무관), 모든 쓰기 커밋의 「수관 보완 3칸」이 요청 영역 밖 상위 타일을 심는 것(게이트 밖).

- **실행 한도 중단도 적용 원장을 정산한다 (2026-09-05):** 마일스톤은 `turnProposals`를 비우므로 미적용 제안 0건이 변경 0건을 뜻하지 않는다. `truncatedTurnText`는 두 예산 종료 경로에서 `turnAppliedMilestoneCalls.length`를 받아 **이미 적용한 변경**과 **아직 적용 전인 제안**을 따로 안내한다. 미적용은 승인 대기를 뜻하지 않으므로 수락/승인 문구를 쓰지 않는다. `aiTurnRunner`는 마일스톤 이벤트와 반환 원장을 중복 없이 세고, 종료 시 실제 적용에 성공한 제안만 더해 활동 로그 `result.appliedCalls`와 성향 기록 `changed`에 반영한다. 원장은 재적용하지 않으며, `noteNoChanges`와 변경 0건 오류 알림도 원장을 확인한다. 합성 `driverContinue`의 의도 선언 입력은 「계속」을 유지하지만 `currentTurnInstruction`/`currentTurnRequestText`는 사용자의 원래 요청을 유지해 검수가 「계속」만 보는 일을 막는다. 다음 실제 사용자 요청에서 둘을 새로 설정한다. 회귀: `test/aiAppliedBudgetStop.test.ts`, `test/aiTurnAppliedAccounting.test.ts`, `test/aiMilestoneTurnAccounting.test.ts`.

## 고스트 미리보기 · 활동 표시 · 청사진 · 카메라

- **Ghost reveal = single left→right wipe (2026-08-27, replaces the stamp sequence):** 변경 셀은 AFTER 타일(`AgentGhostCell.tilesetId`/`tileId`, `summarizeAgentGhostPreviewForProjectDiff` 가 채운다)을 들고 있고, 공개 순서는 순수 함수 `buildGhostRevealSchedule(cells, { durationMs? })` 가 만든다: **열(x) 단위 와이프** — 같은 열은 같은 시각에, 시각은 열 인덱스가 아니라 **x 위치에 비례**(`(x-minX)/(maxX-minX) * durationMs`)하고, 총 길이는 셀 수와 무관하게 `GHOST_WIPE_DURATION_MS`(420ms) 고정이다. 한 열뿐이면 전부 0ms(즉시), 빈 입력은 빈 스케줄. 열 안 정렬은 y↑ 그다음 lower→upper→event. `AssistantSession` 은 각 도구 실행 직전 `tool_started`(`{name, index, args}` 1-based)를 네 emit 지점 모두에서 내고, `aiTurnRunner`/`aiRegionTaskRunner`가 `setAgentGhostRunningTool(name, args)`로 넘긴다. 고스트 스토어는 `runningToolName`과 명시적 `args.mapId` 또는 `args.target.mapId`에서 얻은 `runningToolMapId`를 함께 보관한다(2026-09-06). 대상 불명 이벤트는 채팅 활동만 표시하며, 비동기 수신 시점의 `editorState.currentMapId`나 이전 청사진에서 대상을 추정하지 않는다. `AgentGhostPreviewRenderer`(`agentPreviewRenderers.ts`)는 `ensureTilesetTexture`/컴포지터 경로로 만든 스프라이트를 alpha 0.62 로 두고, 와이프 선단이 지난 셀을 `setVisible(true)` 로 드러내는 것 **외에 아무 연출도 하지 않는다** — 셀별 스탬프 팝·인디고 링·앰버 잔광·스파크·빌드 커서·완료 대각선 샤인은 2026-08-27 에 제거됐다(연출이 '무엇이 바뀌었는지'를 가렸다). 순수 `computeGhostAnimationState(schedule, elapsedMs)` 는 셀당 `phase: "pending" | "revealed"` 와 `revealedCount`, 그리고 마지막 열 + `GHOST_WIPE_HOLD_MS`(150ms) 뒤의 `isScheduleComplete` 만 돌려준다(테스트용 주입 시계는 생성자 `options.clock`/`setClock`). DOM 진행 칩(`data-testid=ai-ghost-phase-chip`, 스타일 `src/styles/editor/ghost-phase-chip.css`)은 진행 중 `narrateAiActivity(toolName).action · N/M 셀`, 끝나면 중립적인 `초안 완성`으로 표시한다 — 꼬리의 원시 `toolName` 은 2026-08-29 에 제거됐다(아래 라이브 활동 항목). 같은 렌더러를 채팅과 `runRegionTask`가 공유하므로 완료 칩은 승인/검토 단계를 약속하지 않는다. **공개 시각은 누적이다**: 렌더러가 셀별 `startMs`(턴 시작 기준)를 `cellStartMs` 에 기억해 두므로, 프리뷰가 커지는 도중에도 이미 드러난 셀은 처음부터 다시 나오지 않고 **새로 들어온 셀만** 지금 시점 기준의 좌→우 와이프를 받는다. 사라진 셀의 시각은 버리는데, 그 판정은 프리뷰 셀 개수가 아니라 **서로 다른 키의 수**와 비교해야 한다 — 같은 맵에 프리뷰가 두 장 얹히는 `appendAgentGhostPreviewForToolCall` 경로에서는 같은 좌표가 중복 계수돼 청소가 건너뛰어지고, 되돌아온 셀이 이미 지나간 시각을 물려받아 와이프 없이 튀어나온다. >256셀 bbox-only 폴백, DOM 마커, 영역 작업의 인라인 승인 툴바, hold-to-original 계약은 변하지 않았다. Tests: `test/agentGhostPreviewRenderers.test.ts`, `test/agentGhostPreview.test.ts`, `test/e2e/agent-ghost-sequence.spec.ts`.

- **AI 가 지금 하는 일은 한 원천이 말하고, 표시는 작업 위치에 붙는다 (2026-08-29):** 사용자 보고는 두 가지였다 — 무엇을 하는지 안 보이고, 보이는 표시가 엉뚱한 곳에 있다. 실측한 원인은 서로 조율되지 않는 세 표면이었다: (1) `tool_started` 의 유일한 소비자가 `setAgentGhostRunningTool` 이라 고스트 셀이 생기기 전에는 화면이 전혀 안 움직였다(도구 실행 구간 전체가 침묵), (2) 상태 배지는 `formatAiRunningStatus` 가 만드는 `생각 중… 12초 · 도구 3` 으로 경과·횟수만 말했다, (3) 진행 칩은 `ghost-phase-chip.css` 의 `left/top: var(--space-3)` 로 **캔버스 좌상단에 고정**돼 작업 위치와 무관했는데 정작 영역 rect 에 앵커된 `EditScene.renderRegionTaskBadge` 배지는 `✨ AI 작업 중…` 으로 아무것도 구체적으로 말하지 않았고, 칩 문구는 내부 도구명을 노출해 `promptPolicies` 의 금지 규칙을 어겼다.
  이제 문구의 단일 원천은 순수 모듈 `src/editor/aiActivityNarration.ts` 다 — `narrateAiActivity({toolName, args, done, ok, summary, mapName})` 가 `{action, target, line}` 을 낸다(경과 시간은 이 모듈이 아니라 상태 배지가 소유한다 — 아래 aria-live 항목 참고)(실행 중/완료/실패 3형태, 대상은 맵 이름 + `(x,y) w×h`, 인자 모양 `{x,y,w,h}`·`{x,y,width,height}`·`{region:{…}}` 3종을 모두 읽는다). 읽기 전용 툴은 시공이 아니라 `살펴보는 중` 으로 말한다. **의존성이 0인 파일로 유지하라** — 채팅 패널(DOM)과 Phaser 렌더러가 둘 다 import 하므로 store/editorState/Phaser 를 끌어들이면 양쪽이 오염된다. `koreanToolLabel` 은 이제 이 모듈로 위임하는 껍데기다.
  채팅: `tool_started` 에서 `startLiveActivity` 가 `data-testid=ai-activity-live`(`role=status`, `aria-live=polite`, 스피너 + `.ai-activity-live-line`)를 로그에 붙이고, 기존 1000ms 진행 타이머(`refreshRunningStatus`)가 경과 초를 갱신한다 — 새 타이머를 만들지 마라. 같은 이름의 `tool_call` 이 오면 `completeLiveActivity` 가 **그 행 자체를** 완료형으로 바꾼다(`data-testid` 가 `ai-tool-entry` 로 바뀌고 실패는 기존 아코디언을 그 안에 넣는다). 중복 행을 만들지 않는 것이 계약이라 테스트가 요소 동일성(`toBe`)으로 고정한다. `tool_started` 없이 `tool_call` 만 오는 경로도 살아 있다(그때만 `bumpToolProgress`). `endTurnProgress` 가 고아 행을 제거한다. 상태 배지는 실행 중 도구가 있을 때만 `길을 그리는 중 · 2초 · 도구 1` 이 되고 없으면 기존 문구 그대로다(`formatAiRunningStatus` 의 마지막 인자 `activityLine` 은 선택).
  캔버스: 칩 좌표는 순수 함수 `src/editor/aiActivityChipPlacement.ts` 의 `placeAiActivityChip({region, camera, viewport, chip})` 이 정한다 — `above` 우선, 뷰포트 위로 넘치면 `below`, 그것도 넘치면 `inside`, 마지막에 양축 clamp(음수 좌표를 만들지 않는다), region 이 없으면 코너 폴백(`anchored:false`). `zoom` 이 0/비유한이면 1 로 취급해 초기화 중 NaN 을 막는다. 화면 변환은 기존 `screenRect` 규약과 같은 `(tile * TILE_SIZE - scroll) * zoom` 이다. CSS 는 `left/top` 을 더 이상 갖지 않는다(JS 소유) — 되돌리면 칩이 다시 코너에 박힌다. 렌더러는 `positionPhaseChip` 을 `refreshDomMarkers` 에서도 불러 카메라 팬/줌을 따라가고 `data-chip-mode` 에 모드를 남긴다. **칩은 현재 맵이 `runningToolMapId`와 같으면 셀 0개에서도 뜬다** — 소유 맵의 계획/조회 표시를 없애지 마라. `AgentGhostPreviewRenderer.currentState()`는 모든 실행 이름 판정(빈 프리뷰·로컬 diff 라벨·완료 스피너)에 맵 필터를 적용한다. A→B→A에서 B는 A의 칩을 보이지 않고 A로 돌아오면 유지 중인 활동을 다시 보인다. 이름이 같아도 소유 맵이 바뀌면 emit하며, 두 clear 경로는 이름과 소유자를 함께 비운다. 청사진의 retirement/no-revival(1dc6570d)과 재제출 상속(e103a8a8)은 변경하지 않는다. 회귀: `test/agentGhostRunningTool.test.ts`, `test/aiActivityCanvasChip.test.ts`, `test/aiTurnAppliedAccounting.test.ts`, `test/assistantSessionYield.test.ts`; 실제 브라우저: `scripts/qa/map-owned-overlays.mjs` (`BASE_URL`, `EVIDENCE_DIR`), blankProject + 쓰기 요청 차단.
  중복 제거: 실행 중 상태는 칩이 소유하고 영역 작업 배지는 `✓ 변경 확인 대기` 만 맡는다. 판정은 순수 함수 `regionTaskBadgeText(phase)`(`EditScene.ts`, running 이면 `null`) 한 곳에서만 한다 — 배지 문구를 인라인 삼항으로 되돌리면 칩과 배지가 같은 영역 위에 겹친다.
  원시 도구명 누출은 레지스트리에서 이름을 긁어오는 테스트가 막는다: `test/aiActivityNarration.test.ts` 가 `src/editor/tools/**` 를 fs 로 훑어 등록된 **224개** 도구 전부를 통과시키고 어느 하나라도 snake_case 토큰을 흘리면 실패한다. 새 도구를 추가하면 이 테스트가 먼저 깨지므로 문구를 함께 넣어라(하드코딩 목록으로 바꾸면 이 성질이 사라진다). Tests: `test/aiActivityNarration.test.ts`, `test/aiActivityChipPlacement.test.ts`, `test/aiActivityLiveRow.test.ts`, `test/aiActivityCanvasChip.test.ts`, `test/agentGhostPreviewRenderers.test.ts`.

- **라이밌 행은 잡지 않으면 한 프레임도 그려지지 않는다 — 무조건 400ms 머믄 (2026-08-29):** 위 항목을 처음 넣은 뒤 단위 테스트는 전부 초록이었는데 브라우쟀에서는 사용자가 여전히 아무것도 보지 못했다. 원인: `AssistantSession` 은 `tool_started`(`assistantSession.ts:2523`, 헬톨 emit 은 `:1618`) → **동기** `runTool`(`:2567`) → `tool_call`(`:2606`) 을 **한 동기 무더기로** 낸다. 그 사이에 `await` 나 스즜 경계가 없으므로 행이 열리기 직전에 닫힌다 — 검증 게이트 경로(`:1667-1669`)와 자동 `place_npc` 경로(`:2129-2130`)도 모양이 같고, 지역 작업은 별도 emitter 가 아니라 `runRegionTask.ts:731` 이 이벤트를 그대로 전달하므로 같은 순서를 복제한다. Chromium 에서 한 프레임마다 존재를 폴링한 실측값은 **0/17**(재실습 0/21)이었다. 그러므로 `completeLiveActivity` 는 `AI_ACTIVITY_MIN_DWELL_MS`(400ms) 만큼 전환을 **예약**한다. **경과 시간을 빼지 마라** — `now() - startedAt` 은 화면에 보인 시간이 아니다(동기 도구가 메인 스레드를 잡고 있어 그 사이 단 한 프레임도 그려지지 않는다). 600ms 를 부는 도구에서 `남은 = 400 - 600 = 0` 이 되어 **정작 오래 걸렸던 도구만 여전히 불모이는** 역전이 난다. 수정 후 생산 경로 실측 **3/42 프레임**. 지연은 표시만 밀고 도구 실행은 전혀 지연하지 않는다. 순서는 FIFO 대기열로 지키고, **다음 `tool_started` 가 이전 전환을 동기로 팔러시한다** — 이게 없으면 도구 12개 턴이 4.8초짜리 인운적 지연을 지므로, 동기 버스트는 사심상 즐시 통과하고 **마지막 행만** 머무는 것이 정상이다(동기 버스트 중에는 어차피 중간 상태를 그릴 수 없고, 기록은 전부 남는다). `endTurnProgress`·중단·오류·해제 네 경로 모두 대기를 팔러시한다 — 이미 끕난 턴에 스피너를 남기거나 기록을 유실하면 안 된다. 스즜러는 `AiChatPanelOptions.activityScheduler` 로 주입한다(기존 `clock` 과 같은 이유) — 테스트가 실시간을 기다리지 않게 하는 장치다.
  **교훈**: 단위 테스트는 두 동기 이벤트 **사이에서** DOM 을 보므로 이 결함을 원리적으로 잡지 못한다(토팔로지). 필수 계산은 한 프레임마다의 존재 폴링이며, `MutationObserver` 는 패널 서부트리가 통째 재부착되므로 거짓 음성(added: 0)을 낸다.

- **칩 좌표는 캔버스가 아니라 호스트 기준이다 — 순수 함수 테스트만으로는 잡을 수 없다 (2026-08-29):** `placeAiActivityChip` 은 캔버스 기준 좌표를 내지만 칩은 `canvas.parentElement`(호스트)에 붙는다. 그래서 `positionPhaseChip` 은 이문의 선례(`EditScene.ts:1647-1649` 지역 작업 배지)과 동일하게 `canvasRect.left - hostRect.left` / `canvasRect.top - hostRect.top` 를 더해야 한다. 이 항을 미하면 캔버스가 호스트 원점에 없는 레이아웃에서 칩이 정확하게 그 오펼셋만큼 밀린다. **`test/aiActivityChipPlacement.test.ts` 는 이걸 잡지 못한다** — 순수 함수는 정확했고 버그는 결과를 **적용하는 호줘**에 있었다. 그래서 호줘 단계 테스트를 `test/aiActivityCanvasChip.test.ts` 에 둔다. 일반화하면: 좌표계가 올바로 **적용**되었는지는 순수 함수 테스트로 증명할 수 없다.
  **카메라 변환은 `scrollX` 가 아니라 `worldView` 다 (2026-08-29, 리뷰에서 잡힘):** Phaser 3.60+ 에서 `scrollX` 는 `zoom !== 1` 일 때 뷰포트 좌상단의 월드 좌표가 **아니다** — `worldView.x = scrollX + width/2 - width/(2*zoom)`. 이문은 이걸 이미 아는 곳이 있었다: `EditScene.ts:1385-1389` 가 2026-08-27 실측 주석("배치가 호스트 코너로 밀렸다")과 함께 `camera.worldView.x` 를 쓰고, `__oprnEditWorldToClient`(`:325-333`)도 그렇다. 그런데 `tileRectToScreenRect`(`:130-131`)는 `scrollX` 를 쓰고 있었고, 새 칩도 그 관약을 복제해 마커·타일과 어긋나는 결함을 그대로 물려받았다. 실측: 2x 줌, 1133px 캔버스에서 `worldView.x - scrollX = 1133/2 - 1133/4 = 283.25` 월드 px = **566.5 스크린 px** 오차. 실제로 재던 마커-도로 차이는 `1247-682 = 565` 였다 — 같은 결함이다. **캔버스 오버레이를 화면 좌표로 바꿀 때는 반드시 `camera.worldView` 를 쓰라.** 이제 `tileRectToScreenRect` 가 `worldView` 를 받으며, 그 부수 효과로 **지역 작업 배지와 선택 상황 칩(selection action chips) 팝업도** `zoom !== 1` 에서 제자리를 잡았다(AI 기능과 무관한 선재 버그였다). 카메라를 목업하는 테스트는 `worldView` 필드를 넘겨야 한다(`agentGhostCumulativeReveal` 이 이걸로 한 번 넘어졌고, 목업을 고치는 것이 정답이었다).
  검증: 2x 줌 재촬에서 마커 `{682,465,288x32}` 와 실제 도로 `{682,465,288x32}` 가 **정확히 일치**하고 `overlap: YES` 다. `verify-shots/ai-activity-live/02-canvas-chip-anchored.png` 에 진단 상자로 박혀 있다.

  **여기서 얻은 교훈:** 순수 함수가 정확해도 **입력 관약**이 틀리면 전부 틀린다. `aiActivityChipPlacement` 테스트는 한동안 zoom 1.5/1.25 에서 **틀린 식을 고정**하고 있었고, 그래서 초록이었다. 좌표가 개입하는 변경은 단위 테스트만으로 마무리하지 말고 반드시 실제 화면에서 겹침을 실증하라.

  **해결됨 — 위 worldView 항목이 원인이었다 (2026-08-29):** 한동안 "고스트 마커 자신이 실제 타일 위에 없다"를 이 변경 밖의 선재 결함으로 적어 뒀었다. 기준 커밋(a7ffe6c6)에서도 `markerRect={left:1247,top:852,288×32}` vs 실제 도로 `roadRect={left:682,top:465,288×32}`, `overlaps=false` 로 동일하게 재현됐으니 선재인 것은 맞았다. **틀린 것은 범위 판단이었다** — 원인이 바로 위의 `scrollX` vs `worldView` 관약 오류였고, 2x 줌에서 예측한 566.5px 오차가 실측 565px 와 일치했다. `screenRect` 와 `tileRectToScreenRect` 를 `worldView` 로 바로잡자 마커가 도로와 **정확히 일치**했다(`{682,465,288×32}` 양쪽 동일, `overlap: YES`). 교훈: "선재 결함이니 범위 밖"이라고 접기 전에 원인을 먼저 규명하라 — 내가 새로 만든 코드가 같은 결함을 복제하고 있었고, 하마터면 지표를 잘못된 자리에 앵커한 채로 배포할 뻔했다. 증거: `verify-shots/ai-activity-live/02-canvas-chip-anchored.png`.

- **청사진은 세션 밑그림의 수명을 따른다 (2026-08-29):** `set_build_spec` 이 통과한 `BuildSpec` 은 채팅의 접힌 텍스트로만 남지 않고 맵 위에 계획 사각형으로 깔린다 — 순수 스토어 `src/editor/agentBlueprint.ts`(브라우저·Phaser·editorState 비의존) + 렌더러 `agentBlueprintRenderer.ts`(전용 컨테이너, depth **10.2** = 고스트 10.5 아래·타일 위). 칸의 순번은 `orderedAssets(spec)`(= 모델이 선언한 `buildOrder`)이고 라벨은 `blueprintKindLabel(kind)` 로 사람 말만 쓴다(도구명·내부 id 노출 금지). **수명은 고스트가 아니라 세션의 활성 스펙이다**: 고스트는 한 턴짜리지만 `BuildSpec` 은 턴 사이를 넘어가므로(`assistantSession.applyBuildSpec`), 청사진 정리를 `clearAgentGhostPreview()` 에 얹어 두면 `aiProposalCard.applyProposal` 이 **적용 직전에** 고스트를 지우는 바람에 처음 시공한 턴의 꼬리에서 계획이 사라지고 `set_build_spec` 은 다음 턴에 다시 오지 않아 영구히 빈 상태가 됐다(패널은 "밑그림 확정 — 에셋 N개" 를 계속 출력했다). 그래서 턴 시작마다 `syncAgentBlueprintWithSpec(session.getActiveSpec())` 로 다시 맞추고(같은 맵·같은 사각형이면 building/done 을 물려받고 바뀐 게 없으면 emit 하지 않는다 — 스펙 자동 확장 `expandSpecWithRegions` 가 진행을 날리지 않게), 누수는 `dropSession`(새 대화·대화 복원·프로젝트 전환)과 패널 dispose 에서 `clearAgentBlueprint()` 로 막는다. 진행 판정은 누적 퍼센트가 아니라 **인과 순서**다(한 에셋이 여러 툴콜로 쪼개지므로 비율은 거짓말을 한다): 이번 툴콜이 **자기 칸을 얼마나 덮었는지**(`겹침 / 칸 면적`, 1.0 상한)로 승자를 고르고 그 칸이 `building` 이 되며 앞서 building 이던 칸이 `done` 으로 내려간다. 절대 겹침 면적으로 고르면 맵 전체를 덮는 `clear` 칸이 늘 이긴다(길 60칸 = 길과도 60, clear 와도 60). **IoU(겹침/합집합)도 못 쓴다** — 영역 여러 장이 오는 순간 분모의 영역 면적 합이 커져서 맵 전체 `clear` 칸이 집 칸을 이긴다. 30×20 맵 `author_house kind=lots` 실측: 집 2·3채는 전 채가 올라가는데 **4채부터 0채**가 되고(교차점 N≈3.65), 40×30 은 6채, 100×100 은 20채에서 같은 일이 난다. 덮인 비율은 그 규모 의존이 없다 — 집 칸은 자기 사각형이 100% 덮이므로 1.0 이고, `clear` 칸은 집들 면적 합 / 맵 면적이라 에셋 면적 합이 맵 면적을 넘지 않는 한 이길 수 없다(같은 점수면 겹침이 큰 칸이 이기고 그마저 같으면 순번이 앞선 칸). 진행 영역은 스펙 게이트의 `affectedRegions` 가 아니라 **청사진 전용 추출**(`src/editor/agentBlueprintRegions.ts` 의 `blueprintRegionsForToolCall`, 순수)이 뽑는다: 게이트 함수는 fail-closed 계약이라 사각형을 못 뽑으면 `{0,0,0,0}` 을 내고 게이트는 면적 0 을 건너뛰는데, 좌표를 wrapper 키에 담는 쓰기 툴이 전부 거기로 떨어졌다 — `place_props`(`area`) · `place_door`/`place_window`(`at`) · `build_roof`(`wallRect`) · `build_castle`(`bounds`) · `stamp_structure_kit`(`origin`) · **`bounds` 없는 `author_village`**. 마지막 것이 가장 아프다: `contextBuilder` 가 마을에 쓰라고 글자 그대로 지시하는 경로(`마을=author_village(target:{kind:"existing",mapId} …)`)인데 `bounds` 는 스키마·파서·`invalidArgsExample` 모두에서 선택이라 인자에 좌표가 없고, 마을이 다 지어져도 청사진이 100% planned(파랑)로 남았다. 그래서 추출만 분리했다 — `affectedRegions` 는 **한 글자도 바꾸지 않고**(게이트 판정 불변) 그 결과를 먼저 쓰고, 면적 0 으로 떨어진 경우에만 wrapper 키(`rect`·`wallRect`·`area`·`region`·`bounds`·`at`·`pos`·`point`·`position`·`cell`, `origin`(+최상위 `width`/`height` — 단 `create_map`·`resize_map`·`generate_map`·`build_castle`·던전/실내 세션 4종처럼 그 값이 **새 맵 크기**인 8종은 읽지 않는다. 발자국으로 읽으면 origin 을 좌상단으로 하는 맵 크기짜리 영역이 나와 맵 전체를 덮는 `clear` 칸이 이긴다. 오늘 이 짝을 보내는 툴은 없다 — 생기는 순간 조용히 터질 자리라서 막아 둔다), 그리고 좌표 배열 `hotspots`·`wings`)를 청사진 규약으로 다시 읽는다. 배열 항목은 좌표 wrapper 를 한 겹 벗긴다 — `place_examine_hotspots` 의 스키마는 항목마다 `required:["at"]` 이라 좌표가 `at` 안에 있고, 벗기지 않던 시절에는 스키마대로 온 인자가 전량 포기 규칙에 걸려 `regions: []` 로 조용히 사라졌다(살아 있는 쓰기 툴 하나가 청사진에서 빠졌다). `spots`(`configure_fishing`)·`areas`(`configure_seasonal_forage`) 는 목록에서 **뺐다**: 최상위 `mapId` 가 없고(스키마 `additionalProperties:false`) 맵 id 를 항목마다 들고 있어 `callMapId` 가 null 을 내며 이 모듈이 먼저 빠져나가고, 둘 다 타일을 칠하지 않는 system 설정 툴이다. `regions`/`rects` 는 그 이름으로 인자를 받는 등록된 쓰기 툴이 없었다. `stamp_structure_kit` 은 `origin`+`repeat` 만 보내므로 발자국이 **1×1 점**으로 잡힌다(`repeat` 는 읽지 않는다) — 점이 겹치는 두 칸에 들어가면 덮인 비율이 큰 쪽 = 작은 칸을 고르므로 안전하다. 영역이 여러 개인 호출은 **한 칸으로 접지 않는다**: 시스템 프롬프트가 집 2채 이상을 `author_house kind=lots + houses[]` 한 호출로 짓게 지시하는데("개별 single 반복 금지"), 게이트는 그 호출에서 집마다 몸통+마당 2장씩 정확히 내는데도 합산 승자 하나만 고르면 집 3채 중 1채만 building 이 되고 나머지 2채는 뒤에 오는 호출이 없어 영원히 파랑으로 남았다(실측). 그렇다고 영역마다 독립으로 고르면 1차 결함이 다른 얼굴로 돌아온다 — 1×1 점은 "그 점을 담은 가장 작은 칸"을 뽑으므로 집 사각형을 지나는 길 60칸 중 12칸이 길 대신 집을 뽑는다. 그래서 **덮은 만큼 벗겨내는 탐욕법**을 쓴다(`bestOverlapIndices`): 남은 영역 전체로 덮인 비율 승자를 뽑고 그 칸이 덮는 영역을 빼고 남으면 다시 뽑는다 — 길은 한 칸(60/60 = 1.0 이 집의 12/30 = 0.4 를 이긴다), 서로 안 겹치는 집은 N 채 그대로 N 칸이 나온다(집 20채·맵 100×100 까지 실측). 영역끼리 겹쳐 같은 칸을 두 번 세는 경우가 있으므로 비율은 1.0 에서 자른다 — 자르지 않으면 두 번 칠한 칸이 정확히 일치하는 칸을 이긴다. **대상 전체를 짓는 파사드(`author_village`)는 한 칸으로 귀속하지 않는다**: 후보 사각형 하나를 만들어 승자를 고르면(맵 사각형이든 `target.bounds` 든) 맵 전체를 덮는 `clear` 칸이 이기고 나머지는 계획 상태로 남는다 — "큰 칸이 항상 이긴다" 결함의 재발이다. 걸리는 planned 칸을 **전부** building 으로 올리고(`bounds` 가 있으면 그 영역에 걸리는 칸만) 확정은 턴 끝에 한다 — 그 한 호출이 실제로 한 일과 같다. 침묵하는 경우는 둘이다: `mode !== "write"` 인 툴콜(`show_map_region` 은 "깐 뒤 눈으로 확인하라" 가 정상 경로인데 사각형이 진짜라 승자를 바꿨다), 그리고 인자에 위치가 아예 없는 쓰기 툴콜(`wallRect` 없는 `build_roof` 는 맵의 벽 어휘 셀을 스캔해 자리를 스스로 찾는다 — 폴백 (0,0) 은 시공 위치가 아니라 상수라서 점으로 귀속하면 맵 전체를 덮는 1번 칸이 늘 이긴다). `done → building` 역주행도 막는다. 턴 끝 정산은 `settleAgentBlueprintTurn(applied)` 이고 **종료 분기가 아니라 적용 결과로 판정한다**(패널의 `settleBlueprintForTurnEnd`, 모든 종료 경로에서 부른다). 정상 분기에만 정산이 있던 시절에는 시공 중 중단이 칸 하나를 노란 2px 로 남기고 다음 턴의 `syncAgentBlueprintWithSpec` 이 그 상태를 물려받아 세션을 버릴 때까지 풀리지 않았다(영구 "짓는 중"). 그렇다고 모든 종료 경로에서 building 을 done 으로 올리는 것은 **더 나쁘다**: 다섯 종료 경로 중 셋 — 중단 return, catch 두 개 — 은 `applyProposal` **앞에서** 끝나 초안을 그대로 버리므로 저장소는 한 칸도 바뀌지 않는다. 실측(같은 툴콜을 정상 종료/중단으로 각각 실행): store 변경은 true/false 로 갈리는데 청사진은 양쪽 다 done 이었고, `markAgentBlueprintProgress` 는 planned 가 아닌 칸을 다시 올리지 않으므로 손도 안 댄 타일 위의 회색 ✓ "완료" 가 세션이 죽을 때까지 남았다 — 이 기능이 없애려던 거짓 그 자체다. 그래서 정산은 **이번 턴에 planned 밖으로 올린 칸 전량**(`turnAdvanced`, 인과 순서 판정이 턴 도중에 done 으로 내린 앞 칸까지 포함한다)을 저장소에 들어간 영역과 대조해 걸리면 done, 아니면 planned 로 되돌린다. 그 기록은 턴 시작에서 `beginAgentBlueprintTurn()` 으로 끊는다 — 패널에는 정산도 마일스톤 확정도 지나지 않는 종료가 있다(`!ownsTurn(true)` 반환 = 프로젝트 전환·패널 폐기로 소유권을 잃은 턴). 그 기록이 살아남으면 다음 턴 정산이 이번 턴과 무관한 칸을 planned 로 되돌린다. 오늘 그 일이 안 나는 이유는 `dropSession`/dispose 가 `clearAgentBlueprint()` 를 같이 부르기 때문인데 그건 결합에 의한 안전이라 호출 하나가 빠지는 순간 조용히 깨진다. 들어간 영역은 완성도 린트(⚠ 미이행)가 쓰는 함수를 먼저 쓴다(`proposalChangedRegions` → `appliedBlueprintRegions`) — 채팅이 "미이행"이라 말하는 에셋에 맵이 "완료 ✓"를 그리면 사용자는 어느 쪽도 믿을 수 없다. **다만 그 함수만 쓰면 위의 청사진 전용 추출이 통째로 무효가 된다**: 린트는 `affectedRegions` 로 떨어지므로 좌표를 wrapper 키에 담는 쓰기 툴은 정산에서 "아무것도 안 들어갔다" 가 되어 방금 올린 칸이 planned 로 되감겼다(실측: `place_examine_hotspots` 진행영역 2·정산영역 0, `stamp_structure_kit` 1·0, `build_castle` 1·0 → 전부 building → **planned**. 레지스트리 훑기로 같은 함정의 쓰기 툴이 11종 — 위 셋 + `plant_tree_clusters`·`create_farm_plot`·`make_hunting_ground`·`make_gallery_room`·`make_horror_loop`·`set_lighting_volume`·`author_story_arc`·`compile_puzzle`). 사용자가 보는 것: 숲을 심고 타일이 **실제로** 바뀌는데 맵이 파랑 계획으로 되감긴다. 그래서 `author_village` 에만 있던 예외를 규칙으로 올렸다 — 호출이 **실제로 무언가를 바꿨는데**(`proposalCallChangedSomething` = 성공 + 의미 있는 diff) 린트가 영역을 한 장도 못 뽑으면 그 호출만 청사진 추출로 되읽는다. 무변경을 done 으로 만들 수 없는 이유가 그 게이트다(diff 가 비면 폴백에 닿지 않아 영역이 없고, 정산은 그 칸을 planned 로 되돌린다). 남은 비대칭 하나는 알고 남긴다: 채팅의 "⚠ 미이행" 은 여전히 린트 추출만 보므로 위 11종에 대해 경고를 낼 수 있고, 그 경우 **맵이 맞고 채팅이 틀렸다** — 린트를 같이 고치려면 `ai/proposalCompleteness` 가 `editor/agentBlueprintRegions` 를 import 해야 하는데 반대 방향 import 가 이미 있어 순환이 된다(층을 뒤집는 별도 변경). 두 가지 예외를 명시한다: (1) `bounds` 없는 `author_village` 는 대상 맵 전체를 지었는데 인자에 사각형이 없어 린트도 영역을 못 뽑는다 — 실제 변경을 냈으면 대상 맵 id 를 `wholeTargetMapIds` 로 넘겨 진행분을 인정한다(아니면 마을을 다 짓고도 전부 파랑으로 되감긴다). (2) 자율 런의 마일스톤은 **턴 도중에** 커밋되고 `maybeAutoApplyMilestone` 이 `turnProposals` 를 비우므로 턴 끝 정산은 그 호출들을 볼 수 없다 — `milestone_applied` 이벤트에서 `commitAgentBlueprintProgress()` 로 그 몫을 그 자리에서 확정한다. 그러지 않으면 뒤이은 중단이 이미 들어간 시공까지 planned 로 되돌린다. 렌더러는 고스트의 **원본 보기(꾹 누름)** 토글 `isAgentGhostPreviewHidden()` 도 함께 본다 — 고스트는 스프라이트·애니메이션·DOM 마커 모두 이 값을 보는데 청사진만 보지 않아 꾹 눌러도 사각형·라벨이 위에 남았고, 이 토글이 대화를 버리지 않고 청사진을 걷는 유일한 수단이다(EditScene 은 토글 값이 **바뀐 순간에만** 청사진을 다시 그린다 — 프리뷰 갱신 150ms 마다 라벨 40장을 새로 만들지 않기 위해). 라벨은 스펙 자동 확장(`assistantSession.autoExpandedAssetKind`)의 기본 kind `structure` 까지 사람 말(구조물)을 갖는다 — 코드가 정하는 7종(clear·road·terrain·npc·prop·house·structure)에 번역이 빠지면 맵에 `3/9 structure` 라는 영어가 찍힌다. `redraw()` 는 고스트와 청사진을 **함께** 다시 그린다 — 청사진 레이어는 맵을 따라 비워지지 않으므로 빼먹으면 A 맵의 계획 사각형이 B 맵 같은 좌표에 남는다. Tests: `test/agentBlueprint.test.ts`, `test/agentBlueprintRenderer.test.ts`, `test/agentBlueprintTurnEnd.test.ts`, `test/editSceneCameraFocus.test.ts`, `test/aiChatSessionScope.test.ts`.
- **조수 적용 뒤에 남는 클릭 배지·질문용 선택은 걷는다 (2026-08-31):** 사용자 보고 — 조수가 고친 뒤에도 맵 위에 `편집 위치 11,8` 이 계속 남아 있다. 그 문자열은 청사진 라벨이 아니라 이벤트 레이어 **마지막 클릭** 피드백이다(`renderEventLayerClickFeedback` → `편집 위치 ${x},${y}` / `새 이벤트 위치 ${x},${y}`). 상태는 `EditScene.eventLayerClickFeedback` 에 있고 전용 레이어 `eventClickFeedbackLayer`(depth 12)에 그리는데, **비우는 경로가 없었다** — 레이어를 떠나면 숨길 뿐이고, 조수 적용의 `store.replace`(`origin: "ai"`)는 전체 재렌더를 타서 같은 칸에 다시 찍었다. 판정은 순수 함수 `retainEventLayerClickFeedback`(`src/editor/transientEditorChrome.ts`): 사람 편집은 유지, `origin === "ai"` · 맵 전환 · 다른 맵 배지는 버린다. `EditScene.redrawForStoreChange` 와 맵 전환 `redraw()` 가 그 결과를 반영한다. 같은 모듈이 `highlight_map_region` 이 세운 `editorState.selection` 도 턴 끝(`aiTurnRunner` finally, 소유권이 있는 턴만)에서 걷는다 — 그건 사용자 선택이 아니라 질문용 강조다. 청사진 수명(세션 스펙, 다 지으면 숨김)과 고스트(적용 시 `clearAgentGhostPreview`)는 건드리지 않는다. Tests: `test/transientEditorChrome.test.ts`.
- **다 지은 계획은 캔버스에서 스스로 물러난다 (2026-08-30):** 사용자 실제 보고 — "에디터 안의 AI 로 명령을 내렸는데, 결과가 나왔음에도 불구하고 `1/2 지형 ✓` 이런 UI 들이 여전히 남아있는 게 문제". 그 문자열은 `blueprintEntryCaption` 이다(`${order}/${total} ${label}` + done 이면 ` ✓`). 원인은 수명이 아니라 **표시의 수명을 스펙에 그대로 매달아 둔 것**이다: `BuildSpec` 은 턴 사이를 넘어가고 `clearAgentBlueprint()` 는 `dropSession`(새 대화·대화 복원·프로젝트 전환)·패널 dispose 에서만 불리므로, 시공이 다 끝난 맵 위에 회색 ✓ 라벨이 최대 40장 영구히 덮여 있었다. 대화를 버리지 않고 걷는 수단은 위 항목이 적어 둔 대로 **원본 보기(꾹 누름)** 하나뿐이었고 그것은 순간 토글이다. 사용자가 보고 싶은 것은 자기 결과물이지 다 끝난 진행 표시가 아니다. **상태를 지우는 수정은 틀렸다** — `setAgentBlueprintFromSpec` 은 `done` 을 사각형 기준으로 물려받으므로(스펙 자동 확장이 진행을 날리지 않게 하는 장치) 완료 시점에 `clearAgentBlueprint()` 를 부르면 물려받을 상태가 없어지고 다음 턴의 `syncAgentBlueprintWithSpec(activeSpec)` 가 **다 지어진 맵 위에 전량 planned 파랑 계획을 되살린다**(2026-08-29 항목의 "적용 지전에 고스트를 지워 영구히 번 상태" 결함의 거울상). 그래서 사이이상은 렌더러가 보는 **유일한 읽기 경로** `agentBlueprintForMap` 이다: `isAgentBlueprintComplete(entries)`(번 목록이 아니고 전 칸이 `done`)이면 벽 목록을 내고, `EditScene` 의 구독이 그 자리에서 `render()` 를 다시 부러 `layer.removeAll(true)` 로 장버지를 파괴해 걷는다(숨기기가 아니다 — 텍스처 남지 않는다). 상태는 진실을 그대로 들고 있으므로(`turnAdvanced`·정산·물려받기 한 줄도 안 바늄) 재부활이 구조적으로 불가능하다 — 다음 턴이 재동기화해도 전량 done 이라 그대로 감춰진다. 타이머도 얰출도 쓰지 않는다(상태 전이 하나에 매여 있어 테스트가 시간 운에 기대지 않는다). 되감긴 계획은 그대로 남는다: 턴 끝 정산이 적용되지 않은 칸을 `planned` 로 되돌리면 완료가 아니므로 계획이 보이고("이건 안 들어갔다" 는 참인 정보다), 스펙 자동 확장이 `planned` 에셋을 덧붙이면 다시 그려진다. 주의: 맵 전제를 덮는 `clear` 칸은 어떤 사각형이 들어와도 거치므로 정산에서 거의 항상 `done` 이 된다 — 부분 완성 테스트를 쓸 때 그 칸이 planned 로 남을 것이라 기대하면 틀린다(이 수정의 첫 테스트가 그렇게 틀렸다). Tests: `test/agentBlueprint.test.ts`(`agentBlueprintForMap — 다 지은 계획은 캔버스에서 물러난다` 4개: 전량 done 숨김·부분 수행 유지·재동기화 부활 금지·자동 확장 복귀), `test/agentBlueprintRenderer.test.ts`(사각형·라벨 0장 + `removeAll(true)`).
- **시공이 적용된 턴이 끝나면 밑그림은 물러나고, 다음 턴이 되살리지 않는다 (2026-09-03):** 사용자 보고 — "조수와의 채팅이 끝나도 밑그림이 사라지지 않는다". 위 2026-08-30 수정은 **전 칸 done** 일 때만 감췄는데, 실제 런에서는 모델이 에셋 하나를 건너뛰거나 스펙 자동 확장(`expandSpecWithRegions`)이 planned 칸을 덧붙여 전량 done 이 거의 성립하지 않았다. 게다가 스펙은 세션이 살아 있는 동안 유지되므로 다음 질문·조회 턴의 `syncAgentBlueprintWithSpec` 이 그 계획을 다시 깔았다. 고침: `aiTurnRunner` 의 apply-now 분기에서 `applied === true` 면 정산 직후 `retireAgentBlueprint()` 를 부른다 — 현재 칸의 shape-key 를 `retiredKeys`(맵별)로 기록하고 칸을 비운다. `syncAgentBlueprintWithSpec` → `applySpec` 은 물러난 키를 건너뛰므로 같은 스펙이 다시 와도 그 칸은 그려지지 않고, 그 뒤 자동 확장으로 **새로** 덧붙은 칸만 계획으로 나온다. `setAgentBlueprintFromSpec`(= 새 `set_build_spec`)과 `clearAgentBlueprint` 는 기록을 비운다(새 계획은 새 계획이다). 적용되지 않은 턴(중단·오류·게이트 거부·쓰기 0건)은 물러나지 않는다 — 계획은 아직 유효하고 정산이 planned 로 되돌려 둔다. 상태줄의 「밑그림 확정 — 에셋 N개」도 `isAgentBlueprintComplete` 대신 `agentBlueprintForMap(...).length > 0`(실제로 보이는 칸이 있는가)로 판정한다. 회귀 테스트 `test/agentBlueprintTurnEnd.test.ts` 「일부만 지은 계획도 적용된 턴이 끝나면 물러나고, 다음 턴이 되살리지 않는다」. 같은 파일의 fetch 대본은 이제 **`tools` 가 실린 요청만** LLM 라운드로 센다 — 패널이 턴 앞에 붙이는 의도 선언 호출(`createLlmIntentDeclarer`, json 응답·툴 없음)이 1라운드 툴콜 대본을 가져가 6케이스가 전부 빨간 기준선이었다.
- **조수 카메라는 사용자 제스처 중에 끼어들지 않는다 (2026-08-29):** `editorCameraFocus.ts` 는 목표 계산(`planCameraFocus`, `onlyIfOffscreen` 이면 화면 밖일 때만 움직인다)과 **양보 판정**(`shouldDeferCameraFocus(PointerGestureState)`)을 순수 함수로 들고 있고, `EditScene.panCameraToTile` 은 `pointerGestureState()` 로 다섯 가지를 먹인다: 페인트 스트로크(`isPainting`), 손 팬(`cameraPanController.active()`), 도형·선택·이벤트 드래그(`dragOperationHandler.busy()`), 우클릭 영역 제스처(`rightRegionGesture`), 붙여넣기 미리보기(`editorState.pastePreview`). `isPainting` + 팬만 보던 이전 판정은 **모든 드래그를 놓쳤다** — `pointerdown` 은 `beginDragOperation` 이 true 를 주면 `isPainting` 을 세우기 전에 반환하고 `beginRightRegionGesture` 는 오히려 false 로 내리므로, 드래그 중에 조수 팬이 끼어들면 `commitShapeDrag`/`commitEventMoveDrag` 가 팬 거리만큼 밀린 타일을 커밋한다(조용한 저작 데이터 손상). `DragOperationHandler.busy()` 는 `active()` 와 달리 아직 문턱을 못 넘은 `eventDragCandidate` 까지 센다. 프로그램 팬의 뒷정리는 마지막 프레임에만 한다 — `camera.pan(x,y,duration,ease,force,cb)` 의 6번째 인자는 onComplete 가 아니라 **onUpdate** 라서 `progress === 1` 로 걸러야 300ms 동안 매 프레임 DOM 마커를 지웠다 다시 만들지 않는다. Tests: `test/editSceneCameraFocus.test.ts`, `test/agentFocus.test.ts`, `test/eventListCameraFocus.test.ts`.
- **제공자는 둘뿐이다 (자체 OAuth, 2026-08-27):** `src/ai/ohMyPiProviders.ts` 에는 `google-antigravity`(Gemini/agy, 기본) 와 `openai-codex` **두 행만** 있다 — 예전에는 omp 카탈로그의 69종을 베껴 뒀지만 로그인 경로가 붙은 것은 이 둘뿐이라 나머지는 고를 수 없는 죽은 UI 였다. id 문자열은 `src/ai/oauth/credentials.ts` 에서 가져오므로 전송과 UI 가 같은 상수를 본다. 설정은 `AiConfig.providerId` 로 저장되고 두 제공자 사이를 실제로 오갈 수 있다(`editorHasProviderChoice()` = true).
- **인증은 Node, 완성만 Bun (2026-08-27):** 동반 서비스(`vite.config.ts` 플러그인 + `scripts/chatgpt-oauth-companion.mjs`)가 `/auth/providers`, `/auth/status?provider=`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/v1/chat/completions`(헤더 `X-Oprn-Provider`) 를 노출한다. **로그인·갱신·상태·요청 자격은 `scripts/lib/aiAuthRuntime.ts` 가 순수 Node 에서 처리한다** — pi-ai 의 `getOAuthApiKey`/`getProviderDefinition`/`refreshOAuthToken` 의존은 없다. Bun 워커(`scripts/oh-my-pi-worker.ts`)는 `/complete` **하나만** 남았고 이미 해결된 `apiKey` 를 본문으로 받는다(자격을 들지 않는다). 실측: bun 이 PATH 에 없을 때 `/auth/providers` 와 `/auth/status` 가 **HTTP 200** 이다 — 예전에는 둘 다 HTTP 500 `bun 이 필요합니다` 였다. 모델 호출(completion)은 pi-ai 가 bun:sqlite 를 싣기 때문에 여전히 Bun 이 필요하다. 모르는 제공자 id 는 400 으로 닫는다. 비밀은 `~/.oprn/oh-my-pi-auth.json`(`OPRN_OH_MY_PI_AUTH_PATH`; 2026-09 개명 전 `~/.rpg-zzu` 파일은 첫 읽기에 한 번 복사되고 옛 파일은 남는다)에만 남고 브라우저로 가지 않는다. `/auth/key` 는 두 제공자가 모두 구독 로그인이라 400 으로 거절한다.
- **Codex 로그인은 브라우저 우선, device 는 대체 (2026-08-27):** `src/ai/oauth/codexBrowserOAuth.ts` 의 `beginCodexLogin` 이 경로를 고른다. **1455 를 잡으면** 루프백 PKCE 원클릭(`auth.openai.com/oauth/authorize`, `code_challenge_method=S256`, `id_token_add_organizations=true`, `codex_cli_simplified_flow=true`, `originator=codex_cli_rs`)으로 가고, **EADDRINUSE 면** device 코드 흐름으로 내려가며 그 이유를 `instructions` 로 사용자에게 말한다. 포트 점유가 아닌 실패(EACCES 등)는 device 로 숨기지 않고 그대로 올린다. `CODEX_BROWSER_REDIRECT_URI` = `http://localhost:1455/auth/callback` 은 **상수여야 한다** — OpenAI 허용목록에 이 값만 있어 임의 포트로 옮기면 인가는 통과하고 토큰 교환이 403 이 된다(omp 의 `loginOpenAICodex` 주석과 동일한 근거). 실측: 이 개발 머신은 1455 도 docker-proxy 가 잡고 있어 device 경로로 내려간다. 회귀 테스트 `test/codexBrowserOAuthFlow.test.ts`(9케이스: 인가 파라미터 전량, PKCE SHA-256/base64url, 경로 선택 3분기).
- **OAuth 와이어는 우리 코드다 (2026-08-27):** `src/ai/oauth/codexDeviceOAuth.ts` = ChatGPT device 흐름(`.../deviceauth/usercode` → 403/404 는 승인 대기 → `.../deviceauth/token` → `oauth/token`, 폴링 상한 120). `src/ai/oauth/antigravityOAuth.ts` = Google 인가 코드 흐름 + cloudcode-pa `v1internal:loadCodeAssist` 프로젝트 발견(daily → production 폴백) + `v1internal:onboardUser` 프로비저닝(최대 5회). `src/ai/oauth/credentials.ts` 의 `packRequestApiKey` 가 요청 시점 자격을 만든다: Antigravity 는 `token`+`projectId`+`refreshToken`+`expiresAt` JSON, Codex 는 access 토큰 문자열. **만료 자격과 projectId 없는 Antigravity 자격은 던진다** — 갱신 책임을 호출부로 되돌리는 안전핀이다. 라이브 확인: `npx vite-node --script scripts/verify-ported-oauth-live.mts`(기본은 부작용 없음, `--login`/`--refresh` 선택).
- **콜백 포트 정책은 제공자마다 다르다 (2026-08-27):** `scripts/lib/oauth/loopbackCallbackServer.mjs` 가 `node:http` 를 import 하는 유일한 파일이다. `startOAuthCallbackServer` 는 **먼저 바인드하고** 그 포트로 `redirectUri` 를 만든다. **Antigravity(Google)** 는 51121 을 선호하되 점유되면 임의 포트로 붙는다 — Google 은 루프백 포트를 고정하지 않는다(RFC 8252 §7.3). 실측: 이 개발 머신은 51121 을 docker-proxy 가 잡고 있어서, 포트를 고정하면 로그인이 백그라운드에서 EADDRINUSE 로 죽는데 화면에는 계속 "브라우저에서 로그인하세요"만 떠 있었다. **Codex** 는 반대로 `allowPortFallback:false` 로 열어 EADDRINUSE 를 그대로 올린다(허용목록 고정 포트라 대체 포트는 곧 403). 붙여넣기 경로(`/auth/oauth-paste`)는 두 콜백 경로 `/oauth-callback`(Antigravity)·`/auth/callback`(Codex)을 모두 받는다 — 하나만 받으면 원격 preview 에서 Codex 브라우저 로그인을 끝낼 수 없다. **루프백은 두 주소를 함께 듣는다**: `redirect_uri` 의 호스트명은 `localhost` 인데 실측 이 머신의 `getent hosts localhost` 는 `::1` 을 먼저 준다 — IPv4 만 듣고 있으면 브라우저가 `[::1]:PORT` 로 붙어 콜백이 영원히 도착하지 않는다. 그래서 127.0.0.1 과 ::1 을 같은 포트로 함께 바인드한다(`handle.hosts` 로 확인 가능). `0.0.0.0`/`::` 로 넓히지는 않는다 — LAN 의 아무나 인가 코드를 밀어넣을 수 있다. 회귀 테스트 `test/oauthLoopbackCallback.node.test.mjs`(11케이스: 폴백·폴백금지·IPv6 실연결·redirectUri 이름 연결) + `test/ohMyPiHttp.node.test.mjs`(붙여넣기 두 경로).
- **추천 칩은 mousedown 에서 입력을 채운다 (2026-09-02):** `등장인물 만들기` 같은 감독 칩과 `길`/`NPC` 예제 칩은 보이는데 클릭이 안 먹었다. 입력 blur 가 160ms 뒤 `ai-suggest-popover` 를 `display:none` 으로 접어, 실제 마우스의 click(mouseup 필요)이 유실됐다. 칩은 `mousedown` 에서 `preventDefault` 로 입력 포커스를 지키고 문장을 채운다. blur 핸들러도 `.ai-command-bar` 안으로 옮긴 포커스는 접지 않는다. Tests: `test/aiPanelChrome.test.ts`, `test/aiStartScreenCards.test.ts`.
- 조수가 붙는 곳은 하나다 (2026-08-31). 구 `ChatDock = "float" | "side" | "glass"` 와 그 모듈 `src/editor/chatDock.ts`, 레이아웃 저장의 도크 필드, `glass → side → float` 순환 토글은 모두 삭제됐다. 읽는 창구는 `panel.dataset.chatDock`(항상 `"float"`) 하나다. 캡슐은 `chat-float-host` 아래 반투명 입력줄로 뜨고, 빈 화면 추천은 컴포저 추천 팝오버(`ai-suggest-popover`)가 낸다 — 안내 한 줄(`directorStartPrompts` 기반) + 감독 칩 3개 + 저작 예제 6개. 전폭 상승 오버레이와 side 전용 휘발 존은 side 와 함께 사라졌다. **로그 배치의 정본은 여전히 하나다:** `mountLog()`(`aiChatPanel.ts`)가 슬롯을 정하고 `panel.dataset.logSlot` 으로 노출하는데, 이제 값은 둘뿐이다 — `history`(`ai-history-log-mount`, 기록/스튜디오가 열렸을 때) 와 `glass`(`ai-glass-log`, 그 외). 구 `volatile`·`none` 슬롯은 없다. `applyHistoryOpen`/`applyStudio` 는 여전히 로그를 직접 재부모화하지 않고 상태만 뒤집는다. Spec: `docs/superpowers/specs/2026-08-20-ai-glass-dock-design.md`(도크 축 시절 기록). Tests: `test/aiLogSlot.test.ts`, `test/e2e/assistant-single-dock.spec.ts`.
- **Sticky completion/notice band (2026-08-28):** `stickyProposalZone` (`ai-rising-sticky-zone`) is a direct panel child in every dock and now contains only `ai-completion-host` + `ai-proposal-notice-host`. Proposal pill/reopen/pin DOM was removed with the approval flow. Glass and side keep the band in flow; float alone fixes it above the absolute composer with a `pointer-events:none` container and interactive children restored. Do not make the band fixed in glass: the card's `backdrop-filter` creates a containing block and `overflow:hidden` clips it. Test: `test/aiLogSlot.test.ts`.
- **The volatile-zone idle fade is gone (2026-08-23).** `is-faded` (`opacity .42`), `VOLATILE_OVERLAY_IDLE_MS`, `aiVolatileController.ts`, the local `volatileFadeTimer`, `scheduleVolatileFade`, and `lastTurnFailed` were all removed. The fade was dead three times over: gated on `dock === "float"`, float mounts no volatile zone at all, and the side CSS forced `opacity: 1` back. Two timers (controller + panel-local) also raced for the same class. Volatile-zone visibility now has one owner: `hidden = true` at construction, unhidden by `applyComposerViewPolicy` when `panel.dataset.logSlot === "volatile"`, plus `revealVolatileZone`/`hideVolatileIfIdle` for input focus/blur. Do not reintroduce an opacity fade over the log — a faded error card is unreadable (the reason `lastTurnFailed` existed).
- **`is-prior-turn` has one policy (2026-08-23): prior turns are always visible.** The "mini-stream shows the current turn only" rule was duplicated in `assistant-rising-overlay.css` and `09-ux-polish-density.css`, and in both files the following side-dock rule re-showed them — since the overlay became side-only, the hide never applied. Both files now carry a single `.ai-chat-log > .is-prior-turn { display: block }` / `.ai-chat-log > .ai-turn-group.is-prior-turn { display: flex }`. Turn shortening is `.ai-turn-group.is-collapsed > .ai-turn-group-body`, the only collapse path actually in use.
- **The volatile-zone idle fade is gone (2026-08-23):** the `is-faded` (`opacity .42`) state, `aiVolatileController.ts`, the duplicate local fade timer, `VOLATILE_OVERLAY_IDLE_MS`, `scheduleVolatileFade`, and `lastTurnFailed` were deleted. The fade was doubly dead — every entry point gated on `dock === "float"`, yet float does not mount the volatile zone at all, and the side stylesheet forced `opacity: 1` over `.is-faded`. Zone visibility now has one owner: `hidden` starts true and `applyComposerViewPolicy` unhides it when `panel.dataset.logSlot === "volatile"`; `revealVolatileZone` / `hideVolatileIfIdle` only flip `hidden`. Prior-turn visibility was also single-sourced: the `.ai-rising-overlay ... .is-prior-turn { display: none }` rules in `assistant-rising-overlay.css` and `09-ux-polish-density.css` were unreachable (the overlay is side-only and the side rule always won), so prior turns are simply visible and `.ai-turn-group.is-collapsed` remains the only collapse path.
- **Composer (2026-08-21 rebuild, `src/editor/panels/aiComposer.ts` + `src/styles/database/assistant-composer.css`):** the bottom bar is a textarea with **one fixed single-line action row** under it — there is no vertical button rail. The action row holds, left to right: `+` (`ai-new-chat`, 새 대화), `☰` (`ai-command-menu-toggle`, meta menu), `ai-context-chips`, `ai-pending-queue`, then `ai-status-group`, the `Enter 전송` hint, and `ai-send` ⟷ `ai-abort` (one slot, `refreshAbortButton` flips `hidden`). Settings (`ai-settings-command-bar`) is an **item inside the `☰` menu**, not a standalone bar button; glass/side may hide `☰`, but `ai-new-chat` remains visible in glass, side, and float. **Invariant: bar height = f(textarea rows) only.** The two inline icon controls stay in the existing fixed action row; they do not add a band or vertical rail. The action menu and director-chip popover are `.ai-composer-popover` — absolute direct children of `.ai-command-bar`, `hidden` when closed, mutually exclusive, closed by outside-pointerdown/Escape. The director-chip popover has no toggle button: it opens when the input is focused and empty. Never add a transparent full-width popover layer: an invisible layer over the canvas swallowed map clicks (2026-08-19 P0). `--ai-command-bar-clearance` **and** `--ai-command-bar-inset` both come from one measurement (`syncCommandBarClearance`, includes the open popover's top). Measured (1600×1000, freshProject): float idle 160 → 126. A first attempt used a left meta rail (`/` · `✨` · `☰`) but it was dropped the same day — in glass/side the rail column carried only one button, so the column existed for that button and cluttered the bottom. The predecessor `.ai-command-input-stack` / `aiCommandBar.ts` stacked slash+context+chips+queue **in flow** above the input, so every chip toggle resized the bar and re-triggered the clearance measurement. Regression spec: `test/e2e/_ai-composer.spec.ts` (height invariance, canvas hit-test, caret).
- Header plate (`data-testid="ai-director-plate"`): 48px faceset crop of `easyrpg-faceset-actor1` index 0 + name `조수` + one-line `readAgentBrief().line`. Plate tokens already live in DESIGN.md (name `--text-1` 13px/600, line `--text-2` 12px/400, gap `--space-2`, face well `--studio-inset` / `--studio-line` or `--bg-inset` / `--border-subtle`). Collapsed restore is a 48px face button, `aria-label="AI 어시스턴트"`.
- **Action menus share one item implementation (2026-08-22):** the header `☰` (`.ai-more-menu`) and the composer `☰` (`.ai-command-menu`) build their eight shared items — 되돌리기 · 내보내기 · dock toggle · 전체 기록 · 툴 브라우저 · 🎓 맵 인터뷰 · 📐 선택 여역 학습 · ✍️ 시연으로 가르치기 — from `createAiActionMenuItems` (`src/editor/panels/aiActionMenu.ts`). Containers, positioning and open-state stay per-surface (header owns its own pointerdown/Escape handlers; the composer menu is a `.ai-composer-popover` owned by the composer shell), only the item list is shared. testids differ by surface and are part of the test contract: header `ai-more-*`, composer `ai-command-menu-*` (composer 전체 기록 has none). `applyDockModeChrome` relabels both dock items in one loop, so the two surfaces legitimately show different dock labels at the same time (header "아래 바로" while composer shows "왼쪽 유리"). Header always-visible buttons are now only `ai-new-session` and `ai-more-menu-toggle` — settings (`ai-settings-toggle`) moved into the header menu as an item, and `ai-settings-command-bar` is an item in the composer menu. The hidden `.ai-chat-toolbar` is a **test-hook container, not dead buttons**: 8 of its 9 controls are referenced by tests and the menu items act by calling their `click()`. Only `chat-dock-toggle-bar` had zero references and was removed. Regression spec: `test/e2e/_ai-composer.spec.ts` (shared-item order + header button list).
- **Dock/menu correction (2026-08-24) — 2026-08-31 에 대부분 무효:** 이 항목이 도입한 도크 라벨 3종(`오른쪽에 고정`/`입력줄로 떼기`/`왼쪽 카드로 열기`), side 헤더의 `↗` 탈출(`ai-chat-detach`), 상단바 `▤` 의 아이콘 도크 선택기(`◧`/`▥`/`⌨`), 그리고 `refreshDockLabels()` 는 도크 축과 함께 전부 삭제됐다(`refreshDockLabels` → `applyAssistantViewPolicy` 로 개명, 라벨 재계산 없음). **살아 있는 부분:** 헤더 팝업은 뷰포트 고정이고 `anchoredPopupPosition` 으로 clamp 한다 — 원래 이유(`.ai-chat-side-panel { overflow: hidden }` 안의 absolute 팝업이 통째로 잘렸다)는 사라졌지만 clamp 자체는 좁은 뷰포트에서 여전히 필요하다. 상단바 `▤` 는 workspace JSON 만 건드리던 일반 `assistant` 행을 렌더하지 않는다.
- **Assistant idle-screen choice:** 2026-09-23에 삭제. `quiet-gold` / `ink-only` / `map-first` 와 `aiTemperatureMenu.ts` 는 없다. 캔버스 「살펴볼 것」 버튼은 항상 보인다. 레이아웃 JSON의 `assistantTemperature` 는 읽지 않는다.
- Side work log is RM-style `@>` command rows (`data-testid="ai-command-row"`), not chat bubbles. There is no pending-proposal pin: a turn's writes are applied as the turn ends, so the command row is followed by the applied change card (`ai-change-card`) with its `되돌리기` button.
- **Assistant skills removed (2026-08-27):** the assistant-side skill feature is gone — no skill drawer, no `/` slash skill list, no skill palette section, no skill prompt plumbing (`src/ai/skills.ts`, `aiSkillDrawer.ts`, `assistant-skills.css`, `explicitSkillId`, `appendSkillPromptToggle` all deleted). The composer is free text + send only, and a leading `/` is ordinary text with no popover. Ctrl+K keeps 명령 + 맵 이동 sections. Game skills (battle/life/`database.skills`) are unrelated and untouched. Regression test: `test/assistantSkillsRemoved.test.ts`.
- AI system-prompt UX policy is centralized in `src/ai/promptPolicies.ts` and injected by `src/ai/contextBuilder.ts`. Keep refusal of unsupported engine requests, one-sentence clarification for low-information prompts, one-queue proceed behavior after "진행/계속" instructions, non-destructive self-repair such as `resize_map`, honest "preparation only" status, draft-tense wording before acceptance, and beginner-facing 3-5 sentence final responses covered by unit tests when editing the prompt.
- AI 怨좎닔以 ???쇱슦?낆? `src/ai/contextBuilder.ts`??"怨좎닔以 ???곗꽑" 釉붾줉怨???섏? ??description???④퍡 맞춘?? ?몃옪/체크?ъ씤?몃뒗 `place_trap`, ?쇱쫹? `compile_puzzle`, 조사 ?ㅻ툕?앺듃??`place_examine_hotspots`, 컷신? `script_cutscene`, 추격? `make_chase_scene`, NPC??`place_npc`/`make_villager`, ?곸젏? `set_shop_stock`, ?щ깷?곕뒗 `make_hunting_ground`, 조명/분위기는 `set_lighting_volume`/`set_scene_mood`, ?섏뿭/바닥? `fill_region`, **吏?마당? `build_house_lots`**(LLM: 吏?wings ?꾩튂쨌kitId쨌yard 꾸밈 ?쒓렇留?/ 코드: 臾맞룻??셋룸쭏???고룷 좌표 ??`src/editor/tools/houseLotTools.ts` + `houseLotDecor.ts`), **?ㅻ궡/諛?留듭? `start_interior_room_session`/`run_interior_room_pipeline`(??mapId ??`build_house_kit` 湲덉?)**, ?⑥씪 ?쇱쇅 ?몄옣留?`build_house_kit`, bulk 마을? `build_village`, ?붾뱶??`plan_world`/`build_world`, ?섏뒪?몃뒗 `define_quest`??verify_quest`媛 ?곗꽑 경로?? 吏????뚰뭹??`place_props`濡?광장??紐곗? 留?寃? `upsert_event`/`upsert_common_event`???꾩뿉 ?녿뒗 而ㅼ뒪? 로직 ?꾩슜?대ŉ, `commands` ?⑥닔 객체??warning怨??④퍡 諛곗뿴濡??밴꺽?섏?留?`kind` 객체/?꾨씫? ?몃뜳?ㅻ퀎 `invalid-args`? 1而ㅻ㎤??JSON ?덉떆瑜?반환?댁빞 ?쒕떎.
- **?ㅻ궡쨌??留?+ ?좏깮 ?곸뿭 ?묒뾽(audit 18):** 캔버???좏깮 以?채팅? 기본?곸쑝濡?`runRegionTask` ?섎뱶 ?대┰ 寃쎈줈瑜??꾨떎. 그러??`isRegionEscapingIntent`(?ㅻ궡/?명뀒리�뼱/??留??? `regionIntentRouter.ts`)?대㈃ `aiChatPanel`???좏깮 ?곸뿭 ?묒뾽???꾧퀬 **?쇰컲 채팅 ?꾨웾 경로**濡??고쉶?쒕떎 ???곸뿭 ? 0?대㈃ `create_map`/?ㅻ궡 맵이 ?듭㎏濡??먭린?섎뜕 ?ㅽ뙣 모�뱶瑜?막기 ?꾪븿. 방�뼱?곸쑝濡?`runRegionTask`??`mapsAdded`???곸슜 조건???ы븿?섍퀬, `routeRegionIntent`??`interior` 移댄뀒怨좊━??`structure`(?쇱쇅 `build_house_kit`) 媛?대뱶? 諛고??대떎. ?꾩꽦??린트???ㅻ궡 ?붿껌???쇱쇅 ?ㅽ듃留??곌굅??鍮?맵만 留뚮뱾硫?`??미이????붙인??
- **吏?vs ?ㅻ궡 ?섎룄 ?뺤씤:** `src/ai/intentClarify.ts`??`resolveIntentClarification`??LLM ?꾩뿉 寃곗젙濡좎쑝濡?寃쎈줈瑜?媛른다. `吏?嫄대Ъ 만들?댁쨾`留??덇퀬 ?ㅻ궡쨌?쇱쇅 ?쒖?媛 ?놁쑝硫??꾧뎄 ?몄텧 ?놁씠 `[?좏깮吏] ?ㅻ궡 留듭쑝濡?| ?쇱쇅 吏??몄옣)?쇰줈 | ?몄옣 吏?+ ?대? ????瑜??꾩슫??`AssistantSession.sendUserMessage`). ?щ옒???ㅽ궗 ?쒕엻?쇰줈 `build-house`쨌`build-interior`瑜?怨좊Ⅴ硫?`explicitSkillId`濡??섎Щ湲곕? 건너?대떎. UX ?뺤콉 문구??`promptPolicies`?섅뚯쭛 vs ?ㅻ궡(?꾩닔)??
- NPC/二쇰?/????대깽???좉퇋 배치??`place_npc` ?먮뒗 ?쒓컙?쒓? ?꾩슂??경우 `make_villager`媛 기본 경로?? `upsert_event`???꾩껜 `GameEvent` shape瑜??뚭퀬 기존 ?대깽?몃? ??섏??쇰줈 ?섏젙???뚮쭔 ?곕룄濡????ㅻ챸, ?몄옄 ?ㅻ쪟 ?뚰듃, ?쒖뒪???꾨＼?꾪듃 泥댄겕리�뒪?? ?앹꽦????移댄깉濡쒓렇瑜??④퍡 맞춘?? Event write paths must keep `event.commands` and every `pages[].commands` as arrays after normalization; low-level paths may normalize a single command object to an array with a warning, while unrecoverable malformed values fail as `invalid-args`. `projectLint` must skip malformed command arrays with a `command-shape` warning instead of throwing.
- AI proposal cards run a conservative completeness lint before display. If the current-turn or relevant active BuildSpec declares an asset/area that no actual changed tool region touched, or if a no-spec request clearly expected edits but produced no changed calls / a severely short counted placement, the closed `자세히` drawer shows the completeness line and stores the same message in `ToolResult.diff.warnings`. The lint also adds proceed-instruction hints for 0-change turns and flags assistant final text that ends with a wait-please promise when no write tool or proposal was produced.
- The proposal completeness lint warns when a turn declares three or more story flags without `define_quest`, so narrative-heavy turns are nudged toward a quest graph and `verify_quest` acceptance path.
- `AssistantSession` also treats prior-turn active BuildSpecs as proposal-scope risk: if the next proposal uses that carried-over spatial plan, the first changed call stores `??범위: ???쒖븞?먮뒗 ?댁쟾 계획(...)???ы븿?섏뼱 ?덉뒿?덈떎.` in `ToolResult.diff.warnings`. This warning rides the same proposal warning-line frame as completeness warnings.
- Proposal assembly squashes event movement trial runs before display. Repeated `move_event` calls for the same target keep all tool/audit events, but `proposedCalls` retains only the final move; if a newly created event (`place_npc`/similar event base call) is immediately moved, the creation proposal is rewritten to the final event coordinates instead of showing separate move rows.
- The proposal completeness lint no longer warns about unrecorded worldview (removed 2026-08-28 with the rest of the worldview AI wiring; see `openwiki/editor-pre-edit-routing.md`). `worldEntitiesAdded/Modified` stays in `ChangeSummary` and in the card summary vocabulary, but no tool writes it now — a nonzero count means the wiring came back.
- Accepted AI changesets also run `src/editor/agentFocus.ts`: the editor selects the map with the largest visible map/event change and emits a transient `.agent-focus-highlight` overlay for changed cells or bounds. Keep this on AI acceptance paths only; manual paint/updateMap flows should not request the highlight.
- AI spatial build calls are gated by `src/ai/buildSpec.ts` through `AssistantSession`: `set_build_spec` validates the outline, then spatial write tools use that outline as the starting contract. Empty-space overruns auto-expand the active BuildSpec and pass with `spec-gate-auto-expand` warnings; expansion into existing built cells is still blocked. `build_house_kit` wings are compared as individual rectangles plus the actual door-front footprint rather than one merged bounding box. Clear assets may overlap later placement assets when `buildOrder` puts `clear` first, and an explicit terrain-before-road order permits a road overlay on terrain. Other placement-vs-placement overlap remains an error. Destructive clear/overExisting/confirmDestroy structure-protection checks still come from actual map contents and must not be softened.
- Tile v3 vocabulary proposals live in `src/editor/tools/v3/vocabularyTools.ts`. For an existing `groupId`, agents should send only the group id; if a partial or mismatched `tileIds` list is included for a group that already has usable pattern grammar or harness tile definitions, the tool preserves the existing tile set and returns a warning. Mixed `items` proposals are item-granular: valid cards still appear while invalid items are reported in `ToolResult.issues`.

- **조수 카메라는 사용자 제스처 중에 끼어들지 않는다 (2026-08-29):** `editorCameraFocus.ts` 는 목표 계산(`planCameraFocus`, `onlyIfOffscreen` 이면 화면 밖일 때만 움직인다)과 **양보 판정**(`shouldDeferCameraFocus(PointerGestureState)`)을 순수 함수로 들고 있고, `EditScene.panCameraToTile` 은 `pointerGestureState()` 로 다섯 가지를 먹인다: 페인트 스트로크(`isPainting`), 손 팬(`cameraPanController.active()`), 도형·선택·이벤트 드래그(`dragOperationHandler.busy()`), 우클릭 영역 제스처(`rightRegionGesture`), 붙여넣기 미리보기(`editorState.pastePreview`). `isPainting` + 팬만 보던 이전 판정은 **모든 드래그를 놓쳤다** — `pointerdown` 은 `beginDragOperation` 이 true 를 주면 `isPainting` 을 세우기 전에 반환하고 `beginRightRegionGesture` 는 오히려 false 로 내리므로, 드래그 중에 조수 팬이 끼어들면 `commitShapeDrag`/`commitEventMoveDrag` 가 팬 거리만큼 밀린 타일을 커밋한다(조용한 저작 데이터 손상). `DragOperationHandler.busy()` 는 `active()` 와 달리 아직 문턱을 못 넘은 `eventDragCandidate` 까지 센다. 프로그램 팬의 뒷정리는 마지막 프레임에만 한다 — `camera.pan(x,y,duration,ease,force,cb)` 의 6번째 인자는 onComplete 가 아니라 **onUpdate** 라서 `progress === 1` 로 걸러야 300ms 동안 매 프레임 DOM 마커를 지웠다 다시 만들지 않는다. Tests: `test/editSceneCameraFocus.test.ts`, `test/agentFocus.test.ts`, `test/eventListCameraFocus.test.ts`.

## 영역 작업 · 시공 · 실내/집 파이프라인

- **「다듬기」는 있는 영역을 주변에 맞추는 모드다 — 새로 만들지 않는다 (2026-08-31):** 선택 칩의 `다듬기`는 `openRegionTaskModal` 에 `mode:"polish"` 로 들어가는 **영역 작업의 두 번째 모드**이고(`RegionTaskMode = "task" | "polish"`), 별도 파이프라인이 아니다 — 지시 조립·클립·검토·pending 적용 경로를 전부 공유한다. 지시문은 `regionSurroundings.ts` 가 영역 바깥 링에서 읽은 재료·길·진입점을 박아 만들고(`regionPolish.ts`), **`create_map` 계열은 실행 가드로 막는다** — 다듬기가 새 맵을 만들면 "다듬어 달라"가 "새로 만들어 버렸다"가 된다. **어울림 점수(`regionBlend.ts`)는 경고이지 게이트가 아니다**: 경계 어긋남·새로 막힌 진입·끊긴 길을 가중 합산해 `metrics.blendScore`(+`blendScoreBefore`)로 싣고, 좌표 붙은 `region-blend-break`/`region-blend-entrance-blocked` 를 **`severity:"warning"` 으로만** 넣는다. error 로 올리거나 적용을 막지 않는다 — 막힌 길이 의도일 수 있고(성벽, 폐쇄 구역), 애초에 이 경로에는 차단 개념이 없다(「영역작업 검증게이트 배제, 2026-08-30」 과 같은 계약: `PendingRegionApply` 에 `blockers` 가 없다). 실측: 경고 3종·주의 4건이 뜬 화면에서 `적용 · 48칸` 이 그대로 활성이다. **영역 밖 타일 변경은 오토타일 이음새 1칸만 예외다** — 잔디·모래가 만나는 칸의 모양은 양쪽이 정하므로 영역 안만 고치면 밖의 경계 칸이 옛 모양으로 남아 이가 어긋난다. 그래서 적용 시 `polishRegionSeams` 가 밖 1칸까지 다시 계산하고, `reviewRegionDraft` 에는 **`scopeRegion`(region 을 1칸 넓힌 사각형)** 을 따로 넘긴다 — 안 넘기면 방금 만든 이음새가 `region-scope-violation` **error** 로 잡혀 다듬기가 늘 차단된다. 고립·도달·일정 검사는 계속 `region` 기준이고, 바뀐 이음새는 차단 사유가 아니라 `metrics.seamCells` 로 보고한다(실측 1칸). **이벤트는 영역 밖으로 못 나간다** — 밖으로 옮겨진 좌표는 경고가 아니라 되돌림이다(`clipToRegion.ts` 가 원위치로 클립). 「다시 만들기」는 `lastAiMode` 를 유지해 **다듬기로** 재실행하고(task 로 떨어지면 방금 고른 모드가 조용히 바뀐다), 적용은 기존 pending 경로를 재사용하므로 **되돌리기 1칸**으로 남는다(실측: 적용 직후 배너 「48칸 타일」 하나). Owner: `src/editor/regionTask/{regionSurroundings,regionBlend,regionPolish,clipToRegion}.ts`, `src/editor/panels/regionTaskModal.ts`. Tests: `test/regionSurroundings.test.ts`, `test/regionBlend.test.ts`, `test/regionPolish.test.ts`, `test/regionTaskPolishModal.test.ts`, `test/regionTaskRun.test.ts`(mode: polish), `test/regionTaskClip.test.ts`. 실측 보고서: `reports/region-polish/index.html`(수치는 캡처가 DOM 에서 읽어 `facts.json` 에 적은 값만 쓴다).

- **캔버스 AI 만들기 집·마을 (2026-08-25):** 우측 상단 `만들기`는 영역 선택용 건축 팔레트를 열지만, 그 안의 `집`과 `마을`은 로컬 결정론적 primitive를 즉시 적용하지 않는다. 두 버튼 모두 선택 영역과 구체적인 자연어 지시를 `openRegionTaskModal({ autoRun:true })`로 보내 실제 LLM 영역 작업과 분리된 미리보기/적용 검토를 시작한다. 강·길·지붕·NPC·나무·소품은 기존 로컬 도구이며, `AI로 채우기`는 지시 편집 후 사용자가 실행하는 기존 경로다. 회귀 테스트: `test/buildPaletteToggle.test.ts`.

- **배치 충돌 자동 정리 (2026-08-27):** 제안 적용·영역 작업 승인에서 `validateLayoutPlacement` 가 error 를 내면 사람에게 "배치 검증 실패"를 던지지 않는다. `repairLayoutPlacement` 가 물/통행불가 위 소품·수관을 가까운 육지로 옮기고, 밑동 없는 수관은 보완하거나 제거하며, 지시만 있고 나무가 0이면 보식한다. 그래도 남는 error 만 차단한다. 정리 내용은 시스템 줄로 알린다. Owner: `src/project/lint/layoutPlacementRepair.ts`. Tests: `test/layoutPlacementValidate.test.ts`.

- **영역 작업은 플래너를 건너뛴다 (2026-08-26):** `isProtocolLocked` 합성 문장(`영역 작업 도구 규칙`)은 `agentMode auto`여도 `runOrchestratorPlanner`를 호출하지 않는다. 시공 경로가 이미 잠긴 지시를 다시 분해하면 oh-my-pi 워커 크래시(500 / `worker exited`)를 플래너+본문으로 두 번 연속 재시도한다. 워커 크래시 500은 본문 루프에서 1회만 재시도한다.

- **영역 작업 bare 집 → 야외 집 직시공(2026-07-24 수정):** 영역 작업(`buildRegionTaskMessage`)에서 사용자가 현재 맵 위에 선택 영역을 준 상태로 “집”이라고만 하면, 이전엔 “야외/실내 되묻기”로 턴이 끝났다(0건 호출). 이제 영역 선택 자체가 현재 맵 위 야외 시공 의도의 신호이므로 `author_house(kind:"single")`로 바로 시공한다. `constructionFacadeLine`의 bare fallback은 `/집/`만 잡고 `/건물/`은 잡지 않는다 — 탑/성벽/대장간 등은 structure 가이드가 `build_wall`/`create_farm_plot`으로 안내한다. 채팅 경로(영역 footer 없음)는 `resolveIntentClarification`(`intentClarify.ts` PROTOCOL_LOCKED_RE)가 여전히 bare 집을 사전 차단해 되묻는다 — 영역 메시지만 “영역 작업 도구 규칙” 마커로 protocol-lock 을 우회한다. 단위 테스트: `test/regionTaskRun.test.ts`.

- **Interior beta room (villager house, not harness gold):** current gallery map `map_interior_blank` / `?ㅻ궡 공터 (????섎꽕??` is a **beta tileset-authoring room** for a normal villager house, not an official `build_house_kit` harness. Exit alcove target is lower cell **(7,11)**. Intended events later: exit transfer + chest/drawer inspect + bookshelf inspect + NPC talk. Do not promote to harness until the user says so. Interior auto-connect needs the seeded dark-wall `tileset.autotileGroups` entry (`366` brush); harness `tileGroups` alone do not reshape. 援?`wall-frame-autotile`(105 몸통 + 233/258 코너) 그룹? ?쒕뱶?섏? ?딆쑝硫?pack ?곸슜 ????λ맂 ?꾨줈?앺듃?먯꽌???쒓굅?쒕떎 ??주택 踰쎌? ?ㅽ넗??쇱씠 ?꾨땲???듯???grammar??

- **二쇰? 吏??ㅻ궡 ?ㅽ듃 `villager-room-v1` (?덉감?겶룸??고꽩):** village ?몄뀡怨?媛숈? ?덉씠???뚯씠?꾨씪?? Code: `src/editor/interiorRoomPipeline.ts` + tools `start_interior_room_session` / `advance_interior_room_build` / `run_interior_room_pipeline`. **Build order:** `plan ??floor(bbox) ??walls ??furniture ??entrance ??critique`. **Walls = ?섏슦????whole-tile grammar (`planInteriorHouseWalls` / `paintInteriorHouseWalls` ??Option B, 주택 踰??좎씪 writer)**: ????ㅽ넗????놁쓬 ??`shapeAutotileGroupAround`瑜??몄텧?섏? ?딄퀬 ?꾩꽦 ?듯??쇱쓣 `lowerTiles`??직접 기록?쒕떎. 媛숈? plan? ??긽 媛숈? grid瑜?만든?? ?대몢??벽만 **366** ???+ 쿼터 ?뚮뜑(?숆뎬/吏?????꾩슜). ?뺣낯 ?곸닔??`HOUSE_SHELL_TILE` in `src/project/defaults/interiorHouseWallTiles.ts` ?섎굹??援?`INTERIOR_HOUSE_SHELL_CREAM_FACE`/`INTERIOR_WALL_FRAME_TILES`/companion 개념? ?먭린). 배치 ??븷 ?대쫫? variant 결손 방�뼢???꾨땲??**?ㅼ젣 ?쎌? ??방�뼢**???곕Ⅸ????**?�림 踰쎈㈃ 2?? ?쀬쨪 74/75/76 쨌 ?꾨옯以?104/105/106**(媛濡?run ???앸쭔 L/R), **1移??몃줈 칸막????77 쨌 ??107**(천장 직하 2칸만; 臾??대궓쨌泥쒖옣 밴드 愿???댁? ?꾨젅???ъ뒪??428), **457 罹?*(罹???조인??**458(NW)/456(NE)** ??**233/258 湲덉?**), **?ъ뒪??428(??/426(??? 바닥 留덉?留??됯퉴吏 강제**, ?⑥륫 ?몃┝ 397? 바닥 ??쭔, **?�쪽 ?媛?코너???ㅼ젣 공허 430**(援??쒕젋??368 荑쇳꽣媛 감쌈???섏〈? ??젣 ??430? 쿼터 ?⑹꽦 중심???꾨땲??. **臾?*: ?몃┝ ?됱뿉??`398(?? | 바닥 72 | 396(??`, ?꾨옒 ?됱? **`397` 계단 ?섎굹肉?*(**257 받침 湲덉?** ??좌우??공허 430?쇰줈 ?⑤뒗??. `HOUSE_SHELL_FORBIDDEN_TILES = [233, 257, 258]`: 233/258? ?묓겕 ?뚮젅?댁뒪??? 257? 媛援?질감?대씪 踰승룸Ц 목�쟻?쇰줈 ?덈? 기록?섏? ?딅뒗?? 벽걸?대뒗 踰쎈㈃ **?쀬쨪**(?꾨옒 ???踰쎈㈃???), ????媛援??곷떒? **?꾨옯以?*??겹침(?붾뜒 21 upper|51 lower). 벽걸??????媛援??곷떒? 踰쎈㈃ ?꾨옒以?`listWallFace` = `houseShellWallMembers`) upper??겹친?????붾뜒 21(upper, 踰쎈㈃)|51(lower, 바닥) ?몃줈 hard ?띿씠 湲곗? ?덉떆. (援?**366 ?ㅽ겕??留?*? ?숆뎬/吏?????꾩슜 ??`paintDarkWallAndShape`???좎??섎ŉ 吏??ㅻ궡 walls ?덉씠?댁뿉?쒕뒗 ???댁긽 ?곗? ?딅뒗??) 踰??ъ쭏 리�떞?몃뒗 `retintHouseWallFace(map, material)` ???�림 2??`77`쨌`107`留??꾩꽦 벽돌 硫?gold `314??16`/`344??46`, stone `134??36`/`164??66`)?쇰줈 諛붽씀怨?캡�룻룷?ㅽ듃쨌?몃┝쨌臾??꾨젅?꾩? 嫄대뱶리�? ?딅뒗?? **Entrance event** at door: valid `{ kind:"text", body }` (not `lines` ??invalid shape was dropped on save), trigger action, name `?낃뎄`. **Hard bed 355|356**. **Pictures 114|115 horizontal pair**. **湲??곸옄 325|326 hard ??*, **괘종?쒓퀎 389|419 hard ?몃줈??*, 카운?????뚰뭹(237/235/238)? 카운??lower ??upper. **No indoor plants**. **諛???뚰삎 諛?보정, 2026-07-14):** 媛?뺤쭛 4諛?媛숈? ?뚰삎 맵에??鍮?바닥??과다?섎뜕 문제 ?댁냼 ??`placeSouthFiller` ?꾧퀎 **area??0**(援?48), ?щ텇硫?보정·?됯? `floorCells??4`(援?60), 침�떎/거실 ?ш렇쨌踰??댁쨷 ?μ떇쨌踰??ㅻ깄 ?곸옱 ?곹뼢, 주방 ?묒뾽?+?곸옱 ?곹뼢, ?뚰삎 ?쒖옱 ?쒓? 1??怨쇰? 봉쇄 방�?). walkability???꾨떖 遺덇? ?ъ폆??遺숈? ?쒓굅 媛???뚰뭹(`CABINET_U` ?ы븿)??異붽?濡??뱀씤?? **諛?구조(bbox)**: `plan.rooms = [{id,x,y,w,h,theme?}]` ??吏????wings ???rooms ?⑹쭛?⑹씠 바닥, **방�쭏???먭린 ?뚮쭏 媛援?*. ?곹븯 ?몄젒 방�? **3??간격**(밴드 = 罹?457 + ?�림 踰쎈㈃ 횞2, 간격 1~2??critique 경고). **좌우 ?몄젒 諛?gapless)? 1???섏쭅 ?뚰떚??* ??천장 직하 2移몄? ?�림 1移??명듃 **77|107**, 천장 諛대뱶쨌臾??대궓? **428** ?꾨젅?? ?뚰떚???? **????븷 계산 ?꾩뿉 ?덉빟**?쒕떎(`planInteriorHouseWalls` ?대?). walls ?댄썑??`105` 紐명넻留???뜕 ?꾩쿂由?`paintRoomPartitionWalls`??**??젣?먮떎** ???섏궡리�? 留?寃? 주택 ?ъ뒪?몃뒗 ?꾩꽦 ?듯??쇱씠??방�쓣 ?ν븳 **?쒖そ ?좊쭔** 갖는???ㅽ겕 1??기둥??426|428 좌우 諛?쿼터? ?ㅻⅤ????주택 ?? 쿼터 ?⑹꽦???吏 ?딅뒗??. `plan.innerDoors = [{x,y}]`: ?섑룊 ?뚰떚?섏씠硫??몃줈 3移?복도 + 398|396 ?뚮옲?? **?섏쭅 ?뚰떚?섏씠硫?1移?臾?*(醫뚯슦媛 바닥?대㈃ ?먮룞 ?먮퀎). 臾?媛쒓뎄遺 ?? faceBottom/?몃┝ 규칙?먯꽌 ?쒖쇅(???꾨옒 기둥 ?좎?, doorGapKeys). 벽걸?대뒗 湲?踰쎈㈃ run ?곗꽑(?대? 臾몄쑝濡?履쇨컻吏?2移?구�컙 ?뚰뵾). ?곕え: `map_interior_inn_rooms_v1`(諛?5媛? 李쎄퀬쨌媛앹떎횞2·주방·?, ?섏쭅/?섑룊 ?뚰떚???쇳빀). Gallery: `npx tsx scripts/build-interior-room-gallery.mts`, ?ш? ?덉떆: `scripts/build-inn-interior-map.mts`, 諛?구조 ?곕え: `scripts/build-inn-rooms-demo.mts`. 媛?뺤쭛 4諛??ъ깮?? `bun scripts/build-home-4rooms.mts` ??project `rpg-zzu-home-8pyeong` / `map_home_4rooms_v1`.

- House-harness interiors and door events are shared through `src/editor/houseInteriors.ts`. `build_house_kit` and `build_village` default to `interior:true`: they keep the existing exterior grammar and lower-layer door tiles, add an Object1 charset door event on the door tile, create one `easyrpg_chipset_interior` child map per house, and add a player-touch exit back to the exterior door-front cell. **Interior map body uses `villager-room-v1` only** (`runInteriorRoomPipeline` via `houseInteriors.ts`). Scales: **cottage-l** 20횞16 **true L floor** (NW kitchen/hearth + NE bedroom notch + south hall only ??SE void; default 1F dwelling/manor; housePlans may set ownerName+program explicitly), **cottage2** 20횞20, **cottage3** 20횞20 three rooms, **mansion** 24횞22 six rooms + corridor (`gold-brick`, 2F+ manor). Demo chief exterior uses housePlans templateId `l` (?깆옄).. Entry/exit landings are force-passable. Old 13횞10 single-room stub is removed. `build_house_kit` clears an impassable south door-front cell to the local majority passable ground tile and warns about the cleanup; if the door front is outside the map, it fails with a south-margin message. Pass `interior:false` to keep the legacy exterior-only result. **Room kits available:** house interiors = `villager-room-v1` only; dungeons = separate `dungeon-room-v1` (not used for village houses).

- **?ㅻ궡쨌??留?+ ?좏깮 ?곸뿭 ?묒뾽(audit 18):** 캔버???좏깮 以?채팅? 기본?곸쑝濡?`runRegionTask` ?섎뱶 ?대┰ 寃쎈줈瑜??꾨떎. 그러??`isRegionEscapingIntent`(?ㅻ궡/?명뀒리�뼱/??留??? `regionIntentRouter.ts`)?대㈃ `aiChatPanel`???좏깮 ?곸뿭 ?묒뾽???꾧퀬 **?쇰컲 채팅 ?꾨웾 경로**濡??고쉶?쒕떎 ???곸뿭 ? 0?대㈃ `create_map`/?ㅻ궡 맵이 ?듭㎏濡??먭린?섎뜕 ?ㅽ뙣 모�뱶瑜?막기 ?꾪븿. 방�뼱?곸쑝濡?`runRegionTask`??`mapsAdded`???곸슜 조건???ы븿?섍퀬, `routeRegionIntent`??`interior` 移댄뀒怨좊━??`structure`(?쇱쇅 `build_house_kit`) 媛?대뱶? 諛고??대떎. ?꾩꽦??린트???ㅻ궡 ?붿껌???쇱쇅 ?ㅽ듃留??곌굅??鍮?맵만 留뚮뱾硫?`??미이????붙인??

- **吏?vs ?ㅻ궡 ?섎룄 ?뺤씤:** `src/ai/intentClarify.ts`??`resolveIntentClarification`??LLM ?꾩뿉 寃곗젙濡좎쑝濡?寃쎈줈瑜?媛른다. `吏?嫄대Ъ 만들?댁쨾`留??덇퀬 ?ㅻ궡쨌?쇱쇅 ?쒖?媛 ?놁쑝硫??꾧뎄 ?몄텧 ?놁씠 `[?좏깮吏] ?ㅻ궡 留듭쑝濡?| ?쇱쇅 吏??몄옣)?쇰줈 | ?몄옣 吏?+ ?대? ????瑜??꾩슫??`AssistantSession.sendUserMessage`). ?щ옒???ㅽ궗 ?쒕엻?쇰줈 `build-house`쨌`build-interior`瑜?怨좊Ⅴ硫?`explicitSkillId`濡??섎Щ湲곕? 건너?대떎. UX ?뺤콉 문구??`promptPolicies`?섅뚯쭛 vs ?ㅻ궡(?꾩닔)??

- **Safe tilemap harness review (진단 전용, 2026-08-30):** `runRegionTask` keeps AI proposals detached and clips them to the selected region, then exposes structured issues and gameplay metrics through `pendingRegionApply`. `reviewRegionDraft` is **read-only**: it no longer repairs isolated cells, no longer deletes unreachable generated inspect events, and no longer emits blockers or checkpoints — what the ghost preview shows is what gets applied. The same modal also has a quota-independent **AI 없이 실내 초안** path (`runDirectRoomDraft.ts`) with home/inn/manor presets and composable modifiers; it picks a world-reachable empty doorway, builds a detached room, and wires both transfers before review. The review UI shows live progress, advisory 소견 (확인/주의) with NPC/time metrics, apply/discard, and room lock/seeded room-only reroll controls. Every pending apply re-reads the live authored project and refuses only on a stale base; diagnostics never refuse, and a diagnostics crash is logged and stepped over rather than blocking the apply.

## 툴 노출 · 프롬프트 · 의도 판정 · NPC

- **AI 리�튂 문서(`present_doc`, core ?꾨찓??:** AI媛 ?쒓컖 ?먮즺媛 ?꾩슂???ㅻ챸(?ㅽ넗???구조쨌???문법·비교????**?섏씠釉뚮━??블록 문서**濡?만든?? 블록: `markdown`/`table`/`sheetMap`(칩�뀑+議??ㅻ쾭?덉씠)/`tileBlockCard`(?곸뿭 ?�롭 카드)/`paintDemo`(RM2k3 3횞4 블록 ?명꽣?숉떚釉??섏씤??/`html`(sandbox iframe, allow-scripts留?. 구조??블록? **?댁븘?덈뒗 ??쇱뀑**(`tilesetImageUrl`)?먯꽌 그려??base64 불필?붋룹??좏겙. 채팅 踰꾨툝濡??몃씪???뚮뜑(`aiChatPanel` present_doc ????`aiConversationLog.appendAiDocument` ??`aiDocRenderers.ts`), `project.aiDocuments[]`???곸냽(`list_ai_docs`濡?조회). Code: `src/editor/tools/aiDocTools.ts`, `src/editor/panels/aiDocRenderers.ts`. Tests: `test/aiDocTools.test.ts`.

- **NPC dialogue faces:** `place_npc` / `make_villager` auto-insert `changeFace` from charset?뭚aceset (`src/assets/charsetFaceMap.ts`) before text. Starter village NPCs already authored faces; do not leave talk pages without face.

- AI system-prompt UX policy is centralized in `src/ai/promptPolicies.ts` and injected by `src/ai/contextBuilder.ts`. Keep refusal of unsupported engine requests, one-sentence clarification for low-information prompts, one-queue proceed behavior after "진행/계속" instructions, non-destructive self-repair such as `resize_map`, honest "preparation only" status, draft-tense wording before acceptance, and beginner-facing 3-5 sentence final responses covered by unit tests when editing the prompt.

- AI 怨좎닔以 ???쇱슦?낆? `src/ai/contextBuilder.ts`??"怨좎닔以 ???곗꽑" 釉붾줉怨???섏? ??description???④퍡 맞춘?? ?몃옪/체크?ъ씤?몃뒗 `place_trap`, ?쇱쫹? `compile_puzzle`, 조사 ?ㅻ툕?앺듃??`place_examine_hotspots`, 컷신? `script_cutscene`, 추격? `make_chase_scene`, NPC??`place_npc`/`make_villager`, ?곸젏? `set_shop_stock`, ?щ깷?곕뒗 `make_hunting_ground`, 조명/분위기는 `set_lighting_volume`/`set_scene_mood`, ?섏뿭/바닥? `fill_region`, **吏?마당? `build_house_lots`**(LLM: 吏?wings ?꾩튂쨌kitId쨌yard 꾸밈 ?쒓렇留?/ 코드: 臾맞룻??셋룸쭏???고룷 좌표 ??`src/editor/tools/houseLotTools.ts` + `houseLotDecor.ts`), **?ㅻ궡/諛?留듭? `start_interior_room_session`/`run_interior_room_pipeline`(??mapId ??`build_house_kit` 湲덉?)**, ?⑥씪 ?쇱쇅 ?몄옣留?`build_house_kit`, bulk 마을? `build_village`, ?붾뱶??`plan_world`/`build_world`, ?섏뒪?몃뒗 `define_quest`??verify_quest`媛 ?곗꽑 경로?? 吏????뚰뭹??`place_props`濡?광장??紐곗? 留?寃? `upsert_event`/`upsert_common_event`???꾩뿉 ?녿뒗 而ㅼ뒪? 로직 ?꾩슜?대ŉ, `commands` ?⑥닔 객체??warning怨??④퍡 諛곗뿴濡??밴꺽?섏?留?`kind` 객체/?꾨씫? ?몃뜳?ㅻ퀎 `invalid-args`? 1而ㅻ㎤??JSON ?덉떆瑜?반환?댁빞 ?쒕떎.

- NPC/二쇰?/????대깽???좉퇋 배치??`place_npc` ?먮뒗 ?쒓컙?쒓? ?꾩슂??경우 `make_villager`媛 기본 경로?? `upsert_event`???꾩껜 `GameEvent` shape瑜??뚭퀬 기존 ?대깽?몃? ??섏??쇰줈 ?섏젙???뚮쭔 ?곕룄濡????ㅻ챸, ?몄옄 ?ㅻ쪟 ?뚰듃, ?쒖뒪???꾨＼?꾪듃 泥댄겕리�뒪?? ?앹꽦????移댄깉濡쒓렇瑜??④퍡 맞춘?? Event write paths must keep `event.commands` and every `pages[].commands` as arrays after normalization; low-level paths may normalize a single command object to an array with a warning, while unrecoverable malformed values fail as `invalid-args`. `projectLint` must skip malformed command arrays with a `command-shape` warning instead of throwing.

- Tile v3 vocabulary proposals live in `src/editor/tools/v3/vocabularyTools.ts`. For an existing `groupId`, agents should send only the group id; if a partial or mismatched `tileIds` list is included for a group that already has usable pattern grammar or harness tile definitions, the tool preserves the existing tile set and returns a warning. Mixed `items` proposals are item-granular: valid cards still appear while invalid items are reported in `ToolResult.issues`.

## 타일셋 이해 · 검토 위저드 (T1a/T1b)

- T1a tileset palette intelligence added non-UI editor/tooling surface. `run_lint` now also includes `src/editor/lint/tilesetPaletteLint.ts` for palette diversity info, awkward boundary warnings, and passage consistency warnings. `query_tiles` reads tile details by role/category/preset, `upsert_palette_preset` writes presets through the normal proposal pipeline and rejects locked presets, and `paint_road`/`scatter_object`/`build_house`/`stamp_structure` accept `presetId` + `paletteRole` with seeded selection from preset slots.

- T1b tileset understanding UI lives in `src/editor/panels/tilesetReviewWizard.ts`, `src/editor/tilesetReaudit.ts`, and `src/editor/panels/palettePresetEditor.ts`. The review wizard sorts confidence<1 tileMeta by confidence, exposes passage/role/group overlays, and applies re-audit candidates through confirm/approve actions. The old tile metadata fix popover and canvas "??????섎せ ?곗엫" right-click fallback are retired; outside selection regions, non-event canvas right-click opens no tile-fix menu.

- Tileset vocabulary has two distinct contracts. `TilesetDef.palettePresets` is the older role-slot palette used by `query_tiles` and legacy placement tools; v3 construction resolves semantic `TileGroupMetadata` through `tileVocabulary.ts` and does not consume palette presets. The build palette bootstrap therefore exposes `BUILD_PALETTE_GROUP_IDS` / `ensureBuildPaletteTileGroups`; despite the UI name, those values identify and normalize tile groups, not `PalettePreset` records.

- Review queue and re-audit domain types/confidence live in `src/editor/tilesetReviewModel.ts`, outside the DOM wizard. A human confirm routes through `confirmUserTileMetadata`: canonical `origin:"user"`/`confidence:1`/`locked:true` plus compatibility mirrors `source:"user"`/`userLocked:true`. Readers must use `tileMetaOrigin` and `tileMetaLocked` rather than selecting one field generation directly.

- Tileset transparent-color editing lives in `src/editor/panels/tilesetSettingsDetails.ts` and stores a user override on `TilesetDef.transparentColor`; render paths resolve it in `src/assets/chipsetTransparency.ts` before falling back to chipset defaults.

- Database > Tilesets > Knowledge is human-first again. `tilesetKnowledgeInspector.ts` renders the full selection/template/passage/per-cell-layer/group editor directly, preserving `tilesetGridSelection.ts` click/Ctrl/Shift/rectangle semantics and `tilesetKnowledgeWorkspaceState.ts` stable user-group persistence. The bottom **AI 타일셋** action opens a separate wide modal; AI review content must not be mounted inside the normal inspector.

- The AI workspace is a **three-step wizard** (`analyze → questions → summary`, see `tilesetAiWorkspaceModal.ts` and `TilesetAiWorkspaceStep`). Step 1 shows the whole-atlas analysis contract with live status; step 2 keeps the conversational question flow (`tilesetAiNativeAnalysis.ts` renders the whole chipset atlas, sends the image plus human locks and prior answers to the configured vision-capable model, and parses detached proposals with a question and quick replies) plus a per-question **이 제안 버리기** discard action; step 3 is the apply summary (confirmed list with per-proposal thumbnails, template names, confidence, and counts) whose single apply button writes. `naturalTilesetAiWorkspaceStep` derives the step from review state (pending questions → questions, none → summary) while manual navigation persists via `manualStep`. The executable templates still cover 3×3 water/path autotiles, a truthful 9×9 water atlas of nine 3×3 source blocks, arbitrary desk/tree source rectangles, and a 2×3 repeatable cliff.

- Terminology is unified across the stepper, header, atlas filters/legend/tooltips, and buttons: **확정 · 적용 대기 / 확인 필요 / 낮은 확신**. The apply button lives only on the summary step; on the questions step the footer shows **3단계로 →** and the last question's finish card offers an inline goto-summary CTA.

- Analysis, dialogue, and staged confirmations are strictly detached from the project. Only the summary step's **확정된 N개 적용** action writes, using one project snapshot/store update while preserving user groups and `tileMetaLocked` cells. Closing the modal discards no persisted human knowledge and never auto-applies AI guesses.

- The native response contract requires unique, in-range tile IDs in strictly ascending order so `cellLayers[index]` always stays paired with `tileIds[index]`. The stale-analysis fingerprint includes atlas geometry (`tileSize`, `tilesPerRow`, and `count`) as well as current metadata, groups, passage, and priority; changing any of them forces a new analysis before apply.

- Proposal validation is fail-closed: one invalid, duplicate, or out-of-range tile id rejects the whole candidate instead of silently repairing it into a different shape. Batch acceptance sorts by confidence and accepts only the strongest candidate when AI proposals overlap. `placementTools.ts` consumes a confirmed nine-block `water-atlas-9x9` as one real 9×9 lower-layer footprint, so that knowledge is executable rather than persistence-only metadata.

- `approvedVocabulary`, the system prompt digest, and `tile_query ask:"vocab"|"labels"` expose human labels plus operational `layerHome`, pattern kind, source/block size, directional passage, description, and placement rules. They intentionally do not expose the private group id as the material users or the model should type.

## 저장 · 내보내기 · 프로젝트 생성

- Save/import/export flows are centered in `src/editor/saveActions.ts` and the store/persistence layer in `src/project/store.ts`; check adjacent editor actions if a UI button needs to trigger them.

- `게임 > ?대낫?닿린...` is the web-player export path. It calls `createWebPlayerExportPackage()` to serialize the current project as `project.json`, prune event drafts and unused uploaded assets, collect runtime public assets, include the prebuilt `dist/export-player` bundle, and download one ZIP without adding JSZip. The headless read tool `check_export_readiness {}` uses the same preparation path and returns map count, asset count, estimated JSON bytes, and a genuinely computed shape-roundtrip status. It produces **no file** — `data.producedFile` is always `false`, and its summary says so, because the old name `export_game` led the model to report 「배포 번들 생성을 완료했습니다」 when nothing had been written (2026-09-17). `export_game` still executes under the old name but is marked deprecated and dropped from the catalog.

- Project menu creation flows distinguish blank authoring from sample content: `???꾨줈?앺듃` clears to `createBlankProject()`, while `?덉젣濡??쒖옉` loads `createSampleAdventureProject()` (?딆씠??마을??醫끹?editor-export fixture). Keep that separation when adding project-start entry points.

## 제공자 · OAuth · 동반 서비스

- **Antigravity tool-result replay (2026-08-24):** `scripts/lib/ohMyPiPiAiRuntime.ts` must parse OpenAI-compatible `assistant.tool_calls[].function.arguments` JSON strings back into object values before handing the conversation to pi-ai. Gemini Cloud Code Assist requires `functionCall.args` to be a protobuf `Struct`; replaying the JSON string verbatim makes the second request fail with HTTP 400 after the first tool call succeeds. `test/ohMyPiComplete.bun.test.ts` covers the serialized follow-up request, and live verification must include both the structured tool-call round and the post-tool final-answer round.

- **Same-origin companion (2026-08-27):** 브라우저 LLM 엔드포인트는 항상 페이지 오리진의 `/v1` 이다. `127.0.0.1:17832` 은 oh-my-pi 단독 동반 서비스(`npm run ai:oauth`)가 **그 머신 루프백**에서 듣는 주소이지, 원격 preview 탭이 치면 안 된다. `vite.config.ts` `codexOAuthPlugin` 이 `configureServer` 와 `configurePreviewServer` 둘 다에 `/auth`·`/v1` 을 붙인다. `npm start`(mdc-server:9888 Tailscale) 는 같은 오리진으로 Gemini 완결을 보낸다.

- **원격 OAuth launch (2026-08-27):** Google Antigravity 는 데스크톱 클라라 `redirect_uri` 가 `http://127.0.0.1:PORT/oauth-callback` 만 통과한다. mdc-server 호스트를 callback 으로 넣으면 Google 이 `invalid_request` 로 거절한다. 그래서 `OPRN_PUBLIC_ORIGIN`(없으면 `Origin`/`Host`) 으로 **로그인 시작 URL만** `http://mdc-server:9888/oauth/launch?port=` 로 바꾸고, 돌아온 localhost 콜백 URL 은 `POST /auth/oauth-paste` 로 서버가 대신 GET 한다. Antigravity·Codex 브라우저 로그인은 `/launch` 가 아니라 Google/OpenAI 인가 URL을 바로 연다. 그 URL의 `redirect_uri`가 루프백 콜백이면 원격 origin에서 `pasteCallback`을 켠다. 편집기는 이 화면으로 돌아오면 클립보드의 localhost 주소를 읽어 버튼 없이 연결하고, 붙여넣기만 해도 바로 넘긴다. env 키는 `.env.local` 의 `OPRN_PUBLIC_ORIGIN`. `npm start` 는 값이 없으면 `http://mdc-server:9888` 로 고정한다.

- **AI 설정 모달은 레일+페인 구조다 (2026-09-16 리디자인):** 단일 스크롤 덤프를 `연결 | 모델 | 동작 | 표시` 좌측 레일(`ai-settings-rail` / `ai-settings-tab-*` / `ai-settings-pane-*`)과 우측 페인으로 나눴고, `extraSections`(대기 화면 등)은 레일의 자체 탭(`ai-settings-tab-extra-<id>`)으로 뜬다. 헤더 아래 `ai-settings-connection-summary` 한 줄이 현재 제공자·연결 상태를 말하고 `ai-settings-connection-check` 가 재조회다. **제공자 카드가 곧 선택+상태다** — 죽은 「연결 방식」(apiKey 카드)와 「빠른 선택+제공자 드롭다운」 3중 중복을 걷고, 카드 안에 브랜드 SVG(`src/editor/panels/aiProviderIcons.ts`, Google·OpenAI 마크 — `deckIcon` 선형 아이콘과 다른 fill 마크라 별도 모듈)·상태 필·로그인/연결 해제를 넣는다. `ai-oh-my-pi-provider` select 는 `hidden` 으로 남아 저장·change 소스 구실만 한다(fakeDom 은 `.hidden` 프로퍼티를 attribute 와 동기화하지 않으므로 테스트는 `getAttribute("hidden")` 로 본다). **모델 절**은 품질 프리셋 3장(`src/ai/modelPresets.ts`, `ai-model-preset-fast|balanced|quality`)이 역할 모델·추론을 한 번에 맞추고, 「역할별 모델 직접 지정」(`ai-settings-advanced`) disclosure 안 4행 표(`ai-settings-role-ultrabrain|vision|writer|deep`)가 개별 지정이다 — 모델 칸은 프리셋 셀렉트와 직접 입력을 **세로로 쌓는다**(나란히 두면 180px 칸에서 잘린다 — 실측 스크린샷 회귀). **동작 절**의 자율성 셀렉트는 파생값(`→ 추론 보통 · 자율 모드`)을 아래에 보여 덮어쓰기 관계를 노출하고, 역할 추론 옵션은 `끔/낮음/보통/높음` 한국어 라벨이다. **저장은 자동뿐이다** — `지금 저장`(`ai-config-save`)는 없고 푸터는 `ai-config-saved-hint`(`자동 저장됨 · HH:MM`)만 띄운다. 닫기 버튼은 **DOM 순서상 첫 포커스 대상**이어야 한다(헤더 상태 줄이 앞서면 첫 탭 정지가 틀어진다 — 시각 배치는 flex `order` 로 맞춘다). e2e 는 페인 안 컨트롤을 만지기 전에 해당 레일 탭을 먼저 눌러야 한다(표시→`ai-settings-tab-display`, 대기 화면→`ai-settings-tab-extra-temperature`, 동작→`ai-settings-tab-behavior`). Tests: `test/aiSettingsModalLayout.test.ts`, `test/aiSettingsModalNoBrowserKey.test.ts`, `test/aiAuthSettingsSeparation.test.ts`, `test/aiSettingsHistoryFocus.test.ts`, 갱신된 `test/e2e/ai-ui-audit-fixes.spec.ts`·`assistant-single-dock.spec.ts`·`assistant-clean-glass.spec.ts`·`assistant-glass-settings.spec.ts`. 증거: `verify-shots/ai-settings-redesign/real-*.png`.

- **OAuth 빠른 선택 (2026-08-24 / 기본 2026-08-25):** `aiAuthSettings.ts` 는 OAuth 모드에서 **ChatGPT(`openai-codex`) ↔ Google Gemini(`google-antigravity`) 두 카드**를 `role="radiogroup"` 퀵 선택으로 노출한다(테스트 `test/aiAuthSettingsSeparation.test.ts`). 공장 기본 제공자는 **`google-antigravity` + `gemini-3.7-flash`** 다(`DEFAULT_OH_MY_PI_PROVIDER`, `DEFAULT_MODEL`). 저장된 providerId·모델은 덮어쓰지 않는다. providerId 가 없는 옛 blob 은 Codex 시절 암시 기본이므로 `openai-codex` 로 남긴다. Gemini 퀵 카드는 Antigravity 로그인으로 라우팅한다(`google-gemini-cli` 는 레지스트리에서 사라졌다). 모델 목록에는 제공자와 무관한 GPT/Claude 항목을 섞지 않고 `gemini-3.7-flash`(빠른 기본)와 `gemini-3.1-pro`(품질 우선)만 먼저 보여준다. 이미 저장된 제공자·모델은 설정을 다시 열 때 덮어쓰지 않는다. 선택하면 providerId·select 값·aria 체크·onChange·상태 조회·기존 로그인 라우팅(`startChatGptLogin`) 을 전부 동기화한다. Gemini 카드는 구독·CLI를 암시하지 않고 `Google 계정으로 로그인합니다. 빠른 Gemini를 기본으로 사용합니다.`라고 안내한다. 드롭다운으로 다른 OAuth 제공자를 고르면 어느 카드도 체크되지 않되 첫 카드는 `tabindex=0` 을 유지해 키보드 사용자가 돌아올 수 있다. 제공자/종류 변경·취소는 내부 인증 연산 세대 카운터를 올려, 늦게 도착한 버전·상태·로그인 결과가 새 선택의 화면(연결 해제 크롬 포함)을 덮어쓰지 못하게 한다. API 키 제공자, 키 저장·연결 해제·폴링 최대 시도·오류(A/B) 의미는 그대로다. OAuth 는 언제나 로컬 oh-my-pi pi-ai 워커(`startChatGptLogin`)가 처리한다 — 비밀은 브라우저에 남지 않는다.

- **Google OAuth 자격 완전성 (2026-08-24):** Antigravity/Gemini CLI 자격은 access/refresh 토큰뿐 아니라 Cloud Code Assist `projectId`까지 있어야 실제 요청이 가능하다. `publicProviderStatus`(`scripts/lib/aiAuthRuntime.ts`)는 이 두 제공자의 오래된 불완전 자격을 `connected:false`로 내려 UI가 `연결됨`/`다시 확인`을 거짓 표시하지 않고 새 로그인을 시작하게 한다. 요청용 자격을 만들 때도 `projectId`와 OAuth 계정 메타데이터를 보존해야 한다. 토큰 세 필드만 복사한 뒤 갱신 결과를 저장본 위에 병합하지 않고 통째로 덮어쓰면 첫 completion이 방금 로그인한 `projectId`를 지워 다음 호출까지 망가뜨린다. 회귀 테스트: `test/ohMyPiComplete.bun.test.ts`의 projectId 없음/있음 상태 경계와 completion 후 보존 경계.

- **환경 변수 키는 동의 후에만 (2026-09-24):** 동반 서비스는 `envScan` 이 `allow` 일 때만 제공자 `envVars` 를 읽고 요청에도 그 키를 쓴다. 기본은 `ask`. AI 연결 패널이 찾아볼지 묻고, `POST /auth/env-scan` 이 `allow`/`deny` 를 `~/.oprn/oh-my-pi-auth.json` 에 남긴다. 환경 변수로 연결된 상태에는 연결 해제 버튼을 붙이지 않는다.
- **영역 작업 인증 게이트:** 영역 작업(`runRegionTask`)·AI 채팅은 LLM 호출을 하므로 OAuth/apiKey 가 미연동이면 401 `LlmError` 로 실패한다. 일상적인 설정 진입점은 하단 상태바가 아니라 편집기 헤더의 **AI 설정**(`topbar-ai-settings`)이다. `getAiConnectionStatus`와 `aiConnectionStatus.ts`는 상태 평가/단위 계약을 위해 남아 있다. `defaultAiConfig()`는 env `VITE_LLM_API_URL`이 있으면 apiKey 모드를 유지하고, env가 없으면 chatgpt OAuth가 기본이다. 단위 테스트: `test/aiConnectionStatus.test.ts`, `test/aiLlmClient.test.ts`, `test/aiChatPanelSettings.test.ts`.

- **제공자는 둘뿐이다 (자체 OAuth, 2026-08-27):** `src/ai/ohMyPiProviders.ts` 에는 `google-antigravity`(Gemini/agy, 기본) 와 `openai-codex` **두 행만** 있다 — 예전에는 omp 카탈로그의 69종을 베껴 뒀지만 로그인 경로가 붙은 것은 이 둘뿐이라 나머지는 고를 수 없는 죽은 UI 였다. id 문자열은 `src/ai/oauth/credentials.ts` 에서 가져오므로 전송과 UI 가 같은 상수를 본다. 설정은 `AiConfig.providerId` 로 저장되고 두 제공자 사이를 실제로 오갈 수 있다(`editorHasProviderChoice()` = true).

- **인증은 Node, 완성만 Bun (2026-08-27):** 동반 서비스(`vite.config.ts` 플러그인 + `scripts/chatgpt-oauth-companion.mjs`)가 `/auth/providers`, `/auth/status?provider=`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/v1/chat/completions`(헤더 `X-Oprn-Provider`) 를 노출한다. **로그인·갱신·상태·요청 자격은 `scripts/lib/aiAuthRuntime.ts` 가 순수 Node 에서 처리한다** — pi-ai 의 `getOAuthApiKey`/`getProviderDefinition`/`refreshOAuthToken` 의존은 없다. Bun 워커(`scripts/oh-my-pi-worker.ts`)는 `/complete` **하나만** 남았고 이미 해결된 `apiKey` 를 본문으로 받는다(자격을 들지 않는다). 실측: bun 이 PATH 에 없을 때 `/auth/providers` 와 `/auth/status` 가 **HTTP 200** 이다 — 예전에는 둘 다 HTTP 500 `bun 이 필요합니다` 였다. 모델 호출(completion)은 pi-ai 가 bun:sqlite 를 싣기 때문에 여전히 Bun 이 필요하다. 모르는 제공자 id 는 400 으로 닫는다. 비밀은 `~/.oprn/oh-my-pi-auth.json`(`OPRN_OH_MY_PI_AUTH_PATH`; 2026-09 개명 전 `~/.rpg-zzu` 파일은 첫 읽기에 한 번 복사되고 옛 파일은 남는다)에만 남고 브라우저로 가지 않는다. `/auth/key` 는 두 제공자가 모두 구독 로그인이라 400 으로 거절한다.

- **Codex 로그인은 브라우저 우선, device 는 대체 (2026-08-27):** `src/ai/oauth/codexBrowserOAuth.ts` 의 `beginCodexLogin` 이 경로를 고른다. **1455 를 잡으면** 루프백 PKCE 원클릭(`auth.openai.com/oauth/authorize`, `code_challenge_method=S256`, `id_token_add_organizations=true`, `codex_cli_simplified_flow=true`, `originator=codex_cli_rs`)으로 가고, **EADDRINUSE 면** device 코드 흐름으로 내려가며 그 이유를 `instructions` 로 사용자에게 말한다. 포트 점유가 아닌 실패(EACCES 등)는 device 로 숨기지 않고 그대로 올린다. `CODEX_BROWSER_REDIRECT_URI` = `http://localhost:1455/auth/callback` 은 **상수여야 한다** — OpenAI 허용목록에 이 값만 있어 임의 포트로 옮기면 인가는 통과하고 토큰 교환이 403 이 된다(omp 의 `loginOpenAICodex` 주석과 동일한 근거). 실측: 이 개발 머신은 1455 도 docker-proxy 가 잡고 있어 device 경로로 내려간다. 회귀 테스트 `test/codexBrowserOAuthFlow.test.ts`(9케이스: 인가 파라미터 전량, PKCE SHA-256/base64url, 경로 선택 3분기).

- **OAuth 와이어는 우리 코드다 (2026-08-27):** `src/ai/oauth/codexDeviceOAuth.ts` = ChatGPT device 흐름(`.../deviceauth/usercode` → 403/404 는 승인 대기 → `.../deviceauth/token` → `oauth/token`, 폴링 상한 120). `src/ai/oauth/antigravityOAuth.ts` = Google 인가 코드 흐름 + cloudcode-pa `v1internal:loadCodeAssist` 프로젝트 발견(daily → production 폴백) + `v1internal:onboardUser` 프로비저닝(최대 5회). `src/ai/oauth/credentials.ts` 의 `packRequestApiKey` 가 요청 시점 자격을 만든다: Antigravity 는 `token`+`projectId`+`refreshToken`+`expiresAt` JSON, Codex 는 access 토큰 문자열. **만료 자격과 projectId 없는 Antigravity 자격은 던진다** — 갱신 책임을 호출부로 되돌리는 안전핀이다. 라이브 확인: `npx vite-node --script scripts/verify-ported-oauth-live.mts`(기본은 부작용 없음, `--login`/`--refresh` 선택).

- **콜백 포트 정책은 제공자마다 다르다 (2026-08-27):** `scripts/lib/oauth/loopbackCallbackServer.mjs` 가 `node:http` 를 import 하는 유일한 파일이다. `startOAuthCallbackServer` 는 **먼저 바인드하고** 그 포트로 `redirectUri` 를 만든다. **Antigravity(Google)** 는 51121 을 선호하되 점유되면 임의 포트로 붙는다 — Google 은 루프백 포트를 고정하지 않는다(RFC 8252 §7.3). 실측: 이 개발 머신은 51121 을 docker-proxy 가 잡고 있어서, 포트를 고정하면 로그인이 백그라운드에서 EADDRINUSE 로 죽는데 화면에는 계속 "브라우저에서 로그인하세요"만 떠 있었다. **Codex** 는 반대로 `allowPortFallback:false` 로 열어 EADDRINUSE 를 그대로 올린다(허용목록 고정 포트라 대체 포트는 곧 403). 붙여넣기 경로(`/auth/oauth-paste`)는 두 콜백 경로 `/oauth-callback`(Antigravity)·`/auth/callback`(Codex)을 모두 받는다 — 하나만 받으면 원격 preview 에서 Codex 브라우저 로그인을 끝낼 수 없다. **루프백은 두 주소를 함께 듣는다**: `redirect_uri` 의 호스트명은 `localhost` 인데 실측 이 머신의 `getent hosts localhost` 는 `::1` 을 먼저 준다 — IPv4 만 듣고 있으면 브라우저가 `[::1]:PORT` 로 붙어 콜백이 영원히 도착하지 않는다. 그래서 127.0.0.1 과 ::1 을 같은 포트로 함께 바인드한다(`handle.hosts` 로 확인 가능). `0.0.0.0`/`::` 로 넓히지는 않는다 — LAN 의 아무나 인가 코드를 밀어넣을 수 있다. 회귀 테스트 `test/oauthLoopbackCallback.node.test.mjs`(11케이스: 폴백·폴백금지·IPv6 실연결·redirectUri 이름 연결) + `test/ohMyPiHttp.node.test.mjs`(붙여넣기 두 경로).

- **AI 그림 생성은 종류별 공용 필드 하나다 (2026-09-03, 2026-09-04 확장):** `aiImageGenerateField()`(`src/editor/panels/aiImageGenerateField.ts`)가 프롬프트 + 생성 버튼 한 쌍을 그리고, 종류별 접두사(faceset 초상 / title·backdrop 풍경 / monster 전신)를 붙여 같은 Antigravity 경로(`generateAiImage`)로 보낸 뒤 `insertGeneratedPictureAsset()`의 `kind` 파라미터로 저장한다. 붙는 자리: 「그림 표시」 폼(`showPictureAiField`, kind picture), 「얼굴 바꾸기」 폼 + 배우자 얼굴 행 + M2 주인공 얼굴(kind faceset), title 로고·배경 + backdrop 3곳(troop/terrain/parallax)은 `resourcePickerControl` 내장 AI 칸(kind title/backdrop), 적 그래픽 행(kind monster). 저장 kind 가 피커 매칭(`uploadedMatchesKind`)과 일치하므로 생성 그림이 해당 피커 목록에 바로 나온다. faceset 생성 id 에는 `-bust` 접미사가 붙어 `faceDisplayModeOf` 가 통짜 초상으로 본다. charset/battleCharset/chipset/parallax 타일링은 제외 — 시트 규격·타일 문법이 별개 과제다. 계약: `test/aiImageGenerateField.test.ts`, `test/generatedPictureAsset.test.ts`, `test/databaseResourcePickerDialog.test.ts`(AI 칸 유무), `test/eventEditorPresentation.test.ts`(얼굴 폼 칸).

- **AI 그림 생성은 큐 단위다 (2026-09-04):** 같은 필드가 내부에 `createImageGenerationQueue()`(`src/ai/imageGenerationQueue.ts`, FIFO·직렬 기본·취소/재시도/끝난 항목 지우기)를 들고, 버튼은 단발 요청 대신 작업을 쌓는다. 만드는 동안에도 프롬프트를 계속 추가할 수 있고, 실패한 작업은 에러 메시지와 함께 목록에 남으며 `다시 시도` 로 살린다. 완료 작업은 큐가 돌려준 dataUrl 을 `insertGeneratedPictureAsset()` 으로 등록한 뒤 기존 `onInserted` 로 넘기므로 호출부(적 그래픽 행·얼굴 폼·리소스 피커)는 그대로다. 스타일은 기존 폼 시트(`06-page-modern-forms.css` 의 `ai-image-queue-*`)에 얹는다 — 새 시트는 CSS 파일 수 래칫에 걸린다. 계약: `test/imageGenerationQueue.test.ts`(상태 기계 8건), `test/aiImageGenerateQueue.test.ts`(UI 6건).

- **AI 그림 생성은 showPicture 폼에서 끝난다 (2026-09-03, 위 공용 필드로 통합):** 「그림 표시」 폼의 `AI로 만들기`(`src/editor/panels/eventEditor/showPictureAiField.ts`)가 `generateAiImage()`(`src/ai/imageGenerationClient.ts`, 요청 모델 `gemini-3.8-flash` — 대화 제공자와 무관한 Antigravity 고정 경로, 상세는 `editor-ai-tools.md` 「이미지 생성은 Antigravity 한 경로뿐이다」)로 그림을 만들고 `insertGeneratedPictureAsset()`(`src/editor/generatedPictureAsset.ts`)으로 `project.assets.uploaded`(`kind: "picture"` + resourceProfile)에 심은 뒤 그 id 를 커맨드 `resourceId` 에 넣는다. 빈 프롬프트는 요청하지 않고, 401 은 인증 안내를 그대로 올린다. 계약: `test/showPictureForm.test.ts`, `test/generatedPictureAsset.test.ts`, `test/imageGenerationClient.test.ts`.

## Autonomous run mode (autonomous-ai-rpg, todos 1-6)

- **agentMode config:** `AiConfig.agentMode: "auto" | "chat"` (`src/ai/llmClient.ts:48`), default `"auto"` (:131). `loadAiConfig()` backfills `"auto"` for blobs saved before the field existed (:197-199). `orchestrationEnabled()` (`src/ai/assistantSession.ts:1508`) returns true for `"auto"` regardless of the model split, so the planner round runs even with a single model; `"chat"` (and legacy injected configs) keep the old `model !== liteModel` behavior. The settings modal exposes the toggle (`src/editor/panels/aiSettingsModal.ts:168-184,245`).

- **Cross-turn auto-continue:** the panel enters the session with `sendUserMessage(text, onEvent, signal, { autonomous: loadAiConfig().agentMode === "auto" })` (`src/editor/panels/aiChatPanel.ts:716-717`); `opts.autonomous` is the only switch that arms the driver and milestone auto-apply (`assistantSession.ts:769,773`). After each turn the driver keeps sending while the plan exists and is incomplete **or the volume contract is unmet**, budget remains, no user message is queued, no milestone is paused by an apply failure, and the turn did not end in a user question — Ralph (`shouldRalphContinue`) plus `volumeUnmet` (`src/ai/volumeContract.ts`). The driver’s synthetic 「계속」 is harness code, not a user prompt. Village/RPG `planner:direct` is rejected and replaced with `buildVolumeWorkPlan`. When the goal ends, `runRecap` writes token/time/process to the audit + activity log and the chat shows only `토큰 입력 N · 출력 M · Ss` (`ai-run-recap`).

- **진행이 멈춘 항목은 사람에게 넘긴다 — 무한 재주입 금지 (2026-09-03):** 실측 결함: 빈 맵에서 `fill_region` 이 스펙 게이트에 막히자 Ralph 가 **같은 항목을 173/256번** 재주입했다. 사용자에게는 `Ralph 연속 실행 (173/256)` 한 줄만 보이고 런은 끝나지 않았다. 계약 넷을 넣었다.
  - **항목별 연속 시도 상한** `MAX_RALPH_ATTEMPTS_PER_ITEM = 3` (`src/ai/workPlan.ts`). Ralph 는 모델이 **나가려 할 때만** 도므로, 같은 항목에서 3번 연속 헛되이 나가려 했다는 것은 「모델은 끝났다고 믿고 하네스는 아니라고 한다」는 교착이다. 4번째에 `blockStalledWorkItem`(`assistantSession.ts`)이 항목을 `blocked` 로 표시하고(사유는 마지막 자동완료 차단 사유 = 산출물 게이트·완성도 경고·스펙 게이트) 턴을 **끝낸다** — 감사 `ralph:stalled item=… attempts=3/3`. 응답은 무엇이 막혔고 무엇을 하면 되는지 말한다(「건너뛰기」 안내 포함).
  - **Ralph는 연속 판정이다 — 누적이 아니다.** `recordSuccessfulTool` 은 그 항목에서 쓰기가 성공하면 Ralph 시도 수를 0으로 되돌린다. 여러 턴에 걸쳐 정상 진행하는 큰 항목은 막히지 않는다(드라이버 예산 48턴 테스트가 이 성질에 의존한다).
  - **막힌 항목에서는 아무도 밀지 않는다.** `shouldRalphContinue` 가 `blocked` 를 보면 false → 툴 루프 재주입도, 드라이버 자동 계속도 멈춘다. `currentItemId` 는 막힌 항목에 **그대로 남는다**(다음 항목으로 조용히 넘어가면 같은 전제 위에서 또 실패한다).
  - **되살리는 것은 사용자다.** 사용자의 다음 메시지(직접 친 「계속」 포함)가 `reactivateBlockedWorkItems` 로 막힌 항목을 `pending` 으로 돌리고 시도 수를 리셋한다(감사 `work-item:reactivated N건`). 드라이버의 합성 「계속」은 `SessionTurnOptions.driverContinue` 로 구분돼 이 리셋을 받지 못한다 — 그래야 런이 실제로 멈춘다.
  - **두 번째 교착 모양: 같은 실패의 반복.** Ralph 는 「모델이 나가려 한다」를 신호로 쓰는데, 같은 쓰기 툴을 **같은 이유로 계속 실패**하는 모델은 나가려 하지 않으므로 그 신호가 오지 않는다(e2e 실측: 스펙 게이트에 막힌 `fill_region` 을 대본이 주는 대로 30번 반복했고 Ralph 는 한 번도 안 돌았다). `MAX_REPEATED_TOOL_FAILURES_PER_ITEM = 4` — 2026-09-06부터 항목/툴/대상(mapId + 명시 id, 없으면 name)/오류 issue code별로 누적한다. 요약·잘못 쓴 명령 이름·페이지 경로는 키가 아니므로 `changeItems`→`item`→`gainItem`으로 바꿔도 상한을 피하지 못한다. 다른 대상의 성공은 실패 횟수를 지우지 않는다. 같은 대상의 성공은 해당 대상만 초기화하고, 실제 사용자 메시지는 전체 재시도 예산을 초기화한다. 합성 계속은 예산을 보존한다. 같은 응답 안에서도 상한 이후 대상 호출은 실행하지 않고, 응답을 모두 짝지은 뒤 항목을 blocked로 끝낸다(감사 `tool-failure:stalled`).
  - **종속 호출 보류(2026-09-06):** 응답 배치마다 실패한 밑그림의 mapId를 기록해 그 맵의 후속 공간 쓰기만 보류한다(이전 활성 밑그림이 있어도 동일). 다른 맵/읽기/비종속 쓰기는 계속하고, 같은 배치 또는 다음 배치의 성공한 밑그림 재제출은 시공을 다시 연다. 실패한 DB 생성은 `ToolReadEvidence`와 같은 6종 item/enemy/troop/actor/skill/equipment의 명시 ID 참조만 연결한다. 문장으로 의존성을 추측하거나 DAG를 만들지 않는다. 기존 조회 계약은 그대로라 생성 성공도 조회 근거가 아니고, 읽기 실패 뒤 같은 응답의 쓰기 전체를 보류하는 규칙도 유지한다.
  - **보류는 실행 실패가 아니다:** 툴 응답은 `ok:false`, `data:{code:"tool-deferred",executed:false,reason}`이고 issue code는 `build-spec-dependency-failed` / `record-dependency-failed` / `read-dependency-failed` / `read-before-write-required` / `tool-retry-exhausted`다. 성공 도구/제안/실제 실행 실패 통계에 넣지 않는다. 단, 모델이 필요한 조회를 하지 않고 같은 대상을 다시 요청한 `read-before-write-required`는 교정 가능한 거절 시도로 재시도 예산을 소비한다. 실패한 선행 호출 뒤 같은 배치의 종속 보류(`*-dependency-failed`)는 종속 대상의 독립 예산을 소비하지 않는다. 감사의 `deferred`·`issueCodes`와 recap의 `deferredToolCalls`(직렬화 `toolDeferred`)로 구분하며 `toolFailures`는 보류를 제외한다. 원래 toolCalls는 요청된 호출 수를 유지한다. 회귀: `test/assistantDependencyRetry.test.ts`, 기존 `test/aiWorkItemStall.test.ts`, `test/assistantReadContract.test.ts`.
  - **UI**: `renderWorkPlanChecklist` 가 `data-blocked="true"` 를 세우고 앞줄이 `막힘 — <항목>` 을 먼저 말하며(빨강), 막힌 항목 아래에 사유 줄(`ai-work-item-blocked-note`)이 붙는다.
  - Tests: `test/aiWorkItemStall.test.ts`(Ralph 교착→blocked·반복 실패→blocked·드라이버 정지·사용자 되살림·쓰기 리셋·이름 어긋난 완료), `test/workPlan.test.ts`, `test/aiChatLeanUi.test.ts`(막힘 렌더), `test/e2e/ai-composer-mode.spec.ts` 「지시 모드(교착)」. 증거: `verify-shots/ai-composer-mode/do-mode-blocked-item.png`.
- **명시 완료는 툴 이름이 아니라 산출물로 판정할 수 있다 (2026-09-03):** `successTools` 이름 매칭은 대리 지표다 — 플래너가 `fill_region` 을 적고 모델이 `paint_tiles` 로 같은 일을 하면 이름 매칭은 영원히 통과하지 못하고 항목이 굳는다. 이제 `canCompleteWorkItem(..., { allowWriteEvidenceFallback: true })` 는 「성공한 쓰기 툴 1개 이상 + 산출물 게이트 통과」를 근거로 완료를 인정하고 감사에 `work-item:complete-by-write-evidence <누락 툴>` 을 남긴다. **자동** 완료(`advanceWorkPlanFromTools`)는 종전대로 엄격하다 — 이 우회는 모델이 `complete_work_item` 을 **명시 호출**한 경로에만 열린다. 실제 검사는 산출물 게이트(맵이 채워졌나·대상 맵이 바뀌었나·퀘스트가 완주되나)가 계속 맡는다.
- **합성 이어가기 옵션 (2026-09-05):** `scope`·`composerMode`는 유지하되 `instruction`은 합성 발화 `계속`으로 바꾼다. 원래 생성 지시를 다시 선언하면 이어가기의 볼륨 계약이 해제된다. `aiMilestoneTurnAccounting.test.ts`는 명시적 원문 옵션과 자동 계속을 함께 검증한다.
- **드라이버의 합성 「계속」은 플래너 왕복을 태우지 않는다 (2026-09-03):** 계획이 그대로이고 막힌 항목이 없으면 플래너의 결정은 자명하게 `resume` 이다. 그 턴은 `planner:skip driver-continue` 로 main 모델 콜을 건너뛰고, `planner:resume` 이 하던 일(`emitWorkPlan` + `injectWorkPlanOrchestration`)만 코드가 직접 한다 — 런당 최대 48콜이 사라진다. **계획 툴은 그대로 노출한다**(`skipPlannerRoundOnly` 는 `skipPlannerThisTurn` 과 다른 플래그다 — 후자는 계획 툴까지 숨기므로 드라이버 턴에 쓰면 모델이 `complete_work_item` 을 못 불러 교착이 늘어난다). 사용자가 직접 친 「계속」은 사용자 턴이므로 플래너가 정상적으로 `replan` 할 수 있다.
- **볼륨 재주입 상한 8 → 3 (2026-09-03):** `MAX_VOLUME_CONTINUES_PER_TURN`(`src/ai/volumeContract.ts`). 드라이버가 턴을 다시 여는 상한(48)이 따로 있어 런 전체의 볼륨 압박은 그대로다. 한 턴에서 8번을 다 쓰면 사용자는 그만큼 오래 아무 갱신도 못 보고 기다리고 중단도 늦게 닿는다.

- **Budget:** `AGENT_RUN_MAX_TOTAL_STEPS = 48` total auto-continued turns per goal (`src/ai/assistantSession.ts:389`). Each manual `sendUserMessage` entry re-arms the counter (:788). Exhaustion emits the `agent_run_budget_exhausted` audit + status event and stops; one "계속" message resumes the run.

- **Budget notice boundary (2026-09-09):** `TOKEN_BUDGET_STATUS_TEXT` is emitted by `finishRunRecap` once when the final result stops for `token-budget` or `max-tool-calls`. Intermediate automatically continued turns retain their audit entries but do not repeat the user-facing notice. Regression: `test/aiAssistantSession.test.ts`.

- **User precedence:** the driver receives a peek-only `peekPendingUserMessage` hook wired to the panel's `pendingSends` queue (`aiChatPanel.ts:381,512`). If the queue holds a message the driver pauses and never dequeues — the panel's existing drain loop delivers it; the run resumes on a later turn if the plan is still incomplete. Abort (`signal`) always stops the driver.

- **Milestone auto-apply:** in autonomous runs a completed work item is applied through the shared `applyProposedProject` (`src/editor/tools/applyChangesetToStore.ts:164`) — `getProposedProject()` → `commitChangeset` validation → undo snapshot (`recordProjectSnapshot`) → `store.replace` → awaited `recordProjectCommit`; the proposal snapshot is applied, tools are NOT re-executed (no auto-generated-id divergence). There is no approval classification any more: every completed milestone with writes is applied. A commit-gate rejection is an apply failure, not an approval wait: it emits the compatibility event `proposal_paused`, logs `agent_run:milestone-apply-failed`, states that the project store was not changed, and stops only the current autonomous run. `sendUserMessage` clears that per-turn failure state so the next user request can author and apply again; successful `rebaseProject` clears it too. Completeness warnings no longer pause; they are logged.
- **Verification is advisory (2026-08-30):** each completed layer still runs `src/ai/agentVerification.ts` canonical calls (map/world → `run_lint` + `evaluate_game_quality`; quest/story → `run_lint` + `verify_quest` with the run's most recent authored questId; final → `run_lint` + `play_walkthrough` with the layer's own authored scenario, falling back to `verify_quest` × all questIds), but the verdict only produces audit rows: `agent_run:verification-pass` when clean, `agent_run:verification-advisory` + `agent_run:verification-note` when blocking issues exist. A layer is checked **once** (`markLayerVerified`). There is no retry budget, no repair re-kick and no `verification_failed` stop — `MAX_REPAIR_REKICKS`/`MAX_VERIFICATION_ATTEMPTS`/`STOP_REASON`/`evaluateRetry` were deleted. 근거(실측 2026-08-30): 부팅 정규화기가 넣은 선재 참조 위반 54건이 매 시도 동일하게 잡혀, 에이전트가 만들지도 않았고 고칠 수도 없는 손상으로 3회 예산을 태우고 217초에 런이 죽었다 — 48턴 예산은 손도 대지 못했다. `evaluate_game_quality` reports blocking on its own error-severity 객관 이슈뿐이다 — 이 글을 쓸 때는 projectLint 오류가 전부였으나 이후 빈 맵(`99081a0b1`, 2026-08-28)과 미호출 엔딩(`419e067fa`, 2026-09-06)이 error 로 합류했다. 패널 라벨과 요약도 「완성도 평가 / 게임 품질 평가 통과」 대신 「무결성 점검(참조·빈 맵·미호출 엔딩)」으로 적는다: 이 툴은 재미·독창성·페이싱을 채점하지 않고 게이트도 아니라, "통과" 라는 말이 없는 판정을 있는 것처럼 읽히게 했다.
- **P1 accepted-revision proof (2026-09-06):** `AssistantSession.proveAppliedRevision(onEvent?, signal?)` calls `store.flush()` and requires its actual `saved.receipt`, then awaits `store.verifyPersistedRevision(receipt, { signal })`. It never calls `reloadFromRemote()` or queries the newest commit. Autonomous completion uses this path after a complete plan with no pending writes or apply failure; `aiTurnRunner` also uses it after an ordinary proposal is actually applied. Existing auto-apply, undo, separate region approval, ask/plan/resume and explicit/advisory verification policies remain unchanged.
  - `RunEndProofState` carries `status: attempted | failed | succeeded`, `verified`, optional `receipt`, `proof`, `reason` and correlated `commitId`. Read it through `getRunEndProof()`, `getHarnessSnapshot().runEndProof`, or the `persistence_proof` event. The getters recheck currentness: a historical `succeeded` state can have `verified:false` after a newer edit. A matching read overtaken by an edit is session `failed/stale`, while its embedded store proof remains `kind:verified, isCurrent:false`. Proof doesn't replace the live editor or roll back changes.
  - Failed, cancelled, disabled, missing-receipt, target/content-mismatch and stale results cannot emit `agent_run_saved`. That audit sentinel includes project id, accepted revision, normalized content identity, optional wire hash and optional commit id only after a current matching proof. Each proof attempt owns only its last published state object. Identity checks after proof callbacks and awaits, including the catch path, stop a superseded attempt from replacing newer proof state or publishing its own saved sentinel. The succeeded `persistence_proof` callback runs before the sentinel: a callback edit or abort blocks it, and a reentrant attempt that publishes new state takes publication ownership. The final success `status` callback runs after the sentinel; an edit there makes the returned projection `verified:false` without retracting the historical sentinel. P1 owns proof publication; P3 adds the client-local run retirement boundary described above without replacing that authority. Plan completion and storage proof are separate facts, not a new whole-goal completion verdict.
  - A successful current proof avoids another read. Failures remain retryable for the same accepted receipt; explicit `retryLastTurn()` can retry proof without replaying LLM/tools when no draft writes remain, except ask/plan-only turns. `canRetryLastTurn()` still means an LLM-error retry is available, not a new persistence retry button. The real editor evidence uses existing composer continuation.
  - Commit metadata comes only from the actual apply result. `store.replace()` captures and returns the applied project before synchronous mutation subscribers run; `replaceProject()` forwards that return. `applyChangesetToStore.ts` uses this return as `commitProject`, not a later `getCurrent()` read after subscribers or the awaited commit log. The session associates its `commitId` only if that object still matches the current store and the receipt is current at flush consumption. Subscriber edits therefore can't borrow the earlier apply's commit id. Commit-log `persisted:false` isn't project-save failure, and proof can succeed without a commit id.
  - Sources: [session](../src/ai/assistantSession.ts), [apply adapter](../src/editor/tools/applyChangesetToStore.ts), [proposal adapter](../src/editor/panels/aiProposalCard.ts), [turn runner](../src/editor/panels/aiTurnRunner.ts). See the [store contract](runtime-project-schema.md#p1-accepted-save-receipts-and-read-only-proof-2026-09-06) and [P1 evidence report](../output/evidence/ai-harness/p1/README.md) for exact commands, failure evidence and limits.

- **Panel surface (superseded 2026-09-03 — see 「할 일 목록은 계획 수명이다」 in the shell section):** the run whisper — one status line (`ai-run-status`), the `done/total` count (`ai-autonomous-progress`), a thin progress bar (`ai-run-progress`), and `중지` (`ai-run-stop`, wired to `abortActiveTurn`) — sits on top of an **always-visible item checklist** (`ai-work-list`); only the `⚡ 자율 실행 중` chip, budget (`예산 N/48`), goal and milestone feed live behind `자세히` (`ai-run-details`). The list is not torn down at run end: it stays with `data-active="false"` (`모두 완료` or `<item> — 대기 중`) until the next plan or a conversation boundary. Panel auto-collapse (`AUTO_COLLAPSE_AFTER_AI_MS`) is disabled while `active`.

- **MCP bridge unchanged:** `src/editor/aiAssistantBridge.ts` still long-polls `127.0.0.1:17831` and drives the same `sendUserMessage` entrypoint — `assistant_send` messages land in `pendingSends` between turns, the peek hook sees them, and the driver yields; no bridge code changed.

- **Demo evidence:** the todo-8 autonomous JRPG run evidence lives at `.omo/evidence/autonomous-ai-rpg/task-8-autonomous-ai-rpg.md` — *not yet present as of this sync (todo 8 still running in parallel); the link is added once it lands.*


## 분리 브랜치 마일스톤 회계 복구 (2026-09-05)

`TurnResult.appliedCalls`는 같은 사용자 목표에서 이미 저장한 마일스톤 호출이며, `proposedCalls`와 함께 완료 집계에만 사용한다. 재적용에는 `proposedCalls`만 사용한다. 드라이버의 합성 계속은 원장을 보존하고 새 사용자 메시지만 초기화한다. recap·질문 모드·맵별 밑그림 표시를 유지하며 수동 재시도에도 원래 composer 옵션을 전달한다. 질문 중 미완료 계획은 자동 재개하지 않는다. 계약: `aiMilestoneTurnAccounting`, `aiAskPendingPlan`, `aiComposerModeSession`.

완료 회계 보강(2026-09-06): `autoCompleteGate`의 밑그림 완성도 검사는 최종 검수와 동일하게 `turnWriteLedger(applied + pending)`를 사용한다. 첫 마일스톤 적용이 pending을 비워도 다음 항목은 이미 칠한 영역을 미이행으로 다시 요구하지 않는다. 적용 루프는 계속 pending만 소비하므로 앞선 쓰기를 재적용하지 않는다.

P7 preserved-wall accounting (2026-09-08): `proposalCompleteness` separately verifies
already-satisfied `paint_tiles(mode:"cells")` maintenance for rectangular `terrain`
assets with an explicit layer. Session automatic completion/review and `aiTurnRunner`
supply the host's current tool-applied project (including pending drafts and applied
milestones). A native successful zero-diff operation needs a non-skipped touch receipt,
exact requested cells, and matching current tile content covering every asset cell.
The painter freezes `data.effectiveLayer` with its native touch metrics at execution;
completeness consumes that historical layer, never current `tileLayerHome` metadata,
the requested layer alone, or summary prose. Later `set_tile_rules` cannot move coverage:
an upper-home paint requested lower remains upper coverage after a lower-home metadata
edit with zero cell changes, even when both layers contain the same tile numbers.
Validated changed `cells` operations for the same maintenance tile and executed asset
layer may contribute exact currently matching cells. Thus a one-cell no-op does not
veto a later full twelve-cell repair with eleven real changes. Missing/partial/wrong/
skipped/failed/stale evidence stays a warning; a changed rectangle or different tile
cannot hide invalidated maintenance. `cells` never borrows its optional `from/to`
bounding box, including in ordinary changed-region accounting.
No prose, asset style, or overwrite policy grants preservation authority. This only
satisfies spatial placement coverage: meaningful diffs, new quantity, canonical
`targetChange`, scene verification, acceptance and delivery remain separate. Other
asset kinds and paint modes retain existing behavior. P7's independent blocked result
and original scene evidence are unchanged. Contracts: `proposalCompleteness`,
`aiCompletionAccounting`, `aiTurnAppliedAccounting`; fixtures use native paint with
80 changed floor cells and 24 unchanged wall cells, not live game content.

공간 게이트는 확장을 준비만 하고, `runTool`이 `ok:true`를 반환한 뒤 `commitExpansion`으로 반영한다. 인자 거절·맵 밖 좌표·실행 예외는 밑그림에 유령 `auto:*` 에셋을 남기지 않는다. 성공한 확장의 경고는 유지되며, 명시 스펙은 턴 간 유지하고 선택 영역 암묵 스펙은 해당 턴에만 유지한다. 회귀: `test/aiCompletionAccounting.test.ts`는 실제 세션·툴 실행·마일스톤 저장소 적용과 실패 후 재시도/다음 턴 수명을 검사한다.

## 배치 의존성과 완료 멱등성 (2026-09-06)

같은 응답에서 밑그림이 거절되면 그 맵의 공간 도구뿐 아니라 `place_props` 등 타일 쓰기도 보류한다. 다른 맵과 독립 조회는 계속 실행하고, 실패한 밑그림이 없는 평상시 v3 도구의 자유 배치 계약은 유지한다.

교정되지 않은 쓰기 실패가 남은 배치의 `complete_work_item`은 `work-dependency-failed`로 보류된다. 같은 대상의 성공한 교정은 이 보류를 해소한다. 이미 성공·검증한 상태를 바꾸지 못한 거절된 재시도는 같은 배치의 기존 성공 근거를 지우지 않는다.

모든 항목이 실제 `done`이고 보상·모험·검수 근거도 충족되었다면, itemId 없는 재완료는 `alreadyComplete:true`로 확인만 하고 마일스톤을 재적용하지 않는다. 없는 계획, 알 수 없는 명시 ID, 건너뛴 항목, 미통과 검수는 이 경로로 통과할 수 없다. 회귀: `assistantBatchCompletion`, `assistantDependencyRetry`, `assistantVerificationEvidence`.

## 모험 완료와 실제 적용 횟수 (2026-09-05)

모험 저작 의도 선언이 있을 때 세션은 최종 응답 전 구조적 플레이 연결과 마지막 시각 조회를 확인한다. 계획 3/3 또는 lint 0만으로 완료 응답을 허용하지 않는다. 부족하면 보완 지시를 주고, 남으면 미완성 항목을 최종 응답으로 표시한다. run recap writes는 아직 적용하지 않은 제안과 이미 적용한 마일스톤 호출을 함께 센다.


## Assistant clean conversation — Phase 1 (2026-09-06)

This contract supersedes the older applied-only blueprint retirement, idle checklist retention,
and assistant suggestion-row/chip descriptions above. Glass, opacity and icon styling are unchanged.

- `aiTurnRunner` settles progress by actual writes exactly as before, then retires temporary
  blueprint presentation in the owner-only `finally` for success, no-write, rejection, error,
  abort and thrown endings. Sync the retained active spec before retirement so internally
  auto-expanded shapes cannot reappear on the next turn. `BuildSpec`, audit and applied-call
  accounting are not cleared or falsely completed. An orphan cannot clean a replacement turn.
- Ghost cleanup returns the shared preview surface to `getPendingRegionApply()` when present:
  install that draft's map provider before publishing its project diff. Preview subscribers
  synchronously compose and cache tile neighborhoods, so reversing these calls uses stale terrain.
  Same-project new chat/history restore preserves the independent region. An actual project
  identity change synchronously discards the outgoing region before asynchronous history lookup;
  a new project's draft registered during that lookup survives later adoption.
- `settleWorkPlanTurn` removes the live checklist/feed and closes its live book; session plan
  and audit history survive. Inactive plans do not remount through refresh or studio entry.
  Every accepted `executeTurn`, including manual retry, initializes live plan ownership from
  the retained plan and original run options. When removal takes the focused book/checklist,
  focus returns to the composer; another control or error dialog keeps its focus.
- Composer focus/idle/new-chat and studio briefing no longer produce director/example promotions.
  Explicit `[선택지]` content remains in live and restored transcript text, without promoted
  quick-reply buttons; pending-question engagement is still tracked. Retry, settings, tool
  actions, undo and history remain. Database presets and their authoring tools are unrelated.
- Regression seams: `aiAssistantTurnCleanup` (owner terminal matrix, pending region ghost,
  automatic expansion and orphan protection), `aiAutonomousRunSurface`, `aiPanelChrome`,
  `aiStudioShell`, `aiConversationLog`, `aiTurnAppliedAccounting`. Async tests await the exact
  held-state/terminal signal, never fixed sleeps or arbitrary microtask counts.
- Review regressions: `aiRegionPreviewHandoff`, `aiRegionChatBoundary`,
  `aiRetryWorkPlanLifecycle`, `aiWorkPlanTerminalFocus`. Real-editor coverage:
  `test/e2e/assistant-clean-glass.spec.ts` and `test/e2e/ai-composer-mode.spec.ts`.
- `agentBlueprintTurnEnd` retains actual-write assertions with updated retirement expectations
  and event-driven completion. Its existing SSE response fixture is incompatible with the
  default non-streaming provider request; lead reproduced 6 failures / 1 pass on unchanged
  `e07cd4f8`. That production transport is deliberately not changed by this phase.

## Assistant deck width resize (2026-09-07)

Live drag and `prefers-reduced-motion` must not leave `transition: width` active on the open
`.ai-deck` rule. The open-deck selector is more specific than a bare
`.ai-chat-panel.chat-dock-float .ai-deck` reduced-motion override, so the animation used to
keep running and `getBoundingClientRect()` lagged the committed `--ai-float-bar-width`
(Firefox F10: expected +88px, observed ~10–80px short). Fix: match open-deck specificity for
`transition: none` under reduced motion, add `.is-resizing` (no transition while dragging),
and seed pointer gestures / ARIA from the **viewport-clamped effective width** (preferred `barSize` stays in storage across viewport-only shrinks).
Contracts: `test/aiPanelGlassResize.test.ts`, `test/aiDeckResizeTransitionCss.test.ts`,
e2e `ai-ui-audit-fixes` F10.

### Legacy AI contract verification (2026-09-08)

- Image-field tests mount real DOM before enqueueing. Detached fields deliberately unsubscribe;
  changing the production `isConnected` guard to accommodate detached fixtures breaks record isolation.
  Queue transitions and `onInserted` callbacks are completion signals, including store re-entry.
- `whenAiChatPanelSettled()` drains conversation persistence/restoration, not an active chat turn.
  Tests subscribe to the terminal chat audit receipt before sending, then drain persistence.
  Region tests observe the running-state removal before inspecting their final receipt.
- HTTP fixtures distinguish no-tool intent JSON requests from streaming tool requests using
  parsed `tools`/`stream` fields. A blanket SSE response corrupts the intent/planner phase.
  Retry tests observe registration of each actual backoff timer before advancing virtual time.
- Current idle context pins stay visible. Keyboard guidance is an input title, not a separate
  layout row; removed suggestion chips are not a composer-readiness contract.
- `script_cutscene` replaces its named cutscene page by default; callers that test added-page
  placement must explicitly pass `mode: "append"`. Reuse checks retain event identity/location
  and verify replacement commands. Targeted mutations prove these updated contracts detect regressions.
- World bridge/mountain tools map explicitly to world activity narration. Region generator
  controls consume existing surface/accent/on-accent/danger tokens without literal-color fallbacks.
- Lane receipts: `output/evidence/event-command-completion/legacy-ai/`. Browser QA uses an owned
  strict-port 21050 server and private loopback namespace to avoid host network-change failures;
  remote writes are intercepted and the disposable database edit is discarded through its real UI.

## 의도 선언과 커버리지 감사는 각자 예산을 쓴다 (2026-09-16)

`createLlmIntentDeclarer`(`src/ai/intentDeclarationClient.ts`)는 한 턴에 모델을 **두 번** 부른다 —
라우팅 선언(`INTENT_SYSTEM_PROMPT`)과 독립 커버리지 감사(`REQUEST_COVERAGE_AUDIT`). 예전에는 이 둘이
컨트롤러 하나(20초)를 나눠 썼다. 실측(2026-09-15 라이브, `output/ai-activity/e1c80a58…`·`72e8599d…`):
라우팅이 20016~20073ms  쓰고 성공한 뒤 같은 벽에 감사가 잘렸고, 그 실패가
`Request coverage unverified: 시간 초과(20000ms)` 라는 **닫을 수 없는** 필수 항목을 만들었다.
모델은 그 항목을 닫으려 `repair_acceptance`·`correct_verification` 를 반복하다 툴 예산을 태우고
(`stoppedReason: max-tool-calls`) 초안을 버렸다 — 제안 2건 · 적용 0건.

지금은 감사가 **자체 컨트롤러와 자체 20초**를 가진다(`auditCoverage`). 라우팅의 지연이 감사 결과를
지우지 못하고, 감사 자체가 실패하면 그대로 미확인 항목으로 남는다(게이트는 약해지지 않는다). 계약은
`test/intentDeclarationClient.test.ts` 의 "커버리지 감사는 라우팅과 다른 예산을 쓴다" 가 고정한다 —
감사가 라우팅과 같은 signal 을 받으면 그 테스트가 실패한다.

이 항목은 **관찰된 사고의 원인**이라는 뜻이지, 검증 미완료 초안을 적용해도 된다는 뜻이 아니다.
미적용 초안의 검수는 `evaluateForReview`(초안 자체 평가)와 독립 검수 게이트가 그대로 판정한다.
## 동반 서비스 자격: OMP 로그인 재사용과 명시적 해제 (2026-09-19)

편집기의 챗은 사용자가 `omp`에 이미 로그인한 경우 **다시 OAuth를 요구하지 않는다.** OMP의
정본은 `~/.omp/agent/agent.db`(환경에 따라 `PI_CODING_AGENT_DIR`/프로필 경로)이고, Node
companion은 `bun:sqlite`를 직접 로드하지 않으므로 `scripts/lib/omp-auth-probe.mjs`를 짧게
호출해 기존 OAuth 행을 읽는다. 유효한 행은 `~/.oprn/oh-my-pi-auth.json`에 `source: "omp"`로
캐시한 뒤 기존 Node 갱신·wire 포맷 경계를 그대로 사용한다. Bun을 찾을 수 없거나 OMP DB가
없으면 기존 companion 로그인/`~/.codex/auth.json` 채택 경로로 폴백한다.

- 기본 auth 경로(`OPRN_OH_MY_PI_AUTH_PATH` 미지정)에서만 OMP 재사용을 시도한다. 테스트·격리
  경로는 `OPRN_OH_MY_PI_AUTH_PATH` 또는 `OPRN_DISABLE_OMP_AUTH_REUSE=1`로 전역 자격을 읽지 않는다.
- 사용자가 에디터에서 연결 해제를 누르면 `declined`가 기록되어 OMP 자격을 자동으로 되살리지 않는다.
- OMP에서 로그아웃해 가져온 행이 사라지면 `source: "omp"` 캐시도 제거한다. 이는 명시적인
  에디터 연결 해제와 달리 다음 OMP 로그인에서 다시 채택될 수 있다.
- 인증 상태·전송 모두 비밀을 브라우저에 보내지 않는다. 상태 조회는 공개 필드만 돌려준다.

회귀: `test/ohMyPiAuthReuse.node.test.mjs`는 임시 OMP `agent.db`를 만들어 재로그인 없이 상태가
연결되고 Antigravity wire 자격이 만들어지는지 증명한다. 기존 `ohMyPiAuthStore`·OAuth 흐름
테스트는 별도 companion 저장소 경계도 계속 검증한다.
## 에이전트 레인 — 묶음별 병렬 실행과 레인별 적용 (2026-09-15)

설계: `docs/superpowers/specs/2026-09-15-studio-agent-lanes-design.md` · 목업·QA 캡처: `output/evidence/studio-agent-lanes/`

- **단위**: 레인 = 에이전트 × 맵 묶음 × 지시 × 모델. 묶음은 `mapBundleIds`(맵 + 실내 + mapTree 부분 트리).
  상태 전이·묶음 충돌 판정은 순수 모듈 `src/ai/piAgent/lane.ts`, 실행·적용 배선은 `src/editor/panels/aiLaneManager.ts`.
- **적용이 레인별인 이유**: 기존 게이트는 **프로젝트 전체 내용 등가**를 요구한다
  (`applyChangesetToStore.ts` `isProposalBaseCurrent` → `proposalContent(current) === base.content`). 그래서 실행 하나를 적용하면
  다른 실행이 `stale-base` 로 죽었다. 레인은 `laneBundleChangedKeys(lane.base, current, mapIds)` 로 **자기 묶음만** 비교하고,
  통과하면 `mergeMapBundles(current, …)` 로 지금 프로젝트 위에 얹은 뒤 `captureProposalBase(current)` +
  `new AuthoredProjectBaseline(current)` 로 게이트를 다시 통과시킨다. 묶음 밖 변경은 사람·다른 레인의 것이라 건드리지 않는다.
  계약은 `test/piAgentLanes.test.ts` 가 고정한다 — 레인 A 적용 뒤에도 레인 B 가 적용된다.
- **동시성**: 같은 묶음에 둘을 동시에 붙일 수 없다(`lanesOverlap` + 매니저의 in-flight 거절).
  팀 런타임의 맵 in-flight 락(`teamAssignments.ts`)과 같은 규칙이다.
- **화면**: 스튜디오 덱의 첫 탭이 「레인」이다(`ai-studio-tab-lanes`). 표(상태·묶음·에이전트·제공자·모델·턴/툴/경과·적용·버리기),
  아래에 새 레인 폼(묶음 칩·에이전트·제공자·모델·턴·지시). 화면 배치는 2026-09-16 에 3분할로 바뀌었다 — 아래 「스튜디오 3분할」 절 참조(인스펙터는 오른쪽 열의 레인 스레드로 갔다).
  장면 레일의 각 맵 행에는 그 맵을 소유한 레인 칩이 붙는다(`ai-studio-lane-chip`).
  렌더는 `src/editor/panels/aiLaneBoard.ts`, 스타일은 `src/styles/database/tabs-b-assistant-panel/23-agent-lanes.css`(토큰만, `!important` 0).
  도구 카탈로그는 「도구」 탭과 「모든 도구」 모달에 그대로 남는다.
- **후속 지시**: Pi 실행은 무상태다(`PiAgentRequest` 에 세션 id 없음). 레인의 후속 지시는 앞선 지시·assistant 보고를
  문자열로 다시 실어 **새 실행**으로 보낸다(`aiLaneManager.start(id, { instruction })`, 셸의 `followUpLane`).
- **덱 높이·타이핑**: 레인 탭이 열리면 덱을 420px 로 한 번 키운다(팀 보드와 같은 규칙 — 사용자가 드래그해 둔 높이는 건드리지 않는다).
  진행 이벤트마다 표를 다시 그리지만 입력 필드에 포커스가 있으면 건너뛰고, 「레인 추가」 활성 상태는 입력 핸들러가 직접 맞춘다(`syncStart`).
- **아직 아닌 것**: 워커 세션(진짜 다중 턴) 없음,
  제공자별 동시 상한·대기열 없음(P2), 도구 카탈로그의 「모든 도구」 모달 이관 미완.
- **검증**: `npx vitest run test/piAgentLanes.test.ts test/aiStudioShell.test.ts`,
  `node scripts/check-css-budget.mjs && node scripts/check-css-graph.mjs`,
  캡처 `BASE=http://127.0.0.1:9841 node scripts/capture-studio-lanes.mjs`(Pi 실행은 `page.route` 로 스텁 — UI 흐름은 실제 표면을 지난다).

## 스튜디오 3분할 — 가운데는 맵, 왼쪽은 실시간 조수·채팅, 오른쪽은 지금 보는 채팅 (2026-09-16)

사용자 지시: "가운데에는 맵, 왼쪽에는 '채팅' 및 '조수들이 뭐하고있는지 실시간', 오른쪽에는 '지금 보고있는 채팅'".
참조 이미지는 3열 창(좌 목록 · 중앙 내용 · 우 활성 대화)이었다. 구현: src/editor/panels/aiStudioShell.ts, 스타일은 같은 23-agent-lanes.css 의 「좌 레일」 절.

| 열 | 무엇이 사는가 |
|---|---|
| 좌 레일 .ai-studio-left | ① 「조수」 절(ai-studio-agents) — 레인마다 한 행: 에이전트·상태 배지·묶음·턴/툴/경과·마지막 줄, 실행 중이면 중단, 검토 대기면 적용·버리기. 거절 사유도 여기 뜬다 ② 「채팅」 절(ai-studio-threads) — 감독 + 레인별 스레드, 고르면 오른쪽이 바뀐다 ③ 「장면」 절 — 기존 장면 목록(검색·추가·접기 그대로) |
| 중앙 .ai-studio-monitor | 살아 있는 맵 캔버스 + 장면 머리띠·줌·「편집기로」 |
| 오른쪽 .ai-studio-chat | 지금 보는 채팅. 감독이면 기존 로그·컴포저 그대로, 레인이면 그 레인 스레드(ai-lane-thread: 단계·결과·후속 지시). 전환은 클래스 is-lane-thread 로 로그·컴포저를 감추기만 한다(파괴하지 않는다) |
| 아래 덱 | 기존 탭(레인·도구·작업·기획·변경·활동) 그대로 — 레인 표와 새 레인 폼이 여기에 산다 |

- 레인은 화면보다 오래 산다: src/editor/panels/aiLaneSession.ts 모듈 싱글턴. 2026-09-16 실측 — 장면을 추가하면 renderEditor→renderAiChatPanel 로 스튜디오 셸이 새로 만들어지고, 셸이 자기 매니저를 만들면 돌던 레인·검토 결과가 사라졌다(실표면에서 「전체 2」→「전체 1」). 테스트는 resetLaneSessionForTest() 로 모듈 상태를 비운다.
- 밟은 함정 두 가지: ① aiStudioShell.ts 는 루트 children 을 replaceChildren(...) 로 다시 박는다 — 좌 레일을 만들어도 여기서 되돌아간다. ② 빈 프로젝트는 맵트리 루트가 첫 맵이라 「새 장면」 이 그 맵의 자식으로 붙는다 — 레인이 출발한 뒤에 장면을 더하면 그 맵이 레인 묶음에 들어가 다음 적용이 «이 묶음이 도는 동안 바뀌었다» 로 거절된다(가드 자체는 옳다).
- 검증: test/aiStudioShell.test.ts 의 「스튜디오 3분할 재배치」 2건(좌 레일 구성 · 스레드 전환), scripts/capture-studio-3col.mjs → output/evidence/studio-3col/qa/(4 뷰포트 × 7 상태, capture-report.json).

## 하단 덱 → 오버레이 드로워 (2026-09-16)

사용자 판단: "스튜디오 아래쪽에 도구모음을 다른 곳으로 빼는 게 나을 것 같은데" → 선택: 오버레이 드로워.

- 덱은 이제 그리드 행이 아니다(`.ai-studio-shell.is-deck-overlay`). 맵(중앙 열)이 세로를 전부 쓴다.
- 드로워는 `.ai-studio-deck.is-drawer` — 중앙 열 위에 절대 배치(좌·우 경계는 `--studio-scenes-w`/`--studio-chat-w` 로 계산),
  높이 `min(58%, 520px)`, 기본은 닫힘(`is-collapsed` → translateY). 실측: 1600 에서 열림/닫힘 모두 모니터 스테이지가 870×781 로 같았다
  — 오버레이라 맵 기하를 밀지 않는다(`output/evidence/studio-drawer/qa/capture-report.json`).
- 탭: 새 레인 · 도구 · 작업 · 기획 · 변경 · 활동. 덱의 「레인」 표는 삭제했다 — 좌 레일의 실시간 조수 행이 같은 정보(상태·적용·버리기)를 이미 갖고 있었다.
- 입구/출구: 모니터 하단 중앙의 「도구」 손잡이(`ai-studio-deck-handle`), 좌 레일 조수 헤더의 ＋(`ai-studio-new-lane`, 새 레인 탭으로 열림),
  드로워 접기 버튼, Esc. 열려 있으면 손잡이는 숨는다. 작업·변경이 새로 떠도 배지만 세우고 드로워를 빼앗지 않는다(2026-09-16 변경). 레인을 만들면 드로워가 닫히고 그 스레드가 오른쪽에 선다.
- 검증: `test/aiStudioShell.test.ts` 27(드로워 3 포함) · `test/aiStudioColumnCollapse.test.ts` 3 · `test/piAgentLanes.test.ts` 11 ·
  `npm run typecheck:app` 0 · CSS 예산/그래프 0 회귀 · `scripts/capture-studio-drawer.mjs` → `output/evidence/studio-drawer/qa/`(1600·1024 × 6 상태).

## 수용 기준: DB 레코드 값과 지연 적용의 런 수명 (2026-09-16)

실모델 DB 편집이 **검토에 닿지 못하고, 닿아도 적용이 반려되던** 결함들을 라이브 실측으로 고쳤다(PR #863).

| 증상 (라이브 실측) | 원인 | 고침 |
|---|---|---|
| 모델이 `repair_acceptance` 를 반복하다 라운드 소진(16라운드 중 9회 헛 조회) | DB 레코드 속성 변경에 정확한 평가자가 없어 `functionalUnresolved` 로 남았다 | `dbRecordValues` 기준 — 컬렉션 + (recordId **또는** 유일하게 해석되는 recordName) + 점 경로 값. 모호한 이름·부재 레코드는 실패 |
| "다른 건 건드리지 마" 조항을 닫을 수 없음 | `projectPreserve.allowedChanges` 에 DB 허용이 없었다 | allowedChanges 에 `dbRecordValues` 허용 추가(허용 필드만 기준선 값으로 되돌린 뒤 전체를 비교) |
| 닫을 수 없는 미평가 항목이 계속 생김 | 코드가 붙인 `[컨텍스트] …` footer 가 "인용되지 않은 요청 스트" 로 회계됐다 | 의도 사실(`userText`)·수용 원문에서 `stripContextFooter` 적용 — footer 의 사실은 currentMapId·selection 으로 따로 간다 |
| 독립 검수 **승인**까지 는데 적용이 매번 반려 | `aiTurnRunner.finishTurn` 이 턴 종료 시 무조건 `session.retireRun()` → 승인이 런 시그널에 묶여 있어 무효화 | 검토 대기로 초안을 넘긴 턴(`heldProposalForReview`)은 retire 하지 않는다 |

**실모델 라이브 실증:** 검토 승인 → `STORE_DURING_REVIEW` 무변경(정직한 보류) →
적용 시 store 78→300 + 되돌리기 라 / 폐기 시 무변경·되돌리기 없음.
증거 `.omo/evidence/db-ai-review/live-review-chain.md`, 계약 `test/dbRecordValuesAcceptance.test.ts`(10건).

**남은 한계:** 라운드 예산이 빠듯해 검토 도달이 비결정적이고(도달·미도달 모두 관측),
`dbRecordValues` 는 저장된 필드값만 증명한다(런타임 전투 동작은 여전히 미평가 항목).

## 조수 턴 예산 확대 (2026-09-18)

반복적인 턴 상한 중단에 대응해 기본 턴 예산을 5배로 늘렸다. 자율성 읽기 전용·확인은 50턴,
균형 200턴, 자율 300턴, 최대 600턴이며 워커 기본값은 200턴이다. 팀장 100턴, 시공 200턴,
장식 및 새 팀원 150턴, 검수 50턴, 스튜디오 새 작업 레인 60턴이다. 팀원·레인 입력의
최댓값과 팀 명세 정규화 상한은 600턴으로 맞췄다. 기존에 저장된 명시적 팀원 예산은 유지되므로
해당 팀원 편집에서 직접 올릴 수 있다. 시간 상한과 중단 결과의 수동 검토 정책은 그대로다.

## 결과 본문과 접힌 작업 과정 (2026-09-18)

- 왼쪽 요청별 카드의 `작업 과정`은 기본 접힘이다. 도구 기록·실행 보드·중간 계획·검토 보고는 이 안에 모으며 실패해도 자동으로 펼치지 않는다. 완료/실패 상태와 변경 보기 등 사용자 액션은 밖에 남는다.
- `PiCommandSurface.appendProcess`는 중간 보고 전용 출력 경로다. 최종 답변·확인 질문은 기존 본문 경로를 유지한다. 범위 제외·검토 불가·미완료·적용 실패는 쉬운 문장으로 본문에 알리고 원문 근거는 작업 과정에 보존한다.
- `userFacingCopy.ts`의 공통 지침을 단일 에이전트·팀장·검토자 프롬프트에 넣는다. 결과와 다음 행동을 쉬운 한국어로 설명하고 내부 도구명/ID/모델명/실행 횟수는 실행 기록에 남긴다. 적용 전 초안과 적용 완료를 구별한다.
- 오른쪽 팀원 상세도 결과를 먼저 보여 주고 대화/실행 원문은 접힌 작업 과정으로 제공한다. 같은 팀원의 갱신에는 접힘 상태를 보존하고 다른 팀원 선택 시 기본 접힘으로 돌아간다. 실패 알림·재시도 입력·적용/버리기는 계속 노출한다.
- 후속 요청의 최종 답변은 `LaneResult.answer`에 전체 길이로 보존한다. 도구 횟수 등 진단용 `summary`와 분리해 본문에 표시하며, 400자 실행 기록으로 답변을 대체하지 않는다.
- 이 영역은 실행 기록이며 모델의 비공개 사고 과정이 아니다. 최종 답변을 정규식으로 자르거나 질문을 숨기지 않는다.
- 재현: `scripts/qa/ai-team-sidebar.mjs`. 실제 에디터 + 결정적 응답 재생으로 접힘/펼침, 최종 질문 노출, 쉬운 실패 알림과 원문 접근, 재시도/적용/중단을 검증한다. 실모델 답변 품질 검증과는 구분한다.

## 팀원 작업 예산 버튼 (2026-09-18)

팀원 상세와 팀 설정 폼은 공통 `aiTeamBudget.ts`의 기본(100) / 넉넉히(300) / 오래 맡기기(600) 버튼을 쓴다.
새 팀원과 기본 팀 명세는 넉넉히를 선택한다. 숫자는 툴팁에만 노출하며 선택은 aria-pressed로 표시한다.
상세 선택은 팀 명세에 즉시 저장되고 다음 실행부터 적용한다. 기존 사용자 지정 숫자는 선택 전까지 유지하며
어느 프리셋도 거짓으로 선택하지 않는다. 후속 레인은 memberId를 보존하고 시작 시 현재 예산을 전달한다.
독립 레인은 레인 식별자별 브라우저 설정으로 기억한다. 실행 중 선택해도 진행 중 요청은 변경하지 않는다.

브라우저 재현은 `scripts/qa/ai-team-budget.mjs`와 `output/evidence/ai-team-budget/SUMMARY.json`.
오른쪽 아바타의 `.ai-team-member` 스타일은 `.ai-team-avatar-list` 직계 자식으로 한정한다.
설정 폼의 같은 클래스에 74px 폭이 새면 예산 폼과 저장 버튼이 스크롤 영역 밖으로 밀린다.

## 왼쪽 팀 운영 메뉴 (2026-09-18)

`aiComposer`의 팀 체크박스를 280px 커스텀 팝오버(`aiTeamMenu.ts`)로 교체했다.
혼자/팀으로, 공통 예산 기본100·넉넉히300·오래 맡기기600, 완료 후 검토, 팀 구성 진입을 제공한다.
팝오버 배타적 열림·바깥 클릭·Escape·뷰포트 보정은 기존 컴포저 소유자를 재사용한다.
`PiTeamSpec.workBudget`과 `reviewAfterWork`는 기존 팀 명세 저장소에서 유지되며 기본은 300/true다.
`enabledMembers`는 공통 예산을 적용하고 검토가 꺼졌으면 검수 담당을 실행 후보에서 제외한다.
개별 예산 편집 UI는 제거했다. 과거 member.maxTurns는 호환 데이터로 남지만 팀 실행에는 공통 예산이 우선한다.
검토 켜짐은 제작 후 최종 working 사본에 읽기 전용 report_task 검토를 실제 실행한다.
검토 실패·보고 누락은 완료로 넘기지 않으며 기본 데이터 수용 검증은 끄지 않는다.
담당이 없으면 메뉴에서 담당 설정 필요와 생략을 제공하며, 켜진 채 실행하면 명시적으로 거절한다.
메뉴의 팀 구성은 오른쪽 기존 설정을 열고 역할·프롬프트·참여자를 편집한다.

이전 API 호출의 reviewAfterWork 미지정은 기존 팀장 주도 검수를 유지한다. 브라우저 저장소는
옛 명세를 읽을 때 이 필드를 true로 보정하므로 메뉴에서 보이는 검토 상태와 실행이 일치한다.

브라우저 근거: `scripts/qa/ai-team-menu.mjs`, `output/evidence/ai-team-menu/SUMMARY.json`
(12항목, 오류 0). 실측 280×225px. 결정적 응답 재생으로 공통 설정 전송·새로고침 유지·
검수 담당 부재·외부 클릭·Escape 초점 복원을 확인했다. 실제 모델 실행은 수행하지 않았다.
팀장도 공통 예산을 사용한다. 최종 검토의 켜짐/꺼짐·보고 누락 계약은
`test/piTeamSharedControls.test.ts`에 추가했으며 세션 테스트 금지 규칙에 따라 실행하지 않았다.

## 다섯 적용 모드와 실제 맵 증분 반영 (2026-09-18)

`src/ai/piAgent/applyMode.ts`가 적용 정책과 UI 어휘의 정본이다. 자율성(읽기/계획/턴 예산),
모델, 팀 설정과 별개이며 `AiConfig.piApply`에 저장한다. 미설정·잘못된 값은 `default`,
`piApplyPolicyVersion: 1`이 없는 옛 `review` 공장값도 `default`로 전환한다.
새 선택은 저장할 때 정책 버전을 함께 기록해 명시 `review`를 보존한다. `auto` 등 다른 값은 유지한다.
Pi 활동 로그는 시작·종료 모두 `result.applyMode`에 실행 당시 모드를 기록한다. 입력창 선택기와 AI 설정 → 동작에서 선택하며 실행
시점 값을 고정한다(실행 도중 바꾼 설정은 다음 요청에 적용).

- `yolo` / YOLO: 실제 편집을 도구 완료 경계마다 반영. 별도 계획·조화 검수·삭제 확인 생략.
- `auto` / AUTO MODE: 실제 편집을 계속 반영하고 조화 검수 문제를 최대 두 번 수정·재검수.
  해결 못 한 미적용 결과는 보류하고 보고한다. 이미 반영한 작업은 자동으로 되돌리지 않는다.
- `default` / DEFAULT(기본): 일반 작업은 실제 반영. 맵 삭제·이벤트 전멸·`clear_map`은
  반영 전에 확인. 검수 문제·미완료가 있으면 이미 반영한 부분과 미적용 초안을 구분해 안내.
- `review` / 검토 후 적용: 종전처럼 작업 사본과 고스트로 만든 전체 초안을 승인 후 적용.
- `step` / 단계별 적용: 워커의 `finish_stage({title})`가 의미 있는 작업 단위를 마감한다.
  승인 전에는 다음 단계로 진행하지 않는다. 마지막 미마감 변경도 종료 전에 확인한다.
  팀은 이 모드에서 앞 배정이 완료되어야 다음 배정을 받는다. 중단은 미승인 단계만 버린다.

실시간 표시는 고스트가 아니다. `piAgentRuntime`의 직렬 도구 래퍼 → `checkpoint` NDJSON →
`aiPiPublication` → 기존 `applyProposedProject` → `/v1/agent/checkpoint` 응답으로 실제 프로젝트가
바뀐 뒤 워커가 계속한다. 응답에는 편집기가 정규화한 실제 프로젝트를 돌려주어 다음 증분의
기준과 공간 증거가 일치한다. 단계 승인·DEFAULT 삭제 확인도 이 왕복에서 대기한다.
`piCheckpointBroker`는 추측 불가능한 일회용 ID를 쓰며 거절·중단·시간 초과에서 대기를 폐기한다.
팀은 하위 작업을 자기 맵 묶음으로 제한하고 전역 게시 큐에서 직렬 반영한다.

무결성·공간 도구 증거·읽기 전용·명시 범위·동시 편집 충돌 검사는 모든 모드에 유지한다.
`onApplied` 경계에서만 다음 적용 권한을 갱신하며, 임의의 현재 store 값을 새 기준으로 채택하지
않는다. 실시간 모드는 첫 변경에 undo 스냅샷 하나를 남기고 후속 변경을 같은 작업으로 묶는다.
단계 모드는 승인 단계별 스냅샷을 남긴다. 중단·오류 때도 이미 반영된 작업은 남고 되돌릴 수 있다.
검수 완료 후 동일 프로젝트를 재적용하거나 이력을 하나 더 쌓지 않는다.

검증: `test/piApplyModes.bun.test.ts`(실제 Agent 루프), `piPublication.test.ts`(적용/충돌/승인),
`piCheckpointProtocol.test.ts`(대기/일회성/중단/ACK), `piAgentExecutionRoute.test.ts`,
`piAgentRunOutcome.test.ts`, 기존 팀·스트림 테스트. 브라우저는 `scripts/qa/ai-apply-modes.mjs`의
격리 blankProject와 대본 전송을 사용한다. 증거: `output/evidence/ai-apply-modes/`.

맵 확장 회귀 재현: `node scripts/qa/ai-map-resize.mjs`는 로컬 전용 편집기에서 구형 설정 전환과 새 review 선택 보존을 확인하고, 실제 `resize_map` → `createPiPublication`으로 20×15 → 28×21 즉시 반영을 확인한다. 외부 LLM/원격 저장은 사용하지 않는다. Vite HMR 직후 직접 동적 import로 store를 읽는 QA는 timestamp가 붙은 앱 모듈과 별도 인스턴스를 만들 수 있으므로 서버를 새로 시작해서 실행한다.

## Feature16 — 프롬프트 라이브러리·대사 검토·실제 요청 검사기 (2026-09-21)

- 진입: AI 컴포저 「더보기」 → 「프롬프트 라이브러리」 / 「대사 목록·문체 검토」 /
  「프롬프트 검사기」. 헤더의 공용 작업 메뉴에도 같은 세 항목이 있다.
  `aiActionMenu` → `aiChatPanel.sharedMenuActions.openAuthoring` →
  `panels/aiAuthoring/modal.ts`가 소유한다. 새 컨트롤은 `feature16-*` testid를 사용한다.
- 라이브러리는 프로젝트 `aiAuthoring.templates`의 id/name/tags/body를 편집한다.
  `{{변수 이름}}`은 중복 제거한 필수 슬롯이며 누락을 막고 값을 문자 그대로 치환한다.
  이름·태그·본문 검색, 현재 컴포저로 생성, 저장/편집/2단계 삭제, 변수 미리보기 후
  컴포저에 **덧붙이기**를 제공한다. 적용은 전송이 아니다. `store.update`와 프로젝트 undo,
  기존 자동저장/내보내기 경로를 사용하며 UI의 반영 메시지는 원격 저장 성공 주장이 아니다.
- `ai/authoring/dialogueInventory.ts`는 모든 맵 이벤트의 저장된 모든 페이지를 모은다.
  페이지가 있으면 레거시 `event.commands` 사본은 제외한다. text, choices.prompt,
  choices.options 및 `nestedCommandLists`가 아는 모든 중첩 분기를 읽는다.
  공통 이벤트·임시 이벤트 초안은 범위 밖이며 화면에 명시한다. 화자/맵/텍스트 필터,
  100개씩 더 보기, source id/map/event/page/command path를 보존한다.
  원문 이동은 기존 `selectEditorMap`과 `openEventEditorModal({pageId})`로 실제 페이지를 연다.
- 문체 규칙과 최대 글자 수는 `aiAuthoring.dialogueStyleRules/maxDialogueChars`로 저장한다.
  구조 검사는 빈 문자열·공백·글자 수만 검사하고 **LLM 아님**으로 표시한다.
  LLM 검토는 `assistantEndpoint`의 `dialogue-review` 표면 → 공용 `chatCompletion`이다.
  저장한 규칙과 필터 범위의 원문만 보내며 쓰기 툴이 없다. 60,000자 초과는 사용자가
  필터를 좁히도록 거부하고 몰래 잘라 보내지 않는다. 응답은 source id와 실제 원문의
  비어 있지 않은 부분 인용이 모두 일치해야 한다. 인증/제공자/파싱/출력 잘림 오류는
  성공 또는 0건 지적으로 바꾸지 않는다. 중단·닫기·프로젝트 교체는 요청을 취소하고,
  검토 중 원문/규칙 변경은 결과를 폐기한다. 원문 변경 후 완료 지적도 지운다.
- 검사기는 `llmClient.requestBody`의 실제 전송 직전 본문과 Pi worker
  `onPayload`의 **provider 변환 이후 실제 payload**를 관측한다. Antigravity enum 보정
  뒤 관측하며 관측 실패가 전송을 막지 않는다. `prompt_inspection` NDJSON 이벤트는 팀
  중첩 이벤트도 처리하지만 일반 대화/감사 콜백에는 보내지 않는다. 가짜 시스템 프롬프트를
  브라우저에서 재구성하지 않는다. 미갱신 구형 워커에서는 Pi 요청 관측을 받지 못한다.
- 최종 관측 한 건만 메모리에 보관한다. 키/토큰/인증 필드/알려진 실제 자격 증명과
  이미지 본문을 저장 전에 가린다. 각 JSON 절, 실제 도구 이름, 문자÷3 토큰 추정,
  80,000자 표시 예산의 절별 생략량을 표시한다. 상위 맥락 압축량·이미지 토큰·제공자
  내부 처리는 이 경계에서 알 수 없다고 명시한다. 관측은 **전송 시도**, 성공 증명이 아니다.
  새 대화·프로젝트 전환·패널 폐기·새로고침·비우기는 삭제하며 epoch로 늦은 결과의 부활을 막는다.
- 부모 세션 검증: `npm test -- test/feature16-ai.test.ts test/feature16-ai-review.test.ts test/feature16-ai-transport.test.ts`;
  `npm run typecheck:app`;
  `node scripts/capture-feature16-ai.mjs http://127.0.0.1:<부모-서버-포트>`.
  캡처 스펙은 실제 편집기 `?blankProject=1`에서 보이는 메뉴/컨트롤을 클릭한다.
  프로젝트 데이터와 LLM 응답만 테스트 내부 fixture이다. 캡처용 별도 Playwright 설정은
  서버를 시작하지 않는다. `verify-shots/feature16-ai/01-library.png`부터 `04-source-page.png`까지 생성한다.
  이 변경 작성 세션은 테스트/타입체크/서버/브라우저를 실행하지 않았다. 중앙 검증이 필요하다.
## Pi 단일 마을 요청 계약 (2026-09-21)

평문 단일 마을 생성은 `plainPiTurn → resolveVillageContract → runPiAgent →
validateVillageContract → applyProposedProject`로 처리한다. 의도 선언의 대상·선택 영역·집/주민
수를 실행 전에 고정하고 DB 설계서는 기존 `resolveVillageDesignInput`으로 해석한다.
주민 0명과 명시적인 무언 주민(`construction.residentDialogue:false`)도 보존한다.
의도 해석은 30초 제한이며 fallback 선언으로 쓰기 실행을 시작하지 않는다.

- 계약이 있는 요청은 팀 설정과 관계없이 단일 실행이다. 별도 산문 계획과 Vision/Ultrabrain
  미감 재검수/새 실행의 보수 루프를 생략한다. 복합 모험·보상·기능 검증 요청 및 명시 `/pi`
  호출은 이 단일 마을 계약으로 바꾸지 않으며 기존 경로를 유지한다.
- 쓰기는 `author_village` 한 번의 성공 시공, 그 뒤 `author_npc_cast` 대사 보충으로 제한한다.
  초안은 중간 checkpoint로 게시하지 않고 고스트로 보여 준다. 완료 후 DEFAULT/AUTO/YOLO는
  기존 수용 게이트로 한 번에 반영하고 REVIEW/STEP은 완성 묶음을 승인 대상으로 둔다.
  미완료는 YOLO도 자동 반영하지 않는다.
- `residentEventIds`와 `doorFronts`는 시공기가 실제 생성한 대상의 증거다. 집/주민 수,
  실제 입구에서 이번 집 문앞까지 타일 통행, 시공 후 지형/기존 이벤트 불변, 주민별 대사를 검사한다.
  선택 영역 밖의 예전 주민이나 건물을 미감 점수로 재시공하지 않는다.
- 보충은 같은 Agent의 턴/시간 예산 안에서 최대 2회이며 동일 문제 목록이면 즉시 끝낸다.
  미감 점수는 이 계약의 완료 조건이 아니다. 시공 실패/누락은 도구 성공 기록이 없어도 미완료다.
- 빈 시작 맵의 전체 시공 뒤 예전 중앙 좌표가 고립되면 빌더가 검증한 시작점을 유지한다.
  기존 콘텐츠/부분 범위의 시작점은 보존한다. 실측: 4채 green 형태에서 (10,8)을 복원하면
  4채 모두 접근 불가였고, 검증된 시작점 (23,16)은 4/4 도달했다.

검증: Bun 계약/실행 루프 6건, 기존 facade/intent-note Vitest 50건 통과.
실제 에디터 + Gemini 호출은 `author_village` 1회/2턴/9.294초/도구 오류 0으로
4채·주민 3명·내부 4개를 생성했다. LegacyDb 전용 행
`village-contract-live-20260921-414a`에 QA 스크립트로 업서트 후 전체 문서 재조회 일치를 확인했다.
웹 QA 세션 자동 저장 성공으로 해석하면 안 된다. 실행/캡처 절차와 제한은
`reports/2026-09-21-village-contract-live.md`.
## Pi 시공 연출과 공간 밑그림 복구 (2026-09-21)

`DEFAULT`/`AUTO`/`YOLO`의 승인 정책과 시공 표시는 별개다. `aiPiAgentCommand`는 모든 모드에서
툴 시작·끝과 밑그림 이벤트를 캔버스에 전달한다. 실시간 모드의 타일 공개는
`aiPiPublication.beforeApply` → `aiPiGhostBridge.present`가 **직렬화된 checkpoint**를 사용한다.
삭제/단계 승인을 받은 뒤 초안을 보여 주고, 기존 무결성·stale-base 검사와 저장 경로로 적용한다.
적용 성공 후 기준선을 갱신하므로 뒤늦은 `map_delta`/`done`이 이미 적용한 타일을 다시 공개하지 않는다.
표시 중 중단되면 적용 전 signal 검사로 쓰기를 취소한다. 표시가 없거나 탭이 숨겨졌거나
동작 줄이기가 켜져 있으면 연출 대기를 생략한다. 미리보기는 저장 성공 증거가 아니다.

- `scripts/lib/piAgentRuntime.ts`의 쓰기 실행에는 `set_build_spec` 도구가 있다. 기존 스키마와
  `validateBuildSpec`/`normalizeBuildSpec`을 재사용하고, 성공한 계획을 `execution_status`의
  `name=set_build_spec`, `data=BuildSpec`으로 전달한다. 이 도구는 표시 전용이며 프로젝트를
  바꾸거나 기존 세션의 시공 허가 게이트를 Pi에 추가하지 않는다. 읽기 전용 실행에는 제공하지 않는다.
- Pi 다리는 명시 계획을 청사진 렌더러에 연결한다. 계획 없는 단순 공간 쓰기도 위치가 명확하면
  도구 인자의 작업 영역을 먼저 표시한다. 조회 도구는 작업 영역을 만들지 않는다.
- `agentPreviewRenderers`는 256셀 초과라도 실제 타일을 그린다. 객체 생성은 카메라 주변으로
  제한하며, 팬하면 새로 보이는 타일을 준비한다. 셀 수 때문에 테두리만 남기는 경로는 제거했다.
- 하위층→상위층→이벤트 순으로 공개하고, 각 층은 좌→우로 진행한다. 공개 길이는 1.8초,
  공개 후 유지 시간은 450ms다. 타일은 220ms 동안 4px(상위층 10px) 내려앉으며, 선두에는
  무광 연필 커서와 옅은 먼지를 표시한다. 빛줄기·발광·불꽃·효과음은 없다. 객체 준비 시간은 공개 시간을
  소모하지 않는다. 같은 좌표의 타일이 다시 바뀌어도 새로운 공개를 받는다.
- 밑그림은 구역별 120ms 간격으로 750ms 동안 외곽선을 그린 뒤 눈금과 라벨을 유지한다.
  완료하면 update 구독을 해제하며, 새 계획·숨김·씬 정리에서도 구독과 객체를 정리한다.
  동작 줄이기에서는 즉시 표시한다. 적용 뒤 작은 `✓ 반영됨` 표식이 잠깐 올라갔다 사라진다.
- 촬영: `BROWSER=firefox BASE=http://127.0.0.1:<port> node scripts/capture-ai-construction.mjs`.
  실제 편집기·Pi 클라이언트·checkpoint 적용을 사용하되 워커 스트림은 재현용으로 대본화한다.
  `MODE=review OUT=output/evidence/ai-construction-review`로 검토 후 버리기 경로를 확인한다.
  중간 스크린샷은 Playwright 시계를 멈춰 동일한 공개 프레임을 촬영한다. 실 LLM 저작 품질,
  원격 저장 또는 새 맵 자동 이동의 연출을 검증한 것으로 확대 해석하지 않는다.

## 실시간 맵 연출 헤드리스 (2026-09-22)

작업 표시 수준(생략/간단히/자세히/매우 자세히)은 실행 기록 문구만 바꾼다. 맵 위의 실시간 시공(고스트 타일, 청사진, 카메라 따라가기, 공개가 끝날 때까지의 대기)은 그와 별개로 끌 수 있다.

- 스위치는 작업 표시 안의 「맵에 시공 보이기」다(`data-testid=ai-live-canvas`). 꺼짐이 기본이다. `localStorage["oprn:ai-live-canvas"]` 가 `on` 일 때만 맵 위 실시간 시공을 그린다.
- 화면 무게는 AI 설정 「표시」의 `ai-render-weight`다. 기본 `light`는 조수 창·접힘 알약·작업 띠·맵 칩의 `backdrop-filter`를 끈다. `heavy`만 20px 유리 블러를 쓴다. `off`는 블러를 끄고 판을 불투명하게 한다. 저장 키는 `oprn:ai-render-weight`, 적용은 `documentElement.dataset.aiRender`.
- 입력줄 모델명 옆에 이 대화의 사용량이 `N턴 · N토큰`으로 붙는다(`ai-composer-spend`). Pi 실행의 `done.stats`(계획 턴 포함)를 대화가 바뀔 때까지 더한다. 토큰은 `usage.totalTokens`(입력·출력·캐시)다. 0이면 숨긴다.
- 헤드리스에서도 도구 실행, 증분으로 복원한 초안, 검토, 적용은 그대로다. `replaceAgentGhostPreviewFromProjectDiff` 를 쓰는 경로(Pi, 레인, 세션, 영역 작업)는 꺼져 있는 동안 맵 비교를 하지 않고, 켜기 직전에 쌓인 프리뷰는 비운다. Pi 는 다시 켜는 순간 현재 초안을 한 번 그린다. 그 외 경로는 다음 변경에서 그린다. 공개 애니메이션만큼 체크포인트를 기다리지 않는다.
- 켜 둔 상태의 렉: 손대지 않은 맵은 객체 동일성으로 비교를 건너뛴다. 라이브 프리뷰 id 에 셀 전체를 문자열로 넣지 않는다. 스프라이트는 카메라 주변만 만들고, 이미 내려앉은 칸은 프레임마다 다시 움직이지 않는다. 상태 칩은 문구가 바뀔 때만 배치를 다시 잰다.

## 조수 적용은 바뀐 칸만 다시 그린다 (2026-09-22)

실시간 적용(DEFAULT/AUTO/YOLO)은 쓰기 도구마다 `store.replace`를 한다. 알림에 칸 목록이 있으면 `redrawCells`가 그 칸과 이벤트 마커만 고친다. 맵 크기·타일셋·맵 추가/삭제·맵 밖 참조가 바뀌거나 칸이 2048개를 넘으면 예전처럼 전체를 다시 그린다. 공개 애니메이션은 체크포인트를 기다리지 않는다. 체크포인트 줄은 타일셋·데이터베이스 참조가 그대로면 그 둘을 빼고, 브라우저와 ACK가 직전 객체를 다시 붙인다. 맵 비교는 타일 배열을 문자열로 만들지 않고 칸 값으로 한다.

- **팀 런타임도 빈 키를 다시 붙인다 (2026-09-27):** 팀원 체크포인트는 `piAgentRuntime` 이 안 바뀐 타일셋·DB 를 비워 보낸다.
  `piTeamRuntime` 의 `checkpointFor` 는 그걸 복원하지 않고 병합·작업 사본(`working`)으로 삼았다. 프로젝트 공통 작업(`assign_task_agent` mode=project)은
  빈 체크포인트가 그대로 `working` 이 됐고, 맵 배정은 브라우저 ACK(역시 비워서 돌아온다)가 `working` 을 덮었다. 그 뒤 배정된 시공 팀원은
  `database.actors` 가 없는 사본에서 출발해 「project.database.actors.map undefined」로 막혔다(프리셋 몬스터 수집 팀 첫 생성 실측).
  이제 받은 체크포인트를 `working` 으로 복원한 뒤 병합하고, 브라우저로는 다시 비워 보내며, ACK 도 복원한 뒤 `working` 에 둔다.
  회귀: `test/piAgentTeamRuntime.test.ts` 「slim %s checkpoints keep tilesets and database」(프로젝트·맵 두 경로).
- **워커 요청 본문 상한 (2026-09-27):** `Bun.serve` 의 `maxRequestBodySize` 기본값은 128MiB 이고, 넘으면 응답 없이 소켓을 닫아 호스트 fetch 가
  `fetch failed`(EPIPE)로 끝난다. 새 프로젝트 기본 자료가 늘어 몬스터 수집 프리셋 첫 요청이 151MB(타일셋 84MB · 에셋 66MB)가 되자 팀 첫 생성이
  한 턴도 못 돌고 「Pi 에이전트 실행 실패: fetch failed」로 끝났다. `scripts/oh-my-pi-worker.ts` 가 호스트의 압축 해제 상한과 같은 256MiB 를 쓴다.
  회귀: `test/ohMyPiWorkerBodyLimit.node.test.mjs`(150MB 본문에 400 검증 오류가 돌아와야 한다).
- **`Error in input stream` 은 QA 환경 탓이었다:** Firefox 가 스트림 읽기 도중 네트워크 변경을 감지하면 진행 중 연결을 끊고 이 메시지를 낸다.
  이 호스트는 Docker 가 veth 인터페이스를 수십 초마다 만들고 지운다(`ip monitor`). 브라우저 QA 에서 `network.notify.changed=false` 를 주자 같은
  프리셋 팀 첫 생성이 41분 동안 끊김 없이 돌았다(맵 17장 · 이벤트 175개, SQLite 재로드 확인). 제품 코드 문제는 아니지만, 네트워크가 흔들리는 실제
  사용자 PC 에서도 같은 끊김이 날 수 있다. 의도 선언 `NS_ERROR_ABORT` 도 같은 원인이었다. 아래 「실행 기록과 이어 받기」가 그 경로다.
- **무거운 키는 해시로 보낸다 (2026-09-27):** `src/ai/piAgent/heavyWire.ts` 가 `tilesets` · `database` · `assets` 중 256KB 이상인 키를
  SHA-256 으로 바꾸고 몸통에서 비운다(`heavy: {키: 해시}`). 호스트가 아직 모르는 해시만 `heavyBlobs` 에 내용을 싣는다. 호스트
  `scripts/lib/piRunRelay.mjs` 의 `resolveHeavyProject` 가 내용을 해시로 검증해 LRU 캐시(512MB)에 두고 워커 몸통에 다시 붙인다. 모르는 해시면
  `409 {error:"heavy-missing", missing}` 을 돌려주고, 클라이언트는 그 해시만 실어 한 번 더 보낸다(호스트 재시작·축출). 브라우저의 "보낸 해시" 표는
  추측일 뿐이고 권위는 409 다. `crypto.subtle` 이 없으면 예전처럼 통째로 보낸다. 체크포인트 슬림·복원(`protocol.ts`)도 `assets` 를 같은 무거운 키로 다룬다.
- **실행 기록과 이어 받기 (2026-09-27):** 실행은 브라우저 연결이 아니라 호스트의 실행 기록에 묶인다(`piRunRelay.mjs`).
  POST `/v1/agent/run` 은 몸통의 `runId`(없으면 호스트가 만든다)로 기록을 열고, 워커 NDJSON 을 끝까지 읽어 쌓으며, 줄마다 `"seq"` 를 붙여 흘린다.
  응답 헤더 `X-Oprn-Run-Id` 가 이어 받기 가능 표시다 — 두 동반 서비스 진입점(`companion/middleware.mjs`, `chatgpt-oauth-companion.mjs`)은
  `Access-Control-Expose-Headers` 로 이 헤더를 연다(안 열면 app:// 렌더러가 못 읽어 이어 받기 없이 돈다).
  스트림이 끊기면 `client.ts` 가 GET `/v1/agent/run?runId=&after=마지막seq+1` 을 지수 백오프(2초부터, 6회)로 다시 붙고, seq 로 중복 줄을 버린다.
  이어 받는 동안 `execution_status stream.resume` 이벤트가 나간다. 중단 버튼은 POST `/v1/agent/cancel` 이고 이것만 워커를 멈춘다.
  오류 없이 닫힌 스트림은 끊김이 아니라 실행 종료다 — `done` 없이 `error` 줄로 끝났으면 이어 받지 않고 그 오류를 보고한다.
  아무도 붙지 않은 채 5분(`RESUME_GRACE_MS`)이 지나면 실행을 멈춘다. 끝난 기록은 10분 보관, 기록 상한은 256MB 다. 헤더가 없는 옛 호스트면
  예전 방식(통째 POST, 끊기면 실패)으로 돈다. 이어 받지 못하면 「AI 작업 연결이 끊겼고 다시 이어 받지 못했습니다」.
  회귀: `test/ohMyPiRunRelay.node.test.mjs`, `test/piAgentClientResume.test.ts`, `test/piAgentCommandAndRoute.test.ts`.
- **프리셋 첫 요청은 의도 읽기를 건너뛴다 (2026-09-27):** `classifyPlainPiTurn`(`plainTurn.ts`)은 읽기 전용 다이얼이 아니고
  `isGenrePresetBriefRequest` 이면 선언 모델을 부르지 않고 바로 제작 턴(`routineEdit:false`, 전체 도구, 팀이면 team)을 돌려준다.
  실측으로 의도 읽기는 모델 두 번에 10–24초였고, 프리셋 요청은 항상 "제작" 이라 답이 정해져 있다. 회귀: `test/plainTurnGenrePreset.test.ts`.
- **프리셋 첫 생성의 범위와 턴 상한 (2026-09-27):** 이전 실측은 41분 동안 맵 17장을 만들다 시간 상한에 걸렸다. `team.ts` 의
  `PRESET_FIRST_BUILD_RULES` 가 오케스트레이터 시스템 프롬프트에 붙는다 — 가장 작은 플레이 가능한 조각, 맵 3–5장, 공통 자료 → 맵 → 검수 한 번 →
  마무리 순서, 플레이를 막는 문제만 고치기, 정해진 형식의 마무리 보고. `piTeamRuntime.ts` 는 프리셋 작업이면 팀원 `maxTurns` 를
  `PRESET_FIRST_BUILD_MEMBER_TURNS`(120)로 묶는다.
- **실측 스크립트:** `scripts/qa/preset-team-first-build.mjs` — 임시 SQLite 호스트 + Firefox 로 포스터 → 인터뷰 → 첫 생성을 돌리고
  요청 크기·heavy 해시·의도 읽기 호출 수·실행 번호·이어 받기 횟수·SQLite 재로드 맵/이벤트 수를 `verify-shots/preset-first-team-e2e/SUMMARY.json` 에 쓴다.
  `E2E_NETWORK_CHANGE=1` 이면 Firefox 의 네트워크 변경 감지를 켠 채 두어 이 호스트의 veth 변동으로 실제 끊김을 만든다.

## 큰 프로젝트의 Pi 요청 전송 (2026-09-24)

`src/ai/piAgent/requestBody.ts`는 1Mi 문자 이상인 요청을 gzip으로 전송한다. `/v1/agent/run`뿐 아니라 적용 ACK `/v1/agent/checkpoint`도 같은 경로를 사용한다. 프로젝트/공용 타일 참고 이미지/이벤트를 제거하지 않는다. 작은 요청과 CompressionStream 미지원 환경은 기존 JSON을 사용하며, 후자는 큰 문서에서 기존 한도 오류를 받을 수 있다.

수신 `scripts/lib/companionHttpUtil.mjs`는 wire64MiB 제한을 유지하고 gzip 복원은 별도256MiB 상한으로 제한한다. 기존 identity JSON은 계속64MiB다. 손상 gzip/미지원 encoding은 거절한다. 동반 서비스 두 진입점의 CORS는 Content-Encoding을 허용한다. 서버 gzip 수신 지원을 먼저 배포한 뒤 renderer를 갱신한다. 새 renderer만 배포하면 기존 서버는 gzip을 JSON으로 읽을 수 없다.

실측: 새솔 정본507을 포함한 요청83,468,214bytes →34,820,901bytes, 복원 객체 전체 일치. 저장 브리지의128MiB 제한과는 별개다. 루트 필드별 용량에서 tilesets 약73MB가 대부분이었다. 압축 지원은 제작 완료나 LLM 자체 컨텍스트 제한 해결을 의미하지 않는다.

## 대형 프로젝트의 AI 적용 기준선 메모리 (2026-09-24)

약119MB 프로젝트를 /pi로 편집할 때 렌더러가 V8 OOM으로 종료됐다.
`AuthoredProjectBaseline`의 authored/complete와 `ProposalBase`의 content/world는
전체 정렬 JSON 대신 SHA-256만 장기 보관한다. 비교할 때 같은 canonical JSON을
다시 계산하고 해시하므로 객체 제자리 수정도 검사하며, world/wiki 예외와
세대·lineage 검사는 기존대로 유지한다. 세대 기반으로 stale 검사를 생략하지 않는다.
이 변경은 보관 메모리를 줄인다. 직렬화·해시의 동기 실행 비용은 아래 2026-09-25 절에서 줄였다.
회귀 사례: `test/authoredProjectBaseline.test.ts`의 큰 Unicode 문서 끝부분 변경과
기준선 크기 제한. 이번 세션에서는 사용자 규칙에 따라 테스트/게이트를 실행하지 않았다.

## 체크포인트 적용 권위는 노드 요약으로 비교한다 (2026-09-25)

증상: 팀 호스트(`http://mdc-server:9888`)에서 조수를 쓰면 편집기가 심하게 버벅였다. 26MB 프로젝트(타일셋 25MB, 그중 참고문서 약 19MB)에서
쓰기 체크포인트 하나마다 메인 스레드가 약 10초 멈췄다(VM의 headless Chromium, `/tmp` 대본 워커로 체크포인트 3회 CPU 프로파일).
원인은 에이전트가 타일셋을 건드리지 않아도 적용 권위(`captureApplyAuthority`·`isProposalBaseCurrent`·`AuthoredProjectBaseline.matches`)가
프로젝트 전체를 정렬 직렬화 2회, SHA-256 5회 돌린 것이다. HTTP 서빙은 secure context 가 아니라 `crypto.subtle` 도 쓸 수 없다.

- `src/project/persistence/core/contentDigest.ts` 의 `jsonContentDigest` 는 `canonicalJsonOf` 와 같은 동일성(키 순서 무시)을 노드 요약(머클 방식)으로 낸다.
  객체·배열마다 (키, 원시값, 자식 토큰) → 토큰 기록을 `WeakMap` 에 두고, **부를 때마다 모든 노드를 현재 값과 대조**한 뒤에만 재사용한다.
  세대에 묶지 않으므로 사람의 제자리 수정도 잡는다. 256자 이하 노드는 해시하지 않고 글을 그대로 토큰으로 쓴다. 기억은 자식 객체를 붙잡지 않는다.
- `projectIdentityDigest(project, "proposal" | "authored" | "complete")` 가 적용 권위·초안 기준선의 비교값이다. 이 요약은 정렬 JSON 문자열의 해시와 **다른 값**이다 — 섞어 비교하지 않는다.
  `composeProjectIdentity`·`contentIdentity`·`authoredIdentity`(문자열)는 다른 호출부를 위해 남아 있다.
- 스토어의 적용 복제(`eventDraftVault` 의 `projectWithLiveDrafts`·`applyEventDraftVault`)는 `cloneProjectSharingReferenceDocuments` 로 참고문서를 공유하고,
  `shareContentDigests(원본, 복제)` 로 기억을 넘긴다. 기억은 스스로를 설명하는 기록이라 틀린 짝이나 낡은 원본에 붙어도 대조에서 떨어져 다시 계산될 뿐이다.
- `sha256HexTextSync` 폴백은 Int32Array 로 블록을 누적하고 64Ki 문자 창 단위로 `encodeInto` 한다(26MB 문자열 전체 인코딩 없음, 서로게이트 쌍은 창 경계에서 쪼개지 않는다).
- 커밋 기록은 직렬화 문자열을 미리 만들지 않는다(electron 저장소는 쓰지 않고, 메모리 저장소는 없으면 스스로 만든다). 수동 커밋 dedup 은 `lastManualDigest`(저장 형식 보기의 요약)로 비교한다.

실측(같은 VM·같은 대본, 체크포인트 3회): 체크포인트당 긴 작업 10.8/10.1/10.3초 → 2.7/1.8/2.4초, 실행 중 긴 작업 합계 40.5초 → 10.8초.
실행 시작 때 첫 기준선 요약(캐시 없음)은 약 1.1초다. 남은 체크포인트 비용은 `projectLint.checkRoundtrip`(serialize+deserialize), 되돌리기 스냅샷 서명,
스토어 복제, 타일 팔레트 다시 그리기에 흩어져 있다. 테스트: `test/contentDigest.test.ts`, `test/sha256.test.ts`(창 경계) — 이번 세션에서는 사용자 규칙에 따라 실행하지 않았고,
동등성·제자리 수정·기억 넘기기는 실제 26MB 프로젝트로 임시 스크립트에서 확인했다.

## 우클릭 드래그 바 → 채팅 한 경로 («영역 작업» 창 폐기, 2026-09-25)

우클릭 드래그로 뜨는 선택 바(`selectionActionChips.ts`)에 문장을 치고 Enter 를 누르면 **그 문장이 곧바로 조수 채팅 턴**이 된다.
예전에는 같은 문장이 든 「영역 작업」 창(`regionTaskModal`)이 한 번 더 떠서 실행을 다시 눌러야 했고, 그 창은 채팅과 다른 파이프라인
(하드 클립·고스트 미리보기·승인)이라 진행·중단·기록이 둘로 갈렸다. 사용자 판단으로 그 창을 제품 입구에서 뺐다.

- 입구는 전부 `src/editor/aiRegionHandoff.ts` 를 지난다: 드래그 바, 선택 영역 우클릭 메뉴(`✦ 이 영역에 AI 지시…`), 검사 패널의 「AI로 고치기」,
  캔버스 AI 버튼(만들기·다듬기·묻기), 건축 팔레트 AI. 옛 `openRegionTaskModal(options)` 모양은 `openRegionInAssistant` 가 그대로 받아
  `oprn:ai-region-handoff` 이벤트로 바꾼다(`autoRun:false` 면 입력줄에 담기만 한다).
- 채팅(`aiChatPanel.ts` `handleRegionHandoff`)은 선택을 그 영역으로 맞추고 선택 칩을 켠 뒤 `send()` 를 부른다. 선택 영역도 이제
  **Pi 턴**이다 — 범위는 `resolveTurnScope` 가 붙인다. `send()` 의 `sendSelectionRegionTask` 분기와 `aiRegionTaskRunner` 배선은 뺐다.
- 바의 번개 버튼(`selection-chip-stamp`)이 바로 깔기 토글이다. 값은 `src/editor/stampPlaceMode.ts` 하나를 조수 입력줄 토글과 **공유**한다
  (`oprn:ai-stamp-place`) — 어느 쪽에서 켜도 양쪽이 같이 선다. 켜진 채 Enter 면 `stamp:true` 로 넘어가 채팅의 바로 깔기가 돈다(빈 입력 = 숲).
- 다듬기 칩은 `POLISH_INSTRUCTION` 을 일반 채팅 턴으로 보낸다(바로 깔기와 무관).
- 남은 것: `regionTaskModal.ts` 와 `regionTask/*` UI 조각은 e2e 브리지(`editorToolHook` `openModal`)만 쓴다 — 삭제는 후속.
  `test/aiActivityLiveRow` 는 옛 영역 경로로 라이브 행을 몰았으므로 격리했다(Pi 경로로 다시 써야 한다).
- 증거: `verify-shots/drag-toolbar-handoff/` (02: Enter 뒤 창 0개·채팅 말풍선, 06: 바로 깔기로 숲이 바로 깔림).

## 턴 단계 계측과 실행 추론 강도 (2026-09-26)

「프롬프트 하나에 몇 분」의 원인을 짐작하지 않고 읽기 위해, 평문 턴 하나를 단계별 벽시계로 쪼개 활동 로그 행에 싣는다.
그리고 자율성 다이얼이 고른 사고 강도를 **실행 루프**까지 내려보낸다 — 예전에는 다이얼을 「빠르게」로 내려도 실행 턴은 역할 기본값(Deep=high)으로 돌았다.

### 기록은 어디서 만들고 어디에 쓰이나

- 기록기: `src/ai/turnTiming.ts` `createTurnTiming()`. 계약은 **같은 이름의 누적 합**이다 — 쓰기 도구마다 체크포인트 하나, 맵마다 검수 하나가
  한 턴에서 여러 번 돌기 때문이다. 덮어쓰기로 적으면 12번 돈 단계가 1번짜리로 보여 병목이 표에서 사라진다. `snapshot()` 은 읽기 전용이다.
- 만드는 자리: `src/editor/panels/aiChatPanel.ts` 의 `plainPiTurn` — 턴당 하나를 만들고 `"intent"` 를 의도 선언 앞에서 열어 `finally` 로 닫는다.
  선언 한 번이 실제로 1.2~7.5s 를 쓰므로(2026-09-16 실측) 이걸 빼면 표의 total 이 거짓으로 짧아진다. 기록기는 `runPiTurn` → `runPiCommand` 의 `options.timing` 으로 넘어간다.
- 단계 이름(`src/editor/panels/aiPiAgentCommand.ts` 의 `stage(name, run)`, 던져도 `finally` 로 닫는다):
  `plan`(Ultrabrain 계획 턴) · `exec`(실행 런의 `Promise.all`) · `checkpoint`(발행 하나마다) · `review`(맵 조화 검수 + 수리·재검수 루프) · `apply`(`apply()` 경로).
- **단계는 서로 중첩된다 — 합하지 마라.** 이 단계들은 턴을 분할하지 않는다. `checkpoint` 는 `exec` 안에서 돌고(`aiPiAgentCommand.ts:496` 의 `stage("exec")` 안에 `:510` 의 `stage("checkpoint")` 가 들어 있다)
  수리 런의 체크포인트는 `review` 안에서 돈다(`:686`). 수리·재검수 실행 자체도 `review` 로 기록되고, 병렬 그룹(`Promise.all`)에서는 여러 그룹의 `checkpoint` 가 같은 벽시계 구간을 **겹쳐서** 더한다.
  그래서 `totalMs` 는 **턴 벽시계 하나**이고 각 단계 값은 **그 단계의 벽시계 합**이다 — 단계 합은 `totalMs` 를 넘을 수 있고, 실제로 넘는다. 단계 값은 서로 비교해 「어디가 오래 걸렸나」를 보는 데만 쓰고,
  합산해 「나머지 시간」을 유도하거나 백분율로 쪼개지 마라.
- 쓰는 자리: `finishLog` 가 만드는 **그 활동 로그 행 하나**다(`PiRunFacts.timing` → `startPiRunLog` → `AiActivityLogInput.timing` → `AiActivityLogRecord.timing`).
  계측 때문에 두 번째 행을 만들지 않는다 — 그러면 `npm run ai:log` 가 한 실행을 두 건으로 센다.
- 읽는 자리: `npm run ai:trace` (`scripts/list-ai-turn-timing.mjs`). 디스크 미러 `output/ai-activity` 만 읽고, `timing` 없는 행은 건너뛴다.
  `--last N` `--json`. 출력은 `total=턴 벽시계ms` 와 `단계=ms`(처음 열린 순서, 같은 이름은 합)다.

### 다이얼이 실행 루프의 사고 강도를 정한다

- `runPiCommand` 는 `preferCallerThinking = !config.roleModels?.deep` 를 세우고, 실행 런과 수리 런에 다이얼 값(`options.thinkingLevel` = `resolvePiRunPlan(...).thinkingLevel`)을 싣는다.
- **명시적으로 저장한 Deep 역할 모델이 이긴다.** 사용자가 설정에서 역할 모델을 고정했으면 `preferCallerThinking` 이 꺼져 예전 그대로 역할 값을 쓴다.
- 계획 턴·팀 턴은 예전 그대로 Ultrabrain 강도로 돈다(`buildPiRunRequest` 의 `brainRun`) — 계획을 몰래 낮추지 않는다.
- `normalizePiThinkingLevel`(`src/ai/piAgent/thinkingLevel.ts`) 은 google-antigravity 에서만 `off` → `minimal` 로 낮춘다.
  실측: `off` 를 보내면 HTTP 200 스트림에 error 이벤트 `Thinking effort off is not supported by google-antigravity/gemini-3.8-flash. Supported efforts: minimal, low, medium, high` 가 실려 실행이 첫 호출에서 죽는다.

### 실측 (2026-09-26, 동반 서비스 127.0.0.1:17832 직결 · 실제 OAuth · gemini-3.8-flash)

- 작은 프롬프트 모델 호출 1회: effort minimal/low 약 2.2~2.8s, high 약 4.0~5.8s. 전제를 1k→30k 토큰으로 키워도 약 0.5s 밖에 안 움직인다 — **payload 는 지연의 지배 요인이 아니다(1차 실측 n=1).**
  단 아래 n=3 재실측에서는 2k→30k 이 low 중앙값 2080→4101ms 로 더 벌어졌다 — 「+0.5s 뿐」은 1차 실측 한정이고, 남는 결론은 「payload 는 effort 보다 작은 2차 요인」이다.
- 읽기 전용 3턴 도구 사용 Pi 실행: thinking low 6.36s / 7.41s, high 9.09s / 8.47s → 턴당 약 2.1s(low) 대 약 2.9s(high). 로컬 도구 실행은 ~0ms 라 턴 벽시계는 사실상 모델 호출의 합이다.
- **n=3 재실측(2026-09-26T01:06–01:07Z, `provider-reps3.json` · `agent-reps3.json`) — high는 low의 「2배」가 아니다.**
  셀당 3회 중앙값: 모델 호출 1회 low 2080ms(2k) / 4101ms(30k), high 3196ms(2k) / 6344ms(30k) → **1.54× · 1.55×**.
  실제 Pi 런(1턴·툴 0회) low 3957ms, high 5365ms → **1.36×**. 정직한 값은 **약 1.28~1.36배(Pi 런) · 1.54~1.55배(모델 호출 1회)** 다 — 반값이 아니다.
  표본 분산이 크다(low @30k 가 2832~6413ms) — 이 박스는 부하를 나눠 쓰므로 중앙값만 인용한다. n=3 에이전트 런 6행은 전부 `turns=1 · tools=0` 으로 끝나서 위 3턴 실측(3턴·툴 2회)과 조건이 다르다 — 두 실측을 섞어 평균하지 않는다.
- 프롬프트 캐시: 같은 접두를 다시 보낸 실행이 cacheRead 12,021 토큰을 보고했다 — 공급자의 암묵 접두 캐시가 실행 사이에도 이미 듣는다. 세션 id 를 바꿀 필요는 없다.
- 프로브: `scripts/qa/_ai-turn-latency-probe.mjs` (`provider` / `agent` 모드), 증거 `verify-shots/ai-turn-latency/`.
