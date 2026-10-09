import { describe, expect, it } from "vitest";

import { getTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent, GameMap, Project } from "@/project/types";

// script_cutscene / 맵 진입 체크포인트가 물·벽 위에 서는 버그 계약.
// 체크포인트는 auto 트리거라 밟을 필요는 없지만 지형 안에 심으면 event-unreachable 린트가 난다.
// 컷신은 트리거에 따라 갈린다: playerTouch/touch 는 밟을 수 있어야 하고, action 은 인접 통행 가능 칸만 있으면 된다.

function fixture(): { project: Project; map: GameMap; mapId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  return { project, map, mapId };
}

function setWater(map: GameMap, x: number, y: number): void {
  map.lowerTiles[y * map.width + x] = TILE.WATER;
  map.upperTiles[y * map.width + x] = TILE.EMPTY;
}

function eventById(map: GameMap, id: string): GameEvent {
  const found = map.events.find((entry) => entry.id === id);
  if (!found) throw new Error(`event not found: ${id}`);
  return found;
}

function checkpointId(map: GameMap): string {
  return `${map.id}_checkpoint_auto`;
}

function placeCheckpoint(project: Project, mapId: string, trapAt: { x: number; y: number }): void {
  getTool("place_trap")!.run(project, {
    mapId,
    cells: [trapAt],
    trigger: "touch",
    respawnCheckpoint: true,
  });
}

const SAY_BEAT = { kind: "say" as const, speaker: "나", text: "그날을 기억한다." };

describe("ensureMapCheckpointEvent 통행 가능 착지", () => {
  it("(0,0)이 물이면 체크포인트 auto 이벤트는 통행 가능 칸에 착지한다", () => {
    const { project, map, mapId } = fixture();
    setWater(map, 0, 0);
    expect(isPassable(project, map, 0, 0)).toBe(false);

    placeCheckpoint(project, mapId, { x: 5, y: 5 });

    const checkpoint = eventById(map, checkpointId(map));
    expect(isPassable(project, map, checkpoint.x, checkpoint.y)).toBe(true);
  });

  it("일반 맵에서는 체크포인트가 기존처럼 (0,0)에 선다", () => {
    const { project, map, mapId } = fixture();
    expect(isPassable(project, map, 0, 0)).toBe(true);

    placeCheckpoint(project, mapId, { x: 5, y: 5 });

    const checkpoint = eventById(map, checkpointId(map));
    expect([checkpoint.x, checkpoint.y]).toEqual([0, 0]);
  });

  // auto 트리거는 좌표와 무관하게 발동하므로, 좌상단 반경 3이 전부 막혔다고 트랩 배치 전체를
  // 실패시키면 고치려던 버그보다 나쁘다(동굴·두꺼운 벽 맵에서 place_trap 이 통째로 죽는다).
  it("좌상단 반경 3이 전부 막힌 맵에서도 트랩 배치는 성공하고 체크포인트가 남는다", () => {
    const { project, map, mapId } = fixture();
    for (let y = 0; y <= 3; y += 1) {
      for (let x = 0; x <= 3; x += 1) setWater(map, x, y);
    }
    expect(isPassable(project, map, 0, 0)).toBe(false);
    expect(isPassable(project, map, 3, 3)).toBe(false);

    expect(() => placeCheckpoint(project, mapId, { x: 8, y: 8 })).not.toThrow();

    const checkpoint = eventById(map, checkpointId(map));
    expect(isPassable(project, map, checkpoint.x, checkpoint.y)).toBe(true);
    expect(map.events.some((event) => event.id.startsWith("ev_trap"))).toBe(true);
  });
});

describe("script_cutscene 통행 가능 착지", () => {
  it("물 위 playerTouch 컷신은 통행 가능 칸에 착지한다", () => {
    const { project, map, mapId } = fixture();
    setWater(map, 5, 5);
    expect(isPassable(project, map, 5, 5)).toBe(false);

    const result = getTool("script_cutscene")!.run(project, {
      mapId,
      x: 5,
      y: 5,
      trigger: "playerTouch",
      beats: [SAY_BEAT],
    });

    const data = result.data as { eventId: string };
    const event = eventById(map, data.eventId);
    expect(isPassable(project, map, event.x, event.y)).toBe(true);
  });

  it("물 위 기존 action 컷신에 playerTouch 페이지를 더하면 이벤트를 통행 가능 칸으로 옮긴다", () => {
    const { project, map, mapId } = fixture();
    setWater(map, 5, 5);

    getTool("script_cutscene")!.run(project, {
      mapId,
      eventId: "ev_existing_water",
      x: 5,
      y: 5,
      trigger: "action",
      beats: [SAY_BEAT],
    });
    const result = getTool("script_cutscene")!.run(project, {
      mapId,
      eventId: "ev_existing_water",
      mode: "append",
      trigger: "playerTouch",
      beats: [{ kind: "say", speaker: "나", text: "밟으면 시작한다." }],
    });

    const event = eventById(map, "ev_existing_water");
    expect(isPassable(project, map, event.x, event.y)).toBe(true);
    expect(event.pages).toHaveLength(2);
    expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
  });

  it("통행 가능 이웃이 있는 물 위 action 컷신은 작성 좌표를 유지한다", () => {
    const { project, map, mapId } = fixture();
    setWater(map, 4, 4);
    expect(isPassable(project, map, 4, 4)).toBe(false);
    expect(isPassable(project, map, 4, 5)).toBe(true);

    const result = getTool("script_cutscene")!.run(project, {
      mapId,
      x: 4,
      y: 4,
      trigger: "action",
      beats: [SAY_BEAT],
    });

    const data = result.data as { eventId: string };
    const event = eventById(map, data.eventId);
    expect([event.x, event.y]).toEqual([4, 4]);
  });
});

describe("체크포인트·컷신 기존 이벤트 재사용", () => {
  it("이미 있는 체크포인트/컷신 이벤트는 재사용하고 복제하지 않는다", () => {
    const { project, map, mapId } = fixture();

    placeCheckpoint(project, mapId, { x: 5, y: 5 });
    placeCheckpoint(project, mapId, { x: 6, y: 6 });
    const checkpoints = map.events.filter((event) => event.id === checkpointId(map));
    expect(checkpoints).toHaveLength(1);

    getTool("script_cutscene")!.run(project, {
      mapId,
      eventId: "ev_memory",
      x: 8,
      y: 8,
      trigger: "action",
      beats: [SAY_BEAT],
    });
    getTool("script_cutscene")!.run(project, {
      mapId,
      eventId: "ev_memory",
      x: 1,
      y: 1,
      trigger: "action",
      beats: [{ kind: "say", speaker: "나", text: "두 번째 장면." }],
    });
    const cutscenes = map.events.filter((event) => event.id === "ev_memory");
    expect(cutscenes).toHaveLength(1);
    expect(cutscenes[0].pages).toHaveLength(1);
    expect(cutscenes[0].pages?.[0].commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "text", body: "두 번째 장면." }),
    ]));
    expect([cutscenes[0].x, cutscenes[0].y]).toEqual([8, 8]);
  });
});
