import { describe, expect, it } from "vitest";
import { EMPTY_SESSION_USAGE, addSessionUsage } from "@/ai/sessionUsage";
import {
  buildRunRecap,
  extractRunProcess,
  formatElapsedMs,
  formatRunRecapPlayerLine,
  parseRunRecapPayload,
  serializeRunRecap,
  usageDelta,
} from "@/ai/runRecap";

describe("usageDelta", () => {
  it("세션 누적에서 이번 목표만 뺀다", () => {
    const before = addSessionUsage(EMPTY_SESSION_USAGE, "big", { prompt_tokens: 100, completion_tokens: 10 });
    let after = addSessionUsage(before, "big", { prompt_tokens: 40, completion_tokens: 5 });
    after = addSessionUsage(after, "lite", { prompt_tokens: 8, completion_tokens: 2 });
    const delta = usageDelta(before, after);
    expect(delta.calls).toBe(2);
    expect(delta.promptTokens).toBe(48);
    expect(delta.completionTokens).toBe(7);
    expect(delta.byModel.map((entry) => entry.model)).toEqual(["big", "lite"]);
    expect(delta.byModel[0]).toMatchObject({ calls: 1, promptTokens: 40, completionTokens: 5 });
  });
});

describe("extractRunProcess", () => {
  it("플래너·Ralph·볼륨·같은 툴 연속을 과정으로 남긴다", () => {
    const steps = extractRunProcess([
      { kind: "status", text: "planner:direct-rejected 한 턴" },
      { kind: "status", text: "volume-contract:forced-plan" },
      { kind: "tool", name: "place_npc", ok: true },
      { kind: "tool", name: "place_npc", ok: true },
      { kind: "status", text: "ralph:continue step=1/256" },
      { kind: "status", text: "volume-contract:continue 1/8 상점 +0" },
      { kind: "status", text: "tools:exposed 40 — place_npc" },
      { kind: "status", text: "턴 종료(final) — 제안 2건 · 출력 토큰 ~12" },
    ]);
    expect(steps.map((step) => step.kind)).toEqual([
      "planner",
      "volume",
      "tool",
      "ralph",
      "volume",
      "end",
    ]);
    expect(steps.find((step) => step.kind === "tool")?.text).toBe("place_npc ok ×2");
  });
});

describe("player line vs log payload", () => {
  it("채팅 줄은 토큰과 경과만 담고 과정은 JSON 로그에 둔다", () => {
    const usage = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", { prompt_tokens: 84_120, completion_tokens: 6_410 });
    const recap = buildRunRecap({
      elapsedMs: 48_210,
      usage,
      audit: [
        { kind: "status", text: "planner:new_plan items=3" },
        { kind: "tool", name: "author_village", ok: true },
        { kind: "status", text: "ralph:continue step=1/256" },
      ],
      stoppedReason: "final",
      proposedWrites: 1,
    });
    expect(formatElapsedMs(recap.elapsedMs)).toBe("48초");
    expect(formatRunRecapPlayerLine(recap)).toBe("토큰 입력 84,120 · 출력 6,410 · 48초");
    expect(formatRunRecapPlayerLine(recap)).not.toContain("ralph");
    const parsed = parseRunRecapPayload(`run-recap ${serializeRunRecap(recap)}`);
    expect(parsed?.ralphContinues).toBe(1);
    expect(parsed?.usage.promptTokens).toBe(84_120);
    expect(parsed?.process.some((step) => step.kind === "ralph")).toBe(true);
    expect(serializeRunRecap(recap)).not.toContain("agent_run:auto-continue");
  });

  it("공급자가 usage 를 안 주면 미보고로 말한다", () => {
    const usage = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", undefined);
    const recap = buildRunRecap({
      elapsedMs: 1500,
      usage,
      audit: [],
      stoppedReason: "final",
      proposedWrites: 0,
    });
    expect(formatRunRecapPlayerLine(recap)).toBe("토큰 미보고 · LLM 1회 · 2초");
  });
});
