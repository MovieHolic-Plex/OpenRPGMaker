// Chrono Trigger 기준 저작 매트릭스 — 편집기 AI 도구(runTool)만으로 CT식 미니 게임을 만든다.
// stdout: 직렬화한 프로젝트 JSON(런타임 QA 픽스처). CHRONO_REPORT 경로에 기준별 호출 결과를 쓴다.
// 최소 엔진 픽스처이며 데모 콘텐츠로 출하하거나 원격에 저장하지 않는다.
import { writeFileSync } from "node:fs";
import { createBlankProject } from "../../../src/project/defaults";
import { isPassable } from "../../../src/project/collision";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";
import type { GameMap, Project } from "../../../src/project/types";

type Step = { criterion: string; tool: string; ok: boolean; summary: string; issues?: string[]; warnings?: string[]; data?: unknown };
const steps: Step[] = [];
const project = createBlankProject();
project.meta.title = "Chrono criteria";
const ctx = { project };

function call(criterion: string, name: string, args: Record<string, unknown>): ReturnType<typeof runTool> {
  const result = runTool(ctx, name, args);
  steps.push({
    criterion, tool: name, ok: result.ok, summary: result.summary.slice(0, 400),
    ...(result.warnings?.length ? { warnings: result.warnings.slice(0, 4).map((w) => w.slice(0, 240)) } : {}),
    ...(result.data !== undefined ? { data: JSON.parse(JSON.stringify(result.data, (_k, v) => (typeof v === "string" && v.length > 200 ? v.slice(0, 200) : v))) } : {}),
    ...(result.ok ? {} : { issues: (result.issues ?? []).slice(0, 3).map((issue) => `${issue.code}: ${issue.message}`.slice(0, 300)) }),
  });
  return result;
}
const map = (id: string): GameMap => ctx.project.maps[id]!;
function passableNear(p: Project, id: string, cx: number, cy: number): { x: number; y: number } {
  const m = p.maps[id]!;
  for (let r = 0; r < Math.max(m.width, m.height); r += 1) {
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
      const x = cx + dx, y = cy + dy;
      if (x < 1 || y < 1 || x >= m.width - 1 || y >= m.height - 1) continue;
      if (isPassable(p, m, x, y) && !m.events.some((e) => e.x === x && e.y === y)) return { x, y };
    }
  }
  throw new Error(`no passable cell on ${id}`);
}
/** Passable cell with a passable cell directly below (so the player can stand south and face up). */
function standPair(p: Project, id: string, cx: number, cy: number): { at: { x: number; y: number }; stand: { x: number; y: number } } {
  const m = p.maps[id]!;
  for (let r = 0; r < 20; r += 1) for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
    const x = cx + dx, y = cy + dy;
    if (x < 1 || y < 1 || x >= m.width - 1 || y >= m.height - 2) continue;
    const free = (xx: number, yy: number) => isPassable(p, m, xx, yy) && !m.events.some((e) => e.x === xx && e.y === yy);
    if (free(x, y) && free(x, y + 1)) return { at: { x, y }, stand: { x, y: y + 1 } };
  }
  throw new Error(`no stand pair on ${id}`);
}

// ── C01 전투 화면: 크로노 스킨 + 게이지(ATB) ──
call("C01", "set_project_settings", { title: "시간의 문", battle: { flow: "gauge", uiStyle: "chrono" } });

// ── C02~C04 파티 3인 · 레벨 습득 기술 · 전체 공격 기술 ──
call("C04", "upsert_skill", { skill: { id: "skill_cyclone", name: "회전베기", scope: "allEnemies", power: 24, description: "주변 적 전부를 벤다", mpCost: { flat: 2, percentMax: 0 }, elementId: "sword" } });
call("C04", "upsert_skill", { skill: { id: "skill_fire_ring", name: "파이어", scope: "allEnemies", power: 20, description: "불꽃이 적 전부를 덮는다", mpCost: { flat: 3, percentMax: 0 }, elementId: "fire" } });
call("C04", "upsert_skill", { skill: { id: "skill_aura", name: "오라", scope: "ally", power: 30, description: "아군 하나 회복", effect: { kind: "healing", statistic: "mind", affects: "hp" }, mpCost: { flat: 1, percentMax: 0 } } });
call("C02", "upsert_actor", { actor: { id: "actor_hero", name: "크로", initialLevel: 5, learnedSkills: [{ level: 1, skillId: "skill_attack" }, { level: 3, skillId: "skill_cyclone" }] } });
call("C02", "upsert_actor", { actor: { id: "actor_mage", name: "루카", initialLevel: 5, learnedSkills: [{ level: 1, skillId: "skill_fire_ring" }] } });
call("C02", "upsert_actor", { actor: { id: "actor_cleric", name: "마루", initialLevel: 5, learnedSkills: [{ level: 1, skillId: "skill_aura" }] } });
call("C02", "set_party", { scope: "start", actorIds: ["actor_hero", "actor_mage", "actor_cleric"] });

// ── C05 연계기(듀얼 테크): 두 캐릭터가 함께 쓰는 기술 ──
call("C05", "upsert_skill", { skill: { id: "skill_x_strike", name: "X베기", scope: "enemy", power: 60, description: "두 사람이 교차해 벤다", requiredActorIds: ["actor_hero", "actor_mage"] } });

// ── C06 속성 약점 ──
call("C06", "upsert_enemy", { enemy: { id: "enemy_ice_imp", name: "얼음 임프", monsterResourceId: "generated-enemy-bat-01", stats: { maxHp: 80, maxMp: 10, attack: 14, defense: 8, mind: 8, agility: 12 }, elementRates: { fire: "A", ice: "E" }, rewards: { exp: 20, gold: 30 } } });
call("C06", "upsert_troop", { troop: { id: "troop_imps", name: "임프 무리", enemyIds: ["enemy_ice_imp", "enemy_ice_imp"] } });

// ── C07 보스 페이즈 + 시뮬레이션 ──
call("C07", "upsert_enemy", { role: "boss", enemy: { id: "enemy_boss_lavos", name: "시간의 포식자", monsterResourceId: "generated-enemy-golem-01", stats: { maxHp: 900, maxMp: 99, attack: 30, defense: 18, mind: 20, agility: 10 }, rewards: { exp: 300, gold: 500 } } });
call("C07", "upsert_troop", { troop: { id: "troop_boss", name: "포식자", enemyIds: ["enemy_boss_lavos", "enemy_ice_imp"], members: [{ enemyId: "enemy_boss_lavos", x: 96, y: 96, hidden: false }, { enemyId: "enemy_ice_imp", x: 40, y: 120, hidden: true }] } });
call("C07", "author_boss_phases", { troopId: "troop_boss", enemyId: "enemy_boss_lavos", phases: [
  { atHpPercent: 60, name: "껍질이 벗겨진다", message: "껍질이 갈라진다…!", enrageStateId: "state_attack_up" },
  { atHpPercent: 25, name: "핵 노출", message: "시간이 비명을 지른다!", healPercent: 15, summonEnemyId: "enemy_ice_imp" },
] });
call("C07", "simulate_battle", { troopId: "troop_boss", heroLevel: 12, partyActorIds: ["actor_hero", "actor_mage", "actor_cleric"], n: 20, seed: 7 });

// ── C10 마을(현대) + 상점 ──
call("C10", "author_village", { target: { kind: "new", mapId: "map_era_present", name: "트루스 마을 (현대)", width: 40, height: 30, tilesetId: "easyrpg_chipset_combined_town" }, houseCount: 5, countPolicy: "exact", seed: 3, interior: false, morphology: "green", npcCount: 3, residents: [{ name: "촌장", lines: ["천년제에 잘 왔네."] }, { name: "대장장이", lines: ["검은 손봐 주지."] }, { name: "아이", lines: ["마르레가 광장에 있어!"] }] });
const town = "map_era_present";
const shopAt = passableNear(ctx.project, town, 20, 15);
call("C10", "make_villager", { mapId: town, name: "무기상", home: shopAt, id: "ev_weapon_shop", dialogue: [{ text: "좋은 물건 있어." }] });
call("C10", "set_shop_stock", { mapId: town, eventId: "ev_weapon_shop", stock: [{ itemId: "equip_iron_sword" }, { itemId: "item_potion" }, { itemId: "item_ether" }] });

// ── C11 성 ──
call("C11", "build_castle", { id: "map_castle", name: "가르디아 성", width: 48, height: 40, seed: 5, npcs: true });
// ── C12 던전 ──
call("C12", "run_dungeon_room_pipeline", { mapId: "map_cave", name: "잊힌 동굴", theme: "stone", character: "cavern", seed: 9 });

// ── C13 시간 여행: 같은 장소의 다른 시대 + 시간의 문 ──
call("C13", "duplicate_map", { mapId: town, id: "map_era_future", name: "트루스 마을 (미래 폐허)" });
call("C13", "set_scene_mood", { mapId: "map_era_future", weather: { kind: "fog", intensity: 0.6 }, lighting: { ambient: 0.55, color: "#201028" } });
const gateA = passableNear(ctx.project, town, 3, 3);
const gateB = passableNear(ctx.project, "map_era_future", 3, 3);
call("C13", "create_transfer_pair", { a: { mapId: town, x: gateA.x, y: gateA.y }, b: { mapId: "map_era_future", x: gateB.x, y: gateB.y }, fade: "white" });

// 월드 연결: 마을 ↔ 성, 마을 ↔ 동굴
for (const [target, tx, ty] of [["map_castle", 24, 38], ["map_cave", 2, 10]] as const) {
  if (!ctx.project.maps[target]) continue;
  const a = passableNear(ctx.project, town, target === "map_castle" ? 38 : 1, 28);
  const b = passableNear(ctx.project, target, tx, ty);
  call("C14", "create_transfer_pair", { a: { mapId: town, x: a.x, y: a.y }, b: { mapId: target, x: b.x, y: b.y }, fade: "black" });
}

const flag = call("C17", "declare_story_flag", { id: "boss-defeated", kind: "switch", description: "시간의 포식자를 쓰러뜨렸다" });
const bossSwitch = String((flag.data as { targetId?: string; switchId?: string } | undefined)?.targetId ?? (flag.data as { switchId?: string } | undefined)?.switchId ?? "sw_boss_down");
// ── C08 보이는 필드 적(심볼 인카운터) · 보스 방 ──
if (ctx.project.maps["map_cave"]) {
  const bat = passableNear(ctx.project, "map_cave", 12, 12);
  call("C08", "place_battle_blocker", { mapId: "map_cave", x: bat.x, y: bat.y, troopId: "troop_imps", id: "ev_cave_imps", fightMovement: "random" });
  const boss = passableNear(ctx.project, "map_cave", Math.floor(map("map_cave").width * 0.7), Math.floor(map("map_cave").height * 0.5));
  call("C08", "place_battle_blocker", { mapId: "map_cave", x: boss.x, y: boss.y, troopId: "troop_boss", id: "ev_boss", clearSwitchId: bossSwitch, intro: ["시간이 울린다…"] });
  const save = passableNear(ctx.project, "map_cave", boss.x - 3, boss.y);
  call("C15", "place_savepoint", { mapId: "map_cave", x: save.x, y: save.y, name: "세이브 포인트" });
  const chest = passableNear(ctx.project, "map_cave", 6, 6);
  call("C16", "place_chest", { mapId: "map_cave", x: chest.x, y: chest.y, id: "ev_cave_chest", contents: { itemId: "item_ether", gold: 200 } });
}

// ── C17 서사 플래그 · 퀘스트 ──
call("C17", "create_quest", { def: { key: "pendant", title: "펜던트 찾기", summary: "광장의 소녀에게 펜던트를 돌려준다.", giver: { create: { mapId: town, ...passableNear(ctx.project, town, 18, 12), name: "마르레" } }, steps: [{ kind: "talk", target: { create: { mapId: town, ...passableNear(ctx.project, town, 24, 12), name: "경비병" } }, lines: ["펜던트? 동쪽 시장에 떨어져 있었지."] }], rewards: { gold: 100 } } });

// ── C18 컷신(천년제 개막) ──
const cutAt = passableNear(ctx.project, town, 20, 20);
call("C18", "script_cutscene", { mapId: town, eventId: "ev_millennial_fair", x: cutAt.x, y: cutAt.y, trigger: "auto", once: true, skippable: true, beats: [
  { kind: "say", speaker: "촌장", text: "천년제를 시작하노라!" },
  { kind: "say", speaker: "크로", text: "(종이 울린다… 오늘은 무언가 일어날 것 같다.)" },
] });

// ── C19 멀티 엔딩 ──
call("C19", "define_ending", { id: "ending_true", name: "새로운 시대", priority: 10, conditions: [{ kind: "switch", switchId: bossSwitch, value: true }], epilogue: [{ kind: "say", speaker: "크로", text: "미래는 바뀌었다." }] });
call("C19", "define_ending", { id: "ending_doom", name: "멸망의 날", priority: 1, conditions: [], epilogue: [{ kind: "say", speaker: "해설", text: "그리고 하늘이 붉게 물들었다." }] });
if (ctx.project.maps["map_castle"]) {
  const king = passableNear(ctx.project, "map_castle", 24, 10);
  call("C19", "place_npc", { mapId: "map_castle", x: king.x, y: king.y, name: "왕", id: "ev_king", pages: [
    { lines: ["아직 시간의 포식자가 살아 있다."] },
    { conditions: [{ kind: "switch", switchId: bossSwitch, value: true }], lines: ["잘 해냈다, 용사여."], commands: [{ kind: "triggerEnding", endingId: "ending_true" }] },
  ] });
}

// ── C20 오프닝 + 타이틀 ──
call("C20", "set_opening", { enabled: true, skippable: true, scenes: [{ kind: "text", narration: "1000년, 가르디아 왕국.", durationMs: 2500 }, { kind: "text", narration: "시간의 문이 열리기 전 마지막 아침.", durationMs: 2500 }] });
call("C20", "set_title_screen", { title: "시간의 문" });
call("C20", "improve_title_screen", { stage: 3, openingPreset: "moonlitCastle", particles: "fireflies" });

// ── C21 파티 동료가 따라 걷기 ──
call("C21", "configure_companion_rules", { gap: 1, maxCompanions: 3, formation: "line" });
{
  const joinAt = passableNear(ctx.project, town, 5, 5);
  call("C21", "add_companion", { who: { actorId: "actor_mage" }, target: { mapId: town, x: joinAt.x, y: joinAt.y }, trigger: "autorun", name: "루카 합류", hidden: true });
  const joinAt2 = passableNear(ctx.project, town, 6, 5);
  call("C21", "add_companion", { who: { actorId: "actor_cleric" }, target: { mapId: town, x: joinAt2.x, y: joinAt2.y }, trigger: "autorun", name: "마루 합류", hidden: true });
}

// ── C22 NG+(강하게 다시 하기) ──
call("C22", "set_project_settings", { newGamePlus: { enabled: true, carryLevels: true } });

// ── 시작 위치: 필드 적 바로 남쪽 → 런타임에서 위를 보고 조사하면 전투 ──
const startPair = standPair(ctx.project, town, 20, 22);
call("C09", "place_battle_blocker", { mapId: town, x: startPair.at.x, y: startPair.at.y, troopId: "troop_imps", id: "ev_field_imps", fightMovement: "fixed" });
call("C00", "set_start_position", { mapId: town, x: startPair.stand.x, y: startPair.stand.y });

// 픽스처 정리: 기본 빈 맵은 쓰지 않는다. 멸망 엔딩은 미래 폐허의 기록 장치가 부른다.
call("C19", "remove_map", { mapId: "map_blank_start" });
{
  const rec = passableNear(ctx.project, "map_era_future", 20, 15);
  call("C19", "place_npc", { mapId: "map_era_future", x: rec.x, y: rec.y, name: "기록 장치", id: "ev_doom_record", pages: [{ lines: ["…1999년, 하늘에서 그것이 왔다."], commands: [{ kind: "triggerEnding", endingId: "ending_doom" }] }] });
}

// ── 검증 도구 ──
if (ctx.project.maps["map_cave"]) {
  call("V1", "play_walkthrough", { seed: 3, scenario: [
    { do: "moveTo", mapId: "map_cave", x: 8, y: 9 },
    { do: "interact", eventId: "ev_cave_chest" },
    { expect: "item", itemId: "item_ether", present: true },
    { do: "interact", eventId: "ev_boss" },
    { do: "battle", expect: "victory" },
    { expect: "switch", switchId: bossSwitch, value: true },
  ] });
}
call("V2", "evaluate_game_quality", {});
call("V3", "run_lint", {});
call("V4", "check_export_readiness", {});

const s = ctx.project.system as Record<string, unknown>;
const facts = {
  battleUiStyle: s.battleUiStyle, battleFlow: s.battleFlow, party: ctx.project.system.startActorIds,
  xStrikeStored: ctx.project.database.skills.find((k) => k.id === "skill_x_strike") ?? null,
  maps: Object.values(ctx.project.maps).map((m) => ({ id: m.id, name: m.name, w: m.width, h: m.height, events: m.events.length, tileset: m.tilesetId })),
  newGamePlus: s.newGamePlus ?? null, bossSwitch, bossTroopPages: ctx.project.database.troops.find((t) => t.id === "troop_boss")?.battleEventPages?.length ?? 0,
  start: { mapId: ctx.project.startMapId, ...ctx.project.startPos, blocker: startPair.at },
};
if (process.env.CHRONO_REPORT) writeFileSync(process.env.CHRONO_REPORT, JSON.stringify({ steps, facts }, null, 1));
const json = serialize(ctx.project);
deserialize(json);
process.stdout.write(json);
