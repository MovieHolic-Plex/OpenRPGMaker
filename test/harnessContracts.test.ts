import { describe, expect, it } from "vitest";
import { contractHarnessIds, getHarnessContract } from "@/harnesses/_core/contracts";
import { HARNESSES } from "@/harnesses/_core/registry";

// gameDesignBrief (project schema, shipped in the player) reads saved harness contracts through the light
// contracts index instead of the full registry, so the player does not pull every harness editor runner.
// The two must agree: every registry harness with a contract is in the index, with the same normaliser.
describe("harness contracts index", () => {
  it("lists exactly the registry harnesses that declare a contract", () => {
    const fromRegistry = HARNESSES.filter((harness) => harness.contract).map((harness) => harness.id).sort();
    expect([...contractHarnessIds()].sort()).toEqual(fromRegistry);
    for (const harness of HARNESSES) {
      if (harness.contract) expect(getHarnessContract(harness.id)?.normalize).toBe(harness.contract.normalize);
    }
    expect(getHarnessContract("no-such-harness")).toBeUndefined();
  });
});
