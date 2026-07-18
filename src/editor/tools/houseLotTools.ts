// build_house_lots — LLM은 집 위치(wings)·키트·마당 꾸밈 태그만 정한다.
// 문/타일/산포 좌표는 전부 코드(집 키트 + place_props)가 결정한다.

import type { Project } from "@/project/types";
import { isPublicHouseKitId, PUBLIC_HOUSE_KIT_IDS } from "./houseKitDomain";
import { buildHouseLots, type BuildHouseLotsInput, type HouseLotPlan } from "./houseLotDomain";
import {
  isYardDecorKind,
  type HouseWing,
  type YardDecorPlan,
} from "./houseLotDecor";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const EXAMPLE = {
  mapId: "map_1",
  houses: [
    {
      kitId: "blue-stone",
      wings: [{ x: 10, y: 8, w: 8, h: 6 }],
      ownerName: "촌장",
      yard: ["mailbox", "firewood", "pot"],
    },
    {
      kitId: "bright-plaster",
      wings: [{ x: 24, y: 20, w: 7, h: 6 }],
      ownerName: "어부",
      yard: ["bench_h", "flowers", "jar"],
    },
  ],
  seed: 42,
};

export const HOUSE_LOT_TOOLS: readonly ToolDefinition[] = [
  {
    name: "build_house_lots",
    description:
      "집 부지(lot) 일괄 시공 — LLM 역할은 집마다 (1) wings 위치·크기 (2) kitId (3) yard 꾸밈 태그 목록뿐. " +
      "문 위치·타일 ID·마당 산포 좌표는 코드가 결정한다. yard 태그: firewood|mailbox|pot|jar|bench_h|bench_v|" +
      "flowers|fruit_box|wood_box|table_h|sign (의자는 탁자 옆 전용 — 마당 가방 산포 제외). " +
      "소품을 place_props로 직접 광장에 몰지 말고, 집 계획이면 이 툴을 우선 사용. " +
      "키트: blue-stone | bright-plaster | amber-wood | slate-wood | timber-hall | aframe-stone" +
      " (aframe은 단일 직사각 날개 + h=벽3+floor((w-1)/2)+1 필수).",
    mode: "write",
    version: 3,
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string", description: "대상 맵 id" },
        houses: {
          type: "array",
          description: "집 부지 목록. 각 항목 = 위치(wings) + 재질 + 마당 꾸밈 의도",
          items: {
            type: "object",
            properties: {
              kitId: { type: "string", enum: PUBLIC_HOUSE_KIT_IDS },
              wings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    x: { type: "integer" },
                    y: { type: "integer" },
                    w: { type: "integer" },
                    h: { type: "integer" },
                  },
                  required: ["x", "y", "w", "h"],
                },
              },
              ownerName: { type: "string" },
              interior: { type: "boolean", description: "내부 맵(기본 false — 마을 대량 배치 시 부담 감소)" },
              door: { type: "boolean", description: "문 자동(기본 true)" },
              yard: {
                type: "array",
                description: "마당 꾸밈 의도. 문자열 태그 또는 {kind, count?}",
                items: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "object",
                      properties: {
                        kind: { type: "string" },
                        count: { type: "integer" },
                      },
                      required: ["kind"],
                    },
                  ],
                },
              },
            },
            required: ["kitId", "wings", "yard"],
          },
        },
        seed: { type: "integer", description: "마당 산포 시드 베이스(선택)" },
      },
      required: ["mapId", "houses"],
    },
    invalidArgsExample: EXAMPLE,
    run(draft: Project, args: Record<string, unknown>): ToolExecResult {
      return runBuildHouseLots(draft, args);
    },
  },
];

export function runBuildHouseLots(draft: Project, args: Record<string, unknown>): ToolExecResult {
  return buildHouseLots(draft, parseBuildHouseLotsInput(args));
}

function parseBuildHouseLotsInput(args: Record<string, unknown>): BuildHouseLotsInput {
  const mapId = typeof args.mapId === "string" ? args.mapId : "";
  if (mapId.length === 0) throw new ToolError("mapId는 비어 있지 않은 문자열이어야 합니다.", { code: "invalid-args" });
  const houses = coerceHouses(args.houses);
  if (houses.length === 0) {
    throw new ToolError(`houses가 비어 있습니다 — 예시: ${JSON.stringify(EXAMPLE)}`, { code: "invalid-args", mapId });
  }
  return {
    mapId,
    houses,
    seed: typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 1,
  };
}

function coerceHouses(value: unknown): readonly HouseLotPlan[] {
  if (!Array.isArray(value)) {
    throw new ToolError(`houses는 배열이어야 합니다 — 예시: ${JSON.stringify(EXAMPLE)}`, { code: "invalid-args" });
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new ToolError(`houses[${index}]는 객체여야 합니다.`, { code: "invalid-args" });
    }
    if (!isPublicHouseKitId(entry.kitId)) {
      throw new ToolError(`houses[${index}].kitId는 ${PUBLIC_HOUSE_KIT_IDS.join("|")} — got ${String(entry.kitId)}`, {
        code: "invalid-args",
      });
    }
    const wings = coerceWings(entry.wings, index);
    const yard = coerceYard(entry.yard, index);
    return {
      kitId: entry.kitId,
      wings,
      ...(typeof entry.ownerName === "string" ? { ownerName: entry.ownerName } : {}),
      ...(typeof entry.interior === "boolean" ? { interior: entry.interior } : {}),
      ...(typeof entry.door === "boolean" ? { door: entry.door } : {}),
      yard,
    };
  });
}

function coerceWings(value: unknown, houseIndex: number): readonly HouseWing[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ToolError(`houses[${houseIndex}].wings는 1개 이상 사각형 배열.`, { code: "invalid-args" });
  }
  return value.map((entry, wi) => {
    if (!isRecord(entry)) {
      throw new ToolError(`houses[${houseIndex}].wings[${wi}] 무효`, { code: "invalid-args" });
    }
    const x = entry.x;
    const y = entry.y;
    const width = entry.w;
    const height = entry.h;
    if (
      typeof x !== "number" || !Number.isInteger(x)
      || typeof y !== "number" || !Number.isInteger(y)
      || typeof width !== "number" || !Number.isInteger(width)
      || typeof height !== "number" || !Number.isInteger(height)
    ) {
      throw new ToolError(`houses[${houseIndex}].wings[${wi}]는 정수 x,y,w,h 필요`, { code: "invalid-args" });
    }
    return { x, y, w: width, h: height };
  });
}

function coerceYard(value: unknown, houseIndex: number): readonly YardDecorPlan[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ToolError(`houses[${houseIndex}].yard는 배열이어야 합니다.`, { code: "invalid-args" });
  }
  const plans: YardDecorPlan[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (typeof item === "string") {
      if (!isYardDecorKind(item)) {
        throw new ToolError(
          `houses[${houseIndex}].yard[${i}] 알 수 없는 태그 '${item}'. 허용: firewood|mailbox|pot|jar|bench_h|bench_v|flowers|fruit_box|wood_box|table_h|chair|sign`,
          { code: "invalid-args" },
        );
      }
      plans.push({ kind: item });
      continue;
    }
    if (isRecord(item)) {
      const kind = item.kind;
      if (!isYardDecorKind(kind)) {
        throw new ToolError(`houses[${houseIndex}].yard[${i}].kind 무효: ${String(kind)}`, { code: "invalid-args" });
      }
      const count = typeof item.count === "number" && Number.isInteger(item.count) ? item.count : 1;
      plans.push({ kind, count });
      continue;
    }
    throw new ToolError(`houses[${houseIndex}].yard[${i}] 형식 오류`, { code: "invalid-args" });
  }
  return plans;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
