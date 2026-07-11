// evals/goldenTasks.ts
// 골든 태스크 10종 + 각 태스크의 "정답" 툴 시퀀스(오프라인 채점/회귀 기준).
// 실제 LLM 러너는 동일 태스크의 prompt만 사용하고 시퀀스는 스스로 생성한다.
// 쓰기/읽기/에러복구를 골고루 포함한다.

import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import { createBlankProject } from "@/project/defaults";
import { isRoadTile } from "@/project/defaults/roadAutotile";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import type { Project } from "@/project/types";
import {
  custom,
  hasEventWithCommand,
  itemExists,
  mapCountAtLeast,
  questExists,
  switchNamed,
  troopExists,
  type GoldenTask,
} from "./goldenTask";
import type { ToolCall } from "./runner";

const TOWN = "m_town";

function emptyStart(): Project {
  return createEmptyToolProject("골든 태스크");
}

function baseTown(): readonly ToolCall[] {
  return [
    { name: "create_map", args: { name: "마을", width: 18, height: 14, id: TOWN } },
    { name: "set_start_position", args: { mapId: TOWN, x: 9, y: 7 } },
  ];
}

// 각 맵에 이름으로 이벤트가 있는지 확인하는 매처.
function hasNpcNamed(namePart: string) {
  return custom(`'${namePart}' NPC 존재`, (project) =>
    Object.values(project.maps).some((map) =>
      map.events.some((event) => (event.pages ?? []).some((page) => page.name.includes(namePart)))
    )
  );
}

// 1) 여관 짓기(쓰기: 맵+NPC+inn).
export const GOLDEN_INN: GoldenTask = {
  id: "inn",
  prompt: "빈 프로젝트에 마을 맵을 하나 만들고, 15G에 숙박시키는 여관 주인 NPC를 배치해줘.",
  initialProject: emptyStart,
  matchers: [mapCountAtLeast(1), hasEventWithCommand("inn")],
};
const GOLDEN_INN_SOLUTION: readonly ToolCall[] = [
  ...baseTown(),
  {
    name: "place_npc",
    args: { mapId: TOWN, x: 5, y: 4, name: "여관 주인", graphic: { query: "여관 주인" }, pages: [{ lines: ["하룻밤 15G입니다."], commands: [{ kind: "inn", price: 15 }] }] },
  },
];

// 2) 상점 NPC(쓰기: 아이템 + shop).
export const GOLDEN_SHOP: GoldenTask = {
  id: "shop",
  prompt: "마을에 회복약을 파는 상점 주인 NPC를 만들어줘.",
  initialProject: emptyStart,
  matchers: [itemExists("it_potion"), hasEventWithCommand("shop")],
};
const GOLDEN_SHOP_SOLUTION: readonly ToolCall[] = [
  ...baseTown(),
  { name: "upsert_item", args: { item: { id: "it_potion", name: "회복약", price: 20 } } },
  { name: "place_npc", args: { mapId: TOWN, x: 6, y: 4, name: "상점 주인", graphic: { query: "상인" }, pages: [{ lines: ["어서 오세요."], commands: [{ kind: "shop", itemIds: ["it_potion"], allowSell: true }] }] } },
];

// 3) 전투 블로커 + 드랍(쓰기: 아이템/적/트룹/블로커).
export const GOLDEN_BATTLE: GoldenTask = {
  id: "battle-blocker",
  prompt: "마을 맵에 슬라임 전투를 배치하고, 승리하면 낡은 열쇠를 주도록 해줘. 필요한 아이템/적/트룹도 만들어줘.",
  initialProject: emptyStart,
  matchers: [itemExists("it_key"), troopExists("tr_slime"), hasEventWithCommand("battleProcessing")],
};
const GOLDEN_BATTLE_SOLUTION: readonly ToolCall[] = [
  ...baseTown(),
  { name: "upsert_item", args: { item: { id: "it_key", name: "낡은 열쇠" } } },
  { name: "upsert_enemy", args: { enemy: { id: "en_slime", name: "슬라임" } } },
  { name: "upsert_troop", args: { troop: { id: "tr_slime", name: "슬라임 무리", enemyIds: ["en_slime"] } } },
  { name: "place_battle_blocker", args: { mapId: TOWN, x: 9, y: 3, troopId: "tr_slime", graphic: { query: "슬라임" }, victoryItems: [{ itemId: "it_key", amount: 1 }] } },
];

// 4) 3맵 던전 + 출입구 쌍(쓰기: 맵 여러 개 + transfer).
export const GOLDEN_DUNGEON: GoldenTask = {
  id: "dungeon-chain",
  prompt: "마을-숲-동굴 3개 맵을 만들고 출입구로 서로 이어줘.",
  initialProject: emptyStart,
  matchers: [mapCountAtLeast(3), hasEventWithCommand("transfer")],
};
const GOLDEN_DUNGEON_SOLUTION: readonly ToolCall[] = [
  { name: "create_map", args: { name: "마을", width: 16, height: 12, id: "d_town" } },
  { name: "create_map", args: { name: "숲", width: 16, height: 12, id: "d_forest" } },
  { name: "create_map", args: { name: "동굴", width: 16, height: 12, id: "d_cave" } },
  { name: "set_start_position", args: { mapId: "d_town", x: 8, y: 6 } },
  { name: "create_transfer_pair", args: { a: { mapId: "d_town", x: 14, y: 6 }, b: { mapId: "d_forest", x: 1, y: 6 } } },
  { name: "create_transfer_pair", args: { a: { mapId: "d_forest", x: 14, y: 6 }, b: { mapId: "d_cave", x: 1, y: 6 } } },
];

// 5) 퀘스트(쓰기: create_quest).
export const GOLDEN_QUEST: GoldenTask = {
  id: "quest",
  prompt: "마을에 '심부름' 퀘스트를 만들어줘: 촌장과 대화한 뒤 슬라임을 처치하면 완료.",
  initialProject: emptyStart,
  matchers: [questExists("q_errand"), switchNamed("sw_q_errand_started"), hasEventWithCommand("battleProcessing")],
};
const GOLDEN_QUEST_SOLUTION: readonly ToolCall[] = [
  ...baseTown(),
  { name: "upsert_enemy", args: { enemy: { id: "en_slime", name: "슬라임" } } },
  { name: "upsert_troop", args: { troop: { id: "tr_slime", name: "슬라임 무리", enemyIds: ["en_slime"] } } },
  {
    name: "create_quest",
    args: {
      def: {
        key: "q_errand",
        title: "심부름",
        summary: "촌장과 대화한 뒤 슬라임을 처치하라.",
        giver: { create: { mapId: TOWN, x: 9, y: 6, name: "촌장", textureKey: "tex_easyrpg_charset_people1", characterIndex: 6 } },
        steps: [
          { kind: "talk", target: { create: { mapId: TOWN, x: 4, y: 4, name: "안내인", graphicQuery: "여관 주인" } } },
          { kind: "kill", troopId: "tr_slime", at: { mapId: TOWN, x: 12, y: 3, graphicQuery: "슬라임" } },
        ],
        rewards: { gold: 30 },
      },
    },
  },
];

// 6) 강한 적 만들기(쓰기+시뮬 근거: tune_enemy로 어렵게).
export const GOLDEN_TOUGH_ENEMY: GoldenTask = {
  id: "tough-enemy",
  prompt: "기본 슬라임보다 훨씬 강한 보스 적을 만들어줘. Lv1 영웅이 여러 대 때려야 잡히게.",
  initialProject: emptyStart,
  matchers: [
    custom("보스 적 존재 + 강함", (project) => {
      const boss = project.database.enemies.find((enemy) => enemy.id === "en_boss");
      return boss !== undefined && boss.stats.maxHp >= 100;
    }),
  ],
};
const GOLDEN_TOUGH_SOLUTION: readonly ToolCall[] = [
  ...baseTown(),
  { name: "upsert_enemy", args: { enemy: { id: "en_boss", name: "보스", stats: { maxHp: 50, attack: 30, defense: 20 } } } },
  { name: "tune_enemy", args: { enemyId: "en_boss", targetHitsToKill: 8, targetDamageToHeroPerHit: 120, heroLevel: 1 } },
];

// 7) 시작 상태 설정(쓰기: set_session_start + set_title_screen).
export const GOLDEN_SESSION: GoldenTask = {
  id: "session-start",
  prompt: "게임 제목을 '작은 모험'으로 하고, 시작 골드를 200으로, 시작 인벤토리에 회복약 3개를 넣어줘.",
  initialProject: emptyStart,
  matchers: [
    custom("제목이 '작은 모험'", (project) => project.meta.title === "작은 모험"),
    custom("시작 골드 200", (project) => project.session.gold === 200),
    custom("시작 인벤토리 회복약 3", (project) => project.session.inventory.it_potion === 3),
  ],
};
const GOLDEN_SESSION_SOLUTION: readonly ToolCall[] = [
  ...baseTown(),
  { name: "upsert_item", args: { item: { id: "it_potion", name: "회복약" } } },
  { name: "set_title_screen", args: { title: "작은 모험" } },
  { name: "set_session_start", args: { gold: 200, inventory: { it_potion: 3 } } },
];

// 8) 도로 + 구조물(쓰기: paint_road + stamp_structure).
export const GOLDEN_LAYOUT: GoldenTask = {
  id: "town-layout",
  prompt: "마을에 흙길을 깔고 집을 하나 세워줘.",
  initialProject: emptyStart,
  matchers: [
    custom("흙길 타일 존재", (project) => {
      const map = Object.values(project.maps)[0];
      return map !== undefined && map.lowerTiles.some((tile) => isRoadTile(tile));
    }),
  ],
};
const GOLDEN_LAYOUT_SOLUTION: readonly ToolCall[] = [
  { name: "create_map", args: { name: "마을", width: 18, height: 14, id: TOWN } },
  // 시작점을 하단 안전 칸으로 먼저 옮긴다(생성 시 자동채택된 중앙점을 구조물이 덮지 않도록).
  { name: "set_start_position", args: { mapId: TOWN, x: 8, y: 12 } },
  { name: "stamp_structure", args: { mapId: TOWN, template: "l", origin: { x: 2, y: 1 } } },
  { name: "paint_road", args: { mapId: TOWN, points: [{ x: 2, y: 12 }, { x: 15, y: 12 }], style: "dirt" } },
];

// 9) 에러 복구: 물 위 NPC(거부 후 통행 가능 칸으로 재배치).
export const GOLDEN_ERROR_RECOVERY: GoldenTask = {
  id: "error-recovery",
  prompt: "잿불 마을 연못(물) 위에 NPC를 놓아줘. 물 위가 안 되면 근처 통행 가능한 곳에 놔줘.",
  initialProject: createEmberQuestProject,
  matchers: [hasNpcNamed("낚시꾼")],
};
// 정답 시퀀스는 물 위 실패를 겪지 않고 바로 통행 가능한 칸에 배치(오프라인 채점 기준).
const GOLDEN_ERROR_SOLUTION: readonly ToolCall[] = [
  { name: "place_npc", args: { mapId: "map_ember_village", x: 24, y: 20, name: "낚시꾼", graphic: { query: "상인" }, pages: [{ lines: ["오늘은 잘 잡히는군."] }] } },
];

// 10) 읽기: 프로젝트 요약(읽기 툴은 프로젝트를 바꾸지 않으므로, 요약이 스펙과 맞는지 확인).
export const GOLDEN_SUMMARY: GoldenTask = {
  id: "summary",
  prompt: "이 프로젝트에 맵이 몇 개인지, 어떤 트룹이 있는지 알려줘.",
  initialProject: createEmberQuestProject,
  // 읽기 태스크: 프로젝트가 잿불의 유산 스펙(맵5) 그대로 유지되는지 확인(파괴하지 않음).
  matchers: [mapCountAtLeast(5), troopExists("troop_slime_pair")],
};
const GOLDEN_SUMMARY_SOLUTION: readonly ToolCall[] = [
  // 읽기만 하므로 프로젝트를 변경하지 않는다(정답 시퀀스는 비어 있음).
];

// 11) 몬스터 수집(포켓몬 코어): 수집 ON + 전투 파티 모드 ON + 스타터 지급 이벤트.
// 저작 시점 session.monsterParty는 빈 채로 남는다(give_starter_monsters는 런타임 이벤트만 만든다).
// 따라서 스타터 매처는 session.monsterParty가 아니라 system 플래그 + 스타터 지급 이벤트로 판정한다.
const givesStarterMonster = hasEventWithCommand("giveMonster");
export const GOLDEN_MONSTER: GoldenTask = {
  id: "monster-collection",
  prompt: "포켓몬처럼 몬스터를 잡아서 내 파티로 전투하는 게임으로 만들어줘. 스타터도 주고.",
  initialProject: createBlankProject,
  matchers: [
    custom("몬스터 수집 ON", (project) => project.system.monsterCollection === true),
    custom("몬스터 전투 파티 모드 ON", (project) => project.system.monsterBattleParty === true),
    custom("스타터 지급 이벤트 존재", (project) =>
      givesStarterMonster.check(project) ||
      Object.values(project.maps).some((map) => map.events.some((event) => event.id.startsWith("ev_starter_monsters")))
    ),
  ],
};
const GOLDEN_MONSTER_SOLUTION: readonly ToolCall[] = [
  { name: "configure_monster_system", args: { enabled: true, battleParty: true } },
  { name: "give_starter_monsters", args: { speciesIds: ["species_leafling", "species_sparkit", "species_aqualing"] } },
];

export const GOLDEN_TASKS: readonly GoldenTask[] = [
  GOLDEN_INN,
  GOLDEN_SHOP,
  GOLDEN_BATTLE,
  GOLDEN_DUNGEON,
  GOLDEN_QUEST,
  GOLDEN_TOUGH_ENEMY,
  GOLDEN_SESSION,
  GOLDEN_LAYOUT,
  GOLDEN_ERROR_RECOVERY,
  GOLDEN_SUMMARY,
  GOLDEN_MONSTER,
];

// 태스크 id → 정답 시퀀스(오프라인 채점).
export const GOLDEN_SOLUTIONS: Record<string, readonly ToolCall[]> = {
  inn: GOLDEN_INN_SOLUTION,
  shop: GOLDEN_SHOP_SOLUTION,
  "battle-blocker": GOLDEN_BATTLE_SOLUTION,
  "dungeon-chain": GOLDEN_DUNGEON_SOLUTION,
  quest: GOLDEN_QUEST_SOLUTION,
  "tough-enemy": GOLDEN_TOUGH_SOLUTION,
  "session-start": GOLDEN_SESSION_SOLUTION,
  "town-layout": GOLDEN_LAYOUT_SOLUTION,
  "error-recovery": GOLDEN_ERROR_SOLUTION,
  summary: GOLDEN_SUMMARY_SOLUTION,
  "monster-collection": GOLDEN_MONSTER_SOLUTION,
};

// LLM 러너가 참조할 개별 태스크 export(테스트/외부 재사용).
export { GOLDEN_INN_SOLUTION };
