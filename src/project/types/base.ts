import type { ConceptBundleRecord } from "./conceptBundle";
import type { InteriorFurnitureSnap, InteriorRoomKindRecord } from "./interior";

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
  | "movie"
  | "system"
  | "system2"
  | "title"
  | "music"
  | "sound";

export type MonsterMetadata = {
  readonly name: string;
  readonly tags: readonly string[];
  readonly description: string;
};

/** Raw resource IDs; absent fields inherit bundled metadata. */
export type MonsterMetadataOverrides = Record<string, Partial<MonsterMetadata>>;

export type AudioResourceKind = "music" | "sound";

/** Raw resource IDs: absent key inherits; an empty string explicitly clears. */
export interface AudioDescriptionOverrides {
  readonly music?: Readonly<Record<string, string>>;
  readonly sound?: Readonly<Record<string, string>>;
}

export interface ResourceProfile {
  /** Authoring-only metadata; sprite slots and standalone faces are classified independently. */
  graphicAttributes?: import("../characterGraphics").GraphicAttributes;
  graphicNote?: string;
  characterSlots?: import("../characterGraphics").CharacterGraphicSlot[];
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
  // 하위에 그릴 때 투명 픽셀 아래에 함께 깔 타일. "none" 은 받침 없이 그대로 둔다.
  layerBacking?: "none" | number;
  terrainTag?: number;
  passage?: "passable" | "solid" | "star";
  confidence?: number | "high" | "low" | "medium";
  origin?: "user" | "ai";
  locked?: boolean;
  source?: TileMetadataSource;
  userLocked?: boolean;
}

export type TileMetadataSource = "ai" | "bundled-default" | "imported" | "unknown" | "user";

export interface CharsetLabelOverride {
  readonly textureKey: string;
  readonly characterIndex: number;
  readonly label: string;
  readonly tags?: readonly string[];
  readonly origin?: "user" | "ai";
}

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

/**
 * 배치 면(2026-08-30) — "이 물건은 어떤 자리에 놓이는가"를 **기계가 검사할 수 있게** 적은 것.
 *
 * 이 어휘가 생기기 전에는 같은 뜻이 세 군데에 흩어져 있었고 셋 다 집행되지 않았다:
 *  (a) `TileGroupMetadata.placementRules` / `StructureKitAiMeta.placementRules` 자유 문장 —
 *      AI 프롬프트에 100자로 잘려 들어가는 산문. 아무도 검사하지 않는다.
 *  (b) `interiorRoomPipeline.PROP_SURFACE` 상수표 — 실내 절차 생성 전용, 편집 UI 없음.
 *  (c) 「화덕은 북벽에 붙여 배치」 같은 **주석**과 그 뜻을 손으로 다시 구현한 절차 코드.
 * 이제 (a)는 사람이 읽는 설명, 이것은 기계가 읽는 조건이다. (b)는 이 어휘로 값을 갈아탔다.
 *
 * 판정 규약은 placementSurface.ts 한 곳에만 있다 — 여기 두면 타입 순환이 생긴다.
 */
export type PlacementZone =
  /** 아무 바닥이나 — 발밑이 통행 가능하면 통과. */
  | "anyFloor"
  /** 빈 땅 — 사각 **전체**가 통행 가능. 집처럼 큰 것이 벽·물 위에 겹치는 걸 막는다. */
  | "clearArea"
  /** 벽에서 떨어진 바닥 — 발밑이 바닥이고 네 방향 어느 쪽도 벽이 아니다. */
  | "openFloor"
  /** 벽에 붙은 바닥 — 발밑이 바닥이고 지정한 방향이 벽. `facing` 이 여기서만 뜻을 가진다. */
  | "againstWall"
  /** 구석 바닥 — 발밑이 바닥이고 세로 한 쪽 + 가로 한 쪽이 모두 벽. */
  | "corner"
  /** 벽면 — 발밑 자체가 벽. 창문·그림·아궁이처럼 벽에 매다는 것. */
  | "wallFace";

/** 방향. "any" 는 네 방향 중 아무거나 하나. */
export type PlacementFacing = "north" | "south" | "east" | "west" | "any";

/**
 * 구조물 킷 하나에 붙는 배치 조건.
 * hard = 어기면 **찍히지 않는다**(사람은 토스트로 이유를 본다, AI 는 ToolError).
 * soft = 찍히지만 경고를 남긴다.
 */
export interface PlacementSurfaceCondition {
  id: string;
  zone: PlacementZone;
  /** `againstWall` 에서만 뜻이 있다. 생략 = "any". */
  facing?: PlacementFacing;
  strength: "hard" | "soft";
  /** 사람에게 보일 한 줄. 없으면 zone·facing 으로 자동 생성한다. */
  message?: string;
}

export type ClusterRuleStrength = "hard" | "medium" | "soft";

export interface ClusterRule {
  id: string;
  /** surface: params 는 `{ zone: PlacementZone, facing?: PlacementFacing }`. */
  kind: "adjacency" | "spacing" | "count" | "surface";
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

// 스탬프 출처 유니언: 붓질 학습·DB 작성·실내 카탈로그.
// 이 값은 계보 표시 전용이다 — 편집 잠금은 앨범 엔트리의 source 로 판정한다(structureKitDbTab).
export type StructureKitLearnedFrom = "user-paint" | "db-authored" | "interior-catalog";

// 구조물 부위(2026-08, kit-parts 제안 §06·§07) — 타일을 바꾸지 않는 인스턴스 힌트.
// 좌표는 킷 원점 기준 상대(dx,dy) — 시공 시점에 origin을 더해 절대좌표가 된다.
// 입구의 워프 칸은 dy + h - 1 행이라는 규약으로 고정한다(별도 warpCell 필드 없음).
// 부위는 힌트일 뿐이다 — 시공은 이벤트를 심지 않고, 워프는 별 툴 콜이 절대좌표를 보고 만든다.
export type StructureKitPartKind = "entrance" | "sign" | "anchor" | "window";

export interface StructureKitPart {
  id: string;
  kind: StructureKitPartKind;
  dx: number;
  dy: number;
  w: number;
  h: number;
  note?: string;
}

/**
 * 무한 증분 축(2026-08-30) — 벽·울타리처럼 끝이 없는 구조물이 **어느 방향으로** 이어지는가.
 * 값 어휘는 `TileGroupMetadata.patternGrammar.axis` 와 같다 — AI 가 이미 그 단어를 읽고 있다.
 */
export type StructureGrowthAxis = "horizontal" | "vertical" | "both";

/**
 * 칸 하나에 붙는 힌트(2026-08-30).
 *
 * `parts` 가 사각 영역의 **역할**(입구·창문·간판·자리)을 적는다면 이쪽은 칸 하나의
 * **이어붙임 성질과 설명**을 적는다 — 「이 벽 몸통은 세로로 증분 가능」처럼. 둘을 한
 * 목록으로 합치지 않는 이유: 부위는 워프·간판 좌표를 만드는 인스턴스 힌트이고, 증분 축은
 * 시공 프리미티브가 반복 횟수를 정할 때 읽는 타일링 규칙이다. 소비자가 다르다.
 *
 * 좌표는 킷 원점 기준 상대(dx,dy). 타일을 바꾸지 않는 순수 메타다.
 */
export interface StructureKitCellHint {
  dx: number;
  dy: number;
  /** 이 칸을 그 축으로 무한히 이어도 그림이 성립하는가. */
  growth?: StructureGrowthAxis;
  /** 사람이 적는 한 줄 설명. AI 가 그대로 읽는다. */
  note?: string;
}

/**
 * 구조물의 AI 어휘 메타데이터(2026-08-28).
 * 필드명은 TileGroupMetadata / TileAiMetadata 와 의도적으로 같다 — AI 가 이미 그 단어들을 읽고 있다.
 * 구조물은 사람이 모양을 만들어 이름 붙이면 AI 가 그 이름으로 골라 시공하는 어휘이므로,
 * "이게 뭔지"와 "어디에 놓는지"가 없으면 AI 는 이름만 보고 추측할 수밖에 없다.
 */
export interface StructureKitAiMeta {
  /** 이게 무엇인지. TileGroupMetadata.description 과 같은 이름. */
  description: string;
  /** 어디에 어떻게 놓는지 — **사람이 읽는 문장**. TileGroupMetadata.placementRules 와 같은 이름. */
  placementRules: string;
  /**
   * 어디에 놓는지 — **기계가 검사하는 조건**(2026-08-30).
   * placementRules 는 프롬프트에 100자로 잘려 들어가는 산문이라 아무도 지키게 만들 수 없었다.
   * 이쪽은 찍는 순간 실제로 검사한다(사람 스탬프).
   * 비었거나 없으면 검사 없음 — 하위 호환.
   */
  placement?: PlacementSurfaceCondition[];
  /** 검색·매칭용. TileAiMetadata.tags 와 같은 이름. */
  tags?: string[];
  /** 분류. TileGroupRole enum 재사용. */
  role?: TileGroupRole;
  /**
   * 가로로 이어 찍어도 되는지. 팔레트 반복의 기본값이 3 이라,
   * 이 값이 없으면 우물·간판 같은 완결 구조물도 3개 이어 찍힌다.
   * TileAiMetadata 는 4값이지만 "center" 는 구조물에 뜻이 없어 2값으로 줄인다.
   * undefined 는 현재 동작(kind === "section" → 반복) 유지 — 하위 호환.
   */
  repeatability?: "repeat" | "fixed";
  /**
   * 무한 확장 축(2026-08-30) — `repeatability` 보다 정밀한 표현.
   * 그 두 값(repeat/fixed)은 **가로 전용**이라 「세로로만 이어지는 벽」을 적을 수 없었다.
   * 이 값이 있으면 이것이 정본이고, 없으면 repeatability → kind 순으로 떨어진다(하위 호환). 판정은 structureKitGrowthAxes.
   */
  growthAxis?: StructureGrowthAxis;
  /**
   * 홈 레이어 — 「이 구조물은 바닥에 깔리는가 덧그림인가」를 사람이 선언한다.
   * `TileGroupMetadata.layerHome` 과 이름·값이 같다. 없으면 실제 행렬에서 유도한다
   * (structureKitLayerHome) — 유도값과 선언값이 다를 수 있는 것이 요점이다: 사람은
   * 「덧그림으로 써야 하는 구조물」을 바닥 칸으로 그려 둘 수 있다.
   */
  layerHome?: "lower" | "upper" | "perCell";
  /**
   * 어울리는 테마. `InteriorRoomTheme` id(bedroom·tavern…)를 쓰면 실내 방 문법과 어휘가
   * 맞고, 자유 문자열("사막 마을")도 받는다 — AI 가 테마 요청을 이 목록과 맞춘다.
   * enum 으로 좁히지 않은 이유: 실내 7종은 방 채우기 전용 어휘이고 야외 구조물에는 뜻이 없다.
   */
  themes?: string[];
  /**
   * 실내 방 문법의 의미 역할(bed, stove, …). TileGroupRole 과 축이 달라 이름을 분리한다.
   * 있으면 이 킷은 실내 가구로 취급되고, 방 종류의 requiredRoles 와 맞춘다.
   */
  interiorRole?: string;
  /**
   * 실내 배치 스냅. 있으면 이 킷은 실내 가구다. 파이프라인 전용 테마는 이 값으로 후보 칸을 고른다.
   */
  snap?: InteriorFurnitureSnap;
  /**
   * v3 승인 보캐뷸러리 규약(원칙 0 Zero-Trust Perception).
   * 사용자 명시 수락으로 커밋될 때만 "user" 다 — 어떤 자동 경로도 이 값을 "user" 로 만들지 않는다.
   */
  origin?: "user" | "ai";
  confidence?: "high" | "medium" | "low";
}

export interface SectionStructureKitDef {
  id: string;
  kind: "section";
  name?: string;
  // 반복 단위 크기 — rows.length === height, rows[*].tiles.length === width.
  width: number;
  height: number;
  rows: StructureKitRow[];
  /** 입구·간판·자리 등 부위 목록(상대좌표). */
  parts?: StructureKitPart[];
  /** 칸별 힌트(증분 축·메모). parts 와 달리 한 칸 단위다. 행렬이 있는 section 에만 뜻이 있다. */
  cellHints?: StructureKitCellHint[];
  /** AI 어휘 메타데이터. 없으면 AI 는 이름과 크기만 본다. */
  ai?: StructureKitAiMeta;
  learnedFrom: StructureKitLearnedFrom;
  createdAt?: string;
}

/**
 * 구조 킷은 section(저작 영역을 그대로 굳힌 행렬)뿐이다. 옛 파라메트릭 집 킷
 * (kind:"house", houseKitId+wings)은 제거됐다 — 집 외장은 author_house 정본이 담당한다.
 * 구 저장 데이터에 house 레코드가 남아 있을 수 있으나 런타임은 인터트로 취급한다
 * (카탈로그 등록·래스터화 대상이 아니다).
 */
export type StructureKitDef = SectionStructureKitDef;

/** Editor-facing chipset classification. Omitted legacy records are inferred conservatively. */
export type TilesetKind = "rpg2k" | "custom";

/** 재료 슬롯 하나의 사용자 지정 값. 슬롯 id 목록은 editor/operators/materialSlots.ts 가 소유한다. */
export interface MaterialSlotOverride {
  tiles: number[];
  /** 세로 2칸 원자(수관/밑동)일 때의 상·하 타일. */
  pair?: { top: number; bottom: number };
  layer?: "lower" | "upper";
  passage?: "passable" | "solid";
}

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
  /**
   * 재료 슬롯 오버라이드(2026-09-01). 지형 오퍼레이터가 쓰는 재료를 사람이 보드에서 고친 값.
   * 비워 두면 승인 어휘(tileGroups)에서 매번 유도한다 — 저장은 "사람이 고친 것" 만 한다.
   * 해석기: editor/operators/materialSlots.ts
   */
  materialSlots?: Partial<Record<string, MaterialSlotOverride>>;
  // 범용 오토타일(지형 자동 연결) 그룹 정의. 없으면 내장 기본 그룹(흙길/모래)을 사용한다.
  autotileGroups?: AutotileGroup[];
  // 타일 애니메이션 스트립: baseTile 부터 가로로 frames 개 연속 프레임을 fps 로 재생.
  // (커스텀 타일셋 물 등 — 기본 칩셋의 CHIPSET_ANIMATION_STRIPS 상수를 데이터로 일반화)
  // 업로드 타일셋은 preload 때 원본·프레임·애니메이션을 등록하며, 편집기와 플레이어가
  // 동일한 animationStrips 키를 사용한다. 번들 타일셋은 기존 내장 스트립 규칙을 따른다.
  animationStrips?: TilesetAnimationStrip[];
  // v3 시공 문법 프로파일(2026-07-07). 생략 시 "rm-type"(RM2003 combined_town 규약).
  // 프리미티브 전개는 프로파일 레지스트리(grammarProfiles.ts) 디스패치.
  grammarProfile?: string;
  // 유저 붓질에서 학습된 구조 킷(조용한 제안 → [등록]). 직렬화 왕복에 안전하도록 optional.
  structureKits?: StructureKitDef[];
  /**
   * 이 타일셋의 방 종류. undefined 는 아직 시드 전(실내 칩셋은 하네스가 기본 7종을 심는다).
   * 빈 배열은 사용자가 지운 상태 — 다시 시드하지 않는다.
   */
  interiorRoomKinds?: InteriorRoomKindRecord[];
  /**
   * 개념 꾸러미(시설→장소→물건→칩). undefined 는 아직 시드 전.
   * 빈 배열은 사용자가 지운 상태 — 다시 시드하지 않는다.
   */
  scratchConceptBundles?: ConceptBundleRecord[];
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

export interface UploadedAssetRef {
  readonly sha256: string;
  readonly mime: string;
  readonly bytes: number;
  readonly extension: string;
}

export interface UploadedAsset {
  id: string;
  name: string;
  kind: "tileset" | "sprite" | ResourceKind;
  dataUrl: string;
  /** 내용 주소 참조. 있는 자산은 dataUrl 을 쓰지 않는다(미디어 분리, P3). */
  ref?: UploadedAssetRef;
  meta: {
    tileSize?: number;
    frames?: number;
    frameWidth?: number;
    frameHeight?: number;
    width?: number;
    height?: number;
    transparentColor?: string;
    /**
     * 얼굴 시트 지연 절단 표식. 시트를 낱장 id 로 등록한 시점에는 아직 픽셀이 시트
     * 그대로라, 로드 직후 `repairUploadedFacesetSheets` 가 이 두 값을 보고 canvas 로
     * 해당 칸만 잘라 넣은 뒤 표식을 지운다. 붙이는 쪽은 마이그레이션과 upsert_resource.
     */
    sheetCell?: number;
    sheetSourceId?: string;
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
  /** 방어 커맨드 라벨. 예전에는 하드코딩 "방어" 라, attack/skill/item 만 영어로
   *  덮은 프로젝트가 "Attack / Skill / Item / 방어 / 도주" 로 섞여 보였다. */
  defend?: string;
  /** 도주 커맨드 라벨. defend 와 같은 이유로 용어에 편입한다. */
  escape?: string;
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

/**
 * 다중 타일 캐릭터의 **몸 사각**(타일 단위). 두 축 모두 1 이상이다.
 * 앵커는 **발밑** — (x,y) 가 몸 사각 하단 행의 칸이다:
 *
 *   left = x − ⌊(width−1)/2⌋      top = y − (height−1)      bottom = y
 *
 * 짝수 폭에서 "왼쪽으로 치우친다" 는 **앵커가 몸 사각 중심의 왼쪽에 있다**는 뜻이다.
 * 몸 사각이 왼쪽으로 뻗는다는 뜻이 아니다 — 폭 2 는 left = x 라 앵커가 왼쪽 끝이고
 * 사각은 오른쪽으로 자란다.
 *
 * 이 사각이 지배하는 것: 조사·접촉 발동, 전투 히트, 점유, 렌더 중앙, depth, 편집 클릭.
 * **통행 차단은 이 사각이 아니다** — `EventPage.passRows` 가 하단 일부만 막는다
 * (2차 스펙 §1). 1차에서는 이 타입이 충돌 사각이었고 2차에서 의미가 뒤집혔다.
 *
 * ⚠ project/spatialPlacements.ts 의 SpatialFootprint 와 다른 타입이다.
 * 저쪽은 (x,y) 가 좌상단이고 우·하로 전개한다. 섞으면 좌표가 어긋난다.
 */
export interface CharacterFootprint {
  readonly width: number;
  readonly height: number;
}

/** 타일 좌표 사각형. 네 값 모두 포함(inclusive). */
export interface FootprintRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export const SCHEMA_VERSION = 4 as const;
