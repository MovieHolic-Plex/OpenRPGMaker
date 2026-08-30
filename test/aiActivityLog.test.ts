import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAiActivityLogRecord,
  clearAiActivityLogs,
  getLatestAiActivityLog,
  listAiActivityLogs,
  recordAiActivity,
  serializeAiActivityLogs,
} from "@/ai/activityLog";
import { constructionAuditFromResult } from "@/editor/construction/constructionAudit";
import type { ConstructionOutcome } from "@/editor/construction/contracts";

const failedConstruction = {
  executionOk: false,
  applied: false,
  outcome: "failed",
  requestedEntrypoint: "author_village",
  canonicalRoute: "author_village",
  selectedImplementation: "natural-village-builder",
  routeChanges: [],
  activityPersistence: "local",
  projectPersistence: "failed",
  target: { kind: "existing", mapId: "m1" },
  counts: { requested: 8, actual: 0 },
  diff: {
    tilesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    endingsChanged: 0,
    sessionChanged: false,
    systemChanged: false,
  },
  warnings: ["exact count rolled back"],
} as const satisfies ConstructionOutcome;

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

  // 스코프 턴(영역)도 조수와 같은 recordAiActivity 를 쓴다 — 전용 기록기
  // (recordAiActivityFromRegionLog)는 실행체 통합으로 사라졌고, 위의 channel:"region" 케이스가
  // 같은 표면을 덮는다.
  it("keeps the region channel on a scoped turn recorded through the shared path", async () => {
    const saved = await recordAiActivity({
      channel: "region",
      instruction: "호수와 나무 둥글게",
      mapId: "m1",
      mapName: "마을",
      region: { x: 0, y: 0, width: 8, height: 7 },
      result: { ok: true, applied: true, changedCells: 32, proposedCalls: 2, assistantText: "호수 완료" },
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

  it("round-trips failed construction calls without conflating activity and project persistence", async () => {
    // Given: a failed canonical call represented in both the top-level call list and audit ledger.
    const construction = constructionAuditFromResult({ resultData: { construction: failedConstruction } });
    expect(construction).not.toBeNull();
    await recordAiActivity({
      channel: "chat",
      instruction: "집 8채 마을을 정확히 지어줘",
      result: { ok: false, applied: false, error: "exact count rolled back" },
      toolCalls: [{
        name: "author_village",
        args: { target: { kind: "existing", mapId: "m1" }, houseCount: 8 },
        ok: false,
        summary: "exact count rolled back",
        ...(construction === null ? {} : { construction }),
      }],
      audit: [{
        kind: "tool",
        name: "author_village",
        args: { houseCount: 8 },
        ok: false,
        summary: "exact count rolled back",
        ...(construction === null ? {} : { construction }),
      }],
    });
    // When: the local activity export is serialized and parsed again.
    const exported: unknown = JSON.parse(serializeAiActivityLogs(1));
    // Then: the failed call remains present and project persistence is still explicitly failed.
    expect(exported).toMatchObject([{
      result: { ok: false, applied: false },
      toolCalls: [{
        name: "author_village",
        ok: false,
        construction: {
          outcome: "failed",
          activityPersistence: "local",
          projectPersistence: "failed",
        },
      }],
      audit: [{
        kind: "tool",
        ok: false,
        construction: { outcome: "failed" },
      }],
    }]);
  });
});
