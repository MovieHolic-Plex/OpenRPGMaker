import { describe, expect, it } from "vitest";
import { assertSmallTaskLayering } from "../scripts/check-small-task-layering.mjs";

describe("small-task layering", () => {
  it("keeps core from importing or naming a numbered unit", () => {
    expect(assertSmallTaskLayering()).toEqual([]);
  });
});
