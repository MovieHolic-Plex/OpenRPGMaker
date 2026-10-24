// 폴른 스타 1막 — 추락지 발렌·달비늘 용 헤드리스 승률(정책별).
//   node_modules/.bin/vite-node --script scripts/qa/fallen-act1-sim.mts <project.json> [n] [only]
// 정책:
//   aware    — 용이 관통상이 아니면 카엘 「돌진 찌르기」/이리스 「충전 광선포」로 먼저 가르고, 나머지는 자동 AI(예측이 3배 마법을 고른다).
//   auto     — 자동 전투 AI 그대로(관통상을 노리지 않는다; 찌르기가 셀 때만 우연히 쓴다).
//   nopierce — 자동 AI 이되 찌르기·광선포를 금지(기믹 없이).
import { readFileSync } from "node:fs";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import { createBattleRuntime, headlessBattleSnapshot } from "@/battle/runtime";
import type { ActorCommand, BattleRuntimeOptions } from "@/battle/types";
import type { Project } from "@/project/types";
import { mulberry32, type Rng } from "@/util/rng";

const path = process.argv[2] ?? "dist/demos/chrono-bell.project.json";
const n = Number(process.argv[3] ?? 60);
const only = process.argv[4];
const project = JSON.parse(readFileSync(path, "utf8")) as Project;
for (const spec of (process.env.FS_SIM_ENEMY ?? "").split(";").filter(Boolean)) {
  const [id, body] = spec.split(":");
  const enemy = project.database.enemies.find((e) => e.id === id) as unknown as { stats: Record<string, number> } & Record<string, unknown>;
  for (const pair of body!.split(",")) { const [k, v] = pair.split("="); if (k! in enemy.stats) enemy.stats[k!] = Number(v); else enemy[k!] = Number(v); }
}
// FS_SIM_JSON='{"enemies":{"enemy_x":{...}},"skills":{"skill_y":{...}}}' — 레코드에 얕게 덮어쓴다(구운 파일은 그대로).
const patch = JSON.parse(process.env.FS_SIM_JSON ?? "{}") as Record<string, Record<string, Record<string, unknown>>>;
for (const [table, rows] of Object.entries(patch)) for (const [id, fields] of Object.entries(rows)) {
  const rec = (project.database as unknown as Record<string, Array<{ id: string }>>)[table]!.find((r) => r.id === id);
  if (!rec) throw new Error(`no ${table}.${id}`);
  Object.assign(rec, fields);
}
const PIERCED = "state_fs_pierced";
const PIERCE: Record<string, string> = { actor_hero: "skill_hero_rush_pierce", actor_fs_iris: "skill_gunner_snipe" };
const trio = ["actor_hero", "actor_fs_elena", "actor_fs_iris"];
type Policy = "aware" | "auto" | "nopierce";

function run(troopId: string, level: number, policy: Policy, rng: Rng, inventory: Record<string, number>) {
  const levels = Object.fromEntries(trio.map((id) => [id, level]));
  const inv = { ...inventory };
  const options: BattleRuntimeOptions = {
    project, troopId, canEscape: false, canLose: true,
    party: { levels, experience: {}, partyActorIds: [...trio] },
    sessionState: { switches: {}, variables: {}, inventory: inv },
    captureLocation: { mapId: project.startMapId, x: 0, y: 0 }, rng,
  } as unknown as BattleRuntimeOptions;
  const rt = createBattleRuntime(options);
  let actions = 0, pierces = 0, magic3x = 0, potions = 0;
  const uses: Record<string, number> = {};
  for (let step = 0; step < 9000; step += 1) {
    const snap = headlessBattleSnapshot(rt);
    if (snap.result) break;
    if (snap.phase !== "actorCommand") { rt.tick(1000); continue; }
    const actor = snap.actors.find((a) => a.recordId === snap.activeActorId);
    const foes = snap.enemies.filter((e) => !e.defeated && e.hp > 0);
    if (!actor || !foes.length) { rt.tick(1000); continue; }
    actions += 1;
    const boss = foes.find((e) => e.recordId === "enemy_fs_moon_dragon") ?? foes[0]!;
    let cmd: ActorCommand | undefined;
    const potion = (inv.item_hi_potion ?? 0) > 0 ? "item_hi_potion" : (inv.item_potion ?? 0) > 0 ? "item_potion" : undefined;
    const lowest = [...snap.actors].filter((a) => !a.defeated && a.hp > 0).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (lowest && lowest.hp <= lowest.maxHp * 0.3 && potion) {
      cmd = { kind: "item", itemId: potion, targetEnemyId: boss.id, targetActorId: lowest.recordId } as unknown as ActorCommand;
      inv[potion] = (inv[potion] ?? 1) - 1; potions += 1;
    }
    const pierceId = PIERCE[actor.recordId];
    if (!cmd && policy === "aware" && pierceId && !boss.stateIds.includes(PIERCED) && (actor.skillIds ?? []).includes(pierceId) && actor.mp >= 6) {
      cmd = { kind: "skill", skillId: pierceId, targetEnemyId: boss.id } as ActorCommand;
    }
    if (!cmd) cmd = chooseAutoBattleCommand(project, snap, rng);
    if (cmd?.kind === "skill" && policy === "nopierce" && Object.values(PIERCE).includes(cmd.skillId)) cmd = { kind: "attack", targetEnemyId: boss.id };
    if (cmd?.kind === "skill" && Object.values(PIERCE).includes(cmd.skillId)) pierces += 1;
    if (cmd?.kind === "skill" && boss.stateIds.includes(PIERCED)) {
      const skill = project.database.skills.find((s) => s.id === (cmd as { skillId: string }).skillId);
      if (skill?.effect.kind === "damage" && skill.effect.statistic === "mind") magic3x += 1;
    }
    const tag = cmd?.kind === "skill" ? cmd.skillId.replace(/^skill_/, "") : cmd?.kind === "item" ? cmd.itemId : (cmd?.kind ?? "attack");
    uses[tag] = (uses[tag] ?? 0) + 1;
    rt.performActorCommand(cmd ?? { kind: "attack", targetEnemyId: boss.id });
  }
  const final = headlessBattleSnapshot(rt);
  const fired = new Set(final.eventLogs.filter((l) => l.kind === "fired").map((l) => l.pageId));
  const taken: Record<string, number> = {};
  for (const r of final.roundLogs) for (const e of r.actions) {
    const k = `${e.side === "enemy" ? "E" : "A"}.${e.skillName ?? e.commandKind}`;
    if (typeof e.amount === "number") taken[k] = (taken[k] ?? 0) + e.amount;
  }
  return { uses, taken, win: final.result === "victory", rounds: final.turn, actions, pierces, magic3x, potions, hpLeft: final.actors.reduce((s, a) => s + Math.max(0, a.hp), 0), fired };
}

const cases: Array<{ troopId: string; level: number; policy: Policy; inv: Record<string, number> }> = [
  ...([6, 7] as const).flatMap((level) => (["auto"] as Policy[]).map((policy) => ({ troopId: "troop_fs_valen_crash", level, policy, inv: { item_potion: 5, item_hi_potion: 1, item_ether: 2 } }))),
  ...([8, 9] as const).flatMap((level) => (["aware", "auto", "nopierce"] as Policy[]).map((policy) => ({ troopId: "troop_fs_dragon", level, policy, inv: { item_potion: 6, item_hi_potion: 3, item_ether: 4 } }))),
];
for (const c of cases.filter((x) => !only || x.troopId.endsWith(only))) {
  const rng = mulberry32(11);
  let wins = 0, rounds = 0, pierces = 0, magic3x = 0, potions = 0, hp = 0;
  const fired = new Map<string, number>();
  const uses: Record<string, number> = {};
  const taken: Record<string, number> = {};
  for (let i = 0; i < n; i += 1) {
    const r = run(c.troopId, c.level, c.policy, rng, c.inv);
    if (r.win) wins += 1;
    rounds += r.rounds; pierces += r.pierces; magic3x += r.magic3x; potions += r.potions; hp += r.hpLeft;
    for (const id of r.fired) fired.set(id, (fired.get(id) ?? 0) + 1);
    for (const [k, v] of Object.entries(r.uses)) uses[k] = (uses[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.taken)) taken[k] = (taken[k] ?? 0) + v;
  }
  console.log(JSON.stringify({
    troop: c.troopId, lv: c.level, policy: c.policy, win: Math.round((wins / n) * 100) / 100, rounds: Math.round((rounds / n) * 10) / 10,
    pierces: Math.round((pierces / n) * 10) / 10, magic3x: Math.round((magic3x / n) * 10) / 10, potions: Math.round((potions / n) * 10) / 10, hpLeft: Math.round(hp / n),
    uses: process.env.FS_SIM_VERBOSE ? Object.entries(uses).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${Math.round(v / n)}`).join(" ") : undefined,
    taken: process.env.FS_SIM_VERBOSE ? Object.entries(taken).map(([k, v]) => `${k}:${Math.round(v / n)}`).join(" ") : undefined,
    pages: [...fired].map(([id, k]) => `${id.replace(/^troop_fs_(dragon|valen_crash)_/, "")}:${k}`).join(" "),
  }));
}
