import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPlayBootPayload,
  clearRecentPlayBootDiagnosticsForTest,
  listRecentPlayBootDiagnostics,
  recordPlayBootDiagnostic,
} from "@/player/playBootDiagnostics";

vi.mock("@/ai/activityLog", () => ({
  recordAiActivity: vi.fn(async (input: { instruction: string }) => ({
    id: "log",
    at: new Date().toISOString(),
    channel: "other",
    instruction: input.instruction,
    result: { ok: true },
    toolCalls: [],
    audit: [],
  })),
}));

vi.mock("@/project/store", () => ({
  store: {
    getCurrent: () => ({ startMapId: "map_home_8pyeong_v1" }),
  },
}));

afterEach(() => {
  clearRecentPlayBootDiagnosticsForTest();
  vi.clearAllMocks();
});

describe("playBootDiagnostics", () => {
  it("builds a play-boot payload with error details", () => {
    const payload = buildPlayBootPayload({
      stage: "error",
      ok: false,
      mapId: "map_home_8pyeong_v1",
      elapsedMs: 1234.6,
      error: new Error("boom"),
      detail: "create failed",
    });
    expect(payload.kind).toBe("play-boot");
    expect(payload.stage).toBe("error");
    expect(payload.ok).toBe(false);
    expect(payload.mapId).toBe("map_home_8pyeong_v1");
    expect(payload.elapsedMs).toBe(1235);
    expect(payload.errorMessage).toBe("boom");
    expect(payload.detail).toBe("create failed");
  });

  it("records to the in-memory ring and activity channel", async () => {
    const { recordAiActivity } = await import("@/ai/activityLog");
    recordPlayBootDiagnostic({
      stage: "ready",
      ok: true,
      mapId: "map_home_8pyeong_v1",
      elapsedMs: 40,
    });
    expect(listRecentPlayBootDiagnostics()).toHaveLength(1);
    expect(listRecentPlayBootDiagnostics()[0]?.stage).toBe("ready");
    expect(recordAiActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "other",
        instruction: expect.stringContaining("[play-boot]"),
        mapId: "map_home_8pyeong_v1",
      })
    );
  });
});
