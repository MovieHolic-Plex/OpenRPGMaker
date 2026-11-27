import type {
  AutotileGroup,
  PassFlag,
  StructureKitDef,
  TileAiMetadata,
  TileGroupMetadata,
  TilesetDef,
} from "../project/types";

// Shared structural type for large baked bundled tileset JSON files.
// Bound JSON type inference in tsc (prevents inferring millions of literal types from 60MB+ JSON).
export interface BundledTilesetJson {
  id: string;
  name: string;
  image?: string;
  family?: string;
  textureKey?: string;
  tileSize: number;
  tilesPerRow: number;
  count: number;
  baseCount?: number;
  libraryEnd?: number;
  passability: (PassFlag | null)[];
  priority: ("lower" | "upper")[];
  terrain: number[];
  tileMeta: TileAiMetadata[];
  tileGroups: TileGroupMetadata[];
  structureKits: StructureKitDef[];
  autotileGroups: AutotileGroup[];
  animationStrips: NonNullable<TilesetDef["animationStrips"]>;
  slideTiles?: TilesetDef["slideTiles"];
  [key: string]: unknown;
}
