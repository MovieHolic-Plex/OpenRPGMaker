// 방 파이프라인이 **기존 맵을 교체**할 때 프로젝트 계약을 보정하는지 고정한다.
//
// 2026-08-29 실측: `output/ai-activity/` 의 실패 기록 3건에서 원인을 그대로 꺼냈다.
//
//   args    = { mapId: "map_gallery_main", door: {x:6,y:11}, rooms: [...] }
//   summary = 'run_interior_room_pipeline' 커밋 거부(무결성 오류)
//   issues  = ["시작 위치가 통행 불가 타일입니다: (10, 12)"]
//
// 방 맵은 전면 VOID 에서 시작해 방 footprint 만 바닥으로 칠한다(`interiorRoomPipeline`).
// 그래서 기존 맵을 통째로 교체하면 그 맵을 가리키던 좌표 두 종류가 벽 위에 남는다:
//   (1) `project.startPos` — 대상이 시작 맵일 때
//   (2) 다른 맵에서 들어오는 transfer 착지점 — 대상이 어느 맵이든
// 둘 다 커밋 게이트가 error 로 막으므로, 시공이 성공했는데도 적용이 거부된다.
//
// 그리고 **모델이 재시도로 벗어날 수 없다**: 원인이 자기 인자가 아니라 프로젝트 다른 곳의
// 좌표이고, 실패한 호출은 `ctx.project` 를 갱신하지 않아 재시도의 baseline 도 동일하다.
// 실제 로그에서 통과한 재시도는 문 좌표가 **하필** 기존 시작 위치와 같은 칸이었던 우연이다.
//
// `reconcilePlayerStart` 는 멀티턴 경로(`startRoomSession`)에만 걸려 있었다. 이 파일은
// 원샷 경로와 멀티턴 완료 시점 **양쪽**에서 두 축이 보정되는 것을 고정한다.

import { describe, expect, it } from "vitest";
import { isPassable, isPassableLanding } from "@/project/collision";
import { commitChangeset } from "@/editor/tools/changeset";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { projectLint } from "@/project/lint/projectLint";
import type { Command, Project } from "@/project/types";

/** 실패 기록의 플랜을 모사한다 — 방 3개가 맵 위쪽/왼쪽에만 있어 시작 위치를 덮지 않는다. */
function threeRoomArgs(mapId: string): Record<string, unknown> {
  return {
    mapId,
    // #262 의 map-exists 가드는 기존 맵 교체를 기본 거부한다. 이 스위트는 **교체 경로**의
    // 시작 좌표 보정을 검사하므로 가드가 알려주는 옵트인을 그대로 켠다.
    replaceExisting: true,
    name: "3룸 주택",
    seed: 1, // Omitted seeds use Date.now(); fixture geometry must not depend on test timing.
    width: 16,
    height: 14,
    theme: "dining",
    door: { x: 8, y: 12 },
    rooms: [
      { id: "bedroom", theme: "bedroom", x: 2, y: 2, w: 5, h: 4, floorTile: 72 },
      { id: "kitchen", theme: "kitchen", x: 9, y: 2, w: 5, h: 4, floorTile: 72 },
      { id: "living", theme: "dining", x: 2, y: 9, w: 12, h: 4, floorTile: 72 },
    ],
    innerDoors: [{ x: 4, y: 6 }, { x: 11, y: 6 }],
  };
}

function blockingCodes(project: Project, baseline: Project): string[] {
  return commitChangeset(project, baseline).blocking.map((issue) => issue.code);
}

function startPositionIssues(project: Project): string[] {
  return projectLint(project)
    .filter((issue) => issue.severity === "error" && issue.code === "start-position")
    .map((issue) => issue.message);
}

// 파이프라인은 실내 맵 안에 자기 자신을 겨냥한 현관 이벤트를 스스로 하나 만든다.
// 그래서 "이 맵을 겨냥한 transfer" 를 세면 2건이 된다 — 검사는 우리가 심은 문만 본다.
const FRONT_DOOR_EVENT = "ev_front_door";

/** 분기 안쪽까지 훑어 특정 이벤트가 지정 맵을 겨냥한 transfer 를 모은다. */
function inboundTransfers(
  project: Project,
  mapId: string,
  eventId: string = FRONT_DOOR_EVENT,
): Extract<Command, { kind: "transfer" }>[] {
  const found: Extract<Command, { kind: "transfer" }>[] = [];
  let currentEventId = "";
  const walk = (commands: readonly Command[] | undefined): void => {
    for (const command of commands ?? []) {
      if (command.kind === "transfer" && command.mapId === mapId && currentEventId === eventId) found.push(command);
      if (command.kind === "choices") {
        for (const option of command.options) walk(option.branch);
        walk(command.cancelBranch);
      } else if (command.kind === "fork") {
        walk(command.then);
        walk(command.else);
      } else if (command.kind === "loop") {
        walk(command.body);
      } else if (command.kind === "shop") {
        walk(command.transactionBranch);
      }
    }
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      currentEventId = event.id;
      walk(event.commands);
      for (const page of event.pages ?? []) walk(page.commands);
    }
  }
  currentEventId = "";
  for (const commonEvent of project.commonEvents) walk(commonEvent.commands);
  return found;
}

describe("시작 맵을 교체하는 원샷 파이프라인", () => {
  it("시작 위치를 방 안으로 옮기고 커밋을 통과한다", () => {
    const before = createBlankProject();
    const mapId = before.startMapId;
    const ctx: ToolContext = { project: before };

    const result = runTool(ctx, "run_interior_room_pipeline", threeRoomArgs(mapId), { dryRun: false });

    // 핵심: 예전에는 여기서 `커밋 거부(무결성 오류)` 가 났다.
    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).not.toContain("커밋 거부");

    const after = ctx.project;
    expect(after).not.toBe(before);
    // 시작 위치가 실제로 밟을 수 있는 칸이어야 한다 — 라벨만 통과시키는 게 아니다.
    const map = after.maps[mapId]!;
    expect(isPassable(after, map, after.startPos.x, after.startPos.y)).toBe(true);
    expect(startPositionIssues(after)).toEqual([]);
  });

  it("좌표를 옮긴 사실을 경고로 남긴다 — 조용히 옮기면 저작 의도가 사라진 걸 모른다", () => {
    const before = createBlankProject();
    const ctx: ToolContext = { project: before };
    const originalStart = { ...before.startPos };

    const result = runTool(ctx, "run_interior_room_pipeline", threeRoomArgs(before.startMapId), { dryRun: false });
    expect(result.ok, result.summary).toBe(true);

    const moved = ctx.project.startPos;
    expect(moved).not.toEqual(originalStart);
    const warnings = result.diff?.warnings ?? [];
    expect(
      warnings.some((warning) => warning.includes("시작 맵") && warning.includes("옮겼습니다")),
      `경고 목록: ${JSON.stringify(warnings)}`,
    ).toBe(true);
  });

  it("방이 이미 시작 위치를 덮으면 좌표를 건드리지 않는다", () => {
    const before = createBlankProject();
    const mapId = before.startMapId;
    const start = { ...before.startPos };
    const ctx: ToolContext = { project: before };

    // wings 로 시작 위치를 포함하는 넓은 바닥을 깐다.
    const result = runTool(
      ctx,
      "run_interior_room_pipeline",
      {
        mapId,
        // 교체 경로 검사 — #262 가드의 옵트인.
        replaceExisting: true,
        name: "넓은 집",
        seed: 1,
        width: 20,
        height: 15,
        theme: "bedroom",
        door: { x: 10, y: 12 },
        wings: [{ x: 1, y: 1, w: 18, h: 13 }],
      },
      { dryRun: false },
    );

    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.startPos).toEqual(start);
  });
});

describe("인바운드 transfer 착지점", () => {
  /** 시작 맵에서 별도 실내 맵으로 들어가는 문을 만든다. 착지점은 방 밖에 둔다. */
  function projectWithInboundDoor(): { project: Project; interiorId: string; landing: { x: number; y: number } } {
    const project = createBlankProject();
    const interiorId = "map_interior_target";
    const source = project.maps[project.startMapId]!;
    const landing = { x: 14, y: 12 };

    project.maps[interiorId] = {
      ...structuredClone(source),
      id: interiorId,
      name: "옛 실내",
      width: 16,
      height: 14,
      lowerTiles: new Array(16 * 14).fill(source.lowerTiles[0] ?? 0),
      upperTiles: new Array(16 * 14).fill(0),
      events: [],
    };
    project.mapTree.children.push({ mapId: interiorId, children: [] });

    source.events.push({
      id: "ev_front_door",
      x: 5,
      y: 5,
      name: "현관",
      trigger: "playerTouch",
      commands: [{ kind: "transfer", mapId: interiorId, x: landing.x, y: landing.y }],
      pages: [],
    } as unknown as (typeof source.events)[number]);

    return { project, interiorId, landing };
  }

  it("교체로 착지점이 통행 불가가 되면 가장 가까운 통행 가능 칸으로 옮긴다", () => {
    const { project, interiorId, landing } = projectWithInboundDoor();
    const ctx: ToolContext = { project };

    // 방 3개가 (14,12) 을 덮지 않으므로 예전에는 transfer-impassable 로 거부됐다.
    const result = runTool(ctx, "run_interior_room_pipeline", threeRoomArgs(interiorId), { dryRun: false });

    expect(result.ok, result.summary).toBe(true);
    expect(blockingCodes(ctx.project, project)).toEqual([]);

    const transfers = inboundTransfers(ctx.project, interiorId);
    expect(transfers).toHaveLength(1);
    const moved = transfers[0]!;
    expect({ x: moved.x, y: moved.y }).not.toEqual(landing);
    // 실제로 밟을 수 있어야 한다.
    expect(isPassable(ctx.project, ctx.project.maps[interiorId]!, moved.x, moved.y)).toBe(true);

    const warnings = result.diff?.warnings ?? [];
    expect(
      warnings.some((warning) => warning.includes("착지 좌표") && warning.includes("옮겼습니다")),
      `경고 목록: ${JSON.stringify(warnings)}`,
    ).toBe(true);
  });

  it.each([1, 7])("가구 배치 후 열린 착지점은 보존하고 막힌 착지점만 최단 이동한다 (seed %i)", (seed) => {
    const { project, interiorId } = projectWithInboundDoor();
    const args = { ...threeRoomArgs(interiorId), seed };
    const reference: ToolContext = { project: structuredClone(project) };
    const built = runTool(reference, "run_interior_room_pipeline", args, { dryRun: false });
    expect(built.ok, built.summary).toBe(true);
    const furnished = reference.project.maps[interiorId]!;

    // Room bounds alone do not imply walkability: inspect the completed furniture layers.
    const landings: { x: number; y: number }[] = [];
    for (let y = 9; y < 13; y += 1) {
      for (let x = 2; x < 14; x += 1) landings.push({ x, y });
    }
    const open = landings.filter(({ x, y }) => isPassable(reference.project, furnished, x, y));
    expect(open.length).toBeGreaterThan(0);
    expect(open.length).toBeLessThan(landings.length);
    for (const { x, y } of open) expect(isPassableLanding(reference.project, furnished, x, y)).toBe(true);
    const door = project.maps[project.startMapId]!.events.find((event) => event.id === FRONT_DOOR_EVENT)!;
    door.commands = landings.map(({ x, y }) => ({ kind: "transfer", mapId: interiorId, x, y }));

    const ctx: ToolContext = { project };
    const result = runTool(ctx, "run_interior_room_pipeline", args, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(blockingCodes(ctx.project, project)).toEqual([]);
    const map = ctx.project.maps[interiorId]!;
    expect(map.lowerTiles).toEqual(furnished.lowerTiles);
    expect(map.upperTiles).toEqual(furnished.upperTiles);
    const after = inboundTransfers(ctx.project, interiorId);
    expect(after).toHaveLength(landings.length);
    for (const [index, landing] of landings.entries()) {
      const moved = after[index]!;
      expect(isPassableLanding(ctx.project, map, moved.x, moved.y)).toBe(true);
      if (isPassable(reference.project, furnished, landing.x, landing.y)) {
        expect({ x: moved.x, y: moved.y }).toEqual(landing);
      } else {
        expect({ x: moved.x, y: moved.y }).not.toEqual(landing);
        const distances = furnished.lowerTiles.flatMap((_, cell) => {
          const x = cell % furnished.width;
          const y = Math.floor(cell / furnished.width);
          return isPassable(reference.project, furnished, x, y)
            ? [(x - landing.x) ** 2 + (y - landing.y) ** 2] : [];
        });
        expect((moved.x - landing.x) ** 2 + (moved.y - landing.y) ** 2).toBe(Math.min(...distances));
      }
    }
  });

  it("맵이 줄어들어 착지점이 경계 밖이 되는 경우도 되살린다", () => {
    const { project, interiorId } = projectWithInboundDoor();
    const transfer = inboundTransfers(project, interiorId)[0]!;
    transfer.x = 15;
    transfer.y = 13;

    const ctx: ToolContext = { project };
    // width/height 를 줄여 (15,13) 이 경계 밖이 되게 한다.
    const result = runTool(
      ctx,
      "run_interior_room_pipeline",
      { ...threeRoomArgs(interiorId), width: 12, height: 10, door: { x: 6, y: 8 }, rooms: [{ id: "living", theme: "dining", x: 2, y: 2, w: 8, h: 5, floorTile: 72 }], innerDoors: [] },
      { dryRun: false },
    );

    expect(result.ok, result.summary).toBe(true);
    const after = inboundTransfers(ctx.project, interiorId)[0]!;
    const map = ctx.project.maps[interiorId]!;
    expect(after.x).toBeLessThan(map.width);
    expect(after.y).toBeLessThan(map.height);
    expect(isPassable(ctx.project, map, after.x, after.y)).toBe(true);
  });
});

describe("멀티턴 경로도 같은 보정을 받는다", () => {
  it("마지막 레이어까지 끝내면 착지점이 되살아난다", () => {
    const { project, interiorId, landing } = projectWithInbound();
    const ctx: ToolContext = { project };

    const started = runTool(ctx, "start_interior_room_session", threeRoomArgs(interiorId), { dryRun: false });
    expect(started.ok, started.summary).toBe(true);
    const sessionId = (started.data as { sessionId?: string } | undefined)?.sessionId;
    expect(sessionId).toBeTruthy();

    // 완료까지 반복. 중간에 보정이 걸리면 다음 레이어가 그 칸을 다시 막을 수 있으므로
    // 계약은 "마지막에 한 번" 이다.
    let done = false;
    for (let step = 0; step < 12 && !done; step += 1) {
      const advanced = runTool(ctx, "advance_interior_room_build", { sessionId }, { dryRun: false });
      expect(advanced.ok, advanced.summary).toBe(true);
      done = (advanced.data as { done?: boolean } | undefined)?.done === true;
    }
    expect(done).toBe(true);

    const after = inboundTransfers(ctx.project, interiorId)[0]!;
    expect({ x: after.x, y: after.y }).not.toEqual(landing);
    expect(isPassable(ctx.project, ctx.project.maps[interiorId]!, after.x, after.y)).toBe(true);
  });

  /** 위 describe 의 헬퍼와 같은 구성 — 스코프 밖이라 다시 만든다. */
  function projectWithInbound(): { project: Project; interiorId: string; landing: { x: number; y: number } } {
    const project = createBlankProject();
    const interiorId = "map_interior_target";
    const source = project.maps[project.startMapId]!;
    const landing = { x: 14, y: 12 };
    project.maps[interiorId] = {
      ...structuredClone(source),
      id: interiorId,
      name: "옛 실내",
      width: 16,
      height: 14,
      lowerTiles: new Array(16 * 14).fill(source.lowerTiles[0] ?? 0),
      upperTiles: new Array(16 * 14).fill(0),
      events: [],
    };
    project.mapTree.children.push({ mapId: interiorId, children: [] });
    source.events.push({
      id: "ev_front_door",
      x: 5,
      y: 5,
      name: "현관",
      trigger: "playerTouch",
      commands: [{ kind: "transfer", mapId: interiorId, x: landing.x, y: landing.y }],
      pages: [],
    } as unknown as (typeof source.events)[number]);
    return { project, interiorId, landing };
  }
});
