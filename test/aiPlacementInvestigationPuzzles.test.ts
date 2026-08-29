import { describe, expect, it } from "vitest";

import { getTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_ITEM_ID, TILE } from "@/project/defaults/constants";
import type { GameEvent, GameMap, Project } from "@/project/types";

function fixture(): { project: Project; map: GameMap; mapId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  return { project, map, mapId };
}

function setSolid(map: GameMap, x: number, y: number, tile: number): void {
  map.lowerTiles[y * map.width + x] = tile;
  map.upperTiles[y * map.width + x] = TILE.EMPTY;
}

function solidBlock(map: GameMap, cx: number, cy: number, radius: number, tile: number = TILE.WALL): void {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      setSolid(map, x, y, tile);
    }
  }
}

function eventsByIds(map: GameMap, ids: readonly string[]): GameEvent[] {
  return ids.map((id) => {
    const event = map.events.find((entry) => entry.id === id);
    if (!event) throw new Error(`event not found: ${id}`);
    return event;
  });
}

type PuzzleData = {
  readonly created: number;
  readonly skipped: number;
  readonly eventIds: readonly string[];
  readonly plateSwitchIds?: readonly string[];
};

describe("조사 퍼즐 이벤트 통행 가능 배치", () => {
  it("push-switches는 물 발판을 착지시키고 막힌 발판만 건너뛰며 남은 배선을 맞춘다", () => {
    const { project, map, mapId } = fixture();
    setSolid(map, 4, 4, TILE.WATER);
    solidBlock(map, 10, 8, 3, TILE.WATER);
    expect(isPassable(project, map, 4, 4)).toBe(false);
    expect(isPassable(project, map, 10, 8)).toBe(false);

    const result = getTool("compile_puzzle")!.run(project, {
      mapId,
      puzzleId: "water_plates",
      kind: "push-switches",
      plates: [
        { at: { x: 4, y: 4 } },
        { at: { x: 10, y: 8 } },
        { at: { x: 16, y: 4 } },
      ],
      all: true,
      onSolve: { setSwitch: "sw_water_plates_solved" },
    });

    const data = result.data as PuzzleData;
    expect(data).toMatchObject({ created: 2, skipped: 1 });
    expect(data.eventIds).toHaveLength(2);
    expect(data.plateSwitchIds).toHaveLength(2);
    const events = eventsByIds(map, data.eventIds);
    expect(events.every((event) => isPassable(project, map, event.x, event.y))).toBe(true);
    expect(result.warnings?.some((warning) => warning.includes("(4, 4)") && warning.includes("위치 자동 조정"))).toBe(true);
    expect(result.warnings?.some((warning) => warning.includes("(10, 8)") && warning.includes("skip"))).toBe(true);

    const wiring = JSON.stringify(events.map((event) => event.pages?.[0]?.commands));
    for (const switchId of data.plateSwitchIds ?? []) expect(wiring).toContain(switchId);
    expect(wiring).not.toContain("sw_water_plates_plate_2");
  });

  it("switch-sequence는 접근 가능한 물 노드는 유지하고 사방이 막힌 노드는 자동 착지시킨다", () => {
    const { project, map, mapId } = fixture();
    setSolid(map, 3, 3, TILE.WATER);
    solidBlock(map, 10, 7, 1, TILE.WALL);
    expect(isPassable(project, map, 3, 3)).toBe(false);
    expect(isPassable(project, map, 10, 7)).toBe(false);

    const result = getTool("compile_puzzle")!.run(project, {
      mapId,
      puzzleId: "wall_sequence",
      kind: "switch-sequence",
      nodes: [
        { at: { x: 3, y: 3 }, name: "물 위 액자" },
        { at: { x: 10, y: 7 }, name: "갇힌 액자" },
      ],
      order: [0, 1],
      onSolve: { setSwitch: "sw_wall_sequence_solved" },
    });

    const data = result.data as PuzzleData;
    expect(data).toMatchObject({ created: 2, skipped: 0 });
    const [waterNode, landedNode] = eventsByIds(map, data.eventIds);
    expect([waterNode.x, waterNode.y]).toEqual([3, 3]);
    expect([landedNode.x, landedNode.y]).not.toEqual([10, 7]);
    expect(isPassable(project, map, landedNode.x, landedNode.y)).toBe(true);
    expect(result.warnings?.some((warning) => warning.includes("(10, 7)") && warning.includes("위치 자동 조정"))).toBe(true);
  });

  it("password와 item-gate도 action 상호작용 배치 규칙을 따른다", () => {
    const passwordFixture = fixture();
    setSolid(passwordFixture.map, 5, 5, TILE.WATER);
    expect(isPassable(passwordFixture.project, passwordFixture.map, 5, 5)).toBe(false);

    const passwordResult = getTool("compile_puzzle")!.run(passwordFixture.project, {
      mapId: passwordFixture.mapId,
      puzzleId: "water_password",
      kind: "password",
      at: { x: 5, y: 5 },
      answer: "1234",
      onSolve: {},
    });
    const passwordData = passwordResult.data as PuzzleData;
    const passwordEvent = eventsByIds(passwordFixture.map, passwordData.eventIds)[0];
    expect([passwordEvent.x, passwordEvent.y]).toEqual([5, 5]);

    const gateFixture = fixture();
    solidBlock(gateFixture.map, 11, 8, 1, TILE.WALL);
    expect(isPassable(gateFixture.project, gateFixture.map, 11, 8)).toBe(false);

    const gateResult = getTool("compile_puzzle")!.run(gateFixture.project, {
      mapId: gateFixture.mapId,
      puzzleId: "walled_gate",
      kind: "item-gate",
      at: { x: 11, y: 8 },
      requiredItemId: DEFAULT_ITEM_ID,
      onSolve: {},
    });
    const gateData = gateResult.data as PuzzleData;
    const gateEvent = eventsByIds(gateFixture.map, gateData.eventIds)[0];
    expect([gateEvent.x, gateEvent.y]).not.toEqual([11, 8]);
    expect(isPassable(gateFixture.project, gateFixture.map, gateEvent.x, gateEvent.y)).toBe(true);
    expect(gateResult.warnings?.some((warning) => warning.includes("(11, 8)") && warning.includes("위치 자동 조정"))).toBe(true);
  });

  it("열린 바닥에서는 네 퍼즐의 작성 좌표를 그대로 보존한다", () => {
    const { project, map, mapId } = fixture();

    const sequence = getTool("compile_puzzle")!.run(project, {
      mapId,
      puzzleId: "open_sequence",
      kind: "switch-sequence",
      nodes: [{ at: { x: 2, y: 2 } }, { at: { x: 3, y: 2 } }],
      order: [0, 1],
      onSolve: {},
    });
    const password = getTool("compile_puzzle")!.run(project, {
      mapId,
      puzzleId: "open_password",
      kind: "password",
      at: { x: 6, y: 2 },
      answer: "7",
      onSolve: {},
    });
    const gate = getTool("compile_puzzle")!.run(project, {
      mapId,
      puzzleId: "open_gate",
      kind: "item-gate",
      at: { x: 9, y: 2 },
      requiredItemId: DEFAULT_ITEM_ID,
      onSolve: {},
    });
    const plates = getTool("compile_puzzle")!.run(project, {
      mapId,
      puzzleId: "open_plates",
      kind: "push-switches",
      plates: [{ at: { x: 12, y: 2 } }, { at: { x: 13, y: 2 } }],
      all: true,
      onSolve: {},
    });

    expect(eventsByIds(map, (sequence.data as PuzzleData).eventIds).map(({ x, y }) => [x, y])).toEqual([[2, 2], [3, 2]]);
    expect(eventsByIds(map, (password.data as PuzzleData).eventIds).map(({ x, y }) => [x, y])).toEqual([[6, 2]]);
    expect(eventsByIds(map, (gate.data as PuzzleData).eventIds).map(({ x, y }) => [x, y])).toEqual([[9, 2]]);
    expect(eventsByIds(map, (plates.data as PuzzleData).eventIds).map(({ x, y }) => [x, y])).toEqual([[12, 2], [13, 2]]);
    expect(sequence.warnings).toBeUndefined();
    expect(password.warnings).toBeUndefined();
    expect(gate.warnings).toBeUndefined();
    expect(plates.warnings).toBeUndefined();
  });
});
