// ai/turnGuide.ts
// 조수 턴 하나에 붙는 도구 사용 가이드. 예전에는 이 내용이 영역 작업 전용 경로
// (`runRegionTask.buildRegionTaskMessage`)에만 있었고, 그래서 **선택 영역 없이** 조수에게
// 말하면 같은 요청이 다른 규칙을 받았다 — 가방 그룹을 재료로 쓰거나, 장식 나무상자를
// place_chest 로 놓거나, 원형 호수를 네모로 채우는 실수가 조수 쪽에서만 반복됐다.
// 이제 실행체가 조수 세션 하나이므로 가이드도 한 곳에서 만든다.
//
// 스코프(선택 사각형)는 **엔진이 아니라 이 가이드의 인자**다. 스코프가 있으면 "영역 밖 금지"
// 문구와 bounds 시그니처가 더 붙고, 없으면 재료·도구 규칙만 붙는다.
import {
  REGION_INTENT_KEYWORDS,
  regionIntentGuideLines,
  routeRegionIntent,
} from "@/editor/regionTask/regionIntentRouter";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { BUILD_PALETTE_GROUP_IDS } from "@/editor/panels/buildPaletteCore";
import { isBagGroupId, isBagMaterialQuery } from "@/project/materialPolicy";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { MapId, TilesetDef } from "@/project/types";
import { requestLikelyModifiesExisting } from "./modifyIntent";

/** 이 턴이 손댈 수 있는 범위. null 이면 제약 없음(맵 전체·프로젝트 전체). */
export interface TurnScope {
  readonly mapId: MapId;
  readonly region: RegionRect;
}

export interface TurnGuideInput {
  readonly instruction: string;
  /** 현재 맵 타일셋 — 재료 라벨 예시를 뽑는다. 없으면 tile_query 안내로 폴백. */
  readonly tileset?: TilesetDef | undefined;
  readonly scope?: TurnScope | null | undefined;
}

/** 장식 박스 전용 그룹 참조(엔진 내부). 시공 public contract 는 material 라벨만. */
export const PROP_VOCAB = {
  woodBox: `${COMBINED_TOWN_HARNESS_PREFIX}wood-box`,
  fruitBox: `${COMBINED_TOWN_HARNESS_PREFIX}fruit-box`,
} as const;

export function formatMaterialLabelHint(tileset: TilesetDef | undefined): string {
  if (!tileset) {
    return `- 소품 재료: (타일셋 없음) tile_query ask:"labels" — 예: "침엽수", "나무 상자", "과일박스" (가방·그룹 id 금지)`;
  }
  // 구체 소품 우선. 마을 소품(small-props) 가방은 시공 material 후보에서 제외.
  const preferred = [
    BUILD_PALETTE_GROUP_IDS.tree,
    PROP_VOCAB.woodBox,
    PROP_VOCAB.fruitBox,
    BUILD_PALETTE_GROUP_IDS.path,
    BUILD_PALETTE_GROUP_IDS.water,
  ];
  const groups = tileset.tileGroups ?? [];
  const preferredFound = preferred
    .map((id) => groups.find((group) => group.id === id))
    .filter((group): group is NonNullable<typeof group> => group != null && !isBagGroupId(group.id));
  const propish = groups.filter((group) => {
    if (isBagGroupId(group.id) || isBagMaterialQuery(group.name)) return false;
    return (
      group.role === "prop" || group.role === "terrain" || group.role === "water" || group.role === "fence"
      || /tree|bush|flower|fence|path|water|road|box/i.test(group.id)
    );
  });
  const ordered = [
    ...preferredFound,
    ...propish.filter((group) => !preferred.includes(group.id)),
  ];
  const unique = [...new Map(ordered.map((group) => [group.id, group])).values()].slice(0, 10);
  if (unique.length === 0) {
    return `- 소품 재료: tile_query ask:"labels" 로 라벨/설명을 찾아 place_props material 에 넣기 (가방·그룹 id 금지)`;
  }
  const list = unique.map((group) => `${group.name}(${group.role})`).join(", ");
  return `- 소품·지형 material 라벨 예(place_props/fill_region — 가방·그룹 id 금지, 미합의는 목업 확인): ${list}`;
}

/**
 * 지시 텍스트에서 집/마을 시공 의도를 감지해 공식 facade 호출 시그니처 라인을 반환.
 *
 * **스코프가 있을 때만** 부른다. 마을 분기는 수량 정규식과 무관하게 항상
 * `target:{kind:"existing",mapId,bounds}` 를 못박는다(2026-08-29 modify 진단 근본원인 10).
 * 옛 구현은 `집 N채인 마을` 이 걸릴 때만 target 을 적어줬고, "이 마을 좀 정리해줘" 처럼 수량이
 * 없으면 시그니처가 아예 안 붙어 모델이 author_village 기본값(= 새 맵 생성)으로 갔다. 스코프가
 * 있는 턴은 정의상 **지금 열린 맵의 선택 사각형** 이 대상이라 새 맵이 정답일 수 없고, bounds 를
 * 생략하면 스코프 검사를 통과한 채 맵 전체가 재포장된다.
 */
export function constructionFacadeLine(instruction: string, mapId: MapId, region: RegionRect): string | null {
  const boundsArg = `bounds:{x:${region.x},y:${region.y},w:${region.width},h:${region.height}}`;
  const target = `target:{kind:"existing",mapId:"${mapId}",${boundsArg}}`;
  // 마을 intent: "집 N채인 마을", "N채 마을"
  const villageMatch = instruction.match(/집?\s*(\d+)채[인]?\s*마을/);
  if (villageMatch) {
    const n = parseInt(villageMatch[1]!, 10);
    return `- 마을 시공: author_village { ${target}, houseCount:${n}, countPolicy:"exact" } — 정확히 ${n}채`;
  }
  // 수량 없는 마을 언급(집 언급도 없을 때) — 새 맵 금지·선택 영역 한정만 못박는다.
  if (/마을/.test(instruction) && !/집/.test(instruction)) {
    return `- 마을 작업: author_village { ${target} } — 새 맵을 만들지 말고 이 맵 선택 영역만 대상으로`;
  }
  // 야외 집 한 채 (author_house는 regionIntentGuideLines 구조물 가이드에 이미 노출 — 시그니처만 보강)
  if (/야외\s*집\s*한\s*채|집\s*한\s*채/.test(instruction)) {
    return `- 야외 집 시공 시그니처: { kind:"single", mapId:"${mapId}" } — 정확히 1채`;
  }
  // 야외 집 N채
  const houseMatch = instruction.match(/(?:야외\s*)?집\s*(\d+)채/);
  if (houseMatch) {
    const n = parseInt(houseMatch[1]!, 10);
    return `- 야외 집 시공 시그니처: { kind:"lots", mapId:"${mapId}" } — 정확히 ${n}채`;
  }
  // bare "집지어"/"집 만들어" — 스코프가 있으면 야외 집 1채 기본(되묻지 않음).
  // 선택 영역이 현재 맵 위이므로 야외 외장 의도로 간주한다(실내는 별도 표지가 있을 때만).
  // "건물"(일반 건물)은 여기서 잡지 않는다 — 탑/성벽/대장간 등은 structure 가이드가
  // build_wall/create_farm_plot 등으로 안내하고, 일반 "건물"은 가이드가 LLM에게 맡긴다.
  // (이전 /집|건물/ 은 "탑 건물"·"성벽 건물" 을 author_house 로 오경로했다.)
  if (/집/.test(instruction)) {
    return `- 야외 집 시공: author_house { kind:"single", mapId:"${mapId}" } — 선택 영역 안에 1채 시공`;
  }
  return null;
}

function mentionsInterior(instruction: string): boolean {
  const normalized = instruction.toLowerCase().replace(/\s+/g, " ");
  return REGION_INTENT_KEYWORDS.interior.some((keyword) => normalized.includes(keyword));
}

/**
 * 카테고리 라우터가 덮지 않는 "맵 위 배치·지형" 어휘.
 *
 * 왜 따로 필요한가 — `REGION_INTENT_KEYWORDS` 9카테고리는 전부 주제(실내·구조물·NPC·퀘스트·전투·
 * 분위기·변형)축이라, 정작 가장 흔한 요청인 "나무 좀 심어줘" / "물 채워줘" / "길 좀 깔아줘" 가
 * **어느 카테고리에도 걸리지 않는다**. 그런데 이 요청들이 필요한 규칙(place_props material 라벨,
 * shape=circle, 물 위 소품 금지, 장식박스↔보물상자)은 전부 고정 규칙 블록에 있다. 라우팅 결과만
 * 게이트로 쓰면 선택 없이 조수에게 "나무 심어줘" 라고 한 사용자는 가이드를 0줄 받는다 — 통합으로
 * 없애려던 바로 그 결함이 그대로 남는다.
 */
const PLACEMENT_HINTS: readonly string[] = [
  "나무", "바위", "돌", "꽃", "풀", "잔디", "수풀", "덤불",
  "물", "호수", "강", "바다", "연못", "폭포",
  "길", "도로", "산책로", "동선",
  "타일", "지형", "바닥", "소품", "장식", "오브젝트",
  "배치", "심어", "심자", "깔아", "깔자", "채워", "채우", "놓아", "놓자", "놔",
  "상자", "박스", "가구", "간판",
];

function mentionsPlacement(instruction: string): boolean {
  const normalized = instruction.toLowerCase().replace(/\s+/g, " ");
  return PLACEMENT_HINTS.some((keyword) => normalized.includes(keyword));
}

/**
 * 이번 턴 사용자 메시지에 붙일 가이드 블록. 붙일 것이 없으면 빈 문자열.
 *
 * 공간 카테고리에 라우팅되지 않고 스코프도 없는 요청(데이터베이스 질문·퀘스트 설계 등)에는
 * 아무것도 붙이지 않는다 — 매 턴 2KB 넘는 타일 규칙을 무조건 실으면 시스템 프롬프트 예산을
 * 잠식하고, 규칙 문구의 한국어 키워드("나무"·"소품"·"물")가 도구 노출 도메인을 헛되게 연다.
 */
export function buildTurnGuide(input: TurnGuideInput): string {
  const instruction = input.instruction.trim();
  if (!instruction) return "";
  const scope = input.scope ?? null;
  const categories = routeRegionIntent(instruction);
  // 스코프가 있으면 사용자가 맵 위를 직접 가리킨 것이므로 키워드가 안 걸려도 공간 작업으로 본다.
  if (categories.length === 0 && !scope && !mentionsPlacement(instruction)) return "";

  // 실내 표지는 routeRegionIntent 결과가 아니라 키워드로 직접 본다 — 수정 요청이면 라우터가
  // "interior"(신규 시공 가이드)를 이미 떨어내므로, 결과만 보면 "실내 수정"과 "실내 무관"을
  // 구분할 수 없다.
  const interior = mentionsInterior(instruction);
  const modifies = requestLikelyModifiesExisting(instruction);
  // 실내 요청을 신규/수정으로 쪼갠다(2026-08-29 modify 진단 근본원인 8). 옛 `wantsInterior` 하나로는
  // "이 침실 좀 고쳐줘" 가 "새 맵 전체를 시공하라" + "영역 밖 허용" 지시를 받아, 고칠 대상이 있는데도
  // 새 실내 맵을 하나 더 만드는 경로로 밀렸다.
  const wantsNewInterior = interior && !modifies;
  const wantsInteriorEdit = interior && modifies;
  // 스코프가 있으면 "집"이라고만 해도 야외 집(현재 맵 외장)으로 간주한다. 실내는 명시적
  // 표지(실내/인테리어)가 있을 때만 실내 경로.
  // (이전: bare "집" → 야외/실내 되묻기 → "집지어"인데 아무것도 안 짓는 불만. 영역 선택 자체가
  // 현재 맵 위 야외 시공 의도의 신호다 — 실내 신축은 새 맵으로 빠져나가므로 영역 선택과 모순.)
  const bareHouse = Boolean(scope) && !interior && !modifies && /집/.test(instruction) && !/야외|외장|마을/.test(instruction);
  // 실내 요청에만 야외 구조물 가이드를 뺀다(bare 집은 야외 집으로 시공하므로 structure 유지).
  const intentGuides = regionIntentGuideLines(
    interior ? categories.filter((category) => category !== "structure") : categories,
  );
  // 신규 실내·수정 요청에는 시공 facade 시그니처를 붙이지 않는다 — 둘 다 "새로 지어라"는 신호다.
  const facadeLine = scope && !wantsNewInterior && !modifies
    ? constructionFacadeLine(instruction, scope.mapId, scope.region)
    : null;

  const lines = [
    scope ? "영역 작업 도구 규칙:" : "도구 규칙:",
    ...(bareHouse
      ? ["- 집 요청(영역 선택): 선택 영역이 현재 맵 위이므로 야외 집으로 시공. 되묻지 말고 author_house(kind:\"single\")로 바로 시공하라."]
      : []),
    wantsNewInterior
      ? "- 실내/방: start_interior_room_session (새 mapId). 야외 시공 facade 금지. create_map만 하고 끝내지 말 것"
      : wantsInteriorEdit
        ? "- 실내 수정: 지금 열린 이 맵을 직접 편집한다(furnish_interior_space({mapId, roomId}) / fill_region / tile_erase / place_props). start_interior_room_session·run_interior_room_pipeline 금지 — 기존 맵의 타일·이벤트가 전부 삭제된다"
        : "- 집/건물(야외 외장): 공식 시공 facade 사용 (벽 타일로 직사각 채우기 금지). 실내·방 맵 요청에는 야외 시공 facade 금지 → 실내 세션 툴",
    ...(scope && modifies
      ? [`- 대상 맵 고정: 이 작업의 대상은 \`${scope.mapId}\` 이다. create_map·duplicate_map 으로 새 맵을 만들지 말고 이 맵을 고쳐라. 여러 맵을 오가지 말 것`]
      : []),
    ...(facadeLine ? [facadeLine] : []),
    "- 나무/바위/꽃 산포: place_props + material(타일 라벨/설명, 예 \"침엽수\"·\"꽃\"). 그룹 id·vocabId 금지. 같은 place_props는 1회",
    formatMaterialLabelHint(input.tileset),
    // 툴콜링 사고: "박스 2개" → small-props 가방. 구체 라벨만 허용.
    `- 장식 박스/나무상자/나무박스: place_props { material: \"나무 상자\", count:N }. 과일박스= material:\"과일박스\". 마을 소품/small-props 가방·place_chest로 대체 금지`,
    "- 보물상자(열면 아이템/골드·개봉 기억): place_chest 만. 보관/창고 상자(넣고 빼기): place_storage_chest. '박스'/'나무상자' 장식은 place_props — place_chest 금지",
    "- 지면/수역/바닥 면: fill_region { material:\"물\" 또는 \"잔디\" } + 원형·둥근은 shape=circle(필수). 그룹 id 금지. rect만 쓰면 네모. 타원=ellipse",
    `- 길/도로: paint_road { mapId, style:"dirt"|"sand", points:[{x,y},...] } — 흙길 오토타일 성형. ${scope ? "영역 안 " : ""}동선·호수 둘레 산책로에 사용`,
    "- 나무/소품: place_props — 물·호수 칸 위 금지. area는 호수 바깥 육지(통행 가능)만. 호수 채운 뒤 주변에 나무를 깔 것",
    "- 주민/NPC: place_npc 또는 make_villager — graphic 생략 시 villager 기본. 물 위 NPC 금지. 상점 NPC는 make_villager({shop}) 1회 또는 place_npc 1회(같은 역할 중복 금지)",
    ...(scope
      ? [`- tile_query ask:\"labels\" 는 mapId:\"${scope.mapId}\" 를 넣어 현재 맵 타일셋 라벨만 조회(기본값=야외 타일셋 — 실내 맵에서 가로 탁자 등 오조회 주의)`]
      : ["- tile_query ask:\"labels\" 는 mapId 를 넣어 대상 맵 타일셋 라벨만 조회(기본값=야외 타일셋 — 실내 맵에서 가로 탁자 등 오조회 주의)"]),
    ...intentGuides,
    "- 지원하지 않는 요청 부분은 시도하지 말고, 마지막 응답에 '못 한 것: …' 한 줄로 명시하라",
    // "적용" 표기 금지: assistantToolMode.INTENT_KEYWORDS.battle.strong의 단음절 "적"과
    // 부분일치로 충돌해(2026-07-10 라이브 실측 수정) 이 고정 문구가 매 턴 battle+database
    // 도메인을 허위로 열고 노출 상한(40)을 잠식해 mirror_region 등 map/quest 도구를 밀어냈다.
    "- propose_tile_vocabulary 댄스는 하지 말 것",
    ...(scope
      ? [
          wantsNewInterior
            ? "- 실내 신규: 새 맵 시공은 선택 영역 밖이어도 허용한다. 현재 맵 타일은 불필요하면 건드리지 말 것"
            : "- 영역 밖 타일·이벤트는 절대 수정하지 말 것",
        ]
      : []),
  ];

  const guide = lines.join("\n");
  if (!scope) return guide;

  // intent 스코핑용 키워드 — "맵" 단독 과활성은 피하고 타일/이벤트/소품 쓰기 도메인을 우선한다.
  // map/quest 등 다른 도메인 도구의 노출은 여기서 시드를 보태 여는 게 아니라, footer의
  // "현재 맵" 문구·가이드 문구 자체의 키워드(예: quest-trigger의 "퀘스트")로 이미 자연히
  // 열리고, 상한(40) 슬라이스에 밀리는 핵심 도구는 toolRegistry.PINNED_TOOLS_BY_DOMAIN이
  // 보장한다(2026-07-10 라이브 실측 수정 — 카테고리별 도메인 시드 병합은 A/B 실측상 효과가
  // 없는 죽은 복잡도로 판정돼 제거했다).
  const domainSeed = interior
    ? "(영역 작업: 타일 실내 방 맵 인테리어 집 npc 이벤트)"
    : "(영역 작업: 타일 지형 나무 소품 집 npc 이벤트 주민)";
  const scopeLine = wantsNewInterior
    ? "이 작업은 실내/새 맵 시공이다. 선택 영역은 참고용이며 새 맵 전체를 시공하라."
    : "이 작업은 아래 선택 영역 안에서만 수행하라.";
  return `${domainSeed}\n${guide}\n\n${scopeLine}`;
}
