import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { editorState, type Layer } from "@/editor/editorState";
import {
  type EditSceneTileIndex,
  editorEventMarkerTexture,
  eventMarkerTileScale,
  renderEditScene,
  renderEditSceneTileCells,
  renderVisibleEditSceneTiles,
  renderEventLayerClickFeedback,
} from "@/editor/editSceneRender";
import { planEditSceneRenderForStoreChange } from "@/editor/editSceneRenderPlan";
import { resetCullableTiles, syncTileCulling } from "@/player/playSceneTileCulling";
import { createBlankProject, DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import { store } from "@/project/store";

// Renderer fixtures model appearance only; shared clock lifecycle is covered separately.
vi.mock("@/editor/sharedTileAnimation", () => ({
  createSharedAnimatedTile: (scene: Phaser.Scene, x: number, y: number, texture: string, frame: string, animation: string) =>
    scene.add.sprite(x, y, texture, frame).play(animation),
}));

/** 빈 칸(하층 -1)만 있는 2×2 맵을 그려 타일 객체를 돌려준다. */
function renderEmptyMap(options: { backgroundPreview?: boolean } = {}): readonly MockObject[] {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.width = 2;
  map.height = 2;
  map.lowerTiles = [-1, -1, -1, -1];
  map.upperTiles = [-1, -1, -1, -1];
  map.events = [];
  store.replace(project);
  editorState.set({ currentMapId: map.id, layer: "lower", selectedEventId: null, selection: null, tool: "select" });
  const tiles: MockObject[] = [];
  renderEditScene({
    scene: mockScene(),
    tileLayer: mockContainer(tiles),
    upperTileLayer: mockContainer(),
    overlayLayer: mockContainer(),
    gridGraphics: mockGridGraphics(),
    mapId: map.id,
    backgroundPreview: options.backgroundPreview,
  });
  return tiles;
}

describe("맵 배경 미리보기와 빈 칸 체커", () => {
  it("체커는 색을 바꾸지 않고 미리보기 중에만 옅어진다", () => {
    // 「여기 바닥이 없다」 신호는 기본값에서 그대로다 — 배경을 보이게 하려고 지우면 결함이 안 보인다.
    const opaque = renderEmptyMap();
    expect(opaque).toHaveLength(4);
    expect(opaque.every((tile) => tile.fillColor === 0x15171c || tile.fillColor === 0x1a1d23)).toBe(true);
    expect(opaque.every((tile) => tile.alpha === undefined)).toBe(true);

    const translucent = renderEmptyMap({ backgroundPreview: true });
    expect(translucent.every((tile) => tile.alpha === 0.35)).toBe(true);
    // 색은 그대로다 — 신호는 옅어질 뿐 사라지지 않는다.
    expect(translucent.map((tile) => tile.fillColor)).toEqual(opaque.map((tile) => tile.fillColor));
  });
});

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
  remove(child: MockObject, destroyChild?: boolean): MockObject;
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
    remove(child: MockObject): MockObject {
      const index = object.children.indexOf(child);
      if (index >= 0) object.children.splice(index, 1);
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
    sort: (property: string) => {
      objects?.sort((a, b) => {
        const av = Number((a as Record<string, unknown>)[property] ?? 0);
        const bv = Number((b as Record<string, unknown>)[property] ?? 0);
        return av - bv;
      });
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
    textures: {
      exists: () => true,
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
    upperTileLayer: mockContainer(),
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

    expect(result.gridLineStyles[0]).toMatchObject({ lineWidth: 1, color: 0x000000, alpha: 0.22 });
    expect(marker?.stroke).toMatchObject({ lineWidth: 2, color: 0xffffff, alpha: 0.95 });
    expect(sprite).toMatchObject({ x: 40, y: 48, texture: "tex_easyrpg_charset_people1", frame: 0 });
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
      upperTileLayer: mockContainer(),
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
    "keeps NPC sprites visible on the %s tile layer",
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
      // Character artwork stays visible while painting tiles.
      expect(badge).toBeUndefined();
      expect(badgeBack).toBeUndefined();
      expect(badgeText).toBeUndefined();
      expect(sprite).toBeDefined();
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
      upperTileLayer: mockContainer(tileObjects),
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
    // lower 9-neighborhood + co-rendered upper cells for draw-order flash fix
    expect(incrementalStats.tileObjectsUpdated).toBeLessThanOrEqual(64);
  });

  it("re-renders upper objects when lower cells repaint so upper never flashes under lower", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    // put an upper prop on center and neighbors
    map.upperTiles[5 * map.width + 5] = 87;
    map.upperTiles[4 * map.width + 5] = 87;
    map.upperTiles[5 * map.width + 4] = 87;
    store.replace(project);
    editorState.set({ currentMapId: map.id, layer: "lower", tool: "paint", showGrid: false });

    const tileObjects: MockObject[] = [];
    const tileIndex: EditSceneTileIndex = new Map();
    const context = {
      scene: mockScene(),
      tileLayer: mockContainer(tileObjects),
      upperTileLayer: mockContainer(tileObjects),
      overlayLayer: mockContainer(),
      gridGraphics: mockGridGraphics(),
      mapId: map.id,
      tileIndex,
    };
    renderEditScene(context);
    const upperKeysBefore = [...tileIndex.keys()].filter((k) => k.startsWith("upper:")).sort();
    expect(upperKeysBefore).toEqual(expect.arrayContaining(["upper:5,5", "upper:5,4", "upper:4,5"]));

    // only lower dirty cells (as paintTilesBulk emits) — upper must still be re-drawn
    renderEditSceneTileCells(context, [{ x: 5, y: 5, layer: "lower" }]);
    const upperKeysAfter = [...tileIndex.keys()].filter((k) => k.startsWith("upper:")).sort();
    expect(upperKeysAfter).toEqual(expect.arrayContaining(["upper:5,5", "upper:5,4", "upper:4,5"]));

    // last container objects for upper cells must still be present with higher depth
    const upperDepths = tileObjects.filter((o) => (o.depth ?? 0) >= 20).length;
    expect(upperDepths).toBeGreaterThan(0);
    // any lower object should not sit after the last upper for the same visual stack
    const lastDepths = tileObjects.map((o) => o.depth ?? 0);
    const lastLower = lastDepths.lastIndexOf(0);
    const lastUpper = Math.max(...lastDepths.map((d, i) => (d >= 20 ? i : -1)));
    expect(lastUpper).toBeGreaterThan(lastLower);
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
      upperTileLayer: mockContainer(),
      overlayLayer: mockContainer(),
      gridGraphics: mockGridGraphics(),
      mapId: map.id,
      tileIndex: new Map(),
    });

    expect(plan.kind).toBe("full");
    expect(stats.tileObjectsUpdated).toBe(128 * 128);
  });

  it("drops tiles that leave a large map camera window and ignores offscreen paints", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.width = 128;
    map.height = 128;
    map.lowerTiles = new Array<number>(128 * 128).fill(-1);
    map.upperTiles = new Array<number>(128 * 128).fill(-1);
    store.replace(project);
    editorState.set({ currentMapId: map.id, layer: "lower", tool: "paint", showGrid: false });

    const tileSize = map.tileSize;
    const view = { x: 0, y: 0, width: tileSize * 20, height: tileSize * 15 };
    const scene = mockScene();
    Object.assign(scene, { cameras: { main: { worldView: view } } });
    const tileObjects: MockObject[] = [];
    const tileIndex: EditSceneTileIndex = new Map();
    const context = {
      scene,
      tileLayer: mockContainer(tileObjects),
      upperTileLayer: mockContainer(tileObjects),
      overlayLayer: mockContainer(),
      gridGraphics: mockGridGraphics(),
      mapId: map.id,
      tileIndex,
    };
    const stats = renderEditScene(context);
    expect(stats.tileObjectsUpdated).toBe(23 * 18);
    expect(tileObjects).toHaveLength(23 * 18);
    expect(tileObjects.some((object) => object.x >= 23 * tileSize)).toBe(false);

    renderEditSceneTileCells(context, [{ x: 100, y: 100, layer: "lower" }]);
    expect(tileObjects).toHaveLength(23 * 18);
    expect(tileIndex.has("lower:100,100")).toBe(false);

    view.x = tileSize * 4;
    const shifted = renderVisibleEditSceneTiles(context);
    expect(shifted.tileObjectsUpdated).toBeGreaterThan(0);
    expect(tileObjects.some((object) => object.x === 0)).toBe(false);
    expect(tileObjects.some((object) => object.x === 26 * tileSize)).toBe(true);
    expect(tileObjects.length).toBeLessThan(23 * 18 + 200);
  });

  it("destroys chunk-parented tiles that leave the camera window", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.width = 128;
    map.height = 128;
    map.lowerTiles = new Array<number>(128 * 128).fill(-1);
    map.upperTiles = new Array<number>(128 * 128).fill(-1);
    store.replace(project);
    editorState.set({ currentMapId: map.id, layer: "lower", tool: "paint", showGrid: false });

    const tileSize = map.tileSize;
    const view = { x: 0, y: 0, width: tileSize * 20, height: tileSize * 15 };
    const scene = mockScene();
    Object.assign(scene, { cameras: { main: { worldView: view } } });
    const chunks = new Map<string, Phaser.GameObjects.Container>();
    const context = {
      scene,
      tileLayer: mockContainer(),
      upperTileLayer: mockContainer(),
      tileChunks: chunks,
      overlayLayer: mockContainer(),
      gridGraphics: mockGridGraphics(),
      mapId: map.id,
      tileIndex: new Map() as EditSceneTileIndex,
    };
    const chunkTiles = (): MockObject[] => {
      const tiles: MockObject[] = [];
      for (const chunk of chunks.values()) tiles.push(...(chunk as unknown as MockObject).children);
      return tiles;
    };

    renderEditScene(context);
    const originCount = chunkTiles().filter((tile) => tile.x === 0).length;
    expect(originCount).toBeGreaterThan(0);

    view.x = tileSize * 80;
    renderVisibleEditSceneTiles(context);
    expect(chunkTiles().some((tile) => tile.x === 0)).toBe(false);

    view.x = 0;
    renderVisibleEditSceneTiles(context);
    expect(chunkTiles().filter((tile) => tile.x === 0)).toHaveLength(originCount);
  });

  it("paints translucent empty checkers when background preview is on", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.width = 2;
    map.height = 2;
    map.lowerTiles = [-1, -1, -1, -1];
    map.upperTiles = [-1, -1, -1, -1];
    map.events = [];
    store.replace(project);
    editorState.set({ currentMapId: map.id, layer: "lower", tool: "paint", showGrid: false });
    const tiles: MockObject[] = [];
    renderEditSceneTileCells({
      scene: mockScene(),
      backgroundPreview: true,
      tileLayer: mockContainer(tiles),
      upperTileLayer: mockContainer(),
      overlayLayer: mockContainer(),
      gridGraphics: mockGridGraphics(),
      mapId: map.id,
      tileIndex: new Map(),
    }, [{ x: 0, y: 0, layer: "lower" }]);
    expect(tiles.some((tile) => tile.alpha === 0.35)).toBe(true);
  });
});

describe("edit scene tile culling", () => {
  // 컬링 추적이 일어나려면 객체에 setVisible 이 있어야 한다. 기본 mock 은 없으므로
  // setVisible/visible/active 를 갖춘 타일 객체를 만드는 전용 scene/container 를 쓴다.
  type CullTile = {
    kind: "rectangle" | "image";
    x: number;
    y: number;
    width: number;
    height: number;
    fillColor?: number;
    fillAlpha?: number;
    alpha?: number;
    origin?: readonly [number, number];
    depth?: number;
    visible: boolean;
    active: boolean;
    setVisibleCalls: number;
    setOrigin(x: number, y?: number): CullTile;
    setAlpha(alpha: number): CullTile;
    setDepth(depth: number): CullTile;
    setStrokeStyle(lineWidth: number, color: number, alpha?: number): CullTile;
    setVisible(value: boolean): CullTile;
  };

  function cullTile(kind: "rectangle" | "image", x: number, y: number, width = 16, height = 16): CullTile {
    const tile: CullTile = {
      kind,
      x,
      y,
      width,
      height,
      visible: true,
      active: true,
      setVisibleCalls: 0,
      setOrigin() { return tile; },
      setAlpha() { return tile; },
      setDepth() { return tile; },
      setStrokeStyle() { return tile; },
      setVisible(value: boolean) { tile.visible = value; tile.setVisibleCalls += 1; return tile; },
    };
    return tile;
  }

  function cullScene(): { scene: Phaser.Scene; tiles: CullTile[]; tileLayer: Phaser.GameObjects.Container; upperTileLayer: Phaser.GameObjects.Container; overlayLayer: Phaser.GameObjects.Container; gridGraphics: Phaser.GameObjects.Graphics } {
    const tiles: CullTile[] = [];
    // tileLayer/upperTileLayer.add 로 들어오는 객체만 컬링 추적 대상이다. overlayLayer.add 로 들어오는
    // 시작 위치 표시 같은 오버레이는 tiles 배열에서 제외한다.
    const tileLayer: Phaser.GameObjects.Container = {
      removeAll: () => undefined,
      remove: (object: CullTile) => { const i = tiles.indexOf(object); if (i >= 0) tiles.splice(i, 1); return object; },
      sort: () => undefined,
      add: (object: CullTile) => { tiles.push(object); return object; },
    } as unknown as Phaser.GameObjects.Container;
    const upperTileLayer: Phaser.GameObjects.Container = {
      removeAll: () => undefined,
      remove: (object: CullTile) => { const i = tiles.indexOf(object); if (i >= 0) tiles.splice(i, 1); return object; },
      sort: () => undefined,
      add: (object: CullTile) => { tiles.push(object); return object; },
    } as unknown as Phaser.GameObjects.Container;
    const overlayLayer: Phaser.GameObjects.Container = {
      removeAll: () => undefined,
      remove: () => undefined,
      add: () => undefined,
    } as unknown as Phaser.GameObjects.Container;
    const gridGraphics: Phaser.GameObjects.Graphics = {
      clear: () => undefined,
      lineStyle: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      strokePath: () => undefined,
    } as unknown as Phaser.GameObjects.Graphics;
    const scene = {
      add: {
        container: () => ({ x: 0, y: 0, add: () => undefined }),
        graphics: () => ({ clear: () => undefined, lineStyle: () => undefined, moveTo: () => undefined, lineTo: () => undefined, strokePath: () => undefined }),
        image: (x: number, y: number) => cullTile("image", x, y),
        rectangle: (x: number, y: number, w: number, h: number, fillColor?: number, fillAlpha?: number) => {
          const t = cullTile("rectangle", x, y, w, h);
          t.fillColor = fillColor;
          t.fillAlpha = fillAlpha;
          return t;
        },
        sprite: (x: number, y: number) => cullTile("image", x, y),
        circle: () => cullTile("rectangle", 0, 0),
        text: () => cullTile("rectangle", 0, 0),
      },
      textures: { exists: () => true },
    } as unknown as Phaser.Scene;
    return { scene, tiles, tileLayer, upperTileLayer, overlayLayer, gridGraphics };
  }

  it("renderEditScene 가 만든 타일은 syncTileCulling 이 화면 밖을 숨긴다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    // 64×64 빈 맵 — 화면(320×240) 밖 타일이 대부분이다.
    map.width = 64;
    map.height = 64;
    map.lowerTiles = new Array<number>(64 * 64).fill(-1);
    map.upperTiles = new Array<number>(64 * 64).fill(-1);
    store.replace(project);
    editorState.set({ currentMapId: map.id, layer: "lower", tool: "select", showGrid: false });

    const { scene, tiles, tileLayer, upperTileLayer, overlayLayer, gridGraphics } = cullScene();
    renderEditScene({
      scene,
      tileLayer,
      upperTileLayer,
      overlayLayer,
      gridGraphics,
      mapId: map.id,
      tileIndex: new Map(),
    });

    // 모든 타일이 만들어졌고, 아직 컬링이 적용되지 않아 전부 보인다.
    expect(tiles.length).toBe(64 * 64);
    expect(tiles.every((t) => t.visible)).toBe(true);

    // 320×240 화면이 (0,0)에 있을 때 — 보이는 타일은 ~20×15=300칸, 여유 2칸 포함 ~24×19.
    syncTileCulling(scene, { x: 0, y: 0, width: 320, height: 240 });

    const visibleCount = tiles.filter((t) => t.visible).length;
    const hiddenCount = tiles.length - visibleCount;
    // 화면 밖 타일이 숨겨졌다 — 4096칸 중 보이는 것은 ~400칸(여유 포함), 나머지 숨김.
    expect(visibleCount).toBeLessThan(600);
    expect(hiddenCount).toBeGreaterThan(tiles.length - 600);
    // 숨겨진 타일은 setVisible(false) 로 한 번 쓰였다.
    expect(tiles.some((t) => !t.visible && t.setVisibleCalls === 1)).toBe(true);
  });

  it("같은 화면 창으로 두 번째 syncTileCulling 은 아무것도 쓰지 않는다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.width = 32;
    map.height = 32;
    map.lowerTiles = new Array<number>(32 * 32).fill(-1);
    map.upperTiles = new Array<number>(32 * 32).fill(-1);
    store.replace(project);
    editorState.set({ currentMapId: map.id, layer: "lower", tool: "select", showGrid: false });

    const { scene, tiles, tileLayer, upperTileLayer, overlayLayer, gridGraphics } = cullScene();
    renderEditScene({
      scene,
      tileLayer,
      upperTileLayer,
      overlayLayer,
      gridGraphics,
      mapId: map.id,
      tileIndex: new Map(),
    });

    syncTileCulling(scene, { x: 0, y: 0, width: 320, height: 240 });
    const writesAfterFirst = tiles.reduce((sum, t) => sum + t.setVisibleCalls, 0);

    // 같은 창 — 타일 경계를 넘지 않았으므로 아무것도 쓰지 않는다.
    syncTileCulling(scene, { x: 0, y: 0, width: 320, height: 240 });
    const writesAfterSecond = tiles.reduce((sum, t) => sum + t.setVisibleCalls, 0);
    expect(writesAfterSecond).toBe(writesAfterFirst);
  });

  it("resetCullableTiles 뒤에는 같은 host 의 이전 추적이 비워진다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.width = 16;
    map.height = 16;
    map.lowerTiles = new Array<number>(16 * 16).fill(-1);
    map.upperTiles = new Array<number>(16 * 16).fill(-1);
    store.replace(project);
    editorState.set({ currentMapId: map.id, layer: "lower", tool: "select", showGrid: false });

    const { scene, tiles, tileLayer, upperTileLayer, overlayLayer, gridGraphics } = cullScene();
    renderEditScene({
      scene,
      tileLayer,
      upperTileLayer,
      overlayLayer,
      gridGraphics,
      mapId: map.id,
      tileIndex: new Map(),
    });
    // 컬링을 적용해 타일을 숨긴다.
    syncTileCulling(scene, { x: 1000, y: 1000, width: 320, height: 240 });
    expect(tiles.every((t) => !t.visible)).toBe(true);

    // reset 후 같은 host 로 다시 렌더하면 새 타일이 추적된다.
    resetCullableTiles(scene);
    const { tiles: freshTiles, tileLayer: freshTileLayer, upperTileLayer: freshUpperTileLayer, overlayLayer: freshOverlayLayer, gridGraphics: freshGridGraphics } = cullScene();
    // 같은 scene 객체를 쓰되 freshTileLayer 가 새 타일을 받도록 한다.
    renderEditScene({
      scene,
      tileLayer: freshTileLayer,
      upperTileLayer: freshUpperTileLayer,
      overlayLayer: freshOverlayLayer,
      gridGraphics: freshGridGraphics,
      mapId: map.id,
      tileIndex: new Map(),
    });

    // reset 덕분에 새 타일은 visible=true 로 시작하고, 이전 tiles 는 건드리지 않는다.
    expect(freshTiles.every((t) => t.visible)).toBe(true);
    // 이전 tiles 는 여전히 숨겨진 채 — reset 이 추적을 비웠으니 syncTileCulling 이 안 건드린다.
    expect(tiles.every((t) => !t.visible)).toBe(true);

    // 같은 host 에 대해 컬링을 적용하면 freshTiles 만 반응한다.
    syncTileCulling(scene, { x: 1000, y: 1000, width: 320, height: 240 });
    expect(freshTiles.every((t) => !t.visible)).toBe(true);
    // 이전 tiles 의 setVisibleCalls 는 그대로 — reset 후 더 이상 추적되지 않는다.
    expect(tiles.every((t) => t.setVisibleCalls === 1)).toBe(true);
  });

  it("증분 렌더 후에도 화면 밖 새 타일이 컬링된다", () => {
    // 회귀 테스트: renderEditSceneTileCells 가 새 타일을 visible=true 로 만든 뒤,
    // 카메라가 안 움직이면 sameWindow early-out 으로 컬링이 안 걸린다.
    // invalidateCullingWindow 가 applied 창을 버려 다음 syncTileCulling 이 재계산한다.
    // 이 테스트는 fix 가 없으면 실패해야 한다 — 화면 밖 새 타일이 visible=true 로 남는다.
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.width = 64;
    map.height = 64;
    map.lowerTiles = new Array<number>(64 * 64).fill(-1);
    map.upperTiles = new Array<number>(64 * 64).fill(-1);
    store.replace(project);
    editorState.set({ currentMapId: map.id, layer: "lower", tool: "paint", showGrid: false });

    const { scene, tiles, tileLayer, upperTileLayer, overlayLayer, gridGraphics } = cullScene();
    const tileIndex: EditSceneTileIndex = new Map();
    renderEditScene({
      scene,
      tileLayer,
      upperTileLayer,
      overlayLayer,
      gridGraphics,
      mapId: map.id,
      tileIndex,
    });

    // 화면을 (0,0) 에 고정하고 컬링 적용 — 화면 밖 타일이 숨겨진다.
    const viewport = { x: 0, y: 0, width: 320, height: 240 };
    syncTileCulling(scene, viewport);
    // 컬링 마진이 2타일(32px) 이므로 pixel x > 352 (타일 22 이후) 는 확실히 화면 밖.
    const offscreenBefore = tiles.filter((t) => t.x > 352);
    expect(offscreenBefore.length).toBeGreaterThan(0);
    expect(offscreenBefore.every((t) => !t.visible)).toBe(true);

    // 증분 렌더 — 화면 밖 먼 셀(60,60)을 칠한다. 8방 이웃도 재렌더된다.
    renderEditSceneTileCells(
      { scene, tileLayer, upperTileLayer, overlayLayer, gridGraphics, mapId: map.id, tileIndex },
      [{ x: 60, y: 60, layer: "lower" }],
    );

    // 새 타일이 만들어졌다 — (60,60) 근처 픽셀 좌표 960 근처.
    const newTilesNearPaint = tiles.filter((t) => t.x >= 940 && t.x <= 980 && t.y >= 940 && t.y <= 980);
    expect(newTilesNearPaint.length).toBeGreaterThan(0);
    // 아직 컬링이 안 걸려서 새 타일은 보인다.
    expect(newTilesNearPaint.every((t) => t.visible)).toBe(true);

    // invalidateCullingWindow 덕분에 sameWindow early-out 없이 재계산한다.
    syncTileCulling(scene, viewport);

    // 핵심 검증: 화면 밖 새 타일이 숨겨졌다. fix 가 없으면 visible=true 로 남는다.
    const offscreenAfter = tiles.filter((t) => t.x > 352);
    expect(offscreenAfter.every((t) => !t.visible)).toBe(true);
  });
});
