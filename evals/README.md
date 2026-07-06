# evals — 골든 태스크 평가 스위트 (Phase 5)

AI 어시스턴트(툴 레이어 + LLM 루프)의 품질을 골든 태스크로 회귀 측정한다.

## 구성
- `src/evals/goldenTasks.ts` — 골든 태스크 10종 + 각 태스크 정답 툴 시퀀스(오프라인 채점 기준).
- `src/evals/goldenTask.ts` — `scoreProject`(projectLint 0 error + 스펙 매처 + 도달성) + 매처 빌더.
- `src/evals/runner.ts` — `toolSequenceSolver`(오프라인) / `llmSolver`(AssistantSession) / `runGoldenSuite`.
- `evals/llmSuite.eval.ts` — 실제 LLM 구동·채점(vitest, evals 전용 config).
- `evals/run.mjs` — `.env.local` 로드 후 실 LLM 스위트 실행.

## 실행
```bash
# 오프라인(정답 시퀀스) 채점 — CI 포함(test/evals.test.ts).
npm test -- evals

# 실제 LLM 채점(google/gemini-3.1-flash-lite, OpenRouter). .env.local의 OPENROUTER_API_KEY 필요.
# 비용/네트워크가 있어 CI 미포함 — 수동/야간 배치용.
node evals/run.mjs 4      # 상위 4개 태스크
node evals/run.mjs 10     # 전체 10개(1회 권장)
```

## 결과
`evals/results/<timestamp>.json` — 태스크별 pass/score/toolCalls/tokens 요약.
**키·응답 원문은 저장하지 않는다**(태스크별 요약과 매처 결과만).

## 채점 기준
- lint 0 error + 모든 스펙 매처 통과 + (지정 시) 도달성 → `passed`.
- 하네스가 정상 작동하고 채점이 유의미한지가 목적이며, 전부 pass일 필요는 없다.
