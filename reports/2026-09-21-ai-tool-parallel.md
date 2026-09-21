# 단독 AI 조수 병렬 도구 실행 — 2026-09-21

팀을 켜지 않아도 독립적인 조회·검색·Writer 요청을 함께 실행한다. 기존 DEFAULT/AUTO/YOLO/
단계별 적용은 모든 레지스트리 도구를 `executionQueue`에 넣어, 모델이 함께 호출한 검색도
하나씩 실행했다. 읽기 도구에도 전체 프로젝트 변경 비교가 붙었다.

Pi 코어의 `shared`/`exclusive` 스케줄러를 사용하도록 바꿨다. 연속된 읽기는 겹쳐 실행하고,
쓰기는 앞선 호출이 끝난 뒤 실행하여 checkpoint 적용까지 단독 점유한다. 다음 읽기·쓰기는
승인된 프로젝트를 받는다. `finish_stage`도 승인 완료까지 같은 장벽을 유지한다.
최초 노출·도구 발견·미노출 호출 복구 모두 레지스트리의 동일한 read/write 분류를 사용한다.
기본 프롬프트는 독립 호출 묶음과 결과/생성 ID에 의존하는 후속 턴을 구분해 지시한다.

승인 거절 테스트에서 발견한 기존 표시 문제도 수정했다. 초안 작성이 성공했어도 적용이 실패하면
`tool_end`는 앞서 기록한 성공 영수증 대신 코어의 실패 결과를 보고한다.

## 실제 모델과 실제 웹 검색

`bun scripts/qa/ai-tool-parallel-live.mts`는 **mode=single, applyMode=default**에서 정상
시스템 프롬프트를 사용한다. 쓰기 도구를 허용하지 않고, checkpoint 발생도 실패로 처리한다.
프로젝트 제목 조회와 SQLite WAL/IndexedDB 공식 자료 검색을 요청했다. 병렬 호출을
하드코딩하거나 모델 스트림을 대체하지 않았다.

- 실제 조수 모델: `google-antigravity / gemini-3.7-flash` (제공자의 기본 선택).
- 모델이 첫 응답에 프로젝트 조회와 검색 2건을 함께 호출했다.
- 두 검색의 HTTP 시작: 모두 실행 시작 후 **2,168ms**.
- 검색 완료: **14,734ms / 16,765ms**. 검색 대기 구간은 약 **14.6초**.
- 최대 동시 검색 수 **2**, 도구 오류 **0**, 변경된 프로젝트 키 **0**.
- 총 실행 약 **19.6초**, 모델 2턴, 도구 3회.

원본: [live/result.json](../.omo/evidence/ai-tool-parallel/live/result.json).
이 수치는 한 번의 실측이며 모든 모델/제공자의 호출 묶음이나 전체 작업 속도를 보장하지 않는다.
제공자의 다중 호출 제한은 변경하지 않았다.

## 수정 전·후 제어 실험

실제 Pi Agent 루프·레지스트리·웹 검색 파서·checkpoint 콜백을 사용했다.
모델 출력과 외부 검색 HTTP 응답만 제어했다. 각 검색 응답은 200ms 뒤 반환한다.

| 측정 | 수정 전 (`81123682b`) | 수정 후 |
|---|---:|---:|
| 최대 동시 검색 수 | 1 | 2 |
| 두 HTTP 시작 간격 | 272.3ms | 0.2ms |
| 첫 검색 시작 → 마지막 검색 종료 | 473.4ms | 204.2ms |

원본: [before/timing.json](../.omo/evidence/ai-tool-parallel/before/timing.json),
[after/timing.json](../.omo/evidence/ai-tool-parallel/after/timing.json).
이는 검색 실행 구간의 비교이며 사용자 요청 전체 처리 시간의 배속 주장이 아니다.

음성 대조에서는 변경한 구현 파일 4개를 기준선으로 되돌린 뒤 동일한 신규 테스트를 실행했다.
신규 12건 중 10건이 실패했다. 검색 동시 시작, 실제 시작을 나타내는 도구 이벤트,
적용 실패 표시, 동시 취소를 검출한다. 파일은 사본에서 바이트 단위로 복원했다.
[기준선 로그](../.omo/evidence/ai-tool-parallel/before/tests.log),
[실제 종료 코드와 커밋](../.omo/evidence/ai-tool-parallel/before/status.json).

기존 도구 발견 테스트 3건은 기준선에서도 실패했다. 참조 조회/웹 검색/밑그림 도구의 상시 노출을
기대 목록이 반영하지 못한 상태였다. 정확한 집합 비교와 읽기 전용/역할 경계 단언은 유지하면서
현재 계약으로 기대 목록을 갱신했다. 제품의 도구 권한을 넓히지는 않았다.

## 최종 검증

- Bun 실제 Agent 루프 테스트 **33/33 통과**, exit 0.
- Vitest 어댑터·팀·Writer·프롬프트 테스트 **32/32 통과**, exit 0.
- 앱 타입 게이트 **오류 0 / 회귀 0**, exit 0.
- 실제 모델·실제 검색 스모크 exit 0.

```bash
AI_PARALLEL_EVIDENCE_DIR=.omo/evidence/ai-tool-parallel/after bun test \
  test/piToolConcurrency.bun.test.ts test/piApplyModes.bun.test.ts \
  test/piAgentToolEscalation.bun.test.ts test/piAgentTeamMessaging.bun.test.ts \
  test/piAgentAbortReason.bun.test.ts

node scripts/run-vitest.mjs run test/piAgentToolAdapter.test.ts \
  test/piAgentTeamRuntime.test.ts test/piWriterTool.test.ts \
  test/piAgentSystemPromptHousePolicy.test.ts --maxWorkers=2 --minWorkers=1

npm run gates -- --only typecheck
bun scripts/qa/ai-tool-parallel-live.mts
```

검증 범위: 적용 모드 5종, 동일 응답의 쓰기/조회 순서, 미노출 쓰기 복구, 승인 대기/거절,
검색 일부 실패 후 복구, 중단 시 두 검색 취소와 후속 쓰기 차단, 호출 ID별 결과 연결,
기존 팀 배정·메일함·맵 소유권. 전체 테스트 스위트와 브라우저 UI 검사는 실행하지 않았다.
동기 타일 연산의 CPU 병렬화나 여러 쓰기의 동시 실행은 이 변경의 범위가 아니다.

[검증 요약](../.omo/evidence/ai-tool-parallel/summary.json),
[Bun 로그](../.omo/evidence/ai-tool-parallel/after/bun.log),
[Vitest 로그](../.omo/evidence/ai-tool-parallel/after/vitest.log),
[타입 게이트 로그](../.omo/evidence/ai-tool-parallel/after/typecheck.log).
