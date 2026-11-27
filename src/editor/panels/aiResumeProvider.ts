// 이어 하기는 원래 실행의 연결(공급자)·모델로 잇는다(#5239). 다시 켠 뒤 부팅 자동 고르기(aiAutoProvider)가 다른 연결로
// 바꿔 두었을 수 있다 — 2026-11-26 실빌드 실측: Claude 로 시작한 실행의 이어 하기가 쿼터가 바닥난 ChatGPT 로 가서 10초 만에 멈췄다.
// 원래 연결을 지금 쓸 수 있으면 그것으로 되돌리고, 쓸 수 없으면(연결 끊김·한도) 사용자가 고른다. 저절로 다른 연결로 잇지 않는다.
import type { ProviderRouteState } from "@/ai/autoProviderPick";

export type ResumeProviderDecision =
  | { readonly kind: "same" }
  | { readonly kind: "switch"; readonly providerId: string }
  | { readonly kind: "unavailable"; readonly providerId: string; readonly reason: "disconnected" | "limited" };

export function decideResumeProvider(original: string | undefined, current: string, routes: readonly ProviderRouteState[], now: number): ResumeProviderDecision {
  if (!original || original === current) return { kind: "same" };
  const route = routes.find((candidate) => candidate.providerId === original);
  if (!route?.connected) return { kind: "unavailable", providerId: original, reason: "disconnected" };
  if (route.limitedUntil !== undefined && route.limitedUntil > now) return { kind: "unavailable", providerId: original, reason: "limited" };
  return { kind: "switch", providerId: original };
}
