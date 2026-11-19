import { describe, expect, it } from "vitest";
import { decideAfterCloseFlush, decideCloseResponse } from "../electron/main/closeFlow";

describe("desktop close decisions", () => {
  it("closes after either save attempt reports success", () => {
    expect(decideAfterCloseFlush("auto", true)).toBe("close");
    expect(decideAfterCloseFlush("save", true)).toBe("close");
  });

  it("asks what to do when the automatic save fails or times out", () => {
    expect(decideAfterCloseFlush("auto", false)).toBe("confirm");
    expect(decideAfterCloseFlush("auto", undefined)).toBe("confirm");
  });

  it("keeps the editor open and reports failure after an unsuccessful explicit save", () => {
    expect(decideAfterCloseFlush("save", false)).toBe("report-failure");
    expect(decideAfterCloseFlush("save", undefined)).toBe("report-failure");
  });

  it("maps the native buttons and treats dismissal as Cancel", () => {
    expect(decideCloseResponse(0)).toBe("save");
    expect(decideCloseResponse(1)).toBe("discard");
    expect(decideCloseResponse(2)).toBe("cancel");
    expect(decideCloseResponse(-1)).toBe("cancel");
  });
});
