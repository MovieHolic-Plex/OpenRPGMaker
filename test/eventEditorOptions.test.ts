import { describe, expect, it } from "vitest";
import { PAGE_COMMAND_BUTTONS, TRIGGER_OPTIONS } from "@/editor/panels/eventEditor/options";

describe("event editor trigger options", () => {
  it("shows parallel as an implemented trigger option", () => {
    const parallelOption = TRIGGER_OPTIONS.find((option) => option.value === "parallel");

    expect(parallelOption).toMatchObject({ value: "parallel", label: "뒤에서 계속 실행" });
    expect(parallelOption?.description).toContain("반복");
  });

  it("shows RM2003 player and event touch triggers separately without the legacy touch alias", () => {
    expect(TRIGGER_OPTIONS.map((option) => option.value)).toEqual([
      "action",
      "playerTouch",
      "eventTouch",
      "auto",
      "parallel",
      "locationTransition",
    ]);
    for (const option of TRIGGER_OPTIONS) {
      expect(option.description, option.label).toBeTruthy();
      expect(option.description).not.toBe(option.label);
    }
  });
});

describe("event editor command shortcuts", () => {
  it("exposes ending as a direct authoring command", () => {
    expect(PAGE_COMMAND_BUTTONS).toContainEqual({
      kind: "ending",
      testId: "command-add-ending",
      label: "엔딩",
    });
  });
});
