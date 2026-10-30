# 주간 일정표 (planSchedule / runSchedule)

학원물·육성 시뮬의 「슬롯마다 활동을 골라 한 주를 짠다」 화면을 일반 엔진 기능으로 둔 것이다. 특정 게임 전용이 아니다.

## 데이터
- `project.database.schedules?: ScheduleRecord[]` — 없으면 옛 JSON 과 바이트 동일. 빈 배열은 절대 만들지 않는다(편집기 삭제가 마지막 레코드를 지우면 속성째 제거). `defaultDatabase` 에 넣지 않는다.
- `ScheduleRecord {id, title, slots:{label}[], activities:{id,label,description,hint?,icon?,condition?,maxUses?,commonEventId}[]}`.
  `icon` = `{kind:"item",itemId}` | `{kind:"tile",tilesetId,tileId}`(타일은 글자 대체 표시), `condition` = `EventPageCondition`.
- 정규화·한도: `src/project/schedule.ts` (슬롯 14 · 활동 40 · 레코드 40 · maxUses 9999). 로드와 직렬화 양쪽이 이 함수를 지난다.

## 명령
| kind | 필드 | 동작 |
|---|---|---|
| `planSchedule` | `scheduleId`, `slotCount?` | 480×270 정수배 오버레이. 위에 슬롯 칩, 아래에 활동 카드. 조건이 거짓이면 숨김, `maxUses` 도달 시 흐리고 선택 불가. 방향키/WASD+Enter/Space, Esc/Backspace 는 마지막 선택 취소, 클릭·터치 가능. 슬롯이 다 차면 「확정」. 결과를 `session.schedulePlans[scheduleId]` 에 저장 |
| `runSchedule` | `scheduleId`, `slotVariableId?` | 저장된 계획을 순서대로 실행. 슬롯마다 `slotVariableId`(1부터) 설정 → 활동의 공용 이벤트 호출 → `session.scheduleUses` 증가 |

- 일시정지/재개는 `presentItem` 과 같은 경로다: `commandCatalog.planSchedule` 이 `pause("planSchedule", {view})`, `resume.ts` 가 `storeSchedulePlan` 후 pc+1. 보기 만들기·선택 정리는 `src/player/interpreter/schedule.ts`, 화면은 `src/player/playScenePlanSchedule.ts`, CSS 는 `src/styles/runtime/schedule.css`.
- `runSchedule` 은 공용 이벤트 프레임을 쌓고 pc 를 올리지 않아 끝난 뒤 같은 명령으로 돌아와 다음 슬롯을 한다.
- 공용 이벤트가 다른 맵으로 옮겨도 이어진다: `session.scheduleRun = {scheduleId, index, slotVariableId?}` 대기열을 맵 진입 경로(`fireAutoTriggers` 끝의 `resumeScheduleRun`)가 다시 연다. 마지막 슬롯 뒤 지워진다.

## 세션 필드 (비면 생략, 저장 파일에 포함)
`schedulePlans?: Record<scheduleId, activityId[]>` · `scheduleUses?: Record<scheduleId, Record<activityId, number>>` · `scheduleRun?`.

## 편집기
- 자료집 탭 「일정표」: `src/editor/panels/databaseScheduleView.ts` (목록 + 슬롯/활동 레코드 화면). 공용 이벤트 선택, 아이템 아이콘, 사용 한도, 스위치/변수 조건. 다른 종류 조건은 보존하고 바꾸면 대체된다. 삭제는 명령이 참조 중이면 막힌다(`scheduleReferenceMessage`).
- 이벤트 편집기 명령 폼은 `COMMAND_KINDS` 등록으로 자동 생성되고, 참조 검증은 `commandReferenceValidation.ts`(`scheduleId가 존재하지 않습니다`).

## 조수
- 도구 `list_schedules`(읽기), `upsert_schedule`(쓰기, 고정 속성·additionalProperties false·빈 문자열 enum 없음): `id, title, slots[{label}], activities[{id,label,description,commonEventId,hint?,iconItemId?,maxUses?,conditionSwitchId?,conditionSwitchValue?,conditionVariableId?,conditionVariableOp?,conditionVariableValue?}]`. `src/editor/tools/scheduleTools.ts`.
- 조수 이벤트 명령 스키마(`eventCommandAssist.ts`, `schemaShapes.ts`)가 두 명령을 받는다. 레시피 `schedule-planner`(`toolCapabilityIndex.ts`), 스킬 `assistant-skills/game-scene-polish/SKILL.md` §9.
- 한계: 도구로는 타일 아이콘과 스위치/변수 밖 조건을 못 쓴다(자료집 화면·JSON 은 가능).

## 알려진 한계
- 타일 아이콘은 글자로 대체 표시. 같은 scheduleId 의 낡은 `scheduleRun` 은 새 계획을 저장할 때 지워진다. 선택이 0개일 때 Esc 는 아무것도 하지 않는다.
