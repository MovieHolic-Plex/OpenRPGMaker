import diverse0 from "./regionReferences/pine-hamlets.json";
import diverse1 from "./regionReferences/terrace-cliff-village.json";
import diverse2 from "./regionReferences/reed-bay-village.json";
import diverse3 from "./regionReferences/twin-falls-river-village.json";
import diverse4 from "./regionReferences/chapel-hill-parish.json";
import diverse5 from "./regionReferences/ford-castle-town.json";
import diverse6 from "./regionReferences/mistpond-hollow.json";
import { DIVERSE_VILLAGE_PLACES } from "./diverseVillageReferences";
import fantasyPlaces from "./regionReferences/fantasy-places.json";
import { FANTASY_PLACE_REFERENCES } from "./fantasyPlaceReferences";
import climateVillages from "./regionReferences/climate-villages.json";
import { CLIMATE_VILLAGE_PLACE_REFERENCES } from "./climateVillagePlaceReferences";
import type { GameMap, TilesetDef, UploadedAsset } from "./types";
import { LAKE_PLACE_REFERENCES, regionReference } from "./regionReferences";
import courtyard from "./regionReferences/castle-courtyard.json";
import harbor from "./regionReferences/castle-small-harbor.json";
import lodge from "./regionReferences/castle-stone-lodge.json";
import fortress from "./regionReferences/river-fortress.json";
import emeraldSnapshot from "./regionReferences/emerald-basin.json";
import hillForestSnapshot from "./regionReferences/hill-forest-village.json";
import walledSnapshot from "./regionReferences/walled-settlement.json";
import lakeSnapshot from "./regionReferences/lake-village.json";
import riverForestSnapshot from "./regionReferences/river-forest-village.json";
import castleSnapshot from "./regionReferences/castle-town.json";
import ships from "./regionReferences/ships.json";
import organic0 from "./regionReferences/organic-crescent-lake.json";
import organic1 from "./regionReferences/organic-fork-stream.json";
import organic2 from "./regionReferences/organic-terrace-gardens.json";
import organic3 from "./regionReferences/organic-woodland-lane.json";
import organic4 from "./regionReferences/organic-orchard-court.json";
import organic5 from "./regionReferences/organic-fishing-cove.json";
import organic6 from "./regionReferences/organic-five-groves.json";
import forest0 from "./regionReferences/forest-cabin.json";
import forest1 from "./regionReferences/forest-star.json";
import forest2 from "./regionReferences/gubisup.json";
import forest3 from "./regionReferences/small-forest-village.json";
import forest4 from "./regionReferences/forest-cliff-village.json";
import forest5 from "./regionReferences/high-cliff-village.json";
import forest6 from "./regionReferences/cliff-forest-bridge.json";
import forest7 from "./regionReferences/peaceful-forest.json";
import forest8 from "./regionReferences/great-falls.json";
import forest9 from "./regionReferences/rebuilt-forest-village.json";
import forest10 from "./regionReferences/harmony-hill-village.json";
import forest11 from "./regionReferences/hill-forest-cave.json";
import forest12 from "./regionReferences/rebuilt-forest-cave.json";

type PlaceSnapshot = { map: GameMap; tileset: TilesetDef };

const castleSnapshots: Record<string, PlaceSnapshot> = {
  "river-fortress-160x144": fortress as unknown as PlaceSnapshot,
  "castle-courtyard": courtyard as unknown as PlaceSnapshot,
  "castle-small-harbor": harbor as unknown as PlaceSnapshot,
  "castle-stone-lodge": lodge as unknown as PlaceSnapshot,
};

const forestSnapshots: Record<string, PlaceSnapshot> = {
  "forest-cabin-40x30": forest0 as unknown as PlaceSnapshot,
  "forest-star-64x56": forest1 as unknown as PlaceSnapshot,
  "gubisup-80x72": forest2 as unknown as PlaceSnapshot,
  "small-forest-village-80x72": forest3 as unknown as PlaceSnapshot,
  "forest-cliff-village-80x72": forest4 as unknown as PlaceSnapshot,
  "high-cliff-village-80x88": forest5 as unknown as PlaceSnapshot,
  "cliff-forest-bridge-80x72": forest6 as unknown as PlaceSnapshot,
  "peaceful-forest-100x100": forest7 as unknown as PlaceSnapshot,
  "great-falls-100x100": forest8 as unknown as PlaceSnapshot,
  "rebuilt-forest-village-64x64": forest9 as unknown as PlaceSnapshot,
  "harmony-hill-village-64x64": forest10 as unknown as PlaceSnapshot,
  "hill-forest-cave-20x16": forest11 as unknown as PlaceSnapshot,
  "rebuilt-forest-cave-20x16": forest12 as unknown as PlaceSnapshot,
  "organic-crescent-lake-80x72": organic0 as unknown as PlaceSnapshot,
  "organic-fork-stream-80x72": organic1 as unknown as PlaceSnapshot,
  "organic-terrace-gardens-80x72": organic2 as unknown as PlaceSnapshot,
  "organic-woodland-lane-80x72": organic3 as unknown as PlaceSnapshot,
  "organic-orchard-court-80x72": organic4 as unknown as PlaceSnapshot,
  "organic-fishing-cove-80x72": organic5 as unknown as PlaceSnapshot,
  "organic-five-groves-80x72": organic6 as unknown as PlaceSnapshot,
};

const regionSnapshots: Record<string, PlaceSnapshot> = {
  "pine-hamlets-80x64": diverse0 as unknown as PlaceSnapshot,
  "terrace-cliff-village-88x72": diverse1 as unknown as PlaceSnapshot,
  "reed-bay-village-88x64": diverse2 as unknown as PlaceSnapshot,
  "twin-falls-river-village-88x72": diverse3 as unknown as PlaceSnapshot,
  "chapel-hill-parish-80x64": diverse4 as unknown as PlaceSnapshot,
  "ford-castle-town-100x92": diverse5 as unknown as PlaceSnapshot,
  "mistpond-hollow-80x64": diverse6 as unknown as PlaceSnapshot,

  "river-forest-village-78x44": riverForestSnapshot as unknown as PlaceSnapshot,
  "emerald-basin-80x64": emeraldSnapshot as unknown as PlaceSnapshot,
  "hill-forest-village-64x64": hillForestSnapshot as unknown as PlaceSnapshot,
  "castle-town-100x100": castleSnapshot as unknown as PlaceSnapshot,
  "walled-settlement-43x45": walledSnapshot as unknown as PlaceSnapshot,
  "lake-village-60x60": lakeSnapshot as unknown as PlaceSnapshot,
};

const shipSource = ships as unknown as {
  maps: Record<string, GameMap>;
  tilesets: Record<string, TilesetDef>;
  assets: Record<string, UploadedAsset>;
};

function snapshotFor(id: string): PlaceSnapshot | undefined {
  if (castleSnapshots[id]) return castleSnapshots[id];
  if (forestSnapshots[id]) return forestSnapshots[id];
  if (regionSnapshots[id]) return regionSnapshots[id];
  // Place cards for the diverse villages reuse their region snapshot.
  const place = DIVERSE_VILLAGE_PLACES.find(entry => entry.id === id);
  if (place) return regionSnapshots[place.regionReferenceId];
  // Fantasy shops/castle rooms share one snapshot file; the entry names its map.
  const fantasy = FANTASY_PLACE_REFERENCES.find(entry => entry.id === id);
  if (fantasy) {
    const source = fantasyPlaces as unknown as { maps: Record<string, GameMap>; tilesets: Record<string, TilesetDef> };
    const map = source.maps[fantasy.sourceMapId]!;
    return { map, tileset: source.tilesets[map.tilesetId]! };
  }
  // Snow/volcano villages likewise share one snapshot file.
  const climate = CLIMATE_VILLAGE_PLACE_REFERENCES.find(entry => entry.id === id);
  if (climate) {
    const source = climateVillages as unknown as { maps: Record<string, GameMap>; tilesets: Record<string, TilesetDef> };
    const map = source.maps[climate.sourceMapId]!;
    return { map, tileset: source.tilesets[map.tilesetId]! };
  }
  const ship = shipSource.maps[
    id === "bluewave-ship" ? "map_bluewave_ship"
    : id === "giant-ship" ? "map_bluewave_giant"
    : id === "wide-ship" ? "map_bluewave_vertical"
    : id === "bluewave-harbor" ? "map_bluewave_harbor"
    : ""
  ];
  if (!ship) return undefined;
  return { map: ship, tileset: shipSource.tilesets[ship.tilesetId]! };
}

/** Bounded rows let AI recover the complete raster without truncating a single large response. */
export function readRegionReference(id: string, row = 0, rows = 8) {
  const reference = regionReference(id);
  if (!reference) throw new Error(`Unknown region reference: ${id}`);
  if (!Number.isInteger(row) || !Number.isInteger(rows) || row < 0 || row >= reference.height || rows < 1 || rows > 16) {
    throw new Error("row must be within the map; rows must be 1..16");
  }
  const place = LAKE_PLACE_REFERENCES.find(entry => entry.id === id);
  const source = snapshotFor(place ? "lake-village-60x60" : id);
  if (!source) throw new Error(`Unknown region reference: ${id}`);
  const crop = (tiles: number[]) => Array.from({ length: reference.height }, (_, y) => tiles.slice((y + (place?.y ?? 0)) * source.map.width + (place?.x ?? 0), (y + (place?.y ?? 0)) * source.map.width + (place?.x ?? 0) + reference.width)).flat();
  const selected = place ? { ...source, map: { ...source.map, width: place.width, height: place.height, lowerTiles: crop(source.map.lowerTiles), upperTiles: crop(source.map.upperTiles), events: [] } } : source;
  const endRow = Math.min(reference.height, row + rows);
  const { map, tileset } = selected;
  const lowerTiles = map.lowerTiles.slice(row * map.width, endRow * map.width);
  const upperTiles = map.upperTiles.slice(row * map.width, endRow * map.width);
  const used = [...new Set([...lowerTiles, ...upperTiles])].filter(tile => tile >= 0);
  return structuredClone({ ...reference, map: {
    id: map.id, width: map.width, height: map.height, tileSize: map.tileSize,
    tilesetId: map.tilesetId, row, rows: endRow - row, nextRow: endRow < map.height ? endRow : null,
    lowerTiles, upperTiles, events: map.events,
  }, tileset: { id: tileset.id, image: tileset.image, tileSize: tileset.tileSize, tilesPerRow: tileset.tilesPerRow,
    tiles: used.map(tile => ({ tile, passability: tileset.passability[tile], priority: tileset.priority[tile], terrain: tileset.terrain[tile] })),
  } });
}
