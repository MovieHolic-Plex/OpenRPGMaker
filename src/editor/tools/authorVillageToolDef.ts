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
        target: { type: "object", description: "Existing map/bounds or exact new map descriptor." },
        houseCount: { type: "integer", description: "Requested exterior houses, 4-32 without clamping." },
        housePlans: { type: "array", items: { type: "object" } },
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