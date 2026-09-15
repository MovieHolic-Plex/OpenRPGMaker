# 의도 선언 vs 커버리지 감사 예산 분리 (2026-09-16)

## 관찰된 사고 (원인)
실제 모델 턴 두 건이 같은 모양으로 죽었다 — `output/ai-activity/e1c80a58…json`, `72e8599d…json`:
```
intent:llm mode=modify space=none single tools=upsert_enemy 20073ms — 폴백 사유: 시간 초과(20000ms)
runOutcome: { execution: "budget-exhausted", goal: "incomplete", delivery: "draft" }
proposedCalls: 2 · appliedCalls: 0 · stoppedReason: "max-tool-calls"
error: "독립 검수가 승인되지 않아 초안을 적용하지 않았습니다."
진단: functionalUnresolved: 시간 초과(20000ms) → Request coverage unverified
툴 실패: repair_acceptance ×2 (unknown-item, immutable-valid) · correct_verification ×4
```
라우팅 선언과 커버리지 감사가 **컨트롤러 하나(20초)를 나눠 썼다**. 라우팅이 20초를 거의 다 쓰고
성공하자 같은 벽에 감사가 잘렸고, 그 실패가 「Request coverage unverified」라는 **닫을 수 없는**
필수 항목이 되어 모델이 그것을 닫으려 툴 예산을 태우고 초안을 버렸다.

## 고침
`src/ai/intentDeclarationClient.ts` 의 `auditCoverage` 가 **자체 AbortController + 자체 20초**를 갖는다.
라우팅의 지연이 감사 결과를 지우지 못한다. 감사 자체가 실패하면 그대로 미확인 항목으로 남는다.

## RED → GREEN (그대로 재현 가능)
```bash
npx vitest run --configLoader bundle test/intentDeclarationClient.test.ts
```
- 고침 전(RED): `Tests 1 failed | 27 passed`
  `AssertionError: expected AbortSignal { aborted: false } not to be AbortSignal { aborted: false }`
  → 감사가 라우팅과 **같은** signal 을 받는다는 증거가 그대로 나온다.
- 고침 후(GREEN): `Tests 28 passed`
- 함께 통과: `test/requestCoverage.test.ts` 포함 두 파일 `42 passed`
- 타입: `npm run typecheck:app` → exit 0

## 이 고침이 하지 않는 것
검수 게이트를 약화하지 않는다. 미적용 초안의 판정은 `evaluateForReview`(초안 자체 평가)와 독립 검수,
그리고 미완료 항목을 그대로 남기는 규칙이 계속 맡는다. (앞선 가설이던 `AcceptanceStatus: deferred` 는
검토 결과 **철회**했고, 그 3파일 변경은 커밋하지 않았다.)
