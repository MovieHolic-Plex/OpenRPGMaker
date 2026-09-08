import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPlayBootPayload,
  clearRecentPlayBootDiagnosticsForTest,
  listRecentPlayBootDiagnostics,
  recordPlayBootDiagnostic,
  type PlayBootDiagnosticPayload,
} from "@/player/playBootDiagnostics";
import { editorPlayBootDiagnosticSink } from "@/app/editorPlayBootDiagnostics";
import { LocalDiagnosticSession } from "@/util/localDiagnosticSession";
import * as observer from "@/util/diagnosticObserver";

const diagnostics = new LocalDiagnosticSession();

const recordAiActivityMock = vi.hoisted(() => vi.fn(async () => ({ persisted: "local" })));

vi.mock("@/ai/activityLog", () => ({
  recordAiActivity: recordAiActivityMock,
}));

vi.mock("@/project/store", () => ({
  store: {
    getCurrent: () => ({ startMapId: "map-test" }),
  },
}));

afterEach(() => {
  diagnostics.clear();
  clearRecentPlayBootDiagnosticsForTest();
  vi.restoreAllMocks();
  recordAiActivityMock.mockClear();
});

describe("playBootDiagnostics", () => {
  it.each(["disabled", "unselected", "replaced", "unowned"] as const)(
    "does no local publication or extra input reads when %s, preserving raw logs", state => {
      if (state !== "disabled") diagnostics.start(true, state === "unselected" ? ["movement"] : ["asset"]);
      const owner = state === "unowned" ? undefined : observer.diagnosticToken();
      if (state === "replaced") diagnostics.start(true, ["asset"]);
      const publish = vi.spyOn(observer, "publishDiagnostic");
      let outcomeReads = 0;

      recordPlayBootDiagnostic({ stage: "assets", get ok() { outcomeReads++; return false; } }, undefined, owner);

      expect(outcomeReads).toBe(1); // Existing raw payload construction only.
      expect(publish).not.toHaveBeenCalled();
      expect(diagnostics.snapshot().receipts).toEqual([]);
      expect(listRecentPlayBootDiagnostics()[0]).toMatchObject({ stage: "assets", ok: false });
    },
  );

  it("builds a bounded play-boot payload when an error reaches the local boundary", () => {
    // Given
    const oversizedDetail = "x".repeat(600);

    // When
    const payload = buildPlayBootPayload({
      stage: "error",
      ok: false,
      mapId: "map-test",
      elapsedMs: 1234.6,
      error: new Error("boom"),
      detail: oversizedDetail,
    });

    // Then
    expect(payload).toMatchObject({
      kind: "play-boot",
      stage: "error",
      ok: false,
      mapId: "map-test",
      elapsedMs: 1235,
      errorMessage: "boom",
    });
    expect(payload.detail).toHaveLength(500);
  });

  it("records locally without invoking editor telemetry when no sink is provided", async () => {
    // Given
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    // When
    recordPlayBootDiagnostic({ stage: "ready", ok: true, mapId: "map-test" });
    await Promise.resolve();

    // Then
    expect(listRecentPlayBootDiagnostics()).toEqual([
      expect.objectContaining({ stage: "ready", ok: true, mapId: "map-test" }),
    ]);
    expect(info).toHaveBeenCalledOnce();
    expect(recordAiActivityMock).not.toHaveBeenCalled();
  });

  it("delivers the local payload to an injected sink", async () => {
    // Given
    let signal!: () => void;
    const delivered = new Promise<void>(resolve => { signal = resolve; });
    const sink = vi.fn<(payload: PlayBootDiagnosticPayload) => Promise<void>>(async () => { signal(); });
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    // When
    recordPlayBootDiagnostic({ stage: "map", ok: true, mapId: "map-test" }, sink);
    await delivered;
    expect(sink).toHaveBeenCalledOnce();

    // Then
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "play-boot", stage: "map", mapId: "map-test" }),
    );
  });

  it("keeps diagnostics and boot flow alive when an injected sink rejects", async () => {
    // Given
    let signal!: () => void;
    const rejected = new Promise<void>(resolve => { signal = resolve; });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => { signal(); });
    const sink = vi.fn<(payload: PlayBootDiagnosticPayload) => Promise<void>>(async () => {
      throw new Error("editor persistence unavailable");
    });

    // When
    recordPlayBootDiagnostic({ stage: "engine", ok: true, mapId: "map-test" }, sink);
    await rejected;
    expect(warn).toHaveBeenCalledWith("[play-boot] diagnostic sink failed");

    // Then
    expect(listRecentPlayBootDiagnostics()).toHaveLength(1);
    expect(sink).toHaveBeenCalledOnce();
  });

  it("persists diagnostics only when the editor-owned adapter is injected", async () => {
    // Given
    const payload = buildPlayBootPayload({
      stage: "ready",
      ok: true,
      mapId: "map-test",
      elapsedMs: 42,
    });

    // When
    await editorPlayBootDiagnosticSink(payload);

    // Then
    expect(recordAiActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "other",
        mapId: "map-test",
        instruction: expect.stringContaining("stage=ready"),
        uiEvents: [payload],
      }),
    );
  });
});
