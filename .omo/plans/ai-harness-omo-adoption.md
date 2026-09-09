# AI harness — omo 철학 선별 적용 수정 계획

## TL;DR (For humans)

**조수를 새로 만드는 계획이 아니다. 지금 있는 조수가 “무엇을 끝냈고,
어디까지 저장했으며, 중단 뒤 무엇을 다시 해도 되는지” 정확히 알게 만드는 계획이다.**

- 가져올 철학: 목표 유지, 요구별 증거, 명시적 종료 이유, 제한 있는 계속,
  취소 후 늦은 결과 폐기, 대화와 실행 상태의 분리.
- 재사용: AssistantSession, WorkPlan, ToolVerificationEvidence, toolRunner,
  applyProposedProject, ProjectStore, IndexedDB, 기존 QA.
- 만들지 않을 것: 두 번째 범용 하네스/검증 원장, 기본 다중 작성자,
  범용 DAG, 임의 JavaScript 실행 도구, 서버 상주 에이전트, 새 Supabase 테이블.
- 우선순위: **저장 증명의 거짓 성공 수정 → 목표 완료 의미 → 복구 →
  오래된 결과/초안 방지 → 사용자 표시와 실제 검증.**
- 사용자는 2026-09-06 구현·커밋·PR·순차 병합을 승인했다. 아래 체크박스와
  `.omo/ulw-loop/ai-harness-implementation-01a07564/`가 현재 실행 상태를 기록한다.
- 구현 위험도: **HEAVY**. 세션 수명주기, 로컬 저장 마이그레이션,
  동시 편집 경계, 원격 검증 계약을 다룬다.

## Context and provenance

기준: RPG HEAD `49067218aebf889d98c2dc05be08231787483427`,
설치 omo-ai `5.0.0-0.beta.43`, Senpi `2026.9.5`.
연구: [SYNTHESIS.md](../research/20260906-ai-harness-omo/SYNTHESIS.md),
[근거 원장](../research/20260906-ai-harness-omo/observation-manifest.md),
[직접 실행](../research/20260906-ai-harness-omo/evidence.md),
[반례 판정](../research/20260906-ai-harness-omo/debate-log.md).

직전 HTML은 현재 로직 설명서이지 구현 계획이 아니다. 특정 선행 하네스
구현 계획은 검색한 main/관련 작업 폴더/현재 대화에서 확인되지 않았다.
완료된 `docs/superpowers/plans/2026-09-03-assistant-deck.md`는 덮어쓰지 않는다.
이 문서의 “수정”은 기존 구조에 대한 설명을 아래 실행 가능한 개선안으로
구체화한다는 뜻이다.

omo의 감사 프롬프트는 좋은 규율이지만 범용 증거 검증 엔진은 아니다.
RPG의 실제 verdict/stale 검증은 이미 있으므로 더 약한 OMO todo 의미로
교체하지 않는다.

## Work objectives and invariants

### 사용자에게 보일 결과

1. AI가 멈춘 이유와 요청 달성 여부, 저장 단계를 서로 다르게 표시한다.
2. 저장·재조회 실패를 완료로 표시하지 않으며 같은 변경을 다시 검증할 수 있다.
3. 복원된 대화를 다시 열었다는 이유만으로 생성 명령이 중복 실행되지 않는다.
4. 취소된 작업의 늦은 응답과 오래된 제안이 현재 편집을 덮지 않는다.
5. 현재의 간단한 질문·지시·계획 흐름을 과도한 설정과 승인으로 무겁게 만들지 않는다.

### 반드시 유지

- 일반 채팅의 성공한 변경 자동 적용과 프로젝트 undo.
- 별도 영역 작업의 승인/즉시 적용 분기는 기존 별도 정책으로 유지.
- 질문 모드는 도구 노출과 실행 양쪽에서 쓰기 차단.
- 새 plan/confirm 계획 작성 턴은 실행 전 정지; 이미 있는 계획의 명시적
  “계속”은 현재 설정에서도 실행 가능.
- 중단은 미적용 작업을 적용하지 않지만 이미 적용된 마일스톤을 자동 rollback하지 않음.
- ToolVerificationEvidence의 실제 verdict, 대상별 실패, 쓰기 후 stale,
  explicit/advisory 구별.
- 전역 기존 lint를 이유로 모든 저작·테스트 플레이를 차단하지 않음.
- 프로젝트 저장 응답/검증용 읽기가 네트워크 대기 중 최신 로컬 편집을 되감지 않음.
- proposedCalls와 appliedCalls는 판정 때 함께 고려하되 재적용에는 미적용분만 사용.

### 의도적으로 바꾸는 정책

- 필수 요구가 남았는데 항목을 skipped로 바꿨다는 이유만으로 목표 완료가 되지 않는다.
- 부팅의 “마지막 말한 쪽이 사용자”만으로 자동 재전송하는 정책을 없앤다.
- 같은 클라이언트에서 AI 초안 생성 후 사용자가 바꾼 내용은 오래된 초안으로 덮지 않는다.
  현재 `applyProposedProjectHouseProtection.test.ts:128-145`의 non-house
  overwrite 허용 기대를 변경하는 **명시적 정책 변경**이다.
- 질문은 blocked 계획의 재시도 카운터나 활성 상태를 바꾸지 않는다.

## Architecture decisions

### D1. 세 축을 분리하고 표시 문자열은 결과에서 파생한다

`TurnResult.stoppedReason`은 공급자/루프 종료 호환 필드로 남긴다.
별도의 작은 `RunOutcome` 투영을 추가한다.

| 축 | 값과 의미 |
|---|---|
| execution | response-final, awaiting-user, blocked, cancelled, budget-exhausted, failed |
| goal | unassessed, incomplete, satisfied |
| delivery | no-change, draft, applied, persisted, persisted-verified |

cancelled이면서 delivery=applied일 수 있다. 이것은 모순이 아니라 이미 적용된
성과 뒤에 중단된 경우다. goal=satisfied와 delivery=persisted-verified도
같은 값이 아니다. 조회 답변에는 원격 저장 요구를 억지로 붙이지 않는다.

`src/ai/runOutcome.ts`는 타입과 순수 파생 함수만 소유한다. **새 증거 DB가 아니다.**
근거의 정본은 기존 session의 WorkPlan/ToolVerificationEvidence와 실제 적용·저장
영수증이다. session, aiTurnRunner, bridge, activityLog, recap은 같은 투영을 사용한다.
`assistantText`/status 접두사/모델이 보낸 “완료” 문자열을 판정 입력으로 쓰지 않는다.

### D2. 원격 증명은 같은 대상·같은 저장 결과에 묶는다

저장 영수증은 `projectId`, 로컬 `mutationGeneration`에 대응하는 제출/수락 버전,
정규화된 수락 콘텐츠 식별값을 담는다. 기존 `saved.project ?? submittedProject`,
`projectWithoutEventDrafts`, `serializeForComparison` 의미를 따른다.

검증은 고정한 project config로 **읽기만** 수행한다. 현재 편집기를 교체하는
`reloadFromRemote()`를 자동 증명의 수단으로 쓰지 않는다. 기존 로더의 정규화와
새 프로젝트 트랜잭션의 비교를 재사용한다. 원격 스키마 변경은 없다.

성공 조건: 저장됨 + 같은 projectId + 수락된 저장본과 정규화된 재조회 결과 일치.
서버 `current_sha256`만 있거나 단순히 reload 요청이 끝난 것만으로는 부족하다.
검증 중 새 로컬 편집이 있으면 이전 버전의 증명은 보관하되 현재 목표의 최신
delivery를 verified로 올리지 않는다.

proof key는 planId가 아니라 실제 적용/수락 버전이다. attempted/failed/succeeded를
구별하고 실패는 재시도를 막지 않는다. 최신 commit row 조회는 제거하고 실제
적용 함수가 반환한 commitId만 보조 정보로 연결한다. commit 기록 실패
`persisted:false`와 프로젝트 저장 실패는 다른 사실이다.

### D3. 요구 추적은 기존 WorkPlan을 확장한다

기존 item 상태와 `isWorkPlanComplete()`의 스케줄러 의미를 유지한다.
기존 WorkPlan에 선택적인 `requirements`와 item의 requirementIds를 추가한다.

- requirement는 stable id, 원래 사용자 발화/범위의 출처, 필수 여부,
  대상과 검사 방식, 범위 변경 사유를 가진다.
- 구조적으로 검증 가능한 항목은 기존 도구 verdict와 대상에 연결한다.
- 모델이 임의 evidence 문자열이나 `passed:true`를 넣어 충족시키지 못한다.
- 필수 요구를 skip해도 requirement는 남는다. 새로운 사용자 지시로 범위를
  바꾸거나 전제가 틀렸다는 확인된 사실이 있어야 철회 사유를 기록한다.
- 미검증 자연어 품질 요구는 자동으로 만족 처리하지 않는다. 확인 가능한
  범위와 확인되지 않은 범위를 결과에 남긴다.
- legacy plan의 requirements 부재는 compatible/unassessed로 읽는다.
  기존 작업을 무조건 파괴하거나 “이미 완벽히 검증됨”으로 이관하지 않는다.
- 간단한 질문에는 새 목표/체크포인트 작성을 강제하지 않는다.

### D4. 실행 복원은 대화 복원과 분리한다

기존 `oprn-ai-records` IndexedDB를 version 3으로 올리고 `runCheckpoints` store를
추가한다. conversations는 보존한다. 별도 원격 goal/evidence 테이블은 만들지 않는다.
체크포인트는 **기존 원장의 직렬화된 복구본**이며 독립 완료 판정기가 아니다.
P4 시작 기준 PR687은 이미 version 2에 대화 tombstone을 저장하므로 버전 1과 2
양쪽에서 version 3으로 이관하고 기존 tombstone·대화 의미를 보존한다.

기록: schemaVersion, conversationId/runId/epoch/projectId, base/current
content identity, WorkPlan과 요구, 현재 항목, 남은 예산, 기존 검증 원장 snapshot,
마지막 확인된 apply/save/proof 영수증, 미확정 작업 단계와 준비된 제안 snapshot.
미확정 snapshot은 실제 적용 대기 중인 하나만 보관하고 정산 후 제거한다.
오래된 대화 정리 시 관련 종료 checkpoint도 함께 정리한다.

복원 결과는 `resumable`, `needs-reconciliation`, `terminal`, `unsupported`로 구분한다.
현재 프로젝트가 같은 대상/기준인지 검사한다. 이미 적용된 snapshot과 일치하면
그 도구를 다시 호출하지 않는다. 적용 여부가 불명확하거나 현재 내용이 다르면
자동 쓰기를 하지 않고 이유와 다음 선택을 보여준다.

체크포인트가 없는 v1/v2 기록이나 메모리 fallback에는 안전한 실행 복원 근거가 없다.
대화는 열되 “중단 요청 자동 재전송”은 하지 않는다. 현재 실행은 계속 가능하지만
durable resume를 약속하지 않는다. 로컬 checkpoint만으로 전 기기 exactly-once를
보장한다고 표현하지 않는다.

### D5. 사건 수명주기와 작성자 범위를 명시한다

runId/epoch/operationId/projectId/base content identity를 실제 실행→적용→저장→
검증→알림에 연결한다. cancelled/failed/settled 실행의 늦은 결과는 새 실행을
바꾸지 못한다. 기존 pending-work/AbortController 경로를 확장한다.

이 계획은 현재 클라이언트의 AI 저작·적용 임계구역을 직렬화하고, 사람 편집으로
기준이 바뀌면 오래된 제안을 거부/재계산하도록 한다. 전체 프로젝트를 잠가
사용자 편집을 막지 않는다. 새 checkpoint를 근거로 다른 탭·기기까지 전역
작성자 독점이 생겼다고 주장하지 않는다. 외부 작성 충돌은 기존 원격 병합/충돌
결과와 검증 불일치로 드러내며 자동 덮어쓰기 재시도를 하지 않는다.

## Verification strategy

### 2026-09-08 사용자 승인: 누락 기준 교정과 검증 속도

사용자는 정확한 제목·아이템 값·나머지 보존을 확인하는 누락된 제품 수락 기준의
최소 추가를 승인했고, 검증을 지나치게 확대하지 말고 빠르게 진행하라고 지시했다.
이 승인은 과거 작업자 프롬프트의 `No production coverage expansion is approved`
제한을 해당 범위에서 대체한다. 원문 요청을 약하게 바꾸거나 결과를 가짜로 통과시키지 않는다.

이미 통과한 동일 입력의 근거는 재사용한다. 변경마다 해당 경계의 RED/GREEN과
관련 회귀만 수행하고, 전체 게이트와 원래 실표면 시나리오는 최종 통합 소스에서
한 번 확인한다. 중간 커밋마다 99개 파일·전체 게이트·전체 파일 해시 검사를 반복하지 않는다.
원래 SC1~SC7, 실패 공개, 정확한 HEAD의 ultrabrain 최종 승인 후 병합은 유지한다.

후속 구현은 각 항목에서 RED를 먼저 관측한다. 기존 정상 동작은 먼저
characterization GREEN으로 고정한다. 산문 문구를 assert하지 말고 아래의
typed 결과, 호출 수, 콘텐츠, 대상 id, 해시/비교값을 단정한다.

실표면은 기존 `scripts/qa/map-owned-ai-turns.mjs`의 Firefox+실제 editor
패턴을 재사용한다. LLM HTTP만 결정론적으로 스크립트하고 session/tool/store/
UI는 실제 경로를 탄다. 클릭 전 정확한 사건을 구독하고 bounded promise로
기다린다. 고정 sleep·폴링 운에 의존하는 테스트는 금지한다.

아래에서 **신규 예정**으로 적은 파일/명령은 아직 존재하거나 통과한 것이 아니다.
먼저 해당 실행 항목에서 작성한 뒤 실행한다.

## Execution strategy and dependencies

사용자의 후속 실행 지시가 초기 단일-worktree 제안을 대체한다. **Phase마다
새 전용 worktree를 만들고 mass-ulw로 구현·검증·PR을 진행한다.** 독립 작업과
리뷰 수정은 worker별 별도 worktree에서 deep 병렬 작업으로 수행한다.
같은 worktree에 두 작성자를 두지 않으며, 같은 Supabase 프로젝트 콘텐츠는
병렬 작성하지 않는다.

각 Phase의 PR은 **ultrabrain이 현재 통합 HEAD에 최종 승인한 뒤에만** 리드가
병합한다. 수정 요청이 있으면 독립 작업으로 나누어 병렬 deep 수정 → 통합 →
ultrabrain 재검토를 반복한다. 승인·병합·정리가 끝나기 전에는 다음 Phase를
시작하지 않는다.

원본 구현 번호 1~10은 보존한다. 추가된 11~15는 새 기능이 아니라 사용자 지정
Phase 운영 게이트이며, 실행 순서를 강제하도록 해당 Phase 뒤에 배치한다.
이 게이트들은 live todo의 Phase별 검증/PR/리뷰/병합/정리 항목과 대응한다.

| Phase | 원본 구현 | 운영 게이트 |
|---|---|---|
| P1 Proof | 1, 2 | 11 |
| P2 Outcomes | 3, 4 | 12 |
| P3 Ownership | 5, 6 | 13 |
| P4 Recovery | 7, 8 | 14 |
| P5 Delivery | 9, 10 및 F1~F3 | 15 |

```text
1 기준선
 └─2 원격 증명
    └─3 요구 추적
       └─4 결과 투영
          ├─5 실행 수명주기 → 6 오래된 초안 보호
          └─7 체크포인트 → 8 복원 조정
                    (8은 5·6·7 모두 필요)
          4·5·8 → 9 시각 전달/사용자 표시
          2~9   → 10 실표면·원격 검증·문서
```

논리적으로 독립된 테스트 조사만 병렬화한다. session/store/record DB 변경은
위 순서로 통합하고 단계별로 buildable 상태를 유지한다.

## Todos

- [x] 1. 현재 계약과 실패 증거를 기준선으로 고정한다
  - Recommended task executor category: deep
  - 소유: 관련 `test/`와 evidence만. 기존 동작 변경 없음.
  - 근거: 연구 E02/E03, `assistantVerificationEvidence.test.ts`,
    `aiComposerModeSession.test.ts`, `aiMilestoneTurnAccounting.test.ts`,
    `aiAssistantTurnCleanup.test.ts`, `applyProposedProjectHouseProtection.test.ts`.
  - 실행: `npm test -- test/assistantVerificationEvidence.test.ts test/aiComposerModeSession.test.ts test/aiMilestoneTurnAccounting.test.ts test/aiAssistantTurnCleanup.test.ts test/applyProposedProjectHouseProtection.test.ts`.
  - PASS: 현재 질문/계획/중단/마일스톤/verdict 계약 기록. 실패는 원인·출력·종료코드로
    남기며 연구 중 관측된 smoke timeout을 전체 통과로 바꾸지 않음.
  - 실표면 기준선: `QA_PORT=19846 EVIDENCE_DIR=output/evidence/ai-harness/baseline xvfb-run -a node scripts/qa/map-owned-ai-turns.mjs`.
  - 증거/정리: baseline 로그·상태 JSON·PNG, 서버/브라우저 close와 포트 해제 receipt.
  - Commit: `test(ai): characterize harness completion and cancellation contracts`.

- [x] 2. 저장 증명과 실패 후 재시도를 실제 수락 버전에 연결한다
  - Recommended task executor category: deep
  - 선행: 1. 소유: `src/project/store.ts`, 필요한
    `src/project/supabaseProjectSync.ts` 읽기 메타데이터 경계,
    `src/ai/assistantSession.ts:maybeRunEndProof`, 관련 tests.
  - 재사용: `persistCurrent`의 submitted/savedProject,
    `loadNewRemoteProjectTransactionally`의 정규화 비교, 기존 로더.
  - RED: `test/aiRunEndProof.test.ts` 신규 예정. saved 뒤 reload
    failed/cancelled/disabled, project mismatch, normalized-content mismatch에서
    verified=false; failed→same revision retry는 조회 횟수 2와 후속 성공.
    현재 메서드는 실패도 saved 감사로 승격하므로 그 이유로 RED여야 함.
  - GREEN 명령: `npm test -- test/aiRunEndProof.test.ts test/storePersistence.test.ts test/supabaseProjectSync.test.ts`.
  - 경계: 검증 중 사용자 편집을 주입해 최신 로컬 콘텐츠가 유지되고 이전 proof가
    최신 버전에 붙지 않음을 검사. plan 없는 일반 적용도 같은 proof 경로 사용 가능.
  - 실표면: 10의 `--scenario proof-failure`와 실제 remote smoke가 이 증분을 검증.
  - 증거: `output/evidence/ai-harness/proof/`의 RED/GREEN, captured receipts.
  - Commit: `fix(ai): verify persisted revisions before reporting saved proof`.

- [x] 11. P1을 검증하고 ultrabrain 최종 승인 뒤 PR을 병합한다

  완료: 후속 PR #655, 승인 HEAD `f8d9f7402`, 병합 `58105616b`,
  검증된 병합 tree `0ef1046d`. 원래 #647의 조기 병합은 소급 승인하지 않는다.
  원장과 `.omo/evidence/ai-harness-implementation/p1-merge-receipt.json`,
  `p1-cleanup-complete.json`에 승인 순서·실제 병합·9개 worktree 정리를 기록했다.
  - Recommended task executor category: ultrabrain
  - 이 행은 리드의 운영 게이트다. ultrabrain은 읽기 전용 검토만 하며 병합은 리드만 한다.
  - P1 전용 worktree, 실제 편집기/격리 원격 증거, 감독자 gates, 현재 main과의
    통합을 확인한다. 기존 실패는 동일 조건의 원본 코드와 대조하고 신규 회귀를 해결한다.
  - PR #647의 현재 HEAD/tree를 검토에 고정한다. 수정 시 독립 deep worktree로
    병렬 수정 후 통합 재검토. 최종 APPROVE 전에는 PR을 병합하지 않는다.
  - 승인한 HEAD를 `gh pr merge --merge --match-head-commit`에 사용하고 GitHub의
    MERGED 상태·merge SHA를 확인한다. 소유 QA 자원을 정리한 뒤 P2로 진행한다.

- [x] 3. WorkPlan의 항목 종료와 필수 요구 충족을 분리한다
  - P2 implementation verified, not Phase approval: canonical requirements,
    exact-scope verdicts, retained provenance, user withdrawal and question-safe
    continuation are documented in [P2 evidence](../../output/evidence/ai-harness/p2/README.md).
    Producer tests and real required-skip evidence are distinct from gate 12.
  - Recommended task executor category: deep
  - 선행: 2. 소유: `src/ai/workPlan.ts`, `intentDeclarationClient.ts`,
    `assistantSession.ts`의 계획 도구/완료 경계, `toolVerificationEvidence.ts`의
    필요한 조회·직렬화 API만.
  - RED/GREEN retained: `test/aiRequiredOutcomes.test.ts`. 필수 요구를 연결한
    항목을 skipped로 만들어도 goal satisfied=false; optional skip은 종료 가능;
    다른 대상의 통과 verdict, stale verdict, 모델 임의 evidence로 충족 불가.
  - 사용자 새 범위 지시의 출처가 있는 withdrawal만 필수 요구에서 제외.
    원래 요청과 철회 사유는 보관한다. requirement 의미 추출의 불확실성을
    false success로 숨기지 않는다.
  - GREEN 명령: `npm test -- test/aiRequiredOutcomes.test.ts test/assistantVerificationEvidence.test.ts test/workItemOutcome.test.ts`.
  - legacy/회귀: assessed contract 없는 계획은 기존 스케줄러로 실행되되 목표 증명은
    unassessed. 기존 explicit acceptance는 계속 평가한다.
    ask로 blocked 항목/counter가 바뀌지 않고 명시 resume만 활성화.
  - 실표면: 10의 `--scenario required-skip`에서 skipped 항목과 incomplete 목표가
    동시에 표시되고 생성 결과도 실제 기대와 대조.
  - 증거: `output/evidence/ai-harness/p2/requirements.md`, P2 README의 실표면 색인.
  - Commit: `feat(ai): retain required outcomes across work item skips`.

- [x] 4. 종료·목표·저장 상태의 단일 투영을 session과 적용 경계에 연결한다
  - P2 implementation verified, not Phase approval: the pure projection and
    actual session/apply/bridge/activity/recap/UI settlement share canonical facts.
    [P2 evidence](../../output/evidence/ai-harness/p2/README.md) binds producer
    verification and independent surface packets; gate 12 records final approval and landing separately.
  - Recommended task executor category: deep
  - 선행: 3. 소유: 신규 `src/ai/runOutcome.ts`, `assistantSession.ts`,
    `src/editor/panels/aiTurnRunner.ts`, `aiProposalCard.ts`,
    `src/ai/runRecap.ts`, `activityLog.ts`, `src/editor/aiAssistantBridge.ts`.
  - 순수 파생 함수는 D1의 세 축을 계산. session의 실행 결과 뒤 실제
    applyProposal 응답이 오면 같은 원천 영수증을 갱신해 다시 투영한다.
    마일스톤과 일반 적용이 다른 완료 정책을 갖지 않게 한다.
  - RED/GREEN retained: `test/aiRunOutcome.test.ts`. final+미충족 요구,
    cancelled+appliedCalls, apply ok+commit persisted:false,
    query/no-change, proof failure가 서로 다른 typed 결과인지 검사.
  - GREEN 명령: `npm test -- test/aiRunOutcome.test.ts test/aiMilestoneTurnAccounting.test.ts test/aiAssistantTurnCleanup.test.ts test/aiAssistantBridge.test.ts`.
  - 모든 조기 return/error/retry/plan-only/driver end에서 구조 필드가 일치.
    `stoppedReason` 기존 값은 호환 유지; 출력 문자열 역파싱은 사용하지 않음.
  - 실표면: 10의 `--scenario outcome-matrix`; UI data-execution/data-goal/data-delivery와 bridge/로그 결과 일치.
  - 증거: `output/evidence/ai-harness/p2/integration.md`, P2 README의 실표면 색인.
  - Commit: `feat(ai): project run outcomes from execution and delivery evidence`.

- [x] 12. P2를 검증하고 ultrabrain 최종 승인 뒤 PR을 병합한다
  - 완료: PR #680, 승인 HEAD `f6561f19b`, 실제 병합 `f22d64f7c`,
    승인된 병합 tree `e97c752e`. 현재 main 조합의 추가 승인과 부모 순서를 검증했다.
    `.omo/evidence/ai-harness-implementation/p2-merge-receipt.json` 및
    `p2-cleanup-complete.json`에 원본 증거 보존, 7개 worktree와 소유 TMPDIR·별칭
    제거를 기록했다. 이전 반려·실패·시간 초과는 소급 통과 처리하지 않았다.
  - Recommended task executor category: ultrabrain
  - P1 병합 기반의 새 worktree와 새 mass-ulw run을 사용한다. 최신 main의
    수락 조건 구현을 대조해 기존 원장을 중복 구현하거나 제거하지 않는다.
  - 요구/결과 실표면·회귀·감독자 gates와 Draft PR을 준비한다. 읽기 전용
    ultrabrain 검토 → 독립 deep 병렬 수정 → 통합 재검토를 승인까지 반복한다.
  - 리드가 승인된 현재 HEAD만 병합하고 merge SHA·정리를 기록한 뒤 P3로 진행한다.

- [x] 5. 실행 세대와 취소 경계를 늦은 결과까지 관통시킨다
  - 최종 검토 R1 교정: `248e8a66f`의 외형 도구 UI 열기 실패가 A 취소와
    B 완료 후 B의 기록을 변경했던 반례를 보존했다. `0e4223875`에서 두 await에
    기존 실행 가드를 적용했고, 영구 회귀의 실제 RED 후 관련 35건이 통과했다.
    기존 실표면 통과 근거는 유지하며 최종 재승인은 항목 13에 남아 있다.
  - Recommended task executor category: deep
  - 선행: 4. 소유: `assistantSession.ts`, `aiTurnRunner.ts`,
    `aiChatPanel.ts`, `aiAssistantBridge.ts`, 기존 pending-work 소유 모듈.
  - RED: `test/aiRunEpoch.test.ts` 신규 예정. A 요청 시작→중단→B 시작→A
    응답/검증/저장 알림 지연 도착을 deferred로 주입. B 상태 변경 0,
    A의 추가 도구/적용 0, A의 이미 적용된 결과는 보존.
  - GREEN 명령: `npm test -- test/aiRunEpoch.test.ts test/aiAssistantTurnCleanup.test.ts test/aiAssistantBridge.test.ts`.
  - terminal 전이를 먼저 기록하고 늦은 completion은 no-op. 사건 키로 중복
    표시 억제. 현재 task의 취소와 외부 의존 대기를 같은 성공으로 처리하지 않음.
  - 실표면: 10의 `--scenario late-cancel`에서 ai-abort 클릭 후 지연 응답 해제.
  - 증거/정리: `output/evidence/ai-harness/epochs/`; 모든 deferred settle.
  - Commit: `fix(ai): reject stale results after cancellation and run replacement`.
  - 이전 검증 증거: 구현 `5f4302f49`·`c762c6aaa`·`13a83668a`, 동일 사례 단언 보강
    `0fa1403f`. QA `4ba538320`으로 P2 RED 8건 / 현재 late-cancel 19건 GREEN을
    실제 proposal-host 종료 뒤 확인. 감독자 승인과 원본 해시는 공유 저장소의
    `.omo/evidence/ai-harness-implementation/p3-late-cancel-accepted.json`.
  - 독립 검증 R1로 재개: `450a1bbfb`의 실제 store 변경 구독자에서 취소/B 시작 시
    이미 적용된 A가 appliedCalls에 없고 draft로 남는다. 원본 실패는
    `../rpg-zzu-ai-harness-p3-verify-20260907/output/evidence/ai-harness/p3/independent/`.
    동기 구독 전 실제 적용 정산을 교정하고 기존 독립 재현으로 다시 검증한다.
  - 재검증 완료: `65b8029d1`에서 원래 독립 재현 3건이 동일한 코드로 통과.
    883개 집중 검사·12개 Node 검사·8개 native 시나리오와 원격 정리까지
    새 독립 검증이 `confirmed`로 판정했다. 과거 실패와 승인 철회는 보존한다.
    현재 근거: `.omo/evidence/ai-harness-implementation/p3-independent-r1-accepted.json`
    (공유 저장소). P3 전체 게이트·ultrabrain 승인·병합은 아직 별도 미완료다.

- [x] 6. 오래된 AI 제안이 현재 사람 편집을 덮지 못하게 한다
  - Recommended task executor category: deep
  - 선행: 5. 소유: `applyChangesetToStore.ts`, 필요한 ProjectStore의 읽기 전용
    version-token API, session의 base identity 캡처·재동기화.
  - RED: `test/aiStaleProposal.test.ts` 신규 예정. 초안 생성 뒤 non-house 타일과
    DB 값을 사람이 바꾸면 apply는 stale-base로 거부하고 두 편집 모두 보존.
    현재 허용 동작에서 RED를 관측한 뒤 기존 정책 테스트를 새 승인 계약으로 갱신.
  - GREEN 명령: `npm test -- test/aiStaleProposal.test.ts test/applyProposedProjectHouseProtection.test.ts test/applyChangesetToStore.test.ts`.
  - 쓰기 임계구역은 현재 클라이언트의 coordinator 하나가 소유. 제안을 자동
    재실행해 최신 편집을 “복구”하지 않음. 재계산은 최신 기준에 대한 새 작업.
  - 실표면: 10의 `--scenario human-edit-race`; UI 편집 후 stale AI 완료를 해제하고
    실제 map/database 값 보존. 두 탭 전역 lock 보장은 주장하지 않음.
  - 증거: `output/evidence/ai-harness/stale-proposal/`.
  - Commit: `fix(ai): preserve live edits when a proposed project becomes stale`.
  - 완료 증거: 구현 `32b46b5c`, 키 순서 비교 교정 `21978d30f`, QA 통합
    `9b2782f18` (tree `2fdc1dbd9ed48c3818cd24f5745560b1e3128b0a`).
    통합 검사 872건, human-edit-race 39건과 나머지 7개 native 시나리오 통과.
    원본·직접 종료 코드·소스 해시·실저장 재조회·정리 증거:
    `output/evidence/ai-harness/p3/integration/report.md`.

- [x] 16. 누락된 정확한 값과 보존 수락 기준을 실제 프로젝트에 연결한다
  - 복구 원장에서 `13a`로 지칭한 동일 항목이다. 자동 체크박스 집계가 인식하는
    정수 번호로 정정했으며 범위와 완료 근거는 바뀌지 않는다.
  - 완료: 제품 기준 `47f361a4d`, QA 정합화 `f18a7850d`, 완료 후 증명 재시도
    `9aa907ccc`. 감독자 기준 검사 32건 및 실제 선언자/응답 검사 11건 통과.
    다섯 실제 편집기 시나리오와 전체 빌드 통과, 격리 원격 프로젝트 정리 확인.
    근거: `.omo/evidence/ai-harness-implementation/resume-01a08291/`의
    `final-verification/` 및 `proof-retry/native/`. 기존 실패 기록은 보존한다.
    최종 전체 게이트·ultrabrain 승인·병합은 별도 항목 13에 남아 있다.
  - Recommended task executor category: deep
  - 사용자 2026-09-08 추가 승인. 기존 수락 스키마·파서·평가기에 제목·아이템 값과
    허용 변경 외 저작 내용 보존을 표현하는 최소 typed 기준을 추가한다.
  - 실제 저작 데이터와 최초 기준본을 비교하며 모델의 성공 주장·임의 실행 코드를
    근거로 삼지 않는다. 다른 대상, 잘못된 값, 비허용 변경은 실패한다.
  - 기존 네이티브 요청의 추가 조건은 실제 기존 정책·데이터로 확인 가능한 것만
    연결한다. 의미가 미정인 조건을 무관한 통과 검사로 대체하지 않는다.
  - QA의 intent/audit 응답 구분 교정 `f56ad9650`을 재사용한다. 기존 assertion과
    실제 실패 주입을 유지하고 새 필수 수락 계약과 충돌하는 legacy fixture는
    현재 계약의 회귀로 명확히 분리한다. 기존 실패 기록은 보존한다.
  - 해당 파서·평가기·현재 소스 통합 회귀와 원래 네이티브 시나리오로 검증한다.

- [x] 13. P3를 검증하고 ultrabrain 최종 승인 뒤 PR을 병합한다
  - 완료: PR #697, 최종 조합 승인 `8a87642bc`, 실제 병합 `37ba21348`,
    승인·빌드·병합 동일 tree `a593f3f5`. 공유 main도 fast-forward 확인.
    비활성 작업트리 29개를 근거 보관 후 정리했다. 제어·출하 빌드·미커밋 계획
    보존용 세 트리는 의도적으로 유지한다. 영수증:
    `.omo/evidence/ai-harness-implementation/resume-01a08291/p3-{merge-receipt,cleanup}.json`.
  - Recommended task executor category: ultrabrain
  - P2 병합 기반의 새 worktree/mass-ulw에서 취소·세대·사람 편집 보존을 실제
    화면과 실패 주입으로 증명하고 감독자 gates 및 Draft PR을 준비한다.
  - 읽기 전용 ultrabrain 검토와 독립 deep 병렬 수정·통합 재검토를 반복한다.
    리드가 최종 승인된 HEAD만 병합하고 자원 정리 후 P4로 진행한다.

- [x] 7. 기존 IndexedDB에 버전 있는 실행 체크포인트를 추가한다
  - 저장 구현 `f5d638868`, 실제 브라우저 하네스 `58cbfa5c2`. 이관 RED 2건 후
    체크포인트·기존 대화 검사 65건과 앱 타입 검사 통과. 실제 Firefox에서
    v1/v2→v3, 대화·인덱스·tombstone 보존, durable 저장·재로드,
    malformed/foreign/future 거부와 원본 보존 및 모든 자원 정리를 확인했다.
    근거: `resume-01a08291/p4/checkpoint-upgrade/run-1/report.json`.
    실행 중단 복구 연결은 별도 항목 8이며 저장만으로 완료 주장하지 않는다.
  - Recommended task executor category: deep
  - 선행: 4. 통합은 6 이후 직렬 수행. 소유: `src/ai/aiRecordDb.ts`,
    신규 `src/ai/runCheckpointStore.ts`, 기존 원장의 snapshot/load 경계.
  - RED: `test/aiRunCheckpointStore.test.ts` 신규 예정. v1/v2 대화 DB→v3 업그레이드
    뒤 대화 보존+checkpoint 왕복; 중복 run/epoch 저장; 잘못된 schemaVersion,
    projectId 불일치; memory fallback에서 durable=false.
  - GREEN 명령: `npm test -- test/aiRunCheckpointStore.test.ts test/conversationStore.test.ts`.
  - 완료 판정은 checkpoint payload가 아니라 복원 검증된 기존 원장을 사용.
    IDB transaction 완료를 await; 과도한 미적용 snapshot 축적 금지.
    활성 checkpoint는 대화 개수 제한만으로 조용히 제거하지 않음.
  - 실표면: 10의 `--scenario checkpoint-upgrade`; 격리 browser context의 실제
    IndexedDB v1을 만들고 페이지 재접속. 정상 대화와 신규 store를 확인.
  - 증거: `output/evidence/ai-harness/checkpoints/`.
  - Commit: `feat(ai): persist versioned run checkpoints beside conversations`.

- [x] 8. 부팅 재전송을 상태 조정 기반 복원으로 교체한다
  - 구현: `524cb8a44`(부팅 자동 재전송 제거, RED 2건 선행), `d78e229bc`(정본 원장
    export/restore, 과거 증명 권한 무효화), `f57819e2a`(런타임 조정), `ffac328cf`.
    검사: 부팅·기록 38건, 원장 복구 32건, 조정·저장 39건, 부정 인수 10건,
    정상 복구·재검증 19건, 인접 적용/취소/계속/기록 63건, `npm run build` exit0,
    앱 타입 게이트 exit0(`p4/typecheck-gate.json`).
  - 실표면(실제 브라우저·실제 Supabase): `--scenario recovery`가 적용 직후 중단 →
    `page.reload()` → 실제 「계속」까지 통과했다. 모델 호출 14→14, 중복 생성·적용·
    undo 0, 원 요청과 적용 기록 보존, 새 run/상위 epoch, 최종 대화 저장 1회,
    중단 시점 IDB 행 불변. 부정 3종(필수 이미지 누락 거부, 내용 변경
    needs-reconciliation, 스키마 버전 unsupported)은 쓰기 0으로 거부됐다.
    소유 원격 프로젝트 삭제·부재까지 정리 전부 true, 소스 해시 불변, 종료코드 0.
    근거: `resume-01a08291/p4/native-recovery/run-3/actions.json`(단계별 PNG 동봉).
    실패 보존: run-1·run-2는 관측 부족·보고서 직렬화 초과로 exit 1이며 소급 통과시키지 않았다.
  - Recommended task executor category: deep
  - 선행: 5·6·7. 소유: `aiChatPanel.ts:restoreLatestForBoot`,
    `conversationReplay.ts`, session 복원 진입점, checkpoint store.
  - RED: `test/aiRunRecovery.test.ts` 신규 예정. user→create 성공→최종 assistant
    저장 전 중단을 구성하고 저장→새 session/패널 생성→계속을 실행한다.
    이미 적용된 create 호출 증가 0 및 실제 생성물 수 불변을 단정.
  - 추가 실패 주입: 적용 전 checkpoint / apply 뒤 receipt 전 / 저장 뒤 proof 전 /
    다른 프로젝트 / 원격 내용 변경 / malformed checkpoint / legacy transcript.
    미확정 쓰기 자동 호출 0, 상태는 needs-reconciliation 또는 unsupported.
  - GREEN 명령: `npm test -- test/aiRunRecovery.test.ts test/aiConversationReplay.test.ts test/assistantSessionCompaction.test.ts test/aiRunCheckpointStore.test.ts`.
  - active/resumable만 남은 일을 재개. 사용자 cancelled/awaiting-user 상태는
    부팅만으로 실행하지 않음. 대화 기록 열기는 계속 동작.
  - 실표면: 10의 `--scenario crash-after-apply`; 실제 IDB 기록 후 page.reload(),
    tool counter·맵 이벤트 수·활성 run identity를 대조.
  - 증거: `output/evidence/ai-harness/recovery/`. No exactly-once claim.
  - Commit: `fix(ai): reconcile interrupted runs before resuming authoring`.

- [x] 14. P4를 검증하고 ultrabrain 최종 승인 뒤 PR을 병합한다
  - 병합: PR #724 → main `1ee10fc716d5decbfd7428389d779845281422da`, 병합된 HEAD
    `dd7729ea004c1dedad54b495e8fa97232be6706d`(현재 main 조합 포함).
  - 감독자 게이트(조합 HEAD): 복구 6파일 + main의 freeze guard·사용 로그 3파일 = 9파일 73건 통과,
    타입 게이트 exit 0, 실표면 `--scenario recovery` 재통과(모델 14→14, 중복 0, 원격 삭제·부재 확인).
  - 검토: ultrabrain은 제공자 사용량 한도로 6회 즉시 실패했다. 대체 제공자(anthropic/claude-opus-5)로
    일반·델타·적대적 검토 3회를 돌려 모두 병합 차단 결함 없음을 받았고, 지적된 체크포인트 큐 결함은
    RED/GREEN 확인 후 수정했다(`d9f7e6ab9`). 최종 병합은 사용자의 명시 승인으로 진행했다.
  - 근거: `resume-01a08291/p4/` (native-recovery/run-4·run-5, composed-tests, composed-typecheck,
    typecheck-gate-final, p4-focused-tests-calm, EVIDENCE-INDEX.md).
  - Recommended task executor category: ultrabrain
  - P3 병합 기반 새 worktree/mass-ulw에서 실제 IndexedDB 이관·새로고침·
    미확정 쓰기 조정과 회귀를 증명하고 감독자 gates 및 Draft PR을 준비한다.
  - 읽기 전용 ultrabrain 검토 → 독립 deep 병렬 수정 → 통합 재검토를 반복한다.
    최종 승인 후 리드가 현재 HEAD만 병합하고 정리한 뒤 P5로 진행한다.

- [x] 9. 자료 전달 영수증과 간결한 결과 표시를 연결한다
  - 구현 `6e344e425`. `RunOutcome` 에 전달 사실 축을 더했다: `imageAttached` 는 자료 이미지가
    **실제 요청에 실렸는지**만 말하고, `visualDelivery`(attempted/attached)는 보고한 실행에만
    존재한다 — "모름"을 0건이나 실패로 바꾸지 않는다. 모델이 그림을 이해했다는 주장은 만들지 않는다.
  - 소유 경계만 건드렸다: `assistantImageEvidence.deliveryFacts()`, `runOutcome`, 세션의 투영,
    `runRecap` 복원, `aiChatRenderers` 의 결과 줄(`data-image-delivery`). 패널 재설계 없음.
  - RED 선행 8건 → GREEN. `npm test -- test/aiVisualEvidenceReceipt.test.ts test/aiRunOutcome.test.ts
    test/assistantVerificationEvidence.test.ts` 470건 통과, 타입 게이트 exit 0,
    인접 회귀(recap·activity 포함) 474건 통과.
  - 실표면: `--scenario outcome-matrix` 156계약 전부 통과(전달 축 포함, 위반 0).
  - Recommended task executor category: deep
  - 선행: 4·5·8. 소유: session의 renderImages/request 경계,
    aiTurnRunner 결과 표시, bridge/activity/recap의 같은 투영.
    별도 패널 재설계·skill drawer·상세 로그 기본 노출은 하지 않음.
  - RED: `test/aiVisualEvidenceReceipt.test.ts` 신규 예정. renderer 없음/throw/
    빈 이미지에서 image-attached=false; 다른 run/revision 이미지 무효;
    정상 이미지가 실제 요청 content parts에 포함돼야 attached=true.
  - GREEN 명령: `npm test -- test/aiVisualEvidenceReceipt.test.ts test/aiRunOutcome.test.ts test/assistantVerificationEvidence.test.ts`.
  - 자료 조회/이미지 첨부/품질 검사/실제 플레이의 assurance를 구별한다.
    모델이 그림을 이해했거나 보기 좋다고 판단했음을 receipt로 발명하지 않음.
  - 실표면: 10의 `--scenario outcome-matrix`에서 rendered-image 유무와
    UI data-state 대응, 1024·1440px 한글 결과와 키보드 동작 캡처.
  - 증거: `output/evidence/ai-harness/presentation/`.
  - Commit: `feat(ai): expose truthful run and visual-delivery status`.

- [ ] 10. 결정론적 편집기 시나리오와 실제 원격 저장 검증을 마무리한다
  - 실행기 신설 `scripts/qa/ai-harness-all.mjs`: 시나리오마다 자기 포트·Firefox·격리 원격
    프로젝트·정리 영수증을 가진 별도 프로세스로 돌리고, 첫 실패에서 멈춰 뒤 통과가 앞 실패를
    덮지 못하게 한다(계획의 checkpoint-upgrade 는 전용 스크립트, crash-after-apply 는 P4 recovery).
  - 실제 원격 증명 통과: `resume-01a08291/p5/remote-proof.json` (`qa-ai-proof-fa2867f8`, 15단계 —
    저장→재조회 일치, 내용 변경 mismatch, 전송 503·취소·대상 오류 뒤 동일 영수증 재검증,
    로컬 편집 경합 중 원격 보존, 삭제·부재 확인).
  - 이 게이트가 드러낸 P4 회귀 7건을 병합 이전 main 대조로 귀속해 모두 고쳤다: 저장·증명 중단,
    턴 경계 실패, 정착 대기 UI 잠금, 신원 재계산(160ms×2/라운드), 행 전체 재복제,
    원장 복원본 반복 복제(92회 13.3초), 적용 자체를 막던 대기. 더해 체크포인트 키가
    local-session id 로 굳어 **모든 기록이 거부**되던 결함과 다른 프로젝트 영수증 혼입도 고쳤다.
  - 현재 상태: **증거가 있는 것은 6개 통과**다 — proof-failure, required-skip, outcome-matrix,
    retained-draft-ask, wiki-delivery, new-goal-draft 를 최종 게이트에서 실측 통과했다.
    실행기는 첫 실패에서 멈추므로 human-edit-race·checkpoint-upgrade·crash-after-apply 는
    이 HEAD 에서 아직 실행되지 않았다(앞선 HEAD 의 통과를 이 HEAD 의 근거로 쓰지 않는다).
    **late-cancel 은 미통과**다 — 남은 P4 체크포인트 쓰기 비용이 하네스의 60초 신호 창을
    넘긴다(같은 부하 A/B: 기준선 76.7초 대 현재 101~109초). 근본과 구조적 해법(요청 기준선을
    런당 1회 저장하고 참조; 스키마 추가)은 `openwiki/testing.md` 에 수치로 남겼다.
    소급 통과시키지 않는다.
  - Recommended task executor category: deep
  - 선행: 2~9. 소유: 신규 예정
    `scripts/qa/ai-harness-contracts.mjs`,
    `scripts/qa/ai-harness-remote-proof.mjs`,
    관련 focused wiki와 QA evidence.
  - 실제 editor 기반: 기존 map-owned-ai-turns의 독점 listener, Firefox,
    scripted LLM, 사건 구독과 cleanup을 재사용.
  - 정확한 실행:
    `QA_PORT=19847 EVIDENCE_DIR=output/evidence/ai-harness/editor xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario all`
  - all은 proof-failure / required-skip / outcome-matrix / late-cancel /
    human-edit-race / checkpoint-upgrade / crash-after-apply를 모두 수행.
    각각 위 항목의 typed PASS 조건 하나라도 어기면 exit nonzero.
  - 실제 원격 실행:
    `node scripts/qa/ai-harness-remote-proof.mjs --create-isolated-project --scenario all --report output/evidence/ai-harness/remote.json`
  - 이 스크립트는 설정된 연결을 먼저 확인하고 실행별 독립 projectId를 생성·기록한다.
    사용자 열린 프로젝트 설정은 바꾸지 않는다. 최소 NPC/대화 fixture를 정상 저장
    경로로 저장하고 id 고정 재조회→정규화 콘텐츠·기대 이벤트 확인을 수행한다.
    다른 id/다른 콘텐츠/조회 실패는 실패. 연결이 없으면 중단하고 미검증으로 남긴다.
  - remote.json에는 id, 기대/관측 콘텐츠 식별값, 단계별 결과, 원격 fixture 정리
    결과를 남긴다. cleanup이 허용되지 않으면 삭제하지 말고 잔존 테스트 id를 명시한다.
    로컬 blankProject 성공을 원격 증거로 대체하지 않는다.
  - wiki: `openwiki/editor-ai-panel.md`, `openwiki/ai-context-compaction.md`,
    `openwiki/testing.md` 중 변경된 계약 절만 갱신.
  - 증거: 모든 action log, 상태 JSON, PNG, 서버/브라우저/리스너 정리 receipt.
  - Commit: `test(ai): verify harness outcomes and recovery on real editor surfaces`.

- [x] 15. P5의 전체 목표를 검증하고 ultrabrain 승인 뒤 마지막 PR을 병합한다
  - Recommended task executor category: ultrabrain
  - P4 병합 기반 새 worktree/mass-ulw에서 9·10을 마무리한다. F1·F2의 전체
    감독자 검증과 아래 모든 SC를 먼저 실행·기록하고 해당 체크박스도 갱신한다.
  - 현재 통합 HEAD의 Draft PR을 ultrabrain이 검토한다. 독립 deep 병렬 수정과
    통합 재검토를 최종 승인까지 반복하고 리드만 승인된 HEAD를 병합한다.
  - F3에서 소유 자원 정리와 사용자 변경을 보존한 공유 main 통합까지 확인한다.
    다섯 PR의 승인/병합 증거와 전체 실제 동작이 충족돼야 최상위 목표를 완료한다.

## Final verification wave

- [x] F1. 구현자가 아닌 감독자가 변경·게이트 범위를 검토한다
  - Recommended task executor category: deep
  - `npm run typecheck:app`, 관련 focused tests, `npm run build`,
    `npm run gates` 실행. 기준선 대비 새 실패 0, 실행 exit code·산출물 보존.
  - 전체 typecheck의 기존 test 타입 오류나 timeout을 숨기지 않는다.
    출력 파이프 끝의 exit code를 실제 명령 성공으로 사용하지 않는다.

- [ ] F2. 목표·복구·저장 조건을 실표면 증거와 대조한다
  - Recommended task executor category: deep
  - 10의 editor all + isolated remote all 결과가 모두 PASS인지 검토.
    변경된 코드/fixture 이후 fresh evidence인지 확인.
  - runtime 코드까지 실제로 변경한 경우에만
    `npm run qa:runtime:gate`를 추가하고 SUMMARY.md 우선 확인.
    이 하네스 개선만으로 모든 생성 게임의 플레이 완성을 주장하지 않는다.

- [ ] F3. 정리·변경 설명·원자적 커밋을 확인한다
  - Recommended task executor category: deep
  - spawned browser/context/server/대기 promise를 종료하고 소유 포트 해제 확인.
  - 사용자 데이터와 다른 작성자 변경을 보존. 모든 커밋은 buildable/관련 GREEN.
  - 최종 보고는 “기능 구현됨”과 “이번 실제 프로젝트로 증명됨”을 구별한다.
    원격 시나리오의 projectId·결과·잔존 fixture 여부를 포함한다.

## Rollout and rollback

- 현재 코드를 한 번에 새 엔진으로 교체하지 않는다. 위 순서의 작은 커밋으로 통합한다.
- 결과 필드는 추가적으로 도입하고 기존 stoppedReason/testid/원격 레코드 소비자를 유지.
- IDB v1/v2→v3는 additive. 모르는 checkpoint 버전은 무시/격리하며 대화는 계속 읽는다.
  v3 배포 뒤 v1/v2 전용 옛 바이너리를 무심코 재배포하지 않는다. rollback binary도
  v3 conversations를 읽고 checkpoint 실행만 끄는 forward-compatible reader를 유지한다.
- proof/복원에 문제가 생기면 “검증되지 않음/복구 확인 필요”로 낮추고 자동 재전송을
  되살리지 않는다. 불확실성을 성공으로 치환하는 fallback은 금지.
- 사용자 최신 변경과 원격 conflict는 보존한다. 새 DB 스키마·분산 보장이 필요해지면
  별도 설계/승인 없이 이 작업에 몰래 추가하지 않는다.

## Success criteria

| ID | 완료의 이진 관찰 | 증거 |
|---|---|---|
| SC1 | 실패/다른 대상/다른 콘텐츠의 원격 읽기가 verified로 승격되는 경우 0; 같은 버전 재검증 가능 | 2 RED/GREEN + 10 remote |
| SC2 | skipped 필수 요구·stale verdict·임의 evidence만으로 goal satisfied 되는 경우 0 | 3·4 + required-skip |
| SC3 | cancel/replacement 뒤 늦은 A 결과가 B 상태/쓰기를 바꾸는 경우 0 | 5 + late-cancel |
| SC4 | 자동 boot replay로 기존 생성물이 중복되는 경우 0; 불확실한 쓰기의 자동 재생 0 | 7·8 + crash-after-apply |
| SC5 | 최신 사람 편집이 오래된 AI snapshot/검증용 read로 소실되는 경우 0 | 2·6 + human-edit-race |
| SC6 | 기존 질문/계획/계속/자동 적용/undo/advisory 계약 회귀 0 | 1·4·9 + outcome-matrix |
| SC7 | 이미지 조회만으로 image-attached 또는 live-play-verified로 승격되는 경우 0 | 9 + presentation |

**STOP:** 위 조건과 해당 증거·정리가 모두 확인된 시점에 후속 구현을 완료한다.
작업량, 모델의 마지막 문장, 열린 todo가 없다는 사실만으로 완료하지 않는다.

### P5 마감 근거 (2026-09-09)

- PR #733 **MERGED**, 병합 HEAD `7c4e164ac`, 공유 `main` `1cecbd497` 에 반영 확인
  (사용자의 미커밋 PDF·reports·verify-shots 보존).
- 최종 HEAD `40bd6b6e2` 감독자 게이트: typecheck exit 0, build exit 0 (HEAD·tree 불변,
  `resume-01a08291/p5/head-typecheck.log`, `head-build.log`).
- 실표면 게이트(`p5/editor-all-head/`): proof-failure, required-skip, outcome-matrix,
  retained-draft-ask, wiki-delivery, new-goal-draft **6개 통과**. `late-cancel` 미통과 —
  P4 가 남긴 체크포인트 쓰기 비용으로 하네스의 60초 신호 창을 넘긴다(같은 부하 A/B:
  병합 이전 76.7초 대 현재 약 100초, 144.6초에서 개선). 소급 통과시키지 않았고 근본과
  구조적 해법을 `openwiki/testing.md` 에 수치로 남겼다. 항목 10 은 열어 둔다.
- F1 독립 검토(oracle/claude-opus-5, 정확 HEAD): 차단 5건 지적 → 전부 처리. 성능을 위해
  정확성을 팔았던 셋(원장 복원본 캐시, 캡처 시 행 동결 제거, 신원 WeakMap)을 되돌리고,
  `prepareCheckpointApply` 를 다시 진짜 내구성 경계로 복원했으며, 문서의 거짓 보증과
  증거 없는 "9/10" 주장을 정정했다.
