import { LAKE_PLACE_REFERENCES, regionReference } from "./regionReferences";
import type { GameMap, TilesetDef } from "./types";
import { cropExtraLayers } from "./mapLayers";

type SnapshotMap = {
  width: number;
  height: number;
  tileSize?: number;
  tilesetId: string;
  lowerTiles: number[];
  upperTiles: number[];
  events?: GameMap["events"];
};
type Scene = { map: SnapshotMap; tileset: TilesetDef };
type Loader = () => Promise<Scene>;

const scene = (load: () => Promise<{ default: unknown }>): Loader => async () => (await load()).default as Scene;

const LOADERS: Record<string, Loader> = {
  "emerald-basin-80x64": scene(() => import("./regionReferences/emerald-basin.json")),
  "hill-forest-village-64x64": scene(() => import("./regionReferences/hill-forest-village.json")),
  "river-fortress-160x144": scene(() => import("./regionReferences/river-fortress.json")),
  "castle-courtyard": scene(() => import("./regionReferences/castle-courtyard.json")),
  "castle-small-harbor": scene(() => import("./regionReferences/castle-small-harbor.json")),
  "castle-stone-lodge": scene(() => import("./regionReferences/castle-stone-lodge.json")),
  "forest-cabin-40x30": scene(() => import("./regionReferences/forest-cabin.json")),
  "forest-star-64x56": scene(() => import("./regionReferences/forest-star.json")),
  "gubisup-80x72": scene(() => import("./regionReferences/gubisup.json")),
  "small-forest-village-80x72": scene(() => import("./regionReferences/small-forest-village.json")),
  "forest-cliff-village-80x72": scene(() => import("./regionReferences/forest-cliff-village.json")),
  "high-cliff-village-80x88": scene(() => import("./regionReferences/high-cliff-village.json")),
  "cliff-forest-bridge-80x72": scene(() => import("./regionReferences/cliff-forest-bridge.json")),
  "peaceful-forest-100x100": scene(() => import("./regionReferences/peaceful-forest.json")),
  "great-falls-100x100": scene(() => import("./regionReferences/great-falls.json")),
  "rebuilt-forest-village-64x64": scene(() => import("./regionReferences/rebuilt-forest-village.json")),
  "harmony-hill-village-64x64": scene(() => import("./regionReferences/harmony-hill-village.json")),
  "hill-forest-cave-20x16": scene(() => import("./regionReferences/hill-forest-cave.json")),
  "rebuilt-forest-cave-20x16": scene(() => import("./regionReferences/rebuilt-forest-cave.json")),
  "organic-crescent-lake-80x72": scene(() => import("./regionReferences/organic-crescent-lake.json")),
  "organic-fork-stream-80x72": scene(() => import("./regionReferences/organic-fork-stream.json")),
  "organic-terrace-gardens-80x72": scene(() => import("./regionReferences/organic-terrace-gardens.json")),
  "organic-woodland-lane-80x72": scene(() => import("./regionReferences/organic-woodland-lane.json")),
  "organic-orchard-court-80x72": scene(() => import("./regionReferences/organic-orchard-court.json")),
  "organic-fishing-cove-80x72": scene(() => import("./regionReferences/organic-fishing-cove.json")),
  "organic-five-groves-80x72": scene(() => import("./regionReferences/organic-five-groves.json")),
};

const SHIP_MAP: Record<string, string> = {
  "bluewave-ship": "map_bluewave_ship",
  "giant-ship": "map_bluewave_giant",
  "wide-ship": "map_bluewave_vertical",
  "bluewave-harbor": "map_bluewave_harbor",
};

function crop(scene: Scene, x: number, y: number, width: number, height: number): Scene {
  const take = (tiles: number[]) => Array.from({ length: height }, (_, row) => tiles.slice((y + row) * scene.map.width + x, (y + row) * scene.map.width + x + width)).flat();
  const map: GameMap = { ...scene.map, width, height, lowerTiles: take(scene.map.lowerTiles), upperTiles: take(scene.map.upperTiles), events: [] };
  cropExtraLayers(map, scene.map.width, scene.map.height, x, y, width, height);
  return { tileset: scene.tileset, map };
}

/** One shipped example. The gallery does not call this. */
export async function loadReferencePresetScene(id: string): Promise<Scene | null> {
  const reference = regionReference(id);
  if (!reference) return null;
  const lake = LAKE_PLACE_REFERENCES.find(place => place.id === id);
  if (lake) {
    const source = await scene(() => import("./regionReferences/lake-village.json"))();
    return crop(source, lake.x, lake.y, lake.width, lake.height);
  }
  const shipMapId = SHIP_MAP[id];
  if (shipMapId) {
    const ships = (await import("./regionReferences/ships.json")).default as {
      maps: Record<string, GameMap>;
      tilesets: Record<string, TilesetDef>;
    };
    const map = ships.maps[shipMapId];
    const tileset = map ? ships.tilesets[map.tilesetId] : undefined;
    return map && tileset ? { map, tileset } : null;
  }
  const load = LOADERS[id];
  return load ? load() : null;
}
