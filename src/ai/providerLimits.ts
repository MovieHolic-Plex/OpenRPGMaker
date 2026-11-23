// ai/providerLimits.ts
// 제공자별 「한도로 쉬는 중」 기록. 요청이 429·사용 한도로 막히면 그 길에 풀리는 시각을 적고, 자동 선택(autoProviderPick)이 그동안 건너뛴다.
//
// 왜 (2026-11-23 ai-setup-adaptive b): 전송 상태(llmClient.reportTransportHealth)는 전역 한 칸이라 어느 길이 막혔는지 몰랐다.
// 풀리는 시각은 오류 문장의 Retry-After·「resets in」·「try again in」에서 읽고, 없으면 DEFAULT_LIMIT_PAUSE_MS 동안 쉰다(지어낸 시각이 아니라 다시 볼 때까지의 간격).
export const AI_PROVIDER_LIMITS_STORAGE_KEY = "oprn:ai-provider-limits";
export const DEFAULT_LIMIT_PAUSE_MS = 15 * 60_000;

const UNIT_MS: Readonly<Record<string, number>> = { h: 3_600_000, m: 60_000, s: 1_000 };

/** 오류 문장에서 「얼마 뒤 풀리는지」(ms)를 읽는다. 못 읽으면 undefined. */
export function parseRetryAfterMs(message: string | undefined | null): number | undefined {
  if (!message) return undefined;
  const header = /retry[- ]after[":= ]*(\d+(?:\.\d+)?)\s*(s|sec|seconds?)?\b/i.exec(message);
  if (header) return Math.round(Number(header[1]) * 1000);
  const span = /(?:resets?|try again|retry)\s+in\s+((?:\d+(?:\.\d+)?\s*[hms]\s*)+)/i.exec(message);
  if (!span) return undefined;
  let total = 0;
  for (const part of span[1].matchAll(/(\d+(?:\.\d+)?)\s*([hms])/gi)) total += Number(part[1]) * UNIT_MS[part[2].toLowerCase()]!;
  return total > 0 ? Math.round(total) : undefined;
}

function read(): Record<string, number> {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(AI_PROVIDER_LIMITS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : {};
    return parsed && typeof parsed === "object" ? Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === "number")) as Record<string, number> : {};
  } catch {
    return {};
  }
}

function write(limits: Record<string, number>): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(AI_PROVIDER_LIMITS_STORAGE_KEY, JSON.stringify(limits));
  } catch { /* 저장소를 못 쓰면 이번 실행 동안만 모른다 */ }
}

/** 이 길이 한도에 걸렸다고 적는다. 풀리는 시각(ms)을 돌려준다. */
export function noteProviderLimited(providerId: string, message?: string | null, now: number = Date.now()): number {
  const until = now + (parseRetryAfterMs(message) ?? DEFAULT_LIMIT_PAUSE_MS);
  const limits = read();
  for (const [id, at] of Object.entries(limits)) if (at <= now) delete limits[id];
  limits[providerId] = until;
  write(limits);
  return until;
}

/** 이 길이 쉬는 중이면 풀리는 시각, 아니면 undefined. */
export function providerLimitedUntil(providerId: string, now: number = Date.now()): number | undefined {
  const at = read()[providerId];
  return at !== undefined && at > now ? at : undefined;
}

export function hasActiveProviderLimit(now: number = Date.now()): boolean {
  return Object.values(read()).some((at) => at > now);
}

export function clearProviderLimit(providerId: string): void {
  const limits = read();
  if (!(providerId in limits)) return;
  delete limits[providerId];
  write(limits);
}
