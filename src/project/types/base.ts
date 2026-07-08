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
export type BattlerAnimationId = string;

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
  // 검색용 커스텀 태그(맵 인터뷰/사용자 입력). list_resources(tile) 검색에 히트한다.
  tags?: string[];
  role?: string;
  repeatability?: "auto" | "center" | "fixed" | "repeat";
  defaultLayer?: TileGroupLayer;
  terrainTag?: number;
  passage?: "passable" | "solid" | "star";
  confidence?: number | "high" | "low" | "medium";
  origin?: "user" | "ai";
  locked?: boolean;
  source?: TileMetadataSource;
  userLocked?: boolean;
}

export type TileMetadataSource = "ai" | "bundled-default" | "imported" | "unknown" | "user";

export type TileGroupRole = "building" | "castle" | "fence" | "roof" | "terrain" | "water" | "wall" | "prop";

export type TileGroupLayer = "lower" | "upper" | "event" | "mixed";

export type LintSeverity = "error" | "info" | "warning";

export interface TileGroupJunctionRule {
  withRole: TileGroupRole;
  side: "below" | "above" | "leftOf" | "rightOf";
  action: "omit" | "replace";
  atRoles?: string[];
  replaceWith?: number[];
}

export interface TileGroupOverlayRule {
  when: "diagonalCorner" | "innerCorner" | "ridge" | "eaveEnd";
  tileIds: number[];
}

export type ClusterRuleStrength = "hard" | "medium" | "soft";

export interface ClusterRule {
  id: string;
  kind: "adjacency" | "spacing" | "count";
  strength: ClusterRuleStrength;
  params: Record<string, unknown>;
  message?: string;
}

export interface TileGroupMetadata {
  id: string;
  name: string;
  role: TileGroupRole;
  defaultLayer: TileGroupLayer;
  tileIds: number[];
  description: string;
  placementRules: string;
  // v3 승인 보캐뷸러리(2026-07-07, 원칙 0 Zero-Trust Perception): 사용자 명시 수락으로
  // 커밋될 때만 "user"가 된다. source와 달리 어떤 자동 경로도 이 값을 "user"로 만들지 않는다
  // (제로 부트스트랩). tileMeta.origin / PalettePreset.origin과 동일 규약.
  origin?: "user" | "ai";
  // 어휘의 속성인 홈 레이어 — 시공 프리미티브가 layer 인자 없이 결정론 배치할 때 소비.
  // perCell은 타일별(tileLayerHome) 판정. 생략 시 defaultLayer에서 유도한다.
  layerHome?: "lower" | "upper" | "perCell";
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
  junctions?: TileGroupJunctionRule[];
  overlays?: TileGroupOverlayRule[];
  rules?: ClusterRule[];
}

export type PaletteSlotRole =
  | "ground"
  | "path"
  | "wall"
  | "water"
  | "decor"
  | "boundary"
  | "roof"
  | "furniture";

export interface PaletteSlot {
  role: PaletteSlotRole;
  tileIds: number[];
  weight?: number;
}

export interface PalettePreset {
  id: string;
  name: string;
  slots: PaletteSlot[];
  origin: "user" | "ai";
  locked?: boolean;
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
  palettePresets?: PalettePreset[];
  suppressedHarnessGroupIds?: string[];
  transparentColor?: string;
  // 범용 오토타일(지형 자동 연결) 그룹 정의. 없으면 내장 기본 그룹(흙길/모래)을 사용한다.
  autotileGroups?: AutotileGroup[];
  // v3 시공 문법 프로파일(2026-07-07). 생략 시 "rm-type"(RM2003 combined_town 규약).
  // 프리미티브 전개는 프로파일 레지스트리(grammarProfiles.ts) 디스패치.
  grammarProfile?: string;
}

// 이웃 판정 범위: 4방향(상하좌우) 또는 8방향(대각 포함).
export type AutotileNeighborhood = 4 | 8;

// 하나의 지형 패밀리를 이웃 연결 상태에 따라 자동으로 변형 타일로 바꾸는 정의.
export interface AutotileGroup {
  id: string;
  name: string;
  // 이웃 판정 범위. 생략 시 4방향.
  neighborhood?: AutotileNeighborhood;
  // 이 그룹에 속하여 자동 변형 대상이 되는 타일 인덱스 목록.
  memberTileIds: number[];
  // 연결된 이웃으로 간주할 타일 목록. 생략 시 memberTileIds 사용(예: 모래는 물까지 포함).
  connectTileIds?: number[];
  // 이 타일을 편집(칠/채우기/지우기)했을 때 그룹 재계산을 유발하는 타일 목록.
  // 생략 시 connectTileIds ?? memberTileIds 사용.
  triggerTileIds?: number[];
  // 이웃 비트마스크(10진수 문자열) → 배치할 타일 인덱스 매핑.
  variantMap: Record<string, number>;
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
