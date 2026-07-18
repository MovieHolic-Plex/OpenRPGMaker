import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  advanceRoomBuild,
  evaluateRoom,
  listRoomDemos,
  loadRoomSession,
  runRoomPipeline,
  startRoomSession,
} from "@/editor/roomHarness/engine";
import { getRoomKit, listRoomKitIds, ROOM_HARNESS_KITS } from "@/editor/roomHarness/registry";

const INTERIOR_START = {
  mapId: "m_int",
  name: "테스트 실내",
  width: 16,
  height: 13,
  wings: [{ x: 2, y: 5, w: 12, h: 5 }],
  door: { x: 8, y: 9 },
  theme: "bedroom",
};
const DUNGEON_START = { mapId: "m_dun", name: "테스트 던전", width: 26, height: 18, theme: "lava" };

describe("room harness 공유 엔진", () => {
  it("레지스트리에 두 킷이 등록돼 있다", () => {
    expect(listRoomKitIds().sort()).toEqual(["dungeon-room-v1", "villager-room-v1"]);
    expect(getRoomKit("villager-room-v1")).toBeDefined();
    expect(getRoomKit("dungeon-room-v1")).toBeDefined();
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
    { kitId: "dungeon-room-v1", args: DUNGEON_START, mapId: "m_dun" },
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
    { kitId: "dungeon-room-v1", args: DUNGEON_START },
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
    { kitId: "dungeon-room-v1", demo: "stone" },
  ])("$kitId: runRoomPipeline(demo=$demo)이 맵을 만든다", ({ kitId, demo }) => {
    const project = createBlankProject();
    const res = runRoomPipeline(project, kitId, { demo });
    const data = res.data as { kitId: string; mapId: string; ok: boolean };
    expect(data.kitId).toBe(kitId);
    expect(project.maps[data.mapId]).toBeDefined();
  });

  it.each([
    { kitId: "villager-room-v1", args: INTERIOR_START },
    { kitId: "dungeon-room-v1", args: DUNGEON_START },
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

  it("listRoomDemos는 킷 데모를 나열한다", () => {
    const dun = listRoomDemos("dungeon-room-v1").data as { plans: unknown[] };
    expect(dun.plans.length).toBeGreaterThan(0);
  });
});
