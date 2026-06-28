import { describe, expect, it } from "vitest";
import type { EventPage, GameEvent } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import type { PlaySessionLike } from "@/player/types";
import { renderTiles } from "@/player/playSceneMapRuntime";
import {
  eventBlocksPlayerAt,
  findBlockingRuntimeEventAt,
  findRuntimeEventAt,
  initialRuntimeEventPositions,
  moveRuntimeEventPosition,
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

  it("reports a missing event sprite when a page uses the bundled tileset texture id", () => {
    const scene = sceneWithEventSprite("tex_tiles_default");

    renderTiles(scene);

    expect(scene.missingResources.has("tex_tiles_default")).toBe(true);
  });
});
