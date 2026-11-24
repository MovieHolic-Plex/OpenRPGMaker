import { describe, expect, it, beforeEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { advanceRoomBuild, evaluateRoom, listRoomDemos, loadRoomSession, runRoomPipeline, startRoomSession } from "@/editor/roomHarness/engine";
import { getRoomKit, listRoomKitIds, ROOM_HARNESS_KITS } from "@/editor/roomHarness/registry";
import { ToolError } from "@/editor/tools/types";
import type { Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("roomHarnessEngine", () => {
  isolateTimers();
  const INTERIOR_START = {
    mapId: "m_int",
    name: "테스트 실내",
    width: 16,
    height: 13,
    wings: [{ x: 2, y: 5, w: 12, h: 5 }],
    door: { x: 8, y: 9 },
    theme: "bedroom",
  };
  describe("room harness 공유 엔진", () => {
    // 던전 방 킷 dungeon-room-v1 은 2026-10-07 저작권 정리(PR #2335)로 지워졌다(registry.ts 주석) — 그 경우들은 뺐다.
    it("레지스트리에 실내 킷이 등록돼 있다", () => {
      expect(listRoomKitIds().sort()).toEqual(["villager-room-v1"]);
      expect(getRoomKit("villager-room-v1")).toBeDefined();
      expect(getRoomKit("dungeon-room-v1")).toBeUndefined();
      expect(getRoomKit("nope")).toBeUndefined();
      // 모든 킷은 필수 인터페이스를 구현한다
      for (const kit of Object.values(ROOM_HARNESS_KITS)) {
        expect(kit.buildOrder[0]).toBe("plan");
        expect(typeof kit.runPipeline).toBe("function");
        expect(typeof kit.applyLayer).toBe("function");
      }
    });

    it("미지 킷은 에러를 던진다", () => {
      const project = createBlankProject();
      expect(() => startRoomSession(project, "nope", {})).toThrow();
      expect(() => runRoomPipeline(project, "nope", {})).toThrow();
      expect(() => listRoomDemos("nope")).toThrow();
    });

    it.each([
      { kitId: "villager-room-v1", args: INTERIOR_START, mapId: "m_int" },
    ])("$kitId: start → 세션·맵·맵트리 등록", ({ kitId, args, mapId }) => {
      const project = createBlankProject();
      const res = startRoomSession(project, kitId, args);
      const data = res.data as { sessionId: string; kitId: string; checklist: Record<string, string> };
      expect(data.kitId).toBe(kitId);
      expect(project.maps[mapId]).toBeDefined();
      // 맵트리에 올라간다(루트이거나 자식)
      const inTree = project.mapTree.mapId === mapId || project.mapTree.children.some((c) => c.mapId === mapId);
      expect(inTree).toBe(true);
      // 세션 저장됨, plan 레이어는 done
      const session = loadRoomSession(project, data.sessionId);
      expect(session).not.toBeNull();
      expect(session!.checklist.plan).toBe("done");
    });

    it.each([
      { kitId: "villager-room-v1", args: INTERIOR_START },
    ])("$kitId: advance 루프가 모든 레이어를 완료한다", ({ kitId, args }) => {
      const project = createBlankProject();
      const start = startRoomSession(project, kitId, args);
      const sessionId = (start.data as { sessionId: string }).sessionId;
      let guard = 0;
      let done = false;
      while (!done && guard < 20) {
        const step = advanceRoomBuild(project, sessionId);
        done = Boolean((step.data as { done?: boolean }).done);
        guard += 1;
      }
      expect(done).toBe(true);
      const session = loadRoomSession(project, sessionId)!;
      // plan 제외 모든 레이어가 done 또는 failed가 아님
      for (const layer of getRoomKit(kitId)!.buildOrder) {
        expect(session.checklist[layer], `${kitId}/${layer}`).not.toBe("open");
      }
    });

    it.each([
      { kitId: "villager-room-v1", demo: "bedroom" },
    ])("$kitId: runRoomPipeline(demo=$demo)이 맵을 만든다", ({ kitId, demo }) => {
      const project = createBlankProject();
      const res = runRoomPipeline(project, kitId, { demo });
      const data = res.data as { kitId: string; mapId: string; ok: boolean };
      expect(data.kitId).toBe(kitId);
      expect(project.maps[data.mapId]).toBeDefined();
    });

    it.each([
      { kitId: "villager-room-v1", args: INTERIOR_START },
    ])("$kitId: 완성 후 evaluateRoom이 리포트를 낸다", ({ kitId, args }) => {
      const project = createBlankProject();
      const start = startRoomSession(project, kitId, args);
      const sessionId = (start.data as { sessionId: string }).sessionId;
      let guard = 0;
      while (guard < 20) {
        const step = advanceRoomBuild(project, sessionId);
        if ((step.data as { done?: boolean }).done) break;
        guard += 1;
      }
      const evalRes = evaluateRoom(project, sessionId);
      const report = (evalRes.data as { report: { ok: boolean; score: number; issues: string[] } }).report;
      expect(typeof report.ok).toBe("boolean");
      expect(typeof report.score).toBe("number");
      expect(Array.isArray(report.issues)).toBe(true);
    });

    it("listRoomDemos는 지워진 던전 킷을 모른다고 한다", () => {
      expect(() => listRoomDemos("dungeon-room-v1")).toThrow();
    });
  });
});

/**
 * 방 하네스가 기존 맵을 **무음으로 지우던** 회귀 가드(2026-08-29 modify 진단 근본원인 1).
 *
 * 실측 재현: 타일 300칸 + 이벤트 1개가 있는 20×15 맵에 같은 mapId 로
 * `start_interior_room_session` 을 걸면 `ok:true` / issues 0 / warnings 0 으로
 * 16×13 빈 방이 됐다. `create_map` · `build_castle` · `author_village` 는 모두
 * `map-exists` 가드가 있는데 이 경로만 없었다.
 */
describe("roomHarnessOverwriteGuard", () => {
  isolateTimers();
  const EXISTING_MAP_ID = "map_blank_start";
  const INTERIOR_ARGS = {
    mapId: EXISTING_MAP_ID,
    name: "덮어쓰기 시도",
    width: 16,
    height: 13,
    wings: [{ x: 2, y: 5, w: 12, h: 5 }],
    door: { x: 8, y: 9 },
    theme: "bedroom",
  };
  /** 기존 맵을 "저작된 상태"로 만든다 — 타일 300칸 + 이벤트 1개. */
  function authorExistingMap(project: Project): { paintedTiles: number; events: number } {
    const map = project.maps[EXISTING_MAP_ID]!;
    for (let index = 0; index < 300; index += 1) map.lowerTiles[index] = 12;
    map.events.push({
      id: "ev_keepme",
      x: 3,
      y: 3,
      pages: [{ name: "지켜야 하는 이벤트", trigger: "action", commands: [] }],
    } as unknown as Project["maps"][string]["events"][number]);
    return { paintedTiles: 300, events: 1 };
  }
  describe("방 하네스 기존 맵 덮어쓰기 가드", () => {
    let project: Project;

    beforeEach(() => {
      project = createBlankProject();
      authorExistingMap(project);
    });

    it("start_interior_room_session 이 기존 맵 id 를 받으면 map-exists 로 거부한다", () => {
      expect(() => startRoomSession(project, "villager-room-v1", INTERIOR_ARGS)).toThrow(ToolError);
      try {
        startRoomSession(project, "villager-room-v1", INTERIOR_ARGS);
      } catch (error) {
        expect((error as ToolError).code).toBe("map-exists");
        // 대안을 제시해야 한다 — 거부만 하면 모델이 다른 mapId 로 새 맵을 만들어 우회한다.
        expect((error as ToolError).message).toContain("furnish_interior_space");
      }
      // 맵이 그대로 남아 있다.
      expect(project.maps[EXISTING_MAP_ID]!.width).toBe(20);
      expect(project.maps[EXISTING_MAP_ID]!.events).toHaveLength(1);
    });

    it("run_interior_room_pipeline 도 같은 가드에 걸린다", () => {
      expect(() => runRoomPipeline(project, "villager-room-v1", INTERIOR_ARGS)).toThrow(ToolError);
      expect(project.maps[EXISTING_MAP_ID]!.events).toHaveLength(1);
    });

    it("replaceExisting:true 면 통과하고 폐기 수치를 경고에 남긴다", () => {
      const res = startRoomSession(project, "villager-room-v1", { ...INTERIOR_ARGS, replaceExisting: true });
      expect(project.maps[EXISTING_MAP_ID]!.width).toBe(16);
      const warning = (res.warnings ?? []).find((line) => line.includes("폐기"));
      expect(warning).toBeDefined();
      expect(warning).toContain("20×15");
      expect(warning).toContain("타일 300칸");
      expect(warning).toContain("이벤트 1개");
    });

    it("새 mapId 는 가드 없이 통과한다", () => {
      const res = startRoomSession(project, "villager-room-v1", { ...INTERIOR_ARGS, mapId: "map_new_room" });
      expect(project.maps.map_new_room).toBeDefined();
      expect(project.maps[EXISTING_MAP_ID]!.events).toHaveLength(1);
      expect((res.warnings ?? []).some((line) => line.includes("폐기"))).toBe(false);
    });

    // 던전 방 킷(dungeon-room-v1) 두 경우는 킷이 2026-10-07 저작권 정리(PR #2335)로 지워져 뺐다.

    it("세션이 만든 맵에는 플랜이 남아 mapId 만으로 재수립할 수 있다", () => {
      startRoomSession(project, "villager-room-v1", { ...INTERIOR_ARGS, mapId: "map_new_room" });
      const stamped = project.maps.map_new_room!.roomHarnessPlan;
      expect(stamped?.kitId).toBe("villager-room-v1");
      expect((stamped?.plan as { mapId: string }).mapId).toBe("map_new_room");
    });
  });
});
