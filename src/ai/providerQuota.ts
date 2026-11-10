// ai/providerQuota.ts
// 제공자 사용 한도(쿼터·속도 제한)를 알아보고, 사람에게 무엇을 말할지 정한다.
//
// 왜 (2026-11-10 ai-quota-aware): 점수 측정 중 terra 제공자 한도가 다 떨어졌는데(중계 기록: 55초 안에 429 8건)
// 편집기는 계속 일하는 것처럼 보였다. 조수 실행(/v1/agent/run)은 HTTP 200 NDJSON 이라 429 가 상태 코드로 오지 않고
// 오류 줄의 문장으로만 온다 — 그래서 companionConnection 의 429 경로(칩 「사용 한도 초과」)가 실행 중에는 한 번도 안 탔다.
// 이 모듈은 그 문장을 한 곳에서 판정한다. 판정만 하고 화면·상태는 호출자가 바꾼다.

/** 한도·속도 제한 문구. 상태 코드·제공자 표준 오류 코드·흔한 영어 문구·우리 쪽 한국어 문구. */
// 429 는 상태 코드 문맥(「(429)」·「HTTP 429」·「status 429」·「429 Too Many」)일 때만 — 문장 속 다른 숫자(「타일 429번」)는 아니다.
// 브라우저 저장공간 부족(QuotaExceededError)은 제공자 한도가 아니다. 「작업 한도」·「턴 한도」 같은 우리 실행 상한도 아니다.
const QUOTA_PATTERN = /\(429\)|\b(?:HTTP|status|code|error)[ :=]*429\b|^429\b|\b429 Too Many|RESOURCE_EXHAUSTED|insufficient_quota|exceeded your current quota|\bquota[ _](?:exceeded|exhausted)|rate[ _.-]?limit|usage limit|too many requests|사용 한도|요청 한도 초과/i;
const NOT_PROVIDER_QUOTA = /QuotaExceededError|(?:작업|턴|시간|도구|실행) (?:시간 )?한도/u;

/** 제공자 오류 문장이 사용 한도·속도 제한 때문인가. 일시 끊김(502·연결)과 구분해 다시 보내도 같은 결과임을 뜻한다. */
export function isQuotaOrRateLimitError(message: string | undefined | null): boolean {
  return !!message && QUOTA_PATTERN.test(message) && !NOT_PROVIDER_QUOTA.test(message);
}

export function quotaStatusLine(providerLabel: string): string {
  return `${providerLabel} 사용 한도 — 멈춤`;
}

export interface ProviderUsageWindow {
  readonly label: string;
  readonly remainingFraction?: number;
  readonly resetsAt?: number;
  readonly exhausted?: boolean;
}

/** 동반 서비스 `GET /auth/usage` 의 응답. readable=false 면 이 연결은 남은 한도를 알려 주지 않는다(정직한 「알 수 없음」). */
export interface ProviderUsageSnapshot {
  readonly provider: string;
  readonly readable: boolean;
  readonly fetchedAt: number;
  readonly windows: readonly ProviderUsageWindow[];
  readonly reason?: string;
}

/** 가장 적게 남은 창의 비율(0..1). 읽을 수 없으면 null. */
export function lowestRemaining(snapshot: ProviderUsageSnapshot | null | undefined): number | null {
  if (!snapshot?.readable) return null;
  const values = snapshot.windows.flatMap((window) => window.exhausted ? [0] : window.remainingFraction === undefined ? [] : [window.remainingFraction]);
  return values.length ? Math.min(...values) : null;
}

/** 칩 라벨 뒤에 붙는 짧은 꼬리: 「남음 63%」 또는 「한도 알 수 없음」. */
export function usageChipSuffix(snapshot: ProviderUsageSnapshot | null | undefined): string {
  const lowest = lowestRemaining(snapshot);
  return lowest === null ? "한도 알 수 없음" : `남음 ${Math.round(lowest * 100)}%`;
}

/** 칩 툴팁용 창별 설명. 읽을 수 없으면 이유. */
export function usageDetail(snapshot: ProviderUsageSnapshot | null | undefined, now: number = Date.now()): string {
  if (!snapshot) return "남은 한도를 아직 확인하지 않았어요.";
  if (!snapshot.readable) return snapshot.reason ?? "이 연결은 남은 한도를 알려 주지 않아요.";
  const rows = snapshot.windows.map((window) => {
    const pct = window.exhausted ? "소진" : window.remainingFraction === undefined ? "모름" : `${Math.round(window.remainingFraction * 100)}% 남음`;
    const reset = window.resetsAt && window.resetsAt > now ? ` · ${Math.max(1, Math.round((window.resetsAt - now) / 60_000))}분 뒤 초기화` : "";
    return `${window.label}: ${pct}${reset}`;
  });
  return rows.join(" / ");
}

/**
 * 한도 실패 말풍선. 성공을 말하지 않고, 무엇이 멈췄는지·어느 연결인지·할 수 있는 일을 말한다.
 * `applied` = 이미 반영된 변경이 남아 있는가(실시간 적용 실행).
 */
export function quotaFailureCopy(providerLabel: string, applied: boolean): string {
  const kept = applied ? "멈추기 전에 반영한 변경은 남아 있고 되돌릴 수 있어요." : "변경한 내용은 적용하지 않았어요.";
  return `${providerLabel} 사용 한도(쿼터·속도 제한)에 걸려 작업을 멈췄어요. ${kept} 한도가 풀릴 때까지 기다리거나 다른 AI 연결로 바꿔 다시 보내 주세요.`;
}
