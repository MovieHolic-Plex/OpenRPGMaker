import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { CHIP_CORNER_INSET, placeAiActivityChip } from "@/editor/aiActivityChipPlacement";
import { buildAiActivityLogRecord, clearAiActivityLogs, getLatestAiActivityLog, listAiActivityLogs, recordAiActivity, recordAiActivityFromRegionLog, serializeAiActivityLogs, buildAiActivityMirrorRequest } from "@/ai/activityLog";
import { constructionAuditFromResult } from "@/editor/construction/constructionAudit";
import type { ConstructionOutcome } from "@/editor/construction/contracts";
import { readFileSync } from "node:fs";
import { AI_ACTIVITY_DISK_ENDPOINT } from "../src/ai/activityLogEndpoint";
import { activityPayload, activityPhase, createActivityTrace, recordActivityEvent, ACTIVITY_ENTRY_LIMIT } from "@/ai/activityTrace";
import { isolateTimers } from "./mergedTeardown";

describe("aiActivityChipPlacement", () => {
  isolateTimers();
  const viewport = { width: 400, height: 300 };
  const chip = { width: 80, height: 24 };
  const region = { x: 10, y: 8, width: 6, height: 4 };
  describe("placeAiActivityChip", () => {
    it("카메라 좌표를 반영해 영역 위 중앙에 배치한다", () => {
      expect(placeAiActivityChip({
        region,
        camera: { worldView: { x: 32, y: 16 }, zoom: 1.5 },
        viewport,
        chip,
      })).toEqual({ left: 224, top: 136, mode: "above", anchored: true });
    });

    it("카메라 스크롤과 줌이 바뀌면 정확히 함께 이동한다", () => {
      expect(placeAiActivityChip({
        region,
        camera: { worldView: { x: 56, y: 20 }, zoom: 1.25 },
        viewport,
        chip,
      })).toEqual({ left: 150, top: 103, mode: "above", anchored: true });
    });

    it("영역 위 공간이 없으면 영역 아래에 배치한다", () => {
      expect(placeAiActivityChip({
        region: { x: 4, y: 0, width: 4, height: 2 },
        camera: { worldView: { x: 0, y: 0 }, zoom: 1 },
        viewport,
        chip,
      })).toEqual({ left: 56, top: 40, mode: "below", anchored: true });
    });

    it("영역 위와 아래가 모두 넘치면 영역 안쪽에 배치한다", () => {
      expect(placeAiActivityChip({
        region: { x: 4, y: 0, width: 4, height: 8 },
        camera: { worldView: { x: 0, y: 0 }, zoom: 1 },
        viewport: { width: 400, height: 128 },
        chip,
      })).toEqual({ left: 56, top: 8, mode: "inside", anchored: true });
    });

    it("오른쪽 가장자리에서 칩 전체가 뷰포트 안에 있도록 제한한다", () => {
      const placement = placeAiActivityChip({
        region: { x: 23, y: 8, width: 2, height: 2 },
        camera: { worldView: { x: 0, y: 0 }, zoom: 1 },
        viewport,
        chip,
      });

      expect(placement).toEqual({ left: 320, top: 96, mode: "above", anchored: true });
      expect(placement.left + chip.width).toBeLessThanOrEqual(viewport.width);
    });

    it("영역이 없으면 캔버스 모서리 기본 위치를 반환한다", () => {
      expect(placeAiActivityChip({
        region: null,
        camera: { worldView: { x: 0, y: 0 }, zoom: 1 },
        viewport,
        chip,
      })).toEqual({
        left: CHIP_CORNER_INSET,
        top: CHIP_CORNER_INSET,
        mode: "corner",
        anchored: false,
      });
    });

    it("줌이 0인 초기 카메라는 줌 1로 계산한다", () => {
      const placement = placeAiActivityChip({
        region: { x: 2, y: 4, width: 2, height: 2 },
        camera: { worldView: { x: 0, y: 0 }, zoom: 0 },
        viewport,
        chip,
      });

      expect(placement).toEqual({ left: 8, top: 32, mode: "above", anchored: true });
      expect(Number.isNaN(placement.left)).toBe(false);
      expect(Number.isNaN(placement.top)).toBe(false);
    });

    it("줌 2에서 worldView 좌상단을 기준으로 실제 영역 위에 배치한다", () => {
      const placement = placeAiActivityChip({
        region: { x: 30, y: 15, width: 6, height: 4 },
        camera: { worldView: { x: 283.25, y: 100 }, zoom: 2 },
        viewport: { width: 1133, height: 700 },
        chip,
      });

      expect(placement).toEqual({ left: 450, top: 248, mode: "above", anchored: true });
      // scrollX=0을 좌상단으로 오해한 옛 식의 1016px보다 566px 왼쪽, 실제 타일 영역 중앙이다.
      expect(placement.left).toBeLessThan(600);
    });

    it("칩이 뷰포트보다 크면 해당 축을 0으로 제한한다", () => {
      expect(placeAiActivityChip({
        region: { x: 2, y: 0, width: 2, height: 2 },
        camera: { worldView: { x: 0, y: 0 }, zoom: 1 },
        viewport: { width: 40, height: 20 },
        chip: { width: 80, height: 24 },
      })).toEqual({ left: 0, top: 0, mode: "inside", anchored: true });
    });
  });
});

describe("aiActivityLog", () => {
  isolateTimers();
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
});

describe("aiActivityLogEndpoint", () => {
  isolateTimers();
  // 실측(2026-08-23): 리네임 때 미들웨어와 클라이언트가 서로 다른 접두사를 매칭하고 있었다.
  // 404 는 fetch 가 throw 하지 않으므로 타입도 런타임도 이 드리프트를 못 잡는다 — 테스트가 유일한 방어선이다.
  describe("ai activity disk mirror endpoint", () => {
    const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
    // 2026-09-16 (I3): 미러 본체가 플러그인에서 공용 모듈로 나왔다 — 계약은 본체를 본다.
    const core = readFileSync(new URL("../scripts/lib/activityMirror.mjs", import.meta.url), "utf8");
    const client = readFileSync(new URL("../src/ai/activityLog.ts", import.meta.url), "utf8");

    const e2eConsumers = [
      "desktop-editor-interactions.spec.ts",
      "title-play-controls.spec.ts",
    ].map((name) => readFileSync(new URL(`./e2e/${name}`, import.meta.url), "utf8"));
    it("공용 본체가 클라이언트와 같은 경로를 매칭한다", () => {
      expect(core).toContain(`export const AI_ACTIVITY_DISK_ENDPOINT = "${AI_ACTIVITY_DISK_ENDPOINT}"`);
      expect(core).toContain("pathname?.startsWith(AI_ACTIVITY_DISK_ENDPOINT)");
      // vite 도 같은 본체를 쓴다 — 예전에는 껍데기마다 자기 미들웨어를 들고 있었다.
      expect(viteConfig).toContain("createActivityMirrorMiddleware");
    });

    it("클라이언트는 경로 문자열을 다시 적지 않고 상수를 쓴다", () => {
      expect(client).toContain("fetch(AI_ACTIVITY_DISK_ENDPOINT");
      expect(client).not.toMatch(/fetch\(\s*"\/__/);
    });

    it("클라이언트·서버·E2E 목에 옛 브랜드 미러 경로가 남아 있지 않다", () => {
      expect(viteConfig).not.toContain("/__rpgzzu/ai-activity");
      expect(client).not.toContain("/__rpgzzu/ai-activity");
      expect(AI_ACTIVITY_DISK_ENDPOINT).toBe("/__oprn/ai-activity");
      for (const e2e of e2eConsumers) {
        expect(e2e).not.toContain("/__rpgzzu/ai-activity");
        expect(e2e).toContain(AI_ACTIVITY_DISK_ENDPOINT);
      }
    });

    it("미러 실패를 조용히 넘기지 않는다", () => {
      expect(client).toContain("res.ok");
      expect(client).toContain("warnMirrorFailure");
    });

    it("작은 로그만 keepalive로 보내고 60 KiB 초과 로그는 일반 요청으로 보낸다", () => {
      const small = buildAiActivityMirrorRequest(buildAiActivityLogRecord({
        channel: "chat",
        instruction: "맵을 확인해줘",
        result: { ok: true },
      }));
      expect(small.keepalive).toBe(true);

      const large = buildAiActivityMirrorRequest(buildAiActivityLogRecord({
        channel: "chat",
        instruction: "적대적 통합 QA",
        result: { ok: false, error: "도구 실패" },
        audit: Array.from({ length: 8 }, (_, index) => ({
          kind: "status" as const,
          text: `${index}:${"가".repeat(4_000)}`,
        })),
      }));
      expect(new TextEncoder().encode(large.body).byteLength).toBeGreaterThan(60 * 1024);
      expect(large.keepalive).toBe(false);
    });
  });
});

describe("aiActivityTrace", () => {
  isolateTimers();
  describe("display-independent AI execution receipts", () => {
    it("pairs overlapping tools by agent and call id and retains long inputs and structured results", () => {
      let trace = createActivityTrace("집 배치", "project-a", 1000);
      const args = { note: "x".repeat(500), mapId: "map-a" };
      for (const actor of ["builder-a", "builder-b"]) trace = recordActivityEvent(trace, { type: "agent_event", agentId: actor, event: { type: "tool_start", id: "call-1", name: "get_map_region", args, at: 1000 } });
      trace = recordActivityEvent(trace, { type: "agent_event", agentId: "builder-b", event: { type: "tool_end", id: "call-1", name: "get_map_region", ok: true, summary: "확인", result: { count: 16 }, at: 1250 } });
      expect(trace.entries[0]?.status).toBe("running");
      expect(trace.entries[1]).toMatchObject({ actor: "builder-b", status: "ok", input: { args }, output: { count: 16 }, durationMs: 250 });
    });
    it("retains receipts past the legacy 200-row UI cap and reports bounded loss", () => {
      let trace = createActivityTrace("긴 작업", "project-a", 0);
      for (let i = 0; i < ACTIVITY_ENTRY_LIMIT + 5; i++) trace = recordActivityEvent(trace, { type: "turn", index: i, at: i });
      expect(trace.entries).toHaveLength(ACTIVITY_ENTRY_LIMIT);
      expect(trace.dropped).toBe(5);
      expect(trace.entries[0]?.output).toEqual({ index: 5 });
    });
    it("never persists private thinking, credentials, or entire project snapshots", () => {
      let trace = createActivityTrace("作業", "project-a", 0);
      trace = recordActivityEvent(trace, { type: "delta", kind: "thinking", text: "private text", at: 1 });
      expect(JSON.stringify(trace)).not.toContain("private text");
      const safe = activityPayload({ apiKey: "secret-key", nested: { refresh_token: "secret-token" }, message: "Bearer abcdefghijklmnop", project: { secret: "project-content" }, note: "a".repeat(25000) });
      expect(JSON.stringify(safe)).not.toMatch(/secret-key|secret-token|abcdefghijklmnop|project-content/);
      expect(JSON.stringify(safe)).toContain("생략");
    });
    it("does not equate tool success or draft completion with application or saving", () => {
      let trace = createActivityTrace("초안", "project-a", 0);
      trace = recordActivityEvent(trace, { type: "tool_start", id: "1", name: "paint_road", args: {}, at: 1 });
      trace = activityPhase(trace, "중단", 10);
      expect(trace.entries[0]).toMatchObject({ status: "info", endedAt: 10 });
      expect(trace.entries[0]?.summary).toContain("종료 응답 없음");
      expect(trace.entries.some(e => e.name === "save.accepted")).toBe(false);
    });
    it("coalesces connection receipts and explains legacy result limitations", () => {
      let trace = createActivityTrace("연결", "project-a", 0);
      for (let i = 0; i < 10; i++) trace = recordActivityEvent(trace, { type: "heartbeat", at: i });
      expect(trace.entries).toHaveLength(1);
      expect(trace.entries[0]?.output).toMatchObject({ count: 10 });
      trace = recordActivityEvent(trace, { type: "tool_end", id: "legacy", name: "find_events", ok: true, summary: "조회 완료" });
      expect(JSON.stringify(trace.entries.at(-1)?.output)).toContain("결과 요약만 제공");
    });
  });
});
