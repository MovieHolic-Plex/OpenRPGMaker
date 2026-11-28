// 드래그 선택 영역 「몹 조우」 8종 아키타입 카탈로그 & 고밀도 상세 프롬프트 자동 조립기.
// 순수 함수(store·DOM·네트워크 의존 없음) — 구역 성격별 추천 정렬과
// 현재 맵 실데이터(mapPlacementContext + DB 트룹/적 + worldCanon + 구역 좌표) 기반 상세 프롬프트를 생성한다.
import { buildMapPlacementContext } from "@/ai/mapPlacementContext";
import { resolveWorldCanon, worldCanonHasContent } from "@/project/world/canon";
import type { GameMap, Project } from "@/project/types";
import type { SelectionRect } from "./selectionTerrainSummary";
import type { SelectionZoneContext } from "./selectionIntentRank";

export type EncounterArchetypeCategory = "random" | "field";

export type EncounterArchetypeId =
  | "walk_random"
  | "hunting_ground"
  | "night_spawn"
  | "action_horde"
  | "symbol_patrol"
  | "ambush_elite"
  | "sight_trainer"
  | "trap_chase";

export interface EncounterArchetypeDef {
  readonly id: EncounterArchetypeId;
  readonly category: EncounterArchetypeCategory;
  readonly icon: string;
  readonly label: string;
  readonly summary: string;
  readonly memoPlaceholder: string;
  readonly tools: readonly string[];
  readonly specLines: readonly string[];
}

export const ENCOUNTER_ARCHETYPE_CATEGORIES: readonly { readonly id: "rec" | EncounterArchetypeCategory; readonly label: string }[] = [
  { id: "rec", label: "추천" },
  { id: "random", label: "랜덤·사냥터" },
  { id: "field", label: "필드·추격·함정" },
] as const;

export const ENCOUNTER_ARCHETYPES: readonly EncounterArchetypeDef[] = [
  {
    id: "walk_random",
    category: "random",
    icon: "🌿",
    label: "풀숲 조우",
    summary: "걸을 때 랜덤 전투(영역)",
    memoPlaceholder: "예: 슬라임 70%, 늑대 30% 빈도 보통",
    tools: ["set_encounter_table", "upsert_troop", "get_database_records"],
    specLines: [
      "역할: 선택 영역을 걸을 때만 발동하는 구역 한정 랜덤 인카운터를 설정한다(set_encounter_table).",
      "필수 구성: 기존 맵의 다른 구역 인카운터는 유지하면서 이 영역(conditions.region 또는 저장된 locationId) 전용 항목 2~3종(일반·희귀 가중치)을 추가하고 적정 encounterRate를 맞춘다.",
      "데이터 정합성: DB의 실존 troopId만 사용하며, 구역 분위기에 맞는 적이 없으면 upsert_enemy + upsert_troop 으로 먼저 생성한다.",
    ],
  },
  {
    id: "hunting_ground",
    category: "random",
    icon: "🐺",
    label: "사냥터 무리",
    summary: "보이는 몹 리스폰 구역",
    memoPlaceholder: "예: 최대 3마리, 처치 20초 뒤 리스폰",
    tools: ["make_hunting_ground", "upsert_troop", "get_database_records"],
    specLines: [
      "역할: 선택 영역(area) 안에서 눈에 보이는 몬스터가 배회·리스폰되는 사냥터를 구성한다(make_hunting_ground).",
      "필수 구성: 영역 면적에 맞춰 maxAlive(보통 2~4마리), respawnSec, chase 여부를 설정하고 저장된 구역 태그가 있으면 locationId도 함께 연결한다.",
      "전투 방식: 프로젝트 전투 규약(접촉/액션)을 존중하고, 존재하지 않는 troopId는 쓰지 않는다.",
    ],
  },
  {
    id: "night_spawn",
    category: "random",
    icon: "🌙",
    label: "시간대 출현",
    summary: "밤·저녁 전용 특수 몹",
    memoPlaceholder: "예: 밤에만 나타나는 유령 무리, 낮에는 안전",
    tools: ["make_hunting_ground", "configure_time_system", "get_database_records"],
    specLines: [
      "역할: 특정 시간대(예: 밤 [\"night\"] 또는 저녁·밤)에만 나타나는 시간 연동 생태 몹 구역을 만든다.",
      "필수 구성: 시간 시스템이 꺼져 있으면 configure_time_system({enabled:true})을 먼저 켜고, make_hunting_ground 에 timePhases 를 명시해 시간대 밖에서는 자연스럽게 사라지게 한다.",
      "분위기: 구역과 시간대에 어울리는 적 트룹을 연결하고 난이도가 과도하게 튀지 않게 조절한다.",
    ],
  },
  {
    id: "action_horde",
    category: "random",
    icon: "💥",
    label: "실시간 액션 몹",
    summary: "필드에서 직접 싸우는 적",
    memoPlaceholder: "예: 돌진 공격하는 고블린 2마리",
    tools: ["set_action_combat", "make_action_enemy", "get_database_records"],
    specLines: [
      "역할: 턴제 화면 전환 없이 필드 위에서 실시간으로 공격·회피 전투를 벌이는 액션 몬스터를 배치한다(make_action_enemy).",
      "필수 구성: 선택 영역(spawn.area)에 maxAlive, chase:true 와 함께 선딜·후딜이 읽히는 actionProfile(melee/projectile/dash, windupMs, recoverMs, damage, range)을 설정한다.",
      "밸런스: 플레이어 이동·공격 템포에 맞게 과도한 즉사 데미지를 피하고, 필요 시 해당 맵 액션 전투를 활성화한다.",
    ],
  },
  {
    id: "symbol_patrol",
    category: "field",
    icon: "👁",
    label: "순찰·시야 몹",
    summary: "경로 순찰 · 시야 추격",
    memoPlaceholder: "예: 길목을 순찰하다 시야에 들면 추격하는 산적",
    tools: ["place_field_enemy", "upsert_troop", "get_database_records"],
    specLines: [
      "역할: 선택 영역 안에 정해진 경로를 순찰하거나 시야에 들면 「!」 반응 후 추격하는 심볼 인카운터 적 1~3마리를 배치한다(place_field_enemy).",
      "필수 구성: behavior('patrol' 또는 'chase'), sightRange(3~5칸), patrol 경로, 적정 chaseStepMs(주인공 160ms보다 살짝 느리게 조정 가능)를 설정한다.",
      "안전 배치: 맵 입구·시작 위치에서 2칸 이상 떨어진 통행 가능 칸에만 놓아 진입 직후 불합리한 급습을 막는다.",
    ],
  },
  {
    id: "ambush_elite",
    category: "field",
    icon: "💀",
    label: "매복·강적",
    summary: "고정 엘리트 · 수호자",
    memoPlaceholder: "예: 다리를 지키는 중보스 골렘, 승리 시 통과",
    tools: ["place_field_enemy", "place_battle_blocker", "upsert_troop", "simulate_battle"],
    specLines: [
      "역할: 선택 영역의 요충지를 지키는 고정형 강적/엘리트 또는 보스급 수호자 1기를 배치한다.",
      "필수 구성: 통로를 막는 수호자면 place_battle_blocker 로 도발 대사·전투·승리 후 제거/보상을 구성하고, 일반 고정 강적이면 place_field_enemy(behavior:'stationary')를 사용한다.",
      "밸런스: 강적 트룹은 현재 파티 기준으로 전멸만 나지 않게 설계하고 가능하면 simulate_battle 로 승률을 확인한다.",
    ],
  },
  {
    id: "sight_trainer",
    category: "field",
    icon: "🧢",
    label: "시야 트레이너",
    summary: "눈 마주치면 배틀 도전",
    memoPlaceholder: "예: 숲길에서 도전을 거는 견습 모험가",
    tools: ["place_trainer", "get_database_records"],
    specLines: [
      "역할: 플레이어가 시야선에 들어서면 「!」와 함께 다가와 배틀을 거는 트레이너/결투자 NPC를 배치한다(place_trainer).",
      "필수 구성: 구역 동선에 맞는 facing·sightRange, 전투 전/후 대사(before/after), 적정 트룹 또는 몬스터 팀, 승리 보상(rewardGold/rewardItems)을 설정한다.",
      "안전 배치: 출입구 직선 시야나 시작점 2칸 이내를 피하고, 1회 승리 후에는 재도전 선택 또는 완료 대사로 자연스럽게 이어지게 한다.",
    ],
  },
  {
    id: "trap_chase",
    category: "field",
    icon: "👻",
    label: "함정·추격자",
    summary: "가시 함정 / 공포 추격전",
    memoPlaceholder: "예: 밟으면 위험한 가시 함정 또는 순찰하는 유령",
    tools: ["place_trap", "make_chase_scene", "set_lighting_volume"],
    specLines: [
      "역할: 선택 영역에 긴장감 있는 함정(place_trap) 또는 실시간 추격자(make_chase_scene) 장치를 배치한다.",
      "필수 구성: 함정은 눈에 보이는 위험 그래픽과 발동 메시지를 붙이고, 추격자는 시야·이동속도·숨는 곳(hidingSpots) 또는 안전 구역을 함께 설계한다.",
      "복귀 안전망: 맵 입구 체크포인트(respawnCheckpoint / checkpointOnEntry)를 켜서 패배 시 타이틀이 아닌 맵 입구에서 재도전할 수 있게 한다.",
    ],
  },
] as const;

const ARCHETYPE_BY_ID: Readonly<Record<EncounterArchetypeId, EncounterArchetypeDef>> = Object.fromEntries(
  ENCOUNTER_ARCHETYPES.map((item) => [item.id, item]),
) as Record<EncounterArchetypeId, EncounterArchetypeDef>;

export function getEncounterArchetype(id: EncounterArchetypeId): EncounterArchetypeDef {
  return ARCHETYPE_BY_ID[id];
}

const NIGHT_HORROR_RE = /밤|묘지|폐허|지하|유령|저주|공포|어둠|감옥|night|crypt|horror|ghost|haunted/iu;
const ROAD_CHOKE_RE = /길목|다리|입구|관문|통로|복도|road|bridge|gate|corridor|path/iu;
const WATER_HINT_RE = /물가|강|호수|해안|늪|습지|water|river|lake|swamp/iu;

/** 구역 성격에 맞춰 가장 어울리는 몹 조우 아키타입 순서(앞 4개가 핵심 추천)를 0ms 로 돌려준다. */
export function recommendedEncounterArchetypes(zone: SelectionZoneContext | null): {
  readonly items: readonly EncounterArchetypeDef[];
  readonly topIds: ReadonlySet<EncounterArchetypeId>;
} {
  let order: EncounterArchetypeId[];
  const label = zone ? `${zone.label} ${(zone.locationTags ?? []).join(" ")} ${zone.suggestedZoneTags.join(" ")}` : "";
  const area = zone?.metrics.area ?? 12;

  if (NIGHT_HORROR_RE.test(label)) {
    order = ["trap_chase", "night_spawn", "ambush_elite", "symbol_patrol", "walk_random", "hunting_ground", "action_horde", "sight_trainer"];
  } else if (zone?.mapRole === "dungeon") {
    order = area <= 9
      ? ["ambush_elite", "symbol_patrol", "trap_chase", "walk_random", "hunting_ground", "action_horde", "night_spawn", "sight_trainer"]
      : ["symbol_patrol", "walk_random", "ambush_elite", "trap_chase", "hunting_ground", "action_horde", "night_spawn", "sight_trainer"];
  } else if (ROAD_CHOKE_RE.test(label) || (zone?.metrics.outsideCounts.road ?? 0) >= 3) {
    order = ["sight_trainer", "symbol_patrol", "ambush_elite", "walk_random", "hunting_ground", "night_spawn", "action_horde", "trap_chase"];
  } else if (WATER_HINT_RE.test(label) || (zone?.metrics.waterRatio ?? 0) >= 0.25) {
    order = ["walk_random", "night_spawn", "hunting_ground", "symbol_patrol", "ambush_elite", "action_horde", "trap_chase", "sight_trainer"];
  } else {
    order = ["walk_random", "hunting_ground", "symbol_patrol", "ambush_elite", "sight_trainer", "night_spawn", "action_horde", "trap_chase"];
  }

  return {
    items: order.map((id) => ARCHETYPE_BY_ID[id]),
    topIds: new Set<EncounterArchetypeId>(order.slice(0, 4)),
  };
}

export interface BuildEncounterArchetypePromptInput {
  readonly archetypeId: EncounterArchetypeId;
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
 * 선택 몹 조우 아키타입 + 현재 맵/트룹/세계관 실데이터 + 사용자 한 줄 메모를 합쳐
 * AI 조수에게 넘길 고밀도 구조화 상세 프롬프트를 0ms 로 조립한다.
 */
export function buildEncounterArchetypePrompt(input: BuildEncounterArchetypePromptInput): string {
  const arch = getEncounterArchetype(input.archetypeId);
  const { selection, suggestedCell, zone, zoneLabel, zoneSaved } = input;
  const xEnd = selection.x + Math.max(1, selection.width) - 1;
  const yEnd = selection.y + Math.max(1, selection.height) - 1;
  const zoneDesc = zoneSaved
    ? `「${zoneLabel}」 (저장된 구역 태그${zone?.locationId ? ` · locationId=${zone.locationId}` : ""})`
    : `「${zoneLabel}」`;
  const cellHint = suggestedCell
    ? `기준 통행 칸 (${suggestedCell.x}, ${suggestedCell.y})`
    : `영역 내 빈 통행 칸 없음 (영역 재선택 또는 통행 가능 칸 확인 필요)`;

  const lines: string[] = [
    `[대상 구역] ${zoneDesc} · 좌표 (${selection.x},${selection.y})~(${xEnd},${yEnd}) ${selection.width}×${selection.height}칸 · ${cellHint}`,
    `[작업 종류] ${arch.icon} ${arch.label} 조우·전투 저작 (권장 도구: ${arch.tools.join(", ")})`,
    ...arch.specLines.map((line) => `• ${line}`),
  ];

  if (input.project && input.map) {
    const placement = buildMapPlacementContext(input.project, input.map.id);
    const ctxParts: string[] = [];
    if (placement) {
      ctxParts.push(`맵 성격: ${placement.role.role}(${placement.role.reason})`);
      if (placement.fights && placement.fights.enemyNames.length > 0) {
        ctxParts.push(`이 맵 기존 적: ${placement.fights.enemyNames.slice(0, 5).join(", ")}`);
      }
      if (placement.wiki.length > 0) {
        ctxParts.push(`연결 설정집: ${placement.wiki.slice(0, 3).map((w) => w.name).join(", ")}`);
      }
    }
    const existingTableCount = input.map.encounterTable?.length ?? 0;
    const existingSpawnCount = input.map.fieldSpawns?.length ?? 0;
    ctxParts.push(`현재 조우: encounterRate=${input.map.encounterRate ?? 0}, 테이블 ${existingTableCount}개, 필드스폰 ${existingSpawnCount}개`);
    const dbTroops = input.project.database.troops.slice(0, 6).map((t) => `${t.name}(${t.id})`);
    if (dbTroops.length > 0) {
      ctxParts.push(`DB 등록 트룹 예시: ${dbTroops.join(", ")}`);
    }
    lines.push(`[현재 맵 실데이터] ${ctxParts.join(" · ")}`);

    if (worldCanonHasContent(input.project.worldCanon)) {
      const canon = resolveWorldCanon(input.project.worldCanon);
      const worldName = canon.name ? `「${canon.name}」` : "「이 세계」";
      const absenceNote = canon.absences.length > 0 ? ` · 금지 요소(${canon.absences.slice(0, 5).join(", ")}) 절대 사용 금지` : "";
      lines.push(`[세계관 정합성] 자료집 ${worldName}의 시대·톤·생태계에 어울리는 몬스터·대사·전투 구성을 사용할 것${absenceNote}.`);
    }
  }

  const memo = input.userMemo?.trim();
  if (memo) {
    lines.push(`[사용자 추가 요청] ${memo}`);
  }

  lines.push(
    `[필수 가드레일] 반드시 선택 영역 안(또는 해당 locationId)의 통행 가능 칸 기준으로만 조우·스폰을 설정하고, 입구·시작점 2칸 이내 급습 배치와 기존 지형·건물·NPC 훼손은 금지해.`,
  );

  return lines.join("\n");
}
