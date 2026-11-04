import type { TeamPlan, TeamRoute, TeamSlot } from "./teamPlan.ts";

const SERVICE_NAME = { claude: "Claude", openai: "ChatGPT", google: "Google", deepseek: "DeepSeek" } as const;

export function routeName(route: TeamRoute): string {
  if (route.kind === "cli") return route.cli === "claude" ? "Claude 구독" : "ChatGPT 구독";
  if (route.kind === "account") return route.providerId === "openai-codex" ? "ChatGPT 로그인" : "Google 로그인";
  return route.label;
}

export function slotName(slot: TeamSlot): string {
  return `${SERVICE_NAME[slot.model.family]} ${slot.model.label.replace(/^(Claude|GPT-6\.1|GPT-6|Gemini 4|Gemini 3\.8|DeepSeek)\s*/u, "")}`.trim();
}

export function planTitle(plan: TeamPlan): string {
  const names = [...new Set(plan.routes.map(routeName))];
  return names.join(" + ");
}

export function planSentence(plan: TeamPlan): string {
  if (plan.lead) return `계획·검토 담당은 ${plan.lead.model.label}, 만들기 담당은 ${plan.worker.model.label}예요.`;
  return `계획부터 만들기까지 ${plan.worker.model.label} 하나가 맡아요.`;
}

export function planEvidence(plan: TeamPlan): string {
  const choice = plan.choice;
  if (!choice) return "측정한 점수가 아직 없는 기본 모델이에요.";
  const cost = `${choice.costEstimated ? "약 " : ""}$${choice.costUsd.toFixed(2)}`;
  return `측정 점수 ${choice.quality.toFixed(1)}점 · 요청 한 번에 ${cost} · ${choice.n}판`;
}
