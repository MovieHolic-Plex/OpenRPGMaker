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
  it("그리기는 감독(ultrabrain) 티어 + 고정 예산 16384 — 구조물 표면과 같은 모델", () => {
    const draw = resolveSurfaceAiConfig("workshop-draw", config);
    expect(draw.model).toBe(resolveSurfaceAiConfig("structure-kit", config).model);
    expect(draw.maxTokens).toBe(16384);
  });
});
