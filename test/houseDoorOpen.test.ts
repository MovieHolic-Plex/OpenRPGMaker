import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { canMove, isPassable } from "@/project/collision";
import { eventBlocksPlayerAt, initialRuntimeEventPositions } from "@/project/runtimeEventState";
import type { AuthorHouseResultData } from "@/editor/tools/authorHouseTypes";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { transferTo } from "@/player/playSceneMapCommands";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { mockSprite } from "./runtimeEventPageFixtures";
import { LocalDiagnosticSession } from "@/util/localDiagnosticSession";

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
  return { project: ctx.project, map, doorAt: house.doorAt!, interior: house.interior! };
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
      kind: "callMapEvent",
      eventId: interior.doorEventId,
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

  it("발판이 문 원본의 열림 소리·프레임·전이와 이후 편집한 명령을 실행한다", () => {
    const { project, map, interior } = buildLinkedInteriorHouse();
    const door = map.events.find((event) => event.id === interior.doorEventId)!;
    const step = map.events.find((event) => event.id === `${interior.doorEventId}_step`)!;
    const page = door.pages![0]!;
    page.commands.unshift({ kind: "setVariable", variableId: "door-edited", op: "=", value: 7 });
    const originalDoor = structuredClone(door);
    const session = startSession(project);
    const interpreter = createInterpreter(step.pages![0]!.commands, session, project);
    const steps: StepResult[] = [];
    let current = interpreter.start();
    while (current.kind !== "done" && steps.length < 20) {
      steps.push(current);
      current = interpreter.resume(undefined);
    }
    expect(current.kind).toBe("done");
    expect(session.variables["door-edited"]).toBe(7);
    expect(steps[0]).toMatchObject({ kind: "playAudio" });
    expect(steps.filter((step) => step.kind === "setEventGraphicPattern")).toEqual(
      page.commands.filter((command) => command.kind === "setEventGraphicPattern"),
    );
    expect(steps.at(-1)).toMatchObject({ kind: "transfer", mapId: interior.interiorMapId });
    expect(door).toEqual(originalDoor);
  });

  it("실내에서 기존 발판에 귀환해도 접촉 이벤트를 즉시 재실행하지 않는다", async () => {
    const { project, map, doorAt, interior } = buildLinkedInteriorHouse();
    store.replace(project);
    const session = startSession(project);
    session.currentMapId = interior.interiorMapId;
    const exit = project.maps[interior.interiorMapId]!.events.find((event) => event.id === interior.exitEventId)!;
    const runEvent = vi.fn(async () => undefined);
    const scene = {
      session,
      map: project.maps[interior.interiorMapId]!,
      eventPositions: {},
      tileX: exit.x, tileY: exit.y,
      facing: "down", moving: false, running: false,
      player: mockSprite(), playerSprite: { idleFrameFor: () => 0 },
      followerSprites: new Map(), eventSprites: new Map(), autoStartedKeys: new Set(),
      add: { sprite: () => mockSprite() }, cameras: { main: {} },
      loadMap(mapId: string) {
        this.map = project.maps[mapId]!;
        this.session.currentMapId = mapId;
        this.eventPositions = initialRuntimeEventPositions(this.map.events);
      },
      getMapId: () => session.currentMapId,
      centerCamera: vi.fn(), runEvent, refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
    } as unknown as PlaySceneContext;
    const diagnostics = new LocalDiagnosticSession();
    diagnostics.start(true, ["transfer"]);
    try {
      await transferTo(scene, { kind: "transfer", mapId: map.id, x: doorAt.x, y: doorAt.y + 1, fade: "none" });
      expect(diagnostics.snapshot().receipts).toContainEqual(expect.objectContaining({ category: "transfer", phase: "completed", x: session.x, y: session.y }));
    } finally { diagnostics.clear(); }
    expect([session.currentMapId, session.x, session.y]).toEqual([map.id, doorAt.x, doorAt.y + 1]);
    expect(runEvent).not.toHaveBeenCalled();
    expect(map.events.find((event) => event.id === `${interior.doorEventId}_step`)!.pages![0]!.trigger.kind)
      .toBe("playerTouch");
  });
});
