import { describe, expect, it } from "vitest";

import { getTool } from "@/editor/tools";
import { ToolError } from "@/editor/tools/types";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent, GameMap, Project } from "@/project/types";

// AI 배치 툴이 캐릭터형 이벤트(몬스터·추격자·NPC)를 통행 불가 타일에 올리는 버그 계약.
// RM2K3 의미: action 트리거 이벤트는 벽 위에 있어도 되지만(문·간판), 인접 칸 중 하나는 통행 가능해야 한다.
function fixture(): { project: Project; map: GameMap; mapId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  return { project, map, mapId };
}

function setWall(map: GameMap, x: number, y: number): void {
  map.lowerTiles[y * map.width + x] = TILE.WALL;
  map.upperTiles[y * map.width + x] = TILE.EMPTY;
}

/** (cx,cy) 중심 체비셰프 반경 radius 전체를 벽으로 만든다. */
function wallBlock(map: GameMap, cx: number, cy: number, radius: number): void {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      setWall(map, x, y);
    }
  }
}

function eventById(map: GameMap, id: string): GameEvent {
  const found = map.events.find((entry) => entry.id === id);
  if (!found) throw new Error(`event not found: ${id}`);
  return found;
}

function troopId(project: Project): string {
  const id = project.database.troops[0]?.id;
  if (!id) throw new Error("fixture troop missing");
  return id;
}

describe("place_battle_blocker 통행 가능 착지", () => {
  it("벽 위에 몬스터를 요청하면 근처 통행 가능 칸으로 자동 착지한다", () => {
    const { project, map, mapId } = fixture();
    setWall(map, 5, 5);
    expect(isPassable(project, map, 5, 5)).toBe(false);

    const result = getTool("place_battle_blocker")!.run(project, { mapId, x: 5, y: 5, troopId: troopId(project) });

    const data = result.data as { eventId: string; x: number; y: number; adjusted: boolean };
    const event = eventById(map, data.eventId);
    expect(isPassable(project, map, event.x, event.y)).toBe(true);
    expect(data.adjusted).toBe(true);
    expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
  });

  it("반경 3칸이 전부 벽이면 battle-blocker-impassable ToolError", () => {
    const { project, map, mapId } = fixture();
    wallBlock(map, 8, 7, 3);

    let error: unknown;
    try {
      getTool("place_battle_blocker")!.run(project, { mapId, x: 8, y: 7, troopId: troopId(project) });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ToolError);
    expect((error as ToolError).code).toBe("battle-blocker-impassable");
    expect((error as ToolError).message).toContain("(8, 7)");
    expect((error as ToolError).message).toContain("get_map_region");
    expect(map.events).toHaveLength(0);
  });

  it("추격자도 통행 가능 칸으로 착지한다", () => {
    const { project, map, mapId } = fixture();
    setWall(map, 6, 6);

    const result = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 6, y: 6 } } });

    const data = result.data as { eventId: string; adjusted: boolean };
    const event = eventById(map, data.eventId);
    expect(isPassable(project, map, event.x, event.y)).toBe(true);
    expect(data.adjusted).toBe(true);
  });
});

describe("상호작용 이벤트는 문 의미를 지킨다", () => {
  it("통행 가능 이웃이 있는 벽 위 보물상자는 옮기지 않는다", () => {
    const { project, map, mapId } = fixture();
    setWall(map, 4, 4);

    const itemId = project.database.items[0]?.id ?? "item_potion";
    const result = getTool("place_chest")!.run(project, { mapId, x: 4, y: 4, contents: { itemId } });

    const data = result.data as { eventId: string; x: number; y: number; adjusted: boolean };
    expect([data.x, data.y]).toEqual([4, 4]);
    expect(data.adjusted).toBe(false);
    const event = eventById(map, data.eventId);
    expect([event.x, event.y]).toEqual([4, 4]);
  });

  it("사방이 벽으로 막힌 보물상자는 자동 조정되거나 ToolError", () => {
    const { project, map, mapId } = fixture();
    wallBlock(map, 8, 7, 1);

    const itemId = project.database.items[0]?.id ?? "item_potion";
    let error: ToolError | undefined;
    let data: { eventId: string; x: number; y: number; adjusted: boolean } | undefined;
    try {
      const result = getTool("place_chest")!.run(project, { mapId, x: 8, y: 7, contents: { itemId } });
      data = result.data as typeof data;
    } catch (caught) {
      if (!(caught instanceof ToolError)) throw caught;
      error = caught;
    }
    if (error) {
      expect(error.code).toBe("chest-impassable");
      expect(error.message).toContain("get_map_region");
    } else {
      expect(data?.adjusted).toBe(true);
      const event = eventById(map, data!.eventId);
      expect(isPassable(project, map, event.x, event.y)).toBe(true);
    }
  });

  it("touch 트랩은 밟을 수 있어야 하므로 벽에서 통행 가능 칸으로 옮긴다", () => {
    const { project, map, mapId } = fixture();
    setWall(map, 7, 3);

    const result = getTool("place_trap")!.run(project, { mapId, cells: [{ x: 7, y: 3 }], trigger: "touch" });

    const data = result.data as { eventIds: string[]; adjusted: boolean };
    const event = eventById(map, data.eventIds[0]);
    expect(isPassable(project, map, event.x, event.y)).toBe(true);
    expect(data.adjusted).toBe(true);
    expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
  });
});

describe("이동·복제·upsert 배치", () => {
  it("move_event로 벽으로 옮기면 통행 가능 칸으로 자동 조정한다", () => {
    const { project, map, mapId } = fixture();
    map.events.push({
      id: "ev_walker",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "ev_walker_page",
          name: "주민",
          conditions: [],
          graphic: { transparent: true },
          trigger: { kind: "playerTouch" },
          priority: "below",
          overlapForbidden: false,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        },
      ],
    });
    setWall(map, 9, 9);

    const result = getTool("move_event")!.run(project, { mapId, eventId: "ev_walker", x: 9, y: 9 });

    const data = result.data as { x: number; y: number; adjusted: boolean };
    expect(data.adjusted).toBe(true);
    const event = eventById(map, "ev_walker");
    expect(isPassable(project, map, event.x, event.y)).toBe(true);
    expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
  });

  it("upsert_event로 새 이벤트를 벽에 만들면 자동 조정한다", () => {
    const { project, map, mapId } = fixture();
    setWall(map, 2, 6);

    const result = getTool("upsert_event")!.run(project, {
      mapId,
      event: {
        id: "ev_new_guard",
        x: 2,
        y: 6,
        trigger: { kind: "playerTouch" },
        commands: [],
        pages: [
          {
            id: "ev_new_guard_page",
            name: "경비",
            conditions: [],
            graphic: { transparent: true },
            trigger: { kind: "playerTouch" },
            priority: "below",
            overlapForbidden: false,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
          },
        ],
      },
    });

    const data = result.data as { eventId: string; x: number; y: number; adjusted: boolean };
    expect(data.adjusted).toBe(true);
    const event = eventById(map, "ev_new_guard");
    expect(isPassable(project, map, event.x, event.y)).toBe(true);
  });

  it("upsert_event 부분 병합은 기존 이벤트 좌표를 절대 바꾸지 않는다", () => {
    const { project, map, mapId } = fixture();
    setWall(map, 3, 8);
    map.events.push({
      id: "ev_door",
      x: 3,
      y: 8,
      trigger: { kind: "action" },
      commands: [],
      pages: [],
    });

    getTool("upsert_event")!.run(project, { mapId, event: { id: "ev_door", pages: [] } });

    const event = eventById(map, "ev_door");
    expect([event.x, event.y]).toEqual([3, 8]);
  });
});

describe("place_examine_hotspots 도달 가능성", () => {
  it("사방이 벽으로 갇힌 조사 핫스팟은 통행 가능 칸으로 착지하거나 skip 된다", () => {
    const { project, map, mapId } = fixture();
    wallBlock(map, 9, 9, 1);
globalThis.result = getTool("place_examine_hotspots")!.run(project, {
      mapId,
      hotspots: [{ at: { x: 9, y: 9 }, name: "갇힌 액자", lines: ["먼지가 쌓여 있다."] }],
    });
globalThis.placed = map.events.filter((event) => event.id.startsWith("ev_examine"));
    for (const event of placed) {
globalThis.reachable = [
        { x: event.x, y: event.y },
        { x: event.x, y: event.y + 1 },
        { x: event.x, y: event.y - 1 },
        { x: event.x + 1, y: event.y },
        { x: event.x - 1, y: event.y },
      ].some((cell) => isPassable(project, map, cell.x, cell.y));
      expect(reachable).toBe(true);
    }
    expect(result.warnings?.some((warning) => warning.includes("(9, 9)"))).toBe(true);
  });

  it("통행 가능 이웃이 있는 벽 위 조사 핫스팟은 그대로 둔다", () => {
    const { project, map, mapId } = fixture();
    setWall(map, 12, 12);

    getTool("place_examine_hotspots")!.run(project, {
      mapId,
      hotspots: [{ at: { x: 12, y: 12 }, name: "벽에 걸린 액자", lines: ["오래된 그림이다."] }],
    });
globalThis.placed = map.events.filter((event) => event.id.startsWith("ev_examine"));
    expect(placed).toHaveLength(1);
    expect(placed[0].x).toBe(12);
    expect(placed[0].y).toBe(12);
  });
});

