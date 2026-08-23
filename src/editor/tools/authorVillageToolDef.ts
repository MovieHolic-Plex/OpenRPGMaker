import { parseAuthorVillageRequest } from "@/editor/construction/parseVillageRequest";
import { createDraft } from "./changeset";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { assertVillageMutationScope, restoreExistingTargetStart } from "./authorVillageScope";
import {
  assertInnerVillageSuccess,
  assertVillagePostconditions,
  buildVillageFacadeData,
  createExactVillageMap,
  villageDomainArgs,
} from "./authorVillageSupport";
import {
  buildVillageDomain,
  inspectVillageBuild,
  type VillageBuildDomainArgs,
  type VillageBuildInspection,
} from "./villageBuilder";
import { RECT_SCHEMA, VILLAGE_HOUSE_PLAN_SCHEMA } from "./schemaShapes";

export type AuthorVillageDependencies = {
  readonly build: (project: Parameters<typeof buildVillageDomain>[0], args: VillageBuildDomainArgs) => ToolExecResult;
  readonly inspect: (project: Parameters<typeof inspectVillageBuild>[0], result: ToolExecResult) => VillageBuildInspection;
};

const DEFAULT_DEPENDENCIES: AuthorVillageDependencies = {
  build: buildVillageDomain,
  inspect: inspectVillageBuild,
};

export function createAuthorVillageTool(dependencies: AuthorVillageDependencies = DEFAULT_DEPENDENCIES): ToolDefinition {
  return {
    name: "author_village",
    description:
      "Canonical village facade. Builds an exact or explicit best-effort house count on one locked existing/new target.",
    mode: "write",
    domains: ["tile", "map"],
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        // 파서(parseVillageRequest)의 허용 키와 **정확히** 같아야 한다. 2026-08-23 실측: 여기에
        // 평면 x/y/w/h 를 선언했더니 jsonSchema 의 좌표 별칭 정규화가 width→w 를 채우고 bounds 를
        // 평면으로 펼쳐, 파서의 rejectUnknownKeys 가 정상 인자를 invalid-args 로 되던졌다.
        target: {
          type: "object",
          description: "Existing map/bounds or exact new map descriptor.",
          properties: {
            kind: { type: "string", enum: ["existing", "new"] },
            mapId: { type: "string" },
            name: { type: "string", description: "kind=new 전용 맵 표시 이름." },
            width: { type: "integer", description: "kind=new 전용." },
            height: { type: "integer", description: "kind=new 전용." },
            plannedMap: {
              type: "object",
              description: "kind=new 전용. mapId·width·height 가 target 과 일치해야 한다.",
              properties: {
                mapId: { type: "string" },
                width: { type: "integer" },
                height: { type: "integer" },
              },
              required: ["mapId", "width", "height"],
            },
            bounds: { ...RECT_SCHEMA, description: "kind=existing 전용 작업 영역." },
          },
          required: ["kind", "mapId"],
        },
        houseCount: { type: "integer", description: "Requested exterior houses, 4-32 without clamping." },
        housePlans: { type: "array", items: VILLAGE_HOUSE_PLAN_SCHEMA },
        countPolicy: { type: "string", enum: ["exact", "best-effort"] },
        groundTheme: { type: "string", enum: ["grass", "snow"], description: "Whole-settlement ground preset. theme remains descriptive." },
        settlementLayout: { type: "string", enum: ["plaza-ring", "street-grid", "clusters"] },
        npcCount: { type: "integer", minimum: 0, maximum: 512, description: "Exact requested village NPC population." },
        theme: { type: "string" },
        seed: { type: "integer" },
        interior: { type: "boolean" },
      },
      required: ["target", "houseCount", "countPolicy"],
    },
    invalidArgsExample: {
      target: { kind: "existing", mapId: "map_town" },
      houseCount: 8,
      countPolicy: "exact",
      seed: 7,
      interior: false,
    },
    run(draft, args): ToolExecResult {
      const request = parseAuthorVillageRequest(args);
      const baseline = createDraft(draft);
      switch (request.target.kind) {
        case "existing":
          if (!draft.maps[request.target.mapId]) {
            throw new ToolError(`Map not found: ${request.target.mapId}`, { code: "map-not-found", mapId: request.target.mapId });
          }
          break;
        case "new":
          createExactVillageMap(draft, request.target);
          break;
      }
      const result = dependencies.build(draft, villageDomainArgs(request));
      assertInnerVillageSuccess(result, request.target.mapId);
      const inspection = dependencies.inspect(draft, result);
      assertVillagePostconditions(request, inspection);
      restoreExistingTargetStart(baseline, draft, request);
      const state = { baseline, draft, request, inspection };
      assertVillageMutationScope(state);
      const data = buildVillageFacadeData(state, result);
      return {
        summary: `Village authored: ${inspection.actualHouseCount}/${request.houseCount} houses on ${request.target.mapId}.`,
        data,
        ...(data.construction.warnings.length === 0 ? {} : { warnings: [...data.construction.warnings] }),
      };
    },
  };
}

export const AUTHOR_VILLAGE_TOOL = createAuthorVillageTool();