// 명세 은행 재생은 진짜 모델을 부르지 않는다 — 대본(streamFn)을 받는 제공자로만 넘기고, 진짜 사용량이 보이면 멈춘다(scripts/qa/assistant-v2/specBank/spec.mts).
// 2026-11-12: Haiku 판(제공자 local-cli:claude) 여섯을 재생했더니 로컬 CLI 고리가 대본을 무시하고 실제 게임 여섯 판을 돌렸다(CLI 호출 약 1,180번).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { realModelSign, replayEngine, SCRIPTED_MODEL, SCRIPTED_PROVIDER } from "../scripts/qa/assistant-v2/specBank/spec.mts";

describe("spec bank replay — the engine handed to the runtime always takes the script", () => {
  it("keeps the recorded provider only when it is known to take the scripted stream", () => {
    expect(replayEngine({ provider: "openai-compat:opencodex", model: "gpt-6.1-terra" })).toEqual({ provider: "openai-compat:opencodex", model: "gpt-6.1-terra", swapped: false });
    expect(replayEngine({ provider: "openai-compat:other", model: "" })).toEqual({ provider: "openai-compat:other", model: SCRIPTED_MODEL, swapped: false });
  });
  it("swaps a local CLI provider (and anything else) for the scripted default", () => {
    for (const provider of ["local-cli:claude", "local-cli:codex", "local-cli:gemini", "anthropic", "gemini"]) {
      expect(replayEngine({ provider, model: "claude-haiku-5-5" }), provider).toEqual({ provider: SCRIPTED_PROVIDER, model: SCRIPTED_MODEL, swapped: true });
    }
    expect(replayEngine({})).toEqual({ provider: SCRIPTED_PROVIDER, model: SCRIPTED_MODEL, swapped: false });
  });
  it("the replay does not hand the recorded provider to the runtime", () => {
    const source = readFileSync("scripts/qa/assistant-v2/specBank/replayGame.mts", "utf8");
    expect(source).toContain("provider: engine.provider, model: engine.model");
    expect(source).not.toMatch(/provider:\s*spec\.source\.provider/u);
  });
});

describe("spec bank replay — signs of a real model", () => {
  it("a scripted replay prints zero usage; anything else is a real model", () => {
    expect(realModelSign({ usageLine: "[pi-usage] input=0 cacheRead=0" })).toBeUndefined();
    expect(realModelSign({ usageLine: "[pi-usage] input=2 cacheRead=243351" })).toContain("input=2 cacheRead=243351");
    expect(realModelSign({ usageLine: "[pi-usage] input=24 cacheRead=0" })).toBeDefined();
    expect(realModelSign({ usageLine: "[r1-fun] 턴 1/3: 호출 120/120" })).toBeUndefined();
  });
  it("a turn that ends without the script having been asked, or with none of the recorded calls played, is a real model", () => {
    expect(realModelSign({ turn: { calls: 157, played: 157, scripted: 160 } })).toBeUndefined();
    expect(realModelSign({ turn: { calls: 157, played: 0, scripted: 0 } })).toContain("대본");
    expect(realModelSign({ turn: { calls: 157, played: 0, scripted: 3 } })).toContain("0/157");
    expect(realModelSign({ turn: { calls: 0, played: 0, scripted: 0 } })).toBeUndefined();
  });
});
