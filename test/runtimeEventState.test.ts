import { describe, expect, it } from "vitest";
import type { EventPage, GameEvent } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import { createSaveSnapshot, applySaveSnapshot } from "@/player/saveSlots";
import { createInterpreter } from "@/player/interpreter";
import { M2_COMMAND_CATALOG } from "@/editor/eventCommands/m2Catalog";
import type { Command, M2CommandFields } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";
import { renderTiles } from "@/player/playSceneMapRuntime";
import {
  eventBlocksPlayerAt,
  findBlockingRuntimeEventAt,
  findBlockingRuntimeEventAtInMap,
  findRuntimeEventAt,
  initialRuntimeEventPositions,
  moveRuntimeEventPosition,
  runtimeEventViewsForMap,
} from "@/player/runtimeEventState";

function page(id: string, priority: EventPage["priority"], trigger: EventPage["trigger"]): EventPage {
  return {
    id,
    name: id,
    conditions: [],
    graphic: {},
    trigger,
    priority,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
}

function event(id: string, x: number, y: number, pages: EventPage[]): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages,
  };
}

function session(): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorVitals: {},
    currentMapId: "map_runtime",
    x: 0,
    y: 0,
  };
}

type MockTileImage = {
  y: number;
  setOrigin(x: number, y: number): void;
  setDepth(depth: number): void;
};

type MockSprite = MockTileImage & {
  play(key: string): MockSprite;
  setPosition(x: number, y: number): void;
  setFrame(frame: string | number): void;
  destroy(): void;
};

function mockTileImage(): MockTileImage {
  return {
    y: 0,
    setOrigin: () => undefined,
    setDepth: () => undefined,
  };
}

function mockSprite(): MockSprite {
  let sprite: MockSprite;
  sprite = {
    y: 0,
    play: () => sprite,
    setOrigin: () => undefined,
    setDepth: () => undefined,
    setPosition: (_x, y) => {
      sprite.y = y;
    },
    setFrame: () => undefined,
    destroy: () => undefined,
  };
  return sprite;
}

function sceneWithEventSprite(spriteId: string): Parameters<typeof renderTiles>[0] {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  const npcPage = page("npc_page", "same", { kind: "action" });
  npcPage.graphic.sprite = { type: "bundled", id: spriteId };
  map.events = [event("npc", 1, 1, [npcPage])];
  store.replace(project);

  return {
    map,
    session: startSession(project),
    eventPositions: initialRuntimeEventPositions(map.events),
    tileLayer: {
      removeAll: () => undefined,
      add: () => undefined,
    },
    eventSprites: new Map(),
    runtimeDom: {
      clearEventMarkers: () => undefined,
      upsertEventMarker: () => undefined,
      syncMissingResourceError: () => undefined,
    },
    missingResources: new Set(),
    add: {
      image: () => mockTileImage(),
      sprite: () => mockSprite(),
    },
    runEvent: async () => undefined,
    syncRuntimeState: () => undefined,
  };
}

function modernM2Command(title: string, fields: M2CommandFields): Command {
  const entry = M2_COMMAND_CATALOG.find((item) => item.title === title);
  if (!entry) throw new Error(`missing M2 command: ${title}`);
  return { kind: "m2Command", commandId: entry.id, fields };
}

function drainInterpreter(interpreter: ReturnType<typeof createInterpreter>): void {
  let result = interpreter.start();
  let guard = 0;
  while (result.kind !== "done" && guard < 20) {
    guard += 1;
    result = interpreter.resume(undefined);
  }
}

describe("runtime event state", () => {
  it("blocks player movement only for same-priority active events", () => {
    const events = [
      event("solid", 1, 0, [page("solid_page", "same", { kind: "action" })]),
      event("floor", 0, 1, [page("floor_page", "below", { kind: "touch" })]),
    ];
    const positions = initialRuntimeEventPositions(events);

    expect(eventBlocksPlayerAt(events, session(), positions, 1, 0)).toBe(true);
    expect(eventBlocksPlayerAt(events, session(), positions, 0, 1)).toBe(false);
    expect(findRuntimeEventAt(events, session(), positions, 0, 1, "touch")?.event.id).toBe("floor");
  });

  it("keeps RM2003 player touch triggers distinct from legacy touch aliases", () => {
    const events = [
      event("touch-npc", 1, 0, [page("touch_npc_page", "same", { kind: "playerTouch" })]),
      event("event-touch-npc", 2, 0, [page("event_touch_page", "same", { kind: "eventTouch" })]),
    ];
    const positions = initialRuntimeEventPositions(events);

    expect(findBlockingRuntimeEventAt(events, session(), positions, 1, 0)?.event.id).toBe("touch-npc");
    expect(findRuntimeEventAt(events, session(), positions, 1, 0, ["touch", "playerTouch"])?.event.id).toBe(
      "touch-npc"
    );
    expect(findRuntimeEventAt(events, session(), positions, 2, 0, ["touch", "playerTouch"])).toBeUndefined();
  });

  it("keeps moved event positions in runtime state instead of mutating authoring events", () => {
    const events = [event("mover", 0, 1, [page("mover_page", "same", { kind: "action" })])];
    const positions = initialRuntimeEventPositions(events);

    moveRuntimeEventPosition(positions, "mover", 1, 1);

    expect(events[0].x).toBe(0);
    expect(events[0].y).toBe(1);
    expect(findRuntimeEventAt(events, session(), positions, 1, 1, "action")?.event.id).toBe("mover");
  });

  it("excludes erased events from page resolution, triggers, and blocking checks", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const events = [event("erased", 1, 0, [page("erased_page", "same", { kind: "action" })])];
    map.events = events;
    const playSession = session();
    playSession.erasedEventIds = ["erased"];
    const positions = initialRuntimeEventPositions(events);

    expect(runtimeEventViewsForMap(project, map, playSession, positions)).toEqual([]);
    expect(findRuntimeEventAt(events, playSession, positions, 1, 0, "action")).toBeUndefined();
    expect(findBlockingRuntimeEventAt(events, playSession, positions, 1, 0)).toBeUndefined();
  });

  it("reports a missing event sprite when a page uses the bundled tileset texture id", () => {
    const scene = sceneWithEventSprite("tex_tiles_default");

    renderTiles(scene);

    expect(scene.missingResources.has("tex_tiles_default")).toBe(true);
  });

  it("spawns, triggers, removes, and restores runtime event instances", () => {
    const project = createBlankProject();
    project.switches = [{ id: "spawn_talked", name: "Spawn Talked" }];
    const map = project.maps[project.startMapId]!;
    const templatePage = page("template_page", "same", { kind: "action" });
    templatePage.graphic.sprite = { type: "bundled", id: "tex_easyrpg_charset_people1" };
    templatePage.commands = [{ kind: "setSwitch", switchId: "spawn_talked", value: true }];
    templatePage.movement = {
      type: "custom",
      speed: 3,
      frequency: 3,
      route: { moves: [{ kind: "turn", dir: "left" }], repeat: true },
    };
    map.events = [event("template_npc", 0, 0, [templatePage])];
    const otherMap = { ...map, id: "map_other", name: "Other", events: [] };
    project.maps[otherMap.id] = otherMap;
    store.replace(project);

    const playSession = startSession(project);
    const positions = initialRuntimeEventPositions(map.events);
    drainInterpreter(createInterpreter([
      modernM2Command("Spawn Event", {
        prefabId: "template_npc",
        eventId: "spawn_npc",
        mapId: map.id,
        x: 2,
        y: 3,
      }),
    ], playSession, project));

    const spawnedView = runtimeEventViewsForMap(project, map, playSession, positions)
      .find((view) => view.event.id === "spawn_npc");
    expect(spawnedView).toMatchObject({
      x: 2,
      y: 3,
      trigger: { kind: "action" },
      priority: "same",
    });
    expect(findBlockingRuntimeEventAtInMap(project, map, playSession, positions, 2, 3)?.event.id).toBe("spawn_npc");
    expect(runtimeEventViewsForMap(project, otherMap, playSession, {}).some((view) => view.event.id === "spawn_npc")).toBe(false);

    const renderScene = {
      map,
      session: playSession,
      eventPositions: positions,
      tileLayer: {
        removeAll: () => undefined,
        add: () => undefined,
      },
      eventSprites: new Map<string, MockSprite>(),
      runtimeDom: {
        clearEventMarkers: () => undefined,
        upsertEventMarker: () => undefined,
        syncMissingResourceError: () => undefined,
      },
      missingResources: new Set<string>(),
      add: {
        image: () => mockTileImage(),
        sprite: (x: number, y: number, texture: string, frame?: string | number) => {
          const sprite = mockSprite();
          sprite.setPosition(x, y);
          if (frame !== undefined) sprite.setFrame(frame);
          void texture;
          return sprite;
        },
      },
      runEvent: async () => undefined,
      syncRuntimeState: () => undefined,
    };
    renderTiles(renderScene);
    expect(renderScene.eventSprites.has("spawn_npc")).toBe(true);

    drainInterpreter(createInterpreter(spawnedView?.page?.commands ?? [], playSession, project, { currentEventId: "spawn_npc" }));
    expect(playSession.switches.spawn_talked).toBe(true);

    const snapshot = createSaveSnapshot(project, playSession);
    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.spawnedEvents?.spawn_npc).toMatchObject({ templateEventId: "template_npc", mapId: map.id, x: 2, y: 3 });
    expect(runtimeEventViewsForMap(project, map, restored, positions).some((view) => view.event.id === "spawn_npc")).toBe(true);

    drainInterpreter(createInterpreter([
      modernM2Command("Remove Event", { eventId: "spawn_npc" }),
    ], restored, project));

    const removedSnapshot = createSaveSnapshot(project, restored);
    const restoredAfterRemove = applySaveSnapshot(project, removedSnapshot);
    expect(restoredAfterRemove.spawnedEvents?.spawn_npc).toBeUndefined();
    expect(runtimeEventViewsForMap(project, map, restoredAfterRemove, positions).some((view) => view.event.id === "spawn_npc")).toBe(false);
  });

  it("removes authored events through persistent Modern Remove Event state", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.events = [event("authored_npc", 1, 1, [page("authored_page", "same", { kind: "action" })])];
    store.replace(project);
    const playSession = startSession(project);
    const positions = initialRuntimeEventPositions(map.events);

    drainInterpreter(createInterpreter([
      modernM2Command("Remove Event", { eventId: "authored_npc" }),
    ], playSession, project));

    expect(playSession.removedEventIds?.[map.id]).toEqual(["authored_npc"]);
    expect(runtimeEventViewsForMap(project, map, playSession, positions).some((view) => view.event.id === "authored_npc")).toBe(false);

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, playSession));
    expect(restored.removedEventIds?.[map.id]).toEqual(["authored_npc"]);
    expect(runtimeEventViewsForMap(project, map, restored, positions).some((view) => view.event.id === "authored_npc")).toBe(false);
  });
});
