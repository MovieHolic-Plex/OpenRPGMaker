import { describe, expect, it } from "vitest";

import { getTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent, GameMap, Project } from "@/project/types";

const SOURCE_MAP_ID = "map_blank_start";
const TARGET_MAP_ID = "map_copy_target";

function fixture(): { project: Project; source: GameMap; target: GameMap } {
  const project = createBlankProject();
  getTool("create_map")!.run(project, { id: TARGET_MAP_ID, name: "복사 대상", width: 20, height: 15 });
  return {
    project,
    source: project.maps[SOURCE_MAP_ID],
    target: project.maps[TARGET_MAP_ID],
  };
}

function characterEvent(id: string, x: number, y: number): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "playerTouch" },
    commands: [],
  };
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  map.lowerTiles[y * map.width + x] = tile;
  map.upperTiles[y * map.width + x] = TILE.EMPTY;
}

describe("copy_map_region 이벤트 통행 가능 착지", () => {
  it("목적 좌표가 물인 캐릭터형 이벤트는 통행 가능 칸에 착지한다", () => {
    const { project, source, target } = fixture();
    source.events.push(characterEvent("ev_source_guard", 3, 3));
    setLower(target, 9, 9, TILE.WATER);
    expect(isPassable(project, target, 9, 9)).toBe(false);

    const result = getTool("copy_map_region")!.run(project, {
      from: { mapId: SOURCE_MAP_ID, x: 2, y: 2, w: 3, h: 3 },
      to: { mapId: TARGET_MAP_ID, x: 8, y: 8 },
      layers: "upper",
      withEvents: true,
    });

    const copiedIds = (result.data as { events: string[] }).events;
    expect(copiedIds).toHaveLength(1);
    const clone = target.events.find((event) => event.id === copiedIds[0]);
    expect(clone).toBeDefined();
    expect(isPassable(project, target, clone!.x, clone!.y)).toBe(true);
  });

  it("실제 place_npc 이벤트를 물 위로 복사하면 통행 가능 칸에 착지시킨다", () => {
    const { project, target } = fixture();
    getTool("place_npc")!.run(project, {
      mapId: SOURCE_MAP_ID,
      x: 3,
      y: 3,
      id: "ev_source_npc",
      name: "강가 주민",
      graphic: { query: "people1" },
      pages: [{ text: "안녕하세요." }],
    });
    setLower(target, 9, 9, TILE.WATER);

    const result = getTool("copy_map_region")!.run(project, {
      from: { mapId: SOURCE_MAP_ID, x: 2, y: 2, w: 3, h: 3 },
      to: { mapId: TARGET_MAP_ID, x: 8, y: 8 },
      layers: "upper",
      withEvents: true,
    });

    const copiedIds = (result.data as { events: string[] }).events;
    const clone = target.events.find((event) => event.id === copiedIds[0]);
    expect(clone).toBeDefined();
    expect(isPassable(project, target, clone!.x, clone!.y)).toBe(true);
    expect([clone!.x, clone!.y]).not.toEqual([9, 9]);
    expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
  });

  it("통행 가능한 평지에서는 모든 이벤트의 상대 좌표를 그대로 보존한다", () => {
    const { project, source, target } = fixture();
    source.events.push(characterEvent("ev_source_left", 3, 4), characterEvent("ev_source_right", 6, 6));

    const result = getTool("copy_map_region")!.run(project, {
      from: { mapId: SOURCE_MAP_ID, x: 2, y: 3, w: 6, h: 5 },
      to: { mapId: TARGET_MAP_ID, x: 10, y: 7 },
      withEvents: true,
    });

    const copiedIds = (result.data as { events: string[] }).events;
    expect(copiedIds).toHaveLength(2);
    expect(target.events.filter((event) => copiedIds.includes(event.id)).map((event) => [event.x, event.y])).toEqual([
      [11, 8],
      [14, 10],
    ]);
    for (const event of target.events.filter((entry) => copiedIds.includes(entry.id))) {
      expect(isPassable(project, target, event.x, event.y)).toBe(true);
    }
  });
});

describe("지형 편집으로 고립된 이벤트 경고", () => {
  it("기존 NPC 칸을 물로 칠하면 이벤트 id와 좌표를 경고한다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.events.push(characterEvent("ev_stranded_guard", 4, 5));

    const result = getTool("paint_tiles")!.run(project, {
      mapId: map.id,
      layer: "lower",
      mode: "cells",
      tile: TILE.WATER,
      cells: [{ x: 4, y: 5 }],
    });

    expect(isPassable(project, map, 4, 5)).toBe(false);
    const warning = result.warnings?.find((entry) => entry.includes("통행 불가"));
    expect(warning).toContain("ev_stranded_guard");
    expect(warning).toContain("(4,5)");
  });

  it("이벤트가 없는 칸은 기존 통행 불가 칸 수 경고 문구를 유지한다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];

    const result = getTool("paint_tiles")!.run(project, {
      mapId: map.id,
      layer: "lower",
      mode: "cells",
      tile: TILE.WATER,
      cells: [{ x: 7, y: 6 }],
    });

    expect(isPassable(project, map, 7, 6)).toBe(false);
    expect(result.warnings).toContain(`경고: 1개 칸이 통행 불가가 되었습니다(${map.id}).`);
  });
});
