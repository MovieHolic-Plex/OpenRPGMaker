import { parseAuthorVillageRequest } from "@/editor/construction/parseVillageRequest";
import type { AuthorVillageRequest } from "@/editor/construction/contracts";
import { TILE, DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { isCombinedTownTileset } from "@/project/tilesetHarness/combinedTown";
import { estimateVillageSize } from "@/ai/constructionDeclaration";
import type { GameMap, Project } from "@/project/types";
import { createDraft } from "./changeset";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { resizedTileStacks } from "@/project/mapOverlayTiles";
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

import { resolveVillageDesignInput } from "./village/designContract";
import { villageObjectHouseCatalog } from "./village/objectHouses";
import { assertVillagePublicAccess } from "./village/lakeside";
import { chooseCompactHouses } from "./village/compactComposition";

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
  // Object mode validates an incompatible legacy request; never erase that evidence first.
  if (args.houseObjectIds !== undefined || args.housePlans.some(entry => entry && typeof entry === "object" && "objectId" in entry)) {
    return { args, warnings: [] };
  }
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
      "마을 설계서가 있으면 presetId 또는 기본 설계서를 사용한다. 고정값은 생략하고 범위 안의 값만 요청한다. 충돌(village-design-conflict)은 DB 설계서를 바꾸기 전까지 재시공하지 말고 사용자에게 차이를 알린다. houseCount는 설계서가 없을 때 필수다. 시공 순서는 집 → 길 → 나무 → 호수·마당·맵 장식이다. 물·마당 자리는 계획에서 예약하고 실제 물은 마지막에 칠한다. Canonical village facade. Builds an exact or explicit best-effort house count on one locked existing/new target. 마을 숲은 forestDensity 를 반드시 넣는다(테마 문장만 쓰고 density 를 빼지 말 것). 사용자가 선택 영역을 준 턴은 target:{kind:\"existing\", mapId, bounds} 로 그 맵 그 사각형만 대상으로 하고 새 맵을 만들지 말 것. 「이 마을 정리」처럼 수량이 없어도 같다.",
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
        houseObjectIds: {
          type: "array", items: { type: "string" },
          description: "저장된 건물 오브젝트 후보 ID. list_spatial_designs(kind:object)로 찾은 건물 외형을 넣으면 지붕·벽·복수 현관을 그대로 사용하고 서로 다른 형태를 먼저 선택한다. 개별 확정은 housePlans[].objectId. 외형은 실내를 뜻하지 않으므로 interior:false; 실제 실내가 필요하면 별도 공간/장소로 연결한다.",
        },
        composition: { type: "string", enum: ["compact"],
          description: "조밀한 주거 마을 권장값. 저장된 후보 중 통나무 벽과 15×15 초과 집은 제외하며, 10×10 초과 큰집은 최대 2채만 쓴다. 작은 집을 가까이 배치하고 비대칭 호수·풍부한 나무 군락·243계열 풀밭을 조성한다. 집별 objectId를 명시하면 이 기준과의 충돌은 거부한다." },
        housePlans: {
          type: "array",
          description: "Optional per-house plans. Length must equal houseCount.",
          items: {
            type: "object",
            properties: {
              objectId: { type: "string", description: "이 집에 사용할 저장된 건물 외형 오브젝트 ID. kitId/templateId와 동시 지정 불가." },
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
      required: ["target", "countPolicy"],
    },
    invalidArgsExample: {
      target: { kind: "existing", mapId: "map_town" },
      houseCount: 2,
      countPolicy: "exact",
      seed: 7,
      interior: false,
    },
    run(draft, args): ToolExecResult {
      const designed = resolveVillageDesignInput(draft, args, true);
      // 신규 맵 크기 생략 시 코드가 유일한 환산기(estimateVillageSize)로 채운다 — 모델 창작 아님.
      // 파서보다 먼저 채워야 파서의 plannedMap 합성이 target 값을 볼 수 있다(2026-09-11).
      const sized = fillMissingVillageDimensions(designed, draft);
      const normalized = normalizeUnknownHouseTemplates(sized, knownTemplateIds(draft));
      const request = parseAuthorVillageRequest(normalized.args);
      // 검증 후 변이: 맵 생성(createExactVillageMap)보다 먼저 타일셋·수용성을 검사한다.
      // 기존 맵 타일셋이 combined_town이 아니면 시공 전에 거부 — 반쯤 지은 draft를 피한다.
      // 스코프 검사(baseline 스냅샷)가 확장을 "target 변경"으로 읽지 않게 성장은 baseline보다 먼저.
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
      if ((request.houseObjectIds || request.housePlans?.some(plan => plan.objectId)) && draft.startMapId === request.target.mapId) {
        assertVillagePublicAccess(draft, draft.maps[request.target.mapId]!, draft.startPos);
      }
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
  if (request.target.fullMap === true && bounds
    && (bounds.x !== 0 || bounds.y !== 0 || bounds.w !== map.width || bounds.h !== map.height)) {
    throw new ToolError(
      `fullMap:true 와 부분 bounds가 충돌합니다. 전체 ${map.width}×${map.height} 시공이면 bounds를 생략하고, 부분 시공이면 fullMap을 빼세요.`,
      { code: "village-scope-conflict", mapId: map.id },
    );
  }
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
  // 2026-09-11 P2: 부족하면 실패 대신 좌상단-유지 잔디 확장(resize_map과 같은 규약) —
  // 기존 맵은 이벤트 잘림 없이 커지기만 하므로 비파괴다. 확장부는 잔디(TILE.GRASS)로,
  // 뒤이은 마을 시공이 그 자리를 채운다. 축소는 하지 않는다 — 이벤트·시작 좌표 가드가 필요해진다.
  if (w < MIN_BOUNDS_SIZE || h < MIN_BOUNDS_SIZE || w > map.width || h > map.height) {
    if (bounds) {
      throw new ToolError(
        `author_village는 최소 ${MIN_BOUNDS_SIZE}x${MIN_BOUNDS_SIZE} 영역이 필요합니다: ${w}x${h}`,
        { code: "bounds-too-small", mapId: map.id },
      );
    }
    const width = Math.max(w, MIN_BOUNDS_SIZE);
    const height = Math.max(h, MIN_BOUNDS_SIZE);
    growExistingVillageMap(map, width, height);
  }
}

/** 좌상단 기준 잔디 확장 — resize_map 도구와 같은 데이터 규약(확장부 잔디, 스택 재배치, 이벤트 불변). */
function growExistingVillageMap(map: GameMap, width: number, height: number): void {
  const oldW = map.width;
  const oldH = map.height;
  const nextLower = new Array<number>(width * height).fill(TILE.GRASS);
  const nextUpper = new Array<number>(width * height).fill(TILE.EMPTY);
  for (let y = 0; y < oldH; y += 1) {
    for (let x = 0; x < oldW; x += 1) {
      nextLower[y * width + x] = map.lowerTiles[y * oldW + x];
      nextUpper[y * width + x] = map.upperTiles[y * oldW + x];
    }
  }
  const nextLowerStacks = resizedTileStacks(map.lowerTileStacks, oldW, oldH, width, height);
  const nextUpperStacks = resizedTileStacks(map.upperTileStacks, oldW, oldH, width, height);
  map.width = width;
  map.height = height;
  map.lowerTiles = nextLower;
  map.upperTiles = nextUpper;
  if (nextLowerStacks) map.lowerTileStacks = nextLowerStacks;
  if (nextUpperStacks) map.upperTileStacks = nextUpperStacks;
}

/**
 * 신규 맵 target의 width/height가 없으면 의도 선언과 같은 환산기로 채운다. 기존 맵은 그대로 —
 * 기존 맵 크기는 사용자가 이미 정한 사실이다(투기 없음). 근거(source)는 결과가 아닌 계산에만
 * 쓰이므로 args에 흔적을 남기지 않는다.
 */
export function fillMissingVillageDimensions(args: Record<string, unknown>, project?: Project): Record<string, unknown> {
  const target = args.target;
  if (typeof target !== "object" || target === null || Array.isArray(target)) return args;
  const record = target as Record<string, unknown>;
  if (record.kind !== "new") return args;
  const recordHasNumber = (key: "width" | "height"): key is "width" | "height" =>
    typeof record[key] === "number" && Number.isSafeInteger(record[key]);
  if (recordHasNumber("width") && recordHasNumber("height")) return args;
  const declared = typeof args.houseCount === "number" && Number.isSafeInteger(args.houseCount)
    ? { houseCount: args.houseCount } : {};
  let size = estimateVillageSize(declared);
  const objects = project ? villageObjectHouseCatalog(project, args) : undefined;
  const count = declared.houseCount;
  if (objects?.length && count && count >= 1 && count <= 32) {
    const sorted = [...objects].sort((a, b) => b.raster.width * b.raster.height - a.raster.width * a.raster.height);
    const plans = Array.isArray(args.housePlans) ? args.housePlans as Record<string, unknown>[] : [];
    const compact = args.composition === "compact";
    const rasters = compact ? chooseCompactHouses(sorted, count, plans).map(house => house.raster)
      : Array.from({ length: count }, (_, i) => objects.find(h => h.design.id === plans[i]?.objectId)?.raster ?? sorted[i % sorted.length]!.raster);
    const lotArea = rasters.reduce((sum, raster) => sum + (raster.width + (compact ? 2 : 4)) * (raster.height + (compact ? 4 : 6)), 0);
    // Keep room for the market, connected streets and reserved nature in addition to actual lots.
    const floorArea = lotArea / (compact ? 0.46 : 0.42), side = Math.ceil(Math.sqrt(floorArea));
    // A central reserved plaza splits the usable span; total area alone cannot fit even
    // one long house. Reserve a full largest lot on either side of the commons.
    const minWidth = 2 * (Math.max(...rasters.map(r => r.width)) + (compact ? 2 : 4)) + (compact ? 28 : 24);
    const minHeight = 2 * (Math.max(...rasters.map(r => r.height)) + (compact ? 4 : 6)) + (compact ? 22 : 18);
    size = { ...size, width: Math.max(minWidth, recordHasNumber("height") ? Math.ceil(floorArea / Number(record.height)) : side),
      height: Math.max(minHeight, recordHasNumber("width") ? Math.ceil(floorArea / Number(record.width)) : side) };
  }
  return {
    ...args,
    target: {
      ...record,
      ...(recordHasNumber("width") ? {} : { width: size.width }),
      ...(recordHasNumber("height") ? {} : { height: size.height }),
    },
  };
}
