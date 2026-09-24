import { describe, expect, it } from "vitest";

import { getTool } from "@/editor/tools";
import { ToolError } from "@/editor/tools/types";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent, GameMap, Project } from "@/project/types";

function fixture(): { project: Project; map: GameMap; mapId: string; speciesId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  const speciesId = project.database.monsterSpecies[0]?.id;
  if (!speciesId) throw new Error("fixture monster species missing");
  return { project, map, mapId, speciesId };
}

function setWater(map: GameMap, x: number, y: number): void {
  map.lowerTiles[y * map.width + x] = TILE.WATER;
  map.upperTiles[y * map.width + x] = TILE.EMPTY;
}

function waterBlock(map: GameMap, cx: number, cy: number, radius: number): void {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      setWater(map, x, y);
    }
  }
}

function blockInteractionCell(map: GameMap, x: number, y: number): void {
  setWater(map, x, y);
  setWater(map, x, y + 1);
  setWater(map, x, y - 1);
  setWater(map, x + 1, y);
  setWater(map, x - 1, y);
}

function eventById(map: GameMap, id: string): GameEvent {
  const event = map.events.find((entry) => entry.id === id);
  if (!event) throw new Error(`event not found: ${id}`);
  return event;
}

describe("give_starter_monsters 통행 가능 배치", () => {
  it("시작 위치 옆 기본 칸이 물로 막히면 통행 가능 칸으로 자동 조정하고 경고한다", () => {
    const { project, map, speciesId } = fixture();
    project.startPos = { x: 8, y: 8 };
    project.system.monsterCollection = false;
    blockInteractionCell(map, 9, 8);
    expect(isPassable(project, map, 9, 8)).toBe(false);

    const result = getTool("give_starter_monsters")!.run(project, { speciesIds: [speciesId] });

    const event = eventById(map, "ev_starter_monsters");
    expect(isPassable(project, map, event.x, event.y)).toBe(true);
    expect([event.x, event.y]).not.toEqual([9, 8]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining(`(9, 8) → (${event.x}, ${event.y})`),
      expect.stringContaining("system.monsterCollection"),
    ]));
  });

  it("명시한 물 좌표도 같은 방식으로 통행 가능 칸에 자동 착지한다", () => {
    const { project, map, mapId, speciesId } = fixture();
    blockInteractionCell(map, 12, 10);
    expect(isPassable(project, map, 12, 10)).toBe(false);

    const result = getTool("give_starter_monsters")!.run(project, {
      speciesIds: [speciesId],
      actorEvent: { mapId, eventId: "ev_requested_starter", x: 12, y: 10 },
    });

    const event = eventById(map, "ev_requested_starter");
    expect(isPassable(project, map, event.x, event.y)).toBe(true);
    expect([event.x, event.y]).not.toEqual([12, 10]);
    expect(result.warnings?.some((warning) => warning.includes(`(12, 10) → (${event.x}, ${event.y})`))).toBe(true);
  });

  it("기본 칸이 통행 가능한 땅이면 좌표를 옮기지 않는다", () => {
    const { project, map, speciesId } = fixture();
    project.startPos = { x: 8, y: 8 };
    expect(isPassable(project, map, 9, 8)).toBe(true);

    const result = getTool("give_starter_monsters")!.run(project, { speciesIds: [speciesId] });

    const event = eventById(map, "ev_starter_monsters");
    expect([event.x, event.y]).toEqual([9, 8]);
    expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).not.toBe(true);
  });

  it("요청 좌표 반경 3칸이 전부 물이면 starter-monsters-impassable ToolError", () => {
    const { project, map, mapId, speciesId } = fixture();
    waterBlock(map, 12, 10, 3);
    expect(isPassable(project, map, 12, 10)).toBe(false);

    let error: unknown;
    try {
      getTool("give_starter_monsters")!.run(project, {
        speciesIds: [speciesId],
        actorEvent: { mapId, x: 12, y: 10 },
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ToolError);
    expect((error as ToolError).code).toBe("starter-monsters-impassable");
    expect((error as ToolError).message).toContain("(12, 10)");
    expect(map.events).toHaveLength(0);
  });

  // 2026-09-24 몬스터 수집 r2: place_npc 가 먼저 (4,5) 를 쓴 뒤 모델이 같은 칸에 ev_starters 를
  // 요청했다. 점유 검사가 없어 두 이벤트가 한 칸에 겹쳤고, 조사는 NPC 에 가려 ev_starters 를
  // 못 건드렸다(autoplay-failed: 첫 파트너 받기).
  it("요청 칸에 이미 다른 이벤트가 있으면 점유를 피해 자동 조정한다", () => {
    const { project, map, mapId, speciesId } = fixture();
    const npc = getTool("place_npc")!.run(project, { mapId, x: 4, y: 5, name: "바람 박사", pages: [{ lines: ["어서 오렴."] }] });
    const npcAt = npc.data as { x: number; y: number };
    expect(isPassable(project, map, npcAt.x, npcAt.y)).toBe(true);

    const result = getTool("give_starter_monsters")!.run(project, {
      speciesIds: [speciesId],
      actorEvent: { mapId, eventId: "ev_starters", x: npcAt.x, y: npcAt.y },
    });

    const starter = eventById(map, "ev_starters");
    expect([starter.x, starter.y]).not.toEqual([npcAt.x, npcAt.y]);
    expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
  });

  // r2 후속: 점유 회피 조정이 NPC 뒤 밀폐 주머니에 놓이면 플레이어가 도달할 수 없다.
  // 같은 반경 후보가 갈라지면 큰 통행 컴포넌트(방) 쪽을 골라야 한다.
  it("요청 칸 반경 안의 작은 주머니 대신 방 쪽 칸으로 조정한다", () => {
    const { project, map, mapId, speciesId } = fixture();
    // (6,6) 은 벽 세 겹 + 입구 NPC 로 봉인된 주머니. 방은 아래쪽이 트여 있다.
    for (const [wx, wy] of [[4, 5], [5, 5], [6, 5], [4, 6], [6, 7], [7, 6]] as const) {
      map.lowerTiles[wy * map.width + wx] = TILE.WALL;
      map.upperTiles[wy * map.width + wx] = TILE.EMPTY;
    }
    getTool("place_npc")!.run(project, { mapId, x: 5, y: 6, name: "마을 주민", pages: [{ lines: ["안녕."] }] });
    const npc = map.events.find((entry) => entry.name === "마을 주민");
    expect([npc?.x, npc?.y]).toEqual([5, 6]);

    const result = getTool("give_starter_monsters")!.run(project, {
      speciesIds: [speciesId],
      actorEvent: { mapId, eventId: "ev_starters", x: 5, y: 6 },
    });

    const starter = eventById(map, "ev_starters");
    expect([starter.x, starter.y]).not.toEqual([6, 6]);
    expect([starter.x, starter.y]).toEqual([4, 7]);
    expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
  });
});
