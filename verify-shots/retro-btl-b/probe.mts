// 힘 모으기(chargeTurns)·게이지 밀기(gaugeShift) 헤드리스 프로브 — gauge·strict 두 흐름.
import { createBattleRuntime } from "@/battle/runtime";
import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";

function setup(flow: "gauge" | "strict") {
  const project = createBlankProject();
  project.system.battleModel = "rm2k3";
  project.system.battleUiStyle = "retro2003";
  const hero = project.database.actors[0]!;
  hero.initialEquipment = {};
  hero.parameterCurves.maxHp = Array(99).fill(2000); hero.parameterCurves.maxMp = Array(99).fill(200); hero.parameterCurves.agility = Array(99).fill(60);
  for (const klass of project.database.classes) klass.learnedSkills = [];
  const enemy = project.database.enemies[0]!;
  enemy.stats = { ...enemy.stats, maxHp: 99999, maxMp: 999, attack: 30, agility: 60 };
  const troop = project.database.troops.find((r) => r.id === project.system.initialTroopId) ?? project.database.troops[0]!;
  troop.enemyIds = [enemy.id]; troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }]; troop.battleEventPages = [];
  const add = (id: string, extra: any) => { const r = normalizeSkillRecord({ id, name: id, scope: "enemy", power: 40, mpCost: { flat: 0, percentMax: 0 }, variance: 0, hitRate: 100, successRate: 100, effect: { kind: "damage", statistic: "attack", affects: "hp" }, ...extra }); project.database.skills.push(r); return r; };
  const meteor = add("메테오", { chargeTurns: 2, power: 300, scope: "allEnemies", effect: { kind: "damage", statistic: "mind", affects: "hp" } });
  const delay = add("딜레이 베기", { gaugeShift: -60 });
  const chargeSlash = add("기합 베기", { chargeTurns: 1, power: 200 });
  enemy.actions = [{ skillId: meteor.id, priority: 50, condition: { kind: "always" } }] as any;
  hero.learnedSkills = [{ level: 1, skillId: delay.id }, { level: 1, skillId: chargeSlash.id }] as any;
  const rt = createBattleRuntime({ project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: flow, rng: () => 0.5,
    party: { levels: { [hero.id]: 1 }, experience: {}, partyActorIds: [hero.id] } });
  return { rt, hero, meteor, delay, chargeSlash };
}
const fmt = (e: any) => e.kind === "special" ? `「${e.message}」` : `${e.kind}${e.side ? "(" + e.side + ")" : ""}${e.skillName ? ":" + e.skillName : ""}${e.amount != null ? " " + e.amount : ""}`;

for (const flow of ["gauge", "strict"] as const) {
  { // 적 메테오(2턴 모으기): 예고 → 모으는 중 → 발동
    const { rt } = setup(flow);
    const views: string[] = [];
    for (let i = 0; i < 12 && !rt.snapshot().result; i++) {
      if (flow === "gauge") advanceBattleRuntime(rt);
      const s = rt.snapshot();
      if (s.enemies[0].charging) views.push(`${s.enemies[0].charging.skillName}/${s.enemies[0].charging.turnsLeft}`);
      if (s.phase === "actorCommand") rt.performActorCommand({ kind: "defend" });
    }
    const tl = rt.snapshot().timeline.filter((e: any) => e.side === "enemy" && (e.kind === "special" || e.kind === "damage"));
    console.log(`[${flow}] 적 메테오:`, tl.slice(0, 5).map(fmt).join(" → "), "| 스냅숏 charging:", [...new Set(views)].join(","));
  }
  { // 아군 기합 베기(1턴): 예고 → 다음 자기 차례 메뉴 없이 발동
    const { rt, chargeSlash } = setup(flow);
    let commanded = 0; let menusWhileCharging = 0;
    for (let i = 0; i < 14 && !rt.snapshot().result; i++) {
      if (flow === "gauge") advanceBattleRuntime(rt);
      const s = rt.snapshot();
      if (s.phase !== "actorCommand") continue;
      if (s.actors[0].charging) menusWhileCharging++;
      if (commanded === 0) rt.performActorCommand({ kind: "skill", skillId: chargeSlash.id, targetEnemyId: s.enemies[0].id } as any);
      else rt.performActorCommand({ kind: "defend" });
      commanded++;
    }
    const tl = rt.snapshot().timeline.filter((e: any) => e.side === "actor" && (e.kind === "special" || (e.kind === "damage" && e.skillName)));
    console.log(`[${flow}] 아군 기합 베기:`, tl.slice(0, 3).map(fmt).join(" → "), "| 모으는 중 메뉴 열림", menusWhileCharging);
  }
}
{ // 게이지 밀기: 맞은 적의 게이지가 깎이는가(gauge)
  const { rt, delay } = setup("gauge");
  for (let i = 0; i < 10; i++) {
    advanceBattleRuntime(rt);
    const s = rt.snapshot();
    if (s.phase !== "actorCommand") continue;
    const before = s.enemies[0].gauge;
    rt.performActorCommand({ kind: "skill", skillId: delay.id, targetEnemyId: s.enemies[0].id } as any);
    const after = rt.snapshot();
    console.log("[gauge] 딜레이 베기: 적 게이지", before.toFixed(1), "→", after.enemies[0].gauge.toFixed(1), "|", after.timeline.filter((e: any) => e.kind === "special").map(fmt).join(" "));
    break;
  }
}
