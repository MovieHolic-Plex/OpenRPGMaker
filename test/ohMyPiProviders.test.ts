import { describe, expect, it } from "vitest";
import {
  DEFAULT_OH_MY_PI_PROVIDER,
  OH_MY_PI_PROVIDERS,
  getOhMyPiProvider,
  ohMyPiOAuthProviders,
  parseOhMyPiProvider,
} from "@/ai/ohMyPiProviders";

/** can1357/oh-my-pi packages/catalog/src/provider-models/descriptors.ts CATALOG_PROVIDERS ids. */
const OH_MY_PI_KNOWN_PROVIDER_IDS = [
  "aiand",
  "aimlapi",
  "alibaba-coding-plan",
  "alibaba-token-plan",
  "baseten",
  "amazon-bedrock",
  "bedrock-mantle",
  "anthropic",
  "azure",
  "cerebras",
  "cloudflare-ai-gateway",
  "cursor",
  "deepseek",
  "devin",
  "firepass",
  "fireworks",
  "github-copilot",
  "gitlab-duo",
  "gitlab-duo-agent",
  "gmi-cloud",
  "google",
  "google-antigravity",
  "google-gemini-cli",
  "google-vertex",
  "groq",
  "huggingface",
  "kilo",
  "kimi-code",
  "litellm",
  "lm-studio",
  "minimax",
  "minimax-code",
  "minimax-code-cn",
  "mistral",
  "meta",
  "moonshot",
  "nanogpt",
  "nvidia",
  "novita",
  "ollama",
  "ollama-cloud",
  "openai",
  "openai-codex",
  "opencode-go",
  "opencode-zen",
  "openrouter",
  "qianfan",
  "qwen-portal",
  "sakana",
  "siliconflow",
  "siliconflow-cn",
  "synthetic",
  "together",
  "umans",
  "venice",
  "vercel-ai-gateway",
  "vllm",
  "wafer-serverless",
  "coreweave",
  "xai",
  "xai-oauth",
  "xiaomi",
  "xiaomi-token-plan-ams",
  "xiaomi-token-plan-cn",
  "xiaomi-token-plan-sgp",
  "zai",
  "zenmux",
  "zhipu-coding-plan",
] as const;

describe("oh-my-pi provider catalog", () => {
  it("oh-my-pi KnownProvider id 를 빠짐없이 가진다", () => {
    expect(OH_MY_PI_PROVIDERS.map((provider) => provider.id)).toEqual([...OH_MY_PI_KNOWN_PROVIDER_IDS]);
  });

  it("id 가 겹치지 않는다", () => {
    const ids = OH_MY_PI_PROVIDERS.map((provider) => provider.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("기본 제공자는 Codex OAuth 다", () => {
    expect(DEFAULT_OH_MY_PI_PROVIDER).toBe("google-antigravity");
    expect(getOhMyPiProvider(DEFAULT_OH_MY_PI_PROVIDER)?.authKind).toBe("oauth");
  });

  it("모르는 값은 기본 제공자로 되돌린다", () => {
    expect(parseOhMyPiProvider("not-a-provider")).toBe(DEFAULT_OH_MY_PI_PROVIDER);
    expect(parseOhMyPiProvider("anthropic")).toBe("anthropic");
  });

  it("OAuth 제공자를 따로 나열한다", () => {
    const ids = ohMyPiOAuthProviders().map((provider) => provider.id);
    expect(ids).toContain("openai-codex");
    expect(ids).toContain("github-copilot");
    expect(ids).toContain("anthropic");
    expect(ids).not.toContain("openai");
  });
});
