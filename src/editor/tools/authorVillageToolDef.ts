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
import { villageTemplateCatalog } from "./village/authoringData";
import { HOUSE_TEMPLATES } from "./village/constants";

export type AuthorVillageDependencies = {
  readonly build: (project: Parameters<typeof buildVillageDomain>[0], args: VillageBuildDomainArgs) => ToolExecResult;
  readonly inspect: (project: Parameters<typeof inspectVillageBuild>[0], result: ToolExecResult) => VillageBuildInspection;
};

const DEFAULT_DEPENDENCIES: AuthorVillageDependencies = {
  build: buildVillageDomain,
  inspect: inspectVillageBuild,
};

/**
 * 이 프로젝트에서 쓸 수 있는 형태 id — 내장 34종 + 사용자가 「마을」탭에서 만든 형태.
 * 예전엔 코드 카탈로그만 봐서, 사용자가 만든 형태를 AI가 지정하면 조용히 지워졌다.
 */
function knownTemplateIds(project: Parameters<typeof villageTemplateCatalog>[0]): Set<string> {
  return new Set(villageTemplateCatalog(project).templates.map((template) => template.id));
}

function normalizeUnknownHouseTemplates(
  args: Record<string, unknown>,
  known: ReadonlySet<string>,
): {
  readonly args: Record<string, unknown>;
  readonly warnings: readonly string[];
} {
  if (!Array.isArray(args.housePlans)) return { args, warnings: [] };
  const warnings: string[] = [];
  const housePlans = args.housePlans.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return entry;
    const plan = { ...(entry as Record<string, unknown>) };
    const templateId = plan.templateId;
    if (typeof templateId === "string" && templateId && !known.has(templateId)) {
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
        // 파서(parseVillageRequest)의 허용 키와 **정확히** 같아야 한다. 2026-08-23 실측: 여기에
        // 평면 x/y/w/h 를 선언했더니 jsonSchema 의 좌표 별칭 정규화가 width→w 를 채우고 bounds 를
        // 평면으로 펼쳐, 파서의 rejectUnknownKeys 가 정상 인자를 invalid-args 로 되던졌다.
        target: {
          type: "object",
          description: "Existing map/bounds or exact new map descriptor.",
          properties: {
            kind: { type: "string", enum: ["existing", "new"] },
            mapId: { type: "string" },
            name: { type: "string" },
            width: { type: "integer" },
            height: { type: "integer" },
            bounds: {
              ...RECT_SCHEMA,
              description:
                "kind=\"existing\" 일 때 시공 범위. **생략하면 사용자가 보고 있는 화면(뷰포트) 중심의 영역에 짓고, "
                + "뷰포트를 모를 때만 맵 전체를 재포장한다** — 손댈 영역이 정해진 요청이면 그 영역을 직접 지정하라. "
                + "w/h 가 최소값(20)보다 작으면 거부되니 20 이상으로 넓혀 쓰거나 생략해 뷰포트에 맡길 것.",
            },
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
        forestDensity: {
          type: "string",
          enum: ["sparse", "normal", "dense", "impassable"],
          description:
            "숲 밀도. 모델이 사용자 요청을 읽어 넣는다(숲=dense, 울창/빽빽/밀림/통행 불가=impassable, 드문드문/가로수=sparse). "
            + "코드는 테마 문장을 정규식으로 읽지 않는다. 생략하면 DB 생성 규칙의 저작 개수.",
        },
        seed: { type: "integer" },
        interior: { type: "boolean" },
        presetId: {
          type: "string",
          description:
            "선택 사항. 사용자가 데이터베이스 「마을」탭에 저장한 배치 프리셋 id."
            + " 컨텍스트의 '마을 저작 데이터' 목록에 있는 id만 쓰고, 없으면 생략한다."
            + " 프리셋이 정한 길 폭·광장·마당·형태 후보가 코드 기본값을 대체한다.",
        },
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
      const normalized = normalizeUnknownHouseTemplates(args, knownTemplateIds(draft));
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
      const scopeWarnings = assertVillageMutationScope(state);
      const data = buildVillageFacadeData(state, result);
      const warnings = [...data.construction.warnings, ...scopeWarnings];
      return {
        summary: `Village authored: ${inspection.actualHouseCount}/${request.houseCount} houses on ${request.target.mapId}.`,
        data,
        ...(warnings.length === 0 ? {} : { warnings }),
      };
    },
  };
}

export const AUTHOR_VILLAGE_TOOL = createAuthorVillageTool();
