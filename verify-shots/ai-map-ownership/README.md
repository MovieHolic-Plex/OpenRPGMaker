# 맵당 조수 최대 한 명 — 실행 근거

## 세 맵 각각 한 명 — 실제 모델 추가 관측

`node scripts/qa/ai-parallel-live-evidence.mjs --three-maps`

2026-10-04 실제 Firefox → runPiCommand → companion → Gemini 3.8 Flash.
서로 독립인 임시 A/B/C 맵을 읽기 전용으로 실행하고, 각 맵에 브라우저 중복 호출과 서버 직접 호출을 각각 넣었다.

- 세 실행의 start→done 수신 구간이 **5,709ms** 겹쳤다. 전체 최대 **3명**, A/B/C 각각 최대 **1명**.
- 각 맵의 브라우저 중복 호출은 false를 반환하고 추가 HTTP 요청을 보내지 않았다.
- 각 맵의 서버 직접 요청은 **409 map-busy**였다. 세 거절 runId 모두 start 이벤트가 없다.
- 실제 조회 도구 호출 A 1회 / B 2회 / C 3회, 세 실행 정상 완료, toolErrors 0, changedKeys 빈 배열.
- 실행 전후 프로젝트 JSON 일치, 페이지 오류 없음. 11개 관측 조건 모두 충족.

원본: [three-maps/timeline.json](three-maps/timeline.json), [중복 차단 화면](three-maps/03-duplicate-blocked.png).
`fixtureMapIds`, `requests`, `events`, `ownership`, `perMapPeak`, `globalPeak`에 원본과 계산 결과를 보존한다.
타임라인은 동일한 브라우저 performance.now 시계이며, 제공자 내부 스케줄러의 시각을 주장하지 않는다.
최초 heavy-missing 409 재전송은 중복 실행이 아니다. status 200으로 수신한 서로 다른 runId만 실행으로 센다.

## 실제 모델 경로

`node scripts/qa/ai-parallel-live-evidence.mjs --map-ownership`

실제 Firefox 편집기 → `runPiCommand` → companion → Gemini 3.8 Flash.
A/B는 서로 하위 관계가 없는 임시 fixture 맵이며, 읽기 전용이다. 이벤트 주입·응답 지연·모델 스텁은 없다.

- A/B 조회 실행의 start→done 수신 구간이 6,580ms 겹쳤다.
- A 실행 중 같은 A로 `runPiCommand`를 다시 호출하면 false를 반환한다. 추가 모델 요청을 보내지 않았다.
- 브라우저 함수를 거치지 않고 companion HTTP에 A를 직접 요청해도 409 `map-busy`를 반환했다.
- A 종료 후 B가 2,074ms 더 진행했고, 상태판은 B 진행/A 완료를 유지했다.
- 양쪽 정상 종료, 변경 키 없음, 실행 전후 프로젝트 JSON 일치, 페이지 오류 없음.

원본: [live/timeline.json](live/timeline.json), [중복 차단 화면](live/03-duplicate-blocked.png).
live/timeline.json의 요청 중 최초 두 409는 heavy-missing 재전송이며, 마지막 409가 map-busy다.
같은 runId의 재전송을 새 실행으로 세지 않는다. 시각은 브라우저 수신 시계이며 제공자 내부 스케줄러의 시각이 아니다.

## 완료·실패·배정 경계

`bun scripts/qa/ai-map-ownership.mts`

실제 relay·팀·바로 깔기 대기열에 완료를 제어하는 워커를 붙인다. 모델 스텁을 쓰는 이 관측은 위 실모델 근거와 구분한다.
결과: [controlled.json](controlled.json).

- 중복 맵/하위 맵 호출은 워커 시작 전에 차단; 다른 맵은 병렬.
- 검수 중 시공·재검수·프로젝트 작업·조기 finish 차단.
- 연결 단절/중단 요청 뒤 워커가 멈추기 전에 예약을 유지.
- 완료·오류·시작 실패 뒤 맵 재사용 가능.
- 한 자식이 실패해도 다른 자식이 실행 중이면 부모 예약 유지.
- 같은 맵의 떨어진 영역 주문도 FIFO 직렬; 다른 맵의 주문은 병렬.

## 범위

companion의 예약은 한 companion 프로세스에서 프로젝트 키를 공유하는 Pi 실행을 보호한다.
바로 깔기와 Pi의 공용 예약은 한 브라우저 안에서 공유된다. 서로 다른 companion 호스트들 사이의 분산 잠금,
사람 편집 잠금이나 SQLite 저장 충돌 자체를 검증한 결과는 아니다. 저장/기준본 수용 검사는 유지한다.
전체 vitest/typecheck/gates는 실행하지 않았다.
