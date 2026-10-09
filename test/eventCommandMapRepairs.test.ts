import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { tilesetTextureKey } from "@/editor/tilesetImage";
import type { Command, M2CommandFields } from "@/project/types";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import {
  findBlockingRuntimeEventAtInMap,
  initialRuntimeEventPositions,
  runtimeEventViewsForMap,
} from "@/project/runtimeEventState";
import { runCommands } from "@/player/playSceneInterpreter";
import { renderTiles } from "@/player/playSceneMapRuntime";
import { registerAutonomousMover, updateParallelEvents } from "@/player/playSceneSchedulers";
import type { AutonomousMover, ParallelProcess } from "@/player/playSceneTypes";
import { PlayScene } from "@/player/PlayScene";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { characterSpriteX, characterSpriteY } from "@/player/characterDepth";
import { parseWeather } from "@/player/weather/weatherModel";
import { weatherRenderPlan } from "@/player/playSceneWeather";
import { installFakeDom } from "./fakeDom";
import { event, page, renderSceneWith } from "./runtimeEventPageFixtures";

// Substitute only the platform Scene base; PlayScene methods/state and the tested
// command, mover and rendering functions remain real.
vi.mock("@/app/phaserRuntime", () => ({
  getLoadedPhaser: () => ({ Scene: class {} }),
}));

function m2(index: number, fields: M2CommandFields): Command {
  const entry = M2_COMMAND_CATALOG.find(candidate => candidate.index === index);
  if (!entry) throw new Error(`Missing catalog index ${index}`);
  return { kind: "m2Command", commandId: entry.id, fields };
}

function fixture() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.events = [
    event("npc_a", 5, 7, [page("page_a", "same", { kind: "action" })]),
    event("npc_b", 9, 7, [page("page_b", "same", { kind: "action" })]),
  ];
  const session = startSession(project, 12345);
  const positions = initialRuntimeEventPositions(map.events);
  const resource = (kind: "music" | "sound" | "backdrop") => {
    const id = project.resourceProfiles.find(profile => profile.kind === kind)?.assetId;
    if (!id) throw new Error(`Blank project lacks a ${kind} resource`);
    return id;
  };
  return { project, map, session, positions, resource };
}

type Fixture = ReturnType<typeof fixture>;

function execute(f: Fixture, commands: Command[], common = false): StepResult[] {
  if (common) {
    f.project.commonEvents = [{ id: "map_repair_common", name: "Map repair", trigger: "none", commands }];
    f.session.commonEvents = f.project.commonEvents;
    commands = [{ kind: "callCommonEvent", commonEventId: "map_repair_common" }];
  }
  const interpreter = createInterpreter(commands, f.session, f.project, {
    currentEventId: "npc_a",
    eventPositions: f.positions,
  });
  const steps: StepResult[] = [];
  let step = interpreter.start();
  while (step.kind !== "done") {
    if (steps.length >= 10) throw new Error("Unexpected unbounded map repair program");
    steps.push(step);
    step = interpreter.resume(undefined);
  }
  return steps;
}

function views(f: Fixture) {
  return runtimeEventViewsForMap(f.project, f.map, f.session, f.positions)
    .map(view => ({ id: view.event.id, x: view.x, y: view.y, direction: view.direction }));
}

describe("map event command repairs: authoritative locations", () => {
  it.each([false, true])("sets location and preserves live facing (common=%s)", common => {
    const f = fixture();
    f.positions.npc_a = { x: 6, y: 7, direction: "right" };
    expect(findBlockingRuntimeEventAtInMap(f.project, f.map, f.session, f.positions, 6, 7)?.event.id).toBe("npc_a");

    execute(f, [m2(40, { target: "npc_a", mapId: f.map.id, x: 8, y: 9 })], common);

    expect.soft(f.session.eventLocations.npc_a, "session.eventLocations.npc_a")
      .toEqual({ mapId: f.map.id, x: 8, y: 9, direction: "right" });
    expect.soft(views(f)[0], "runtimeEventViewsForMap[npc_a]")
      .toEqual({ id: "npc_a", x: 8, y: 9, direction: "right" });
    expect.soft(findBlockingRuntimeEventAtInMap(f.project, f.map, f.session, f.positions, 8, 9)?.event.id, "new cell blocker").toBe("npc_a");
    expect.soft(findBlockingRuntimeEventAtInMap(f.project, f.map, f.session, f.positions, 6, 7)?.event.id, "old cell blocker").toBeUndefined();
    expect(f.map.events[0]).toMatchObject({ x: 5, y: 7 });
  });

  it.each([false, true])("swaps current positions atomically without swapping facing (common=%s)", common => {
    const f = fixture();
    f.positions.npc_a = { x: 4, y: 5, direction: "right" };
    f.positions.npc_b = { x: 9, y: 8, direction: "down" };
    f.session.eventLocations.npc_b = { mapId: f.map.id, x: 10, y: 11, direction: "left" };
    expect(views(f)).toEqual([
      { id: "npc_a", x: 4, y: 5, direction: "right" },
      { id: "npc_b", x: 10, y: 11, direction: "left" },
    ]);

    execute(f, [m2(41, { eventA: "npc_a", eventB: "npc_b" })], common);

    expect.soft(f.session.eventLocations, "session.eventLocations after swap").toEqual({
      npc_a: { mapId: f.map.id, x: 10, y: 11, direction: "right" },
      npc_b: { mapId: f.map.id, x: 4, y: 5, direction: "left" },
    });
    expect.soft(views(f), "runtimeEventViewsForMap after swap").toEqual([
      { id: "npc_a", x: 10, y: 11, direction: "right" },
      { id: "npc_b", x: 4, y: 5, direction: "left" },
    ]);
    expect(f.map.events.map(e => [e.x, e.y])).toEqual([[5, 7], [9, 7]]);
  });

  it("moves an authored event to a seeded destination map", () => {
    const f = fixture();
    const destination = { ...structuredClone(f.map), id: "map_repair_destination", events: [] };
    f.project.maps[destination.id] = destination;
    f.project.mapTree.children.push({ mapId: destination.id, children: [] });
    f.positions.npc_a = { x: 6, y: 7, direction: "up" };

    execute(f, [m2(40, { target: "npc_a", mapId: destination.id, x: 8, y: 9 })]);

    expect.soft(views(f).map(view => view.id), "source map membership").toEqual(["npc_b"]);
    expect.soft(runtimeEventViewsForMap(f.project, destination, f.session, {})
      .map(view => ({ id: view.event.id, x: view.x, y: view.y, direction: view.direction })), "destination map membership")
      .toEqual([{ id: "npc_a", x: 8, y: 9, direction: "up" }]);
  });

  it.each([false, true])("hands relocation to the real host so an active mover cannot render the old interpolation (parallel=%s)", async parallel => {
    const previousProject = store.getCurrent();
    const restoreDom = installFakeDom({ animationFrames: "manual" });
    try {
      // Only drawing objects are test doubles. Command dispatch, mover registration,
      // runtime coordinate resolution and renderTiles all use production code.
      const rendered = renderSceneWith({ graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } } });
      const dialogue = {
        showText: async () => undefined,
        showChoices: async () => 0,
        showNumberInput: async () => 0,
        hide: () => undefined,
        close: () => undefined,
      };
      const scene = Object.assign(new PlayScene(), {
        ...rendered,
        resolveTilesetTexture: tilesetTextureKey,
        autonomousNPCs: new Map<string, AutonomousMover>(),
        commandMoveRouteEventIds: new Set<string>(),
        pageMoveRouteEventIds: new Set<string>(),
        pageMoveRouteKeys: new Set<string>(),
        eventGraphicPatternOverrides: new Map<string, number>(),
        parallelProcesses: new Map<string, ParallelProcess>(),
        activeRuntimeEvents: () => [],
        running: false,
        inputEnabled: true,
        lastActionTargetKey: "",
        game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : undefined } },
        setInputEnabled: () => undefined,
        clearRuntimeOverlay: () => undefined,
        showRuntimeOverlay: () => undefined,
        refreshRuntimeSurfaces: () => renderTiles(scene),
      });
      registerAutonomousMover(scene, "npc", [{ kind: "move", dir: "right" }], false);
      const mover = scene.autonomousNPCs.get("npc");
      if (!mover) throw new Error("Real mover registration failed");
      mover.moveDurationMs = 320;
      mover.activeMove = { fromX: 1, fromY: 1, toX: 2, toY: 1, dir: "right", baseFrame: 0, elapsedMs: 160 };
      scene.eventPositions.npc = { x: 2, y: 1, direction: "right" };
      scene.commandMoveRouteEventIds.add("npc");
      renderTiles(scene);
      expect(scene.eventSprites.get("npc")).toMatchObject({ x: characterSpriteX(1.5), y: characterSpriteY(1) });

      // The partial scene implements only the surfaces this command exercises;
      // no invented relocation callback or future StepResult is used here.
      const commands = [m2(40, { target: "npc", mapId: scene.map.id, x: 8, y: 9 })];
      if (parallel) {
        store.getCurrent().commonEvents = [{ id: "relocate_parallel", name: "Relocate", trigger: "parallel", commands }];
        updateParallelEvents(scene, 0);
      } else {
        await runCommands(scene, commands, "npc");
      }

      expect.soft(scene.eventSprites.get("npc"), "host-rendered NPC sprite after relocation")
        .toMatchObject({ x: characterSpriteX(8), y: characterSpriteY(9) });
      expect.soft(scene.autonomousNPCs.get("npc")?.activeMove ?? null, "stale activeMove after relocation").toBeNull();
    } finally {
      store.replaceProject(previousProject);
      restoreDom();
    }
  });
});

describe("map event command repairs: relocation integration", () => {
  it.each([false, true])("keeps spawned cross-map membership and template metadata consistent (swap=%s)", swap => {
    const f = fixture();
    const destination = { ...structuredClone(f.map), id: "map_spawn_destination", events: [event("remote_npc", 12, 10, [])] };
    f.project.maps[destination.id] = destination;
    f.project.mapTree.children.push({ mapId: destination.id, children: [] });
    execute(f, [m2(203, {
      templateMapId: f.map.id, templateEventId: "npc_a", eventId: "spawn_a", mapId: f.map.id, x: 3, y: 4,
    })]);
    expect(views(f).map(view => view.id)).toContain("spawn_a");
    const command = swap ? m2(41, { eventA: "spawn_a", eventB: "remote_npc" })
      : m2(40, { target: "spawn_a", mapId: destination.id, x: 12, y: 10 });

    execute(f, [command]);

    expect(f.session.spawnedEvents.spawn_a).toMatchObject({
      templateMapId: f.map.id, templateEventId: "npc_a", mapId: destination.id, x: 12, y: 10,
    });
    expect(f.session.m2Runtime?.events.spawn_a.prefabId).toBe("npc_a");
    expect(views(f).map(view => view.id)).not.toContain("spawn_a");
    expect(runtimeEventViewsForMap(f.project, destination, f.session, {})
      .find(view => view.event.id === "spawn_a")).toMatchObject({ x: 12, y: 10 });
    if (swap) expect(views(f).find(view => view.id === "remote_npc")).toMatchObject({ x: 3, y: 4 });
  });

  it.each(["value", "mapId"])("retains the editor-supported legacy swap field %s", key => {
    const f = fixture();
    execute(f, [m2(41, { target: "npc_a", [key]: "npc_b" })]);
    expect(views(f).map(view => [view.id, view.x, view.y])).toEqual([["npc_a", 9, 7], ["npc_b", 5, 7]]);
  });

  it("does not create a ghost location for an unseeded destination map", () => {
    const f = fixture();
    execute(f, [m2(40, { target: "npc_a", mapId: "missing_map", x: 8, y: 9 })]);
    expect(f.session.eventLocations.npc_a).toBeUndefined();
    expect(views(f)[0]).toMatchObject({ x: 5, y: 7 });
  });

  it("resumes relocation handoffs in sceneTestRunner and observes both new positions", () => {
    const f = fixture();
    const eventPage = f.map.events[0].pages?.[0];
    if (!eventPage) throw new Error("Missing runner fixture page");
    eventPage.commands = [
      m2(40, { target: "npc_a", mapId: f.map.id, x: 8, y: 9 }),
      m2(41, { eventA: "npc_a", eventB: "npc_b" }),
      { kind: "setVariable", variableId: "after_relocation", op: "=", value: 73 },
    ];

    const result = runSceneTest(f.project, { mapId: f.map.id, start: { x: 5, y: 6 }, steps: [
      { kind: "face", dir: "down" }, { kind: "interact" },
      { kind: "expect", eventAt: { eventId: "npc_a", x: 9, y: 7 } },
      { kind: "expect", eventAt: { eventId: "npc_b", x: 8, y: 9 }, variableEquals: { after_relocation: 73 } },
    ] });

    expect(result.ok, result.failureReason ?? result.log.join("\n")).toBe(true);
  });
});

const resourceCases = [
  { name: "canonical only", fields: (id: string) => ({ resourceId: id }), expected: (id: string) => id },
  { name: "canonical wins over legacy", fields: (id: string) => ({ resourceId: id, value: "legacy-resource" }), expected: (id: string) => id },
  { name: "explicit empty canonical wins", fields: () => ({ resourceId: "", value: "legacy-resource" }), expected: () => "" },
  { name: "absent canonical accepts legacy", fields: (id: string) => ({ value: id }), expected: (id: string) => id },
];

for (const audio of [
  { index: 27, key: "system_bgm", kind: "music" as const },
  { index: 28, key: "system_se", kind: "sound" as const },
]) {
  describe(`map event command repairs: ${audio.key}`, () => {
    it.each(resourceCases)("preserves resourceId presence semantics: $name", row => {
      const f = fixture();
      const id = f.resource(audio.kind);
      execute(f, [m2(audio.index, row.fields(id))]);
      expect(f.session.m2Runtime?.system[audio.key], `m2Runtime.system.${audio.key}`).toBe(row.expected(id));
    });

    it.each([63, 0])("retains authored volume %s without changing the legacy string resource record", volume => {
      const f = fixture();
      const id = f.resource(audio.kind);
      // Equal canonical/legacy IDs isolate volume loss from resource precedence.
      execute(f, [m2(audio.index, { resourceId: id, value: id, volume })]);
      expect(f.session.m2Runtime?.system[audio.key]).toBe(id);
      // The public system bucket is a scalar record, with no published volume-key name.
      // Require retention there without inventing a new metadata key for the repair.
      expect(Object.values(f.session.m2Runtime?.system ?? {}), `m2Runtime.system retained volume=${volume}`).toContain(volume);
    });
  });
}

describe("map event command repairs: directly coupled parallax resource loss", () => {
  it.each(resourceCases)("preserves resourceId presence semantics: $name", row => {
    const f = fixture();
    const id = f.resource("backdrop");
    execute(f, [m2(69, row.fields(id))]);
    expect(f.session.m2Runtime?.map.parallax_override?.value, "m2Runtime.map.parallax_override.value").toBe(row.expected(id));
  });
});

describe("map event command repairs: weather intensity", () => {
  // Shipped precipitation density is 180 at full strength (040583434);
  // keep literal expected counts so the renderer cannot silently ignore intensity.
  it.each([
    { name: "explicit 0.7", fields: { value: "snow", intensity: 0.7, transitionMs: 750 }, kind: "snow", intensity: 0.7, count: 126 },
    { name: "explicit zero clears weather", fields: { value: "snow", intensity: 0, transitionMs: 750 }, kind: "none", intensity: 0, count: 0 },
    { name: "legacy embedded strength", fields: { value: "snow,8", durationMs: 750 }, kind: "snow", intensity: 0.8, count: 144 },
    { name: "explicit strength overrides embedded strength", fields: { value: "snow,8", intensity: 0.7, transitionMs: 750 }, kind: "snow", intensity: 0.7, count: 126 },
    { name: "legacy missing strength defaults to half", fields: { value: "snow", durationMs: 750 }, kind: "snow", intensity: 0.5, count: 90 },
  ])("preserves $name in both step and renderer-consumed state", row => {
    const f = fixture();
    const [step] = execute(f, [m2(50, row.fields)]);
    expect.soft(step, "setWeather StepResult").toEqual({ kind: "setWeather", weather: row.kind, intensity: row.intensity, transitionMs: 750 });
    const recorded = parseWeather(f.session.m2Runtime?.screen.weather);
    expect.soft(recorded, "parseWeather(m2Runtime.screen.weather)").toEqual({ kind: row.kind, intensity: row.intensity });
    expect.soft(weatherRenderPlan(recorded, 0).particleCount, "weatherRenderPlan particleCount").toBe(row.count);
  });
});
