import { getBundledModel } from "@oh-my-pi/pi-catalog";
import { getOhMyPiProvider } from "../../src/ai/ohMyPiProviders.ts";

/** Exact selection only. Missing catalog entries must never change the user's model. */
export function resolveOhMyPiModel(provider: string, requested?: string) {
  const id = requested?.trim() || getOhMyPiProvider(provider)?.defaultModel || "";
  const exact = getBundledModel(provider as never, id);
  if (exact && typeof exact === "object" && "id" in exact) return exact;
  // OMP 17.4 predates this model. OAuth wire verified 2026-09-14:
  // gemini-3.8-flash-high, thinkingLevel HIGH -> OK. Prefer bundled metadata once available.
  if (provider === "google-antigravity" && id === "gemini-3.8-flash") {
    const base = getBundledModel("google-antigravity", "gemini-3.7-flash");
    if (base) return { ...base, id, name: "Gemini 3.8 Flash", thinking: {
      ...base.thinking!, effortRouting: {
        minimal: "gemini-3.8-flash-low", low: "gemini-3.8-flash-low",
        medium: "gemini-3.8-flash-medium", high: "gemini-3.8-flash-high",
      },
    } };
  }
  throw Object.assign(new Error(`지원 목록에 없는 모델입니다: ${provider}/${id}. 다른 모델로 대체하지 않았습니다.`), { status: 400 });
}
