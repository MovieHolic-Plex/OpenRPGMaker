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
  /**
   * 실제로 응답한 모델 id 들(`modelUsage` 키). `--model opus` 같은 **별칭은 시간이
   * 지나면 다른 버전을 가리키므로** 별칭만 적어 둔 기록은 벤치마크 기록이 아니다.
   * 서브에이전트가 다른 모델을 썼으면 여기 둘 이상이 들어온다.
   */
  readonly resolvedModels: readonly string[];
  /**
   * 게이트웨이·API 실패 사유. 인프라 실패("503 routing unavailable")와 "모델이
   * 아무것도 만들지 못했다"는 완전히 다른 사실인데, 둘 다 제출물 부재로 나타난다.
   * 이유를 적어 두지 않으면 리더보드가 인프라 장애를 모델 실력으로 기록한다
   * (2026-08-21 실측: opus 첫 실행이 503 으로 죽었고 비용은 $0 이었다).
   */
  readonly apiErrorStatus: number | null;
  readonly resultMessage: string | null;
  /**
   * 왜 끝났는가. 세 실패는 완전히 다른 사실인데 전부 "제출물 없음"으로 나타난다:
   *   infra-error       게이트웨이·API 장애 → 재시도해야 한다. 점수가 아니다.
   *   budget-exhausted  턴 예산 소진 → 미완성이다. 모델의 스코핑 판단이 섞여 있다.
   *   completed         정상 종료 → 제출물이 없으면 그건 모델의 실패다.
   * 2026-08-21 실측: opus 는 503(infra) 으로 한 번, max_turns(budget) 로 한 번 죽었다.
   * 둘을 같은 칸에 적으면 리더보드가 거짓말을 한다.
   */
  readonly terminal: "completed" | "infra-error" | "budget-exhausted";
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
  const modelUsage = json?.modelUsage;
  const resolvedModels =
    modelUsage && typeof modelUsage === "object" && !Array.isArray(modelUsage)
      ? Object.keys(modelUsage as Record<string, unknown>).sort()
      : [];
  return {
    resolvedModels,
    apiErrorStatus: typeof json?.api_error_status === "number" ? json.api_error_status : null,
    terminal:
      typeof json?.api_error_status === "number"
        ? "infra-error"
        : json?.subtype === "error_max_turns" || json?.terminal_reason === "max_turns"
          ? "budget-exhausted"
          : "completed",
    resultMessage:
      json?.is_error === true && typeof json?.result === "string" ? (json.result as string).slice(0, 300) : null,
    turns: typeof json?.num_turns === "number" ? json.num_turns : null,
    costUsd: typeof json?.total_cost_usd === "number" ? json.total_cost_usd : null,
    outputTokens: typeof usage.output_tokens === "number" ? (usage.output_tokens as number) : null,
    isError: json?.is_error === true,
    stopReason: typeof json?.stop_reason === "string" ? json.stop_reason : null,
  };
}
