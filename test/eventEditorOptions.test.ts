import { describe, expect, it } from "vitest";
import { TRIGGER_OPTIONS } from "@/editor/panels/eventEditor/options";

describe("event editor trigger options", () => {
  it("shows parallel as an implemented trigger option", () => {
    const parallelOption = TRIGGER_OPTIONS.find((option) => option.value === "parallel");

    expect(parallelOption).toEqual({ value: "parallel", label: "병렬 처리" });
  });

  it("shows RM2003 player and event touch triggers separately", () => {
    expect(TRIGGER_OPTIONS.map((option) => option.value)).toEqual([
      "action",
      "playerTouch",
      "eventTouch",
      "touch",
      "auto",
      "parallel",
    ]);
  });
});
