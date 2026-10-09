// editor/tools/tilesetAtlasSchemas.ts
// tilesetAtlasTools.ts 전용 파라미터 스키마 조각. 툴 파일이 200줄을 넘지 않게 분리했다.
// object 자리는 반드시 실제 properties 를 선언한다 — 빈 {type:"object"} 는 모델이 {} 만 보내게
// 만든다(2026-08-23 실측, openwiki/editor-ai-tools.md). variantMap 처럼 키가 동적인 맵만
// additionalProperties: true 로 둔다.
import type { JsonSchema } from "./types";

/** TilesetDef.image (AssetRef) — 번들 텍스처 키 또는 업로드 리소스 id. */
export const TILESET_IMAGE_SCHEMA: JsonSchema = {
  type: "object",
  description: "타일셋 그림. type=bundled면 id는 번들 칩셋 텍스처 키(tex_*), uploaded면 업로드 리소스 id.",
  properties: {
    type: { type: "string", enum: ["bundled", "uploaded"] },
    id: { type: "string" },
  },
  required: ["type", "id"],
  additionalProperties: false,
};

/** AutotileGroup (project/types/base.ts) — 이웃 연결 자동 변형 그룹. */
export const AUTOTILE_GROUP_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "생략 시 autotile_N 로 새로 만든다. 기존 id면 그 그룹을 덮어쓴다." },
    name: { type: "string" },
    neighborhood: { type: "integer", enum: [4, 8], description: "이웃 판정 범위. 생략 시 4방향." },
    memberTileIds: { type: "array", items: { type: "integer" }, description: "자동 변형 대상 타일" },
    connectTileIds: { type: "array", items: { type: "integer" }, description: "연결로 볼 이웃 타일. 생략 시 memberTileIds." },
    triggerTileIds: { type: "array", items: { type: "integer" }, description: "편집 시 재계산을 유발할 타일" },
    variantMap: {
      type: "object",
      description: "이웃 비트마스크(10진수 문자열) → 배치 타일 인덱스. 예: {\"0\":8,\"15\":9}",
      additionalProperties: true,
    },
  },
  required: ["name", "memberTileIds", "variantMap"],
  additionalProperties: false,
};

/** TilesetAnimationStrip — baseTile 부터 가로로 frames 장을 fps 로 재생. */
export const ANIMATION_STRIP_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    baseTile: { type: "integer", description: "첫 프레임 타일 인덱스" },
    frames: { type: "integer", description: "가로 연속 프레임 수(2 이상, 같은 행 안에서만)" },
    fps: { type: "integer", description: "초당 프레임(1 이상)" },
  },
  required: ["baseTile", "frames", "fps"],
  additionalProperties: false,
};

/** TileGraft — 다른 칩셋의 타일을 이 타일셋 슬롯에 이식. */
export const TILE_GRAFT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    targetTile: { type: "integer", description: "덮어쓸 이 타일셋의 슬롯" },
    sourceChipset: { type: "string", description: "소스 그림판 텍스처 키(tex_*) 또는 업로드 리소스 id" },
    sourceTile: { type: "integer", description: "소스 그림판 안의 타일 인덱스" },
  },
  required: ["targetTile", "sourceChipset", "sourceTile"],
  additionalProperties: false,
};

/** 타일셋 기하/표시 속성 — create_tileset 과 set_tileset_properties 가 공유한다. */
export const TILESET_PROPERTY_SCHEMAS: Record<string, JsonSchema> = {
  name: { type: "string" },
  image: TILESET_IMAGE_SCHEMA,
  kind: { type: "string", enum: ["rpg2k", "custom"], description: "rpg2k=480칩 규약, custom=임의 직사각 아틀라스" },
  tileSize: { type: "integer", description: "타일 한 변 픽셀(기본 16)" },
  tilesPerRow: { type: "integer", description: "한 행 타일 수" },
  count: { type: "integer", description: "총 타일 수. 슬롯 배열(통행/우선/지형)이 이 길이로 맞춰진다." },
  transparentColor: { type: "string", description: "투명색 #rrggbb" },
};
