// project/defaults/interiorRoomKinds.ts
// 실내 칩셋 기본 방 종류 7종 — 코드 카탈로그와 같은 값. 타일셋에 시드되면 프로젝트 데이터가 된다.
import type { InteriorRoomKindRecord } from "@/project/types/interior";

export const BUILTIN_INTERIOR_ROOM_KINDS: readonly InteriorRoomKindRecord[] = [
  { id: "bedroom", label: "침실", requiredRoles: ["bed"], suggestedModifiers: ["rustic", "luxury"] },
  { id: "study", label: "서재", requiredRoles: ["bookshelf"], suggestedModifiers: ["scholarly", "sacred"] },
  { id: "dining", label: "식당/홀", requiredRoles: ["table"], suggestedModifiers: ["rustic", "luxury", "sacred"] },
  { id: "kitchen", label: "주방", requiredRoles: ["stove"], suggestedModifiers: ["rustic"] },
  { id: "storage", label: "창고", requiredRoles: [], suggestedModifiers: ["rustic", "martial"] },
  { id: "tavern", label: "선술집", requiredRoles: ["table", "counter"], suggestedModifiers: ["rustic", "luxury"] },
  { id: "corridor", label: "복도", requiredRoles: [], suggestedModifiers: ["luxury", "sacred", "martial"], walkway: true },
];
