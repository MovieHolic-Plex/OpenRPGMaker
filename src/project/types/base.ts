export type MapId = string;
export type TilesetId = string;
export type FlagName = string;
export type ActorId = string;
export type ClassId = string;
export type SkillId = string;
export type ItemId = string;
export type CropId = string;
export type EquipmentId = string;
export type EnemyId = string;
export type TroopId = string;
export type StateId = string;
export type BattleAnimationId = string;
export type MonsterSpeciesId = string;
export type MonsterInstanceId = string;

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

export interface TileGroupSourceBlock {
  column: number;
  row: number;
  sourceRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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
  sourceBlocks?: TileGroupSourceBlock[];
  cellLayers?: ("lower" | "upper")[];
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
      | "repeatable_block"
      | "single"
      | "source_rect"
      | "vertical_expandable";
    minHeight?: number;
    minWidth?: number;
    blockHeight?: number;
    blockWidth?: number;
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

// 타일 이식(graft): 다른 번들 타일 그림판의 개별 타일을 이 타일셋의 특정 슬롯에 "부분 로딩"한다.
// - targetTile < count(원본): 기존 슬롯을 덮어쓴다(예: 밴 슬롯 재활용).
// - targetTile >= count(원본): 행 단위 확장 — count 를 tilesPerRow 배수로 늘리고
//   아틀라스가 세로로 자란다. 기존 타일 id 는 절대 변하지 않는다(넘버링 보존).
export interface TileGraft {
  targetTile: number;
  // 소스 타일 그림판의 번들 textureKey (예: "tex_easyrpg_chipset_retro_house").
  sourceChipset: string;
  sourceTile: number;
}

// "보이지 않는 하네스" 구조 킷(2026-07-19 v2 설계 §③④ 수직 슬라이스).
// 유저의 반복 붓질에서 감지·등록된 반복 단면 패턴 — 팔레트 스탬프의 데이터 원본.
// rows[r].tiles = 하위 레이어(단면 r행, 좌→우), rows[r].upperTiles = 상위 레이어(-1 = 비움).
export interface StructureKitRow {
  tiles: number[];
  upperTiles?: number[];
}

// 스탬프 출처 유니언(2026-07-20, 스탬프 3부작 선행과제): 붓질 학습 외에 내장 파라메트릭 킷.
export type StructureKitLearnedFrom = "user-paint" | "builtin-parametric";

export interface SectionStructureKitDef {
  id: string;
  kind: "section";
  name?: string;
  // 반복 단위 크기 — rows.length === height, rows[*].tiles.length === width.
  width: number;
  height: number;
  rows: StructureKitRow[];
  learnedFrom: StructureKitLearnedFrom;
  createdAt?: string;
}

/**
 * 파라메트릭 집 스탬프(2026-07-20, 3계층 사다리 '행렬→파라메트릭'의 상단).
 * 행렬이 아니라 시공 파라미터를 저장 — 찍는 순간 정본 houseKit(stampFootprintHouseKit)이 전개한다.
 * houseKitId는 editor 계층 HouseKitId 문자열(타입 순환 방지로 string 보관, 사용처에서 검증).
 */
export interface HouseStructureKitDef {
  id: string;
  kind: "house";
  name?: string;
  houseKitId: string;
  /** (0,0) 기준 상대 좌표 날개 목록 — 전개 시 origin에 평행이동. */
  wings: { x: number; y: number; w: number; h: number }[];
  stories?: 1 | 2 | 3;
  lowWall?: boolean;
  windows?: { spacing?: number } | false;
  /** 남쪽 벽 문 타일(116/146) 포함 여부. 기본 true. */
  door?: boolean;
  chimney?: boolean;
  learnedFrom: StructureKitLearnedFrom;
  createdAt?: string;
}

export type StructureKitDef = SectionStructureKitDef | HouseStructureKitDef;

/** Editor-facing chipset classification. Omitted legacy records are inferred conservatively. */
export type TilesetKind = "rpg2k" | "custom";

export interface TilesetDef {
  id: TilesetId;
  name: string;
  image: AssetRef;
  /** RPG 2000/2003 480-chip layout, or an arbitrary rectangular custom atlas. */
  kind?: TilesetKind;
  tileSize: number;
  tilesPerRow: number;
  count: number;
  passability: PassFlag[];
  priority: ("lower" | "upper")[];
  terrain: number[];
  // 타일 이식 목록. 렌더는 베이크(캔버스 합성)로 처리 — tileGrafts.ts / tilesetImage.ts 참고.
  tileGrafts?: TileGraft[];
  tileMeta?: TileAiMetadata[];
  tileGroups?: TileGroupMetadata[];
  palettePresets?: PalettePreset[];
  suppressedHarnessGroupIds?: string[];
  transparentColor?: string;
  // 범용 오토타일(지형 자동 연결) 그룹 정의. 없으면 내장 기본 그룹(흙길/모래)을 사용한다.
  autotileGroups?: AutotileGroup[];
  // 타일 애니메이션 스트립: baseTile 부터 가로로 frames 개 연속 프레임을 fps 로 재생.
  // (커스텀 타일셋 물 등 — 기본 칩셋의 CHIPSET_ANIMATION_STRIPS 상수를 데이터로 일반화)
  // TODO(렌더 연동): chipsetTileRender.ts / playSceneMapRuntime.ts 의 isDefaultTilesetTexture
  // 가드를 이 필드 기반으로 교체해야 실제 재생된다 — 현재는 데이터 모델+UI 까지만.
  animationStrips?: TilesetAnimationStrip[];
  // v3 시공 문법 프로파일(2026-07-07). 생략 시 "rm-type"(RM2003 combined_town 규약).
  // 프리미티브 전개는 프로파일 레지스트리(grammarProfiles.ts) 디스패치.
  grammarProfile?: string;
  // 유저 붓질에서 학습된 구조 킷(조용한 제안 → [등록]). 직렬화 왕복에 안전하도록 optional.
  structureKits?: StructureKitDef[];
}

// 이웃 판정 범위: 4방향(상하좌우) 또는 8방향(대각 포함).
export type AutotileNeighborhood = 4 | 8;

// 타일셋 타일 애니메이션 스트립 정의(가로 연속 프레임). TilesetDef.animationStrips 참조.
export interface TilesetAnimationStrip {
  baseTile: number;
  frames: number;
  fps: number;
}

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
  attack?: string;
  skill?: string;
  item?: string;
  capture?: string;
  back?: string;
  target?: string;
  shopGreeting?: string;
  shopBuy?: string;
  shopSell?: string;
  shopCancel?: string;
  shopSellPrompt?: string;
  innTitle?: string;
  yes?: string;
  no?: string;
  notEnoughGold?: string;
  gold?: string;
  goldPrefix?: string;
  level?: string;
  hp?: string;
  mp?: string;
}

export const SCHEMA_VERSION = 3 as const;
