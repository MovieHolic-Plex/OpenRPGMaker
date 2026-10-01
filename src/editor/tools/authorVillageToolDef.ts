import { defaultOutdoorTilesetId } from "@/project/defaults/forestHarmony";
import { RIVER_VILLAGE_STYLE_GUIDANCE } from "@/project/defaults/riverVillageStyle";
import { prepareVillageDefaultTileset } from "./village/defaultTileset";
import { applyVillageClimate, borrowForestHarmonyForClimateSheet } from "./village/villageClimate";
import { placeVillageLandmark } from "./village/villageLandmark";
import { purgeStaleVillageInteriors } from "./village/interiors";
import { withVillageMorphologyDefault } from "./village/defaultMorphology";
import { VILLAGE_MORPHOLOGIES } from "./village/morphologyTypes";
import { parseAuthorVillageRequest } from "@/editor/construction/parseVillageRequest";
import type { AuthorVillageRequest } from "@/editor/construction/contracts";
import { TILE } from "@/project/defaults/constants";
import { isCombinedTownCompatibleTileset } from "@/project/tilesetHarness/combinedTown";
import { estimateVillageSize } from "@/ai/constructionDeclaration";
import type { GameMap, Project } from "@/project/types";
import { createDraft } from "./changeset";
import { AUTHOR_BEODEUL_TOWN_TOOL } from "./authorBeodeulTown";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { resizedTileStacks } from "@/project/mapOverlayTiles";
import { cropExtraLayers } from "@/project/mapLayers";
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
import { villageFormTemplates, villageGableTemplates } from "./village/authoringData";
import { HOUSE_TEMPLATES, MIN_BOUNDS_SIZE } from "./village/constants";

import { resolveVillageDesignInput } from "./village/designContract";
import { villageObjectHouseCatalog } from "./village/objectHouses";
import { assertVillagePublicAccess } from "./village/lakeside";
import { chooseCompactHouses } from "./village/compactComposition";
import { villageReferenceExamples } from "@/ai/villageReferenceExamples";
import { MORPHOLOGY_LABEL } from "./village/morphologyTypes";

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
    description: RIVER_VILLAGE_STYLE_GUIDANCE + " " +
      "마을 설계서가 있으면 presetId 또는 기본 설계서를 사용한다. 고정값은 생략하고 범위 안의 값만 요청한다. 충돌(village-design-conflict)은 DB 설계서를 바꾸기 전까지 재시공하지 말고 사용자에게 차이를 알린다. houseCount는 설계서가 없을 때 필수다. 시공 순서는 집 → 길 → 나무 → 호수·마당·맵 장식이다. 물·마당 자리는 계획에서 예약하고 실제 물은 마지막에 칠한다. Canonical village facade. Builds an exact or explicit best-effort house count on one locked existing/new target. 설계서의 자연 설정이 고정이면 forestDensity는 생략한다(숲 없음에는 지정 금지). 자유 설정에서 숲 요청이 있으면 forestDensity를 넣는다. 숲마을 칩셋의 군락은 「굽이숲 절벽마을」의 연결 수관과 3줄 밑동으로 조립하고 길·집 앞 공터를 보존한다. 사용자가 선택 영역을 준 턴은 target:{kind:\"existing\", mapId, bounds} 로 그 맵 그 사각형만 대상으로 하고 새 맵을 만들지 말 것. 「이 마을 정리」처럼 수량이 없어도 같다.",
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
            name: { type: "string", description: "마을(맵) 이름. kind=new 는 필수. kind=existing 이면 시공 뒤 그 맵 이름을 이것으로 바꾼다 — 생략하면 '빈 맵' 같은 자리표시 이름만 '마을'로 바꾼다." },
            tilesetId: { type: "string", description: "kind=new 전용. 생략하면 프로젝트 야외 기본(새 프로젝트는 버들항 — 이 경우 author_beodeul_town 으로 넘어간다, 그 밖엔 숲마을). 사용자가 선택한 칩셋은 여기에 지정한다. 기존 맵은 원래 칩셋을 유지한다." },
            width: { type: "integer" },
            height: { type: "integer" },
            minSize: {
              type: "object",
              description: "kind=existing·bounds 생략 전용. 맵을 적어도 이 크기로 넓힌다(좌상단 유지, 줄이지 않음). 마을 계약이 참고 마을 크기를 옮길 때 쓴다.",
              properties: { width: { type: "integer" }, height: { type: "integer" } },
              required: ["width", "height"],
              additionalProperties: false,
            },
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
        multiStoreyCount: { type: "integer", minimum: 0, maximum: 32, description: "2층 이상 외형의 정확한 합계. 큰집도 포함. compact에서 사용." },
        houseClustering: { type: "string", enum: ["balanced", "tight"], description: "tight는 작은 집을 가까운 주택군으로 모은다. compact에서 사용." },
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
                description: `선택 사항. 알려진 템플릿 id만 사용하고 확실하지 않으면 생략(생략하면 박공 조합 형태가 먼저 골고루 섞인다): ${[...villageGableTemplates(), ...HOUSE_TEMPLATES, ...villageFormTemplates()].map((template) => template.id).join(", ")}. gable-* 는 박공 조합 형태(정면 세모 박공·교차 박공·현관 박공·측면 박공 — 재료는 kitId 를 따른다), ref-walled-*/ref-castle-* 는 정주지·왕궁 도시 참고 사례에서 옮긴 박공집 셀 레시피(재료 고정)다.`,
              },
              fence: { type: "boolean", description: "이 집에만 울타리. 기본 없음. 명시한 manor(부잣집)는 생략 시 true이며 false로 해제 가능. 중요한 집에만 지정하세요." },
              program: { type: "string", enum: ["dwelling", "shop", "inn", "workshop", "study", "manor"] },
            },
            additionalProperties: false,
          },
        },
        countPolicy: { type: "string", enum: ["exact", "best-effort"], description: "exact=정확히 houseCount, best-effort=85% 하한(4채 이하는 exact와 같음)." },
        groundTheme: { type: "string", enum: ["grass", "snow", "desert", "volcano", "autumn"], description: "마을 전체 지면·기후. 숲마을 칩셋 마을을 칸 번호가 같은 기후 칩셋으로 옮긴다. snow: 설원(forest_harmony_snow)·맵 날씨 눈 — 이 마을 아래 실내·던전의 전투 배경도 설원. desert: 사막(forest_harmony_desert) — 잎 달린 숲을 걷고 잎 없는 고목 덩이·선인장, 물가 야자. volcano: 화산(forest_harmony_volcano) — 잎 없는 고목 덩이·바위. autumn: 가을(forest_harmony_autumn). desert·volcano·autumn 은 꽃덤불·화분도 뺀다. 기후 칩셋을 target.tilesetId 로 줘도 같다. theme 문장은 코드가 읽지 않으니 기후 마을이면 반드시 지정한다." },
        landmark: { type: "string", enum: ["lighthouse"], description: "마을 안 랜드마크. lighthouse=물가(물이 없으면 북쪽) 빈 땅에 둥근 탑 등대(2×5, 꼭대기 등불)를 세우고 입구 앞칸 좌표를 경고로 돌려준다 — 그 좌표로 create_transfer_pair 해 등대 맵과 잇는다. 기획에 등대가 있으면 지정한다(theme 문장은 코드가 읽지 않는다)." },
        settlementLayout: { type: "string", enum: ["plaza-ring", "street-grid", "clusters"] },
        morphology: {
          type: "string",
          enum: [...VILLAGE_MORPHOLOGIES],
          description: "취락 형태 유형. river=중앙 강·다리·양안 주거(빈 맵의 배치 미지정 기본값), street=가로촌(큰길 하나·집 줄·뒷골목), green=광장촌(렌즈형 녹지와 연못을 두 호가 감싼다), round=환촌(원형 녹지·링 길·남쪽 입구), cluster=괴촌(관심도 성장 시뮬레이션). 지정하면 뼈대 길 → 길에 면한 필지 → 집 → 밭·과수원 → 거리 기울기 나무 순서로 짓고 settlementLayout 은 무시한다. 배치 요청이 없으면 생략한다. 저장 설계서·기존 지형은 기본형보다 우선한다.",
        },
        relief: {
          type: "string",
          enum: ["none", "hills"],
          description: "고저차. hills=언덕·단구·2단 둔덕(45° 대각 변, 남쪽 절벽 면). 숲마을 또는 「합본 마을+레트로 월드맵」 칩셋 맵에서만 그려지고 morphology 와 함께 쓴다. 집·밭은 언덕 띠를 피하고 큰길이 띠를 지나 비탈이 된다.",
        },
        npcCount: { type: "integer", minimum: 0, maximum: 512, description: "Requested village NPC population. 하한 90%(최소 2명 관용)로 판정 — 1~2명 어긋남은 실패가 아니다." },
        residents: {
          type: "array",
          description:
            "주민 이름·역할·대사 [{name, role?, lines?}] — 순서대로 소비된다(집 주인 → 광장). 테마에 맞는 이름, 서로를 언급하는 대사, 세계관 개체 언급을 넣어라. "
            + "생략하면 주민은 대사 없이 놓인다. residents[].lines를 직접 주거나 author_npc_cast로 보충해야 한다. Pi는 종료 전에 누락을 검사해 보충을 요청하며 남아 있으면 미완료로 보고한다(코드는 대사를 지어내지 않는다).",
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
        referenceId: {
          type: "string",
          description: "선택. 결과가 비교할 완성 마을 사례 id([참고 마을] 노트·read_region_reference 목록). 시공 배치는 바꾸지 않고 결과의 referenceVillages 첫 자리와 그림만 정한다.",
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
      // 버들항 타일셋 대상이면 숲마을 생성기가 아니라 블록 조립 생성기로 보낸다(이 생성기는 버들항 그림을 모른다).
      const beodeul = rerouteToBeodeulTown(draft, args);
      if (beodeul) return beodeul;
      // referenceId 는 결과 비교용 — 파서(허용 키 고정)와 시공기에 넘기지 않는다.
      const { referenceId: rawReferenceId, ...buildArgs } = args;
      const referenceId = typeof rawReferenceId === "string" && rawReferenceId.trim() ? rawReferenceId.trim() : undefined;
      args = buildArgs;
      // 파서는 existing 대상의 name 을 반대 변형 필드로 버린다 — 이름 바꾸기용으로 먼저 잡아 둔다.
      const requestedExistingName = existingTargetName(args);
      const designed = withVillageMorphologyDefault(draft, resolveVillageDesignInput(draft, args, true));
      // 신규 맵 크기 생략 시 코드가 유일한 환산기(estimateVillageSize)로 채운다 — 모델 창작 아님.
      // 파서보다 먼저 채워야 파서의 plannedMap 합성이 target 값을 볼 수 있다(2026-09-11).
      const sized = fillMissingVillageDimensions(designed, draft);
      const normalized = normalizeUnknownHouseTemplates(sized, knownTemplateIds(draft));
      // 기후 칩셋(설원 등) 맵은 칸 번호가 같은 숲마을 칩셋으로 지은 뒤 되돌린다 — 스코프 baseline 보다 먼저.
      const borrowed = borrowForestHarmonyForClimateSheet(draft, parseAuthorVillageRequest(normalized.args));
      const request = borrowed.request;
      // 검증 후 변이: 맵 생성(createExactVillageMap)보다 먼저 타일셋·수용성을 검사한다.
      // 기존 맵 타일셋이 숲마을·합본 마을 호환이 아니면 시공 전에 거부 — 반쯤 지은 draft를 피한다.
      // 스코프 검사(baseline 스냅샷)가 확장을 "target 변경"으로 읽지 않게 성장은 baseline보다 먼저.
      prepareVillageDefaultTileset(draft, request);
      assertTargetTilesetUsable(draft, request);
      assertTargetCapacity(draft, request);
      // 재시공 정리는 baseline 스냅샷보다 먼저 — 뒤에 지우면 새로 만든 실내가 baseline 에 이미 있던
      // id 로 잡혀 "pre-existing map as an interior" 로 거부된다(2026-09-24 연애 romance-r2 replay).
      if (request.target.kind === "existing" && draft.maps[request.target.mapId]) {
        purgeStaleVillageInteriors(draft, draft.maps[request.target.mapId]!);
      }
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
      const renameWarnings = request.target.kind === "existing"
        ? renameVillageTargetMap(draft, request.target.mapId, requestedExistingName)
        : [];
      // 랜드마크는 숲마을 칩셋일 때 세운다 — 기후 칩셋은 칸 번호가 같아 그대로 옮겨 간다.
      const landmark = request.landmark ? placeVillageLandmark(draft, request.target.mapId, request.landmark) : undefined;
      const climateWarnings = applyVillageClimate(draft, request, borrowed.climate);
      const warnings = [...data.construction.warnings, ...scopeWarnings, ...renameWarnings, ...(landmark?.warnings ?? []), ...climateWarnings];
      // 지은 마을과 가장 가까운 완성 마을 사례(테마·이름·배치로 고른다)를 나란히 둔다 — 첫 사례 그림은
      // Pi·채팅 어댑터가 모델 입력에 붙인다(2026-09-28). 계약 실행은 다른 읽기 도구를 못 부르므로 이 결과가 유일한 통로다.
      const builtMap = draft.maps[request.target.mapId];
      // theme(사용자 문장·요청 테마)이 있으면 그것만으로 고른다 — 형태 라벨(강변촌)을 섞으면 「바닷가 어촌」도
      // 강 사례가 1순위가 된다(실측). theme 이 없을 때만 맵 이름·형태로 고른다.
      const referenceQuery = request.theme?.trim()
        || [request.target.kind === "new" ? request.target.name : builtMap?.name, request.morphology ? MORPHOLOGY_LABEL[request.morphology] : "", request.relief === "hills" ? "언덕" : ""]
          .filter(Boolean).join(" ");
      const referenceVillages = villageReferenceExamples(draft, referenceQuery, builtMap?.tilesetId, referenceId);
      const firstReference = referenceVillages[0];
      const referenceNote = firstReference && builtMap
        ? ` 참고 마을 「${firstReference.name}」(${firstReference.size}${firstReference.houses ? `·집 ${firstReference.houses}채` : ""})와 비교: 지은 마을 ${builtMap.width}×${builtMap.height}·집 ${inspection.actualHouseCount}채.`
        : "";
      return {
        summary: `Village authored: ${inspection.actualHouseCount}/${request.houseCount} houses on ${request.target.mapId}.`
          + (landmark?.placed ? ` Lighthouse at (${landmark.placed.x},${landmark.placed.y}), entrance (${landmark.placed.entrance.x},${landmark.placed.entrance.y}).` : "")
          + referenceNote,
        data: { ...(referenceVillages.length ? { referenceVillages } : {}), ...data, ...(landmark?.placed ? { landmark: landmark.placed } : {}) },
        ...(warnings.length === 0 ? {} : { warnings }),
      };
    },
  };
}

export const AUTHOR_VILLAGE_TOOL = createAuthorVillageTool();

/** 새 프로젝트·새 맵이 붙이는 자리표시 이름. 마을을 지은 뒤에도 이 이름이면 장소 목록·세계관에 「빈 맵」으로 남는다. */
const PLACEHOLDER_MAP_NAMES: ReadonlySet<string> = new Set(["", "빈 맵", "새 맵", "맵", "map", "new map", "untitled"]);
const DEFAULT_VILLAGE_MAP_NAME = "마을";

export function isPlaceholderMapName(name: string | undefined): boolean {
  return PLACEHOLDER_MAP_NAMES.has((name ?? "").trim().toLowerCase());
}

function existingTargetName(args: Record<string, unknown>): string | undefined {
  const target = args.target;
  if (typeof target !== "object" || target === null || Array.isArray(target)) return undefined;
  const record = target as Record<string, unknown>;
  if (record.kind !== "existing" || typeof record.name !== "string") return undefined;
  return record.name.trim() || undefined;
}

/**
 * 기존 맵에 마을을 지은 뒤 이름을 맞춘다(2026-09-23 등대지기 재시험: 64×40 항구 마을이 끝까지 「빈 맵」).
 * 요청 이름이 있으면 그 이름, 없으면 자리표시 이름일 때만 기본 이름. 다른 맵이 이미 쓰는 이름은 빼앗지 않는다.
 */
function renameVillageTargetMap(draft: Project, mapId: string, requested: string | undefined): string[] {
  const map = draft.maps[mapId];
  if (!map) return [];
  const placeholder = isPlaceholderMapName(map.name);
  const next = requested ?? (placeholder ? DEFAULT_VILLAGE_MAP_NAME : undefined);
  if (!next || next === map.name.trim()) return [];
  const namesake = Object.values(draft.maps).find(other => other.id !== map.id && other.name.trim() === next);
  if (namesake) {
    return [`맵 이름을 '${next}'(으)로 바꾸지 못했습니다 — 이미 ${namesake.id} 의 이름입니다. set_map_properties 로 고유 이름을 붙이세요.`];
  }
  const previous = map.name;
  map.name = next;
  return [
    requested
      ? `맵 이름: '${previous}' → '${next}'.`
      : `맵 이름이 자리표시 '${previous}'라 '${next}'(으)로 바꿨습니다 — 고유 마을 이름은 target.name 또는 set_map_properties 로 지정하세요.`,
  ];
}

/**
 * author_village 의 대상이 버들항이면 author_beodeul_town 으로 넘긴다.
 * 새 맵: target.tilesetId 가 버들항이거나, 생략했는데 프로젝트 야외 기본이 버들항(새 프로젝트)일 때.
 * 기존 맵: 맵 타일셋이 버들항일 때(맵 전체를 다시 깐다).
 */
function rerouteToBeodeulTown(draft: Project, args: Record<string, unknown>): ToolExecResult | null {
  const target = args.target;
  if (!target || typeof target !== "object") return null;
  const t = target as Record<string, unknown>;
  const isNew = t.kind === "new";
  const existing = !isNew && typeof t.mapId === "string" ? draft.maps[t.mapId] : undefined;
  const tilesetId = isNew
    ? (typeof t.tilesetId === "string" && t.tilesetId.trim() ? t.tilesetId.trim() : defaultOutdoorTilesetId(draft))
    : existing?.tilesetId;
  if (tilesetId !== "beodeul_city") return null;
  const number = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const text = JSON.stringify(args);
  const forwarded: Record<string, unknown> = {};
  if (existing) forwarded.mapId = existing.id;
  if (typeof t.name === "string" && t.name.trim()) forwarded.name = t.name.trim();
  if (isNew && typeof t.mapId === "string" && t.mapId.trim()) forwarded.id = t.mapId.trim();
  const width = number(t.width), height = number(t.height);
  if (width !== undefined) forwarded.width = width;
  if (height !== undefined) forwarded.height = height;
  if (number(args.seed) !== undefined) forwarded.seed = number(args.seed);
  // 마을 문법 테마: 말에서 고른다(도시·로마풍이라고 할 때만 블록 격자 도시)
  const ground = typeof args.groundTheme === "string" ? args.groundTheme : "";
  forwarded.theme = /도시|로마|블록/.test(text) ? "city" // "city" 낱말은 tilesetId(beodeul_city)에도 있으니 보지 않는다
    : ground === "desert" || /사막|오아시스|desert/i.test(text) ? "desert"
    : ground === "snow" || /설원|눈 ?마을|겨울|snow/i.test(text) ? "snow"
    : /늪|습지|swamp|marsh/i.test(text) ? "swamp"
    : /항구|포구|어촌|바다|해안|harbou?r|port\b|부두|선착장|coast/i.test(text) ? "coast" : "river";
  if (forwarded.theme === "city" && /항구|harbou?r|port\b|부두|선착장/i.test(text)) forwarded.harbour = true;
  const result = AUTHOR_BEODEUL_TOWN_TOOL.run(draft, forwarded);
  return {
    ...result,
    summary: `author_village 는 숲마을 생성기라 버들항 타일셋에서는 author_beodeul_town(theme ${String(forwarded.theme)})으로 대신 시공했다. ` + result.summary,
  };
}

/**
 * 변이 전 사전 검사 — 맵 생성·시공보다 먼저.
 * - 타일셋: 기존 맵이 숲마을·합본 마을 호환이 아니면 시공 전에 거부(village-tileset-mismatch).
 *   새 맵도 선택 칩셋(생략 시 숲마을)을 생성 전에 검사한다.
 * - 수용성: 시공 영역(bounds 또는 맵 전체)이 20×20 미만이면 거부(bounds-too-small/map-too-small).
 *   집 슬롯 1열도 못 놓는 면적에 집 N채 요구가 오면 늦은 no-houses-built 대신 여기서 실패.
 */
function assertTargetTilesetUsable(draft: Project, request: AuthorVillageRequest): void {
  const target = request.target;
  const map = draft.maps[target.mapId];
  if (target.kind === "existing" && !map) return;
  const tilesetId = target.kind === "new" ? target.tilesetId ?? defaultOutdoorTilesetId(draft) : map!.tilesetId;
  const tileset = draft.tilesets?.[tilesetId];
  if (!tileset || !isCombinedTownCompatibleTileset(tileset)) {
    throw new ToolError(
      `author_village는 숲마을·합본 마을 호환 칩셋 전용이다 — 요청 타일셋: ${tilesetId}. ` +
        "다른 타일 그림판에서는 문/울타리/돌마당 타일 id가 전부 다른 그림이 된다.",
      { code: "village-tileset-mismatch", mapId: target.mapId },
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
  // 시공 영역: bounds 가 있으면 그 사각형, 없으면 맵 전체. bounds 없는 기존 맵은 집 수가 요구하는
  // 크기까지 아래에서 키운다(2026-09-15) — 예전에는 16×16 최소치까지만 키워서 우겨넣기가 났다.
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
  //
  // bounds 가 있으면 그건 사용자가 정한 사각형이다 — 넓히지 않고 부족하면 거부한다.
  if (bounds) {
    if (w < MIN_BOUNDS_SIZE || h < MIN_BOUNDS_SIZE) {
      throw new ToolError(
        `author_village는 최소 ${MIN_BOUNDS_SIZE}x${MIN_BOUNDS_SIZE} 영역이 필요합니다: ${w}x${h}`,
        { code: "bounds-too-small", mapId: map.id },
      );
    }
    return;
  }

  // 2026-09-15: 성장 목표가 MIN_BOUNDS_SIZE(16, 도구의 최소 요구치)였다. 그래서 30×30 맵에 집 20채를
  // 요청하면 맵은 그대로 둔 채 우겨넣어 집이 덜 서거나 실패했다 —「기존 맵 크기는 사용자가 이미 정한
  // 사실」이라는 전제가, 신축에만 쓰이던 환산기(estimateVillageSize)를 기존 맵에서 막고 있었다.
  // 집 수가 요구하는 크기는 신축·기존 동일하게 같은 환산기가 정한다. 줄이지는 않으므로 비파괴다.
  const needed = estimateVillageSize({ houseCount: request.houseCount, morphology: request.morphology });
  const width = Math.max(w, MIN_BOUNDS_SIZE, needed.width, request.target.minSize?.width ?? 0);
  const height = Math.max(h, MIN_BOUNDS_SIZE, needed.height, request.target.minSize?.height ?? 0);
  if (width > map.width || height > map.height) growExistingVillageMap(map, width, height);
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
  cropExtraLayers(map, oldW, oldH, 0, 0, width, height);
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
  const profile = project?.villagePresets?.find(p => p.id === args.presetId)?.design?.objectVillage;
  if (profile) return { ...args, target: { ...profile.previewSize, ...record } };
  const declared = typeof args.houseCount === "number" && Number.isSafeInteger(args.houseCount)
    ? { houseCount: args.houseCount } : {};
  let size = estimateVillageSize({ ...declared, ...(args.morphology === "river" ? { morphology: "river" as const } : {}) });
  const objects = project ? villageObjectHouseCatalog(project, args) : undefined;
  const count = declared.houseCount;
  if (objects?.length && count && count >= 1 && count <= 32) {
    const sorted = [...objects].sort((a, b) => b.raster.width * b.raster.height - a.raster.width * a.raster.height);
    const plans = Array.isArray(args.housePlans) ? args.housePlans as Record<string, unknown>[] : [];
    const compact = args.composition === "compact";
    const rasters = compact ? chooseCompactHouses(sorted, count, plans, args.multiStoreyCount).map(house => house.raster)
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
