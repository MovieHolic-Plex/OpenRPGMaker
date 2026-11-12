import { describe, expect, it } from "vitest";
import { objectGateRefusal, ownerWaiverApplies, type ObjectGateFinal, type ObjectGateHoldDecision, type ObjectGateOwnerWaiver } from "@/harnesses/_core/objectGate";

// 오너 면제(2026-11-12): 오너가 «Fable 이 그린 것은 기계 불합격이어도 그냥 배치» 로 결정한 그림 묶음(waivers/<id>.json).
// 면제는 통과가 아니다 — 스토어 출구에는 닿지 않고, 서명된 사람 거절과 보정된 Opus 최종 판정이 그 위에 있다.
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

  it("스토어 출구는 면제를 받지 않는다 — 묶음이 store 를 적어도", () => {
    expect(ask({ context: "store" })).toContain("영수증이 없다");
    expect(ask({ context: "store", waiver: waiver({ contexts: ["bundle", "store"] as never }) })).toContain("영수증이 없다");
    expect(ownerWaiverApplies(waiver({ contexts: ["store"] as never }), SHA, undefined, "store")).toBe(false);
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
