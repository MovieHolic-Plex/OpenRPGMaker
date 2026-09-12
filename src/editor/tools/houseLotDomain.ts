import type { HouseKitId, HouseKitWindowsOption } from "@/editor/houseKit";
import type { Project } from "@/project/types";
import { buildHouseKit, type HouseKitBuildData } from "./houseKitDomain";
import {
  houseBBox,
  materialForYardDecor,
  yardAreaForHouse,
  yardScatterParams,
  type HouseWing,
  type YardDecorPlan,
} from "./houseLotDecor";
import { placePropsOnDraft } from "./placePropsDomain";
import { ToolError, type ToolExecResult } from "./types";

export type HouseLotPlan = {
  readonly kitId: HouseKitId;
  readonly wings: readonly HouseWing[];
  readonly ownerName?: string;
  readonly interior?: boolean;
  /** 연결 실내 설계(place_concept plan 모양). 없으면 템플릿을 그대로 짓고 경고를 남긴다. */
  readonly interiorPlan?: unknown;
  readonly door?: boolean;
  readonly windows?: HouseKitWindowsOption;
  readonly yard: readonly YardDecorPlan[];
  /** 형태 어휘 — buildHouseKit 로 그대로 흘려보낸다(외장 실루엣을 바꾸는 축). */
  readonly stories?: 1 | 2 | 3;
  readonly lowWall?: boolean;
  readonly chimney?: boolean;
  readonly roofDeck?: boolean;
};

export type BuildHouseLotsInput = {
  readonly mapId: string;
  readonly houses: readonly HouseLotPlan[];
  readonly seed: number;
};

export type HouseLotBuildRecord = {
  readonly ownerName?: string;
  readonly kitId: HouseKitId;
  readonly doorAt: { readonly x: number; readonly y: number } | null;
  readonly build: HouseKitBuildData;
  readonly yardArea: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly decor: readonly HouseLotYardOutcome[];
};

type HouseLotYardCommon = {
  readonly kind: string;
  readonly requested: number;
  readonly placed: number;
  readonly summary: string;
  readonly warnings: readonly string[];
};

export type HouseLotYardOutcome = HouseLotYardCommon & (
  | { readonly status: "placed" }
  | { readonly status: "shortfall" }
  | { readonly status: "failed"; readonly issue: { readonly code: string; readonly message: string } }
);

export type HouseLotBuildData = {
  readonly houses: number;
  readonly decorOps: number;
  readonly lots: readonly HouseLotBuildRecord[];
};

export type BuildHouseLotsResult = ToolExecResult & { readonly data: HouseLotBuildData };

export function buildHouseLots(draft: Project, input: BuildHouseLotsInput): BuildHouseLotsResult {
  const map = draft.maps[input.mapId];
  if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${input.mapId}`, { code: "missing-map", mapId: input.mapId });
  if (input.houses.length === 0) {
    throw new ToolError("houses가 비어 있습니다.", { code: "invalid-args", mapId: input.mapId });
  }

  const built: HouseLotBuildRecord[] = [];
  const warnings: string[] = [];
  let decorPlaced = 0;

  for (const [houseIndex, house] of input.houses.entries()) {
    const bbox = houseBBox(house.wings);
    if (bbox.x < 0 || bbox.y < 0 || bbox.x + bbox.w > map.width || bbox.y + bbox.h > map.height) {
      throw new ToolError(
        `집 #${houseIndex + 1} wings가 맵 밖입니다: bbox (${bbox.x},${bbox.y}) ${bbox.w}×${bbox.h} / 맵 ${map.width}×${map.height}`,
        { code: "out-of-bounds", mapId: input.mapId },
      );
    }

    const linkedInterior = house.interior === true;
    const houseResult = buildHouseKit(draft, {
      mapId: input.mapId,
      kitId: house.kitId,
      wings: house.wings,
      door: house.door !== false,
      interior: linkedInterior,
      doorEvent: linkedInterior,
      ...(house.ownerName === undefined ? {} : { ownerName: house.ownerName }),
      ...(house.windows === undefined ? {} : { windows: house.windows }),
      ...(house.interiorPlan === undefined ? {} : { interiorPlan: house.interiorPlan }),
      ...(house.stories === undefined ? {} : { stories: house.stories }),
      ...(house.lowWall === undefined ? {} : { lowWall: house.lowWall }),
      ...(house.chimney === undefined ? {} : { chimney: house.chimney }),
      ...(house.roofDeck === undefined ? {} : { roofDeck: house.roofDeck }),
    });
    if (houseResult.warnings) warnings.push(...houseResult.warnings);

    const doorAt = houseResult.data.doorAt;
    const yardArea = yardAreaForHouse(map, house.wings, doorAt, { depth: 3, pad: 1 });
    const decorLog: HouseLotYardOutcome[] = [];
    for (const [decorIndex, plan] of house.yard.entries()) {
      const count = Math.max(1, plan.count ?? 1);
      const scatter = yardScatterParams(plan.kind);
      try {
        const propsResult = placePropsOnDraft(draft, {
          mapId: input.mapId,
          area: yardArea,
          material: materialForYardDecor(plan.kind),
          count,
          minGap: scatter.minGap,
          naturalness: scatter.naturalness,
          seed: input.seed + houseIndex * 100 + decorIndex * 7,
        });
        const placed = placedCount(propsResult.data, count);
        const yardWarnings = [...(propsResult.warnings ?? [])];
        if (placed < count) {
          yardWarnings.push(`집 #${houseIndex + 1} yard ${plan.kind}: ${placed}/${count}개만 배치됨`);
        }
        decorLog.push({
          status: placed === count ? "placed" : "shortfall",
          kind: plan.kind,
          requested: count,
          placed,
          summary: propsResult.summary,
          warnings: yardWarnings,
        });
        decorPlaced += placed;
        warnings.push(...yardWarnings);
      } catch (cause) {
        if (!(cause instanceof Error)) throw cause;
        const issue = {
          code: cause instanceof ToolError ? cause.code : "yard-operation-failed",
          message: cause.message,
        };
        const warning = `집 #${houseIndex + 1} yard ${plan.kind}: ${cause.message}`;
        warnings.push(warning);
        decorLog.push({
          status: "failed",
          kind: plan.kind,
          requested: count,
          placed: 0,
          summary: cause.message,
          warnings: [warning],
          issue,
        });
      }
    }

    built.push({
      ...(house.ownerName === undefined ? {} : { ownerName: house.ownerName }),
      kitId: house.kitId,
      doorAt,
      build: houseResult.data,
      yardArea,
      decor: decorLog,
    });
  }

  return {
    summary:
      `${map.name}에 집 부지 ${input.houses.length}채 시공 + 마당 꾸밈 ${decorPlaced}회 산포(코드 결정 좌표). ` +
      `LLM 입력은 wings·kit·yard 태그만 사용.`,
    ...(warnings.length > 0 ? { warnings } : {}),
    data: { houses: input.houses.length, decorOps: decorPlaced, lots: built },
  };
}

function placedCount(data: unknown, requested: number): number {
  if (
    typeof data === "object"
    && data !== null
    && !Array.isArray(data)
    && "placed" in data
    && typeof data.placed === "number"
    && Number.isInteger(data.placed)
    && data.placed >= 0
    && data.placed <= requested
  ) {
    return data.placed;
  }
  throw new ToolError("yard 배치 결과에 유효한 placed 수가 없습니다.", { code: "yard-result-invalid" });
}
