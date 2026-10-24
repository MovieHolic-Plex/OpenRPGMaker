import { getBundledModel } from "@oh-my-pi/pi-catalog";
import { getOhMyPiProvider } from "../../src/ai/ohMyPiProviders.ts";
import { isOpenAiCompatProviderId } from "../../src/ai/openAiCompat.ts";
import { resolveOpenAiCompatModel } from "./openAiCompatModel.ts";

/**
 * GPT-6 계열은 설치된 pi-catalog 17.4.0 보다 나중에 나왔다. pi-catalog 18.3.2 의 openai-codex 항목이
 * gpt-5.6-sol 과 같은 전송(api openai-codex-responses · baseUrl chatgpt.com/backend-api · 사고 강도
 * low..max)이고 다른 것은 이름·컨텍스트 창(272k)뿐이다 — 그래서 번들 gpt-5.6-sol 메타데이터에
 * 그 두 값만 덮어 쓴다. 번들이 올라오면 exact 경로가 먼저 잡으므로 이 표는 저절로 안 쓰인다.
 */
const CODEX_GPT6_EXTENSION: Readonly<Record<string, {
  readonly name: string;
  readonly contextWindow: number;
  readonly useResponsesLite?: boolean;
}>> = {
  "gpt-6-astra": { name: "GPT-6 Astra", contextWindow: 272000 },
  "gpt-6-sol": { name: "GPT-6 Sol", contextWindow: 272000 },
  "gpt-6-luna": { name: "GPT-6 Luna", contextWindow: 272000 },
  // codex-rs 0.155 카탈로그가 use_responses_lite: true 로 내려 준다. 이 헤더 없이 보내면
  // 「not supported when using Codex with a ChatGPT account」 400 이다(실측 2026-10-07).
  "gpt-6.1-sol": { name: "GPT-6.1 Sol", contextWindow: 272000, useResponsesLite: true },
};

/** Exact selection only. Missing catalog entries must never change the user's model. */
export function resolveOhMyPiModel(provider: string, requested?: string) {
  // 사용자 지정(OpenAI 호환) 엔드포인트는 번들 카탈로그에 없다 — 호스트가 실어 보낸 정의로 모델을 만든다.
  if (isOpenAiCompatProviderId(provider)) return resolveOpenAiCompatModel(provider, requested) as ReturnType<typeof getBundledModel>;
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
  // Gemini 4 Argon: `agy` 모델 목록(2026-10-14)에 gemini-4-argon-{low,medium,high} 로 올라와 있다. 3.8 과 같은 전송이고
  // 사고 강도 라우팅 이름만 다르다. 번들 카탈로그가 이 모델을 싣게 되면 위 exact 경로가 먼저 잡는다.
  if (provider === "google-antigravity" && id === "gemini-4-argon") {
    const base = getBundledModel("google-antigravity", "gemini-3.7-flash");
    // 첫 응답 감시: 3.7 Flash 의 60초를 물려받으면 큰 대화(읽기 결과·그림 수십만 토큰)에서 Argon 이 생각하는 동안 요청이 끊긴다
    // (2026-10-25 조수 단독 게임 G12/G14: 8~9번째 턴마다 「Request was aborted」 네 번 연속). Pro 급 기본값 5분으로 둔다.
    if (base) return { ...base, id, name: "Gemini 4 Argon", compat: { ...base.compat, streamFirstEventTimeoutMs: 300_000 }, thinking: {
      ...base.thinking!, effortRouting: {
        minimal: "gemini-4-argon-low", low: "gemini-4-argon-low",
        medium: "gemini-4-argon-medium", high: "gemini-4-argon-high",
      },
    } };
  }
  if (provider === "openai-codex" && CODEX_GPT6_EXTENSION[id]) {
    const base = getBundledModel("openai-codex", "gpt-5.6-sol");
    // 웹소켓 핸드셰이크는 옛 클라이언트 버전을 박아 보내 새 모델을 거절당한다 — SSE 로 보내야
    // codexVersionFetch 가 버전을 올릴 수 있다(codexClientVersion.ts).
    if (base) return { ...base, id, ...CODEX_GPT6_EXTENSION[id], preferWebsockets: false };
  }
  throw Object.assign(new Error(`지원 목록에 없는 모델입니다: ${provider}/${id}. 다른 모델로 대체하지 않았습니다.`), { status: 400 });
}
