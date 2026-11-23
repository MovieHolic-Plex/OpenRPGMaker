// 조수 역할 배정(src/ai/assistantRoles.ts) — 연결 조합마다 역할 여섯이 어떻게 채워지고, 못 채운 역할이 무엇으로 물러나는지.
import { describe, expect, it } from "vitest";
import { assistantRoleModel, configWithAutoAssistantRoles, resolveAssistantRoles, type AssistantRole, type RoleAssignment } from "@/ai/assistantRoles";
import { mockConnectedRoutes } from "@/editor/panels/aiRoleMatrixSettings";
import { defaultAiConfig } from "@/ai/llmClient";
import { configForProviderSelection } from "@/ai/providerSelection";

const ok = (a: RoleAssignment) => (a.status === "ok" ? `${a.model.provider}/${a.model.model}` : `missing: ${a.degrade}`);
const table = (spec: string) => {
  const roles = resolveAssistantRoles(mockConnectedRoutes(spec));
  return Object.fromEntries(Object.entries(roles).map(([role, a]) => [role, ok(a)])) as Record<AssistantRole, string>;
};

describe("resolveAssistantRoles — 연결 조합", () => {
  it("Gemini 만: 검토자는 3.8 flash 를 쓰고, 그림은 ChatGPT 연결을 안내한다", () => {
    expect(table("gemini")).toEqual({
      main: "google-antigravity/gemini-4-argon",
      smol: "google-antigravity/gemini-3.8-flash",
      advisor: "google-antigravity/gemini-3.8-flash",
      vision: "google-antigravity/gemini-4-argon",
      image: "missing: 그림은 ChatGPT 로만 그려요. AI 설정에서 ChatGPT 로그인을 연결해 주세요.",
      pixel: "google-antigravity/gemini-4-argon",
    });
  });

  it("옛 Google 그림 지정 대신 연결된 ChatGPT 를 쓴다", () => {
    const roles = resolveAssistantRoles(
      [{ provider: "gpt", providerId: "openai-codex", models: ["gpt-6.1-sol"] }, ...mockConnectedRoutes("gemini")],
      { image: { provider: "google-antigravity", model: "gemini-3.1-flash-image", thinkingLevel: "off" } },
    );
    expect(ok(roles.image)).toBe("openai-codex/codex-image-default");
  });

  it("Claude 만: 그림 생성은 없다고 말하고, 나머지는 로컬 Claude Code 로 채운다", () => {
    const t = table("claude");
    // 오너 결정 2026-11-23: Claude 경로는 주·눈·도트가 Sonnet 5.5 한 모델이다. 잔일 칸(Haiku)은 없다 — 주 모델이 대신한다.
    expect(t.main).toBe("local-cli:claude/claude-sonnet-5-5");
    expect(t.smol).toMatch(/^missing: 주 모델이 대신함/u);
    // 검토자도 Sonnet 5.5 high(N6 2026-11-16, 모델은 2026-11-23) — Claude 만 있으면 주 모델과 같은 모델이 문맥만 따로 본다.
    expect(t.advisor).toBe("local-cli:claude/claude-sonnet-5-5");
    expect(t.vision).toBe("local-cli:claude/claude-sonnet-5-5");
    expect(t.pixel).toBe("local-cli:claude/claude-sonnet-5-5");
    expect(t.image).toMatch(/^missing: 그림은 ChatGPT 로만 그려요/u);
  });

  it("GPT + DeepSeek: 주는 GPT, 검토자는 다른 계열(DeepSeek), 그림은 GPT Image, DeepSeek 은 그림을 못 받아 눈은 GPT", () => {
    const t = table("gpt,deepseek");
    expect(t.main).toBe("openai-codex/gpt-6.2-sol");
    expect(t.smol).toBe("openai-codex/gpt-6-luna");
    expect(t.advisor).toBe("openai-compat:inferhub/deepseek-v4.1-flash");
    expect(t.vision).toBe("openai-codex/gpt-6.2-sol");
    expect(t.image).toBe("openai-codex/codex-image-default");
    expect(t.pixel).toBe("openai-codex/gpt-6.2-sol");
  });

  it("넷 다: 주는 Claude Sonnet 5.5 high, 검토자는 다른 계열(Gemini Argon), 잔일은 다른 계정의 싼 모델(Claude 에는 잔일 칸이 없다), 그림은 GPT Image", () => {
    const roles = resolveAssistantRoles(mockConnectedRoutes("gemini,gpt,claude,deepseek"));
    expect(roles.main).toMatchObject({ status: "ok", model: { provider: "local-cli:claude", model: "claude-sonnet-5-5", thinkingLevel: "high" } });
    const t = table("gemini,gpt,claude,deepseek");
    expect(t.advisor).toBe("google-antigravity/gemini-4-argon");
    expect(t.smol).toBe("google-antigravity/gemini-3.8-flash");
    expect(t.image).toBe("openai-codex/codex-image-default");
    expect(roles.vision).toMatchObject({ status: "ok", model: { provider: "local-cli:claude", model: "claude-sonnet-5-5", thinkingLevel: "high" } });
  });

  it("Claude 가 없으면 주 작업은 Argon medium 으로 물러난다", () => {
    const roles = resolveAssistantRoles(mockConnectedRoutes("gemini,gpt"));
    expect(roles.main).toMatchObject({ status: "ok", model: { provider: "google-antigravity", model: "gemini-4-argon", thinkingLevel: "medium" } });
  });

  it("연결 없음: 여섯 다 missing 이고 각자 물러나는 말을 한다", () => {
    const roles = resolveAssistantRoles([]);
    expect(Object.values(roles).every((a) => a.status === "missing")).toBe(true);
    expect(ok(roles.smol)).toContain("주 모델이 대신함");
    expect(ok(roles.advisor)).toContain("검토자 꺼짐");
    expect(ok(roles.vision)).toContain("그림 검사 없음");
  });
});

describe("resolveAssistantRoles — 규칙", () => {
  it("검토자는 다른 계열이 없으면 같은 계열의 다른 모델, 그것도 없으면 같은 모델에 표시를 단다", () => {
    const sameOnly = resolveAssistantRoles(mockConnectedRoutes("deepseek"));
    expect(sameOnly.advisor.status === "ok" && sameOnly.advisor.note).toMatch(/주 모델과 같은 모델/u);
  });

  it("DeepSeek 엔드포인트가 그림을 받으면 눈을 맡길 수 있다", () => {
    const roles = resolveAssistantRoles([{ provider: "deepseek", providerId: "openai-compat:inferhub", models: ["deepseek-v4.1-flash"], supportsImages: true }]);
    expect(ok(roles.vision)).toBe("openai-compat:inferhub/deepseek-v4.1-flash");
    expect(ok(resolveAssistantRoles(mockConnectedRoutes("deepseek")).vision)).toMatch(/^missing/u);
  });

  it("엔드포인트가 낸 모델 목록에 없는 모델은 배정하지 않는다", () => {
    const roles = resolveAssistantRoles([{ provider: "gemini", providerId: "openai-compat:cliproxy-argon", models: ["gemini-4-argon-medium"] }]);
    expect(ok(roles.main)).toBe("openai-compat:cliproxy-argon/gemini-4-argon");
    expect(ok(roles.image)).toMatch(/^missing/u);
  });

  it("직접 고른 칸이 이기고, 연결 안 된 계정을 고르면 이유와 함께 물러난다", () => {
    const routes = mockConnectedRoutes("gemini");
    const pick = resolveAssistantRoles(routes, { advisor: { provider: "google-antigravity", model: "gemini-4-argon", thinkingLevel: "high" } });
    expect(pick.advisor).toMatchObject({ status: "ok", source: "override" });
    const off = resolveAssistantRoles(routes, { advisor: "off" });
    expect(ok(off.advisor)).toMatch(/직접 끔/u);
    const gone = resolveAssistantRoles(routes, { smol: { provider: "openai-codex", model: "gpt-6-luna", thinkingLevel: "low" } });
    expect(ok(gone.smol)).toMatch(/연결돼 있지 않음/u);
  });
});

describe("assistantRoleModel / configWithAutoAssistantRoles", () => {
  it("자동 배정이 잔일·검토자 칸을 채우고, 직접 고른 칸은 건드리지 않는다", () => {
    // 주 모델이 Google(Argon)인 설정 — 공장 기본은 ChatGPT 라(2026-11-19) Google 계정을 고른 설정으로 만든다.
    const base = configForProviderSelection(defaultAiConfig(), "google-antigravity");
    const auto = configWithAutoAssistantRoles(base, mockConnectedRoutes("gemini,gpt"));
    expect(assistantRoleModel(auto, "advisor")?.provider).toBe("openai-codex");
    expect(assistantRoleModel(auto, "smol")?.model).toBe("gemini-3.8-flash");
    const pinned = configWithAutoAssistantRoles({ ...base, assistantRoles: { advisor: "off" }, modelSelectionOverrides: { advisor: true } }, mockConnectedRoutes("gemini,gpt"));
    expect(assistantRoleModel(pinned, "advisor")).toBeUndefined();
    expect(configWithAutoAssistantRoles(base, []).assistantRoles).toEqual({});
  });

  it("주·눈·도트·그림은 기존 칸을 읽는다", () => {
    const base = defaultAiConfig();
    expect(assistantRoleModel(base, "main")).toEqual({ provider: "openai-codex", model: "gpt-6.2-sol", thinkingLevel: "medium" });
    expect(assistantRoleModel(base, "vision")).toEqual({ provider: "openai-codex", model: "gpt-6.2-sol", thinkingLevel: "medium" });
    // 도트 칸은 비어 있어 계획 모델을 따른다.
    expect(assistantRoleModel(base, "pixel")).toEqual({ provider: "openai-codex", model: "gpt-6.2-sol", thinkingLevel: "medium" });
    expect(assistantRoleModel(base, "image")?.model).toBe(base.imageModel);
  });
});
