import type {
  AuthorHousePlan,
  AuthorHouseRequest,
  ConstructionDiffTotals,
  ConstructionOutcome,
  HouseWing,
} from "@/editor/construction/contracts";
import { parseAuthorHouseRequest } from "@/editor/construction/parseHouseRequest";
import { isPassable } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import type { Project } from "@/project/types";

import { summarizeChanges } from "./changeset";
import {
  describeAuthorHouseChanges,
  validateAuthorHousePostconditions,
} from "./authorHousePostconditions";
import type {
  AuthorHouseExecution,
  AuthorHouseResultData,
  HouseInteriorEvidence,
} from "./authorHouseTypes";
import { buildHouseKit, type HouseKitBuildData } from "./houseKitDomain";
import { buildHouseLots, type HouseLotBuildData } from "./houseLotDomain";
import { isYardDecorKind, type YardDecorPlan } from "./houseLotDecor";
import { ToolError, type ChangeSummary, type ToolExecResult } from "./types";

export function executeAuthorHouse(draft: Project, rawArgs: Record<string, unknown>): ToolExecResult {
  const request = parseAuthorHouseRequest(rawArgs);
  const before = structuredClone(draft);
  const targetMap = draft.maps[request.mapId];
  if (targetMap === undefined) {
    throw new ToolError(`맵을 찾을 수 없습니다: ${request.mapId}`, { code: "missing-map", mapId: request.mapId });
  }
  validatePlans(request);

  const execution = buildRequestedHouses(draft, request);
  restoreStartIfHouseCovered(before, draft);
  const changes = describeAuthorHouseChanges(before, draft);
  const diff = summarizeChanges(before, draft);
  validateAuthorHousePostconditions({ before, after: draft, request, houses: execution.houses, changes, diff });
  const construction: ConstructionOutcome = {
    executionOk: true,
    applied: true,
    outcome: "applied",
    requestedEntrypoint: "author_house",
    canonicalRoute: "author_house",
    selectedImplementation: request.kind === "single" ? "house-kit-domain" : "house-lot-domain",
    routeChanges: [],
    activityPersistence: "not-recorded",
    projectPersistence: "not-requested",
    target: { kind: "existing", mapId: request.mapId },
    counts: { requested: requestedCount(request), actual: execution.houses.length },
    diff: constructionDiff(diff),
    warnings: execution.warnings,
  };
  const data: AuthorHouseResultData = { construction, houses: execution.houses, changes };
  return {
    summary: execution.summary,
    ...(execution.warnings.length === 0 ? {} : { warnings: [...execution.warnings] }),
    data,
  };
}

type HouseBuildExecution = {
  readonly summary: string;
  readonly warnings: readonly string[];
  readonly houses: readonly AuthorHouseExecution[];
};

function buildRequestedHouses(draft: Project, request: AuthorHouseRequest): HouseBuildExecution {
  switch (request.kind) {
    case "single": {
      const result = buildHouseKit(draft, {
        mapId: request.mapId,
        kitId: request.kitId,
        wings: request.wings,
        door: request.door,
        doorEvent: request.interior === "linked-interior",
        interior: request.interior === "linked-interior",
        ...(request.ownerName === undefined ? {} : { ownerName: request.ownerName }),
        ...(request.windows === undefined ? {} : { windows: request.windows }),
      });
      return {
        summary: result.summary,
        warnings: result.warnings ?? [],
        houses: [houseExecution({ index: 0, exteriorMapId: request.mapId, plan: request, build: result.data })],
      };
    }
    case "lots": {
      const result = buildHouseLots(draft, {
        mapId: request.mapId,
        seed: request.seed ?? 1,
        houses: request.houses.map((house) => ({
          kitId: house.kitId,
          wings: house.wings,
          door: house.door,
          interior: house.interior === "linked-interior",
          ...(house.ownerName === undefined ? {} : { ownerName: house.ownerName }),
          ...(house.windows === undefined ? {} : { windows: house.windows }),
          yard: house.yard.map(yardPlan),
        })),
      });
      assertCompleteYards(request.mapId, result.data);
      return {
        summary: result.summary,
        warnings: result.warnings ?? [],
        houses: result.data.lots.map((lot, index) =>
          houseExecution({ index, exteriorMapId: request.mapId, plan: request.houses[index], build: lot.build })),
      };
    }
  }
}

function assertCompleteYards(mapId: string, data: HouseLotBuildData): void {
  for (const lot of data.lots) {
    for (const yard of lot.decor) {
      switch (yard.status) {
        case "placed":
          break;
        case "shortfall":
          throw new ToolError(
            `마당 꾸밈 ${yard.kind} 배치가 부족합니다: ${yard.placed}/${yard.requested}`,
            { code: "yard-placement-shortfall", mapId },
          );
        case "failed":
          throw new ToolError(yard.issue.message, { code: yard.issue.code, mapId });
      }
    }
  }
}

function yardPlan(intent: AuthorHousePlan["yard"][number]): YardDecorPlan {
  const kind = typeof intent === "string" ? intent : intent.kind;
  if (!isYardDecorKind(kind)) {
    throw new ToolError(`알 수 없는 마당 꾸밈 태그: ${kind}`, { code: "invalid-args" });
  }
  return typeof intent === "string" ? { kind } : { kind, count: intent.count };
}

type HouseExecutionInput = {
  readonly index: number;
  readonly exteriorMapId: string;
  readonly plan: Pick<AuthorHousePlan, "kitId" | "wings"> | undefined;
  readonly build: HouseKitBuildData;
};

function houseExecution(input: HouseExecutionInput): AuthorHouseExecution {
  if (input.plan === undefined) {
    throw new ToolError("집 계획과 lot 실행 결과를 대응할 수 없습니다.", { code: "house-count-mismatch" });
  }
  const interior = interiorEvidence(input.exteriorMapId, input.build);
  return {
    index: input.index,
    kitId: input.plan.kitId,
    wings: input.plan.wings,
    exteriorMapId: input.exteriorMapId,
    doorAt: input.build.doorAt,
    ...(interior === undefined ? {} : { interior }),
  };
}

function interiorEvidence(exteriorMapId: string, build: HouseKitBuildData): HouseInteriorEvidence | undefined {
  if (build.interiorMapId === undefined) return undefined;
  const transfer = {
    doorEventId: build.doorEventId,
    exitEventId: build.exitEventId,
    exteriorMapId,
    interiorMapId: build.interiorMapId,
  };
  return {
    interiorMapId: build.interiorMapId,
    floorMapIds: build.floorMapIds,
    doorEventId: build.doorEventId,
    exitEventId: build.exitEventId,
    transfer,
  };
}

function restoreStartIfHouseCovered(before: Project, draft: Project): void {
  const startMap = draft.maps[draft.startMapId];
  const beforeMap = before.maps[before.startMapId];
  if (!startMap || !beforeMap) return;
  if (isPassable(draft, startMap, draft.startPos.x, draft.startPos.y)) return;
  const index = draft.startPos.y * startMap.width + draft.startPos.x;
  startMap.lowerTiles[index] = beforeMap.lowerTiles[index] ?? TILE.GRASS;
  startMap.upperTiles[index] = beforeMap.upperTiles[index] ?? TILE.EMPTY;
}

function validatePlans(request: AuthorHouseRequest): void {
  const plans = request.kind === "single" ? [request] : request.houses;
  for (const plan of plans) {
    if (plan.interior === "linked-interior" && !plan.door) {
      throw new ToolError("linked-interior에는 출입문이 필요합니다.", { code: "invalid-house-plan" });
    }
  }
  if (request.kind === "lots") validateLotSeparation(request.houses);
}

function validateLotSeparation(houses: readonly AuthorHousePlan[]): void {
  for (let left = 0; left < houses.length; left += 1) {
    for (let right = left + 1; right < houses.length; right += 1) {
      const overlaps = houses[left]?.wings.some((a) => houses[right]?.wings.some((b) => rectanglesOverlap(a, b)));
      if (overlaps) {
        throw new ToolError(`집 부지 #${left + 1}과 #${right + 1}이 겹칩니다.`, { code: "invalid-house-lots" });
      }
    }
  }
}

function rectanglesOverlap(left: HouseWing, right: HouseWing): boolean {
  return left.x < right.x + right.w && right.x < left.x + left.w
    && left.y < right.y + right.h && right.y < left.y + left.h;
}

function requestedCount(request: AuthorHouseRequest): number {
  return request.kind === "single" ? 1 : request.houses.length;
}

function constructionDiff(diff: ChangeSummary): ConstructionDiffTotals {
  return {
    tilesChanged: diff.tilesChanged,
    eventsAdded: diff.eventsAdded,
    eventsModified: diff.eventsModified,
    eventsRemoved: diff.eventsRemoved,
    mapsAdded: diff.mapsAdded,
    mapsRemoved: diff.mapsRemoved,
    dbRecordsChanged: diff.dbRecordsChanged,
    tilesetsChanged: diff.tilesetsChanged,
    switchesAdded: diff.switchesAdded,
    variablesAdded: diff.variablesAdded,
    worldEntitiesAdded: diff.worldEntitiesAdded,
    worldEntitiesModified: diff.worldEntitiesModified,
    palettePresetsAdded: diff.palettePresetsAdded,
    palettePresetsModified: diff.palettePresetsModified,
    endingsChanged: diff.endingsChanged,
    sessionChanged: diff.sessionChanged,
    systemChanged: diff.systemChanged,
  };
}
