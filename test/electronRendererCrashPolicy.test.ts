import { describe, expect, it } from "vitest";
import { planRendererCrashRecovery } from "../electron/main/rendererCrashPolicy";

describe("Electron renderer crash recovery", () => {
  it("ignores a clean exit", () => {
    expect(planRendererCrashRecovery("clean-exit", 1_000, [0, 500])).toEqual({ action: "ignore" });
  });

  it("allows two reloads per window and reports a third crash within a minute", () => {
    const first = planRendererCrashRecovery("oom", 0, []);
    expect(first).toEqual({ action: "reload", reloads: [0] });
    if (first.action !== "reload") throw new Error("Expected the first reload");

    const second = planRendererCrashRecovery("crashed", 25_000, first.reloads);
    expect(second).toEqual({ action: "reload", reloads: [0, 25_000] });
    if (second.action !== "reload") throw new Error("Expected the second reload");

    expect(planRendererCrashRecovery("launch-failed", 59_999, second.reloads)).toEqual({ action: "report" });
    expect(planRendererCrashRecovery("crashed", 59_999, [])).toEqual({ action: "reload", reloads: [59_999] });
  });

  it("releases just the expired reload at the rolling window boundary", () => {
    const next = planRendererCrashRecovery("killed", 60_000, [0, 25_000]);
    expect(next).toEqual({ action: "reload", reloads: [25_000, 60_000] });
    if (next.action !== "reload") throw new Error("Expected to allow a reload after a minute");

    expect(planRendererCrashRecovery("crashed", 60_001, next.reloads)).toEqual({ action: "report" });
  });
});
