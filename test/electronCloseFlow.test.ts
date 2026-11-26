import { describe, expect, it, vi } from "vitest";
import { decideAfterCloseFlush, decideCloseResponse, flushProjectForClose } from "../electron/shared/closeFlow";

describe("desktop close decisions", () => {
  it("closes after either save attempt reports success", () => {
    expect(decideAfterCloseFlush("auto", true)).toBe("close");
    expect(decideAfterCloseFlush("save", true)).toBe("close");
  });

  it("asks what to do when the automatic save fails or times out", () => {
    expect(decideAfterCloseFlush("auto", false)).toBe("confirm");
    expect(decideAfterCloseFlush("auto", undefined)).toBe("confirm");
  });

  it("closes a clean project without contacting the disconnected host", async () => {
    const project = {
      hasUnsavedChanges: () => false,
      flush: vi.fn().mockRejectedValue(new Error("host offline")),
    };
    expect(decideAfterCloseFlush("auto", await flushProjectForClose(project))).toBe("close");
    expect(project.flush).not.toHaveBeenCalled();
  });

  it("checks for remaining edits even when the save reports a failure", async () => {
    let dirty = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const project = {
      hasUnsavedChanges: () => dirty,
      flush: vi.fn().mockRejectedValue(new Error("host offline")),
    };
    try {
      expect(decideAfterCloseFlush("auto", await flushProjectForClose(project))).toBe("confirm");
      expect(decideAfterCloseFlush("save", await flushProjectForClose(project))).toBe("report-failure");
      project.flush.mockImplementationOnce(async () => {
        dirty = false;
        throw new Error("an older request failed after the current version was saved");
      });
      expect(decideAfterCloseFlush("auto", await flushProjectForClose(project))).toBe("close");
    } finally {
      log.mockRestore();
    }
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
