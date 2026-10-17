// 그림 용도 라우터 헤드리스 출력표 — 모델을 부르지 않고 용도별로 어느 모델이 고를지만 찍는다.
//   bun scripts/qa/image-route-table.ts [--json]
// 저장된 설정 세 가지(새 설정 · 옛 설정(pixelModel 없음) · 사용자가 Claude 를 고른 설정)를 localStorage 흉내로 읽어 본다.
import { IMAGE_PURPOSES, resolveImageRoute, type ImagePurpose } from "../../src/ai/imageRoute";
import { defaultAiConfig, loadAiConfig, saveAiConfig, AI_CONFIG_STORAGE_KEY } from "../../src/ai/llmClient";

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

const fresh = defaultAiConfig();
// 옛 설정: pixelModel·pixel 표시가 없던 시절의 blob(ChatGPT 계정 + Google 그림).
const legacyBlob = { authMode: "chatgpt", providerId: "openai-codex", model: "gpt-6.1-sol", liteModel: "gpt-6.1-sol",
  imageProviderId: "google-antigravity", imageModel: "gemini-3.1-flash-image",
  ultrabrainProviderId: "google-antigravity", ultrabrainModel: "gemini-4-argon", ultrabrainReasoningEffort: "high",
  roleModels: { deep: { provider: "openai-codex", model: "gpt-6.1-sol", thinkingLevel: "medium" } }, roleModelsPolicyVersion: 1 };
store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(legacyBlob));
const legacy = loadAiConfig();
saveAiConfig({ ...fresh, pixelModel: { provider: "google-antigravity", model: "claude-sonnet-4-6", thinkingLevel: "high" }, modelSelectionOverrides: { pixel: true } });
const claude = loadAiConfig();

const configs = { "새 설정": fresh, "옛 설정(저장값에 pixelModel 없음)": legacy, "Claude 선택 설정": claude } as const;
const rows: Array<Record<string, string>> = [];
for (const [name, config] of Object.entries(configs)) {
  for (const purpose of Object.keys(IMAGE_PURPOSES) as ImagePurpose[]) {
    const route = resolveImageRoute(purpose, config);
    rows.push({
      설정: name, 용도: purpose, 갈래: route.kind, 표면: route.kind === "dot-text" ? route.surface : "",
      모델: route.kind === "generative" ? `${route.providerId} / ${route.model}`
        : route.kind === "dot-text" ? `${route.model.provider} / ${route.model.model} (${route.model.thinkingLevel})${route.follows ? " · 계획 모델 따라가기" : ""}`
        : "(생성 없음)",
    });
  }
}
if (process.argv.includes("--json")) console.log(JSON.stringify({ configs: Object.fromEntries(Object.entries(configs).map(([k, v]) => [k, { imageProviderId: v.imageProviderId, imageModel: v.imageModel, pixelModel: v.pixelModel ?? null, pinned: v.modelSelectionOverrides ?? {} }])), rows }, null, 2));
else console.table(rows);

// ── 실제 generateAiImage 입구: 모델 호출 없이 fetch 스파이로 «어디로 나가나» 를 본다 ────────────────────────
const { generateAiImage, ImageGenerationError } = await import("../../src/ai/imageGenerationClient");
const { createWorkerImageGenerator } = await import("../../scripts/lib/piPresentationTools");
store.clear();
saveAiConfig({ ...defaultAiConfig() });
const wire: Array<{ purpose: string; sent: boolean; provider?: string; model?: string; refusal?: string }> = [];
for (const purpose of ["title-art", "opening-still", "faceset", "tileset", "charset", "map-object", "interior-prop", "cutscene-sprite", "cutscene-illustration-sprite", "item-icon", "chat-pixel-art", "interview-scene", "concept-thumb", "user-upload"] as ImagePurpose[]) {
  let sent: { provider?: string; model?: string } | undefined;
  const fetchSpy = (async (_url: string, init?: RequestInit) => {
    sent = { provider: (init?.headers as Record<string, string>)["X-Oprn-Provider"], model: JSON.parse(String(init?.body)).model };
    return new Response(JSON.stringify({ image: { dataUrl: "data:image/png;base64,AAAA", provider: sent.provider, model: sent.model } }), { status: 200 });
  }) as unknown as typeof fetch;
  try {
    await generateAiImage({ prompt: "route check", purpose }, { fetch: fetchSpy });
    wire.push({ purpose, sent: true, ...sent });
  } catch (error) {
    wire.push({ purpose, sent: false, refusal: error instanceof ImageGenerationError ? error.message : String(error) });
  }
}
console.log("\n[generateAiImage 입구 — 네트워크 호출 여부]");
console.table(wire);
const workerRefusals: string[] = [];
const workerGen = createWorkerImageGenerator({ imageProvider: "openai-codex", imageModel: "codex-image-default" } as never, () => undefined);
for (const purpose of ["tileset", "charset", "cutscene-sprite", "item-icon", "chat-pixel-art"] as ImagePurpose[]) {
  try { await workerGen({ prompt: "x", purpose }); workerRefusals.push(`${purpose}: 통과(문제)`); } catch (e) { workerRefusals.push(`${purpose}: 거절 — ${(e as Error).message}`); }
}
console.log("\n[Bun 워커 생성기(타이틀·오프닝 도구)]\n" + workerRefusals.join("\n"));

// ── 공방 그리기 표면이 실제로 고르는 모델 ────────────────────────────────────────────────────────────
const { resolveSurfaceAiConfig } = await import("../../src/ai/assistantEndpoint");
const surfaces: Array<Record<string, string | number>> = [];
for (const [name, config] of Object.entries(configs)) {
  for (const surface of ["workshop-draw", "pixel-draw", "workshop-review"] as const) {
    const resolved = resolveSurfaceAiConfig(surface, config);
    surfaces.push({ 설정: name, 표면: surface, 제공자: resolved.providerId ?? "", 모델: resolved.model, 강도: resolved.reasoningEffort ?? "", 최대토큰: resolved.maxTokens });
  }
}
console.log("\n[공방 AI 표면 → 실제 모델]");
console.table(surfaces);
