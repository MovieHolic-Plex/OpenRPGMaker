import { describe, expect, it } from "vitest";
import { fixture, plan, size, skip, target } from "./requiredOutcomeFixture";

// Real session/parser/ledger composition; only model transport is scripted.
describe("identity-preserving plan repair with canonical requirements", () => {
  it("adopts a late requirement during repair without replacing the original obligation", async () => {
    const f = fixture();
    const added = { ...size, id: "added-size" };
    await f.run([[plan([size]), skip], [plan([added]), skip]], {}, "Inspect this map");
    const snapshot = f.session.getAcceptanceSnapshot();
    expect(snapshot?.status).toBe("blocked");
    expect(snapshot?.items.map(item => item.id)).toEqual(["request-1:source:0", "size", "added-size"]);
    expect(snapshot?.items[0]).toMatchObject({ id: "request-1:source:0", required: true,
      source: { requestId: "request-1", text: "Inspect this map" },
      sourceSpan: { start: 0, end: 16, quote: "Inspect this map" }, coverage: "uncovered", evidence: [] });
    const promises = snapshot?.items.filter(item => item.id === "size" || item.id === "added-size");
    expect(promises).toMatchObject([
      { id: "size", required: true, evidence: [{ passed: false }] },
      { id: "added-size", required: true, evidence: [{ passed: false }] },
    ]);
    expect(f.session.getWorkPlan()?.requirements?.map(item => item.id)).toEqual(["added-size"]);
    expect(promises?.map(item => item.source?.text)).toEqual([
      "Inspect this map", "Inspect this map",
    ]);
  });

  it("preserves declared source bindings and both 99x99 promises across late repair", async () => {
    const f = fixture();
    const raw = "Resize this map to 99x99";
    const first = raw.indexOf("99"), second = raw.lastIndexOf("99");
    const bindings = [
      { source: { start: first, end: first + 2, quote: "99" }, role: "width", criterionIndex: 0, fieldPath: ["width"] },
      { source: { start: second, end: second + 2, quote: "99" }, role: "height", criterionIndex: 0, fieldPath: ["height"] },
    ];
    f.setIntent({ mode: "modify", requestRequirements: { entries: [{
      source: [{ start: 0, end: raw.length, quote: raw }],
      criteria: [{ kind: "mapDimensions", target, width: 99, height: 99 }], bindings,
    }] } });
    const added = { ...size, id: "added-size" };
    await f.run([[plan([size]), skip], [plan([added]), skip]], {}, raw);
    const snapshot = f.session.getAcceptanceSnapshot();
    expect(snapshot?.status).toBe("blocked");
    expect(snapshot?.items.map(item => item.id)).toEqual(["request-1:source:0", "size", "added-size"]);
    expect(snapshot?.items).toMatchObject([
      { id: "request-1:source:0", required: true, coverage: "declared", evidence: [{ passed: false }] },
      { id: "size", required: true, evidence: [{ passed: false }] },
      { id: "added-size", required: true, evidence: [{ passed: false }] },
    ]);
    expect(f.session.getWorkPlan()?.requirements?.map(item => item.id)).toEqual(["added-size"]);
    expect(f.session.getHarnessSnapshot().requests).toEqual([{ requestId: "request-1", rawInstruction: raw, authoring: true,
      units: [{ id: "request-1:source:0", source: { start: 0, end: raw.length, quote: raw }, coverage: "declared",
        criteria: [{ kind: "mapDimensions", target, width: 99, height: 99 }], bindings, unresolvedReason: undefined }],
    }]);
    const sourceEvents = f.events.filter(event => event.type === "acceptance" && event.snapshot?.items[0]?.coverage === "declared");
    expect(sourceEvents.length).toBeGreaterThan(1);
    for (const event of sourceEvents) if (event.type === "acceptance") {
      expect(event.snapshot?.items[0]).toMatchObject({ id: "request-1:source:0", required: true,
        source: { requestId: "request-1", text: raw }, sourceSpan: { start: 0, end: raw.length, quote: raw } });
    }
  });
});
