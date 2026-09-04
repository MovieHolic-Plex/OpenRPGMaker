import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { canMove, isPassable } from "@/project/collision";
import { eventBlocksPlayerAt, initialRuntimeEventPositions } from "@/project/runtimeEventState";
import type { AuthorHouseResultData } from "@/editor/tools/authorHouseTypes";

const G = 270;

function buildLinkedInteriorHouse() {
  const project = createBlankProject();
  const ctx = { project };
  const mapId = project.startMapId;
  project.maps[mapId]!.lowerTiles.fill(G);
  const result = runTool(ctx, "author_house", {
    kind: "single", mapId, kitId: "bright-plaster",
    wings: [{ x: 2, y: 2, w: 7, h: 8 }],
    interior: "linked-interior", door: true, yard: [],
  }, { dryRun: false });
  expect(result.ok, JSON.stringify((result as { issues?: unknown }).issues)).toBe(true);
  const map = ctx.project.maps[mapId]!;
  const data = result.data as unknown as AuthorHouseResultData;
  const house = data.houses[0]!;
  expect(house.doorAt).not.toBeNull();
  expect(house.interior).toBeDefined();
  return { project, map, doorAt: house.doorAt!, interior: house.interior! };
}

describe("열린 문 기본값 — 실외 집 문은 걸어 들어가면 열린다", () => {
  it("문 스프라이트는 통행을 막지 않는다", () => {
    const { map, doorAt, interior } = buildLinkedInteriorHouse();
    const door = map.events.find((e) => e.id === interior.doorEventId);
    expect(door).toBeDefined();
    expect(door!.x).toBe(doorAt.x);
    expect(door!.y).toBe(doorAt.y);
    expect(door!.pages![0]!.trigger.kind).toBe("playerTouch");
    expect(door!.pages![0]!.priority).toBe("below");
    expect(eventBlocksPlayerAt(
      map.events,
      { flags: {}, switches: {}, variables: {}, selfSwitches: {} } as never,
      initialRuntimeEventPositions(map.events), door!.x, door!.y)).toBe(false);
  });

  it("문 앞 발판을 밟으면 실내로 전이된다", () => {
    const { project, map, doorAt, interior } = buildLinkedInteriorHouse();
    const step = map.events.find((e) => e.id === `${interior.doorEventId}_step`);
    expect(step).toBeDefined();
    expect(step!.x).toBe(doorAt.x);
    expect(step!.y).toBe(doorAt.y + 1);
    expect(step!.pages![0]!.trigger.kind).toBe("playerTouch");
    expect(step!.pages![0]!.priority).toBe("below");
    expect(step!.pages![0]!.commands[0]).toMatchObject({
      kind: "transfer",
      mapId: interior.interiorMapId,
    });
    expect(isPassable(project, map, step!.x, step!.y)).toBe(true);
    expect(eventBlocksPlayerAt(
      map.events,
      { flags: {}, switches: {}, variables: {}, selfSwitches: {} } as never,
      initialRuntimeEventPositions(map.events), step!.x, step!.y)).toBe(false);
  });

  it("문 앞까지 걸어오면 발판이 전이를 발동한다", () => {
    const { project, map, doorAt, interior } = buildLinkedInteriorHouse();
    // 문 앞은 통행 가능(ensureDoorFrontPassable), 발판은 투명 below+playerTouch.
    expect(isPassable(project, map, doorAt.x, doorAt.y + 1)).toBe(true);
    const step = map.events.find((e) => e.id === `${interior.doorEventId}_step`);
    expect(step!.x).toBe(doorAt.x);
    expect(step!.y).toBe(doorAt.y + 1);
    // 문 칸 자체는 벽 타일이라 진입하지 않는다 — 발판에서 전이되므로 필요 없다.
    expect(canMove(project, map, doorAt.x, doorAt.y + 1, doorAt.x, doorAt.y)).toBe(false);
  });
});
