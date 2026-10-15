import { describe, expect, it } from "vitest";
import { resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { defaultAiConfig } from "@/ai/llmClient";
import { parseRoleModels } from "@/ai/modelRoles";

const roleModels = parseRoleModels({ vision: { provider: "openai-codex", model: "future-vision", thinkingLevel: "high" } });
const config = { ...defaultAiConfig(), roleModels };

describe("공방 AI 표면", () => {
  it("검수는 vision 역할 모델 + 고정 예산 4096", () => {
    expect(resolveSurfaceAiConfig("workshop-review", config)).toMatchObject({ model: "future-vision", providerId: "openai-codex", maxTokens: 4096 });
  });
  it("그리기는 감독(ultrabrain) 티어 + 고정 예산 16384 — 도트 저작 모델을 고르지 않은 설정에서는 구조물 표면과 같은 모델", () => {
    const legacy = { ...config, pixelModel: undefined };
    const draw = resolveSurfaceAiConfig("workshop-draw", legacy);
    expect(draw.model).toBe(resolveSurfaceAiConfig("structure-kit", legacy).model);
    expect(draw.maxTokens).toBe(16384);
  });
  it("도트 저작 모델(pixelModel)을 저장했으면 그리기가 그 모델을 쓴다 — 검수는 vision 그대로", () => {
    const pixel = { ...config, pixelModel: { provider: "google-antigravity", model: "claude-sonnet-4-6", thinkingLevel: "high" as const } };
    expect(resolveSurfaceAiConfig("workshop-draw", pixel)).toMatchObject({ model: "claude-sonnet-4-6", providerId: "google-antigravity", maxTokens: 16384 });
    expect(resolveSurfaceAiConfig("workshop-review", pixel)).toMatchObject({ model: "future-vision", maxTokens: 4096 });
  });
});
