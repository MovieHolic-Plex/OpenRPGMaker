import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { editorState, type Layer } from "@/editor/editorState";
import {
  type EditSceneTileIndex,
  editorEventMarkerTexture,
  eventMarkerTileScale,
  renderEditScene,
  renderEditSceneTileCells,
  renderEventLayerClickFeedback,
} from "@/editor/editSceneRender";
import { planEditSceneRenderForStoreChange } from "@/editor/editSceneRenderPlan";
import { createBlankProject, DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import { store } from "@/project/store";

type MockStroke = {
  lineWidth: number;
  color: number;
  alpha?: number;
};

type MockObject = {
  kind: "circle" | "container" | "graphics" | "image" | "rectangle" | "sprite" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  texture?: string;
  frame?: string | number;
  fillColor?: number;
  fillAlpha?: number;
  origin?: readonly [number, number];
  scale?: number;
  stroke?: MockStroke;
  alpha?: number;
  tint?: number;
  children: MockObject[];
  setOrigin(x: number, y?: number): MockObject;
  setAlpha(alpha: number): MockObject;
  setTint(tint: number): MockObject;
  setStrokeStyle(lineWidth: number, color: number, alpha?: number): MockObject;
  setScale(scale: number): MockObject;
  setSize(width: number, height: number): MockObject;
  setDepth(depth: number): MockObject;
  play(key: string): MockObject;
  add(child: MockObject): MockObject;
  depth?: number;
};

type MockGridGraphics = Phaser.GameObjects.Graphics & {
  readonly lineStyles: readonly MockStroke[];
};

type RenderedScene = {
  readonly gridLineStyles: readonly MockStroke[];
  readonly overlayObjects: readonly MockObject[];
};

function mockObject(partial: Partial<MockObject>): MockObject {
  const object: MockObject = {
    kind: "rectangle",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    children: [],
    setOrigin(x: number, y = x): MockObject {
      object.origin = [x, y];
      return object;
    },
    setAlpha(alpha: number): MockObject {
      object.alpha = alpha;
      return object;
    },
    setTint(tint: number): MockObject {
      object.tint = tint;
      return object;
    },
    setStrokeStyle(lineWidth: number, color: number, alpha?: number): MockObject {
      object.stroke = { lineWidth, color, alpha };
      return object;
    },
    setScale(scale: number): MockObject {
      object.scale = scale;
      return object;
    },
    setSize(width: number, height: number): MockObject {
      object.width = width;
      object.height = height;
      return object;
    },
    setDepth(depth: number): MockObject {
      object.depth = depth;
      return object;
    },
    play(): MockObject {
      return object;
    },
    add(child: MockObject): MockObject {
      object.children.push(child);
      return object;
    },
  };
  return Object.assign(object, partial);
}

function mockContainer(objects?: MockObject[]): Phaser.GameObjects.Container {
  return {
    removeAll: () => {
      if (objects) objects.length = 0;
    },
    remove: (object: MockObject) => {
      if (objects) {
        const index = objects.indexOf(object);
        if (index >= 0) objects.splice(index, 1);
      }
      return object;
    },
    add: (object: MockObject) => {
      objects?.push(object);
      return object;
    },
  } as unknown as Phaser.GameObjects.Container;
}

function mockGridGraphics(): MockGridGraphics {
  const lineStyles: MockStroke[] = [];
  const graphics = {
    clear: () => undefined,
    lineStyle: (lineWidth: number, color: number, alpha?: number) => {
      lineStyles.push({ lineWidth, color, alpha });
      return graphics;
    },
    moveTo: () => graphics,
    lineTo: () => graphics,
    strokePath: () => graphics,
    lineStyles,
  };
  return graphics as unknown as MockGridGraphics;
}

function mockScene(): Phaser.Scene {
  return {
    add: {
      container: (x: number, y: number) => mockObject({ kind: "container", x, y }),
      graphics: () => mockObject({ kind: "graphics" }),
      image: (x: number, y: number, texture: string, frame?: string | number) =>
        mockObject({
          kind: "image",
          x,
          y,
          texture,
          frame,
          width: texture === "tex_easyrpg_charset_people1" ? 32 : 16,
          height: texture === "tex_easyrpg_charset_people1" ? 32 : 16,
        }),
      circle: (x: number, y: number, radius: number, fillColor?: number, fillAlpha?: number) =>
        mockObject({ kind: "circle", x, y, width: radius * 2, height: radius * 2, fillColor, fillAlpha }),
      rectangle: (x: number, y: number, width: number, height: number, fillColor?: number, fillAlpha?: number) =>
        mockObject({ kind: "rectangle", x, y, width, height, fillColor, fillAlpha }),
      sprite: (x: number, y: number, texture: string, frame?: string | number) =>
        mockObject({ kind: "sprite", x, y, texture, frame, width: 16, height: 16 }),
      text: (x: number, y: number, text: string) => mockObject({ kind: "text", x, y, text, width: 16, height: 16 }),
    },
  } as unknown as Phaser.Scene;
}

function renderSelectedNpcEvent(layer: Layer): RenderedScene {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.width = 4;
  map.height = 4;
  map.lowerTiles = new Array<number>(16).fill(-1);
  map.upperTiles = new Array<number>(16).fill(-1);
  map.events = [
    {
      id: "ev_npc",
      x: 2,
      y: 2,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "page_npc",
          name: "NPC",
          conditions: [],
          graphic: { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID } },
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        },
      ],
    },
  ];
  store.replace(project);
  editorState.set({
    currentMapId: map.id,
    layer,
    selectedEventId: "ev_npc",
    selectedEventPageId: null,
    selection: null,
    tool: "select",
  });

  const overlayObjects: MockObject[] = [];
  const gridGraphics = mockGridGraphics();
  renderEditScene({
    scene: mockScene(),
    tileLayer: mockContainer(),
    overlayLayer: mockContainer(overlayObjects),
    gridGraphics,
    mapId: map.id,
  });
  return { gridLineStyles: gridGraphics.lineStyles, overlayObjects };
}

function flattenObjects(objects: readonly MockObject[]): readonly MockObject[] {
  const flattened: MockObject[] = [];
  for (const object of objects) {
    flattened.push(object);
    flattened.push(...flattenObjects(object.children));
  }
  return flattened;
}

describe("edit scene event rendering", () => {
  it("renders the event layer with editable markers and saved event sprites", () => {
    const result = renderSelectedNpcEvent("event");
    const objects = flattenObjects(result.overlayObjects);
    const marker = objects.find(
      (object) =>
        object.kind === "rectangle" &&
        object.x === 40 &&
        object.y === 40 &&
        object.width === 12 &&
        object.height === 12
    );
    const sprite = objects.find((object) => object.kind === "image" && object.texture === "tex_easyrpg_charset_people1");
    const ring = result.overlayObjects.find(
      (object) =>
        object.kind === "rectangle" &&
        object.x === 40 &&
        object.y === 40 &&
        object.width === 16 &&
        object.height === 16 &&
        object.fillAlpha === 0
    );

    expect(result.gridLineStyles[0]).toMatchObject({ lineWidth: 1, color: 0x000000, alpha: 0.45 });
    expect(marker?.stroke).toMatchObject({ lineWidth: 2, color: 0xffffff, alpha: 0.95 });
    expect(sprite).toMatchObject({ x: 40, y: 40, texture: "tex_easyrpg_charset_people1", frame: 0 });
    expect(ring?.stroke).toMatchObject({ lineWidth: 2, color: 0x69db7c });
  });

  it("renders blank event edit markers without chroma-key magenta fill", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.width = 4;
    map.height = 4;
    map.lowerTiles = new Array<number>(16).fill(-1);
    map.upperTiles = new Array<number>(16).fill(-1);
    map.events = [
      {
        id: "ev_blank",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "page_blank",
            name: "Blank",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
          },
        ],
      },
    ];
    store.replace(project);
    editorState.set({
      currentMapId: map.id,
      layer: "event",
      selectedEventId: "ev_blank",
      selectedEventPageId: null,
      selection: null,
      tool: "select",
    });

    const overlayObjects: MockObject[] = [];
    renderEditScene({
      scene: mockScene(),
      tileLayer: mockContainer(),
      overlayLayer: mockContainer(overlayObjects),
      gridGraphics: mockGridGraphics(),
      mapId: map.id,
    });

    const marker = flattenObjects(overlayObjects).find(
      (object) => object.kind === "rectangle" && object.x === 24 && object.y === 24 && object.width === 12 && object.height === 12
    );

    expect(marker).toMatchObject({ fillColor: 0x1f2937, fillAlpha: 0.34 });
  });

  it.each<Layer>(["lower", "upper"])(
    "renders events as compact E badges on the %s tile layer",
    (layer) => {
      const result = renderSelectedNpcEvent(layer);
      const objects = flattenObjects(result.overlayObjects);
      const badge = result.overlayObjects.find((object) => object.kind === "container" && object.x === 40 && object.y === 40);
      const badgeBack = objects.find((object) => object.kind === "circle" && object.fillColor === 0x1f2937);
      const badgeText = objects.find((object) => object.kind === "text" && object.text === "E");
      const sprite = objects.find((object) => object.kind === "image" && object.texture === "tex_easyrpg_charset_people1");
      const ring = objects.find(
        (object) =>
          object.kind === "rectangle" &&
          object.x === 40 &&
          object.y === 40 &&
          object.width === 16 &&
          object.height === 16 &&
          object.fillAlpha === 0
      );

      expect(result.gridLineStyles[0]).toMatchObject({ lineWidth: 1, color: 0xffffff, alpha: 0.08 });
      expect(badge).toMatchObject({ alpha: 0.86 });
      expect(badgeBack?.stroke).toMatchObject({ lineWidth: 1, color: 0xcbd5e1, alpha: 0.72 });
      expect(badgeText).toMatchObject({ origin: [0.5, 0.5] });
      expect(sprite).toBeUndefined();
      expect(ring?.stroke).toMatchObject({ lineWidth: 2, color: 0x69db7c });
    }
  );

  it("resolves the generated default NPC to its bundled texture", () => {
    const texture = editorEventMarkerTexture(createBlankProject(), {
      sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID },
    });

    expect(texture).toEqual({ texture: "tex_easyrpg_charset_people1", frame: 0 });
  });

  it("scales event sprites into the one-tile event box", () => {
    expect(eventMarkerTileScale(32, 32)).toBe(0.4375);
    expect(eventMarkerTileScale(24, 32)).toBe(0.4375);
    expect(eventMarkerTileScale(12, 12)).toBe(1);
  });

  it("renders a visible clicked-cell marker for the event layer", () => {
    const overlayObjects: MockObject[] = [];
    renderEventLayerClickFeedback(
      { scene: mockScene(), overlayLayer: mockContainer(overlayObjects) },
      { mapId: "map_1", x: 1, y: 2, mode: "create" }
    );

    const objects = flattenObjects(overlayObjects);
    const marker = objects.find(
      (object) =>
        object.kind === "rectangle" &&
        object.x === 16 &&
        object.y === 32 &&
        object.width === 16 &&
        object.height === 16
    );
    const label = objects.find((object) => object.kind === "text" && object.text === "새 이벤트 위치 1,2");

    expect(marker).toMatchObject({ fillColor: 0xd9e8f6, fillAlpha: 0.55, origin: [0, 0] });
    expect(marker?.stroke).toMatchObject({ lineWidth: 2, color: 0x0a246a, alpha: 0.95 });
    expect(label).toMatchObject({ x: 18, y: 18 });
  });

  it("keeps single-cell paint tile regeneration bounded on a 128x128 map", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.width = 128;
    map.height = 128;
    map.lowerTiles = new Array<number>(128 * 128).fill(-1);
    map.upperTiles = new Array<number>(128 * 128).fill(-1);
    store.replace(project);
    editorState.set({ currentMapId: map.id, layer: "lower", tool: "paint", showGrid: false });

    const tileObjects: MockObject[] = [];
    const tileIndex: EditSceneTileIndex = new Map();
    const context = {
      scene: mockScene(),
      tileLayer: mockContainer(tileObjects),
      overlayLayer: mockContainer(),
      gridGraphics: mockGridGraphics(),
      mapId: map.id,
      tileIndex,
    };
    const fullStats = renderEditScene(context);
    const incrementalStats = renderEditSceneTileCells(context, [
      { x: 64, y: 64, layer: "lower" },
      { x: 64, y: 63, layer: "lower" },
      { x: 64, y: 65, layer: "lower" },
      { x: 63, y: 64, layer: "lower" },
      { x: 65, y: 64, layer: "lower" },
    ]);

    expect(fullStats.tileObjectsUpdated).toBe(128 * 128);
    expect(incrementalStats.tileObjectsUpdated).toBeLessThanOrEqual(8);
  });

  it("plans database changes as zero tile regeneration", () => {
    const plan = planEditSceneRenderForStoreChange({
      change: { scope: "database", collection: "actors" },
      currentMapId: "map_1",
      canIncrementalCells: true,
    });

    const tileObjectsUpdated = plan.kind === "skip" ? 0 : -1;
    expect(tileObjectsUpdated).toBe(0);
  });

  it("keeps map switches on the full rebuild path", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.width = 128;
    map.height = 128;
    map.lowerTiles = new Array<number>(128 * 128).fill(-1);
    map.upperTiles = new Array<number>(128 * 128).fill(-1);
    store.replace(project);
    editorState.set({ currentMapId: map.id, layer: "lower", tool: "paint", showGrid: false });

    const plan = planEditSceneRenderForStoreChange({
      change: { scope: "project" },
      currentMapId: map.id,
      canIncrementalCells: true,
    });
    const stats = renderEditScene({
      scene: mockScene(),
      tileLayer: mockContainer(),
      overlayLayer: mockContainer(),
      gridGraphics: mockGridGraphics(),
      mapId: map.id,
      tileIndex: new Map(),
    });

    expect(plan.kind).toBe("full");
    expect(stats.tileObjectsUpdated).toBe(128 * 128);
  });
});
