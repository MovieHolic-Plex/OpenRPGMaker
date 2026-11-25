import { describe, expect, it } from "vitest";
import { mapCellApply } from "@/editor/incrementalMapApply";
import { changedProjectKeys, encodePiAgentEvent, createPiAgentLineDecoder, type PiAgentEvent } from "@/ai/piAgent/protocol";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { createPiAgentNdjsonStream } from "../scripts/lib/piAgentStream";
import { missingReportSummary } from "../scripts/lib/piTeamRuntime";
import { isolateTimers } from "./mergedTeardown";

describe("incrementalMapApply", () => {
  isolateTimers();
  function project(): Project {
    const map = createBlankMap("m1", 8, 6);
    map.id = "m1";
    return { maps: { m1: map }, tilesets: { ts: { id: "ts", image: "x" } }, database: { actors: [] } } as unknown as Project;
  }
  describe("mapCellApply", () => {
    it("returns only the painted cells when the rest of the project is the same object", () => {
      const before = project();
      const map = { ...before.maps.m1!, lowerTiles: before.maps.m1!.lowerTiles.slice() };
      map.lowerTiles[3] = 9;
      const after = { ...before, maps: { ...before.maps, m1: map } };
      const cells = mapCellApply(before, after, "m1");
      expect(cells?.mapId).toBe("m1");
      expect(cells?.cells.some((cell) => cell.x === 3 && cell.y === 0 && cell.layer === "lower")).toBe(true);
      expect(cells!.cells.filter((cell) => cell.layer === "lower")).toHaveLength(1);
    });

    it("keeps a full redraw when the tileset object changes", () => {
      const before = project();
      const after = { ...before, tilesets: { ...before.tilesets } };
      expect(mapCellApply(before, after, "m1")).toBeNull();
    });
  });
  describe("changedProjectKeys", () => {
    it("does not treat a shared tileset reference as a change", () => {
      const before = project();
      const map = { ...before.maps.m1!, lowerTiles: before.maps.m1!.lowerTiles.slice() };
      map.lowerTiles[0] = 4;
      const after = { ...before, maps: { ...before.maps, m1: map } };
      expect(changedProjectKeys(before, after)).toEqual(["maps.m1"]);
    });
  });
  describe("toolMapCellApply", () => {
    it("recognizes cloned inputs and covers overlays, shadows and stacks", async () => {
      const { toolMapCellApply } = await import("@/editor/incrementalMapApply");
      const { setLayerTileAt, setShadowAt } = await import("@/project/mapLayers");
      const before = project();
      const after = structuredClone(before);
      const map = after.maps.m1!;
      setLayerTileAt(map, 2, 9, 10);
      setLayerTileAt(map, 4, 10, 11);
      setShadowAt(map, 11, 3);
      map.upperTileStacks = { 12: [1, 2] };
      expect(toolMapCellApply(before, after)).toEqual({ mapId: "m1", cells: [
        { x: 1, y: 1, layer: "lower" }, { x: 2, y: 1, layer: "upper" },
        { x: 3, y: 1, layer: "lower" }, { x: 4, y: 1, layer: "upper" },
      ] });
      expect(before.maps.m1!.lowerOverlayTiles).toBeUndefined();
    });
    it("keeps full notifications for multiple maps, events, metadata and project data", async () => {
      const { toolMapCellApply } = await import("@/editor/incrementalMapApply");
      const before = project();
      before.maps.m2 = { ...before.maps.m1!, id: "m2" };
      for (const edit of [
        (p: Project) => { p.maps.m2!.lowerTiles[0] = 8; },
        (p: Project) => { p.maps.m1!.name = "renamed"; },
        (p: Project) => { p.maps.m1!.width += 1; },
        (p: Project) => { p.maps.m1!.events.push({ id: "new", x: 1, y: 1, trigger: { kind: "action" }, commands: [] }); },
        (p: Project) => { p.database.actors = [{ id: "new" }] as never; },
        (p: Project) => { delete p.maps.m2; },
      ]) {
        const after = structuredClone(before);
        after.maps.m1!.lowerTiles[0] = 7;
        edit(after);
        expect(toolMapCellApply(before, after)).toBeNull();
      }
    });
  });
});

// 오너 2026-11-09 monster «terminated» 조사: 이벤트 하나가 인코딩에서 던지면 예전 write() 가 stop() 으로 heartbeat 까지 영구 중지했다.
// 이 시험은 인코더가 한 번 던져도 heartbeat 가 계속 나가고 뒤 이벤트가 도착하며, 빠진 줄이 error 줄로 알려지는 것을 단언한다.
describe("piAgentStreamGuard", () => {
  isolateTimers();
  async function collect(stream: ReadableStream<Uint8Array>, until: (events: PiAgentEvent[]) => boolean): Promise<PiAgentEvent[]> {
    const events: PiAgentEvent[] = [];
    const decoder = createPiAgentLineDecoder((event) => events.push(event));
    const reader = stream.getReader();
    const text = new TextDecoder();
    while (!until(events)) {
      const { value, done } = await reader.read();
      if (done) break;
      decoder.push(text.decode(value, { stream: true }));
    }
    await reader.cancel();
    return events;
  }
  describe("worker NDJSON stream survives an event that cannot be encoded", () => {
    it("keeps the heartbeat running, reports the dropped event, and delivers later events", async () => {
      let encodes = 0;
      const encodeEvent = (event: PiAgentEvent): string => {
        encodes += 1;
        if ((event as { type?: string }).type === "execution_status" && (event as { name?: string }).name === "poison") throw new RangeError("Invalid string length");
        return encodePiAgentEvent(event);
      };
      let finish!: () => void;
      const finished = new Promise<void>((resolve) => { finish = resolve; });
      const stream = createPiAgentNdjsonStream(async (onEvent) => {
        onEvent({ type: "execution_status", name: "poison", ok: true, summary: "x" } as PiAgentEvent);
        await finished;
      }, { heartbeatMs: 15, encodeEvent });
      const reader = collect(stream, (events) => {
        const beats = events.filter((e) => e.type === "heartbeat").length;
        if (beats >= 3) finish();
        return beats >= 3 && events.some((e) => e.type === "error");
      });
      const events = await reader;
      expect(events.filter((e) => e.type === "heartbeat").length).toBeGreaterThanOrEqual(3);
      const error = events.find((e) => e.type === "error") as { message?: string } | undefined;
      expect(error?.message).toContain("could not be encoded");
      expect(error?.message).toContain("execution_status");
      expect(encodes).toBeGreaterThan(1);
    });

    it("a later event after the failed one still arrives", async () => {
      let calls = 0;
      const encodeEvent = (event: PiAgentEvent): string => {
        calls += 1;
        if (calls === 1) throw new Error("boom");
        return encodePiAgentEvent(event);
      };
      const stream = createPiAgentNdjsonStream(async (onEvent) => {
        onEvent({ type: "execution_status", name: "first", ok: true, summary: "dropped" } as PiAgentEvent);
        onEvent({ type: "execution_status", name: "second", ok: true, summary: "kept" } as PiAgentEvent);
      }, { heartbeatMs: 1000, encodeEvent });
      const events = await collect(stream, () => false);
      const names = events.filter((e) => e.type === "execution_status").map((e) => (e as { name?: string }).name);
      expect(names).toEqual(["second"]);
      expect(events.some((e) => e.type === "error")).toBe(true);
    });
  });
});

// report_task 없이 끝난 팀원 — 이미 반영된 변경을 팀장에게 밝힌다(2026-10-05: 재배정이 세계관을 덮어쓰고 맵을 한 벌 더 만들었다).
describe("piTeamMissingReport", () => {
  isolateTimers();
  describe("보고 없이 끝난 팀원 요약", () => {
    it("새 맵·고친 맵·바뀐 데이터와 팀원의 마지막 말을 전한다", () => {
      const before = createBlankProject();
      const after = structuredClone(before);
      const first = Object.keys(after.maps)[0]!;
      after.maps.map_town = { ...structuredClone(after.maps[first]!), id: "map_town", name: "마을" };
      after.maps[first]!.name = "시작 바뀜";
      (after as unknown as { worldCanon: unknown }).worldCanon = { title: "아르테리아" };
      const summary = missingReportSummary(before, after, changedProjectKeys(before, after), "동굴은 칩셋 변경 확인이 필요합니다.");
      expect(summary).toContain("새 맵 마을(map_town)");
      expect(summary).toContain(`고친 맵 시작 바뀜(${first})`);
      expect(summary).toContain("worldCanon");
      expect(summary).not.toContain("maps.");
      expect(summary).toContain("다시 맡기지 말고");
      expect(summary).toContain("칩셋 변경 확인");
    });

    it("반영된 변경이 없으면 그렇게 말한다", () => {
      const project = createBlankProject();
      expect(missingReportSummary(project, project, [], undefined)).toBe("report_task 없이 끝나 완료로 치지 않았다. 프로젝트에 반영된 변경은 없다.");
    });
  });
});
