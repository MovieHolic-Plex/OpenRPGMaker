// editor/tools/fenceRepairTools.ts
// repair_fence — 기존 울타리 보수(새 필지·새 울타리 시공 없음). 로직은 village/fenceRepair.ts.

import { isCombinedTownCompatibleTileset } from "@/project/tilesetHarness/combinedTown";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { RECT_SCHEMA } from "./schemaShapes";
import { repairFences } from "./village/fenceRepair";
import type { Rect } from "./village/constants";

function areaArg(map: { width: number; height: number; id: string }, value: unknown): Rect | undefined {
  if (value === undefined) return undefined;
  const rect = value as Partial<Rect>;
  const ok = [rect.x, rect.y, rect.w, rect.h].every((part) => typeof part === "number" && Number.isInteger(part));
  if (!ok || rect.w! <= 0 || rect.h! <= 0 || rect.x! < 0 || rect.y! < 0 || rect.x! + rect.w! > map.width || rect.y! + rect.h! > map.height) {
    throw new ToolError(`area 는 맵(${map.width}×${map.height}) 안의 {x,y,w,h} 정수 사각형이어야 합니다.`, { code: "invalid-args", mapId: map.id });
  }
  return rect as Rect;
}

const repairFence: ToolDefinition = {
  name: "repair_fence",
  description:
    "이미 깔린 울타리·담장을 새로 짓지 않고 손본다. 울타리 칸은 그대로 두고 이웃 연결에 맞게 조각(가로대·세로 변·모서리·끝 조각)을 다시 고르고, "
    + "이웃 없는 외톨이 조각만 걷어낸다. fillGaps:true 면 같은 줄 1칸 구멍만 메운다(문 앞 3칸 게이트는 유지). "
    + "「담장이 엉망」「울타리 끊겼어」「새로 만들지 말고 손봐줘」의 정본. 새 울타리는 author_house(fence)·author_village. 합본 마을 계열 칩셋 전용.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      area: { ...RECT_SCHEMA, description: "손볼 영역 {x,y,w,h}. 생략 = 맵 전체" },
      fillGaps: { type: "boolean", description: "같은 줄 1칸 구멍 메우기. 기본 false(칸을 늘리지 않는다)" },
    },
    required: ["mapId"],
  },
  invalidArgsExample: { mapId: "map_town", area: { x: 0, y: 0, w: 20, h: 15 } },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset || !isCombinedTownCompatibleTileset(tileset)) {
      throw new ToolError(
        `repair_fence 는 합본 마을·숲마을 호환 칩셋 전용입니다 — 이 맵의 칩셋: ${map.tilesetId}. 다른 칩셋에서는 울타리 조각 번호가 다른 그림입니다.`,
        { code: "fence-tileset-mismatch", mapId: map.id },
      );
    }
    const report = repairFences(map, { area: areaArg(map, args.area), fillGaps: args.fillGaps === true });
    if (report.fenceCellsBefore === 0) {
      return { summary: `${map.name}: 손볼 울타리가 없습니다(변경 없음).`, data: { mapId: map.id, ...report } };
    }
    return {
      summary:
        `${map.name} 울타리 보수 — 어긋난 이음 ${report.badJointsBefore}→${report.badJointsAfter}, 조각 교체 ${report.retiled}칸, `
        + `외톨이 제거 ${report.orphansRemoved}칸${report.gapsFilled ? `, 구멍 메움 ${report.gapsFilled}칸` : ""} (울타리 ${report.fenceCellsBefore}→${report.fenceCellsAfter}칸).`,
      data: { mapId: map.id, ...report },
    };
  },
};

export const FENCE_REPAIR_TOOLS: readonly ToolDefinition[] = [repairFence];
