/**
 * 방 하네스가 기존 맵을 **무음으로 지우던** 회귀 가드(2026-08-29 modify 진단 근본원인 1).
 *
 * 실측 재현: 타일 300칸 + 이벤트 1개가 있는 20×15 맵에 같은 mapId 로
 * `start_interior_room_session` 을 걸면 `ok:true` / issues 0 / warnings 0 으로
 * 16×13 빈 방이 됐다. `create_map` · `build_castle` · `author_village` 는 모두
 * `map-exists` 가드가 있는데 이 경로만 없었다.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runRoomPipeline, startRoomSession } from "@/editor/roomHarness/engine";
import { ToolError } from "@/editor/tools/types";
import type { Project } from "@/project/types";

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

  it("같은 던전 mapId 로 두 번 시작하면 두 번째가 거부된다", () => {
    const args = { mapId: "map_dungeon_lava_1", theme: "lava" };
    startRoomSession(project, "dungeon-room-v1", args);
    expect(() => startRoomSession(project, "dungeon-room-v1", args)).toThrow(/map_dungeon_lava_1/);
  });

  it("던전 세션은 mapId 를 요구한다 — 테마 기본 id 가 앞선 던전을 덮었다", () => {
    expect(() => startRoomSession(project, "dungeon-room-v1", { theme: "lava" })).toThrow(/mapId/);
  });

  it("세션이 만든 맵에는 플랜이 남아 mapId 만으로 재수립할 수 있다", () => {
    startRoomSession(project, "villager-room-v1", { ...INTERIOR_ARGS, mapId: "map_new_room" });
    const stamped = project.maps.map_new_room!.roomHarnessPlan;
    expect(stamped?.kitId).toBe("villager-room-v1");
    expect((stamped?.plan as { mapId: string }).mapId).toBe("map_new_room");
  });
});
