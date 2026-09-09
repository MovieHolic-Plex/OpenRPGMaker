import { describe, expect, it } from "vitest";
import { fixture, plan, size, skip } from "./requiredOutcomeFixture";

// Real session/parser/ledger composition; only model transport is scripted.
describe("identity-preserving plan repair with canonical requirements", () => {
  it("adopts a late requirement during repair without replacing the original obligation", async () => {
    const f = fixture();
    const added = { ...size, id: "added-size" };
    await f.run([[plan([size]), skip], [plan([added]), skip]]);
    expect(f.session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [
      { id: "size", required: true, evidence: [{ passed: false }] },
      { id: "added-size", required: true, evidence: [{ passed: false }] },
    ] });
    expect(f.session.getWorkPlan()?.requirements?.map(item => item.id)).toEqual(["added-size"]);
    expect(f.session.getAcceptanceSnapshot()?.items.map(item => item.source?.text)).toEqual([
      "Inspect this map", "Inspect this map",
    ]);
  });
});
