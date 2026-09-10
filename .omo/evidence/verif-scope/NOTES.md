# malformed 검증 스코프 차단 복원 (2026-09-11)

## 왜

PR #749(`36d113248`)가 `args === null` pending 을 판정·차단에서 통째로 제외했다. 의도는 옳다 —
플래너가 `successTools` 에 검증 툴만 넣고 `verificationChecks` 를 빼면 pending 이 심기고,
이전 `passed()` 는 pending 하나로 전체를 false 로 만들어 **완료가 구조적으로 불가능한 작업**을
만들었다(실측 세션: `run_lint` 21회·`check_reachability` 15회 전부 통과했는데 완료 못 함).

그런데 완화가 너무 넓었다. `args === null` 은 서로 다른 두 사건을 담는다:

| 사유 | 뜻 | 올바른 처리 |
|---|---|---|
| `omitted` | 선언 자체가 없음(계획의 공백) | 진단만 — #749 가 맞다 |
| `malformed` | 선언은 했는데 스코프 파싱 실패 | **계속 차단** — 안 막으면 무관한 통과 기준에 얹힌다 |

## 어떻게 판정했나

| 대상 | `verificationPlanAtomicityReuse` 의 malformed 단언 2건 |
|---|---|
| 병합 후 main | 실패 (`expected 'verified' to be 'blocked'`) |
| PR #750 단독 head (749 포함) | 실패 — 동일 |
| **병합 전 `00ba934d3`** (= #749 직후, 구 통합 파일 `-t` 필터) | **실패 — 동일** |

즉 내 병합이 만든 회귀가 아니고, #749 가 만든 구멍이 #750 의 파일 분리로 드러난 것이다.
#750 은 `verificationPlanAtomicity.test.ts` 를 세 파일로 쪼갰을 뿐 단언을 새로 쓰지 않았다.

## 변경

- `src/ai/toolVerificationEvidence.ts` — `VerificationRequirement.pendingReason?: "omitted" | "malformed"`.
  `passed()` 는 `args !== null || pendingReason === "malformed"` 를 판정 대상으로 삼고(malformed 는
  `pass === false` 이므로 통과가 되지 않는다), `problems("blocking")` 은 malformed 를 항상 올린다.
- `src/ai/assistantSession.ts` — pending 을 심는 지점에서 이미 계산돼 있던 `malformedItems` 를
  사유로 실어 준다. 구분 정보는 원래 있었고 요구사항에 전달되지 않았을 뿐이다.

#749 커밋이 남긴 지시("pending 제외를 되돌리려면 `args:null` 을 심는 경로를 함께 손봐야 한다")와
같은 방향이다 — 한쪽만 되돌리면 완료 게이트가 다시 교착한다.

## 검증

```
npm run typecheck:app                                                       → exit 0
npx vitest run verificationPlanAtomicityReuse + PendingSpecification
  + PlanAtomicityOwnership --maxWorkers=2                                   → 64 passed (수정 전 2 failed)
npx vitest run verificationPlanAtomicity + auditToolCatalogBudget
  + piAgentTeamRuntime + aiChatPanelComposerMode --maxWorkers=2             → 67 passed
```

#749 가 지키려던 계약(`verificationPendingSpecification`: pending 통과·비차단·실패는 여전히 차단)은
그대로 초록이다 — 완화는 `omitted` 에만 남았다.
