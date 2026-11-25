import { describe, expect, it } from "vitest";
import { objectGateRefusal, ownerWaiverApplies, ownerWaiverReaches, type ObjectGateFinal, type ObjectGateHoldDecision, type ObjectGateOwnerWaiver, decideObjectGateBoth, decideWorkshopRelaxed, type ObjectGateJudgeAnswer, type ObjectGateStyleAnswer } from "@/harnesses/_core/objectGate";
import { isolateTimers } from "./mergedTeardown";

describe("objectGateOwnerWaiver", () => {
  isolateTimers();
  // 오너 면제(2026-11-12): 오너가 «Fable 이 그린 것은 기계 불합격이어도 그냥 배치» 로 결정한 그림 묶음(waivers/<id>.json).
  // 면제는 통과가 아니다 — 서명된 사람 거절과 보정된 Opus 최종 판정이 그 위에 있다.
  // 스토어 출구(2026-11-15): 기본값이 아니다. 그 출구를 적은 오너의 말이 기록된 묶음에만 열린다 — 묶음 머리의 contexts 에 store 가 있거나,
  // `owner-waive-extend` 가 더한 넓힘 기록(extensions — 제 오너 문장·날짜·기록한 쪽을 든다)이 store 를 적은 경우다.
  // Python 쪽 같은 규칙: src/harnesses/_core/object_gate/__init__.py (owner_waiver_applies · refusal). 문서 openwiki/harnesses/object-gate.md 「오너 면제」.

  const SHA = "a".repeat(64);
  const waiver = (over: Partial<ObjectGateOwnerWaiver["batch"]> = {}, kind = "container"): ObjectGateOwnerWaiver => ({
    batch: { schema: "oprn-object-gate-owner-waiver/1", id: "fable-oneshot", owner: "그냥 배치하는 게 맞을거같음", decidedAt: "2026-11-12", recordedBy: "supervisor", contexts: ["bundle", "shared", "workshop-local"], ...over },
    item: { pixelSha256: SHA, kind: kind as never, label: "beodeul_city/bd-spring", width: 32, height: 32, cells: {} },
  });
  const ask = (over: Partial<Parameters<typeof objectGateRefusal>[0]> = {}) => objectGateRefusal({ receipt: null, pixelSha256: SHA, context: "bundle", calibratedProfiles: new Set<string>(), waiver: waiver(), ...over });
  describe("오너 면제 — 출구 규칙", () => {
    it("영수증이 없어도 면제된 그림은 bundle · shared · workshop-local 을 지난다", () => {
      expect(ask({ waiver: null })).toContain("영수증이 없다");
      for (const context of ["bundle", "shared", "workshop-local"] as const) expect(ask({ context, kind: "container" })).toBeNull();
    });

    it("스토어 출구는 기본값이 아니다 — store 를 적지 않은 묶음의 면제는 스토어에 닿지 않는다", () => {
      expect(ask({ context: "store" })).toContain("영수증이 없다");
      expect(ownerWaiverApplies(waiver(), SHA, undefined, "store")).toBe(false);
      expect(ownerWaiverApplies(waiver({ contexts: ["bundle", "shared"] }), SHA, "container", "store")).toBe(false);
    });

    it("store 를 적은 묶음의 면제는 스토어 출구도 지난다 — 묶음 머리에 적었든 넓힘 기록으로 더했든", () => {
      expect(ask({ context: "store", waiver: waiver({ contexts: ["bundle", "store"] }) })).toBeNull();
      const extended = waiver({ contexts: ["bundle", "shared"], extensions: [{ contexts: ["store"], owner: "Fable 이 만든거는 좀 쉽게 통과시키고싶음", decidedAt: "2026-11-15", recordedBy: "supervisor" }] });
      expect(ask({ context: "store", waiver: extended })).toBeNull();
      expect(ownerWaiverReaches(extended.batch, "store")).toBe(true);
      // 넓힌 출구만 열린다 — 넓힘이 적지 않은 출구는 그대로다.
      expect(ask({ context: "workshop-local", waiver: extended })).toContain("영수증이 없다");
    });

    it("오너 문장 · 날짜 · 기록한 쪽이 빈 넓힘 기록은 출구를 열지 않는다", () => {
      for (const blank of [{ owner: " " }, { decidedAt: "" }, { recordedBy: "" }]) {
        const extension = { contexts: ["store" as const], owner: "쉽게 통과시키고싶음", decidedAt: "2026-11-15", recordedBy: "supervisor", ...blank };
        expect(ask({ context: "store", waiver: waiver({ contexts: ["bundle"], extensions: [extension] }) })).toContain("영수증이 없다");
      }
    });

    it("스토어 출구가 열려도 서명된 사람 거절과 보정된 Opus 불합격은 그 위에서 막는다", () => {
      const open = waiver({ contexts: ["bundle", "store"] });
      const hold = { schema: "oprn-object-gate-hold-decision/1", by: "human", via: "review-page", decision: "reject", pixelSha256: SHA, kind: "low_furniture", decidedBy: "owner", decidedAt: "2026-11-12T00:00:00Z", profileHash: "p" } as unknown as ObjectGateHoldDecision;
      expect(ask({ context: "store", waiver: open, hold })).toContain("거절했다");
      const final = { schema: "oprn-object-gate-final/1", pixelSha256: SHA, kind: "container", profileHash: "f1", verdict: "fail", reasons: ["정면 입면도"] } as unknown as ObjectGateFinal;
      expect(ask({ context: "store", waiver: open, final, calibratedFinalProfiles: new Set(["f1"]) })).toContain("Opus 최종 판정 불합격");
    });

    it("그림 해시·종류·출구가 묶음과 다르면 면제가 없다", () => {
      expect(ask({ pixelSha256: "b".repeat(64) })).toContain("영수증이 없다");
      expect(ask({ kind: "box" })).toContain("영수증이 없다");
      expect(ask({ context: "shared", waiver: waiver({ contexts: ["bundle"] }) })).toContain("영수증이 없다");
    });

    it("오너의 말 · 날짜 · 기록한 쪽이 빈 묶음은 면제가 아니다", () => {
      for (const blank of [{ owner: " " }, { decidedAt: "" }, { recordedBy: "" }]) expect(ask({ waiver: waiver(blank) })).toContain("영수증이 없다");
    });

    it("서명된 사람 거절은 면제 위에서 막는다", () => {
      const hold = { schema: "oprn-object-gate-hold-decision/1", by: "human", via: "review-page", decision: "reject", pixelSha256: SHA, kind: "low_furniture", decidedBy: "owner", decidedAt: "2026-11-12T00:00:00Z", profileHash: "p" } as unknown as ObjectGateHoldDecision;
      expect(ask({ hold })).toContain("거절했다");
    });

    it("보정된 Opus 최종 판정이 있으면 그 판정이 최종이다 — 불합격을 면제로 뒤집지 않는다", () => {
      const final = { schema: "oprn-object-gate-final/1", pixelSha256: SHA, kind: "container", profileHash: "f1", verdict: "fail", reasons: ["정면 입면도"] } as unknown as ObjectGateFinal;
      expect(ask({ final, calibratedFinalProfiles: new Set(["f1"]) })).toContain("Opus 최종 판정 불합격");
      // 보정되지 않은 프로필의 기록은 효력이 없다 — 그때는 면제가 닿는다.
      expect(ask({ final, calibratedFinalProfiles: new Set<string>() })).toBeNull();
    });
  });
  // 부품(part) 면제(2026-11-15): 스스로 판정받지 않고 조립 그림에 실려 다니는 부품. `owner-waive` 는 그 조립 그림이 같은 묶음에 있을 때만 적는다.
  // 종류 'part' 로 물을 때만 닿는다 — 종류 없이 묻는 출구·다른 종류로 묻는 출구에는 닿지 않는다(jp_city 굽기 진입 관문 gate_kinds.owner_waived 가 그렇게 묻는다).
  describe("오너 면제 — 조립 그림에 실린 부품(part)", () => {
    const part = (): ObjectGateOwnerWaiver => ({ ...waiver(), item: { pixelSha256: SHA, kind: "part", label: "jp_city/street_stairs/jp-stage-platform", width: 32, height: 64, cells: {}, partOf: "c".repeat(64) } });
    it("종류 part 로 물을 때만 효력이 있다", () => {
      expect(ownerWaiverApplies(part(), SHA, "part", "bundle")).toBe(true);
      expect(ownerWaiverApplies(part(), SHA, undefined, "bundle")).toBe(false);
      expect(ownerWaiverApplies(part(), SHA, "structure", "bundle")).toBe(false);
    });
    it("해시가 다르거나 묶음이 적지 않은 스토어 출구면 부품 면제도 없다", () => {
      expect(ownerWaiverApplies(part(), "b".repeat(64), "part", "bundle")).toBe(false);
      expect(ownerWaiverApplies(part(), SHA, "part", "store")).toBe(false);
    });
    it("부품 면제는 종류 없이 묻는 출구 규칙을 열지 않는다", () => {
      expect(ask({ waiver: part() })).toContain("영수증이 없다");
      expect(ask({ waiver: part(), kind: "structure" })).toContain("영수증이 없다");
    });
  });
});

describe("objectGateWorkshopRelax", () => {
  isolateTimers();
  const view = (reads_as: string, extra: Partial<ObjectGateJudgeAnswer> = {}): ObjectGateJudgeAnswer =>
    ({ reads_as, main_top_rows: 2, front_face_rows: 8, kind_matches: true, side_face_visible: false, all_major_parts_have_top: false, ...extra });
  const style = (extra: Partial<ObjectGateStyleAnswer> = {}): ObjectGateStyleAnswer =>
    ({ verdict: "fail", outline: "near_black", texture: "some", density: "slightly_lower", shading_steps: 3, ...extra });
  describe("workshop-stage relaxed object gate", () => {
    it("passes a three-quarter statue that the strict gate refers for a thin plinth top and a near-black outline", () => {
      const answers = [view("three_quarter"), view("three_quarter"), view("three_quarter"), view("front_elevation")];
      const styles = [style(), style(), style(), style()];
      expect(decideObjectGateBoth("figure", answers, styles).pass).toBe(false);
      expect(decideWorkshopRelaxed("figure", answers, styles).state).toBe("pass");
    });

    it("still fails a drawing most judges read as a front elevation", () => {
      const answers = [view("front_elevation"), view("front_elevation"), view("front_elevation"), view("three_quarter")];
      expect(decideWorkshopRelaxed("column", answers, [style(), style(), style(), style()]).state).toBe("fail");
    });

    it("still fails a flat blob whose style judges see no texture and much lower density", () => {
      const answers = [view("three_quarter"), view("three_quarter"), view("three_quarter"), view("three_quarter")];
      const blob = style({ texture: "flat", density: "much_lower" });
      expect(decideWorkshopRelaxed("box", answers, [blob, blob, blob, style()]).state).toBe("fail");
    });

    it("refers a split view decision instead of passing it", () => {
      const answers = [view("three_quarter"), view("three_quarter"), view("front_elevation"), view("front_elevation")];
      expect(decideWorkshopRelaxed("other", answers, [style(), style(), style(), style()]).state).toBe("refer");
    });
  });
});
