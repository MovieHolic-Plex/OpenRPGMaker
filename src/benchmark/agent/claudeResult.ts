// benchmark/agent/claudeResult.ts
// claude -p --output-format json 결과 파싱 — 과정 지표(턴·비용·토큰)의 출처.
//
// 왜 별 모듈인가: CLI 파일에 두면 테스트가 그 파일을 import 하는 순간 main() 이
// 실행된다. 과정 지표는 리더보드의 절반이라 회귀 테스트가 필요하다.

export interface AgentProcessMetrics {
  readonly turns: number | null;
  readonly costUsd: number | null;
  readonly outputTokens: number | null;
  readonly isError: boolean;
  readonly stopReason: string | null;
}

/**
 * 결과 객체를 뽑는다.
 *
 * stderr 경고가 JSON **뒤**에 붙어 나오므로 lastIndexOf("{") 로 찾으면 JSON 내부의
 * 중첩 객체를 집어 파싱이 깨진다(2026-08-21 실측: 첫 실행의 turns/cost 가 전부
 * null 이었다). 줄 단위로 뒤에서부터 파싱을 시도하는 것이 유일하게 안전한 방법이다.
 */
export function readClaudeResult(stdout: string): Record<string, unknown> | null {
  const candidates = stdout.split(/\r?\n/).filter((line) => line.trim().startsWith("{"));
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(candidates[index]!.trim()) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      continue;
    }
  }
  return null;
}

export function processMetrics(stdout: string): AgentProcessMetrics {
  const json = readClaudeResult(stdout);
  const usage = (json?.usage ?? {}) as Record<string, unknown>;
  return {
    turns: typeof json?.num_turns === "number" ? json.num_turns : null,
    costUsd: typeof json?.total_cost_usd === "number" ? json.total_cost_usd : null,
    outputTokens: typeof usage.output_tokens === "number" ? (usage.output_tokens as number) : null,
    isError: json?.is_error === true,
    stopReason: typeof json?.stop_reason === "string" ? json.stop_reason : null,
  };
}
