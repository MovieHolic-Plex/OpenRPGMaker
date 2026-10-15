// poke-depth PR6: 조건부 볼. 작성만 했고 실행하지 않았다(워크트리 규칙).
import { describe, expect, it } from "vitest";
import { captureConditionLabel, captureConditionLine, captureConditionMultiplier, normalizeCaptureCondition } from "@/battle/captureBalls";
import { normalizeItemRecord } from "@/project/databaseRecordModel";

const ctx = (over: Partial<{ turn: number; targetTypes: string[]; speciesCaught: boolean }> = {}) => ({ turn: 0, targetTypes: ["normal"], speciesCaught: false, ...over });

describe("normalizeCaptureCondition", () => {
  it("drops unknown kinds and type conditions without types", () => {
    expect(normalizeCaptureCondition(undefined)).toBeUndefined();
    expect(normalizeCaptureCondition({ kind: "bogus", multiplier: 3 })).toBeUndefined();
    expect(normalizeCaptureCondition({ kind: "type", multiplier: 3 })).toBeUndefined();
    expect(normalizeCaptureCondition({ kind: "type", types: [], multiplier: 3 })).toBeUndefined();
  });
  it("clamps multipliers to 1.1..8 and fills per-kind defaults", () => {
    expect(normalizeCaptureCondition({ kind: "firstTurn" })).toEqual({ kind: "firstTurn", multiplier: 5 });
    expect(normalizeCaptureCondition({ kind: "repeat", multiplier: 99 })).toEqual({ kind: "repeat", multiplier: 8 });
    expect(normalizeCaptureCondition({ kind: "repeat", multiplier: 0.2 })).toEqual({ kind: "repeat", multiplier: 1.1 });
    expect(normalizeCaptureCondition({ kind: "type", types: ["water", "water", "bug"] })).toEqual({ kind: "type", types: ["water", "bug"], multiplier: 3.5 });
    expect(normalizeCaptureCondition({ kind: "turns", step: 99 })).toEqual({ kind: "turns", multiplier: 4, step: 2 });
  });
  it("is omitted from capture profiles that do not set it (unchanged bytes)", () => {
    expect("condition" in (normalizeItemRecord({ id: "b", name: "b", captureProfile: { multiplier: 1, ballClass: "poke" } }).captureProfile ?? {})).toBe(false);
    expect(normalizeItemRecord({ id: "b", name: "b", captureProfile: { multiplier: 1, condition: { kind: "firstTurn", multiplier: 5 } } }).captureProfile?.condition).toEqual({ kind: "firstTurn", multiplier: 5 });
  });
});

describe("captureConditionMultiplier", () => {
  it("type matches any listed type", () => {
    const net = normalizeCaptureCondition({ kind: "type", types: ["water", "bug"], multiplier: 3.5 });
    expect(captureConditionMultiplier(net, ctx({ targetTypes: ["normal", "bug"] }))).toBe(3.5);
    expect(captureConditionMultiplier(net, ctx({ targetTypes: ["fire"] }))).toBe(1);
  });
  it("firstTurn applies only before any round has finished", () => {
    const quick = normalizeCaptureCondition({ kind: "firstTurn", multiplier: 5 });
    expect(captureConditionMultiplier(quick, ctx({ turn: 0 }))).toBe(5);
    expect(captureConditionMultiplier(quick, ctx({ turn: 1 }))).toBe(1);
  });
  it("turns grows by step per round and caps at the multiplier", () => {
    const timer = normalizeCaptureCondition({ kind: "turns", multiplier: 4, step: 0.5 });
    expect(captureConditionMultiplier(timer, ctx({ turn: 0 }))).toBe(1);
    expect(captureConditionMultiplier(timer, ctx({ turn: 2 }))).toBe(2);
    expect(captureConditionMultiplier(timer, ctx({ turn: 50 }))).toBe(4);
  });
  it("repeat needs the species in the dex; no condition means 1", () => {
    const repeat = normalizeCaptureCondition({ kind: "repeat", multiplier: 3.5 });
    expect(captureConditionMultiplier(repeat, ctx({ speciesCaught: true }))).toBe(3.5);
    expect(captureConditionMultiplier(repeat, ctx({ speciesCaught: false }))).toBe(1);
    expect(captureConditionMultiplier(undefined, ctx())).toBe(1);
  });
});

describe("captureCondition text", () => {
  it("labels each kind and uses the right josa", () => {
    expect(captureConditionLabel({ kind: "firstTurn", multiplier: 5 })).toBe("첫 차례 ×5");
    expect(captureConditionLabel({ kind: "type", types: ["water", "bug"], multiplier: 3.5 }, (id) => ({ water: "물", bug: "벌레" } as Record<string, string>)[id] ?? id)).toBe("물·벌레 타입 ×3.5");
    expect(captureConditionLine({ kind: "firstTurn", multiplier: 5 }, "신속 구슬")).toBe("신속 구슬이 첫 차례라서 힘을 발휘한다!");
    expect(captureConditionLine({ kind: "repeat", multiplier: 3.5 }, "재회 볼")).toBe("재회 볼이 낯익은 종에게 잘 듣는 것 같다!");
  });
});
