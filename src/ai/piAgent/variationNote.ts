// v1 지시문(단일·팀원·팀장)이 싣는 «이 게임의 변주» 카드 — v2 와 같은 뽑기(src/ai/variation)를 쓰고 문장만 한국어다.
// 첫 게임 하나를 짓는 요청(빈 프로젝트)에만 있다. 몬스터 수집·장르 잠금 게임과, 팀장이 아닌 곳의 장르 프리셋 첫 요청은 정해진 길이 있어 카드가 없다(diff 0).
import type { Project } from "@/project/types";
import { variationCard } from "@/ai/variation/card";
import { gameVariation } from "@/ai/v2/request/world";

export interface PiVariationInput {
  /** 프로젝트 열쇠 — 요청의 projectKey. 같은 게임은 늘 같은 변주. */
  readonly projectKey: string;
  /** 사용자 요청 원문(의도 메모가 붙어 있어도 된다 — 읽는 글은 사용자 글뿐). */
  readonly request: string;
  /** 팀장 — 장르 프리셋 첫 생성도 게임 하나로 본다. */
  readonly orchestrator?: boolean;
}

/** 카드 한 덩어리와 첫 장소(있으면) — 없으면 undefined(카드 없음, 기존 지시문 그대로). */
export function piVariation(project: Project, input: PiVariationInput): { readonly card: string; readonly firstPlace?: string } | undefined {
  const { variation } = gameVariation(project, input.projectKey, input.request, { v1: true, preset: input.orchestrator === true });
  if (!variation) return undefined;
  const card = variationCard(variation, { lang: "ko" });
  return card ? { card, ...(variation.places[0] ? { firstPlace: variation.places[0].ko } : {}) } : undefined;
}
