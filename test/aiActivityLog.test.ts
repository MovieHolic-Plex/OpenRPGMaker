import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAiActivityLogRecord,
  clearAiActivityLogs,
  getLatestAiActivityLog,
  listAiActivityLogs,
  recordAiActivity,
  recordAiActivityFromRegionLog,
  serializeAiActivityLogs,
} from "@/ai/activityLog";

describe("ai activity log store", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
      removeItem: (k: string) => {
        storage.delete(k);
      },
      clear: () => storage.clear(),
    });
    clearAiActivityLogs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("builds a clipped chat activity record", () => {
    const record = buildAiActivityLogRecord({
      channel: "chat",
      instruction: "나무 놔줘",
      model: "test-model",
      result: { ok: true, proposedCalls: 1, assistantText: "ok" },
      toolCalls: [{ name: "place_props", args: { count: 1 }, ok: true, summary: "1 props" }],
      audit: [{ kind: "user", text: "나무 놔줘" }, { kind: "tool", name: "place_props", args: {}, ok: true, summary: "1" }],
    });
    expect(record.channel).toBe("chat");
    expect(record.instruction).toBe("나무 놔줘");
    expect(record.toolCalls[0]?.name).toBe("place_props");
    expect(record.audit).toHaveLength(2);
  });

  it("persists ring buffer in localStorage and exposes latest", async () => {
    await recordAiActivity({
      channel: "chat",
      instruction: "first",
      result: { ok: true },
      toolCalls: [],
      audit: [],
    });
    await recordAiActivity({
      channel: "region",
      instruction: "second",
      mapId: "map_1",
      region: { x: 1, y: 2, width: 3, height: 4 },
      result: { ok: true, applied: true, changedCells: 5 },
      toolCalls: [{ name: "fill_region", args: { tileVocabId: "water" }, summary: "filled" }],
      audit: [{ kind: "status", text: "done" }],
    });

    const latest = getLatestAiActivityLog();
    expect(latest?.instruction).toBe("second");
    expect(latest?.channel).toBe("region");
    expect(latest?.result.changedCells).toBe(5);
    expect(listAiActivityLogs()).toHaveLength(2);
    expect(serializeAiActivityLogs(1)).toContain("second");
  });

  it("records region-shaped export without circular regionTask import", async () => {
    const saved = await recordAiActivityFromRegionLog({
      exportedAt: "2026-07-09T00:00:00.000Z",
      mapId: "m1",
      mapName: "마을",
      region: { x: 0, y: 0, width: 8, height: 7 },
      instruction: "호수와 나무 둥글게",
      result: {
        ok: true,
        applied: true,
        changedCells: 32,
        changedEvents: 0,
        clippedCells: 0,
        proposedCalls: 2,
        assistantText: "호수 완료",
      },
      toolCalls: [
        { name: "fill_region", args: { tileVocabId: "water" }, summary: "호수" },
        { name: "place_props", args: { count: 4 }, summary: "나무" },
      ],
      audit: [{ kind: "user", text: "호수" }],
      uiEvents: [{ at: "t", type: "status", text: "시작" }],
    });
    expect(saved.channel).toBe("region");
    expect(saved.mapName).toBe("마을");
    expect(saved.toolCalls).toHaveLength(2);
    expect(getLatestAiActivityLog()?.id).toBe(saved.id);
  });
});
