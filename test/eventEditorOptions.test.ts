import { describe, expect, it } from "vitest";
import { TRIGGER_OPTIONS } from "@/editor/panels/eventEditor/options";

describe("event editor trigger options", () => {
  it("shows parallel as an implemented trigger option", () => {
    const parallelOption = TRIGGER_OPTIONS.find((option) => option.value === "parallel");

    expect(parallelOption).toEqual({ value: "parallel", label: "Parallel Process" });
  });

  it("shows RM2003 player and event touch triggers separately without the legacy touch alias", () => {
    expect(TRIGGER_OPTIONS.map((option) => option.value)).toEqual([
      "action",
      "playerTouch",
      "eventTouch",
      "auto",
      "parallel",
    ]);
  });
});
