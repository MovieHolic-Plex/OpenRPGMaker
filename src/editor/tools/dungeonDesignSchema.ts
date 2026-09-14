import { DUNGEON_ROLES } from "@/editor/dungeonGeneration/topology";
const point = { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] } as const;
/** Shared model-facing design contract. No raw chipset tile numbers in the spatial plan. */
export const DUNGEON_DESIGN_PROPERTIES = {
  layout: { type: "string", enum: ["connected", "single-room"], description: "기본 connected: 방 연결→윤곽→단차→맥락 소품. single-room은 작은 단일 방." },
  seed: { type: "integer", description: "동일 설계와 시드는 같은 결과. 기본 1." },
  character: { type: "string", enum: ["cavern", "mine", "crystal", "crypt"], description: "공간 용도와 소품 문법. mine은 입구와 작업장을 잇는 연속 철로." },
  graph: {
    type: "object", description: "직접 설계할 방과 연결. 생략하면 시드로 연결 구조 생성. 모든 방은 연결되어야 한다.",
    properties: {
      rooms: { type: "array", minItems: 1, maxItems: 32, items: { type: "object", properties: { id: { type: "string" }, role: { type: "string", enum: [...DUNGEON_ROLES] }, x: { type: "integer", description: "중심 x" }, y: { type: "integer", description: "중심 y" }, width: { type: "integer", minimum: 7 }, height: { type: "integer", minimum: 7 } }, required: ["id", "role", "x", "y", "width", "height"] } },
      connections: { type: "array", maxItems: 64, items: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, width: { type: "number", minimum: 6, maximum: 16 }, via: { type: "array", maxItems: 12, items: point } }, required: ["from", "to"] } },
    }, required: ["rooms", "connections"],
  },
} as const;
