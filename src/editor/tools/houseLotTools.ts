// build_house_lots — LLM은 집 위치(wings)·키트·마당 꾸밈 태그만 정한다.
// 문/타일/산포 좌표는 전부 코드(집 키트 + place_props)가 결정한다.

import type { Project } from "@/project/types";
import { HOUSE_KIT_TOOLS } from "./houseKitTools";
import {
  houseBBox,
  isYardDecorKind,
  propVocabIdForYardDecor,
  yardAreaForHouse,
  yardScatterParams,
  type HouseWing,
  type YardDecorKind,
  type YardDecorPlan,
} from "./houseLotDecor";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { CONSTRUCTION_TOOLS_V3 } from "./v3";

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

type LotHouseInput = {
  readonly kitId: string;
  readonly wings: readonly HouseWing[];
  readonly ownerName?: string;
  readonly interior?: boolean;
  readonly door?: boolean;
  readonly yard: readonly YardDecorPlan[];
};

export const HOUSE_LOT_TOOLS: readonly ToolDefinition[] = [
  {
    name: "build_house_lots",
    description:
      "집 부지(lot) 일괄 시공 — LLM 역할은 집마다 (1) wings 위치·크기 (2) kitId (3) yard 꾸밈 태그 목록뿐. " +
      "문 위치·타일 ID·마당 산포 좌표는 코드가 결정한다. yard 태그: firewood|mailbox|pot|jar|bench_h|bench_v|" +
      "flowers|fruit_box|wood_box|table_h|sign (의자는 탁자 옆 전용 — 마당 가방 산포 제외). " +
      "소품을 place_props로 직접 광장에 몰지 말고, 집 계획이면 이 툴을 우선 사용. " +
      "키트: blue-stone | bright-plaster.",
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
              kitId: { type: "string", enum: ["blue-stone", "bright-plaster"] },
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
  const mapId = typeof args.mapId === "string" ? args.mapId : "";
  const map = draft.maps[mapId];
  if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "missing-map", mapId });

  const houses = coerceHouses(args.houses);
  if (houses.length === 0) {
    throw new ToolError(`houses가 비어 있습니다 — 예시: ${JSON.stringify(EXAMPLE)}`, { code: "invalid-args" });
  }

  const seedBase = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 1;
  const houseTool = HOUSE_KIT_TOOLS.find((tool) => tool.name === "build_house_kit");
  if (!houseTool) throw new ToolError("build_house_kit 툴을 찾을 수 없습니다.", { code: "internal" });

  const placeProps = CONSTRUCTION_TOOLS_V3.find((tool) => tool.name === "place_props");
  if (!placeProps) throw new ToolError("place_props 툴을 찾을 수 없습니다.", { code: "internal" });

  const built: {
    ownerName?: string;
    kitId: string;
    doorAt: { x: number; y: number } | null;
    yardArea: { x: number; y: number; w: number; h: number };
    decor: { kind: string; requested: number; summary: string }[];
  }[] = [];
  const warnings: string[] = [];
  let houseOk = 0;
  let decorPlaced = 0;

  for (let i = 0; i < houses.length; i += 1) {
    const house = houses[i]!;
    const bbox = houseBBox(house.wings);
    if (bbox.x < 0 || bbox.y < 0 || bbox.x + bbox.w > map.width || bbox.y + bbox.h > map.height) {
      throw new ToolError(
        `집 #${i + 1} wings가 맵 밖입니다: bbox (${bbox.x},${bbox.y}) ${bbox.w}×${bbox.h} / 맵 ${map.width}×${map.height}`,
        { code: "out-of-bounds", mapId },
      );
    }

    // ToolExecResult 는 성공 시 ok 필드 없음(throw = 실패).
    const houseResult = houseTool.run(draft, {
      mapId,
      kitId: house.kitId,
      wings: house.wings.map((w) => ({ ...w })),
      door: house.door !== false,
      interior: house.interior === true,
      doorEvent: house.interior === true,
      ownerName: house.ownerName,
      windows: true,
    });
    houseOk += 1;
    if (houseResult.warnings) warnings.push(...houseResult.warnings);

    const doorAt = readDoorAt(houseResult.data);
    const yardArea = yardAreaForHouse(map, house.wings, doorAt, { depth: 3, pad: 1 });
    const decorLog: { kind: string; requested: number; summary: string }[] = [];

    for (let d = 0; d < house.yard.length; d += 1) {
      const plan = house.yard[d]!;
      const count = Math.max(1, plan.count ?? 1);
      const propVocabId = propVocabIdForYardDecor(plan.kind);
      const scatter = yardScatterParams(plan.kind);
      try {
        const propsResult = placeProps.run(draft, {
          mapId,
          area: yardArea,
          propVocabId,
          count,
          minGap: scatter.minGap,
          naturalness: scatter.naturalness,
          seed: seedBase + i * 100 + d * 7,
        });
        decorLog.push({
          kind: plan.kind,
          requested: count,
          summary: propsResult.summary,
        });
        const data = propsResult.data as Record<string, unknown> | undefined;
        const placed = typeof data?.placed === "number" ? data.placed : count;
        decorPlaced += placed;
        if (propsResult.warnings) warnings.push(...propsResult.warnings);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        warnings.push(`집 #${i + 1} yard ${plan.kind}: ${message}`);
        decorLog.push({ kind: plan.kind, requested: count, summary: message });
      }
    }

    built.push({
      ownerName: house.ownerName,
      kitId: house.kitId,
      doorAt,
      yardArea,
      decor: decorLog,
    });
  }

  return {
    summary:
      `${map.name}에 집 부지 ${houseOk}채 시공 + 마당 꾸밈 ${decorPlaced}회 산포(코드 결정 좌표). ` +
      `LLM 입력은 wings·kit·yard 태그만 사용.`,
    ...(warnings.length > 0 ? { warnings } : {}),
    data: {
      houses: houseOk,
      decorOps: decorPlaced,
      lots: built,
    },
  };
}

function coerceHouses(value: unknown): LotHouseInput[] {
  if (!Array.isArray(value)) {
    throw new ToolError(`houses는 배열이어야 합니다 — 예시: ${JSON.stringify(EXAMPLE)}`, { code: "invalid-args" });
  }
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new ToolError(`houses[${index}]는 객체여야 합니다.`, { code: "invalid-args" });
    }
    const row = entry as Record<string, unknown>;
    const kitId = typeof row.kitId === "string" ? row.kitId : "";
    if (kitId !== "blue-stone" && kitId !== "bright-plaster") {
      throw new ToolError(`houses[${index}].kitId는 blue-stone|bright-plaster — got ${String(row.kitId)}`, {
        code: "invalid-args",
      });
    }
    const wings = coerceWings(row.wings, index);
    const yard = coerceYard(row.yard, index);
    return {
      kitId,
      wings,
      ...(typeof row.ownerName === "string" ? { ownerName: row.ownerName } : {}),
      ...(typeof row.interior === "boolean" ? { interior: row.interior } : {}),
      ...(typeof row.door === "boolean" ? { door: row.door } : {}),
      yard,
    };
  });
}

function coerceWings(value: unknown, houseIndex: number): HouseWing[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ToolError(`houses[${houseIndex}].wings는 1개 이상 사각형 배열.`, { code: "invalid-args" });
  }
  return value.map((entry, wi) => {
    if (!entry || typeof entry !== "object") {
      throw new ToolError(`houses[${houseIndex}].wings[${wi}] 무효`, { code: "invalid-args" });
    }
    const w = entry as Record<string, unknown>;
    const x = w.x;
    const y = w.y;
    const width = w.w;
    const height = w.h;
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

function coerceYard(value: unknown, houseIndex: number): YardDecorPlan[] {
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
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const kind = row.kind;
      if (!isYardDecorKind(kind)) {
        throw new ToolError(`houses[${houseIndex}].yard[${i}].kind 무효: ${String(kind)}`, { code: "invalid-args" });
      }
      const count = typeof row.count === "number" && Number.isInteger(row.count) ? row.count : 1;
      plans.push({ kind: kind as YardDecorKind, count });
      continue;
    }
    throw new ToolError(`houses[${houseIndex}].yard[${i}] 형식 오류`, { code: "invalid-args" });
  }
  return plans;
}

function readDoorAt(data: unknown): { x: number; y: number } | null {
  if (!data || typeof data !== "object") return null;
  const doorAt = (data as Record<string, unknown>).doorAt;
  if (!doorAt || typeof doorAt !== "object") return null;
  const d = doorAt as Record<string, unknown>;
  if (typeof d.x === "number" && typeof d.y === "number") return { x: d.x, y: d.y };
  return null;
}
