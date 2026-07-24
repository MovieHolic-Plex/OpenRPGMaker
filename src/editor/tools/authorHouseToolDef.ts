import { ALL_HOUSE_KIT_IDS } from "@/editor/houseKit";
import { executeAuthorHouse } from "./authorHouseExecution";
import type { ToolDefinition } from "./types";

const KIT_IDS = [...ALL_HOUSE_KIT_IDS];

const WING_SCHEMA = {
  type: "object",
  description: "집 몸통 직사각형. w(폭) 최소 3, h(높이) 최소 5. 지붕+벽을 포함하므로 h≥5 필수.",
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
    spacing: { type: "integer", minimum: 0, description: "창문 간격 (생략 시 기본값)" },
  },
} as const;

const HOUSE_PLAN_SCHEMA = {
  type: "object",
  description: "개별 집 계획. 각 집에 서로 다른 kitId를 써서 외관 다양성을 확보하라.",
  properties: {
    kitId: { type: "string", enum: KIT_IDS, description: "집 외관 키트. 집마다 다르게 선택." },
    wings: { type: "array", items: WING_SCHEMA, description: "집 몸통(1개 권장). w≥3, h≥5." },
    interior: { type: "string", enum: ["exterior-only", "linked-interior"] },
    door: { type: "boolean" },
    ownerName: { type: "string", description: "주민 이름 (NPC/이벤트용)" },
    windows: WINDOWS_SCHEMA,
    yard: { type: "array", description: "마당 소품. 예: [\"firewood\",\"mailbox\",\"pot\",\"bench_h\",\"flowers\"]" },
  },
  required: ["kitId", "wings", "interior", "door", "yard"],
} as const;

const EXAMPLE = {
  kind: "lots",
  mapId: "map_1",
  houses: [
    { kitId: "blue-stone", wings: [{ x: 2, y: 1, w: 5, h: 6 }], interior: "exterior-only", door: true, ownerName: "대장장이", windows: {}, yard: ["firewood", "pot"] },
    { kitId: "bright-plaster", wings: [{ x: 12, y: 1, w: 6, h: 5 }], interior: "exterior-only", door: true, ownerName: "약초사", windows: { spacing: 2 }, yard: ["flowers", "bench_h"] },
    { kitId: "amber-wood", wings: [{ x: 7, y: 10, w: 5, h: 5 }], interior: "exterior-only", door: true, ownerName: "어부", windows: {}, yard: ["mailbox"] },
  ],
  seed: 42,
} as const;

export const AUTHOR_HOUSE_TOOL: ToolDefinition = {
  name: "author_house",
  description:
    "야외 맵에 집 한 채(single) 또는 여러 채(lots)를 원자적으로 시공한다. "
    + "여러 채는 반드시 kind=lots + houses[]로 한 번에 호출한다(개별 반복 호출 금지). "
    + "각 집에 서로 다른 kitId를 배정해 외관 다양성을 확보한다. "
    + "wing 크기 제약: w≥3, h≥5 (지붕+벽 포함). windows는 false 또는 {spacing?:N}만 유효(true 불가). "
    + "독립 실내 방 요청에는 사용하지 않는다.",
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
      interior: { type: "string", enum: ["exterior-only", "linked-interior"] },
      door: { type: "boolean" },
      ownerName: { type: "string" },
      windows: WINDOWS_SCHEMA,
      houses: { type: "array", items: HOUSE_PLAN_SCHEMA, description: "lots일 때 사용. 집마다 다른 kitId." },
      seed: { type: "integer", description: "랜덤 시드 (마당 소품 배치용)" },
    },
    required: ["kind", "mapId"],
  },
  invalidArgsExample: EXAMPLE,
  run: executeAuthorHouse,
};
