export type MapId = string;
export type TilesetId = string;
export type FlagName = string;
export type ActorId = string;
export type ClassId = string;
export type SkillId = string;
export type ItemId = string;
export type EquipmentId = string;
export type EnemyId = string;
export type TroopId = string;
export type StateId = string;
export type BattleAnimationId = string;

export type Dir = "down" | "left" | "right" | "up";

export interface AssetRef {
  type: "bundled" | "uploaded";
  id: string;
}

export type ResourceKind =
  | "chipset"
  | "charset"
  | "battle"
  | "battleCharset"
  | "battleWeapon"
  | "backdrop"
  | "gameOver"
  | "monster"
  | "faceset"
  | "picture"
  | "system"
  | "system2"
  | "title"
  | "music"
  | "sound";

export interface ResourceProfile {
  kind: ResourceKind;
  name: string;
  tileWidth?: number;
  tileHeight?: number;
  imageWidth?: number;
  imageHeight?: number;
  assetId?: string;
}

export interface PassFlag {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface TileAiMetadata {
  label: string;
  description: string;
  role?: string;
  repeatability?: "auto" | "center" | "fixed" | "repeat";
  defaultLayer?: TileGroupLayer;
  terrainTag?: number;
  passage?: "passable" | "solid" | "star";
  confidence?: "high" | "low" | "medium";
  source?: TileMetadataSource;
  userLocked?: boolean;
}

export type TileMetadataSource = "ai" | "bundled-default" | "imported" | "unknown" | "user";

export type TileGroupRole = "building" | "castle" | "fence" | "roof" | "terrain" | "water" | "wall" | "prop";

export type TileGroupLayer = "lower" | "upper" | "event" | "mixed";

export interface TileGroupMetadata {
  id: string;
  name: string;
  role: TileGroupRole;
  defaultLayer: TileGroupLayer;
  tileIds: number[];
  description: string;
  placementRules: string;
  confidence?: "high" | "low" | "medium";
  sourceRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  previewMap?: {
    width: number;
    height: number;
    lowerTiles: number[];
    upperTiles: number[];
  };
  source?: TileMetadataSource;
  patternGrammar?: {
    axis?: "both" | "horizontal" | "vertical";
    kind:
      | "animated_terrain"
      | "autotile_3x3"
      | "event_required_object"
      | "horizontal_expandable"
      | "nine_slice_expandable"
      | "overlay_detail"
      | "single"
      | "source_rect"
      | "vertical_expandable";
    minHeight?: number;
    minWidth?: number;
    parts: {
      role:
        | "bottom"
        | "bottomCap"
        | "bottomLeft"
        | "bottomRight"
        | "center"
        | "left"
        | "leftCap"
        | "repeatBody"
        | "right"
        | "rightCap"
        | "top"
        | "topCap"
        | "topLeft"
        | "topRight";
      tileIds: number[];
    }[];
    preserveCaps: boolean;
    repeat: "body" | "center" | "source_order";
  };
}

export interface TilesetDef {
  id: TilesetId;
  name: string;
  image: AssetRef;
  tileSize: number;
  tilesPerRow: number;
  count: number;
  passability: PassFlag[];
  priority: ("lower" | "upper")[];
  terrain: number[];
  tileMeta?: TileAiMetadata[];
  tileGroups?: TileGroupMetadata[];
}

export interface SpriteDef {
  id: string;
  image: AssetRef;
  frames: number;
  frameWidth: number;
  frameHeight: number;
}

export interface UploadedAsset {
  id: string;
  name: string;
  kind: "tileset" | "sprite" | ResourceKind;
  dataUrl: string;
  meta: {
    tileSize?: number;
    frames?: number;
    frameWidth?: number;
    frameHeight?: number;
    width?: number;
    height?: number;
    transparentColor?: string;
  };
}

export interface AssetSet {
  sprites: Record<string, SpriteDef>;
  uploaded: Record<string, UploadedAsset>;
}

export interface SwitchDef {
  id: string;
  name: string;
}

export interface VariableDef {
  id: string;
  name: string;
}

export interface Terms {
  gold: string;
  level?: string;
  hp?: string;
  mp?: string;
  attack?: string;
  skill?: string;
  item?: string;
}

export const SCHEMA_VERSION = 3 as const;
