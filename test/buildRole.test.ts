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

  it("falls back to deep when build is not set, and a ChatGPT account seeds build with Gemini", () => {
    const config = { providerId: "openai-codex", model: "gpt-6.1-sol",
      roleModels: { deep: { provider: "openai-codex", model: "gpt-6.1-sol", thinkingLevel: "medium" } } } as unknown as AiConfig;
    expect(modelForRole(config, "build")).toEqual(modelForRole(config, "deep"));
    const seeded = configForProviderSelection(config, "openai-codex", true);
    expect(seeded.roleModels?.build).toEqual({ provider: "google-antigravity", model: "gemini-3.8-flash", thinkingLevel: "medium" });
    expect(seeded.roleModels?.deep?.model).toBe("gpt-6.1-sol");
  });
});
