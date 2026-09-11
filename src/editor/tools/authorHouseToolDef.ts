import { ALL_HOUSE_KIT_IDS } from "@/editor/houseKit";
import { HOUSE_TEMPLATE_DEFS } from "@/project/defaults/houseTemplateCatalog";
import { executeAuthorHouse } from "./authorHouseExecution";
import type { ToolDefinition } from "./types";

const KIT_IDS = [...ALL_HOUSE_KIT_IDS];
const TEMPLATE_IDS = HOUSE_TEMPLATE_DEFS.map((def) => def.id);
/** 스키마 설명용 — "이 id 는 이런 꼴" 을 모델이 알아야 골라 쓴다. */
const TEMPLATE_CATALOG = HOUSE_TEMPLATE_DEFS.map((def) => `${def.id}(${def.name} ${def.w}×${def.h})`).join(", ");

const WING_SCHEMA = {
  type: "object",
  description:
    "집 몸통 직사각형. w(폭) 최소 3, h(높이) 최소 5. 지붕+벽을 포함하므로 h≥5 필수. "
    + "templateId 를 함께 주면 wings[0]의 x·y 만 앵커로 쓰이고 w·h 는 카탈로그 치수로 대체된다.",
  properties: {
    x: { type: "integer", minimum: 0, description: "맵 좌측 기준 열 (≥0)" },
    y: { type: "integer", minimum: 0, description: "맵 상단 기준 행 (≥0)" },
    w: { type: "integer", minimum: 3, description: "폭 (최소 3칸)" },
    h: { type: "integer", minimum: 5, description: "높이 (최소 5칸 — 지붕 2행+벽 3행)" },
  },
  required: ["x", "y", "w", "h"],
} as const;

const WINDOWS_SCHEMA = {
  type: "object",
  description: "창문 옵션. false=창문 없음. true는 불가 — {} 또는 {spacing:N}만 유효.",
  properties: {
    enabled: { type: "boolean", description: "창문 배치 여부(기본 true)" },
    spacing: { type: "integer", minimum: 0, description: "창문 간격 (생략 시 기본값)" },
  },
} as const;

// 형태 축 4개. kitId(색)만 흔들면 같은 실루엣의 색만 바뀐 집이 나온다 —
// 2026-08-31 결함: kitId 6종은 지붕색 3가지로 접혀서 "다양성 확보" 지시를 지켜도 단조로웠다.
const SHAPE_PROPERTIES = {
  templateId: {
    type: "string",
    enum: TEMPLATE_IDS,
    description:
      `외장 형태 카탈로그(${TEMPLATE_IDS.length}종). **집마다 서로 다른 값을 써서 실루엣을 갈라라** — `
      + `ㄱ자·ㄷ자·중정·현관 돌출·계단식 2층·옥상 데크는 이 값으로만 나온다. 목록: ${TEMPLATE_CATALOG}`,
  },
  stories: {
    type: "integer",
    enum: [1, 2, 3],
    description: "외장 층수(벽 밴드 행 수). 2층은 wing h≥9, 3층은 h≥11 필요. 실내 층수도 여기에 맞춰진다.",
  },
  lowWall: {
    type: "boolean",
    description: "낮은 벽(상단+하단 2행) — 헛간·창고·오두막. 창문이 없어진다. stories 를 무시한다.",
  },
  chimney: { type: "boolean", description: "우측 사선 지붕에 굴뚝. 실루엣에 변화를 준다." },
  roofDeck: {
    type: "boolean",
    description: "옥상 판자 데크 + 벽면 사다리. 파랑 평지붕(blue-stone/slate-wood)에서만 의미가 있다.",
  },
} as const;

const HOUSE_PLAN_SCHEMA = {
  type: "object",
  description:
    "개별 집 계획. **각 집에 서로 다른 templateId 와 kitId 를 배정하라** — templateId 가 실루엣(모양), "
    + "kitId 가 색이다. 같은 templateId 를 반복하면 결과 경고에 monotonous 로 잡힌다.",
  properties: {
    kitId: { type: "string", enum: KIT_IDS, description: "집 외관 키트(색). 집마다 다르게 선택." },
    wings: { type: "array", items: WING_SCHEMA, description: "집 몸통. templateId 를 쓰면 wings[0]은 앵커(좌상단)." },
    interior: { type: "string", enum: ["exterior-only", "linked-interior"], description: "생략하면 linked-interior(실내맵+양방향 전이 자동). 겉모습만이면 exterior-only." },
    door: { type: "boolean", description: "linked-interior면 door:true 필수 — 문 이벤트와 실내 출구가 생긴다." },
    ownerName: { type: "string", description: "주민 이름 (NPC/이벤트용)" },
    windows: WINDOWS_SCHEMA,
    yard: { type: "array", items: { type: "string", enum: ["firewood", "mailbox", "pot", "jar", "bench_h", "bench_v", "flowers", "fruit_box", "wood_box", "table_h", "sign"] }, description: "마당 소품. 예: [\"firewood\",\"mailbox\",\"pot\",\"bench_h\",\"flowers\"]" },
    ...SHAPE_PROPERTIES,
  },
  required: ["kitId", "wings", "door", "yard"],
} as const;

const EXAMPLE = {
  kind: "lots",
  mapId: "map_1",
  houses: [
    { kitId: "blue-stone", templateId: "l", wings: [{ x: 2, y: 1, w: 6, h: 8 }], interior: "linked-interior", door: true, ownerName: "대장장이", windows: {}, chimney: true, yard: ["firewood", "pot"] },
    { kitId: "bright-plaster", templateId: "rect-2f", wings: [{ x: 12, y: 1, w: 7, h: 9 }], interior: "linked-interior", door: true, ownerName: "약초사", windows: { spacing: 2 }, yard: ["flowers", "bench_h"] },
    { kitId: "amber-wood", templateId: "barn-low", wings: [{ x: 7, y: 14, w: 6, h: 5 }], interior: "linked-interior", door: true, ownerName: "어부", windows: {}, yard: ["mailbox"] },
    { kitId: "amber-wood", templateId: "z-offset", wings: [{ x: 18, y: 14, w: 8, h: 10 }], interior: "linked-interior", door: true, ownerName: "사냥꾼", windows: {}, yard: ["jar"] },
  ],
  seed: 42,
} as const;

export const AUTHOR_HOUSE_TOOL: ToolDefinition = {
  name: "author_house",
  description:
    "야외 맵에 집 한 채(single) 또는 여러 채(lots)를 원자적으로 시공한다.  집·대장간·상점 같은 건물의 **야외 외장**은 이 facade 로 짓는다 — 벽 타일로 직사각형을 채우지 말 것. 들어가서 걷는 집은 interior:\"linked-interior\"로 한 번에 짓는다(실내맵+문/출구 전이 자동). 개념 꾸러미 시설(여관·상점·술집·민가…)은 place_concept, 외장 없는 독립 실내 방도 get_concept_facility → place_concept(plan). 연결 실내는 현재 개념 꾸러미의 시설·장소·물건으로 시공한다."
    + "여러 채는 반드시 kind=lots + houses[]로 한 번에 호출한다(개별 반복 호출 금지). "
    + `**모양 다양성이 필수다: 집마다 서로 다른 templateId(${TEMPLATE_IDS.length}종 카탈로그)를 배정하고 kitId 도 섞어라.** `
    + "templateId 를 생략하면 wings 그대로의 사각형이 되어 결과가 단조로워진다. "
    + "결과 data.variety 와 경고에 모양/킷 분포가 실리고, 깐 뒤에는 look_at_houses 로 눈으로 확인하라. "
    + "wing 크기 제약: w≥3, h≥5 (지붕+벽 포함). windows는 false 또는 {spacing?:N}만 유효(true 불가). "
    + "외장 없는 독립 실내 방 요청에는 사용하지 않는다.",
  mode: "write",
  version: 3,
  domains: ["tile"],
  parameters: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["single", "lots"], description: "single=1채, lots=여러 채(권장)" },
      mapId: { type: "string" },
      kitId: { type: "string", enum: KIT_IDS, description: "single일 때 사용. 집 외관 키트." },
      wings: { type: "array", items: WING_SCHEMA, description: "single일 때 사용. w≥3, h≥5." },
      interior: { type: "string", enum: ["exterior-only", "linked-interior"], description: "생략하면 linked-interior(실내맵+양방향 전이 자동). 겉모습만이면 exterior-only." },
      door: { type: "boolean", description: "linked-interior면 door:true 필수." },
      ownerName: { type: "string" },
      windows: WINDOWS_SCHEMA,
      houses: { type: "array", items: HOUSE_PLAN_SCHEMA, description: "lots일 때 사용. 집마다 다른 templateId·kitId." },
      seed: { type: "integer", description: "랜덤 시드 (마당 소품 배치용)" },
      ...SHAPE_PROPERTIES,
    },
    required: ["kind", "mapId"],
  },
  invalidArgsExample: EXAMPLE,
  run: executeAuthorHouse,
};
