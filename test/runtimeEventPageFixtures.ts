import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";
import { renderTiles } from "@/player/playSceneMapRuntime";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { initialRuntimeEventPositions } from "@/player/runtimeEventState";
import type { PlaySessionLike } from "@/player/types";

export type MockTileImage = {
  readonly kind: "tile" | "sprite";
  x: number;
  y: number;
  depth: number | null;
  origin: readonly [number, number] | null;
  setOrigin(x: number, y: number): void;
  setDepth(depth: number): void;
};

export type MockSprite = MockTileImage & {
  alpha: number;
  frame: string | number | null;
  readonly texture: { key: string };
  play(key: string): MockSprite;
  setPosition(x: number, y: number): void;
  setFrame(frame: string | number): void;
  setAlpha(alpha: number): void;
  setTexture(texture: string, frame?: string | number): void;
  destroy(): void;
};

export function page(id: string, priority: EventPage["priority"], trigger: EventPage["trigger"]): EventPage {
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

export function event(id: string, x: number, y: number, pages: EventPage[]): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages,
  };
}

export function session(): PlaySessionLike {
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

export function mockTileImage(): MockTileImage {
  return {
    kind: "tile",
    x: 0,
    y: 0,
    depth: null,
    origin: null,
    setOrigin(x, y) {
      this.origin = [x, y];
    },
    setDepth(depth) {
      this.depth = depth;
    },
  };
}

export function mockSprite(x = 0, y = 0, textureKey = "tex_easyrpg_charset_people1"): MockSprite {
  let sprite: MockSprite;
  sprite = {
    kind: "sprite",
    x,
    y,
    alpha: 1,
    frame: null,
    texture: { key: textureKey },
    depth: null,
    origin: null,
    play: () => sprite,
    setOrigin(originX, originY) {
      sprite.origin = [originX, originY];
    },
    setDepth(depth) {
      sprite.depth = depth;
    },
    setPosition(nextX, nextY) {
      sprite.x = nextX;
      sprite.y = nextY;
    },
    setFrame(frame) {
      sprite.frame = frame;
    },
    setAlpha(alpha) {
      sprite.alpha = alpha;
    },
    setTexture(texture, frame) {
      sprite.texture.key = texture;
      if (frame !== undefined) sprite.frame = frame;
    },
    destroy: () => undefined,
  };
  return sprite;
}

export function pageWith(overrides: Partial<EventPage>): EventPage {
  const base = page("npc_page", "same", { kind: "action" });
  return {
    ...base,
    ...overrides,
    graphic: {
      ...base.graphic,
      ...overrides.graphic,
    },
    movement: {
      ...base.movement,
      ...overrides.movement,
    },
  };
}

export function renderSceneWith(overrides: Partial<EventPage>): Parameters<typeof renderTiles>[0] & {
  readonly eventSprites: Map<string, MockSprite>;
  readonly tileLayerChildren: unknown[];
} {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.events = [event("npc", 1, 1, [pageWith(overrides)])];
  store.replace(project);
  const tileLayerChildren: unknown[] = [];

  return {
    map,
    session: startSession(project),
    eventPositions: initialRuntimeEventPositions(map.events),
    tileLayer: {
      removeAll: () => undefined,
      add: (image) => {
        tileLayerChildren.push(image);
      },
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
      sprite: (x, y, texture, frame) => {
        const sprite = mockSprite(x, y, texture);
        if (frame !== undefined) sprite.frame = frame;
        return sprite;
      },
    },
    runEvent: async () => undefined,
    syncRuntimeState: () => undefined,
    tileLayerChildren,
  };
}

export function movementScene(overrides: Partial<EventPage>): Parameters<typeof registerPageMoveRoutes>[0] {
  return movementSceneWithPages([pageWith(overrides)]);
}

export function movementSceneWithPages(pages: EventPage[]): Parameters<typeof registerPageMoveRoutes>[0] {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.events = [event("npc", 1, 1, pages)];
  store.replace(project);

  let scene: Parameters<typeof registerPageMoveRoutes>[0];
  scene = {
    map,
    session: startSession(project),
    eventPositions: initialRuntimeEventPositions(map.events),
    pageMoveRouteKeys: new Set(),
    pageMoveRouteEventIds: new Set(),
    autonomousNPCs: new Map(),
    registerAutonomousMover: (eventId, moves, repeat) => {
      registerAutonomousMover(scene, eventId, moves, repeat);
    },
  };
  return scene;
}

export function isMockSprite(value: unknown): value is MockSprite {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "sprite";
}
