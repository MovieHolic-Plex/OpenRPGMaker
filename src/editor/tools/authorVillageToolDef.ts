import { parseAuthorVillageRequest } from "@/editor/construction/parseVillageRequest";
import type { AuthorVillageRequest } from "@/editor/construction/contracts";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { isCombinedTownTileset } from "@/project/tilesetHarness/combinedTown";
import type { Project } from "@/project/types";
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
import { HOUSE_TEMPLATES, MIN_BOUNDS_SIZE } from "./village/constants";

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
      "Canonical village facade. Builds an exact or explicit best-effort house count on one locked existing/new target. 마을 숲은 forestDensity 를 반드시 넣는다(테마 문장만 쓰고 density 를 빼지 말 것). 사용자가 선택 영역을 준 턴은 target:{kind:\"existing\", mapId, bounds} 로 그 맵 그 사각형만 대상으로 하고 새 맵을 만들지 말 것. 「이 마을 정리」처럼 수량이 없어도 같다.",
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
                "kind=\"existing\" 일 때 시공 범위. 생략하면 사용자가 보고 있는 화면(뷰포트) 중심의 영역에 짓고, "
                + "뷰포트를 모를 때만 맵 전체를 재포장한다 — 손댈 영역이 정해진 요청이면 그 영역을 직접 지정하라. "
                + "w/h 하한은 16이다(파서가 받는다). 단 16×16에는 집 1채+길이 빡빡해 시공 실패가 잦으니 "
                + "뷰포트 기본 시공은 20×20 중심 사각형을 쓰고, bounds 없이 맵 전체를 새로 깔려면 fullMap:true — "
                + "단 맵에 이미 내용이 있으면 필수다.",
            },
            plannedMap: {
              type: "object",
              description: "선택. 생략하면 target 값으로 채운다. 주면 mapId·width·height가 target과 일치해야 한다.",
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
        houseCount: { type: "integer", minimum: 1, maximum: 32, description: "Requested exterior houses, 1-32 without clamping. best-effort도 4채 이하는 exact와 같다(하한 85%가 4 미만으로 안 내려간다)." },
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
        countPolicy: { type: "string", enum: ["exact", "best-effort"], description: "exact=정확히 houseCount, best-effort=85% 하한(4채 이하는 exact와 같음)." },
        groundTheme: { type: "string", enum: ["grass", "snow"], description: "Whole-settlement ground preset. theme remains descriptive." },
        settlementLayout: { type: "string", enum: ["plaza-ring", "street-grid", "clusters"] },
        npcCount: { type: "integer", minimum: 0, maximum: 512, description: "Requested village NPC population. 하한 90%(최소 2명 관용)로 판정 — 1~2명 어긋남은 실패가 아니다." },
        residents: {
          type: "array",
          description:
            "주민 이름·역할·대사 [{name, role?, lines?}] — 순서대로 소비된다(집 주인 → 광장). 테마에 맞는 이름, 서로를 언급하는 대사, 세계관 개체 언급을 넣어라. "
            + "생략하면 주민은 대사 없이 놓이고 세션의 캐스트 라이터가 한 번에 써서 채운다(코드는 대사를 지어내지 않는다).",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string" },
              lines: { type: "array", items: { type: "string" } },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
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
        fullMap: {
          type: "boolean",
          description:
            "target.kind=\"existing\" + bounds 생략 + 맵에 이미 내용이 있을 때 전체 재시공 확인. "
            + "빈 맵은 없이도 전체 시공, bounds가 있으면 불필요하다.",
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
      // 검증 후 변이: 맵 생성(createExactVillageMap)보다 먼저 타일셋·수용성을 검사한다.
      // 기존 맵 타일셋이 combined_town이 아니면 시공 전에 거부 — 반쯤 지은 draft를 피한다.
      assertTargetTilesetUsable(draft, request);
      assertTargetCapacity(draft, request);
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

/**
 * 변이 전 사전 검사 — 맵 생성·시공보다 먼저.
 * - 타일셋: 기존 맵이 combined_town이 아니면 시공 전에 거부(village-tileset-mismatch).
 *   새 맵은 createExactVillageMap이 DEFAULT_TILESET_ID로 만들므로 항상 통과.
 * - 수용성: 시공 영역(bounds 또는 맵 전체)이 20×20 미만이면 거부(bounds-too-small/map-too-small).
 *   집 슬롯 1열도 못 놓는 면적에 집 N채 요구가 오면 늦은 no-houses-built 대신 여기서 실패.
 */
function assertTargetTilesetUsable(draft: Project, request: AuthorVillageRequest): void {
  if (request.target.kind !== "existing") return;
  const map = draft.maps[request.target.mapId];
  if (!map) return; // map-not-found는 기존 순서대로 뒤에서 처리한다.
  const tileset = draft.tilesets?.[map.tilesetId];
  if (!tileset || !isCombinedTownTileset(tileset)) {
    throw new ToolError(
      `author_village는 combined_town 칩셋(${DEFAULT_TILESET_ID}) 전용이다 — 이 맵의 타일셋: ${map.tilesetId}. ` +
        "다른 타일 그림판에서는 문/울타리/돌마당 타일 id가 전부 다른 그림이 된다.",
      { code: "village-tileset-mismatch", mapId: map.id },
    );
  }
}

function assertTargetCapacity(draft: Project, request: AuthorVillageRequest): void {
  if (request.target.kind !== "existing") return;
  const map = draft.maps[request.target.mapId];
  if (!map) return;
  const bounds = request.target.bounds;
  // 새 맵 생성(createVillageMap 기본 50×50)과 달리 기존 맵은 있는 크기가 전부다 —
  // 집 1채 슬롯(8+여백)도 안 나오는 면적이면 여기서 거부한다.
  const w = bounds?.w ?? map.width;
  const h = bounds?.h ?? map.height;
  const area = { x: bounds?.x ?? 0, y: bounds?.y ?? 0, w, h };
  if (area.x < 0 || area.y < 0 || area.x + area.w > map.width || area.y + area.h > map.height) {
    throw new ToolError(
      `author_village bounds가 맵 경계를 벗어납니다: ${area.x},${area.y},${area.w}x${area.h}`,
      { code: "bounds-out-of-map", mapId: map.id },
    );
  }
  if (w < MIN_BOUNDS_SIZE || h < MIN_BOUNDS_SIZE) {
    throw new ToolError(
      `author_village는 최소 ${MIN_BOUNDS_SIZE}x${MIN_BOUNDS_SIZE} 영역이 필요합니다: ${w}x${h}`,
      { code: bounds ? "bounds-too-small" : "map-too-small", mapId: map.id },
    );
  }
}
