import { describe, expect, it } from "vitest";
import { executionRoleFor } from "@/ai/buildRole";
import { modelForRole } from "@/ai/modelRoles";
import { configForProviderSelection } from "@/ai/providerSelection";
import type { AiConfig } from "@/ai/llmClient";

describe("execution role by kind of work", () => {
  it("routes spatial and whole-game runs to build, the rest to deep", () => {
    expect(executionRoleFor("가격만 바꿔", ["upsert_item", "get_database_records"])).toBe("deep");
    expect(executionRoleFor("대사 고쳐", ["upsert_event"])).toBe("deep");
    expect(executionRoleFor("방 하나", ["build_hand_interior_room"])).toBe("build");
    expect(executionRoleFor("길 깔기", ["fill_region"])).toBe("build");
    expect(executionRoleFor("장르 프리셋: 모험", [])).toBe("build");
    expect(executionRoleFor("뭔가", undefined)).toBe("deep");
  });

  it("falls back to deep when build is not set, and a ChatGPT account seeds build with GPT-6.2 Sol", () => {
    const config = { providerId: "openai-codex", model: "gpt-6.1-sol",
      roleModels: { deep: { provider: "openai-codex", model: "gpt-6.1-sol", thinkingLevel: "medium" } } } as unknown as AiConfig;
    expect(modelForRole(config, "build")).toEqual(modelForRole(config, "deep"));
    const seeded = configForProviderSelection(config, "openai-codex", true);
    // #4775(오너 결정 2026-11-19): ChatGPT 계정의 작문·제작은 더 이상 Gemini Argon 이 아니고, 두 티어 모두 GPT-6.2 Sol 이다.
    expect(seeded.roleModels?.build).toEqual({ provider: "openai-codex", model: "gpt-6.2-sol", thinkingLevel: "medium" });
    expect(seeded.roleModels?.deep).toEqual({ provider: "openai-codex", model: "gpt-6.2-sol", thinkingLevel: "medium" });
  });
});
