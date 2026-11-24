// 로컬 CLI 재시도 판정 — 계정 사용 한도(날짜가 박힌 «다시 시도»)는 몇 초 뒤 다시 보내도 같은 거절이다.
// 2026-11-24 draft-10min 실측: codex 의 사용 한도 오류를 일시 오류로 읽어 5번 다시 보내느라 화면 검수 한 판마다 약 140초가 빈 답으로 사라졌다.
import { describe, expect, it } from "vitest";
import { isHardQuotaCliError, isTransientCliError } from "../scripts/lib/localCliAgent/process.ts";

describe("isTransientCliError", () => {
  it("does not retry an exhausted account usage limit", () => {
    const codex = "You’ve hit your usage limit. Visit https://chatgpt.com/settings/usage to purchase more credits or try again at Nov 27th, 2026 2:53 AM.";
    const api = "You have hit your ChatGPT usage limit (pro plan). Try again in ~5309 min.";
    for (const message of [codex, api]) {
      expect(isHardQuotaCliError(message)).toBe(true);
      expect(isTransientCliError(message)).toBe(false);
    }
  });

  it("still retries short capacity and rate-limit refusals", () => {
    for (const message of [
      "API Error: Request rejected (429) · This request would exceed your account's rate limit. Please try again later.",
      "Selected model is at capacity. Please try a different model.",
      "503 temporarily unavailable",
    ]) expect(isTransientCliError(message)).toBe(true);
  });
});
