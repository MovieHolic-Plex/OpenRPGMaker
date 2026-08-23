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
import { RECT_SCHEMA } from "./schemaShapes";
import { HOUSE_TEMPLATES } from "./village/constants";

export type AuthorVillageDependencies = {
  readonly build: (project: Parameters<typeof buildVillageDomain>[0], args: VillageBuildDomainArgs) => ToolExecResult;
  readonly inspect: (project: Parameters<typeof inspectVillageBuild>[0], result: ToolExecResult) => VillageBuildInspection;
};

const DEFAULT_DEPENDENCIES: AuthorVillageDependencies = {
  build: buildVillageDomain,
  inspect: inspectVillageBuild,
};

const KNOWN_VILLAGE_TEMPLATE_IDS = new Set(HOUSE_TEMPLATES.map((template) => template.id));

function normalizeUnknownHouseTemplates(args: Record<string, unknown>): {
  readonly args: Record<string, unknown>;
  readonly warnings: readonly string[];
} {
  if (!Array.isArray(args.housePlans)) return { args, warnings: [] };
  const warnings: string[] = [];
  const housePlans = args.housePlans.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return entry;
    const plan = { ...(entry as Record<string, unknown>) };
    const templateId = plan.templateId;
    if (typeof templateId === "string" && templateId && !KNOWN_VILLAGE_TEMPLATE_IDS.has(templateId)) {
      delete plan.templateId;
      warnings.push("housePlans[" + index + "].templateId=\'" + templateId + "\'는 알려진 템플릿이 아니어서 자동 선택으로 대체했습니다.");
    }
    return plan;
  });
  return { args: { ...args, housePlans }, warnings };
}

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
        target: {
          type: "object",
          description: "Existing map/bounds or exact new map descriptor.",
          properties: {
            kind: { type: "string", enum: ["existing", "new"] },
            mapId: { type: "string" },
            name: { type: "string" },
            width: { type: "integer" },
            height: { type: "integer" },
            bounds: RECT_SCHEMA,
            plannedMap: {
              type: "object",
              properties: {
                mapId: { type: "string" },
                width: { type: "integer" },
                height: { type: "integer" },
              },
              required: ["mapId", "width", "height"],
              additionalProperties: false,
            },
          },
          required: ["kind", "mapId"],
          additionalProperties: false,
        },
        houseCount: { type: "integer", minimum: 1, maximum: 32, description: "Requested exterior houses, 1-32 without clamping." },
        housePlans: {
          type: "array",
          description: "Optional per-house plans. Length must equal houseCount.",
          items: {
            type: "object",
            properties: {
              kitId: { type: "string" },
              yard: { type: "array", items: { type: "string" } },
              ownerName: { type: "string" },
              templateId: {
                type: "string",
                description: `선택 사항. 알려진 템플릿 id만 사용하고 확실하지 않으면 생략: ${HOUSE_TEMPLATES.map((template) => template.id).join(", ")}`,
              },
              program: { type: "string", enum: ["dwelling", "shop", "inn", "workshop", "study", "manor"] },
            },
            additionalProperties: false,
          },
        },
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
      houseCount: 2,
      countPolicy: "exact",
      seed: 7,
      interior: false,
    },
    run(draft, args): ToolExecResult {
      const normalized = normalizeUnknownHouseTemplates(args);
      const request = parseAuthorVillageRequest(normalized.args);
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
      const built = dependencies.build(draft, villageDomainArgs(request));
      const result = normalized.warnings.length === 0
        ? built
        : { ...built, warnings: [...(built.warnings ?? []), ...normalized.warnings] };
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
