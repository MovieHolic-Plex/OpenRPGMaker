// 드래그 선택 영역 「NPC 추가」 12종 아키타입 카탈로그 & 고밀도 상세 프롬프트 자동 조립기.
// 순수 함수(store·DOM·네트워크 의존 없음) — 구역 성격별 추천 정렬과
// 현재 맵 실데이터(mapPlacementContext + worldCanon + 구역 좌표/충돌 회피) 기반 상세 프롬프트를 생성한다.
import { buildMapPlacementContext, formatChestRewardHint } from "@/ai/mapPlacementContext";
import { resolveWorldCanon, worldCanonHasContent } from "@/project/world/canon";
import type { GameMap, Project } from "@/project/types";
import type { SelectionRect } from "./selectionTerrainSummary";
import type { SelectionZoneContext } from "./selectionIntentRank";

export type NpcArchetypeCategory = "service" | "story" | "adventure";

export type NpcArchetypeId =
  | "shop"
  | "inn"
  | "healer"
  | "portal"
  | "quest"
  | "villager"
  | "companion"
  | "storage"
  | "guard"
  | "boss"
  | "chest"
  | "save";

export interface NpcArchetypeDef {
  readonly id: NpcArchetypeId;
  readonly category: NpcArchetypeCategory;
  readonly icon: string;
  readonly label: string;
  readonly summary: string;
  readonly memoPlaceholder: string;
  readonly tools: readonly string[];
  readonly specLines: readonly string[];
}

export const NPC_ARCHETYPE_CATEGORIES: readonly { readonly id: "rec" | NpcArchetypeCategory; readonly label: string }[] = [
  { id: "rec", label: "추천" },
  { id: "service", label: "시설" },
  { id: "story", label: "퀘스트·대화" },
  { id: "adventure", label: "탐험·전투" },
] as const;

export const NPC_ARCHETYPES: readonly NpcArchetypeDef[] = [
  {
    id: "shop",
    category: "service",
    icon: "🛒",
    label: "상점",
    summary: "품목·시세 기반 매매",
    memoPlaceholder: "예: 포션·해독제 위주, 친절한 약초상",
    tools: ["place_npc", "shop", "set_shop_stock"],
    specLines: [
      "역할: 이 구역 분위기에 어울리는 상점 주인 NPC 1명을 배치한다.",
      "필수 구성: place_npc 로 캐릭터 칩·짝 얼굴·이름을 설정하고, 인사 대사 후 shop 커맨드로 매매 화면을 연다.",
      "품목·시세: 프로젝트 DB에 실제 존재하는 아이템/장비 중 현재 맵 진행도와 물가에 맞는 4~6종을 연결한다(존재하지 않는 ID 금지).",
      "마무리: 상점을 닫은 뒤 구역 분위기에 맞는 짧은 배웅 대사를 붙인다.",
    ],
  },
  {
    id: "inn",
    category: "service",
    icon: "🛏",
    label: "여관·회복",
    summary: "숙박 요금 + 전체 회복",
    memoPlaceholder: "예: 따뜻한 주막 주인, 1박 30G",
    tools: ["place_npc", "inn"],
    specLines: [
      "역할: 숙박과 HP/MP 전체 회복을 제공하는 여관/휴식처 주인 NPC 1명을 배치한다.",
      "필수 구성: 1박 요금을 안내하고 선택지(묵는다 / 그만둔다)를 제공한다. 골드 부족 시 정중히 안내한다.",
      "숙박 연출: 골드 차감 → 화면 페이드아웃 → 휴식 효과음·파티 전원 회복 → 페이드인 → 아침 인사 대사.",
    ],
  },
  {
    id: "healer",
    category: "service",
    icon: "⛪",
    label: "치유사",
    summary: "치료·상태이상 해제",
    memoPlaceholder: "예: 무료 축복 성당 사제",
    tools: ["place_npc", "recoverAll"],
    specLines: [
      "역할: 파티의 체력과 상태이상을 회복해 주는 치유사/사제 NPC 1명을 배치한다.",
      "필수 구성: 구역 분위기에 맞는 인사 → 선택지(치료받기 / 세계관 이야기 듣기 / 나가기).",
      "치료 동작: recoverAll 커맨드 + 짧은 빛·효과음 연출 + 축복 대사.",
    ],
  },
  {
    id: "portal",
    category: "service",
    icon: "⛵",
    label: "이동 안내",
    summary: "뱃사공·마부 맵 이동",
    memoPlaceholder: "예: 옆 항구로 데려다주는 뱃사공",
    tools: ["place_npc", "transfer"],
    specLines: [
      "역할: 다른 맵으로 데려다주는 뱃사공/마부/안내원 NPC 1명을 배치한다.",
      "필수 구성: 프로젝트에 실제 존재하는 다른 맵 목록을 먼저 확인해 선택지로 제시하고, 선택 시 확인 대사 후 transfer 로 이동시킨다.",
      "주의: 존재하지 않는 mapId를 지어내지 않는다. 연결할 대상 맵이 없으면 가장 자연스러운 기존 맵 또는 안내 대사로 처리한다.",
    ],
  },
  {
    id: "quest",
    category: "story",
    icon: "❗",
    label: "퀘스트",
    summary: "수락→진행→완료 3단계",
    memoPlaceholder: "예: 잃어버린 열쇠 찾기, 보상 200G",
    tools: ["place_npc", "declare_story_flag", "upsert_event"],
    specLines: [
      "역할: 3단계 상태를 가진 퀘스트 의뢰인 NPC 1명을 배치한다.",
      "스위치 설계: declare_story_flag 로 수락 스위치와 완료 스위치를 명시 선언한다.",
      "필수 3페이지 구성: (1) 미수락 — 사연 설명 + 선택지(수락/거절) → 수락 시 진행 스위치 ON / (2) 진행 중 — 목표 리마인드 및 조건 충족 시 완료 스위치 ON·골드/아이템 보상 지급 / (3) 완료 후 — 감사 후일담 대사(중복 보상 방지).",
    ],
  },
  {
    id: "villager",
    category: "story",
    icon: "💬",
    label: "주민·정보",
    summary: "소문·힌트·선택지 대화",
    memoPlaceholder: "예: 북쪽 숲의 괴물 소문을 알려주는 주민",
    tools: ["place_npc"],
    specLines: [
      "역할: 구역에 생기를 불어넣는 주민/정보원 NPC 1~2명을 배치한다.",
      "필수 구성: 서로 겹치지 않는 캐릭터 칩·짝 얼굴·말투로 이 구역과 주변 시설·사건에 대한 구체적 힌트 대사 2~3마디를 작성한다.",
      "선택: 1명은 제자리/주변 가벼운 배회(autonomous)를 넣어 살아있는 느낌을 준다.",
    ],
  },
  {
    id: "companion",
    category: "story",
    icon: "🤝",
    label: "동료 합류",
    summary: "대화 후 파티 영입",
    memoPlaceholder: "예: 활을 쓰는 정찰병 동료",
    tools: ["place_npc", "add_companion"],
    specLines: [
      "역할: 대화 후 파티에 합류하는 동료 NPC 1명을 배치한다.",
      "필수 구성: DB 액터를 확인(없으면 구역과 세계관에 맞는 동료 액터 생성)하고, 영입 대사 + 선택지(함께 가자 / 나중에)를 구성한다.",
      "중복 합류 방지: 합류 시 파티 추가(add_companion 또는 changeParty) 직후 셀프스위치 A ON → 2페이지는 빈 그래픽으로 맵에서 사라지게 한다.",
    ],
  },
  {
    id: "storage",
    category: "story",
    icon: "📦",
    label: "보관함·판",
    summary: "창고 상자 / 의뢰 게시판",
    memoPlaceholder: "예: 모험가 의뢰 게시판 또는 창고 상자",
    tools: ["place_storage_chest", "place_sign"],
    specLines: [
      "역할: 구역 성격에 맞춰 아이템 보관 상자(place_storage_chest) 또는 지역 안내·의뢰 게시판(place_sign) 1개를 배치한다.",
      "필수 구성: 보관함이면 바로 창고 UI가 열리게, 게시판이면 지역 소식·주의사항·근처 랜드마크 안내 2~3줄을 깔끔하게 표시한다.",
    ],
  },
  {
    id: "guard",
    category: "adventure",
    icon: "🛡",
    label: "경비·길막",
    summary: "조건 전 통행 차단",
    memoPlaceholder: "예: 통행증이 없으면 못 지나가게 막는 경비",
    tools: ["place_npc", "place_battle_blocker"],
    specLines: [
      "역할: 특정 조건(스위치·아이템·레벨) 충족 전까지 길을 막는 경비병/문지기 NPC를 배치한다.",
      "필수 2페이지 구성: (1) 차단 중 — 출입 제한 이유와 해제 힌트를 명확히 안내 / (2) 조건 충족 — 통과 허가 대사 및 길 비켜주기(또는 통과 허용).",
    ],
  },
  {
    id: "boss",
    category: "adventure",
    icon: "⚔️",
    label: "보스·전투",
    summary: "대화→전투→승리 분기",
    memoPlaceholder: "예: 숲을 지키는 산적 두목, 승리 시 보상",
    tools: ["place_npc", "battleProcessing"],
    specLines: [
      "역할: 대화 후 전투가 시작되는 보스/강적/트레이너 NPC 1명을 배치한다.",
      "필수 구성: 프로젝트 DB 트룹 중 이 맵 난이도에 맞는 적을 연결하고, 조우 도발 대사 → battleProcessing(승리·패배/도주 분기)을 구성한다.",
      "승리 처리: 승리 시 셀프스위치 A ON + 보상·후속 대사를 실행하고, 2페이지에서 재전투가 일어나지 않도록 처리한다.",
    ],
  },
  {
    id: "chest",
    category: "adventure",
    icon: "🧰",
    label: "보물상자",
    summary: "1회 획득 골드·아이템",
    memoPlaceholder: "예: 회복 포션 2개 또는 150G",
    tools: ["place_chest"],
    specLines: [
      "역할: 1회만 열 수 있는 보물상자 1개를 배치한다(place_chest).",
      "필수 구성: 1페이지(닫힘) — 효과음·획득 대사·골드/아이템 지급 → 셀프스위치 A ON / 2페이지(열림, 셀프스위치 A=true) — 비어 있음.",
      "밸런스: 현재 맵 진행도에 맞는 보상 금액과 실제 존재하는 아이템 ID만 사용한다.",
    ],
  },
  {
    id: "save",
    category: "adventure",
    icon: "💎",
    label: "세이브",
    summary: "저장 + 회복 크리스탈",
    memoPlaceholder: "예: 빛나는 수호석, 저장 및 휴식",
    tools: ["place_savepoint"],
    specLines: [
      "역할: 게임 저장과 휴식을 제공하는 세이브포인트 1개를 배치한다(place_savepoint).",
      "필수 구성: 조사 시 구역 분위기에 맞는 짧은 묘사 → 선택지(기록하기 / 잠시 쉬기 / 그만두기) → openSaveMenu 및 선택 회복.",
    ],
  },
] as const;

const ARCHETYPE_BY_ID: Readonly<Record<NpcArchetypeId, NpcArchetypeDef>> = Object.fromEntries(
  NPC_ARCHETYPES.map((item) => [item.id, item]),
) as Record<NpcArchetypeId, NpcArchetypeDef>;

export function getNpcArchetype(id: NpcArchetypeId): NpcArchetypeDef {
  return ARCHETYPE_BY_ID[id];
}

const WATER_HINT_RE = /항구|부두|선착장|호수|강|해안|바다|물가|수면|harbor|dock|water/iu;
const DANGER_HINT_RE = /숲|던전|동굴|사냥터|폐허|지하|묘지|위험|forest|dungeon|cave|ruin/iu;

/** 구역 성격에 맞춰 가장 어울리는 NPC 아키타입 순서(앞 4개가 핵심 추천)를 0ms 로 돌려준다. */
export function recommendedNpcArchetypes(zone: SelectionZoneContext | null): {
  readonly items: readonly NpcArchetypeDef[];
  readonly topIds: ReadonlySet<NpcArchetypeId>;
} {
  let order: NpcArchetypeId[];
  const label = zone ? `${zone.label} ${(zone.locationTags ?? []).join(" ")} ${zone.suggestedZoneTags.join(" ")}` : "";
  const waterTotal = (zone?.metrics.insideCounts.water ?? 0) + (zone?.metrics.outsideCounts.water ?? 0);

  if (WATER_HINT_RE.test(label) || waterTotal >= 3) {
    order = ["portal", "shop", "quest", "villager", "storage", "guard", "inn", "chest", "companion", "save", "healer", "boss"];
  } else if (zone?.mapRole === "dungeon" || DANGER_HINT_RE.test(label)) {
    order = ["boss", "chest", "save", "guard", "quest", "villager", "companion", "portal", "shop", "healer", "storage", "inn"];
  } else if (zone?.mapRole === "interior") {
    order = ["shop", "inn", "healer", "storage", "quest", "villager", "companion", "chest", "guard", "save", "portal", "boss"];
  } else {
    order = ["shop", "quest", "villager", "inn", "companion", "guard", "storage", "portal", "healer", "chest", "save", "boss"];
  }

  return {
    items: order.map((id) => ARCHETYPE_BY_ID[id]),
    topIds: new Set<NpcArchetypeId>(order.slice(0, 4)),
  };
}

export interface BuildNpcArchetypePromptInput {
  readonly archetypeId: NpcArchetypeId;
  readonly project?: Project;
  readonly map?: GameMap;
  readonly selection: SelectionRect;
  readonly zone: SelectionZoneContext | null;
  readonly zoneLabel: string;
  readonly zoneSaved: boolean;
  readonly suggestedCell: { readonly x: number; readonly y: number } | null;
  readonly userMemo?: string;
}

/**
 * 선택 아키타입 + 현재 맵/세계관 실데이터 + 사용자 한 줄 메모를 합쳐
 * AI 조수에게 넘길 고밀도 구조화 상세 프롬프트를 0ms 로 조립한다.
 */
export function buildNpcArchetypePrompt(input: BuildNpcArchetypePromptInput): string {
  const arch = getNpcArchetype(input.archetypeId);
  const { selection, suggestedCell, zoneLabel, zoneSaved } = input;
  const xEnd = selection.x + Math.max(1, selection.width) - 1;
  const yEnd = selection.y + Math.max(1, selection.height) - 1;
  const zoneDesc = zoneSaved ? `「${zoneLabel}」 (저장된 구역 태그)` : `「${zoneLabel}」`;
  const cellHint = suggestedCell
    ? `추천 배치 칸 (${suggestedCell.x}, ${suggestedCell.y})`
    : `영역 내 빈 통행 칸 없음 (영역을 다시 잡거나 인접 통행 가능 칸 확인 필요)`;

  const lines: string[] = [
    `[대상 구역] ${zoneDesc} · 좌표 (${selection.x},${selection.y})~(${xEnd},${yEnd}) ${selection.width}×${selection.height}칸 · ${cellHint}`,
    `[작업 종류] ${arch.icon} ${arch.label} NPC 저작 (권장 도구: ${arch.tools.join(", ")})`,
    ...arch.specLines.map((line) => `• ${line}`),
  ];

  // 맵 실데이터 컨텍스트 (시세·보상·기존 NPC 충돌 회피)
  if (input.project && input.map) {
    const placement = buildMapPlacementContext(input.project, input.map.id);
    if (placement) {
      const ctxParts: string[] = [];
      ctxParts.push(`맵 성격: ${placement.role.role}(${placement.role.reason})`);
      if (input.archetypeId === "inn") {
        ctxParts.push(`권장 1박 요금: ${placement.innPrice.gold}G (${placement.innPrice.reason})`);
      }
      if (input.archetypeId === "chest") {
        ctxParts.push(`권장 상자 보상: ${formatChestRewardHint(placement)}`);
      }
      if (placement.existing.npcs.length > 0) {
        ctxParts.push(`기존 NPC(중복·겹침 피할 것): ${placement.existing.npcs.slice(0, 6).join(", ")}`);
      }
      if (placement.fights && placement.fights.enemyNames.length > 0 && (input.archetypeId === "boss" || input.archetypeId === "quest" || input.archetypeId === "villager")) {
        ctxParts.push(`이 맵 등장 적: ${placement.fights.enemyNames.slice(0, 5).join(", ")}`);
      }
      if (placement.wiki.length > 0) {
        ctxParts.push(`연결 설정집: ${placement.wiki.slice(0, 3).map((w) => w.name).join(", ")}`);
      }
      if (ctxParts.length > 0) {
        lines.push(`[현재 맵 실데이터] ${ctxParts.join(" · ")}`);
      }
    }

    // 세계관 고정 블록 연동 안내
    if (worldCanonHasContent(input.project.worldCanon)) {
      const canon = resolveWorldCanon(input.project.worldCanon);
      const worldName = canon.name ? `「${canon.name}」` : "「이 세계」";
      const absenceNote = canon.absences.length > 0 ? ` · 금지 요소(${canon.absences.slice(0, 5).join(", ")}) 절대 사용 금지` : "";
      lines.push(`[세계관 정합성] 자료집 ${worldName}의 톤·시대·설정집에 맞춰 이름·외형·대사·품목을 작성할 것${absenceNote}.`);
    }
  }

  const memo = input.userMemo?.trim();
  if (memo) {
    lines.push(`[사용자 추가 요청] ${memo}`);
  }

  lines.push(
    `[필수 가드레일] 반드시 선택 영역 안의 통행 가능한 빈 칸에만 배치하고, 기존 NPC·건물·높이·경사로·물 타일은 절대 변경하지 마.`,
  );

  return lines.join("\n");
}
