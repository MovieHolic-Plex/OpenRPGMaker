// test/emberQuestToolReplay.test.ts
// Dogfooding: 잿불의 유산류 게임을 "툴 호출 시퀀스(JSON 배열)만으로" 빈 프로젝트에서 재구축한다.
// 검증: (a) 스펙 카운트(맵5/NPC12/몬스터5/아이템8/전투블로커5), (b) projectLint error 0,
//       (c) 주요 지점 도달성 통과. 타일 완전 일치는 요구하지 않는다.

import { describe, expect, it } from "vitest";
import { projectLint } from "@/project/lint/projectLint";
import type { ReachabilitySpec } from "@/project/lint/reachability";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { Command, Project } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";

interface ToolCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

const MAP = {
  village: "m_village",
  forest: "m_forest",
  mine: "m_mine",
  pass: "m_pass",
  sanctum: "m_sanctum",
} as const;

const ITEM_IDS = ["it_potion", "it_ether", "it_antidote", "it_hipotion", "it_key", "it_talisman", "it_herb", "it_core"] as const;
const ENEMY_IDS = ["en_slime", "en_bee", "en_bat", "en_golem", "en_dragon"] as const;
const TROOPS: ReadonlyArray<{ id: string; name: string; enemy: string }> = [
  { id: "tr_slimes", name: "슬라임 무리", enemy: "en_slime" },
  { id: "tr_bees", name: "말벌 떼", enemy: "en_bee" },
  { id: "tr_bats", name: "박쥐 떼", enemy: "en_bat" },
  { id: "tr_golem", name: "돌 골렘", enemy: "en_golem" },
  { id: "tr_dragon", name: "붉은 용", enemy: "en_dragon" },
];

const PEOPLE = "tex_easyrpg_charset_people1";

// 툴 호출 시퀀스 전체를 순수 데이터로 구성한다.
function buildToolSequence(): ToolCall[] {
  const calls: ToolCall[] = [];

  // 1) 맵 5개(첫 맵이 시작 맵으로 채택됨).
  calls.push({ name: "create_map", args: { name: "잿불 마을", width: 20, height: 16, id: MAP.village } });
  calls.push({ name: "create_map", args: { name: "안개 숲", width: 18, height: 18, id: MAP.forest } });
  calls.push({ name: "create_map", args: { name: "메마른 광산", width: 16, height: 14, id: MAP.mine } });
  calls.push({ name: "create_map", args: { name: "잿빛 고개", width: 16, height: 12, id: MAP.pass } });
  calls.push({ name: "create_map", args: { name: "화염 성소", width: 14, height: 12, id: MAP.sanctum } });

  // 2) 아이템 8종.
  const itemNames = ["회복약", "에테르", "해독제", "상급 회복약", "낡은 열쇠", "수호 부적", "달빛 약초", "골렘의 핵"];
  ITEM_IDS.forEach((id, index) => {
    calls.push({ name: "upsert_item", args: { item: { id, name: itemNames[index], price: 20 } } });
  });

  // 3) 적 5종.
  const enemyNames = ["슬라임", "말벌", "박쥐", "돌 골렘", "붉은 용"];
  ENEMY_IDS.forEach((id, index) => {
    calls.push({ name: "upsert_enemy", args: { enemy: { id, name: enemyNames[index], ...(id === "en_bee" ? { monsterResourceId: "generated-enemy-sylph-hornet" } : {}), stats: { maxHp: 40 + index * 30, attack: 60 } } } });
  });

  // 4) 트룹 5개.
  for (const troop of TROOPS) {
    calls.push({ name: "upsert_troop", args: { troop: { id: troop.id, name: troop.name, enemyIds: [troop.enemy] } } });
  }

  // 5) 퀘스트 플래그 3개.
  calls.push({ name: "create_quest_flags", args: { questKey: "q_furnace", steps: 3 } });
  calls.push({ name: "create_quest_flags", args: { questKey: "q_herbs", steps: 3 } });
  calls.push({ name: "create_quest_flags", args: { questKey: "q_smith", steps: 2 } });

  // 6) NPC 12명(마을6/숲2/광산2/고개1/성소1). id는 ev_npc_* 접두.
  const npc = (n: number, mapId: string, x: number, y: number, name: string, pages: unknown[]): ToolCall => ({
    name: "place_npc",
    args: { mapId, x, y, name, id: `ev_npc_${n}`, graphic: { textureKey: PEOPLE, characterIndex: n % 8 }, pages },
  });
  // 마을 NPC.
  calls.push(npc(1, MAP.village, 9, 6, "촌장 로안", [
    { lines: ["마을 화로가 꺼졌네. 성소의 불씨를 되살려 주게."], choices: [
      { text: "수락한다", commands: [{ kind: "setSwitch", switchId: "sw_q_furnace_started", value: true }] as Command[] },
      { text: "나중에" },
    ] },
    { conditions: [{ kind: "switch", switchId: "sw_q_furnace_started", value: true }], lines: ["성소로 가는 길을 서두르게."] },
  ]));
  calls.push(npc(2, MAP.village, 4, 4, "여관 주인 마사", [{ lines: ["하룻밤 15G입니다."], commands: [{ kind: "inn", price: 15 }] as Command[] }]));
  calls.push(npc(3, MAP.village, 14, 4, "상점 주인 리코", [{ lines: ["필요한 물건 있어요?"], commands: [{ kind: "shop", itemIds: [ITEM_IDS[0], ITEM_IDS[1]], allowSell: true } as Command] }]));
  calls.push(npc(4, MAP.village, 6, 10, "대장장이 무겐", [
    { lines: ["골렘의 핵을 가져오면 부적을 주지."], choices: [
      { text: "수락", commands: [{ kind: "setSwitch", switchId: "sw_q_smith_started", value: true }] as Command[] },
      { text: "거절" },
    ] },
  ]));
  calls.push(npc(5, MAP.village, 12, 10, "꼬마 미루", [{ lines: ["숲에 반짝이는 풀이 있대!"] }]));
  calls.push(npc(6, MAP.village, 16, 12, "파수꾼 데릭", [{ lines: ["동문 밖은 위험해."] }]));
  // 숲 NPC.
  calls.push(npc(7, MAP.forest, 5, 5, "약초꾼 세라", [
    { lines: ["달빛 약초 세 뿌리를 찾아 주세요."], choices: [
      { text: "수락", commands: [{ kind: "setSwitch", switchId: "sw_q_herbs_started", value: true }] as Command[] },
      { text: "나중에" },
    ] },
  ]));
  calls.push(npc(8, MAP.forest, 12, 12, "사냥꾼 브란", [{ lines: ["북쪽 광산 문은 잠겨 있어."] }]));
  // 광산 NPC.
  calls.push(npc(9, MAP.mine, 5, 5, "광부 톨크", [{ lines: ["박쥐 떼를 조심하게."] }]));
  calls.push(npc(10, MAP.mine, 10, 8, "겁먹은 인부 피오", [{ lines: ["샘물 마시고 가요."], commands: [{ kind: "recoverAll" } as Command] }]));
  // 고개 NPC.
  calls.push(npc(11, MAP.pass, 8, 5, "은둔자 오웬", [{ lines: ["용 앞에서 아끼지 말게."], commands: [{ kind: "recoverAll" } as Command] }]));
  // 성소 NPC.
  calls.push(npc(12, MAP.sanctum, 6, 8, "성소지기의 영혼", [{ lines: ["용을 잠재우면 화로가 타오를 것이다."], commands: [{ kind: "recoverAll" } as Command] }]));

  // 7) 전투 블로커 5개(id ev_blk_*).
  const blocker = (n: number, mapId: string, x: number, y: number, troopId: string, victoryItem?: string): ToolCall => ({
    name: "place_battle_blocker",
    args: {
      mapId,
      x,
      y,
      troopId,
      id: `ev_blk_${n}`,
      graphic: { query: "몬스터" },
      intro: ["적이 길을 막았다!"],
      victory: ["길이 열렸다."],
      victoryItems: victoryItem ? [{ itemId: victoryItem, amount: 1 }] : undefined,
    },
  });
  calls.push(blocker(1, MAP.forest, 9, 9, "tr_slimes"));
  calls.push(blocker(2, MAP.forest, 14, 6, "tr_bees", "it_key"));
  calls.push(blocker(3, MAP.mine, 8, 6, "tr_bats"));
  calls.push(blocker(4, MAP.mine, 12, 3, "tr_golem", "it_core"));
  calls.push(blocker(5, MAP.sanctum, 7, 4, "tr_dragon"));

  // 8) 출입구 쌍 4개(마을↔숲↔광산↔고개↔성소).
  const pair = (aMap: string, ax: number, ay: number, bMap: string, bx: number, by: number): ToolCall => ({
    name: "create_transfer_pair",
    args: { a: { mapId: aMap, x: ax, y: ay }, b: { mapId: bMap, x: bx, y: by } },
  });
  calls.push(pair(MAP.village, 18, 8, MAP.forest, 1, 9));
  calls.push(pair(MAP.forest, 16, 9, MAP.mine, 1, 7));
  calls.push(pair(MAP.mine, 14, 7, MAP.pass, 1, 6));
  calls.push(pair(MAP.pass, 14, 6, MAP.sanctum, 1, 6));

  // 9) 시작 위치 + 세션 시작 상태.
  calls.push({ name: "set_start_position", args: { mapId: MAP.village, x: 10, y: 8 } });
  calls.push({ name: "set_session_start", args: { gold: 100, inventory: { it_potion: 2 }, partyActorIds: ["actor_hero"] } });
  return calls;
}

function replay(calls: readonly ToolCall[]): { project: Project; failures: Array<{ call: ToolCall; issues: unknown }> } {
  const ctx: ToolContext = { project: createEmptyToolProject("잿불의 유산(툴 재구축)") };
  const failures: Array<{ call: ToolCall; issues: unknown }> = [];
  for (const call of calls) {
    const result = runTool(ctx, call.name, call.args, { dryRun: false });
    if (!result.ok) failures.push({ call, issues: result.issues });
  }
  return { project: ctx.project, failures };
}

function countEventsByPrefix(project: Project, prefix: string): number {
  let count = 0;
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) if (event.id.startsWith(prefix)) count += 1;
  }
  return count;
}

describe("emberQuestToolReplay", () => {
  const { project, failures } = replay(buildToolSequence());

  it("모든 툴 호출이 성공한다(커밋 게이트 통과)", () => {
    expect(failures.map((f) => ({ name: f.call.name, issues: f.issues }))).toEqual([]);
  });

  it("스펙 카운트가 일치한다(맵5/NPC12/몬스터5/아이템8/전투블로커5)", () => {
    expect(Object.keys(project.maps).length).toBe(5);
    expect(countEventsByPrefix(project, "ev_npc_")).toBe(12);
    expect(countEventsByPrefix(project, "ev_blk_")).toBe(5);
    expect(project.database.items.length).toBe(8);
    expect(project.database.enemies.length).toBe(5);
    expect(project.database.troops.length).toBe(5);
  });

  it("projectLint error가 0이다", () => {
    const issues = projectLint(project);
    const errors = issues.filter((issue) => issue.severity === "error");
    expect(errors).toEqual([]);
  });

  it("주요 지점 도달성이 통과한다", () => {
    // 모든 맵의 전투 블로커/NPC가 시작 지점에서 인접 도달 가능해야 한다.
    const specs: ReachabilitySpec[] = [];
    for (const map of Object.values(project.maps)) {
      const from = map.id === project.startMapId
        ? project.startPos
        : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
      const targets = map.events
        .filter((event) => event.id.startsWith("ev_npc_") || event.id.startsWith("ev_blk_"))
        .map((event) => ({ x: event.x, y: event.y }));
      if (targets.length > 0) specs.push({ mapId: map.id, from, targets });
    }
    const issues = projectLint(project, { reachability: specs });
    const reachErrors = issues.filter((issue) => issue.code === "reachability");
    expect(reachErrors).toEqual([]);
  });

  it("시작 상태가 세션에 반영된다", () => {
    expect(project.startMapId).toBe(MAP.village);
    expect(project.startPos).toEqual({ x: 10, y: 8 });
    expect(project.session.gold).toBe(100);
    expect(project.session.inventory.it_potion).toBe(2);
  });
});
