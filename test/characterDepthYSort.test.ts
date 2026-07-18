import { describe, expect, it } from "vitest";
import {
  characterDepth,
  characterSpriteY,
  isAlwaysAboveCharacterUpperTile,
  mapUpperTileDepth,
  MAP_UPPER_LAYER_DEPTH,
} from "@/player/characterDepth";
import { createBlankProject, TILE } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { renderTiles } from "@/player/playSceneMapRuntime";
import { mockSprite, mockTileImage, type MockTileImage } from "./runtimeEventPageFixtures";

describe("map upper tile depth (furniture y-sort vs ★ canopy)", () => {
  it("keeps ★ canopy above same-priority characters and y-sorts solid upper furniture", () => {
    const project = createBlankProject();
    const tileset = project.tilesets[project.maps[project.startMapId].tilesetId];
    // 260 침엽수 수관 ★ / 234 가로 탁자 × (솔리드 upper)
    expect(passageMarkForTile(tileset, 260)).toBe("star");
    expect(passageMarkForTile(tileset, 234)).toBe("x");

    expect(isAlwaysAboveCharacterUpperTile(tileset, 260)).toBe(true);
    expect(isAlwaysAboveCharacterUpperTile(tileset, 234)).toBe(false);

    expect(mapUpperTileDepth(tileset, 260, 3)).toBe(MAP_UPPER_LAYER_DEPTH);

    const tableDepth = mapUpperTileDepth(tileset, 234, 3);
    const playerNorth = characterDepth("same", characterSpriteY(2));
    const playerSouth = characterDepth("same", characterSpriteY(4));
    expect(tableDepth).toBe(characterDepth("same", characterSpriteY(3)));
    // 북쪽에서 보면 탁자가 위, 남쪽(앞)에서는 캐릭터가 위.
    expect(tableDepth).toBeGreaterThan(playerNorth);
    expect(playerSouth).toBeGreaterThan(tableDepth);
  });

  it("routes solid upper furniture to root (y-sort) and ★ canopy to upperTileLayer", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.lowerTiles.fill(TILE.GRASS);
    map.upperTiles.fill(-1);
    map.upperTiles[2 * map.width + 2] = 234; // solid table
    map.upperTiles[1 * map.width + 1] = 260; // tree canopy ★
    store.replace(project);

    const lowerKids: MockTileImage[] = [];
    const upperKids: MockTileImage[] = [];
    const rootKids: MockTileImage[] = [];
    const scene = {
      map,
      session: startSession(project),
      eventPositions: {},
      tileLayer: {
        removeAll: () => undefined,
        add: (image: unknown) => {
          lowerKids.push(image as MockTileImage);
        },
      },
      upperTileLayer: {
        removeAll: () => undefined,
        add: (image: unknown) => {
          upperKids.push(image as MockTileImage);
        },
      },
      eventSprites: new Map(),
      runtimeDom: {
        clearEventMarkers: () => undefined,
        upsertEventMarker: () => undefined,
        syncMissingResourceError: () => undefined,
      },
      missingResources: new Set<string>(),
      add: {
        image: (x: number, y: number) => {
          const img = mockTileImage();
          img.x = x;
          img.y = y;
          rootKids.push(img);
          return img;
        },
        sprite: (x: number, y: number) => {
          const sprite = mockSprite(x, y);
          rootKids.push(sprite);
          return sprite;
        },
      },
      runEvent: async () => undefined,
      syncRuntimeState: () => undefined,
    };

    renderTiles(scene);

    const canopy = upperKids.find((img) => img.depth === MAP_UPPER_LAYER_DEPTH);
    expect(canopy).toBeTruthy();

    const tableDepth = characterDepth("same", characterSpriteY(2));
    const table = rootKids.find((img) => img.depth === tableDepth);
    expect(table).toBeTruthy();
    expect(upperKids.some((img) => img.depth === tableDepth)).toBe(false);
  });
});
