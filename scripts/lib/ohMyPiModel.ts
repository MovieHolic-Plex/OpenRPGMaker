import { getBundledModel } from "@oh-my-pi/pi-catalog";
import { getOhMyPiProvider } from "../../src/ai/ohMyPiProviders.ts";

/**
 * GPT-6 계열은 설치된 pi-catalog 17.4.0 보다 나중에 나왔다. pi-catalog 18.3.2 의 openai-codex 항목이
 * gpt-5.6-sol 과 같은 전송(api openai-codex-responses · baseUrl chatgpt.com/backend-api · 사고 강도
 * low..max)이고 다른 것은 이름·컨텍스트 창(272k)뿐이다 — 그래서 번들 gpt-5.6-sol 메타데이터에
 * 그 두 값만 덮어 쓴다. 번들이 올라오면 exact 경로가 먼저 잡으므로 이 표는 저절로 안 쓰인다.
 */
const CODEX_GPT6_EXTENSION: Readonly<Record<string, { readonly name: string; readonly contextWindow: number }>> = {
  "gpt-6-astra": { name: "GPT-6 Astra", contextWindow: 272000 },
  "gpt-6-sol": { name: "GPT-6 Sol", contextWindow: 272000 },
  "gpt-6-luna": { name: "GPT-6 Luna", contextWindow: 272000 },
};

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
  if (provider === "openai-codex" && CODEX_GPT6_EXTENSION[id]) {
    const base = getBundledModel("openai-codex", "gpt-5.6-sol");
    if (base) return { ...base, id, ...CODEX_GPT6_EXTENSION[id] };
  }
  throw Object.assign(new Error(`지원 목록에 없는 모델입니다: ${provider}/${id}. 다른 모델로 대체하지 않았습니다.`), { status: 400 });
}
