/** @vitest-environment happy-dom */
// localStorage 를 쓴다 — CI 의 Node 24 에는 전역 localStorage 가 없다(작성 환경 Node 25 는 기본 제공).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { generateAiImage, ImageGenerationError } from "@/ai/imageGenerationClient";
import { IMAGE_PURPOSES, imageRouteRefusal, isImagePurpose, isPixelDrawPurpose, resolveImageRoute, type ImagePurpose } from "@/ai/imageRoute";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig, loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { DEFAULT_PIXEL_MODEL, PIXEL_MODEL_CHOICES, resolvePixelModel } from "@/ai/pixelModel";
import { configForProviderSelection } from "@/ai/providerSelection";
import { isModelValidForAuthMode } from "@/ai/modelCatalog";

const purposes = Object.keys(IMAGE_PURPOSES) as ImagePurpose[];
const kindOf = (kind: string): ImagePurpose[] => purposes.filter((p) => IMAGE_PURPOSES[p].kind === kind);

describe("그림 용도 라우터", () => {
  it("세 갈래가 모두 있다", () => {
    expect(kindOf("generative").length).toBeGreaterThan(0);
    expect(kindOf("dot-text")).toEqual(["tileset", "charset", "map-object", "interior-prop", "cutscene-sprite", "item-icon", "chat-pixel-art"]);
    expect(kindOf("upload-only")).toEqual(["user-upload"]);
    expect(isImagePurpose("tileset")).toBe(true);
    expect(isImagePurpose("nope")).toBe(false);
  });
  it("생성형 용도는 설정의 이미지 모델 칸으로 간다(호출별 지정이 이긴다)", () => {
    const config = { ...defaultAiConfig(), imageProviderId: "openai-codex", imageModel: "codex-image-default" };
    for (const purpose of kindOf("generative")) {
      expect(resolveImageRoute(purpose, config)).toMatchObject({ kind: "generative", providerId: "openai-codex", model: "codex-image-default" });
    }
    expect(resolveImageRoute("title-art", config, { providerId: "google-antigravity", model: "gemini-3.1-flash-image" }))
      .toMatchObject({ providerId: "google-antigravity", model: "gemini-3.1-flash-image" });
  });
  it("도트 용도는 이미지 모델이 아니라 텍스트 모델(기본 Argon 보통)로 간다", () => {
    const route = resolveImageRoute("tileset", defaultAiConfig());
    expect(route).toMatchObject({ kind: "dot-text", surface: "workshop-draw", follows: false, model: DEFAULT_PIXEL_MODEL });
    expect(DEFAULT_PIXEL_MODEL).toEqual({ provider: "google-antigravity", model: "gemini-4-argon", thinkingLevel: "medium" });
    expect(imageRouteRefusal(route as Exclude<typeof route, { kind: "generative" }>)).toContain("도트");
  });
  it("결정(2026-10-16): 컷신 도트 소품·아이템 아이콘·조수 도트는 낱장 도트 표면, 배경·인터뷰·썸네일·일러스트는 생성형 그대로", () => {
    for (const purpose of ["cutscene-sprite", "item-icon", "chat-pixel-art"] as const) {
      expect(isPixelDrawPurpose(purpose)).toBe(true);
      expect(resolveImageRoute(purpose, defaultAiConfig())).toMatchObject({ kind: "dot-text", surface: "pixel-draw", follows: false, model: DEFAULT_PIXEL_MODEL });
    }
    for (const purpose of ["tileset", "charset", "map-object", "interior-prop"] as const) {
      expect(isPixelDrawPurpose(purpose)).toBe(false);
      expect(resolveImageRoute(purpose, defaultAiConfig())).toMatchObject({ surface: "workshop-draw" });
    }
    for (const purpose of ["cutscene-backdrop", "cutscene-illustration-sprite", "interview-scene", "concept-thumb"] as const) {
      expect(IMAGE_PURPOSES[purpose].kind).toBe("generative");
    }
  });
  it("옛 설정(pixelModel 없음)은 일괄 변환하지 않는다 — 낱장 도트도 계획 모델을 따라가고 설정은 비어 있다", () => {
    localStorage.clear();
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ authMode: "chatgpt", providerId: "openai-codex", model: "gpt-6.1-sol",
      ultrabrainProviderId: "openai-codex", ultrabrainModel: "gpt-6.1-sol", ultrabrainReasoningEffort: "medium",
      roleModels: { deep: { provider: "openai-codex", model: "gpt-6.1-sol", thinkingLevel: "medium" } }, roleModelsPolicyVersion: 1 }));
    const config = loadAiConfig();
    expect(config.pixelModel).toBeUndefined();
    expect(resolveImageRoute("item-icon", config)).toMatchObject({ kind: "dot-text", follows: true, surface: "pixel-draw" });
    expect(resolveSurfaceAiConfig("pixel-draw", config)).toMatchObject({ providerId: "openai-codex", model: "gpt-6.1-sol", maxTokens: 16384 });
    saveAiConfig({ ...defaultAiConfig(), pixelModel: { provider: "google-antigravity", model: "claude-sonnet-4-6", thinkingLevel: "high" }, modelSelectionOverrides: { pixel: true } });
    expect(resolveSurfaceAiConfig("pixel-draw", loadAiConfig())).toMatchObject({ model: "claude-sonnet-4-6", reasoningEffort: "high" });
  });
  it("도트·업로드 용도로 generateAiImage 를 부르면 네트워크로 나가기 전에 거절한다", async () => {
    let called = 0;
    const fetchSpy = (async () => { called += 1; return new Response("{}"); }) as unknown as typeof fetch;
    for (const purpose of [...kindOf("dot-text"), ...kindOf("upload-only")]) {
      await expect(generateAiImage({ prompt: "x", purpose }, { fetch: fetchSpy })).rejects.toBeInstanceOf(ImageGenerationError);
    }
    expect(called).toBe(0);
  });
  it("도트 저작 모델 선택지는 카탈로그에 실제 있는 모델만 담는다", () => {
    for (const choice of PIXEL_MODEL_CHOICES) expect(isModelValidForAuthMode("chatgpt", choice.model, choice.provider)).toBe(true);
    expect(PIXEL_MODEL_CHOICES.some((c) => c.model.startsWith("claude"))).toBe(true);
  });
});

describe("도트 저작 칸 저장 호환", () => {
  beforeEach(() => localStorage.clear());
  it("옛 저장값(pixelModel 없음)은 그대로 읽고 몰래 채우지 않는다 — 공방 그리기는 계획 모델 그대로", () => {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ authMode: "chatgpt", providerId: "openai-codex", model: "gpt-6.1-sol",
      ultrabrainProviderId: "openai-codex", ultrabrainModel: "gpt-6.1-sol", ultrabrainReasoningEffort: "medium",
      roleModels: { deep: { provider: "openai-codex", model: "gpt-6.1-sol", thinkingLevel: "medium" } }, roleModelsPolicyVersion: 1 }));
    const config = loadAiConfig();
    expect(config.pixelModel).toBeUndefined();
    expect(config.modelSelectionOverrides?.pixel).toBeUndefined();
    expect(resolvePixelModel(config)).toMatchObject({ follows: true, model: { provider: "openai-codex", model: "gpt-6.1-sol", thinkingLevel: "medium" } });
    const draw = resolveSurfaceAiConfig("workshop-draw", config);
    expect(draw).toMatchObject({ providerId: "openai-codex", model: "gpt-6.1-sol", maxTokens: 16384 });
  });
  it("저장한 도트 저작 모델은 공방 그리기가 쓰고, 검수는 시각 역할 그대로다", () => {
    saveAiConfig({ ...defaultAiConfig(), pixelModel: { provider: "google-antigravity", model: "claude-sonnet-4-6", thinkingLevel: "high" }, modelSelectionOverrides: { pixel: true } });
    const config = loadAiConfig();
    expect(config.pixelModel).toEqual({ provider: "google-antigravity", model: "claude-sonnet-4-6", thinkingLevel: "high" });
    expect(config.modelSelectionOverrides?.pixel).toBe(true);
    expect(resolveSurfaceAiConfig("workshop-draw", config)).toMatchObject({ model: "claude-sonnet-4-6", reasoningEffort: "high", maxTokens: 16384 });
    expect(resolveSurfaceAiConfig("workshop-review", config).model).not.toBe("claude-sonnet-4-6");
  });
  it("계정을 바꿔도(맞추기 포함) 고른 도트 저작 칸은 유지된다", () => {
    const pinned = { ...defaultAiConfig(), pixelModel: { provider: "google-antigravity", model: "claude-opus-4-6", thinkingLevel: "high" as const }, modelSelectionOverrides: { pixel: true as const } };
    for (const force of [false, true]) {
      const next = configForProviderSelection(pinned, "openai-codex", force);
      expect(next.pixelModel).toEqual(pinned.pixelModel);
      expect(next.modelSelectionOverrides?.pixel).toBe(true);
    }
  });
});

describe("모든 generateAiImage 호출처가 용도를 넘긴다", () => {
  const roots = ["src"];
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) { if (name !== "harnesses") walk(path); } else if (/\.tsx?$/.test(name)) files.push(path);
    }
  };
  for (const root of roots) walk(join(process.cwd(), root));
  it("`generateAiImage(` 직접 호출은 purpose 를 같이 준다(클라이언트 정의 파일 제외)", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file.endsWith("src/ai/imageGenerationClient.ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/generateAiImage\)?\(\{[^}]*\}\)?/gs)) {
        if (!/purpose/.test(match[0])) offenders.push(`${file}: ${match[0].slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
