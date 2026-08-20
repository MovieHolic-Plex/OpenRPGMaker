import { describe, expect, it, vi } from "vitest";
import { companionAuthUrl } from "@/ai/chatgptOAuthClient";

describe("companionAuthUrl", () => {
  it("선택한 oh-my-pi 제공자를 쿼리에 넣는다", () => {
    vi.stubEnv("DEV", "true");
    expect(companionAuthUrl("/auth/status", "groq")).toContain("provider=groq");
    expect(companionAuthUrl("/auth/login", "not-a-provider")).toContain("provider=openai-codex");
  });
});
