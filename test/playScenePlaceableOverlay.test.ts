/**
 * 설치물(바위·나무)이 **화면에 그려지는지** 본다.
 *
 * 곡괭이 채굴 경로(`tryPlaceableToolHarvest`)는 이미 있었지만 렌더 경로가 없었다 —
 * 저작한 돌은 캘 수는 있어도 보이지 않았다. 밭 오버레이는 `farmPlots` 가 있는 맵에서만
 * 도므로 광산처럼 밭이 없는 맵은 그 경로로 절대 그려지지 않는다.
 *
 * Task81: raw `kind: "tree"` 도 세션 오버레이로 그려져야 하며, 실제 칩셋 나무 타일
 * (`TILE.TREE` on combined_town)을 쓰고, 맵 타일/`lowerTiles` 에 새기면 안 된다.
 */
/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from "vitest";
import { findBundledImageAsset, TILE_SIZE } from "@/assets/bundled";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import {
  characterDepth,
  characterSpriteX,
  characterSpriteY,
} from "@/player/characterDepth";
import {
  PLACEABLE_TREE_GRAPHIC,
  renderPlaceableOverlays,
  resolvePlaceableOverlayGraphic,
} from "@/player/playScenePlaceables";
import { COMBINED_TOWN_TILESET_TEXTURE_KEY, TILE } from "@/project/defaults/constants";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import type { PlaceableObjectState } from "@/project/placeables";
import { placeableKey } from "@/project/placeables";
import { store } from "@/project/store";

type Call = { readonly kind: "sprite" | "rectangle"; readonly args: readonly unknown[] };

type StubSprite = {
  readonly origins: Array<readonly [number, number]>;
  readonly depths: number[];
  setOrigin(x: number, y: number): void;
  setDepth(depth: number): void;
};

const MINE_MAP_ID = "map_mine_1f";
const FARM_MAP_ID = "map_farming_demo";
const ROCK_FRAME = charsetFrameIndex({ characterIndex: 5, direction: "down", pattern: 1 });

function createStubScene(placeables: Record<string, PlaceableObjectState>, mapId = MINE_MAP_ID) {
  const calls: Call[] = [];
  const added: StubSprite[] = [];
  const object = (): StubSprite => {
    const sprite: StubSprite = {
      origins: [],
      depths: [],
      setOrigin(x: number, y: number) {
        sprite.origins.push([x, y]);
      },
      setDepth(depth: number) {
        sprite.depths.push(depth);
      },
    };
    return sprite;
  };
  const map = store.getCurrent().maps[mapId];
  return {
    calls,
    added,
    map: { id: mapId, width: map?.width, height: map?.height, tilesetId: map?.tilesetId },
    session: { placeables },
    tileLayer: { add: (o: StubSprite) => added.push(o) },
    add: {
      sprite: (...args: unknown[]) => (calls.push({ kind: "sprite", args }), object()),
      rectangle: (...args: unknown[]) => (calls.push({ kind: "rectangle", args }), object()),
    },
  };
}

const render = (scene: ReturnType<typeof createStubScene>): void => {
  renderPlaceableOverlays(scene as unknown as Parameters<typeof renderPlaceableOverlays>[0]);
};

function rock(id: string, x: number, y: number, mapId = MINE_MAP_ID): PlaceableObjectState {
  return { id, mapId, x, y, kind: "rock", itemId: "item_stone" };
}

function tree(id: string, x: number, y: number, mapId = FARM_MAP_ID): PlaceableObjectState {
  return { id, mapId, x, y, kind: "tree", itemId: "item_wood" };
}

function spriteArgs(scene: ReturnType<typeof createStubScene>): readonly (readonly unknown[])[] {
  return scene.calls.filter((call) => call.kind === "sprite").map((call) => call.args);
}

describe("renderPlaceableOverlays", () => {
  beforeEach(() => {
    store.replaceProject(createFarmingDemoProject());
  });

  it("draws each rock on the current map as one sprite", () => {
    const scene = createStubScene({
      "map_mine_1f:4,6": rock("r1", 4, 6),
      "map_mine_1f:6,7": rock("r2", 6, 7),
    });
    render(scene);

    expect(scene.calls.filter((call) => call.kind === "sprite")).toHaveLength(2);
    expect(scene.added).toHaveLength(2);
  });

  it("draws only the current map's placeables", () => {
    const scene = createStubScene({
      "map_mine_1f:4,6": rock("r1", 4, 6),
      "map_farming_demo:5,5": rock("r2", 5, 5, "map_farming_demo"),
    });
    render(scene);

    expect(scene.added).toHaveLength(1);
  });

  /** 상자는 이벤트로 저작하는 관행이라, 그래픽 없는 종류에 사각형을 얹으면 유령 상자가 겹친다. */
  it("skips kinds without a bundled graphic instead of drawing a placeholder", () => {
    const scene = createStubScene({
      "map_mine_1f:4,6": { id: "c1", mapId: MINE_MAP_ID, x: 4, y: 6, kind: "chest" },
    });
    render(scene);

    expect(scene.calls).toHaveLength(0);
    expect(scene.added).toHaveLength(0);
  });

  it("skips placeables left outside the map after it shrank", () => {
    const scene = createStubScene({
      "map_mine_1f:4,6": rock("r1", 4, 6),
      "map_mine_1f:99,99": rock("r2", 99, 99),
    });
    render(scene);

    expect(scene.added).toHaveLength(1);
  });

  /** 데모 광산의 돌이 실제로 그려져야 한다 — 저작과 렌더가 같은 좌표계를 쓰는지 확인. */
  it("draws every authored rock of the shipped mine demo", () => {
    const authored = store.getCurrent().session.placeables ?? {};
    const rocks = Object.values(authored).filter((p) => p.kind === "rock");
    expect(rocks.length).toBeGreaterThanOrEqual(2);

    const scene = createStubScene(authored);
    render(scene);
    expect(scene.added).toHaveLength(rocks.length);
  });

  it("resolves the bundled combined-town TREE tile as the tree placeable graphic", () => {
    expect(PLACEABLE_TREE_GRAPHIC.texture).toBe(COMBINED_TOWN_TILESET_TEXTURE_KEY);
    expect(PLACEABLE_TREE_GRAPHIC.frame).toBe(`tile_${TILE.TREE}`);
    expect(TILE.TREE).toBe(290);
    expect(findBundledImageAsset(PLACEABLE_TREE_GRAPHIC.texture)?.path).toBe(
      "assets/easyrpg-chipset-combined-town-transparent.png"
    );
    expect(resolvePlaceableOverlayGraphic("tree")).toEqual({
      texture: PLACEABLE_TREE_GRAPHIC.texture,
      frame: PLACEABLE_TREE_GRAPHIC.frame,
    });
    // rock/gem stay on Object2 charset — never remap tree onto those markers.
    expect(resolvePlaceableOverlayGraphic("rock")).toEqual({
      texture: "tex_easyrpg_charset_object2",
      frame: ROCK_FRAME,
    });
    expect(resolvePlaceableOverlayGraphic("gem")?.texture).toBe("tex_easyrpg_charset_object2");
    expect(resolvePlaceableOverlayGraphic("chest")).toBeNull();
  });

  it("draws the authored farming starter tree at its map tile with tree texture, anchor, and depth", () => {
    const authored = store.getCurrent().session.placeables ?? {};
    const starter = authored[placeableKey(FARM_MAP_ID, 6, 11)];
    expect(starter).toMatchObject({ kind: "tree", x: 6, y: 11, itemId: "item_wood" });

    const scene = createStubScene(authored, FARM_MAP_ID);
    const before = structuredClone(scene.session.placeables);
    render(scene);

    const worldX = characterSpriteX(6);
    const worldY = characterSpriteY(11);
    const treeSprites = spriteArgs(scene).filter(
      (args) => args[0] === worldX && args[1] === worldY
    );
    expect(treeSprites).toHaveLength(1);
    expect(treeSprites[0]).toEqual([
      worldX,
      worldY,
      PLACEABLE_TREE_GRAPHIC.texture,
      PLACEABLE_TREE_GRAPHIC.frame,
    ]);
    // Must not borrow the rock/gem charset marker.
    expect(treeSprites[0]?.[2]).not.toBe("tex_easyrpg_charset_object2");

    const drawn = scene.added[scene.added.length - 1];
    expect(drawn?.origins).toEqual([[0.5, 1]]);
    expect(drawn?.depths).toEqual([characterDepth("same", worldY)]);
    expect(worldX).toBe(6 * TILE_SIZE + TILE_SIZE / 2);
    expect(worldY).toBe(11 * TILE_SIZE + TILE_SIZE);

    // Render is a pure overlay pass — session placeables stay untouched.
    expect(scene.session.placeables).toEqual(before);
    expect(store.getCurrent().maps[FARM_MAP_ID]?.lowerTiles).toEqual(
      createFarmingDemoProject().maps[FARM_MAP_ID]?.lowerTiles
    );
  });

  it("stops drawing a tree after the real chop removes it from the session", () => {
    const authored = { ...(store.getCurrent().session.placeables ?? {}) };
    const key = placeableKey(FARM_MAP_ID, 6, 11);
    expect(authored[key]?.kind).toBe("tree");

    const standing = createStubScene(authored, FARM_MAP_ID);
    render(standing);
    expect(spriteArgs(standing).some((args) => args[3] === PLACEABLE_TREE_GRAPHIC.frame)).toBe(true);

    const chopped = { ...authored };
    delete chopped[key];
    const after = createStubScene(chopped, FARM_MAP_ID);
    render(after);
    expect(spriteArgs(after).some((args) => args[3] === PLACEABLE_TREE_GRAPHIC.frame)).toBe(false);
    expect(after.added).toHaveLength(0);
  });

  it("skips trees outside the current map bounds and keeps rock drawing unchanged beside trees", () => {
    const scene = createStubScene(
      {
        [placeableKey(FARM_MAP_ID, 6, 11)]: tree("t1", 6, 11),
        [placeableKey(FARM_MAP_ID, 99, 99)]: tree("t2", 99, 99),
        [placeableKey(FARM_MAP_ID, 4, 6)]: rock("r1", 4, 6, FARM_MAP_ID),
      },
      FARM_MAP_ID
    );
    render(scene);

    const sprites = spriteArgs(scene);
    expect(sprites).toHaveLength(2);
    expect(sprites.some((args) => args[2] === PLACEABLE_TREE_GRAPHIC.texture && args[3] === PLACEABLE_TREE_GRAPHIC.frame)).toBe(true);
    expect(sprites.some((args) => args[2] === "tex_easyrpg_charset_object2" && args[3] === ROCK_FRAME)).toBe(true);
    expect(sprites.every((args) => args[0] !== characterSpriteX(99))).toBe(true);
  });
});
