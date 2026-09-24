import { DUNGEON_LANDMARKS, DUNGEON_PRESSURES } from "@/editor/dungeonGeneration/expedition";
import { DUNGEON_PATHS, DUNGEON_ROLES } from "@/editor/dungeonGeneration/topology";
const point = { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"] } as const;
/** Shared model-facing design contract. No raw chipset tile numbers in the spatial plan. */
export const DUNGEON_DESIGN_PROPERTIES = {
  layout: { type: "string", enum: ["connected", "single-room"], description: "기본 connected: 방 연결→윤곽→단차→맥락 소품. single-room은 작은 단일 방." },
  seed: { type: "integer", description: "동일 설계와 시드는 같은 결과. 기본 1." },
  character: { type: "string", enum: ["cavern", "mine", "crystal", "crypt"], description: "공간 용도와 소품 문법. mine은 입구와 작업장을 잇는 연속 철로." },
  path: { type: "string", enum: [...DUNGEON_PATHS], description: "세계관과 이번 요청으로 정한 길의 형태. straight는 곧은 방과 길, cave는 경계가 녹는 공동, winding은 방은 남기고 길만 꺾임. 생략하면 crypt만 곧은 형태이고 그 외는 동굴이다." },
  linkMapId: { type: "string", description: "이 던전 입구와 양방향으로 이어질 바깥 맵 id. 그 맵이 있을 때만 출입구를 놓는다." },
  landmark: { type: "string", enum: [...DUNGEON_LANDMARKS], description: "입구에서 가장 먼 방(single-room 은 방 북쪽 가운데)에 두는 표지. altar 제단, tower 탑, gate 문, sound 소리 표식, beacon 봉화(돌기둥 사이 횃불 화로대 — 등대 꼭대기·봉화대)." },
  pressure: { type: "string", enum: [...DUNGEON_PRESSURES], description: "가만히 있지 않는 것. patrol은 troopId가 있을 때 순찰, tide는 밀물, rising은 차오르는 물." },
  troopId: { type: "string", description: "pressure가 patrol일 때 순찰할 트룹 id." },
  graph: {
    type: "object", description: "직접 설계할 방과 연결. 생략하면 시드로 연결 구조 생성. 모든 방은 연결되어야 한다.",
    properties: {
      rooms: { type: "array", minItems: 1, maxItems: 32, items: { type: "object", properties: { id: { type: "string" }, role: { type: "string", enum: [...DUNGEON_ROLES] }, x: { type: "integer", description: "중심 x" }, y: { type: "integer", description: "중심 y" }, width: { type: "integer", minimum: 7 }, height: { type: "integer", minimum: 7 } }, required: ["id", "role", "x", "y", "width", "height"] } },
      connections: { type: "array", maxItems: 64, items: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, width: { type: "number", minimum: 6, maximum: 16 }, via: { type: "array", maxItems: 12, items: point } }, required: ["from", "to"] } },
    }, required: ["rooms", "connections"],
  },
} as const;
