// 드래그 선택 영역 「맵 디렉팅」 12종 아키타입 카탈로그 & 고밀도 상세 프롬프트 자동 조립기.
// 순수 함수(store·DOM·네트워크 의존 없음) — 구역 성격별 추천 정렬과
// 현재 맵 실데이터(mapPlacementContext + worldCanon + 타일·통행·수면 지표) 기반 상세 프롬프트를 생성한다.
import { buildMapPlacementContext } from "@/ai/mapPlacementContext";
import { resolveWorldCanon, worldCanonHasContent } from "@/project/world/canon";
import type { GameMap, Project } from "@/project/types";
import type { SelectionRect } from "./selectionTerrainSummary";
import type { SelectionZoneContext } from "./selectionIntentRank";

export type DirectArchetypeCategory = "decor" | "nature" | "scene";

export type DirectArchetypeId =
  | "polish"
  | "street"
  | "market"
  | "interior_furnish"
  | "nature_detail"
  | "path_road"
  | "waterfront"
  | "camp_ruin"
  | "lighting"
  | "interactive_props"
  | "puzzle_gimmick"
  | "farm_forage";

export interface DirectArchetypeDef {
  readonly id: DirectArchetypeId;
  readonly category: DirectArchetypeCategory;
  readonly icon: string;
  readonly label: string;
  readonly summary: string;
  readonly memoPlaceholder: string;
  readonly tools: readonly string[];
  readonly specLines: readonly string[];
}

export const DIRECT_ARCHETYPE_CATEGORIES: readonly { readonly id: "rec" | DirectArchetypeCategory; readonly label: string }[] = [
  { id: "rec", label: "추천" },
  { id: "decor", label: "거리·소품" },
  { id: "nature", label: "자연·지형" },
  { id: "scene", label: "분위기·장치" },
] as const;

export const DIRECT_ARCHETYPES: readonly DirectArchetypeDef[] = [
  {
    id: "polish",
    category: "decor",
    icon: "✨",
    label: "주변 다듬기",
    summary: "경계·바닥·소품 정돈",
    memoPlaceholder: "예: 어색한 잔디 경계를 자연스럽게 정리",
    tools: ["furnish_outdoor_area", "lay_beodeul_grass", "place_props"],
    specLines: [
      "역할: 선택 영역의 바닥 질감·경계·소품 밀도를 주변 타일·건물·길과 어우러지게 정돈한다.",
      "필수 구성: 반복되는 단조로운 바닥에는 잔디 변주(lay_beodeul_grass)나 자연스러운 소품 군집을 더하되, 중앙 보행 동선은 여유 있게 비워 둔다.",
      "보존: 기존 건물 외형, 입구 앞 칸, NPC 위치, 지형 높이·경사로·물은 건드리지 않는다.",
    ],
  },
  {
    id: "street",
    category: "decor",
    icon: "🏮",
    label: "거리·광장",
    summary: "가로등·벤치·화분·표지판",
    memoPlaceholder: "예: 따뜻한 가로등과 꽃 화분, 나무 벤치",
    tools: ["place_props", "stamp_object", "list_spatial_designs"],
    specLines: [
      "역할: 거리·광장·건물 앞을 살아 숨 쉬는 마을 공간으로 꾸민다.",
      "필수 구성: list_spatial_designs 로 이 타일셋에 실존하는 가로등·벤치·화분·우물·표지판을 조회해 길 가장자리와 건물 옆에 리듬감 있게 배치한다.",
      "동선: 플레이어가 지나다니는 도로·문 앞·광장 중심 통로는 최소 2칸 이상 막힘 없이 확보한다.",
    ],
  },
  {
    id: "market",
    category: "decor",
    icon: "🧺",
    label: "장터·좌판",
    summary: "노점·천막·화물·진열대",
    memoPlaceholder: "예: 과일과 약초를 파는 활기찬 노점 두 곳",
    tools: ["stamp_object", "place_props", "list_spatial_designs"],
    specLines: [
      "역할: 선택 영역을 활기찬 장터·노점·상업 구획으로 연출한다.",
      "필수 구성: 이 타일셋의 좌판·천막·나무 상자·바구니·등불을 조합해 정면에서 접근 가능한 상점 진열 구도를 만든다.",
      "동선: 각 좌판 앞에는 손님과 플레이어가 서서 대화할 수 있는 통행 가능 칸을 남긴다.",
    ],
  },
  {
    id: "interior_furnish",
    category: "decor",
    icon: "🛋",
    label: "실내 가구",
    summary: "테이블·책장·러그·장식",
    memoPlaceholder: "예: 아늑한 여관 로비 테이블과 벽난로",
    tools: ["stamp_object", "place_props", "place_interactive_props"],
    specLines: [
      "역할: 실내 구역의 용도(상점·여관·집·서재·주점 등)에 어울리는 가구와 생활 소품을 채운다.",
      "필수 구성: 북쪽 벽면에는 책장·선반·창문·벽걸이를, 바닥에는 카운터·테이블·의자·러그를 생활 동선에 맞춰 배치한다.",
      "금지: 출입구 문 앞, 계단, 기존 NPC 바로 앞을 가구로 막지 않는다.",
    ],
  },
  {
    id: "nature_detail",
    category: "nature",
    icon: "🌿",
    label: "숲·바위·풀",
    summary: "나무 군집·바위·꽃·이끼",
    memoPlaceholder: "예: 전나무 군집과 이끼 낀 바위, 들꽃 몇 송이",
    tools: ["furnish_outdoor_area", "lay_beodeul_grass", "place_props"],
    specLines: [
      "역할: 빈 들판이나 숲 가장자리에 자연 식생(나무·덤불·바위·풀·꽃)을 유기적으로 배치한다.",
      "필수 구성: 격자형 균일 배치를 피하고, 큰 나무 주변에 작은 덤불·바위·풀을 묶어 자연스러운 군집과 여백을 만든다.",
      "통행: 구역을 통과하는 최소 2칸 폭의 자연 통로를 유지한다.",
    ],
  },
  {
    id: "path_road",
    category: "nature",
    icon: "🛤",
    label: "길·오솔길",
    summary: "포석·흙길·이정표 연결",
    memoPlaceholder: "예: 북쪽 숲으로 자연스럽게 굽어지는 흙길",
    tools: ["lay_path", "paint_road", "place_props"],
    specLines: [
      "역할: 선택 영역을 가로지르거나 주변 길·문 앞과 이어지는 자연스러운 보행로를 시공한다.",
      "필수 구성: 구역 분위기에 맞는 길 재질(포석·흙길·오솔길)을 깔고, 갈림길이나 가장자리에 이정표·작은 돌·가로등으로 시선을 유도한다.",
      "보존: 기존 건물과 절벽·물을 침범하지 않고 통행 가능한 지면 위로만 연결한다.",
    ],
  },
  {
    id: "waterfront",
    category: "nature",
    icon: "⚓",
    label: "물가·부두",
    summary: "부두·다리·난간·배·등불",
    memoPlaceholder: "예: 물가로 뻗은 나무 부두와 화물 상자, 등불",
    tools: ["stamp_object", "place_props", "list_spatial_designs"],
    specLines: [
      "역할: 해안·호수·강가 선택 영역에 물가 분위기의 부두·다리·난간·선착장 소품을 꾸민다.",
      "필수 구성: 물과 땅의 경계에 맞춰 부두 데크·말뚝·화물·등불 또는 건널 수 있는 나무 다리를 배치한다.",
      "보존: 기존 수심과 해안선 단차를 임의로 메우거나 파괴하지 않는다.",
    ],
  },
  {
    id: "camp_ruin",
    category: "nature",
    icon: "⛺",
    label: "야영·유적",
    summary: "모닥불·천막 / 이끼 폐허",
    memoPlaceholder: "예: 모험가들이 쉬어가는 모닥불과 통나무 의자",
    tools: ["stamp_object", "place_props", "set_lighting_volume"],
    specLines: [
      "역할: 탐험 도중 이야기가 느껴지는 야영지(모닥불·천막·통나무) 또는 오래된 유적·폐허(무너진 석주·이끼 바위)를 조성한다.",
      "필수 구성: 중심 오브젝트(모닥불 또는 석상·기둥)를 먼저 놓고, 그 주변에 둘러앉는 소품·잔해를 배치해 시선 집중점을 만든다.",
      "연출: 필요 시 중심점 주변에 은은한 빛(set_lighting_volume)을 더해 현장감을 높인다.",
    ],
  },
  {
    id: "lighting",
    category: "scene",
    icon: "🕯",
    label: "조명·분위기",
    summary: "어둠·등불·광원·날씨",
    memoPlaceholder: "예: 저녁 노을 톤과 가로등 주변 따뜻한 불빛",
    tools: ["set_lighting_volume", "set_map_properties"],
    specLines: [
      "역할: 선택 영역과 맵의 시간대·긴장감에 맞는 조명·광원·날씨 연출을 적용한다.",
      "필수 구성: set_lighting_volume 으로 적절한 ambient(실내·밤·던전은 과도하게 어둡지 않게 가독성 확보)와 등불·창문·모닥불 위치의 국소 광원을 배치한다.",
      "날씨/배경: 요청 시 set_map_properties 의 weather·background 를 자연스럽게 조합한다.",
    ],
  },
  {
    id: "interactive_props",
    category: "scene",
    icon: "🏺",
    label: "상호작용 기물",
    summary: "항아리·서랍·문·조사 소품",
    memoPlaceholder: "예: 조사하면 소소한 아이템이 나오는 항아리·상자",
    tools: ["list_interactive_props", "place_interactive_props", "place_search_containers"],
    specLines: [
      "역할: 플레이어가 직접 조사·열기·파괴할 수 있는 애니메이션 상호작용 기물을 배치한다.",
      "필수 구성: list_interactive_props 로 시대·실내외(zone)에 맞는 기물을 조회한 뒤 place_interactive_props 또는 place_search_containers 로 설치한다.",
      "주의: 기물 이벤트 아래에 중복되는 정적 타일을 겹쳐 찍지 않는다.",
    ],
  },
  {
    id: "puzzle_gimmick",
    category: "scene",
    icon: "🧩",
    label: "퍼즐·기믹",
    summary: "레버·스위치·석상·비밀길",
    memoPlaceholder: "예: 레버를 당기면 비밀 통로가 열리는 장치",
    tools: ["list_puzzle_presets", "author_map_puzzle", "compile_puzzle"],
    specLines: [
      "역할: 선택 영역 안에 탐험 재미를 주는 1회성 퍼즐/기믹을 원자적으로 설치한다.",
      "필수 구성: list_puzzle_presets 로 적합한 템플릿(레버·순서 스위치·압력판·암호·비밀길 등)을 고르고 author_map_puzzle 또는 compile_puzzle 로 스위치·연출·결과를 한 번에 연결한다.",
      "검증: 퍼즐 해결 전후 모두 소프트락 없이 이동·도달 가능한지 확인한다.",
    ],
  },
  {
    id: "farm_forage",
    category: "scene",
    icon: "🌾",
    label: "농지·채집·낚시",
    summary: "경작지·채집 스팟·낚시터",
    memoPlaceholder: "예: 약초와 버섯이 자라는 계절 채집 구역",
    tools: ["create_farm_plot", "configure_seasonal_forage", "configure_fishing"],
    specLines: [
      "역할: 선택 영역을 플레이어가 실제로 상호작용할 수 있는 생활 콘텐츠 구역으로 지정한다.",
      "필수 구성: 평지·들판이면 경작지(create_farm_plot) 또는 계절 채집 구역(configure_seasonal_forage), 물가·수면이면 낚시터(configure_fishing)를 연결한다.",
      "정합성: 드롭 아이템·작물·물고기는 실존 DB 아이템 ID를 확인하거나 필요한 최소 기록을 먼저 생성한 뒤 연결한다.",
    ],
  },
] as const;

const ARCHETYPE_BY_ID: Readonly<Record<DirectArchetypeId, DirectArchetypeDef>> = Object.fromEntries(
  DIRECT_ARCHETYPES.map((item) => [item.id, item]),
) as Record<DirectArchetypeId, DirectArchetypeDef>;

export function getDirectArchetype(id: DirectArchetypeId): DirectArchetypeDef {
  return ARCHETYPE_BY_ID[id];
}

const WATER_HINT_RE = /항구|부두|선착장|호수|강|해안|바다|물가|수면|다리|harbor|dock|water|river|lake/iu;
const DANGER_HINT_RE = /던전|동굴|폐허|지하|묘지|유적|비밀|위험|dungeon|cave|ruin|crypt/iu;
const FOREST_HINT_RE = /숲|들판|초원|오솔길|산길|야외|밭|농장|forest|field|wild|meadow|farm/iu;

/** 구역 성격에 맞춰 가장 어울리는 맵 디렉팅 아키타입 순서(앞 4개가 핵심 추천)를 0ms 로 돌려준다. */
export function recommendedDirectArchetypes(zone: SelectionZoneContext | null): {
  readonly items: readonly DirectArchetypeDef[];
  readonly topIds: ReadonlySet<DirectArchetypeId>;
} {
  let order: DirectArchetypeId[];
  const label = zone ? `${zone.label} ${(zone.locationTags ?? []).join(" ")} ${zone.suggestedZoneTags.join(" ")}` : "";
  const waterTotal = (zone?.metrics.insideCounts.water ?? 0) + (zone?.metrics.outsideCounts.water ?? 0);
  const forestTotal = (zone?.metrics.insideCounts.forest ?? 0) + (zone?.metrics.outsideCounts.forest ?? 0);

  if (WATER_HINT_RE.test(label) || waterTotal >= 3 || (zone?.metrics.waterRatio ?? 0) >= 0.35) {
    order = [
      "waterfront", "polish", "lighting", "farm_forage",
      "nature_detail", "street", "camp_ruin", "path_road",
      "market", "interactive_props", "puzzle_gimmick", "interior_furnish",
    ];
  } else if (zone?.mapRole === "interior") {
    order = [
      "interior_furnish", "interactive_props", "lighting", "polish",
      "puzzle_gimmick", "market", "street", "camp_ruin",
      "nature_detail", "path_road", "waterfront", "farm_forage",
    ];
  } else if (zone?.mapRole === "dungeon" || DANGER_HINT_RE.test(label)) {
    order = [
      "puzzle_gimmick", "lighting", "camp_ruin", "interactive_props",
      "nature_detail", "polish", "path_road", "waterfront",
      "farm_forage", "street", "market", "interior_furnish",
    ];
  } else if (FOREST_HINT_RE.test(label) || forestTotal >= 3 || zone?.mapRole === "field") {
    order = [
      "nature_detail", "camp_ruin", "path_road", "polish",
      "farm_forage", "interactive_props", "lighting", "puzzle_gimmick",
      "waterfront", "street", "market", "interior_furnish",
    ];
  } else {
    order = [
      "street", "market", "polish", "lighting",
      "interactive_props", "path_road", "nature_detail", "camp_ruin",
      "waterfront", "farm_forage", "puzzle_gimmick", "interior_furnish",
    ];
  }

  return {
    items: order.map((id) => ARCHETYPE_BY_ID[id]),
    topIds: new Set<DirectArchetypeId>(order.slice(0, 4)),
  };
}

export interface BuildDirectArchetypePromptInput {
  readonly archetypeId: DirectArchetypeId;
  readonly project?: Project;
  readonly map?: GameMap;
  readonly selection: SelectionRect;
  readonly zone: SelectionZoneContext | null;
  readonly zoneLabel: string;
  readonly zoneSaved: boolean;
  readonly userMemo?: string;
}

/**
 * 선택 맵 디렉팅 아키타입 + 현재 맵/타일/세계관 실데이터 + 사용자 한 줄 메모를 합쳐
 * AI 조수에게 넘길 고밀도 구조화 상세 프롬프트를 0ms 로 조립한다.
 */
export function buildDirectArchetypePrompt(input: BuildDirectArchetypePromptInput): string {
  const arch = getDirectArchetype(input.archetypeId);
  const { selection, zone, zoneLabel, zoneSaved } = input;
  const xEnd = selection.x + Math.max(1, selection.width) - 1;
  const yEnd = selection.y + Math.max(1, selection.height) - 1;
  const zoneDesc = zoneSaved ? `「${zoneLabel}」 (저장된 구역 태그)` : `「${zoneLabel}」`;

  const metricHints: string[] = [];
  if (zone) {
    metricHints.push(`통행률 ${Math.round(zone.metrics.passableRatio * 100)}%`);
    metricHints.push(`빈 상단 ${Math.round(zone.metrics.emptyUpperRatio * 100)}%`);
    if (zone.metrics.waterRatio > 0) metricHints.push(`수면 ${Math.round(zone.metrics.waterRatio * 100)}%`);
    if (zone.metrics.insideEvents > 0) metricHints.push(`기존 이벤트 ${zone.metrics.insideEvents}개`);
  }
  const metricSuffix = metricHints.length > 0 ? ` · ${metricHints.join(", ")}` : "";

  const lines: string[] = [
    `[대상 구역] ${zoneDesc} · 좌표 (${selection.x},${selection.y})~(${xEnd},${yEnd}) ${selection.width}×${selection.height}칸${metricSuffix}`,
    `[작업 종류] ${arch.icon} ${arch.label} 맵 디렉팅 (권장 도구: ${arch.tools.join(", ")})`,
    ...arch.specLines.map((line) => `• ${line}`),
  ];

  if (input.project && input.map) {
    const placement = buildMapPlacementContext(input.project, input.map.id);
    if (placement) {
      const ctxParts: string[] = [];
      ctxParts.push(`맵 성격: ${placement.role.role}(${placement.role.reason})`);
      ctxParts.push(`타일셋: ${input.map.tilesetId}`);
      if (placement.existing.npcs.length > 0) {
        ctxParts.push(`보존할 기존 NPC: ${placement.existing.npcs.slice(0, 6).join(", ")}`);
      }
      if (placement.wiki.length > 0) {
        ctxParts.push(`연결 설정집: ${placement.wiki.slice(0, 3).map((w) => w.name).join(", ")}`);
      }
      lines.push(`[현재 맵 실데이터] ${ctxParts.join(" · ")}`);
    }

    if (worldCanonHasContent(input.project.worldCanon)) {
      const canon = resolveWorldCanon(input.project.worldCanon);
      const worldName = canon.name ? `「${canon.name}」` : "「이 세계」";
      const absenceNote = canon.absences.length > 0 ? ` · 금지 요소(${canon.absences.slice(0, 5).join(", ")}) 절대 사용 금지` : "";
      lines.push(`[세계관 정합성] 자료집 ${worldName}의 시대·톤·설정에 어울리는 소품·조명·디테일만 사용할 것${absenceNote}.`);
    }
  }

  const memo = input.userMemo?.trim();
  if (memo) {
    lines.push(`[사용자 추가 요청] ${memo}`);
  }

  lines.push(
    `[필수 가드레일] 반드시 선택 영역 안만 시공하고, 기존 건물·NPC·출입구 동선·높이·경사로·수심은 훼손하지 마. 완료 후 통행 가능성과 시각적 어울림을 확인해.`,
  );

  return lines.join("\n");
}
